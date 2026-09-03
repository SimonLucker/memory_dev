-- Memmory v3: relational schema, auth-ready RLS.
-- Paste the whole file into the Supabase SQL editor and Run. Safe to run twice.
-- Afterwards: `node scripts/migrate-v3.mjs` copies the v2 jsonb rows into the
-- new tables and seeds Isabel's demo space.

-- 1. Park the v2 jsonb tables under *_v2. The new "memories" table below needs
--    the name; migrate-v3.mjs reads memories_v2. Only renames when the table
--    is still the jsonb one (has a "data" column), so a re-run is a no-op.
do $$ begin
  if to_regclass('public.memories_v2') is null and exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'memories' and column_name = 'data')
  then alter table public.memories rename to memories_v2; end if;
  if to_regclass('public.cards_v2') is null and exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'cards' and column_name = 'data')
  then alter table public.cards rename to cards_v2; end if;
end $$;

-- 2. The auth switch. auth_required=false (today) means the anon key sees
--    everything, exactly like v2. Flip it to true once Supabase Auth issues
--    JWTs that carry a "person_id" claim; nothing else changes.
create table if not exists public.app_settings (
  key text primary key,
  value jsonb not null
);
insert into public.app_settings (key, value) values ('auth_required', 'false')
  on conflict (key) do nothing;
alter table public.app_settings enable row level security;
drop policy if exists "settings read" on public.app_settings;
create policy "settings read" on public.app_settings
  for select to anon, authenticated using (true);

create schema if not exists app;
grant usage on schema app to anon, authenticated;

-- Who is calling: the person_id claim of the JWT, or null (anon key).
create or replace function app.current_person() returns text
  language sql stable as $$
  select nullif(auth.jwt() ->> 'person_id', '')
$$;

-- Is the app still open (no auth enforced)?
create or replace function app.open() returns boolean
  language sql stable as $$
  select not coalesce((select (value #>> '{}')::boolean from public.app_settings
                       where key = 'auth_required'), false)
$$;

-- 3. Tables. Ids stay text so the app keeps minting them (m001, p2m014).
create table if not exists public.people (
  id text primary key,
  name text not null,
  first_name text,
  avatar_url text,
  is_user boolean not null default false,
  space_id text,                    -- whose contact list this row lives in (= id for users)
  created_at timestamptz not null default now()
);

create table if not exists public.memories (
  id text primary key,
  owner_id text not null references public.people (id),
  title text,
  place text,
  starts_at timestamptz,
  ends_at timestamptz,
  about text,
  class text,
  feeling text[] not null default '{}',
  music jsonb,                      -- {name, artist}
  importance int,
  cover_moment_id text,             -- null = first photo
  favorite boolean not null default false,
  demo boolean not null default false,
  legacy jsonb,                     -- untouched v2 fields (_pos, why, summary, ...)
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.moments (
  id text primary key,
  memory_id text not null references public.memories (id) on delete cascade,
  kind text not null check (kind in ('photo', 'video', 'voice', 'text', 'answer')),
  src text,
  poster text,
  duration real,
  transcript text,
  text text,
  generated_by text references public.people (id),
  question_id text,
  captured_at timestamptz,
  position int not null default 0,  -- story order = position, then captured_at
  demo boolean not null default false,
  created_at timestamptz not null default now()
);
create index if not exists moments_memory_idx on public.moments (memory_id);

create table if not exists public.memory_people (
  memory_id text not null references public.memories (id) on delete cascade,
  person_id text not null references public.people (id),
  role text not null check (role in ('contributor', 'tagged')),
  primary key (memory_id, person_id)
);
create index if not exists memory_people_person_idx on public.memory_people (person_id);

create table if not exists public.questions (
  id text primary key,
  memory_id text not null references public.memories (id) on delete cascade,
  person_id text,                   -- who is asked
  text text not null,
  asked_at timestamptz not null default now(),
  answered_at timestamptz
);

create table if not exists public.recaps (
  id text primary key,
  memory_id text not null references public.memories (id) on delete cascade,
  beats jsonb not null default '[]',
  song jsonb,
  created_at timestamptz not null default now()
);

-- Unchanged capture-engine tables (created here too so a fresh project works).
create table if not exists public.threads (
  person_id text not null, id text not null, data jsonb not null,
  updated_at timestamptz not null default now(), primary key (person_id, id));
create table if not exists public.profiles (
  person_id text primary key, data jsonb not null,
  updated_at timestamptz not null default now());

-- 4. RLS. One permissive policy per table: open app, or the ownership test.
--    can_see() is security definer so the memories <-> memory_people policies
--    never recurse into each other.
create or replace function app.can_see(mid text) returns boolean
  language sql stable security definer set search_path = public as $$
  select app.open()
    or exists (select 1 from memories m
               where m.id = mid and m.owner_id = app.current_person())
    or exists (select 1 from memory_people mp
               where mp.memory_id = mid and mp.person_id = app.current_person()
                 and mp.role = 'contributor')
$$;
grant execute on all functions in schema app to anon, authenticated;

alter table public.people enable row level security;
drop policy if exists "people access" on public.people;
create policy "people access" on public.people for all to anon, authenticated
  using (app.open() or is_user or space_id = app.current_person()
         or exists (select 1 from public.memory_people mp
                    where mp.person_id = people.id and app.can_see(mp.memory_id)))
  with check (app.open() or space_id = app.current_person());

alter table public.memories enable row level security;
drop policy if exists "memories access" on public.memories;
create policy "memories access" on public.memories for all to anon, authenticated
  using (app.can_see(id)) with check (app.can_see(id) or owner_id = app.current_person());

alter table public.moments enable row level security;
drop policy if exists "moments access" on public.moments;
create policy "moments access" on public.moments for all to anon, authenticated
  using (app.can_see(memory_id)) with check (app.can_see(memory_id));

alter table public.memory_people enable row level security;
drop policy if exists "memory_people access" on public.memory_people;
create policy "memory_people access" on public.memory_people for all to anon, authenticated
  using (app.can_see(memory_id)) with check (app.can_see(memory_id));

alter table public.questions enable row level security;
drop policy if exists "questions access" on public.questions;
create policy "questions access" on public.questions for all to anon, authenticated
  using (app.can_see(memory_id)) with check (app.can_see(memory_id));

alter table public.recaps enable row level security;
drop policy if exists "recaps access" on public.recaps;
create policy "recaps access" on public.recaps for all to anon, authenticated
  using (app.can_see(memory_id)) with check (app.can_see(memory_id));

alter table public.threads enable row level security;
drop policy if exists "anon full access threads" on public.threads;
drop policy if exists "threads access" on public.threads;
create policy "threads access" on public.threads for all to anon, authenticated
  using (app.open() or person_id = app.current_person())
  with check (app.open() or person_id = app.current_person());

alter table public.profiles enable row level security;
drop policy if exists "anon full access profiles" on public.profiles;
drop policy if exists "profiles access" on public.profiles;
create policy "profiles access" on public.profiles for all to anon, authenticated
  using (app.open() or person_id = app.current_person())
  with check (app.open() or person_id = app.current_person());

-- 5. Storage stays as in v2: public bucket "photos", anon read + upload.
insert into storage.buckets (id, name, public) values ('photos', 'photos', true)
  on conflict (id) do nothing;
drop policy if exists "anon read photos" on storage.objects;
create policy "anon read photos" on storage.objects
  for select to anon using (bucket_id = 'photos');
drop policy if exists "anon upload photos" on storage.objects;
create policy "anon upload photos" on storage.objects
  for insert to anon with check (bucket_id = 'photos');

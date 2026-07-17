-- Memmory POC schema — paste into the Supabase SQL editor and Run.
-- One jsonb column per memory: the app's memory object is the schema
-- (see .claude/skills/memory-schema/SKILL.md); no migrations while it evolves.

create table if not exists public.memories (
  person_id text not null,
  id text not null,
  data jsonb not null,
  updated_at timestamptz not null default now(),
  primary key (person_id, id)
);

-- POC access model: the anon key may read and write everything.
-- (No auth in scope — anyone holding the app URL + anon key can edit. Fine for
-- a private test; add Supabase Auth before sharing the link around.)
alter table public.memories enable row level security;

drop policy if exists "anon full access" on public.memories;
create policy "anon full access" on public.memories
  for all to anon using (true) with check (true);

-- Public photo bucket: uploaded memory photos, served via public URLs.
insert into storage.buckets (id, name, public)
  values ('photos', 'photos', true)
  on conflict (id) do nothing;

drop policy if exists "anon read photos" on storage.objects;
create policy "anon read photos" on storage.objects
  for select to anon using (bucket_id = 'photos');

drop policy if exists "anon upload photos" on storage.objects;
create policy "anon upload photos" on storage.objects
  for insert to anon with check (bucket_id = 'photos');

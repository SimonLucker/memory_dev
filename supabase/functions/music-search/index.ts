// Apple catalog lookup, server-side — immune to browser content blockers,
// CORS and JSONP quirks. Tries artist+title, then title alone, then the US
// store as a fallback. Deploy: supabase functions deploy music-search --no-verify-jwt

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const search = async (term: string, country: string) => {
  const r = await fetch(
    `https://itunes.apple.com/search?media=music&limit=5&country=${country}&term=${encodeURIComponent(term)}`,
    { headers: { 'User-Agent': 'Memmory/0.1' } })
  if (!r.ok) return null
  const d = await r.json()
  return (d.results || []).find((t: { previewUrl?: string }) => t.previewUrl) || null
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors })
  const json = (body: unknown, status = 200) =>
    new Response(JSON.stringify(body), { status, headers: { ...cors, 'Content-Type': 'application/json' } })
  try {
    const { artist, name, country } = await req.json()
    const cc = /^[A-Z]{2}$/.test(country || '') ? country : 'US'
    const full = `${artist || ''} ${name || ''}`.trim()
    let t = full && await search(full, cc)
    if (!t && artist && name) t = await search(name, cc)
    if (!t && cc !== 'US') t = await search(full, 'US')
    return json({ result: t ? {
      trackName: t.trackName, artistName: t.artistName,
      previewUrl: t.previewUrl, artworkUrl100: t.artworkUrl100, trackViewUrl: t.trackViewUrl,
    } : null })
  } catch (e) {
    return json({ result: null, error: String(e) })
  }
})

// Voice → text via Deepgram. Body: raw audio bytes, content-type preserved.
// Deploy: supabase functions deploy transcribe --no-verify-jwt

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors })
  const json = (body: unknown, status = 200) =>
    new Response(JSON.stringify(body), { status, headers: { ...cors, 'Content-Type': 'application/json' } })

  try {
    const key = Deno.env.get('DEEPGRAM_API_KEY') || ''
    if (!key) return json({ transcript: '', error: 'DEEPGRAM_API_KEY secret missing' })
    const audio = await req.arrayBuffer()
    const r = await fetch('https://api.deepgram.com/v1/listen?model=nova-3&smart_format=true', {
      method: 'POST',
      headers: {
        Authorization: `Token ${key}`,
        'Content-Type': req.headers.get('content-type') || 'audio/webm',
      },
      body: audio,
    })
    const data = await r.json()
    if (!r.ok) throw new Error(data.err_msg || r.statusText)
    return json({ transcript: data.results?.channels?.[0]?.alternatives?.[0]?.transcript || '' })
  } catch (e) {
    return json({ error: String(e) }, 502)
  }
})

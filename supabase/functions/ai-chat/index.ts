// Memorialization chat proxy — Azure OpenAI today, any Claude-compatible
// endpoint later. Keys live in Supabase secrets, never in the browser.
// Deploy: supabase functions deploy ai-chat --no-verify-jwt

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors })
  const json = (body: unknown, status = 200) =>
    new Response(JSON.stringify(body), { status, headers: { ...cors, 'Content-Type': 'application/json' } })

  try {
    const ep = (Deno.env.get('AZURE_OPENAI_ENDPOINT') || '').replace(/\/$/, '')
    const dep = Deno.env.get('AZURE_OPENAI_DEPLOYMENT') || ''
    const ver = Deno.env.get('AZURE_OPENAI_API_VERSION') || 'preview'
    const key = Deno.env.get('AZURE_OPENAI_API_KEY') || ''
    if (!ep || !key) return json({ error: 'AI not configured — set the AZURE_OPENAI_* secrets' }, 500)

    const { messages } = await req.json()
    const url = ver === 'preview'
      ? `${ep}/openai/v1/chat/completions`
      : `${ep}/openai/deployments/${dep}/chat/completions?api-version=${ver}`
    const r = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'api-key': key },
      body: JSON.stringify({ model: dep, messages }),
    })
    const data = await r.json()
    if (!r.ok) throw new Error(data.error?.message || r.statusText)
    return json({ content: data.choices[0].message.content })
  } catch (e) {
    return json({ error: String(e) }, 502)
  }
})

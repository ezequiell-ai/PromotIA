import { createClient } from '@supabase/supabase-js'

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type')
  if (req.method === 'OPTIONS') return res.status(200).end()

  const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY)

  if (req.method === 'GET') {
    const { clientId } = req.query
    if (!clientId) return res.status(400).json({ error: 'clientId requerido' })
    const { data, error } = await supabase.from('promotia_survey_configs').select('*').eq('client_id', clientId).maybeSingle()
    if (error) return res.status(500).json({ error: error.message })
    return res.status(200).json(data || {})
  }

  if (req.method === 'POST') {
    const { clientId, title, logoUrl, primaryColor, question } = req.body
    if (!clientId) return res.status(400).json({ error: 'clientId requerido' })
    const { error } = await supabase.from('promotia_survey_configs').upsert({
      client_id: clientId,
      title: title || null,
      logo_url: logoUrl || null,
      primary_color: primaryColor || '#73017B',
      question: question || '¿Qué tan probable es que nos recomiendes?',
      updated_at: new Date().toISOString(),
    })
    if (error) return res.status(500).json({ error: error.message })
    return res.status(200).json({ ok: true })
  }

  return res.status(405).end()
}

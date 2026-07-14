import { createClient } from '@supabase/supabase-js'

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type')

  if (req.method === 'OPTIONS') return res.status(200).end()
  if (req.method !== 'POST') return res.status(405).end()

  const { clientId, score, comment, name, company } = req.body

  if (!clientId || score === undefined || score === null) {
    return res.status(400).json({ error: 'clientId y score son requeridos' })
  }

  if (score < 0 || score > 10) {
    return res.status(400).json({ error: 'score debe ser entre 0 y 10' })
  }

  const supabase = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_SERVICE_KEY
  )

  const { error } = await supabase
    .from('promotia_survey_responses')
    .insert({ client_id: clientId, score, comment: comment || null, name: name || null, company: company || null })

  if (error) {
    console.error('survey insert error:', error)
    return res.status(500).json({ error: 'Error al guardar la respuesta' })
  }

  return res.status(200).json({ ok: true })
}

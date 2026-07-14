import { createClient } from '@supabase/supabase-js'

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type')
  if (req.method === 'OPTIONS') return res.status(200).end()
  if (req.method !== 'GET') return res.status(405).end()

  const { clientId, limit = 300 } = req.query
  const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY)

  let query = supabase
    .from('promotia_survey_responses')
    .select('id, client_id, score, comment, name, company, created_at')
    .lte('score', 6)
    .order('created_at', { ascending: false })
    .limit(parseInt(limit))

  if (clientId) query = query.eq('client_id', clientId)

  const { data, error } = await query
  if (error) return res.status(500).json({ error: error.message })
  return res.status(200).json({ detractors: data || [] })
}

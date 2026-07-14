import { createClient } from '@supabase/supabase-js'

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type')
  if (req.method === 'OPTIONS') return res.status(200).end()
  if (req.method !== 'GET') return res.status(405).end()

  const { clientId, month } = req.query
  if (!clientId) return res.status(400).json({ error: 'clientId es requerido' })

  const supabase = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_SERVICE_KEY
  )

  let query = supabase
    .from('promotia_survey_responses')
    .select('score, comment, name, company, segmento, sector, region, created_at')
    .eq('client_id', clientId)
    .order('created_at', { ascending: false })

  // Filtrar por mes si se pasa (formato YYYY-MM)
  if (month) {
    const [y, m] = month.split('-')
    const from = `${y}-${m}-01T00:00:00.000Z`
    const toDate = new Date(+y, +m, 1) // primer día del mes siguiente
    const to = toDate.toISOString()
    query = query.gte('created_at', from).lt('created_at', to)
  }

  const { data, error } = await query

  if (error) {
    console.error('survey-import error:', error)
    return res.status(500).json({ error: 'Error al obtener respuestas' })
  }

  // Mapear al formato interno de PromotIA
  const responses = (data || []).map(r => {
    const row = { e: r.score }
    if (r.comment) row.c = r.comment
    const d = {}
    if (r.segmento) d.Segmento = r.segmento
    if (r.sector) d.Sector = r.sector
    if (r.region) d['Región'] = r.region
    if (Object.keys(d).length) row.d = d
    return row
  })

  return res.status(200).json({ responses, total: responses.length })
}

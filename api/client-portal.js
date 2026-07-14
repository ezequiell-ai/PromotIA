import { createClient } from '@supabase/supabase-js'

// Devuelve métricas NPS de un cliente desde survey_responses (para el portal público)
export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*')
  if (req.method !== 'GET') return res.status(405).end()

  const { clientId } = req.query
  if (!clientId) return res.status(400).json({ error: 'clientId requerido' })

  const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY)

  const { data, error } = await supabase
    .from('promotia_survey_responses')
    .select('score, comment, name, company, segmento, sector, region, created_at')
    .eq('client_id', clientId)
    .order('created_at', { ascending: false })

  if (error) return res.status(500).json({ error: error.message })

  // Agrupar por mes
  const byMonth = {}
  for (const r of data || []) {
    const d = new Date(r.created_at)
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
    if (!byMonth[key]) byMonth[key] = []
    byMonth[key].push({ e: r.score, c: r.comment || undefined, d: buildDims(r) })
  }

  const months = Object.entries(byMonth)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([month, responses]) => ({
      month,
      sent: responses.length,
      responses,
    }))

  return res.status(200).json({ months, total: data?.length || 0 })
}

function buildDims(r) {
  const d = {}
  if (r.segmento) d.Segmento = r.segmento
  if (r.sector) d.Sector = r.sector
  if (r.region) d['Región'] = r.region
  return Object.keys(d).length ? d : undefined
}

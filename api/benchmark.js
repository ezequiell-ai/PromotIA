import { createClient } from '@supabase/supabase-js'

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*')
  if (req.method !== 'GET') return res.status(405).end()

  const { sector } = req.query
  const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY)

  const { data, error } = await supabase
    .from('promotia_survey_responses')
    .select('client_id, score, sector, segmento')

  if (error) return res.status(500).json({ error: error.message })

  const rows = data || []

  // NPS global de la plataforma
  function calcNPS(responses) {
    if (!responses.length) return null
    const n = responses.length
    const pro = responses.filter(r => r.score >= 9).length
    const det = responses.filter(r => r.score <= 6).length
    return Math.round((pro / n) * 100) - Math.round((det / n) * 100)
  }

  // Agrupar por sector
  const bySector = {}
  for (const r of rows) {
    const s = r.sector || 'Sin sector'
    if (!bySector[s]) bySector[s] = []
    bySector[s].push(r)
  }

  const sectorStats = Object.entries(bySector)
    .map(([name, rs]) => ({ sector: name, nps: calcNPS(rs), n: rs.length }))
    .filter(s => s.nps !== null && s.n >= 5) // mínimo 5 respuestas para mostrar
    .sort((a, b) => b.nps - a.nps)

  // Agrupar por cliente (para mostrar posición relativa)
  const byClient = {}
  for (const r of rows) {
    if (!byClient[r.client_id]) byClient[r.client_id] = []
    byClient[r.client_id].push(r)
  }

  const clientStats = Object.entries(byClient)
    .map(([clientId, rs]) => ({ clientId, nps: calcNPS(rs), n: rs.length }))
    .filter(c => c.nps !== null)
    .sort((a, b) => b.nps - a.nps)

  const globalNPS = calcNPS(rows)
  const totalResponses = rows.length
  const totalClients = Object.keys(byClient).length

  // Si se pide el benchmark de un sector específico
  const sectorBenchmark = sector
    ? calcNPS(rows.filter(r => (r.sector || 'Sin sector') === sector))
    : null

  return res.status(200).json({
    globalNPS,
    totalResponses,
    totalClients,
    sectorStats,
    clientStats,
    sectorBenchmark,
  })
}

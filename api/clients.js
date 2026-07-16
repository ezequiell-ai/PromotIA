import { createClient } from '@supabase/supabase-js'

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, DELETE, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type')
  if (req.method === 'OPTIONS') return res.status(200).end()

  const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY)

  // GET — list all clients
  if (req.method === 'GET') {
    const { data, error } = await supabase
      .from('promotia_clients')
      .select('id, data, created_at')
      .order('created_at', { ascending: true })
    if (error) return res.status(500).json({ error: error.message })
    const clients = (data || []).map(row => ({ ...row.data, id: row.id, _createdAt: row.created_at }))
    return res.status(200).json({ clients })
  }

  // POST — upsert a client (create or update)
  if (req.method === 'POST') {
    const { client } = req.body || {}
    if (!client || !client.id) return res.status(400).json({ error: 'client.id requerido' })
    const { error } = await supabase
      .from('promotia_clients')
      .upsert({ id: client.id, data: client, updated_at: new Date().toISOString() }, { onConflict: 'id' })
    if (error) return res.status(500).json({ error: error.message })
    return res.status(200).json({ ok: true })
  }

  // DELETE — remove client (responses cascade)
  if (req.method === 'DELETE') {
    const { id } = req.query
    if (!id) return res.status(400).json({ error: 'id requerido' })
    const { error } = await supabase.from('promotia_clients').delete().eq('id', id)
    if (error) return res.status(500).json({ error: error.message })
    return res.status(200).json({ ok: true })
  }

  return res.status(405).end()
}

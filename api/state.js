/**
 * api/state.js — Persistencia del estado de la app en Supabase.
 * GET    → devuelve { value: JSON string } del estado guardado
 * POST   → body { value: JSON string } — guarda/actualiza el estado
 * DELETE → borra el estado (reset)
 *
 * Usa la tabla app_state (key text PK, value text, updated_at timestamptz)
 * Ejecutar en Supabase SQL Editor:
 *   create table if not exists app_state (
 *     key text primary key,
 *     value text not null,
 *     updated_at timestamptz default now()
 *   );
 */

const STATE_KEY = 'promotia:DB'

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, DELETE, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type')
  if (req.method === 'OPTIONS') return res.status(200).end()

  const SUPABASE_URL = process.env.SUPABASE_URL
  const SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY
  if (!SUPABASE_URL || !SERVICE_KEY) {
    return res.status(500).json({ error: 'SUPABASE_URL o SUPABASE_SERVICE_KEY no configuradas' })
  }

  const headers = {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${SERVICE_KEY}`,
    'apikey': SERVICE_KEY,
  }

  // GET — leer estado
  if (req.method === 'GET') {
    try {
      const r = await fetch(
        `${SUPABASE_URL}/rest/v1/promotia_app_state?key=eq.${encodeURIComponent(STATE_KEY)}&select=value&limit=1`,
        { headers }
      )
      if (!r.ok) return res.status(500).json({ error: 'Error leyendo estado' })
      const rows = await r.json()
      if (!rows || rows.length === 0) return res.status(200).json({ value: null })
      return res.status(200).json({ value: rows[0].value })
    } catch (e) {
      return res.status(500).json({ error: e.message })
    }
  }

  // POST — guardar estado (upsert)
  if (req.method === 'POST') {
    try {
      const { value } = req.body || {}
      if (value == null) return res.status(400).json({ error: 'value requerido' })
      const r = await fetch(`${SUPABASE_URL}/rest/v1/promotia_app_state`, {
        method: 'POST',
        headers: { ...headers, 'Prefer': 'resolution=merge-duplicates' },
        body: JSON.stringify({ key: STATE_KEY, value, updated_at: new Date().toISOString() }),
      })
      if (!r.ok) {
        const err = await r.text()
        return res.status(500).json({ error: 'Error guardando estado: ' + err })
      }
      return res.status(200).json({ ok: true })
    } catch (e) {
      return res.status(500).json({ error: e.message })
    }
  }

  // DELETE — borrar estado
  if (req.method === 'DELETE') {
    try {
      await fetch(
        `${SUPABASE_URL}/rest/v1/promotia_app_state?key=eq.${encodeURIComponent(STATE_KEY)}`,
        { method: 'DELETE', headers }
      )
      return res.status(200).json({ ok: true })
    } catch (e) {
      return res.status(500).json({ error: e.message })
    }
  }

  return res.status(405).end()
}

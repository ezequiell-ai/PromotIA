export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type')
  if (req.method === 'OPTIONS') return res.status(200).end()

  const SUPABASE_URL = process.env.SUPABASE_URL
  const SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY
  if (!SUPABASE_URL || !SERVICE_KEY) return res.status(500).json({ error: 'Env vars no configuradas' })

  // GET — listar usuarios
  if (req.method === 'GET') {
    try {
      const dbRes = await fetch(`${SUPABASE_URL}/rest/v1/users?select=id,email,role,client_code`, {
        headers: { Authorization: `Bearer ${SERVICE_KEY}`, apikey: SERVICE_KEY },
      })
      const dbUsers = await dbRes.json()
      if (!dbRes.ok) return res.status(500).json({ error: dbUsers.message || 'Error al leer users' })

      const authRes = await fetch(`${SUPABASE_URL}/auth/v1/admin/users?per_page=1000`, {
        headers: { Authorization: `Bearer ${SERVICE_KEY}`, apikey: SERVICE_KEY },
      })
      const authData = await authRes.json()
      const authUsers = authData.users || []

      const merged = authUsers.map(auth => {
        const u = (dbUsers || []).find(r => r.id === auth.id)
        return {
          id: auth.id,
          email: auth.email || '',
          name: auth.user_metadata?.name || auth.email?.split('@')[0] || '',
          role: u?.role === 'admin' ? 'Admin' : u?.role === 'viewer' ? 'Cliente' : 'Admin',
          clientCode: u?.client_code || '',
          createdAt: auth.created_at || '',
          lastSignIn: auth.last_sign_in_at || '',
          confirmed: !!auth.email_confirmed_at,
        }
      })

      return res.status(200).json({ users: merged })
    } catch (e) {
      return res.status(500).json({ error: e.message })
    }
  }

  // POST — crear usuario
  if (req.method === 'POST') {
    const { name, email, password, role, clientCode } = req.body || {}

    if (!email || !password) return res.status(400).json({ error: 'Email y contraseña son requeridos' })
    if (password.length < 6) return res.status(400).json({ error: 'La contraseña debe tener al menos 6 caracteres' })

    try {
      const authRes = await fetch(`${SUPABASE_URL}/auth/v1/admin/users`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${SERVICE_KEY}`,
          apikey: SERVICE_KEY,
        },
        body: JSON.stringify({
          email,
          password,
          email_confirm: true,
          user_metadata: { name: name || '' },
        }),
      })

      const authData = await authRes.json()
      if (!authRes.ok) return res.status(400).json({ error: authData.message || authData.msg || 'Error al crear usuario en Auth' })

      const userId = authData.id
      const supabaseRole = role === 'Admin' ? 'admin' : 'viewer'

      const dbRes = await fetch(`${SUPABASE_URL}/rest/v1/users`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${SERVICE_KEY}`,
          apikey: SERVICE_KEY,
          Prefer: 'resolution=merge-duplicates',
        },
        body: JSON.stringify({ id: userId, email, role: supabaseRole, client_code: clientCode || null }),
      })

      if (!dbRes.ok) {
        const dbErr = await dbRes.text()
        return res.status(500).json({ error: 'Usuario creado en Auth pero error en tabla users: ' + dbErr })
      }

      return res.status(200).json({ ok: true, userId })
    } catch (e) {
      return res.status(500).json({ error: 'Error interno: ' + e.message })
    }
  }

  return res.status(405).end()
}

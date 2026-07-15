import { useState, useEffect } from 'react'
import { Routes, Route, useParams } from 'react-router-dom'
import { supabase } from './lib/supabase'
import PromotIA from './PromotIA'
import SurveyPage from './pages/Survey'
import ClientPortal from './pages/ClientPortal'

const C = { primary: '#73017B', surface: '#F7F2FA' }
const DISP = "'Quicksand','Trebuchet MS',sans-serif"

function LoadingScreen() {
  return (
    <div style={{ minHeight: '100vh', display: 'grid', placeItems: 'center', background: C.surface, fontFamily: DISP }}>
      <div style={{ textAlign: 'center' }}>
        <svg width="52" height="52" viewBox="0 0 48 48" fill="none" style={{ marginBottom: 16 }}>
          <defs><linearGradient id="pg" x1="0" y1="48" x2="48" y2="0"><stop offset="0" stopColor="#52015A"/><stop offset="0.5" stopColor="#A8108F"/><stop offset="1" stopColor="#E40993"/></linearGradient></defs>
          <rect x="1.5" y="1.5" width="45" height="45" rx="13" fill="url(#pg)"/>
          <path d="M14 16h20a3 3 0 0 1 3 3v9a3 3 0 0 1-3 3H22l-6 5v-5h-2a3 3 0 0 1-3-3v-9a3 3 0 0 1 3-3Z" fill="#fff" opacity=".94"/>
          <path d="M24 28.5l-4.2-4c-1.2-1.15-1.1-3 .2-3.9 1.05-.72 2.45-.45 3.25.5l.75.9.75-.9c.8-.95 2.2-1.22 3.25-.5 1.3.9 1.4 2.75.2 3.9L24 28.5Z" fill="#E40993"/>
        </svg>
        <div style={{ display: 'flex', alignItems: 'center', gap: 9, color: '#5E4E64', fontWeight: 600 }}>
          <span style={{ display: 'inline-block', width: 16, height: 16, border: '2px solid #73017B55', borderTopColor: '#73017B', borderRadius: '50%', animation: 'spin .7s linear infinite' }}/>
          Cargando PromotIA…
        </div>
      </div>
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
    </div>
  )
}

function NoAcceso({ email, onLogout }) {
  return (
    <div style={{ minHeight: '100vh', display: 'grid', placeItems: 'center', background: C.surface, fontFamily: DISP }}>
      <div style={{ textAlign: 'center', maxWidth: 380, padding: 24 }}>
        <div style={{ fontSize: 44, marginBottom: 16 }}>🔒</div>
        <h2 style={{ fontSize: 18, fontWeight: 700, color: '#1A0A1C', margin: '0 0 10px' }}>Sin acceso a PromotIA</h2>
        <p style={{ fontSize: 13.5, color: '#5E4E64', lineHeight: 1.6, margin: '0 0 20px' }}>
          Tu cuenta ({email}) está autenticada pero no tiene un perfil en PromotIA. Contactá a tu administrador en{' '}
          <a href="https://hub.talenio.tech" style={{ color: C.primary, fontWeight: 600 }}>hub.talenio.tech</a>.
        </p>
        <div style={{ display: 'flex', gap: 10, justifyContent: 'center', flexWrap: 'wrap' }}>
          <a href="https://hub.talenio.tech" style={{ padding: '9px 20px', background: C.primary, color: '#fff', borderRadius: 8, fontWeight: 600, fontSize: 13.5, textDecoration: 'none' }}>Ir al Hub</a>
          <button onClick={onLogout} style={{ padding: '9px 20px', background: 'none', border: `1px solid #D1C4D4`, color: '#5E4E64', borderRadius: 8, fontWeight: 600, fontSize: 13.5, cursor: 'pointer' }}>Cerrar sesión</button>
        </div>
      </div>
    </div>
  )
}

function SurveyRoute() {
  const { clientId } = useParams()
  return <SurveyPage clientId={clientId} />
}

function PortalRoute({ onLogout }) {
  const { clientId } = useParams()
  return <ClientPortal clientId={clientId} onLogout={onLogout} />
}

export default function App() {
  const [user, setUser] = useState(null)
  const [loading, setLoading] = useState(true)
  const [noAccess, setNoAccess] = useState(false)

  useEffect(() => {
    // INITIAL_SESSION: Supabase lo dispara una vez al arrancar, ya con el hash fragment procesado
    const { data: { subscription: authListener } } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (event === 'INITIAL_SESSION') {
        if (session?.user) {
          setUser(session.user)
          await checkAccess(session.user)
        } else {
          window.location.href = `https://hub.talenio.tech?redirect=${encodeURIComponent(window.location.origin)}`
        }
      } else if (event === 'SIGNED_OUT') {
        window.location.href = 'https://hub.talenio.tech'
      }
    })
    return () => authListener.unsubscribe()
  }, [])

  async function checkAccess(authUser) {
    // Admin @delenio.net: acceso completo sin necesidad de fila en users
    if (authUser.email?.endsWith('@delenio.net')) {
      setLoading(false)
      return
    }
    const { data: userRow } = await supabase
      .from('users')
      .select('role, company_id, client_code')
      .eq('id', authUser.id)
      .maybeSingle()

    if (!userRow) {
      setNoAccess(true)
    }
    setLoading(false)
  }

  async function handleLogout() {
    await supabase.auth.signOut()
    window.location.href = 'https://hub.talenio.tech'
  }

  if (loading) return <LoadingScreen />

  if (noAccess) return <NoAcceso email={user?.email} onLogout={handleLogout} />

  return (
    <Routes>
      {/* Rutas públicas — no requieren sesión */}
      <Route path="/encuesta/:clientId" element={<SurveyRoute />} />
      <Route path="/portal/:clientId" element={<PortalRoute onLogout={handleLogout} />} />

      {/* App autenticada — PromotIA maneja /admin/* y /cliente/:id/* */}
      <Route path="/*" element={<PromotIA onLogout={handleLogout} />} />
    </Routes>
  )
}

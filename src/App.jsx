import { useState, useEffect } from 'react'
import { Routes, Route, Navigate, useNavigate, useParams } from 'react-router-dom'
import { supabase } from './lib/supabase'
import PromotIA from './PromotIA'
import LoginPage from './pages/Login'
import RegisterPage from './pages/Register'
import CheckoutPage from './pages/Checkout'
import BlockedPage from './pages/Blocked'
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

// Wrappers para rutas públicas que necesitan useParams
function SurveyRoute() {
  const { clientId } = useParams()
  return <SurveyPage clientId={clientId} />
}

function PortalRoute({ onLogout }) {
  const { clientId } = useParams()
  return <ClientPortal clientId={clientId} onLogout={onLogout} />
}

export default function App() {
  const navigate = useNavigate()
  const [user, setUser] = useState(null)
  const [subscriptionStatus, setSubscriptionStatus] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    // SSO desde Talenio Hub
    const urlParams = new URLSearchParams(window.location.search)
    const accessToken = urlParams.get('access_token')
    const refreshToken = urlParams.get('refresh_token')
    const initSession = accessToken && refreshToken
      ? supabase.auth.setSession({ access_token: accessToken, refresh_token: refreshToken })
          .then(() => { window.history.replaceState({}, '', window.location.pathname); return supabase.auth.getSession() })
      : supabase.auth.getSession()

    initSession.then(({ data: { session } }) => {
      if (session?.user) { setUser(session.user); checkSubscription(session.user.id) }
      else setLoading(false)
    })
    const { data: { subscription: authListener } } = supabase.auth.onAuthStateChange((_event, session) => {
      if (session?.user) { setUser(session.user); checkSubscription(session.user.id) }
      else { setUser(null); setSubscriptionStatus(null); setLoading(false); navigate('/login') }
    })
    return () => authListener.unsubscribe()
  }, [])

  async function checkSubscription(userId) {
    try {
      const { data: userRow } = await supabase
        .from('users')
        .select('company_id, role, client_code, email')
        .eq('id', userId)
        .maybeSingle()

      if (!userRow || userRow?.role === 'admin') {
        navigate('/admin'); setLoading(false); return
      }
      if (userRow?.role === 'viewer' && userRow?.client_code) {
        navigate('/portal/' + userRow.client_code); setLoading(false); return
      }
      if (userRow?.role === 'viewer') {
        navigate('/admin'); setLoading(false); return
      }
      if (!userRow?.company_id) {
        navigate('/checkout'); setLoading(false); return
      }

      const { data: sub } = await supabase
        .from('subscriptions').select('status').eq('company_id', userRow.company_id).eq('product', 'promotia').maybeSingle()
      const status = sub?.status || 'none'
      setSubscriptionStatus(status)
      navigate(!sub || status === 'canceled' || status === 'unpaid' ? '/blocked' : '/admin')
    } catch (e) {
      console.error('checkSubscription error:', e)
      navigate('/admin')
    }
    setLoading(false)
  }

  async function handleLogout() { await supabase.auth.signOut() }

  if (loading) return <LoadingScreen />

  return (
    <Routes>
      {/* Rutas públicas */}
      <Route path="/encuesta/:clientId" element={<SurveyRoute />} />
      <Route path="/portal/:clientId" element={<PortalRoute onLogout={handleLogout} />} />

      {/* Rutas de auth */}
      <Route path="/login" element={<LoginPage onSuccess={() => setLoading(true)} onRegister={() => navigate('/register')} />} />
      <Route path="/register" element={<RegisterPage onBack={() => navigate('/login')} onSuccess={() => setLoading(true)} />} />
      <Route path="/checkout" element={<CheckoutPage user={user} onLogout={handleLogout} />} />
      <Route path="/blocked" element={<BlockedPage status={subscriptionStatus} onLogout={handleLogout} onRecheck={() => { setLoading(true); checkSubscription(user.id) }} />} />

      {/* App autenticada — PromotIA maneja /admin/* y /cliente/:id/* */}
      <Route path="/*" element={<PromotIA onLogout={handleLogout} />} />

      <Route path="/" element={<Navigate to="/login" replace />} />
    </Routes>
  )
}

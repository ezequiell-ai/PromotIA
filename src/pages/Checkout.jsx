import { useState } from 'react'

const HUB_CHECKOUT = 'https://hub.talenio.tech/api/checkout'

const C = {
  tx: '#1A0A1C', tx2: '#5E4E64', tx3: '#A99BB0', primary: '#73017B', magenta: '#E40993',
  lila3: '#EFD9F1', lila4: '#F7ECF8', line: '#E7DEEC', surface: '#F7F2FA',
  grad: 'linear-gradient(120deg,#73017B 0%,#A8108F 55%,#E40993 100%)',
  gradHero: 'linear-gradient(125deg,#0c01a4 0%,#52015A 38%,#73017B 64%,#E40993 100%)',
  exc: '#1E9E6A', excBg: '#E0F3EA',
}
const DISP = "'Quicksand','Trebuchet MS',sans-serif"
const BODY = "'Archivo','Segoe UI',system-ui,-apple-system,sans-serif"

const PLANS = [
  {
    id: 'start',
    name: 'Start',
    price: 49,
    desc: 'Para consultores independientes',
    features: ['Hasta 3 clientes', '1.000 respuestas/mes', 'Dashboard NPS', 'Plan de acción con IA', 'Voz del cliente con IA'],
    featured: false,
  },
  {
    id: 'growth',
    name: 'Growth',
    price: 149,
    desc: 'Para consultoras en crecimiento',
    features: ['Hasta 10 clientes', '5.000 respuestas/mes', 'Todo lo de Start', 'Cross-sell con IA', 'Soporte prioritario'],
    featured: true,
  },
  {
    id: 'scale',
    name: 'Scale',
    price: 399,
    desc: 'Para equipos y agencias',
    features: ['Clientes ilimitados', 'Respuestas ilimitadas', 'Todo lo de Growth', 'Acceso API', 'Onboarding dedicado'],
    featured: false,
  },
]

export default function CheckoutPage({ user, onLogout }) {
  const [loading, setLoading] = useState(null)
  const [checkoutErr, setCheckoutErr] = useState('')

  async function choosePlan(planId) {
    setLoading(planId); setCheckoutErr('')
    try {
      const res = await fetch(HUB_CHECKOUT, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          product: 'promotia',
          plan: planId.charAt(0).toUpperCase() + planId.slice(1),
          email: user?.email,
          successUrl: `${window.location.origin}?checkout=success`,
          cancelUrl:  `${window.location.origin}?checkout=cancel`,
        }),
      })
      const data = await res.json()
      if (data.url) window.location.href = data.url
      else setCheckoutErr(data.error || 'Error al iniciar el pago')
    } catch (e) {
      setCheckoutErr(e.message)
    }
    setLoading(null)
  }

  return (
    <div style={{ minHeight: '100vh', background: C.surface, fontFamily: BODY, padding: '40px 20px' }}>
      <style>{`@import url('https://fonts.googleapis.com/css2?family=Quicksand:wght@400;600;700&family=Archivo:wght@400;500;600;700&display=swap');*{box-sizing:border-box}`}</style>

      <div style={{ maxWidth: 900, margin: '0 auto' }}>
        <div style={{ textAlign: 'center', marginBottom: 40 }}>
          <div style={{ fontFamily: DISP, fontWeight: 700, fontSize: 13, color: C.primary, marginBottom: 8, letterSpacing: 1 }}>ELEGÍ TU PLAN</div>
          <h1 style={{ fontFamily: DISP, fontSize: 32, fontWeight: 700, margin: '0 0 10px', color: C.tx }}>Empezá a medir el NPS de tus clientes B2B</h1>
          <p style={{ fontSize: 15, color: C.tx2 }}>14 días de prueba gratis. Cancelá cuando quieras.</p>
          {user && <p style={{ fontSize: 13, color: C.tx3 }}>Conectado como {user.email} · <button onClick={onLogout} style={{ background: 'none', border: 'none', color: C.primary, cursor: 'pointer', fontFamily: BODY, fontSize: 13 }}>Salir</button></p>}
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 20 }}>
          {PLANS.map(p => (
            <div key={p.id} style={{ background: p.featured ? C.gradHero : '#fff', borderRadius: 20, padding: '28px 24px', border: p.featured ? 'none' : `1px solid ${C.line}`, boxShadow: p.featured ? '0 20px 50px -16px rgba(115,1,123,.55)' : '0 2px 8px rgba(0,0,0,.04)', position: 'relative' }}>
              {p.featured && (
                <div style={{ position: 'absolute', top: -12, left: '50%', transform: 'translateX(-50%)', background: C.magenta, color: '#fff', fontFamily: DISP, fontWeight: 700, fontSize: 11, padding: '4px 14px', borderRadius: 20 }}>MÁS POPULAR</div>
              )}
              <div style={{ fontFamily: DISP, fontWeight: 700, fontSize: 13, color: p.featured ? 'rgba(255,255,255,.8)' : C.tx3, marginBottom: 4, letterSpacing: .5 }}>{p.name.toUpperCase()}</div>
              <div style={{ fontFamily: DISP, fontWeight: 700, fontSize: 36, color: p.featured ? '#fff' : C.tx, lineHeight: 1 }}>
                USD {p.price}<span style={{ fontSize: 15, fontWeight: 500, opacity: .7 }}>/mes</span>
              </div>
              <div style={{ fontSize: 13, color: p.featured ? 'rgba(255,255,255,.75)' : C.tx3, marginTop: 6, marginBottom: 20 }}>{p.desc}</div>
              <ul style={{ listStyle: 'none', padding: 0, margin: '0 0 24px' }}>
                {p.features.map(f => (
                  <li key={f} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13.5, color: p.featured ? '#fff' : C.tx2, marginBottom: 8 }}>
                    <span style={{ width: 18, height: 18, borderRadius: '50%', background: p.featured ? 'rgba(255,255,255,.25)' : C.excBg, color: p.featured ? '#fff' : C.exc, display: 'grid', placeItems: 'center', flexShrink: 0, fontSize: 11, fontWeight: 700 }}>✓</span>
                    {f}
                  </li>
                ))}
              </ul>
              <button
                onClick={() => choosePlan(p.id)}
                disabled={!!loading}
                style={{ width: '100%', padding: '13px', borderRadius: 11, border: p.featured ? 'none' : `1px solid ${C.line}`, background: p.featured ? '#fff' : C.grad, color: p.featured ? C.primary : '#fff', fontFamily: DISP, fontWeight: 700, fontSize: 14, cursor: loading ? 'not-allowed' : 'pointer', opacity: loading && loading !== p.id ? 0.6 : 1 }}
              >
                {loading === p.id ? 'Redirigiendo…' : `Empezar con ${p.name} →`}
              </button>
            </div>
          ))}
        </div>

        {checkoutErr && (
          <div style={{ background: '#FEF2F2', border: '1px solid #FECACA', borderRadius: 10, padding: '12px 16px', fontSize: 13, color: '#DC2626', marginTop: 20, textAlign: 'center' }}>
            {checkoutErr}
          </div>
        )}
        <p style={{ textAlign: 'center', fontSize: 12.5, color: C.tx3, marginTop: 20 }}>
          Pagás de forma segura con Stripe. No guardamos datos de tarjeta.
        </p>
      </div>
    </div>
  )
}

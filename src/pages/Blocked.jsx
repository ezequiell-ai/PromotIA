const C = {
  tx: '#1A0A1C', tx2: '#5E4E64', tx3: '#A99BB0', primary: '#73017B',
  grad: 'linear-gradient(120deg,#73017B 0%,#A8108F 55%,#E40993 100%)',
  surface: '#F7F2FA', line: '#E7DEEC', criticoBg: '#FCE7E5', critico: '#E5564B',
  mejorarBg: '#FCF1DF', mejorar: '#E8A23D',
}
const DISP = "'Quicksand','Trebuchet MS',sans-serif"
const BODY = "'Archivo','Segoe UI',system-ui,-apple-system,sans-serif"

const MESSAGES = {
  canceled: { icon: '🚫', title: 'Suscripción cancelada', sub: 'Tu suscripción fue cancelada. Volvé a suscribirte para retomar el acceso.' },
  unpaid: { icon: '💳', title: 'Pago pendiente', sub: 'Hay un problema con tu método de pago. Actualizá tu tarjeta para restablecer el acceso.' },
  past_due: { icon: '⚠️', title: 'Pago vencido', sub: 'El último pago falló. Actualizá tu tarjeta para mantener el acceso.' },
  none:       { icon: '🔒', title: 'Sin suscripción activa',  sub: 'No encontramos una suscripción activa para tu cuenta.' },
  no_product: { icon: '🔒', title: 'Sin acceso a PromotIA',  sub: 'Tu usuario no tiene acceso habilitado a PromotIA. Contactá a tu administrador en hub.talenio.tech.' },
}

export default function BlockedPage({ status, onLogout, onRecheck }) {
  const msg = MESSAGES[status] || MESSAGES.none

  return (
    <div style={{ minHeight: '100vh', background: C.surface, display: 'grid', placeItems: 'center', fontFamily: BODY, padding: 20 }}>
      <style>{`@import url('https://fonts.googleapis.com/css2?family=Quicksand:wght@400;600;700&family=Archivo:wght@400;500;600;700&display=swap');*{box-sizing:border-box}`}</style>

      <div style={{ background: '#fff', borderRadius: 20, padding: '44px 36px', maxWidth: 440, width: '100%', textAlign: 'center', boxShadow: '0 20px 60px -20px rgba(115,1,123,.15)' }}>
        <div style={{ fontSize: 48, marginBottom: 16 }}>{msg.icon}</div>
        <h2 style={{ fontFamily: DISP, fontSize: 24, fontWeight: 700, margin: '0 0 10px', color: C.tx }}>{msg.title}</h2>
        <p style={{ fontSize: 14, color: C.tx2, lineHeight: 1.6, margin: '0 0 28px' }}>{msg.sub}</p>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          <a
            href="https://billing.stripe.com/p/login/REEMPLAZAR_CON_TU_PORTAL_DE_STRIPE"
            target="_blank"
            rel="noopener noreferrer"
            style={{ display: 'block', padding: '13px', borderRadius: 11, background: C.grad, color: '#fff', fontFamily: DISP, fontWeight: 700, fontSize: 14, textDecoration: 'none' }}
          >
            💳 Gestionar suscripción en Stripe
          </a>
          <button
            onClick={onRecheck}
            style={{ padding: '12px', borderRadius: 11, border: `1px solid ${C.line}`, background: '#fff', color: C.tx2, fontFamily: DISP, fontWeight: 700, fontSize: 14, cursor: 'pointer' }}
          >
            🔄 Ya pagué — verificar acceso
          </button>
          <button
            onClick={onLogout}
            style={{ padding: '10px', borderRadius: 11, border: 'none', background: 'none', color: C.tx3, fontFamily: BODY, fontSize: 13, cursor: 'pointer' }}
          >
            Cerrar sesión
          </button>
        </div>

        <p style={{ fontSize: 11.5, color: C.tx3, marginTop: 22 }}>
          ¿Necesitás ayuda? Escribinos a <a href="mailto:soporte@delenio.net" style={{ color: C.primary }}>soporte@delenio.net</a>
        </p>
      </div>
    </div>
  )
}

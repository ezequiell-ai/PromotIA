import { useState, useEffect } from 'react'

const DEFAULT_COLOR = '#73017B'
const DEFAULT_QUESTION = '¿Qué tan probable es que nos recomiendes?'

const C = {
  tx: '#1A0A1C', tx2: '#5E4E64', tx3: '#A99BB0',
  line: '#E7DEEC', surface: '#F7F2FA', lila4: '#F7ECF8',
  exc: '#1E9E6A', excBg: '#E0F3EA',
}
const DISP = "'Quicksand','Trebuchet MS',sans-serif"
const BODY = "'Archivo','Segoe UI',system-ui,-apple-system,sans-serif"

function scoreColor(n) {
  if (n <= 6) return '#E53935'
  if (n <= 8) return '#FB8C00'
  return '#43A047'
}
function scoreLabel(n) {
  if (n === null) return ''
  if (n <= 6) return 'Detractor'
  if (n <= 8) return 'Pasivo'
  return 'Promotor'
}

function SurveySkeleton({ color = DEFAULT_COLOR }) {
  return (
    <div style={{ minHeight: '100vh', background: '#F7F2FA', fontFamily: BODY, display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '48px 20px' }}>
      <style>{`@keyframes svShimmer{0%{background-position:200% 0}100%{background-position:-200% 0}}.sv-sk{background:linear-gradient(90deg,#ece6ee 0%,#f7f3f8 50%,#ece6ee 100%);background-size:200% 100%;animation:svShimmer 1.4s ease-in-out infinite;border-radius:12px}`}</style>
      <div className="sv-sk" style={{ width: 72, height: 72, borderRadius: '50%', marginBottom: 20 }}/>
      <div className="sv-sk" style={{ width: 220, height: 16, marginBottom: 8 }}/>
      <div className="sv-sk" style={{ width: 160, height: 12, marginBottom: 32 }}/>
      <div style={{ display: 'flex', gap: 8, marginBottom: 24, flexWrap: 'wrap', justifyContent: 'center' }}>
        {Array.from({ length: 11 }, (_, i) => (
          <div key={i} className="sv-sk" style={{ width: 44, height: 44, borderRadius: 12 }}/>
        ))}
      </div>
      <div className="sv-sk" style={{ width: '100%', maxWidth: 480, height: 80, marginBottom: 20 }}/>
      <div className="sv-sk" style={{ width: 140, height: 42, borderRadius: 12 }}/>
    </div>
  )
}

export default function SurveyPage({ clientId }) {
  const [config, setConfig] = useState({ question: DEFAULT_QUESTION, primaryColor: DEFAULT_COLOR, title: '', logoUrl: '' })
  const [configLoaded, setConfigLoaded] = useState(false)
  const [score, setScore] = useState(null)
  const [comment, setComment] = useState('')
  const [name, setName] = useState('')
  const [company, setCompany] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [done, setDone] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    fetch(`/api/survey-config?clientId=${clientId}`)
      .then(r => r.json())
      .then(d => {
        if (d && !d.error) setConfig({
          question: d.question || DEFAULT_QUESTION,
          primaryColor: d.primary_color || DEFAULT_COLOR,
          title: d.title || '',
          logoUrl: d.logo_url || '',
        })
      })
      .catch(() => {})
      .finally(() => setConfigLoaded(true))
  }, [clientId])

  if (!configLoaded) return <SurveySkeleton/>

  const primary = config.primaryColor

  async function handleSubmit(e) {
    e.preventDefault()
    if (score === null) { setError('Seleccioná una puntuación'); return }
    setSubmitting(true); setError('')
    try {
      const res = await fetch('/api/survey', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ clientId, score, comment, name, company }),
      })
      if (!res.ok) throw new Error()
      setDone(true)
    } catch { setError('Hubo un error al enviar. Intentá de nuevo.') }
    setSubmitting(false)
  }

  const gradStyle = { background: `linear-gradient(120deg,${primary} 0%,${primary}CC 100%)` }

  if (done) return (
    <div style={{ minHeight: '100vh', background: C.surface, display: 'grid', placeItems: 'center', fontFamily: BODY, padding: 24 }}>
      <style>{`@import url('https://fonts.googleapis.com/css2?family=Quicksand:wght@400;600;700&family=Archivo:wght@400;500;600;700&display=swap');*{box-sizing:border-box}`}</style>
      <div style={{ textAlign: 'center', maxWidth: 440 }}>
        <div style={{ width: 72, height: 72, borderRadius: '50%', background: C.excBg, display: 'grid', placeItems: 'center', margin: '0 auto 20px', fontSize: 32, color: C.exc }}>✓</div>
        <h2 style={{ fontFamily: DISP, fontSize: 26, fontWeight: 700, color: C.tx, margin: '0 0 10px' }}>¡Gracias por tu respuesta!</h2>
        <p style={{ color: C.tx2, fontSize: 15, lineHeight: 1.6 }}>Tu opinión es muy valiosa y nos ayuda a mejorar constantemente.</p>
      </div>
    </div>
  )

  return (
    <div style={{ minHeight: '100vh', background: C.surface, fontFamily: BODY, padding: '40px 20px' }}>
      <style>{`@import url('https://fonts.googleapis.com/css2?family=Quicksand:wght@400;600;700&family=Archivo:wght@400;500;600;700&display=swap');*{box-sizing:border-box}textarea,input{outline:none}textarea:focus,input:focus{border-color:${primary}!important}`}</style>
      <div style={{ maxWidth: 520, margin: '0 auto' }}>
        {/* Header */}
        <div style={{ textAlign: 'center', marginBottom: 32 }}>
          {config.logoUrl
            ? <img src={config.logoUrl} alt="logo" style={{ height: 48, marginBottom: 12, objectFit: 'contain' }}/>
            : (
              <svg width="40" height="40" viewBox="0 0 48 48" fill="none" style={{ marginBottom: 12 }}>
                <defs><linearGradient id="sg" x1="0" y1="48" x2="48" y2="0"><stop offset="0" stopColor={primary}/><stop offset="1" stopColor={primary}/></linearGradient></defs>
                <rect x="1.5" y="1.5" width="45" height="45" rx="13" fill="url(#sg)"/>
                <path d="M14 16h20a3 3 0 0 1 3 3v9a3 3 0 0 1-3 3H22l-6 5v-5h-2a3 3 0 0 1-3-3v-9a3 3 0 0 1 3-3Z" fill="#fff" opacity=".94"/>
                <path d="M24 28.5l-4.2-4c-1.2-1.15-1.1-3 .2-3.9 1.05-.72 2.45-.45 3.25.5l.75.9.75-.9c.8-.95 2.2-1.22 3.25-.5 1.3.9 1.4 2.75.2 3.9L24 28.5Z" fill="#fff"/>
              </svg>
            )
          }
          {config.title && <div style={{ fontFamily: DISP, fontWeight: 700, fontSize: 15, color: primary, marginBottom: 4 }}>{config.title}</div>}
          <div style={{ fontFamily: DISP, fontWeight: 600, fontSize: 12, color: C.tx3, letterSpacing: 1 }}>ENCUESTA NPS</div>
        </div>

        {/* Card */}
        <div style={{ background: '#fff', borderRadius: 20, padding: '32px 28px', border: `1px solid ${C.line}`, boxShadow: '0 4px 24px rgba(0,0,0,.07)' }}>
          <h2 style={{ fontFamily: DISP, fontSize: 22, fontWeight: 700, color: C.tx, margin: '0 0 8px', lineHeight: 1.3 }}>
            {config.question}
          </h2>
          <p style={{ color: C.tx2, fontSize: 14, margin: '0 0 28px', lineHeight: 1.5 }}>
            0 = nada probable · 10 = totalmente seguro
          </p>

          {/* Score buttons */}
          <div style={{ display: 'flex', gap: 5, marginBottom: 8, flexWrap: 'nowrap' }}>
            {[0,1,2,3,4,5,6,7,8,9,10].map(n => (
              <button key={n} onClick={() => setScore(n)} style={{
                flex: 1, minWidth: 0, height: 40, borderRadius: 10,
                border: score === n ? `2px solid ${scoreColor(n)}` : `1.5px solid ${C.line}`,
                background: score === n ? scoreColor(n) : '#fff',
                color: score === n ? '#fff' : C.tx2,
                fontFamily: DISP, fontWeight: 700, fontSize: 14, cursor: 'pointer', transition: 'all .15s',
              }}>{n}</button>
            ))}
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11.5, color: C.tx3, marginBottom: 8 }}>
            <span>Nada probable</span><span>Totalmente seguro</span>
          </div>
          {score !== null && (
            <div style={{ textAlign: 'center', marginBottom: 20 }}>
              <span style={{ background: scoreColor(score) + '18', color: scoreColor(score), fontFamily: DISP, fontWeight: 700, fontSize: 13, padding: '4px 14px', borderRadius: 20 }}>
                {score} · {scoreLabel(score)}
              </span>
            </div>
          )}

          <form onSubmit={handleSubmit}>
            <div style={{ marginBottom: 16 }}>
              <label style={{ display: 'block', fontSize: 13, fontWeight: 600, color: C.tx2, marginBottom: 6 }}>
                ¿Por qué elegiste esa puntuación? <span style={{ color: C.tx3, fontWeight: 400 }}>(opcional)</span>
              </label>
              <textarea value={comment} onChange={e => setComment(e.target.value)} rows={3} placeholder="Contanos tu experiencia..."
                style={{ width: '100%', padding: '10px 12px', borderRadius: 10, border: `1.5px solid ${C.line}`, fontFamily: BODY, fontSize: 14, color: C.tx, resize: 'vertical', transition: 'border-color .15s' }}/>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 24 }}>
              <div>
                <label style={{ display: 'block', fontSize: 13, fontWeight: 600, color: C.tx2, marginBottom: 6 }}>Tu nombre <span style={{ color: C.tx3, fontWeight: 400 }}>(opcional)</span></label>
                <input value={name} onChange={e => setName(e.target.value)} placeholder="Ej: María García"
                  style={{ width: '100%', padding: '9px 12px', borderRadius: 10, border: `1.5px solid ${C.line}`, fontFamily: BODY, fontSize: 14, color: C.tx, transition: 'border-color .15s' }}/>
              </div>
              <div>
                <label style={{ display: 'block', fontSize: 13, fontWeight: 600, color: C.tx2, marginBottom: 6 }}>Empresa <span style={{ color: C.tx3, fontWeight: 400 }}>(opcional)</span></label>
                <input value={company} onChange={e => setCompany(e.target.value)} placeholder="Ej: Acme S.A."
                  style={{ width: '100%', padding: '9px 12px', borderRadius: 10, border: `1.5px solid ${C.line}`, fontFamily: BODY, fontSize: 14, color: C.tx, transition: 'border-color .15s' }}/>
              </div>
            </div>
            {error && <p style={{ color: '#E53935', fontSize: 13, marginBottom: 12 }}>{error}</p>}
            <button type="submit" disabled={submitting || score === null}
              style={{ width: '100%', padding: '13px', borderRadius: 11, border: 'none', background: score === null ? C.line : `linear-gradient(120deg,${primary},${primary}CC)`, color: score === null ? C.tx3 : '#fff', fontFamily: DISP, fontWeight: 700, fontSize: 15, cursor: score === null ? 'not-allowed' : 'pointer', transition: 'all .2s' }}>
              {submitting ? 'Enviando…' : 'Enviar respuesta →'}
            </button>
          </form>
        </div>
        <p style={{ textAlign: 'center', fontSize: 12, color: C.tx3, marginTop: 20 }}>
          Powered by <strong style={{ color: primary }}>PromotIA</strong> · Tu respuesta es anónima
        </p>
      </div>
    </div>
  )
}

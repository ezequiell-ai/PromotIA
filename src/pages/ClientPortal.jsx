import { useState, useEffect, useMemo } from 'react'
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts'
import { C, DISP, BODY, MES } from '../lib/tokens'
import { supabase } from '../lib/supabase'

const PAGE_SIZE = 10

function npsCalc(responses) {
  if (!responses?.length) return null
  const p = responses.filter(r => r.e >= 9).length
  const d = responses.filter(r => r.e <= 6).length
  return Math.round(((p - d) / responses.length) * 100)
}

function npsBandColor(s) {
  if (s >= 50) return C.exc
  if (s >= 30) return C.primary
  if (s >= 0) return C.mejorar
  return C.critico
}

function Kpi({ title, value, sub, color }) {
  return (
    <div style={{ background: '#fff', borderRadius: 16, padding: '18px 20px', border: `1px solid ${C.line}` }}>
      <div style={{ fontSize: 12, color: C.tx3, fontWeight: 600, marginBottom: 6, fontFamily: DISP }}>{title}</div>
      <div style={{ fontSize: 30, fontWeight: 700, fontFamily: DISP, color: color || C.tx, lineHeight: 1 }}>{value ?? '—'}</div>
      {sub && <div style={{ fontSize: 12, color: C.tx3, marginTop: 4 }}>{sub}</div>}
    </div>
  )
}

function SkeletonBlock({ w = '100%', h = 18, radius = 8, style = {} }) {
  return (
    <div style={{
      width: w, height: h, borderRadius: radius,
      background: 'linear-gradient(90deg,#ece6ee 0%,#f7f3f8 50%,#ece6ee 100%)',
      backgroundSize: '200% 100%',
      animation: 'cpShimmer 1.4s ease-in-out infinite',
      ...style
    }}/>
  )
}

function PortalSkeleton({ brand }) {
  return (
    <div style={{ minHeight: '100vh', background: C.surface, fontFamily: BODY }}>
      <style>{`@keyframes cpShimmer{0%{background-position:200% 0}100%{background-position:-200% 0}}`}</style>
      <div style={{ background: brand.color, padding: '18px 28px', display: 'flex', alignItems: 'center', gap: 14, minHeight: 72 }}/>
      <div style={{ maxWidth: 860, margin: '0 auto', padding: '28px 20px' }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(160px,1fr))', gap: 14, marginBottom: 24 }}>
          {[0,1,2,3].map(i => (
            <div key={i} style={{ background: '#fff', borderRadius: 16, padding: '18px 20px', border: `1px solid ${C.line}` }}>
              <SkeletonBlock h={12} w="60%" style={{ marginBottom: 10 }}/>
              <SkeletonBlock h={32} w="50%" style={{ marginBottom: 8 }}/>
              <SkeletonBlock h={10} w="70%"/>
            </div>
          ))}
        </div>
        <div style={{ background: '#fff', borderRadius: 16, padding: 20, border: `1px solid ${C.line}`, marginBottom: 20 }}>
          <SkeletonBlock h={14} w="40%" style={{ marginBottom: 18 }}/>
          <SkeletonBlock h={180} radius={10}/>
        </div>
        <div style={{ background: '#fff', borderRadius: 16, padding: 20, border: `1px solid ${C.line}` }}>
          <SkeletonBlock h={14} w="35%" style={{ marginBottom: 18 }}/>
          {[0,1,2].map(i => <SkeletonBlock key={i} h={52} radius={12} style={{ marginBottom: 10 }}/>)}
        </div>
      </div>
    </div>
  )
}

function ChangePasswordModal({ open, onClose }) {
  const [next, setNext] = useState('')
  const [confirm, setConfirm] = useState('')
  const [saving, setSaving] = useState(false)
  const [msg, setMsg] = useState(null)
  const inputStyle = { width: '100%', border: `1px solid ${C.line}`, borderRadius: 10, padding: '10px 13px', fontSize: 13.5, fontFamily: BODY, marginTop: 6 }
  async function save() {
    if (next.length < 6) { setMsg({ bad: true, text: 'Mínimo 6 caracteres.' }); return }
    if (next !== confirm) { setMsg({ bad: true, text: 'Las contraseñas no coinciden.' }); return }
    setSaving(true); setMsg(null)
    const { error } = await supabase.auth.updateUser({ password: next })
    if (error) { setMsg({ bad: true, text: error.message }) }
    else { setMsg({ bad: false, text: '¡Contraseña actualizada!' }); setTimeout(() => { onClose(); setNext(''); setConfirm(''); setMsg(null) }, 1400) }
    setSaving(false)
  }
  if (!open) return null
  return (
    <div onClick={onClose} style={{ position: 'fixed', inset: 0, zIndex: 60, background: 'rgba(26,10,28,.42)', display: 'grid', placeItems: 'center', padding: 20 }}>
      <div onClick={e => e.stopPropagation()} style={{ background: '#fff', borderRadius: 18, width: '100%', maxWidth: 400, padding: 28, boxShadow: '0 30px 70px -20px rgba(115,1,123,.4)' }}>
        <div style={{ fontFamily: DISP, fontWeight: 700, fontSize: 17, marginBottom: 18 }}>Cambiar contraseña</div>
        <label style={{ display: 'block', marginBottom: 14 }}>
          <div style={{ fontSize: 12, fontWeight: 700, color: '#5E4E64' }}>Nueva contraseña</div>
          <input type="password" value={next} onChange={e => setNext(e.target.value)} placeholder="Mínimo 6 caracteres" style={inputStyle}/>
        </label>
        <label style={{ display: 'block', marginBottom: 14 }}>
          <div style={{ fontSize: 12, fontWeight: 700, color: '#5E4E64' }}>Confirmar contraseña</div>
          <input type="password" value={confirm} onChange={e => setConfirm(e.target.value)} placeholder="Repetí la contraseña" style={inputStyle}/>
        </label>
        {msg && <div style={{ background: msg.bad ? '#FCE7E5' : '#E0F3EA', color: msg.bad ? '#E5564B' : '#1E9E6A', borderRadius: 9, padding: '9px 12px', fontSize: 13, marginBottom: 12 }}>{msg.text}</div>}
        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
          <button onClick={onClose} style={{ padding: '9px 16px', borderRadius: 10, border: `1px solid ${C.line}`, background: '#fff', cursor: 'pointer', fontFamily: DISP, fontWeight: 600, fontSize: 13 }}>Cancelar</button>
          <button onClick={save} disabled={saving} style={{ padding: '9px 16px', borderRadius: 10, border: 'none', background: C.primary, color: '#fff', cursor: saving ? 'not-allowed' : 'pointer', fontFamily: DISP, fontWeight: 700, fontSize: 13, opacity: saving ? .7 : 1 }}>{saving ? 'Guardando…' : 'Guardar'}</button>
        </div>
      </div>
    </div>
  )
}

function loadContacted(clientId) {
  try { return new Set(JSON.parse(localStorage.getItem('cp_contacted_' + clientId) || '[]')) }
  catch { return new Set() }
}
function saveContacted(clientId, set) {
  localStorage.setItem('cp_contacted_' + clientId, JSON.stringify([...set]))
}

export default function ClientPortal({ clientId, clientName, onLogout }) {
  const [months, setMonths] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [brand, setBrand] = useState({ color: C.primary, logo: null, title: null })
  const [chgPwd, setChgPwd] = useState(false)
  const [showPrevYear, setShowPrevYear] = useState(false)
  const [segFilter, setSegFilter] = useState('')
  const [regionFilter, setRegionFilter] = useState('')
  const [typeFilter, setTypeFilter] = useState('all')
  const [page, setPage] = useState(0)
  const [contacted, setContacted] = useState(() => loadContacted(clientId))

  useEffect(() => {
    fetch(`/api/client-portal?clientId=${clientId}`)
      .then(r => { if (!r.ok) throw new Error(r.status); return r.json() })
      .then(d => { if (d.error) throw new Error(d.error); if (d.months) setMonths(d.months); setLoading(false) })
      .catch(e => { setError('Error al cargar los datos: ' + e.message); setLoading(false) })
    fetch(`/api/survey-config?clientId=${clientId}`)
      .then(r => r.ok ? r.json() : {})
      .then(d => { if (d.primary_color || d.logo_url || d.title) setBrand({ color: d.primary_color || C.primary, logo: d.logo_url || null, title: d.title || null }) })
      .catch(() => {})
  }, [clientId])

  function toggleContacted(key) {
    setContacted(prev => {
      const next = new Set(prev)
      next.has(key) ? next.delete(key) : next.add(key)
      saveContacted(clientId, next)
      return next
    })
  }

  const currentYear = new Date().getFullYear()
  const prevYear = currentYear - 1

  const allResponses = months.flatMap(m => m.responses || [])

  // Segmentation options
  const segs = useMemo(() => [...new Set(allResponses.map(r => r.d?.Segmento).filter(Boolean))], [allResponses.length])
  const regions = useMemo(() => [...new Set(allResponses.map(r => r.d?.['Región']).filter(Boolean))], [allResponses.length])

  // Filtered responses
  const filtered = useMemo(() => allResponses.filter(r => {
    if (segFilter && r.d?.Segmento !== segFilter) return false
    if (regionFilter && r.d?.['Región'] !== regionFilter) return false
    return true
  }), [allResponses.length, segFilter, regionFilter])

  const nps = npsCalc(filtered)
  const promotores = filtered.filter(r => r.e >= 9).length
  const detractores = filtered.filter(r => r.e <= 6).length
  const pasivos = filtered.filter(r => r.e >= 7 && r.e <= 8).length
  const npsColor = nps !== null ? npsBandColor(nps) : C.tx3

  // Chart — current year
  const curMonths = months.filter(m => m.month?.startsWith(String(currentYear)))
  const prvMonths = months.filter(m => m.month?.startsWith(String(prevYear)))

  const chartData = curMonths.map(m => {
    const [, mm] = m.month.split('-')
    const curNps = npsCalc(m.responses)
    const prvM = prvMonths.find(p => p.month.split('-')[1] === mm)
    const prvNps = prvM ? npsCalc(prvM.responses) : null
    return { label: MES[+mm], nps: curNps, prev: prvNps }
  }).filter(d => d.nps !== null)

  // Comments with type filter
  const commentSource = filtered.filter(r => r.c)
  const commentFiltered = typeFilter === 'pro' ? commentSource.filter(r => r.e >= 9)
    : typeFilter === 'det' ? commentSource.filter(r => r.e <= 6)
    : typeFilter === 'pas' ? commentSource.filter(r => r.e >= 7 && r.e <= 8)
    : commentSource

  const totalPages = Math.ceil(commentFiltered.length / PAGE_SIZE)
  const pagedComments = commentFiltered.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE)

  if (loading) return <PortalSkeleton brand={brand}/>

  const selStyle = { fontSize: 12, fontWeight: 600, fontFamily: DISP, color: C.tx2, padding: '6px 10px', border: `1px solid ${C.line}`, borderRadius: 9, background: '#fff', cursor: 'pointer' }
  const toggleBtn = (active, label, onClick) => (
    <button onClick={onClick} style={{ ...selStyle, background: active ? C.primary : '#fff', color: active ? '#fff' : C.tx2, border: `1px solid ${active ? C.primary : C.line}` }}>{label}</button>
  )

  return (
    <div style={{ minHeight: '100vh', background: C.surface, fontFamily: BODY }}>
      <ChangePasswordModal open={chgPwd} onClose={() => setChgPwd(false)}/>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Quicksand:wght@400;600;700&family=Archivo:wght@400;500;600;700&display=swap');
        *{box-sizing:border-box}
        @keyframes cpShimmer{0%{background-position:200% 0}100%{background-position:-200% 0}}
        @media print {
          body * { visibility: hidden !important; }
          #cp-print-report, #cp-print-report * { visibility: visible !important; }
          #cp-print-report { position: fixed !important; inset: 0 !important; display: block !important; padding: 32px !important; background: #fff !important; z-index: 9999; }
        }
      `}</style>

      {/* Print report — hidden until print */}
      <div id="cp-print-report" style={{ display: 'none', fontFamily: BODY }}>
        <div style={{ fontFamily: DISP, fontWeight: 700, fontSize: 22, marginBottom: 4 }}>{brand.title || clientName} — Reporte NPS</div>
        <div style={{ fontSize: 13, color: '#666', marginBottom: 24 }}>Generado {new Date().toLocaleDateString('es-AR')}</div>
        <div style={{ display: 'flex', gap: 24, marginBottom: 24 }}>
          {[
            { label: 'NPS', value: nps !== null ? (nps > 0 ? '+' : '') + nps : '—', color: npsColor },
            { label: 'Respuestas', value: filtered.length },
            { label: 'Promotores', value: promotores + ' (' + (filtered.length ? Math.round(promotores/filtered.length*100) : 0) + '%)' },
            { label: 'Detractores', value: detractores + ' (' + (filtered.length ? Math.round(detractores/filtered.length*100) : 0) + '%)' },
          ].map(k => (
            <div key={k.label} style={{ flex: 1 }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: '#888', marginBottom: 4 }}>{k.label}</div>
              <div style={{ fontSize: 28, fontWeight: 700, color: k.color || '#111' }}>{k.value}</div>
            </div>
          ))}
        </div>
        <div style={{ fontSize: 13, color: '#444' }}>Evolución mensual: {chartData.map(d => `${d.label}: ${d.nps > 0 ? '+' : ''}${d.nps}`).join(' · ')}</div>
      </div>

      {/* Header */}
      <div style={{ background: brand.color !== C.primary ? brand.color : C.grad, padding: '18px 28px', display: 'flex', alignItems: 'center', gap: 14 }}>
        {brand.logo && <img src={brand.logo} alt="logo" style={{ height: 36, borderRadius: 6, objectFit: 'contain', background: 'rgba(255,255,255,.15)', padding: '4px 8px' }}/>}
        <div style={{ flex: 1 }}>
          <div style={{ fontFamily: DISP, fontWeight: 700, fontSize: 11, color: 'rgba(255,255,255,.7)', letterSpacing: 1, marginBottom: 2 }}>PORTAL NPS</div>
          <div style={{ fontFamily: DISP, fontWeight: 700, fontSize: 20, color: '#fff' }}>{brand.title || clientName || 'Mi empresa'}</div>
        </div>
        <button onClick={() => {
          const el = document.getElementById('cp-print-report')
          el.style.display = 'block'
          window.print()
          el.style.display = 'none'
        }} style={{ background: 'rgba(255,255,255,.15)', border: '1px solid rgba(255,255,255,.3)', color: '#fff', borderRadius: 9, padding: '7px 14px', fontSize: 13, fontWeight: 600, cursor: 'pointer', fontFamily: DISP, marginRight: 8 }}>PDF</button>
        <button onClick={() => setChgPwd(true)} style={{ background: 'rgba(255,255,255,.15)', border: '1px solid rgba(255,255,255,.3)', color: '#fff', borderRadius: 9, padding: '7px 14px', fontSize: 13, fontWeight: 600, cursor: 'pointer', fontFamily: DISP, marginRight: 8 }}>Contraseña</button>
        <button onClick={onLogout} style={{ background: 'rgba(255,255,255,.15)', border: '1px solid rgba(255,255,255,.3)', color: '#fff', borderRadius: 9, padding: '7px 14px', fontSize: 13, fontWeight: 600, cursor: 'pointer', fontFamily: DISP }}>Salir</button>
      </div>

      <div style={{ maxWidth: 860, margin: '0 auto', padding: '28px 20px' }}>
        {error && <div style={{ background: C.criticoBg, color: C.critico, padding: '12px 16px', borderRadius: 12, marginBottom: 20, fontSize: 13 }}>{error}</div>}

        {/* Filtros */}
        {(segs.length > 0 || regions.length > 0) && (
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 18, alignItems: 'center' }}>
            <span style={{ fontSize: 12, fontWeight: 700, color: C.tx3, fontFamily: DISP }}>Filtrar:</span>
            {segs.length > 0 && (
              <select value={segFilter} onChange={e => { setSegFilter(e.target.value); setPage(0) }} style={selStyle}>
                <option value="">Todos los segmentos</option>
                {segs.map(s => <option key={s} value={s}>{s}</option>)}
              </select>
            )}
            {regions.length > 0 && (
              <select value={regionFilter} onChange={e => { setRegionFilter(e.target.value); setPage(0) }} style={selStyle}>
                <option value="">Todas las regiones</option>
                {regions.map(r => <option key={r} value={r}>{r}</option>)}
              </select>
            )}
            {(segFilter || regionFilter) && (
              <button onClick={() => { setSegFilter(''); setRegionFilter(''); setPage(0) }} style={{ ...selStyle, color: C.critico, borderColor: C.critico }}>✕ Limpiar</button>
            )}
          </div>
        )}

        {/* KPIs */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(160px,1fr))', gap: 14, marginBottom: 24 }}>
          <Kpi title="NPS ACTUAL" value={nps !== null ? (nps > 0 ? '+' : '') + nps : '—'} sub="Net Promoter Score" color={npsColor || brand.color}/>
          <Kpi title="RESPUESTAS" value={filtered.length} sub="en el período"/>
          <Kpi title="PROMOTORES" value={promotores} sub={filtered.length ? Math.round(promotores/filtered.length*100) + '%' : ''}/>
          <Kpi title="DETRACTORES" value={detractores} sub={filtered.length ? Math.round(detractores/filtered.length*100) + '%' : ''}/>
        </div>

        {/* Gráfico tendencia */}
        {chartData.length > 1 && (
          <div style={{ background: '#fff', borderRadius: 16, padding: '20px 20px 10px', border: `1px solid ${C.line}`, marginBottom: 20 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
              <div style={{ fontFamily: DISP, fontWeight: 700, fontSize: 14, color: C.tx }}>Evolución mensual del NPS</div>
              {prvMonths.length > 0 && (
                <button onClick={() => setShowPrevYear(v => !v)} style={{ ...selStyle, background: showPrevYear ? C.primary : '#fff', color: showPrevYear ? '#fff' : C.tx2, border: `1px solid ${showPrevYear ? C.primary : C.line}` }}>
                  {showPrevYear ? '✓ ' : ''}{prevYear}
                </button>
              )}
            </div>
            <ResponsiveContainer width="100%" height={180}>
              <LineChart data={chartData} margin={{ top: 4, right: 8, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke={C.line}/>
                <XAxis dataKey="label" tick={{ fontSize: 11, fill: C.tx3 }}/>
                <YAxis domain={[-100,100]} tick={{ fontSize: 11, fill: C.tx3 }}/>
                <Tooltip formatter={(v, name) => [(v > 0 ? '+' : '') + v, name === 'nps' ? String(currentYear) : String(prevYear)]}/>
                <Line type="monotone" dataKey="nps" name="nps" stroke={C.primary} strokeWidth={2.5} dot={{ fill: C.primary, r: 4 }} connectNulls/>
                {showPrevYear && <Line type="monotone" dataKey="prev" name="prev" stroke="#aaa" strokeWidth={1.8} strokeDasharray="5 3" dot={{ fill: '#aaa', r: 3 }} connectNulls/>}
              </LineChart>
            </ResponsiveContainer>
            {showPrevYear && (
              <div style={{ display: 'flex', gap: 16, marginTop: 8, fontSize: 12, color: C.tx3 }}>
                <span style={{ display: 'flex', alignItems: 'center', gap: 5 }}><span style={{ display: 'inline-block', width: 18, height: 3, background: C.primary, borderRadius: 2 }}/>{currentYear}</span>
                <span style={{ display: 'flex', alignItems: 'center', gap: 5 }}><span style={{ display: 'inline-block', width: 18, height: 2, background: '#aaa', borderRadius: 2, borderTop: '2px dashed #aaa' }}/>{prevYear}</span>
              </div>
            )}
          </div>
        )}

        {/* Distribución */}
        {filtered.length > 0 && (
          <div style={{ background: '#fff', borderRadius: 16, padding: '20px', border: `1px solid ${C.line}`, marginBottom: 20 }}>
            <div style={{ fontFamily: DISP, fontWeight: 700, fontSize: 14, color: C.tx, marginBottom: 14 }}>Distribución de respuestas</div>
            <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
              {[
                { label: 'Promotores (9-10)', count: promotores, color: C.exc },
                { label: 'Pasivos (7-8)', count: pasivos, color: C.tx3 },
                { label: 'Detractores (0-6)', count: detractores, color: C.critico },
              ].map(({ label, count, color }) => (
                <div key={label} style={{ flex: 1, minWidth: 120, background: C.surface, borderRadius: 12, padding: '12px 14px' }}>
                  <div style={{ fontFamily: DISP, fontWeight: 700, fontSize: 22, color }}>{count}</div>
                  <div style={{ fontSize: 12, color: C.tx2 }}>{label}</div>
                  <div style={{ height: 4, borderRadius: 2, background: C.line, marginTop: 8, overflow: 'hidden' }}>
                    <div style={{ height: '100%', width: filtered.length ? count/filtered.length*100+'%' : '0%', background: color, borderRadius: 2 }}/>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Comentarios paginados */}
        {commentSource.length > 0 && (
          <div style={{ background: '#fff', borderRadius: 16, padding: '20px', border: `1px solid ${C.line}` }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 10, marginBottom: 14 }}>
              <div style={{ fontFamily: DISP, fontWeight: 700, fontSize: 14, color: C.tx }}>Voces del cliente</div>
              <div style={{ display: 'flex', gap: 6 }}>
                {toggleBtn(typeFilter === 'all', 'Todos', () => { setTypeFilter('all'); setPage(0) })}
                {toggleBtn(typeFilter === 'pro', '👍 Promotores', () => { setTypeFilter('pro'); setPage(0) })}
                {toggleBtn(typeFilter === 'pas', '😐 Pasivos', () => { setTypeFilter('pas'); setPage(0) })}
                {toggleBtn(typeFilter === 'det', '👎 Detractores', () => { setTypeFilter('det'); setPage(0) })}
              </div>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {pagedComments.map((r, i) => {
                const key = `${r.e}-${r.c?.slice(0,20)}-${i + page * PAGE_SIZE}`
                const isContacted = contacted.has(key)
                const isDet = r.e <= 6
                return (
                  <div key={i} style={{ background: isContacted ? '#E0F3EA' : C.surface, borderRadius: 12, padding: '12px 14px', display: 'flex', gap: 12, alignItems: 'flex-start', border: isContacted ? '1px solid #b2dfcc' : '1px solid transparent' }}>
                    <span style={{ fontFamily: DISP, fontWeight: 700, fontSize: 13, background: (r.e >= 9 ? '#E0F3EA' : r.e >= 7 ? C.lila4 : '#FCE7E5'), color: (r.e >= 9 ? '#1E9E6A' : r.e >= 7 ? C.primary : '#E5564B'), padding: '2px 8px', borderRadius: 8, flexShrink: 0 }}>{r.e}</span>
                    <span style={{ fontSize: 13.5, color: C.tx2, lineHeight: 1.5, flex: 1 }}>{r.c}</span>
                    {isDet && (
                      <button onClick={() => toggleContacted(key)} style={{ flexShrink: 0, fontSize: 11.5, fontWeight: 700, fontFamily: DISP, padding: '4px 10px', borderRadius: 8, border: 'none', cursor: 'pointer', background: isContacted ? '#1E9E6A' : C.primary, color: '#fff', whiteSpace: 'nowrap' }}>
                        {isContacted ? '✓ Contactado' : 'Marcar contactado'}
                      </button>
                    )}
                  </div>
                )
              })}
            </div>
            {totalPages > 1 && (
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, marginTop: 16 }}>
                <button onClick={() => setPage(p => Math.max(0, p - 1))} disabled={page === 0} style={{ ...selStyle, opacity: page === 0 ? .4 : 1, cursor: page === 0 ? 'default' : 'pointer' }}>←</button>
                <span style={{ fontSize: 12.5, color: C.tx2, fontFamily: DISP, fontWeight: 600 }}>{page + 1} / {totalPages}</span>
                <button onClick={() => setPage(p => Math.min(totalPages - 1, p + 1))} disabled={page >= totalPages - 1} style={{ ...selStyle, opacity: page >= totalPages - 1 ? .4 : 1, cursor: page >= totalPages - 1 ? 'default' : 'pointer' }}>→</button>
              </div>
            )}
          </div>
        )}

        {filtered.length === 0 && !loading && (
          <div style={{ textAlign: 'center', padding: '60px 20px', color: C.tx3 }}>
            <div style={{ fontSize: 40, marginBottom: 12 }}>📊</div>
            <div style={{ fontFamily: DISP, fontWeight: 700, fontSize: 16, color: C.tx2, marginBottom: 6 }}>Aún no hay respuestas</div>
            <div style={{ fontSize: 13 }}>Las respuestas del link de encuesta aparecerán aquí automáticamente.</div>
          </div>
        )}
      </div>
    </div>
  )
}

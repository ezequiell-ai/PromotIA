/**
 * api/send-surveys.js — Envío programado de encuestas NPS.
 * Llamado por Vercel Cron (ver vercel.json) o manualmente con ?clientId=...&force=1
 *
 * MODO ACTUAL: dry-run — registra en Supabase lo que se enviaría sin mandar emails.
 * Para activar envíos reales: agregar RESEND_API_KEY en las env vars de Vercel.
 */
import { createClient } from '@supabase/supabase-js'

const APP_URL = process.env.APP_URL || 'https://app.promotia.talenio.tech'

function shouldSendToday(frequency) {
  const now = new Date()
  const day = now.getDate()
  const month = now.getMonth() + 1
  if (frequency === 'mensual') return day === 1
  if (frequency === 'trimestral') return day === 1 && [1, 4, 7, 10].includes(month)
  if (frequency === 'semestral') return day === 1 && [1, 7].includes(month)
  if (frequency === 'anual') return day === 1 && month === 1
  return false
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*')
  if (req.method === 'OPTIONS') return res.status(200).end()

  const { clientId: specificClient, force } = req.query
  const dryRun = !process.env.RESEND_API_KEY

  const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY)

  const { data: stateRow } = await supabase
    .from('promotia_app_state')
    .select('value')
    .eq('key', 'promotia:DB')
    .maybeSingle()

  if (!stateRow?.value) return res.status(200).json({ skipped: true, reason: 'No state found' })

  let db
  try { db = JSON.parse(stateRow.value) } catch { return res.status(500).json({ error: 'Invalid state' }) }

  const clients = db.clients || []
  const queued = []
  const skipped = []

  for (const c of clients) {
    if (specificClient && c.id !== specificClient) continue
    if (!c.surveyFrequency || c.surveyFrequency === 'ninguna') { skipped.push({ client: c.name, reason: 'sin frecuencia' }); continue }
    if (!force && !shouldSendToday(c.surveyFrequency)) { skipped.push({ client: c.name, reason: 'no es día de envío' }); continue }
    if (!c.contactEmails) { skipped.push({ client: c.name, reason: 'sin emails configurados' }); continue }

    const emails = c.contactEmails.split(',').map(e => e.trim()).filter(Boolean)
    if (!emails.length) { skipped.push({ client: c.name, reason: 'emails inválidos' }); continue }

    const surveyUrl = `${APP_URL}/encuesta/${c.id}`

    if (!dryRun) {
      // Envío real con Resend (activar cuando RESEND_API_KEY esté configurada)
      const html = buildEmailHtml(c, surveyUrl)
      for (const email of emails) {
        await fetch('https://api.resend.com/emails', {
          method: 'POST',
          headers: { Authorization: `Bearer ${process.env.RESEND_API_KEY}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({
            from: process.env.RESEND_FROM || 'PromotIA <nps@promotia.talenio.tech>',
            to: email,
            subject: `${c.surveyTitle || c.name} — ¿Cómo lo estamos haciendo?`,
            html,
          }),
        })
        queued.push({ client: c.name, email, sent: true })
      }
    } else {
      // Dry-run: solo registra
      for (const email of emails) {
        queued.push({ client: c.name, email, surveyUrl, sent: false, reason: 'RESEND_API_KEY no configurada' })
      }
    }
  }

  // Registrar en Supabase para auditoría (tabla survey_send_log si existe, si no se ignora)
  if (queued.length) {
    await supabase.from('promotia_survey_send_log').insert(
      queued.map(q => ({
        client_id: clients.find(c => c.name === q.client)?.id,
        email: q.email,
        sent: q.sent || false,
        dry_run: dryRun,
        created_at: new Date().toISOString(),
      }))
    ).then(() => {}).catch(() => {}) // silencioso si la tabla no existe
  }

  return res.status(200).json({
    mode: dryRun ? 'dry-run (sin RESEND_API_KEY)' : 'live',
    queued,
    skipped,
    total: queued.length,
  })
}

function buildEmailHtml(c, surveyUrl) {
  const color = c.surveyColor || '#73017B'
  const title = c.surveyTitle || c.name
  return `
<div style="font-family:'Segoe UI',Arial,sans-serif;max-width:520px;margin:0 auto;background:#fff;border-radius:16px;overflow:hidden;border:1px solid #eee">
  <div style="background:${color};padding:28px 32px;text-align:center">
    ${c.surveyLogo ? `<img src="${c.surveyLogo}" height="48" style="margin-bottom:12px;border-radius:6px"/>` : ''}
    <h1 style="color:#fff;font-size:22px;margin:0;font-weight:700">${title}</h1>
    <p style="color:rgba(255,255,255,.85);margin:8px 0 0;font-size:14px">Encuesta de satisfacción NPS</p>
  </div>
  <div style="padding:32px">
    <p style="font-size:15px;color:#333;line-height:1.6;margin:0 0 24px">${c.surveyQuestion || '¿Qué tan probable es que nos recomiendes a un colega o amigo?'}</p>
    <div style="text-align:center">
      <a href="${surveyUrl}" style="display:inline-block;background:${color};color:#fff;text-decoration:none;padding:14px 32px;border-radius:10px;font-weight:700;font-size:15px">Responder encuesta</a>
    </div>
    <p style="font-size:12px;color:#999;text-align:center;margin-top:24px">Toma menos de 2 minutos · Tus respuestas son confidenciales</p>
  </div>
</div>`
}

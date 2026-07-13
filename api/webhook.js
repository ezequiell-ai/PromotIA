// Stripe webhook — maneja eventos de pago y actualiza la suscripción en Supabase
import Stripe from 'stripe'
import { createClient } from '@supabase/supabase-js'

export const config = { api: { bodyParser: false } }

async function getRawBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = []
    req.on('data', c => chunks.push(c))
    req.on('end', () => resolve(Buffer.concat(chunks)))
    req.on('error', reject)
  })
}

function uid(prefix = 'c') {
  return prefix + '_' + Math.random().toString(36).slice(2, 9)
}

function tempPassword() {
  const chars = 'ABCDEFGHJKMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789!@#$'
  return Array.from({ length: 12 }, () => chars[Math.floor(Math.random() * chars.length)]).join('')
}

const PLAN_NAMES = { start: 'Start', growth: 'Growth', scale: 'Scale' }

// Lee el app_state de Supabase y devuelve el objeto db parseado
async function readDB(supabase) {
  const { data } = await supabase
    .from('app_state')
    .select('value')
    .eq('key', 'promotia:DB')
    .maybeSingle()
  if (!data?.value) return { clients: [], data: {}, users: [], plans: {}, voices: {} }
  try { return JSON.parse(data.value) } catch { return { clients: [], data: {}, users: [], plans: {}, voices: {} } }
}

// Guarda el db en app_state de Supabase
async function writeDB(supabase, db) {
  await supabase.from('app_state').upsert(
    { key: 'promotia:DB', value: JSON.stringify(db), updated_at: new Date().toISOString() },
    { onConflict: 'key' }
  )
}

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end()

  const stripe = new Stripe(process.env.STRIPE_SECRET_KEY)
  const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY)

  const rawBody = await getRawBody(req)
  const sig = req.headers['stripe-signature']

  let event
  try {
    event = stripe.webhooks.constructEvent(rawBody, sig, process.env.STRIPE_WEBHOOK_SECRET)
  } catch (err) {
    return res.status(400).send(`Webhook Error: ${err.message}`)
  }

  const { type, data } = event

  // ── PAGO EXITOSO — crear usuario + cliente ────────────────────────────────
  if (type === 'checkout.session.completed') {
    const session = data.object
    const email = session.customer_details?.email
    const customerName = session.customer_details?.name || ''
    const customerId = session.customer
    const subscriptionId = session.subscription

    if (!email) return res.json({ received: true })

    // 1. Buscar o crear usuario en Supabase Auth
    const { data: authList } = await supabase.auth.admin.listUsers()
    let authUser = authList?.users?.find(u => u.email === email)
    let password = null

    if (!authUser) {
      password = tempPassword()
      const { data: created } = await supabase.auth.admin.createUser({
        email,
        password,
        email_confirm: true,
        user_metadata: { name: customerName },
      })
      authUser = created?.user
    }

    if (!authUser) return res.json({ received: true, error: 'No se pudo crear usuario' })

    // 2. Determinar plan contratado
    let planId = 'start'
    let subDetails = null
    if (subscriptionId) {
      subDetails = await stripe.subscriptions.retrieve(subscriptionId)
      const priceId = subDetails.items.data[0]?.price?.id
      if (priceId === process.env.STRIPE_PRICE_GROWTH) planId = 'growth'
      else if (priceId === process.env.STRIPE_PRICE_SCALE) planId = 'scale'
    }

    // 3. Crear empresa en Supabase si no existe
    let { data: userRow } = await supabase
      .from('promotia_users')
      .select('company_id')
      .eq('id', authUser.id)
      .maybeSingle()

    let companyId = userRow?.company_id
    const companyName = customerName || email.split('@')[1] || 'Mi empresa'

    if (!companyId) {
      const { data: company } = await supabase
        .from('companies')
        .insert({ name: companyName, stripe_customer_id: customerId, is_active: true, plan_id: planId })
        .select('id')
        .single()
      companyId = company?.id

      await supabase.from('promotia_users').upsert({
        id: authUser.id,
        company_id: companyId,
        email,
        role: 'admin',
      })
    } else {
      await supabase
        .from('companies')
        .update({ stripe_customer_id: customerId, is_active: true, plan_id: planId })
        .eq('id', companyId)
    }

    // 4. Registrar suscripción
    await supabase.from('subscriptions').upsert({
      company_id: companyId,
      stripe_subscription_id: subscriptionId,
      plan_id: planId,
      status: 'active',
      current_period_end: subDetails
        ? new Date(subDetails.current_period_end * 1000).toISOString()
        : null,
      updated_at: new Date().toISOString(),
    }, { onConflict: 'company_id' })

    // 5. Agregar cliente al app_state (base de datos de la app)
    const db = await readDB(supabase)
    const existingClient = db.clients.find(c => c.stripeCustomerId === customerId || c.email === email)
    if (!existingClient) {
      const clientId = uid('c')
      const code = companyName.slice(0, 3).toUpperCase() + '-' + Math.random().toString(36).slice(2, 5).toUpperCase()
      db.clients.push({
        id: clientId,
        name: companyName,
        code,
        email,
        stripeCustomerId: customerId,
        companyId,
        planId,
        planStatus: 'active',
        sector: '',
        web: '',
        contexto: '',
        productos: [],
        propuesta: '',
        segmentos: ['Enterprise', 'Mid-Market', 'SMB'],
        notas: '',
        surveyTitle: companyName,
        surveyColor: '#73017B',
        surveyLogo: '',
        surveyQuestion: '¿Qué tan probable es que nos recomiendes?',
        surveyFrequency: 'ninguna',
        contactEmails: email,
        npsTarget: '',
        npsTargetLabel: '',
      })
      db.data[clientId] = { months: [] }
      await writeDB(supabase, db)
    } else {
      // Actualizar plan si ya existía el cliente
      existingClient.planId = planId
      existingClient.planStatus = 'active'
      existingClient.stripeCustomerId = customerId
      await writeDB(supabase, db)
    }

    // 6. Enviar email de bienvenida con credenciales (si Resend está configurado)
    if (password && process.env.RESEND_API_KEY) {
      await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: { Authorization: `Bearer ${process.env.RESEND_API_KEY}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          from: process.env.RESEND_FROM || 'PromotIA <nps@promotia.talenio.tech>',
          to: email,
          subject: `¡Bienvenido a PromotIA ${PLAN_NAMES[planId]}! Tus accesos`,
          html: `
<div style="font-family:'Segoe UI',Arial,sans-serif;max-width:520px;margin:0 auto">
  <div style="background:linear-gradient(120deg,#73017B,#E40993);padding:28px 32px;border-radius:16px 16px 0 0;text-align:center">
    <h1 style="color:#fff;margin:0;font-size:22px">¡Bienvenido a PromotIA!</h1>
    <p style="color:rgba(255,255,255,.85);margin:8px 0 0">Plan ${PLAN_NAMES[planId]} activado</p>
  </div>
  <div style="background:#fff;padding:32px;border:1px solid #E7DEEC;border-radius:0 0 16px 16px">
    <p style="color:#5E4E64;font-size:15px">Hola${customerName ? ' ' + customerName : ''},</p>
    <p style="color:#5E4E64;font-size:14px">Tu cuenta de PromotIA ya está lista. Estos son tus accesos:</p>
    <div style="background:#F7F2FA;border-radius:12px;padding:16px 20px;margin:20px 0">
      <div style="margin-bottom:8px"><b style="color:#1A0A1C">Email:</b> <span style="color:#73017B">${email}</span></div>
      <div><b style="color:#1A0A1C">Contraseña temporal:</b> <span style="font-family:monospace;background:#fff;padding:3px 8px;border-radius:6px;color:#73017B;font-size:15px">${password}</span></div>
    </div>
    <p style="color:#A99BB0;font-size:13px">Te recomendamos cambiar tu contraseña desde la app al ingresar por primera vez.</p>
    <div style="text-align:center;margin-top:24px">
      <a href="${process.env.APP_URL || 'https://app.promotia.talenio.tech'}" style="background:linear-gradient(120deg,#73017B,#E40993);color:#fff;text-decoration:none;padding:13px 28px;border-radius:10px;font-weight:700;font-size:14px">Ingresar a PromotIA →</a>
    </div>
  </div>
</div>`,
        }),
      }).catch(() => {})
    }
  }

  // ── RENOVACIÓN EXITOSA ────────────────────────────────────────────────────
  if (type === 'invoice.payment_succeeded') {
    const invoice = data.object
    const subscriptionId = invoice.subscription
    if (!subscriptionId) return res.json({ received: true })
    const sub = await stripe.subscriptions.retrieve(subscriptionId)
    await supabase
      .from('subscriptions')
      .update({ status: 'active', current_period_end: new Date(sub.current_period_end * 1000).toISOString(), updated_at: new Date().toISOString() })
      .eq('stripe_subscription_id', subscriptionId)
    // Actualizar planStatus en app_state
    const { data: subRow } = await supabase.from('subscriptions').select('company_id').eq('stripe_subscription_id', subscriptionId).maybeSingle()
    if (subRow?.company_id) {
      const db = await readDB(supabase)
      const client = db.clients.find(c => c.companyId === subRow.company_id)
      if (client) { client.planStatus = 'active'; await writeDB(supabase, db) }
    }
  }

  // ── PAGO FALLIDO ─────────────────────────────────────────────────────────
  if (type === 'invoice.payment_failed') {
    const invoice = data.object
    const subscriptionId = invoice.subscription
    if (!subscriptionId) return res.json({ received: true })
    await supabase
      .from('subscriptions')
      .update({ status: 'past_due', updated_at: new Date().toISOString() })
      .eq('stripe_subscription_id', subscriptionId)
    const { data: sub } = await supabase.from('subscriptions').select('company_id').eq('stripe_subscription_id', subscriptionId).maybeSingle()
    if (sub) {
      await supabase.from('companies').update({ is_active: false }).eq('id', sub.company_id)
      const db = await readDB(supabase)
      const client = db.clients.find(c => c.companyId === sub.company_id)
      if (client) { client.planStatus = 'past_due'; await writeDB(supabase, db) }
    }
  }

  // ── CANCELACIÓN ──────────────────────────────────────────────────────────
  if (type === 'customer.subscription.deleted') {
    const subscription = data.object
    await supabase
      .from('subscriptions')
      .update({ status: 'canceled', updated_at: new Date().toISOString() })
      .eq('stripe_subscription_id', subscription.id)
    const { data: sub } = await supabase.from('subscriptions').select('company_id').eq('stripe_subscription_id', subscription.id).maybeSingle()
    if (sub) {
      await supabase.from('companies').update({ is_active: false }).eq('id', sub.company_id)
      const db = await readDB(supabase)
      const client = db.clients.find(c => c.companyId === sub.company_id)
      if (client) { client.planStatus = 'canceled'; await writeDB(supabase, db) }
    }
  }

  res.json({ received: true })
}

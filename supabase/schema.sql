-- ============================================================
-- PromotIA — Schema completo
-- Proyecto: fxmcvyeoljtzcxfinwfi.supabase.co
-- Ejecutar en: Supabase → SQL Editor → New Query
-- ============================================================


-- ────────────────────────────────────────────────────────────
-- 1. COMPANIES
-- ────────────────────────────────────────────────────────────
create table if not exists public.companies (
  id                  uuid primary key default gen_random_uuid(),
  name                text not null,
  stripe_customer_id  text,
  plan_id             text default 'start',   -- 'start' | 'growth' | 'scale'
  is_active           boolean default true,
  created_at          timestamptz default now()
);

alter table public.companies enable row level security;

-- Solo el service role puede leer/escribir (acceso solo desde las serverless functions)
create policy "service only" on public.companies
  using (false);


-- ────────────────────────────────────────────────────────────
-- 2. USERS
-- ────────────────────────────────────────────────────────────
create table if not exists public.users (
  id          uuid primary key references auth.users(id) on delete cascade,
  email       text,
  role        text default 'admin',           -- 'admin' | 'viewer'
  company_id  uuid references public.companies(id),
  client_code text,                           -- para viewers vinculados a un cliente
  created_at  timestamptz default now()
);

alter table public.users enable row level security;

-- El usuario autenticado puede leer su propia fila
create policy "user can read own row" on public.users
  for select using (auth.uid() = id);

-- Service role escribe
create policy "service can write" on public.users
  for all using (false);


-- ────────────────────────────────────────────────────────────
-- 3. SUBSCRIPTIONS
-- ────────────────────────────────────────────────────────────
create table if not exists public.subscriptions (
  id                      uuid primary key default gen_random_uuid(),
  company_id              uuid unique references public.companies(id) on delete cascade,
  stripe_subscription_id  text,
  plan_id                 text default 'start',
  status                  text default 'active', -- 'active' | 'past_due' | 'canceled' | 'unpaid'
  current_period_end      timestamptz,
  updated_at              timestamptz default now(),
  created_at              timestamptz default now()
);

alter table public.subscriptions enable row level security;

-- El usuario puede leer la suscripción de su empresa
create policy "user reads own company subscription" on public.subscriptions
  for select using (
    company_id in (
      select company_id from public.users where id = auth.uid()
    )
  );

create policy "service can write subscriptions" on public.subscriptions
  for all using (false);


-- ────────────────────────────────────────────────────────────
-- 4. APP_STATE
-- Estado de la app serializado como JSON (clientes, datos NPS, etc.)
-- ────────────────────────────────────────────────────────────
create table if not exists public.app_state (
  key         text primary key,
  value       text not null,
  updated_at  timestamptz default now()
);

alter table public.app_state enable row level security;

-- Solo accesible desde service role (serverless functions)
create policy "service only" on public.app_state
  using (false);


-- ────────────────────────────────────────────────────────────
-- 5. SURVEY_RESPONSES
-- Respuestas individuales a las encuestas NPS
-- ────────────────────────────────────────────────────────────
create table if not exists public.survey_responses (
  id          uuid primary key default gen_random_uuid(),
  client_id   text not null,   -- ID del cliente en app_state (string, ej: 'c_abc123')
  score       integer not null check (score >= 0 and score <= 10),
  comment     text,
  name        text,
  company     text,
  sector      text,            -- para benchmark por sector
  segmento    text,            -- para benchmark por segmento
  created_at  timestamptz default now()
);

create index if not exists survey_responses_client_id_idx on public.survey_responses(client_id);
create index if not exists survey_responses_created_at_idx on public.survey_responses(created_at desc);

alter table public.survey_responses enable row level security;

-- Escritura pública (la encuesta es pública, no requiere auth)
create policy "public insert survey response" on public.survey_responses
  for insert with check (true);

-- Lectura solo desde service role
create policy "service reads responses" on public.survey_responses
  for select using (false);


-- ────────────────────────────────────────────────────────────
-- 6. SURVEY_CONFIGS
-- Configuración visual de cada encuesta (logo, color, pregunta)
-- ────────────────────────────────────────────────────────────
create table if not exists public.survey_configs (
  id            uuid primary key default gen_random_uuid(),
  client_id     text unique not null,
  title         text,
  logo_url      text,
  primary_color text default '#73017B',
  question      text default '¿Qué tan probable es que nos recomiendes?',
  updated_at    timestamptz default now(),
  created_at    timestamptz default now()
);

create index if not exists survey_configs_client_id_idx on public.survey_configs(client_id);

alter table public.survey_configs enable row level security;

-- Lectura pública (la encuesta necesita cargar su config sin auth)
create policy "public read survey config" on public.survey_configs
  for select using (true);

-- Escritura solo desde service role
create policy "service writes survey config" on public.survey_configs
  for all using (false);


-- ────────────────────────────────────────────────────────────
-- 7. SURVEY_SEND_LOG
-- Auditoría de envíos de encuestas (cron y manuales)
-- ────────────────────────────────────────────────────────────
create table if not exists public.survey_send_log (
  id          uuid primary key default gen_random_uuid(),
  client_id   text,
  email       text,
  sent        boolean default false,
  dry_run     boolean default true,
  created_at  timestamptz default now()
);

create index if not exists survey_send_log_client_id_idx on public.survey_send_log(client_id);

alter table public.survey_send_log enable row level security;

create policy "service only" on public.survey_send_log
  using (false);


-- ────────────────────────────────────────────────────────────
-- LISTO
-- ────────────────────────────────────────────────────────────

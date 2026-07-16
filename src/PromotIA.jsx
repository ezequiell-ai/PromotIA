import React, { useState, useMemo, useEffect, useRef } from 'react';
import { Routes, Route, Navigate, useNavigate, useLocation, useParams } from 'react-router-dom';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, BarChart, Bar, Cell, ReferenceLine } from 'recharts';
import { TrendingUp, TrendingDown, AlertTriangle, Lightbulb, Target, Upload, ChevronRight, ChevronDown, Users, Activity, Gauge, Download, Sparkles, Building2, Plus, Trash2, Pencil, Check, X, Eye, ArrowLeft, CalendarDays, RotateCcw, LogOut, LayoutDashboard, FileSpreadsheet, MessageSquare, ClipboardList, BarChart3, ShieldCheck, Wand2, Heart, Star, Inbox, Briefcase, ThumbsUp, ThumbsDown, Minus, Package, Quote, Layers, QrCode, Printer, Settings, Bot, FileText, Send, BarChart2, Clock, Zap, Bell, Flag, GitCompareArrows, Home, UserCheck, XCircle, PhoneCall, RefreshCw } from 'lucide-react';
import * as XLSX from 'xlsx';
import { supabase } from './lib/supabase';

/* ============================ PERSISTENCIA ============================
   Fuente de verdad: Supabase vía funciones serverless.
   - Estado general (planes, voces, followups): /api/state
   - Clientes: /api/clients (tabla relacional promotia_clients)
   No hay fallback a localStorage — si el servidor falla, se muestra error. */
const STATE_URL = '/api/state';
const CLIENTS_URL = '/api/state?resource=clients';
const storage = {
  async get(key) {
    const [blobR, clientsR] = await Promise.allSettled([
      fetch(STATE_URL, { method: 'GET' }),
      fetch(CLIENTS_URL, { method: 'GET' }),
    ]);
    let parsed = null;
    let blobClients = [];
    if (blobR.status === 'fulfilled' && blobR.value.ok) {
      const d = await blobR.value.json();
      if (d?.value) {
        parsed = JSON.parse(d.value);
        blobClients = parsed.clients || [];
      }
    }
    if (!parsed) parsed = seedDB();
    if (clientsR.status === 'fulfilled' && clientsR.value.ok) {
      const d = await clientsR.value.json();
      if (d.clients && d.clients.length > 0) {
        // Tabla tiene datos — es la fuente de verdad
        parsed.clients = d.clients;
      } else if (blobClients.length > 0) {
        // Tabla vacía pero blob tiene clientes — migrar silenciosamente
        parsed.clients = blobClients;
        blobClients.forEach(c => storage.syncClient(c).catch(() => {}));
      } else {
        parsed.clients = [];
      }
    } else {
      // API de clientes falló — usar lo que haya en blob
      parsed.clients = blobClients;
    }
    return { key, value: JSON.stringify(parsed) };
  },
  async set(key, value) {
    // Guardar blob sin clients (clients se sincronizan por separado)
    const parsed = JSON.parse(value);
    const blobState = { ...parsed, clients: [] };
    const r = await fetch(STATE_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ value: JSON.stringify(blobState) }),
    });
    if (!r.ok) throw new Error('Error al guardar estado en servidor');
    return { key, value };
  },
  async delete(key) {
    await fetch(STATE_URL, { method: 'DELETE' });
    return { key, deleted: true };
  },
  async syncClient(client) {
    const r = await fetch(CLIENTS_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ client }),
    });
    if (!r.ok) throw new Error('Error al guardar cliente');
  },
  async deleteClient(id) {
    const r = await fetch(`/api/state?resource=clients&id=${encodeURIComponent(id)}`, { method: 'DELETE' });
    if (!r.ok) throw new Error('Error al eliminar cliente');
  },
};

/* ============================ DESIGN TOKENS — Delenio Magenta (light) ============================ */
const C = {
  bg:'#FFFFFF', surface:'#F7F2FA', surface2:'#FCFAFE', wash:'#F3DCF2',
  line:'#E7DEEC', line2:'#F1EAF4',
  tx:'#1A0A1C', tx2:'#5E4E64', tx3:'#A99BB0',
  primary:'#73017B', primaryD:'#52015A', magenta:'#E40993', magenta2:'#F46BC2', indigo:'#0c01a4',
  lila:'#B061B8', lila2:'#D9A9DF', lila3:'#EFD9F1', lila4:'#F7ECF8',
  grad:'linear-gradient(120deg,#73017B 0%,#A8108F 55%,#E40993 100%)',
  gradHero:'linear-gradient(125deg,#0c01a4 0%,#52015A 38%,#73017B 64%,#E40993 100%)',
  gradSoft:'linear-gradient(120deg,#EFD9F1,#FBE3F2)',
  // NPS bands (score)
  exc:'#1E9E6A', bueno:'#73017B', mejorar:'#E8A23D', critico:'#E5564B',
  excBg:'#E0F3EA', buenoBg:'#F3E6F4', mejorarBg:'#FCF1DF', criticoBg:'#FCE7E5',
  // categorías NPS
  promotor:'#1E9E6A', pasivo:'#C9BACF', detractor:'#E5564B',
  promotorBg:'#E0F3EA', detractorBg:'#FCE7E5',
};
const DISP = "'Quicksand','Trebuchet MS',sans-serif";
const BODY = "'Archivo','Segoe UI',system-ui,-apple-system,sans-serif";

/* ============================ PURE HELPERS ============================ */
const norm = s => String(s==null?'':s).toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/[^a-z0-9]/g,'');
const r1 = x => Math.round(x*10)/10;
const npsBand = s => s==null?null : s>=50?'exc' : s>=30?'bueno' : s>=0?'mejorar' : 'critico';
const bandName = b => ({exc:'Excelente',bueno:'Bueno',mejorar:'A mejorar',critico:'Crítico'}[b]);
const bandCol = b => C[b];
const bandBg  = b => C[b+'Bg'];
const MES = ['','Ene','Feb','Mar','Abr','May','Jun','Jul','Ago','Sep','Oct','Nov','Dic'];
const MESLONG = ['','Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre'];
const mLabel = m => { const [y,mm]=m.split('-'); return MES[+mm]+" '"+y.slice(2); };
const yearOf = m => m.split('-')[0];
const uid = (p='id') => p+'_'+Math.random().toString(36).slice(2,9);
const SEGMENTOS = ['Enterprise','Mid-Market','SMB'];
const SECTORES = [
  // Tecnología
  'SaaS / Software B2B',
  'SaaS / Software B2C',
  'Desarrollo de software a medida',
  'IT Services / Outsourcing tecnológico',
  'Ciberseguridad',
  'Inteligencia Artificial / Data',
  'E-commerce / Marketplace',
  'Telecomunicaciones',
  // Servicios profesionales
  'Consultoría de gestión / Management',
  'Consultoría de Recursos Humanos',
  'Consultoría legal / Estudio jurídico',
  'Consultoría contable / Auditoría',
  'Agencia de marketing / Publicidad',
  'Diseño / Branding / UX',
  'Capacitación y formación corporativa',
  'Headhunting / Selección de personal',
  // Finanzas
  'Banco / Entidad financiera',
  'Fintech / Pagos digitales',
  'Seguros / Aseguradoras',
  'Inversiones / Asset management',
  'Leasing / Factoring',
  // Salud
  'Laboratorio farmacéutico',
  'Clínica / Sanatorio / Prepaga',
  'Dispositivos médicos',
  'Salud digital / Telemedicina',
  'Bienestar y salud corporativa',
  // Industria y manufactura
  'Industria metalmecánica',
  'Industria química / Petroquímica',
  'Industria plástica / Embalaje',
  'Industria alimentaria',
  'Industria textil / Indumentaria',
  'Industria electrónica / Electromecánica',
  'Industria automotriz / Autopartes',
  // Logística y distribución
  'Logística y distribución B2B',
  'Transporte de cargas',
  'Courier / Última milla',
  'Almacenamiento / Depósito / WMS',
  'Supply chain / Importación-exportación',
  // Construcción y real estate
  'Constructora / Desarrolladora inmobiliaria',
  'Arquitectura e ingeniería',
  'Materiales de construcción',
  'Facilities management',
  // Consumo y retail
  'Retail / Cadena de tiendas',
  'Supermercados / Hipermercados',
  'Consumo masivo / FMCG',
  'Moda / Calzado / Accesorios',
  'Electrónica de consumo',
  // Energía y medioambiente
  'Oil & Gas / Petróleo',
  'Energías renovables / Solar / Eólica',
  'Utilities / Agua / Gas / Electricidad',
  'Gestión ambiental / Reciclaje',
  'Minería',
  // Agro
  'Agro / Agroquímica',
  'Agroindustria / Frigoríficos',
  'Maquinaria agrícola',
  'Semillas / Biotecnología agraria',
  // Educación
  'Universidad / Instituto terciario',
  'Escuela / Colegio privado',
  'EdTech / Plataforma educativa',
  'Capacitación ejecutiva / MBA',
  // Medios y entretenimiento
  'Medios de comunicación / Editorial',
  'Publicidad / Medios digitales',
  'Entretenimiento / Gaming / Streaming',
  'Eventos / MICE',
  // Turismo y hospitalidad
  'Hotel / Cadena hotelera',
  'Agencia de viajes / OTA',
  'Gastronomía / Restaurantes / Catering',
  'Turismo corporativo',
  // Gobierno y tercer sector
  'Organismo público / Estado',
  'ONG / Fundación',
  'Asociación / Cámara empresarial',
  // Otro
  'Otro',
];

/* Portfolio Delenio completo — 5 unidades de negocio (cross-sell con IA) */
const UNITS = {
 'Reingeniería Comercial':'#0c01a4',
 'Growth':'#1E9E6A',
 'Innovación':'#E40993',
 'Marketing':'#E8A23D',
 'People':'#73017B',
};
const PORTFOLIO = [
 // Reingeniería Comercial — profesionalizar el área comercial B2B
 {u:'Reingeniería Comercial', k:'ADN Comercial + IA', f:'Diagnóstico y rediseño de la estrategia comercial potenciado con IA.'},
 {u:'Reingeniería Comercial', k:'Ingeniería de procesos comerciales', f:'Diseño y optimización del proceso de venta consultiva por etapas.'},
 {u:'Reingeniería Comercial', k:'Esquemas de compensación', f:'Diseño de incentivos y comisiones para la fuerza de ventas.'},
 {u:'Reingeniería Comercial', k:'Mentoring comercial', f:'Acompañamiento y profesionalización de líderes y equipos de venta.'},
 {u:'Reingeniería Comercial', k:'Modelo de gestión comercial', f:'Matrices, metas y funnels (cliente nuevo, existente, upsell y cross-sell).'},
 {u:'Reingeniería Comercial', k:'Selección de perfiles comerciales', f:'Selección de vendedores y roles comerciales clave.'},
 {u:'Reingeniería Comercial', k:'Directorio Comercial Externo', f:'Dirección comercial externa / fuerza de ventas tercerizada.'},
 {u:'Reingeniería Comercial', k:'Campus Virtual', f:'Formación y entrenamiento comercial para el equipo.'},
 {u:'Reingeniería Comercial', k:'Desembarco en nuevos mercados', f:'Internacionalización y entrada a nuevos nichos o segmentos.'},
 // Growth — ingresos recurrentes y cartera
 {u:'Growth', k:'Generación de demanda', f:'Más y mejores oportunidades comerciales alineadas al cliente ideal.'},
 {u:'Growth', k:'Optimización del proceso de ventas', f:'Diagnóstico del funnel y mejoras de conversión etapa por etapa.'},
 {u:'Growth', k:'Rendimiento de cartera', f:'Subir ticket medio, recompra y potencial de los clientes actuales (upsell/cross-sell).'},
 {u:'Growth', k:'Retención y fidelización', f:'Análisis de churn, estrategias de fidelización y medición de NPS.'},
 {u:'Growth', k:'Indicadores y analítica comercial', f:'Trazabilidad y métricas estratégicas de toda el área comercial.'},
 // Innovación — tecnología e IA aplicada al negocio
 {u:'Innovación', k:'Automatización de procesos', f:'Automatizaciones en CRM, chatbots y flujos del proceso comercial.'},
 {u:'Innovación', k:'Agentes de IA a medida', f:'Implementación de agentes de IA específicos para el negocio.'},
 {u:'Innovación', k:'Digitalización de ventas consultivas', f:'Llevar el proceso comercial tradicional al mundo digital.'},
 // Marketing — demanda y leads
 {u:'Marketing', k:'Marketing de ventas / demand gen', f:'Campañas y contenidos para generar demanda calificada.'},
 {u:'Marketing', k:'Estrategias inbound & outbound', f:'Generación de demanda combinando inbound y outbound según el cliente ideal.'},
 {u:'Marketing', k:'Calidad de leads e ICP', f:'Definición del cliente ideal y mejora de la calidad de los leads.'},
 {u:'Marketing', k:'Estrategia de nicho', f:'Posicionamiento y entrada en un nicho específico.'},
 // People — talento y RRHH
 {u:'People', k:'People Insight', f:'Diagnóstico de madurez y riesgos de RRHH (18 dimensiones).'},
 {u:'People', k:'People Evolution', f:'Diseño organizacional y evolución de roles con IA.'},
 {u:'People', k:'People Blueprint', f:'Diseño e implementación de procesos ágiles de RRHH.'},
 {u:'People', k:'People Tech', f:'Transformación digital de RRHH: HRIS, ATS y agentes de IA.'},
 {u:'People', k:'People Match', f:'Headhunting y selección de talento para roles clave.'},
 {u:'People', k:'People Drive', f:'Aceleración comercial y desarrollo de líderes de venta.'},
 {u:'People', k:'People Copilot', f:'Dirección de RRHH fraccional / acompañamiento estratégico continuo.'},
 {u:'People', k:'CEO Copilot', f:'Sparring estratégico senior 1:1 para CEO y fundadores.'},
];

/* ============================ NPS ANALYTICS ENGINE ============================ */
function npsOf(resp){
  const es = resp.map(r=>r.e).filter(v=>v!=null);
  if(!es.length) return null;
  const n=es.length;
  const pro=es.filter(v=>v>=9).length, pas=es.filter(v=>v>=7&&v<=8).length, det=es.filter(v=>v<=6).length;
  const nps=Math.round(pro/n*100)-Math.round(det/n*100);
  return { nps, n, pro, pas, det, proP:r1(pro/n*100), pasP:r1(pas/n*100), detP:r1(det/n*100), avg:r1(es.reduce((a,b)=>a+b,0)/n) };
}
function filterResp(resp,f){ let r=resp; for(const k in f){ if(f[k]) r=r.filter(x=>x.d&&x.d[k]===f[k]); } return r; }
function demoOptions(resp,key){ const s=new Set(); resp.forEach(r=>{ if(r.d&&r.d[key])s.add(r.d[key]); }); return [...s].sort(); }
function bySegment(resp,key){
  const map={}; resp.forEach(r=>{ const k=r.d&&r.d[key]; if(!k)return; (map[k]=map[k]||[]).push(r); });
  return Object.entries(map).map(([name,rs])=>{ const m=npsOf(rs); return {name, nps:m?m.nps:null, n:rs.length, proP:m?m.proP:0, detP:m?m.detP:0}; }).filter(x=>x.nps!=null).sort((a,b)=>b.nps-a.nps);
}
function comments(resp,kind){ // kind: 'pro' | 'det' | 'pas' | null
  return resp.filter(r=>r.c && (!kind || (kind==='pro'?r.e>=9 : kind==='det'?r.e<=6 : r.e>=7&&r.e<=8))).map(r=>({txt:r.c, e:r.e, seg:r.d?.Segmento}));
}

/* all responses of a client for a given year */
function yearResp(cdata, year){ const out=[]; (cdata?.months||[]).forEach(m=>{ if(yearOf(m.month)===String(year)) m.responses.forEach(r=>out.push(r)); }); return out; }
function clientYears(cdata){ const ys=new Set(); (cdata?.months||[]).forEach(m=>ys.add(yearOf(m.month))); return [...ys].sort(); }
function monthsOfYear(cdata, year){ return (cdata?.months||[]).filter(m=>yearOf(m.month)===String(year)).sort((a,b)=>a.month<b.month?-1:1); }
function clientStats(db,id){ const cd=db.data[id]; const months=cd?.months||[];
  const resp=months.flatMap(m=>m.responses); const sent=months.reduce((a,m)=>a+(m.sent||m.responses.length),0);
  const last=months.length? months.map(m=>m.month).sort().slice(-1)[0]:null;
  const m=npsOf(resp);
  return {months:months.length, resp:resp.length, sent, last, nps:m?m.nps:null, rr: sent? r1(resp.length/sent*100):null}; }

/* churn risk: cliente con NPS bajando 3 meses consecutivos y caída >= 10 pts */
function churnRisk(db,id){ const sorted=(db.data[id]?.months||[]).slice().sort((a,b)=>a.month<b.month?-1:1); if(sorted.length<3)return null; const last3=sorted.slice(-3); const series=last3.map(m=>{const x=npsOf(m.responses);return x?x.nps:null}).filter(v=>v!==null); if(series.length<3)return null; const drop=series[0]-series[2]; return(series[1]<series[0]&&series[2]<series[1]&&drop>=10)?{drop,series,months:last3.map(m=>m.month)}:null; }

/* next survey send date given frequency */
function nextSendDate(freq){ if(!freq||freq==='ninguna')return null; const now=new Date(); const d=new Date(now.getFullYear(),now.getMonth()+1,1); if(freq==='trimestral'){d.setMonth(Math.ceil((now.getMonth()+1)/3)*3);} else if(freq==='semestral'){d.setMonth(now.getMonth()<6?6:12);} else if(freq==='anual'){d.setMonth(12);d.setFullYear(now.getFullYear());} return d.toLocaleDateString('es-AR',{day:'2-digit',month:'short',year:'numeric'}); }

/* ============================ AI (Claude in Claude) ============================ */
async function callClaude(prompt, maxTokens=1200){
  // En producción la llamada pasa por la función serverless de Netlify (/api/claude),
  // que agrega la API key del lado del servidor. La key NUNCA viaja al browser.
  const res = await fetch('/api/claude',{
    method:'POST', headers:{'Content-Type':'application/json'},
    body: JSON.stringify({ model:'claude-sonnet-4-6', max_tokens:maxTokens, messages:[{role:'user',content:prompt}] })
  });
  if(!res.ok) throw new Error('API '+res.status);
  const data = await res.json();
  return (data.content||[]).filter(b=>b.type==='text').map(b=>b.text).join('\n');
}
function parseJSON(t){ if(!t) return null; let s=String(t).trim().replace(/^```json/i,'').replace(/^```/,'').replace(/```$/,'').trim();
  try{ return JSON.parse(s); }catch(e){ const m=s.match(/[\[{][\s\S]*[\]}]/); if(m){ try{ return JSON.parse(m[0]); }catch(e2){} } return null; } }

function ctxText(c){
  const prod=(c?.productos||[]).filter(Boolean);
  return `Empresa: ${c?.name||'s/d'}. Sector: ${c?.sector||'s/d'}.
Descripción: ${c?.contexto||'s/d'}.
Productos/servicios: ${prod.length?prod.join(' · '):'s/d'}.
Propuesta de valor: ${c?.propuesta||'s/d'}.
Segmentos B2B: ${(c?.segmentos||[]).join(', ')||'s/d'}.`;
}
function diagText(m, segs){
  const seg = segs.map(s=>`${s.name}: NPS ${s.nps} (n=${s.n})`).join(' · ');
  return `NPS global: ${m.nps} (${bandName(npsBand(m.nps))}). Promotores ${m.proP}% · Pasivos ${m.pasP}% · Detractores ${m.detP}%. Base: ${m.n} respuestas. Score promedio 0-10: ${m.avg}.
NPS por segmento: ${seg||'s/d'}.`;
}

/* ============================ STYLE INJECTION ============================ */
function GlobalStyle(){
  useEffect(()=>{
    const id='promotia-fonts';
    if(!document.getElementById(id)){
      const l=document.createElement('link'); l.id=id; l.rel='stylesheet';
      l.href='https://fonts.googleapis.com/css2?family=Quicksand:wght@400;500;600;700&family=Archivo:wght@400;500;600;700&display=swap';
      document.head.appendChild(l);
    }
  },[]);
  return <style>{`
    .promotia *{box-sizing:border-box}
    .promotia{font-family:${BODY};color:${C.tx};-webkit-font-smoothing:antialiased}
    .promotia h1,.promotia h2,.promotia h3,.promotia .disp{font-family:${DISP};letter-spacing:-.02em}
    .promotia ::-webkit-scrollbar{width:10px;height:10px}
    .promotia ::-webkit-scrollbar-thumb{background:${C.line};border-radius:20px;border:3px solid #fff}
    .promotia ::-webkit-scrollbar-thumb:hover{background:${C.tx3}}
    @keyframes fu{from{opacity:0;transform:translateY(10px)}to{opacity:1;transform:none}}
    @keyframes spin{to{transform:rotate(360deg)}}
    .fu{animation:fu .45s cubic-bezier(.2,.7,.3,1) both}
    .promotia button{font-family:inherit}
    .promotia input,.promotia textarea,.promotia select{font-family:inherit}
    .promotia input:focus,.promotia textarea:focus,.promotia select:focus{outline:none;border-color:${C.primary}!important;box-shadow:0 0 0 3px ${C.lila3}}
    .lift{transition:transform .15s ease, box-shadow .15s ease}
    .lift:hover{transform:translateY(-2px);box-shadow:0 12px 28px -12px rgba(115,1,123,.35)}
    .promotia a{color:${C.primary}}
    @media print{
      .promotia aside, .promotia header, .promotia button, .promotia .no-print{display:none!important}
      .promotia main{padding:0!important}
      body{background:#fff!important}
      .promotia{font-size:12px}
    }
  `}</style>;
}

/* ============================ ISOLOGO ============================ */
function Mark({size=34}){
  return (
    <svg width={size} height={size} viewBox="0 0 48 48" fill="none" aria-label="PromotIA">
      <defs>
        <linearGradient id="pg" x1="0" y1="48" x2="48" y2="0">
          <stop offset="0" stopColor="#52015A"/><stop offset="0.5" stopColor="#A8108F"/><stop offset="1" stopColor="#E40993"/>
        </linearGradient>
      </defs>
      <rect x="1.5" y="1.5" width="45" height="45" rx="13" fill="url(#pg)"/>
      {/* speech/heart promoter mark */}
      <path d="M14 16h20a3 3 0 0 1 3 3v9a3 3 0 0 1-3 3H22l-6 5v-5h-2a3 3 0 0 1-3-3v-9a3 3 0 0 1 3-3Z" fill="#fff" opacity=".94"/>
      <path d="M24 28.5l-4.2-4c-1.2-1.15-1.1-3 .2-3.9 1.05-.72 2.45-.45 3.25.5l.75.9.75-.9c.8-.95 2.2-1.22 3.25-.5 1.3.9 1.4 2.75.2 3.9L24 28.5Z" fill="#E40993"/>
    </svg>
  );
}
function Wordmark({size=20, sub=true, light=false}){
  return (
    <div style={{display:'flex',alignItems:'center',gap:10}}>
      <Mark size={size*1.7}/>
      <div style={{lineHeight:1}}>
        <div className="disp" style={{fontWeight:700,fontSize:size,color:light?'#fff':C.tx}}>
          Promot<span style={{color:light?'#F46BC2':C.magenta}}>IA</span>
        </div>
        {sub && <div style={{fontSize:size*0.42,color:light?'rgba(255,255,255,.8)':C.tx3,fontWeight:600,letterSpacing:.3,marginTop:2}}>NPS B2B · by Delenio People</div>}
      </div>
    </div>
  );
}

/* ============================ UI ATOMS ============================ */
function Card({children,style,className=''}){ return <div className={'lift '+className} style={{background:'#fff',border:`1px solid ${C.line}`,borderRadius:18,boxShadow:'0 1px 2px rgba(26,10,28,.04)',...style}}>{children}</div>; }
function Section({title,hint,icon:Icon,right,style}){ return (
  <div style={{display:'flex',alignItems:'center',gap:10,margin:'26px 0 14px',...style}}>
    {Icon && <span style={{display:'grid',placeItems:'center',width:30,height:30,borderRadius:9,background:C.lila3,color:C.primary}}><Icon size={16}/></span>}
    <div>
      <h2 style={{fontSize:18,fontWeight:700,margin:0}}>{title}</h2>
      {hint && <div style={{fontSize:12.5,color:C.tx3,marginTop:2}}>{hint}</div>}
    </div>
    {right && <div style={{marginLeft:'auto'}}>{right}</div>}
  </div>
); }
function Pill({band,children,small}){ return <span style={{display:'inline-flex',alignItems:'center',gap:5,background:bandBg(band),color:bandCol(band),fontWeight:700,fontSize:small?10.5:11.5,padding:small?'2px 8px':'3px 10px',borderRadius:20}}>{children||bandName(band)}</span>; }
function Tag({children,tone='neutral',style}){ const t={neutral:[C.surface,C.tx2],brand:[C.lila3,C.primary],warn:[C.mejorarBg,C.mejorar],bad:[C.criticoBg,C.critico],good:[C.excBg,C.exc]}[tone]; return <span style={{background:t[0],color:t[1],fontWeight:600,fontSize:11,padding:'3px 9px',borderRadius:8,...style}}>{children}</span>; }
function Btn({children,onClick,variant='primary',size='md',icon:Icon,disabled,style}){
  const base={display:'inline-flex',alignItems:'center',justifyContent:'center',gap:7,fontWeight:700,borderRadius:11,cursor:disabled?'not-allowed':'pointer',border:'1px solid transparent',transition:'all .15s',opacity:disabled?.55:1,whiteSpace:'nowrap'};
  const sz={sm:{fontSize:12.5,padding:'7px 12px'},md:{fontSize:13.5,padding:'10px 16px'},lg:{fontSize:15,padding:'13px 22px'}}[size];
  const v={
    primary:{background:C.grad,color:'#fff',boxShadow:'0 8px 18px -8px rgba(115,1,123,.6)'},
    ghost:{background:'#fff',color:C.tx2,border:`1px solid ${C.line}`},
    soft:{background:C.lila3,color:C.primary},
    danger:{background:C.criticoBg,color:C.critico,border:`1px solid ${C.critico}33`},
    dark:{background:C.tx,color:'#fff'},
  }[variant];
  return <button onClick={disabled?undefined:onClick} style={{...base,...sz,...v,...style}}>{Icon&&<Icon size={size==='sm'?15:17}/>}{children}</button>;
}
function IconBtn({icon:Icon,onClick,tone,title}){ const col=tone==='danger'?C.critico:C.tx2; return <button title={title} onClick={onClick} style={{display:'grid',placeItems:'center',width:32,height:32,borderRadius:9,background:'#fff',border:`1px solid ${C.line}`,color:col,cursor:'pointer'}}><Icon size={15}/></button>; }
function Field({label,children,hint}){ return <label style={{display:'block',marginBottom:14}}><div style={{fontSize:12,fontWeight:700,color:C.tx2,marginBottom:6}}>{label}</div>{children}{hint&&<div style={{fontSize:11,color:C.tx3,marginTop:4}}>{hint}</div>}</label>; }
const inputCss = {width:'100%',background:'#fff',border:`1px solid ${C.line}`,borderRadius:11,padding:'10px 13px',fontSize:13.5,color:C.tx};
function Input(p){ return <input {...p} style={{...inputCss,...(p.style||{})}}/>; }
const SECTOR_GROUPS = [
  { label: 'Tecnología', options: ['SaaS / Software B2B','SaaS / Software B2C','Desarrollo de software a medida','IT Services / Outsourcing tecnológico','Ciberseguridad','Inteligencia Artificial / Data','E-commerce / Marketplace','Telecomunicaciones'] },
  { label: 'Servicios profesionales', options: ['Consultoría de gestión / Management','Consultoría de Recursos Humanos','Consultoría legal / Estudio jurídico','Consultoría contable / Auditoría','Agencia de marketing / Publicidad','Diseño / Branding / UX','Capacitación y formación corporativa','Headhunting / Selección de personal'] },
  { label: 'Finanzas', options: ['Banco / Entidad financiera','Fintech / Pagos digitales','Seguros / Aseguradoras','Inversiones / Asset management','Leasing / Factoring'] },
  { label: 'Salud', options: ['Laboratorio farmacéutico','Clínica / Sanatorio / Prepaga','Dispositivos médicos','Salud digital / Telemedicina','Bienestar y salud corporativa'] },
  { label: 'Industria y manufactura', options: ['Industria metalmecánica','Industria química / Petroquímica','Industria plástica / Embalaje','Industria alimentaria','Industria textil / Indumentaria','Industria electrónica / Electromecánica','Industria automotriz / Autopartes'] },
  { label: 'Logística y distribución', options: ['Logística y distribución B2B','Transporte de cargas','Courier / Última milla','Almacenamiento / Depósito / WMS','Supply chain / Importación-exportación'] },
  { label: 'Construcción y real estate', options: ['Constructora / Desarrolladora inmobiliaria','Arquitectura e ingeniería','Materiales de construcción','Facilities management'] },
  { label: 'Consumo y retail', options: ['Retail / Cadena de tiendas','Supermercados / Hipermercados','Consumo masivo / FMCG','Moda / Calzado / Accesorios','Electrónica de consumo'] },
  { label: 'Energía y medioambiente', options: ['Oil & Gas / Petróleo','Energías renovables / Solar / Eólica','Utilities / Agua / Gas / Electricidad','Gestión ambiental / Reciclaje','Minería'] },
  { label: 'Agro', options: ['Agro / Agroquímica','Agroindustria / Frigoríficos','Maquinaria agrícola','Semillas / Biotecnología agraria'] },
  { label: 'Educación', options: ['Universidad / Instituto terciario','Escuela / Colegio privado','EdTech / Plataforma educativa','Capacitación ejecutiva / MBA'] },
  { label: 'Medios y entretenimiento', options: ['Medios de comunicación / Editorial','Publicidad / Medios digitales','Entretenimiento / Gaming / Streaming','Eventos / MICE'] },
  { label: 'Turismo y hospitalidad', options: ['Hotel / Cadena hotelera','Agencia de viajes / OTA','Gastronomía / Restaurantes / Catering','Turismo corporativo'] },
  { label: 'Gobierno y tercer sector', options: ['Organismo público / Estado','ONG / Fundación','Asociación / Cámara empresarial'] },
  { label: 'Otro', options: ['Otro'] },
];
function SectorSelect({value,onChange}){
  return <select value={value} onChange={e=>onChange(e.target.value)} style={{...inputCss,paddingRight:30}}>
    <option value="">— Seleccioná un sector —</option>
    {SECTOR_GROUPS.map(g=><optgroup key={g.label} label={g.label}>{g.options.map(o=><option key={o} value={o}>{o}</option>)}</optgroup>)}
  </select>;
}
function PasswordInput({value,onChange,placeholder}){
  const [show,setShow]=useState(false);
  return <div style={{position:'relative'}}>
    <Input type={show?'text':'password'} value={value} onChange={onChange} placeholder={placeholder||'••••••••'} style={{paddingRight:40}}/>
    <button type="button" onClick={()=>setShow(v=>!v)} style={{position:'absolute',right:10,top:'50%',transform:'translateY(-50%)',background:'none',border:'none',cursor:'pointer',color:C.tx3,padding:0,display:'flex',alignItems:'center'}}>
      {show?<svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"/><line x1="1" y1="1" x2="23" y2="23"/></svg>:<svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>}
    </button>
  </div>;
}
function Textarea(p){ return <textarea {...p} style={{...inputCss,minHeight:90,resize:'vertical',lineHeight:1.5,...(p.style||{})}}/>; }
function Select({value,onChange,children,style}){ return <select value={value} onChange={onChange} style={{...inputCss,appearance:'none',cursor:'pointer',backgroundImage:`url("data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='16' height='16' fill='none' stroke='%23A99BB0' stroke-width='2'><path d='M4 6l4 4 4-4'/></svg>")`,backgroundRepeat:'no-repeat',backgroundPosition:'right 12px center',paddingRight:34,...style}}>{children}</select>; }
function Modal({open,onClose,title,children,width=560,icon:Icon}){
  if(!open) return null;
  return (
    <div onClick={onClose} style={{position:'fixed',inset:0,zIndex:60,background:'rgba(26,10,28,.42)',backdropFilter:'blur(3px)',display:'grid',placeItems:'center',padding:20}}>
      <div className="fu" onClick={e=>e.stopPropagation()} style={{background:'#fff',borderRadius:20,width:'100%',maxWidth:width,maxHeight:'88vh',overflow:'auto',boxShadow:'0 30px 70px -20px rgba(115,1,123,.5)'}}>
        <div style={{position:'sticky',top:0,background:'#fff',display:'flex',alignItems:'center',gap:10,padding:'18px 22px',borderBottom:`1px solid ${C.line}`,zIndex:2}}>
          {Icon&&<span style={{display:'grid',placeItems:'center',width:32,height:32,borderRadius:9,background:C.lila3,color:C.primary}}><Icon size={17}/></span>}
          <h3 style={{margin:0,fontSize:17,fontWeight:700}}>{title}</h3>
          <button onClick={onClose} style={{marginLeft:'auto',width:32,height:32,borderRadius:9,border:`1px solid ${C.line}`,background:'#fff',cursor:'pointer',display:'grid',placeItems:'center',color:C.tx2}}><X size={16}/></button>
        </div>
        <div style={{padding:22}}>{children}</div>
      </div>
    </div>
  );
}
function Spinner({size=16,color='#fff'}){ return <span style={{display:'inline-block',width:size,height:size,border:`2px solid ${color}55`,borderTopColor:color,borderRadius:'50%',animation:'spin .7s linear infinite'}}/>; }
function Empty({icon:Icon,title,sub,action}){ return (
  <div style={{textAlign:'center',padding:'46px 20px',color:C.tx3}}>
    <div style={{display:'grid',placeItems:'center',width:54,height:54,borderRadius:16,background:C.surface,margin:'0 auto 14px',color:C.tx3}}>{Icon&&<Icon size={24}/>}</div>
    <div style={{fontWeight:700,color:C.tx2,fontSize:15}}>{title}</div>
    {sub&&<div style={{fontSize:13,marginTop:4,maxWidth:380,marginLeft:'auto',marginRight:'auto'}}>{sub}</div>}
    {action&&<div style={{marginTop:16}}>{action}</div>}
  </div>
); }
function Kpi({title,value,suffix,delta,sub,icon:Icon,tone='brand'}){
  const grad = tone==='ink'?'linear-gradient(125deg,#1A0A1C,#3a2440)':C.gradHero;
  return (
    <div className="lift" style={{position:'relative',overflow:'hidden',borderRadius:18,padding:'18px 18px 16px',background:grad,color:'#fff',boxShadow:'0 14px 30px -16px rgba(115,1,123,.55)'}}>
      <div style={{position:'absolute',right:-22,top:-22,width:96,height:96,borderRadius:'50%',background:'rgba(255,255,255,.12)'}}/>
      <div style={{display:'flex',alignItems:'center',gap:8,fontSize:12.5,fontWeight:600,opacity:.92}}>{Icon&&<Icon size={15}/>}{title}</div>
      <div style={{display:'flex',alignItems:'flex-end',gap:6,marginTop:10}}>
        <div className="disp" style={{fontSize:34,fontWeight:700,lineHeight:1}}>{value}{suffix&&<span style={{fontSize:18,opacity:.85}}>{suffix}</span>}</div>
        {delta!=null && <span style={{display:'inline-flex',alignItems:'center',gap:2,fontSize:12,fontWeight:700,marginBottom:5,background:'rgba(255,255,255,.18)',padding:'2px 7px',borderRadius:20}}>{delta>=0?<TrendingUp size={12}/>:<TrendingDown size={12}/>}{delta>=0?'+':''}{delta}</span>}
      </div>
      {sub && <div style={{fontSize:11.5,opacity:.85,marginTop:7}}>{sub}</div>}
    </div>
  );
}

/* NPS GAUGE — semicircular -100..+100 */
function NpsGauge({score, n}){
  if(score==null) return <div style={{color:C.tx3,fontSize:13}}>Sin datos.</div>;
  const b=npsBand(score); const col=bandCol(b);
  const frac=(score+100)/200; const ang=-90 + frac*180; const R=84, cx=110, cy=104;
  const a0=Math.PI, a1=0; // 180deg arc
  const pt=(a,r)=>[cx+r*Math.cos(a), cy-r*Math.sin(a)];
  const arc=(from,to,r)=>{ const [x0,y0]=pt(from,r),[x1,y1]=pt(to,r); const large=(to-from)>Math.PI?1:0; return `M${x0} ${y0} A${r} ${r} 0 ${large} 1 ${x1} ${y1}`; };
  const needle=pt((ang)*Math.PI/180+0, 0); // not used
  const nA=(180 - frac*180)*Math.PI/180;
  const [nx,ny]=pt(nA,R-6);
  return (
    <div style={{textAlign:'center'}}>
      <svg width="220" height="124" viewBox="0 0 220 124">
        <path d={arc(a0,a1,R)} fill="none" stroke={C.line2} strokeWidth="16" strokeLinecap="round"/>
        <path d={arc(a0, a0-(frac*Math.PI), R)} fill="none" stroke={col} strokeWidth="16" strokeLinecap="round"/>
        <line x1={cx} y1={cy} x2={nx} y2={ny} stroke={C.tx} strokeWidth="3" strokeLinecap="round"/>
        <circle cx={cx} cy={cy} r="6" fill={C.tx}/>
        <text x="26" y="120" fontSize="10" fill={C.tx3}>-100</text>
        <text x="180" y="120" fontSize="10" fill={C.tx3}>+100</text>
      </svg>
      <div style={{marginTop:-8}}>
        <div className="disp" style={{fontSize:42,fontWeight:700,lineHeight:1,color:col}}>{score>0?'+':''}{score}</div>
        <div style={{marginTop:6}}><Pill band={b}/></div>
        <div style={{fontSize:11.5,color:C.tx3,marginTop:6}}>{n} respuestas</div>
      </div>
    </div>
  );
}

/* NPS distribution bar */
function NpsDist({m}){
  if(!m) return null;
  const segs=[['Detractores',m.detP,C.detractor,ThumbsDown],['Pasivos',m.pasP,C.pasivo,Minus],['Promotores',m.proP,C.promotor,ThumbsUp]];
  return <div>
    <div style={{display:'flex',height:14,borderRadius:20,overflow:'hidden'}}>
      {segs.map(([n,p,c])=> p>0 && <div key={n} title={`${n}: ${p}%`} style={{width:p+'%',background:c}}/>)}
    </div>
    <div style={{display:'flex',gap:16,marginTop:11,flexWrap:'wrap'}}>
      {segs.map(([n,p,c,Ic])=> <span key={n} style={{display:'inline-flex',alignItems:'center',gap:6,fontSize:12,color:C.tx2}}><span style={{display:'grid',placeItems:'center',width:18,height:18,borderRadius:6,background:c+'22',color:c}}><Ic size={11}/></span>{n} <b style={{color:C.tx}}>{p}%</b></span>)}
    </div>
  </div>;
}

function SegBar({label,nps,n}){
  const b=npsBand(nps); const frac=(nps+100)/200;
  return <div style={{padding:'9px 4px'}}>
    <div style={{display:'flex',alignItems:'center',gap:8,marginBottom:6}}>
      <span style={{fontSize:13,fontWeight:600,color:C.tx,flex:1}}>{label}</span>
      <span style={{fontSize:10.5,color:C.tx3}}>{n} resp.</span>
      <span style={{fontSize:13,fontWeight:700,color:bandCol(b)}}>{nps>0?'+':''}{nps}</span>
    </div>
    <div style={{position:'relative',height:8,borderRadius:20,background:C.line2,overflow:'hidden'}}>
      <div style={{position:'absolute',left:'50%',top:0,bottom:0,width:1,background:C.tx3,opacity:.4}}/>
      <div style={{height:'100%',width:Math.abs(frac-0.5)*100+'%',marginLeft:nps>=0?'50%':(frac*100)+'%',borderRadius:20,background:`linear-gradient(90deg,${bandCol(b)}cc,${bandCol(b)})`,transition:'width .6s'}}/>
    </div>
  </div>;
}

function Tip({active,payload,label}){ if(!active||!payload||!payload.length) return null; return (
  <div style={{background:'#fff',border:`1px solid ${C.line}`,borderRadius:12,padding:'9px 12px',boxShadow:'0 8px 24px -8px rgba(115,1,123,.3)',fontSize:12}}>
    <div style={{fontWeight:700,marginBottom:4,color:C.tx}}>{label}</div>
    {payload.map((p,i)=> p.value!=null && <div key={i} style={{display:'flex',alignItems:'center',gap:6,color:C.tx2}}><span style={{width:9,height:9,borderRadius:3,background:p.color||p.stroke}}/>{p.name}: <b>{p.value>0&&p.name==='NPS'?'+':''}{p.value}</b></div>)}
  </div>
); }
function AILoader({text='Analizando con IA…'}){ return (
  <div style={{display:'flex',alignItems:'center',gap:12,padding:'20px 18px',background:C.surface,borderRadius:16}}>
    <Spinner size={18} color={C.primary}/>
    <div><div style={{fontWeight:700,color:C.tx}}>{text}</div><div style={{fontSize:12,color:C.tx3}}>Cruzando NPS, comentarios y tu contexto.</div></div>
  </div>
); }
function AIErr({onRetry}){ return <div style={{display:'flex',alignItems:'center',gap:10,padding:'12px 14px',background:C.criticoBg,color:C.critico,borderRadius:12,fontSize:13}}><AlertTriangle size={16}/> No se pudo generar. {onRetry&&<button onClick={onRetry} style={{marginLeft:'auto',background:'#fff',border:`1px solid ${C.critico}44`,color:C.critico,borderRadius:8,padding:'5px 10px',fontWeight:700,cursor:'pointer'}}>Reintentar</button>}</div>; }

/* shared */
function YearTabs({years,year,setYear}){ if(years.length<2) return null; return (
  <div style={{display:'inline-flex',background:C.surface,borderRadius:11,padding:3,gap:3}}>
    {years.map(y=> <button key={y} onClick={()=>setYear(y)} style={{padding:'6px 14px',borderRadius:8,border:'none',cursor:'pointer',fontWeight:700,fontSize:12.5,background:String(year)===String(y)?'#fff':'transparent',color:String(year)===String(y)?C.primary:C.tx3,boxShadow:String(year)===String(y)?'0 1px 3px rgba(0,0,0,.08)':'none'}}>{y}</button>)}
  </div>
); }

/* ============================================================ ADMIN: CLIENTES ============================================================ */
function CopyLinkBtn({clientId}){
  const [copied,setCopied]=useState(false);
  const copy=()=>{ navigator.clipboard.writeText(`${window.location.origin}/encuesta/${clientId}`); setCopied(true); setTimeout(()=>setCopied(false),2000); };
  return <button onClick={copy} title="Copiar link de encuesta" style={{display:'flex',alignItems:'center',gap:5,padding:'6px 10px',borderRadius:8,border:`1px solid ${copied?C.exc:C.line}`,background:copied?C.excBg:'#fff',color:copied?C.exc:C.tx2,fontSize:12,fontWeight:600,cursor:'pointer',transition:'all .2s',whiteSpace:'nowrap'}}>
    {copied?<Check size={13}/>:<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/></svg>}
    {copied?'¡Copiado!':'Link encuesta'}
  </button>;
}

/* ---- QR Modal ---- */
function QRModal({url,name,onClose}){
  const canvasRef=useRef(null);
  useEffect(()=>{
    import('qrcode').then(QR=>{
      QR.toCanvas(canvasRef.current,url,{width:220,margin:2,color:{dark:'#1A0A1C',light:'#FFFFFF'}});
    }).catch(()=>{});
  },[url]);
  function download(){
    const a=document.createElement('a'); a.href=canvasRef.current.toDataURL('image/png'); a.download=`qr-${name||'encuesta'}.png`; a.click();
  }
  return <div style={{position:'fixed',inset:0,background:'rgba(26,10,28,.55)',backdropFilter:'blur(4px)',display:'grid',placeItems:'center',zIndex:9999}} onClick={onClose}>
    <div style={{background:'#fff',borderRadius:20,padding:'28px 24px',maxWidth:300,width:'90%',textAlign:'center'}} onClick={e=>e.stopPropagation()}>
      <div style={{fontFamily:DISP,fontWeight:700,fontSize:16,color:C.tx,marginBottom:4}}>QR de encuesta</div>
      <div style={{fontSize:12.5,color:C.tx3,marginBottom:16}}>{name}</div>
      <canvas ref={canvasRef} style={{borderRadius:12,border:`1px solid ${C.line}`}}/>
      <div style={{display:'flex',gap:8,marginTop:16,justifyContent:'center'}}>
        <button onClick={download} style={{display:'flex',alignItems:'center',gap:5,padding:'8px 14px',borderRadius:9,border:`1px solid ${C.line}`,background:C.surface,color:C.primary,fontSize:13,fontWeight:700,cursor:'pointer',fontFamily:DISP}}><Download size={14}/>Descargar PNG</button>
        <button onClick={onClose} style={{padding:'8px 14px',borderRadius:9,border:`1px solid ${C.line}`,background:'#fff',color:C.tx2,fontSize:13,fontWeight:600,cursor:'pointer',fontFamily:DISP}}>Cerrar</button>
      </div>
    </div>
  </div>;
}

/* ---- Realtime hook: escucha survey_responses y las agrega automáticamente ---- */
function useRealtimeSurvey(update, onNewDetractor){
  useEffect(()=>{
    const channel=supabase.channel('survey_rt')
      .on('postgres_changes',{event:'INSERT',schema:'public',table:'survey_responses'},({new:r})=>{
        const d=new Date(r.created_at);
        const mKey=`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}`;
        const row={e:r.score};
        if(r.comment)row.c=r.comment;
        const dims={}; if(r.segmento)dims.Segmento=r.segmento; if(r.sector)dims.Sector=r.sector; if(r.region)dims['Región']=r.region;
        if(Object.keys(dims).length)row.d=dims;
        update(db=>{ if(!db.data[r.client_id])return; const cc=db.data[r.client_id]; if(!cc.months)cc.months=[]; let mo=cc.months.find(m=>m.month===mKey); if(mo){mo.responses.push(row); mo.sent=(mo.sent||0)+1;} else {cc.months.push({month:mKey,sent:1,responses:[row]});} });
        if(r.score<=6 && onNewDetractor) onNewDetractor(r);
      })
      .subscribe();
    return ()=>{ supabase.removeChannel(channel); };
  },[]);
}

const PLAN_META = {
  start:  { name: 'Start',  color: '#5E4E64', bg: '#F7F2FA' },
  growth: { name: 'Growth', color: '#73017B', bg: '#EFD9F1' },
  scale:  { name: 'Scale',  color: '#0c01a4', bg: '#E8E7F8' },
};
const PLAN_STATUS_LABEL = { active: 'Activo', trialing: 'Trial', past_due: 'Pago pendiente', canceled: 'Cancelado', unpaid: 'Impago' };
const PLAN_STATUS_COLOR = { active: C.exc, trialing: C.primary, past_due: '#E8A23D', canceled: C.critico, unpaid: C.critico };

function PlanBadge({ planId, status }) {
  const meta = PLAN_META[planId] || PLAN_META.start;
  const statusLabel = PLAN_STATUS_LABEL[status] || status || 'Activo';
  const statusColor = PLAN_STATUS_COLOR[status] || C.exc;
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 10, padding: '7px 10px', background: meta.bg, borderRadius: 9 }}>
      <span style={{ fontFamily: DISP, fontWeight: 700, fontSize: 12, color: meta.color }}>SUSCRIPCIÓN</span>
      <span style={{ background: meta.color, color: '#fff', borderRadius: 6, padding: '2px 8px', fontFamily: DISP, fontWeight: 700, fontSize: 11 }}>{meta.name}</span>
      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 11.5, color: statusColor, fontWeight: 600 }}>
        <span style={{ width: 6, height: 6, borderRadius: '50%', background: statusColor }} />{statusLabel}
      </span>
      <span style={{ fontSize: 11, color: C.tx3, marginLeft: 'auto' }}>Plan desde Stripe</span>
    </div>
  );
}

function StripePortalBtn({ customerId }) {
  const [loading, setLoading] = useState(false);
  const open = async () => {
    setLoading(true);
    try {
      const r = await fetch('/api/stripe-portal', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ stripeCustomerId: customerId }) });
      const d = await r.json();
      if (d.url) window.open(d.url, '_blank');
    } catch (e) { alert('Error al abrir portal de Stripe') }
    setLoading(false);
  };
  return (
    <button onClick={open} disabled={loading} title="Gestionar suscripción en Stripe" style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '6px 10px', borderRadius: 8, border: `1px solid ${C.line}`, background: '#fff', color: C.tx2, fontSize: 12, fontWeight: 600, cursor: loading ? 'wait' : 'pointer', whiteSpace: 'nowrap' }}>
      {loading ? <Spinner size={12} /> : <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="1" y="4" width="22" height="16" rx="2"/><line x1="1" y1="10" x2="23" y2="10"/></svg>}
      Gestionar plan
    </button>
  );
}

function AdminClientes({db,update,goClient}){
  const [edit,setEdit]=useState(null); const [del,setDel]=useState(null); const [qr,setQr]=useState(null);
  const blank={id:'',name:'',code:'',web:'',sector:'',contexto:'',productos:[''],propuesta:'',segmentos:[...SEGMENTOS],notas:'',surveyTitle:'',surveyColor:'#73017B',surveyLogo:'',surveyQuestion:'¿Qué tan probable es que nos recomiendes?',surveyFrequency:'ninguna',contactEmails:'',npsTarget:'',npsTargetLabel:''};
  const save=async()=>{ const c={...edit, productos:(edit.productos||[]).map(s=>s.trim()).filter(Boolean)}; if(!c.name.trim())return;
    if(!c.id){ c.id=uid('c'); if(!c.code) c.code=c.name.slice(0,3).toUpperCase()+'-'+Math.random().toString(36).slice(2,5).toUpperCase(); }
    update(d=>{ const i=d.clients.findIndex(x=>x.id===c.id); if(i>=0){ d.clients[i]={...c}; } else { d.clients.push({...c}); if(!d.data[c.id]) d.data[c.id]={months:[]}; } });
    storage.syncClient(c).catch(()=>{});
    fetch('/api/survey-config',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({clientId:c.id,title:c.surveyTitle,primaryColor:c.surveyColor,logoUrl:c.surveyLogo,question:c.surveyQuestion})});
    setEdit(null); };
  const setProd=(i,v)=>setEdit(e=>{ const p=[...(e.productos||[])]; p[i]=v; return {...e,productos:p}; });
  const [searchQ,setSearchQ]=useState('');
  const clientesFiltrados=searchQ?db.clients.filter(c=>c.name.toLowerCase().includes(searchQ.toLowerCase())):db.clients;
  return <div>
    <Section title="Clientes" hint={`${db.clients.length} empresas · cuentas, contexto comercial y catálogo`} icon={Building2}
      right={<Btn icon={Plus} onClick={()=>setEdit({...blank})}>Nuevo cliente</Btn>}/>
    <input value={searchQ} onChange={e=>setSearchQ(e.target.value)} placeholder="Buscar cliente…"
      style={{width:'100%',padding:'9px 14px',borderRadius:10,border:`1px solid ${C.line}`,fontSize:13.5,color:C.tx,background:C.surface,outline:'none',marginBottom:14,boxSizing:'border-box'}}/>
    <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fill,minmax(330px,1fr))',gap:14}}>
      {clientesFiltrados.map(c=>{ const s=clientStats(db,c.id); const b=npsBand(s.nps); const cr=churnRisk(db,c.id); const nextSend=nextSendDate(c.surveyFrequency); return (
        <Card key={c.id} className="fu" style={{padding:18, border:cr?`1.5px solid ${C.critico}44`:''}}>
          <div style={{display:'flex',alignItems:'flex-start',gap:10}}>
            <div style={{display:'grid',placeItems:'center',width:42,height:42,borderRadius:12,background:C.grad,color:'#fff',fontWeight:700,fontFamily:DISP,fontSize:18}}>{c.name[0]}</div>
            <div style={{flex:1,minWidth:0}}>
              <div style={{fontWeight:700,fontSize:15.5}} className="disp">{c.name}</div>
              <div style={{fontSize:11.5,color:C.tx3}}>{c.code}{c.sector?` · ${c.sector}`:''}</div>
            </div>
            <IconBtn icon={Pencil} title="Editar" onClick={()=>setEdit({...c,productos:c.productos?.length?c.productos:['']})}/>
            <IconBtn icon={Trash2} title="Eliminar" tone="danger" onClick={()=>setDel(c)}/>
          </div>
          {c.contexto&&<div style={{fontSize:12.5,color:C.tx2,marginTop:11,lineHeight:1.5,display:'-webkit-box',WebkitLineClamp:2,WebkitBoxOrient:'vertical',overflow:'hidden'}}>{c.contexto}</div>}
          {cr&&<div style={{display:'flex',alignItems:'center',gap:6,background:C.criticoBg,color:C.critico,borderRadius:9,padding:'7px 10px',marginTop:10,fontSize:12.5,fontWeight:700}}><AlertTriangle size={13}/>NPS cayó {cr.drop} pts en 3 meses — posible riesgo de churn</div>}
          {c.planId&&<PlanBadge planId={c.planId} status={c.planStatus}/>}
          <div style={{display:'flex',gap:6,flexWrap:'wrap',marginTop:12}}>
            <Tag tone="brand">{s.months} meses</Tag><Tag>{s.resp} respuestas</Tag>
            {s.nps!=null&&<Tag tone={b==='exc'||b==='bueno'?'good':b==='mejorar'?'warn':'bad'}>NPS {s.nps>0?'+':''}{s.nps}</Tag>}
            {nextSend&&<Tag tone="neutral"><Clock size={10} style={{marginRight:3,verticalAlign:'-1px'}}/>Próx. encuesta: {nextSend}</Tag>}
          </div>
          <div style={{display:'flex',gap:8,marginTop:14}}>
            <Btn size="sm" variant="soft" icon={Eye} onClick={()=>goClient(c.id)} style={{flex:1}}>Ver portal</Btn>
            <CopyLinkBtn clientId={c.id}/>
            <a href={`https://wa.me/?text=${encodeURIComponent(`Hola! Te comparto el link de la encuesta NPS de ${c.name}: ${window.location.origin}/encuesta/${c.id}`)}`} target="_blank" rel="noreferrer"
              title="Compartir por WhatsApp" style={{display:'inline-flex',alignItems:'center',justifyContent:'center',width:32,height:32,borderRadius:8,border:`1px solid ${C.line}`,background:'#E7F7E7',color:'#128C7E',textDecoration:'none',fontSize:14,flexShrink:0}}>💬</a>
            {c.stripeCustomerId&&<StripePortalBtn customerId={c.stripeCustomerId}/>}
            <IconBtn icon={QrCode} title="Ver QR" onClick={()=>setQr(c)}/>
          </div>
        </Card>
      ); })}
    </div>

    <Modal open={!!edit} onClose={()=>setEdit(null)} title={edit?.id?'Editar cliente':'Nuevo cliente'} icon={Building2} width={620}>
      {edit&&<div>
        <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:12}}>
          <Field label="Nombre de la empresa"><Input value={edit.name} onChange={e=>setEdit({...edit,name:e.target.value})} placeholder="Ej. Nimbus Logística"/></Field>
          <Field label="Código"><Input value={edit.code} onChange={e=>setEdit({...edit,code:e.target.value})} placeholder="Auto si lo dejás vacío"/></Field>
        </div>
        <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:12}}>
          <Field label="Sector"><SectorSelect value={edit.sector||''} onChange={v=>setEdit({...edit,sector:v})}/></Field>
          <Field label="Sitio web"><Input value={edit.web} onChange={e=>setEdit({...edit,web:e.target.value})} placeholder="www.empresa.com"/></Field>
        </div>
        <Field label="Descripción / contexto"><Textarea value={edit.contexto} onChange={e=>setEdit({...edit,contexto:e.target.value})} placeholder="A qué se dedica, a qué clientes B2B atiende, prioridades del CEO."/></Field>
        <Field label="Productos / servicios" hint="Alimentan el análisis de comentarios y el plan de acción con IA.">
          {(edit.productos||['']).map((p,i)=><div key={i} style={{display:'flex',gap:8,alignItems:'center',marginBottom:7}}>
            <span style={{width:6,height:6,borderRadius:'50%',background:C.magenta,flexShrink:0}}/>
            <Input value={p} onChange={e=>setProd(i,e.target.value)} placeholder={`Producto / servicio ${i+1}`} style={{padding:'8px 11px',fontSize:13}}/>
            <IconBtn icon={X} onClick={()=>setEdit(e=>({...e,productos:e.productos.filter((_,j)=>j!==i)}))}/>
          </div>)}
          <button onClick={()=>setEdit(e=>({...e,productos:[...(e.productos||[]),'']}))} style={{display:'inline-flex',alignItems:'center',gap:5,background:'none',border:'none',color:C.primary,fontWeight:700,fontSize:12.5,cursor:'pointer',padding:'4px 0'}}><Plus size={14}/>Agregar producto</button>
        </Field>
        <Field label="Propuesta de valor"><Textarea value={edit.propuesta} onChange={e=>setEdit({...edit,propuesta:e.target.value})} style={{minHeight:60}}/></Field>
        <Field label="Notas internas (Delenio)"><Textarea value={edit.notas} onChange={e=>setEdit({...edit,notas:e.target.value})} style={{minHeight:60}}/></Field>
        <div style={{borderTop:`1px solid ${C.line}`,paddingTop:16,marginTop:4}}>
          <div style={{display:'flex',alignItems:'center',gap:7,fontFamily:DISP,fontWeight:700,fontSize:13,color:C.primary,marginBottom:12}}><Settings size={14}/>Personalización de la encuesta</div>
          <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:12}}>
            <Field label="Título / nombre visible"><Input value={edit.surveyTitle||''} onChange={e=>setEdit({...edit,surveyTitle:e.target.value})} placeholder="Ej: Nimbus Logística"/></Field>
            <Field label="Color principal"><div style={{display:'flex',gap:8,alignItems:'center'}}><input type="color" value={edit.surveyColor||'#73017B'} onChange={e=>setEdit({...edit,surveyColor:e.target.value})} style={{width:38,height:38,borderRadius:8,border:`1px solid ${C.line}`,padding:2,cursor:'pointer'}}/><span style={{fontSize:12,color:C.tx3}}>{edit.surveyColor||'#73017B'}</span></div></Field>
          </div>
          <Field label="URL del logo (opcional)" hint="Link directo a una imagen (PNG/SVG)"><Input value={edit.surveyLogo||''} onChange={e=>setEdit({...edit,surveyLogo:e.target.value})} placeholder="https://..."/></Field>
          <Field label="Pregunta NPS personalizada"><Input value={edit.surveyQuestion||''} onChange={e=>setEdit({...edit,surveyQuestion:e.target.value})} placeholder="¿Qué tan probable es que nos recomiendes?"/></Field>
        </div>
        <div style={{borderTop:`1px solid ${C.line}`,paddingTop:16,marginTop:4}}>
          <div style={{display:'flex',alignItems:'center',gap:7,fontFamily:DISP,fontWeight:700,fontSize:13,color:C.primary,marginBottom:12}}><Zap size={14}/>Encuestas programadas</div>
          <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:12}}>
            <Field label="Frecuencia de envío"><Select value={edit.surveyFrequency||'ninguna'} onChange={e=>setEdit({...edit,surveyFrequency:e.target.value})}><option value="ninguna">Sin programación</option><option value="mensual">Mensual</option><option value="trimestral">Trimestral</option><option value="semestral">Semestral</option><option value="anual">Anual</option></Select></Field>
            <Field label="Emails de contacto" hint="Separados por coma"><Input value={edit.contactEmails||''} onChange={e=>setEdit({...edit,contactEmails:e.target.value})} placeholder="a@empresa.com, b@empresa.com"/></Field>
          </div>
          {(edit.surveyFrequency&&edit.surveyFrequency!=='ninguna')&&<div style={{fontSize:12,color:C.tx3,background:C.surface,borderRadius:9,padding:'8px 12px'}}>Próximo envío: {nextSendDate(edit.surveyFrequency)} · Requiere configurar RESEND_API_KEY en Vercel.</div>}
        </div>
        <div style={{borderTop:`1px solid ${C.line}`,paddingTop:16,marginTop:4}}>
          <div style={{display:'flex',alignItems:'center',gap:7,fontFamily:DISP,fontWeight:700,fontSize:13,color:C.primary,marginBottom:12}}><Flag size={14}/>Target de NPS</div>
          <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:12}}>
            <Field label="NPS objetivo" hint="Ej: 50"><Input type="number" min="-100" max="100" value={edit.npsTarget||''} onChange={e=>setEdit({...edit,npsTarget:e.target.value})} placeholder="Ej: 50"/></Field>
            <Field label="Etiqueta del período" hint="Ej: Q4 2025, Dic 2025"><Input value={edit.npsTargetLabel||''} onChange={e=>setEdit({...edit,npsTargetLabel:e.target.value})} placeholder="Ej: Q4 2025"/></Field>
          </div>
        </div>
        <div style={{display:'flex',justifyContent:'flex-end',gap:8,marginTop:6}}><Btn variant="ghost" onClick={()=>setEdit(null)}>Cancelar</Btn><Btn icon={Check} onClick={save}>Guardar</Btn></div>
      </div>}
    </Modal>

    <Modal open={!!del} onClose={()=>setDel(null)} title="Eliminar cliente" icon={Trash2} width={440}>
      {del&&<div>
        <p style={{fontSize:13.5,color:C.tx2,lineHeight:1.5,margin:'0 0 18px'}}>Vas a eliminar <b>{del.name}</b> y todas sus respuestas NPS. Esta acción no se puede deshacer.</p>
        <div style={{display:'flex',justifyContent:'flex-end',gap:8}}><Btn variant="ghost" onClick={()=>setDel(null)}>Cancelar</Btn><Btn variant="danger" icon={Trash2} onClick={()=>{const id=del.id; update(d=>{d.clients=d.clients.filter(x=>x.id!==id); delete d.data[id];}); storage.deleteClient(id).catch(()=>{}); setDel(null);}}>Eliminar</Btn></div>
      </div>}
    </Modal>
    {qr&&<QRModal url={`${window.location.origin}/encuesta/${qr.id}`} name={qr.name} onClose={()=>setQr(null)}/>}
  </div>;
}

/* ============================================================ ADMIN: CARGA NPS ============================================================ */
function AdminLinks({db,update}){
  const now=new Date();
  const [year,setYear]=useState(now.getFullYear()); const [month,setMonth]=useState(now.getMonth()+1);
  const [toast,setToast]=useState(null); const [importing,setImporting]=useState({});
  const flash=t=>{ setToast(t); setTimeout(()=>setToast(null),3200); };
  const mKey=`${year}-${String(month).padStart(2,'0')}`;

  async function importClient(c){
    setImporting(p=>({...p,[c.id]:true}));
    try{
      const r=await fetch(`/api/survey-import?clientId=${c.id}&month=${mKey}`);
      const d=await r.json();
      if(d.error){ flash({bad:true,msg:d.error}); setImporting(p=>({...p,[c.id]:false})); return; }
      if(!d.total){ flash({bad:false,msg:`Sin respuestas nuevas para ${c.name} en ${MESLONG[month]} ${year}.`}); setImporting(p=>({...p,[c.id]:false})); return; }
      update(db=>{ const cc=db.data[c.id]; if(!cc.months)cc.months=[]; let mo=cc.months.find(m=>m.month===mKey);
        if(mo){ mo.responses.push(...d.responses); mo.sent=(mo.sent||0)+d.responses.length; }
        else { cc.months.push({month:mKey,sent:d.responses.length,responses:d.responses}); }
      });
      flash({bad:false,msg:`${d.total} respuestas de ${c.name} importadas al dashboard.`});
    }catch(e){ flash({bad:true,msg:'Error al conectar.'}); }
    setImporting(p=>({...p,[c.id]:false}));
  }

  return <div>
    <Section title="Links de encuesta" hint="Cada cliente tiene su link único — los contactos responden sin crear cuenta" icon={MessageSquare}/>

    <Card style={{padding:16,marginBottom:18}}>
      <div style={{display:'flex',alignItems:'center',gap:12,flexWrap:'wrap'}}>
        <span style={{fontSize:13,fontWeight:600,color:C.tx2}}>Importar respuestas del mes:</span>
        <Select value={month} onChange={e=>setMonth(+e.target.value)} style={{width:130}}>{Array.from({length:12},(_,i)=>i+1).map(m=><option key={m} value={m}>{MESLONG[m]}</option>)}</Select>
        <Select value={year} onChange={e=>setYear(+e.target.value)} style={{width:90}}>{[2024,2025,2026].map(y=><option key={y} value={y}>{y}</option>)}</Select>
      </div>
    </Card>

    {toast&&<div className="fu" style={{display:'flex',alignItems:'center',gap:9,padding:'11px 14px',borderRadius:12,marginBottom:14,fontSize:13,fontWeight:600,background:toast.bad?C.criticoBg:C.excBg,color:toast.bad?C.critico:C.exc}}>{toast.bad?<AlertTriangle size={16}/>:<Check size={16}/>}{toast.msg}</div>}

    <div style={{display:'flex',flexDirection:'column',gap:12}}>
      {db.clients.map(c=>{
        const link=`${window.location.origin}/encuesta/${c.id}`;
        const [copied,setCopied]=useState(false);
        const copy=()=>{ navigator.clipboard.writeText(link); setCopied(true); setTimeout(()=>setCopied(false),2000); };
        const existing=db.data[c.id]?.months?.find(m=>m.month===mKey);
        return <Card key={c.id} style={{padding:18}}>
          <div style={{display:'flex',alignItems:'center',gap:12,marginBottom:12,flexWrap:'wrap'}}>
            <div style={{display:'grid',placeItems:'center',width:38,height:38,borderRadius:10,background:C.grad,color:'#fff',fontWeight:700,fontFamily:DISP,fontSize:16,flexShrink:0}}>{c.name[0]}</div>
            <div style={{flex:1,minWidth:0}}>
              <div style={{fontWeight:700,fontSize:15}} className="disp">{c.name}</div>
              <div style={{fontSize:11.5,color:C.tx3}}>{c.code}{c.sector?` · ${c.sector}`:''}</div>
            </div>
            {existing&&<Tag tone="good">{existing.responses.length} resp. {MESLONG[month]}</Tag>}
          </div>
          <div style={{display:'flex',gap:8,alignItems:'center',background:C.surface,borderRadius:10,padding:'9px 12px',flexWrap:'wrap'}}>
            <span style={{fontSize:12,color:C.tx2,flex:1,wordBreak:'break-all',minWidth:0}}>{link}</span>
            <button onClick={copy} style={{display:'flex',alignItems:'center',gap:5,padding:'5px 10px',borderRadius:7,border:`1px solid ${copied?C.exc:C.line}`,background:copied?C.excBg:'#fff',color:copied?C.exc:C.primary,fontSize:12,fontWeight:700,cursor:'pointer',transition:'all .2s',flexShrink:0}}>
              {copied?<Check size={12}/>:<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/></svg>}
              {copied?'¡Copiado!':'Copiar'}
            </button>
            <Btn size="sm" icon={importing[c.id]?RotateCcw:Download} onClick={()=>importClient(c)} disabled={!!importing[c.id]}>
              {importing[c.id]?'Importando…':`Importar ${MESLONG[month]}`}
            </Btn>
          </div>
        </Card>;
      })}
      {!db.clients.length&&<Empty icon={MessageSquare} title="Sin clientes aún" sub="Creá un cliente primero desde la sección Clientes."/>}
    </div>
  </div>;
}

/* ============================================================ ADMIN: USUARIOS ============================================================ */
function AdminUsuarios({db,update}){
  const [edit,setEdit]=useState(null); const [saving,setSaving]=useState(false); const [saveErr,setSaveErr]=useState('');
  const [sbUsers,setSbUsers]=useState(null); const [loadErr,setLoadErr]=useState('');
  const blank={id:'',name:'',email:'',password:'',role:'Cliente',clientCode:db.clients[0]?.id||''};
  const cname=code=>db.clients.find(c=>c.id===code)?.name||code||'—';

  const loadUsers=async()=>{
    setLoadErr('');
    try{
      const r=await fetch('/api/users'); const d=await r.json();
      if(!r.ok||d.error){setLoadErr(d.error||'Error al cargar usuarios');return;}
      setSbUsers(d.users||[]);
    }catch(e){setLoadErr('Error de red: '+e.message);}
  };
  useEffect(()=>{loadUsers();},[]);

  const save=async()=>{
    const u=edit; if(!u.name.trim()||!u.email.trim())return;
    setSaving(true); setSaveErr('');
    if(!u.id){
      if(!u.password||u.password.length<6){setSaveErr('La contraseña debe tener al menos 6 caracteres.');setSaving(false);return;}
      try{
        const r=await fetch('/api/users',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({name:u.name,email:u.email,password:u.password,role:u.role,clientCode:u.role==='Cliente'?u.clientCode:null})});
        const d=await r.json();
        if(!r.ok||d.error){setSaveErr(d.error||'Error al crear usuario');setSaving(false);return;}
        await loadUsers();
      }catch(e){setSaveErr('Error: '+e.message);setSaving(false);return;}
    }
    setSaving(false); setEdit(null);
  };

  const users=sbUsers||[];
  return <div>
    <Section title="Usuarios y accesos" hint={sbUsers===null?'Cargando…':`${users.length} usuarios · quién entra y a qué portal`} icon={ShieldCheck}
      right={<div style={{display:'flex',gap:8}}><IconBtn icon={RefreshCw} onClick={loadUsers} title="Recargar"/><Btn icon={Plus} onClick={()=>setEdit({...blank})}>Invitar usuario</Btn></div>}/>
    {loadErr&&<div style={{background:'#FCE7E5',color:'#E5564B',borderRadius:9,padding:'9px 12px',fontSize:13,marginBottom:8}}>{loadErr}</div>}
    <Card style={{padding:0,overflow:'hidden'}}>
      {sbUsers===null?<div style={{padding:32,textAlign:'center',color:C.tx3}}><Spinner size={20}/> Cargando usuarios…</div>:<table style={{width:'100%',borderCollapse:'collapse',fontSize:13.5}}>
        <thead><tr style={{background:C.surface,color:C.tx2,fontSize:11.5,textAlign:'left'}}>{['Usuario','Rol','Cliente asignado','Último acceso',''].map((h,i)=><th key={i} style={{padding:'12px 16px',fontWeight:700}}>{h}</th>)}</tr></thead>
        <tbody>{users.length===0?<tr><td colSpan={5} style={{padding:'24px 16px',textAlign:'center',color:C.tx3,fontSize:13}}>No hay usuarios. Invitá el primero.</td></tr>:users.map(u=> <tr key={u.id} style={{borderTop:`1px solid ${C.line}`}}>
          <td style={{padding:'12px 16px'}}><div style={{display:'flex',alignItems:'center',gap:10}}>
            <div style={{display:'grid',placeItems:'center',width:34,height:34,borderRadius:10,background:u.role==='Admin'?C.tx:C.grad,color:'#fff',fontWeight:700,fontFamily:DISP}}>{(u.name||u.email||'?')[0].toUpperCase()}</div>
            <div><div style={{fontWeight:600}}>{u.name||u.email}</div><div style={{fontSize:11.5,color:C.tx3}}>{u.email}</div></div></div></td>
          <td style={{padding:'12px 16px'}}><Tag tone={u.role==='Admin'?'neutral':'brand'} style={u.role==='Admin'?{background:'#1A0A1C11',color:C.tx}:{}}>{u.role}</Tag></td>
          <td style={{padding:'12px 16px',color:C.tx2}}>{u.role==='Admin'?'Todos':cname(u.clientCode)}</td>
          <td style={{padding:'12px 16px',color:C.tx3,fontSize:12}}>{u.lastSignIn?new Date(u.lastSignIn).toLocaleDateString('es-AR'):u.confirmed?'Nunca':'Sin confirmar'}</td>
          <td style={{padding:'12px 16px',textAlign:'right'}}></td>
        </tr>)}</tbody>
      </table>}
    </Card>
    <Modal open={!!edit} onClose={()=>setEdit(null)} title={edit?.id?'Editar usuario':'Crear usuario'} icon={ShieldCheck} width={480}>
      {edit&&<div>
        <Field label="Nombre"><Input value={edit.name} onChange={e=>setEdit({...edit,name:e.target.value})}/></Field>
        <Field label="Email"><Input value={edit.email} onChange={e=>setEdit({...edit,email:e.target.value})} placeholder="persona@empresa.com" disabled={!!edit.id}/></Field>
        {!edit.id&&<Field label="Contraseña" hint="Mínimo 6 caracteres · La compartís con el usuario"><PasswordInput value={edit.password||''} onChange={e=>setEdit({...edit,password:e.target.value})} placeholder="Ej: Empresa2025!"/></Field>}
        <Field label="Rol"><Select value={edit.role} onChange={e=>setEdit({...edit,role:e.target.value})}><option>Cliente</option><option>Admin</option></Select></Field>
        {edit.role==='Cliente'&&<Field label="Cliente asignado"><Select value={edit.clientCode} onChange={e=>setEdit({...edit,clientCode:e.target.value})}>{db.clients.map(c=><option key={c.id} value={c.id}>{c.name}</option>)}</Select></Field>}
        {saveErr&&<div style={{background:'#FCE7E5',color:'#E5564B',borderRadius:9,padding:'9px 12px',fontSize:13,marginBottom:8}}>{saveErr}</div>}
        <div style={{display:'flex',justifyContent:'flex-end',gap:8,marginTop:6}}><Btn variant="ghost" onClick={()=>setEdit(null)}>Cancelar</Btn><Btn icon={saving?undefined:Check} onClick={save} disabled={saving}>{saving?<><Spinner size={14} color="#fff"/>Creando…</>:'Guardar'}</Btn></div>
      </div>}
    </Modal>
  </div>;
}

/* ============================================================ ADMIN: USO ============================================================ */
function AdminUso({db}){
  const rows=db.clients.map(c=>({c,s:clientStats(db,c.id)}));
  const totResp=rows.reduce((a,r)=>a+r.s.resp,0);
  const totMonths=rows.reduce((a,r)=>a+r.s.months,0);
  const activeUsers=db.users.filter(u=>u.status==='Activo').length;
  const chart=rows.map(r=>({name:r.c.name.split(' ')[0],NPS:r.s.nps}));
  const churns=db.clients.filter(c=>churnRisk(db,c.id));
  return <div>
    <Section title="Uso de la plataforma" hint="Actividad y NPS de cada cliente" icon={Activity}/>
    {churns.length>0&&<div style={{background:C.criticoBg,border:`1px solid ${C.critico}33`,borderRadius:14,padding:'14px 18px',marginBottom:16}}>
      <div style={{display:'flex',alignItems:'center',gap:8,fontFamily:DISP,fontWeight:700,fontSize:14,color:C.critico,marginBottom:8}}><AlertTriangle size={16}/>Alertas de riesgo de churn ({churns.length})</div>
      <div style={{display:'flex',flexWrap:'wrap',gap:8}}>{churns.map(c=>{const cr=churnRisk(db,c.id);return<div key={c.id} style={{background:'#fff',borderRadius:9,padding:'7px 12px',fontSize:12.5,fontWeight:600,color:C.tx,border:`1px solid ${C.critico}33`}}>{c.name} <span style={{color:C.critico}}>↓{cr.drop} pts</span> ({cr.series.map(v=>(v>0?'+':'')+v).join('→')})</div>;})}
      </div>
    </div>}
    <div style={{display:'grid',gridTemplateColumns:'repeat(4,1fr)',gap:14,marginBottom:8}}>
      <Kpi title="Clientes activos" value={db.clients.length} icon={Building2}/>
      <Kpi title="Respuestas totales" value={totResp.toLocaleString('es')} icon={MessageSquare} tone="ink"/>
      <Kpi title="Mediciones cargadas" value={totMonths} icon={CalendarDays}/>
      <Kpi title="Usuarios activos" value={activeUsers} icon={Users} tone="ink"/>
    </div>
    <div style={{display:'grid',gridTemplateColumns:'1.3fr 1fr',gap:14,marginTop:14}}>
      <Card style={{padding:0,overflow:'hidden'}}>
        <div style={{padding:'14px 18px',fontWeight:700,fontSize:14,borderBottom:`1px solid ${C.line}`}} className="disp">Detalle por cliente</div>
        <table style={{width:'100%',borderCollapse:'collapse',fontSize:12.5}}>
          <thead><tr style={{background:C.surface2,color:C.tx3,fontSize:11,textAlign:'left'}}>{['Cliente','Meses','Resp.','Tasa resp.','NPS','Últ. carga'].map((h,i)=><th key={i} style={{padding:'10px 14px',fontWeight:700}}>{h}</th>)}</tr></thead>
          <tbody>{rows.map(({c,s})=> <tr key={c.id} style={{borderTop:`1px solid ${C.line}`}}>
            <td style={{padding:'11px 14px',fontWeight:600}}>{c.name}</td>
            <td style={{padding:'11px 14px'}}>{s.months}</td>
            <td style={{padding:'11px 14px'}}>{s.resp}</td>
            <td style={{padding:'11px 14px'}}>{s.rr!=null?s.rr+'%':'—'}</td>
            <td style={{padding:'11px 14px'}}>{s.nps!=null?<span style={{fontWeight:700,color:bandCol(npsBand(s.nps))}}>{s.nps>0?'+':''}{s.nps}</span>:'—'}</td>
            <td style={{padding:'11px 14px',color:C.tx3}}>{s.last?mLabel(s.last):'—'}</td>
          </tr>)}</tbody>
        </table>
      </Card>
      <Card style={{padding:18}}>
        <div style={{fontWeight:700,fontSize:14,marginBottom:10}} className="disp">NPS por cliente</div>
        <ResponsiveContainer width="100%" height={230}>
          <BarChart data={chart} margin={{top:6,right:6,left:-18,bottom:0}}>
            <CartesianGrid strokeDasharray="3 3" stroke={C.line2} vertical={false}/>
            <XAxis dataKey="name" tick={{fontSize:11,fill:C.tx3}} axisLine={false} tickLine={false}/>
            <YAxis tick={{fontSize:11,fill:C.tx3}} axisLine={false} tickLine={false} domain={[-100,100]}/>
            <Tooltip content={<Tip/>}/>
            <ReferenceLine y={0} stroke={C.line}/>
            <Bar dataKey="NPS" radius={[7,7,0,0]} maxBarSize={54}>{chart.map((e,i)=><Cell key={i} fill={bandCol(npsBand(e.NPS))}/>)}</Bar>
          </BarChart>
        </ResponsiveContainer>
      </Card>
    </div>
  </div>;
}

/* ============================================================ ADMIN: CROSS-SELL IA ============================================================ */
function AdminCrossSell({db}){
  const [cid,setCid]=useState(db.clients[0]?.id||'');
  const [res,setRes]=useState({}); const [load,setLoad]=useState(false); const [err,setErr]=useState(false);
  const c=db.clients.find(x=>x.id===cid); const cd=db.data[cid];
  const allResp=(cd?.months||[]).flatMap(m=>m.responses);
  const m=npsOf(allResp); const segs=bySegment(allResp,'Segmento');

  async function run(){ setLoad(true); setErr(false);
    const byUnit=Object.keys(UNITS).map(u=>`【${u}】\n`+PORTFOLIO.filter(p=>p.u===u).map(p=>`- ${p.k}: ${p.f}`).join('\n')).join('\n\n');
    const prompt=`Sos analista de negocio senior de Delenio, un ecosistema que sincroniza Estrategia Comercial, Leads, Marketing, Talento y Tecnología para que las PyMEs B2B crezcan con resultados predecibles. A partir del NPS B2B de un cliente, identificá oportunidades de CROSS-SELLING en TODAS las unidades de negocio de Delenio (no solo People).

CLIENTE: ${ctxText(c)}
Notas internas: ${c.notas||'s/d'}.

DIAGNÓSTICO NPS:
${diagText(m,segs)}

PORTFOLIO DELENIO POR UNIDAD (servicio → foco):
${byUnit}

Razoná la causa detrás del NPS y mapeala al servicio que mejor la resuelve, sin importar la unidad. Ejemplos: detractores por soporte/operación → People (Match/Drive) o Growth (proceso); por precio/valor → Reingeniería Comercial (ADN Comercial, esquemas de compensación); por churn/baja recompra → Growth (retención, rendimiento de cartera); por producto/tecnología/lentitud → Innovación (automatización, agentes de IA); por desconocimiento, leads malos o posicionamiento → Marketing.
Buscá variedad: las oportunidades deberían cubrir más de una unidad de negocio.
Devolvé SOLO un JSON array (sin markdown) con 4 a 5 objetos ordenados por prioridad:
[{"unit":"nombre exacto de la unidad","service":"nombre exacto del servicio","priority":"Alta|Media|Baja","signal":"qué dato del NPS lo dispara (breve, con número)","why":"por qué encaja y qué resolvería para este cliente (1-2 frases)"}]`;
    try{ const t=await callClaude(prompt,1400); const j=parseJSON(t); if(!j||!Array.isArray(j)) throw new Error('parse'); setRes(p=>({...p,[cid]:j})); }
    catch(e){ setErr(true); } finally{ setLoad(false); }
  }
  const out=res[cid];
  const pcol=p=>p==='Alta'?C.magenta:p==='Media'?C.mejorar:C.tx3;
  return <div>
    <Section title="Cross-sell con IA" hint="La IA cruza el NPS del cliente con todo el portfolio Delenio (5 unidades) y sugiere próximos servicios" icon={Sparkles}/>
    <Card style={{padding:18,marginBottom:16}}>
      <div style={{display:'flex',gap:8,flexWrap:'wrap',marginBottom:14}}>
        {Object.entries(UNITS).map(([u,col])=><span key={u} style={{display:'inline-flex',alignItems:'center',gap:6,fontSize:11,fontWeight:600,color:C.tx2}}><span style={{width:9,height:9,borderRadius:3,background:col}}/>{u}</span>)}
      </div>
      <div style={{display:'flex',gap:12,alignItems:'flex-end',flexWrap:'wrap'}}>
        <div style={{flex:1,minWidth:220}}><Field label="Cliente"><Select value={cid} onChange={e=>setCid(e.target.value)}>{db.clients.map(c=><option key={c.id} value={c.id}>{c.name}</option>)}</Select></Field></div>
        <Btn icon={Wand2} onClick={run} disabled={load||!m} style={{marginBottom:14}}>{load?'Analizando…':'Detectar oportunidades'}</Btn>
      </div>
      {!m&&<div style={{fontSize:12.5,color:C.tx3}}>Este cliente todavía no tiene NPS cargado.</div>}
      {m&&<div style={{display:'flex',gap:8,flexWrap:'wrap',marginTop:4}}>
        <Tag tone={npsBand(m.nps)==='critico'?'bad':'brand'}>NPS {m.nps>0?'+':''}{m.nps}</Tag><Tag tone="bad">Detractores {m.detP}%</Tag>
        {segs.slice(0,3).map(s=><Tag key={s.name} tone="neutral">{s.name} {s.nps>0?'+':''}{s.nps}</Tag>)}
      </div>}
    </Card>
    {load&&<AILoader text="Cruzando NPS con tu portfolio…"/>}
    {err&&<AIErr onRetry={run}/>}
    {out&&!load&&<div style={{display:'grid',gridTemplateColumns:'repeat(auto-fill,minmax(330px,1fr))',gap:14}}>
      {out.map((o,i)=> <Card key={i} className="fu" style={{padding:18,animationDelay:(i*60)+'ms'}}>
        <div style={{display:'flex',alignItems:'flex-start',gap:9}}>
          <div style={{display:'grid',placeItems:'center',width:38,height:38,borderRadius:11,background:(UNITS[o.unit]||C.primary)+'1a',color:UNITS[o.unit]||C.primary,flexShrink:0}}><Briefcase size={18}/></div>
          <div style={{flex:1,minWidth:0}}>
            <div style={{fontWeight:700,fontSize:15}} className="disp">{o.service}</div>
            {o.unit&&<span style={{display:'inline-block',marginTop:4,fontSize:10.5,fontWeight:700,color:UNITS[o.unit]||C.tx2,background:(UNITS[o.unit]||C.tx2)+'18',padding:'2px 8px',borderRadius:7}}>{o.unit}</span>}
          </div>
          <span style={{fontSize:11,fontWeight:700,color:'#fff',background:pcol(o.priority),padding:'3px 9px',borderRadius:8,flexShrink:0}}>{o.priority}</span>
        </div>
        <div style={{display:'flex',gap:7,marginTop:12,padding:'9px 11px',background:C.mejorarBg,borderRadius:10}}>
          <Sparkles size={14} style={{color:C.mejorar,flexShrink:0,marginTop:1}}/><span style={{fontSize:12,color:C.tx2,lineHeight:1.45}}>{o.signal}</span>
        </div>
        <div style={{fontSize:13,color:C.tx2,lineHeight:1.55,marginTop:11}}>{o.why}</div>
      </Card>)}
    </div>}
    {!out&&!load&&!err&&<Empty icon={Sparkles} title="Sin análisis todavía" sub="Elegí un cliente y tocá «Detectar oportunidades» para que la IA proponga servicios según su NPS."/>}
  </div>;
}

/* ============================================================ CLIENT: RESUMEN (AÑO ACTUAL) ============================================================ */
function NpsTargetBar({current, target, label}){
  if(target==null||current==null)return null;
  const pct=Math.min(100,Math.max(0,Math.round((current+100)/(target+100)*100)));
  const met=current>=target;
  return <div style={{background:met?C.excBg:C.mejorarBg,borderRadius:12,padding:'12px 16px',marginBottom:16,display:'flex',gap:16,alignItems:'center'}}>
    <Flag size={16} style={{color:met?C.exc:C.mejorar,flexShrink:0}}/>
    <div style={{flex:1}}>
      <div style={{display:'flex',justifyContent:'space-between',marginBottom:5}}>
        <span style={{fontSize:12.5,fontWeight:700,color:met?C.exc:C.mejorar}}>Target{label?` · ${label}`:''}: NPS {target>0?'+':''}{target}</span>
        <span style={{fontSize:12,color:met?C.exc:C.mejorar,fontWeight:700}}>{met?'✓ Alcanzado':`Actual: ${current>0?'+':''}${current}`}</span>
      </div>
      <div style={{height:6,borderRadius:3,background:'rgba(0,0,0,.1)',overflow:'hidden'}}>
        <div style={{height:'100%',width:pct+'%',background:met?C.exc:C.mejorar,borderRadius:3,transition:'width .5s'}}/>
      </div>
    </div>
  </div>;
}

function ClientResumen({db,clientId}){
  const c=db.clients.find(x=>x.id===clientId);
  const cd=db.data[clientId]; const years=clientYears(cd); const [year,setYear]=useState(years.slice(-1)[0]);
  const [seg,setSeg]=useState(''); const [sec,setSec]=useState('');
  const yResp=yearResp(cd,year); const segs0=demoOptions(yResp,'Segmento'); const secs0=demoOptions(yResp,'Sector');
  const resp=filterResp(yResp,{'Segmento':seg,'Sector':sec});
  const m=npsOf(resp);
  const months=monthsOfYear(cd,year);
  const trend=months.map(mo=>{ const r=filterResp(mo.responses,{'Segmento':seg,'Sector':sec}); const mm=npsOf(r); return {name:mLabel(mo.month), NPS:mm?mm.nps:null}; });
  const valid=trend.filter(t=>t.NPS!=null);
  const delta = valid.length>=2 ? valid[valid.length-1].NPS - valid[valid.length-2].NPS : null;
  const segData=bySegment(resp,'Segmento');
  const secData=bySegment(resp,'Sector');
  const sent=months.reduce((a,mo)=>a+(mo.sent||mo.responses.length),0);
  const rr = sent? r1(resp.length/sent*100):null;

  const [surveyLinkCopied,setSurveyLinkCopied]=useState(false);
  const surveyUrl=`${window.location.origin}/encuesta/${clientId}`;
  function copySurveyUrl(){ navigator.clipboard.writeText(surveyUrl).catch(()=>{}); setSurveyLinkCopied(true); setTimeout(()=>setSurveyLinkCopied(false),2500); }

  if(!yResp.length) return (<div>
    {/* Card encuesta cuando no hay datos todavía */}
    <div style={{background:C.lila4,border:`1.5px solid ${C.lila3}`,borderRadius:14,padding:'16px 18px',marginBottom:18,display:'flex',flexDirection:'column',gap:10}}>
      <div style={{display:'flex',alignItems:'center',gap:8}}><FileSpreadsheet size={16} color={C.primary}/><span style={{fontSize:12,fontWeight:700,color:C.primary,letterSpacing:.4,textTransform:'uppercase'}}>Link de encuesta NPS</span></div>
      <div style={{display:'flex',gap:8,alignItems:'center'}}>
        <div style={{flex:1,fontSize:12,fontFamily:'monospace',color:C.tx2,background:'#fff',border:`1px solid ${C.line}`,borderRadius:8,padding:'8px 12px',overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{surveyUrl}</div>
        <Btn size="sm" variant={surveyLinkCopied?'soft':'primary'} icon={surveyLinkCopied?Check:Copy} onClick={copySurveyUrl}>{surveyLinkCopied?'¡Copiado!':'Copiar link'}</Btn>
        <a href={`https://wa.me/?text=${encodeURIComponent(`Hola! 👋 Te comparto el link de la encuesta NPS de ${c?.name||''}:\n${surveyUrl}`)}`} target="_blank" rel="noreferrer"
          style={{display:'inline-flex',alignItems:'center',justifyContent:'center',width:34,height:34,borderRadius:9,background:'#128C7E',color:'#fff',textDecoration:'none',fontSize:16,flexShrink:0}} title="Compartir por WhatsApp">💬</a>
      </div>
      <div style={{fontSize:12,color:C.tx3}}>Compartí este link con tus clientes para que respondan la encuesta NPS.</div>
    </div>
    <Empty icon={Inbox} title="Sin NPS para este año" sub="Cuando se carguen respuestas vas a ver acá el tablero de NPS del año en curso."/>
  </div>);
  return <div>
    {/* Card encuesta prominente */}
    <div style={{background:C.lila4,border:`1.5px solid ${C.lila3}`,borderRadius:14,padding:'14px 18px',marginBottom:18,display:'flex',gap:12,alignItems:'center',flexWrap:'wrap'}}>
      <div style={{display:'flex',alignItems:'center',gap:7,flexShrink:0}}><FileSpreadsheet size={15} color={C.primary}/><span style={{fontSize:11.5,fontWeight:700,color:C.primary,letterSpacing:.4,textTransform:'uppercase'}}>Link de encuesta NPS</span></div>
      <div style={{flex:1,minWidth:180,fontSize:12,fontFamily:'monospace',color:C.tx2,background:'#fff',border:`1px solid ${C.line}`,borderRadius:8,padding:'7px 11px',overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{surveyUrl}</div>
      <div style={{display:'flex',gap:7,flexShrink:0}}>
        <Btn size="sm" variant={surveyLinkCopied?'soft':'primary'} icon={surveyLinkCopied?Check:Copy} onClick={copySurveyUrl}>{surveyLinkCopied?'¡Copiado!':'Copiar'}</Btn>
        <a href={`https://wa.me/?text=${encodeURIComponent(`Hola! 👋 Te comparto el link de la encuesta NPS de ${c?.name||''}:\n${surveyUrl}`)}`} target="_blank" rel="noreferrer"
          style={{display:'inline-flex',alignItems:'center',justifyContent:'center',width:32,height:32,borderRadius:8,background:'#128C7E',color:'#fff',textDecoration:'none',fontSize:15,flexShrink:0}} title="Compartir por WhatsApp">💬</a>
      </div>
    </div>
    {c?.npsTarget&&m&&<NpsTargetBar current={m.nps} target={Number(c.npsTarget)} label={c.npsTargetLabel}/>}
    <Section title={`NPS ${year}`} hint="Tablero del año en curso · metodología NPS estándar" icon={LayoutDashboard}
      right={<div style={{display:'flex',gap:10,alignItems:'center',flexWrap:'wrap'}}>
        <YearTabs years={years} year={year} setYear={setYear}/>
        <Select value={seg} onChange={e=>setSeg(e.target.value)} style={{width:'auto',padding:'8px 30px 8px 12px',fontSize:12.5}}><option value="">Todos los segmentos</option>{segs0.map(s=><option key={s}>{s}</option>)}</Select>
        {secs0.length>0&&<Select value={sec} onChange={e=>setSec(e.target.value)} style={{width:'auto',padding:'8px 30px 8px 12px',fontSize:12.5}}><option value="">Todos los sectores</option>{secs0.map(s=><option key={s}>{s}</option>)}</Select>}
        <Btn size="sm" variant="ghost" icon={Printer} onClick={()=>window.print()}>Exportar PDF</Btn>
      </div>}/>

    <div style={{display:'grid',gridTemplateColumns:'repeat(4,1fr)',gap:14}}>
      <Kpi title="NPS del período" value={m?(m.nps>0?'+':'')+m.nps:'—'} delta={delta} icon={Gauge} sub={m?bandName(npsBand(m.nps)):''}/>
      <Kpi title="Promotores" value={m?m.proP:'—'} suffix="%" icon={ThumbsUp} tone="ink" sub={m?`${m.pro} clientes`:''}/>
      <Kpi title="Detractores" value={m?m.detP:'—'} suffix="%" icon={ThumbsDown} sub={m?`${m.det} clientes`:''}/>
      <Kpi title="Respuestas" value={m?m.n:0} icon={MessageSquare} tone="ink" sub={rr!=null?`${rr}% tasa de respuesta`:`${months.length} mes(es)`}/>
    </div>

    <div style={{display:'grid',gridTemplateColumns:'1fr 1.3fr',gap:14,marginTop:14}}>
      <Card style={{padding:18}}>
        <div style={{fontWeight:700,fontSize:14,marginBottom:6}} className="disp">Net Promoter Score</div>
        <NpsGauge score={m?m.nps:null} n={m?m.n:0}/>
        <div style={{marginTop:12,paddingTop:14,borderTop:`1px solid ${C.line2}`}}><NpsDist m={m}/></div>
      </Card>
      <Card style={{padding:18}}>
        <div style={{fontWeight:700,fontSize:14,marginBottom:8}} className="disp">Evolución mensual del NPS</div>
        <ResponsiveContainer width="100%" height={228}>
          <LineChart data={trend} margin={{top:6,right:10,left:-20,bottom:0}}>
            <CartesianGrid strokeDasharray="3 3" stroke={C.line2} vertical={false}/>
            <XAxis dataKey="name" tick={{fontSize:10.5,fill:C.tx3}} axisLine={false} tickLine={false}/>
            <YAxis tick={{fontSize:10.5,fill:C.tx3}} axisLine={false} tickLine={false} domain={[-100,100]}/>
            <Tooltip content={<Tip/>}/>
            <ReferenceLine y={0} stroke={C.line}/>
            <Line type="monotone" dataKey="NPS" stroke={C.magenta} strokeWidth={2.6} dot={{r:3,fill:C.magenta}} connectNulls/>
          </LineChart>
        </ResponsiveContainer>
      </Card>
    </div>

    <div style={{display:'grid',gridTemplateColumns:segData.length&&secData.length?'1fr 1fr':'1fr',gap:14,marginTop:14}}>
      {segData.length>0&&<Card style={{padding:18}}>
        <div style={{display:'flex',alignItems:'center',gap:8,fontWeight:700,fontSize:14,marginBottom:8,color:C.primary}} className="disp"><Layers size={16}/>NPS por segmento</div>
        {segData.map(s=><SegBar key={s.name} label={s.name} nps={s.nps} n={s.n}/>)}
      </Card>}
      {secData.length>0&&<Card style={{padding:18}}>
        <div style={{display:'flex',alignItems:'center',gap:8,fontWeight:700,fontSize:14,marginBottom:8,color:C.primary}} className="disp"><Building2 size={16}/>NPS por sector</div>
        {secData.map(s=><SegBar key={s.name} label={s.name} nps={s.nps} n={s.n}/>)}
      </Card>}
    </div>
  </div>;
}

/* ============================================================ CLIENT: HISTÓRICO ============================================================ */
function ClientHistorico({db,clientId}){
  const cd=db.data[clientId]; const years=clientYears(cd);
  const allMonths=(cd?.months||[]).slice().sort((a,b)=>a.month<b.month?-1:1);
  const series=allMonths.map(mo=>{ const m=npsOf(mo.responses); return {name:mLabel(mo.month), NPS:m?m.nps:null, Promotores:m?m.proP:null, Detractores:m?m.detP:null}; });
  const yearSummary=years.map(y=>{ const r=yearResp(cd,y); const m=npsOf(r); return {year:y, nps:m?m.nps:null, proP:m?m.proP:0, detP:m?m.detP:0, n:r.length}; });

  if(!allMonths.length) return <Empty icon={BarChart3} title="Todavía no hay histórico" sub="A medida que se carguen meses, acá se arma la evolución del NPS."/>;
  return <div>
    <Section title="Dashboard histórico" hint="Evolución completa del NPS mes a mes y resumen por año" icon={BarChart3}/>
    <div style={{display:'grid',gridTemplateColumns:`repeat(${Math.min(yearSummary.length,4)},1fr)`,gap:14,marginBottom:6}}>
      {yearSummary.map(ys=> <Stat key={ys.year} year={ys.year} ys={ys}/>)}
    </div>
    <Card style={{padding:18,marginTop:8}}>
      <div style={{fontWeight:700,fontSize:14,marginBottom:8}} className="disp">Evolución mensual del NPS</div>
      <ResponsiveContainer width="100%" height={260}>
        <LineChart data={series} margin={{top:6,right:12,left:-18,bottom:0}}>
          <CartesianGrid strokeDasharray="3 3" stroke={C.line2} vertical={false}/>
          <XAxis dataKey="name" tick={{fontSize:11,fill:C.tx3}} axisLine={false} tickLine={false}/>
          <YAxis tick={{fontSize:11,fill:C.tx3}} axisLine={false} tickLine={false} domain={[-100,100]}/>
          <Tooltip content={<Tip/>}/>
          <ReferenceLine y={0} stroke={C.line}/>
          <ReferenceLine y={30} stroke={C.exc} strokeDasharray="4 4" label={{value:'Bueno (30)',position:'right',fontSize:10,fill:C.exc}}/>
          <Line type="monotone" dataKey="NPS" stroke={C.magenta} strokeWidth={2.8} dot={{r:3,fill:C.magenta}} connectNulls/>
        </LineChart>
      </ResponsiveContainer>
    </Card>
    <Card style={{padding:18,marginTop:14}}>
      <div style={{fontWeight:700,fontSize:14,marginBottom:8}} className="disp">Promotores vs. detractores (%)</div>
      <ResponsiveContainer width="100%" height={230}>
        <BarChart data={series} margin={{top:6,right:12,left:-18,bottom:0}}>
          <CartesianGrid strokeDasharray="3 3" stroke={C.line2} vertical={false}/>
          <XAxis dataKey="name" tick={{fontSize:11,fill:C.tx3}} axisLine={false} tickLine={false}/>
          <YAxis tick={{fontSize:11,fill:C.tx3}} axisLine={false} tickLine={false}/>
          <Tooltip content={<Tip/>}/>
          <Bar dataKey="Promotores" radius={[6,6,0,0]} fill={C.promotor} maxBarSize={26}/>
          <Bar dataKey="Detractores" radius={[6,6,0,0]} fill={C.detractor} maxBarSize={26}/>
        </BarChart>
      </ResponsiveContainer>
    </Card>
  </div>;
}
function Stat({year,ys}){ const b=npsBand(ys.nps); return <Card style={{padding:'16px 16px 14px'}}>
  <div style={{display:'flex',alignItems:'center',gap:8,fontSize:12.5,fontWeight:600,color:C.tx2}}><CalendarDays size={15} style={{color:C.primary}}/>Año {year}</div>
  <div style={{display:'flex',alignItems:'flex-end',gap:6,marginTop:8}}><div className="disp" style={{fontSize:28,fontWeight:700,lineHeight:1,color:ys.nps!=null?bandCol(b):C.tx3}}>{ys.nps!=null?(ys.nps>0?'+':'')+ys.nps:'—'}</div>{ys.nps!=null&&<span style={{marginBottom:4}}><Pill band={b} small/></span>}</div>
  <div style={{fontSize:11.5,color:C.tx3,marginTop:6}}>{ys.n} respuestas · {ys.proP}% prom · {ys.detP}% detr</div>
</Card>; }

/* ============================================================ CLIENT: VOZ DEL CLIENTE (IA) ============================================================ */
function ClientVoces({db,clientId,update}){
  const cd=db.data[clientId]; const c=db.clients.find(x=>x.id===clientId);
  const years=clientYears(cd); const [year,setYear]=useState(years.slice(-1)[0]);
  const resp=yearResp(cd,year); const m=npsOf(resp);
  const cached=db.voices?.[clientId]?.[year]||null;
  const [load,setLoad]=useState(false); const [err,setErr]=useState(false);
  const proC=comments(resp,'pro'), detC=comments(resp,'det'), pasC=comments(resp,'pas');

  async function run(){ setLoad(true); setErr(false);
    const fmt=arr=>arr.slice(0,60).map(x=>`- (${x.e}) ${x.txt}`).join('\n')||'(sin comentarios)';
    const prompt=`Sos analista de experiencia de cliente (CX) de Delenio People. Analizá los comentarios de una encuesta NPS B2B y detectá los TEMAS recurrentes (drivers), separando lo que impulsa la recomendación de lo que genera detractores.

CONTEXTO DEL CLIENTE:
${ctxText(c)}

COMENTARIOS DE PROMOTORES (9-10):
${fmt(proC)}

COMENTARIOS DE DETRACTORES (0-6):
${fmt(detC)}

COMENTARIOS DE PASIVOS (7-8):
${fmt(pasC)}

Devolvé SOLO un JSON (sin markdown) con esta forma:
{"resumen":"2-3 frases ejecutivas sobre la voz del cliente",
"impulsores":[{"tema":"nombre corto","peso":"Alto|Medio|Bajo","detalle":"qué valoran (1 frase)","ejemplo":"cita textual representativa breve"}],
"dolores":[{"tema":"nombre corto","peso":"Alto|Medio|Bajo","detalle":"qué falla y a qué producto/servicio se asocia (1 frase)","ejemplo":"cita textual representativa breve"}]}
Máximo 4 impulsores y 4 dolores, ordenados por peso. Relacioná los temas con los productos/servicios del cliente cuando aplique.`;
    try{ const t=await callClaude(prompt,1500); const j=parseJSON(t); if(!j||!j.dolores) throw new Error();
      update(d=>{ if(!d.voices)d.voices={}; if(!d.voices[clientId])d.voices[clientId]={}; d.voices[clientId][year]=j; }); }
    catch(e){ setErr(true); } finally{ setLoad(false); }
  }
  const pesoCol=p=>p==='Alto'?C.magenta:p==='Medio'?C.lila:C.tx3;

  if(!resp.length) return <Empty icon={MessageSquare} title="Sin comentarios para analizar" sub="El análisis se hace sobre los comentarios cargados del año."/>;
  return <div>
    <Section title="Voz del cliente" hint="La IA agrupa los comentarios en temas, separando impulsores de dolores" icon={Quote}
      right={<div style={{display:'flex',gap:10,alignItems:'center'}}>
        <YearTabs years={years} year={year} setYear={setYear}/>
        <Btn icon={cached?RotateCcw:Wand2} size="sm" variant={cached?'ghost':'primary'} onClick={run} disabled={load}>{load?'Analizando…':cached?'Reanalizar':'Analizar con IA'}</Btn>
      </div>}/>

    <div style={{display:'grid',gridTemplateColumns:'repeat(3,1fr)',gap:14,marginBottom:6}}>
      <Card style={{padding:16}}><div style={{display:'flex',alignItems:'center',gap:8,fontSize:12.5,color:C.tx2,fontWeight:600}}><span style={{display:'grid',placeItems:'center',width:26,height:26,borderRadius:8,background:C.promotorBg,color:C.promotor}}><ThumbsUp size={14}/></span>Comentarios de promotores</div><div className="disp" style={{fontSize:26,fontWeight:700,marginTop:8}}>{proC.length}</div></Card>
      <Card style={{padding:16}}><div style={{display:'flex',alignItems:'center',gap:8,fontSize:12.5,color:C.tx2,fontWeight:600}}><span style={{display:'grid',placeItems:'center',width:26,height:26,borderRadius:8,background:C.surface,color:C.tx2}}><Minus size={14}/></span>De pasivos</div><div className="disp" style={{fontSize:26,fontWeight:700,marginTop:8}}>{pasC.length}</div></Card>
      <Card style={{padding:16}}><div style={{display:'flex',alignItems:'center',gap:8,fontSize:12.5,color:C.tx2,fontWeight:600}}><span style={{display:'grid',placeItems:'center',width:26,height:26,borderRadius:8,background:C.detractorBg,color:C.detractor}}><ThumbsDown size={14}/></span>De detractores</div><div className="disp" style={{fontSize:26,fontWeight:700,marginTop:8}}>{detC.length}</div></Card>
    </div>

    {load&&<AILoader text="Leyendo los comentarios…"/>}
    {err&&<AIErr onRetry={run}/>}
    {!cached&&!load&&!err&&<Empty icon={Wand2} title="Analizá la voz de tus clientes" sub="La IA detecta los temas detrás de promotores y detractores y los conecta con tus productos." action={<Btn icon={Wand2} onClick={run}>Analizar con IA</Btn>}/>}

    {cached&&!load&&<div>
      <Card style={{padding:18,marginBottom:14,background:C.surface,border:'none'}}>
        <div style={{display:'flex',alignItems:'center',gap:8,fontWeight:700,marginBottom:8}}><Sparkles size={16} style={{color:C.primary}}/>Síntesis ejecutiva</div>
        <div style={{fontSize:13.5,color:C.tx2,lineHeight:1.6}}>{cached.resumen}</div>
      </Card>
      <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:14}}>
        <div>
          <div style={{display:'flex',alignItems:'center',gap:8,fontWeight:700,fontSize:14,marginBottom:10,color:C.exc}} className="disp"><ThumbsUp size={16}/>Impulsores de recomendación</div>
          {(cached.impulsores||[]).map((t,i)=><Card key={i} className="fu" style={{padding:15,marginBottom:10,animationDelay:(i*50)+'ms'}}>
            <div style={{display:'flex',alignItems:'center',gap:8,marginBottom:6}}><span style={{fontWeight:700,fontSize:14,flex:1}}>{t.tema}</span><span style={{fontSize:10.5,fontWeight:700,color:'#fff',background:pesoCol(t.peso),padding:'2px 8px',borderRadius:7}}>{t.peso}</span></div>
            <div style={{fontSize:12.5,color:C.tx2,lineHeight:1.5}}>{t.detalle}</div>
            {t.ejemplo&&<div style={{display:'flex',gap:7,marginTop:9,padding:'8px 10px',background:C.promotorBg,borderRadius:9,fontSize:12,color:C.tx2,fontStyle:'italic'}}><Quote size={13} style={{color:C.exc,flexShrink:0,marginTop:1}}/>{t.ejemplo}</div>}
          </Card>)}
        </div>
        <div>
          <div style={{display:'flex',alignItems:'center',gap:8,fontWeight:700,fontSize:14,marginBottom:10,color:C.critico}} className="disp"><ThumbsDown size={16}/>Dolores / motivos de detracción</div>
          {(cached.dolores||[]).map((t,i)=><Card key={i} className="fu" style={{padding:15,marginBottom:10,animationDelay:(i*50)+'ms'}}>
            <div style={{display:'flex',alignItems:'center',gap:8,marginBottom:6}}><span style={{fontWeight:700,fontSize:14,flex:1}}>{t.tema}</span><span style={{fontSize:10.5,fontWeight:700,color:'#fff',background:pesoCol(t.peso),padding:'2px 8px',borderRadius:7}}>{t.peso}</span></div>
            <div style={{fontSize:12.5,color:C.tx2,lineHeight:1.5}}>{t.detalle}</div>
            {t.ejemplo&&<div style={{display:'flex',gap:7,marginTop:9,padding:'8px 10px',background:C.criticoBg,borderRadius:9,fontSize:12,color:C.tx2,fontStyle:'italic'}}><Quote size={13} style={{color:C.critico,flexShrink:0,marginTop:1}}/>{t.ejemplo}</div>}
          </Card>)}
        </div>
      </div>
    </div>}
  </div>;
}

/* ============================================================ CLIENT: MI EMPRESA (CONTEXTO) ============================================================ */
function ClientContexto({db,clientId,update}){
  const c=db.clients.find(x=>x.id===clientId);
  const [f,setF]=useState({sector:c.sector||'',contexto:c.contexto||'',propuesta:c.propuesta||'',productos:(c.productos&&c.productos.length?c.productos:[''])});
  const [saved,setSaved]=useState(false);
  const setProd=(i,v)=>setF(p=>{ const a=[...p.productos]; a[i]=v; return {...p,productos:a}; });
  const save=()=>{ update(d=>{ const i=d.clients.findIndex(x=>x.id===clientId); d.clients[i]={...d.clients[i],sector:f.sector,contexto:f.contexto,propuesta:f.propuesta,productos:f.productos.map(s=>s.trim()).filter(Boolean)}; }); setSaved(true); setTimeout(()=>setSaved(false),2200); };
  const completeness = [f.contexto,f.propuesta,f.productos.filter(Boolean).length].filter(x=>x&&x!=='' ).length;
  return <div>
    <Section title="Mi empresa" hint="Tu contexto alimenta el análisis de comentarios y el plan de acción con IA" icon={Package}
      right={<div style={{display:'flex',gap:10,alignItems:'center'}}>{saved&&<span style={{display:'inline-flex',alignItems:'center',gap:5,fontSize:12,color:C.exc,fontWeight:700}}><Check size={14}/>Guardado</span>}<Btn icon={Check} size="sm" onClick={save}>Guardar contexto</Btn></div>}/>

    <Card style={{padding:16,marginBottom:14,background:C.gradSoft,border:'none'}}>
      <div style={{display:'flex',alignItems:'center',gap:10}}>
        <span style={{display:'grid',placeItems:'center',width:38,height:38,borderRadius:11,background:'#fff',color:C.primary}}><Sparkles size={18}/></span>
        <div style={{fontSize:13,color:C.tx2,lineHeight:1.5}}>Cuanto más completo esté tu contexto, más afinados serán los planes de acción. La IA usa tus productos y propuesta de valor para conectar cada comentario con una causa y una solución concreta.</div>
      </div>
    </Card>

    <div style={{display:'grid',gridTemplateColumns:'1.4fr 1fr',gap:14}}>
      <Card style={{padding:20}}>
        <Field label="Sector / industria"><SectorSelect value={f.sector||''} onChange={v=>setF({...f,sector:v})}/></Field>
        <Field label="¿A qué se dedica la empresa?" hint="A qué clientes B2B atendés y cómo."><Textarea value={f.contexto} onChange={e=>setF({...f,contexto:e.target.value})} placeholder="Describí tu negocio, tus clientes B2B y el contexto del CEO."/></Field>
        <Field label="Propuesta de valor"><Textarea value={f.propuesta} onChange={e=>setF({...f,propuesta:e.target.value})} style={{minHeight:64}} placeholder="Qué te diferencia de la competencia."/></Field>
      </Card>
      <Card style={{padding:20}}>
        <div style={{fontSize:12,fontWeight:700,color:C.tx2,marginBottom:6}}>Productos y/o servicios</div>
        <div style={{fontSize:11.5,color:C.tx3,marginBottom:12}}>Listá lo que ofrecés a tus clientes B2B. Cada ítem ayuda a clasificar mejor los comentarios.</div>
        {f.productos.map((p,i)=><div key={i} style={{display:'flex',gap:8,alignItems:'center',marginBottom:8}}>
          <span style={{display:'grid',placeItems:'center',width:24,height:24,borderRadius:7,background:C.lila3,color:C.primary,flexShrink:0}}><Package size={13}/></span>
          <Input value={p} onChange={e=>setProd(i,e.target.value)} placeholder={`Producto / servicio ${i+1}`} style={{padding:'8px 11px',fontSize:13}}/>
          <IconBtn icon={X} onClick={()=>setF(s=>({...s,productos:s.productos.filter((_,j)=>j!==i)}))}/>
        </div>)}
        <button onClick={()=>setF(s=>({...s,productos:[...s.productos,'']}))} style={{display:'inline-flex',alignItems:'center',gap:5,background:'none',border:'none',color:C.primary,fontWeight:700,fontSize:12.5,cursor:'pointer',padding:'6px 0'}}><Plus size={14}/>Agregar producto / servicio</button>
      </Card>
    </div>
  </div>;
}

/* ============================================================ CLIENT: PLAN DE ACCIÓN (IA) ============================================================ */
function ClientPlan({db,clientId,update}){
  const cd=db.data[clientId]; const c=db.clients.find(x=>x.id===clientId);
  const years=clientYears(cd); const [year,setYear]=useState(years.slice(-1)[0]);
  const resp=yearResp(cd,year); const m=npsOf(resp); const segs=bySegment(resp,'Segmento');
  const plan=db.plans?.[clientId]?.[year]||null;
  const voices=db.voices?.[clientId]?.[year]||null;
  const [load,setLoad]=useState(false); const [err,setErr]=useState(false); const [saved,setSaved]=useState(false);

  function savePlan(cards){ update(d=>{ if(!d.plans)d.plans={}; if(!d.plans[clientId])d.plans[clientId]={}; d.plans[clientId][year]=cards; }); setSaved(true); setTimeout(()=>setSaved(false),2000); }

  async function generate(){ setLoad(true); setErr(false);
    const detC=comments(resp,'det').slice(0,40).map(x=>`- (${x.e}) ${x.txt}`).join('\n')||'(sin comentarios de detractores)';
    const voicesTxt = voices? `\nTEMAS YA DETECTADOS (Voz del cliente):\nImpulsores: ${(voices.impulsores||[]).map(t=>t.tema).join(', ')}\nDolores: ${(voices.dolores||[]).map(t=>`${t.tema} (${t.detalle})`).join(' | ')}` : '';
    const prompt=`Sos consultor/a senior de CX y RRHH de Delenio People. Diseñá un PLAN DE ACCIÓN para SUBIR EL NPS B2B de un cliente, atacando las causas de detracción y apalancando lo que valoran los promotores.

CONTEXTO DEL CLIENTE:
${ctxText(c)}

DIAGNÓSTICO NPS (${year}):
${diagText(m,segs)}

COMENTARIOS DE DETRACTORES:
${detC}
${voicesTxt}

Las iniciativas deben ser concretas, accionables para una empresa B2B y conectarse con sus productos/servicios reales cuando aplique.
Devolvé SOLO un JSON array (sin markdown), 4 a 5 objetos ordenados por impacto:
[{"foco":"causa o palanca a trabajar (corto)","objetivo":"objetivo claro y medible","acciones":["3 acciones concretas"],"responsable":"área/rol del cliente","indicador":"KPI de seguimiento (incluí impacto esperado en NPS)","plazo":"30/60/90 días o Q1|Q2|Q3|Q4","estado":"Pendiente"}]`;
    try{ const t=await callClaude(prompt,1700); const j=parseJSON(t); if(!j||!Array.isArray(j)) throw new Error(); savePlan(j.map(c=>({...c,id:uid('ac'),estado:c.estado||'Pendiente'}))); }
    catch(e){ setErr(true); } finally{ setLoad(false); }
  }

  if(!resp.length) return <Empty icon={ClipboardList} title="Sin datos para el plan" sub="El plan se genera sobre el diagnóstico NPS del año."/>;
  return <div>
    <Section title="Plan de acción" hint="Generado con IA sobre tus detractores y tu contexto · editable" icon={ClipboardList}
      right={<div style={{display:'flex',gap:10,alignItems:'center'}}>
        <YearTabs years={years} year={year} setYear={setYear}/>
        {saved&&<span style={{display:'inline-flex',alignItems:'center',gap:5,fontSize:12,color:C.exc,fontWeight:700}}><Check size={14}/>Guardado</span>}
        <Btn icon={plan?RotateCcw:Wand2} size="sm" variant={plan?'ghost':'primary'} onClick={generate} disabled={load}>{load?'Generando…':plan?'Regenerar':'Generar con IA'}</Btn>
      </div>}/>

    {!plan&&!load&&!err&&<Card style={{padding:20,marginBottom:16,background:C.surface,border:'none'}}>
      <div style={{display:'flex',alignItems:'center',gap:8,fontWeight:700,marginBottom:10}}><Target size={16} style={{color:C.primary}}/>Punto de partida</div>
      <div style={{display:'flex',gap:8,flexWrap:'wrap'}}>
        {m&&<Tag tone={npsBand(m.nps)==='critico'?'bad':'brand'}>NPS {m.nps>0?'+':''}{m.nps}</Tag>}
        {m&&<Tag tone="bad">{m.detP}% detractores</Tag>}
        {(c.productos||[]).filter(Boolean).length===0 && <Tag tone="warn">Completá «Mi empresa» para un plan más afinado</Tag>}
        {voices&&<Tag tone="good">Voz del cliente analizada</Tag>}
      </div>
    </Card>}

    {load&&<AILoader text="Diseñando el plan para subir tu NPS…"/>}
    {err&&<AIErr onRetry={generate}/>}
    {plan&&!load&&<PlanEditor cards={plan} onChange={savePlan}/>}
    {!plan&&!load&&!err&&<Empty icon={Wand2} title="Generá tu plan de acción" sub="La IA propone iniciativas para reducir detractores y subir el NPS, conectadas con tus productos. Después lo editás libremente." action={<Btn icon={Wand2} onClick={generate}>Generar con IA</Btn>}/>}
  </div>;
}

function PlanEditor({cards,onChange}){
  const upd=(id,patch)=>onChange(cards.map(c=>{ if(c.id!==id)return c; const next={...c,...patch}; if(patch.estado==='Hecho'&&!c.completedAt)next.completedAt=new Date().toLocaleDateString('es-AR'); if(patch.estado&&patch.estado!=='Hecho')next.completedAt=undefined; return next; }));
  const del=(id)=>onChange(cards.filter(c=>c.id!==id));
  const addAction=(id)=>{ const c=cards.find(x=>x.id===id); upd(id,{acciones:[...(c.acciones||[]),'Nueva acción']}); };
  const setAction=(id,i,v)=>{ const c=cards.find(x=>x.id===id); const a=[...c.acciones]; a[i]=v; upd(id,{acciones:a}); };
  const delAction=(id,i)=>{ const c=cards.find(x=>x.id===id); upd(id,{acciones:c.acciones.filter((_,j)=>j!==i)}); };
  const addCard=()=>onChange([...cards,{id:uid('ac'),foco:'Nueva iniciativa',objetivo:'',acciones:['Acción 1'],responsable:'',indicador:'',plazo:'Q1',estado:'Pendiente'}]);
  const estados=['Pendiente','En curso','Hecho'];
  const eCol=s=>s==='Hecho'?C.exc:s==='En curso'?C.mejorar:C.tx3;
  const eBg=s=>s==='Hecho'?C.excBg:s==='En curso'?C.mejorarBg:C.surface;
  const done=cards.filter(c=>c.estado==='Hecho').length;
  const inProgress=cards.filter(c=>c.estado==='En curso').length;
  return <div>
    {cards.length>0&&<div style={{display:'flex',gap:12,marginBottom:16,flexWrap:'wrap'}}>
      {[{label:'Total',v:cards.length,c:C.tx2},{label:'En curso',v:inProgress,c:C.mejorar},{label:'Completadas',v:done,c:C.exc}].map(({label,v,c})=><div key={label} style={{background:'#fff',border:`1px solid ${C.line}`,borderRadius:10,padding:'10px 16px',textAlign:'center',minWidth:90}}>
        <div style={{fontFamily:DISP,fontWeight:700,fontSize:22,color:c}}>{v}</div>
        <div style={{fontSize:11,color:C.tx3}}>{label}</div>
      </div>)}
      {done>0&&<div style={{flex:1,minWidth:160,background:C.excBg,borderRadius:10,padding:'10px 16px',display:'flex',alignItems:'center',gap:8}}>
        <div style={{flex:1}}><div style={{height:6,borderRadius:3,background:C.line,overflow:'hidden'}}><div style={{height:'100%',width:Math.round(done/cards.length*100)+'%',background:C.exc,borderRadius:3}}/></div></div>
        <span style={{fontSize:12,fontWeight:700,color:C.exc}}>{Math.round(done/cards.length*100)}%</span>
      </div>}
    </div>}
    <div style={{display:'grid',gap:14}}>
      {cards.map((c,i)=> <Card key={c.id} className="fu" style={{padding:18,animationDelay:(i*50)+'ms',borderLeft:`3px solid ${eCol(c.estado)}`}}>
        <div style={{display:'flex',alignItems:'center',gap:10,marginBottom:12}}>
          <span style={{display:'grid',placeItems:'center',width:30,height:30,borderRadius:9,background:c.estado==='Hecho'?C.exc:C.grad,color:'#fff',fontWeight:700,fontFamily:DISP,fontSize:14}}>{c.estado==='Hecho'?<Check size={15}/>:i+1}</span>
          <input value={c.foco} onChange={e=>upd(c.id,{foco:e.target.value})} style={{flex:1,border:'none',fontFamily:DISP,fontWeight:700,fontSize:16,color:c.estado==='Hecho'?C.tx3:C.tx,background:'transparent',textDecoration:c.estado==='Hecho'?'line-through':'none'}}/>
          <Select value={c.estado} onChange={e=>upd(c.id,{estado:e.target.value})} style={{width:'auto',padding:'6px 28px 6px 11px',fontSize:12,fontWeight:700,color:eCol(c.estado),background:eBg(c.estado)}}>{estados.map(s=><option key={s}>{s}</option>)}</Select>
          <IconBtn icon={Trash2} tone="danger" onClick={()=>del(c.id)}/>
        </div>
        {c.completedAt&&<div style={{fontSize:11.5,color:C.exc,marginBottom:8,display:'flex',alignItems:'center',gap:5}}><Check size={12}/>Completada el {c.completedAt}</div>}
        <Field label="Objetivo"><Textarea value={c.objetivo} onChange={e=>upd(c.id,{objetivo:e.target.value})} style={{minHeight:54}}/></Field>
        <div style={{fontSize:12,fontWeight:700,color:C.tx2,marginBottom:6}}>Acciones</div>
        {(c.acciones||[]).map((a,j)=><div key={j} style={{display:'flex',gap:8,alignItems:'center',marginBottom:7}}>
          <span style={{width:6,height:6,borderRadius:'50%',background:C.magenta,flexShrink:0}}/>
          <input value={a} onChange={e=>setAction(c.id,j,e.target.value)} style={{...inputCss,padding:'8px 11px',fontSize:13}}/>
          <IconBtn icon={X} onClick={()=>delAction(c.id,j)}/>
        </div>)}
        <button onClick={()=>addAction(c.id)} style={{display:'inline-flex',alignItems:'center',gap:5,background:'none',border:'none',color:C.primary,fontWeight:700,fontSize:12.5,cursor:'pointer',padding:'4px 0',marginBottom:10}}><Plus size={14}/>Agregar acción</button>
        <div style={{display:'grid',gridTemplateColumns:'1fr 1fr 1fr',gap:12,marginTop:4}}>
          <Field label="Responsable"><Input value={c.responsable} onChange={e=>upd(c.id,{responsable:e.target.value})}/></Field>
          <Field label="Indicador"><Input value={c.indicador} onChange={e=>upd(c.id,{indicador:e.target.value})}/></Field>
          <Field label="Plazo"><Input value={c.plazo} onChange={e=>upd(c.id,{plazo:e.target.value})}/></Field>
        </div>
      </Card>)}
    </div>
    <div style={{display:'flex',justifyContent:'center',marginTop:16}}><Btn variant="ghost" icon={Plus} onClick={addCard}>Agregar iniciativa manual</Btn></div>
  </div>;
}

/* ============================================================ PERSISTENCE ============================================================ */
const DB_KEY='promotia:db:v2';
function seedDB(){ return {clients:[],data:{},users:[],plans:{},voices:{}}; }

/* ============================================================ LOGIN ============================================================ */
function Login({db,onAdmin,onClient}){
  return <div style={{minHeight:'100vh',display:'grid',gridTemplateColumns:'1fr 1fr'}}>
    <div style={{background:C.gradHero,color:'#fff',padding:'56px 54px',display:'flex',flexDirection:'column',justifyContent:'space-between',position:'relative',overflow:'hidden'}}>
      <div style={{position:'absolute',right:-80,top:-60,width:280,height:280,borderRadius:'50%',background:'rgba(255,255,255,.08)'}}/>
      <div style={{position:'absolute',left:-50,bottom:-40,width:200,height:200,borderRadius:'50%',background:'rgba(255,255,255,.07)'}}/>
      <Wordmark size={26} light/>
      <div style={{position:'relative'}}>
        <svg width="100%" height="64" viewBox="0 0 380 64" style={{marginBottom:26,opacity:.9}}><path d="M0 48 H60 L88 18 L120 50 L150 30 H210 L238 12 L268 44 L298 26 H380" stroke="#fff" strokeWidth="2.4" fill="none" strokeLinecap="round" strokeLinejoin="round"/></svg>
        <h1 style={{fontSize:34,fontWeight:700,margin:0,lineHeight:1.1}}>El NPS de tus clientes B2B,<br/>medido mes a mes.</h1>
        <p style={{fontSize:15,opacity:.9,lineHeight:1.6,marginTop:16,maxWidth:430}}>Una sola pregunta, la metodología NPS de siempre. Dashboards de promotores y detractores, voz del cliente con IA y planes de acción para subir tu score.</p>
      </div>
      <div style={{fontSize:12.5,opacity:.8}}>Un microservicio de Delenio People · delenio.net</div>
    </div>
    <div style={{display:'grid',placeItems:'center',padding:40}}>
      <div style={{width:'100%',maxWidth:380}}>
        <div style={{fontSize:13,color:C.tx3,fontWeight:700,marginBottom:6}}>BIENVENIDO</div>
        <h2 style={{fontSize:26,fontWeight:700,margin:'0 0 4px'}}>Ingresá a PromotIA</h2>
        <p style={{fontSize:13.5,color:C.tx2,margin:'0 0 26px'}}>Elegí cómo querés entrar.</p>
        <button onClick={onAdmin} className="lift" style={{width:'100%',display:'flex',alignItems:'center',gap:13,padding:'16px 18px',borderRadius:14,border:`1px solid ${C.line}`,background:C.tx,color:'#fff',cursor:'pointer',marginBottom:14}}>
          <span style={{display:'grid',placeItems:'center',width:40,height:40,borderRadius:11,background:'rgba(255,255,255,.12)'}}><ShieldCheck size={20}/></span>
          <span style={{textAlign:'left',flex:1}}><span style={{display:'block',fontWeight:700,fontSize:15,fontFamily:DISP}}>Panel de administración</span><span style={{fontSize:12,opacity:.75}}>Equipo Delenio · gestión completa</span></span>
          <ChevronRight size={18}/>
        </button>
        <div style={{fontSize:12,color:C.tx3,fontWeight:700,margin:'18px 0 10px'}}>PORTALES DE CLIENTE</div>
        <div style={{display:'flex',flexDirection:'column',gap:10}}>
          {db.clients.map(c=> <button key={c.id} onClick={()=>onClient(c.id)} className="lift" style={{display:'flex',alignItems:'center',gap:12,padding:'13px 16px',borderRadius:13,border:`1px solid ${C.line}`,background:'#fff',cursor:'pointer'}}>
            <span style={{display:'grid',placeItems:'center',width:38,height:38,borderRadius:10,background:C.grad,color:'#fff',fontWeight:700,fontFamily:DISP,fontSize:16}}>{c.name[0]}</span>
            <span style={{textAlign:'left',flex:1}}><span style={{display:'block',fontWeight:700,fontSize:14,color:C.tx}}>{c.name}</span><span style={{fontSize:11.5,color:C.tx3}}>{c.code}</span></span>
            <ChevronRight size={17} style={{color:C.tx3}}/>
          </button>)}
        </div>
        <p style={{fontSize:11,color:C.tx3,marginTop:22,lineHeight:1.5}}>Cada usuario accede con su cuenta y solo ve su portal asignado.</p>
      </div>
    </div>
  </div>;
}

/* ============================================================ ADMIN: PANEL EJECUTIVO ============================================================ */
function AdminPanel({db,newDetCount,goClient}){
  const rows=db.clients.map(c=>{
    const s=clientStats(db,c.id); const cr=churnRisk(db,c.id);
    const sorted=(db.data[c.id]?.months||[]).slice().sort((a,b)=>a.month<b.month?-1:1);
    const lastTwo=sorted.slice(-2);
    const delta=lastTwo.length===2?npsOf(lastTwo[1].responses)?.nps-npsOf(lastTwo[0].responses)?.nps:null;
    return {c,s,cr,delta};
  });
  const avgNPS=rows.filter(r=>r.s.nps!=null).length? Math.round(rows.filter(r=>r.s.nps!=null).reduce((a,r)=>a+r.s.nps,0)/rows.filter(r=>r.s.nps!=null).length):null;
  const atRisk=rows.filter(r=>r.cr).length;
  const totalResp=rows.reduce((a,r)=>a+r.s.resp,0);
  return <div>
    <Section title="Panel ejecutivo" hint="Vista consolidada de toda la cartera de clientes" icon={Home}/>
    <div style={{display:'grid',gridTemplateColumns:'repeat(4,1fr)',gap:14,marginBottom:20}}>
      <Kpi title="Clientes activos" value={db.clients.length} icon={Building2}/>
      <Kpi title="NPS promedio cartera" value={avgNPS!=null?(avgNPS>0?'+':'')+avgNPS:'—'} icon={Gauge} tone={avgNPS!=null?(avgNPS>=30?'brand':'ink'):'ink'}/>
      <Kpi title="Clientes en riesgo" value={atRisk} icon={AlertTriangle} tone={atRisk>0?'warn':'ink'}/>
      <Kpi title="Respuestas totales" value={totalResp.toLocaleString('es')} icon={MessageSquare} tone="ink"/>
    </div>
    {newDetCount>0&&<div style={{display:'flex',alignItems:'center',gap:10,background:C.criticoBg,border:`1px solid ${C.critico}33`,borderRadius:12,padding:'12px 16px',marginBottom:16}}>
      <Bell size={16} style={{color:C.critico,flexShrink:0}}/>
      <span style={{fontSize:13.5,fontWeight:700,color:C.critico}}>{newDetCount} nuevo{newDetCount>1?'s':''} detractor{newDetCount>1?'es':''} en tiempo real</span>
      <span style={{fontSize:12.5,color:C.tx2,flex:1}}>· Respondieron con 0-6 mientras estabas en sesión</span>
    </div>}
    <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fill,minmax(300px,1fr))',gap:14}}>
      {rows.map(({c,s,cr,delta})=>{
        const b=npsBand(s.nps);
        return <Card key={c.id} className="fu" style={{padding:18,border:cr?`1.5px solid ${C.critico}44`:''}}>
          <div style={{display:'flex',alignItems:'flex-start',gap:10,marginBottom:12}}>
            <div style={{display:'grid',placeItems:'center',width:40,height:40,borderRadius:11,background:C.grad,color:'#fff',fontWeight:700,fontFamily:DISP,fontSize:17,flexShrink:0}}>{c.name[0]}</div>
            <div style={{flex:1,minWidth:0}}>
              <div style={{fontWeight:700,fontSize:15,fontFamily:DISP}}>{c.name}</div>
              <div style={{fontSize:11.5,color:C.tx3}}>{c.sector||c.code}</div>
            </div>
            {s.nps!=null&&<div style={{textAlign:'right',flexShrink:0}}>
              <div style={{fontFamily:DISP,fontWeight:700,fontSize:22,color:bandCol(b),lineHeight:1}}>{s.nps>0?'+':''}{s.nps}</div>
              <div style={{fontSize:10,color:C.tx3}}>NPS</div>
            </div>}
          </div>
          <div style={{display:'flex',gap:6,flexWrap:'wrap',marginBottom:12}}>
            {delta!=null&&<Tag tone={delta>=0?'good':'bad'} style={{display:'inline-flex',alignItems:'center',gap:3}}>{delta>=0?<TrendingUp size={11}/>:<TrendingDown size={11}/>}{delta>=0?'+':''}{delta} vs mes ant.</Tag>}
            {cr&&<Tag tone="bad"><AlertTriangle size={11} style={{marginRight:3,verticalAlign:'-1px'}}/>Riesgo churn</Tag>}
            <Tag tone="brand">{s.resp} respuestas</Tag>
            {c.npsTarget&&s.nps!=null&&<Tag tone={s.nps>=Number(c.npsTarget)?'good':'warn'}><Flag size={10} style={{marginRight:3}}/>Target {Number(c.npsTarget)>0?'+':''}{c.npsTarget}</Tag>}
          </div>
          <Btn size="sm" variant="soft" icon={Eye} onClick={()=>goClient(c.id)} style={{width:'100%'}}>Ver portal</Btn>
        </Card>;
      })}
      {!db.clients.length&&<Empty icon={Building2} title="Sin clientes" sub="Agregá clientes desde la sección Clientes."/>}
    </div>
  </div>;
}

/* ============================================================ ADMIN: DETRACTORES ============================================================ */
function AdminDetractores({db,update}){
  const [items,setItems]=useState([]); const [loading,setLoading]=useState(false); const [err,setErr]=useState(false);
  const followups=db.followups||{};
  const clientName=id=>db.clients.find(c=>c.id===id)?.name||id;

  async function load(){
    setLoading(true); setErr(false);
    try{
      const r=await fetch('/api/detractors'); if(!r.ok)throw new Error();
      const d=await r.json(); setItems(d.detractors||[]);
    }catch(e){setErr(true);} finally{setLoading(false);}
  }
  useEffect(()=>{load();},[]);

  function setStatus(id,status){ update(db=>{ if(!db.followups)db.followups={}; db.followups[id]={...(db.followups[id]||{}),status,updatedAt:new Date().toLocaleDateString('es-AR')}; }); }
  function setNotes(id,notes){ update(db=>{ if(!db.followups)db.followups={}; db.followups[id]={...(db.followups[id]||{}),notes}; }); }

  const STATUS_CFG={
    pendiente:{label:'Pendiente',icon:Bell,col:C.mejorar,bg:C.mejorarBg},
    contactado:{label:'Contactado',icon:PhoneCall,col:C.primary,bg:C.lila4},
    resuelto:{label:'Resuelto',icon:UserCheck,col:C.exc,bg:C.excBg},
    perdido:{label:'Perdido',icon:XCircle,col:C.critico,bg:C.criticoBg},
  };
  const byStatus=s=>items.filter(i=>(followups[i.id]?.status||'pendiente')===s);
  const pending=byStatus('pendiente'); const contacted=byStatus('contactado'); const resolved=byStatus('resuelto'); const lost=byStatus('perdido');

  const DetCard=({item})=>{
    const fu=followups[item.id]||{status:'pendiente'};
    const cfg=STATUS_CFG[fu.status||'pendiente'];
    const [showNotes,setShowNotes]=useState(false);
    return <Card style={{padding:16,marginBottom:10}}>
      <div style={{display:'flex',alignItems:'flex-start',gap:10}}>
        <div style={{display:'grid',placeItems:'center',width:34,height:34,borderRadius:9,background:C.criticoBg,color:C.critico,fontWeight:700,fontFamily:DISP,fontSize:15,flexShrink:0}}>{item.score}</div>
        <div style={{flex:1,minWidth:0}}>
          <div style={{display:'flex',gap:6,alignItems:'center',marginBottom:4,flexWrap:'wrap'}}>
            <span style={{fontWeight:700,fontSize:13,color:C.tx}}>{clientName(item.client_id)}</span>
            {item.name&&<span style={{fontSize:12,color:C.tx3}}>· {item.name}</span>}
            <span style={{fontSize:11,color:C.tx3,marginLeft:'auto'}}>{new Date(item.created_at).toLocaleDateString('es-AR')}</span>
          </div>
          {item.comment&&<div style={{fontSize:13,color:C.tx2,lineHeight:1.5,marginBottom:8,background:C.surface,borderRadius:8,padding:'8px 10px',fontStyle:'italic'}}>"{item.comment}"</div>}
          <div style={{display:'flex',gap:6,flexWrap:'wrap',alignItems:'center'}}>
            {Object.entries(STATUS_CFG).map(([key,sc])=><button key={key} onClick={()=>setStatus(item.id,key)} style={{display:'inline-flex',alignItems:'center',gap:4,padding:'5px 10px',borderRadius:8,border:`1px solid ${fu.status===key?sc.col:C.line}`,background:fu.status===key?sc.bg:'#fff',color:fu.status===key?sc.col:C.tx3,fontSize:12,fontWeight:fu.status===key?700:500,cursor:'pointer'}}><sc.icon size={12}/>{sc.label}</button>)}
            <button onClick={()=>setShowNotes(!showNotes)} style={{marginLeft:'auto',fontSize:12,color:C.tx3,background:'none',border:`1px solid ${C.line}`,borderRadius:8,padding:'5px 10px',cursor:'pointer'}}>{showNotes?'Cerrar':'+ Nota'}</button>
          </div>
          {showNotes&&<textarea value={fu.notes||''} onChange={e=>setNotes(item.id,e.target.value)} placeholder="Registrá qué pasó: llamaste, qué respondió, cómo lo resolviste…" style={{...inputCss,marginTop:8,minHeight:60,fontSize:12.5}}/>}
          {fu.notes&&!showNotes&&<div style={{fontSize:12,color:C.tx2,marginTop:6,padding:'6px 10px',background:C.surface,borderRadius:8}}>📝 {fu.notes}</div>}
          {fu.updatedAt&&<div style={{fontSize:11,color:C.tx3,marginTop:4}}>Actualizado: {fu.updatedAt}</div>}
        </div>
      </div>
    </Card>;
  };

  const total=items.length; const gestPct=total?Math.round((resolved.length+lost.length)/total*100):0;
  return <div>
    <Section title="Detractores — cierre de loop" hint="Gestión de clientes que respondieron 0-6 · metodología Close the Loop" icon={Bell}
      right={<Btn variant="ghost" icon={RotateCcw} size="sm" onClick={load} disabled={loading}>Actualizar</Btn>}/>
    {total>0&&<div style={{display:'flex',gap:12,marginBottom:16,flexWrap:'wrap'}}>
      {Object.entries(STATUS_CFG).map(([key,sc])=>{
        const count=byStatus(key).length;
        return <div key={key} style={{background:sc.bg,borderRadius:10,padding:'10px 16px',display:'flex',alignItems:'center',gap:8,minWidth:120}}>
          <sc.icon size={16} style={{color:sc.col}}/><div><div style={{fontFamily:DISP,fontWeight:700,fontSize:20,color:sc.col}}>{count}</div><div style={{fontSize:11,color:sc.col,opacity:.8}}>{sc.label}</div></div>
        </div>;
      })}
      {gestPct>0&&<div style={{flex:1,minWidth:140,background:'#fff',border:`1px solid ${C.line}`,borderRadius:10,padding:'10px 16px',display:'flex',alignItems:'center',gap:10}}>
        <div style={{flex:1}}><div style={{height:6,borderRadius:3,background:C.line,overflow:'hidden',marginBottom:4}}><div style={{height:'100%',width:gestPct+'%',background:C.exc,borderRadius:3}}/></div><div style={{fontSize:11,color:C.tx3}}>{gestPct}% gestionados</div></div>
      </div>}
    </div>}
    {err&&<div style={{color:C.critico,background:C.criticoBg,borderRadius:10,padding:'10px 14px',marginBottom:12,fontSize:13}}>Error al cargar detractores. Verificá las env vars de Supabase.</div>}
    {loading&&<div style={{textAlign:'center',padding:40}}><Spinner size={24} color={C.primary}/></div>}
    {!loading&&!err&&!total&&<Empty icon={ThumbsUp} title="Sin detractores por el momento" sub="Cuando lleguen respuestas con score 0-6 aparecerán acá para gestionar."/>}
    {!loading&&pending.length>0&&<div style={{marginBottom:20}}>
      <div style={{display:'flex',alignItems:'center',gap:7,fontFamily:DISP,fontWeight:700,fontSize:13,color:C.mejorar,marginBottom:10}}><Bell size={14}/>Pendientes de contactar ({pending.length})</div>
      {pending.map(i=><DetCard key={i.id} item={i}/>)}
    </div>}
    {!loading&&contacted.length>0&&<div style={{marginBottom:20}}>
      <div style={{display:'flex',alignItems:'center',gap:7,fontFamily:DISP,fontWeight:700,fontSize:13,color:C.primary,marginBottom:10}}><PhoneCall size={14}/>Contactados ({contacted.length})</div>
      {contacted.map(i=><DetCard key={i.id} item={i}/>)}
    </div>}
    {!loading&&(resolved.length>0||lost.length>0)&&<div>
      <div style={{display:'flex',alignItems:'center',gap:7,fontFamily:DISP,fontWeight:700,fontSize:13,color:C.tx3,marginBottom:10}}><Check size={14}/>Cerrados ({resolved.length+lost.length})</div>
      {[...resolved,...lost].map(i=><DetCard key={i.id} item={i}/>)}
    </div>}
  </div>;
}

/* ============================================================ CLIENT: COMPARATIVA DE PERÍODOS ============================================================ */
function ClientComparativa({db,clientId}){
  const cd=db.data[clientId];
  const allMonths=(cd?.months||[]).slice().sort((a,b)=>a.month<b.month?-1:1);
  const years=[...new Set(allMonths.map(m=>m.month.split('-')[0]))];

  const [pA,setPA]=useState(years.slice(-1)[0]||'');
  const [pB,setPB]=useState(years.length>=2?years.slice(-2)[0]:'');

  function respOfYear(y){ return allMonths.filter(m=>m.month.startsWith(y)).flatMap(m=>m.responses); }

  const mA=npsOf(respOfYear(pA)); const mB=npsOf(respOfYear(pB));

  function Delta({a,b,suffix='',inv=false}){
    if(a==null||b==null)return <span style={{color:C.tx3}}>—</span>;
    const d=a-b; const good=inv?d<=0:d>=0;
    return <span style={{color:good?C.exc:C.critico,fontWeight:700}}>{d>=0?'+':''}{r1(d)}{suffix}</span>;
  }

  const cols=[
    {label:'NPS',getV:m=>m?(m.nps>0?'+':'')+m.nps:'—',getN:m=>m?.nps,suffix:''},
    {label:'Promotores',getV:m=>m?m.proP+'%':'—',getN:m=>m?.proP,suffix:'%'},
    {label:'Pasivos',getV:m=>m?m.pasP+'%':'—',getN:m=>m?.pasP,suffix:'%'},
    {label:'Detractores',getV:m=>m?m.detP+'%':'—',getN:m=>m?.detP,suffix:'%',inv:true},
    {label:'Respuestas',getV:m=>m?m.n:'—',getN:m=>m?.n,suffix:''},
    {label:'Score prom.',getV:m=>m?m.avg:'—',getN:m=>m?.avg,suffix:'/10'},
  ];

  if(!allMonths.length)return <Empty icon={GitCompareArrows} title="Sin datos para comparar" sub="Necesitás al menos un mes de datos."/>;
  return <div>
    <Section title="Comparativa de períodos" hint="Compará el desempeño NPS entre dos años o períodos" icon={GitCompareArrows}/>
    <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:12,marginBottom:20,maxWidth:400}}>
      <Field label="Período A"><Select value={pA} onChange={e=>setPA(e.target.value)}>{years.map(y=><option key={y}>{y}</option>)}</Select></Field>
      <Field label="Período B"><Select value={pB} onChange={e=>setPB(e.target.value)}><option value="">Sin comparar</option>{years.map(y=><option key={y}>{y}</option>)}</Select></Field>
    </div>
    <Card style={{padding:0,overflow:'hidden'}}>
      <table style={{width:'100%',borderCollapse:'collapse',fontSize:13.5}}>
        <thead><tr style={{background:C.surface,color:C.tx2,fontSize:11.5}}>
          <th style={{padding:'12px 18px',fontWeight:700,textAlign:'left'}}>Métrica</th>
          <th style={{padding:'12px 18px',fontWeight:700,textAlign:'center',background:C.lila4,color:C.primary}}>{pA||'—'}</th>
          {pB&&<th style={{padding:'12px 18px',fontWeight:700,textAlign:'center'}}>{pB}</th>}
          {pB&&<th style={{padding:'12px 18px',fontWeight:700,textAlign:'center'}}>Diferencia</th>}
        </tr></thead>
        <tbody>{cols.map(({label,getV,getN,suffix,inv})=><tr key={label} style={{borderTop:`1px solid ${C.line}`}}>
          <td style={{padding:'13px 18px',fontWeight:600,color:C.tx2}}>{label}</td>
          <td style={{padding:'13px 18px',textAlign:'center',fontWeight:700,fontFamily:DISP,fontSize:16,color:C.primary,background:C.lila4+'66'}}>{getV(mA)}</td>
          {pB&&<td style={{padding:'13px 18px',textAlign:'center',fontWeight:600}}>{getV(mB)}</td>}
          {pB&&<td style={{padding:'13px 18px',textAlign:'center',fontSize:13}}><Delta a={getN(mA)} b={getN(mB)} suffix={suffix} inv={inv}/></td>}
        </tr>)}
        </tbody>
      </table>
    </Card>
  </div>;
}

/* ============================================================ CAMBIAR CONTRASEÑA (compartido admin + cliente) ============================================================ */
function ChangePasswordModal({open,onClose}){
  const [cur,setCur]=useState(''); const [next,setNext]=useState(''); const [confirm,setConfirm]=useState('');
  const [loading,setLoading]=useState(false); const [msg,setMsg]=useState(null);
  function reset(){ setCur(''); setNext(''); setConfirm(''); setMsg(null); }
  async function save(){
    if(!next||next.length<6){setMsg({bad:true,text:'La contraseña debe tener al menos 6 caracteres.'});return;}
    if(next!==confirm){setMsg({bad:true,text:'Las contraseñas no coinciden.'});return;}
    setLoading(true); setMsg(null);
    try{
      const {error}=await supabase.auth.updateUser({password:next});
      if(error){setMsg({bad:true,text:error.message});}
      else{setMsg({bad:false,text:'¡Contraseña actualizada correctamente!'}); setTimeout(()=>{onClose();reset();},1400);}
    }catch(e){setMsg({bad:true,text:'Error de red. Intentá de nuevo.'});}
    setLoading(false);
  }
  if(!open)return null;
  return <Modal open={open} onClose={()=>{onClose();reset();}} title="Cambiar contraseña" icon={ShieldCheck} width={420}>
    <Field label="Nueva contraseña" hint="Mínimo 6 caracteres"><PasswordInput value={next} onChange={e=>setNext(e.target.value)} placeholder="Nueva contraseña"/></Field>
    <Field label="Confirmar contraseña"><PasswordInput value={confirm} onChange={e=>setConfirm(e.target.value)} placeholder="Repetí la contraseña"/></Field>
    {msg&&<div style={{background:msg.bad?'#FCE7E5':'#E0F3EA',color:msg.bad?'#E5564B':'#1E9E6A',borderRadius:9,padding:'9px 12px',fontSize:13,marginBottom:8}}>{msg.text}</div>}
    <div style={{display:'flex',justifyContent:'flex-end',gap:8,marginTop:6}}>
      <Btn variant="ghost" onClick={()=>{onClose();reset();}}>Cancelar</Btn>
      <Btn icon={loading?undefined:Check} onClick={save} disabled={loading}>{loading?<><Spinner size={14} color="#fff"/>Guardando…</>:'Guardar'}</Btn>
    </div>
  </Modal>;
}

/* ============================================================ ADMIN: BENCHMARK ============================================================ */
function AdminBenchmark({db}){
  const [data,setData]=useState(null); const [loading,setLoading]=useState(false); const [err,setErr]=useState(false);
  async function load(){ setLoading(true); setErr(false);
    try{ const r=await fetch('/api/benchmark'); if(!r.ok)throw new Error(r.status); const d=await r.json(); if(d.error)throw new Error(d.error); setData(d); }
    catch(e){ setErr(true); } finally{setLoading(false);} }
  useEffect(()=>{load();},[]);
  const rows=db.clients.map(c=>{ const s=clientStats(db,c.id); const sectorAvg=data?.sectorStats?.find(x=>x.sector===c.sector)?.nps??null; return {c,s,sectorAvg}; });
  return <div>
    <Section title="Benchmark entre clientes" hint="Comparativa de NPS por sector y posición en la plataforma" icon={BarChart2}
      right={<Btn variant="ghost" icon={RotateCcw} size="sm" onClick={load} disabled={loading}>Actualizar</Btn>}/>
    {err&&<div style={{background:C.criticoBg,color:C.critico,padding:'12px 16px',borderRadius:12,marginBottom:16,fontSize:13}}>Error al cargar datos del benchmark.</div>}
    <div style={{display:'grid',gridTemplateColumns:'1.4fr 1fr',gap:14,marginBottom:16}}>
      <Card style={{padding:0,overflow:'hidden'}}>
        <div style={{padding:'14px 18px',fontWeight:700,fontSize:14,borderBottom:`1px solid ${C.line}`,fontFamily:DISP}}>Comparativa por cliente</div>
        <table style={{width:'100%',borderCollapse:'collapse',fontSize:12.5}}>
          <thead><tr style={{background:C.surface2,color:C.tx3,fontSize:11}}>{['Cliente','Sector','NPS propio','Avg sector','Diferencia'].map((h,i)=><th key={i} style={{padding:'10px 14px',fontWeight:700,textAlign:'left'}}>{h}</th>)}</tr></thead>
          <tbody>{rows.map(({c,s,sectorAvg})=>{const diff=s.nps!=null&&sectorAvg!=null?s.nps-sectorAvg:null;return<tr key={c.id} style={{borderTop:`1px solid ${C.line}`}}>
            <td style={{padding:'11px 14px',fontWeight:600}}>{c.name}</td>
            <td style={{padding:'11px 14px',color:C.tx3}}>{c.sector||'—'}</td>
            <td style={{padding:'11px 14px'}}>{s.nps!=null?<span style={{fontWeight:700,color:bandCol(npsBand(s.nps))}}>{s.nps>0?'+':''}{s.nps}</span>:'—'}</td>
            <td style={{padding:'11px 14px'}}>{sectorAvg!=null?(sectorAvg>0?'+':'')+sectorAvg:<span style={{color:C.tx3}}>Sin datos</span>}</td>
            <td style={{padding:'11px 14px'}}>{diff!=null?<Tag tone={diff>=0?'good':'bad'}>{diff>0?'+':''}{diff} pts</Tag>:'—'}</td>
          </tr>;})}
          </tbody>
        </table>
      </Card>
      <Card style={{padding:18}}>
        <div style={{fontWeight:700,fontSize:14,fontFamily:DISP,marginBottom:16}}>NPS promedio por sector</div>
        {loading&&<div style={{textAlign:'center',padding:24}}><Spinner size={20} color={C.primary}/></div>}
        {!loading&&data?.sectorStats?.length?<div style={{display:'flex',flexDirection:'column',gap:10}}>
          {data.sectorStats.map(s=><div key={s.sector}>
            <div style={{display:'flex',justifyContent:'space-between',marginBottom:4}}><span style={{fontSize:13,fontWeight:600}}>{s.sector}</span><span style={{fontSize:13,fontWeight:700,color:bandCol(npsBand(s.nps))}}>{s.nps>0?'+':''}{s.nps}</span></div>
            <div style={{height:6,borderRadius:3,background:C.line,overflow:'hidden'}}><div style={{height:'100%',width:Math.min(100,Math.max(0,(s.nps+100)/2))+'%',background:bandCol(npsBand(s.nps)),borderRadius:3}}/></div>
            <div style={{fontSize:11,color:C.tx3,marginTop:2}}>n={s.n} respuestas</div>
          </div>)}
        </div>:!loading&&<Empty icon={BarChart2} title="Sin datos suficientes" sub="Se necesitan al menos 5 respuestas por sector."/>}
        {data&&<div style={{marginTop:16,padding:'12px 14px',background:C.surface,borderRadius:12}}>
          <div style={{fontSize:11,color:C.tx3,fontWeight:700,marginBottom:6}}>PLATAFORMA GLOBAL</div>
          <div style={{display:'flex',gap:20}}>{[{v:data.globalNPS!=null?(data.globalNPS>0?'+':'')+data.globalNPS:'—',l:'NPS global',c:data.globalNPS!=null?bandCol(npsBand(data.globalNPS)):C.tx3},{v:(data.totalResponses||0).toLocaleString('es'),l:'respuestas',c:C.tx},{v:data.totalClients||0,l:'clientes',c:C.tx}].map(({v,l,c})=><div key={l}><div style={{fontFamily:DISP,fontWeight:700,fontSize:20,color:c}}>{v}</div><div style={{fontSize:11,color:C.tx3}}>{l}</div></div>)}</div>
        </div>}
      </Card>
    </div>
  </div>;
}

/* ============================================================ CLIENT: CHAT CON DATOS ============================================================ */
function ClientChat({db,clientId}){
  const [msgs,setMsgs]=useState([{role:'assistant',text:'¡Hola! Soy tu asistente NPS. Puedo ayudarte a entender tus datos, identificar tendencias y sugerir acciones. ¿En qué te puedo ayudar?'}]);
  const [input,setInput]=useState(''); const [loading,setLoading]=useState(false); const endRef=useRef(null);
  const c=db.clients.find(x=>x.id===clientId); const cd=db.data[clientId];
  const allResp=(cd?.months||[]).flatMap(m=>m.responses); const m=npsOf(allResp); const segs=bySegment(allResp,'Segmento');
  useEffect(()=>{endRef.current?.scrollIntoView({behavior:'smooth'});},[msgs]);
  const ctxStr=`Sos un asistente NPS B2B para ${c?.name||'la empresa'}. Respondé de forma concisa y accionable en español.\n\nDATOS:\n${ctxText(c)}\n${m?diagText(m,segs):'Sin datos de NPS todavía.'}\nMeses con datos: ${cd?.months?.length||0}.\nComentarios recientes: ${comments(allResp,null).slice(0,5).map(x=>`"${x.txt}"(${x.e}/10)`).join(' | ')||'ninguno'}.`;
  async function send(){ if(!input.trim()||loading)return; const userMsg=input.trim(); setInput(''); setMsgs(prev=>[...prev,{role:'user',text:userMsg}]); setLoading(true);
    try{ const history=msgs.map(x=>`${x.role==='user'?'Usuario':'Asistente'}: ${x.text}`).join('\n'); const res=await callClaude(`${ctxStr}\n\nCONVERSACIÓN:\n${history}\n\nUsuario: ${userMsg}\n\nAsistente:`,900); setMsgs(prev=>[...prev,{role:'assistant',text:res}]); }
    catch(e){ setMsgs(prev=>[...prev,{role:'assistant',text:'Hubo un error. Por favor intentá de nuevo.'}]); } finally{setLoading(false);} }
  return <div>
    <Section title="Chat con datos" hint="Consultá tu NPS con IA — responde en base a tus datos reales" icon={Bot}/>
    <Card style={{padding:0,overflow:'hidden',display:'flex',flexDirection:'column',height:'calc(100vh - 210px)',minHeight:400}}>
      <div style={{flex:1,overflow:'auto',padding:20,display:'flex',flexDirection:'column',gap:12}}>
        {msgs.map((msg,i)=><div key={i} style={{display:'flex',justifyContent:msg.role==='user'?'flex-end':'flex-start'}}>
          {msg.role==='assistant'&&<div style={{width:28,height:28,borderRadius:8,background:C.grad,display:'grid',placeItems:'center',color:'#fff',flexShrink:0,marginRight:8,alignSelf:'flex-start',marginTop:2}}><Bot size={14}/></div>}
          <div style={{maxWidth:'75%',background:msg.role==='user'?C.grad:'#fff',color:msg.role==='user'?'#fff':C.tx,padding:'12px 16px',borderRadius:msg.role==='user'?'16px 16px 4px 16px':'16px 16px 16px 4px',fontSize:13.5,lineHeight:1.6,border:msg.role==='assistant'?`1px solid ${C.line}`:'none',boxShadow:msg.role==='user'?'0 4px 14px rgba(115,1,123,.3)':'0 1px 3px rgba(26,10,28,.05)',whiteSpace:'pre-wrap'}}>{msg.text}</div>
        </div>)}
        {loading&&<div style={{display:'flex',alignItems:'center',gap:8}}><div style={{width:28,height:28,borderRadius:8,background:C.grad,display:'grid',placeItems:'center',color:'#fff',flexShrink:0}}><Bot size={14}/></div><div style={{background:'#fff',border:`1px solid ${C.line}`,borderRadius:'16px 16px 16px 4px',padding:'12px 16px'}}><Spinner size={14} color={C.primary}/></div></div>}
        <div ref={endRef}/>
      </div>
      <div style={{borderTop:`1px solid ${C.line}`,padding:'12px 16px',display:'flex',gap:8,background:'#fff'}}>
        <input value={input} onChange={e=>setInput(e.target.value)} onKeyDown={e=>{if(e.key==='Enter'&&!e.shiftKey){e.preventDefault();send();}}} placeholder="Preguntá sobre tu NPS, tendencias, detractores..." style={{...inputCss,flex:1}} disabled={loading}/>
        <Btn onClick={send} disabled={loading||!input.trim()} icon={Send}>Enviar</Btn>
      </div>
    </Card>
  </div>;
}

/* ============================================================ CLIENT: INFORME EJECUTIVO ============================================================ */
function ClientInforme({db,clientId}){
  const [informe,setInforme]=useState(''); const [loading,setLoading]=useState(false); const [err,setErr]=useState(false);
  const c=db.clients.find(x=>x.id===clientId); const cd=db.data[clientId];
  const allResp=(cd?.months||[]).flatMap(m=>m.responses); const m=npsOf(allResp); const segs=bySegment(allResp,'Segmento');
  const months=(cd?.months||[]).slice().sort((a,b)=>a.month<b.month?-1:1);
  const trend=months.map(mo=>{const x=npsOf(mo.responses);return x?`${mLabel(mo.month)}: NPS ${x.nps>0?'+':''}${x.nps}(n=${x.n})`:null;}).filter(Boolean);
  const commentsPro=comments(allResp,'pro').slice(0,5); const commentsDet=comments(allResp,'det').slice(0,5);
  async function generate(){ setLoading(true); setErr(false);
    const prompt=`Sos consultor senior de experiencia del cliente. Generá un informe ejecutivo profesional en español para la dirección (máx 500 palabras).

EMPRESA: ${ctxText(c)}
DATOS NPS: ${m?diagText(m,segs):'Sin datos suficientes.'}
Evolución mensual: ${trend.join(' → ')||'Sin histórico.'}
VOCES PROMOTORES: ${commentsPro.map(x=>`"${x.txt}"`).join(' | ')||'Sin comentarios.'}
VOCES DETRACTORES: ${commentsDet.map(x=>`"${x.txt}"`).join(' | ')||'Sin comentarios.'}

Incluí: 1. Síntesis ejecutiva. 2. Puntos fuertes. 3. Alertas y oportunidades. 4. Recomendaciones (3 acciones). 5. Conclusión. Usá secciones tituladas.`;
    try{ const res=await callClaude(prompt,1600); setInforme(res); }
    catch(e){ setErr(true); } finally{setLoading(false);} }
  return <div>
    <Section title="Informe ejecutivo" hint="Generá un informe PDF listo para presentar a dirección" icon={FileText}
      right={<div style={{display:'flex',gap:8}}>
        <Btn variant="ghost" icon={Printer} onClick={()=>window.print()} disabled={!informe}>Imprimir / PDF</Btn>
        <Btn icon={Sparkles} onClick={generate} disabled={loading}>{loading?<><Spinner size={14}/>Generando…</>:'Generar informe'}</Btn>
      </div>}/>
    {err&&<div style={{background:C.criticoBg,color:C.critico,padding:'12px 16px',borderRadius:12,marginBottom:16,fontSize:13}}>No se pudo generar el informe. Verificá la conexión con la IA.</div>}
    {!informe&&!loading&&<Card style={{padding:48,textAlign:'center'}}>
      <div style={{fontSize:48,marginBottom:16}}>📋</div>
      <div style={{fontFamily:DISP,fontWeight:700,fontSize:18,color:C.tx2,marginBottom:8}}>Informe ejecutivo con IA</div>
      <div style={{fontSize:13.5,color:C.tx3,maxWidth:400,margin:'0 auto 24px'}}>La IA analiza tu NPS, tendencias y comentarios para generar un informe ejecutivo listo para presentar.</div>
      <Btn icon={Sparkles} onClick={generate}>Generar informe ahora</Btn>
    </Card>}
    {loading&&<Card style={{padding:48,textAlign:'center'}}><Spinner size={28} color={C.primary}/><div style={{marginTop:16,color:C.tx2,fontFamily:DISP,fontWeight:600}}>Analizando datos y generando informe…</div></Card>}
    {informe&&<Card style={{padding:32}}>
      <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:24,paddingBottom:16,borderBottom:`1px solid ${C.line}`}}>
        <div>
          <div style={{fontFamily:DISP,fontWeight:700,fontSize:22,color:C.tx}}>Informe Ejecutivo NPS</div>
          <div style={{fontSize:13,color:C.tx3,marginTop:4}}>{c?.name} · {new Date().toLocaleDateString('es-AR',{day:'numeric',month:'long',year:'numeric'})}</div>
        </div>
        <Wordmark size={16} sub={false}/>
      </div>
      <div style={{fontSize:14.5,lineHeight:1.8,color:C.tx,whiteSpace:'pre-wrap'}}>{informe}</div>
    </Card>}
  </div>;
}

/* ============================================================ NAV + SHELL ============================================================ */
function NavItem({icon:Icon,label,active,onClick,badge}){
  return <button onClick={onClick} style={{display:'flex',alignItems:'center',gap:11,width:'100%',padding:'11px 13px',borderRadius:11,border:'none',cursor:'pointer',marginBottom:3,textAlign:'left',
    background:active?C.lila3:'transparent',color:active?C.primary:C.tx2,fontWeight:active?700:600,fontSize:13.5,transition:'all .12s'}}>
    <Icon size={18} style={{color:active?C.magenta:C.tx3}}/><span style={{flex:1}}>{label}</span>
    {badge>0&&<span style={{display:'inline-flex',placeItems:'center',background:C.critico,color:'#fff',borderRadius:20,fontSize:10,fontWeight:700,minWidth:18,height:18,justifyContent:'center',padding:'0 5px'}}>{badge}</span>}
  </button>;
}
function Shell({nav,active,setActive,topRight,brandSub,children,accentName}){
  return <div style={{minHeight:'100vh',display:'flex',background:C.surface2}}>
    <aside style={{width:240,background:'#fff',borderRight:`1px solid ${C.line}`,padding:'20px 16px',display:'flex',flexDirection:'column',position:'sticky',top:0,height:'100vh'}}>
      <div style={{padding:'2px 6px 18px'}}><Wordmark size={19}/></div>
      <div style={{fontSize:10.5,fontWeight:700,color:C.tx3,letterSpacing:.5,padding:'4px 10px 8px'}}>{accentName}</div>
      <nav style={{flex:1}}>{nav.map(n=> <NavItem key={n.key} icon={n.icon} label={n.label} active={active===n.key} onClick={()=>setActive(n.key)}/>)}</nav>
      <div style={{fontSize:11,color:C.tx3,padding:'12px 10px 2px',borderTop:`1px solid ${C.line2}`}}>{brandSub}</div>
    </aside>
    <main style={{flex:1,minWidth:0}}>
      <header style={{position:'sticky',top:0,zIndex:20,background:'rgba(255,255,255,.85)',backdropFilter:'blur(8px)',borderBottom:`1px solid ${C.line}`,padding:'12px 28px',display:'flex',alignItems:'center',gap:12}}>
        <div style={{fontWeight:700,fontSize:15,fontFamily:DISP}}>{nav.find(n=>n.key===active)?.label}</div>
        <div style={{marginLeft:'auto',display:'flex',alignItems:'center',gap:10}}>{topRight}</div>
      </header>
      <div style={{padding:'10px 28px 56px',maxWidth:1180,margin:'0 auto'}}>{children}</div>
    </main>
  </div>;
}

function AdminApp({db,update,onLogout}){
  const navigate=useNavigate(); const location=useLocation();
  const [newDetCount,setNewDetCount]=useState(0);
  useRealtimeSurvey(update,()=>setNewDetCount(n=>n+1));
  const [chgPwd,setChgPwd]=useState(false);

  const seg=location.pathname.split('/')[2]||'panel';
  const handleSetView=(v)=>{ if(v==='detractores')setNewDetCount(0); navigate('/admin/'+v); };
  const goClient=(id)=>navigate('/cliente/'+id,{state:{fromAdmin:true}});

  const nav=[
    {key:'panel',label:'Panel ejecutivo',icon:Home},
    {key:'detractores',label:'Detractores',icon:Bell,badge:newDetCount},
    {key:'uso',label:'Uso',icon:Activity},
    {key:'benchmark',label:'Benchmark',icon:BarChart2},
    {key:'cross',label:'Cross-sell IA',icon:Sparkles},
  ];
  return <><ChangePasswordModal open={chgPwd} onClose={()=>setChgPwd(false)}/>
  <Shell nav={nav} active={seg} setActive={handleSetView} accentName="ADMINISTRACIÓN" brandSub="PromotIA · Delenio People"
    topRight={<><a href="https://hub.talenio.tech" target="_blank" rel="noreferrer" style={{padding:'5px 12px',borderRadius:7,background:'#73017B',color:'#fff',fontSize:12,fontWeight:700,textDecoration:'none'}}>Gestionar clientes y usuarios →</a><Tag tone="brand"><ShieldCheck size={12} style={{marginRight:4,verticalAlign:'-2px'}}/>Admin</Tag><Btn size="sm" variant="ghost" icon={Settings} onClick={()=>setChgPwd(true)}>Contraseña</Btn><Btn size="sm" variant="ghost" icon={LogOut} onClick={onLogout}>Salir</Btn></>}>
    <Routes>
      <Route index element={<Navigate to="/admin/panel" replace/>}/>
      <Route path="panel" element={<AdminPanel db={db} newDetCount={newDetCount} goClient={goClient}/>}/>
      <Route path="detractores" element={<AdminDetractores db={db} update={update}/>}/>
      <Route path="uso" element={<AdminUso db={db}/>}/>
      <Route path="benchmark" element={<AdminBenchmark db={db}/>}/>
      <Route path="cross" element={<AdminCrossSell db={db}/>}/>
      <Route path="*" element={<Navigate to="/admin/panel" replace/>}/>
    </Routes>
  </Shell></>;
}

function ClientAppShell({db,update,onLogout}){
  const {clientId}=useParams(); const navigate=useNavigate(); const location=useLocation();
  const [chgPwd,setChgPwd]=useState(false);
  const fromAdmin=location.state?.fromAdmin||false;
  const c=db.clients.find(x=>x.id===clientId);
  const seg=location.pathname.split('/')[3]||'resumen';
  const nav=[
    {key:'resumen',label:'NPS del año',icon:LayoutDashboard},
    {key:'historico',label:'Dashboard histórico',icon:BarChart3},
    {key:'comparativa',label:'Comparativa',icon:GitCompareArrows},
    {key:'voces',label:'Voz del cliente',icon:Quote},
    {key:'chat',label:'Chat con IA',icon:Bot},
    {key:'informe',label:'Informe ejecutivo',icon:FileText},
    {key:'contexto',label:'Mi empresa',icon:Package},
    {key:'plan',label:'Plan de acción',icon:ClipboardList},
  ];
  return <><ChangePasswordModal open={chgPwd} onClose={()=>setChgPwd(false)}/>
  <Shell nav={nav} active={seg} setActive={(v)=>navigate(`/cliente/${clientId}/${v}`,{state:{fromAdmin}})} accentName={(c?.name||'CLIENTE').toUpperCase()} brandSub={c?.name}
    topRight={<>
      <span style={{display:'inline-flex',alignItems:'center',gap:7,fontSize:13,color:C.tx2}}><span style={{display:'grid',placeItems:'center',width:28,height:28,borderRadius:8,background:C.grad,color:'#fff',fontWeight:700,fontFamily:DISP,fontSize:13}}>{c?.name[0]}</span>{c?.name}</span>
      {!fromAdmin&&<Btn size="sm" variant="ghost" icon={Settings} onClick={()=>setChgPwd(true)}>Contraseña</Btn>}
      {fromAdmin?<Btn size="sm" variant="ghost" icon={ArrowLeft} onClick={()=>navigate('/admin')}>Volver a admin</Btn>:<Btn size="sm" variant="ghost" icon={LogOut} onClick={onLogout}>Salir</Btn>}
    </>}>
    <Routes>
      <Route index element={<Navigate to={`/cliente/${clientId}/resumen`} replace/>}/>
      <Route path="resumen" element={<ClientResumen db={db} clientId={clientId}/>}/>
      <Route path="historico" element={<ClientHistorico db={db} clientId={clientId}/>}/>
      <Route path="comparativa" element={<ClientComparativa db={db} clientId={clientId}/>}/>
      <Route path="voces" element={<ClientVoces db={db} clientId={clientId} update={update}/>}/>
      <Route path="chat" element={<ClientChat db={db} clientId={clientId}/>}/>
      <Route path="informe" element={<ClientInforme db={db} clientId={clientId}/>}/>
      <Route path="contexto" element={<ClientContexto db={db} clientId={clientId} update={update}/>}/>
      <Route path="plan" element={<ClientPlan db={db} clientId={clientId} update={update}/>}/>
      <Route path="*" element={<Navigate to={`/cliente/${clientId}/resumen`} replace/>}/>
    </Routes>
  </Shell></>;
}

/* ============================================================ ROOT ============================================================ */
export default function PromotIA({ onLogout }){
  const [db,setDb]=useState(null);
  const [loading,setLoading]=useState(true);
  const [loadError,setLoadError]=useState(null);

  useEffect(()=>{ (async()=>{
    try{
      const r=await storage.get(DB_KEY);
      if(r?.value){ setDb(JSON.parse(r.value)); setLoading(false); return; }
      // Primer uso — sin datos aún
      const seed=seedDB();
      await storage.set(DB_KEY, JSON.stringify(seed));
      setDb(seed); setLoading(false);
    }catch(e){
      setLoadError('No se pudo conectar al servidor. Verificá tu conexión e intentá de nuevo.');
      setLoading(false);
    }
  })(); },[]);

  function update(fn){ setDb(prev=>{ const next=JSON.parse(JSON.stringify(prev)); fn(next);
    (async()=>{ try{ await storage.set(DB_KEY, JSON.stringify(next)); }catch(e){ console.error('Error guardando estado:', e); } })();
    return next; }); }

  if(loading) return <div className="promotia"><GlobalStyle/><div style={{minHeight:'100vh',display:'grid',placeItems:'center',background:C.surface2}}><div style={{textAlign:'center'}}><div style={{display:'inline-grid',placeItems:'center',marginBottom:14}}><Mark size={52}/></div><div style={{display:'flex',alignItems:'center',gap:9,color:C.tx2,fontWeight:600}}><Spinner size={16} color={C.primary}/>Cargando PromotIA…</div></div></div></div>;
  if(loadError) return <div className="promotia"><GlobalStyle/><div style={{minHeight:'100vh',display:'grid',placeItems:'center',background:C.surface2}}><div style={{textAlign:'center',maxWidth:360,padding:32}}><Mark size={52}/><h2 style={{fontSize:20,fontWeight:700,margin:'16px 0 8px',color:C.tx}}>Error de conexión</h2><p style={{fontSize:14,color:C.tx2,lineHeight:1.6,marginBottom:20}}>{loadError}</p><button onClick={()=>window.location.reload()} style={{padding:'10px 24px',borderRadius:10,background:C.primary,color:'#fff',border:'none',fontWeight:700,fontSize:14,cursor:'pointer'}}>Reintentar</button></div></div></div>;
  if(!db) return null;

  return <div className="promotia"><GlobalStyle/>
    <Routes>
      <Route path="/admin/*" element={<AdminApp db={db} update={update} onLogout={onLogout}/>}/>
      <Route path="/cliente/:clientId/*" element={<ClientAppShell db={db} update={update} onLogout={onLogout}/>}/>
      <Route path="*" element={<Navigate to="/admin" replace/>}/>
    </Routes>
  </div>;
}

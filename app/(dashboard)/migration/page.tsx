'use client';

import { useState, useCallback, useRef, useEffect, type ElementType, type ReactNode } from 'react';
import { useRouter } from 'next/navigation';
import {
  Upload, FileText, Brain, CheckCircle, Rocket, X, Loader2,
  AlertTriangle, FolderOpen, ChevronRight, RefreshCw, Activity,
  BarChart3, Shield, Users, ClipboardList, TrendingUp, Eye, EyeOff,
  Building2, ShoppingCart, Zap, Key, Map, Cpu, Calendar, FileCode,
  Archive, ChevronDown, ChevronUp, FilePlus, Sparkles,
} from 'lucide-react';
import { useProjectStore, type Domaine, type Projet, type TacheWBS } from '@/lib/projectStore';
import { useAuth } from '@/lib/authStore';
import type { SSEEvent, AgentId, SwarmContext, SwarmInputFile } from '@/lib/ai/types';
import { swarmContextToProjetPatch, swarmContextToIndicators } from '@/lib/swarmToStore';
import { extractAllFiles } from '@/lib/ai/extractors/fileExtractor';
import { useIndicatorStore } from '@/lib/indicatorStore';
import toast from 'react-hot-toast';
/* ── Design tokens ─────────────────────────────────────────────────────────── */
const T = {
  purple:  '#2D1167',
  violet:  '#7C3AED',
  violet10:'#F5F3FF',
  violet20:'#EDE9FE',
  success: '#059669',
  warn:    '#D97706',
  danger:  '#DC2626',
  info:    '#2563EB',
  bg:      '#F1F5F9',
  card:    '#FFFFFF',
  border:  '#E2E8F0',
  muted:   '#94A3B8',
  text:    '#0F172A',
  sub:     '#475569',
  shadow:  '0 1px 3px rgba(0,0,0,.06), 0 1px 2px rgba(0,0,0,.04)',
  shadowMd:'0 4px 16px rgba(0,0,0,.08)',
};

/* ── Format registry ───────────────────────────────────────────────────────── */
interface FmtDef { exts: string[]; label: string; domain: string; icon: ElementType; color: string }
const FMT_DEFS: FmtDef[] = [
  { exts:['pdf'],            label:'PDF',           domain:'Document',      icon:FileText,  color:'#DC2626' },
  { exts:['xlsx','xls'],     label:'Excel',         domain:'Tableur',       icon:BarChart3, color:'#059669' },
  { exts:['csv'],            label:'CSV',           domain:'Tableur',       icon:FileText,  color:'#0891B2' },
  { exts:['docx','doc'],     label:'Word',          domain:'Document',      icon:FileText,  color:'#2563EB' },
  { exts:['dxf'],            label:'DXF (CAO)',     domain:'Plans/DAO',     icon:FileCode,  color:'#7C3AED' },
  { exts:['dwg'],            label:'DWG (CAO)',     domain:'Plans/DAO',     icon:FileCode,  color:'#9333EA' },
  { exts:['kml','kmz'],      label:'KML/KMZ',       domain:'SIG/Géo',       icon:Map,       color:'#D97706' },
  { exts:['shp','dbf'],      label:'Shapefile',     domain:'SIG/Géo',       icon:Map,       color:'#B45309' },
  { exts:['scd','cid','icd'],label:'SCADA CEI 61850',domain:'SCADA',        icon:Cpu,       color:'#0F766E' },
  { exts:['xer'],            label:'XER Planning', domain:'Planning',      icon:Calendar,  color:'#1D4ED8' },
  { exts:['mpp','xml'],      label:'MPP Planning',    domain:'Planning',      icon:Calendar,  color:'#1E40AF' },
  { exts:['zip','rar'],      label:'Archive',       domain:'Archive',       icon:Archive,   color:'#64748B' },
  { exts:['png','jpg','jpeg','tiff','tif','bmp'], label:'Image / PDF scanné', domain:'Document scanné', icon:FileText, color:'#DC2626' },
  { exts:['svg','pptx','ppt'], label:'Présentation', domain:'Autre', icon:FileText, color:'#64748B' },
];
const getFmt = (ext: string) => FMT_DEFS.find(f => f.exts.includes(ext.toLowerCase()));

/* ── Agent config ──────────────────────────────────────────────────────────── */
interface AgentUI {
  id: AgentId; label: string; icon: ElementType; color: string; phase: 1|2|3;
  status: 'idle'|'running'|'done'|'error'; summary?: string; durationMs?: number;
}
const AGENTS: AgentUI[] = [
  // Phase 1 — 9 agents
  { id:'business_analyst',label:'Business Analyst', icon:ClipboardList, color:'#7C3AED', phase:1, status:'idle' },
  { id:'planificateur',   label:'Planificateur',    icon:BarChart3,     color:'#2563EB', phase:1, status:'idle' },
  { id:'financier',       label:'Financier',        icon:TrendingUp,    color:'#059669', phase:1, status:'idle' },
  { id:'risques',         label:'Risk Analyst',     icon:Shield,        color:'#DC2626', phase:1, status:'idle' },
  { id:'qhse',            label:'QHSE',             icon:AlertTriangle, color:'#D97706', phase:1, status:'idle' },
  { id:'sig',             label:'SIG / Géospatial', icon:Map,           color:'#B45309', phase:1, status:'idle' },
  { id:'bordereaux',      label:'BPU / Bordereaux', icon:FileCode,      color:'#0F766E', phase:1, status:'idle' },
  { id:'programmes',      label:'Programmes',       icon:Sparkles,      color:'#6D28D9', phase:1, status:'idle' },
  { id:'erp',             label:'ERP / Imputation', icon:Cpu,           color:'#1D4ED8', phase:1, status:'idle' },
  // Phase 2 — 5 agents
  { id:'ressources',      label:'Ressources',       icon:Users,         color:'#0891B2', phase:2, status:'idle' },
  { id:'suivi_eval',      label:'Suivi-Éval',       icon:Activity,      color:'#9333EA', phase:2, status:'idle' },
  { id:'marches',         label:'Marchés',          icon:ShoppingCart,  color:'#16A34A', phase:2, status:'idle' },
  { id:'fournisseurs',    label:'Fournisseurs',     icon:Building2,     color:'#0369A1', phase:2, status:'idle' },
  { id:'reception',       label:'Réception Travaux',icon:CheckCircle,   color:'#15803D', phase:2, status:'idle' },
  // Phase 3 — 4 agents
  { id:'reporting',       label:'Reporting T1–T4',  icon:FilePlus,      color:'#92400E', phase:3, status:'idle' },
  { id:'courriers',       label:'Courriers / ODS',  icon:Archive,       color:'#4338CA', phase:3, status:'idle' },
  { id:'documentaire',    label:'GED Doc',          icon:FolderOpen,    color:'#64748B', phase:3, status:'idle' },
  { id:'chef_projet',     label:'Chef Projet',      icon:Zap,           color:'#1E40AF', phase:3, status:'idle' },
];

/* ── Types ─────────────────────────────────────────────────────────────────── */
interface UFile { id:string; file:File; name:string; size:number; ext:string; domain?:string }
type Step = 'upload'|'swarm'|'preview'|'validate'|'done';

/* ── Utils ──────────────────────────────────────────────────────────────────── */
const fmt = (b:number) => b<1024?`${b}o`:b<1e6?`${(b/1024).toFixed(1)}Ko`:`${(b/1e6).toFixed(1)}Mo`;
const inferDomaine = (n='',t=''):Domaine => {
  const s=(n+' '+t).toLowerCase();
  if(/transport|225|90\s*kv|htb/.test(s)) return 'transport';
  if(/production|centrale|solaire/.test(s)) return 'production';
  if(/génie civil|bâtiment/.test(s)) return 'genie_civil';
  if(/commercial|compteur/.test(s)) return 'commercial';
  return 'distribution';
};

const ALLOWED = new Set(['pdf','xlsx','xls','csv','docx','doc','dxf','dwg','kml','kmz','shp','dbf','scd','cid','icd','xer','mpp','xml','zip','rar','png','jpg','jpeg','tiff','tif','bmp','svg','pptx','ppt']);

/* ══════════════════════════════════════════════════════════════════════════════
   COMPOSANTS
══════════════════════════════════════════════════════════════════════════════ */

/* Stepper horizontal */
function Stepper({ current }: { current: Step }) {
  const steps: { id: Step; label: string; icon: ElementType }[] = [
    { id:'upload',   label:'Documents',  icon:Upload },
    { id:'swarm',    label:'Analyse IA', icon:Brain },
    { id:'preview',  label:'Aperçu',     icon:Eye },
    { id:'validate', label:'Validation', icon:CheckCircle },
    { id:'done',     label:'SIGEPP',     icon:Rocket },
  ];
  const ci = steps.findIndex(s => s.id === current);
  return (
    <div style={{ display:'flex', alignItems:'center', background:T.card, borderRadius:14, padding:'10px 20px', boxShadow:T.shadow, border:`1px solid ${T.border}`, marginBottom:24, gap:0, overflowX:'auto' }}>
      {steps.map((s, i) => {
        const Icon = s.icon;
        const past = i < ci, active = i === ci;
        return (
          <div key={s.id} style={{ display:'flex', alignItems:'center', flexShrink:0 }}>
            <div style={{ display:'flex', alignItems:'center', gap:8, padding:'7px 14px', borderRadius:10,
              background: active ? T.purple : 'transparent',
              transition:'all .2s',
            }}>
              <div style={{ width:24, height:24, borderRadius:'50%', display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0,
                background: past ? '#DCFCE7' : active ? 'rgba(255,255,255,.15)' : T.bg,
              }}>
                {past ? <CheckCircle size={13} color={T.success} /> : <Icon size={13} color={active ? '#fff' : T.muted} />}
              </div>
              <span style={{ fontSize:12.5, fontWeight:active?700:500, color:active?'#fff':past?T.success:T.muted, whiteSpace:'nowrap' }}>
                {s.label}
              </span>
            </div>
            {i < steps.length-1 && (
              <div style={{ width:24, height:2, background:i < ci ? T.success : T.border, margin:'0 2px', borderRadius:2, flexShrink:0 }} />
            )}
          </div>
        );
      })}
    </div>
  );
}

/* Card section */
function Section({ title, icon:Icon, color=T.violet, children, right }: { title:string; icon:ElementType; color?:string; children:ReactNode; right?:ReactNode }) {
  return (
    <div style={{ background:T.card, borderRadius:14, boxShadow:T.shadow, border:`1px solid ${T.border}`, overflow:'hidden' }}>
      <div style={{ padding:'14px 20px', borderBottom:`1px solid ${T.border}`, display:'flex', alignItems:'center', justifyContent:'space-between' }}>
        <div style={{ display:'flex', alignItems:'center', gap:10 }}>
          <div style={{ width:30, height:30, borderRadius:8, background:`${color}15`, display:'flex', alignItems:'center', justifyContent:'center' }}>
            <Icon size={14} color={color} />
          </div>
          <span style={{ fontSize:13, fontWeight:700, color:T.text }}>{title}</span>
        </div>
        {right}
      </div>
      <div style={{ padding:'18px 20px' }}>{children}</div>
    </div>
  );
}

/* Agent card */
function AgentCard({ agent }: { agent:AgentUI }) {
  const Icon = agent.icon;
  const running = agent.status==='running';
  const done    = agent.status==='done';
  const isError = agent.status==='error';
  const idle    = agent.status==='idle';
  return (
    <div style={{
      borderRadius:10, padding:'10px 12px', position:'relative', overflow:'hidden',
      border:`1.5px solid ${done ? agent.color : running ? agent.color : T.border}`,
      background: done ? `${agent.color}0D` : running ? `${agent.color}12` : T.bg,
      transition:'all .25s',
    }}>
      {running && (
        <div style={{ position:'absolute', top:0, left:0, height:2, width:'100%', background:`linear-gradient(90deg,transparent,${agent.color},transparent)`, animation:'bar 1.8s ease infinite' }} />
      )}
      <div style={{ display:'flex', alignItems:'center', gap:8 }}>
        <div style={{ width:26, height:26, borderRadius:6, flexShrink:0, display:'flex', alignItems:'center', justifyContent:'center',
          background: (done||running) ? `${agent.color}20` : '#E2E8F0',
        }}>
          <Icon size={12} color={(done||running) ? agent.color : T.muted} />
        </div>
        <div style={{ flex:1, minWidth:0 }}>
          <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', gap:4 }}>
            <span style={{ fontSize:11.5, fontWeight:700, color:(done||running)?T.text:T.muted, whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis' }}>
              {agent.label}
            </span>
            <div style={{ flexShrink:0 }}>
              {running   && <Loader2 size={11} color={agent.color} style={{ animation:'spin 1s linear infinite' }} />}
              {done      && <CheckCircle size={11} color={agent.color} />}
              {isError   && <AlertTriangle size={11} color={T.danger} />}
              {idle      && <div style={{ width:6, height:6, borderRadius:'50%', background:T.border }} />}
            </div>
          </div>
          {agent.durationMs && <span style={{ fontSize:9.5, color:agent.color, fontWeight:700 }}>{(agent.durationMs/1000).toFixed(1)}s</span>}
          {agent.summary && (
            <div style={{ fontSize:10, color:T.sub, marginTop:3, lineHeight:1.4, overflow:'hidden', display:'-webkit-box', WebkitLineClamp:2, WebkitBoxOrient:'vertical' as const }}>
              {agent.summary}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

/* KPI card */
function KpiCard({ label, value, sub, color, icon:Icon }: { label:string; value:string|number; sub:string; color:string; icon:ElementType }) {
  return (
    <div style={{ background:T.card, border:`1px solid ${T.border}`, borderRadius:12, padding:'16px', boxShadow:T.shadow, borderTop:`3px solid ${color}` }}>
      <div style={{ display:'flex', alignItems:'center', gap:8, marginBottom:8 }}>
        <div style={{ width:28, height:28, borderRadius:7, background:`${color}15`, display:'flex', alignItems:'center', justifyContent:'center' }}>
          <Icon size={13} color={color} />
        </div>
        <span style={{ fontSize:11, fontWeight:600, color:T.muted, textTransform:'uppercase', letterSpacing:'.04em' }}>{label}</span>
      </div>
      <div style={{ fontSize:22, fontWeight:900, color:T.text, lineHeight:1.1 }}>{value}</div>
      <div style={{ fontSize:11, color:color, fontWeight:600, marginTop:4 }}>{sub}</div>
    </div>
  );
}

/* Champ formulaire */
function Field({ label, value, onChange, placeholder, type='text' }: { label:string; value:string; onChange:(v:string)=>void; placeholder?:string; type?:string }) {
  return (
    <div>
      <label style={{ display:'block', fontSize:10.5, fontWeight:700, color:T.muted, textTransform:'uppercase', letterSpacing:'.05em', marginBottom:5 }}>{label}</label>
      <input
        type={type} value={value} placeholder={placeholder}
        onChange={e => onChange(e.target.value)}
        style={{ width:'100%', padding:'9px 12px', border:`1.5px solid ${T.border}`, borderRadius:9, fontSize:13, fontFamily:'inherit', color:T.text, background:T.card, transition:'border-color .15s, box-shadow .15s', boxSizing:'border-box', outline:'none' }}
        onFocus={e => { e.target.style.borderColor=T.violet; e.target.style.boxShadow=`0 0 0 3px ${T.violet}22`; }}
        onBlur={e  => { e.target.style.borderColor=T.border;  e.target.style.boxShadow='none'; }}
      />
    </div>
  );
}

/* ══════════════════════════════════════════════════════════════════════════════
   PAGE PRINCIPALE
══════════════════════════════════════════════════════════════════════════════ */
export default function MigrationPage() {
  const router = useRouter();
  const store         = useProjectStore();
  const { user }      = useAuth();
  const indStore      = useIndicatorStore();

  const [step, setStep]   = useState<Step>('upload');
  const [files, setFiles] = useState<UFile[]>([]);
  const [drag,  setDrag]  = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const [agents, setAgents]       = useState<AgentUI[]>(AGENTS.map(a => ({ ...a })));
  const [logs,   setLogs]         = useState<SSEEvent[]>([]);
  const [ctx,    setCtx]          = useState<SwarmContext|null>(null);
  const [phase,  setPhase]        = useState<0|1|2|3|4>(0);
  const [running,setRunning]      = useState(false);
  const [errMsg, setErrMsg]       = useState('');
  const logsRef = useRef<HTMLDivElement>(null);

  const [nomProjet,  setNom]      = useState('');
  const [codeProjet, setCode]     = useState('');
  const [typeProjet, setType]     = useState('Électrification rurale');
  const [dateDebut,  setDDebut]   = useState(() => new Date().toISOString().slice(0,10));
  const [dateFin,    setDFin]     = useState(() => { const d=new Date(); d.setFullYear(d.getFullYear()+2); return d.toISOString().slice(0,10); });
  const [budget,     setBudget]   = useState('500');
  const [bailleur,   setBailleur] = useState('IDA / Banque Mondiale');
  const [programme,  setProg]     = useState('PASER / PSES');
  const [kimiKey,    setKimi]     = useState(() => typeof window!=='undefined'?(localStorage.getItem('sigepp_kimi_key')||''):'');
  const [showKey,    setShowKey]  = useState(false);
  const [formOpen,   setFormOpen] = useState(true);
  const [createdId,  setCreated]  = useState('');
  const [extracting, setExtracting] = useState(false);
  const [extractPct, setExtractPct] = useState(0);

  useEffect(() => { logsRef.current?.scrollIntoView({ behavior:'smooth' }); }, [logs]);

  /* ── Upload ── */
  const addFiles = useCallback((list: FileList|File[]) => {
    const added: UFile[] = [];
    for (const f of Array.from(list)) {
      const ext = f.name.split('.').pop()?.toLowerCase() ?? '';
      if (!ALLOWED.has(ext)) { toast.error(`.${ext} non supporté`); continue; }
      if (f.size > 100e6)     { toast.error(`Trop volumineux : ${f.name}`); continue; }
      const domain = getFmt(ext)?.domain;
      added.push({ id:Math.random().toString(36).slice(2), file:f, name:f.name, size:f.size, ext, domain });
    }
    if (!added.length) return;
    setFiles(prev => {
      const names = new Set(prev.map(p => p.name));
      return [...prev, ...added.filter(a => !names.has(a.name))];
    });
    if (!nomProjet && added[0]) {
      const g = added[0].name.replace(/\.[^.]+$/,'').replace(/[_\-]/g,' ');
      if (g.length>3) setNom(g);
    }
  }, [nomProjet]);

  /* ── Swarm ── */
  const startSwarm = useCallback(async () => {
    if (running) return;
    setRunning(true); setErrMsg(''); setLogs([]); setCtx(null); setPhase(0);
    setAgents(AGENTS.map(a => ({ ...a, status:'idle', summary:undefined, durationMs:undefined })));
    if (kimiKey) localStorage.setItem('sigepp_kimi_key', kimiKey);
    let finalCtx: SwarmContext|null = null;
    try {
      // ── Phase pré-swarm : extraction contenu documents ─────────────────────
      let swarmFiles: SwarmInputFile[];
      if (files.length > 0) {
        setExtracting(true); setExtractPct(0);
        swarmFiles = await extractAllFiles(files, (done, total) => {
          setExtractPct(Math.round((done / total) * 100));
        });
        setExtracting(false);
      } else {
        swarmFiles = files.map(f => ({ name: f.name, ext: f.ext, size: f.size }));
      }

      const resp = await fetch('/api/swarm', {
        method:'POST', headers:{ 'Content-Type':'application/json' },
        body: JSON.stringify({ files: swarmFiles,
          projectOverrides:{ nomProjet:nomProjet||undefined, codeProjet:codeProjet||undefined,
            typeProjet:typeProjet||undefined, dateDebut:dateDebut||undefined,
            dateFinPrevue:dateFin||undefined, budgetEstime:parseFloat(budget)||undefined,
            bailleur:bailleur||undefined, programme:programme||undefined, chefProjetNom:user?.nom||undefined },
          userId:user?.id??'anon' }),
      });
      if (!resp.ok||!resp.body) throw new Error(`API ${resp.status}`);
      const reader = resp.body.getReader();
      const dec = new TextDecoder(); let buf='';
      while(true) {
        const { value, done } = await reader.read(); if(done) break;
        buf += dec.decode(value, { stream:true });
        const lines = buf.split('\n'); buf = lines.pop()??'';
        for (const line of lines) {
          if (!line.startsWith('data: ')) continue;
          try {
            const ev = JSON.parse(line.slice(6)) as SSEEvent;
            setLogs(p => [...p, ev]);
            if (ev.type==='phase_start'&&ev.phase!=null) setPhase(ev.phase as 0|1|2|3|4);
            if (ev.type==='agent_start'&&ev.agentId) setAgents(p=>p.map(a=>a.id===ev.agentId?{...a,status:'running'}:a));
            if (ev.type==='agent_done'&&ev.agentId) {
              const r=ev.data as { summary?:string; durationMs?:number }|undefined;
              setAgents(p=>p.map(a=>a.id===ev.agentId?{...a,status:'done',summary:r?.summary??ev.message,durationMs:r?.durationMs}:a));
            }
            if (ev.type==='error') setErrMsg(ev.message);
            if (ev.type==='swarm_done') { finalCtx=ev.data as SwarmContext; setCtx(finalCtx); setPhase(4); }
          } catch { /* skip */ }
        }
      }
      if (finalCtx) { setStep('preview'); toast.success('Analyse terminée !'); }
    } catch(e) { const m=e instanceof Error?e.message:String(e); setErrMsg(m); toast.error(m); }
    finally { setRunning(false); setExtracting(false); }
  }, [running,files,kimiKey,nomProjet,codeProjet,typeProjet,dateDebut,dateFin,budget,bailleur,programme,user]);

  /* ── Create project (swarm → all stores) ── */
  const createProject = useCallback(() => {
    if (!ctx) return;
    const pc     = ctx.projetContext;
    const planif = ctx.results.planificateur?.data;
    const financ = ctx.results.financier?.data;
    const bud    = financ?.budgetTotal ?? pc.budgetEstime;

    // ── 1. Créer la fiche projet de base ─────────────────────────────────────
    const created = store.createProjet({
      nom:pc.nomProjet, code:pc.codeProjet, description:pc.description,
      domaine:inferDomaine(pc.nomProjet, pc.typeProjet),
      chefProjet:pc.chefProjetNom??user?.nom??'Chef de Projet DPE',
      localisation:'Sénégal', region:'Multi-régions',
      avancement:0, avancementPlanifie:0, budget:bud,
      budgetEngage:0, budgetDecaisse:0,
      dateDebut:pc.dateDebut, dateFinPrevue:pc.dateFinPrevue, dateFinEstimee:pc.dateFinPrevue,
      statut:'planifie', priorite:'Haute', cpi:1, spi:1,
      bailleurs:pc.bailleur?[{nom:pc.bailleur,montant:bud*1e6,devise:'FCFA',pourcentage:100}]:[],
      equipe:[], unite:'DPD',
      jalons:(planif?.jalons??[]).map(j=>({ label:j.nom, date:j.date, atteint:false })),
    });

    // ── 2. Tâches WBS depuis le planificateur ────────────────────────────────
    const tachesBase: TacheWBS[] = (planif?.taches??[]).map((t,i) => ({
      id:`t-${created.id}-${i}`, projetId:created.id, nom:t.nom,
      type:(t.niveau===1?'Récapitulative':'Normale') as TacheWBS['type'],
      niveau:t.niveau, ordre:i, duree:t.duree,
      dateDebut:t.dateDebut, dateFin:t.dateFin,
      avancement:t.avancement??0, statutTache:'a_faire' as TacheWBS['statutTache'],
      priorite:'Haute' as TacheWBS['priorite'],
      predecesseurs:[], assignations:[], coutPrevu:t.coutPrevu??0, coutReel:0,
    }));

    // ── 3. Mapper TOUS agents → champs projet (BOQ · Risques · Marchés · HSE · ICPs · RAG) ──
    const { projetPatch, tachesEnrichies } = swarmContextToProjetPatch(ctx, created.id, tachesBase);

    store.updateProjet(created.id, {
      ...projetPatch,
      taches: tachesEnrichies,
    } as Partial<Projet>);

    // ── 4. Injecter les ICPs comme indicateurs RAG dans le Constructeur ──────
    const newIndicators = swarmContextToIndicators(ctx);
    const existingNames = new Set(indStore.indicators.map(i => i.name.toLowerCase()));
    let nbIndicators = 0;
    for (const ind of newIndicators) {
      if (!existingNames.has(ind.name.toLowerCase())) {
        indStore.add(ind);
        nbIndicators++;
      }
    }

    setCreated(created.id);
    setStep('done');
    toast.success(
      `Projet "${pc.nomProjet}" créé · ${tachesEnrichies.length} tâches` +
      (nbIndicators > 0 ? ` · ${nbIndicators} indicateurs RAG` : '')
    );
  }, [ctx, store, user, indStore]);

  /* ── Agent groups ── */
  const p1 = agents.filter(a=>a.phase===1);
  const p2 = agents.filter(a=>a.phase===2);
  const p3 = agents.filter(a=>a.phase===3);

  const domainCounts = files.reduce<Record<string,number>>((acc,f) => {
    acc[f.domain??'Autre'] = (acc[f.domain??'Autre']??0)+1; return acc;
  }, {});

  /* ══════════════════════════════════════════════════════════════════════════
     RENDER
  ══════════════════════════════════════════════════════════════════════════ */
  return (
    <div style={{ minHeight:'100vh', background:T.bg, fontFamily:'inherit' }}>
      <style>{`
        @keyframes bar  { 0%{transform:translateX(-100%)} 100%{transform:translateX(200%)} }
        @keyframes spin { from{transform:rotate(0deg)} to{transform:rotate(360deg)} }
        @keyframes up   { from{opacity:0;transform:translateY(12px)} to{opacity:1;transform:translateY(0)} }
        .ani { animation:up .3s ease both }
        input[type=date] { color-scheme:light }
      `}</style>

      <div style={{ maxWidth:1140, margin:'0 auto', padding:'24px 20px' }}>

        {/* Header */}
        <div style={{ marginBottom:20 }}>
          <div style={{ display:'flex', alignItems:'center', gap:10, marginBottom:6 }}>
            <div style={{ width:36, height:36, borderRadius:10, background:`linear-gradient(135deg,${T.purple},${T.violet})`, display:'flex', alignItems:'center', justifyContent:'center' }}>
              <Sparkles size={17} color="#fff" />
            </div>
            <div>
              <h1 style={{ fontSize:20, fontWeight:900, color:T.text, margin:0, letterSpacing:'-.02em' }}>Migration intelligente</h1>
              <p  style={{ fontSize:12, color:T.muted, margin:0 }}>18 agents IA · Oracle PPM · Formats universels · Planning · Géospatial · Vision IA</p>
            </div>
          </div>
        </div>

        <Stepper current={step} />

        {/* ══════════════════ UPLOAD ══════════════════ */}
        {step==='upload' && (
          <div className="ani">
            {/* Drop zone */}
            <div
              onDragOver={e=>{e.preventDefault();setDrag(true)}}
              onDragLeave={()=>setDrag(false)}
              onDrop={e=>{e.preventDefault();setDrag(false);addFiles(e.dataTransfer.files)}}
              onClick={()=>fileRef.current?.click()}
              style={{
                border:`2px dashed ${drag?T.violet:T.border}`,
                borderRadius:16, padding:'32px 24px', textAlign:'center',
                background: drag?T.violet10:T.card, cursor:'pointer',
                transition:'all .2s', marginBottom:20, boxShadow:drag?`0 0 0 4px ${T.violet}18`:T.shadow,
              }}
            >
              <div style={{ width:52, height:52, borderRadius:14, background:`linear-gradient(135deg,${T.purple}22,${T.violet}22)`, margin:'0 auto 14px', display:'flex', alignItems:'center', justifyContent:'center' }}>
                <Upload size={22} color={drag?T.violet:T.muted} />
              </div>
              <div style={{ fontSize:16, fontWeight:800, color:drag?T.violet:T.text, marginBottom:4 }}>
                {drag ? 'Déposez ici' : 'Glissez vos documents de projet'}
              </div>
              <div style={{ fontSize:12.5, color:T.muted, marginBottom:16 }}>ou cliquez pour sélectionner — max 100 Mo par fichier</div>
              <div style={{ display:'flex', flexWrap:'wrap', justifyContent:'center', gap:7 }}>
                {[
                  {l:'PDF · PDF scanné · Word · Excel', c:'#DC2626'},
                  {l:'DXF · DWG — Plans DAO', c:'#7C3AED'},
                  {l:'KML · SHP — SIG / Géo', c:'#D97706'},
                  {l:'SCD · CID — Supervision réseau', c:'#0F766E'},
                  {l:'XER · MPP — Planification projet', c:'#1D4ED8'},
                  {l:'Images scannées — PNG · JPG · TIFF', c:'#B45309'},
                  {l:'ZIP · RAR — Archives', c:'#64748B'},
                ].map(({l,c}) => (
                  <span key={l} style={{ fontSize:10.5, fontWeight:600, padding:'3px 10px', borderRadius:20, background:`${c}12`, color:c, border:`1px solid ${c}28` }}>{l}</span>
                ))}
              </div>
              <input ref={fileRef} type="file" multiple
                accept=".pdf,.xlsx,.xls,.csv,.docx,.doc,.dxf,.dwg,.kml,.kmz,.shp,.dbf,.scd,.cid,.icd,.xer,.mpp,.xml,.zip,.rar,.png,.jpg,.jpeg,.tiff,.tif,.bmp,.svg,.pptx,.ppt"
                style={{ display:'none' }}
                onChange={e=>{if(e.target.files)addFiles(e.target.files);e.target.value='';}}
              />
            </div>

            {files.length === 0 ? (
              /* ── Écran vide ── */
              <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill,minmax(160px,1fr))', gap:12 }}>
                {[
                  { icon:FileText, color:'#DC2626', t:'PDF & Documents', s:'PDF texte ou scanné, Word, PV, rapports' },
                  { icon:FileCode, color:'#7C3AED', t:'Plans DAO', s:'DXF, DWG — Postes HTB, schémas unifilaires' },
                  { icon:Map,      color:'#D97706', t:'Données SIG', s:'KML, KMZ, Shapefile — Tracés lignes, pylônes' },
                  { icon:Cpu,      color:'#0F766E', t:'Config SCADA', s:'SCD, CID, ICD — CEI 61850 IED & protections' },
                  { icon:Calendar, color:'#1D4ED8', t:'Plannings', s:'XER, MPP, XML — Planification projets' },
                  { icon:BarChart3,color:'#059669', t:'Budgets & BOQ', s:'Excel, CSV — États financiers, décomptes' },
                  { icon:Archive,  color:'#64748B', t:'Archives', s:'ZIP, RAR — Dossiers complets de projet' },
                ].map(({ icon:Icon, color, t, s }) => (
                  <div key={t} style={{ background:T.card, border:`1px solid ${T.border}`, borderRadius:12, padding:'16px', boxShadow:T.shadow, cursor:'pointer' }}
                    onClick={()=>fileRef.current?.click()}>
                    <div style={{ width:34, height:34, borderRadius:9, background:`${color}14`, display:'flex', alignItems:'center', justifyContent:'center', marginBottom:10 }}>
                      <Icon size={15} color={color} />
                    </div>
                    <div style={{ fontSize:12.5, fontWeight:700, color:T.text, marginBottom:3 }}>{t}</div>
                    <div style={{ fontSize:11, color:T.muted, lineHeight:1.5 }}>{s}</div>
                  </div>
                ))}
              </div>
            ) : (
              /* ── Fichiers + formulaire ── */
              <div style={{ display:'grid', gridTemplateColumns:'1fr 360px', gap:20, alignItems:'start' }}>

                {/* Colonne gauche : barre d'action fixe + liste scrollable */}
                <div style={{ display:'flex', flexDirection:'column', gap:10 }}>

                  {/* Barre d'action principale — toujours visible */}
                  <div style={{ display:'flex', gap:8, alignItems:'center' }}>
                    <button onClick={()=>fileRef.current?.click()}
                      style={{ padding:'10px 14px', border:`1.5px solid ${T.border}`, borderRadius:10, background:T.card, fontSize:12.5, cursor:'pointer', color:T.sub, display:'flex', alignItems:'center', gap:6, fontFamily:'inherit', flexShrink:0, fontWeight:600 }}>
                      <FilePlus size={13} /> Ajouter
                    </button>
                    <button onClick={()=>setStep('swarm')} style={{
                      flex:1, padding:'12px', borderRadius:10, border:'none',
                      background:`linear-gradient(135deg,${T.purple},${T.violet})`,
                      color:'#fff', fontSize:14, fontWeight:700, cursor:'pointer',
                      display:'flex', alignItems:'center', justifyContent:'center', gap:10,
                      boxShadow:`0 4px 14px ${T.violet}40`, fontFamily:'inherit',
                    }}>
                      <Brain size={16} />
                      Lancer l&apos;analyse — {files.length} fichier{files.length > 1 ? 's' : ''}
                      <ChevronRight size={15} />
                    </button>
                    <button onClick={()=>setFiles([])} title="Tout supprimer"
                      style={{ padding:'10px 12px', border:`1.5px solid #FECACA`, borderRadius:10, background:'#FFF5F5', fontSize:12, cursor:'pointer', color:'#DC2626', display:'flex', alignItems:'center', flexShrink:0 }}>
                      <X size={14} />
                    </button>
                  </div>

                  {/* Badges domaines */}
                  <div style={{ display:'flex', flexWrap:'wrap', gap:6 }}>
                    {Object.entries(domainCounts).map(([domain, count]) => {
                      const fmtD = FMT_DEFS.find(f=>f.domain===domain);
                      const Icon = fmtD?.icon ?? FileText;
                      const color = fmtD?.color ?? '#64748B';
                      return (
                        <div key={domain} style={{ display:'flex', alignItems:'center', gap:5, padding:'3px 10px', borderRadius:20, border:`1px solid ${color}28`, background:`${color}10` }}>
                          <Icon size={10} color={color} />
                          <span style={{ fontSize:11, fontWeight:700, color }}>{domain} · {count}</span>
                        </div>
                      );
                    })}
                  </div>

                  {/* Liste fichiers — scrollable, hauteur max fixe */}
                  <div style={{ display:'flex', flexDirection:'column', gap:5, maxHeight:360, overflowY:'auto', paddingRight:4 }}>
                    {files.map(f => {
                      const fmtF = getFmt(f.ext);
                      const Icon  = fmtF?.icon ?? FileText;
                      const color = fmtF?.color ?? '#64748B';
                      return (
                        <div key={f.id} style={{ display:'flex', alignItems:'center', gap:10, padding:'9px 12px',
                          background:T.card, border:`1px solid ${T.border}`, borderRadius:10,
                          borderLeft:`4px solid ${color}`, boxShadow:T.shadow, flexShrink:0,
                        }}>
                          <div style={{ width:30, height:30, borderRadius:7, background:`${color}14`, display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0 }}>
                            <Icon size={13} color={color} />
                          </div>
                          <div style={{ flex:1, minWidth:0 }}>
                            <div style={{ fontSize:12.5, fontWeight:600, color:T.text, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{f.name}</div>
                            <div style={{ display:'flex', gap:6, marginTop:1, alignItems:'center' }}>
                              <span style={{ fontSize:10.5, color:T.muted }}>{fmt(f.size)}</span>
                              <span style={{ fontSize:10, padding:'1px 6px', borderRadius:7, background:`${color}14`, color, fontWeight:600 }}>
                                {fmtF?.label ?? f.ext.toUpperCase()}
                              </span>
                            </div>
                          </div>
                          <button onClick={e=>{e.stopPropagation();setFiles(p=>p.filter(x=>x.id!==f.id))}}
                            style={{ background:'none', border:'none', cursor:'pointer', color:T.muted, padding:4, borderRadius:5, display:'flex', alignItems:'center', flexShrink:0 }}>
                            <X size={13} />
                          </button>
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* Colonne droite : formulaire */}
                <div style={{ background:T.card, border:`1px solid ${T.border}`, borderRadius:14, boxShadow:T.shadow, overflow:'hidden', position:'sticky', top:16 }}>
                  <div style={{ padding:'14px 18px', background:`linear-gradient(135deg,${T.purple}08,${T.violet}06)`, borderBottom:`1px solid ${T.border}`, display:'flex', alignItems:'center', justifyContent:'space-between' }}>
                    <div style={{ display:'flex', alignItems:'center', gap:8 }}>
                      <Building2 size={14} color={T.violet} />
                      <span style={{ fontSize:13, fontWeight:700, color:T.text }}>Informations projet</span>
                    </div>
                    <button onClick={()=>setFormOpen(v=>!v)} style={{ background:'none', border:'none', cursor:'pointer', color:T.muted, display:'flex' }}>
                      {formOpen ? <ChevronUp size={15}/> : <ChevronDown size={15}/>}
                    </button>
                  </div>

                  {formOpen && (
                    <div style={{ padding:'16px 18px', display:'flex', flexDirection:'column', gap:12 }}>
                      <Field label="Nom du projet *" value={nomProjet} onChange={setNom} placeholder="ex: Électrification zone rurale Matam" />
                      <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:10 }}>
                        <Field label="Code projet" value={codeProjet} onChange={setCode} placeholder="PRJ-2026-01" />
                        <Field label="Budget (MFCFA)" value={budget} onChange={setBudget} type="number" placeholder="500" />
                      </div>
                      <Field label="Type de projet" value={typeProjet} onChange={setType} placeholder="ex: Ligne HTB 225kV" />
                      <Field label="Bailleur" value={bailleur} onChange={setBailleur} placeholder="IDA / Banque Mondiale" />
                      <Field label="Programme" value={programme} onChange={setProg} placeholder="PASER / PSES" />
                      <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:10 }}>
                        <div>
                          <label style={{ display:'block', fontSize:10.5, fontWeight:700, color:T.muted, textTransform:'uppercase', letterSpacing:'.05em', marginBottom:5 }}>Début</label>
                          <input type="date" value={dateDebut} onChange={e=>setDDebut(e.target.value)}
                            style={{ width:'100%', padding:'9px 12px', border:`1.5px solid ${T.border}`, borderRadius:9, fontSize:12, fontFamily:'inherit', boxSizing:'border-box', outline:'none' }} />
                        </div>
                        <div>
                          <label style={{ display:'block', fontSize:10.5, fontWeight:700, color:T.muted, textTransform:'uppercase', letterSpacing:'.05em', marginBottom:5 }}>Fin prévue</label>
                          <input type="date" value={dateFin} onChange={e=>setDFin(e.target.value)}
                            style={{ width:'100%', padding:'9px 12px', border:`1.5px solid ${T.border}`, borderRadius:9, fontSize:12, fontFamily:'inherit', boxSizing:'border-box', outline:'none' }} />
                        </div>
                      </div>

                      {/* Clé Kimi */}
                      <div style={{ padding:'11px 14px', background:T.violet10, border:`1px solid ${T.violet20}`, borderRadius:10 }}>
                        <div style={{ display:'flex', alignItems:'center', gap:6, marginBottom:8 }}>
                          <Key size={11} color={T.violet} />
                          <span style={{ fontSize:11, fontWeight:700, color:T.violet }}>Clé API Kimi K2 (optionnel)</span>
                        </div>
                        <div style={{ display:'flex', gap:6 }}>
                          <input type={showKey?'text':'password'} value={kimiKey} onChange={e=>setKimi(e.target.value)}
                            placeholder="sk-xxxxxxxxxx"
                            style={{ flex:1, padding:'7px 10px', border:`1px solid ${T.violet20}`, borderRadius:7, fontSize:11.5, fontFamily:'monospace', outline:'none', background:'white' }} />
                          <button onClick={()=>setShowKey(v=>!v)}
                            style={{ padding:'6px 10px', border:`1px solid ${T.violet20}`, borderRadius:7, background:'white', cursor:'pointer', color:T.muted, display:'flex', alignItems:'center' }}>
                            {showKey?<EyeOff size={12}/>:<Eye size={12}/>}
                          </button>
                        </div>
                        <div style={{ fontSize:10, color:T.violet, marginTop:6, lineHeight:1.5 }}>
                          Sans clé → Docker llama.cpp (port 8080) → Ollama → heuristique
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        )}

        {/* ══════════════════ SWARM ══════════════════ */}
        {step==='swarm' && (
          <div className="ani" style={{ display:'grid', gridTemplateColumns:'1fr 300px', gap:20 }}>

            {/* Pipeline */}
            <div style={{ display:'flex', flexDirection:'column', gap:0 }}>
              <Section title="Pipeline 18 agents IA · Oracle PPM" icon={Brain} color={T.violet}
                right={
                  extracting ? (
                    <div style={{ display:'flex', alignItems:'center', gap:8, fontSize:12.5, color:'#0891B2', fontWeight:600 }}>
                      <Loader2 size={13} style={{ animation:'spin 1s linear infinite' }} />
                      Extraction documents {extractPct}%
                    </div>
                  ) : running ? (
                    <div style={{ display:'flex', alignItems:'center', gap:8, fontSize:12.5, color:T.violet, fontWeight:600 }}>
                      <Loader2 size={13} style={{ animation:'spin 1s linear infinite' }} />
                      Phase {phase}/3
                    </div>
                  ) : ctx ? (
                    <div style={{ display:'flex', alignItems:'center', gap:6, fontSize:12.5, color:T.success, fontWeight:700 }}>
                      <CheckCircle size={13} /> Score {ctx.results.chefProjet?.data.scoreSynthese??0}/100
                    </div>
                  ) : (
                    <button onClick={startSwarm} style={{
                      padding:'8px 18px', borderRadius:8, border:'none',
                      background:`linear-gradient(135deg,${T.purple},${T.violet})`,
                      color:'#fff', fontSize:12.5, fontWeight:700, cursor:'pointer',
                      display:'flex', alignItems:'center', gap:7, fontFamily:'inherit',
                      boxShadow:`0 3px 10px ${T.violet}40`,
                    }}>
                      <Zap size={13} /> Démarrer
                    </button>
                  )
                }
              >
                {/* Phase 1 */}
                <div style={{ marginBottom:4 }}>
                  <div style={{ display:'flex', alignItems:'center', gap:8, marginBottom:8 }}>
                    <div style={{ width:20, height:20, borderRadius:'50%', background:phase>=1?T.violet:T.border, display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0 }}>
                      {phase>1 ? <CheckCircle size={11} color="#fff"/> : <span style={{ fontSize:10, fontWeight:800, color:phase===1?'#fff':T.muted }}>1</span>}
                    </div>
                    <span style={{ fontSize:11.5, fontWeight:700, color:phase>=1?T.text:T.muted }}>Phase 1 — Analyse initiale (9 agents en parallèle)</span>
                    {phase===1 && <span style={{ fontSize:10, padding:'1px 8px', borderRadius:20, background:T.violet10, color:T.violet, fontWeight:700 }}>EN COURS</span>}
                    {phase>1   && <span style={{ fontSize:10, padding:'1px 8px', borderRadius:20, background:'#DCFCE7', color:T.success, fontWeight:700 }}>TERMINÉ</span>}
                  </div>
                  <div style={{ display:'grid', gridTemplateColumns:'repeat(2,1fr)', gap:7 }}>
                    {p1.map(a => <AgentCard key={a.id} agent={a} />)}
                  </div>
                  <div style={{ height:1, background:`linear-gradient(to right,${T.violet}40,transparent)`, margin:'14px 0' }} />
                </div>

                {/* Phase 2 */}
                <div style={{ marginBottom:4 }}>
                  <div style={{ display:'flex', alignItems:'center', gap:8, marginBottom:8 }}>
                    <div style={{ width:20, height:20, borderRadius:'50%', background:phase>=2?T.violet:T.border, display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0 }}>
                      {phase>2 ? <CheckCircle size={11} color="#fff"/> : <span style={{ fontSize:10, fontWeight:800, color:phase===2?'#fff':T.muted }}>2</span>}
                    </div>
                    <span style={{ fontSize:11.5, fontWeight:700, color:phase>=2?T.text:T.muted }}>Phase 2 — Ressources, Marchés, Fournisseurs & Réception (5 agents)</span>
                    {phase===2 && <span style={{ fontSize:10, padding:'1px 8px', borderRadius:20, background:T.violet10, color:T.violet, fontWeight:700 }}>EN COURS</span>}
                    {phase>2   && <span style={{ fontSize:10, padding:'1px 8px', borderRadius:20, background:'#DCFCE7', color:T.success, fontWeight:700 }}>TERMINÉ</span>}
                  </div>
                  <div style={{ display:'grid', gridTemplateColumns:'repeat(3,1fr)', gap:7 }}>
                    {p2.map(a => <AgentCard key={a.id} agent={a} />)}
                  </div>
                  <div style={{ height:1, background:`linear-gradient(to right,${T.violet}40,transparent)`, margin:'14px 0' }} />
                </div>

                {/* Phase 3 */}
                <div>
                  <div style={{ display:'flex', alignItems:'center', gap:8, marginBottom:8 }}>
                    <div style={{ width:20, height:20, borderRadius:'50%', background:phase>=3?T.violet:T.border, display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0 }}>
                      {phase>3 ? <CheckCircle size={11} color="#fff"/> : <span style={{ fontSize:10, fontWeight:800, color:phase===3?'#fff':T.muted }}>3</span>}
                    </div>
                    <span style={{ fontSize:11.5, fontWeight:700, color:phase>=3?T.text:T.muted }}>Phase 3 — Reporting, Courriers, GED & Synthèse</span>
                    {phase===3 && <span style={{ fontSize:10, padding:'1px 8px', borderRadius:20, background:T.violet10, color:T.violet, fontWeight:700 }}>EN COURS</span>}
                    {phase>3   && <span style={{ fontSize:10, padding:'1px 8px', borderRadius:20, background:'#DCFCE7', color:T.success, fontWeight:700 }}>TERMINÉ</span>}
                  </div>
                  <div style={{ display:'grid', gridTemplateColumns:'repeat(2,1fr)', gap:7 }}>
                    {p3.map(a => <AgentCard key={a.id} agent={a} />)}
                  </div>
                </div>

                {/* Erreur */}
                {errMsg && (
                  <div style={{ marginTop:14, padding:'10px 14px', background:'#FEF2F2', border:'1px solid #FECACA', borderRadius:9, fontSize:12, color:T.danger, display:'flex', gap:8 }}>
                    <AlertTriangle size={13} style={{ flexShrink:0, marginTop:1 }} />{errMsg}
                  </div>
                )}

                {/* Actions bas */}
                <div style={{ display:'flex', gap:10, marginTop:16 }}>
                  <button onClick={()=>setStep('upload')} style={{ padding:'10px 16px', border:`1px solid ${T.border}`, borderRadius:9, background:T.card, fontSize:12.5, cursor:'pointer', color:T.sub, fontFamily:'inherit' }}>
                    Retour
                  </button>
                  {ctx && !running && (
                    <button onClick={()=>setStep('preview')} style={{
                      flex:1, padding:'11px', borderRadius:9, border:'none',
                      background:`linear-gradient(135deg,${T.success},#10B981)`,
                      color:'#fff', fontSize:13, fontWeight:700, cursor:'pointer',
                      display:'flex', alignItems:'center', justifyContent:'center', gap:8, fontFamily:'inherit',
                    }}>
                      <Eye size={14}/> Voir l&apos;aperçu <ChevronRight size={14}/>
                    </button>
                  )}
                </div>
              </Section>
            </div>

            {/* Log terminal */}
            <div style={{ background:'#0F172A', borderRadius:14, border:'1px solid #1E293B', display:'flex', flexDirection:'column', minHeight:500, overflow:'hidden' }}>
              <div style={{ padding:'12px 16px', borderBottom:'1px solid #1E293B', display:'flex', alignItems:'center', gap:8 }}>
                <div style={{ display:'flex', gap:5 }}>
                  <div style={{ width:10, height:10, borderRadius:'50%', background:'#FF5F57' }} />
                  <div style={{ width:10, height:10, borderRadius:'50%', background:'#FFBD2E' }} />
                  <div style={{ width:10, height:10, borderRadius:'50%', background:'#28C840' }} />
                </div>
                <span style={{ fontSize:11, fontFamily:'monospace', color:'#475569', marginLeft:4 }}>
                  SIGEPP SWARM · {running?'● LIVE':ctx?'✓ DONE':'⏳ READY'}
                </span>
              </div>
              <div style={{ flex:1, overflowY:'auto', padding:'12px 14px', fontFamily:'monospace', fontSize:10.5, lineHeight:1.7, maxHeight:520 }}>
                {logs.length===0 && <div style={{ color:'#334155' }}>En attente du démarrage…</div>}
                {logs.map((ev,i) => {
                  const c = ev.type==='error'?'#F87171':ev.type==='phase_start'||ev.type==='phase_done'?'#60A5FA':ev.type==='agent_done'?'#4ADE80':ev.type==='agent_start'?'#FCD34D':ev.type==='swarm_done'?'#C4B5FD':'#475569';
                  const pfx = ev.type==='phase_start'?'━━':ev.type==='agent_done'?'✓':ev.type==='agent_start'?'▶':ev.type==='swarm_done'?'★':'·';
                  const ts = new Date(ev.timestamp).toLocaleTimeString('fr-FR',{hour:'2-digit',minute:'2-digit',second:'2-digit'});
                  return (
                    <div key={i} style={{ color:c, marginBottom:1, wordBreak:'break-word' }}>
                      <span style={{ color:'#334155' }}>{ts} </span>
                      <span style={{ color:'#1E293B' }}>{pfx} </span>
                      {ev.agentId&&<span style={{ color:'#818CF8' }}>[{ev.agentId}] </span>}
                      {ev.message}
                    </div>
                  );
                })}
                <div ref={logsRef} />
              </div>
            </div>
          </div>
        )}

        {/* ══════════════════ PREVIEW ══════════════════ */}
        {step==='preview' && ctx && (() => {
          const chef   = ctx.results.chefProjet?.data;
          const planif = ctx.results.planificateur?.data;
          const financ = ctx.results.financier?.data;
          const risq   = ctx.results.risques?.data;
          const ba     = ctx.results.businessAnalyst?.data;
          const qhse   = ctx.results.qhse?.data;
          const march  = ctx.results.marches?.data;
          const score  = chef?.scoreSynthese??0;
          return (
            <div className="ani">
              {/* KPIs */}
              <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit,minmax(150px,1fr))', gap:12, marginBottom:20 }}>
                <KpiCard label="Score IA" value={`${score}/100`} sub={chef?.projetValide?'Prêt pour import':'Anomalies détectées'} color={score>=80?T.success:score>=60?T.warn:T.danger} icon={CheckCircle} />
                <KpiCard label="Tâches WBS"  value={planif?.taches.length??0}  sub={`${planif?.dureeJours??'?'} jours · ${planif?.jalons.length??0} jalons`} color={T.info}    icon={BarChart3} />
                <KpiCard label="Budget MFCFA" value={(financ?.budgetTotal??ctx.projetContext.budgetEstime).toFixed(0)} sub={`Taux décaiss. ${financ?.tauxDecaissement?.toFixed(0)??0}%`} color={T.success} icon={TrendingUp} />
                <KpiCard label="Risques P×I"  value={risq?.risques.length??0}   sub={`${risq?.risquesCritiques.length??0} critiques`} color={T.danger}  icon={Shield} />
                <KpiCard label="Lots marchés" value={march?.lotsIdentifies.length??0} sub={`${march?.totalMarchesPrevu?.toFixed(0)??0} MFCFA`} color='#16A34A' icon={ShoppingCart} />
                <KpiCard label="Niveau HSE"   value={qhse?.niveauRisqueHSE??'—'} sub={`${qhse?.planPGES.length??0} composantes PGES`} color={T.warn} icon={AlertTriangle} />
              </div>

              {/* Grille détail */}
              <div style={{ display:'grid', gridTemplateColumns:'repeat(2,1fr)', gap:16, marginBottom:16 }}>
                {/* Identification */}
                <Section title="Identification" icon={Building2} color={T.info}>
                  {[
                    ['Nom', ctx.projetContext.nomProjet],
                    ['Code', ctx.projetContext.codeProjet],
                    ['Type', ctx.projetContext.typeProjet],
                    ['Bailleur', ctx.projetContext.bailleur??'—'],
                    ['Programme', ctx.projetContext.programme??'—'],
                    ['Début', ctx.projetContext.dateDebut],
                    ['Fin prévue', ctx.projetContext.dateFinPrevue],
                    ['Durée', `${planif?.dureeJours??'?'} jours`],
                  ].map(([k,v]) => (
                    <div key={k} style={{ display:'flex', justifyContent:'space-between', fontSize:12.5, padding:'5px 0', borderBottom:`1px solid ${T.bg}` }}>
                      <span style={{ color:T.muted }}>{k}</span>
                      <span style={{ fontWeight:600, color:T.text, maxWidth:'55%', textAlign:'right', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{v}</span>
                    </div>
                  ))}
                </Section>

                {/* Business Analyst */}
                <Section title="Business Analyst" icon={ClipboardList} color={T.violet}>
                  {ba && (
                    <>
                      <div style={{ fontSize:12.5, fontWeight:600, color:T.text, marginBottom:10, lineHeight:1.5 }}>{ba.perimetreProjet}</div>
                      <div style={{ display:'inline-flex', padding:'3px 12px', borderRadius:20, fontSize:11.5, fontWeight:700, marginBottom:10,
                        background:ba.niveauComplexite==='Très complexe'?'#FEF2F2':ba.niveauComplexite==='Complexe'?'#FFFBEB':'#F0FDF4',
                        color:ba.niveauComplexite==='Très complexe'?T.danger:ba.niveauComplexite==='Complexe'?T.warn:T.success,
                      }}>
                        Complexité : {ba.niveauComplexite}
                      </div>
                      <div style={{ display:'flex', flexWrap:'wrap', gap:5 }}>
                        {ba.codesBIT.map(c => <span key={c} style={{ fontSize:10.5, padding:'2px 8px', borderRadius:7, background:T.violet10, color:T.violet, fontWeight:600 }}>{c}</span>)}
                      </div>
                    </>
                  )}
                </Section>

                {/* Marchés */}
                <Section title="Passation des marchés" icon={ShoppingCart} color='#16A34A'>
                  {march && (
                    <>
                      <div style={{ fontSize:12, fontWeight:600, color:T.text, marginBottom:10, lineHeight:1.4 }}>{march.strategiePassation.split(' — ')[0]}</div>
                      {march.lotsIdentifies.map(l => (
                        <div key={l.numero} style={{ display:'flex', justifyContent:'space-between', fontSize:12, padding:'5px 0', borderBottom:`1px solid ${T.bg}`, gap:8 }}>
                          <span style={{ color:T.sub, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>Lot {l.numero} — {l.libelle}</span>
                          <span style={{ fontWeight:700, color:T.success, flexShrink:0 }}>{(l.montantHTVA/1e6).toFixed(0)} M</span>
                        </div>
                      ))}
                      <div style={{ fontSize:13, fontWeight:800, color:T.success, marginTop:8, textAlign:'right' }}>
                        Total : {march.totalMarchesPrevu.toFixed(0)} MFCFA
                      </div>
                    </>
                  )}
                </Section>

                {/* QHSE */}
                <Section title="QHSE / PGES" icon={AlertTriangle} color={T.warn}>
                  {qhse && (
                    <>
                      <div style={{ display:'flex', justifyContent:'space-between', marginBottom:10 }}>
                        <span style={{ fontSize:12.5, color:T.muted }}>Niveau HSE global</span>
                        <span style={{ padding:'2px 10px', borderRadius:20, fontSize:11.5, fontWeight:700,
                          background:qhse.niveauRisqueHSE==='Critique'?'#FEF2F2':qhse.niveauRisqueHSE==='Élevé'?'#FFFBEB':'#F0FDF4',
                          color:qhse.niveauRisqueHSE==='Critique'?T.danger:qhse.niveauRisqueHSE==='Élevé'?T.warn:T.success,
                        }}>{qhse.niveauRisqueHSE}</span>
                      </div>
                      {qhse.planPGES.slice(0,4).map(p => (
                        <div key={p.composante} style={{ fontSize:11.5, padding:'4px 0', borderBottom:`1px solid ${T.bg}`, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>
                          <span style={{ fontWeight:600, color:T.warn }}>{p.composante}</span>
                          <span style={{ color:T.muted }}> — {p.mesure}</span>
                        </div>
                      ))}
                      <div style={{ fontSize:11.5, color:T.warn, marginTop:8, fontWeight:600 }}>
                        {qhse.formationsRequises.length} formations HSE requises
                      </div>
                    </>
                  )}
                </Section>
              </div>

              {/* Rapport Chef Projet */}
              {chef?.rapportCreation && (
                <div style={{ background:'#0F172A', borderRadius:12, padding:'18px 20px', marginBottom:16, border:'1px solid #1E293B' }}>
                  <div style={{ fontSize:11.5, fontWeight:700, color:'#60A5FA', marginBottom:10, fontFamily:'monospace' }}>
                    RAPPORT CHEF DE PROJET — Score {score}/100
                  </div>
                  <pre style={{ fontFamily:'monospace', fontSize:10.5, color:'#94A3B8', whiteSpace:'pre-wrap', lineHeight:1.7, margin:0, maxHeight:260, overflowY:'auto' }}>
                    {chef.rapportCreation}
                  </pre>
                </div>
              )}

              {/* Anomalies */}
              {chef && chef.anomalies.length>0 && (
                <div style={{ background:'#FEF2F2', border:'1px solid #FECACA', borderRadius:12, padding:'14px 18px', marginBottom:16 }}>
                  <div style={{ fontSize:13, fontWeight:700, color:T.danger, marginBottom:8 }}>{chef.anomalies.length} anomalie(s) à corriger</div>
                  {chef.anomalies.map((a,i) => <div key={i} style={{ fontSize:12, color:'#B91C1C', padding:'2px 0', display:'flex', gap:6 }}><span>•</span><span>{a}</span></div>)}
                </div>
              )}

              <div style={{ display:'flex', gap:12 }}>
                <button onClick={()=>setStep('swarm')} style={{ padding:'12px 20px', border:`1px solid ${T.border}`, borderRadius:10, background:T.card, fontSize:13, cursor:'pointer', color:T.sub, fontFamily:'inherit' }}>
                  Retour pipeline
                </button>
                <button onClick={()=>setStep('validate')} disabled={!chef?.projetValide} style={{
                  flex:1, padding:'13px', borderRadius:10, border:'none', fontSize:14, fontWeight:700,
                  background:chef?.projetValide?`linear-gradient(135deg,${T.purple},${T.violet})`:`#E2E8F0`,
                  color:chef?.projetValide?'#fff':'#94A3B8',
                  cursor:chef?.projetValide?'pointer':'not-allowed',
                  display:'flex', alignItems:'center', justifyContent:'center', gap:8, fontFamily:'inherit',
                  boxShadow:chef?.projetValide?`0 4px 14px ${T.violet}40`:'none',
                }}>
                  <CheckCircle size={16}/>
                  {chef?.projetValide?'Valider et créer dans SIGEPP':`Corriger ${chef?.anomalies.length??0} anomalie(s)`}
                  <ChevronRight size={16}/>
                </button>
              </div>
            </div>
          );
        })()}

        {/* ══════════════════ VALIDATION ══════════════════ */}
        {step==='validate' && ctx && (
          <div className="ani" style={{ maxWidth:560, margin:'0 auto' }}>
            <div style={{ background:T.card, borderRadius:20, boxShadow:T.shadowMd, border:`1px solid ${T.border}`, padding:'36px 32px', textAlign:'center' }}>
              <div style={{ width:64, height:64, borderRadius:18, background:`linear-gradient(135deg,${T.success}22,${T.success}44)`, margin:'0 auto 18px', display:'flex', alignItems:'center', justifyContent:'center' }}>
                <CheckCircle size={30} color={T.success} />
              </div>
              <div style={{ fontSize:20, fontWeight:900, color:T.text, marginBottom:8 }}>Prêt pour l&apos;import SIGEPP</div>
              <div style={{ fontSize:13, color:T.muted, marginBottom:28, lineHeight:1.7 }}>
                Le projet sera créé avec le WBS complet, les jalons,<br/>les risques et les données financières générés par les 18 agents Oracle PPM.
              </div>

              <div style={{ background:T.bg, borderRadius:12, padding:'16px 20px', marginBottom:26, textAlign:'left' }}>
                {[
                  ['Projet',     ctx.projetContext.nomProjet],
                  ['Code',       ctx.projetContext.codeProjet],
                  ['Budget',     `${ctx.projetContext.budgetEstime} MFCFA`],
                  ['Durée',      `${ctx.results.planificateur?.data.dureeJours??'?'} jours`],
                  ['Tâches WBS', `${ctx.results.planificateur?.data.taches.length??0}`],
                  ['Jalons',     `${ctx.results.planificateur?.data.jalons.length??0}`],
                  ['Risques',    `${ctx.results.risques?.data.risques.length??0}`],
                  ['Score IA',   `${ctx.results.chefProjet?.data.scoreSynthese??0}/100`],
                ].map(([k,v]) => (
                  <div key={k} style={{ display:'flex', justifyContent:'space-between', fontSize:13, padding:'7px 0', borderBottom:`1px solid ${T.border}` }}>
                    <span style={{ color:T.muted }}>{k}</span>
                    <span style={{ fontWeight:700, color:T.text }}>{v}</span>
                  </div>
                ))}
              </div>

              <div style={{ display:'flex', gap:12 }}>
                <button onClick={()=>setStep('preview')} style={{ flex:1, padding:'12px', border:`1px solid ${T.border}`, borderRadius:10, background:T.card, fontSize:13, cursor:'pointer', color:T.sub, fontFamily:'inherit' }}>
                  Retour
                </button>
                <button onClick={createProject} style={{
                  flex:2, padding:'14px', borderRadius:10, border:'none', fontSize:14, fontWeight:700,
                  background:`linear-gradient(135deg,${T.success},#10B981)`,
                  color:'#fff', cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center', gap:8,
                  boxShadow:`0 4px 14px ${T.success}40`, fontFamily:'inherit',
                }}>
                  <Rocket size={16}/> Créer dans SIGEPP-DPE
                </button>
              </div>
            </div>
          </div>
        )}

        {/* ══════════════════ DONE ══════════════════ */}
        {step==='done' && ctx && (() => {
          const pc      = ctx.projetContext;
          const planif  = ctx.results.planificateur?.data;
          const financ  = ctx.results.financier?.data;
          const risques = ctx.results.risques?.data;
          const marches = ctx.results.marches?.data;
          const qhse    = ctx.results.qhse?.data;
          const suivi   = ctx.results.suiviEval?.data;
          const ged     = ctx.results.documentaire?.data;

          // RAG statut peuplé par createProject (via swarmToStore)
          const nRed    = risques?.risquesCritiques?.length ?? 0;
          const niveau  = risques?.niveauRisqueGlobal ?? 'Faible';
          const varBud  = financ && financ.budgetInitial > 0
            ? Math.abs((financ.budgetTotal - financ.budgetInitial) / financ.budgetInitial * 100) : 0;
          const ragVal: 'rouge'|'orange'|'vert' =
            nRed > 2 || niveau === 'Critique' || varBud > 10 ? 'rouge' :
            nRed > 0 || niveau === 'Élevé' || varBud > 5    ? 'orange' : 'vert';
          const ragCfg = {
            rouge:  { color:'#DC2626', bg:'#FEF2F2', border:'#FECACA', label:'🔴 Rouge — Action immédiate requise' },
            orange: { color:'#D97706', bg:'#FFFBEB', border:'#FDE68A', label:'🟠 Amber — Attention, dérive détectée' },
            vert:   { color:'#059669', bg:'#F0FDF4', border:'#86EFAC', label:'🟢 Vert — Situation normale' },
          }[ragVal];

          const fields = [
            { l:'WBS + Jalons',        ok:(planif?.taches.length??0)>0,       n:`${planif?.taches.length??0} tâches · ${planif?.jalons.length??0} jalons`,         href:'/gantt' },
            { l:'Budget & BOQ',        ok:(financ?.budgetTotal??0)>0,          n:`${financ?.budgetTotal??0} MFCFA · ${financ?.lots?.length??0} lots BOQ`,           href:'/budget' },
            { l:'Registre risques',    ok:(risques?.risques.length??0)>0,      n:`${risques?.risques.length??0} risques · ${nRed} critiques`,                       href:'/cockpit' },
            { l:'Plan PGES/HSE',       ok:(qhse?.planPGES.length??0)>0,        n:`${qhse?.planPGES.length??0} mesures · Niveau ${qhse?.niveauRisqueHSE??'—'}`,      href:'/cockpit' },
            { l:'Lots marchés',        ok:(marches?.lotsIdentifies.length??0)>0,n:`${marches?.lotsIdentifies.length??0} lots · ${marches?.totalMarchesPrevu??0} MFCFA`,href:'/portefeuille' },
            { l:'KPIs Suivi-Éval',     ok:(suivi?.icps.length??0)>0,           n:`${suivi?.icps.length??0} indicateurs · ${suivi?.alerteSeuils?.length??0} seuils RAG`, href:'/analytique' },
            { l:'GED arborescence',    ok:(ged?.gedFolders.length??0)>0,       n:`${ged?.gedFolders.length??0} dossiers indexés`,                                   href:'/ged' },
          ];
          const nbOk = fields.filter(f=>f.ok).length;

          return (
            <div className="ani" style={{ maxWidth:580, margin:'0 auto' }}>
              <div style={{ background:T.card, borderRadius:20, boxShadow:T.shadowMd, border:`2px solid ${ragCfg.border}`, overflow:'hidden' }}>

                {/* Header */}
                <div style={{ background:`linear-gradient(135deg,${ragCfg.bg},#fff)`, padding:'28px 28px 20px', textAlign:'center' }}>
                  <div style={{ width:64, height:64, borderRadius:18, background:ragCfg.bg, border:`2px solid ${ragCfg.border}`, margin:'0 auto 14px', display:'flex', alignItems:'center', justifyContent:'center' }}>
                    <Rocket size={28} color={ragCfg.color} />
                  </div>
                  <div style={{ fontSize:20, fontWeight:900, color:ragCfg.color, marginBottom:4 }}>Projet créé dans SIGEPP</div>
                  <div style={{ fontSize:14, color:'#1E293B', fontWeight:700, marginBottom:2 }}>{pc.nomProjet}</div>
                  <div style={{ fontSize:11.5, color:T.muted, marginBottom:12 }}>
                    {pc.codeProjet} · {agents.filter(a=>a.status==='done').length}/18 agents · Score {ctx.results.chefProjet?.data.scoreSynthese??0}/100
                  </div>
                  {/* RAG badge */}
                  <div style={{ display:'inline-flex', alignItems:'center', gap:8, padding:'7px 16px', borderRadius:20, background:ragCfg.bg, border:`1.5px solid ${ragCfg.border}` }}>
                    <span style={{ fontSize:12.5, fontWeight:800, color:ragCfg.color }}>{ragCfg.label}</span>
                  </div>
                </div>

                {/* Données peuplées */}
                <div style={{ padding:'16px 24px 20px' }}>
                  <div style={{ fontSize:11, fontWeight:700, color:T.muted, textTransform:'uppercase', letterSpacing:'.06em', marginBottom:10 }}>
                    Données peuplées — {nbOk}/{fields.length} modules
                  </div>
                  {fields.map(({l,ok,n,href}) => (
                    <div key={l} style={{ display:'flex', alignItems:'center', gap:10, padding:'7px 10px', borderRadius:8, marginBottom:3, background:ok?`${T.success}08`:'transparent', border:`1px solid ${ok?`${T.success}20`:T.border}` }}>
                      <CheckCircle size={13} color={ok?T.success:T.border} />
                      <span style={{ fontSize:12, color:ok?T.text:T.muted, flex:1, fontWeight:ok?600:400 }}>{l}</span>
                      <span style={{ fontSize:10.5, color:ok?T.success:T.muted }}>{ok?n:'—'}</span>
                      {ok && (
                        <button onClick={()=>router.push(href)} style={{ background:'none', border:'none', cursor:'pointer', color:T.violet, fontSize:10, fontWeight:700, padding:'2px 6px', borderRadius:4, display:'flex', alignItems:'center', gap:3, fontFamily:'inherit' }}>
                          <Eye size={10}/> Voir
                        </button>
                      )}
                    </div>
                  ))}
                </div>

                {/* Actions */}
                <div style={{ padding:'0 24px 24px', display:'flex', gap:8, flexWrap:'wrap', justifyContent:'center' }}>
                  <button onClick={()=>router.push('/tableau-de-bord')} style={{ padding:'9px 16px', border:`1px solid ${T.border}`, borderRadius:9, background:T.card, fontSize:12.5, cursor:'pointer', color:T.text, fontWeight:600, display:'flex', alignItems:'center', gap:6, fontFamily:'inherit' }}>
                    <BarChart3 size={13}/> Tableau de bord
                  </button>
                  <button onClick={()=>router.push('/portefeuille')} style={{ padding:'9px 16px', border:`1px solid ${T.border}`, borderRadius:9, background:T.card, fontSize:12.5, cursor:'pointer', color:T.text, fontWeight:600, display:'flex', alignItems:'center', gap:6, fontFamily:'inherit' }}>
                    <FolderOpen size={13}/> Portefeuille
                  </button>
                  {createdId && (
                    <button onClick={()=>router.push('/cockpit')} style={{ padding:'9px 20px', borderRadius:9, background:`linear-gradient(135deg,${T.purple},${T.violet})`, color:'#fff', border:'none', fontSize:13, fontWeight:700, cursor:'pointer', display:'flex', alignItems:'center', gap:6, fontFamily:'inherit', boxShadow:`0 4px 12px ${T.violet}40` }}>
                      <Rocket size={13}/> Cockpit projet
                    </button>
                  )}
                  <button onClick={()=>{setStep('upload');setFiles([]);setCtx(null);setLogs([]);setPhase(0);setAgents(AGENTS.map(a=>({...a})));setNom('');setCode('');}}
                    style={{ padding:'9px 14px', border:`1px solid ${T.border}`, borderRadius:9, background:T.card, fontSize:12, cursor:'pointer', color:T.muted, display:'flex', alignItems:'center', gap:6, fontFamily:'inherit' }}>
                    <RefreshCw size={12}/> Nouveau
                  </button>
                </div>
              </div>
            </div>
          );
        })()}

      </div>
    </div>
  );
}

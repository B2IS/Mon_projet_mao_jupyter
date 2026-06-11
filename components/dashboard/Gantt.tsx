'use client';

import { useState, useRef, useMemo, useCallback, useEffect } from 'react';
import {
  Plus, ChevronRight, ChevronDown, X, Flag, AlertTriangle,
  Users, BarChart3, FileText, Download, Calendar, GanttChart,
  Wrench, Trash2, Edit3, Zap,
  CheckCircle2, Circle, Clock, ChevronUp, Bot, Shuffle, TriangleAlert, Info, Search,
} from 'lucide-react';
import toast from 'react-hot-toast';
import {
  useProjectStore, DOMAINE_CFG,
  type TacheWBS, type Projet, type Ressource, type Baseline,
} from '@/lib/projectStore';
import { useAuth, isOperationalReadOnly } from '@/lib/authStore';
import { useTempsStore } from '@/lib/tempsStore';
import { readOnlyGuard } from '@/lib/operationalGuard';

/* ══════════════════════════════════════════════════════════════════════════════
   TYPES GANTT
══════════════════════════════════════════════════════════════════════════════ */
type ZoomLevel    = 'semaine' | 'mois' | 'trimestre' | 'annee';
type TaskType     = 'normal' | 'summary' | 'milestone';
type LinkType     = 'FS' | 'SS' | 'FF' | 'SF';
type TaskStatus   = 'non_demarre' | 'en_cours' | 'termine' | 'en_retard';
type RibbonTab    = 'tache' | 'vue' | 'projet' | 'ia';

/** PERT 3-point estimate for a single task */
interface PertEstimate { taskId: string; O: number; M: number; P: number; }
function pertDuration(e: PertEstimate): number { return +(( e.O + 4 * e.M + e.P) / 6).toFixed(1); }
function pertSigma   (e: PertEstimate): number { return +((e.P - e.O) / 6).toFixed(1); }

/** Resource overload detection */
interface ResourceLoad {
  ressourceId: string; nom: string;
  tasks: { id: string; name: string; start: Date; end: Date; pct: number }[];
  maxLoad: number; // max simultaneous load % across all tasks
  overloaded: boolean;
}
function computeResourceLoads(tasks: GanttTask[], ressources: { id: string; prenom: string; nom: string }[]): ResourceLoad[] {
  const map = new Map<string, ResourceLoad>();
  for (const t of tasks) {
    for (const rid of t.resources) {
      if (!map.has(rid)) {
        const r = ressources.find(x => x.id === rid);
        map.set(rid, { ressourceId: rid, nom: r ? `${r.prenom} ${r.nom}` : rid, tasks: [], maxLoad: 0, overloaded: false });
      }
      map.get(rid)!.tasks.push({ id: t.id, name: t.name, start: t.start, end: t.end, pct: 100 / (t.resources.length || 1) });
    }
  }
  // Compute overlapping load
  for (const rl of map.values()) {
    let maxLoad = 0;
    for (const a of rl.tasks) {
      const simul = rl.tasks.filter(b => b.id !== a.id && b.start <= a.end && b.end >= a.start);
      const load = simul.reduce((s, b) => s + b.pct, a.pct);
      if (load > maxLoad) maxLoad = load;
    }
    rl.maxLoad = Math.round(maxLoad);
    rl.overloaded = rl.maxLoad > 100;
  }
  return [...map.values()].sort((a, b) => b.maxLoad - a.maxLoad);
}

interface Predecessor { id: string; type: LinkType; lag: number; }
type ConstraintType = 'ASAP' | 'ALAP' | 'MSO' | 'MFO' | 'SNET' | 'FNLT';

interface GanttTask {
  id: string; wbs: string; name: string; type: TaskType;
  level: number; parentId?: string; duration: number;
  start: Date; end: Date; pctComplete: number;
  predecessors: Predecessor[]; resources: string[];
  isCritical: boolean; status: TaskStatus;
  baselineStart?: Date; baselineEnd?: Date;
  notes?: string;
  constraint?: ConstraintType;
  constraintDate?: string;
  priority?: number;  // 0-1000, défaut 500
  storeId: string; // original TacheWBS.id
}

/* ══════════════════════════════════════════════════════════════════════════════
   CONSTANTS
══════════════════════════════════════════════════════════════════════════════ */
const ROW_H = 30;
const HEADER_H = 48;
const TABLE_W = 480;
const PX_PER_DAY: Record<ZoomLevel, number> = {
  semaine:   120 / 7,
  mois:      100 / 30.44,
  trimestre: 120 / 91.25,
  annee:     120 / 365,
};
const MONTH_ABBR = ['Jan','Fév','Mar','Avr','Mai','Juin','Jul','Aoû','Sep','Oct','Nov','Déc'];
const ORIGIN       = new Date(2023, 0, 1);
const TIMELINE_END = new Date(2030, 11, 31);
const NAVY = '#3D1A6B';
const ORANGE = '#F47920';

/* ══════════════════════════════════════════════════════════════════════════════
   HELPERS
══════════════════════════════════════════════════════════════════════════════ */
function dateToPx(d: Date, origin: Date, ppd: number): number {
  return Math.round((d.getTime() - origin.getTime()) / 86_400_000 * ppd);
}
function addDays(d: Date, n: number): Date {
  const r = new Date(d); r.setDate(r.getDate() + n); return r;
}
function diffDays(a: Date, b: Date): number {
  return Math.round((b.getTime() - a.getTime()) / 86_400_000);
}
function fmtDate(d: Date): string {
  return `${String(d.getDate()).padStart(2,'0')}/${String(d.getMonth()+1).padStart(2,'0')}/${String(d.getFullYear()).slice(2)}`;
}
function fmtDateInput(d: Date): string {
  return d.toISOString().split('T')[0];
}

function getMonthColumns(ppd: number): { year:number; month:number; label:string; left:number; width:number }[] {
  const cols: { year:number; month:number; label:string; left:number; width:number }[] = [];
  let cur = new Date(ORIGIN);
  while (cur <= TIMELINE_END) {
    const year = cur.getFullYear(); const month = cur.getMonth();
    const days = new Date(year, month+1, 0).getDate();
    cols.push({ year, month, label: MONTH_ABBR[month], left: dateToPx(cur, ORIGIN, ppd), width: Math.round(days * ppd) });
    cur = new Date(year, month+1, 1);
  }
  return cols;
}
function getYearGroups(cols: ReturnType<typeof getMonthColumns>): {year:number; left:number; width:number}[] {
  const groups: {year:number; left:number; width:number}[] = [];
  for (const col of cols) {
    const last = groups[groups.length-1];
    if (last && last.year === col.year) last.width += col.width;
    else groups.push({ year: col.year, left: col.left, width: col.width });
  }
  return groups;
}

function getVisibleTasks(tasks: GanttTask[], collapsed: Set<string>): GanttTask[] {
  return tasks.filter(t => {
    let pid = t.parentId;
    while (pid) {
      if (collapsed.has(pid)) return false;
      pid = tasks.find(x => x.id === pid)?.parentId;
    }
    return true;
  });
}

/** Cascade retroplanning: shift all FS successors by deltaDays */
function cascadeRetroplan(tasks: GanttTask[], movedId: string, deltaDays: number): GanttTask[] {
  if (deltaDays === 0) return tasks;
  const visited = new Set<string>([movedId]);
  const queue   = [movedId];
  const shifted  = new Map<string, number>([[movedId, deltaDays]]);

  while (queue.length > 0) {
    const currentId = queue.shift()!;
    const delta = shifted.get(currentId)!;
    // find all tasks that have currentId as FS predecessor
    tasks.forEach(t => {
      if (visited.has(t.id)) return;
      const hasFSPred = t.predecessors.some(p => p.id === currentId && p.type === 'FS');
      if (hasFSPred) {
        visited.add(t.id);
        shifted.set(t.id, delta);
        queue.push(t.id);
      }
    });
  }

  return tasks.map(t => {
    const d = shifted.get(t.id);
    if (d == null || t.id === movedId) return t;
    return { ...t, start: addDays(t.start, d), end: addDays(t.end, d) };
  });
}

/**
 * CPM (Critical Path Method) — niveau Primavera P6 / MS Project.
 * Passe AVANT (ES/EF) + passe ARRIÈRE (LS/LF) sur les tâches feuilles, gère les
 * 4 types de liens (FS, SS, FF, SF) + décalages (lag), calcule la marge totale et
 * retourne le chemin critique = tâches de marge ≤ 0. Unité : jours.
 */
function computeCPM(tasks: GanttTask[]): { critical: Set<string>; totalFloat: Map<string, number>; es: Map<string, number>; ef: Map<string, number> } {
  const leaves = tasks.filter(t => t.type !== 'summary');
  const empty = { critical: new Set<string>(), totalFloat: new Map<string, number>(), es: new Map<string, number>(), ef: new Map<string, number>() };
  if (!leaves.length) return empty;
  const byId = new Map(leaves.map(t => [t.id, t]));
  const dur = (t: GanttTask) => Math.max(t.type === 'milestone' ? 0 : 1, Math.round(t.duration || 0));
  const ES = new Map<string, number>(), EF = new Map<string, number>();
  const fwd = (id: string, stack = new Set<string>()): number => {
    if (EF.has(id)) return EF.get(id)!;
    if (stack.has(id)) return 0;
    stack.add(id);
    const t = byId.get(id); if (!t) return 0;
    let es = 0;
    for (const p of t.predecessors) {
      if (!byId.has(p.id)) continue;
      fwd(p.id, stack);
      const pes = ES.get(p.id) ?? 0, pef = EF.get(p.id) ?? 0, lag = p.lag || 0;
      const cand = p.type === 'SS' ? pes + lag
        : p.type === 'FF' ? pef + lag - dur(t)
        : p.type === 'SF' ? pes + lag - dur(t)
        : pef + lag; // FS
      es = Math.max(es, cand);
    }
    ES.set(id, es); EF.set(id, es + dur(t));
    return EF.get(id)!;
  };
  leaves.forEach(t => fwd(t.id));
  const projectEnd = Math.max(0, ...leaves.map(t => EF.get(t.id) ?? 0));
  // successeurs
  const succ = new Map<string, { id: string; type: LinkType; lag: number }[]>();
  leaves.forEach(t => t.predecessors.forEach(p => {
    if (!byId.has(p.id)) return;
    if (!succ.has(p.id)) succ.set(p.id, []);
    succ.get(p.id)!.push({ id: t.id, type: p.type, lag: p.lag || 0 });
  }));
  const LF = new Map<string, number>(), LS = new Map<string, number>();
  const bwd = (id: string, stack = new Set<string>()): number => {
    if (LF.has(id)) return LF.get(id)!;
    if (stack.has(id)) return projectEnd;
    stack.add(id);
    const t = byId.get(id); if (!t) return projectEnd;
    const ss = succ.get(id) ?? [];
    let lf = ss.length ? Infinity : projectEnd;
    for (const s of ss) {
      bwd(s.id, stack);
      const sls = LS.get(s.id) ?? projectEnd, slf = LF.get(s.id) ?? projectEnd, lag = s.lag || 0;
      const cand = s.type === 'SS' ? sls - lag + dur(t)
        : s.type === 'FF' ? slf - lag
        : s.type === 'SF' ? slf - lag + dur(t)
        : sls - lag; // FS
      lf = Math.min(lf, cand);
    }
    if (!isFinite(lf)) lf = projectEnd;
    LF.set(id, lf); LS.set(id, lf - dur(t));
    return lf;
  };
  leaves.forEach(t => bwd(t.id));
  const critical = new Set<string>(); const totalFloat = new Map<string, number>();
  leaves.forEach(t => {
    const tf = (LS.get(t.id) ?? 0) - (ES.get(t.id) ?? 0);
    totalFloat.set(t.id, tf);
    if (tf <= 0) critical.add(t.id);
  });
  return { critical, totalFloat, es: ES, ef: EF };
}

/** Ajoute n jours OUVRÉS (week-ends exclus) à une date. */
function addWorkingDays(start: Date, n: number): Date {
  const d = new Date(start); let added = 0;
  if (n <= 0) { // caler sur un jour ouvré
    while (d.getDay() === 0 || d.getDay() === 6) d.setDate(d.getDate() + 1);
    return d;
  }
  while (added < n) { d.setDate(d.getDate() + 1); if (d.getDay() !== 0 && d.getDay() !== 6) added++; }
  return d;
}
const ymd = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
function computeCriticalIds(tasks: GanttTask[]): Set<string> { return computeCPM(tasks).critical; }

/* ══════════════════════════════════════════════════════════════════════════════
   STORE → GANTT TASK CONVERTER
══════════════════════════════════════════════════════════════════════════════ */
function storeToGanttTasks(projet: Projet): GanttTask[] {
  const sorted = [...projet.taches].sort((a, b) => a.ordre - b.ordre);
  const tasks: GanttTask[] = [];
  const parentMap = new Map<number, string>();

  sorted.forEach((t, idx) => {
    const parentId = t.niveau > 1 ? parentMap.get(t.niveau - 1) : undefined;
    const status: TaskStatus = t.statutTache === 'termine' ? 'termine'
      : t.statutTache === 'bloque' ? 'en_retard'
      : t.statutTache === 'en_cours' ? 'en_cours' : 'non_demarre';
    const type: TaskType = t.type === 'Jalon' ? 'milestone'
      : t.type === 'Récapitulative' ? 'summary' : 'normal';

    tasks.push({
      id: t.id, wbs: String(idx + 1), name: t.nom, type, level: t.niveau - 1,
      parentId, duration: t.duree,
      start: new Date(t.dateDebut), end: new Date(t.dateFin),
      pctComplete: t.avancement,
      predecessors: t.predecesseurs.map(p => ({ id: p.tacheId, type: p.type as LinkType, lag: p.delai })),
      resources: t.assignations.map(a => a.ressourceId),
      isCritical: t.priorite === 'Haute' && t.niveau === 2, status,
      storeId: t.id,
      ...(t.reference && t.dateDebutRef && t.dateFinRef ? {
        baselineStart: new Date(t.dateDebutRef), baselineEnd: new Date(t.dateFinRef),
      } : {}),
    });
    if (type === 'summary') parentMap.set(t.niveau, t.id);
  });

  // Add jalons
  projet.jalons.forEach((j, ji) => {
    tasks.push({
      id: `${projet.id}-jal-${ji}`, wbs: `J${ji+1}`, name: j.label + (j.atteint ? ' ✓' : ''),
      type: 'milestone', level: 0, duration: 0,
      start: new Date(j.date), end: new Date(j.date),
      pctComplete: j.atteint ? 100 : 0, predecessors: [], resources: [],
      isCritical: !j.atteint, status: j.atteint ? 'termine' : 'non_demarre',
      storeId: `${projet.id}-jal-${ji}`,
    });
  });
  return tasks;
}


/* ══════════════════════════════════════════════════════════════════════════════
   ADD / EDIT TASK MODAL
══════════════════════════════════════════════════════════════════════════════ */
interface PredRow { id: string; type: LinkType; lag: number; }
interface TaskFormData {
  name: string; duration: string; dateDebut: string; dateFin: string;
  pctComplete: string; type: TaskType;
  preds: PredRow[];
  notes: string;
  constraint: ConstraintType;
  constraintDate: string;
  priority: string;
}
const EMPTY_FORM: TaskFormData = {
  name: '', duration: '10', dateDebut: '', dateFin: '',
  pctComplete: '0', type: 'normal',
  preds: [],
  notes: '',
  constraint: 'ASAP',
  constraintDate: '',
  priority: '500',
};
const CONSTRAINT_LABELS: Record<ConstraintType, string> = {
  ASAP: 'Dès que possible (ASAP)',
  ALAP: 'Le plus tard possible (ALAP)',
  MSO: 'Doit commencer le (MSO)',
  MFO: 'Doit se terminer le (MFO)',
  SNET: 'Ne pas commencer avant le (SNET)',
  FNLT: 'Ne pas terminer après le (FNLT)',
};

function TaskModal({
  mode, task, allTasks, projetId, onSave, onClose, onDelete,
}: {
  mode: 'add' | 'edit';
  task?: GanttTask | null;
  allTasks: GanttTask[];
  projetId: string;
  onSave: (data: TaskFormData) => void;
  onClose: () => void;
  onDelete?: () => void;
}) {
  const [activeTab, setActiveTab] = useState<'general' | 'predecessors' | 'advanced'>('general');
  const [form, setForm] = useState<TaskFormData>(() => {
    if (mode === 'edit' && task) {
      return {
        name: task.name, duration: String(task.duration),
        dateDebut: fmtDateInput(task.start), dateFin: fmtDateInput(task.end),
        pctComplete: String(task.pctComplete), type: task.type,
        preds: task.predecessors.map(p => ({ id: p.id, type: p.type, lag: p.lag })),
        notes: task.notes ?? '',
        constraint: task.constraint ?? 'ASAP',
        constraintDate: task.constraintDate ?? '',
        priority: String(task.priority ?? 500),
      };
    }
    return { ...EMPTY_FORM, dateDebut: fmtDateInput(new Date()), dateFin: fmtDateInput(addDays(new Date(), 10)) };
  });

  const update = <K extends keyof TaskFormData>(k: K, v: TaskFormData[K]) =>
    setForm(p => ({ ...p, [k]: v }));

  const addPred = () => setForm(p => ({ ...p, preds: [...p.preds, { id: '', type: 'FS', lag: 0 }] }));
  const updatePred = (i: number, field: keyof PredRow, v: string | number) =>
    setForm(p => ({ ...p, preds: p.preds.map((r, idx) => idx === i ? { ...r, [field]: v } : r) }));
  const removePred = (i: number) =>
    setForm(p => ({ ...p, preds: p.preds.filter((_, idx) => idx !== i) }));

  const inp: React.CSSProperties = {
    width: '100%', boxSizing: 'border-box', border: '1px solid #D1D5DB',
    borderRadius: 5, padding: '6px 8px', fontSize: 12, outline: 'none', fontFamily: 'inherit',
  };
  const lbl: React.CSSProperties = { fontSize: 10, fontWeight: 700, color: '#374151', marginBottom: 3, display: 'block' };
  const tabStyle = (t: typeof activeTab): React.CSSProperties => ({
    padding: '6px 14px', border: 'none', fontSize: 11, fontWeight: 600,
    background: activeTab === t ? '#fff' : 'transparent',
    color: activeTab === t ? NAVY : 'rgba(255,255,255,0.7)',
    cursor: 'pointer', borderRadius: '4px 4px 0 0',
    borderBottom: activeTab === t ? `2px solid ${ORANGE}` : 'none',
  });
  const needsDate = form.constraint !== 'ASAP' && form.constraint !== 'ALAP';

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)', zIndex: 9000, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
      onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div style={{ background: '#fff', borderRadius: 10, width: 520, maxHeight: '88vh', display: 'flex', flexDirection: 'column', boxShadow: '0 20px 60px rgba(0,0,0,0.28)', overflow: 'hidden' }}>
        {/* Header */}
        <div style={{ background: NAVY, padding: '12px 16px 0', flexShrink: 0 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
            <span style={{ fontSize: 13, fontWeight: 700, color: '#fff', display: 'flex', alignItems: 'center', gap: 8 }}>
              {mode === 'add' ? <Plus size={15} /> : <Edit3 size={15} />}
              {mode === 'add' ? 'Nouvelle tâche' : 'Modifier — ' + (task?.name?.slice(0, 28) ?? '')}
            </span>
            <button onClick={onClose} aria-label="Fermer" style={{ background: 'rgba(255,255,255,0.15)', border: 'none', color: '#fff', borderRadius: 4, padding: '3px 8px', cursor: 'pointer' }}><X size={14} /></button>
          </div>
          {/* Tabs */}
          <div style={{ display: 'flex', gap: 2 }}>
            <button style={tabStyle('general')} onClick={() => setActiveTab('general')}>Général</button>
            <button style={tabStyle('predecessors')} onClick={() => setActiveTab('predecessors')}>
              Prédécesseurs {form.preds.length > 0 && <span style={{ marginLeft: 4, background: ORANGE, color: '#fff', borderRadius: 99, fontSize: 9, padding: '1px 5px', fontWeight: 800 }}>{form.preds.length}</span>}
            </button>
            <button style={tabStyle('advanced')} onClick={() => setActiveTab('advanced')}>Avancé</button>
          </div>
        </div>

        {/* Body */}
        <div style={{ flex: 1, overflowY: 'auto', padding: 16 }}>

          {activeTab === 'general' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <div><label style={lbl}>Nom de la tâche *</label><input style={inp} value={form.name} onChange={e => update('name', e.target.value)} placeholder="Ex: Études topographiques" autoFocus /></div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                <div><label style={lbl}>Type de tâche</label>
                  <select style={inp} value={form.type} onChange={e => update('type', e.target.value as TaskType)}>
                    <option value="normal">Normale</option>
                    <option value="summary">Récapitulative</option>
                    <option value="milestone">Jalon</option>
                  </select>
                </div>
                <div><label style={lbl}>Durée (jours)</label>
                  <input type="number" min={0} style={inp} value={form.duration}
                    onChange={e => { update('duration', e.target.value); const d = parseInt(e.target.value) || 0; if (form.dateDebut) update('dateFin', fmtDateInput(addDays(new Date(form.dateDebut), d))); }} />
                </div>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                <div><label style={lbl}>Date début</label><input type="date" style={inp} value={form.dateDebut} onChange={e => update('dateDebut', e.target.value)} /></div>
                <div><label style={lbl}>Date fin</label><input type="date" style={inp} value={form.dateFin} onChange={e => update('dateFin', e.target.value)} /></div>
              </div>
              <div>
                <label style={lbl}>Avancement : <strong style={{ color: NAVY }}>{form.pctComplete}%</strong></label>
                <input type="range" min={0} max={100} step={5} value={form.pctComplete}
                  onChange={e => update('pctComplete', e.target.value)}
                  style={{ width: '100%', accentColor: NAVY }} />
              </div>
              <div>
                <label style={lbl}>Notes / Commentaires</label>
                <textarea rows={3} style={{ ...inp, resize: 'vertical', lineHeight: '1.5' }}
                  value={form.notes} onChange={e => update('notes', e.target.value)}
                  placeholder="Instructions, observations, risques associés à cette tâche..." />
              </div>
            </div>
          )}

          {activeTab === 'predecessors' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                <span style={{ fontSize: 11, fontWeight: 700, color: '#374151' }}>Liaisons de dépendances</span>
                <button onClick={addPred}
                  style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '4px 10px', background: NAVY, color: '#fff', border: 'none', borderRadius: 5, fontSize: 11, fontWeight: 700, cursor: 'pointer' }}>
                  <Plus size={11} /> Ajouter
                </button>
              </div>

              {form.preds.length === 0 && (
                <div style={{ padding: '24px 0', textAlign: 'center', color: '#94A3B8', fontSize: 12 }}>
                  Aucun prédécesseur défini. Cliquez « Ajouter » pour créer une liaison.
                </div>
              )}

              {form.preds.map((pred, i) => (
                <div key={i} style={{ display: 'grid', gridTemplateColumns: '2fr 80px 80px 32px', gap: 6, alignItems: 'center', padding: '8px 10px', background: '#F8FAFC', borderRadius: 7, border: '1px solid #E5E7EB' }}>
                  <div>
                    <div style={{ fontSize: 9, fontWeight: 700, color: '#64748B', marginBottom: 3 }}>TÂCHE PRÉDÉCESSEUR</div>
                    <select style={{ ...inp, marginBottom: 0 }} value={pred.id} onChange={e => updatePred(i, 'id', e.target.value)}>
                      <option value="">— Sélectionner —</option>
                      {allTasks.filter(t => t.id !== task?.id && t.type !== 'summary').map(t => (
                        <option key={t.id} value={t.id}>{t.wbs} — {t.name.slice(0, 28)}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <div style={{ fontSize: 9, fontWeight: 700, color: '#64748B', marginBottom: 3 }}>TYPE</div>
                    <select style={{ ...inp, marginBottom: 0 }} value={pred.type} onChange={e => updatePred(i, 'type', e.target.value as LinkType)} disabled={!pred.id}>
                      <option value="FS">FS</option><option value="SS">SS</option>
                      <option value="FF">FF</option><option value="SF">SF</option>
                    </select>
                  </div>
                  <div>
                    <div style={{ fontSize: 9, fontWeight: 700, color: '#64748B', marginBottom: 3 }}>DÉCALAGE</div>
                    <input type="number" style={{ ...inp, marginBottom: 0 }} placeholder="0j" value={pred.lag}
                      onChange={e => updatePred(i, 'lag', parseInt(e.target.value) || 0)} disabled={!pred.id} />
                  </div>
                  <button onClick={() => removePred(i)}
                    aria-label="Supprimer ce prédécesseur"
                    style={{ marginTop: 16, background: '#FEE2E2', border: '1px solid #FCA5A5', borderRadius: 5, color: '#EF4444', cursor: 'pointer', padding: '4px 6px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <X size={11} />
                  </button>
                </div>
              ))}

              {form.preds.length > 0 && (
                <div style={{ padding: '8px 10px', background: '#EFF6FF', borderRadius: 7, border: '1px solid #BFDBFE', fontSize: 10.5, color: '#1E40AF', lineHeight: 1.5 }}>
                  <strong>FS</strong> = Fin-Début · <strong>SS</strong> = Début-Début · <strong>FF</strong> = Fin-Fin · <strong>SF</strong> = Début-Fin<br />
                  Le décalage (en jours) peut être négatif pour un chevauchement.
                </div>
              )}
            </div>
          )}

          {activeTab === 'advanced' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <div>
                <label style={lbl}>Contrainte de planification</label>
                <select style={inp} value={form.constraint} onChange={e => update('constraint', e.target.value as ConstraintType)}>
                  {(Object.keys(CONSTRAINT_LABELS) as ConstraintType[]).map(c => (
                    <option key={c} value={c}>{CONSTRAINT_LABELS[c]}</option>
                  ))}
                </select>
              </div>
              {needsDate && (
                <div>
                  <label style={lbl}>Date de contrainte</label>
                  <input type="date" style={inp} value={form.constraintDate} onChange={e => update('constraintDate', e.target.value)} />
                </div>
              )}
              <div>
                <label style={lbl}>Priorité (0 — 1000) · défaut : 500</label>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <input type="range" min={0} max={1000} step={100} value={form.priority}
                    onChange={e => update('priority', e.target.value)}
                    style={{ flex: 1, accentColor: ORANGE }} />
                  <span style={{ fontSize: 13, fontWeight: 800, color: ORANGE, width: 40, textAlign: 'right' }}>{form.priority}</span>
                </div>
                <div style={{ fontSize: 10, color: '#64748B', marginTop: 4 }}>
                  Utilisé par le nivellement automatique des ressources : les tâches à priorité plus haute sont planifiées en premier.
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div style={{ padding: '10px 16px', borderTop: '1px solid #E5E7EB', display: 'flex', justifyContent: 'space-between', flexShrink: 0 }}>
          <div>
            {onDelete && (
              <button onClick={onDelete} style={{ padding: '6px 14px', background: '#FEE2E2', color: '#EF4444', border: '1px solid #FCA5A5', borderRadius: 5, fontSize: 11, fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 5 }}>
                <Trash2 size={12} /> Supprimer
              </button>
            )}
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <button onClick={onClose} style={{ padding: '6px 14px', background: '#F1F5F9', border: '1px solid #E5E7EB', borderRadius: 5, fontSize: 11, fontWeight: 600, cursor: 'pointer', color: '#374151' }}>Annuler</button>
            <button onClick={() => { if (form.name.trim()) onSave(form); }}
              style={{ padding: '6px 16px', background: NAVY, color: '#fff', border: 'none', borderRadius: 5, fontSize: 11, fontWeight: 700, cursor: 'pointer' }}>
              {mode === 'add' ? 'Ajouter la tâche' : 'Enregistrer'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ══════════════════════════════════════════════════════════════════════════════
   RESOURCE ASSIGNMENT MODAL
══════════════════════════════════════════════════════════════════════════════ */
function ResourceModal({
  task, ressources, assigned, onSave, onClose,
}: {
  task: GanttTask; ressources: Ressource[];
  assigned: { ressourceId: string; unite: number }[];
  onSave: (assignments: { ressourceId: string; unite: number }[]) => void;
  onClose: () => void;
}) {
  const [list, setList] = useState<{ ressourceId: string; unite: number }[]>(
    ressources.map(r => ({
      ressourceId: r.id,
      unite: assigned.find(a => a.ressourceId === r.id)?.unite ?? 0,
    }))
  );

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)', zIndex: 9000, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
      onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div style={{ background: '#fff', borderRadius: 8, width: 460, maxHeight: '80vh', boxShadow: '0 20px 60px rgba(0,0,0,0.22)', overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
        <div style={{ background: '#0F766E', padding: '12px 16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span style={{ fontSize: 13, fontWeight: 700, color: '#fff', display: 'flex', alignItems: 'center', gap: 8 }}>
            <Users size={15} /> Affecter des ressources — {task.name.slice(0, 30)}
          </span>
          <button onClick={onClose} aria-label="Fermer" style={{ background: 'rgba(255,255,255,0.15)', border: 'none', color: '#fff', borderRadius: 4, padding: '3px 8px', cursor: 'pointer' }}><X size={14} /></button>
        </div>
        <div style={{ flex: 1, overflowY: 'auto', padding: 12 }}>
          {list.length === 0 && (
            <div style={{ padding: '16px 12px', textAlign: 'center', color: '#94A3B8', fontSize: 12 }}>
              Aucune ressource disponible pour ce projet.
            </div>
          )}
          {list.map((item, idx) => {
            const r = ressources.find(x => x.id === item.ressourceId);
            if (!r) return null;
            const isAssigned = item.unite > 0;
            return (
              <div key={item.ressourceId} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 10px', borderRadius: 6, marginBottom: 4, background: isAssigned ? '#F0FDF4' : '#FAFAFA', border: `1px solid ${isAssigned ? '#BBF7D0' : '#E5E7EB'}` }}>
                <div style={{ width: 32, height: 32, borderRadius: '50%', background: isAssigned ? '#0F766E' : '#E5E7EB', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                  <span style={{ fontSize: 11, fontWeight: 700, color: isAssigned ? '#fff' : '#9CA3AF' }}>
                    {(r.prenom?.[0] ?? '') + (r.nom?.[0] ?? '')}
                  </span>
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 12, fontWeight: 600, color: '#1E293B' }}>{r.prenom} {r.nom}</div>
                  <div style={{ fontSize: 10, color: '#94A3B8' }}>{r.direction ?? r.type} · {r.capaciteMax}% dispo</div>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <input type="range" min={0} max={100} step={25} value={item.unite}
                    onChange={e => setList(prev => prev.map((x, i) => i === idx ? { ...x, unite: Number(e.target.value) } : x))}
                    style={{ width: 80, accentColor: '#0F766E' }} />
                  <span style={{ fontSize: 11, fontWeight: 700, color: isAssigned ? '#0F766E' : '#9CA3AF', width: 32, textAlign: 'right' }}>{item.unite}%</span>
                </div>
              </div>
            );
          })}
        </div>
        <div style={{ padding: '10px 12px', borderTop: '1px solid #E5E7EB', display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
          <button onClick={onClose} style={{ padding: '6px 14px', background: '#F1F5F9', border: '1px solid #E5E7EB', borderRadius: 5, fontSize: 11, fontWeight: 600, cursor: 'pointer', color: '#374151' }}>Annuler</button>
          <button onClick={() => onSave(list.filter(x => x.unite > 0))}
            style={{ padding: '6px 16px', background: '#0F766E', color: '#fff', border: 'none', borderRadius: 5, fontSize: 11, fontWeight: 700, cursor: 'pointer' }}>
            Appliquer
          </button>
        </div>
      </div>
    </div>
  );
}

/* ══════════════════════════════════════════════════════════════════════════════
   INLINE PROGRESS POPUP
══════════════════════════════════════════════════════════════════════════════ */
function ProgressPopup({ task, top, onSave, onClose }: {
  task: GanttTask; top: number;
  onSave: (pct: number) => void; onClose: () => void;
}) {
  const [val, setVal] = useState(task.pctComplete);
  return (
    <div style={{ position: 'fixed', top, left: TABLE_W + 20, zIndex: 8000, background: '#fff', border: `2px solid ${NAVY}`, borderRadius: 8, padding: '10px 14px', boxShadow: '0 8px 24px rgba(0,0,0,0.18)', width: 200 }}>
      <div style={{ fontSize: 11, fontWeight: 700, color: NAVY, marginBottom: 8 }}>Avancement — {task.name.slice(0, 22)}</div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <input type="range" min={0} max={100} step={5} value={val}
          onChange={e => setVal(Number(e.target.value))}
          style={{ flex: 1, accentColor: NAVY }} />
        <span style={{ fontSize: 13, fontWeight: 800, color: NAVY, width: 36, textAlign: 'right' }}>{val}%</span>
      </div>
      <div style={{ display: 'flex', gap: 6, marginTop: 8, justifyContent: 'flex-end' }}>
        <button onClick={onClose} aria-label="Fermer" style={{ padding: '4px 10px', background: '#F1F5F9', border: '1px solid #E5E7EB', borderRadius: 4, fontSize: 10, cursor: 'pointer', color: '#374151' }}>✕</button>
        <button onClick={() => { onSave(val); onClose(); }}
          style={{ padding: '4px 12px', background: NAVY, color: '#fff', border: 'none', borderRadius: 4, fontSize: 10, fontWeight: 700, cursor: 'pointer' }}>OK</button>
      </div>
    </div>
  );
}

/* ══════════════════════════════════════════════════════════════════════════════
   MAIN GANTT COMPONENT
══════════════════════════════════════════════════════════════════════════════ */
export default function Gantt() {
  const store = readOnlyGuard(useProjectStore(), isOperationalReadOnly(useAuth().user));

  const [selectedProjetId, setSelectedProjetId] = useState<string>(store.projets[0]?.id ?? '');
  const [taskSearch, setTaskSearch] = useState('');
  const [zoom,             setZoom]             = useState<ZoomLevel>('mois');
  const [showCritical,     setShowCritical]     = useState(true);
  const [showBaseline,     setShowBaseline]     = useState(false);
  const [collapsedIds,     setCollapsedIds]     = useState<Set<string>>(new Set());
  const [selectedId,       setSelectedId]       = useState<string | null>(null);
  const [activeRibbonTab,  setActiveRibbonTab]  = useState<RibbonTab>('tache');

  // Modals
  const [addTaskModal,   setAddTaskModal]   = useState(false);
  const [editTaskId,     setEditTaskId]     = useState<string | null>(null);
  const [resourceTaskId, setResourceTaskId] = useState<string | null>(null);
  const [progressTaskId, setProgressTaskId] = useState<string | null>(null);
  const [progressTop,    setProgressTop]    = useState(0);
  // Baselines
  const [showBaselineModal,  setShowBaselineModal]  = useState(false);
  const [showManageBaselines, setShowManageBaselines] = useState(false);
  const [newBaselineName,    setNewBaselineName]    = useState('');
  const [newBaselineDesc,    setNewBaselineDesc]    = useState('');
  // Analyse features
  const [pertTaskId,     setPertTaskId]     = useState<string | null>(null);
  const [pertEstimates,  setPertEstimates]  = useState<PertEstimate[]>([]);

  const isSyncing   = useRef(false);
  const tableBodyRef = useRef<HTMLDivElement>(null);
  const ganttBodyRef = useRef<HTMLDivElement>(null);
  const headerScrollRef = useRef<HTMLDivElement>(null);

  // ── Derive gantt tasks from project store ──
  const activeProjet = useMemo(() =>
    store.projets.find(p => p.id === selectedProjetId) ?? null,
  [selectedProjetId, store.projets]);

  const [localTasks, setLocalTasks] = useState<GanttTask[]>([]);
  useEffect(() => {
    if (activeProjet) setLocalTasks(storeToGanttTasks(activeProjet));
    else setLocalTasks([]);
  }, [activeProjet]);

  // Détection auto du temps : le projet ouvert dans le planning devient le projet
  // actif → le tracker accumule le temps bureau sur ce projet.
  useEffect(() => {
    if (activeProjet) useTempsStore.getState().setProjetActif(activeProjet.nom);
  }, [activeProjet?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  const cpm          = useMemo(() => computeCPM(localTasks), [localTasks]);
  const criticalIds  = cpm.critical;
  const ppd          = PX_PER_DAY[zoom];
  const monthCols    = useMemo(() => getMonthColumns(ppd), [ppd]);
  const yearGroups   = useMemo(() => getYearGroups(monthCols), [monthCols]);
  const totalTimeline = useMemo(() => dateToPx(TIMELINE_END, ORIGIN, ppd) + 60, [ppd]);
  const visibleTasks = useMemo(() => getVisibleTasks(localTasks, collapsedIds), [localTasks, collapsedIds]);

  const searchedVisibleTasks = useMemo(() => {
    if (!taskSearch.trim()) return visibleTasks;
    const q = taskSearch.toLowerCase();
    const matched = new Set<string>();
    // Tâches qui correspondent
    visibleTasks.forEach(t => {
      if (t.name.toLowerCase().includes(q) || (t.wbs || '').toLowerCase().includes(q)) matched.add(t.id);
    });
    // Inclure leurs parents récursifs
    const addParents = (id: string) => {
      const task = localTasks.find(t => t.id === id);
      if (task?.parentId && !matched.has(task.parentId)) {
        matched.add(task.parentId);
        addParents(task.parentId);
      }
    };
    [...matched].forEach(addParents);
    return visibleTasks.filter(t => matched.has(t.id));
  }, [visibleTasks, taskSearch, localTasks]);

  // ── AI / Resource Leveling ──
  const resourceLoads = useMemo(
    () => computeResourceLoads(localTasks.filter(t => t.type !== 'summary'), store.ressources),
    [localTasks, store.ressources]
  );
  const overloadedResources = useMemo(() => resourceLoads.filter(r => r.overloaded), [resourceLoads]);

  // ── AI schedule analysis ──
  const aiAnalysis = useMemo(() => {
    if (!activeProjet || !localTasks.length) return null;
    const critCount    = criticalIds.size;
    const totalTasks   = localTasks.filter(t => t.type === 'normal').length;
    const doneCount    = localTasks.filter(t => t.pctComplete === 100).length;
    const lateCount    = localTasks.filter(t => t.status === 'en_retard').length;
    const avgPct       = totalTasks > 0 ? Math.round(localTasks.filter(t => t.type === 'normal').reduce((s, t) => s + t.pctComplete, 0) / totalTasks) : 0;
    const critLeaf     = localTasks.filter(t => criticalIds.has(t.id) && t.type === 'normal');
    const critAvg      = critLeaf.length > 0 ? Math.round(critLeaf.reduce((s, t) => s + t.pctComplete, 0) / critLeaf.length) : 0;
    const endDates     = critLeaf.map(t => t.end.getTime());
    const lastCritDate = endDates.length ? new Date(Math.max(...endDates)) : null;
    const overloads    = overloadedResources.length;

    let verdict = '✅ Planning conforme';
    let color   = '#15803D';
    if (lateCount > 0 || critAvg < 50) { verdict = '⚠️ Risques de retard'; color = '#D97706'; }
    if (overloads > 0 && lateCount > 2) { verdict = '🔴 Surcharges critiques détectées'; color = '#DC2626'; }

    return { critCount, totalTasks, doneCount, lateCount, avgPct, critAvg, lastCritDate, overloads, verdict, color };
  }, [activeProjet, localTasks, criticalIds, overloadedResources]);

  // ── PERT helpers ──
  const getPertEstimate = (taskId: string): PertEstimate | undefined => pertEstimates.find(e => e.taskId === taskId);
  const setPert = (taskId: string, field: 'O' | 'M' | 'P', val: number) => {
    setPertEstimates(prev => {
      const existing = prev.find(e => e.taskId === taskId);
      if (existing) return prev.map(e => e.taskId === taskId ? { ...e, [field]: val } : e);
      const task = localTasks.find(t => t.id === taskId);
      const m = task?.duration ?? 10;
      return [...prev, { taskId, O: m - 2, M: m, P: m + 5, [field]: val }];
    });
  };
  const initPertForTask = (taskId: string) => {
    if (!getPertEstimate(taskId)) {
      const task = localTasks.find(t => t.id === taskId);
      const m = task?.duration ?? 10;
      setPertEstimates(prev => [...prev, { taskId, O: Math.max(1, m - Math.round(m * 0.2)), M: m, P: m + Math.round(m * 0.5) }]);
    }
    setPertTaskId(taskId);
  };

  const today    = new Date();
  const todayPx  = dateToPx(today, ORIGIN, ppd);

  const onTableScroll = (e: React.UIEvent<HTMLDivElement>) => {
    if (isSyncing.current) return; isSyncing.current = true;
    if (ganttBodyRef.current) ganttBodyRef.current.scrollTop = e.currentTarget.scrollTop;
    isSyncing.current = false;
  };
  const onGanttScroll = (e: React.UIEvent<HTMLDivElement>) => {
    // Sync header months horizontally (toujours), et la table verticalement.
    if (headerScrollRef.current) headerScrollRef.current.scrollLeft = e.currentTarget.scrollLeft;
    if (isSyncing.current) return; isSyncing.current = true;
    if (tableBodyRef.current) tableBodyRef.current.scrollTop = e.currentTarget.scrollTop;
    isSyncing.current = false;
  };

  // ── Auto-défilement : amène la 1re tâche du projet dans le viewport ──
  // (sinon, projets datés 2024 → barres hors-écran car le timeline démarre en 2023)
  useEffect(() => {
    if (!ganttBodyRef.current || localTasks.length === 0) return;
    const earliest = localTasks.reduce((min, t) => t.start < min ? t.start : min, localTasks[0].start);
    const targetPx = Math.max(0, dateToPx(earliest, ORIGIN, ppd) - 48);
    // léger délai pour laisser le DOM se peindre
    const id = window.setTimeout(() => {
      if (ganttBodyRef.current) {
        ganttBodyRef.current.scrollLeft = targetPx;
        if (headerScrollRef.current) headerScrollRef.current.scrollLeft = targetPx;
      }
    }, 60);
    return () => window.clearTimeout(id);
  }, [selectedProjetId, localTasks, ppd]);

  const toggleCollapse = useCallback((id: string) => {
    setCollapsedIds(prev => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n; });
  }, []);

  // ── Store mutations ──
  const updateProgress = useCallback((taskId: string, pct: number) => {
    if (!activeProjet) return;
    store.updateAvancement(activeProjet.id, taskId, pct);
    setLocalTasks(prev => prev.map(t => t.id === taskId ? { ...t, pctComplete: pct } : t));
  }, [activeProjet, store]);

  const saveTaskEdit = useCallback((data: TaskFormData) => {
    const taskId = editTaskId;
    if (!taskId || !activeProjet) return;
    const gTask = localTasks.find(t => t.id === taskId);
    if (!gTask) return;

    const newStart = new Date(data.dateDebut);
    const newEnd   = new Date(data.dateFin);
    const oldStart = gTask.start;
    const delta    = diffDays(oldStart, newStart);
    const validPreds = data.preds.filter(p => p.id);

    let updated = localTasks.map(t => t.id === taskId ? {
      ...t, name: data.name, duration: Number(data.duration),
      start: newStart, end: newEnd, pctComplete: Number(data.pctComplete),
      type: data.type,
      predecessors: validPreds,
      notes: data.notes,
      constraint: data.constraint,
      constraintDate: data.constraintDate,
      priority: Number(data.priority),
    } : t);

    if (delta !== 0) updated = cascadeRetroplan(updated, taskId, delta);
    setLocalTasks(updated);

    // Sync to store
    store.updateTache(activeProjet.id, taskId, {
      nom: data.name, duree: Number(data.duration),
      dateDebut: data.dateDebut, dateFin: data.dateFin,
      avancement: Number(data.pctComplete),
      type: data.type === 'summary' ? 'Récapitulative' : data.type === 'milestone' ? 'Jalon' : 'Normale',
      predecesseurs: validPreds.map(p => ({ tacheId: p.id, type: p.type as import('@/lib/projectStore').DepType, delai: p.lag })),
    });
    setEditTaskId(null);
  }, [editTaskId, activeProjet, localTasks, store]);

  const addTask = useCallback((data: TaskFormData) => {
    if (!activeProjet) return;
    const validPreds = data.preds.filter(p => p.id);
    const newT = store.createTache({
      projetId: activeProjet.id,
      nom: data.name,
      type: data.type === 'summary' ? 'Récapitulative' : data.type === 'milestone' ? 'Jalon' : 'Normale',
      niveau: 2, ordre: localTasks.length + 1,
      duree: Number(data.duration),
      dateDebut: data.dateDebut, dateFin: data.dateFin,
      avancement: Number(data.pctComplete),
      statutTache: 'a_faire', priorite: Number(data.priority) >= 700 ? 'Haute' : Number(data.priority) <= 300 ? 'Faible' : 'Moyenne',
      predecesseurs: validPreds.map(p => ({ tacheId: p.id, type: p.type as import('@/lib/projectStore').DepType, delai: p.lag })),
      assignations: [],
    });
    const ganttTask: GanttTask = {
      id: newT.id, wbs: String(localTasks.length + 1), name: newT.nom,
      type: data.type, level: 1, duration: newT.duree,
      start: new Date(newT.dateDebut), end: new Date(newT.dateFin),
      pctComplete: 0,
      predecessors: validPreds,
      resources: [],
      isCritical: false, status: 'non_demarre', storeId: newT.id,
      notes: data.notes,
      constraint: data.constraint,
      constraintDate: data.constraintDate,
      priority: Number(data.priority),
    };
    setLocalTasks(prev => [...prev, ganttTask]);
    setAddTaskModal(false);
  }, [activeProjet, localTasks, store]);

  const deleteTask = useCallback((taskId: string) => {
    if (!activeProjet) return;
    store.deleteTache(activeProjet.id, taskId);
    setLocalTasks(prev => prev.filter(t => t.id !== taskId));
    setEditTaskId(null);
  }, [activeProjet, store]);

  /** Indente la tâche sélectionnée (augmente son niveau → en fait un enfant du précédent). */
  const indentTask = useCallback(() => {
    if (!selectedId) return;
    setLocalTasks(prev => {
      const idx = prev.findIndex(t => t.id === selectedId);
      if (idx < 1) return prev; // can't indent first task
      const prevSibling = prev.slice(0, idx).reverse().find(t => t.level <= prev[idx].level);
      if (!prevSibling) return prev;
      const newLevel = Math.min(prev[idx].level + 1, 4);
      return prev.map((t, i) => i === idx ? { ...t, level: newLevel, parentId: prevSibling.id } : t);
    });
    toast.success('Tâche indentée (niveau augmenté)');
  }, [selectedId]);

  /** Dé-indente la tâche sélectionnée (diminue son niveau → remonte dans la hiérarchie). */
  const outdentTask = useCallback(() => {
    if (!selectedId) return;
    setLocalTasks(prev => {
      const idx = prev.findIndex(t => t.id === selectedId);
      if (idx < 0 || prev[idx].level < 1) return prev;
      const newLevel = Math.max(0, prev[idx].level - 1);
      const grandParent = prev.slice(0, idx).reverse().find(t => t.level < newLevel);
      return prev.map((t, i) => i === idx ? { ...t, level: newLevel, parentId: grandParent?.id } : t);
    });
    toast.success('Tâche dé-indentée (niveau diminué)');
  }, [selectedId]);

  /** Exporte le planning courant en CSV compatible Excel (BOM UTF-8). */
  const exportCSV = useCallback(() => {
    if (!activeProjet || localTasks.length === 0) { toast.error('Aucun planning à exporter'); return; }
    const headers = ['N° WBS', 'Nom', 'Type', 'Durée (j)', 'Début', 'Fin', 'Avancement (%)', 'Prédécesseurs', 'Ressources', 'Chemin critique', 'Notes'];
    const rows = localTasks.map(t => [
      t.wbs,
      t.name,
      t.type === 'summary' ? 'Récapitulative' : t.type === 'milestone' ? 'Jalon' : 'Normale',
      t.duration,
      fmtDate(t.start),
      fmtDate(t.end),
      t.pctComplete,
      t.predecessors.map(p => `${p.id}[${p.type}${p.lag ? `+${p.lag}j` : ''}]`).join('; '),
      t.resources.map(rid => { const r = store.ressources.find(x => x.id === rid); return r ? `${r.prenom} ${r.nom}` : rid; }).join('; '),
      criticalIds.has(t.id) ? 'Oui' : 'Non',
      (t.notes ?? '').replace(/"/g, '""'),
    ]);
    const csv = '﻿' + [headers, ...rows].map(r => r.map(c => `"${c}"`).join(';')).join('\n');
    const a = document.createElement('a');
    a.href = 'data:text/csv;charset=utf-8,' + encodeURIComponent(csv);
    a.download = `Gantt_${activeProjet.nom.replace(/\s+/g, '_')}_${new Date().toISOString().slice(0,10)}.csv`;
    a.click();
    toast.success('Export CSV téléchargé — ouvrez avec Excel');
  }, [activeProjet, localTasks, criticalIds, store.ressources]);

  /** Impression / Export PDF via la fenêtre de navigation. */
  const exportPDF = useCallback(() => {
    if (!activeProjet) return;
    toast('Impression en cours…', { icon: '🖨️' });
    window.print();
  }, [activeProjet]);

  /** PLANIFICATION AUTOMATIQUE (type MS Project « auto-scheduled ») :
   *  recalcule les dates de TOUTES les tâches à partir des durées + dépendances
   *  (CPM, jours ouvrés) depuis la date de début du projet. Déplacer/allonger une
   *  tâche décale automatiquement ses successeurs. */
  const autoPlanifier = useCallback(() => {
    if (!activeProjet) return;
    const start = new Date(activeProjet.dateDebut || new Date());
    const { es } = computeCPM(localTasks);
    const leaves = localTasks.filter(t => t.type !== 'summary');
    const newDates = new Map<string, { d: Date; f: Date }>();
    leaves.forEach(t => {
      const off = es.get(t.id) ?? 0;
      const d = addWorkingDays(start, off);
      const dur = Math.max(t.type === 'milestone' ? 0 : 1, Math.round(t.duration || 0));
      const f = t.type === 'milestone' ? new Date(d) : addWorkingDays(d, dur - 1);
      newDates.set(t.id, { d, f });
      store.updateTache(activeProjet.id, t.id, { dateDebut: ymd(d), dateFin: ymd(f) });
    });
    setLocalTasks(prev => prev.map(t => {
      const nd = newDates.get(t.id);
      if (nd) return { ...t, start: nd.d, end: nd.f };
      // récap : englober ses enfants
      if (t.type === 'summary') {
        const kids = prev.filter(k => k.parentId === t.id && newDates.has(k.id)).map(k => newDates.get(k.id)!);
        if (kids.length) return { ...t, start: new Date(Math.min(...kids.map(k => k.d.getTime()))), end: new Date(Math.max(...kids.map(k => k.f.getTime()))) };
      }
      return t;
    }));
    toast.success('Planning recalculé (CPM, jours ouvrés) — dépendances appliquées.');
  }, [activeProjet, localTasks, store]);

  const saveResources = useCallback((taskId: string, assignments: { ressourceId: string; unite: number }[]) => {
    if (!activeProjet) return;
    // Remove old, add new
    const existing = activeProjet.taches.find(t => t.id === taskId)?.assignations ?? [];
    existing.forEach(a => store.removeAssignation(activeProjet.id, taskId, a.id));
    assignments.forEach(a => store.assignRessource(activeProjet.id, taskId, a.ressourceId, a.unite));
    setLocalTasks(prev => prev.map(t => t.id === taskId ? { ...t, resources: assignments.map(a => a.ressourceId) } : t));
    setResourceTaskId(null);
  }, [activeProjet, store]);

  // ── Mark task complete ──
  const markComplete = useCallback(() => {
    if (!selectedId) return;
    updateProgress(selectedId, 100);
  }, [selectedId, updateProgress]);

  // ── Dependency arrows ──
  const arrows = useMemo(() => {
    const result: { x1:number; y1:number; x2:number; y2:number; critical:boolean; type: LinkType }[] = [];
    const idxMap = new Map(searchedVisibleTasks.map((t, i) => [t.id, i]));
    visibleTasks.forEach(task => {
      task.predecessors.forEach(pred => {
        const predTask = localTasks.find(t => t.id === pred.id);
        if (!predTask) return;
        const predIdx = idxMap.get(pred.id);
        const taskIdx = idxMap.get(task.id);
        if (predIdx == null || taskIdx == null) return;
        const predLeft  = dateToPx(predTask.start, ORIGIN, ppd);
        const predW     = Math.max(ppd * 0.5, dateToPx(predTask.end, ORIGIN, ppd) - predLeft);
        const taskLeft  = dateToPx(task.start, ORIGIN, ppd);
        result.push({
          x1: predLeft + predW, y1: predIdx * ROW_H + ROW_H / 2,
          x2: taskLeft - 2,    y2: taskIdx * ROW_H + ROW_H / 2,
          critical: showCritical && criticalIds.has(task.id) && criticalIds.has(pred.id),
          type: pred.type,
        });
      });
    });
    return result;
  }, [visibleTasks, localTasks, ppd, showCritical, criticalIds]);

  // ── Render a single Gantt bar ──
  const renderBar = useCallback((task: GanttTask, rowIndex: number) => {
    const isCrit   = showCritical && criticalIds.has(task.id);
    const barH     = task.type === 'summary' ? 10 : task.type === 'milestone' ? 0 : 16;
    const barTop   = rowIndex * ROW_H + (ROW_H - barH) / 2;
    const barLeft  = dateToPx(task.start, ORIGIN, ppd);
    const barWidth = Math.max(ppd * 0.5, dateToPx(task.end, ORIGIN, ppd) - barLeft);

    if (task.type === 'milestone') {
      const cx = dateToPx(task.start, ORIGIN, ppd);
      const cy = rowIndex * ROW_H + ROW_H / 2;
      const mColor = task.pctComplete === 100 ? '#16A34A' : isCrit ? '#EF4444' : '#7C3AED';
      return (
        <g key={`bar-${task.id}`} style={{ cursor: 'pointer' }} onClick={() => setSelectedId(id => id === task.id ? null : task.id)}>
          <rect x={cx-7} y={cy-7} width={14} height={14} transform={`rotate(45,${cx},${cy})`} fill={mColor} stroke="#fff" strokeWidth={1.5} rx={1} />
          {task.pctComplete === 100 && <text x={cx} y={cy + 4} textAnchor="middle" fontSize={8} fill="#fff" fontWeight={900}>✓</text>}
          <text x={cx + 12} y={cy + 4} fontSize={9} fill={mColor} fontWeight={700}>{task.name.slice(0, 20)}</text>
        </g>
      );
    }

    if (task.type === 'summary') {
      const fillColor  = isCrit ? '#7F1D1D' : NAVY;
      const progressW  = (barWidth || 0) * (task.pctComplete || 0) / 100;
      return (
        <g key={`bar-${task.id}`} style={{ cursor: 'pointer' }} onClick={() => setSelectedId(id => id === task.id ? null : task.id)}>
          <rect x={barLeft} y={barTop} width={barWidth} height={barH} fill={fillColor} rx={2} />
          <rect x={barLeft} y={barTop} width={progressW} height={barH} fill={ORANGE} rx={2} opacity={0.7} />
          <polygon points={`${barLeft},${barTop+barH} ${barLeft+5},${barTop+barH} ${barLeft},${barTop+barH+5}`} fill={fillColor} />
          <polygon points={`${barLeft+barWidth},${barTop+barH} ${barLeft+barWidth-5},${barTop+barH} ${barLeft+barWidth},${barTop+barH+5}`} fill={fillColor} />
          {showBaseline && task.baselineStart && task.baselineEnd && (() => {
            const bL = dateToPx(task.baselineStart!, ORIGIN, ppd);
            const bW = Math.max(4, dateToPx(task.baselineEnd!, ORIGIN, ppd) - bL);
            return <rect x={bL} y={barTop+barH+5} width={bW} height={3} fill="#94A3B8" rx={1} opacity={0.7} />;
          })()}
        </g>
      );
    }

    // Normal task
    const fillColor    = isCrit ? '#EF4444' : task.status === 'termine' ? '#16A34A' : '#3B82F6';
    const progressColor = isCrit ? '#B91C1C' : task.status === 'termine' ? '#15803D' : NAVY;
    const progressW    = (barWidth || 0) * (task.pctComplete || 0) / 100;

    return (
      <g key={`bar-${task.id}`} style={{ cursor: 'pointer' }} onClick={() => setSelectedId(id => id === task.id ? null : task.id)}>
        <rect x={barLeft} y={barTop} width={barWidth} height={barH} fill={fillColor} rx={3} opacity={0.85} />
        <rect x={barLeft} y={barTop} width={progressW} height={barH} fill={progressColor} rx={3} />
        {barWidth > 25 && (
          <text x={barLeft + barWidth + 4} y={barTop + barH/2 + 3.5} fill="#374151" fontSize={8.5} fontWeight={700}>
            {task.pctComplete}%
          </text>
        )}
        {showBaseline && task.baselineStart && task.baselineEnd && (() => {
          const bL = dateToPx(task.baselineStart!, ORIGIN, ppd);
          const bW = Math.max(4, dateToPx(task.baselineEnd!, ORIGIN, ppd) - bL);
          return <rect x={bL} y={barTop+barH+3} width={bW} height={3} fill="#94A3B8" rx={1} opacity={0.7} />;
        })()}
      </g>
    );
  }, [showCritical, showBaseline, ppd, criticalIds]);

  // ── Modals lookup ──
  const editTask     = editTaskId ? localTasks.find(t => t.id === editTaskId) ?? null : null;
  const resourceTask = resourceTaskId ? localTasks.find(t => t.id === resourceTaskId) ?? null : null;
  const progressTask = progressTaskId ? localTasks.find(t => t.id === progressTaskId) ?? null : null;

  const getAssigned = (taskId: string) => {
    const storeTache = activeProjet?.taches.find(t => t.id === taskId);
    return storeTache?.assignations.map(a => ({ ressourceId: a.ressourceId, unite: a.unite })) ?? [];
  };

  /* ════════════════════════════════════════════════════════════════
     RENDER
  ════════════════════════════════════════════════════════════════ */
  return (
    <>
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', background: '#F0F2F5', fontFamily: 'inherit' }}>

      {/* ── PAGE HEADER ── */}
      <div style={{ padding: '10px 16px', background: `linear-gradient(135deg, ${NAVY} 0%, #2D1167 100%)`, display: 'flex', alignItems: 'center', gap: 10, flexShrink: 0 }}>
        <GanttChart size={20} color="#C4B5FD" />
        <span style={{ fontSize: 15, fontWeight: 700, color: '#fff' }}>Planning Gantt</span>

        {/* Project selector */}
        <div style={{ marginLeft: 'auto', display: 'flex', gap: 10, alignItems: 'center' }}>
          <Flag size={12} color="#C4B5FD" />
          <select value={selectedProjetId}
            onChange={e => { setSelectedProjetId(e.target.value); setCollapsedIds(new Set()); setSelectedId(null); }}
            style={{ padding: '4px 8px', background: 'rgba(255,255,255,0.12)', border: '1px solid rgba(255,255,255,0.3)', borderRadius: 4, color: '#fff', fontSize: 11, fontWeight: 600, cursor: 'pointer', outline: 'none' }}>
            <option value="" style={{ color: '#1e293b', background: '#fff' }}>— Sélectionner un projet —</option>
            {store.projets.map(p => (
              <option key={p.id} value={p.id} style={{ color: '#1e293b', background: '#fff' }}>
                {DOMAINE_CFG[p.domaine].emoji} {p.code} — {p.nom.slice(0, 38)}
              </option>
            ))}
          </select>
          {activeProjet && (
            <div style={{ padding: '4px 10px', background: 'rgba(255,255,255,0.1)', borderRadius: 4, fontSize: 11, color: '#C4B5FD', fontWeight: 600 }}>
              Av. réel : {(activeProjet.avancementReel ?? activeProjet.avancement).toFixed(2)}% · CPI {activeProjet.cpi}
            </div>
          )}
        </div>
      </div>

      {/* ── RIBBON TABS ── */}
      <div style={{ background: NAVY, flexShrink: 0 }}>
        <div style={{ display: 'flex', gap: 0, paddingLeft: 8 }}>
          {(['tache', 'vue', 'projet', 'ia'] as RibbonTab[]).map(tab => {
            const isIA = tab === 'ia';
            const hasAlert = isIA && (overloadedResources.length > 0);
            return (
              <button key={tab} onClick={() => setActiveRibbonTab(tab)}
                style={{ padding: '6px 16px', border: 'none', background: activeRibbonTab === tab ? (isIA ? '#7C3AED' : '#fff') : 'transparent', color: activeRibbonTab === tab ? (isIA ? '#fff' : NAVY) : (isIA ? '#C4B5FD' : 'rgba(255,255,255,0.75)'), fontWeight: 700, fontSize: 11, cursor: 'pointer', borderTopLeftRadius: 4, borderTopRightRadius: 4, transition: 'all 0.1s', position: 'relative' }}>
                {tab === 'tache' ? '📝 Tâche' : tab === 'vue' ? '👁 Vue' : tab === 'projet' ? '🗂 Projet' : '🔬 Analyse'}
                {hasAlert && <span style={{ position: 'absolute', top: 3, right: 5, width: 7, height: 7, background: '#F59E0B', borderRadius: '50%', border: '1.5px solid #fff' }} />}
              </button>
            );
          })}
        </div>
      </div>

      {/* ── TOOLBAR RIBBON ── */}
      <div style={{ background: '#fff', borderBottom: `2px solid ${NAVY}`, padding: '5px 10px', display: 'flex', gap: 6, alignItems: 'center', flexShrink: 0, flexWrap: 'wrap' }}>

        {activeRibbonTab === 'tache' && (
          <>
            <button onClick={() => { if (!activeProjet) return; setAddTaskModal(true); }}
              disabled={!activeProjet}
              title={!activeProjet ? 'Sélectionnez un projet d\'abord' : 'Ajouter une nouvelle tâche'}
              style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '5px 10px', background: activeProjet ? NAVY : '#CBD5E1', color: '#fff', border: 'none', borderRadius: 4, fontSize: 11, fontWeight: 600, cursor: activeProjet ? 'pointer' : 'not-allowed', opacity: activeProjet ? 1 : 0.5 }}>
              <Plus size={13} /> Nouvelle tâche
            </button>
            <div style={{ width: 1, height: 22, background: '#E5E7EB' }} />
            <button onClick={() => { if (selectedId) setEditTaskId(selectedId); }} disabled={!selectedId}
              title={selectedId ? 'Modifier la tâche sélectionnée' : 'Sélectionnez une tâche'}
              style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '5px 10px', background: selectedId ? '#F1F5F9' : '#FAFAFA', border: `1px solid ${selectedId ? '#D1D5DB' : '#E5E7EB'}`, borderRadius: 4, fontSize: 11, fontWeight: 600, cursor: selectedId ? 'pointer' : 'not-allowed', color: selectedId ? '#1E293B' : '#9CA3AF', opacity: selectedId ? 1 : 0.5 }}>
              <Edit3 size={12} /> Modifier
            </button>
            <button onClick={() => { if (selectedId) setResourceTaskId(selectedId); }} disabled={!selectedId}
              title={selectedId ? 'Affecter des ressources' : 'Sélectionnez une tâche'}
              style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '5px 10px', background: selectedId ? '#F0FDF4' : '#FAFAFA', border: `1px solid ${selectedId ? '#BBF7D0' : '#E5E7EB'}`, borderRadius: 4, fontSize: 11, fontWeight: 600, cursor: selectedId ? 'pointer' : 'not-allowed', color: selectedId ? '#0F766E' : '#9CA3AF', opacity: selectedId ? 1 : 0.5 }}>
              <Users size={12} /> Ressources
            </button>
            <button onClick={markComplete} disabled={!selectedId}
              title={selectedId ? 'Marquer la tâche comme terminée (100%)' : 'Sélectionnez une tâche'}
              style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '5px 10px', background: selectedId ? '#F0FDF4' : '#FAFAFA', border: `1px solid ${selectedId ? '#BBF7D0' : '#E5E7EB'}`, borderRadius: 4, fontSize: 11, fontWeight: 600, cursor: selectedId ? 'pointer' : 'not-allowed', color: selectedId ? '#16A34A' : '#9CA3AF', opacity: selectedId ? 1 : 0.5 }}>
              <CheckCircle2 size={12} /> Marquer terminée
            </button>
            <div style={{ width: 1, height: 22, background: '#E5E7EB' }} />
            <div style={{ width: 1, height: 22, background: '#E5E7EB' }} />
            <button onClick={indentTask} disabled={!selectedId}
              style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '5px 10px', background: selectedId ? '#F8F9FF' : '#FAFAFA', border: `1px solid ${selectedId ? '#C7D2FE' : '#E5E7EB'}`, borderRadius: 4, fontSize: 11, fontWeight: 600, cursor: selectedId ? 'pointer' : 'not-allowed', color: selectedId ? '#4338CA' : '#9CA3AF', opacity: selectedId ? 1 : 0.5 }}
              title="Indenter (augmenter le niveau WBS)">
              <ChevronRight size={12} /> Indenter
            </button>
            <button onClick={outdentTask} disabled={!selectedId}
              style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '5px 10px', background: selectedId ? '#F8F9FF' : '#FAFAFA', border: `1px solid ${selectedId ? '#C7D2FE' : '#E5E7EB'}`, borderRadius: 4, fontSize: 11, fontWeight: 600, cursor: selectedId ? 'pointer' : 'not-allowed', color: selectedId ? '#4338CA' : '#9CA3AF', opacity: selectedId ? 1 : 0.5 }}
              title="Dé-indenter (diminuer le niveau WBS)">
              <ChevronUp size={12} /> Dé-indenter
            </button>
            <div style={{ width: 1, height: 22, background: '#E5E7EB' }} />
            <button onClick={() => { if (selectedId) { if (confirm('Supprimer cette tâche ?')) deleteTask(selectedId); } }} disabled={!selectedId}
              title={selectedId ? 'Supprimer la tâche sélectionnée' : 'Sélectionnez une tâche'}
              style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '5px 10px', background: selectedId ? '#FEF2F2' : '#FAFAFA', border: `1px solid ${selectedId ? '#FCA5A5' : '#E5E7EB'}`, borderRadius: 4, fontSize: 11, fontWeight: 600, cursor: selectedId ? 'pointer' : 'not-allowed', color: selectedId ? '#EF4444' : '#9CA3AF', opacity: selectedId ? 1 : 0.5 }}>
              <Trash2 size={12} /> Supprimer
            </button>
          </>
        )}

        {activeRibbonTab === 'vue' && (
          <>
            <span style={{ fontSize: 10, fontWeight: 700, color: '#64748B' }}>Zoom :</span>
            {(['semaine', 'mois', 'trimestre', 'annee'] as ZoomLevel[]).map(z => (
              <button key={z} onClick={() => setZoom(z)}
                style={{ padding: '5px 10px', background: zoom === z ? NAVY : '#F1F5F9', color: zoom === z ? '#fff' : '#1E293B', border: `1px solid ${zoom === z ? NAVY : '#E5E7EB'}`, borderRadius: 4, fontSize: 11, fontWeight: 600, cursor: 'pointer' }}>
                {z === 'semaine' ? 'Semaine' : z === 'mois' ? 'Mois' : z === 'trimestre' ? 'Trimestre' : 'Année'}
              </button>
            ))}
            <div style={{ width: 1, height: 22, background: '#E5E7EB' }} />
            <button onClick={() => setShowCritical(v => !v)}
              style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '5px 10px', background: showCritical ? '#FEE2E2' : '#F1F5F9', color: showCritical ? '#EF4444' : '#64748B', border: `1px solid ${showCritical ? '#FCA5A5' : '#E5E7EB'}`, borderRadius: 4, fontSize: 11, fontWeight: 700, cursor: 'pointer' }}>
              <AlertTriangle size={12} /> Chemin critique {showCritical ? '☑' : '☐'}
            </button>
            <button onClick={() => setShowBaseline(v => !v)}
              style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '5px 10px', background: showBaseline ? '#E0F2FE' : '#F1F5F9', color: showBaseline ? '#0369A1' : '#64748B', border: `1px solid ${showBaseline ? '#7DD3FC' : '#E5E7EB'}`, borderRadius: 4, fontSize: 11, fontWeight: 700, cursor: 'pointer' }}>
              <Calendar size={12} /> Baseline {showBaseline ? '☑' : '☐'}
            </button>
            {activeProjet && (
              <button onClick={autoPlanifier} title="Recalcule les dates de toutes les tâches à partir des durées + dépendances (CPM, jours ouvrés)"
                style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '5px 12px', background: '#F47920', color: '#fff', border: 'none', borderRadius: 4, fontSize: 11, fontWeight: 700, cursor: 'pointer' }}>
                <Zap size={12} /> Planifier auto (CPM)
              </button>
            )}
          </>
        )}

        {activeRibbonTab === 'projet' && (
          <>
            {activeProjet && (<>
              <button onClick={() => { setNewBaselineName(''); setNewBaselineDesc(''); setShowBaselineModal(true); }}
                style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '5px 12px', background: NAVY, color: '#fff', border: 'none', borderRadius: 4, fontSize: 11, fontWeight: 700, cursor: 'pointer' }}>
                <Calendar size={13} /> Définir une référence
              </button>
              <button onClick={() => setShowManageBaselines(true)}
                style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '5px 12px', background: '#EDE9FE', color: '#7C3AED', border: '1px solid #DDD6FE', borderRadius: 4, fontSize: 11, fontWeight: 700, cursor: 'pointer' }}>
                <Calendar size={13} /> Gérer les références
                {(activeProjet.baselines?.length ?? 0) > 0 && (
                  <span style={{ background: '#7C3AED', color: '#fff', borderRadius: 10, padding: '0 5px', fontSize: 9, fontWeight: 800 }}>
                    {activeProjet.baselines!.length}
                  </span>
                )}
              </button>
              <div style={{ width: 1, height: 22, background: '#E5E7EB' }} />
            </>)}
            <button onClick={exportPDF}
              style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '5px 12px', background: '#F1F5F9', border: '1px solid #E5E7EB', borderRadius: 4, fontSize: 11, fontWeight: 600, cursor: 'pointer', color: '#1E293B' }}>
              <FileText size={13} /> Imprimer / PDF
            </button>
            <button onClick={exportCSV}
              title="Exporter le planning en CSV compatible Excel"
              style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '5px 12px', background: activeProjet ? '#F0FDF4' : '#FAFAFA', border: `1px solid ${activeProjet ? '#BBF7D0' : '#E5E7EB'}`, borderRadius: 4, fontSize: 11, fontWeight: 600, cursor: activeProjet ? 'pointer' : 'not-allowed', color: activeProjet ? '#15803D' : '#9CA3AF', opacity: activeProjet ? 1 : 0.5 }}>
              <BarChart3 size={13} /> Exporter CSV (Excel)
            </button>
            <div style={{ width: 1, height: 22, background: '#E5E7EB' }} />
            <div style={{ display: 'flex', flex: 1, alignItems: 'center', gap: 6, paddingLeft: 4 }}>
              <Info size={12} style={{ color: '#64748B', flexShrink: 0 }} />
              <span style={{ fontSize: 10, color: '#64748B' }}>
                {activeProjet ? `${localTasks.length} tâches · ${criticalIds.size} critiques · ${visibleTasks.filter(t => t.pctComplete === 100).length} terminées` : 'Sélectionnez un projet'}
              </span>
            </div>
          </>
        )}

        {activeRibbonTab === 'ia' && (
          <>
            <button onClick={() => { if (selectedId) initPertForTask(selectedId); else toast('Sélectionnez une tâche d\'abord', { icon: 'ℹ️' }); }}
              style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '5px 12px', background: '#7C3AED', color: '#fff', border: 'none', borderRadius: 4, fontSize: 11, fontWeight: 700, cursor: 'pointer' }}>
              <TriangleAlert size={12} /> PERT — 3 points
            </button>
            <div style={{ width: 1, height: 22, background: '#E5E7EB' }} />
            {overloadedResources.length > 0 ? (
              <div style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '4px 10px', background: '#FEF3C7', border: '1px solid #FDE68A', borderRadius: 4, fontSize: 11, fontWeight: 700, color: '#92400E' }}>
                <AlertTriangle size={12} /> {overloadedResources.length} ressource(s) surchargée(s) — voir panneau IA ↓
              </div>
            ) : (
              <div style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '4px 10px', background: '#DCFCE7', border: '1px solid #BBF7D0', borderRadius: 4, fontSize: 11, fontWeight: 700, color: '#15803D' }}>
                <CheckCircle2 size={12} /> Ressources équilibrées
              </div>
            )}
            <div style={{ width: 1, height: 22, background: '#E5E7EB' }} />
            {aiAnalysis && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '4px 10px', borderRadius: 4, fontSize: 11, fontWeight: 700, color: aiAnalysis.color, background: aiAnalysis.color + '14', border: `1px solid ${aiAnalysis.color}33` }}>
                {aiAnalysis.verdict}
              </div>
            )}
          </>
        )}

        {/* Right stats */}
        <div style={{ marginLeft: 'auto', display: 'flex', gap: 8, alignItems: 'center' }}>
          {showCritical && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '3px 7px', background: '#FEE2E2', borderRadius: 4 }}>
              <AlertTriangle size={10} color="#EF4444" />
              <span style={{ fontSize: 10, color: '#EF4444', fontWeight: 700 }}>{criticalIds.size} tâche(s) critiques</span>
            </div>
          )}
          <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
            <Circle size={10} color="#64748B" />
            <span style={{ fontSize: 10, color: '#64748B', fontWeight: 600 }}>{searchedVisibleTasks.length}/{localTasks.length} tâches{taskSearch ? ` · filtrées` : ''}</span>
          </div>
          {selectedId && (
            <div style={{ padding: '3px 7px', background: `${NAVY}12`, borderRadius: 4, fontSize: 10, fontWeight: 600, color: NAVY }}>
              ✓ {localTasks.find(t => t.id === selectedId)?.name.slice(0, 20)}
            </div>
          )}
        </div>
      </div>

      {/* ── CONTENT AREA — GANTT VIEW ── */}
      <div style={{ display: 'flex', flex: 1, overflow: 'hidden', flexDirection: 'column', minHeight: 0 }}>
        <div style={{ display: 'flex', flex: 1, overflow: 'hidden', background: '#fff' }}>

          {/* ── LEFT TABLE ── */}
          <div style={{ width: TABLE_W, display: 'flex', flexDirection: 'column', borderRight: '2px solid #E5E7EB', flexShrink: 0 }}>
            {/* Search bar above task list */}
            <div style={{ padding: '4px 6px', borderBottom: '1px solid #F1F5F9', background: '#FAFBFC', display: 'flex', alignItems: 'center', gap: 4 }}>
              <Search size={11} style={{ color: '#94A3B8', flexShrink: 0 }} />
              <input
                value={taskSearch}
                onChange={e => setTaskSearch(e.target.value)}
                placeholder="Chercher une tâche…"
                style={{ flex: 1, border: 'none', background: 'transparent', fontSize: 10.5, color: '#334155', outline: 'none', minWidth: 0 }}
              />
              {taskSearch && (
                <button onClick={() => setTaskSearch('')} aria-label="Effacer la recherche" style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#94A3B8', padding: 0, flexShrink: 0 }}>
                  <X size={10} />
                </button>
              )}
            </div>
            {/* Table Header */}
            <div style={{ height: HEADER_H, background: '#F8FAFC', borderBottom: '2px solid #E5E7EB', display: 'flex', alignItems: 'center', flexShrink: 0 }}>
              <div style={{ width: 50, paddingLeft: 8, fontSize: 9, fontWeight: 700, color: '#1E293B', flexShrink: 0 }}>N°</div>
              <div style={{ width: 170, fontSize: 9, fontWeight: 700, color: '#1E293B', flexShrink: 0 }}>Nom tâche</div>
              <div style={{ width: 38, textAlign: 'center', fontSize: 9, fontWeight: 700, color: '#1E293B', flexShrink: 0 }}>Dur.</div>
              <div style={{ width: 62, textAlign: 'center', fontSize: 9, fontWeight: 700, color: '#1E293B', flexShrink: 0 }}>Début</div>
              <div style={{ width: 62, textAlign: 'center', fontSize: 9, fontWeight: 700, color: '#1E293B', flexShrink: 0 }}>Fin</div>
              <div style={{ width: 44, textAlign: 'center', fontSize: 9, fontWeight: 700, color: '#1E293B', flexShrink: 0 }}>Av.%</div>
              <div style={{ flex: 1, textAlign: 'center', fontSize: 9, fontWeight: 700, color: '#1E293B' }}>Ressources</div>
            </div>
            {/* Table Body */}
            <div ref={tableBodyRef} style={{ flex: 1, overflowY: 'auto', overflowX: 'hidden' }} onScroll={onTableScroll}>
              {localTasks.length === 0 ? (
                <div style={{ padding: 24, textAlign: 'center', color: '#9CA3AF', fontSize: 13 }}>
                  <GanttChart size={32} color="#E5E7EB" style={{ display: 'block', margin: '0 auto 8px' }} />
                  Sélectionner un projet pour afficher le planning
                </div>
              ) : searchedVisibleTasks.map((task, rowIdx) => {
                const isSelected  = task.id === selectedId;
                const isSummary   = task.type === 'summary';
                const isMilestone = task.type === 'milestone';
                const isCrit      = showCritical && criticalIds.has(task.id);
                const isCollapsed = collapsedIds.has(task.id);
                const hasChildren = localTasks.some(t => t.parentId === task.id);
                const rowBg = isSelected ? `${NAVY}12` : isCrit && isSummary ? '#FFF1F2' : isSummary ? '#F8FAFC' : '#fff';
                const nameColor = isCrit ? '#EF4444' : isSummary ? NAVY : '#334155';
                const pctColor  = task.pctComplete === 100 ? '#16A34A' : task.pctComplete > 50 ? '#F59E0B' : task.pctComplete > 0 ? '#3B82F6' : '#94A3B8';
                const resNames  = task.resources.map(rid => {
                  const r = store.ressources.find(x => x.id === rid);
                  return r ? `${r.prenom.slice(0,1)}.${r.nom}` : rid;
                }).join(', ');

                return (
                  <div key={task.id}
                    onClick={() => setSelectedId(id => id === task.id ? null : task.id)}
                    onDoubleClick={() => setEditTaskId(task.id)}
                    style={{ height: ROW_H, display: 'flex', alignItems: 'center', borderBottom: '1px solid #F1F5F9', background: rowBg, cursor: 'pointer', transition: 'background 0.1s', userSelect: 'none' }}>
                    {/* WBS */}
                    <div style={{ width: 50, display: 'flex', alignItems: 'center', gap: 2, paddingLeft: 4, flexShrink: 0 }}>
                      {hasChildren && (
                        <span onClick={e => { e.stopPropagation(); toggleCollapse(task.id); }}
                          style={{ color: NAVY, cursor: 'pointer', display: 'flex', alignItems: 'center' }}>
                          {isCollapsed ? <ChevronRight size={11} /> : <ChevronDown size={11} />}
                        </span>
                      )}
                      {isMilestone && <span style={{ fontSize: 9, color: '#7C3AED' }}>◆</span>}
                      <span style={{ fontSize: 9, fontWeight: isSummary ? 700 : 500, color: isCrit ? '#EF4444' : '#64748B', marginLeft: !hasChildren && !isMilestone ? 12 : 0 }}>
                        {task.wbs}
                      </span>
                    </div>
                    {/* Name */}
                    <div style={{ width: 170, paddingLeft: task.level * 10 + 2, overflow: 'hidden', flexShrink: 0 }}>
                      <span style={{ fontSize: 10, fontWeight: isSummary ? 700 : 400, color: nameColor, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', display: 'block' }} title={task.name}>
                        {task.name}
                      </span>
                    </div>
                    {/* Duration */}
                    <div style={{ width: 38, textAlign: 'center', fontSize: 9, color: '#64748B', flexShrink: 0 }}>
                      {task.duration > 0 ? `${task.duration}j` : '◆'}
                    </div>
                    {/* Start */}
                    <div style={{ width: 62, textAlign: 'center', fontSize: 8.5, color: '#64748B', flexShrink: 0 }}>
                      {fmtDate(task.start)}
                    </div>
                    {/* End */}
                    <div style={{ width: 62, textAlign: 'center', fontSize: 8.5, color: '#64748B', flexShrink: 0 }}>
                      {fmtDate(task.end)}
                    </div>
                    {/* Progress — click to open inline popup */}
                    <div style={{ width: 44, textAlign: 'center', flexShrink: 0 }}
                      onClick={e => { e.stopPropagation(); const rect = (e.currentTarget as HTMLElement).getBoundingClientRect(); setProgressTaskId(task.id); setProgressTop(rect.top - 10); }}>
                      <span style={{ fontSize: 9.5, fontWeight: 700, color: pctColor, cursor: 'pointer', textDecoration: 'underline dotted' }}>{task.pctComplete}%</span>
                    </div>
                    {/* Resources */}
                    <div style={{ flex: 1, overflow: 'hidden', paddingLeft: 4 }}>
                      <span style={{ fontSize: 8.5, color: '#94A3B8', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', display: 'block' }} title={resNames}>
                        {resNames || '—'}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* ── RIGHT GANTT TIMELINE ── */}
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', minWidth: 0 }}>
            {/* Timeline Header */}
            <div ref={headerScrollRef} style={{ height: HEADER_H, background: '#F8FAFC', borderBottom: '2px solid #E5E7EB', flexShrink: 0, overflowX: 'hidden' }}>
              <div style={{ width: totalTimeline, position: 'relative', height: '100%' }}>
                <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 22, display: 'flex', borderBottom: '1px solid #E5E7EB' }}>
                  {yearGroups.map(yg => (
                    <div key={yg.year} style={{ position: 'absolute', left: yg.left, width: yg.width, height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', borderRight: '2px solid #CBD5E1' }}>
                      <span style={{ fontSize: 11, fontWeight: 800, color: NAVY }}>{yg.year}</span>
                    </div>
                  ))}
                </div>
                <div style={{ position: 'absolute', top: 22, left: 0, right: 0, height: 26 }}>
                  {monthCols.map((col, i) => (
                    <div key={i} style={{ position: 'absolute', left: col.left, width: col.width, height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', borderRight: '1px solid #E5E7EB', overflow: 'hidden' }}>
                      <span style={{ fontSize: 9, fontWeight: 600, color: '#64748B', whiteSpace: 'nowrap' }}>{col.label}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Gantt Body */}
            <div ref={ganttBodyRef} style={{ flex: 1, overflowY: 'auto', overflowX: 'auto', position: 'relative' }} onScroll={onGanttScroll}>
              <div style={{ width: totalTimeline, position: 'relative', minHeight: Math.max(visibleTasks.length * ROW_H, 200) }}>
                {/* Grid lines */}
                {monthCols.map((col, i) => (
                  <div key={i} style={{ position: 'absolute', top: 0, bottom: 0, left: col.left, width: 1, background: i % 3 === 0 ? '#CBD5E1' : '#F1F5F9', pointerEvents: 'none' }} />
                ))}
                {/* Row backgrounds */}
                {searchedVisibleTasks.map((task, ri) => (
                  <div key={`rbg-${task.id}`}
                    style={{ position: 'absolute', top: ri * ROW_H, left: 0, right: 0, height: ROW_H, background: task.id === selectedId ? `${NAVY}10` : task.type === 'summary' ? '#F8FAFC' : ri % 2 === 0 ? '#fff' : '#FAFBFC', borderBottom: '1px solid #F1F5F9', cursor: 'pointer' }}
                    onClick={() => setSelectedId(id => id === task.id ? null : task.id)} />
                ))}
                {/* Today line */}
                <div style={{ position: 'absolute', top: 0, bottom: 0, left: todayPx, width: 2, background: '#EF4444', opacity: 0.8, zIndex: 10, pointerEvents: 'none', borderLeft: '2px dashed #EF4444' }}>
                  <div style={{ position: 'absolute', top: 2, left: -18, background: '#EF4444', color: '#fff', fontSize: 7.5, padding: '1px 4px', borderRadius: 3, fontWeight: 700, whiteSpace: 'nowrap' }}>Auj.</div>
                </div>
                {/* SVG bars + arrows */}
                <svg style={{ position: 'absolute', top: 0, left: 0, width: totalTimeline, height: Math.max(visibleTasks.length * ROW_H, 200), pointerEvents: 'none', overflow: 'visible' }}>
                  <defs>
                    <marker id="arrGrey"  markerWidth="6" markerHeight="6" refX="5" refY="3" orient="auto"><polygon points="0,0 0,6 6,3" fill="#94A3B8" /></marker>
                    <marker id="arrRed"   markerWidth="6" markerHeight="6" refX="5" refY="3" orient="auto"><polygon points="0,0 0,6 6,3" fill="#EF4444" /></marker>
                    <marker id="arrNavy"  markerWidth="6" markerHeight="6" refX="5" refY="3" orient="auto"><polygon points="0,0 0,6 6,3" fill={NAVY} /></marker>
                  </defs>
                  {/* Bars */}
                  {searchedVisibleTasks.map((t, ri) => renderBar(t, ri))}
                  {/* Dependency arrows */}
                  {arrows.map(({ x1, y1, x2, y2, critical, type }, idx) => {
                    const color  = critical ? '#EF4444' : '#94A3B8';
                    const marker = critical ? 'arrRed' : 'arrGrey';
                    const xm = x1 + 10;
                    const d  = `M${x1},${y1} L${xm},${y1} L${xm},${y2} L${x2},${y2}`;
                    return (
                      <g key={idx}>
                        <path d={d} stroke={color} strokeWidth={critical ? 1.8 : 1.2} fill="none" markerEnd={`url(#${marker})`} opacity={0.75} />
                        {Math.abs(y2 - y1) > 8 && (
                          <text x={(x1 + x2) / 2 + 5} y={(y1 + y2) / 2} fontSize={7} fill={color} fontWeight={700}>{type}</text>
                        )}
                      </g>
                    );
                  })}
                </svg>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ═══════════ MODALS ═══════════ */}

      {addTaskModal && activeProjet && (
        <TaskModal mode="add" allTasks={localTasks} projetId={activeProjet.id}
          onSave={addTask} onClose={() => setAddTaskModal(false)} />
      )}

      {editTaskId && editTask && activeProjet && (
        <TaskModal mode="edit" task={editTask} allTasks={localTasks} projetId={activeProjet.id}
          onSave={saveTaskEdit}
          onClose={() => setEditTaskId(null)}
          onDelete={() => { deleteTask(editTask.id); }} />
      )}

      {resourceTaskId && resourceTask && (
        <ResourceModal
          task={resourceTask}
          ressources={store.ressources}
          assigned={getAssigned(resourceTaskId)}
          onSave={assignments => saveResources(resourceTaskId, assignments)}
          onClose={() => setResourceTaskId(null)} />
      )}

      {progressTaskId && progressTask && (
        <ProgressPopup task={progressTask} top={progressTop}
          onSave={pct => updateProgress(progressTaskId, pct)}
          onClose={() => setProgressTaskId(null)} />
      )}

      {/* ═══════ ANALYSE PANEL — shown when Analyse tab is active ══════ */}
      {activeRibbonTab === 'ia' && (
        <div style={{ flexShrink: 0, background: '#F8F7FF', borderTop: '2px solid #7C3AED', maxHeight: 280, overflowY: 'auto', padding: '14px 16px', display: 'flex', gap: 14, flexWrap: 'wrap' }}>

          {/* AI Summary */}
          {aiAnalysis && (
            <div style={{ minWidth: 220, flex: '1 1 220px', background: '#fff', border: `1px solid ${aiAnalysis.color}33`, borderRadius: 10, padding: '12px 14px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
                <Bot size={16} style={{ color: '#7C3AED' }} />
                <span style={{ fontSize: 12, fontWeight: 700, color: '#1E293B' }}>Analyse du planning</span>
              </div>
              <div style={{ fontSize: 13, fontWeight: 700, color: aiAnalysis.color, marginBottom: 8 }}>{aiAnalysis.verdict}</div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '4px 12px', fontSize: 11, color: '#475569' }}>
                <span>Tâches totales:</span><span style={{ fontWeight: 700, color: '#1E293B' }}>{aiAnalysis.totalTasks}</span>
                <span>Terminées:</span><span style={{ fontWeight: 700, color: '#15803D' }}>{aiAnalysis.doneCount}</span>
                <span>En retard:</span><span style={{ fontWeight: 700, color: aiAnalysis.lateCount > 0 ? '#DC2626' : '#15803D' }}>{aiAnalysis.lateCount}</span>
                <span>Avancement moyen:</span><span style={{ fontWeight: 700, color: '#1E293B' }}>{aiAnalysis.avgPct}%</span>
                <span>Tâches critiques:</span><span style={{ fontWeight: 700, color: aiAnalysis.critCount > 0 ? '#EF4444' : '#15803D' }}>{aiAnalysis.critCount}</span>
                <span>Avancement critique:</span><span style={{ fontWeight: 700, color: '#7C3AED' }}>{aiAnalysis.critAvg}%</span>
              </div>
              {aiAnalysis.lastCritDate && (
                <div style={{ marginTop: 8, fontSize: 11, color: '#64748B', background: '#F1F5F9', borderRadius: 6, padding: '5px 8px' }}>
                  📅 Fin chemin critique estimée : <strong>{fmtDate(aiAnalysis.lastCritDate)}</strong>
                </div>
              )}
              {aiAnalysis.lateCount > 0 && (
                <div style={{ marginTop: 6, fontSize: 11, color: '#92400E', background: '#FEF3C7', borderRadius: 6, padding: '5px 8px' }}>
                  ⚠️ {aiAnalysis.lateCount} tâche(s) dépassée(s) — revoyez les jalons & dépendances.
                </div>
              )}
            </div>
          )}

          {/* Resource Leveling */}
          <div style={{ minWidth: 240, flex: '1 1 240px', background: '#fff', border: '1px solid #E2E8F0', borderRadius: 10, padding: '12px 14px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
              <Shuffle size={16} style={{ color: '#0E7490' }} />
              <span style={{ fontSize: 12, fontWeight: 700, color: '#1E293B' }}>Nivellement des ressources</span>
              {overloadedResources.length > 0 && (
                <span style={{ marginLeft: 'auto', padding: '2px 7px', background: '#FEF3C7', color: '#92400E', borderRadius: 20, fontSize: 10, fontWeight: 700 }}>
                  {overloadedResources.length} surcharge(s)
                </span>
              )}
            </div>
            {resourceLoads.length === 0 ? (
              <div style={{ fontSize: 12, color: '#94A3B8', textAlign: 'center', paddingTop: 12 }}>
                Assignez des ressources aux tâches pour activer le nivellement.
              </div>
            ) : (
              <div style={{ display: 'grid', gap: 6 }}>
                {resourceLoads.slice(0, 6).map(rl => {
                  const pct = Math.min(200, rl.maxLoad);
                  const color = rl.overloaded ? '#DC2626' : rl.maxLoad > 80 ? '#D97706' : '#15803D';
                  return (
                    <div key={rl.ressourceId}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, marginBottom: 2 }}>
                        <span style={{ color: '#334155', fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: 130 }}>{rl.nom}</span>
                        <span style={{ fontWeight: 700, color, flexShrink: 0, marginLeft: 6 }}>
                          {rl.maxLoad}% {rl.overloaded ? '⚠' : ''}
                        </span>
                      </div>
                      <div style={{ height: 7, background: '#F1F5F9', borderRadius: 99, overflow: 'hidden' }}>
                        <div style={{ width: `${Math.min(100, pct / 2)}%`, height: '100%', background: color, borderRadius: 99, transition: 'width .3s' }} />
                      </div>
                      {rl.overloaded && (
                        <div style={{ fontSize: 10, color: '#DC2626', marginTop: 2 }}>
                          {rl.tasks.length} tâches simultanées — déplacer les non-critiques
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* PERT — 3-point for critical tasks */}
          <div style={{ minWidth: 280, flex: '1 1 280px', background: '#fff', border: '1px solid #E2E8F0', borderRadius: 10, padding: '12px 14px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
              <TriangleAlert size={16} style={{ color: '#7C3AED' }} />
              <span style={{ fontSize: 12, fontWeight: 700, color: '#1E293B' }}>Estimation PERT — chemin critique</span>
            </div>
            {criticalIds.size === 0 ? (
              <div style={{ fontSize: 12, color: '#94A3B8', textAlign: 'center', paddingTop: 12 }}>
                Sélectionnez un projet avec des dépendances pour activer PERT.
              </div>
            ) : (
              <div style={{ display: 'grid', gap: 6, maxHeight: 180, overflowY: 'auto' }}>
                {localTasks.filter(t => criticalIds.has(t.id) && t.type === 'normal').slice(0, 5).map(task => {
                  const e = getPertEstimate(task.id) ?? { taskId: task.id, O: Math.max(1, task.duration - 2), M: task.duration, P: task.duration + 5 };
                  const pert = pertDuration(e);
                  const sigma = pertSigma(e);
                  return (
                    <div key={task.id} style={{ background: '#FDF4FF', border: '1px solid #E9D5FF', borderRadius: 8, padding: '7px 10px', fontSize: 11 }}>
                      <div style={{ fontWeight: 700, color: '#7C3AED', marginBottom: 5, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{task.name}</div>
                      <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
                        {(['O', 'M', 'P'] as const).map(f => (
                          <label key={f} style={{ display: 'flex', alignItems: 'center', gap: 3, fontSize: 10, color: f === 'O' ? '#15803D' : f === 'M' ? '#1D4ED8' : '#DC2626' }}>
                            {f === 'O' ? 'Opt.' : f === 'M' ? 'Prob.' : 'Pess.'}
                            <input type="number" min={1} max={999}
                              value={e[f]}
                              onChange={ev => setPert(task.id, f, Math.max(1, parseInt(ev.target.value) || 1))}
                              style={{ width: 42, padding: '2px 4px', border: '1px solid #D1D5DB', borderRadius: 4, fontSize: 10, fontWeight: 700 }} />j
                          </label>
                        ))}
                        <span style={{ marginLeft: 'auto', fontWeight: 800, color: '#7C3AED', fontSize: 12 }}>= {pert}j</span>
                        <span style={{ fontSize: 10, color: '#64748B' }}>σ={sigma}j</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

        </div>
      )}

    </div>

    {/* ══ MODAL : Définir une référence ══ */}
    {showBaselineModal && activeProjet && (
      <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)', zIndex: 3000, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ background: '#fff', borderRadius: 12, padding: 24, width: 420, boxShadow: '0 20px 60px rgba(0,0,0,0.25)' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 18 }}>
            <div style={{ fontWeight: 800, fontSize: 15, color: NAVY }}>Définir une référence</div>
            <button onClick={() => setShowBaselineModal(false)} style={{ border: 'none', background: 'none', cursor: 'pointer', fontSize: 18, color: '#9CA3AF' }}>×</button>
          </div>
          <div style={{ marginBottom: 14 }}>
            <label style={{ fontSize: 11, fontWeight: 700, color: '#374151', display: 'block', marginBottom: 4 }}>* Nom</label>
            <input value={newBaselineName} onChange={e => setNewBaselineName(e.target.value)}
              placeholder={`Référence ${activeProjet.nom.split(' ').slice(0,3).join(' ')}`}
              style={{ width: '100%', padding: '7px 10px', border: '1px solid #D1D5DB', borderRadius: 7, fontSize: 12, boxSizing: 'border-box' }} />
          </div>
          <div style={{ marginBottom: 20 }}>
            <label style={{ fontSize: 11, fontWeight: 700, color: '#374151', display: 'block', marginBottom: 4 }}>Description</label>
            <input value={newBaselineDesc} onChange={e => setNewBaselineDesc(e.target.value)}
              placeholder="Description optionnelle..."
              style={{ width: '100%', padding: '7px 10px', border: '1px solid #D1D5DB', borderRadius: 7, fontSize: 12, boxSizing: 'border-box' }} />
          </div>
          <div style={{ background: '#F0F9FF', border: '1px solid #BAE6FD', borderRadius: 8, padding: '10px 12px', marginBottom: 18, fontSize: 11, color: '#0369A1' }}>
            <strong>Tâches incluses :</strong> {activeProjet.taches.length} tâches · {localTasks.filter(t => t.type === 'milestone').length} jalons · Avancement moyen {Math.round(localTasks.reduce((s, t) => s + t.pctComplete, 0) / (localTasks.length || 1))}%
          </div>
          <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
            <button onClick={() => setShowBaselineModal(false)}
              style={{ padding: '8px 18px', border: '1px solid #D1D5DB', background: '#fff', borderRadius: 7, fontSize: 12, cursor: 'pointer' }}>
              Annuler
            </button>
            <button onClick={() => {
              const nom = newBaselineName.trim() || `Référence ${new Date().toLocaleDateString('fr-FR')}`;
              store.createBaseline(activeProjet.id, nom, newBaselineDesc.trim() || undefined);
              toast.success(`Référence "${nom}" créée`);
              setShowBaselineModal(false);
            }}
              style={{ padding: '8px 18px', background: NAVY, color: '#fff', border: 'none', borderRadius: 7, fontSize: 12, fontWeight: 700, cursor: 'pointer' }}>
              Enregistrer et fermer
            </button>
          </div>
        </div>
      </div>
    )}

    {/* ══ MODAL : Gérer les références ══ */}
    {showManageBaselines && activeProjet && (
      <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)', zIndex: 3000, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ background: '#fff', borderRadius: 12, padding: 24, width: 640, maxHeight: '80vh', overflow: 'hidden', display: 'flex', flexDirection: 'column', boxShadow: '0 20px 60px rgba(0,0,0,0.25)' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 18 }}>
            <div style={{ fontWeight: 800, fontSize: 15, color: NAVY }}>Gérer les références — {activeProjet.nom}</div>
            <button onClick={() => setShowManageBaselines(false)} style={{ border: 'none', background: 'none', cursor: 'pointer', fontSize: 18, color: '#9CA3AF' }}>×</button>
          </div>
          {(activeProjet.baselines?.length ?? 0) === 0 ? (
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', color: '#9CA3AF', gap: 8, padding: 24 }}>
              <Calendar size={32} />
              <p style={{ fontSize: 13, textAlign: 'center' }}>Aucune référence définie. Cliquez sur "Nouvelle référence" pour en créer une.</p>
            </div>
          ) : (
            <div style={{ flex: 1, overflowY: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
                <thead>
                  <tr style={{ background: '#F8FAFC' }}>
                    <th style={{ padding: '8px 10px', textAlign: 'left', color: '#64748B', fontWeight: 700, borderBottom: '1px solid #E2E8F0' }}>Principale</th>
                    <th style={{ padding: '8px 10px', textAlign: 'left', color: '#64748B', fontWeight: 700, borderBottom: '1px solid #E2E8F0' }}>Nom</th>
                    <th style={{ padding: '8px 10px', textAlign: 'left', color: '#64748B', fontWeight: 700, borderBottom: '1px solid #E2E8F0' }}>Description</th>
                    <th style={{ padding: '8px 10px', textAlign: 'left', color: '#64748B', fontWeight: 700, borderBottom: '1px solid #E2E8F0' }}>Date création</th>
                    <th style={{ padding: '8px 10px', textAlign: 'center', color: '#64748B', fontWeight: 700, borderBottom: '1px solid #E2E8F0' }}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {activeProjet.baselines!.map(bl => (
                    <tr key={bl.id} style={{ background: bl.isPrincipal ? '#F0F9FF' : '#fff', borderBottom: '1px solid #F1F5F9' }}>
                      <td style={{ padding: '8px 10px', textAlign: 'center' }}>
                        {bl.isPrincipal ? (
                          <span style={{ background: '#0284C7', color: '#fff', borderRadius: 10, padding: '2px 8px', fontSize: 9, fontWeight: 800 }}>✓ PRINCIPALE</span>
                        ) : (
                          <button onClick={() => { store.setBaselinePrincipal(activeProjet.id, bl.id); toast.success('Référence principale mise à jour'); }}
                            style={{ padding: '3px 10px', border: '1px solid #0284C7', color: '#0284C7', background: '#fff', borderRadius: 6, fontSize: 10, cursor: 'pointer' }}>
                            Définir principale
                          </button>
                        )}
                      </td>
                      <td style={{ padding: '8px 10px', fontWeight: 700, color: NAVY }}>{bl.nom}</td>
                      <td style={{ padding: '8px 10px', color: '#64748B' }}>{bl.description || '—'}</td>
                      <td style={{ padding: '8px 10px', color: '#64748B' }}>{new Date(bl.dateCreation).toLocaleDateString('fr-FR')}</td>
                      <td style={{ padding: '8px 10px', textAlign: 'center' }}>
                        {!bl.isPrincipal && (
                          <button onClick={() => { if (confirm('Supprimer cette référence ?')) { store.deleteBaseline(activeProjet.id, bl.id); toast.success('Référence supprimée'); } }}
                            style={{ padding: '3px 10px', border: '1px solid #FCA5A5', color: '#EF4444', background: '#FEF2F2', borderRadius: 6, fontSize: 10, cursor: 'pointer' }}>
                            Supprimer
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 16, gap: 10 }}>
            <button onClick={() => { setShowManageBaselines(false); setNewBaselineName(''); setNewBaselineDesc(''); setShowBaselineModal(true); }}
              style={{ padding: '8px 18px', background: NAVY, color: '#fff', border: 'none', borderRadius: 7, fontSize: 12, fontWeight: 700, cursor: 'pointer' }}>
              + Nouvelle référence
            </button>
            <button onClick={() => setShowManageBaselines(false)}
              style={{ padding: '8px 18px', border: '1px solid #D1D5DB', background: '#fff', borderRadius: 7, fontSize: 12, cursor: 'pointer' }}>
              Fermer
            </button>
          </div>
        </div>
      </div>
    )}

    </>
  );
}

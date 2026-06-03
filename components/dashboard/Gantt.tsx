'use client';

import { useState, useRef, useMemo, useCallback, useEffect } from 'react';
import {
  Plus, ChevronRight, ChevronDown, X, Flag, AlertTriangle,
  Users, BarChart3, FileText, Download, Calendar, GanttChart,
  Wrench, Trash2, Edit3,
  CheckCircle2, Circle, Clock, ChevronUp,
} from 'lucide-react';
import {
  useProjectStore, DOMAINE_CFG,
  type TacheWBS, type Projet, type Ressource,
} from '@/lib/projectStore';
import { useAuth, isOperationalReadOnly } from '@/lib/authStore';
import { readOnlyGuard } from '@/lib/operationalGuard';

/* ══════════════════════════════════════════════════════════════════════════════
   TYPES GANTT
══════════════════════════════════════════════════════════════════════════════ */
type ZoomLevel   = 'semaine' | 'mois' | 'trimestre' | 'annee';
type TaskType    = 'normal' | 'summary' | 'milestone';
type LinkType    = 'FS' | 'SS' | 'FF' | 'SF';
type TaskStatus  = 'non_demarre' | 'en_cours' | 'termine' | 'en_retard';

interface Predecessor { id: string; type: LinkType; lag: number; }
interface GanttTask {
  id: string; wbs: string; name: string; type: TaskType;
  level: number; parentId?: string; duration: number;
  start: Date; end: Date; pctComplete: number;
  predecessors: Predecessor[]; resources: string[];
  isCritical: boolean; status: TaskStatus;
  baselineStart?: Date; baselineEnd?: Date;
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

/** Simple critical path via longest path (no resource leveling) */
function computeCriticalIds(tasks: GanttTask[]): Set<string> {
  if (tasks.length === 0) return new Set();
  const idToTask = new Map(tasks.map(t => [t.id, t]));
  // forward pass — earliest finish
  const EF = new Map<string, number>();
  const getEF = (id: string): number => {
    if (EF.has(id)) return EF.get(id)!;
    const t = idToTask.get(id);
    if (!t) return 0;
    const predEF = t.predecessors
      .filter(p => p.type === 'FS')
      .reduce((max, p) => Math.max(max, getEF(p.id) + p.lag), 0);
    const ef = predEF + t.duration;
    EF.set(id, ef);
    return ef;
  };
  tasks.forEach(t => getEF(t.id));
  const projectEnd = Math.max(...Array.from(EF.values()));
  const critical = new Set<string>();
  tasks.forEach(t => {
    if ((EF.get(t.id) ?? 0) === projectEnd) critical.add(t.id);
  });
  return critical;
}

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
interface TaskFormData {
  name: string; duration: string; dateDebut: string; dateFin: string;
  pctComplete: string; type: TaskType;
  predId: string; predType: LinkType; predLag: string;
}
const EMPTY_FORM: TaskFormData = {
  name: '', duration: '10', dateDebut: '', dateFin: '',
  pctComplete: '0', type: 'normal', predId: '', predType: 'FS', predLag: '0',
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
  const [form, setForm] = useState<TaskFormData>(() => {
    if (mode === 'edit' && task) {
      return {
        name: task.name, duration: String(task.duration),
        dateDebut: fmtDateInput(task.start), dateFin: fmtDateInput(task.end),
        pctComplete: String(task.pctComplete), type: task.type,
        predId: task.predecessors[0]?.id ?? '', predType: task.predecessors[0]?.type ?? 'FS',
        predLag: String(task.predecessors[0]?.lag ?? 0),
      };
    }
    return { ...EMPTY_FORM, dateDebut: fmtDateInput(new Date()), dateFin: fmtDateInput(addDays(new Date(), 10)) };
  });

  const update = (k: keyof TaskFormData, v: string) => setForm(p => ({ ...p, [k]: v }));

  const inp: React.CSSProperties = {
    width: '100%', boxSizing: 'border-box', border: '1px solid #D1D5DB',
    borderRadius: 5, padding: '6px 8px', fontSize: 12, outline: 'none',
  };
  const lbl: React.CSSProperties = { fontSize: 10, fontWeight: 700, color: '#374151', marginBottom: 3, display: 'block' };

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)', zIndex: 9000, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
      onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div style={{ background: '#fff', borderRadius: 8, width: 460, boxShadow: '0 20px 60px rgba(0,0,0,0.22)', overflow: 'hidden' }}>
        {/* Header */}
        <div style={{ background: NAVY, padding: '12px 16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span style={{ fontSize: 13, fontWeight: 700, color: '#fff', display: 'flex', alignItems: 'center', gap: 8 }}>
            {mode === 'add' ? <Plus size={15} /> : <Edit3 size={15} />}
            {mode === 'add' ? 'Nouvelle tâche' : 'Modifier la tâche'}
          </span>
          <button onClick={onClose} style={{ background: 'rgba(255,255,255,0.15)', border: 'none', color: '#fff', borderRadius: 4, padding: '3px 8px', cursor: 'pointer' }}><X size={14} /></button>
        </div>
        <div style={{ padding: 16, display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div><label style={lbl}>Nom de la tâche *</label><input style={inp} value={form.name} onChange={e => update('name', e.target.value)} placeholder="Ex: Études topographiques" /></div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
            <div><label style={lbl}>Type</label>
              <select style={inp} value={form.type} onChange={e => update('type', e.target.value as TaskType)}>
                <option value="normal">Normale</option>
                <option value="summary">Récapitulative</option>
                <option value="milestone">Jalon</option>
              </select>
            </div>
            <div><label style={lbl}>Durée (jours)</label><input type="number" min={0} style={inp} value={form.duration} onChange={e => update('duration', e.target.value)} /></div>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
            <div><label style={lbl}>Date début</label><input type="date" style={inp} value={form.dateDebut} onChange={e => update('dateDebut', e.target.value)} /></div>
            <div><label style={lbl}>Date fin</label><input type="date" style={inp} value={form.dateFin} onChange={e => update('dateFin', e.target.value)} /></div>
          </div>
          <div>
            <label style={lbl}>Avancement : {form.pctComplete}%</label>
            <input type="range" min={0} max={100} step={5} value={form.pctComplete}
              onChange={e => update('pctComplete', e.target.value)}
              style={{ width: '100%', accentColor: NAVY }} />
          </div>
          <div style={{ borderTop: '1px solid #F1F5F9', paddingTop: 10 }}>
            <label style={lbl}>Prédécesseur (liaisons)</label>
            <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr', gap: 8 }}>
              <select style={inp} value={form.predId} onChange={e => update('predId', e.target.value)}>
                <option value="">— Aucun —</option>
                {allTasks.filter(t => t.id !== task?.id && t.type !== 'milestone').map(t => (
                  <option key={t.id} value={t.id}>{t.wbs} — {t.name.slice(0, 30)}</option>
                ))}
              </select>
              <select style={inp} value={form.predType} onChange={e => update('predType', e.target.value as LinkType)} disabled={!form.predId}>
                <option value="FS">FS</option><option value="SS">SS</option>
                <option value="FF">FF</option><option value="SF">SF</option>
              </select>
              <input type="number" style={inp} placeholder="Décalage (j)" value={form.predLag}
                onChange={e => update('predLag', e.target.value)} disabled={!form.predId} />
            </div>
          </div>
        </div>
        <div style={{ padding: '10px 16px', borderTop: '1px solid #E5E7EB', display: 'flex', justifyContent: 'space-between' }}>
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
              {mode === 'add' ? 'Ajouter' : 'Enregistrer'}
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
          <button onClick={onClose} style={{ background: 'rgba(255,255,255,0.15)', border: 'none', color: '#fff', borderRadius: 4, padding: '3px 8px', cursor: 'pointer' }}><X size={14} /></button>
        </div>
        <div style={{ flex: 1, overflowY: 'auto', padding: 12 }}>
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
        <button onClick={onClose} style={{ padding: '4px 10px', background: '#F1F5F9', border: '1px solid #E5E7EB', borderRadius: 4, fontSize: 10, cursor: 'pointer', color: '#374151' }}>✕</button>
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
  const [zoom,             setZoom]             = useState<ZoomLevel>('mois');
  const [showCritical,     setShowCritical]     = useState(true);
  const [showBaseline,     setShowBaseline]     = useState(false);
  const [collapsedIds,     setCollapsedIds]     = useState<Set<string>>(new Set());
  const [selectedId,       setSelectedId]       = useState<string | null>(null);
  const [activeRibbonTab,  setActiveRibbonTab]  = useState<'tache' | 'vue' | 'projet'>('tache');

  // Modals
  const [addTaskModal,   setAddTaskModal]   = useState(false);
  const [editTaskId,     setEditTaskId]     = useState<string | null>(null);
  const [resourceTaskId, setResourceTaskId] = useState<string | null>(null);
  const [progressTaskId, setProgressTaskId] = useState<string | null>(null);
  const [progressTop,    setProgressTop]    = useState(0);

  const isSyncing   = useRef(false);
  const tableBodyRef = useRef<HTMLDivElement>(null);
  const ganttBodyRef = useRef<HTMLDivElement>(null);

  // ── Derive gantt tasks from project store ──
  const activeProjet = useMemo(() =>
    store.projets.find(p => p.id === selectedProjetId) ?? null,
  [selectedProjetId, store.projets]);

  const [localTasks, setLocalTasks] = useState<GanttTask[]>([]);
  useEffect(() => {
    if (activeProjet) setLocalTasks(storeToGanttTasks(activeProjet));
    else setLocalTasks([]);
  }, [activeProjet]);

  const criticalIds  = useMemo(() => computeCriticalIds(localTasks), [localTasks]);
  const ppd          = PX_PER_DAY[zoom];
  const monthCols    = useMemo(() => getMonthColumns(ppd), [ppd]);
  const yearGroups   = useMemo(() => getYearGroups(monthCols), [monthCols]);
  const totalTimeline = useMemo(() => dateToPx(TIMELINE_END, ORIGIN, ppd) + 60, [ppd]);
  const visibleTasks = useMemo(() => getVisibleTasks(localTasks, collapsedIds), [localTasks, collapsedIds]);

  const today    = new Date();
  const todayPx  = dateToPx(today, ORIGIN, ppd);

  const onTableScroll = (e: React.UIEvent<HTMLDivElement>) => {
    if (isSyncing.current) return; isSyncing.current = true;
    if (ganttBodyRef.current) ganttBodyRef.current.scrollTop = e.currentTarget.scrollTop;
    isSyncing.current = false;
  };
  const onGanttScroll = (e: React.UIEvent<HTMLDivElement>) => {
    if (isSyncing.current) return; isSyncing.current = true;
    if (tableBodyRef.current) tableBodyRef.current.scrollTop = e.currentTarget.scrollTop;
    isSyncing.current = false;
  };

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

    let updated = localTasks.map(t => t.id === taskId ? {
      ...t, name: data.name, duration: Number(data.duration),
      start: newStart, end: newEnd, pctComplete: Number(data.pctComplete),
      type: data.type,
      predecessors: data.predId ? [{ id: data.predId, type: data.predType, lag: Number(data.predLag) }] : [],
    } : t);

    if (delta !== 0) updated = cascadeRetroplan(updated, taskId, delta);
    setLocalTasks(updated);

    // Sync to store
    store.updateTache(activeProjet.id, taskId, {
      nom: data.name, duree: Number(data.duration),
      dateDebut: data.dateDebut, dateFin: data.dateFin,
      avancement: Number(data.pctComplete),
      type: data.type === 'summary' ? 'Récapitulative' : data.type === 'milestone' ? 'Jalon' : 'Normale',
      predecesseurs: data.predId ? [{ tacheId: data.predId, type: data.predType as import('@/lib/projectStore').DepType, delai: Number(data.predLag) }] : [],
    });
    setEditTaskId(null);
  }, [editTaskId, activeProjet, localTasks, store]);

  const addTask = useCallback((data: TaskFormData) => {
    if (!activeProjet) return;
    const newT = store.createTache({
      projetId: activeProjet.id,
      nom: data.name,
      type: data.type === 'summary' ? 'Récapitulative' : data.type === 'milestone' ? 'Jalon' : 'Normale',
      niveau: 2, ordre: localTasks.length + 1,
      duree: Number(data.duration),
      dateDebut: data.dateDebut, dateFin: data.dateFin,
      avancement: Number(data.pctComplete),
      statutTache: 'a_faire', priorite: 'Moyenne',
      predecesseurs: data.predId ? [{ tacheId: data.predId, type: data.predType as import('@/lib/projectStore').DepType, delai: Number(data.predLag) }] : [],
      assignations: [],
    });
    const ganttTask: GanttTask = {
      id: newT.id, wbs: String(localTasks.length + 1), name: newT.nom,
      type: data.type, level: 1, duration: newT.duree,
      start: new Date(newT.dateDebut), end: new Date(newT.dateFin),
      pctComplete: 0, predecessors: [], resources: [],
      isCritical: false, status: 'non_demarre', storeId: newT.id,
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
    const idxMap = new Map(visibleTasks.map((t, i) => [t.id, i]));
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
    const isCrit   = task.isCritical && showCritical && criticalIds.has(task.id);
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
      const progressW  = barWidth * task.pctComplete / 100;
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
    const progressW    = barWidth * task.pctComplete / 100;

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
          {(['tache', 'vue', 'projet'] as const).map(tab => (
            <button key={tab} onClick={() => setActiveRibbonTab(tab)}
              style={{ padding: '6px 16px', border: 'none', background: activeRibbonTab === tab ? '#fff' : 'transparent', color: activeRibbonTab === tab ? NAVY : 'rgba(255,255,255,0.75)', fontWeight: 700, fontSize: 11, cursor: 'pointer', borderTopLeftRadius: 4, borderTopRightRadius: 4, textTransform: 'capitalize', transition: 'all 0.1s' }}>
              {tab === 'tache' ? '📝 Tâche' : tab === 'vue' ? '👁 Vue' : '🗂 Projet'}
            </button>
          ))}
        </div>
      </div>

      {/* ── TOOLBAR RIBBON ── */}
      <div style={{ background: '#fff', borderBottom: `2px solid ${NAVY}`, padding: '5px 10px', display: 'flex', gap: 6, alignItems: 'center', flexShrink: 0, flexWrap: 'wrap' }}>

        {activeRibbonTab === 'tache' && (
          <>
            <button onClick={() => { if (!activeProjet) return; setAddTaskModal(true); }}
              disabled={!activeProjet}
              style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '5px 10px', background: activeProjet ? NAVY : '#CBD5E1', color: '#fff', border: 'none', borderRadius: 4, fontSize: 11, fontWeight: 600, cursor: activeProjet ? 'pointer' : 'not-allowed' }}>
              <Plus size={13} /> Nouvelle tâche
            </button>
            <div style={{ width: 1, height: 22, background: '#E5E7EB' }} />
            <button onClick={() => { if (selectedId) setEditTaskId(selectedId); }} disabled={!selectedId}
              style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '5px 10px', background: selectedId ? '#F1F5F9' : '#FAFAFA', border: `1px solid ${selectedId ? '#D1D5DB' : '#E5E7EB'}`, borderRadius: 4, fontSize: 11, fontWeight: 600, cursor: selectedId ? 'pointer' : 'not-allowed', color: selectedId ? '#1E293B' : '#9CA3AF' }}>
              <Edit3 size={12} /> Modifier
            </button>
            <button onClick={() => { if (selectedId) setResourceTaskId(selectedId); }} disabled={!selectedId}
              style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '5px 10px', background: selectedId ? '#F0FDF4' : '#FAFAFA', border: `1px solid ${selectedId ? '#BBF7D0' : '#E5E7EB'}`, borderRadius: 4, fontSize: 11, fontWeight: 600, cursor: selectedId ? 'pointer' : 'not-allowed', color: selectedId ? '#0F766E' : '#9CA3AF' }}>
              <Users size={12} /> Ressources
            </button>
            <button onClick={markComplete} disabled={!selectedId}
              style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '5px 10px', background: selectedId ? '#F0FDF4' : '#FAFAFA', border: `1px solid ${selectedId ? '#BBF7D0' : '#E5E7EB'}`, borderRadius: 4, fontSize: 11, fontWeight: 600, cursor: selectedId ? 'pointer' : 'not-allowed', color: selectedId ? '#16A34A' : '#9CA3AF' }}>
              <CheckCircle2 size={12} /> Marquer terminée
            </button>
            <div style={{ width: 1, height: 22, background: '#E5E7EB' }} />
            <button onClick={() => { if (selectedId) { if (confirm('Supprimer cette tâche ?')) deleteTask(selectedId); } }} disabled={!selectedId}
              style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '5px 10px', background: selectedId ? '#FEF2F2' : '#FAFAFA', border: `1px solid ${selectedId ? '#FCA5A5' : '#E5E7EB'}`, borderRadius: 4, fontSize: 11, fontWeight: 600, cursor: selectedId ? 'pointer' : 'not-allowed', color: selectedId ? '#EF4444' : '#9CA3AF' }}>
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
          </>
        )}

        {activeRibbonTab === 'projet' && (
          <>
            {activeProjet && (
              <button onClick={() => store.saveBaseline(activeProjet.id)}
                style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '5px 12px', background: NAVY, color: '#fff', border: 'none', borderRadius: 4, fontSize: 11, fontWeight: 700, cursor: 'pointer' }}>
                <Calendar size={13} /> Sauvegarder Baseline
              </button>
            )}
            <button style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '5px 12px', background: '#F1F5F9', border: '1px solid #E5E7EB', borderRadius: 4, fontSize: 11, fontWeight: 600, cursor: 'pointer', color: '#1E293B' }}>
              <FileText size={13} /> Exporter PDF
            </button>
            <button style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '5px 12px', background: '#F1F5F9', border: '1px solid #E5E7EB', borderRadius: 4, fontSize: 11, fontWeight: 600, cursor: 'pointer', color: '#1E293B' }}>
              <BarChart3 size={13} /> Exporter Excel
            </button>
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
            <span style={{ fontSize: 10, color: '#64748B', fontWeight: 600 }}>{visibleTasks.length}/{localTasks.length} tâches</span>
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
              ) : visibleTasks.map((task, rowIdx) => {
                const isSelected  = task.id === selectedId;
                const isSummary   = task.type === 'summary';
                const isMilestone = task.type === 'milestone';
                const isCrit      = task.isCritical && showCritical && criticalIds.has(task.id);
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
            <div style={{ height: HEADER_H, background: '#F8FAFC', borderBottom: '2px solid #E5E7EB', flexShrink: 0, overflowX: 'hidden' }}>
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
                {visibleTasks.map((task, ri) => (
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
                  {visibleTasks.map((t, ri) => renderBar(t, ri))}
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

    </div>
  );
}

'use client';

import React, { useState, useMemo, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { ChevronLeft } from 'lucide-react';
import { useProjectStore, DOMAINE_CFG, type StatutTache } from '@/lib/projectStore';
import { useProgrammeStore } from '@/lib/programmeStore';
import { useAuth, isOperationalReadOnly } from '@/lib/authStore';
import { readOnlyGuard } from '@/lib/operationalGuard';
import SearchableSelect from '@/components/ui/SearchableSelect';

/* ── Vue context ── */
type ViewMode = 'projet' | 'programme' | 'portefeuille';

/* ── Planning audit trail ── */
interface PlanningChange {
  id: string;
  nodeId: string;
  nodeCode: string;
  nodeLabel: string;
  field: string;
  oldValue: string;
  newValue: string;
  motif: string;
  changedAt: string;
  changedBy: string;
}

/* ══════════════════════════════════════════════════════════════════════════════
   TYPES
══════════════════════════════════════════════════════════════════════════════ */
type WBSStatut = 'termine' | 'en_cours' | 'non_demarre' | 'en_retard';
type WBSType   = 'projet' | 'lot' | 'tache' | 'jalon';

/* Map store StatutTache → WBSStatut */
function mapStatut(st: StatutTache): WBSStatut {
  if (st === 'termine')  return 'termine';
  if (st === 'en_cours') return 'en_cours';
  if (st === 'bloque')   return 'en_retard';
  return 'non_demarre';
}

interface WBSNode {
  id: string;
  code: string;
  label: string;
  type: WBSType;
  responsable: string;
  dateDebut: string;
  dateFin: string;
  avancement: number;
  statut: WBSStatut;
  budgetMrd?: number;
  budgetEngagePct?: number;  // % engagé du budget
  documents?: string[];
  dependances?: string[];
  children?: WBSNode[];
}

/* ══════════════════════════════════════════════════════════════════════════════
   MOCK DATA
══════════════════════════════════════════════════════════════════════════════ */
const WBS_DATA_INITIAL: WBSNode[] = [];

/* ── Template modèle Électrification Rurale ──────────────────────────────── */
const TEMPLATE_ELECTRIFICATION: WBSNode[] = [
  {
    id: 'TPL-P1', code: '1.0', label: '[Modèle] Électrification Rurale — Projet type',
    type: 'projet', responsable: 'Chef de projet DER', dateDebut: '01/01/2026', dateFin: '30/06/2028',
    avancement: 0, statut: 'non_demarre', budgetMrd: 18.0, budgetEngagePct: 0,
    children: [
      {
        id: 'TPL-L1', code: '1.1', label: 'Études techniques',
        type: 'lot', responsable: 'Bureau études', dateDebut: '01/01/2026', dateFin: '31/05/2026',
        avancement: 0, statut: 'non_demarre', budgetMrd: 1.0, budgetEngagePct: 0,
        children: [
          { id: 'TPL-T1', code: '1.1.1', label: 'Études APS', type: 'tache', responsable: 'Ingénieur études', dateDebut: '01/01/2026', dateFin: '28/02/2026', avancement: 0, statut: 'non_demarre' },
          { id: 'TPL-T2', code: '1.1.2', label: 'Études APD', type: 'tache', responsable: 'Ingénieur études', dateDebut: '01/03/2026', dateFin: '31/05/2026', avancement: 0, statut: 'non_demarre' },
          { id: 'TPL-J1', code: '1.1.3', label: 'Validation études', type: 'jalon', responsable: 'DER', dateDebut: '31/05/2026', dateFin: '31/05/2026', avancement: 0, statut: 'non_demarre' },
        ],
      },
      {
        id: 'TPL-L2', code: '1.2', label: 'Passation marchés',
        type: 'lot', responsable: 'DRMP', dateDebut: '01/06/2026', dateFin: '31/10/2026',
        avancement: 0, statut: 'non_demarre', budgetMrd: 0.3, budgetEngagePct: 0,
        children: [
          { id: 'TPL-T3', code: '1.2.1', label: 'Appel d\'offres travaux', type: 'tache', responsable: 'DRMP', dateDebut: '01/06/2026', dateFin: '31/07/2026', avancement: 0, statut: 'non_demarre' },
          { id: 'TPL-T4', code: '1.2.2', label: 'Évaluation & attribution', type: 'tache', responsable: 'Commission', dateDebut: '01/08/2026', dateFin: '30/09/2026', avancement: 0, statut: 'non_demarre' },
          { id: 'TPL-J2', code: '1.2.3', label: 'Signature contrats', type: 'jalon', responsable: 'DG SENELEC', dateDebut: '31/10/2026', dateFin: '31/10/2026', avancement: 0, statut: 'non_demarre' },
        ],
      },
      {
        id: 'TPL-L3', code: '1.3', label: 'Travaux',
        type: 'lot', responsable: 'Entreprise adjudicataire', dateDebut: '01/11/2026', dateFin: '31/03/2028',
        avancement: 0, statut: 'non_demarre', budgetMrd: 14.5, budgetEngagePct: 0,
        children: [
          { id: 'TPL-T5', code: '1.3.1', label: 'Génie civil & fondations', type: 'tache', responsable: 'BTP local', dateDebut: '01/11/2026', dateFin: '30/06/2027', avancement: 0, statut: 'non_demarre' },
          { id: 'TPL-T6', code: '1.3.2', label: 'Lignes HTA', type: 'tache', responsable: 'Electricien HTA', dateDebut: '01/02/2027', dateFin: '31/10/2027', avancement: 0, statut: 'non_demarre' },
          { id: 'TPL-T7', code: '1.3.3', label: 'Réseau BT & branchements', type: 'tache', responsable: 'Électricien BT', dateDebut: '01/07/2027', dateFin: '31/01/2028', avancement: 0, statut: 'non_demarre' },
          { id: 'TPL-J3', code: '1.3.4', label: 'Mise en service', type: 'jalon', responsable: 'DER/DEP', dateDebut: '31/03/2028', dateFin: '31/03/2028', avancement: 0, statut: 'non_demarre' },
        ],
      },
      {
        id: 'TPL-L4', code: '1.4', label: 'Clôture',
        type: 'lot', responsable: 'Commission DPE', dateDebut: '01/04/2028', dateFin: '30/06/2028',
        avancement: 0, statut: 'non_demarre', budgetMrd: 0.5, budgetEngagePct: 0,
        children: [
          { id: 'TPL-J4', code: '1.4.1', label: 'Réception définitive', type: 'jalon', responsable: 'Commission', dateDebut: '30/06/2028', dateFin: '30/06/2028', avancement: 0, statut: 'non_demarre' },
        ],
      },
    ],
  },
];

/* ══════════════════════════════════════════════════════════════════════════════
   CONSTANTES STYLE
══════════════════════════════════════════════════════════════════════════════ */
const STATUT_COLOR: Record<WBSStatut, string> = {
  termine:     '#16A34A',
  en_cours:    '#F39200',
  non_demarre: '#94A3B8',
  en_retard:   '#E2231A',
};
const STATUT_BG: Record<WBSStatut, string> = {
  termine:     'rgba(22,163,74,0.08)',
  en_cours:    'rgba(243,146,0,0.08)',
  non_demarre: 'rgba(148,163,184,0.06)',
  en_retard:   'rgba(226,35,26,0.08)',
};
const STATUT_LABEL: Record<WBSStatut, string> = {
  termine:     'Terminé',
  en_cours:    'En cours',
  non_demarre: 'Non démarré',
  en_retard:   'En retard',
};
const TYPE_LABEL: Record<WBSType, string> = {
  projet: 'Projet', lot: 'Lot de travaux', tache: 'Tâche', jalon: 'Jalon',
};

/* ══════════════════════════════════════════════════════════════════════════════
   HELPERS
══════════════════════════════════════════════════════════════════════════════ */
function flattenNodes(nodes: WBSNode[]): WBSNode[] {
  const result: WBSNode[] = [];
  function walk(n: WBSNode) { result.push(n); n.children?.forEach(walk); }
  nodes.forEach(walk);
  return result;
}

function pillClass(statut: WBSStatut): string {
  return statut === 'termine' ? 'pill pill-ok'
    : statut === 'en_cours'    ? 'pill pill-warn'
    : statut === 'en_retard'   ? 'pill pill-ko'
    : 'pill pill-navy';
}

function BudgetBadge({ pct }: { pct?: number }) {
  if (pct == null) return null;
  const isOver    = pct > 100;
  const isWarning = pct > 90 && pct <= 100;
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 4, minWidth: 120 }}>
      <div style={{ flex: 1, height: 5, background: '#E2E8F0', borderRadius: 3, overflow: 'hidden', minWidth: 50 }}>
        <div style={{
          height: '100%',
          width: `${Math.min(pct, 100)}%`,
          background: isOver ? '#E2231A' : isWarning ? '#F39200' : '#16A34A',
          borderRadius: 3,
        }} />
      </div>
      <span style={{ fontSize: 9, fontWeight: 700, color: isOver ? '#E2231A' : isWarning ? '#F39200' : 'var(--muted)', minWidth: 28, textAlign: 'right' }}>{pct}%</span>
      {isOver && (
        <span style={{ fontSize: 8, padding: '1px 4px', background: 'rgba(226,35,26,0.12)', color: '#E2231A', borderRadius: 3, fontWeight: 700, whiteSpace: 'nowrap' }}>Dépasse.</span>
      )}
      {isWarning && (
        <span style={{ fontSize: 8, padding: '1px 4px', background: 'rgba(243,146,0,0.12)', color: '#F39200', borderRadius: 3, fontWeight: 700, whiteSpace: 'nowrap' }}>Attention</span>
      )}
    </div>
  );
}

/* ══════════════════════════════════════════════════════════════════════════════
   TOAST
══════════════════════════════════════════════════════════════════════════════ */
interface Toast {
  id: number;
  message: string;
  type: 'ok' | 'info';
}

/* ══════════════════════════════════════════════════════════════════════════════
   NODE ROW (récursif)
══════════════════════════════════════════════════════════════════════════════ */
function WBSRow({
  node, depth, expanded, onToggle, selected, onSelect,
}: {
  node: WBSNode;
  depth: number;
  expanded: Set<string>;
  onToggle: (id: string) => void;
  selected: WBSNode | null;
  onSelect: (n: WBSNode) => void;
}) {
  const hasChildren = !!node.children?.length;
  const isOpen      = expanded.has(node.id);
  const isSel       = selected?.id === node.id;
  const col         = STATUT_COLOR[node.statut];
  const isJalon     = node.type === 'jalon';

  return (
    <>
      <div
        onClick={() => { onSelect(node); if (hasChildren) onToggle(node.id); }}
        style={{
          display: 'flex', alignItems: 'center',
          paddingLeft: 12 + depth * 18, paddingRight: 14,
          paddingTop: 7, paddingBottom: 7,
          borderBottom: '1px solid var(--border-2)',
          background: isSel
            ? 'var(--navy-ultra)'
            : isJalon
            ? 'rgba(245,176,0,0.06)'
            : STATUT_BG[node.statut],
          borderLeft: isSel ? '3px solid var(--navy)' : `3px solid ${col}50`,
          cursor: 'pointer',
          transition: 'background 0.1s',
        }}
        onMouseEnter={e => { if (!isSel) (e.currentTarget as HTMLElement).style.background = 'var(--bg-hover)'; }}
        onMouseLeave={e => {
          (e.currentTarget as HTMLElement).style.background = isSel
            ? 'var(--navy-ultra)'
            : isJalon
            ? 'rgba(245,176,0,0.06)'
            : STATUT_BG[node.statut];
        }}
      >
        {/* Toggle / Jalon icon */}
        <div style={{ width: 16, flexShrink: 0, fontSize: 10, color: isJalon ? '#D97706' : 'var(--muted)' }}>
          {hasChildren ? (isOpen ? '▼' : '▶') : isJalon ? '◆' : ''}
        </div>

        {/* Code */}
        <div style={{ width: 58, flexShrink: 0, fontSize: 10, fontWeight: 700, color: 'var(--muted)', fontFamily: 'monospace' }}>
          {node.code}
        </div>

        {/* Label */}
        <div style={{ flex: 1, overflow: 'hidden', minWidth: 0, marginRight: 10 }}>
          <div style={{
            fontSize: depth === 0 ? 13 : depth === 1 ? 12 : 11,
            fontWeight: depth === 0 ? 700 : depth === 1 ? 600 : 500,
            color: isSel ? 'var(--navy)' : isJalon ? '#92400E' : 'var(--text)',
            overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
          }} title={node.label}>
            {isJalon && <span style={{ marginRight: 4, fontSize: depth === 0 ? 14 : 12 }}>◆</span>}
            {node.label}
          </div>
          {depth > 0 && (
            <div style={{ fontSize: 9, color: 'var(--muted)', marginTop: 1 }}>
              {node.responsable} · {node.dateDebut} → {node.dateFin}
            </div>
          )}
        </div>

        {/* Avancement */}
        <div style={{ width: 100, flexShrink: 0, display: 'flex', alignItems: 'center', gap: 6 }}>
          {node.type !== 'jalon' ? (
            <>
              <div className="progress-bar" style={{ flex: 1 }}>
                <div className="progress-fill" style={{ width: `${node.avancement}%`, background: col }} />
              </div>
              <span style={{ fontSize: 10, fontWeight: 700, color: col, minWidth: 28, textAlign: 'right' }}>
                {node.avancement}%
              </span>
            </>
          ) : (
            <span style={{ fontSize: 9, fontWeight: 700, color: node.avancement === 100 ? 'var(--green)' : '#D97706' }}>
              {node.avancement === 100 ? '✓ Atteint' : 'En attente'}
            </span>
          )}
        </div>

        {/* Budget engagé */}
        <div style={{ width: 160, flexShrink: 0, marginLeft: 6 }}>
          {node.type !== 'jalon' && node.budgetEngagePct != null ? (
            <BudgetBadge pct={node.budgetEngagePct} />
          ) : (
            <span style={{ fontSize: 10, color: 'var(--muted)' }}>—</span>
          )}
        </div>

        {/* Budget alloué */}
        <div style={{ width: 68, textAlign: 'right', flexShrink: 0, fontSize: 10, color: 'var(--muted)' }}>
          {node.budgetMrd ? `${node.budgetMrd.toFixed(1)} Mrd` : '—'}
        </div>

        {/* Statut pill */}
        <div style={{ width: 90, flexShrink: 0, marginLeft: 8 }}>
          <span className={pillClass(node.statut)} style={{ fontSize: 9 }}>
            {STATUT_LABEL[node.statut]}
          </span>
        </div>
      </div>

      {/* Children */}
      {hasChildren && isOpen && node.children!.map(child => (
        <WBSRow key={child.id} node={child} depth={depth + 1}
          expanded={expanded} onToggle={onToggle} selected={selected} onSelect={onSelect} />
      ))}
    </>
  );
}

/* ══════════════════════════════════════════════════════════════════════════════
   DETAIL PANEL
══════════════════════════════════════════════════════════════════════════════ */
function DetailPanel({ node, onClose, onEdit, onAddChild }: {
  node: WBSNode;
  onClose: () => void;
  onEdit: (n: WBSNode) => void;
  onAddChild: (parentId: string) => void;
}) {
  const col = STATUT_COLOR[node.statut];
  const isJalon = node.type === 'jalon';
  return (
    <div style={{ width: 280, flexShrink: 0, borderLeft: '1px solid var(--border)', background: 'var(--bg-card)', display: 'flex', flexDirection: 'column', overflowY: 'auto', boxShadow: 'var(--shadow)' }}>
      <div style={{ padding: '12px 14px', borderBottom: '1px solid var(--border-2)', background: isJalon ? '#92400E' : 'var(--navy)', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div>
          <div style={{ fontSize: 9, color: 'rgba(255,255,255,0.55)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 3 }}>
            {isJalon ? '◆ JALON' : `WBS ${node.code}`}
          </div>
          <div style={{ fontSize: 12, fontWeight: 700, color: '#fff', lineHeight: 1.4, maxWidth: 200 }}>{node.label}</div>
        </div>
        <button onClick={onClose} aria-label="Fermer le panneau détail" style={{ background: 'rgba(255,255,255,0.12)', border: 'none', color: '#fff', borderRadius: 4, padding: '2px 6px', cursor: 'pointer', fontSize: 14 }}>×</button>
      </div>

      <div style={{ padding: 14, display: 'flex', flexDirection: 'column', gap: 14 }}>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <span className={pillClass(node.statut)} style={{ fontSize: 10 }}>{STATUT_LABEL[node.statut]}</span>
          <span className="pill pill-navy" style={{ fontSize: 10 }}>{TYPE_LABEL[node.type]}</span>
        </div>

        {!isJalon && (
          <div>
            <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 6 }}>Avancement</div>
            <div style={{ fontSize: 28, fontWeight: 800, color: col, lineHeight: 1 }}>{node.avancement}%</div>
            <div className="progress-bar" style={{ marginTop: 8, height: 8 }}>
              <div className="progress-fill" style={{ width: `${node.avancement}%`, background: col }} />
            </div>
          </div>
        )}

        {/* Budget section */}
        {(node.budgetMrd != null || node.budgetEngagePct != null) && !isJalon && (
          <div>
            <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 6 }}>Budget</div>
            {node.budgetMrd != null && (
              <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--navy)', marginBottom: 4 }}>{node.budgetMrd.toFixed(2)} Mrd FCFA alloués</div>
            )}
            {node.budgetEngagePct != null && (
              <BudgetBadge pct={node.budgetEngagePct} />
            )}
          </div>
        )}

        <div style={{ display: 'flex', flexDirection: 'column', gap: 9 }}>
          {[
            { label: 'Responsable', value: node.responsable },
            { label: 'Date début', value: node.dateDebut },
            { label: 'Date fin', value: node.dateFin },
            { label: 'Sous-éléments', value: node.children ? String(node.children.length) : '—' },
          ].map(({ label, value }) => (
            <div key={label}>
              <div style={{ fontSize: 9, color: 'var(--muted)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 2 }}>{label}</div>
              <div style={{ fontSize: 11, color: 'var(--text-2)' }}>{value}</div>
            </div>
          ))}
        </div>

        {node.dependances && node.dependances.length > 0 && (
          <div>
            <div style={{ fontSize: 9, color: 'var(--muted)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 6 }}>Dépendances (FS)</div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
              {node.dependances.map(d => (
                <span key={d} style={{ padding: '2px 7px', background: 'var(--navy-light)', color: 'var(--navy)', fontSize: 10, fontWeight: 700, borderRadius: 4 }}>WBS {d}</span>
              ))}
            </div>
          </div>
        )}

        {node.documents && node.documents.length > 0 && (
          <div>
            <div style={{ fontSize: 9, color: 'var(--muted)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 6 }}>Documents liés</div>
            {node.documents.map(doc => (
              <div key={doc} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '5px 8px', background: 'var(--bg)', borderRadius: 'var(--r-sm)', marginBottom: 4, border: '1px solid var(--border-2)', cursor: 'pointer' }}
                onClick={() => alert(`Ouverture : ${doc}`)}>
                <span style={{ fontSize: 14 }}>📄</span>
                <span style={{ fontSize: 10, color: 'var(--text-2)', flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{doc}</span>
              </div>
            ))}
          </div>
        )}

        <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginTop: 4 }}>
          <button className="btn btn-ghost btn-sm" style={{ justifyContent: 'center' }}
            onClick={() => onEdit(node)}>✏ Modifier</button>
          {node.type !== 'tache' && node.type !== 'jalon' && (
            <button className="btn btn-navy btn-sm" style={{ justifyContent: 'center' }}
              onClick={() => onAddChild(node.id)}>+ Ajouter sous-élément</button>
          )}
        </div>
      </div>
    </div>
  );
}

/* ══════════════════════════════════════════════════════════════════════════════
   EPS BREADCRUMB
══════════════════════════════════════════════════════════════════════════════ */
const EPS_LEVELS = [
  { label: 'DPE', id: 'dpe' },
  { label: 'DER', id: 'der' },
  { label: 'Programme Électrification Rurale', id: 'per' },
  { label: 'PRJ-DER-2024-001', id: 'prj' },
];

function EPSBreadcrumb() {
  const [activeLevel, setActiveLevel] = useState('prj');
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '6px 14px', background: 'rgba(14,52,96,0.06)', borderBottom: '1px solid var(--border-2)', flexShrink: 0, flexWrap: 'wrap' }}>
      <span style={{ fontSize: 9, fontWeight: 700, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.07em', marginRight: 4 }}>EPS :</span>
      {EPS_LEVELS.map((level, i) => (
        <span key={level.id} style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
          {i > 0 && <span style={{ fontSize: 11, color: 'var(--muted)' }}>›</span>}
          <button
            onClick={() => setActiveLevel(level.id)}
            style={{
              background: 'none', border: 'none', cursor: 'pointer', padding: '2px 4px',
              fontSize: 11,
              fontWeight: activeLevel === level.id ? 800 : 500,
              color: activeLevel === level.id ? 'var(--navy)' : 'var(--muted)',
              borderBottom: activeLevel === level.id ? '2px solid var(--navy)' : '2px solid transparent',
              transition: 'all 0.1s',
              lineHeight: 1.4,
            }}>
            {level.label}
          </button>
        </span>
      ))}
    </div>
  );
}

/* ══════════════════════════════════════════════════════════════════════════════
   COMPOSANT PRINCIPAL
══════════════════════════════════════════════════════════════════════════════ */
export default function WBS() {
  const router   = useRouter();
  const store    = readOnlyGuard(useProjectStore(), isOperationalReadOnly(useAuth().user));
  const prgStore = useProgrammeStore();
  const { user } = useAuth();

  /* ── Build WBSNode tree from store projets ── */
  const storeWbsData = useMemo<WBSNode[]>(() => {
    return store.projets.map((proj, projIdx) => {
      const domCfg = DOMAINE_CFG[proj.domaine];
      // Group tasks: niveau=1 → lot/phase, niveau=2+ → children
      const lots: WBSNode[] = [];
      let currentLot: WBSNode | null = null;
      const sorted = [...proj.taches].sort((a, b) => a.ordre - b.ordre);

      sorted.forEach((t, ti) => {
        const st = mapStatut(t.statutTache);
        const node: WBSNode = {
          id: t.id,
          code: `${projIdx + 1}.${ti + 1}`,
          label: t.nom,
          type: t.type === 'Jalon' ? 'jalon' : t.type === 'Récapitulative' ? 'lot' : 'tache',
          responsable: store.ressources.find(r => t.assignations[0]?.ressourceId === r.id)
            ? `${store.ressources.find(r => t.assignations[0]?.ressourceId === r.id)!.prenom} ${store.ressources.find(r => t.assignations[0]?.ressourceId === r.id)!.nom}`
            : proj.chefProjet,
          dateDebut: t.dateDebut.split('-').reverse().join('/'),
          dateFin: t.dateFin.split('-').reverse().join('/'),
          avancement: t.avancement,
          statut: st,
          budgetEngagePct: t.coutReel && t.coutPrevu && t.coutPrevu > 0
            ? Math.round((t.coutReel / t.coutPrevu) * 100)
            : t.avancement > 0 ? Math.min(Math.round(t.avancement * 1.05), 110) : 0,
          dependances: t.predecesseurs.map(p => p.tacheId),
          children: [],
        };

        if (t.niveau === 1 || t.type === 'Récapitulative') {
          currentLot = node;
          lots.push(node);
        } else if (currentLot) {
          currentLot.children = currentLot.children ?? [];
          currentLot.children.push(node);
        } else {
          lots.push(node);
        }
      });

      // Add jalons from project
      const jalonsNode: WBSNode = {
        id: `${proj.id}-jalons`,
        code: `${projIdx + 1}.J`,
        label: 'Jalons du projet',
        type: 'lot',
        responsable: proj.chefProjet,
        dateDebut: proj.dateDebut.split('-').reverse().join('/'),
        dateFin: proj.dateFinPrevue.split('-').reverse().join('/'),
        avancement: Math.round(proj.jalons.filter(j => j.atteint).length / Math.max(proj.jalons.length, 1) * 100),
        statut: proj.jalons.every(j => j.atteint) ? 'termine' : proj.jalons.some(j => j.atteint) ? 'en_cours' : 'non_demarre',
        budgetEngagePct: undefined,
        children: proj.jalons.map((j, ji) => ({
          id: `${proj.id}-j${ji}`,
          code: `${projIdx + 1}.J.${ji + 1}`,
          label: j.label,
          type: 'jalon' as WBSType,
          responsable: proj.chefProjet,
          dateDebut: j.date.split('-').reverse().join('/'),
          dateFin: j.date.split('-').reverse().join('/'),
          avancement: j.atteint ? 100 : 0,
          statut: (j.atteint ? 'termine' : 'non_demarre') as WBSStatut,
        })),
      };
      if (proj.jalons.length > 0) lots.push(jalonsNode);

      const budgetDecaissePct = proj.budget > 0
        ? Math.round((proj.budgetDecaisse / proj.budget) * 100)
        : 0;

      return {
        id: proj.id,
        code: `${projIdx + 1}.0`,
        label: `${proj.code} — ${proj.nom}`,
        type: 'projet' as WBSType,
        responsable: proj.chefProjet,
        dateDebut: proj.dateDebut.split('-').reverse().join('/'),
        dateFin: proj.dateFinPrevue.split('-').reverse().join('/'),
        avancement: proj.avancement,
        statut: (proj.statut === 'termine' ? 'termine'
          : proj.statut === 'en_retard' || proj.statut === 'suspendu' ? 'en_retard'
          : proj.statut === 'planifie' ? 'non_demarre'
          : 'en_cours') as WBSStatut,
        budgetMrd: proj.budget / 1000,
        budgetEngagePct: budgetDecaissePct,
        children: lots,
      };
    });
  }, [store.projets, store.ressources]);

  const [useStoreData, setUseStoreData] = useState(true);
  const [wbsData, setWbsData]         = useState<WBSNode[]>(WBS_DATA_INITIAL);
  const [viewMode, setViewMode]        = useState<ViewMode>('projet');
  const [planningLog, setPlanningLog]  = useState<PlanningChange[]>([]);
  const [showHistory, setShowHistory]  = useState(false);
  const [editMotif, setEditMotif]      = useState('');

  /** Filtre par projet — défaut = premier projet */
  const [selectedProjetId, setSelectedProjetId] = useState<string>('');

  const activeWbsData = useStoreData ? storeWbsData : wbsData;

  /* Initialise sur le premier projet dès que les données sont disponibles */
  useEffect(() => {
    if (!selectedProjetId && activeWbsData.length > 0) {
      setSelectedProjetId(activeWbsData[0].id);
    }
  }, [activeWbsData, selectedProjetId]);

  /** Vue filtrée sur un seul projet */
  const viewWbsData = useMemo(() => {
    if (!selectedProjetId) return activeWbsData.slice(0, 1);
    return activeWbsData.filter(p => p.id === selectedProjetId);
  }, [activeWbsData, selectedProjetId]);

  const defaultExpandedIds = useMemo(() => {
    const ids = new Set<string>();
    storeWbsData.forEach(p => { ids.add(p.id); });
    return ids;
  }, [storeWbsData]);

  const [expanded, setExpanded]       = useState<Set<string>>(new Set(['P1', 'P1-1', 'P1-2', 'P1-3', 'P2']));
  const [selected, setSelected]       = useState<WBSNode | null>(null);
  const [filterStatut, setFilterStatut] = useState<'tous' | WBSStatut>('tous');

  /* ── Edit / Add-child modal state ── */
  const [editTarget, setEditTarget]   = useState<WBSNode | null>(null);
  const [addParentId, setAddParentId] = useState<string | null>(null);
  type NodeForm = { label: string; responsable: string; dateDebut: string; dateFin: string; avancement: number; statut: WBSStatut; type: WBSType; };
  const [nodeForm, setNodeForm]       = useState<NodeForm>({ label: '', responsable: '', dateDebut: '', dateFin: '', avancement: 0, statut: 'non_demarre', type: 'tache' });

  /* Recursive tree helpers */
  function updateNodeInTree(nodes: WBSNode[], targetId: string, patch: Partial<WBSNode>): WBSNode[] {
    return nodes.map(n => {
      if (n.id === targetId) return { ...n, ...patch };
      if (n.children) return { ...n, children: updateNodeInTree(n.children, targetId, patch) };
      return n;
    });
  }
  function addChildToNode(nodes: WBSNode[], parentId: string, child: WBSNode): WBSNode[] {
    return nodes.map(n => {
      if (n.id === parentId) return { ...n, children: [...(n.children ?? []), child] };
      if (n.children) return { ...n, children: addChildToNode(n.children, parentId, child) };
      return n;
    });
  }

  const openEdit = (n: WBSNode) => {
    setEditTarget(n);
    setNodeForm({ label: n.label, responsable: n.responsable, dateDebut: n.dateDebut, dateFin: n.dateFin, avancement: n.avancement, statut: n.statut, type: n.type });
  };
  const openAddChild = (parentId: string) => {
    setAddParentId(parentId);
    setNodeForm({ label: '', responsable: '', dateDebut: '', dateFin: '', avancement: 0, statut: 'non_demarre', type: 'tache' });
  };
  const saveEdit = () => {
    if (!editTarget || !nodeForm.label.trim()) return;
    /* ── Audit trail : enregistre les changements de dates ── */
    const changes: PlanningChange[] = [];
    const now = new Date().toLocaleString('fr-FR');
    const who = user?.prenom ? `${user.prenom} ${user.nom}` : 'Utilisateur';
    if (nodeForm.dateDebut !== editTarget.dateDebut) {
      changes.push({ id: `${Date.now()}-dd`, nodeId: editTarget.id, nodeCode: editTarget.code, nodeLabel: editTarget.label, field: 'Date début', oldValue: editTarget.dateDebut, newValue: nodeForm.dateDebut, motif: editMotif || '—', changedAt: now, changedBy: who });
    }
    if (nodeForm.dateFin !== editTarget.dateFin) {
      changes.push({ id: `${Date.now()}-df`, nodeId: editTarget.id, nodeCode: editTarget.code, nodeLabel: editTarget.label, field: 'Date fin', oldValue: editTarget.dateFin, newValue: nodeForm.dateFin, motif: editMotif || '—', changedAt: now, changedBy: who });
    }
    if (nodeForm.avancement !== editTarget.avancement) {
      changes.push({ id: `${Date.now()}-av`, nodeId: editTarget.id, nodeCode: editTarget.code, nodeLabel: editTarget.label, field: 'Avancement', oldValue: `${editTarget.avancement}%`, newValue: `${nodeForm.avancement}%`, motif: editMotif || '—', changedAt: now, changedBy: who });
    }
    if (changes.length > 0) setPlanningLog(prev => [...changes, ...prev]);

    const updated = updateNodeInTree(useStoreData ? storeWbsData : wbsData, editTarget.id, {
      label: nodeForm.label, responsable: nodeForm.responsable,
      dateDebut: nodeForm.dateDebut, dateFin: nodeForm.dateFin,
      avancement: nodeForm.avancement, statut: nodeForm.statut,
    });
    setUseStoreData(false);
    setWbsData(updated);
    setSelected(prev => prev?.id === editTarget.id ? { ...prev, ...nodeForm } : prev);
    setEditMotif('');
    pushToast(`WBS ${editTarget.code} mis à jour`, 'ok');
    setEditTarget(null);
  };
  const saveAddChild = () => {
    if (!addParentId || !nodeForm.label.trim()) return;
    const parent = flattenNodes(useStoreData ? storeWbsData : wbsData).find(n => n.id === addParentId);
    if (!parent) return;
    const childCount = (parent.children?.length ?? 0) + 1;
    const newId = `${addParentId}-C${Date.now()}`;
    const newCode = `${parent.code}.${childCount}`;
    const child: WBSNode = { id: newId, code: newCode, label: nodeForm.label, type: nodeForm.type, responsable: nodeForm.responsable, dateDebut: nodeForm.dateDebut, dateFin: nodeForm.dateFin, avancement: nodeForm.avancement, statut: nodeForm.statut };
    const updated = addChildToNode(useStoreData ? storeWbsData : wbsData, addParentId, child);
    setUseStoreData(false);
    setWbsData(updated);
    setExpanded(prev => new Set([...prev, addParentId]));
    pushToast(`Élément "${nodeForm.label}" ajouté sous WBS ${parent.code}`, 'ok');
    setAddParentId(null);
  };
  const [selectedProgrammeId, setSelectedProgrammeId] = useState<string>('');
  const [searchQ, setSearchQ]         = useState('');
  const [showTable, setShowTable]     = useState(false);
  const [toasts, setToasts]           = useState<Toast[]>([]);
  let toastCounter = 0;

  const pushToast = (message: string, type: 'ok' | 'info' = 'ok') => {
    const id = ++toastCounter + Date.now();
    setToasts(prev => [...prev, { id, message, type }]);
    setTimeout(() => setToasts(prev => prev.filter(t => t.id !== id)), 3500);
  };

  const toggle = (id: string) => {
    setExpanded(prev => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n; });
  };

  const expandAll = () => {
    const ids = new Set<string>();
    function walk(n: WBSNode) { ids.add(n.id); n.children?.forEach(walk); }
    viewWbsData.forEach(walk);
    setExpanded(ids);
  };
  const collapseAll = () => setExpanded(new Set());

  /* ── Stats ── */
  const allNodes = useMemo(() => flattenNodes(viewWbsData), [viewWbsData]);
  const taches   = allNodes.filter(n => n.type === 'tache');
  const jalons   = allNodes.filter(n => n.type === 'jalon');
  const termines = taches.filter(n => n.statut === 'termine');
  const enCours  = taches.filter(n => n.statut === 'en_cours');
  const retards  = taches.filter(n => n.statut === 'en_retard');

  /* ── Table view nodes ── */
  const tableNodes = useMemo(() => {
    return allNodes.filter(n => {
      if (filterStatut !== 'tous' && n.statut !== filterStatut) return false;
      if (searchQ && !n.label.toLowerCase().includes(searchQ.toLowerCase()) && !n.code.includes(searchQ)) return false;
      return true;
    });
  }, [allNodes, filterStatut, searchQ]);

  /* ── Import/Export actions ── */
  const handleImportMSP = () => {
    setTimeout(() => {
      pushToast('Importation simulée — 47 tâches chargées depuis fichier XML planning', 'ok');
    }, 600);
  };

  const handleExportExcel = () => {
    pushToast('Export WBS généré — fichier WBS_export.xlsx prêt au téléchargement', 'ok');
  };

  const handleCopyTemplate = () => {
    const ids = new Set<string>();
    function walkIds(n: WBSNode) { ids.add(n.id); n.children?.forEach(walkIds); }
    TEMPLATE_ELECTRIFICATION.forEach(walkIds);
    setUseStoreData(false);
    setWbsData(prev => {
      const existing = prev.map(p => p.id);
      if (existing.includes('TPL-P1')) return prev;
      return [...prev, ...TEMPLATE_ELECTRIFICATION];
    });
    setExpanded(prev => new Set([...prev, ...ids]));
    pushToast('Modèle Électrification Rurale chargé — 4 lots, 8 tâches, 4 jalons', 'ok');
  };

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', background: 'var(--bg)' }}>

      {/* ── EPS Breadcrumb ── */}
      <EPSBreadcrumb />

      {/* ── Back button ── */}
      <div style={{ padding: '8px 16px', background: 'var(--bg-card)', borderBottom: '1px solid var(--border)', flexShrink: 0 }}>
        <button onClick={() => router.back()} style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '5px 10px', borderRadius: 7, border: '1px solid #E2E8F0', background: 'transparent', color: '#64748B', cursor: 'pointer', fontSize: 11, fontWeight: 600 }}>
          <ChevronLeft size={13} /> Retour
        </button>
      </div>

      {/* ── KPIs ── */}
      <div className="kpi-grid" style={{ padding: '12px 16px', background: 'var(--bg-card)', borderBottom: '1px solid var(--border)', flexShrink: 0, gap: 10 }}>
        {[
          { label: 'Tâches totales', value: taches.length, cls: 'navy', valCls: '' },
          { label: 'Terminées', value: termines.length, cls: 'green', valCls: 'green' },
          { label: 'En cours', value: enCours.length, cls: 'amber', valCls: 'amber' },
          { label: 'En retard', value: retards.length, cls: 'red', valCls: 'red' },
          { label: 'Jalons', value: jalons.length, cls: '', valCls: '' },
        ].map(k => (
          <div key={k.label} className={`kpi-card ${k.cls}`}>
            <div className="kpi-label">{k.label}</div>
            <div className={`kpi-value ${k.valCls}`}>{k.value}</div>
          </div>
        ))}
      </div>

      {/* ── BARRE CONTEXTE (Projet / Programme / Portefeuille) ── */}
      <div style={{ padding: '8px 14px', background: 'var(--navy)', borderBottom: '2px solid rgba(255,255,255,0.1)', display: 'flex', gap: 6, alignItems: 'center', flexShrink: 0, flexWrap: 'wrap' }}>
        {(['projet', 'programme', 'portefeuille'] as ViewMode[]).map(m => (
          <button key={m} onClick={() => { setViewMode(m); setSelected(null); }}
            style={{ padding: '5px 14px', borderRadius: 20, border: 'none', cursor: 'pointer', fontSize: 12, fontWeight: 700, transition: 'all 0.15s',
              background: viewMode === m ? '#fff' : 'rgba(255,255,255,0.12)',
              color: viewMode === m ? 'var(--navy)' : 'rgba(255,255,255,0.8)' }}>
            {m === 'projet' ? '📁 Projet' : m === 'programme' ? '📂 Programme' : '🗂 Portefeuille'}
          </button>
        ))}

        <div style={{ width: 1, height: 20, background: 'rgba(255,255,255,0.2)', margin: '0 4px' }} />

        {/* Sélecteur contextuel — searchable */}
        {viewMode === 'projet' && (
          <div style={{ minWidth: 280, maxWidth: 420 }}>
            <SearchableSelect
              value={selectedProjetId}
              onChange={v => { setSelectedProjetId(v); setSelected(null); }}
              options={activeWbsData.map(p => ({
                value: p.id,
                label: p.label.slice(0, 72),
              }))}
              placeholder="Choisir un projet…"
              searchPlaceholder="Rechercher un projet…"
            />
          </div>
        )}
        {viewMode === 'programme' && (
          <div style={{ minWidth: 280, maxWidth: 420 }}>
            <SearchableSelect
              value={selectedProgrammeId}
              onChange={v => setSelectedProgrammeId(v)}
              options={[
                { value: '', label: '— Choisir un programme —' },
                ...prgStore.programmes.map(pr => ({ value: pr.id, label: `${pr.code} — ${pr.nom}` })),
              ]}
              placeholder="— Choisir un programme —"
              searchPlaceholder="Rechercher un programme…"
            />
          </div>
        )}

        <div style={{ flex: 1 }} />

        {viewMode === 'projet' && (
          <>
            <button className="btn btn-sm" style={{ background: 'rgba(255,255,255,0.15)', color: '#fff', border: 'none' }} onClick={expandAll}>▼ Déplier</button>
            <button className="btn btn-sm" style={{ background: 'rgba(255,255,255,0.15)', color: '#fff', border: 'none' }} onClick={collapseAll}>▶ Replier</button>
            <div style={{ width: 1, height: 20, background: 'rgba(255,255,255,0.2)' }} />
            <button className="btn btn-sm" style={{ background: 'rgba(255,255,255,0.15)', color: '#fff', border: 'none' }} onClick={() => setShowTable(v => !v)}>
              {showTable ? '🌲 Arbre' : '📋 Tableau'}
            </button>
            <button className="btn btn-sm" style={{ background: 'rgba(255,255,255,0.15)', color: '#fff', border: 'none' }} onClick={handleExportExcel}>📤 Excel</button>
          </>
        )}
        <button className="btn btn-sm" title="Historique des replanifications"
          style={{ background: planningLog.length > 0 ? '#F47920' : 'rgba(255,255,255,0.15)', color: '#fff', border: 'none' }}
          onClick={() => setShowHistory(true)}>
          🕐 Historique {planningLog.length > 0 && `(${planningLog.length})`}
        </button>
        {viewMode === 'projet' && (
          <button className="btn btn-sm" style={{ background: '#F47920', color: '#fff', border: 'none' }} onClick={() => openAddChild(selectedProjetId || activeWbsData[0]?.id || '')}>
            + Ajouter
          </button>
        )}
      </div>

      {/* ── SECONDARY TOOLBAR (data source, template) ── */}
      {viewMode === 'projet' && (
        <div style={{ padding: '5px 14px', background: 'var(--bg-card)', borderBottom: '1px solid var(--border-2)', display: 'flex', gap: 6, alignItems: 'center', flexShrink: 0, flexWrap: 'wrap' }}>
          <button className={`btn btn-sm ${useStoreData ? 'btn-primary' : 'btn-ghost'}`} onClick={() => setUseStoreData(true)}>🔗 Données réelles</button>
          <button className={`btn btn-sm ${!useStoreData ? 'btn-primary' : 'btn-ghost'}`} onClick={() => setUseStoreData(false)}>📋 Démo</button>
          <div style={{ width: 1, height: 18, background: 'var(--border-2)' }} />
          <button className="btn btn-ghost btn-sm" onClick={handleImportMSP}>Importer XML</button>
          <button className="btn btn-ghost btn-sm" onClick={handleCopyTemplate}>📋 Modèle Élec. Rurale</button>
        </div>
      )}

      {/* ── MAIN ── */}
      <div style={{ flex: 1, display: 'flex', overflow: 'hidden' }}>
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>

          {/* ══ VUE PROGRAMME ══ */}
          {viewMode === 'programme' && (() => {
            const prog = prgStore.programmes.find(p => p.id === selectedProgrammeId);
            const projetsInProg = prog
              ? store.projets.filter(p => prog.projetsIds.includes(p.id))
              : [];
            return (
              <div style={{ flex: 1, overflowY: 'auto', padding: 16, display: 'flex', flexDirection: 'column', gap: 14 }}>
                {!prog ? (
                  <div style={{ textAlign: 'center', padding: 40, color: '#94A3B8', fontSize: 14 }}>
                    Sélectionnez un programme dans la liste en haut.
                    {prgStore.programmes.length === 0 && <><br /><span style={{ fontSize: 12 }}>Aucun programme créé — utilisez le module Programmes pour en créer.</span></>}
                  </div>
                ) : (
                  <>
                    {/* En-tête programme */}
                    <div style={{ background: 'linear-gradient(135deg,var(--navy) 0%,#2563EB 100%)', borderRadius: 12, padding: '16px 20px', color: '#fff' }}>
                      <div style={{ fontSize: 11, opacity: 0.7, marginBottom: 4, textTransform: 'uppercase', letterSpacing: '0.06em' }}>Programme</div>
                      <div style={{ fontSize: 18, fontWeight: 800 }}>{prog.code} — {prog.nom}</div>
                      <div style={{ display: 'flex', gap: 24, marginTop: 10, flexWrap: 'wrap' }}>
                        <div><div style={{ fontSize: 10, opacity: 0.7 }}>Projets</div><div style={{ fontSize: 22, fontWeight: 800 }}>{projetsInProg.length}</div></div>
                        <div><div style={{ fontSize: 10, opacity: 0.7 }}>Budget total</div><div style={{ fontSize: 22, fontWeight: 800 }}>{(projetsInProg.reduce((s,p) => s + p.budget, 0)/1000).toFixed(1)} Mrd</div></div>
                        <div><div style={{ fontSize: 10, opacity: 0.7 }}>Avancement moyen</div><div style={{ fontSize: 22, fontWeight: 800 }}>{projetsInProg.length > 0 ? Math.round(projetsInProg.reduce((s,p) => s + p.avancement,0)/projetsInProg.length) : 0}%</div></div>
                        <div><div style={{ fontSize: 10, opacity: 0.7 }}>Statut</div><div style={{ fontSize: 14, fontWeight: 700, marginTop: 4 }}>{prog.statut?.toUpperCase()}</div></div>
                      </div>
                    </div>

                    {/* Projets du programme avec WBS inline */}
                    {projetsInProg.length === 0 ? (
                      <div style={{ textAlign: 'center', color: '#94A3B8', padding: 24 }}>Aucun projet dans ce programme.</div>
                    ) : projetsInProg.map((proj, pi) => {
                      const wbsNode = storeWbsData.find(n => n.id === proj.id);
                      const domCfg = DOMAINE_CFG[proj.domaine];
                      const predecesseurs = pi > 0 ? [projetsInProg[pi-1].code] : [];
                      return (
                        <div key={proj.id} style={{ background: 'var(--bg-card)', borderRadius: 10, border: '1px solid var(--border-2)', overflow: 'hidden' }}>
                          {/* Header projet */}
                          <div style={{ padding: '10px 14px', background: `${domCfg?.color ?? '#1B4F8A'}10`, borderBottom: '1px solid var(--border-2)', display: 'flex', alignItems: 'center', gap: 12 }}>
                            <div style={{ width: 32, height: 32, borderRadius: 8, background: domCfg?.color ?? '#1B4F8A', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 15, flexShrink: 0 }}>{domCfg?.emoji ?? '📁'}</div>
                            <div style={{ flex: 1, minWidth: 0 }}>
                              <div style={{ fontSize: 13, fontWeight: 800, color: 'var(--navy)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{proj.code} — {proj.nom}</div>
                              <div style={{ fontSize: 10, color: 'var(--muted)', marginTop: 1 }}>{proj.chefProjet} · {proj.dateDebut} → {proj.dateFinPrevue} · {proj.statut}</div>
                            </div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
                              {predecesseurs.length > 0 && (
                                <span style={{ fontSize: 9, padding: '2px 7px', borderRadius: 10, background: '#FFF7ED', color: '#C2410C', fontWeight: 700, border: '1px solid #FED7AA' }}>
                                  ← Dép. {predecesseurs.join(', ')}
                                </span>
                              )}
                              <div className="progress-bar" style={{ width: 80, height: 6 }}>
                                <div className="progress-fill" style={{ width: `${proj.avancement}%` }} />
                              </div>
                              <span style={{ fontSize: 11, fontWeight: 800, color: 'var(--navy)', minWidth: 32 }}>{proj.avancement}%</span>
                            </div>
                          </div>
                          {/* WBS lots */}
                          {wbsNode?.children?.slice(0, 5).map(lot => (
                            <div key={lot.id} style={{ padding: '7px 14px 7px 28px', borderBottom: '1px solid var(--border-2)', display: 'flex', alignItems: 'center', gap: 10 }}>
                              <span style={{ fontSize: 9, fontFamily: 'monospace', color: 'var(--muted)', minWidth: 36 }}>{lot.code}</span>
                              <span style={{ flex: 1, fontSize: 12, color: 'var(--text)', minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{lot.label}</span>
                              <div className="progress-bar" style={{ width: 60, height: 4, flexShrink: 0 }}>
                                <div className="progress-fill" style={{ width: `${lot.avancement}%`, background: lot.statut === 'termine' ? '#16A34A' : lot.statut === 'en_retard' ? '#EF3340' : '#F47920' }} />
                              </div>
                              <span style={{ fontSize: 10, fontWeight: 700, color: 'var(--muted)', minWidth: 30 }}>{lot.avancement}%</span>
                              <span className={pillClass(lot.statut)} style={{ fontSize: 9 }}>{STATUT_LABEL[lot.statut]}</span>
                            </div>
                          ))}
                          {(wbsNode?.children?.length ?? 0) > 5 && (
                            <div style={{ padding: '6px 28px', fontSize: 11, color: 'var(--muted)', borderTop: '1px dashed var(--border-2)' }}>
                              + {(wbsNode!.children!.length - 5)} autres lots — <button className="btn btn-ghost btn-xs" onClick={() => { setViewMode('projet'); setSelectedProjetId(proj.id); }}>Voir WBS complet</button>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </>
                )}
              </div>
            );
          })()}

          {/* ══ VUE PORTEFEUILLE ══ */}
          {viewMode === 'portefeuille' && (
            <div style={{ flex: 1, overflowY: 'auto', padding: 16, display: 'flex', flexDirection: 'column', gap: 12 }}>
              {/* KPIs globaux */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 12 }}>
                {[
                  { label: 'Projets actifs', value: store.projets.filter(p => p.statut === 'en_cours').length, total: store.projets.length, color: '#1B4F8A' },
                  { label: 'Budget total', value: `${(store.projets.reduce((s,p) => s + p.budget, 0)/1000).toFixed(1)} Mrd`, sub: 'FCFA', color: '#F47920' },
                  { label: 'Avancement moyen', value: `${store.projets.length > 0 ? Math.round(store.projets.reduce((s,p) => s + p.avancement,0)/store.projets.length) : 0}%`, sub: 'portefeuille', color: '#16A34A' },
                  { label: 'En retard', value: store.projets.filter(p => p.statut === 'en_retard').length, sub: 'projets', color: '#EF3340' },
                ].map(k => (
                  <div key={k.label} style={{ background: '#fff', borderRadius: 10, border: '1px solid #E5E7EB', borderTop: `3px solid ${k.color}`, padding: '12px 14px' }}>
                    <div style={{ fontSize: 10, fontWeight: 700, color: '#94A3B8', textTransform: 'uppercase', letterSpacing: '0.04em' }}>{k.label}</div>
                    <div style={{ fontSize: 22, fontWeight: 800, color: k.color, marginTop: 4 }}>{k.value}</div>
                    <div style={{ fontSize: 11, color: '#64748B' }}>{'sub' in k ? k.sub : `sur ${k.total} total`}</div>
                  </div>
                ))}
              </div>

              {/* Liste tous les projets */}
              <div style={{ background: '#fff', borderRadius: 10, border: '1px solid #E5E7EB', overflow: 'hidden' }}>
                <div style={{ padding: '10px 14px', borderBottom: '1px solid #F1F5F9', fontSize: 13, fontWeight: 700, color: 'var(--navy)' }}>
                  Tous les projets du portefeuille ({activeWbsData.length})
                </div>
                {activeWbsData.map(proj => {
                  const storeProj = store.projets.find(p => p.id === proj.id);
                  const domCfg = storeProj ? DOMAINE_CFG[storeProj.domaine] : null;
                  return (
                    <div key={proj.id} style={{ padding: '10px 14px', borderBottom: '1px solid #F8FAFC', display: 'flex', alignItems: 'center', gap: 12, cursor: 'pointer' }}
                      onClick={() => { setViewMode('projet'); setSelectedProjetId(proj.id); }}>
                      <div style={{ width: 28, height: 28, borderRadius: 6, background: (domCfg?.color ?? '#1B4F8A') + '20', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 13, flexShrink: 0 }}>
                        {domCfg?.emoji ?? '📁'}
                      </div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--navy)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{proj.label}</div>
                        <div style={{ fontSize: 10, color: '#94A3B8', marginTop: 1 }}>{proj.responsable} · {proj.dateDebut} → {proj.dateFin}</div>
                      </div>
                      <div className="progress-bar" style={{ width: 80, height: 5, flexShrink: 0 }}>
                        <div className="progress-fill" style={{ width: `${proj.avancement}%` }} />
                      </div>
                      <span style={{ fontSize: 11, fontWeight: 800, color: 'var(--navy)', minWidth: 34 }}>{proj.avancement}%</span>
                      <span style={{ fontSize: 10, padding: '2px 8px', borderRadius: 12, background: proj.budgetMrd ? '#EFF6FF' : '#F8FAFC', color: '#1B4F8A', fontWeight: 700 }}>
                        {proj.budgetMrd ? `${proj.budgetMrd.toFixed(1)} Mrd` : '—'}
                      </span>
                      <span className={pillClass(proj.statut)} style={{ fontSize: 9 }}>{STATUT_LABEL[proj.statut]}</span>
                      <span style={{ fontSize: 10, color: '#94A3B8' }}>→ WBS</span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* ══ VUE PROJET ══ */}
          {viewMode === 'projet' && (!showTable ? (
            /* ── TREE VIEW ── */
            <div style={{ flex: 1, overflowY: 'auto' }}>
              {/* Column headers */}
              <div style={{ display: 'flex', alignItems: 'center', padding: '7px 14px', background: 'var(--navy)', borderBottom: '2px solid var(--border)', position: 'sticky', top: 0, zIndex: 10, flexShrink: 0 }}>
                <div style={{ width: 16 }} />
                <div style={{ width: 58, fontSize: 9, fontWeight: 700, color: 'rgba(255,255,255,0.6)', textTransform: 'uppercase', letterSpacing: '0.07em' }}>CODE</div>
                <div style={{ flex: 1, fontSize: 9, fontWeight: 700, color: 'rgba(255,255,255,0.6)', textTransform: 'uppercase', letterSpacing: '0.07em' }}>INTITULÉ</div>
                <div style={{ width: 100, fontSize: 9, fontWeight: 700, color: 'rgba(255,255,255,0.6)', textTransform: 'uppercase', letterSpacing: '0.07em' }}>AVANCEMENT</div>
                <div style={{ width: 160, fontSize: 9, fontWeight: 700, color: 'rgba(255,255,255,0.6)', textTransform: 'uppercase', letterSpacing: '0.07em', marginLeft: 6 }}>ENGAGÉ %</div>
                <div style={{ width: 68, textAlign: 'right', fontSize: 9, fontWeight: 700, color: 'rgba(255,255,255,0.6)', textTransform: 'uppercase', letterSpacing: '0.07em' }}>BUDGET</div>
                <div style={{ width: 90, marginLeft: 8, fontSize: 9, fontWeight: 700, color: 'rgba(255,255,255,0.6)', textTransform: 'uppercase', letterSpacing: '0.07em' }}>STATUT</div>
              </div>

              {viewWbsData.length === 0 ? (
                <div style={{ padding: '40px 24px', textAlign: 'center', color: '#94A3B8', fontSize: 13 }}>
                  Aucun projet dans le portefeuille. Créez un projet depuis le module Portefeuille.
                </div>
              ) : viewWbsData.map(proj => (
                <WBSRow key={proj.id} node={proj} depth={0}
                  expanded={expanded} onToggle={toggle}
                  selected={selected} onSelect={setSelected} />
              ))}
            </div>

          ) : (
            /* ── TABLE VIEW ── */
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
              <div style={{ padding: '8px 14px', background: 'var(--bg-card)', borderBottom: '1px solid var(--border-2)', display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
                {/* Project selector — scope WBS to one project */}
                <select value={selectedProjetId} onChange={e => setSelectedProjetId(e.target.value)}
                  className="form-input" style={{ width: 280, fontSize: 11, fontWeight: selectedProjetId ? 700 : 400 }}>
                  <option value="">— Tous les projets ({activeWbsData.length}) —</option>
                  {activeWbsData.map(p => (
                    <option key={p.id} value={p.id}>{p.code ? `${p.code} — ` : ''}{p.label.replace(/^PRJ[^\s]*\s—\s/, '')}</option>
                  ))}
                </select>
                <input
                  value={searchQ} onChange={e => setSearchQ(e.target.value)}
                  placeholder="Rechercher code ou tâche…"
                  className="form-input"
                  style={{ width: 220, fontSize: 11 }}
                />
                <select value={filterStatut} onChange={e => setFilterStatut(e.target.value as 'tous' | WBSStatut)}
                  className="form-input" style={{ width: 150, fontSize: 11 }}>
                  <option value="tous">Tous statuts</option>
                  <option value="termine">Terminé</option>
                  <option value="en_cours">En cours</option>
                  <option value="non_demarre">Non démarré</option>
                  <option value="en_retard">En retard</option>
                </select>
                <span style={{ fontSize: 11, color: 'var(--muted)', marginLeft: 4 }}>{tableNodes.length} résultats</span>
              </div>

              <div style={{ flex: 1, overflowY: 'auto' }}>
                <table className="tbl">
                  <thead>
                    <tr>
                      {['Code', 'Label', 'Type', 'Responsable', 'Début', 'Fin', 'Avancement', 'Engagé', 'Budget', 'Statut'].map(h => (
                        <th key={h}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {tableNodes.length === 0 && (
                      <tr>
                        <td colSpan={10} style={{ padding: '24px', textAlign: 'center', color: '#94A3B8', fontSize: 13 }}>
                          Aucun élément ne correspond aux critères de filtre.
                        </td>
                      </tr>
                    )}
                    {tableNodes.map(n => (
                      <tr key={n.id} onClick={() => { setSelected(n); setShowTable(false); }} style={{ cursor: 'pointer', background: n.type === 'jalon' ? 'rgba(245,176,0,0.05)' : undefined }}>
                        <td style={{ fontFamily: 'monospace', fontWeight: 700, fontSize: 11, color: 'var(--muted)' }}>{n.code}</td>
                        <td style={{ fontWeight: 500, maxWidth: 220 }}>
                          <div style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={n.label}>
                            {n.type === 'jalon' && <span style={{ marginRight: 4, color: '#D97706' }}>◆</span>}
                            {n.label}
                          </div>
                        </td>
                        <td><span className="pill pill-navy" style={{ fontSize: 9 }}>{TYPE_LABEL[n.type]}</span></td>
                        <td style={{ fontSize: 11, color: 'var(--muted)', maxWidth: 140 }}>
                          <div style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={n.responsable}>{n.responsable}</div>
                        </td>
                        <td style={{ fontSize: 11, whiteSpace: 'nowrap' }}>{n.dateDebut}</td>
                        <td style={{ fontSize: 11, whiteSpace: 'nowrap' }}>{n.dateFin}</td>
                        <td>
                          {n.type !== 'jalon' ? (
                            <div style={{ display: 'flex', alignItems: 'center', gap: 6, minWidth: 80 }}>
                              <div className="progress-bar" style={{ flex: 1 }}>
                                <div className="progress-fill" style={{ width: `${n.avancement}%`, background: STATUT_COLOR[n.statut] }} />
                              </div>
                              <span style={{ fontSize: 10, fontWeight: 700, color: STATUT_COLOR[n.statut], minWidth: 28 }}>{n.avancement}%</span>
                            </div>
                          ) : (
                            <span style={{ fontSize: 10, fontWeight: 700, color: n.avancement === 100 ? 'var(--green)' : '#D97706' }}>
                              {n.avancement === 100 ? '✓' : '—'}
                            </span>
                          )}
                        </td>
                        <td style={{ minWidth: 80 }}><BudgetBadge pct={n.budgetEngagePct} /></td>
                        <td style={{ fontSize: 11, textAlign: 'right', whiteSpace: 'nowrap' }}>{n.budgetMrd ? `${n.budgetMrd.toFixed(1)} Mrd` : '—'}</td>
                        <td><span className={pillClass(n.statut)} style={{ fontSize: 9 }}>{STATUT_LABEL[n.statut]}</span></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          ))}
        </div>

        {/* Detail panel */}
        {viewMode === 'projet' && selected && <DetailPanel node={selected} onClose={() => setSelected(null)} onEdit={openEdit} onAddChild={openAddChild} />}
      </div>

      {/* ── FOOTER ── */}
      <div style={{ padding: '6px 16px', background: 'var(--bg-card)', borderTop: '1px solid var(--border)', display: 'flex', gap: 16, alignItems: 'center', flexShrink: 0 }}>
        {[
          { color: 'var(--green)', label: 'Terminé', count: termines.length },
          { color: 'var(--orange)', label: 'En cours', count: enCours.length },
          { color: 'var(--muted)', label: 'Non démarré', count: taches.filter(n => n.statut === 'non_demarre').length },
          { color: 'var(--red)', label: 'En retard', count: retards.length },
          { color: '#D97706', label: 'Jalons', count: jalons.length },
        ].map(s => (
          <div key={s.label} style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
            <div style={{ width: 7, height: 7, borderRadius: '50%', background: s.color }} />
            <span style={{ fontSize: 10, color: 'var(--muted)' }}>{s.label} : <strong style={{ color: 'var(--text-2)' }}>{s.count}</strong></span>
          </div>
        ))}
        <div style={{ marginLeft: 'auto', fontSize: 10, color: 'var(--muted)' }}>
          {allNodes.length} éléments · {viewWbsData.length} projet(s) affiché(s) · Budget : {viewWbsData.reduce((s, p) => s + (p.budgetMrd ?? 0), 0).toFixed(1)} Mrd FCFA
          {useStoreData && <span style={{ marginLeft: 8, color: '#16A34A', fontWeight: 700 }}>● Données réelles</span>}
        </div>
      </div>

      {/* ── EDIT NODE MODAL ── */}
      {editTarget && (() => {
        const inp: React.CSSProperties = { width: '100%', padding: '7px 10px', borderRadius: 6, border: '1px solid #D1D5DB', fontSize: 12, outline: 'none', boxSizing: 'border-box' as const };
        const lbl: React.CSSProperties = { fontSize: 10, fontWeight: 700, color: '#64748B', textTransform: 'uppercase' as const, letterSpacing: '0.04em', marginBottom: 3, display: 'block' };
        return (
          <>
            <div onClick={() => setEditTarget(null)} style={{ position: 'fixed', inset: 0, zIndex: 400, background: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(2px)' }} />
            <div style={{ position: 'fixed', top: '50%', left: '50%', transform: 'translate(-50%,-50%)', zIndex: 401, background: '#fff', borderRadius: 12, boxShadow: '0 20px 60px rgba(0,0,0,0.25)', width: 440, padding: 24 }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 18 }}>
                <div style={{ fontSize: 15, fontWeight: 800, color: '#1B4F8A' }}>✏ Modifier WBS {editTarget.code}</div>
                <button onClick={() => setEditTarget(null)} aria-label="Fermer" style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 18, color: '#94A3B8' }}>×</button>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                <div><label style={lbl}>Libellé *</label><input style={inp} value={nodeForm.label} onChange={e => setNodeForm(f => ({ ...f, label: e.target.value }))} /></div>
                <div><label style={lbl}>Responsable</label><input style={inp} value={nodeForm.responsable} onChange={e => setNodeForm(f => ({ ...f, responsable: e.target.value }))} /></div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                  <div><label style={lbl}>Date début</label><input type="date" style={inp} value={nodeForm.dateDebut} onChange={e => setNodeForm(f => ({ ...f, dateDebut: e.target.value }))} /></div>
                  <div><label style={lbl}>Date fin</label><input type="date" style={inp} value={nodeForm.dateFin} onChange={e => setNodeForm(f => ({ ...f, dateFin: e.target.value }))} /></div>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                  <div><label style={lbl}>Avancement ({nodeForm.avancement}%)</label><input type="range" min={0} max={100} style={{ width: '100%' }} value={nodeForm.avancement} onChange={e => setNodeForm(f => ({ ...f, avancement: +e.target.value }))} /></div>
                  <div><label style={lbl}>Statut</label>
                    <select style={inp} value={nodeForm.statut} onChange={e => setNodeForm(f => ({ ...f, statut: e.target.value as WBSStatut }))}>
                      <option value="non_demarre">Non démarré</option><option value="en_cours">En cours</option>
                      <option value="termine">Terminé</option><option value="en_retard">En retard</option>
                    </select>
                  </div>
                </div>
                {/* Motif de replanification */}
                <div style={{ padding: '10px 12px', background: '#FFFBEB', border: '1px solid #FDE68A', borderRadius: 7 }}>
                  <label style={{ ...lbl, color: '#92400E' }}>Motif de modification (requis si dates changent)</label>
                  <input style={{ ...inp, borderColor: '#FDE68A' }} value={editMotif} onChange={e => setEditMotif(e.target.value)} placeholder="Ex: retard fournisseur, avenant signé, intempéries…" />
                </div>
              </div>
              <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 18 }}>
                <button onClick={() => { setEditTarget(null); setEditMotif(''); }} style={{ padding: '7px 16px', borderRadius: 6, border: '1px solid #D1D5DB', background: '#fff', fontSize: 12, cursor: 'pointer' }}>Annuler</button>
                <button onClick={saveEdit} disabled={!nodeForm.label.trim()} style={{ padding: '7px 18px', borderRadius: 6, border: 'none', background: nodeForm.label.trim() ? '#1B4F8A' : '#E5E7EB', color: nodeForm.label.trim() ? '#fff' : '#9CA3AF', fontSize: 12, fontWeight: 700, cursor: nodeForm.label.trim() ? 'pointer' : 'not-allowed', opacity: nodeForm.label.trim() ? 1 : 0.5 }}>💾 Enregistrer</button>
              </div>
            </div>
          </>
        );
      })()}

      {/* ── ADD CHILD NODE MODAL ── */}
      {addParentId && (() => {
        const parent = flattenNodes(useStoreData ? storeWbsData : wbsData).find(n => n.id === addParentId);
        const inp: React.CSSProperties = { width: '100%', padding: '7px 10px', borderRadius: 6, border: '1px solid #D1D5DB', fontSize: 12, outline: 'none', boxSizing: 'border-box' as const };
        const lbl: React.CSSProperties = { fontSize: 10, fontWeight: 700, color: '#64748B', textTransform: 'uppercase' as const, letterSpacing: '0.04em', marginBottom: 3, display: 'block' };
        return (
          <>
            <div onClick={() => setAddParentId(null)} style={{ position: 'fixed', inset: 0, zIndex: 400, background: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(2px)' }} />
            <div style={{ position: 'fixed', top: '50%', left: '50%', transform: 'translate(-50%,-50%)', zIndex: 401, background: '#fff', borderRadius: 12, boxShadow: '0 20px 60px rgba(0,0,0,0.25)', width: 440, padding: 24 }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
                <div style={{ fontSize: 15, fontWeight: 800, color: '#1B4F8A' }}>+ Ajouter sous-élément</div>
                <button onClick={() => setAddParentId(null)} aria-label="Fermer" style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 18, color: '#94A3B8' }}>×</button>
              </div>
              <div style={{ fontSize: 11, color: '#64748B', marginBottom: 16 }}>Parent : WBS {parent?.code} — {parent?.label}</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                <div><label style={lbl}>Libellé *</label><input style={inp} value={nodeForm.label} onChange={e => setNodeForm(f => ({ ...f, label: e.target.value }))} placeholder="Ex: Génie Civil fondations" /></div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                  <div><label style={lbl}>Type</label>
                    <select style={inp} value={nodeForm.type} onChange={e => setNodeForm(f => ({ ...f, type: e.target.value as WBSType }))}>
                      <option value="lot">Lot</option><option value="tache">Tâche</option><option value="jalon">Jalon</option>
                    </select>
                  </div>
                  <div><label style={lbl}>Statut</label>
                    <select style={inp} value={nodeForm.statut} onChange={e => setNodeForm(f => ({ ...f, statut: e.target.value as WBSStatut }))}>
                      <option value="non_demarre">Non démarré</option><option value="en_cours">En cours</option>
                      <option value="termine">Terminé</option><option value="en_retard">En retard</option>
                    </select>
                  </div>
                </div>
                <div><label style={lbl}>Responsable</label><input style={inp} value={nodeForm.responsable} onChange={e => setNodeForm(f => ({ ...f, responsable: e.target.value }))} /></div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                  <div><label style={lbl}>Date début</label><input type="date" style={inp} value={nodeForm.dateDebut} onChange={e => setNodeForm(f => ({ ...f, dateDebut: e.target.value }))} /></div>
                  <div><label style={lbl}>Date fin</label><input type="date" style={inp} value={nodeForm.dateFin} onChange={e => setNodeForm(f => ({ ...f, dateFin: e.target.value }))} /></div>
                </div>
              </div>
              <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 18 }}>
                <button onClick={() => setAddParentId(null)} style={{ padding: '7px 16px', borderRadius: 6, border: '1px solid #D1D5DB', background: '#fff', fontSize: 12, cursor: 'pointer' }}>Annuler</button>
                <button onClick={saveAddChild} disabled={!nodeForm.label.trim()} style={{ padding: '7px 18px', borderRadius: 6, border: 'none', background: nodeForm.label.trim() ? '#1B4F8A' : '#E5E7EB', color: nodeForm.label.trim() ? '#fff' : '#9CA3AF', fontSize: 12, fontWeight: 700, cursor: nodeForm.label.trim() ? 'pointer' : 'not-allowed', opacity: nodeForm.label.trim() ? 1 : 0.5 }}>+ Ajouter</button>
              </div>
            </div>
          </>
        );
      })()}

      {/* ── HISTORIQUE REPLANIFICATION ── */}
      {showHistory && (
        <>
          <div onClick={() => setShowHistory(false)} style={{ position: 'fixed', inset: 0, zIndex: 400, background: 'rgba(0,0,0,0.45)', backdropFilter: 'blur(2px)' }} />
          <div style={{ position: 'fixed', top: '50%', left: '50%', transform: 'translate(-50%,-50%)', zIndex: 401, background: '#fff', borderRadius: 14, boxShadow: '0 20px 60px rgba(0,0,0,0.25)', width: 680, maxHeight: '80vh', display: 'flex', flexDirection: 'column' }}>
            <div style={{ padding: '14px 20px', background: 'var(--navy)', borderRadius: '14px 14px 0 0', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div style={{ fontSize: 15, fontWeight: 800, color: '#fff' }}>🕐 Historique des replanifications</div>
              <button onClick={() => setShowHistory(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 20, color: 'rgba(255,255,255,0.7)' }}>×</button>
            </div>
            <div style={{ padding: 16, overflowY: 'auto', flex: 1 }}>
              {planningLog.length === 0 ? (
                <div style={{ textAlign: 'center', padding: 32, color: '#94A3B8', fontSize: 13 }}>
                  Aucune modification de planning enregistrée.<br />
                  <span style={{ fontSize: 11 }}>Les changements de dates, avancement et statut sont tracés ici.</span>
                </div>
              ) : (
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
                  <thead>
                    <tr style={{ background: '#F8FAFC', color: '#94A3B8', fontSize: 10, textTransform: 'uppercase' }}>
                      {['Date', 'Élément WBS', 'Champ', 'Ancienne valeur', 'Nouvelle valeur', 'Motif', 'Par'].map(h => (
                        <th key={h} style={{ padding: '8px 10px', textAlign: 'left', fontWeight: 700 }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {planningLog.map(c => (
                      <tr key={c.id} style={{ borderTop: '1px solid #F1F5F9' }}>
                        <td style={{ padding: '8px 10px', fontSize: 10, color: '#64748B', whiteSpace: 'nowrap' }}>{c.changedAt}</td>
                        <td style={{ padding: '8px 10px' }}>
                          <div style={{ fontWeight: 700, color: '#1B4F8A', fontSize: 11 }}>{c.nodeCode}</div>
                          <div style={{ fontSize: 10, color: '#94A3B8', maxWidth: 160, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={c.nodeLabel}>{c.nodeLabel}</div>
                        </td>
                        <td style={{ padding: '8px 10px', fontWeight: 600 }}>{c.field}</td>
                        <td style={{ padding: '8px 10px', color: '#DC2626' }}>{c.oldValue}</td>
                        <td style={{ padding: '8px 10px', color: '#16A34A', fontWeight: 700 }}>{c.newValue}</td>
                        <td style={{ padding: '8px 10px', maxWidth: 160, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontStyle: c.motif === '—' ? 'italic' : 'normal', color: c.motif === '—' ? '#94A3B8' : 'inherit' }} title={c.motif}>{c.motif}</td>
                        <td style={{ padding: '8px 10px', fontSize: 10, color: '#64748B' }}>{c.changedBy}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
            <div style={{ padding: '10px 20px', borderTop: '1px solid #F1F5F9', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontSize: 11, color: '#94A3B8' }}>{planningLog.length} modification(s) enregistrée(s)</span>
              {planningLog.length > 0 && <button onClick={() => { if (confirm('Effacer tout l\'historique ?')) setPlanningLog([]); }} style={{ padding: '5px 12px', borderRadius: 6, border: '1px solid #FECACA', color: '#DC2626', background: '#fff', fontSize: 11, cursor: 'pointer' }}>Vider l&apos;historique</button>}
            </div>
          </div>
        </>
      )}

      {/* ── TOASTS ── */}
      <div style={{ position: 'fixed', bottom: 24, right: 24, display: 'flex', flexDirection: 'column', gap: 8, zIndex: 9999, pointerEvents: 'none' }}>
        {toasts.map(t => (
          <div key={t.id} style={{
            padding: '10px 16px',
            background: t.type === 'ok' ? '#16A34A' : 'var(--navy)',
            color: '#fff',
            borderRadius: 8,
            fontSize: 12,
            fontWeight: 600,
            boxShadow: '0 4px 16px rgba(0,0,0,0.18)',
            maxWidth: 340,
            animation: 'fadeInUp 0.25s ease',
          }}>
            {t.type === 'ok' ? '✓ ' : 'ℹ '}{t.message}
          </div>
        ))}
      </div>
    </div>
  );
}

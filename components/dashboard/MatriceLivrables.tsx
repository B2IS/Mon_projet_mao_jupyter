'use client';
/**
 * MatriceLivrables — grille éditable multi-projets/multi-tâches
 * - Colonnes : Livrable, Type, Propriétaire, Valideur, Date requise, Date livraison, Priorité, Statut, Version, Décision, Commentaire
 * - Édition inline cellule par cellule
 * - Historique des versions par livrable (modal)
 * - Mise en exergue des dernières décisions
 * - Export Excel (xlsx) — supporte des centaines de colonnes et milliers de lignes
 */
import { useState, useMemo, useCallback, useRef } from 'react';
import {
  useProjectStore,
  type Livrable, type LivrableDecision,
  type TypeLivrable, type PrioriteLivrable, type StatutLivrable,
} from '@/lib/projectStore';
import { useAuth } from '@/lib/authStore';
import toast from 'react-hot-toast';
import {
  FileSpreadsheet, Download, History, Plus, Trash2,
  ChevronDown, ChevronUp, MessageSquarePlus, Filter,
  AlertTriangle, CheckCircle2, Clock, XCircle, Search,
} from 'lucide-react';

// ── Palette ──────────────────────────────────────────────────────────────────
const NAVY   = '#1B4F8A';
const GREEN  = '#059669';
const AMBER  = '#D97706';
const RED    = '#DC2626';
const PURPLE = '#7C3AED';
const SLATE  = '#64748B';

const STATUT_CFG: Record<StatutLivrable, { label: string; color: string; bg: string; Icon: React.ElementType }> = {
  Nouveau:   { label: 'Nouveau',   color: SLATE,  bg: '#F1F5F9', Icon: Clock         },
  En_cours:  { label: 'En cours',  color: AMBER,  bg: '#FFFBEB', Icon: Clock         },
  Termine:   { label: 'Terminé',   color: GREEN,  bg: '#F0FDF4', Icon: CheckCircle2  },
  Rejete:    { label: 'Rejeté',    color: RED,    bg: '#FEF2F2', Icon: XCircle       },
};

const PRIORITE_CFG: Record<PrioriteLivrable, { label: string; color: string }> = {
  Elevee:  { label: 'Élevée',  color: RED    },
  Moyenne: { label: 'Moyenne', color: AMBER  },
  Faible:  { label: 'Faible',  color: GREEN  },
};

const TYPES_LIVRABLE: TypeLivrable[] = ['Bordereau', 'Plan', 'Rapport', 'PV', 'Contrat', 'Note', 'General'];
const STATUTS: StatutLivrable[]      = ['Nouveau', 'En_cours', 'Termine', 'Rejete'];
const PRIORITES: PrioriteLivrable[]  = ['Elevee', 'Moyenne', 'Faible'];

// ── Row model ─────────────────────────────────────────────────────────────────
interface LivrableRow {
  projetId:   string;
  projetNom:  string;
  projetCode: string;
  tacheId:    string;
  tacheNom:   string;
  livrable:   Livrable;
}

// ── Helpers ───────────────────────────────────────────────────────────────────
function today(): string { return new Date().toISOString().slice(0, 10); }
function fmtDate(d?: string): string { return d ? new Date(d).toLocaleDateString('fr-FR') : '—'; }

function newLivrable(auteur: string): Livrable {
  return {
    id: `liv-${Date.now().toString(36)}`,
    nom: '',
    typeLivrable: 'General',
    proprietaireId: '',
    proprietaireNom: '',
    valideurNom: '',
    dateRequise: today(),
    dateLivraison: undefined,
    priorite: 'Moyenne',
    statut: 'Nouveau',
    piecesJointes: [],
    dateCreation: today(),
    creePar: auteur,
    version: 1,
    historique: [],
    decisions: [],
    commentaire: '',
  };
}

// ── Export Excel ──────────────────────────────────────────────────────────────
async function exportExcel(rows: LivrableRow[], filename: string) {
  const XLSX = await import('xlsx');
  const headers = [
    'Code Projet', 'Projet', 'Tâche', 'Réf. Livrable', 'Nom / Intitulé',
    'Type', 'Propriétaire', 'Valideur', 'Date requise', 'Date livraison',
    'Priorité', 'Statut', 'Version', 'Décision récente', 'Commentaire',
    'Créé le', 'Créé par',
  ];
  const data = rows.map(r => {
    const l = r.livrable;
    const lastDecision = l.decisions.at(-1);
    return [
      r.projetCode, r.projetNom, r.tacheNom,
      l.id, l.nom,
      l.typeLivrable, l.proprietaireNom, l.valideurNom ?? '',
      l.dateRequise, l.dateLivraison ?? '',
      PRIORITE_CFG[l.priorite].label, STATUT_CFG[l.statut].label,
      `v${l.version}`,
      lastDecision ? `[${lastDecision.date}] ${lastDecision.texte}` : '',
      l.commentaire ?? '',
      l.dateCreation, l.creePar,
    ];
  });

  const ws = XLSX.utils.aoa_to_sheet([headers, ...data]);
  // Column widths
  ws['!cols'] = headers.map((_, i) => ({ wch: [12, 35, 25, 16, 40, 12, 22, 22, 14, 14, 10, 12, 8, 50, 40, 12, 20][i] ?? 18 }));
  // Header style via cell format
  headers.forEach((_, ci) => {
    const ref = XLSX.utils.encode_cell({ r: 0, c: ci });
    if (ws[ref]) ws[ref].s = { font: { bold: true }, fill: { fgColor: { rgb: '1B4F8A' } }, font_color: { rgb: 'FFFFFF' } };
  });

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Livrables');

  // Feuille Historique (toutes versions)
  const hHeaders = ['Livrable', 'Version', 'Date modification', 'Modifié par', 'Commentaire'];
  const hData: (string | number)[][] = [];
  rows.forEach(r => {
    r.livrable.historique.forEach(v => {
      hData.push([r.livrable.nom, `v${v.version}`, v.dateModification, v.modifiePar, v.commentaire ?? '']);
    });
  });
  if (hData.length) {
    const wsH = XLSX.utils.aoa_to_sheet([hHeaders, ...hData]);
    wsH['!cols'] = [{ wch: 40 }, { wch: 8 }, { wch: 16 }, { wch: 22 }, { wch: 50 }];
    XLSX.utils.book_append_sheet(wb, wsH, 'Historique versions');
  }

  // Feuille Décisions
  const dHeaders = ['Livrable', 'Date', 'Auteur', 'Décision', 'Impact'];
  const dData: (string | number)[][] = [];
  rows.forEach(r => {
    r.livrable.decisions.forEach(d => {
      dData.push([r.livrable.nom, d.date, d.auteur, d.texte, d.impact]);
    });
  });
  if (dData.length) {
    const wsD = XLSX.utils.aoa_to_sheet([dHeaders, ...dData]);
    wsD['!cols'] = [{ wch: 40 }, { wch: 12 }, { wch: 22 }, { wch: 60 }, { wch: 12 }];
    XLSX.utils.book_append_sheet(wb, wsD, 'Décisions & arbitrages');
  }

  XLSX.writeFile(wb, filename);
}

// ═══════════════════════════════════════════════════════════════════════════════
// COMPOSANT PRINCIPAL
// ═══════════════════════════════════════════════════════════════════════════════
export default function MatriceLivrables() {
  const store = useProjectStore();
  const { user } = useAuth();
  const auteur = user ? `${user.prenom ?? ''} ${user.nom ?? ''}`.trim() : 'Inconnu';
  const canEdit = user && ['ADMIN', 'CHEF_PROJ', 'PMO', 'CHEF_DEPT', 'INGENIEUR', 'CONTROLEUR'].includes(user.role);

  // ── Filtres ────────────────────────────────────────────────────────────────
  const [filterProjet, setFilterProjet] = useState('');
  const [filterStatut, setFilterStatut] = useState<StatutLivrable | ''>('');
  const [filterPriorite, setFilterPriorite] = useState<PrioriteLivrable | ''>('');
  const [searchQ, setSearchQ] = useState('');
  const [showFilters, setShowFilters] = useState(false);

  // ── Édition inline ─────────────────────────────────────────────────────────
  const [editCell, setEditCell] = useState<{ livrableId: string; field: string } | null>(null);
  const inputRef = useRef<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>(null);

  // ── Modales ────────────────────────────────────────────────────────────────
  const [histModal, setHistModal] = useState<{ row: LivrableRow } | null>(null);
  const [decisionModal, setDecisionModal] = useState<{ row: LivrableRow } | null>(null);
  const [newDecision, setNewDecision] = useState({ texte: '', impact: 'Informatif' as LivrableDecision['impact'] });
  const [addRow, setAddRow] = useState<{ projetId: string; tacheId: string } | null>(null);
  const [newLiv, setNewLiv] = useState<Livrable | null>(null);

  // ── Lignes calculées ────────────────────────────────────────────────────────
  const rows: LivrableRow[] = useMemo(() => {
    const result: LivrableRow[] = [];
    for (const p of store.projets) {
      if (filterProjet && p.id !== filterProjet) continue;
      for (const t of p.taches) {
        for (const l of (t.livrables ?? [])) {
          if (filterStatut   && l.statut   !== filterStatut)   continue;
          if (filterPriorite && l.priorite !== filterPriorite) continue;
          if (searchQ) {
            const q = searchQ.toLowerCase();
            if (!l.nom.toLowerCase().includes(q) && !t.nom.toLowerCase().includes(q) && !p.nom.toLowerCase().includes(q)) continue;
          }
          result.push({ projetId: p.id, projetNom: p.nom, projetCode: p.code, tacheId: t.id, tacheNom: t.nom, livrable: l });
        }
      }
    }
    return result;
  }, [store.projets, filterProjet, filterStatut, filterPriorite, searchQ]);

  // ── Sauvegarde d'une modification ─────────────────────────────────────────
  const updateLivrable = useCallback((row: LivrableRow, patch: Partial<Livrable>) => {
    const old = row.livrable;
    // Snapshot de l'ancienne version dans l'historique
    const version: import('@/lib/projectStore').LivrableVersion = {
      version: old.version,
      dateModification: today(),
      modifiePar: auteur,
      champs: { nom: old.nom, typeLivrable: old.typeLivrable, statut: old.statut, priorite: old.priorite,
        proprietaireNom: old.proprietaireNom, valideurNom: old.valideurNom,
        dateRequise: old.dateRequise, dateLivraison: old.dateLivraison, commentaire: old.commentaire },
      commentaire: undefined,
    };
    const updated: Livrable = {
      ...old,
      ...patch,
      version: old.version + 1,
      historique: [...old.historique, version],
    };
    store.updateLivrable(row.projetId, row.tacheId, old.id, updated);
    toast.success(`v${updated.version} sauvegardée`);
  }, [store, auteur]);

  // ── Suppression ───────────────────────────────────────────────────────────
  const deleteLivrable = useCallback((row: LivrableRow) => {
    if (!confirm(`Supprimer « ${row.livrable.nom || 'ce livrable'} » ?`)) return;
    store.deleteLivrable(row.projetId, row.tacheId, row.livrable.id);
    toast.success('Livrable supprimé');
  }, [store]);

  // ── Ajouter une décision ──────────────────────────────────────────────────
  const addDecision = useCallback(() => {
    if (!decisionModal || !newDecision.texte.trim()) return;
    const row = decisionModal.row;
    const d: LivrableDecision = {
      id: `dec-${Date.now().toString(36)}`,
      date: today(),
      auteur,
      texte: newDecision.texte.trim(),
      impact: newDecision.impact,
    };
    const updated: Livrable = {
      ...row.livrable,
      decisions: [...row.livrable.decisions, d],
      version: row.livrable.version + 1,
      historique: [...row.livrable.historique, {
        version: row.livrable.version,
        dateModification: today(),
        modifiePar: auteur,
        champs: {},
        commentaire: `Décision ajoutée : ${d.texte}`,
      }],
    };
    store.updateLivrable(row.projetId, row.tacheId, row.livrable.id, updated);
    setNewDecision({ texte: '', impact: 'Informatif' });
    setDecisionModal(prev => prev ? { row: { ...prev.row, livrable: updated } } : null);
    toast.success('Décision enregistrée');
  }, [decisionModal, newDecision, store, auteur]);

  // ── Ajouter un livrable ───────────────────────────────────────────────────
  const saveLivrable = useCallback(() => {
    if (!addRow || !newLiv || !newLiv.nom.trim()) { toast.error('Nom requis'); return; }
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { id: _id, dateCreation: _dc, ...livrableSansId } = newLiv;
    store.addLivrable(addRow.projetId, addRow.tacheId, livrableSansId);
    setAddRow(null); setNewLiv(null);
    toast.success('Livrable ajouté');
  }, [addRow, newLiv, store]);

  // ── Cell editor ───────────────────────────────────────────────────────────
  function CellEdit({ row, field, value, type = 'text', options }: {
    row: LivrableRow; field: string; value: string;
    type?: 'text' | 'select' | 'date' | 'textarea';
    options?: { value: string; label: string }[];
  }) {
    const [val, setVal] = useState(value);
    const save = () => {
      if (val !== value) updateLivrable(row, { [field]: val } as Partial<Livrable>);
      setEditCell(null);
    };
    if (type === 'select' && options) {
      return (
        <select autoFocus value={val} onChange={e => setVal(e.target.value)} onBlur={save}
          style={{ width: '100%', padding: '4px 6px', border: '2px solid #3B82F6', borderRadius: 4, fontSize: 11, background: '#fff' }}>
          {options.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
        </select>
      );
    }
    if (type === 'textarea') {
      return (
        <textarea autoFocus value={val} onChange={e => setVal(e.target.value)} onBlur={save}
          style={{ width: '100%', padding: '4px 6px', border: '2px solid #3B82F6', borderRadius: 4, fontSize: 11, resize: 'vertical', minHeight: 60 }} />
      );
    }
    return (
      <input autoFocus type={type === 'date' ? 'date' : 'text'} value={val}
        onChange={e => setVal(e.target.value)} onBlur={save}
        onKeyDown={e => { if (e.key === 'Enter') save(); if (e.key === 'Escape') setEditCell(null); }}
        style={{ width: '100%', padding: '4px 6px', border: '2px solid #3B82F6', borderRadius: 4, fontSize: 11 }} />
    );
  }

  const isEditing = (livrableId: string, field: string) =>
    editCell?.livrableId === livrableId && editCell?.field === field;

  function cellClick(livrableId: string, field: string) {
    if (!canEdit) return;
    setEditCell({ livrableId, field });
  }

  const cellStyle: React.CSSProperties = {
    padding: '6px 10px', borderRight: '1px solid #E2E8F0', whiteSpace: 'nowrap',
    overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: 200, cursor: canEdit ? 'pointer' : 'default',
    fontSize: 12, color: '#1E293B',
  };

  const hasRecent = (l: Livrable) => {
    const last = l.decisions.at(-1);
    if (!last) return false;
    const diff = (Date.now() - new Date(last.date).getTime()) / 86400000;
    return diff <= 7;
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 0, height: '100%' }}>

      {/* ── Barre d'outils ─────────────────────────────────────────────── */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px 16px', background: '#fff', borderBottom: '1px solid #E2E8F0', flexWrap: 'wrap' }}>
        <FileSpreadsheet size={18} color={NAVY} />
        <span style={{ fontWeight: 800, fontSize: 14, color: '#0F172A' }}>Matrice Livrables</span>
        <span style={{ fontSize: 11, color: SLATE, background: '#F1F5F9', padding: '2px 8px', borderRadius: 20 }}>
          {rows.length} livrable{rows.length !== 1 ? 's' : ''}
        </span>

        {/* Recherche */}
        <div style={{ position: 'relative', flex: '1 1 180px', minWidth: 150 }}>
          <Search size={12} style={{ position: 'absolute', left: 8, top: '50%', transform: 'translateY(-50%)', color: SLATE }} />
          <input value={searchQ} onChange={e => setSearchQ(e.target.value)} placeholder="Rechercher…"
            style={{ width: '100%', paddingLeft: 28, paddingRight: 8, height: 30, border: '1px solid #E2E8F0', borderRadius: 6, fontSize: 12 }} />
        </div>

        <button onClick={() => setShowFilters(f => !f)}
          style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '5px 10px', border: '1px solid #E2E8F0', borderRadius: 6, background: showFilters ? '#EFF6FF' : '#fff', color: showFilters ? '#1D4ED8' : SLATE, fontSize: 12, cursor: 'pointer', fontFamily: 'inherit' }}>
          <Filter size={12} /> Filtres {(filterStatut || filterPriorite || filterProjet) ? '●' : ''}
        </button>

        {canEdit && (
          <button onClick={() => {
            const first = store.projets[0];
            if (!first) return;
            const tache = first.taches[0];
            if (!tache) return;
            setAddRow({ projetId: first.id, tacheId: tache.id });
            setNewLiv(newLivrable(auteur));
          }}
            style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '5px 10px', border: 'none', borderRadius: 6, background: NAVY, color: '#fff', fontSize: 12, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' }}>
            <Plus size={12} /> Nouveau livrable
          </button>
        )}

        <button onClick={() => exportExcel(rows, `livrables-${today()}.xlsx`)}
          style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '5px 10px', border: '1px solid #10B981', borderRadius: 6, background: '#F0FDF4', color: '#065F46', fontSize: 12, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' }}>
          <Download size={12} /> Export Excel
        </button>
      </div>

      {/* ── Filtres ────────────────────────────────────────────────────────── */}
      {showFilters && (
        <div style={{ display: 'flex', gap: 10, padding: '8px 16px', background: '#F8FAFC', borderBottom: '1px solid #E2E8F0', flexWrap: 'wrap' }}>
          <select value={filterProjet} onChange={e => setFilterProjet(e.target.value)}
            style={{ padding: '4px 8px', border: '1px solid #CBD5E1', borderRadius: 6, fontSize: 12, minWidth: 180 }}>
            <option value=''>Tous les projets</option>
            {store.projets.map(p => <option key={p.id} value={p.id}>{p.code} — {p.nom.slice(0, 35)}</option>)}
          </select>
          <select value={filterStatut} onChange={e => setFilterStatut(e.target.value as StatutLivrable | '')}
            style={{ padding: '4px 8px', border: '1px solid #CBD5E1', borderRadius: 6, fontSize: 12 }}>
            <option value=''>Tous statuts</option>
            {STATUTS.map(s => <option key={s} value={s}>{STATUT_CFG[s].label}</option>)}
          </select>
          <select value={filterPriorite} onChange={e => setFilterPriorite(e.target.value as PrioriteLivrable | '')}
            style={{ padding: '4px 8px', border: '1px solid #CBD5E1', borderRadius: 6, fontSize: 12 }}>
            <option value=''>Toutes priorités</option>
            {PRIORITES.map(p => <option key={p} value={p}>{PRIORITE_CFG[p].label}</option>)}
          </select>
          <button onClick={() => { setFilterProjet(''); setFilterStatut(''); setFilterPriorite(''); setSearchQ(''); }}
            style={{ padding: '4px 10px', border: '1px solid #E2E8F0', borderRadius: 6, fontSize: 11, cursor: 'pointer', fontFamily: 'inherit', color: SLATE }}>
            Réinitialiser
          </button>
        </div>
      )}

      {/* ── Grille ─────────────────────────────────────────────────────────── */}
      <div style={{ flex: 1, overflowX: 'auto', overflowY: 'auto' }}>
        {rows.length === 0 ? (
          <div style={{ padding: 60, textAlign: 'center', color: SLATE }}>
            <FileSpreadsheet size={40} style={{ margin: '0 auto 12px', display: 'block', color: '#CBD5E1' }} />
            <div style={{ fontWeight: 600 }}>Aucun livrable</div>
            <div style={{ fontSize: 12, marginTop: 4 }}>Ajoutez des livrables depuis les tâches de vos projets.</div>
          </div>
        ) : (
          <table style={{ borderCollapse: 'collapse', width: 'max-content', minWidth: '100%' }}>
            <thead>
              <tr style={{ background: NAVY, color: '#fff', position: 'sticky', top: 0, zIndex: 2 }}>
                {['Projet', 'Tâche', 'Livrable', 'Type', 'Propriétaire', 'Valideur', 'Date requise', 'Livraison', 'Priorité', 'Statut', 'Version', 'Décision récente', 'Commentaire', 'Actions'].map(h => (
                  <th key={h} style={{ padding: '8px 12px', fontWeight: 700, fontSize: 11, letterSpacing: 0.3, whiteSpace: 'nowrap', borderRight: '1px solid rgba(255,255,255,0.15)', textAlign: 'left' }}>
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((row, ri) => {
                const l = row.livrable;
                const st = STATUT_CFG[l.statut];
                const pr = PRIORITE_CFG[l.priorite];
                const lastDec = l.decisions.at(-1);
                const recent = hasRecent(l);
                const rowBg = ri % 2 === 0 ? '#fff' : '#F8FAFC';

                return (
                  <tr key={`${row.projetId}-${row.tacheId}-${l.id}`}
                    style={{ background: recent ? '#FFFBEB' : rowBg, borderBottom: '1px solid #E2E8F0' }}>

                    {/* Projet */}
                    <td style={{ ...cellStyle, maxWidth: 160 }}>
                      <div style={{ fontSize: 10, color: SLATE }}>{row.projetCode}</div>
                      <div style={{ fontWeight: 600, fontSize: 11 }}>{row.projetNom.slice(0, 28)}{row.projetNom.length > 28 ? '…' : ''}</div>
                    </td>

                    {/* Tâche */}
                    <td style={{ ...cellStyle, maxWidth: 150, fontSize: 11, color: '#475569' }}>
                      {row.tacheNom.slice(0, 30)}{row.tacheNom.length > 30 ? '…' : ''}
                    </td>

                    {/* Nom livrable */}
                    <td style={{ ...cellStyle, maxWidth: 220 }} onClick={() => cellClick(l.id, 'nom')}>
                      {isEditing(l.id, 'nom')
                        ? <CellEdit row={row} field='nom' value={l.nom} />
                        : <span title={l.nom} style={{ fontWeight: 600 }}>{l.nom || <span style={{ color: '#CBD5E1', fontStyle: 'italic' }}>Cliquer pour saisir</span>}</span>
                      }
                    </td>

                    {/* Type */}
                    <td style={{ ...cellStyle }} onClick={() => cellClick(l.id, 'typeLivrable')}>
                      {isEditing(l.id, 'typeLivrable')
                        ? <CellEdit row={row} field='typeLivrable' value={l.typeLivrable} type='select'
                            options={TYPES_LIVRABLE.map(t => ({ value: t, label: t }))} />
                        : <span style={{ fontSize: 11, padding: '2px 6px', borderRadius: 4, background: '#EFF6FF', color: NAVY, fontWeight: 600 }}>{l.typeLivrable}</span>
                      }
                    </td>

                    {/* Propriétaire */}
                    <td style={{ ...cellStyle }} onClick={() => cellClick(l.id, 'proprietaireNom')}>
                      {isEditing(l.id, 'proprietaireNom')
                        ? <CellEdit row={row} field='proprietaireNom' value={l.proprietaireNom} />
                        : l.proprietaireNom || '—'
                      }
                    </td>

                    {/* Valideur */}
                    <td style={{ ...cellStyle }} onClick={() => cellClick(l.id, 'valideurNom')}>
                      {isEditing(l.id, 'valideurNom')
                        ? <CellEdit row={row} field='valideurNom' value={l.valideurNom ?? ''} />
                        : l.valideurNom || '—'
                      }
                    </td>

                    {/* Date requise */}
                    <td style={{ ...cellStyle }} onClick={() => cellClick(l.id, 'dateRequise')}>
                      {isEditing(l.id, 'dateRequise')
                        ? <CellEdit row={row} field='dateRequise' value={l.dateRequise} type='date' />
                        : fmtDate(l.dateRequise)
                      }
                    </td>

                    {/* Date livraison */}
                    <td style={{ ...cellStyle }} onClick={() => cellClick(l.id, 'dateLivraison')}>
                      {isEditing(l.id, 'dateLivraison')
                        ? <CellEdit row={row} field='dateLivraison' value={l.dateLivraison ?? ''} type='date' />
                        : <span style={{ color: l.dateLivraison ? GREEN : '#CBD5E1' }}>{l.dateLivraison ? fmtDate(l.dateLivraison) : '—'}</span>
                      }
                    </td>

                    {/* Priorité */}
                    <td style={{ ...cellStyle }} onClick={() => cellClick(l.id, 'priorite')}>
                      {isEditing(l.id, 'priorite')
                        ? <CellEdit row={row} field='priorite' value={l.priorite} type='select'
                            options={PRIORITES.map(p => ({ value: p, label: PRIORITE_CFG[p].label }))} />
                        : <span style={{ fontWeight: 700, fontSize: 11, color: pr.color }}>▲ {pr.label}</span>
                      }
                    </td>

                    {/* Statut */}
                    <td style={{ ...cellStyle }} onClick={() => cellClick(l.id, 'statut')}>
                      {isEditing(l.id, 'statut')
                        ? <CellEdit row={row} field='statut' value={l.statut} type='select'
                            options={STATUTS.map(s => ({ value: s, label: STATUT_CFG[s].label }))} />
                        : (
                          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 11, fontWeight: 600,
                            color: st.color, background: st.bg, padding: '3px 8px', borderRadius: 20 }}>
                            <st.Icon size={10} /> {st.label}
                          </span>
                        )
                      }
                    </td>

                    {/* Version */}
                    <td style={{ ...cellStyle, textAlign: 'center' }}>
                      <span style={{ fontSize: 11, fontWeight: 700, color: PURPLE }}>v{l.version}</span>
                      {l.historique.length > 0 && (
                        <span style={{ fontSize: 9, color: SLATE, display: 'block' }}>{l.historique.length} modif.</span>
                      )}
                    </td>

                    {/* Décision récente */}
                    <td style={{ ...cellStyle, maxWidth: 200 }}>
                      {lastDec ? (
                        <div>
                          {recent && (
                            <span style={{ fontSize: 9, fontWeight: 700, color: AMBER, background: '#FFFBEB', padding: '1px 5px', borderRadius: 3, marginBottom: 2, display: 'inline-block' }}>
                              ★ Récente
                            </span>
                          )}
                          <div style={{ fontSize: 11, color: lastDec.impact === 'Majeur' ? RED : lastDec.impact === 'Mineur' ? AMBER : SLATE }}>
                            {lastDec.texte.slice(0, 40)}{lastDec.texte.length > 40 ? '…' : ''}
                          </div>
                          <div style={{ fontSize: 10, color: SLATE }}>{fmtDate(lastDec.date)} · {lastDec.auteur}</div>
                        </div>
                      ) : <span style={{ color: '#CBD5E1', fontSize: 11 }}>—</span>}
                    </td>

                    {/* Commentaire */}
                    <td style={{ ...cellStyle, maxWidth: 180 }} onClick={() => cellClick(l.id, 'commentaire')}>
                      {isEditing(l.id, 'commentaire')
                        ? <CellEdit row={row} field='commentaire' value={l.commentaire ?? ''} type='textarea' />
                        : <span style={{ fontSize: 11, color: SLATE }}>{l.commentaire ? l.commentaire.slice(0, 35) + (l.commentaire.length > 35 ? '…' : '') : '—'}</span>
                      }
                    </td>

                    {/* Actions */}
                    <td style={{ padding: '4px 8px', borderRight: '1px solid #E2E8F0', whiteSpace: 'nowrap' }}>
                      <div style={{ display: 'flex', gap: 4 }}>
                        <button title="Historique versions" onClick={() => setHistModal({ row })}
                          style={{ background: '#EDE9FE', border: 'none', borderRadius: 5, padding: '4px 6px', cursor: 'pointer', color: PURPLE }}>
                          <History size={12} />
                        </button>
                        <button title="Ajouter décision" onClick={() => setDecisionModal({ row })}
                          style={{ background: '#FFFBEB', border: 'none', borderRadius: 5, padding: '4px 6px', cursor: 'pointer', color: AMBER }}>
                          <MessageSquarePlus size={12} />
                        </button>
                        {canEdit && (
                          <button title="Supprimer" onClick={() => deleteLivrable(row)}
                            style={{ background: '#FEF2F2', border: 'none', borderRadius: 5, padding: '4px 6px', cursor: 'pointer', color: RED }}>
                            <Trash2 size={12} />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      {/* ── MODAL : Historique des versions ─────────────────────────────── */}
      {histModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
          <div style={{ background: '#fff', borderRadius: 12, width: '100%', maxWidth: 680, maxHeight: '80vh', display: 'flex', flexDirection: 'column', boxShadow: '0 20px 60px rgba(0,0,0,0.3)' }}>
            <div style={{ padding: '16px 20px', borderBottom: '1px solid #E2E8F0', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div>
                <div style={{ fontWeight: 800, fontSize: 15, color: '#0F172A' }}>
                  <History size={14} style={{ verticalAlign: 'middle', marginRight: 6, color: PURPLE }} />
                  Historique — {histModal.row.livrable.nom || 'Sans nom'}
                </div>
                <div style={{ fontSize: 11, color: SLATE, marginTop: 2 }}>
                  Version courante : <strong style={{ color: PURPLE }}>v{histModal.row.livrable.version}</strong>
                  {' · '}{histModal.row.livrable.historique.length} modification(s)
                </div>
              </div>
              <button onClick={() => setHistModal(null)} style={{ background: '#F1F5F9', border: 'none', borderRadius: 6, padding: '6px 10px', cursor: 'pointer', fontFamily: 'inherit' }}>✕</button>
            </div>
            <div style={{ flex: 1, overflowY: 'auto', padding: 20 }}>
              {histModal.row.livrable.historique.length === 0 ? (
                <div style={{ textAlign: 'center', color: SLATE, padding: 40 }}>Aucune modification enregistrée.</div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                  {[...histModal.row.livrable.historique].reverse().map((v, i) => (
                    <div key={i} style={{ borderLeft: `3px solid ${PURPLE}`, paddingLeft: 14, paddingBottom: 8 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                        <span style={{ fontWeight: 700, fontSize: 12, color: PURPLE }}>v{v.version}</span>
                        <span style={{ fontSize: 11, color: SLATE }}>{fmtDate(v.dateModification)} · {v.modifiePar}</span>
                      </div>
                      {v.commentaire && <div style={{ fontSize: 11, color: '#475569', fontStyle: 'italic' }}>{v.commentaire}</div>}
                      {Object.entries(v.champs).filter(([, val]) => val !== undefined && val !== '').map(([k, val]) => (
                        <div key={k} style={{ fontSize: 11, color: SLATE }}>
                          <span style={{ fontWeight: 600 }}>{k}</span> : {String(val)}
                        </div>
                      ))}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ── MODAL : Décisions & arbitrages ──────────────────────────────── */}
      {decisionModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
          <div style={{ background: '#fff', borderRadius: 12, width: '100%', maxWidth: 640, maxHeight: '80vh', display: 'flex', flexDirection: 'column', boxShadow: '0 20px 60px rgba(0,0,0,0.3)' }}>
            <div style={{ padding: '16px 20px', borderBottom: '1px solid #E2E8F0', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div>
                <div style={{ fontWeight: 800, fontSize: 15 }}>
                  <AlertTriangle size={14} style={{ verticalAlign: 'middle', marginRight: 6, color: AMBER }} />
                  Décisions & arbitrages
                </div>
                <div style={{ fontSize: 11, color: SLATE, marginTop: 2 }}>{decisionModal.row.livrable.nom}</div>
              </div>
              <button onClick={() => setDecisionModal(null)} style={{ background: '#F1F5F9', border: 'none', borderRadius: 6, padding: '6px 10px', cursor: 'pointer', fontFamily: 'inherit' }}>✕</button>
            </div>
            <div style={{ flex: 1, overflowY: 'auto', padding: 20, display: 'flex', flexDirection: 'column', gap: 12 }}>
              {decisionModal.row.livrable.decisions.length === 0
                ? <div style={{ textAlign: 'center', color: SLATE }}>Aucune décision enregistrée.</div>
                : [...decisionModal.row.livrable.decisions].reverse().map((d, i) => (
                  <div key={i} style={{ borderLeft: `3px solid ${d.impact === 'Majeur' ? RED : d.impact === 'Mineur' ? AMBER : '#94A3B8'}`, paddingLeft: 12, paddingBottom: 6 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                      <span style={{ fontSize: 10, fontWeight: 700, padding: '1px 6px', borderRadius: 4,
                        background: d.impact === 'Majeur' ? '#FEF2F2' : d.impact === 'Mineur' ? '#FFFBEB' : '#F1F5F9',
                        color: d.impact === 'Majeur' ? RED : d.impact === 'Mineur' ? AMBER : SLATE }}>
                        {d.impact}
                      </span>
                      <span style={{ fontSize: 11, color: SLATE }}>{fmtDate(d.date)} · {d.auteur}</span>
                    </div>
                    <div style={{ fontSize: 13, color: '#1E293B' }}>{d.texte}</div>
                  </div>
                ))
              }

              {/* Ajouter une décision */}
              {canEdit && (
                <div style={{ marginTop: 8, borderTop: '1px solid #E2E8F0', paddingTop: 14 }}>
                  <div style={{ fontSize: 12, fontWeight: 700, marginBottom: 8 }}>Ajouter une décision</div>
                  <textarea value={newDecision.texte} onChange={e => setNewDecision(d => ({ ...d, texte: e.target.value }))}
                    placeholder="Décrit la décision prise ou l'arbitrage rendu…"
                    style={{ width: '100%', padding: 8, border: '1px solid #CBD5E1', borderRadius: 6, fontSize: 12, resize: 'vertical', minHeight: 72, fontFamily: 'inherit', boxSizing: 'border-box' }} />
                  <div style={{ display: 'flex', gap: 8, marginTop: 8, alignItems: 'center' }}>
                    <select value={newDecision.impact} onChange={e => setNewDecision(d => ({ ...d, impact: e.target.value as LivrableDecision['impact'] }))}
                      style={{ padding: '5px 10px', border: '1px solid #CBD5E1', borderRadius: 6, fontSize: 12, fontFamily: 'inherit' }}>
                      <option value='Majeur'>Impact Majeur</option>
                      <option value='Mineur'>Impact Mineur</option>
                      <option value='Informatif'>Informatif</option>
                    </select>
                    <button onClick={addDecision}
                      style={{ padding: '5px 14px', border: 'none', borderRadius: 6, background: NAVY, color: '#fff', fontSize: 12, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' }}>
                      Enregistrer
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ── MODAL : Nouveau livrable ─────────────────────────────────────── */}
      {addRow && newLiv && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
          <div style={{ background: '#fff', borderRadius: 12, width: '100%', maxWidth: 520, boxShadow: '0 20px 60px rgba(0,0,0,0.3)' }}>
            <div style={{ padding: '16px 20px', borderBottom: '1px solid #E2E8F0', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div style={{ fontWeight: 800, fontSize: 15 }}><Plus size={14} style={{ verticalAlign: 'middle', marginRight: 6 }} />Nouveau livrable</div>
              <button onClick={() => { setAddRow(null); setNewLiv(null); }} style={{ background: '#F1F5F9', border: 'none', borderRadius: 6, padding: '6px 10px', cursor: 'pointer', fontFamily: 'inherit' }}>✕</button>
            </div>
            <div style={{ padding: 20, display: 'flex', flexDirection: 'column', gap: 12 }}>
              {/* Projet & Tâche */}
              <div style={{ display: 'flex', gap: 10 }}>
                <div style={{ flex: 1 }}>
                  <label style={{ fontSize: 11, fontWeight: 600, display: 'block', marginBottom: 4 }}>Projet *</label>
                  <select value={addRow.projetId} onChange={e => { const p = store.projets.find(x => x.id === e.target.value); setAddRow({ projetId: e.target.value, tacheId: p?.taches[0]?.id ?? '' }); }}
                    style={{ width: '100%', padding: '6px 8px', border: '1px solid #CBD5E1', borderRadius: 6, fontSize: 12, fontFamily: 'inherit' }}>
                    {store.projets.map(p => <option key={p.id} value={p.id}>{p.code}</option>)}
                  </select>
                </div>
                <div style={{ flex: 1 }}>
                  <label style={{ fontSize: 11, fontWeight: 600, display: 'block', marginBottom: 4 }}>Tâche *</label>
                  <select value={addRow.tacheId} onChange={e => setAddRow(r => ({ ...r!, tacheId: e.target.value }))}
                    style={{ width: '100%', padding: '6px 8px', border: '1px solid #CBD5E1', borderRadius: 6, fontSize: 12, fontFamily: 'inherit' }}>
                    {store.projets.find(p => p.id === addRow.projetId)?.taches.map(t => <option key={t.id} value={t.id}>{t.nom.slice(0, 30)}</option>)}
                  </select>
                </div>
              </div>
              {/* Nom */}
              <div>
                <label style={{ fontSize: 11, fontWeight: 600, display: 'block', marginBottom: 4 }}>Intitulé du livrable *</label>
                <input value={newLiv.nom} onChange={e => setNewLiv(l => ({ ...l!, nom: e.target.value }))}
                  placeholder="Ex : Rapport d'avancement mensuel T3"
                  style={{ width: '100%', padding: '6px 8px', border: '1px solid #CBD5E1', borderRadius: 6, fontSize: 12, fontFamily: 'inherit', boxSizing: 'border-box' }} />
              </div>
              <div style={{ display: 'flex', gap: 10 }}>
                <div style={{ flex: 1 }}>
                  <label style={{ fontSize: 11, fontWeight: 600, display: 'block', marginBottom: 4 }}>Type</label>
                  <select value={newLiv.typeLivrable} onChange={e => setNewLiv(l => ({ ...l!, typeLivrable: e.target.value as TypeLivrable }))}
                    style={{ width: '100%', padding: '6px 8px', border: '1px solid #CBD5E1', borderRadius: 6, fontSize: 12, fontFamily: 'inherit' }}>
                    {TYPES_LIVRABLE.map(t => <option key={t} value={t}>{t}</option>)}
                  </select>
                </div>
                <div style={{ flex: 1 }}>
                  <label style={{ fontSize: 11, fontWeight: 600, display: 'block', marginBottom: 4 }}>Priorité</label>
                  <select value={newLiv.priorite} onChange={e => setNewLiv(l => ({ ...l!, priorite: e.target.value as PrioriteLivrable }))}
                    style={{ width: '100%', padding: '6px 8px', border: '1px solid #CBD5E1', borderRadius: 6, fontSize: 12, fontFamily: 'inherit' }}>
                    {PRIORITES.map(p => <option key={p} value={p}>{PRIORITE_CFG[p].label}</option>)}
                  </select>
                </div>
              </div>
              <div style={{ display: 'flex', gap: 10 }}>
                <div style={{ flex: 1 }}>
                  <label style={{ fontSize: 11, fontWeight: 600, display: 'block', marginBottom: 4 }}>Propriétaire</label>
                  <input value={newLiv.proprietaireNom} onChange={e => setNewLiv(l => ({ ...l!, proprietaireNom: e.target.value }))}
                    style={{ width: '100%', padding: '6px 8px', border: '1px solid #CBD5E1', borderRadius: 6, fontSize: 12, fontFamily: 'inherit', boxSizing: 'border-box' }} />
                </div>
                <div style={{ flex: 1 }}>
                  <label style={{ fontSize: 11, fontWeight: 600, display: 'block', marginBottom: 4 }}>Date requise</label>
                  <input type='date' value={newLiv.dateRequise} onChange={e => setNewLiv(l => ({ ...l!, dateRequise: e.target.value }))}
                    style={{ width: '100%', padding: '6px 8px', border: '1px solid #CBD5E1', borderRadius: 6, fontSize: 12, fontFamily: 'inherit', boxSizing: 'border-box' }} />
                </div>
              </div>
              <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 4 }}>
                <button onClick={() => { setAddRow(null); setNewLiv(null); }}
                  style={{ padding: '7px 16px', border: '1px solid #E2E8F0', borderRadius: 6, background: '#fff', fontSize: 12, cursor: 'pointer', fontFamily: 'inherit' }}>
                  Annuler
                </button>
                <button onClick={saveLivrable}
                  style={{ padding: '7px 16px', border: 'none', borderRadius: 6, background: NAVY, color: '#fff', fontSize: 12, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' }}>
                  Créer le livrable
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

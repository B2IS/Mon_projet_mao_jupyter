'use client';
/**
 * Feuille de temps hebdomadaire (timesheet classique).
 * Surface l'engine `timesheetStore` : saisie heures par projet × jour,
 * workflow brouillon → soumis → validé/rejeté, coût auto (heures × taux),
 * export période. Alimente le coût réel projet (imputation temps).
 */
import { useMemo, useState } from 'react';
import {
  Clock, ChevronLeft, ChevronRight, Plus, Download, Send,
  Check, X, Trash2, CircleDot, Lock, Search,
} from 'lucide-react';
import { useTimesheetStore, type StatutEntry } from '@/lib/timesheetStore';
import { useProjectStore } from '@/lib/projectStore';
import { useAuth } from '@/lib/authStore';
import toast from 'react-hot-toast';

const NAVY = '#3D1A6B';
const ORANGE = '#F47920';
const GREEN = '#16A34A';
const RED = '#DC2626';
const AMBER = '#D97706';
const BORDER = '#E2E8F0';
const DEFAULT_TAUX = 15000; // FCFA/h par défaut si la ressource n'a pas de taux
const JOURS = ['Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam', 'Dim'];

const cfa = (n: number) => `${Math.round(n).toLocaleString('fr-FR')} FCFA`;

function mondayOf(d: Date): Date {
  const r = new Date(d);
  const day = r.getDay();
  const diff = r.getDate() - day + (day === 0 ? -6 : 1);
  r.setDate(diff); r.setHours(0, 0, 0, 0);
  return r;
}
function ymd(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}
function addDays(d: Date, n: number): Date { const r = new Date(d); r.setDate(r.getDate() + n); return r; }
function fmtJour(d: Date): string { return `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}`; }

const STATUT_CFG: Record<StatutEntry, { label: string; color: string; bg: string }> = {
  brouillon: { label: 'Brouillon', color: '#64748B', bg: '#F1F5F9' },
  soumis:    { label: 'Soumis',    color: AMBER,     bg: '#FFF7ED' },
  valide:    { label: 'Validé',    color: GREEN,     bg: '#DCFCE7' },
  rejete:    { label: 'Rejeté',    color: RED,       bg: '#FEE2E2' },
};

export default function FeuilleDeTemps() {
  const { user, isRole } = useAuth();
  const store = useProjectStore();
  const ts = useTimesheetStore();

  // Résout l'utilisateur connecté en ressource (taux horaire), sinon défaut.
  const moiRessource = useMemo(() => {
    if (!user) return null;
    const full = `${user.prenom} ${user.nom}`.toLowerCase().trim();
    return store.ressources.find(r =>
      `${r.prenom} ${r.nom}`.toLowerCase().trim() === full) ?? null;
  }, [user, store.ressources]);
  const ressourceId = moiRessource?.id ?? user?.id ?? 'anonyme';
  const tauxHoraire = moiRessource?.tauxHoraire && moiRessource.tauxHoraire > 0
    ? moiRessource.tauxHoraire : DEFAULT_TAUX;

  const isManager = isRole('CHEF_DEPT', 'DIR_DPE', 'PMO', 'ADMIN');

  const [weekStart, setWeekStart] = useState<Date>(() => mondayOf(new Date()));
  const weekDays = useMemo(() => Array.from({ length: 7 }, (_, i) => addDays(weekStart, i)), [weekStart]);
  const debut = ymd(weekDays[0]);
  const fin = ymd(weekDays[6]);

  // Projets affichables (référentiel) + ceux déjà saisis cette semaine.
  const projetsDispo = store.projets;
  const entriesSemaine = useMemo(
    () => ts.getEntriesByRessource(ressourceId, debut, fin),
    [ts, ressourceId, debut, fin, ts.entries],
  );

  // Lignes = projets ayant des saisies cette semaine + projets ajoutés manuellement.
  const [lignesAjoutees, setLignesAjoutees] = useState<string[]>([]);
  const projetIdsLignes = useMemo(() => {
    const fromEntries = [...new Set(entriesSemaine.map(e => e.projetId))];
    return [...new Set([...fromEntries, ...lignesAjoutees])];
  }, [entriesSemaine, lignesAjoutees]);

  const [addProjet, setAddProjet] = useState('');
  const [rowSearch, setRowSearch] = useState('');

  const filteredProjetIds = useMemo(() => {
    if (!rowSearch.trim()) return projetIdsLignes;
    const q = rowSearch.toLowerCase();
    return projetIdsLignes.filter(pid => {
      const p = projetsDispo.find(x => x.id === pid);
      return (p?.code ?? pid).toLowerCase().includes(q) || (p?.nom ?? '').toLowerCase().includes(q);
    });
  }, [projetIdsLignes, rowSearch, projetsDispo]);

  // Map rapide (projetId|date) -> entry
  const entryMap = useMemo(() => {
    const m = new Map<string, typeof entriesSemaine[0]>();
    entriesSemaine.forEach(e => m.set(`${e.projetId}|${e.date}`, e));
    return m;
  }, [entriesSemaine]);

  const weekLocked = entriesSemaine.length > 0 &&
    entriesSemaine.every(e => e.statut === 'soumis' || e.statut === 'valide');
  const weekStatut: StatutEntry = entriesSemaine.length === 0 ? 'brouillon'
    : entriesSemaine.every(e => e.statut === 'valide') ? 'valide'
    : entriesSemaine.some(e => e.statut === 'rejete') ? 'rejete'
    : entriesSemaine.every(e => e.statut === 'soumis' || e.statut === 'valide') ? 'soumis'
    : 'brouillon';

  const setHeures = (projetId: string, date: string, raw: string) => {
    const h = parseFloat(raw.replace(',', '.'));
    const existing = entryMap.get(`${projetId}|${date}`);
    if (!raw || isNaN(h) || h <= 0) {
      if (existing) ts.removeEntry(existing.id);
      return;
    }
    const heures = Math.min(24, Math.max(0, h));
    if (existing) {
      if (existing.statut === 'valide' || existing.statut === 'soumis') return;
      ts.updateEntry(existing.id, { heures });
    } else {
      ts.addEntry({ ressourceId, projetId, date, heures, tauxHoraireSnapshot: tauxHoraire });
    }
  };

  const totalRow = (projetId: string) =>
    weekDays.reduce((s, d) => s + (entryMap.get(`${projetId}|${ymd(d)}`)?.heures ?? 0), 0);
  const totalDay = (date: string) =>
    projetIdsLignes.reduce((s, pid) => s + (entryMap.get(`${pid}|${date}`)?.heures ?? 0), 0);
  const totalWeek = entriesSemaine.reduce((s, e) => s + e.heures, 0);
  const coutWeek = entriesSemaine.reduce((s, e) => s + (e.coutCalcule ?? 0), 0);

  const soumettre = () => {
    if (entriesSemaine.length === 0) { toast.error('Aucune heure saisie cette semaine.'); return; }
    entriesSemaine.filter(e => e.statut === 'brouillon' || e.statut === 'rejete')
      .forEach(e => ts.updateEntry(e.id, { statut: 'soumis' }));
    toast.success('Feuille de temps soumise pour validation.');
  };
  const validerSemaine = () => {
    entriesSemaine.filter(e => e.statut === 'soumis')
      .forEach(e => ts.validateEntry(e.id, user?.id ?? 'manager'));
    toast.success('Feuille de temps validée.');
  };
  const rejeterSemaine = () => {
    entriesSemaine.filter(e => e.statut === 'soumis')
      .forEach(e => ts.rejectEntry(e.id, user?.id ?? 'manager'));
    toast('Feuille de temps rejetée — renvoyée en saisie.', { icon: '↩️' });
  };

  const exporter = () => {
    const json = ts.exportPeriode(debut, fin);
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = `feuille-temps_${debut}_${fin}.json`; a.click();
    URL.revokeObjectURL(url);
    toast.success('Export période téléchargé.');
  };

  const cell = (projetId: string, d: Date) => {
    const date = ymd(d);
    const e = entryMap.get(`${projetId}|${date}`);
    const locked = e?.statut === 'soumis' || e?.statut === 'valide';
    return (
      <td key={date} style={{ padding: 3, textAlign: 'center', borderLeft: `1px solid ${BORDER}` }}>
        <input
          type="number" min={0} max={24} step={0.5}
          defaultValue={e?.heures ?? ''}
          disabled={locked}
          onBlur={ev => setHeures(projetId, date, ev.target.value)}
          onKeyDown={ev => { if (ev.key === 'Enter') (ev.target as HTMLInputElement).blur(); }}
          placeholder="—"
          style={{
            width: 46, textAlign: 'center', border: `1px solid ${BORDER}`, borderRadius: 6,
            padding: '5px 2px', fontSize: 12.5, fontFamily: 'inherit',
            background: locked ? '#F8FAFC' : '#fff', color: locked ? '#94A3B8' : '#1E293B',
            fontWeight: (e?.heures ?? 0) > 0 ? 700 : 400,
          }}
        />
      </td>
    );
  };

  return (
    <div>
      {/* Barre semaine + statut + actions */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap', marginBottom: 14 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, background: '#fff', border: `1px solid ${BORDER}`, borderRadius: 8, padding: '4px 6px' }}>
          <button onClick={() => setWeekStart(addDays(weekStart, -7))} style={navBtn}><ChevronLeft size={16} /></button>
          <span style={{ fontSize: 12.5, fontWeight: 700, color: NAVY, minWidth: 170, textAlign: 'center' }}>
            Semaine du {fmtJour(weekDays[0])} au {fmtJour(weekDays[6])}
          </span>
          <button onClick={() => setWeekStart(addDays(weekStart, 7))} style={navBtn}><ChevronRight size={16} /></button>
        </div>
        <button onClick={() => setWeekStart(mondayOf(new Date()))} style={{ ...ghostBtn }}>Cette semaine</button>

        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, fontSize: 11.5, fontWeight: 700, padding: '5px 11px', borderRadius: 20, color: STATUT_CFG[weekStatut].color, background: STATUT_CFG[weekStatut].bg }}>
          <CircleDot size={11} /> {STATUT_CFG[weekStatut].label}
        </span>

        <div style={{ flex: 1 }} />

        <button onClick={exporter} style={ghostBtn}><Download size={13} /> Exporter</button>
        {!isManager && (
          <button onClick={soumettre} disabled={weekStatut === 'soumis' || weekStatut === 'valide'}
            style={{ ...primaryBtn, opacity: (weekStatut === 'soumis' || weekStatut === 'valide') ? 0.5 : 1 }}>
            <Send size={13} /> Soumettre
          </button>
        )}
        {isManager && (
          <>
            <button onClick={rejeterSemaine} disabled={weekStatut !== 'soumis'} style={{ ...ghostBtn, color: RED, borderColor: '#FCA5A5', opacity: weekStatut !== 'soumis' ? 0.5 : 1 }}><X size={13} /> Rejeter</button>
            <button onClick={validerSemaine} disabled={weekStatut !== 'soumis'} style={{ ...primaryBtn, background: GREEN, opacity: weekStatut !== 'soumis' ? 0.5 : 1 }}><Check size={13} /> Valider</button>
          </>
        )}
      </div>

      {/* Grille feuille de temps */}
      <div style={{ background: '#fff', border: `1px solid ${BORDER}`, borderRadius: 12, overflow: 'hidden' }}>
        {projetIdsLignes.length > 0 && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 12px', borderBottom: `1px solid ${BORDER}`, background: '#FAFBFC' }}>
            <Search size={13} style={{ color: '#94A3B8', flexShrink: 0 }} />
            <input
              value={rowSearch} onChange={e => setRowSearch(e.target.value)}
              placeholder="Filtrer les projets saisis…"
              style={{ flex: 1, border: 'none', background: 'transparent', fontSize: 12.5, color: '#334155', outline: 'none' }}
            />
            {rowSearch && (
              <button onClick={() => setRowSearch('')} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 2, color: '#94A3B8', display: 'flex', alignItems: 'center' }}><X size={12} /></button>
            )}
            {rowSearch && <span style={{ fontSize: 11, color: '#94A3B8', flexShrink: 0 }}>{filteredProjetIds.length}/{projetIdsLignes.length}</span>}
          </div>
        )}
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 720 }}>
            <thead>
              <tr style={{ background: '#F8FAFC', borderBottom: `2px solid ${BORDER}` }}>
                <th style={{ ...th, textAlign: 'left', minWidth: 240 }}>Projet imputé</th>
                {weekDays.map((d, i) => (
                  <th key={i} style={{ ...th, minWidth: 56 }}>
                    <div>{JOURS[i]}</div>
                    <div style={{ fontSize: 9, color: '#94A3B8', fontWeight: 500 }}>{fmtJour(d)}</div>
                  </th>
                ))}
                <th style={{ ...th, minWidth: 56, borderLeft: `2px solid ${BORDER}` }}>Total</th>
              </tr>
            </thead>
            <tbody>
              {projetIdsLignes.length === 0 && (
                <tr><td colSpan={9} style={{ padding: 28, textAlign: 'center', color: '#94A3B8', fontSize: 13 }}>
                  Aucune ligne — ajoutez un projet ci-dessous pour saisir vos heures.
                </td></tr>
              )}
              {projetIdsLignes.length > 0 && filteredProjetIds.length === 0 && (
                <tr><td colSpan={9} style={{ padding: 28, textAlign: 'center', color: '#94A3B8', fontSize: 13 }}>
                  Aucun résultat pour cette recherche.
                </td></tr>
              )}
              {filteredProjetIds.map(pid => {
                const p = projetsDispo.find(x => x.id === pid);
                const rowTotal = totalRow(pid);
                return (
                  <tr key={pid} style={{ borderBottom: `1px solid ${BORDER}` }}>
                    <td style={{ padding: '8px 12px', fontSize: 12.5 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <span style={{ fontSize: 10, fontWeight: 700, color: NAVY, background: '#EFF6FF', padding: '1px 6px', borderRadius: 5 }}>{p?.code ?? pid}</span>
                        <span style={{ fontWeight: 600, color: '#1E293B', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: 200 }} title={p?.nom}>{p?.nom ?? '—'}</span>
                        {!weekLocked && (
                          <button onClick={() => setLignesAjoutees(l => l.filter(x => x !== pid))}
                            title="Retirer la ligne (efface aussi les heures)"
                            style={{ marginLeft: 'auto', background: 'none', border: 'none', cursor: 'pointer', color: '#CBD5E1', padding: 2 }}><Trash2 size={13} /></button>
                        )}
                      </div>
                    </td>
                    {weekDays.map(d => cell(pid, d))}
                    <td style={{ padding: '8px 6px', textAlign: 'center', borderLeft: `2px solid ${BORDER}`, fontWeight: 800, fontSize: 13, color: rowTotal > 0 ? NAVY : '#CBD5E1' }}>
                      {rowTotal > 0 ? rowTotal : '—'}
                    </td>
                  </tr>
                );
              })}
            </tbody>
            <tfoot>
              <tr style={{ background: '#F8FAFC', borderTop: `2px solid ${BORDER}` }}>
                <td style={{ padding: '8px 12px', fontWeight: 700, fontSize: 12, color: '#475569' }}>Total / jour</td>
                {weekDays.map((d, i) => {
                  const t = totalDay(ymd(d));
                  return <td key={i} style={{ padding: '8px 6px', textAlign: 'center', fontWeight: 800, fontSize: 12.5, color: t > 8 ? AMBER : t > 0 ? '#1E293B' : '#CBD5E1', borderLeft: `1px solid ${BORDER}` }}>{t > 0 ? t : '—'}</td>;
                })}
                <td style={{ padding: '8px 6px', textAlign: 'center', fontWeight: 800, fontSize: 13, color: ORANGE, borderLeft: `2px solid ${BORDER}` }}>{totalWeek > 0 ? totalWeek : '—'}</td>
              </tr>
            </tfoot>
          </table>
        </div>

        {/* Ajout de ligne projet */}
        {!weekLocked && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px 12px', borderTop: `1px solid ${BORDER}`, background: '#FCFCFD' }}>
            <select value={addProjet} onChange={e => setAddProjet(e.target.value)}
              style={{ flex: 1, maxWidth: 420, border: `1px solid ${BORDER}`, borderRadius: 7, padding: '7px 10px', fontSize: 12.5, fontFamily: 'inherit', background: '#fff' }}>
              <option value="">— Ajouter un projet à imputer —</option>
              {projetsDispo.filter(p => !projetIdsLignes.includes(p.id)).map(p => (
                <option key={p.id} value={p.id}>{p.code} — {p.nom}</option>
              ))}
            </select>
            <button onClick={() => { if (addProjet) { setLignesAjoutees(l => [...l, addProjet]); setAddProjet(''); } }}
              disabled={!addProjet} style={{ ...primaryBtn, opacity: addProjet ? 1 : 0.5 }}>
              <Plus size={14} /> Ajouter la ligne
            </button>
          </div>
        )}
        {weekLocked && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px 12px', borderTop: `1px solid ${BORDER}`, background: '#FCFCFD', fontSize: 12, color: '#64748B' }}>
            <Lock size={13} /> Feuille {STATUT_CFG[weekStatut].label.toLowerCase()} — saisie verrouillée.
          </div>
        )}
      </div>

      {/* Récap coût (imputation temps → coût projet) */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 12, marginTop: 14 }}>
        <Recap label="Total heures (semaine)" value={`${totalWeek} h`} color={NAVY} />
        <Recap label="Taux horaire appliqué" value={cfa(tauxHoraire) + '/h'} color="#1D4ED8" />
        <Recap label="Coût imputé au temps" value={cfa(coutWeek)} color={ORANGE} sub="Valorise le coût réel projet (EVM)" />
        <Recap label="Collaborateur" value={user ? `${user.prenom} ${user.nom}` : '—'} color="#475569" text />
      </div>
    </div>
  );
}

const th: React.CSSProperties = { padding: '9px 6px', fontSize: 10.5, fontWeight: 700, color: '#64748B', textTransform: 'uppercase', letterSpacing: '0.04em', textAlign: 'center' };
const navBtn: React.CSSProperties = { background: 'none', border: 'none', cursor: 'pointer', color: NAVY, display: 'flex', alignItems: 'center', padding: 3, borderRadius: 6 };
const ghostBtn: React.CSSProperties = { display: 'inline-flex', alignItems: 'center', gap: 5, padding: '6px 12px', borderRadius: 7, border: `1px solid ${BORDER}`, background: '#fff', color: '#475569', fontSize: 12, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' };
const primaryBtn: React.CSSProperties = { display: 'inline-flex', alignItems: 'center', gap: 5, padding: '7px 14px', borderRadius: 7, border: 'none', background: NAVY, color: '#fff', fontSize: 12, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' };

function Recap({ label, value, color, sub, text }: { label: string; value: string; color: string; sub?: string; text?: boolean }) {
  return (
    <div style={{ background: '#fff', border: `1px solid ${BORDER}`, borderRadius: 10, padding: '12px 14px', borderLeft: `3px solid ${color}` }}>
      <div style={{ fontSize: 11, color: '#64748B', fontWeight: 600, marginBottom: 4 }}>{label}</div>
      <div style={{ fontSize: text ? 14 : 19, fontWeight: 800, color, lineHeight: 1.15 }}>{value}</div>
      {sub && <div style={{ fontSize: 10, color: '#94A3B8', marginTop: 3 }}>{sub}</div>}
    </div>
  );
}

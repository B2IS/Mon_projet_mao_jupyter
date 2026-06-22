'use client';

/**
 * PlanifierRapportCSE — Modal de planification d'un rapport consolidé CSE.
 * Permet de sélectionner les projets, la période, les indicateurs et le format.
 */

import { useState, useMemo } from 'react';
import { X, FileText, Download, Calendar, CheckSquare, Square, ChevronDown, ChevronUp, FileSpreadsheet } from 'lucide-react';
import { useProjectStore, DOMAINE_CFG, type Domaine } from '@/lib/projectStore';
import { downloadExcel, printBranded, downloadMatriceSuivi } from '@/lib/exportUtils';

/* ─── Types ─────────────────────────────────────────────────────────────── */
type Trimestre = 'T1' | 'T2' | 'T3' | 'T4' | 'annuel' | 'custom';
type FormatExport = 'excel' | 'pdf' | 'matrice';

interface IndicateurOption {
  id: string;
  label: string;
  groupe: string;
}

/* ─── Config ─────────────────────────────────────────────────────────────── */
const NAVY   = '#3D1A6B';
const ORANGE = '#F47920';

const INDICATEURS: IndicateurOption[] = [
  { id: 'budget_global',       label: 'Budget global (M FCFA)',           groupe: 'Financier' },
  { id: 'budget_engage',       label: 'Budget engagé (M FCFA)',            groupe: 'Financier' },
  { id: 'budget_decaisse',     label: 'Budget décaissé (M FCFA)',          groupe: 'Financier' },
  { id: 'taux_engagement',     label: 'Taux d\'engagement (%)',            groupe: 'Financier' },
  { id: 'taux_decaissement',   label: 'Taux de décaissement (%)',          groupe: 'Financier' },
  { id: 'avancement_physique', label: 'Avancement physique (%)',           groupe: 'Performance' },
  { id: 'cpi',                 label: 'CPI (Indice perf. coût)',           groupe: 'Performance' },
  { id: 'spi',                 label: 'SPI (Indice perf. délai)',          groupe: 'Performance' },
  { id: 'statut_global',       label: 'Statut global (RAG)',               groupe: 'Performance' },
  { id: 'date_debut',          label: 'Date de démarrage',                  groupe: 'Planning' },
  { id: 'date_fin_prevue',     label: 'Date de fin prévisionnelle',        groupe: 'Planning' },
  { id: 'date_fin_estimee',    label: 'Date de fin actualisée',            groupe: 'Planning' },
  { id: 'ecart_delai',         label: 'Écart de délai (jours)',            groupe: 'Planning' },
  { id: 'chef_projet',         label: 'Chef de projet',                    groupe: 'Identification' },
  { id: 'domaine',             label: 'Domaine',                           groupe: 'Identification' },
  { id: 'programme',           label: 'Programme',                         groupe: 'Identification' },
  { id: 'nb_jalons_ok',        label: 'Jalons franchis',                   groupe: 'Jalons' },
  { id: 'nb_jalons_retard',    label: 'Jalons en retard',                  groupe: 'Jalons' },
];

const TRIMESTRES: { value: Trimestre; label: string }[] = [
  { value: 'T1',      label: 'T1 — Janv. à Mars' },
  { value: 'T2',      label: 'T2 — Avr. à Juin' },
  { value: 'T3',      label: 'T3 — Juil. à Sept.' },
  { value: 'T4',      label: 'T4 — Oct. à Déc.' },
  { value: 'annuel',  label: 'Annuel' },
  { value: 'custom',  label: 'Période personnalisée' },
];

/* ─── Helper ─────────────────────────────────────────────────────────────── */
function groupBy<T>(arr: T[], key: (t: T) => string): Record<string, T[]> {
  return arr.reduce((acc, item) => {
    const k = key(item);
    (acc[k] = acc[k] ?? []).push(item);
    return acc;
  }, {} as Record<string, T[]>);
}

function fmtMFCFA(v: number): string {
  return v.toLocaleString('fr-FR', { minimumFractionDigits: 0, maximumFractionDigits: 0 });
}

/* ═══════════════════════════════════════════════════════════════════════════ */
export default function PlanifierRapportCSE({ onClose }: { onClose: () => void }) {
  const store = useProjectStore();
  const projets = store.projets ?? [];

  /* ─── State ─────────────────────────────────────────────────────────── */
  const [selectedProjetIds, setSelectedProjetIds] = useState<Set<string>>(new Set());
  const [annee, setAnnee]       = useState(new Date().getFullYear());
  const [trimestre, setTrimestre] = useState<Trimestre>('T2');
  const [dateDebut, setDateDebut] = useState('');
  const [dateFin, setDateFin]   = useState('');
  const [format, setFormat]     = useState<FormatExport>('excel');
  const [selectedIndIds, setSelectedIndIds] = useState<Set<string>>(
    new Set(['budget_global', 'budget_decaisse', 'taux_decaissement', 'avancement_physique', 'statut_global', 'date_fin_prevue'])
  );
  const [domaineFilter, setDomaineFilter] = useState<string>('tous');
  const [sectionsOpen, setSectionsOpen] = useState({ projets: true, periode: true, indicateurs: false, format: true });

  /* ─── Projets filtrés par domaine ─────────────────────────────────── */
  const projetsFiltres = useMemo(() =>
    domaineFilter === 'tous' ? projets : projets.filter(p => p.domaine === domaineFilter),
    [projets, domaineFilter]
  );

  const selectedProjets = useMemo(() =>
    projets.filter(p => selectedProjetIds.has(p.id)),
    [projets, selectedProjetIds]
  );

  /* ─── Toggle helpers ─────────────────────────────────────────────── */
  function toggleProjet(id: string) {
    setSelectedProjetIds(prev => {
      const s = new Set(prev);
      s.has(id) ? s.delete(id) : s.add(id);
      return s;
    });
  }

  function selectAllVisible() {
    setSelectedProjetIds(prev => {
      const s = new Set(prev);
      projetsFiltres.forEach(p => s.add(p.id));
      return s;
    });
  }

  function clearAll() { setSelectedProjetIds(new Set()); }

  function toggleInd(id: string) {
    setSelectedIndIds(prev => {
      const s = new Set(prev);
      s.has(id) ? s.delete(id) : s.add(id);
      return s;
    });
  }

  /* ─── Libellé période ─────────────────────────────────────────────── */
  const periodeLabel = useMemo(() => {
    if (trimestre === 'custom') return `${dateDebut} → ${dateFin}`;
    if (trimestre === 'annuel') return `Annuel ${annee}`;
    return `${trimestre} ${annee}`;
  }, [trimestre, annee, dateDebut, dateFin]);

  /* ─── Génération du rapport ─────────────────────────────────────── */
  function genererRapport() {
    if (selectedProjetIds.size === 0) return;

    const titre = `Rapport CSE — ${periodeLabel}`;

    if (format === 'matrice') {
      downloadMatriceSuivi(
        selectedProjets.map(p => ({
          code: p.code,
          codeImputation: p.codeImputation,
          nom: p.nom,
          description: p.description,
          unite: p.unite,
          domaine: p.domaine,
          programme: p.programme,
          chefProjet: p.chefProjet,
          statut: p.statut,
          budget: p.budget,
          montantMarche: p.montantMarche,
          montantFacture: p.montantFacture ?? p.budgetDecaisse,
          dateDebut: p.dateDebut,
          dateODS: p.dateODS,
          dateFinPrevue: p.dateFinPrevue,
          dateFinEstimee: p.dateFinEstimee,
          avancement: p.avancement,
        })),
        String(annee)
      );
      onClose();
      return;
    }

    if (format === 'excel') {
      const inclut = (id: string) => selectedIndIds.has(id);
      const headers: string[] = ['Code', 'Projet', 'Domaine'];
      if (inclut('chef_projet'))         headers.push('Chef de projet');
      if (inclut('statut_global'))       headers.push('Statut');
      if (inclut('budget_global'))       headers.push('Budget (M FCFA)');
      if (inclut('budget_engage'))       headers.push('Engagé (M FCFA)');
      if (inclut('budget_decaisse'))     headers.push('Décaissé (M FCFA)');
      if (inclut('taux_engagement'))     headers.push('Taux Eng. %');
      if (inclut('taux_decaissement'))   headers.push('Taux Déc. %');
      if (inclut('avancement_physique')) headers.push('Av. physique %');
      if (inclut('cpi'))                 headers.push('CPI');
      if (inclut('spi'))                 headers.push('SPI');
      if (inclut('date_debut'))          headers.push('Date démarrage');
      if (inclut('date_fin_prevue'))     headers.push('Fin prévisionnelle');
      if (inclut('date_fin_estimee'))    headers.push('Fin actualisée');

      const rows = selectedProjets.map(p => {
        const row: (string | number)[] = [p.code ?? '', p.nom, p.domaine ?? ''];
        if (inclut('chef_projet'))         row.push(p.chefProjet ?? '');
        if (inclut('statut_global'))       row.push(p.statut ?? '');
        if (inclut('budget_global'))       row.push(p.budget ?? 0);
        if (inclut('budget_engage'))       row.push(p.budgetEngage ?? 0);
        if (inclut('budget_decaisse'))     row.push(p.budgetDecaisse ?? 0);
        if (inclut('taux_engagement'))     row.push(p.budget ? Math.round((p.budgetEngage ?? 0) / p.budget * 100) : 0);
        if (inclut('taux_decaissement'))   row.push(p.budget ? Math.round((p.budgetDecaisse ?? 0) / p.budget * 100) : 0);
        if (inclut('avancement_physique')) row.push(p.avancement ?? 0);
        if (inclut('cpi'))                 row.push(p.cpi ?? 1);
        if (inclut('spi'))                 row.push(p.spi ?? 1);
        if (inclut('date_debut'))          row.push(p.dateDebut ?? '');
        if (inclut('date_fin_prevue'))     row.push(p.dateFinPrevue ?? '');
        if (inclut('date_fin_estimee'))    row.push(p.dateFinEstimee ?? '');
        return row;
      });

      downloadExcel(`Rapport_CSE_${periodeLabel.replace(/\s+/g, '_')}`, {
        sheetName: 'Rapport CSE',
        title: titre,
        subtitle: `SENELEC · Direction Principale Équipement — ${selectedProjets.length} projet(s)`,
        headers,
        rows,
      });
      onClose();
      return;
    }

    // PDF
    const tableRows = selectedProjets.map(p => {
      const row: string[] = [p.code ?? '', p.nom, p.domaine ?? ''];
      const inclut = (id: string) => selectedIndIds.has(id);
      if (inclut('statut_global'))       row.push(p.statut ?? '—');
      if (inclut('budget_global'))       row.push(`${fmtMFCFA(p.budget ?? 0)} M`);
      if (inclut('taux_decaissement'))   row.push(p.budget ? `${Math.round((p.budgetDecaisse ?? 0) / p.budget * 100)}%` : '—');
      if (inclut('avancement_physique')) row.push(`${p.avancement ?? 0}%`);
      if (inclut('date_fin_prevue'))     row.push(p.dateFinPrevue ?? '—');
      return row;
    });

    const pdfHeaders = ['Code', 'Projet', 'Domaine'];
    const inclut = (id: string) => selectedIndIds.has(id);
    if (inclut('statut_global'))       pdfHeaders.push('Statut');
    if (inclut('budget_global'))       pdfHeaders.push('Budget');
    if (inclut('taux_decaissement'))   pdfHeaders.push('% Déc.');
    if (inclut('avancement_physique')) pdfHeaders.push('Av. physique');
    if (inclut('date_fin_prevue'))     pdfHeaders.push('Fin prév.');

    printBranded({
      title: titre,
      subtitle: `${selectedProjets.length} projets — ${periodeLabel}`,
      confidentiel: true,
      landscape: true,
      tables: [{
        title: 'Tableau de bord consolidé — projets sélectionnés',
        headers: pdfHeaders,
        rows: tableRows,
        rightAlign: [4, 5, 6],
      }],
    });
    onClose();
  }

  /* ─── Section toggle ──────────────────────────────────────────────── */
  function toggleSection(key: keyof typeof sectionsOpen) {
    setSectionsOpen(prev => ({ ...prev, [key]: !prev[key] }));
  }

  /* ─── UI ─────────────────────────────────────────────────────────── */
  const groupedInd = groupBy(INDICATEURS, i => i.groupe);
  const domainesDispos = useMemo(() => {
    const set = new Set(projets.map(p => p.domaine).filter(Boolean));
    return Array.from(set) as Domaine[];
  }, [projets]);

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 9000,
      background: 'rgba(0,0,0,0.55)', backdropFilter: 'blur(4px)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      padding: '16px',
    }} onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div style={{
        background: '#fff', borderRadius: 18,
        width: '100%', maxWidth: 760, maxHeight: '92vh',
        display: 'flex', flexDirection: 'column',
        boxShadow: '0 32px 80px rgba(0,0,0,0.30)',
        overflow: 'hidden',
      }}>
        {/* Header */}
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '18px 24px', borderBottom: '1px solid #E2E8F0',
          background: NAVY, color: '#fff', flexShrink: 0,
        }}>
          <div>
            <div style={{ fontSize: 16, fontWeight: 800, letterSpacing: '-0.3px' }}>Rapport consolidé CSE</div>
            <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.60)', marginTop: 2 }}>
              Comité de Suivi et d&apos;Évaluation — planification et génération
            </div>
          </div>
          <button onClick={onClose} style={{ background: 'rgba(255,255,255,0.12)', border: 'none', borderRadius: 8, cursor: 'pointer', padding: 8, color: '#fff', display: 'flex' }}>
            <X size={18} />
          </button>
        </div>

        {/* Body — scrollable */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '20px 24px', display: 'flex', flexDirection: 'column', gap: 12 }}>

          {/* ── Sélection projets ── */}
          <Section
            title="Projets à consolider"
            badge={selectedProjetIds.size > 0 ? `${selectedProjetIds.size} sél.` : undefined}
            open={sectionsOpen.projets}
            onToggle={() => toggleSection('projets')}
          >
            {/* Filtre domaine */}
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 10, alignItems: 'center' }}>
              <span style={{ fontSize: 11, color: '#64748B', fontWeight: 600 }}>Domaine :</span>
              {(['tous', ...domainesDispos] as string[]).map(d => {
                const cfg = d !== 'tous' ? (DOMAINE_CFG[d as Domaine] ?? { label: d, color: '#64748B' }) : null;
                return (
                  <button key={d} onClick={() => setDomaineFilter(d)}
                    style={{
                      padding: '3px 10px', borderRadius: 20, fontSize: 11, fontWeight: 600, cursor: 'pointer',
                      border: `1.5px solid ${domaineFilter === d ? (cfg?.color ?? NAVY) : '#E2E8F0'}`,
                      background: domaineFilter === d ? (cfg?.color ?? NAVY) : '#fff',
                      color: domaineFilter === d ? '#fff' : '#64748B',
                    }}>
                    {d === 'tous' ? 'Tous' : (cfg?.label ?? d)}
                  </button>
                );
              })}
              <span style={{ marginLeft: 'auto', fontSize: 11, color: '#94A3B8' }}>
                {projetsFiltres.length} projet(s)
              </span>
              <button onClick={selectAllVisible} style={linkBtn}>Tout sélectionner</button>
              {selectedProjetIds.size > 0 && <button onClick={clearAll} style={{ ...linkBtn, color: '#DC2626' }}>Tout effacer</button>}
            </div>

            {/* Liste projets */}
            <div style={{ maxHeight: 220, overflowY: 'auto', border: '1px solid #E2E8F0', borderRadius: 10 }}>
              {projetsFiltres.length === 0 ? (
                <div style={{ padding: '24px', textAlign: 'center', color: '#94A3B8', fontSize: 12 }}>Aucun projet</div>
              ) : projetsFiltres.map(p => {
                const cfg = DOMAINE_CFG[p.domaine as Domaine] ?? { color: '#64748B', label: p.domaine };
                const sel = selectedProjetIds.has(p.id);
                return (
                  <div key={p.id} onClick={() => toggleProjet(p.id)}
                    style={{
                      display: 'flex', alignItems: 'center', gap: 10, padding: '9px 14px',
                      borderBottom: '1px solid #F1F5F9', cursor: 'pointer',
                      background: sel ? 'rgba(61,26,107,0.04)' : '#fff',
                      transition: 'background 0.1s',
                    }}
                    onMouseEnter={e => { if (!sel) (e.currentTarget as HTMLElement).style.background = '#F8FAFC'; }}
                    onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = sel ? 'rgba(61,26,107,0.04)' : '#fff'; }}
                  >
                    {sel ? <CheckSquare size={16} color={NAVY} /> : <Square size={16} color="#CBD5E1" />}
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 12.5, fontWeight: 600, color: '#1E293B', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{p.nom}</div>
                      <div style={{ fontSize: 10.5, color: '#94A3B8', marginTop: 1 }}>{p.code} · {p.chefProjet}</div>
                    </div>
                    <span style={{ fontSize: 10, fontWeight: 700, color: cfg.color, background: `${cfg.color}18`, padding: '2px 8px', borderRadius: 20, flexShrink: 0 }}>
                      {cfg.label}
                    </span>
                  </div>
                );
              })}
            </div>
          </Section>

          {/* ── Période ── */}
          <Section
            title="Période de référence"
            badge={periodeLabel}
            open={sectionsOpen.periode}
            onToggle={() => toggleSection('periode')}
          >
            <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'flex-end' }}>
              <div>
                <label style={labelStyle}>Année</label>
                <input type="number" value={annee} min={2020} max={2035}
                  onChange={e => setAnnee(Number(e.target.value))}
                  style={{ ...inputStyle, width: 90 }} />
              </div>
              <div>
                <label style={labelStyle}>Trimestre / Période</label>
                <select value={trimestre} onChange={e => setTrimestre(e.target.value as Trimestre)} style={{ ...inputStyle, width: 200 }}>
                  {TRIMESTRES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
                </select>
              </div>
              {trimestre === 'custom' && <>
                <div>
                  <label style={labelStyle}>Du</label>
                  <input type="date" value={dateDebut} onChange={e => setDateDebut(e.target.value)} style={{ ...inputStyle, width: 150 }} />
                </div>
                <div>
                  <label style={labelStyle}>Au</label>
                  <input type="date" value={dateFin} onChange={e => setDateFin(e.target.value)} style={{ ...inputStyle, width: 150 }} />
                </div>
              </>}
            </div>
          </Section>

          {/* ── Indicateurs ── */}
          <Section
            title="Indicateurs à inclure"
            badge={`${selectedIndIds.size} ind.`}
            open={sectionsOpen.indicateurs}
            onToggle={() => toggleSection('indicateurs')}
          >
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              {Object.entries(groupedInd).map(([groupe, inds]) => (
                <div key={groupe}>
                  <div style={{ fontSize: 10, fontWeight: 700, color: '#94A3B8', letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: 6 }}>{groupe}</div>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                    {inds.map(ind => {
                      const sel = selectedIndIds.has(ind.id);
                      return (
                        <button key={ind.id} onClick={() => toggleInd(ind.id)}
                          style={{
                            padding: '5px 12px', borderRadius: 20, fontSize: 11.5, fontWeight: 500, cursor: 'pointer',
                            border: `1.5px solid ${sel ? NAVY : '#E2E8F0'}`,
                            background: sel ? NAVY : '#fff', color: sel ? '#fff' : '#475569',
                            transition: 'all 0.15s',
                          }}>
                          {ind.label}
                        </button>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          </Section>

          {/* ── Format ── */}
          <Section
            title="Format d'export"
            open={sectionsOpen.format}
            onToggle={() => toggleSection('format')}
          >
            <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
              {([
                { value: 'excel',   icon: <FileSpreadsheet size={18} />, label: 'Excel (.xlsx)',        sub: 'Tableau consolidé avec indicateurs' },
                { value: 'matrice', icon: <FileSpreadsheet size={18} />, label: 'Matrice DPD (.xlsx)',  sub: 'Structure exacte de la Matrice de Suivi DPE' },
                { value: 'pdf',     icon: <FileText size={18} />,        label: 'PDF (impression)',     sub: 'Rapport formaté à imprimer / partager' },
              ] as { value: FormatExport; icon: React.ReactNode; label: string; sub: string }[]).map(f => (
                <button key={f.value} onClick={() => setFormat(f.value)}
                  style={{
                    flex: 1, minWidth: 160, padding: '14px 16px', borderRadius: 12, cursor: 'pointer', textAlign: 'left',
                    border: `2px solid ${format === f.value ? NAVY : '#E2E8F0'}`,
                    background: format === f.value ? 'rgba(61,26,107,0.05)' : '#fff',
                    transition: 'all 0.15s',
                  }}>
                  <div style={{ color: format === f.value ? NAVY : '#64748B', marginBottom: 6 }}>{f.icon}</div>
                  <div style={{ fontSize: 12.5, fontWeight: 700, color: format === f.value ? NAVY : '#334155' }}>{f.label}</div>
                  <div style={{ fontSize: 10.5, color: '#94A3B8', marginTop: 2 }}>{f.sub}</div>
                </button>
              ))}
            </div>
          </Section>
        </div>

        {/* Footer */}
        <div style={{
          padding: '16px 24px', borderTop: '1px solid #E2E8F0',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          flexShrink: 0, background: '#F8FAFC', gap: 12, flexWrap: 'wrap',
        }}>
          <div style={{ fontSize: 12, color: '#64748B' }}>
            {selectedProjetIds.size === 0
              ? 'Sélectionnez au moins un projet'
              : <><strong style={{ color: NAVY }}>{selectedProjetIds.size}</strong> projet(s) · {periodeLabel}</>
            }
          </div>
          <div style={{ display: 'flex', gap: 10 }}>
            <button onClick={onClose}
              style={{ padding: '9px 20px', borderRadius: 9, border: '1.5px solid #E2E8F0', background: '#fff', fontSize: 13, fontWeight: 600, cursor: 'pointer', color: '#64748B' }}>
              Annuler
            </button>
            <button onClick={genererRapport} disabled={selectedProjetIds.size === 0}
              style={{
                padding: '9px 22px', borderRadius: 9, border: 'none', fontSize: 13, fontWeight: 700, cursor: selectedProjetIds.size === 0 ? 'not-allowed' : 'pointer',
                background: selectedProjetIds.size === 0 ? '#E2E8F0' : ORANGE,
                color: selectedProjetIds.size === 0 ? '#94A3B8' : '#fff',
                display: 'flex', alignItems: 'center', gap: 7,
                transition: 'all 0.15s',
              }}>
              <Download size={16} /> Générer le rapport
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ─── Sub-components ─────────────────────────────────────────────────────── */
function Section({ title, badge, open, onToggle, children }: {
  title: string; badge?: string; open: boolean; onToggle: () => void; children: React.ReactNode;
}) {
  return (
    <div style={{ border: '1px solid #E2E8F0', borderRadius: 12, overflow: 'hidden' }}>
      <button onClick={onToggle}
        style={{
          width: '100%', display: 'flex', alignItems: 'center', gap: 10, padding: '12px 16px',
          background: '#F8FAFC', border: 'none', cursor: 'pointer', textAlign: 'left',
        }}>
        <div style={{ flex: 1, fontSize: 13, fontWeight: 700, color: '#1E293B' }}>{title}</div>
        {badge && <span style={{ fontSize: 10.5, fontWeight: 700, color: NAVY, background: 'rgba(61,26,107,0.08)', padding: '2px 8px', borderRadius: 20 }}>{badge}</span>}
        {open ? <ChevronUp size={15} color="#94A3B8" /> : <ChevronDown size={15} color="#94A3B8" />}
      </button>
      {open && <div style={{ padding: '14px 16px', background: '#fff' }}>{children}</div>}
    </div>
  );
}

/* ─── Shared styles ─────────────────────────────────────────────────────── */
const inputStyle: React.CSSProperties = {
  padding: '7px 10px', border: '1.5px solid #E2E8F0', borderRadius: 8,
  fontSize: 13, fontFamily: 'inherit', color: '#1E293B', outline: 'none',
  background: '#fff',
};

const labelStyle: React.CSSProperties = {
  display: 'block', fontSize: 11, fontWeight: 600, color: '#374151',
  marginBottom: 5, letterSpacing: '0.04em',
};

const linkBtn: React.CSSProperties = {
  background: 'none', border: 'none', cursor: 'pointer', fontSize: 11,
  fontWeight: 600, color: NAVY, textDecoration: 'underline', padding: 0,
};

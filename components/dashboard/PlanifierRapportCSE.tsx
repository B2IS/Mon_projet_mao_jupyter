'use client';

import { useState, useMemo, useRef, useEffect } from 'react';
import { X, Search, Download, FileText, FileSpreadsheet, Check, ChevronDown, ChevronUp } from 'lucide-react';
import { useProjectStore, DOMAINE_CFG, type Domaine } from '@/lib/projectStore';
import { downloadExcel, printBranded } from '@/lib/exportUtils';

/* ─── Constantes de style ───────────────────────────────────────────────── */
const NAVY   = '#3D1A6B';
const ORANGE = '#F47920';
const LIGHT  = '#F8F7FF';

/* ─── Types ─────────────────────────────────────────────────────────────── */
type Trimestre = 'T1' | 'T2' | 'T3' | 'T4' | 'annuel' | 'custom';
type Format    = 'excel' | 'pdf';

interface IndicGroup { label: string; items: { id: string; label: string }[] }

/* ─── Config indicateurs ──────────────────────────────────────────────────  */
const INDIC_GROUPS: IndicGroup[] = [
  { label: 'Financier', items: [
    { id: 'budget_global',     label: 'Budget global (M FCFA)' },
    { id: 'budget_engage',     label: 'Engagé (M FCFA)' },
    { id: 'budget_decaisse',   label: 'Décaissé (M FCFA)' },
    { id: 'taux_engagement',   label: 'Taux d\'engagement' },
    { id: 'taux_decaissement', label: 'Taux de décaissement' },
  ]},
  { label: 'Performance', items: [
    { id: 'avancement_physique', label: 'Avancement physique' },
    { id: 'cpi',                 label: 'CPI (Indice coût)' },
    { id: 'spi',                 label: 'SPI (Indice délai)' },
    { id: 'statut_global',       label: 'Statut global (RAG)' },
  ]},
  { label: 'Planning', items: [
    { id: 'date_debut',      label: 'Date de démarrage' },
    { id: 'date_fin_prevue', label: 'Fin prévisionnelle' },
    { id: 'date_fin_maj',    label: 'Fin actualisée' },
    { id: 'ecart_delai',     label: 'Écart de délai' },
  ]},
  { label: 'Identification', items: [
    { id: 'chef_projet', label: 'Chef de projet' },
    { id: 'domaine',     label: 'Domaine' },
    { id: 'programme',   label: 'Programme' },
  ]},
];

const DEFAULT_INDICS = new Set([
  'budget_global', 'budget_decaisse', 'taux_decaissement',
  'avancement_physique', 'statut_global', 'date_fin_prevue',
]);

const TRIMESTRES: { value: Trimestre; label: string; short: string }[] = [
  { value: 'T1',     label: 'T1 — Janv. à Mars',  short: 'T1' },
  { value: 'T2',     label: 'T2 — Avr. à Juin',   short: 'T2' },
  { value: 'T3',     label: 'T3 — Juil. à Sept.', short: 'T3' },
  { value: 'T4',     label: 'T4 — Oct. à Déc.',   short: 'T4' },
  { value: 'annuel', label: 'Annuel',               short: 'Ann.' },
  { value: 'custom', label: 'Personnalisé',          short: 'Perso.' },
];

/* ═══════════════════════════════════════════════════════════════════════════ */
export default function PlanifierRapportCSE({ onClose }: { onClose: () => void }) {
  const store   = useProjectStore();
  const projets = store.projets ?? [];

  /* ─── State ─────────────────────────────────────────────────────────── */
  const [search,       setSearch]       = useState('');
  const [domFilter,    setDomFilter]    = useState<string>('tous');
  const [selected,     setSelected]     = useState<Set<string>>(new Set());
  const [annee,        setAnnee]        = useState(new Date().getFullYear());
  const [trimestre,    setTrimestre]    = useState<Trimestre>('T2');
  const [dateDebut,    setDateDebut]    = useState('');
  const [dateFin,      setDateFin]      = useState('');
  const [format,       setFormat]       = useState<Format>('excel');
  const [indics,       setIndics]       = useState<Set<string>>(new Set(DEFAULT_INDICS));
  const [showIndics,   setShowIndics]   = useState(false);
  const searchRef = useRef<HTMLInputElement>(null);

  useEffect(() => { searchRef.current?.focus(); }, []);

  /* ─── Domaines disponibles ───────────────────────────────────────────── */
  const domainesDispo = useMemo(() => {
    const s = new Set(projets.map(p => p.domaine).filter(Boolean)) as Set<Domaine>;
    return Array.from(s);
  }, [projets]);

  /* ─── Projets filtrés ────────────────────────────────────────────────── */
  const listeFiltree = useMemo(() => {
    const q = search.trim().toLowerCase();
    return projets.filter(p => {
      if (domFilter !== 'tous' && p.domaine !== domFilter) return false;
      if (!q) return true;
      return (
        p.nom?.toLowerCase().includes(q) ||
        p.code?.toLowerCase().includes(q) ||
        p.chefProjet?.toLowerCase().includes(q)
      );
    });
  }, [projets, domFilter, search]);

  const selectedProjets = useMemo(
    () => projets.filter(p => selected.has(p.id)),
    [projets, selected]
  );

  /* ─── Helpers ────────────────────────────────────────────────────────── */
  const toggle = (id: string) => setSelected(prev => {
    const s = new Set(prev);
    s.has(id) ? s.delete(id) : s.add(id);
    return s;
  });

  const selectAll  = () => setSelected(prev => { const s = new Set(prev); listeFiltree.forEach(p => s.add(p.id)); return s; });
  const clearAll   = () => setSelected(new Set());
  const toggleIndic = (id: string) => setIndics(prev => { const s = new Set(prev); s.has(id) ? s.delete(id) : s.add(id); return s; });

  const periodeLabel = useMemo(() => {
    if (trimestre === 'custom') return dateDebut && dateFin ? `${dateDebut} → ${dateFin}` : 'Période personnalisée';
    if (trimestre === 'annuel') return `Annuel ${annee}`;
    return `${trimestre} ${annee}`;
  }, [trimestre, annee, dateDebut, dateFin]);

  /* ─── Génération ─────────────────────────────────────────────────────── */
  function generer() {
    if (selected.size === 0) return;
    const titre = `Rapport CSE — ${periodeLabel}`;
    const inclut = (id: string) => indics.has(id);

    if (format === 'excel') {
      const headers = ['Code', 'Projet', 'Domaine'];
      if (inclut('chef_projet'))       headers.push('Chef de projet');
      if (inclut('statut_global'))     headers.push('Statut');
      if (inclut('budget_global'))     headers.push('Budget (M FCFA)');
      if (inclut('budget_engage'))     headers.push('Engagé (M FCFA)');
      if (inclut('budget_decaisse'))   headers.push('Décaissé (M FCFA)');
      if (inclut('taux_engagement'))   headers.push('Tx Eng. %');
      if (inclut('taux_decaissement')) headers.push('Tx Déc. %');
      if (inclut('avancement_physique')) headers.push('Av. physique %');
      if (inclut('cpi'))               headers.push('CPI');
      if (inclut('spi'))               headers.push('SPI');
      if (inclut('date_debut'))        headers.push('Démarrage');
      if (inclut('date_fin_prevue'))   headers.push('Fin prév.');
      if (inclut('date_fin_maj'))      headers.push('Fin actualisée');

      const rows = selectedProjets.map(p => {
        const r: (string | number)[] = [p.code ?? '', p.nom, p.domaine ?? ''];
        if (inclut('chef_projet'))       r.push(p.chefProjet ?? '');
        if (inclut('statut_global'))     r.push(p.statut ?? '');
        if (inclut('budget_global'))     r.push(p.budget ?? 0);
        if (inclut('budget_engage'))     r.push(p.budgetEngage ?? 0);
        if (inclut('budget_decaisse'))   r.push(p.budgetDecaisse ?? 0);
        if (inclut('taux_engagement'))   r.push(p.budget ? Math.round((p.budgetEngage ?? 0) / p.budget * 100) : 0);
        if (inclut('taux_decaissement')) r.push(p.budget ? Math.round((p.budgetDecaisse ?? 0) / p.budget * 100) : 0);
        if (inclut('avancement_physique')) r.push(p.avancement ?? 0);
        if (inclut('cpi'))               r.push(p.cpi ?? 1);
        if (inclut('spi'))               r.push(p.spi ?? 1);
        if (inclut('date_debut'))        r.push(p.dateDebut ?? '');
        if (inclut('date_fin_prevue'))   r.push(p.dateFinPrevue ?? '');
        if (inclut('date_fin_maj'))      r.push(p.dateFinEstimee ?? '');
        return r;
      });

      downloadExcel(`Rapport_CSE_${periodeLabel.replace(/\s+/g, '_')}`, {
        sheetName: 'Rapport CSE',
        title: titre,
        subtitle: `SENELEC · DPE — ${selectedProjets.length} projet(s) consolidé(s)`,
        headers,
        rows,
      });
    } else {
      const pdfHdr = ['Code', 'Projet', 'Domaine'];
      if (inclut('statut_global'))     pdfHdr.push('Statut');
      if (inclut('budget_global'))     pdfHdr.push('Budget (M FCFA)');
      if (inclut('taux_decaissement')) pdfHdr.push('Tx Déc.');
      if (inclut('avancement_physique')) pdfHdr.push('Av. phys.');
      if (inclut('date_fin_prevue'))   pdfHdr.push('Fin prév.');

      const rows = selectedProjets.map(p => {
        const r: string[] = [p.code ?? '', p.nom, p.domaine ?? ''];
        if (inclut('statut_global'))     r.push(p.statut ?? '—');
        if (inclut('budget_global'))     r.push(`${(p.budget ?? 0).toLocaleString('fr-FR')} M`);
        if (inclut('taux_decaissement')) r.push(p.budget ? `${Math.round((p.budgetDecaisse ?? 0) / p.budget * 100)}%` : '—');
        if (inclut('avancement_physique')) r.push(`${p.avancement ?? 0}%`);
        if (inclut('date_fin_prevue'))   r.push(p.dateFinPrevue ?? '—');
        return r;
      });

      printBranded({
        title: titre,
        subtitle: `${selectedProjets.length} projets — ${periodeLabel}`,
        confidentiel: true,
        landscape: true,
        tables: [{ title: 'Tableau consolidé', headers: pdfHdr, rows, rightAlign: [4, 5, 6] }],
      });
    }
    onClose();
  }

  /* ─── Render ─────────────────────────────────────────────────────────── */
  return (
    <div
      onClick={e => { if (e.target === e.currentTarget) onClose(); }}
      style={{
        position: 'fixed', inset: 0, zIndex: 9000,
        background: 'rgba(15,10,30,0.6)', backdropFilter: 'blur(6px)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        padding: 20,
      }}
    >
      <div style={{
        background: '#fff', borderRadius: 20, width: '100%', maxWidth: 920,
        maxHeight: '92vh', display: 'flex', flexDirection: 'column',
        boxShadow: '0 40px 100px rgba(0,0,0,0.35)',
        overflow: 'hidden',
      }}>

        {/* ── Header ─────────────────────────────────────────────────── */}
        <div style={{ background: NAVY, padding: '18px 24px', display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', flexShrink: 0 }}>
          <div>
            <div style={{ fontSize: 16, fontWeight: 800, color: '#fff', letterSpacing: '-0.3px' }}>
              Rapport consolidé CSE
            </div>
            <div style={{ fontSize: 11.5, color: 'rgba(255,255,255,0.55)', marginTop: 3 }}>
              Comité de Suivi et d&apos;Évaluation · sélectionnez les projets, la période et les indicateurs
            </div>
          </div>
          <button onClick={onClose}
            style={{ background: 'rgba(255,255,255,0.12)', border: 'none', borderRadius: 8, padding: 8, cursor: 'pointer', color: '#fff', display: 'flex', marginTop: 2 }}>
            <X size={17} />
          </button>
        </div>

        {/* ── Corps — 2 colonnes ─────────────────────────────────────── */}
        <div style={{ flex: 1, display: 'flex', overflow: 'hidden', minHeight: 0 }}>

          {/* ════ COLONNE GAUCHE — Sélection projets ═══════════════════ */}
          <div style={{ width: '55%', borderRight: '1px solid #E8ECF4', display: 'flex', flexDirection: 'column' }}>
            {/* Titre section */}
            <div style={{ padding: '14px 20px 10px', borderBottom: '1px solid #E8ECF4', flexShrink: 0 }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: '#94A3B8', letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: 10 }}>
                Projets à consolider
              </div>

              {/* Barre de recherche */}
              <div style={{ position: 'relative', marginBottom: 10 }}>
                <Search size={14} style={{ position: 'absolute', left: 11, top: '50%', transform: 'translateY(-50%)', color: '#94A3B8', pointerEvents: 'none' }} />
                <input
                  ref={searchRef}
                  value={search}
                  onChange={e => setSearch(e.target.value)}
                  placeholder="Rechercher un projet, un code, un chef de projet…"
                  style={{
                    width: '100%', padding: '9px 12px 9px 34px',
                    border: '1.5px solid #E2E8F0', borderRadius: 10,
                    fontSize: 13, fontFamily: 'inherit', color: '#1E293B',
                    outline: 'none', boxSizing: 'border-box',
                    transition: 'border-color 0.15s',
                  }}
                  onFocus={e => (e.currentTarget.style.borderColor = NAVY)}
                  onBlur={e => (e.currentTarget.style.borderColor = '#E2E8F0')}
                />
              </div>

              {/* Filtre domaine */}
              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center' }}>
                {(['tous', ...domainesDispo] as string[]).map(d => {
                  const cfg = d !== 'tous' ? (DOMAINE_CFG[d as Domaine] ?? { label: d, color: '#64748B' }) : null;
                  const act = domFilter === d;
                  return (
                    <button key={d} onClick={() => setDomFilter(d)}
                      style={{
                        padding: '4px 11px', borderRadius: 20, fontSize: 11.5, fontWeight: 600, cursor: 'pointer',
                        border: `1.5px solid ${act ? (cfg?.color ?? NAVY) : '#E2E8F0'}`,
                        background: act ? (cfg?.color ?? NAVY) : '#fff',
                        color: act ? '#fff' : '#64748B',
                        transition: 'all 0.12s',
                      }}>
                      {d === 'tous' ? 'Tous les domaines' : (cfg?.label ?? d)}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Actions rapides */}
            <div style={{ padding: '7px 20px', background: '#FAFBFD', borderBottom: '1px solid #E8ECF4', display: 'flex', alignItems: 'center', gap: 12, flexShrink: 0 }}>
              <span style={{ fontSize: 11.5, color: '#64748B' }}>
                <strong style={{ color: NAVY }}>{listeFiltree.length}</strong> projet(s) trouvé(s)
              </span>
              <div style={{ flex: 1 }} />
              <button onClick={selectAll}
                style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 11.5, fontWeight: 600, color: NAVY, padding: 0 }}>
                Tout sélectionner
              </button>
              {selected.size > 0 && (
                <>
                  <span style={{ color: '#CBD5E1' }}>·</span>
                  <button onClick={clearAll}
                    style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 11.5, fontWeight: 600, color: '#DC2626', padding: 0 }}>
                    Tout effacer
                  </button>
                </>
              )}
            </div>

            {/* Liste scrollable */}
            <div style={{ flex: 1, overflowY: 'auto', padding: '4px 0' }}>
              {listeFiltree.length === 0 ? (
                <div style={{ padding: 32, textAlign: 'center', color: '#94A3B8', fontSize: 13 }}>
                  Aucun projet ne correspond à votre recherche
                </div>
              ) : listeFiltree.map(p => {
                const cfg = DOMAINE_CFG[p.domaine as Domaine] ?? { color: '#64748B', label: p.domaine ?? '' };
                const sel = selected.has(p.id);
                return (
                  <div key={p.id} onClick={() => toggle(p.id)}
                    style={{
                      display: 'flex', alignItems: 'center', gap: 12,
                      padding: '10px 20px', cursor: 'pointer',
                      background: sel ? `${NAVY}08` : 'transparent',
                      borderLeft: `3px solid ${sel ? NAVY : 'transparent'}`,
                      transition: 'all 0.1s',
                    }}
                    onMouseEnter={e => { if (!sel) (e.currentTarget as HTMLElement).style.background = '#F8FAFC'; }}
                    onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = sel ? `${NAVY}08` : 'transparent'; }}
                  >
                    {/* Checkbox */}
                    <div style={{
                      width: 18, height: 18, borderRadius: 5, flexShrink: 0,
                      border: `2px solid ${sel ? NAVY : '#CBD5E1'}`,
                      background: sel ? NAVY : '#fff',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      transition: 'all 0.1s',
                    }}>
                      {sel && <Check size={11} color="#fff" strokeWidth={3} />}
                    </div>

                    {/* Infos projet */}
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 12.5, fontWeight: sel ? 700 : 500, color: '#1E293B', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                        {p.nom}
                      </div>
                      <div style={{ fontSize: 11, color: '#94A3B8', marginTop: 2 }}>
                        {p.code} · {p.chefProjet}
                      </div>
                    </div>

                    {/* Badge domaine */}
                    <span style={{
                      fontSize: 10, fontWeight: 700, flexShrink: 0,
                      color: cfg.color, background: `${cfg.color}14`,
                      padding: '2px 8px', borderRadius: 20,
                    }}>
                      {cfg.label}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>

          {/* ════ COLONNE DROITE — Configuration ════════════════════════ */}
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflowY: 'auto' }}>

            {/* Projets sélectionnés (résumé) */}
            <div style={{ padding: '14px 20px', borderBottom: '1px solid #E8ECF4', flexShrink: 0 }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: '#94A3B8', letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: 10 }}>
                Sélection
              </div>
              {selected.size === 0 ? (
                <div style={{ fontSize: 12, color: '#CBD5E1', fontStyle: 'italic' }}>Aucun projet sélectionné</div>
              ) : (
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                  {selectedProjets.slice(0, 6).map(p => (
                    <div key={p.id}
                      onClick={() => toggle(p.id)}
                      title={p.nom}
                      style={{
                        display: 'flex', alignItems: 'center', gap: 5,
                        padding: '4px 10px', borderRadius: 20, cursor: 'pointer',
                        background: `${NAVY}10`, border: `1px solid ${NAVY}25`,
                        fontSize: 11, fontWeight: 600, color: NAVY,
                        maxWidth: 160, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                      }}>
                      <span style={{ overflow: 'hidden', textOverflow: 'ellipsis' }}>{p.code ?? p.nom}</span>
                      <X size={10} style={{ flexShrink: 0 }} />
                    </div>
                  ))}
                  {selected.size > 6 && (
                    <div style={{ padding: '4px 10px', borderRadius: 20, background: '#F1F5F9', fontSize: 11, fontWeight: 600, color: '#64748B' }}>
                      +{selected.size - 6} autres
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Période */}
            <div style={{ padding: '14px 20px', borderBottom: '1px solid #E8ECF4', flexShrink: 0 }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: '#94A3B8', letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: 10 }}>
                Période
              </div>

              {/* Année */}
              <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 10 }}>
                <span style={{ fontSize: 12, color: '#64748B', fontWeight: 600, minWidth: 40 }}>Année</span>
                {[annee - 1, annee, annee + 1].map(a => (
                  <button key={a} onClick={() => setAnnee(a)}
                    style={{
                      padding: '5px 14px', borderRadius: 8, border: `1.5px solid ${annee === a ? NAVY : '#E2E8F0'}`,
                      background: annee === a ? NAVY : '#fff', color: annee === a ? '#fff' : '#475569',
                      fontSize: 13, fontWeight: annee === a ? 700 : 400, cursor: 'pointer',
                    }}>
                    {a}
                  </button>
                ))}
              </div>

              {/* Trimestre */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 6 }}>
                {TRIMESTRES.map(t => (
                  <button key={t.value} onClick={() => setTrimestre(t.value)}
                    style={{
                      padding: '7px 6px', borderRadius: 8,
                      border: `1.5px solid ${trimestre === t.value ? ORANGE : '#E2E8F0'}`,
                      background: trimestre === t.value ? `${ORANGE}10` : '#fff',
                      color: trimestre === t.value ? ORANGE : '#475569',
                      fontSize: 11.5, fontWeight: trimestre === t.value ? 700 : 400, cursor: 'pointer',
                      textAlign: 'center', lineHeight: 1.3,
                    }}>
                    <div style={{ fontWeight: 700 }}>{t.short}</div>
                    <div style={{ fontSize: 10, color: trimestre === t.value ? `${ORANGE}CC` : '#94A3B8', marginTop: 1 }}>
                      {t.label.split('—')[1]?.trim() || ''}
                    </div>
                  </button>
                ))}
              </div>

              {/* Dates custom */}
              {trimestre === 'custom' && (
                <div style={{ display: 'flex', gap: 8, marginTop: 10 }}>
                  <div style={{ flex: 1 }}>
                    <label style={{ fontSize: 11, color: '#64748B', fontWeight: 600, display: 'block', marginBottom: 4 }}>Du</label>
                    <input type="date" value={dateDebut} onChange={e => setDateDebut(e.target.value)}
                      style={{ width: '100%', padding: '7px 10px', border: '1.5px solid #E2E8F0', borderRadius: 8, fontSize: 12, fontFamily: 'inherit', boxSizing: 'border-box' }} />
                  </div>
                  <div style={{ flex: 1 }}>
                    <label style={{ fontSize: 11, color: '#64748B', fontWeight: 600, display: 'block', marginBottom: 4 }}>Au</label>
                    <input type="date" value={dateFin} onChange={e => setDateFin(e.target.value)}
                      style={{ width: '100%', padding: '7px 10px', border: '1.5px solid #E2E8F0', borderRadius: 8, fontSize: 12, fontFamily: 'inherit', boxSizing: 'border-box' }} />
                  </div>
                </div>
              )}
            </div>

            {/* Indicateurs */}
            <div style={{ padding: '14px 20px', borderBottom: '1px solid #E8ECF4', flexShrink: 0 }}>
              <button
                onClick={() => setShowIndics(v => !v)}
                style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: 'none', border: 'none', cursor: 'pointer', padding: 0, textAlign: 'left' }}>
                <div style={{ fontSize: 11, fontWeight: 700, color: '#94A3B8', letterSpacing: '0.08em', textTransform: 'uppercase' }}>
                  Indicateurs
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <span style={{ fontSize: 11, background: `${NAVY}10`, color: NAVY, fontWeight: 700, padding: '2px 8px', borderRadius: 20 }}>
                    {indics.size} sél.
                  </span>
                  {showIndics ? <ChevronUp size={14} color="#94A3B8" /> : <ChevronDown size={14} color="#94A3B8" />}
                </div>
              </button>

              {showIndics && (
                <div style={{ marginTop: 10 }}>
                  {INDIC_GROUPS.map(g => (
                    <div key={g.label} style={{ marginBottom: 10 }}>
                      <div style={{ fontSize: 10, fontWeight: 700, color: '#CBD5E1', letterSpacing: '0.06em', textTransform: 'uppercase', marginBottom: 6 }}>
                        {g.label}
                      </div>
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5 }}>
                        {g.items.map(ind => {
                          const on = indics.has(ind.id);
                          return (
                            <button key={ind.id} onClick={() => toggleIndic(ind.id)}
                              style={{
                                padding: '4px 10px', borderRadius: 20, fontSize: 11, fontWeight: on ? 600 : 400, cursor: 'pointer',
                                border: `1.5px solid ${on ? NAVY : '#E2E8F0'}`,
                                background: on ? NAVY : '#fff',
                                color: on ? '#fff' : '#64748B',
                                transition: 'all 0.12s',
                              }}>
                              {ind.label}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Format */}
            <div style={{ padding: '14px 20px', flexShrink: 0 }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: '#94A3B8', letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: 10 }}>
                Format d&apos;export
              </div>
              <div style={{ display: 'flex', gap: 8 }}>
                {([
                  { value: 'excel', icon: <FileSpreadsheet size={20} />, label: 'Excel (.xlsx)', sub: 'Tableau analysable' },
                  { value: 'pdf',   icon: <FileText size={20} />,        label: 'PDF imprimable', sub: 'Rapport formaté DPE' },
                ] as { value: Format; icon: React.ReactNode; label: string; sub: string }[]).map(f => (
                  <button key={f.value} onClick={() => setFormat(f.value)}
                    style={{
                      flex: 1, padding: '12px 14px', borderRadius: 12, cursor: 'pointer', textAlign: 'left',
                      border: `2px solid ${format === f.value ? NAVY : '#E2E8F0'}`,
                      background: format === f.value ? LIGHT : '#fff',
                      transition: 'all 0.12s',
                    }}>
                    <div style={{ color: format === f.value ? NAVY : '#94A3B8', marginBottom: 6 }}>{f.icon}</div>
                    <div style={{ fontSize: 12.5, fontWeight: 700, color: format === f.value ? NAVY : '#334155' }}>{f.label}</div>
                    <div style={{ fontSize: 10.5, color: '#94A3B8', marginTop: 2 }}>{f.sub}</div>
                  </button>
                ))}
              </div>
            </div>

          </div>
        </div>

        {/* ── Footer ─────────────────────────────────────────────────── */}
        <div style={{
          padding: '14px 24px', borderTop: '1px solid #E8ECF4',
          background: '#FAFBFD', display: 'flex', alignItems: 'center',
          justifyContent: 'space-between', gap: 12, flexShrink: 0,
        }}>
          <div style={{ fontSize: 12.5, color: '#64748B' }}>
            {selected.size === 0 ? (
              <span style={{ color: '#CBD5E1', fontStyle: 'italic' }}>Aucun projet sélectionné</span>
            ) : (
              <>
                <strong style={{ color: NAVY }}>{selected.size}</strong> projet(s) ·{' '}
                <span style={{ color: ORANGE, fontWeight: 600 }}>{periodeLabel}</span> ·{' '}
                {format === 'excel' ? 'Excel' : 'PDF'}
              </>
            )}
          </div>
          <div style={{ display: 'flex', gap: 10 }}>
            <button onClick={onClose}
              style={{ padding: '9px 20px', borderRadius: 9, border: '1.5px solid #E2E8F0', background: '#fff', fontSize: 13, fontWeight: 600, cursor: 'pointer', color: '#475569' }}>
              Annuler
            </button>
            <button onClick={generer} disabled={selected.size === 0}
              style={{
                padding: '9px 22px', borderRadius: 9, border: 'none', fontSize: 13, fontWeight: 700,
                cursor: selected.size === 0 ? 'not-allowed' : 'pointer',
                background: selected.size === 0 ? '#E2E8F0' : ORANGE,
                color: selected.size === 0 ? '#94A3B8' : '#fff',
                display: 'flex', alignItems: 'center', gap: 7,
                transition: 'all 0.15s',
              }}>
              <Download size={15} /> Générer le rapport
            </button>
          </div>
        </div>

      </div>
    </div>
  );
}

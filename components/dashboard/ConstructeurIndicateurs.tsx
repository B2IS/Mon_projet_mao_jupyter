'use client';
/**
 * ConstructeurIndicateurs.tsx — Constructeur d'Indicateurs (KPI Builder)
 * ----------------------------------------------------------------------
 * Configuration d'indicateurs personnalisés à partir des données de la
 * plateforme (portefeuille projets), par glisser-déposer de champs/fonctions
 * et saisie de formules libres, avec aperçu en temps réel.
 *
 * Aligné sur les indicateurs du Rapport Trimestriel DPE (taux de réalisation
 * physique/financière, CPI/SPI, décaissement, projets en retard…).
 */

import React, { useMemo, useRef, useState } from 'react';
import {
  Calculator, Trash2, Save, Sparkles, RotateCcw, Target,
  GripVertical, Sigma, Hash, Database, X, Pencil, AlertCircle,
  Filter, CheckSquare, Square, ChevronDown, ChevronRight, ListChecks,
  Boxes, Download,
} from 'lucide-react';
import { useProjectStore } from '@/lib/projectStore';
import { useImmobilisationStore, amortissementCumule, valeurNetteComptable } from '@/lib/immobilisationStore';
import { useTimesheetStore } from '@/lib/timesheetStore';
import { COURRIERS, ALERTES_WORKFLOW } from '@/lib/data';
import { DPE_EFFECTIF } from '@/lib/authStore';
import { useTranslation } from '@/lib/i18n/I18nContext';
import {
  useIndicatorStore, evaluateFormula, formatIndicator, ragStatus, RAG_COLORS,
  INDICATOR_FIELDS, INDICATOR_FUNCTIONS, INDICATOR_OPERATORS,
  type IndicatorUnit, type CustomIndicator, type IndicatorProjet, type ThresholdDirection,
} from '@/lib/indicatorStore';

// ─── Libellés bilingues de la page ───────────────────────────────────────────
function useL() {
  const { lang } = useTranslation();
  const fr = {
    title: 'Constructeur d\'Indicateurs',
    subtitle: 'Composez vos KPI à partir des données du portefeuille — glisser-déposer, formules, cibles.',
    fields: 'Champs (données projet)', functions: 'Fonctions d\'agrégation', operators: 'Opérateurs & constantes',
    formula: 'Formule de l\'indicateur', dropHint: 'Glissez des champs/fonctions ici ou cliquez pour insérer',
    preview: 'Aperçu en temps réel', basedOn: 'Calculé sur', projects: 'projet(s) visible(s)',
    name: 'Nom de l\'indicateur', unit: 'Unité', target: 'Cible', thresholds: 'Seuils (RAG)',
    good: 'Bon (vert)', warn: 'Alerte (ambre)', direction: 'Sens', higher: 'Plus haut = mieux', lower: 'Plus bas = mieux',
    save: 'Enregistrer l\'indicateur', update: 'Mettre à jour', clear: 'Réinitialiser', cancelEdit: 'Annuler l\'édition',
    saved: 'Indicateurs enregistrés', noSaved: 'Aucun indicateur. Chargez des modèles ou créez le vôtre.',
    loadTemplates: 'Charger les modèles DPE', edit: 'Modifier', del: 'Supprimer',
    vsTarget: 'vs cible', invalid: 'Formule invalide ou indéfinie', empty: 'Saisissez une formule',
    pct: 'Pourcentage (%)', money: 'Montant (M FCFA)', count: 'Nombre', ratio: 'Ratio',
    insertField: 'Insérer un champ', help: 'Astuce : combinez agrégations et opérateurs, ex. SUM(budgetDecaisse) / SUM(budget) * 100',
    data: 'Données — sélection des projets', dataHint: 'Filtrez et cochez les projets à inclure dans le calcul.',
    allDomaines: 'Tous les domaines', allStatuts: 'Tous les statuts', allProgrammes: 'Tous les programmes',
    selectAll: 'Tout cocher', selectNone: 'Tout décocher', selected: 'sélectionné(s)', of: 'sur',
    colProject: 'Projet', colBudget: 'Budget', colDecaisse: 'Décaissé', colAvct: 'Avct.', colStatut: 'Statut',
    showData: 'Afficher les données', hideData: 'Masquer les données', noData: 'Aucun projet ne correspond aux filtres.',
    appData: 'Données de l\'application', appVars: 'Variables — toutes les données de l\'application',
    appDataHint: 'Importez en un clic les métriques de tous les modules (portefeuille, immobilisations, RH, courriers, alertes…) et utilisez-les comme variables dans vos formules.',
    importBtn: 'Importer les données', importedBadge: 'Données importées', reimport: 'Réactualiser', notImported: 'Cliquez pour importer les données de l\'application.',
    varsCount: 'variable(s) disponible(s)',
    viewAllData: 'Afficher toutes les données', allDataTitle: 'Toutes les données de l\'application',
    allDataHint: 'Vue d\'ensemble de toutes les métriques de la plateforme. Cliquez « Insérer » pour utiliser une donnée comme variable dans votre formule.',
    colVar: 'Donnée', colValueH: 'Valeur', colKeyH: 'Variable (formule)', insertVar: 'Insérer', close: 'Fermer', copyKey: 'Copier',
  };
  const en = {
    title: 'Indicator Builder',
    subtitle: 'Compose your KPIs from portfolio data — drag-and-drop, formulas, targets.',
    fields: 'Fields (project data)', functions: 'Aggregation functions', operators: 'Operators & constants',
    formula: 'Indicator formula', dropHint: 'Drag fields/functions here or click to insert',
    preview: 'Live preview', basedOn: 'Computed on', projects: 'visible project(s)',
    name: 'Indicator name', unit: 'Unit', target: 'Target', thresholds: 'Thresholds (RAG)',
    good: 'Good (green)', warn: 'Warning (amber)', direction: 'Direction', higher: 'Higher is better', lower: 'Lower is better',
    save: 'Save indicator', update: 'Update', clear: 'Reset', cancelEdit: 'Cancel edit',
    saved: 'Saved indicators', noSaved: 'No indicators yet. Load templates or create your own.',
    loadTemplates: 'Load DPE templates', edit: 'Edit', del: 'Delete',
    vsTarget: 'vs target', invalid: 'Invalid or undefined formula', empty: 'Enter a formula',
    pct: 'Percentage (%)', money: 'Amount (M FCFA)', count: 'Number', ratio: 'Ratio',
    insertField: 'Insert a field', help: 'Tip: combine aggregations and operators, e.g. SUM(budgetDecaisse) / SUM(budget) * 100',
    data: 'Data — project selection', dataHint: 'Filter and tick the projects to include in the calculation.',
    allDomaines: 'All domains', allStatuts: 'All statuses', allProgrammes: 'All programmes',
    selectAll: 'Select all', selectNone: 'Clear', selected: 'selected', of: 'of',
    colProject: 'Project', colBudget: 'Budget', colDecaisse: 'Disbursed', colAvct: 'Prog.', colStatut: 'Status',
    showData: 'Show data', hideData: 'Hide data', noData: 'No project matches the filters.',
    appData: 'Application data', appVars: 'Variables — all application data',
    appDataHint: 'Import metrics from every module (portfolio, assets, HR, mail, alerts…) in one click and use them as variables in your formulas.',
    importBtn: 'Import data', importedBadge: 'Data imported', reimport: 'Refresh', notImported: 'Click to import the application data.',
    varsCount: 'variable(s) available',
    viewAllData: 'Show all data', allDataTitle: 'All application data',
    allDataHint: 'Overview of every platform metric. Click "Insert" to use a data point as a variable in your formula.',
    colVar: 'Data point', colValueH: 'Value', colKeyH: 'Variable (formula)', insertVar: 'Insert', close: 'Close', copyKey: 'Copy',
  };
  return { L: lang === 'en' ? en : fr, lang };
}

const UNIT_OPTIONS: { value: IndicatorUnit; fr: string; en: string }[] = [
  { value: 'percent', fr: 'Pourcentage (%)', en: 'Percentage (%)' },
  { value: 'fcfa',    fr: 'Montant (M FCFA)', en: 'Amount (M FCFA)' },
  { value: 'number',  fr: 'Nombre',          en: 'Number' },
  { value: 'ratio',   fr: 'Ratio',           en: 'Ratio' },
];

const card: React.CSSProperties = {
  background: '#fff', border: '1px solid #E2E8F0', borderRadius: 12, padding: 16,
};
const chip = (bg: string, color: string): React.CSSProperties => ({
  display: 'inline-flex', alignItems: 'center', gap: 6, padding: '5px 10px', borderRadius: 8,
  background: bg, color, fontSize: 12.5, fontWeight: 600, cursor: 'grab', userSelect: 'none',
  border: `1px solid ${color}22`, whiteSpace: 'nowrap',
});

/** Définition d'une variable importée de l'application (donnée globale). */
interface AppVarDef { key: string; fr: string; en: string; unit: IndicatorUnit; value: number; group: string; }

export default function ConstructeurIndicateurs() {
  const { L, lang } = useL();
  const { projets } = useProjectStore();
  const { indicators, add, update, remove, seedTemplates } = useIndicatorStore();
  const immobilisations = useImmobilisationStore(s => s.immobilisations);
  const tsEntries = useTimesheetStore(s => s.entries);

  // ── Import « toutes les données de l'application » : métriques globales ──
  // Activable par l'utilisateur ; une fois importées, les variables (MAJUSCULES)
  // sont utilisables directement dans n'importe quelle formule personnalisée.
  const [appImported, setAppImported] = useState(true);
  const [showAllData, setShowAllData] = useState(false);

  const appVarDefs = useMemo<AppVarDef[]>(() => {
    const sum = (arr: number[]) => arr.reduce((a, b) => a + b, 0);
    const now = new Date();
    // Portefeuille projets (tout le périmètre visible, indépendamment de la sélection)
    const pf = {
      NB_PROJETS:        projets.length,
      BUDGET_TOTAL:      sum(projets.map(p => p.budget)),
      BUDGET_ENGAGE:     sum(projets.map(p => p.budgetEngage)),
      BUDGET_DECAISSE:   sum(projets.map(p => p.budgetDecaisse)),
      NB_PROJETS_RETARD: projets.filter(p => p.statut === 'en_retard').length,
      NB_PROJETS_TERMINE:projets.filter(p => p.statut === 'termine').length,
      NB_PROJETS_ACTIF:  projets.filter(p => p.statut === 'en_cours').length,
    };
    // Immobilisations
    const immoVnc = sum(immobilisations.map(i => valeurNetteComptable(i, now)));
    const immoCumul = sum(immobilisations.map(i => amortissementCumule(i, now)));
    // RH / Feuilles de temps
    const rhHeures = sum(tsEntries.map(e => e.heures));
    const rhCout = sum(tsEntries.map(e => e.coutCalcule ?? 0));
    // Courriers & alertes (données applicatives)
    const courriersEnAttente = COURRIERS.filter(c => c.statut === 'recu' || c.statut === 'en_cours_traitement' || c.statut === 'en_attente_visa').length;
    const alertesNouvelles = ALERTES_WORKFLOW.filter(a => a.statut === 'nouvelle').length;

    return [
      { key: 'NB_PROJETS',         fr: 'Nombre de projets (total)',       en: 'Total projects',            unit: 'number',  value: pf.NB_PROJETS,        group: 'Portefeuille' },
      { key: 'BUDGET_TOTAL',       fr: 'Budget total portefeuille',       en: 'Total portfolio budget',    unit: 'fcfa',    value: pf.BUDGET_TOTAL,      group: 'Portefeuille' },
      { key: 'BUDGET_ENGAGE',      fr: 'Budget engagé (total)',           en: 'Total committed budget',    unit: 'fcfa',    value: pf.BUDGET_ENGAGE,     group: 'Portefeuille' },
      { key: 'BUDGET_DECAISSE',    fr: 'Budget décaissé (total)',         en: 'Total disbursed budget',    unit: 'fcfa',    value: pf.BUDGET_DECAISSE,   group: 'Portefeuille' },
      { key: 'NB_PROJETS_RETARD',  fr: 'Projets en retard',               en: 'Delayed projects',          unit: 'number',  value: pf.NB_PROJETS_RETARD, group: 'Portefeuille' },
      { key: 'NB_PROJETS_TERMINE', fr: 'Projets terminés',                en: 'Completed projects',        unit: 'number',  value: pf.NB_PROJETS_TERMINE,group: 'Portefeuille' },
      { key: 'NB_PROJETS_ACTIF',   fr: 'Projets en cours',                en: 'Active projects',           unit: 'number',  value: pf.NB_PROJETS_ACTIF,  group: 'Portefeuille' },
      { key: 'IMMO_NB',            fr: 'Nombre d\'immobilisations',       en: 'Assets count',              unit: 'number',  value: immobilisations.length, group: 'Immobilisations' },
      { key: 'IMMO_VALEUR_BRUTE',  fr: 'Valeur brute immobilisations',    en: 'Gross asset value',         unit: 'fcfa',    value: sum(immobilisations.map(i => i.valeurAcquisition)), group: 'Immobilisations' },
      { key: 'IMMO_VNC',           fr: 'Valeur nette comptable (VNC)',    en: 'Net book value',            unit: 'fcfa',    value: immoVnc,              group: 'Immobilisations' },
      { key: 'IMMO_AMORT_CUMUL',   fr: 'Amortissements cumulés',          en: 'Accumulated depreciation',  unit: 'fcfa',    value: immoCumul,            group: 'Immobilisations' },
      { key: 'RH_NB_SAISIES',      fr: 'Saisies de temps (RH)',           en: 'Timesheet entries',         unit: 'number',  value: tsEntries.length,     group: 'RH / Temps' },
      { key: 'RH_HEURES_TOTAL',    fr: 'Heures saisies (total)',          en: 'Total logged hours',        unit: 'number',  value: rhHeures,             group: 'RH / Temps' },
      { key: 'RH_COUT_TOTAL',      fr: 'Coût RH calculé (total)',         en: 'Total computed labor cost', unit: 'fcfa',    value: rhCout / 1_000_000,   group: 'RH / Temps' },
      { key: 'COURRIERS_NB',       fr: 'Courriers (total)',               en: 'Mail items',                unit: 'number',  value: COURRIERS.length,     group: 'Courriers & Alertes' },
      { key: 'COURRIERS_EN_ATTENTE',fr: 'Courriers en attente',          en: 'Pending mail',              unit: 'number',  value: courriersEnAttente,   group: 'Courriers & Alertes' },
      { key: 'ALERTES_NOUVELLES',  fr: 'Alertes nouvelles',               en: 'New alerts',                unit: 'number',  value: alertesNouvelles,     group: 'Courriers & Alertes' },
      { key: 'EFFECTIF_DPE',       fr: 'Effectif total DPE',              en: 'Total DPE headcount',       unit: 'number',  value: DPE_EFFECTIF.total,   group: 'Organisation' },
    ];
  }, [projets, immobilisations, tsEntries]);

  // Map NOM → valeur, passée à l'évaluateur (uniquement si l'import est actif).
  const appVars = useMemo<Record<string, number>>(() => {
    if (!appImported) return {};
    return Object.fromEntries(appVarDefs.map(v => [v.key, v.value]));
  }, [appImported, appVarDefs]);

  // ── Sélection des données : filtres + cases à cocher par projet ──
  const [selDomaine, setSelDomaine] = useState<string>('all');
  const [selStatut, setSelStatut] = useState<string>('all');
  const [selProgramme, setSelProgramme] = useState<string>('all');
  const [excluded, setExcluded] = useState<Set<string>>(() => new Set());
  const [showData, setShowData] = useState(true);

  // Listes d'options dérivées du périmètre visible (jamais hors-scope)
  const domaineOpts = useMemo(() => [...new Set(projets.map(p => p.domaine))].sort(), [projets]);
  const statutOpts = useMemo(() => [...new Set(projets.map(p => p.statut))].sort(), [projets]);
  const programmeOpts = useMemo(
    () => [...new Set(projets.map(p => p.programme).filter((x): x is string => !!x))].sort(),
    [projets]
  );

  // Projets après filtres dropdown
  const filtered = useMemo(
    () => projets.filter(p =>
      (selDomaine === 'all' || p.domaine === selDomaine) &&
      (selStatut === 'all' || p.statut === selStatut) &&
      (selProgramme === 'all' || p.programme === selProgramme)
    ),
    [projets, selDomaine, selStatut, selProgramme]
  );

  // Projets effectivement retenus pour le calcul (filtrés ET cochés)
  const selected = useMemo(() => filtered.filter(p => !excluded.has(p.id)), [filtered, excluded]);

  function toggleProject(id: string) {
    setExcluded(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }
  function selectAll() { setExcluded(new Set()); }
  function selectNone() { setExcluded(new Set(filtered.map(p => p.id))); }

  // Projets ramenés à la forme attendue par l'évaluateur (sélection courante)
  const evalProjets = useMemo<IndicatorProjet[]>(
    () => selected.map(p => ({
      budget: p.budget, budgetEngage: p.budgetEngage, budgetDecaisse: p.budgetDecaisse,
      avancement: p.avancement, avancementPlanifie: p.avancementPlanifie, avancementReel: p.avancementReel,
      cpi: p.cpi, spi: p.spi, statut: p.statut,
    })),
    [selected]
  );

  // État de l'éditeur
  const [editingId, setEditingId] = useState<string | null>(null);
  const [name, setName] = useState('');
  const [formula, setFormula] = useState('SUM(budgetDecaisse) / SUM(budget) * 100');
  const [unit, setUnit] = useState<IndicatorUnit>('percent');
  const [target, setTarget] = useState<string>('80');
  const [good, setGood] = useState<string>('80');
  const [warn, setWarn] = useState<string>('50');
  const [direction, setDirection] = useState<ThresholdDirection>('higher');
  const taRef = useRef<HTMLTextAreaElement>(null);

  const result = useMemo(() => evaluateFormula(formula, evalProjets, appVars), [formula, evalProjets, appVars]);
  const thresholds = useMemo(() => ({
    good: parseFloat(good) || 0, warn: parseFloat(warn) || 0, direction,
  }), [good, warn, direction]);
  const rag = ragStatus(result.value, thresholds);

  // Insertion d'un jeton dans la formule (au curseur, ou en fin)
  function insertToken(token: string) {
    const ta = taRef.current;
    if (!ta) { setFormula(f => (f + ' ' + token).trim()); return; }
    const start = ta.selectionStart ?? formula.length;
    const end = ta.selectionEnd ?? formula.length;
    const before = formula.slice(0, start);
    const after = formula.slice(end);
    const pad = before && !before.endsWith(' ') && !before.endsWith('(') ? ' ' : '';
    const next = `${before}${pad}${token}${after}`;
    setFormula(next);
    requestAnimationFrame(() => {
      ta.focus();
      const pos = (before + pad + token).length;
      ta.setSelectionRange(pos, pos);
    });
  }

  function resetEditor() {
    setEditingId(null); setName(''); setFormula(''); setUnit('percent');
    setTarget(''); setGood(''); setWarn(''); setDirection('higher');
  }

  function loadForEdit(ind: CustomIndicator) {
    setEditingId(ind.id); setName(ind.name); setFormula(ind.formula); setUnit(ind.unit);
    setTarget(ind.target?.toString() ?? '');
    setGood(ind.thresholds?.good?.toString() ?? '');
    setWarn(ind.thresholds?.warn?.toString() ?? '');
    setDirection(ind.thresholds?.direction ?? 'higher');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  function handleSave() {
    if (!name.trim() || !formula.trim()) return;
    const hasThresholds = good !== '' || warn !== '';
    const payload = {
      name: name.trim(),
      formula: formula.trim(),
      unit,
      target: target !== '' ? parseFloat(target) : undefined,
      thresholds: hasThresholds ? thresholds : undefined,
    };
    if (editingId) update(editingId, payload);
    else add(payload);
    resetEditor();
  }

  const canSave = name.trim() !== '' && formula.trim() !== '' && result.ok;

  return (
    <div style={{ padding: 20, maxWidth: 1280, margin: '0 auto', width: '100%' }}>
      {/* En-tête */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 6, flexWrap: 'wrap' }}>
        <div style={{ width: 40, height: 40, borderRadius: 10, background: '#EEF2FF', display: 'grid', placeItems: 'center' }}>
          <Calculator size={22} style={{ color: '#4338CA' }} />
        </div>
        <div>
          <h1 style={{ fontSize: 20, fontWeight: 800, color: '#0F172A', margin: 0 }}>{L.title}</h1>
          <p style={{ fontSize: 13, color: '#64748B', margin: '2px 0 0' }}>{L.subtitle}</p>
        </div>
        <button
          onClick={() => { setAppImported(true); setShowAllData(true); }}
          style={{ ...btnPrimary, marginLeft: 'auto', background: '#7C3AED' }}
        >
          <Database size={16} /> {L.viewAllData}
        </button>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0,1fr) 340px', gap: 16, marginTop: 16, alignItems: 'start' }} className="indic-grid">
        {/* ───── Colonne gauche : éditeur ───── */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16, minWidth: 0 }}>
          {/* Données — sélection des projets */}
          <div style={card}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, flexWrap: 'wrap' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12.5, fontWeight: 700, color: '#334155' }}>
                <ListChecks size={15} style={{ color: '#4338CA' }} /> {L.data}
              </div>
              <button onClick={() => setShowData(s => !s)} style={{ ...btnGhost, padding: '5px 10px', fontSize: 12 }}>
                {showData ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                {showData ? L.hideData : L.showData}
              </button>
            </div>
            <p style={{ fontSize: 11.5, color: '#94A3B8', margin: '6px 0 10px' }}>{L.dataHint}</p>

            {/* Filtres */}
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 10 }}>
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, color: '#64748B', fontSize: 12 }}>
                <Filter size={13} />
              </span>
              <select value={selDomaine} onChange={e => setSelDomaine(e.target.value)} style={selStyle}>
                <option value="all">{L.allDomaines}</option>
                {domaineOpts.map(d => <option key={d} value={d}>{d}</option>)}
              </select>
              <select value={selStatut} onChange={e => setSelStatut(e.target.value)} style={selStyle}>
                <option value="all">{L.allStatuts}</option>
                {statutOpts.map(s => <option key={s} value={s}>{s}</option>)}
              </select>
              {programmeOpts.length > 0 && (
                <select value={selProgramme} onChange={e => setSelProgramme(e.target.value)} style={selStyle}>
                  <option value="all">{L.allProgrammes}</option>
                  {programmeOpts.map(pr => <option key={pr} value={pr}>{pr}</option>)}
                </select>
              )}
            </div>

            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, flexWrap: 'wrap', marginBottom: 8 }}>
              <span style={{ fontSize: 12, fontWeight: 700, color: '#0F172A' }}>
                {selected.length} {L.selected} {L.of} {filtered.length}
              </span>
              <div style={{ display: 'flex', gap: 6 }}>
                <button onClick={selectAll} style={{ ...btnGhost, padding: '4px 9px', fontSize: 11.5 }}><CheckSquare size={13} /> {L.selectAll}</button>
                <button onClick={selectNone} style={{ ...btnGhost, padding: '4px 9px', fontSize: 11.5 }}><Square size={13} /> {L.selectNone}</button>
              </div>
            </div>

            {showData && (
              filtered.length === 0 ? (
                <p style={{ color: '#64748B', fontSize: 12.5, margin: '8px 0' }}>{L.noData}</p>
              ) : (
                <div style={{ maxHeight: 260, overflow: 'auto', border: '1px solid #E2E8F0', borderRadius: 8 }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
                    <thead>
                      <tr style={{ background: '#F8FAFC', position: 'sticky', top: 0 }}>
                        <th style={thStyle}></th>
                        <th style={{ ...thStyle, textAlign: 'left' }}>{L.colProject}</th>
                        <th style={thStyle}>{L.colBudget}</th>
                        <th style={thStyle}>{L.colDecaisse}</th>
                        <th style={thStyle}>{L.colAvct}</th>
                        <th style={{ ...thStyle, textAlign: 'left' }}>{L.colStatut}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filtered.map(p => {
                        const on = !excluded.has(p.id);
                        return (
                          <tr key={p.id} onClick={() => toggleProject(p.id)}
                            style={{ borderTop: '1px solid #F1F5F9', cursor: 'pointer', opacity: on ? 1 : 0.45, background: on ? '#fff' : '#F8FAFC' }}>
                            <td style={{ ...tdStyle, textAlign: 'center' }}>
                              {on ? <CheckSquare size={15} style={{ color: '#16A34A' }} /> : <Square size={15} style={{ color: '#94A3B8' }} />}
                            </td>
                            <td style={{ ...tdStyle, textAlign: 'left', fontWeight: 600, color: '#0F172A' }}>
                              {p.nom}
                              <span style={{ display: 'block', fontSize: 10.5, color: '#94A3B8', fontWeight: 500 }}>
                                {p.domaine}{p.programme ? ` · ${p.programme}` : ''}
                              </span>
                            </td>
                            <td style={{ ...tdStyle, textAlign: 'right' }}>{p.budget.toLocaleString('fr-FR')}</td>
                            <td style={{ ...tdStyle, textAlign: 'right' }}>{p.budgetDecaisse.toLocaleString('fr-FR')}</td>
                            <td style={{ ...tdStyle, textAlign: 'right' }}>{p.avancement}%</td>
                            <td style={{ ...tdStyle, textAlign: 'left', color: '#64748B' }}>{p.statut}</td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )
            )}
          </div>

          {/* Palette */}
          <div style={card}>
            <PaletteBlock icon={<Database size={14} />} title={L.fields}>
              {INDICATOR_FIELDS.map(f => (
                <DragChip key={f.key as string} label={lang === 'en' ? f.en : f.fr} token={f.key as string}
                  bg="#ECFDF5" color="#047857" onInsert={insertToken} />
              ))}
            </PaletteBlock>
            <PaletteBlock icon={<Sigma size={14} />} title={L.functions}>
              {INDICATOR_FUNCTIONS.map(fn => (
                <DragChip key={fn.key} label={`${fn.key} — ${lang === 'en' ? fn.en : fn.fr}`} token={fn.snippet}
                  bg="#EFF6FF" color="#1D4ED8" onInsert={insertToken} />
              ))}
            </PaletteBlock>
            <PaletteBlock icon={<Hash size={14} />} title={L.operators}>
              {INDICATOR_OPERATORS.map(op => (
                <DragChip key={op} label={op} token={op} bg="#F1F5F9" color="#334155" onInsert={insertToken} />
              ))}
            </PaletteBlock>
          </div>

          {/* Données de l'application — variables importables */}
          <div style={{ ...card, borderLeft: `4px solid ${appImported ? '#7C3AED' : '#CBD5E1'}` }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, flexWrap: 'wrap' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12.5, fontWeight: 700, color: '#334155' }}>
                <Boxes size={15} style={{ color: '#7C3AED' }} /> {L.appData}
              </div>
              {appImported ? (
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span style={{ fontSize: 11, fontWeight: 700, color: '#7C3AED', background: '#F3E8FF', padding: '3px 9px', borderRadius: 999 }}>
                    ✓ {L.importedBadge} · {appVarDefs.length} {L.varsCount}
                  </span>
                  <button onClick={() => setAppImported(false)} style={{ ...btnGhost, padding: '5px 10px', fontSize: 11.5 }}>
                    <X size={13} />
                  </button>
                </div>
              ) : (
                <button onClick={() => setAppImported(true)} style={{ ...btnPrimary, padding: '7px 12px', fontSize: 12.5, background: '#7C3AED' }}>
                  <Download size={14} /> {L.importBtn}
                </button>
              )}
            </div>
            <p style={{ fontSize: 11.5, color: '#94A3B8', margin: '6px 0 10px' }}>{L.appDataHint}</p>

            {!appImported ? (
              <p style={{ fontSize: 12, color: '#94A3B8', margin: '4px 0' }}>{L.notImported}</p>
            ) : (
              [...new Set(appVarDefs.map(v => v.group))].map(group => (
                <PaletteBlock key={group} icon={<Database size={14} />} title={group}>
                  {appVarDefs.filter(v => v.group === group).map(v => (
                    <DragChip
                      key={v.key}
                      label={`${lang === 'en' ? v.en : v.fr} = ${formatIndicator(v.value, v.unit)}`}
                      token={v.key}
                      bg="#F3E8FF" color="#7C3AED" onInsert={insertToken}
                    />
                  ))}
                </PaletteBlock>
              ))
            )}
          </div>

          {/* Formule */}
          <div style={card}>
            <label style={{ fontSize: 12.5, fontWeight: 700, color: '#334155', display: 'block', marginBottom: 8 }}>
              {L.formula}
            </label>
            <textarea
              ref={taRef}
              value={formula}
              onChange={e => setFormula(e.target.value)}
              onDrop={e => { e.preventDefault(); const tok = e.dataTransfer.getData('text/plain'); if (tok) insertToken(tok); }}
              onDragOver={e => e.preventDefault()}
              placeholder={L.dropHint}
              spellCheck={false}
              style={{
                width: '100%', minHeight: 84, resize: 'vertical', borderRadius: 10,
                border: `1.5px solid ${result.ok ? '#CBD5E1' : (formula.trim() ? '#FCA5A5' : '#CBD5E1')}`,
                padding: 12, fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace', fontSize: 14,
                color: '#0F172A', background: '#F8FAFC', outline: 'none',
              }}
            />
            <p style={{ fontSize: 11.5, color: '#94A3B8', margin: '8px 0 0' }}>{L.help}</p>
          </div>

          {/* Aperçu */}
          <div style={{ ...card, borderLeft: `4px solid ${RAG_COLORS[rag]}` }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', flexWrap: 'wrap', gap: 8 }}>
              <span style={{ fontSize: 12.5, fontWeight: 700, color: '#334155' }}>{L.preview}</span>
              <span style={{ fontSize: 12, color: '#94A3B8' }}>
                {L.basedOn} {selected.length} {L.projects}
              </span>
            </div>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 12, marginTop: 8, flexWrap: 'wrap' }}>
              <span style={{ fontSize: 34, fontWeight: 800, color: result.ok ? RAG_COLORS[rag] : '#94A3B8', lineHeight: 1 }}>
                {result.ok ? formatIndicator(result.value, unit) : '—'}
              </span>
              {target !== '' && result.ok && (
                <span style={{ fontSize: 13, color: '#64748B', display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                  <Target size={13} /> {L.vsTarget} {formatIndicator(parseFloat(target), unit)}
                </span>
              )}
            </div>
            {!result.ok && formula.trim() && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 8, color: '#DC2626', fontSize: 12.5 }}>
                <AlertCircle size={14} /> {L.invalid}
              </div>
            )}
          </div>
        </div>

        {/* ───── Colonne droite : configuration & sauvegarde ───── */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div style={card}>
            <Field label={L.name}>
              <input value={name} onChange={e => setName(e.target.value)}
                placeholder={lang === 'en' ? 'e.g. Disbursement rate' : 'ex. Taux de décaissement'}
                style={inputStyle} />
            </Field>
            <Field label={L.unit}>
              <select value={unit} onChange={e => setUnit(e.target.value as IndicatorUnit)} style={inputStyle}>
                {UNIT_OPTIONS.map(o => <option key={o.value} value={o.value}>{lang === 'en' ? o.en : o.fr}</option>)}
              </select>
            </Field>
            <Field label={L.target}>
              <input value={target} onChange={e => setTarget(e.target.value)} inputMode="decimal"
                placeholder="80" style={inputStyle} />
            </Field>

            <div style={{ borderTop: '1px dashed #E2E8F0', margin: '12px 0 10px' }} />
            <div style={{ fontSize: 12, fontWeight: 700, color: '#334155', marginBottom: 8 }}>{L.thresholds}</div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
              <Field label={L.good} small>
                <input value={good} onChange={e => setGood(e.target.value)} inputMode="decimal" style={inputStyle} />
              </Field>
              <Field label={L.warn} small>
                <input value={warn} onChange={e => setWarn(e.target.value)} inputMode="decimal" style={inputStyle} />
              </Field>
            </div>
            <Field label={L.direction} small>
              <select value={direction} onChange={e => setDirection(e.target.value as ThresholdDirection)} style={inputStyle}>
                <option value="higher">{L.higher}</option>
                <option value="lower">{L.lower}</option>
              </select>
            </Field>

            <div style={{ display: 'flex', gap: 8, marginTop: 14, flexWrap: 'wrap' }}>
              <button onClick={handleSave} disabled={!canSave}
                style={{ ...btnPrimary, opacity: canSave ? 1 : 0.5, cursor: canSave ? 'pointer' : 'not-allowed' }}>
                <Save size={15} /> {editingId ? L.update : L.save}
              </button>
              {editingId
                ? <button onClick={resetEditor} style={btnGhost}><X size={15} /> {L.cancelEdit}</button>
                : <button onClick={() => { setFormula(''); setName(''); }} style={btnGhost}><RotateCcw size={15} /> {L.clear}</button>}
            </div>
          </div>

          <button onClick={seedTemplates} style={{ ...btnGhost, justifyContent: 'center', width: '100%' }}>
            <Sparkles size={15} /> {L.loadTemplates}
          </button>
        </div>
      </div>

      {/* ───── Indicateurs enregistrés ───── */}
      <div style={{ marginTop: 24 }}>
        <h2 style={{ fontSize: 15, fontWeight: 800, color: '#0F172A', display: 'flex', alignItems: 'center', gap: 8 }}>
          <Calculator size={16} /> {L.saved} <span style={{ color: '#94A3B8', fontWeight: 600 }}>({indicators.length})</span>
        </h2>
        {indicators.length === 0 ? (
          <p style={{ color: '#64748B', fontSize: 13 }}>{L.noSaved}</p>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))', gap: 12, marginTop: 10 }}>
            {indicators.map(ind => {
              const r = evaluateFormula(ind.formula, evalProjets, appVars);
              const st = ragStatus(r.value, ind.thresholds);
              return (
                <div key={ind.id} style={{ ...card, padding: 14, borderTop: `3px solid ${RAG_COLORS[st]}` }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8 }}>
                    <span style={{ fontSize: 13, fontWeight: 700, color: '#0F172A' }}>
                      {lang === 'en' && ind.nameEn ? ind.nameEn : ind.name}
                    </span>
                    <div style={{ display: 'flex', gap: 4 }}>
                      <button onClick={() => loadForEdit(ind)} title={L.edit} style={iconBtn}><Pencil size={14} /></button>
                      <button onClick={() => remove(ind.id)} title={L.del} style={{ ...iconBtn, color: '#DC2626' }}><Trash2 size={14} /></button>
                    </div>
                  </div>
                  <div style={{ fontSize: 26, fontWeight: 800, color: r.ok ? RAG_COLORS[st] : '#94A3B8', margin: '6px 0 2px' }}>
                    {r.ok ? formatIndicator(r.value, ind.unit) : '—'}
                  </div>
                  {ind.target !== undefined && r.ok && (
                    <div style={{ fontSize: 11.5, color: '#64748B' }}>
                      {L.vsTarget} {formatIndicator(ind.target, ind.unit)}
                    </div>
                  )}
                  <code style={{ display: 'block', fontSize: 10.5, color: '#94A3B8', marginTop: 8, wordBreak: 'break-all' }}>
                    {ind.formula}
                  </code>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* ───── Modale : toutes les données de l'application ───── */}
      {showAllData && (
        <div
          onClick={() => setShowAllData(false)}
          style={{
            position: 'fixed', inset: 0, background: 'rgba(15,23,42,0.55)', zIndex: 1000,
            display: 'flex', alignItems: 'flex-start', justifyContent: 'center', padding: '5vh 16px', overflow: 'auto',
          }}
        >
          <div
            onClick={e => e.stopPropagation()}
            style={{ background: '#fff', borderRadius: 14, width: '100%', maxWidth: 760, boxShadow: '0 20px 60px rgba(0,0,0,0.25)' }}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, padding: '16px 18px', borderBottom: '1px solid #E2E8F0' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <div style={{ width: 34, height: 34, borderRadius: 9, background: '#F3E8FF', display: 'grid', placeItems: 'center' }}>
                  <Database size={18} style={{ color: '#7C3AED' }} />
                </div>
                <div>
                  <h2 style={{ fontSize: 16, fontWeight: 800, color: '#0F172A', margin: 0 }}>{L.allDataTitle}</h2>
                  <p style={{ fontSize: 11.5, color: '#94A3B8', margin: '2px 0 0' }}>{appVarDefs.length} {L.varsCount}</p>
                </div>
              </div>
              <button onClick={() => setShowAllData(false)} style={iconBtn}><X size={16} /></button>
            </div>
            <p style={{ fontSize: 12, color: '#64748B', margin: 0, padding: '10px 18px 0' }}>{L.allDataHint}</p>
            <div style={{ padding: 18, display: 'flex', flexDirection: 'column', gap: 16 }}>
              {[...new Set(appVarDefs.map(v => v.group))].map(group => (
                <div key={group}>
                  <div style={{ fontSize: 12, fontWeight: 800, color: '#7C3AED', marginBottom: 6, textTransform: 'uppercase', letterSpacing: 0.4 }}>{group}</div>
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12.5 }}>
                    <thead>
                      <tr style={{ background: '#F8FAFC' }}>
                        <th style={{ ...thStyle, textAlign: 'left' }}>{L.colVar}</th>
                        <th style={thStyle}>{L.colValueH}</th>
                        <th style={{ ...thStyle, textAlign: 'left' }}>{L.colKeyH}</th>
                        <th style={thStyle}></th>
                      </tr>
                    </thead>
                    <tbody>
                      {appVarDefs.filter(v => v.group === group).map(v => (
                        <tr key={v.key} style={{ borderTop: '1px solid #F1F5F9' }}>
                          <td style={{ ...tdStyle, textAlign: 'left', fontWeight: 600, color: '#0F172A', whiteSpace: 'normal' }}>{lang === 'en' ? v.en : v.fr}</td>
                          <td style={{ ...tdStyle, textAlign: 'right', fontWeight: 700, color: '#334155' }}>{formatIndicator(v.value, v.unit)}</td>
                          <td style={{ ...tdStyle, textAlign: 'left' }}>
                            <code style={{ fontSize: 11, color: '#7C3AED', background: '#F3E8FF', padding: '2px 6px', borderRadius: 5 }}>{v.key}</code>
                          </td>
                          <td style={{ ...tdStyle, textAlign: 'right' }}>
                            <button
                              onClick={() => { insertToken(v.key); setShowAllData(false); }}
                              style={{ ...btnGhost, padding: '4px 9px', fontSize: 11.5 }}
                            >
                              {L.insertVar}
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ))}
            </div>
            <div style={{ padding: '12px 18px', borderTop: '1px solid #E2E8F0', display: 'flex', justifyContent: 'flex-end' }}>
              <button onClick={() => setShowAllData(false)} style={btnGhost}><X size={15} /> {L.close}</button>
            </div>
          </div>
        </div>
      )}

      <style>{`@media (max-width: 900px){ .indic-grid{ grid-template-columns: 1fr !important; } }`}</style>
    </div>
  );
}

// ─── Sous-composants ──────────────────────────────────────────────────────────

function PaletteBlock({ icon, title, children }: { icon: React.ReactNode; title: string; children: React.ReactNode }) {
  return (
    <div style={{ marginBottom: 12 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, fontWeight: 700, color: '#475569', marginBottom: 8 }}>
        {icon} {title}
      </div>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>{children}</div>
    </div>
  );
}

function DragChip({ label, token, bg, color, onInsert }: {
  label: string; token: string; bg: string; color: string; onInsert: (t: string) => void;
}) {
  return (
    <span
      draggable
      onDragStart={e => { e.dataTransfer.setData('text/plain', token); e.dataTransfer.effectAllowed = 'copy'; }}
      onClick={() => onInsert(token)}
      title={token}
      style={chip(bg, color)}
    >
      <GripVertical size={12} style={{ opacity: 0.5 }} /> {label}
    </span>
  );
}

function Field({ label, children, small }: { label: string; children: React.ReactNode; small?: boolean }) {
  return (
    <label style={{ display: 'block', marginBottom: small ? 8 : 10 }}>
      <span style={{ fontSize: 11.5, fontWeight: 600, color: '#64748B', display: 'block', marginBottom: 4 }}>{label}</span>
      {children}
    </label>
  );
}

const inputStyle: React.CSSProperties = {
  width: '100%', padding: '8px 10px', borderRadius: 8, border: '1px solid #CBD5E1',
  fontSize: 13, color: '#0F172A', background: '#fff', outline: 'none',
};
const btnPrimary: React.CSSProperties = {
  display: 'inline-flex', alignItems: 'center', gap: 6, padding: '9px 14px', borderRadius: 9,
  background: '#4338CA', color: '#fff', border: 'none', fontSize: 13, fontWeight: 700,
};
const btnGhost: React.CSSProperties = {
  display: 'inline-flex', alignItems: 'center', gap: 6, padding: '9px 14px', borderRadius: 9,
  background: '#fff', color: '#334155', border: '1px solid #CBD5E1', fontSize: 13, fontWeight: 600, cursor: 'pointer',
};
const iconBtn: React.CSSProperties = {
  display: 'grid', placeItems: 'center', width: 26, height: 26, borderRadius: 6,
  background: '#F1F5F9', border: 'none', cursor: 'pointer', color: '#475569',
};
const selStyle: React.CSSProperties = {
  padding: '5px 8px', borderRadius: 7, border: '1px solid #CBD5E1',
  fontSize: 12, color: '#0F172A', background: '#fff', outline: 'none', maxWidth: 160,
};
const thStyle: React.CSSProperties = {
  padding: '7px 8px', fontSize: 10.5, fontWeight: 700, color: '#64748B',
  textAlign: 'right', textTransform: 'uppercase', letterSpacing: 0.3, whiteSpace: 'nowrap',
};
const tdStyle: React.CSSProperties = {
  padding: '6px 8px', color: '#334155', whiteSpace: 'nowrap',
};

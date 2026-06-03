/**
 * indicatorStore.ts — Constructeur d'Indicateurs SIGEPP-DPE
 * ----------------------------------------------------------
 * Permet de configurer des indicateurs (KPI) personnalisés à partir des
 * données déjà présentes dans la plateforme (portefeuille projets), via :
 *   • un catalogue de CHAMPS (budget, avancement, CPI…) glissables-déposables
 *   • un catalogue de FONCTIONS d'agrégation (SUM, AVG, COUNT, WAVG…)
 *   • une FORMULE libre saisie/composée par l'utilisateur
 *   • un moteur d'évaluation SÛR (tokenizer + shunting-yard, sans eval())
 *   • une cible (comme dans le rapport trimestriel DPE) + seuils RAG
 *
 * Les indicateurs sont persistés (localStorage) et réutilisables dans les
 * tableaux de bord. Le moteur s'aligne sur les indicateurs du Rapport T1 DPE
 * (taux de réalisation physique/financière, CPI/SPI, décaissement…).
 */

import { create } from 'zustand';
import { persist } from 'zustand/middleware';

// ─────────────────────────────────────────────────────────────────────────────
// TYPES
// ─────────────────────────────────────────────────────────────────────────────

export type IndicatorUnit = 'percent' | 'fcfa' | 'number' | 'ratio';
export type ThresholdDirection = 'higher' | 'lower'; // plus haut = mieux / plus bas = mieux

export interface IndicatorThresholds {
  good: number; // ≥ good (ou ≤ good si direction='lower') → vert
  warn: number; // ≥ warn → ambre, sinon rouge
  direction: ThresholdDirection;
}

export interface CustomIndicator {
  id: string;
  name: string;
  nameEn?: string;
  description?: string;
  formula: string; // ex: "SUM(budgetDecaisse) / SUM(budget) * 100"
  unit: IndicatorUnit;
  target?: number; // cible (rapport trimestriel) — ex: 80
  thresholds?: IndicatorThresholds;
  createdAt: string;
  updatedAt: string;
}

/** Forme minimale d'un projet nécessaire à l'évaluation (sous-ensemble de Projet) */
export interface IndicatorProjet {
  budget: number;
  budgetEngage: number;
  budgetDecaisse: number;
  avancement: number;
  avancementPlanifie: number;
  avancementReel?: number;
  cpi: number;
  spi: number;
  statut: string;
  [k: string]: unknown;
}

// ─────────────────────────────────────────────────────────────────────────────
// CATALOGUES (CHAMPS / FONCTIONS / OPÉRATEURS) — bilingues
// ─────────────────────────────────────────────────────────────────────────────

export interface FieldDef {
  key: keyof IndicatorProjet | string;
  fr: string;
  en: string;
  unit: IndicatorUnit;
}

/** Champs numériques disponibles au niveau projet (source : projectStore.Projet) */
export const INDICATOR_FIELDS: FieldDef[] = [
  { key: 'budget',            fr: 'Budget total',          en: 'Total budget',        unit: 'fcfa' },
  { key: 'budgetEngage',      fr: 'Budget engagé',         en: 'Committed budget',    unit: 'fcfa' },
  { key: 'budgetDecaisse',    fr: 'Budget décaissé',       en: 'Disbursed budget',    unit: 'fcfa' },
  { key: 'avancement',        fr: 'Avancement physique',   en: 'Physical progress',   unit: 'percent' },
  { key: 'avancementPlanifie',fr: 'Avancement planifié',   en: 'Planned progress',    unit: 'percent' },
  { key: 'avancementReel',    fr: 'Avancement réel pondéré', en: 'Weighted real progress', unit: 'percent' },
  { key: 'cpi',               fr: 'CPI (coûts)',           en: 'CPI (cost)',          unit: 'ratio' },
  { key: 'spi',               fr: 'SPI (délais)',          en: 'SPI (schedule)',      unit: 'ratio' },
];

export interface FunctionDef {
  key: string;        // jeton inséré, ex: 'SUM'
  arity: 'field' | 'none'; // attend un champ ou pas d'argument
  fr: string;
  en: string;
  /** snippet inséré dans la formule (placeholder de champ) */
  snippet: string;
}

/** Fonctions d'agrégation sur le portefeuille (alignées rapport trimestriel DPE) */
export const INDICATOR_FUNCTIONS: FunctionDef[] = [
  { key: 'SUM',          arity: 'field', fr: 'Somme',                      en: 'Sum',                snippet: 'SUM(budget)' },
  { key: 'AVG',          arity: 'field', fr: 'Moyenne',                    en: 'Average',            snippet: 'AVG(cpi)' },
  { key: 'WAVG',         arity: 'field', fr: 'Moyenne pondérée (budget)',  en: 'Weighted avg (budget)', snippet: 'WAVG(avancement)' },
  { key: 'MIN',          arity: 'field', fr: 'Minimum',                    en: 'Minimum',            snippet: 'MIN(cpi)' },
  { key: 'MAX',          arity: 'field', fr: 'Maximum',                    en: 'Maximum',            snippet: 'MAX(avancement)' },
  { key: 'COUNT',        arity: 'none',  fr: 'Nombre de projets',          en: 'Project count',      snippet: 'COUNT()' },
  { key: 'COUNT_RETARD', arity: 'none',  fr: 'Projets en retard',          en: 'Delayed projects',   snippet: 'COUNT_RETARD()' },
  { key: 'COUNT_ACTIF',  arity: 'none',  fr: 'Projets en cours',           en: 'Active projects',    snippet: 'COUNT_ACTIF()' },
  { key: 'COUNT_TERMINE',arity: 'none',  fr: 'Projets terminés',           en: 'Completed projects', snippet: 'COUNT_TERMINE()' },
];

export const INDICATOR_OPERATORS = ['+', '-', '*', '/', '(', ')', '*100'] as const;

// ─────────────────────────────────────────────────────────────────────────────
// MOTEUR D'AGRÉGATION
// ─────────────────────────────────────────────────────────────────────────────

const NUMERIC_FIELDS = new Set(INDICATOR_FIELDS.map(f => f.key as string));

function num(v: unknown): number {
  const n = typeof v === 'number' ? v : Number(v);
  return Number.isFinite(n) ? n : 0;
}

/** Calcule une agrégation FUNC(field) sur la liste de projets filtrée. */
function aggregate(fn: string, field: string, projets: IndicatorProjet[]): number {
  if (projets.length === 0) {
    return fn.startsWith('COUNT') ? 0 : NaN;
  }
  switch (fn) {
    case 'COUNT':         return projets.length;
    case 'COUNT_RETARD':  return projets.filter(p => p.statut === 'en_retard').length;
    case 'COUNT_ACTIF':   return projets.filter(p => p.statut === 'en_cours').length;
    case 'COUNT_TERMINE': return projets.filter(p => p.statut === 'termine').length;
  }
  if (!field || !NUMERIC_FIELDS.has(field)) return NaN;
  const vals = projets.map(p => {
    if (field === 'avancementReel') return num(p.avancementReel ?? p.avancement);
    return num(p[field]);
  });
  switch (fn) {
    case 'SUM': return vals.reduce((a, b) => a + b, 0);
    case 'AVG': return vals.reduce((a, b) => a + b, 0) / vals.length;
    case 'MIN': return Math.min(...vals);
    case 'MAX': return Math.max(...vals);
    case 'WAVG': {
      const w = projets.map(p => num(p.budget));
      const totW = w.reduce((a, b) => a + b, 0);
      if (totW === 0) return vals.reduce((a, b) => a + b, 0) / vals.length;
      return vals.reduce((acc, v, i) => acc + v * w[i], 0) / totW;
    }
    default: return NaN;
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// ÉVALUATEUR DE FORMULE SÛR (tokenizer + shunting-yard) — PAS de eval()
// ─────────────────────────────────────────────────────────────────────────────

const AGG_RE = /([A-Z_]+)\s*\(\s*([a-zA-Z0-9_]*)\s*\)/g;

export interface EvalResult {
  value: number;       // NaN si erreur / indéfini
  ok: boolean;
  error?: string;
}

/**
 * Évalue une formule d'indicateur sur une liste de projets.
 * 0) (optionnel) substitue les VARIABLES nommées (données importées de toute
 *    l'application : immobilisations, RH, courriers, alertes…) par leur valeur
 * 1) remplace chaque agrégation FUNC(field) par sa valeur numérique
 * 2) évalue l'arithmétique restante (+ - * / parenthèses) par shunting-yard
 *
 * @param variables  Map NOM_VARIABLE → valeur numérique. Les noms doivent être
 *   en MAJUSCULES_SNAKE pour ne pas entrer en collision avec les champs projet
 *   (camelCase) ni les fonctions d'agrégation (SUM, AVG, COUNT…).
 */
export function evaluateFormula(
  formula: string,
  projets: IndicatorProjet[],
  variables?: Record<string, number>,
): EvalResult {
  if (!formula.trim()) return { value: NaN, ok: false, error: 'empty' };

  let work = formula;

  // 0) Substitution des variables importées (avant les agrégations).
  //    On ne remplace que les identifiants STRICTEMENT égaux à une variable
  //    connue — les fonctions (SUM…) et champs (budget…) restent intacts.
  if (variables && Object.keys(variables).length > 0) {
    work = work.replace(/[A-Za-z_][A-Za-z0-9_]*/g, (m) => {
      if (Object.prototype.hasOwnProperty.call(variables, m)) {
        const v = variables[m];
        return Number.isFinite(v) ? `(${v})` : '(NaN)';
      }
      return m;
    });
  }

  // 1) Résolution des agrégations → nombres
  let resolved = work.replace(AGG_RE, (_m, fn: string, field: string) => {
    const v = aggregate(fn, field, projets);
    if (!Number.isFinite(v)) return '(NaN)';
    return `(${v})`;
  });
  resolved = resolved.replace(/NaN/g, 'NaN');

  // 2) Tokenisation arithmétique
  const tokens = tokenize(resolved);
  if (!tokens) return { value: NaN, ok: false, error: 'syntax' };

  try {
    const value = evalRPN(toRPN(tokens));
    if (!Number.isFinite(value)) return { value: NaN, ok: false, error: 'undefined' };
    return { value, ok: true };
  } catch (e) {
    return { value: NaN, ok: false, error: (e as Error).message };
  }
}

type Tok = { t: 'num'; v: number } | { t: 'op'; v: string } | { t: 'paren'; v: '(' | ')' };

function tokenize(expr: string): Tok[] | null {
  const out: Tok[] = [];
  let i = 0;
  const s = expr.replace(/\s+/g, '');
  while (i < s.length) {
    const c = s[i];
    if (c === 'N' && s.slice(i, i + 3) === 'NaN') { return null; } // agrégation indéfinie
    if (/[0-9.]/.test(c)) {
      let j = i;
      while (j < s.length && /[0-9.]/.test(s[j])) j++;
      out.push({ t: 'num', v: parseFloat(s.slice(i, j)) });
      i = j;
      continue;
    }
    if ('+-*/'.includes(c)) {
      // gestion unaire : '-' en début ou après opérateur/'(' → 0 - x
      const prev = out[out.length - 1];
      if ((c === '-' || c === '+') && (!prev || (prev.t === 'op') || (prev.t === 'paren' && prev.v === '('))) {
        out.push({ t: 'num', v: 0 });
      }
      out.push({ t: 'op', v: c });
      i++;
      continue;
    }
    if (c === '(' || c === ')') { out.push({ t: 'paren', v: c }); i++; continue; }
    return null; // caractère invalide
  }
  return out;
}

const PREC: Record<string, number> = { '+': 1, '-': 1, '*': 2, '/': 2 };

function toRPN(tokens: Tok[]): Tok[] {
  const out: Tok[] = [];
  const ops: Tok[] = [];
  for (const tk of tokens) {
    if (tk.t === 'num') out.push(tk);
    else if (tk.t === 'op') {
      while (ops.length) {
        const top = ops[ops.length - 1];
        if (top.t === 'op' && PREC[top.v] >= PREC[tk.v]) out.push(ops.pop()!);
        else break;
      }
      ops.push(tk);
    } else if (tk.v === '(') ops.push(tk);
    else {
      while (ops.length && !(ops[ops.length - 1].t === 'paren')) out.push(ops.pop()!);
      if (!ops.length) throw new Error('mismatched parentheses');
      ops.pop(); // retire '('
    }
  }
  while (ops.length) {
    const op = ops.pop()!;
    if (op.t === 'paren') throw new Error('mismatched parentheses');
    out.push(op);
  }
  return out;
}

function evalRPN(rpn: Tok[]): number {
  const st: number[] = [];
  for (const tk of rpn) {
    if (tk.t === 'num') st.push(tk.v);
    else if (tk.t === 'op') {
      const b = st.pop();
      const a = st.pop();
      if (a === undefined || b === undefined) throw new Error('invalid expression');
      switch (tk.v) {
        case '+': st.push(a + b); break;
        case '-': st.push(a - b); break;
        case '*': st.push(a * b); break;
        case '/': st.push(b === 0 ? NaN : a / b); break;
      }
    }
  }
  if (st.length !== 1) throw new Error('invalid expression');
  return st[0];
}

// ─────────────────────────────────────────────────────────────────────────────
// FORMATAGE & STATUT RAG
// ─────────────────────────────────────────────────────────────────────────────

export function formatIndicator(value: number, unit: IndicatorUnit): string {
  if (!Number.isFinite(value)) return '—';
  switch (unit) {
    case 'percent': return `${value.toFixed(1)} %`;
    case 'ratio':   return value.toFixed(2);
    case 'fcfa': {
      if (Math.abs(value) >= 1000) return `${(value / 1000).toLocaleString('fr-FR', { maximumFractionDigits: 1 })} Md FCFA`;
      return `${value.toLocaleString('fr-FR', { maximumFractionDigits: 0 })} M FCFA`;
    }
    case 'number': return value.toLocaleString('fr-FR', { maximumFractionDigits: 0 });
    default: return String(value);
  }
}

export type RagStatus = 'green' | 'amber' | 'red' | 'none';

export function ragStatus(value: number, th?: IndicatorThresholds): RagStatus {
  if (!th || !Number.isFinite(value)) return 'none';
  const { good, warn, direction } = th;
  if (direction === 'higher') {
    if (value >= good) return 'green';
    if (value >= warn) return 'amber';
    return 'red';
  } else {
    if (value <= good) return 'green';
    if (value <= warn) return 'amber';
    return 'red';
  }
}

export const RAG_COLORS: Record<RagStatus, string> = {
  green: '#16A34A', amber: '#D97706', red: '#DC2626', none: '#64748B',
};

// ─────────────────────────────────────────────────────────────────────────────
// INDICATEURS PRÉ-CONFIGURÉS (issus du Rapport Trimestriel DPE)
// ─────────────────────────────────────────────────────────────────────────────

export const TEMPLATE_INDICATORS: Omit<CustomIndicator, 'id' | 'createdAt' | 'updatedAt'>[] = [
  {
    name: 'Taux de réalisation financière', nameEn: 'Financial completion rate',
    description: 'Décaissé / Budget total — cible trimestrielle DPE : 80 %',
    formula: 'SUM(budgetDecaisse) / SUM(budget) * 100', unit: 'percent', target: 80,
    thresholds: { good: 80, warn: 50, direction: 'higher' },
  },
  {
    name: 'Taux d\'avancement physique (pondéré)', nameEn: 'Weighted physical progress',
    description: 'Avancement pondéré par le budget — cible : 80 %',
    formula: 'WAVG(avancement)', unit: 'percent', target: 80,
    thresholds: { good: 80, warn: 50, direction: 'higher' },
  },
  {
    name: 'Taux de réalisation physique des prévisions', nameEn: 'Physical forecast achievement rate',
    description: 'Avancement physique réalisé / planifié (TAPR ÷ TAPP) — indicateur phare du contrat de gestion DPE (cible 80 %)',
    formula: 'WAVG(avancement) / WAVG(avancementPlanifie) * 100', unit: 'percent', target: 80,
    thresholds: { good: 80, warn: 50, direction: 'higher' },
  },
  {
    name: 'Taux d\'exécution du budget d\'investissement annuel', nameEn: 'Annual investment budget execution rate',
    description: 'Budget décaissé / budget total — contrat de gestion DPE (cible 80 %)',
    formula: 'SUM(budgetDecaisse) / SUM(budget) * 100', unit: 'percent', target: 80,
    thresholds: { good: 80, warn: 50, direction: 'higher' },
  },
  {
    name: 'Nombre total de projets', nameEn: 'Total number of projects',
    description: 'Nombre de projets du périmètre (A = B+C+D+E) — situation physique IX.B',
    formula: 'COUNT()', unit: 'number',
  },
  {
    name: 'Projets en cours d\'exécution', nameEn: 'Projects under execution',
    description: 'Nombre de projets au statut « en cours » (C) — situation physique IX.B',
    formula: 'COUNT_ACTIF()', unit: 'number',
  },
  {
    name: 'Projets terminés', nameEn: 'Completed projects',
    description: 'Nombre de projets au statut « terminé » (E) — situation physique IX.B',
    formula: 'COUNT_TERMINE()', unit: 'number',
  },
  {
    name: 'Taux d\'achèvement du portefeuille', nameEn: 'Portfolio completion rate',
    description: 'Projets terminés / nombre total de projets visibles',
    formula: 'COUNT_TERMINE() / COUNT() * 100', unit: 'percent', target: 100,
    thresholds: { good: 75, warn: 40, direction: 'higher' },
  },
  {
    name: 'Taux d\'engagement', nameEn: 'Commitment rate',
    description: 'Budget engagé / Budget total',
    formula: 'SUM(budgetEngage) / SUM(budget) * 100', unit: 'percent', target: 90,
    thresholds: { good: 90, warn: 60, direction: 'higher' },
  },
  {
    name: 'CPI moyen portefeuille', nameEn: 'Portfolio average CPI',
    description: 'Indice de performance des coûts (EVM) — sain ≥ 1',
    formula: 'AVG(cpi)', unit: 'ratio', target: 1,
    thresholds: { good: 1, warn: 0.9, direction: 'higher' },
  },
  {
    name: 'SPI moyen portefeuille', nameEn: 'Portfolio average SPI',
    description: 'Indice de performance des délais (EVM) — sain ≥ 1',
    formula: 'AVG(spi)', unit: 'ratio', target: 1,
    thresholds: { good: 1, warn: 0.9, direction: 'higher' },
  },
  {
    name: 'Projets en retard', nameEn: 'Delayed projects',
    description: 'Nombre de projets au statut « en retard »',
    formula: 'COUNT_RETARD()', unit: 'number', target: 0,
    thresholds: { good: 0, warn: 3, direction: 'lower' },
  },
  {
    name: 'Budget total portefeuille', nameEn: 'Total portfolio budget',
    description: 'Somme des budgets de tous les projets visibles',
    formula: 'SUM(budget)', unit: 'fcfa',
  },
];

// ─────────────────────────────────────────────────────────────────────────────
// STORE ZUSTAND (persisté)
// ─────────────────────────────────────────────────────────────────────────────

interface IndicatorState {
  indicators: CustomIndicator[];
  add: (ind: Omit<CustomIndicator, 'id' | 'createdAt' | 'updatedAt'>) => string;
  update: (id: string, patch: Partial<CustomIndicator>) => void;
  remove: (id: string) => void;
  seedTemplates: () => void;
}

function uid(): string {
  return `ind-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;
}

export const useIndicatorStore = create<IndicatorState>()(
  persist(
    (set, get) => ({
      indicators: [],
      add: (ind) => {
        const now = new Date().toISOString();
        const id = uid();
        set(s => ({ indicators: [...s.indicators, { ...ind, id, createdAt: now, updatedAt: now }] }));
        return id;
      },
      update: (id, patch) => set(s => ({
        indicators: s.indicators.map(i => i.id === id ? { ...i, ...patch, updatedAt: new Date().toISOString() } : i),
      })),
      remove: (id) => set(s => ({ indicators: s.indicators.filter(i => i.id !== id) })),
      seedTemplates: () => {
        // Fusionne les modèles manquants (dédupliqués par nom) — ne remplace JAMAIS
        // les indicateurs personnalisés existants et n'est jamais un « no-op »
        // silencieux : tout modèle absent est ajouté à chaque appel.
        const now = new Date().toISOString();
        const existingNames = new Set(get().indicators.map(i => i.name.trim().toLowerCase()));
        const toAdd = TEMPLATE_INDICATORS
          .filter(t => !existingNames.has(t.name.trim().toLowerCase()))
          .map(t => ({ ...t, id: uid(), createdAt: now, updatedAt: now }));
        if (toAdd.length === 0) return;
        set(s => ({ indicators: [...s.indicators, ...toAdd] }));
      },
    }),
    { name: 'sigepp-indicators' }
  )
);

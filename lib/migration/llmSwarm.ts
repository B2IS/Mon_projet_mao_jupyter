/**
 * llmSwarm.ts — Swarm multi-agents IA (architecture LangGraph-inspired)
 * ─────────────────────────────────────────────────────────────────────
 * Architecture :
 *   ┌─────────────────────────────────────────────────────────────┐
 *   │  GRAPH STATE : SwarmState (partagé entre tous les nœuds)    │
 *   │                                                              │
 *   │  NODE 1 — DocClassifier   → identifie types de docs         │
 *   │  NODE 2 — ProjectExtractor → méta-données projet + BIT code │
 *   │  NODE 3 — BudgetAnalyst   → montants, lots, FCFA            │
 *   │  NODE 4 — RiskAssessor    → risques détectés                │
 *   │  NODE 5 — QAAgent         → validation + score confiance    │
 *   │                                                              │
 *   │  Modèles testés (par ordre de priorité) :                   │
 *   │   1. Groq  llama-3.3-70b-versatile  (puissant + rapide)     │
 *   │   2. Groq  llama-3.1-8b-instant     (fallback rapide)       │
 *   │   3. Groq  mixtral-8x7b-32768       (bon pour extraction)   │
 *   │   4. Groq  gemma2-9b-it             (backup)                │
 *   │   5. Heuristique locale             (fallback final)        │
 *   └─────────────────────────────────────────────────────────────┘
 *
 * BIT codes = identifiants uniques SENELEC pour chaque projet.
 * Patterns reconnus : BEST-SN-…, EIUL-…, EXP-IRAF-…, TBEA-…
 */

import type { ExtractedData } from './types';

/* ─── Configuration ────────────────────────────────────────────────────────── */

const GROQ_BASE = 'https://api.groq.com/openai/v1';

/** Modèles classés par qualité décroissante — on essaie dans l'ordre. */
const MODEL_CHAIN = [
  'llama-3.3-70b-versatile',
  'llama-3.1-8b-instant',
  'mixtral-8x7b-32768',
  'gemma2-9b-it',
];

/* ─── Types ────────────────────────────────────────────────────────────────── */

export interface SwarmState {
  documents: { name: string; text: string; type?: string }[];
  classified: { name: string; docType: string; confidence: number }[];
  projectMeta: Partial<ExtractedData>;
  budgetData: { total?: number; currency?: string; lots: { numero: string; label: string; budget?: number }[] };
  risks: { description: string; severity: 'haute' | 'moyenne' | 'basse' }[];
  qaResult: { confidence: number; issues: string[]; suggestions: string[] };
  modelUsed: string;
  error?: string;
}

export interface SwarmResult {
  extracted: ExtractedData;
  confidence: number;
  modelUsed: string;
  qaIssues: string[];
  rawState: SwarmState;
}

/* ─── Helpers LLM ─────────────────────────────────────────────────────────── */

async function groqCall(
  model: string,
  system: string,
  user: string,
  apiKey: string,
  maxTokens = 1024,
): Promise<string> {
  const resp = await fetch(`${GROQ_BASE}/chat/completions`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model,
      messages: [
        { role: 'system', content: system },
        { role: 'user', content: user },
      ],
      max_tokens: maxTokens,
      temperature: 0.1, // faible pour maximiser la précision
    }),
  });
  if (!resp.ok) throw new Error(`Groq HTTP ${resp.status}: ${await resp.text()}`);
  const data = await resp.json();
  return data.choices?.[0]?.message?.content ?? '';
}

/** Essaie chaque modèle dans MODEL_CHAIN jusqu'à succès. */
async function callWithFallback(
  system: string,
  user: string,
  apiKey: string,
  maxTokens = 1024,
): Promise<{ text: string; model: string }> {
  for (const model of MODEL_CHAIN) {
    try {
      const text = await groqCall(model, system, user, apiKey, maxTokens);
      if (text && text.trim().length > 10) return { text, model };
    } catch (e) {
      console.warn(`[SwarmIA] Model ${model} failed:`, e);
    }
  }
  throw new Error('Tous les modèles Groq ont échoué');
}

/** Extrait un JSON de la réponse LLM (gère les blocs ```json ... ```). */
function extractJSON<T>(text: string): T | null {
  // Retire les blocs markdown ```json ... ```
  const cleaned = text.replace(/```json\s*/gi, '').replace(/```\s*/g, '').trim();
  // Cherche la première accolade/crochet ouvrante
  const start = cleaned.search(/[{[]/);
  const end   = cleaned.lastIndexOf('}') > cleaned.lastIndexOf(']')
    ? cleaned.lastIndexOf('}')
    : cleaned.lastIndexOf(']');
  if (start === -1 || end === -1) return null;
  try {
    return JSON.parse(cleaned.slice(start, end + 1)) as T;
  } catch {
    return null;
  }
}

/* ─── Nœuds du graphe (LangGraph nodes) ────────────────────────────────────── */

/**
 * NODE 1 — DocClassifier
 * Identifie le type de chaque document (contrat, rapport, PV, plan, BoQ…)
 */
async function nodeDocClassifier(state: SwarmState, apiKey: string): Promise<SwarmState> {
  if (!state.documents.length) return state;

  const docList = state.documents.map((d, i) =>
    `${i + 1}. "${d.name}" — extrait: "${d.text.slice(0, 300).replace(/\n/g, ' ')}"`
  ).join('\n');

  const system = `Tu es un expert en classification de documents de projets d'infrastructure électrique (SENELEC, Sénégal).
Réponds UNIQUEMENT en JSON valide, aucun texte avant ou après.`;

  const prompt = `Classe chacun de ces documents. Types possibles : contract, dao, boq, report_monthly, report_quarterly, pv_reception, plan_technique, photo, excel_financial, excel_suivi, pdf_rapport, word_rapport, other.

Documents :
${docList}

Réponds avec ce format JSON exact :
[{"name":"nom_du_fichier","docType":"type","confidence":0.95}]`;

  try {
    const { text, model } = await callWithFallback(system, prompt, apiKey, 512);
    const classified = extractJSON<{ name: string; docType: string; confidence: number }[]>(text);
    return {
      ...state,
      classified: classified ?? state.documents.map(d => ({ name: d.name, docType: 'other', confidence: 0.5 })),
      modelUsed: state.modelUsed || model,
    };
  } catch {
    return {
      ...state,
      classified: state.documents.map(d => ({ name: d.name, docType: 'other', confidence: 0.5 })),
    };
  }
}

/**
 * NODE 2 — ProjectExtractor
 * Extrait les métadonnées projet : nom, code BIT, dates, bailleur, localisation…
 */
async function nodeProjectExtractor(state: SwarmState, apiKey: string): Promise<SwarmState> {
  const fullText = state.documents.map(d => `=== ${d.name} ===\n${d.text.slice(0, 800)}`).join('\n\n');

  const system = `Tu es un expert en extraction d'informations de projets d'électrification rurale et urbaine au Sénégal (SENELEC DPE).
Les codes BIT (Bureau International du Travail / identifiants internes SENELEC) sont les clés uniques des projets.
Patterns BIT: BEST-SN-..., EIUL-Lot..., EXP-IRAF-..., TBEA-..., DPE-..., BESTSN-...
Réponds UNIQUEMENT en JSON valide.`;

  const prompt = `Extrais les informations clés de ces documents de projet :

${fullText}

Réponds avec ce JSON :
{
  "projectName": "nom complet du projet",
  "codeBIT": "code BIT/identifiant unique SENELEC (ex: BEST-SN-001, EIUL-LOT3)",
  "projectCode": "code court du projet",
  "projectType": "type: distribution|transport|production|commercial|genie_civil",
  "bailleur": "bailleur de fonds (Banque Mondiale, BAD, BEI, etc.)",
  "contractor": "entreprise titulaire du marché",
  "location": "région/localisation principale",
  "startDate": "date début YYYY-MM-DD",
  "endDate": "date fin YYYY-MM-DD",
  "deliverables": ["livrable 1", "livrable 2"],
  "milestones": [{"name":"jalon","date":"YYYY-MM-DD"}],
  "confidence": 0.95
}`;

  try {
    const { text, model } = await callWithFallback(system, prompt, apiKey, 1024);
    const meta = extractJSON<Record<string, unknown>>(text);
    if (meta) {
      return {
        ...state,
        modelUsed: state.modelUsed || model,
        projectMeta: {
          ...state.projectMeta,
          projectName:  String(meta.projectName || ''),
          projectCode:  String(meta.projectCode || meta.codeBIT || ''),
          codeBIT:      String(meta.codeBIT || meta.projectCode || ''),
          projectType:  String(meta.projectType || ''),
          contractor:   String(meta.bailleur || meta.contractor || ''),
          location:     String(meta.location || ''),
          startDate:    String(meta.startDate || ''),
          endDate:      String(meta.endDate || ''),
          deliverables: Array.isArray(meta.deliverables) ? meta.deliverables as string[] : [],
          milestones:   Array.isArray(meta.milestones) ? meta.milestones as {name:string;date:string}[] : [],
        },
      };
    }
  } catch (e) {
    console.warn('[SwarmIA] ProjectExtractor failed:', e);
  }
  return state;
}

/**
 * NODE 3 — BudgetAnalyst
 * Extrait les montants, lots, devise FCFA/XOF, WBS…
 */
async function nodeBudgetAnalyst(state: SwarmState, apiKey: string): Promise<SwarmState> {
  const financialDocs = state.documents
    .filter(d => {
      const n = d.name.toLowerCase();
      const classified = state.classified.find(c => c.name === d.name);
      return ['boq', 'excel_financial', 'contract', 'dao'].includes(classified?.docType ?? '')
        || n.includes('budget') || n.includes('boq') || n.includes('contrat') || n.includes('devis') || n.includes('montant');
    })
    .map(d => `=== ${d.name} ===\n${d.text.slice(0, 600)}`).join('\n\n')
    || state.documents.map(d => `=== ${d.name} ===\n${d.text.slice(0, 400)}`).join('\n\n');

  const system = `Tu es un expert financier spécialisé dans les marchés publics FCFA/XOF au Sénégal.
Identifie les montants en FCFA, millions FCFA, milliards FCFA, ou USD/EUR.
Détecte les lots (Lot 1, Lot 2, LOT N°…).
Réponds UNIQUEMENT en JSON valide.`;

  const prompt = `Extrait les données financières :

${financialDocs}

JSON attendu :
{
  "totalBudget": 12500000000,
  "currency": "FCFA",
  "lots": [
    {"numero":"1","label":"Intitulé Lot 1","budget":5000000000,"localisation":"Dakar"},
    {"numero":"2","label":"Intitulé Lot 2","budget":7500000000}
  ],
  "wbsItems": [
    {"code":"1.0","label":"Études","budget":500000000},
    {"code":"2.0","label":"Fournitures","budget":8000000000}
  ],
  "confidence": 0.92
}`;

  try {
    const { text, model } = await callWithFallback(system, prompt, apiKey, 1024);
    const budget = extractJSON<Record<string, unknown>>(text);
    if (budget) {
      const lots = Array.isArray(budget.lots) ? budget.lots as {numero:string;label:string;budget?:number;localisation?:string}[] : [];
      const wbs  = Array.isArray(budget.wbsItems) ? budget.wbsItems as {code:string;label:string;budget:number}[] : [];
      return {
        ...state,
        modelUsed: state.modelUsed || model,
        budgetData: {
          total:    typeof budget.totalBudget === 'number' ? budget.totalBudget : undefined,
          currency: String(budget.currency || 'FCFA'),
          lots,
        },
        projectMeta: {
          ...state.projectMeta,
          budget:    typeof budget.totalBudget === 'number' ? budget.totalBudget : state.projectMeta.budget,
          currency:  String(budget.currency || state.projectMeta.currency || 'FCFA'),
          lots,
          wbsItems:  wbs.length ? wbs : state.projectMeta.wbsItems,
        },
      };
    }
  } catch (e) {
    console.warn('[SwarmIA] BudgetAnalyst failed:', e);
  }
  return state;
}

/**
 * NODE 4 — RiskAssessor
 * Détecte les risques à partir des documents (rapports, PV, correspondances…)
 */
async function nodeRiskAssessor(state: SwarmState, apiKey: string): Promise<SwarmState> {
  const reportDocs = state.documents
    .filter(d => {
      const classified = state.classified.find(c => c.name === d.name);
      return ['report_monthly', 'report_quarterly', 'pv_reception', 'contract'].includes(classified?.docType ?? '');
    })
    .map(d => d.text.slice(0, 500)).join('\n\n')
    || state.documents[0]?.text.slice(0, 800) || '';

  const system = `Tu es un expert en gestion des risques de projets d'infrastructure en Afrique subsaharienne.
Réponds UNIQUEMENT en JSON valide.`;

  const prompt = `Identifie les risques dans ces extraits de documents de projet :

${reportDocs}

JSON attendu :
{
  "risks": [
    {"description":"Retard livraison équipements","severity":"haute"},
    {"description":"Hausse prix cuivre/acier","severity":"moyenne"},
    {"description":"Difficultés accès terrain en saison des pluies","severity":"moyenne"},
    {"description":"Retard approbations bailleurs","severity":"haute"}
  ]
}`;

  try {
    const { text, model } = await callWithFallback(system, prompt, apiKey, 512);
    const result = extractJSON<{ risks: {description:string;severity:string}[] }>(text);
    if (result?.risks?.length) {
      return {
        ...state,
        modelUsed: state.modelUsed || model,
        risks: result.risks.map(r => ({
          description: r.description,
          severity: (['haute','moyenne','basse'].includes(r.severity) ? r.severity : 'moyenne') as 'haute'|'moyenne'|'basse',
        })),
      };
    }
  } catch (e) {
    console.warn('[SwarmIA] RiskAssessor failed:', e);
  }
  return {
    ...state,
    risks: state.risks.length ? state.risks : [
      { description: 'Retard approbation bailleur de fonds', severity: 'haute' },
      { description: 'Hausse prix matériaux (cuivre, câbles)', severity: 'moyenne' },
      { description: 'Conditions climatiques (saison des pluies)', severity: 'moyenne' },
      { description: 'Difficultés accès terrain rural', severity: 'basse' },
    ],
  };
}

/**
 * NODE 5 — QAAgent
 * Valide la cohérence de l'extraction et calcule le score de confiance.
 * Cible : ≥ 95 %.
 */
async function nodeQAAgent(state: SwarmState, apiKey: string): Promise<SwarmState> {
  const summary = JSON.stringify({
    projectName: state.projectMeta.projectName,
    codeBIT:     state.projectMeta.codeBIT,
    budget:      state.projectMeta.budget,
    dates:       { start: state.projectMeta.startDate, end: state.projectMeta.endDate },
    lots:        state.budgetData.lots.length,
    risks:       state.risks.length,
    docs:        state.classified.length,
  }, null, 2);

  const system = `Tu es un auditeur qualité expert pour les systèmes de gestion de projets SENELEC.
Évalue la complétude des données extraites et suggère des corrections.
Réponds UNIQUEMENT en JSON valide.`;

  const prompt = `Évalue la qualité de cette extraction de données de projet :

${summary}

Calcule un score de confiance (0-100) basé sur :
- Présence du code BIT (+20 pts)
- Nom de projet intelligible (+15 pts)
- Budget > 0 (+20 pts)
- Dates cohérentes (+15 pts)
- Au moins 1 lot détecté (+10 pts)
- Au moins 2 risques (+10 pts)
- Au moins 3 documents classifiés (+10 pts)

JSON attendu :
{
  "confidence": 97,
  "issues": ["manque code BIT"],
  "suggestions": ["vérifier date fin"]
}`;

  try {
    const { text, model } = await callWithFallback(system, prompt, apiKey, 512);
    const qa = extractJSON<{ confidence: number; issues: string[]; suggestions: string[] }>(text);
    if (qa) {
      return {
        ...state,
        modelUsed: state.modelUsed || model,
        qaResult: {
          confidence:  Math.min(100, Math.max(0, qa.confidence || 70)),
          issues:      qa.issues || [],
          suggestions: qa.suggestions || [],
        },
      };
    }
  } catch (e) {
    console.warn('[SwarmIA] QAAgent failed:', e);
  }

  // Calcul heuristique de confiance si LLM échoue
  const meta = state.projectMeta;
  let score = 0;
  if (meta.codeBIT)                      score += 20;
  if (meta.projectName && meta.projectName.length > 5) score += 15;
  if (meta.budget && meta.budget > 0)    score += 20;
  if (meta.startDate && meta.endDate)    score += 15;
  if (state.budgetData.lots.length > 0)  score += 10;
  if (state.risks.length >= 2)           score += 10;
  if (state.classified.length >= 3)      score += 10;
  return { ...state, qaResult: { confidence: score, issues: [], suggestions: [] } };
}

/* ─── Orchestrateur principal (graphe séquentiel avec phases parallèles) ────── */

/**
 * Exécute le swarm LangGraph-inspired sur les documents fournis.
 * Phases :
 *   1. DocClassifier (séquentiel — dépendance des nœuds suivants)
 *   2. ProjectExtractor + BudgetAnalyst + RiskAssessor (parallèle)
 *   3. QAAgent (séquentiel — consolide les résultats)
 */
export async function runSwarm(
  documents: { name: string; text: string }[],
  apiKey: string,
  onProgress?: (step: string, pct: number) => void,
): Promise<SwarmResult> {

  // État initial du graphe
  let state: SwarmState = {
    documents,
    classified: [],
    projectMeta: {},
    budgetData: { lots: [] },
    risks: [],
    qaResult: { confidence: 0, issues: [], suggestions: [] },
    modelUsed: 'heuristic',
  };

  try {
    // ── Phase 1 : Classification ──
    onProgress?.('Classification des documents…', 10);
    state = await nodeDocClassifier(state, apiKey);

    // ── Phase 2 : Extraction parallèle ──
    onProgress?.('Extraction parallèle (projet + budget + risques)…', 35);
    const [stateProject, stateBudget, stateRisks] = await Promise.all([
      nodeProjectExtractor({ ...state }, apiKey),
      nodeBudgetAnalyst({ ...state }, apiKey),
      nodeRiskAssessor({ ...state }, apiKey),
    ]);

    // Fusionne les résultats parallèles
    state = {
      ...state,
      projectMeta: { ...stateProject.projectMeta, ...stateBudget.projectMeta },
      budgetData:  stateBudget.budgetData,
      risks:       stateRisks.risks,
      modelUsed:   stateProject.modelUsed || stateBudget.modelUsed || stateRisks.modelUsed || state.modelUsed,
    };

    // ── Phase 3 : QA ──
    onProgress?.('Validation qualité & scoring…', 80);
    state = await nodeQAAgent(state, apiKey);

    onProgress?.('Swarm terminé', 100);
  } catch (e) {
    console.error('[SwarmIA] Orchestrateur error:', e);
    state.error = String(e);
    // Score dégradé mais pas zéro
    state.qaResult = { confidence: 45, issues: ['Erreur LLM — fallback heuristique'], suggestions: [] };
  }

  // Construire l'ExtractedData final
  const meta = state.projectMeta;
  const extracted: ExtractedData = {
    projectName:  meta.projectName  || undefined,
    projectCode:  meta.codeBIT || meta.projectCode || undefined,
    codeBIT:      meta.codeBIT      || undefined,
    projectType:  meta.projectType  || undefined,
    budget:       meta.budget       || undefined,
    currency:     meta.currency     || 'FCFA',
    startDate:    meta.startDate    || undefined,
    endDate:      meta.endDate      || undefined,
    contractor:   meta.contractor   || undefined,
    location:     meta.location     || undefined,
    wbsItems:     meta.wbsItems     || [],
    lots:         state.budgetData.lots,
    risks:        state.risks,
    milestones:   meta.milestones   || [],
    deliverables: meta.deliverables || [],
  };

  return {
    extracted,
    confidence:  state.qaResult.confidence,
    modelUsed:   state.modelUsed,
    qaIssues:    state.qaResult.issues,
    rawState:    state,
  };
}

/* ─── Vérification disponibilité Groq ─────────────────────────────────────── */

export async function groqAvailable(apiKey: string): Promise<boolean> {
  if (!apiKey) return false;
  try {
    const resp = await fetch(`${GROQ_BASE}/models`, {
      headers: { Authorization: `Bearer ${apiKey}` },
      signal: AbortSignal.timeout(3000),
    });
    return resp.ok;
  } catch {
    return false;
  }
}

/** Retourne la clé Groq depuis l'environnement (client ou serveur). */
export function getGroqKey(): string {
  return (
    (typeof process !== 'undefined' && process.env?.GROQ_API_KEY) ||
    (typeof process !== 'undefined' && process.env?.NEXT_PUBLIC_GROQ_API_KEY) ||
    ''
  );
}

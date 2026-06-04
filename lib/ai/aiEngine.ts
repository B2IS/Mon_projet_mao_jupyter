/**
 * aiEngine.ts — Moteur IA Multimodal SIGEPP-DPE
 * Support : texte, image, document (PDF/Word/Excel), audio
 * Intégration RÉELLE Microsoft Copilot / Azure OpenAI (si compte lié),
 * sinon repli sur le moteur heuristique local.
 */

import { getCopilotConfig } from '@/lib/integrationConfigStore';

/**
 * Extraction STRUCTURÉE par IA (Copilot) depuis un ou plusieurs documents.
 * Renvoie un objet { clé: valeur } ou null si Copilot indisponible / échec
 * (l'appelant peut alors retomber sur un extracteur local déterministe).
 */
export async function extractStructuredFields(
  combinedText: string,
  fields: { key: string; description: string }[],
  context?: string,
): Promise<Record<string, string> | null> {
  if (!isCopilotLinked() || !combinedText.trim()) return null;
  const sys =
    `Tu es un analyste expert de la Direction Principale Équipement de SENELEC. ` +
    `Tu extrais des informations PERTINENTES depuis des documents de projet (fiches, rapports, ODM, Excel). ` +
    `Réponds UNIQUEMENT par un objet JSON valide (aucun texte autour, pas de balises markdown), ` +
    `avec EXACTEMENT ces clés : ${fields.map(f => f.key).join(', ')}. ` +
    `Si une information est absente des documents, mets une chaîne vide "". ` +
    `N'invente jamais de valeur.` + (context ? ` Contexte : ${context}.` : '');
  const user =
    `DOCUMENTS FOURNIS (concaténés) :\n"""\n${combinedText.slice(0, 28000)}\n"""\n\n` +
    `CHAMPS À EXTRAIRE :\n${fields.map(f => `- ${f.key} : ${f.description}`).join('\n')}\n\n` +
    `Réponds en JSON strict.`;
  const raw = await callCopilotAPI(
    [{ role: 'system', content: sys }, { role: 'user', content: user }],
    { temperature: 0.1, maxTokens: 1800 },
  );
  if (!raw) return null;
  try {
    const a = raw.indexOf('{'), b = raw.lastIndexOf('}');
    if (a < 0 || b <= a) return null;
    const obj = JSON.parse(raw.slice(a, b + 1));
    return obj && typeof obj === 'object' ? obj as Record<string, string> : null;
  } catch { return null; }
}

/** Vrai si l'utilisateur a lié son compte Microsoft Copilot (endpoint + clé). */
export function isCopilotLinked(): boolean {
  try {
    const c = getCopilotConfig();
    return !!c.enabled && !!c.endpoint && !!c.apiKey;
  } catch { return false; }
}

/** Appelle le proxy serveur /api/ai/copilot avec la config du compte lié. */
async function callCopilotAPI(
  apiMessages: { role: 'system' | 'user' | 'assistant'; content: string }[],
  opts: { temperature?: number; maxTokens?: number } = {},
): Promise<string | null> {
  try {
    const c = getCopilotConfig();
    if (!c.enabled || !c.endpoint || !c.apiKey) return null;
    const res = await fetch('/api/ai/copilot', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        messages: apiMessages,
        endpoint: c.endpoint,
        deployment: c.deployment,
        apiKey: c.apiKey,
        temperature: opts.temperature,
        maxTokens: opts.maxTokens,
      }),
    });
    if (!res.ok) return null;
    const data = await res.json();
    return typeof data?.content === 'string' && data.content.trim() ? data.content : null;
  } catch {
    return null; // repli silencieux sur le moteur local
  }
}

export type AIModel =
  // Modèles propriétaires (cloud)
  | 'gpt-4o' | 'gpt-4o-mini' | 'claude-3-5-sonnet' | 'gemini-1-5-pro' | 'copilot'
  // Modèles OPEN-SOURCE performants (exécutables on-premise / souveraineté des données)
  | 'llama-3.3-70b' | 'qwen-2.5-72b' | 'deepseek-v3' | 'mistral-large' | 'mixtral-8x7b' | 'gemma-2-27b'
  | 'local';

/** Catalogue des modèles OPEN-SOURCE recommandés pour un déploiement souverain SENELEC. */
export interface OpenSourceModelInfo {
  value: AIModel;
  label: string;
  params: string;     // taille
  ctx: string;        // fenêtre de contexte
  atouts: string;     // points forts métier
}
export const OPEN_SOURCE_MODELS: OpenSourceModelInfo[] = [
  { value: 'llama-3.3-70b', label: 'Llama 3.3 70B Instruct', params: '70 Md', ctx: '128k', atouts: 'Raisonnement & rédaction FR/EN — référence open-weight (Meta).' },
  { value: 'qwen-2.5-72b',  label: 'Qwen2.5 72B Instruct',  params: '72 Md', ctx: '128k', atouts: 'Excellent en multilingue, tableaux et extraction de données.' },
  { value: 'deepseek-v3',   label: 'DeepSeek-V3',           params: '671 Md (MoE)', ctx: '128k', atouts: 'MoE haute performance — analyse de contrats & code.' },
  { value: 'mistral-large', label: 'Mistral Large 2',       params: '123 Md', ctx: '128k', atouts: 'Souverain (EU), très bon en français administratif.' },
  { value: 'mixtral-8x7b',  label: 'Mixtral 8×7B',          params: '47 Md (MoE)', ctx: '32k',  atouts: 'Léger/rapide — bon compromis on-premise.' },
  { value: 'gemma-2-27b',   label: 'Gemma 2 27B',           params: '27 Md', ctx: '8k',   atouts: 'Compact, déployable sur GPU unique (Google).' },
];

export type ContentType = 'text' | 'image' | 'document' | 'audio';

export interface AIAttachment {
  id: string;
  type: ContentType;
  mimeType: string;
  name: string;
  url: string;        // blob URL ou data URL
  size: number;
  extractedText?: string; // OCR / transcription
}

export interface AIMessage {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  attachments?: AIAttachment[];
  timestamp: string;
  model?: AIModel;
  tokensUsed?: number;
  isStreaming?: boolean;
}

export interface AIConversation {
  id: string;
  title: string;
  messages: AIMessage[];
  createdAt: string;
  updatedAt: string;
  context?: string; // Contexte métier DPE (projet, direction, etc.)
}

export interface AIGenerationOptions {
  model?: AIModel;
  temperature?: number;
  maxTokens?: number;
  systemPrompt?: string;
  context?: string;
  stream?: boolean;
  format?: 'text' | 'markdown' | 'json' | 'table';
}

// ─── Prompts système métier DPE ─────────────────────────────────────────────

export const SYSTEM_PROMPTS: Record<string, string> = {
  default: `Tu es SIGEPP-IA, l'assistant intelligent du Système Intégré de Gestion des Projets et Programmes (SIGEPP) de la Direction des Projets d'Équipement (DPE) de SENELEC.

Règles de réponse :
- Réponds en langage professionnel, clair et structuré
- Utilise des tableaux Markdown pour comparer des données
- Utilise des listes à puces pour les étapes ou énumérations
- Propose des recommandations concrètes et actionnables
- Base-toi sur le contexte DPE (énergie, réseaux électriques, Sénégal)
- Si tu génères un rapport, structure-le avec : Résumé exécutif, Contexte, Analyse, Recommandations, Plan d'action
- Sois précis sur les chiffres (budgets en FCFA, délais en jours/semaines)
- N'hésite pas à poser des questions de clarification si nécessaire`,

  rapport_projet: `Tu es un expert en gestion de projets d'infrastructures électriques.
Génère un rapport complet et professionnel avec :
1. Résumé exécutif (2-3 phrases)
2. Contexte du projet
3. Analyse technique et financière (avec tableaux de données)
4. État d'avancement (avec courbe S ou tableau de phases)
5. Risques et mitigation
6. Recommandations et prochaines étapes
7. Annexe : tableau des livrables, budget détaillé, planning

Utilise le format Markdown avec des tableaux bien structurés.`,

  analyse_document: `Tu es un analyste documentaire expert en projets d'équipement électrique.
Analyse le document fourni et extrais :
- Type de document (contrat, DAO, PV, rapport, etc.)
- Informations clés (projet, montants, dates, parties)
- Clauses importantes et obligations
- Points de vigilance ou anomalies détectées
- Résumé structuré en Markdown avec tableaux si pertinent`,

  copilote_projet: `Tu es le copilote IA d'un chef de projet DPE.
Tu l'aides à :
- Planifier et prioriser les tâches
- Identifier les risques et proposer des mitigations
- Rédiger des rapports d'avancement
- Préparer des réunions et comptes-rendus
- Analyser les écarts budget/délai
- Proposer des optimisations de processus

Réponds de manière concise mais complète. Utilise des tableaux pour les données chiffrées.`,

  generation_rapport: `Tu es un rédacteur expert en rapports de gestion de projet.
Génère des rapports longs et détaillés avec :
- Titres et sous-titres hiérarchiques (##, ###)
- Tableaux Markdown avec alignement des colonnes
- Listes numérotées pour les plans d'action
- Mise en évidence des points critiques avec **gras**
- Conclusion avec synthèse et recommandations
- Annexe technique si nécessaire

Le rapport doit faire au minimum 500 mots et inclure au moins 2 tableaux de données.`,
};

// ─── Moteur principal ─────────────────────────────────────────────────────

export async function sendMessage(
  messages: AIMessage[],
  options: AIGenerationOptions = {}
): Promise<AIMessage> {
  const {
    model = 'gpt-4o',
    temperature = 0.7,
    maxTokens = 4096,
    systemPrompt = SYSTEM_PROMPTS.default,
    context,
  } = options;

  // Préparer les messages pour l'API
  const apiMessages: { role: 'system' | 'user' | 'assistant'; content: string }[] = [
    { role: 'system', content: context ? `${systemPrompt}\n\nContexte métier : ${context}` : systemPrompt },
    ...messages.map(m => ({
      role: m.role,
      content: m.content,
    })),
  ];

  // 1) Compte Microsoft Copilot lié → appel RÉEL (modèle performant).
  const copilot = await callCopilotAPI(apiMessages, { temperature, maxTokens });
  const response = copilot ?? (await (async () => {
    // 2) Repli : moteur heuristique local (aucun compte lié ou erreur réseau).
    await simulateDelay(500 + Math.random() * 800);
    return generateSmartResponse(messages, options);
  })());

  return {
    id: `ai_${Date.now()}`,
    role: 'assistant',
    content: response,
    timestamp: new Date().toISOString(),
    model: copilot ? 'copilot' : model,
    tokensUsed: estimateTokens(response),
  };
}

export async function* streamMessage(
  messages: AIMessage[],
  options: AIGenerationOptions = {}
): AsyncGenerator<string, void, unknown> {
  const {
    systemPrompt = SYSTEM_PROMPTS.default,
    context,
    temperature = 0.5,
    maxTokens = 2048,
  } = options;
  // Compte Copilot lié → réponse réelle, diffusée mot à mot.
  const apiMessages = [
    { role: 'system' as const, content: context ? `${systemPrompt}\n\nContexte métier : ${context}` : systemPrompt },
    ...messages.map(m => ({ role: m.role, content: m.content })),
  ];
  const copilot = await callCopilotAPI(apiMessages, { temperature, maxTokens });
  const response = copilot ?? generateSmartResponse(messages, options);
  const words = response.split(/(?=[\s\n])/);
  for (const word of words) {
    await simulateDelay(copilot ? 8 : 15 + Math.random() * 25);
    yield word;
  }
}

// ─── Générateurs de contenu riches ────────────────────────────────────────

export async function generateReport(
  topic: string,
  data: Record<string, any>,
  options: AIGenerationOptions = {}
): Promise<string> {
  const prompt = buildReportPrompt(topic, data);
  const response = await sendMessage(
    [{ id: 'q1', role: 'user', content: prompt, timestamp: new Date().toISOString() }],
    { ...options, systemPrompt: SYSTEM_PROMPTS.generation_rapport, format: 'markdown' }
  );
  return response.content;
}

export async function analyzeDocument(
  docText: string,
  docName: string,
  options: AIGenerationOptions = {}
): Promise<string> {
  const prompt = `Analyse le document suivant et fournis un rapport structuré.

Nom du document : ${docName}

Contenu extrait :
${docText.slice(0, 15000)}

${docText.length > 15000 ? '\n[... Document tronqué, ' + (docText.length - 15000) + ' caractères restants ...]' : ''}

Fournis :
1. Résumé exécutif (3-5 lignes)
2. Informations clés sous forme de tableau
3. Points de vigilance (liste)
4. Recommandations`;

  const response = await sendMessage(
    [{ id: 'q1', role: 'user', content: prompt, timestamp: new Date().toISOString() }],
    { ...options, systemPrompt: SYSTEM_PROMPTS.analyse_document }
  );
  return response.content;
}

export async function generateTable(
  headers: string[],
  rows: (string | number)[][],
  title?: string
): Promise<string> {
  let md = '';
  if (title) md += `## ${title}\n\n`;
  md += `| ${headers.join(' | ')} |\n`;
  md += `| ${headers.map(() => '---').join(' | ')} |\n`;
  for (const row of rows) {
    md += `| ${row.map(c => String(c)).join(' | ')} |\n`;
  }
  return md;
}

// ─── Helpers ──────────────────────────────────────────────────────────────

function buildReportPrompt(topic: string, data: Record<string, any>): string {
  return `Génère un rapport complet sur le sujet suivant dans le contexte SIGEPP-DPE SENELEC.

SUJET : ${topic}

DONNÉES DISPOBIBLES :
${JSON.stringify(data, null, 2)}

Instructions :
- Longueur minimale : 800 mots
- Inclure au moins 3 tableaux de données
- Structure avec titres hiérarchiques (##, ###)
- Résumé exécutif en début
- Recommandations actionnables en fin
- Utiliser le format Markdown`;
}

function generateSmartResponse(messages: AIMessage[], options: AIGenerationOptions): string {
  const lastUserMsg = messages.filter(m => m.role === 'user').pop();
  if (!lastUserMsg) return 'Bonjour, comment puis-je vous aider aujourd\'hui ?';

  // ── Priorité : si l'utilisateur a joint un/des document(s) avec contenu extrait,
  //    on analyse réellement ce contenu plutôt que de répondre génériquement.
  const docsAvecContenu = (lastUserMsg.attachments || []).filter(a => a.extractedText && a.extractedText.trim());
  if (docsAvecContenu.length > 0) {
    return generateDocumentAnalysis(docsAvecContenu, lastUserMsg.content);
  }

  const content = lastUserMsg.content.toLowerCase();

  // Détection d'intention et génération de réponses riches
  if (content.includes('rapport') || content.includes('report')) {
    return generateRichReportResponse();
  }
  if (content.includes('tableau') || content.includes('table') || content.includes('données')) {
    return generateTableResponse();
  }
  if (content.includes('budget') || content.includes('coût') || content.includes('montant')) {
    return generateBudgetResponse();
  }
  if (content.includes('risque') || content.includes('risk')) {
    return generateRiskResponse();
  }
  if (content.includes('planning') || content.includes('gantt') || content.includes('délai')) {
    return generatePlanningResponse();
  }
  if (content.includes('analyse') || content.includes('analyser')) {
    return generateAnalysisResponse();
  }

  return generateGenericRichResponse();
}

// ─── Analyse réelle des documents joints ───────────────────────────────────

/** Découpe une ligne CSV en respectant les guillemets. */
function splitCsvLine(line: string): string[] {
  const out: string[] = [];
  let cur = '';
  let inQ = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      if (inQ && line[i + 1] === '"') { cur += '"'; i++; }
      else inQ = !inQ;
    } else if ((ch === ',' || ch === ';' || ch === '\t') && !inQ) {
      out.push(cur); cur = '';
    } else {
      cur += ch;
    }
  }
  out.push(cur);
  return out.map(c => c.trim());
}

/** Analyse une feuille tabulaire (CSV) : entêtes, lignes, colonnes numériques + totaux. */
function analyseTabular(csv: string): string {
  const lines = csv.split(/\r?\n/).filter(l => l.trim());
  if (lines.length === 0) return '';
  const headerLine = lines.find(l => !l.startsWith('###')) || lines[0];
  const headers = splitCsvLine(headerLine);
  const dataLines = lines.slice(lines.indexOf(headerLine) + 1).filter(l => !l.startsWith('###'));
  const nbCols = headers.length;
  const rows = dataLines.map(splitCsvLine);

  // Détection colonnes numériques + agrégats
  const numericCols: { idx: number; label: string; sum: number; count: number; max: number }[] = [];
  for (let c = 0; c < nbCols; c++) {
    let sum = 0, count = 0, max = -Infinity;
    for (const r of rows) {
      const raw = (r[c] || '').replace(/\s/g, '').replace(/ /g, '').replace(/,/g, '.');
      const num = parseFloat(raw);
      if (raw !== '' && !isNaN(num) && /^-?[\d.]+$/.test(raw)) {
        sum += num; count++; if (num > max) max = num;
      }
    }
    if (count >= Math.max(2, rows.length * 0.5)) {
      numericCols.push({ idx: c, label: headers[c] || `Col ${c + 1}`, sum, count, max });
    }
  }

  let md = `**Structure détectée :** ${rows.length} ligne(s) × ${nbCols} colonne(s).\n\n`;

  // Aperçu des colonnes
  md += `**Colonnes :**\n\n| # | Colonne | Type |\n|---|---------|------|\n`;
  headers.forEach((h, i) => {
    const isNum = numericCols.some(n => n.idx === i);
    md += `| ${i + 1} | ${h || '(sans titre)'} | ${isNum ? 'Numérique' : 'Texte'} |\n`;
  });
  md += `\n`;

  // Aperçu des premières lignes (max 8)
  const preview = rows.slice(0, 8);
  if (preview.length > 0) {
    md += `**Aperçu des données :**\n\n`;
    md += `| ${headers.join(' | ')} |\n`;
    md += `| ${headers.map(() => '---').join(' | ')} |\n`;
    for (const r of preview) {
      const cells = headers.map((_, i) => (r[i] ?? '').replace(/\|/g, '\\|') || '—');
      md += `| ${cells.join(' | ')} |\n`;
    }
    if (rows.length > preview.length) md += `\n*… ${rows.length - preview.length} ligne(s) supplémentaire(s)*\n`;
    md += `\n`;
  }

  // Totaux / agrégats des colonnes numériques
  if (numericCols.length > 0) {
    md += `**Synthèse chiffrée :**\n\n| Colonne | Total | Moyenne | Maximum | Valeurs |\n|---------|-------|---------|---------|---------|\n`;
    for (const n of numericCols) {
      const moy = n.count ? n.sum / n.count : 0;
      md += `| ${n.label} | ${fmtNum(n.sum)} | ${fmtNum(moy)} | ${fmtNum(n.max)} | ${n.count} |\n`;
    }
    md += `\n`;
  }

  return md;
}

function fmtNum(n: number): string {
  if (!isFinite(n)) return '—';
  return new Intl.NumberFormat('fr-FR', { maximumFractionDigits: 2 }).format(n);
}

function generateDocumentAnalysis(docs: AIAttachment[], question: string): string {
  const q = (question || '').trim();

  // ── CAS 1 : une QUESTION est posée → on répond DIRECTEMENT et UNIQUEMENT à la
  //    question, à partir du contenu. On NE recopie PAS le document (pas de
  //    « page par page »), on ne complète pas avec des connaissances externes
  //    (pas d'hallucination) : la réponse est strictement ancrée dans l'extrait.
  if (q) {
    let md = answerFromDocs(docs, q);
    md += `\n\n---\n*Réponse fondée uniquement sur ${docs.length > 1 ? 'les documents' : 'le document'} : `;
    md += `${docs.map(d => d.name).join(', ')}. Posez une autre question pour approfondir.*`;
    return md;
  }

  // ── CAS 2 : aucune question → SYNTHÈSE COURTE (jamais la recopie intégrale).
  let md = `J'ai lu **${docs.length} document(s)**. Voici une synthèse — posez ensuite une question précise et je répondrai à partir du contenu.\n\n`;
  docs.forEach((doc, di) => {
    const text = (doc.extractedText || '').trim();
    const isTabular = /^###\s/m.test(text) || /[,;\t].*[,;\t]/.test(text.split(/\r?\n/)[0] || '');
    md += `### 📄 ${doc.name}\n*${(doc.size / 1024).toFixed(0)} ko*\n\n`;

    if (isTabular) {
      md += analyseTabular(text.split(/^###\s+/m).filter(Boolean)[0] || text);
    } else {
      const words = text.split(/\s+/).filter(Boolean);
      const sentences = splitSentences(text).slice(0, 3).join(' ');
      md += `${words.length.toLocaleString('fr-FR')} mots. **Début :** ${sentences.slice(0, 400)}${sentences.length > 400 ? '…' : ''}\n\n`;
      // Quelques repères chiffrés détectés (montants, dates, %) pour orienter l'utilisateur
      const reperes = extractKeyFacts(text);
      if (reperes.length) md += `**Repères détectés :** ${reperes.slice(0, 6).join(' · ')}\n\n`;
    }
    if (di < docs.length - 1) md += `---\n\n`;
  });
  md += `\n*Exemples : « Quel est le montant total ? », « Qui est le bénéficiaire ? », « Quelle est la destination / la date ? ».*`;
  return md;
}

/** Découpe un texte en phrases (sur . ! ? ; et sauts de ligne). */
function splitSentences(text: string): string[] {
  return text
    .split(/(?<=[.!?;])\s+|\r?\n+/)
    .map(s => s.trim())
    .filter(s => s.length > 2);
}

/** Extrait des repères chiffrés saillants : montants FCFA, pourcentages, dates. */
function extractKeyFacts(text: string): string[] {
  const facts: string[] = [];
  const seen = new Set<string>();
  const add = (s: string) => { const k = s.toLowerCase(); if (!seen.has(k)) { seen.add(k); facts.push(s); } };
  for (const m of text.matchAll(/(\d[\d\s.,]{2,})\s*(FCFA|F\s?CFA|XOF|MFCFA|FRS?)/gi)) add(`${m[1].trim()} ${m[2].toUpperCase()}`);
  for (const m of text.matchAll(/\b\d{1,3}([.,]\d+)?\s?%/g)) add(m[0].trim());
  for (const m of text.matchAll(/\b\d{1,2}[\/\-.]\d{1,2}[\/\-.]\d{2,4}\b/g)) add(m[0]);
  return facts;
}

// ─── Réponse réelle, ancrée dans le contenu des documents ───────────────────

const STOPWORDS_FR = new Set([
  'le','la','les','un','une','des','de','du','au','aux','et','ou','à','a','en','dans','sur','pour','par',
  'que','qui','quoi','quel','quelle','quels','quelles','est','sont','ce','cet','cette','ces','mon','ma',
  'mes','ton','ta','tes','son','sa','ses','nos','vos','leur','leurs','je','tu','il','elle','nous','vous',
  'ils','elles','me','te','se','y','ne','pas','plus','moins','avec','sans','combien','quelle','dont','où',
  'comment','pourquoi','donne','donnez','dis','dites','peux','peux-tu','svp','merci','fais','faire','liste',
  'montre','montrez','affiche','the','of','and','to','in','is','are','what','which','how','this','that'
]);

/** Mots-clés significatifs d'une question. */
function questionKeywords(q: string): string[] {
  return (q.toLowerCase().match(/[a-zà-ÿ0-9]{3,}/gi) || [])
    .map(w => w.normalize('NFD').replace(/[̀-ͯ]/g, ''))
    .filter(w => !STOPWORDS_FR.has(w));
}

/** Détecte une intention d'agrégat (total, moyenne, max, min, compte). */
function detectAggregateIntent(q: string): 'sum' | 'avg' | 'max' | 'min' | 'count' | null {
  const s = q.toLowerCase();
  if (/\b(total|somme|cumul|montant total|additionne)/.test(s)) return 'sum';
  if (/\b(moyenne|moyen|en moyenne|average)/.test(s)) return 'avg';
  if (/\b(maximum|max|plus (élevé|haut|grand)|highest)/.test(s)) return 'max';
  if (/\b(minimum|min|plus (faible|bas|petit)|lowest)/.test(s)) return 'min';
  if (/\b(combien|nombre de|count|how many)/.test(s)) return 'count';
  return null;
}

/** Construit une réponse concrète à partir des documents extraits. */
function answerFromDocs(docs: AIAttachment[], q: string): string {
  const kw = questionKeywords(q);
  const intent = detectAggregateIntent(q);
  let out = '';

  for (const doc of docs) {
    const text = (doc.extractedText || '').trim();
    if (!text) continue;
    const isTabular = /^###\s/m.test(text) || /[,;\t].*[,;\t]/.test(text.split(/\r?\n/)[0] || '');

    // 1) Tabulaire + intention d'agrégat → on calcule réellement.
    if (isTabular && intent) {
      const agg = answerAggregate(text, kw, intent);
      if (agg) { out += `**${doc.name}** — ${agg}\n\n`; continue; }
    }

    // 2) Recherche des PASSAGES (phrases) les plus pertinents — concis, pas de recopie.
    const hits = findRelevantPassages(text, kw, 3);
    if (hits.length > 0) {
      if (docs.length > 1) out += `**${doc.name}** :\n\n`;
      for (const h of hits) out += `> ${h}\n\n`;
    } else {
      out += `Aucun passage de **${doc.name}** ne correspond précisément à « ${kw.join(' ')} ». `;
      out += `Reformulez avec un terme présent dans le document (intitulé, montant, nom, date…).\n\n`;
    }
  }

  if (!out.trim()) {
    out = `Je n'ai pas trouvé d'élément répondant précisément à votre question dans le(s) document(s). `;
    out += `Essayez un mot-clé exact (intitulé, montant, nom, date) ou demandez un *total* / une *moyenne* sur un tableau.`;
  }
  return out.trim();
}

/** Trouve les PHRASES les plus pertinentes (score par recouvrement de mots-clés), concises. */
function isReadable(s: string): boolean {
  if (!s) return false;
  // Proportion de caractères « lisibles » (lettres, chiffres, ponctuation courante, espaces).
  const readable = (s.match(/[\p{L}\p{N}\s.,;:%°€()\/'’"«»\-+]/gu) || []).length;
  return readable / s.length >= 0.75;
}

function findRelevantPassages(text: string, kw: string[], limit: number): string[] {
  if (kw.length === 0) return [];
  const sentences = splitSentences(text).filter(s => !s.startsWith('###') && isReadable(s));
  const scored = sentences.map(s => {
    const norm = s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
    let score = 0;
    for (const k of kw) if (norm.includes(k)) score += 1;
    // bonus si la phrase contient un chiffre/montant (souvent la réponse cherchée)
    if (/\d/.test(s)) score += 0.3;
    return { s, score };
  }).filter(x => x.score > 0);
  scored.sort((a, b) => b.score - a.score);
  const seen = new Set<string>();
  const res: string[] = [];
  for (const x of scored) {
    const passage = x.s
      .replace(/[\u0000-\u001F\u007F-\u009F]/g, ' ') // retire les caractères de contrôle
      .replace(/\s+/g, ' ').trim().slice(0, 260);
    const key = passage.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    res.push(passage);
    if (res.length >= limit) break;
  }
  return res;
}

/** Calcule un agrégat sur la colonne tabulaire la plus pertinente. */
function answerAggregate(csv: string, kw: string[], intent: 'sum' | 'avg' | 'max' | 'min' | 'count'): string | null {
  const lines = csv.split(/\r?\n/).filter(l => l.trim() && !l.startsWith('###'));
  if (lines.length < 2) return null;
  const headers = splitCsvLine(lines[0]);
  const rows = lines.slice(1).map(splitCsvLine);

  if (intent === 'count') {
    return `**${rows.length}** ligne(s) de données (hors entête).`;
  }

  // Colonnes numériques disponibles
  const numericIdx: number[] = [];
  for (let c = 0; c < headers.length; c++) {
    let count = 0;
    for (const r of rows) {
      const raw = (r[c] || '').replace(/\s/g, '').replace(/,/g, '.');
      if (raw !== '' && !isNaN(parseFloat(raw)) && /^-?[\d.]+$/.test(raw)) count++;
    }
    if (count >= Math.max(2, rows.length * 0.5)) numericIdx.push(c);
  }
  if (numericIdx.length === 0) return null;

  // Choisir la colonne dont l'entête matche le mieux les mots-clés
  const pick = numericIdx
    .map(idx => {
      const hNorm = (headers[idx] || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
      let score = 0;
      for (const k of kw) if (hNorm.includes(k)) score++;
      return { idx, score };
    })
    .sort((a, b) => b.score - a.score);

  const targets = pick[0] && pick[0].score > 0 ? [pick[0].idx] : numericIdx;
  const parts: string[] = [];
  for (const idx of targets) {
    let sum = 0, count = 0, max = -Infinity, min = Infinity;
    for (const r of rows) {
      const raw = (r[idx] || '').replace(/\s/g, '').replace(/,/g, '.');
      const num = parseFloat(raw);
      if (raw !== '' && !isNaN(num) && /^-?[\d.]+$/.test(raw)) {
        sum += num; count++; if (num > max) max = num; if (num < min) min = num;
      }
    }
    if (count === 0) continue;
    const label = headers[idx] || `Colonne ${idx + 1}`;
    let val = '';
    if (intent === 'sum') val = `total = **${fmtNum(sum)}**`;
    else if (intent === 'avg') val = `moyenne = **${fmtNum(sum / count)}**`;
    else if (intent === 'max') val = `maximum = **${fmtNum(max)}**`;
    else if (intent === 'min') val = `minimum = **${fmtNum(min)}**`;
    parts.push(`${label} : ${val} (sur ${count} valeur(s))`);
  }
  return parts.length ? parts.join(' • ') : null;
}

function generateRichReportResponse(): string {
  return `# Rapport d'avancement — Portefeuille Projets DPE (Mai 2026)

## Résumé exécutif

Le portefeuille projets de la DPE présente un avancement global de **68%** avec un budget total engagé de **2 847 Mds FCFA** sur 4 200 Mds FCFA prévus. Quatre projets sont en alerte retard nécessitant une attention immédiate.

## Synthèse du portefeuille

| Indicateur | Valeur | Cible | Écart |
|------------|--------|-------|-------|
| Avancement global | 68% | 75% | **-7 pts** |
| Budget engagé | 2 847 Mds | 3 150 Mds | -303 Mds |
| Budget décaissé | 1 923 Mds | 2 100 Mds | -177 Mds |
| Projets en cours | 23 | 25 | -2 |
| Projets en retard | 4 | 0 | **+4** |
| Projets clôturés (2026) | 3 | 5 | -2 |

## État par direction

| Direction | Projets | Avancement | Budget (Mds) | Alertes |
|-----------|---------|------------|--------------|---------|
| DEP | 8 | 72% | 1 245 | 1 |
| DER | 10 | 65% | 1 102 | **2** |
| DGC | 3 | 58% | 320 | 1 |
| DIT | 5 | 74% | 180 | 0 |

## Projets en alerte

| Code | Nom | Direction | Retard | Action requise |
|------|-----|-----------|--------|----------------|
| PRJ-DER-2024-001 | Ligne HTA Thiès-Mbour | DER | +45j | Visa DG pour avenant |
| PRJ-DEP-2023-008 | Centrale thermique Kounoune | DEP | +30j | Approbation bailleur |
| PRJ-DER-2023-005 | Poste source Dakar Nord | DER | +20j | Réception matériel |
| PRJ-DGC-2024-002 | Bâtiment technique Diamniadio | DGC | +15j | Validation plans GC |

## Recommandations

1. **Convoquer un comité d'arbitrage** pour les projets DER-001 et DEP-008
2. **Accélérer les procédures de passation** pour les lots BT Sud
3. **Renforcer le suivi terrain** sur les projets DGC avec inspections hebdomadaires
4. **Préparer le budget 2027** dès maintenant avec projection des besoins

---
*Généré par SIGEPP-IA — ${new Date().toLocaleDateString('fr-FR')}*`;
}

function generateTableResponse(): string {
  return `Voici le tableau comparatif des projets par domaine et par bailleur :

## Projets par domaine et bailleur

| Programme | Bailleur | Projets | Budget total (Mds) | Avancement | Statut |
|-----------|----------|---------|---------------------|------------|--------|
| PADAES | AFD | 5 | 1 450 | 71% | En bonne voie |
| PADERAU | BEI | 3 | 890 | 62% | Retard constaté |
| PES | UE | 4 | 680 | 75% | En avance |
| BEST | SENELEC | 8 | 1 180 | 66% | Selon plan |
| Compact 2026 | MCA | 3 | 420 | 58% | Retard significatif |

## Répartition budgétaire

| Direction | PADAES | PADERAU | PES | BEST | Total |
|-----------|--------|---------|-----|------|-------|
| DEP | 890 | 0 | 355 | 0 | 1 245 |
| DER | 0 | 680 | 0 | 422 | 1 102 |
| DGC | 0 | 0 | 0 | 320 | 320 |
| DIT | 560 | 210 | 325 | 438 | 1 533 |
| **Total** | **1 450** | **890** | **680** | **1 180** | **4 200** |

Souhaitez-vous que j'approfondisse un programme en particulier ?`;
}

function generateBudgetResponse(): string {
  return `## Analyse budgétaire du portefeuille DPE

### Situation globale

| Poste | Prévision (Mds) | Réalisé (Mds) | Écart (Mds) | Taux |
|-------|-----------------|---------------|-------------|------|
| Dépenses d'investissement | 3 500 | 2 340 | -1 160 | 67% |
| Fournitures & services | 420 | 315 | -105 | 75% |
| Études & supervision | 180 | 142 | -38 | 79% |
| Gestion de projet | 100 | 78 | -22 | 78% |
| **TOTAL** | **4 200** | **2 875** | **-1 325** | **68%** |

### Analyse EVM (Earned Value Management)

| Projet | BCWS | BCWP | ACWP | CPI | SPI | EAC |
|--------|------|------|------|-----|-----|-----|
| PRJ-DEP-001 | 450 | 380 | 420 | 0.90 | 0.84 | 500 |
| PRJ-DER-003 | 320 | 290 | 275 | 1.05 | 0.91 | 305 |
| PRJ-DIT-002 | 180 | 175 | 168 | 1.04 | 0.97 | 173 |

### Conclusion

Le portefeuille affiche un **CPI global de 0.94** (sous-performance coût) et un **SPI de 0.91** (retard planning). Les actions correctrices prioritaires sont :

1. Renégociation du contrat PRJ-DEP-001 (surcoût 12%)
2. Accélération des travaux PRJ-DER-003 (retard 9%)
3. Réserve de contingence : maintenir 180 Mds FCFA (4.3% du budget)`;
}

function generateRiskResponse(): string {
  return `## Matrice des risques — Portefeuille DPE

### Risques identifiés

| # | Risque | Probabilité | Impact | Score | Stratégie |
|---|--------|-------------|--------|-------|-----------|
| 1 | Retard approbation bailleur AFD | Élevée | Majeur | **16** | Escalader + plan B |
| 2 | Hausse prix cuivre/acier | Moyenne | Majeur | **12** | Indexation contrat |
| 3 | Difficultés foncières terrain | Moyenne | Majeur | **12** | Médiation locale |
| 4 | Retard livraison matériel | Élevée | Moyen | **9** | Stock sécurité |
| 5 | Pluies saisonnières | Élevée | Mineur | **6** | Planning tampon |

### Plan d'action mitigation

| Risque | Action | Responsable | Échéance | Statut |
|--------|--------|-------------|----------|--------|
| 1 | Relance ambassade AFD | DG DPE | 15/06 | En cours |
| 2 | Renégociation clause index | RAF | 30/06 | À planifier |
| 3 | Réunion chefferie régionale | CP | 20/06 | Programmé |
| 4 | Commande anticipée | CPM | 10/06 | Validé |
| 5 | Planning hivernage | CP | 01/07 | À faire |

Souhaitez-vous que j'approfondisse un risque spécifique ?`;
}

function generatePlanningResponse(): string {
  return `## Planning consolidé — Projets critiques

### Phases des projets en cours

| Phase | Début | Fin | Avancement | Statut |
|-------|-------|-----|------------|--------|
| Études APS/APD | Q1 2024 | Q2 2024 | 100% | Terminé |
| DAO / Passation | Q2 2024 | Q4 2024 | 85% | En cours |
| Approvisionnement | Q4 2024 | Q2 2025 | 45% | En cours |
| Travaux GC | Q1 2025 | Q4 2025 | 20% | En cours |
| Travaux Électriques | Q2 2025 | Q1 2026 | 5% | Non démarré |
| Mise en service | Q4 2025 | Q2 2026 | 0% | Non démarré |
| Réception | Q1 2026 | Q2 2026 | 0% | Non démarré |

### Chemin critique

**PRJ-DER-001 → Travaux GC (Dakar) → Travaux Élec → MES → Réception**

Date de fin prévue : **15 mars 2026**
Date de fin estimée (P50) : **28 avril 2026**
**Retard potentiel : +43 jours**

### Actions pour respecter la date cible

1. **Accélérer DAO lot GC** (deadline : 15 juin)
2. **Anticiper commande transformateurs** (délai fabrication 20 semaines)
3. **Programmer réception matériel** avec 2 semaines de marge
4. **Prévoir équipes double poste** sur le lot électrique`;
}

function generateAnalysisResponse(): string {
  return `## Analyse comparative — Performance des projets par direction

### Indicateurs clés par direction

| Direction | Nombre | Budget moyen | Durée moyenne | CPI moyen | SPI moyen | Retards |
|-----------|--------|--------------|---------------|-----------|-----------|---------|
| DEP | 8 | 156 Mds | 24 mois | 0.96 | 0.93 | 1 |
| DER | 10 | 110 Mds | 18 mois | 0.92 | 0.89 | **2** |
| DGC | 3 | 107 Mds | 15 mois | 0.98 | 0.95 | 1 |
| DIT | 5 | 37 Mds | 12 mois | 1.02 | 1.01 | 0 |

### Analyse

La **DER** concentre les principaux écarts :
- CPI moyen le plus faible (0.92) : surcoût moyen de 8%
- SPI moyen le plus faible (0.89) : retard moyen de 11%
- 2 projets en alerte sur 10

La **DIT** présente la meilleure performance :
- CPI > 1 : sous-budget de 2%
- SPI > 1 : en avance de 1%
- Aucun retard déclaré

### Recommandations stratégiques

1. **Auditer les projets DER** pour identifier les causes structurelles des retards
2. **Répliquer les pratiques DIT** (méthodologie agile, revues hebdomadaires)
3. **Renforcer le staffing DER** avec 2 chefs de projet supplémentaires
4. **Mettre en place un comité de pilotage mensuel** dédié aux projets en alerte`;
}

function generateGenericRichResponse(): string {
  return `Bonjour ! Je suis SIGEPP-IA, votre assistant intelligent pour la gestion des projets et programmes DPE.

Je peux vous aider sur de nombreux sujets :

## Mes compétences

| Domaine | Capacités |
|---------|-----------|
| **Génération de rapports** | Rapports d'avancement, rapports financiers, rapports bailleurs |
| **Analyse de données** | Tableaux comparatifs, KPIs, analyses EVM, courbes S |
| **Analyse documentaire** | Lecture de contrats, DAO, PV, rapports (OCR + NLP) |
| **Planification** | Gantt suggéré, chemin critique, optimisation ressources |
| **Budget** | Analyse coûts, projections, rapprochement ERP |
| **Risques** | Matrice P×I, plans mitigation, scénarios |
| **Assistant rédaction** | Compte-rendus, notes de service, courriers |

## Exemples de demandes

- *"Génère un rapport sur le portefeuille DEP"*
- *"Analyse le risque du projet PRJ-DER-001"*
- *"Compare les budgets PADAES vs PADERAU"*
- *"Rédige un compte-rendu de réunion"*
- *"Quel est le chemin critique du projet BT Sud ?"*

N'hésitez pas à me demander un **rapport long et détaillé** avec tableaux et analyses — je peux générer des documents de plusieurs pages avec mise en forme professionnelle.`;
}

// ─── Utilitaires ──────────────────────────────────────────────────────────

function simulateDelay(ms: number): Promise<void> {
  return new Promise(r => setTimeout(r, ms));
}

function estimateTokens(text: string): number {
  // Approximation : 1 token ≈ 0.75 caractères en français
  return Math.ceil(text.length / 3.5);
}

// ─── Export types ─────────────────────────────────────────────────────────

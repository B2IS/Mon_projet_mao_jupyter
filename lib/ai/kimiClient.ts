/**
 * kimiClient.ts — Client LLM SIGEPP-DPE
 *
 * Priorité :
 *   1. Docker llama.cpp (Kimi K2.6 GGUF local) — http://localhost:8080/v1
 *   2. Kimi K2 (Moonshot AI cloud)             — clé NEXT_PUBLIC_KIMI_API_KEY ou localStorage 'sigepp_kimi_key'
 *   3. Ollama local (qwen2.5-coder:14b > deepseek-r1:7b > llama3.2)  — aucune clé requise
 *   4. Mode heuristique                        — toujours disponible en dernier recours
 */

// ── Docker llama.cpp (Kimi K2.6 GGUF local) ──────────────────────────────────
const DOCKER_LLM_BASE_URL = 'http://localhost:8080/v1';
const DOCKER_LLM_MODEL    = 'Kimi-K2.6-Q4_K_M';  // nom renvoyé par llama.cpp server

// ── Kimi K2 (Moonshot AI cloud) ───────────────────────────────────────────────
export const KIMI_MODEL   = 'kimi-k2';
const KIMI_BASE_URL       = 'https://api.moonshot.cn/v1';

// ── Ollama local ──────────────────────────────────────────────────────────────
const OLLAMA_BASE_URL     = 'http://localhost:11434/v1';
// Ordre de préférence : meilleur modèle structuré en premier
const OLLAMA_MODELS       = ['qwen2.5-coder:14b', 'deepseek-r1:7b', 'llama3.2:latest'];

export interface KimiMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export interface KimiOptions {
  temperature?: number;
  max_tokens?:  number;
  top_p?:       number;
  stream?:      false;
}

// ── Clé API ───────────────────────────────────────────────────────────────────

/** Récupère la clé Kimi : localStorage → env var */
export function getKimiKey(): string {
  if (typeof window !== 'undefined') {
    const ls = localStorage.getItem('sigepp_kimi_key');
    if (ls?.trim()) return ls.trim();
  }
  return process.env.NEXT_PUBLIC_KIMI_API_KEY ?? '';
}

export function isKimiAvailable(): boolean {
  return getKimiKey().length > 0;
}

// ── Détection Docker llama.cpp ────────────────────────────────────────────────

let dockerLLMCache: boolean | undefined = undefined; // undefined = non testé

/** Vérifie si le serveur Docker llama.cpp est disponible sur le port 8080. */
async function isDockerLLMRunning(): Promise<boolean> {
  if (dockerLLMCache !== undefined) return dockerLLMCache;
  try {
    const resp = await fetch(`${DOCKER_LLM_BASE_URL}/models`, {
      signal: AbortSignal.timeout(2000),
      headers: { Authorization: 'Bearer no-key' },
    });
    dockerLLMCache = resp.ok;
    return dockerLLMCache;
  } catch {
    dockerLLMCache = false;
    return false;
  }
}

// ── Détection Ollama ──────────────────────────────────────────────────────────

let ollamaModelCache: string | null | undefined = undefined; // undefined = non testé

/** Retourne le meilleur modèle Ollama disponible, ou null. */
async function detectOllamaModel(): Promise<string | null> {
  if (ollamaModelCache !== undefined) return ollamaModelCache;
  try {
    const resp = await fetch('http://localhost:11434/api/tags', { signal: AbortSignal.timeout(2000) });
    if (!resp.ok) { ollamaModelCache = null; return null; }
    const data = await resp.json() as { models?: { name: string }[] };
    const names = data.models?.map(m => m.name) ?? [];
    for (const preferred of OLLAMA_MODELS) {
      if (names.some(n => n.startsWith(preferred.split(':')[0]))) {
        ollamaModelCache = names.find(n => n.startsWith(preferred.split(':')[0])) ?? null;
        return ollamaModelCache;
      }
    }
    ollamaModelCache = names[0] ?? null;
    return ollamaModelCache;
  } catch {
    ollamaModelCache = null;
    return null;
  }
}

export async function isOllamaAvailable(): Promise<boolean> {
  return (await detectOllamaModel()) !== null;
}

// ── Appel générique (OpenAI-compatible) ───────────────────────────────────────

async function callOpenAICompat(
  baseUrl: string,
  apiKey: string,
  model: string,
  messages: KimiMessage[],
  options: KimiOptions,
): Promise<string | null> {
  try {
    const resp = await fetch(`${baseUrl}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type':  'application/json',
        'Authorization': `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model,
        messages,
        temperature: options.temperature ?? 0.3,
        max_tokens:  options.max_tokens  ?? 4096,
        top_p:       options.top_p       ?? 0.9,
        stream:      false,
      }),
      signal: AbortSignal.timeout(60_000),
    });
    if (!resp.ok) {
      console.warn(`[LLM] HTTP ${resp.status} from ${baseUrl}`);
      return null;
    }
    const json = await resp.json();
    return (json.choices?.[0]?.message?.content as string | undefined) ?? null;
  } catch (e) {
    console.warn(`[LLM] fetch error (${baseUrl}):`, e);
    return null;
  }
}

// ── kimiChat — point d'entrée principal ──────────────────────────────────────

/**
 * Chat LLM avec cascade :
 *   Docker llama.cpp → Kimi K2 (cloud) → Ollama local → null (mode heuristique)
 */
export async function kimiChat(
  messages: KimiMessage[],
  options: KimiOptions = {},
): Promise<string | null> {
  // 1. Docker llama.cpp local (Kimi K2.6 GGUF — priorité maximale si serveur actif)
  if (await isDockerLLMRunning()) {
    const result = await callOpenAICompat(DOCKER_LLM_BASE_URL, 'no-key', DOCKER_LLM_MODEL, messages, options);
    if (result) { console.info('[LLM] ✓ Docker llama.cpp (Kimi K2.6 GGUF local)'); return result; }
  }

  // 2. Kimi K2 cloud
  const kimiKey = getKimiKey();
  if (kimiKey) {
    const result = await callOpenAICompat(KIMI_BASE_URL, kimiKey, KIMI_MODEL, messages, options);
    if (result) { console.info('[LLM] ✓ Kimi K2 (Moonshot)'); return result; }
  }

  // 3. Ollama local
  const ollamaModel = await detectOllamaModel();
  if (ollamaModel) {
    const result = await callOpenAICompat(OLLAMA_BASE_URL, 'ollama', ollamaModel, messages, options);
    if (result) { console.info(`[LLM] ✓ Ollama (${ollamaModel})`); return result; }
  }

  // 4. Heuristique
  console.info('[LLM] mode heuristique (aucun LLM disponible)');
  return null;
}

/** Label du backend actif — pour affichage UI */
export async function getActiveLLMLabel(): Promise<string> {
  if (await isDockerLLMRunning()) return 'Kimi K2.6 GGUF · Docker';
  if (isKimiAvailable()) return 'Kimi K2 — Moonshot AI';
  const m = await detectOllamaModel();
  if (m) return `Ollama · ${m}`;
  return 'Mode heuristique';
}

/** Retourne true si le serveur Docker llama.cpp est actif */
export { isDockerLLMRunning };

// ── Extraction JSON structurée ────────────────────────────────────────────────

export async function kimiExtractJSON<T = Record<string, unknown>>(
  documentText: string,
  schema: string,
  context?: string,
): Promise<T | null> {
  const raw = await kimiChat([
    {
      role: 'system',
      content:
        'Tu es un expert en gestion de projets SENELEC (Direction Principale Équipement). ' +
        'Tu extrais des données structurées depuis des documents de projet (Excel, PDF, Word). ' +
        'Réponds UNIQUEMENT par un objet JSON valide (pas de markdown, pas de texte autour). ' +
        (context ? `Contexte : ${context}. ` : '') +
        `Schéma attendu : ${schema}`,
    },
    {
      role: 'user',
      content: `Document :\n"""\n${documentText.slice(0, 24000)}\n"""`,
    },
  ], { temperature: 0.1, max_tokens: 3000 });

  if (!raw) return null;
  try {
    const a = raw.indexOf('{'), b = raw.lastIndexOf('}');
    if (a < 0 || b <= a) return null;
    return JSON.parse(raw.slice(a, b + 1)) as T;
  } catch {
    return null;
  }
}

// ── Analyse projet (swarm migration) ─────────────────────────────────────────

export async function kimiAnalyseProjet(
  docText: string,
  nomProjet: string,
): Promise<{
  tachesIdentifiees: string[];
  risquesMajeurs:    string[];
  budgetEstime:      number;
  jalonsClés:        string[];
  recommandations:   string[];
} | null> {
  return kimiExtractJSON(
    docText,
    `{
  "tachesIdentifiees": ["string"],
  "risquesMajeurs": ["string"],
  "budgetEstime": number,
  "jalonsClés": ["string"],
  "recommandations": ["string"]
}`,
    `Projet SENELEC DPE : ${nomProjet}`,
  ) as Promise<{
    tachesIdentifiees: string[];
    risquesMajeurs:    string[];
    budgetEstime:      number;
    jalonsClés:        string[];
    recommandations:   string[];
  } | null>;
}

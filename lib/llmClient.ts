/**
 * lib/llmClient.ts — Client LLM Souverain SIGEPP-DPE
 * ──────────────────────────────────────────────────────────────────────────
 * Architecture de résilience (3 niveaux) :
 *
 *   1. OLLAMA  (local, souverain) — modèles open-source sur infrastructure Senelec
 *       → http://OLLAMA_BASE_URL/v1  (default: localhost:11434)
 *       → Aucune donnée ne quitte le réseau interne
 *
 *   2. GROQ    (cloud, fallback)  — si clé NEXT_PUBLIC_GROQ_API_KEY configurée
 *       → Llama 3.x hébergé sur infrastructure Groq (USA)
 *       → Utilisé UNIQUEMENT si Ollama non disponible
 *
 *   3. HEURISTIQUE (local, dégradé) — si aucune IA disponible
 *       → Extracteurs déterministes, réponses templates
 *
 * SÉCURITÉ : aucune clé API n'est jamais loggée ou envoyée à un tiers.
 * CONFORMITÉ : mode OLLAMA = 100% souveraineté des données.
 */

/* ─── Types publics ────────────────────────────────────────────────────────── */

export type Provider = 'ollama' | 'groq' | 'none';

export interface ChatMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export interface LLMModel {
  id: string;
  name: string;
  provider: Provider;
  contextLength?: number;
}

export interface ProviderStatus {
  provider: Provider;
  available: boolean;
  models: LLMModel[];
  latencyMs?: number;
  error?: string;
}

export interface StreamChatOpts {
  model?: string;
  temperature?: number;
  maxTokens?: number;
  onToken: (token: string) => void;
  signal?: AbortSignal;
}

export interface OnceOpts {
  model?: string;
  temperature?: number;
  maxTokens?: number;
  signal?: AbortSignal;
}

/* ─── Configuration ────────────────────────────────────────────────────────── */

/** URL Ollama (configurable via env, défaut local) */
function getOllamaBase(): string {
  if (typeof process !== 'undefined') {
    return (process.env.OLLAMA_BASE_URL ?? 'http://localhost:11434').replace(/\/+$/, '');
  }
  return 'http://localhost:11434';
}

function getGroqKey(): string {
  if (typeof window !== 'undefined') {
    const stored = localStorage.getItem('sigepp_groq_key') ?? '';
    if (stored.startsWith('gsk_')) return stored;
  }
  return (typeof process !== 'undefined' && process.env?.NEXT_PUBLIC_GROQ_API_KEY) || '';
}

const GROQ_BASE = 'https://api.groq.com/openai/v1';

/** Modèles Ollama recommandés pour SIGEPP-DPE, par priorité décroissante.
 *  Tous open-source, bons pour le français et le contexte métier. */
const OLLAMA_MODEL_PRIORITY = [
  'mistral-nemo',      // Meilleur français, contexte métier
  'mistral',           // Classique, léger, excellent en français
  'mistral:7b',
  'qwen2.5:7b',        // Très bon multilingue
  'qwen2.5',
  'llama3.1:8b',       // Équilibré
  'llama3.1',
  'llama3.2:3b',       // Ultra-léger pour machines modestes
  'llama3.2',
  'phi3.5',            // Compact, adapté aux serveurs sans GPU
  'phi3',
  'gemma2:9b',
  'gemma2',
  'deepseek-r1:7b',    // Bon raisonnement
  'deepseek-r1',
];

const GROQ_MODELS = {
  fast:  'llama-3.1-8b-instant',
  smart: 'llama-3.3-70b-versatile',
} as const;

/* ─── Cache de statut (TTL 60s) ────────────────────────────────────────────── */

let _cachedStatus: ProviderStatus | null = null;
let _cacheTs = 0;
const CACHE_TTL_MS = 60_000;

/* ─── Détection Ollama ─────────────────────────────────────────────────────── */

/** Teste la disponibilité Ollama et retourne les modèles installés. */
async function probeOllama(signal?: AbortSignal): Promise<ProviderStatus> {
  const base = getOllamaBase();
  const t0 = Date.now();
  try {
    const r = await fetch(`${base}/api/tags`, {
      signal: signal ?? AbortSignal.timeout(3000),
      headers: { 'Accept': 'application/json' },
    });
    if (!r.ok) throw new Error(`HTTP ${r.status}`);
    const data = await r.json() as { models?: { name: string; details?: { parameter_size?: string } }[] };
    const models: LLMModel[] = (data.models ?? []).map(m => ({
      id: m.name,
      name: m.name,
      provider: 'ollama',
      contextLength: 8192,
    }));
    return { provider: 'ollama', available: models.length > 0, models, latencyMs: Date.now() - t0 };
  } catch (e) {
    return { provider: 'ollama', available: false, models: [], error: String(e) };
  }
}

/** Choisit le meilleur modèle Ollama disponible selon la liste de priorité. */
function pickBestOllamaModel(models: LLMModel[]): string | null {
  const installed = new Set(models.map(m => m.id.split(':')[0]));
  for (const pref of OLLAMA_MODEL_PRIORITY) {
    const base = pref.split(':')[0];
    if (installed.has(base)) {
      const exact = models.find(m => m.id === pref) ?? models.find(m => m.id.startsWith(base));
      if (exact) return exact.id;
    }
  }
  return models[0]?.id ?? null;
}

/* ─── Provider detection ────────────────────────────────────────────────────── */

/** Détecte le provider disponible (résultat mis en cache 60s). */
export async function detectProvider(): Promise<ProviderStatus> {
  if (_cachedStatus && Date.now() - _cacheTs < CACHE_TTL_MS) return _cachedStatus;

  const status = await probeOllama();
  if (status.available) {
    _cachedStatus = status;
    _cacheTs = Date.now();
    return status;
  }

  if (getGroqKey()) {
    _cachedStatus = {
      provider: 'groq', available: true,
      models: Object.values(GROQ_MODELS).map(id => ({ id, name: id, provider: 'groq' })),
    };
    _cacheTs = Date.now();
    return _cachedStatus;
  }

  _cachedStatus = { provider: 'none', available: false, models: [] };
  _cacheTs = Date.now();
  return _cachedStatus;
}

/** Invalide le cache (ex: après changement de config). */
export function resetProviderCache(): void {
  _cachedStatus = null;
  _cacheTs = 0;
}

/* ─── Streaming chat ─────────────────────────────────────────────────────────── */

async function streamOllama(
  messages: ChatMessage[],
  model: string,
  opts: StreamChatOpts,
): Promise<string> {
  const base = getOllamaBase();
  const resp = await fetch(`${base}/v1/chat/completions`, {
    method: 'POST',
    signal: opts.signal,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model,
      messages,
      stream: true,
      temperature: opts.temperature ?? 0.4,
      max_tokens: opts.maxTokens ?? 2048,
    }),
  });
  if (!resp.ok) throw new Error(`Ollama ${resp.status}: ${await resp.text().catch(() => '')}`);
  return consumeSSE(resp, opts.onToken);
}

async function streamGroq(
  messages: ChatMessage[],
  model: string,
  opts: StreamChatOpts,
): Promise<string> {
  const key = getGroqKey();
  if (!key) throw new Error('Clé Groq non configurée.');
  const resp = await fetch(`${GROQ_BASE}/chat/completions`, {
    method: 'POST',
    signal: opts.signal,
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${key}` },
    body: JSON.stringify({
      model,
      messages,
      stream: true,
      temperature: opts.temperature ?? 0.4,
      max_tokens: opts.maxTokens ?? 2048,
    }),
  });
  if (!resp.ok) {
    if (resp.status === 401) throw new Error('Clé Groq invalide.');
    if (resp.status === 429) throw new Error('Quota Groq dépassé.');
    throw new Error(`Groq ${resp.status}`);
  }
  return consumeSSE(resp, opts.onToken);
}

async function consumeSSE(resp: Response, onToken: (t: string) => void): Promise<string> {
  const reader = resp.body!.getReader();
  const decoder = new TextDecoder();
  let buf = '';
  let full = '';
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buf += decoder.decode(value, { stream: true });
    const lines = buf.split('\n');
    buf = lines.pop() ?? '';
    for (const line of lines) {
      const t = line.trim();
      if (!t.startsWith('data: ')) continue;
      const data = t.slice(6);
      if (data === '[DONE]') return full;
      try {
        const token: string = JSON.parse(data).choices?.[0]?.delta?.content ?? '';
        if (token) { full += token; onToken(token); }
      } catch { /* skip malformed */ }
    }
  }
  return full;
}

/** Streaming principal — Ollama-first, fallback Groq. */
export async function streamChat(
  messages: ChatMessage[],
  opts: StreamChatOpts,
): Promise<string> {
  const status = await detectProvider();

  if (status.provider === 'ollama' && status.available) {
    const model = opts.model ?? pickBestOllamaModel(status.models) ?? OLLAMA_MODEL_PRIORITY[0];
    try {
      return await streamOllama(messages, model, opts);
    } catch (e) {
      // Si Ollama tombe en cours de session, fallback Groq
      const groqKey = getGroqKey();
      if (!groqKey) throw e;
      resetProviderCache();
      return await streamGroq(messages, GROQ_MODELS.smart, opts);
    }
  }

  if (status.provider === 'groq') {
    const model = opts.model ?? GROQ_MODELS.smart;
    return await streamGroq(messages, model, opts);
  }

  throw new Error(
    'Aucun moteur IA disponible. ' +
    'Démarrez Ollama (ollama serve) pour le mode souverain, ' +
    'ou configurez NEXT_PUBLIC_GROQ_API_KEY pour le mode cloud.'
  );
}

/* ─── One-shot (non-streaming) ────────────────────────────────────────────────── */

async function onceOllama(messages: ChatMessage[], model: string, opts: OnceOpts): Promise<string> {
  const base = getOllamaBase();
  const resp = await fetch(`${base}/v1/chat/completions`, {
    method: 'POST',
    signal: opts.signal ?? AbortSignal.timeout(60_000),
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model,
      messages,
      stream: false,
      temperature: opts.temperature ?? 0.35,
      max_tokens: opts.maxTokens ?? 1024,
    }),
  });
  if (!resp.ok) throw new Error(`Ollama ${resp.status}`);
  const data = await resp.json();
  return data.choices?.[0]?.message?.content ?? '';
}

async function onceGroq(messages: ChatMessage[], model: string, opts: OnceOpts): Promise<string> {
  const key = getGroqKey();
  if (!key) throw new Error('Clé Groq non configurée.');
  const resp = await fetch(`${GROQ_BASE}/chat/completions`, {
    method: 'POST',
    signal: opts.signal,
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${key}` },
    body: JSON.stringify({ model, messages, temperature: opts.temperature ?? 0.35, max_tokens: opts.maxTokens ?? 1024 }),
  });
  if (!resp.ok) throw new Error(`Groq ${resp.status}`);
  const data = await resp.json();
  return data.choices?.[0]?.message?.content ?? '';
}

/** Appel simple non-streaming — utile pour les agents en parallèle. */
export async function chatOnce(
  messages: ChatMessage[],
  opts: OnceOpts = {},
): Promise<string> {
  const status = await detectProvider();

  if (status.provider === 'ollama' && status.available) {
    const model = opts.model ?? pickBestOllamaModel(status.models) ?? OLLAMA_MODEL_PRIORITY[0];
    try {
      return await onceOllama(messages, model, opts);
    } catch {
      if (getGroqKey()) { resetProviderCache(); return onceGroq(messages, GROQ_MODELS.smart, opts); }
      throw new Error('Ollama non disponible.');
    }
  }

  if (status.provider === 'groq') {
    return onceGroq(messages, opts.model ?? GROQ_MODELS.smart, opts);
  }

  throw new Error('Aucun moteur IA configuré.');
}

/* ─── Liste des modèles ────────────────────────────────────────────────────────── */

export async function listModels(): Promise<LLMModel[]> {
  const status = await detectProvider();
  return status.models;
}

/* ─── Compatibilité groqChat.ts ────────────────────────────────────────────────── */

/** @deprecated Utiliser llmClient.detectProvider() */
export function getKey(): string { return getGroqKey(); }

/** Label lisible du provider actif (pour affichage UI). */
export function providerLabel(p: Provider): string {
  if (p === 'ollama') return '🟢 Ollama — Souverain (local)';
  if (p === 'groq')   return '🟡 Groq — Cloud (Llama 3)';
  return '⚪ Heuristique locale';
}

/** Couleur badge provider. */
export function providerColor(p: Provider): string {
  if (p === 'ollama') return '#16A34A';
  if (p === 'groq')   return '#D97706';
  return '#64748B';
}

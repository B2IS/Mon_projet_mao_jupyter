/**
 * groqChat.ts — Client Groq streaming pour SIGEPP-DPE
 * Utilisé par Copilot.tsx et AgentsIA.tsx
 */

const GROQ_BASE = 'https://api.groq.com/openai/v1';

export const GROQ_MODELS = {
  fast:    'llama-3.1-8b-instant',
  smart:   'llama-3.3-70b-versatile',
  mix:     'llama-3.1-8b-instant',
} as const;
export type GroqModelKey = keyof typeof GROQ_MODELS;

export interface ChatMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

/** Lecture de la clé depuis le localStorage d'abord, puis env var. */
export function getKey(): string {
  if (typeof window !== 'undefined') {
    const stored = localStorage.getItem('sigepp_groq_key') ?? '';
    if (stored.startsWith('gsk_')) return stored;
  }
  return (typeof process !== 'undefined' && process.env?.NEXT_PUBLIC_GROQ_API_KEY) || '';
}

/** Streaming SSE — appelle onToken pour chaque delta reçu. Retourne le texte complet. */
export async function streamChat(
  messages: ChatMessage[],
  opts: {
    model?: string;
    temperature?: number;
    maxTokens?: number;
    onToken: (token: string) => void;
    signal?: AbortSignal;
  },
): Promise<string> {
  const key = getKey();
  if (!key) throw new Error('Clé Groq non configurée. Ajoutez NEXT_PUBLIC_GROQ_API_KEY dans .env.local');

  const model = opts.model ?? GROQ_MODELS.smart;
  const resp = await fetch(`${GROQ_BASE}/chat/completions`, {
    method: 'POST',
    signal: opts.signal,
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${key}`,
    },
    body: JSON.stringify({
      model,
      messages,
      stream: true,
      temperature: opts.temperature ?? 0.4,
      max_tokens: opts.maxTokens ?? 2048,
    }),
  });

  if (!resp.ok) {
    const err = await resp.text().catch(() => resp.statusText);
    if (resp.status === 401) throw new Error('Clé Groq invalide ou expirée.');
    if (resp.status === 429) throw new Error('Quota Groq dépassé — réessayez dans quelques secondes.');
    throw new Error(`Groq ${resp.status}: ${err}`);
  }

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
      const trimmed = line.trim();
      if (!trimmed.startsWith('data: ')) continue;
      const data = trimmed.slice(6);
      if (data === '[DONE]') return full;
      try {
        const chunk = JSON.parse(data);
        const token: string = chunk.choices?.[0]?.delta?.content ?? '';
        if (token) { full += token; opts.onToken(token); }
      } catch { /* ignore malformed chunks */ }
    }
  }
  return full;
}

/** Appel simple non-streaming — utile pour les agents en parallèle. */
export async function chatOnce(
  messages: ChatMessage[],
  opts: { model?: string; temperature?: number; maxTokens?: number; signal?: AbortSignal } = {},
): Promise<string> {
  const key = getKey();
  if (!key) throw new Error('Clé Groq non configurée.');

  const model = opts.model ?? GROQ_MODELS.smart;
  const resp = await fetch(`${GROQ_BASE}/chat/completions`, {
    method: 'POST',
    signal: opts.signal,
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${key}` },
    body: JSON.stringify({
      model,
      messages,
      temperature: opts.temperature ?? 0.35,
      max_tokens: opts.maxTokens ?? 1024,
    }),
  });
  if (!resp.ok) throw new Error(`Groq ${resp.status}`);
  const data = await resp.json();
  return data.choices?.[0]?.message?.content ?? '';
}

/** Vérifie que la clé est valide (appel léger sur /models). */
export async function testKey(key?: string): Promise<boolean> {
  const k = key ?? getKey();
  if (!k) return false;
  try {
    const r = await fetch(`${GROQ_BASE}/models`, {
      headers: { Authorization: `Bearer ${k}` },
    });
    return r.ok;
  } catch { return false; }
}

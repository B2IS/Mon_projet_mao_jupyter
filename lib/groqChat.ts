/**
 * groqChat.ts — Compatibilité ascendante
 * Toutes les fonctions sont désormais implémentées dans llmClient.ts
 * qui gère Ollama (souverain) en priorité, puis Groq (fallback cloud).
 *
 * Ce fichier existe pour éviter de casser les imports existants.
 */
export {
  streamChat,
  chatOnce,
  detectProvider,
  listModels,
  resetProviderCache,
  providerLabel,
  providerColor,
  getKey,
  type ChatMessage,
  type Provider,
  type LLMModel,
  type ProviderStatus,
} from '@/lib/llmClient';

export const GROQ_MODELS = {
  fast:  'llama-3.1-8b-instant',
  smart: 'llama-3.3-70b-versatile',
  mix:   'llama-3.1-8b-instant',
} as const;

export type GroqModelKey = keyof typeof GROQ_MODELS;

/** @deprecated Utiliser llmClient.detectProvider() — Groq n'est plus le fournisseur principal */
export async function testKey(key?: string): Promise<boolean> {
  const { detectProvider: detect } = await import('@/lib/llmClient');
  const status = await detect();
  return status.available;
}

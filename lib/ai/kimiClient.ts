/**
 * kimiClient.ts — Client Kimi K2 (Moonshot AI) pour le swarm SIGEPP-DPE
 *
 * Kimi K2 est un modèle open-source (1T MoE) de Moonshot AI, compatible API OpenAI.
 * Utilisé comme backbone LLM des agents de migration et structuration.
 *
 * Clé API : variable d'env NEXT_PUBLIC_KIMI_API_KEY
 * ou override localStorage 'kimi_api_key' (même pattern que Groq)
 */

export const KIMI_MODEL   = 'kimi-k2';
const KIMI_BASE_URL = 'https://api.moonshot.cn/v1';

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

/** Récupère la clé API : localStorage (override dev) → env var */
export function getKimiKey(): string {
  if (typeof window !== 'undefined') {
    const ls = localStorage.getItem('kimi_api_key');
    if (ls?.trim()) return ls.trim();
  }
  return process.env.NEXT_PUBLIC_KIMI_API_KEY ?? '';
}

export function isKimiAvailable(): boolean {
  return getKimiKey().length > 0;
}

/**
 * Appel principal : chat completion Kimi K2.
 * Retourne le texte de la réponse ou null si indisponible / erreur.
 */
export async function kimiChat(
  messages: KimiMessage[],
  options: KimiOptions = {},
): Promise<string | null> {
  const key = getKimiKey();
  if (!key) return null;

  try {
    const resp = await fetch(`${KIMI_BASE_URL}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type':  'application/json',
        'Authorization': `Bearer ${key}`,
      },
      body: JSON.stringify({
        model:       KIMI_MODEL,
        messages,
        temperature: options.temperature ?? 0.3,
        max_tokens:  options.max_tokens  ?? 4096,
        top_p:       options.top_p       ?? 0.9,
        stream:      false,
      }),
    });

    if (!resp.ok) {
      const err = await resp.text().catch(() => resp.statusText);
      console.error(`[KimiK2] HTTP ${resp.status}: ${err}`);
      return null;
    }

    const json = await resp.json();
    return (json.choices?.[0]?.message?.content as string | undefined) ?? null;
  } catch (e) {
    console.error('[KimiK2] fetch error:', e);
    return null;
  }
}

/**
 * Extraction structurée JSON depuis un texte de document.
 * Retourne null si Kimi indisponible — l'appelant repasse en mode heuristique.
 */
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

/**
 * Analyse d'un projet pour le swarm migration — retourne un résumé structuré.
 */
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

/**
 * documentAnalyzer.ts — Oracle PPM Expert Analysis Engine
 *
 * Analyse les documents de projet avec un LLM expert Oracle PPM / PM consultant.
 * Chaque agent appelle analyzeDocuments() avec son prompt spécialisé et son schéma JSON.
 *
 * Cascade LLM :
 *   1. Docker Kimi K2.6 GGUF local
 *   2. Kimi K2 cloud (Moonshot)
 *   3. Groq Llama-3.3-70B (vision disponible via Llama-4-Scout)
 *   4. Ollama local
 *   5. Heuristique (retourne null)
 *
 * Pour images/PDF scannés → Groq Llama-4-Scout (vision) ou Moonshot vision.
 */

import { kimiChat, kimiExtractJSON, getKimiKey, isKimiAvailable } from './kimiClient';
import type { SwarmInputFile } from './types';

const GROQ_BASE    = 'https://api.groq.com/openai/v1';
const VISION_MODEL = 'meta-llama/llama-4-scout-17b-16e-instruct'; // vision capable
const TEXT_MODEL   = 'llama-3.3-70b-versatile';
const MOONSHOT_VISION_BASE  = 'https://api.moonshot.cn/v1';
const MOONSHOT_VISION_MODEL = 'moonshot-v1-32k'; // Moonshot vision model

// ── Groq key helper ───────────────────────────────────────────────────────────

function getGroqKey(): string {
  if (typeof window !== 'undefined') {
    const s = localStorage.getItem('sigepp_groq_key');
    if (s?.startsWith('gsk_')) return s;
  }
  return typeof process !== 'undefined'
    ? (process.env.NEXT_PUBLIC_GROQ_API_KEY ?? '')
    : '';
}

// ── Appel Groq OpenAI-compat ──────────────────────────────────────────────────

async function groqChat(
  messages: Array<{ role: string; content: unknown }>,
  model = TEXT_MODEL,
): Promise<string | null> {
  const key = getGroqKey();
  if (!key) return null;
  try {
    const resp = await fetch(`${GROQ_BASE}/chat/completions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${key}` },
      body: JSON.stringify({ model, messages, temperature: 0.1, max_tokens: 4096, stream: false }),
      signal: AbortSignal.timeout(90_000),
    });
    if (!resp.ok) return null;
    const json = await resp.json();
    return (json.choices?.[0]?.message?.content as string | undefined) ?? null;
  } catch { return null; }
}

// ── Appel vision (images / PDF scannés) ──────────────────────────────────────

async function visionChat(
  systemPrompt: string,
  userText: string,
  imageDataUrls: string[],
): Promise<string | null> {
  // Essaie Groq Llama-4-Scout (vision)
  const groqKey = getGroqKey();
  if (groqKey && imageDataUrls.length > 0) {
    const content: Array<{ type: string; text?: string; image_url?: { url: string } }> = [
      { type: 'text', text: userText },
      ...imageDataUrls.slice(0, 4).map(url => ({   // max 4 images
        type: 'image_url',
        image_url: { url },
      })),
    ];
    const result = await groqChat([
      { role: 'system', content: systemPrompt },
      { role: 'user',   content },
    ], VISION_MODEL);
    if (result) return result;
  }

  // Fallback Moonshot vision
  const kimiKey = getKimiKey();
  if (kimiKey && imageDataUrls.length > 0) {
    const content: Array<{ type: string; text?: string; image_url?: { url: string } }> = [
      { type: 'text', text: userText },
      ...imageDataUrls.slice(0, 4).map(url => ({
        type: 'image_url',
        image_url: { url },
      })),
    ];
    try {
      const resp = await fetch(`${MOONSHOT_VISION_BASE}/chat/completions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${kimiKey}` },
        body: JSON.stringify({
          model: MOONSHOT_VISION_MODEL,
          messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user',   content },
          ],
          temperature: 0.1, max_tokens: 4096, stream: false,
        }),
        signal: AbortSignal.timeout(90_000),
      });
      if (resp.ok) {
        const json = await resp.json();
        const text = json.choices?.[0]?.message?.content as string | undefined;
        if (text) return text;
      }
    } catch { /* fallthrough */ }
  }

  return null;
}

// ── Extrait JSON depuis une réponse LLM ───────────────────────────────────────

function extractJSON<T>(raw: string): T | null {
  try {
    const a = raw.indexOf('{'), b = raw.lastIndexOf('}');
    if (a < 0 || b <= a) return null;
    return JSON.parse(raw.slice(a, b + 1)) as T;
  } catch { return null; }
}

// ── Collecte le contenu textuel de tous les fichiers ─────────────────────────

function buildDocumentContext(
  files: SwarmInputFile[],
  maxChars = 40_000,
): { text: string; images: string[] } {
  const parts: string[] = [];
  const images: string[] = [];
  let totalChars = 0;

  for (const f of files) {
    if (f.isImage && f.dataUrl) {
      images.push(f.dataUrl);
      continue;
    }
    if (f.textContent) {
      const chunk = f.textContent.slice(0, Math.min(f.textContent.length, maxChars - totalChars));
      parts.push(chunk);
      totalChars += chunk.length;
      if (totalChars >= maxChars) break;
    }
  }

  return { text: parts.join('\n\n---\n\n'), images };
}

// ── Prompt système Oracle PPM expert ─────────────────────────────────────────

export const ORACLE_PPM_SYSTEM = `Tu es un expert Oracle PPM (Project Portfolio Management) et consultant senior en gestion de projets d'infrastructure électrique en Afrique de l'Ouest, spécialisé SENELEC / DPE.

Tu analyses des documents de projet (études, contrats, PV, rapports, tableurs, plans, images scannées) et tu extrais des données structurées au format Oracle PPM.

Domaine de compétence :
- Projets d'électrification rurale, réseaux HTA/BT/HTB, postes sources, lignes 225 kV
- Programmes bailleurs : PASER, BEST, PADAES, PSES, PAMACEL, PADERAU
- Passation marchés OHADA : DAO, CCAP, CCTP, décomptes PAUE2
- Gestion de projet Oracle Projects / PPM : WBS, baseline, EVM, ICP, RAG
- Finance projet : budget MFCFA, avance 20%/10%, retenue 5%, TVA 18%
- PGES, PAR, HSE chantier selon normes BM/BAD/AFD
- Codes imputation BIT/CPF Oracle EBS SENELEC

Règles d'extraction :
1. Extrais TOUJOURS toutes les données disponibles dans les documents — ne laisse rien derrière.
2. Si une valeur n'est pas explicitement dans le document, utilise ton expertise pour l'estimer (marque [estimé]).
3. Pour les images scannées, lis TOUT le texte visible et extrais les données structurées.
4. Réponds UNIQUEMENT par un objet JSON valide (pas de markdown, pas d'explication).
5. Les montants sont en FCFA sauf indication contraire.`;

// ── Fonction principale ───────────────────────────────────────────────────────

/**
 * Analyse les documents avec le LLM et retourne un objet JSON structuré.
 *
 * @param files  - Fichiers SwarmInputFile avec textContent et/ou dataUrl
 * @param domain - Domaine d'extraction (ex: 'planification', 'finances', 'risques')
 * @param prompt - Prompt utilisateur spécifique au domaine
 * @param schema - Schéma JSON attendu (description textuelle)
 * @param ctx    - Contexte projet (nom, budget, etc.)
 */
export async function analyzeDocuments<T>(
  files: SwarmInputFile[],
  domain: string,
  prompt: string,
  schema: string,
  ctx?: string,
): Promise<T | null> {
  const { text: docText, images } = buildDocumentContext(files);

  // Aucun contenu exploitable
  if (!docText && images.length === 0) return null;

  const systemPrompt = `${ORACLE_PPM_SYSTEM}\n\nDomaine actuel : ${domain}${ctx ? `\nContexte projet : ${ctx}` : ''}`;

  const userMsg = `${prompt}

Schéma JSON attendu :
\`\`\`json
${schema}
\`\`\`

${docText ? `Documents textuels :\n"""\n${docText}\n"""` : '(Aucun texte extrait — analyser les images ci-jointes)'}`;

  let raw: string | null = null;

  // Si images → vision en priorité
  if (images.length > 0) {
    raw = await visionChat(systemPrompt, userMsg, images);
    if (!raw) {
      // Fallback texte si disponible
      if (docText) {
        raw = await kimiChat([
          { role: 'system', content: systemPrompt },
          { role: 'user',   content: userMsg },
        ], { temperature: 0.1, max_tokens: 4096 });
      }
    }
  } else {
    // Texte uniquement → cascade Kimi → Groq → Ollama
    raw = await kimiChat([
      { role: 'system', content: systemPrompt },
      { role: 'user',   content: userMsg },
    ], { temperature: 0.1, max_tokens: 4096 });

    if (!raw) {
      // Fallback Groq
      raw = await groqChat([
        { role: 'system', content: systemPrompt },
        { role: 'user',   content: userMsg },
      ]);
    }
  }

  if (!raw) return null;
  return extractJSON<T>(raw);
}

/**
 * Version légère pour extraction rapide d'un seul champ depuis les documents.
 */
export async function extractField<T = string>(
  files: SwarmInputFile[],
  question: string,
): Promise<T | null> {
  const { text } = buildDocumentContext(files, 8000);
  if (!text) return null;

  const raw = await kimiChat([
    { role: 'system', content: ORACLE_PPM_SYSTEM },
    { role: 'user',   content: `Question : ${question}\n\nDocument :\n"""\n${text}\n"""\n\nRéponds uniquement en JSON : {"valeur": ...}` },
  ], { temperature: 0.1, max_tokens: 512 });

  if (!raw) return null;
  const obj = extractJSON<{ valeur: T }>(raw);
  return obj?.valeur ?? null;
}

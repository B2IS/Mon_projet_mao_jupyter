/**
 * /api/ai/copilot — Proxy Microsoft Copilot / Azure OpenAI (Chat Completions).
 *
 * Le client envoie les messages + la configuration du compte lié (endpoint,
 * déploiement, clé). La clé ne transite que vers Azure (jamais journalisée).
 * Compatible Azure OpenAI ET OpenAI-compatible (api.openai.com) selon l'endpoint.
 */

import { NextRequest, NextResponse } from 'next/server';
import { requireApiAuth, checkRateLimit, rateLimitResponse, getClientIp } from '@/lib/apiAuth';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// ── Rate limit : 30 req / 10 min par IP (proxy IA coûteux) ──────────────────
const RL_COPILOT = { max: 30, windowMs: 10 * 60 * 1000 };

interface ChatMsg { role: 'system' | 'user' | 'assistant'; content: string }

/** Réponses heuristiques locales quand aucune clé IA n'est configurée. */
function heuristicResponse(messages: ChatMsg[]): string {
  const last = messages.filter(m => m.role === 'user').pop()?.content?.toLowerCase() ?? '';

  if (/avancement|taux|progress/.test(last))
    return "Pour consulter le taux d'avancement d'un projet, rendez-vous dans **Cockpit Projet** → onglet KPIs. Le pourcentage d'avancement physique est calculé à partir des livrables validés.";
  if (/risque|risk/.test(last))
    return "La matrice des risques est accessible dans le module **Risques**. Les risques sont classés par probabilité × impact. Les risques critiques (rouge) déclenchent une alerte automatique au Chef de Projet.";
  if (/budget|finance|dépense|fcfa/.test(last))
    return "Le suivi budgétaire est disponible dans **Finance & Budget**. Vous pouvez consulter les engagements, décaissements et le reste à dépenser par axe WBS.";
  if (/livrable|deliverable|matrice/.test(last))
    return "La matrice des livrables est accessible dans **Gestion Projet** → Livrables. Chaque livrable peut être marqué Validé / En cours / Non démarré avec une date de validation.";
  if (/planning|gantt|délai|retard/.test(last))
    return "Le planning Gantt est disponible dans **Planning / Schedule**. Les jalons en retard sont signalés en rouge. Vous pouvez ajuster les dates directement sur le diagramme.";
  if (/document|ged|fichier/.test(last))
    return "La GED (Gestion Électronique des Documents) centralise tous les documents projets : ANOs, rapports, plans, contrats. Utilisez les filtres par projet, direction ou type de document.";
  if (/utilisateur|profil|accès|rôle/.test(last))
    return "La gestion des accès est dans **Administration** → Profils. Chaque profil DPE dispose d'une visibilité sur les modules correspondant à sa fonction (Chef de Projet, Ingénieur, RAF, etc.).";
  if (/marché|contrat|appel d'offre/.test(last))
    return "Le module **Marchés & Contrats** permet de suivre les marchés par projet : AOI/AON, attributions, avenants et situations de travaux.";
  if (/terrain|géoloc|pointage/.test(last))
    return "Le suivi terrain utilise la géolocalisation GPS. Depuis l'app mobile, le système détecte automatiquement si vous êtes dans un géofence projet et impute le temps en conséquence.";
  if (/kimi|groq|ia|copilot|assistant/.test(last))
    return "Le copilote IA SIGEP nécessite une clé API configurée (Kimi ou Groq). Accédez à **Paramètres** → Sécurité pour renseigner votre clé personnelle. Les clés ne sont jamais partagées.";

  return `Je suis en mode **heuristique local** — aucune clé API IA n'est configurée.\n\nPour activer le copilote IA complet :\n1. Allez dans **Paramètres** → Sécurité\n2. Renseignez votre clé Kimi ou Groq\n3. Les réponses seront alors générées par un modèle IA complet\n\nEn attendant, je peux répondre à des questions simples sur les modules SIGEP.`;
}

/** Domaines autorisés pour l'endpoint Azure/OpenAI (prévention SSRF). */
const ALLOWED_ENDPOINT_HOSTS = ['.openai.azure.com', 'api.openai.com'];
function isEndpointAllowed(url: string): boolean {
  if (!url) return false;
  try {
    const { hostname } = new URL(url);
    return ALLOWED_ENDPOINT_HOSTS.some(h => hostname === h.replace(/^\./, '') || hostname.endsWith(h));
  } catch { return false; }
}

export async function POST(req: NextRequest) {
  // Rate limit avant auth (évite les attaques par énumération)
  const ip = getClientIp(req);
  const rl = checkRateLimit(`copilot:${ip}`, RL_COPILOT);
  if (!rl.allowed) return rateLimitResponse(rl.resetAt);

  const guard = await requireApiAuth(req);
  if (!guard.ok) return guard.response;

  // Limite taille body (4 Ko max pour les messages)
  const contentLength = Number(req.headers.get('content-length') ?? 0);
  if (contentLength > 32 * 1024) {
    return NextResponse.json({ error: 'Corps de requête trop volumineux (max 32 Ko).' }, { status: 413 });
  }

  let body: {
    messages?: ChatMsg[];
    endpoint?: string;
    deployment?: string;
    apiKey?: string;
    apiVersion?: string;
    temperature?: number;
    maxTokens?: number;
  };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Requête invalide' }, { status: 400 });
  }

  // Priorité aux variables d'environnement serveur (déploiement entreprise),
  // sinon configuration fournie par le client (compte lié dans l'UI).
  const rawEndpoint = process.env.AZURE_OPENAI_ENDPOINT || body.endpoint || '';
  // Sécurité SSRF : valider l'endpoint contre l'allowlist
  if (rawEndpoint && !process.env.AZURE_OPENAI_ENDPOINT && !isEndpointAllowed(rawEndpoint)) {
    return NextResponse.json({ error: 'Endpoint non autorisé.' }, { status: 400 });
  }
  const endpoint = rawEndpoint.replace(/\/+$/, '');
  const deployment =  process.env.AZURE_OPENAI_DEPLOYMENT || body.deployment || 'gpt-4o';
  const apiKey     =  process.env.AZURE_OPENAI_KEY        || body.apiKey     || '';
  const apiVersion =  process.env.AZURE_OPENAI_API_VERSION|| body.apiVersion || '2024-08-01-preview';
  const messages   =  Array.isArray(body.messages) ? body.messages : [];

  if (!endpoint || !apiKey) {
    return NextResponse.json({
      content: heuristicResponse(messages),
      model: 'heuristic-local',
      usage: null,
      fallback: true,
    });
  }
  if (!messages.length) {
    return NextResponse.json({ error: 'Aucun message fourni.' }, { status: 400 });
  }

  // Construit l'URL : Azure OpenAI (.../openai/deployments/<dep>/chat/completions)
  // ou OpenAI-compatible (.../v1/chat/completions).
  const isAzure = /\.openai\.azure\.com/i.test(endpoint) || /azure/i.test(endpoint);
  const url = isAzure
    ? `${endpoint}/openai/deployments/${encodeURIComponent(deployment)}/chat/completions?api-version=${encodeURIComponent(apiVersion)}`
    : `${endpoint}/v1/chat/completions`;

  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (isAzure) headers['api-key'] = apiKey;
  else headers['Authorization'] = `Bearer ${apiKey}`;

  const payload: Record<string, unknown> = {
    messages,
    temperature: typeof body.temperature === 'number' ? body.temperature : 0.5,
    max_tokens: typeof body.maxTokens === 'number' ? body.maxTokens : 2048,
  };
  if (!isAzure) payload.model = deployment;

  try {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 45000);
    const res = await fetch(url, {
      method: 'POST',
      headers,
      body: JSON.stringify(payload),
      signal: ctrl.signal,
    });
    clearTimeout(timer);

    if (!res.ok) {
      const txt = await res.text().catch(() => '');
      return NextResponse.json(
        { error: `Copilot a renvoyé ${res.status}`, detail: txt.slice(0, 400) },
        { status: 502 },
      );
    }
    const data = await res.json();
    const content: string =
      data?.choices?.[0]?.message?.content ??
      data?.choices?.[0]?.text ??
      '';
    if (!content) {
      return NextResponse.json({ error: 'Réponse Copilot vide.' }, { status: 502 });
    }
    return NextResponse.json({
      content,
      model: data?.model ?? deployment,
      usage: data?.usage ?? null,
    });
  } catch (e) {
    const msg = e instanceof Error && e.name === 'AbortError' ? 'Délai dépassé' : 'Connexion Copilot impossible';
    return NextResponse.json({ error: msg }, { status: 504 });
  }
}

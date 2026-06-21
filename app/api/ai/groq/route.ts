/**
 * /api/ai/groq — Proxy serveur Groq (clé jamais exposée au client).
 *
 * Priorité des clés :
 *   1. GROQ_API_KEY (env serveur, non-public) — déploiement mutualisé
 *   2. clientKey dans le body — clé personnelle saisie par l'utilisateur dans l'UI
 */
import { NextRequest, NextResponse } from 'next/server';
import { requireApiAuth, checkRateLimit, rateLimitResponse, getClientIp } from '@/lib/apiAuth';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const GROQ_BASE = 'https://api.groq.com/openai/v1';

// ── Rate limit : 20 req / 5 min par IP ──────────────────────────────────────
const RL_GROQ = { max: 20, windowMs: 5 * 60 * 1000 };
const GROQ_TIMEOUT_MS = 30_000;

/** GET /api/ai/groq — indique si le provider Groq est disponible (authentification requise) */
export async function GET(req: NextRequest) {
  const guard = await requireApiAuth(req);
  if (!guard.ok) return guard.response;
  const hasEnvKey = !!(process.env.GROQ_API_KEY);
  return NextResponse.json({ available: hasEnvKey });
}

/** POST /api/ai/groq — proxy vers Groq Chat Completions */
export async function POST(req: NextRequest) {
  const ip = getClientIp(req);
  const rl = checkRateLimit(`groq:${ip}`, RL_GROQ);
  if (!rl.allowed) return rateLimitResponse(rl.resetAt);

  const guard = await requireApiAuth(req);
  if (!guard.ok) return guard.response;

  const contentLength = Number(req.headers.get('content-length') ?? 0);
  if (contentLength > 16 * 1024) {
    return NextResponse.json({ error: 'Corps de requête trop volumineux (max 16 Ko).' }, { status: 413 });
  }

  let body: {
    messages?: { role: string; content: string }[];
    model?: string;
    stream?: boolean;
    temperature?: number;
    max_tokens?: number;
    clientKey?: string;
  };

  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Requête invalide.' }, { status: 400 });
  }

  // clientKey personnel autorisé uniquement si clé serveur absente — jamais comme bypass d'auth
  const clientKey = body.clientKey?.startsWith('gsk_') ? body.clientKey : null;
  const apiKey = process.env.GROQ_API_KEY || clientKey;

  if (!apiKey) {
    return NextResponse.json({ error: 'Groq non configuré.' }, { status: 503 });
  }

  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), GROQ_TIMEOUT_MS);

  let upstream: Response;
  try {
    upstream = await fetch(`${GROQ_BASE}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: body.model ?? 'llama-3.1-8b-instant',
        messages: body.messages ?? [],
        stream: body.stream ?? false,
        temperature: body.temperature ?? 0.4,
        max_tokens: body.max_tokens ?? 2048,
      }),
      signal: ctrl.signal,
    });
  } catch (e) {
    clearTimeout(timer);
    const msg = e instanceof Error && e.name === 'AbortError' ? 'Délai dépassé (30s)' : 'Connexion Groq impossible';
    return NextResponse.json({ error: msg }, { status: 504 });
  } finally {
    clearTimeout(timer);
  }

  if (!upstream.ok) {
    const text = await upstream.text().catch(() => '');
    const status = upstream.status === 401 ? 401 : upstream.status === 429 ? 429 : 502;
    return NextResponse.json({ error: text || `Groq ${upstream.status}` }, { status });
  }

  if (body.stream) {
    return new NextResponse(upstream.body, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache, no-transform',
        'X-Accel-Buffering': 'no',
      },
    });
  }

  const data = await upstream.json();
  return NextResponse.json(data);
}

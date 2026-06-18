/**
 * /api/ai/groq — Proxy serveur Groq (clé jamais exposée au client).
 *
 * Priorité des clés :
 *   1. GROQ_API_KEY (env serveur, non-public) — déploiement mutualisé
 *   2. clientKey dans le body — clé personnelle saisie par l'utilisateur dans l'UI
 */
import { NextRequest, NextResponse } from 'next/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const GROQ_BASE = 'https://api.groq.com/openai/v1';

/** GET /api/ai/groq — indique si le provider Groq est disponible */
export async function GET() {
  const hasEnvKey = !!(process.env.GROQ_API_KEY);
  return NextResponse.json({ available: hasEnvKey });
}

/** POST /api/ai/groq — proxy vers Groq Chat Completions */
export async function POST(req: NextRequest) {
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

  const apiKey =
    process.env.GROQ_API_KEY ||
    (body.clientKey?.startsWith('gsk_') ? body.clientKey : null);

  if (!apiKey) {
    return NextResponse.json({ error: 'Groq non configuré.' }, { status: 503 });
  }

  const upstream = await fetch(`${GROQ_BASE}/chat/completions`, {
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
  });

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

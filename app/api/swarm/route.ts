/**
 * app/api/swarm/route.ts — SSE streaming endpoint pour le pipeline swarm
 *
 * POST /api/swarm
 * Body: SwarmRequest (JSON)
 * Response: text/event-stream (SSE)
 *
 * Chaque événement SSE est encodé :
 *   data: {"type":"agent_done","agentId":"planificateur", ...}\n\n
 */

import { NextRequest } from 'next/server';
import { runSwarm }       from '@/lib/ai/swarmOrchestrator';
import type { SwarmRequest, SSEEvent } from '@/lib/ai/types';
import { requireApiAuth, checkRateLimit, rateLimitResponse, getClientIp } from '@/lib/apiAuth';

// ── Rate limit swarm : 5 req / 10 min par IP (pipeline lourd) ────────────────
const RL_SWARM = { max: 5, windowMs: 10 * 60 * 1000 };

export const runtime = 'nodejs';     // streams require node runtime
export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest): Promise<Response> {
  const ip = getClientIp(req);
  const rl = checkRateLimit(`swarm:${ip}`, RL_SWARM);
  if (!rl.allowed) return new Response(JSON.stringify({ error: `Trop de requêtes. Réessayez dans ${Math.ceil((rl.resetAt - Date.now()) / 1000)}s.` }), { status: 429, headers: { 'Content-Type': 'application/json', 'Retry-After': String(Math.ceil((rl.resetAt - Date.now()) / 1000)) } });

  // Auth guard — swarm réservé aux rôles métier avec accès portefeuille
  const guard = await requireApiAuth(req, [
    'ADMIN', 'DIR_DPE', 'DIRECTEUR', 'CHEF_CELLULE', 'COORDINATEUR',
    'EXPERT_PMO', 'EXPERT_SE', 'CHEF_PROJ', 'CHEF_DEPT',
    'RAF', 'AUDIT', 'CONSEILLER',
  ]);
  if (!guard.ok) return guard.response;

  // Limite taille body (fichiers inclus, max 10 Mo)
  const contentLength = Number(req.headers.get('content-length') ?? 0);
  if (contentLength > 10 * 1024 * 1024) {
    return new Response(JSON.stringify({ error: 'Corps trop volumineux (max 10 Mo).' }), {
      status: 413, headers: { 'Content-Type': 'application/json' },
    });
  }

  let body: SwarmRequest;
  try {
    body = await req.json();
  } catch {
    return new Response(JSON.stringify({ error: 'JSON invalide.' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const { files, projectOverrides } = body;

  // Create a ReadableStream that emits SSE data
  const stream = new ReadableStream({
    async start(controller) {
      const encoder = new TextEncoder();

      function sendEvent(event: SSEEvent): void {
        const data = `data: ${JSON.stringify(event)}\n\n`;
        try {
          controller.enqueue(encoder.encode(data));
        } catch {
          // controller already closed — ignore
        }
      }

      // Keep-alive heartbeat every 15s
      const heartbeat = setInterval(() => {
        try {
          controller.enqueue(encoder.encode(': heartbeat\n\n'));
        } catch {
          clearInterval(heartbeat);
        }
      }, 15_000);

      try {
        // runSwarm already emits swarm_done via the onEvent callback — no duplicate needed
        await runSwarm(files, projectOverrides, sendEvent);
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : String(err);
        sendEvent({
          type: 'error',
          message: `Erreur pipeline : ${message}`,
          timestamp: new Date().toISOString(),
        });
      } finally {
        clearInterval(heartbeat);
        try { controller.close(); } catch { /* already closed */ }
      }
    },
  });

  return new Response(stream, {
    status: 200,
    headers: {
      'Content-Type':  'text/event-stream',
      'Cache-Control': 'no-cache, no-transform',
      'Connection':    'keep-alive',
      'X-Accel-Buffering': 'no',   // disable nginx buffering
    },
  });
}

/** GET /api/swarm — health check (authentification requise) */
export async function GET(req: NextRequest): Promise<Response> {
  const guard = await requireApiAuth(req);
  if (!guard.ok) return guard.response;
  return new Response(JSON.stringify({ status: 'ok', service: 'swarm-orchestrator' }), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  });
}

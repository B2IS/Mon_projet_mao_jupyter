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
import { runSwarm }    from '@/lib/ai/swarmOrchestrator';
import type { SwarmRequest, SSEEvent } from '@/lib/ai/types';

export const runtime = 'nodejs';     // streams require node runtime
export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest): Promise<Response> {
  let body: SwarmRequest;
  try {
    body = await req.json();
  } catch {
    return new Response(JSON.stringify({ error: 'Invalid JSON body' }), {
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
        const ctx = await runSwarm(files, projectOverrides, sendEvent);

        // Final event with complete context
        sendEvent({
          type: 'swarm_done',
          message: `Pipeline terminé — runId: ${ctx.runId}`,
          data: ctx,
          timestamp: new Date().toISOString(),
        });
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

/** Simple GET probe for health-check */
export async function GET(): Promise<Response> {
  return new Response(JSON.stringify({ status: 'ok', service: 'swarm-orchestrator' }), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  });
}

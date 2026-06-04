/**
 * /api/ai/copilot — Proxy Microsoft Copilot / Azure OpenAI (Chat Completions).
 *
 * Le client envoie les messages + la configuration du compte lié (endpoint,
 * déploiement, clé). La clé ne transite que vers Azure (jamais journalisée).
 * Compatible Azure OpenAI ET OpenAI-compatible (api.openai.com) selon l'endpoint.
 */

import { NextRequest, NextResponse } from 'next/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

interface ChatMsg { role: 'system' | 'user' | 'assistant'; content: string }

export async function POST(req: NextRequest) {
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
  const endpoint   = (process.env.AZURE_OPENAI_ENDPOINT   || body.endpoint   || '').replace(/\/+$/, '');
  const deployment =  process.env.AZURE_OPENAI_DEPLOYMENT || body.deployment || 'gpt-4o';
  const apiKey     =  process.env.AZURE_OPENAI_KEY        || body.apiKey     || '';
  const apiVersion =  process.env.AZURE_OPENAI_API_VERSION|| body.apiVersion || '2024-08-01-preview';
  const messages   =  Array.isArray(body.messages) ? body.messages : [];

  if (!endpoint || !apiKey) {
    return NextResponse.json(
      { error: 'Compte Microsoft Copilot non configuré (endpoint ou clé manquant).' },
      { status: 422 },
    );
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

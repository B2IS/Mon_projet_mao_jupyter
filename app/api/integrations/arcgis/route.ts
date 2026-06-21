/**
 * /api/integrations/arcgis — Proxy ArcGIS Enterprise / Online
 * Sécurisé : les credentials ESRI ne quittent jamais le serveur.
 */

import { NextRequest, NextResponse } from 'next/server';
import {
  listReseauLayers,
  queryReseauLayer,
  getOuvragesProjet,
  getPostesDirection,
  getOuvragesDansEmprise,
  ajouterOuvrageSIG,
  mettreAJourEtatOuvrage,
  calculerLongueur,
} from '@/lib/integrations/arcgis';
import { requireApiAuth, checkRateLimit, rateLimitResponse, getClientIp } from '@/lib/apiAuth';

const RL_ARCGIS = { max: 60, windowMs: 60 * 1000 };

// Basic WHERE clause sanitization — bloc les injections triviales
function sanitizeWhere(where: string): string {
  // Autoriser: caractères alphanumériques, espaces, opérateurs SQL courants, parenthèses, quotes simples
  if (/;\s*(drop|delete|truncate|insert|update|alter|create|exec)\b/i.test(where)) {
    return '1=0'; // requête bloquée → retourne rien
  }
  return where;
}

export async function GET(req: NextRequest) {
  const ip = getClientIp(req);
  const rl = checkRateLimit(`arcgis:${ip}`, RL_ARCGIS);
  if (!rl.allowed) return rateLimitResponse(rl.resetAt);

  const guard = await requireApiAuth(req);
  if (!guard.ok) return guard.response;
  const { searchParams } = new URL(req.url);
  const action = searchParams.get('action');

  try {
    switch (action) {
      case 'layers': {
        const res = await listReseauLayers();
        return NextResponse.json(res);
      }

      case 'query': {
        const layerId = parseInt(searchParams.get('layer_id') || '0', 10);
        const where = sanitizeWhere(searchParams.get('where') || '1=1');
        const outFields = (searchParams.get('outFields') || '*').split(',');
        const returnGeometry = searchParams.get('returnGeometry') !== 'false';
        const resultRecordCount = parseInt(searchParams.get('resultRecordCount') || '1000', 10);
        const res = await queryReseauLayer(layerId, {
          where,
          outFields,
          returnGeometry,
          resultRecordCount,
        });
        return NextResponse.json(res);
      }

      case 'ouvrages_projet': {
        const projetId = searchParams.get('projet_id')!;
        const res = await getOuvragesProjet(projetId);
        return NextResponse.json(res);
      }

      case 'postes_direction': {
        const direction = searchParams.get('direction')!;
        const res = await getPostesDirection(direction);
        return NextResponse.json(res);
      }

      case 'ouvrages_emprise': {
        const xmin = parseFloat(searchParams.get('xmin')!);
        const ymin = parseFloat(searchParams.get('ymin')!);
        const xmax = parseFloat(searchParams.get('xmax')!);
        const ymax = parseFloat(searchParams.get('ymax')!);
        const layerId = parseInt(searchParams.get('layer_id') || '0', 10);
        const res = await getOuvragesDansEmprise({ xmin, ymin, xmax, ymax }, layerId);
        return NextResponse.json(res);
      }

      default:
        return NextResponse.json({ success: false, error: 'Action inconnue' }, { status: 400 });
    }
  } catch (e: any) {
    return NextResponse.json(
      { success: false, error: e.message, source: 'ARCGIS' },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  const ip = getClientIp(req);
  const rl = checkRateLimit(`arcgis:${ip}`, RL_ARCGIS);
  if (!rl.allowed) return rateLimitResponse(rl.resetAt);

  const guard = await requireApiAuth(req);
  if (!guard.ok) return guard.response;

  const contentLength = Number(req.headers.get('content-length') ?? 0);
  if (contentLength > 256 * 1024) {
    return NextResponse.json({ error: 'Corps de requête trop volumineux (max 256 Ko).' }, { status: 413 });
  }

  let body: Record<string, unknown>;
  try { body = await req.json(); } catch {
    return NextResponse.json({ error: 'JSON invalide.' }, { status: 400 });
  }
  const { action } = body as { action?: string };

  try {
    switch (action) {
      case 'ajouter_ouvrage': {
        const { layerId, feature } = body as { layerId: number; feature: Parameters<typeof ajouterOuvrageSIG>[1] };
        const res = await ajouterOuvrageSIG(layerId, feature);
        return NextResponse.json(res);
      }

      case 'update_etat': {
        const { layerId, objectId, attributs } = body as { layerId: number; objectId: number; attributs: Parameters<typeof mettreAJourEtatOuvrage>[2] };
        const res = await mettreAJourEtatOuvrage(layerId, objectId, attributs);
        return NextResponse.json(res);
      }

      case 'calculer_longueur': {
        const { geometry } = body as { geometry: Parameters<typeof calculerLongueur>[0] };
        const res = await calculerLongueur(geometry);
        return NextResponse.json(res);
      }

      default:
        return NextResponse.json({ success: false, error: 'Action inconnue' }, { status: 400 });
    }
  } catch (e: any) {
    return NextResponse.json(
      { success: false, error: e.message, source: 'ARCGIS' },
      { status: 500 }
    );
  }
}

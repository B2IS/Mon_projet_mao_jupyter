/**
 * /api/integrations/oracle — Proxy Oracle EBS R12
 * Sécurisé : les credentials Oracle ne quittent jamais le serveur.
 * Le client appelle cette route interne qui relaie vers Oracle ORDS.
 */

import { NextRequest, NextResponse } from 'next/server';
import {
  getFacturesProjet,
  getFacturesDirection,
  getPaiementsFacture,
  getImmobilisations,
  getImmobilisationDetail,
  getAmortissements,
  getEcrituresGL,
  creerImmobilisationOracle,
  getFacturesEnAttenteValidation,
} from '@/lib/integrations/oracleEBS';
import { requireApiAuth, checkRateLimit, rateLimitResponse, getClientIp } from '@/lib/apiAuth';

const RL_ORACLE = { max: 60, windowMs: 60 * 1000 };

export async function GET(req: NextRequest) {
  const ip = getClientIp(req);
  const rl = checkRateLimit(`oracle:${ip}`, RL_ORACLE);
  if (!rl.allowed) return rateLimitResponse(rl.resetAt);

  const guard = await requireApiAuth(req);
  if (!guard.ok) return guard.response;

  const { searchParams } = new URL(req.url);
  const action = searchParams.get('action');

  try {
    switch (action) {
      case 'factures_projet': {
        const projetId = searchParams.get('projet_id')!;
        const debut = searchParams.get('debut')!;
        const fin = searchParams.get('fin')!;
        const res = await getFacturesProjet(projetId, debut, fin);
        return NextResponse.json(res);
      }

      case 'factures_direction': {
        const direction = searchParams.get('direction')!;
        const periode = searchParams.get('periode')!;
        const res = await getFacturesDirection(direction, periode);
        return NextResponse.json(res);
      }

      case 'factures_en_attente': {
        const direction = searchParams.get('direction')!;
        const res = await getFacturesEnAttenteValidation(direction);
        return NextResponse.json(res);
      }

      case 'paiements': {
        const invoiceId = searchParams.get('invoice_id')!;
        const res = await getPaiementsFacture(invoiceId);
        return NextResponse.json(res);
      }

      case 'immobilisations': {
        const direction = searchParams.get('direction') || undefined;
        const projetId = searchParams.get('projet_id') || undefined;
        const categorie = searchParams.get('categorie') || undefined;
        const statut = (searchParams.get('statut') as any) || undefined;
        const res = await getImmobilisations({ directionCode: direction, projetId, categorie, statut });
        return NextResponse.json(res);
      }

      case 'immobilisation_detail': {
        const assetId = searchParams.get('asset_id')!;
        const res = await getImmobilisationDetail(assetId);
        return NextResponse.json(res);
      }

      case 'amortissements': {
        const assetId = searchParams.get('asset_id')!;
        const periodeDebut = searchParams.get('periode_debut') || undefined;
        const periodeFin = searchParams.get('periode_fin') || undefined;
        const res = await getAmortissements(assetId, periodeDebut, periodeFin);
        return NextResponse.json(res);
      }

      case 'ecritures_gl': {
        const periode = searchParams.get('periode')!;
        const projetId = searchParams.get('projet_id') || undefined;
        const direction = searchParams.get('direction') || undefined;
        const compte = searchParams.get('compte') || undefined;
        const source = searchParams.get('source') || undefined;
        const res = await getEcrituresGL({ periode, projetId, directionCode: direction, compte, source });
        return NextResponse.json(res);
      }

      default:
        return NextResponse.json({ success: false, error: 'Action inconnue' }, { status: 400 });
    }
  } catch (e: any) {
    return NextResponse.json(
      { success: false, error: e.message, source: 'ORACLE_R12' },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  const ip = getClientIp(req);
  const rl = checkRateLimit(`oracle:${ip}`, RL_ORACLE);
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
      case 'creer_immobilisation': {
        const res = await creerImmobilisationOracle((body as { payload: Parameters<typeof creerImmobilisationOracle>[0] }).payload);
        return NextResponse.json(res);
      }

      default:
        return NextResponse.json({ success: false, error: 'Action inconnue' }, { status: 400 });
    }
  } catch (e: any) {
    return NextResponse.json(
      { success: false, error: e.message, source: 'ORACLE_R12' },
      { status: 500 }
    );
  }
}

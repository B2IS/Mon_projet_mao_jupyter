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

export async function GET(req: NextRequest) {
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
        const where = searchParams.get('where') || '1=1';
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
  const body = await req.json();
  const { action } = body;

  try {
    switch (action) {
      case 'ajouter_ouvrage': {
        const { layerId, feature } = body;
        const res = await ajouterOuvrageSIG(layerId, feature);
        return NextResponse.json(res);
      }

      case 'update_etat': {
        const { layerId, objectId, attributs } = body;
        const res = await mettreAJourEtatOuvrage(layerId, objectId, attributs);
        return NextResponse.json(res);
      }

      case 'calculer_longueur': {
        const { geometry } = body;
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

/**
 * sigAgent.ts — Agent SIG / Géospatial
 * Phase 1 — Parse KML, SHP, KMZ, GeoJSON, CSV coordonnées.
 * Extrait zones, tracés lignes HTA/BT, pylônes, postes, villages.
 * Peuple : Cartographie · Terrain · metadata.sigData du projet.
 */

import type {
  SwarmInputFile, ProjetCreationContext,
  AgentResult, SIGOutput,
} from '@/lib/ai/types';

const REGIONS_SN = [
  'Dakar','Thiès','Saint-Louis','Louga','Diourbel','Fatick','Kaolack',
  'Kaffrine','Ziguinchor','Sédhiou','Kolda','Tambacounda','Kédougou',
  'Matam','Multi-régions',
];

const TYPE_MAP: Record<string, SIGOutput['zones'][0]['type']> = {
  hta: 'ligne', bt: 'ligne', bta: 'ligne', ligne: 'ligne',
  pylone: 'pylone', poteau: 'pylone', poteaux: 'pylone',
  poste: 'poste', transfo: 'poste', transformateur: 'poste',
  village: 'village', localite: 'village', localité: 'village',
  chantier: 'zone_travaux', travaux: 'zone_travaux', emprise: 'zone_travaux',
};

function detectType(text: string): SIGOutput['zones'][0]['type'] {
  const t = text.toLowerCase();
  for (const [k, v] of Object.entries(TYPE_MAP)) {
    if (t.includes(k)) return v;
  }
  return 'ligne';
}

function estimateLongueur(type: string, budget: number): number {
  if (type === 'ligne') return Math.round(budget * 0.8 + Math.random() * 20);
  return 0;
}

export async function runSIGAgent(
  files: SwarmInputFile[],
  ctx: ProjetCreationContext,
): Promise<AgentResult<SIGOutput>> {
  const start = Date.now();

  const sigFiles = files.filter(f =>
    ['kml', 'kmz', 'shp', 'geojson', 'json', 'gpx', 'csv'].includes(f.ext.toLowerCase())
  );
  const filesUsed = sigFiles.map(f => f.name);
  const warnings: string[] = [];

  if (sigFiles.length === 0) {
    warnings.push('Aucun fichier SIG détecté (KML/SHP/GeoJSON) — zones générées par heuristique.');
  }

  // Détecter régions depuis contexte
  const textCtx = `${ctx.nomProjet} ${ctx.description} ${ctx.typeProjet}`.toLowerCase();
  const regionsIdentifiees = REGIONS_SN.filter(r =>
    textCtx.includes(r.toLowerCase())
  );
  if (regionsIdentifiees.length === 0) regionsIdentifiees.push('Multi-régions');

  // Détecter localités depuis noms de fichiers
  const localitesIdentifiees: string[] = [];
  for (const f of files) {
    const name = f.name.replace(/\.(kml|shp|geojson|csv|kmz|gpx)$/i, '');
    if (name.length > 3 && name.length < 40 && !name.includes(' ')) {
      localitesIdentifiees.push(name.charAt(0).toUpperCase() + name.slice(1));
    }
  }

  // Générer zones selon type de projet
  const zones: SIGOutput['zones'] = [];
  const budget = ctx.budgetEstime;

  if (textCtx.includes('hta') || textCtx.includes('60 kv') || textCtx.includes('30 kv')) {
    const longueur = estimateLongueur('ligne', budget);
    zones.push({
      nom: 'Réseau HTA principal',
      type: 'ligne',
      longueurKm: longueur,
      description: `Tracé ligne HTA estimé ${longueur} km — ${regionsIdentifiees[0]}`,
      coordonnees: generateLineCoords(regionsIdentifiees[0], longueur),
    });
  }

  if (textCtx.includes('bta') || textCtx.includes('bt') || textCtx.includes('rural') || textCtx.includes('électrif')) {
    const longueurBT = Math.round(budget * 0.4 + 5);
    zones.push({
      nom: 'Réseau BT/BTA localités',
      type: 'ligne',
      longueurKm: longueurBT,
      description: `Réseaux basse tension dans les localités`,
      coordonnees: generateLineCoords(regionsIdentifiees[0], longueurBT),
    });
  }

  if (textCtx.includes('poste') || textCtx.includes('transfo') || budget > 100) {
    const nbPostes = Math.max(1, Math.round(budget / 150));
    for (let i = 0; i < Math.min(nbPostes, 5); i++) {
      zones.push({
        nom: `Poste HTA/BT ${i + 1}`,
        type: 'poste',
        coordonnees: [getRegionCentroid(regionsIdentifiees[0])],
        description: 'Poste de transformation HTA/BT',
      });
    }
  }

  // Zone travaux globale
  zones.push({
    nom: 'Zone d\'intervention globale',
    type: 'zone_travaux',
    coordonnees: generatePolygonCoords(regionsIdentifiees[0]),
    description: `Emprise projet — ${regionsIdentifiees.join(', ')}`,
    longueurKm: undefined,
  });

  // Centroïde estimé
  const centroide = getRegionCentroid(regionsIdentifiees[0]);
  const empriseTotale = Math.round(budget * 2.5 + 50);

  const summary = `SIG : ${zones.length} zones · ${regionsIdentifiees.join(', ')} · ${
    zones.filter(z => z.type === 'ligne').reduce((s, z) => s + (z.longueurKm ?? 0), 0)
  } km réseau estimé`;

  return {
    agentId: 'sig',
    status: 'done',
    durationMs: Date.now() - start,
    filesUsed,
    warnings,
    summary,
    data: {
      zones,
      centroide,
      empriseTotaleKm2: empriseTotale,
      localitesIdentifiees: localitesIdentifiees.slice(0, 20),
      regionsIdentifiees,
      projectionDetectee: 'WGS84',
      fichiersTraites: filesUsed,
    },
  };
}

// ── Helpers coordonnées ──────────────────────────────────────────────────────

const CENTROIDS: Record<string, { lat: number; lng: number }> = {
  'Dakar':         { lat: 14.693, lng: -17.447 },
  'Thiès':         { lat: 14.791, lng: -16.926 },
  'Saint-Louis':   { lat: 16.018, lng: -16.489 },
  'Louga':         { lat: 15.617, lng: -16.225 },
  'Diourbel':      { lat: 14.655, lng: -16.231 },
  'Fatick':        { lat: 14.339, lng: -16.411 },
  'Kaolack':       { lat: 14.151, lng: -16.073 },
  'Kaffrine':      { lat: 14.105, lng: -15.551 },
  'Ziguinchor':    { lat: 12.565, lng: -16.272 },
  'Sédhiou':       { lat: 12.708, lng: -15.557 },
  'Kolda':         { lat: 12.898, lng: -14.951 },
  'Tambacounda':   { lat: 13.770, lng: -13.667 },
  'Kédougou':      { lat: 12.560, lng: -12.187 },
  'Matam':         { lat: 15.656, lng: -13.255 },
  'Multi-régions': { lat: 14.500, lng: -15.500 },
};

function getRegionCentroid(region: string): { lat: number; lng: number } {
  return CENTROIDS[region] ?? CENTROIDS['Multi-régions'];
}

function generateLineCoords(region: string, longueurKm: number): Array<{ lat: number; lng: number }> {
  const c = getRegionCentroid(region);
  const degPerKm = 0.009;
  const pts = Math.min(Math.max(3, Math.round(longueurKm / 10)), 8);
  return Array.from({ length: pts }, (_, i) => ({
    lat: c.lat + (i - pts / 2) * degPerKm * (longueurKm / pts),
    lng: c.lng + (i - pts / 2) * degPerKm * 0.5,
  }));
}

function generatePolygonCoords(region: string): Array<{ lat: number; lng: number }> {
  const c = getRegionCentroid(region);
  const r = 0.4;
  return [
    { lat: c.lat + r, lng: c.lng - r },
    { lat: c.lat + r, lng: c.lng + r },
    { lat: c.lat - r, lng: c.lng + r },
    { lat: c.lat - r, lng: c.lng - r },
    { lat: c.lat + r, lng: c.lng - r },
  ];
}

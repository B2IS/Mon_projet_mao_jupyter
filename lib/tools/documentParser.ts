/**
 * lib/tools/documentParser.ts — Wrapper TypeScript pour le service Python multi-formats
 *
 * Appelle l'API FastAPI (agent-tools/main.py) sur http://localhost:8090
 * pour parser : PDF, Excel, Word, DXF/DWG, KML/KMZ, SHP, SCD/CID, XER/MPP/XML, ZIP
 *
 * Usage côté agent :
 *   const result = await parseDocumentFile(file);
 *   // result.type === 'dxf' | 'kml' | 'xer' | ...
 */

export const PARSER_BASE_URL = 'http://localhost:8090';

export type ParsedDocumentType =
  | 'pdf' | 'excel' | 'csv' | 'word'
  | 'dxf' | 'dwg'
  | 'kml' | 'shapefile'
  | 'scd_iec61850'
  | 'primavera_xer' | 'msproject_xml' | 'mpp'
  | 'zip';

export interface ParsedDocument {
  type: ParsedDocumentType;
  filename?: string;
  size_bytes?: number;
  error?: string;
  // PDF
  pages?: number;
  text_extract?: string;
  metadata?: Record<string, string>;
  // Excel/CSV
  sheets?: string[];
  data?: Record<string, unknown[]>;
  columns?: string[];
  rows?: number;
  sample?: Record<string, unknown>[];
  // Word
  tables?: string[][][];
  // DXF
  domaines_detectes?: string[];
  couches?: { nom: string; couleur: number }[];
  textes_extraits?: string[];
  blocs_inseres?: string[];
  nb_entites?: number;
  // KML
  nb_elements?: number;
  elements?: { nom: string; description: string; nb_coords: number }[];
  // Shapefile
  type_geometrie?: string;
  champs?: string[];
  echantillon?: Record<string, unknown>[];
  // SCD/IEC 61850
  nb_ied?: number;
  ieds?: { nom: string; fabricant: string; type: string }[];
  niveaux_tension?: string[];
  // XER Primavera
  tables_trouvees?: string[];
  nb_taches?: number;
  nb_jalons?: number;
  nb_ressources?: number;
  taches_echantillon?: Record<string, unknown>[];
  jalons?: Record<string, unknown>[];
  // ZIP
  nb_fichiers?: number;
  contenu?: { chemin: string; extension: string; taille: number }[];
  // Générique
  resume?: string;
  info?: string;
}

let parserAvailableCache: boolean | undefined;

/** Vérifie si le service Python est actif. */
export async function isParserAvailable(): Promise<boolean> {
  if (parserAvailableCache !== undefined) return parserAvailableCache;
  try {
    const r = await fetch(`${PARSER_BASE_URL}/health`, { signal: AbortSignal.timeout(2000) });
    parserAvailableCache = r.ok;
    return parserAvailableCache;
  } catch {
    parserAvailableCache = false;
    return false;
  }
}

/** Invalide le cache (utile après démarrage du service). */
export function resetParserCache() {
  parserAvailableCache = undefined;
}

/**
 * Parse un fichier via le service Python.
 * Retourne null si le service est indisponible.
 */
export async function parseDocumentFile(file: File): Promise<ParsedDocument | null> {
  if (!(await isParserAvailable())) return null;
  try {
    const form = new FormData();
    form.append('file', file, file.name);
    const resp = await fetch(`${PARSER_BASE_URL}/parse`, {
      method: 'POST',
      body: form,
      signal: AbortSignal.timeout(30_000),
    });
    if (!resp.ok) return null;
    return (await resp.json()) as ParsedDocument;
  } catch {
    return null;
  }
}

/**
 * Convertit un ParsedDocument en texte lisible par un LLM.
 * Utilisé pour enrichir le contexte des agents.
 */
export function parsedDocToText(doc: ParsedDocument): string {
  if (!doc || doc.error) return `[Erreur parsing: ${doc?.error ?? 'inconnu'}]`;

  const lines: string[] = [`=== ${doc.filename ?? 'Document'} (${doc.type}) ===`];

  switch (doc.type) {
    case 'pdf':
      lines.push(`Pages: ${doc.pages}`, `Extrait:\n${doc.text_extract?.slice(0, 3000)}`);
      break;
    case 'excel':
      lines.push(`Feuilles: ${doc.sheets?.join(', ')}`);
      for (const [sheet, rows] of Object.entries(doc.data ?? {})) {
        lines.push(`\nFeuille "${sheet}" (${(rows as unknown[]).length} lignes):`);
        lines.push(JSON.stringify((rows as unknown[]).slice(0, 5), null, 2));
      }
      break;
    case 'word':
      lines.push(`Texte:\n${doc.text_extract?.slice(0, 3000)}`);
      break;
    case 'dxf':
      lines.push(`Domaines détectés: ${doc.domaines_detectes?.join(', ')}`);
      lines.push(`Couches: ${doc.couches?.map(c => c.nom).join(', ')}`);
      lines.push(`Textes: ${doc.textes_extraits?.slice(0, 20).join(' | ')}`);
      lines.push(`Blocs: ${doc.blocs_inseres?.slice(0, 10).join(', ')}`);
      break;
    case 'kml':
      lines.push(doc.resume ?? '');
      lines.push(`Éléments: ${doc.elements?.slice(0, 5).map(e => e.nom).join(', ')}`);
      break;
    case 'shapefile':
      lines.push(`Type: ${doc.type_geometrie}, Entités: ${doc.nb_entites}`);
      lines.push(`Champs: ${doc.champs?.join(', ')}`);
      lines.push(`Échantillon: ${JSON.stringify(doc.echantillon?.slice(0, 3), null, 2)}`);
      break;
    case 'scd_iec61850':
      lines.push(doc.resume ?? '');
      lines.push(`IED: ${doc.ieds?.map(i => i.nom).join(', ')}`);
      lines.push(`Niveaux tension: ${doc.niveaux_tension?.join(', ')}`);
      break;
    case 'primavera_xer':
      lines.push(`${doc.nb_taches} tâches, ${doc.nb_jalons} jalons, ${doc.nb_ressources} ressources`);
      lines.push(`Jalons: ${JSON.stringify(doc.jalons?.slice(0, 5), null, 2)}`);
      break;
    case 'msproject_xml':
      lines.push(`${doc.nb_taches} tâches`);
      lines.push(`Jalons: ${doc.jalons?.map((j: Record<string, unknown>) => j['nom']).join(', ')}`);
      break;
    case 'zip':
      lines.push(doc.resume ?? '');
      break;
    default:
      lines.push(doc.info ?? JSON.stringify(doc).slice(0, 500));
  }

  return lines.join('\n');
}

/** Détecte le domaine métier d'un document parsé (électrique, géospatial, SCADA…). */
export function detectDomain(doc: ParsedDocument): string {
  if (doc.type === 'dxf') {
    return doc.domaines_detectes?.join(', ') || 'Plan CAO';
  }
  if (doc.type === 'kml' || doc.type === 'shapefile') {
    return 'Géospatial / Tracé ligne';
  }
  if (doc.type === 'scd_iec61850') {
    return `SCADA CEI 61850 (${doc.nb_ied} IED)`;
  }
  if (doc.type === 'primavera_xer') {
    return `Planning Primavera (${doc.nb_taches} tâches)`;
  }
  if (doc.type === 'msproject_xml') {
    return `Planning MS Project (${doc.nb_taches} tâches)`;
  }
  return doc.type.toUpperCase();
}

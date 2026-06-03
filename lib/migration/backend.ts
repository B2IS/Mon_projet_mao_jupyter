/**
 * backend.ts — Client du Swarm de Migration IA (backend LangGraph)
 * ----------------------------------------------------------------
 * Appelle le backend FastAPI (`/api/v1/migration/*`) qui exécute le swarm
 * multi-agents (document intelligence / planificateur / QA / comptable
 * immobilisations DAIC…). Si le backend est INDISPONIBLE, l'appelant retombe
 * proprement sur le moteur heuristique local (`engine.ts`).
 */

import type { ExtractedData } from './types';

const BASE = (process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:8000').replace(/\/$/, '');
const API = `${BASE}/api/v1/migration`;

export interface SwarmImmobilisation {
  code: string; designation: string; categorie: string;
  valeur_acquisition: number; valeur_residuelle: number;
  date_mise_en_service: string; duree_amortissement: number;
  methode: string; localisation: string; statut: string;
  source_document?: string; justification?: string;
}

export interface SwarmAnalyzeResult {
  status: string;
  project: Record<string, any>;
  risks: { description: string; severity: string; mitigation?: string }[];
  immobilisations: SwarmImmobilisation[];
  qa: { confidence: number; findings: { field: string; level: string; message: string }[] };
  documents: { name: string; doc_type: string; pages: number; ocr_used: boolean; chars: number; preview: string; error: string }[];
  history: string[];
  notes: string[];
  engine: Record<string, any>;
  state: Record<string, any>; // état complet pour le /finalize (human-in-the-loop)
}

/** Vérifie la disponibilité du backend swarm (capabilities). */
export async function swarmAvailable(timeoutMs = 2500): Promise<boolean> {
  try {
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), timeoutMs);
    const r = await fetch(`${API}/capabilities`, { signal: ctrl.signal });
    clearTimeout(t);
    return r.ok;
  } catch {
    return false;
  }
}

/** Lance le swarm sur les fichiers réels (multipart) → résultat structuré. */
export async function swarmAnalyze(files: File[]): Promise<SwarmAnalyzeResult> {
  const fd = new FormData();
  for (const f of files) fd.append('files', f, f.name);
  const r = await fetch(`${API}/analyze`, { method: 'POST', body: fd });
  if (!r.ok) throw new Error(`Swarm analyze HTTP ${r.status}`);
  return r.json();
}

/** Finalise (applique les corrections du chef de projet). */
export async function swarmFinalize(state: Record<string, any>, overrides: Record<string, any>): Promise<{
  status: string; project: Record<string, any>; immobilisations: SwarmImmobilisation[]; risks: any[];
}> {
  const r = await fetch(`${API}/finalize`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ state, overrides }),
  });
  if (!r.ok) throw new Error(`Swarm finalize HTTP ${r.status}`);
  return r.json();
}

/** Extraction de texte PROPRE d'un document via le backend (PDF/OCR…). */
export async function extractTextViaBackend(file: File): Promise<{ text: string; ocr_used: boolean; pages: number; doc_type: string }> {
  const fd = new FormData();
  fd.append('file', file, file.name);
  const r = await fetch(`${API}/extract-text`, { method: 'POST', body: fd });
  if (!r.ok) throw new Error(`extract-text HTTP ${r.status}`);
  return r.json();
}

/** Mappe le projet du swarm vers le type `ExtractedData` du frontend. */
export function swarmProjectToExtracted(res: SwarmAnalyzeResult): ExtractedData {
  const p = res.project || {};
  return {
    projectName: p.name,
    projectCode: p.code,
    projectType: p.domaine,
    budget: typeof p.budget === 'number' ? p.budget : Number(p.budget) || 0,
    currency: p.devise || 'FCFA',
    startDate: p.date_debut,
    endDate: p.date_fin_prevue,
    contractor: p.bailleur,
    location: p.localisation || p.region,
    wbsItems: (p.wbs || []).map((w: any) => ({ code: w.code, label: w.label, budget: w.budget || 0 })),
    risks: (res.risks || []).map(r => ({ description: r.description, severity: r.severity })),
    milestones: (p.jalons || []).map((m: any) => ({ name: m.name, date: m.date })),
    deliverables: p.livrables || [],
  };
}

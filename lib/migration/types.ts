/**
 * types.ts — Types pour la migration intelligente de projets
 */

export interface MigrationDocument {
  id: string;
  name: string;
  type: 'contract' | 'dao' | 'boq' | 'report' | 'pv' | 'plan' | 'photo' | 'excel' | 'pdf' | 'word' | 'other';
  size: number;
  url: string;
  uploadedAt: string;
  extractedText?: string;
  status: 'uploaded' | 'analyzing' | 'analyzed' | 'error';
}

export interface ExtractedData {
  projectName?: string;
  /**
   * Code BIT — identifiant unique SENELEC/DPE pour le projet.
   * Clé primaire de réconciliation. Patterns : BEST-SN-001, EIUL-LOT3,
   * EXP-IRAF-XXX, TBEA-LOT1, DPE-XXXX, BESTSN-CRM-…
   * Toujours prioritaire sur projectCode pour l'identification.
   */
  codeBIT?: string;
  projectCode?: string;
  projectType?: string;
  budget?: number;
  currency?: string;
  startDate?: string;
  endDate?: string;
  contractor?: string;
  supplier?: string;
  location?: string;
  wbsItems?: { code: string; label: string; budget: number }[];
  risks?: { description: string; severity: string }[];
  milestones?: { name: string; date: string }[];
  deliverables?: string[];
  /** Lots détectés dans le(s) document(s) — chaque lot peut devenir un sous-projet. */
  lots?: { numero: string; label: string; budget?: number; localisation?: string }[];
}

export interface MigrationProject {
  id: string;
  name: string;
  extractedData: ExtractedData;
  documents: MigrationDocument[];
  status: 'draft' | 'analyzed' | 'validated' | 'generated';
  confidence: number; // 0-100
  createdAt: string;
  updatedAt: string;
}

export type MigrationStep = 'upload' | 'analyze' | 'build' | 'validate' | 'finalize';

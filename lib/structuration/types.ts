/**
 * Structuration d'actifs SENELEC — modèle issu du « Modèle Type structuration des
 * projets ». Décompose un projet en arbre :
 *   COMPOSANT (classification actif projet)
 *     └─ SOUS-COMPOSANT (Actif Livrable, code hiérarchique)
 *          └─ ARTICLE du bordereau (unité, qté, PU, Fourniture/Transport/Montage)
 * Chaque niveau porte les attributs d'immobilisation (Source Budget, BIT, Bailleur,
 * Bénéficiaire, Processus…). C'est ce qui était fait À LA MAIN dans Excel.
 */

export type Devise = 'CFA' | 'EUR' | 'USD';

/** Attributs d'immobilisation (listes de valeurs SENELEC). */
export interface AttributsImmo {
  sourceBudget?: string;        // ex. 533, 511…
  bit?: string;                 // BIT Distribution / Production / Génie Civil…
  bailleur?: string;            // BM(PASE2), AFD(2018)…
  beneficiaire?: string;        // Exploitation, Commercial…
  processus?: string;           // Travaux / Approvisionnement / Études…
  immobilisationParent?: string;
  nature?: string;              // Production / Transport / Distribution / Commercial / Génie Civil
}

/** Article = ligne du bordereau des prix. */
export interface ArticleBOQ {
  id: string;
  code?: string;                // POSTE.TE.1.2.1.1
  designation: string;
  unite: string;                // U, ML, ens…
  quantite: number;
  prixUnitaire: number;         // dans la devise
  devise: Devise;
  fourniture?: number;
  transport?: number;
  montage?: number;
  total: number;                // qté × PU (ou somme F+T+M)
}

/** Sous-composant = Actif Livrable. */
export interface SousComposant {
  id: string;
  code?: string;                // POSTE.TE.1.2
  nom: string;
  attributs: AttributsImmo;
  articles: ArticleBOQ[];
  total: number;
  immobilisable: boolean;       // sera capitalisé en immo à la MES
}

/** Composant = Classification Actif Projet. */
export interface Composant {
  id: string;
  code?: string;                // POSTE.TE.1
  nom: string;
  attributs: AttributsImmo;
  sousComposants: SousComposant[];
  total: number;
}

export interface StructurationProjet {
  projetCode: string;
  projetNom: string;
  deviseRef: Devise;
  composants: Composant[];
  total: number;
  source: string;               // 'IA (BOQ)', 'Import Excel', 'Manuel'
  dateCreation: string;
  valide: boolean;              // validé par l'utilisateur (human-in-the-loop)
}

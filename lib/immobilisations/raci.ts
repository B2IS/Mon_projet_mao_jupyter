/**
 * raci.ts — GOUVERNANCE RACI DE LA STRUCTURATION (Feuil 2 « RACI »)
 * ----------------------------------------------------------------
 * Qui fait quoi dans le cycle de structuration & immobilisation d'un projet.
 *   R = Réalisateur · A = Approbateur (Autorité) · C = Consulté · I = Informé
 *
 * Source : « Modèle Type structuration des projets » — onglet RACI.
 */

export type RoleRACI = 'Directeur Projet' | 'PMO domaine' | 'Chef de projet' | 'Comptable projet';
export type LettreRACI = 'R' | 'A' | 'C' | 'I';

export const ROLES_RACI: RoleRACI[] = ['Directeur Projet', 'PMO domaine', 'Chef de projet', 'Comptable projet'];

export const LEGENDE_RACI: Record<LettreRACI, string> = {
  R: 'Réalisateur — exécute l’activité',
  A: 'Approbateur (Autorité) — valide et rend compte',
  C: 'Consulté — avis requis avant action',
  I: 'Informé — tenu au courant du résultat',
};

export interface ProcessusRACI {
  cle: string;
  libelle: string;
  matrice: Record<RoleRACI, LettreRACI>;
  activites: string[];
}

export const PROCESSUS_RACI: ProcessusRACI[] = [
  {
    cle: 'compilation',
    libelle: 'Compilation des Bordereaux',
    matrice: { 'Directeur Projet': 'I', 'PMO domaine': 'A', 'Chef de projet': 'R', 'Comptable projet': 'C' },
    activites: [
      'Rassembler les fichiers Excel des bordereaux des prix constitutifs du scope du projet',
      'Vérifier le calcul horizontalement et verticalement pour conformité au Contrat signé',
      'Copier le contenu des bordereaux des prix sur les colonnes réservées à cet effet',
      'Vérifier le calcul horizontal et vertical du cumul constitutif du projet',
      'Purger toutes les lignes non porteuses de coût d’actif et non récapitulatives',
      'Renseigner tous les attributs de chaque tâche financière',
    ],
  },
  {
    cle: 'structuration',
    libelle: 'Structuration Projet (WBS)',
    matrice: { 'Directeur Projet': 'I', 'PMO domaine': 'A', 'Chef de projet': 'R', 'Comptable projet': 'C' },
    activites: [
      'Regrouper les tâches financières par Organisation de dépense (Commercial, Distribution, Production, Support, Transport)',
      'Découper le projet par Organisation de dépense',
      'Regrouper par Lot de travail par localisation (Délégation, Région, Département, Agence commerciale…)',
      'Regrouper en Sous-lot de travail = Composant (Classification Actif Projet)',
      'Regrouper en Sous-Composant (Actif Livrable)',
      'Codifier de manière expressive les Numéros des tâches',
      'Indiquer les Numéros des tâches parents conformes à la structuration',
      'Indiquer les Dates de début et de fin de chaque tâche financière',
      'Vérifier à nouveau les totaux verticalement et horizontalement',
      'Copier les attributs du projet sur le canevas « ProjectImportTemplate »',
      'Renseigner les attributs complémentaires du canevas',
      'Soumettre le canevas à Information, Consultation et Approbation',
      'Copier les onglets « Projet » et « Tâches » vers le fichier d’import propre',
      'Charger le projet dans SIGP',
    ],
  },
  {
    cle: 'budgets',
    libelle: 'Budgets Projet',
    matrice: { 'Directeur Projet': 'A', 'PMO domaine': 'C', 'Chef de projet': 'C', 'Comptable projet': 'R' },
    activites: [
      'Élaborer les budgets Projection RMA, Engagement Autorisé et Crédits de paiement annuels',
      'Soumettre les budgets du projet à Information, Consultation et Approbation',
      'Charger les budgets (RMA, Engagement, Crédits de paiement) dans SIGP',
    ],
  },
  {
    cle: 'facturation',
    libelle: 'Facturation Projet',
    matrice: { 'Directeur Projet': 'A', 'PMO domaine': 'C', 'Chef de projet': 'C', 'Comptable projet': 'R' },
    activites: [
      'Établir la situation de facturation exhaustive de chaque tâche financière',
      'Soumettre la situation de facturation à Information, Consultation et Approbation',
      'Charger les factures dans SIGP',
    ],
  },
];

export const COULEUR_RACI: Record<LettreRACI, string> = {
  R: '#15803D', A: '#B45309', C: '#1D4ED8', I: '#6B7280',
};

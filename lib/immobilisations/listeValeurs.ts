/**
 * listeValeurs.ts — RÉFÉRENTIELS D'ATTRIBUTS (Feuil 1 « Liste de valeurs »)
 * ------------------------------------------------------------------------
 * Listes de valeurs SENELEC servant à TAGUER chaque ligne du bordereau lors
 * de la structuration. Ce sont les attributs d'immobilisation — la LOGIQUE,
 * pas les montants (les montants viennent du bordereau du projet).
 *
 * Source : « Modèle Type structuration des projets » — onglet Liste de valeurs.
 * (Échantillons représentatifs ; les listes exhaustives — feeders, secteurs,
 *  agréments — sont chargées depuis le backend / l'import bordereau.)
 */

export interface Referentiel {
  cle: string;          // identifiant attribut
  libelle: string;      // libellé affiché
  description: string;  // rôle dans la structuration
  valeurs: string[];    // échantillon de valeurs (le backend fournit l'exhaustif)
  exhaustif?: number;   // nombre total de valeurs dans le modèle
}

export const LISTES_VALEURS: Referentiel[] = [
  {
    cle: 'organisation_depense',
    libelle: 'Organisation de dépense (Exploitation Bénéficiaire)',
    description: 'Découpage racine du WBS : à qui profite l’actif. 1re maille de regroupement (RACI — Structuration, activité 1-2).',
    valeurs: ['Production', 'Transport', 'Distribution', 'Commercial', 'Support', 'DESA/SD', 'DPP-DAS'],
    exhaustif: 16,
  },
  {
    cle: 'classification_actif',
    libelle: 'Classification Actif Projet (= Composant)',
    description: 'Sous-lot de travail = Composant du WBS (activité 4). Regroupe les sous-composants de même nature technique.',
    valeurs: ['EQUIPEMENT ELECTRIQUE CENTRALE', 'EQUIPEMENT MECANIQUE CENTRALE', 'GENIE CIVIL CENTRALE',
      'EQUIPEMENT ELECTRIQUE HTB POSTE GIS', 'EQUIPEMENT ELECTRIQUE BT POSTE HTB', 'EQUIPEMENT TELECONDUITE',
      'EQUIPEMENT TELECOMMUNICATION', 'COMPOSANT COMMUN', 'COMPOSANT NON INSTALLE', 'BRANCHEMENT COMMERCIAL',
      'COMPTAGE COMMERCIAL'],
    exhaustif: 35,
  },
  {
    cle: 'actif_livrable',
    libelle: 'Actif Livrable (= Sous-composant)',
    description: 'Sous-composant capitalisable (activité 5). C’est le grain de l’immobilisation livrée.',
    valeurs: ['Alternateur avec Régulateur de tension', 'Transformateur Eleveur de puissance', 'Tableau HTA Centrale',
      'Batterie de Stockage', 'Panneaux Solaires Champ Photovoltaïque', 'Armoires et Tableaux BT',
      'Système de Téléconduite et Télécom', 'Antenne radio', 'Câbles et Chemins de câble', 'Pièces de Rechange',
      'Autres Travaux divers'],
    exhaustif: 152,
  },
  {
    cle: 'nature',
    libelle: 'NATURE (classe comptable SYSCOHADA)',
    description: 'Compte d’immobilisation / charge porté par la DOI (511…527). Détermine l’imputation comptable.',
    valeurs: ['511', '512', '513', '514', '515', '516', '517', '521', '522', '523', '524', '525', '527'],
    exhaustif: 43,
  },
  {
    cle: 'domaine_budget',
    libelle: 'Domaine Budget Investissement (BIT)',
    description: 'Budget d’imputation par métier (Budget d’Investissement Technique).',
    valeurs: ['BIT Production', 'BIT Transport', 'BIT Distribution', 'BIT Commercial', 'BIT Génie Civil',
      'BIT Télcom', 'BIT SI', 'BIT QSE'],
    exhaustif: 17,
  },
  {
    cle: 'processus',
    libelle: 'Processus Opérationnel',
    description: 'Processus métier rattaché à la dépense (Étude, Travaux, Exploitation, Approvisionnement…).',
    valeurs: ['Étude', 'Travaux', 'Approvisionnement', 'Exploitation', 'Extension', 'Contrôle', 'Audit', 'Finance'],
    exhaustif: 24,
  },
  {
    cle: 'source_budget',
    libelle: 'Source Budget Investissement',
    description: 'Origine de financement de la maille budgétaire.',
    valeurs: ['Travaux', 'Exploitation', 'Service', 'Particulier', 'CER', 'IPP', 'OMVG', 'OMVS', 'Autre'],
    exhaustif: 9,
  },
  {
    cle: 'bailleur',
    libelle: 'Bailleur de fonds',
    description: 'Bailleur finançant l’actif (sert au RMA et à la rémunération régulée).',
    valeurs: ['AFD(2011)', 'AFD(2018)', 'BAD', 'BM(PASE2)', 'BCI-ETAT', 'KFW', 'BID', 'Autre'],
    exhaustif: 52,
  },
  {
    cle: 'unite',
    libelle: 'Unité Actif livrable',
    description: 'Unité physique de l’actif livrable (capacité, longueur, surface…).',
    valeurs: ['U', 'ML', 'MVA', 'MVAR', 'MW', 'M2', 'M3', 'HA', 'KG', 'JOURS', 'MOIS', 'HOMME MOIS'],
    exhaustif: 12,
  },
  {
    cle: 'statut_rma',
    libelle: 'Statut RMA',
    description: 'Éligibilité à la Rémunération des Moyens Affectés (régulation).',
    valeurs: ['Éligible', 'Non Éligible', 'Rémunéré', 'Non Rémunéré', 'Autre'],
    exhaustif: 5,
  },
  {
    cle: 'localisation',
    libelle: 'Localisation (Lot de travail)',
    description: 'Maille géographique du lot de travail (activité 3) : Région · Département · Feeder · Secteur.',
    valeurs: ['Région', 'Département', 'Délégation', 'Agence commerciale', 'Feeder', 'Secteur'],
    exhaustif: 208,
  },
  {
    cle: 'nom_ressource',
    libelle: 'Nom de la ressource',
    description: 'Type de ressource consommée par la tâche financière (Fourniture, Main d’œuvre, Transport…).',
    valeurs: ['Fourniture', 'Main d’Œuvre Personnel Cadre', 'Main d’Œuvre Personnel Maîtrise',
      'Main d’Œuvre Personnel Ouvriers', 'Transport Matériel', 'Prestations Services Génie Civil', 'Frais Études et Contrôle'],
    exhaustif: 26,
  },
];

export function getListe(cle: string): Referentiel | undefined {
  return LISTES_VALEURS.find(l => l.cle === cle);
}

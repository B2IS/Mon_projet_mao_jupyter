/**
 * decomposition.ts — MODÈLE DE DÉCOMPOSITION SOUS-COMPOSANTS (Feuil 3)
 * -------------------------------------------------------------------
 * Modèle de référence qui guide la STRUCTURATION d'une ligne de bordereau :
 *
 *   ACTIF (Organisation de dépense)
 *     └─ COMPOSANT (Classification Actif Projet) — NATURE + règle DOI
 *          └─ SOUS-COMPOSANT (Actif Livrable)
 *
 * Chaque Composant porte :
 *   • NATURE       : classe comptable SYSCOHADA (DOI = Demande Ouverture Imputation)
 *   • règle DOI    : maille d'ouverture de l'imputation (par projet/centrale/tranche/poste)
 *   • cadreBordereau : intitulé du total dans le bordereau des prix
 *
 * AUCUN MONTANT : les coûts proviennent du bordereau du projet, jamais d'ici.
 * Source : « Modèle Type structuration des projets » — onglet Décomposition Sous-composants.
 */

export type RegleDOI =
  | 'DOI PAR PROJET'
  | 'DOI PAR CENTRALE'
  | 'DOI PAR TRANCHE/GROUPE'
  | 'DOI PAR POSTE'
  | 'DOI PAR LIGNE'
  | 'DOI PAR DEPART';

export interface Composant {
  classification: string;     // CLASSIFICATION ACTIF PROJET
  cadreBordereau: string;     // intitulé du total dans le bordereau
  nature?: string;            // classe comptable (vide ⇒ héritée du sous-total)
  regleDOI?: RegleDOI;        // maille d'ouverture d'imputation
  sousComposants: string[];   // Actifs livrables (grain capitalisable)
}

export interface ActifModele {
  actif: string;              // Organisation de dépense (PRODUCTION, TRANSPORT…)
  composants: Composant[];
}

// Sous-composants transverses réutilisés (Études, Terrain).
const ETUDES = (nature: string): Composant => ({
  classification: 'ETUDES ET CONFORMITES E&S', cadreBordereau: 'TOTAL ETUDES', nature, regleDOI: 'DOI PAR PROJET',
  sousComposants: ['Études de Faisabilité', 'Études d’Exécution', 'Études d’Impact Environnemental et Social',
    'Plan d’Action de Réinstallation', 'Plan de Gestion Environnementale et Sociale'],
});
const TERRAIN = (nature: string): Composant => ({
  classification: 'TERRAIN', cadreBordereau: 'TOTAL ACQUISITION TERRAIN', nature, regleDOI: 'DOI PAR PROJET',
  sousComposants: ['Frais d’Acquisition Terrain', 'Frais d’acquisition des Permis'],
});

export const MODELE_DECOMPOSITION: ActifModele[] = [
  {
    actif: 'PRODUCTION',
    composants: [
      ETUDES('517'),
      TERRAIN('517'),
      {
        classification: 'GENIE CIVIL CENTRALE', cadreBordereau: 'TOTAL GENIE CIVIL', nature: '512', regleDOI: 'DOI PAR CENTRALE',
        sousComposants: ['Structure béton armé et Canalisations', 'Structure métallique', 'Ventilation industrielle du bâtiment',
          'Élévation Mur et Toiture', 'Huisserie industrielle Porte et Fenêtre', 'Pont roulant et Palan',
          'Ventilation et Air conditionné', 'Ascenseur de charge', 'Voierie', 'Vidéosurveillance', 'Autres Équipements divers'],
      },
      {
        classification: 'EQUIPEMENT MECANIQUE CENTRALE', cadreBordereau: 'TOTAL EQUIPEMENT MECANIQUE', nature: '513', regleDOI: 'DOI PAR TRANCHE/GROUPE',
        sousComposants: ['Équipement Moteur', 'Circuits des auxiliaires mécaniques', 'Circuit de récupération de chaleur',
          'Outillages', 'Pièces de Rechange', 'Commun des tranches'],
      },
      {
        classification: 'EQUIPEMENT ELECTRIQUE CENTRALE', cadreBordereau: 'TOTAL EQUIPEMENT ELECTRIQUE', nature: '523', regleDOI: 'DOI PAR TRANCHE/GROUPE',
        sousComposants: ['Panneaux Solaires Champ Photovoltaïque', 'Onduleur Chargeur Production', 'Onduleur Réseau Production',
          'Régulateur de charge', 'Batterie de Stockage', 'Alternateur avec Régulateur de tension', 'Système de Protection et de Contrôle',
          'Services Auxiliaires Basse Tension', 'Tableau HTA Centrale', 'Câbles et Chemins de câble',
          'Système de Téléconduite et Télécom', 'Transformateur Auxiliaire', 'Transformateur Élévateur de puissance',
          'Pièces de Rechange', 'Commun des tranches'],
      },
      {
        classification: 'COMPOSANT COMMUN', cadreBordereau: 'TOTAL POSTE HTB', nature: '514', regleDOI: 'DOI PAR POSTE',
        sousComposants: ['Système stockage combustible', 'Système de Détection Incendie', 'Système de Mise à la Terre Poste',
          'Système Éclairage', 'Système Protection Foudre', 'Groupe Électrogène de Secours'],
      },
    ],
  },
  {
    actif: 'TRANSPORT',
    composants: [
      { ...ETUDES('527'),
        sousComposants: ['Études de Faisabilité', 'Études d’Exécution', 'Études d’Impact Environnemental et Social',
          'Plan d’Action de Réinstallation (525)', 'Plan de Gestion Environnementale et Sociale (525)'] },
      TERRAIN('525'),
      {
        classification: 'EQUIPEMENT ELECTRIQUE HTB POSTE GIS', cadreBordereau: 'TOTAL POSTE HTB GIS', nature: '524', regleDOI: 'DOI PAR POSTE',
        sousComposants: ['Cellules blindées GIS', 'Transformateur de puissance HTB/HTA', 'Jeu de barres', 'Disjoncteurs HTB',
          'Système de Protection et Contrôle Commande', 'Téléconduite poste', 'Système Mise à la Terre'],
      },
      {
        classification: 'LIGNE HTB', cadreBordereau: 'TOTAL LIGNE HTB', nature: '521', regleDOI: 'DOI PAR LIGNE',
        sousComposants: ['Supports / Pylônes', 'Câbles conducteurs', 'Isolateurs et accessoires', 'Mise à la terre ligne', 'Travaux de pose'],
      },
    ],
  },
  {
    actif: 'DISTRIBUTION',
    composants: [
      ETUDES('517'),
      {
        classification: 'EQUIPEMENT ELECTRIQUE HTA POSTE HTB', cadreBordereau: 'TOTAL POSTE DISTRIBUTION HTA/BT', nature: '522', regleDOI: 'DOI PAR POSTE',
        sousComposants: ['Cellules HTA (Coupure / Té / Manœuvre)', 'Transformateur HTA/BT', 'Tableau BT', 'Accessoires électriques',
          'Équipement de téléconduite (ITI, RTU, antenne)', 'Génie civil poste', 'Mise à la terre'],
      },
      {
        classification: 'LIGNE HTA', cadreBordereau: 'TOTAL LIGNE HTA', nature: '521', regleDOI: 'DOI PAR DEPART',
        sousComposants: ['Supports', 'Conducteurs HTA', 'Isolateurs', 'Équipements de coupure', 'Travaux de pose'],
      },
      {
        classification: 'COMPTAGE COMMERCIAL', cadreBordereau: 'TOTAL COMPTAGE', nature: '516', regleDOI: 'DOI PAR PROJET',
        sousComposants: ['Compteurs AMI', 'Concentrateurs', 'Branchements'],
      },
    ],
  },
];

export const REGLES_DOI: { regle: RegleDOI; description: string }[] = [
  { regle: 'DOI PAR PROJET', description: 'Une imputation unique pour tout le projet (études, terrain, comptage).' },
  { regle: 'DOI PAR CENTRALE', description: 'Une imputation par centrale (génie civil de production).' },
  { regle: 'DOI PAR TRANCHE/GROUPE', description: 'Une imputation par tranche / groupe (équipements méca & élec centrale).' },
  { regle: 'DOI PAR POSTE', description: 'Une imputation par poste (postes HTB/HTA, distribution HTA/BT).' },
  { regle: 'DOI PAR LIGNE', description: 'Une imputation par ligne de transport.' },
  { regle: 'DOI PAR DEPART', description: 'Une imputation par départ / feeder (lignes HTA).' },
];

/** Liste à plat des composants (avec leur actif parent) — pour les sélecteurs. */
export function composantsAplat(): { actif: string; composant: Composant }[] {
  return MODELE_DECOMPOSITION.flatMap(a => a.composants.map(c => ({ actif: a.actif, composant: c })));
}

/** Composants disponibles pour une Organisation de dépense (Actif). */
export function composantsDe(actif: string): Composant[] {
  return MODELE_DECOMPOSITION.find(a => a.actif === actif)?.composants ?? [];
}

/** Retrouve un composant par sa classification (toutes organisations confondues). */
export function trouverComposant(classification: string): Composant | undefined {
  return composantsAplat().find(x => x.composant.classification === classification)?.composant;
}

/** Liste des organisations de dépense (racines du modèle). */
export const ORGANISATIONS_DEPENSE = MODELE_DECOMPOSITION.map(a => a.actif);

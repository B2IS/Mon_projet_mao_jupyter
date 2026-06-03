// ─── Codes & Enums ───────────────────────────────────────────────────────────

export type DirectionCode = 'DEP' | 'DER' | 'DIT' | 'DGC' | 'CPBM-UE' | 'CC26' | 'CPAMACEL' | 'CPADERAU';

/**
 * Types de projets — alignés sur les 4 domaines OFFICIELS SENELEC :
 *  Production / Transport / Distribution / Commercial.
 * Les types granulaires (production_conv, production_renouv, electrification_rurale…)
 * s'agrègent à un domaine principal.
 *  - electrification_rurale → domaine `distribution`
 *  - smartgrid              → domaine `commercial`
 */
export type TypeProjet =
  // Production
  | 'production_conv' | 'production_renouv'
  // Transport
  | 'transport'
  // Distribution (inclut électrification rurale / accès universel)
  | 'distribution' | 'electrification_rurale'
  // Commercial (AMI, GRC, prépaiement, digitalisation, smart grid client)
  | 'commercial' | 'smartgrid'
  // Autres (rare, à éviter)
  | 'autre';

export type StatutProjet =
  | 'etude' | 'appel_offres' | 'en_cours' | 'suspendu'
  | 'reception_provisoire' | 'reception_definitive' | 'cloture';

export type PhaseCode =
  | 'etudes_aps' | 'etudes_apd' | 'passation_marche'
  | 'approvisionnement' | 'travaux_gc' | 'travaux_elec'
  | 'mise_en_service' | 'reception_prov' | 'reception_def';

export type StatutPhase = 'non_demarre' | 'en_cours' | 'termine' | 'en_retard';

export type BailleurCode = 'BM' | 'AFD' | 'UE' | 'MCA' | 'BEI' | 'BOAD' | 'KFW' | 'SENELEC' | 'ASER' | 'AUTRE';

export type GraviteIncident = 'faible' | 'modere' | 'grave' | 'bloquant';

export type TypeCourrier = 'entrant' | 'sortant';
export type StatutCourrier = 'recu' | 'en_cours_traitement' | 'traite' | 'classe' | 'en_attente_visa' | 'valide' | 'envoye';
export type CategorieCourrier = 'demande' | 'reponse' | 'rapport' | 'note_service' | 'contrat' | 'facture' | 'compte_rendu' | 'autre';
export type PrioriteCourrier = 'urgente' | 'normale' | 'faible';

export type TypeDocument =
  | 'rapport_avancement' | 'rapport_final' | 'etude_aps' | 'etude_apd'
  | 'contrat' | 'avenant' | 'pv_reception' | 'plan' | 'facture'
  | 'note_technique' | 'correspondance' | 'photo' | 'dao' | 'autre';

export type StatutTache = 'a_faire' | 'en_cours' | 'bloque' | 'termine';
export type PrioriteTache = 'haute' | 'normale' | 'faible';

// ─── Direction ────────────────────────────────────────────────────────────────

export interface DirectionDPE {
  code: DirectionCode;
  label: string;
  labelCourt: string;
  couleur: string;
  directeur: string;
  mission: string;
}

// ─── Projet ───────────────────────────────────────────────────────────────────

export interface BailleurFinancement {
  code: BailleurCode;
  nom: string;
  montant: number;
  devise: 'FCFA' | 'USD' | 'EUR';
  tauxChange?: number;
  montantFCFA: number;
  pourcentage: number;
}

export interface Phase {
  code: PhaseCode;
  label: string;
  dateDebut: string;
  dateFin: string;
  avancement: number;
  statut: StatutPhase;
  budgetPrevu: number;
  budgetEngage: number;
  budgetDecaisse: number;
  observations?: string;
}

export interface Localite {
  id: string;
  code: string;
  nom: string;
  region: string;
  departement: string;
  lat: number;
  lng: number;
  population: number;
  nbMenages: number;
  distanceReseauKm: number;
  avancement: number;
  statut: 'non_demarre' | 'en_cours' | 'termine';
  dateDebut?: string;
  dateFin?: string;
  notes?: string;
}

export interface Marche {
  id: string;
  reference: string;
  objet: string;
  entreprise: string;
  montantHT: number;
  montantTTC: number;
  dateSignature: string;
  dateDebut: string;
  dateFin: string;
  statut: 'en_cours' | 'resilie' | 'termine' | 'en_attente';
  avancement: number;
  observations?: string;
}

export interface Incident {
  id: string;
  date: string;
  type: 'retard' | 'technique' | 'securite' | 'administratif' | 'financier' | 'autre';
  gravite: GraviteIncident;
  description: string;
  localiteCode?: string;
  actionCorrective: string;
  statut: 'ouvert' | 'en_cours' | 'resolu';
  responsable: string;
}

export interface Tache {
  id: string;
  titre: string;
  description?: string;
  assignee: string;
  priorite: PrioriteTache;
  statut: StatutTache;
  dateEcheance: string;
  dateCreation: string;
  projetCode?: string;
  direction?: DirectionCode;
  phaseCode?: PhaseCode;
}

export interface DocumentProjet {
  id: string;
  nom: string;
  type: TypeDocument;
  auteur: string;
  date: string;
  taille: string;
  version: string;
  projetCode?: string;
  courrierRef?: string;
  description?: string;
}

export interface ProjetDPE {
  id: string;
  code: string;
  intitule: string;
  direction: DirectionCode;
  type: TypeProjet;
  statut: StatutProjet;
  priorite: 'haute' | 'normale' | 'basse';
  region: string;
  localite: string;
  chefProjet: string;
  directeur: string;
  dateDebut: string;
  dateFin: string;
  avancement: number;
  budget: number;
  budgetEngage: number;
  budgetDecaisse: number;
  lat: number;
  lng: number;
  nbLocalites?: number;
  beneficiaires?: number;
  bailleurs: BailleurFinancement[];
  phases: Phase[];
  localites: Localite[];
  marches: Marche[];
  incidents: Incident[];
  documents: DocumentProjet[];
  taches: Tache[];
  description?: string;
  objectif?: string;
}

// ─── Courrier ─────────────────────────────────────────────────────────────────

export interface CircuitValidation {
  etape: number;
  role: string;
  agent: string;
  statut: 'en_attente' | 'approuve' | 'rejete';
  dateAction?: string;
  commentaire?: string;
}

export interface Courrier {
  id: string;
  reference: string;
  type: TypeCourrier;
  objet: string;
  expediteur: string;
  destinataire: string;
  direction: DirectionCode;
  projetCode?: string;
  statut: StatutCourrier;
  priorite: PrioriteCourrier;
  categorie: CategorieCourrier;
  dateReception?: string;
  dateEnvoi?: string;
  dateEcheance?: string;
  signataire?: string;
  resume?: string;
  pieceJointe: boolean;
  nombrePJ: number;
  circuit?: CircuitValidation[];
}

// ─── Workflow / Alertes ───────────────────────────────────────────────────────

export interface WorkflowAlerte {
  id: string;
  type: 'retard' | 'budget' | 'incident_grave' | 'validation' | 'reception' | 'echeance_courrier';
  projetCode: string;
  message: string;
  date: string;
  statut: 'nouvelle' | 'vue' | 'traitee';
  destinataire: string;
  priorite: 'critique' | 'haute' | 'normale';
}

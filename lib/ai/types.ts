/**
 * lib/ai/types.ts — Swarm Orchestrateur SIGEPP-DPE
 * Types partagés par tous les agents du pipeline IA.
 */

// (no direct projectStore imports needed — types are defined inline below)

// ─────────────────────────────────────────────────────────────────────────────
// 1. Contexte d'entrée du swarm
// ─────────────────────────────────────────────────────────────────────────────

/** Un fichier source transmis à l'Orchestrateur */
export interface SwarmInputFile {
  name: string;
  ext: string;     // xlsx | docx | pdf | zip | rar | png | …
  size: number;    // bytes
  /** Base64 data-URI ou blob URL (rendu disponible côté client avant envoi API) */
  dataUrl?: string;
}

/** Contexte initial créé par l'Orchestrateur après parsing des fichiers */
export interface ProjetCreationContext {
  nomProjet:        string;
  codeProjet:       string;
  description:      string;
  domaine:          'production' | 'transport' | 'distribution' | 'commercial' | 'genie_civil';
  typeProjet:       string;  // ex : 'Électrification rurale', 'Réseau HTA'
  dateDebut:        string;  // ISO date
  dateFinPrevue:    string;
  budgetEstime:     number;  // MFCFA
  bailleur?:        string;
  programme?:       string;
  chefProjetNom?:   string;
  sourceFiles:      SwarmInputFile[];
  parseWarnings:    string[];
}

// ─────────────────────────────────────────────────────────────────────────────
// 2. Résultat de chaque agent
// ─────────────────────────────────────────────────────────────────────────────

export type AgentId =
  | 'orchestrateur'
  | 'planificateur'
  | 'risques'
  | 'documentaire'
  | 'financier'
  | 'ressources'
  | 'suivi_eval'
  | 'chef_projet';

export type AgentStatus = 'idle' | 'running' | 'done' | 'error';

export interface AgentResult<T = unknown> {
  agentId: AgentId;
  status: AgentStatus;
  durationMs: number;
  data: T;
  /** Fichiers source que cet agent a effectivement lus et exploités */
  filesUsed: string[];
  /** Résumé humain de ce que l'agent a produit */
  summary: string;
  warnings: string[];
}

// ─────────────────────────────────────────────────────────────────────────────
// 3. Outputs spécifiques par agent
// ─────────────────────────────────────────────────────────────────────────────

/** Tâche simplifiée générée par le planificateur (subset de TacheWBS) */
export interface SwarmTache {
  nom: string;
  wbs?: string;        // code WBS ex: '1.1'
  niveau: number;      // 1=phase, 2=sous-tâche
  dateDebut: string;
  dateFin: string;
  duree: number;
  avancement: number;
  statut: string;
  coutPrevu: number;
  coutReel: number;
  responsableNom: string;
  predecesseurs: string[];
}

/** Jalon simplifié généré par le planificateur */
export interface SwarmJalon {
  nom: string;
  date: string;
  statut: string;
  critique: boolean;
}

/** Sortie Planificateur */
export interface PlanificateurOutput {
  taches: SwarmTache[];
  jalons: SwarmJalon[];
  baselineNom: string;
  dureeJours: number;
  cheminCritique: string[];   // noms tâches
  detectionsWarnings: string[];
}

/** Lot BOQ (Bordereau de Prix Unitaires) */
export interface LotBOQ {
  item:          number;
  designation:   string;
  fourniture:    number;
  revision:      number;
  transport:     number;
  pose:          number;
  totalHTVA:     number;
  budgetProjet:  number;
  tauxReal:      number;
  resteAFacturer:number;
}

/** Sortie Gestionnaire Financier (modèle PAUE2/Excellec) */
export interface FinancierOutput {
  budgetTotal:       number;  // MFCFA
  budgetInitial:     number;  // marché de base
  avenant:           number;  // avenant révision prix
  engagementsInit:   number;
  avanceDemarrage:   number;  // 20% convention DPE
  avanceAppro:       number;  // 10%
  retenue:           number;  // 5%
  tvaRate:           number;  // 0.18
  decomptes: Array<{
    numero: number;
    reference: string;        // N° FA ex: FA0318/20
    designation: string;
    pctMarche: number;        // % du marché
    montantHT: number;
    tva: number;
    deductionAvanceDem: number;
    deductionAvanceAppro: number;
    retenue5pct: number;
    montantNet: number;       // net à payer
    statut: 'facturé' | 'certifié' | 'payé';
  }>;
  lots: LotBOQ[];             // BOQ 4 lots PAUE2
  planDecaissement: Array<{ periode: string; montant: number }>;
  tauxDecaissement: number;   // %
  resteAFacturer:   number;
}

/** Sortie Gestionnaire Ressources */
export interface RessourcesOutput {
  affectations: Array<{
    ressourceNom: string;
    matricule?: string;
    tacheNom: string;
    pourcentage: number;
    dateDebut: string;
    dateFin: string;
    tauxHoraire: number;
  }>;
  conflitsDetectes: string[];
  ressourcesManquantes: string[];
}

/** Un risque issu du registre type DPE */
export interface RisqueType {
  id: string;
  titre: string;
  categorie: 'Approvisionnement' | 'Financier' | 'Technique' | 'HSE' | 'Contractuel' | 'Institutionnel';
  probabilite: 1 | 2 | 3 | 4;   // 1 = faible, 4 = quasi-certain
  impact: 1 | 2 | 3 | 4;        // 1 = négligeable, 4 = critique
  criticite: number;             // P × I
  mitigation: string;
  responsable: string;
  delai: string;                 // ISO date ou 'Continu'
  statut: 'Ouvert' | 'En cours' | 'Clôturé';
}

/** Sortie Gestionnaire Risques */
export interface RisquesOutput {
  risques: RisqueType[];
  niveauRisqueGlobal: 'Faible' | 'Modéré' | 'Élevé' | 'Critique';
  risquesCritiques: RisqueType[];   // P×I ≥ 12
}

/** Sortie Suivi-Éval & KPI */
export interface SuiviEvalOutput {
  configEVM: {
    bac: number; // Budget At Completion
    cpiSeuil: number;
    spiSeuil: number;
  };
  icps: Array<{
    code: string;
    libelle: string;
    unite: string;
    valeurCible: number;
    frequence: 'Mensuel' | 'Trimestriel' | 'Annuel';
    source: string;
  }>;
  alerteSeuils: Array<{
    indicateur: string;
    seuilOrange: number;
    seuilRouge: number;
  }>;
  courbeSPlanifiee: Array<{ periode: string; valeurPlanifiee: number }>;
}

/** Sortie Agent Documentaire/GED */
export interface DocumentaireOutput {
  gedFolders: Array<{
    code: string;
    label: string;
    sousRepertoires: string[];
    typesAcceptes: string[];
    conservationAns: number;
  }>;
  metadonneesExtraites: Record<string, string>;
  docsIndexes: number;
}

/** Sortie Chef de Projet */
export interface ChefProjetOutput {
  projetValide: boolean;
  scoreSynthese: number;    // 0-100
  anomalies: string[];
  rapportCreation: string;  // texte
  notifications: Array<{
    destinataire: string;
    sujet: string;
    canal: 'email' | 'app';
  }>;
  prochainAction: string;
}

// ─────────────────────────────────────────────────────────────────────────────
// 4. Contexte complet du swarm (après toutes les phases)
// ─────────────────────────────────────────────────────────────────────────────

export interface SwarmContext {
  runId: string;
  startedAt: string;
  inputFiles: SwarmInputFile[];
  projetContext: ProjetCreationContext;
  results: {
    planificateur?: AgentResult<PlanificateurOutput>;
    financier?:     AgentResult<FinancierOutput>;
    ressources?:    AgentResult<RessourcesOutput>;
    risques?:       AgentResult<RisquesOutput>;
    suiviEval?:     AgentResult<SuiviEvalOutput>;
    documentaire?:  AgentResult<DocumentaireOutput>;
    chefProjet?:    AgentResult<ChefProjetOutput>;
  };
  phase: 0 | 1 | 2 | 3 | 4;    // 0=idle, 1-3=pipeline, 4=done
  validatedByHuman: boolean;
  publishedAt?: string;
}

// ─────────────────────────────────────────────────────────────────────────────
// 5. Events SSE (streaming)
// ─────────────────────────────────────────────────────────────────────────────

export type SSEEventType =
  | 'phase_start'
  | 'agent_start'
  | 'agent_progress'
  | 'agent_done'
  | 'phase_done'
  | 'swarm_done'
  | 'validation_required'
  | 'error';

export interface SSEEvent {
  type: SSEEventType;
  agentId?: AgentId;
  phase?: number;
  message: string;
  data?: unknown;
  timestamp: string;
}

// ─────────────────────────────────────────────────────────────────────────────
// 6. Request/Response API
// ─────────────────────────────────────────────────────────────────────────────

export interface SwarmRequest {
  files: SwarmInputFile[];
  projectOverrides?: Partial<ProjetCreationContext>;
  userId: string;
}

export interface SwarmResponse {
  runId: string;
  status: 'started' | 'completed' | 'failed';
  context?: SwarmContext;
  error?: string;
}

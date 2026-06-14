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
  /** Texte extrait du document (PDF, DOCX, XLSX, CSV, TXT). Max 60k chars. */
  textContent?: string;
  /** Base64 data-URI pour les images (JPG/PNG) et PDF scannés sans texte. Max 4MB. */
  dataUrl?: string;
  /** Indique si le fichier est une image (scanned doc, photo chantier) */
  isImage?: boolean;
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
  | 'chef_projet'
  | 'business_analyst'
  | 'qhse'
  | 'marches'
  // Nouveaux agents Phase 1
  | 'sig'
  | 'bordereaux'
  | 'programmes'
  | 'erp'
  // Nouveaux agents Phase 2
  | 'fournisseurs'
  | 'reception'
  // Nouveaux agents Phase 3
  | 'reporting'
  | 'courriers';

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
  categorie: 'Fourniture' | 'Financier' | 'Technique' | 'HSE' | 'Contractuel' | 'Institutionnel';
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

/** Sortie Business Analyst */
export interface BusinessAnalystOutput {
  perimetreProjet: string;
  objectifsStrategiques: string[];
  beneficiaires: Array<{ type: string; nombre: number; localisation: string }>;
  exigencesFonctionnelles: string[];
  contraintesIdentifiees: string[];
  codesBIT: string[];          // codes BIT/CPF extraits des documents
  niveauComplexite: 'Simple' | 'Modéré' | 'Complexe' | 'Très complexe';
  recommandationsBA: string[];
}

/** Un plan PGES/HSE */
export interface PlanPGES {
  composante: string;    // ex: 'Eau', 'Air', 'Social'
  impact: string;
  mesure: string;
  responsable: string;
  echeance: string;
  statut: 'Planifié' | 'En cours' | 'Réalisé';
}

/** Sortie Agent QHSE */
export interface QHSEOutput {
  niveauRisqueHSE: 'Faible' | 'Modéré' | 'Élevé' | 'Critique';
  planPGES: PlanPGES[];
  indicateursHSE: Array<{
    code: string;
    libelle: string;
    unite: string;
    cible: number;
    frequence: string;
  }>;
  conformiteDPE: Array<{
    reference: string;   // ex: 'ISO 14001', 'OHSAS 18001', 'Code Travail SN'
    statut: 'Conforme' | 'Non conforme' | 'En cours';
    action?: string;
  }>;
  formationsRequises: string[];
  equipementEPI: string[];
}

/** Un lot marché */
export interface LotMarche {
  numero: number;
  libelle: string;
  montantHTVA: number;      // FCFA
  fournisseur?: string;
  typeContrat: 'Marché à prix ferme' | 'Marché à prix révisable' | 'Bon de commande' | 'Régie';
  dateNotification?: string;
  dateReception?: string;
  statut: 'Planifié' | 'En cours de passation' | 'Notifié' | 'Clôturé';
}

/** Sortie Agent Marchés */
export interface MarchesOutput {
  strategiePassation: string;
  lotsIdentifies: LotMarche[];
  calendrierPassation: Array<{ etape: string; datePrevisionnelle: string }>;
  daoExtraits: Array<{ reference: string; objet: string; montantEstimatif: number }>;
  ccapPoints: string[];        // points clés du CCAP identifiés
  risquesPassation: string[];
  totalMarchesPrevu: number;   // MFCFA
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

// ─────────────────────────────────────────────────────────────────────────────
// 3b. Outputs nouveaux agents
// ─────────────────────────────────────────────────────────────────────────────

/** Sortie Agent SIG / Géospatial */
export interface SIGOutput {
  zones: Array<{
    nom: string;
    type: 'ligne' | 'pylone' | 'poste' | 'village' | 'zone_travaux';
    coordonnees: Array<{ lat: number; lng: number }>;
    longueurKm?: number;
    description?: string;
  }>;
  centroide?: { lat: number; lng: number };
  empriseTotaleKm2?: number;
  localitesIdentifiees: string[];
  regionsIdentifiees: string[];
  projectionDetectee?: string; // ex: WGS84, UTM 28N
  fichiersTraites: string[];
}

/** Sortie Agent Bordereaux (BPU/DQE) */
export interface BordereauOutput {
  sections: Array<{
    numero: string;
    designation: string;
    lignes: Array<{
      item: string;
      designation: string;
      unite: string;
      quantite: number;
      prixUnitaireHT: number;
      montantHT: number;
    }>;
    sousTotal: number;
  }>;
  totalHT: number;
  totalTVA: number;
  totalTTC: number;
  devise: string;
  dateDevis?: string;
  entreprise?: string;
  nbLignes: number;
}

/** Sortie Agent Programmes */
export interface ProgrammeOutput {
  codeProgramme: string;     // ex: 'PASER', 'BEST', 'PADAES', 'PSES'
  nomProgramme: string;
  composante?: string;       // ex: 'Composante A — Électrification rurale'
  bailleur: string;
  montantProgramme?: number; // MFCFA
  dateDebut?: string;
  dateFin?: string;
  objetifsProgramme: string[];
  projetDansPortefeuille: boolean;
  codePortefeuille?: string;
}

/** Un PV ou étape de réception */
export interface EtapeReception {
  type: 'provisoire' | 'definitive' | 'partielle' | 'ods';
  reference?: string;
  date?: string;
  statut: 'Planifiée' | 'En cours' | 'Complétée' | 'Avec réserves';
  reserves: string[];
  montantGarantie?: number;
  dateLeveReserves?: string;
}

/** Sortie Agent Réception */
export interface ReceptionOutput {
  etapes: EtapeReception[];
  reservesEnCours: string[];
  asBuiltDisponible: boolean;
  documentsTechniques: string[];
  jalonsReception: Array<{ label: string; date: string; critique: boolean }>;
  statutGlobal: 'Non commencée' | 'En cours' | 'Provisoire obtenue' | 'Définitive obtenue';
}

/** Un fournisseur extrait des documents */
export interface FournisseurExtrait {
  nom: string;
  rccm?: string;
  nif?: string;
  pays: string;
  specialite: string;
  typeContrat: string;
  montantContrat?: number; // MFCFA
  statut: 'Agréé' | 'En cours d\'agrément' | 'Inconnu';
}

/** Sortie Agent Fournisseurs */
export interface FournisseursOutput {
  fournisseurs: FournisseurExtrait[];
  totalMontantContrats: number; // MFCFA
  risquesConcentration: string[];
  recommandations: string[];
}

/** Sortie Agent ERP / Imputation */
export interface ERPOutput {
  codeImputation?: string;      // code Oracle/SAP projet
  codeBIT?: string;             // code BIT/CPF
  codesCPF: string[];
  referencesOracle: string[];
  referencesSAP: string[];
  centresCout: string[];
  exerciceBudgetaire?: string;
  uniteGestion?: string;
}

/** Sortie Agent Reporting */
export interface ReportingOutput {
  periodeCouverture: string;    // ex: 'T2 2026'
  typeRapport: 'T1' | 'T2' | 'T3' | 'T4' | 'Mensuel' | 'Ad hoc';
  sections: Array<{
    titre: string;
    contenu: string;
    tableauData?: Record<string, string | number>[];
  }>;
  indicateursCles: Array<{
    libelle: string;
    valeur: number;
    unite: string;
    evolution: 'hausse' | 'baisse' | 'stable';
  }>;
  conclusions: string[];
  recommandations: string[];
}

/** Un courrier ou correspondance officielle */
export interface CourrierExtrait {
  reference?: string;
  objet: string;
  expediteur?: string;
  destinataire?: string;
  date?: string;
  type: 'ODS' | 'Notification' | 'Mise en demeure' | 'Rapport' | 'Autre';
  priorite: 'Haute' | 'Normale' | 'Basse';
  actionRequise?: string;
}

/** Sortie Agent Courriers */
export interface CourriersOutput {
  courriers: CourrierExtrait[];
  odsDetectes: Array<{ reference: string; date: string; objet: string }>;
  alertes: string[];
  nbCourriersSansReponse: number;
}

export interface SwarmContext {
  runId: string;
  startedAt: string;
  inputFiles: SwarmInputFile[];
  projetContext: ProjetCreationContext;
  results: {
    planificateur?:   AgentResult<PlanificateurOutput>;
    financier?:       AgentResult<FinancierOutput>;
    ressources?:      AgentResult<RessourcesOutput>;
    risques?:         AgentResult<RisquesOutput>;
    suiviEval?:       AgentResult<SuiviEvalOutput>;
    documentaire?:    AgentResult<DocumentaireOutput>;
    chefProjet?:      AgentResult<ChefProjetOutput>;
    businessAnalyst?: AgentResult<BusinessAnalystOutput>;
    qhse?:            AgentResult<QHSEOutput>;
    marches?:         AgentResult<MarchesOutput>;
    // Nouveaux agents
    sig?:             AgentResult<SIGOutput>;
    bordereaux?:      AgentResult<BordereauOutput>;
    programmes?:      AgentResult<ProgrammeOutput>;
    erp?:             AgentResult<ERPOutput>;
    fournisseurs?:    AgentResult<FournisseursOutput>;
    reception?:       AgentResult<ReceptionOutput>;
    reporting?:       AgentResult<ReportingOutput>;
    courriers?:       AgentResult<CourriersOutput>;
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

/**
 * authTypes.ts — Types purs + tables RBAC SIGEP-DPE
 * Rôles calés sur les postes réels du fichier personnel DPE (203 agents).
 * Sans directive React / sans import dynamique — importable côté serveur (middleware.ts).
 */

// ─── RÔLES ───────────────────────────────────────────────────────────────────
export type RoleCode =
  // Direction générale
  | 'DIR_DPE'         // Directeur Principal Equipement
  | 'DIRECTEUR'       // Directeurs DIT, DGC, DEP
  | 'COORDINATEUR'    // Coordinateurs CC26, BM-UE
  // Management
  | 'CHEF_DEPT'       // Chefs de Département (DPT, DIT, DGC, DPEC, DPER, DET&GI)
  | 'CHEF_CELLULE'    // Chefs de Cellule (CSE, CPADERAU, CPAMACEL)
  | 'CHEF_PROJ'       // Chefs de Projet (tous)
  // Expertise & Conseil
  | 'CONSEILLER'      // Conseillers Techniques
  | 'EXPERT_SE'       // Experts Suivi Évaluation
  | 'EXPERT_PMO'      // Expert en Gestion de Projet CSE
  // Opérationnel projets
  | 'CONTROLEUR'      // Contrôleurs terrain / projet
  | 'INGENIEUR'       // Ingénieurs (Étude, Projets, Travaux)
  // Finances & Marchés
  | 'RAF'             // Responsables Administratifs et Financiers
  | 'COMPTABLE'       // Comptables
  | 'MARCHES'         // Responsable Passation des Marchés
  | 'SPM'             // SPM Chargé Suivi Gestion Contrats
  // Techniques spécialisés
  | 'SIG'             // SIG / Cartographie / Géomatique
  | 'IMMO'            // Immobilisations / DOE / Actifs
  | 'DESSINATEUR'     // Dessinateurs / Projeteurs
  | 'HSE'             // HSE / Social / Environnement
  | 'COMMUNICATION'   // Communication
  // Administratifs & Support
  | 'ASSISTANT_PROJ'  // Assistants Projet + Assistants PM
  | 'ASSISTANT_ADMIN' // Assistants Administratifs et Budget
  | 'ASSISTANT_DIR'   // Assistantes de Direction
  | 'SECRETAIRE'      // Secrétaires
  | 'RESP_LOG'        // Chefs UAGL + Chef Groupe Logistique
  | 'CHAUFFEUR'       // Chauffeurs
  // Système
  | 'AUDIT'           // Responsable Audit Interne
  | 'ADMIN';          // Administrateur Système

export interface UserRole {
  code: RoleCode;
  label: string;
  description: string;
  color: string;
  icon: string;
}

export const ROLES: Record<RoleCode, UserRole> = {
  DIR_DPE:        { code: 'DIR_DPE',        label: 'Directeur Principal',          description: 'Vision exécutive — portefeuille stratégique, KPIs, arbitrages & bailleurs',              color: '#3D1A6B', icon: '👔' },
  DIRECTEUR:      { code: 'DIRECTEUR',      label: 'Directeur',                    description: 'Directeur DIT / DGC / DEP — projets et résultats de sa direction',                       color: '#4C1D95', icon: '🏛️' },
  COORDINATEUR:   { code: 'COORDINATEUR',   label: 'Coordinateur de Programme',    description: 'Coordination CC26 / BM-UE — gestion programme multi-projets, bailleurs, finances',       color: '#7C3AED', icon: '📊' },
  CHEF_DEPT:      { code: 'CHEF_DEPT',      label: 'Chef de Département',          description: 'Chef de Département / Service / Unité — projets et indicateurs de son unité',            color: '#0F766E', icon: '🏢' },
  CHEF_CELLULE:   { code: 'CHEF_CELLULE',   label: 'Chef de Cellule',             description: 'Chef de Cellule (CSE / CPADERAU / CPAMACEL) — KPIs, reporting, programme',               color: '#0D9488', icon: '📋' },
  CHEF_PROJ:      { code: 'CHEF_PROJ',      label: 'Chef de Projet',              description: 'Gestion opérationnelle de ses projets — planning, coûts, équipe, jalons',                color: '#1D4ED8', icon: '🧑‍💼' },
  CONSEILLER:     { code: 'CONSEILLER',     label: 'Conseiller Technique',        description: 'Consultation avancée tous projets du périmètre, reporting et KPIs',                       color: '#6D28D9', icon: '🔬' },
  EXPERT_SE:      { code: 'EXPERT_SE',      label: 'Expert Suivi Évaluation',     description: 'KPIs, reporting, dashboard, analyse portefeuille — validation KPI',                       color: '#7C3AED', icon: '📈' },
  EXPERT_PMO:     { code: 'EXPERT_PMO',     label: 'Expert Gestion de Projet',    description: 'PMO / KPI / Reporting / Audit Projet — CSE',                                              color: '#5B21B6', icon: '🎯' },
  CONTROLEUR:     { code: 'CONTROLEUR',     label: 'Contrôleur',                  description: 'Contrôle physique, missions terrain, photos, contraintes — mise à jour avancement',       color: '#D97706', icon: '🔍' },
  INGENIEUR:      { code: 'INGENIEUR',      label: 'Ingénieur',                   description: 'APS · APD · DAO · GED · Planning · Avancement · Cartographie',                           color: '#2563EB', icon: '⚙️' },
  RAF:            { code: 'RAF',            label: 'Responsable Adm. Financier',  description: 'Budget · Factures · Décaissements · Bailleurs — gestion financière programme',           color: '#B45309', icon: '💰' },
  COMPTABLE:      { code: 'COMPTABLE',      label: 'Comptable',                   description: 'Factures · Paiements · Décaissements — saisie et suivi comptable',                        color: '#92400E', icon: '🧾' },
  MARCHES:        { code: 'MARCHES',        label: 'Passation des Marchés',       description: 'DAO · DRPO · AO · Contrats · Avenants · Décomptes — gestion complète',                   color: '#9333EA', icon: '📑' },
  SPM:            { code: 'SPM',            label: 'SPM Contrats',                description: 'Contrats · Avenants · Décomptes · Réceptions — suivi et gestion des contrats',            color: '#7C2D12', icon: '📝' },
  SIG:            { code: 'SIG',            label: 'SIG / Géomatique',            description: 'Cartographie · Réseaux · Actifs · Géolocalisation (sans données financières)',            color: '#0D9488', icon: '🗺️' },
  IMMO:           { code: 'IMMO',           label: 'Immobilisations',             description: 'Actifs · Capitalisation · Mise en service · Amortissements',                              color: '#92400E', icon: '🏛️' },
  DESSINATEUR:    { code: 'DESSINATEUR',    label: 'Dessinateur / Projeteur',     description: 'Plans · DOE · GED — production et archivage des plans techniques',                        color: '#1E40AF', icon: '📐' },
  HSE:            { code: 'HSE',            label: 'HSE / Social / Enviro.',      description: 'EIES · PAR · PGES · Suivi social et environnemental des projets',                         color: '#059669', icon: '🌿' },
  COMMUNICATION:  { code: 'COMMUNICATION',  label: 'Communication',               description: 'Actualités projets · Publications · Documentation institutionnelle',                       color: '#EC4899', icon: '📢' },
  ASSISTANT_PROJ: { code: 'ASSISTANT_PROJ', label: 'Assistant Projet / PM',       description: 'GED · Livrables · Réunions · Courriers — support opérationnel projets',                  color: '#4B5563', icon: '📁' },
  ASSISTANT_ADMIN:{ code: 'ASSISTANT_ADMIN',label: 'Assistant Adm. & Budget',     description: 'Budget · Courriers · Documents — support administratif et budgétaire',                    color: '#6B7280', icon: '📊' },
  ASSISTANT_DIR:  { code: 'ASSISTANT_DIR',  label: 'Assistante de Direction',     description: 'Courriers · Réunions · GED · Agenda — support direction',                                color: '#8B5CF6', icon: '🗓️' },
  SECRETAIRE:     { code: 'SECRETAIRE',     label: 'Secrétaire',                  description: 'Courriers entrants/sortants · GED · Agenda — secrétariat',                               color: '#A855F7', icon: '📫' },
  RESP_LOG:       { code: 'RESP_LOG',       label: 'Resp. UAGL / Logistique',     description: 'Logistique · Véhicules · Missions · Ordres de mission',                                  color: '#0891B2', icon: '🚐' },
  CHAUFFEUR:      { code: 'CHAUFFEUR',      label: 'Chauffeur',                   description: 'Mes missions · ODM · Véhicule affecté · Kilométrage · Consommation carburant',            color: '#0369A1', icon: '🚗' },
  AUDIT:          { code: 'AUDIT',          label: 'Audit Interne',               description: 'Lecture seule globale · audit · historique complet de la DPE',                           color: '#475569', icon: '🛡️' },
  ADMIN:          { code: 'ADMIN',          label: 'Administrateur Système',       description: 'Accès complet — paramétrage, gestion utilisateurs, rôles, journaux d\'audit',            color: '#374151', icon: '🔧' },
};

// ─── UTILISATEUR ─────────────────────────────────────────────────────────────
export interface TestUser {
  id: string;
  nom: string;
  prenom: string;
  email: string;
  password: string;
  role: RoleCode;
  direction: string;
  departement?: string;
  cellule?: string;
  initials: string;
  avatarColor: string;
  projetsAssignes?: string[];
  poste?: string;
}

// ─── ORGANISATION DPE ────────────────────────────────────────────────────────
export const DPE_UNITES = [
  { code: 'EM_DPE',       label: 'État-Major — Direction Principale Équipement',          shortLabel: 'EM DPE',       effectif: 11 },
  { code: 'DER',          label: 'Direction Équipement Réseaux',                          shortLabel: 'DER',          effectif: 64 },
  { code: 'DPT',          label: 'Direction Projets Transport',                           shortLabel: 'DPT',          effectif: 28 },
  { code: 'DGC',          label: 'Direction Génie Civil',                                 shortLabel: 'DGC',          effectif: 38 },
  { code: 'CPBM_UE',      label: 'Coordination Programmes BM-UE (BEST/PADAES)',           shortLabel: 'CPBM-UE',      effectif: 22 },
  { code: 'DEP',          label: 'Direction Équipement Production',                       shortLabel: 'DEP',          effectif: 17 },
  { code: 'DIT',          label: 'Direction Innovation Technologique',                    shortLabel: 'DIT',          effectif: 16 },
  { code: 'CC26',         label: 'Coordination Compact 2026 (MCA)',                       shortLabel: 'CC26',         effectif: 15 },
  { code: 'CPAMACEL_EE',  label: 'Coordination PAMACEL & Efficacité Énergétique',         shortLabel: 'CPAMACEL&EE',  effectif: 11 },
  { code: 'CPADERAU',     label: 'Coordination Programme PADERAU (AFD/BEI)',              shortLabel: 'CPADERAU',     effectif: 5  },
  { code: 'CSE',          label: 'Cellule Suivi & Évaluation — DPE',                      shortLabel: 'CSE',          effectif: 2  },
] as const;

export const DPE_EFFECTIF = {
  total: 203,
  parCollege: { Cadre: 93, Maitrise: 78, Executif: 30 },
  parSexe:    { Hommes: 140, Femmes: 61 },
} as const;

export const DIRECTION_LABELS: Record<string, string> = {
  'EM_DPE':      'État-Major — Direction Principale Équipement',
  'DER':         'Direction Équipement Réseaux',
  'DGC':         'Direction Génie Civil',
  'DEP':         'Direction Équipement Production',
  'DIT':         'Direction Innovation Technologique',
  'CC26':        'Coordination Compact 2026',
  'CPBM_UE':     'Coordination Programmes BM-UE',
  'CPAMACEL_EE': 'Coordination PAMACEL & Efficacité Énergétique',
  'CPADERAU':    'Coordination Programme PADERAU',
  'CSE':         'Cellule Suivi & Évaluation — DPE',
};

export function normalizeDirectionCode(code: string): string {
  const c = code.trim().toUpperCase().replace(/[^A-Z0-9]/g, '');
  const aliases: Record<string, string> = {
    'EMDPE':       'EM_DPE',
    'DER':         'DER',
    'DPT':         'DPT',
    'DPD':         'DPD',
    'DGC':         'DGC',
    'DEP':         'DEP',
    'DIT':         'DIT',
    'CC26':        'CC26',
    'CPBMUE':      'CPBM_UE',
    'CPADERAU':    'CPADERAU',
    'CPAMACELEE':  'CPAMACEL_EE',
    'CPAMACEL':    'CPAMACEL_EE',
    'CSE':         'CSE',
  };
  return aliases[c] ?? code.trim().toUpperCase();
}

// ─── SECTIONS SIDEBAR ────────────────────────────────────────────────────────
export type SidebarSectionId =
  | 'accueil' | 'portefeuille' | 'mes_projets' | 'execution'
  | 'finances' | 'immobilisations' | 'logistique' | 'transverses' | 'parametrage';

export const ROLE_SECTIONS: Record<RoleCode, SidebarSectionId[]> = {
  DIR_DPE:        ['accueil', 'portefeuille', 'finances', 'immobilisations', 'transverses'],
  DIRECTEUR:      ['accueil', 'portefeuille', 'execution', 'finances', 'immobilisations', 'transverses'],
  COORDINATEUR:   ['accueil', 'portefeuille', 'mes_projets', 'execution', 'finances', 'transverses'],
  CHEF_DEPT:      ['accueil', 'portefeuille', 'execution', 'finances', 'immobilisations', 'transverses'],
  CHEF_CELLULE:   ['accueil', 'portefeuille', 'mes_projets', 'finances', 'transverses'],
  CHEF_PROJ:      ['accueil', 'mes_projets', 'execution', 'finances', 'transverses'],
  CONSEILLER:     ['accueil', 'portefeuille', 'execution', 'finances', 'transverses'],
  EXPERT_SE:      ['accueil', 'portefeuille', 'transverses'],
  EXPERT_PMO:     ['accueil', 'portefeuille', 'mes_projets', 'execution', 'transverses'],
  CONTROLEUR:     ['accueil', 'mes_projets', 'execution', 'logistique', 'transverses'],
  INGENIEUR:      ['accueil', 'mes_projets', 'execution', 'transverses'],
  RAF:            ['accueil', 'finances', 'transverses'],
  COMPTABLE:      ['accueil', 'finances', 'transverses'],
  MARCHES:        ['accueil', 'finances', 'transverses'],
  SPM:            ['accueil', 'finances', 'transverses'],
  SIG:            ['accueil', 'execution', 'transverses'],
  IMMO:           ['accueil', 'immobilisations', 'transverses'],
  DESSINATEUR:    ['accueil', 'transverses'],
  HSE:            ['accueil', 'mes_projets', 'execution', 'transverses'],
  COMMUNICATION:  ['accueil', 'transverses'],
  ASSISTANT_PROJ: ['accueil', 'mes_projets', 'execution', 'transverses'],
  ASSISTANT_ADMIN:['accueil', 'finances', 'transverses'],
  ASSISTANT_DIR:  ['accueil', 'logistique', 'transverses'],
  SECRETAIRE:     ['accueil', 'logistique', 'transverses'],
  // RESP_LOG voit logistique + transverses UNIQUEMENT — pas les finances projet ni le portefeuille
  RESP_LOG:       ['accueil', 'logistique', 'transverses'],
  // CHAUFFEUR : logistique uniquement (ODM, flotte) — PAS execution projet, PAS finances
  CHAUFFEUR:      ['accueil', 'logistique'],
  AUDIT:          ['accueil', 'portefeuille', 'execution', 'finances', 'immobilisations', 'logistique', 'transverses'],
  ADMIN:          ['accueil', 'portefeuille', 'mes_projets', 'execution', 'finances', 'immobilisations', 'logistique', 'transverses', 'parametrage'],
};

const S_DIR_BASE: SidebarSectionId[] = ['accueil', 'portefeuille', 'mes_projets', 'execution', 'finances', 'immobilisations', 'logistique', 'transverses'];

export const DIRECTION_SECTIONS: Record<string, SidebarSectionId[]> = {
  'EM_DPE':      [...S_DIR_BASE, 'logistique', 'parametrage'],
  'DEP':         S_DIR_BASE,
  'DER':         S_DIR_BASE,
  'DPT':         S_DIR_BASE,
  'DPD':         S_DIR_BASE,
  'DGC':         S_DIR_BASE,
  'DIT':         S_DIR_BASE,
  'CC26':        S_DIR_BASE,
  'CPBM_UE':     S_DIR_BASE,
  'CPADERAU':    S_DIR_BASE,
  'CPAMACEL_EE': S_DIR_BASE,
  'CSE':         S_DIR_BASE,
};

// ─── ROUTES PAR RÔLE ─────────────────────────────────────────────────────────
const R_TBL    = '/tableau-de-bord';
const R_PORT   = ['/portefeuille', '/programmes'];
const R_PROJ   = ['/projets', '/cockpit-projet', '/gantt', '/gestion-projet'];
const R_WBS    = ['/wbs', '/structuration', '/taches'];
const R_EXEC   = ['/suivi-evaluation', '/terrain', '/risques'];
const R_CARTO  = ['/cartographie'];
const R_FIN    = ['/budget', '/evm', '/marches', '/fournisseurs', '/immobilisations'];
const R_RPT    = ['/reporting', '/workflows'];
const R_STUDIO = ['/analytique', '/studio-rapports', '/agents-ia', '/constructeur-indicateurs'];
const R_GED    = ['/ged'];
const R_LOG    = ['/odm', '/flotte', '/rh'];

const R_ETUDES = ['/etudes'];
const R_RECOLEMENT = ['/recolement'];
const R_MES = ['/mise-en-service'];
const R_SYS = ['/erp-interface', '/docs'];

const R_CHEF_TEAM = [
  R_TBL, ...R_PROJ, ...R_WBS, '/suivi-evaluation', ...R_EXEC.slice(1), ...R_CARTO,
  ...R_FIN, '/bordereaux', '/receptions', ...R_GED, ...R_RPT,
  ...R_ETUDES, ...R_RECOLEMENT, ...R_MES,
];

export const ROLE_ROUTES: Record<RoleCode, string[]> = {
  // ── Direction générale ──────────────────────────────────────────────────────
  // DIR_DPE : vue consolidée stratégique — pas de terrain ni WBS/tâches opérationnels
  DIR_DPE:   [R_TBL, '/alertes', '/springboard', ...R_PORT, ...R_PROJ, '/suivi-evaluation', '/risques', ...R_CARTO, ...R_FIN, ...R_STUDIO, ...R_GED, ...R_RPT, '/bordereaux', '/receptions', '/dashboard-builder', '/gestion-temps', '/courriers', '/migration', '/administration', ...R_LOG, ...R_SYS, ...R_ETUDES, ...R_RECOLEMENT, ...R_MES],

  // DIRECTEUR : vue direction — consolidé par direction, décisions, reporting. Pas de terrain.
  DIRECTEUR: [R_TBL, '/alertes', '/springboard', ...R_PORT, ...R_PROJ, '/suivi-evaluation', '/risques', ...R_CARTO, ...R_FIN, '/bordereaux', '/receptions', ...R_STUDIO.slice(0, 2), ...R_GED, ...R_RPT, '/courriers', '/odm', '/gestion-temps', ...R_ETUDES, ...R_RECOLEMENT, ...R_MES],

  // COORDINATEUR : vue programme — multi-projets, finances, risques. Pas de terrain.
  COORDINATEUR: [R_TBL, '/alertes', '/springboard', ...R_PORT, ...R_PROJ, ...R_WBS, '/suivi-evaluation', '/risques', ...R_CARTO, ...R_FIN, '/bordereaux', '/receptions', '/agents-ia', ...R_GED, ...R_RPT, '/courriers', '/migration', ...R_ETUDES, ...R_RECOLEMENT, ...R_MES],

  // ── Management ──────────────────────────────────────────────────────────────
  CHEF_DEPT: [R_TBL, '/alertes', '/springboard', ...R_PORT, ...R_PROJ, ...R_WBS, '/suivi-evaluation', ...R_EXEC.slice(1), ...R_CARTO, ...R_FIN, ...R_STUDIO, ...R_GED, ...R_RPT, '/odm', ...R_ETUDES, ...R_RECOLEMENT, ...R_MES],

  CHEF_CELLULE: [R_TBL, '/alertes', '/springboard', ...R_PORT, ...R_PROJ, ...R_WBS, '/suivi-evaluation', ...R_CARTO, ...R_FIN, '/bordereaux', '/receptions', ...R_STUDIO.slice(0, 2), ...R_GED, ...R_RPT, '/courriers', '/administration', ...R_SYS, ...R_ETUDES, ...R_RECOLEMENT, ...R_MES],

  CHEF_PROJ: ['/alertes', '/springboard', ...R_CHEF_TEAM, '/migration', '/agents-ia'],

  // ── Expertise & Conseil ──────────────────────────────────────────────────────
  CONSEILLER: [R_TBL, '/alertes', ...R_PORT, ...R_PROJ, '/suivi-evaluation', ...R_EXEC, ...R_CARTO, ...R_STUDIO.slice(0, 2), ...R_GED, ...R_RPT, '/courriers', ...R_ETUDES, ...R_RECOLEMENT],

  EXPERT_SE: [R_TBL, '/alertes', ...R_PORT, '/suivi-evaluation', ...R_CARTO, ...R_STUDIO.slice(0, 2), ...R_GED, ...R_RPT, '/courriers'],

  EXPERT_PMO: [R_TBL, '/alertes', ...R_PORT, ...R_PROJ, '/suivi-evaluation', ...R_EXEC, ...R_CARTO, '/agents-ia', ...R_STUDIO, ...R_GED, ...R_RPT, '/courriers', ...R_ETUDES, ...R_RECOLEMENT, ...R_MES],

  // ── Opérationnel projets ─────────────────────────────────────────────────────
  // CONTROLEUR = agent non-cadre terrain → accès pointage heures supplémentaires
  CONTROLEUR: [R_TBL, '/alertes', ...R_PROJ, '/suivi-evaluation', '/terrain', '/risques', ...R_CARTO, ...R_GED, '/courriers', '/workflows', '/gestion-temps', '/pointage', '/suivi-temps', ...R_RECOLEMENT],

  INGENIEUR: [R_TBL, '/alertes', ...R_PROJ, ...R_WBS, '/suivi-evaluation', '/terrain', ...R_CARTO, ...R_GED, '/courriers', '/workflows', ...R_ETUDES, ...R_RECOLEMENT, ...R_MES],

  // ── Finances & Marchés ───────────────────────────────────────────────────────
  RAF:      [R_TBL, '/alertes', ...R_FIN, '/bordereaux', '/receptions', ...R_STUDIO.slice(0, 2), ...R_GED, ...R_RPT, '/courriers', ...R_SYS],

  COMPTABLE:[R_TBL, '/alertes', '/budget', '/bordereaux', '/receptions', ...R_GED, '/reporting', '/workflows', '/courriers'],

  MARCHES:  [R_TBL, '/alertes', '/marches', '/bordereaux', '/receptions', '/fournisseurs', ...R_GED, ...R_RPT],

  SPM:      [R_TBL, '/alertes', '/marches', '/bordereaux', '/receptions', ...R_GED, '/courriers', '/workflows'],

  // ── Techniques spécialisés ───────────────────────────────────────────────────
  SIG:      [R_TBL, '/alertes', ...R_CARTO, '/projets', ...R_GED, '/courriers', '/workflows', ...R_RECOLEMENT],

  IMMO:     [R_TBL, '/alertes', '/immobilisations', '/structuration', ...R_GED, ...R_RPT, '/courriers', ...R_MES],

  DESSINATEUR: [R_TBL, '/alertes', ...R_GED, '/courriers', '/workflows', ...R_ETUDES],

  HSE:      [R_TBL, '/alertes', ...R_PROJ, '/suivi-evaluation', '/terrain', ...R_CARTO, ...R_GED, '/courriers', '/workflows'],

  COMMUNICATION: [R_TBL, '/alertes', ...R_GED, '/courriers', '/workflows'],

  // ── Administratifs & Support ─────────────────────────────────────────────────
  ASSISTANT_PROJ:  [R_TBL, '/alertes', ...R_PROJ, ...R_WBS, '/suivi-evaluation', '/terrain', ...R_CARTO, ...R_GED, '/courriers', '/reservation-salle', ...R_RPT, ...R_ETUDES],

  ASSISTANT_ADMIN: [R_TBL, '/alertes', '/budget', ...R_GED, '/courriers', '/workflows', '/reservation-salle'],

  // ASSISTANT_DIR et SECRETAIRE = agents non-cadres → accès pointage heures supplémentaires
  ASSISTANT_DIR:   [R_TBL, '/alertes', ...R_GED, '/courriers', '/workflows', '/reservation-salle', '/gestion-temps', '/pointage', '/suivi-temps'],

  SECRETAIRE: [R_TBL, '/alertes', ...R_GED, '/courriers', '/reservation-salle', '/workflows', '/gestion-temps', '/pointage', '/suivi-temps'],

  // RESP_LOG : logistique + rapport UAGL uniquement — PAS studio composition, PAS projets, PAS finances
  RESP_LOG:  [R_TBL, '/alertes', ...R_LOG, '/reservation-salle', '/courriers', ...R_GED, '/reporting', '/workflows', '/gestion-temps', '/pointage', '/suivi-temps'],

  // CHAUFFEUR : missions uniquement — vue mobile
  CHAUFFEUR: [R_TBL, '/alertes', '/odm', '/flotte', '/gestion-temps', '/pointage', '/suivi-temps'],

  // ── Système ──────────────────────────────────────────────────────────────────
  AUDIT:     ['*'],
  ADMIN:     ['*'],
};

export const ROLE_NAV_ITEMS: Record<RoleCode, string[]> = {
  // DIR_DPE : vue exécutive — consolidé + analytics, pas de terrain ni WBS opérationnel
  DIR_DPE:   [R_TBL, '/alertes', '/springboard', ...R_PORT, ...R_PROJ, '/suivi-evaluation', '/risques', ...R_CARTO, ...R_FIN, ...R_STUDIO, ...R_GED, ...R_RPT, '/bordereaux', '/receptions', '/dashboard-builder', '/gestion-temps', '/courriers', '/workflows', '/migration', '/administration', ...R_LOG, ...R_SYS, ...R_ETUDES, ...R_RECOLEMENT, ...R_MES],

  // DIRECTEUR : vue direction — portefeuille, finances, analytics, rapports. Pas de terrain.
  DIRECTEUR: [R_TBL, '/alertes', '/springboard', ...R_PORT, ...R_PROJ, '/suivi-evaluation', '/risques', ...R_CARTO, ...R_FIN, '/bordereaux', '/receptions', ...R_STUDIO.slice(0, 2), ...R_GED, ...R_RPT, '/courriers', '/workflows', '/odm', '/gestion-temps', ...R_ETUDES, ...R_RECOLEMENT, ...R_MES],

  COORDINATEUR: [R_TBL, '/alertes', '/springboard', ...R_PORT, ...R_PROJ, ...R_WBS, '/suivi-evaluation', '/risques', ...R_CARTO, ...R_FIN, '/bordereaux', '/receptions', '/agents-ia', ...R_GED, ...R_RPT, '/courriers', '/workflows', '/migration', ...R_ETUDES, ...R_RECOLEMENT, ...R_MES],

  CHEF_DEPT: [R_TBL, '/alertes', '/springboard', ...R_PORT, ...R_PROJ, ...R_WBS, '/suivi-evaluation', ...R_EXEC.slice(1), ...R_CARTO, ...R_FIN, ...R_STUDIO, ...R_GED, ...R_RPT, '/courriers', '/workflows', ...R_ETUDES, ...R_RECOLEMENT, ...R_MES],

  CHEF_CELLULE: [R_TBL, '/alertes', '/springboard', ...R_PORT, ...R_PROJ, ...R_WBS, '/suivi-evaluation', ...R_CARTO, ...R_FIN, '/bordereaux', '/receptions', ...R_STUDIO.slice(0, 2), ...R_GED, ...R_RPT, '/courriers', '/workflows', '/administration', ...R_SYS, ...R_ETUDES, ...R_RECOLEMENT, ...R_MES],

  CHEF_PROJ: ['/alertes', '/springboard', ...R_CHEF_TEAM, '/migration', '/agents-ia', '/courriers', '/workflows'],

  CONSEILLER: [R_TBL, '/alertes', ...R_PORT, ...R_PROJ, '/suivi-evaluation', ...R_EXEC, ...R_CARTO, ...R_STUDIO.slice(0, 2), ...R_GED, ...R_RPT, '/courriers', '/workflows', ...R_ETUDES, ...R_RECOLEMENT],

  EXPERT_SE: [R_TBL, '/alertes', ...R_PORT, '/suivi-evaluation', ...R_CARTO, ...R_STUDIO.slice(0, 2), ...R_GED, ...R_RPT, '/courriers', '/workflows'],

  EXPERT_PMO: [R_TBL, '/alertes', ...R_PORT, ...R_PROJ, '/suivi-evaluation', ...R_EXEC, ...R_CARTO, '/agents-ia', ...R_STUDIO, ...R_GED, ...R_RPT, '/courriers', '/workflows', ...R_ETUDES, ...R_RECOLEMENT, ...R_MES],

  CONTROLEUR: [R_TBL, '/alertes', ...R_PROJ, '/suivi-evaluation', '/terrain', '/risques', ...R_CARTO, ...R_GED, '/courriers', '/workflows', '/gestion-temps', '/pointage', '/suivi-temps', ...R_RECOLEMENT],

  INGENIEUR: [R_TBL, '/alertes', ...R_PROJ, ...R_WBS, '/suivi-evaluation', '/terrain', ...R_CARTO, ...R_GED, '/courriers', '/workflows', ...R_ETUDES, ...R_RECOLEMENT, ...R_MES],

  RAF:       [R_TBL, '/alertes', ...R_FIN, '/bordereaux', '/receptions', ...R_STUDIO.slice(0, 2), ...R_GED, ...R_RPT, '/courriers', '/workflows', ...R_SYS],

  COMPTABLE: [R_TBL, '/alertes', '/budget', '/bordereaux', '/receptions', ...R_GED, '/reporting', '/courriers', '/workflows'],

  MARCHES:   [R_TBL, '/alertes', '/marches', '/bordereaux', '/receptions', '/fournisseurs', ...R_GED, ...R_RPT, '/courriers', '/workflows'],

  SPM:       [R_TBL, '/alertes', '/marches', '/bordereaux', '/receptions', ...R_GED, '/courriers', '/workflows'],

  SIG:       [R_TBL, '/alertes', ...R_CARTO, '/projets', ...R_GED, '/courriers', '/workflows', ...R_RECOLEMENT],

  IMMO:      [R_TBL, '/alertes', '/immobilisations', '/structuration', ...R_GED, ...R_RPT, '/courriers', '/workflows', ...R_MES],

  DESSINATEUR:   [R_TBL, '/alertes', ...R_GED, '/courriers', '/workflows', ...R_ETUDES],

  HSE:           [R_TBL, '/alertes', ...R_PROJ, '/suivi-evaluation', '/terrain', ...R_CARTO, ...R_GED, '/courriers', '/workflows'],

  COMMUNICATION: [R_TBL, '/alertes', ...R_GED, '/courriers', '/workflows'],

  ASSISTANT_PROJ:  [R_TBL, '/alertes', ...R_PROJ, ...R_WBS, '/suivi-evaluation', '/terrain', ...R_CARTO, ...R_GED, '/courriers', '/reservation-salle', ...R_RPT, '/workflows', ...R_ETUDES],

  ASSISTANT_ADMIN: [R_TBL, '/alertes', '/budget', ...R_GED, '/courriers', '/workflows', '/reservation-salle'],

  ASSISTANT_DIR:   [R_TBL, '/alertes', ...R_GED, '/courriers', '/workflows', '/reservation-salle', '/gestion-temps', '/pointage', '/suivi-temps'],

  SECRETAIRE: [R_TBL, '/alertes', ...R_GED, '/courriers', '/reservation-salle', '/workflows', '/gestion-temps', '/pointage', '/suivi-temps'],

  // RESP_LOG : logistique + rapport UAGL uniquement — PAS studio composition, PAS projets, PAS finances
  RESP_LOG:  [R_TBL, '/alertes', ...R_LOG, '/reservation-salle', '/courriers', ...R_GED, '/reporting', '/workflows', '/gestion-temps', '/pointage', '/suivi-temps'],

  // CHAUFFEUR : missions uniquement — vue mobile
  CHAUFFEUR: [R_TBL, '/alertes', '/odm', '/flotte', '/gestion-temps', '/pointage', '/suivi-temps'],

  AUDIT:     ['*'],
  ADMIN:     ['*'],
};

// /pointage (heures supplémentaires) est EXCLU des routes universelles — réservé agents non-cadres
export const UNIVERSAL_ROUTES = ['/reservation-salle', '/suivi-temps', '/gestion-temps'];

export const ASSISTANT_DETAIL_ROUTES = [
  '/gestion-projet', '/wbs', '/taches', '/terrain', '/gantt',
  '/projets', '/cockpit-projet', '/suivi-evaluation', '/cartographie', '/risques',
];

// ─── HELPERS D'ACCÈS ─────────────────────────────────────────────────────────
const MIGRATION_ROLES: RoleCode[] = ['DIR_DPE', 'DIRECTEUR', 'CHEF_PROJ', 'CHEF_DEPT', 'CHEF_CELLULE', 'COORDINATEUR', 'INGENIEUR', 'ADMIN'];
const COURRIERS_ROLES: RoleCode[] = [
  'DIR_DPE', 'DIRECTEUR', 'COORDINATEUR', 'CHEF_DEPT', 'CHEF_CELLULE', 'CHEF_PROJ',
  'CONSEILLER', 'EXPERT_SE', 'EXPERT_PMO', 'CONTROLEUR', 'INGENIEUR', 'RAF', 'COMPTABLE',
  'MARCHES', 'SPM', 'SIG', 'IMMO', 'HSE', 'COMMUNICATION',
  'ASSISTANT_PROJ', 'ASSISTANT_ADMIN', 'ASSISTANT_DIR', 'SECRETAIRE', 'RESP_LOG',
  'AUDIT', 'ADMIN',
];
export const NO_SALLE_ROLES: RoleCode[] = ['CHAUFFEUR'];

const PARAMETRAGE_ROLES: RoleCode[] = [
  'DIR_DPE', 'DIRECTEUR', 'COORDINATEUR', 'CHEF_DEPT', 'CHEF_CELLULE', 'CHEF_PROJ',
  'CONSEILLER', 'EXPERT_SE', 'EXPERT_PMO', 'CONTROLEUR', 'INGENIEUR', 'RAF', 'COMPTABLE',
  'MARCHES', 'SPM', 'SIG', 'IMMO', 'DESSINATEUR', 'HSE', 'COMMUNICATION',
  'ASSISTANT_PROJ', 'ASSISTANT_ADMIN', 'ASSISTANT_DIR', 'SECRETAIRE', 'RESP_LOG', 'CHAUFFEUR',
  'AUDIT', 'ADMIN',
];

function moduleAccess(role: RoleCode, route: string): boolean | null {
  if (route === '/migration'   || route.startsWith('/migration/'))   return role === 'ADMIN' || MIGRATION_ROLES.includes(role);
  if (route === '/courriers'   || route.startsWith('/courriers/'))   return role === 'ADMIN' || COURRIERS_ROLES.includes(role);
  if (route === '/parametrage' || route.startsWith('/parametrage/')) return PARAMETRAGE_ROLES.includes(role);
  return null;
}

export function canAccess(role: RoleCode, route: string): boolean {
  if (UNIVERSAL_ROUTES.some(u => route === u || route.startsWith(u + '/'))) {
    if (NO_SALLE_ROLES.includes(role) && (route === '/reservation-salle' || route.startsWith('/reservation-salle/'))) return false;
    return true;
  }
  const mod = moduleAccess(role, route);
  if (mod !== null) return mod;
  const allowed = ROLE_ROUTES[role];
  if (allowed.includes('*')) return true;
  return allowed.includes(route);
}

export function canAccessNavItem(role: RoleCode, href: string): boolean {
  if (UNIVERSAL_ROUTES.includes(href)) {
    if (NO_SALLE_ROLES.includes(role) && href === '/reservation-salle') return false;
    return true;
  }
  const mod = moduleAccess(role, href);
  if (mod !== null) return mod;
  const allowed = ROLE_NAV_ITEMS[role];
  if (allowed.includes('*')) return true;
  return allowed.includes(href);
}

export function isAssistantProjet(user: { role: string; poste?: string } | null): boolean {
  if (!user) return false;
  if (user.role === 'ASSISTANT_PROJ') return true;
  return false;
}

// ─── AUTH RESULTS ─────────────────────────────────────────────────────────────
export interface LoginResult {
  success: boolean;
  error?: string;
  locked?: boolean;
  mustChangePassword?: boolean;
}

export interface ChangePasswordResult {
  success: boolean;
  error?: string;
}

// ─── SESSION COOKIE ───────────────────────────────────────────────────────────
export const SESSION_COOKIE = 'sigep_session';
export const SESSION_MAX_AGE = 7 * 24 * 3600; // 7 jours

export interface SessionPayload {
  role: RoleCode;
  id: string;
  email: string;
}

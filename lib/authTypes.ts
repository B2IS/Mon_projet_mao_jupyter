/**
 * authTypes.ts — Types purs + tables RBAC SIGEPP-DPE
 * Sans directive React / sans import dynamique — importable côté serveur (middleware.ts).
 */

// ─── RÔLES ───────────────────────────────────────────────────────────────────
export type RoleCode =
  | 'DIR_DPE' | 'PMO' | 'CHEF_PROJ' | 'CHEF_DEPT' | 'INGENIEUR' | 'EXPERT'
  | 'CONTROLEUR' | 'CHARGE' | 'ASSISTANT' | 'SECRETAIRE' | 'CHAUFFEUR'
  | 'CTRL_FIN' | 'RESP_LOG' | 'MARCHES' | 'SIG' | 'IMMO' | 'AUDIT'
  | 'CONTROLEUR_TRAVAUX' | 'ADMIN';

export interface UserRole {
  code: RoleCode;
  label: string;
  description: string;
  color: string;
  icon: string;
}

export const ROLES: Record<RoleCode, UserRole> = {
  DIR_DPE:   { code: 'DIR_DPE',   label: 'Directeur DPE',             description: 'Vision exécutive — portefeuille stratégique, KPIs, arbitrages & bailleurs',        color: '#3D1A6B', icon: '👔' },
  PMO:       { code: 'PMO',       label: 'PMO / Chef Programmes',     description: 'Pilotage portefeuille multi-projets, EVM, planning consolidé, reporting',           color: '#7C3AED', icon: '📊' },
  CHEF_PROJ: { code: 'CHEF_PROJ', label: 'Chef de Projet',            description: 'Gestion opérationnelle de ses projets — planning, coûts, équipe, jalons',          color: '#1D4ED8', icon: '🧑‍💼' },
  CHEF_DEPT: { code: 'CHEF_DEPT', label: 'Chef de Département',       description: 'Chef de Département / Service / Unité — projets et indicateurs de son unité',       color: '#0F766E', icon: '🏢' },
  INGENIEUR: { code: 'INGENIEUR', label: 'Ingénieur / Études',        description: 'Conception technique, études, dessin, cartographie et ingénierie de projets',       color: '#2563EB', icon: '⚙️' },
  EXPERT:    { code: 'EXPERT',    label: 'Expert Technique',          description: 'Expertise sectorielle, conseil technique et gestion avancée de projet',              color: '#7C3AED', icon: '🔬' },
  CONTROLEUR:{ code: 'CONTROLEUR',label: 'Contrôleur',                description: 'Contrôle qualité, performance et conformité des projets et marchés',                 color: '#D97706', icon: '🔍' },
  CHARGE:    { code: 'CHARGE',    label: 'Chargé de Mission',        description: 'Suivi social, environnemental et missions transversales des programmes',          color: '#059669', icon: '📋' },
  ASSISTANT: { code: 'ASSISTANT', label: 'Assistant de Direction',    description: 'Assistant de direction — support administratif, gestion documentaire, accueil',       color: '#4B5563', icon: '📝' },
  SECRETAIRE:{ code: 'SECRETAIRE',label: 'Secrétaire',                description: 'Secrétariat, archivage et gestion des flux documentaires',                           color: '#8B5CF6', icon: '📁' },
  CHAUFFEUR: { code: 'CHAUFFEUR', label: 'Chauffeur / UAGL',          description: 'Conduite, logistique transport et gestion de la flotte de véhicules',                color: '#0891B2', icon: '🚗' },
  CTRL_FIN:  { code: 'CTRL_FIN',  label: 'Contrôleur Financier',      description: 'Budget, marchés, bordereaux de prix, réceptions, situation financière',             color: '#B45309', icon: '💰' },
  RESP_LOG:  { code: 'RESP_LOG',  label: 'Resp. UAGL / Logistique',   description: 'Ordres de mission, validation déplacements, flotte, ressources humaines',          color: '#0891B2', icon: '🚐' },
  MARCHES:   { code: 'MARCHES',   label: 'Passation des Marchés',     description: 'DAO · DRPO · AO · Contrats · Avenants · Décomptes — sur son périmètre',             color: '#9333EA', icon: '📑' },
  SIG:       { code: 'SIG',       label: 'SIG / Géomatique',          description: 'Cartographie · Réseaux · Actifs · Géolocalisation (sans données financières)',       color: '#0D9488', icon: '🗺️' },
  IMMO:      { code: 'IMMO',      label: 'Immobilisations',           description: 'Actifs · Capitalisation · Mise en service · Amortissements (sans tâches projet)',    color: '#92400E', icon: '🏛️' },
  AUDIT:     { code: 'AUDIT',     label: 'Audit',                     description: 'Lecture seule globale · audit · historique complet de la DPE',                       color: '#475569', icon: '🛡️' },
  CONTROLEUR_TRAVAUX: { code: 'CONTROLEUR_TRAVAUX', label: 'Contrôleur de Travaux', description: 'Terrain · Contrôles · Réceptions · Photos · Non-conformités (sans finances/marchés)', color: '#EA580C', icon: '👷' },
  ADMIN:     { code: 'ADMIN',     label: 'Administrateur Système',    description: 'Accès complet — paramétrage, gestion utilisateurs, rôles, journaux d\'audit',        color: '#374151', icon: '🔧' },
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
  total: 201,
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
  DIR_DPE:   ['accueil', 'portefeuille', 'finances', 'immobilisations', 'transverses'],
  PMO:       ['accueil', 'portefeuille', 'execution', 'finances', 'immobilisations', 'transverses'],
  CHEF_DEPT: ['accueil', 'portefeuille', 'execution', 'finances', 'immobilisations', 'transverses'],
  CHEF_PROJ: ['accueil', 'mes_projets', 'execution', 'finances', 'immobilisations', 'transverses'],
  INGENIEUR: ['accueil', 'mes_projets', 'execution', 'transverses'],
  EXPERT:    ['accueil', 'portefeuille', 'mes_projets', 'execution', 'transverses'],
  CONTROLEUR:['accueil', 'mes_projets', 'execution', 'finances', 'transverses'],
  CHARGE:    ['accueil', 'mes_projets', 'execution', 'transverses'],
  ASSISTANT: ['accueil', 'mes_projets', 'execution', 'logistique', 'transverses'],
  SECRETAIRE:['accueil', 'logistique', 'transverses'],
  CHAUFFEUR: ['accueil', 'logistique'],
  CTRL_FIN:  ['accueil', 'finances', 'immobilisations', 'transverses'],
  RESP_LOG:  ['accueil', 'logistique', 'finances', 'immobilisations', 'transverses'],
  MARCHES:   ['accueil', 'finances', 'transverses'],
  SIG:       ['accueil', 'execution', 'transverses'],
  IMMO:      ['accueil', 'finances', 'immobilisations', 'transverses'],
  AUDIT:     ['accueil', 'portefeuille', 'execution', 'finances', 'immobilisations', 'logistique', 'transverses'],
  CONTROLEUR_TRAVAUX: ['accueil', 'mes_projets', 'execution', 'transverses'],
  ADMIN:     ['accueil', 'portefeuille', 'mes_projets', 'execution', 'finances', 'immobilisations', 'logistique', 'transverses', 'parametrage'],
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

const R_CHEF_TEAM = [
  R_TBL, ...R_PROJ, ...R_WBS, '/suivi-evaluation', ...R_EXEC.slice(1), ...R_CARTO,
  ...R_FIN, '/bordereaux', '/receptions', ...R_GED, ...R_RPT,
];

export const ROLE_ROUTES: Record<RoleCode, string[]> = {
  DIR_DPE:   [R_TBL, ...R_PORT, ...R_PROJ, '/suivi-evaluation', ...R_FIN.slice(0,2), '/fournisseurs', ...R_STUDIO, ...R_RPT, '/dashboard-builder', '/gestion-temps'],
  PMO:       [R_TBL, ...R_PORT, ...R_PROJ, ...R_WBS, '/suivi-evaluation', ...R_EXEC.slice(1), ...R_CARTO, ...R_FIN.slice(0,2), '/fournisseurs', ...R_STUDIO, ...R_GED, ...R_RPT],
  CHEF_DEPT: [R_TBL, ...R_PORT, ...R_PROJ, ...R_WBS, '/suivi-evaluation', ...R_EXEC.slice(1), ...R_CARTO, ...R_FIN, ...R_STUDIO, ...R_GED, ...R_RPT],
  CHEF_PROJ: [...R_CHEF_TEAM, '/migration', '/agents-ia'],
  INGENIEUR: [R_TBL, ...R_PROJ, ...R_WBS, '/migration', '/suivi-evaluation', '/terrain', ...R_CARTO, ...R_GED, '/workflows'],
  EXPERT:    [R_TBL, ...R_PORT.slice(0,1), ...R_PROJ, '/suivi-evaluation', ...R_EXEC.slice(1), ...R_CARTO, '/agents-ia', ...R_GED, '/workflows', '/reporting'],
  CONTROLEUR:[...R_CHEF_TEAM, '/agents-ia'],
  CHARGE:    [R_TBL, ...R_PROJ, '/suivi-evaluation', ...R_EXEC.slice(1,3), ...R_RPT],
  ASSISTANT: [R_TBL, ...R_PROJ, ...R_WBS, '/suivi-evaluation', '/terrain', ...R_CARTO, ...R_GED, '/courriers', '/reservation-salle', ...R_RPT],
  SECRETAIRE:[R_TBL, ...R_GED, '/courriers', '/reservation-salle', ...R_RPT],
  CHAUFFEUR: [R_TBL, '/odm', '/flotte'],
  CTRL_FIN:  [R_TBL, ...R_FIN, '/bordereaux', '/receptions', ...R_STUDIO.slice(0,2), ...R_RPT],
  RESP_LOG:  [R_TBL, ...R_LOG, '/reservation-salle', '/receptions', '/immobilisations', '/courriers', ...R_GED, '/reporting'],
  MARCHES:   [R_TBL, '/marches', '/bordereaux', '/receptions', '/fournisseurs', ...R_GED, ...R_RPT],
  SIG:       [R_TBL, ...R_CARTO, '/projets', ...R_GED],
  IMMO:      [R_TBL, '/immobilisations', ...R_GED, ...R_RPT],
  AUDIT:     ['*'],
  CONTROLEUR_TRAVAUX: [R_TBL, '/projets', '/cockpit-projet', '/terrain', '/risques', '/receptions', ...R_CARTO, ...R_GED, ...R_RPT],
  ADMIN:     ['*'],
};

export const ROLE_NAV_ITEMS: Record<RoleCode, string[]> = {
  DIR_DPE:   [R_TBL, ...R_PORT, '/cockpit-projet', '/gantt', '/suivi-evaluation', ...R_FIN.slice(0,2), '/fournisseurs', ...R_STUDIO, ...R_RPT, '/dashboard-builder', '/gestion-temps', '/courriers', '/workflows'],
  PMO:       [R_TBL, ...R_PORT, ...R_PROJ, ...R_WBS, '/suivi-evaluation', ...R_EXEC.slice(1), ...R_CARTO, ...R_FIN.slice(0,2), '/fournisseurs', ...R_STUDIO, ...R_GED, ...R_RPT, '/courriers', '/workflows'],
  CHEF_DEPT: [R_TBL, ...R_PORT, ...R_PROJ, ...R_WBS, '/suivi-evaluation', ...R_EXEC.slice(1), ...R_CARTO, ...R_FIN, ...R_STUDIO, ...R_GED, ...R_RPT, '/courriers', '/workflows'],
  CHEF_PROJ: [...R_CHEF_TEAM, '/migration', '/agents-ia', '/courriers', '/workflows'],
  INGENIEUR: [R_TBL, ...R_PROJ, ...R_WBS, '/migration', '/terrain', ...R_CARTO, ...R_GED, '/workflows', '/courriers'],
  EXPERT:    [R_TBL, ...R_PORT.slice(0,1), ...R_PROJ, '/suivi-evaluation', ...R_EXEC.slice(1), ...R_CARTO, '/agents-ia', ...R_GED, '/workflows', '/courriers', '/reporting'],
  CONTROLEUR:[...R_CHEF_TEAM, '/agents-ia', '/courriers', '/workflows'],
  CHARGE:    [R_TBL, ...R_PROJ, '/suivi-evaluation', ...R_EXEC.slice(1,3), ...R_RPT, '/courriers', '/workflows'],
  ASSISTANT: [R_TBL, ...R_PROJ, ...R_WBS, '/suivi-evaluation', '/terrain', ...R_CARTO, ...R_GED, '/courriers', '/reservation-salle', ...R_RPT, '/workflows'],
  SECRETAIRE:[R_TBL, ...R_GED, '/courriers', '/reservation-salle', ...R_RPT, '/workflows'],
  MARCHES:   [R_TBL, '/marches', '/bordereaux', '/receptions', '/fournisseurs', ...R_GED, ...R_RPT, '/courriers', '/workflows'],
  SIG:       [R_TBL, ...R_CARTO, '/projets', ...R_GED, '/courriers', '/workflows'],
  IMMO:      [R_TBL, '/immobilisations', '/structuration', ...R_GED, ...R_RPT, '/courriers', '/workflows'],
  AUDIT:     ['*'],
  CONTROLEUR_TRAVAUX: [R_TBL, '/projets', '/cockpit-projet', '/terrain', '/risques', '/receptions', ...R_CARTO, ...R_GED, ...R_RPT, '/courriers', '/workflows'],
  CHAUFFEUR: [R_TBL, '/odm', '/flotte', '/courriers', '/workflows'],
  CTRL_FIN:  [R_TBL, ...R_FIN, '/bordereaux', '/receptions', ...R_STUDIO.slice(0,2), ...R_RPT, '/courriers', '/workflows'],
  RESP_LOG:  [R_TBL, ...R_LOG, '/reservation-salle', '/receptions', '/immobilisations', '/gestion-temps', '/courriers', ...R_GED, '/reporting', '/workflows'],
  ADMIN:     ['*'],
};

export const UNIVERSAL_ROUTES = ['/reservation-salle', '/suivi-temps', '/pointage'];

export const ASSISTANT_DETAIL_ROUTES = [
  '/gestion-projet', '/wbs', '/taches', '/terrain', '/gantt',
  '/projets', '/cockpit-projet', '/suivi-evaluation', '/cartographie', '/risques',
];

// ─── HELPERS D'ACCÈS ─────────────────────────────────────────────────────────
const MIGRATION_ROLES: RoleCode[] = ['CHEF_PROJ', 'CHEF_DEPT', 'INGENIEUR', 'PMO', 'ADMIN'];
const COURRIERS_ROLES: RoleCode[] = ['DIR_DPE', 'PMO', 'CHEF_DEPT', 'CHEF_PROJ', 'ASSISTANT', 'SECRETAIRE', 'RESP_LOG', 'MARCHES', 'ADMIN'];
export const NO_SALLE_ROLES: RoleCode[] = ['CHAUFFEUR'];

function moduleAccess(role: RoleCode, route: string): boolean | null {
  if (route === '/agents-ia' || route.startsWith('/agents-ia/')) return true;
  if (route === '/copilot'   || route.startsWith('/copilot/'))   return true;
  if (route === '/ged'       || route.startsWith('/ged/'))       return true;
  if (route === '/workflows' || route.startsWith('/workflows/')) return true;
  if (route === '/migration' || route.startsWith('/migration/')) return role === 'ADMIN' || MIGRATION_ROLES.includes(role);
  if (route === '/courriers'  || route.startsWith('/courriers/')) return role === 'ADMIN' || COURRIERS_ROLES.includes(role);
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
  if (!user || user.role !== 'ASSISTANT') return false;
  const p = `${user.poste ?? ''}`.toLowerCase();
  if (/direction|directeur|secr[ée]tar|administrati/.test(p)) return false;
  return /\bprojet/.test(p);
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
export const SESSION_COOKIE = 'sigepp_session';
export const SESSION_MAX_AGE = 7 * 24 * 3600; // 7 jours

export interface SessionPayload {
  role: RoleCode;
  id: string;
  email: string;
}

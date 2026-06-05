/**
 * dpeOrgStructure.ts — Architecture Organisationnelle DPE
 * Hiérarchie stricte : NIVEAU 0 (DPE) → NIVEAU 1 (Directions/Coordinations) → NIVEAU 2 (Départements/Cellules)
 * Basé sur la Note de Direction 005/2023 et l'organigramme officiel DPE.
 *
 * Principe de visibilité :
 *   « Chaque utilisateur ne voit que son périmètre organisationnel et les niveaux inférieurs. »
 *
 * → RBAC (Rôles) : quelles fonctionnalités ?
 * → ABAC (Attributs) : quelles règles dynamiques ? (direction, département, type projet, bailleur)
 * → Org Hierarchy : que peut-on voir ? (scope hiérarchique strict)
 */

// ─────────────────────────────────────────────────────────────────────────────
// TYPES
// ─────────────────────────────────────────────────────────────────────────────

export type NiveauHierarchique = 0 | 1 | 2 | 3; // 0=DPE, 1=Direction, 2=Département, 3=Agent

export interface Departement {
  code: string;
  label: string;
  shortLabel: string;
  domaine: string[];        // domaines métier couverts
  typesProjets: string[];   // types de projets visibles
}

export interface DirectionCoordination {
  code: string;
  label: string;
  shortLabel: string;
  niveau: 1;
  domaine: string[];         // domaines métier (ex: production, transport…)
  typesProjets: string[];    // types de projets de la direction
  programmes: string[];      // programmes / bailleurs associés
  departements: Departement[];
  // Visibilité : directions que CETTE direction peut voir (scope propre + transversal si besoin)
  scopeDirections: string[]; // codes des directions dont elle voit les projets
  scopeProgrammes: string[]; // codes des programmes/units visibles
}

// ─────────────────────────────────────────────────────────────────────────────
// DÉPARTEMENTS PAR DIRECTION
// ─────────────────────────────────────────────────────────────────────────────

const DEP_PROJ_CONV: Departement = {
  code: 'DEP_PEC',
  label: 'Département Projets Énergies Conventionnelles',
  shortLabel: 'PEC — Thermique/Charbon/Fuel',
  domaine: ['production', 'thermique', 'charbon', 'fuel'],
  typesProjets: ['Centrale Thermique', 'IPP', 'Rehabilitation', 'Maintenance Majeure'],
};

const DEP_PROJ_ENR: Departement = {
  code: 'DEP_PER',
  label: 'Département Projets Énergies Renouvelables',
  shortLabel: 'PER — Solaire/Éolien/Biomasse',
  domaine: ['production', 'solaire', 'eolien', 'biomasse', 'renouvelable'],
  typesProjets: ['Centrale Solaire', 'Parc Éolien', 'Biomasse', 'Hybride', 'Stockage'],
};

const DPT_TRANSPORT: Departement = {
  code: 'DPT_TRANSPORT',
  label: 'Département Projets Transport',
  shortLabel: 'DPT — Lignes HT/Postes',
  domaine: ['transport', 'lignes_ht', 'postes', 'interconnexion'],
  typesProjets: ['Ligne THT', 'Poste HT/HTA', 'Interconnexion', 'Renforcement'],
};

const DPD_DISTRIBUTION: Departement = {
  code: 'DPD_DISTRIBUTION',
  label: 'Département Projets Distribution',
  shortLabel: 'DPD — HTA/BT/Électrification',
  // Domaine officiel SENELEC : distribution (HTA/BT + accès/électrification rurale)
  domaine: ['distribution', 'hta', 'bt', 'branchements'],
  typesProjets: ['Extension Réseau BT', 'Poste Source HTA', 'Électrification Rurale', 'Comptage'],
};

const DGC_ETUDES: Departement = {
  code: 'DGC_ETUDES',
  label: "Département Études Techniques & Gestion des Immobilisations",
  shortLabel: 'Études & Immobilisations — SIG/Patrimoine',
  // DGC support — études/SIG transverses sur les 4 domaines + projets GC propres
  domaine: ['transport', 'distribution', 'production', 'genie_civil', 'sig', 'patrimoine', 'immobilisation', 'architecture'],
  typesProjets: ['Bâtiment Administratif', 'VRD', 'SIG Patrimoine', 'Audit Immobilier'],
};

const DGC_INVEST: Departement = {
  code: 'DGC_INVEST',
  label: 'Département Projets d\'Investissement',
  shortLabel: 'Investissement — Travaux GC',
  // DGC investissement — génie civil au service des projets transport/distribution + GC propre
  domaine: ['transport', 'distribution', 'genie_civil', 'travaux', 'infrastructure', 'ouvrages'],
  typesProjets: ['Ouvrage Hydraulique', 'Infrastructure Routière', 'Bâtiment Technique', 'VRD'],
};

const DIT_SMARTGRID: Departement = {
  code: 'DIT_SMARTGRID',
  label: 'Département Smartgrid & Stockage d\'Énergie',
  shortLabel: 'Smartgrid & Stockage',
  // Domaine officiel SENELEC : commercial (smart grid côté client/AMI relève du commercial)
  domaine: ['commercial', 'stockage', 'ami', 'scada', 'iot', 'automatisation'],
  typesProjets: ['Déploiement AMI', 'SCADA', 'Stockage Batterie', 'IoT Réseau', 'Automatisation Poste'],
};

const DIT_COMMERCIAL: Departement = {
  code: 'DIT_COMMERCIAL',
  label: 'Département Technologies Commerciales',
  shortLabel: 'Tech. Commerciales',
  domaine: ['commercial', 'ami', 'digital', 'grc', 'facturation', 'prepaiement'],
  typesProjets: ['Déploiement AMI / Compteurs intelligents', 'Digitalisation relation client', 'Prépaiement & paiement mobile', 'Plateforme e-Services SENELEC'],
};

// ─────────────────────────────────────────────────────────────────────────────
// DIRECTIONS / COORDINATIONS NIVEAU 1
// ─────────────────────────────────────────────────────────────────────────────

export const DPE_ORG: DirectionCoordination[] = [
  {
    code: 'EM_DPE',
    label: 'État-Major — Direction Principale Équipement',
    shortLabel: 'EM DPE',
    niveau: 1,
    domaine: ['*'], // voit tout
    typesProjets: ['*'],
    programmes: ['*'],
    departements: [],
    scopeDirections: ['*'],
    scopeProgrammes: ['*'],
  },
  {
    code: 'DEP',
    label: 'Direction Équipement Production',
    shortLabel: 'DEP',
    niveau: 1,
    // Domaine officiel SENELEC : production
    domaine: ['production', 'thermique', 'charbon', 'fuel', 'solaire', 'eolien', 'biomasse', 'renouvelable'],
    typesProjets: ['Centrale Thermique', 'IPP', 'Centrale Solaire', 'Parc Éolien', 'Biomasse', 'Rehabilitation'],
    programmes: ['PES', 'Compact2026', 'PADAES'],
    departements: [DEP_PROJ_CONV, DEP_PROJ_ENR],
    scopeDirections: ['DEP'],
    scopeProgrammes: ['DEP', 'PES'],
  },
  {
    code: 'DER',
    label: 'Direction Équipement Réseaux',
    shortLabel: 'DER',
    niveau: 1,
    // Domaines officiels SENELEC : transport + distribution (inclut accès rural)
    domaine: ['transport', 'distribution', 'lignes_ht', 'postes', 'hta', 'bt'],
    typesProjets: ['Ligne THT', 'Poste HT/HTA', 'Extension Réseau BT', 'Électrification Rurale', 'Interconnexion'],
    // PADERAU exclu : CPADERAU est une cellule PARALLÈLE à DER, rattachée à DPE (ND 005/2023).
    programmes: ['PADAES', 'BEST', 'Compact2026'],
    departements: [DPT_TRANSPORT, DPD_DISTRIBUTION],
    scopeDirections: ['DER', 'DPT', 'DPD'], // DER voit DPT et DPD (sous-directions), PAS PADERAU
    scopeProgrammes: ['DER', 'DPT', 'DPD', 'PADAES', 'BEST'],
  },
  {
    code: 'DGC',
    label: 'Direction Génie Civil',
    shortLabel: 'DGC',
    niveau: 1,
    // DGC = direction SUPPORT (génie civil). Son périmètre de PROJETS = ses propres
    // projets génie civil — PAS tous les projets transport/distribution/production
    // (sinon elle verrait à tort tout DPT+DPD via le repli par domaine).
    domaine: ['genie_civil', 'sig', 'patrimoine', 'immobilisation', 'architecture', 'travaux', 'infrastructure', 'ouvrages'],
    typesProjets: ['Bâtiment Administratif', 'VRD', 'SIG Patrimoine', 'Ouvrage Hydraulique', 'Infrastructure Routière'],
    programmes: [],
    departements: [DGC_ETUDES, DGC_INVEST],
    scopeDirections: ['DGC'],
    scopeProgrammes: ['DGC'],
  },
  {
    code: 'DIT',
    label: 'Direction Innovation Technologique',
    shortLabel: 'DIT',
    niveau: 1,
    // Domaine officiel SENELEC : commercial (AMI / smart grid côté client / digital)
    domaine: ['commercial', 'stockage', 'ami', 'scada', 'iot', 'automatisation', 'digital'],
    typesProjets: ['Déploiement AMI', 'SCADA', 'Stockage Batterie', 'Compteurs intelligents', 'Digitalisation client'],
    programmes: ['BEST'],
    departements: [DIT_SMARTGRID, DIT_COMMERCIAL],
    scopeDirections: ['DIT'],
    scopeProgrammes: ['DIT'],
  },
  {
    code: 'CPBM_UE',
    label: 'Coordination Programmes Banque Mondiale – Union Européenne',
    shortLabel: 'CPBM-UE',
    niveau: 1,
    domaine: ['bailleur', 'bm', 'ue', 'reporting_bailleurs', 'audit'],
    typesProjets: ['Projet BM', 'Projet UE', 'Audit Bailleur', 'Reforme Sectorielle'],
    programmes: ['BEST', 'PADAES'],
    departements: [],
    scopeDirections: ['CPBM_UE'],
    scopeProgrammes: ['CPBM_UE', 'BEST', 'PADAES'],
  },
  {
    code: 'CC26',
    label: 'Coordination Compact 2026 (MCA)',
    shortLabel: 'CC26 / MCA',
    niveau: 1,
    domaine: ['mca', 'compact', 'acces_universel', 'reforme'],
    typesProjets: ['Projet MCA', 'Accès Universel', 'Transport MCA', 'Réforme Institutionnelle'],
    programmes: ['Compact2026'],
    departements: [],
    scopeDirections: ['CC26'],
    scopeProgrammes: ['CC26', 'Compact2026'],
  },
  {
    code: 'CPAMACEL_EE',
    label: 'Coordination PAMACEL & Efficacité Énergétique',
    shortLabel: 'CPAMACEL & EE',
    niveau: 1,
    // Cellule de coordination : son périmètre est défini par son PROGRAMME
    // (PAMACEL), PAS par le domaine « distribution » — sinon elle verrait à tort
    // TOUS les projets DPD (distribution). On retire donc le domaine large.
    domaine: ['pamacel', 'efficacite_energetique'],
    typesProjets: ['PAMACEL', 'Efficacité Énergétique', 'Accès Électricité'],
    programmes: ['PAMACEL'],
    departements: [],
    scopeDirections: ['CPAMACEL_EE'],
    scopeProgrammes: ['CPAMACEL_EE', 'PAMACEL'],
  },
  {
    code: 'CPADERAU',
    label: "Coordination Programme PADERAU (AFD/BEI)",
    shortLabel: 'CPADERAU',
    niveau: 1,
    // Cellule de coordination : périmètre défini par son PROGRAMME (PADERAU),
    // PAS par le domaine « distribution » (sinon elle verrait tous les projets DPD).
    domaine: ['paderau'],
    typesProjets: ['Électrification Rurale', 'Accès Universel', 'Mini-réseau Solaire', 'PADERAU'],
    programmes: ['PADERAU'],
    departements: [],
    scopeDirections: ['CPADERAU'],
    scopeProgrammes: ['CPADERAU', 'PADERAU'],
  },
  {
    code: 'CSE',
    label: 'Cellule Suivi & Évaluation — DPE',
    shortLabel: 'CSE',
    niveau: 1,
    domaine: ['*'],
    typesProjets: ['*'],
    programmes: ['*'],
    departements: [],
    scopeDirections: ['*'],
    scopeProgrammes: ['*'],
  },
];

// ─────────────────────────────────────────────────────────────────────────────
// HELPERS
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Clé canonique d'un code direction — insensible aux caractères de séparation.
 * Strip espaces, tirets, underscores, « & »… puis MAJUSCULES.
 * Ainsi « CPBM - UE », « CPBM-UE », « CPBM_UE », « CPBMUE » → « CPBMUE »
 * et « CPAMACEL&EE », « CPAMACEL & EE », « CPAMACEL_EE » → « CPAMACELEE ».
 */
export function canonDirectionKey(code: string): string {
  return (code || '').toUpperCase().replace(/[^A-Z0-9]/g, '');
}

/** Alias RH/legacy → clé canonique (variantes qui ne se réduisent pas trivialement) */
const DIR_CANON_ALIASES: Record<string, string> = {
  CPAMACEL: 'CPAMACELEE', // « CPAMACEL » seul → Coordination PAMACEL & EE
};

/** Retourne la direction/coordination par code — harmonisé, insensible aux caractères */
export function getDirectionOrg(code: string): DirectionCoordination | undefined {
  if (!code) return undefined;
  let key = canonDirectionKey(code);
  key = DIR_CANON_ALIASES[key] ?? key;
  return DPE_ORG.find(d => canonDirectionKey(d.code) === key || canonDirectionKey(d.shortLabel) === key);
}

/** Vérifie si un projet (par son unité/programme/domaine) est visible pour une direction */
export function isProjectVisibleForDirection(
  projectUnit: string | undefined,
  projectProgramme: string | undefined,
  projectDomaine: string | undefined,
  userDirection: string,
): boolean {
  // Super-rôles wildcard (harmonisé : « EM DPE », « EM_DPE », « CSE »…)
  const uk = canonDirectionKey(userDirection);
  if (uk === 'EMDPE' || uk === 'CSE' || uk === 'ADMIN') return true;

  const dir = getDirectionOrg(userDirection);
  if (!dir) return false;

  // Scope wildcard
  if (dir.scopeDirections.includes('*') || dir.scopeProgrammes.includes('*')) return true;

  const u = projectUnit ?? '';
  const p = projectProgramme ?? '';
  const d = projectDomaine ?? '';

  // Vérification par unité / programme
  const unitMatch = dir.scopeProgrammes.some(sp =>
    u.toUpperCase().includes(sp.toUpperCase()) ||
    p.toUpperCase().includes(sp.toUpperCase())
  );
  if (unitMatch) return true;

  // Vérification par domaine
  const domainMatch = dir.domaine.includes('*') || dir.domaine.some(dom =>
    d.toLowerCase().includes(dom.toLowerCase()) ||
    u.toLowerCase().includes(dom.toLowerCase())
  );
  if (domainMatch) return true;

  return false;
}

/** Labels lisibles pour les départements — désormais dynamique via orgConfigStore */
export function getDepartementLabel(code: string): string {
  // Lazy import pour éviter les cycles et le SSR
  const { useOrgConfig } = require('./orgConfigStore') as typeof import('./orgConfigStore');
  const d = useOrgConfig.getState().departements.find(x => x.code === code);
  if (d) return d.label;
  // Fallback statique si store pas encore initialisé
  const staticLabels: Record<string, string> = {
    'DEP_PEC': 'PEC — Énergies Conventionnelles',
    'DEP_PER': 'PER — Énergies Renouvelables',
    'DPT_TRANSPORT': 'DPT — Projets Transport',
    'DPD_DISTRIBUTION': 'DPD — Projets Distribution',
    'DGC_ETUDES': 'Études & Immobilisations',
    'DGC_INVEST': 'Projets d\'Investissement',
    'DIT_SMARTGRID': 'Smartgrid & Stockage',
    'DIT_COMMERCIAL': 'Technologies Commerciales',
  };
  return staticLabels[code] ?? code;
}

/** Liste de toutes les directions pour dropdown / sélection */
export const DIRECTION_CODES = DPE_ORG.map(d => d.code);

/** Domaines métier consolidés par direction (pour filtres UI) */
export function getDomainesForDirection(directionCode: string): string[] {
  const dir = getDirectionOrg(directionCode);
  return dir ? dir.domaine.filter(d => d !== '*') : [];
}

/** Types de projets possibles pour une direction (pour filtres UI) */
export function getTypesProjetsForDirection(directionCode: string): string[] {
  const dir = getDirectionOrg(directionCode);
  return dir ? dir.typesProjets.filter(t => t !== '*') : [];
}

// ─────────────────────────────────────────────────────────────────────────────
// MAPPINGS DE RATTACHEMENT — unité projet ↔ direction ↔ département
// Source : organigramme officiel ND 005/2023.
// Le code « unité » porté par un projet (champ Projet.unite) identifie son
// rattachement organisationnel concret (ex : 'DPT', 'DPD', 'DEP', 'DIT'…).
// ─────────────────────────────────────────────────────────────────────────────

/** Unité projet (NIVEAU 1/2) → direction parente (NIVEAU 1) */
export const UNITE_TO_DIRECTION: Record<string, string> = {
  EM_DPE: 'EM_DPE',
  DER: 'DER', DPT: 'DER', DPD: 'DER',
  DEP: 'DEP', DEP_PEC: 'DEP', DEP_PER: 'DEP',
  DIT: 'DIT', DSSE: 'DIT', DEPC: 'DIT',
  DGC: 'DGC',
  CPBM_UE: 'CPBM_UE', CC26: 'CC26',
  CPAMACEL_EE: 'CPAMACEL_EE', CPADERAU: 'CPADERAU', CSE: 'CSE',
};

/** Département (NIVEAU 2) → unités projet qui en relèvent */
export const DEPT_TO_UNITES: Record<string, string[]> = {
  DPT_TRANSPORT:    ['DPT'],
  DPD_DISTRIBUTION: ['DPD'],
  DEP_PEC:          ['DEP'],
  DEP_PER:          ['DEP'],
  DIT_SMARTGRID:    ['DIT', 'DSSE'],
  DIT_COMMERCIAL:   ['DIT', 'DEPC'],
  DGC_ETUDES:       ['DGC'],
  DGC_INVEST:       ['DGC'],
};

/** Unités projet enfants d'une direction (ex : 'DER' → ['DER','DPT','DPD']) */
export function unitesForDirection(dirCode: string): string[] {
  const key = canonDirectionKey(dirCode);
  const children = Object.entries(UNITE_TO_DIRECTION)
    .filter(([, parent]) => canonDirectionKey(parent) === key)
    .map(([u]) => u);
  return children.length ? children : [dirCode];
}

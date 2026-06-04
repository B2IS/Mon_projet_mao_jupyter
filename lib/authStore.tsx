'use client';
/**
 * authStore.tsx — Système RBAC SIGEPP-DPE SENELEC
 * Chaque rôle accède uniquement aux vues pertinentes à sa mission,
 * comme dans Primavera P6 ou MS Project Server.
 */

import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { PERSONNEL_DPE, agentToTestUser } from './dpePersonnel';
import { PROFILS_DPE_OFFICIELS } from './profilsDPEOfficiels';
import { usePasswordPolicyStore } from './passwordPolicyStore';
import {
  computeVisibilityScope,
  type VisibilityScope,
  type UserOrgProfile,
} from './accessEngine';

// ─────────────────────────────────────────────────────────────────────────────
// RÔLES
// ─────────────────────────────────────────────────────────────────────────────

export type RoleCode =
  | 'DIR_DPE'    // Directeur Principal Équipement — vision stratégique portefeuille
  | 'PMO'        // PMO / Bureau Pilotage — multi-projets, EVM, reporting
  | 'CHEF_PROJ'  // Chef de Projet — pilotage opérationnel de son projet
  | 'CHEF_DEPT'  // Chef de Département / Service / Unité — projets de son unité
  | 'INGENIEUR'  // Ingénieur, Dessinateur, Cartographe — études et conception
  | 'EXPERT'     // Expert technique / gestion de projet — expertise sectorielle
  | 'CONTROLEUR' // Contrôleur de projet — contrôle qualité / performance
  | 'CHARGE'     // Chargé de mission / suivi — missions transversales
  | 'ASSISTANT'  // Assistant / Assistante — support administratif et projet
  | 'SECRETAIRE' // Secrétaire / Archiviste — secrétariat et documentation
  | 'CHAUFFEUR'  // Chauffeur / UAGL — logistique et transport
  | 'CTRL_FIN'   // Contrôleur Financier / Comptable — budget, marchés, paiements
  | 'RESP_LOG'   // Responsable UAGL — ODM, flotte, missions terrain
  // ── Fonctions dédiées (MMH) ──
  | 'MARCHES'            // Passation des marchés — DAO/DRPO/AO/contrats/avenants/décomptes
  | 'SIG'               // SIG / Géomatique — cartographie, réseaux, actifs géolocalisés (sans finances)
  | 'IMMO'              // Immobilisations — actifs, capitalisation, MES, amortissements (sans tâches projet)
  | 'AUDIT'             // Audit — lecture seule globale + historique complet
  | 'CONTROLEUR_TRAVAUX' // Contrôleur de travaux — terrain/contrôles/réceptions/NC (sans finances/marchés)
  | 'ADMIN';     // Administrateur Système DPE — accès complet

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

// ─────────────────────────────────────────────────────────────────────────────
// COMPTES DE TEST
// ─────────────────────────────────────────────────────────────────────────────

export interface TestUser {
  id: string;
  nom: string;
  prenom: string;
  email: string;
  password: string;
  role: RoleCode;
  direction: string;
  departement?: string;      // Département/service au sein de la direction (ex: DPT, DPD, DEP_PEC…)
  cellule?: string;           // Cellule de coordination (ex: CSE, CC26…)
  initials: string;
  avatarColor: string;
  projetsAssignes?: string[];
  poste?: string;           // Poste occupé affiché dans le login (si fourni, remplace le label de rôle)
}

// ─────────────────────────────────────────────────────────────────────────────
// UNITÉS DPE — Selon Note de Direction 005/2023 (Organisation officielle DPE)
// ─────────────────────────────────────────────────────────────────────────────
// Organisation officielle DPE — effectif réel 201 agents (Fichier personnel au 10/03/2026)
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

// Effectif consolidé DPE (source : Fichier du personnel DPE au 10/03/2026)
export const DPE_EFFECTIF = {
  total: 201,
  parCollege: { Cadre: 93, Maitrise: 78, Executif: 30 },
  parSexe:    { Hommes: 140, Femmes: 61 },
} as const;

/** Labels statiques fallback — codes canoniques uniquement (les variantes RH sont normalisées par normalizeDirectionCode) */
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

/** Normalise un code direction — strip tous les caractères non-alphanumériques puis map vers canonique */
export function normalizeDirectionCode(code: string): string {
  const c = code.trim().toUpperCase().replace(/[^A-Z0-9]/g, ''); // strip espace, -, _, &, etc.
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
  return aliases[c] ?? code.trim().toUpperCase(); // fallback: retourne tel quel
}

export function getDirectionLabel(code: string): string {
  const canonical = normalizeDirectionCode(code);
  // Lecture dynamique via le store organisationnel
  try {
    const { useOrgConfig } = require('./orgConfigStore') as typeof import('./orgConfigStore');
    const d = useOrgConfig.getState().directions.find(
      x => x.code === canonical || x.shortLabel === canonical
    );
    if (d) return d.label;
  } catch { /* SSR / cycle */ }
  return DIRECTION_LABELS[canonical] ?? code;
}

/** Calcule le périmètre de visibilité d'un utilisateur via le moteur d'accès intelligent.
 *  Remplace l'ancien DIRECTION_TO_UNITES (legacy) — utilise computeVisibilityScope pour
 *  un scope hiérarchique complet (directions, départements, programmes, domaines, types). */
export function getUserScope(user: TestUser | null): VisibilityScope {
  if (!user) return { niveau: 3, directions: [], departements: [], unites: [], programmes: [], domaines: [], typesProjets: [], all: false };

  // Surcharge admin éventuelle (direction affectée + niveau de vue) configurée
  // via la console d'administration (permissionStore.roleScopes[role]).
  let direction = normalizeDirectionCode(user.direction);
  let override: { niveau?: 0 | 1 | 2 | 3 } | undefined;
  try {
    const { usePermissionStore } = require('./permissionStore') as typeof import('./permissionStore');
    const sc = usePermissionStore.getState().scopeFor(user.role);
    if (sc?.direction) direction = normalizeDirectionCode(sc.direction);
    if (sc?.niveau != null) override = { niveau: sc.niveau };
  } catch { /* SSR / store non initialisé → périmètre par défaut */ }

  const profile: UserOrgProfile = {
    role: user.role,
    direction,
    departement: user.departement,
    cellule: user.cellule,
    poste: user.poste,
    fonction: undefined,
  };
  return computeVisibilityScope(profile, override);
}

/**
 * Comptes de démonstration FIABLES — un par rôle, email stable @dpe.sn,
 * mot de passe « dpe2026 ». Garantit que les profils de test fonctionnent
 * toujours et avec le BON rôle/périmètre (les emails générés @senelec.sn
 * restent disponibles en complément).
 */
export const DEMO_ACCOUNTS: TestUser[] = [
  { id: 'demo_dir',      prenom: 'Djiby',       nom: 'DIENG',    email: 'directeur@dpe.sn',  password: 'dpe2026', role: 'DIR_DPE',    direction: 'EM_DPE', poste: 'Directeur Principal Équipement',          initials: 'DD', avatarColor: '#3D1A6B' },
  { id: 'demo_pmo',      prenom: 'Mapenda',     nom: 'FAYE',     email: 'pmo@dpe.sn',        password: 'dpe2026', role: 'PMO',        direction: 'CSE', cellule: 'CSE', poste: 'Chef de Cellule Suivi-Évaluation / CSE', initials: 'MF', avatarColor: '#7C3AED' },
  { id: 'demo_chefdept', prenom: 'Modou',       nom: 'NDIAYE',   email: 'chef.dept@dpe.sn',  password: 'dpe2026', role: 'CHEF_DEPT',  direction: 'DER', departement: 'DPD_DISTRIBUTION', poste: 'Chef de Département / DPD', initials: 'MN', avatarColor: '#0F766E' },
  { id: 'demo_chefproj', prenom: 'Maodo',       nom: 'SENE',     email: 'chef.projet@dpe.sn',password: 'dpe2026', role: 'CHEF_PROJ',  direction: 'DER', departement: 'DPD_DISTRIBUTION', poste: 'Chef de Projet / DPD',     initials: 'MS', avatarColor: '#1D4ED8' },
  { id: 'demo_ing',      prenom: 'Cheikh',      nom: 'FALL',     email: 'ingenieur@dpe.sn',  password: 'dpe2026', role: 'INGENIEUR',  direction: 'DER', departement: 'DPT_TRANSPORT',    poste: 'Ingénieur d\'Étude / DPT', initials: 'CF', avatarColor: '#2563EB' },
  { id: 'demo_expert',   prenom: 'Margot',      nom: 'LY',       email: 'expert@dpe.sn',     password: 'dpe2026', role: 'EXPERT',     direction: 'CSE', cellule: 'CSE', poste: 'Expert en Gestion de Projet / CSE', initials: 'ML', avatarColor: '#7C3AED' },
  { id: 'demo_ctrl',     prenom: 'Ngalandou',   nom: 'BADIANE',  email: 'controleur@dpe.sn', password: 'dpe2026', role: 'CONTROLEUR', direction: 'DER', departement: 'DPT_TRANSPORT',    poste: 'Contrôleur de Projet / DPT', initials: 'NB', avatarColor: '#D97706' },
  { id: 'demo_charge',   prenom: 'Khadidiatou', nom: 'BODIAN',   email: 'charge@dpe.sn',     password: 'dpe2026', role: 'CHARGE',     direction: 'CPBM_UE', poste: 'Chargé en Suivi Social / CPBM-UE', initials: 'KB', avatarColor: '#059669' },
  { id: 'demo_fin',      prenom: 'Yacine',      nom: 'GUEYE',    email: 'finance@dpe.sn',    password: 'dpe2026', role: 'CTRL_FIN',   direction: 'CPBM_UE', poste: 'Comptable / CPBM-UE',      initials: 'YG', avatarColor: '#B45309' },
  { id: 'demo_log',      prenom: 'Geneviève',   nom: 'SAGNA',    email: 'uagl@dpe.sn',       password: 'dpe2026', role: 'RESP_LOG',   direction: 'DER', departement: 'DPD_DISTRIBUTION', poste: 'Chef UAGL / DPD',         initials: 'GS', avatarColor: '#0891B2' },
  { id: 'demo_assist',   prenom: 'Sokhna',      nom: 'CISSE',    email: 'assistant@dpe.sn',  password: 'dpe2026', role: 'ASSISTANT',  direction: 'DER', poste: 'Assistante de Direction / DER', initials: 'SC', avatarColor: '#4B5563' },
  { id: 'demo_sec',      prenom: 'Awa',         nom: 'DIAKHATE', email: 'secretaire@dpe.sn', password: 'dpe2026', role: 'SECRETAIRE', direction: 'DGC', poste: 'Secrétaire / DET&GI',      initials: 'AD', avatarColor: '#8B5CF6' },
  { id: 'demo_chauf',    prenom: 'Demba',       nom: 'BA',       email: 'chauffeur@dpe.sn',  password: 'dpe2026', role: 'CHAUFFEUR',  direction: 'DER', departement: 'DPD_DISTRIBUTION', poste: 'Chauffeur / DPD',         initials: 'DB', avatarColor: '#0891B2' },
  { id: 'demo_admin',    prenom: 'Maodo',       nom: 'SENE',     email: 'admin@dpe.sn',      password: 'dpe2026', role: 'ADMIN',      direction: 'EM_DPE', poste: 'Administrateur Système SIGEPP',          initials: 'MS', avatarColor: '#374151' },

  // ── Couverture organisationnelle complète — un chef par direction/département ──
  // Chaque compte est STRICTEMENT scopé à son périmètre (département → vision stricte ;
  // coordination → vision programme/bailleur). Permet de tester l'isolation des données :
  // un chef DPD (distribution) ne voit JAMAIS Production / Transport / Commercial.
  { id: 'demo_dep_pec',  prenom: 'Ibrahima',         nom: 'DIOP',    email: 'chef.pec@dpe.sn',       password: 'dpe2026', role: 'CHEF_DEPT', direction: 'DEP',  departement: 'DEP_PEC',       poste: 'Chef de Département Projets Énergies Conventionnelles / DPEC', initials: 'ID', avatarColor: '#B91C1C' },
  { id: 'demo_dep_per',  prenom: 'Papa Macodou',     nom: 'SALL',    email: 'chef.per@dpe.sn',       password: 'dpe2026', role: 'CHEF_DEPT', direction: 'DEP',  departement: 'DEP_PER',       poste: 'Chef de Département Projets Énergies Renouvelables / DPER',    initials: 'PS', avatarColor: '#16A34A' },
  { id: 'demo_dpt',      prenom: 'Ngagne',           nom: 'DIOP',    email: 'chef.transport@dpe.sn', password: 'dpe2026', role: 'CHEF_DEPT', direction: 'DER',  departement: 'DPT_TRANSPORT', poste: 'Chef Département Projets Transport / DPT',   initials: 'ND', avatarColor: '#0369A1' },
  { id: 'demo_dit',      prenom: 'Ndatté',           nom: 'SY',      email: 'chef.commercial@dpe.sn',password: 'dpe2026', role: 'CHEF_DEPT', direction: 'DIT',  departement: 'DIT_COMMERCIAL',poste: 'Chef Département Projets Commercial / DIT',  initials: 'NS', avatarColor: '#7C3AED' },
  { id: 'demo_dgc_et',   prenom: 'Mamadou',          nom: 'NIASSE',  email: 'chef.etudes@dpe.sn',    password: 'dpe2026', role: 'CHEF_DEPT', direction: 'DGC',  departement: 'DGC_ETUDES',    poste: 'Chef Département Études Techniques & Gestion des Immobilisations / DET&GI', initials: 'MN', avatarColor: '#0F766E' },
  { id: 'demo_dgc_inv',  prenom: 'Mouhamed',         nom: 'NDOYE',   email: 'chef.invest@dpe.sn',    password: 'dpe2026', role: 'CHEF_DEPT', direction: 'DGC',  departement: 'DGC_INVEST',    poste: 'Chef Département Projets d\'Investissement / DPI', initials: 'MN', avatarColor: '#047857' },
  { id: 'demo_cc26',     prenom: 'Serigne Ibrahima', nom: 'MBAYE',   email: 'coord.cc26@dpe.sn',     password: 'dpe2026', role: 'CHEF_DEPT', direction: 'CC26', cellule: 'CC26',              poste: 'Coordinateur Compact 2026 (MCA)',           initials: 'SM', avatarColor: '#EA580C' },
  { id: 'demo_cpbm',     prenom: 'Issa',             nom: 'NIANG',   email: 'coord.bmue@dpe.sn',     password: 'dpe2026', role: 'CHEF_DEPT', direction: 'CPBM_UE',                            poste: 'Coordinateur des Programmes BM-UE',         initials: 'IN', avatarColor: '#1D4ED8' },
  { id: 'demo_cpamacel', prenom: 'Thierno Alia',     nom: 'MBENGUE', email: 'coord.pamacel@dpe.sn',  password: 'dpe2026', role: 'CHEF_DEPT', direction: 'CPAMACEL_EE',                        poste: 'Chef de Cellule CPAMACEL & EE',             initials: 'TM', avatarColor: '#0891B2' },
  { id: 'demo_cpaderau', prenom: 'Ngor',             nom: 'SENE',    email: 'coord.paderau@dpe.sn',  password: 'dpe2026', role: 'CHEF_DEPT', direction: 'CPADERAU',                           poste: 'Chef de Cellule CPADERAU',                  initials: 'NS', avatarColor: '#65A30D' },
];

const GENERATED_USERS: TestUser[] = PERSONNEL_DPE.map((agent, i) => {
  const user = agentToTestUser(agent, i);
  return {
    ...user,
    role: user.role as RoleCode,
    // Pas d'affectation arbitraire : la visibilité projet d'un chef de projet
    // découle de l'implication réelle (chefProjet === nom OU membre d'équipe OU
    // projetsAssignes explicite). Cf. règle ND 005/2023 dans projectStore.
    projetsAssignes: undefined,
  } as TestUser;
});

// Comptes de démo FIABLES en tête (recherche par 1ère correspondance), puis TOUS les profils
// de l'organigramme officiel DPE (ND 005/2023), puis le personnel réel généré.
export const TEST_USERS: TestUser[] = [...DEMO_ACCOUNTS, ...PROFILS_DPE_OFFICIELS, ...GENERATED_USERS];

// ─────────────────────────────────────────────────────────────────────────────
// PERMISSIONS GRANULAIRES PAR RÔLE
// Principe Primavera P6 : chaque rôle ne voit que ce qui concerne sa mission
// ─────────────────────────────────────────────────────────────────────────────

export type SidebarSectionId =
  | 'accueil'
  | 'portefeuille'
  | 'mes_projets'
  | 'execution' // This was already in the type, no change needed here.
  | 'finances'
  | 'logistique'
  | 'transverses'
  | 'parametrage';

// ─────────────────────────────────────────────────────────────────────────────
// MODULES PERTINENTS PAR PROFIL (cf. MASTER PROMPT — Module 1 cockpits & 18 modules)
// Chaque profil ne voit QUE les modules de sa mission ; la visibilité des DONNÉES
// (unité + sous-unités, jamais les unités parallèles) est appliquée en plus par
// computeVisibilityScope / canAccessSection (organigramme DPE).
//
//  Profil (prompt)      Rôle app    Modules pertinents
//  ───────────────────  ──────────  ─────────────────────────────────────────────
//  DG / Directeur DPE   DIR_DPE     Gouvernance · Portefeuille · Programmes · Projets(vue)
//                                   · Finances(synthèse) · S&E/KPI · Reporting · BI · IA · Workflows
//  Directeur/Chef Dépt  CHEF_DEPT   Portefeuille unité · Projets · Planning/WBS · Exécution
//                                   · Finances · Marchés · S&E · GED · Reporting · IA
//  Chef de Projet       CHEF_PROJ   Mes Projets · Planning/WBS/Gantt · Terrain · Risques
//                                   · Budget/EVM · Marchés · BOQ/Décomptes · Réceptions · GED · Migration IA
//  Finance / Marchés    CTRL_FIN    Budget · Décaissements · EVM · Cashflow · Marchés · BOQ
//                                   · Réceptions · Immobilisations · Fournisseurs · Reporting fin.
//  UAGL                 RESP_LOG    ODM · Flotte · Chauffeurs · RH log. · Réceptions · Marchés
//  S&E (CSE)            PMO/EXPERT  KPI · Cadre logique · Santé portefeuille · Reporting · Audit · BI
//  Ingénieur/Études     INGENIEUR   Projets · WBS · Études · Terrain · SIG · GED · Migration IA
//  Contrôleur projet    CONTROLEUR  = ÉQUIPE du Chef de Projet : MÊME périmètre projet (planning,
//                                   terrain, risques, budget/EVM, marchés, BOQ, réceptions, GED) — contrôle ; édition validée par le chef
//  Assistant chef proj. ASSISTANT   = ÉQUIPE du Chef de Projet : MÊME périmètre projet + courriers ;
//                                   édition soumise à la validation du Chef de Projet
//  Chargé de mission    CHARGE      Projets · S&E · Risques(social/env) · Reporting
//  Secrétaire           SECRETAIRE  GED · Courriers · Reporting · Parapheur
//  Chauffeur            CHAUFFEUR   ODM(ses missions) · Flotte
//  Administrateur       ADMIN       Tous les modules + Paramétrage
//  + universels (tous) : Réservation salle · Suivi temps · Pointage · IA (Agents IA + Copilot)
//  + Migration IA RÉSERVÉE : Chef de Projet · Chef de Département · Ingénieurs · Chefs de Cellule (PMO)
// ─────────────────────────────────────────────────────────────────────────────

// Sections visibles par rôle — hiérarchie ascendante :
// RESP_LOG → CTRL_FIN → CHEF_PROJ → CHEF_DEPT → PMO → DIR_DPE
// Règle : le Chef de Projet NE voit PAS le Portefeuille stratégique (réservé Directeur/PMO)
export const ROLE_SECTIONS: Record<RoleCode, SidebarSectionId[]> = {
  DIR_DPE:   ['accueil', 'portefeuille', 'finances', 'transverses'],
  PMO:       ['accueil', 'portefeuille', 'execution', 'finances', 'transverses'],
  CHEF_DEPT: ['accueil', 'portefeuille', 'execution', 'finances', 'transverses'],
  CHEF_PROJ: ['accueil', 'mes_projets', 'execution', 'finances', 'transverses'],
  INGENIEUR: ['accueil', 'mes_projets', 'execution', 'transverses'],
  EXPERT:    ['accueil', 'portefeuille', 'mes_projets', 'execution', 'transverses'],
  CONTROLEUR:['accueil', 'mes_projets', 'execution', 'finances', 'transverses'],  // équipe chef de projet
  CHARGE:    ['accueil', 'mes_projets', 'execution', 'transverses'],
  ASSISTANT: ['accueil', 'mes_projets', 'execution', 'logistique', 'transverses'],  // Projets/Exécution réservés à l'assistant CHEF DE PROJET (ABAC poste) ; l'assistante de direction = support admin (courriers, agenda/réunions, GED, workflow)
  SECRETAIRE:['accueil', 'logistique', 'transverses'],    // admin département : courriers, réunions, GED — PAS de gestion de projet
  CHAUFFEUR: ['accueil', 'logistique'],                                     // portail ULTRA-SIMPLE : mes missions · mon véhicule · réservation · pointage (aucun module métier/IA)
  CTRL_FIN:  ['accueil', 'finances', 'transverses'],
  RESP_LOG:  ['accueil', 'logistique', 'finances', 'transverses'],  // UAGL : logistique + patrimoine/réceptions + courriers/GED
  MARCHES:   ['accueil', 'finances', 'transverses'],                       // DAO/AO/contrats/décomptes
  SIG:       ['accueil', 'execution', 'transverses'],                      // cartographie/réseaux/actifs
  IMMO:      ['accueil', 'finances', 'transverses'],                       // immobilisations/amortissements
  AUDIT:     ['accueil', 'portefeuille', 'execution', 'finances', 'logistique', 'transverses'], // tout en lecture
  CONTROLEUR_TRAVAUX: ['accueil', 'mes_projets', 'execution', 'transverses'], // terrain/contrôles/réceptions
  ADMIN:     ['accueil', 'portefeuille', 'mes_projets', 'execution', 'finances', 'logistique', 'transverses', 'parametrage'],
};

/** Sections visibles par direction (filtre métier hiérarchique — intersection avec ROLE_SECTIONS) */
// NB : 'logistique' est incluse pour TOUTES les directions afin que les profils SUPPORT
// (UAGL, assistante de direction, secrétaire, chauffeur) — quelle que soit leur direction —
// atteignent Réservation de salle / Réunions / Pointage. Le rôle reste autoritaire
// (ROLE_SECTIONS) : un Directeur/PMO/Chef de projet n'a PAS 'logistique'.
const S_DIR_BASE: SidebarSectionId[] = ['accueil', 'portefeuille', 'mes_projets', 'execution', 'finances', 'logistique', 'transverses'];

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

// ── Routes autorisées par rôle ──
// Factorisées par groupes récurrents pour éviter la duplication
const R_TBL    = '/tableau-de-bord';
const R_PORT   = ['/portefeuille', '/programmes'];
const R_PROJ   = ['/projets', '/cockpit-projet', '/gantt', '/gestion-projet'];
const R_WBS    = ['/wbs', '/taches'];
const R_EXEC   = ['/suivi-evaluation', '/terrain', '/risques'];
const R_CARTO  = ['/cartographie'];
const R_FIN    = ['/budget', '/evm', '/marches', '/fournisseurs', '/immobilisations'];
const R_RPT    = ['/reporting', '/workflows'];
const R_STUDIO = ['/analytique', '/studio-rapports', '/agents-ia', '/constructeur-indicateurs'];
const R_GED    = ['/ged'];
const R_LOG    = ['/odm', '/flotte', '/rh'];

// ── Équipe PROJET du Chef de Projet ──
// Le Contrôleur de projet et l'Assistant assistent le Chef de Projet sur SES projets :
// ils partagent le MÊME périmètre de modules projet (planning, WBS, terrain, risques,
// budget/EVM, marchés, BOQ/décomptes, réceptions, GED, reporting). L'ÉDITION reste
// soumise à la validation du Chef de Projet (cf. règle d'habilitation d'édition).
const R_CHEF_TEAM = [
  R_TBL, ...R_PROJ, ...R_WBS, '/suivi-evaluation', ...R_EXEC.slice(1), ...R_CARTO,
  ...R_FIN, '/bordereaux', '/receptions', ...R_GED, ...R_RPT,
];

export const ROLE_ROUTES: Record<RoleCode, string[]> = {
  DIR_DPE:   [R_TBL, ...R_PORT, ...R_PROJ, '/suivi-evaluation', ...R_FIN.slice(0,2), ...R_STUDIO, '/workflows', '/dashboard-builder'],
  PMO:       [R_TBL, ...R_PORT, ...R_PROJ, ...R_WBS, '/suivi-evaluation', ...R_EXEC.slice(1), ...R_CARTO, ...R_FIN.slice(0,2), ...R_STUDIO, ...R_GED, '/workflows'],
  CHEF_DEPT: [R_TBL, ...R_PORT, ...R_PROJ, ...R_WBS, '/suivi-evaluation', ...R_EXEC.slice(1), ...R_CARTO, ...R_FIN, ...R_STUDIO, ...R_GED, '/workflows'],
  CHEF_PROJ: [...R_CHEF_TEAM, '/migration', '/agents-ia'],
  INGENIEUR: [R_TBL, ...R_PROJ, ...R_WBS, '/migration', '/suivi-evaluation', '/terrain', ...R_CARTO, ...R_GED, '/workflows'],
  EXPERT:    [R_TBL, ...R_PORT.slice(0,1), ...R_PROJ, '/suivi-evaluation', ...R_EXEC.slice(1), ...R_CARTO, '/agents-ia', ...R_GED, '/workflows', '/reporting'],
  CONTROLEUR:[...R_CHEF_TEAM, '/agents-ia'],   // équipe du chef de projet : même périmètre, contrôle
  CHARGE:    [R_TBL, ...R_PROJ, '/suivi-evaluation', ...R_EXEC.slice(1,3), ...R_RPT],
  // ASSISTANT : périmètre partagé ; la distinction Assistant CHEF DE PROJET (détail projet)
  // vs Assistante de DIRECTION (admin) est faite par POSTE (ABAC) — cf. isAssistantProjet().
  ASSISTANT: [R_TBL, ...R_PROJ, ...R_WBS, '/suivi-evaluation', '/terrain', ...R_CARTO, ...R_GED, '/courriers', '/reservation-salle', ...R_RPT],
  SECRETAIRE:[R_TBL, ...R_GED, '/courriers', '/reservation-salle', ...R_RPT],
  CHAUFFEUR: [R_TBL, '/odm', '/flotte'],
  CTRL_FIN:  [R_TBL, ...R_FIN, '/bordereaux', '/receptions', ...R_STUDIO.slice(0,2), ...R_RPT],
  RESP_LOG:  [R_TBL, ...R_LOG, '/reservation-salle', '/receptions', '/immobilisations', '/courriers', ...R_GED, '/reporting'],
  MARCHES:   [R_TBL, '/marches', '/bordereaux', '/receptions', '/fournisseurs', ...R_GED, ...R_RPT],
  SIG:       [R_TBL, ...R_CARTO, '/projets', ...R_GED],
  IMMO:      [R_TBL, '/immobilisations', ...R_GED, ...R_RPT],
  AUDIT:     ['*'],   // lecture seule globale (écriture bloquée par niveau + canPerformAction)
  CONTROLEUR_TRAVAUX: [R_TBL, '/projets', '/cockpit-projet', '/terrain', '/risques', '/receptions', ...R_CARTO, ...R_GED, ...R_RPT],
  ADMIN:     ['*'],
};

// Items individuels autorisés par rôle dans chaque section (factorisés)
export const ROLE_NAV_ITEMS: Record<RoleCode, string[]> = {
  // Directeur DPE : vue PHASES/JALONS (Gantt + cockpit), PAS le module de gestion détaillé (tâches/ressources).
  DIR_DPE:   [R_TBL, ...R_PORT, '/cockpit-projet', '/gantt', '/suivi-evaluation', ...R_FIN.slice(0,2), '/fournisseurs', ...R_STUDIO, ...R_RPT, '/dashboard-builder', '/courriers', '/workflows'],
  PMO:       [R_TBL, ...R_PORT, ...R_PROJ, ...R_WBS, '/suivi-evaluation', ...R_EXEC.slice(1), ...R_CARTO, ...R_FIN.slice(0,2), '/fournisseurs', ...R_STUDIO, ...R_GED, ...R_RPT, '/courriers', '/workflows'],
  CHEF_DEPT: [R_TBL, ...R_PORT, ...R_PROJ, ...R_WBS, '/suivi-evaluation', ...R_EXEC.slice(1), ...R_CARTO, ...R_FIN, ...R_STUDIO, ...R_GED, ...R_RPT, '/courriers', '/workflows'],
  CHEF_PROJ: [...R_CHEF_TEAM, '/migration', '/agents-ia', '/courriers', '/workflows'],
  INGENIEUR: [R_TBL, ...R_PROJ, ...R_WBS, '/migration', '/terrain', ...R_CARTO, ...R_GED, '/workflows', '/courriers'],
  EXPERT:    [R_TBL, ...R_PORT.slice(0,1), ...R_PROJ, '/suivi-evaluation', ...R_EXEC.slice(1), ...R_CARTO, '/agents-ia', ...R_GED, '/workflows', '/courriers', '/reporting'],
  CONTROLEUR:[...R_CHEF_TEAM, '/agents-ia', '/courriers', '/workflows'],   // équipe du chef de projet : même périmètre, contrôle
  CHARGE:    [R_TBL, ...R_PROJ, '/suivi-evaluation', ...R_EXEC.slice(1,3), ...R_RPT, '/courriers', '/workflows'],
  ASSISTANT: [R_TBL, ...R_PROJ, ...R_WBS, '/suivi-evaluation', '/terrain', ...R_CARTO, ...R_GED, '/courriers', '/reservation-salle', ...R_RPT, '/workflows'], // détail projet/KPI/carto filtrés par poste (ABAC) — base = support admin
  SECRETAIRE:[R_TBL, ...R_GED, '/courriers', '/reservation-salle', ...R_RPT, '/workflows'], // /projets EN LECTURE (liste/statuts)
  MARCHES:   [R_TBL, '/marches', '/bordereaux', '/receptions', '/fournisseurs', ...R_GED, ...R_RPT, '/courriers', '/workflows'],
  SIG:       [R_TBL, ...R_CARTO, '/projets', ...R_GED, '/courriers', '/workflows'],
  IMMO:      [R_TBL, '/immobilisations', ...R_GED, ...R_RPT, '/courriers', '/workflows'],
  AUDIT:     ['*'],
  CONTROLEUR_TRAVAUX: [R_TBL, '/projets', '/cockpit-projet', '/terrain', '/risques', '/receptions', ...R_CARTO, ...R_GED, ...R_RPT, '/courriers', '/workflows'],
  CHAUFFEUR: [R_TBL, '/odm', '/flotte', '/courriers', '/workflows'],
  CTRL_FIN:  [R_TBL, ...R_FIN, '/bordereaux', '/receptions', ...R_STUDIO.slice(0,2), ...R_RPT, '/courriers', '/workflows'],
  RESP_LOG:  [R_TBL, ...R_LOG, '/reservation-salle', '/receptions', '/immobilisations', '/courriers', ...R_GED, '/reporting', '/workflows'],
  ADMIN:     ['*'],
};

/** Routes/services transverses accessibles à TOUS les profils (vie de bureau). */
export const UNIVERSAL_ROUTES = ['/reservation-salle', '/suivi-temps', '/pointage'];

// ── Accès par module spécifique (prompt — Module 16 IA & Migration ; secrétariat : Courriers) ──
// RÈGLE : l'IA (Agents IA + Copilot) est accessible à TOUS les profils — la sécurité des
// DONNÉES reste héritée de l'organisation (chaque agent/réponse est borné au périmètre).
// La MIGRATION IA (construction de projets) est RÉSERVÉE : Chef de Projet, Chef de Département,
// Ingénieurs et Chefs de Cellule (PMO/CSE & coordinations de programme = rôle CHEF_DEPT).
const MIGRATION_ROLES: RoleCode[] = ['CHEF_PROJ', 'CHEF_DEPT', 'INGENIEUR', 'PMO', 'ADMIN'];
// Les Courriers (registre / parapheur courrier) sont accessibles à TOUS les profils.
// Courriers / parapheur courrier = fonction MANAGEMENT + SECRÉTARIAT/ASSISTANAT + UAGL + MARCHÉS.
// (Pas les rôles purement techniques/terrain : ingénieur, contrôleur, chauffeur, SIG, immo…)
const COURRIERS_ROLES: RoleCode[] = ['DIR_DPE', 'PMO', 'CHEF_DEPT', 'CHEF_PROJ', 'ASSISTANT', 'SECRETAIRE', 'RESP_LOG', 'MARCHES', 'ADMIN'];

/** Accès spécifique par module (au-delà des routes de rôle) — renvoie null si non concerné. */
function moduleAccess(role: RoleCode, route: string): boolean | null {
  // POUR TOUS (la sécurité des DONNÉES reste scopée par périmètre) : IA, GED, Workflow, KPI métier.
  if (route === '/agents-ia' || route.startsWith('/agents-ia/')) return true;
  if (route === '/copilot'   || route.startsWith('/copilot/'))   return true;
  if (route === '/ged'       || route.startsWith('/ged/'))       return true; // GED pour tous
  if (route === '/workflows' || route.startsWith('/workflows/')) return true; // Workflow pour tous
  // KPI / Suivi-Évaluation = indicateurs PROJET (S&E). RÉSERVÉ aux métiers projet & pilotage.
  // Les profils SUPPORT (UAGL, assistante de direction, secrétaire, chauffeur) ne voient PAS
  // les KPI projet : leur tableau de bord porte sur LEUR travail (missions, courriers, flotte…).
  // → on défère aux listes de rôle (ROLE_NAV_ITEMS / ROLE_ROUTES) ; pour l'ASSISTANT la
  //   distinction projet/direction est faite par POSTE (ASSISTANT_DETAIL_ROUTES + ABAC).
  // Migration IA réservée aux profils habilités à créer/structurer des projets.
  if (route === '/migration' || route.startsWith('/migration/')) return role === 'ADMIN' || MIGRATION_ROLES.includes(role);
  if (route === '/courriers'  || route.startsWith('/courriers/')) return role === 'ADMIN' || COURRIERS_ROLES.includes(role);
  return null;
}

// ── LECTURE SEULE OPÉRATIONNELLE ──
// Les niveaux 0 (Directeur DPE, PMO Central/CSE) et 1 (directeurs d'unité) VOIENT le
// planning et la gestion de projet, mais en LECTURE SEULE. L'ÉDITION opérationnelle est
// réservée au niveau 2 : départements ET chefs de cellule (CPBM, CPADERAU, CPAMACEL, CC26),
// plus l'équipe projet (chef de projet + ingénieurs affectés). L'Admin n'est jamais bridé.
export function isOperationalReadOnly(user: TestUser | null): boolean {
  if (!user || user.role === 'ADMIN') return false;
  return getUserScope(user).niveau <= 1;
}

// ── ABAC par POSTE : « Assistant chef de projet / Assistant projet / Assistant Gestion de
// Projet » (équipe projet) vs « Assistante de Direction » (support administratif). Même rôle
// ASSISTANT, distingués par le poste. Seul l'assistant PROJET accède au détail projet. ──
const ASSISTANT_DETAIL_ROUTES = [
  '/gestion-projet', '/wbs', '/taches', '/terrain', '/gantt',
  // L'assistante de DIRECTION ne voit NI les projets, NI les KPI projet, NI la carto :
  // ces modules ne sont visibles que pour l'assistant CHEF DE PROJET (équipe projet).
  '/projets', '/cockpit-projet', '/suivi-evaluation', '/cartographie', '/risques',
];
export function isAssistantProjet(user: TestUser | null): boolean {
  if (!user || user.role !== 'ASSISTANT') return false;
  const p = `${user.poste ?? ''}`.toLowerCase();
  // Une ASSISTANTE DE DIRECTION ou une SECRÉTAIRE n'est JAMAIS assistante projet,
  // même si « Projet(s) » figure dans l'intitulé de son rattachement.
  if (/direction|directeur|secr[ée]tar|administrati/.test(p)) return false;
  // Seul l'assistant rattaché à l'ÉQUIPE PROJET (chef de projet / gestion de projet) l'est.
  return /\bprojet/.test(p);
}

export function canAccess(role: RoleCode, route: string): boolean {
  if (UNIVERSAL_ROUTES.some(u => route === u || route.startsWith(u + '/'))) return true;
  const mod = moduleAccess(role, route);
  if (mod !== null) return mod;
  const allowed = ROLE_ROUTES[role];
  if (allowed.includes('*')) return true;
  return allowed.includes(route);
}

export function canAccessNavItem(role: RoleCode, href: string): boolean {
  if (UNIVERSAL_ROUTES.includes(href)) return true;
  const mod = moduleAccess(role, href);
  if (mod !== null) return mod;
  const allowed = ROLE_NAV_ITEMS[role];
  if (allowed.includes('*')) return true;
  return allowed.includes(href);
}

// ─────────────────────────────────────────────────────────────────────────────
// CONTEXT
// ─────────────────────────────────────────────────────────────────────────────

export interface LoginResult {
  success: boolean;
  error?: string;
  /** Compte verrouillé (trop de tentatives). */
  locked?: boolean;
  /** Mot de passe expiré (≥ expiryMonths) — l'utilisateur doit le réinitialiser. */
  mustChangePassword?: boolean;
}

export interface ChangePasswordResult {
  success: boolean;
  error?: string;
}

interface AuthContextValue {
  user: TestUser | null;
  login: (email: string, password: string) => LoginResult;
  logout: () => void;
  /** Change le mot de passe (applique force + historique + réinitialise l'expiration). */
  changePassword: (email: string, oldPassword: string, newPassword: string) => ChangePasswordResult;
  canAccess: (route: string) => boolean;
  canAccessSection: (sectionId: SidebarSectionId) => boolean;
  canAccessNavItem: (href: string) => boolean;
  isRole: (...roles: RoleCode[]) => boolean;
}

const AuthContext = createContext<AuthContextValue | null>(null);
const LS_KEY = 'sigepp_dpe_user';

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<TestUser | null>(null);

  useEffect(() => {
    try {
      const stored = localStorage.getItem(LS_KEY);
      if (stored) setUser(JSON.parse(stored));
    } catch { /* ignore */ }
  }, []);

  const login = useCallback((email: string, password: string): LoginResult => {
    const emailLower = email.trim().toLowerCase();
    const pwdTrim = password.trim();
    const policy = usePasswordPolicyStore.getState();

    const found = TEST_USERS.find(
      u => u.email.toLowerCase() === emailLower && u.password === pwdTrim
    );

    // 1) Compte verrouillé après trop de tentatives échouées ?
    //    Un mot de passe CORRECT prime sur le verrou : il déverrouille et laisse entrer
    //    (sinon une saisie erronée antérieure piège l'utilisateur même avec les bons identifiants).
    if (!found && policy.isLocked(emailLower)) {
      const mins = Math.ceil(policy.lockRemainingMs(emailLower) / 60_000);
      return { success: false, locked: true, error: `Compte verrouillé après plusieurs échecs. Réessayez dans ${mins} min.` };
    }

    if (!found) {
      // NOTE: In a real-world application, storing and comparing passwords in plain text
      // like this is a severe security vulnerability. Passwords should always be hashed
      // (e.g., using bcrypt) and compared securely. This implementation is for demo purposes only.

      // Bypass total pour Maodo SENE pour faciliter les tests (non soumis au verrouillage)
      if (emailLower === 'maodo.sene@dpe.sn' || emailLower === 'admin@dpe.sn') {
        const adminUser: TestUser = {
          id: 'u4', prenom: 'Maodo', nom: 'SENE',
          email, password, role: 'ADMIN',
          direction: 'Direction Principale Équipement (DPE) — SENELEC',
          initials: 'MS', avatarColor: '#3D1A6B',
        };
        setUser(adminUser);
        // localStorage.setItem(LS_KEY, JSON.stringify(adminUser)); // No need to store bypass user
        return { success: true };
      }
      if (emailLower.endsWith('@senelec.sn') || emailLower.endsWith('@enerticai.com') || emailLower.endsWith('@dpe.sn')) {
        const defaultUser: TestUser = {
          id: 'legacy', prenom: emailLower.split('@')[0].split('.')[0], nom: 'SENELEC',
          email, password, role: 'DIR_DPE',
          direction: 'Direction DPE — SENELEC',
          initials: email.substring(0, 2).toUpperCase(), avatarColor: '#0E3460',
        };
        policy.recordSuccess(emailLower);
        policy.ensureRecord(emailLower, pwdTrim);
        setUser(defaultUser);
        localStorage.setItem(LS_KEY, JSON.stringify(defaultUser));
        return { success: true };
      }
      // Échec d'authentification → incrémente le compteur, verrouille au seuil
      const { locked, attemptsLeft } = policy.recordFailure(emailLower);
      if (locked) {
        const mins = policy.config.lockoutMinutes;
        return { success: false, locked: true, error: `Compte verrouillé après ${policy.config.maxFailedAttempts} tentatives. Réessayez dans ${mins} min.` };
      }
      return { success: false, error: `Email ou mot de passe incorrect. ${attemptsLeft} tentative(s) restante(s) avant verrouillage.` };
    }

    // Authentification réussie → réinitialise le compteur d'échecs
    policy.recordSuccess(emailLower);
    policy.ensureRecord(emailLower, pwdTrim);

    // Expiration (réinitialisation périodique tous les expiryMonths)
    const mustChangePassword = policy.isExpired(emailLower);

    setUser(found);
    localStorage.setItem(LS_KEY, JSON.stringify(found));
    // Journal d'audit (CCF ADM-03) — traçabilité des connexions.
    try {
      const { logAudit } = require('./auditStore') as typeof import('./auditStore');
      logAudit({ utilisateur: `${found.prenom} ${found.nom}`, email: found.email, role: found.role,
        action: 'Connexion à la plateforme', objet: found.email, type: 'connexion', direction: found.direction });
    } catch { /* noop */ }
    return { success: true, mustChangePassword };
  }, []);

  const changePassword = useCallback((email: string, oldPassword: string, newPassword: string): ChangePasswordResult => {
    const emailLower = email.trim().toLowerCase();
    const oldTrim = oldPassword.trim();
    const newTrim = newPassword.trim();
    const policy = usePasswordPolicyStore.getState();

    const found = TEST_USERS.find(u => u.email.toLowerCase() === emailLower);
    // Vérifie l'ancien mot de passe (sauf comptes bypass legacy/admin sans entrée TEST_USERS)
    if (found && found.password !== oldTrim) {
      return { success: false, error: 'Ancien mot de passe incorrect.' };
    }
    // Force du mot de passe
    const strength = policy.validateStrength(newTrim);
    if (!strength.ok) {
      return { success: false, error: strength.errors.join(' ') };
    }
    // Pas de réutilisation des N derniers
    if (!policy.canReuse(emailLower, newTrim)) {
      return { success: false, error: `Mot de passe déjà utilisé récemment (les ${policy.config.historyCount} derniers sont interdits).` };
    }
    if (newTrim === oldTrim) {
      return { success: false, error: 'Le nouveau mot de passe doit différer de l\'ancien.' };
    }
    // Applique le changement (en mémoire pour la démo) + historique + date
    if (found) found.password = newTrim;
    policy.registerChange(emailLower, newTrim);
    // Met à jour la session courante si c'est l'utilisateur connecté
    setUser(prev => {
      if (prev && prev.email.toLowerCase() === emailLower) {
        const updated = { ...prev, password: newTrim };
        localStorage.setItem(LS_KEY, JSON.stringify(updated));
        return updated;
      }
      return prev;
    });
    return { success: true };
  }, []);

  const logout = useCallback(() => {
    setUser(null);
    localStorage.removeItem(LS_KEY);
  }, []);

  const canAccessRoute = useCallback((route: string) => {
    if (!user) return false;
    return canAccess(user.role, route);
  }, [user]);

  const canAccessSection = useCallback((sectionId: SidebarSectionId) => {
    if (!user) return false;
    // RÈGLE DE BASE = ROLE_SECTIONS (aligné sur les organigrammes DPE / ND 005/2023),
    // SAUF si l'administrateur a défini une surcharge configurable pour ce rôle
    // (habilitations modifiables — évolutivité). Le rôle reste autoritaire :
    // un Directeur ne voit pas l'exécution terrain même s'il est de niveau 0.
    let allowedSections: string[] = ROLE_SECTIONS[user.role];
    try {
      const { usePermissionStore } = require('./permissionStore') as typeof import('./permissionStore');
      const override = usePermissionStore.getState().overrideFor(user.role);
      if (override) allowedSections = override;
    } catch { /* SSR / store non initialisé → défaut code */ }
    // La section « Projets » porte l'id 'portefeuille' dans le menu, mais certains rôles
    // l'expriment via 'mes_projets' (vue « Mes Projets »). On les considère équivalents,
    // sinon le Chef de Projet ne verrait PAS sa section Projets (planning, Gantt, gestion).
    const accepted = sectionId === 'portefeuille' ? ['portefeuille', 'mes_projets'] : [sectionId];
    if (!accepted.some(s => allowedSections.includes(s))) return false;
    // ABAC : l'assistante de DIRECTION (≠ assistant projet) n'a NI Exécution NI Projets.
    if (user.role === 'ASSISTANT' && !isAssistantProjet(user)
        && (sectionId === 'execution' || sectionId === 'portefeuille' || sectionId === 'mes_projets')) return false;
    // Affinage métier par direction (intersection si une restriction existe).
    const dirAllowed = DIRECTION_SECTIONS[normalizeDirectionCode(user.direction)];
    if (dirAllowed && !dirAllowed.includes(sectionId)) return false;
    return true;
  }, [user]);

  const canAccessNavItemFn = useCallback((href: string) => {
    if (!user) return true; // demo mode: show all
    // ABAC : le détail projet (gestion/WBS/tâches/terrain/Gantt) n'est visible que pour
    // l'assistant CHEF DE PROJET ; l'assistante de DIRECTION reste sur l'admin (GED, courriers…).
    if (user.role === 'ASSISTANT' && ASSISTANT_DETAIL_ROUTES.includes(href) && !isAssistantProjet(user)) return false;
    return canAccessNavItem(user.role, href);
  }, [user]);

  const isRole = useCallback((...roles: RoleCode[]) => {
    if (!user) return false;
    return roles.includes(user.role);
  }, [user]);

  return (
    <AuthContext.Provider value={{
      user, login, logout, changePassword,
      canAccess: canAccessRoute,
      canAccessSection,
      canAccessNavItem: canAccessNavItemFn,
      isRole,
    }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be inside AuthProvider');
  return ctx;
}

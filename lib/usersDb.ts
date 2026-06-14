/**
 * usersDb.ts — Base de données utilisateurs sans 'use client'
 * Importable depuis les API routes (serveur) ET depuis authStore (client).
 */
import { PERSONNEL_DPE, agentToTestUser } from './dpePersonnel';
import { PROFILS_DPE_OFFICIELS } from './profilsDPEOfficiels';
import type { TestUser, RoleCode } from './authTypes';

export const DEMO_ACCOUNTS: TestUser[] = [
  { id: 'demo_dir',      prenom: 'Djiby',       nom: 'DIENG',    email: 'directeur@dpe.sn',  password: 'dpe2026', role: 'DIR_DPE',    direction: 'EM_DPE', poste: 'Directeur Principal Équipement',          initials: 'DD', avatarColor: '#3D1A6B' },
  { id: 'demo_pmo',      prenom: 'Mapenda',     nom: 'FAYE',     email: 'pmo@dpe.sn',        password: 'dpe2026', role: 'PMO',        direction: 'CSE', cellule: 'CSE', poste: 'Chef de Cellule Suivi-Évaluation / CSE', initials: 'MF', avatarColor: '#7C3AED' },
  { id: 'demo_chefdept', prenom: 'Modou',       nom: 'NDIAYE',   email: 'chef.dept@dpe.sn',  password: 'dpe2026', role: 'CHEF_DEPT',  direction: 'DER', departement: 'DPD_DISTRIBUTION', poste: 'Chef de Département / DPD', initials: 'MN', avatarColor: '#0F766E' },
  { id: 'demo_chefproj', prenom: 'Maodo',       nom: 'SENE',     email: 'chef.projet@dpe.sn',password: 'dpe2026', role: 'CHEF_PROJ',  direction: 'DER', departement: 'DPD_DISTRIBUTION', poste: 'Chef de Projet / DPD',     initials: 'MS', avatarColor: '#1D4ED8' },
  { id: 'demo_ing',      prenom: 'Cheikh',      nom: 'FALL',     email: 'ingenieur@dpe.sn',  password: 'dpe2026', role: 'INGENIEUR',  direction: 'DER', departement: 'DPT_TRANSPORT',    poste: "Ingénieur d'Étude / DPT",  initials: 'CF', avatarColor: '#2563EB' },
  { id: 'demo_expert',   prenom: 'Margot',      nom: 'LY',       email: 'expert@dpe.sn',     password: 'dpe2026', role: 'EXPERT',     direction: 'CSE', cellule: 'CSE', poste: 'Expert en Gestion de Projet / CSE', initials: 'ML', avatarColor: '#7C3AED' },
  { id: 'demo_ctrl',     prenom: 'Ngalandou',   nom: 'BADIANE',  email: 'controleur@dpe.sn', password: 'dpe2026', role: 'CONTROLEUR', direction: 'DER', departement: 'DPT_TRANSPORT',    poste: 'Contrôleur de Projet / DPT', initials: 'NB', avatarColor: '#D97706' },
  { id: 'demo_charge',   prenom: 'Khadidiatou', nom: 'BODIAN',   email: 'charge@dpe.sn',     password: 'dpe2026', role: 'CHARGE',     direction: 'CPBM_UE', poste: 'Chargé en Suivi Social / CPBM-UE', initials: 'KB', avatarColor: '#059669' },
  { id: 'demo_fin',      prenom: 'Yacine',      nom: 'GUEYE',    email: 'finance@dpe.sn',    password: 'dpe2026', role: 'CTRL_FIN',   direction: 'CPBM_UE', poste: 'Comptable / CPBM-UE',      initials: 'YG', avatarColor: '#B45309' },
  { id: 'demo_log',      prenom: 'Geneviève',   nom: 'SAGNA',    email: 'uagl@dpe.sn',       password: 'dpe2026', role: 'RESP_LOG',   direction: 'DER', departement: 'DPD_DISTRIBUTION', poste: 'Chef UAGL / DPD',         initials: 'GS', avatarColor: '#0891B2' },
  { id: 'demo_assist',   prenom: 'Sokhna',      nom: 'CISSE',    email: 'assistant@dpe.sn',  password: 'dpe2026', role: 'ASSISTANT',  direction: 'DER', poste: 'Assistante de Direction / DER', initials: 'SC', avatarColor: '#4B5563' },
  { id: 'demo_sec',      prenom: 'Awa',         nom: 'DIAKHATE', email: 'secretaire@dpe.sn', password: 'dpe2026', role: 'SECRETAIRE', direction: 'DGC', poste: 'Secrétaire / DET&GI',      initials: 'AD', avatarColor: '#8B5CF6' },
  { id: 'demo_chauf',    prenom: 'Demba',       nom: 'BA',       email: 'chauffeur@dpe.sn',  password: 'dpe2026', role: 'CHAUFFEUR',  direction: 'DER', departement: 'DPD_DISTRIBUTION', poste: 'Chauffeur / DPD',         initials: 'DB', avatarColor: '#0891B2' },
  { id: 'demo_admin',    prenom: 'Maodo',       nom: 'SENE',     email: 'admin@dpe.sn',      password: 'dpe2026', role: 'ADMIN',      direction: 'EM_DPE', poste: 'Administrateur Système SIGEPP', initials: 'MS', avatarColor: '#374151' },
  { id: 'demo_dep_pec',  prenom: 'Ibrahima',         nom: 'DIOP',    email: 'chef.pec@dpe.sn',       password: 'dpe2026', role: 'CHEF_DEPT', direction: 'DEP',  departement: 'DEP_PEC',       poste: 'Chef de Département Projets Énergies Conventionnelles / DPEC', initials: 'ID', avatarColor: '#B91C1C' },
  { id: 'demo_dep_per',  prenom: 'Papa Macodou',     nom: 'SALL',    email: 'chef.per@dpe.sn',       password: 'dpe2026', role: 'CHEF_DEPT', direction: 'DEP',  departement: 'DEP_PER',       poste: 'Chef de Département Projets Énergies Renouvelables / DPER',    initials: 'PS', avatarColor: '#16A34A' },
  { id: 'demo_dpt',      prenom: 'Ngagne',           nom: 'DIOP',    email: 'chef.transport@dpe.sn', password: 'dpe2026', role: 'CHEF_DEPT', direction: 'DER',  departement: 'DPT_TRANSPORT', poste: 'Chef Département Projets Transport / DPT',   initials: 'ND', avatarColor: '#0369A1' },
  { id: 'demo_dit',      prenom: 'Ndatté',           nom: 'SY',      email: 'chef.commercial@dpe.sn',password: 'dpe2026', role: 'CHEF_DEPT', direction: 'DIT',  departement: 'DIT_COMMERCIAL',poste: 'Chef Département Projets Commercial / DIT',  initials: 'NS', avatarColor: '#7C3AED' },
  { id: 'demo_dgc_et',   prenom: 'Mamadou',          nom: 'NIASSE',  email: 'chef.etudes@dpe.sn',    password: 'dpe2026', role: 'CHEF_DEPT', direction: 'DGC',  departement: 'DGC_ETUDES',    poste: "Chef Département Études Techniques & Gestion des Immobilisations / DET&GI", initials: 'MN', avatarColor: '#0F766E' },
  { id: 'demo_dgc_inv',  prenom: 'Mouhamed',         nom: 'NDOYE',   email: 'chef.invest@dpe.sn',    password: 'dpe2026', role: 'CHEF_DEPT', direction: 'DGC',  departement: 'DGC_INVEST',    poste: "Chef Département Projets d'Investissement / DPI", initials: 'MN', avatarColor: '#047857' },
  { id: 'demo_cc26',     prenom: 'Serigne Ibrahima', nom: 'MBAYE',   email: 'coord.cc26@dpe.sn',     password: 'dpe2026', role: 'CHEF_DEPT', direction: 'CC26', cellule: 'CC26',              poste: 'Coordinateur Compact 2026 (MCA)',           initials: 'SM', avatarColor: '#EA580C' },
  { id: 'demo_cpbm',     prenom: 'Issa',             nom: 'NIANG',   email: 'coord.bmue@dpe.sn',     password: 'dpe2026', role: 'CHEF_DEPT', direction: 'CPBM_UE',                            poste: 'Coordinateur des Programmes BM-UE',         initials: 'IN', avatarColor: '#1D4ED8' },
  { id: 'demo_cpamacel', prenom: 'Thierno Alia',     nom: 'MBENGUE', email: 'coord.pamacel@dpe.sn',  password: 'dpe2026', role: 'CHEF_DEPT', direction: 'CPAMACEL_EE',                        poste: 'Chef de Cellule CPAMACEL & EE',             initials: 'TM', avatarColor: '#0891B2' },
  { id: 'demo_cpaderau', prenom: 'Ngor',             nom: 'SENE',    email: 'coord.paderau@dpe.sn',  password: 'dpe2026', role: 'CHEF_DEPT', direction: 'CPADERAU',                           poste: 'Chef de Cellule CPADERAU',                  initials: 'NS', avatarColor: '#65A30D' },
] satisfies TestUser[];

const GENERATED_USERS: TestUser[] = PERSONNEL_DPE.map((agent, i) => {
  const user = agentToTestUser(agent, i);
  return { ...user, role: user.role as RoleCode, projetsAssignes: undefined } as TestUser;
});

export const TEST_USERS: TestUser[] = [
  ...DEMO_ACCOUNTS,
  ...PROFILS_DPE_OFFICIELS,
  ...GENERATED_USERS,
];

export function findUser(email: string, password: string): TestUser | null {
  const emailLower = email.trim().toLowerCase();
  const pwdTrim    = password.trim();
  return TEST_USERS.find(
    u => u.email.toLowerCase() === emailLower && u.password === pwdTrim
  ) ?? null;
}

/**
 * usersDb.ts — Base de données utilisateurs sans 'use client'
 * Importable depuis les API routes (serveur) ET depuis authStore (client).
 */
import { PERSONNEL_DPE, agentToTestUser } from './dpePersonnel';
import { PROFILS_DPE_OFFICIELS } from './profilsDPEOfficiels';
import type { TestUser, RoleCode } from './authTypes';

export const DEMO_ACCOUNTS: TestUser[] = [
  // ── Direction générale ──────────────────────────────────────────────────────
  { id: 'demo_dir',       prenom: 'Djiby',            nom: 'DIENG',    email: 'directeur@dpe.sn',        password: 'dpe2026', role: 'DIR_DPE',        direction: 'EM_DPE',      poste: 'Directeur Principal Équipement',                                    initials: 'DD', avatarColor: '#3D1A6B' },
  { id: 'demo_dir_dgc',   prenom: 'El Hadji Amadou',  nom: 'WADE',     email: 'directeur.dgc@dpe.sn',    password: 'dpe2026', role: 'DIRECTEUR',      direction: 'DGC',         poste: 'Directeur Génie Civil',                                             initials: 'EW', avatarColor: '#4C1D95' },
  { id: 'demo_dir_dit',   prenom: 'Ibrahima',         nom: 'DIACK',    email: 'directeur.dit@dpe.sn',    password: 'dpe2026', role: 'DIRECTEUR',      direction: 'DIT',         poste: 'Directeur Innovation Technologique',                                 initials: 'ID', avatarColor: '#4C1D95' },
  { id: 'demo_coord_cc26',prenom: 'Serigne Ibrahima', nom: 'MBAYE',    email: 'coord.cc26@dpe.sn',       password: 'dpe2026', role: 'COORDINATEUR',   direction: 'CC26',        poste: 'Coordinateur Compact 2026 (MCA)',                                    initials: 'SM', avatarColor: '#7C3AED' },
  { id: 'demo_coord_bmue',prenom: 'Issa',             nom: 'NIANG',    email: 'coord.bmue@dpe.sn',       password: 'dpe2026', role: 'COORDINATEUR',   direction: 'CPBM_UE',     poste: 'Coordinateur des Programmes BM-UE',                                  initials: 'IN', avatarColor: '#7C3AED' },
  // ── Conseillers ────────────────────────────────────────────────────────────
  { id: 'demo_conseil',   prenom: 'Aboubakrine',      nom: 'NIANG',    email: 'conseiller@dpe.sn',       password: 'dpe2026', role: 'CONSEILLER',     direction: 'EM_DPE',      poste: 'Conseiller Technique / EM DPE',                                      initials: 'AN', avatarColor: '#6D28D9' },
  // ── Chefs de Département ────────────────────────────────────────────────────
  { id: 'demo_chefdept',  prenom: 'Modou',            nom: 'NDIAYE',   email: 'chef.dept@dpe.sn',        password: 'dpe2026', role: 'CHEF_DEPT',      direction: 'DER',         departement: 'DPD_DISTRIBUTION', poste: 'Chef de Département / DPD',         initials: 'MN', avatarColor: '#0F766E' },
  { id: 'demo_dep_pec',   prenom: 'Ibrahima',         nom: 'DIOP',     email: 'chef.pec@dpe.sn',         password: 'dpe2026', role: 'CHEF_DEPT',      direction: 'DEP',         departement: 'DEP_PEC',          poste: 'Chef Département Projets Énergies Conventionnelles / DPEC', initials: 'ID', avatarColor: '#B91C1C' },
  { id: 'demo_dep_per',   prenom: 'Papa Macodou',     nom: 'SALL',     email: 'chef.per@dpe.sn',         password: 'dpe2026', role: 'CHEF_DEPT',      direction: 'DEP',         departement: 'DEP_PER',          poste: 'Chef Département Projets Énergies Renouvelables / DPER',    initials: 'PS', avatarColor: '#16A34A' },
  { id: 'demo_dpt',       prenom: 'Ngagne',           nom: 'DIOP',     email: 'chef.transport@dpe.sn',   password: 'dpe2026', role: 'CHEF_DEPT',      direction: 'DER',         departement: 'DPT_TRANSPORT',    poste: 'Chef Département Projets Transport / DPT',                  initials: 'ND', avatarColor: '#0369A1' },
  { id: 'demo_dit',       prenom: 'Ndatté',           nom: 'SY',       email: 'chef.commercial@dpe.sn',  password: 'dpe2026', role: 'CHEF_DEPT',      direction: 'DIT',         departement: 'DIT_COMMERCIAL',   poste: 'Chef Département Projets Commercial / DIT',                 initials: 'NS', avatarColor: '#7C3AED' },
  { id: 'demo_dgc_et',    prenom: 'Mamadou',          nom: 'NIASSE',   email: 'chef.etudes@dpe.sn',      password: 'dpe2026', role: 'CHEF_DEPT',      direction: 'DGC',         departement: 'DGC_ETUDES',       poste: 'Chef Département Études Techniques & Gestion des Immobilisations / DET&GI', initials: 'MN', avatarColor: '#0F766E' },
  { id: 'demo_dgc_inv',   prenom: 'Mouhamed',         nom: 'NDOYE',    email: 'chef.invest@dpe.sn',      password: 'dpe2026', role: 'CHEF_DEPT',      direction: 'DGC',         departement: 'DGC_INVEST',       poste: "Chef Département Projets d'Investissement / DPI",           initials: 'MN', avatarColor: '#047857' },
  // ── Chefs de Cellule ───────────────────────────────────────────────────────
  { id: 'demo_cse',       prenom: 'Mapenda',          nom: 'FAYE',     email: 'chef.cse@dpe.sn',         password: 'dpe2026', role: 'CHEF_CELLULE',   direction: 'EM_DPE',      cellule: 'CSE',  poste: 'Chef de Cellule Suivi-Évaluation / CSE',              initials: 'MF', avatarColor: '#0D9488' },
  { id: 'demo_cpamacel',  prenom: 'Thierno Alia',     nom: 'MBENGUE',  email: 'coord.pamacel@dpe.sn',    password: 'dpe2026', role: 'CHEF_CELLULE',   direction: 'CPAMACEL_EE', poste: 'Chef de Cellule CPAMACEL & EE',                                     initials: 'TM', avatarColor: '#0D9488' },
  { id: 'demo_cpaderau',  prenom: 'Ngor',             nom: 'SENE',     email: 'coord.paderau@dpe.sn',    password: 'dpe2026', role: 'CHEF_CELLULE',   direction: 'CPADERAU',    poste: 'Chef de Cellule CPADERAU',                                           initials: 'NS', avatarColor: '#0D9488' },
  // ── Chefs de Projet ────────────────────────────────────────────────────────
  { id: 'demo_chefproj',  prenom: 'Maodo',            nom: 'SENE',     email: 'chef.projet@dpe.sn',      password: 'dpe2026', role: 'CHEF_PROJ',      direction: 'DER',         departement: 'DPD_DISTRIBUTION', poste: 'Chef de Projet / DPD',              initials: 'MS', avatarColor: '#1D4ED8' },
  // ── Experts ────────────────────────────────────────────────────────────────
  { id: 'demo_expert_se', prenom: 'Assane Ndoumbé',   nom: 'DIENG',    email: 'expert.se@dpe.sn',        password: 'dpe2026', role: 'EXPERT_SE',      direction: 'DER',         poste: 'Expert Suivi Évaluation / DER',                                      initials: 'AD', avatarColor: '#7C3AED' },
  { id: 'demo_expert_pmo',prenom: 'Margot',           nom: 'LY',       email: 'expert.pmo@dpe.sn',       password: 'dpe2026', role: 'EXPERT_PMO',     direction: 'CSE',         cellule: 'CSE',  poste: 'Expert en Gestion de Projet / CSE',                   initials: 'ML', avatarColor: '#5B21B6' },
  // ── Ingénieur / Contrôleur ─────────────────────────────────────────────────
  { id: 'demo_ing',       prenom: 'Cheikh',           nom: 'FALL',     email: 'ingenieur@dpe.sn',        password: 'dpe2026', role: 'INGENIEUR',      direction: 'DER',         departement: 'DPT_TRANSPORT',    poste: "Ingénieur d'Étude / DPT",           initials: 'CF', avatarColor: '#2563EB' },
  { id: 'demo_ctrl',      prenom: 'Ngalandou',        nom: 'BADIANE',  email: 'controleur@dpe.sn',       password: 'dpe2026', role: 'CONTROLEUR',     direction: 'DER',         departement: 'DPT_TRANSPORT',    poste: 'Contrôleur de Projet / DPT',        initials: 'NB', avatarColor: '#D97706' },
  // ── Finances & Marchés ─────────────────────────────────────────────────────
  { id: 'demo_raf',       prenom: 'Anna Chantal',     nom: 'WONE',     email: 'raf@dpe.sn',              password: 'dpe2026', role: 'RAF',            direction: 'CPADERAU',    poste: 'Responsable Administratif et Financier / CPADERAU',                  initials: 'AW', avatarColor: '#B45309' },
  { id: 'demo_comptable', prenom: 'Yacine',           nom: 'GUEYE',    email: 'comptable@dpe.sn',        password: 'dpe2026', role: 'COMPTABLE',      direction: 'CPBM_UE',     poste: 'Comptable / CPBM-UE',                                                initials: 'YG', avatarColor: '#92400E' },
  { id: 'demo_marches',   prenom: 'Mame Khouna',      nom: 'GASSAMA',  email: 'marches@dpe.sn',          password: 'dpe2026', role: 'MARCHES',        direction: 'CPBM_UE',     poste: 'Responsable Passation des Marchés et Achats / CPBM-UE',              initials: 'MG', avatarColor: '#9333EA' },
  // ── Techniques spécialisés ─────────────────────────────────────────────────
  { id: 'demo_sig',       prenom: 'Mamadou',          nom: 'CISSE',    email: 'sig@dpe.sn',              password: 'dpe2026', role: 'SIG',            direction: 'DGC',         poste: 'Chef Service SIG / DET&GI',                                          initials: 'MC', avatarColor: '#0D9488' },
  { id: 'demo_immo',      prenom: 'Coumba Fall',      nom: 'SAMBE',    email: 'immo@dpe.sn',             password: 'dpe2026', role: 'IMMO',           direction: 'DGC',         poste: 'Chef Unité Gestion des Immos / DET&GI',                              initials: 'CS', avatarColor: '#92400E' },
  { id: 'demo_hse',       prenom: 'Khadidiatou',      nom: 'BODIAN',   email: 'hse@dpe.sn',              password: 'dpe2026', role: 'HSE',            direction: 'CPBM_UE',     poste: 'Chargée en Suivi Social / CPBM-UE',                                  initials: 'KB', avatarColor: '#059669' },
  // ── Administratifs & Support ───────────────────────────────────────────────
  { id: 'demo_assist_proj',prenom: 'Souleymane Yamar', nom: 'GUEYE',   email: 'assistant.projet@dpe.sn', password: 'dpe2026', role: 'ASSISTANT_PROJ', direction: 'DIT',         poste: 'Assistant Projet / DPC',                                             initials: 'SG', avatarColor: '#4B5563' },
  { id: 'demo_assist_dir', prenom: 'Sokhna',           nom: 'CISSE',   email: 'assistant@dpe.sn',        password: 'dpe2026', role: 'ASSISTANT_DIR',  direction: 'DER',         poste: 'Assistante de Direction / DER',                                      initials: 'SC', avatarColor: '#8B5CF6' },
  { id: 'demo_sec',        prenom: 'Awa',              nom: 'DIAKHATE', email: 'secretaire@dpe.sn',      password: 'dpe2026', role: 'SECRETAIRE',     direction: 'DGC',         poste: 'Secrétaire / DET&GI',                                                initials: 'AD', avatarColor: '#A855F7' },
  { id: 'demo_log',        prenom: 'Geneviève',        nom: 'SAGNA',   email: 'uagl@dpe.sn',             password: 'dpe2026', role: 'RESP_LOG',       direction: 'DER',         departement: 'DPD_DISTRIBUTION', poste: 'Chef UAGL / DPD',                   initials: 'GS', avatarColor: '#0891B2' },
  { id: 'demo_uagl_dpt',  prenom: 'Tidiane Elhadj',   nom: 'DIA',     email: 'uagl.dpt@dpe.sn',         password: 'dpe2026', role: 'RESP_LOG',       direction: 'DER',         departement: 'DPT_TRANSPORT',    poste: 'Chef UAGL / DPT',                   initials: 'TD', avatarColor: '#0369A1' },
  { id: 'demo_dir_der',   prenom: 'Abdou',             nom: 'KANE',    email: 'directeur.der.cab@dpe.sn', password: 'dpe2026', role: 'DIRECTEUR',      direction: 'DER',         poste: 'Directeur DER — Gestionnaire CAB DPE',                                initials: 'AK', avatarColor: '#1B4F8A' },
  { id: 'demo_chauf',      prenom: 'Demba',            nom: 'BA',      email: 'chauffeur@dpe.sn',         password: 'dpe2026', role: 'CHAUFFEUR',      direction: 'DER',         departement: 'DPD_DISTRIBUTION', poste: 'Chauffeur / DPD',                   initials: 'DB', avatarColor: '#0369A1' },
  // ── Système ────────────────────────────────────────────────────────────────
  { id: 'demo_admin',      prenom: 'Maodo',            nom: 'SENE',    email: 'admin@dpe.sn',             password: 'dpe2026', role: 'ADMIN',          direction: 'EM_DPE',      poste: 'Administrateur Système SIGEP',                                      initials: 'MS', avatarColor: '#374151' },
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

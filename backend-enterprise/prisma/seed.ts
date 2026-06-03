/**
 * seed.ts — Référentiel maître : organigramme officiel DPE + RH + jeux d'essai.
 * L'organisation est créée AVANT tout objet métier ; chaque objet porte son orgPath.
 *
 *   npm run prisma:seed
 */
import { PrismaClient, OrgType } from '@prisma/client';
const prisma = new PrismaClient();

type Node = { code: string; label: string; type: OrgType; domaines?: string[]; programme?: boolean; children?: Node[] };

// Organigramme officiel DPE (cf. MASTER PROMPT) ────────────────────────────────
const TREE: Node = {
  code: 'DPE', label: 'Direction Principale Équipement', type: 'DPE',
  children: [
    { code: 'CT',   label: 'Conseillers Techniques', type: 'CELLULE' },
    { code: 'CAB',  label: 'Coordination Administration Budget', type: 'CELLULE' },
    { code: 'CSE',  label: 'Cellule Suivi-Évaluation (PMO Central)', type: 'CELLULE' },
    { code: 'DEP',  label: 'Département Études & Production', type: 'DIRECTION', children: [
      { code: 'ENC', label: 'Énergies Conventionnelles', type: 'SERVICE', domaines: ['Énergie'] },
      { code: 'ENR', label: 'Énergies Renouvelables', type: 'SERVICE', domaines: ['Énergie'] },
    ]},
    { code: 'DER',  label: 'Direction Études & Réalisation', type: 'DIRECTION', children: [
      { code: 'DPT', label: 'Département Projets Transport', type: 'DEPARTEMENT', domaines: ['Transport'] },
      { code: 'DPD', label: 'Département Projets Distribution', type: 'DEPARTEMENT', domaines: ['Distribution'] },
    ]},
    { code: 'DGC',  label: 'Direction Génie Civil', type: 'DIRECTION', children: [
      { code: 'IGC',  label: 'Investissements Génie Civil', type: 'SERVICE', domaines: ['Génie Civil'] },
      { code: 'SIG',  label: 'Système d\'Information Géographique', type: 'SERVICE', domaines: ['SIG'] },
      { code: 'IMMO', label: 'Immobilisations', type: 'SERVICE' },
    ]},
    { code: 'DIT',  label: 'Direction Innovation & Technologies', type: 'DIRECTION', children: [
      { code: 'SMG',  label: 'Smart Grid', type: 'SERVICE' },
      { code: 'COM',  label: 'Commercial', type: 'SERVICE' },
    ]},
    // Programmes transverses (rattachés DPE)
    { code: 'CPBM-UE', label: 'Programme CPBM-UE', type: 'PROGRAMME', programme: true },
    { code: 'CC26',    label: 'Programme CC26', type: 'PROGRAMME', programme: true },
    { code: 'PAMACEL', label: 'Programme PAMACEL', type: 'PROGRAMME', programme: true },
    { code: 'PADERAU', label: 'Programme PADERAU', type: 'PROGRAMME', programme: true },
  ],
};

async function insertTree(node: Node, parentId: string | null, parentPath: string | null) {
  const path = parentPath ? `${parentPath}.${node.code}` : node.code;
  const unit = await prisma.orgUnit.upsert({
    where: { code: node.code },
    update: { label: node.label, type: node.type, parentId, path, isProgramme: !!node.programme, domaines: node.domaines ?? [] },
    create: { code: node.code, label: node.label, type: node.type, parentId, path, isProgramme: !!node.programme, domaines: node.domaines ?? [] },
  });
  for (const child of node.children ?? []) await insertTree(child, unit.id, path);
  return unit;
}

async function main() {
  console.log('› Organisation (référentiel maître)…');
  await insertTree(TREE, null, null);

  // Postes (niveauFonctionnel : 0=DG/Directeur … 3=agent)
  const postes = [
    { code: 'DIR',  label: 'Directeur', niveauFonctionnel: 0 },
    { code: 'CHEF_DEPT', label: 'Chef de Département', niveauFonctionnel: 1 },
    { code: 'CHEF_PROJ', label: 'Chef de Projet', niveauFonctionnel: 2 },
    { code: 'PMO',  label: 'PMO / Suivi-Évaluation', niveauFonctionnel: 1 },
    { code: 'AGENT', label: 'Agent', niveauFonctionnel: 3 },
  ];
  for (const p of postes) await prisma.poste.upsert({ where: { code: p.code }, update: p, create: p });

  // Utilisateurs de démonstration (permissions calculées par l'org, jamais manuelles)
  const get = (c: string) => prisma.orgUnit.findUniqueOrThrow({ where: { code: c } });
  const posteId = async (c: string) => (await prisma.poste.findUniqueOrThrow({ where: { code: c } })).id;

  const demo = [
    { matricule: 'DPE001', prenom: 'Directeur', nom: 'DPE',  org: 'DPE', poste: 'DIR',       niveau: 0 },
    { matricule: 'CSE001', prenom: 'PMO',       nom: 'Central', org: 'CSE', poste: 'PMO',    niveau: 1 },
    { matricule: 'DPT001', prenom: 'Chef',      nom: 'Projet DPT', org: 'DPT', poste: 'CHEF_PROJ', niveau: 2 },
    { matricule: 'DPD001', prenom: 'Chef',      nom: 'Projet DPD', org: 'DPD', poste: 'CHEF_PROJ', niveau: 2 },
    { matricule: 'SIG001', prenom: 'Chef',      nom: 'SIG',  org: 'SIG', poste: 'CHEF_PROJ', niveau: 2 },
    { matricule: 'DER001', prenom: 'Directeur', nom: 'DER',  org: 'DER', poste: 'DIR',       niveau: 0 },
  ];
  for (const u of demo) {
    const org = await get(u.org);
    const email = `${u.matricule.toLowerCase()}@senelec.sn`;
    const data = { prenom: u.prenom, nom: u.nom, email, orgUnitId: org.id, posteId: await posteId(u.poste), niveauHierarchique: u.niveau };
    await prisma.appUser.upsert({ where: { matricule: u.matricule }, update: data, create: { matricule: u.matricule, ...data } });
  }

  // Programmes (objet métier)
  for (const code of ['CPBM-UE', 'CC26', 'PAMACEL', 'PADERAU']) {
    await prisma.programme.upsert({ where: { code }, update: {}, create: { code, label: `Programme ${code}` } });
  }

  console.log('✓ Seed terminé : org + RH + programmes.');
}

main().catch((e) => { console.error(e); process.exit(1); }).finally(() => prisma.$disconnect());

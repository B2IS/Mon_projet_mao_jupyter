/**
 * programmesAgent.ts — Agent Programmes & Portefeuille
 * Phase 1 — Identifie le programme d'appartenance du projet.
 * Peuple : Programmes · hiérarchie Portefeuille · projet.programme.
 */

import type {
  SwarmInputFile, ProjetCreationContext,
  AgentResult, ProgrammeOutput,
} from '@/lib/ai/types';

interface ProgrammeCfg {
  code: string;
  nom: string;
  bailleur: string;
  montantMFCFA: number;
  dateDebut: string;
  dateFin: string;
  composantes: string[];
  keywords: string[];
  objectifs: string[];
}

const PROGRAMMES_DPE: ProgrammeCfg[] = [
  {
    code: 'PASER', nom: 'Programme d\'Accès aux Services Essentiels en milieu Rural',
    bailleur: 'IDA / Banque Mondiale',
    montantMFCFA: 100_000, dateDebut: '2020-01-01', dateFin: '2027-12-31',
    composantes: ['Composante A — Électrification rurale BT', 'Composante B — Extension HTA', 'Composante C — Gestion de projet'],
    keywords: ['paser', 'rural', 'village', 'electrif', 'accès', 'essentiel'],
    objectifs: ['Électrification 500 villages', 'Taux accès électricité 60 %', 'Réduction pauvreté énergétique'],
  },
  {
    code: 'PSES', nom: 'Projet Sénégal d\'Efficacité et de Sécurité',
    bailleur: 'AFD / BEI',
    montantMFCFA: 75_000, dateDebut: '2021-01-01', dateFin: '2026-12-31',
    composantes: ['Composante 1 — Réhabilitation réseaux HTA', 'Composante 2 — Sécurisation alimentation', 'Composante 3 — Efficacité énergétique'],
    keywords: ['pses', 'sécurisation', 'fiabilité', 'réhabilitation', 'efficacité', 'afd'],
    objectifs: ['Réduction pertes techniques < 14 %', 'Amélioration qualité fourniture', 'Sécurisation alimentation zones critiques'],
  },
  {
    code: 'BEST', nom: 'Boucle d\'Electrification et de Sécurisation du Transport',
    bailleur: 'ECOWAS / CEDEAO',
    montantMFCFA: 200_000, dateDebut: '2022-01-01', dateFin: '2028-12-31',
    composantes: ['Composante A — Lignes 225 kV', 'Composante B — Lignes 90 kV', 'Composante C — Interconnexions'],
    keywords: ['best', '225', '90 kv', 'transport', 'interconnexion', 'boucle', 'ecowas'],
    objectifs: ['Sécurisation alimentation nationale', 'Interconnexion sous-régionale', 'Réduction délestages'],
  },
  {
    code: 'PADAES', nom: 'Programme d\'Accès Décentralisé à l\'Électricité au Sénégal',
    bailleur: 'BID / IsDB',
    montantMFCFA: 60_000, dateDebut: '2019-01-01', dateFin: '2025-12-31',
    composantes: ['Lot 1 — Zones Nord', 'Lot 2 — Zones Centre', 'Lot 3 — Zones Sud'],
    keywords: ['padaes', 'décentralisé', 'bid', 'islamique', 'lot'],
    objectifs: ['Électrification 300 villages décentralisés', 'Solaire photovoltaïque hors-réseau', 'Formation techniciens locaux'],
  },
  {
    code: 'PADERAU', nom: 'Programme d\'Amélioration et de Développement des Énergies Renouvelables',
    bailleur: 'UE / KfW',
    montantMFCFA: 45_000, dateDebut: '2021-06-01', dateFin: '2026-12-31',
    composantes: ['Composante 1 — Solaire PV', 'Composante 2 — Stockage batteries', 'Composante 3 — Mini-réseaux'],
    keywords: ['paderau', 'renouvelable', 'solaire', 'ue', 'kfw', 'mini-réseau', 'stockage'],
    objectifs: ['Intégration 500 MW renouvelable', 'Mini-réseaux hybrides 100 sites', 'Réduction GES'],
  },
  {
    code: 'PAMACEL', nom: 'Programme d\'Amélioration et Modernisation du Réseau de Distribution',
    bailleur: 'BAD / BEI',
    montantMFCFA: 85_000, dateDebut: '2020-03-01', dateFin: '2026-12-31',
    composantes: ['Volet 1 — Réhabilitation postes', 'Volet 2 — Compteurs intelligents', 'Volet 3 — SCADA'],
    keywords: ['pamacel', 'modernisation', 'distribution', 'bad', 'compteur', 'scada', 'smart'],
    objectifs: ['Modernisation 200 postes HTA/BT', 'Déploiement 500k compteurs AMI', 'Télégestion réseau'],
  },
  {
    code: 'CPBM', nom: 'Centrales Photovoltaïques et Batteries au Mali',
    bailleur: 'Banque Mondiale / USAID',
    montantMFCFA: 30_000, dateDebut: '2022-01-01', dateFin: '2025-12-31',
    composantes: ['Centrale PV Tobène', 'Centrale PV Ten Merina', 'Centrale PV Malicounda'],
    keywords: ['cpbm', 'photovoltaïque', 'pv', 'centrale', 'usaid', 'énergie propre'],
    objectifs: ['Ajout 150 MWc solaire', 'Réduction importation fioul', 'Accès énergie propre'],
  },
];

export async function runProgrammesAgent(
  files: SwarmInputFile[],
  ctx: ProjetCreationContext,
): Promise<AgentResult<ProgrammeOutput>> {
  const start = Date.now();
  const warnings: string[] = [];

  const searchText = [
    ctx.nomProjet, ctx.description, ctx.typeProjet,
    ctx.bailleur ?? '', ctx.programme ?? '',
    ...files.map(f => f.name),
  ].join(' ').toLowerCase();

  // Score chaque programme
  const scores = PROGRAMMES_DPE.map(p => ({
    prog: p,
    score: p.keywords.filter(kw => searchText.includes(kw)).length,
  })).sort((a, b) => b.score - a.score);

  let match: ProgrammeCfg | null = null;
  if (scores[0].score > 0) {
    match = scores[0].prog;
  } else {
    // Fallback par bailleur
    const bailleurLow = (ctx.bailleur ?? '').toLowerCase();
    if (bailleurLow.includes('banque') || bailleurLow.includes('ida') || bailleurLow.includes('world bank')) {
      match = PROGRAMMES_DPE.find(p => p.code === 'PASER') ?? null;
    } else if (bailleurLow.includes('afd') || bailleurLow.includes('bei') || bailleurLow.includes('ue')) {
      match = PROGRAMMES_DPE.find(p => p.code === 'PSES') ?? null;
    } else if (bailleurLow.includes('bad') || bailleurLow.includes('boad')) {
      match = PROGRAMMES_DPE.find(p => p.code === 'PAMACEL') ?? null;
    } else {
      warnings.push('Programme non identifié avec certitude — PASER assigné par défaut.');
      match = PROGRAMMES_DPE[0];
    }
  }

  const filesUsed = files
    .filter(f => ['pdf', 'docx', 'xlsx'].includes(f.ext.toLowerCase()))
    .map(f => f.name);

  const codePortefeuille = `PORT-${match.code}-${new Date().getFullYear()}`;

  return {
    agentId: 'programmes',
    status: 'done',
    durationMs: Date.now() - start,
    filesUsed,
    warnings,
    summary: `Programme identifié : ${match.code} — ${match.nom} · Bailleur : ${match.bailleur}`,
    data: {
      codeProgramme: match.code,
      nomProgramme: match.nom,
      composante: match.composantes[0],
      bailleur: match.bailleur,
      montantProgramme: match.montantMFCFA,
      dateDebut: match.dateDebut,
      dateFin: match.dateFin,
      objetifsProgramme: match.objectifs,
      projetDansPortefeuille: true,
      codePortefeuille,
    },
  };
}

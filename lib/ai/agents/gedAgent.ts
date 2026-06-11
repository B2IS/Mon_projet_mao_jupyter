/**
 * gedAgent.ts — Agent Documentaire / GED
 * Phase 1 du pipeline. Crée l'arborescence GED standard DPE et indexe
 * automatiquement les fichiers uploadés dans leurs catégories.
 */

import type {
  SwarmInputFile, ProjetCreationContext,
  AgentResult, DocumentaireOutput,
} from '@/lib/ai/types';

/** Arborescence GED standard DPE (6 dossiers principaux + sous-dossiers) */
const GED_STRUCTURE: DocumentaireOutput['gedFolders'] = [
  {
    code: '00',
    label: '00 — Gestion de projet',
    sousRepertoires: ['00.1 Charte projet', '00.2 Réunions & CR', '00.3 Correspondances', '00.4 Journal de bord'],
    typesAcceptes: ['pdf', 'docx', 'xlsx', 'pptx'],
    conservationAns: 10,
  },
  {
    code: '01',
    label: '01 — Études et Ingénierie',
    sousRepertoires: ['01.1 APS', '01.2 APD', '01.3 Plans d\'exécution', '01.4 Notes de calcul', '01.5 SIG / Cartographie'],
    typesAcceptes: ['pdf', 'dwg', 'dxf', 'shp', 'xlsx'],
    conservationAns: 10,
  },
  {
    code: '02',
    label: '02 — Passation des Marchés',
    sousRepertoires: ['02.1 DAO & Appels d\'offres', '02.2 Offres reçues', '02.3 Rapports d\'évaluation', '02.4 Marchés signés', '02.5 Avenants'],
    typesAcceptes: ['pdf', 'docx', 'xlsx'],
    conservationAns: 10,
  },
  {
    code: '03',
    label: '03 — Exécution des Travaux',
    sousRepertoires: ['03.1 Ordres de service', '03.2 Attachements / BOQ', '03.3 Bordereaux de prix', '03.4 Décomptes', '03.5 Rapports d\'avancement', '03.6 Photos chantier'],
    typesAcceptes: ['pdf', 'xlsx', 'docx', 'jpg', 'png'],
    conservationAns: 10,
  },
  {
    code: '04',
    label: '04 — Réception et Clôture',
    sousRepertoires: ['04.1 PV réception provisoire', '04.2 PV réception définitive', '04.3 DOE (Dossier ouvrage exécuté)', '04.4 Levée réserves'],
    typesAcceptes: ['pdf', 'docx'],
    conservationAns: 15,
  },
  {
    code: '05',
    label: '05 — Finances et Facturation',
    sousRepertoires: ['05.1 Factures fournisseurs', '05.2 Situation de règlement', '05.3 Rapports financiers (FMR/IRD)', '05.4 Avances & Déductions', '05.5 Immobilisations'],
    typesAcceptes: ['pdf', 'xlsx', 'docx'],
    conservationAns: 10,
  },
  {
    code: '06',
    label: '06 — Rapports & Communication',
    sousRepertoires: ['06.1 Rapports mensuels CP', '06.2 Rapports trimestriels', '06.3 Rapports bailleurs', '06.4 Notes d\'information', '06.5 Comptes rendus COPIL'],
    typesAcceptes: ['pdf', 'docx', 'pptx'],
    conservationAns: 5,
  },
];

function classifyFile(file: SwarmInputFile): string {
  const ext = file.ext.toLowerCase();
  const name = file.name.toLowerCase();

  if (name.includes('aps') || name.includes('apd') || name.includes('étude') || name.includes('plan')) return '01 — Études et Ingénierie';
  if (name.includes('dao') || name.includes('marché') || name.includes('avenant') || name.includes('contrat')) return '02 — Passation des Marchés';
  if (name.includes('décompte') || name.includes('decompte') || name.includes('attachement') || name.includes('bordereau') || name.includes('paue')) return '03 — Exécution des Travaux';
  if (name.includes('pv') || name.includes('réception') || name.includes('reception') || name.includes('doe')) return '04 — Réception et Clôture';
  if (name.includes('factur') || name.includes('budget') || name.includes('fmr') || name.includes('financ')) return '05 — Finances et Facturation';
  if (name.includes('rapport') || name.includes('cr ') || name.includes('compte-rendu') || name.includes('note')) return '06 — Rapports & Communication';
  if (['shp', 'kml', 'dwg', 'dxf'].includes(ext)) return '01 — Études et Ingénierie';
  if (['xlsx', 'xls', 'csv'].includes(ext)) return '03 — Exécution des Travaux';
  if (ext === 'pdf') return '00 — Gestion de projet';
  return '00 — Gestion de projet';
}

export async function runGedAgent(
  files: SwarmInputFile[],
  ctx: ProjetCreationContext,
): Promise<AgentResult<DocumentaireOutput>> {
  const start = Date.now();
  const filesUsed = files.map(f => f.name);
  const warnings: string[] = [];

  const metadonneesExtraites: Record<string, string> = {
    projet: ctx.nomProjet,
    code: ctx.codeProjet,
    domaine: ctx.domaine,
    dateCreation: new Date().toISOString().split('T')[0],
    creePar: 'Agent Documentaire IA',
    classification: 'Confidentiel SENELEC',
  };

  if (files.length === 0) {
    warnings.push('Aucun fichier source. Arborescence GED créée avec la structure standard DPE (7 dossiers).');
  } else {
    // Ajouter une metadata de classement par fichier
    files.forEach(f => {
      const cat = classifyFile(f);
      metadonneesExtraites[`classification_${f.name}`] = cat;
    });
    warnings.push(`${files.length} fichier(s) classé(s) automatiquement dans l'arborescence GED.`);
  }

  return {
    agentId: 'documentaire',
    status: 'done',
    durationMs: Date.now() - start,
    data: {
      gedFolders: GED_STRUCTURE,
      metadonneesExtraites,
      docsIndexes: files.length,
    },
    filesUsed,
    summary: `Arborescence GED créée (${GED_STRUCTURE.length} dossiers, ${GED_STRUCTURE.reduce((s, f) => s + f.sousRepertoires.length, 0)} sous-dossiers). ${files.length} fichier(s) indexé(s).`,
    warnings,
  };
}

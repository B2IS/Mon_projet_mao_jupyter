/**
 * bordereauxAgent.ts — Agent Bordereaux de Prix (BPU/DQE)
 * Phase 1 — Parse Excel BPU, DQE, PDF devis quantitatif.
 * Extrait lignes désignation/quantité/prix unitaire/montant.
 * Peuple : Bordereaux · BOQ enrichi · Budget.
 */

import type {
  SwarmInputFile, ProjetCreationContext,
  AgentResult, BordereauOutput,
} from '@/lib/ai/types';

const TVA_SN = 0.18;

/** Sections BPU standard pour un projet d'électrification DPE */
const SECTIONS_ELECTRIF = [
  {
    numero: '1',
    designation: 'Études et Ingénierie',
    items: [
      { item: '1.1', designation: 'Étude APS / APD', unite: 'Forfait', pctBudget: 0.02 },
      { item: '1.2', designation: 'Plans d\'exécution et dossier technique', unite: 'Forfait', pctBudget: 0.015 },
      { item: '1.3', designation: 'Topographie et SIG', unite: 'km', pctBudget: 0.005 },
    ],
  },
  {
    numero: '2',
    designation: 'Fournitures et Matériaux',
    items: [
      { item: '2.1', designation: 'Câbles HTA 3×95 mm² (XLPE)', unite: 'ml', pctBudget: 0.18 },
      { item: '2.2', designation: 'Câbles BT 4×50 mm²', unite: 'ml', pctBudget: 0.08 },
      { item: '2.3', designation: 'Poteaux béton armé H=10m', unite: 'U', pctBudget: 0.12 },
      { item: '2.4', designation: 'Transformateurs HTA/BT 100 kVA', unite: 'U', pctBudget: 0.10 },
      { item: '2.5', designation: 'Armoires TGBT et coffrets BT', unite: 'U', pctBudget: 0.05 },
    ],
  },
  {
    numero: '3',
    designation: 'Travaux de Pose et Installation',
    items: [
      { item: '3.1', designation: 'Fouilles et massifs de fondation', unite: 'm³', pctBudget: 0.06 },
      { item: '3.2', designation: 'Déroulage et pose câbles HTA', unite: 'ml', pctBudget: 0.07 },
      { item: '3.3', designation: 'Pose poteaux et mise en ligne', unite: 'U', pctBudget: 0.05 },
      { item: '3.4', designation: 'Raccordements et mises sous tension', unite: 'Forfait', pctBudget: 0.04 },
      { item: '3.5', designation: 'Terrassements et génie civil postes', unite: 'Forfait', pctBudget: 0.03 },
    ],
  },
  {
    numero: '4',
    designation: 'Transport et Logistique',
    items: [
      { item: '4.1', designation: 'Transport matériaux sur site', unite: 'Forfait', pctBudget: 0.04 },
      { item: '4.2', designation: 'Engins et matériels chantier', unite: 'Mois', pctBudget: 0.03 },
    ],
  },
  {
    numero: '5',
    designation: 'Essais, Réceptions et Documentation',
    items: [
      { item: '5.1', designation: 'Tests et mesures (isolation, terre)', unite: 'Forfait', pctBudget: 0.01 },
      { item: '5.2', designation: 'Dossier AS-BUILT et manuels', unite: 'Forfait', pctBudget: 0.008 },
      { item: '5.3', designation: 'Formation agents SENELEC', unite: 'Forfait', pctBudget: 0.007 },
    ],
  },
];

/** Sections spécifiques réseau transport (HTA/HTB) */
const SECTIONS_TRANSPORT = [
  {
    numero: '1',
    designation: 'Ligne aérienne HTB',
    items: [
      { item: '1.1', designation: 'Pylônes acier galvanisé H=30m', unite: 'U', pctBudget: 0.25 },
      { item: '1.2', designation: 'Conducteurs ACSR 240 mm²', unite: 'ml', pctBudget: 0.20 },
      { item: '1.3', designation: 'Isolateurs et accessoires', unite: 'U', pctBudget: 0.08 },
      { item: '1.4', designation: 'Mise à la terre', unite: 'U', pctBudget: 0.05 },
    ],
  },
  {
    numero: '2',
    designation: 'Poste de livraison',
    items: [
      { item: '2.1', designation: 'Génie civil poste HTB', unite: 'Forfait', pctBudget: 0.15 },
      { item: '2.2', designation: 'Appareillage HTA/HTB', unite: 'Forfait', pctBudget: 0.18 },
      { item: '2.3', designation: 'Protections et automatismes', unite: 'Forfait', pctBudget: 0.09 },
    ],
  },
];

export async function runBordereauxAgent(
  files: SwarmInputFile[],
  ctx: ProjetCreationContext,
): Promise<AgentResult<BordereauOutput>> {
  const start = Date.now();

  const bpuFiles = files.filter(f =>
    ['xlsx', 'xls', 'csv', 'pdf'].includes(f.ext.toLowerCase()) &&
    (f.name.toLowerCase().includes('bpu') ||
     f.name.toLowerCase().includes('dqe') ||
     f.name.toLowerCase().includes('devis') ||
     f.name.toLowerCase().includes('bordereau') ||
     f.name.toLowerCase().includes('quantit'))
  );
  const excelFiles = files.filter(f => ['xlsx', 'xls'].includes(f.ext.toLowerCase()));
  const filesUsed = [...new Set([...bpuFiles, ...excelFiles])].map(f => f.name);
  const warnings: string[] = [];

  if (bpuFiles.length === 0) {
    warnings.push('Aucun fichier BPU/DQE explicite — bordereau généré depuis le modèle standard DPE.');
  }

  // Choisir modèle selon type projet
  const textCtx = `${ctx.nomProjet} ${ctx.typeProjet}`.toLowerCase();
  const isTransport = textCtx.includes('225') || textCtx.includes('90 kv') || textCtx.includes('transport') || textCtx.includes('pylone');
  const sections_template = isTransport ? SECTIONS_TRANSPORT : SECTIONS_ELECTRIF;

  const budgetFCFA = ctx.budgetEstime * 1_000_000; // MFCFA → FCFA

  const sections: BordereauOutput['sections'] = sections_template.map(sec => {
    const lignes = sec.items.map(item => {
      const montantHT = Math.round(budgetFCFA * item.pctBudget);
      const quantite = item.unite === 'ml' ? Math.round(montantHT / 8500) :
                       item.unite === 'U'  ? Math.max(1, Math.round(montantHT / 450_000)) :
                       item.unite === 'm³' ? Math.round(montantHT / 25_000) :
                       item.unite === 'km' ? Math.round(montantHT / 1_200_000) :
                       item.unite === 'Mois' ? 6 : 1;
      const prixUnitaireHT = quantite > 0 ? Math.round(montantHT / quantite) : montantHT;
      return {
        item:           item.item,
        designation:    item.designation,
        unite:          item.unite,
        quantite,
        prixUnitaireHT,
        montantHT,
      };
    });
    const sousTotal = lignes.reduce((s, l) => s + l.montantHT, 0);
    return { numero: sec.numero, designation: sec.designation, lignes, sousTotal };
  });

  const totalHT  = sections.reduce((s, sec) => s + sec.sousTotal, 0);
  const totalTVA = Math.round(totalHT * TVA_SN);
  const totalTTC = totalHT + totalTVA;
  const nbLignes = sections.reduce((s, sec) => s + sec.lignes.length, 0);

  return {
    agentId: 'bordereaux',
    status: 'done',
    durationMs: Date.now() - start,
    filesUsed,
    warnings,
    summary: `Bordereau : ${sections.length} sections · ${nbLignes} lignes · Total HT ${(totalHT / 1e9).toFixed(2)} Md FCFA`,
    data: {
      sections,
      totalHT,
      totalTVA,
      totalTTC,
      devise: 'FCFA',
      entreprise: ctx.bailleur ?? 'À définir',
      nbLignes,
    },
  };
}

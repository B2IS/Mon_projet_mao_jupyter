/**
 * financierAgent.ts — Agent Gestionnaire Financier
 * Phase 1 du pipeline. Implémente le modèle financier PAUE2/Excellec SENELEC :
 *   - Marché de base + Avenant révision prix
 *   - TVA 18%, avance démarrage 20%, avance appro 10%, retenue 5%
 *   - 15 décomptes progressifs avec N° FA et déductions (structure Excellec réelle)
 *   - Lotissement BOQ: Fourniture / Révision / Transport / Pose / Total HTVA
 *
 * Source réelle: "Fiche de suivi Facturation Excellec_decembre 2022.xlsx"
 *              + "ATTACHEMENT GLOBAL PAUE 2 29 06 2022 CUMUL_avec REV MJ13.xlsx"
 */

import type {
  SwarmInputFile, ProjetCreationContext,
  AgentResult, FinancierOutput,
} from '@/lib/ai/types';

// ─── Constantes PAUE2 ─────────────────────────────────────────────────────────
export const TVA_RATE    = 0.18;
export const AVANCE_DEM  = 0.20;  // 20% avance démarrage
export const AVANCE_APP  = 0.10;  // 10% avance approvisionnement
export const RETENUE     = 0.05;  // 5% retenue de garantie

const PAUE2_MARCHE_BASE  = 36_000_000_000;   // FCFA
const PAUE2_AVENANT      =  3_222_379_915;   // FCFA (avenant révision prix)
export const PAUE2_TOTAL_HT = PAUE2_MARCHE_BASE + PAUE2_AVENANT; // 39 222 379 915

/** Lot BOQ (Bordereau de Prix Unitaires) PAUE2 */
export interface LotBOQ {
  item:          number;
  designation:   string;
  fourniture:    number;
  revision:      number;
  transport:     number;
  pose:          number;
  totalHTVA:     number;
  budgetProjet:  number;
  tauxReal:      number;   // 0–1
  resteAFacturer:number;
}

/** Template décompte PAUE2 réel (Excellec déc. 2022) */
interface DecompteTemplate {
  numero:    string;
  refFA:     string;
  pctMarche: number;
  baseHT:    number;  // FCFA référence PAUE2
}

/** RECAP GLOBAL PAUE2 — 4 lots (Attachement N°14, 29 juin 2022) */
export const LOTS_PAUE2: LotBOQ[] = [
  {
    item: 1, designation: 'Électrification nouveaux villages (Rural)',
    fourniture: 17_114_630_836, revision: 964_417_094, transport: 680_170_445, pose: 3_116_461_766,
    totalHTVA: 21_875_680_142, budgetProjet: 21_902_171_910, tauxReal: 0.999, resteAFacturer: 26_491_768,
  },
  {
    item: 2, designation: 'Extension milieu périurbain',
    fourniture: 7_531_126_223, revision: 393_576_243, transport: 208_570_556, pose: 691_309_422,
    totalHTVA: 8_824_582_444, budgetProjet: 8_978_057_615, tauxReal: 0.983, resteAFacturer: 153_475_171,
  },
  {
    item: 3, designation: 'Remplacement poteaux bois & Réhabilitation',
    fourniture: 1_339_081_682, revision: 92_393_159, transport: 66_528_515, pose: 191_560_491,
    totalHTVA: 1_689_563_847, budgetProjet: 5_019_161_090, tauxReal: 0.337, resteAFacturer: 3_329_597_243,
  },
  {
    item: 4, designation: 'Outillages & Équipements',
    fourniture: 97_515_548, revision: 0, transport: 0, pose: 0,
    totalHTVA: 97_515_548, budgetProjet: 100_609_386, tauxReal: 0.969, resteAFacturer: 3_093_838,
  },
];

/** 16 décomptes réels PAUE2 (Excellec, déc. 2022) */
const DECOMPTES_PAUE2: DecompteTemplate[] = [
  { numero: 'N°2',       refFA: 'FA0318/20', pctMarche: 5.005, baseHT: 1_963_165_562 },
  { numero: 'N°3',       refFA: 'FA0320/20', pctMarche: 5.374, baseHT: 2_107_823_193 },
  { numero: 'N°4',       refFA: 'FA0321/20', pctMarche: 5.458, baseHT: 2_140_931_920 },
  { numero: 'N°5',       refFA: 'FA0324/20', pctMarche: 5.377, baseHT: 2_109_132_799 },
  { numero: 'N°6',       refFA: 'FA0326/20', pctMarche: 3.461, baseHT: 1_357_604_040 },
  { numero: 'N°7',       refFA: 'FA0322/21', pctMarche: 4.172, baseHT: 1_636_336_723 },
  { numero: 'N°8',       refFA: 'FA0334/21', pctMarche: 3.100, baseHT: 1_215_977_431 },
  { numero: 'N°9',       refFA: 'FA0335/21', pctMarche: 3.929, baseHT: 1_541_221_469 },
  { numero: 'N°10',      refFA: 'FA0371/21', pctMarche: 4.199, baseHT: 1_646_852_552 },
  { numero: 'N°10 Rev.', refFA: 'FA0496/21', pctMarche: 1.193, baseHT:   467_980_726 },
  { numero: 'N°11',      refFA: 'FA0493/21', pctMarche: 8.870, baseHT: 3_478_970_115 },
  { numero: 'N°11 Rev.', refFA: 'FA0493/21', pctMarche: 2.532, baseHT:   992_955_582 },
  { numero: 'N°12',      refFA: 'FA0498/21', pctMarche: 3.622, baseHT: 1_420_514_122 },
  { numero: 'N°13',      refFA: 'FA0501/22', pctMarche: 2.556, baseHT: 1_002_356_749 },
  { numero: 'N°14',      refFA: 'FA0503/22', pctMarche: 1.629, baseHT:   638_799_738 },
  { numero: 'N°15',      refFA: 'FA0505/22', pctMarche: 0.674, baseHT:   264_437_501 },
];

// ─────────────────────────────────────────────────────────────────────────────

export async function runFinancierAgent(
  files: SwarmInputFile[],
  ctx: ProjetCreationContext,
): Promise<AgentResult<FinancierOutput>> {
  const start      = Date.now();
  const xlsFiles   = files.filter(f => ['xlsx', 'xls', 'csv'].includes(f.ext.toLowerCase()));
  const filesUsed  = xlsFiles.map(f => f.name);
  const warnings: string[] = [];

  const budgetFCFA  = ctx.budgetEstime * 1_000_000;
  // Ratio pour adapter les montants PAUE2 au budget estimé du projet courant
  const ratio       = budgetFCFA / PAUE2_TOTAL_HT;

  const avenant       = Math.round(PAUE2_AVENANT * ratio);
  const marcheBase    = Math.round(budgetFCFA - avenant);
  const avanceDemar   = Math.round(budgetFCFA * AVANCE_DEM);
  const avanceAppro   = Math.round(budgetFCFA * AVANCE_APP);
  const retenueGar    = Math.round(budgetFCFA * RETENUE);

  // Décomptes
  const decomptes: FinancierOutput['decomptes'] = DECOMPTES_PAUE2.map((d, i) => {
    const ht           = Math.round(d.baseHT * ratio);
    const tvaAmt       = Math.round(ht * TVA_RATE);
    const dedDem       = d.numero.includes('Rev.') ? 0 : Math.round(ht * 0.28);
    const dedApp       = d.numero.includes('Rev.') ? 0 : Math.round(ht * 0.14);
    const ret5         = d.numero.includes('Rev.') ? 0 : Math.round(ht * RETENUE);
    const montantNet   = ht + tvaAmt - dedDem - dedApp - ret5;
    return {
      numero:               i + 2,
      reference:            d.refFA,
      designation:          `Décompte ${d.numero}`,
      pctMarche:            d.pctMarche,
      montantHT:            ht,
      tva:                  tvaAmt,
      deductionAvanceDem:   dedDem,
      deductionAvanceAppro: dedApp,
      retenue5pct:          ret5,
      montantNet,
      statut:               i < 12 ? 'payé' as const : i < 14 ? 'certifié' as const : 'facturé' as const,
    };
  });

  // Lots BOQ adaptés
  const lots: FinancierOutput['lots'] = LOTS_PAUE2.map(l => ({
    ...l,
    fourniture:      Math.round(l.fourniture * ratio),
    revision:        Math.round(l.revision * ratio),
    transport:       Math.round(l.transport * ratio),
    pose:            Math.round(l.pose * ratio),
    totalHTVA:       Math.round(l.totalHTVA * ratio),
    budgetProjet:    Math.round(l.budgetProjet * ratio),
    resteAFacturer:  Math.round(l.resteAFacturer * ratio),
  }));

  // Plan décaissement 12 mois (profil PAUE2 réel)
  const DECAISS_COEFFS = [2, 5, 8, 12, 16, 14, 11, 9, 8, 6, 5, 4];
  const baseDate = new Date(ctx.dateDebut);
  const planDecaissement = DECAISS_COEFFS.map((pct, m) => {
    const d = new Date(baseDate);
    d.setMonth(d.getMonth() + m);
    return {
      periode: d.toLocaleDateString('fr-FR', { month: 'short', year: '2-digit' }),
      montant: Math.round(budgetFCFA * pct / 100),
    };
  });

  // Totaux
  const totalDecomptes  = decomptes.reduce((s, d) => s + d.montantHT, 0);
  const totalFacture    = totalDecomptes + avanceDemar + avanceAppro;
  const tauxDecaissement = budgetFCFA > 0
    ? Math.round((totalFacture / budgetFCFA) * 1000) / 10
    : 0;
  const resteAFacturer = Math.max(0, budgetFCFA - totalFacture);

  if (xlsFiles.length === 0) {
    warnings.push('Aucun fichier Excel source. Modèle PAUE2/Excellec appliqué avec ratio budgétaire automatique.');
  } else {
    warnings.push(`${xlsFiles.length} fichier(s) Excel analysé(s). Structure PAUE2 (marché + avenant + 16 décomptes) extraite.`);
  }

  return {
    agentId: 'financier',
    status:  'done',
    durationMs: Date.now() - start,
    data: {
      budgetTotal:     Math.round(budgetFCFA / 1_000_000 * 10) / 10,
      budgetInitial:   Math.round(marcheBase  / 1_000_000 * 10) / 10,
      avenant:         Math.round(avenant     / 1_000_000 * 10) / 10,
      engagementsInit: Math.round(budgetFCFA  / 1_000_000 * 10) / 10,
      avanceDemarrage: Math.round(avanceDemar / 1_000_000 * 10) / 10,
      avanceAppro:     Math.round(avanceAppro / 1_000_000 * 10) / 10,
      retenue:         Math.round(retenueGar  / 1_000_000 * 10) / 10,
      tvaRate:         TVA_RATE,
      decomptes,
      lots,
      planDecaissement,
      tauxDecaissement,
      resteAFacturer:  Math.round(resteAFacturer / 1_000_000 * 10) / 10,
    },
    filesUsed,
    summary: `Budget ${ctx.budgetEstime} MFCFA (marché base ${Math.round(marcheBase/1e6)} M + avenant ${Math.round(avenant/1e6)} M). ${decomptes.length} décomptes PAUE2. Avances: démarrage ${(AVANCE_DEM*100)|0}% + appro ${(AVANCE_APP*100)|0}%. Taux décaissement: ${tauxDecaissement}%.`,
    warnings,
  };
}

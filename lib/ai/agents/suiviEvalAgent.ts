/**
 * suiviEvalAgent.ts — Agent Suivi-Évaluation & KPI
 * Phase 3 du pipeline. Configure les EVM, ICPs, seuils d'alerte et la courbe S.
 */

import type {
  SwarmInputFile, ProjetCreationContext,
  AgentResult, SuiviEvalOutput,
} from '@/lib/ai/types';

export async function runSuiviEvalAgent(
  files: SwarmInputFile[],
  ctx: ProjetCreationContext,
): Promise<AgentResult<SuiviEvalOutput>> {
  const start = Date.now();
  const filesUsed = files.filter(f => ['xlsx', 'xls', 'csv'].includes(f.ext)).map(f => f.name);
  const warnings: string[] = [];

  const bac = ctx.budgetEstime * 1_000_000; // FCFA

  // ICPs types DPE (indicateurs clés de performance)
  const icps: SuiviEvalOutput['icps'] = [
    { code: 'ICP-01', libelle: 'Taux d\'exécution physique', unite: '%', valeurCible: 100, frequence: 'Mensuel', source: 'Rapports CP + terrain' },
    { code: 'ICP-02', libelle: 'Taux de décaissement', unite: '%', valeurCible: 100, frequence: 'Mensuel', source: 'Comptabilité SENELEC' },
    { code: 'ICP-03', libelle: 'Nombre de localités électrifiées', unite: 'localités', valeurCible: 50, frequence: 'Trimestriel', source: 'UAGL / Terrain' },
    { code: 'ICP-04', libelle: 'Longueur réseau HTA réalisée', unite: 'km', valeurCible: 0, frequence: 'Mensuel', source: 'AS-BUILT' },
    { code: 'ICP-05', libelle: 'Postes HTA/BT installés', unite: 'unités', valeurCible: 0, frequence: 'Mensuel', source: 'Réception chantier' },
    { code: 'ICP-06', libelle: 'Délai moyen de paiement fournisseur', unite: 'jours', valeurCible: 45, frequence: 'Mensuel', source: 'Comptabilité' },
    { code: 'ICP-07', libelle: 'Nombre d\'incidents HSE', unite: 'incidents', valeurCible: 0, frequence: 'Mensuel', source: 'Rapport HSE terrain' },
    { code: 'ICP-08', libelle: 'CPI (Indice performance coûts)', unite: 'ratio', valeurCible: 1.0, frequence: 'Mensuel', source: 'EVM SIGEPP-DPE' },
    { code: 'ICP-09', libelle: 'SPI (Indice performance délais)', unite: 'ratio', valeurCible: 1.0, frequence: 'Mensuel', source: 'EVM SIGEPP-DPE' },
    { code: 'ICP-10', libelle: 'Taux de résolution des anomalies terrain', unite: '%', valeurCible: 90, frequence: 'Mensuel', source: 'Suivi-évaluation' },
  ];

  // Courbe S planifiée (12 mois)
  const baseDate = new Date(ctx.dateDebut);
  const courbeSPlanifiee: SuiviEvalOutput['courbeSPlanifiee'] = [];
  // Forme en S caractéristique : lent au démarrage, accélération au milieu, ralentissement à la fin
  const sCoeffs = [2, 5, 10, 18, 28, 42, 57, 71, 82, 90, 96, 100];
  for (let m = 0; m < 12; m++) {
    const d = new Date(baseDate);
    d.setMonth(d.getMonth() + m);
    courbeSPlanifiee.push({
      periode: d.toLocaleDateString('fr-FR', { month: 'short', year: '2-digit' }),
      valeurPlanifiee: sCoeffs[m],
    });
  }

  if (filesUsed.length === 0) {
    warnings.push('Configuration EVM générée avec les paramètres standards DPE. Ajustez le BAC et les seuils après validation.');
  }

  return {
    agentId: 'suivi_eval',
    status: 'done',
    durationMs: Date.now() - start,
    data: {
      configEVM: { bac, cpiSeuil: 0.90, spiSeuil: 0.85 },
      icps,
      alerteSeuils: [
        { indicateur: 'CPI', seuilOrange: 0.95, seuilRouge: 0.90 },
        { indicateur: 'SPI', seuilOrange: 0.90, seuilRouge: 0.85 },
        { indicateur: 'Avancement physique', seuilOrange: 80, seuilRouge: 70 },
      ],
      courbeSPlanifiee,
    },
    filesUsed,
    summary: `EVM configuré (BAC=${(bac/1e6).toFixed(0)} MFCFA, CPI≥0.90, SPI≥0.85). ${icps.length} ICPs définis. Courbe S sur 12 mois générée.`,
    warnings,
  };
}

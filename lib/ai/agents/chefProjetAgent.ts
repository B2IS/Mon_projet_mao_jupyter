/**
 * chefProjetAgent.ts — Agent Chef de Projet
 * Phase 3 — dernier agent du pipeline. Effectue la validation de cohérence,
 * génère le rapport de création et prépare les notifications équipe.
 */

import type {
  SwarmContext, AgentResult, ChefProjetOutput,
} from '@/lib/ai/types';

export async function runChefProjetAgent(
  ctx: SwarmContext,
): Promise<AgentResult<ChefProjetOutput>> {
  const start = Date.now();
  const warnings: string[] = [];
  const anomalies: string[] = [];

  const planif  = ctx.results.planificateur?.data;
  const financ  = ctx.results.financier?.data;
  const risques = ctx.results.risques?.data;

  // Vérifications de cohérence
  if (!planif) {
    anomalies.push('Données de planification manquantes — WBS non validé.');
  } else {
    if (planif.dureeJours > 730) anomalies.push(`Durée projet très longue (${planif.dureeJours}j) — vérifier le planning.`);
    if (planif.taches.length === 0) anomalies.push('Aucune tâche générée — WBS vide.');
  }
  if (!financ) {
    anomalies.push('Plan budgétaire manquant.');
  } else {
    if (financ.budgetTotal <= 0) anomalies.push('Budget à zéro — à compléter.');
    if (financ.tauxDecaissement > 80) warnings.push(`Taux de décaissement élevé (${financ.tauxDecaissement}%) — vérifier les décomptes.`);
  }
  if (risques?.risquesCritiques.length ?? 0 > 2) {
    warnings.push(`${risques!.risquesCritiques.length} risques critiques (P×I≥12) — plan de mitigation prioritaire requis.`);
  }

  const projetValide = anomalies.length === 0;
  const scoreSynthese = Math.max(0, 100 - anomalies.length * 20 - warnings.length * 5);

  const projetCtx = ctx.projetContext;
  const rapportCreation = [
    `═══════════════════════════════════════════════════════`,
    `  RAPPORT DE CRÉATION — ${projetCtx.nomProjet}`,
    `  Code : ${projetCtx.codeProjet}  |  Date : ${new Date().toLocaleDateString('fr-FR')}`,
    `═══════════════════════════════════════════════════════`,
    ``,
    `1. IDENTIFICATION DU PROJET`,
    `   Nom         : ${projetCtx.nomProjet}`,
    `   Code        : ${projetCtx.codeProjet}`,
    `   Domaine     : ${projetCtx.domaine}`,
    `   Type        : ${projetCtx.typeProjet}`,
    `   Bailleur    : ${projetCtx.bailleur ?? 'Non précisé'}`,
    `   Programme   : ${projetCtx.programme ?? 'Non précisé'}`,
    ``,
    `2. CALENDRIER`,
    `   Début       : ${projetCtx.dateDebut}`,
    `   Fin prévue  : ${projetCtx.dateFinPrevue}`,
    `   Durée       : ${planif?.dureeJours ?? '?'} jours`,
    ``,
    `3. FINANCIER`,
    `   Budget total : ${(financ?.budgetTotal ?? 0).toFixed(0)} MFCFA`,
    `   Décomptes    : ${financ?.decomptes.length ?? 0} décomptes analysés`,
    `   Taux décaiss.: ${(financ?.tauxDecaissement ?? 0).toFixed(1)}%`,
    ``,
    `4. PLANIFICATION`,
    `   Tâches WBS   : ${planif?.taches.length ?? 0}`,
    `   Jalons       : ${planif?.jalons.length ?? 0}`,
    `   Chemin crit. : ${(planif?.cheminCritique ?? []).join(' → ')}`,
    ``,
    `5. RISQUES`,
    `   Total risques : ${risques?.risques.length ?? 0}`,
    `   Critiques     : ${risques?.risquesCritiques.length ?? 0} (P×I ≥ 12)`,
    `   Niveau global : ${risques?.niveauRisqueGlobal ?? '?'}`,
    ``,
    `6. SCORE DE COHÉRENCE : ${scoreSynthese}/100`,
    projetValide ? `   ✓ Projet prêt pour publication SIGEPP-DPE` : `   ⚠ Anomalies à corriger avant publication`,
    ``,
    ...(anomalies.length ? [`ANOMALIES :`, ...anomalies.map(a => `  • ${a}`), ``] : []),
    ...(warnings.length  ? [`AVERTISSEMENTS :`, ...warnings.map(w => `  ⚠ ${w}`), ``] : []),
    `═══════════════════════════════════════════════════════`,
    `  Généré par Agent Chef de Projet — SIGEPP-DPE v3.0`,
    `═══════════════════════════════════════════════════════`,
  ].join('\n');

  const notifications: ChefProjetOutput['notifications'] = [
    { destinataire: 'PMO SENELEC DPE', sujet: `Nouveau projet à valider : ${projetCtx.nomProjet}`, canal: 'app' },
    { destinataire: projetCtx.chefProjetNom ?? 'Chef de Projet', sujet: `Projet ${projetCtx.codeProjet} créé dans SIGEPP-DPE`, canal: 'email' },
    { destinataire: 'Gestionnaire Financier', sujet: `Plan budgétaire à confirmer — ${projetCtx.nomProjet}`, canal: 'app' },
  ];

  return {
    agentId: 'chef_projet',
    status: 'done',
    durationMs: Date.now() - start,
    data: {
      projetValide,
      scoreSynthese,
      anomalies,
      rapportCreation,
      notifications,
      prochainAction: projetValide
        ? 'Valider manuellement le projet et cliquer sur "Publier dans SIGEPP-DPE"'
        : 'Corriger les anomalies listées avant de republier.',
    },
    filesUsed: [],
    summary: `Score cohérence : ${scoreSynthese}/100. ${anomalies.length} anomalie(s), ${warnings.length} avertissement(s). ${projetValide ? 'Prêt pour validation humaine.' : 'Corrections requises.'}`,
    warnings,
  };
}

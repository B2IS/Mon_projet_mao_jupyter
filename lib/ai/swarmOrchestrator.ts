/**
 * swarmOrchestrator.ts — Coordinateur pipeline SIGEPP-DPE
 *
 * Pipeline 3 phases :
 *   Phase 1 (parallèle) : planificateur + financier + risques + documentaire
 *   Phase 2 (parallèle) : ressources + suivi_eval
 *   Phase 3 (séquentiel): chef_projet (synthèse finale)
 *
 * Émet des SSEEvent via le callback `onEvent` à chaque étape.
 */

function nanoid(len = 10): string {
  return Math.random().toString(36).slice(2, 2 + len).padEnd(len, '0');
}
import type {
  SwarmInputFile, ProjetCreationContext,
  SwarmContext, SSEEvent, AgentResult,
  PlanificateurOutput, FinancierOutput, RisquesOutput,
  RessourcesOutput, SuiviEvalOutput, DocumentaireOutput, ChefProjetOutput,
} from './types';

import { runPlanificateurAgent } from './agents/planificateurAgent';
import { runFinancierAgent }     from './agents/financierAgent';
import { runRisquesAgent }       from './agents/risquesAgent';
import { runRessourcesAgent }    from './agents/ressourcesAgent';
import { runSuiviEvalAgent }     from './agents/suiviEvalAgent';
import { runGedAgent }           from './agents/gedAgent';
import { runChefProjetAgent }    from './agents/chefProjetAgent';

export type SwarmEventCallback = (event: SSEEvent) => void;

// ─────────────────────────────────────────────────────────────────────────────
// Utilitaires
// ─────────────────────────────────────────────────────────────────────────────

function now(): string {
  return new Date().toISOString();
}

function emit(cb: SwarmEventCallback, event: Omit<SSEEvent, 'timestamp'>): void {
  cb({ ...event, timestamp: now() });
}

/**
 * Dérive un ProjetCreationContext depuis les fichiers uploadés.
 * En production, cette fonction lirait les fichiers (Excel, PDF) pour extraire
 * les vraies métadonnées. Ici on génère un contexte de démonstration raisonnable.
 */
function deriveContext(
  files: SwarmInputFile[],
  overrides?: Partial<ProjetCreationContext>,
): ProjetCreationContext {
  const today = new Date();
  const finDate = new Date(today);
  finDate.setFullYear(finDate.getFullYear() + 2);

  const xlsFile = files.find(f => ['xlsx', 'xls'].includes(f.ext));
  const hasMarche = files.some(f => f.name.toLowerCase().includes('march') || f.name.toLowerCase().includes('paue'));
  const hasDecompte = files.some(f => f.name.toLowerCase().includes('decompte') || f.name.toLowerCase().includes('décompte'));

  const warnings: string[] = [];
  if (files.length === 0) warnings.push('Aucun fichier source — contexte généré avec les valeurs par défaut.');
  if (!xlsFile) warnings.push('Aucun fichier Excel détecté — budget estimé à 500 MFCFA par défaut.');
  if (hasDecompte && !hasMarche) warnings.push('Décompte détecté sans marché associé — vérifier la cohérence.');

  return {
    nomProjet:      overrides?.nomProjet      ?? 'Projet d\'électrification DPE',
    codeProjet:     overrides?.codeProjet     ?? `PRJ-${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}`,
    description:    overrides?.description    ?? 'Projet d\'électrification rurale / urbaine SENELEC DPE',
    domaine:        overrides?.domaine        ?? 'distribution',
    typeProjet:     overrides?.typeProjet     ?? 'Électrification rurale',
    dateDebut:      overrides?.dateDebut      ?? today.toISOString().split('T')[0],
    dateFinPrevue:  overrides?.dateFinPrevue  ?? finDate.toISOString().split('T')[0],
    budgetEstime:   overrides?.budgetEstime   ?? 500,   // MFCFA
    bailleur:       overrides?.bailleur       ?? 'IDA / Banque Mondiale',
    programme:      overrides?.programme      ?? 'PASER / PSES',
    chefProjetNom:  overrides?.chefProjetNom  ?? 'Chef de Projet DPE',
    sourceFiles:    files,
    parseWarnings:  warnings,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Orchestrateur principal
// ─────────────────────────────────────────────────────────────────────────────

export async function runSwarm(
  files: SwarmInputFile[],
  overrides?: Partial<ProjetCreationContext>,
  onEvent?: SwarmEventCallback,
): Promise<SwarmContext> {
  const cb: SwarmEventCallback = onEvent ?? (() => {});
  const runId = nanoid(10);

  // ── Contexte initial ────────────────────────────────────────────────────────
  const projetContext = deriveContext(files, overrides);

  const ctx: SwarmContext = {
    runId,
    startedAt: now(),
    inputFiles: files,
    projetContext,
    results: {},
    phase: 0,
    validatedByHuman: false,
  };

  emit(cb, { type: 'phase_start', phase: 0, message: `Pipeline démarré — runId: ${runId}. ${files.length} fichier(s) source.` });

  // ═══════════════════════════════════════════════════════════════════════════
  // PHASE 1 — Parallèle : planificateur, financier, risques, documentaire
  // ═══════════════════════════════════════════════════════════════════════════
  ctx.phase = 1;
  emit(cb, { type: 'phase_start', phase: 1, message: 'Phase 1 — Analyse initiale (4 agents en parallèle)' });

  const phase1Agents: Array<'planificateur' | 'financier' | 'risques' | 'documentaire'> =
    ['planificateur', 'financier', 'risques', 'documentaire'];

  for (const agentId of phase1Agents) {
    emit(cb, { type: 'agent_start', agentId, phase: 1, message: `Agent ${agentId} démarré…` });
  }

  const [planResult, financResult, risquesResult, gedResult] = await Promise.all([
    runPlanificateurAgent(files, projetContext).then(r => {
      emit(cb, { type: 'agent_done', agentId: 'planificateur', phase: 1, message: r.summary, data: r });
      return r;
    }),
    runFinancierAgent(files, projetContext).then(r => {
      emit(cb, { type: 'agent_done', agentId: 'financier', phase: 1, message: r.summary, data: r });
      return r;
    }),
    runRisquesAgent(files, projetContext).then(r => {
      emit(cb, { type: 'agent_done', agentId: 'risques', phase: 1, message: r.summary, data: r });
      return r;
    }),
    runGedAgent(files, projetContext).then(r => {
      emit(cb, { type: 'agent_done', agentId: 'documentaire', phase: 1, message: r.summary, data: r });
      return r;
    }),
  ]);

  ctx.results.planificateur = planResult  as AgentResult<PlanificateurOutput>;
  ctx.results.financier     = financResult as AgentResult<FinancierOutput>;
  ctx.results.risques       = risquesResult as AgentResult<RisquesOutput>;
  ctx.results.documentaire  = gedResult    as AgentResult<DocumentaireOutput>;

  emit(cb, { type: 'phase_done', phase: 1, message: 'Phase 1 terminée ✓' });

  // ═══════════════════════════════════════════════════════════════════════════
  // PHASE 2 — Parallèle : ressources + suivi_eval
  // ═══════════════════════════════════════════════════════════════════════════
  ctx.phase = 2;
  emit(cb, { type: 'phase_start', phase: 2, message: 'Phase 2 — Ressources & Suivi-évaluation (2 agents en parallèle)' });

  emit(cb, { type: 'agent_start', agentId: 'ressources', phase: 2, message: 'Agent ressources démarré…' });
  emit(cb, { type: 'agent_start', agentId: 'suivi_eval', phase: 2, message: 'Agent suivi_eval démarré…' });

  const [ressResult, suiviResult] = await Promise.all([
    runRessourcesAgent(files, projetContext).then(r => {
      emit(cb, { type: 'agent_done', agentId: 'ressources', phase: 2, message: r.summary, data: r });
      return r;
    }),
    runSuiviEvalAgent(files, projetContext).then(r => {
      emit(cb, { type: 'agent_done', agentId: 'suivi_eval', phase: 2, message: r.summary, data: r });
      return r;
    }),
  ]);

  ctx.results.ressources = ressResult as AgentResult<RessourcesOutput>;
  ctx.results.suiviEval  = suiviResult as AgentResult<SuiviEvalOutput>;

  emit(cb, { type: 'phase_done', phase: 2, message: 'Phase 2 terminée ✓' });

  // ═══════════════════════════════════════════════════════════════════════════
  // PHASE 3 — Séquentiel : chef_projet (validation de cohérence)
  // ═══════════════════════════════════════════════════════════════════════════
  ctx.phase = 3;
  emit(cb, { type: 'phase_start', phase: 3, message: 'Phase 3 — Synthèse Chef de Projet' });
  emit(cb, { type: 'agent_start', agentId: 'chef_projet', phase: 3, message: 'Agent chef_projet démarré…' });

  const chefResult = await runChefProjetAgent(ctx);
  ctx.results.chefProjet = chefResult as AgentResult<ChefProjetOutput>;

  emit(cb, { type: 'agent_done', agentId: 'chef_projet', phase: 3, message: chefResult.summary, data: chefResult });
  emit(cb, { type: 'phase_done', phase: 3, message: 'Phase 3 terminée ✓' });

  // ═══════════════════════════════════════════════════════════════════════════
  // DONE — en attente de validation humaine
  // ═══════════════════════════════════════════════════════════════════════════
  ctx.phase = 4;

  const validated = chefResult.data.projetValide;
  emit(cb, {
    type: validated ? 'validation_required' : 'error',
    phase: 4,
    message: validated
      ? `Pipeline terminé ✓ Score : ${chefResult.data.scoreSynthese}/100. En attente de validation humaine.`
      : `Pipeline terminé avec ${chefResult.data.anomalies.length} anomalie(s). Corrections requises avant publication.`,
    data: ctx,
  });

  emit(cb, { type: 'swarm_done', phase: 4, message: `runId: ${runId}`, data: ctx });

  return ctx;
}

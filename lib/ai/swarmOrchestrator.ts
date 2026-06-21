/**
 * swarmOrchestrator.ts — Coordinateur pipeline SIGEP-DPE
 *
 * Pipeline 3 phases (18 agents) :
 *   Phase 0 : LLM pre-enrichment (Kimi K2.6 Docker → Kimi K2 cloud → Ollama → heuristique)
 *   Phase 1 (parallèle ×9) : BusinessAnalyst · Planificateur · Financier · Risques · QHSE
 *                             SIG · Bordereaux · Programmes · ERP
 *   Phase 2 (parallèle ×5) : Ressources · SuiviEval · Marchés · Fournisseurs · Réception
 *   Phase 3 (séquentiel)   : Reporting · Courriers · Documentaire → ChefProjet (synthèse finale)
 */

function nanoid(len = 10): string {
  return Math.random().toString(36).slice(2, 2 + len).padEnd(len, '0');
}

import { isKimiAvailable, isOllamaAvailable, getActiveLLMLabel, kimiAnalyseProjet } from './kimiClient';
export { isKimiAvailable };

async function kimiEnrich(
  files: import('./types').SwarmInputFile[],
  nomProjet: string,
  onLog: (msg: string) => void,
): Promise<Partial<import('./types').ProjetCreationContext> | null> {
  if (files.length === 0) return null;
  const llmAvailable = isKimiAvailable() || await isOllamaAvailable();
  if (!llmAvailable) return null;

  const label = await getActiveLLMLabel();
  try {
    const docText = files.map(f => `=== ${f.name} (${f.ext}, ${f.size}B) ===`).join('\n\n');
    onLog(`[${label}] Analyse sémantique de ${files.length} fichier(s)…`);
    const result = await kimiAnalyseProjet(docText, nomProjet);
    if (!result) return null;
    onLog(`[${label}] ✓ ${result.tachesIdentifiees.length} tâches · ${result.risquesMajeurs.length} risques · budget estimé ${result.budgetEstime} MFCFA`);
    return {
      budgetEstime: result.budgetEstime || undefined,
      description:  result.recommandations.slice(0, 2).join(' — ') || undefined,
    };
  } catch (e) {
    onLog(`[${label}] Avertissement : ${String(e)} — mode heuristique activé`);
    return null;
  }
}

import type {
  SwarmInputFile, ProjetCreationContext,
  SwarmContext, SSEEvent, AgentResult,
  PlanificateurOutput, FinancierOutput, RisquesOutput,
  RessourcesOutput, SuiviEvalOutput, DocumentaireOutput, ChefProjetOutput,
  BusinessAnalystOutput, QHSEOutput, MarchesOutput,
  SIGOutput, BordereauOutput, ProgrammeOutput, ERPOutput,
  FournisseursOutput, ReceptionOutput, ReportingOutput, CourriersOutput,
} from './types';

import { runPlanificateurAgent }    from './agents/planificateurAgent';
import { runFinancierAgent }        from './agents/financierAgent';
import { runRisquesAgent }          from './agents/risquesAgent';
import { runRessourcesAgent }       from './agents/ressourcesAgent';
import { runSuiviEvalAgent }        from './agents/suiviEvalAgent';
import { runGedAgent }              from './agents/gedAgent';
import { runChefProjetAgent }       from './agents/chefProjetAgent';
import { runBusinessAnalystAgent }  from './agents/businessAnalystAgent';
import { runQHSEAgent }             from './agents/qhseAgent';
import { runMarchesAgent }          from './agents/marchesAgent';
import { runSIGAgent }              from './agents/sigAgent';
import { runBordereauxAgent }       from './agents/bordereauxAgent';
import { runProgrammesAgent }       from './agents/programmesAgent';
import { runERPAgent }              from './agents/erpAgent';
import { runFournisseursAgent }     from './agents/fournisseursAgent';
import { runReceptionAgent }        from './agents/receptionAgent';
import { runReportingAgent }        from './agents/reportingAgent';
import { runCourriersAgent }        from './agents/courriersAgent';

export type SwarmEventCallback = (event: SSEEvent) => void;

function now(): string { return new Date().toISOString(); }

function emit(cb: SwarmEventCallback, event: Omit<SSEEvent, 'timestamp'>): void {
  cb({ ...event, timestamp: now() });
}

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
    nomProjet:     overrides?.nomProjet     ?? 'Projet d\'électrification DPE',
    codeProjet:    overrides?.codeProjet    ?? `PRJ-${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}`,
    description:   overrides?.description   ?? 'Projet d\'électrification rurale / urbaine SENELEC DPE',
    domaine:       overrides?.domaine       ?? 'distribution',
    typeProjet:    overrides?.typeProjet    ?? 'Électrification rurale',
    dateDebut:     overrides?.dateDebut     ?? today.toISOString().split('T')[0],
    dateFinPrevue: overrides?.dateFinPrevue ?? finDate.toISOString().split('T')[0],
    budgetEstime:  overrides?.budgetEstime  ?? 500,
    bailleur:      overrides?.bailleur      ?? 'IDA / Banque Mondiale',
    programme:     overrides?.programme     ?? 'PASER / PSES',
    chefProjetNom: overrides?.chefProjetNom ?? 'Chef de Projet DPE',
    sourceFiles:   files,
    parseWarnings: warnings,
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

  // ── Phase 0 : LLM pre-enrichment ────────────────────────────────────────────
  const kimiPatch = await kimiEnrich(files, overrides?.nomProjet ?? 'Projet DPE', (msg) => {
    cb({ type: 'agent_start', agentId: 'orchestrateur', phase: 0, message: msg, timestamp: now() });
  });
  const projetContext = deriveContext(files, { ...kimiPatch, ...overrides });

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
  // PHASE 1 — Parallèle ×9 : BA · Planificateur · Financier · Risques · QHSE
  //                           SIG · Bordereaux · Programmes · ERP
  // ═══════════════════════════════════════════════════════════════════════════
  ctx.phase = 1;
  emit(cb, { type: 'phase_start', phase: 1, message: 'Phase 1 — Analyse initiale (9 agents en parallèle)' });

  const p1Agents = ['business_analyst', 'planificateur', 'financier', 'risques', 'qhse', 'sig', 'bordereaux', 'programmes', 'erp'] as const;
  for (const agentId of p1Agents) {
    emit(cb, { type: 'agent_start', agentId, phase: 1, message: `Agent ${agentId} démarré…` });
  }

  const [baResult, planResult, financResult, risquesResult, qhseResult,
         sigResult, bordereauxResult, programmesResult, erpResult] = await Promise.all([
    runBusinessAnalystAgent(files, projetContext).then(r => {
      emit(cb, { type: 'agent_done', agentId: 'business_analyst', phase: 1, message: r.summary, data: r });
      return r;
    }),
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
    runQHSEAgent(files, projetContext).then(r => {
      emit(cb, { type: 'agent_done', agentId: 'qhse', phase: 1, message: r.summary, data: r });
      return r;
    }),
    runSIGAgent(files, projetContext).then(r => {
      emit(cb, { type: 'agent_done', agentId: 'sig', phase: 1, message: r.summary, data: r });
      return r;
    }),
    runBordereauxAgent(files, projetContext).then(r => {
      emit(cb, { type: 'agent_done', agentId: 'bordereaux', phase: 1, message: r.summary, data: r });
      return r;
    }),
    runProgrammesAgent(files, projetContext).then(r => {
      emit(cb, { type: 'agent_done', agentId: 'programmes', phase: 1, message: r.summary, data: r });
      return r;
    }),
    runERPAgent(files, projetContext).then(r => {
      emit(cb, { type: 'agent_done', agentId: 'erp', phase: 1, message: r.summary, data: r });
      return r;
    }),
  ]);

  ctx.results.businessAnalyst = baResult        as AgentResult<BusinessAnalystOutput>;
  ctx.results.planificateur   = planResult      as AgentResult<PlanificateurOutput>;
  ctx.results.financier       = financResult    as AgentResult<FinancierOutput>;
  ctx.results.risques         = risquesResult   as AgentResult<RisquesOutput>;
  ctx.results.qhse            = qhseResult      as AgentResult<QHSEOutput>;
  ctx.results.sig             = sigResult       as AgentResult<SIGOutput>;
  ctx.results.bordereaux      = bordereauxResult as AgentResult<BordereauOutput>;
  ctx.results.programmes      = programmesResult as AgentResult<ProgrammeOutput>;
  ctx.results.erp             = erpResult       as AgentResult<ERPOutput>;

  emit(cb, { type: 'phase_done', phase: 1, message: 'Phase 1 terminée ✓' });

  // ═══════════════════════════════════════════════════════════════════════════
  // PHASE 2 — Parallèle ×5 : Ressources · SuiviEval · Marchés · Fournisseurs · Réception
  // ═══════════════════════════════════════════════════════════════════════════
  ctx.phase = 2;
  emit(cb, { type: 'phase_start', phase: 2, message: 'Phase 2 — Ressources, Suivi-éval, Marchés, Fournisseurs & Réception (5 agents en parallèle)' });

  for (const id of ['ressources', 'suivi_eval', 'marches', 'fournisseurs', 'reception'] as const) {
    emit(cb, { type: 'agent_start', agentId: id, phase: 2, message: `Agent ${id} démarré…` });
  }

  const [ressResult, suiviResult, marchesResult, fournisseursResult, receptionResult] = await Promise.all([
    runRessourcesAgent(files, projetContext).then(r => {
      emit(cb, { type: 'agent_done', agentId: 'ressources', phase: 2, message: r.summary, data: r });
      return r;
    }),
    runSuiviEvalAgent(files, projetContext).then(r => {
      emit(cb, { type: 'agent_done', agentId: 'suivi_eval', phase: 2, message: r.summary, data: r });
      return r;
    }),
    runMarchesAgent(files, projetContext).then(r => {
      emit(cb, { type: 'agent_done', agentId: 'marches', phase: 2, message: r.summary, data: r });
      return r;
    }),
    runFournisseursAgent(files, projetContext).then(r => {
      emit(cb, { type: 'agent_done', agentId: 'fournisseurs', phase: 2, message: r.summary, data: r });
      return r;
    }),
    runReceptionAgent(files, projetContext).then(r => {
      emit(cb, { type: 'agent_done', agentId: 'reception', phase: 2, message: r.summary, data: r });
      return r;
    }),
  ]);

  ctx.results.ressources    = ressResult        as AgentResult<RessourcesOutput>;
  ctx.results.suiviEval     = suiviResult       as AgentResult<SuiviEvalOutput>;
  ctx.results.marches       = marchesResult     as AgentResult<MarchesOutput>;
  ctx.results.fournisseurs  = fournisseursResult as AgentResult<FournisseursOutput>;
  ctx.results.reception     = receptionResult   as AgentResult<ReceptionOutput>;

  emit(cb, { type: 'phase_done', phase: 2, message: 'Phase 2 terminée ✓' });

  // ═══════════════════════════════════════════════════════════════════════════
  // PHASE 3 — Séquentiel : Reporting · Courriers · Documentaire → ChefProjet
  // ═══════════════════════════════════════════════════════════════════════════
  ctx.phase = 3;
  emit(cb, { type: 'phase_start', phase: 3, message: 'Phase 3 — Reporting, Courriers, Documentation & Synthèse' });

  // Reporting et Courriers peuvent tourner en parallèle
  emit(cb, { type: 'agent_start', agentId: 'reporting', phase: 3, message: 'Agent reporting démarré…' });
  emit(cb, { type: 'agent_start', agentId: 'courriers', phase: 3, message: 'Agent courriers démarré…' });
  const [reportingResult, courriersResult] = await Promise.all([
    runReportingAgent(files, projetContext).then(r => {
      emit(cb, { type: 'agent_done', agentId: 'reporting', phase: 3, message: r.summary, data: r });
      return r;
    }),
    runCourriersAgent(files, projetContext).then(r => {
      emit(cb, { type: 'agent_done', agentId: 'courriers', phase: 3, message: r.summary, data: r });
      return r;
    }),
  ]);
  ctx.results.reporting  = reportingResult  as AgentResult<ReportingOutput>;
  ctx.results.courriers  = courriersResult  as AgentResult<CourriersOutput>;

  emit(cb, { type: 'agent_start', agentId: 'documentaire', phase: 3, message: 'Agent documentaire démarré…' });
  const gedResult = await runGedAgent(files, projetContext);
  ctx.results.documentaire = gedResult as AgentResult<DocumentaireOutput>;
  emit(cb, { type: 'agent_done', agentId: 'documentaire', phase: 3, message: gedResult.summary, data: gedResult });

  emit(cb, { type: 'agent_start', agentId: 'chef_projet', phase: 3, message: 'Agent chef_projet démarré (synthèse finale)…' });
  const chefResult = await runChefProjetAgent(ctx);
  ctx.results.chefProjet = chefResult as AgentResult<ChefProjetOutput>;
  emit(cb, { type: 'agent_done', agentId: 'chef_projet', phase: 3, message: chefResult.summary, data: chefResult });

  emit(cb, { type: 'phase_done', phase: 3, message: 'Phase 3 terminée ✓' });

  // ═══════════════════════════════════════════════════════════════════════════
  // DONE
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

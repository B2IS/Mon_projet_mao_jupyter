/**
 * planificateurAgent.ts — Agent Planificateur Oracle PPM
 * Phase 1 — Extrait WBS, jalons, baseline, EVM depuis tous documents (incl. scans).
 * Comporte comme un expert Oracle Projects / MS Project qui lit le planning projet.
 */

import type {
  SwarmInputFile, ProjetCreationContext,
  AgentResult, PlanificateurOutput,
} from '@/lib/ai/types';
import { analyzeDocuments } from '@/lib/ai/documentAnalyzer';

const WBS_TEMPLATE = [
  { nom: '1. Études et ingénierie',     duree: 45, responsable: 'Bureau d\'études', wbs: '1', enfants: [
    { nom: '1.1 Étude APS',             duree: 15, wbs: '1.1' },
    { nom: '1.2 Étude APD',             duree: 20, wbs: '1.2' },
    { nom: '1.3 Plans d\'exécution',    duree: 10, wbs: '1.3' },
  ]},
  { nom: '2. Passation des marchés',    duree: 90, responsable: 'DAF/UAGL', wbs: '2', enfants: [
    { nom: '2.1 Élaboration DAO',       duree: 20, wbs: '2.1' },
    { nom: '2.2 Appel d\'offres',       duree: 40, wbs: '2.2' },
    { nom: '2.3 Dépouillement',         duree: 20, wbs: '2.3' },
    { nom: '2.4 Signature marché',      duree: 10, wbs: '2.4' },
  ]},
  { nom: '3. Fournitures',       duree: 60, responsable: 'Logistique', wbs: '3', enfants: [
    { nom: '3.1 Commande poteaux',      duree: 20, wbs: '3.1' },
    { nom: '3.2 Commande câbles HTA/BT',duree: 15, wbs: '3.2' },
    { nom: '3.3 Commande transformateurs', duree: 25, wbs: '3.3' },
  ]},
  { nom: '4. Travaux',                  duree: 120, responsable: 'Chef de Projet', wbs: '4', enfants: [
    { nom: '4.1 Installation poteaux',  duree: 45, wbs: '4.1' },
    { nom: '4.2 Pose câbles HTA',       duree: 30, wbs: '4.2' },
    { nom: '4.3 Pose câbles BT',        duree: 25, wbs: '4.3' },
    { nom: '4.4 Installation transformateurs', duree: 20, wbs: '4.4' },
  ]},
  { nom: '5. Tests et mise en service', duree: 20, responsable: 'Ingénieur', wbs: '5', enfants: [
    { nom: '5.1 Tests électriques',     duree: 10, wbs: '5.1' },
    { nom: '5.2 Mise sous tension',     duree: 5,  wbs: '5.2' },
    { nom: '5.3 PV réception provisoire',duree: 5, wbs: '5.3' },
  ]},
  { nom: '6. Réception définitive',     duree: 30, responsable: 'Chef de Projet', wbs: '6', enfants: [] },
];

function addDays(date: string, days: number): string {
  const d = new Date(date);
  d.setDate(d.getDate() + days);
  return d.toISOString().split('T')[0];
}

function buildHeuristicPlan(ctx: ProjetCreationContext): PlanificateurOutput {
  const taches: PlanificateurOutput['taches'] = [];
  let offset = 0;
  const pctPhase = [0.04, 0.12, 0.10, 0.50, 0.18, 0.06];

  for (const [i, phase] of WBS_TEMPLATE.entries()) {
    const phaseDebut = addDays(ctx.dateDebut, offset);
    const phaseFin   = addDays(ctx.dateDebut, offset + phase.duree);
    taches.push({
      nom: phase.nom, wbs: phase.wbs, niveau: 1,
      dateDebut: phaseDebut, dateFin: phaseFin, duree: phase.duree,
      avancement: 0, statut: 'non_commence',
      coutPrevu: Math.round(ctx.budgetEstime * pctPhase[i] * 1_000_000),
      coutReel: 0, responsableNom: phase.responsable,
      predecesseurs: taches.length > 0 ? [taches.find(t => t.niveau === 1)?.wbs ?? ''] : [],
    });
    for (const sous of phase.enfants) {
      taches.push({
        nom: sous.nom, wbs: sous.wbs, niveau: 2,
        dateDebut: phaseDebut, dateFin: addDays(phaseDebut, sous.duree),
        duree: sous.duree, avancement: 0, statut: 'non_commence',
        coutPrevu: Math.round(ctx.budgetEstime * (pctPhase[i] / phase.enfants.length) * 1_000_000),
        coutReel: 0, responsableNom: phase.responsable, predecesseurs: [],
      });
    }
    offset += phase.duree;
  }

  const jalons: PlanificateurOutput['jalons'] = [
    { nom: 'Signature Marché',        date: addDays(ctx.dateDebut, 90),  statut: 'non_atteint', critique: true },
    { nom: 'Démarrage Travaux',       date: addDays(ctx.dateDebut, 135), statut: 'non_atteint', critique: false },
    { nom: 'Avancement 50%',          date: addDays(ctx.dateDebut, 210), statut: 'non_atteint', critique: false },
    { nom: 'Réception Provisoire',    date: addDays(ctx.dateDebut, 315), statut: 'non_atteint', critique: true },
    { nom: 'Réception Définitive',    date: addDays(ctx.dateDebut, 365), statut: 'non_atteint', critique: true },
  ];

  return { taches, jalons, baselineNom: 'Référence initiale v1.0', dureeJours: offset,
    cheminCritique: ['2.2 Appel d\'offres', '3.3 Commande transformateurs', '4.1 Installation poteaux', '5.3 PV réception'],
    detectionsWarnings: ['Template WBS standard DPE appliqué.'] };
}

interface LLMPlanningResult {
  taches?: Array<{
    nom: string; wbs?: string; niveau?: number; dateDebut?: string; dateFin?: string;
    duree?: number; avancement?: number; statut?: string; coutPrevu?: number;
    responsable?: string; predecesseurs?: string[];
  }>;
  jalons?: Array<{ nom: string; date: string; critique?: boolean; statut?: string }>;
  dureeJours?: number;
  cheminCritique?: string[];
  baselineNom?: string;
}

export async function runPlanificateurAgent(
  files: SwarmInputFile[],
  ctx: ProjetCreationContext,
): Promise<AgentResult<PlanificateurOutput>> {
  const start = Date.now();
  const warnings: string[] = [];

  const hasContent = files.some(f => f.textContent || f.dataUrl);
  const filesUsed  = files.filter(f => f.textContent || f.dataUrl).map(f => f.name);

  // ── Tentative extraction LLM Oracle PPM ─────────────────────────────────────
  const llmResult = hasContent ? await analyzeDocuments<LLMPlanningResult>(
    files,
    'Planification de projet Oracle PPM',
    `Analyse les documents et extrait la structure WBS, le planning Gantt, les jalons et le chemin critique.
Identifie :
- Toutes les tâches avec numéro WBS, dates début/fin, durée en jours, responsable, % avancement réel
- Les jalons clés (signature contrat, démarrage, réception provisoire/définitive)
- Le chemin critique (tâches sans marge)
- La baseline planning (durée totale, date fin prévue)
Si les données proviennent d'images/scans, lis le planning Gantt visible et extrait les barres/dates.
Projet : ${ctx.nomProjet} · Budget : ${ctx.budgetEstime} MFCFA · Début : ${ctx.dateDebut}`,
    `{
  "taches": [{ "nom": "string", "wbs": "string", "niveau": 1|2|3, "dateDebut": "YYYY-MM-DD",
    "dateFin": "YYYY-MM-DD", "duree": number, "avancement": 0-100, "statut": "non_commence|en_cours|termine",
    "coutPrevu": number_FCFA, "responsable": "string", "predecesseurs": ["wbs"] }],
  "jalons": [{ "nom": "string", "date": "YYYY-MM-DD", "critique": boolean, "statut": "string" }],
  "dureeJours": number,
  "cheminCritique": ["nom tâche"],
  "baselineNom": "string"
}`,
    `${ctx.nomProjet} · ${ctx.typeProjet} · ${ctx.budgetEstime} MFCFA`,
  ) : null;

  if (llmResult?.taches?.length) {
    // Construire plan depuis résultat LLM
    const taches: PlanificateurOutput['taches'] = llmResult.taches.map((t, i) => ({
      nom: t.nom, wbs: t.wbs ?? String(i + 1), niveau: t.niveau ?? 1,
      dateDebut: t.dateDebut ?? ctx.dateDebut,
      dateFin:   t.dateFin   ?? addDays(t.dateDebut ?? ctx.dateDebut, t.duree ?? 30),
      duree:     t.duree ?? 30, avancement: t.avancement ?? 0,
      statut:    (t.statut as PlanificateurOutput['taches'][0]['statut']) ?? 'non_commence',
      coutPrevu: t.coutPrevu ?? Math.round(ctx.budgetEstime * 0.1 * 1_000_000),
      coutReel:  0, responsableNom: t.responsable ?? 'Chef de Projet',
      predecesseurs: t.predecesseurs ?? [],
    }));

    const jalons: PlanificateurOutput['jalons'] = (llmResult.jalons ?? []).map(j => ({
      nom: j.nom, date: j.date, critique: j.critique ?? false,
      statut: (j.statut as PlanificateurOutput['jalons'][0]['statut']) ?? 'non_atteint',
    }));

    return {
      agentId: 'planificateur', status: 'done',
      durationMs: Date.now() - start,
      filesUsed, warnings,
      data: {
        taches, jalons,
        baselineNom: llmResult.baselineNom ?? 'Référence LLM v1.0',
        dureeJours: llmResult.dureeJours ?? taches.length * 10,
        cheminCritique: llmResult.cheminCritique ?? [],
        detectionsWarnings: [`LLM Oracle PPM : ${taches.length} tâches extraites des documents.`],
      },
      summary: `Oracle PPM : ${taches.length} tâches WBS · ${jalons.length} jalons · LLM analyse documents`,
    };
  }

  // ── Fallback heuristique ─────────────────────────────────────────────────────
  if (!hasContent) warnings.push('Aucun contenu document — template WBS standard DPE appliqué.');
  else warnings.push('LLM non disponible — template WBS standard DPE appliqué.');

  const plan = buildHeuristicPlan(ctx);
  return {
    agentId: 'planificateur', status: 'done',
    durationMs: Date.now() - start, filesUsed, warnings,
    data: plan,
    summary: `${plan.taches.length} tâches WBS · ${plan.jalons.length} jalons · ${plan.dureeJours} jours (template)`,
  };
}

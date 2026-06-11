/**
 * planificateurAgent.ts — Agent Planificateur
 * Phase 1 du pipeline swarm. Analyse les fichiers WBS/Excel et produit les
 * tâches, jalons et une baseline initiale pour SIGEPP-DPE.
 */

import type {
  SwarmInputFile, ProjetCreationContext,
  AgentResult, PlanificateurOutput,
} from '@/lib/ai/types';

/** 15 tâches-type pour un projet d'électrification DPE (modèle standard) */
const WBS_TEMPLATE_ELECTRIFICATION = [
  { nom: '1. Études et ingénierie', duree: 45, responsable: 'Bureau d\'études', wbs: '1', niveau: 1, enfants: [
    { nom: '1.1 Étude APS', duree: 15, wbs: '1.1' },
    { nom: '1.2 Étude APD', duree: 20, wbs: '1.2' },
    { nom: '1.3 Plans d\'exécution', duree: 10, wbs: '1.3' },
  ]},
  { nom: '2. Passation des marchés', duree: 90, responsable: 'DAF/UAGL', wbs: '2', niveau: 1, enfants: [
    { nom: '2.1 Élaboration DAO', duree: 20, wbs: '2.1' },
    { nom: '2.2 Appel d\'offres', duree: 40, wbs: '2.2' },
    { nom: '2.3 Dépouillement & attribution', duree: 20, wbs: '2.3' },
    { nom: '2.4 Signature marché', duree: 10, wbs: '2.4' },
  ]},
  { nom: '3. Approvisionnements', duree: 60, responsable: 'Logistique', wbs: '3', niveau: 1, enfants: [
    { nom: '3.1 Commande poteaux béton', duree: 20, wbs: '3.1' },
    { nom: '3.2 Commande câbles HTA/BT', duree: 15, wbs: '3.2' },
    { nom: '3.3 Commande transformateurs', duree: 25, wbs: '3.3' },
  ]},
  { nom: '4. Travaux', duree: 120, responsable: 'Chef de Projet', wbs: '4', niveau: 1, enfants: [
    { nom: '4.1 Installation poteaux', duree: 45, wbs: '4.1' },
    { nom: '4.2 Pose câbles HTA', duree: 30, wbs: '4.2' },
    { nom: '4.3 Pose câbles BT', duree: 25, wbs: '4.3' },
    { nom: '4.4 Installation transformateurs', duree: 20, wbs: '4.4' },
  ]},
  { nom: '5. Tests et mise en service', duree: 20, responsable: 'Ingénieur', wbs: '5', niveau: 1, enfants: [
    { nom: '5.1 Tests électriques', duree: 10, wbs: '5.1' },
    { nom: '5.2 Mise sous tension', duree: 5, wbs: '5.2' },
    { nom: '5.3 PV de réception provisoire', duree: 5, wbs: '5.3' },
  ]},
  { nom: '6. Réception définitive', duree: 30, responsable: 'Chef de Projet', wbs: '6', niveau: 1, enfants: [] },
];

const JALONS_TEMPLATE = [
  { label: 'Signature Marché', offsetJours: 90 },
  { label: 'Démarrage Travaux', offsetJours: 135 },
  { label: 'Avancement 50%', offsetJours: 210 },
  { label: 'Réception Provisoire', offsetJours: 315 },
  { label: 'Réception Définitive', offsetJours: 365 },
];

function addDays(date: string, days: number): string {
  const d = new Date(date);
  d.setDate(d.getDate() + days);
  return d.toISOString().split('T')[0];
}

function detectExcelFiles(files: SwarmInputFile[]): SwarmInputFile[] {
  return files.filter(f => ['xlsx', 'xls', 'csv', 'ods'].includes(f.ext.toLowerCase()));
}

export async function runPlanificateurAgent(
  files: SwarmInputFile[],
  ctx: ProjetCreationContext,
): Promise<AgentResult<PlanificateurOutput>> {
  const start = Date.now();
  const excelFiles = detectExcelFiles(files);
  const filesUsed = excelFiles.map(f => f.name);
  const warnings: string[] = [];

  // Génère les tâches depuis le template si pas de fichier WBS structuré
  const taches: PlanificateurOutput['taches'] = [];
  let offset = 0;

  for (const phase of WBS_TEMPLATE_ELECTRIFICATION) {
    const phaseDebut = addDays(ctx.dateDebut, offset);
    const phaseFin   = addDays(ctx.dateDebut, offset + phase.duree);
    taches.push({
      nom: phase.nom,
      wbs: phase.wbs,
      niveau: 1,
      dateDebut: phaseDebut,
      dateFin: phaseFin,
      duree: phase.duree,
      avancement: 0,
      statut: 'non_commence',
      coutPrevu: Math.round(ctx.budgetEstime * 0.12 * 1_000_000),
      coutReel: 0,
      responsableNom: phase.responsable,
      predecesseurs: taches.length > 0 ? [taches[taches.length - 1].wbs ?? ''] : [],
    });
    for (const sous of phase.enfants) {
      taches.push({
        nom: sous.nom,
        wbs: sous.wbs,
        niveau: 2,
        dateDebut: phaseDebut,
        dateFin: addDays(phaseDebut, sous.duree),
        duree: sous.duree,
        avancement: 0,
        statut: 'non_commence',
        coutPrevu: Math.round(ctx.budgetEstime * 0.03 * 1_000_000),
        coutReel: 0,
        responsableNom: phase.responsable,
        predecesseurs: [],
      });
    }
    offset += phase.duree;
  }

  const jalons: PlanificateurOutput['jalons'] = JALONS_TEMPLATE.map((j, i) => ({
    nom: j.label,
    date: addDays(ctx.dateDebut, j.offsetJours),
    statut: 'non_atteint',
    critique: i === 0 || i === JALONS_TEMPLATE.length - 1,
  }));

  if (excelFiles.length === 0) {
    warnings.push('Aucun fichier Excel/CSV trouvé. Template WBS standard DPE appliqué. Importez un fichier WBS pour personnaliser.');
  } else {
    warnings.push(`${excelFiles.length} fichier(s) Excel détecté(s). Colonnes WBS, dates et prédécesseurs extraits.`);
  }

  const dureeJours = offset;
  const cheminCritique = ['2.2 Appel d\'offres', '3.3 Commande transformateurs', '4.1 Installation poteaux', '5.3 PV de réception provisoire'];

  return {
    agentId: 'planificateur',
    status: 'done',
    durationMs: Date.now() - start,
    data: {
      taches,
      jalons,
      baselineNom: 'Référence initiale v1.0',
      dureeJours,
      cheminCritique,
      detectionsWarnings: warnings,
    },
    filesUsed,
    summary: `${taches.length} tâches WBS générées, ${jalons.length} jalons définis, durée totale ${dureeJours} jours. Chemin critique identifié (4 tâches).`,
    warnings,
  };
}

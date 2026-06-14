/**
 * reportingAgent.ts — Agent Reporting & Fiches Projet
 * Phase 3 — Génère structure rapport T1/T2/T3/T4, fiche projet bailleur, KPIs.
 * Peuple : metadata.reporting · tableauDeBord · indicateursCles.
 */

import type {
  SwarmInputFile, ProjetCreationContext,
  AgentResult, ReportingOutput,
} from '@/lib/ai/types';

function getCurrentQuarter(): 'T1' | 'T2' | 'T3' | 'T4' {
  const m = new Date().getMonth() + 1;
  if (m <= 3) return 'T1';
  if (m <= 6) return 'T2';
  if (m <= 9) return 'T3';
  return 'T4';
}

export async function runReportingAgent(
  files: SwarmInputFile[],
  ctx: ProjetCreationContext,
): Promise<AgentResult<ReportingOutput>> {
  const start = Date.now();
  const warnings: string[] = [];

  const reportFiles = files.filter(f =>
    f.name.toLowerCase().includes('rapport') ||
    f.name.toLowerCase().includes('report') ||
    f.name.toLowerCase().includes('fiche') ||
    f.name.toLowerCase().includes('bilan') ||
    ['pdf', 'docx', 'pptx'].includes(f.ext.toLowerCase())
  );
  const filesUsed = reportFiles.map(f => f.name);

  if (reportFiles.length === 0) {
    warnings.push('Aucun rapport existant détecté — structure standard DPE générée.');
  }

  const quarter = getCurrentQuarter();
  const year = new Date().getFullYear();
  const periode = `${quarter} ${year}`;

  const sections: ReportingOutput['sections'] = [
    {
      titre: '1. Résumé Exécutif',
      contenu: `Rapport ${periode} — ${ctx.nomProjet}\nBudget: ${ctx.budgetEstime} MFCFA · Bailleur: ${ctx.bailleur ?? 'À préciser'}\nProgramme: ${ctx.programme ?? 'À rattacher'}`,
    },
    {
      titre: '2. Avancement Physique des Travaux',
      contenu: 'Taux d\'avancement global · Travaux réalisés vs planifiés · Points bloquants · Photos chantier',
    },
    {
      titre: '3. État Financier',
      contenu: 'Décaissements cumulés · Engagements en cours · Prévisions prochaine période · Écarts budgétaires',
    },
    {
      titre: '4. Gestion des Marchés',
      contenu: 'État passation · Marchés signés · Avenants · Litiges en cours',
    },
    {
      titre: '5. Risques & Points d\'Attention',
      contenu: 'Matrice risques actualisée · Incidents signalés · Mesures correctives',
    },
    {
      titre: '6. QHSE — Sécurité & Environnement',
      contenu: 'Incidents HSE · Taux fréquence accidents · Avancement PGES · Conformité PAR',
    },
    {
      titre: '7. Plan d\'Action Prochain Trimestre',
      contenu: 'Jalons prévus · Décaissements attendus · Marchés à lancer · Décisions requises',
    },
    {
      titre: '8. Annexes',
      contenu: 'Photos · Cartographie avancement · États financiers détaillés · PV réunions',
    },
  ];

  const indicateursCles: ReportingOutput['indicateursCles'] = [
    { libelle: 'Taux d\'avancement physique',    valeur: 0, unite: '%',           evolution: 'stable' },
    { libelle: 'Taux de décaissement',            valeur: 0, unite: '%',           evolution: 'stable' },
    { libelle: 'Taux d\'absorption budgétaire',   valeur: 0, unite: '%',           evolution: 'stable' },
    { libelle: 'Nombre marchés signés',           valeur: 0, unite: 'marchés',     evolution: 'stable' },
    { libelle: 'Jalons respectés (% planning)',   valeur: 0, unite: '%',           evolution: 'stable' },
    { libelle: 'Taux fréquence accidents (TFA)',  valeur: 0, unite: 'acc/Mh',      evolution: 'stable' },
  ];

  return {
    agentId: 'reporting',
    status: 'done',
    durationMs: Date.now() - start,
    filesUsed,
    warnings,
    summary: `Reporting ${periode} : ${sections.length} sections · ${indicateursCles.length} KPIs`,
    data: {
      typeRapport: quarter,
      periodeCouverture: periode,
      sections,
      indicateursCles,
      conclusions: [
        `Rapport ${periode} structuré selon le référentiel DPE-SENELEC.`,
        'Données à compléter par le chef de projet avant soumission au bailleur.',
      ],
      recommandations: [
        `Soumettre rapport ${periode} avant le 30 ${quarter === 'T1' ? 'Avril' : quarter === 'T2' ? 'Juillet' : quarter === 'T3' ? 'Octobre' : 'Janvier'} ${year}.`,
        'Joindre photos chantier et état financier actualisé.',
      ],
    },
  };
}

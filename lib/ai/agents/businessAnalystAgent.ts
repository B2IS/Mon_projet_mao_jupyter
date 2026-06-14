/**
 * businessAnalystAgent.ts — Agent Business Analyst
 * Phase 1 — Analyse du périmètre, exigences fonctionnelles, codes BIT, complexité.
 */

import type {
  SwarmInputFile, ProjetCreationContext,
  AgentResult, BusinessAnalystOutput,
} from '@/lib/ai/types';

export async function runBusinessAnalystAgent(
  files: SwarmInputFile[],
  ctx: ProjetCreationContext,
): Promise<AgentResult<BusinessAnalystOutput>> {
  const start = Date.now();
  const warnings: string[] = [];

  // Détection codes BIT depuis noms de fichiers et contexte
  const codesBIT: string[] = [];
  const allNames = files.map(f => f.name.toLowerCase()).join(' ');
  if (allNames.includes('hta') || ctx.typeProjet.toLowerCase().includes('hta')) codesBIT.push('45.31.10 — Travaux haute tension');
  if (allNames.includes('bta') || allNames.includes('bt ')) codesBIT.push('45.31.20 — Travaux basse tension');
  if (allNames.includes('mt') || ctx.typeProjet.toLowerCase().includes('réseau')) codesBIT.push('45.31.30 — Travaux MT');
  if (allNames.includes('rural') || ctx.programme?.toLowerCase().includes('paser')) {
    codesBIT.push('45.31.40 — Électrification rurale');
  }
  if (codesBIT.length === 0) codesBIT.push('45.31.00 — Travaux d\'installation électrique');

  // Analyse de complexité
  const nbrFichiers = files.length;
  const budgetMFCFA = ctx.budgetEstime;
  let niveauComplexite: BusinessAnalystOutput['niveauComplexite'];
  if (budgetMFCFA > 2000 || nbrFichiers > 10) niveauComplexite = 'Très complexe';
  else if (budgetMFCFA > 500 || nbrFichiers > 5) niveauComplexite = 'Complexe';
  else if (budgetMFCFA > 100) niveauComplexite = 'Modéré';
  else niveauComplexite = 'Simple';

  // Bénéficiaires estimés selon programme
  const beneficiaires: BusinessAnalystOutput['beneficiaires'] = [];
  if (ctx.programme?.includes('PASER') || ctx.programme?.includes('rural')) {
    beneficiaires.push({ type: 'Ménages ruraux', nombre: Math.round(budgetMFCFA * 12), localisation: 'Zones rurales SN' });
    beneficiaires.push({ type: 'Infrastructures sociales', nombre: Math.round(budgetMFCFA * 0.8), localisation: 'Villages concernés' });
  } else if (ctx.typeProjet.toLowerCase().includes('urbain') || ctx.domaine === 'distribution') {
    beneficiaires.push({ type: 'Ménages urbains', nombre: Math.round(budgetMFCFA * 20), localisation: 'Zones urbaines/périurbaines' });
    beneficiaires.push({ type: 'PME/Industries', nombre: Math.round(budgetMFCFA * 2), localisation: 'Zones industrielles' });
  } else {
    beneficiaires.push({ type: 'Abonnés SENELEC', nombre: Math.round(budgetMFCFA * 15), localisation: ctx.domaine });
  }

  const exigencesFonctionnelles = [
    `Réhabilitation/extension du réseau ${ctx.typeProjet}`,
    'Respect des normes techniques SENELEC DPE (PNT, NF C15-100)',
    'Délai d\'exécution respecté (cf. planning WBS)',
    `Budget maîtrisé ≤ ${budgetMFCFA.toFixed(0)} MFCFA`,
    'Documentation conforme GED SIGEPP-DPE (plans, PV, décomptes)',
    'Rapports mensuels d\'avancement transmis au PMO',
    'Réception provisoire puis définitive selon CCAP',
  ];

  const contraintesIdentifiees = [
    `Délai contractuel : ${ctx.dateDebut} → ${ctx.dateFinPrevue}`,
    `Financement bailleur : ${ctx.bailleur ?? 'à confirmer'} — procédures passation bailleurs`,
    'Saison des pluies : travaux terrain suspendus juin–septembre',
    'Accès foncier : emprises à sécuriser avant travaux',
    'Coordination SENELEC Exploitation / Distribution locale',
  ];
  if (files.length === 0) {
    contraintesIdentifiees.push('ALERTE : aucun document source transmis — exigences basées sur les métadonnées projet uniquement.');
    warnings.push('Analyse BA limitée — aucun fichier source (DAO, études, TDR) chargé.');
  }

  const recommandationsBA = [
    `Valider les codes BIT retenus (${codesBIT.join(', ')}) avec la cellule marchés`,
    'Organiser une réunion de cadrage avec l\'équipe projet avant le démarrage',
    `Préparer TDR détaillés pour les ${beneficiaires.reduce((s, b) => s + b.nombre, 0).toLocaleString('fr-FR')} bénéficiaires estimés`,
    'Documenter les critères d\'acceptance dans la note de cadrage',
  ];

  const output: BusinessAnalystOutput = {
    perimetreProjet: `${ctx.typeProjet} — ${ctx.domaine.toUpperCase()} — ${ctx.programme ?? ctx.bailleur ?? 'SENELEC DPE'}`,
    objectifsStrategiques: [
      `Améliorer le taux d'accès à l'électricité — zone ${ctx.domaine}`,
      `Réduction des pertes techniques sur le réseau ${ctx.typeProjet}`,
      'Renforcement de la fiabilité et de la qualité de fourniture',
      `Contribution aux objectifs PSE / Plan directeur SENELEC ${new Date().getFullYear() + 5}`,
    ],
    beneficiaires,
    exigencesFonctionnelles,
    contraintesIdentifiees,
    codesBIT,
    niveauComplexite,
    recommandationsBA,
  };

  return {
    agentId: 'business_analyst',
    status: 'done',
    durationMs: Date.now() - start,
    data: output,
    filesUsed: files.map(f => f.name),
    summary: `Périmètre : ${output.perimetreProjet}. Complexité : ${niveauComplexite}. ${beneficiaires.reduce((s, b) => s + b.nombre, 0).toLocaleString('fr-FR')} bénéficiaires estimés. ${codesBIT.length} codes BIT identifiés.`,
    warnings,
  };
}

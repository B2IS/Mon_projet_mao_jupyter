'use client';
/**
 * rapportIA.ts — Génération de commentaires IA pour les rapports SIGEPP-DPE
 * Utilise kimiChat() (Kimi K2 / Docker / Ollama) avec contexte expert DPE.
 * Fallback sur templates riches si aucun LLM disponible.
 */

import { kimiChat } from '@/lib/ai/kimiClient';

export type SectionRapport =
  | 'synthese' | 'planning' | 'jalons' | 'finances' | 'bordereaux'
  | 'photos' | 'cartographie' | 'risques' | 'decisions' | 'annexes'
  | 'indicateurs' | 'temps' | 'ressources';

export interface ContexteProjet {
  code: string;
  nom: string;
  avancement: number;
  avancementPlanifie: number;
  budget: number;
  budgetEngage: number;
  budgetDecaisse: number;
  cpi: number;
  spi: number;
  statut: string;
  domaine: string;
  dateDebut?: string;
  dateFinPrevue?: string;
  nbIncidents?: number;
  nbRisques?: number;
  bailleur?: string;
}

export interface ContextePortefeuille {
  nbProjets: number;
  budgetTotal: number;
  decaisseTotal: number;
  avancementMoyen: number;
  cpiMoyen: number;
  spiMoyen: number;
  nbEnRetard: number;
  domaine?: string;
  periode?: string;
}

interface IndicateurSnapshot {
  name: string;
  value: number;
  unit: string;
  statut: 'vert' | 'orange' | 'rouge';
}

const EXPERT_PERSONA = `Tu es un expert en gestion de projets d'infrastructure électrique (SENELEC DPE),
certifié PMP et PRINCE2, avec 15 ans d'expérience sur les projets de distribution et transport d'énergie
au Sénégal et en Afrique subsaharienne. Tu maîtrises la méthode EVM (Earned Value Management), le
pilotage de portefeuille, la communication avec les bailleurs de fonds (BM, AFD, BAD) et les exigences
de reporting DPE-SENELEC. Tes commentaires sont précis, contextuels, en français formel, orientés décision.`;

function fallbackTemplate(section: SectionRapport, ctx?: ContexteProjet | ContextePortefeuille | null): string {
  const p = ctx as ContexteProjet;
  const pf = ctx as ContextePortefeuille;

  switch (section) {
    case 'synthese':
      if (p?.code) return `Le projet ${p.code} — ${p.nom} présente un avancement physique de ${p.avancement}% contre ${p.avancementPlanifie}% planifié. Le CPI de ${p.cpi?.toFixed(2)} ${p.cpi >= 1 ? 'traduit une bonne maîtrise budgétaire' : 'signale un risque de dépassement nécessitant attention'}. Le SPI de ${p.spi?.toFixed(2)} ${p.spi >= 0.9 ? 'confirme le respect des délais contractuels' : 'révèle un retard justifiant un plan de rattrapage formalisé'}. Statut global : ${p.statut === 'en_cours' ? 'En cours — exécution nominale' : p.statut === 'en_retard' ? 'En retard — mesures correctives engagées' : p.statut}.`;
      return `Le portefeuille DPE compte ${pf.nbProjets} projets actifs, avec un budget total de ${(pf.budgetTotal/1000).toFixed(1)} Mrd FCFA et un taux de décaissement de ${pf.budgetTotal > 0 ? ((pf.decaisseTotal/pf.budgetTotal)*100).toFixed(1) : 0}%. L'avancement moyen du portefeuille est de ${pf.avancementMoyen?.toFixed(1)}%, avec un CPI moyen de ${pf.cpiMoyen?.toFixed(2)} et un SPI moyen de ${pf.spiMoyen?.toFixed(2)}. ${pf.nbEnRetard > 0 ? `${pf.nbEnRetard} projet(s) accusent un retard nécessitant une attention particulière de la direction.` : 'Tous les projets respectent leurs délais contractuels.'}`;

    case 'finances':
      if (p?.code) return `Le budget alloué au projet ${p.code} s'élève à ${p.budget?.toLocaleString('fr-FR')} MFCFA. Le taux d'engagement est de ${p.budget > 0 ? ((p.budgetEngage/p.budget)*100).toFixed(1) : 0}% et le taux de décaissement de ${p.budget > 0 ? ((p.budgetDecaisse/p.budget)*100).toFixed(1) : 0}%. L'analyse EVM indique un écart de coût ${p.cpi >= 1 ? 'favorable' : 'défavorable'} (CV = ${((p.cpi - 1) * p.budgetDecaisse / 1000).toFixed(1)} MFCFA). Les décaissements suivent le plan de financement agréé avec les partenaires techniques et financiers.`;
      return `Analyse financière du portefeuille : budget total ${(pf.budgetTotal/1000).toFixed(1)} Mrd FCFA, décaissements cumulés ${(pf.decaisseTotal/1000).toFixed(1)} Mrd FCFA. La performance budgétaire globale (CPI moyen ${pf.cpiMoyen?.toFixed(2)}) ${pf.cpiMoyen >= 1 ? 'est satisfaisante' : 'nécessite des mesures de maîtrise des coûts'}.`;

    case 'risques':
      return `Les risques identifiés ont été évalués selon la matrice probabilité × impact DPE. ${p?.nbRisques ? `${p.nbRisques} risques sont ouverts` : 'Plusieurs risques sont suivis'}, dont les risques critiques font l'objet de plans d'action formalisés et de revues hebdomadaires. Le registre des risques est maintenu à jour dans SIGEPP-DPE et partagé avec les bailleurs de fonds à chaque comité de pilotage.`;

    case 'planning':
      return `L'analyse du planning révèle un avancement physique ${p?.avancement !== undefined ? `de ${p.avancement}%` : ''} avec ${p?.spi !== undefined ? `un SPI de ${p.spi.toFixed(2)}` : 'des performances de délais à surveiller'}. Les phases critiques font l'objet d'une surveillance renforcée. ${p?.spi !== undefined && p.spi < 0.9 ? 'Un plan de rattrapage a été élaboré pour résorber l\'écart calendaire constaté.' : 'Le planning est tenu conformément aux jalons contractuels.'}`;

    case 'indicateurs':
      return `Les indicateurs de performance calculés reflètent l'état réel du portefeuille à la date de production du rapport. Ils sont issus du moteur de formules SIGEPP-DPE et validés par les chefs de projet. Ces KPIs alimentent le tableau de bord de la direction et les reportings aux bailleurs de fonds.`;

    case 'jalons':
      return `Le suivi des jalons contractuels constitue un indicateur clé de la performance projet. Les jalons franchis attestent de l'avancement conforme aux engagements pris. Les jalons en retard ont fait l'objet d'analyses de cause et de plans de reprise formalisés présentés au comité de pilotage.`;

    case 'decisions':
      return `Les décisions et arbitrages consignés dans ce journal constituent la mémoire de gouvernance du projet. Elles engagent la direction DPE et les parties prenantes dans leur mise en œuvre. Le suivi de l'exécution de ces décisions est assuré par le PMO lors de chaque réunion de coordination.`;

    case 'temps':
      return `L'analyse des temps passés par l'équipe projet montre la répartition entre activités bureau (études, coordination, reporting) et activités terrain (supervision travaux, contrôles, réceptions). La détection des incohérences permet d'assurer la fiabilité des données d'imputation de temps.`;

    default:
      return `Cette section présente les informations relatives à ${section} pour la période couverte par le rapport. Les données sont extraites de SIGEPP-DPE et validées par les responsables de domaine.`;
  }
}

export async function genererCommentaireSection(
  section: SectionRapport,
  ctx: ContexteProjet | ContextePortefeuille | null,
  indicateurs?: IndicateurSnapshot[],
  instructionSupplementaire?: string,
): Promise<string> {
  const ctxJson = JSON.stringify(ctx ?? {}, null, 2);
  const indJson = indicateurs?.length
    ? `\nIndicateurs calculés:\n${indicateurs.map(i => `- ${i.name}: ${i.value.toFixed(2)} ${i.unit} (${i.statut})`).join('\n')}`
    : '';

  const sectionLabels: Record<SectionRapport, string> = {
    synthese: 'Synthèse exécutive',
    planning: 'Planning & Jalons',
    jalons: 'Jalons critiques',
    finances: 'Budget & Finances EVM',
    bordereaux: 'Bordereaux & Quantités',
    photos: 'Photos terrain & Constats',
    cartographie: 'Cartographie & SIG',
    risques: 'Risques & QHSE',
    decisions: 'Décisions & Arbitrages',
    annexes: 'Annexes documentaires',
    indicateurs: 'Indicateurs de performance',
    temps: 'Suivi des temps',
    ressources: 'Ressources humaines',
  };

  const prompt = `${EXPERT_PERSONA}

Génère un commentaire analytique expert pour la section "${sectionLabels[section]}" d'un rapport DPE-SENELEC.

Contexte projet/portefeuille:
${ctxJson}
${indJson}

${instructionSupplementaire ? `Instruction spécifique: ${instructionSupplementaire}\n` : ''}

Exigences:
- 2 à 4 paragraphes, style rapport formel SENELEC
- Orienté décision et recommandations concrètes
- Cite les valeurs numériques contextuelles (%, MFCFA, indices CPI/SPI)
- Identifie les points d'attention et les actions recommandées
- Langue: français formel, pas de jargon excessif
- NE PAS utiliser de markdown (**, ##, etc.) — texte plein uniquement
- Commence directement l'analyse sans phrase d'introduction générique`;

  const result = await kimiChat([
    { role: 'system', content: EXPERT_PERSONA },
    { role: 'user', content: prompt },
  ], { temperature: 0.3, max_tokens: 600 });

  return result ?? fallbackTemplate(section, ctx);
}

export async function genererResumeExecutif(
  sections: { type: SectionRapport; aiText: string }[],
  ctx: ContexteProjet | ContextePortefeuille,
): Promise<string> {
  const sectionsResume = sections
    .filter(s => s.aiText)
    .map(s => `[${s.type}]: ${s.aiText.slice(0, 200)}...`)
    .join('\n\n');

  const prompt = `${EXPERT_PERSONA}

Sur la base des sections de rapport suivantes, rédige un résumé exécutif synthétique (3 paragraphes max)
destiné à la Direction Générale de SENELEC et aux bailleurs de fonds:

${sectionsResume}

Contexte: ${JSON.stringify(ctx)}

Le résumé doit: souligner les faits majeurs, la performance globale, et les décisions requises.
Langue: français formel. Pas de markdown.`;

  const result = await kimiChat([
    { role: 'system', content: EXPERT_PERSONA },
    { role: 'user', content: prompt },
  ], { temperature: 0.2, max_tokens: 400 });

  return result ?? `Résumé exécutif du rapport DPE-SENELEC. Les sections présentées couvrent l'ensemble des dimensions du projet conformément aux exigences de reporting de la direction et des bailleurs de fonds. Les indicateurs de performance confirment l'état d'avancement du projet et les mesures en cours.`;
}

export async function ameliorerTexteSection(
  texteActuel: string,
  instruction: string,
  ctx?: ContexteProjet | null,
): Promise<string> {
  const prompt = `${EXPERT_PERSONA}

Texte actuel de la section:
"""
${texteActuel}
"""

Instruction de transformation: ${instruction}

Contexte projet (si disponible): ${ctx ? JSON.stringify({ code: ctx.code, avancement: ctx.avancement, cpi: ctx.cpi, spi: ctx.spi }) : 'N/A'}

Applique l'instruction et retourne UNIQUEMENT le texte transformé, sans commentaire ni balise.`;

  const result = await kimiChat([
    { role: 'system', content: EXPERT_PERSONA },
    { role: 'user', content: prompt },
  ], { temperature: 0.4, max_tokens: 600 });

  return result ?? texteActuel;
}

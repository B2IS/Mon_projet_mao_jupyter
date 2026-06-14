/**
 * qhseAgent.ts — Agent QHSE (Qualité, Hygiène, Sécurité, Environnement)
 * Phase 1 — PGES, plan HSE, conformité DPE, indicateurs environnementaux.
 */

import type {
  SwarmInputFile, ProjetCreationContext,
  AgentResult, QHSEOutput, PlanPGES,
} from '@/lib/ai/types';

export async function runQHSEAgent(
  files: SwarmInputFile[],
  ctx: ProjetCreationContext,
): Promise<AgentResult<QHSEOutput>> {
  const start = Date.now();
  const warnings: string[] = [];

  // Niveau de risque HSE selon type de projet
  let niveauRisqueHSE: QHSEOutput['niveauRisqueHSE'];
  const budgetMFCFA = ctx.budgetEstime;
  const isHaute = ctx.typeProjet.toUpperCase().includes('HTA') || ctx.typeProjet.toUpperCase().includes('HTB');
  if (isHaute || budgetMFCFA > 1000) niveauRisqueHSE = 'Élevé';
  else if (budgetMFCFA > 200) niveauRisqueHSE = 'Modéré';
  else niveauRisqueHSE = 'Faible';

  // Plan PGES standard DPE
  const planPGES: PlanPGES[] = [
    {
      composante: 'Sol & Déchets',
      impact: 'Pollution des sols par déchets de chantier (câbles, isolants, huile)',
      mesure: 'Mise en place de points de collecte et filière de recyclage agréée',
      responsable: 'Entrepreneur + HSE SENELEC',
      echeance: ctx.dateDebut,
      statut: 'Planifié',
    },
    {
      composante: 'Air',
      impact: 'Émissions de poussières lors des travaux de génie civil',
      mesure: 'Arrosage régulier des pistes, bâchage des camions',
      responsable: 'Entrepreneur',
      echeance: ctx.dateDebut,
      statut: 'Planifié',
    },
    {
      composante: 'Eau',
      impact: 'Contamination des nappes par huiles de transformateurs',
      mesure: 'Bacs de rétention sous transformateurs, vérification étanchéité',
      responsable: 'Entrepreneur + Génie civil SENELEC',
      echeance: ctx.dateDebut,
      statut: 'Planifié',
    },
    {
      composante: 'Milieu humain',
      impact: 'Perturbation des activités riveraines pendant les travaux',
      mesure: 'Consultation préalable communautés, panneaux signalétiques, coupures planifiées',
      responsable: 'Chef de Projet DPE',
      echeance: ctx.dateDebut,
      statut: 'Planifié',
    },
    {
      composante: 'Biodiversité',
      impact: 'Destruction végétation lors du déboisement emprise ligne',
      mesure: 'Compensation plantation (ratio 1:3), tracé évitant zones sensibles',
      responsable: 'Entrepreneur + DREEC',
      echeance: ctx.dateDebut,
      statut: 'Planifié',
    },
    {
      composante: 'Sécurité travailleur',
      impact: `Risque électrique ${isHaute ? 'haute tension' : 'basse tension'}, chutes, manutention`,
      mesure: 'Plan HSE chantier, formation équipe, permis de travail, EPI obligatoires',
      responsable: 'Responsable HSE Entrepreneur',
      echeance: ctx.dateDebut,
      statut: 'Planifié',
    },
  ];

  // Indicateurs HSE
  const indicateursHSE: QHSEOutput['indicateursHSE'] = [
    { code: 'HSE-01', libelle: 'Taux de fréquence accidents', unite: 'pour 10⁶ heures', cible: 0, frequence: 'Mensuel' },
    { code: 'HSE-02', libelle: 'Taux de gravité', unite: 'jours perdus / 10⁶h', cible: 0, frequence: 'Mensuel' },
    { code: 'HSE-03', libelle: 'Exercices HSE réalisés', unite: '%', cible: 100, frequence: 'Trimestriel' },
    { code: 'HSE-04', libelle: 'Déchets valorisés', unite: '%', cible: 80, frequence: 'Mensuel' },
    { code: 'HSE-05', libelle: 'Conformité EPI', unite: '%', cible: 100, frequence: 'Mensuel' },
    { code: 'ENV-01', libelle: 'Superficie reboisée', unite: 'ha', cible: planPGES.length * 0.5, frequence: 'Trimestriel' },
  ];

  // Conformité référentiels DPE
  const conformiteDPE: QHSEOutput['conformiteDPE'] = [
    { reference: 'Code du Travail SN (Loi 97-17)', statut: 'Conforme', action: undefined },
    { reference: 'Code de l\'Environnement SN (Loi 2001-01)', statut: 'En cours', action: 'Obtenir notice d\'impact avant démarrage' },
    { reference: 'NF EN 50110 — Travaux sous tension', statut: isHaute ? 'Non conforme' : 'Conforme', action: isHaute ? 'Former équipe TST avant démarrage HTA' : undefined },
    { reference: 'ISO 14001:2015 — Système management environnement', statut: 'En cours', action: 'Aligner PGES sur exigences ISO 14001' },
    { reference: 'OHSAS 18001 / ISO 45001 — Sécurité travail', statut: 'En cours', action: 'Audit SMQ HSE à planifier J+30' },
    { reference: 'Directives Banque Mondiale (IFC PS1-8)', statut: ctx.bailleur?.toLowerCase().includes('banque') ? 'En cours' : 'Non applicable', action: ctx.bailleur?.toLowerCase().includes('banque') ? 'Soumettre PGES au bailleur pour NOC' : undefined },
  ];

  const formationsRequises = [
    'Travaux sous tension (TST) — toute l\'équipe terrain',
    'Sauveteur Secouriste du Travail (SST) — 2 agents minimum par équipe',
    'Manipulation extincteurs — formation annuelle obligatoire',
    'Conduite engins de chantier — permis CACES',
    'PGES : sensibilisation environnementale — entrepreneurs et sous-traitants',
  ];
  if (isHaute) formationsRequises.push('Habilitation électrique HTA/HTB — obligatoire avant démarrage');

  const equipementEPI = [
    'Casque de protection (classe E)',
    'Gants isolants classe 4 (20kV)',
    'Chaussures de sécurité diélectriques',
    'Lunettes de protection UV/arc électrique',
    'Harnais antichute (travaux en hauteur ≥ 1,8m)',
    'Vêtements haute visibilité',
    'Détecteur de tension portable',
    'Perche de mise à la terre',
    'Respirateur (travaux en tranchée / poussières)',
  ];

  if (files.length === 0) {
    warnings.push('PGES généré sur template standard DPE — à compléter avec l\'étude d\'impact spécifique au projet.');
  }

  return {
    agentId: 'qhse',
    status: 'done',
    durationMs: Date.now() - start,
    data: {
      niveauRisqueHSE,
      planPGES,
      indicateursHSE,
      conformiteDPE,
      formationsRequises,
      equipementEPI,
    },
    filesUsed: files.map(f => f.name),
    summary: `Risque HSE : ${niveauRisqueHSE}. PGES : ${planPGES.length} composantes. ${indicateursHSE.length} indicateurs. ${formationsRequises.length} formations requises.`,
    warnings,
  };
}

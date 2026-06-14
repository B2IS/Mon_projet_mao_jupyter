/**
 * marchesAgent.ts — Agent Passation des Marchés
 * Phase 2 — DAO, CCAP, lots, stratégie de passation, calendrier.
 */

import type {
  SwarmInputFile, ProjetCreationContext,
  AgentResult, MarchesOutput, LotMarche,
} from '@/lib/ai/types';

export async function runMarchesAgent(
  files: SwarmInputFile[],
  ctx: ProjetCreationContext,
): Promise<AgentResult<MarchesOutput>> {
  const start = Date.now();
  const warnings: string[] = [];

  const budgetMFCFA = ctx.budgetEstime;
  const dateDebut = new Date(ctx.dateDebut);

  // Stratégie selon budget et bailleur
  let strategiePassation: string;
  const bailleurLower = (ctx.bailleur ?? '').toLowerCase();
  if (bailleurLower.includes('banque') || bailleurLower.includes('ida') || bailleurLower.includes('bid')) {
    strategiePassation = 'Appel d\'offres international (AOI) — procédures bailleur (SPN/NCB) — plan de passation soumis à NOC préalable';
  } else if (budgetMFCFA > 500) {
    strategiePassation = 'Appel d\'offres national ouvert (AONO) — Code des marchés publics SN (Décret 2014-1212)';
  } else if (budgetMFCFA > 50) {
    strategiePassation = 'Demande de cotation (DC) pour lots ≤ 50 MFCFA — appel d\'offres restreint pour lots supérieurs';
  } else {
    strategiePassation = 'Bon de commande / Achat direct selon seuils DGCPE';
  }

  // Détection lots depuis noms de fichiers
  const lotsIdentifies: LotMarche[] = [];
  const allNames = files.map(f => f.name.toLowerCase()).join(' ');

  // Lot 1 — Génie civil
  if (allNames.includes('genie') || allNames.includes('civil') || allNames.includes('terrassement') || budgetMFCFA > 0) {
    lotsIdentifies.push({
      numero: 1,
      libelle: 'Génie civil — terrassement, fondations, massifs transformateurs',
      montantHTVA: Math.round(budgetMFCFA * 0.15 * 1_000_000),
      typeContrat: budgetMFCFA > 200 ? 'Marché à prix révisable' : 'Marché à prix ferme',
      statut: 'Planifié',
    });
  }

  // Lot 2 — Fourniture équipements
  lotsIdentifies.push({
    numero: 2,
    libelle: `Fourniture équipements électriques — transformateurs, câbles, armoires TGBT`,
    montantHTVA: Math.round(budgetMFCFA * 0.40 * 1_000_000),
    typeContrat: 'Marché à prix ferme',
    statut: 'Planifié',
  });

  // Lot 3 — Travaux électriques
  lotsIdentifies.push({
    numero: 3,
    libelle: `Travaux d\'installation électrique — ${ctx.typeProjet}`,
    montantHTVA: Math.round(budgetMFCFA * 0.35 * 1_000_000),
    typeContrat: budgetMFCFA > 200 ? 'Marché à prix révisable' : 'Marché à prix ferme',
    statut: 'Planifié',
  });

  // Lot 4 — Supervision si grand projet
  if (budgetMFCFA > 200) {
    lotsIdentifies.push({
      numero: 4,
      libelle: 'Contrôle et supervision des travaux — Bureau de contrôle indépendant',
      montantHTVA: Math.round(budgetMFCFA * 0.05 * 1_000_000),
      typeContrat: 'Marché à prix ferme',
      statut: 'Planifié',
    });
  }

  // Lot 5 — Audit final
  if (budgetMFCFA > 500) {
    lotsIdentifies.push({
      numero: 5,
      libelle: 'Audit technique et financier final',
      montantHTVA: Math.round(budgetMFCFA * 0.02 * 1_000_000),
      typeContrat: 'Bon de commande',
      statut: 'Planifié',
    });
  }

  // Calendrier de passation (J = dateDebut)
  const addDays = (d: Date, n: number) => {
    const r = new Date(d);
    r.setDate(r.getDate() + n);
    return r.toISOString().split('T')[0];
  };

  const calendrierPassation = [
    { etape: 'Préparation et validation DAO/CCAP/CPS', datePrevisionnelle: addDays(dateDebut, -90) },
    { etape: 'Publication avis d\'appel d\'offres (Journal officiel + DGCPE)', datePrevisionnelle: addDays(dateDebut, -75) },
    { etape: 'Réunion pré-soumission / visite de site', datePrevisionnelle: addDays(dateDebut, -60) },
    { etape: 'Clôture réception des offres', datePrevisionnelle: addDays(dateDebut, -45) },
    { etape: 'Dépouillement et évaluation des offres', datePrevisionnelle: addDays(dateDebut, -35) },
    { etape: 'Approbation et notification du marché', datePrevisionnelle: addDays(dateDebut, -15) },
    { etape: 'Signature marché + remise OS de démarrage', datePrevisionnelle: ctx.dateDebut },
    { etape: 'Versement avance de démarrage (20%)', datePrevisionnelle: addDays(dateDebut, 15) },
  ];

  // DAO extraits depuis les fichiers
  const daoExtraits: MarchesOutput['daoExtraits'] = [];
  for (const f of files) {
    if (f.name.toLowerCase().includes('dao') || f.name.toLowerCase().includes('dce')) {
      daoExtraits.push({
        reference: f.name.replace(/\.[^.]+$/, ''),
        objet: `Document DAO extrait : ${f.name}`,
        montantEstimatif: budgetMFCFA * 1_000_000,
      });
    }
    if (f.name.toLowerCase().includes('march') || f.name.toLowerCase().includes('paue')) {
      daoExtraits.push({
        reference: f.name.replace(/\.[^.]+$/, ''),
        objet: `Contrat/Marché : ${f.name}`,
        montantEstimatif: budgetMFCFA * 1_000_000,
      });
    }
  }
  if (daoExtraits.length === 0) {
    daoExtraits.push({
      reference: `DAO-${ctx.codeProjet}`,
      objet: `DAO standard à préparer pour ${ctx.nomProjet}`,
      montantEstimatif: budgetMFCFA * 1_000_000,
    });
  }

  // Points clés CCAP
  const ccapPoints = [
    'Délai d\'exécution contractuel et pénalités de retard (0.5‰/jour)',
    'Révision de prix — formule paramétrique selon IPC/BTP ANSD',
    'Avance de démarrage 20% récupérable sur décomptes',
    'Retenue de garantie 5% — libérée à réception définitive',
    'Assurance tous risques chantier — souscription obligatoire',
    'Sous-traitance — accord préalable SENELEC requis',
    'Force majeure — définition et procédure de déclaration',
    'Litige — arbitrage CCJA ou TGI Dakar selon montant',
  ];

  const risquesPassation = [
    'Délai d\'obtention NOC bailleur (4–8 semaines supplémentaires)',
    'Offres anormalement basses → rejet possible → nouvel appel d\'offres',
    'Un seul soumissionnaire → procédure gré à gré avec validation CRCA',
    'Hausse imprévue des prix matériaux → dépassement budgétaire',
    'Contentieux soumissionnaire écarté → suspension procédure',
  ];
  if (files.length === 0) warnings.push('Analyse marchés basée sur template DPE — DAO et CCAP réels non fournis.');

  const totalMarchesPrevu = lotsIdentifies.reduce((s, l) => s + l.montantHTVA / 1_000_000, 0);

  return {
    agentId: 'marches',
    status: 'done',
    durationMs: Date.now() - start,
    data: {
      strategiePassation,
      lotsIdentifies,
      calendrierPassation,
      daoExtraits,
      ccapPoints,
      risquesPassation,
      totalMarchesPrevu,
    },
    filesUsed: files.map(f => f.name),
    summary: `Stratégie : ${budgetMFCFA > 500 ? 'AOI' : budgetMFCFA > 50 ? 'AONO' : 'DC/BC'}. ${lotsIdentifies.length} lots identifiés — total ${totalMarchesPrevu.toFixed(0)} MFCFA. ${daoExtraits.length} DAO.`,
    warnings,
  };
}

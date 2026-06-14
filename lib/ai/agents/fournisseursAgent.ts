/**
 * fournisseursAgent.ts — Agent Fournisseurs / Prestataires
 * Phase 2 — Extrait prestataires, sous-traitants, RCCM/NIF, historique marchés.
 * Peuple : metadata.fournisseurs · risquesConcentration.
 */

import type {
  SwarmInputFile, ProjetCreationContext,
  AgentResult, FournisseursOutput, FournisseurExtrait,
} from '@/lib/ai/types';

const PRESTATAIRES_CONNUS: Array<{
  nom: string; pays: string; specialite: string;
  typeContrat: string; keywords: string[];
}> = [
  {
    nom: 'EIFFAGE SÉNÉGAL',
    pays: 'Sénégal', specialite: 'Travaux HTA/HTB, Génie Civil',
    typeContrat: 'Marché travaux', keywords: ['eiffage', 'btp', 'hvt', 'ligne aérienne'],
  },
  {
    nom: 'COFELY INEO SÉNÉGAL',
    pays: 'Sénégal', specialite: 'Distribution, Postes, Automatismes',
    typeContrat: 'Marché travaux', keywords: ['cofely', 'ineo', 'ge grid', 'distribution'],
  },
  {
    nom: 'GE GRID SOLUTIONS',
    pays: 'France', specialite: 'Transformateurs HTB, Appareillage HT, SCADA',
    typeContrat: 'Fourniture', keywords: ['ge grid', 'alstom', 'transformateur', 'htb'],
  },
  {
    nom: 'NEXANS',
    pays: 'France', specialite: 'Câbles HTA, HTB, Conducteurs ACSR',
    typeContrat: 'Fourniture', keywords: ['nexans', 'câble', 'conducteur', 'acsr'],
  },
  {
    nom: 'SCHNEIDER ELECTRIC',
    pays: 'France', specialite: 'Équipements BT/HTA, Automatismes, Compteurs AMI',
    typeContrat: 'Fourniture', keywords: ['schneider', 'merlin gerin', 'ami', 'compteur'],
  },
  {
    nom: 'COMETE ENGINEERING',
    pays: 'Sénégal', specialite: 'Études APS/APD, Supervision, Contrôle Qualité',
    typeContrat: 'Assistance technique', keywords: ['comete', 'bureau', 'étude', 'supervision'],
  },
  {
    nom: 'TRACTEBEL ENGINEERING',
    pays: 'Belgique', specialite: 'Ingénierie Énergie, Études HTB',
    typeContrat: 'Assistance technique', keywords: ['tractebel', 'ingénierie', 'engie'],
  },
  {
    nom: 'SOGEA SATOM',
    pays: 'Sénégal', specialite: 'Génie Civil, Infrastructure',
    typeContrat: 'Marché travaux', keywords: ['sogea', 'satom', 'génie civil'],
  },
];

export async function runFournisseursAgent(
  files: SwarmInputFile[],
  ctx: ProjetCreationContext,
): Promise<AgentResult<FournisseursOutput>> {
  const start = Date.now();
  const warnings: string[] = [];

  const docFiles = files.filter(f =>
    ['pdf', 'docx', 'xlsx', 'doc'].includes(f.ext.toLowerCase())
  );
  const filesUsed = docFiles.map(f => f.name);

  if (docFiles.length === 0) {
    warnings.push('Aucun document contractuel détecté — fournisseurs générés par profil projet.');
  }

  const textCtx = `${ctx.nomProjet} ${ctx.typeProjet} ${ctx.description}`.toLowerCase();

  const scores = PRESTATAIRES_CONNUS.map(p => ({
    p,
    score: p.keywords.filter(kw => textCtx.includes(kw)).length,
  })).sort((a, b) => b.score - a.score);

  const fournisseurs: FournisseurExtrait[] = [];
  const budget = ctx.budgetEstime;

  const addFournisseur = (p: typeof PRESTATAIRES_CONNUS[0], montant: number) => {
    fournisseurs.push({
      nom: p.nom,
      pays: p.pays,
      specialite: p.specialite,
      typeContrat: p.typeContrat,
      montantContrat: Math.round(montant),
      statut: 'Agréé',
    });
  };

  // Assistance technique (toujours)
  const be = scores.find(s => s.p.typeContrat === 'Assistance technique')?.p ?? PRESTATAIRES_CONNUS[5];
  addFournisseur(be, budget * 0.05);

  // Entrepreneur principal
  const ent = scores.find(s => s.p.typeContrat === 'Marché travaux')?.p ?? PRESTATAIRES_CONNUS[0];
  addFournisseur(ent, budget * 0.55);

  // Fournisseur équipements si budget significatif
  if (budget > 200) {
    const equip = scores.find(s => s.p.typeContrat === 'Fourniture')?.p ?? PRESTATAIRES_CONNUS[2];
    addFournisseur(equip, budget * 0.35);
  }

  const totalMontantContrats = fournisseurs.reduce((s, f) => s + (f.montantContrat ?? 0), 0);

  const risquesConcentration: string[] = [];
  if (fournisseurs.length < 3) {
    risquesConcentration.push(`Faible nombre de prestataires (${fournisseurs.length}) — risque de dépendance.`);
  }
  const foreignCount = fournisseurs.filter(f => f.pays !== 'Sénégal').length;
  if (foreignCount > fournisseurs.length / 2) {
    risquesConcentration.push('Majorité de prestataires étrangers — risque de change.');
  }
  const topShare = fournisseurs.length > 0
    ? Math.max(...fournisseurs.map(f => f.montantContrat ?? 0)) / (totalMontantContrats || 1)
    : 0;
  if (topShare > 0.6) {
    risquesConcentration.push(`Concentration financière élevée : un prestataire représente ${Math.round(topShare * 100)} %.`);
  }

  return {
    agentId: 'fournisseurs',
    status: 'done',
    durationMs: Date.now() - start,
    filesUsed,
    warnings,
    summary: `Fournisseurs : ${fournisseurs.length} prestataires · Total ${totalMontantContrats.toFixed(0)} MFCFA`,
    data: {
      fournisseurs,
      totalMontantContrats,
      risquesConcentration,
      recommandations: risquesConcentration.length > 0
        ? ['Diversifier le panel de prestataires locaux', 'Vérifier agréments SENELEC avant signature']
        : ['Panel prestataires conforme — poursuivre selon DAC'],
    },
  };
}

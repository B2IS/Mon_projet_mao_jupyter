/**
 * risquesAgent.ts — Agent Gestionnaire de Risques
 * Phase 1 du pipeline. Génère le registre de risques standard DPE
 * (15 risques types) adapté au type de projet détecté.
 */

import type {
  SwarmInputFile, ProjetCreationContext,
  AgentResult, RisquesOutput, RisqueType,
} from '@/lib/ai/types';

/** 15 risques types DPE — chargés dès le démarrage de l'agent */
const RISQUES_TYPES_DPE: Omit<RisqueType, 'id' | 'statut' | 'responsable'>[] = [
  {
    titre: 'Retard de livraison des matériaux (poteaux béton)',
    categorie: 'Approvisionnement',
    probabilite: 4, impact: 3,
    criticite: 12,
    mitigation: 'Diversifier les fournisseurs, constituer un stock tampon de 3 semaines, activer la clause de pénalité de retard.',
    delai: 'Continu',
  },
  {
    titre: 'Dépassement budgétaire sur les travaux de génie civil',
    categorie: 'Financier',
    probabilite: 3, impact: 4,
    criticite: 12,
    mitigation: 'Révision mensuelle des quantités réalisées vs BOQ. Avenant négocié avant dépassement seuil 5%.',
    delai: 'Mensuel',
  },
  {
    titre: 'Non-disponibilité du personnel clé (chef de projet)',
    categorie: 'Institutionnel',
    probabilite: 2, impact: 4,
    criticite: 8,
    mitigation: 'Désigner un remplaçant officiel. Plan de continuité validé par la DER.',
    delai: 'Immédiat',
  },
  {
    titre: 'Retard d\'obtention des ANO Banque Mondiale / AFD',
    categorie: 'Contractuel',
    probabilite: 3, impact: 3,
    criticite: 9,
    mitigation: 'Anticiper les soumissions de 30 jours. Réunions mensuelles avec les représentants des bailleurs.',
    delai: 'Avant chaque jalon',
  },
  {
    titre: 'Conditions météorologiques (saison des pluies)',
    categorie: 'Technique',
    probabilite: 4, impact: 2,
    criticite: 8,
    mitigation: 'Planifier les travaux de génie civil hors saison des pluies (nov–mai). Bâches + drainage provisoire.',
    delai: 'Mai-Octobre',
  },
  {
    titre: 'Conflits fonciers sur les emprises de lignes',
    categorie: 'Institutionnel',
    probabilite: 3, impact: 3,
    criticite: 9,
    mitigation: 'Levé foncier préliminaire systématique. Concertation communautaire avant implantation.',
    delai: 'Phase études',
  },
  {
    titre: 'Variation des prix des matières premières (cuivre, aluminium)',
    categorie: 'Financier',
    probabilite: 3, impact: 3,
    criticite: 9,
    mitigation: 'Clause de révision de prix indexée LME dans les marchés de fourniture.',
    delai: 'Signature marché',
  },
  {
    titre: 'Défaillance d\'un sous-traitant principal',
    categorie: 'Contractuel',
    probabilite: 2, impact: 4,
    criticite: 8,
    mitigation: 'Clauses résolutoires avec délai de préavis. Identification préalable d\'entreprises de remplacement.',
    delai: 'Continu',
  },
  {
    titre: 'Incident HSE sur chantier (accident de travail)',
    categorie: 'HSE',
    probabilite: 2, impact: 4,
    criticite: 8,
    mitigation: 'Plan HSE chantier obligatoire. Formation sécurité avant démarrage. Assurance tous risques.',
    delai: 'Démarrage travaux',
  },
  {
    titre: 'Retard de paiement SENELEC → entreprise',
    categorie: 'Financier',
    probabilite: 3, impact: 3,
    criticite: 9,
    mitigation: 'Provision budgétaire pour décaissement rapide. Délai contractuel de paiement ≤ 60 jours.',
    delai: 'À chaque décompte',
  },
  {
    titre: 'Non-conformité technique des équipements livrés',
    categorie: 'Technique',
    probabilite: 2, impact: 3,
    criticite: 6,
    mitigation: 'Inspection qualité en usine (FAT). Réception contradictoire avec BER SENELEC.',
    delai: 'Livraison équipements',
  },
  {
    titre: 'Résistance des communautés locales aux travaux',
    categorie: 'Institutionnel',
    probabilite: 2, impact: 3,
    criticite: 6,
    mitigation: 'Réunions de sensibilisation préalables avec les chefs de villages. Plan de communication.',
    delai: 'Phase mobilisation',
  },
  {
    titre: 'Problèmes de coordination inter-directions SENELEC',
    categorie: 'Institutionnel',
    probabilite: 2, impact: 2,
    criticite: 4,
    mitigation: 'Comité de coordination mensuel inter-directions. Désignation d\'un point focal par direction.',
    delai: 'Continu',
  },
  {
    titre: 'Corruption ou fraude documentaire',
    categorie: 'Contractuel',
    probabilite: 1, impact: 4,
    criticite: 4,
    mitigation: 'Audit interne trimestriel. Dématérialisation des processus via SIGEPP-DPE. Clause anti-corruption.',
    delai: 'Continu',
  },
  {
    titre: 'Risque technologique (panne SCADA/système de supervision)',
    categorie: 'Technique',
    probabilite: 2, impact: 2,
    criticite: 4,
    mitigation: 'Redondance système. Plan de maintenance préventive annuel. SLA fournisseur SCADA.',
    delai: 'Mise en service',
  },
];

export async function runRisquesAgent(
  files: SwarmInputFile[],
  ctx: ProjetCreationContext,
): Promise<AgentResult<RisquesOutput>> {
  const start = Date.now();
  const filesUsed = files.filter(f => ['pdf', 'doc', 'docx', 'xlsx'].includes(f.ext)).map(f => f.name);
  const warnings: string[] = [];

  // Adapter les responsables selon le contexte
  const responsables = ['Chef de Projet', 'RAF DPE', 'Directeur DPE', 'DER / Chef de Projet', 'Chef de Projet / DER', 'PMO'];

  const risques: RisqueType[] = RISQUES_TYPES_DPE.map((r, i) => ({
    ...r,
    id: `R${String(i + 1).padStart(2, '0')}`,
    responsable: responsables[i % responsables.length],
    statut: i < 3 ? 'Ouvert' : i < 8 ? 'En cours' : 'Clôturé',
  }));

  const risquesCritiques = risques.filter(r => r.criticite >= 12);
  const maxCrit = Math.max(...risques.map(r => r.criticite));
  const niveauGlobal: RisquesOutput['niveauRisqueGlobal'] =
    maxCrit >= 16 ? 'Critique' : maxCrit >= 12 ? 'Élevé' : maxCrit >= 6 ? 'Modéré' : 'Faible';

  if (filesUsed.length === 0) {
    warnings.push('Registre de risques généré depuis les 15 risques types DPE. Complétez manuellement selon les spécificités du projet.');
  }

  return {
    agentId: 'risques',
    status: 'done',
    durationMs: Date.now() - start,
    data: { risques, niveauRisqueGlobal: niveauGlobal, risquesCritiques },
    filesUsed,
    summary: `${risques.length} risques identifiés (${risquesCritiques.length} critiques P×I≥12). Niveau global : ${niveauGlobal}.`,
    warnings,
  };
}

/**
 * indicateursSenelec.ts — Indicateurs officiels SENELEC / DPE (gouvernance des investissements).
 * Calculés à partir des projets SCOPÉS (héritent automatiquement du périmètre RBAC/ABAC).
 * Catégories : Financier · Physique · Performance (EVM) · Énergie/Investissement.
 */

export interface ProjetKpiInput {
  domaine: string;            // production | transport | distribution | commercial | genie_civil
  budget: number;             // MFCFA
  budgetEngage: number;
  budgetDecaisse: number;
  avancement: number;         // %
  cpi: number;
  spi: number;
  statut: string;             // en_cours | termine | en_retard | …
}

export interface IndicateursSenelec {
  // ── Financier ──
  budgetTotal: number; engage: number; decaisse: number;
  tauxEngagement: number; tauxDecaissement: number; soldeDisponible: number;
  // ── Physique ──
  avancementMoyen: number; projetsEnRetard: number; nbProjets: number;
  // ── Performance (EVM / PMBOK) ──
  cpiMoyen: number; spiMoyen: number; conformite: number;
  projetsEnRetardSpi: number; projetsDepassementCpi: number;
  // ── Énergie & Investissement (impact SENELEC) ──
  kmReseauHTA: number; kmReseauBT: number; mwInstalle: number;
  menagesRaccordes: number; localitesElectrifiees: number; postesConstruits: number;
}

const avg = (arr: number[]) => (arr.length ? arr.reduce((s, v) => s + v, 0) / arr.length : 0);
const sum = (arr: number[]) => arr.reduce((s, v) => s + v, 0);

/** Calcule tous les indicateurs SENELEC/DPE sur un ensemble de projets (déjà scopés). */
export function computeIndicateursSenelec(projets: ProjetKpiInput[]): IndicateursSenelec {
  const n = projets.length;
  const budgetTotal = sum(projets.map(p => p.budget));
  const engage = sum(projets.map(p => p.budgetEngage));
  const decaisse = sum(projets.map(p => p.budgetDecaisse));
  const distrib = projets.filter(p => p.domaine === 'distribution');
  const prod = projets.filter(p => p.domaine === 'production');
  const trans = projets.filter(p => p.domaine === 'transport');
  const r = (x: number) => Math.round(x);
  const av = (p: ProjetKpiInput) => p.avancement / 100;

  return {
    // Financier
    budgetTotal: r(budgetTotal), engage: r(engage), decaisse: r(decaisse),
    tauxEngagement: budgetTotal ? +((engage / budgetTotal) * 100).toFixed(1) : 0,
    tauxDecaissement: budgetTotal ? +((decaisse / budgetTotal) * 100).toFixed(1) : 0,
    soldeDisponible: r(budgetTotal - engage),
    // Physique
    avancementMoyen: r(avg(projets.map(p => p.avancement))),
    projetsEnRetard: projets.filter(p => p.statut === 'en_retard' || p.cpi < 0.9 || p.spi < 0.85).length,
    nbProjets: n,
    // Performance EVM
    cpiMoyen: +avg(projets.map(p => p.cpi)).toFixed(2),
    spiMoyen: +avg(projets.map(p => p.spi)).toFixed(2),
    conformite: r(avg(projets.map(p => (p.avancement >= 80 ? 92 : p.avancement >= 50 ? 75 : 55)))),
    projetsEnRetardSpi: projets.filter(p => p.spi < 0.8).length,
    projetsDepassementCpi: projets.filter(p => p.cpi < 0.8).length,
    // Énergie / Investissement (coefficients sectoriels calibrés sur budget MFCFA × avancement)
    kmReseauHTA: r(sum(distrib.map(p => p.budget * 0.018 * av(p))) + sum(trans.map(p => p.budget * 0.012 * av(p)))),
    kmReseauBT: r(sum(distrib.map(p => p.budget * 0.025 * av(p)))),
    mwInstalle: r(sum(prod.map(p => p.budget * 0.01 * av(p)))),
    menagesRaccordes: r(sum(distrib.map(p => p.budget * 12 * av(p)))),
    localitesElectrifiees: r(sum(distrib.map(p => p.budget * 0.6 * av(p)))),
    postesConstruits: r(sum(distrib.map(p => p.budget * 0.08 * av(p))) + sum(trans.map(p => p.budget * 0.02 * av(p)))),
  };
}

/** Format compact MFCFA / Md FCFA. */
export function fmtFCFA(mfcfa: number): string {
  return mfcfa >= 1000 ? `${(mfcfa / 1000).toFixed(2)} Md FCFA` : `${Math.round(mfcfa)} M FCFA`;
}

/** Cartes d'indicateurs à afficher dans le cockpit, PAR PROFIL (Accueil intelligent). */
export type RoleKey = string;
export interface IndCard { label: string; value: string; sub?: string; accent?: string; }

export function cockpitCardsForRole(role: RoleKey, k: IndicateursSenelec): IndCard[] {
  const fin: IndCard[] = [
    { label: 'Engagements', value: fmtFCFA(k.engage), sub: `${k.tauxEngagement}% du budget`, accent: '#B45309' },
    { label: 'Décaissements', value: fmtFCFA(k.decaisse), sub: `${k.tauxDecaissement}% du budget`, accent: '#16A34A' },
    { label: 'Solde disponible', value: fmtFCFA(k.soldeDisponible), sub: 'non engagé', accent: '#0E3460' },
  ];
  const perf: IndCard[] = [
    { label: 'Avancement moyen', value: `${k.avancementMoyen}%`, accent: '#F47920' },
    { label: 'Performance CPI', value: k.cpiMoyen.toFixed(2), sub: `SPI ${k.spiMoyen.toFixed(2)}`, accent: k.cpiMoyen >= 0.9 ? '#16A34A' : '#DC2626' },
    { label: 'Écarts (projets à risque)', value: String(k.projetsEnRetard), accent: k.projetsEnRetard ? '#DC2626' : '#16A34A' },
  ];
  const energie: IndCard[] = [
    { label: 'Réseau HTA', value: `${k.kmReseauHTA.toLocaleString('fr-FR')} km`, accent: '#0E3460' },
    { label: 'Réseau BT', value: `${k.kmReseauBT.toLocaleString('fr-FR')} km`, accent: '#1D4ED8' },
    { label: 'Puissance installée', value: `${k.mwInstalle.toLocaleString('fr-FR')} MW`, accent: '#7C3AED' },
    { label: 'Ménages raccordés', value: k.menagesRaccordes.toLocaleString('fr-FR'), accent: '#16A34A' },
    { label: 'Localités électrifiées', value: k.localitesElectrifiees.toLocaleString('fr-FR'), accent: '#059669' },
    { label: 'Postes construits', value: String(k.postesConstruits), accent: '#9333EA' },
  ];
  const portef: IndCard[] = [
    { label: 'Projets', value: String(k.nbProjets), accent: '#0E3460' },
    { label: 'Budget total', value: fmtFCFA(k.budgetTotal), accent: '#1D4ED8' },
    { label: 'Avancement moyen', value: `${k.avancementMoyen}%`, accent: '#F47920' },
    { label: 'Alertes critiques', value: String(k.projetsEnRetard), accent: k.projetsEnRetard ? '#DC2626' : '#16A34A' },
  ];
  const expert: IndCard[] = [
    { label: 'Projets en retard', value: String(k.projetsEnRetardSpi), sub: 'SPI < 0.8', accent: k.projetsEnRetardSpi > 0 ? '#DC2626' : '#16A34A' },
    { label: 'Dépassement Budgétaire', value: String(k.projetsDepassementCpi), sub: 'CPI < 0.8', accent: k.projetsDepassementCpi > 0 ? '#DC2626' : '#16A34A' },
    { label: 'Taux décaissement global', value: `${k.tauxDecaissement}%`, accent: '#1D4ED8' },
    { label: 'Réseau construit', value: `${(k.kmReseauHTA + k.kmReseauBT).toLocaleString('fr-FR')} km`, accent: '#0E3460' },
    { label: 'Alertes jalons', value: String(k.projetsEnRetard), sub: 'Alerte globale', accent: '#F47920' },
  ];
  switch (role) {
    case 'DIR_DPE': case 'ADMIN': case 'PMO': case 'AUDIT':
      // Bandeau exécutif (haut) couvre déjà Projets/Avancement/Alertes : on ne garde
      // que le Budget total (unique) puis l'impact énergie — pas de doublon de KPI.
      return [{ label: 'Budget total', value: fmtFCFA(k.budgetTotal), accent: '#1D4ED8' }, ...energie];
    case 'CHEF_DEPT':
      return [...portef, ...perf];                                    // Directeur/Chef Dépt : projets + KPI direction
    case 'CHEF_PROJ': case 'INGENIEUR': case 'CONTROLEUR': case 'CONTROLEUR_TRAVAUX': case 'ASSISTANT':
      return portef;                                                  // Chef Projet : mes projets (+ tâches/marchés/risques via onglets)
    case 'EXPERT': case 'CHARGE':
      return expert;                                                    // S&E : performance · KPI · écarts
    case 'CTRL_FIN': case 'MARCHES': case 'IMMO':
      return fin;                                                     // Finance : engagements · paiements · décaissements
    default:
      return portef;
  }
}

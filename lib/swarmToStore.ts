/**
 * lib/swarmToStore.ts
 *
 * Mapper SwarmContext → Projet patch + Indicateurs RAG
 *
 * RAG = Red / Amber / Green — système de feux pour les INDICATEURS DPE
 *   🟢 Vert  : indicateur atteint ou en bonne voie (valeur ≥ seuil bon)
 *   🟠 Amber : dérive légère, attention requise (valeur entre seuil alerte et seuil bon)
 *   🔴 Rouge : indicateur critique, action immédiate (valeur < seuil alerte)
 *
 * Les seuils sont définis à l'avance par indicateur. Exemple :
 *   Taux avancement    → Vert ≥ 80 % · Amber ≥ 50 % · Rouge < 50 %
 *   Respect budget     → Vert écart ≤ 5 % · Amber ≤ 10 % · Rouge > 10 %
 *   CPI / SPI          → Vert ≥ 1 · Amber ≥ 0.9 · Rouge < 0.9
 */

import type {
  SwarmContext,
  FinancierOutput,
  PlanificateurOutput,
  RisquesOutput,
  MarchesOutput,
  QHSEOutput,
  SuiviEvalOutput,
  RessourcesOutput,
  SIGOutput,
  BordereauOutput,
  ProgrammeOutput,
  ERPOutput,
  FournisseursOutput,
  ReceptionOutput,
  ReportingOutput,
  CourriersOutput,
} from './ai/types';

import type {
  Projet,
  Incident,
  ProjetHSE,
  PassationMarches,
  StatutGlobal,
  TacheWBS,
  Jalon,
} from './projectStore';

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

function uid(): string {
  return Math.random().toString(36).slice(2, 11);
}

function todayISO(): string {
  return new Date().toISOString().split('T')[0];
}

// ─────────────────────────────────────────────────────────────────────────────
// RAG Statut Global (Red-Amber-Green)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Calcule le statut RAG du projet depuis les sorties des agents.
 *
 * Seuils DPE :
 *   Vert  : CPI ≥ 0.95 ET SPI ≥ 0.90 ET variance budget ≤ 5 % ET avancement ≥ planifié-5
 *   Orange: CPI ≥ 0.85 ET SPI ≥ 0.80 OU variance budget ≤ 10 % OU écart délai ≤ 10 %
 *   Rouge : tout seuil critique dépassé
 */
export function computeRagStatut(
  planif: PlanificateurOutput | undefined,
  financ: FinancierOutput | undefined,
  risques: RisquesOutput | undefined,
): StatutGlobal {
  // CPI proxy : ratio décaissé/total depuis tauxDecaissement
  const tauxDec = financ?.tauxDecaissement ?? 100;
  const cpi = tauxDec > 0 ? Math.min(tauxDec / 100, 1) : 1;

  // Variance budget : avenant vs budgetInitial
  const varBudget = financ && financ.budgetInitial > 0
    ? Math.abs((financ.budgetTotal - financ.budgetInitial) / financ.budgetInitial * 100)
    : 0;

  const nRed = risques?.risquesCritiques?.length ?? 0;
  const niveauRisque = risques?.niveauRisqueGlobal ?? 'Faible';

  // Seuils RAG DPE
  if (nRed > 2 || niveauRisque === 'Critique' || varBudget > 10) return 'rouge';
  if (nRed > 0 || niveauRisque === 'Élevé' || varBudget > 5 || cpi < 0.85) return 'orange';
  return 'vert';
}

// ─────────────────────────────────────────────────────────────────────────────
// Incidents (Risques → Incidents)
// ─────────────────────────────────────────────────────────────────────────────

function mapRisquesToIncidents(
  risques: RisquesOutput,
  projetId: string,
  chefProjet: string,
): Incident[] {
  return risques.risques.map(r => ({
    id: uid(),
    projetId,
    synthese: r.titre,
    description: `[${r.categorie}] ${r.mitigation} — Responsable: ${r.responsable}`,
    type: mapCategorieToType(r.categorie),
    priorite: mapCriticiteTopriorite(r.criticite),
    statut: r.statut === 'Clôturé' ? 'Ferme' : r.statut === 'En cours' ? 'En_cours' : 'Nouveau',
    creePar: chefProjet,
    proprietaireId: 'system',
    proprietaireNom: r.responsable,
    dateCreation: todayISO(),
    dateRequise: r.delai !== 'Continu' ? r.delai : undefined,
    pointsAction: [{
      id: uid(),
      synthese: r.mitigation,
      proprietaireId: 'system',
      proprietaireNom: r.responsable,
      statut: 'Non_demarre',
      description: r.mitigation,
    }],
  } as Incident));
}

function mapCategorieToType(cat: string): Incident['type'] {
  if (cat === 'HSE') return 'HSE';
  if (cat === 'Financier') return 'Financier';
  if (cat === 'Contractuel') return 'Contractuel';
  if (cat === 'Technique') return 'Technique';
  return 'General';
}

function mapCriticiteTopriorite(criticite: number): Incident['priorite'] {
  if (criticite >= 12) return 'Urgente';
  if (criticite >= 8)  return 'Haute';
  if (criticite >= 4)  return 'Moyenne';
  return 'Faible';
}

// ─────────────────────────────────────────────────────────────────────────────
// HSE (QHSE Output → ProjetHSE)
// ─────────────────────────────────────────────────────────────────────────────

function mapQHSEToHSE(qhse: QHSEOutput): ProjetHSE {
  const pgesTot  = qhse.planPGES.length;
  const pgesReal = qhse.planPGES.filter(p => p.statut === 'Réalisé').length;
  const taux = pgesTot > 0 ? Math.round((pgesReal / pgesTot) * 100) : 0;

  return {
    nbAnomalies: 0,
    tauxRealisationPGES: taux,
    tauxRealisationPAR: 0,
    commentairePGES: qhse.planPGES.slice(0, 3).map(p => `${p.composante}: ${p.mesure}`).join(' | '),
    derniereMaj: todayISO(),
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Passation marchés (MarchesOutput → PassationMarches)
// ─────────────────────────────────────────────────────────────────────────────

function mapMarchesToPassation(marches: MarchesOutput): PassationMarches {
  const etapes = marches.calendrierPassation ?? [];
  const pct = (keyword: string) => {
    const found = etapes.some(e =>
      e.etape.toLowerCase().includes(keyword) &&
      new Date(e.datePrevisionnelle) < new Date()
    );
    return found ? 100 : 0;
  };
  return {
    elaborationDAC:       pct('dac') || pct('dossier'),
    lancementDAC:         pct('lancement') || pct('publication'),
    ouvertureAnalyse:     pct('ouverture') || pct('analyse'),
    attributionProvisoire:pct('attribution') || pct('provisoire'),
    attributionDefinitive:pct('définitiv') || pct('definitiv'),
    signatureContrat:     pct('signature') || pct('contrat'),
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Tâches WBS enrichies avec ressources
// ─────────────────────────────────────────────────────────────────────────────

function enrichTachesWithRessources(
  taches: TacheWBS[],
  ressources: RessourcesOutput,
): TacheWBS[] {
  if (!ressources?.affectations?.length) return taches;
  return taches.map(t => {
    const affectations = ressources.affectations
      .filter(a => a.tacheNom.toLowerCase().includes(t.nom.toLowerCase().slice(0, 15)))
      .map(a => ({
        id:           uid(),
        tacheId:      t.id,
        ressourceId:  uid(),
        ressourceNom: a.ressourceNom,
        unite:        a.pourcentage,
        pourcentage:  a.pourcentage,
        dateDebut:    a.dateDebut,
        dateFin:      a.dateFin,
        tauxHoraire:  a.tauxHoraire,
      }));
    return affectations.length ? { ...t, assignations: affectations } : t;
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// Indicateurs RAG — SwarmContext → CustomIndicator[]
// ─────────────────────────────────────────────────────────────────────────────

import type { CustomIndicator, IndicatorUnit } from './indicatorStore';

/**
 * Produit la liste des indicateurs à injecter dans useIndicatorStore.
 *
 * Sources :
 *  1. SuiviEvalOutput.icps  — ICPs projet (délais, coûts, avancement)
 *     + croisé avec alerteSeuils pour récupérer les seuils RAG Orange/Rouge
 *  2. QHSEOutput.indicateursHSE — KPIs HSE (fréquence accidents, taux PGES…)
 *
 * Convention seuils RAG (direction = 'higher' par défaut pour DPE) :
 *   good = seuilOrange  (≥ → Vert)
 *   warn = seuilRouge   (≥ seuilRouge mais < seuilOrange → Amber, < seuilRouge → Rouge)
 */
export function swarmContextToIndicators(ctx: SwarmContext): Omit<CustomIndicator, 'id' | 'createdAt' | 'updatedAt'>[] {
  const suivi = ctx.results.suiviEval?.data as SuiviEvalOutput | undefined;
  const qhse  = ctx.results.qhse?.data   as QHSEOutput       | undefined;
  const out: Omit<CustomIndicator, 'id' | 'createdAt' | 'updatedAt'>[] = [];

  // ── 1. ICPs Suivi-Éval ────────────────────────────────────────────────────
  if (suivi?.icps?.length) {
    for (const icp of suivi.icps) {
      // Trouver le seuil RAG correspondant (matching par libelle)
      const seuil = suivi.alerteSeuils?.find(s =>
        s.indicateur.toLowerCase().includes(icp.code.toLowerCase()) ||
        icp.libelle.toLowerCase().includes(s.indicateur.toLowerCase().slice(0, 10))
      );

      const unit = mapUnite(icp.unite);
      const formula = mapIcpToFormula(icp.code, unit);

      out.push({
        name: icp.libelle,
        description: `ICP ${icp.code} · Source : ${icp.source} · Fréquence : ${icp.frequence}`,
        formula,
        unit,
        target: icp.valeurCible,
        thresholds: seuil ? {
          // seuilOrange = seuil en dessous duquel on passe à Amber
          // seuilRouge  = seuil en dessous duquel on passe à Rouge
          good: seuil.seuilOrange,   // ≥ seuilOrange → Vert
          warn: seuil.seuilRouge,    // ≥ seuilRouge  → Amber, sinon Rouge
          direction: 'higher',
        } : {
          good: icp.valeurCible,
          warn: Math.round(icp.valeurCible * 0.6),
          direction: 'higher',
        },
      });
    }
  }

  // ── 2. Indicateurs HSE/QHSE ───────────────────────────────────────────────
  if (qhse?.indicateursHSE?.length) {
    for (const kpi of qhse.indicateursHSE) {
      const unit = mapUnite(kpi.unite);
      const isLower = kpi.libelle.toLowerCase().includes('accident') ||
                      kpi.libelle.toLowerCase().includes('incident') ||
                      kpi.libelle.toLowerCase().includes('anomalie');
      out.push({
        name: `[HSE] ${kpi.libelle}`,
        description: `KPI HSE ${kpi.code} · Fréquence : ${kpi.frequence}`,
        formula: 'AVG(avancement)', // placeholder — remplacé manuellement si besoin
        unit,
        target: kpi.cible,
        thresholds: {
          good: isLower ? kpi.cible : Math.round(kpi.cible * 0.9),
          warn: isLower ? kpi.cible * 2 : Math.round(kpi.cible * 0.6),
          direction: isLower ? 'lower' : 'higher',
        },
      });
    }
  }

  return out;
}

/** Mappe les unités ICP vers IndicatorUnit */
function mapUnite(unite: string): IndicatorUnit {
  const u = unite.toLowerCase();
  if (u.includes('%')) return 'percent';
  if (u.includes('fcfa') || u.includes('mfcfa') || u.includes('xof')) return 'fcfa';
  if (u.includes('ratio') || u.includes('indice')) return 'ratio';
  return 'number';
}

/** Mappe un code ICP vers une formule indicatorStore */
function mapIcpToFormula(code: string, unit: IndicatorUnit): string {
  const c = code.toUpperCase();
  if (c.includes('AVANCEMENT') || c.includes('AV_') || c.includes('TAPP') || c.includes('TAPR'))
    return 'WAVG(avancement)';
  if (c.includes('BUDGET') || c.includes('FIN') || c.includes('DEC'))
    return 'SUM(budgetDecaisse) / SUM(budget) * 100';
  if (c.includes('CPI'))
    return 'AVG(cpi)';
  if (c.includes('SPI'))
    return 'AVG(spi)';
  if (c.includes('COUNT') || c.includes('NB') || c.includes('TOTAL'))
    return unit === 'number' ? 'COUNT()' : 'WAVG(avancement)';
  return 'WAVG(avancement)';
}

// ─────────────────────────────────────────────────────────────────────────────
// Fonction principale : SwarmContext → Partial<Projet>
// ─────────────────────────────────────────────────────────────────────────────

export interface SwarmStoreMapping {
  /** Patch à passer à updateProjet */
  projetPatch: Partial<Projet>;
  /** Tâches WBS enrichies (remplace les tâches créées à l'étape 1) */
  tachesEnrichies: TacheWBS[];
}

export function swarmContextToProjetPatch(
  ctx: SwarmContext,
  projetId: string,
  existingTaches: TacheWBS[],
): SwarmStoreMapping {
  const pc           = ctx.projetContext;
  const planif       = ctx.results.planificateur?.data as PlanificateurOutput | undefined;
  const financ       = ctx.results.financier?.data as FinancierOutput | undefined;
  const risques      = ctx.results.risques?.data as RisquesOutput | undefined;
  const marches      = ctx.results.marches?.data as MarchesOutput | undefined;
  const qhse         = ctx.results.qhse?.data as QHSEOutput | undefined;
  const suivi        = ctx.results.suiviEval?.data as SuiviEvalOutput | undefined;
  const ressrcs      = ctx.results.ressources?.data as RessourcesOutput | undefined;
  const sig          = ctx.results.sig?.data as SIGOutput | undefined;
  const bordereaux   = ctx.results.bordereaux?.data as BordereauOutput | undefined;
  const programmes   = ctx.results.programmes?.data as ProgrammeOutput | undefined;
  const erp          = ctx.results.erp?.data as ERPOutput | undefined;
  const fournisseurs = ctx.results.fournisseurs?.data as FournisseursOutput | undefined;
  const reception    = ctx.results.reception?.data as ReceptionOutput | undefined;
  const reporting    = ctx.results.reporting?.data as ReportingOutput | undefined;
  const courriers    = ctx.results.courriers?.data as CourriersOutput | undefined;

  // ── RAG statut global (Red / Amber / Green) ──
  const statutGlobal = computeRagStatut(planif, financ, risques);

  // ── Incidents (risques) ──
  const incidents: Incident[] = risques
    ? mapRisquesToIncidents(risques, projetId, pc.chefProjetNom ?? 'Chef de Projet DPE')
    : [];

  // ── HSE ──
  const hse: ProjetHSE | undefined = qhse ? mapQHSEToHSE(qhse) : undefined;

  // ── Passation marchés ──
  const passationMarches: PassationMarches | undefined = marches
    ? mapMarchesToPassation(marches)
    : undefined;

  // ── Données financières ──
  const budget          = financ?.budgetTotal ?? pc.budgetEstime;
  const budgetEngage    = financ?.engagementsInit ?? 0;
  const budgetDecaisse  = financ?.tauxDecaissement
    ? Math.round((financ.tauxDecaissement / 100) * budget)
    : 0;

  // ── Jalons (si pas encore renseignés) ──
  const jalons: Jalon[] = (planif?.jalons ?? []).map(j => ({
    label:   j.nom,
    date:    j.date,
    atteint: j.statut === 'Atteint',
  }));

  // ── Metadata étendue — toutes les données riches ──
  const metadata: Record<string, unknown> = {
    // BOQ — Bordereau de Quantités Unitaires (4 lots PAUE2)
    boqLots: financ?.lots ?? [],

    // Lots marché passation
    lotsMarches: marches?.lotsIdentifies ?? [],
    totalMarchesPrevu: marches?.totalMarchesPrevu ?? 0,
    daoExtraits: marches?.daoExtraits ?? [],
    ccapPoints: marches?.ccapPoints ?? [],

    // ICP / KPIs Suivi-Éval (RAG thresholds inclus)
    icps: suivi?.icps ?? [],
    alertesSeuils: suivi?.alerteSeuils ?? [],   // seuils Orange/Rouge par indicateur
    courbeSPlanifiee: suivi?.courbeSPlanifiee ?? [],
    configEVM: suivi?.configEVM ?? null,

    // QHSE
    planPGES: qhse?.planPGES ?? [],
    indicateursHSE: qhse?.indicateursHSE ?? [],
    conformiteQHSE: qhse?.conformiteDPE ?? [],
    formationsRequises: qhse?.formationsRequises ?? [],
    niveauRisqueHSE: qhse?.niveauRisqueHSE ?? 'Modéré',

    // Business Analyst
    objectifsStrategiques: ctx.results.businessAnalyst?.data?.objectifsStrategiques ?? [],
    exigencesFonctionnelles: ctx.results.businessAnalyst?.data?.exigencesFonctionnelles ?? [],
    contraintesIdentifiees: ctx.results.businessAnalyst?.data?.contraintesIdentifiees ?? [],
    codesBIT: ctx.results.businessAnalyst?.data?.codesBIT ?? [],
    niveauComplexite: ctx.results.businessAnalyst?.data?.niveauComplexite ?? 'Modéré',

    // SIG — données cartographiques
    sigZones: sig?.zones ?? [],
    sigCentroide: sig?.centroide ?? null,
    sigRegions: sig?.regionsIdentifiees ?? [],
    sigLocalites: sig?.localitesIdentifiees ?? [],
    sigEmprise: sig?.empriseTotaleKm2 ?? 0,
    sigProjection: sig?.projectionDetectee ?? 'WGS84',

    // Bordereaux — BPU/DQE
    bordereauxSections: bordereaux?.sections ?? [],
    bordereauxTotalHT: bordereaux?.totalHT ?? 0,
    bordereauxTotalTTC: bordereaux?.totalTTC ?? 0,
    bordereauxNbLignes: bordereaux?.nbLignes ?? 0,

    // Programme & Portefeuille
    codeProgramme: programmes?.codeProgramme ?? pc.programme ?? '',
    nomProgramme: programmes?.nomProgramme ?? '',
    codePortefeuille: programmes?.codePortefeuille ?? '',
    bailleurProgramme: programmes?.bailleur ?? pc.bailleur ?? '',
    composanteProgramme: programmes?.composante ?? '',
    objectifsProgramme: programmes?.objetifsProgramme ?? [],

    // ERP — codes imputation Oracle
    codeImputation: erp?.codeImputation ?? '',
    codeBIT: erp?.codeBIT ?? '',
    codesCPF: erp?.codesCPF ?? [],
    referencesOracle: erp?.referencesOracle ?? [],
    referencesSAP: erp?.referencesSAP ?? [],
    centresCout: erp?.centresCout ?? [],

    // Fournisseurs / Prestataires
    fournisseurs: fournisseurs?.fournisseurs ?? [],
    risquesConcentration: fournisseurs?.risquesConcentration ?? [],
    nbFournisseurs: fournisseurs?.fournisseurs?.length ?? 0,
    montantTotalEngageMFCFA: fournisseurs?.totalMontantContrats ?? 0,

    // Réception
    etapesReception: reception?.etapes ?? [],
    jalonsReception: reception?.jalonsReception ?? [],
    reservesEnCours: reception?.reservesEnCours ?? [],
    asBuiltDisponible: reception?.asBuiltDisponible ?? false,
    documentsRequisReception: reception?.documentsTechniques ?? [],
    statutReception: reception?.statutGlobal ?? 'Non commencée',

    // Reporting
    typeRapport: reporting?.typeRapport ?? null,
    periodeRapport: reporting?.periodeCouverture ?? '',
    sectionsRapport: reporting?.sections ?? [],
    indicateursClesRapport: reporting?.indicateursCles ?? [],
    conclusionsRapport: reporting?.conclusions ?? [],
    recommandationsRapport: reporting?.recommandations ?? [],

    // Courriers / ODS
    courriers: courriers?.courriers ?? [],
    odsDetectes: courriers?.odsDetectes ?? [],
    alertesCourriers: courriers?.alertes ?? [],
    nbCourriersSansReponse: courriers?.nbCourriersSansReponse ?? 0,

    // Swarm meta
    swarmRunId: ctx.runId,
    swarmDate:  ctx.startedAt,
    sourceFiles: pc.sourceFiles.map(f => f.name),
  };

  // ── Tâches enrichies avec ressources ──
  const tachesEnrichies = ressrcs
    ? enrichTachesWithRessources(existingTaches, ressrcs)
    : existingTaches;

  const projetPatch: Partial<Projet> = {
    budget,
    budgetEngage,
    budgetDecaisse,
    ...(jalons.length ? { jalons } : {}),
    incidents,
    hse,
    passationMarches,
    statutGlobal,
    description: ctx.results.businessAnalyst?.data?.perimetreProjet || pc.description,
    objectifs: ctx.results.businessAnalyst?.data?.objectifsStrategiques,
    montantMarche: marches?.totalMarchesPrevu ? marches.totalMarchesPrevu * 1_000_000 : undefined,
    programme: programmes?.codeProgramme ?? pc.programme,
    ...(sig?.regionsIdentifiees?.length ? { region: sig.regionsIdentifiees[0] } : {}),
    metadata,
  };

  return { projetPatch, tachesEnrichies };
}

/**
 * amortissement.ts — MOTEUR D'AMORTISSEMENT depuis PV DE RÉCEPTION PROVISOIRE
 * --------------------------------------------------------------------------
 * Le PV de réception provisoire fixe la DATE DE MISE EN SERVICE de l'actif :
 * c'est le fait générateur de l'immobilisation et le point de départ de
 * l'amortissement (règle SYSCOHADA : prorata temporis, base journalière,
 * clôtures au 31/12).
 *
 * À partir d'un ACTIF assemblé (WBS chiffré) + un PV → on génère le plan
 * d'amortissement par article ET le plan consolidé de l'actif, reproduisant
 * la logique des colonnes datées du bordereau (06/12/2019 → 31/12 → …).
 */

import type { ActifStructure, ActifNode } from './assembleur';
import { feuilles } from './assembleur';

export type MethodeAmort = 'lineaire' | 'degressif';

export interface EcheanceAmort {
  date: string;      // clôture 'YYYY-MM-DD'
  exercice: number;  // année fiscale
  base: number;      // VNC en début de période
  dotation: number;  // dotation de la période
  cumul: number;     // amortissements cumulés
  vnc: number;       // valeur nette comptable en fin de période
  jours: number;     // jours amortis dans la période (prorata)
}

export interface PVReception {
  id: string;
  numero: string;                 // n° du PV (ex. PV-2019-0142)
  actifId: string;                // actif réceptionné
  dateReceptionProvisoire: string;// 'YYYY-MM-DD' = date mise en service / début amort.
  dureeAmort: number;             // années
  methode: MethodeAmort;
  valeurResiduelle?: number;      // FCFA (défaut 0)
  observations?: string;
  signePar?: string;
  dateSignature?: string;
  classification?: ClassificationActif; // tags référentiels (liste de valeurs + décomposition)
}

/** Attributs de structuration issus de la Liste de valeurs + Décomposition. */
export interface ClassificationActif {
  organisationDepense?: string; // Production / Transport / Distribution…
  composant?: string;           // Classification Actif Projet
  sousComposant?: string;       // Actif Livrable
  nature?: string;              // classe comptable (auto depuis le composant)
  regleDOI?: string;            // règle DOI (auto depuis le composant)
  domaineBIT?: string;
  processus?: string;
  bailleur?: string;
  unite?: string;
  statutRMA?: string;
}

const MS_JOUR = 86_400_000;
const iso = (d: Date) => d.toISOString().slice(0, 10);
const joursEntre = (a: Date, b: Date) => Math.max(0, Math.round((b.getTime() - a.getTime()) / MS_JOUR));

/**
 * Plan d'amortissement linéaire prorata temporis d'une valeur brute.
 * Première clôture = 31/12 de l'année de mise en service (prorata),
 * puis exercices pleins, dernier exercice = solde.
 */
export function planLineaire(
  valeurBrute: number, dateMES: string, dureeAnnees: number, valeurResiduelle = 0,
): EcheanceAmort[] {
  const base = Math.max(0, valeurBrute - valeurResiduelle);
  const duree = Math.max(1, Math.round(dureeAnnees));
  const debut = new Date(dateMES);
  if (isNaN(debut.getTime()) || base === 0) return [];

  // Fin théorique de l'amortissement (durée en jours, base 365).
  const fin = new Date(debut.getTime() + duree * 365 * MS_JOUR);
  const tauxJour = base / (duree * 365); // dotation journalière

  const lignes: EcheanceAmort[] = [];
  let curseur = new Date(debut);
  let cumul = 0;

  while (curseur < fin && cumul < base - 0.5) {
    const finExercice = new Date(curseur.getFullYear(), 11, 31); // 31/12
    const borne = finExercice < fin ? finExercice : fin;
    const jours = joursEntre(curseur, borne) + (borne === fin ? 0 : 1);
    let dotation = tauxJour * jours;
    if (cumul + dotation > base) dotation = base - cumul; // solde dernier exercice
    const baseDebut = valeurBrute - cumul;
    cumul += dotation;
    lignes.push({
      date: iso(borne), exercice: borne.getFullYear(), base: baseDebut,
      dotation, cumul, vnc: valeurBrute - cumul, jours,
    });
    curseur = new Date(borne.getTime() + MS_JOUR); // 1er janvier suivant
  }
  return lignes;
}

/** Plan dégressif (taux = coef/durée), bascule en linéaire quand avantageux. */
export function planDegressif(
  valeurBrute: number, dateMES: string, dureeAnnees: number, valeurResiduelle = 0,
): EcheanceAmort[] {
  const duree = Math.max(1, Math.round(dureeAnnees));
  const coef = duree <= 4 ? 1.5 : duree <= 6 ? 2.0 : 2.5;
  const taux = (1 / duree) * coef;
  const debut = new Date(dateMES);
  if (isNaN(debut.getTime())) return [];
  const lignes: EcheanceAmort[] = [];
  let vnc = valeurBrute, cumul = 0;
  for (let i = 0; i < duree; i++) {
    const restant = duree - i;
    const dotDeg = (vnc - valeurResiduelle) * taux;
    const dotLin = (vnc - valeurResiduelle) / restant;
    let dotation = Math.max(dotDeg, dotLin);
    if (i === duree - 1) dotation = vnc - valeurResiduelle;
    const annee = debut.getFullYear() + i;
    const baseDebut = vnc;
    cumul += dotation; vnc -= dotation;
    lignes.push({ date: `${annee}-12-31`, exercice: annee, base: baseDebut, dotation, cumul, vnc, jours: 365 });
  }
  return lignes;
}

export function planAmort(valeurBrute: number, pv: PVReception): EcheanceAmort[] {
  return pv.methode === 'degressif'
    ? planDegressif(valeurBrute, pv.dateReceptionProvisoire, pv.dureeAmort, pv.valeurResiduelle)
    : planLineaire(valeurBrute, pv.dateReceptionProvisoire, pv.dureeAmort, pv.valeurResiduelle);
}

export interface LigneAmortActif {
  node: ActifNode;
  plan: EcheanceAmort[];
}

/** Génère le plan d'amortissement de chaque article capitalisé d'un actif. */
export function amortirActif(actif: ActifStructure, pv: PVReception): LigneAmortActif[] {
  return feuilles(actif)
    .filter(n => n.valeur > 0)
    .map(node => ({ node, plan: planAmort(node.valeur, pv) }));
}

/** Plan consolidé de l'actif (somme des plans articles, agrégé par exercice). */
export function planConsolide(actif: ActifStructure, pv: PVReception): EcheanceAmort[] {
  const parExo = new Map<number, EcheanceAmort>();
  for (const { plan } of amortirActif(actif, pv)) {
    for (const e of plan) {
      const acc = parExo.get(e.exercice);
      if (acc) { acc.dotation += e.dotation; }
      else parExo.set(e.exercice, { ...e });
    }
  }
  // Recalcule base / cumul / vnc consolidés.
  const lignes = [...parExo.values()].sort((a, b) => a.exercice - b.exercice);
  let cumul = 0;
  for (const l of lignes) { l.base = actif.valeurTotale - cumul; cumul += l.dotation; l.cumul = cumul; l.vnc = actif.valeurTotale - cumul; }
  return lignes;
}

/** VNC de l'actif à une date donnée (par défaut aujourd'hui). */
export function vncActif(actif: ActifStructure, pv: PVReception, at = new Date()): number {
  const plan = planConsolide(actif, pv);
  let vnc = actif.valeurTotale;
  for (const l of plan) { if (l.exercice <= at.getFullYear()) vnc = l.vnc; }
  return vnc;
}

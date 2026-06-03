/**
 * odmConfigStore.ts — Référentiel PARAMÉTRABLE des Ordres de Mission (ODM).
 *
 * Centralise tout ce qui était codé en dur dans la page ODM :
 *   • Parc véhicules mobilisables (label + consommation L/100km + statut) ;
 *   • Per diem domestique (FCFA/jour, base nationale + surcharges régionales) ;
 *   • Per diem internationaux (USD/jour par pays) + taux de change USD→FCFA ;
 *   • Paramètres carburant (prix du litre, consommation moyenne par défaut) ;
 *   • Grille salariale (catégorie → salaire mensuel + heures mensuelles légales)
 *     servant au calcul du taux horaire et des HEURES SUPPLÉMENTAIRES ;
 *   • Règles d'heures supplémentaires (majorations jour/nuit/dimanche/férié).
 *
 * Éditable par les profils habilités (DPE / PMO / Contrôle financier / Admin).
 * Persisté dans localStorage (clé `sigepp-odm-config`).
 */

import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export interface VehiculeParam {
  id: string;
  label: string;            // ex. 'SN-0234-DA — Toyota LC 200'
  consoLitresPer100: number; // consommation moyenne (L/100 km)
  actif: boolean;
  appartenance?: string;     // code unité/direction de rattachement (ex. 'DER', 'DPD_DISTRIBUTION')
}

/** Chauffeur rattaché à une unité (appartenance) — affecté aux véhicules de son unité. */
export interface ChauffeurParam {
  id: string;
  nom: string;              // « Prénom NOM »
  appartenance: string;     // code direction/département (ex. 'DER', 'DPD_DISTRIBUTION', 'EM_DPE')
  permis: string;           // catégorie(s) de permis, ex. 'B, C'
  telephone?: string;
  actif: boolean;
}

export interface PerdiemRegion {
  region: string;
  montantJour: number;      // FCFA / jour
}

export interface PerdiemPays {
  pays: string;
  montantUSDJour: number;   // USD / jour
}

export interface GradeSalaire {
  id: string;
  categorie: string;        // ex. 'Cadre supérieur', 'Ingénieur', 'Technicien'
  salaireMensuel: number;   // FCFA / mois (base)
  heuresMensuelles: number; // heures légales / mois (ex. 173.33)
}

export interface HeuresSupRegles {
  /** Seuil hebdomadaire au-delà duquel les heures sont majorées (ex. 40 h). */
  seuilHebdo: number;
  /** Majoration heures sup. de jour ouvrable (%) — ex. 15 puis 40 ; on garde un taux unique simplifié. */
  majJourOuvrable: number;  // %
  majNuit: number;          // %
  majDimanche: number;      // %
  majFerie: number;         // %
}

export interface CarburantParam {
  prixLitre: number;        // FCFA / litre
  consoMoyennePar100: number; // L/100 km (défaut si véhicule non précisé)
}

export interface OdmConfigState {
  vehicules: VehiculeParam[];
  chauffeurs: ChauffeurParam[];           // chauffeurs rattachés à leur unité (appartenance)
  perdiemBaseDomestique: number;          // FCFA/jour — base nationale
  perdiemsRegionaux: PerdiemRegion[];     // surcharges/overrides par région
  perdiemsInternationaux: PerdiemPays[];  // USD/jour par pays
  tauxUSDtoFCFA: number;                  // 1 USD = X FCFA
  carburant: CarburantParam;
  grilleSalariale: GradeSalaire[];
  heuresSup: HeuresSupRegles;

  // ── Actions véhicules ──
  addVehicule: (label: string, consoLitresPer100: number) => void;
  updateVehicule: (id: string, patch: Partial<VehiculeParam>) => void;
  removeVehicule: (id: string) => void;

  // ── Actions chauffeurs (par appartenance) ──
  addChauffeur: (nom: string, appartenance: string, permis: string) => void;
  updateChauffeur: (id: string, patch: Partial<ChauffeurParam>) => void;
  removeChauffeur: (id: string) => void;

  // ── Actions per diem ──
  setPerdiemBase: (v: number) => void;
  setPerdiemRegion: (region: string, montantJour: number) => void;
  removePerdiemRegion: (region: string) => void;
  setPerdiemPays: (pays: string, montantUSDJour: number) => void;
  removePerdiemPays: (pays: string) => void;
  setTauxChange: (v: number) => void;

  // ── Carburant ──
  setCarburant: (patch: Partial<CarburantParam>) => void;

  // ── Grille salariale ──
  addGrade: (categorie: string, salaireMensuel: number, heuresMensuelles: number) => void;
  updateGrade: (id: string, patch: Partial<GradeSalaire>) => void;
  removeGrade: (id: string) => void;

  // ── Heures sup ──
  setHeuresSup: (patch: Partial<HeuresSupRegles>) => void;

  resetConfig: () => void;
}

/* ─── Valeurs par défaut (référentiel SENELEC / DPE) ─── */
const DEFAULT_VEHICULES: VehiculeParam[] = [
  { id: 'V01', label: 'SN-0234-DA — Toyota LC 200',      consoLitresPer100: 16, actif: true },
  { id: 'V02', label: 'SN-4521-DK — Nissan Patrol',      consoLitresPer100: 15, actif: true },
  { id: 'V03', label: 'SN-7892-DK — Mitsubishi L200',    consoLitresPer100: 13, actif: true },
  { id: 'V04', label: 'SN-1103-TH — Toyota Hilux',       consoLitresPer100: 12, actif: true },
  { id: 'V05', label: 'SN-5567-ZG — Land Rover Defender', consoLitresPer100: 14, actif: true },
];

const DEFAULT_PERDIEMS_INTL: PerdiemPays[] = [
  { pays: 'France',          montantUSDJour: 220 },
  { pays: 'Allemagne',       montantUSDJour: 195 },
  { pays: 'Suisse',          montantUSDJour: 280 },
  { pays: 'Espagne',         montantUSDJour: 175 },
  { pays: 'Italie',          montantUSDJour: 190 },
  { pays: 'Corée du Sud',    montantUSDJour: 190 },
  { pays: 'Chine',           montantUSDJour: 160 },
  { pays: 'Turquie',         montantUSDJour: 150 },
  { pays: 'Maroc',           montantUSDJour: 120 },
  { pays: "Côte d'Ivoire",   montantUSDJour: 110 },
  { pays: 'Canada',          montantUSDJour: 230 },
];

const DEFAULT_GRILLE: GradeSalaire[] = [
  { id: 'g1', categorie: 'Cadre supérieur / Directeur', salaireMensuel: 2_200_000, heuresMensuelles: 173.33 },
  { id: 'g2', categorie: 'Cadre / Chef de Département',  salaireMensuel: 1_500_000, heuresMensuelles: 173.33 },
  { id: 'g3', categorie: 'Ingénieur / Chef de Projet',   salaireMensuel: 1_050_000, heuresMensuelles: 173.33 },
  { id: 'g4', categorie: 'Technicien supérieur',         salaireMensuel:   700_000, heuresMensuelles: 173.33 },
  { id: 'g5', categorie: 'Agent de maîtrise',            salaireMensuel:   480_000, heuresMensuelles: 173.33 },
  { id: 'g6', categorie: 'Agent d\'exécution',           salaireMensuel:   320_000, heuresMensuelles: 173.33 },
];

const DEFAULT_HEURES_SUP: HeuresSupRegles = {
  seuilHebdo: 40,
  majJourOuvrable: 15,
  majNuit: 60,
  majDimanche: 60,
  majFerie: 100,
};

const DEFAULT_CHAUFFEURS: ChauffeurParam[] = [
  { id: 'C01', nom: 'Modou FALL',    appartenance: 'DER',             permis: 'B, C', telephone: '77 123 45 01', actif: true },
  { id: 'C02', nom: 'Ibra DIOP',     appartenance: 'DER',             permis: 'B, C', telephone: '77 123 45 02', actif: true },
  { id: 'C03', nom: 'Alassane SARR', appartenance: 'DPD_DISTRIBUTION', permis: 'B',    telephone: '77 123 45 03', actif: true },
  { id: 'C04', nom: 'Mamadou WADE',  appartenance: 'DPT_TRANSPORT',   permis: 'B, C', telephone: '77 123 45 04', actif: true },
  { id: 'C05', nom: 'Oumar NDIAYE',  appartenance: 'EM_DPE',          permis: 'B',    telephone: '77 123 45 05', actif: true },
  { id: 'C06', nom: 'Cheikh BA',     appartenance: 'EM_DPE',          permis: 'B, D', telephone: '77 123 45 06', actif: true },
];

const DEFAULTS = {
  vehicules: DEFAULT_VEHICULES,
  chauffeurs: DEFAULT_CHAUFFEURS,
  perdiemBaseDomestique: 25_000,
  perdiemsRegionaux: [
    { region: 'Dakar', montantJour: 30_000 },
    { region: 'Casamance', montantJour: 35_000 },
  ] as PerdiemRegion[],
  perdiemsInternationaux: DEFAULT_PERDIEMS_INTL,
  tauxUSDtoFCFA: 620,
  carburant: { prixLitre: 990, consoMoyennePar100: 14 } as CarburantParam,
  grilleSalariale: DEFAULT_GRILLE,
  heuresSup: DEFAULT_HEURES_SUP,
};

/** Taux horaire de base = salaire mensuel / heures mensuelles légales. */
export function tauxHoraire(g: GradeSalaire): number {
  return g.heuresMensuelles > 0 ? Math.round(g.salaireMensuel / g.heuresMensuelles) : 0;
}

/** Coût d'heures sup. = nbHeures × tauxHoraire × (1 + majoration%). */
export function coutHeuresSup(g: GradeSalaire, nbHeures: number, majorationPct: number): number {
  return Math.round(nbHeures * tauxHoraire(g) * (1 + majorationPct / 100));
}

/** Per diem journalier international en FCFA (USD × taux de change). */
export function perdiemFCFA(montantUSDJour: number, tauxUSDtoFCFA: number): number {
  return Math.round(montantUSDJour * tauxUSDtoFCFA);
}

export const useOdmConfig = create<OdmConfigState>()(
  persist(
    (set) => ({
      ...DEFAULTS,
      vehicules: DEFAULTS.vehicules.map(v => ({ ...v })),
      chauffeurs: DEFAULTS.chauffeurs.map(c => ({ ...c })),
      perdiemsRegionaux: DEFAULTS.perdiemsRegionaux.map(r => ({ ...r })),
      perdiemsInternationaux: DEFAULTS.perdiemsInternationaux.map(p => ({ ...p })),
      grilleSalariale: DEFAULTS.grilleSalariale.map(g => ({ ...g })),
      carburant: { ...DEFAULTS.carburant },
      heuresSup: { ...DEFAULTS.heuresSup },

      addVehicule: (label, conso) => set(s => ({
        vehicules: [...s.vehicules, { id: `V${Date.now()}`, label: label.trim() || 'Nouveau véhicule', consoLitresPer100: Math.max(0, conso), actif: true }],
      })),
      updateVehicule: (id, patch) => set(s => ({
        vehicules: s.vehicules.map(v => v.id === id ? { ...v, ...patch } : v),
      })),
      removeVehicule: (id) => set(s => ({ vehicules: s.vehicules.filter(v => v.id !== id) })),

      addChauffeur: (nom, appartenance, permis) => set(s => ({
        chauffeurs: [...s.chauffeurs, { id: `C${Date.now()}`, nom: nom.trim() || 'Nouveau chauffeur', appartenance: appartenance || 'DER', permis: permis.trim() || 'B', actif: true }],
      })),
      updateChauffeur: (id, patch) => set(s => ({
        chauffeurs: s.chauffeurs.map(c => c.id === id ? { ...c, ...patch } : c),
      })),
      removeChauffeur: (id) => set(s => ({ chauffeurs: s.chauffeurs.filter(c => c.id !== id) })),

      setPerdiemBase: (v) => set({ perdiemBaseDomestique: Math.max(0, v) }),
      setPerdiemRegion: (region, montantJour) => set(s => {
        const exists = s.perdiemsRegionaux.some(r => r.region === region);
        return {
          perdiemsRegionaux: exists
            ? s.perdiemsRegionaux.map(r => r.region === region ? { ...r, montantJour: Math.max(0, montantJour) } : r)
            : [...s.perdiemsRegionaux, { region: region.trim(), montantJour: Math.max(0, montantJour) }],
        };
      }),
      removePerdiemRegion: (region) => set(s => ({ perdiemsRegionaux: s.perdiemsRegionaux.filter(r => r.region !== region) })),
      setPerdiemPays: (pays, montantUSDJour) => set(s => {
        const exists = s.perdiemsInternationaux.some(p => p.pays === pays);
        return {
          perdiemsInternationaux: exists
            ? s.perdiemsInternationaux.map(p => p.pays === pays ? { ...p, montantUSDJour: Math.max(0, montantUSDJour) } : p)
            : [...s.perdiemsInternationaux, { pays: pays.trim(), montantUSDJour: Math.max(0, montantUSDJour) }],
        };
      }),
      removePerdiemPays: (pays) => set(s => ({ perdiemsInternationaux: s.perdiemsInternationaux.filter(p => p.pays !== pays) })),
      setTauxChange: (v) => set({ tauxUSDtoFCFA: Math.max(1, v) }),

      setCarburant: (patch) => set(s => ({ carburant: { ...s.carburant, ...patch } })),

      addGrade: (categorie, salaireMensuel, heuresMensuelles) => set(s => ({
        grilleSalariale: [...s.grilleSalariale, { id: `g${Date.now()}`, categorie: categorie.trim() || 'Nouvelle catégorie', salaireMensuel: Math.max(0, salaireMensuel), heuresMensuelles: Math.max(1, heuresMensuelles) }],
      })),
      updateGrade: (id, patch) => set(s => ({
        grilleSalariale: s.grilleSalariale.map(g => g.id === id ? { ...g, ...patch } : g),
      })),
      removeGrade: (id) => set(s => ({ grilleSalariale: s.grilleSalariale.filter(g => g.id !== id) })),

      setHeuresSup: (patch) => set(s => ({ heuresSup: { ...s.heuresSup, ...patch } })),

      resetConfig: () => set({
        vehicules: DEFAULTS.vehicules.map(v => ({ ...v })),
        chauffeurs: DEFAULTS.chauffeurs.map(c => ({ ...c })),
        perdiemBaseDomestique: DEFAULTS.perdiemBaseDomestique,
        perdiemsRegionaux: DEFAULTS.perdiemsRegionaux.map(r => ({ ...r })),
        perdiemsInternationaux: DEFAULTS.perdiemsInternationaux.map(p => ({ ...p })),
        tauxUSDtoFCFA: DEFAULTS.tauxUSDtoFCFA,
        carburant: { ...DEFAULTS.carburant },
        grilleSalariale: DEFAULTS.grilleSalariale.map(g => ({ ...g })),
        heuresSup: { ...DEFAULTS.heuresSup },
      }),
    }),
    { name: 'sigepp-odm-config' }
  )
);

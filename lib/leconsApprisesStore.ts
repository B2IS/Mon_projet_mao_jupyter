/**
 * leconsApprisesStore.ts — Registre des Leçons Apprises (RETEX) SIGEPP-DPE
 * -----------------------------------------------------------------------
 * Capitalisation de l'expérience projet : les chefs de projet consignent les
 * leçons apprises (succès, échecs, axes d'amélioration) à chaque phase du cycle
 * de vie. Les leçons « partagées » sont accessibles à l'ensemble des profils
 * pour apprendre des projets passés (base de connaissance transverse).
 */

import { create } from 'zustand';
import { persist } from 'zustand/middleware';

// ─────────────────────────────────────────────────────────────────────────────
// TYPES
// ─────────────────────────────────────────────────────────────────────────────

export type CategorieLecon =
  | 'technique' | 'planification' | 'budget' | 'marches'
  | 'qhse' | 'rh' | 'gouvernance' | 'parties_prenantes' | 'autre';

export type PhaseLecon = 'etude' | 'conception' | 'execution' | 'reception' | 'cloture' | 'exploitation';
export type TypeLecon = 'succes' | 'echec' | 'amelioration';
export type ImpactLecon = 'faible' | 'moyen' | 'fort';

export interface LeconApprise {
  id: string;
  titre: string;
  projetId?: string;
  projetNom?: string;
  auteurId: string;
  auteur: string;
  auteurRole: string;
  categorie: CategorieLecon;
  phase: PhaseLecon;
  type: TypeLecon;
  impact: ImpactLecon;
  /** Contexte & situation rencontrée. */
  contexte: string;
  /** Problème ou opportunité observé. */
  probleme: string;
  /** Action / solution mise en œuvre. */
  solution: string;
  /** Recommandation réutilisable pour les futurs projets. */
  recommandation: string;
  tags: string[];
  /** Partagée = visible par tous les profils (sinon visible par l'auteur seul). */
  partagee: boolean;
  /** IDs des utilisateurs ayant trouvé la leçon utile. */
  utilePar: string[];
  createdAt: string;
  updatedAt: string;
}

// ─────────────────────────────────────────────────────────────────────────────
// LABELS
// ─────────────────────────────────────────────────────────────────────────────

export const CATEGORIE_LECON_LABEL: Record<CategorieLecon, string> = {
  technique: 'Technique & Ingénierie',
  planification: 'Planification & Délais',
  budget: 'Budget & Financement',
  marches: 'Marchés & Contractualisation',
  qhse: 'QHSE & Environnemental',
  rh: 'Ressources humaines',
  gouvernance: 'Gouvernance & Pilotage',
  parties_prenantes: 'Parties prenantes',
  autre: 'Autre',
};

export const PHASE_LECON_LABEL: Record<PhaseLecon, string> = {
  etude: 'Étude',
  conception: 'Conception',
  execution: 'Exécution',
  reception: 'Réception',
  cloture: 'Clôture',
  exploitation: 'Exploitation',
};

export const TYPE_LECON_LABEL: Record<TypeLecon, string> = {
  succes: 'Bonne pratique',
  echec: 'Difficulté / échec',
  amelioration: 'Axe d\'amélioration',
};

export const TYPE_LECON_COLOR: Record<TypeLecon, string> = {
  succes: '#16A34A',
  echec: '#DC2626',
  amelioration: '#D97706',
};

export const IMPACT_LECON_LABEL: Record<ImpactLecon, string> = {
  faible: 'Faible', moyen: 'Moyen', fort: 'Fort',
};

// ─────────────────────────────────────────────────────────────────────────────
// STORE
// ─────────────────────────────────────────────────────────────────────────────

function uid() { return `lecon-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`; }

export type NouvelleLecon = Omit<LeconApprise, 'id' | 'createdAt' | 'updatedAt' | 'utilePar'>;

interface LeconsState {
  lecons: LeconApprise[];
  seeded: boolean;
  add: (l: NouvelleLecon) => string;
  update: (id: string, patch: Partial<LeconApprise>) => void;
  remove: (id: string) => void;
  /** Bascule le vote « utile » d'un utilisateur sur une leçon. */
  toggleUtile: (id: string, userId: string) => void;
  seed: () => void;
}

const SEED: NouvelleLecon[] = [
  {
    titre: 'Sécuriser les approvisionnements transformateurs en début de marché',
    projetNom: 'Réhabilitation sous-station 30 kV Louga',
    auteurId: 'demo_chefproj', auteur: 'Ndiémé GUEYE', auteurRole: 'CHEF_PROJ',
    categorie: 'marches', phase: 'execution', type: 'echec', impact: 'fort',
    contexte: 'Délais de fabrication des transformateurs HTA sous-estimés au planning initial.',
    probleme: 'Retard de 4 mois sur la mise en service lié à la livraison tardive des transformateurs importés.',
    solution: 'Passage de la commande des équipements à long délai dès la notification du marché, avant la fin des études détaillées.',
    recommandation: 'Identifier les équipements à long délai (transformateurs, cellules) en phase étude et lancer les commandes anticipées.',
    tags: ['transformateurs', 'délais', 'approvisionnement'], partagee: true,
  },
  {
    titre: 'Concertation préalable avec les collectivités pour l\'emprise des lignes',
    projetNom: 'Électrification rurale Casamance',
    auteurId: 'demo_ing', auteur: 'Cheikh FALL', auteurRole: 'INGENIEUR',
    categorie: 'parties_prenantes', phase: 'etude', type: 'succes', impact: 'moyen',
    contexte: 'Tracé de ligne HTA traversant plusieurs villages et zones agricoles.',
    probleme: 'Risque de blocage des chantiers par les populations sur les emprises.',
    solution: 'Réunions de concertation et accord de compensation signés avant le démarrage des travaux.',
    recommandation: 'Mener la concertation et sécuriser les emprises avant tout démarrage de chantier linéaire.',
    tags: ['emprise', 'concertation', 'social'], partagee: true,
  },
];

export const useLeconsApprisesStore = create<LeconsState>()(
  persist(
    (set, get) => ({
      lecons: [],
      seeded: false,
      add: (l) => {
        const now = new Date().toISOString();
        const id = uid();
        set(s => ({ lecons: [{ ...l, id, utilePar: [], createdAt: now, updatedAt: now }, ...s.lecons] }));
        return id;
      },
      update: (id, patch) => set(s => ({
        lecons: s.lecons.map(l => (l.id === id ? { ...l, ...patch, updatedAt: new Date().toISOString() } : l)),
      })),
      remove: (id) => set(s => ({ lecons: s.lecons.filter(l => l.id !== id) })),
      toggleUtile: (id, userId) => set(s => ({
        lecons: s.lecons.map(l => {
          if (l.id !== id) return l;
          const has = l.utilePar.includes(userId);
          return { ...l, utilePar: has ? l.utilePar.filter(u => u !== userId) : [...l.utilePar, userId] };
        }),
      })),
      seed: () => {
        if (get().seeded || get().lecons.length > 0) { set({ seeded: true }); return; }
        const now = new Date().toISOString();
        set({
          seeded: true,
          lecons: SEED.map(l => ({ ...l, id: uid(), utilePar: [], createdAt: now, updatedAt: now })),
        });
      },
    }),
    { name: 'sigepp-lecons-apprises' },
  ),
);

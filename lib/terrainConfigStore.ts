/**
 * terrainConfigStore.ts — Configuration CONFIGURABLE des canevas de saisie terrain.
 * -----------------------------------------------------------------------------
 * Rend ENTIÈREMENT personnalisables, sans recompiler :
 *   • la STRUCTURE DES PHASES d'un projet (libellés + pondérations) par TYPE+DOMAINE ;
 *   • les INDICATEURS PHYSIQUES du formulaire terrain (ajout / suppression / édition) ;
 *   • des SURCHARGES PAR PROJET (un projet peut avoir son propre canevas).
 *
 * Sources de départ : terrainTemplates (matrices réelles DPD/DPT). L'admin/CP peut
 * ensuite éditer librement ; les valeurs personnalisées sont persistées localStorage.
 *
 * Aucun import d'authStore/projectStore au-delà du type Domaine → pas de cycle.
 */

import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { Domaine } from './projectStore';
import {
  TERRAIN_TEMPLATES,
  DEFAULT_PHASE_WEIGHTS,
  resolveTemplate,
  type PhaseDef,
  type PhaseKey,
  type IndicateurPhysique,
  type IndicateurUnite,
} from './terrainTemplates';

export type { PhaseDef, PhaseKey, IndicateurPhysique, IndicateurUnite };

// ─────────────────────────────────────────────────────────────────────────────
// MODÈLES ÉDITABLES (mutables, persistés)
// ─────────────────────────────────────────────────────────────────────────────

export interface EditableTemplate {
  type: string;
  label: string;
  domaine: Domaine;
  phases: PhaseDef[];
  indicateurs: IndicateurPhysique[];
}

/** Surcharge propre à UN projet (clé = code projet). */
export interface ProjectTerrainOverride {
  /** force un type de modèle (sinon auto-détection par mots-clés). */
  templateType?: string;
  /** phases personnalisées pour ce projet (sinon celles du modèle). */
  phases?: PhaseDef[];
  /** indicateurs personnalisés pour ce projet (sinon ceux du modèle). */
  indicateurs?: IndicateurPhysique[];
}

const cloneTemplate = (t: { type: string; label: string; domaine: Domaine; phases: PhaseDef[]; indicateurs: IndicateurPhysique[] }): EditableTemplate => ({
  type: t.type,
  label: t.label,
  domaine: t.domaine,
  phases: t.phases.map(p => ({ ...p })),
  indicateurs: t.indicateurs.map(i => ({ ...i })),
});

const seedTemplates = (): Record<string, EditableTemplate> =>
  Object.fromEntries(TERRAIN_TEMPLATES.map(t => [t.type, cloneTemplate(t)]));

const slug = (s: string) =>
  (s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '').slice(0, 40) || `ind_${Date.now()}`;

// ─────────────────────────────────────────────────────────────────────────────
// STORE
// ─────────────────────────────────────────────────────────────────────────────

interface TerrainConfigState {
  templates: Record<string, EditableTemplate>;
  projectOverrides: Record<string, ProjectTerrainOverride>;

  // ── Édition des modèles (admin) ──
  upsertTemplate: (tpl: EditableTemplate) => void;
  removeTemplate: (type: string) => void;
  setTemplatePhases: (type: string, phases: PhaseDef[]) => void;
  setTemplateIndicateurs: (type: string, indicateurs: IndicateurPhysique[]) => void;
  addIndicateur: (type: string, label: string, unite: IndicateurUnite, phase: PhaseKey) => void;
  removeIndicateur: (type: string, key: string) => void;
  setPhaseWeight: (type: string, phaseKey: PhaseKey, poids: number) => void;
  resetTemplates: () => void;

  // ── Surcharges par projet ──
  setProjectOverride: (code: string, patch: ProjectTerrainOverride) => void;
  clearProjectOverride: (code: string) => void;

  // ── Résolution effective ──
  /** Modèle effectif pour un projet : surcharge projet → modèle type → auto-détection. */
  resolveFor: (code: string, domaine: Domaine, libelle?: string, description?: string) => EditableTemplate;
  /** Liste des modèles (triés par domaine puis label). */
  listTemplates: () => EditableTemplate[];
}

export const useTerrainConfigStore = create<TerrainConfigState>()(
  persist(
    (set, get) => ({
      templates: seedTemplates(),
      projectOverrides: {},

      upsertTemplate: (tpl) =>
        set(s => ({ templates: { ...s.templates, [tpl.type]: cloneTemplate(tpl) } })),

      removeTemplate: (type) =>
        set(s => {
          const next = { ...s.templates };
          delete next[type];
          return { templates: next };
        }),

      setTemplatePhases: (type, phases) =>
        set(s => {
          const t = s.templates[type];
          if (!t) return s;
          return { templates: { ...s.templates, [type]: { ...t, phases: phases.map(p => ({ ...p })) } } };
        }),

      setTemplateIndicateurs: (type, indicateurs) =>
        set(s => {
          const t = s.templates[type];
          if (!t) return s;
          return { templates: { ...s.templates, [type]: { ...t, indicateurs: indicateurs.map(i => ({ ...i })) } } };
        }),

      addIndicateur: (type, label, unite, phase) =>
        set(s => {
          const t = s.templates[type];
          if (!t) return s;
          let key = slug(label);
          // garantir l'unicité de la clé
          const existing = new Set(t.indicateurs.map(i => i.key));
          while (existing.has(key)) key = `${key}_${Math.floor(Math.random() * 1000)}`;
          const ind: IndicateurPhysique = { key, label: label.trim() || 'Nouvel indicateur', unite, phase };
          return { templates: { ...s.templates, [type]: { ...t, indicateurs: [...t.indicateurs, ind] } } };
        }),

      removeIndicateur: (type, key) =>
        set(s => {
          const t = s.templates[type];
          if (!t) return s;
          return { templates: { ...s.templates, [type]: { ...t, indicateurs: t.indicateurs.filter(i => i.key !== key) } } };
        }),

      setPhaseWeight: (type, phaseKey, poids) =>
        set(s => {
          const t = s.templates[type];
          if (!t) return s;
          const phases = t.phases.map(p => p.key === phaseKey ? { ...p, poids: Math.max(0, Math.min(100, poids)) } : p);
          return { templates: { ...s.templates, [type]: { ...t, phases } } };
        }),

      resetTemplates: () => set({ templates: seedTemplates(), projectOverrides: {} }),

      setProjectOverride: (code, patch) =>
        set(s => ({
          projectOverrides: {
            ...s.projectOverrides,
            [code]: { ...s.projectOverrides[code], ...patch },
          },
        })),

      clearProjectOverride: (code) =>
        set(s => {
          const next = { ...s.projectOverrides };
          delete next[code];
          return { projectOverrides: next };
        }),

      resolveFor: (code, domaine, libelle = '', description = '') => {
        const st = get();
        const ov = st.projectOverrides[code];
        // 1) déterminer le type de base
        const baseType = ov?.templateType ?? resolveTemplate(domaine, libelle, description).type;
        const base = st.templates[baseType]
          ?? Object.values(st.templates).find(t => t.domaine === domaine)
          ?? cloneTemplate(TERRAIN_TEMPLATES[0]);
        // 2) appliquer les surcharges projet (phases / indicateurs)
        return {
          type: base.type,
          label: base.label,
          domaine: base.domaine,
          phases: (ov?.phases && ov.phases.length ? ov.phases : base.phases).map(p => ({ ...p })),
          indicateurs: (ov?.indicateurs && ov.indicateurs.length ? ov.indicateurs : base.indicateurs).map(i => ({ ...i })),
        };
      },

      listTemplates: () =>
        Object.values(get().templates).sort((a, b) =>
          a.domaine === b.domaine ? a.label.localeCompare(b.label) : a.domaine.localeCompare(b.domaine)),
    }),
    { name: 'sigepp-terrain-config' }
  )
);

/** Pondération par défaut exportée pour réinitialisation d'une structure de phases. */
export { DEFAULT_PHASE_WEIGHTS };

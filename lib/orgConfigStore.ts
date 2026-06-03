/**
 * orgConfigStore.ts — Configuration organisationnelle dynamique DPE
 * Directions, départements, postes, rôles, unités modifiables sans recompilation
 * Persisté dans localStorage avec fallback sur les valeurs par défaut
 */

import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export interface OrgDirection {
  code: string;
  label: string;
  shortLabel: string;
  effectif: number;
  parentCode?: string; // pour sous-directions
  color?: string;
  active: boolean;
}

export interface OrgDepartement {
  code: string;
  label: string;
  directionCode: string;
  active: boolean;
}

export interface OrgPoste {
  code: string;
  label: string;
  roleCode: string; // quel rôle SIGEPP ce poste mappe
  niveau: number; // 0=DPE, 1=Direction, 2=Département, 3=Agent
  keywords: string[]; // mots-clés pour matching
  active: boolean;
}

export interface OrgRoleConfig {
  code: string;
  label: string;
  description: string;
  color: string;
  icon: string;
  sections: string[];
  routes: string[];
  active: boolean;
}

export interface OrgAgent {
  id: string;
  matricule: string;
  nom: string;
  prenom: string;
  email?: string;
  telephone?: string;
  poste: string;
  fonction: string;
  directionCode: string;
  departementCode?: string;
  roleCode: string;
  initials: string;
  avatarColor: string;
  active: boolean;
}

export interface OrgConfig {
  directions: OrgDirection[];
  departements: OrgDepartement[];
  postes: OrgPoste[];
  roles: OrgRoleConfig[];
  agents: OrgAgent[];
  lastModified: string;
  modifiedBy: string;
}

// ─── Valeurs par défaut (miroir de l'org actuelle) ────────────────────────

const DEFAULT_DIRECTIONS: OrgDirection[] = [
  { code: 'EM_DPE', label: 'État-Major — Direction Principale Équipement', shortLabel: 'EM DPE', effectif: 11, active: true },
  { code: 'DER', label: 'Direction Équipement Réseaux', shortLabel: 'DER', effectif: 64, active: true },
  { code: 'DPT', label: 'Direction Projets Transport', shortLabel: 'DPT', effectif: 28, active: true },
  { code: 'DGC', label: 'Direction Génie Civil', shortLabel: 'DGC', effectif: 38, active: true },
  { code: 'CPBM_UE', label: 'Coordination Programmes BM-UE (BEST/PADAES)', shortLabel: 'CPBM-UE', effectif: 22, active: true },
  { code: 'DEP', label: 'Direction Équipement Production', shortLabel: 'DEP', effectif: 17, active: true },
  { code: 'DIT', label: 'Direction Innovation Technologique', shortLabel: 'DIT', effectif: 16, active: true },
  { code: 'CC26', label: 'Coordination Compact 2026 (MCA)', shortLabel: 'CC26', effectif: 15, active: true },
  { code: 'CPAMACEL_EE', label: 'Coordination PAMACEL & Efficacité Énergétique', shortLabel: 'CPAMACEL&EE', effectif: 11, active: true },
  { code: 'CPADERAU', label: 'Coordination Programme PADERAU (AFD/BEI)', shortLabel: 'CPADERAU', effectif: 5, active: true },
  { code: 'CSE', label: 'Cellule Suivi & Évaluation — DPE', shortLabel: 'CSE', effectif: 2, active: true },
];

const DEFAULT_DEPARTEMENTS: OrgDepartement[] = [
  { code: 'DEP_PER', label: 'Département Équipement Production & Énergie Renouvelable', directionCode: 'DEP', active: true },
  { code: 'DER_RES', label: 'Département Réseaux THT/HTA/BT', directionCode: 'DER', active: true },
  { code: 'DGC_CTC', label: 'Département Contrôle Technique & Construction', directionCode: 'DGC', active: true },
  { code: 'DPT_TRA', label: 'Département Transport & Postes', directionCode: 'DPT', active: true },
  { code: 'DIT_INN', label: 'Département Innovation & Systèmes', directionCode: 'DIT', active: true },
];

const DEFAULT_POSTES: OrgPoste[] = [
  { code: 'DIR_DPE', label: 'Directeur Principal Équipement', roleCode: 'DIR_DPE', niveau: 0, keywords: ['directeur principal','directeur genie civil','directeur innovation'], active: true },
  { code: 'PMO_PRG', label: 'Coordonnateur des Programmes', roleCode: 'PMO', niveau: 1, keywords: ['coordonnateur','chef de cellule','responsable suivi'], active: true },
  { code: 'CHEF_DPT', label: 'Chef de Département', roleCode: 'CHEF_DEPT', niveau: 1, keywords: ['chef departement','chef de service','chef unite'], active: true },
  { code: 'CHEF_PROJ', label: 'Chef de Projet', roleCode: 'CHEF_PROJ', niveau: 2, keywords: ['chef de projet'], active: true },
  { code: 'CTRL', label: 'Contrôleur de Projet', roleCode: 'CONTROLEUR', niveau: 2, keywords: ['controleur','assistant chef de projet'], active: true },
  { code: 'EXPERT', label: 'Expert Technique', roleCode: 'EXPERT', niveau: 2, keywords: ['expert','conseiller technique'], active: true },
  { code: 'ING', label: 'Ingénieur', roleCode: 'INGENIEUR', niveau: 2, keywords: ['ingenieur','dessinateur','cartographe','geomaticien'], active: true },
  { code: 'CHARGE', label: 'Chargé de Mission', roleCode: 'CHARGE', niveau: 2, keywords: ['charge'], active: true },
  { code: 'ASSIST', label: 'Assistant de Direction', roleCode: 'ASSISTANT', niveau: 3, keywords: ['assistant','aide archiviste'], active: true },
  { code: 'SECR', label: 'Secrétaire', roleCode: 'SECRETAIRE', niveau: 3, keywords: ['secretaire'], active: true },
  { code: 'CHAUF', label: 'Chauffeur', roleCode: 'CHAUFFEUR', niveau: 3, keywords: ['chauffeur'], active: true },
  { code: 'CTRL_FIN', label: 'Contrôleur Financier', roleCode: 'CTRL_FIN', niveau: 1, keywords: ['comptable','responsable audit'], active: true },
  { code: 'RESP_LOG', label: 'Responsable Logistique / UAGL', roleCode: 'RESP_LOG', niveau: 2, keywords: ['responsable administratif','responsable passation','chef uagl'], active: true },
];

const DEFAULT_ROLES: OrgRoleConfig[] = [
  { code: 'DIR_DPE', label: 'Directeur DPE', description: 'Vision exécutive — portefeuille stratégique, KPIs, arbitrages', color: '#3D1A6B', icon: '👔', sections: ['accueil','portefeuille','planning','execution','terrain','finances','rh','logistique','transverses','parametrage'], routes: ['*'], active: true },
  { code: 'PMO', label: 'PMO / Chef Programmes', description: 'Pilotage portefeuille multi-projets, EVM, reporting', color: '#7C3AED', icon: '📊', sections: ['accueil','portefeuille','planning','execution','terrain','finances','transverses'], routes: ['/tableau-de-bord','/projets','/portefeuille','/gantt','/suivi-evaluation','/terrain','/evm','/budget','/marches','/reporting','/agents-ia','/ged','/workflows'], active: true },
  { code: 'CHEF_PROJ', label: 'Chef de Projet', description: 'Gestion opérationnelle de ses projets', color: '#1D4ED8', icon: '🧑‍💼', sections: ['accueil','mes_projets','execution','finances','transverses'], routes: ['/tableau-de-bord','/projets','/cockpit-projet','/gantt','/suivi-evaluation','/terrain','/risques','/cartographie','/ged','/workflows'], active: true },
  { code: 'CHEF_DEPT', label: 'Chef de Département', description: 'Projets et indicateurs de son unité', color: '#0F766E', icon: '🏢', sections: ['accueil','portefeuille','planning','execution','terrain','finances','rh','transverses'], routes: ['/tableau-de-bord','/projets','/portefeuille','/programmes','/gantt','/suivi-evaluation','/terrain','/evm','/budget','/marches','/rh','/reporting','/ged','/workflows'], active: true },
  { code: 'INGENIEUR', label: 'Ingénieur / Études', description: 'Conception technique, études', color: '#2563EB', icon: '⚙️', sections: ['accueil','mes_projets','execution','transverses'], routes: ['/tableau-de-bord','/projets','/cockpit-projet','/suivi-evaluation','/terrain','/ged','/workflows'], active: true },
  { code: 'EXPERT', label: 'Expert Technique', description: 'Expertise sectorielle', color: '#7C3AED', icon: '🔬', sections: ['accueil','portefeuille','mes_projets','execution','transverses'], routes: ['/tableau-de-bord','/projets','/portefeuille','/cockpit-projet','/suivi-evaluation','/terrain','/agents-ia','/ged','/workflows'], active: true },
  { code: 'CONTROLEUR', label: 'Contrôleur', description: 'Contrôle qualité, performance et conformité', color: '#D97706', icon: '🔍', sections: ['accueil','mes_projets','execution','transverses'], routes: ['/tableau-de-bord','/projets','/cockpit-projet','/gantt','/suivi-evaluation','/terrain','/risques','/reporting','/workflows'], active: true },
  { code: 'CHARGE', label: 'Chargé de Mission', description: 'Suivi social, environnemental', color: '#059669', icon: '📋', sections: ['accueil','mes_projets','execution','transverses'], routes: ['/tableau-de-bord','/projets','/cockpit-projet','/terrain','/reporting','/workflows'], active: true },
  { code: 'ASSISTANT', label: 'Assistant de Direction', description: 'Support administratif', color: '#4B5563', icon: '📝', sections: ['accueil','mes_projets','transverses'], routes: ['/tableau-de-bord','/projets','/taches','/suivi-evaluation','/ged','/reporting','/workflows'], active: true },
  { code: 'SECRETAIRE', label: 'Secrétaire', description: 'Secrétariat, archivage', color: '#8B5CF6', icon: '📁', sections: ['accueil','transverses'], routes: ['/tableau-de-bord','/ged','/workflows'], active: true },
  { code: 'CHAUFFEUR', label: 'Chauffeur / UAGL', description: 'Conduite, logistique', color: '#0891B2', icon: '🚗', sections: ['accueil','logistique','transverses'], routes: ['/tableau-de-bord','/flotte','/courriers','/workflows'], active: true },
  { code: 'CTRL_FIN', label: 'Contrôleur Financier', description: 'Budget, marchés, bordereaux', color: '#B45309', icon: '💰', sections: ['accueil','finances','transverses'], routes: ['/tableau-de-bord','/budget','/marches','/bordereaux','/receptions','/reporting','/workflows'], active: true },
  { code: 'RESP_LOG', label: 'Resp. UAGL / Logistique', description: 'Ordres de mission, flotte', color: '#0891B2', icon: '🚗', sections: ['accueil','logistique','transverses'], routes: ['/tableau-de-bord','/flotte','/courriers','/odm','/workflows'], active: true },
  { code: 'ADMIN', label: 'Administrateur Système', description: 'Accès complet', color: '#374151', icon: '🔧', sections: ['*'], routes: ['*'], active: true },
];

const DEFAULT_AGENTS: OrgAgent[] = [];

const DEFAULT_CONFIG: OrgConfig = {
  directions: DEFAULT_DIRECTIONS,
  departements: DEFAULT_DEPARTEMENTS,
  postes: DEFAULT_POSTES,
  roles: DEFAULT_ROLES,
  agents: DEFAULT_AGENTS,
  lastModified: new Date().toISOString(),
  modifiedBy: 'system',
};

// ─── Zustand Store ────────────────────────────────────────────────────────

interface OrgConfigState extends OrgConfig {
  // Directions
  addDirection: (d: Omit<OrgDirection, 'code'> & { code: string }) => void;
  updateDirection: (code: string, updates: Partial<OrgDirection>) => void;
  removeDirection: (code: string) => void;
  // Départements
  addDepartement: (d: Omit<OrgDepartement, 'code'> & { code: string }) => void;
  updateDepartement: (code: string, updates: Partial<OrgDepartement>) => void;
  removeDepartement: (code: string) => void;
  // Postes
  addPoste: (p: Omit<OrgPoste, 'code'> & { code: string }) => void;
  updatePoste: (code: string, updates: Partial<OrgPoste>) => void;
  removePoste: (code: string) => void;
  // Rôles
  addRole: (r: Omit<OrgRoleConfig, 'code'> & { code: string }) => void;
  updateRole: (code: string, updates: Partial<OrgRoleConfig>) => void;
  removeRole: (code: string) => void;
  // Agents
  addAgent: (a: Omit<OrgAgent, 'id'> & { id: string }) => void;
  updateAgent: (id: string, updates: Partial<OrgAgent>) => void;
  removeAgent: (id: string) => void;
  // Utils
  getActiveDirections: () => OrgDirection[];
  getActiveDepartements: () => OrgDepartement[];
  getActivePostes: () => OrgPoste[];
  getActiveRoles: () => OrgRoleConfig[];
  getActiveAgents: () => OrgAgent[];
  getDirectionByCode: (code: string) => OrgDirection | undefined;
  getDepartementsByDirection: (dirCode: string) => OrgDepartement[];
  getRoleByCode: (code: string) => OrgRoleConfig | undefined;
  getPosteForRole: (roleCode: string) => OrgPoste | undefined;
  resetToDefaults: () => void;
  exportConfig: () => string;
  importConfig: (json: string) => void;
}

export const useOrgConfig = create<OrgConfigState>()(
  persist(
    (set, get) => ({
      ...DEFAULT_CONFIG,

      // Directions
      addDirection: (d) => set(state => {
        if (state.directions.find(x => x.code === d.code)) return state;
        return {
          directions: [...state.directions, { ...d, active: true }],
          lastModified: new Date().toISOString(),
        };
      }),
      updateDirection: (code, updates) => set(state => ({
        directions: state.directions.map(x => x.code === code ? { ...x, ...updates } : x),
        lastModified: new Date().toISOString(),
      })),
      removeDirection: (code) => set(state => ({
        directions: state.directions.filter(x => x.code !== code),
        lastModified: new Date().toISOString(),
      })),

      // Départements
      addDepartement: (d) => set(state => {
        if (state.departements.find(x => x.code === d.code)) return state;
        return {
          departements: [...state.departements, { ...d, active: true }],
          lastModified: new Date().toISOString(),
        };
      }),
      updateDepartement: (code, updates) => set(state => ({
        departements: state.departements.map(x => x.code === code ? { ...x, ...updates } : x),
        lastModified: new Date().toISOString(),
      })),
      removeDepartement: (code) => set(state => ({
        departements: state.departements.filter(x => x.code !== code),
        lastModified: new Date().toISOString(),
      })),

      // Postes
      addPoste: (p) => set(state => {
        if (state.postes.find(x => x.code === p.code)) return state;
        return {
          postes: [...state.postes, { ...p, active: true }],
          lastModified: new Date().toISOString(),
        };
      }),
      updatePoste: (code, updates) => set(state => ({
        postes: state.postes.map(x => x.code === code ? { ...x, ...updates } : x),
        lastModified: new Date().toISOString(),
      })),
      removePoste: (code) => set(state => ({
        postes: state.postes.filter(x => x.code !== code),
        lastModified: new Date().toISOString(),
      })),

      // Rôles
      addRole: (r) => set(state => {
        if (state.roles.find(x => x.code === r.code)) return state;
        return {
          roles: [...state.roles, { ...r, active: true }],
          lastModified: new Date().toISOString(),
        };
      }),
      updateRole: (code, updates) => set(state => ({
        roles: state.roles.map(x => x.code === code ? { ...x, ...updates } : x),
        lastModified: new Date().toISOString(),
      })),
      removeRole: (code) => set(state => ({
        roles: state.roles.filter(x => x.code !== code),
        lastModified: new Date().toISOString(),
      })),

      // Agents
      addAgent: (a) => set(state => {
        if (state.agents.find(x => x.id === a.id)) return state;
        return {
          agents: [...state.agents, { ...a, active: true }],
          lastModified: new Date().toISOString(),
        };
      }),
      updateAgent: (id, updates) => set(state => ({
        agents: state.agents.map(x => x.id === id ? { ...x, ...updates } : x),
        lastModified: new Date().toISOString(),
      })),
      removeAgent: (id) => set(state => ({
        agents: state.agents.filter(x => x.id !== id),
        lastModified: new Date().toISOString(),
      })),

      // Selectors
      getActiveDirections: () => get().directions.filter(d => d.active),
      getActiveDepartements: () => get().departements.filter(d => d.active),
      getActivePostes: () => get().postes.filter(p => p.active),
      getActiveRoles: () => get().roles.filter(r => r.active),
      getActiveAgents: () => get().agents.filter(a => a.active),
      getDirectionByCode: (code) => get().directions.find(d => d.code === code),
      getDepartementsByDirection: (dirCode) => get().departements.filter(d => d.directionCode === dirCode && d.active),
      getRoleByCode: (code) => get().roles.find(r => r.code === code),
      getPosteForRole: (roleCode) => get().postes.find(p => p.roleCode === roleCode && p.active),

      resetToDefaults: () => set({ ...DEFAULT_CONFIG, lastModified: new Date().toISOString() }),

      exportConfig: () => {
        const { directions, departements, postes, roles, agents, lastModified } = get();
        return JSON.stringify({ directions, departements, postes, roles, agents, lastModified }, null, 2);
      },

      importConfig: (json) => {
        try {
          const data = JSON.parse(json);
          set({
            directions: data.directions ?? DEFAULT_DIRECTIONS,
            departements: data.departements ?? DEFAULT_DEPARTEMENTS,
            postes: data.postes ?? DEFAULT_POSTES,
            roles: data.roles ?? DEFAULT_ROLES,
            agents: data.agents ?? DEFAULT_AGENTS,
            lastModified: new Date().toISOString(),
            modifiedBy: 'import',
          });
        } catch {
          throw new Error('JSON invalide');
        }
      },
    }),
    {
      name: 'sigepp-org-config',
      partialize: (state) => ({
        directions: state.directions,
        departements: state.departements,
        postes: state.postes,
        roles: state.roles,
        agents: state.agents,
        lastModified: state.lastModified,
        modifiedBy: state.modifiedBy,
      }),
    }
  )
);

// ─── Helpers compatibilité avec le code existant ───────────────────────────

/** Génère un DIRECTION_LABELS dynamique à partir de la config */
export function getDynamicDirectionLabels(): Record<string, string> {
  const state = useOrgConfig.getState();
  const labels: Record<string, string> = {};
  state.directions.forEach(d => {
    labels[d.code] = d.label;
    labels[d.shortLabel] = d.label;
  });
  return labels;
}

/** Génère ROLES dynamique à partir de la config */
export function getDynamicRoles() {
  const state = useOrgConfig.getState();
  const roles: Record<string, any> = {};
  state.roles.forEach(r => {
    if (r.active) {
      roles[r.code] = {
        code: r.code,
        label: r.label,
        description: r.description,
        color: r.color,
        icon: r.icon,
      };
    }
  });
  return roles;
}

/** Génère la map des postes → rôle dynamique */
export function getDynamicPosteMapping(): { keywords: string[]; roleCode: string; niveau: number }[] {
  const state = useOrgConfig.getState();
  return state.postes
    .filter(p => p.active)
    .map(p => ({ keywords: p.keywords, roleCode: p.roleCode, niveau: p.niveau }));
}

/** Labels pour le sidebar */
export function getDirectionLabelDynamic(code: string): string {
  const d = useOrgConfig.getState().directions.find(x => x.code === code || x.shortLabel === code);
  return d?.label ?? code;
}

export function getDepartementLabelDynamic(code: string): string {
  const d = useOrgConfig.getState().departements.find(x => x.code === code);
  return d?.label ?? code;
}

export function getRoleLabelDynamic(code: string): string {
  const r = useOrgConfig.getState().roles.find(x => x.code === code);
  return r?.label ?? code;
}

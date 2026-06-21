/**
 * unModel.ts — Modèle de données ArcGIS Utility Network (UN v7) pour SENELEC
 * Source : ATOS GIS Data Model Design Specification (Schneider Electric, 15 mars 2026)
 *
 * Architecture retenue :
 *   • 1 Domaine Électrique (partitionné) : HTB + HTA + BT
 *   • 1 Domaine Structure (commun à tous les domaines UN)
 *   • Déploiement : ArcGIS Enterprise 11.5 + ArcGIS Pro 3.5 (domaine Senelec interne)
 *   • Pas de connexion Google — tuiles OSM en dev, portail Senelec en prod
 */

// ─── Types de base ─────────────────────────────────────────────────────────

export type UNDomain       = 'ELECTRIC' | 'STRUCTURE';
export type UNTier         = 'HTB' | 'HTA' | 'BT';
export type UNFeatureClass = 'Device' | 'Line' | 'Junction' | 'Assembly' | 'SubnetLine' | 'JunctionObject' | 'EdgeObject';
export type UNTopology     = 'Radial' | 'Mesh';
export type UNGeomType     = 'point' | 'polyline' | 'polygon' | 'none';

// ─── Tiers (Niveaux) ────────────────────────────────────────────────────────

export interface TierDef {
  code:         UNTier;
  label:        string;
  voltageRange: string;
  rank:         number; // 1 = plus haut niveau
  topologyType: UNTopology;
  color:        string;
  bgColor:      string;
}

export const UN_TIERS: TierDef[] = [
  { code: 'HTB', label: 'Haute Tension B (Transport)',     voltageRange: '≥ 90 kV (225 kV & 90 kV)', rank: 1, topologyType: 'Radial', color: '#ef4444', bgColor: '#fef2f2' },
  { code: 'HTA', label: 'Haute Tension A (Distribution)',  voltageRange: '< 30 kV — > 400 V',          rank: 2, topologyType: 'Radial', color: '#f97316', bgColor: '#fff7ed' },
  { code: 'BT',  label: 'Basse Tension',                   voltageRange: '≤ 400 V / 220 V',             rank: 3, topologyType: 'Radial', color: '#22c55e', bgColor: '#f0fdf4' },
];

// ─── Définitions de couches UN ──────────────────────────────────────────────

export interface UNLayerDef {
  id:           number;   // layerId ArcGIS FeatureServer
  name:         string;
  domain:       UNDomain;
  tier:         UNTier | null;
  featureClass: UNFeatureClass;
  geometryType: UNGeomType;
  color:        string;
  dashArray?:   string;   // SVG stroke-dasharray pour les câbles souterrains
  defaultOn:    boolean;
}

export const UN_LAYERS: UNLayerDef[] = [
  // ── Domaine Électrique — Lines ──────────────────────────────────────────
  { id: 0,  name: 'Lignes HTB',              domain: 'ELECTRIC',   tier: 'HTB', featureClass: 'Line',     geometryType: 'polyline', color: '#ef4444', defaultOn: true  },
  { id: 1,  name: 'Lignes HTA OH',           domain: 'ELECTRIC',   tier: 'HTA', featureClass: 'Line',     geometryType: 'polyline', color: '#f97316', defaultOn: true  },
  { id: 2,  name: 'Lignes HTA UG',           domain: 'ELECTRIC',   tier: 'HTA', featureClass: 'Line',     geometryType: 'polyline', color: '#f97316', dashArray: '6,3', defaultOn: true  },
  { id: 3,  name: 'Lignes BT OH',            domain: 'ELECTRIC',   tier: 'BT',  featureClass: 'Line',     geometryType: 'polyline', color: '#22c55e', defaultOn: false },
  { id: 4,  name: 'Lignes BT UG',            domain: 'ELECTRIC',   tier: 'BT',  featureClass: 'Line',     geometryType: 'polyline', color: '#22c55e', dashArray: '3,2', defaultOn: false },
  { id: 5,  name: 'Barres omnibus',           domain: 'ELECTRIC',   tier: null,  featureClass: 'Line',     geometryType: 'polyline', color: '#a855f7', defaultOn: false },
  // ── Domaine Électrique — Devices ───────────────────────────────────────
  { id: 6,  name: 'Disj. source (ctrl SR)',   domain: 'ELECTRIC',   tier: null,  featureClass: 'Device',   geometryType: 'point',    color: '#ef4444', defaultOn: true  },
  { id: 7,  name: 'Transformateurs',          domain: 'ELECTRIC',   tier: null,  featureClass: 'Device',   geometryType: 'point',    color: '#eab308', defaultOn: true  },
  { id: 8,  name: 'Sectionneurs',             domain: 'ELECTRIC',   tier: null,  featureClass: 'Device',   geometryType: 'point',    color: '#3b82f6', defaultOn: false },
  { id: 9,  name: 'Interrupteurs (IACM/IAT)', domain: 'ELECTRIC',   tier: 'HTA', featureClass: 'Device',   geometryType: 'point',    color: '#06b6d4', defaultOn: false },
  { id: 10, name: 'Parafoudres',              domain: 'ELECTRIC',   tier: null,  featureClass: 'Device',   geometryType: 'point',    color: '#8b5cf6', defaultOn: false },
  { id: 11, name: 'Fusibles',                 domain: 'ELECTRIC',   tier: null,  featureClass: 'Device',   geometryType: 'point',    color: '#ec4899', defaultOn: false },
  { id: 12, name: 'Lampadaires / EP',         domain: 'ELECTRIC',   tier: 'BT',  featureClass: 'Device',   geometryType: 'point',    color: '#facc15', defaultOn: false },
  { id: 13, name: 'Production (PV/Diesel)',   domain: 'ELECTRIC',   tier: null,  featureClass: 'Device',   geometryType: 'point',    color: '#10b981', defaultOn: false },
  { id: 14, name: 'Compteurs (smart meters)', domain: 'ELECTRIC',   tier: 'BT',  featureClass: 'JunctionObject', geometryType: 'point', color: '#94a3b8', defaultOn: false },
  // ── Domaine Électrique — Assemblies ────────────────────────────────────
  { id: 15, name: 'RMU (Ring Main Unit)',     domain: 'ELECTRIC',   tier: 'HTA', featureClass: 'Assembly', geometryType: 'point',    color: '#f97316', defaultOn: true  },
  { id: 16, name: 'Coffrets BT (LV Board)',   domain: 'ELECTRIC',   tier: 'BT',  featureClass: 'Assembly', geometryType: 'point',    color: '#22c55e', defaultOn: true  },
  { id: 17, name: 'Postes HTA/BT',           domain: 'ELECTRIC',   tier: null,  featureClass: 'Assembly', geometryType: 'point',    color: '#eab308', defaultOn: true  },
  // ── Domaine Électrique — Junctions ─────────────────────────────────────
  { id: 18, name: 'Jonctions électriques',    domain: 'ELECTRIC',   tier: null,  featureClass: 'Junction', geometryType: 'point',    color: '#64748b', defaultOn: false },
  // ── Domaine Structure ──────────────────────────────────────────────────
  { id: 19, name: 'Poteaux',                  domain: 'STRUCTURE',  tier: null,  featureClass: 'Junction', geometryType: 'point',    color: '#92400e', defaultOn: false },
  { id: 20, name: 'Pylônes HTB',              domain: 'STRUCTURE',  tier: null,  featureClass: 'Junction', geometryType: 'point',    color: '#78350f', defaultOn: false },
  { id: 21, name: 'Regards (manholes)',        domain: 'STRUCTURE',  tier: null,  featureClass: 'Junction', geometryType: 'point',    color: '#4b5563', defaultOn: false },
  { id: 22, name: 'Conduites (conduits)',      domain: 'STRUCTURE',  tier: null,  featureClass: 'Line',     geometryType: 'polyline', color: '#78716c', dashArray: '2,4', defaultOn: false },
  { id: 23, name: 'Limites sous-stations',    domain: 'STRUCTURE',  tier: null,  featureClass: 'Line',     geometryType: 'polygon',  color: '#7c3aed', defaultOn: true  },
];

// ─── Groupes et types d'actifs (Asset Groups / Asset Types) ─────────────────

export interface AssetGroupDef {
  group:        string;
  label:        string;
  featureClass: UNFeatureClass;
  tier:         UNTier[];
  types:        string[];
}

export const ELECTRIC_ASSET_GROUPS: AssetGroupDef[] = [
  {
    group: 'DynamicSwitch', label: 'Disjoncteur (coupure dynamique)', featureClass: 'Device',
    tier: ['HTB', 'HTA', 'BT'],
    types: ['Disjoncteur GIS', 'Disjoncteur AIS', 'Disjoncteur BT', 'Disjoncteur pied de poteau', 'Disjoncteur source HTB', 'Disjoncteur source HTA'],
  },
  {
    group: 'Transformer', label: 'Transformateur', featureClass: 'Device',
    tier: ['HTB', 'HTA'],
    types: ['Transformateur HT/BT', 'Transformateur de puissance 225/90kV', 'Transformateur de puissance 90/30kV', 'Transformateur 3 enroulements (provisoire)'],
  },
  {
    group: 'Switch', label: 'Sectionneur', featureClass: 'Device',
    tier: ['HTB', 'HTA'],
    types: ['Sectionneur AIS tripolaire', 'Sectionneur AIS couplage', 'Sectionneur GIS tripolaire Malt', 'Sectionneur GIS Depart', 'Interrupteur aérien IACM', 'Interrupteur aérien télécommandé IAT', 'Interrupteur BT', 'Interrupteur-sectionneur 3 positions'],
  },
  {
    group: 'Recloser', label: 'Réenclencheur', featureClass: 'Device',
    tier: ['HTA'],
    types: ['Réenclencheur aérien', 'Réenclencheur souterrain'],
  },
  {
    group: 'Fuse', label: 'Fusible', featureClass: 'Device',
    tier: ['HTA', 'BT'],
    types: ['Fusible HTA', 'Fusible BT'],
  },
  {
    group: 'SurgeArrester', label: 'Parafoudre / Protection', featureClass: 'Device',
    tier: ['HTB', 'HTA'],
    types: ['Parafoudre', 'Éclateur', 'Paratonnerre'],
  },
  {
    group: 'FaultIndicator', label: 'Indicateur de défaut', featureClass: 'Device',
    tier: ['HTA'],
    types: ['Indicateur de défaut aérien', 'Indicateur de défaut souterrain'],
  },
  {
    group: 'Generation', label: 'Production', featureClass: 'Device',
    tier: ['HTB', 'HTA', 'BT'],
    types: ['Énergie solaire PV', 'Énergie éolienne', 'Générateur diesel', 'Énergie solaire thermique'],
  },
  {
    group: 'PFCorrection', label: 'Correction facteur de puissance', featureClass: 'Device',
    tier: ['HTA'],
    types: ['Condensateur fixe', 'Condensateur commuté', 'Condensateur série', 'Réacteur'],
  },
  {
    group: 'MeasurementTransformer', label: 'Transformateur de mesure', featureClass: 'Device',
    tier: ['HTB', 'HTA'],
    types: ['Transformateur de courant (TC)', 'Transformateur de tension (TT)'],
  },
  {
    group: 'VoltageRegulator', label: 'Régulateur de tension', featureClass: 'Device',
    tier: ['HTA'],
    types: ['Régulateur triphasé (autotransformateur)'],
  },
  {
    group: 'EVCharger', label: 'Borne de recharge VE', featureClass: 'Device',
    tier: ['BT'],
    types: ['Chargeur rapide', 'Chargeur public moyen', 'Boîtier mural moyen'],
  },
  {
    group: 'StreetLight', label: 'Éclairage public (EP)', featureClass: 'Device',
    tier: ['BT'],
    types: ['Lampadaire BT monophasé', 'Lampadaire BT triphasé'],
  },
  {
    group: 'RMU', label: 'RMU (Ring Main Unit)', featureClass: 'Assembly',
    tier: ['HTA'],
    types: ['RMU 3 départs', 'RMU 4 départs', 'RMU 6 départs'],
  },
  {
    group: 'LVBoard', label: 'Coffret BT (LV Board)', featureClass: 'Assembly',
    tier: ['BT'],
    types: ['Coffret distribution BT', 'Armoire éclairage public', 'Grille de distribution'],
  },
  {
    group: 'Meter', label: 'Compteur (JunctionObject)', featureClass: 'JunctionObject',
    tier: ['BT'],
    types: ['Compteur électronique monophasé', 'Compteur électronique triphasé', 'Concentrateur AMI'],
  },
  {
    group: 'Busbar', label: 'Barre omnibus (Line)', featureClass: 'Line',
    tier: ['HTB', 'HTA'],
    types: ['Jeu de barres HTB', 'Jeu de barres HTA'],
  },
  {
    group: 'UndergroundCable', label: 'Câble souterrain (UG)', featureClass: 'Line',
    tier: ['HTB', 'HTA', 'BT'],
    types: ['Câble HTA UG', 'Câble HTB UG', 'Câble BT UG', 'Câble sous-marin', 'Câble éclairage urbain monophasé', 'Câble éclairage urbain triphasé'],
  },
  {
    group: 'OverheadLine', label: 'Ligne aérienne (OH)', featureClass: 'Line',
    tier: ['HTB', 'HTA', 'BT'],
    types: ['Ligne aérienne HTB 225kV', 'Ligne aérienne HTB 90kV', 'Ligne aérienne HTA 30kV', 'Ligne aérienne BT OH'],
  },
];

// ─── Règles de connectivité simplifiées ─────────────────────────────────────

export interface ConnectivityRuleDef {
  id:          string;
  description: string;
  fromClass:   UNFeatureClass;
  toClass:     UNFeatureClass;
  type:        'junction-edge' | 'junction-junction' | 'edge-junction-edge' | 'containment' | 'structural-attachment';
  tier:        UNTier | UNTier[] | 'all';
}

export const CONNECTIVITY_RULES: ConnectivityRuleDef[] = [
  { id: 'cr01', type: 'junction-edge',         tier: 'all', fromClass: 'Device',   toClass: 'Line',     description: 'Extrémité câble → Appareil (disj., transfo., sectionneur…)' },
  { id: 'cr02', type: 'junction-junction',      tier: 'all', fromClass: 'Device',   toClass: 'Junction', description: 'Connectivité terminaux non-coïncidents (association de connectivité)' },
  { id: 'cr03', type: 'edge-junction-edge',     tier: 'all', fromClass: 'Line',     toClass: 'Line',     description: 'Même type ligne → connexion directe sans jonction intermédiaire' },
  { id: 'cr04', type: 'edge-junction-edge',     tier: 'all', fromClass: 'Line',     toClass: 'Junction', description: 'Types différents → jonction électrique intermédiaire obligatoire' },
  { id: 'cr05', type: 'edge-junction-edge',     tier: 'HTA', fromClass: 'Line',     toClass: 'Junction', description: 'HTA UG ↔ HTA OH → jonction de transition HTA' },
  { id: 'cr06', type: 'edge-junction-edge',     tier: 'BT',  fromClass: 'Line',     toClass: 'Junction', description: 'BT UG ↔ BT OH → jonction de transition BT' },
  { id: 'cr07', type: 'containment',            tier: 'HTA', fromClass: 'Assembly', toClass: 'Device',   description: 'RMU contient : sectionneurs, disjoncteurs, fusibles HTA' },
  { id: 'cr08', type: 'containment',            tier: 'BT',  fromClass: 'Assembly', toClass: 'Device',   description: 'Coffret BT contient : barres omnibus + fusibles BT' },
  { id: 'cr09', type: 'containment',            tier: 'all', fromClass: 'Assembly', toClass: 'Line',     description: 'Sous-station boundary contient : Device, Junction, Line, Assembly' },
  { id: 'cr10', type: 'structural-attachment',  tier: 'all', fromClass: 'Junction', toClass: 'Line',     description: 'Poteau → Ligne aérienne (Structure ↔ Électrique — pas de flux)' },
  { id: 'cr11', type: 'structural-attachment',  tier: 'HTB', fromClass: 'Junction', toClass: 'Line',     description: 'Pylône HTB → Ligne aérienne HTB (225kV / 90kV)' },
];

// ─── Checklist pré-migration (GN → UN) ──────────────────────────────────────

export type MigrationCategory = 'feeder' | 'geometry' | 'attributes' | 'topology';

export interface MigrationCheckItem {
  id:          string;
  category:    MigrationCategory;
  description: string;
  mandatory:   boolean;
  detail?:     string;
}

export const MIGRATION_CHECKLIST: MigrationCheckItem[] = [
  { id: 'mc01', category: 'feeder',     mandatory: true,  description: 'Exécuter ArcFM Feeder Manager sur le réseau géométrique source', detail: 'Identifier sections hors tension, alimentations multiples, boucles' },
  { id: 'mc02', category: 'feeder',     mandatory: true,  description: 'FeederID renseigné sur toutes les entités du réseau GN', detail: 'Sans exception — source de vérité pour le feeder membership dans UN' },
  { id: 'mc03', category: 'feeder',     mandatory: true,  description: 'FeederID2 = null sauf points ouverts', detail: 'FeederID2 uniquement sur commutateurs/disjoncteurs en position OUVERTE' },
  { id: 'mc04', category: 'geometry',   mandatory: true,  description: 'Corriger lignes qui se chevauchent et points superposés', detail: 'Outil "Find Connections" ArcMap puis correction d\'accrochage (snapping)' },
  { id: 'mc05', category: 'geometry',   mandatory: true,  description: 'Corriger lignes qui se croisent sans nœud de jonction', detail: 'Chaque croisement doit avoir un nœud ou une jonction électrique' },
  { id: 'mc06', category: 'geometry',   mandatory: true,  description: 'Identifier et traiter les éléments isolés (non tracés)', detail: 'Éléments non-sélectionnés dans le traçage depuis sources = isolés → à corriger' },
  { id: 'mc07', category: 'attributes', mandatory: true,  description: 'Remplir Tension Nominale — Disjoncteurs dynamiques HTB/HTA', detail: 'Champ VoltageRating obligatoire pour le mapping vers UN Device' },
  { id: 'mc08', category: 'attributes', mandatory: true,  description: 'Remplir Tension Nominale — Lignes aériennes et câbles souterrains', detail: 'Toutes classes Line : HTA OH, HTA UG, HTB OH, BT OH, BT UG' },
  { id: 'mc09', category: 'attributes', mandatory: true,  description: 'Vérifier Tension Primaire/Secondaire — Transformateurs (selon SLD)', detail: 'T_Transformateur puissance : PrimaryVoltage / SecondaryVoltage' },
  { id: 'mc10', category: 'attributes', mandatory: true,  description: 'Désignation de phase non-null — BT Aérien (+ toutes les classes)', detail: 'PhaseDesignation ne doit jamais être null dans les données cible' },
  { id: 'mc11', category: 'attributes', mandatory: true,  description: 'Corriger valeurs hors-domaine — Type isolation câbles BT', detail: 'Valider vs liste autorisée dans le schéma UN cible' },
  { id: 'mc12', category: 'attributes', mandatory: true,  description: 'Courant nominal câbles dans liste codée (75/95/110/150/170/175/250/350/415/500 A)', detail: 'RatedCurrent doit correspondre exactement aux valeurs du domaine UN' },
  { id: 'mc13', category: 'attributes', mandatory: true,  description: 'Structure Support : format implémentation correct (SIMPLE/JUMELÉ/BÉTON/DISTRIPOLE)', detail: 'Les valeurs source ne correspondent pas — recoder avant migration' },
  { id: 'mc14', category: 'topology',   mandatory: true,  description: 'Compléter schémas internes sous-stations HTA/BT manquants', detail: 'Modèle interne obligatoire pour maintenir la connectivité dans UN' },
  { id: 'mc15', category: 'topology',   mandatory: true,  description: 'Relier câbles BT aux sous-stations HTA/BT et réseau BT correspondant', detail: 'Absence de câble BT entre transformateur poteau et tableau BT' },
  { id: 'mc16', category: 'topology',   mandatory: false, description: 'Traiter commutateurs connectés à 3 éléments ligne → ajouter baie HTA', detail: 'Ex: ObjectID 440 — ajouter baie + diviser connexion' },
  { id: 'mc17', category: 'topology',   mandatory: true,  description: 'Vérifier position commutateurs internes postes (fermé/ouvert)', detail: 'PM KISSANE, PM BIG FAIM, ROND POINT ZAC, NDIASSANE COUPURE, ANDEL NDONG → fermé' },
  { id: 'mc18', category: 'topology',   mandatory: false, description: 'Réseau EP : modéliser comme circuit dédié (coffret → lampadaires)', detail: 'Câble UG EP monophasé ou triphasé — circuit séparé du réseau BT standard' },
  { id: 'mc19', category: 'attributes', mandatory: true,  description: 'Corriger tensions postes HTB/HTA selon Schémas Unifilaires (SLD) de référence', detail: 'Ex : 90kV côté central, 225kV côté flancs — vérifier par poste' },
];

// ─── Configuration portail ArcGIS (domaine Senelec) ─────────────────────────

export interface UNPortalConfig {
  portalUrl:       string; // https://gis.senelec.sn/portal
  serverUrl:       string; // https://gis.senelec.sn/server
  featureServerUrl:string; // .../rest/services/SENELEC_UN/FeatureServer
  utilityNetworkServiceUrl: string; // .../rest/services/SENELEC_UN/UtilityNetworkServer
  version:         string; // UN version (v7)
  connected:       boolean;
}

export const DEFAULT_UN_PORTAL: UNPortalConfig = {
  portalUrl:       'https://gis.senelec.sn/portal',
  serverUrl:       'https://gis.senelec.sn/server',
  featureServerUrl:'https://gis.senelec.sn/server/rest/services/SENELEC_UN/FeatureServer',
  utilityNetworkServiceUrl: 'https://gis.senelec.sn/server/rest/services/SENELEC_UN/UtilityNetworkServer',
  version:         'v7',
  connected:       false,
};

// Helper : couleur par tier
export function tierColor(tier: UNTier | null): string {
  if (!tier) return '#64748b';
  return UN_TIERS.find(t => t.code === tier)?.color ?? '#64748b';
}

// Helper : couches groupées par domaine + tier
export function layersByDomainAndTier(): {
  electric: { tier: TierDef; layers: UNLayerDef[] }[];
  structure: UNLayerDef[];
} {
  const electric = UN_TIERS.map(tier => ({
    tier,
    layers: UN_LAYERS.filter(l => l.domain === 'ELECTRIC' && (l.tier === tier.code || l.tier === null)),
  }));
  const structure = UN_LAYERS.filter(l => l.domain === 'STRUCTURE');
  return { electric, structure };
}

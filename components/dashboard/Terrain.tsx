'use client';

import { useState, useMemo } from 'react';
import {
  MapPin, Camera, Wifi, WifiOff, CheckCircle2, Clock, AlertTriangle,
  X, Send, Plus, Shield, Zap, Activity, Layers, RefreshCw,
  ClipboardList, ChevronRight, BarChart2, Thermometer, Wind,
} from 'lucide-react';
import dynamic from 'next/dynamic';
import { useProjectStore, DOMAINE_CFG } from '@/lib/projectStore';
import { useAuth, isOperationalReadOnly } from '@/lib/authStore';
import { readOnlyGuard } from '@/lib/operationalGuard';
import SaisieTerrainMensuelle from '@/components/dashboard/SaisieTerrainMensuelle';

// Carte SIG réelle (Leaflet) — chargée côté client uniquement (window).
const ProjetsCarteLeaflet = dynamic(() => import('@/components/ui/ProjetsCarteLeaflet'), {
  ssr: false,
  loading: () => (
    <div style={{ height: 300, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#64748B', fontSize: 13, background: '#F1F5F9', borderRadius: 10 }}>
      Chargement de la carte SIG…
    </div>
  ),
});

/* ═══════════════════════════════════════════════════════════════════
   TYPES
═══════════════════════════════════════════════════════════════════ */
type StatutChantier = 'en_cours' | 'en_retard' | 'termine' | 'bloque';
type StatutMission  = 'planifie' | 'en_cours' | 'attente_val' | 'valide' | 'non_conforme';
type Gravite        = 'faible' | 'modere' | 'grave' | 'bloquant';
type StatutNC       = 'ouverte' | 'en_cours' | 'cloturee';
type TypeFormulaire = 'avancement' | 'reception' | 'constat' | 'incident_sec' | 'mesure_dpe';

interface Chantier {
  id: string; code: string; localite: string; commune: string;
  projet: string; projetNom: string; domaine: string;
  avancement: number; avancementPlanifie: number;
  dernieresSaisie: string; statut: StatutChantier;
  poteaux: { pose: number; prevu: number };
  lignes: { pose: number; prevu: number };   // km
  postes: { pose: number; prevu: number };
  mw: { installe: number; prevu: number };
  compteurs: { pose: number; prevu: number };
  consoEstimee: number; consoReelle: number;  // MWh/an
  efficacite: number;                          // % gains
  conformiteDPE: number;                       // %
  coordGPS: string; cp: string; region: string;
  syncStatut: 'synced' | 'pending' | 'offline';
}

interface Mission {
  id: string; chantier: string; localite: string; agent: string;
  type: TypeFormulaire; statut: StatutMission;
  dateDebut: string; dateFin: string; photos: number;
  avancement: number; commentaire: string; device: string;
}

interface NonConformite {
  id: string; chantier: string; localite: string; date: string;
  type: string; gravite: Gravite; description: string;
  statut: StatutNC; agent: string; delaiTraitement: number;
  actionCorrective?: string;
}

interface SyncEntry {
  id: string; chantier: string; localite: string; agent: string;
  type: string; device: string; recu: string; avancement: number;
  photos: number; size: string;
}

interface Rapport {
  id: string; chantier: string; localite: string; date: string;
  statut: string; agent: string; avancement: number;
}

/* ═══════════════════════════════════════════════════════════════════
   MOCK DATA — Données terrain DPE réalistes
═══════════════════════════════════════════════════════════════════ */
const CHANTIERS: Chantier[] = [
  {
    id: 'CH-001', code: 'NGY-2026', localite: 'Ngayokhem', commune: 'Commune de Ngayokhem',
    projet: 'DPE-RURAL-THI-01', projetNom: 'Électrification Rurale Thiès Est', domaine: 'distribution',
    avancement: 67, avancementPlanifie: 72,
    dernieresSaisie: '2026-05-24', statut: 'en_cours',
    poteaux: { pose: 134, prevu: 200 }, lignes: { pose: 8.4, prevu: 12 },
    postes: { pose: 2, prevu: 3 }, mw: { installe: 0.4, prevu: 0.6 },
    compteurs: { pose: 312, prevu: 480 },
    consoEstimee: 1.8, consoReelle: 1.6, efficacite: 11.2, conformiteDPE: 87,
    coordGPS: '14.4821°N · -16.5190°E', cp: 'FALL Mamadou', region: 'Thiès',
    syncStatut: 'synced',
  },
  {
    id: 'CH-002', code: 'FND-2026', localite: 'Fandène', commune: 'Arrondissement de Fandène',
    projet: 'DPE-RURAL-THI-01', projetNom: 'Électrification Rurale Thiès Est', domaine: 'distribution',
    avancement: 82, avancementPlanifie: 78,
    dernieresSaisie: '2026-05-23', statut: 'en_cours',
    poteaux: { pose: 164, prevu: 200 }, lignes: { pose: 10.2, prevu: 12 },
    postes: { pose: 3, prevu: 3 }, mw: { installe: 0.6, prevu: 0.6 },
    compteurs: { pose: 396, prevu: 480 },
    consoEstimee: 2.1, consoReelle: 2.0, efficacite: 9.5, conformiteDPE: 94,
    coordGPS: '14.5341°N · -16.6742°E', cp: 'FALL Mamadou', region: 'Thiès',
    syncStatut: 'synced',
  },
  {
    id: 'CH-003', code: 'DJB-2026', localite: 'Diembéring', commune: 'Commune de Diembéring',
    projet: 'DPE-RURAL-ZIG-02', projetNom: 'Électrification Casamance Sud', domaine: 'distribution',
    avancement: 34, avancementPlanifie: 55,
    dernieresSaisie: '2026-05-20', statut: 'en_retard',
    poteaux: { pose: 68, prevu: 200 }, lignes: { pose: 3.8, prevu: 14 },
    postes: { pose: 1, prevu: 4 }, mw: { installe: 0.2, prevu: 0.8 },
    compteurs: { pose: 82, prevu: 320 },
    consoEstimee: 3.2, consoReelle: 1.1, efficacite: 6.0, conformiteDPE: 58,
    coordGPS: '12.3967°N · -16.7658°E', cp: 'DIOP Ousmane', region: 'Ziguinchor',
    syncStatut: 'pending',
  },
  {
    id: 'CH-004', code: 'CSK-2026', localite: 'Cap Skirring', commune: 'Commune de Cap Skirring',
    projet: 'DPE-RURAL-ZIG-02', projetNom: 'Électrification Casamance Sud', domaine: 'distribution',
    avancement: 51, avancementPlanifie: 62,
    dernieresSaisie: '2026-05-22', statut: 'en_retard',
    poteaux: { pose: 102, prevu: 200 }, lignes: { pose: 6.1, prevu: 12 },
    postes: { pose: 2, prevu: 4 }, mw: { installe: 0.4, prevu: 0.8 },
    compteurs: { pose: 195, prevu: 380 },
    consoEstimee: 2.8, consoReelle: 1.5, efficacite: 7.2, conformiteDPE: 67,
    coordGPS: '12.3894°N · -16.7395°E', cp: 'DIOP Ousmane', region: 'Ziguinchor',
    syncStatut: 'offline',
  },
  {
    id: 'CH-005', code: 'ELK-2026', localite: 'Élinkine', commune: 'Arrondissement de Diembéring',
    projet: 'DPE-RURAL-ZIG-02', projetNom: 'Électrification Casamance Sud', domaine: 'distribution',
    avancement: 100, avancementPlanifie: 100,
    dernieresSaisie: '2026-05-10', statut: 'termine',
    poteaux: { pose: 180, prevu: 180 }, lignes: { pose: 11, prevu: 11 },
    postes: { pose: 3, prevu: 3 }, mw: { installe: 0.6, prevu: 0.6 },
    compteurs: { pose: 340, prevu: 340 },
    consoEstimee: 2.0, consoReelle: 1.9, efficacite: 12.1, conformiteDPE: 98,
    coordGPS: '12.5018°N · -16.5742°E', cp: 'DIOP Ousmane', region: 'Ziguinchor',
    syncStatut: 'synced',
  },
  {
    id: 'CH-006', code: 'KBR-2026', localite: 'Kolda Brasserie', commune: 'Commune de Kolda',
    projet: 'DPE-RURAL-KLD-03', projetNom: 'Électrification Kolda Nord', domaine: 'distribution',
    avancement: 22, avancementPlanifie: 40,
    dernieresSaisie: '2026-05-15', statut: 'bloque',
    poteaux: { pose: 44, prevu: 200 }, lignes: { pose: 2.2, prevu: 15 },
    postes: { pose: 0, prevu: 5 }, mw: { installe: 0.0, prevu: 1.0 },
    compteurs: { pose: 53, prevu: 400 },
    consoEstimee: 4.0, consoReelle: 0.5, efficacite: 4.0, conformiteDPE: 38,
    coordGPS: '12.8922°N · -14.9417°E', cp: 'SY Aminata', region: 'Kolda',
    syncStatut: 'offline',
  },
];

const MISSIONS: Mission[] = [
  { id: 'M-001', chantier: 'NGY-2026', localite: 'Ngayokhem', agent: 'DIOP Alioune',       type: 'avancement',    statut: 'valide',       dateDebut: '2026-05-24', dateFin: '2026-05-24', photos: 5,  avancement: 69, commentaire: 'Pose poteaux lot A terminée',            device: 'Samsung Tab A8'  },
  { id: 'M-002', chantier: 'FND-2026', localite: 'Fandène',   agent: 'FALL Mamadou',        type: 'avancement',    statut: 'attente_val',  dateDebut: '2026-05-24', dateFin: '2026-05-24', photos: 3,  avancement: 85, commentaire: 'Tirages câbles BT finalisés',            device: 'iPad Air'        },
  { id: 'M-003', chantier: 'DJB-2026', localite: 'Diembéring',agent: 'NDIAYE Khady',        type: 'incident_sec',  statut: 'non_conforme', dateDebut: '2026-05-23', dateFin: '2026-05-23', photos: 7,  avancement: 34, commentaire: 'Câble HTA endommagé, zone marécageuse', device: 'Samsung Tab A8'  },
  { id: 'M-004', chantier: 'CSK-2026', localite: 'Cap Skirring',agent: 'SARR Ibrahima',     type: 'constat',       statut: 'attente_val',  dateDebut: '2026-05-23', dateFin: '2026-05-23', photos: 4,  avancement: 53, commentaire: 'Zone inondée, accès difficile',          device: 'Huawei MatePad'  },
  { id: 'M-005', chantier: 'KBR-2026', localite: 'Kolda Brasserie', agent: 'BA Fatou',      type: 'reception',     statut: 'attente_val',  dateDebut: '2026-05-24', dateFin: '2026-05-24', photos: 6,  avancement: 24, commentaire: 'Réception partielle lot B',             device: 'iPad Mini'       },
  { id: 'M-006', chantier: 'NGY-2026', localite: 'Ngayokhem', agent: 'DIOP Alioune',        type: 'mesure_dpe',    statut: 'en_cours',     dateDebut: '2026-05-25', dateFin: '2026-05-25', photos: 0,  avancement: 67, commentaire: 'Relevés conso en cours',                device: 'Samsung Tab A8'  },
  { id: 'M-007', chantier: 'ELK-2026', localite: 'Élinkine',  agent: 'THIAM Ndeye',         type: 'reception',     statut: 'valide',       dateDebut: '2026-05-10', dateFin: '2026-05-10', photos: 12, avancement: 100, commentaire: 'Réception définitive - tous ouvrages conformes', device: 'iPad Air' },
  { id: 'M-008', chantier: 'DJB-2026', localite: 'Diembéring',agent: 'NDIAYE Khady',        type: 'avancement',    statut: 'planifie',     dateDebut: '2026-05-26', dateFin: '2026-05-26', photos: 0,  avancement: 34, commentaire: '',                                       device: 'Samsung Tab A8'  },
];

const NON_CONFORMITES: NonConformite[] = [
  { id: 'NC-001', chantier: 'DJB-2026', localite: 'Diembéring', date: '2026-05-21', type: 'Technique',      gravite: 'modere',   description: 'Câble HTA endommagé lors du déroulage, 40m à reprendre',       statut: 'en_cours',  agent: 'NDIAYE Khady',   delaiTraitement: 5,  actionCorrective: 'Commande câble de remplacement' },
  { id: 'NC-002', chantier: 'KBR-2026', localite: 'Kolda',       date: '2026-05-19', type: 'Logistique',     gravite: 'bloquant', description: 'Fournisseur poteaux BA 10m : livraison reportée au 10 juin',     statut: 'ouverte',   agent: 'BA Fatou',       delaiTraitement: 22, actionCorrective: undefined },
  { id: 'NC-003', chantier: 'CSK-2026', localite: 'Cap Skirring', date: '2026-05-18', type: 'Sécurité',       gravite: 'grave',    description: "Chute d'un ouvrier lors de pose poteau — arrêt de travail 5j",  statut: 'ouverte',   agent: 'SARR Ibrahima',  delaiTraitement: 7,  actionCorrective: undefined },
  { id: 'NC-004', chantier: 'FND-2026', localite: 'Fandène',     date: '2026-05-15', type: 'Environnemental', gravite: 'faible',   description: 'Zone de protection classée détectée à 200m du tracé',           statut: 'cloturee',  agent: 'FALL Mamadou',   delaiTraitement: 3,  actionCorrective: 'Consultation DDI effectuée, déviation validée' },
  { id: 'NC-005', chantier: 'DJB-2026', localite: 'Diembéring', date: '2026-05-23', type: 'Qualité',         gravite: 'modere',   description: 'Profondeur de fouilles insuffisante — 3 poteaux à reprendre',    statut: 'en_cours',  agent: 'NDIAYE Khady',   delaiTraitement: 4,  actionCorrective: 'Reprise fouilles en cours' },
];

const RAPPORTS: Rapport[] = [
  { id: 'R-001', chantier: 'NGY-2026', localite: 'Ngayokhem',     date: '2026-05-24', statut: 'Validé',        agent: 'DIOP A.', avancement: 69  },
  { id: 'R-002', chantier: 'FND-2026', localite: 'Fandène',       date: '2026-05-24', statut: 'En validation', agent: 'FALL M.', avancement: 85  },
  { id: 'R-003', chantier: 'DJB-2026', localite: 'Diembéring',    date: '2026-05-23', statut: 'Rejeté',        agent: 'NDIAYE K.', avancement: 34 },
  { id: 'R-004', chantier: 'CSK-2026', localite: 'Cap Skirring',  date: '2026-05-23', statut: 'En validation', agent: 'SARR I.', avancement: 53  },
  { id: 'R-005', chantier: 'NGY-2026', localite: 'Ngayokhem',     date: '2026-05-21', statut: 'Validé',        agent: 'DIOP A.', avancement: 62  },
  { id: 'R-006', chantier: 'KBR-2026', localite: 'Kolda Brasserie', date: '2026-05-20', statut: 'En validation', agent: 'BA F.', avancement: 22 },
  { id: 'R-007', chantier: 'ELK-2026', localite: 'Élinkine',      date: '2026-05-10', statut: 'Validé',        agent: 'THIAM N.', avancement: 100 },
];

const SYNC_QUEUE: SyncEntry[] = [
  { id: 'SYNC-001', chantier: 'NGY-2026', localite: 'Ngayokhem',      agent: 'DIOP Alioune',  type: 'Rapport Journalier',    device: 'Samsung Tab A8',  recu: '07:42', avancement: 69, photos: 5, size: '4.2 MB' },
  { id: 'SYNC-002', chantier: 'FND-2026', localite: 'Fandène',        agent: 'FALL Mamadou',  type: 'Rapport Journalier',    device: 'iPad Air',        recu: '08:11', avancement: 85, photos: 3, size: '2.8 MB' },
  { id: 'SYNC-003', chantier: 'DJB-2026', localite: 'Diembéring',     agent: 'NDIAYE Khady',  type: 'Incident Sécurité',     device: 'Samsung Tab A8',  recu: '09:05', avancement: 34, photos: 7, size: '8.1 MB' },
  { id: 'SYNC-004', chantier: 'CSK-2026', localite: 'Cap Skirring',   agent: 'SARR Ibrahima', type: 'Rapport Hebdomadaire',  device: 'Huawei MatePad',  recu: '09:33', avancement: 53, photos: 4, size: '3.5 MB' },
  { id: 'SYNC-005', chantier: 'KBR-2026', localite: 'Kolda Brasserie',agent: 'BA Fatou',      type: 'Réception Partielle',   device: 'iPad Mini',       recu: '18:20', avancement: 24, photos: 6, size: '5.7 MB' },
];

const CHECKLIST_ITEMS = [
  'EPI portés par tous les ouvriers',
  'Zone de travail balisée et sécurisée',
  'Consignation électrique réalisée',
  'Plan de masse disponible sur site',
  'Chef d\'équipe présent et identifié',
  'Matériel vérifié et conforme au BL',
  'GPS activé et coordonnées relevées',
  'Formulaire DPE complété',
];

const TYPES_NC = ['Technique', 'Sécurité', 'Qualité', 'Environnemental', 'Logistique', 'DPE/Conformité'];
const GRAVITES: Gravite[] = ['faible', 'modere', 'grave', 'bloquant'];

/* ═══════════════════════════════════════════════════════════════════
   HELPERS
═══════════════════════════════════════════════════════════════════ */
const STATUT_CH_CFG: Record<StatutChantier, { label: string; color: string; bg: string }> = {
  en_cours:  { label: 'En cours',  color: '#1B4F8A', bg: '#EFF6FF' },
  en_retard: { label: 'En retard', color: '#EF3340', bg: '#FFF1F2' },
  termine:   { label: 'Terminé',   color: '#16A34A', bg: '#F0FDF4' },
  bloque:    { label: 'Bloqué',    color: '#9333EA', bg: '#FAF5FF' },
};

const STATUT_MISSION_CFG: Record<StatutMission, { label: string; color: string; bg: string; col: string }> = {
  planifie:     { label: 'Planifié',         color: '#64748B', bg: '#F8FAFC', col: 'Planifié'          },
  en_cours:     { label: 'En cours',         color: '#1B4F8A', bg: '#EFF6FF', col: 'En cours'          },
  attente_val:  { label: 'Attente validation',color: '#D97706', bg: '#FFFBEB', col: 'Attente validation' },
  valide:       { label: 'Validé',           color: '#16A34A', bg: '#F0FDF4', col: 'Validé'            },
  non_conforme: { label: 'Non-conforme',     color: '#EF3340', bg: '#FFF1F2', col: 'Non-conforme'      },
};

const GRAVITE_CFG: Record<Gravite, { label: string; color: string; bg: string }> = {
  faible:   { label: 'Faible',   color: '#16A34A', bg: '#F0FDF4' },
  modere:   { label: 'Modéré',   color: '#D97706', bg: '#FFFBEB' },
  grave:    { label: 'Grave',    color: '#F47920', bg: '#FFF7ED' },
  bloquant: { label: 'Bloquant', color: '#EF3340', bg: '#FFF1F2' },
};

const STATUT_NC_CFG: Record<StatutNC, { label: string; color: string }> = {
  ouverte:   { label: 'Ouverte',   color: '#EF3340' },
  en_cours:  { label: 'En cours',  color: '#D97706' },
  cloturee:  { label: 'Clôturée',  color: '#16A34A' },
};

function Pill({ label, color, bg }: { label: string; color: string; bg: string }) {
  return (
    <span style={{ fontSize: 10, fontWeight: 700, color, background: bg, padding: '2px 8px', borderRadius: 99, border: `1px solid ${color}33` }}>
      {label}
    </span>
  );
}

function ProgressBar({ value, max, color }: { value: number; max: number; color: string }) {
  const pct = Math.min(100, Math.round((value / Math.max(1, max)) * 100));
  return (
    <div style={{ height: 6, borderRadius: 99, background: '#E5E7EB', overflow: 'hidden' }}>
      <div style={{ width: `${pct}%`, height: '100%', background: color, borderRadius: 99, transition: 'width .3s' }} />
    </div>
  );
}

function SyncBadge({ statut }: { statut: 'synced' | 'pending' | 'offline' }) {
  if (statut === 'synced')  return <span style={{ color: '#16A34A', fontSize: 10, display: 'flex', alignItems: 'center', gap: 3 }}><Wifi size={10} />Sync</span>;
  if (statut === 'pending') return <span style={{ color: '#D97706', fontSize: 10, display: 'flex', alignItems: 'center', gap: 3 }}><RefreshCw size={10} />En attente</span>;
  return                           <span style={{ color: '#EF3340', fontSize: 10, display: 'flex', alignItems: 'center', gap: 3 }}><WifiOff size={10} />Hors-ligne</span>;
}

function cpiColor(v: number, max: number) {
  const r = v / max;
  if (r >= 0.85) return '#16A34A';
  if (r >= 0.60) return '#D97706';
  return '#EF3340';
}

/* ═══════════════════════════════════════════════════════════════════
   COMPOSANT PRINCIPAL
═══════════════════════════════════════════════════════════════════ */
export default function Terrain() {
  const store = readOnlyGuard(useProjectStore(), isOperationalReadOnly(useAuth().user));
  const [activeTab, setActiveTab] = useState(0);
  const [selectedChantier, setSelectedChantier] = useState('CH-001');
  const [avancement, setAvancement] = useState(67);
  const [poteaux, setPoteaux] = useState(134);
  const [lignes, setLignes] = useState(8.4);
  const [postes, setPostes] = useState(2);
  const [mwInstalle, setMwInstalle] = useState(0.4);
  const [compteurs, setCompteurs] = useState(312);
  const [consoReelle, setConsoReelle] = useState(1.6);
  const [commentaire, setCommentaire] = useState('');
  const [checklist, setChecklist] = useState<boolean[]>(Array(CHECKLIST_ITEMS.length).fill(false));
  const [photosCount, setPhotosCount] = useState(0);
  const [formSent, setFormSent] = useState(false);
  const [typeFormulaire, setTypeFormulaire] = useState<TypeFormulaire>('avancement');
  const [ncType, setNcType] = useState('Technique');
  const [ncGravite, setNcGravite] = useState<Gravite>('modere');
  const [ncDesc, setNcDesc] = useState('');
  const [ncFormOpen, setNcFormOpen] = useState(false);
  const [ncSent, setNcSent] = useState(false);
  const [syncApproved, setSyncApproved] = useState<Record<string, boolean>>({});
  const [syncRejected, setSyncRejected] = useState<Record<string, boolean>>({});
  const [validationDone, setValidationDone] = useState<Record<string, 'valide' | 'rejete'>>({});
  const [valComment, setValComment] = useState<Record<string, string>>({});
  /* ── Kanban add-task modal ── */
  const [addTaskCol, setAddTaskCol] = useState<string | null>(null);
  const [newTaskForm, setNewTaskForm] = useState({ localite: '', agent: '', commentaire: '', type: 'avancement' as TypeFormulaire });
  const [taskAdded, setTaskAdded] = useState(false);
  /* ── Filter tabs for kanban ── */
  const MISSION_FILTERS = ['Toutes Missions', 'Avancement', 'Réception', 'Constat', 'Incident', 'Mesure DPE'] as const;
  type MissionFilter = typeof MISSION_FILTERS[number];
  const [missionFilter, setMissionFilter] = useState<MissionFilter>('Toutes Missions');
  const [refreshKey, setRefreshKey] = useState(0);

  const chantierActif = CHANTIERS.find(c => c.id === selectedChantier) || CHANTIERS[0];

  /* KPIs agrégés DPE */
  const kpis = useMemo(() => {
    const active = CHANTIERS.filter(c => c.statut !== 'bloque');
    return {
      kmReseau: active.reduce((s, c) => s + c.lignes.pose, 0),
      kmReseauPrevu: active.reduce((s, c) => s + c.lignes.prevu, 0),
      postes: active.reduce((s, c) => s + c.postes.pose, 0),
      postesPrevu: active.reduce((s, c) => s + c.postes.prevu, 0),
      mwInstalle: active.reduce((s, c) => s + c.mw.installe, 0),
      mwPrevu: active.reduce((s, c) => s + c.mw.prevu, 0),
      compteurs: active.reduce((s, c) => s + c.compteurs.pose, 0),
      compteursPrevu: active.reduce((s, c) => s + c.compteurs.prevu, 0),
      conformiteMoy: Math.round(active.reduce((s, c) => s + c.conformiteDPE, 0) / active.length),
      efficaciteMoy: (active.reduce((s, c) => s + c.efficacite, 0) / active.length).toFixed(1),
      consoEco: active.reduce((s, c) => s + (c.consoEstimee - c.consoReelle), 0).toFixed(1),
      synced: CHANTIERS.filter(c => c.syncStatut === 'synced').length,
      pending: CHANTIERS.filter(c => c.syncStatut === 'pending').length,
      offline: CHANTIERS.filter(c => c.syncStatut === 'offline').length,
    };
  }, []);

  /* Kanban groups */
  const kanbanCols: Record<string, Mission[]> = useMemo(() => {
    const cols: Record<string, Mission[]> = {
      'Planifié': [], 'En cours': [], 'Attente validation': [], 'Validé': [], 'Non-conforme': [],
    };
    MISSIONS.forEach(m => {
      const col = STATUT_MISSION_CFG[m.statut].col;
      cols[col].push(m);
    });
    return cols;
  }, []);

  const KANBAN_COLS_ORDER = ['Planifié', 'En cours', 'Attente validation', 'Validé', 'Non-conforme'];
  const KANBAN_COLORS: Record<string, string> = {
    'Planifié': '#64748B', 'En cours': '#1B4F8A', 'Attente validation': '#D97706',
    'Validé': '#16A34A', 'Non-conforme': '#EF3340',
  };

  const tabs = [
    { label: '📋 Kanban Missions', badge: MISSIONS.filter(m => m.statut === 'attente_val').length || undefined },
    { label: '🏗️ Chantiers DPE' },
    { label: '📝 Formulaire Terrain' },
    { label: '📊 Rapports' },
    { label: '🛡️ QHSE & Non-conformités', badge: NON_CONFORMITES.filter(nc => nc.statut !== 'cloturee').length || undefined },
    { label: '✅ Validation CP', badge: MISSIONS.filter(m => m.statut === 'attente_val').length || undefined },
    { label: '📲 Saisie Terrain' },
    { label: '🔄 Sync Mobile', badge: SYNC_QUEUE.length || undefined },
  ];

  /* ─── TAB 0: KANBAN MISSIONS ─────────────────────────────────── */
  function TabKanban() {
    const TYPE_MAP: Record<string, TypeFormulaire | null> = {
      'Toutes Missions': null, 'Avancement': 'avancement', 'Réception': 'reception',
      'Constat': 'constat', 'Incident': 'incident_sec', 'Mesure DPE': 'mesure_dpe',
    };
    const filterType = TYPE_MAP[missionFilter] ?? null;
    const filteredCols: Record<string, Mission[]> = {};
    KANBAN_COLS_ORDER.forEach(col => {
      filteredCols[col] = filterType ? kanbanCols[col].filter(m => m.type === filterType) : kanbanCols[col];
    });
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }} key={refreshKey}>
        {/* Filter tabs + Actualiser */}
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center' }}>
          {(['Toutes Missions', 'Avancement', 'Réception', 'Constat', 'Incident', 'Mesure DPE'] as const).map(f => (
            <button key={f} onClick={() => setMissionFilter(f)} style={{
              padding: '5px 12px', fontSize: 11, fontWeight: 600, cursor: 'pointer', borderRadius: 20,
              border: `1px solid ${missionFilter === f ? '#1B4F8A' : '#E2E8F0'}`,
              background: missionFilter === f ? '#1B4F8A' : '#fff',
              color: missionFilter === f ? '#fff' : '#64748B',
            }}>{f}</button>
          ))}
          <button onClick={() => setRefreshKey(k => k + 1)} style={{
            marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 5, padding: '5px 12px', fontSize: 11, fontWeight: 600, cursor: 'pointer', borderRadius: 7,
            border: '1px solid #E2E8F0', background: '#fff', color: '#64748B',
          }}><RefreshCw size={12} /> Actualiser</button>
        </div>

        {/* Add task modal */}
        {addTaskCol && (
          <div style={{ background: '#EFF6FF', border: '2px solid #BFDBFE', borderRadius: 10, padding: 16 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 10 }}>
              <span style={{ fontSize: 13, fontWeight: 700, color: '#1B4F8A' }}>+ Nouvelle tâche — {addTaskCol}</span>
              <button onClick={() => setAddTaskCol(null)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#64748B' }}><X size={16} /></button>
            </div>
            {taskAdded ? (
              <div style={{ padding: '8px 12px', background: '#F0FDF4', borderRadius: 7, color: '#16A34A', fontWeight: 700, fontSize: 12 }}>✅ Tâche ajoutée à la colonne {addTaskCol}</div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                  <div>
                    <label style={{ fontSize: 10, fontWeight: 700, color: '#64748B', display: 'block', marginBottom: 3 }}>LOCALITÉ</label>
                    <input value={newTaskForm.localite} onChange={e => setNewTaskForm(p => ({ ...p, localite: e.target.value }))} placeholder="Ex: Ngayokhem" style={{ width: '100%', boxSizing: 'border-box', padding: '7px 9px', borderRadius: 6, border: '1px solid #BFDBFE', fontSize: 11 }} />
                  </div>
                  <div>
                    <label style={{ fontSize: 10, fontWeight: 700, color: '#64748B', display: 'block', marginBottom: 3 }}>AGENT</label>
                    <input value={newTaskForm.agent} onChange={e => setNewTaskForm(p => ({ ...p, agent: e.target.value }))} placeholder="Nom de l'agent" style={{ width: '100%', boxSizing: 'border-box', padding: '7px 9px', borderRadius: 6, border: '1px solid #BFDBFE', fontSize: 11 }} />
                  </div>
                </div>
                <div>
                  <label style={{ fontSize: 10, fontWeight: 700, color: '#64748B', display: 'block', marginBottom: 3 }}>TYPE</label>
                  <select value={newTaskForm.type} onChange={e => setNewTaskForm(p => ({ ...p, type: e.target.value as TypeFormulaire }))} style={{ width: '100%', padding: '7px 9px', borderRadius: 6, border: '1px solid #BFDBFE', fontSize: 11 }}>
                    <option value="avancement">📈 Avancement physique</option>
                    <option value="reception">✅ Réception partielle</option>
                    <option value="constat">🔍 Constat terrain</option>
                    <option value="incident_sec">⚠️ Incident sécurité</option>
                    <option value="mesure_dpe">⚡ Mesure DPE/Énergie</option>
                  </select>
                </div>
                <div>
                  <label style={{ fontSize: 10, fontWeight: 700, color: '#64748B', display: 'block', marginBottom: 3 }}>COMMENTAIRE</label>
                  <input value={newTaskForm.commentaire} onChange={e => setNewTaskForm(p => ({ ...p, commentaire: e.target.value }))} placeholder="Observations..." style={{ width: '100%', boxSizing: 'border-box', padding: '7px 9px', borderRadius: 6, border: '1px solid #BFDBFE', fontSize: 11 }} />
                </div>
                <button onClick={() => {
                  if (!newTaskForm.localite.trim() || !newTaskForm.agent.trim()) return;
                  setTaskAdded(true);
                  setTimeout(() => { setTaskAdded(false); setAddTaskCol(null); }, 2000);
                }} style={{ padding: '8px 16px', borderRadius: 7, background: '#1B4F8A', color: '#fff', border: 'none', cursor: 'pointer', fontSize: 12, fontWeight: 700 }}>
                  Ajouter la tâche
                </button>
              </div>
            )}
          </div>
        )}

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 10, minWidth: 900, overflowX: 'auto' }}>
          {KANBAN_COLS_ORDER.map(colName => (
            <div key={colName} style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {/* Column header */}
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '8px 10px', borderRadius: 8, background: KANBAN_COLORS[colName] + '14', borderTop: `3px solid ${KANBAN_COLORS[colName]}` }}>
                <span style={{ fontSize: 11, fontWeight: 700, color: KANBAN_COLORS[colName] }}>{colName}</span>
                <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                  <span style={{ fontSize: 10, fontWeight: 800, color: '#fff', background: KANBAN_COLORS[colName], padding: '1px 6px', borderRadius: 99 }}>{filteredCols[colName].length}</span>
                  <button onClick={() => { setAddTaskCol(colName); setNewTaskForm({ localite: '', agent: '', commentaire: '', type: 'avancement' }); setTaskAdded(false); }} style={{ width: 18, height: 18, borderRadius: '50%', border: 'none', background: KANBAN_COLORS[colName] + '40', color: KANBAN_COLORS[colName], cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800, fontSize: 13 }}>+</button>
                </div>
              </div>
              {/* Cards */}
              {filteredCols[colName].map(m => (
                <div key={m.id} style={{ background: '#fff', borderRadius: 8, border: '1px solid #E2E8F0', padding: '10px 12px', boxShadow: '0 1px 3px rgba(0,0,0,.06)', display: 'flex', flexDirection: 'column', gap: 6 }}>
                  <div style={{ fontSize: 10, fontWeight: 700, color: KANBAN_COLORS[colName], textTransform: 'uppercase' }}>
                    {m.type === 'avancement' ? '📈 Avancement' : m.type === 'reception' ? '✅ Réception' : m.type === 'constat' ? '🔍 Constat' : m.type === 'incident_sec' ? '⚠️ Incident' : '⚡ Mesure DPE'}
                  </div>
                  <div style={{ fontSize: 12, fontWeight: 600, color: '#1E293B' }}>{m.localite}</div>
                  <div style={{ fontSize: 10, color: '#64748B' }}>{m.chantier}</div>
                  <div style={{ fontSize: 10, color: '#94A3B8' }}>👤 {m.agent.split(' ')[0]}</div>
                  {m.commentaire && <div style={{ fontSize: 10, color: '#64748B', fontStyle: 'italic', borderTop: '1px solid #F1F5F9', paddingTop: 4 }}>{m.commentaire.substring(0, 60)}{m.commentaire.length > 60 ? '…' : ''}</div>}
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 2 }}>
                    <span style={{ fontSize: 10, color: '#94A3B8' }}>{m.dateDebut}</span>
                    {m.photos > 0 && <span style={{ fontSize: 10, color: '#64748B', display: 'flex', alignItems: 'center', gap: 3 }}><Camera size={10} />{m.photos}</span>}
                  </div>
                  <div style={{ height: 4, borderRadius: 99, background: '#E5E7EB', overflow: 'hidden' }}>
                    <div style={{ width: `${m.avancement}%`, height: '100%', background: KANBAN_COLORS[colName], borderRadius: 99 }} />
                  </div>
                </div>
              ))}
              {filteredCols[colName].length === 0 && (
                <div style={{ padding: '16px 10px', textAlign: 'center', color: '#CBD5E1', fontSize: 11, border: '2px dashed #E2E8F0', borderRadius: 8 }}>Aucune mission</div>
              )}
            </div>
          ))}
        </div>
      </div>
    );
  }

  /* ─── TAB 1: CHANTIERS DPE ───────────────────────────────────── */
  function TabChantiers() {
    const projetsStore = store.projets;
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {/* ── Carte géographique des chantiers ──────────────────── */}
        <div style={{ background: '#fff', borderRadius: 10, border: '1px solid #E2E8F0', padding: '16px 18px', boxShadow: '0 1px 4px rgba(0,0,0,.06)' }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: '#1B4F8A', display: 'flex', alignItems: 'center', gap: 6, marginBottom: 10 }}>
            🗺️ Localisation des chantiers et projets DPE
          </div>
          <ProjetsCarteLeaflet
            height={320}
            projets={projetsStore.map(p => ({
              id: p.id, nom: p.nom, code: p.code, region: p.region,
              domaine: p.domaine, statut: p.statut,
              avancement: p.avancement, budget: p.budget,
              localisation: p.localisation,
              refSIG: `SIG-${p.code}`,
            }))}
          />
          {/* Légende domaines */}
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10, marginTop: 10 }}>
            {Object.entries(DOMAINE_CFG).map(([key, cfg]) => {
              const count = projetsStore.filter(p => p.domaine === key).length;
              if (count === 0) return null;
              return (
                <div key={key} style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 11 }}>
                  <span style={{ width: 10, height: 10, borderRadius: '50%', background: cfg.color, display: 'inline-block' }} />
                  <span style={{ color: '#475569' }}>{cfg.emoji} {cfg.label.split('/')[0].trim()} <strong style={{ color: cfg.color }}>({count})</strong></span>
                </div>
              );
            })}
          </div>
        </div>
        {CHANTIERS.map(ch => {
          const cfg = STATUT_CH_CFG[ch.statut];
          const isLate = ch.avancement < ch.avancementPlanifie;
          return (
            <div key={ch.id} style={{ background: '#fff', borderRadius: 10, border: '1px solid #E2E8F0', padding: '14px 16px', boxShadow: '0 1px 4px rgba(0,0,0,.06)', borderLeft: `4px solid ${cfg.color}` }}>
              <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 10 }}>
                <div style={{ flex: 1 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                    <span style={{ fontSize: 12, fontWeight: 700, color: '#1E293B' }}>{ch.code}</span>
                    <Pill label={cfg.label} color={cfg.color} bg={cfg.bg} />
                    <SyncBadge statut={ch.syncStatut} />
                    <span style={{ fontSize: 10, color: '#94A3B8' }}>{ch.coordGPS}</span>
                  </div>
                  <div style={{ fontSize: 14, fontWeight: 700, color: '#0F172A', marginBottom: 2 }}>{ch.localite} — {ch.commune}</div>
                  <div style={{ fontSize: 11, color: '#64748B' }}>{ch.projetNom} · Chef: {ch.cp} · {ch.region}</div>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 4 }}>
                  <div style={{ fontSize: 22, fontWeight: 800, color: cfg.color }}>{ch.avancement}%</div>
                  {isLate && <span style={{ fontSize: 9, color: '#EF3340', fontWeight: 700 }}>Planifié: {ch.avancementPlanifie}%</span>}
                </div>
              </div>

              {/* Progress bars */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8, marginTop: 12, marginBottom: 10 }}>
                {[
                  { label: 'Poteaux', pose: ch.poteaux.pose, prevu: ch.poteaux.prevu, unit: '' },
                  { label: 'Réseau (km HTA/BT)', pose: ch.lignes.pose, prevu: ch.lignes.prevu, unit: ' km' },
                  { label: 'Postes de transformation', pose: ch.postes.pose, prevu: ch.postes.prevu, unit: '' },
                ].map(item => (
                  <div key={item.label}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 3 }}>
                      <span style={{ fontSize: 10, color: '#64748B' }}>{item.label}</span>
                      <span style={{ fontSize: 10, fontWeight: 700, color: cpiColor(item.pose, item.prevu) }}>{item.pose}{item.unit}/{item.prevu}{item.unit}</span>
                    </div>
                    <ProgressBar value={item.pose} max={item.prevu} color={cpiColor(item.pose, item.prevu)} />
                  </div>
                ))}
              </div>

              {/* DPE Energy metrics */}
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', borderTop: '1px solid #F1F5F9', paddingTop: 8 }}>
                {[
                  { icon: '⚡', label: 'Compteurs', val: `${ch.compteurs.pose}/${ch.compteurs.prevu}` },
                  { icon: '🔋', label: 'MW installé', val: `${ch.mw.installe}/${ch.mw.prevu} MW` },
                  { icon: '📊', label: 'Conso réelle', val: `${ch.consoReelle} GWh/an` },
                  { icon: '🌿', label: 'Efficacité', val: `+${ch.efficacite}%` },
                  { icon: '✅', label: 'Conformité DPE', val: `${ch.conformiteDPE}%`, highlight: ch.conformiteDPE < 70 },
                ].map(item => (
                  <div key={item.label} style={{ fontSize: 11, color: item.highlight ? '#EF3340' : '#475569', background: item.highlight ? '#FFF1F2' : '#F8FAFC', padding: '3px 8px', borderRadius: 6, border: `1px solid ${item.highlight ? '#FECACA' : '#E2E8F0'}` }}>
                    {item.icon} <b>{item.label}:</b> {item.val}
                  </div>
                ))}
                <div style={{ fontSize: 10, color: '#94A3B8', marginLeft: 'auto', alignSelf: 'center' }}>
                  Dernière saisie: {ch.dernieresSaisie}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    );
  }

  /* ─── TAB 2: FORMULAIRE TERRAIN ──────────────────────────────── */
  function TabFormulaire() {
    return (
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
        {/* Left: config */}
        <div className="card" style={{ borderLeft: '4px solid #F47920' }}>
          <div style={{ marginBottom: 14 }}>
            <label style={{ fontSize: 11, fontWeight: 700, color: '#64748B', display: 'block', marginBottom: 4 }}>TYPE DE FORMULAIRE</label>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6 }}>
              {([
                { k: 'avancement', label: '📈 Avancement physique' },
                { k: 'reception',  label: '✅ Réception partielle' },
                { k: 'constat',    label: '🔍 Constat terrain' },
                { k: 'mesure_dpe', label: '⚡ Mesures DPE/Énergie' },
              ] as { k: TypeFormulaire; label: string }[]).map(({ k, label }) => (
                <button key={k} onClick={() => setTypeFormulaire(k)} style={{ padding: '8px 10px', borderRadius: 7, border: `2px solid ${typeFormulaire === k ? '#F47920' : '#E2E8F0'}`, background: typeFormulaire === k ? '#FFF7ED' : '#fff', fontSize: 11, fontWeight: typeFormulaire === k ? 700 : 400, color: typeFormulaire === k ? '#F47920' : '#475569', cursor: 'pointer', textAlign: 'left' }}>
                  {label}
                </button>
              ))}
            </div>
          </div>

          <div style={{ marginBottom: 12 }}>
            <label style={{ fontSize: 11, fontWeight: 700, color: '#64748B', display: 'block', marginBottom: 4 }}>CHANTIER</label>
            <select value={selectedChantier} onChange={e => { setSelectedChantier(e.target.value); const ch = CHANTIERS.find(c => c.id === e.target.value); if (ch) { setAvancement(ch.avancement); setPoteaux(ch.poteaux.pose); setLignes(ch.lignes.pose); setPostes(ch.postes.pose); setMwInstalle(ch.mw.installe); setCompteurs(ch.compteurs.pose); setConsoReelle(ch.consoReelle); } }} style={{ width: '100%', padding: '8px 10px', borderRadius: 7, border: '1px solid #E2E8F0', fontSize: 12, background: '#fff' }}>
              {CHANTIERS.map(ch => <option key={ch.id} value={ch.id}>{ch.code} — {ch.localite}</option>)}
            </select>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 10, padding: '6px 10px', background: '#F0FDF4', borderRadius: 7, border: '1px solid #BBF7D0' }}>
            <MapPin size={12} color="#16A34A" />
            <span style={{ fontSize: 11, color: '#15803D', fontWeight: 600 }}>{chantierActif.coordGPS}</span>
            <span style={{ fontSize: 10, color: '#86EFAC', marginLeft: 'auto' }}>GPS actif</span>
          </div>

          {/* Physical progress */}
          {(typeFormulaire === 'avancement' || typeFormulaire === 'reception') && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              <div>
                <label style={{ fontSize: 11, fontWeight: 700, color: '#64748B', display: 'block', marginBottom: 4 }}>AVANCEMENT GLOBAL (%)</label>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <input type="range" min={0} max={100} value={avancement} onChange={e => setAvancement(+e.target.value)} style={{ flex: 1 }} />
                  <span style={{ fontSize: 16, fontWeight: 800, color: '#1B4F8A', width: 42 }}>{avancement}%</span>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6, marginTop: 8 }}>
                  {[
                    { label: 'Poteaux posés', val: poteaux, set: setPoteaux, max: chantierActif.poteaux.prevu, unit: '' },
                    { label: 'Réseau (km)', val: lignes, set: (v: number) => setLignes(v), max: chantierActif.lignes.prevu, unit: ' km', step: 0.1 },
                    { label: 'Postes transfo', val: postes, set: setPostes, max: chantierActif.postes.prevu, unit: '' },
                    { label: 'Compteurs', val: compteurs, set: setCompteurs, max: chantierActif.compteurs.prevu, unit: '' },
                  ].map(f => (
                    <div key={f.label}>
                      <label style={{ fontSize: 10, color: '#64748B', display: 'block', marginBottom: 2 }}>{f.label} (/{f.max}{f.unit})</label>
                      <input type="number" value={f.val} step={(f as { step?: number }).step ?? 1} min={0} max={f.max}
                        onChange={e => f.set(+e.target.value)}
                        style={{ width: '100%', padding: '6px 8px', borderRadius: 6, border: '1px solid #E2E8F0', fontSize: 12 }} />
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* DPE energy fields */}
          {(typeFormulaire === 'mesure_dpe' || typeFormulaire === 'avancement') && (
            <div style={{ marginTop: 10, padding: '10px 12px', background: '#FFF7ED', borderRadius: 8, border: '1px solid #FED7AA' }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: '#C2410C', marginBottom: 8 }}>⚡ Indicateurs Énergie DPE</div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6 }}>
                <div>
                  <label style={{ fontSize: 10, color: '#64748B', display: 'block', marginBottom: 2 }}>MW installé ({chantierActif.mw.installe}/{chantierActif.mw.prevu})</label>
                  <input type="number" value={mwInstalle} step={0.1} min={0} max={chantierActif.mw.prevu} onChange={e => setMwInstalle(+e.target.value)} style={{ width: '100%', padding: '6px 8px', borderRadius: 6, border: '1px solid #E2E8F0', fontSize: 12 }} />
                </div>
                <div>
                  <label style={{ fontSize: 10, color: '#64748B', display: 'block', marginBottom: 2 }}>Conso réelle (GWh/an)</label>
                  <input type="number" value={consoReelle} step={0.1} min={0} onChange={e => setConsoReelle(+e.target.value)} style={{ width: '100%', padding: '6px 8px', borderRadius: 6, border: '1px solid #E2E8F0', fontSize: 12 }} />
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Right: photos + checklist + submit */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {/* Photos */}
          <div className="card">
            <div style={{ fontSize: 12, fontWeight: 700, color: '#1B4F8A', marginBottom: 10 }}>📸 Photos horodatées GPS</div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 8, marginBottom: 10 }}>
              {Array.from({ length: photosCount }).map((_, i) => (
                <div key={i} style={{ aspectRatio: '1', borderRadius: 8, background: '#E5E7EB', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 2 }}>
                  <Camera size={16} color="#9CA3AF" />
                  <span style={{ fontSize: 8, color: '#9CA3AF' }}>IMG_{String(i + 1).padStart(3, '0')}</span>
                </div>
              ))}
              <button onClick={() => setPhotosCount(p => p + 1)} style={{ aspectRatio: '1', borderRadius: 8, border: '2px dashed #CBD5E1', background: '#F8FAFC', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}>
                <Plus size={20} color="#94A3B8" />
              </button>
            </div>
            <div style={{ fontSize: 10, color: '#94A3B8' }}>{photosCount} photo(s) · GPS automatique · Horodatage certifié</div>
          </div>

          {/* Checklist */}
          <div className="card">
            <div style={{ fontSize: 12, fontWeight: 700, color: '#1B4F8A', marginBottom: 10 }}>✅ Checklist Sécurité & DPE</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {CHECKLIST_ITEMS.map((item, i) => (
                <label key={i} style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', padding: '4px 6px', borderRadius: 5, background: checklist[i] ? '#F0FDF4' : 'transparent' }}>
                  <input type="checkbox" checked={checklist[i]} onChange={() => setChecklist(prev => prev.map((v, idx) => idx === i ? !v : v))} style={{ width: 14, height: 14 }} />
                  <span style={{ fontSize: 11, color: checklist[i] ? '#15803D' : '#475569', textDecoration: checklist[i] ? 'line-through' : 'none' }}>{item}</span>
                </label>
              ))}
            </div>
            <div style={{ marginTop: 8, fontSize: 11, fontWeight: 700, color: checklist.every(Boolean) ? '#16A34A' : '#D97706' }}>
              {checklist.filter(Boolean).length}/{CHECKLIST_ITEMS.length} éléments validés
            </div>
          </div>

          {/* Commentaire */}
          <div className="card" style={{ flex: 1 }}>
            <label style={{ fontSize: 11, fontWeight: 700, color: '#64748B', display: 'block', marginBottom: 4 }}>COMMENTAIRES</label>
            <textarea value={commentaire} onChange={e => setCommentaire(e.target.value)} placeholder="Observations de terrain, contraintes rencontrées, actions requises..." style={{ width: '100%', height: 90, padding: '8px 10px', borderRadius: 8, border: '1px solid #E2E8F0', fontSize: 12, resize: 'none', fontFamily: 'inherit', boxSizing: 'border-box' }} />
          </div>

          {/* Submit */}
          {formSent ? (
            <div style={{ padding: 14, borderRadius: 10, background: '#F0FDF4', border: '1px solid #BBF7D0', display: 'flex', alignItems: 'center', gap: 10 }}>
              <CheckCircle2 size={20} color="#16A34A" />
              <div>
                <div style={{ fontSize: 12, fontWeight: 700, color: '#15803D' }}>Rapport envoyé avec succès</div>
                <div style={{ fontSize: 11, color: '#86EFAC' }}>En file de synchronisation · Accusé de réception dans 30s</div>
              </div>
            </div>
          ) : (
            <button onClick={() => { setFormSent(true); setTimeout(() => setFormSent(false), 4000); }} style={{ padding: '12px 0', borderRadius: 10, background: '#1B4F8A', color: '#fff', fontWeight: 700, fontSize: 13, border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
              <Send size={16} />
              Envoyer le rapport terrain
            </button>
          )}
        </div>
      </div>
    );
  }

  /* ─── TAB 3: RAPPORTS ────────────────────────────────────────── */
  function TabRapports() {
    const statusCfg: Record<string, { color: string; bg: string }> = {
      'Validé':        { color: '#16A34A', bg: '#F0FDF4' },
      'En validation': { color: '#D97706', bg: '#FFFBEB' },
      'Rejeté':        { color: '#EF3340', bg: '#FFF1F2' },
    };
    return (
      <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr style={{ background: '#F8FAFC', borderBottom: '2px solid #E2E8F0' }}>
              {['ID', 'Chantier', 'Localité', 'Date', 'Agent', 'Avancement', 'Statut'].map(h => (
                <th key={h} style={{ padding: '10px 12px', fontSize: 10, fontWeight: 700, color: '#64748B', textAlign: 'left', textTransform: 'uppercase', letterSpacing: '.5px' }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {RAPPORTS.map((r, i) => {
              const cfg = statusCfg[r.statut] ?? { color: '#64748B', bg: '#F8FAFC' };
              return (
                <tr key={r.id} style={{ borderBottom: '1px solid #F1F5F9', background: i % 2 === 0 ? '#fff' : '#FAFAFA' }}>
                  <td style={{ padding: '10px 12px', fontSize: 11, fontWeight: 600, color: '#1B4F8A' }}>{r.id}</td>
                  <td style={{ padding: '10px 12px', fontSize: 11, color: '#475569' }}>{r.chantier}</td>
                  <td style={{ padding: '10px 12px', fontSize: 12, fontWeight: 600, color: '#1E293B' }}>{r.localite}</td>
                  <td style={{ padding: '10px 12px', fontSize: 11, color: '#64748B' }}>{r.date}</td>
                  <td style={{ padding: '10px 12px', fontSize: 11, color: '#475569' }}>{r.agent}</td>
                  <td style={{ padding: '10px 12px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      <div style={{ flex: 1, height: 6, borderRadius: 99, background: '#E5E7EB', overflow: 'hidden', maxWidth: 80 }}>
                        <div style={{ width: `${r.avancement}%`, height: '100%', background: r.avancement === 100 ? '#16A34A' : '#1B4F8A', borderRadius: 99 }} />
                      </div>
                      <span style={{ fontSize: 11, fontWeight: 700 }}>{r.avancement}%</span>
                    </div>
                  </td>
                  <td style={{ padding: '10px 12px' }}>
                    <Pill label={r.statut} color={cfg.color} bg={cfg.bg} />
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    );
  }

  /* ─── TAB 4: QHSE & NON-CONFORMITÉS ─────────────────────────── */
  function TabQHSE() {
    const openCount = NON_CONFORMITES.filter(nc => nc.statut !== 'cloturee').length;
    const byGravite = {
      bloquant: NON_CONFORMITES.filter(nc => nc.gravite === 'bloquant').length,
      grave: NON_CONFORMITES.filter(nc => nc.gravite === 'grave').length,
      modere: NON_CONFORMITES.filter(nc => nc.gravite === 'modere').length,
      faible: NON_CONFORMITES.filter(nc => nc.gravite === 'faible').length,
    };
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        {/* QHSE KPI strip */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 10 }}>
          {[
            { label: 'NC ouvertes', val: openCount, color: '#EF3340' },
            { label: 'Bloquantes', val: byGravite.bloquant, color: '#9333EA' },
            { label: 'Graves', val: byGravite.grave, color: '#F47920' },
            { label: 'Clôturées', val: NON_CONFORMITES.filter(nc => nc.statut === 'cloturee').length, color: '#16A34A' },
          ].map(kpi => (
            <div key={kpi.label} style={{ background: '#fff', borderRadius: 10, border: '1px solid #E2E8F0', padding: '12px 14px', borderLeft: `4px solid ${kpi.color}` }}>
              <div style={{ fontSize: 10, fontWeight: 700, color: '#64748B', textTransform: 'uppercase', marginBottom: 4 }}>{kpi.label}</div>
              <div style={{ fontSize: 24, fontWeight: 800, color: kpi.color }}>{kpi.val}</div>
            </div>
          ))}
        </div>

        {/* NC button */}
        <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
          <button onClick={() => setNcFormOpen(true)} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 14px', borderRadius: 8, background: '#EF3340', color: '#fff', border: 'none', cursor: 'pointer', fontSize: 12, fontWeight: 700 }}>
            <Plus size={14} /> Nouvelle non-conformité
          </button>
        </div>

        {/* NC form */}
        {ncFormOpen && (
          <div style={{ background: '#FFF1F2', border: '2px solid #FECACA', borderRadius: 10, padding: 16 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 12 }}>
              <span style={{ fontSize: 13, fontWeight: 700, color: '#EF3340' }}>🚨 Déclarer une non-conformité</span>
              <button onClick={() => setNcFormOpen(false)} style={{ background: 'none', border: 'none', cursor: 'pointer' }}><X size={16} color="#EF3340" /></button>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 10 }}>
              <div>
                <label style={{ fontSize: 10, fontWeight: 700, color: '#64748B', display: 'block', marginBottom: 3 }}>TYPE</label>
                <select value={ncType} onChange={e => setNcType(e.target.value)} style={{ width: '100%', padding: '7px 8px', borderRadius: 6, border: '1px solid #FECACA', fontSize: 11 }}>
                  {TYPES_NC.map(t => <option key={t}>{t}</option>)}
                </select>
              </div>
              <div>
                <label style={{ fontSize: 10, fontWeight: 700, color: '#64748B', display: 'block', marginBottom: 3 }}>GRAVITÉ</label>
                <select value={ncGravite} onChange={e => setNcGravite(e.target.value as Gravite)} style={{ width: '100%', padding: '7px 8px', borderRadius: 6, border: '1px solid #FECACA', fontSize: 11 }}>
                  {GRAVITES.map(g => <option key={g} value={g}>{GRAVITE_CFG[g].label}</option>)}
                </select>
              </div>
              <div>
                <label style={{ fontSize: 10, fontWeight: 700, color: '#64748B', display: 'block', marginBottom: 3 }}>CHANTIER</label>
                <select style={{ width: '100%', padding: '7px 8px', borderRadius: 6, border: '1px solid #FECACA', fontSize: 11 }}>
                  {CHANTIERS.map(c => <option key={c.id}>{c.code} — {c.localite}</option>)}
                </select>
              </div>
            </div>
            <div style={{ marginTop: 10 }}>
              <label style={{ fontSize: 10, fontWeight: 700, color: '#64748B', display: 'block', marginBottom: 3 }}>DESCRIPTION</label>
              <textarea value={ncDesc} onChange={e => setNcDesc(e.target.value)} placeholder="Décrivez la non-conformité constatée..." style={{ width: '100%', height: 70, padding: '8px', borderRadius: 6, border: '1px solid #FECACA', fontSize: 11, resize: 'none', boxSizing: 'border-box' }} />
            </div>
            {ncSent ? (
              <div style={{ marginTop: 10, padding: '8px 12px', background: '#F0FDF4', borderRadius: 8, color: '#15803D', fontWeight: 700, fontSize: 12 }}>✅ Non-conformité enregistrée et escaladée</div>
            ) : (
              <button onClick={() => { setNcSent(true); setTimeout(() => { setNcSent(false); setNcFormOpen(false); setNcDesc(''); }, 3000); }} style={{ marginTop: 10, padding: '8px 16px', background: '#EF3340', color: '#fff', border: 'none', borderRadius: 8, cursor: 'pointer', fontWeight: 700, fontSize: 12 }}>
                Déclarer & escalader
              </button>
            )}
          </div>
        )}

        {/* NC list */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {NON_CONFORMITES.map(nc => {
            const gcfg = GRAVITE_CFG[nc.gravite];
            const scfg = STATUT_NC_CFG[nc.statut];
            return (
              <div key={nc.id} style={{ background: '#fff', borderRadius: 10, border: '1px solid #E2E8F0', padding: '14px 16px', borderLeft: `4px solid ${gcfg.color}` }}>
                <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 10 }}>
                  <div style={{ flex: 1 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                      <span style={{ fontSize: 11, fontWeight: 700, color: '#1B4F8A' }}>{nc.id}</span>
                      <Pill label={gcfg.label} color={gcfg.color} bg={gcfg.bg} />
                      <span style={{ fontSize: 10, fontWeight: 700, color: scfg.color }}>⬤ {scfg.label}</span>
                      <span style={{ fontSize: 10, color: '#94A3B8' }}>{nc.type}</span>
                    </div>
                    <div style={{ fontSize: 12, fontWeight: 700, color: '#1E293B', marginBottom: 3 }}>{nc.localite} — {nc.chantier}</div>
                    <div style={{ fontSize: 12, color: '#475569', marginBottom: 4 }}>{nc.description}</div>
                    {nc.actionCorrective && (
                      <div style={{ fontSize: 11, color: '#15803D', background: '#F0FDF4', padding: '4px 8px', borderRadius: 5, display: 'inline-block' }}>
                        ✅ Action: {nc.actionCorrective}
                      </div>
                    )}
                  </div>
                  <div style={{ textAlign: 'right', flexShrink: 0 }}>
                    <div style={{ fontSize: 10, color: '#94A3B8' }}>{nc.date}</div>
                    <div style={{ fontSize: 10, color: '#64748B', marginTop: 2 }}>👤 {nc.agent}</div>
                    <div style={{ fontSize: 10, color: nc.delaiTraitement > 10 ? '#EF3340' : '#D97706', fontWeight: 700, marginTop: 2 }}>⏱ {nc.delaiTraitement}j</div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    );
  }

  /* ─── TAB 5: VALIDATION CP ───────────────────────────────────── */
  function TabValidation() {
    const pending = MISSIONS.filter(m => m.statut === 'attente_val');
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {pending.length === 0 && (
          <div style={{ padding: 32, textAlign: 'center', color: '#94A3B8', fontSize: 13 }}>
            <CheckCircle2 size={32} color="#16A34A" style={{ marginBottom: 8, display: 'block', margin: '0 auto 8px' }} />
            Aucun rapport en attente de validation
          </div>
        )}
        {pending.map(m => {
          const done = validationDone[m.id];
          return (
            <div key={m.id} style={{ background: '#fff', borderRadius: 10, border: '1px solid #E2E8F0', padding: '14px 16px' }}>
              <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 10, marginBottom: 10 }}>
                <div>
                  <div style={{ fontSize: 13, fontWeight: 700, color: '#1E293B', marginBottom: 2 }}>{m.localite} — {m.chantier}</div>
                  <div style={{ fontSize: 11, color: '#64748B' }}>
                    {m.type === 'avancement' ? '📈 Avancement' : m.type === 'reception' ? '✅ Réception' : '🔍 Constat'} · {m.dateDebut} · {m.agent} · {m.photos} photos
                  </div>
                </div>
                <div style={{ fontSize: 22, fontWeight: 800, color: '#1B4F8A' }}>{m.avancement}%</div>
              </div>
              {m.commentaire && <div style={{ fontSize: 12, color: '#475569', fontStyle: 'italic', marginBottom: 10, padding: '6px 10px', background: '#F8FAFC', borderRadius: 6 }}>"{m.commentaire}"</div>}
              {done ? (
                <div style={{ padding: '8px 12px', borderRadius: 8, background: done === 'valide' ? '#F0FDF4' : '#FFF1F2', color: done === 'valide' ? '#15803D' : '#EF3340', fontWeight: 700, fontSize: 12 }}>
                  {done === 'valide' ? '✅ Validé' : '❌ Rejeté'} par Chef de Projet
                </div>
              ) : (
                <div style={{ display: 'flex', gap: 8 }}>
                  <textarea value={valComment[m.id] || ''} onChange={e => setValComment(prev => ({ ...prev, [m.id]: e.target.value }))} placeholder="Commentaire du CP..." style={{ flex: 1, height: 50, padding: '7px 8px', borderRadius: 6, border: '1px solid #E2E8F0', fontSize: 11, resize: 'none', fontFamily: 'inherit' }} />
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
                    <button onClick={() => setValidationDone(prev => ({ ...prev, [m.id]: 'valide' }))} style={{ padding: '8px 14px', borderRadius: 7, background: '#16A34A', color: '#fff', border: 'none', cursor: 'pointer', fontWeight: 700, fontSize: 11 }}>✅ Valider</button>
                    <button onClick={() => setValidationDone(prev => ({ ...prev, [m.id]: 'rejete' }))} style={{ padding: '8px 14px', borderRadius: 7, background: '#EF3340', color: '#fff', border: 'none', cursor: 'pointer', fontWeight: 700, fontSize: 11 }}>❌ Rejeter</button>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    );
  }

  /* ─── TAB 6: SYNC MOBILE ─────────────────────────────────────── */
  function TabSync() {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 10 }}>
          {[
            { label: 'Synchronisés', val: kpis.synced, color: '#16A34A', icon: <Wifi size={16} color="#16A34A" /> },
            { label: 'En attente sync', val: kpis.pending, color: '#D97706', icon: <RefreshCw size={16} color="#D97706" /> },
            { label: 'Hors-ligne', val: kpis.offline, color: '#EF3340', icon: <WifiOff size={16} color="#EF3340" /> },
          ].map(k => (
            <div key={k.label} style={{ background: '#fff', borderRadius: 10, border: '1px solid #E2E8F0', padding: '12px 14px', display: 'flex', alignItems: 'center', gap: 12, borderLeft: `4px solid ${k.color}` }}>
              {k.icon}
              <div>
                <div style={{ fontSize: 10, color: '#64748B', textTransform: 'uppercase', fontWeight: 700 }}>{k.label}</div>
                <div style={{ fontSize: 22, fontWeight: 800, color: k.color }}>{k.val}</div>
              </div>
            </div>
          ))}
        </div>

        {SYNC_QUEUE.map(s => {
          const done = syncApproved[s.id] || syncRejected[s.id];
          return (
            <div key={s.id} style={{ background: '#fff', borderRadius: 10, border: '1px solid #E2E8F0', padding: '14px 16px', display: 'flex', alignItems: 'center', gap: 12 }}>
              <div style={{ width: 40, height: 40, borderRadius: 10, background: '#F0F4FF', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                <Activity size={18} color="#1B4F8A" />
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 2 }}>
                  <span style={{ fontSize: 12, fontWeight: 700, color: '#1E293B' }}>{s.localite}</span>
                  <span style={{ fontSize: 10, color: '#94A3B8' }}>{s.chantier}</span>
                  <span style={{ fontSize: 10, background: '#EFF6FF', color: '#1B4F8A', padding: '1px 6px', borderRadius: 4, fontWeight: 700 }}>{s.type}</span>
                </div>
                <div style={{ fontSize: 11, color: '#64748B' }}>👤 {s.agent} · 📱 {s.device} · 🕐 {s.recu} · <Camera size={10} style={{ verticalAlign: 'middle' }} /> {s.photos} · {s.size}</div>
              </div>
              <div style={{ textAlign: 'right', flexShrink: 0 }}>
                <div style={{ fontSize: 16, fontWeight: 800, color: '#1B4F8A', marginBottom: 4 }}>{s.avancement}%</div>
                {done ? (
                  <span style={{ fontSize: 11, fontWeight: 700, color: syncApproved[s.id] ? '#16A34A' : '#EF3340' }}>
                    {syncApproved[s.id] ? '✅ Ingéré' : '❌ Rejeté'}
                  </span>
                ) : (
                  <div style={{ display: 'flex', gap: 6 }}>
                    <button onClick={() => setSyncApproved(p => ({ ...p, [s.id]: true }))} style={{ padding: '5px 10px', borderRadius: 6, background: '#16A34A', color: '#fff', border: 'none', cursor: 'pointer', fontSize: 11, fontWeight: 700 }}>Ingérer</button>
                    <button onClick={() => setSyncRejected(p => ({ ...p, [s.id]: true }))} style={{ padding: '5px 10px', borderRadius: 6, background: '#EF3340', color: '#fff', border: 'none', cursor: 'pointer', fontSize: 11, fontWeight: 700 }}>Rejeter</button>
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    );
  }

  /* ═══════════════════════════════════════════════════════════════
     RENDER
  ═══════════════════════════════════════════════════════════════ */
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14, padding: '0 0 24px' }}>

      {/* ── Header ────────────────────────────────────────────── */}
      <div className="card" style={{ borderLeft: '4px solid #F47920' }}>
        <div className="card-header">
          <div>
            <div className="card-title">🏗️ Terrain & Missions DPE — Canevas C</div>
            <div style={{ fontSize: 11, color: 'var(--muted)', marginTop: 2 }}>
              Saisies terrain · Kanban missions · QHSE · Validation CP · Sync différée
            </div>
          </div>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <span style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 11, color: '#16A34A', fontWeight: 700, padding: '3px 10px', borderRadius: 6, background: '#F0FDF4', border: '1px solid #BBF7D0' }}>
              <Wifi size={11} /> API Sync Active
            </span>
            <span style={{ fontSize: 11, color: '#64748B', padding: '3px 10px', borderRadius: 6, background: '#F8FAFC', border: '1px solid #E2E8F0' }}>
              {SYNC_QUEUE.length} en attente
            </span>
          </div>
        </div>
      </div>

      {/* ── DPE KPI Strip ─────────────────────────────────────── */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(6, 1fr)', gap: 8 }}>
        {[
          { icon: <Layers size={14} color="#1B4F8A" />, label: 'Réseau HTA/BT',    val: `${kpis.kmReseau.toFixed(1)} km`, sub: `/${kpis.kmReseauPrevu} km`, color: '#1B4F8A' },
          { icon: <Activity size={14} color="#16A34A" />, label: 'Postes transfo',   val: `${kpis.postes}`,             sub: `/${kpis.postesPrevu} prévus`, color: '#16A34A' },
          { icon: <Zap size={14} color="#D97706" />,      label: 'MW installés',    val: `${kpis.mwInstalle.toFixed(1)} MW`, sub: `/${kpis.mwPrevu} MW`, color: '#D97706' },
          { icon: <BarChart2 size={14} color="#8B5CF6" />,label: 'Compteurs',       val: `${kpis.compteurs}`,          sub: `/${kpis.compteursPrevu} prévus`, color: '#8B5CF6' },
          { icon: <Wind size={14} color="#0EA5E9" />,     label: 'Éco. énergie',    val: `${kpis.consoEco} GWh`,       sub: 'économisés/an', color: '#0EA5E9' },
          { icon: <Shield size={14} color="#F47920" />,   label: 'Conformité DPE', val: `${kpis.conformiteMoy}%`,      sub: `Eff. moy. +${kpis.efficaciteMoy}%`, color: kpis.conformiteMoy >= 80 ? '#16A34A' : '#EF3340' },
        ].map(k => (
          <div key={k.label} style={{ background: '#fff', borderRadius: 8, border: '1px solid #E2E8F0', padding: '10px 12px', borderTop: `3px solid ${k.color}`, boxShadow: '0 1px 3px rgba(0,0,0,.05)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 5, marginBottom: 4 }}>{k.icon}<span style={{ fontSize: 9, fontWeight: 700, color: '#64748B', textTransform: 'uppercase', letterSpacing: '.5px' }}>{k.label}</span></div>
            <div style={{ fontSize: 18, fontWeight: 800, color: k.color, lineHeight: 1.1 }}>{k.val}</div>
            <div style={{ fontSize: 9, color: '#94A3B8', marginTop: 2 }}>{k.sub}</div>
          </div>
        ))}
      </div>

      {/* ── Tabs ──────────────────────────────────────────────── */}
      <div style={{ overflowX: 'auto' }}>
        <div className="tabs" style={{ minWidth: 700 }}>
          {tabs.map((t, i) => (
            <button key={i} className={`tab${activeTab === i ? ' active' : ''}`} onClick={() => setActiveTab(i)}
              style={{ fontSize: 12, display: 'flex', alignItems: 'center', gap: 5 }}>
              {t.label}
              {t.badge !== undefined && (
                <span style={{ fontSize: 9, fontWeight: 800, padding: '1px 5px', borderRadius: 99, background: '#FFF7ED', color: '#EA580C', border: '1px solid #FED7AA' }}>{t.badge}</span>
              )}
            </button>
          ))}
        </div>
      </div>

      {/* ── Tab content ───────────────────────────────────────── */}
      {activeTab === 0 && <TabKanban />}
      {activeTab === 1 && <TabChantiers />}
      {activeTab === 2 && <TabFormulaire />}
      {activeTab === 3 && <TabRapports />}
      {activeTab === 4 && <TabQHSE />}
      {activeTab === 5 && <TabValidation />}
      {activeTab === 6 && <SaisieTerrainMensuelle />}
      {activeTab === 7 && <TabSync />}
    </div>
  );
}

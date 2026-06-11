'use client';

import { useState } from 'react';
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer,
  LineChart, Line, CartesianGrid, Legend,
} from 'recharts';
import toast from 'react-hot-toast';
import {
  Truck, AlertTriangle, Activity, Gauge,
  Plus, CheckCircle, Clock, XCircle, Settings,
  ChevronDown, Fuel, X, User, Trash2,
  ArrowRightLeft, Send, Calendar,
} from 'lucide-react';
import { useOdmConfig } from '@/lib/odmConfigStore';
import { DPE_ORG } from '@/lib/dpeOrgStructure';
import { getDirectionLabel } from '@/lib/authStore';

// ─── Types ────────────────────────────────────────────────────────────────────

type StatutVehicule = 'Disponible' | 'En mission' | 'En maintenance' | 'Hors service';
type TypeAlerte = 'Assurance' | 'Visite technique' | 'Entretien' | 'Permis chauffeur' | 'Vignette';
type StatutAlerte = 'Critique' | 'Attention' | 'OK';

interface Vehicule {
  id: string;
  immatriculation: string;
  marque: string;
  modele: string;
  annee: number;
  couleur: string;
  statut: StatutVehicule;
  kmTotal: number;
  kmCeMois: number;
  prochainEntretienKm: number;
  assuranceExpiration: string;
  assuranceJoursRestants: number;
  visiteExpirationDate: string;
  visiteJoursRestants: number;
  chauffeurAssigne: string | null;
  direction: string;
  carburant: string;
}

interface MissionCarnet {
  id: string;
  vehiculeId: string;
  date: string;
  chauffeur: string;
  destination: string;
  kmDepart: number;
  kmArrivee: number;
  consommation: number; // litres
  odmRef: string;
}

interface AlerteVehicule {
  id: string;
  vehiculeId: string;
  type: TypeAlerte;
  description: string;
  echeance: string;
  joursRestants: number;
  statut: StatutAlerte;
}

interface MaintenanceHisto {
  id: string;
  vehiculeId: string;
  date: string;
  type: string;
  prestataire: string;
  km: number;
  cout: number;
  description: string;
}

interface StatMensuelle {
  mois: string;
  tauxDisponible: number;
  tauxMission: number;
  tauxMaintenance: number;
}

interface ConsoVehicule {
  vehicule: string;
  consoMois: number;
  budget: number;
}

interface RessourceUagl {
  id: string;
  type: 'vehicule' | 'chauffeur';
  nom: string;
  details: string;     // immatriculation+modèle ou permis+contact
  uaglCode: string;    // ex: 'UAGL/DEP'
  uaglLabel: string;   // ex: 'Direction Études & Programmation'
  statut: 'Disponible';
}

interface DemandeEmprunt {
  id: string;
  ressourceId: string;
  ressourceNom: string;
  uaglSource: string;
  dateDebut: string;
  dateFin: string;
  motif: string;
  odmRef: string;
  statut: 'En attente' | 'Approuvée' | 'Refusée';
}

// ─── Mock Data ────────────────────────────────────────────────────────────────

const VEHICULES: Vehicule[] = [
  {
    id: 'V01', immatriculation: 'SN-0234-DA', marque: 'Toyota', modele: 'Land Cruiser 200',
    annee: 2021, couleur: 'Blanc', statut: 'Disponible',
    kmTotal: 87430, kmCeMois: 1840, prochainEntretienKm: 90000,
    assuranceExpiration: '31/08/2026', assuranceJoursRestants: 98,
    visiteExpirationDate: '15/06/2026', visiteJoursRestants: 21,
    chauffeurAssigne: 'Modou FALL', direction: 'DER', carburant: 'Diesel',
  },
  {
    id: 'V02', immatriculation: 'SN-4521-DK', marque: 'Nissan', modele: 'Patrol Y62',
    annee: 2020, couleur: 'Argent', statut: 'En mission',
    kmTotal: 112680, kmCeMois: 2340, prochainEntretienKm: 115000,
    assuranceExpiration: '28/05/2026', assuranceJoursRestants: 3,
    visiteExpirationDate: '30/07/2026', visiteJoursRestants: 66,
    chauffeurAssigne: 'Ibra DIOP', direction: 'DER', carburant: 'Diesel',
  },
  {
    id: 'V03', immatriculation: 'SN-7892-DK', marque: 'Mitsubishi', modele: 'L200 Triton',
    annee: 2022, couleur: 'Blanc', statut: 'En mission',
    kmTotal: 54210, kmCeMois: 3120, prochainEntretienKm: 60000,
    assuranceExpiration: '30/11/2026', assuranceJoursRestants: 189,
    visiteExpirationDate: '15/09/2026', visiteJoursRestants: 113,
    chauffeurAssigne: 'Alassane SARR', direction: 'DER', carburant: 'Diesel',
  },
  {
    id: 'V04', immatriculation: 'SN-1103-TH', marque: 'Toyota', modele: 'Hilux Revo',
    annee: 2023, couleur: 'Blanc', statut: 'Disponible',
    kmTotal: 28960, kmCeMois: 980, prochainEntretienKm: 30000,
    assuranceExpiration: '31/10/2026', assuranceJoursRestants: 159,
    visiteExpirationDate: '20/12/2026', visiteJoursRestants: 209,
    chauffeurAssigne: 'Mamadou WADE', direction: 'DER', carburant: 'Diesel',
  },
  {
    id: 'V05', immatriculation: 'SN-5567-ZG', marque: 'Land Rover', modele: 'Defender 110',
    annee: 2022, couleur: 'Blanc', statut: 'En maintenance',
    kmTotal: 68420, kmCeMois: 0, prochainEntretienKm: 70000,
    assuranceExpiration: '31/07/2026', assuranceJoursRestants: 67,
    visiteExpirationDate: '10/08/2026', visiteJoursRestants: 77,
    chauffeurAssigne: null, direction: 'DER', carburant: 'Diesel',
  },
  {
    id: 'V06', immatriculation: 'SN-2231-DK', marque: 'Toyota', modele: 'Land Cruiser 70',
    annee: 2019, couleur: 'Blanc', statut: 'Disponible',
    kmTotal: 143800, kmCeMois: 1560, prochainEntretienKm: 145000,
    assuranceExpiration: '15/06/2026', assuranceJoursRestants: 21,
    visiteExpirationDate: '30/06/2026', visiteJoursRestants: 36,
    chauffeurAssigne: 'Oumar NDIAYE', direction: 'DPE', carburant: 'Diesel',
  },
  {
    id: 'V07', immatriculation: 'SN-8834-KL', marque: 'Ford', modele: 'Ranger Wildtrak',
    annee: 2021, couleur: 'Gris', statut: 'Disponible',
    kmTotal: 72140, kmCeMois: 1240, prochainEntretienKm: 75000,
    assuranceExpiration: '30/09/2026', assuranceJoursRestants: 128,
    visiteExpirationDate: '15/10/2026', visiteJoursRestants: 143,
    chauffeurAssigne: 'Cheikh BA', direction: 'DPE', carburant: 'Diesel',
  },
  {
    id: 'V08', immatriculation: 'SN-3312-DK', marque: 'Toyota', modele: 'Land Cruiser 200',
    annee: 2018, couleur: 'Blanc', statut: 'Hors service',
    kmTotal: 198400, kmCeMois: 0, prochainEntretienKm: 200000,
    assuranceExpiration: '31/03/2026', assuranceJoursRestants: -55,
    visiteExpirationDate: '28/02/2026', visiteJoursRestants: -86,
    chauffeurAssigne: null, direction: 'DER', carburant: 'Diesel',
  },
];

const MISSIONS_CARNET: MissionCarnet[] = [
  { id: 'MC-001', vehiculeId: 'V01', date: '23/05/2026', chauffeur: 'Modou FALL', destination: 'Saint-Louis', kmDepart: 85920, kmArrivee: 86360, consommation: 71, odmRef: 'ODM-DER-2026-040' },
  { id: 'MC-002', vehiculeId: 'V01', date: '20/05/2026', chauffeur: 'Modou FALL', destination: 'Thiès', kmDepart: 85780, kmArrivee: 85920, consommation: 23, odmRef: 'ODM-DER-2026-038' },
  { id: 'MC-003', vehiculeId: 'V01', date: '18/05/2026', chauffeur: 'Modou FALL', destination: 'Kaolack', kmDepart: 85530, kmArrivee: 85780, consommation: 42, odmRef: 'ODM-DER-2026-037' },
  { id: 'MC-004', vehiculeId: 'V02', date: '24/05/2026', chauffeur: 'Ibra DIOP', destination: 'Ziguinchor', kmDepart: 110200, kmArrivee: 110740, consommation: 95, odmRef: 'ODM-DER-2026-041' },
  { id: 'MC-005', vehiculeId: 'V03', date: '26/05/2026', chauffeur: 'Alassane SARR', destination: 'Ziguinchor', kmDepart: 51850, kmArrivee: 52640, consommation: 130, odmRef: 'ODM-DER-2026-042' },
  { id: 'MC-006', vehiculeId: 'V04', date: '22/05/2026', chauffeur: 'Mamadou WADE', destination: 'Rufisque', kmDepart: 28480, kmArrivee: 28535, consommation: 10, odmRef: 'ODM-DER-2026-039' },
  { id: 'MC-007', vehiculeId: 'V06', date: '21/05/2026', chauffeur: 'Oumar NDIAYE', destination: 'Kolda', kmDepart: 142380, kmArrivee: 143130, consommation: 130, odmRef: 'ODM-DER-2026-036' },
  { id: 'MC-008', vehiculeId: 'V07', date: '19/05/2026', chauffeur: 'Cheikh BA', destination: 'Mbour', kmDepart: 71660, kmArrivee: 71900, consommation: 40, odmRef: 'ODM-DER-2026-035' },
];

const ALERTES_VEHICULE: AlerteVehicule[] = [
  { id: 'AL-01', vehiculeId: 'V02', type: 'Assurance', description: 'Assurance Nissan Patrol SN-4521-DK expirée dans 3 jours', echeance: '28/05/2026', joursRestants: 3, statut: 'Critique' },
  { id: 'AL-02', vehiculeId: 'V08', type: 'Assurance', description: 'Assurance Toyota LC SN-3312-DK expirée depuis 55 jours', echeance: '31/03/2026', joursRestants: -55, statut: 'Critique' },
  { id: 'AL-03', vehiculeId: 'V08', type: 'Visite technique', description: 'Visite technique SN-3312-DK expirée depuis 86 jours', echeance: '28/02/2026', joursRestants: -86, statut: 'Critique' },
  { id: 'AL-04', vehiculeId: 'V01', type: 'Visite technique', description: 'Visite technique Toyota LC 200 SN-0234-DA dans 21 jours', echeance: '15/06/2026', joursRestants: 21, statut: 'Attention' },
  { id: 'AL-05', vehiculeId: 'V06', type: 'Assurance', description: 'Assurance Toyota LC 70 SN-2231-DK dans 21 jours', echeance: '15/06/2026', joursRestants: 21, statut: 'Attention' },
  { id: 'AL-06', vehiculeId: 'V06', type: 'Visite technique', description: 'Visite technique SN-2231-DK à renouveler', echeance: '30/06/2026', joursRestants: 36, statut: 'Attention' },
  { id: 'AL-07', vehiculeId: 'V01', type: 'Entretien', description: 'Entretien programmé à 90 000 km — 2 570 km restants', echeance: 'À 90 000 km', joursRestants: 30, statut: 'Attention' },
  { id: 'AL-08', vehiculeId: 'V03', type: 'Entretien', description: 'Entretien programmé à 60 000 km — 5 790 km restants', echeance: 'À 60 000 km', joursRestants: 45, statut: 'OK' },
];

const MAINTENANCES: MaintenanceHisto[] = [
  { id: 'MH-01', vehiculeId: 'V05', date: '20/05/2026', type: 'Réparation moteur', prestataire: 'Garage TOTAL Dakar', km: 68420, cout: 1850000, description: 'Remplacement joint de culasse + vidange complète' },
  { id: 'MH-02', vehiculeId: 'V01', date: '15/03/2026', type: 'Entretien 85 000 km', prestataire: 'Concessionnaire Toyota', km: 85000, cout: 420000, description: 'Vidange, filtres air/gasoil, bougies de préchauffage' },
  { id: 'MH-03', vehiculeId: 'V04', date: '02/04/2026', type: 'Entretien 25 000 km', prestataire: 'Concessionnaire Toyota', km: 25000, cout: 280000, description: 'Vidange huile, filtre huile, vérification plaquettes' },
  { id: 'MH-04', vehiculeId: 'V07', date: '10/05/2026', type: 'Remplacement pneus', prestataire: 'CFAO Dakar', km: 71200, cout: 680000, description: '4 pneus Michelin BF Goodrich + équilibrage' },
];

const STATS_MENSUELLES: StatMensuelle[] = [
  { mois: 'Jan', tauxDisponible: 68, tauxMission: 22, tauxMaintenance: 10 },
  { mois: 'Fév', tauxDisponible: 62, tauxMission: 28, tauxMaintenance: 10 },
  { mois: 'Mar', tauxDisponible: 70, tauxMission: 20, tauxMaintenance: 10 },
  { mois: 'Avr', tauxDisponible: 65, tauxMission: 25, tauxMaintenance: 10 },
  { mois: 'Mai', tauxDisponible: 50, tauxMission: 37, tauxMaintenance: 13 },
];

const CONSO_PAR_VEHICULE: ConsoVehicule[] = [
  { vehicule: 'LC 200 (DA)', consoMois: 185, budget: 277500 },
  { vehicule: 'Patrol (DK)', consoMois: 234, budget: 351000 },
  { vehicule: 'L200 (DK)', consoMois: 312, budget: 468000 },
  { vehicule: 'Hilux (TH)', consoMois: 98, budget: 147000 },
  { vehicule: 'LC 70 (DK)', consoMois: 156, budget: 234000 },
  { vehicule: 'Ranger (KL)', consoMois: 124, budget: 186000 },
];

// ─── Ressources disponibles dans les autres UAGLs ─────────────────────────────
const RESSOURCES_UAGLS: RessourceUagl[] = [
  // UAGL/DEP
  { id: 'RU-01', type: 'vehicule', nom: 'Toyota Hilux Revo', details: 'SN-4408-KD · 2022 · 41 230 km', uaglCode: 'UAGL/DEP', uaglLabel: 'Direction Études & Programmation', statut: 'Disponible' },
  { id: 'RU-02', type: 'vehicule', nom: 'Nissan Navara NP300', details: 'SN-7712-ZK · 2021 · 68 900 km', uaglCode: 'UAGL/DEP', uaglLabel: 'Direction Études & Programmation', statut: 'Disponible' },
  { id: 'RU-03', type: 'chauffeur', nom: 'Malick DIALLO', details: 'Permis B+C · Exp. 2028 · Tél. 77 312 44 80', uaglCode: 'UAGL/DEP', uaglLabel: 'Direction Études & Programmation', statut: 'Disponible' },
  // UAGL/DIT
  { id: 'RU-04', type: 'vehicule', nom: 'Mitsubishi Pajero Sport', details: 'SN-0091-DA · 2020 · 95 100 km', uaglCode: 'UAGL/DIT', uaglLabel: 'Direction Infrastructure & Travaux', statut: 'Disponible' },
  { id: 'RU-05', type: 'chauffeur', nom: 'Adama FALL', details: 'Permis B · Exp. 2027 · Tél. 76 201 33 55', uaglCode: 'UAGL/DIT', uaglLabel: 'Direction Infrastructure & Travaux', statut: 'Disponible' },
  { id: 'RU-06', type: 'chauffeur', nom: 'Seydou GAYE', details: 'Permis B+C · Exp. 2026 · Tél. 70 455 88 12', uaglCode: 'UAGL/DIT', uaglLabel: 'Direction Infrastructure & Travaux', statut: 'Disponible' },
  // UAGL/DGC
  { id: 'RU-07', type: 'vehicule', nom: 'Toyota Land Cruiser 70', details: 'SN-5530-TH · 2019 · 127 450 km', uaglCode: 'UAGL/DGC', uaglLabel: 'Direction Gestion des Contrats', statut: 'Disponible' },
  { id: 'RU-08', type: 'chauffeur', nom: 'Ousmane NIANG', details: 'Permis B+C+D · Exp. 2029 · Tél. 77 680 10 24', uaglCode: 'UAGL/DGC', uaglLabel: 'Direction Gestion des Contrats', statut: 'Disponible' },
];

const UAGL_COLORS: Record<string, string> = {
  'UAGL/DEP': '#0F766E',
  'UAGL/DIT': '#1D4ED8',
  'UAGL/DGC': '#7C3AED',
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

function statutPillClass(s: StatutVehicule): string {
  if (s === 'Disponible') return 'pill pill-ok';
  if (s === 'En mission') return 'pill pill-info';
  if (s === 'En maintenance') return 'pill pill-warn';
  return 'pill pill-ko';
}

function alerteColor(j: number): string {
  if (j < 0) return 'var(--red)';
  if (j <= 14) return 'var(--red)';
  if (j <= 30) return 'var(--orange)';
  return '#16A34A';
}

function consoColor(c: number, seuil: number = 14): string {
  if (c > seuil * 1.15) return 'var(--red)';
  if (c > seuil) return 'var(--orange)';
  return '#16A34A';
}

function assuranceUrgent(joursRestants: number): boolean {
  return joursRestants <= 30;
}

// ─── Composant principal ───────────────────────────────────────────────────────

type OngletFlotte = 'parc' | 'carnet' | 'chauffeurs' | 'alertes' | 'stats' | 'emprunts';

export default function Flotte() {
  const [onglet, setOnglet] = useState<OngletFlotte>('parc');
  const [selectedVehicule, setSelectedVehicule] = useState(VEHICULES[0].id);

  // Données modifiables (workflow alertes + ajout maintenance)
  const [alertes, setAlertes] = useState<AlerteVehicule[]>(ALERTES_VEHICULE);
  const [maintenances, setMaintenances] = useState<MaintenanceHisto[]>(MAINTENANCES);
  const [showMaintForm, setShowMaintForm] = useState(false);

  // ─ Emprunts inter-UAGL
  const [demandes, setDemandes] = useState<DemandeEmprunt[]>([]);
  const [empruntModal, setEmpruntModal] = useState<RessourceUagl | null>(null);
  const [filtreUagl, setFiltreUagl] = useState<string>('tous');

  const traiterAlerte = (id: string) => {
    setAlertes(prev => prev.filter(a => a.id !== id));
    toast.success('Alerte traitée et clôturée');
  };
  const ajouterMaintenance = (m: MaintenanceHisto) => {
    setMaintenances(prev => [m, ...prev]);
    setShowMaintForm(false);
    toast.success('Maintenance enregistrée');
  };

  const vehiculesActifs = VEHICULES.filter(v => v.statut !== 'Hors service').length;
  const enMaintenance = VEHICULES.filter(v => v.statut === 'En maintenance').length;
  const alertesUrgentes = alertes.filter(a => a.statut === 'Critique').length;
  const tauxUtilisation = Math.round(
    VEHICULES.filter(v => v.statut === 'En mission').length / vehiculesActifs * 100
  );

  const missionsVehicule = MISSIONS_CARNET.filter(m => m.vehiculeId === selectedVehicule);
  const alertesTotal = alertes.length;
  const alertesEnCours = alertes.filter(a => a.statut !== 'OK').length;

  // Ranking efficacité
  const RANKING = CONSO_PAR_VEHICULE.map(v => ({
    ...v,
    coutParKm: Math.round(v.budget / (v.consoMois * 7.14) * 10) / 10, // estimation km
  })).sort((a, b) => a.coutParKm - b.coutParKm);

  const consoMoyenne = Math.round(
    MISSIONS_CARNET.reduce((acc, m) => {
      const km = m.kmArrivee - m.kmDepart;
      return km > 0 ? acc + (m.consommation / km * 100) : acc;
    }, 0) / MISSIONS_CARNET.filter(m => m.kmArrivee > m.kmDepart).length * 10
  ) / 10;

  const demandesEnAttente = demandes.filter(d => d.statut === 'En attente').length;

  const ONGLETS: { key: OngletFlotte; label: string }[] = [
    { key: 'parc', label: 'Parc auto' },
    { key: 'carnet', label: 'Carnet de bord' },
    { key: 'chauffeurs', label: 'Chauffeurs par appartenance' },
    { key: 'alertes', label: 'Alertes & Maintenance' },
    { key: 'stats', label: 'Statistiques' },
    { key: 'emprunts', label: 'Emprunts inter-UAGL' },
  ];

  return (
    <div style={{ flex: 1, overflowY: 'auto', padding: 20, background: 'var(--bg, #F4F6F9)' }}>

      {/* KPI Row */}
      <div className="kpi-grid" style={{ marginBottom: 20 }}>
        <div className="kpi-card">
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{ width: 40, height: 40, borderRadius: 10, background: 'rgba(14,52,96,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Truck size={20} color="var(--navy)" />
            </div>
            <div>
              <div style={{ fontSize: 22, fontWeight: 800, color: 'var(--navy)' }}>{vehiculesActifs}</div>
              <div style={{ fontSize: 11, color: '#64748B' }}>Véhicules actifs</div>
            </div>
          </div>
        </div>
        <div className="kpi-card">
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{ width: 40, height: 40, borderRadius: 10, background: 'rgba(243,146,0,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Settings size={20} color="var(--orange)" />
            </div>
            <div>
              <div style={{ fontSize: 22, fontWeight: 800, color: 'var(--orange)' }}>{enMaintenance}</div>
              <div style={{ fontSize: 11, color: '#64748B' }}>En maintenance</div>
            </div>
          </div>
        </div>
        <div className="kpi-card">
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{ width: 40, height: 40, borderRadius: 10, background: 'rgba(226,35,26,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <AlertTriangle size={20} color="var(--red)" />
            </div>
            <div>
              <div style={{ fontSize: 22, fontWeight: 800, color: 'var(--red)' }}>{alertesUrgentes}</div>
              <div style={{ fontSize: 11, color: '#64748B' }}>Alertes assurance/visite</div>
            </div>
          </div>
        </div>
        <div className="kpi-card">
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{ width: 40, height: 40, borderRadius: 10, background: 'rgba(22,163,74,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Activity size={20} color="#16A34A" />
            </div>
            <div>
              <div style={{ fontSize: 22, fontWeight: 800, color: '#16A34A' }}>{tauxUtilisation}%</div>
              <div style={{ fontSize: 11, color: '#64748B' }}>Taux d'utilisation</div>
            </div>
          </div>
        </div>
      </div>

      {/* Onglets */}
      <div className="tabs" style={{ marginBottom: 20 }}>
        {ONGLETS.map(o => (
          <button
            key={o.key}
            className={`tab-btn${onglet === o.key ? ' active' : ''}`}
            onClick={() => setOnglet(o.key)}
          >
            {o.label}
            {o.key === 'alertes' && alertesEnCours > 0 && (
              <span style={{ marginLeft: 6, background: 'var(--red)', color: '#fff', borderRadius: 20, fontSize: 9, fontWeight: 800, padding: '1px 6px' }}>{alertesEnCours}</span>
            )}
            {o.key === 'emprunts' && demandesEnAttente > 0 && (
              <span style={{ marginLeft: 6, background: '#F47920', color: '#fff', borderRadius: 20, fontSize: 9, fontWeight: 800, padding: '1px 6px' }}>{demandesEnAttente}</span>
            )}
          </button>
        ))}
      </div>

      {/* ── Parc auto ── */}
      {onglet === 'parc' && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px,1fr))', gap: 16 }}>
          {VEHICULES.map(v => (
            <div key={v.id} style={{
              background: '#fff', borderRadius: 12, padding: 18,
              boxShadow: '0 1px 4px rgba(0,0,0,0.07)',
              border: `1px solid ${v.statut === 'Hors service' ? '#FEE2E2' : '#E2E8F0'}`,
              opacity: v.statut === 'Hors service' ? 0.75 : 1,
            }}>
              {/* Header carte */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 14 }}>
                <div>
                  <div style={{ fontSize: 11, fontWeight: 700, color: '#64748B', fontFamily: 'monospace', marginBottom: 2 }}>{v.immatriculation}</div>
                  <div style={{ fontWeight: 800, fontSize: 15, color: 'var(--navy)' }}>{v.marque} {v.modele}</div>
                  <div style={{ fontSize: 11, color: '#64748B' }}>{v.annee} · {v.couleur} · {v.direction}</div>
                </div>
                <span className={statutPillClass(v.statut)}>{v.statut}</span>
              </div>

              {/* Données */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 12 }}>
                <div style={{ background: '#F8FAFC', borderRadius: 7, padding: '8px 10px' }}>
                  <div style={{ fontSize: 10, color: '#64748B', marginBottom: 2 }}>Km parcourus ce mois</div>
                  <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--navy)' }}>{v.kmCeMois.toLocaleString('fr-FR')} km</div>
                </div>
                <div style={{ background: '#F8FAFC', borderRadius: 7, padding: '8px 10px' }}>
                  <div style={{ fontSize: 10, color: '#64748B', marginBottom: 2 }}>Kilométrage total</div>
                  <div style={{ fontSize: 13, fontWeight: 700, color: '#374151' }}>{v.kmTotal.toLocaleString('fr-FR')} km</div>
                </div>
              </div>

              {/* Prochain entretien */}
              <div style={{ fontSize: 11, color: '#64748B', marginBottom: 4 }}>
                Prochain entretien : <strong style={{ color: 'var(--navy)' }}>à {v.prochainEntretienKm.toLocaleString('fr-FR')} km</strong>
                <span style={{ color: '#64748B' }}> ({(v.prochainEntretienKm - v.kmTotal).toLocaleString('fr-FR')} km restants)</span>
              </div>

              {/* Assurance */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 3 }}>
                {assuranceUrgent(v.assuranceJoursRestants) && (
                  <span style={{ width: 8, height: 8, borderRadius: '50%', background: v.assuranceJoursRestants <= 7 ? 'var(--red)' : 'var(--orange)', flexShrink: 0 }} />
                )}
                <span style={{ fontSize: 11, color: '#64748B' }}>
                  Assurance : <strong style={{ color: alerteColor(v.assuranceJoursRestants) }}>
                    {v.assuranceExpiration}
                    {v.assuranceJoursRestants < 0 ? ` (expirée)` : ` (${v.assuranceJoursRestants}j)`}
                  </strong>
                </span>
              </div>

              {/* Chauffeur */}
              {v.chauffeurAssigne && (
                <div style={{ fontSize: 11, color: '#64748B', marginTop: 4 }}>
                  Chauffeur : <strong style={{ color: '#1A1A2E' }}>{v.chauffeurAssigne}</strong>
                </div>
              )}

              {/* Badge assurance rouge si < 30j */}
              {assuranceUrgent(v.assuranceJoursRestants) && (
                <div style={{ marginTop: 10, padding: '6px 10px', background: '#FEE2E2', borderRadius: 6, fontSize: 11, fontWeight: 700, color: '#991B1B', display: 'flex', alignItems: 'center', gap: 6 }}>
                  <AlertTriangle size={12} />
                  Assurance : renouveler urgent
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* ── Carnet de bord ── */}
      {onglet === 'carnet' && (
        <div style={{ background: '#fff', borderRadius: 12, padding: 20, boxShadow: '0 1px 4px rgba(0,0,0,0.07)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16, flexWrap: 'wrap', gap: 10 }}>
            <h3 style={{ margin: 0, fontSize: 15, fontWeight: 700, color: 'var(--navy)' }}>Carnet de bord</h3>
            <div style={{ position: 'relative' }}>
              <select value={selectedVehicule} onChange={e => setSelectedVehicule(e.target.value)}
                style={{ padding: '8px 30px 8px 12px', border: '1px solid #E2E8F0', borderRadius: 8, fontSize: 13, fontFamily: 'inherit', appearance: 'none', background: '#F8FAFC', minWidth: 260 }}>
                {VEHICULES.filter(v => v.statut !== 'Hors service').map(v => (
                  <option key={v.id} value={v.id}>{v.immatriculation} — {v.marque} {v.modele}</option>
                ))}
              </select>
              <ChevronDown size={13} style={{ position: 'absolute', right: 9, top: '50%', transform: 'translateY(-50%)', color: '#64748B', pointerEvents: 'none' }} />
            </div>
          </div>

          {/* Info véhicule sélectionné */}
          {(() => {
            const v = VEHICULES.find(veh => veh.id === selectedVehicule);
            if (!v) return null;
            return (
              <div style={{ padding: '12px 16px', background: '#F8FAFC', borderRadius: 8, marginBottom: 16, display: 'flex', gap: 20, flexWrap: 'wrap' }}>
                <div><span style={{ fontSize: 11, color: '#64748B' }}>Km total : </span><strong style={{ color: 'var(--navy)' }}>{v.kmTotal.toLocaleString('fr-FR')} km</strong></div>
                <div><span style={{ fontSize: 11, color: '#64748B' }}>Ce mois : </span><strong style={{ color: 'var(--orange)' }}>{v.kmCeMois.toLocaleString('fr-FR')} km</strong></div>
                <div><span style={{ fontSize: 11, color: '#64748B' }}>Chauffeur : </span><strong>{v.chauffeurAssigne ?? 'Non assigné'}</strong></div>
                <div><span style={{ fontSize: 11, color: '#64748B' }}>Statut : </span><span className={statutPillClass(v.statut)}>{v.statut}</span></div>
              </div>
            );
          })()}

          <div style={{ overflowX: 'auto' }}>
            <table className="tbl">
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Chauffeur</th>
                  <th>Destination</th>
                  <th>Km départ</th>
                  <th>Km arrivée</th>
                  <th>Km parcourus</th>
                  <th>Conso (L)</th>
                  <th>L/100km</th>
                  <th className="hide-mobile">ODM</th>
                </tr>
              </thead>
              <tbody>
                {missionsVehicule.length === 0 ? (
                  <tr><td colSpan={9} style={{ textAlign: 'center', padding: 30, color: '#64748B', fontSize: 13 }}>Aucune mission enregistrée pour ce véhicule.</td></tr>
                ) : (
                  missionsVehicule.map(m => {
                    const km = m.kmArrivee - m.kmDepart;
                    const lPour100 = km > 0 ? Math.round((m.consommation / km) * 100 * 10) / 10 : 0;
                    return (
                      <tr key={m.id}>
                        <td style={{ fontSize: 12 }}>{m.date}</td>
                        <td style={{ fontSize: 12 }}>{m.chauffeur}</td>
                        <td style={{ fontSize: 12, fontWeight: 600 }}>{m.destination}</td>
                        <td style={{ textAlign: 'right', fontSize: 12 }}>{m.kmDepart.toLocaleString('fr-FR')}</td>
                        <td style={{ textAlign: 'right', fontSize: 12 }}>{m.kmArrivee.toLocaleString('fr-FR')}</td>
                        <td style={{ textAlign: 'right', fontWeight: 700 }}>{km} km</td>
                        <td style={{ textAlign: 'right' }}>{m.consommation} L</td>
                        <td style={{ textAlign: 'right', fontWeight: 800, color: consoColor(lPour100) }}>{lPour100} L/100</td>
                        <td className="hide-mobile" style={{ fontFamily: 'monospace', fontSize: 10, color: '#64748B' }}>{m.odmRef}</td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ── Chauffeurs par appartenance ── */}
      {onglet === 'chauffeurs' && <ChauffeursTab />}

      {/* ── Alertes & Maintenance ── */}
      {onglet === 'alertes' && (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, alignItems: 'start' }}>
          {/* Alertes en cours */}
          <div style={{ background: '#fff', borderRadius: 12, padding: 20, boxShadow: '0 1px 4px rgba(0,0,0,0.07)' }}>
            <h3 style={{ margin: '0 0 16px', fontSize: 15, fontWeight: 700, color: 'var(--navy)' }}>
              Alertes actives
              <span style={{ marginLeft: 10, background: alertesUrgentes > 0 ? 'var(--red)' : 'var(--orange)', color: '#fff', borderRadius: 20, fontSize: 11, fontWeight: 800, padding: '2px 8px' }}>{alertesEnCours}</span>
            </h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {alertes.map(a => {
                const v = VEHICULES.find(vh => vh.id === a.vehiculeId);
                return (
                  <div key={a.id} style={{
                    padding: '12px 14px', borderRadius: 8, background: '#F8FAFC', border: `1px solid ${a.statut === 'Critique' ? '#FEE2E2' : a.statut === 'Attention' ? '#FEF3C7' : '#DCFCE7'}`,
                    borderLeft: `4px solid ${a.statut === 'Critique' ? 'var(--red)' : a.statut === 'Attention' ? 'var(--orange)' : '#16A34A'}`,
                  }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 6 }}>
                      <div>
                        <span style={{ fontSize: 10, fontWeight: 700, background: '#F1F5F9', color: '#374151', borderRadius: 4, padding: '2px 7px', marginRight: 6 }}>{a.type}</span>
                        <span style={{ fontSize: 10, color: '#64748B' }}>{v?.immatriculation ?? a.vehiculeId}</span>
                      </div>
                      <span style={{ fontSize: 12, fontWeight: 800, color: alerteColor(a.joursRestants) }}>
                        {a.joursRestants < 0 ? `${Math.abs(a.joursRestants)}j dépassé` : `${a.joursRestants}j`}
                      </span>
                    </div>
                    <div style={{ fontSize: 12, color: '#374151', marginBottom: 8 }}>{a.description}</div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span style={{ fontSize: 11, color: '#64748B' }}>Échéance : <strong>{a.echeance}</strong></span>
                      <button onClick={() => traiterAlerte(a.id)}
                        style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '4px 10px', border: '1px solid #E2E8F0', borderRadius: 6, fontSize: 11, cursor: 'pointer', background: '#fff', fontFamily: 'inherit', color: '#374151' }}>
                        <CheckCircle size={11} /> Traiter
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Historique maintenances */}
          <div style={{ background: '#fff', borderRadius: 12, padding: 20, boxShadow: '0 1px 4px rgba(0,0,0,0.07)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
              <h3 style={{ margin: 0, fontSize: 15, fontWeight: 700, color: 'var(--navy)' }}>Historique maintenances</h3>
              <button className="btn-primary" style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12 }}
                onClick={() => setShowMaintForm(true)}>
                <Plus size={13} /> Ajouter
              </button>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              {maintenances.map(m => {
                const v = VEHICULES.find(vh => vh.id === m.vehiculeId);
                return (
                  <div key={m.id} style={{ padding: '12px 14px', background: '#F8FAFC', borderRadius: 8, border: '1px solid #E2E8F0' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 6 }}>
                      <div>
                        <div style={{ fontWeight: 700, fontSize: 13, color: 'var(--navy)', marginBottom: 2 }}>{m.type}</div>
                        <div style={{ fontSize: 11, color: '#64748B' }}>{v?.immatriculation ?? m.vehiculeId} · {m.date} · {m.km.toLocaleString('fr-FR')} km</div>
                      </div>
                      <div style={{ fontSize: 13, fontWeight: 800, color: 'var(--navy)', whiteSpace: 'nowrap' }}>
                        {m.cout.toLocaleString('fr-FR')} FCFA
                      </div>
                    </div>
                    <div style={{ fontSize: 11, color: '#374151', marginBottom: 4 }}>{m.description}</div>
                    <div style={{ fontSize: 10, color: '#64748B' }}>Prestataire : <strong>{m.prestataire}</strong></div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* ── Statistiques ── */}
      {onglet === 'stats' && (
        <div>
          {/* Mini KPIs stats */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px,1fr))', gap: 12, marginBottom: 20 }}>
            {[
              { label: 'Conso. moyenne L/100km', val: `${consoMoyenne} L/100`, color: 'var(--navy)' },
              { label: 'Coût moyen /km', val: '87 FCFA/km', color: 'var(--orange)' },
              { label: 'Taux utilisation moyen', val: `${tauxUtilisation}%`, color: '#16A34A' },
              { label: 'Total km (parc) / mois', val: `${VEHICULES.reduce((acc, v) => acc + v.kmCeMois, 0).toLocaleString('fr-FR')} km`, color: 'var(--navy)' },
            ].map(kpi => (
              <div key={kpi.label} className="kpi-card" style={{ padding: '14px 16px' }}>
                <div style={{ fontSize: 18, fontWeight: 800, color: kpi.color, marginBottom: 4 }}>{kpi.val}</div>
                <div style={{ fontSize: 11, color: '#64748B' }}>{kpi.label}</div>
              </div>
            ))}
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 16 }}>
            {/* BarChart consommation */}
            <div style={{ background: '#fff', borderRadius: 12, padding: 20, boxShadow: '0 1px 4px rgba(0,0,0,0.07)' }}>
              <h4 style={{ margin: '0 0 14px', fontSize: 13, fontWeight: 700, color: 'var(--navy)' }}>Consommation par véhicule (L/mois)</h4>
              <ResponsiveContainer width="100%" height={220}>
                <BarChart data={CONSO_PAR_VEHICULE} barCategoryGap="30%">
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#F1F5F9" />
                  <XAxis dataKey="vehicule" tick={{ fontSize: 9 }} />
                  <YAxis tick={{ fontSize: 10 }} unit=" L" />
                  <Tooltip formatter={(v: number) => `${v} L`} />
                  <Bar dataKey="consoMois" name="Conso (L)" fill="var(--navy)" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>

            {/* LineChart taux utilisation mensuel */}
            <div style={{ background: '#fff', borderRadius: 12, padding: 20, boxShadow: '0 1px 4px rgba(0,0,0,0.07)' }}>
              <h4 style={{ margin: '0 0 14px', fontSize: 13, fontWeight: 700, color: 'var(--navy)' }}>Taux utilisation mensuel (%)</h4>
              <ResponsiveContainer width="100%" height={220}>
                <LineChart data={STATS_MENSUELLES}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#F1F5F9" />
                  <XAxis dataKey="mois" tick={{ fontSize: 10 }} />
                  <YAxis tick={{ fontSize: 10 }} unit="%" domain={[0, 100]} />
                  <Tooltip formatter={(v: number) => `${v}%`} />
                  <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: 11 }} />
                  <Line type="monotone" dataKey="tauxDisponible" name="Disponible" stroke="#16A34A" strokeWidth={2} dot={{ r: 4 }} />
                  <Line type="monotone" dataKey="tauxMission" name="En mission" stroke="var(--orange)" strokeWidth={2} dot={{ r: 4 }} />
                  <Line type="monotone" dataKey="tauxMaintenance" name="Maintenance" stroke="var(--red)" strokeWidth={2} dot={{ r: 4 }} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Tableau ranking efficacité */}
          <div style={{ background: '#fff', borderRadius: 12, padding: 20, boxShadow: '0 1px 4px rgba(0,0,0,0.07)' }}>
            <h4 style={{ margin: '0 0 14px', fontSize: 13, fontWeight: 700, color: 'var(--navy)' }}>Ranking efficacité — Coût/km (FCFA)</h4>
            <div style={{ overflowX: 'auto' }}>
              <table className="tbl">
                <thead>
                  <tr>
                    <th>#</th>
                    <th>Véhicule</th>
                    <th>Conso (L/mois)</th>
                    <th>Budget carburant</th>
                    <th>Coût/km estimé</th>
                    <th>Efficacité</th>
                  </tr>
                </thead>
                <tbody>
                  {RANKING.map((v, i) => (
                    <tr key={v.vehicule}>
                      <td style={{ fontWeight: 700, color: i === 0 ? '#16A34A' : i === RANKING.length - 1 ? 'var(--red)' : '#374151', textAlign: 'center' }}>
                        {i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : i + 1}
                      </td>
                      <td style={{ fontWeight: 700, fontSize: 13 }}>{v.vehicule}</td>
                      <td style={{ textAlign: 'right' }}>{v.consoMois} L</td>
                      <td style={{ textAlign: 'right' }}>{v.budget.toLocaleString('fr-FR')} FCFA</td>
                      <td style={{ textAlign: 'right', fontWeight: 800, color: v.coutParKm < 90 ? '#16A34A' : v.coutParKm < 110 ? 'var(--orange)' : 'var(--red)' }}>
                        {v.coutParKm} FCFA/km
                      </td>
                      <td>
                        <div style={{ height: 6, background: '#F1F5F9', borderRadius: 3, overflow: 'hidden', minWidth: 80 }}>
                          <div style={{ height: '100%', width: `${Math.max(10, 100 - i * 15)}%`, background: i < 2 ? '#16A34A' : i < 4 ? 'var(--orange)' : 'var(--red)', borderRadius: 3 }} />
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ── Emprunts inter-UAGL ── */}
      {onglet === 'emprunts' && (
        <div>
          {/* Bandeau d'info */}
          <div style={{ background: '#EFF6FF', border: '1px solid #BFDBFE', borderRadius: 10, padding: '12px 16px', marginBottom: 18, display: 'flex', alignItems: 'flex-start', gap: 12 }}>
            <ArrowRightLeft size={18} color="#1D4ED8" style={{ flexShrink: 0, marginTop: 1 }} />
            <div style={{ fontSize: 13, color: '#1E40AF', lineHeight: 1.6 }}>
              <strong>Prêt de ressources entre UAGLs</strong> — Consultez ici les véhicules et chauffeurs disponibles dans les autres unités.
              Envoyez une demande d'emprunt directement à l'UAGL concerné. Les prêts sont soumis à validation par le responsable de l'UAGL source.
            </div>
          </div>

          {/* Filtre UAGL */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16, flexWrap: 'wrap' }}>
            <span style={{ fontSize: 12, fontWeight: 700, color: '#64748B' }}>Filtrer par UAGL :</span>
            {['tous', 'UAGL/DEP', 'UAGL/DIT', 'UAGL/DGC'].map(u => (
              <button key={u} onClick={() => setFiltreUagl(u)} style={{
                padding: '4px 12px', borderRadius: 20, fontSize: 12, fontWeight: 600, cursor: 'pointer',
                border: '1px solid', fontFamily: 'inherit',
                background: filtreUagl === u ? (UAGL_COLORS[u] ?? '#0E3460') : '#fff',
                color: filtreUagl === u ? '#fff' : '#64748B',
                borderColor: filtreUagl === u ? (UAGL_COLORS[u] ?? '#0E3460') : '#E2E8F0',
              }}>
                {u === 'tous' ? 'Toutes les UAGLs' : u}
              </button>
            ))}
          </div>

          {/* Grille des ressources disponibles */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px,1fr))', gap: 14, marginBottom: 28 }}>
            {RESSOURCES_UAGLS
              .filter(r => filtreUagl === 'tous' || r.uaglCode === filtreUagl)
              .map(r => (
                <div key={r.id} style={{ background: '#fff', borderRadius: 12, padding: 16, boxShadow: '0 1px 4px rgba(0,0,0,0.07)', border: '1px solid #E2E8F0' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 10 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                      <div style={{ width: 36, height: 36, borderRadius: 9, background: r.type === 'vehicule' ? 'rgba(14,52,96,0.08)' : 'rgba(22,163,74,0.10)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                        {r.type === 'vehicule' ? <Truck size={17} color="var(--navy)" /> : <User size={17} color="#16A34A" />}
                      </div>
                      <div>
                        <div style={{ fontWeight: 800, fontSize: 13.5, color: '#0F172A' }}>{r.nom}</div>
                        <div style={{ fontSize: 11, color: '#64748B', marginTop: 1 }}>{r.details}</div>
                      </div>
                    </div>
                    <span className="pill pill-ok">Disponible</span>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', paddingTop: 10, borderTop: '1px solid #F1F5F9' }}>
                    <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6, background: `${UAGL_COLORS[r.uaglCode]}15`, padding: '3px 9px', borderRadius: 20 }}>
                      <div style={{ width: 7, height: 7, borderRadius: '50%', background: UAGL_COLORS[r.uaglCode] }} />
                      <span style={{ fontSize: 10.5, fontWeight: 700, color: UAGL_COLORS[r.uaglCode] }}>{r.uaglCode}</span>
                    </div>
                    <button onClick={() => setEmpruntModal(r)} style={{
                      display: 'flex', alignItems: 'center', gap: 6, padding: '6px 12px',
                      background: 'var(--navy, #0E3460)', color: '#fff', border: 'none',
                      borderRadius: 7, fontSize: 11.5, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit',
                    }}>
                      <Send size={12} /> Demander
                    </button>
                  </div>
                </div>
              ))}
          </div>

          {/* Mes demandes */}
          <div style={{ background: '#fff', borderRadius: 12, padding: 18, boxShadow: '0 1px 4px rgba(0,0,0,0.07)' }}>
            <div style={{ fontWeight: 800, fontSize: 14, color: '#0F172A', marginBottom: 14, display: 'flex', alignItems: 'center', gap: 8 }}>
              <Clock size={15} color="#64748B" /> Mes demandes d'emprunt
              {demandes.length > 0 && <span style={{ fontSize: 11, color: '#64748B', fontWeight: 400 }}>({demandes.length})</span>}
            </div>
            {demandes.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '20px 0', color: '#94A3B8', fontSize: 13 }}>
                Aucune demande envoyée pour l'instant.
              </div>
            ) : (
              <table className="tbl">
                <thead>
                  <tr>
                    <th>Ressource</th>
                    <th>UAGL source</th>
                    <th>Période</th>
                    <th>Motif</th>
                    <th>Statut</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  {demandes.map(d => (
                    <tr key={d.id}>
                      <td style={{ fontWeight: 600 }}>{d.ressourceNom}</td>
                      <td>{d.uaglSource}</td>
                      <td style={{ fontSize: 12, color: '#64748B' }}>{d.dateDebut} → {d.dateFin}</td>
                      <td style={{ maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontSize: 12 }}>{d.motif}</td>
                      <td>
                        <span className={`pill ${d.statut === 'Approuvée' ? 'pill-ok' : d.statut === 'Refusée' ? 'pill-ko' : 'pill-warn'}`}>
                          {d.statut}
                        </span>
                      </td>
                      <td>
                        {d.statut === 'En attente' && (
                          <button onClick={() => setDemandes(prev => prev.filter(x => x.id !== d.id))}
                            style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#94A3B8', padding: 4 }}>
                            <X size={14} />
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>
      )}

      {/* Modal demande d'emprunt */}
      {empruntModal && (
        <EmpruntModal
          ressource={empruntModal}
          onClose={() => setEmpruntModal(null)}
          onEnvoyer={(d) => {
            setDemandes(prev => [d, ...prev]);
            setEmpruntModal(null);
            toast.success(`Demande envoyée à ${d.uaglSource}`);
          }}
        />
      )}

      {showMaintForm && (
        <MaintenanceForm
          vehicules={VEHICULES}
          onClose={() => setShowMaintForm(false)}
          onSave={ajouterMaintenance}
        />
      )}

      <style>{`
        .tabs { display: flex; gap: 4px; flex-wrap: wrap; border-bottom: 2px solid #E2E8F0; }
        .tab-btn { padding: 9px 18px; font-size: 13px; font-weight: 600; border: none; background: transparent; cursor: pointer; font-family: inherit; color: #64748B; border-bottom: 2px solid transparent; margin-bottom: -2px; transition: all 0.15s; border-radius: 6px 6px 0 0; display: flex; align-items: center; }
        .tab-btn:hover { background: #F8FAFC; color: var(--navy); }
        .tab-btn.active { color: var(--navy); border-bottom-color: var(--orange); font-weight: 700; }
        .kpi-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(200px,1fr)); gap: 14px; }
        .kpi-card { background: #fff; border-radius: 12px; padding: 18px 20px; box-shadow: 0 1px 4px rgba(0,0,0,0.07); }
        .tbl { width: 100%; border-collapse: collapse; }
        .tbl th { text-align: left; font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.5px; color: #64748B; padding: 8px 10px; border-bottom: 1px solid #E2E8F0; white-space: nowrap; }
        .tbl td { padding: 9px 10px; font-size: 13px; border-bottom: 1px solid #F1F5F9; vertical-align: middle; }
        .tbl tbody tr:hover { background: #F8FAFC; }
        .pill { display: inline-flex; align-items: center; padding: 2px 9px; border-radius: 20px; font-size: 10px; font-weight: 700; }
        .pill-ok { background: #DCFCE7; color: #166534; }
        .pill-warn { background: #FEF3C7; color: #92400E; }
        .pill-ko { background: #FEE2E2; color: #991B1B; }
        .pill-info { background: #DBEAFE; color: #1D4ED8; }
        .pill-neutral { background: #F1F5F9; color: #374151; }
        .btn-primary { display: inline-flex; align-items: center; gap: 6px; padding: 8px 16px; background: var(--navy, #0E3460); color: #fff; border: none; border-radius: 8px; font-weight: 700; font-size: 13px; cursor: pointer; font-family: inherit; transition: opacity 0.15s; }
        .btn-primary:hover { opacity: 0.88; }
        @media (max-width: 768px) { .hide-mobile { display: none !important; } }
      `}</style>
    </div>
  );
}

/* ─── Formulaire d'ajout de maintenance ─────────────────────────────────────── */
function MaintenanceForm({ vehicules, onClose, onSave }: {
  vehicules: Vehicule[];
  onClose: () => void;
  onSave: (m: MaintenanceHisto) => void;
}) {
  const [vehiculeId, setVehiculeId] = useState(vehicules[0]?.id ?? '');
  const [type, setType] = useState('');
  const [prestataire, setPrestataire] = useState('');
  const [km, setKm] = useState('');
  const [cout, setCout] = useState('');
  const [description, setDescription] = useState('');

  const valid = vehiculeId && type.trim() && prestataire.trim();

  const submit = () => {
    if (!valid) return;
    onSave({
      id: `MNT-${Date.now()}`,
      vehiculeId,
      date: new Date().toLocaleDateString('fr-FR'),
      type: type.trim(),
      prestataire: prestataire.trim(),
      km: parseInt(km.replace(/\s/g, ''), 10) || 0,
      cout: parseInt(cout.replace(/\s/g, ''), 10) || 0,
      description: description.trim(),
    });
  };

  const field: React.CSSProperties = { width: '100%', padding: '8px 10px', border: '1px solid #E2E8F0', borderRadius: 7, fontSize: 13, fontFamily: 'inherit', marginTop: 4 };
  const lbl: React.CSSProperties = { fontSize: 11, fontWeight: 700, color: '#475569' };

  return (
    <div onClick={onClose} style={{ position: 'fixed', inset: 0, zIndex: 300, background: 'rgba(15,23,42,0.45)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
      <div onClick={e => e.stopPropagation()} style={{ background: '#fff', borderRadius: 12, width: 'min(480px, 100%)', maxHeight: '90vh', overflowY: 'auto', boxShadow: '0 20px 60px rgba(0,0,0,0.25)' }}>
        <div style={{ padding: '14px 18px', borderBottom: '1px solid #F1F5F9', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h3 style={{ margin: 0, fontSize: 15, fontWeight: 700, color: 'var(--navy)' }}>Nouvelle maintenance</h3>
          <button onClick={onClose} style={{ border: 'none', background: 'none', cursor: 'pointer', color: '#64748B' }}><X size={18} /></button>
        </div>
        <div style={{ padding: 18, display: 'flex', flexDirection: 'column', gap: 12 }}>
          <label style={lbl}>Véhicule *
            <select value={vehiculeId} onChange={e => setVehiculeId(e.target.value)} style={field}>
              {vehicules.map(v => <option key={v.id} value={v.id}>{v.immatriculation} — {v.marque} {v.modele}</option>)}
            </select>
          </label>
          <label style={lbl}>Type d'intervention *
            <input value={type} onChange={e => setType(e.target.value)} placeholder="Vidange, freins, pneus…" style={field} />
          </label>
          <label style={lbl}>Prestataire *
            <input value={prestataire} onChange={e => setPrestataire(e.target.value)} placeholder="Garage / atelier" style={field} />
          </label>
          <div style={{ display: 'flex', gap: 12 }}>
            <label style={{ ...lbl, flex: 1 }}>Kilométrage
              <input value={km} onChange={e => setKm(e.target.value)} inputMode="numeric" placeholder="0" style={field} />
            </label>
            <label style={{ ...lbl, flex: 1 }}>Coût (FCFA)
              <input value={cout} onChange={e => setCout(e.target.value)} inputMode="numeric" placeholder="0" style={field} />
            </label>
          </div>
          <label style={lbl}>Description
            <textarea value={description} onChange={e => setDescription(e.target.value)} rows={3} style={{ ...field, resize: 'vertical' }} />
          </label>
        </div>
        <div style={{ padding: '12px 18px', borderTop: '1px solid #F1F5F9', display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
          <button onClick={onClose} style={{ padding: '8px 16px', borderRadius: 7, border: '1px solid #E2E8F0', background: '#fff', fontSize: 13, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' }}>Annuler</button>
          <button onClick={submit} disabled={!valid} className="btn-primary" style={{ opacity: valid ? 1 : 0.5, cursor: valid ? 'pointer' : 'not-allowed' }}>Enregistrer</button>
        </div>
      </div>
    </div>
  );
}

/* ─── Chauffeurs par appartenance (configurable) ──────────────────────────── */
function ChauffeursTab() {
  const { chauffeurs, addChauffeur, updateChauffeur, removeChauffeur } = useOdmConfig();
  const [search, setSearch] = useState('');
  const [filtreApp, setFiltreApp] = useState<string>('tous');
  const [nom, setNom] = useState('');
  const [app, setApp] = useState(DPE_ORG[0]?.code ?? 'DER');
  const [permis, setPermis] = useState('B');

  const filtered = chauffeurs.filter(c =>
    (filtreApp === 'tous' || c.appartenance === filtreApp) &&
    (!search || c.nom.toLowerCase().includes(search.toLowerCase())),
  );
  // Groupement par appartenance
  const groups = Array.from(new Set(filtered.map(c => c.appartenance))).map(code => ({
    code,
    label: getDirectionLabel(code) || code,
    list: filtered.filter(c => c.appartenance === code),
  }));

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      {/* Barre d'ajout */}
      <div className="card">
        <div className="card-header"><span className="card-title"><User size={14} /> Ajouter un chauffeur</span></div>
        <div className="card-body" style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'flex-end' }}>
          <div style={{ flex: 2, minWidth: 180 }}>
            <label style={{ fontSize: 10, fontWeight: 700, color: '#64748B', textTransform: 'uppercase' }}>Nom complet</label>
            <input value={nom} onChange={e => setNom(e.target.value)} placeholder="Prénom NOM" className="form-input" style={{ width: '100%' }} />
          </div>
          <div style={{ flex: 2, minWidth: 180 }}>
            <label style={{ fontSize: 10, fontWeight: 700, color: '#64748B', textTransform: 'uppercase' }}>Appartenance (unité)</label>
            <select value={app} onChange={e => setApp(e.target.value)} className="form-input" style={{ width: '100%' }}>
              {DPE_ORG.map(d => <option key={d.code} value={d.code}>{d.shortLabel} — {d.label}</option>)}
            </select>
          </div>
          <div style={{ flex: 1, minWidth: 100 }}>
            <label style={{ fontSize: 10, fontWeight: 700, color: '#64748B', textTransform: 'uppercase' }}>Permis</label>
            <input value={permis} onChange={e => setPermis(e.target.value)} placeholder="B, C" className="form-input" style={{ width: '100%' }} />
          </div>
          <button className="btn-primary" disabled={!nom.trim()} style={{ opacity: nom.trim() ? 1 : 0.5 }}
            onClick={() => { addChauffeur(nom, app, permis); setNom(''); setPermis('B'); toast.success('Chauffeur ajouté'); }}>
            <Plus size={14} /> Ajouter
          </button>
        </div>
      </div>

      {/* Filtres */}
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
        <input value={search} onChange={e => setSearch(e.target.value)} placeholder="🔍 Rechercher un chauffeur…" className="form-input" style={{ maxWidth: 260 }} />
        <select value={filtreApp} onChange={e => setFiltreApp(e.target.value)} className="form-input" style={{ maxWidth: 260 }}>
          <option value="tous">Toutes les unités</option>
          {DPE_ORG.map(d => <option key={d.code} value={d.code}>{d.shortLabel} — {d.label}</option>)}
        </select>
        <span style={{ fontSize: 12, color: '#64748B', marginLeft: 'auto' }}>{filtered.length} chauffeur(s)</span>
      </div>

      {/* Groupes par appartenance */}
      {groups.length === 0 ? (
        <div style={{ textAlign: 'center', padding: 40, color: '#94A3B8' }}>Aucun chauffeur pour ce filtre.</div>
      ) : groups.map(g => (
        <div key={g.code} className="card">
          <div className="card-header">
            <span className="card-title">🏢 {g.label}</span>
            <span style={{ fontSize: 10, color: 'var(--muted)' }}>{g.list.length} chauffeur(s)</span>
          </div>
          <div style={{ overflowX: 'auto' }}>
            <table className="tbl">
              <thead><tr><th style={{ minWidth: 160 }}>Nom</th><th>Permis</th><th>Téléphone</th><th style={{ textAlign: 'center' }}>Actif</th><th style={{ textAlign: 'center' }}>Suppr.</th></tr></thead>
              <tbody>
                {g.list.map(c => (
                  <tr key={c.id}>
                    <td><input value={c.nom} onChange={e => updateChauffeur(c.id, { nom: e.target.value })} className="form-input" style={{ width: '100%', fontSize: 12 }} /></td>
                    <td><input value={c.permis} onChange={e => updateChauffeur(c.id, { permis: e.target.value })} className="form-input" style={{ width: 80, fontSize: 12 }} /></td>
                    <td><input value={c.telephone ?? ''} onChange={e => updateChauffeur(c.id, { telephone: e.target.value })} placeholder="77 …" className="form-input" style={{ width: 130, fontSize: 12 }} /></td>
                    <td style={{ textAlign: 'center' }}>
                      <input type="checkbox" checked={c.actif} onChange={e => updateChauffeur(c.id, { actif: e.target.checked })} />
                    </td>
                    <td style={{ textAlign: 'center' }}>
                      <button className="btn btn-ghost btn-xs" title="Supprimer" onClick={() => { if (confirm(`Supprimer ${c.nom} ?`)) { removeChauffeur(c.id); toast.success('Chauffeur supprimé'); } }} style={{ color: 'var(--red)' }}><Trash2 size={12} /></button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ))}
    </div>
  );
}

/* ─── Modal demande d'emprunt ────────────────────────────────────────────────── */
function EmpruntModal({ ressource, onClose, onEnvoyer }: {
  ressource: RessourceUagl;
  onClose: () => void;
  onEnvoyer: (d: DemandeEmprunt) => void;
}) {
  const [dateDebut, setDateDebut] = useState('');
  const [dateFin, setDateFin] = useState('');
  const [motif, setMotif] = useState('');
  const [odmRef, setOdmRef] = useState('');

  const valid = dateDebut.length > 0 && dateFin.length > 0 && motif.trim().length > 0;

  const submit = () => {
    if (!valid) return;
    onEnvoyer({
      id: `DE-${Date.now()}`,
      ressourceId: ressource.id,
      ressourceNom: ressource.nom,
      uaglSource: ressource.uaglCode,
      dateDebut,
      dateFin,
      motif: motif.trim(),
      odmRef: odmRef.trim(),
      statut: 'En attente',
    });
  };

  const field: React.CSSProperties = { width: '100%', padding: '8px 10px', border: '1px solid #E2E8F0', borderRadius: 7, fontSize: 13, fontFamily: 'inherit', marginTop: 4, boxSizing: 'border-box' };
  const lbl: React.CSSProperties = { fontSize: 11, fontWeight: 700, color: '#475569', display: 'block' };

  return (
    <div onClick={onClose} style={{ position: 'fixed', inset: 0, zIndex: 300, background: 'rgba(15,23,42,0.45)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
      <div onClick={e => e.stopPropagation()} style={{ background: '#fff', borderRadius: 14, width: 'min(500px, 100%)', maxHeight: '92vh', overflowY: 'auto', boxShadow: '0 20px 60px rgba(0,0,0,0.25)' }}>
        <div style={{ padding: '14px 18px', borderBottom: '1px solid #F1F5F9', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <div style={{ fontSize: 15, fontWeight: 800, color: 'var(--navy)' }}>Demande d'emprunt</div>
            <div style={{ fontSize: 11.5, color: '#64748B', marginTop: 2 }}>Auprès de {ressource.uaglCode} — {ressource.uaglLabel}</div>
          </div>
          <button onClick={onClose} style={{ border: 'none', background: 'none', cursor: 'pointer', color: '#64748B' }}><X size={18} /></button>
        </div>
        <div style={{ margin: '14px 18px 0', background: '#F8FAFC', borderRadius: 9, padding: '10px 14px', display: 'flex', alignItems: 'center', gap: 12 }}>
          <div style={{ width: 36, height: 36, borderRadius: 9, background: ressource.type === 'vehicule' ? 'rgba(14,52,96,0.08)' : 'rgba(22,163,74,0.10)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
            {ressource.type === 'vehicule' ? <Truck size={16} color="var(--navy)" /> : <User size={16} color="#16A34A" />}
          </div>
          <div>
            <div style={{ fontWeight: 700, fontSize: 13.5, color: '#0F172A' }}>{ressource.nom}</div>
            <div style={{ fontSize: 11.5, color: '#64748B' }}>{ressource.details}</div>
          </div>
        </div>
        <div style={{ padding: '14px 18px', display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div style={{ display: 'flex', gap: 12 }}>
            <label style={{ ...lbl, flex: 1 }}>
              Date de début *
              <input type="date" value={dateDebut} onChange={e => setDateDebut(e.target.value)} style={field} />
            </label>
            <label style={{ ...lbl, flex: 1 }}>
              Date de fin *
              <input type="date" value={dateFin} onChange={e => setDateFin(e.target.value)} style={field} />
            </label>
          </div>
          <label style={lbl}>
            Motif de la demande *
            <textarea value={motif} onChange={e => setMotif(e.target.value)} rows={3}
              placeholder="Décrivez l'objet de la mission justifiant l'emprunt…"
              style={{ ...field, resize: 'vertical' }} />
          </label>
          <label style={lbl}>
            Référence ODM (si disponible)
            <input value={odmRef} onChange={e => setOdmRef(e.target.value)} placeholder="ODM-DER-2026-XXX" style={field} />
          </label>
        </div>
        <div style={{ padding: '12px 18px', borderTop: '1px solid #F1F5F9', display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
          <button onClick={onClose} style={{ padding: '8px 16px', borderRadius: 7, border: '1px solid #E2E8F0', background: '#fff', fontSize: 13, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' }}>Annuler</button>
          <button onClick={submit} disabled={!valid} className="btn-primary" style={{ opacity: valid ? 1 : 0.5, cursor: valid ? 'pointer' : 'not-allowed' }}>
            <Send size={13} /> Envoyer la demande
          </button>
        </div>
      </div>
    </div>
  );
}

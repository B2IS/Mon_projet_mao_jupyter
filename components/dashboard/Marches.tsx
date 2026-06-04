'use client';

import { useState, useMemo } from 'react';
import { X, ChevronUp, ChevronDown, Star, CheckCircle, Circle, Clock, AlertCircle, FileText, Send, Plus, Pencil, Trash2, SlidersHorizontal, Settings, ArrowUp, ArrowDown, RotateCcw } from 'lucide-react';
import { useCriteriaStore } from '@/lib/criteriaStore';
import { useDecompteCircuit } from '@/lib/decompteCircuitStore';
import { useAuth } from '@/lib/authStore';
import { computeVisibilityScope, type UserOrgProfile } from '@/lib/accessEngine';
import { canonDirectionKey } from '@/lib/dpeOrgStructure';

// ── Types ────────────────────────────────────────────────────────────────────

type StatutMarche = 'en_cours' | 'termine' | 'resilie';
type TypeMarche   = 'Travaux' | 'Services' | 'Fournitures';

interface Avenant {
  id: string;
  numero: number;
  objet: string;
  montant: number;
  delaiJours: number;
  date: string;
}

interface Penalite {
  id: string;
  date: string;
  motif: string;
  montant: number;
}

interface Garantie {
  type: 'Caution de bonne exécution' | 'Retenue de garantie' | 'Avance de démarrage';
  montant: number;
  echeance: string;
  statut: 'valide' | 'a_renouveler' | 'expiree';
}

interface Marche {
  id: string;
  reference: string;
  objet: string;
  entreprise: string;
  montantHT: number;
  dateSignature: string;
  dateFin: string;
  avancement: number;
  statut: StatutMarche;
  direction: string;
  type: TypeMarche;
  bailleur: string;
  avenants: Avenant[];
  penalites: Penalite[];
  garanties: Garantie[];
  observations?: string;
}

interface ANOMarche {
  id: string;
  ref: string;
  projet: string;
  type: string;
  dateEnvoi: string;
  slaBailleur: number;
  joursEcoules: number;
  statut: 'en_attente' | 'recu' | 'expire';
}

interface Fournisseur {
  id: string;
  nom: string;
  note: number;
  nbMarches: number;
  tauxLivraison: number;
  contentieux: number;
}

/* ── Circuit décomptes / factures (CDC §18 — 5 étapes) ──────────────────── */

type EtapeDecompte = 'depot' | 'controle_technique' | 'validation_admin' | 'validation_finance' | 'transmission_erp';
type StatutEtape   = 'pending' | 'en_cours' | 'valide' | 'rejete';

interface EtapeCircuit {
  etape:     EtapeDecompte;
  label:     string;
  responsable: string;
  dateDebut?: string;
  dateFin?:  string;
  statut:    StatutEtape;
  commentaire?: string;
}

interface Decompte {
  id:         string;
  numero:     string;
  marcheRef:  string;
  entreprise: string;
  montant:    number;
  dateDepot:  string;
  periodicite: string;
  etapes:     EtapeCircuit[];
  statut:     'en_circuit' | 'valide' | 'rejete' | 'transmis_erp';
}

const ETAPES_LABELS: Record<EtapeDecompte, string> = {
  depot:                'Dépôt',
  controle_technique:   'Contrôle technique',
  validation_admin:     'Validation admin.',
  validation_finance:   'Validation finance',
  transmission_erp:     'Transmission ERP',
};

function makeCircuit(d: Omit<Decompte, 'etapes'>): Decompte {
  return d as Decompte; // etapes set below
}

const DECOMPTES_INIT: Decompte[] = [
  {
    id: 'd1', numero: 'DEC-DER-2024-001-004',
    marcheRef: 'MRK-DER-2024-001', entreprise: 'ELEC AFRIQUE SARL',
    montant: 38_400_000, dateDepot: '05/05/2026', periodicite: 'Mensuel',
    statut: 'en_circuit',
    etapes: [
      { etape: 'depot',               label: 'Dépôt',                  responsable: 'Secrétariat DER',    dateDebut: '05/05/2026', dateFin: '05/05/2026', statut: 'valide' },
      { etape: 'controle_technique',  label: 'Contrôle technique',     responsable: 'Ingénieur DER',      dateDebut: '06/05/2026', dateFin: '12/05/2026', statut: 'valide' },
      { etape: 'validation_admin',    label: 'Validation admin.',       responsable: 'Chef DER',           dateDebut: '13/05/2026', dateFin: '15/05/2026', statut: 'valide' },
      { etape: 'validation_finance',  label: 'Validation finance',      responsable: 'DCAF',               dateDebut: '16/05/2026', statut: 'en_cours' },
      { etape: 'transmission_erp',    label: 'Transmission ERP',        responsable: 'DSI / SAP',          statut: 'pending' },
    ],
  },
  {
    id: 'd2', numero: 'DEC-CC26-2024-003-002',
    marcheRef: 'MRK-CC26-2024-003', entreprise: 'TRACTEBEL ENGINEERING SA',
    montant: 315_000_000, dateDepot: '01/04/2026', periodicite: 'Trimestriel',
    statut: 'valide',
    etapes: [
      { etape: 'depot',               label: 'Dépôt',                  responsable: 'Secrétariat CC26',   dateDebut: '01/04/2026', dateFin: '01/04/2026', statut: 'valide' },
      { etape: 'controle_technique',  label: 'Contrôle technique',     responsable: 'Ingénieur CC26',     dateDebut: '02/04/2026', dateFin: '08/04/2026', statut: 'valide' },
      { etape: 'validation_admin',    label: 'Validation admin.',       responsable: 'Chef CC26',          dateDebut: '09/04/2026', dateFin: '11/04/2026', statut: 'valide' },
      { etape: 'validation_finance',  label: 'Validation finance',      responsable: 'DCAF',               dateDebut: '12/04/2026', dateFin: '18/04/2026', statut: 'valide' },
      { etape: 'transmission_erp',    label: 'Transmission ERP',        responsable: 'DSI / SAP',          dateDebut: '19/04/2026', dateFin: '19/04/2026', statut: 'valide', commentaire: 'OD comptable générée — réf. OD-2026-0412' },
    ],
  },
  {
    id: 'd3', numero: 'DEC-CPADERAU-2024-001-002',
    marcheRef: 'MRK-CPADERAU-2024-001', entreprise: 'EFACEC ENERGY SPA',
    montant: 637_500_000, dateDepot: '15/05/2026', periodicite: 'Mensuel',
    statut: 'en_circuit',
    etapes: [
      { etape: 'depot',               label: 'Dépôt',                  responsable: 'Secrétariat CPADERAU', dateDebut: '15/05/2026', dateFin: '15/05/2026', statut: 'valide' },
      { etape: 'controle_technique',  label: 'Contrôle technique',     responsable: 'Ingénieur CPADERAU',   dateDebut: '16/05/2026', statut: 'en_cours', commentaire: 'Vérification métrés en cours' },
      { etape: 'validation_admin',    label: 'Validation admin.',       responsable: 'Chef CPADERAU',        statut: 'pending' },
      { etape: 'validation_finance',  label: 'Validation finance',      responsable: 'DCAF',                 statut: 'pending' },
      { etape: 'transmission_erp',    label: 'Transmission ERP',        responsable: 'DSI / SAP',            statut: 'pending' },
    ],
  },
  {
    id: 'd4', numero: 'DEC-DEP-2023-001-008',
    marcheRef: 'MRK-DEP-2023-001', entreprise: 'GE POWER AFRICA',
    montant: 510_000_000, dateDepot: '10/05/2026', periodicite: 'Mensuel',
    statut: 'rejete',
    etapes: [
      { etape: 'depot',               label: 'Dépôt',                  responsable: 'Secrétariat DEP',    dateDebut: '10/05/2026', dateFin: '10/05/2026', statut: 'valide' },
      { etape: 'controle_technique',  label: 'Contrôle technique',     responsable: 'Ingénieur DEP',      dateDebut: '11/05/2026', dateFin: '17/05/2026', statut: 'rejete', commentaire: 'Situation des travaux incomplète — taux avancement non justifié' },
      { etape: 'validation_admin',    label: 'Validation admin.',       responsable: 'Chef DEP',           statut: 'pending' },
      { etape: 'validation_finance',  label: 'Validation finance',      responsable: 'DCAF',               statut: 'pending' },
      { etape: 'transmission_erp',    label: 'Transmission ERP',        responsable: 'DSI / SAP',          statut: 'pending' },
    ],
  },
  {
    id: 'd5', numero: 'DEC-DIT-2023-002-005',
    marcheRef: 'MRK-DIT-2023-002', entreprise: 'LANDIS+GYR AFRICA',
    montant: 157_500_000, dateDepot: '20/04/2026', periodicite: 'Mensuel',
    statut: 'transmis_erp',
    etapes: [
      { etape: 'depot',               label: 'Dépôt',                  responsable: 'Secrétariat DIT',    dateDebut: '20/04/2026', dateFin: '20/04/2026', statut: 'valide' },
      { etape: 'controle_technique',  label: 'Contrôle technique',     responsable: 'Ingénieur DIT',      dateDebut: '21/04/2026', dateFin: '25/04/2026', statut: 'valide' },
      { etape: 'validation_admin',    label: 'Validation admin.',       responsable: 'Chef DIT',           dateDebut: '26/04/2026', dateFin: '27/04/2026', statut: 'valide' },
      { etape: 'validation_finance',  label: 'Validation finance',      responsable: 'DCAF',               dateDebut: '28/04/2026', dateFin: '02/05/2026', statut: 'valide' },
      { etape: 'transmission_erp',    label: 'Transmission ERP',        responsable: 'DSI / SAP',          dateDebut: '03/05/2026', dateFin: '03/05/2026', statut: 'valide', commentaire: 'OD-2026-0389 — mandaté SENELEC' },
    ],
  },
];

// ── Mock data ─────────────────────────────────────────────────────────────────

const MARCHES_INIT: Marche[] = [
  {
    id: 'm1', reference: 'MRK-DER-2024-001',
    objet: 'Fourniture & Pose câbles HTA/BT — 19 localités Thiès',
    entreprise: 'ELEC AFRIQUE SARL', montantHT: 320_000_000,
    dateSignature: '15/07/2024', dateFin: '31/12/2025',
    avancement: 42, statut: 'en_cours', direction: 'DER', type: 'Fournitures', bailleur: 'AFD',
    avenants: [
      { id: 'av1', numero: 1, objet: 'Prolongation délai — contraintes terrain saison des pluies', montant: 0, delaiJours: 60, date: '10/10/2024' },
    ],
    penalites: [],
    garanties: [
      { type: 'Caution de bonne exécution', montant: 32_000_000, echeance: '31/01/2026', statut: 'valide' },
      { type: 'Retenue de garantie',        montant: 16_000_000, echeance: '31/06/2026', statut: 'valide' },
    ],
  },
  {
    id: 'm2', reference: 'MRK-DER-2024-002',
    objet: 'Fourniture transformateurs 160 kVA × 38 unités',
    entreprise: 'ABB SENEGAL SA', montantHT: 155_000_000,
    dateSignature: '20/07/2024', dateFin: '30/04/2025',
    avancement: 100, statut: 'termine', direction: 'DER', type: 'Fournitures', bailleur: 'AFD',
    avenants: [],
    penalites: [],
    garanties: [
      { type: 'Retenue de garantie', montant: 7_750_000, echeance: '30/04/2026', statut: 'a_renouveler' },
    ],
  },
  {
    id: 'm3', reference: 'MRK-CC26-2024-003',
    objet: 'Ingénierie & supervision travaux ligne 225 kV Tobène–Thiès–Hann',
    entreprise: 'TRACTEBEL ENGINEERING SA', montantHT: 4_200_000_000,
    dateSignature: '15/03/2024', dateFin: '31/12/2026',
    avancement: 28, statut: 'en_cours', direction: 'CC26', type: 'Services', bailleur: 'MCA',
    avenants: [
      { id: 'av2', numero: 1, objet: 'Extension délai mobilisation équipes expatriées', montant: 0, delaiJours: 45, date: '10/06/2024' },
    ],
    penalites: [],
    garanties: [
      { type: 'Caution de bonne exécution', montant: 210_000_000, echeance: '31/01/2027', statut: 'valide' },
    ],
    observations: 'Retard délivrance visas expatriés — plan de rattrapage validé le 15/04/2026.',
  },
  {
    id: 'm4', reference: 'MRK-CPADERAU-2024-001',
    objet: 'Fourniture & pose réseau HTA/BT PADERAU zones 2-3',
    entreprise: 'EFACEC ENERGY SPA', montantHT: 8_500_000_000,
    dateSignature: '20/06/2024', dateFin: '31/07/2026',
    avancement: 15, statut: 'en_cours', direction: 'CPADERAU', type: 'Travaux', bailleur: 'AFD',
    avenants: [],
    penalites: [
      { id: 'p1', date: '02/04/2026', motif: 'Retard approvisionnement conducteurs ACSR — 45 jours', montant: 85_000_000 },
    ],
    garanties: [
      { type: 'Caution de bonne exécution', montant: 850_000_000, echeance: '31/08/2026', statut: 'valide' },
      { type: 'Avance de démarrage',        montant: 1_275_000_000, echeance: '31/12/2025', statut: 'expiree' },
    ],
    observations: 'Retard approvisionnement conducteurs ACSR. Plan de rattrapage soumis le 15/04/2026.',
  },
  {
    id: 'm5', reference: 'MRK-DEP-2023-001',
    objet: 'Réhabilitation & maintenance turbines TAG 1-2 Cap des Biches',
    entreprise: 'GE POWER AFRICA', montantHT: 6_800_000_000,
    dateSignature: '01/02/2023', dateFin: '30/06/2025',
    avancement: 95, statut: 'en_cours', direction: 'DEP', type: 'Services', bailleur: 'BM',
    avenants: [
      { id: 'av3', numero: 1, objet: 'Extension phase 2 — inspection complete GE 7FA', montant: 320_000_000, delaiJours: 90, date: '15/11/2024' },
    ],
    penalites: [],
    garanties: [
      { type: 'Caution de bonne exécution', montant: 680_000_000, echeance: '30/09/2025', statut: 'a_renouveler' },
    ],
  },
  {
    id: 'm6', reference: 'MRK-DIT-2023-002',
    objet: 'Déploiement 45 000 compteurs AMI Linky-type — Dakar Plateau',
    entreprise: 'LANDIS+GYR AFRICA', montantHT: 2_100_000_000,
    dateSignature: '01/09/2023', dateFin: '30/09/2025',
    avancement: 68, statut: 'en_cours', direction: 'DIT', type: 'Fournitures', bailleur: 'BOAD',
    avenants: [],
    penalites: [
      { id: 'p2', date: '15/03/2026', motif: 'Retard livraison lot 3 — 30 jours', montant: 42_000_000 },
    ],
    garanties: [
      { type: 'Caution de bonne exécution', montant: 210_000_000, echeance: '31/10/2025', statut: 'valide' },
    ],
  },
  {
    id: 'm7', reference: 'MRK-DGC-2024-001',
    objet: 'Construction siège régional SENELEC — Saint-Louis',
    entreprise: 'SABER CONSTRUCTION SARL', montantHT: 1_850_000_000,
    dateSignature: '10/04/2024', dateFin: '10/04/2026',
    avancement: 35, statut: 'en_cours', direction: 'DGC', type: 'Travaux', bailleur: 'SENELEC',
    avenants: [],
    penalites: [
      { id: 'p3', date: '12/05/2026', motif: 'Retard gros œuvre — 25 jours', montant: 18_500_000 },
    ],
    garanties: [
      { type: 'Caution de bonne exécution', montant: 185_000_000, echeance: '10/05/2026', statut: 'expiree' },
    ],
    observations: 'Retard obtention permis construire zone inondable. Dossier en cours DUA.',
  },
  {
    id: 'm8', reference: 'MRK-CPBM-2022-001',
    objet: 'Audit financier consolidé PASE — exercices 2023-2024',
    entreprise: 'KPMG SÉNÉGAL', montantHT: 85_000_000,
    dateSignature: '01/03/2022', dateFin: '31/03/2025',
    avancement: 100, statut: 'termine', direction: 'CPBM-UE', type: 'Services', bailleur: 'BM',
    avenants: [],
    penalites: [],
    garanties: [],
  },
];

const ANOS_MARCHES: ANOMarche[] = [
  { id: 'a1', ref: 'ANO-BM-2026-041',  projet: 'PRJ-CC26-2023-002',   type: 'DAO',        dateEnvoi: '02/05/2026', slaBailleur: 21, joursEcoules: 22, statut: 'expire'    },
  { id: 'a2', ref: 'ANO-AFD-2026-018', projet: 'PRJ-DER-2024-001',    type: 'Évaluation', dateEnvoi: '10/05/2026', slaBailleur: 15, joursEcoules: 14, statut: 'en_attente' },
  { id: 'a3', ref: 'ANO-MCA-2026-007', projet: 'PRJ-CC26-2023-002',   type: 'Avenant',    dateEnvoi: '14/05/2026', slaBailleur: 10, joursEcoules: 10, statut: 'recu'       },
  { id: 'a4', ref: 'ANO-BAD-2026-012', projet: 'PRJ-DIT-2023-001',    type: 'DAO',        dateEnvoi: '18/05/2026', slaBailleur: 21, joursEcoules:  6, statut: 'en_attente' },
  { id: 'a5', ref: 'ANO-BM-2026-044',  projet: 'PRJ-CPBM-2022-001',   type: 'Évaluation', dateEnvoi: '20/05/2026', slaBailleur: 15, joursEcoules:  4, statut: 'en_attente' },
];

const FOURNISSEURS: Fournisseur[] = [
  { id: 'f1', nom: 'GE POWER AFRICA',          note: 4.5, nbMarches: 3, tauxLivraison: 96, contentieux: 0 },
  { id: 'f2', nom: 'TRACTEBEL ENGINEERING SA',  note: 4.2, nbMarches: 2, tauxLivraison: 91, contentieux: 0 },
  { id: 'f3', nom: 'EFACEC ENERGY SPA',         note: 3.1, nbMarches: 2, tauxLivraison: 72, contentieux: 1 },
  { id: 'f4', nom: 'SABER CONSTRUCTION SARL',   note: 2.8, nbMarches: 4, tauxLivraison: 68, contentieux: 1 },
  { id: 'f5', nom: 'LANDIS+GYR AFRICA',         note: 3.6, nbMarches: 1, tauxLivraison: 83, contentieux: 0 },
];

// ── Helpers ───────────────────────────────────────────────────────────────────

function fmtM(n: number): string {
  if (n >= 1e9) return (n / 1e9).toFixed(2) + ' Md';
  if (n >= 1e6) return (n / 1e6).toFixed(0) + ' M';
  return n.toLocaleString('fr-FR');
}

const STATUT_CFG: Record<StatutMarche, { label: string; pill: string }> = {
  en_cours: { label: 'En cours',  pill: 'pill-warn' },
  termine:  { label: 'Terminé',   pill: 'pill-ok'   },
  resilie:  { label: 'Résilié',   pill: 'pill-ko'   },
};

const DIRECTIONS_LIST = ['Tous', 'DEP', 'DER', 'DIT', 'DGC', 'CC26', 'CPBM-UE', 'CPADERAU', 'CPAMACEL'];
const STATUTS_LIST:    (StatutMarche | 'Tous')[] = ['Tous', 'en_cours', 'termine', 'resilie'];
const TYPES_LIST:      (TypeMarche  | 'Tous')[]  = ['Tous', 'Travaux', 'Services', 'Fournitures'];
const BAILLEURS_LIST = ['Tous', 'BM', 'AFD', 'BAD', 'MCA', 'KfW', 'BOAD', 'SENELEC'];

function Stars({ note }: { note: number }) {
  return (
    <span style={{ display: 'inline-flex', gap: 1 }}>
      {[1, 2, 3, 4, 5].map(i => (
        <Star key={i} size={11} fill={i <= Math.round(note) ? '#F39200' : 'none'} color={i <= Math.round(note) ? '#F39200' : '#CBD5E1'} />
      ))}
      <span style={{ marginLeft: 4, fontSize: 10, color: 'var(--muted)', fontWeight: 600 }}>{note.toFixed(1)}</span>
    </span>
  );
}

// ── Detail panel ──────────────────────────────────────────────────────────────

function MarchePanel({ marche, onClose }: { marche: Marche; onClose: () => void }) {
  const totalPenalites = marche.penalites.reduce((s, p) => s + p.montant, 0);
  const montantAvenants = marche.avenants.reduce((s, a) => s + a.montant, 0);
  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 200, background: 'rgba(14,52,96,0.65)',
      display: 'flex', justifyContent: 'flex-end', alignItems: 'stretch',
    }}>
      <div style={{
        width: '100%', maxWidth: 680, background: 'var(--bg-card)',
        display: 'flex', flexDirection: 'column', overflowY: 'auto',
        boxShadow: 'var(--shadow-lg)',
      }}>
        {/* Header */}
        <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--border-2)', background: 'var(--navy)', color: '#fff', flexShrink: 0 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <div>
              <div style={{ fontSize: 10, fontWeight: 700, color: 'rgba(255,255,255,0.65)', letterSpacing: '0.08em', marginBottom: 4 }}>
                {marche.reference} · {marche.type} · {marche.direction}
              </div>
              <div style={{ fontSize: 15, fontWeight: 800, lineHeight: 1.3 }}>{marche.objet}</div>
              <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.75)', marginTop: 4 }}>{marche.entreprise}</div>
            </div>
            <button onClick={onClose} style={{ padding: 8, borderRadius: 8, background: 'rgba(255,255,255,0.15)', border: 'none', cursor: 'pointer', color: '#fff', display: 'flex', flexShrink: 0, marginLeft: 12 }}>
              <X size={16} />
            </button>
          </div>
          <div style={{ display: 'flex', gap: 8, marginTop: 12, flexWrap: 'wrap' }}>
            <span className={`pill ${STATUT_CFG[marche.statut].pill}`}>{STATUT_CFG[marche.statut].label}</span>
            <span className="pill pill-info">{marche.bailleur}</span>
          </div>
        </div>

        <div style={{ padding: '16px 20px', display: 'flex', flexDirection: 'column', gap: 16 }}>
          {/* KPIs financiers */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 10 }}>
            {[
              { label: 'Montant HTVA',      value: fmtM(marche.montantHT),                 color: 'var(--navy)'  },
              { label: 'Montant avenants',  value: fmtM(montantAvenants),                   color: 'var(--amber)' },
              { label: 'Pénalités',         value: totalPenalites > 0 ? fmtM(totalPenalites) : '—', color: 'var(--red)' },
            ].map((k, i) => (
              <div key={i} style={{ padding: '10px 12px', background: 'var(--bg)', borderRadius: 8, textAlign: 'center', border: '1px solid var(--border-2)' }}>
                <div style={{ fontSize: 9, color: 'var(--muted)', marginBottom: 3, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.07em' }}>{k.label}</div>
                <div style={{ fontSize: 17, fontWeight: 800, color: k.color }}>{k.value}</div>
              </div>
            ))}
          </div>

          {/* Avancement */}
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
              <span style={{ fontSize: 11, color: 'var(--muted)', fontWeight: 600 }}>AVANCEMENT PHYSIQUE</span>
              <span style={{ fontSize: 15, fontWeight: 800, color: marche.avancement >= 70 ? 'var(--green)' : 'var(--orange)' }}>{marche.avancement}%</span>
            </div>
            <div className="progress-bar" style={{ height: 8 }}>
              <div className="progress-fill" style={{
                width: `${marche.avancement}%`,
                background: marche.avancement >= 70 ? 'var(--green)' : 'var(--orange)',
              }} />
            </div>
            <div style={{ display: 'flex', gap: 16, marginTop: 8, fontSize: 11, color: 'var(--muted)' }}>
              <span>Signé : <strong style={{ color: 'var(--text)' }}>{marche.dateSignature}</strong></span>
              <span>Fin prévue : <strong style={{ color: 'var(--text)' }}>{marche.dateFin}</strong></span>
            </div>
          </div>

          {/* Avenants */}
          <div className="card">
            <div className="card-header">
              <span className="card-title">Avenants ({marche.avenants.length})</span>
            </div>
            <div className="card-body">
              {marche.avenants.length === 0 ? (
                <p style={{ fontSize: 12, color: 'var(--muted)', textAlign: 'center', padding: '12px 0' }}>Aucun avenant</p>
              ) : marche.avenants.map(av => (
                <div key={av.id} style={{ padding: '8px 10px', background: 'var(--bg)', borderRadius: 6, border: '1px solid var(--border-2)', marginBottom: 6 }}>
                  <div style={{ fontWeight: 700, fontSize: 12, color: 'var(--navy)', marginBottom: 3 }}>Avenant n°{av.numero} — {av.date}</div>
                  <div style={{ fontSize: 12, color: 'var(--text-2)' }}>{av.objet}</div>
                  <div style={{ fontSize: 10, color: 'var(--muted)', marginTop: 3 }}>
                    {av.montant > 0 && <span style={{ marginRight: 10 }}>+ {fmtM(av.montant)} FCFA</span>}
                    {av.delaiJours > 0 && <span>+ {av.delaiJours} jours</span>}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Pénalités */}
          {marche.penalites.length > 0 && (
            <div className="card">
              <div className="card-header">
                <span className="card-title">Pénalités appliquées</span>
                <span className="pill pill-ko">{fmtM(totalPenalites)} FCFA</span>
              </div>
              <div className="card-body">
                {marche.penalites.map(p => (
                  <div key={p.id} style={{ padding: '8px 10px', background: 'var(--red-light)', borderRadius: 6, border: '1px solid rgba(226,35,26,0.20)', marginBottom: 6 }}>
                    <div style={{ fontWeight: 700, fontSize: 11, color: 'var(--red)', marginBottom: 2 }}>{p.date} — {fmtM(p.montant)} FCFA</div>
                    <div style={{ fontSize: 11, color: 'var(--text-2)' }}>{p.motif}</div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Garanties */}
          {marche.garanties.length > 0 && (
            <div className="card">
              <div className="card-header">
                <span className="card-title">Garanties</span>
              </div>
              <div className="card-body" style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                {marche.garanties.map((g, i) => (
                  <div key={i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '7px 10px', background: 'var(--bg)', borderRadius: 6, border: '1px solid var(--border-2)' }}>
                    <div>
                      <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--navy)' }}>{g.type}</div>
                      <div style={{ fontSize: 10, color: 'var(--muted)' }}>Échéance : {g.echeance}</div>
                    </div>
                    <div style={{ textAlign: 'right' }}>
                      <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--navy)' }}>{fmtM(g.montant)}</div>
                      <span className={`pill ${g.statut === 'valide' ? 'pill-ok' : g.statut === 'a_renouveler' ? 'pill-warn' : 'pill-ko'}`} style={{ marginTop: 3 }}>
                        {g.statut === 'valide' ? 'Valide' : g.statut === 'a_renouveler' ? 'À renouveler' : 'Expirée'}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Observations */}
          {marche.observations && (
            <div className="banner banner-warn" style={{ fontSize: 12 }}>
              <strong>Observations :</strong> {marche.observations}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

export default function Marches() {
  const supplierCriteres = useCriteriaStore(s => s.supplier);
  const { isRole, user } = useAuth();
  const canEditCircuit = isRole('DIR_DPE', 'PMO', 'CTRL_FIN', 'ADMIN');
  // Périmètre MMH : un profil ne voit que les marchés de SA direction (pas DEP/DIT/DGC… pour un DER).
  const marcheScope = useMemo(() => {
    if (!user) return { all: false, dirs: new Set<string>() };
    const profile: UserOrgProfile = { role: user.role, direction: user.direction, departement: user.departement, cellule: user.cellule, poste: user.poste };
    const s = computeVisibilityScope(profile);
    if (s.all || s.directions.includes('*')) return { all: true, dirs: new Set<string>() };
    return { all: false, dirs: new Set(s.directions.map(d => canonDirectionKey(d))) };
  }, [user]);
  const circuit = useDecompteCircuit(s => s.circuit);
  const [showCircuitConfig, setShowCircuitConfig] = useState(false);
  const [marches,      setMarches]      = useState<Marche[]>(MARCHES_INIT);
  const [decomptes,    setDecomptes]    = useState<Decompte[]>(DECOMPTES_INIT);
  const [filterStatut, setFilterStatut] = useState<StatutMarche | 'Tous'>('Tous');
  const [filterDir,    setFilterDir]    = useState('Tous');
  const [filterType,   setFilterType]   = useState<TypeMarche | 'Tous'>('Tous');
  const [filterBailleur, setFilterBailleur] = useState('Tous');
  const [sortCol,      setSortCol]      = useState<keyof Marche>('dateSignature');
  const [sortAsc,      setSortAsc]      = useState(false);
  const [selected,     setSelected]     = useState<Marche | null>(null);
  const [activeTab,    setActiveTab]    = useState<'marches' | 'decomptes' | 'anos' | 'fournisseurs'>('marches');
  const [selectedDec,  setSelectedDec]  = useState<Decompte | null>(null);
  const [editing,      setEditing]      = useState<Marche | null>(null); // marché en édition
  const [showForm,     setShowForm]     = useState(false);

  // ── CRUD marchés ──
  function saveMarche(m: Marche) {
    setMarches(prev => prev.some(x => x.id === m.id)
      ? prev.map(x => x.id === m.id ? m : x)
      : [...prev, m]);
    setShowForm(false); setEditing(null);
  }
  function deleteMarche(id: string) {
    if (!confirm('Supprimer définitivement ce marché ?')) return;
    setMarches(prev => prev.filter(m => m.id !== id));
  }
  function openCreate() { setEditing(null); setShowForm(true); }
  function openEdit(m: Marche) { setEditing(m); setShowForm(true); }

  // ── Mutations circuit décompte (remplacent les alerts) ──
  function advanceDecompte(decId: string) {
    setDecomptes(prev => prev.map(d => {
      if (d.id !== decId) return d;
      const idx = d.etapes.findIndex(e => e.statut === 'en_cours');
      if (idx === -1) return d;
      const today = new Date().toLocaleDateString('fr-FR');
      const etapes = d.etapes.map((e, i) =>
        i === idx ? { ...e, statut: 'valide' as StatutEtape, dateFin: today }
        : i === idx + 1 ? { ...e, statut: 'en_cours' as StatutEtape, dateDebut: today }
        : e);
      const allOk = etapes.every(e => e.statut === 'valide');
      return { ...d, etapes, statut: allOk ? 'valide' : d.statut };
    }));
  }
  function rejectDecompte(decId: string) {
    setDecomptes(prev => prev.map(d => {
      if (d.id !== decId) return d;
      const idx = d.etapes.findIndex(e => e.statut === 'en_cours');
      const etapes = idx === -1 ? d.etapes : d.etapes.map((e, i) => i === idx ? { ...e, statut: 'rejete' as StatutEtape } : e);
      return { ...d, etapes, statut: 'rejete' };
    }));
  }
  function transmitDecompte(decId: string) {
    setDecomptes(prev => prev.map(d => {
      if (d.id !== decId) return d;
      const today = new Date().toLocaleDateString('fr-FR');
      const etapes = d.etapes.map(e => e.etape === 'transmission_erp'
        ? { ...e, statut: 'valide' as StatutEtape, dateDebut: today, dateFin: today, commentaire: 'OD comptable générée — transmise ERP' }
        : e);
      return { ...d, etapes, statut: 'transmis_erp' };
    }));
  }

  const filtered = useMemo(() => {
    let rows = [...marches];
    // 0) Périmètre MMH par direction (sauf super-rôles / vision globale).
    if (!marcheScope.all) rows = rows.filter(m => marcheScope.dirs.has(canonDirectionKey(m.direction)));
    if (filterStatut   !== 'Tous') rows = rows.filter(m => m.statut    === filterStatut);
    if (filterDir      !== 'Tous') rows = rows.filter(m => m.direction === filterDir);
    if (filterType     !== 'Tous') rows = rows.filter(m => m.type      === filterType);
    if (filterBailleur !== 'Tous') rows = rows.filter(m => m.bailleur  === filterBailleur);
    rows.sort((a, b) => {
      const av = a[sortCol] as string | number;
      const bv = b[sortCol] as string | number;
      if (typeof av === 'number' && typeof bv === 'number') return sortAsc ? av - bv : bv - av;
      return sortAsc ? String(av).localeCompare(String(bv)) : String(bv).localeCompare(String(av));
    });
    return rows;
  }, [marches, marcheScope, filterStatut, filterDir, filterType, filterBailleur, sortCol, sortAsc]);

  function toggleSort(col: keyof Marche) {
    if (sortCol === col) setSortAsc(v => !v);
    else { setSortCol(col); setSortAsc(false); }
  }

  function SortIcon({ col }: { col: keyof Marche }) {
    if (sortCol !== col) return null;
    return sortAsc ? <ChevronUp size={11} /> : <ChevronDown size={11} />;
  }

  // KPIs globaux
  const kpis = {
    total:     marches.length,
    actifs:    marches.filter(m => m.statut === 'en_cours').length,
    avenants:  marches.reduce((s, m) => s + m.avenants.length, 0),
    penalites: marches.filter(m => m.penalites.length > 0).length,
    garanties60j: marches.flatMap(m => m.garanties).filter(g => g.statut === 'a_renouveler').length,
    anos: ANOS_MARCHES.filter(a => a.statut === 'en_attente').length,
  };

  return (
    <div className="page-content">

      {/* ── KPIs ─────────────────────────────────────────────────────────── */}
      <div className="kpi-grid" style={{ gridTemplateColumns: 'repeat(5,1fr)' }}>
        <div className="kpi-card navy">
          <div className="kpi-label">Marchés actifs</div>
          <div className="kpi-value">{kpis.actifs}</div>
          <div className="kpi-sub">{kpis.total} marchés au total</div>
        </div>
        <div className="kpi-card amber">
          <div className="kpi-label">Avenants en cours</div>
          <div className="kpi-value amber">{kpis.avenants}</div>
          <div className="kpi-sub">tous marchés confondus</div>
        </div>
        <div className="kpi-card red">
          <div className="kpi-label">Pénalités appliquées</div>
          <div className="kpi-value red">{kpis.penalites}</div>
          <div className="kpi-sub">marchés concernés</div>
        </div>
        <div className="kpi-card" style={{ borderLeftColor: 'var(--purple)' }}>
          <div className="kpi-label">Garanties à renouveler</div>
          <div className="kpi-value" style={{ color: 'var(--purple)' }}>{kpis.garanties60j}</div>
          <div className="kpi-sub">cautions / retenues</div>
        </div>
        <div className="kpi-card" style={{ borderLeftColor: 'var(--blue)' }}>
          <div className="kpi-label">ANOs en attente</div>
          <div className="kpi-value blue">{kpis.anos}</div>
          <div className="kpi-sub">avis bailleurs</div>
        </div>
      </div>

      {/* ── Onglets ───────────────────────────────────────────────────────── */}
      <div style={{ display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap' }}>
        <div className="tabs">
          {(['marches', 'decomptes', 'anos', 'fournisseurs'] as const).map(t => (
            <button key={t} className={`tab${activeTab === t ? ' active' : ''}`} onClick={() => setActiveTab(t)}>
              {t === 'marches' ? '📋 Liste marchés' : t === 'decomptes' ? '🧾 Circuit décomptes' : t === 'anos' ? '📝 ANOs' : '⭐ Scoring fournisseurs'}
            </button>
          ))}
        </div>
      </div>

      {/* ── MARCHÉS ──────────────────────────────────────────────────────── */}
      {activeTab === 'marches' && (
        <>
          {/* Filtres */}
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
            <select className="form-input" value={filterStatut} onChange={e => setFilterStatut(e.target.value as StatutMarche | 'Tous')}>
              {STATUTS_LIST.map(s => <option key={s} value={s}>{s === 'Tous' ? 'Tous statuts' : STATUT_CFG[s as StatutMarche]?.label ?? s}</option>)}
            </select>
            <select className="form-input" value={filterDir} onChange={e => setFilterDir(e.target.value)}>
              {DIRECTIONS_LIST.map(d => <option key={d} value={d}>{d === 'Tous' ? 'Toutes directions' : d}</option>)}
            </select>
            <select className="form-input" value={filterType} onChange={e => setFilterType(e.target.value as TypeMarche | 'Tous')}>
              {TYPES_LIST.map(t => <option key={t} value={t}>{t === 'Tous' ? 'Tous types' : t}</option>)}
            </select>
            <select className="form-input" value={filterBailleur} onChange={e => setFilterBailleur(e.target.value)}>
              {BAILLEURS_LIST.map(b => <option key={b} value={b}>{b === 'Tous' ? 'Tous bailleurs' : b}</option>)}
            </select>
            <span style={{ fontSize: 11, color: 'var(--muted)', marginLeft: 'auto' }}>{filtered.length} marchés</span>
            <button className="btn btn-primary btn-xs" style={{ display: 'flex', alignItems: 'center', gap: 4 }} onClick={openCreate}>
              <Plus size={13} /> Nouveau marché
            </button>
          </div>

          <div className="card">
            <div style={{ overflowX: 'auto' }}>
              <table className="tbl">
                <thead>
                  <tr>
                    <th onClick={() => toggleSort('reference')} style={{ cursor: 'pointer' }}>Référence <SortIcon col="reference" /></th>
                    <th onClick={() => toggleSort('objet')} style={{ cursor: 'pointer' }}>Objet <SortIcon col="objet" /></th>
                    <th className="hide-mobile" onClick={() => toggleSort('entreprise')} style={{ cursor: 'pointer' }}>Entreprise <SortIcon col="entreprise" /></th>
                    <th onClick={() => toggleSort('montantHT')} style={{ cursor: 'pointer', textAlign: 'right' }}>Montant HTVA <SortIcon col="montantHT" /></th>
                    <th className="hide-mobile" onClick={() => toggleSort('dateSignature')} style={{ cursor: 'pointer' }}>Signature <SortIcon col="dateSignature" /></th>
                    <th className="hide-mobile" onClick={() => toggleSort('dateFin')} style={{ cursor: 'pointer' }}>Date fin <SortIcon col="dateFin" /></th>
                    <th style={{ textAlign: 'right' }}>Avancement</th>
                    <th>Statut</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map(m => {
                    const cfg = STATUT_CFG[m.statut];
                    return (
                      <tr key={m.id}>
                        <td style={{ fontWeight: 700, color: 'var(--navy)', fontSize: 10, whiteSpace: 'nowrap' }}>{m.reference}</td>
                        <td style={{ maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontSize: 12 }}
                          title={m.objet}>{m.objet}</td>
                        <td className="hide-mobile" style={{ fontSize: 11 }}>{m.entreprise}</td>
                        <td style={{ textAlign: 'right', fontWeight: 700, whiteSpace: 'nowrap' }}>{fmtM(m.montantHT)}</td>
                        <td className="hide-mobile" style={{ whiteSpace: 'nowrap', fontSize: 11 }}>{m.dateSignature}</td>
                        <td className="hide-mobile" style={{ whiteSpace: 'nowrap', fontSize: 11 }}>{m.dateFin}</td>
                        <td style={{ textAlign: 'right' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 6, justifyContent: 'flex-end' }}>
                            <div className="progress-bar" style={{ width: 50 }}>
                              <div className="progress-fill" style={{
                                width: `${m.avancement}%`,
                                background: m.avancement >= 70 ? 'var(--green)' : m.avancement >= 40 ? 'var(--orange)' : 'var(--red)',
                              }} />
                            </div>
                            <span style={{ fontWeight: 700, fontSize: 11, color: m.avancement >= 70 ? 'var(--green)' : 'var(--amber)' }}>
                              {m.avancement}%
                            </span>
                          </div>
                        </td>
                        <td><span className={`pill ${cfg.pill}`}>{cfg.label}</span></td>
                        <td>
                          <div style={{ display: 'flex', gap: 4 }}>
                            <button className="btn btn-ghost btn-xs" onClick={() => setSelected(m)}>Détail</button>
                            <button className="btn btn-ghost btn-xs hide-mobile" title="Modifier" onClick={() => openEdit(m)}><Pencil size={12} /></button>
                            <button className="btn btn-ghost btn-xs" title="Supprimer" style={{ color: 'var(--red)' }} onClick={() => deleteMarche(m.id)}><Trash2 size={12} /></button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
              {filtered.length === 0 && (
                <div style={{ textAlign: 'center', padding: '32px 0', color: 'var(--muted)', fontSize: 12 }}>Aucun marché correspondant aux filtres</div>
              )}
            </div>
          </div>
        </>
      )}

      {/* ── ANOs ─────────────────────────────────────────────────────────── */}
      {activeTab === 'anos' && (
        <div className="card">
          <div className="card-header">
            <span className="card-title">Suivi ANOs — Avis Non-Objection bailleurs</span>
            <span className="pill pill-warn">{ANOS_MARCHES.filter(a => a.statut === 'en_attente').length} en cours</span>
          </div>
          <div style={{ overflowX: 'auto' }}>
            <table className="tbl">
              <thead>
                <tr>
                  <th>Réf ANO</th>
                  <th>Projet</th>
                  <th>Type</th>
                  <th>Date envoi</th>
                  <th style={{ textAlign: 'right' }}>SLA bailleur</th>
                  <th style={{ textAlign: 'right' }}>Jours restants</th>
                  <th>Statut</th>
                </tr>
              </thead>
              <tbody>
                {ANOS_MARCHES.map(a => {
                  const restant = a.slaBailleur - a.joursEcoules;
                  const isExpire = a.statut === 'expire' || restant < 0;
                  const ageColor = a.statut === 'recu' ? 'var(--green)' : isExpire ? 'var(--red)' : restant <= 3 ? 'var(--red)' : restant <= 7 ? 'var(--amber)' : 'var(--green)';
                  return (
                    <tr key={a.id}>
                      <td style={{ fontWeight: 700, color: 'var(--navy)', fontSize: 10 }}>{a.ref}</td>
                      <td style={{ fontSize: 11 }} className="hide-mobile">{a.projet}</td>
                      <td><span className="pill pill-info">{a.type}</span></td>
                      <td className="hide-mobile">{a.dateEnvoi}</td>
                      <td style={{ textAlign: 'right' }}>{a.slaBailleur} j</td>
                      <td style={{ textAlign: 'right', fontWeight: 700, color: ageColor }}>
                        {a.statut === 'recu'
                          ? '—'
                          : isExpire
                            ? `Dépassé +${Math.abs(restant)}j`
                            : `J-${restant}`}
                      </td>
                      <td>
                        {a.statut === 'recu'      && <span className="pill pill-ok">Reçu</span>}
                        {a.statut === 'en_attente' && <span className="pill pill-warn">En attente</span>}
                        {a.statut === 'expire'     && <span className="pill pill-ko">Expiré</span>}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ── SCORING FOURNISSEURS ─────────────────────────────────────────── */}
      {activeTab === 'fournisseurs' && (
        <div className="card">
          <div className="card-header">
            <span className="card-title">Scoring fournisseurs — Top 5 titulaires</span>
          </div>
          {/* Grille de notation paramétrée (gouvernance DPE/PMO/Admin via Administration › Critères & Scoring) */}
          <div style={{ padding: '12px 16px', borderBottom: '1px solid var(--border, #E2E8F0)', background: '#F8FAFC' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 8 }}>
              <SlidersHorizontal size={13} color="#F47920" />
              <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--navy, #1B4F8A)' }}>Grille de notation pondérée</span>
              <span style={{ fontSize: 10, color: 'var(--muted)' }}>· paramétrable dans Administration › Critères &amp; Scoring</span>
            </div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
              {supplierCriteres.map(c => (
                <span key={c.id} style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 10.5, padding: '3px 8px', borderRadius: 6, background: '#fff', border: '1px solid #E2E8F0' }}>
                  {c.label}
                  <b style={{ color: '#F47920' }}>{c.poids}%</b>
                </span>
              ))}
            </div>
          </div>
          <div style={{ overflowX: 'auto' }}>
            <table className="tbl">
              <thead>
                <tr>
                  <th>#</th>
                  <th>Entreprise</th>
                  <th>Note globale</th>
                  <th style={{ textAlign: 'right' }}>Nb marchés</th>
                  <th style={{ textAlign: 'right' }}>Taux livraison</th>
                  <th style={{ textAlign: 'right' }}>Contentieux</th>
                </tr>
              </thead>
              <tbody>
                {[...FOURNISSEURS].sort((a, b) => b.note - a.note).map((f, i) => (
                  <tr key={f.id}>
                    <td style={{ fontWeight: 700, color: 'var(--muted)', fontSize: 11 }}>{i + 1}</td>
                    <td style={{ fontWeight: 600 }}>{f.nom}</td>
                    <td><Stars note={f.note} /></td>
                    <td style={{ textAlign: 'right', fontWeight: 600 }}>{f.nbMarches}</td>
                    <td style={{ textAlign: 'right' }}>
                      <span style={{ fontWeight: 700, color: f.tauxLivraison >= 90 ? 'var(--green)' : f.tauxLivraison >= 75 ? 'var(--amber)' : 'var(--red)' }}>
                        {f.tauxLivraison}%
                      </span>
                    </td>
                    <td style={{ textAlign: 'right' }}>
                      {f.contentieux > 0
                        ? <span className="pill pill-ko">{f.contentieux}</span>
                        : <span className="pill pill-ok">0</span>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ── CIRCUIT DÉCOMPTES / FACTURES (CDC §18) ───────────────────────── */}
      {activeTab === 'decomptes' && (
        <>
          {/* KPI strip */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 10 }}>
            {[
              { label: 'Décomptes en circuit', value: decomptes.filter(d => d.statut === 'en_circuit').length, color: '#F37021' },
              { label: 'Validés (en attente ERP)', value: decomptes.filter(d => d.statut === 'valide').length, color: '#1B4F8A' },
              { label: 'Transmis ERP', value: decomptes.filter(d => d.statut === 'transmis_erp').length, color: '#16A34A' },
              { label: 'Rejetés', value: decomptes.filter(d => d.statut === 'rejete').length, color: '#EF3340' },
            ].map(k => (
              <div key={k.label} style={{ background: 'var(--bg-card)', borderRadius: 10, padding: '12px 16px', borderLeft: `4px solid ${k.color}`, boxShadow: 'var(--shadow)' }}>
                <div style={{ fontSize: 10, color: 'var(--muted)', fontWeight: 600, marginBottom: 4, textTransform: 'uppercase', letterSpacing: '0.07em' }}>{k.label}</div>
                <div style={{ fontSize: 26, fontWeight: 800, color: k.color }}>{k.value}</div>
              </div>
            ))}
          </div>

          {/* Référentiel du circuit — paramétrable */}
          <CircuitReference
            circuit={circuit}
            canEdit={canEditCircuit}
            open={showCircuitConfig}
            onToggle={() => setShowCircuitConfig(v => !v)}
          />

          {/* Circuit diagram header */}
          <div className="card">
            <div className="card-header">
              <span className="card-title">Circuit de traitement — {circuit.length} étape{circuit.length > 1 ? 's' : ''} (CDC §18)</span>
              <div style={{ display: 'flex', alignItems: 'center', gap: 16, fontSize: 10, color: 'var(--muted)' }}>
                {[
                  { label: 'Validé', color: '#16A34A' },
                  { label: 'En cours', color: '#F37021' },
                  { label: 'En attente', color: '#94A3B8' },
                  { label: 'Rejeté', color: '#EF3340' },
                ].map(s => (
                  <span key={s.label} style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                    <span style={{ width: 8, height: 8, borderRadius: '50%', background: s.color, display: 'inline-block' }} />
                    {s.label}
                  </span>
                ))}
              </div>
            </div>

            {/* Décomptes list */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
              {decomptes.map((dec, idx) => {
                const statutDec: Record<Decompte['statut'], { label: string; pill: string }> = {
                  en_circuit:    { label: 'En circuit',    pill: 'pill-warn' },
                  valide:        { label: 'Validé',        pill: 'pill-ok'   },
                  rejete:        { label: 'Rejeté',        pill: 'pill-ko'   },
                  transmis_erp:  { label: 'Transmis ERP',  pill: 'pill-info' },
                };
                const etapeColors: Record<StatutEtape, string> = {
                  valide: '#16A34A',
                  en_cours: '#F37021',
                  pending: '#94A3B8',
                  rejete: '#EF3340',
                };
                const currentIdx = dec.etapes.findIndex(e => e.statut === 'en_cours' || e.statut === 'rejete');
                const etapesOk = dec.etapes.filter(e => e.statut === 'valide').length;
                return (
                  <div key={dec.id} style={{
                    padding: '14px 16px',
                    borderBottom: idx < decomptes.length - 1 ? '1px solid var(--border-2)' : 'none',
                    background: selectedDec?.id === dec.id ? 'rgba(27,79,138,0.04)' : 'transparent',
                  }}>
                    {/* Row header */}
                    <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12, marginBottom: 10 }}>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                          <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--navy)', whiteSpace: 'nowrap' }}>{dec.numero}</span>
                          <span className={`pill ${statutDec[dec.statut].pill}`}>{statutDec[dec.statut].label}</span>
                          <span style={{ fontSize: 10, color: 'var(--muted)', marginLeft: 'auto' }}>Déposé le {dec.dateDepot}</span>
                        </div>
                        <div style={{ fontSize: 11, color: 'var(--text-2)', marginTop: 2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{dec.entreprise} — {dec.marcheRef}</div>
                        <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--navy)', marginTop: 2 }}>{fmtM(dec.montant)} FCFA</div>
                      </div>
                      <button
                        className="btn btn-ghost btn-xs"
                        onClick={() => setSelectedDec(selectedDec?.id === dec.id ? null : dec)}
                        style={{ flexShrink: 0 }}>
                        {selectedDec?.id === dec.id ? 'Masquer' : 'Détail'}
                      </button>
                    </div>

                    {/* 5-step pipeline */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: 0 }}>
                      {dec.etapes.map((et, ei) => {
                        const c = etapeColors[et.statut];
                        const isLast = ei === dec.etapes.length - 1;
                        return (
                          <div key={et.etape} style={{ display: 'flex', alignItems: 'center', flex: 1 }}>
                            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
                              {/* Icon */}
                              <div style={{
                                width: 28, height: 28, borderRadius: '50%',
                                background: et.statut === 'pending' ? 'var(--bg)' : `${c}20`,
                                border: `2px solid ${c}`,
                                display: 'flex', alignItems: 'center', justifyContent: 'center',
                                position: 'relative',
                              }}>
                                {et.statut === 'valide'   && <CheckCircle size={14} color={c} />}
                                {et.statut === 'en_cours' && <Clock size={14} color={c} />}
                                {et.statut === 'pending'  && <Circle size={14} color={c} />}
                                {et.statut === 'rejete'   && <AlertCircle size={14} color={c} />}
                              </div>
                              {/* Label */}
                              <div style={{ fontSize: 8, color: et.statut === 'pending' ? 'var(--muted)' : 'var(--text-2)', textAlign: 'center', fontWeight: et.statut !== 'pending' ? 600 : 400, maxWidth: 60, lineHeight: 1.2 }}>
                                {ETAPES_LABELS[et.etape]}
                              </div>
                              {et.dateFin && (
                                <div style={{ fontSize: 7, color: 'var(--muted)', textAlign: 'center' }}>{et.dateFin}</div>
                              )}
                            </div>
                            {!isLast && (
                              <div style={{
                                width: 24, height: 2, flexShrink: 0,
                                background: et.statut === 'valide' ? c : 'var(--border-2)',
                              }} />
                            )}
                          </div>
                        );
                      })}
                    </div>

                    {/* Progress summary */}
                    <div style={{ marginTop: 8, display: 'flex', alignItems: 'center', gap: 8 }}>
                      <div className="progress-bar" style={{ flex: 1, height: 4 }}>
                        <div className="progress-fill" style={{
                          width: `${(etapesOk / dec.etapes.length) * 100}%`,
                          background: dec.statut === 'rejete' ? '#EF3340' : dec.statut === 'transmis_erp' ? '#16A34A' : '#F37021',
                        }} />
                      </div>
                      <span style={{ fontSize: 10, color: 'var(--muted)', whiteSpace: 'nowrap' }}>{etapesOk}/{dec.etapes.length} étapes</span>
                    </div>

                    {/* Expanded detail */}
                    {selectedDec?.id === dec.id && (
                      <div style={{ marginTop: 12, padding: '12px 14px', background: 'var(--bg)', borderRadius: 8, border: '1px solid var(--border-2)' }}>
                        <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--navy)', marginBottom: 8 }}>Détail du circuit — {dec.numero}</div>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                          {dec.etapes.map(et => (
                            <div key={et.etape} style={{
                              display: 'flex', alignItems: 'flex-start', gap: 10, padding: '8px 10px',
                              borderRadius: 6,
                              background: et.statut === 'valide' ? '#F0FDF4' : et.statut === 'en_cours' ? '#FFF7ED' : et.statut === 'rejete' ? '#FEF2F2' : 'transparent',
                              border: `1px solid ${et.statut === 'valide' ? '#BBF7D0' : et.statut === 'en_cours' ? '#FED7AA' : et.statut === 'rejete' ? '#FECACA' : 'var(--border-2)'}`,
                            }}>
                              <div style={{ marginTop: 1 }}>
                                {et.statut === 'valide'   && <CheckCircle size={14} color="#16A34A" />}
                                {et.statut === 'en_cours' && <Clock size={14} color="#F37021" />}
                                {et.statut === 'pending'  && <Circle size={14} color="#94A3B8" />}
                                {et.statut === 'rejete'   && <AlertCircle size={14} color="#EF3340" />}
                              </div>
                              <div style={{ flex: 1 }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                                  <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--navy)' }}>{ETAPES_LABELS[et.etape]}</span>
                                  <span style={{ fontSize: 10, color: 'var(--muted)' }}>{et.responsable}</span>
                                </div>
                                {(et.dateDebut || et.dateFin) && (
                                  <div style={{ fontSize: 9, color: 'var(--muted)', marginTop: 2 }}>
                                    {et.dateDebut && `Début : ${et.dateDebut}`}{et.dateFin && ` · Fin : ${et.dateFin}`}
                                  </div>
                                )}
                                {et.commentaire && (
                                  <div style={{ fontSize: 10, color: et.statut === 'rejete' ? '#991B1B' : 'var(--text-2)', marginTop: 3, fontStyle: 'italic' }}>
                                    {et.commentaire}
                                  </div>
                                )}
                              </div>
                            </div>
                          ))}
                        </div>
                        {/* Action buttons */}
                        {dec.statut === 'en_circuit' && (
                          <div style={{ marginTop: 10, display: 'flex', gap: 8 }}>
                            <button className="btn btn-primary btn-xs" style={{ display: 'flex', alignItems: 'center', gap: 4 }} onClick={() => advanceDecompte(dec.id)}>
                              <CheckCircle size={11} />Valider étape
                            </button>
                            <button className="btn btn-ghost btn-xs" style={{ color: 'var(--red)', display: 'flex', alignItems: 'center', gap: 4 }} onClick={() => rejectDecompte(dec.id)}>
                              <AlertCircle size={11} />Rejeter
                            </button>
                          </div>
                        )}
                        {dec.statut === 'valide' && (
                          <div style={{ marginTop: 10 }}>
                            <button className="btn btn-primary btn-xs" style={{ display: 'flex', alignItems: 'center', gap: 4 }} onClick={() => transmitDecompte(dec.id)}>
                              <Send size={11} />Transmettre à l&apos;ERP
                            </button>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </>
      )}

      {selected && <MarchePanel marche={selected} onClose={() => setSelected(null)} />}
      {showForm && <MarcheForm initial={editing} onSave={saveMarche} onClose={() => { setShowForm(false); setEditing(null); }} />}
    </div>
  );
}

/* ── Référentiel du circuit de décompte (paramétrable) ───────────────────── */

import type { CircuitEtapeDef } from '@/lib/decompteCircuitStore';

function CircuitReference({ circuit, canEdit, open, onToggle }: {
  circuit: CircuitEtapeDef[];
  canEdit: boolean;
  open: boolean;
  onToggle: () => void;
}) {
  const { addEtape, updateEtape, removeEtape, moveEtape, resetCircuit } = useDecompteCircuit();
  const [newLabel, setNewLabel] = useState('');
  const [newResp, setNewResp] = useState('');
  const [newSla, setNewSla] = useState(1);

  const slaTotal = circuit.reduce((s, e) => s + (e.slaJours || 0), 0);

  return (
    <div className="card" style={{ borderLeft: '4px solid #1B4F8A' }}>
      <div className="card-header" style={{ cursor: 'pointer' }} onClick={onToggle}>
        <span className="card-title" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <Settings size={14} color="#1B4F8A" />
          Référentiel du circuit — {circuit.length} étape{circuit.length > 1 ? 's' : ''} · SLA cumulé {slaTotal} j
        </span>
        <span style={{ fontSize: 11, color: 'var(--muted)', display: 'flex', alignItems: 'center', gap: 6 }}>
          {canEdit ? (open ? 'Masquer la configuration' : 'Configurer le circuit') : 'Lecture seule'}
          {open ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
        </span>
      </div>

      {open && (
        <div style={{ padding: '4px 16px 16px' }}>
          {!canEdit && (
            <div style={{ fontSize: 11, color: '#92400E', background: '#FEF3C7', border: '1px solid #FDE68A', borderRadius: 6, padding: '8px 12px', marginBottom: 12 }}>
              🔒 Seuls les profils DPE, PMO, Contrôle financier et Administrateur peuvent modifier le circuit de référence.
            </div>
          )}

          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {/* Header row */}
            <div style={{ display: 'grid', gridTemplateColumns: '28px 1fr 1fr 90px 110px', gap: 8, fontSize: 9, fontWeight: 700, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.05em', padding: '0 4px' }}>
              <span>#</span><span>Étape</span><span>Responsable</span><span>SLA (j)</span><span></span>
            </div>

            {circuit.map((e, i) => (
              <div key={e.id} style={{ display: 'grid', gridTemplateColumns: '28px 1fr 1fr 90px 110px', gap: 8, alignItems: 'center', background: 'var(--bg)', borderRadius: 6, border: '1px solid var(--border-2)', padding: '6px 4px' }}>
                <span style={{ fontSize: 11, fontWeight: 700, color: '#1B4F8A', textAlign: 'center' }}>{i + 1}</span>
                {canEdit ? (
                  <>
                    <input value={e.label} onChange={ev => updateEtape(e.id, { label: ev.target.value })} style={inpCir} />
                    <input value={e.responsable} onChange={ev => updateEtape(e.id, { responsable: ev.target.value })} style={inpCir} />
                    <input type="number" min={0} value={e.slaJours} onChange={ev => updateEtape(e.id, { slaJours: Math.max(0, Number(ev.target.value)) })} style={{ ...inpCir, textAlign: 'center' }} />
                    <div style={{ display: 'flex', gap: 2, justifyContent: 'flex-end', paddingRight: 4 }}>
                      <button className="btn btn-ghost btn-xs" disabled={i === 0} onClick={() => moveEtape(e.id, -1)} title="Monter" style={{ padding: 4, opacity: i === 0 ? 0.3 : 1 }}><ArrowUp size={12} /></button>
                      <button className="btn btn-ghost btn-xs" disabled={i === circuit.length - 1} onClick={() => moveEtape(e.id, 1)} title="Descendre" style={{ padding: 4, opacity: i === circuit.length - 1 ? 0.3 : 1 }}><ArrowDown size={12} /></button>
                      <button className="btn btn-ghost btn-xs" onClick={() => { if (confirm(`Supprimer l'étape « ${e.label} » ?`)) removeEtape(e.id); }} title="Supprimer" style={{ padding: 4, color: 'var(--red)' }}><Trash2 size={12} /></button>
                    </div>
                  </>
                ) : (
                  <>
                    <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--navy)' }}>{e.label}</span>
                    <span style={{ fontSize: 11, color: 'var(--text-2)' }}>{e.responsable}</span>
                    <span style={{ fontSize: 11, color: 'var(--text-2)', textAlign: 'center' }}>{e.slaJours} j</span>
                    <span />
                  </>
                )}
              </div>
            ))}
          </div>

          {canEdit && (
            <>
              {/* Add row */}
              <div style={{ display: 'grid', gridTemplateColumns: '28px 1fr 1fr 90px 110px', gap: 8, alignItems: 'center', marginTop: 10, paddingTop: 10, borderTop: '1px dashed var(--border-2)' }}>
                <Plus size={14} color="#16A34A" style={{ margin: '0 auto' }} />
                <input placeholder="Nouvelle étape…" value={newLabel} onChange={e => setNewLabel(e.target.value)} style={inpCir} />
                <input placeholder="Responsable…" value={newResp} onChange={e => setNewResp(e.target.value)} style={inpCir} />
                <input type="number" min={0} value={newSla} onChange={e => setNewSla(Math.max(0, Number(e.target.value)))} style={{ ...inpCir, textAlign: 'center' }} />
                <button
                  className="btn btn-primary btn-xs"
                  disabled={!newLabel.trim()}
                  onClick={() => { addEtape(newLabel, newResp, newSla); setNewLabel(''); setNewResp(''); setNewSla(1); }}
                  style={{ justifySelf: 'end', marginRight: 4 }}>
                  Ajouter
                </button>
              </div>

              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 12 }}>
                <span style={{ fontSize: 10, color: 'var(--muted)' }}>
                  Ce circuit sert de modèle de référence pour les nouveaux décomptes. Modifications enregistrées automatiquement.
                </span>
                <button className="btn btn-ghost btn-xs" onClick={() => { if (confirm('Réinitialiser le circuit par défaut (CDC §18) ?')) resetCircuit(); }} style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                  <RotateCcw size={12} /> Réinitialiser
                </button>
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}

const inpCir: React.CSSProperties = {
  width: '100%', fontSize: 12, padding: '5px 8px', borderRadius: 5,
  border: '1px solid var(--border-2)', background: 'var(--bg-card)', color: 'var(--text)',
};

// ── Formulaire création / édition d'un marché ──────────────────────────────────

function MarcheForm({ initial, onSave, onClose }: { initial: Marche | null; onSave: (m: Marche) => void; onClose: () => void }) {
  const [f, setF] = useState<Marche>(initial ?? {
    id: `m-${Date.now().toString(36)}`,
    reference: '', objet: '', entreprise: '', montantHT: 0,
    dateSignature: '', dateFin: '', avancement: 0,
    statut: 'en_cours', direction: 'DER', type: 'Travaux', bailleur: 'SENELEC',
    avenants: [], penalites: [], garanties: [], observations: '',
  });
  const set = <K extends keyof Marche>(k: K, v: Marche[K]) => setF(prev => ({ ...prev, [k]: v }));
  const valid = f.reference.trim() !== '' && f.objet.trim() !== '' && f.entreprise.trim() !== '';
  const lbl: React.CSSProperties = { fontSize: 11, fontWeight: 600, color: 'var(--muted)', display: 'block', marginBottom: 4 };

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 220, background: 'rgba(14,52,96,0.65)', display: 'flex', justifyContent: 'center', alignItems: 'flex-start', padding: 24, overflowY: 'auto' }}>
      <div style={{ width: '100%', maxWidth: 620, background: 'var(--bg-card)', borderRadius: 12, boxShadow: 'var(--shadow-lg)' }}>
        <div style={{ padding: '14px 20px', borderBottom: '1px solid var(--border-2)', background: 'var(--navy)', color: '#fff', borderRadius: '12px 12px 0 0', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span style={{ fontSize: 15, fontWeight: 800 }}>{initial ? 'Modifier le marché' : 'Nouveau marché'}</span>
          <button onClick={onClose} style={{ padding: 6, borderRadius: 7, background: 'rgba(255,255,255,0.15)', border: 'none', cursor: 'pointer', color: '#fff', display: 'flex' }}><X size={16} /></button>
        </div>
        <div style={{ padding: 20, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          <div style={{ gridColumn: '1 / -1' }}>
            <label style={lbl}>Référence *</label>
            <input className="form-input" value={f.reference} onChange={e => set('reference', e.target.value)} placeholder="MRK-DER-2026-00X" />
          </div>
          <div style={{ gridColumn: '1 / -1' }}>
            <label style={lbl}>Objet *</label>
            <input className="form-input" value={f.objet} onChange={e => set('objet', e.target.value)} placeholder="Objet du marché" />
          </div>
          <div style={{ gridColumn: '1 / -1' }}>
            <label style={lbl}>Entreprise titulaire *</label>
            <input className="form-input" value={f.entreprise} onChange={e => set('entreprise', e.target.value)} />
          </div>
          <div>
            <label style={lbl}>Montant HTVA (FCFA)</label>
            <input className="form-input" type="number" value={f.montantHT} onChange={e => set('montantHT', Number(e.target.value))} />
          </div>
          <div>
            <label style={lbl}>Avancement (%)</label>
            <input className="form-input" type="number" min={0} max={100} value={f.avancement} onChange={e => set('avancement', Math.max(0, Math.min(100, Number(e.target.value))))} />
          </div>
          <div>
            <label style={lbl}>Date signature</label>
            <input className="form-input" value={f.dateSignature} onChange={e => set('dateSignature', e.target.value)} placeholder="JJ/MM/AAAA" />
          </div>
          <div>
            <label style={lbl}>Date fin prévue</label>
            <input className="form-input" value={f.dateFin} onChange={e => set('dateFin', e.target.value)} placeholder="JJ/MM/AAAA" />
          </div>
          <div>
            <label style={lbl}>Direction</label>
            <select className="form-input" value={f.direction} onChange={e => set('direction', e.target.value)}>
              {DIRECTIONS_LIST.filter(d => d !== 'Tous').map(d => <option key={d} value={d}>{d}</option>)}
            </select>
          </div>
          <div>
            <label style={lbl}>Type</label>
            <select className="form-input" value={f.type} onChange={e => set('type', e.target.value as TypeMarche)}>
              {TYPES_LIST.filter(t => t !== 'Tous').map(t => <option key={t} value={t}>{t}</option>)}
            </select>
          </div>
          <div>
            <label style={lbl}>Bailleur</label>
            <select className="form-input" value={f.bailleur} onChange={e => set('bailleur', e.target.value)}>
              {BAILLEURS_LIST.filter(b => b !== 'Tous').map(b => <option key={b} value={b}>{b}</option>)}
            </select>
          </div>
          <div>
            <label style={lbl}>Statut</label>
            <select className="form-input" value={f.statut} onChange={e => set('statut', e.target.value as StatutMarche)}>
              {(['en_cours', 'termine', 'resilie'] as StatutMarche[]).map(s => <option key={s} value={s}>{STATUT_CFG[s].label}</option>)}
            </select>
          </div>
          <div style={{ gridColumn: '1 / -1' }}>
            <label style={lbl}>Observations</label>
            <textarea className="form-input" rows={2} value={f.observations ?? ''} onChange={e => set('observations', e.target.value)} />
          </div>
        </div>
        <div style={{ padding: '12px 20px', borderTop: '1px solid var(--border-2)', display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
          <button className="btn btn-ghost btn-sm" onClick={onClose}>Annuler</button>
          <button className="btn btn-primary btn-sm" disabled={!valid} style={{ opacity: valid ? 1 : 0.5 }} onClick={() => onSave(f)}>
            {initial ? 'Enregistrer' : 'Créer le marché'}
          </button>
        </div>
      </div>
    </div>
  );
}

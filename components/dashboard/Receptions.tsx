'use client';

import { useState, useMemo } from 'react';
import type { CSSProperties } from 'react';
import { X, Calendar, Search } from 'lucide-react';
import { downloadExcel } from '@/lib/exportUtils';
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid,
} from 'recharts';

// ── Types ────────────────────────────────────────────────────────────────────

type StatutPV     = 'EN_COURS' | 'VALIDE' | 'REJETE';
type StatutReserve = 'levee' | 'en_cours' | 'expiree' | 'ouverte';

interface Reserve {
  id: string;
  description: string;
  delai: string;
  responsable: string;
  statut: StatutReserve;
  dateSignalement: string;
  dateLevee?: string;
}

interface PVP {
  id: string;
  ref: string;
  projet: string;
  localite: string;
  lot?: string;
  dateVisite: string;
  entreprise: string;
  nbReserves: number;
  statut: StatutPV;
  reserves: Reserve[];
  avancement: number;  // % levée réserves
}

interface PVD {
  id: string;
  ref: string;
  projet: string;
  localite: string;
  lot?: string;
  dateVisite: string;
  entreprise: string;
  delaiGarantie: string;
  retenueLibere: boolean;
  statut: StatutPV;
  reserves: Reserve[];
  avancement: number;
}

interface ReceptionPlanifiee {
  id: string;
  ref: string;
  projet: string;
  date: string;
  type: 'PVP' | 'PVD';
  entreprise: string;
}

/* ─── Immobilisations — gestion des actifs en fin de projet (après mise en service) ─── */
type StatutImmo = 'a_immobiliser' | 'en_service' | 'transfere' | 'reforme';
interface Immobilisation {
  id: string;
  code: string;           // code immobilisation comptable
  designation: string;
  projetOrigine: string;
  categorie: string;      // Ligne HTA, Poste, Transfo, Réseau BT, Génie civil…
  dateMiseEnService: string;
  valeurAcquisition: number;   // FCFA (coût de l'ouvrage réceptionné)
  dureeAmortissement: number;  // années
  uniteAffectataire: string;   // exploitation destinataire
  statut: StatutImmo;
}
const IMMO_CFG: Record<StatutImmo, { label: string; color: string; bg: string }> = {
  a_immobiliser: { label: 'À immobiliser', color: '#D97706', bg: '#FFF7ED' },
  en_service:    { label: 'En service',    color: '#1B4F8A', bg: '#EFF6FF' },
  transfere:     { label: 'Transféré exploitation', color: '#16A34A', bg: '#DCFCE7' },
  reforme:       { label: 'Réformé',       color: '#64748B', bg: '#F1F5F9' },
};
const IMMOS_DEMO: Immobilisation[] = [
  { id: 'im1', code: 'IMMO-2026-0145', designation: 'Lignes HTA 33kV — 45 km (Lot Nord)', projetOrigine: 'Électrification Rurale 19 Localités — Thiès', categorie: 'Réseau HTA', dateMiseEnService: '2026-04-30', valeurAcquisition: 1_240_000_000, dureeAmortissement: 30, uniteAffectataire: 'Direction Exploitation Réseaux — Thiès', statut: 'transfere' },
  { id: 'im2', code: 'IMMO-2026-0146', designation: '12 Postes de transformation H61', projetOrigine: 'Électrification Rurale 19 Localités — Thiès', categorie: 'Postes', dateMiseEnService: '2026-04-30', valeurAcquisition: 186_000_000, dureeAmortissement: 25, uniteAffectataire: 'Direction Exploitation Réseaux — Thiès', statut: 'en_service' },
  { id: 'im3', code: 'IMMO-2026-0151', designation: 'Réseau BT — 120 km (extension)', projetOrigine: 'Extension BT — Oumy Diallo', categorie: 'Réseau BT', dateMiseEnService: '2026-05-15', valeurAcquisition: 540_000_000, dureeAmortissement: 20, uniteAffectataire: 'Direction Distribution', statut: 'a_immobiliser' },
];

/* ─── Moteur IA d'aide à l'immobilisation (human-in-the-loop) ───
 * À partir des PV définitifs validés, l'IA PROPOSE des fiches d'immobilisation
 * (catégorie, durée d'amortissement, valeur estimée, affectataire) que l'agent
 * comptable doit RELIRE, ajuster puis VALIDER ou REJETER. Aucune écriture n'est
 * comptabilisée sans validation humaine. */

interface ImmoProposition {
  id: string;
  sourceRef: string;       // PV définitif d'origine
  designation: string;
  projetOrigine: string;
  categorie: string;
  dateMiseEnService: string;   // ISO yyyy-mm-dd
  valeurAcquisition: number;
  dureeAmortissement: number;
  uniteAffectataire: string;
  confidence: number;      // 0..1 — niveau de confiance IA
  rationale: string;       // justification (traçabilité)
  alertes: string[];       // points de vigilance à arbitrer
}

const DUREE_AMORT_PAR_CATEGORIE: Record<string, number> = {
  'Réseau HTA': 30,
  'Réseau BT': 20,
  'Postes': 25,
  'Génie civil / Bâtiment': 40,
  'Production': 25,
  'Comptage / AMI': 10,
  'Équipements divers': 10,
};

function inferCategorieImmo(txt: string): string {
  const t = txt.toLowerCase();
  if (/(compteur|ami|smart\s*meter|landis|prepaiement)/.test(t)) return 'Comptage / AMI';
  if (/(centrale|tag\b|turbine|groupe\s|production|cap des biches|diesel|solaire|photovolt)/.test(t)) return 'Production';
  if (/(b[aâ]timent|si[eè]ge|construction|g[eé]nie civil|local technique)/.test(t)) return 'Génie civil / Bâtiment';
  if (/(poste|h61|transfo|kva|cabine|source)/.test(t)) return 'Postes';
  if (/(hta|33\s*kv|30\s*kv|moyenne tension|\bmt\b)/.test(t)) return 'Réseau HTA';
  if (/(\bbt\b|basse tension|0[.,]4\s*kv|branchement|extension r[eé]seau)/.test(t)) return 'Réseau BT';
  return 'Équipements divers';
}

function estimerValeurImmo(categorie: string): number {
  const base: Record<string, number> = {
    'Réseau HTA': 850_000_000,
    'Réseau BT': 420_000_000,
    'Postes': 165_000_000,
    'Génie civil / Bâtiment': 600_000_000,
    'Production': 1_500_000_000,
    'Comptage / AMI': 95_000_000,
    'Équipements divers': 60_000_000,
  };
  return base[categorie] ?? 100_000_000;
}

function affectatairePourCategorie(categorie: string): string {
  switch (categorie) {
    case 'Comptage / AMI': return 'Direction Commerciale / Distribution';
    case 'Production': return 'Direction Production';
    case 'Génie civil / Bâtiment': return 'Direction Moyens Généraux';
    case 'Réseau HTA':
    case 'Postes': return 'Direction Exploitation Réseaux';
    case 'Réseau BT': return 'Direction Distribution';
    default: return 'Direction Exploitation';
  }
}

/** dd/mm/yyyy → yyyy-mm-dd (tolérant). */
function toISODate(d: string): string {
  const m = d.match(/(\d{1,2})\/(\d{1,2})\/(\d{4})/);
  if (m) return `${m[3]}-${m[2].padStart(2, '0')}-${m[1].padStart(2, '0')}`;
  return d;
}

/** Génère les propositions d'immobilisation IA à partir des PV définitifs. */
function genererPropositionsImmo(pvds: PVD[], immosExistants: Immobilisation[]): ImmoProposition[] {
  const dejaImmobilise = (projet: string) =>
    immosExistants.some(i => i.projetOrigine.toLowerCase().includes(projet.toLowerCase().slice(0, 12)));

  return pvds
    .filter(pv => pv.statut === 'VALIDE' && !dejaImmobilise(pv.projet))
    .map((pv, idx) => {
      const ctx = `${pv.projet} ${pv.localite} ${pv.lot ?? ''} ${pv.entreprise}`;
      const categorie = inferCategorieImmo(ctx);
      const reservesOuvertes = pv.reserves.filter(r => r.statut === 'ouverte' || r.statut === 'en_cours').length;
      const alertes: string[] = [];
      if (!pv.retenueLibere) alertes.push('Retenue de garantie non libérée');
      if (reservesOuvertes > 0) alertes.push(`${reservesOuvertes} réserve(s) non levée(s)`);
      alertes.push('Valeur estimée — à confirmer avec le décompte définitif');
      // Confiance : pénalisée par les réserves et la retenue non libérée
      let confidence = 0.92;
      if (!pv.retenueLibere) confidence -= 0.15;
      confidence -= reservesOuvertes * 0.08;
      if (categorie === 'Équipements divers') confidence -= 0.1;
      confidence = Math.max(0.4, Math.min(0.98, confidence));

      return {
        id: `prop_${pv.id}_${idx}`,
        sourceRef: pv.ref,
        designation: `${categorie} — ${pv.localite}`,
        projetOrigine: pv.projet,
        categorie,
        dateMiseEnService: toISODate(pv.dateVisite),
        valeurAcquisition: estimerValeurImmo(categorie),
        dureeAmortissement: DUREE_AMORT_PAR_CATEGORIE[categorie] ?? 10,
        uniteAffectataire: affectatairePourCategorie(categorie),
        confidence,
        rationale: `Réception définitive ${pv.ref} validée (${pv.entreprise}). Catégorie « ${categorie} » déduite du libellé ; durée d'amortissement standard ${DUREE_AMORT_PAR_CATEGORIE[categorie] ?? 10} ans.`,
        alertes,
      } as ImmoProposition;
    });
}

const propLbl: CSSProperties = { display: 'flex', flexDirection: 'column', gap: 3, fontSize: 10, fontWeight: 700, color: '#94A3B8', textTransform: 'uppercase', letterSpacing: '0.03em', minWidth: 0 };
const propInp: CSSProperties = { fontSize: 12, padding: '6px 8px', borderRadius: 6, border: '1px solid #E2E8F0', color: '#1E293B', fontWeight: 500, fontFamily: 'inherit', width: '100%', boxSizing: 'border-box' };

// ── Mock data ─────────────────────────────────────────────────────────────────

const PVPS: PVP[] = [
  {
    id: 'pvp1', ref: 'PVP-DER-2026-001', projet: 'Électrification Rurale 19 Localités — Thiès',
    localite: 'Ndiaye (L001)', dateVisite: '20/05/2026', entreprise: 'ELEC AFRIQUE SARL',
    nbReserves: 3, statut: 'EN_COURS', avancement: 33,
    reserves: [
      { id: 'r1', description: 'Clôture périmètre poste électrique incomplète (côté Nord)', delai: '30/06/2026', responsable: 'ELEC AFRIQUE SARL', statut: 'en_cours',  dateSignalement: '20/05/2026' },
      { id: 'r2', description: 'Panneau signalisation manquant — 3 emplacements route principale', delai: '15/06/2026', responsable: 'Chef Projet DER', statut: 'levee', dateSignalement: '20/05/2026', dateLevee: '28/05/2026' },
      { id: 'r3', description: 'Documentation As-Built incomplète — plans génie civil', delai: '10/06/2026', responsable: 'ELEC AFRIQUE SARL', statut: 'ouverte', dateSignalement: '20/05/2026' },
    ],
  },
  {
    id: 'pvp2', ref: 'PVP-DEP-2026-002', projet: 'Réhabilitation Centrale Cap des Biches',
    localite: 'Cap des Biches — TAG 1', dateVisite: '15/05/2026', entreprise: 'GE POWER AFRICA',
    nbReserves: 1, statut: 'EN_COURS', avancement: 0,
    reserves: [
      { id: 'r4', description: 'Essais protection différentielle TAG 1 — résultats non conformes (dépassement seuil 8%)', delai: '20/06/2026', responsable: 'GE POWER AFRICA', statut: 'ouverte', dateSignalement: '15/05/2026' },
    ],
  },
  {
    id: 'pvp3', ref: 'PVP-CC26-2026-003', projet: 'Ligne 225 kV Tobène–Thiès–Hann',
    localite: 'Tronçon Tobène–Thiès Lot 1', dateVisite: '05/07/2026', entreprise: 'TRACTEBEL ENGINEERING SA',
    nbReserves: 0, statut: 'EN_COURS', avancement: 0,
    reserves: [],
  },
  {
    id: 'pvp4', ref: 'PVP-DIT-2026-004', projet: 'Déploiement compteurs AMI',
    localite: 'Dakar Plateau — Zone A', dateVisite: '10/05/2026', entreprise: 'LANDIS+GYR AFRICA',
    nbReserves: 2, statut: 'VALIDE', avancement: 100,
    reserves: [
      { id: 'r5', description: 'Configuration GPRS lot 230 compteurs — paramètres réseau incorrects', delai: '25/05/2026', responsable: 'LANDIS+GYR AFRICA', statut: 'levee', dateSignalement: '10/05/2026', dateLevee: '22/05/2026' },
      { id: 'r6', description: 'Certificats étalonnage manquants pour 45 compteurs', delai: '20/05/2026', responsable: 'METROLOGIE SENELEC', statut: 'levee', dateSignalement: '10/05/2026', dateLevee: '18/05/2026' },
    ],
  },
  {
    id: 'pvp5', ref: 'PVP-DGC-2026-005', projet: 'Construction siège régional Saint-Louis',
    localite: 'Saint-Louis — Bâtiment principal', dateVisite: '28/04/2026', entreprise: 'SABER CONSTRUCTION SARL',
    nbReserves: 4, statut: 'EN_COURS', avancement: 25,
    reserves: [
      { id: 'r7', description: 'Fissures façade Est — cartographie et injection résine requise', delai: '15/06/2026', responsable: 'SABER CONSTRUCTION SARL', statut: 'ouverte', dateSignalement: '28/04/2026' },
      { id: 'r8', description: 'Système incendie non conforme NFPA — remplacement sprinklers salle serveurs', delai: '30/06/2026', responsable: 'SABER CONSTRUCTION SARL', statut: 'en_cours', dateSignalement: '28/04/2026' },
      { id: 'r9', description: 'Clim VRF salle réunion — débit insuffisant (60% capacité nominale)', delai: '20/06/2026', responsable: 'SABER CONSTRUCTION SARL', statut: 'ouverte', dateSignalement: '28/04/2026' },
      { id: 'r10', description: 'Parkings — marquage au sol non réalisé', delai: '10/06/2026', responsable: 'SABER CONSTRUCTION SARL', statut: 'levee', dateSignalement: '28/04/2026', dateLevee: '15/05/2026' },
    ],
  },
  {
    id: 'pvp6', ref: 'PVP-DER-2026-006', projet: 'PADERAU — Réseau HTA/BT zones rurales',
    localite: 'Zone 2 — Kaolack', dateVisite: '22/05/2026', entreprise: 'EFACEC ENERGY SPA',
    nbReserves: 2, statut: 'EN_COURS', avancement: 50,
    reserves: [
      { id: 'r11', description: 'Équipements HTA non conformes norme CEI 62271 — lot transformateurs', delai: '15/07/2026', responsable: 'EFACEC ENERGY SPA', statut: 'ouverte', dateSignalement: '22/05/2026' },
      { id: 'r12', description: 'Plan as-built réseau BT incomplet — 12 rues manquantes', delai: '10/07/2026', responsable: 'EFACEC ENERGY SPA', statut: 'levee', dateSignalement: '22/05/2026', dateLevee: '18/05/2026' },
    ],
  },
  {
    id: 'pvp7', ref: 'PVP-CPADERAU-2026-007', projet: 'PADERAU — Réseau HTA/BT zones rurales',
    localite: 'Zone 3 — Diourbel', dateVisite: '18/05/2026', entreprise: 'EFACEC ENERGY SPA',
    nbReserves: 0, statut: 'VALIDE', avancement: 100,
    reserves: [],
  },
  {
    id: 'pvp8', ref: 'PVP-DGC-2026-008', projet: 'Construction siège régional SENELEC — Ziguinchor',
    localite: 'Ziguinchor — Bâtiment administratif', dateVisite: '05/05/2026', entreprise: 'SABER CONSTRUCTION SARL',
    nbReserves: 1, statut: 'REJETE', avancement: 0,
    reserves: [
      { id: 'r13', description: 'Travaux structurels non conformes — béton armé hors tolérances DTU', delai: '—', responsable: 'SABER CONSTRUCTION SARL', statut: 'ouverte', dateSignalement: '05/05/2026' },
    ],
  },
];

const PVDS: PVD[] = [
  {
    id: 'pvd1', ref: 'PVD-CPBM-2026-001', projet: 'PASE — Accès électricité zones péri-urbaines',
    localite: 'Dakar — Guédiawaye Lot 1', lot: 'Lot 1',
    dateVisite: '01/04/2026', entreprise: 'ABB SENEGAL SA',
    delaiGarantie: '01/04/2027', retenueLibere: true,
    statut: 'VALIDE', avancement: 100,
    reserves: [],
  },
  {
    id: 'pvd2', ref: 'PVD-DER-2026-002', projet: 'Électrification Rurale 19 Localités — Thiès',
    localite: 'Ngoyah (L003)', lot: undefined,
    dateVisite: '15/04/2026', entreprise: 'ELEC AFRIQUE SARL',
    delaiGarantie: '15/04/2027', retenueLibere: false,
    statut: 'EN_COURS', avancement: 50,
    reserves: [
      { id: 'rd1', description: 'Transformateur 160 kVA présente vibrations anormales en charge', delai: '30/06/2026', responsable: 'ABB SENEGAL SA', statut: 'en_cours', dateSignalement: '15/04/2026' },
      { id: 'rd2', description: 'Documentation maintenance préventive manquante', delai: '15/06/2026', responsable: 'ELEC AFRIQUE SARL', statut: 'levee', dateSignalement: '15/04/2026', dateLevee: '10/05/2026' },
    ],
  },
  {
    id: 'pvd3', ref: 'PVD-DEP-2026-003', projet: 'Réhabilitation Centrale Cap des Biches',
    localite: 'Cap des Biches — TAG 2', lot: 'TAG 2',
    dateVisite: '20/03/2026', entreprise: 'GE POWER AFRICA',
    delaiGarantie: '20/03/2027', retenueLibere: true,
    statut: 'VALIDE', avancement: 100,
    reserves: [],
  },
  {
    id: 'pvd4', ref: 'PVD-DIT-2026-004', projet: 'Déploiement compteurs AMI',
    localite: 'Pikine — Zones B & C', lot: 'Lot 2',
    dateVisite: '10/05/2026', entreprise: 'LANDIS+GYR AFRICA',
    delaiGarantie: '10/05/2027', retenueLibere: false,
    statut: 'EN_COURS', avancement: 0,
    reserves: [
      { id: 'rd3', description: 'Firmware compteurs v3.1 — bug lecture heure creuse nuit', delai: '15/06/2026', responsable: 'LANDIS+GYR AFRICA', statut: 'ouverte', dateSignalement: '10/05/2026' },
    ],
  },
  {
    id: 'pvd5', ref: 'PVD-CPADERAU-2026-005', projet: 'PADERAU — Réseau HTA/BT zones rurales',
    localite: 'Zone 1 — Fatick', lot: 'Zone 1',
    dateVisite: '25/02/2026', entreprise: 'EFACEC ENERGY SPA',
    delaiGarantie: '25/02/2027', retenueLibere: true,
    statut: 'VALIDE', avancement: 100,
    reserves: [],
  },
];

const PLANIFIEES: ReceptionPlanifiee[] = [
  { id: 'pl1', ref: 'PVP-CC26-2026-003',    projet: 'Ligne 225 kV — Lot 1',    date: '05/07/2026', type: 'PVP', entreprise: 'TRACTEBEL' },
  { id: 'pl2', ref: 'PVP-DGC-2026-009',     projet: 'Siège Thiès',             date: '08/07/2026', type: 'PVP', entreprise: 'SABER CONST.' },
  { id: 'pl3', ref: 'PVD-DER-2026-006',     projet: 'Rural Thiès — L002',      date: '10/07/2026', type: 'PVD', entreprise: 'ELEC AFRIQUE' },
  { id: 'pl4', ref: 'PVP-CPAMACEL-2026-001',projet: 'PAMACEL Zone Rufisque',   date: '12/07/2026', type: 'PVP', entreprise: 'EFACEC ENERGY' },
  { id: 'pl5', ref: 'PVP-DEP-2026-010',     projet: 'Cap des Biches — TAG 3',  date: '14/07/2026', type: 'PVP', entreprise: 'GE POWER AFRICA' },
  { id: 'pl6', ref: 'PVD-DIT-2026-007',     projet: 'AMI Guédiawaye Lot 3',   date: '15/07/2026', type: 'PVD', entreprise: 'LANDIS+GYR' },
  { id: 'pl7', ref: 'PVP-DGC-2026-011',     projet: 'Siège Ziguinchor — reçu', date: '18/07/2026', type: 'PVP', entreprise: 'SABER CONST.' },
  { id: 'pl8', ref: 'PVP-CPADERAU-2026-008',projet: 'PADERAU Zone 4 — Tambacounda', date: '20/07/2026', type: 'PVP', entreprise: 'EFACEC ENERGY' },
  { id: 'pl9', ref: 'PVP-DER-2026-009',     projet: 'Rural Kaolack — 12 lots', date: '22/07/2026', type: 'PVP', entreprise: 'ELEC AFRIQUE' },
  { id: 'pl10', ref: 'PVD-CC26-2026-004',   projet: 'Ligne 225 kV — Lot 2',   date: '25/07/2026', type: 'PVD', entreprise: 'TRACTEBEL' },
];

// Stats pour graphiques
const TOP_ENTREPRISES = [
  { nom: 'ABB SENEGAL',     sansReserves: 3, avecReserves: 1 },
  { nom: 'LANDIS+GYR',      sansReserves: 2, avecReserves: 2 },
  { nom: 'ELEC AFRIQUE',    sansReserves: 1, avecReserves: 3 },
  { nom: 'GE POWER',        sansReserves: 2, avecReserves: 1 },
  { nom: 'EFACEC ENERGY',   sansReserves: 1, avecReserves: 3 },
];

// ── Helpers ───────────────────────────────────────────────────────────────────

function statutPill(s: StatutPV): string {
  return s === 'VALIDE' ? 'pill-ok' : s === 'EN_COURS' ? 'pill-warn' : 'pill-ko';
}

function statutLabel(s: StatutPV): string {
  return s === 'VALIDE' ? 'Validé' : s === 'EN_COURS' ? 'En cours' : 'Rejeté';
}

function reserveColor(s: StatutReserve): string {
  return s === 'levee' ? 'var(--green)' : s === 'en_cours' ? 'var(--amber)' : s === 'expiree' ? 'var(--red)' : 'var(--red)';
}

function reserveLabel(s: StatutReserve): string {
  return s === 'levee' ? 'Levée' : s === 'en_cours' ? 'En cours' : s === 'expiree' ? 'Expirée' : 'Ouverte';
}

// ── Reserve Detail Panel ──────────────────────────────────────────────────────

function ReservesPanel({ reserves, titre, onClose }: {
  reserves: Reserve[];
  titre: string;
  onClose: () => void;
}) {
  const [list, setList] = useState<Reserve[]>(reserves);

  function lever(id: string) {
    setList(rs => rs.map(r => r.id === id ? { ...r, statut: 'levee' as const, dateLevee: new Date().toLocaleDateString('fr-FR') } : r));
  }

  const levees   = list.filter(r => r.statut === 'levee').length;
  const pctLevee = list.length > 0 ? Math.round((levees / list.length) * 100) : 0;

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 200, background: 'rgba(14,52,96,0.65)', display: 'flex', justifyContent: 'flex-end' }}>
      <div style={{ width: '100%', maxWidth: 600, background: 'var(--bg-card)', display: 'flex', flexDirection: 'column', overflowY: 'auto', boxShadow: 'var(--shadow-lg)' }}>
        <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--border-2)', background: 'var(--navy)', color: '#fff', flexShrink: 0 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <div>
              <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.65)', fontWeight: 600, marginBottom: 4 }}>LEVÉE DES RÉSERVES</div>
              <div style={{ fontSize: 14, fontWeight: 800 }}>{titre}</div>
              <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.7)', marginTop: 4 }}>{levees}/{list.length} levées — {pctLevee}%</div>
            </div>
            <button onClick={onClose} aria-label="Fermer le panneau des réserves" style={{ padding: 8, borderRadius: 8, background: 'rgba(255,255,255,0.15)', border: 'none', cursor: 'pointer', color: '#fff', display: 'flex' }}>
              <X size={16} />
            </button>
          </div>
          <div className="progress-bar" style={{ marginTop: 12, height: 6 }}>
            <div className="progress-fill green" style={{ width: `${pctLevee}%` }} />
          </div>
        </div>
        <div style={{ padding: '16px 20px', display: 'flex', flexDirection: 'column', gap: 10 }}>
          {list.map(r => {
            const col = reserveColor(r.statut);
            return (
              <div key={r.id} style={{ padding: '12px 14px', background: 'var(--bg)', borderRadius: 8, border: `1px solid ${col}33` }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 10 }}>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 12, fontWeight: 500, color: 'var(--text)', marginBottom: 5 }}>{r.description}</div>
                    <div style={{ display: 'flex', gap: 12, fontSize: 10, color: 'var(--muted)', flexWrap: 'wrap' }}>
                      <span>Responsable : <strong style={{ color: 'var(--text-2)' }}>{r.responsable}</strong></span>
                      <span>Délai : <strong style={{ color: 'var(--text-2)' }}>{r.delai}</strong></span>
                      {r.dateLevee && <span style={{ color: 'var(--green)', fontWeight: 600 }}>Levée le {r.dateLevee}</span>}
                    </div>
                  </div>
                  <div style={{ display: 'flex', gap: 6, alignItems: 'center', flexShrink: 0 }}>
                    <span className={`pill ${r.statut === 'levee' ? 'pill-ok' : r.statut === 'en_cours' ? 'pill-warn' : 'pill-ko'}`}>
                      {reserveLabel(r.statut)}
                    </span>
                    {r.statut !== 'levee' && (
                      <button className="btn btn-ghost btn-xs" style={{ color: 'var(--green)', borderColor: 'var(--green)' }} onClick={() => lever(r.id)}>
                        Lever
                      </button>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

export default function Receptions() {
  const [activeTab, setActiveTab] = useState<'pvp' | 'pvd' | 'planning' | 'stats' | 'immo'>('pvp');
  const [immos, setImmos] = useState<Immobilisation[]>(IMMOS_DEMO);
  const [pvps, setPvps] = useState<PVP[]>(PVPS);
  const [pvds, setPvds] = useState<PVD[]>(PVDS);
  const [pvpSelected, setPvpSelected] = useState<PVP | null>(null);
  const [pvdSelected, setPvdSelected] = useState<PVD | null>(null);
  const [pvpSearch, setPvpSearch] = useState('');
  const [pvdSearch, setPvdSearch] = useState('');
  const [immoSearch, setImmoSearch] = useState('');

  // ── IA d'aide à l'immobilisation (human-in-the-loop) ──
  const [propositions, setPropositions] = useState<ImmoProposition[]>([]);
  const [iaGenere, setIaGenere] = useState(false);
  const lancerAnalyseIA = () => {
    setPropositions(genererPropositionsImmo(pvds, immos));
    setIaGenere(true);
  };
  const patchProposition = (id: string, patch: Partial<ImmoProposition>) =>
    setPropositions(prev => prev.map(p => p.id === id ? { ...p, ...patch } : p));
  const rejeterProposition = (id: string) =>
    setPropositions(prev => prev.filter(p => p.id !== id));
  const validerProposition = (p: ImmoProposition) => {
    const nextNum = 200 + immos.length;
    const nouvelle: Immobilisation = {
      id: `im_${Date.now()}`,
      code: `IMMO-${new Date().getFullYear()}-${String(nextNum).padStart(4, '0')}`,
      designation: p.designation,
      projetOrigine: p.projetOrigine,
      categorie: p.categorie,
      dateMiseEnService: p.dateMiseEnService,
      valeurAcquisition: p.valeurAcquisition,
      dureeAmortissement: p.dureeAmortissement,
      uniteAffectataire: p.uniteAffectataire,
      statut: 'a_immobiliser',
    };
    setImmos(prev => [nouvelle, ...prev]);
    setPropositions(prev => prev.filter(x => x.id !== p.id));
  };

  // ── Workflow de validation des PV (remplace les anciens alert()) ──
  const setPvpStatut = (id: string, statut: StatutPV) =>
    setPvps(prev => prev.map(p => p.id === id ? { ...p, statut } : p));

  const filteredPvps = useMemo(() => {
    if (!pvpSearch.trim()) return pvps;
    const q = pvpSearch.toLowerCase();
    return pvps.filter(p => p.ref.toLowerCase().includes(q) || p.projet.toLowerCase().includes(q) || p.localite.toLowerCase().includes(q) || p.entreprise.toLowerCase().includes(q));
  }, [pvps, pvpSearch]);

  const filteredPvds = useMemo(() => {
    if (!pvdSearch.trim()) return pvds;
    const q = pvdSearch.toLowerCase();
    return pvds.filter(p => p.ref.toLowerCase().includes(q) || p.projet.toLowerCase().includes(q) || p.localite.toLowerCase().includes(q) || p.entreprise.toLowerCase().includes(q));
  }, [pvds, pvdSearch]);

  const filteredImmos = useMemo(() => {
    if (!immoSearch.trim()) return immos;
    const q = immoSearch.toLowerCase();
    return immos.filter(i => i.code.toLowerCase().includes(q) || i.designation.toLowerCase().includes(q) || i.projetOrigine.toLowerCase().includes(q) || i.categorie.toLowerCase().includes(q));
  }, [immos, immoSearch]);

  // KPIs
  const kpis = useMemo(() => ({
    pvpEnCours:      pvps.filter(p => p.statut === 'EN_COURS').length,
    pvdEnCours:      pvds.filter(p => p.statut === 'EN_COURS').length,
    reservesLevees:  5,  // cette semaine (mock)
    planifiees:      PLANIFIEES.length,
    totalReservesPVP: pvps.reduce((s, p) => s + p.reserves.length, 0),
    reservesOuvertes: pvps.reduce((s, p) => s + p.reserves.filter(r => r.statut !== 'levee').length, 0),
  }), [pvps, pvds]);

  // Taux 1er passage (PVP sans réserves)
  const tauxPremierPassage = pvps.length > 0 ? Math.round((pvps.filter(p => p.nbReserves === 0).length / pvps.length) * 100) : 0;

  return (
    <div className="page-content">

      {/* ── KPIs ─────────────────────────────────────────────────────────── */}
      <div className="kpi-grid" style={{ gridTemplateColumns: 'repeat(4,1fr)' }}>
        <div className="kpi-card navy">
          <div className="kpi-label">PV provisoires en cours</div>
          <div className="kpi-value">{kpis.pvpEnCours}</div>
          <div className="kpi-sub">{pvps.length} PVP au total</div>
        </div>
        <div className="kpi-card amber">
          <div className="kpi-label">PV définitifs en cours</div>
          <div className="kpi-value amber">{kpis.pvdEnCours}</div>
          <div className="kpi-sub">{pvds.length} PVD au total</div>
        </div>
        <div className="kpi-card green">
          <div className="kpi-label">Réserves ouvertes</div>
          <div className="kpi-value green">{kpis.reservesOuvertes}</div>
          <div className="kpi-sub">{kpis.totalReservesPVP} réserves au total</div>
        </div>
        <div className="kpi-card blue">
          <div className="kpi-label">Réceptions planif. 30j</div>
          <div className="kpi-value blue">{kpis.planifiees}</div>
          <div className="kpi-sub">05 juil. — 05 août 2026</div>
        </div>
      </div>

      {/* ── Onglets ───────────────────────────────────────────────────────── */}
      <div className="tabs">
        {(['pvp', 'pvd', 'immo', 'planning', 'stats'] as const).map(t => (
          <button key={t} className={`tab${activeTab === t ? ' active' : ''}`} onClick={() => setActiveTab(t)}>
            {t === 'pvp' ? 'PV Provisoires' : t === 'pvd' ? 'PV Définitifs' : t === 'immo' ? 'Immobilisations' : t === 'planning' ? 'Planning J+30' : 'Statistiques'}
          </button>
        ))}
      </div>

      {/* ══════════════════════════════════════════════════════════════════ */}
      {/* PVP ─────────────────────────────────────────────────────────── */}
      {/* ══════════════════════════════════════════════════════════════════ */}
      {activeTab === 'pvp' && (
        <div className="card">
          <div className="card-header">
            <span className="card-title">Procès-Verbaux Provisoires</span>
            <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
              {pvpSearch && <span style={{ fontSize: 10, color: 'var(--muted)' }}>{filteredPvps.length}/{pvps.length}</span>}
              <div style={{ position: 'relative' }}>
                <Search size={12} style={{ position: 'absolute', left: 7, top: '50%', transform: 'translateY(-50%)', color: '#94A3B8', pointerEvents: 'none' }} />
                <input value={pvpSearch} onChange={e => setPvpSearch(e.target.value)} placeholder="Rechercher…" style={{ padding: '5px 8px 5px 24px', borderRadius: 6, border: '1px solid #E2E8F0', fontSize: 11, width: 180, paddingRight: pvpSearch ? 24 : 8, outline: 'none' }} />
                {pvpSearch && <button onClick={() => setPvpSearch('')} aria-label="Effacer la recherche PVP" style={{ position: 'absolute', right: 5, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: '#94A3B8', padding: 0 }}><X size={11} /></button>}
              </div>
            </div>
          </div>
          <div style={{ overflowX: 'auto' }}>
            <table className="tbl">
              <thead>
                <tr>
                  <th>Réf</th>
                  <th>Projet</th>
                  <th className="hide-mobile">Localité / Lot</th>
                  <th className="hide-mobile">Date visite</th>
                  <th className="hide-mobile">Entreprise</th>
                  <th style={{ textAlign: 'right' }}>Nb réserves</th>
                  <th>Statut</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredPvps.length === 0 && (
                  <tr><td colSpan={8} style={{ textAlign: 'center', padding: '32px 0', color: 'var(--muted)', fontSize: 12 }}>
                    Aucun PV provisoire correspondant à « {pvpSearch} »
                  </td></tr>
                )}
                {filteredPvps.map(p => (
                  <tr key={p.id}>
                    <td style={{ fontWeight: 700, color: 'var(--navy)', fontSize: 10, whiteSpace: 'nowrap' }}>{p.ref}</td>
                    <td style={{ fontSize: 11, maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={p.projet}>{p.projet}</td>
                    <td className="hide-mobile" style={{ fontSize: 11 }}>{p.localite}</td>
                    <td className="hide-mobile" style={{ whiteSpace: 'nowrap' }}><Calendar size={10} style={{ verticalAlign: 'middle', marginRight: 4, color: 'var(--muted)' }} />{p.dateVisite}</td>
                    <td className="hide-mobile" style={{ fontSize: 11 }}>{p.entreprise}</td>
                    <td style={{ textAlign: 'right' }}>
                      {p.nbReserves > 0
                        ? <span style={{ fontWeight: 700, color: p.statut === 'VALIDE' ? 'var(--green)' : 'var(--red)' }}>{p.nbReserves}</span>
                        : <span style={{ color: 'var(--green)', fontWeight: 700 }}>0</span>}
                    </td>
                    <td><span className={`pill ${statutPill(p.statut)}`}>{statutLabel(p.statut)}</span></td>
                    <td>
                      <div style={{ display: 'flex', gap: 4 }}>
                        <button className="btn btn-ghost btn-xs" onClick={() => setPvpSelected(p)}>Voir</button>
                        {p.statut === 'EN_COURS' && <>
                          <button className="btn btn-ghost btn-xs hide-mobile" style={{ color: 'var(--green)' }} onClick={() => setPvpStatut(p.id, 'VALIDE')}>Valider</button>
                          <button className="btn btn-ghost btn-xs hide-mobile" style={{ color: 'var(--red)' }} onClick={() => setPvpStatut(p.id, 'REJETE')}>Rejeter</button>
                        </>}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ══════════════════════════════════════════════════════════════════ */}
      {/* PVD ─────────────────────────────────────────────────────────── */}
      {/* ══════════════════════════════════════════════════════════════════ */}
      {activeTab === 'pvd' && (
        <div className="card">
          <div className="card-header">
            <span className="card-title">Procès-Verbaux Définitifs</span>
            <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
              {pvdSearch && <span style={{ fontSize: 10, color: 'var(--muted)' }}>{filteredPvds.length}/{pvds.length}</span>}
              <div style={{ position: 'relative' }}>
                <Search size={12} style={{ position: 'absolute', left: 7, top: '50%', transform: 'translateY(-50%)', color: '#94A3B8', pointerEvents: 'none' }} />
                <input value={pvdSearch} onChange={e => setPvdSearch(e.target.value)} placeholder="Rechercher…" style={{ padding: '5px 8px 5px 24px', borderRadius: 6, border: '1px solid #E2E8F0', fontSize: 11, width: 180, paddingRight: pvdSearch ? 24 : 8, outline: 'none' }} />
                {pvdSearch && <button onClick={() => setPvdSearch('')} aria-label="Effacer la recherche PVD" style={{ position: 'absolute', right: 5, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: '#94A3B8', padding: 0 }}><X size={11} /></button>}
              </div>
            </div>
          </div>
          <div style={{ overflowX: 'auto' }}>
            <table className="tbl">
              <thead>
                <tr>
                  <th>Réf</th>
                  <th>Projet</th>
                  <th className="hide-mobile">Localité / Lot</th>
                  <th className="hide-mobile">Date visite</th>
                  <th className="hide-mobile">Entreprise</th>
                  <th className="hide-mobile">Délai garantie</th>
                  <th>Retenue libérée</th>
                  <th>Statut</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredPvds.length === 0 && (
                  <tr><td colSpan={9} style={{ textAlign: 'center', padding: '32px 0', color: 'var(--muted)', fontSize: 12 }}>
                    Aucun PV définitif correspondant à « {pvdSearch} »
                  </td></tr>
                )}
                {filteredPvds.map(p => (
                  <tr key={p.id}>
                    <td style={{ fontWeight: 700, color: 'var(--navy)', fontSize: 10, whiteSpace: 'nowrap' }}>{p.ref}</td>
                    <td style={{ fontSize: 11, maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={p.projet}>{p.projet}</td>
                    <td className="hide-mobile" style={{ fontSize: 11 }}>{p.localite}{p.lot ? ` — ${p.lot}` : ''}</td>
                    <td className="hide-mobile" style={{ whiteSpace: 'nowrap' }}><Calendar size={10} style={{ verticalAlign: 'middle', marginRight: 4, color: 'var(--muted)' }} />{p.dateVisite}</td>
                    <td className="hide-mobile" style={{ fontSize: 11 }}>{p.entreprise}</td>
                    <td className="hide-mobile" style={{ fontSize: 11 }}>{p.delaiGarantie}</td>
                    <td>
                      {p.retenueLibere
                        ? <span className="pill pill-ok">Libérée</span>
                        : <span className="pill pill-warn">En attente</span>}
                    </td>
                    <td><span className={`pill ${statutPill(p.statut)}`}>{statutLabel(p.statut)}</span></td>
                    <td>
                      <div style={{ display: 'flex', gap: 4 }}>
                        <button className="btn btn-ghost btn-xs" onClick={() => setPvdSelected(p)}>Voir</button>
                        {p.statut === 'EN_COURS' && (
                          <button className="btn btn-ghost btn-xs hide-mobile" style={{ color: 'var(--green)' }} onClick={() => setPvds(prev => prev.map(x => x.id === p.id ? { ...x, statut: 'VALIDE' as const, retenueLibere: true } : x))}>Valider</button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ══════════════════════════════════════════════════════════════════ */}
      {/* PLANNING J+30 ────────────────────────────────────────────────── */}
      {/* ══════════════════════════════════════════════════════════════════ */}
      {activeTab === 'planning' && (
        <>
          <div className="banner banner-info">
            <Calendar size={14} style={{ flexShrink: 0, marginTop: 1 }} />
            <span><strong>{PLANIFIEES.length} réceptions planifiées</strong> dans les 30 prochains jours (05 juil. — 05 août 2026)</span>
          </div>

          {/* Calendrier hebdomadaire simplifié */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5,1fr)', gap: 10 }}>
            {['Lun 07/07', 'Mar 08/07', 'Mer 09/07', 'Jeu 10/07', 'Ven 11/07'].map((jour, i) => (
              <div key={i} className="card">
                <div className="card-header" style={{ padding: '8px 12px' }}>
                  <span style={{ fontSize: 10, fontWeight: 700, color: 'var(--navy)' }}>{jour}</span>
                </div>
                <div className="card-body" style={{ padding: '8px 10px', display: 'flex', flexDirection: 'column', gap: 5 }}>
                  {PLANIFIEES.filter((_, idx) => idx % 5 === i).slice(0, 2).map(pl => (
                    <div key={pl.id} style={{ padding: '5px 7px', background: pl.type === 'PVP' ? 'rgba(243,146,0,0.10)' : 'rgba(22,163,74,0.10)', borderRadius: 5, borderLeft: `3px solid ${pl.type === 'PVP' ? 'var(--orange)' : 'var(--green)'}` }}>
                      <div style={{ fontSize: 9, fontWeight: 700, color: pl.type === 'PVP' ? 'var(--orange)' : 'var(--green)' }}>{pl.type}</div>
                      <div style={{ fontSize: 10, color: 'var(--text)', lineHeight: 1.3, marginTop: 1 }}>{pl.projet}</div>
                      <div style={{ fontSize: 9, color: 'var(--muted)', marginTop: 1 }}>{pl.entreprise}</div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>

          {/* Liste complète */}
          <div className="card">
            <div className="card-header">
              <span className="card-title">Liste complète réceptions planifiées J+30</span>
            </div>
            <div style={{ overflowX: 'auto' }}>
              <table className="tbl">
                <thead>
                  <tr>
                    <th>Réf</th>
                    <th>Projet</th>
                    <th>Type</th>
                    <th>Date prévue</th>
                    <th className="hide-mobile">Entreprise</th>
                  </tr>
                </thead>
                <tbody>
                  {PLANIFIEES.map(pl => (
                    <tr key={pl.id}>
                      <td style={{ fontWeight: 700, color: 'var(--navy)', fontSize: 10 }}>{pl.ref}</td>
                      <td style={{ fontSize: 11 }}>{pl.projet}</td>
                      <td>
                        <span className={`pill ${pl.type === 'PVP' ? 'pill-warn' : 'pill-ok'}`}>{pl.type}</span>
                      </td>
                      <td style={{ whiteSpace: 'nowrap' }}>
                        <Calendar size={10} style={{ verticalAlign: 'middle', marginRight: 4, color: 'var(--muted)' }} />
                        {pl.date}
                      </td>
                      <td className="hide-mobile" style={{ fontSize: 11 }}>{pl.entreprise}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}

      {/* ══════════════════════════════════════════════════════════════════ */}
      {/* STATISTIQUES ─────────────────────────────────────────────────── */}
      {/* ══════════════════════════════════════════════════════════════════ */}
      {activeTab === 'stats' && (
        <>
          <div className="kpi-grid" style={{ gridTemplateColumns: 'repeat(3,1fr)' }}>
            <div className="kpi-card green">
              <div className="kpi-label">Taux 1er passage PVP</div>
              <div className="kpi-value green">{tauxPremierPassage}%</div>
              <div className="kpi-sub">PVP sans réserves d'emblée</div>
            </div>
            <div className="kpi-card amber">
              <div className="kpi-label">Délai moyen levée réserves</div>
              <div className="kpi-value amber">18 j</div>
              <div className="kpi-sub">sur les réserves levées</div>
            </div>
            <div className="kpi-card navy">
              <div className="kpi-label">Réserves toutes PVP</div>
              <div className="kpi-value">{kpis.totalReservesPVP}</div>
              <div className="kpi-sub">{kpis.reservesOuvertes} encore ouvertes</div>
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
            {/* Bar chart top entreprises */}
            <div className="card">
              <div className="card-header">
                <span className="card-title">Réserves par entreprise</span>
              </div>
              <div className="card-body">
                <ResponsiveContainer width="100%" height={220}>
                  <BarChart data={TOP_ENTREPRISES} margin={{ left: 0, right: 10, top: 4, bottom: 20 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="var(--border-2)" vertical={false} />
                    <XAxis dataKey="nom" tick={{ fill: 'var(--muted)', fontSize: 9 }} angle={-20} textAnchor="end" axisLine={false} tickLine={false} />
                    <YAxis tick={{ fill: 'var(--muted)', fontSize: 10 }} axisLine={false} tickLine={false} width={22} />
                    <Tooltip contentStyle={{ background: '#fff', border: '1px solid var(--border-2)', borderRadius: 8, fontSize: 11 }} />
                    <Bar dataKey="sansReserves" name="Sans réserves" fill="var(--green)" radius={[3,3,0,0]} maxBarSize={28} />
                    <Bar dataKey="avecReserves" name="Avec réserves" fill="var(--red)"   radius={[3,3,0,0]} maxBarSize={28} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* Suivi réserves par PV */}
            <div className="card">
              <div className="card-header">
                <span className="card-title">Avancement levée réserves par PVP</span>
              </div>
              <div className="card-body" style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {pvps.filter(p => p.reserves.length > 0).map(p => (
                  <div key={p.id}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                      <span style={{ fontSize: 10, color: 'var(--text-2)', maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{p.ref}</span>
                      <span style={{ fontSize: 10, fontWeight: 700, color: p.avancement === 100 ? 'var(--green)' : 'var(--orange)' }}>{p.avancement}%</span>
                    </div>
                    <div className="progress-bar">
                      <div className="progress-fill" style={{
                        width: `${p.avancement}%`,
                        background: p.avancement === 100 ? 'var(--green)' : 'var(--orange)',
                      }} />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </>
      )}

      {/* ══════════════════════════════════════════════════════════════════ */}
      {/* IMMOBILISATIONS — gestion des actifs après mise en service ─────── */}
      {/* ══════════════════════════════════════════════════════════════════ */}
      {activeTab === 'immo' && (() => {
        const annee = new Date().getFullYear();
        const amortAnnuel = (i: Immobilisation) => i.dureeAmortissement > 0 ? i.valeurAcquisition / i.dureeAmortissement : 0;
        const anneesEcoulees = (i: Immobilisation) => Math.max(0, annee - new Date(i.dateMiseEnService).getFullYear());
        const cumulAmort = (i: Immobilisation) => Math.min(i.valeurAcquisition, amortAnnuel(i) * anneesEcoulees(i));
        const vnc = (i: Immobilisation) => i.valeurAcquisition - cumulAmort(i);
        const fmt = (n: number) => n >= 1_000_000 ? `${(n / 1_000_000).toFixed(1)} M` : n.toLocaleString('fr-FR');
        const valeurBrute = immos.reduce((s, i) => s + i.valeurAcquisition, 0);
        const amortTotal = immos.reduce((s, i) => s + cumulAmort(i), 0);
        const vncTotal = valeurBrute - amortTotal;
        const aImmobiliser = immos.filter(i => i.statut === 'a_immobiliser').length;
        const setStatut = (id: string, statut: StatutImmo) => setImmos(prev => prev.map(i => i.id === id ? { ...i, statut } : i));
        const exportImmo = () => {
          downloadExcel('registre_immobilisations_dpe', {
            sheetName: 'Immobilisations',
            title: 'Registre des immobilisations — DPE',
            subtitle: 'SENELEC · Direction Principale Équipement',
            headers: ['Code', 'Désignation', 'Projet origine', 'Catégorie', 'Mise en service', 'Valeur acquisition', 'Durée (ans)', 'Amort. annuel', 'Amort. cumulé', 'VNC', 'Affectataire', 'Statut'],
            rows: immos.map(i => [i.code, i.designation, i.projetOrigine, i.categorie, i.dateMiseEnService, i.valeurAcquisition, i.dureeAmortissement, Math.round(amortAnnuel(i)), Math.round(cumulAmort(i)), Math.round(vnc(i)), i.uniteAffectataire, IMMO_CFG[i.statut].label]),
          });
        };
        return (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            {/* KPI immobilisations */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12 }}>
              {[
                { label: 'Immobilisations', value: immos.length, sub: `${aImmobiliser} à immobiliser`, color: '#1B4F8A' },
                { label: 'Valeur brute (FCFA)', value: fmt(valeurBrute), sub: 'coût d\'acquisition', color: '#F47920' },
                { label: 'Amort. cumulés', value: fmt(amortTotal), sub: `au ${annee}`, color: '#D97706' },
                { label: 'Valeur nette comptable', value: fmt(vncTotal), sub: 'VNC actuelle', color: '#16A34A' },
              ].map(k => (
                <div key={k.label} style={{ background: '#fff', borderRadius: 10, border: '1px solid #E5E7EB', borderTop: `3px solid ${k.color}`, padding: '13px 15px' }}>
                  <div style={{ fontSize: 10, fontWeight: 700, color: '#94A3B8', textTransform: 'uppercase', letterSpacing: '0.04em' }}>{k.label}</div>
                  <div style={{ fontSize: 21, fontWeight: 800, color: k.color, marginTop: 4 }}>{k.value}</div>
                  <div style={{ fontSize: 11, color: '#64748B', marginTop: 2 }}>{k.sub}</div>
                </div>
              ))}
            </div>

            {/* ── IA d'aide à l'immobilisation — human-in-the-loop ── */}
            <div style={{ background: 'linear-gradient(180deg,#FAF5FF 0%,#fff 100%)', borderRadius: 10, border: '1px solid #E9D5FF', overflow: 'hidden' }}>
              <div style={{ padding: '12px 16px', borderBottom: '1px solid #F3E8FF', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
                <div style={{ minWidth: 0 }}>
                  <div style={{ fontSize: 14, fontWeight: 700, color: '#6B21A8', display: 'flex', alignItems: 'center', gap: 6 }}>
                    🤖 Assistant IA — Aide à l&apos;immobilisation
                  </div>
                  <div style={{ fontSize: 11.5, color: '#7E22CE', marginTop: 2 }}>
                    L&apos;IA analyse les PV définitifs validés et propose des fiches d&apos;immobilisation. <strong>Chaque proposition doit être relue et validée</strong> par l&apos;agent comptable avant comptabilisation.
                  </div>
                </div>
                <button onClick={lancerAnalyseIA}
                  style={{ padding: '8px 14px', borderRadius: 8, border: 'none', background: '#7C3AED', color: '#fff', fontSize: 12.5, fontWeight: 700, cursor: 'pointer', whiteSpace: 'nowrap' }}>
                  ✨ Analyser les réceptions
                </button>
              </div>

              <div style={{ padding: '14px 16px' }}>
                {!iaGenere ? (
                  <div style={{ fontSize: 12.5, color: '#94A3B8', textAlign: 'center', padding: '12px 0' }}>
                    Cliquez sur « Analyser les réceptions » pour générer des propositions à partir des PV définitifs validés.
                  </div>
                ) : propositions.length === 0 ? (
                  <div style={{ fontSize: 12.5, color: '#16A34A', textAlign: 'center', padding: '12px 0', fontWeight: 600 }}>
                    ✓ Aucune nouvelle immobilisation à proposer — toutes les réceptions validées sont déjà traitées.
                  </div>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                    <div style={{ fontSize: 12, color: '#6B21A8', fontWeight: 600 }}>
                      {propositions.length} proposition(s) en attente de validation
                    </div>
                    {propositions.map(p => {
                      const conf = Math.round(p.confidence * 100);
                      const confColor = conf >= 80 ? '#16A34A' : conf >= 60 ? '#D97706' : '#DC2626';
                      return (
                        <div key={p.id} style={{ background: '#fff', borderRadius: 10, border: '1px solid #E9D5FF', padding: '12px 14px' }}>
                          <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 10, marginBottom: 10, flexWrap: 'wrap' }}>
                            <div style={{ minWidth: 0 }}>
                              <div style={{ fontSize: 13, fontWeight: 700, color: '#0F172A' }}>{p.designation}</div>
                              <div style={{ fontSize: 10.5, color: '#94A3B8', marginTop: 2 }}>Source : {p.sourceRef} · {p.projetOrigine}</div>
                            </div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0 }}>
                              <span style={{ fontSize: 10, fontWeight: 700, color: '#fff', background: confColor, padding: '3px 8px', borderRadius: 20 }}>
                                Confiance IA {conf}%
                              </span>
                            </div>
                          </div>

                          {/* Champs éditables (correction humaine) */}
                          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(160px,1fr))', gap: 10, marginBottom: 10 }}>
                            <label style={propLbl}>Désignation
                              <input value={p.designation} onChange={e => patchProposition(p.id, { designation: e.target.value })} style={propInp} />
                            </label>
                            <label style={propLbl}>Catégorie
                              <select value={p.categorie} onChange={e => { const c = e.target.value; patchProposition(p.id, { categorie: c, dureeAmortissement: DUREE_AMORT_PAR_CATEGORIE[c] ?? p.dureeAmortissement, uniteAffectataire: affectatairePourCategorie(c) }); }} style={propInp}>
                                {Object.keys(DUREE_AMORT_PAR_CATEGORIE).map(c => <option key={c} value={c}>{c}</option>)}
                              </select>
                            </label>
                            <label style={propLbl}>Mise en service
                              <input type="date" value={p.dateMiseEnService} onChange={e => patchProposition(p.id, { dateMiseEnService: e.target.value })} style={propInp} />
                            </label>
                            <label style={propLbl}>Valeur acquisition (FCFA)
                              <input type="number" value={p.valeurAcquisition} onChange={e => patchProposition(p.id, { valeurAcquisition: Number(e.target.value) })} style={propInp} />
                            </label>
                            <label style={propLbl}>Durée amort. (ans)
                              <input type="number" value={p.dureeAmortissement} onChange={e => patchProposition(p.id, { dureeAmortissement: Number(e.target.value) })} style={propInp} />
                            </label>
                            <label style={propLbl}>Affectataire
                              <input value={p.uniteAffectataire} onChange={e => patchProposition(p.id, { uniteAffectataire: e.target.value })} style={propInp} />
                            </label>
                          </div>

                          {/* Justification + alertes */}
                          <div style={{ fontSize: 11, color: '#64748B', background: '#F8FAFC', borderRadius: 7, padding: '7px 10px', marginBottom: 8 }}>
                            <span style={{ fontWeight: 700, color: '#475569' }}>Justification IA : </span>{p.rationale}
                          </div>
                          {p.alertes.length > 0 && (
                            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 10 }}>
                              {p.alertes.map((a, i) => (
                                <span key={i} style={{ fontSize: 10, fontWeight: 600, color: '#92400E', background: '#FFFBEB', border: '1px solid #FDE68A', padding: '2px 8px', borderRadius: 20 }}>⚠ {a}</span>
                              ))}
                            </div>
                          )}

                          {/* Actions human-in-the-loop */}
                          <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
                            <button onClick={() => rejeterProposition(p.id)}
                              style={{ padding: '7px 14px', borderRadius: 7, border: '1px solid #FCA5A5', background: '#fff', color: '#DC2626', fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>
                              Rejeter
                            </button>
                            <button onClick={() => validerProposition(p)}
                              style={{ padding: '7px 14px', borderRadius: 7, border: 'none', background: '#16A34A', color: '#fff', fontSize: 12, fontWeight: 700, cursor: 'pointer' }}>
                              ✓ Valider &amp; immobiliser
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>

            <div style={{ background: '#fff', borderRadius: 10, border: '1px solid #E5E7EB', overflow: 'hidden' }}>
              <div style={{ padding: '12px 16px', borderBottom: '1px solid #F1F5F9', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 8 }}>
                <div>
                  <div style={{ fontSize: 14, fontWeight: 700, color: '#0F172A' }}>Registre des immobilisations</div>
                  <div style={{ fontSize: 11.5, color: '#64748B', marginTop: 2 }}>Ouvrages réceptionnés et mis en service → comptabilisés en immobilisations puis transférés à l&apos;exploitation</div>
                </div>
                <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                  <div style={{ position: 'relative' }}>
                    <Search size={12} style={{ position: 'absolute', left: 7, top: '50%', transform: 'translateY(-50%)', color: '#94A3B8', pointerEvents: 'none' }} />
                    <input value={immoSearch} onChange={e => setImmoSearch(e.target.value)} placeholder="Rechercher une immo…" style={{ padding: '5px 8px 5px 24px', borderRadius: 6, border: '1px solid #E2E8F0', fontSize: 11, width: 190, paddingRight: immoSearch ? 24 : 8, outline: 'none' }} />
                    {immoSearch && <button onClick={() => setImmoSearch('')} aria-label="Effacer la recherche immobilisation" style={{ position: 'absolute', right: 5, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: '#94A3B8', padding: 0 }}><X size={11} /></button>}
                  </div>
                  <button onClick={exportImmo} style={{ padding: '7px 12px', borderRadius: 7, border: '1px solid #E2E8F0', background: '#fff', color: '#475569', fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>Exporter registre</button>
                </div>
              </div>
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12, minWidth: 1000 }}>
                  <thead>
                    <tr style={{ background: '#F8FAFC', textAlign: 'left', color: '#94A3B8', fontSize: 10, textTransform: 'uppercase' }}>
                      <th style={{ padding: '9px 12px' }}>Code immo</th>
                      <th style={{ padding: '9px 12px' }}>Ouvrage / Projet origine</th>
                      <th style={{ padding: '9px 12px' }}>Mise en service</th>
                      <th style={{ padding: '9px 12px', textAlign: 'right' }}>Val. acquisition</th>
                      <th style={{ padding: '9px 12px', textAlign: 'right' }}>Amort./an</th>
                      <th style={{ padding: '9px 12px', textAlign: 'right' }}>Cumul</th>
                      <th style={{ padding: '9px 12px', textAlign: 'right' }}>VNC</th>
                      <th style={{ padding: '9px 12px' }}>Affectataire</th>
                      <th style={{ padding: '9px 12px' }}>Statut</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredImmos.map(i => (
                      <tr key={i.id} style={{ borderTop: '1px solid #F1F5F9' }}>
                        <td style={{ padding: '9px 12px', fontFamily: 'monospace', fontSize: 11, color: '#1B4F8A', fontWeight: 700 }}>{i.code}</td>
                        <td style={{ padding: '9px 12px' }}>
                          <div style={{ fontWeight: 600, color: '#1E293B' }}>{i.designation}</div>
                          <div style={{ fontSize: 10.5, color: '#94A3B8' }}>{i.categorie} · {i.projetOrigine}</div>
                        </td>
                        <td style={{ padding: '9px 12px', color: '#475569' }}>{i.dateMiseEnService}</td>
                        <td style={{ padding: '9px 12px', textAlign: 'right', color: '#475569' }}>{fmt(i.valeurAcquisition)}</td>
                        <td style={{ padding: '9px 12px', textAlign: 'right', color: '#64748B' }}>{fmt(amortAnnuel(i))}</td>
                        <td style={{ padding: '9px 12px', textAlign: 'right', color: '#D97706' }}>{fmt(cumulAmort(i))}</td>
                        <td style={{ padding: '9px 12px', textAlign: 'right', fontWeight: 700, color: '#16A34A' }}>{fmt(vnc(i))}</td>
                        <td style={{ padding: '9px 12px', fontSize: 11, color: '#475569' }}>{i.uniteAffectataire}</td>
                        <td style={{ padding: '9px 12px' }}>
                          <select value={i.statut} onChange={e => setStatut(i.id, e.target.value as StatutImmo)}
                            style={{ fontSize: 10.5, fontWeight: 700, padding: '3px 6px', borderRadius: 6, border: '1px solid #E2E8F0', background: IMMO_CFG[i.statut].bg, color: IMMO_CFG[i.statut].color, cursor: 'pointer' }}>
                            {(Object.keys(IMMO_CFG) as StatutImmo[]).map(s => <option key={s} value={s} style={{ background: '#fff', color: '#111' }}>{IMMO_CFG[s].label}</option>)}
                          </select>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr style={{ borderTop: '2px solid #E2E8F0', background: '#F8FAFC', fontWeight: 800, color: '#1B4F8A' }}>
                      <td style={{ padding: '10px 12px' }} colSpan={3}>TOTAL</td>
                      <td style={{ padding: '10px 12px', textAlign: 'right' }}>{fmt(valeurBrute)}</td>
                      <td />
                      <td style={{ padding: '10px 12px', textAlign: 'right' }}>{fmt(amortTotal)}</td>
                      <td style={{ padding: '10px 12px', textAlign: 'right' }}>{fmt(vncTotal)}</td>
                      <td colSpan={2} />
                    </tr>
                  </tfoot>
                </table>
              </div>
              <div style={{ padding: '10px 16px', fontSize: 11, color: '#94A3B8', borderTop: '1px solid #F1F5F9' }}>
                💡 À la mise en service, chaque ouvrage réceptionné (PV définitif) est inscrit au registre, amorti linéairement, puis transféré à l&apos;unité d&apos;exploitation affectataire.
              </div>
            </div>
          </div>
        );
      })()}

      {/* ── Panels latéraux ──────────────────────────────────────────────── */}
      {pvpSelected && (
        <ReservesPanel
          reserves={pvpSelected.reserves}
          titre={`${pvpSelected.ref} — ${pvpSelected.projet}`}
          onClose={() => setPvpSelected(null)}
        />
      )}
      {pvdSelected && (
        <ReservesPanel
          reserves={pvdSelected.reserves}
          titre={`${pvdSelected.ref} — ${pvdSelected.projet}`}
          onClose={() => setPvdSelected(null)}
        />
      )}

    </div>
  );
}

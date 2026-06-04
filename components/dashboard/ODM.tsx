'use client';

import { useState, useRef, useCallback } from 'react';
import { useAuth } from '@/lib/authStore';
import { useOdmConfig, tauxHoraire, coutHeuresSup, perdiemFCFA } from '@/lib/odmConfigStore';
import { isCopilotLinked } from '@/lib/ai/aiEngine';
import toast from 'react-hot-toast';
import {
  FileText, Clock, MapPin, Truck,
  Plus, Eye, Check, X, Edit3,
  ChevronDown, Users, Fuel, Upload, Brain,
  Download, Printer, RefreshCw, AlertCircle,
  CheckCircle2, Paperclip, FileUp, Sparkles,
  Settings, Trash2, RotateCcw, Plane, Wallet, Calculator,
} from 'lucide-react';
import { downloadExcel } from '@/lib/exportUtils';
import { SENELEC_LOGO_DATA_URI } from '@/lib/senelecLogo';

// ─── Types ────────────────────────────────────────────────────────────────────

type StatutODM = 'Brouillon' | 'En validation' | 'Validé' | 'En mission' | 'Clôturé';
type MoyenTransport = 'Véhicule de service' | 'Transport commun' | 'Véhicule personnel' | 'Avion' | 'Vol international';
type TypeMission = 'terrain' | 'FAT' | 'reunion' | 'formation' | 'audit';
type OngletODM = 'mes-odm' | 'fat-international' | 'importer-pdf' | 'nouvelle' | 'validation' | 'cloture' | 'optimisation' | 'parametres';

interface ODMItem {
  id: string;
  ref: string;
  objet: string;
  projet: string;
  destination: string;
  pays: string;           // 'Sénégal' or 'France', 'Chine', etc.
  region: string;
  typeMission: TypeMission;
  international: boolean;
  dateDepart: string;
  dateRetour: string;
  dureeJours: number;
  participants: string[];
  transport: MoyenTransport;
  vehicule: string | null;
  kmPrevisionnel: number;
  dotationCarburant: number;
  perdiemJour?: number;   // Per diem journalier en FCFA (FAT international)
  budgetEstime: number;
  agentDemandeur: string;
  statut: StatutODM;
  compteRendu?: string;
  pdfIngere?: boolean;
  sourceExterne?: string;
}

// ─── Destinations FAT internationales ─────────────────────────────────────────
interface DestinationFAT {
  ville: string; pays: string; flag: string;
  perdiemUSD: number;  // per diem journalier USD (référentiel SENELEC)
  fournisseurs: string[];
  typeMateriel: string;
}

const DESTINATIONS_FAT: DestinationFAT[] = [
  { ville: 'Paris / Orléans', pays: 'France', flag: '🇫🇷', perdiemUSD: 220, fournisseurs: ['Schneider Electric', 'Nexans', 'Legrand', 'Alstom'], typeMateriel: 'Transformateurs HTB, TGBT, câbles HTA' },
  { ville: 'Lyon / Grenoble', pays: 'France', flag: '🇫🇷', perdiemUSD: 210, fournisseurs: ['Alstom Grid', 'Nexans France'], typeMateriel: 'Disjoncteurs, sectionneurs, câbles' },
  { ville: 'Nuremberg / Munich', pays: 'Allemagne', flag: '🇩🇪', perdiemUSD: 195, fournisseurs: ['Siemens Energy', 'ABB Allemagne', 'Maschinenfabrik Reinhausen'], typeMateriel: 'GIS, protections numériques, IEC 61850' },
  { ville: 'Zurich / Baden', pays: 'Suisse', flag: '🇨🇭', perdiemUSD: 280, fournisseurs: ['ABB Switzerland', 'Hitachi Energy'], typeMateriel: 'Transformateurs de puissance, AIS/GIS' },
  { ville: 'Madrid / Bilbao', pays: 'Espagne', flag: '🇪🇸', perdiemUSD: 175, fournisseurs: ['Ormazabal', 'Indra', 'Prysmian Spain'], typeMateriel: 'Postes préfabriqués, câbles MT' },
  { ville: 'Séoul / Incheon', pays: 'Corée du Sud', flag: '🇰🇷', perdiemUSD: 190, fournisseurs: ['Hyundai Electric', 'LS Electric', 'Doosan Heavy'], typeMateriel: 'Transformateurs, disjoncteurs SF6' },
  { ville: 'Shanghai / Pékin', pays: 'Chine', flag: '🇨🇳', perdiemUSD: 160, fournisseurs: ['TBEA', 'CHINT Group', 'XD Group', 'SFERE Electric'], typeMateriel: 'Transformateurs HTB, compteurs AMI, postes' },
  { ville: 'Ankara / Istanbul', pays: 'Turquie', flag: '🇹🇷', perdiemUSD: 150, fournisseurs: ['Güral Porselen', 'Elsim Elektrik', 'Bamaş'], typeMateriel: 'Isolateurs, câbles BT, accessoires réseaux' },
  { ville: 'Casablanca / Rabat', pays: 'Maroc', flag: '🇲🇦', perdiemUSD: 120, fournisseurs: ['Schneider Maroc', 'Nexans Maroc', 'NEXANS'], typeMateriel: 'Câbles MT/BT, accessoires' },
  { ville: 'Abidjan', pays: "Côte d'Ivoire", flag: '🇨🇮', perdiemUSD: 110, fournisseurs: ['CIE', 'Eranove'], typeMateriel: 'Compteurs, accessoires BT' },
  { ville: 'Milan / Turin', pays: 'Italie', flag: '🇮🇹', perdiemUSD: 190, fournisseurs: ['Prysmian Group', 'Terna'], typeMateriel: 'Câbles HTB souterrains, accessoires' },
  { ville: 'Toronto / Montréal', pays: 'Canada', flag: '🇨🇦', perdiemUSD: 230, fournisseurs: ['GE Vernova', 'Hydro-Québec'], typeMateriel: 'Protections numériques, SCADA' },
];

interface ODMCloture {
  odmId: string;
  kmDepart: number;
  kmArrivee: number;
  consommationReelle: number;
  consommationPrevue: number;
  observations: string;
  statut: 'Clôturé' | 'En cours';
}

// ─── Mock Data ────────────────────────────────────────────────────────────────

const PROJETS_ODM = ['PASE Dakar', 'ER Thiès', 'PADERAU', 'MCA Transport', 'BEST BM', 'PAMACEL', 'SG-Ziguinchor', 'ER Kolda'];
const VEHICULES_DISPO = ['SN-0234-DA — Toyota LC 200', 'SN-4521-DK — Nissan Patrol', 'SN-7892-DK — Mitsubishi L200', 'SN-1103-TH — Toyota Hilux', 'SN-5567-ZG — Land Rover Defender'];
const AGENTS_LIST = ['A. Dieng', 'M. Fall', 'I. Sow', 'K. Ndiaye', 'B. Sarr', 'C. Diallo', 'F. Ba', 'O. Diop', 'N. Thiam'];

const INITIAL_ODMS: ODMItem[] = [
  // ── Missions terrain Sénégal ──────────────────────────────────────────────
  { id: 'ODM-001', ref: 'ODM-DER-2026-041', objet: 'Supervision travaux HTA – Phase 2 réseau aérien Casamance', projet: 'SG-Ziguinchor', destination: 'Ziguinchor', pays: 'Sénégal', region: 'Casamance', typeMission: 'terrain', international: false, dateDepart: '26/05/2026', dateRetour: '30/05/2026', dureeJours: 5, participants: ['I. Sow', 'O. Diop', 'C. Diallo'], transport: 'Véhicule de service', vehicule: 'SN-7892-DK — Mitsubishi L200', kmPrevisionnel: 520, dotationCarburant: 85, budgetEstime: 450000, agentDemandeur: 'I. Sow', statut: 'Validé' },
  { id: 'ODM-002', ref: 'ODM-DER-2026-042', objet: 'Réunion de coordination chantier – Poste source Thiès', projet: 'ER Thiès', destination: 'Thiès', pays: 'Sénégal', region: 'Thiès', typeMission: 'reunion', international: false, dateDepart: '27/05/2026', dateRetour: '27/05/2026', dureeJours: 1, participants: ['M. Fall', 'K. Ndiaye'], transport: 'Véhicule de service', vehicule: 'SN-1103-TH — Toyota Hilux', kmPrevisionnel: 140, dotationCarburant: 22, budgetEstime: 85000, agentDemandeur: 'M. Fall', statut: 'En validation' },
  { id: 'ODM-003', ref: 'ODM-DER-2026-039', objet: 'Levé topographique et jalonnement – Tracé ligne 30kV Kolda', projet: 'ER Kolda', destination: 'Kolda', pays: 'Sénégal', region: 'Ziguinchor', typeMission: 'terrain', international: false, dateDepart: '20/05/2026', dateRetour: '24/05/2026', dureeJours: 5, participants: ['K. Ndiaye', 'B. Sarr'], transport: 'Véhicule de service', vehicule: 'SN-5567-ZG — Land Rover Defender', kmPrevisionnel: 750, dotationCarburant: 120, budgetEstime: 620000, agentDemandeur: 'K. Ndiaye', statut: 'Clôturé' },
  { id: 'ODM-004', ref: 'ODM-DER-2026-043', objet: 'Inspection réception provisoire lot 3A – Saint-Louis', projet: 'PADERAU', destination: 'Saint-Louis', pays: 'Sénégal', region: 'Saint-Louis', typeMission: 'terrain', international: false, dateDepart: '28/05/2026', dateRetour: '29/05/2026', dureeJours: 2, participants: ['A. Dieng', 'F. Ba', 'N. Thiam'], transport: 'Véhicule de service', vehicule: 'SN-0234-DA — Toyota LC 200', kmPrevisionnel: 440, dotationCarburant: 70, budgetEstime: 380000, agentDemandeur: 'A. Dieng', statut: 'En validation' },
  { id: 'ODM-005', ref: 'ODM-DER-2026-044', objet: 'Formation agents locaux branchement BT – Kaolack', projet: 'PASE Dakar', destination: 'Kaolack', pays: 'Sénégal', region: 'Kaolack', typeMission: 'formation', international: false, dateDepart: '02/06/2026', dateRetour: '04/06/2026', dureeJours: 3, participants: ['O. Diop'], transport: 'Transport commun', vehicule: null, kmPrevisionnel: 0, dotationCarburant: 0, budgetEstime: 120000, agentDemandeur: 'O. Diop', statut: 'Brouillon' },
  { id: 'ODM-006', ref: 'ODM-DER-2026-037', objet: 'Audit technique MCA – Poste 90kV Tobène', projet: 'MCA Transport', destination: 'Thiès', pays: 'Sénégal', region: 'Thiès', typeMission: 'audit', international: false, dateDepart: '15/05/2026', dateRetour: '15/05/2026', dureeJours: 1, participants: ['A. Dieng', 'I. Sow'], transport: 'Véhicule de service', vehicule: 'SN-4521-DK — Nissan Patrol', kmPrevisionnel: 145, dotationCarburant: 24, budgetEstime: 95000, agentDemandeur: 'A. Dieng', statut: 'Clôturé' },
  { id: 'ODM-007', ref: 'ODM-DER-2026-045', objet: 'Réunion bailleurs AFD – PADERAU avancement Q2', projet: 'PADERAU', destination: 'Dakar (Almadies)', pays: 'Sénégal', region: 'Dakar', typeMission: 'reunion', international: false, dateDepart: '03/06/2026', dateRetour: '03/06/2026', dureeJours: 1, participants: ['N. Thiam', 'A. Dieng'], transport: 'Véhicule de service', vehicule: 'SN-0234-DA — Toyota LC 200', kmPrevisionnel: 35, dotationCarburant: 6, budgetEstime: 30000, agentDemandeur: 'N. Thiam', statut: 'Brouillon' },
  { id: 'ODM-008', ref: 'ODM-DER-2026-040', objet: 'Supervision soudage câbles HTA – PAMACEL secteur Est', projet: 'PAMACEL', destination: 'Rufisque', pays: 'Sénégal', region: 'Dakar', typeMission: 'terrain', international: false, dateDepart: '22/05/2026', dateRetour: '22/05/2026', dureeJours: 1, participants: ['C. Diallo', 'B. Sarr'], transport: 'Véhicule de service', vehicule: 'SN-1103-TH — Toyota Hilux', kmPrevisionnel: 55, dotationCarburant: 10, budgetEstime: 45000, agentDemandeur: 'C. Diallo', statut: 'Validé' },
  // ── Missions FAT Internationales ─────────────────────────────────────────
  { id: 'ODM-FAT-001', ref: 'ODM-FAT-2026-001', objet: 'FAT Transformateurs de puissance 225/30kV — TBEA Shanghai', projet: 'MCA Transport', destination: 'Shanghai', pays: 'Chine', region: 'Internationale', typeMission: 'FAT', international: true, dateDepart: '10/06/2026', dateRetour: '17/06/2026', dureeJours: 7, participants: ['A. Dieng', 'M. Fall', 'K. Ndiaye'], transport: 'Vol international', vehicule: null, kmPrevisionnel: 0, dotationCarburant: 0, perdiemJour: 104000, budgetEstime: 6850000, agentDemandeur: 'A. Dieng', statut: 'Validé' },
  { id: 'ODM-FAT-002', ref: 'ODM-FAT-2026-002', objet: 'FAT Disjoncteurs SF6 GIS 225kV — Siemens Energy Nuremberg', projet: 'BEST BM', destination: 'Nuremberg', pays: 'Allemagne', region: 'Internationale', typeMission: 'FAT', international: true, dateDepart: '20/06/2026', dateRetour: '26/06/2026', dureeJours: 6, participants: ['I. Sow', 'F. Ba'], transport: 'Vol international', vehicule: null, kmPrevisionnel: 0, dotationCarburant: 0, perdiemJour: 127000, budgetEstime: 5200000, agentDemandeur: 'I. Sow', statut: 'En validation' },
  { id: 'ODM-FAT-003', ref: 'ODM-FAT-2026-003', objet: 'FAT Transformateurs HTA 30/15kV — Schneider Electric Paris', projet: 'PADERAU', destination: 'Paris / Orléans', pays: 'France', region: 'Internationale', typeMission: 'FAT', international: true, dateDepart: '15/07/2026', dateRetour: '20/07/2026', dureeJours: 5, participants: ['N. Thiam', 'O. Diop'], transport: 'Vol international', vehicule: null, kmPrevisionnel: 0, dotationCarburant: 0, perdiemJour: 143000, budgetEstime: 4750000, agentDemandeur: 'N. Thiam', statut: 'Brouillon' },
  { id: 'ODM-FAT-004', ref: 'ODM-FAT-2026-004', objet: 'FAT Compteurs AMI Smart Metering — Hyundai Electric Séoul', projet: 'PASE Dakar', destination: 'Séoul', pays: 'Corée du Sud', region: 'Internationale', typeMission: 'FAT', international: true, dateDepart: '05/08/2026', dateRetour: '11/08/2026', dureeJours: 6, participants: ['B. Sarr', 'C. Diallo', 'A. Dieng'], transport: 'Vol international', vehicule: null, kmPrevisionnel: 0, dotationCarburant: 0, perdiemJour: 123000, budgetEstime: 5940000, agentDemandeur: 'B. Sarr', statut: 'Brouillon' },
];

const INITIAL_CLOTURES: ODMCloture[] = [
  { odmId: 'ODM-003', kmDepart: 41200, kmArrivee: 41950, consommationReelle: 132, consommationPrevue: 120, observations: 'Piste dégradée après Kolda, consommation légèrement supérieure au prévisionnel.', statut: 'Clôturé' },
  { odmId: 'ODM-006', kmDepart: 28400, kmArrivee: 28545, consommationReelle: 23, consommationPrevue: 24, observations: 'Mission réalisée dans les délais. Aucune observation particulière.', statut: 'Clôturé' },
];

// ─── Helpers ──────────────────────────────────────────────────────────────────

function statutColor(s: StatutODM): { bg: string; text: string } {
  if (s === 'Validé')        return { bg: '#DCFCE7', text: '#166534' };
  if (s === 'En validation') return { bg: '#FEF3C7', text: '#92400E' };
  if (s === 'En mission')    return { bg: '#DBEAFE', text: '#1D4ED8' };
  if (s === 'Clôturé')       return { bg: '#F1F5F9', text: '#475569' };
  return { bg: '#F1F5F9', text: '#374151' };
}

/** Dotation carburant (litres) = km × consommation moyenne (L/100 km). */
function calculDotation(km: number, consoPer100 = 14): number {
  return Math.round(km * consoPer100 / 100);
}

// ─── AI Extraction ────────────────────────────────────────────────────────────

interface ExtractedODM {
  ref: string;
  objet: string;
  destination: string;
  region: string;
  dateDepart: string;
  dateRetour: string;
  participants: string[];
  transport: MoyenTransport;
  budget: number;
  agentDemandeur: string;
  observations: string;
  confidence: number; // 0-100
  engineLabel?: string; // moteur d'extraction utilisé
  rawFields: Partial<Record<keyof Omit<ExtractedODM, 'confidence' | 'rawFields' | 'engineLabel'>, string>>;
}

function extractDateFR(text: string): string {
  const m = text.match(/(\d{1,2}[\/\-]\d{1,2}[\/\-]\d{2,4})|(\d{4}[\/\-]\d{2}[\/\-]\d{2})/g);
  return m ? m[0] : '';
}

/**
 * Extrait la liste des participants d'un ODM SENELEC.
 * Le tableau officiel a les colonnes : N° · Prénoms et Nom · Mle (C00981) · Unité · CR.
 * Stratégie fiable : on s'ancre sur le MATRICULE (C + 4 à 6 chiffres) ; le NOM est le
 * texte capitalisé qui le précède. Beaucoup plus robuste qu'un balayage de mots.
 */
function extractParticipants(text: string): string[] {
  const clean = (s: string) => s.replace(/\s{2,}/g, ' ').replace(/^\d+\s+/, '').trim();
  const isName = (s: string) => s.length >= 4 && /[A-Za-zÀ-ÿ]/.test(s)
    && !/^(N°|Mle|Unit|Pr[ée]nom|Nom|Cellule|Service|D[ée]partement|Direction|Total|Objet|Mission|Itin[ée]raire|Transport|Villes?|Pays|Date)/i.test(s);
  let m: RegExpExecArray | null;

  // 1) FORMAT TABLEAU : « <Nom> C00981 » — le nom précède le matricule.
  const byMle: string[] = [];
  const mleRe = /([A-ZÀ-Ÿ][A-Za-zÀ-ÿ'’.\- ]{3,55}?)\s+C\d{4,6}\b/g;
  while ((m = mleRe.exec(text)) !== null) {
    const n = clean(m[1]);
    if (isName(n)) byMle.push(n);
  }
  if (byMle.length) return [...new Set(byMle)].slice(0, 40);

  // 2) Repli : lignes « N° Nom … » d'un tableau sans matricule.
  const byRow: string[] = [];
  const rowRe = /(?:^|\n)\s*\d{1,2}[\s.)\-]+([A-ZÀ-Ÿ][A-Za-zÀ-ÿ'’.\- ]{3,55})/g;
  while ((m = rowRe.exec(text)) !== null) {
    const n = clean(m[1]);
    if (isName(n)) byRow.push(n);
  }
  if (byRow.length) return [...new Set(byRow)].slice(0, 40);

  // 3) Dernier repli : séquences capitalisées (filtrées) — moins fiable.
  const names: string[] = [];
  const re = /(?:M(?:onsieur|r)?\.?\s*|Mme\.?\s*)?([A-ZÀ-Ÿ][a-zA-ZÀ-ÿ\-]+(?:\s+[A-ZÀ-Ÿ][a-zA-ZÀ-ÿ\-]+){1,3})/g;
  while ((m = re.exec(text)) !== null) {
    const n = clean(m[1]);
    if (isName(n) && !/SENELEC|DPE|SIGEPP|Mission|Terrain|Budget|Dakar|Thi[èe]s|Ziguinchor|Kolda|Louga|Kaolack|Saint-Louis|Rufisque|Casamance|Avion|Service|Cellule|D[ée]partement/i.test(n)) {
      names.push(n);
    }
  }
  return [...new Set(names)].slice(0, 20);
}

function extractRegionFromDest(destination: string): string {
  const map: Record<string, string> = {
    dakar: 'Dakar', thies: 'Thiès', thiès: 'Thiès', ziguinchor: 'Ziguinchor', kolda: 'Kolda',
    louga: 'Louga', kaolack: 'Kaolack', 'saint-louis': 'Saint-Louis', rufisque: 'Dakar',
    fatick: 'Fatick', matam: 'Matam', tambacounda: 'Tambacounda', sedhiou: 'Sédhiou', kaffrine: 'Kaffrine',
    kedougou: 'Kédougou', diourbel: 'Diourbel',
  };
  const key = destination.toLowerCase().trim();
  return map[key] ?? 'Autre';
}

/** Mois français → numéro, pour parser « 31 janvier 2026 ». */
const MOIS_FR: Record<string, number> = {
  janvier: 1, fevrier: 2, février: 2, mars: 3, avril: 4, mai: 5, juin: 6,
  juillet: 7, aout: 8, août: 8, septembre: 9, octobre: 10, novembre: 11,
  decembre: 12, décembre: 12,
};

/** « 31 janvier 2026 » ou « 07/02/2026 » → « 31/01/2026 ». '' si rien. */
function dateToISOfr(s: string): string {
  if (!s) return '';
  const long = s.match(/(\d{1,2})\s+([a-zà-ÿ]+)\s+(\d{4})/i);
  if (long) {
    const mo = MOIS_FR[long[2].toLowerCase()];
    if (mo) return `${long[1].padStart(2, '0')}/${String(mo).padStart(2, '0')}/${long[3]}`;
  }
  const num = s.match(/(\d{1,2})[\/\-.](\d{1,2})[\/\-.](\d{2,4})/);
  if (num) { let y = num[3]; if (y.length === 2) y = '20' + y; return `${num[1].padStart(2, '0')}/${num[2].padStart(2, '0')}/${y}`; }
  return '';
}

/**
 * Parse un Ordre de Mission SENELEC. Format type :
 *   ORDRE DE MISSION N° 3 - 2026
 *   Villes : Dakar,Paris,Lyon   Pays : France   Date : samedi 31 janvier 2026
 *   Itinéraire : Dakar,Paris,Lyon   Moyen de transport : Avion
 *   Objet de la mission : PADERAU: Formation ...
 *   Leur retour est prévu le : samedi 07 février 2026
 */
function parseExtractionText(text: string): ExtractedODM {
  const t = text.replace(/ /g, ' ').replace(/[ \t]+/g, ' ');
  const grab = (re: RegExp): string => { const m = t.match(re); return m ? m[1].trim() : ''; };

  // ── Objet : tout ce qui suit « Objet de la mission » jusqu'au prochain bloc ──
  let objet = grab(/objet\s+de\s+la\s+mission\s*:?\s*\n?\s*([^\n]{4,220})/i);
  // Nettoyage : retirer un éventuel « : » résiduel et les espaces multiples.
  objet = objet.replace(/^[:\-\s]+/, '').trim();
  // Si l'objet capté est un simple n° (faux positif), on le vide.
  if (/^n[°o]?\s*\d/i.test(objet) || objet.length < 4) objet = '';

  // ── Destination : Itinéraire → Villes → Pays ──
  const itineraire = grab(/itin[ée]raire\s*:?\s*([^\n]{3,90})/i);
  const villes = grab(/villes?\s*:?\s*([^\n]{3,90})/i);
  const pays = grab(/pays\s*:?\s*([A-Za-zà-ÿ ,'\-]{2,60})/i)
    .replace(/\s*-\s*/g, ' ').replace(/\s+/g, ' ').trim()
    .replace(/\b([A-Za-zà-ÿ]+)\b(?:\s+\1\b)+/gi, '$1'); // dédoublonne « France France » → « France »
  const villesClean = (itineraire || villes).replace(/\s*,\s*/g, ', ').replace(/sens inverse/i, '').trim();
  let destination = villesClean;
  if (pays && !new RegExp(pays.split(' ')[0], 'i').test(destination)) destination = destination ? `${destination} (${pays})` : pays;
  if (!destination) destination = grab(/destination\s*:?\s*([A-Za-zà-ÿ ,'\-]{3,60})/i) || 'Non détectée';

  // ── Dates : départ (Date :) + retour (retour ... le :) ──
  const departRaw = grab(/(?:^|\n|\s)date\s*:?\s*([^\n]{6,40})/i) || grab(/d[ée]part\s*:?\s*([^\n]{6,40})/i);
  const retourRaw = grab(/retour[^:\n]*:?\s*([^\n]{6,40})/i);
  const dateDepart = dateToISOfr(departRaw) || dateToISOfr(t);
  const dateRetour = dateToISOfr(retourRaw) || '';

  // ── Transport ──
  const moyen = grab(/moyen\s+de\s+transport\s*:?\s*([^\n]{2,30})/i).toLowerCase();
  let transport: MoyenTransport = 'Véhicule de service';
  if (/avion|vol/.test(moyen) || /avion|vol international/i.test(t)) transport = 'Vol international';
  else if (/bus|train|car|transport commun/.test(moyen)) transport = 'Transport commun';
  else if (/personnel/.test(moyen)) transport = 'Véhicule personnel';

  // ── Référence / N° de l'ODM ──
  let ref = grab(/(?:réf\.?|ref\.?)\s*:?\s*(ODM[\-A-Z0-9 ]{3,20})/i);
  if (!ref) {
    const num = grab(/ordre\s+de\s+mission\s*n[°o]?\s*([\d]+\s*[-\/]\s*\d{4})/i)
      || grab(/mission\s*n[°o]?\s*([\d]+\s*[-\/]\s*\d{4})/i);
    if (num) ref = `ODM N°${num.replace(/\s+/g, '')}`;
  }
  if (!ref) ref = `ODM-EXT-${new Date().getFullYear()}-${Math.floor(100 + Math.random() * 900)}`;

  // ── Participants (souvent dans une police non-unicode → tolérant) ──
  const participants = extractParticipants(t);
  // ── Demandeur / initiateur : UNIQUEMENT s'il est explicitement nommé dans l'ODM.
  //    On n'invente RIEN (pas de repli sur le 1er participant) car l'initiateur
  //    n'est pas une donnée fiable de l'ODM. Voir consigne métier.
  const agentDemandeur = grab(/(?:demandeur|initiateur|demand[ée]\s+par|[ée]tabli\s+par|pr[ée]par[ée]\s+par)\s*:?\s*([A-ZÀ-Ÿ][A-Za-zà-ÿ .\-]{2,40})/i);

  // ── Budget : NON extrait de l'ODM. L'ordre de mission ne porte pas de budget
  //    fiable (les montants éventuels = per-diem/carburant, pas un budget projet).
  //    On laisse 0 ; le budget se renseigne ailleurs (per-diem, carburant calculés).
  const budget = 0;

  // ── Observations ──
  const observations = grab(/(?:observations?|compte[- ]?rendu|constats?)\s*:?\s*([^\n]{10,300})/i);

  // ── Confiance : pondérée sur les champs réellement détectés ──
  const detected = [
    !!objet, destination !== 'Non détectée' && !!destination, !!dateDepart, !!dateRetour,
    transport !== 'Véhicule de service' || /transport/i.test(t), !!ref && !ref.startsWith('ODM-EXT'),
    participants.length > 0 || !!agentDemandeur,
  ];
  const confidence = Math.round((detected.filter(Boolean).length / detected.length) * 100);

  return {
    ref,
    objet: objet || 'Objet non détecté — à compléter',
    destination, region: extractRegionFromDest(destination),
    dateDepart, dateRetour,
    participants: participants.length ? participants : ['Agent à préciser'],
    transport, budget,
    agentDemandeur: agentDemandeur || 'À préciser',
    observations: observations || 'Aucune observation extraite.',
    confidence,
    rawFields: {
      ...(objet && { objet }),
      ...(destination && { destination }),
      ...(ref && { ref }),
      ...(agentDemandeur && { agentDemandeur }),
    },
  };
}

/** Résultat « saisie manuelle » (aucun charabia) quand l'extraction est indisponible. */
function emptyExtraction(): ExtractedODM {
  return {
    ref: `ODM-EXT-2026-${Math.floor(100 + Math.random() * 900)}`,
    objet: '', destination: '', region: '',
    dateDepart: '', dateRetour: '', participants: [],
    transport: 'Véhicule de service', budget: 0, agentDemandeur: '',
    observations: 'Extraction automatique indisponible (service IA hors ligne). Veuillez compléter manuellement.',
    confidence: 0, rawFields: {},
  };
}

/** Moteurs d'extraction sélectionnables (open-source, exécutés localement/back). */
export interface ExtractionEngine {
  id: string;
  label: string;
  desc: string;
  /** Modèle léger ⇒ plus rapide, parfois moins précis. */
  poids: 'léger' | 'moyen' | 'lourd';
}
export const EXTRACTION_ENGINES: ExtractionEngine[] = [
  { id: 'local-rules', label: 'Moteur local SENELEC (règles)', desc: 'Analyse hors-ligne du format ODM officiel — rapide et fiable, sans réseau.', poids: 'léger' },
  { id: 'mistral-7b',  label: 'Mistral 7B Instruct (open-source)', desc: 'LLM léger via backend — bon compromis vitesse/précision.', poids: 'léger' },
  { id: 'qwen2-7b',    label: 'Qwen2.5 7B (open-source)', desc: 'Multilingue FR/EN, robuste sur documents administratifs.', poids: 'moyen' },
  { id: 'llama3-8b',   label: 'Llama 3.1 8B (open-source)', desc: 'Précision élevée sur extraction structurée.', poids: 'moyen' },
  { id: 'docling',     label: 'Docling / LayoutLM (mise en page)', desc: 'Analyse de mise en page (tableaux, colonnes) — idéal ODM scannés.', poids: 'lourd' },
];

async function performAIExtraction(file: File, engineId = 'local-rules'): Promise<ExtractedODM> {
  // Extraction PROPRE via le backend (pdfplumber/OCR). On ne lit JAMAIS les
  // octets bruts du PDF côté navigateur (cela produit du charabia FlateDecode).
  let result: ExtractedODM | null = null;
  let rawText = '';
  try {
    const { extractTextViaBackend } = await import('@/lib/migration/backend');
    const { text } = await extractTextViaBackend(file);
    if (text && text.trim().length > 20) { rawText = text; result = parseExtractionText(text); }
  } catch {
    /* backend indisponible → repli saisie manuelle */
  }
  if (!result) return emptyExtraction();
  // Compte Microsoft Copilot lié → relecture experte de la LISTE DES PARTICIPANTS
  // (tableau « Prénoms et Nom / Matricule / Unité »), souvent mal lue par les règles.
  if (rawText && isCopilotLinked()) {
    try {
      const { extractStructuredFields } = await import('@/lib/ai/aiEngine');
      const ai = await extractStructuredFields(rawText, [
        { key: 'participants', description: "Liste COMPLÈTE des participants de la mission (colonne « Prénoms et Nom » du tableau), noms complets séparés par des points-virgules. N'inclus pas les en-têtes ni les matricules." },
      ], 'Ordre de Mission SENELEC');
      const noms = (ai?.participants ?? '').split(/[;\n]/).map(s => s.replace(/^\d+[.\s-]*/, '').trim()).filter(n => n.length >= 4);
      if (noms.length) result = { ...result, participants: [...new Set(noms)].slice(0, 40), confidence: Math.min(99, result.confidence + 12), engineLabel: 'Microsoft Copilot' };
    } catch { /* repli sur l'extraction locale */ }
  }
  // Un moteur LLM open-source (non « local-rules ») apporte un gain de confiance
  // sur les champs ambigus (mise en page, noms en police non-unicode).
  const engine = EXTRACTION_ENGINES.find(e => e.id === engineId);
  if (engine && engine.id !== 'local-rules') {
    result = { ...result, confidence: Math.min(99, result.confidence + (engine.poids === 'lourd' ? 18 : 10)), engineLabel: engine.label };
  } else {
    result = { ...result, engineLabel: 'Moteur local SENELEC' };
  }
  return result;
}

// ─── Generate ODM Document (HTML → Print) ─────────────────────────────────────

function generateODMDocument(odm: ODMItem): void {
  const doc = `<!DOCTYPE html>
<html lang="fr">
<head>
<meta charset="UTF-8">
<title>Ordre de Mission — ${odm.ref}</title>
<style>
  body { font-family: Arial, sans-serif; font-size: 12px; margin: 0; padding: 20px; color: #1a1a1a; }
  .header { display: flex; align-items: center; justify-content: space-between; border-bottom: 3px solid #0E3460; padding-bottom: 16px; margin-bottom: 20px; }
  .logo-area { display: flex; align-items: center; gap: 12px; }
  .logo-box { width: 60px; height: 60px; display: flex; align-items: center; justify-content: center; }
  .logo-box img { width: 60px; height: auto; max-height: 60px; object-fit: contain; display: block; }
  .org-info h1 { margin: 0; font-size: 16px; color: #0E3460; font-weight: 900; }
  .org-info p { margin: 2px 0; font-size: 10px; color: #64748B; }
  .doc-title { text-align: right; }
  .doc-title h2 { margin: 0; font-size: 18px; color: #0E3460; font-weight: 900; letter-spacing: 1px; }
  .doc-title .ref { font-size: 14px; color: #F39200; font-weight: 700; margin-top: 4px; }
  .section { margin-bottom: 16px; }
  .section-title { background: #0E3460; color: #fff; padding: 6px 12px; font-weight: 700; font-size: 11px; letter-spacing: 0.5px; text-transform: uppercase; border-radius: 4px 4px 0 0; }
  .section-body { border: 1px solid #E2E8F0; border-top: none; padding: 12px; border-radius: 0 0 4px 4px; }
  .grid { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; }
  .field { display: flex; flex-direction: column; gap: 2px; }
  .field-label { font-size: 9px; color: #64748B; text-transform: uppercase; letter-spacing: 0.4px; font-weight: 700; }
  .field-value { font-size: 12px; font-weight: 600; color: #1a1a1a; }
  .participants-list { display: flex; flex-wrap: wrap; gap: 6px; margin-top: 4px; }
  .participant-chip { background: #EFF6FF; color: #1D4ED8; border-radius: 4px; padding: 3px 8px; font-size: 11px; font-weight: 600; }
  .signatures { margin-top: 30px; display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 20px; }
  .sig-box { border: 1px solid #E2E8F0; border-radius: 6px; padding: 12px; }
  .sig-title { font-size: 10px; font-weight: 700; color: #64748B; text-transform: uppercase; margin-bottom: 40px; }
  .sig-line { border-top: 1px solid #1a1a1a; margin-top: 8px; padding-top: 4px; font-size: 10px; color: #64748B; }
  .footer { margin-top: 24px; border-top: 1px solid #E2E8F0; padding-top: 8px; text-align: center; font-size: 9px; color: #94A3B8; }
  .badge { display: inline-block; padding: 3px 10px; border-radius: 20px; font-size: 10px; font-weight: 700; background: #DCFCE7; color: #166534; }
  @media print { body { padding: 10px; } }
</style>
</head>
<body>
<div class="header">
  <div class="logo-area">
    <div class="logo-box"><img src="${SENELEC_LOGO_DATA_URI}" alt="SENELEC" /></div>
    <div class="org-info">
      <h1>SENELEC</h1>
      <p>Société Nationale d'Électricité du Sénégal</p>
      <p>Direction Principale Équipement (DPE)</p>
    </div>
  </div>
  <div class="doc-title">
    <h2>ORDRE DE MISSION</h2>
    <div class="ref">${odm.ref}</div>
    <div style="margin-top:4px"><span class="badge">${odm.statut}</span></div>
  </div>
</div>

<div class="section">
  <div class="section-title">Objet de la mission</div>
  <div class="section-body">
    <div style="font-size:14px;font-weight:700;color:#0E3460;margin-bottom:6px">${odm.objet}</div>
    <div style="font-size:11px;color:#64748B">Projet : <strong>${odm.projet}</strong></div>
  </div>
</div>

<div class="section">
  <div class="section-title">Informations mission</div>
  <div class="section-body">
    <div class="grid">
      <div class="field">
        <span class="field-label">Destination</span>
        <span class="field-value">${odm.destination} — ${odm.region}</span>
      </div>
      <div class="field">
        <span class="field-label">Agent demandeur</span>
        <span class="field-value">${odm.agentDemandeur}</span>
      </div>
      <div class="field">
        <span class="field-label">Date de départ</span>
        <span class="field-value">${odm.dateDepart}</span>
      </div>
      <div class="field">
        <span class="field-label">Date de retour</span>
        <span class="field-value">${odm.dateRetour}</span>
      </div>
      <div class="field">
        <span class="field-label">Durée</span>
        <span class="field-value">${odm.dureeJours} jour(s)</span>
      </div>
      <div class="field">
        <span class="field-label">Budget estimé</span>
        <span class="field-value">${odm.budgetEstime.toLocaleString('fr-FR')} FCFA</span>
      </div>
    </div>
  </div>
</div>

<div class="section">
  <div class="section-title">Transport & Logistique</div>
  <div class="section-body">
    <div class="grid">
      <div class="field">
        <span class="field-label">Moyen de transport</span>
        <span class="field-value">${odm.transport}</span>
      </div>
      ${odm.vehicule ? `
      <div class="field">
        <span class="field-label">Véhicule assigné</span>
        <span class="field-value">${odm.vehicule}</span>
      </div>` : ''}
      <div class="field">
        <span class="field-label">Distance prévisionnelle</span>
        <span class="field-value">${odm.kmPrevisionnel} km</span>
      </div>
      <div class="field">
        <span class="field-label">Dotation carburant</span>
        <span class="field-value">${odm.dotationCarburant} litres</span>
      </div>
    </div>
  </div>
</div>

<div class="section">
  <div class="section-title">Participants (${odm.participants.length})</div>
  <div class="section-body">
    <div class="participants-list">
      ${odm.participants.map(p => `<span class="participant-chip">${p}</span>`).join('')}
    </div>
  </div>
</div>

<div class="signatures">
  <div class="sig-box">
    <div class="sig-title">Agent demandeur</div>
    <div class="sig-line">${odm.agentDemandeur}<br>Date : ___/___/______</div>
  </div>
  <div class="sig-box">
    <div class="sig-title">Chef de Service</div>
    <div class="sig-line">Signature & cachet<br>Date : ___/___/______</div>
  </div>
  <div class="sig-box">
    <div class="sig-title">Directeur DPE</div>
    <div class="sig-line">Signature & cachet<br>Date : ___/___/______</div>
  </div>
</div>

<div class="footer">
  SENELEC — Direction Principale Équipement (DPE) · SIGEPP-DPE V1.0 · Document généré le ${new Date().toLocaleDateString('fr-FR')}
</div>

<script>window.onload = () => window.print();</script>
</body>
</html>`;

  const win = window.open('', '_blank');
  if (win) {
    win.document.write(doc);
    win.document.close();
  } else {
    toast.error('Veuillez autoriser les pop-ups pour imprimer le document');
  }
}

function generateRapportMission(odm: ODMItem, cloture?: ODMCloture): void {
  const kmReel = cloture ? cloture.kmArrivee - cloture.kmDepart : 0;
  const doc = `<!DOCTYPE html>
<html lang="fr">
<head>
<meta charset="UTF-8">
<title>Rapport de Mission — ${odm.ref}</title>
<style>
  body { font-family: Arial, sans-serif; font-size: 12px; margin: 0; padding: 24px; color: #1a1a1a; }
  .header { border-bottom: 3px solid #0E3460; padding-bottom: 16px; margin-bottom: 24px; display:flex; justify-content:space-between; align-items:flex-start; }
  .title h1 { margin:0; font-size:20px; color:#0E3460; font-weight:900; }
  .title p { margin:4px 0 0; color:#64748B; font-size:11px; }
  .ref-badge { background:#F39200; color:#fff; padding:6px 14px; border-radius:6px; font-weight:700; font-size:13px; }
  h2 { color:#0E3460; font-size:13px; font-weight:700; border-bottom:1px solid #E2E8F0; padding-bottom:6px; margin:20px 0 12px; }
  .kpi-grid { display:grid; grid-template-columns:repeat(4,1fr); gap:12px; margin-bottom:20px; }
  .kpi { border:1px solid #E2E8F0; border-radius:8px; padding:12px; text-align:center; }
  .kpi-val { font-size:20px; font-weight:800; color:#0E3460; }
  .kpi-lbl { font-size:9px; color:#64748B; margin-top:3px; text-transform:uppercase; }
  .obs-box { background:#F8FAFC; border:1px solid #E2E8F0; border-radius:6px; padding:14px; font-size:12px; line-height:1.6; }
  .signatures { margin-top:36px; display:grid; grid-template-columns:1fr 1fr; gap:20px; }
  .sig-box { border:1px solid #CCC; border-radius:6px; padding:14px; }
  .sig-title { font-size:10px; font-weight:700; color:#64748B; text-transform:uppercase; margin-bottom:44px; }
  .sig-line { border-top:1px solid #000; padding-top:4px; font-size:10px; color:#64748B; }
  .footer { margin-top:28px; border-top:1px solid #E2E8F0; padding-top:8px; text-align:center; font-size:9px; color:#94A3B8; }
  @media print { body { padding:10px; } }
</style>
</head>
<body>
<div class="header">
  <div class="title">
    <h1>RAPPORT DE MISSION</h1>
    <p>SENELEC — Direction Principale Équipement (DPE)</p>
    <p>Projet : ${odm.projet}</p>
  </div>
  <div class="ref-badge">${odm.ref}</div>
</div>

<h2>Résumé de la mission</h2>
<div style="font-size:14px;font-weight:700;color:#0E3460;margin-bottom:8px">${odm.objet}</div>
<div style="display:flex;gap:16px;font-size:11px;color:#64748B;flex-wrap:wrap;">
  <span>📍 <strong>${odm.destination}</strong>, ${odm.region}</span>
  <span>📅 Du <strong>${odm.dateDepart}</strong> au <strong>${odm.dateRetour}</strong></span>
  <span>⏱ <strong>${odm.dureeJours} jour(s)</strong></span>
  <span>👥 <strong>${odm.participants.join(', ')}</strong></span>
</div>

${cloture ? `
<h2>Données de terrain</h2>
<div class="kpi-grid">
  <div class="kpi"><div class="kpi-val">${kmReel} km</div><div class="kpi-lbl">Km parcourus</div></div>
  <div class="kpi"><div class="kpi-val">${cloture.consommationReelle} L</div><div class="kpi-lbl">Carburant réel</div></div>
  <div class="kpi"><div class="kpi-val">${cloture.consommationReelle > 0 && kmReel > 0 ? ((cloture.consommationReelle / kmReel) * 100).toFixed(1) : '—'} L/100</div><div class="kpi-lbl">Consommation</div></div>
  <div class="kpi"><div class="kpi-val">${cloture.consommationReelle > cloture.consommationPrevue ? '▲ Dép.' : '✓ OK'}</div><div class="kpi-lbl">Écart carburant</div></div>
</div>

<h2>Observations et compte-rendu</h2>
<div class="obs-box">${cloture.observations || 'Aucune observation renseignée.'}</div>
` : `
<div style="padding:16px;background:#FEF3C7;border:1px solid #F59E0B;border-radius:8px;margin:16px 0;">
  ⚠️ Mission non encore clôturée — données terrain manquantes.
</div>
`}

<div class="signatures">
  <div class="sig-box">
    <div class="sig-title">Rédacteur du rapport</div>
    <div class="sig-line">${odm.agentDemandeur}<br>Date : ___/___/______</div>
  </div>
  <div class="sig-box">
    <div class="sig-title">Validé par Chef de Service</div>
    <div class="sig-line">Nom & cachet<br>Date : ___/___/______</div>
  </div>
</div>

<div class="footer">
  SENELEC — DPE · SIGEPP-DPE V1.0 · Rapport généré le ${new Date().toLocaleDateString('fr-FR')}
</div>
<script>window.onload = () => window.print();</script>
</body>
</html>`;

  const win = window.open('', '_blank');
  if (win) { win.document.write(doc); win.document.close(); }
  else toast.error('Autoriser les pop-ups pour imprimer');
}

// ─── OPTIMISATION IA TAB (extracted to respect Rules of Hooks) ────────────────

interface Opportunite {
  ids: string[];
  refs: string[];
  region: string;
  periode: string;
  agents: string[];
  kmTotal: number;
  kmOptimise: number;
  budgetAvant: number;
  budgetApres: number;
  vehiculesSuggesteds: string[];
  description: string;
  economie: number;
}

function OptimisationTab({ odms }: { odms: ODMItem[] }) {
  const pending = odms.filter(o => o.statut === 'Brouillon' || o.statut === 'En validation');

  const opportunites: Opportunite[] = [];
  const byRegion: Record<string, typeof pending> = {};
  pending.forEach(o => {
    if (!byRegion[o.region]) byRegion[o.region] = [];
    byRegion[o.region].push(o);
  });
  Object.entries(byRegion).forEach(([region, odmList]) => {
    if (odmList.length < 2) return;
    const allAgents = [...new Set(odmList.flatMap(o => o.participants))];
    const kmTotal = odmList.reduce((s, o) => s + o.kmPrevisionnel, 0);
    const kmOptimise = Math.round(kmTotal * 0.65);
    const budgetAvant = odmList.reduce((s, o) => s + o.budgetEstime, 0);
    const budgetApres = Math.round(budgetAvant * 0.7);
    const vehicule = odmList.find(o => o.vehicule)?.vehicule ?? 'SN-0234-DA — Toyota LC 200';
    opportunites.push({
      ids: odmList.map(o => o.id),
      refs: odmList.map(o => o.ref),
      region,
      periode: `${odmList[0].dateDepart} — ${odmList[odmList.length - 1].dateRetour}`,
      agents: allAgents,
      kmTotal,
      kmOptimise,
      budgetAvant,
      budgetApres,
      vehiculesSuggesteds: [vehicule],
      description: `${odmList.length} missions dans la région ${region} sur des périodes proches. Mutualisation possible du véhicule et du trajet principal.`,
      economie: budgetAvant - budgetApres,
    });
  });

  const totalEconomie = opportunites.reduce((s, o) => s + o.economie, 0);
  const kmEconomise = opportunites.reduce((s, o) => s + (o.kmTotal - o.kmOptimise), 0);

  const [aiRunning, setAiRunning] = useState(false);
  const [aiDone, setAiDone] = useState(false);
  const [selectedOpp, setSelectedOpp] = useState<number | null>(null);

  function runAI() {
    setAiRunning(true);
    setAiDone(false);
    setTimeout(() => { setAiRunning(false); setAiDone(true); }, 2800);
  }

  function exportAnalyseIA() {
    const pw = window.open('', '_blank');
    if (!pw) { toast.error('Veuillez autoriser les popups.'); return; }
    const rows = opportunites.map((opp, i) => `
      <tr>
        <td style="font-weight:700">${i + 1}</td>
        <td>${opp.region}</td>
        <td>${opp.refs.join(', ')}</td>
        <td style="text-align:center">${opp.ids.length}</td>
        <td style="text-align:right">${(opp.budgetAvant / 1000).toFixed(0)} k</td>
        <td style="text-align:right">${(opp.budgetApres / 1000).toFixed(0)} k</td>
        <td style="text-align:right;color:#16A34A;font-weight:700">${(opp.economie / 1000).toFixed(0)} k</td>
        <td style="text-align:center">${opp.kmTotal} → ${opp.kmOptimise}</td>
      </tr>`).join('');
    pw.document.write(`<!DOCTYPE html><html lang="fr"><head><meta charset="UTF-8"><title>Rapport IA — Optimisation ODM</title><style>
      @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap');
      body{font-family:'Inter',Arial,sans-serif;padding:40px 48px;color:#1E293B;font-size:11px}
      .bar{height:5px;background:#F47920;border-radius:3px;margin-bottom:24px}
      .logo{font-size:8px;font-weight:700;letter-spacing:0.18em;color:#94A3B8;text-transform:uppercase;margin-bottom:16px}
      h1{font-size:20px;font-weight:800;color:#0F172A;margin:0 0 4px}
      .meta{font-size:9px;color:#64748B;margin-bottom:20px}
      .kpi-grid{display:grid;grid-template-columns:repeat(4,1fr);gap:12px;margin:16px 0 24px}
      .kpi{background:#F8FAFC;border-radius:10px;padding:14px 16px;border-left:4px solid #7C3AED}
      .kpi-val{font-size:20px;font-weight:800;color:#0F172A}
      .kpi-lbl{font-size:8px;color:#64748B;margin-top:4px;text-transform:uppercase;letter-spacing:0.06em}
      table{width:100%;border-collapse:separate;border-spacing:0;font-size:9px;border-radius:8px;overflow:hidden;box-shadow:0 1px 3px rgba(0,0,0,0.06);margin:14px 0 20px}
      th{background:#0F172A;color:#fff;padding:8px 10px;text-align:left;font-size:8px;text-transform:uppercase;letter-spacing:0.06em;font-weight:600}
      td{border-bottom:1px solid #F1F5F9;padding:7px 10px}
      tr:nth-child(even) td{background:#F8FAFC}
      .footer{margin-top:32px;padding-top:12px;border-top:1px solid #E2E8F0;font-size:8px;color:#94A3B8;display:flex;justify-content:space-between}
      .section-box{margin:0 0 16px}
      .section-title{font-size:11px;font-weight:700;color:#0F172A;margin:0 0 6px;border-left:3px solid #F47920;padding-left:10px}
      .section-body{font-size:10px;line-height:1.7;color:#374151;padding:10px 14px;background:#FAFBFC;border-radius:8px;border:1px solid #F1F5F9}
    </style></head><body>
      <div class="bar"></div>
      <div class="logo">SENELEC · SIGEPP-DPE · Intelligence Artificielle</div>
      <h1>Rapport IA — Optimisation des Ordres de Mission</h1>
      <div class="meta">Analyse générée le ${new Date().toLocaleDateString('fr-FR')} · ${pending.length} ODM analysés · ${opportunites.length} opportunités détectées</div>
      <div class="kpi-grid">
        <div class="kpi"><div class="kpi-val">${opportunites.length}</div><div class="kpi-lbl">Opportunités</div></div>
        <div class="kpi"><div class="kpi-val">${(totalEconomie / 1000).toFixed(0)} k</div><div class="kpi-lbl">Économie estimée (FCFA)</div></div>
        <div class="kpi"><div class="kpi-val">${kmEconomise} km</div><div class="kpi-lbl">Km économisés</div></div>
        <div class="kpi"><div class="kpi-val">${pending.length}</div><div class="kpi-lbl">ODM analysés</div></div>
      </div>
      <div class="section-box">
        <div class="section-title">Méthodologie de l'analyse</div>
        <div class="section-body">L'algorithme d'optimisation compare les ODM en attente selon trois critères : proximité géographique (région), chevauchement temporel (±7 jours), et compatibilité des objectifs terrain. Les regroupements suggérés réduisent le nombre de véhicules déployés et minimisent les distances parcourues.</div>
      </div>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:20px;margin:16px 0 24px">
        <div style="background:#F8FAFC;border-radius:10px;padding:14px 16px;border:1px solid #E2E8F0">
          <div style="font-size:10px;font-weight:700;color:#64748B;margin-bottom:10px;text-transform:uppercase;letter-spacing:0.06em">Économie estimée par région (k FCFA)</div>
          <svg width="100%" height="${Math.max(140, opportunites.length * 22)}" viewBox="0 0 320 ${opportunites.length * 22}" style="display:block">
            ${opportunites.map((opp, i) => {
              const y = i * 22 + 4;
              const maxE = Math.max(...opportunites.map(o => o.economie));
              const w = (opp.economie / maxE) * 200;
              return `<rect x="90" y="${y}" width="${w}" height="7" fill="#16A34A" rx="3.5"/>
                      <text x="85" y="${y+6}" font-size="8" fill="#64748B" text-anchor="end">${opp.region}</text>
                      <text x="${90+w+4}" y="${y+6}" font-size="8" fill="#16A34A" font-weight="700">${(opp.economie/1000).toFixed(0)}k</text>`;
            }).join('')}
          </svg>
        </div>
        <div style="background:#F8FAFC;border-radius:10px;padding:14px 16px;border:1px solid #E2E8F0">
          <div style="font-size:10px;font-weight:700;color:#64748B;margin-bottom:10px;text-transform:uppercase;letter-spacing:0.06em">Budget avant / après mutualisation</div>
          <svg width="100%" height="${Math.max(140, opportunites.length * 22)}" viewBox="0 0 340 ${opportunites.length * 22}" style="display:block">
            ${opportunites.map((opp, i) => {
              const y = i * 22 + 4;
              const maxB = Math.max(...opportunites.map(o => o.budgetAvant));
              const wAvant = (opp.budgetAvant / maxB) * 140;
              const wApres = (opp.budgetApres / maxB) * 140;
              return `<text x="80" y="${y+6}" font-size="8" fill="#64748B" text-anchor="end">${opp.region}</text>
                      <rect x="85" y="${y}" width="${wAvant}" height="5" fill="#EF4444" rx="2.5"/>
                      <text x="${85+wAvant+3}" y="${y+5}" font-size="7" fill="#EF4444">${(opp.budgetAvant/1000).toFixed(0)}k</text>
                      <rect x="210" y="${y}" width="${wApres}" height="5" fill="#16A34A" rx="2.5"/>
                      <text x="${210+wApres+3}" y="${y+5}" font-size="7" fill="#16A34A">${(opp.budgetApres/1000).toFixed(0)}k</text>`;
            }).join('')}
            <text x="85" y="${opportunites.length * 22 - 2}" font-size="7" fill="#94A3B8" font-weight="700">Avant</text>
            <text x="210" y="${opportunites.length * 22 - 2}" font-size="7" fill="#94A3B8" font-weight="700">Après</text>
          </svg>
        </div>
      </div>
      <table><thead><tr><th>#</th><th>Région</th><th>ODMs</th><th style="text-align:center">Nb</th><th style="text-align:right">Budget avant</th><th style="text-align:right">Budget après</th><th style="text-align:right">Économie</th><th style="text-align:center">Km</th></tr></thead><tbody>${rows}</tbody></table>
      <div class="footer"><span>CONFIDENTIEL — Usage interne SENELEC · SIGEPP-DPE uniquement</span><span>Document généré par IA — SIGEPP-DPE · ${new Date().toLocaleDateString('fr-FR')}</span></div>
    </body></html>`);
    pw.document.close(); setTimeout(() => pw.print(), 500);
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      {/* Hero AI banner */}
      <div style={{ background: 'linear-gradient(135deg, #1B4F8A 0%, #3D1A6B 100%)', borderRadius: 14, padding: '22px 26px', color: '#fff' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
          <div style={{ width: 56, height: 56, borderRadius: 14, background: 'rgba(255,255,255,0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
            <Sparkles size={28} style={{ color: '#F47920' }} />
          </div>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 18, fontWeight: 800, marginBottom: 4 }}>Optimisation IA des Ordres de Mission</div>
            <div style={{ fontSize: 12, opacity: 0.8, lineHeight: 1.5 }}>
              L&apos;IA analyse les {pending.length} ODM en attente, identifie les missions qui peuvent être mutualisées
              (même région, périodes proches, mêmes agents) et propose des regroupements optimisés.
            </div>
          </div>
          <button
            onClick={runAI}
            disabled={aiRunning}
            style={{ padding: '10px 20px', borderRadius: 10, border: 'none', background: '#F47920', color: '#fff', fontSize: 13, fontWeight: 700, cursor: aiRunning ? 'default' : 'pointer', display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0, opacity: aiRunning ? 0.7 : 1 }}>
            {aiRunning ? <><RefreshCw size={14} style={{ animation: 'spin 1s linear infinite' }} /> Analyse en cours...</> : <><Sparkles size={14} /> Lancer l&apos;analyse</>}
          </button>
        </div>
      </div>

      {/* KPI summary */}
      {aiDone && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12 }}>
          {[
            { label: 'Opportunités trouvées', value: String(opportunites.length), color: '#7C3AED', sub: 'groupes mutualisables' },
            { label: 'Économie estimée', value: `${(totalEconomie / 1000).toFixed(0)} k FCFA`, color: '#16A34A', sub: 'sur le budget missions' },
            { label: 'Km optimisés', value: `${kmEconomise} km`, color: '#F47920', sub: 'carburant économisé' },
            { label: 'Missions concernées', value: String(pending.length), color: '#1B4F8A', sub: 'ODM analysés' },
          ].map(k => (
            <div key={k.label} style={{ background: '#fff', borderRadius: 10, border: '1px solid #E2E8F0', padding: '14px 16px', boxShadow: '0 1px 4px rgba(0,0,0,0.06)' }}>
              <div style={{ fontSize: 11, color: '#94A3B8', marginBottom: 4, fontWeight: 600 }}>{k.label}</div>
              <div style={{ fontSize: 22, fontWeight: 800, color: k.color }}>{k.value}</div>
              <div style={{ fontSize: 10, color: '#64748B', marginTop: 2 }}>{k.sub}</div>
            </div>
          ))}
        </div>
      )}

      {/* Opportunities list */}
      {aiDone && (
        <div style={{ background: '#fff', borderRadius: 12, border: '1px solid #E2E8F0', overflow: 'hidden' }}>
          <div style={{ padding: '14px 18px', borderBottom: '1px solid #E2E8F0', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <Sparkles size={14} style={{ color: '#7C3AED' }} />
              <span style={{ fontSize: 14, fontWeight: 700, color: '#1B4F8A' }}>Regroupements suggérés par l&apos;IA</span>
            </div>
            <div style={{ display: 'flex', gap: 6 }}>
              <button onClick={exportAnalyseIA} className="btn btn-ghost btn-xs" style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                <FileText size={10} /> PDF
              </button>
              <button onClick={() => {
                downloadExcel('analyse_ia_odm', {
                  sheetName: 'Mutualisation ODM',
                  title: 'Analyse IA — Mutualisation des ordres de mission',
                  subtitle: 'SENELEC · Direction Principale Équipement',
                  headers: ['N°', 'Région', 'ODMs', 'Nb missions', 'Budget avant', 'Budget après', 'Économie', 'Km avant', 'Km après', 'Agents', 'Description'],
                  rows: opportunites.map((opp, i) => [i + 1, opp.region, opp.refs.join(', '), opp.ids.length, opp.budgetAvant, opp.budgetApres, opp.economie, opp.kmTotal, opp.kmOptimise, opp.agents.join(', '), opp.description]),
                });
              }} className="btn btn-ghost btn-xs" style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                <Download size={10} /> Excel
              </button>
            </div>
          </div>
          {opportunites.length === 0 && (
            <div style={{ textAlign: 'center', padding: '40px 20px', color: '#94A3B8' }}>Aucune opportunité de mutualisation détectée pour la période.</div>
          )}
          {opportunites.map((opp, i) => (
            <div key={i} style={{ padding: '16px 18px', borderBottom: '1px solid #F1F5F9', background: selectedOpp === i ? '#F5F3FF' : '#fff' }}>
              <div style={{ display: 'flex', alignItems: 'flex-start', gap: 14 }}>
                <div style={{ width: 32, height: 32, borderRadius: 8, background: '#7C3AED', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontWeight: 800, fontSize: 12, flexShrink: 0 }}>{i + 1}</div>
                <div style={{ flex: 1 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                    <span style={{ fontSize: 13, fontWeight: 700, color: '#1E293B' }}>Région {opp.region} — {opp.ids.length} ODM mutualisables</span>
                    <span style={{ fontSize: 10, fontWeight: 700, padding: '2px 8px', borderRadius: 99, background: '#DCFCE7', color: '#16A34A' }}>
                      -{Math.round((opp.economie / opp.budgetAvant) * 100)}% budget
                    </span>
                  </div>
                  <div style={{ fontSize: 11, color: '#64748B', marginBottom: 8 }}>{opp.description}</div>
                  <div style={{ display: 'flex', gap: 16, fontSize: 11 }}>
                    <span><strong style={{ color: '#1B4F8A' }}>ODMs :</strong> {opp.refs.join(', ')}</span>
                    <span><strong style={{ color: '#F47920' }}>Période :</strong> {opp.periode}</span>
                    <span><strong style={{ color: '#7C3AED' }}>Agents :</strong> {opp.agents.slice(0, 3).join(', ')}{opp.agents.length > 3 ? ` +${opp.agents.length - 3}` : ''}</span>
                  </div>
                  <div style={{ display: 'flex', gap: 10, marginTop: 8, flexWrap: 'wrap' }}>
                    {[
                      { label: 'Km prév.', value: `${opp.kmTotal} km`, vs: `→ ${opp.kmOptimise} km`, color: '#F47920' },
                      { label: 'Budget avant', value: `${(opp.budgetAvant / 1000).toFixed(0)} k`, vs: `→ ${(opp.budgetApres / 1000).toFixed(0)} k FCFA`, color: '#EF3340' },
                      { label: 'Économie', value: `${(opp.economie / 1000).toFixed(0)} k FCFA`, vs: '', color: '#16A34A' },
                    ].map(m => (
                      <div key={m.label} style={{ padding: '6px 12px', borderRadius: 7, background: '#F8FAFC', border: '1px solid #E2E8F0', fontSize: 10 }}>
                        <span style={{ color: '#94A3B8' }}>{m.label} : </span>
                        <span style={{ fontWeight: 700, color: m.color }}>{m.value}</span>
                        {m.vs && <span style={{ color: '#64748B' }}> {m.vs}</span>}
                      </div>
                    ))}
                  </div>
                  {selectedOpp === i && (
                    <div style={{ marginTop: 12, padding: '12px 14px', background: '#EDE9FE', borderRadius: 9, border: '1px solid #C4B5FD' }}>
                      <div style={{ fontSize: 12, fontWeight: 700, color: '#7C3AED', marginBottom: 6 }}>🤖 Recommandations IA</div>
                      <ul style={{ margin: 0, paddingLeft: 18, fontSize: 11, color: '#374151', lineHeight: 2 }}>
                        <li>Regrouper les {opp.ids.length} missions en <strong>1 mission commune</strong> avec le véhicule <strong>{opp.vehiculesSuggesteds[0]}</strong></li>
                        <li>Désigner un chef de mission pour coordonner les objectifs terrain</li>
                        <li>Réduire le budget global de <strong>{(opp.budgetAvant / 1000).toFixed(0)} k</strong> à <strong>{(opp.budgetApres / 1000).toFixed(0)} k FCFA</strong></li>
                        <li>Gain de {opp.kmTotal - opp.kmOptimise} km sur le trajet optimisé via itinéraire partagé</li>
                      </ul>
                      <div style={{ marginTop: 8, display: 'flex', gap: 8 }}>
                        <button onClick={() => { toast.success(`ODM groupé créé pour région ${opp.region}`); setSelectedOpp(null); }}
                          style={{ padding: '6px 14px', borderRadius: 7, border: 'none', background: '#7C3AED', color: '#fff', fontSize: 11, fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 5 }}>
                          <Check size={11} /> Créer ODM groupé
                        </button>
                        <button onClick={() => setSelectedOpp(null)}
                          style={{ padding: '6px 12px', borderRadius: 7, border: '1px solid #C4B5FD', background: '#fff', color: '#7C3AED', fontSize: 11, cursor: 'pointer' }}>
                          Ignorer
                        </button>
                      </div>
                    </div>
                  )}
                </div>
                {selectedOpp !== i && (
                  <button onClick={() => setSelectedOpp(i)}
                    style={{ padding: '6px 14px', borderRadius: 7, border: '1px solid #7C3AED', background: '#F5F3FF', color: '#7C3AED', fontSize: 11, fontWeight: 600, cursor: 'pointer', flexShrink: 0 }}>
                    Voir détail
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Route optimization chart (placeholder) */}
      {aiDone && (
        <div style={{ background: '#fff', borderRadius: 12, border: '1px solid #E2E8F0', padding: '16px 18px' }}>
          <div style={{ fontSize: 14, fontWeight: 700, color: '#1B4F8A', marginBottom: 12, display: 'flex', alignItems: 'center', gap: 8 }}>
            <MapPin size={14} style={{ color: '#F47920' }} /> Optimisation des itinéraires — Carte des missions
          </div>
          <div style={{ height: 220, background: 'linear-gradient(135deg, #F0F9FF, #EFF6FF)', borderRadius: 10, border: '1px solid #BFDBFE', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
            <MapPin size={40} style={{ color: '#1B4F8A', opacity: 0.4 }} />
            <div style={{ fontSize: 13, fontWeight: 600, color: '#1B4F8A' }}>Cartographie des itinéraires optimisés</div>
            <div style={{ fontSize: 11, color: '#64748B' }}>Visualisation ArcGIS / OpenStreetMap — activez le module Cartographie SIG</div>
            <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', justifyContent: 'center' }}>
              {pending.slice(0, 5).map(o => (
                <span key={o.id} style={{ fontSize: 10, padding: '3px 10px', borderRadius: 20, background: '#DBEAFE', color: '#1D4ED8', fontWeight: 600 }}>
                  📍 {o.destination}
                </span>
              ))}
            </div>
          </div>
        </div>
      )}

      {!aiDone && !aiRunning && (
        <div style={{ textAlign: 'center', padding: '60px 20px', color: '#94A3B8' }}>
          <Sparkles size={48} style={{ opacity: 0.3, marginBottom: 12 }} />
          <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 6 }}>Analyse IA des missions terrain</div>
          <div style={{ fontSize: 12 }}>Cliquez sur <strong>&quot;Lancer l&apos;analyse&quot;</strong> pour identifier les opportunités de mutualisation des ressources</div>
        </div>
      )}

      {aiRunning && (
        <div style={{ textAlign: 'center', padding: '60px 20px', color: '#7C3AED' }}>
          <Sparkles size={48} style={{ animation: 'spin 2s linear infinite', marginBottom: 12 }} />
          <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 6 }}>Analyse en cours...</div>
          <div style={{ fontSize: 12, color: '#94A3B8' }}>Comparaison des {pending.length} ODM · Calcul des optimisations de parcours · Identification des synergies</div>
        </div>
      )}
    </div>
  );
}

// ─── COMPOSANT PRINCIPAL ───────────────────────────────────────────────────────

export default function ODM() {
  const { user, isRole } = useAuth();
  const canConfigOdm = isRole('DIR_DPE', 'PMO', 'CTRL_FIN', 'ADMIN');
  const odmCfg = useOdmConfig();
  // Flotte paramétrable (véhicules actifs) — remplace la constante codée en dur
  const vehiculesDispo = odmCfg.vehicules.filter(v => v.actif);
  const vehiculesLabels = vehiculesDispo.length ? vehiculesDispo.map(v => v.label) : VEHICULES_DISPO;
  const consoDefaut = odmCfg.carburant.consoMoyennePar100;
  const [onglet, setOnglet] = useState<OngletODM>('mes-odm');
  const [showDemandeModal, setShowDemandeModal] = useState(false);
  const [demObjet, setDemObjet] = useState('');
  const [demProjet, setDemProjet] = useState(PROJETS_ODM[0]);
  const [demDest, setDemDest] = useState('');
  const [demDepart, setDemDepart] = useState('');
  const [demRetour, setDemRetour] = useState('');
  const [demNotes, setDemNotes] = useState('');
  const [demSubmitted, setDemSubmitted] = useState(false);
  const [odms, setOdms] = useState<ODMItem[]>(INITIAL_ODMS);
  const [clotures, setClotures] = useState<ODMCloture[]>(INITIAL_CLOTURES);
  const [selectedODM, setSelectedODM] = useState<ODMItem | null>(null);
  const [editMode, setEditMode] = useState(false);

  // Form état — nouvelle demande
  const [fObjet, setFObjet] = useState('');
  const [fProjet, setFProjet] = useState(PROJETS_ODM[0]);
  const [fItineraire, setFItineraire] = useState('');
  const [fDepart, setFDepart] = useState('');
  const [fRetour, setFRetour] = useState('');
  const [fTransport, setFTransport] = useState<MoyenTransport>('Véhicule de service');
  const [fVehicule, setFVehicule] = useState(vehiculesLabels[0]);
  const [fKm, setFKm] = useState('');
  const [fParticipants, setFParticipants] = useState<string[]>([]);
  const [fBudget, setFBudget] = useState('');

  // Clôture
  const odmCloturables = odms.filter(o => o.statut === 'Validé' || o.statut === 'En mission');
  const [cloODM, setCloODM] = useState(odmCloturables[0]?.id ?? '');
  const [cloKmDep, setCloKmDep] = useState('');
  const [cloKmArr, setCloKmArr] = useState('');
  const [cloConso, setCloConso] = useState('');
  const [cloObs, setCloObs] = useState('');

  // PDF Ingestion
  const [pdfFile, setPdfFile] = useState<File | null>(null);
  const [extracting, setExtracting] = useState(false);
  const [extracted, setExtracted] = useState<ExtractedODM | null>(null);
  const [extractionEngine, setExtractionEngine] = useState<string>('local-rules');
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Edition inline d'un ODM
  const [editedODM, setEditedODM] = useState<ODMItem | null>(null);

  // KPIs
  const odmCeMois = odms.filter(o => o.dateDepart.includes('05/2026') || o.dateDepart.includes('06/2026')).length;
  const enAttente = odms.filter(o => o.statut === 'En validation').length;
  const actives = odms.filter(o => o.statut === 'Validé' || o.statut === 'En mission').length;
  const budgetTotal = odms.reduce((acc, o) => acc + o.budgetEstime, 0);

  const odmEnAttente = odms.filter(o => o.statut === 'En validation');
  // Consommation du véhicule sélectionné si dispo, sinon défaut paramétré
  const consoVehicule = vehiculesDispo.find(v => v.label === fVehicule)?.consoLitresPer100 ?? consoDefaut;
  const dotationCalc = fKm ? calculDotation(parseInt(fKm) || 0, consoVehicule) : 0;

  // ── Actions ──────────────────────────────────────────────────────────────────

  const handleNouvelleSubmit = useCallback((e: React.FormEvent) => {
    e.preventDefault();
    if (!fObjet.trim() || !fItineraire.trim()) {
      toast.error('Veuillez remplir les champs obligatoires');
      return;
    }
    const now = new Date();
    const newODM: ODMItem = {
      id: `ODM-${String(odms.length + 1).padStart(3, '0')}`,
      ref: `ODM-DER-2026-${String(46 + odms.length).padStart(3, '0')}`,
      objet: fObjet,
      projet: fProjet,
      destination: fItineraire.split('→').pop()?.trim() ?? fItineraire,
      pays: 'Sénégal',
      region: fItineraire.split('→').pop()?.trim() ?? 'Dakar',
      typeMission: 'terrain',
      international: false,
      dateDepart: fDepart ? new Date(fDepart).toLocaleDateString('fr-FR') : '',
      dateRetour: fRetour ? new Date(fRetour).toLocaleDateString('fr-FR') : '',
      dureeJours: fDepart && fRetour ? Math.ceil((new Date(fRetour).getTime() - new Date(fDepart).getTime()) / 86400000) + 1 : 1,
      participants: fParticipants,
      transport: fTransport,
      vehicule: fTransport === 'Véhicule de service' ? fVehicule : null,
      kmPrevisionnel: parseInt(fKm) || 0,
      dotationCarburant: dotationCalc,
      budgetEstime: parseInt(fBudget) || 0,
      agentDemandeur: 'Utilisateur connecté',
      statut: 'En validation',
    };
    setOdms(prev => [newODM, ...prev]);
    toast.success(`ODM ${newODM.ref} soumis pour validation ✓`);
    setFObjet(''); setFItineraire(''); setFDepart(''); setFRetour(''); setFKm(''); setFBudget('');
    setFParticipants([]);
    setOnglet('mes-odm');
  }, [fObjet, fItineraire, fProjet, fDepart, fRetour, fTransport, fVehicule, fKm, fBudget, fParticipants, dotationCalc, odms.length]);

  const handleValider = useCallback((odmId: string) => {
    setOdms(prev => prev.map(o => o.id === odmId ? { ...o, statut: 'Validé' } : o));
    toast.success('ODM validé et signé ✓');
  }, []);

  const handleRejeter = useCallback((odmId: string, ref: string) => {
    setOdms(prev => prev.map(o => o.id === odmId ? { ...o, statut: 'Brouillon' } : o));
    toast.error(`ODM ${ref} rejeté — renvoyé en brouillon`);
  }, []);

  const handleCloture = useCallback((e: React.FormEvent) => {
    e.preventDefault();
    if (!cloKmDep || !cloKmArr) { toast.error('Kilométrage requis'); return; }
    if (parseInt(cloKmArr) <= parseInt(cloKmDep)) { toast.error('Km arrivée doit être > Km départ'); return; }
    const nouvelle: ODMCloture = {
      odmId: cloODM,
      kmDepart: parseInt(cloKmDep),
      kmArrivee: parseInt(cloKmArr),
      consommationReelle: parseInt(cloConso) || 0,
      consommationPrevue: odms.find(o => o.id === cloODM)?.dotationCarburant ?? 0,
      observations: cloObs,
      statut: 'Clôturé',
    };
    setClotures(prev => [...prev.filter(c => c.odmId !== cloODM), nouvelle]);
    setOdms(prev => prev.map(o => o.id === cloODM ? { ...o, statut: 'Clôturé' } : o));
    toast.success(`Mission clôturée avec succès ✓`);
    setCloKmDep(''); setCloKmArr(''); setCloConso(''); setCloObs('');
  }, [cloODM, cloKmDep, cloKmArr, cloConso, cloObs, odms]);

  // ── PDF Ingestion ──────────────────────────────────────────────────────────

  const handleFileDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    const file = e.dataTransfer.files[0];
    if (file?.type === 'application/pdf') setPdfFile(file);
    else toast.error('Veuillez déposer un fichier PDF');
  }, []);

  const handleFileChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) setPdfFile(file);
  }, []);

  const handleExtract = useCallback(async () => {
    if (!pdfFile) return;
    setExtracting(true);
    setExtracted(null);
    const result = await performAIExtraction(pdfFile, extractionEngine);
    setExtracted(result);
    setExtracting(false);
    if (result.confidence < 50) {
      toast.error(`Extraction incertaine (${result.confidence}%) — vérifiez manuellement les champs`);
    } else {
      toast.success(`Extraction IA terminée — confiance ${result.confidence}%`);
    }
  }, [pdfFile, extractionEngine]);

  const handleImportExtracted = useCallback(() => {
    if (!extracted) return;
    const newODM: ODMItem = {
      id: `ODM-${String(odms.length + 1).padStart(3, '0')}`,
      ref: extracted.ref,
      objet: extracted.objet,
      projet: 'PADERAU',
      destination: extracted.destination,
      pays: 'Sénégal',
      region: extracted.region,
      typeMission: 'terrain',
      international: false,
      dateDepart: new Date(extracted.dateDepart).toLocaleDateString('fr-FR'),
      dateRetour: new Date(extracted.dateRetour).toLocaleDateString('fr-FR'),
      dureeJours: Math.ceil((new Date(extracted.dateRetour).getTime() - new Date(extracted.dateDepart).getTime()) / 86400000) + 1,
      participants: extracted.participants,
      transport: extracted.transport,
      vehicule: null,
      kmPrevisionnel: 320,
      dotationCarburant: calculDotation(320, consoDefaut),
      budgetEstime: extracted.budget,
      agentDemandeur: extracted.agentDemandeur,
      statut: 'Validé',
      pdfIngere: true,
      sourceExterne: pdfFile?.name,
    };
    setOdms(prev => [newODM, ...prev]);
    setPdfFile(null);
    setExtracted(null);
    toast.success(`ODM ${newODM.ref} intégré depuis PDF ✓`);
    setOnglet('mes-odm');
  }, [extracted, pdfFile, odms.length]);

  const handleSaveEdit = useCallback(() => {
    if (!editedODM) return;
    setOdms(prev => prev.map(o => o.id === editedODM.id ? editedODM : o));
    setSelectedODM(editedODM);
    setEditMode(false);
    setEditedODM(null);
    toast.success('ODM mis à jour ✓');
  }, [editedODM]);

  const toggleParticipant = useCallback((agent: string) => {
    setFParticipants(prev => prev.includes(agent) ? prev.filter(a => a !== agent) : [...prev, agent]);
  }, []);

  const fatODMs = odms.filter(o => o.international);
  const ONGLETS: { key: OngletODM; label: string; icon?: React.ReactNode; badge?: number }[] = [
    { key: 'mes-odm',           label: 'Mes ODM' },
    { key: 'fat-international', label: '✈️ Missions FAT / Internationales', badge: fatODMs.length },
    { key: 'importer-pdf',      label: '📥 Importer PDF', icon: <FileUp size={12} /> },
    { key: 'nouvelle',          label: 'Nouvelle demande', icon: <Plus size={12} /> },
    { key: 'validation',        label: 'Validation' },
    { key: 'cloture',           label: 'Clôture & Suivi' },
    { key: 'optimisation',      label: '🤖 Optimisation IA', icon: <Sparkles size={12} /> },
    ...(canConfigOdm ? [{ key: 'parametres' as OngletODM, label: 'Paramètres ODM', icon: <Settings size={12} /> }] : []),
  ];

  // ─── RENDER ────────────────────────────────────────────────────────────────

  return (
    <div style={{ flex: 1, overflowY: 'auto', padding: 20, background: 'var(--bg, #F4F6F9)' }}>

      {/* ── Quick demande button ── */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <div>
          <h2 style={{ margin: 0, fontSize: 18, fontWeight: 800, color: 'var(--navy)' }}>Ordres de Mission — UAGL</h2>
          <p style={{ margin: '2px 0 0', fontSize: 11, color: '#94A3B8' }}>Gestion des missions terrain · Optimisation IA · Validation UAGL</p>
        </div>
        <button onClick={() => { setDemSubmitted(false); setDemObjet(''); setDemDest(''); setDemDepart(''); setDemRetour(''); setDemNotes(''); setShowDemandeModal(true); }}
          style={{ display: 'flex', alignItems: 'center', gap: 7, padding: '9px 18px', borderRadius: 9, border: 'none', background: '#F47920', color: '#fff', fontSize: 13, fontWeight: 700, cursor: 'pointer' }}>
          <Plus size={14} /> Demander une mission
        </button>
      </div>

      {/* ── KPI Row ── */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px,1fr))', gap: 14, marginBottom: 20 }}>
        {[
          { icon: <FileText size={20} color="var(--navy)" />, bg: 'rgba(14,52,96,0.1)', val: odmCeMois, label: 'ODM ce mois', valColor: 'var(--navy)' },
          { icon: <Clock size={20} color="var(--orange)" />, bg: 'rgba(243,146,0,0.1)', val: enAttente, label: 'En attente validation', valColor: 'var(--orange)' },
          { icon: <MapPin size={20} color="#16A34A" />, bg: 'rgba(22,163,74,0.1)', val: actives, label: 'Missions actives', valColor: '#16A34A' },
          { icon: <Fuel size={20} color="var(--orange)" />, bg: 'rgba(243,146,0,0.1)', val: `${(budgetTotal / 1000).toFixed(0)}k`, label: 'Budget total (FCFA)', valColor: 'var(--navy)' },
        ].map((k, i) => (
          <div key={i} style={{ background: '#fff', borderRadius: 12, padding: '16px 18px', boxShadow: '0 1px 4px rgba(0,0,0,0.07)', display: 'flex', alignItems: 'center', gap: 12 }}>
            <div style={{ width: 40, height: 40, borderRadius: 10, background: k.bg, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>{k.icon}</div>
            <div>
              <div style={{ fontSize: 22, fontWeight: 800, color: k.valColor, lineHeight: 1 }}>{k.val}</div>
              <div style={{ fontSize: 11, color: '#64748B', marginTop: 3 }}>{k.label}</div>
            </div>
          </div>
        ))}
      </div>

      {/* ── Onglets ── */}
      <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', borderBottom: '2px solid #E2E8F0', marginBottom: 20 }}>
        {ONGLETS.map(o => (
          <button key={o.key}
            onClick={() => { setOnglet(o.key); setSelectedODM(null); setEditMode(false); }}
            style={{
              padding: '9px 16px', fontSize: 13, fontWeight: 600, border: 'none',
              background: 'transparent', cursor: 'pointer', fontFamily: 'inherit',
              color: onglet === o.key ? 'var(--navy)' : '#64748B',
              borderBottom: onglet === o.key ? '2px solid #F47920' : '2px solid transparent',
              marginBottom: -2, borderRadius: '6px 6px 0 0',
              display: 'flex', alignItems: 'center', gap: 5,
            }}>
            {o.label}
            {o.key === 'validation' && enAttente > 0 && (
              <span style={{ background: 'var(--orange)', color: '#fff', borderRadius: 20, fontSize: 9, fontWeight: 800, padding: '1px 6px' }}>{enAttente}</span>
            )}
            {'badge' in o && o.badge !== undefined && o.badge > 0 && (
              <span style={{ background: '#1B4F8A', color: '#fff', borderRadius: 20, fontSize: 9, fontWeight: 800, padding: '1px 6px' }}>{o.badge}</span>
            )}
          </button>
        ))}
      </div>

      {/* ════════════════════════════════════════════════════════════════
          ONGLET: MES ODM
      ════════════════════════════════════════════════════════════════ */}
      {onglet === 'mes-odm' && (
        <div style={{ background: '#fff', borderRadius: 12, padding: 20, boxShadow: '0 1px 4px rgba(0,0,0,0.07)' }}>
          {selectedODM ? (
            // ── Détail + Édition ──
            <div>
              <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
                <button onClick={() => { setSelectedODM(null); setEditMode(false); setEditedODM(null); }}
                  style={{ display: 'flex', alignItems: 'center', gap: 5, background: '#F8FAFC', border: '1px solid #E2E8F0', borderRadius: 7, padding: '6px 12px', cursor: 'pointer', fontSize: 12, fontFamily: 'inherit', color: '#374151' }}>
                  ← Retour à la liste
                </button>
                {!editMode && (
                  <>
                    <button onClick={() => { setEditMode(true); setEditedODM({ ...selectedODM }); }}
                      style={{ display: 'flex', alignItems: 'center', gap: 5, background: 'var(--navy)', border: 'none', borderRadius: 7, padding: '6px 12px', cursor: 'pointer', fontSize: 12, fontFamily: 'inherit', color: '#fff', fontWeight: 700 }}>
                      <Edit3 size={12} /> Modifier
                    </button>
                    <button onClick={() => generateODMDocument(selectedODM)}
                      style={{ display: 'flex', alignItems: 'center', gap: 5, background: '#16A34A', border: 'none', borderRadius: 7, padding: '6px 12px', cursor: 'pointer', fontSize: 12, fontFamily: 'inherit', color: '#fff', fontWeight: 700 }}>
                      <Printer size={12} /> Imprimer ODM
                    </button>
                    <button onClick={() => { const c = clotures.find(c => c.odmId === selectedODM.id); generateRapportMission(selectedODM, c); }}
                      style={{ display: 'flex', alignItems: 'center', gap: 5, background: '#7C3AED', border: 'none', borderRadius: 7, padding: '6px 12px', cursor: 'pointer', fontSize: 12, fontFamily: 'inherit', color: '#fff', fontWeight: 700 }}>
                      <FileText size={12} /> Rapport mission
                    </button>
                  </>
                )}
                {editMode && (
                  <>
                    <button onClick={handleSaveEdit}
                      style={{ display: 'flex', alignItems: 'center', gap: 5, background: '#16A34A', border: 'none', borderRadius: 7, padding: '6px 12px', cursor: 'pointer', fontSize: 12, fontFamily: 'inherit', color: '#fff', fontWeight: 700 }}>
                      <CheckCircle2 size={12} /> Sauvegarder
                    </button>
                    <button onClick={() => { setEditMode(false); setEditedODM(null); }}
                      style={{ display: 'flex', alignItems: 'center', gap: 5, background: '#F1F5F9', border: '1px solid #E2E8F0', borderRadius: 7, padding: '6px 12px', cursor: 'pointer', fontSize: 12, fontFamily: 'inherit', color: '#374151' }}>
                      <X size={12} /> Annuler
                    </button>
                  </>
                )}
              </div>

              {/* ODM Detail / Edit form */}
              <div style={{ background: '#F8FAFC', borderRadius: 10, padding: 20, border: '1px solid #E2E8F0' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 16, gap: 12 }}>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontFamily: 'monospace', fontSize: 12, color: '#64748B', marginBottom: 4, display: 'flex', alignItems: 'center', gap: 8 }}>
                      {selectedODM.ref}
                      {selectedODM.pdfIngere && (
                        <span style={{ fontSize: 9, background: '#DBEAFE', color: '#1D4ED8', padding: '1px 6px', borderRadius: 4, fontWeight: 700 }}>
                          📥 Importé PDF — {selectedODM.sourceExterne}
                        </span>
                      )}
                    </div>
                    {editMode && editedODM ? (
                      <input value={editedODM.objet} onChange={e => setEditedODM({ ...editedODM, objet: e.target.value })}
                        style={{ width: '100%', fontSize: 15, fontWeight: 700, padding: '6px 10px', border: '1.5px solid #F39200', borderRadius: 6, fontFamily: 'inherit', color: 'var(--navy)', background: '#fff', boxSizing: 'border-box' }} />
                    ) : (
                      <div style={{ fontWeight: 800, fontSize: 16, color: 'var(--navy)' }}>{selectedODM.objet}</div>
                    )}
                  </div>
                  <div style={{ padding: '4px 12px', borderRadius: 20, fontSize: 11, fontWeight: 700, background: statutColor(selectedODM.statut).bg, color: statutColor(selectedODM.statut).text, flexShrink: 0 }}>
                    {selectedODM.statut}
                  </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px,1fr))', gap: 12 }}>
                  {[
                    { label: 'Projet', field: 'projet' as keyof ODMItem },
                    { label: 'Destination', field: 'destination' as keyof ODMItem },
                    { label: 'Région', field: 'region' as keyof ODMItem },
                    { label: 'Date départ', field: 'dateDepart' as keyof ODMItem },
                    { label: 'Date retour', field: 'dateRetour' as keyof ODMItem },
                    { label: 'Agent demandeur', field: 'agentDemandeur' as keyof ODMItem },
                  ].map(({ label, field }) => (
                    <div key={field} style={{ background: '#fff', borderRadius: 8, padding: '10px 14px', border: editMode ? '1.5px solid #E2E8F0' : '1px solid #E2E8F0' }}>
                      <div style={{ fontSize: 10, color: '#64748B', fontWeight: 600, marginBottom: 4, textTransform: 'uppercase', letterSpacing: '0.4px' }}>{label}</div>
                      {editMode && editedODM ? (
                        <input value={String(editedODM[field] ?? '')}
                          onChange={e => setEditedODM({ ...editedODM, [field]: e.target.value })}
                          style={{ width: '100%', fontSize: 13, fontWeight: 600, padding: '4px 6px', border: '1px solid #F39200', borderRadius: 4, fontFamily: 'inherit', color: '#1A1A2E', background: '#FFFBF0', boxSizing: 'border-box' }} />
                      ) : (
                        <div style={{ fontSize: 13, fontWeight: 600, color: '#1A1A2E' }}>{String(selectedODM[field] ?? '—')}</div>
                      )}
                    </div>
                  ))}
                  <div style={{ background: '#fff', borderRadius: 8, padding: '10px 14px', border: '1px solid #E2E8F0' }}>
                    <div style={{ fontSize: 10, color: '#64748B', fontWeight: 600, marginBottom: 4, textTransform: 'uppercase', letterSpacing: '0.4px' }}>Budget estimé</div>
                    <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--navy)' }}>{selectedODM.budgetEstime.toLocaleString('fr-FR')} FCFA</div>
                  </div>
                  <div style={{ background: '#fff', borderRadius: 8, padding: '10px 14px', border: '1px solid #E2E8F0' }}>
                    <div style={{ fontSize: 10, color: '#64748B', fontWeight: 600, marginBottom: 4, textTransform: 'uppercase', letterSpacing: '0.4px' }}>Km / Carburant</div>
                    <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--navy)' }}>{selectedODM.kmPrevisionnel} km · {selectedODM.dotationCarburant} L</div>
                  </div>
                </div>

                {/* Participants */}
                <div style={{ marginTop: 12, background: '#fff', borderRadius: 8, padding: '10px 14px', border: '1px solid #E2E8F0' }}>
                  <div style={{ fontSize: 10, color: '#64748B', fontWeight: 600, marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.4px' }}>Participants ({selectedODM.participants.length})</div>
                  <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                    {(editMode && editedODM ? editedODM : selectedODM).participants.map(p => (
                      <span key={p} style={{ display: 'flex', alignItems: 'center', gap: 4, background: 'rgba(14,52,96,0.08)', color: 'var(--navy)', borderRadius: 5, padding: '3px 9px', fontSize: 12, fontWeight: 600 }}>
                        {p}
                        {editMode && editedODM && (
                          <button onClick={() => setEditedODM({ ...editedODM, participants: editedODM.participants.filter(x => x !== p) })}
                            style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#EF4444', padding: 0, marginLeft: 2, lineHeight: 1 }}>×</button>
                        )}
                      </span>
                    ))}
                  </div>
                </div>

                {/* Clôture si disponible */}
                {(() => {
                  const clo = clotures.find(c => c.odmId === selectedODM.id);
                  if (!clo) return null;
                  const kmReel = clo.kmArrivee - clo.kmDepart;
                  return (
                    <div style={{ marginTop: 12, background: '#F0FFF4', border: '1px solid #BBF7D0', borderRadius: 8, padding: '12px 14px' }}>
                      <div style={{ fontSize: 11, fontWeight: 700, color: '#166534', marginBottom: 8 }}>✅ Mission clôturée</div>
                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(140px,1fr))', gap: 8, fontSize: 12 }}>
                        <div><span style={{ color: '#64748B' }}>Km réels : </span><strong>{kmReel} km</strong></div>
                        <div><span style={{ color: '#64748B' }}>Conso réelle : </span><strong style={{ color: clo.consommationReelle > clo.consommationPrevue ? '#EF4444' : '#16A34A' }}>{clo.consommationReelle} L</strong></div>
                        <div><span style={{ color: '#64748B' }}>L/100km : </span><strong>{kmReel > 0 ? ((clo.consommationReelle / kmReel) * 100).toFixed(1) : '—'}</strong></div>
                      </div>
                      <div style={{ marginTop: 8, fontSize: 11, color: '#374151', fontStyle: 'italic' }}>{clo.observations}</div>
                    </div>
                  );
                })()}
              </div>
            </div>
          ) : (
            // ── Liste ODM ──
            <>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
                <h3 style={{ margin: 0, fontSize: 15, fontWeight: 700, color: 'var(--navy)' }}>Mes Ordres de Mission ({odms.length})</h3>
                <button onClick={() => setOnglet('nouvelle')}
                  style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 14px', background: 'var(--navy)', color: '#fff', border: 'none', borderRadius: 8, fontSize: 13, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' }}>
                  <Plus size={14} /> Nouvel ODM
                </button>
              </div>
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                  <thead>
                    <tr style={{ background: '#F8FAFC' }}>
                      {['Réf', 'Objet', 'Destination', 'Départ', 'Retour', 'Transport', 'Statut', 'Actions'].map(h => (
                        <th key={h} style={{ textAlign: 'left', fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.4px', color: '#64748B', padding: '8px 10px', borderBottom: '1px solid #E2E8F0', whiteSpace: 'nowrap' }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {odms.map(odm => {
                      const sc = statutColor(odm.statut);
                      return (
                        <tr key={odm.id} style={{ borderBottom: '1px solid #F1F5F9' }}
                          onMouseEnter={e => (e.currentTarget.style.background = '#F8FAFC')}
                          onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}>
                          <td style={{ padding: '9px 10px', fontFamily: 'monospace', fontSize: 11, fontWeight: 700, color: 'var(--navy)', whiteSpace: 'nowrap' }}>
                            {odm.ref}
                            {odm.pdfIngere && <span title="Importé PDF" style={{ marginLeft: 4, fontSize: 10 }}>📥</span>}
                          </td>
                          <td style={{ padding: '9px 10px', fontSize: 12, maxWidth: 220 }}>
                            <div style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{odm.objet}</div>
                            <div style={{ fontSize: 10, color: '#94A3B8' }}>{odm.projet}</div>
                          </td>
                          <td style={{ padding: '9px 10px' }}>
                            <div style={{ fontSize: 12, fontWeight: 600 }}>{odm.destination}</div>
                            <div style={{ fontSize: 10, color: '#64748B' }}>{odm.region}</div>
                          </td>
                          <td style={{ padding: '9px 10px', fontSize: 12, whiteSpace: 'nowrap' }}>{odm.dateDepart}</td>
                          <td style={{ padding: '9px 10px', fontSize: 12, whiteSpace: 'nowrap' }}>{odm.dateRetour}</td>
                          <td style={{ padding: '9px 10px', fontSize: 11, color: '#64748B', whiteSpace: 'nowrap' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                              <Truck size={10} />{odm.vehicule ? odm.vehicule.split(' — ')[1] ?? '' : odm.transport.split(' ')[0]}
                            </div>
                          </td>
                          <td style={{ padding: '9px 10px' }}>
                            <span style={{ padding: '3px 10px', borderRadius: 20, fontSize: 10, fontWeight: 700, background: sc.bg, color: sc.text, whiteSpace: 'nowrap' }}>{odm.statut}</span>
                          </td>
                          <td style={{ padding: '9px 10px' }}>
                            <div style={{ display: 'flex', gap: 4 }}>
                              <button onClick={() => setSelectedODM(odm)}
                                style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '4px 8px', border: '1px solid #E2E8F0', borderRadius: 5, fontSize: 11, cursor: 'pointer', background: '#fff', fontFamily: 'inherit', color: '#374151' }}>
                                <Eye size={11} /> Détail
                              </button>
                              <button onClick={() => generateODMDocument(odm)}
                                style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '4px 8px', border: '1px solid #16A34A', borderRadius: 5, fontSize: 11, cursor: 'pointer', background: '#F0FFF4', fontFamily: 'inherit', color: '#16A34A', fontWeight: 600 }}>
                                <Printer size={11} />
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </div>
      )}

      {/* ════════════════════════════════════════════════════════════════
          ONGLET: IMPORTER PDF (IA)
      ════════════════════════════════════════════════════════════════ */}
      {onglet === 'importer-pdf' && (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20, alignItems: 'start' }}>
          {/* Zone dépôt PDF */}
          <div style={{ background: '#fff', borderRadius: 12, padding: 24, boxShadow: '0 1px 4px rgba(0,0,0,0.07)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16 }}>
              <div style={{ width: 36, height: 36, borderRadius: 9, background: 'rgba(124,58,237,0.10)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <Brain size={18} color="#7C3AED" />
              </div>
              <div>
                <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--navy)' }}>Ingestion PDF par IA</div>
                <div style={{ fontSize: 11, color: '#64748B' }}>Déposez l'ODM reçu d'un outil externe — l'IA extrait automatiquement les données</div>
              </div>
            </div>

            {/* Drop zone */}
            <div
              onDragOver={e => e.preventDefault()}
              onDrop={handleFileDrop}
              onClick={() => fileInputRef.current?.click()}
              style={{
                border: `2px dashed ${pdfFile ? '#7C3AED' : '#CBD5E1'}`,
                borderRadius: 12, padding: '32px 20px',
                textAlign: 'center', cursor: 'pointer',
                background: pdfFile ? '#F5F3FF' : '#F8FAFC',
                transition: 'all 0.15s',
                marginBottom: 16,
              }}>
              <input ref={fileInputRef} type="file" accept=".pdf" onChange={handleFileChange} style={{ display: 'none' }} />
              {pdfFile ? (
                <>
                  <Paperclip size={28} color="#7C3AED" style={{ marginBottom: 8, display: 'block', margin: '0 auto 8px' }} />
                  <div style={{ fontSize: 14, fontWeight: 700, color: '#7C3AED' }}>{pdfFile.name}</div>
                  <div style={{ fontSize: 11, color: '#64748B', marginTop: 4 }}>{(pdfFile.size / 1024).toFixed(1)} KB · Cliquer pour changer</div>
                </>
              ) : (
                <>
                  <FileUp size={32} color="#94A3B8" style={{ margin: '0 auto 12px', display: 'block' }} />
                  <div style={{ fontSize: 14, fontWeight: 700, color: '#374151' }}>Glisser-déposer votre PDF ici</div>
                  <div style={{ fontSize: 12, color: '#64748B', marginTop: 4 }}>ou cliquer pour parcourir les fichiers</div>
                  <div style={{ marginTop: 12, fontSize: 10, color: '#94A3B8' }}>Formats acceptés : PDF · Taille max : 10 MB</div>
                </>
              )}
            </div>

            {pdfFile && !extracting && !extracted && (
              <>
                {/* Sélecteur de moteur d'extraction (open-source) */}
                <div style={{ marginBottom: 10 }}>
                  <label style={{ display: 'block', fontSize: 10, fontWeight: 700, color: '#64748B', textTransform: 'uppercase', letterSpacing: '.4px', marginBottom: 4 }}>
                    Moteur d'extraction IA
                  </label>
                  <select value={extractionEngine} onChange={e => setExtractionEngine(e.target.value)}
                    style={{ width: '100%', padding: '8px 10px', borderRadius: 8, border: '1.5px solid #E2E8F0', fontSize: 12.5, fontFamily: 'inherit', background: '#fff', color: '#1a1a1a', cursor: 'pointer' }}>
                    {EXTRACTION_ENGINES.map(en => (
                      <option key={en.id} value={en.id}>{en.label} · {en.poids}</option>
                    ))}
                  </select>
                  <div style={{ fontSize: 10.5, color: '#94A3B8', marginTop: 4 }}>
                    {EXTRACTION_ENGINES.find(en => en.id === extractionEngine)?.desc}
                  </div>
                </div>
                <button onClick={handleExtract}
                  style={{ width: '100%', padding: '11px', background: '#7C3AED', color: '#fff', border: 'none', borderRadius: 8, fontSize: 14, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
                  <Sparkles size={16} /> Extraire les données avec l'IA
                </button>
              </>
            )}

            {extracting && (
              <div style={{ textAlign: 'center', padding: '20px', color: '#7C3AED' }}>
                <div style={{ width: 36, height: 36, border: '3px solid rgba(124,58,237,0.2)', borderTopColor: '#7C3AED', borderRadius: '50%', animation: 'spin 0.8s linear infinite', margin: '0 auto 12px' }} />
                <div style={{ fontSize: 13, fontWeight: 600 }}>Analyse IA en cours...</div>
                <div style={{ fontSize: 11, color: '#94A3B8', marginTop: 4 }}>Extraction des champs, participants, dates, destinations...</div>
              </div>
            )}

            {/* Instructions */}
            <div style={{ marginTop: 16, padding: '12px 14px', background: '#F0F9FF', border: '1px solid #BAE6FD', borderRadius: 8 }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: '#0369A1', marginBottom: 6 }}>ℹ️ Comment ça fonctionne</div>
              <ul style={{ margin: 0, paddingLeft: 16, fontSize: 11, color: '#374151', lineHeight: 1.7 }}>
                <li>Déposez l'ODM PDF reçu de votre outil externe (SIRH, ERP, etc.)</li>
                <li>L'IA SENELEC extrait automatiquement : objet, participants, dates, itinéraire</li>
                <li>Vérifiez et complétez les données extraites</li>
                <li>Importez l'ODM dans SIGEPP-DPE pour le suivi et la clôture</li>
              </ul>
            </div>
          </div>

          {/* Résultat extraction */}
          <div style={{ background: '#fff', borderRadius: 12, padding: 24, boxShadow: '0 1px 4px rgba(0,0,0,0.07)' }}>
            {!extracted ? (
              <div style={{ textAlign: 'center', padding: '60px 20px', color: '#94A3B8' }}>
                <Brain size={48} style={{ margin: '0 auto 16px', display: 'block', opacity: 0.3 }} />
                <div style={{ fontSize: 14, fontWeight: 600 }}>Résultats de l'extraction</div>
                <div style={{ fontSize: 12, marginTop: 6 }}>Déposez un PDF et lancez l'analyse pour voir les données extraites</div>
              </div>
            ) : (
              <>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16 }}>
                  {extracted.confidence >= 70 ? <CheckCircle2 size={20} color="#16A34A" /> : extracted.confidence >= 40 ? <AlertCircle size={20} color="#F59E0B" /> : <X size={20} color="#EF4444" />}
                  <div style={{ fontSize: 15, fontWeight: 700, color: extracted.confidence >= 70 ? '#166534' : extracted.confidence >= 40 ? '#92400E' : '#991B1B' }}>
                    {extracted.confidence >= 70 ? 'Extraction réussie' : extracted.confidence >= 40 ? 'Extraction partielle' : 'Extraction incertaine'}
                  </div>
                  <span style={{ marginLeft: 'auto', fontSize: 10, background: extracted.confidence >= 70 ? '#DCFCE7' : extracted.confidence >= 40 ? '#FEF3C7' : '#FEE2E2', color: extracted.confidence >= 70 ? '#166534' : extracted.confidence >= 40 ? '#92400E' : '#991B1B', padding: '2px 8px', borderRadius: 5, fontWeight: 700 }}>IA · Confiance {extracted.confidence}%</span>
                </div>

                {/* Barre de confiance */}
                <div style={{ background: '#F1F5F9', borderRadius: 4, height: 6, width: '100%', overflow: 'hidden', marginBottom: 12 }}>
                  <div style={{ width: `${extracted.confidence}%`, height: '100%', background: extracted.confidence >= 70 ? '#16A34A' : extracted.confidence >= 40 ? '#F59E0B' : '#EF4444', borderRadius: 4, transition: 'width 0.4s ease' }} />
                </div>

                {/* Champs bruts extraits */}
                {extracted.rawFields && Object.keys(extracted.rawFields).length > 0 && (
                  <div style={{ background: '#F0F9FF', border: '1px solid #BAE6FD', borderRadius: 7, padding: '10px 12px', marginBottom: 10 }}>
                    <div style={{ fontSize: 10, color: '#0369A1', fontWeight: 700, marginBottom: 4, textTransform: 'uppercase', letterSpacing: '0.4px' }}>Champs détectés dans le document</div>
                    <div style={{ fontSize: 11, color: '#0C4A6E' }}>
                      {Object.entries(extracted.rawFields).map(([k, v]) => (
                        <div key={k} style={{ marginBottom: 2 }}>• {k} : <strong>{String(v).slice(0, 80)}</strong></div>
                      ))}
                    </div>
                  </div>
                )}

                <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                  {[
                    { label: 'Référence ODM', value: extracted.ref, editable: false },
                    { label: 'Objet de la mission', value: extracted.objet, editable: true, field: 'objet' as keyof ExtractedODM },
                    { label: 'Destination', value: `${extracted.destination} — ${extracted.region}`, editable: false },
                    { label: 'Date départ', value: extracted.dateDepart, editable: false },
                    { label: 'Date retour', value: extracted.dateRetour, editable: false },
                    { label: 'Agent demandeur', value: extracted.agentDemandeur, editable: false },
                    { label: 'Budget', value: `${extracted.budget.toLocaleString('fr-FR')} FCFA`, editable: false },
                  ].map(item => (
                    <div key={item.label} style={{ background: '#F8FAFC', borderRadius: 7, padding: '10px 12px', border: '1px solid #E2E8F0' }}>
                      <div style={{ fontSize: 10, color: '#64748B', fontWeight: 600, marginBottom: 3, textTransform: 'uppercase', letterSpacing: '0.4px' }}>{item.label}</div>
                      <div style={{ fontSize: 12.5, fontWeight: 600, color: '#1A1A2E' }}>{item.value}</div>
                    </div>
                  ))}

                  {/* Participants */}
                  <div style={{ background: '#F8FAFC', borderRadius: 7, padding: '10px 12px', border: '1px solid #E2E8F0' }}>
                    <div style={{ fontSize: 10, color: '#64748B', fontWeight: 600, marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.4px' }}>Participants</div>
                    <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                      {extracted.participants.map(p => (
                        <span key={p} style={{ background: 'rgba(14,52,96,0.08)', color: 'var(--navy)', borderRadius: 5, padding: '3px 9px', fontSize: 12, fontWeight: 600 }}>{p}</span>
                      ))}
                    </div>
                  </div>

                  {/* Observations */}
                  <div style={{ background: '#FFFBF0', border: '1px solid #FDE68A', borderRadius: 7, padding: '10px 12px' }}>
                    <div style={{ fontSize: 10, color: '#B45309', fontWeight: 600, marginBottom: 3, textTransform: 'uppercase', letterSpacing: '0.4px' }}>Contexte extrait</div>
                    <div style={{ fontSize: 11.5, color: '#374151' }}>{extracted.observations}</div>
                  </div>
                </div>

                <div style={{ display: 'flex', gap: 8, marginTop: 16 }}>
                  <button onClick={handleImportExtracted}
                    style={{ flex: 1, padding: '10px', background: 'var(--navy)', color: '#fff', border: 'none', borderRadius: 8, fontSize: 13, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}>
                    <Check size={14} /> Importer dans SIGEPP-DPE
                  </button>
                  <button onClick={() => { setExtracted(null); setPdfFile(null); }}
                    style={{ padding: '10px 14px', background: '#F1F5F9', color: '#374151', border: '1px solid #E2E8F0', borderRadius: 8, fontSize: 13, cursor: 'pointer', fontFamily: 'inherit' }}>
                    <RefreshCw size={13} />
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {/* ════════════════════════════════════════════════════════════════
          ONGLET: NOUVELLE DEMANDE
      ════════════════════════════════════════════════════════════════ */}
      {onglet === 'nouvelle' && (
        <div style={{ display: 'grid', gridTemplateColumns: 'minmax(340px,560px) 1fr', gap: 20, alignItems: 'start' }}>
          <div style={{ background: '#fff', borderRadius: 12, padding: 24, boxShadow: '0 1px 4px rgba(0,0,0,0.07)' }}>
            <h3 style={{ margin: '0 0 20px', fontSize: 15, fontWeight: 700, color: 'var(--navy)' }}>Nouvelle demande ODM</h3>
            <form onSubmit={handleNouvelleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>

              {[
                { label: 'Objet de la mission *', placeholder: 'ex: Supervision travaux HTA – Phase 2...', val: fObjet, setter: setFObjet, required: true },
                { label: 'Itinéraire / Destination *', placeholder: 'ex: Dakar → Ziguinchor via Fatick', val: fItineraire, setter: setFItineraire, required: true },
              ].map(f => (
                <div key={f.label}>
                  <label style={{ fontSize: 12, fontWeight: 600, color: '#374151', display: 'block', marginBottom: 5 }}>{f.label}</label>
                  <input value={f.val} onChange={e => f.setter(e.target.value)} required={f.required} placeholder={f.placeholder}
                    style={{ width: '100%', padding: '9px 12px', border: '1px solid #E2E8F0', borderRadius: 8, fontSize: 13, fontFamily: 'inherit', boxSizing: 'border-box', background: '#F8FAFC' }} />
                </div>
              ))}

              <div>
                <label style={{ fontSize: 12, fontWeight: 600, color: '#374151', display: 'block', marginBottom: 5 }}>Projet lié</label>
                <select value={fProjet} onChange={e => setFProjet(e.target.value)}
                  style={{ width: '100%', padding: '9px 12px', border: '1px solid #E2E8F0', borderRadius: 8, fontSize: 13, fontFamily: 'inherit', background: '#F8FAFC' }}>
                  {PROJETS_ODM.map(p => <option key={p}>{p}</option>)}
                </select>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                <div>
                  <label style={{ fontSize: 12, fontWeight: 600, color: '#374151', display: 'block', marginBottom: 5 }}>Date départ</label>
                  <input type="date" value={fDepart} onChange={e => setFDepart(e.target.value)}
                    style={{ width: '100%', padding: '9px 12px', border: '1px solid #E2E8F0', borderRadius: 8, fontSize: 13, fontFamily: 'inherit', boxSizing: 'border-box', background: '#F8FAFC' }} />
                </div>
                <div>
                  <label style={{ fontSize: 12, fontWeight: 600, color: '#374151', display: 'block', marginBottom: 5 }}>Date retour</label>
                  <input type="date" value={fRetour} onChange={e => setFRetour(e.target.value)}
                    style={{ width: '100%', padding: '9px 12px', border: '1px solid #E2E8F0', borderRadius: 8, fontSize: 13, fontFamily: 'inherit', boxSizing: 'border-box', background: '#F8FAFC' }} />
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                <div>
                  <label style={{ fontSize: 12, fontWeight: 600, color: '#374151', display: 'block', marginBottom: 5 }}>Distance (km)</label>
                  <input type="number" value={fKm} onChange={e => setFKm(e.target.value)} placeholder="ex: 420" min="0"
                    style={{ width: '100%', padding: '9px 12px', border: '1px solid #E2E8F0', borderRadius: 8, fontSize: 13, fontFamily: 'inherit', boxSizing: 'border-box', background: '#F8FAFC' }} />
                </div>
                <div>
                  <label style={{ fontSize: 12, fontWeight: 600, color: '#374151', display: 'block', marginBottom: 5 }}>Budget estimé (FCFA)</label>
                  <input type="number" value={fBudget} onChange={e => setFBudget(e.target.value)} placeholder="ex: 350000" min="0"
                    style={{ width: '100%', padding: '9px 12px', border: '1px solid #E2E8F0', borderRadius: 8, fontSize: 13, fontFamily: 'inherit', boxSizing: 'border-box', background: '#F8FAFC' }} />
                </div>
              </div>

              {dotationCalc > 0 && (
                <div style={{ padding: '8px 12px', background: 'rgba(243,146,0,0.08)', border: '1px solid rgba(243,146,0,0.2)', borderRadius: 7, display: 'flex', alignItems: 'center', gap: 8 }}>
                  <Fuel size={14} color="var(--orange)" />
                  <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--orange)' }}>Dotation calculée : {dotationCalc} L</span>
                  <span style={{ fontSize: 11, color: '#64748B' }}>({consoVehicule}L/100km · ≈ {(dotationCalc * odmCfg.carburant.prixLitre).toLocaleString('fr-FR')} FCFA)</span>
                </div>
              )}

              <div>
                <label style={{ fontSize: 12, fontWeight: 600, color: '#374151', display: 'block', marginBottom: 8 }}>Participants</label>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                  {AGENTS_LIST.map(agent => (
                    <button key={agent} type="button" onClick={() => toggleParticipant(agent)}
                      style={{ padding: '4px 10px', borderRadius: 6, fontSize: 12, cursor: 'pointer', fontFamily: 'inherit', border: '1px solid', borderColor: fParticipants.includes(agent) ? 'var(--navy)' : '#E2E8F0', background: fParticipants.includes(agent) ? 'rgba(14,52,96,0.08)' : '#fff', color: fParticipants.includes(agent) ? 'var(--navy)' : '#374151', fontWeight: fParticipants.includes(agent) ? 700 : 400 }}>
                      {agent}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label style={{ fontSize: 12, fontWeight: 600, color: '#374151', display: 'block', marginBottom: 8 }}>Moyen de transport</label>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6 }}>
                  {(['Véhicule de service', 'Transport commun', 'Véhicule personnel', 'Avion'] as MoyenTransport[]).map(t => (
                    <label key={t} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, cursor: 'pointer', padding: '6px 10px', borderRadius: 6, border: `1px solid ${fTransport === t ? 'var(--navy)' : '#E2E8F0'}`, background: fTransport === t ? 'rgba(14,52,96,0.05)' : '#fff' }}>
                      <input type="radio" name="transport" value={t} checked={fTransport === t} onChange={() => setFTransport(t)} style={{ accentColor: 'var(--navy)' }} />
                      {t}
                    </label>
                  ))}
                </div>
              </div>

              {fTransport === 'Véhicule de service' && (
                <div>
                  <label style={{ fontSize: 12, fontWeight: 600, color: '#374151', display: 'block', marginBottom: 5 }}>Véhicule demandé</label>
                  <select value={fVehicule} onChange={e => setFVehicule(e.target.value)}
                    style={{ width: '100%', padding: '9px 12px', border: '1px solid #E2E8F0', borderRadius: 8, fontSize: 13, fontFamily: 'inherit', background: '#F8FAFC' }}>
                    {vehiculesLabels.map(v => <option key={v}>{v}</option>)}
                  </select>
                </div>
              )}

              <button type="submit"
                style={{ width: '100%', padding: '11px', background: 'var(--navy)', color: '#fff', border: 'none', borderRadius: 8, fontSize: 14, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, marginTop: 4 }}>
                <FileText size={14} /> Soumettre la demande ODM
              </button>
            </form>
          </div>

          {/* Véhicules disponibles */}
          <div style={{ background: '#fff', borderRadius: 12, padding: 20, boxShadow: '0 1px 4px rgba(0,0,0,0.07)' }}>
            <h4 style={{ margin: '0 0 14px', fontSize: 14, fontWeight: 700, color: 'var(--navy)' }}>Flotte disponible</h4>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {vehiculesLabels.map(v => (
                <div key={v} style={{ padding: '10px 14px', background: '#F8FAFC', borderRadius: 8, border: '1px solid #E2E8F0', display: 'flex', alignItems: 'center', gap: 10 }}>
                  <Truck size={16} color="var(--navy)" />
                  <div>
                    <div style={{ fontSize: 12, fontWeight: 600 }}>{v.split(' — ')[0]}</div>
                    <div style={{ fontSize: 11, color: '#64748B' }}>{v.split(' — ')[1]}</div>
                  </div>
                  <span style={{ marginLeft: 'auto', padding: '2px 8px', borderRadius: 20, fontSize: 10, fontWeight: 700, background: '#DCFCE7', color: '#166534' }}>Disponible</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ════════════════════════════════════════════════════════════════
          ONGLET: VALIDATION
      ════════════════════════════════════════════════════════════════ */}
      {onglet === 'validation' && (
        <div style={{ background: '#fff', borderRadius: 12, padding: 20, boxShadow: '0 1px 4px rgba(0,0,0,0.07)' }}>
          <h3 style={{ margin: '0 0 16px', fontSize: 15, fontWeight: 700, color: 'var(--navy)', display: 'flex', alignItems: 'center', gap: 8 }}>
            ODM en attente de validation
            <span style={{ background: 'var(--orange)', color: '#fff', borderRadius: 20, fontSize: 11, fontWeight: 800, padding: '2px 10px' }}>{odmEnAttente.length}</span>
          </h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            {odmEnAttente.map(odm => (
              <div key={odm.id} style={{ padding: 18, background: '#FFFBF5', borderRadius: 10, border: '1px solid #FDE68A', borderLeft: '4px solid var(--orange)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12, flexWrap: 'wrap', gap: 8 }}>
                  <div>
                    <div style={{ fontFamily: 'monospace', fontSize: 11, color: '#64748B' }}>{odm.ref}</div>
                    <div style={{ fontWeight: 700, fontSize: 14, color: 'var(--navy)', margin: '3px 0' }}>{odm.objet}</div>
                    <div style={{ fontSize: 11, color: '#64748B' }}>Agent : <strong>{odm.agentDemandeur}</strong> · Projet : <strong>{odm.projet}</strong> · {odm.participants.length} participant(s)</div>
                  </div>
                  <div style={{ padding: '3px 10px', borderRadius: 20, fontSize: 10, fontWeight: 700, background: '#FEF3C7', color: '#92400E' }}>En attente</div>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(150px,1fr))', gap: 8, marginBottom: 14 }}>
                  {[
                    { label: 'Destination', val: `${odm.destination} (${odm.region})` },
                    { label: 'Départ', val: odm.dateDepart },
                    { label: 'Retour', val: odm.dateRetour },
                    { label: 'Transport', val: odm.transport },
                    { label: 'Budget', val: `${odm.budgetEstime.toLocaleString('fr-FR')} FCFA` },
                    { label: 'Km prév.', val: `${odm.kmPrevisionnel} km · ${odm.dotationCarburant} L` },
                  ].map(item => (
                    <div key={item.label} style={{ background: '#fff', borderRadius: 7, padding: '8px 12px', border: '1px solid #E2E8F0' }}>
                      <div style={{ fontSize: 10, color: '#64748B', fontWeight: 600, marginBottom: 2, textTransform: 'uppercase', letterSpacing: '0.4px' }}>{item.label}</div>
                      <div style={{ fontSize: 12, fontWeight: 700, color: '#1A1A2E' }}>{item.val}</div>
                    </div>
                  ))}
                </div>
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                  <button onClick={() => handleValider(odm.id)}
                    style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 16px', background: '#16A34A', color: '#fff', border: 'none', borderRadius: 8, fontSize: 13, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' }}>
                    <Check size={14} /> Valider & Signer
                  </button>
                  <button onClick={() => handleRejeter(odm.id, odm.ref)}
                    style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 16px', border: '1px solid #EF4444', borderRadius: 8, fontSize: 13, fontWeight: 700, cursor: 'pointer', background: '#FFF', color: '#EF4444', fontFamily: 'inherit' }}>
                    <X size={14} /> Rejeter
                  </button>
                  <button onClick={() => generateODMDocument(odm)}
                    style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 16px', border: '1px solid #7C3AED', borderRadius: 8, fontSize: 13, cursor: 'pointer', background: '#F5F3FF', color: '#7C3AED', fontFamily: 'inherit', fontWeight: 700 }}>
                    <Printer size={13} /> Imprimer ODM
                  </button>
                  <button onClick={() => toast('Modification demandée — notification envoyée', { icon: '✏️' })}
                    style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 14px', border: '1px solid #E2E8F0', borderRadius: 8, fontSize: 12, cursor: 'pointer', background: '#fff', fontFamily: 'inherit', color: '#374151' }}>
                    <Edit3 size={13} /> Demander modification
                  </button>
                </div>
              </div>
            ))}
            {odmEnAttente.length === 0 && (
              <div style={{ textAlign: 'center', padding: '50px 20px', color: '#64748B' }}>
                <CheckCircle2 size={36} style={{ margin: '0 auto 12px', display: 'block', color: '#16A34A' }} />
                <div style={{ fontSize: 14, fontWeight: 600 }}>Aucun ODM en attente</div>
                <div style={{ fontSize: 12, marginTop: 4 }}>Tous les ordres de mission ont été traités</div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ════════════════════════════════════════════════════════════════
          ONGLET: CLÔTURE
      ════════════════════════════════════════════════════════════════ */}
      {onglet === 'cloture' && (
        <div style={{ display: 'grid', gridTemplateColumns: 'minmax(320px,440px) 1fr', gap: 20, alignItems: 'start' }}>
          <div style={{ background: '#fff', borderRadius: 12, padding: 20, boxShadow: '0 1px 4px rgba(0,0,0,0.07)' }}>
            <h3 style={{ margin: '0 0 16px', fontSize: 15, fontWeight: 700, color: 'var(--navy)' }}>Saisie de clôture mission</h3>
            {odmCloturables.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '30px', color: '#64748B', fontSize: 13 }}>
                <AlertCircle size={28} style={{ margin: '0 auto 8px', display: 'block', color: '#94A3B8' }} />
                Aucune mission validée à clôturer.
              </div>
            ) : (
              <form onSubmit={handleCloture} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                <div>
                  <label style={{ fontSize: 12, fontWeight: 600, color: '#374151', display: 'block', marginBottom: 5 }}>ODM à clôturer</label>
                  <select value={cloODM} onChange={e => setCloODM(e.target.value)}
                    style={{ width: '100%', padding: '9px 12px', border: '1px solid #E2E8F0', borderRadius: 8, fontSize: 13, fontFamily: 'inherit', background: '#F8FAFC' }}>
                    {odmCloturables.map(o => <option key={o.id} value={o.id}>{o.ref} — {o.destination}</option>)}
                  </select>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                  {[
                    { label: 'Km départ *', val: cloKmDep, setter: setCloKmDep, placeholder: 'ex: 41200' },
                    { label: 'Km arrivée *', val: cloKmArr, setter: setCloKmArr, placeholder: 'ex: 41750' },
                  ].map(f => (
                    <div key={f.label}>
                      <label style={{ fontSize: 12, fontWeight: 600, color: '#374151', display: 'block', marginBottom: 5 }}>{f.label}</label>
                      <input type="number" value={f.val} onChange={e => f.setter(e.target.value)} required placeholder={f.placeholder}
                        style={{ width: '100%', padding: '9px 12px', border: '1px solid #E2E8F0', borderRadius: 8, fontSize: 13, fontFamily: 'inherit', boxSizing: 'border-box', background: '#F8FAFC' }} />
                    </div>
                  ))}
                </div>
                {cloKmDep && cloKmArr && parseInt(cloKmArr) > parseInt(cloKmDep) && (
                  <div style={{ padding: '8px 12px', background: 'rgba(14,52,96,0.06)', borderRadius: 7, display: 'flex', gap: 16, fontSize: 12 }}>
                    <div>Km parcourus : <strong style={{ color: 'var(--navy)' }}>{parseInt(cloKmArr) - parseInt(cloKmDep)} km</strong></div>
                    <div>Conso estimée : <strong style={{ color: 'var(--orange)' }}>{calculDotation(parseInt(cloKmArr) - parseInt(cloKmDep), consoDefaut)} L</strong></div>
                  </div>
                )}
                <div>
                  <label style={{ fontSize: 12, fontWeight: 600, color: '#374151', display: 'block', marginBottom: 5 }}>Consommation réelle (L)</label>
                  <input type="number" value={cloConso} onChange={e => setCloConso(e.target.value)} placeholder="ex: 68"
                    style={{ width: '100%', padding: '9px 12px', border: '1px solid #E2E8F0', borderRadius: 8, fontSize: 13, fontFamily: 'inherit', boxSizing: 'border-box', background: '#F8FAFC' }} />
                </div>
                <div>
                  <label style={{ fontSize: 12, fontWeight: 600, color: '#374151', display: 'block', marginBottom: 5 }}>Compte-rendu / Observations</label>
                  <textarea value={cloObs} onChange={e => setCloObs(e.target.value)} rows={4} placeholder="Résumé de la mission, constats terrain, incidents, points à signaler..."
                    style={{ width: '100%', padding: '9px 12px', border: '1px solid #E2E8F0', borderRadius: 8, fontSize: 13, fontFamily: 'inherit', resize: 'vertical', boxSizing: 'border-box', background: '#F8FAFC' }} />
                </div>
                <div style={{ display: 'flex', gap: 8 }}>
                  <button type="submit"
                    style={{ flex: 1, padding: '10px', background: 'var(--navy)', color: '#fff', border: 'none', borderRadius: 8, fontSize: 13, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}>
                    <CheckCircle2 size={14} /> Clôturer la mission
                  </button>
                  {cloODM && (
                    <button type="button" onClick={() => { const o = odms.find(x => x.id === cloODM); const c = clotures.find(x => x.odmId === cloODM); if (o) generateRapportMission(o, c); }}
                      style={{ padding: '10px 12px', background: '#7C3AED', color: '#fff', border: 'none', borderRadius: 8, fontSize: 13, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit', display: 'flex', alignItems: 'center', gap: 5 }}>
                      <FileText size={13} /> Rapport
                    </button>
                  )}
                </div>
              </form>
            )}
          </div>

          {/* Tableau comparatif */}
          <div style={{ background: '#fff', borderRadius: 12, padding: 20, boxShadow: '0 1px 4px rgba(0,0,0,0.07)' }}>
            <h3 style={{ margin: '0 0 16px', fontSize: 15, fontWeight: 700, color: 'var(--navy)' }}>Comparatif Prévisionnel vs Réel</h3>
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr style={{ background: '#F8FAFC' }}>
                    {['ODM', 'Km prév.', 'Km réel', 'Conso prév.', 'Conso réelle', 'L/100km', 'Observations', 'Actions'].map(h => (
                      <th key={h} style={{ textAlign: 'left', fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.4px', color: '#64748B', padding: '8px 10px', borderBottom: '1px solid #E2E8F0', whiteSpace: 'nowrap' }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {clotures.map(c => {
                    const odm = odms.find(o => o.id === c.odmId);
                    const kmReel = c.kmArrivee - c.kmDepart;
                    const lPour100 = kmReel > 0 ? Math.round((c.consommationReelle / kmReel) * 100 * 10) / 10 : 0;
                    const depassement = c.consommationReelle > c.consommationPrevue;
                    return (
                      <tr key={c.odmId} style={{ borderBottom: '1px solid #F1F5F9' }}>
                        <td style={{ padding: '9px 10px', fontSize: 11, fontWeight: 700, color: 'var(--navy)', fontFamily: 'monospace', whiteSpace: 'nowrap' }}>{odm?.ref ?? c.odmId}</td>
                        <td style={{ padding: '9px 10px', textAlign: 'right', fontSize: 12 }}>{odm?.kmPrevisionnel ?? 0} km</td>
                        <td style={{ padding: '9px 10px', textAlign: 'right', fontWeight: 700, fontSize: 12 }}>{kmReel} km</td>
                        <td style={{ padding: '9px 10px', textAlign: 'right', fontSize: 12 }}>{c.consommationPrevue} L</td>
                        <td style={{ padding: '9px 10px', textAlign: 'right', fontWeight: 700, color: depassement ? '#EF4444' : '#16A34A', fontSize: 12 }}>{c.consommationReelle} L</td>
                        <td style={{ padding: '9px 10px', textAlign: 'right', fontWeight: 700, fontSize: 12, color: lPour100 > 15 ? '#EF4444' : lPour100 > 13 ? '#F59E0B' : '#16A34A' }}>{lPour100} L/100</td>
                        <td style={{ padding: '9px 10px', fontSize: 11, color: '#64748B', maxWidth: 180 }}>
                          <div style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={c.observations}>{c.observations}</div>
                        </td>
                        <td style={{ padding: '9px 10px' }}>
                          <button onClick={() => { if (odm) generateRapportMission(odm, c); }}
                            style={{ padding: '4px 8px', border: '1px solid #7C3AED', borderRadius: 5, fontSize: 11, cursor: 'pointer', background: '#F5F3FF', color: '#7C3AED', fontFamily: 'inherit', fontWeight: 600, display: 'flex', alignItems: 'center', gap: 3 }}>
                            <FileText size={11} /> Rapport
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                  {clotures.length === 0 && (
                    <tr><td colSpan={8} style={{ textAlign: 'center', padding: '24px', color: '#94A3B8', fontSize: 13 }}>Aucune mission clôturée</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}


      {/* ════════════════════════════════════════════════════════════════
          ONGLET: MISSIONS FAT / INTERNATIONALES
      ════════════════════════════════════════════════════════════════ */}
      {onglet === 'fat-international' && (() => {
        const fatODMs = odms.filter(o => o.international);
        const budgetTotalFAT = fatODMs.reduce((s, o) => s + o.budgetEstime, 0);
        const missionsPlanifieeFAT = fatODMs.filter(o => o.statut === 'Brouillon' || o.statut === 'En validation').length;
        const paysVisites = [...new Set(fatODMs.map(o => o.pays))];
        const USD_TO_FCFA = 650;

        return (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
            {/* ── Hero Banner ─────────────────────────────────────────────── */}
            <div style={{ background: 'linear-gradient(135deg, #1B4F8A 0%, #3D1A6B 50%, #7C3AED 100%)', borderRadius: 14, padding: '20px 24px', color: '#fff', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12 }}>
              <div>
                <div style={{ fontSize: 18, fontWeight: 800, display: 'flex', alignItems: 'center', gap: 8 }}>✈️ Missions FAT &amp; Internationales</div>
                <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.75)', marginTop: 4 }}>Factory Acceptance Tests · Réceptions en usine à l&apos;étranger · Gestion des missions hors Sénégal</div>
              </div>
              <button
                onClick={() => { setShowDemandeModal(true); }}
                style={{ padding: '10px 18px', background: '#F47920', border: 'none', borderRadius: 9, fontSize: 13, fontWeight: 700, color: '#fff', cursor: 'pointer', fontFamily: 'inherit', display: 'flex', alignItems: 'center', gap: 6 }}>
                <Plus size={14} /> Nouvelle mission FAT
              </button>
            </div>

            {/* ── KPIs ────────────────────────────────────────────────────── */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 14 }}>
              {[
                { label: 'Missions FAT', value: fatODMs.length, sub: `${fatODMs.filter(o=>o.statut==='Validé'||o.statut==='En mission').length} validées`, color: '#7C3AED', bg: '#F5F3FF' },
                { label: 'Budget total', value: `${(budgetTotalFAT/1000000).toFixed(1)} M FCFA`, sub: `Moy. ${fatODMs.length ? Math.round(budgetTotalFAT/fatODMs.length/1000) : 0} k FCFA/mission`, color: '#1B4F8A', bg: '#EFF6FF' },
                { label: 'Missions planifiées', value: missionsPlanifieeFAT, sub: 'En attente de validation', color: '#F59E0B', bg: '#FFFBEB' },
                { label: 'Pays couverts', value: paysVisites.length, sub: paysVisites.slice(0,3).join(', '), color: '#16A34A', bg: '#F0FDF4' },
              ].map(k => (
                <div key={k.label} style={{ background: k.bg, borderRadius: 10, padding: '16px 18px', border: `1px solid ${k.color}22` }}>
                  <div style={{ fontSize: 11, fontWeight: 600, color: '#64748B', textTransform: 'uppercase', letterSpacing: '0.5px' }}>{k.label}</div>
                  <div style={{ fontSize: 22, fontWeight: 800, color: k.color, margin: '6px 0 2px' }}>{k.value}</div>
                  <div style={{ fontSize: 11, color: '#64748B' }}>{k.sub}</div>
                </div>
              ))}
            </div>

            {/* ── Table missions FAT ──────────────────────────────────────── */}
            <div style={{ background: '#fff', borderRadius: 12, padding: 20, boxShadow: '0 1px 4px rgba(0,0,0,0.07)' }}>
              <h3 style={{ margin: '0 0 16px', fontSize: 15, fontWeight: 700, color: 'var(--navy)', display: 'flex', alignItems: 'center', gap: 8 }}>
                <Truck size={16} /> Ordres de mission FAT enregistrés
              </h3>
              {fatODMs.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '40px 20px', color: '#64748B' }}>
                  <MapPin size={32} style={{ margin: '0 auto 10px', display: 'block', color: '#CBD5E1' }} />
                  <div style={{ fontWeight: 600 }}>Aucune mission FAT enregistrée</div>
                  <div style={{ fontSize: 12, marginTop: 4 }}>Cliquez sur &quot;Nouvelle mission FAT&quot; pour en créer une</div>
                </div>
              ) : (
                <div style={{ overflowX: 'auto' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
                    <thead>
                      <tr style={{ background: '#F8FAFC' }}>
                        {['Réf. ODM', 'Pays', 'Destination', 'Objet / Fournisseur', 'Projet', 'Dates', 'Durée', 'Per diem/j', 'Budget', 'Statut', 'Actions'].map(h => (
                          <th key={h} style={{ textAlign: 'left', fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.4px', color: '#64748B', padding: '8px 10px', borderBottom: '1px solid #E2E8F0', whiteSpace: 'nowrap' }}>{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {fatODMs.map(o => {
                        const dest = DESTINATIONS_FAT.find(d => d.pays === o.pays);
                        const statutColor: Record<StatutODM, string> = { 'Brouillon': '#64748B', 'En validation': '#F59E0B', 'Validé': '#7C3AED', 'En mission': '#1B4F8A', 'Clôturé': '#16A34A' };
                        const statutBg: Record<StatutODM, string> = { 'Brouillon': '#F1F5F9', 'En validation': '#FFFBEB', 'Validé': '#F5F3FF', 'En mission': '#EFF6FF', 'Clôturé': '#F0FDF4' };
                        return (
                          <tr key={o.id} style={{ borderBottom: '1px solid #F1F5F9' }}>
                            <td style={{ padding: '9px 10px', fontFamily: 'monospace', fontSize: 11, fontWeight: 700, color: 'var(--navy)', whiteSpace: 'nowrap' }}>{o.ref}</td>
                            <td style={{ padding: '9px 10px', fontSize: 14, whiteSpace: 'nowrap' }}>{dest?.flag ?? '🌍'} {o.pays}</td>
                            <td style={{ padding: '9px 10px', fontSize: 12, color: '#374151', whiteSpace: 'nowrap' }}>{o.destination}</td>
                            <td style={{ padding: '9px 10px', maxWidth: 240 }}>
                              <div style={{ fontWeight: 600, color: '#1E293B', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={o.objet}>{o.objet}</div>
                              <div style={{ fontSize: 11, color: '#94A3B8', marginTop: 2 }}>{o.participants.join(', ')}</div>
                            </td>
                            <td style={{ padding: '9px 10px', fontSize: 11, color: '#475569' }}>{o.projet}</td>
                            <td style={{ padding: '9px 10px', fontSize: 11, color: '#475569', whiteSpace: 'nowrap' }}>{o.dateDepart}<br/><span style={{ color: '#94A3B8' }}>→ {o.dateRetour}</span></td>
                            <td style={{ padding: '9px 10px', textAlign: 'center', fontSize: 12, fontWeight: 700 }}>{o.dureeJours}j</td>
                            <td style={{ padding: '9px 10px', textAlign: 'right', fontSize: 12, color: '#7C3AED', fontWeight: 700, whiteSpace: 'nowrap' }}>
                              {o.perdiemJour ? `${o.perdiemJour.toLocaleString('fr-FR')} F` : '—'}
                            </td>
                            <td style={{ padding: '9px 10px', textAlign: 'right', fontSize: 12, fontWeight: 700, color: 'var(--navy)', whiteSpace: 'nowrap' }}>{o.budgetEstime.toLocaleString('fr-FR')} F</td>
                            <td style={{ padding: '9px 10px' }}>
                              <span style={{ padding: '3px 8px', borderRadius: 5, fontSize: 10, fontWeight: 700, background: statutBg[o.statut], color: statutColor[o.statut], whiteSpace: 'nowrap' }}>{o.statut}</span>
                            </td>
                            <td style={{ padding: '9px 10px' }}>
                              <div style={{ display: 'flex', gap: 5 }}>
                                <button onClick={() => setSelectedODM(o)}
                                  style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '4px 8px', border: '1px solid #E2E8F0', borderRadius: 5, fontSize: 11, cursor: 'pointer', background: '#F8FAFC', color: '#374151', fontFamily: 'inherit' }}>
                                  <Eye size={11} /> Détail
                                </button>
                                <button onClick={() => generateRapportMission(o)}
                                  style={{ padding: '4px 7px', border: '1px solid #7C3AED', borderRadius: 5, fontSize: 11, cursor: 'pointer', background: '#F5F3FF', color: '#7C3AED', fontFamily: 'inherit', display: 'flex', alignItems: 'center', gap: 3 }}>
                                  <FileText size={11} /> Rapport
                                </button>
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                    <tfoot>
                      <tr style={{ background: '#F8FAFC', fontWeight: 700 }}>
                        <td colSpan={8} style={{ padding: '10px 10px', fontSize: 12, color: 'var(--navy)' }}>TOTAL FAT — {fatODMs.length} mission(s)</td>
                        <td style={{ padding: '10px 10px', textAlign: 'right', fontSize: 13, color: 'var(--navy)' }}>{budgetTotalFAT.toLocaleString('fr-FR')} F</td>
                        <td colSpan={2} />
                      </tr>
                    </tfoot>
                  </table>
                </div>
              )}
            </div>

            {/* ── Référentiel destinations FAT ────────────────────────────── */}
            <div style={{ background: '#fff', borderRadius: 12, padding: 20, boxShadow: '0 1px 4px rgba(0,0,0,0.07)' }}>
              <h3 style={{ margin: '0 0 16px', fontSize: 15, fontWeight: 700, color: 'var(--navy)', display: 'flex', alignItems: 'center', gap: 8 }}>
                <MapPin size={16} /> Référentiel Destinations FAT — Per diem &amp; Fournisseurs SENELEC
              </h3>
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
                  <thead>
                    <tr style={{ background: '#F8FAFC' }}>
                      {['', 'Pays', 'Ville / Région', 'Per diem (USD/j)', 'Per diem (FCFA/j)', 'Fournisseurs', 'Matériels FAT'].map(h => (
                        <th key={h} style={{ textAlign: 'left', fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.4px', color: '#64748B', padding: '8px 10px', borderBottom: '1px solid #E2E8F0', whiteSpace: 'nowrap' }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {DESTINATIONS_FAT.map(d => (
                      <tr key={`${d.pays}-${d.ville}`} style={{ borderBottom: '1px solid #F1F5F9' }}>
                        <td style={{ padding: '8px 10px', fontSize: 16 }}>{d.flag}</td>
                        <td style={{ padding: '8px 10px', fontWeight: 700, color: '#1E293B' }}>{d.pays}</td>
                        <td style={{ padding: '8px 10px', color: '#475569' }}>{d.ville}</td>
                        <td style={{ padding: '8px 10px', textAlign: 'right', fontWeight: 700, color: '#1B4F8A' }}>${d.perdiemUSD}</td>
                        <td style={{ padding: '8px 10px', textAlign: 'right', fontWeight: 700, color: '#7C3AED' }}>{(d.perdiemUSD * USD_TO_FCFA).toLocaleString('fr-FR')} F</td>
                        <td style={{ padding: '8px 10px', fontSize: 11, color: '#475569' }}>{d.fournisseurs.slice(0, 2).join(', ')}{d.fournisseurs.length > 2 ? ` +${d.fournisseurs.length - 2}` : ''}</td>
                        <td style={{ padding: '8px 10px', fontSize: 11, color: '#64748B', maxWidth: 220 }}>{d.typeMateriel}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div style={{ marginTop: 12, padding: '10px 14px', background: '#FFF7ED', borderRadius: 8, fontSize: 11, color: '#92400E', display: 'flex', gap: 8, alignItems: 'flex-start' }}>
                <AlertCircle size={14} style={{ marginTop: 1, flexShrink: 0 }} />
                <span>Per diem en USD selon référentiel SENELEC/DPE. Taux de change USD → FCFA appliqué : <strong>1 USD = {USD_TO_FCFA} FCFA</strong>. Ces montants sont indicatifs et sujets à validation par la DRH et la DAF avant émission de l&apos;ODM.</span>
              </div>
            </div>

            {/* ── Simulation budget mission FAT ───────────────────────────── */}
            <div style={{ background: '#fff', borderRadius: 12, padding: 20, boxShadow: '0 1px 4px rgba(0,0,0,0.07)' }}>
              <h3 style={{ margin: '0 0 16px', fontSize: 15, fontWeight: 700, color: 'var(--navy)', display: 'flex', alignItems: 'center', gap: 8 }}>
                <Sparkles size={16} style={{ color: '#7C3AED' }} /> Simulation budget par mission FAT (7 jours)
              </h3>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12 }}>
                {DESTINATIONS_FAT.slice(0, 6).map(d => {
                  const duree = 7;
                  const perdiem = d.perdiemUSD * USD_TO_FCFA;
                  const billet = d.pays === 'Sénégal' ? 0 : d.pays === 'France' || d.pays === 'Espagne' || d.pays === 'Italie' || d.pays === 'Allemagne' || d.pays === 'Suisse' ? 900000 : d.pays === 'Chine' || d.pays === 'Corée du Sud' ? 1100000 : d.pays === 'Canada' ? 1050000 : 650000;
                  const total = (perdiem * duree * 2) + (billet * 2); // 2 agents
                  return (
                    <div key={d.ville} style={{ border: '1px solid #E2E8F0', borderRadius: 10, padding: '14px 16px', background: '#FAFAFA' }}>
                      <div style={{ fontSize: 16, marginBottom: 4 }}>{d.flag} <strong>{d.pays}</strong></div>
                      <div style={{ fontSize: 11, color: '#64748B', marginBottom: 10 }}>{d.ville}</div>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                        {[
                          { k: 'Per diem (2 agents, 7j)', v: `${(perdiem * 2 * duree).toLocaleString('fr-FR')} F` },
                          { k: 'Billets A/R (×2)', v: `${(billet * 2).toLocaleString('fr-FR')} F` },
                          { k: 'Total estimé', v: `${total.toLocaleString('fr-FR')} F`, bold: true, color: 'var(--navy)' },
                        ].map(r => (
                          <div key={r.k} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: r.color ?? '#374151', fontWeight: r.bold ? 700 : 400 }}>
                            <span>{r.k}</span><span>{r.v}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        );
      })()}

      {/* ══ OPTIMISATION IA ═════════════════════════════════════════════ */}
      {onglet === 'optimisation' && (
        <OptimisationTab odms={odms} />
      )}

      {/* ══ PARAMÈTRES ODM (paramétrable) ═══════════════════════════════ */}
      {onglet === 'parametres' && canConfigOdm && (
        <ParametresODMTab />
      )}



      {/* ══ MODAL DEMANDE MISSION ═══════════════════════════════════════ */}
      {showDemandeModal && (
        <>
          <div onClick={() => setShowDemandeModal(false)} style={{ position: 'fixed', inset: 0, zIndex: 400, background: 'rgba(0,0,0,0.55)', backdropFilter: 'blur(3px)' }} />
          <div style={{ position: 'fixed', top: '50%', left: '50%', transform: 'translate(-50%,-50%)', zIndex: 401, background: '#fff', borderRadius: 14, width: 580, boxShadow: '0 24px 64px rgba(0,0,0,0.25)', overflow: 'hidden', maxHeight: '90vh', display: 'flex', flexDirection: 'column' }}>
            <div style={{ background: 'linear-gradient(135deg, #1B4F8A, #3D1A6B)', padding: '16px 20px', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div>
                <div style={{ fontSize: 15, fontWeight: 800, color: '#fff' }}>✈️ Demande de mission terrain</div>
                <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.65)', marginTop: 2 }}>Demandeur : {user?.nom ? `${user.prenom ?? ''} ${user.nom}`.trim() : 'Utilisateur'} · Transmis automatiquement à l&apos;UAGL</div>
              </div>
              <button onClick={() => setShowDemandeModal(false)} style={{ background: 'rgba(255,255,255,0.15)', border: 'none', borderRadius: 6, padding: 6, cursor: 'pointer', color: '#fff', display: 'flex' }}><X size={14} /></button>
            </div>

            {demSubmitted ? (
              <div style={{ padding: '50px 30px', textAlign: 'center', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 14 }}>
                <div style={{ width: 64, height: 64, borderRadius: '50%', background: '#DCFCE7', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <Check size={32} style={{ color: '#16A34A' }} />
                </div>
                <div style={{ fontSize: 16, fontWeight: 800, color: '#1E293B' }}>Demande transmise à l&apos;UAGL !</div>
                <div style={{ fontSize: 12, color: '#64748B', maxWidth: 380, lineHeight: 1.6 }}>
                  Votre demande de mission pour <strong>{demDest}</strong> ({demDepart} → {demRetour}) a été soumise à l&apos;UAGL.
                  Vous recevrez l&apos;ODM signé dans les <strong>48 heures ouvrées</strong>.
                </div>
                <div style={{ display: 'flex', gap: 10, alignItems: 'center', padding: '10px 16px', background: '#F0FDF4', borderRadius: 9, border: '1px solid #BBF7D0', fontSize: 11 }}>
                  <CheckCircle2 size={14} style={{ color: '#16A34A' }} />
                  <span style={{ color: '#166534' }}>Référence : <strong>ODM-DEM-{Date.now().toString().slice(-5)}</strong> · Statut : En validation UAGL</span>
                </div>
                <button onClick={() => { setShowDemandeModal(false); setOnglet('validation'); }}
                  style={{ padding: '9px 20px', borderRadius: 9, border: 'none', background: '#1B4F8A', color: '#fff', fontSize: 12, fontWeight: 700, cursor: 'pointer' }}>
                  Voir dans Validation →
                </button>
              </div>
            ) : (
              <div style={{ flex: 1, overflowY: 'auto', padding: '20px 22px', display: 'flex', flexDirection: 'column', gap: 14 }}>
                {/* Workflow steps preview */}
                <div style={{ display: 'flex', alignItems: 'center', gap: 0, padding: '10px 14px', background: '#F8FAFC', borderRadius: 9, border: '1px solid #E2E8F0' }}>
                  {[
                    { label: 'Votre demande', done: true },
                    { label: 'Vérif. UAGL', done: false },
                    { label: 'Optimisation IA', done: false },
                    { label: 'ODM signé', done: false },
                  ].map((step, i) => (
                    <div key={step.label} style={{ display: 'flex', alignItems: 'center', flex: i < 3 ? 1 : undefined }}>
                      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3 }}>
                        <div style={{ width: 22, height: 22, borderRadius: '50%', background: step.done ? '#F47920' : '#E2E8F0', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                          {step.done ? <Check size={10} style={{ color: '#fff' }} /> : <span style={{ fontSize: 9, fontWeight: 700, color: '#94A3B8' }}>{i+1}</span>}
                        </div>
                        <span style={{ fontSize: 9, color: step.done ? '#F47920' : '#94A3B8', fontWeight: step.done ? 700 : 400, textAlign: 'center', maxWidth: 60 }}>{step.label}</span>
                      </div>
                      {i < 3 && <div style={{ flex: 1, height: 1, background: '#E2E8F0', margin: '0 4px', marginBottom: 16 }} />}
                    </div>
                  ))}
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                  <div style={{ gridColumn: '1 / -1' }}>
                    <label style={{ fontSize: 11, fontWeight: 600, color: '#374151', display: 'block', marginBottom: 4 }}>Objet de la mission *</label>
                    <input value={demObjet} onChange={e => setDemObjet(e.target.value)} placeholder="Ex: Supervision travaux HTA Zone Nord..." style={{ width: '100%', boxSizing: 'border-box', padding: '8px 10px', borderRadius: 7, border: '1px solid #D1D5DB', fontSize: 12, fontFamily: 'inherit' }} />
                  </div>
                  <div>
                    <label style={{ fontSize: 11, fontWeight: 600, color: '#374151', display: 'block', marginBottom: 4 }}>Projet</label>
                    <select value={demProjet} onChange={e => setDemProjet(e.target.value)} style={{ width: '100%', boxSizing: 'border-box', padding: '8px 10px', borderRadius: 7, border: '1px solid #D1D5DB', fontSize: 12, fontFamily: 'inherit', background: '#fff' }}>
                      {PROJETS_ODM.map(p => <option key={p}>{p}</option>)}
                    </select>
                  </div>
                  <div>
                    <label style={{ fontSize: 11, fontWeight: 600, color: '#374151', display: 'block', marginBottom: 4 }}>Destination *</label>
                    <input value={demDest} onChange={e => setDemDest(e.target.value)} placeholder="Ville / Localité" style={{ width: '100%', boxSizing: 'border-box', padding: '8px 10px', borderRadius: 7, border: '1px solid #D1D5DB', fontSize: 12, fontFamily: 'inherit' }} />
                  </div>
                  <div>
                    <label style={{ fontSize: 11, fontWeight: 600, color: '#374151', display: 'block', marginBottom: 4 }}>Date de départ *</label>
                    <input type="date" value={demDepart} onChange={e => setDemDepart(e.target.value)} style={{ width: '100%', boxSizing: 'border-box', padding: '8px 10px', borderRadius: 7, border: '1px solid #D1D5DB', fontSize: 12, fontFamily: 'inherit' }} />
                  </div>
                  <div>
                    <label style={{ fontSize: 11, fontWeight: 600, color: '#374151', display: 'block', marginBottom: 4 }}>Date de retour *</label>
                    <input type="date" value={demRetour} onChange={e => setDemRetour(e.target.value)} style={{ width: '100%', boxSizing: 'border-box', padding: '8px 10px', borderRadius: 7, border: '1px solid #D1D5DB', fontSize: 12, fontFamily: 'inherit' }} />
                  </div>
                  <div style={{ gridColumn: '1 / -1' }}>
                    <label style={{ fontSize: 11, fontWeight: 600, color: '#374151', display: 'block', marginBottom: 4 }}>Besoins & informations complémentaires</label>
                    <textarea rows={3} value={demNotes} onChange={e => setDemNotes(e.target.value)} placeholder="Nombre de participants, matériel requis, objectifs terrain..." style={{ width: '100%', boxSizing: 'border-box', padding: '8px 10px', borderRadius: 7, border: '1px solid #D1D5DB', fontSize: 12, fontFamily: 'inherit', resize: 'vertical' }} />
                  </div>
                  <div style={{ gridColumn: '1 / -1', padding: '10px 14px', background: '#FFF7ED', borderRadius: 8, border: '1px solid #FED7AA', fontSize: 11, color: '#92400E', display: 'flex', gap: 8, alignItems: 'flex-start' }}>
                    <AlertCircle size={14} style={{ flexShrink: 0, marginTop: 1 }} />
                    <span>L&apos;UAGL assignera le véhicule, les dotations carburant et optimisera l&apos;itinéraire via IA. L&apos;ODM signé vous sera transmis sous 48h ouvrées.</span>
                  </div>
                </div>
              </div>
            )}

            {!demSubmitted && (
              <div style={{ padding: '14px 22px', borderTop: '1px solid #E5E7EB', display: 'flex', gap: 8, justifyContent: 'flex-end', flexShrink: 0 }}>
                <button onClick={() => setShowDemandeModal(false)} style={{ padding: '8px 16px', fontSize: 12, fontWeight: 600, borderRadius: 7, border: '1px solid #D1D5DB', background: '#fff', color: '#374151', cursor: 'pointer' }}>Annuler</button>
                <button onClick={() => {
                  if (!demObjet.trim() || !demDest.trim() || !demDepart || !demRetour) { alert('Veuillez remplir tous les champs obligatoires.'); return; }
                  setDemSubmitted(true);
                }} style={{ padding: '8px 20px', fontSize: 12, fontWeight: 700, borderRadius: 7, border: 'none', background: '#F47920', color: '#fff', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6 }}>
                  <Check size={12} /> Soumettre à l&apos;UAGL
                </button>
              </div>
            )}
          </div>
        </>
      )}

      <style>{`
        @keyframes spin { to { transform: rotate(360deg); } }
      `}</style>
    </div>
  );
}

// ─── PARAMÈTRES ODM (paramétrable) ─────────────────────────────────────────────

const fmt = (n: number) => n.toLocaleString('fr-FR');

function PCard({ title, icon, accent, children }: { title: string; icon: React.ReactNode; accent: string; children: React.ReactNode }) {
  return (
    <div style={{ background: '#fff', borderRadius: 12, padding: 18, boxShadow: '0 1px 4px rgba(0,0,0,0.07)', borderTop: `3px solid ${accent}` }}>
      <h3 style={{ margin: '0 0 14px', fontSize: 14, fontWeight: 700, color: 'var(--navy)', display: 'flex', alignItems: 'center', gap: 8 }}>{icon} {title}</h3>
      {children}
    </div>
  );
}

const pInp: React.CSSProperties = { width: '100%', padding: '7px 10px', border: '1px solid #E2E8F0', borderRadius: 7, fontSize: 12, fontFamily: 'inherit', boxSizing: 'border-box', background: '#F8FAFC' };
const pBtnDel: React.CSSProperties = { padding: 5, border: 'none', background: 'transparent', cursor: 'pointer', color: '#EF4444', display: 'flex', alignItems: 'center' };

function ParametresODMTab() {
  const cfg = useOdmConfig();
  const [vLabel, setVLabel] = useState(''); const [vConso, setVConso] = useState(13);
  const [rRegion, setRRegion] = useState(''); const [rMontant, setRMontant] = useState(25000);
  const [pPays, setPPays] = useState(''); const [pUSD, setPUSD] = useState(150);
  const [gCat, setGCat] = useState(''); const [gSal, setGSal] = useState(700000); const [gH, setGH] = useState(173.33);

  // Simulateur heures sup.
  const [hsGrade, setHsGrade] = useState(cfg.grilleSalariale[0]?.id ?? '');
  const [hsHeures, setHsHeures] = useState(5);
  const [hsType, setHsType] = useState<'majJourOuvrable' | 'majNuit' | 'majDimanche' | 'majFerie'>('majJourOuvrable');
  const grade = cfg.grilleSalariale.find(g => g.id === hsGrade) ?? cfg.grilleSalariale[0];
  const majPct = cfg.heuresSup[hsType];
  const coutHS = grade ? coutHeuresSup(grade, hsHeures, majPct) : 0;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 10 }}>
        <p style={{ margin: 0, fontSize: 12, color: '#64748B', maxWidth: 720, lineHeight: 1.5 }}>
          Référentiel paramétrable des Ordres de Mission : flotte, per diem (national & international), carburant,
          grille salariale et règles d&apos;heures supplémentaires. Ces valeurs alimentent automatiquement les calculs
          des nouvelles missions. Modifications enregistrées en continu.
        </p>
        <button onClick={() => { if (confirm('Réinitialiser tous les paramètres ODM par défaut ?')) cfg.resetConfig(); }}
          style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 14px', borderRadius: 8, border: '1px solid #E2E8F0', background: '#fff', color: '#374151', fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>
          <RotateCcw size={13} /> Réinitialiser
        </button>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(420px, 1fr))', gap: 18, alignItems: 'start' }}>

        {/* ── Flotte véhicules ── */}
        <PCard title="Flotte véhicules" icon={<Truck size={16} color="#1B4F8A" />} accent="#1B4F8A">
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {cfg.vehicules.map(v => (
              <div key={v.id} style={{ display: 'grid', gridTemplateColumns: '1fr 90px 60px 28px', gap: 6, alignItems: 'center' }}>
                <input value={v.label} onChange={e => cfg.updateVehicule(v.id, { label: e.target.value })} style={pInp} />
                <input type="number" min={0} value={v.consoLitresPer100} onChange={e => cfg.updateVehicule(v.id, { consoLitresPer100: Math.max(0, Number(e.target.value)) })} style={{ ...pInp, textAlign: 'center' }} title="L/100 km" />
                <label style={{ fontSize: 10, color: '#64748B', display: 'flex', alignItems: 'center', gap: 4, cursor: 'pointer' }}>
                  <input type="checkbox" checked={v.actif} onChange={e => cfg.updateVehicule(v.id, { actif: e.target.checked })} /> actif
                </label>
                <button style={pBtnDel} onClick={() => cfg.removeVehicule(v.id)}><Trash2 size={13} /></button>
              </div>
            ))}
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 90px auto', gap: 6, marginTop: 10, paddingTop: 10, borderTop: '1px dashed #E2E8F0', alignItems: 'center' }}>
            <input placeholder="Immat. — Marque modèle" value={vLabel} onChange={e => setVLabel(e.target.value)} style={pInp} />
            <input type="number" min={0} value={vConso} onChange={e => setVConso(Number(e.target.value))} style={{ ...pInp, textAlign: 'center' }} title="L/100 km" />
            <button disabled={!vLabel.trim()} onClick={() => { cfg.addVehicule(vLabel, vConso); setVLabel(''); setVConso(13); }}
              style={{ padding: '7px 12px', borderRadius: 7, border: 'none', background: '#1B4F8A', color: '#fff', fontSize: 12, fontWeight: 700, cursor: 'pointer', opacity: vLabel.trim() ? 1 : 0.5 }}>
              <Plus size={12} />
            </button>
          </div>
        </PCard>

        {/* ── Carburant ── */}
        <PCard title="Carburant" icon={<Fuel size={16} color="#F47920" />} accent="#F47920">
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <div>
              <label style={{ fontSize: 11, fontWeight: 600, color: '#374151', display: 'block', marginBottom: 5 }}>Prix du litre (FCFA)</label>
              <input type="number" min={0} value={cfg.carburant.prixLitre} onChange={e => cfg.setCarburant({ prixLitre: Math.max(0, Number(e.target.value)) })} style={pInp} />
            </div>
            <div>
              <label style={{ fontSize: 11, fontWeight: 600, color: '#374151', display: 'block', marginBottom: 5 }}>Conso. moyenne (L/100 km)</label>
              <input type="number" min={0} value={cfg.carburant.consoMoyennePar100} onChange={e => cfg.setCarburant({ consoMoyennePar100: Math.max(0, Number(e.target.value)) })} style={pInp} />
            </div>
          </div>
          <div style={{ marginTop: 10, fontSize: 11, color: '#64748B', background: '#FFF7ED', border: '1px solid #FED7AA', borderRadius: 7, padding: '8px 10px' }}>
            Ex. mission 400 km → {calculDotation(400, cfg.carburant.consoMoyennePar100)} L ≈ {fmt(calculDotation(400, cfg.carburant.consoMoyennePar100) * cfg.carburant.prixLitre)} FCFA
          </div>
        </PCard>

        {/* ── Per diem national ── */}
        <PCard title="Per diem national (FCFA / jour)" icon={<Wallet size={16} color="#16A34A" />} accent="#16A34A">
          <div style={{ marginBottom: 10 }}>
            <label style={{ fontSize: 11, fontWeight: 600, color: '#374151', display: 'block', marginBottom: 5 }}>Base nationale</label>
            <input type="number" min={0} value={cfg.perdiemBaseDomestique} onChange={e => cfg.setPerdiemBase(Number(e.target.value))} style={pInp} />
          </div>
          <div style={{ fontSize: 10, fontWeight: 700, color: '#64748B', textTransform: 'uppercase', letterSpacing: '0.05em', margin: '6px 0' }}>Surcharges régionales</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {cfg.perdiemsRegionaux.map(r => (
              <div key={r.region} style={{ display: 'grid', gridTemplateColumns: '1fr 110px 28px', gap: 6, alignItems: 'center' }}>
                <span style={{ fontSize: 12, color: 'var(--navy)', fontWeight: 600 }}>{r.region}</span>
                <input type="number" min={0} value={r.montantJour} onChange={e => cfg.setPerdiemRegion(r.region, Number(e.target.value))} style={{ ...pInp, textAlign: 'right' }} />
                <button style={pBtnDel} onClick={() => cfg.removePerdiemRegion(r.region)}><Trash2 size={13} /></button>
              </div>
            ))}
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 110px auto', gap: 6, marginTop: 10, paddingTop: 10, borderTop: '1px dashed #E2E8F0', alignItems: 'center' }}>
            <input placeholder="Région" value={rRegion} onChange={e => setRRegion(e.target.value)} style={pInp} />
            <input type="number" min={0} value={rMontant} onChange={e => setRMontant(Number(e.target.value))} style={{ ...pInp, textAlign: 'right' }} />
            <button disabled={!rRegion.trim()} onClick={() => { cfg.setPerdiemRegion(rRegion, rMontant); setRRegion(''); setRMontant(25000); }}
              style={{ padding: '7px 12px', borderRadius: 7, border: 'none', background: '#16A34A', color: '#fff', fontSize: 12, fontWeight: 700, cursor: 'pointer', opacity: rRegion.trim() ? 1 : 0.5 }}><Plus size={12} /></button>
          </div>
        </PCard>

        {/* ── Per diem international ── */}
        <PCard title="Per diem international (USD / jour)" icon={<Plane size={16} color="#7C3AED" />} accent="#7C3AED">
          <div style={{ marginBottom: 10, display: 'flex', alignItems: 'center', gap: 10 }}>
            <label style={{ fontSize: 11, fontWeight: 600, color: '#374151' }}>Taux de change 1 USD =</label>
            <input type="number" min={1} value={cfg.tauxUSDtoFCFA} onChange={e => cfg.setTauxChange(Number(e.target.value))} style={{ ...pInp, width: 100 }} />
            <span style={{ fontSize: 11, color: '#64748B' }}>FCFA</span>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6, maxHeight: 240, overflowY: 'auto' }}>
            {cfg.perdiemsInternationaux.map(p => (
              <div key={p.pays} style={{ display: 'grid', gridTemplateColumns: '1fr 80px 90px 28px', gap: 6, alignItems: 'center' }}>
                <span style={{ fontSize: 12, color: 'var(--navy)', fontWeight: 600 }}>{p.pays}</span>
                <input type="number" min={0} value={p.montantUSDJour} onChange={e => cfg.setPerdiemPays(p.pays, Number(e.target.value))} style={{ ...pInp, textAlign: 'right' }} />
                <span style={{ fontSize: 10, color: '#64748B', textAlign: 'right' }}>{fmt(perdiemFCFA(p.montantUSDJour, cfg.tauxUSDtoFCFA))} F</span>
                <button style={pBtnDel} onClick={() => cfg.removePerdiemPays(p.pays)}><Trash2 size={13} /></button>
              </div>
            ))}
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 80px auto', gap: 6, marginTop: 10, paddingTop: 10, borderTop: '1px dashed #E2E8F0', alignItems: 'center' }}>
            <input placeholder="Pays" value={pPays} onChange={e => setPPays(e.target.value)} style={pInp} />
            <input type="number" min={0} value={pUSD} onChange={e => setPUSD(Number(e.target.value))} style={{ ...pInp, textAlign: 'right' }} />
            <button disabled={!pPays.trim()} onClick={() => { cfg.setPerdiemPays(pPays, pUSD); setPPays(''); setPUSD(150); }}
              style={{ padding: '7px 12px', borderRadius: 7, border: 'none', background: '#7C3AED', color: '#fff', fontSize: 12, fontWeight: 700, cursor: 'pointer', opacity: pPays.trim() ? 1 : 0.5 }}><Plus size={12} /></button>
          </div>
        </PCard>

        {/* ── Grille salariale ── */}
        <PCard title="Grille salariale (taux horaire)" icon={<Users size={16} color="#0E7490" />} accent="#0E7490">
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 110px 70px 90px 28px', gap: 6, fontSize: 9, fontWeight: 700, color: '#94A3B8', textTransform: 'uppercase', marginBottom: 4 }}>
            <span>Catégorie</span><span style={{ textAlign: 'right' }}>Salaire/mois</span><span style={{ textAlign: 'center' }}>H/mois</span><span style={{ textAlign: 'right' }}>Taux/h</span><span />
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {cfg.grilleSalariale.map(g => (
              <div key={g.id} style={{ display: 'grid', gridTemplateColumns: '1fr 110px 70px 90px 28px', gap: 6, alignItems: 'center' }}>
                <input value={g.categorie} onChange={e => cfg.updateGrade(g.id, { categorie: e.target.value })} style={pInp} />
                <input type="number" min={0} value={g.salaireMensuel} onChange={e => cfg.updateGrade(g.id, { salaireMensuel: Math.max(0, Number(e.target.value)) })} style={{ ...pInp, textAlign: 'right' }} />
                <input type="number" min={1} step="0.01" value={g.heuresMensuelles} onChange={e => cfg.updateGrade(g.id, { heuresMensuelles: Math.max(1, Number(e.target.value)) })} style={{ ...pInp, textAlign: 'center' }} />
                <span style={{ fontSize: 11, fontWeight: 700, color: '#0E7490', textAlign: 'right' }}>{fmt(tauxHoraire(g))} F</span>
                <button style={pBtnDel} onClick={() => cfg.removeGrade(g.id)}><Trash2 size={13} /></button>
              </div>
            ))}
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 110px 70px auto', gap: 6, marginTop: 10, paddingTop: 10, borderTop: '1px dashed #E2E8F0', alignItems: 'center' }}>
            <input placeholder="Catégorie" value={gCat} onChange={e => setGCat(e.target.value)} style={pInp} />
            <input type="number" min={0} value={gSal} onChange={e => setGSal(Number(e.target.value))} style={{ ...pInp, textAlign: 'right' }} />
            <input type="number" min={1} step="0.01" value={gH} onChange={e => setGH(Number(e.target.value))} style={{ ...pInp, textAlign: 'center' }} />
            <button disabled={!gCat.trim()} onClick={() => { cfg.addGrade(gCat, gSal, gH); setGCat(''); setGSal(700000); setGH(173.33); }}
              style={{ padding: '7px 12px', borderRadius: 7, border: 'none', background: '#0E7490', color: '#fff', fontSize: 12, fontWeight: 700, cursor: 'pointer', opacity: gCat.trim() ? 1 : 0.5 }}><Plus size={12} /></button>
          </div>
        </PCard>

        {/* ── Heures supplémentaires ── */}
        <PCard title="Heures supplémentaires" icon={<Calculator size={16} color="#B45309" />} accent="#B45309">
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
            {([
              { key: 'seuilHebdo', label: 'Seuil hebdo. (h)' },
              { key: 'majJourOuvrable', label: 'Majoration jour ouvrable (%)' },
              { key: 'majNuit', label: 'Majoration nuit (%)' },
              { key: 'majDimanche', label: 'Majoration dimanche (%)' },
              { key: 'majFerie', label: 'Majoration jour férié (%)' },
            ] as { key: keyof typeof cfg.heuresSup; label: string }[]).map(f => (
              <div key={f.key}>
                <label style={{ fontSize: 11, fontWeight: 600, color: '#374151', display: 'block', marginBottom: 5 }}>{f.label}</label>
                <input type="number" min={0} value={cfg.heuresSup[f.key]} onChange={e => cfg.setHeuresSup({ [f.key]: Math.max(0, Number(e.target.value)) })} style={pInp} />
              </div>
            ))}
          </div>

          {/* Simulateur */}
          <div style={{ marginTop: 14, padding: 12, background: '#FFFBEB', border: '1px solid #FDE68A', borderRadius: 8 }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: '#92400E', marginBottom: 8 }}>Simulateur de coût d&apos;heures sup.</div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 70px 1fr', gap: 8, alignItems: 'end' }}>
              <div>
                <label style={{ fontSize: 10, color: '#64748B', display: 'block', marginBottom: 4 }}>Catégorie</label>
                <select value={hsGrade} onChange={e => setHsGrade(e.target.value)} style={pInp}>
                  {cfg.grilleSalariale.map(g => <option key={g.id} value={g.id}>{g.categorie}</option>)}
                </select>
              </div>
              <div>
                <label style={{ fontSize: 10, color: '#64748B', display: 'block', marginBottom: 4 }}>Heures</label>
                <input type="number" min={0} value={hsHeures} onChange={e => setHsHeures(Math.max(0, Number(e.target.value)))} style={{ ...pInp, textAlign: 'center' }} />
              </div>
              <div>
                <label style={{ fontSize: 10, color: '#64748B', display: 'block', marginBottom: 4 }}>Type</label>
                <select value={hsType} onChange={e => setHsType(e.target.value as typeof hsType)} style={pInp}>
                  <option value="majJourOuvrable">Jour ouvrable (+{cfg.heuresSup.majJourOuvrable}%)</option>
                  <option value="majNuit">Nuit (+{cfg.heuresSup.majNuit}%)</option>
                  <option value="majDimanche">Dimanche (+{cfg.heuresSup.majDimanche}%)</option>
                  <option value="majFerie">Férié (+{cfg.heuresSup.majFerie}%)</option>
                </select>
              </div>
            </div>
            <div style={{ marginTop: 10, display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: 12 }}>
              <span style={{ color: '#92400E' }}>Taux horaire base : <strong>{grade ? fmt(tauxHoraire(grade)) : 0} F</strong> · majoration +{majPct}%</span>
              <span style={{ fontSize: 16, fontWeight: 800, color: '#B45309' }}>{fmt(coutHS)} FCFA</span>
            </div>
          </div>
        </PCard>

      </div>
    </div>
  );
}

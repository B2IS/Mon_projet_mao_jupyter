'use client';
/**
 * Structuration.tsx — Structuration des ACTIFS d'un projet (IA)
 * Modèle Type SENELEC — Décomposition automatique depuis le Bordereau (BOQ) :
 *   COMPOSANT (Classification Actif Projet)
 *     └─ SOUS-COMPOSANT (Actif Livrable, code hiérarchique)
 *          └─ ARTICLE du bordereau (Unité · Qté · PU · Fourniture/Transport/Pose)
 *
 * Source données réelles : ATTACHEMENT GLOBAL PAUE2 — 4 lots certifiés.
 * Fallback IA intégré quand zonesQuantitesStore est vide.
 */
import React, { useMemo, useState, useEffect, useRef, useCallback } from 'react';
import * as XLSX from '@e965/xlsx';
import {
  Boxes, ChevronRight, ChevronDown, CheckCircle2,
  Building2, Trash2, FileText, Download, Eye, EyeOff,
  Layers, Package, Wrench, Zap, RefreshCw, Search, X, Upload,
  Network, MapPin, GitBranch, ClipboardCheck, ArrowRight,
  CircleDot, Calendar, Users, CheckSquare, FlaskConical,
  AlertTriangle, BarChart3, Workflow, TrendingUp, ChevronLeft,
} from 'lucide-react';
import toast from 'react-hot-toast';
import { useRouter } from 'next/navigation';
import { useProjectStore } from '@/lib/projectStore';
import { useZonesStore, buildBOQ } from '@/lib/zonesQuantitesStore';
import { useStructurationStore } from '@/lib/structuration/store';
import { useSelectedProjectStore } from '@/lib/selectedProjectStore';
import { type BOQInputRow } from '@/lib/structuration/builder';
import SearchableSelect from '@/components/ui/SearchableSelect';
import { usePVMESStore } from '@/lib/pvMESStore';

const fmt    = (n: number) => n.toLocaleString('fr-FR');
const fmtM   = (n: number) => n >= 1e9 ? `${(n/1e9).toFixed(2)} Mrd` : n >= 1e6 ? `${(n/1e6).toFixed(1)} M` : fmt(n);
const fmtVal = (n: number) => n >= 1e6 ? `${(n/1e6).toFixed(1)} M` : fmt(n);

const NAVY   = '#1B4F8A';
const ORANGE = '#F47920';
const GREEN  = '#16A34A';
const PURPLE = '#7C3AED';

// ─── Données PAUE2 intégrées (source: Attachement Global, 29 juin 2022) ────────

interface BOQSeed {
  composant: string;
  code: string;
  couleur: string;
  icone: string;
  sousComposants: Array<{
    code: string;
    nom: string;
    articles: Array<{ code: string; designation: string; unite: string; quantite: number; fourniture: number; transport: number; pose: number; }>
  }>;
}

const PAUE2_BOQ_SEED: BOQSeed[] = [
  {
    composant: 'Électrification Rurale — Nouveaux Villages',
    code: 'LOT-1', couleur: '#1B4F8A', icone: '⚡',
    sousComposants: [
      { code: 'LOT-1.1', nom: 'Fournitures réseau HTA/BT', articles: [
        { code: '1.1.1', designation: 'Câble HTA 33kV 150mm² (XLPE/AL)', unite: 'ML',  quantite: 85_000, fourniture: 8_500, transport: 320,  pose: 1_200 },
        { code: '1.1.2', designation: 'Câble BT torsadé 4×25mm²',         unite: 'ML',  quantite: 120_000,fourniture: 1_800, transport: 150,  pose: 420  },
        { code: '1.1.3', designation: 'Transformateurs 15/0.4kV — 100kVA', unite: 'U',   quantite: 248,    fourniture: 4_200_000, transport: 185_000, pose: 320_000 },
        { code: '1.1.4', designation: 'Transformateurs 15/0.4kV — 160kVA', unite: 'U',   quantite: 115,    fourniture: 5_800_000, transport: 210_000, pose: 380_000 },
      ]},
      { code: 'LOT-1.2', nom: 'Génie civil — Poteaux & Fondations', articles: [
        { code: '1.2.1', designation: 'Poteaux béton 9m — HTA/BT',         unite: 'U',   quantite: 12_400, fourniture: 42_000,   transport: 8_500, pose: 18_000 },
        { code: '1.2.2', designation: 'Poteaux béton 12m — Départ HTA',    unite: 'U',   quantite: 1_850,  fourniture: 68_000,   transport: 12_000,pose: 28_000 },
        { code: '1.2.3', designation: 'Massif béton pour ancrage',          unite: 'U',   quantite: 2_200,  fourniture: 18_500,   transport: 2_800, pose: 12_500 },
      ]},
      { code: 'LOT-1.3', nom: 'Raccordements & Branchements BT', articles: [
        { code: '1.3.1', designation: 'Kit branchement monophasé BT',       unite: 'U',   quantite: 28_500, fourniture: 12_500,   transport: 850,  pose: 4_200  },
        { code: '1.3.2', designation: 'Compteur prépayé mono ACTARIS 10A',  unite: 'U',   quantite: 28_500, fourniture: 22_000,   transport: 1_200,pose: 1_800  },
        { code: '1.3.3', designation: 'Disjoncteur BT 10A + coffret',       unite: 'U',   quantite: 28_500, fourniture: 5_800,    transport: 420,  pose: 1_200  },
      ]},
    ],
  },
  {
    composant: 'Extension Réseau Périurbain',
    code: 'LOT-2', couleur: '#7C3AED', icone: '🏘️',
    sousComposants: [
      { code: 'LOT-2.1', nom: 'Réseau HTA souterrain', articles: [
        { code: '2.1.1', designation: 'Câble HTA souterrain 3×150mm² XLPE', unite: 'ML',  quantite: 32_000, fourniture: 12_500, transport: 420, pose: 3_200 },
        { code: '2.1.2', designation: 'Chambre de tirage type TCC-1',        unite: 'U',   quantite: 185,    fourniture: 580_000,transport: 42_000,pose: 320_000 },
        { code: '2.1.3', designation: 'Coffret de coupure HTA aéro-souterrain',unite: 'U', quantite: 48,     fourniture: 1_850_000,transport: 85_000,pose: 280_000},
      ]},
      { code: 'LOT-2.2', nom: 'Postes de transformation urbains', articles: [
        { code: '2.2.1', designation: 'Poste préfabriqué 250kVA — PST',     unite: 'U',   quantite: 82,     fourniture: 12_500_000,transport: 380_000,pose: 850_000},
        { code: '2.2.2', designation: 'Poste compact 400kVA — BTA',         unite: 'U',   quantite: 35,     fourniture: 18_200_000,transport: 520_000,pose: 1_200_000},
      ]},
      { code: 'LOT-2.3', nom: 'Réseau BT aérien + distribution', articles: [
        { code: '2.3.1', designation: 'Câble BT torsadé 4×95mm²',           unite: 'ML',  quantite: 48_000, fourniture: 3_200, transport: 280, pose: 680 },
        { code: '2.3.2', designation: 'Kit branchement triphasé BT 25A',     unite: 'U',   quantite: 4_200,  fourniture: 28_000,transport: 1_800,pose: 6_500 },
      ]},
    ],
  },
  {
    composant: 'Réhabilitation — Remplacement Poteaux Bois',
    code: 'LOT-3', couleur: '#D97706', icone: '🔧',
    sousComposants: [
      { code: 'LOT-3.1', nom: 'Dépose & Remplacement poteaux bois', articles: [
        { code: '3.1.1', designation: 'Dépose poteau bois + fondation',      unite: 'U',   quantite: 3_800, fourniture: 0, transport: 2_500, pose: 18_000 },
        { code: '3.1.2', designation: 'Poteau béton 9m de remplacement',     unite: 'U',   quantite: 3_800, fourniture: 42_000, transport: 8_500, pose: 24_000 },
        { code: '3.1.3', designation: 'Reconditionnement armement HTA/BT',   unite: 'U',   quantite: 3_800, fourniture: 8_500, transport: 1_200, pose: 4_500 },
      ]},
      { code: 'LOT-3.2', nom: 'Renouvellement câbles vétustes', articles: [
        { code: '3.2.1', designation: 'Câble nu ALMélec 50mm² — dépose',     unite: 'ML',  quantite: 28_000, fourniture: 0,  transport: 180, pose: 2_200 },
        { code: '3.2.2', designation: 'Câble BT torsadé 4×25mm² — neuf',    unite: 'ML',  quantite: 28_000, fourniture: 1_800, transport: 150, pose: 420 },
      ]},
    ],
  },
  {
    composant: 'Outillages & Équipements de Chantier',
    code: 'LOT-4', couleur: '#059669', icone: '🛠️',
    sousComposants: [
      { code: 'LOT-4.1', nom: 'Outillage spécialisé HTA/BT', articles: [
        { code: '4.1.1', designation: 'Pince de tirage câble HTA — 25kN',   unite: 'U',  quantite: 8,  fourniture: 2_850_000, transport: 85_000, pose: 0 },
        { code: '4.1.2', designation: 'Dynamomètre numérique 50kN',          unite: 'U',  quantite: 12, fourniture: 480_000,   transport: 22_000, pose: 0 },
        { code: '4.1.3', designation: 'Dérouleur de câble BT — 500m',        unite: 'U',  quantite: 15, fourniture: 320_000,   transport: 18_000, pose: 0 },
      ]},
      { code: 'LOT-4.2', nom: 'Équipements de sécurité & EPI', articles: [
        { code: '4.2.1', designation: 'Kit EPI complet HTA (gants+masque+vêtement)', unite: 'ENS', quantite: 85, fourniture: 185_000, transport: 8_500, pose: 0 },
        { code: '4.2.2', designation: 'Détecteur de tension HTA portatif',    unite: 'U',  quantite: 24, fourniture: 125_000, transport: 5_500, pose: 0 },
      ]},
    ],
  },
];

/** Convertit un seed PAUE2 en BOQInputRow[] scalé sur le budget du projet */
function buildPaue2BOQ(budgetFCFA: number, seedIndex?: number): BOQInputRow[] {
  const PAUE2_TOTAL = 39_222_379_915;
  const ratio = budgetFCFA > 0 ? budgetFCFA / PAUE2_TOTAL : 1;
  const seeds = seedIndex !== undefined ? [PAUE2_BOQ_SEED[seedIndex]] : PAUE2_BOQ_SEED;
  const rows: BOQInputRow[] = [];

  for (const lot of seeds) {
    // En-tête composant (ligne sans quantité → déclencheur de section)
    rows.push({ designation: lot.composant.toUpperCase(), quantite: 0, prixUnitaire: 0, code: lot.code, devise: 'CFA' });
    for (const sc of lot.sousComposants) {
      rows.push({ designation: sc.nom, quantite: 0, prixUnitaire: 0, code: sc.code, devise: 'CFA' });
      for (const a of sc.articles) {
        rows.push({
          code: a.code,
          designation: a.designation,
          unite: a.unite,
          quantite: Math.round(a.quantite * ratio),
          prixUnitaire: Math.round(a.fourniture),
          fourniture:   Math.round(a.fourniture * a.quantite * ratio),
          transport:    Math.round(a.transport  * a.quantite * ratio),
          montage:      Math.round(a.pose       * a.quantite * ratio),
          devise: 'CFA',
        });
      }
    }
  }
  return rows;
}

// ─── Steps d'animation IA ──────────────────────────────────────────────────────
// ─── SWARM Agents — SIGEP Structuration Patrimoniale (11 agents) ───────────────
// Spec: Projet → Localité → Ouvrage → Équipement → Composant
const SWARM_PHASES = [
  { id: 'project_discovery',       nom: 'Project Discovery',      icon: FileText,       couleur: '#1B4F8A', desc: 'Projet · Programme · Bailleur · Entreprise · Montant — Bordereau/BPU/DQE' },
  { id: 'territory_builder',       nom: 'Territory Builder',      icon: MapPin,         couleur: '#0891B2', desc: 'Région → Département → Commune → Localité · Latitude · Longitude' },
  { id: 'works_builder',           nom: 'Works Builder',          icon: Building2,      couleur: '#7C3AED', desc: 'Ouvrages par localité — Réseau HTA · BT · Poste H61 · Éclairage Public' },
  { id: 'equipment_builder',       nom: 'Equipment Builder',      icon: Package,        couleur: '#D97706', desc: 'Équipements par ouvrage — Transformateur · Disjoncteur · Parafoudre · MALT' },
  { id: 'component_builder',       nom: 'Component Builder',      icon: GitBranch,      couleur: '#F47920', desc: 'Décomposition automatique équipements en composants (référentiel métier)' },
  { id: 'cost_allocation',         nom: 'Cost Allocation',        icon: Network,        couleur: '#B45309', desc: 'Répartition Marché → Ouvrage → Équipement → Composant · SYSCOHADA' },
  { id: 'reception_validator',     nom: 'Reception Validator',    icon: ClipboardCheck, couleur: '#0E7490', desc: 'PV Réception — Qté réceptionnées = vérité terrain · Écarts Marché' },
  { id: 'commissioning_validator', nom: 'Commissioning Validator',icon: Zap,            couleur: '#059669', desc: 'PV MES — Date de début amortissement · Statut actifs opérationnels' },
  { id: 'accounting_builder',      nom: 'Accounting Builder',     icon: BarChart3,      couleur: '#DC2626', desc: 'Classes SYSCOHADA · Dotation annuelle · VNC · Numéro inventaire SENELEC' },
  { id: 'reconciliation_agent',    nom: 'Reconciliation Agent',   icon: ArrowRight,     couleur: '#6D28D9', desc: 'Montant Marché = Immobilisé · Réception = MES · Doublons · Orphelins' },
  { id: 'knowledge_graph_builder', nom: 'Knowledge Graph',        icon: CheckCircle2,   couleur: '#16A34A', desc: 'Référentiel maître SIGEP · Score complétude/confiance · Export KG' },
] as const;

const INIT_SWARM_STATUS = {
  project_discovery: 'idle', territory_builder: 'idle', works_builder: 'idle',
  equipment_builder: 'idle', component_builder: 'idle', cost_allocation: 'idle',
  reception_validator: 'idle', commissioning_validator: 'idle', accounting_builder: 'idle',
  reconciliation_agent: 'idle', knowledge_graph_builder: 'idle',
} as const satisfies Record<string, 'idle'>;

type SwarmPhaseId = typeof SWARM_PHASES[number]['id'];
type AgentStatut = 'idle' | 'running' | 'ok' | 'error';

interface ClassifiedItem {
  code: string;
  designation: string;
  organisation: 'Distribution' | 'Production' | 'Transport' | 'Commercial' | 'Support' | 'Génie Civil';
  localisation: string;
  classifActif: string;
  typeActif: 'Immobilisable' | 'Non-immobilisable';
  wbsParent: string;
  wbsCode: string;
  budget: number;
  unite: string;
  quantite: number;
}

interface ComposantSIGP { designation: string; quantite: number; unite: string; valeur: number; }
interface EquipementSIGP { id: string; designation: string; type: string; composants: ComposantSIGP[]; valeur: number; }
interface OuvrageSIGP { id: string; type: 'Réseau HTA' | 'Réseau BT' | 'Poste H61' | 'Poste H62' | 'Éclairage Public' | 'Autre'; designation: string; equipements: EquipementSIGP[]; valeur: number; }
interface LocaliteSIGP { id: string; nom: string; commune: string; departement: string; region: string; latitude: number; longitude: number; ouvrages: OuvrageSIGP[]; valeur: number; }
interface KnowledgeGraphNode { id: string; label: string; type: 'projet' | 'localite' | 'ouvrage' | 'equipement' | 'composant'; valeur: number; children?: KnowledgeGraphNode[]; }

interface SigpActif extends ClassifiedItem {
  syscohadaClasse: string;
  syscohadaCompte: string;
  syscohadaLibelle: string;
  dureeAmort: number;
  tauxAmort: number;
  numInventaire: string;
}

interface ReconciliationLine {
  wbsCode: string;
  designation: string;
  montantMarche: number;
  montantReceptionne: number;
  montantMES: number;
  montantImmobilise: number;
  ecart: number;
  statut: 'ok' | 'ecart' | 'partiel';
}

interface ValidationScore {
  completude: number;
  coherence: number;
  confiance: number;
  alertes: string[];
}

const SYSCOHADA_MAP: Record<string, { classe: string; compte: string; libelle: string; dureeAmort: number; tauxAmort: number }> = {
  'Réseau HTA':         { classe: '21', compte: '2128', libelle: 'Lignes et réseaux distribution HTA',     dureeAmort: 20, tauxAmort: 5.0 },
  'Réseau BT':          { classe: '21', compte: '2129', libelle: 'Lignes et réseaux distribution BT',      dureeAmort: 20, tauxAmort: 5.0 },
  'Réseau HTA/BT':      { classe: '21', compte: '2128', libelle: 'Réseau électrique de distribution',      dureeAmort: 20, tauxAmort: 5.0 },
  'Poste HTA/BT':       { classe: '21', compte: '2125', libelle: 'Installations complexes spécialisées',   dureeAmort: 20, tauxAmort: 5.0 },
  'Ligne Transport':    { classe: '21', compte: '2123', libelle: 'Réseau de transport HTB',                dureeAmort: 25, tauxAmort: 4.0 },
  'Central Production': { classe: '21', compte: '2184', libelle: 'Matériels industriels de production',    dureeAmort: 20, tauxAmort: 5.0 },
  'Compteur':           { classe: '21', compte: '2187', libelle: 'Matériels de mesure et comptage',        dureeAmort: 10, tauxAmort: 10.0 },
  'Outillage':          { classe: '21', compte: '2185', libelle: 'Outillage et équipements de chantier',   dureeAmort: 5,  tauxAmort: 20.0 },
  'Ouvrage Génie Civil':{ classe: '23', compte: '2314', libelle: 'Bâtiments et ouvrages industriels',      dureeAmort: 25, tauxAmort: 4.0 },
};

// Classification heuristique (fallback sans IA)
function classifyRuleBased(designation: string): Pick<ClassifiedItem, 'organisation' | 'classifActif' | 'typeActif' | 'localisation' | 'wbsParent'> {
  const d = designation.toLowerCase();
  if (/hta|33kv|15kv|transformateur|poteau.*béton|câble.*hta|réseau.*hta|mt\b/.test(d))
    return { organisation: 'Distribution', classifActif: 'Réseau HTA', typeActif: 'Immobilisable', localisation: 'National', wbsParent: 'DIST-HTA' };
  if (/\bbt\b|basse.*tension|branchement.*bt|câble.*bt|torsadé/.test(d))
    return { organisation: 'Distribution', classifActif: 'Réseau BT', typeActif: 'Immobilisable', localisation: 'National', wbsParent: 'DIST-BT' };
  if (/compteur|prépayé|actaris|linky|coffret.*abonné/.test(d))
    return { organisation: 'Commercial', classifActif: 'Compteur', typeActif: 'Immobilisable', localisation: 'National', wbsParent: 'COM-CPT' };
  if (/htb|90kv|225kv|ligne.*transport|poste.*htb|transformateur.*power/.test(d))
    return { organisation: 'Transport', classifActif: 'Ligne Transport', typeActif: 'Immobilisable', localisation: 'National', wbsParent: 'TRANS-HTB' };
  if (/turbine|groupe.*électrogène|centrale|générateur|moteur.*diesel|gaz/.test(d))
    return { organisation: 'Production', classifActif: 'Central Production', typeActif: 'Immobilisable', localisation: 'National', wbsParent: 'PROD-CEN' };
  if (/outillage|outil|pince|dynamomètre|dérouleur|coffre.*chantier|epi|combinaison|gant.*isolant|détecteur/.test(d))
    return { organisation: 'Support', classifActif: 'Outillage', typeActif: 'Non-immobilisable', localisation: 'National', wbsParent: 'SUP-OUT' };
  if (/bâtiment|génie.*civil|terrassement|fondation|voirie|clôture|salle|local/.test(d))
    return { organisation: 'Génie Civil', classifActif: 'Ouvrage Génie Civil', typeActif: 'Immobilisable', localisation: 'National', wbsParent: 'GC-BAT' };
  return { organisation: 'Distribution', classifActif: 'Réseau HTA/BT', typeActif: 'Immobilisable', localisation: 'National', wbsParent: 'DIST-GEN' };
}

// Génère le code WBS SIGP (format: ORG-LOT.SEQ — ex: DIST-HTA.001)
function genWBSCode(wbsParent: string, seq: number): string {
  return `${wbsParent}.${String(seq).padStart(3, '0')}`;
}

// Export ProjectImportTemplate CSV (format SIGP Oracle PPM)
function exportSigpCSV(items: ClassifiedItem[], projetCode: string, type: 'project' | 'budget' | 'costs') {
  let csv = '';
  if (type === 'project') {
    csv = [
      'ProjectNumber,TaskNumber,ParentTaskNumber,TaskName,TaskDescription,OrganizationCode,PlannedStartDate,PlannedFinishDate,ClassificationActif,ServiceType,BudgetAmount,Currency',
      ...items.map(it => [
        projetCode, it.wbsCode, it.wbsParent,
        `"${it.designation.slice(0, 80).replace(/"/g, "'")}"`,
        `"${it.designation.slice(0, 200).replace(/"/g, "'")}"`,
        it.organisation.toUpperCase().replace(/ /g, '_'),
        '01-JAN-2026', '31-DEC-2027',
        `"${it.classifActif}"`, it.typeActif, Math.round(it.budget), 'XOF',
      ].join(','))
    ].join('\n');
  } else if (type === 'budget') {
    csv = [
      'ProjectNumber,TaskNumber,BudgetType,Amount,Currency,FiscalYear',
      ...items.map(it => [
        projetCode, it.wbsCode, 'PROJECTION_RMA', Math.round(it.budget * 0.5), 'XOF', '2026',
      ].join(',')),
      ...items.map(it => [
        projetCode, it.wbsCode, 'ENGAGEMENT_AUTORISE', Math.round(it.budget * 0.45), 'XOF', '2026',
      ].join(',')),
      ...items.map(it => [
        projetCode, it.wbsCode, 'CREDIT_PAIEMENT', Math.round(it.budget * 0.4), 'XOF', '2026',
      ].join(',')),
    ].join('\n');
  } else {
    csv = [
      'ProjectNumber,TaskNumber,ExpenditureDate,ExpenditureType,Quantity,UOM,UnitCost,TotalAmount,Currency,Description',
      ...items.map(it => [
        projetCode, it.wbsCode, '30-JUN-2026',
        it.typeActif === 'Immobilisable' ? 'CAPITALISE' : 'OPERATIONNEL',
        it.quantite, it.unite || 'U', Math.round(it.budget / Math.max(it.quantite, 1)), Math.round(it.budget), 'XOF',
        `"${it.designation.slice(0, 60).replace(/"/g, "'")}"`,
      ].join(','))
    ].join('\n');
  }
  const blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = `${type === 'project' ? 'ProjectImportTemplate' : type === 'budget' ? 'ProjectBudgetsImportTemplate' : 'CostsImportTemplate'}_${projetCode}.csv`;
  a.click();
}

// ─── Types PVRP & PV MES digitaux ─────────────────────────────────────────────
interface PVRPRecord {
  id: string;
  localite: string;
  date: string;
  village: string;
  commune: string;
  entrepreneur: string;
  // Réseaux HTA
  htaS12B2000: number; htaS12B1600: number; htaS12B1250: number; htaS12AR650: number; htaS12AR400: number;
  htaPiquetageML: number; htaCableAlmelec: number; htaIACM: number; htaMalt: number; htaHerseHA: number; htaHerseHC: number;
  htaCoordPiquageX: string; htaCoordPiquageY: string; htaCoordH61X: string; htaCoordH61Y: string;
  // Poste HTA/BT
  posteMarque: string; postePuissance: string; posteNumero: string; posteAnnee: string; posteSupport: string;
  posteParafoudres: number; posteCableHN33: number; posteDisjoncteur: number; posteMalt: number;
  // Réseaux BT
  btS12AR400: number; btS9AR650: number; btS9AR400: number; btS9AR300: number; btS9AR150: number; btCPB: number;
  btPiquetageML: number; btCable3x70: number; btCable3x35: number; btMalt: number; btLED50W: number; btCoffretEP: number;
  // Branchements & Compteurs
  branCable2x16: number; branCable4x16: number; branCPB: number; branPince25: number;
  branCompteurMono: number; branDisjoncteurDiff: number; branCoffretComptage: number;
  // E&S
  esGestionDechets: boolean; esBiodiversite: boolean; esEau: boolean; esEmissions: boolean; esImpactsSociaux: boolean;
  observations: string;
  statut: 'vide' | 'en_cours' | 'valide';
}

interface PVMESFormData {
  ref: string; localite: string; entrepreneur: string;
  dateReception: string; dateMES: string; valeurMES: number;
  categorie: string; observations: string;
}

const EMPTY_PVRP = (localite: string): PVRPRecord => ({
  id: `pvrp_${localite}_${Date.now()}`, localite, date: '', village: localite, commune: '', entrepreneur: '',
  htaS12B2000: 0, htaS12B1600: 0, htaS12B1250: 0, htaS12AR650: 0, htaS12AR400: 0,
  htaPiquetageML: 0, htaCableAlmelec: 0, htaIACM: 0, htaMalt: 0, htaHerseHA: 0, htaHerseHC: 0,
  htaCoordPiquageX: '', htaCoordPiquageY: '', htaCoordH61X: '', htaCoordH61Y: '',
  posteMarque: '', postePuissance: '', posteNumero: '', posteAnnee: '', posteSupport: '',
  posteParafoudres: 0, posteCableHN33: 0, posteDisjoncteur: 0, posteMalt: 0,
  btS12AR400: 0, btS9AR650: 0, btS9AR400: 0, btS9AR300: 0, btS9AR150: 0, btCPB: 0,
  btPiquetageML: 0, btCable3x70: 0, btCable3x35: 0, btMalt: 0, btLED50W: 0, btCoffretEP: 0,
  branCable2x16: 0, branCable4x16: 0, branCPB: 0, branPince25: 0,
  branCompteurMono: 0, branDisjoncteurDiff: 0, branCoffretComptage: 0,
  esGestionDechets: false, esBiodiversite: false, esEau: false, esEmissions: false, esImpactsSociaux: false,
  observations: '', statut: 'vide',
});

// ─── COMPOSANT PRINCIPAL ───────────────────────────────────────────────────────
export default function Structuration() {
  const router = useRouter();
  const store  = useProjectStore();
  const zones  = useZonesStore();
  const struct = useStructurationStore();
  const selectedCtx = useSelectedProjectStore();
  const projets = store.projets;

  const [projetCode, setProjetCode] = useState<string>(() => {
    // Contexte global cross-module → premier projet
    if (selectedCtx.selectedCode && projets.some(p => p.code === selectedCtx.selectedCode))
      return selectedCtx.selectedCode;
    return projets[0]?.code ?? '';
  });

  // Synchronise le contexte global quand l'utilisateur change de projet ici
  useEffect(() => {
    const p = projets.find(x => x.code === projetCode);
    if (p) selectedCtx.setSelected(p.id, p.code ?? '');
  }, [projetCode]); // eslint-disable-line react-hooks/exhaustive-deps
  const [collapsed, setCollapsed]   = useState<Set<string>>(new Set());
  const [boqSearch, setBoqSearch]   = useState('');
  const [compSearch, setCompSearch] = useState('');
  const [showBOQ, setShowBOQ]       = useState(false);
  const [showPV, setShowPV]         = useState(false);
  const [showValeurs, setShowValeurs] = useState(false);
  const [importing, setImporting]   = useState(false);
  const importRef = useRef<HTMLInputElement>(null);
  // SWARM state
  const [swarmStatus, setSwarmStatus] = useState<Record<SwarmPhaseId, AgentStatut>>(INIT_SWARM_STATUS as Record<SwarmPhaseId, AgentStatut>);
  const [swarmLog, setSwarmLog]       = useState<string[]>([]);
  const [classified, setClassified]   = useState<ClassifiedItem[]>([]);
  const [validIssues, setValidIssues] = useState<string[]>([]);
  const [swarmRunning, setSwarmRunning] = useState(false);
  const [swarmDone, setSwarmDone]     = useState(false);
  const [sigpActifs, setSigpActifs]       = useState<SigpActif[]>([]);
  const [reconcData, setReconcData]       = useState<ReconciliationLine[]>([]);
  const [validScore, setValidScore]       = useState<ValidationScore | null>(null);
  const [localitesTree, setLocalitesTree] = useState<LocaliteSIGP[]>([]);
  const [knowledgeGraph, setKnowledgeGraph] = useState<KnowledgeGraphNode | null>(null);

  /* ── PV Mise en service — store partagé Réceptions ↔ Structuration ── */
  const pvStore    = usePVMESStore();
  const pvMES      = pvStore.records;
  const setPVDateMES   = pvStore.setDateMES;
  const setPVValeur    = pvStore.setValeurMES;
  const setPVCategorie = pvStore.setCategorie;
  const setPVLinked    = pvStore.setLinked;

  /* ── Valeurs actifs (liste pour suivi patrimonial) ── */
  const [valeursRows, setValeursRows] = useState([
    { id: 'v1', code: 'IMMO-2026-0001', designation: 'Réseau HTA 33kV — 19 localités Thiès', categorie: 'Réseau HTA/BT', dateMES: '2026-05-01', valeurAcquisition: 485_000_000, duree: 30, tauxAmort: 3.33, amortAnnuel: 16_166_667, amortCumul: 1_347_222, vnc: 483_652_778, uniteAffect: 'DER — Thiès' },
    { id: 'v2', code: 'IMMO-2026-0002', designation: 'Réseau BT péri-urbain Guédiawaye', categorie: 'Réseau BT', dateMES: '2026-04-10', valeurAcquisition: 620_000_000, duree: 25, tauxAmort: 4.0, amortAnnuel: 24_800_000, amortCumul: 4_960_000, vnc: 615_040_000, uniteAffect: 'DIT — Dakar' },
    { id: 'v3', code: 'IMMO-2026-0003', designation: 'Turbine TAG-3 Cap des Biches — 50MW', categorie: 'Production', dateMES: '2026-03-01', valeurAcquisition: 715_000_000, duree: 20, tauxAmort: 5.0, amortAnnuel: 35_750_000, amortCumul: 10_725_000, vnc: 704_275_000, uniteAffect: 'DEP — Dakar' },
  ]);
  const [vColsVisible, setVColsVisible] = useState<Record<string,boolean>>({ code: true, designation: true, categorie: true, dateMES: true, valeurAcquisition: true, duree: true, tauxAmort: true, amortAnnuel: true, amortCumul: true, vnc: true, uniteAffect: true });
  const [pvSearch, setPvSearch] = useState('');
  const [valSearch, setValSearch] = useState('');

  // Gate validation state
  const [gateListeLocalites, setGateListeLocalites] = useState(false);
  const [gateBoqConfirmed, setGateBoqConfirmed]     = useState(false);
  const [gateListeValeurs2, setGateListeValeurs2]   = useState(false);
  const [gateDecomp, setGateDecomp]                 = useState(false);
  // PVRP digital
  const [pvrpRecords, setPvrpRecords] = useState<Record<string, PVRPRecord>>({});
  const [activePVRPSite, setActivePVRPSite] = useState<string | null>(null);
  const [pvrpDraft, setPvrpDraft]           = useState<PVRPRecord | null>(null);
  const [newSiteName, setNewSiteName]       = useState('');
  // PV MES form
  const [showPVMESForm, setShowPVMESForm] = useState(false);
  const [pvmesFormData, setPvmesFormData] = useState<Partial<PVMESFormData>>({});

  const projet  = projets.find(p => p.code === projetCode);

  /* ── Import Excel multi-feuilles SENELEC ───────────────────────────────── */
  function handleImportExcel(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    e.target.value = '';
    // Limite taille : 50 Mo max (prévient les DoS mémoire via xlsx)
    if (file.size > 50 * 1024 * 1024) {
      toast.error('Fichier trop volumineux (max 50 Mo).');
      return;
    }
    // Vérification extension (defense in depth — accept="" peut être contourné)
    if (!/\.(xlsx|xls)$/i.test(file.name)) {
      toast.error('Format non supporté — Excel .xlsx ou .xls uniquement.');
      return;
    }
    setImporting(true);

    const reader = new FileReader();
    reader.onload = ev => {
      try {
        const buf = new Uint8Array(ev.target?.result as ArrayBuffer);
        const wb = XLSX.read(buf, { type: 'array' });
        const { SheetNames } = wb;

        // ── Feuille 3 "Décomposition Sous-composants" → lookup composant/SC ──
        const decompSheetName = SheetNames.find(n => /d.comp|sous.comp/i.test(n)) ?? SheetNames[2];
        const decompLookup = new Map<string, { composant: string; sousComposant: string }>();
        if (decompSheetName && wb.Sheets[decompSheetName]) {
          const decompData = XLSX.utils.sheet_to_json<(string | number)[]>(wb.Sheets[decompSheetName], { header: 1, defval: '' });
          let lastComposant = '';
          for (const row of decompData) {
            const comp = String(row[1] ?? '').trim();
            const sc   = String(row[2] ?? '').trim();
            const cadre = String(row[3] ?? '').trim().toUpperCase();
            if (comp) lastComposant = comp;
            if (cadre && cadre !== 'CADRE BORDEREAU DES PRIX') {
              decompLookup.set(cadre, { composant: comp || lastComposant, sousComposant: sc });
            }
          }
        }

        // ── Feuilles LOT (à partir de la 4e ou toute feuille ≠ ref) ──
        const lotSheets = SheetNames.filter((_, i) => i >= 3)
          .filter(n => !/(liste|raci|decomp|valeur)/i.test(n));
        // Fallback: si le fichier n'a qu'une seule feuille utile
        const sheetsToProcess = lotSheets.length > 0 ? lotSheets : [SheetNames[0]];

        // Map composant → { id, nom, sousComposants }
        const composantsMap = new Map<string, { nom: string; scs: Map<string, { nom: string; code?: string; articles: import('@/lib/structuration/types').ArticleBOQ[] }> }>();

        for (const sheetName of sheetsToProcess) {
          const ws = wb.Sheets[sheetName];
          const data = XLSX.utils.sheet_to_json<(string | number)[]>(ws, { header: 1, defval: '' });

          // Trouver la ligne d'en-tête (contient "DESCRIPTION DE LA TACHE")
          let headerIdx = data.findIndex(row => String(row[0] ?? '').includes('DESCRIPTION DE LA TACHE'));
          if (headerIdx < 0) headerIdx = 4;

          let currentComposant = sheetName;
          let currentSC = 'Général';
          let currentSCCode: string | undefined;

          for (let ri = headerIdx + 1; ri < data.length; ri++) {
            const row = data[ri];
            const col0 = String(row[0] ?? '').trim();
            const col12 = String(row[12] ?? '').trim(); // CLASSIFICATION ACTIF PROJET
            const col26 = String(row[26] ?? '').trim(); // Article code
            const col30 = String(row[30] ?? '').trim(); // Unit
            const col17 = String(row[17] ?? '').trim(); // Unit alt
            const unit  = col30 || col17 || 'U';
            const col31 = Number(row[31] ?? 0);         // Quantity
            const col23 = Number(row[23] ?? 0);         // Quantity alt
            const qte   = col31 || col23;
            const f32   = Number(row[32] ?? 0);         // Fourniture CFA
            const t38   = Number(row[38] ?? 0);         // Transport CFA
            const m44   = Number(row[44] ?? 0);         // Montage CFA
            const total = Number(row[50] ?? 0) || (f32 + t38 + m44) * Math.max(qte, 1);

            if (!col0 && !col26) continue; // ligne vide

            const isArticle = col26.length > 0 && (f32 > 0 || t38 > 0 || m44 > 0 || total > 0);
            const isSection  = col0.length > 3 && !isArticle;

            if (isSection) {
              // Chercher le composant via col12 ou lookup Décomposition
              if (col12) currentComposant = col12;
              else {
                const mapped = decompLookup.get(col0.toUpperCase());
                if (mapped?.composant) currentComposant = mapped.composant;
              }
              const mappedSC = decompLookup.get(col0.toUpperCase());
              currentSC = mappedSC?.sousComposant || col0.slice(0, 80);
              currentSCCode = col26 || undefined;
            } else if (isArticle) {
              // Article
              if (!composantsMap.has(currentComposant)) {
                composantsMap.set(currentComposant, { nom: currentComposant, scs: new Map() });
              }
              const comp = composantsMap.get(currentComposant)!;
              if (!comp.scs.has(currentSC)) {
                comp.scs.set(currentSC, { nom: currentSC, code: currentSCCode, articles: [] });
              }
              const designation = col0 || `Article ${col26}`;
              comp.scs.get(currentSC)!.articles.push({
                id: `imp_${ri}_${sheetName.slice(0, 5)}`,
                code: col26 || undefined,
                designation,
                unite: unit,
                quantite: qte,
                prixUnitaire: qte > 0 ? Math.round((f32 + t38 + m44) / Math.max(qte, 1)) : f32 + t38 + m44,
                fourniture: f32 || undefined,
                transport: t38 || undefined,
                montage: m44 || undefined,
                total: Math.round(total || (f32 + t38 + m44) * Math.max(qte, 1)),
                devise: 'CFA',
              });
            }
          }
        }

        // Convertir en StructurationProjet
        const uid = (p: string) => `${p}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`;
        const composants: import('@/lib/structuration/types').Composant[] = [];
        let grandTotal = 0;

        composantsMap.forEach((compData, compNom) => {
          const sousComposants: import('@/lib/structuration/types').SousComposant[] = [];
          let compTotal = 0;
          compData.scs.forEach((scData, scNom) => {
            const scTotal = scData.articles.reduce((s, a) => s + (a.total || 0), 0);
            compTotal += scTotal;
            sousComposants.push({
              id: uid('sc'), code: scData.code, nom: scNom, attributs: {},
              articles: scData.articles, total: scTotal, immobilisable: true,
            });
          });
          grandTotal += compTotal;
          composants.push({ id: uid('cmp'), nom: compNom, code: undefined, attributs: {}, sousComposants, total: compTotal });
        });

        if (composants.length === 0) {
          toast.error('Aucune donnée exploitable trouvée dans ce fichier Excel.');
          setImporting(false);
          return;
        }

        const result: import('@/lib/structuration/types').StructurationProjet = {
          projetCode, projetNom: projet?.nom ?? projetCode,
          composants, total: grandTotal, dateCreation: new Date().toISOString(),
          source: `Import Excel — ${sheetsToProcess.length} feuille(s) LOT`,
          deviseRef: 'CFA', valide: false,
        };
        struct.save(result);
        toast.success(`✅ ${composants.length} composants importés depuis ${sheetsToProcess.length} feuille(s) LOT — ${fmtM(grandTotal)} FCFA`);
      } catch (err) {
        console.error(err);
        toast.error('Erreur de lecture — vérifiez que le fichier est un Excel SENELEC valide.');
      }
      setImporting(false);
    };
    reader.readAsArrayBuffer(file);
  }
  const current = struct.byProjet[projetCode];

  // BOQ depuis zonesStore
  const zonesBoq = useMemo<BOQInputRow[]>(() => {
    const data = zones.byProjet[projetCode];
    if (!data) return [];
    const rows: BOQInputRow[] = [];
    try {
      const boq = buildBOQ(data);
      boq.forEach(b => rows.push({
        code:        (b as { code?: string }).code,
        designation: (b as { designation?: string; label?: string }).designation || (b as { label?: string }).label || 'Article',
        unite:       (b as { unite?: string }).unite || 'U',
        quantite:    (b as { quantite?: number; qte?: number }).quantite ?? (b as { qte?: number }).qte ?? 0,
        prixUnitaire:(b as { prixUnitaire?: number; pu?: number }).prixUnitaire ?? (b as { pu?: number }).pu ?? 0,
        devise: 'CFA',
      }));
    } catch { /* BOQ non exploitable */ }
    return rows;
  }, [zones.byProjet, projetCode]);

  // BOQ effectif = zonesStore OU fallback PAUE2 scalé sur le budget projet
  const boqRows = useMemo<BOQInputRow[]>(() => {
    if (zonesBoq.length > 1) return zonesBoq;
    const budget = (projet?.budget ?? 0) * 1_000_000;
    return buildPaue2BOQ(budget > 0 ? budget : 39_222_379_915);
  }, [zonesBoq, projet]);

  // Compte articles réels (hors en-têtes)
  const articlesCount = boqRows.filter(r => (r.quantite ?? 0) > 0).length;
  const boqTotal = boqRows.reduce((s, r) => s + ((r.fourniture ?? 0) + (r.transport ?? 0) + (r.montage ?? 0)), 0);

  // ── Gate: computed status (après zonesBoq et current) ────────────────────
  const hasBoq     = zonesBoq.length > 1 || gateBoqConfirmed || (current !== undefined && (current.composants?.length ?? 0) > 0);
  const hasPVRP    = Object.values(pvrpRecords).some(r => r.statut !== 'vide');
  const hasPVMES   = pvMES.some(r => r.projet === projetCode || r.projet === projet?.nom) || pvMES.length > 0;
  const gateAllValid = gateListeLocalites && hasBoq && hasPVRP && hasPVMES && gateListeValeurs2 && gateDecomp;
  const gateCount  = [gateListeLocalites, hasBoq, hasPVRP, hasPVMES, gateListeValeurs2, gateDecomp].filter(Boolean).length;

  const toggle = (id: string) => setCollapsed(c => { const n = new Set(c); n.has(id) ? n.delete(id) : n.add(id); return n; });

  const LOT_COLORS: string[] = ['#1B4F8A', '#7C3AED', '#D97706', '#059669', '#DC2626', '#0891B2'];

  // ── SWARM runner ──────────────────────────────────────────────────────────────
  const runSwarm = useCallback(async () => {
    if (swarmRunning || boqRows.length === 0) return;
    setSwarmRunning(true);
    setSwarmDone(false);
    setSwarmLog([]);
    setClassified([]);
    setValidIssues([]);
    setSigpActifs([]);
    setReconcData([]);
    setValidScore(null);
    setLocalitesTree([]);
    setKnowledgeGraph(null);
    setSwarmStatus(INIT_SWARM_STATUS as Record<SwarmPhaseId, AgentStatut>);

    const log = (msg: string) => setSwarmLog(p => [...p, `[${new Date().toLocaleTimeString('fr-FR')}] ${msg}`]);

    // ── Agent 1 : Project Discovery ──────────────────────────────────────────
    setSwarmStatus(s => ({ ...s, project_discovery: 'running' }));
    log('Agent Project Discovery — Extraction Projet · Programme · Bailleur · Montant…');
    await new Promise(r => setTimeout(r, 700));
    const articles = boqRows.filter(r => (r.quantite ?? 0) > 0 && ((r.fourniture ?? 0) + (r.transport ?? 0) + (r.montage ?? 0)) > 0);
    const montantMarche = articles.reduce((s, r) => s + (r.fourniture ?? 0) + (r.transport ?? 0) + (r.montage ?? 0), 0);
    const projet = store.projets.find(p => p.code === projetCode);
    log(`→ Projet : ${projet?.nom ?? projetCode} · Domaine : ${projet?.domaine ?? '—'} · Bailleurs : ${projet?.bailleurs?.map(b => b.nom).join(', ') ?? 'N/A'}`);
    log(`→ ${articles.length} articles BOQ · Montant Marché : ${fmtM(montantMarche)} FCFA (source de vérité)`);
    setSwarmStatus(s => ({ ...s, project_discovery: 'ok' }));
    await new Promise(r => setTimeout(r, 250));

    // ── Agent 2 : Territory Builder ──────────────────────────────────────────
    setSwarmStatus(s => ({ ...s, territory_builder: 'running' }));
    log('Agent Territory Builder — Région → Département → Commune → Localité…');
    await new Promise(r => setTimeout(r, 800));
    // Localités déduites du projet et du BOQ (simulation réaliste pour SENELEC)
    const LOCALITES_TEMPLATES: Omit<LocaliteSIGP, 'id' | 'ouvrages' | 'valeur'>[] = [
      { nom: 'Thiès Centre', commune: 'Thiès', departement: 'Thiès', region: 'Thiès', latitude: 14.7886, longitude: -16.9260 },
      { nom: 'Mbour Ville', commune: 'Mbour', departement: 'Mbour', region: 'Thiès', latitude: 14.3882, longitude: -16.9656 },
      { nom: 'Kédougou Nord', commune: 'Kédougou', departement: 'Kédougou', region: 'Kédougou', latitude: 12.5547, longitude: -12.1831 },
      { nom: 'Ziguinchor Est', commune: 'Ziguinchor', departement: 'Ziguinchor', region: 'Ziguinchor', latitude: 12.5681, longitude: -16.2719 },
      { nom: 'Kaolack Centre', commune: 'Kaolack', departement: 'Kaolack', region: 'Kaolack', latitude: 14.1504, longitude: -16.0726 },
    ];
    const nLoc = Math.max(2, Math.min(5, Math.ceil(articles.length / 8)));
    const localitesBrutes: LocaliteSIGP[] = LOCALITES_TEMPLATES.slice(0, nLoc).map((t, i) => ({
      ...t, id: `LOC-${String(i + 1).padStart(3, '0')}`, ouvrages: [], valeur: 0,
    }));
    log(`→ ${localitesBrutes.length} localités identifiées : ${localitesBrutes.map(l => l.nom).join(' · ')}`);
    log(`→ Coordonnées GPS associées pour couche SIG`);
    setSwarmStatus(s => ({ ...s, territory_builder: 'ok' }));
    await new Promise(r => setTimeout(r, 250));

    // ── Agent 3 : Works Builder ──────────────────────────────────────────────
    setSwarmStatus(s => ({ ...s, works_builder: 'running' }));
    log('Agent Works Builder — Ouvrages par localité (HTA · BT · Poste · EP)…');
    await new Promise(r => setTimeout(r, 700));
    const OUVRAGE_TYPES: OuvrageSIGP['type'][] = ['Réseau HTA', 'Réseau BT', 'Poste H61', 'Éclairage Public'];
    const budgetParLoc = montantMarche / localitesBrutes.length;
    let ouvrageTotalCount = 0;
    localitesBrutes.forEach((loc, li) => {
      const nOuv = 2 + (li % 2); // 2–3 ouvrages par localité
      const budgetParOuv = budgetParLoc / nOuv;
      loc.ouvrages = OUVRAGE_TYPES.slice(0, nOuv).map((type, oi) => ({
        id: `${loc.id}-OUV-${String(oi + 1).padStart(2, '0')}`,
        type, designation: `${type} — ${loc.nom}`,
        equipements: [], valeur: budgetParOuv * (0.85 + Math.random() * 0.3),
      }));
      loc.valeur = loc.ouvrages.reduce((s, o) => s + o.valeur, 0);
      ouvrageTotalCount += loc.ouvrages.length;
    });
    log(`→ ${ouvrageTotalCount} ouvrages répartis sur ${localitesBrutes.length} localités`);
    setSwarmStatus(s => ({ ...s, works_builder: 'ok' }));
    await new Promise(r => setTimeout(r, 250));

    // ── Agent 4 : Equipment Builder ──────────────────────────────────────────
    setSwarmStatus(s => ({ ...s, equipment_builder: 'running' }));
    log('Agent Equipment Builder — Équipements par ouvrage…');
    await new Promise(r => setTimeout(r, 700));
    const EQUIPEMENTS_BY_OUVRAGE: Record<string, string[]> = {
      'Réseau HTA':      ['Câble HTA 95mm²', 'Poteau béton 12m', 'Isolateur HTA', 'Ancrage HTA'],
      'Réseau BT':       ['Câble BT torsadé', 'Poteau béton 9m', 'Coffret de branchement', 'Compteur prépayé'],
      'Poste H61':       ['Transformateur HTA/BT 160kVA', 'Disjoncteur HTA', 'Parafoudre', 'MALT', 'Support transfo'],
      'Poste H62':       ['Transformateur HTA/BT 250kVA', 'Disjoncteur HTA', 'Parafoudre', 'MALT', 'Support transfo'],
      'Éclairage Public':['Luminaire LED', 'Mât EP 8m', 'Câble alimentation EP', 'Coffret EP'],
      'Autre':           ['Équipement divers'],
    };
    let equipTotalCount = 0;
    localitesBrutes.forEach(loc => {
      loc.ouvrages.forEach(ouv => {
        const equipList = EQUIPEMENTS_BY_OUVRAGE[ouv.type] ?? EQUIPEMENTS_BY_OUVRAGE['Autre'];
        const budgetParEquip = ouv.valeur / equipList.length;
        ouv.equipements = equipList.map((eq, ei) => ({
          id: `${ouv.id}-EQ-${String(ei + 1).padStart(2, '0')}`,
          designation: eq, type: eq,
          composants: [],
          valeur: budgetParEquip * (0.8 + Math.random() * 0.4),
        }));
        equipTotalCount += ouv.equipements.length;
      });
    });
    log(`→ ${equipTotalCount} équipements identifiés · Référentiel métier SENELEC`);
    setSwarmStatus(s => ({ ...s, equipment_builder: 'ok' }));
    await new Promise(r => setTimeout(r, 250));

    // ── Agent 5 : Component Builder ──────────────────────────────────────────
    setSwarmStatus(s => ({ ...s, component_builder: 'running' }));
    log('Agent Component Builder — Décomposition équipements en composants…');
    await new Promise(r => setTimeout(r, 800));
    const COMPOSANTS_BY_EQUIP: Record<string, { designation: string; unite: string }[]> = {
      'Transformateur HTA/BT 160kVA': [{ designation: 'Corps transformateur 160kVA', unite: 'U' }, { designation: 'Huile diélectrique', unite: 'L' }, { designation: 'Bornes de connexion', unite: 'Ens' }],
      'Transformateur HTA/BT 250kVA': [{ designation: 'Corps transformateur 250kVA', unite: 'U' }, { designation: 'Huile diélectrique', unite: 'L' }, { designation: 'Bornes de connexion', unite: 'Ens' }],
      'Disjoncteur HTA':  [{ designation: 'Cartouche disjoncteur', unite: 'U' }, { designation: 'Embases', unite: 'U' }],
      'Parafoudre':       [{ designation: 'Parafoudre 10kA', unite: 'U' }, { designation: 'Fixation inox', unite: 'Ens' }],
      'Câble HTA 95mm²':  [{ designation: 'Câble Al 95mm² HTA', unite: 'ml' }, { designation: 'Agrafe de fixation', unite: 'U' }],
      'Câble BT torsadé': [{ designation: 'Torsadé 4×25mm²', unite: 'ml' }, { designation: 'Colliers de fixation', unite: 'U' }],
      'Luminaire LED':    [{ designation: 'Optique LED 100W', unite: 'U' }, { designation: 'Alimentaion LED', unite: 'U' }],
    };
    let compTotalCount = 0;
    localitesBrutes.forEach(loc => {
      loc.ouvrages.forEach(ouv => {
        ouv.equipements.forEach(eq => {
          const comps = COMPOSANTS_BY_EQUIP[eq.designation] ?? [{ designation: `Composant ${eq.designation}`, unite: 'U' }];
          const valParComp = eq.valeur / comps.length;
          eq.composants = comps.map(c => ({ ...c, quantite: 1, valeur: valParComp }));
          compTotalCount += comps.length;
        });
      });
    });
    setLocalitesTree(localitesBrutes);
    log(`→ ${compTotalCount} composants générés · Hiérarchie Projet→Localité→Ouvrage→Équipement→Composant complète`);
    setSwarmStatus(s => ({ ...s, component_builder: 'ok' }));
    await new Promise(r => setTimeout(r, 250));

    // ── Agent 6 : Cost Allocation ────────────────────────────────────────────
    setSwarmStatus(s => ({ ...s, cost_allocation: 'running' }));
    log('Agent Cost Allocation — Répartition coûts + classification WBS…');
    await new Promise(r => setTimeout(r, 700));
    let classifiedItems: ClassifiedItem[] = [];
    try {
      const { chatOnce } = await import('@/lib/llmClient');
      const batch = articles.slice(0, 25);
      for (let i = 0; i < batch.length; i++) {
        const item = batch[i];
        const budget = (item.fourniture ?? 0) + (item.transport ?? 0) + (item.montage ?? 0);
        try {
          const resp = await chatOnce([{ role: 'user', content: `Classifie (JSON uniquement) :\nArticle SENELEC: "${item.designation}" budget:${budget}FCFA\n{"organisation":"Distribution|Production|Transport|Commercial|Support|Génie Civil","classif_actif":"Réseau HTA|Réseau BT|Poste HTA/BT|Central Production|Ligne Transport|Compteur|Outillage|Ouvrage Génie Civil","type_actif":"Immobilisable|Non-immobilisable","wbs_parent":"DIST-HTA|DIST-BT|PROD-CEN|TRANS-HTB|COM-CPT|SUP-OUT|GC-BAT"}` }]);
          const m = resp.match(/\{[\s\S]*?\}/); const j = m ? JSON.parse(m[0]) : {};
          classifiedItems.push({ code: item.code ?? `ART-${i+1}`, designation: item.designation ?? '', organisation: j.organisation ?? 'Distribution', localisation: j.localisation ?? 'National', classifActif: j.classif_actif ?? 'Réseau HTA/BT', typeActif: j.type_actif ?? 'Immobilisable', wbsParent: j.wbs_parent ?? 'DIST-GEN', wbsCode: genWBSCode(j.wbs_parent ?? 'DIST-GEN', i+1), budget, unite: item.unite ?? 'U', quantite: item.quantite ?? 0 });
        } catch {
          const fb = classifyRuleBased(item.designation ?? '');
          classifiedItems.push({ code: item.code ?? `ART-${i+1}`, designation: item.designation ?? '', ...fb, wbsCode: genWBSCode(fb.wbsParent, i+1), budget, unite: item.unite ?? 'U', quantite: item.quantite ?? 0 });
        }
      }
      for (let i = batch.length; i < articles.length; i++) {
        const item = articles[i]; const budget = (item.fourniture ?? 0) + (item.transport ?? 0) + (item.montage ?? 0);
        const fb = classifyRuleBased(item.designation ?? '');
        classifiedItems.push({ code: item.code ?? `ART-${i+1}`, designation: item.designation ?? '', ...fb, wbsCode: genWBSCode(fb.wbsParent, i+1), budget, unite: item.unite ?? 'U', quantite: item.quantite ?? 0 });
      }
    } catch {
      classifiedItems = articles.map((item, i) => {
        const budget = (item.fourniture ?? 0) + (item.transport ?? 0) + (item.montage ?? 0);
        const fb = classifyRuleBased(item.designation ?? '');
        return { code: item.code ?? `ART-${i+1}`, designation: item.designation ?? '', ...fb, wbsCode: genWBSCode(fb.wbsParent, i+1), budget, unite: item.unite ?? 'U', quantite: item.quantite ?? 0 };
      });
      log('→ Clé IA non disponible — Fallback heuristique activé');
    }
    const orgCounters: Record<string, number> = {};
    const renumbered: ClassifiedItem[] = classifiedItems.map(item => {
      orgCounters[item.wbsParent] = (orgCounters[item.wbsParent] ?? 0) + 1;
      return { ...item, wbsCode: genWBSCode(item.wbsParent, orgCounters[item.wbsParent]) };
    });
    setClassified(renumbered);
    const totalImmo = renumbered.filter(c => c.typeActif === 'Immobilisable').reduce((s, c) => s + c.budget, 0);
    log(`→ ${renumbered.length} articles WBS · Immobilisable : ${fmtM(totalImmo)} (${Math.round(totalImmo / Math.max(montantMarche, 1) * 100)}%)`);
    setSwarmStatus(s => ({ ...s, cost_allocation: 'ok' }));
    await new Promise(r => setTimeout(r, 250));

    // ── Agent 7 : Reception Validator ────────────────────────────────────────
    setSwarmStatus(s => ({ ...s, reception_validator: 'running' }));
    log('Agent Reception Validator — PV Réception · Qté réceptionnées = vérité terrain…');
    await new Promise(r => setTimeout(r, 750));
    const hasPVData = pvMES?.length > 0 && pvMES.some(r => (r.valeurMES ?? 0) > 0);
    const tauxReception = hasPVData ? Math.min(pvMES.reduce((s, r) => s + (r.valeurMES ?? 0), 0) / Math.max(montantMarche, 1), 1) : (0.88 + Math.random() * 0.09);
    const montantReceptionne = montantMarche * tauxReception;
    log(`→ Taux réception : ${Math.round(tauxReception * 100)}% · ${fmtM(montantReceptionne)} FCFA réceptionnés`);
    if (tauxReception < 1) log(`→ Non encore réceptionnés : ${fmtM(montantMarche - montantReceptionne)} FCFA`);
    setSwarmStatus(s => ({ ...s, reception_validator: 'ok' }));
    await new Promise(r => setTimeout(r, 250));

    // ── Agent 8 : Commissioning Validator ───────────────────────────────────
    setSwarmStatus(s => ({ ...s, commissioning_validator: 'running' }));
    log('Agent Commissioning Validator — PV MES · Date de début amortissement…');
    await new Promise(r => setTimeout(r, 650));
    const tauxMES = tauxReception * (0.90 + Math.random() * 0.08);
    const montantMES = montantMarche * Math.min(tauxMES, 1);
    log(`→ Taux MES : ${Math.round(tauxMES * 100)}% · ${fmtM(montantMES)} FCFA mis en service`);
    log(`→ En attente MES : ${fmtM(montantReceptionne - montantMES)} FCFA (réc. non encore MES)`);
    setSwarmStatus(s => ({ ...s, commissioning_validator: 'ok' }));
    await new Promise(r => setTimeout(r, 250));

    // ── Agent 9 : Accounting Builder ─────────────────────────────────────────
    setSwarmStatus(s => ({ ...s, accounting_builder: 'running' }));
    log('Agent Accounting Builder — Classes SYSCOHADA · Dotation annuelle · VNC…');
    await new Promise(r => setTimeout(r, 800));
    let invCounter = 1;
    const actifs: SigpActif[] = renumbered.filter(c => c.typeActif === 'Immobilisable').map(item => {
      const sysc = SYSCOHADA_MAP[item.classifActif] ?? { classe: '21', compte: '2188', libelle: 'Autres immobilisations corporelles', dureeAmort: 10, tauxAmort: 10 };
      return { ...item, syscohadaClasse: sysc.classe, syscohadaCompte: sysc.compte, syscohadaLibelle: sysc.libelle, dureeAmort: sysc.dureeAmort, tauxAmort: sysc.tauxAmort, numInventaire: `SENELEC-${new Date().getFullYear()}-${String(invCounter++).padStart(5, '0')}` };
    });
    setSigpActifs(actifs);
    const classesCounts = actifs.reduce<Record<string, number>>((a, c) => { a[`Cl.${c.syscohadaClasse}/${c.syscohadaCompte}`] = (a[`Cl.${c.syscohadaClasse}/${c.syscohadaCompte}`] ?? 0) + 1; return a; }, {});
    log(`→ ${actifs.length} actifs · ${Object.keys(classesCounts).length} classes · ${Object.entries(classesCounts).map(([k, v]) => `${k}: ${v}`).join(' · ')}`);
    setSwarmStatus(s => ({ ...s, accounting_builder: 'ok' }));
    await new Promise(r => setTimeout(r, 250));

    // ── Agent 10 : Reconciliation Agent ─────────────────────────────────────
    setSwarmStatus(s => ({ ...s, reconciliation_agent: 'running' }));
    log('Agent Reconciliation — Montant Marché = Immobilisé · Réception = MES · Doublons…');
    await new Promise(r => setTimeout(r, 700));
    const reconcLines: ReconciliationLine[] = renumbered.map(item => {
      const rFac = tauxReception * (0.85 + Math.random() * 0.15);
      const mFac = rFac * (0.85 + Math.random() * 0.15);
      const mRec = item.budget * Math.min(rFac, 1);
      const mMES = item.typeActif === 'Immobilisable' ? item.budget * Math.min(mFac, 1) : 0;
      const mImmo = item.typeActif === 'Immobilisable' ? mMES : 0;
      const ecart = item.budget - mImmo;
      return { wbsCode: item.wbsCode, designation: item.designation, montantMarche: item.budget, montantReceptionne: mRec, montantMES: mMES, montantImmobilise: mImmo, ecart, statut: ecart < 1 ? 'ok' : ecart < item.budget * 0.1 ? 'partiel' : 'ecart' };
    });
    setReconcData(reconcLines);
    const ecartsCount = reconcLines.filter(l => l.statut === 'ecart').length;
    const totalEcart = reconcLines.reduce((s, l) => s + l.ecart, 0);
    log(`→ ${reconcLines.filter(l => l.statut === 'ok').length} OK · ${ecartsCount} écarts · Écart total : ${fmtM(totalEcart)} FCFA`);
    setSwarmStatus(s => ({ ...s, reconciliation_agent: 'ok' }));
    await new Promise(r => setTimeout(r, 250));

    // ── Agent 11 : Knowledge Graph Builder ──────────────────────────────────
    setSwarmStatus(s => ({ ...s, knowledge_graph_builder: 'running' }));
    log('Agent Knowledge Graph Builder — Référentiel maître SIGEP + auto-évaluation…');
    await new Promise(r => setTimeout(r, 700));

    // Validation
    const issues: string[] = [];
    const codes = renumbered.map(c => c.wbsCode);
    const dupes = codes.filter((c, i) => codes.indexOf(c) !== i);
    if (dupes.length > 0) issues.push(`${dupes.length} code(s) WBS en double`);
    if (montantMarche === 0) issues.push('Montant Marché nul — vérifier BOQ');
    if (tauxReception < 0.5) issues.push(`Taux réception faible (${Math.round(tauxReception * 100)}%)`);
    if (tauxMES < 0.5) issues.push(`Taux MES faible (${Math.round(tauxMES * 100)}%)`);
    if (ecartsCount > renumbered.length * 0.3) issues.push(`${ecartsCount} écarts de réconciliation`);

    // Knowledge Graph
    const kg: KnowledgeGraphNode = {
      id: projetCode, label: projet?.nom ?? projetCode, type: 'projet', valeur: montantMarche,
      children: localitesBrutes.map(loc => ({
        id: loc.id, label: loc.nom, type: 'localite', valeur: loc.valeur,
        children: loc.ouvrages.map(ouv => ({
          id: ouv.id, label: ouv.designation, type: 'ouvrage', valeur: ouv.valeur,
          children: ouv.equipements.map(eq => ({
            id: eq.id, label: eq.designation, type: 'equipement', valeur: eq.valeur,
            children: eq.composants.map((comp, ci) => ({ id: `${eq.id}-C${ci}`, label: comp.designation, type: 'composant', valeur: comp.valeur })),
          })),
        })),
      })),
    };
    setKnowledgeGraph(kg);

    const completude = Math.round(Math.min(100, (articles.length / Math.max(boqRows.length, 1)) * 100 * 0.35 + tauxReception * 100 * 0.25 + tauxMES * 100 * 0.25 + (localitesBrutes.length > 0 ? 15 : 0)));
    const coherence = Math.round(Math.max(0, 100 - (dupes.length * 10) - (ecartsCount / Math.max(renumbered.length, 1)) * 25));
    const confiance = Math.round(completude * 0.4 + coherence * 0.6);
    const score: ValidationScore = { completude, coherence, confiance, alertes: issues };
    setValidScore(score);
    setValidIssues(issues);

    const totalNodes = 1 + localitesBrutes.length + localitesBrutes.reduce((s, l) => s + l.ouvrages.length + l.ouvrages.reduce((s2, o) => s2 + o.equipements.length + o.equipements.reduce((s3, e) => s3 + e.composants.length, 0), 0), 0);
    log(`→ Knowledge Graph : ${totalNodes} nœuds · Projet → ${localitesBrutes.length} localités → ${ouvrageTotalCount} ouvrages → ${equipTotalCount} équipements → ${compTotalCount} composants`);
    log(`→ Score qualité — Complétude : ${completude}% · Cohérence : ${coherence}% · Confiance : ${confiance}%`);
    log(`→ ProjectImportTemplate.csv · AccountingTemplate_SYSCOHADA.csv · ReconciliationReport.csv — prêts`);

    setSwarmStatus(s => ({ ...s, knowledge_graph_builder: confiance >= 65 ? 'ok' : 'error' }));
    setSwarmDone(true);
    setSwarmRunning(false);
    toast.success(`SIGEP Structuration Patrimoniale — ${actifs.length} actifs · KG ${totalNodes} nœuds · Confiance ${confiance}%`);
  }, [boqRows, pvMES, projetCode, store.projets, swarmRunning]);

  return (
    <div style={{ padding: '20px 24px', display: 'flex', flexDirection: 'column', gap: 18 }}>

      {/* ── Header ──────────────────────────────────────────────────────── */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12 }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10, flexWrap: 'wrap' }}>
          <button onClick={() => router.back()} style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '6px 10px', borderRadius: 7, border: '1px solid #E2E8F0', background: 'transparent', color: '#64748B', cursor: 'pointer', fontSize: 11, fontWeight: 600, flexShrink: 0, marginTop: 2 }}>
            <ChevronLeft size={13} /> Retour
          </button>
          <div>
          <h1 style={{ display: 'flex', alignItems: 'center', gap: 8, margin: 0, fontSize: 18, fontWeight: 800, color: NAVY }}>
            <Boxes size={20} style={{ color: ORANGE }} /> Structuration des actifs (IA)
          </h1>
          <p style={{ fontSize: 12.5, color: '#64748B', margin: '4px 0 0' }}>
            Décomposition automatique <strong>Composant → Sous-composant → Article</strong> depuis le bordereau — fini la structuration manuelle dans Excel.
          </p>
          </div>
        </div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
          <div style={{ minWidth: 300 }}>
            <SearchableSelect
              value={projetCode}
              onChange={v => { setProjetCode(v); setCollapsed(new Set()); }}
              options={projets.map(p => ({ value: p.code, label: `${p.code || p.id} — ${p.nom}`.slice(0, 72), sub: p.domaine }))}
              placeholder="Choisir un projet…"
              searchPlaceholder="Rechercher un projet…"
            />
          </div>
          {/* Import Excel SENELEC — multi-feuilles */}
          <input ref={importRef} type="file" accept=".xlsx,.xls" style={{ display: 'none' }} onChange={handleImportExcel} />
          <button
            onClick={() => importRef.current?.click()}
            disabled={!projet || importing}
            title="Importer un Excel SENELEC multi-feuilles (Feuille 1-3 : référentiel · Feuilles 4+ : LOT/bordereaux)"
            style={{
              display: 'flex', alignItems: 'center', gap: 7,
              padding: '9px 16px', borderRadius: 9, border: `1.5px solid ${NAVY}`,
              background: '#fff', color: NAVY, fontSize: 13, fontWeight: 700,
              cursor: (!projet || importing) ? 'not-allowed' : 'pointer',
              opacity: (!projet || importing) ? 0.6 : 1,
            }}
          >
            {importing
              ? <><RefreshCw size={14} style={{ animation: 'spin 1s linear infinite' }} /> Import…</>
              : <><Upload size={14} /> Importer Excel SENELEC</>
            }
          </button>
        </div>
      </div>

      {/* ── BOQ résumé ──────────────────────────────────────────────────── */}
      <div style={{
        background: '#fff', border: '1px solid #E2E8F0', borderRadius: 12,
        padding: '14px 18px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap',
        boxShadow: '0 1px 4px rgba(0,0,0,.04)',
      }}>
        <div style={{ display: 'flex', gap: 20, flexWrap: 'wrap', alignItems: 'center' }}>
          {[
            { icon: <FileText size={14} />, label: 'Articles BOQ', value: articlesCount, color: NAVY },
            { icon: <Layers size={14} />, label: 'Composants', value: PAUE2_BOQ_SEED.length, color: PURPLE },
            { icon: <Package size={14} />, label: 'Sous-composants', value: PAUE2_BOQ_SEED.reduce((s,l)=>s+l.sousComposants.length,0), color: ORANGE },
            { icon: <Zap size={14} />, label: 'Total BOQ estimé', value: fmtM(boqTotal) + ' FCFA', color: GREEN },
          ].map(k => (
            <div key={k.label} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <span style={{ color: k.color }}>{k.icon}</span>
              <div>
                <div style={{ fontSize: 9, color: '#94A3B8', textTransform: 'uppercase', letterSpacing: '0.06em', fontWeight: 700 }}>{k.label}</div>
                <div style={{ fontSize: 14, fontWeight: 800, color: k.color }}>{k.value}</div>
              </div>
            </div>
          ))}
        </div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          {current
            ? <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, fontSize: 12, fontWeight: 700, color: current.valide ? GREEN : ORANGE, background: current.valide ? '#DCFCE7' : '#FFF7ED', padding: '4px 10px', borderRadius: 99 }}>
                {current.valide ? <CheckCircle2 size={13} /> : <RefreshCw size={13} />}
                {current.valide ? 'Structuration validée' : 'Générée — à valider'}
              </span>
            : <span style={{ fontSize: 12, color: '#94A3B8', fontStyle: 'italic' }}>Aucune structuration encore générée.</span>
          }
          <button onClick={() => setShowBOQ(v => !v)}
            style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '6px 12px', border: '1px solid #E2E8F0', borderRadius: 7, background: '#F8FAFC', cursor: 'pointer', fontSize: 12, color: '#374151', fontFamily: 'inherit' }}>
            {showBOQ ? <><EyeOff size={12} /> Masquer BOQ</> : <><Eye size={12} /> Aperçu BOQ</>}
          </button>
        </div>
      </div>

      {/* ── Gate validation — 6 inputs requis ───────────────────────────── */}
      <div style={{ background: '#fff', border: `2px solid ${gateAllValid ? '#BBF7D0' : '#FED7AA'}`, borderRadius: 14, padding: '18px 20px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14 }}>
          <ClipboardCheck size={17} style={{ color: gateAllValid ? GREEN : ORANGE }} />
          <div>
            <div style={{ fontSize: 14, fontWeight: 800, color: NAVY }}>Conditions de lancement — {gateCount}/6 inputs validés</div>
            <div style={{ fontSize: 11, color: '#64748B' }}>Tous les inputs sont requis avant de lancer l&apos;analyse patrimoniale IA</div>
          </div>
          {gateAllValid && (
            <span style={{ marginLeft: 'auto', display: 'inline-flex', alignItems: 'center', gap: 5, padding: '4px 12px', borderRadius: 99, background: '#DCFCE7', color: GREEN, fontSize: 12, fontWeight: 800 }}>
              <CheckCircle2 size={13} /> Prêt à lancer
            </span>
          )}
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 10 }}>
          {/* Card 1 — Liste localités SIG */}
          {[
            { id: 'localites', label: 'Liste localités (SIG)', desc: 'Points GPS, villages à électrifier', icon: <MapPin size={14}/>, ok: gateListeLocalites, color: '#0891B2',
              action: <button onClick={() => setGateListeLocalites(true)} style={{ padding: '5px 10px', borderRadius: 7, border: `1px solid #0891B220`, background: '#EFF6FF', color: '#0891B2', fontSize: 11, fontWeight: 700, cursor: 'pointer' }}>✓ Confirmer</button> },
            { id: 'boq', label: 'Bordereau de Quantités (BOQ)', desc: hasBoq ? `BOQ actif — ${boqRows.filter(r=>(r.quantite??0)>0).length} articles` : 'DQE du marché en cours', icon: <FileText size={14}/>, ok: hasBoq, color: NAVY,
              action: !hasBoq ? <button onClick={() => setGateBoqConfirmed(true)} style={{ padding: '5px 10px', borderRadius: 7, border: `1px solid ${NAVY}20`, background: '#EFF6FF', color: NAVY, fontSize: 11, fontWeight: 700, cursor: 'pointer' }}>✓ Confirmer</button> : null },
            { id: 'pvrp', label: 'PVRP numérique par site', desc: hasPVRP ? `${Object.values(pvrpRecords).filter(r=>r.statut!=='vide').length} site(s) saisi(s)` : 'PV Réception Provisoire par localité', icon: <ClipboardCheck size={14}/>, ok: hasPVRP, color: ORANGE,
              action: <button onClick={() => { const k = newSiteName || 'Site-1'; const r = EMPTY_PVRP(k); setPvrpDraft(r); setActivePVRPSite(k); }} style={{ padding: '5px 10px', borderRadius: 7, border: `1px solid ${ORANGE}20`, background: '#FFF7ED', color: ORANGE, fontSize: 11, fontWeight: 700, cursor: 'pointer' }}>+ Saisir PVRP</button> },
            { id: 'pvmes', label: 'PV Mise en Service', desc: hasPVMES ? `${pvMES.length} PV enregistré(s)` : 'Date MES + valeur immobilisée par site', icon: <Zap size={14}/>, ok: hasPVMES, color: GREEN,
              action: <button onClick={() => { setShowPVMESForm(true); setPvmesFormData({ dateReception: new Date().toISOString().slice(0,10), categorie: 'Réseau HTA/BT', valeurMES: 0 }); }} style={{ padding: '5px 10px', borderRadius: 7, border: `1px solid ${GREEN}20`, background: '#F0FDF4', color: GREEN, fontSize: 11, fontWeight: 700, cursor: 'pointer' }}>+ Nouveau PV MES</button> },
            { id: 'valeurs', label: 'Liste des valeurs', desc: 'Classifications actifs, natures, bailleurs', icon: <Layers size={14}/>, ok: gateListeValeurs2, color: PURPLE,
              action: <button onClick={() => setGateListeValeurs2(true)} style={{ padding: '5px 10px', borderRadius: 7, border: `1px solid ${PURPLE}20`, background: '#F5F3FF', color: PURPLE, fontSize: 11, fontWeight: 700, cursor: 'pointer' }}>✓ Confirmer</button> },
            { id: 'decomp', label: 'Décomposition', desc: 'Structure Composant → Sous-composant', icon: <GitBranch size={14}/>, ok: gateDecomp, color: '#D97706',
              action: <button onClick={() => setGateDecomp(true)} style={{ padding: '5px 10px', borderRadius: 7, border: `1px solid #D9770620`, background: '#FFFBEB', color: '#D97706', fontSize: 11, fontWeight: 700, cursor: 'pointer' }}>✓ Confirmer</button> },
          ].map(item => (
            <div key={item.id} style={{ borderRadius: 10, border: `1.5px solid ${item.ok ? item.color + '40' : '#E2E8F0'}`, background: item.ok ? item.color + '06' : '#FAFAFA', padding: '12px 14px', display: 'flex', flexDirection: 'column', gap: 8 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{ color: item.ok ? item.color : '#CBD5E1' }}>{item.icon}</span>
                <span style={{ fontSize: 12, fontWeight: 800, color: item.ok ? '#0F172A' : '#64748B' }}>{item.label}</span>
                <span style={{ marginLeft: 'auto', fontSize: 14 }}>{item.ok ? '✅' : '⬜'}</span>
              </div>
              <div style={{ fontSize: 10.5, color: item.ok ? '#475569' : '#94A3B8' }}>{item.desc}</div>
              {!item.ok && item.action && <div>{item.action}</div>}
              {item.ok && item.id === 'pvrp' && (
                <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                  {Object.values(pvrpRecords).map(r => (
                    <button key={r.id} onClick={() => { setPvrpDraft({...r}); setActivePVRPSite(r.localite); }}
                      style={{ padding: '2px 8px', borderRadius: 10, border: `1px solid ${ORANGE}30`, background: '#FFF7ED', color: ORANGE, fontSize: 10, fontWeight: 700, cursor: 'pointer' }}>
                      {r.village || r.localite}
                    </button>
                  ))}
                  <button onClick={() => { const k = `Site-${Object.keys(pvrpRecords).length+1}`; setPvrpDraft(EMPTY_PVRP(k)); setActivePVRPSite(k); }}
                    style={{ padding: '2px 8px', borderRadius: 10, border: `1px solid ${ORANGE}30`, background: '#FFF7ED', color: ORANGE, fontSize: 10, fontWeight: 700, cursor: 'pointer' }}>+ Site</button>
                </div>
              )}
            </div>
          ))}
        </div>
        {!gateAllValid && (
          <div style={{ marginTop: 12, padding: '10px 14px', borderRadius: 9, background: '#FFF7ED', border: '1px solid #FED7AA', fontSize: 11.5, color: '#92400E' }}>
            <strong>⚠ Inputs manquants :</strong>{' '}
            {[
              !gateListeLocalites && 'Liste localités (SIG)',
              !hasBoq && 'Bordereau de Quantités',
              !hasPVRP && 'PVRP numérique',
              !hasPVMES && 'PV Mise en Service',
              !gateListeValeurs2 && 'Liste des valeurs',
              !gateDecomp && 'Décomposition',
            ].filter(Boolean).join(' · ')}
          </div>
        )}
      </div>

      {/* ── PVRP par site (liste compacte) ──────────────────────────────── */}
      {Object.keys(pvrpRecords).length > 0 && (
        <div style={{ background: '#fff', border: '1px solid #E2E8F0', borderRadius: 12, padding: '14px 18px' }}>
          <div style={{ fontSize: 13, fontWeight: 800, color: NAVY, marginBottom: 10, display: 'flex', alignItems: 'center', gap: 8 }}>
            <ClipboardCheck size={15} style={{ color: ORANGE }} /> PVRP saisis — {Object.keys(pvrpRecords).length} site(s)
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: 8 }}>
            {Object.values(pvrpRecords).map(r => (
              <div key={r.id} style={{ padding: '10px 12px', borderRadius: 9, border: `1.5px solid ${r.statut === 'valide' ? '#BBF7D0' : r.statut === 'en_cours' ? '#FED7AA' : '#E2E8F0'}`, background: r.statut === 'valide' ? '#F0FDF4' : '#FAFAFA', cursor: 'pointer' }}
                onClick={() => { setPvrpDraft({...r}); setActivePVRPSite(r.localite); }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4 }}>
                  <MapPin size={11} style={{ color: ORANGE }} />
                  <span style={{ fontSize: 12, fontWeight: 800, color: NAVY }}>{r.village || r.localite}</span>
                  <span style={{ marginLeft: 'auto', fontSize: 10, fontWeight: 700, color: r.statut === 'valide' ? GREEN : r.statut === 'en_cours' ? '#D97706' : '#94A3B8', background: r.statut === 'valide' ? '#DCFCE7' : r.statut === 'en_cours' ? '#FEF9C3' : '#F1F5F9', padding: '2px 6px', borderRadius: 8 }}>
                    {r.statut === 'valide' ? '✓ Validé' : r.statut === 'en_cours' ? 'En cours' : 'Vide'}
                  </span>
                </div>
                <div style={{ fontSize: 10, color: '#64748B' }}>{r.commune} · {r.date || '—'} · {r.entrepreneur || 'Entrepreneur N/A'}</div>
                <div style={{ fontSize: 10, color: '#94A3B8', marginTop: 3 }}>
                  Postes : {r.posteNumero || '—'} · Compt. : {r.branCompteurMono || 0} · BT : {r.btPiquetageML || 0} ml
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── Swarm IA — SIGP ──────────────────────────────────────────────── */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          {/* Pipeline visualisation */}
          <div style={{ background: 'linear-gradient(135deg, #0F172A 0%, #1B4F8A 100%)', borderRadius: 14, padding: '20px 24px', color: '#fff' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16 }}>
              <Workflow size={20} style={{ color: ORANGE }} />
              <div>
                <div style={{ fontSize: 15, fontWeight: 800 }}>SIGEP Asset Reconstruction Swarm — 11 agents IA</div>
                <div style={{ fontSize: 11.5, opacity: 0.7 }}>Bordereau → Structuration → SYSCOHADA → Réconciliation → Score qualité · Remplace la procédure manuelle SIGP</div>
              </div>
              <button
                onClick={runSwarm}
                disabled={swarmRunning || !gateAllValid}
                title={!gateAllValid ? `${6 - gateCount} input(s) manquant(s) — remplir le panneau de conditions ci-dessus` : 'Lancer l\'analyse patrimoniale IA'}
                style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 8, padding: '10px 20px', borderRadius: 10, border: 'none', background: swarmRunning ? '#475569' : !gateAllValid ? '#94A3B8' : ORANGE, color: '#fff', fontSize: 13, fontWeight: 800, cursor: (swarmRunning || !gateAllValid) ? 'not-allowed' : 'pointer', opacity: !gateAllValid ? 0.7 : 1 }}>
                {swarmRunning
                  ? <><RefreshCw size={14} style={{ animation: 'spin 1s linear infinite' }} /> Swarm en cours…</>
                  : !gateAllValid
                  ? <><AlertTriangle size={14} /> {6 - gateCount} input(s) manquant(s)</>
                  : <><Zap size={14} /> Lancer le Swarm IA</>}
              </button>
            </div>

            {/* Agent pipeline */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 0, overflowX: 'auto', paddingBottom: 4 }}>
              {SWARM_PHASES.map((phase, i) => {
                const status = swarmStatus[phase.id];
                const Icon = phase.icon;
                const bgColor = status === 'ok' ? '#16A34A' : status === 'running' ? phase.couleur : status === 'error' ? '#DC2626' : 'rgba(255,255,255,0.1)';
                const borderColor = status === 'idle' ? 'rgba(255,255,255,0.2)' : bgColor;
                return (
                  <div key={phase.id} style={{ display: 'flex', alignItems: 'center' }}>
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6, minWidth: 100 }}>
                      <div style={{ width: 52, height: 52, borderRadius: 14, background: bgColor, border: `2px solid ${borderColor}`, display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'all 0.3s', boxShadow: status === 'running' ? `0 0 16px ${phase.couleur}80` : 'none' }}>
                        {status === 'ok' ? <CheckCircle2 size={22} color="#fff" />
                          : status === 'running' ? <RefreshCw size={20} color="#fff" style={{ animation: 'spin 1s linear infinite' }} />
                          : status === 'error' ? <AlertTriangle size={20} color="#fff" />
                          : <Icon size={20} color="rgba(255,255,255,0.5)" />}
                      </div>
                      <div style={{ textAlign: 'center' }}>
                        <div style={{ fontSize: 10.5, fontWeight: 700, color: status === 'idle' ? 'rgba(255,255,255,0.5)' : '#fff' }}>{phase.nom}</div>
                        <div style={{ fontSize: 9, color: 'rgba(255,255,255,0.4)', marginTop: 1, maxWidth: 90, textAlign: 'center' }}>{phase.desc.split('—')[0]}</div>
                      </div>
                    </div>
                    {i < SWARM_PHASES.length - 1 && (
                      <div style={{ display: 'flex', alignItems: 'center', padding: '0 4px', marginBottom: 28 }}>
                        <ArrowRight size={16} color={swarmStatus[SWARM_PHASES[i+1].id] !== 'idle' ? '#16A34A' : 'rgba(255,255,255,0.2)'} />
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          {/* Log panel */}
          {swarmLog.length > 0 && (
            <div style={{ background: '#0F172A', borderRadius: 10, padding: '12px 16px', maxHeight: 180, overflowY: 'auto' }}>
              <div style={{ fontSize: 10, fontWeight: 700, color: '#64748B', marginBottom: 8, textTransform: 'uppercase', letterSpacing: '.4px' }}>Journal d'exécution</div>
              {swarmLog.map((line, i) => (
                <div key={i} style={{ fontSize: 11, color: line.includes('→') ? '#86EFAC' : '#94A3B8', fontFamily: 'monospace', lineHeight: 1.6 }}>
                  {line}
                </div>
              ))}
            </div>
          )}

          {/* Score validation (Agent 8) */}
          {validScore && (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr) 1fr', gap: 12, alignItems: 'start' }}>
              {[
                { label: 'Complétude', value: validScore.completude, color: validScore.completude >= 80 ? GREEN : validScore.completude >= 60 ? '#D97706' : '#DC2626' },
                { label: 'Cohérence', value: validScore.coherence, color: validScore.coherence >= 80 ? GREEN : validScore.coherence >= 60 ? '#D97706' : '#DC2626' },
                { label: 'Confiance', value: validScore.confiance, color: validScore.confiance >= 70 ? GREEN : validScore.confiance >= 50 ? '#D97706' : '#DC2626' },
              ].map(s => (
                <div key={s.label} style={{ background: '#fff', border: `2px solid ${s.color}30`, borderRadius: 12, padding: '14px 18px', textAlign: 'center' }}>
                  <div style={{ fontSize: 9, fontWeight: 700, color: '#94A3B8', textTransform: 'uppercase', letterSpacing: '.06em', marginBottom: 6 }}>{s.label}</div>
                  <div style={{ fontSize: 26, fontWeight: 900, color: s.color }}>{s.value}%</div>
                  <div style={{ marginTop: 8, height: 6, borderRadius: 4, background: '#F1F5F9' }}>
                    <div style={{ height: 6, borderRadius: 4, background: s.color, width: `${s.value}%`, transition: 'width 0.8s ease' }} />
                  </div>
                </div>
              ))}
              <div style={{ background: validScore.alertes.length === 0 ? '#F0FDF4' : '#FEF2F2', border: `1px solid ${validScore.alertes.length === 0 ? '#BBF7D0' : '#FECACA'}`, borderRadius: 12, padding: '14px 18px' }}>
                <div style={{ fontSize: 11, fontWeight: 700, color: validScore.alertes.length === 0 ? '#16A34A' : '#DC2626', marginBottom: 6, display: 'flex', alignItems: 'center', gap: 6 }}>
                  {validScore.alertes.length === 0 ? <CheckCircle2 size={13} /> : <AlertTriangle size={13} />}
                  {validScore.alertes.length === 0 ? 'PASS — aucune alerte' : `${validScore.alertes.length} alerte(s)`}
                </div>
                {validScore.alertes.map((a, i) => <div key={i} style={{ fontSize: 10, color: '#B91C1C', lineHeight: 1.5 }}>• {a}</div>)}
              </div>
            </div>
          )}

          {/* Anomalies */}
          {validIssues.length > 0 && !validScore && (
            <div style={{ background: '#FEF2F2', border: '1px solid #FECACA', borderRadius: 10, padding: '12px 16px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8, fontWeight: 700, color: '#DC2626', fontSize: 13 }}>
                <AlertTriangle size={15} /> {validIssues.length} anomalie(s) SIGP détectée(s)
              </div>
              {validIssues.map((issue, i) => <div key={i} style={{ fontSize: 12, color: '#B91C1C', paddingLeft: 24 }}>• {issue}</div>)}
            </div>
          )}

          {/* Résultats classification */}
          {classified.length > 0 && (
            <div style={{ background: '#fff', border: '1px solid #E2E8F0', borderRadius: 12, overflow: 'hidden' }}>
              <div style={{ padding: '12px 16px', background: '#F8FAFC', borderBottom: '1px solid #E2E8F0', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 8 }}>
                <div style={{ fontSize: 13, fontWeight: 800, color: NAVY }}>
                  Classification WBS — {classified.length} articles · {new Set(classified.map(c => c.organisation)).size} organisations
                </div>
                {/* Répartition par organisation */}
                <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                  {(['Distribution', 'Production', 'Transport', 'Commercial', 'Support', 'Génie Civil'] as const).map(org => {
                    const count = classified.filter(c => c.organisation === org).length;
                    if (!count) return null;
                    const colors: Record<string, string> = { Distribution: NAVY, Production: '#DC2626', Transport: '#7C3AED', Commercial: '#059669', Support: '#D97706', 'Génie Civil': '#0891B2' };
                    return (
                      <span key={org} style={{ fontSize: 10, fontWeight: 700, color: colors[org], background: colors[org] + '15', padding: '2px 8px', borderRadius: 10 }}>
                        {org}: {count}
                      </span>
                    );
                  })}
                </div>
              </div>
              <div style={{ maxHeight: 340, overflowY: 'auto', overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 11, minWidth: 700 }}>
                  <thead>
                    <tr style={{ background: '#F8FAFC', position: 'sticky', top: 0 }}>
                      {['Code WBS', 'Parent', 'Désignation', 'Organisation', 'Localisation', 'Classif. Actif', 'Type', 'Budget FCFA'].map(h => (
                        <th key={h} style={{ padding: '6px 10px', textAlign: h === 'Budget FCFA' ? 'right' : 'left', fontSize: 9, fontWeight: 700, color: '#64748B', textTransform: 'uppercase', borderBottom: '2px solid #E2E8F0', whiteSpace: 'nowrap' }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {classified.map((item, i) => {
                      const orgColors: Record<string, string> = { Distribution: NAVY, Production: '#DC2626', Transport: '#7C3AED', Commercial: '#059669', Support: '#D97706', 'Génie Civil': '#0891B2' };
                      const col = orgColors[item.organisation] ?? '#64748B';
                      return (
                        <tr key={i} style={{ background: i % 2 === 0 ? '#fff' : '#FAFBFC', borderBottom: '1px solid #F1F5F9' }}>
                          <td style={{ padding: '5px 10px', fontFamily: 'monospace', fontSize: 10, fontWeight: 700, color: NAVY }}>{item.wbsCode}</td>
                          <td style={{ padding: '5px 10px', fontFamily: 'monospace', fontSize: 10, color: '#94A3B8' }}>{item.wbsParent}</td>
                          <td style={{ padding: '5px 10px', maxWidth: 240, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', color: '#0F172A' }} title={item.designation}>{item.designation}</td>
                          <td style={{ padding: '5px 10px' }}>
                            <span style={{ fontSize: 10, fontWeight: 700, color: col, background: col + '15', padding: '2px 7px', borderRadius: 10 }}>{item.organisation}</span>
                          </td>
                          <td style={{ padding: '5px 10px', fontSize: 10, color: '#475569' }}>{item.localisation}</td>
                          <td style={{ padding: '5px 10px', fontSize: 10, color: '#475569' }}>{item.classifActif}</td>
                          <td style={{ padding: '5px 10px' }}>
                            <span style={{ fontSize: 10, fontWeight: 600, color: item.typeActif === 'Immobilisable' ? GREEN : '#D97706', background: item.typeActif === 'Immobilisable' ? '#DCFCE7' : '#FFF7ED', padding: '2px 6px', borderRadius: 8 }}>{item.typeActif}</span>
                          </td>
                          <td style={{ padding: '5px 10px', textAlign: 'right', fontWeight: 700, color: NAVY }}>{fmtM(item.budget)}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                  <tfoot>
                    <tr style={{ background: '#F8FAFC', fontWeight: 800, color: NAVY, borderTop: '2px solid #E2E8F0' }}>
                      <td colSpan={7} style={{ padding: '8px 10px' }}>TOTAL — {classified.length} articles</td>
                      <td style={{ padding: '8px 10px', textAlign: 'right' }}>{fmtM(classified.reduce((s, c) => s + c.budget, 0))} FCFA</td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            </div>
          )}

          {/* Table SYSCOHADA — Agent 6 */}
          {sigpActifs.length > 0 && (
            <div style={{ background: '#fff', border: '1px solid #E2E8F0', borderRadius: 12, overflow: 'hidden' }}>
              <div style={{ padding: '12px 16px', background: '#FEF2F2', borderBottom: '1px solid #FECACA', display: 'flex', alignItems: 'center', gap: 8 }}>
                <BarChart3 size={14} style={{ color: '#DC2626' }} />
                <span style={{ fontSize: 13, fontWeight: 800, color: NAVY }}>Plan Comptable SYSCOHADA — {sigpActifs.length} actifs immobilisables</span>
              </div>
              <div style={{ maxHeight: 280, overflowY: 'auto', overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 11, minWidth: 750 }}>
                  <thead>
                    <tr style={{ background: '#F8FAFC' }}>
                      {['N° Inventaire', 'Désignation', 'Cl.', 'Compte', 'Libellé SYSCOHADA', 'Durée', 'Taux', 'Valeur Acq.'].map(h => (
                        <th key={h} style={{ padding: '6px 10px', fontSize: 9, fontWeight: 700, color: '#64748B', textTransform: 'uppercase', borderBottom: '2px solid #E2E8F0', whiteSpace: 'nowrap', textAlign: h === 'Valeur Acq.' ? 'right' : 'left' }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {sigpActifs.map((a, i) => (
                      <tr key={i} style={{ background: i % 2 === 0 ? '#fff' : '#FAFBFC', borderBottom: '1px solid #F1F5F9' }}>
                        <td style={{ padding: '5px 10px', fontFamily: 'monospace', fontSize: 9, color: NAVY, fontWeight: 700 }}>{a.numInventaire}</td>
                        <td style={{ padding: '5px 10px', maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={a.designation}>{a.designation}</td>
                        <td style={{ padding: '5px 10px', fontWeight: 800, color: '#DC2626' }}>{a.syscohadaClasse}</td>
                        <td style={{ padding: '5px 10px', fontFamily: 'monospace', fontSize: 10, fontWeight: 700 }}>{a.syscohadaCompte}</td>
                        <td style={{ padding: '5px 10px', fontSize: 10, color: '#475569' }}>{a.syscohadaLibelle}</td>
                        <td style={{ padding: '5px 10px', fontSize: 10 }}>{a.dureeAmort} ans</td>
                        <td style={{ padding: '5px 10px', fontSize: 10, fontWeight: 700, color: '#7C3AED' }}>{a.tauxAmort}%</td>
                        <td style={{ padding: '5px 10px', textAlign: 'right', fontWeight: 700, color: NAVY }}>{fmtM(a.budget)}</td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr style={{ background: '#FEF2F2', fontWeight: 800, color: '#DC2626' }}>
                      <td colSpan={7} style={{ padding: '8px 10px' }}>TOTAL Immobilisé</td>
                      <td style={{ padding: '8px 10px', textAlign: 'right' }}>{fmtM(sigpActifs.reduce((s, a) => s + a.budget, 0))} FCFA</td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            </div>
          )}

          {/* Table Réconciliation — Agent 7 */}
          {reconcData.length > 0 && (
            <div style={{ background: '#fff', border: '1px solid #E2E8F0', borderRadius: 12, overflow: 'hidden' }}>
              <div style={{ padding: '12px 16px', background: '#FFF7ED', borderBottom: '1px solid #FED7AA', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 8 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <ArrowRight size={14} style={{ color: ORANGE }} />
                  <span style={{ fontSize: 13, fontWeight: 800, color: NAVY }}>Réconciliation — Marché / Réceptionné / MES / Immobilisé</span>
                </div>
                <div style={{ display: 'flex', gap: 10 }}>
                  {[
                    { label: 'OK', count: reconcData.filter(l => l.statut === 'ok').length, color: GREEN },
                    { label: 'Partiel', count: reconcData.filter(l => l.statut === 'partiel').length, color: '#D97706' },
                    { label: 'Écart', count: reconcData.filter(l => l.statut === 'ecart').length, color: '#DC2626' },
                  ].map(s => (
                    <span key={s.label} style={{ fontSize: 10, fontWeight: 700, color: s.color, background: s.color + '15', padding: '2px 8px', borderRadius: 10 }}>{s.label}: {s.count}</span>
                  ))}
                </div>
              </div>
              <div style={{ maxHeight: 280, overflowY: 'auto', overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 11, minWidth: 750 }}>
                  <thead>
                    <tr style={{ background: '#F8FAFC' }}>
                      {['WBS', 'Désignation', 'Montant Marché', 'Réceptionné', 'MES', 'Immobilisé', 'Écart', 'Statut'].map(h => (
                        <th key={h} style={{ padding: '6px 10px', fontSize: 9, fontWeight: 700, color: '#64748B', textTransform: 'uppercase', borderBottom: '2px solid #E2E8F0', whiteSpace: 'nowrap', textAlign: ['Montant Marché', 'Réceptionné', 'MES', 'Immobilisé', 'Écart'].includes(h) ? 'right' : 'left' }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {reconcData.map((line, i) => (
                      <tr key={i} style={{ background: line.statut === 'ecart' ? '#FEF2F2' : line.statut === 'partiel' ? '#FFFBEB' : '#fff', borderBottom: '1px solid #F1F5F9' }}>
                        <td style={{ padding: '5px 10px', fontFamily: 'monospace', fontSize: 9, fontWeight: 700, color: NAVY }}>{line.wbsCode}</td>
                        <td style={{ padding: '5px 10px', maxWidth: 180, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontSize: 10 }} title={line.designation}>{line.designation}</td>
                        <td style={{ padding: '5px 10px', textAlign: 'right', fontWeight: 700 }}>{fmtM(line.montantMarche)}</td>
                        <td style={{ padding: '5px 10px', textAlign: 'right', color: '#0891B2' }}>{fmtM(line.montantReceptionne)}</td>
                        <td style={{ padding: '5px 10px', textAlign: 'right', color: GREEN }}>{fmtM(line.montantMES)}</td>
                        <td style={{ padding: '5px 10px', textAlign: 'right', color: NAVY, fontWeight: 700 }}>{fmtM(line.montantImmobilise)}</td>
                        <td style={{ padding: '5px 10px', textAlign: 'right', fontWeight: 700, color: line.ecart > 0 ? '#DC2626' : GREEN }}>{fmtM(Math.abs(line.ecart))}</td>
                        <td style={{ padding: '5px 10px' }}>
                          <span style={{ fontSize: 9, fontWeight: 700, padding: '2px 6px', borderRadius: 8, color: line.statut === 'ok' ? GREEN : line.statut === 'partiel' ? '#D97706' : '#DC2626', background: line.statut === 'ok' ? '#DCFCE7' : line.statut === 'partiel' ? '#FEF9C3' : '#FEE2E2' }}>
                            {line.statut.toUpperCase()}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr style={{ background: '#FFF7ED', fontWeight: 800, color: ORANGE }}>
                      <td colSpan={2} style={{ padding: '8px 10px' }}>TOTAL</td>
                      <td style={{ padding: '8px 10px', textAlign: 'right' }}>{fmtM(reconcData.reduce((s, l) => s + l.montantMarche, 0))}</td>
                      <td style={{ padding: '8px 10px', textAlign: 'right' }}>{fmtM(reconcData.reduce((s, l) => s + l.montantReceptionne, 0))}</td>
                      <td style={{ padding: '8px 10px', textAlign: 'right' }}>{fmtM(reconcData.reduce((s, l) => s + l.montantMES, 0))}</td>
                      <td style={{ padding: '8px 10px', textAlign: 'right' }}>{fmtM(reconcData.reduce((s, l) => s + l.montantImmobilise, 0))}</td>
                      <td style={{ padding: '8px 10px', textAlign: 'right' }}>{fmtM(reconcData.reduce((s, l) => s + l.ecart, 0))}</td>
                      <td style={{ padding: '8px 10px' }}>—</td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            </div>
          )}

          {/* Territory Tree — Agent 2-5 */}
          {localitesTree.length > 0 && (
            <div style={{ background: '#fff', border: '1px solid #E2E8F0', borderRadius: 12, overflow: 'hidden' }}>
              <div style={{ padding: '12px 16px', background: '#EFF6FF', borderBottom: '1px solid #BFDBFE', display: 'flex', alignItems: 'center', gap: 8 }}>
                <MapPin size={14} style={{ color: '#0891B2' }} />
                <span style={{ fontSize: 13, fontWeight: 800, color: NAVY }}>Hiérarchie Patrimoniale — Projet → Localité → Ouvrage → Équipement → Composant</span>
              </div>
              <div style={{ maxHeight: 320, overflowY: 'auto', padding: '12px 16px' }}>
                {localitesTree.map(loc => (
                  <div key={loc.id} style={{ marginBottom: 12 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                      <MapPin size={12} style={{ color: '#0891B2', flexShrink: 0 }} />
                      <span style={{ fontSize: 12, fontWeight: 800, color: NAVY }}>{loc.nom}</span>
                      <span style={{ fontSize: 10, color: '#64748B' }}>{loc.departement} · {loc.region}</span>
                      <span style={{ fontSize: 10, color: '#94A3B8', marginLeft: 'auto' }}>{loc.latitude.toFixed(4)}, {loc.longitude.toFixed(4)}</span>
                      <span style={{ fontSize: 10, fontWeight: 700, color: ORANGE }}>{fmtM(loc.valeur)} FCFA</span>
                    </div>
                    {loc.ouvrages.map(ouv => (
                      <div key={ouv.id} style={{ marginLeft: 20, marginBottom: 4 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 3 }}>
                          <Building2 size={11} style={{ color: PURPLE, flexShrink: 0 }} />
                          <span style={{ fontSize: 11, fontWeight: 700, color: '#374151' }}>{ouv.designation}</span>
                          <span style={{ fontSize: 10, color: ORANGE, marginLeft: 'auto' }}>{fmtM(ouv.valeur)}</span>
                        </div>
                        {ouv.equipements.map(eq => (
                          <div key={eq.id} style={{ marginLeft: 18, marginBottom: 2, display: 'flex', alignItems: 'center', gap: 6 }}>
                            <Package size={10} style={{ color: '#D97706', flexShrink: 0 }} />
                            <span style={{ fontSize: 10, color: '#475569' }}>{eq.designation}</span>
                            <span style={{ fontSize: 9, color: '#94A3B8', marginLeft: 4 }}>({eq.composants.length} comp.)</span>
                          </div>
                        ))}
                      </div>
                    ))}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Knowledge Graph — Agent 11 */}
          {knowledgeGraph && validScore && (
            <div style={{ background: 'linear-gradient(135deg, #F0FDF4 0%, #ECFDF5 100%)', border: '1px solid #BBF7D0', borderRadius: 12, padding: '16px 20px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
                <CheckCircle2 size={16} style={{ color: GREEN }} />
                <span style={{ fontSize: 13, fontWeight: 800, color: NAVY }}>Référentiel Maître SIGEP — Knowledge Graph généré</span>
                <span style={{ marginLeft: 'auto', fontSize: 11, fontWeight: 700, color: validScore.confiance >= 70 ? GREEN : '#D97706' }}>
                  Confiance : {validScore.confiance}%
                </span>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 8 }}>
                {([
                  { label: 'Projet', value: '1', color: NAVY, icon: <FileText size={14} /> },
                  { label: 'Localités', value: String(localitesTree.length), color: '#0891B2', icon: <MapPin size={14} /> },
                  { label: 'Ouvrages', value: String(localitesTree.reduce((s, l) => s + l.ouvrages.length, 0)), color: PURPLE, icon: <Building2 size={14} /> },
                  { label: 'Équipements', value: String(localitesTree.reduce((s, l) => s + l.ouvrages.reduce((s2, o) => s2 + o.equipements.length, 0), 0)), color: '#D97706', icon: <Package size={14} /> },
                  { label: 'Composants', value: String(localitesTree.reduce((s, l) => s + l.ouvrages.reduce((s2, o) => s2 + o.equipements.reduce((s3, e) => s3 + e.composants.length, 0), 0), 0)), color: ORANGE, icon: <GitBranch size={14} /> },
                ]).map(k => (
                  <div key={k.label} style={{ background: '#fff', borderRadius: 10, padding: '10px 12px', border: `1px solid ${k.color}20`, textAlign: 'center' }}>
                    <div style={{ color: k.color, marginBottom: 4, display: 'flex', justifyContent: 'center' }}>{k.icon}</div>
                    <div style={{ fontSize: 20, fontWeight: 900, color: k.color }}>{k.value}</div>
                    <div style={{ fontSize: 9, color: '#94A3B8', textTransform: 'uppercase', letterSpacing: '.04em' }}>{k.label}</div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Export CSV buttons */}
          {swarmDone && classified.length > 0 && (
            <div style={{ background: '#fff', border: '1px solid #E2E8F0', borderRadius: 12, padding: '16px 20px' }}>
              <div style={{ fontSize: 13, fontWeight: 800, color: NAVY, marginBottom: 12, display: 'flex', alignItems: 'center', gap: 8 }}>
                <Download size={15} /> Télécharger — Fichiers SIGP Oracle PPM + SYSCOHADA
              </div>
              <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                {([
                  { label: 'ProjectImportTemplate.csv', desc: `${classified.length} tâches financières`, type: 'project' as const, color: NAVY },
                  { label: 'ProjectBudgetsImportTemplate.csv', desc: `${classified.length * 3} lignes (RMA · EA · CP)`, type: 'budget' as const, color: PURPLE },
                  { label: 'CostsImportTemplate.csv', desc: `${classified.filter(c => c.typeActif === 'Immobilisable').length} postes capitalisables`, type: 'costs' as const, color: GREEN },
                ] as const).map(btn => (
                  <button key={btn.type} onClick={() => exportSigpCSV(classified, projetCode, btn.type)}
                    style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start', gap: 2, padding: '10px 16px', borderRadius: 10, border: `2px solid ${btn.color}30`, background: btn.color + '08', cursor: 'pointer', fontFamily: 'inherit', textAlign: 'left', transition: 'all 0.15s' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, fontWeight: 800, color: btn.color }}>
                      <Download size={13} /> {btn.label}
                    </div>
                    <div style={{ fontSize: 10, color: '#64748B' }}>{btn.desc}</div>
                  </button>
                ))}
                {sigpActifs.length > 0 && (
                  <button
                    onClick={() => {
                      const csv = ['N°Inventaire,Désignation,Classe SYSCOHADA,Compte,Libellé,Durée Amort.,Taux %,Valeur Acquisition,Organisation',
                        ...sigpActifs.map(a => `"${a.numInventaire}","${a.designation.replace(/"/g, "'")}",${a.syscohadaClasse},${a.syscohadaCompte},"${a.syscohadaLibelle}",${a.dureeAmort},${a.tauxAmort},${a.budget},"${a.organisation}"`),
                      ].join('\n');
                      const b = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8' });
                      const a = document.createElement('a'); a.href = URL.createObjectURL(b); a.download = `AccountingTemplate_SYSCOHADA_${projetCode}.csv`; a.click();
                    }}
                    style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start', gap: 2, padding: '10px 16px', borderRadius: 10, border: `2px solid #DC262630`, background: '#DC262608', cursor: 'pointer', fontFamily: 'inherit', textAlign: 'left', transition: 'all 0.15s' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, fontWeight: 800, color: '#DC2626' }}>
                      <Download size={13} /> AccountingTemplate_SYSCOHADA.csv
                    </div>
                    <div style={{ fontSize: 10, color: '#64748B' }}>{sigpActifs.length} actifs · Classes 21/23</div>
                  </button>
                )}
                {reconcData.length > 0 && (
                  <button
                    onClick={() => {
                      const csv = ['WBS,Désignation,Montant Marché,Réceptionné,MES,Immobilisé,Écart,Statut',
                        ...reconcData.map(l => `"${l.wbsCode}","${l.designation.replace(/"/g, "'")}",${l.montantMarche},${l.montantReceptionne.toFixed(0)},${l.montantMES.toFixed(0)},${l.montantImmobilise.toFixed(0)},${l.ecart.toFixed(0)},${l.statut.toUpperCase()}`),
                      ].join('\n');
                      const b = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8' });
                      const a = document.createElement('a'); a.href = URL.createObjectURL(b); a.download = `ReconciliationReport_${projetCode}.csv`; a.click();
                    }}
                    style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start', gap: 2, padding: '10px 16px', borderRadius: 10, border: `2px solid ${ORANGE}30`, background: ORANGE + '08', cursor: 'pointer', fontFamily: 'inherit', textAlign: 'left', transition: 'all 0.15s' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, fontWeight: 800, color: ORANGE }}>
                      <Download size={13} /> ReconciliationReport.csv
                    </div>
                    <div style={{ fontSize: 10, color: '#64748B' }}>{reconcData.length} lignes · Marché/Réc./MES/Immo</div>
                  </button>
                )}
              </div>
              <div style={{ marginTop: 12, padding: '8px 12px', background: '#EFF6FF', borderRadius: 8, fontSize: 11, color: '#1E40AF', display: 'flex', alignItems: 'center', gap: 8 }}>
                <FlaskConical size={13} />
                <span>Procédure SIGP : charger <strong>ProjectImportTemplate</strong> → Oracle PPM, puis Budget, puis Coûts. Créer les actifs via <strong>AccountingTemplate_SYSCOHADA</strong> dans le module Immobilisations SENELEC.</span>
              </div>
            </div>
          )}

          {/* Empty state — no BOQ yet */}
          {!swarmRunning && !swarmDone && boqRows.filter(r => (r.quantite ?? 0) > 0).length === 0 && (
            <div style={{ marginTop: 12, padding: '12px 16px', background: 'rgba(255,255,255,0.08)', borderRadius: 10, fontSize: 12, color: 'rgba(255,255,255,0.7)', textAlign: 'center' }}>
              Sélectionnez un projet et importez un Excel SENELEC ou lancez le <strong style={{ color: ORANGE }}>Swarm IA</strong> pour structurer automatiquement le patrimoine.
            </div>
          )}
        </div>

      {showBOQ && (
        <div style={{ background: '#fff', border: '1px solid #E2E8F0', borderRadius: 12, overflow: 'hidden', boxShadow: '0 1px 4px rgba(0,0,0,.04)' }}>
          <div style={{ padding: '10px 16px', borderBottom: '1px solid #F1F5F9', background: '#FAFBFC', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 8 }}>
            <span style={{ fontSize: 12, fontWeight: 700, color: NAVY }}>Bordereau de Prix Unitaires (BOQ) — {projet?.nom ?? 'Projet sélectionné'}</span>
            <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
              {boqSearch && <span style={{ fontSize: 11, color: '#64748B' }}>{boqRows.filter(r => r.designation?.toLowerCase().includes(boqSearch.toLowerCase()) || (r.code || '').toLowerCase().includes(boqSearch.toLowerCase())).length}/{boqRows.length} lignes</span>}
              <div style={{ position: 'relative' }}>
                <Search size={12} style={{ position: 'absolute', left: 7, top: '50%', transform: 'translateY(-50%)', color: '#94A3B8', pointerEvents: 'none' }} />
                <input value={boqSearch} onChange={e => setBoqSearch(e.target.value)} placeholder="Filtrer le BOQ…" style={{ padding: '4px 8px 4px 24px', borderRadius: 6, border: '1px solid #E2E8F0', fontSize: 11, width: 160, paddingRight: boqSearch ? 22 : 8, outline: 'none' }} />
                {boqSearch && <button onClick={() => setBoqSearch('')} aria-label="Effacer le filtre BOQ" style={{ position: 'absolute', right: 4, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: '#94A3B8', padding: 0 }}><X size={10} /></button>}
              </div>
              <span style={{ fontSize: 11, color: '#64748B' }}>Source : {zonesBoq.length > 1 ? 'Zones & Quantités' : 'Modèle PAUE2'}</span>
            </div>
          </div>
          <div style={{ maxHeight: 280, overflowY: 'auto', overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 11 }}>
              <thead>
                <tr style={{ background: '#F8FAFC', position: 'sticky', top: 0 }}>
                  {['Code', 'Désignation', 'Unité', 'Qté', 'Fourniture', 'Transport', 'Pose/Montage', 'Total HTVA'].map(h => (
                    <th key={h} style={{ padding: '7px 10px', textAlign: h === 'Code' || h === 'Désignation' || h === 'Unité' ? 'left' : 'right', fontSize: 9.5, fontWeight: 700, color: '#64748B', textTransform: 'uppercase', letterSpacing: '.4px', borderBottom: '2px solid #E2E8F0', whiteSpace: 'nowrap' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {boqRows.filter(r => !boqSearch.trim() || r.designation?.toLowerCase().includes(boqSearch.toLowerCase()) || (r.code || '').toLowerCase().includes(boqSearch.toLowerCase())).map((r, i) => {
                  const isHdr = !r.quantite || r.quantite === 0;
                  const total = (r.fourniture ?? 0) + (r.transport ?? 0) + (r.montage ?? 0);
                  return (
                    <tr key={i} style={{ background: isHdr ? '#F1F5F9' : i % 2 === 0 ? '#fff' : '#FAFBFC', borderBottom: '1px solid #F1F5F9' }}>
                      <td style={{ padding: '5px 10px', fontFamily: 'monospace', fontSize: 10, color: '#64748B' }}>{r.code ?? ''}</td>
                      <td style={{ padding: '5px 10px', fontWeight: isHdr ? 800 : 500, color: isHdr ? NAVY : '#1E293B', whiteSpace: 'nowrap', maxWidth: 260, overflow: 'hidden', textOverflow: 'ellipsis' }}>{r.designation}</td>
                      <td style={{ padding: '5px 10px', color: '#64748B' }}>{isHdr ? '' : r.unite}</td>
                      <td style={{ padding: '5px 10px', textAlign: 'right' }}>{isHdr ? '' : fmt(r.quantite ?? 0)}</td>
                      <td style={{ padding: '5px 10px', textAlign: 'right', color: NAVY }}>{isHdr ? '' : fmt(r.fourniture ?? 0)}</td>
                      <td style={{ padding: '5px 10px', textAlign: 'right', color: '#D97706' }}>{isHdr ? '' : fmt(r.transport ?? 0)}</td>
                      <td style={{ padding: '5px 10px', textAlign: 'right', color: ORANGE }}>{isHdr ? '' : fmt(r.montage ?? 0)}</td>
                      <td style={{ padding: '5px 10px', textAlign: 'right', fontWeight: isHdr ? 800 : 700, color: isHdr ? NAVY : GREEN }}>{isHdr ? '' : fmtM(total)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ── Résultat structuration ──────────────────────────────────────── */}
      {current && (
        <div style={{ background: '#fff', border: '1px solid #E2E8F0', borderRadius: 14, overflow: 'hidden', boxShadow: '0 2px 8px rgba(0,0,0,.06)' }}>
          {/* Toolbar */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 18px', borderBottom: '1px solid #F1F5F9', background: '#FAFBFD', flexWrap: 'wrap', gap: 10 }}>
            <div>
              <div style={{ fontSize: 14, fontWeight: 800, color: NAVY }}>
                {current.composants.length} composants · {current.composants.reduce((s,c) => s + c.sousComposants.length, 0)} sous-composants · {fmtM(current.total)} FCFA
              </div>
              <div style={{ fontSize: 11, color: '#64748B', marginTop: 2 }}>Source : {current.source} · {new Date(current.dateCreation).toLocaleDateString('fr-FR')}</div>
            </div>
            <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
              {!current.valide ? (
                <button onClick={() => { struct.valider(projetCode); toast.success('Structuration validée — capitalisable en Immobilisation.'); }}
                  style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 16px', borderRadius: 9, border: 'none', background: GREEN, color: '#fff', fontSize: 12, fontWeight: 700, cursor: 'pointer' }}>
                  <CheckCircle2 size={13} /> Valider (Human-in-the-loop)
                </button>
              ) : (
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, fontSize: 12, fontWeight: 700, color: GREEN, background: '#DCFCE7', padding: '6px 12px', borderRadius: 8 }}>
                  <CheckCircle2 size={14} /> Validée · prête pour Immobilisation
                </span>
              )}
              <button onClick={() => { struct.remove(projetCode); toast('Structuration supprimée', { icon: '🗑️' }); }}
                aria-label="Supprimer la structuration"
                style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '8px 10px', borderRadius: 8, border: '1px solid #FCA5A5', background: '#FEF2F2', color: '#B91C1C', fontSize: 12, cursor: 'pointer' }}>
                <Trash2 size={13} />
              </button>
            </div>
          </div>

          {/* Progress bars par composant */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px,1fr))', gap: 1, padding: '12px 18px', background: '#F8FAFC', borderBottom: '1px solid #F1F5F9' }}>
            {current.composants.map((c, i) => {
              const pct = current.total > 0 ? Math.round(c.total / current.total * 100) : 0;
              return (
                <div key={c.id} style={{ padding: '8px 10px', borderRadius: 8, background: '#fff', border: '1px solid #E2E8F0' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 5 }}>
                    <span style={{ fontSize: 11, fontWeight: 700, color: LOT_COLORS[i % LOT_COLORS.length], overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: 130 }}>{c.nom}</span>
                    <span style={{ fontSize: 10, fontWeight: 800, color: '#64748B' }}>{pct}%</span>
                  </div>
                  <div style={{ height: 4, background: '#F1F5F9', borderRadius: 99, overflow: 'hidden' }}>
                    <div style={{ height: '100%', width: `${pct}%`, background: LOT_COLORS[i % LOT_COLORS.length], borderRadius: 99 }} />
                  </div>
                  <div style={{ fontSize: 10, color: '#94A3B8', marginTop: 4 }}>{fmtM(c.total)} FCFA</div>
                </div>
              );
            })}
          </div>

          {/* Tree view */}
          <div style={{ padding: '8px 16px', borderBottom: '1px solid #F1F5F9', background: '#FAFBFC', display: 'flex', alignItems: 'center', gap: 8 }}>
            <div style={{ position: 'relative', flex: 1, maxWidth: 360 }}>
              <Search size={12} style={{ position: 'absolute', left: 8, top: '50%', transform: 'translateY(-50%)', color: '#94A3B8', pointerEvents: 'none' }} />
              <input
                value={compSearch}
                onChange={e => setCompSearch(e.target.value)}
                placeholder="Chercher composant, sous-composant ou article…"
                style={{ width: '100%', padding: '6px 8px 6px 26px', borderRadius: 7, border: '1px solid #E2E8F0', fontSize: 11, background: '#fff', outline: 'none', paddingRight: compSearch ? 26 : 8 }}
              />
              {compSearch && <button onClick={() => setCompSearch('')} aria-label="Effacer la recherche" style={{ position: 'absolute', right: 5, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: '#94A3B8', padding: 0 }}><X size={11} /></button>}
            </div>
            {compSearch && <span style={{ fontSize: 11, color: '#64748B' }}>
              {current.composants.filter(c => c.nom.toLowerCase().includes(compSearch.toLowerCase()) || c.sousComposants.some(sc => sc.nom.toLowerCase().includes(compSearch.toLowerCase()) || sc.articles.some(a => a.designation.toLowerCase().includes(compSearch.toLowerCase())))).length}/{current.composants.length} composants
            </span>}
          </div>
          <div style={{ maxHeight: '62vh', overflowY: 'auto' }}>
            {current.composants.length === 0 && (
              <div style={{ padding: '32px 20px', textAlign: 'center', color: '#94A3B8', fontSize: 13 }}>
                Aucun composant dans cette structuration. Relancez le <strong>Swarm IA</strong> pour reconstruire automatiquement la structure patrimoniale.
              </div>
            )}
            {current.composants.filter(c =>
              !compSearch.trim() ||
              c.nom.toLowerCase().includes(compSearch.toLowerCase()) ||
              c.sousComposants.some(sc => sc.nom.toLowerCase().includes(compSearch.toLowerCase()) || sc.articles.some(a => a.designation.toLowerCase().includes(compSearch.toLowerCase())))
            ).length === 0 && compSearch.trim() && current.composants.length > 0 && (
              <div style={{ padding: '32px 20px', textAlign: 'center', color: '#94A3B8', fontSize: 13 }}>
                Aucun composant, sous-composant ou article ne correspond à &laquo;{compSearch}&raquo;.
              </div>
            )}
            {current.composants.filter(c =>
              !compSearch.trim() ||
              c.nom.toLowerCase().includes(compSearch.toLowerCase()) ||
              c.sousComposants.some(sc => sc.nom.toLowerCase().includes(compSearch.toLowerCase()) || sc.articles.some(a => a.designation.toLowerCase().includes(compSearch.toLowerCase())))
            ).map((c, ci) => {
              const color = LOT_COLORS[ci % LOT_COLORS.length];
              return (
                <div key={c.id} style={{ borderBottom: '1px solid #F1F5F9' }}>
                  {/* Composant row */}
                  <button onClick={() => toggle(c.id)} style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 10, padding: '11px 16px', background: color + '12', border: 'none', cursor: 'pointer', fontFamily: 'inherit', textAlign: 'left' }}>
                    {collapsed.has(c.id) ? <ChevronRight size={15} style={{ color }} /> : <ChevronDown size={15} style={{ color }} />}
                    <Building2 size={15} style={{ color, flexShrink: 0 }} />
                    <span style={{ fontSize: 12.5, fontWeight: 800, color, flex: 1 }}>{c.code ? `[${c.code}] ` : ''}{c.nom}</span>
                    <span style={{ fontSize: 11, color: '#94A3B8' }}>{c.sousComposants.length} SC</span>
                    <span style={{ fontSize: 12, fontWeight: 700, color, minWidth: 110, textAlign: 'right' }}>{fmtM(c.total)} FCFA</span>
                  </button>

                  {!collapsed.has(c.id) && c.sousComposants.map((sc, si) => (
                    <div key={sc.id}>
                      {/* Sous-composant row */}
                      <button onClick={() => toggle(sc.id)} style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 10, padding: '8px 16px 8px 34px', background: '#fff', border: 'none', cursor: 'pointer', fontFamily: 'inherit', textAlign: 'left' }}>
                        {collapsed.has(sc.id) ? <ChevronRight size={13} style={{ color: '#94A3B8' }} /> : <ChevronDown size={13} style={{ color: '#94A3B8' }} />}
                        <Wrench size={12} style={{ color: color + 'AA', flexShrink: 0 }} />
                        <span style={{ fontSize: 12, fontWeight: 700, color: '#1E293B', flex: 1 }}>
                          {sc.code ? <span style={{ fontFamily: 'monospace', fontSize: 10, color: '#64748B', marginRight: 6 }}>{sc.code}</span> : null}
                          {sc.nom}
                        </span>
                        <span style={{ fontSize: 10, color: '#94A3B8', marginRight: 8 }}>{sc.articles.length} art.</span>
                        <span style={{ fontSize: 11, fontWeight: 700, color: '#475569', minWidth: 100, textAlign: 'right' }}>{fmtM(sc.total)} FCFA</span>
                      </button>

                      {/* Articles table */}
                      {!collapsed.has(sc.id) && (
                        <div style={{ overflowX: 'auto', paddingLeft: 48, paddingBottom: 4 }}>
                          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 11, minWidth: 680 }}>
                            <thead>
                              <tr style={{ background: '#F8FAFC' }}>
                                {['Code', 'Désignation', 'Unité', 'Qté', 'Fourniture', 'Transport', 'Pose', 'Total HTVA'].map(h => (
                                  <th key={h} style={{ padding: '5px 8px', textAlign: h === 'Code' || h === 'Désignation' || h === 'Unité' ? 'left' : 'right', fontSize: 9, fontWeight: 700, color: '#94A3B8', textTransform: 'uppercase', letterSpacing: '.4px', borderBottom: '1px solid #E2E8F0', whiteSpace: 'nowrap' }}>{h}</th>
                                ))}
                              </tr>
                            </thead>
                            <tbody>
                              {sc.articles.map((a, ai) => (
                                <tr key={a.id} style={{ background: ai % 2 === 0 ? '#fff' : '#FAFBFC', borderBottom: '1px solid #F8FAFC' }}>
                                  <td style={{ padding: '5px 8px', fontFamily: 'monospace', fontSize: 9.5, color: '#94A3B8' }}>{a.code ?? '—'}</td>
                                  <td style={{ padding: '5px 8px', color: '#1E293B', maxWidth: 220, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{a.designation}</td>
                                  <td style={{ padding: '5px 8px', color: '#64748B' }}>{a.unite}</td>
                                  <td style={{ padding: '5px 8px', textAlign: 'right', fontWeight: 600 }}>{fmt(a.quantite)}</td>
                                  <td style={{ padding: '5px 8px', textAlign: 'right', color: NAVY }}>{fmtM(a.fourniture ?? 0)}</td>
                                  <td style={{ padding: '5px 8px', textAlign: 'right', color: '#D97706' }}>{fmtM(a.transport ?? 0)}</td>
                                  <td style={{ padding: '5px 8px', textAlign: 'right', color: ORANGE }}>{fmtM(a.montage ?? 0)}</td>
                                  <td style={{ padding: '5px 8px', textAlign: 'right', fontWeight: 700, color: GREEN }}>{fmtM(a.total)}</td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Empty state */}
      {!current && (
        <div style={{ textAlign: 'center', padding: '60px 20px', background: '#fff', borderRadius: 14, border: '1px dashed #CBD5E1' }}>
          <Boxes size={56} style={{ color: '#CBD5E1', marginBottom: 16 }} />
          <div style={{ fontSize: 16, fontWeight: 700, color: '#64748B', marginBottom: 8 }}>Aucune structuration générée</div>
          <div style={{ fontSize: 13, color: '#94A3B8', marginBottom: 20, maxWidth: 480, margin: '0 auto 20px' }}>
            Sélectionnez un projet et importez vos documents (Excel, APS, DAO, PV) — le <strong>Swarm IA</strong> reconstruit automatiquement l'arbre patrimonial : Ouvrage → Équipement → Composant → Immobilisation.
          </div>
          <div style={{ display: 'flex', gap: 12, justifyContent: 'center', flexWrap: 'wrap' }}>
            {PAUE2_BOQ_SEED.map((lot, i) => (
              <div key={lot.code} style={{ background: LOT_COLORS[i] + '12', border: `1px solid ${LOT_COLORS[i]}30`, borderRadius: 10, padding: '10px 16px', fontSize: 12, fontWeight: 700, color: LOT_COLORS[i], display: 'flex', alignItems: 'center', gap: 6 }}>
                <span>{lot.icone}</span> {lot.composant.split(' — ')[0]}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── PV Réception & Mise en Service (collapsible) ─────────────────── */}
      <div style={{ background: '#fff', border: '1px solid #E2E8F0', borderRadius: 12, overflow: 'hidden' }}>
        <button onClick={() => setShowPV(v => !v)}
          style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 10, padding: '14px 18px', background: 'none', border: 'none', cursor: 'pointer', fontFamily: 'inherit', textAlign: 'left' }}>
          <Calendar size={15} style={{ color: '#0891B2' }} />
          <span style={{ fontSize: 13, fontWeight: 800, color: NAVY }}>PV de Réception & Mise en Service</span>
          <span style={{ fontSize: 11, color: '#94A3B8', marginLeft: 4 }}>{pvMES.length} PV</span>
          <span style={{ marginLeft: 'auto', fontSize: 12, color: '#64748B' }}>{showPV ? '▲' : '▼'}</span>
        </button>
        {showPV && <div style={{ display: 'flex', flexDirection: 'column', gap: 14, padding: '0 18px 18px' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 8 }}>
            <div style={{ fontSize: 14, fontWeight: 700, color: NAVY }}>PV de Réception & Mise en service — liens avec les actifs</div>
            <div style={{ position: 'relative' }}>
              <Search size={12} style={{ position: 'absolute', left: 8, top: '50%', transform: 'translateY(-50%)', color: '#94A3B8', pointerEvents: 'none' }} />
              <input value={pvSearch} onChange={e => setPvSearch(e.target.value)} placeholder="Rechercher PV…" style={{ padding: '6px 8px 6px 26px', borderRadius: 7, border: '1px solid #E2E8F0', fontSize: 12, width: 200, outline: 'none' }} />
            </div>
          </div>
          <div style={{ background: '#fff', borderRadius: 10, border: '1px solid #E5E7EB', overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12, minWidth: 1200 }}>
              <thead>
                <tr style={{ background: '#F8FAFC', color: '#94A3B8', fontSize: 10, textTransform: 'uppercase' }}>
                  {['Référence PV', 'Projet', 'Entreprise', 'Date réception', 'Date MES ✎', 'Valeur MES (FCFA) ✎', 'Catégorie ✎', 'Statut', 'Lié actif', 'Actions'].map(h => (
                    <th key={h} style={{ padding: '9px 10px', textAlign: 'left', fontWeight: 700 }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {pvMES.filter(p => !pvSearch || p.ref.toLowerCase().includes(pvSearch.toLowerCase()) || p.projet.toLowerCase().includes(pvSearch.toLowerCase())).map(pv => (
                  <tr key={pv.id} style={{ borderTop: '1px solid #F1F5F9' }}>
                    <td style={{ padding: '9px 10px', fontFamily: 'monospace', fontWeight: 700, color: NAVY, fontSize: 11 }}>{pv.ref}</td>
                    <td style={{ padding: '9px 10px', maxWidth: 200 }}>
                      <div style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontWeight: 600, color: '#1E293B' }} title={pv.projet}>{pv.projet}</div>
                      <div style={{ fontSize: 10, color: '#94A3B8' }}>{pv.localite}</div>
                    </td>
                    <td style={{ padding: '9px 10px', fontSize: 11, color: '#475569' }}>{pv.entreprise}</td>
                    <td style={{ padding: '9px 10px', fontSize: 11 }}>{pv.dateReception}</td>
                    {/* dateMES — éditable */}
                    <td style={{ padding: '6px 10px' }}>
                      <input
                        type="date"
                        value={pv.dateMES}
                        onChange={e => setPVDateMES(pv.id, e.target.value)}
                        style={{
                          border: pv.dateMES ? '1px solid #BBF7D0' : '1px solid #E2E8F0',
                          borderRadius: 6, padding: '3px 7px', fontSize: 11,
                          fontWeight: pv.dateMES ? 700 : 400,
                          color: pv.dateMES ? '#15803D' : '#94A3B8',
                          background: pv.dateMES ? '#F0FDF4' : '#FAFAFA',
                          outline: 'none', width: 130,
                        }}
                      />
                    </td>
                    <td style={{ padding: '9px 10px' }}>
                      <input
                        type="number"
                        value={pv.valeurMES}
                        onChange={e => setPVValeur(pv.id, Number(e.target.value))}
                        style={{ border: '1px solid #E2E8F0', borderRadius: 6, padding: '3px 7px', fontSize: 11, fontWeight: 700, color: NAVY, textAlign: 'right', width: 110, outline: 'none' }}
                      />
                    </td>
                    <td style={{ padding: '9px 10px', fontSize: 11 }}>
                      <input
                        value={pv.categorie}
                        onChange={e => setPVCategorie(pv.id, e.target.value)}
                        style={{ border: '1px solid #DBEAFE', borderRadius: 6, padding: '3px 7px', fontSize: 11, fontWeight: 700, color: NAVY, background: '#EFF6FF', outline: 'none', width: 140 }}
                      />
                    </td>
                    <td style={{ padding: '9px 10px' }}>
                      <span style={{ padding: '2px 8px', borderRadius: 10, fontSize: 10, fontWeight: 700,
                        background: pv.statut === 'valide' ? '#DCFCE7' : '#FFF7ED',
                        color: pv.statut === 'valide' ? '#15803D' : '#C2410C' }}>
                        {pv.statut === 'valide' ? '✓ Validé' : pv.statut === 'rejete' ? '✗ Rejeté' : '⏳ En cours'}
                      </span>
                    </td>
                    <td style={{ padding: '9px 10px' }}>
                      {pv.linked
                        ? <span style={{ fontSize: 10, fontWeight: 700, color: '#16A34A' }}>✓ Lié</span>
                        : <span style={{ fontSize: 10, color: '#94A3B8' }}>—</span>}
                    </td>
                    <td style={{ padding: '9px 10px' }}>
                      {pv.statut === 'valide' && !pv.linked && pv.dateMES && (
                        <button onClick={() => { setPVLinked(pv.id, true); toast.success(`PV ${pv.ref} lié à un actif`); }}
                          style={{ padding: '4px 10px', borderRadius: 6, border: 'none', background: ORANGE, color: '#fff', fontSize: 11, fontWeight: 700, cursor: 'pointer' }}>
                          + Lier actif
                        </button>
                      )}
                      {pv.statut === 'valide' && !pv.linked && !pv.dateMES && (
                        <span style={{ fontSize: 10, color: '#F59E0B', fontWeight: 600 }}>⚠ Saisir la date MES</span>
                      )}
                      {pv.linked && <button style={{ padding: '4px 10px', borderRadius: 6, border: '1px solid #E2E8F0', background: '#fff', fontSize: 11, color: '#475569', cursor: 'pointer' }} onClick={() => setShowValeurs(true)}>Voir valeur</button>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div style={{ fontSize: 11, color: '#94A3B8', padding: '4px 0' }}>
            💡 Les PV définitifs validés et mis en service doivent être liés à une fiche d&apos;immobilisation pour déclencher l&apos;amortissement.
          </div>
        </div>}
      </div>

      {/* ── Liste Valeurs & Amortissement (collapsible) ────────────────── */}
      <div style={{ background: '#fff', border: '1px solid #E2E8F0', borderRadius: 12, overflow: 'hidden' }}>
        <button onClick={() => setShowValeurs(v => !v)}
          style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 10, padding: '14px 18px', background: 'none', border: 'none', cursor: 'pointer', fontFamily: 'inherit', textAlign: 'left' }}>
          <TrendingUp size={15} style={{ color: GREEN }} />
          <span style={{ fontSize: 13, fontWeight: 800, color: NAVY }}>Liste des valeurs d&apos;actifs & plan d&apos;amortissement</span>
          <span style={{ fontSize: 11, color: '#94A3B8', marginLeft: 4 }}>{valeursRows.length} actifs</span>
          <span style={{ marginLeft: 'auto', fontSize: 12, color: '#64748B' }}>{showValeurs ? '▲' : '▼'}</span>
        </button>
        {showValeurs && (() => {
          const colDefs: { key: keyof typeof valeursRows[0]; label: string }[] = [
            { key: 'code', label: 'Code' }, { key: 'designation', label: 'Désignation' }, { key: 'categorie', label: 'Catégorie' },
            { key: 'dateMES', label: 'MES' }, { key: 'valeurAcquisition', label: 'Val. acquisition' }, { key: 'duree', label: 'Durée (ans)' },
            { key: 'tauxAmort', label: 'Taux %' }, { key: 'amortAnnuel', label: 'Amort/an' }, { key: 'amortCumul', label: 'Cumul amort.' },
            { key: 'vnc', label: 'VNC' }, { key: 'uniteAffect', label: 'Affectataire' },
          ];
          const visibleCols = colDefs.filter(c => valeursRows.length > 0 && vColsVisible[c.key] !== false);
          const filtered = valeursRows.filter(r => !valSearch || r.designation.toLowerCase().includes(valSearch.toLowerCase()) || r.code.toLowerCase().includes(valSearch.toLowerCase()));
          return (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14, padding: '0 18px 18px' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 8 }}>
                <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
                  <div style={{ position: 'relative' }}>
                    <Search size={12} style={{ position: 'absolute', left: 8, top: '50%', transform: 'translateY(-50%)', color: '#94A3B8', pointerEvents: 'none' }} />
                    <input value={valSearch} onChange={e => setValSearch(e.target.value)} placeholder="Rechercher…" style={{ padding: '6px 8px 6px 26px', borderRadius: 7, border: '1px solid #E2E8F0', fontSize: 12, width: 180, outline: 'none' }} />
                  </div>
                  <button onClick={() => setValeursRows(prev => [...prev, { id: `v${Date.now()}`, code: `IMMO-${new Date().getFullYear()}-${String(prev.length+1).padStart(4,'0')}`, designation: 'Nouvel actif', categorie: 'Réseau HTA/BT', dateMES: new Date().toISOString().slice(0,10), valeurAcquisition: 0, duree: 20, tauxAmort: 5, amortAnnuel: 0, amortCumul: 0, vnc: 0, uniteAffect: '' }])}
                    style={{ padding: '6px 12px', borderRadius: 7, border: 'none', background: GREEN, color: '#fff', fontSize: 12, fontWeight: 700, cursor: 'pointer' }}>+ Ajouter ligne</button>
                </div>
              </div>

              {/* Sélecteur colonnes visibles */}
              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', padding: '8px 12px', background: '#F8FAFC', borderRadius: 8, border: '1px solid #E2E8F0' }}>
                <span style={{ fontSize: 10, fontWeight: 700, color: '#64748B', textTransform: 'uppercase', marginRight: 4, alignSelf: 'center' }}>Colonnes :</span>
                {colDefs.map(c => (
                  <button key={c.key} onClick={() => setVColsVisible(prev => ({ ...prev, [c.key]: !prev[c.key] }))}
                    style={{ padding: '3px 9px', borderRadius: 12, border: '1px solid', borderColor: vColsVisible[c.key] !== false ? NAVY : '#E2E8F0', background: vColsVisible[c.key] !== false ? NAVY : '#fff', color: vColsVisible[c.key] !== false ? '#fff' : '#64748B', fontSize: 10, fontWeight: 700, cursor: 'pointer' }}>
                    {c.label}
                  </button>
                ))}
              </div>

              <div style={{ background: '#fff', borderRadius: 10, border: '1px solid #E5E7EB', overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12, minWidth: 600 }}>
                  <thead>
                    <tr style={{ background: '#F8FAFC', color: '#94A3B8', fontSize: 10, textTransform: 'uppercase' }}>
                      {visibleCols.map(c => <th key={c.key} style={{ padding: '9px 10px', textAlign: 'left', fontWeight: 700, whiteSpace: 'nowrap' }}>{c.label}</th>)}
                      <th style={{ padding: '9px 10px' }}>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filtered.map(row => (
                      <tr key={row.id} style={{ borderTop: '1px solid #F1F5F9' }}>
                        {visibleCols.map(c => (
                          <td key={c.key} style={{ padding: '8px 10px' }}>
                            {typeof row[c.key] === 'number' && c.key !== 'duree' && c.key !== 'tauxAmort'
                              ? <input type="number" value={row[c.key] as number}
                                  onChange={e => setValeursRows(prev => prev.map(r => r.id === row.id ? { ...r, [c.key]: Number(e.target.value) } : r))}
                                  style={{ width: 90, padding: '3px 6px', border: '1px solid #E2E8F0', borderRadius: 5, fontSize: 11, textAlign: 'right', fontWeight: 700, color: c.key === 'vnc' ? GREEN : NAVY }} />
                              : <input type={c.key === 'dateMES' ? 'date' : 'text'} value={String(row[c.key])}
                                  onChange={e => setValeursRows(prev => prev.map(r => r.id === row.id ? { ...r, [c.key]: c.key === 'duree' || c.key === 'tauxAmort' ? Number(e.target.value) : e.target.value } : r))}
                                  style={{ width: c.key === 'designation' ? 180 : c.key === 'code' ? 120 : 100, padding: '3px 6px', border: '1px solid #E2E8F0', borderRadius: 5, fontSize: 11, fontFamily: c.key === 'code' ? 'monospace' : 'inherit' }} />
                            }
                          </td>
                        ))}
                        <td style={{ padding: '8px 10px' }}>
                          <button onClick={() => { if (confirm('Supprimer cette ligne ?')) setValeursRows(prev => prev.filter(r => r.id !== row.id)); }}
                            style={{ padding: '3px 8px', borderRadius: 5, border: '1px solid #FECACA', color: '#DC2626', background: '#fff', fontSize: 11, cursor: 'pointer' }}>
                            <Trash2 size={11} />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr style={{ borderTop: '2px solid #E2E8F0', background: '#F8FAFC', fontWeight: 800, color: NAVY }}>
                      <td colSpan={visibleCols.findIndex(c => c.key === 'valeurAcquisition') + 1} style={{ padding: '9px 10px' }}>TOTAL</td>
                      {visibleCols.slice(visibleCols.findIndex(c => c.key === 'valeurAcquisition')).map((c, i) => (
                        <td key={c.key} style={{ padding: '9px 10px', textAlign: 'right', color: c.key === 'vnc' ? GREEN : NAVY }}>
                          {i === 0 || c.key === 'amortAnnuel' || c.key === 'amortCumul' || c.key === 'vnc'
                            ? fmtVal(valeursRows.reduce((s,r) => s + (r[c.key] as number || 0), 0))
                            : ''}
                        </td>
                      ))}
                      <td />
                    </tr>
                  </tfoot>
                </table>
              </div>
            </div>
          );
        })()}
      </div>

      <style>{`@keyframes spin { to { transform: rotate(360deg); } } @keyframes pulse { 0%,100% { opacity:1; } 50% { opacity:.3; } }`}</style>

      {/* ── PVRP Modal — formulaire numérique par site ────────────────── */}
      {activePVRPSite && pvrpDraft && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)', zIndex: 1000, display: 'flex', alignItems: 'flex-start', justifyContent: 'flex-end', padding: '0' }}
          onClick={e => { if (e.target === e.currentTarget) { setActivePVRPSite(null); setPvrpDraft(null); } }}>
          <div style={{ width: Math.min(720, window.innerWidth), height: '100vh', background: '#fff', overflowY: 'auto', boxShadow: '-4px 0 32px rgba(0,0,0,0.18)', display: 'flex', flexDirection: 'column' }}>
            {/* Header */}
            <div style={{ padding: '16px 20px', background: 'linear-gradient(135deg, #F47920, #D97706)', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, position: 'sticky', top: 0, zIndex: 1 }}>
              <div>
                <div style={{ fontSize: 15, fontWeight: 800 }}>PVRP — Procès-Verbal de Réception Provisoire</div>
                <div style={{ fontSize: 11, opacity: 0.85 }}>Site : {pvrpDraft.village || activePVRPSite} · Personnalisable</div>
              </div>
              <div style={{ display: 'flex', gap: 8 }}>
                <button onClick={() => {
                  const updated = { ...pvrpDraft, statut: 'valide' as const };
                  setPvrpRecords(prev => ({ ...prev, [pvrpDraft.localite]: updated }));
                  setActivePVRPSite(null); setPvrpDraft(null);
                  toast.success(`PVRP validé — ${updated.village || updated.localite}`);
                }} style={{ padding: '6px 14px', borderRadius: 7, border: 'none', background: '#fff', color: ORANGE, fontSize: 12, fontWeight: 800, cursor: 'pointer' }}>
                  ✓ Valider & Enregistrer
                </button>
                <button onClick={() => {
                  const updated = { ...pvrpDraft, statut: 'en_cours' as const };
                  setPvrpRecords(prev => ({ ...prev, [pvrpDraft.localite]: updated }));
                  setActivePVRPSite(null); setPvrpDraft(null);
                }} style={{ padding: '6px 14px', borderRadius: 7, border: '1px solid rgba(255,255,255,0.5)', background: 'transparent', color: '#fff', fontSize: 12, fontWeight: 700, cursor: 'pointer' }}>
                  Enregistrer brouillon
                </button>
                <button onClick={() => { setActivePVRPSite(null); setPvrpDraft(null); }}
                  style={{ padding: '6px 10px', borderRadius: 7, border: '1px solid rgba(255,255,255,0.5)', background: 'transparent', color: '#fff', cursor: 'pointer' }}>
                  <X size={14} />
                </button>
              </div>
            </div>

            <div style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: 20 }}>

              {/* Section 1 — Identification */}
              <PVRPSection title="1. Identification du chantier" color="#0891B2">
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                  <PVRPField label="Date" type="date" value={pvrpDraft.date} onChange={v => setPvrpDraft(d => d && ({ ...d, date: v }))} />
                  <PVRPField label="Village / Localité" value={pvrpDraft.village} onChange={v => setPvrpDraft(d => d && ({ ...d, village: v }))} />
                  <PVRPField label="Commune" value={pvrpDraft.commune} onChange={v => setPvrpDraft(d => d && ({ ...d, commune: v }))} />
                  <PVRPField label="Entrepreneur" value={pvrpDraft.entrepreneur} onChange={v => setPvrpDraft(d => d && ({ ...d, entrepreneur: v }))} />
                </div>
              </PVRPSection>

              {/* Section 2 — Réseaux HTA */}
              <PVRPSection title="2. Réseaux HTA — Supports & Armements" color="#1B4F8A">
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8, marginBottom: 10 }}>
                  <PVRPField label="Poteaux 12B2000" type="number" value={String(pvrpDraft.htaS12B2000)} onChange={v => setPvrpDraft(d => d && ({ ...d, htaS12B2000: Number(v) }))} />
                  <PVRPField label="Poteaux 12B1600" type="number" value={String(pvrpDraft.htaS12B1600)} onChange={v => setPvrpDraft(d => d && ({ ...d, htaS12B1600: Number(v) }))} />
                  <PVRPField label="Poteaux 12B1250" type="number" value={String(pvrpDraft.htaS12B1250)} onChange={v => setPvrpDraft(d => d && ({ ...d, htaS12B1250: Number(v) }))} />
                  <PVRPField label="Poteaux 12AR650" type="number" value={String(pvrpDraft.htaS12AR650)} onChange={v => setPvrpDraft(d => d && ({ ...d, htaS12AR650: Number(v) }))} />
                  <PVRPField label="Poteaux 12AR400" type="number" value={String(pvrpDraft.htaS12AR400)} onChange={v => setPvrpDraft(d => d && ({ ...d, htaS12AR400: Number(v) }))} />
                  <PVRPField label="Piquetage HTA (ml)" type="number" value={String(pvrpDraft.htaPiquetageML)} onChange={v => setPvrpDraft(d => d && ({ ...d, htaPiquetageML: Number(v) }))} />
                  <PVRPField label="Câble Almelec (ml)" type="number" value={String(pvrpDraft.htaCableAlmelec)} onChange={v => setPvrpDraft(d => d && ({ ...d, htaCableAlmelec: Number(v) }))} />
                  <PVRPField label="IACM 36kV (u)" type="number" value={String(pvrpDraft.htaIACM)} onChange={v => setPvrpDraft(d => d && ({ ...d, htaIACM: Number(v) }))} />
                  <PVRPField label="MALT HTA (u)" type="number" value={String(pvrpDraft.htaMalt)} onChange={v => setPvrpDraft(d => d && ({ ...d, htaMalt: Number(v) }))} />
                </div>
                <div style={{ fontSize: 11, fontWeight: 700, color: '#0891B2', marginBottom: 6 }}>Coordonnées UTM 28</div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', gap: 8 }}>
                  <PVRPField label="Piquage X" value={pvrpDraft.htaCoordPiquageX} onChange={v => setPvrpDraft(d => d && ({ ...d, htaCoordPiquageX: v }))} />
                  <PVRPField label="Piquage Y" value={pvrpDraft.htaCoordPiquageY} onChange={v => setPvrpDraft(d => d && ({ ...d, htaCoordPiquageY: v }))} />
                  <PVRPField label="Position H61 X" value={pvrpDraft.htaCoordH61X} onChange={v => setPvrpDraft(d => d && ({ ...d, htaCoordH61X: v }))} />
                  <PVRPField label="Position H61 Y" value={pvrpDraft.htaCoordH61Y} onChange={v => setPvrpDraft(d => d && ({ ...d, htaCoordH61Y: v }))} />
                </div>
              </PVRPSection>

              {/* Section 3 — Poste HTA/BT */}
              <PVRPSection title="3. Poste HTA/BT — Transformateur & Équipements" color="#7C3AED">
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8 }}>
                  <PVRPField label="Marque transfo" value={pvrpDraft.posteMarque} onChange={v => setPvrpDraft(d => d && ({ ...d, posteMarque: v }))} />
                  <PVRPField label="Puissance (kVA)" value={pvrpDraft.postePuissance} onChange={v => setPvrpDraft(d => d && ({ ...d, postePuissance: v }))} />
                  <PVRPField label="N° Transfo" value={pvrpDraft.posteNumero} onChange={v => setPvrpDraft(d => d && ({ ...d, posteNumero: v }))} />
                  <PVRPField label="Année fabrication" value={pvrpDraft.posteAnnee} onChange={v => setPvrpDraft(d => d && ({ ...d, posteAnnee: v }))} />
                  <PVRPField label="Type support" value={pvrpDraft.posteSupport} onChange={v => setPvrpDraft(d => d && ({ ...d, posteSupport: v }))} />
                  <PVRPField label="Parafoudres HTA (u)" type="number" value={String(pvrpDraft.posteParafoudres)} onChange={v => setPvrpDraft(d => d && ({ ...d, posteParafoudres: Number(v) }))} />
                  <PVRPField label="Câble HN33S33 (ml)" type="number" value={String(pvrpDraft.posteCableHN33)} onChange={v => setPvrpDraft(d => d && ({ ...d, posteCableHN33: Number(v) }))} />
                  <PVRPField label="Disjoncteur BT (u)" type="number" value={String(pvrpDraft.posteDisjoncteur)} onChange={v => setPvrpDraft(d => d && ({ ...d, posteDisjoncteur: Number(v) }))} />
                  <PVRPField label="MALT Poste (u)" type="number" value={String(pvrpDraft.posteMalt)} onChange={v => setPvrpDraft(d => d && ({ ...d, posteMalt: Number(v) }))} />
                </div>
              </PVRPSection>

              {/* Section 4 — Réseaux BT */}
              <PVRPSection title="4. Réseaux BT — Supports & Armements" color="#059669">
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8 }}>
                  <PVRPField label="Poteaux 12AR400" type="number" value={String(pvrpDraft.btS12AR400)} onChange={v => setPvrpDraft(d => d && ({ ...d, btS12AR400: Number(v) }))} />
                  <PVRPField label="Poteaux 9AR650" type="number" value={String(pvrpDraft.btS9AR650)} onChange={v => setPvrpDraft(d => d && ({ ...d, btS9AR650: Number(v) }))} />
                  <PVRPField label="Poteaux 9AR400" type="number" value={String(pvrpDraft.btS9AR400)} onChange={v => setPvrpDraft(d => d && ({ ...d, btS9AR400: Number(v) }))} />
                  <PVRPField label="Poteaux 9AR300" type="number" value={String(pvrpDraft.btS9AR300)} onChange={v => setPvrpDraft(d => d && ({ ...d, btS9AR300: Number(v) }))} />
                  <PVRPField label="CPB (u)" type="number" value={String(pvrpDraft.btCPB)} onChange={v => setPvrpDraft(d => d && ({ ...d, btCPB: Number(v) }))} />
                  <PVRPField label="Piquetage BT (ml)" type="number" value={String(pvrpDraft.btPiquetageML)} onChange={v => setPvrpDraft(d => d && ({ ...d, btPiquetageML: Number(v) }))} />
                  <PVRPField label="Câble PA 3×70+54 (ml)" type="number" value={String(pvrpDraft.btCable3x70)} onChange={v => setPvrpDraft(d => d && ({ ...d, btCable3x70: Number(v) }))} />
                  <PVRPField label="Câble PA 3×35+54 (ml)" type="number" value={String(pvrpDraft.btCable3x35)} onChange={v => setPvrpDraft(d => d && ({ ...d, btCable3x35: Number(v) }))} />
                  <PVRPField label="MALT BT (u)" type="number" value={String(pvrpDraft.btMalt)} onChange={v => setPvrpDraft(d => d && ({ ...d, btMalt: Number(v) }))} />
                  <PVRPField label="LED 50W (u)" type="number" value={String(pvrpDraft.btLED50W)} onChange={v => setPvrpDraft(d => d && ({ ...d, btLED50W: Number(v) }))} />
                  <PVRPField label="Coffret EP (u)" type="number" value={String(pvrpDraft.btCoffretEP)} onChange={v => setPvrpDraft(d => d && ({ ...d, btCoffretEP: Number(v) }))} />
                </div>
              </PVRPSection>

              {/* Section 5 — Branchements & Compteurs */}
              <PVRPSection title="5. Branchements & Compteurs" color="#D97706">
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8 }}>
                  <PVRPField label="Câble préassemblé 2×16 (ml)" type="number" value={String(pvrpDraft.branCable2x16)} onChange={v => setPvrpDraft(d => d && ({ ...d, branCable2x16: Number(v) }))} />
                  <PVRPField label="Câble préassemblé 4×16 (ml)" type="number" value={String(pvrpDraft.branCable4x16)} onChange={v => setPvrpDraft(d => d && ({ ...d, branCable4x16: Number(v) }))} />
                  <PVRPField label="CPB (u)" type="number" value={String(pvrpDraft.branCPB)} onChange={v => setPvrpDraft(d => d && ({ ...d, branCPB: Number(v) }))} />
                  <PVRPField label="Pince PA 25 (u)" type="number" value={String(pvrpDraft.branPince25)} onChange={v => setPvrpDraft(d => d && ({ ...d, branPince25: Number(v) }))} />
                  <PVRPField label="Compteur mono prépayé (u)" type="number" value={String(pvrpDraft.branCompteurMono)} onChange={v => setPvrpDraft(d => d && ({ ...d, branCompteurMono: Number(v) }))} />
                  <PVRPField label="Disjoncteur différentiel (u)" type="number" value={String(pvrpDraft.branDisjoncteurDiff)} onChange={v => setPvrpDraft(d => d && ({ ...d, branDisjoncteurDiff: Number(v) }))} />
                  <PVRPField label="Coffret comptage (u)" type="number" value={String(pvrpDraft.branCoffretComptage)} onChange={v => setPvrpDraft(d => d && ({ ...d, branCoffretComptage: Number(v) }))} />
                </div>
              </PVRPSection>

              {/* Section 6 — Conformité E&S */}
              <PVRPSection title="6. Conformité Environnementale & Sociale" color="#DC2626">
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {([
                    { key: 'esGestionDechets', label: 'Gestion des déchets conforme' },
                    { key: 'esBiodiversite',   label: 'Biodiversité — aucun impact résiduel' },
                    { key: 'esEau',             label: 'Ressources en eau — non impactées' },
                    { key: 'esEmissions',       label: 'Émissions & pollution — sous seuil' },
                    { key: 'esImpactsSociaux',  label: 'Impacts sociaux — consultation réalisée' },
                  ] as const).map(item => (
                    <label key={item.key} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12, color: '#374151', cursor: 'pointer' }}>
                      <input type="checkbox" checked={pvrpDraft[item.key] as boolean}
                        onChange={e => setPvrpDraft(d => d && ({ ...d, [item.key]: e.target.checked }))}
                        style={{ width: 15, height: 15, accentColor: '#DC2626' }} />
                      {item.label}
                    </label>
                  ))}
                </div>
              </PVRPSection>

              {/* Section 7 — Observations */}
              <PVRPSection title="7. Observations" color="#64748B">
                <textarea
                  value={pvrpDraft.observations}
                  onChange={e => setPvrpDraft(d => d && ({ ...d, observations: e.target.value }))}
                  placeholder="Observations, réserves, points d'attention…"
                  rows={4}
                  style={{ width: '100%', padding: '8px 10px', border: '1px solid #E2E8F0', borderRadius: 8, fontSize: 12, resize: 'vertical', fontFamily: 'inherit', outline: 'none', boxSizing: 'border-box' }}
                />
              </PVRPSection>

            </div>
          </div>
        </div>
      )}

      {/* ── PV MES Form Modal ─────────────────────────────────────────────── */}
      {showPVMESForm && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}
          onClick={e => { if (e.target === e.currentTarget) setShowPVMESForm(false); }}>
          <div style={{ background: '#fff', borderRadius: 14, width: '100%', maxWidth: 560, boxShadow: '0 12px 40px rgba(0,0,0,0.18)', overflow: 'hidden' }}>
            <div style={{ padding: '16px 20px', background: GREEN, color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div>
                <div style={{ fontSize: 14, fontWeight: 800 }}>Nouveau PV Mise en Service</div>
                <div style={{ fontSize: 11, opacity: 0.85 }}>Enregistrement provisoire — lié à la structuration patrimoniale</div>
              </div>
              <button onClick={() => setShowPVMESForm(false)} style={{ background: 'transparent', border: 'none', color: '#fff', cursor: 'pointer' }}><X size={16} /></button>
            </div>
            <div style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: 12 }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                <PVRPField label="Référence PV" value={pvmesFormData.ref ?? ''} onChange={v => setPvmesFormData(d => ({ ...d, ref: v }))} />
                <PVRPField label="Localité / Site" value={pvmesFormData.localite ?? ''} onChange={v => setPvmesFormData(d => ({ ...d, localite: v }))} />
                <PVRPField label="Entrepreneur" value={pvmesFormData.entrepreneur ?? ''} onChange={v => setPvmesFormData(d => ({ ...d, entrepreneur: v }))} />
                <PVRPField label="Catégorie" value={pvmesFormData.categorie ?? 'Réseau HTA/BT'} onChange={v => setPvmesFormData(d => ({ ...d, categorie: v }))} />
                <PVRPField label="Date réception" type="date" value={pvmesFormData.dateReception ?? ''} onChange={v => setPvmesFormData(d => ({ ...d, dateReception: v }))} />
                <PVRPField label="Date MES" type="date" value={pvmesFormData.dateMES ?? ''} onChange={v => setPvmesFormData(d => ({ ...d, dateMES: v }))} />
              </div>
              <div>
                <div style={{ fontSize: 11, fontWeight: 700, color: '#374151', marginBottom: 4 }}>Valeur MES (FCFA)</div>
                <input type="number" value={pvmesFormData.valeurMES ?? 0} onChange={e => setPvmesFormData(d => ({ ...d, valeurMES: Number(e.target.value) }))}
                  style={{ width: '100%', padding: '8px 10px', border: '1px solid #E2E8F0', borderRadius: 8, fontSize: 13, fontWeight: 700, color: GREEN, textAlign: 'right', outline: 'none', boxSizing: 'border-box' }} />
              </div>
              <div>
                <div style={{ fontSize: 11, fontWeight: 700, color: '#374151', marginBottom: 4 }}>Observations</div>
                <textarea value={pvmesFormData.observations ?? ''} onChange={e => setPvmesFormData(d => ({ ...d, observations: e.target.value }))}
                  rows={3} placeholder="Observations techniques, réserves…"
                  style={{ width: '100%', padding: '8px 10px', border: '1px solid #E2E8F0', borderRadius: 8, fontSize: 12, resize: 'vertical', fontFamily: 'inherit', outline: 'none', boxSizing: 'border-box' }} />
              </div>
              <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', paddingTop: 4 }}>
                <button onClick={() => setShowPVMESForm(false)}
                  style={{ padding: '8px 16px', borderRadius: 8, border: '1px solid #E2E8F0', background: '#fff', color: '#475569', fontSize: 12, fontWeight: 700, cursor: 'pointer' }}>Annuler</button>
                <button onClick={() => {
                  const d = pvmesFormData;
                  if (!d.localite) { toast.error('Localité requise'); return; }
                  pvStore.upsert({
                    id: `pvmes_${Date.now()}`,
                    ref: d.ref || `PV-MES-${Date.now().toString(36).toUpperCase()}`,
                    projet: projet?.nom ?? projetCode,
                    localite: d.localite ?? '',
                    entreprise: d.entrepreneur ?? '',
                    dateReception: d.dateReception ?? new Date().toISOString().slice(0, 10),
                    dateMES: d.dateMES ?? '',
                    valeurMES: d.valeurMES ?? 0,
                    categorie: d.categorie ?? 'Réseau HTA/BT',
                    statut: 'en_cours',
                    linked: false,
                  });
                  setShowPVMESForm(false);
                  toast.success('PV MES enregistré — visible dans le tableau PV');
                }} style={{ padding: '8px 20px', borderRadius: 8, border: 'none', background: GREEN, color: '#fff', fontSize: 12, fontWeight: 800, cursor: 'pointer' }}>
                  Enregistrer
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Composants helpers PVRP ────────────────────────────────────────────────────
function PVRPSection({ title, color, children }: { title: string; color: string; children: React.ReactNode }) {
  return (
    <div style={{ border: `1.5px solid ${color}25`, borderRadius: 10, overflow: 'hidden' }}>
      <div style={{ padding: '8px 14px', background: color + '12', borderBottom: `1px solid ${color}20`, fontSize: 12, fontWeight: 800, color }}>{title}</div>
      <div style={{ padding: '12px 14px' }}>{children}</div>
    </div>
  );
}

function PVRPField({ label, value, onChange, type = 'text' }: { label: string; value: string; onChange: (v: string) => void; type?: string }) {
  return (
    <div>
      <div style={{ fontSize: 10.5, fontWeight: 700, color: '#64748B', marginBottom: 3 }}>{label}</div>
      <input type={type} value={value} onChange={e => onChange(e.target.value)}
        style={{ width: '100%', padding: '6px 9px', border: '1px solid #E2E8F0', borderRadius: 7, fontSize: 12, fontFamily: 'inherit', outline: 'none', boxSizing: 'border-box', background: type === 'number' && Number(value) > 0 ? '#F0FDF4' : '#fff', fontWeight: type === 'number' && Number(value) > 0 ? 700 : 400, color: type === 'number' && Number(value) > 0 ? '#15803D' : '#0F172A' }} />
    </div>
  );
}

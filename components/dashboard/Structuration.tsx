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
import { useMemo, useState, useEffect, useRef } from 'react';
import * as XLSX from 'xlsx';
import {
  Boxes, Wand2, ChevronRight, ChevronDown, CheckCircle2,
  Building2, Trash2, FileText, Download, Eye, EyeOff,
  Layers, Package, Wrench, Truck, Zap, RefreshCw, Search, X, Upload,
} from 'lucide-react';
import toast from 'react-hot-toast';
import { useProjectStore } from '@/lib/projectStore';
import { useZonesStore, buildBOQ } from '@/lib/zonesQuantitesStore';
import { useStructurationStore } from '@/lib/structuration/store';
import { structurerDepuisBOQ, type BOQInputRow } from '@/lib/structuration/builder';
import SearchableSelect from '@/components/ui/SearchableSelect';

const fmt  = (n: number) => n.toLocaleString('fr-FR');
const fmtM = (n: number) => n >= 1e9 ? `${(n/1e9).toFixed(2)} Mrd` : n >= 1e6 ? `${(n/1e6).toFixed(1)} M` : fmt(n);

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
const IA_STEPS = [
  { label: 'Lecture du bordereau (BOQ)…',            pct: 15, color: '#1B4F8A' },
  { label: 'Identification des composants majeurs…',  pct: 35, color: '#7C3AED' },
  { label: 'Décomposition Sous-composants…',          pct: 58, color: '#F47920' },
  { label: 'Attribution des articles & codes WBS…',   pct: 78, color: '#D97706' },
  { label: 'Calcul des montants & validation…',       pct: 92, color: '#059669' },
  { label: 'Structuration complète — Human in loop',  pct: 100, color: '#16A34A' },
];

// ─── COMPOSANT PRINCIPAL ───────────────────────────────────────────────────────
export default function Structuration() {
  const store  = useProjectStore();
  const zones  = useZonesStore();
  const struct = useStructurationStore();
  const projets = store.projets;

  const [projetCode, setProjetCode] = useState<string>(projets[0]?.code ?? '');
  const [collapsed, setCollapsed]   = useState<Set<string>>(new Set());
  const [generating, setGenerating] = useState(false);
  const [boqSearch, setBoqSearch]   = useState('');
  const [compSearch, setCompSearch] = useState('');
  const [genStep, setGenStep]       = useState(0);
  const [showBOQ, setShowBOQ]       = useState(false);
  const [importing, setImporting]   = useState(false);
  const importRef = useRef<HTMLInputElement>(null);
  const [activeTab, setActiveTab]   = useState<'boq' | 'pv' | 'valeurs' | 'actifs'>('boq');

  /* ── PV Mise en service (données mock liées aux réceptions) ── */
  const [pvMES, setPvMES] = useState([
    { id: 'pv1', ref: 'PVD-DER-2026-002', projet: 'Électrification Rurale 19 Localités — Thiès', entreprise: 'ELEC AFRIQUE SARL', dateReception: '2026-04-15', dateMES: '2026-05-01', valeurMES: 485_000_000, categorie: 'Réseau HTA/BT', localite: 'Thiès - 19 localités', statut: 'valide' as const, linked: false },
    { id: 'pv2', ref: 'PVD-CPBM-2026-001', projet: 'PASE — Accès électricité zones péri-urbaines', entreprise: 'TRACTEBEL ENGIE', dateReception: '2026-03-22', dateMES: '2026-04-10', valeurMES: 620_000_000, categorie: 'Réseau BT péri-urbain', localite: 'Guédiawaye', statut: 'valide' as const, linked: true },
    { id: 'pv3', ref: 'PVD-DEP-2026-003', projet: 'Réhabilitation Centrale Cap des Biches', entreprise: 'GE POWER AFRICA', dateReception: '2026-02-10', dateMES: '2026-03-01', valeurMES: 715_000_000, categorie: 'Production électrique', localite: 'Dakar — Cap des Biches', statut: 'valide' as const, linked: true },
    { id: 'pv4', ref: 'PVD-DIT-2026-004', projet: 'Déploiement compteurs AMI', entreprise: 'LANDIS+GYR', dateReception: '2026-05-18', dateMES: '', valeurMES: 245_000_000, categorie: 'Comptage / AMI', localite: 'Dakar — Lot 1', statut: 'en_cours' as const, linked: false },
  ]);

  /* ── Valeurs actifs (liste pour suivi patrimonial) ── */
  const [valeursRows, setValeursRows] = useState([
    { id: 'v1', code: 'IMMO-2026-0001', designation: 'Réseau HTA 33kV — 19 localités Thiès', categorie: 'Réseau HTA/BT', dateMES: '2026-05-01', valeurAcquisition: 485_000_000, duree: 30, tauxAmort: 3.33, amortAnnuel: 16_166_667, amortCumul: 1_347_222, vnc: 483_652_778, uniteAffect: 'DER — Thiès' },
    { id: 'v2', code: 'IMMO-2026-0002', designation: 'Réseau BT péri-urbain Guédiawaye', categorie: 'Réseau BT', dateMES: '2026-04-10', valeurAcquisition: 620_000_000, duree: 25, tauxAmort: 4.0, amortAnnuel: 24_800_000, amortCumul: 4_960_000, vnc: 615_040_000, uniteAffect: 'DIT — Dakar' },
    { id: 'v3', code: 'IMMO-2026-0003', designation: 'Turbine TAG-3 Cap des Biches — 50MW', categorie: 'Production', dateMES: '2026-03-01', valeurAcquisition: 715_000_000, duree: 20, tauxAmort: 5.0, amortAnnuel: 35_750_000, amortCumul: 10_725_000, vnc: 704_275_000, uniteAffect: 'DEP — Dakar' },
  ]);
  const [vColsVisible, setVColsVisible] = useState<Record<string,boolean>>({ code: true, designation: true, categorie: true, dateMES: true, valeurAcquisition: true, duree: true, tauxAmort: true, amortAnnuel: true, amortCumul: true, vnc: true, uniteAffect: true });
  const [pvSearch, setPvSearch] = useState('');
  const [valSearch, setValSearch] = useState('');

  const projet  = projets.find(p => p.code === projetCode);

  /* ── Import Excel multi-feuilles SENELEC ───────────────────────────────── */
  function handleImportExcel(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    e.target.value = '';
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

  const toggle = (id: string) => setCollapsed(c => { const n = new Set(c); n.has(id) ? n.delete(id) : n.add(id); return n; });

  // Reset step quand projet change
  useEffect(() => { setGenStep(0); setGenerating(false); }, [projetCode]);

  const generer = () => {
    if (!projet) return;
    setGenerating(true);
    setGenStep(0);

    // Animate through steps
    let step = 0;
    const next = () => {
      step++;
      setGenStep(step);
      if (step < IA_STEPS.length - 1) {
        setTimeout(next, 480 + Math.random() * 320);
      } else {
        // Final: actually generate
        setTimeout(() => {
          const s = structurerDepuisBOQ(boqRows, {
            projetCode: projet.code,
            projetNom:  projet.nom,
            deviseRef:  'CFA',
            source:     zonesBoq.length > 1 ? 'IA (BOQ zones)' : 'IA (Modèle PAUE2)',
          });
          struct.save(s);
          setGenerating(false);
          toast.success(`✅ Structuration PAUE2 générée — ${s.composants.length} composants, ${fmtM(s.total)} FCFA`);
        }, 600);
      }
    };
    setTimeout(next, 380);
  };

  const LOT_COLORS: string[] = ['#1B4F8A', '#7C3AED', '#D97706', '#059669', '#DC2626', '#0891B2'];

  return (
    <div style={{ padding: '20px 24px', display: 'flex', flexDirection: 'column', gap: 18 }}>

      {/* ── Header ──────────────────────────────────────────────────────── */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12 }}>
        <div>
          <h1 style={{ display: 'flex', alignItems: 'center', gap: 8, margin: 0, fontSize: 18, fontWeight: 800, color: NAVY }}>
            <Boxes size={20} style={{ color: ORANGE }} /> Structuration des actifs (IA)
          </h1>
          <p style={{ fontSize: 12.5, color: '#64748B', margin: '4px 0 0' }}>
            Décomposition automatique <strong>Composant → Sous-composant → Article</strong> depuis le bordereau — fini la structuration manuelle dans Excel.
          </p>
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
          <button
            onClick={generer}
            disabled={!projet || generating}
            style={{
              display: 'flex', alignItems: 'center', gap: 7,
              padding: '9px 18px', borderRadius: 9, border: 'none',
              background: generating ? '#94A3B8' : ORANGE,
              color: '#fff', fontSize: 13, fontWeight: 700,
              cursor: (!projet || generating) ? 'not-allowed' : 'pointer',
              transition: 'background 0.15s',
            }}
          >
            {generating
              ? <><RefreshCw size={14} style={{ animation: 'spin 1s linear infinite' }} /> Génération IA…</>
              : <><Wand2 size={15} /> Générer (IA)</>
            }
          </button>
        </div>
      </div>

      {/* ── Onglets ─────────────────────────────────────────────────────── */}
      <div className="tabs">
        {([['boq','📋 BOQ / Bordereau'],['pv','📄 PV Mise en Service'],['valeurs','💰 Liste Valeurs & Amort.'],['actifs','🏗 Structuration Actifs']] as const).map(([t,lbl]) => (
          <button key={t} className={`tab${activeTab === t ? ' active' : ''}`} onClick={() => setActiveTab(t)}>{lbl}</button>
        ))}
      </div>

      {/* ── Onglet BOQ ── */}
      {activeTab === 'boq' && <>

      {/* ── BOQ détecté ─────────────────────────────────────────────────── */}
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
          <button
            onClick={() => setShowBOQ(v => !v)}
            style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '6px 12px', border: '1px solid #E2E8F0', borderRadius: 7, background: '#F8FAFC', cursor: 'pointer', fontSize: 12, color: '#374151', fontFamily: 'inherit' }}>
            {showBOQ ? <><EyeOff size={12} /> Masquer BOQ</> : <><Eye size={12} /> Aperçu BOQ</>}
          </button>
        </div>
      </div>

      {/* ── BOQ Preview ─────────────────────────────────────────────────── */}
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

      {/* ── Animation génération IA ─────────────────────────────────────── */}
      {generating && (
        <div style={{ background: 'linear-gradient(135deg, #0F172A 0%, #1B4F8A 100%)', borderRadius: 14, padding: '24px 28px', color: '#fff' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 20 }}>
            <div style={{ width: 48, height: 48, borderRadius: 12, background: 'rgba(244,121,32,0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
              <Wand2 size={24} style={{ color: ORANGE }} />
            </div>
            <div>
              <div style={{ fontSize: 16, fontWeight: 800, marginBottom: 2 }}>IA — Structuration en cours</div>
              <div style={{ fontSize: 12, opacity: 0.7 }}>Modèle PAUE2 · {articlesCount} articles · {PAUE2_BOQ_SEED.length} lots</div>
            </div>
          </div>
          <div style={{ background: 'rgba(255,255,255,0.08)', borderRadius: 99, height: 6, marginBottom: 16, overflow: 'hidden' }}>
            <div style={{ height: '100%', borderRadius: 99, background: IA_STEPS[genStep]?.color ?? GREEN, width: `${IA_STEPS[genStep]?.pct ?? 0}%`, transition: 'width 0.4s ease, background 0.3s' }} />
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {IA_STEPS.map((s, i) => (
              <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 10, opacity: i > genStep ? 0.3 : 1, transition: 'opacity 0.3s' }}>
                <div style={{ width: 16, height: 16, borderRadius: 99, border: `2px solid ${i < genStep ? GREEN : i === genStep ? s.color : 'rgba(255,255,255,0.2)'}`, background: i < genStep ? GREEN : 'transparent', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                  {i < genStep && <span style={{ fontSize: 8, color: '#fff', lineHeight: 1 }}>✓</span>}
                  {i === genStep && <div style={{ width: 6, height: 6, borderRadius: 99, background: s.color, animation: 'pulse 1s ease-in-out infinite' }} />}
                </div>
                <span style={{ fontSize: 12, fontWeight: i === genStep ? 700 : 400 }}>{s.label}</span>
                {i === genStep && <span style={{ fontSize: 10, color: s.color, marginLeft: 'auto', fontWeight: 700 }}>{s.pct}%</span>}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── Résultat structuration ──────────────────────────────────────── */}
      {current && !generating && (
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
                Aucun composant dans cette structuration. Régénérez via le bouton <strong>Générer la structuration (IA)</strong>.
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
      {!current && !generating && (
        <div style={{ textAlign: 'center', padding: '60px 20px', background: '#fff', borderRadius: 14, border: '1px dashed #CBD5E1' }}>
          <Boxes size={56} style={{ color: '#CBD5E1', marginBottom: 16 }} />
          <div style={{ fontSize: 16, fontWeight: 700, color: '#64748B', marginBottom: 8 }}>Aucune structuration générée</div>
          <div style={{ fontSize: 13, color: '#94A3B8', marginBottom: 20, maxWidth: 480, margin: '0 auto 20px' }}>
            Sélectionnez un projet et cliquez sur <strong>&ldquo;Générer la structuration (IA)&rdquo;</strong> pour décomposer automatiquement le bordereau en arbre d'actifs.
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

      <style>{`@keyframes spin { to { transform: rotate(360deg); } } @keyframes pulse { 0%,100% { opacity:1; } 50% { opacity:.3; } }`}</style>

      </> /* fin onglet BOQ */}

      {/* ── Onglet PV Mise en Service ──────────────────────────────────── */}
      {activeTab === 'pv' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 8 }}>
            <div style={{ fontSize: 14, fontWeight: 700, color: NAVY }}>PV de Réception & Mise en service — liens avec les actifs</div>
            <div style={{ position: 'relative' }}>
              <Search size={12} style={{ position: 'absolute', left: 8, top: '50%', transform: 'translateY(-50%)', color: '#94A3B8', pointerEvents: 'none' }} />
              <input value={pvSearch} onChange={e => setPvSearch(e.target.value)} placeholder="Rechercher PV…" style={{ padding: '6px 8px 6px 26px', borderRadius: 7, border: '1px solid #E2E8F0', fontSize: 12, width: 200, outline: 'none' }} />
            </div>
          </div>
          <div style={{ background: '#fff', borderRadius: 10, border: '1px solid #E5E7EB', overflow: 'hidden' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12, minWidth: 900 }}>
              <thead>
                <tr style={{ background: '#F8FAFC', color: '#94A3B8', fontSize: 10, textTransform: 'uppercase' }}>
                  {['Référence PV', 'Projet', 'Entreprise', 'Date réception', 'Date MES', 'Valeur MES (FCFA)', 'Catégorie', 'Statut', 'Lié actif', 'Actions'].map(h => (
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
                    <td style={{ padding: '9px 10px', fontSize: 11, fontWeight: pv.dateMES ? 600 : 400, color: pv.dateMES ? '#16A34A' : '#94A3B8' }}>{pv.dateMES || '—'}</td>
                    <td style={{ padding: '9px 10px', textAlign: 'right', fontWeight: 700, color: NAVY }}>{(pv.valeurMES/1e6).toFixed(1)} M</td>
                    <td style={{ padding: '9px 10px', fontSize: 11 }}>
                      <span style={{ padding: '2px 7px', borderRadius: 10, background: '#EFF6FF', color: NAVY, fontWeight: 700, fontSize: 10 }}>{pv.categorie}</span>
                    </td>
                    <td style={{ padding: '9px 10px' }}>
                      <span style={{ padding: '2px 8px', borderRadius: 10, fontSize: 10, fontWeight: 700,
                        background: pv.statut === 'valide' ? '#DCFCE7' : '#FFF7ED',
                        color: pv.statut === 'valide' ? '#15803D' : '#C2410C' }}>
                        {pv.statut === 'valide' ? '✓ Validé' : '⏳ En cours'}
                      </span>
                    </td>
                    <td style={{ padding: '9px 10px' }}>
                      {pv.linked
                        ? <span style={{ fontSize: 10, fontWeight: 700, color: '#16A34A' }}>✓ Lié</span>
                        : <span style={{ fontSize: 10, color: '#94A3B8' }}>—</span>}
                    </td>
                    <td style={{ padding: '9px 10px' }}>
                      {pv.statut === 'valide' && !pv.linked && (
                        <button onClick={() => { setPvMES(prev => prev.map(p => p.id === pv.id ? { ...p, linked: true } : p)); toast.success(`PV ${pv.ref} lié à un actif`); }}
                          style={{ padding: '4px 10px', borderRadius: 6, border: 'none', background: ORANGE, color: '#fff', fontSize: 11, fontWeight: 700, cursor: 'pointer' }}>
                          + Lier actif
                        </button>
                      )}
                      {pv.linked && <button style={{ padding: '4px 10px', borderRadius: 6, border: '1px solid #E2E8F0', background: '#fff', fontSize: 11, color: '#475569', cursor: 'pointer' }} onClick={() => setActiveTab('valeurs')}>Voir valeur</button>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div style={{ fontSize: 11, color: '#94A3B8', padding: '4px 0' }}>
            💡 Les PV définitifs validés et mis en service doivent être liés à une fiche d&apos;immobilisation pour déclencher l&apos;amortissement.
          </div>
        </div>
      )}

      {/* ── Onglet Liste Valeurs & Amortissement ───────────────────────── */}
      {activeTab === 'valeurs' && (() => {
        const fmt = (n: number) => n >= 1e6 ? `${(n/1e6).toFixed(1)} M` : n.toLocaleString('fr-FR');
        const colDefs: { key: keyof typeof valeursRows[0]; label: string }[] = [
          { key: 'code', label: 'Code' }, { key: 'designation', label: 'Désignation' }, { key: 'categorie', label: 'Catégorie' },
          { key: 'dateMES', label: 'MES' }, { key: 'valeurAcquisition', label: 'Val. acquisition' }, { key: 'duree', label: 'Durée (ans)' },
          { key: 'tauxAmort', label: 'Taux %' }, { key: 'amortAnnuel', label: 'Amort/an' }, { key: 'amortCumul', label: 'Cumul amort.' },
          { key: 'vnc', label: 'VNC' }, { key: 'uniteAffect', label: 'Affectataire' },
        ];
        const visibleCols = colDefs.filter(c => valeursRows.length > 0 && vColsVisible[c.key] !== false);
        const filtered = valeursRows.filter(r => !valSearch || r.designation.toLowerCase().includes(valSearch.toLowerCase()) || r.code.toLowerCase().includes(valSearch.toLowerCase()));
        return (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 8 }}>
              <div style={{ fontSize: 14, fontWeight: 700, color: NAVY }}>Liste des valeurs d&apos;actifs & plan d&apos;amortissement</div>
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
                          ? fmt(valeursRows.reduce((s,r) => s + (r[c.key] as number || 0), 0))
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

      {/* ── Onglet Structuration Actifs ────────────────────────────────── */}
      {activeTab === 'actifs' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div style={{ fontSize: 14, fontWeight: 700, color: NAVY, marginBottom: 4 }}>Structuration des actifs — Composant → Sous-composant → Article</div>
          <div style={{ padding: 12, background: '#EFF6FF', borderRadius: 8, border: '1px solid #BFDBFE', fontSize: 12, color: '#1E40AF' }}>
            💡 Cliquez sur <strong>« Générer (IA) »</strong> dans le header pour décomposer automatiquement le BOQ du projet sélectionné en arbre d&apos;actifs structuré.
          </div>
          {/* Redirect to BOQ generation */}
          <div style={{ display: 'flex', gap: 10 }}>
            <button onClick={() => setActiveTab('boq')} style={{ padding: '9px 18px', borderRadius: 8, border: 'none', background: ORANGE, color: '#fff', fontWeight: 700, fontSize: 13, cursor: 'pointer' }}>
              <Wand2 size={14} style={{ verticalAlign: 'middle', marginRight: 6 }} />Aller à BOQ &amp; Générer
            </button>
            <button onClick={() => setActiveTab('pv')} style={{ padding: '9px 18px', borderRadius: 8, border: '1px solid #E2E8F0', background: '#fff', color: NAVY, fontWeight: 600, fontSize: 13, cursor: 'pointer' }}>
              📄 Voir les PV mis en service
            </button>
          </div>
        </div>
      )}

      <style>{`@keyframes spin { to { transform: rotate(360deg); } } @keyframes pulse { 0%,100% { opacity:1; } 50% { opacity:.3; } }`}</style>
    </div>
  );
}

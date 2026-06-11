'use client';

import { useState, useMemo, useCallback, useRef, useEffect } from 'react';
import { extractFileText } from '@/lib/docText';
import { extractStructuredFields, isCopilotLinked } from '@/lib/ai/aiEngine';
import { useRouter, useSearchParams } from 'next/navigation';
import {
  CheckCircle2, Clock, AlertTriangle, Circle, ChevronDown,
  Plus, Calendar, Users, Paperclip, BarChart3,
  Wallet, FileText, Flag, Filter, X,
  Play, Pause, Layers, TrendingUp, TrendingDown,
  Building2, UserCheck, Banknote, ArrowUpRight, ArrowDownRight,
  ShieldAlert, FolderOpen, Upload, Download, Eye,
  ChevronRight, Minus, MapPin, Activity, LayoutDashboard,
  GitBranch, History, Pencil, Save, Check, Sliders, Edit3, Printer, RefreshCw, GanttChart, Search,
} from 'lucide-react';
import {
  AreaChart, Area, BarChart, Bar, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, ReferenceLine, PieChart, Pie, Cell, Legend,
} from 'recharts';
import {
  useProjectStore, DOMAINE_CFG, PHASES_DEFAUT, calculerStatutGlobal,
  type Domaine, type TacheWBS, type StatutTache, type Priorite, type Projet, type TypeTache, type DepType,
  type StatutGlobal, type PassationMarches, type ProjetHSE, type ProjetQualite,
} from '@/lib/projectStore';
import { SENELEC_LOGO_DATA_URI } from '@/lib/senelecLogo';
import { useAuth, isOperationalReadOnly } from '@/lib/authStore';
import { readOnlyGuard } from '@/lib/operationalGuard';
import toast from 'react-hot-toast';
import dynamic from 'next/dynamic';
import EditableDataTable from '@/components/ui/EditableDataTable';
import ZonesQuantites from '@/components/dashboard/ZonesQuantites';
import { useTempsStore } from '@/lib/tempsStore';

// Carte SIG réelle (Leaflet) — client uniquement.
const ProjetsCarteLeaflet = dynamic(() => import('@/components/ui/ProjetsCarteLeaflet'), {
  ssr: false,
  loading: () => (
    <div style={{ height: '100%', minHeight: 300, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#94A3B8', fontSize: 13, background: '#0E3460' }}>
      Chargement de la carte SIG…
    </div>
  ),
});

/* ─── Design Tokens ──────────────────────────────────── */
const C = {
  navy:   '#3D1A6B',
  orange: '#F47920',
  red:    '#EF3340',
  green:  '#16A34A',
  amber:  '#D97706',
  purple: '#8B5CF6',
  slate:  '#64748B',
  border: '#E2E8F0',
  bg:     '#F4F3F8',
  surface:'#ffffff',
} as const;

/* ─── Statut & Priorité mappings ─────────────────────── */
type StatutDisplay = { label: string; color: string; bg: string; icon: React.ReactNode };

const STATUT_DISP: Record<StatutTache, StatutDisplay> = {
  termine:  { label: 'Terminé',   color: C.green,  bg: '#DCFCE7', icon: <CheckCircle2 size={11} /> },
  en_cours: { label: 'En cours',  color: C.navy,   bg: '#EFF6FF', icon: <Play         size={11} /> },
  bloque:   { label: 'Bloqué',    color: C.red,    bg: '#FEE2E2', icon: <Pause        size={11} /> },
  a_faire:  { label: 'À faire',   color: C.slate,  bg: '#F1F5F9', icon: <Circle       size={11} /> },
};

const PRIOR_DISP: Record<Priorite, { color: string; label: string }> = {
  Haute:   { color: C.red,   label: 'Haute'  },
  Moyenne: { color: C.amber, label: 'Moy.'   },
  Faible:  { color: '#94A3B8', label: 'Faible' },
};

/* ─── Onglets (spec agencement : 9 onglets fiche projet) ─ */
const ONGLETS = [
  { id: 'fiche-executive', label: 'Fiche Exécutive',   icon: <FileText        size={13} /> },
  { id: 'synthese',        label: 'Synthèse',           icon: <LayoutDashboard size={13} /> },
  { id: 'planning',        label: 'Planning',            icon: <Calendar        size={13} /> },
  { id: 'zones',           label: 'Zones & Quantités',  icon: <Layers          size={13} /> },
  { id: 'couts',           label: 'Coûts',               icon: <Wallet          size={13} /> },
  { id: 'contrat',         label: 'Contrat & Marchés',  icon: <Banknote        size={13} /> },
  { id: 'hse',             label: 'HSE & Qualité',       icon: <ShieldAlert     size={13} /> },
  { id: 'ressources',      label: 'Ressources',           icon: <Users           size={13} /> },
  { id: 'risques',         label: 'Risques',              icon: <Flag            size={13} /> },
  { id: 'documents',       label: 'Documents',            icon: <Paperclip       size={13} /> },
  { id: 'ponderation',     label: 'Pondération',         icon: <Filter          size={13} /> },
  { id: 'carte-sig',       label: 'Carte SIG',            icon: <MapPin          size={13} /> },
  { id: 'activite',        label: 'Activité',             icon: <History         size={13} /> },
];

/* ─── Planning helpers ────────────────────────────────── */
const TODAY = new Date('2026-05-25');

/** Derive S1..S5 slot values (0=absent 1=planifié 2=actif) from task dates */
function planningSlots(t: TacheWBS): (0 | 1 | 2)[] {
  const start = new Date(t.dateDebut);
  const end   = new Date(t.dateFin);
  return Array.from({ length: 5 }, (_, i) => {
    const w0 = new Date(TODAY); w0.setDate(TODAY.getDate() - TODAY.getDay() + 1 + i * 7);
    const w1 = new Date(w0);    w1.setDate(w0.getDate() + 4);
    if (end < w0 || start > w1) return 0;
    const isActive = start <= TODAY && end >= w0;
    return isActive ? 2 : 1;
  });
}

/* ─── PlanCell ────────────────────────────────────────── */
function PlanCell({ val }: { val: 0 | 1 | 2 }) {
  if (val === 0) return <div style={{ width: 36, height: 26, borderRadius: 4, background: '#F8FAFC', border: '1px solid #F1F5F9' }} />;
  if (val === 1) return (
    <div style={{ width: 36, height: 26, borderRadius: 4, background: `${C.navy}18`, border: `1px solid ${C.navy}30`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ width: 18, height: 3, background: C.navy, borderRadius: 2, opacity: 0.5 }} />
    </div>
  );
  return (
    <div style={{ width: 36, height: 26, borderRadius: 4, background: `${C.orange}22`, border: `1px solid ${C.orange}55`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ width: 18, height: 3, background: C.orange, borderRadius: 2 }} />
    </div>
  );
}

/* ─── KPI Chip ─────────────────────────────────────────── */
function KpiChip({ label, value, color, sub, text }: { label: string; value: string; color: string; sub?: string; text?: boolean }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', minWidth: text ? 90 : 70, maxWidth: text ? 150 : undefined }}>
      <div style={{
        fontSize: text ? 12.5 : 17, fontWeight: text ? 700 : 800, color, lineHeight: 1.15,
        whiteSpace: text ? 'normal' : 'nowrap',
        overflowWrap: 'anywhere', textAlign: 'center',
      }}>{value}</div>
      {sub && <div style={{ fontSize: 9.5, color: sub.startsWith('+') ? C.green : C.red, fontWeight: 600, marginTop: 1 }}>{sub}</div>}
      <div style={{ fontSize: 9.5, color: '#94A3B8', marginTop: 2, whiteSpace: 'nowrap' }}>{label}</div>
    </div>
  );
}

/* ─── GED Data ─────────────────────────────────────────── */
const GED_DOCS = [
  { id: 'd1', nom: 'Étude APD — Réseau HTA/BT', type: 'Étude', date: '2024-04-30', taille: '2.4 Mo', auteur: 'Bureau d\'études', statut: 'validé', ext: 'pdf' },
  { id: 'd2', nom: 'Contrat travaux — Lot 1 GC', type: 'Contrat', date: '2024-07-31', taille: '890 Ko', auteur: 'DAJ', statut: 'signé', ext: 'pdf' },
  { id: 'd3', nom: 'Plan d\'exécution — Zone Nord', type: 'Plan', date: '2025-01-15', taille: '5.1 Mo', auteur: 'Entreprise A', statut: 'approuvé', ext: 'dwg' },
  { id: 'd4', nom: 'Rapport mensuel — Avril 2026', type: 'Rapport', date: '2026-05-02', taille: '1.2 Mo', auteur: 'CP Traoré', statut: 'publié', ext: 'docx' },
  { id: 'd5', nom: 'PV réception partielle — Lot 1', type: 'PV', date: '2026-03-15', taille: '340 Ko', auteur: 'Commission', statut: 'signé', ext: 'pdf' },
  { id: 'd6', nom: 'Photos chantier — S20/2026', type: 'Photo', date: '2026-05-20', taille: '18 Mo', auteur: 'Superviseur', statut: 'archivé', ext: 'zip' },
];

const DOC_STATUT: Record<string, { color: string; bg: string }> = {
  validé:   { color: C.green,  bg: '#DCFCE7' },
  signé:    { color: C.navy,   bg: '#EFF6FF' },
  approuvé: { color: C.green,  bg: '#DCFCE7' },
  publié:   { color: C.purple, bg: '#EDE9FE' },
  archivé:  { color: C.slate,  bg: '#F1F5F9' },
};


/* ─── Zone Types & Data ─────────────────────────────────────── */
type StatutZone = 'non_demarre' | 'en_cours' | 'termine' | 'suspendu';
interface ZoneProjet {
  id: string; code: string; localite: string; commune: string;
  departement: string; lot: string;
  menagesPrevus: number; menagesRealises: number;
  kmHtaPrevus: number; kmHtaRealises: number;
  kmBtPrevus: number; kmBtRealises: number;
  statut: StatutZone; observation: string; dateModif: string;
}
const ZONES_SAMPLE: ZoneProjet[] = [
  { id: 'z1', code: 'Z01', localite: 'Medina Diack',    commune: 'Diack',       departement: 'Thies',       lot: 'Lot 1', menagesPrevus: 420, menagesRealises: 420, kmHtaPrevus: 12.4, kmHtaRealises: 12.4, kmBtPrevus: 18.6, kmBtRealises: 18.6, statut: 'termine',     observation: 'Reception provisoire signee',        dateModif: '2026-05-20' },
  { id: 'z2', code: 'Z02', localite: 'Nguekokh',        commune: 'Nguekokh',    departement: 'Mbour',       lot: 'Lot 1', menagesPrevus: 680, menagesRealises: 532, kmHtaPrevus: 22.1, kmHtaRealises: 16.8, kmBtPrevus: 31.4, kmBtRealises: 24.2, statut: 'en_cours',    observation: 'Zone Nord achevement en cours',      dateModif: '2026-05-24' },
  { id: 'z3', code: 'Z03', localite: 'Keur Moussa',     commune: 'Keur Moussa', departement: 'Thies',       lot: 'Lot 2', menagesPrevus: 310, menagesRealises: 310, kmHtaPrevus: 8.9,  kmHtaRealises: 8.9,  kmBtPrevus: 14.2, kmBtRealises: 14.2, statut: 'termine',     observation: 'MES realisee le 15/03/2026',         dateModif: '2026-03-15' },
  { id: 'z4', code: 'Z04', localite: 'Diama Tiakha',    commune: 'Sandiara',    departement: 'Mbour',       lot: 'Lot 2', menagesPrevus: 290, menagesRealises: 138, kmHtaPrevus: 9.6,  kmHtaRealises: 4.5,  kmBtPrevus: 13.8, kmBtRealises: 6.2,  statut: 'en_cours',    observation: 'Travaux GC acheves, cable en cours', dateModif: '2026-05-22' },
  { id: 'z5', code: 'Z05', localite: 'Santhiou Diaobe', commune: 'Koumpentoum', departement: 'Tambacounda', lot: 'Lot 3', menagesPrevus: 520, menagesRealises: 0,   kmHtaPrevus: 17.3, kmHtaRealises: 0,    kmBtPrevus: 25.6, kmBtRealises: 0,    statut: 'non_demarre', observation: 'En attente mobilisation Lot 3',      dateModif: '2026-05-01' },
  { id: 'z6', code: 'Z06', localite: 'Missirah',        commune: 'Missirah',    departement: 'Tambacounda', lot: 'Lot 3', menagesPrevus: 380, menagesRealises: 0,   kmHtaPrevus: 13.1, kmHtaRealises: 0,    kmBtPrevus: 19.4, kmBtRealises: 0,    statut: 'non_demarre', observation: 'Zones a confirmer avec DER',         dateModif: '2026-05-01' },
];
const STATUT_ZONE_CFG: Record<StatutZone, { label: string; color: string; bg: string }> = {
  termine:     { label: 'Termine',     color: '#16A34A', bg: '#DCFCE7' },
  en_cours:    { label: 'En cours',    color: '#1B4F8A', bg: '#EFF6FF' },
  non_demarre: { label: 'Non demarre', color: '#94A3B8', bg: '#F1F5F9' },
  suspendu:    { label: 'Suspendu',    color: '#D97706', bg: '#FFF7ED' },
};

/* ─── Risques Data ─────────────────────────────────────── */
const RISQUES = [
  { id: 'r1', intitule: 'Retard livraison poteaux béton', categorie: 'Fournisseur', probabilite: 4, impact: 4, statut: 'ouvert',    action: 'Commande d\'urgence chez fournisseur B' },
  { id: 'r2', intitule: 'Dépassement budget GC',          categorie: 'Finance',     probabilite: 3, impact: 4, statut: 'en_cours',  action: 'Révision bordereau + demande avenant' },
  { id: 'r3', intitule: 'Conditions météo défavorables',   categorie: 'Technique',   probabilite: 3, impact: 2, statut: 'surveillé', action: 'Planning travaux en dehors saison pluies' },
  { id: 'r4', intitule: 'Résistance communautaire',        categorie: 'Social',      probabilite: 2, impact: 3, statut: 'atténué',   action: 'Réunions consultation organisées' },
  { id: 'r5', intitule: 'Variation taux change USD/FCFA',  categorie: 'Finance',     probabilite: 2, impact: 3, statut: 'surveillé', action: 'Clause de révision prix dans contrats' },
];

const RISQUE_STATUT: Record<string, { color: string; bg: string; label: string }> = {
  ouvert:    { color: C.red,    bg: '#FEE2E2', label: 'Ouvert'     },
  en_cours:  { color: C.amber,  bg: '#FFF7ED', label: 'En cours'   },
  surveillé: { color: C.navy,   bg: '#EFF6FF', label: 'Surveillé'  },
  atténué:   { color: C.green,  bg: '#DCFCE7', label: 'Atténué'    },
};

function criticite(p: number, i: number) { return p * i; }
function criticiteColor(c: number) {
  if (c >= 12) return C.red;
  if (c >= 6)  return C.amber;
  return C.green;
}

/* ═══════════════════════════════════════════════════════
   PARSEUR IA — Extraction des champs d'une fiche projet (texte brut → champs).
   Heuristiques FR robustes (libellés + ponctuation), validation humaine ensuite.
═══════════════════════════════════════════════════════ */
const MOIS_FR: Record<string, string> = {
  janvier: '01', 'février': '02', fevrier: '02', mars: '03', avril: '04', mai: '05', juin: '06',
  juillet: '07', 'août': '08', aout: '08', septembre: '09', octobre: '10', novembre: '11', 'décembre': '12', decembre: '12',
};

function parseFicheProjet(raw: string): Record<string, string | number | string[]> {
  const t = raw.replace(/\s+/g, ' ').trim();
  const out: Record<string, string | number | string[]> = {};

  // ── BUDGET — gère FCFA / MFCFA / Md FCFA / USD (taux ~600) ──
  const bM = t.match(/([\d][\d\s.]{2,18})\s*(Md\s?FCFA|MFCFA|M\s?FCFA|millions?\s+(?:de\s+)?FCFA|F\s?CFA|FCFA|USD|\$)/i);
  if (bM) {
    let n = parseFloat(bM[1].replace(/[\s.]/g, '').replace(',', '.'));
    const unit = bM[2].toUpperCase().replace(/\s/g, '');
    if (!isNaN(n) && n > 0) {
      if (/^MD/.test(unit)) n = n * 1000;                       // milliards FCFA → MFCFA
      else if (/^M/.test(unit) || /MILLION/.test(unit)) { /* déjà en MFCFA */ }
      else if (unit === 'USD' || unit === '$') n = (n * 600) / 1e6; // USD → MFCFA
      else n = n / 1e6;                                          // FCFA brut → MFCFA
      out.budget = Math.round(n);
    }
  }

  // ── CHEF DE PROJET — gère « Nom du Chef de Projet … Lot 1 Et 2 : M. MAODO SENE, PMP® » ──
  const chef = t.match(/(?:nom\s+du\s+)?chef\s+de\s+projet[^:]{0,40}:?\s*(?:Lot[^:]{0,12}:\s*)?(?:M\.?|Mme|Mr\.?|Dr\.?)\s*([A-ZÀ-Ÿ][A-Za-zÀ-ÿ'’.\- ]{2,38})/i)
    || t.match(/(?:nom\s+du\s+)?chef\s+de\s+projet\s*:?\s*([A-ZÀ-Ÿ][A-Za-zÀ-ÿ'’.\- ]{2,38})/i)
    || t.match(/responsable\s*(?:du\s+projet)?\s*:?\s*([A-ZÀ-Ÿ][A-Za-zÀ-ÿ'’.\- ]{2,38})/i);
  if (chef) {
    const nom = chef[1].trim().replace(/\s{2,}/g, ' ')
      .replace(/\s*(PMP|PMI|Ing|Lot|Et)\b.*$/i, '').replace(/[,.;].*$/, '').trim();
    if (nom.length >= 3) out.chefProjet = nom;
  }

  // ── AVANCEMENT % ──
  const av = t.match(/avancement\s*(?:physique|global)?\s*:?\s*(\d{1,3})\s*%/i)
    || t.match(/(\d{1,3})\s*%\s*(?:d['’]?avancement|r[ée]alis)/i);
  if (av) { const n = +av[1]; if (n >= 0 && n <= 100) out.avancement = n; }

  // ── DATES — formats dd/mm/yyyy ET « 07 février 2023 » ──
  const toIso = (s: string) => {
    let m = s.match(/(\d{1,2})[\/\-.](\d{1,2})[\/\-.](\d{2,4})/);
    if (m) { let y = m[3]; if (y.length === 2) y = '20' + y; return `${y}-${m[2].padStart(2, '0')}-${m[1].padStart(2, '0')}`; }
    m = s.match(/(\d{1,2})\s+([a-zà-ÿ]+)\.?\s+(\d{4})/i);
    if (m) { const mo = MOIS_FR[m[2].toLowerCase()]; if (mo) return `${m[3]}-${mo}-${m[1].padStart(2, '0')}`; }
    return undefined;
  };
  const datePat = '(\\d{1,2}[\\/\\-.]\\d{1,2}[\\/\\-.]\\d{2,4}|\\d{1,2}\\s+[a-zà-ÿ]+\\.?\\s+\\d{4})';
  const deb = t.match(new RegExp('(?:lancement\\s+effectif|ouverture\\s+chantier|d[ée]marrage|date\\s+de\\s+d[ée]but|d[ée]but)[^0-9]{0,25}' + datePat, 'i'));
  if (deb) { const iso = toIso(deb[1]); if (iso) out.dateDebut = iso; }
  const fin = t.match(new RegExp('(?:fin\\s+pr[ée]visionnelle(?:\\s+actualis[ée]e)?|fin\\s+pr[ée]vue|date\\s+de\\s+fin)[^0-9]{0,25}' + datePat, 'i'));
  if (fin) { const iso = toIso(fin[1]); if (iso) out.dateFinPrevue = iso; }

  // ── LOCALISATION / SIÈGE / RÉGION ──
  const loc = t.match(/(?:si[èe]ge\s+du\s+projet|localisation|r[ée]gion|zone\s+d['’]intervention)\s*:?\s*([A-ZÀ-Ÿ][A-Za-zÀ-ÿ'’.\- ]{2,40})/i);
  if (loc) { const v = loc[1].trim().replace(/[,.;].*$/, '').replace(/\b(Production|Transport|Distribution|Commercial)\b.*$/i, '').trim(); if (v.length >= 3) out.localisation = v; }

  // ── DESCRIPTION — priorité à « Présentation du projet », sinon Problématique/Objet ──
  const pres = t.match(/pr[ée]sentation\s+du\s+projet\s*:?\s*(.{40,650}?)\s*(?:composantes?\s*\d|composante\s*1|probl[ée]matique\s*:)/i);
  const desc = t.match(/(?:probl[ée]matique|pr[ée]sentation\s+du\s+projet|objet|objectif\s+(?:global|de\s+d[ée]veloppement|du\s+projet)|description|consistance)\s*:?\s*([^.]{25,500}\.)/i);
  if (pres) out.description = pres[1].trim();
  else if (desc) out.description = desc[1].trim();

  // ── CONTEXTE & JUSTIFICATION — bloc « Problématique » jusqu'à « Présentation » ──
  const ctx = t.match(/probl[ée]matique\s*:?\s*(.{60,1100}?)\s*pr[ée]sentation\s+du\s+projet/i);
  if (ctx) out.contexte = ctx[1].trim();

  // ── OBJECTIFS (liste) — phrases « objectif de développement … » / « a pour objectif … » ──
  const objs: string[] = [];
  let mo: RegExpMatchArray | null;
  if ((mo = t.match(/l['’]objectif\s+de\s+d[ée]veloppement\s+du\s+projet\s+est\s+d?['’]?\s*(.{15,260}?)\s*[\.;]/i)))
    objs.push(('Objectif de développement : ' + mo[1].trim()).replace(/\s+/g, ' '));
  if ((mo = t.match(/a\s+pour\s+objectif\s+de\s+(.{15,260}?)\s*[\.;]/i)))
    objs.push(mo[1].trim().replace(/\s+/g, ' '));
  if (objs.length) out.objectifs = [...new Set(objs)];

  // ── LIVRABLES (liste) — « Portée indicative » : lignes MT/BT, postes, connexions ──
  const liv: string[] = [];
  const grab = (re: RegExp, label: string) => {
    const m = t.match(re);
    if (m) {
      // Les chiffres du .docx sont parfois fractionnés (« 1 25 6 ») → on recompacte.
      const num = m[1].replace(/\s+/g, '');
      const pretty = num.replace(/\B(?=(\d{3})+(?!\d))/g, ' '); // 1256 → « 1 256 »
      liv.push(`${label} : ${pretty}`);
    }
  };
  grab(/lignes?\s+MT\s*:?\s*([\d][\d\s]{1,9})\s*km/i, 'Lignes MT (km)');
  grab(/lignes?\s+BT\s*:?\s*([\d][\d\s]{1,9})\s*km/i, 'Lignes BT (km)');
  grab(/postes?\s+MT\s*\/\s*BT\s*:?\s*([\d][\d\s]{1,9})/i, 'Postes MT/BT');
  grab(/nombre\s+de\s+connexions?\s*:?\s*([\d][\d\s]{1,9})/i, 'Connexions / abonnés');
  if (liv.length) out.livrables = liv;

  return out;
}

/* ═══════════════════════════════════════════════════════
   COMPOSANT PRINCIPAL
═══════════════════════════════════════════════════════ */
export default function CockpitProjet() {
  const store = readOnlyGuard(useProjectStore(), isOperationalReadOnly(useAuth().user));
  const router = useRouter();
  const searchParams = useSearchParams();
  const { user, isRole } = useAuth();
  const [selectedProjetId, setSelectedProjetId]   = useState<string>(() => {
    // Ouvre le projet passé en paramètre (?projet=ID, ?id=ID ou ?code=CODE), sinon le premier visible.
    if (typeof window !== 'undefined') {
      const sp = new URLSearchParams(window.location.search);
      const byId = sp.get('projet') || sp.get('id');
      if (byId && store.projets.some(p => p.id === byId)) return byId;
      const byCode = sp.get('code');
      if (byCode) {
        const match = store.projets.find(p => p.code === byCode);
        if (match) return match.id;
      }
    }
    return store.projets[0]?.id ?? '';
  });

  // Résolution robuste du projet depuis l'URL (deep-link alertes, partage de lien).
  // Réagit aux changements de query (?projet / ?id / ?code) même sans rechargement,
  // et corrige le cas SSR où window n'est pas lu au 1er rendu.
  useEffect(() => {
    // Lit l'URL réelle côté client (fiable même si useSearchParams est vide à l'hydratation).
    const sp = new URLSearchParams(typeof window !== 'undefined' ? window.location.search : '');
    const byId = sp.get('projet') || sp.get('id');
    const byCode = sp.get('code');
    let target = '';
    if (byId && store.projets.some(p => p.id === byId)) target = byId;
    else if (byCode) {
      const m = store.projets.find(p => p.code === byCode)
        ?? store.projets.find(p => p.id.toUpperCase() === byCode.toUpperCase());
      if (m) target = m.id;
    }
    if (target && target !== selectedProjetId) setSelectedProjetId(target);
  }, [searchParams, store.projets]); // eslint-disable-line react-hooks/exhaustive-deps
  const [activeOnglet, setActiveOnglet]            = useState('fiche-executive');
  const [showSelector, setShowSelector]            = useState(false);
  const [selectorQuery, setSelectorQuery]          = useState('');
  const selectorRef = useRef<HTMLDivElement | null>(null);
  // Fermeture auto du sélecteur projet : clic extérieur, défilement, touche Échap.
  useEffect(() => {
    if (!showSelector) return;
    const close = () => { setShowSelector(false); setSelectorQuery(''); };
    const onDown = (e: MouseEvent) => { if (selectorRef.current && !selectorRef.current.contains(e.target as Node)) close(); };
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') close(); };
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onKey);
    window.addEventListener('scroll', close, true);
    return () => {
      document.removeEventListener('mousedown', onDown);
      document.removeEventListener('keydown', onKey);
      window.removeEventListener('scroll', close, true);
    };
  }, [showSelector]);
  const [filterStatut, setFilterStatut]            = useState<StatutTache | 'all'>('all');
  const [expandedTaches, setExpandedTaches]        = useState<Set<string>>(new Set());
  /* ── Edit state ─────────────────────────────────────── */
  const [showEditModal, setShowEditModal]          = useState(false);
  const [editForm, setEditForm]                    = useState<Partial<typeof store.projets[0]>>({});
  const [showTacheModal, setShowTacheModal]        = useState(false);
  const [editTacheId, setEditTacheId]              = useState<string | null>(null);
  const [tacheForm, setTacheForm]                  = useState({ nom: '', type: 'Normale' as TypeTache, priorite: 'Moyenne' as Priorite, dateDebut: '', dateFin: '', duree: '5', avancement: 0, statutTache: 'a_faire' as StatutTache, commentaire: '', predId: '', predType: 'FS' as DepType, predLag: 0, coutPrevu: '' as number | '', coutReel: '' as number | '' });
  const [showJalonModal, setShowJalonModal]        = useState(false);
  const [jalonForm, setJalonForm]                  = useState({ label: '', date: '' });
  const [importingFiche, setImportingFiche]        = useState(false);
  const ficheFileRef                               = useRef<HTMLInputElement | null>(null);
  const [showUploadModal, setShowUploadModal]      = useState(false);
  const [uploadForm, setUploadForm]               = useState({ nom: '', type: 'Rapport', commentaire: '' });
  const [gedDocs, setGedDocs]                     = useState(GED_DOCS);
  const [previewDoc, setPreviewDoc]               = useState<typeof GED_DOCS[0] | null>(null);
  /* ── Zones & Quantités state ────────────────────────── */
  const [zones, setZones]                         = useState<ZoneProjet[]>(ZONES_SAMPLE);
  const [showZoneModal, setShowZoneModal]         = useState(false);
  const [editZoneId, setEditZoneId]               = useState<string | null>(null);
  const [zoneForm, setZoneForm]                   = useState<Omit<ZoneProjet, "id">>({ code: '', localite: '', commune: '', departement: '', lot: 'Lot 1', menagesPrevus: 0, menagesRealises: 0, kmHtaPrevus: 0, kmHtaRealises: 0, kmBtPrevus: 0, kmBtRealises: 0, statut: 'non_demarre', observation: '', dateModif: new Date().toISOString().slice(0,10) });
  const [filterLot, setFilterLot]                 = useState<string>('Tous');
  /* ── Pondération BEST state ──────────────────────────── */
  const [editPoids, setEditPoids]                 = useState<Record<string, number>>({});
  const [editPoidsMode, setEditPoidsMode]         = useState(false);
  /* ── Contrat / HSE / Qualité / Passation inline-edit — états ─ */
  const [editingContratField, setEditingContratField] = useState<string | null>(null);
  const [contratFieldVal, setContratFieldVal]         = useState<string>('');
  const [editingHseField, setEditingHseField]     = useState<string | null>(null);
  const [hseFieldVal, setHseFieldVal]             = useState<string>('');
  const [editingQualField, setEditingQualField]   = useState<string | null>(null);
  const [qualFieldVal, setQualFieldVal]           = useState<string>('');
  // saveContratField / saveHseField / saveQualField / savePassationStep
  // sont déclarés APRÈS projet (useMemo) pour éviter la temporal dead zone.

  /* ── Fiche exécutive — inline edit sections ────────── */
  type FicheSection = 'description' | 'contexte' | 'objectifs' | 'livrables' | 'equipe' | 'jalons' | 'kpis' | 'phases' | 'zones' | 'budget';
  const [editingSection, setEditingSection]       = useState<FicheSection | null>(null);
  const [ficheDesc, setFicheDesc]                 = useState<string>('');
  const [ficheObjectifs, setFicheObjectifs]       = useState<string[]>([]);
  const [ficheContexte, setFicheContexte]         = useState<string>('');
  const [ficheLivrables, setFicheLivrables]       = useState<string[]>([]);
  const [equipeSearch, setEquipeSearch]           = useState<string>('');

  const projet: Projet | undefined = useMemo(
    () => store.projets.find(p => p.id === selectedProjetId) ?? store.projets[0],
    [selectedProjetId, store.projets],
  );

  // Détection auto du temps (RescueTime-like) : le projet ouvert ici devient le
  // projet actif → le heartbeat du tracker accumule le temps bureau sur ce projet.
  useEffect(() => {
    if (projet) useTempsStore.getState().setProjetActif(projet.nom);
  }, [projet?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  const dcfg = projet ? DOMAINE_CFG[projet.domaine as Domaine] : null;

  const { taches, filteredTaches, critiques, blocking, jalonsProches } = useMemo(() => {
    if (!projet) return { taches: [], filteredTaches: [], critiques: 0, blocking: 0, jalonsProches: 0 };
    const all = projet.taches;
    const filtered = filterStatut === 'all' ? all : all.filter(t => t.statutTache === filterStatut);
    const crit  = all.filter(t => t.statutTache === 'bloque' || t.priorite === 'Haute').length;
    const block = all.filter(t => t.statutTache === 'bloque').length;
    const soon  = projet.jalons.filter(j => {
      const d = new Date(j.date);
      return !j.atteint && d >= TODAY && (d.getTime() - TODAY.getTime()) <= 30 * 86400000;
    }).length;
    return { taches: all, filteredTaches: filtered, critiques: crit, blocking: block, jalonsProches: soon };
  }, [projet, filterStatut]);

  /* Finances computed */
  const finances = useMemo(() => {
    if (!projet) return null;
    const budgetTotal = projet.budget;
    const engage      = projet.budgetEngage;
    const decaisse    = projet.budgetDecaisse;
    const solde       = budgetTotal - engage;
    const restDecaiss = engage - decaisse;
    const divB        = budgetTotal || 1; // évite NaN/Infinity si budget non renseigné
    const tauxEngage  = engage / divB * 100;
    const tauxDecaiss = decaisse / divB * 100;

    // Courbe S fictive (12 mois historique + 6 mois prévision)
    const courbe = Array.from({ length: 18 }, (_, i) => {
      const isPast = i <= 10;
      const base = (i / 17) * 100;
      return {
        mois: `M${i + 1}`,
        planifie: Math.min(100, base * 0.95 + (i > 6 ? 5 : 0)),
        reel:     isPast ? Math.min(100, base * (0.80 + i * 0.01)) : undefined,
      };
    });

    return { budgetTotal, engage, decaisse, solde, restDecaiss, tauxEngage, tauxDecaiss, courbe };
  }, [projet]);

  /* KPIs contrat & passation marchés */
  const kpiContrat = useMemo(() => {
    if (!projet) return null;
    const av = projet.avancement;
    const avPlan = projet.avancementPlanifie;

    // Statut global trafic (manual override or auto)
    const sg: StatutGlobal = projet.statutGlobal ?? calculerStatutGlobal({
      cpi: projet.cpi,
      spi: projet.spi,
      avancement: av,
      avancementPlanifie: avPlan,
    });

    // Financial rates
    const mMarche = projet.montantMarche ?? projet.budget;
    const mFact   = projet.montantFacture ?? Math.round(av / 100 * mMarche);
    const mPay    = projet.montantPaye    ?? projet.budgetDecaisse;
    const mFin    = projet.montantFinancement ?? projet.budget;
    const budgDec = projet.budgetDecaisse;

    const tauxFacturation  = mMarche > 0 ? Math.min(200, mFact / mMarche * 100) : 0;
    const tauxPaiement     = mFact   > 0 ? Math.min(200, mPay  / mFact  * 100) : 0;
    const tauxDecaissement = mFin    > 0 ? Math.min(200, budgDec / mFin  * 100) : 0;
    const tauxEngagement   = projet.budget > 0 ? Math.min(200, projet.budgetEngage / projet.budget * 100) : 0;

    // Alert flags
    const TODAY_MS = new Date('2026-06-09').getTime();
    const finCaution = projet.dateFinCaution ? new Date(projet.dateFinCaution).getTime() : null;
    const alertCaution3m = finCaution !== null && (finCaution - TODAY_MS) < 90 * 86400000 && (finCaution - TODAY_MS) > 0;
    const alertCaution6m = finCaution !== null && (finCaution - TODAY_MS) < 180 * 86400000 && (finCaution - TODAY_MS) > 0;

    // Passation steps progress
    const pm = projet.passationMarches;
    const passationGlobal = pm
      ? Math.round(
          (pm.elaborationDAC + pm.lancementDAC + pm.ouvertureAnalyse +
           pm.attributionProvisoire + pm.attributionDefinitive + pm.signatureContrat) / 6
        )
      : 0;

    return {
      sg, mMarche, mFact, mPay, mFin,
      tauxFacturation, tauxPaiement, tauxDecaissement, tauxEngagement,
      alertCaution3m, alertCaution6m, passationGlobal,
      alertCpiRouge: projet.cpi < 1,
      alertSpiRouge: projet.spi < 1,
    };
  }, [projet]);

  /* ── Contrat / HSE / Qualité / Passation inline-edit — sauvegardes ─ */
  const saveContratField = useCallback((field: string, rawVal: string) => {
    if (!projet) return;
    const num = parseFloat(rawVal);
    const patch: Partial<Projet> = (() => {
      if (['montantMarche','montantAvenants','montantFacture','montantPaye','montantFinancement'].includes(field))
        return { [field]: isNaN(num) ? undefined : num };
      if (['dateODS','dateSignatureContrat','dateFinCaution'].includes(field))
        return { [field]: rawVal || undefined };
      return { [field]: rawVal || undefined };
    })();
    store.updateProjet(projet.id, patch);
    setEditingContratField(null);
  }, [projet, store]);

  const saveHseField = useCallback((field: string, rawVal: string) => {
    if (!projet) return;
    const num = parseFloat(rawVal);
    const currentHse = projet.hse ?? { nbAnomalies: 0, tauxRealisationPGES: 0, tauxRealisationPAR: 0 };
    store.updateProjet(projet.id, { hse: { ...currentHse, [field]: isNaN(num) ? 0 : num } });
    setEditingHseField(null);
  }, [projet, store]);

  const saveQualField = useCallback((field: string, rawVal: string) => {
    if (!projet) return;
    const num = parseInt(rawVal, 10);
    const currentQ = projet.qualite ?? { nbNonConformites: 0, nbControles: 0 };
    store.updateProjet(projet.id, { qualite: { ...currentQ, [field]: isNaN(num) ? 0 : num } });
    setEditingQualField(null);
  }, [projet, store]);

  const savePassationStep = useCallback((step: keyof PassationMarches, val: number) => {
    if (!projet) return;
    const current = projet.passationMarches ?? { elaborationDAC: 0, lancementDAC: 0, ouvertureAnalyse: 0, attributionProvisoire: 0, attributionDefinitive: 0, signatureContrat: 0 };
    store.updateProjet(projet.id, { passationMarches: { ...current, [step]: Math.min(100, Math.max(0, val)) } });
  }, [projet, store]);

  /* Indicateurs métiers Énergie (DPE) */
  const energyMetrics = useMemo(() => {
    if (!projet) return [];
    const isDistrib = projet.domaine === 'distribution';
    const isProd = projet.domaine === 'production';
    const isTrans = projet.domaine === 'transport';
    const av = projet.avancement / 100;

    const metrics = [];
    if (isDistrib) {
      metrics.push({ label: 'Réseau HTA', value: `${(projet.budget * 0.08 * av).toFixed(1)} km`, icon: '🔌' });
      metrics.push({ label: 'Réseau BT', value: `${(projet.budget * 0.15 * av).toFixed(1)} km`, icon: '🏠' });
      metrics.push({ label: 'Ménages', value: Math.round(projet.budget * 12 * av).toLocaleString('fr-FR'), icon: '👥' });
    } else if (isProd) {
      metrics.push({ label: 'Capacité', value: `${(projet.budget * 0.04 * av).toFixed(1)} MW`, icon: '⚡' });
    } else if (isTrans) {
      metrics.push({ label: 'Lignes THT', value: `${(projet.budget * 0.02 * av).toFixed(1)} km`, icon: '🏗️' });
    }
    return metrics;
  }, [projet]);

  /* Equipe mapped */
  const equipe = useMemo(() => {
    if (!projet) return [];
    return projet.equipe
      .map(rid => store.ressources.find(r => r.id === rid))
      .filter(Boolean);
  }, [projet, store.ressources]);

  /* ── Droits d'édition (règle DPE) ─────────────────────
   * Seul le Chef de Projet du projet (ou un ADMIN) peut MODIFIER les informations.
   * L'Assistant et le Contrôleur peuvent PROPOSER des modifications, soumises à la
   * validation du Chef de Projet. Les autres profils sont en lecture seule. */
  const normName = (s: string) =>
    (s || '').toLowerCase().normalize('NFD').replace(/\p{Diacritic}/gu, '').replace(/[^a-z0-9]+/g, ' ').trim();
  const isChefDeCeProjet = useMemo(
    () => !!projet && !!user && normName(`${user.prenom} ${user.nom}`) === normName(projet.chefProjet),
    [projet, user],
  );
  /** Compare deux codes d'organisation (direction/département/unité) sans tenir
   *  compte de la casse ni de la ponctuation (ex. « DPD » ≈ « DPD_DISTRIBUTION »). */
  const orgCodeEq = (a?: string, b?: string) => {
    const n = (s?: string) => (s || '').toUpperCase().replace(/[^A-Z0-9]/g, '');
    const na = n(a), nb = n(b);
    if (!na || !nb) return false;
    return na === nb || na.startsWith(nb) || nb.startsWith(na);
  };
  /** Le chef de département (ou coordonnateur de cellule) supervise-t-il ce projet ?
   *  Match précis sur le département (niveau 2) ; à défaut (cellules sans dept),
   *  rapprochement direction/cellule ↔ unité du projet. */
  const superviseCeProjet = useMemo(() => {
    if (!projet || !user) return false;
    if (user.departement && (projet as any).departement && orgCodeEq(user.departement, (projet as any).departement)) return true;
    if (!user.departement) {
      const userCodes = [user.direction, (user as any).cellule].filter(Boolean) as string[];
      const projCodes = [(projet as any).departement, (projet as any).unite].filter(Boolean) as string[];
      return userCodes.some(uc => projCodes.some(pc => orgCodeEq(uc, pc)));
    }
    return false;
  }, [projet, user]);
  /** Édition de la fiche : Admin, Directeur DPE, le Chef de Projet du projet, ou
   *  le Chef de Département/coordonnateur qui supervise l'unité du projet. */
  // Édition de la fiche/gestion projet : réservée niveau 2 (chef de projet / chef de dépt ou cellule
  // supervisant le projet) + Admin. Niveaux 0/1 (DPE, PMO Central, directeurs d'unité) = lecture seule.
  const canEditFiche = isRole('ADMIN') || (!isOperationalReadOnly(user) && (isChefDeCeProjet || (isRole('CHEF_DEPT') && superviseCeProjet)));
  const canProposeFiche = !canEditFiche && (isRole('ASSISTANT') || isRole('CONTROLEUR'));
  /** Applique la modif si chef/admin, sinon transmet la proposition pour validation. */
  const commitOrPropose = useCallback((apply: () => void, label: string) => {
    if (canEditFiche) { apply(); return; }
    if (canProposeFiche) {
      toast.success(`Proposition « ${label} » transmise au Chef de Projet${projet ? ` (${projet.chefProjet})` : ''} pour validation.`, { duration: 4000 });
      setEditingSection(null);
      return;
    }
    toast.error('Action réservée au Chef de Projet.');
  }, [canEditFiche, canProposeFiche, projet]);

  /** Personnel DPE réel sélectionnable pour l'équipe (ressources de type Travail). */
  const personnelSelectionnable = useMemo(
    () => store.ressources
      .filter(r => r.type === 'Travail')
      .sort((a, b) => `${a.prenom} ${a.nom}`.localeCompare(`${b.prenom} ${b.nom}`, 'fr')),
    [store.ressources],
  );

  /** Poste/direction RÉELS du chef de projet (depuis le roster DPE), sinon libellé générique. */
  const chefInfo = useMemo(() => {
    if (!projet) return { poste: 'Chef de Projet', direction: 'DPE — SENELEC' };
    const res = store.ressources.find(r => r.type === 'Travail' && normName(`${r.prenom} ${r.nom}`) === normName(projet.chefProjet));
    return {
      poste: res?.poste || 'Chef de Projet',
      direction: res?.direction || 'DPE — SENELEC',
    };
  }, [projet, store.ressources]);

  /**
   * Génère un contenu de fiche RÉALISTE et PROPRE À CHAQUE PROJET (description,
   * contexte, objectifs, livrables) à partir de ses attributs réels — afin que
   * deux projets différents n'affichent jamais le même texte générique. Ces
   * valeurs servent de défaut tant que le chef de projet n'a rien saisi/importé ;
   * dès qu'un champ est enregistré sur le projet, c'est lui qui prime.
   */
  const ficheDefaults = useMemo(() => {
    if (!projet) return { description: '', contexte: '', objectifs: [] as string[], livrables: [] as string[] };
    const dom = projet.domaine;
    const reg = projet.region || 'la zone du projet';
    const budgetTxt = projet.budget ? `${projet.budget.toLocaleString('fr-FR')} MFCFA` : 'un budget en cours de cadrage';
    const bailleur = projet.bailleurs?.[0]?.nom ?? 'SENELEC';
    const anneeFin = (projet.dateFinPrevue || '').slice(0, 4) || '—';
    const parDomaine: Record<string, { objet: string; objectifs: string[]; livrables: string[] }> = {
      distribution: {
        objet: `extension et de renforcement du réseau de distribution HTA/BT dans ${reg}`,
        objectifs: [
          `Renforcer et sécuriser l'alimentation électrique de ${reg}`,
          `Étendre la couverture HTA/BT et raccorder de nouveaux abonnés`,
          `Réduire les chutes de tension et les interruptions de service`,
          `Achever et mettre en service les ouvrages d'ici ${anneeFin}`,
        ],
        livrables: ['Lignes et postes HTA construits / réhabilités', 'Réseau BT étendu', 'Postes de transformation installés', 'Branchements abonnés réalisés', 'PV de réception provisoire signé'],
      },
      transport: {
        objet: `construction / renforcement d'ouvrages de transport d'énergie (lignes et postes HTB) dans ${reg}`,
        objectifs: [
          `Sécuriser le transit d'énergie 90/225 kV vers ${reg}`,
          `Construire / étendre les postes HTB et liaisons associées`,
          `Améliorer la stabilité et la fiabilité du réseau de transport`,
          `Mettre en service les ouvrages d'ici ${anneeFin}`,
        ],
        livrables: ['Postes HTB construits / étendus', 'Liaisons HT (aériennes/souterraines) posées', 'Équipements de protection et téléconduite installés', 'Essais et mise sous tension', 'PV de réception provisoire signé'],
      },
      production: {
        objet: `réalisation d'un moyen de production d'énergie dans ${reg}`,
        objectifs: [
          `Accroître la capacité de production disponible`,
          `Diversifier le mix énergétique et réduire le coût du kWh`,
          `Respecter les normes environnementales et de sûreté`,
          `Mettre en service l'installation d'ici ${anneeFin}`,
        ],
        livrables: ['Études APD et permis obtenus', 'Génie civil et montage réalisés', 'Équipements de production installés', 'Essais de performance validés', 'Mise en service industrielle'],
      },
      commercial: {
        objet: `modernisation de la relation clientèle et de la gestion commerciale dans ${reg}`,
        objectifs: [
          `Réduire les pertes commerciales et améliorer le recouvrement`,
          `Déployer les équipements de comptage et systèmes associés`,
          `Améliorer la qualité de service rendu aux clients`,
          `Atteindre les cibles de déploiement d'ici ${anneeFin}`,
        ],
        livrables: ['Spécifications validées', 'Système / compteurs déployés', 'Intégration SI réalisée', 'Formation des équipes', 'Recette fonctionnelle signée'],
      },
      genie_civil: {
        objet: `réalisation d'ouvrages de génie civil et d'infrastructures dans ${reg}`,
        objectifs: [
          `Réaliser les infrastructures de génie civil prévues`,
          `Respecter les normes techniques et délais contractuels`,
          `Garantir la qualité et la sécurité des ouvrages`,
          `Livrer les ouvrages d'ici ${anneeFin}`,
        ],
        livrables: ['Études et plans d\'exécution validés', 'Travaux de gros œuvre réalisés', 'Second œuvre et finitions', 'Contrôles et essais', 'PV de réception des ouvrages'],
      },
    };
    const d = parDomaine[dom] ?? parDomaine.distribution;
    // Cadre de référence PROPRE au projet (pas de « PSE » plaqué partout) :
    // on s'appuie sur le programme réel du projet (BEST/ECOWAS-REAP, etc.).
    const prog = `${projet.programme ?? ''} ${projet.nom ?? ''} ${projet.code ?? ''}`.toLowerCase();
    const cadre = /\b(best|ecowas|reap)\b/.test(prog)
      ? `du Projet Régional d'Accès à l'Électricité de la CEDEAO (ECOWAS-REAP / BEST)`
      : projet.programme
        ? `du programme ${projet.programme}`
        : `de la stratégie d'équipement et d'électrification de SENELEC`;
    const description = `Le projet « ${projet.nom} » (${projet.code}) porte sur la ${d.objet}. Piloté par ${projet.chefProjet} pour un montant de ${budgetTxt}, il est financé par ${bailleur}. Avancement actuel : ${Math.round(projet.avancement)}%.`;
    const contexte = `Ce projet s'inscrit dans le cadre ${cadre} et répond aux besoins d'électrification identifiés dans ${reg}. Il est porté par ${chefInfo.direction} et financé par ${bailleur} pour un montant global de ${budgetTxt}, avec un achèvement prévisionnel en ${anneeFin}.`;
    return { description, contexte, objectifs: d.objectifs, livrables: d.livrables };
  }, [projet, chefInfo.direction]);

  /* ── Handlers ────────────────────────────────────────── */
  const openEditModal = () => {
    if (!projet) return;
    setEditForm({
      nom: projet.nom, description: projet.description, objectif: projet.objectif ?? '',
      chefProjet: projet.chefProjet, region: projet.region, localisation: projet.localisation,
      budget: projet.budget, budgetEngage: projet.budgetEngage, budgetDecaisse: projet.budgetDecaisse,
      dateDebut: projet.dateDebut, dateFinPrevue: projet.dateFinPrevue, dateFinEstimee: projet.dateFinEstimee,
      priorite: projet.priorite, avancement: projet.avancement, avancementPlanifie: projet.avancementPlanifie,
      cpi: projet.cpi, spi: projet.spi,
    });
    setShowEditModal(true);
  };

  // ── IMPORT FICHE PROJET → MISE À JOUR IA DE LA FICHE EXÉCUTIVE ──────────
  // L'utilisateur charge une fiche projet (PDF/Word/Excel) ; l'IA extrait les
  // informations clés et PRÉ-REMPLIT le formulaire d'édition. L'utilisateur
  // VÉRIFIE puis enregistre (validation humaine obligatoire).
  const handleImportFiche = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files ?? []); e.target.value = '';
    if (!files.length || !projet) return;
    setImportingFiche(true);
    toast.loading(`Analyse IA de ${files.length} document(s) (fiche, rapports, Excel)…`, { id: 'imp-fiche' });
    try {
      // On lit TOUS les documents (fiche projet + rapports mensuels/trimestriels + Excel)
      // et on les concatène pour que l'IA dispose du maximum de contexte.
      const parts: string[] = [];
      const lus: string[] = []; const illisibles: string[] = [];
      for (const f of files) {
        const t = await extractFileText(f).catch(() => undefined);
        if (t && !t.startsWith('⚠️')) { parts.push(`\n===== DOCUMENT : ${f.name} =====\n${t}`); lus.push(f.name); }
        else illisibles.push(f.name);
      }
      const text = parts.join('\n');
      if (!text) {
        toast.error('Aucun document lisible (scans/images) — un OCR est nécessaire.', { id: 'imp-fiche' });
        return;
      }
      // 1) Extraction déterministe locale (toujours disponible).
      const parsed = parseFicheProjet(text);
      // 2) Si un compte Microsoft Copilot est lié → extraction IA experte, qui
      //    PRIME sur les valeurs locales (lecture fine de plusieurs documents).
      if (isCopilotLinked()) {
        toast.loading('Extraction experte via Microsoft Copilot…', { id: 'imp-fiche' });
        const ai = await extractStructuredFields(text, [
          { key: 'nom', description: "Intitulé exact du projet" },
          { key: 'description', description: "Description synthétique de l'objet du projet (2-4 phrases)" },
          { key: 'contexte', description: "Contexte et justification (problématique, cadre du financement)" },
          { key: 'chefProjet', description: "Nom complet du chef de projet (Prénom NOM)" },
          { key: 'region', description: "Région(s) d'intervention principale(s)" },
          { key: 'localisation', description: "Localisation / siège du projet" },
          { key: 'budgetMFCFA', description: "Budget total en MILLIONS de FCFA (nombre seul, convertir si en USD au taux indiqué)" },
          { key: 'dateDebut', description: "Date de démarrage au format AAAA-MM-JJ" },
          { key: 'dateFinPrevue', description: "Date de fin prévue au format AAAA-MM-JJ" },
          { key: 'objectifs', description: "Objectifs du projet, séparés par des points-virgules" },
          { key: 'livrables', description: "Livrables attendus, séparés par des points-virgules" },
        ], 'Direction Principale Équipement SENELEC');
        if (ai) {
          const splitList = (s?: string) => (s ?? '').split(/[;\n]/).map(x => x.trim()).filter(Boolean);
          const num = (s?: string) => { const n = parseFloat((s ?? '').replace(/[^\d.]/g, '')); return Number.isFinite(n) && n > 0 ? n : undefined; };
          if (ai.nom?.trim()) parsed.nom = ai.nom.trim();
          if (ai.description?.trim()) parsed.description = ai.description.trim();
          if (ai.contexte?.trim()) parsed.contexte = ai.contexte.trim();
          if (ai.chefProjet?.trim()) parsed.chefProjet = ai.chefProjet.trim();
          if (ai.region?.trim()) parsed.region = ai.region.trim();
          if (ai.localisation?.trim()) parsed.localisation = ai.localisation.trim();
          const b = num(ai.budgetMFCFA); if (b) parsed.budget = Math.round(b);
          if (/^\d{4}-\d{2}-\d{2}$/.test(ai.dateDebut ?? '')) parsed.dateDebut = ai.dateDebut;
          if (/^\d{4}-\d{2}-\d{2}$/.test(ai.dateFinPrevue ?? '')) parsed.dateFinPrevue = ai.dateFinPrevue;
          const objs = splitList(ai.objectifs); if (objs.length) parsed.objectifs = objs;
          const livs = splitList(ai.livrables); if (livs.length) parsed.livrables = livs;
        }
      }
      const nb = Object.keys(parsed).length;
      if (nb === 0) {
        toast.error('Aucune information exploitable détectée dans les documents.', { id: 'imp-fiche' });
        return;
      }
      if (illisibles.length) toast(`${illisibles.length} document(s) illisible(s) ignoré(s) : ${illisibles.join(', ')}`, { icon: '⚠️', duration: 4000 });
      // On ouvre le formulaire pré-rempli (valeurs actuelles + extractions IA) pour revue.
      setEditForm({
        nom: projet.nom, description: projet.description, objectif: projet.objectif ?? '',
        contexte: projet.contexte ?? '', objectifs: projet.objectifs ?? [], livrables: projet.livrables ?? [],
        chefProjet: projet.chefProjet, region: projet.region, localisation: projet.localisation,
        budget: projet.budget, budgetEngage: projet.budgetEngage, budgetDecaisse: projet.budgetDecaisse,
        dateDebut: projet.dateDebut, dateFinPrevue: projet.dateFinPrevue, dateFinEstimee: projet.dateFinEstimee,
        priorite: projet.priorite, avancement: projet.avancement, avancementPlanifie: projet.avancementPlanifie,
        cpi: projet.cpi, spi: projet.spi,
        ...(parsed as Partial<typeof projet>),
      });
      setShowEditModal(true);
      toast.success(`${nb} champ(s) extrait(s) à partir de ${lus.length} document(s) — vérifiez puis « Enregistrer ».`, { id: 'imp-fiche', duration: 5000 });
    } catch {
      toast.error('Échec de l\'analyse du document.', { id: 'imp-fiche' });
    } finally {
      setImportingFiche(false);
    }
  };

  const handleSaveProjet = () => {
    if (!projet) return;
    commitOrPropose(() => {
      store.updateProjet(projet.id, editForm);
      setShowEditModal(false);
    }, 'Modification des informations du projet');
  };

  const openNouvellesTache = () => {
    if (!projet) return;
    const today = new Date().toISOString().split('T')[0];
    const end   = new Date(Date.now() + 7 * 86400000).toISOString().split('T')[0];
    setEditTacheId(null);
    setTacheForm({ nom: '', type: 'Normale', priorite: 'Moyenne', dateDebut: today, dateFin: end, duree: '7', avancement: 0, statutTache: 'a_faire', commentaire: '', predId: '', predType: 'FS', predLag: 0, coutPrevu: '', coutReel: '' });
    setShowTacheModal(true);
  };

  const openEditTache = (t: typeof taches[0]) => {
    setEditTacheId(t.id);
    setTacheForm({ nom: t.nom, type: t.type, priorite: t.priorite, dateDebut: t.dateDebut, dateFin: t.dateFin, duree: String(t.duree), avancement: t.avancement, statutTache: t.statutTache, commentaire: t.commentaire ?? '', predId: t.predecesseurs[0]?.tacheId ?? '', predType: t.predecesseurs[0]?.type ?? 'FS', predLag: t.predecesseurs[0]?.delai ?? 0, coutPrevu: t.coutPrevu ?? '', coutReel: t.coutReel ?? '' });
    setShowTacheModal(true);
  };

  const handleSaveTache = () => {
    if (!projet) return;
    commitOrPropose(() => {
      if (editTacheId) {
        store.updateTache(projet.id, editTacheId, {
          nom: tacheForm.nom, type: tacheForm.type, priorite: tacheForm.priorite,
          dateDebut: tacheForm.dateDebut, dateFin: tacheForm.dateFin,
          duree: parseInt(tacheForm.duree) || 5, avancement: tacheForm.avancement,
          statutTache: tacheForm.statutTache, commentaire: tacheForm.commentaire,
          predecesseurs: tacheForm.predId ? [{ tacheId: tacheForm.predId, type: tacheForm.predType, delai: tacheForm.predLag }] : [],
          coutPrevu: typeof tacheForm.coutPrevu === 'number' ? tacheForm.coutPrevu : undefined,
          coutReel: typeof tacheForm.coutReel === 'number' ? tacheForm.coutReel : undefined,
        });
      } else {
        store.createTache({
          projetId: projet.id, nom: tacheForm.nom, type: tacheForm.type, niveau: 2,
          ordre: taches.length + 1, duree: parseInt(tacheForm.duree) || 5,
          dateDebut: tacheForm.dateDebut, dateFin: tacheForm.dateFin,
          avancement: tacheForm.avancement, statutTache: tacheForm.statutTache, priorite: tacheForm.priorite,
          predecesseurs: tacheForm.predId ? [{ tacheId: tacheForm.predId, type: tacheForm.predType, delai: tacheForm.predLag }] : [],
          assignations: [], commentaire: tacheForm.commentaire,
          coutPrevu: typeof tacheForm.coutPrevu === 'number' ? tacheForm.coutPrevu : undefined,
          coutReel: typeof tacheForm.coutReel === 'number' ? tacheForm.coutReel : undefined,
        });
      }
      setShowTacheModal(false);
    }, editTacheId ? 'Modification d\'une tâche' : 'Création d\'une tâche');
  };

  const handleToggleJalon = (idx: number) => {
    if (!projet) return;
    commitOrPropose(() => store.updateJalon(projet.id, idx, { atteint: !projet.jalons[idx].atteint }), 'Mise à jour d\'un jalon');
  };

  const handleAddJalon = () => {
    if (!projet || !jalonForm.label || !jalonForm.date) return;
    commitOrPropose(() => {
      store.addJalon(projet.id, { label: jalonForm.label, date: jalonForm.date, atteint: false });
      setJalonForm({ label: '', date: '' });
      setShowJalonModal(false);
    }, 'Ajout d\'un jalon');
  };

  const handleDeleteJalon = (idx: number) => {
    if (!projet) return;
    commitOrPropose(() => store.removeJalon(projet.id, idx), 'Suppression d\'un jalon');
  };

  /* ── Équipe projet : ajout/retrait depuis le personnel RÉEL DPE ── */
  const addEquipeMember = (rid: string) => {
    if (!projet || !rid || projet.equipe.includes(rid)) return;
    commitOrPropose(() => store.updateProjet(projet.id, { equipe: [...projet.equipe, rid] }), 'Ajout d\'un membre à l\'équipe');
  };
  const removeEquipeMember = (rid: string) => {
    if (!projet) return;
    commitOrPropose(() => store.updateProjet(projet.id, { equipe: projet.equipe.filter(x => x !== rid) }), 'Retrait d\'un membre de l\'équipe');
  };

  /* ── Fiche exécutive — section edit helpers ────────── */
  const openFicheEdit = (section: FicheSection) => {
    if (!projet) return;
    if (section === 'description') {
      setFicheDesc(String(projet.description || ficheDefaults.description));
    }
    if (section === 'contexte') {
      setFicheContexte(String(projet.contexte || ficheDefaults.contexte));
    }
    if (section === 'objectifs') {
      setFicheObjectifs(projet.objectifs?.length ? [...projet.objectifs] : [...ficheDefaults.objectifs]);
    }
    if (section === 'livrables') {
      setFicheLivrables(projet.livrables?.length ? [...projet.livrables] : [...ficheDefaults.livrables]);
    }
    setEditingSection(section);
  };
  const closeFicheEdit = () => setEditingSection(null);
  const saveFicheDesc = () => {
    if (!projet) return;
    commitOrPropose(() => {
      store.updateProjet(projet.id, { description: ficheDesc });
      setEditingSection(null);
    }, 'Description du projet');
  };
  const saveFicheContexte = () => {
    if (!projet) return;
    commitOrPropose(() => {
      store.updateProjet(projet.id, { contexte: ficheContexte });
      setEditingSection(null);
    }, 'Contexte & justification');
  };
  const saveFicheObjectifs = () => {
    if (!projet) return;
    commitOrPropose(() => {
      store.updateProjet(projet.id, { objectifs: ficheObjectifs.filter(o => o.trim()) });
      setEditingSection(null);
    }, 'Objectifs du projet');
  };
  const saveFicheLivrables = () => {
    if (!projet) return;
    commitOrPropose(() => {
      store.updateProjet(projet.id, { livrables: ficheLivrables.filter(l => l.trim()) });
      setEditingSection(null);
    }, 'Livrables attendus');
  };

  const SectionEditBtn = ({ section, readOnly }: { section: FicheSection; readOnly?: boolean }) => {
    if (readOnly || isRole('CTRL_FIN')) return null;
    if (!canEditFiche && !canProposeFiche) return null; // lecture seule pour les autres profils
    const propose = canProposeFiche;
    const isActive = editingSection === section;
    return (
      <button
        onClick={() => isActive ? closeFicheEdit() : openFicheEdit(section)}
        title={isActive ? 'Fermer l\'édition' : (propose ? 'Proposer une modification (validation du Chef de Projet)' : 'Modifier cette section')}
        style={{
          marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 4,
          padding: '3px 8px', borderRadius: 6, border: isActive ? `1px solid ${C.orange}` : `1px solid ${C.border}`,
          background: isActive ? `${C.orange}12` : 'transparent', color: isActive ? C.orange : '#94A3B8',
          fontSize: 10, fontWeight: 600, cursor: 'pointer',
        }}
      >
        {isActive ? <><X size={10} /> Fermer</> : (propose ? <><Pencil size={10} /> Proposer</> : <><Pencil size={10} /> Modifier</>)}
      </button>
    );
  };

  if (!projet) {
    return (
      <div style={{ padding: 40, textAlign: 'center', color: '#94A3B8', fontSize: 14 }}>
        Aucun projet disponible — créez un projet dans « Mes Projets »
      </div>
    );
  }

  /* Accès libre à tous les projets — aucune restriction de consultation. */

  /* ─────────────────────── JSX ────────────────────── */
  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', background: C.bg }}>

      {/* ══ Header ══════════════════════════════════════ */}
      <div style={{ background: C.surface, borderBottom: `1px solid ${C.border}`, padding: '0 24px', flexShrink: 0 }}>

        {/* Row 1: sélecteur + actions */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '14px 0 0' }}>
          {/* Sélecteur projet */}
          <div ref={selectorRef} style={{ position: 'relative' }}>
            <button
              onClick={() => setShowSelector(v => !v)}
              style={{
                display: 'flex', alignItems: 'center', gap: 8, padding: '8px 14px',
                borderRadius: 8, border: `1px solid ${C.border}`,
                background: '#fff', cursor: 'pointer', fontFamily: 'inherit',
                fontSize: 13, fontWeight: 700, color: '#1E293B',
                boxShadow: '0 1px 3px rgba(0,0,0,0.06)',
              }}
            >
              {dcfg && <span style={{ fontSize: 14 }}>{dcfg.emoji}</span>}
              <span style={{ maxWidth: 280, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {projet.code} — {projet.nom}
              </span>
              <ChevronDown size={13} style={{ color: '#94A3B8' }} />
            </button>

            {showSelector && (
              <div style={{
                position: 'absolute', top: '100%', left: 0, marginTop: 4,
                background: '#fff', border: `1px solid ${C.border}`, borderRadius: 8,
                boxShadow: '0 8px 24px rgba(0,0,0,0.12)', zIndex: 50,
                minWidth: 400, maxHeight: 380, display: 'flex', flexDirection: 'column',
              }}>
                {/* Recherche projet */}
                <div style={{ padding: 8, borderBottom: `1px solid ${C.border}`, position: 'sticky', top: 0, background: '#fff', zIndex: 1 }}>
                  <div style={{ position: 'relative' }}>
                    <Search size={13} style={{ position: 'absolute', left: 9, top: '50%', transform: 'translateY(-50%)', color: '#94A3B8' }} />
                    <input
                      autoFocus
                      value={selectorQuery}
                      onChange={e => setSelectorQuery(e.target.value)}
                      placeholder="Rechercher (code, nom, région, chef, domaine)…"
                      style={{ width: '100%', padding: '7px 10px 7px 30px', fontSize: 12, borderRadius: 6, border: `1px solid ${C.border}`, fontFamily: 'inherit', outline: 'none', boxSizing: 'border-box' }}
                    />
                  </div>
                </div>
                <div style={{ overflowY: 'auto' }}>
                {store.projets.filter(p => {
                  const q = selectorQuery.trim().toLowerCase();
                  if (!q) return true;
                  const d = DOMAINE_CFG[p.domaine as Domaine];
                  return [p.code, p.nom, p.region, p.chefProjet, d?.label, p.domaine]
                    .filter(Boolean).join(' ').toLowerCase().includes(q);
                }).map(p => {
                  const d = DOMAINE_CFG[p.domaine as Domaine];
                  const ragC = p.cpi < 0.85 || p.spi < 0.80 ? C.red : p.cpi < 0.95 || p.spi < 0.90 ? C.amber : C.green;
                  return (
                    <button
                      key={p.id}
                      onClick={() => { setSelectedProjetId(p.id); setShowSelector(false); setSelectorQuery(''); }}
                      style={{
                        width: '100%', padding: '10px 14px',
                        display: 'flex', alignItems: 'center', gap: 10,
                        background: p.id === selectedProjetId ? '#EFF6FF' : 'transparent',
                        border: 'none', cursor: 'pointer', fontFamily: 'inherit', textAlign: 'left',
                        borderBottom: `1px solid ${C.border}`,
                      }}
                    >
                      <span style={{ fontSize: 15 }}>{d.emoji}</span>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: 12.5, fontWeight: 600, color: '#1E293B' }}>
                          {p.code} — {p.nom.slice(0, 45)}
                        </div>
                        <div style={{ fontSize: 10.5, color: '#94A3B8', marginTop: 2 }}>
                          {d.label} · Av. {p.avancement}% · CPI {p.cpi.toFixed(2)} · {p.region}
                        </div>
                      </div>
                      <div style={{ width: 8, height: 8, borderRadius: '50%', background: ragC, flexShrink: 0 }} />
                    </button>
                  );
                })}
                {store.projets.filter(p => {
                  const q = selectorQuery.trim().toLowerCase();
                  if (!q) return true;
                  const d = DOMAINE_CFG[p.domaine as Domaine];
                  return [p.code, p.nom, p.region, p.chefProjet, d?.label, p.domaine]
                    .filter(Boolean).join(' ').toLowerCase().includes(q);
                }).length === 0 && (
                  <div style={{ padding: 20, textAlign: 'center', color: '#94A3B8', fontSize: 12 }}>Aucun projet ne correspond à « {selectorQuery} »</div>
                )}
                </div>
              </div>
            )}
          </div>

          {/* Baseline info */}
          <div style={{ fontSize: 11, color: '#94A3B8', display: 'flex', alignItems: 'center', gap: 6 }}>
            <Layers size={11} />
            Baseline v2.1 · Synchronisé {TODAY.toLocaleDateString('fr-FR')}
          </div>

          {/* Right actions */}
          <div style={{ marginLeft: 'auto', display: 'flex', gap: 8, alignItems: 'center' }}>
            {!canEditFiche && (
              <span style={{ fontSize: 10, fontWeight: 700, color: canProposeFiche ? C.navy : C.amber, background: canProposeFiche ? `${C.navy}10` : '#FFF7ED', border: `1px solid ${(canProposeFiche ? C.navy : C.amber)}40`, borderRadius: 6, padding: '4px 10px' }}>
                {canProposeFiche ? '✍ Propositions soumises au Chef de Projet' : '👁 Lecture seule'}
              </span>
            )}
            {canEditFiche && (
              <>
                <input ref={ficheFileRef} type="file" multiple style={{ display: 'none' }} onChange={handleImportFiche}
                  accept=".pdf,.doc,.docx,.xls,.xlsx,.csv,.txt,.md" />
                <button
                  onClick={() => ficheFileRef.current?.click()}
                  disabled={importingFiche}
                  title="Importer la fiche projet + rapports + Excel (sélection multiple) — l'IA pré-remplit les champs"
                  style={{
                    display: 'flex', alignItems: 'center', gap: 6, padding: '7px 12px',
                    borderRadius: 7, border: `1px solid ${C.navy}`, background: `${C.navy}0D`,
                    fontSize: 12, color: C.navy, cursor: importingFiche ? 'wait' : 'pointer', fontFamily: 'inherit', fontWeight: 600,
                    opacity: importingFiche ? 0.6 : 1,
                  }}
                >
                  {importingFiche ? '⏳ Analyse IA…' : '📄 Importer fiche + rapports (IA)'}
                </button>
              </>
            )}
            {canEditFiche && (
              <button
                onClick={openEditModal}
                style={{
                  display: 'flex', alignItems: 'center', gap: 6, padding: '7px 12px',
                  borderRadius: 7, border: `1px solid ${C.orange}`, background: `${C.orange}10`,
                  fontSize: 12, color: C.orange, cursor: 'pointer', fontFamily: 'inherit', fontWeight: 600,
                }}
              >
                ✏️ Modifier
              </button>
            )}
            {canEditFiche && (
              <button
                onClick={openNouvellesTache}
                style={{
                  display: 'flex', alignItems: 'center', gap: 6, padding: '7px 14px',
                  borderRadius: 7, border: 'none', background: C.navy,
                  fontSize: 12, color: '#fff', cursor: 'pointer', fontFamily: 'inherit', fontWeight: 600,
                }}
              >
                <Plus size={12} /> Nouvelle tâche
              </button>
            )}
          </div>
        </div>

        {/* Row 2: KPI bar — défilable horizontalement (pas de débordement de page) */}
        <div style={{
          display: 'flex', gap: 0, alignItems: 'center',
          padding: '12px 0',
          borderBottom: `1px solid ${C.border}`,
          overflowX: 'auto', scrollbarWidth: 'thin', WebkitOverflowScrolling: 'touch',
        }}>
          {[
            {
              label: 'Avancement',
              value: `${projet.avancement}%`,
              color: projet.avancement >= projet.avancementPlanifie ? C.green : C.amber,
              sub: projet.avancement >= projet.avancementPlanifie
                ? `+${projet.avancement - projet.avancementPlanifie}%`
                : `-${projet.avancementPlanifie - projet.avancement}%`,
            },
            { label: 'Jalons prochains', value: String(jalonsProches),       color: jalonsProches > 0 ? C.purple : C.slate },
            { label: 'Tâches critiques', value: String(critiques),           color: critiques > 0 ? C.red : C.green },
            { label: 'Blocages',          value: String(blocking),           color: blocking > 0 ? C.red : C.slate },
            { label: 'CPI',               value: projet.cpi.toFixed(2),     color: projet.cpi >= 0.90 ? C.green : C.red },
            { label: 'SPI',               value: projet.spi.toFixed(2),     color: projet.spi >= 0.85 ? C.green : C.amber },
            { label: 'Budget décaissé',   value: `${Math.round(projet.budgetDecaisse / (projet.budget||1) * 100)}%`, color: C.navy },
            ...(kpiContrat ? [{ label: 'Statut global', value: kpiContrat.sg === 'vert' ? '● Vert' : kpiContrat.sg === 'orange' ? '● Orange' : '● Rouge', color: kpiContrat.sg === 'vert' ? C.green : kpiContrat.sg === 'orange' ? C.amber : C.red }] : []),
            { label: 'Chef de projet',    value: projet.chefProjet, color: '#475569', text: true },
          ].map((k, i, arr) => (
            <div key={k.label} style={{
              flex: '1 0 auto', minWidth: 78, textAlign: 'center',
              borderRight: i < arr.length - 1 ? `1px solid ${C.border}` : 'none',
              padding: '0 10px',
            }}>
              <KpiChip {...k} />
            </div>
          ))}
        </div>

        {/* Row 3: Onglets — défilables horizontalement (pas de débordement) */}
        <div style={{ display: 'flex', gap: 0, overflowX: 'auto', scrollbarWidth: 'thin', WebkitOverflowScrolling: 'touch' }}>
          {ONGLETS.map(o => (
            <button
              key={o.id}
              onClick={() => setActiveOnglet(o.id)}
              style={{
                display: 'flex', alignItems: 'center', gap: 6, padding: '9px 16px',
                border: 'none', flexShrink: 0, whiteSpace: 'nowrap',
                borderBottom: activeOnglet === o.id ? `2px solid ${C.orange}` : '2px solid transparent',
                background: 'transparent',
                fontSize: 12.5,
                fontWeight: activeOnglet === o.id ? 700 : 400,
                color: activeOnglet === o.id ? C.orange : '#64748B',
                cursor: 'pointer', fontFamily: 'inherit', marginBottom: -1,
              }}
            >
              {o.icon} {o.label}
            </button>
          ))}
        </div>
      </div>

      {/* ══ Body ════════════════════════════════════════ */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '20px 24px', display: 'flex', flexDirection: 'column', gap: 16 }}>

        {/* ─── SYNTHÈSE ──────────────────────────────── */}
        {activeOnglet === 'synthese' && (
          <>
            {/* Alertes DPE */}
            {kpiContrat && (kpiContrat.alertCaution3m || kpiContrat.alertCaution6m || kpiContrat.alertCpiRouge || kpiContrat.alertSpiRouge) && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                {kpiContrat.alertCaution3m && (
                  <div style={{ background: '#FEF2F2', border: '1px solid #FECACA', borderRadius: 8, padding: '8px 14px', display: 'flex', alignItems: 'center', gap: 8, fontSize: 12 }}>
                    <AlertTriangle size={14} style={{ color: C.red, flexShrink: 0 }} />
                    <span style={{ color: '#7F1D1D', fontWeight: 600 }}>Caution bancaire expire dans moins de 3 mois</span>
                    <span style={{ marginLeft: 'auto', color: '#94A3B8', fontSize: 11 }}>{projet.dateFinCaution ? new Date(projet.dateFinCaution).toLocaleDateString('fr-FR') : '—'}</span>
                  </div>
                )}
                {!kpiContrat.alertCaution3m && kpiContrat.alertCaution6m && (
                  <div style={{ background: '#FFFBEB', border: '1px solid #FDE68A', borderRadius: 8, padding: '8px 14px', display: 'flex', alignItems: 'center', gap: 8, fontSize: 12 }}>
                    <AlertTriangle size={14} style={{ color: C.amber, flexShrink: 0 }} />
                    <span style={{ color: '#78350F', fontWeight: 600 }}>Caution bancaire expire dans moins de 6 mois</span>
                    <span style={{ marginLeft: 'auto', color: '#94A3B8', fontSize: 11 }}>{projet.dateFinCaution ? new Date(projet.dateFinCaution).toLocaleDateString('fr-FR') : '—'}</span>
                  </div>
                )}
                {kpiContrat.alertCpiRouge && (
                  <div style={{ background: '#FFF7ED', border: '1px solid #FED7AA', borderRadius: 8, padding: '8px 14px', display: 'flex', alignItems: 'center', gap: 8, fontSize: 12 }}>
                    <TrendingDown size={14} style={{ color: C.orange, flexShrink: 0 }} />
                    <span style={{ color: '#7C2D12', fontWeight: 600 }}>CPI &lt; 1 — Dépassement budgétaire en cours · CPI = {projet.cpi.toFixed(2)}</span>
                  </div>
                )}
                {kpiContrat.alertSpiRouge && (
                  <div style={{ background: '#FFF7ED', border: '1px solid #FED7AA', borderRadius: 8, padding: '8px 14px', display: 'flex', alignItems: 'center', gap: 8, fontSize: 12 }}>
                    <TrendingDown size={14} style={{ color: C.amber, flexShrink: 0 }} />
                    <span style={{ color: '#7C2D12', fontWeight: 600 }}>SPI &lt; 1 — Retard calendaire en cours · SPI = {projet.spi.toFixed(2)}</span>
                  </div>
                )}
              </div>
            )}

            {/* Bandeau projet */}
            <div style={{ background: `linear-gradient(135deg, ${C.navy} 0%, #1e3a6e 100%)`, borderRadius: 12, padding: '20px 24px', color: '#fff' }}>
              <div style={{ display: 'flex', alignItems: 'flex-start', gap: 18 }}>
                <div style={{ fontSize: 40, lineHeight: 1 }}>{dcfg?.emoji}</div>
                <div style={{ flex: 1 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 4 }}>
                    <span style={{ fontSize: 11, fontWeight: 700, background: 'rgba(255,255,255,0.2)', padding: '2px 10px', borderRadius: 20 }}>{projet.code}</span>
                    <span style={{ fontSize: 11, background: projet.statut === 'en_cours' ? '#16A34A' : '#F47920', padding: '2px 10px', borderRadius: 20, fontWeight: 700 }}>
                      {projet.statut === 'en_cours' ? '● En cours' : projet.statut === 'termine' ? '✓ Terminé' : projet.statut}
                    </span>
                    <span style={{ fontSize: 11, opacity: 0.7 }}>{projet.domaine} · {projet.region}</span>
                  </div>
                  <div style={{ fontSize: 20, fontWeight: 800, marginBottom: 6 }}>{projet.nom}</div>
                  <div style={{ fontSize: 12, opacity: 0.75 }}>
                    Chef de projet : <strong>{projet.chefProjet}</strong> &nbsp;·&nbsp;
                    {new Date(projet.dateDebut).toLocaleDateString('fr-FR')} → {new Date(projet.dateFinPrevue).toLocaleDateString('fr-FR')} &nbsp;·&nbsp;
                    Budget : <strong>{projet.budget.toLocaleString('fr-FR')} MFCFA</strong>
                  </div>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6, alignItems: 'flex-end' }}>
                  {projet.bailleurs.map((b, i) => (
                    <span key={i} style={{ fontSize: 10.5, background: 'rgba(255,255,255,0.15)', padding: '3px 10px', borderRadius: 20 }}>
                      {b.nom} — {b.montant} MFCFA
                    </span>
                  ))}
                </div>
              </div>
            </div>

            {/* Indicateurs Métier Énergie */}
            {energyMetrics.length > 0 && (
              <div style={{ background: '#fff', borderRadius: 12, border: `1px solid ${C.border}`, padding: '16px 20px' }}>
                <div style={{ fontSize: 13, fontWeight: 700, color: C.navy, marginBottom: 14, display: 'flex', alignItems: 'center', gap: 6 }}>
                  <Activity size={14} style={{ color: C.orange }} /> Réalisations physiques — Métier Énergie
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: `repeat(${energyMetrics.length}, 1fr)`, gap: 12 }}>
                  {energyMetrics.map(m => (
                    <div key={m.label} style={{ background: '#F8FAFC', borderRadius: 8, padding: '12px', borderLeft: `3px solid ${C.orange}`, textAlign: 'center' }}>
                      <div style={{ fontSize: 18, marginBottom: 4 }}>{m.icon}</div>
                      <div style={{ fontSize: 18, fontWeight: 800, color: '#1E293B' }}>{m.value}</div>
                      <div style={{ fontSize: 10.5, color: '#64748B', fontWeight: 600 }}>{m.label}</div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Barres de progression */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12 }}>
              {[
                { label: 'Avancement physique', real: projet.avancement, plan: projet.avancementPlanifie, color: C.navy },
                { label: 'Consommation budget', real: Math.round(projet.budgetDecaisse / (projet.budget||1) * 100), plan: Math.round(projet.budgetEngage / (projet.budget||1) * 100), color: C.orange },
                { label: 'Délai consommé',       real: Math.round((+new Date(TODAY) - +new Date(projet.dateDebut)) / (+new Date(projet.dateFinPrevue) - +new Date(projet.dateDebut)) * 100), plan: 100, color: C.purple },
              ].map(b => (
                <div key={b.label} style={{ background: '#fff', borderRadius: 10, border: `1px solid ${C.border}`, padding: '14px 16px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
                    <span style={{ fontSize: 11.5, fontWeight: 600, color: '#475569' }}>{b.label}</span>
                    <span style={{ fontSize: 16, fontWeight: 800, color: b.color }}>{Math.min(100, Math.max(0, b.real))}%</span>
                  </div>
                  <div style={{ height: 8, background: '#F1F5F9', borderRadius: 4, overflow: 'hidden', marginBottom: 4 }}>
                    <div style={{ height: '100%', width: `${Math.min(100, Math.max(0, b.real))}%`, background: b.color, borderRadius: 4, transition: 'width 0.6s ease' }} />
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 10, color: '#94A3B8' }}>
                    <span>Planifié : {Math.min(100, b.plan)}%</span>
                    <span style={{ color: b.real >= b.plan ? C.green : C.red, fontWeight: 600 }}>
                      {b.real >= b.plan ? `+${b.real - b.plan}%` : `${b.real - b.plan}%`}
                    </span>
                  </div>
                </div>
              ))}
            </div>

            {/* KPIs + Jalons */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
              {/* KPIs EVM */}
              <div style={{ background: '#fff', borderRadius: 10, border: `1px solid ${C.border}`, padding: '16px 20px' }}>
                <div style={{ fontSize: 13, fontWeight: 700, color: '#1E293B', marginBottom: 14 }}>Indicateurs EVM</div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 10 }}>
                  {[
                    { label: 'CPI — Cost Perf.', value: projet.cpi.toFixed(2), ok: projet.cpi >= 0.90 },
                    { label: 'SPI — Schedule Perf.', value: projet.spi.toFixed(2), ok: projet.spi >= 0.85 },
                    { label: 'Tâches totales', value: String(taches.length), ok: true },
                    { label: 'Tâches bloquées', value: String(blocking), ok: blocking === 0 },
                  ].map(k => (
                    <div key={k.label} style={{ background: k.ok ? '#F0FDF4' : '#FEF2F2', borderRadius: 8, padding: '10px 12px', border: `1px solid ${k.ok ? '#BBF7D0' : '#FECACA'}` }}>
                      <div style={{ fontSize: 20, fontWeight: 800, color: k.ok ? C.green : C.red }}>{k.value}</div>
                      <div style={{ fontSize: 10.5, color: '#64748B', marginTop: 2 }}>{k.label}</div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Jalons */}
              <div style={{ background: '#fff', borderRadius: 10, border: `1px solid ${C.border}`, padding: '16px 20px' }}>
                <div style={{ fontSize: 13, fontWeight: 700, color: '#1E293B', marginBottom: 14, display: 'flex', alignItems: 'center', gap: 6 }}>
                  <Flag size={13} style={{ color: C.orange }} /> Jalons
                  {jalonsProches > 0 && <span style={{ fontSize: 10, background: '#FFF7ED', color: C.orange, padding: '1px 7px', borderRadius: 10, fontWeight: 700 }}>{jalonsProches} proches</span>}
                  <button onClick={() => setShowJalonModal(true)} style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 4, fontSize: 10, color: C.navy, background: `${C.navy}10`, border: `1px solid ${C.navy}30`, borderRadius: 5, padding: '2px 8px', cursor: 'pointer', fontFamily: 'inherit' }}>
                    <Plus size={9} /> Jalon
                  </button>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {projet.jalons.slice(0, 5).map((j, i) => {
                    const d = new Date(j.date);
                    const overdue = !j.atteint && d < TODAY;
                    const soon = !j.atteint && d >= TODAY && (d.getTime() - TODAY.getTime()) <= 30 * 86400000;
                    return (
                      <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                        <button
                          onClick={() => handleToggleJalon(i)}
                          title={j.atteint ? 'Marquer non atteint' : 'Marquer atteint'}
                          style={{ width: 16, height: 16, borderRadius: '50%', border: `2px solid ${j.atteint ? C.green : overdue ? C.red : soon ? C.amber : '#D1D5DB'}`, background: j.atteint ? C.green : 'transparent', cursor: 'pointer', flexShrink: 0, padding: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                        >
                          {j.atteint && <span style={{ color: '#fff', fontSize: 8, fontWeight: 900 }}>✓</span>}
                        </button>
                        <div style={{ flex: 1, fontSize: 11.5, color: j.atteint ? '#94A3B8' : '#374151', textDecoration: j.atteint ? 'line-through' : 'none' }}>{j.label}</div>
                        <div style={{ fontSize: 10.5, color: overdue ? C.red : '#94A3B8', fontWeight: overdue ? 700 : 400 }}>
                          {d.toLocaleDateString('fr-FR', { day: '2-digit', month: 'short' })}
                        </div>
                        {overdue && <AlertTriangle size={12} style={{ color: C.red }} />}
                        <button onClick={() => handleDeleteJalon(i)} aria-label={`Supprimer le jalon : ${j.label}`} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#CBD5E1', padding: 0, display: 'flex', opacity: 0.5 }}>
                          <X size={10} />
                        </button>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>

            {/* Répartition tâches + équipe */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
              {/* Donut statuts */}
              <div style={{ background: '#fff', borderRadius: 10, border: `1px solid ${C.border}`, padding: '16px 20px' }}>
                <div style={{ fontSize: 13, fontWeight: 700, color: '#1E293B', marginBottom: 4 }}>Répartition des tâches</div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
                  <ResponsiveContainer width={130} height={130}>
                    <PieChart>
                      <Pie data={[
                        { name: 'Terminé', value: taches.filter(t => t.statutTache === 'termine').length, fill: C.green },
                        { name: 'En cours', value: taches.filter(t => t.statutTache === 'en_cours').length, fill: C.navy },
                        { name: 'À faire', value: taches.filter(t => t.statutTache === 'a_faire').length, fill: '#D1D5DB' },
                        { name: 'Bloqué', value: taches.filter(t => t.statutTache === 'bloque').length, fill: C.red },
                      ].filter(d => d.value > 0)}
                        cx="50%" cy="50%" innerRadius={35} outerRadius={58} dataKey="value"
                      >
                        {[C.green, C.navy, '#D1D5DB', C.red].map((c, i) => <Cell key={i} fill={c} />)}
                      </Pie>
                    </PieChart>
                  </ResponsiveContainer>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                    {([['termine','Terminées',C.green],['en_cours','En cours',C.navy],['a_faire','À faire','#94A3B8'],['bloque','Bloquées',C.red]] as [StatutTache,string,string][]).map(([s,l,c]) => (
                      <div key={s} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 11 }}>
                        <div style={{ width: 10, height: 10, borderRadius: 3, background: c }} />
                        <span style={{ color: '#64748B' }}>{l}</span>
                        <span style={{ fontWeight: 700, color: '#1E293B', marginLeft: 'auto' }}>{taches.filter(t => t.statutTache === s).length}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              {/* Équipe chips */}
              <div style={{ background: '#fff', borderRadius: 10, border: `1px solid ${C.border}`, padding: '16px 20px' }}>
                <div style={{ fontSize: 13, fontWeight: 700, color: '#1E293B', marginBottom: 14, display: 'flex', alignItems: 'center', gap: 6 }}>
                  <Users size={13} style={{ color: C.navy }} /> Équipe ({equipe.length})
                </div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                  {equipe.map((r, i) => {
                    if (!r) return null;
                    const initials = `${r.prenom[0]}${r.nom[0]}`.toUpperCase();
                    const colors = [C.navy, C.orange, C.purple, C.green, C.amber, C.red];
                    const col = colors[i % colors.length];
                    return (
                      <div key={r.id} title={`${r.prenom} ${r.nom} — ${r.type}`} style={{
                        display: 'flex', alignItems: 'center', gap: 7, padding: '5px 10px 5px 5px',
                        background: `${col}10`, border: `1px solid ${col}30`, borderRadius: 20,
                      }}>
                        <div style={{ width: 24, height: 24, borderRadius: '50%', background: col, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 9, fontWeight: 800, color: '#fff' }}>{initials}</div>
                        <span style={{ fontSize: 11.5, fontWeight: 600, color: '#374151' }}>{r.prenom}</span>
                      </div>
                    );
                  })}
                  {equipe.length === 0 && <span style={{ fontSize: 12, color: '#94A3B8' }}>Aucun membre assigné</span>}
                </div>
              </div>
            </div>
          </>
        )}

        {/* ─── PLANNING ──────────────────────────────── */}
        {activeOnglet === 'planning' && (
          <>
            {/* Roadmap Visuelle */}
            <div style={{ background: '#fff', borderRadius: 10, border: `1px solid ${C.border}`, padding: 16, marginBottom: 8 }}>
              <div style={{ fontSize: 12.5, fontWeight: 700, color: '#1E293B', marginBottom: 16, display: 'flex', alignItems: 'center', gap: 6 }}>
                <GanttChart size={13} style={{ color: C.navy }} /> Roadmap du projet
              </div>
              <div style={{ position: 'relative', background: '#F8FAFC', borderRadius: 8, padding: '14px 10px' }}>
                 {/* Barres roadmap = les 6 phases pondérées du cycle DPE (largeur ∝ pondération) */}
                 <div style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
                    {(() => {
                      const phs = (projet.phases ?? PHASES_DEFAUT);
                      const total = phs.reduce((s, p) => s + p.poids, 0) || 100;
                      const palette = ['#64748B', C.purple, C.orange, C.navy, C.green, C.amber];
                      let acc = 0;
                      return phs.map((ph, i) => {
                        const start = (acc / total) * 100; acc += ph.poids;
                        const width = (ph.poids / total) * 100;
                        return { id: ph.id, label: ph.label, poids: ph.poids, start, width, color: palette[i % palette.length], av: ph.avancement };
                      });
                    })().map(r => (
                      <div key={r.id} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <div style={{ fontSize: 9.5, fontWeight: 700, color: '#475569', width: 96, flexShrink: 0, overflowWrap: 'anywhere', lineHeight: 1.1 }}>
                          {r.label} <span style={{ color: '#94A3B8', fontWeight: 600 }}>· {r.poids}%</span>
                        </div>
                        <div style={{ flex: 1, height: 13, background: '#E2E8F0', borderRadius: 6, position: 'relative', overflow: 'hidden' }}>
                           <div style={{ position: 'absolute', left: `${r.start}%`, width: `${r.width}%`, height: '100%', background: r.color, borderRadius: 6, opacity: 0.35 }} />
                           <div style={{ position: 'absolute', left: `${r.start}%`, width: `${r.width * (r.av / 100)}%`, height: '100%', background: r.color, borderRadius: 6 }} />
                        </div>
                        <div style={{ fontSize: 9, fontWeight: 700, color: '#64748B', width: 30, textAlign: 'right', flexShrink: 0 }}>{r.av}%</div>
                      </div>
                    ))}
                 </div>
              </div>
            </div>

            {/* Filtres statuts */}
            <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
              <span style={{ fontSize: 11.5, color: '#64748B', fontWeight: 600 }}>Filtrer :</span>
              {([['all', 'Toutes'], ['en_cours', 'En cours'], ['bloque', 'Bloquées'], ['a_faire', 'À faire'], ['termine', 'Terminées']] as [StatutTache | 'all', string][]).map(([s, l]) => (
                <button
                  key={s}
                  onClick={() => setFilterStatut(s)}
                  style={{
                    padding: '4px 10px', borderRadius: 20,
                    border: `1px solid ${filterStatut === s ? C.navy : C.border}`,
                    background: filterStatut === s ? C.navy : '#fff',
                    color: filterStatut === s ? '#fff' : '#475569',
                    fontSize: 11.5, cursor: 'pointer', fontFamily: 'inherit',
                    fontWeight: filterStatut === s ? 700 : 400,
                  }}
                >
                  {l}
                </button>
              ))}
              <span style={{ marginLeft: 'auto', fontSize: 11.5, color: '#94A3B8' }}>
                {filteredTaches.length} tâche{filteredTaches.length > 1 ? 's' : ''}
              </span>
            </div>

            {/* Planning table */}
            <div style={{
              background: '#fff', borderRadius: 10, border: `1px solid ${C.border}`,
              boxShadow: '0 1px 4px rgba(0,0,0,0.06)', overflow: 'hidden',
            }}>
              {/* En-tête */}
              <div style={{
                display: 'grid',
                gridTemplateColumns: '24px 28px 1fr 140px 120px 36px 36px 36px 36px 36px',
                padding: '9px 14px', background: '#F8FAFC',
                borderBottom: `1px solid ${C.border}`,
                fontSize: 10.5, fontWeight: 700, color: '#94A3B8',
                textTransform: 'uppercase', letterSpacing: '0.06em', gap: 8, alignItems: 'center',
              }}>
                <span></span><span></span>
                <span>Tâche / WBS</span>
                <span>Responsable</span>
                <span>Statut</span>
                {['S1','S2','S3','S4','S5'].map(s => (
                  <span key={s} style={{ textAlign: 'center' }}>{s}</span>
                ))}
              </div>

              {/* Repère aujourd'hui */}
              <div style={{
                padding: '4px 14px', background: `${C.orange}08`,
                borderBottom: `1px solid #FED7AA`,
                fontSize: 10.5, color: C.orange, fontWeight: 600,
                display: 'flex', alignItems: 'center', gap: 6,
              }}>
                <div style={{ width: 6, height: 6, borderRadius: '50%', background: C.orange }} />
                Aujourd&apos;hui — {TODAY.toLocaleDateString('fr-FR')} · Semaine courante = S3
                <span style={{ marginLeft: 'auto', display: 'flex', gap: 16 }}>
                  <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                    <div style={{ width: 18, height: 3, background: C.navy, borderRadius: 2, opacity: 0.5 }} />
                    Planifié
                  </span>
                  <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                    <div style={{ width: 18, height: 3, background: C.orange, borderRadius: 2 }} />
                    Actif
                  </span>
                </span>
              </div>

              {/* Lignes tâches */}
              {filteredTaches.map(t => {
                const sd  = STATUT_DISP[t.statutTache];
                const pd  = PRIOR_DISP[t.priorite];
                const slots = planningSlots(t);
                const isRecap = t.type === 'Récapitulative';

                return (
                  <div key={t.id}>
                    <div
                      onClick={() => openEditTache(t)}
                      style={{
                        display: 'grid',
                        gridTemplateColumns: '24px 28px 1fr 140px 120px 36px 36px 36px 36px 36px',
                        padding: isRecap ? '8px 14px' : '6px 14px',
                        borderBottom: `1px solid ${t.statutTache === 'bloque' ? '#FECACA' : '#F1F5F9'}`,
                        gap: 8, alignItems: 'center',
                        background: t.statutTache === 'bloque' ? '#FFF8F8' : isRecap ? '#FAFBFF' : 'transparent',
                        cursor: 'pointer',
                      }}
                    >
                      {/* Expand toggle */}
                      <div style={{ display: 'flex', justifyContent: 'center' }}>
                        {isRecap ? (
                          <button
                            onClick={() => setExpandedTaches(s => {
                              const n = new Set(s);
                              n.has(t.id) ? n.delete(t.id) : n.add(t.id);
                              return n;
                            })}
                            aria-label={expandedTaches.has(t.id) ? `Réduire la tâche : ${t.nom}` : `Développer la tâche : ${t.nom}`}
                            style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#94A3B8', padding: 0 }}
                          >
                            {expandedTaches.has(t.id)
                              ? <ChevronDown size={13} />
                              : <ChevronRight size={13} />}
                          </button>
                        ) : <Minus size={9} style={{ color: '#E2E8F0' }} />}
                      </div>

                      {/* Priorité dot */}
                      <div style={{ display: 'flex', justifyContent: 'center' }}>
                        <div
                          title={pd.label}
                          style={{ width: 8, height: 8, borderRadius: '50%', background: pd.color, boxShadow: `0 0 0 2px ${pd.color}30` }}
                        />
                      </div>

                      {/* Nom */}
                      <div style={{ paddingLeft: t.niveau === 2 ? 16 : 0 }}>
                        <div style={{ fontSize: isRecap ? 13 : 12, fontWeight: isRecap ? 700 : 500, color: '#1E293B', display: 'flex', alignItems: 'center', gap: 6 }}>
                          {isRecap && <Layers size={11} style={{ color: C.navy, opacity: 0.7 }} />}
                          {t.nom}
                          {t.statutTache === 'bloque' && (
                            <span style={{ fontSize: 9.5, color: C.red, background: '#FEE2E2', padding: '1px 5px', borderRadius: 4, fontWeight: 600 }}>BLOQUÉ</span>
                          )}
                        </div>
                        <div style={{ fontSize: 9.5, color: '#94A3B8', marginTop: 1 }}>
                          {new Date(t.dateDebut).toLocaleDateString('fr-FR')} → {new Date(t.dateFin).toLocaleDateString('fr-FR')} · {t.duree}j
                        </div>
                      </div>

                      {/* Responsable */}
                      <div style={{ fontSize: 11, color: '#475569' }}>
                        {t.assignations.length > 0
                          ? store.ressources.find(r => r.id === t.assignations[0]?.ressourceId)?.nom ?? '—'
                          : '—'}
                      </div>

                      {/* Statut badge */}
                      <div>
                        <span style={{
                          display: 'inline-flex', alignItems: 'center', gap: 4,
                          fontSize: 10, fontWeight: 600,
                          color: sd.color, background: sd.bg, padding: '2px 8px', borderRadius: 10,
                        }}>
                          {sd.icon} {sd.label}
                        </span>
                      </div>

                      {/* Planning S1-S5 */}
                      {slots.map((v, si) => <PlanCell key={si} val={v} />)}
                    </div>

                    {/* Avancement bar sous la tâche */}
                    {t.avancement > 0 && (
                      <div style={{
                        height: 2, background: '#F1F5F9',
                        paddingLeft: t.niveau === 2 ? 76 : 64,
                        paddingRight: 14,
                        marginTop: -1, marginBottom: 0,
                      }}>
                        <div style={{ height: '100%', background: sd.color, width: `${t.avancement}%`, opacity: 0.5 }} />
                      </div>
                    )}
                  </div>
                );
              })}

              {/* Footer */}
              <div style={{
                padding: '10px 14px', background: '#F8FAFC',
                display: 'flex', gap: 20, alignItems: 'center', borderTop: `1px solid ${C.border}`,
              }}>
                <div style={{ fontSize: 11, color: '#94A3B8' }}>
                  {critiques} tâche{critiques > 1 ? 's' : ''} critique{critiques > 1 ? 's' : ''} · {blocking} blocage{blocking > 1 ? 's' : ''}
                </div>
                <div style={{ marginLeft: 'auto', display: 'flex', gap: 14 }}>
                  {(['termine', 'en_cours', 'bloque', 'a_faire'] as StatutTache[]).map(s => {
                    const count = taches.filter(t => t.statutTache === s).length;
                    const d = STATUT_DISP[s];
                    return (
                      <div key={s} style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 11 }}>
                        <div style={{ width: 6, height: 6, borderRadius: '50%', background: d.color }} />
                        <span style={{ color: '#64748B' }}>{d.label}</span>
                        <strong style={{ color: '#1E293B' }}>{count}</strong>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>

            {/* Jalons */}
            <div style={{ background: '#fff', borderRadius: 10, border: `1px solid ${C.border}`, padding: 16 }}>
              <div style={{ fontSize: 12.5, fontWeight: 700, color: '#1E293B', marginBottom: 12, display: 'flex', alignItems: 'center', gap: 6 }}>
                <Flag size={13} style={{ color: C.purple }} /> Jalons du projet
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: 8 }}>
                {projet.jalons.map((j, i) => {
                  const d = new Date(j.date);
                  const isPast = d < TODAY;
                  const isUrgent = !j.atteint && d >= TODAY && (d.getTime() - TODAY.getTime()) <= 30 * 86400000;
                  return (
                    <div
                      key={i}
                      onClick={() => handleToggleJalon(i)}
                      title="Cliquer pour marquer atteint/non atteint"
                      style={{
                        padding: '10px 12px', borderRadius: 8, cursor: 'pointer',
                        border: `1px solid ${j.atteint ? '#DCFCE7' : isUrgent ? '#FED7AA' : C.border}`,
                        background: j.atteint ? '#F0FDF4' : isUrgent ? '#FFF7ED' : '#F8FAFC',
                        transition: 'all 0.15s',
                      }}
                    >
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                        <span style={{ fontSize: 11.5, fontWeight: 600, color: j.atteint ? '#94A3B8' : '#1E293B', lineHeight: 1.4, flex: 1, textDecoration: j.atteint ? 'line-through' : 'none' }}>{j.label}</span>
                        <span style={{
                          fontSize: 9.5, fontWeight: 700, padding: '1px 6px', borderRadius: 10, marginLeft: 8,
                          color: j.atteint ? C.green : isUrgent ? C.amber : C.slate,
                          background: j.atteint ? '#DCFCE7' : isUrgent ? '#FFF3CD' : '#F1F5F9',
                        }}>
                          {j.atteint ? '✓ Atteint' : isUrgent ? '⚠ Urgent' : isPast ? 'Dépassé' : 'Prévu'}
                        </span>
                      </div>
                      <div style={{ fontSize: 10.5, color: '#94A3B8', marginTop: 4, display: 'flex', alignItems: 'center', gap: 4 }}>
                        <Calendar size={9} /> {d.toLocaleDateString('fr-FR')}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </>
        )}


        {/* ─── ZONES & QUANTITÉS ──────────────────────── */}
        {activeOnglet === 'zones' && (
          <ZonesQuantites
            projetCode={projet.code}
            projetNom={projet.nom}
            projetDomaine={projet.domaine}
            programme={(projet as { programme?: string }).programme}
            canEdit={!isRole('CTRL_FIN')}
          />
        )}


        {/* ─── PONDÉRATION PAR PHASES (tous projets) ───────────────────────── */}
        {activeOnglet === 'ponderation' && (
          <>
            {/* Description */}
            <div style={{ background: `linear-gradient(135deg, ${C.navy}08, ${C.navy}14)`, borderRadius: 10, border: `1px solid ${C.navy}20`, padding: '14px 18px' }}>
              <div style={{ fontSize: 12, fontWeight: 700, color: C.navy, marginBottom: 4 }}>⚖️ Pondération par phases du projet</div>
              <div style={{ fontSize: 11, color: '#64748B', lineHeight: 1.6 }}>
                Ajustez les poids de chaque phase pour personnaliser le calcul de l&apos;avancement pondéré du projet.
                Ce modèle s&apos;applique à <strong>tous les projets</strong> (transport, distribution, production, commercial, génie civil), quel que soit le programme.
                La somme des pondérations doit être égale à <strong>100%</strong>. Les modifications s&apos;appliquent immédiatement au calcul.
              </div>
            </div>

            {/* Phase editor */}
            <div style={{ background: '#fff', borderRadius: 10, border: `1px solid ${C.border}`, overflow: 'hidden' }}>
              <div style={{ padding: '12px 16px', borderBottom: `1px solid ${C.border}`, display: 'flex', alignItems: 'center', gap: 10 }}>
                <span style={{ fontSize: 12, fontWeight: 700, color: C.navy, flex: 1 }}>Phases du projet — pondération et avancement</span>
                {!editPoidsMode ? (
                  <button onClick={() => {
                    const init: Record<string, number> = {};
                    (projet.phases ?? []).forEach(ph => { init[ph.id] = ph.poids; });
                    setEditPoids(init);
                    setEditPoidsMode(true);
                  }} style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '5px 12px', borderRadius: 6, border: `1px solid ${C.navy}`, background: `${C.navy}10`, color: C.navy, fontSize: 11, fontWeight: 600, cursor: 'pointer' }}>
                    <Sliders size={11} /> Modifier les poids
                  </button>
                ) : (
                  <>
                    {(() => {
                      const sum = Object.values(editPoids).reduce((s, v) => s + v, 0);
                      return <span style={{ fontSize: 11, fontWeight: 700, color: sum === 100 ? C.green : C.red, marginRight: 8 }}>Total : {sum}% {sum === 100 ? '✓' : `(manque ${100 - sum}%)`}</span>;
                    })()}
                    <button onClick={() => {
                      const sum = Object.values(editPoids).reduce((s, v) => s + v, 0);
                      if (sum !== 100) { alert('La somme des pondérations doit être 100%.'); return; }
                      const newPhases = (projet.phases ?? []).map(ph => ({ ...ph, poids: editPoids[ph.id] ?? ph.poids }));
                      store.updateProjet(projet.id, { phases: newPhases });
                      setEditPoidsMode(false);
                    }} style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '5px 12px', borderRadius: 6, border: 'none', background: C.green, color: '#fff', fontSize: 11, fontWeight: 700, cursor: 'pointer' }}>
                      <Check size={11} /> Enregistrer
                    </button>
                    <button onClick={() => setEditPoidsMode(false)} style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '5px 10px', borderRadius: 6, border: `1px solid ${C.border}`, background: '#fff', color: '#374151', fontSize: 11, cursor: 'pointer' }}>
                      <X size={10} /> Annuler
                    </button>
                  </>
                )}
              </div>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 11 }}>
                <thead>
                  <tr style={{ background: `${C.navy}06`, borderBottom: `1px solid ${C.border}` }}>
                    {['#', 'Phase', 'Pondération (%)', 'Avancement réalisé (%)', 'Contribution', 'Statut'].map(h => (
                      <th key={h} style={{ padding: '9px 12px', textAlign: 'left', fontWeight: 700, color: C.navy, fontSize: 10, textTransform: 'uppercase', letterSpacing: '.5px' }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {(projet.phases ?? []).map((ph, i) => {
                    const poids = editPoidsMode ? (editPoids[ph.id] ?? ph.poids) : ph.poids;
                    const contrib = (poids * ph.avancement / 100);
                    const sc = ph.avancement === 100 ? { label: 'Terminée', color: C.green } : ph.avancement > 0 ? { label: 'En cours', color: C.navy } : { label: 'À venir', color: '#94A3B8' };
                    return (
                      <tr key={ph.id} style={{ borderBottom: '1px solid #F1F5F9', background: i % 2 === 0 ? '#fff' : '#FAFAFA' }}>
                        <td style={{ padding: '10px 12px', fontWeight: 800, color: '#94A3B8', width: 30 }}>{i + 1}</td>
                        <td style={{ padding: '10px 12px', fontWeight: 600, color: '#1E293B' }}>{ph.label}</td>
                        <td style={{ padding: '10px 12px' }}>
                          {editPoidsMode ? (
                            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                              <input type="range" min={0} max={80} value={editPoids[ph.id] ?? ph.poids}
                                onChange={e => setEditPoids(prev => ({ ...prev, [ph.id]: Number(e.target.value) }))}
                                style={{ width: 100 }} />
                              <input type="number" min={0} max={80} value={editPoids[ph.id] ?? ph.poids}
                                onChange={e => setEditPoids(prev => ({ ...prev, [ph.id]: Number(e.target.value) }))}
                                style={{ width: 48, padding: '2px 6px', borderRadius: 4, border: `1px solid ${C.border}`, fontSize: 11, fontWeight: 700, textAlign: 'center' }} />
                              <span style={{ fontSize: 10, color: '#94A3B8' }}>%</span>
                            </div>
                          ) : (
                            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                              <div style={{ flex: 1, height: 8, borderRadius: 4, background: '#E5E7EB', overflow: 'hidden', maxWidth: 80 }}>
                                <div style={{ width: `${poids}%`, height: '100%', background: C.navy, borderRadius: 4 }} />
                              </div>
                              <span style={{ fontWeight: 700, color: C.navy }}>{poids}%</span>
                            </div>
                          )}
                        </td>
                        <td style={{ padding: '10px 12px' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                            <input type="range" min={0} max={100} value={ph.avancement}
                              onChange={e => store.updatePhase(projet.id, ph.id, Number(e.target.value))}
                              style={{ width: 100 }} />
                            <span style={{ fontWeight: 700, color: ph.avancement === 100 ? C.green : C.navy, minWidth: 30 }}>{ph.avancement}%</span>
                          </div>
                        </td>
                        <td style={{ padding: '10px 12px', fontFamily: 'monospace', fontWeight: 700, color: C.purple }}>
                          {contrib.toFixed(2)}%
                        </td>
                        <td style={{ padding: '10px 12px' }}>
                          <span style={{ fontSize: 10, fontWeight: 700, padding: '2px 8px', borderRadius: 99, background: `${sc.color}15`, color: sc.color }}>{sc.label}</span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
                <tfoot>
                  <tr style={{ background: `${C.navy}08`, borderTop: `2px solid ${C.navy}20` }}>
                    <td colSpan={2} style={{ padding: '10px 12px', fontWeight: 800, color: C.navy, fontSize: 12 }}>TOTAL</td>
                    <td style={{ padding: '10px 12px', fontWeight: 800, color: C.navy }}>
                      {editPoidsMode
                        ? <span style={{ color: Object.values(editPoids).reduce((s, v) => s + v, 0) === 100 ? C.green : C.red }}>{Object.values(editPoids).reduce((s, v) => s + v, 0)}%</span>
                        : <span>{(projet.phases ?? []).reduce((s, p) => s + p.poids, 0)}%</span>
                      }
                    </td>
                    <td style={{ padding: '10px 12px' }} />
                    <td style={{ padding: '10px 12px', fontWeight: 800, color: C.purple, fontFamily: 'monospace' }}>
                      {((projet.phases ?? []).reduce((s, ph) => s + ph.poids * ph.avancement / 100, 0)).toFixed(2)}% pondéré
                    </td>
                    <td style={{ padding: '10px 12px', fontWeight: 700, color: C.green, fontSize: 13 }}>
                      Av. réel : {((projet.phases ?? []).reduce((s, ph) => s + ph.poids * ph.avancement / 100, 0) / Math.max(1, (projet.phases ?? []).reduce((s, p) => s + p.poids, 0)) * 100).toFixed(1)}%
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </>
        )}

        {/* ─── COÛTS ─────────────────────────────────── */}
        {activeOnglet === 'couts' && finances && (
          <>
            {/* KPI finances */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12 }}>
              {[
                { label: 'Budget total',      value: `${finances.budgetTotal.toLocaleString('fr-FR')} MFCFA`, icon: <Banknote size={16} style={{ color: C.navy }} />,   color: C.navy,   bg: '#EFF6FF' },
                { label: 'Engagé',            value: `${finances.engage.toLocaleString('fr-FR')} MFCFA`,      icon: <BarChart3 size={16} style={{ color: C.orange }} />, color: C.orange, bg: '#FFF7ED', sub: `${finances.tauxEngage.toFixed(0)}% du budget` },
                { label: 'Décaissé',          value: `${finances.decaisse.toLocaleString('fr-FR')} MFCFA`,    icon: <ArrowDownRight size={16} style={{ color: C.amber }} />, color: C.amber, bg: '#FFFBEB', sub: `${finances.tauxDecaiss.toFixed(0)}% du budget` },
                { label: 'Reste à engager',   value: `${finances.solde.toLocaleString('fr-FR')} MFCFA`,       icon: <ArrowUpRight size={16} style={{ color: C.green }} />, color: C.green,  bg: '#F0FDF4' },
              ].map(k => (
                <div key={k.label} style={{ background: k.bg, border: `1px solid ${k.color}20`, borderRadius: 10, padding: '14px 16px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8 }}>
                    <span style={{ fontSize: 11.5, color: '#64748B', fontWeight: 600 }}>{k.label}</span>
                    {k.icon}
                  </div>
                  <div style={{ fontSize: 20, fontWeight: 800, color: k.color }}>{k.value}</div>
                  {k.sub && <div style={{ fontSize: 10.5, color: '#94A3B8', marginTop: 4 }}>{k.sub}</div>}
                </div>
              ))}
            </div>

            {/* Taux de performance financière */}
            {kpiContrat && (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12 }}>
                {[
                  { label: 'Taux de facturation',  value: `${kpiContrat.tauxFacturation.toFixed(1)}%`,  ok: kpiContrat.tauxFacturation >= 80, tip: 'Facturé / Marché' },
                  { label: 'Taux de paiement',     value: `${kpiContrat.tauxPaiement.toFixed(1)}%`,     ok: kpiContrat.tauxPaiement >= 80,    tip: 'Payé / Facturé' },
                  { label: 'Taux de décaissement', value: `${kpiContrat.tauxDecaissement.toFixed(1)}%`, ok: kpiContrat.tauxDecaissement >= 60, tip: 'Décaissé / Financement' },
                  { label: "Taux d'engagement",    value: `${kpiContrat.tauxEngagement.toFixed(1)}%`,   ok: kpiContrat.tauxEngagement >= 70,   tip: 'Engagé / Budget' },
                ].map(k => (
                  <div key={k.label} style={{ background: k.ok ? '#F0FDF4' : '#FFF7ED', border: `1px solid ${k.ok ? '#BBF7D0' : '#FDE68A'}`, borderRadius: 10, padding: '12px 16px', textAlign: 'center' }}>
                    <div style={{ fontSize: 22, fontWeight: 800, color: k.ok ? C.green : C.amber }}>{k.value}</div>
                    <div style={{ fontSize: 11, fontWeight: 600, color: '#1E293B', marginTop: 4 }}>{k.label}</div>
                    <div style={{ fontSize: 10, color: '#94A3B8', marginTop: 2 }}>{k.tip}</div>
                  </div>
                ))}
              </div>
            )}

            {/* Courbe S + Bailleurs */}
            <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: 16 }}>
              {/* Courbe S */}
              <div style={{ background: '#fff', borderRadius: 10, border: `1px solid ${C.border}`, padding: '16px 20px' }}>
                <div style={{ fontSize: 13, fontWeight: 700, color: '#1E293B', marginBottom: 4 }}>Courbe S — Avancement financier</div>
                <div style={{ fontSize: 11, color: '#94A3B8', marginBottom: 16 }}>
                  CPI = <strong style={{ color: projet.cpi >= 0.90 ? C.green : C.red }}>{projet.cpi.toFixed(2)}</strong>&nbsp;·&nbsp;
                  SPI = <strong style={{ color: projet.spi >= 0.85 ? C.green : C.amber }}>{projet.spi.toFixed(2)}</strong>
                </div>
                <ResponsiveContainer width="100%" height={220}>
                  <AreaChart data={finances.courbe} margin={{ top: 5, right: 10, left: -10, bottom: 0 }}>
                    <defs>
                      <linearGradient id="gPlan" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor={C.navy} stopOpacity={0.15} />
                        <stop offset="95%" stopColor={C.navy} stopOpacity={0} />
                      </linearGradient>
                      <linearGradient id="gReel" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor={C.orange} stopOpacity={0.2} />
                        <stop offset="95%" stopColor={C.orange} stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="#F1F5F9" />
                    <XAxis dataKey="mois" tick={{ fontSize: 10, fill: '#94A3B8' }} />
                    <YAxis tick={{ fontSize: 10, fill: '#94A3B8' }} tickFormatter={v => `${v}%`} />
                    <Tooltip formatter={(v: number) => `${v.toFixed(1)}%`} />
                    <ReferenceLine x="M11" stroke={C.orange} strokeDasharray="4 2" label={{ value: "Auj.", fontSize: 9, fill: C.orange }} />
                    <Area type="monotone" dataKey="planifie" stroke={C.navy} strokeWidth={2} fill="url(#gPlan)" name="Planifié" />
                    <Area type="monotone" dataKey="reel" stroke={C.orange} strokeWidth={2.5} fill="url(#gReel)" name="Réel" connectNulls={false} />
                  </AreaChart>
                </ResponsiveContainer>
              </div>

              {/* Bailleurs */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                <div style={{ background: '#fff', borderRadius: 10, border: `1px solid ${C.border}`, padding: '16px 20px', flex: 1 }}>
                  <div style={{ fontSize: 13, fontWeight: 700, color: '#1E293B', marginBottom: 16, display: 'flex', alignItems: 'center', gap: 6 }}>
                    <Building2 size={13} style={{ color: C.navy }} /> Bailleurs de fonds
                  </div>
                  <ResponsiveContainer width="100%" height={140}>
                    <PieChart>
                      <Pie
                        data={projet.bailleurs}
                        cx="50%" cy="50%"
                        innerRadius={40} outerRadius={65}
                        dataKey="montant"
                        nameKey="nom"
                      >
                        {projet.bailleurs.map((_, i) => (
                          <Cell key={i} fill={[C.navy, C.orange, C.purple, C.green][i % 4]} />
                        ))}
                      </Pie>
                      <Tooltip formatter={(v: number) => `${v} MFCFA`} />
                      <Legend iconSize={8} iconType="circle" wrapperStyle={{ fontSize: 11 }} />
                    </PieChart>
                  </ResponsiveContainer>
                </div>

                {/* EVM */}
                <div style={{ background: '#fff', borderRadius: 10, border: `1px solid ${C.border}`, padding: '14px 16px' }}>
                  <div style={{ fontSize: 12, fontWeight: 700, color: '#1E293B', marginBottom: 10 }}>Valeur Acquise (EVM)</div>
                  {[
                    { label: 'CPI (Cost Perf. Index)', value: projet.cpi.toFixed(2), ok: projet.cpi >= 0.90, icon: projet.cpi >= 0.90 ? <TrendingUp size={12} style={{ color: C.green }} /> : <TrendingDown size={12} style={{ color: C.red }} /> },
                    { label: 'SPI (Schedule Perf. Index)', value: projet.spi.toFixed(2), ok: projet.spi >= 0.85, icon: projet.spi >= 0.85 ? <TrendingUp size={12} style={{ color: C.green }} /> : <TrendingDown size={12} style={{ color: C.amber }} /> },
                  ].map(e => (
                    <div key={e.label} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '5px 0', borderBottom: `1px solid ${C.border}` }}>
                      <span style={{ fontSize: 11, color: '#64748B' }}>{e.label}</span>
                      <span style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 13, fontWeight: 800, color: e.ok ? C.green : C.red }}>
                        {e.icon} {e.value}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Décaissement mensuel */}
            <div style={{ background: '#fff', borderRadius: 10, border: `1px solid ${C.border}`, padding: '16px 20px' }}>
              <div style={{ fontSize: 13, fontWeight: 700, color: '#1E293B', marginBottom: 16 }}>Décaissements par bailleur (MFCFA)</div>
              <ResponsiveContainer width="100%" height={160}>
                <BarChart data={[
                  { mois: 'Jan', AFD: 85, SENELEC: 42 },
                  { mois: 'Fév', AFD: 92, SENELEC: 48 },
                  { mois: 'Mar', AFD: 78, SENELEC: 55 },
                  { mois: 'Avr', AFD: 110, SENELEC: 60 },
                  { mois: 'Mai', AFD: 95, SENELEC: 45 },
                ]} margin={{ top: 0, right: 10, left: -10, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#F1F5F9" />
                  <XAxis dataKey="mois" tick={{ fontSize: 10, fill: '#94A3B8' }} />
                  <YAxis tick={{ fontSize: 10, fill: '#94A3B8' }} />
                  <Tooltip />
                  <Bar dataKey="AFD" fill={C.navy} radius={[3, 3, 0, 0]} />
                  <Bar dataKey="SENELEC" fill={C.orange} radius={[3, 3, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </>
        )}

        {/* ─── CONTRAT & MARCHÉS ──────────────────────── */}
        {activeOnglet === 'contrat' && kpiContrat && (
          <>
            {/* KPIs financiers contrat */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12 }}>
              {[
                { label: 'Montant marché',    value: `${(kpiContrat.mMarche ?? 0).toLocaleString('fr-FR')} MFCFA`, color: C.navy,   bg: '#EFF6FF' },
                { label: 'Montant facturé',   value: `${(kpiContrat.mFact ?? 0).toLocaleString('fr-FR')} MFCFA`,   color: C.orange, bg: '#FFF7ED', sub: `Taux facturation : ${kpiContrat.tauxFacturation.toFixed(1)}%` },
                { label: 'Montant payé',      value: `${(kpiContrat.mPay ?? 0).toLocaleString('fr-FR')} MFCFA`,    color: C.green,  bg: '#F0FDF4', sub: `Taux paiement : ${kpiContrat.tauxPaiement.toFixed(1)}%` },
                { label: 'Montant avenants',  value: `${(projet.montantAvenants ?? 0).toLocaleString('fr-FR')} MFCFA`, color: C.amber, bg: '#FFFBEB' },
              ].map(k => (
                <div key={k.label} style={{ background: k.bg, border: `1px solid ${k.color}20`, borderRadius: 10, padding: '14px 16px' }}>
                  <div style={{ fontSize: 11.5, color: '#64748B', fontWeight: 600, marginBottom: 8 }}>{k.label}</div>
                  <div style={{ fontSize: 18, fontWeight: 800, color: k.color }}>{k.value}</div>
                  {k.sub && <div style={{ fontSize: 10.5, color: '#94A3B8', marginTop: 4 }}>{k.sub}</div>}
                </div>
              ))}
            </div>

            {/* Taux KPIs 2e rangée */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12 }}>
              {[
                { label: 'Taux de facturation',  value: `${kpiContrat.tauxFacturation.toFixed(1)}%`,  ok: kpiContrat.tauxFacturation >= 80 },
                { label: 'Taux de paiement',     value: `${kpiContrat.tauxPaiement.toFixed(1)}%`,     ok: kpiContrat.tauxPaiement >= 80 },
                { label: 'Taux de décaissement', value: `${kpiContrat.tauxDecaissement.toFixed(1)}%`, ok: kpiContrat.tauxDecaissement >= 60 },
                { label: "Taux d'engagement",    value: `${kpiContrat.tauxEngagement.toFixed(1)}%`,   ok: kpiContrat.tauxEngagement >= 70 },
              ].map(k => (
                <div key={k.label} style={{ background: k.ok ? '#F0FDF4' : '#FFF7ED', border: `1px solid ${k.ok ? '#BBF7D0' : '#FDE68A'}`, borderRadius: 10, padding: '14px 16px', textAlign: 'center' }}>
                  <div style={{ fontSize: 22, fontWeight: 800, color: k.ok ? C.green : C.amber }}>{k.value}</div>
                  <div style={{ fontSize: 11, color: '#64748B', marginTop: 4 }}>{k.label}</div>
                </div>
              ))}
            </div>

            {/* Dates contractuelles + Code imputation — éditable */}
            <div style={{ background: '#fff', borderRadius: 10, border: `1px solid ${C.border}`, padding: '16px 20px' }}>
              <div style={{ fontSize: 13, fontWeight: 700, color: C.navy, marginBottom: 14, display: 'flex', alignItems: 'center', gap: 6 }}>
                <Calendar size={14} style={{ color: C.orange }} /> Dates contractuelles &amp; Référentiels
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12 }}>
                {([
                  { label: 'Date ODS',              field: 'dateODS',              type: 'date', raw: projet.dateODS ?? '',              display: projet.dateODS ? new Date(projet.dateODS).toLocaleDateString('fr-FR') : '—',              alert: undefined },
                  { label: 'Date signature contrat', field: 'dateSignatureContrat', type: 'date', raw: projet.dateSignatureContrat ?? '', display: projet.dateSignatureContrat ? new Date(projet.dateSignatureContrat).toLocaleDateString('fr-FR') : '—', alert: undefined },
                  { label: 'Date fin caution',       field: 'dateFinCaution',       type: 'date', raw: projet.dateFinCaution ?? '',       display: projet.dateFinCaution ? new Date(projet.dateFinCaution).toLocaleDateString('fr-FR') : '—',       alert: kpiContrat.alertCaution3m ? C.red : kpiContrat.alertCaution6m ? C.amber : undefined },
                  { label: 'N° de marché',           field: 'numeroMarche',         type: 'text', raw: projet.numeroMarche ?? '',         display: projet.numeroMarche ?? '—',                                                                      alert: undefined },
                  { label: 'Code imputation Oracle', field: 'codeImputation',       type: 'text', raw: projet.codeImputation ?? '',       display: projet.codeImputation ?? '—',                                                                    alert: undefined },
                  { label: 'Montant financement',    field: 'montantFinancement',   type: 'number', raw: String(projet.montantFinancement ?? projet.budget), display: `${(projet.montantFinancement ?? projet.budget).toLocaleString('fr-FR')} MFCFA`, alert: undefined },
                ] as Array<{ label: string; field: string; type: string; raw: string; display: string; alert: string | undefined }>).map(k => (
                  <div key={k.field} style={{ background: '#F8FAFC', borderRadius: 8, padding: '10px 14px', borderLeft: `3px solid ${k.alert ?? C.navy}`, position: 'relative' }}>
                    <div style={{ fontSize: 10.5, color: '#94A3B8', marginBottom: 4 }}>{k.label}</div>
                    {editingContratField === k.field ? (
                      <div style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
                        <input
                          type={k.type === 'date' ? 'date' : k.type === 'number' ? 'number' : 'text'}
                          value={contratFieldVal}
                          onChange={e => setContratFieldVal(e.target.value)}
                          autoFocus
                          onKeyDown={e => { if (e.key === 'Enter') saveContratField(k.field, contratFieldVal); if (e.key === 'Escape') setEditingContratField(null); }}
                          style={{ flex: 1, border: `1px solid ${C.navy}`, borderRadius: 4, padding: '3px 6px', fontSize: 12, fontFamily: 'inherit' }}
                        />
                        <button onClick={() => saveContratField(k.field, contratFieldVal)} aria-label="Enregistrer la valeur" style={{ background: C.green, border: 'none', borderRadius: 4, padding: '3px 7px', cursor: 'pointer' }}>
                          <Check size={11} color="#fff" />
                        </button>
                        <button onClick={() => setEditingContratField(null)} aria-label="Annuler l'édition" style={{ background: '#F1F5F9', border: 'none', borderRadius: 4, padding: '3px 7px', cursor: 'pointer' }}>
                          <X size={11} color="#64748B" />
                        </button>
                      </div>
                    ) : (
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                        <span style={{ fontSize: 14, fontWeight: 700, color: k.alert ?? '#1E293B', flex: 1 }}>{k.display}</span>
                        {canEditFiche && (
                          <button onClick={() => { setEditingContratField(k.field); setContratFieldVal(k.raw); }}
                            style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 2, opacity: 0.4, color: C.navy }}
                            title="Modifier">
                            <Pencil size={11} />
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>

            {/* Passation des marchés — 6 sous-étapes */}
            {projet.passationMarches && (
              <div style={{ background: '#fff', borderRadius: 10, border: `1px solid ${C.border}`, padding: '16px 20px' }}>
                <div style={{ fontSize: 13, fontWeight: 700, color: C.navy, marginBottom: 4, display: 'flex', alignItems: 'center', gap: 6 }}>
                  <GitBranch size={14} style={{ color: C.orange }} /> Passation des marchés
                  <span style={{ marginLeft: 'auto', fontSize: 11, color: C.slate }}>Progression globale : <strong style={{ color: C.navy }}>{kpiContrat.passationGlobal}%</strong></span>
                </div>
                <div style={{ height: 6, background: '#F1F5F9', borderRadius: 3, marginBottom: 16, overflow: 'hidden' }}>
                  <div style={{ height: '100%', width: `${kpiContrat.passationGlobal}%`, background: `linear-gradient(90deg, ${C.navy}, ${C.orange})`, borderRadius: 3 }} />
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {([
                    { key: 'elaborationDAC',       label: 'Élaboration DAC' },
                    { key: 'lancementDAC',          label: 'Lancement DAC' },
                    { key: 'ouvertureAnalyse',      label: 'Ouverture & analyse des offres' },
                    { key: 'attributionProvisoire', label: 'Attribution provisoire' },
                    { key: 'attributionDefinitive', label: 'Attribution définitive' },
                    { key: 'signatureContrat',      label: 'Signature du contrat' },
                  ] as Array<{ key: keyof PassationMarches; label: string }>).map((step, idx) => {
                    const pct: number = projet.passationMarches![step.key];
                    const done = pct >= 100;
                    return (
                      <div key={step.key} style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                        <div style={{ width: 22, height: 22, borderRadius: '50%', background: done ? C.green : '#F1F5F9', border: `2px solid ${done ? C.green : C.border}`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                          {done ? <Check size={11} color="#fff" /> : <span style={{ fontSize: 9, color: '#94A3B8', fontWeight: 700 }}>{idx + 1}</span>}
                        </div>
                        <div style={{ flex: 1 }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 3 }}>
                            <span style={{ fontSize: 11.5, fontWeight: done ? 700 : 500, color: done ? '#1E293B' : '#64748B' }}>{step.label}</span>
                            {canEditFiche ? (
                              <input
                                type="number" min={0} max={100} step={5}
                                value={pct}
                                onChange={e => savePassationStep(step.key, parseInt(e.target.value, 10) || 0)}
                                style={{ width: 52, border: `1px solid ${C.border}`, borderRadius: 4, padding: '1px 4px', fontSize: 11, fontWeight: 700, color: pct >= 100 ? C.green : pct > 0 ? C.orange : '#94A3B8', textAlign: 'right', fontFamily: 'inherit' }}
                              />
                            ) : (
                              <span style={{ fontSize: 11, fontWeight: 700, color: pct >= 100 ? C.green : pct > 0 ? C.orange : '#94A3B8' }}>{pct}%</span>
                            )}
                          </div>
                          <div style={{ height: 5, background: '#F1F5F9', borderRadius: 3, overflow: 'hidden' }}>
                            <div style={{ height: '100%', width: `${pct}%`, background: pct >= 100 ? C.green : pct > 0 ? C.orange : '#E2E8F0', borderRadius: 3, transition: 'width 0.5s ease' }} />
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </>
        )}

        {/* ─── HSE & QUALITÉ ──────────────────────────── */}
        {activeOnglet === 'hse' && (
          <>
            {/* Statut global trafic */}
            {kpiContrat && (
              <div style={{ background: '#fff', borderRadius: 10, border: `1px solid ${C.border}`, padding: '16px 20px', display: 'flex', alignItems: 'center', gap: 16 }}>
                <div style={{ width: 54, height: 54, borderRadius: '50%', background: kpiContrat.sg === 'vert' ? '#DCFCE7' : kpiContrat.sg === 'orange' ? '#FFF7ED' : '#FEF2F2', border: `3px solid ${kpiContrat.sg === 'vert' ? C.green : kpiContrat.sg === 'orange' ? C.amber : C.red}`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                  <div style={{ width: 28, height: 28, borderRadius: '50%', background: kpiContrat.sg === 'vert' ? C.green : kpiContrat.sg === 'orange' ? C.amber : C.red }} />
                </div>
                <div>
                  <div style={{ fontSize: 16, fontWeight: 800, color: '#1E293B' }}>
                    Statut global : {kpiContrat.sg === 'vert' ? 'Vert — Sous contrôle' : kpiContrat.sg === 'orange' ? 'Orange — Vigilance requise' : 'Rouge — Action corrective requise'}
                  </div>
                  <div style={{ fontSize: 11.5, color: '#64748B', marginTop: 4 }}>
                    CPI {projet.cpi.toFixed(2)} · SPI {projet.spi.toFixed(2)} · Avancement {projet.avancement}% (planifié {projet.avancementPlanifie}%)
                  </div>
                </div>
              </div>
            )}

            {/* HSE */}
            <div style={{ background: '#fff', borderRadius: 10, border: `1px solid ${C.border}`, padding: '16px 20px' }}>
              <div style={{ fontSize: 13, fontWeight: 700, color: C.navy, marginBottom: 14, display: 'flex', alignItems: 'center', gap: 6 }}>
                <ShieldAlert size={14} style={{ color: C.orange }} /> Hygiène, Sécurité &amp; Environnement (HSE)
              </div>
              {(() => {
                const hse = projet.hse ?? { nbAnomalies: 0, tauxRealisationPGES: 0, tauxRealisationPAR: 0 };
                return (
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12 }}>
                    {([
                      { field: 'nbAnomalies',         label: 'Anomalies HSE',    unit: 'anomalies', val: hse.nbAnomalies,         ok: hse.nbAnomalies === 0,          type: 'int' },
                      { field: 'tauxRealisationPGES', label: 'Réalisation PGES', unit: '% — Plan Gestion Environnement', val: hse.tauxRealisationPGES, ok: hse.tauxRealisationPGES >= 80, type: 'pct' },
                      { field: 'tauxRealisationPAR',  label: 'Réalisation PAR',  unit: '% — Plan Action Réinstallation', val: hse.tauxRealisationPAR,  ok: hse.tauxRealisationPAR >= 80,  type: 'pct' },
                    ] as Array<{ field: string; label: string; unit: string; val: number; ok: boolean; type: string }>).map(k => (
                      <div key={k.field} style={{ background: k.ok ? '#F0FDF4' : '#FEF2F2', border: `1px solid ${k.ok ? '#BBF7D0' : '#FECACA'}`, borderRadius: 10, padding: '16px' }}>
                        {editingHseField === k.field ? (
                          <div style={{ display: 'flex', gap: 4, alignItems: 'center', marginBottom: 6 }}>
                            <input type="number" min={0} max={k.type === 'pct' ? 100 : 9999}
                              value={hseFieldVal} onChange={e => setHseFieldVal(e.target.value)} autoFocus
                              onKeyDown={e => { if (e.key === 'Enter') saveHseField(k.field, hseFieldVal); if (e.key === 'Escape') setEditingHseField(null); }}
                              style={{ flex: 1, border: `1px solid ${C.navy}`, borderRadius: 4, padding: '3px 6px', fontSize: 14, fontWeight: 800, fontFamily: 'inherit' }}
                            />
                            <button onClick={() => saveHseField(k.field, hseFieldVal)} aria-label="Enregistrer la valeur HSE" style={{ background: C.green, border: 'none', borderRadius: 4, padding: '4px 8px', cursor: 'pointer' }}><Check size={11} color="#fff" /></button>
                            <button onClick={() => setEditingHseField(null)} aria-label="Annuler l'édition HSE" style={{ background: '#F1F5F9', border: 'none', borderRadius: 4, padding: '4px 8px', cursor: 'pointer' }}><X size={11} color="#64748B" /></button>
                          </div>
                        ) : (
                          <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4 }}>
                            <span style={{ fontSize: 26, fontWeight: 800, color: k.ok ? C.green : C.red }}>{k.type === 'pct' ? `${k.val}%` : k.val}</span>
                            {canEditFiche && (
                              <button onClick={() => { setEditingHseField(k.field); setHseFieldVal(String(k.val)); }}
                                style={{ background: 'none', border: 'none', cursor: 'pointer', opacity: 0.4, marginLeft: 'auto', color: C.navy }}><Pencil size={12} /></button>
                            )}
                          </div>
                        )}
                        <div style={{ fontSize: 11.5, fontWeight: 700, color: '#1E293B' }}>{k.label}</div>
                        <div style={{ fontSize: 10.5, color: '#94A3B8', marginTop: 2 }}>{k.unit}</div>
                      </div>
                    ))}
                  </div>
                );
              })()}
            </div>

            {/* Qualité */}
            <div style={{ background: '#fff', borderRadius: 10, border: `1px solid ${C.border}`, padding: '16px 20px' }}>
              <div style={{ fontSize: 13, fontWeight: 700, color: C.navy, marginBottom: 14, display: 'flex', alignItems: 'center', gap: 6 }}>
                <Activity size={14} style={{ color: C.orange }} /> Contrôle qualité
              </div>
              {(() => {
                const qualite = projet.qualite ?? { nbNonConformites: 0, nbControles: 0 };
                const tauxNonConf = qualite.nbControles > 0
                  ? (qualite.nbNonConformites / qualite.nbControles * 100)
                  : 0;
                return (
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12 }}>
                    {([
                      { field: 'nbNonConformites', label: 'Non-conformités',  val: qualite.nbNonConformites, ok: qualite.nbNonConformites === 0, displayColor: qualite.nbNonConformites === 0 ? C.green : C.red, bg: qualite.nbNonConformites === 0 ? '#F0FDF4' : '#FEF2F2', border: qualite.nbNonConformites === 0 ? '#BBF7D0' : '#FECACA' },
                      { field: 'nbControles',       label: 'Contrôles réalisés', val: qualite.nbControles,     ok: true,                         displayColor: C.navy,                                           bg: '#EFF6FF',    border: '#BFDBFE' },
                    ] as Array<{ field: string; label: string; val: number; ok: boolean; displayColor: string; bg: string; border: string }>).map(k => (
                      <div key={k.field} style={{ background: k.bg, border: `1px solid ${k.border}`, borderRadius: 10, padding: 16 }}>
                        {editingQualField === k.field ? (
                          <div style={{ display: 'flex', gap: 4, alignItems: 'center', marginBottom: 6 }}>
                            <input type="number" min={0} value={qualFieldVal} onChange={e => setQualFieldVal(e.target.value)} autoFocus
                              onKeyDown={e => { if (e.key === 'Enter') saveQualField(k.field, qualFieldVal); if (e.key === 'Escape') setEditingQualField(null); }}
                              style={{ flex: 1, border: `1px solid ${C.navy}`, borderRadius: 4, padding: '3px 6px', fontSize: 14, fontWeight: 800, fontFamily: 'inherit' }}
                            />
                            <button onClick={() => saveQualField(k.field, qualFieldVal)} aria-label="Enregistrer la valeur qualité" style={{ background: C.green, border: 'none', borderRadius: 4, padding: '4px 8px', cursor: 'pointer' }}><Check size={11} color="#fff" /></button>
                            <button onClick={() => setEditingQualField(null)} aria-label="Annuler l'édition qualité" style={{ background: '#F1F5F9', border: 'none', borderRadius: 4, padding: '4px 8px', cursor: 'pointer' }}><X size={11} color="#64748B" /></button>
                          </div>
                        ) : (
                          <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4 }}>
                            <span style={{ fontSize: 26, fontWeight: 800, color: k.displayColor }}>{k.val}</span>
                            {canEditFiche && (
                              <button onClick={() => { setEditingQualField(k.field); setQualFieldVal(String(k.val)); }}
                                style={{ background: 'none', border: 'none', cursor: 'pointer', opacity: 0.4, marginLeft: 'auto', color: C.navy }}><Pencil size={12} /></button>
                            )}
                          </div>
                        )}
                        <div style={{ fontSize: 11.5, fontWeight: 700, color: '#1E293B' }}>{k.label}</div>
                      </div>
                    ))}
                    <div style={{ background: tauxNonConf <= 5 ? '#F0FDF4' : '#FEF2F2', border: `1px solid ${tauxNonConf <= 5 ? '#BBF7D0' : '#FECACA'}`, borderRadius: 10, padding: 16 }}>
                      <div style={{ fontSize: 26, fontWeight: 800, color: tauxNonConf <= 5 ? C.green : C.red, marginBottom: 4 }}>{tauxNonConf.toFixed(1)}%</div>
                      <div style={{ fontSize: 11.5, fontWeight: 700, color: '#1E293B' }}>Taux non-conformité</div>
                      <div style={{ fontSize: 10.5, color: '#94A3B8', marginTop: 3 }}>(non-conf. / contrôles) × 100</div>
                    </div>
                    {qualite.commentaire && (
                      <div style={{ gridColumn: '1 / -1', background: '#F8FAFC', borderRadius: 8, padding: '10px 14px', fontSize: 12, color: '#475569', borderLeft: `3px solid ${C.navy}` }}>
                        {qualite.commentaire}
                      </div>
                    )}
                  </div>
                );
              })()}
            </div>
          </>
        )}

        {/* ─── RESSOURCES ────────────────────────────── */}
        {activeOnglet === 'ressources' && (
          <>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12 }}>
              {[
                { label: 'Membres équipe', value: String(equipe.length), color: C.navy, icon: <Users size={16} /> },
                { label: 'Chef de projet', value: projet.chefProjet, color: C.orange, icon: <UserCheck size={16} /> },
                { label: 'Taux charge moyen', value: '78 %', color: C.green, icon: <BarChart3 size={16} /> },
              ].map(k => (
                <div key={k.label} style={{ background: '#fff', border: `1px solid ${C.border}`, borderRadius: 10, padding: '14px 16px', display: 'flex', gap: 12, alignItems: 'center', minWidth: 0 }}>
                  <div style={{ color: k.color, flexShrink: 0 }}>{k.icon}</div>
                  <div style={{ minWidth: 0 }}>
                    <div style={{ fontSize: k.label === 'Chef de projet' ? 14 : 20, fontWeight: 800, color: k.color, lineHeight: 1.2, overflowWrap: 'anywhere' }}>{k.value}</div>
                    <div style={{ fontSize: 11, color: '#94A3B8' }}>{k.label}</div>
                  </div>
                </div>
              ))}
            </div>

            {/* Chef de projet card */}
            <div style={{ background: `${C.navy}08`, border: `1px solid ${C.navy}20`, borderRadius: 10, padding: '14px 18px', display: 'flex', alignItems: 'center', gap: 14 }}>
              <div style={{ width: 48, height: 48, borderRadius: '50%', background: C.navy, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontSize: 18, fontWeight: 700, flexShrink: 0 }}>
                {projet.chefProjet.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase()}
              </div>
              <div>
                <div style={{ fontSize: 14, fontWeight: 700, color: '#1E293B' }}>{projet.chefProjet}</div>
                <div style={{ fontSize: 11.5, color: '#64748B' }}>{chefInfo.poste}{chefInfo.direction ? ` · ${chefInfo.direction}` : ''}</div>
              </div>
              <div style={{ marginLeft: 'auto', display: 'flex', gap: 8 }}>
                <span style={{ fontSize: 10.5, color: C.green, background: '#DCFCE7', padding: '3px 10px', borderRadius: 20, fontWeight: 700 }}>● Actif</span>
              </div>
            </div>

            {/* Table équipe */}
            <div style={{ background: '#fff', borderRadius: 10, border: `1px solid ${C.border}`, overflow: 'hidden' }}>
              <div style={{ padding: '12px 16px', background: '#F8FAFC', borderBottom: `1px solid ${C.border}`, fontSize: 12.5, fontWeight: 700, color: '#1E293B' }}>
                Équipe projet ({equipe.length} membres)
              </div>
              {equipe.length === 0 && (
                <div style={{ padding: 32, textAlign: 'center', color: '#94A3B8', fontSize: 13 }}>
                  Aucun membre assigné — utilisez la GRH pour affecter des ressources
                </div>
              )}
              {equipe.map((r, i) => {
                if (!r) return null;
                const initials = `${r.prenom[0] ?? ''}${r.nom[0] ?? ''}`.toUpperCase();
                const colors = [C.navy, C.orange, C.purple, C.green, C.amber, C.red];
                const col = colors[i % colors.length];
                return (
                  <div
                    key={r.id}
                    style={{
                      display: 'grid', gridTemplateColumns: '40px 1fr 100px 120px 80px 100px',
                      padding: '10px 16px', gap: 12, alignItems: 'center',
                      borderBottom: i < equipe.length - 1 ? `1px solid ${C.border}` : 'none',
                    }}
                  >
                    <div style={{ width: 32, height: 32, borderRadius: '50%', background: `${col}20`, border: `2px solid ${col}40`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 700, color: col }}>
                      {initials}
                    </div>
                    <div>
                      <div style={{ fontSize: 12.5, fontWeight: 600, color: '#1E293B' }}>{r.prenom} {r.nom}</div>
                      <div style={{ fontSize: 10.5, color: '#94A3B8' }}>{r.direction ?? r.type}</div>
                    </div>
                    <div style={{ fontSize: 11.5, color: '#475569' }}>{r.type}</div>
                    <div style={{ fontSize: 11, color: '#94A3B8' }}>{r.email ?? '—'}</div>
                    <div style={{ fontSize: 11.5, fontWeight: 600, color: r.capaciteMax >= 80 ? C.green : C.amber }}>
                      {r.capaciteMax} %
                    </div>
                    <span style={{ fontSize: 10.5, color: C.green, background: '#DCFCE7', padding: '2px 8px', borderRadius: 20, fontWeight: 700, textAlign: 'center' }}>
                      Actif
                    </span>
                  </div>
                );
              })}
            </div>

            {/* Charge bar chart */}
            {equipe.length > 0 && (
              <div style={{ background: '#fff', borderRadius: 10, border: `1px solid ${C.border}`, padding: '16px 20px' }}>
                <div style={{ fontSize: 13, fontWeight: 700, color: '#1E293B', marginBottom: 16 }}>Charge de travail (% allocation)</div>
                <ResponsiveContainer width="100%" height={160}>
                  <BarChart
                    data={equipe.filter(Boolean).map(r => ({ nom: r!.prenom.slice(0, 8), cap: r!.capaciteMax }))}
                    layout="vertical"
                    margin={{ top: 0, right: 20, left: 20, bottom: 0 }}
                  >
                    <CartesianGrid strokeDasharray="3 3" stroke="#F1F5F9" horizontal={false} />
                    <XAxis type="number" domain={[0, 100]} tick={{ fontSize: 10, fill: '#94A3B8' }} tickFormatter={v => `${v}%`} />
                    <YAxis type="category" dataKey="nom" tick={{ fontSize: 10, fill: '#475569' }} width={60} />
                    <Tooltip formatter={(v: number) => `${v}%`} />
                    <ReferenceLine x={80} stroke={C.amber} strokeDasharray="4 2" label={{ value: '80%', fontSize: 9, fill: C.amber }} />
                    <Bar dataKey="cap" fill={C.navy} radius={[0, 4, 4, 0]} name="Capacité allouée" />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            )}
          </>
        )}

        {/* ─── DOCUMENTS ─────────────────────────────── */}
        {activeOnglet === 'documents' && (
          <>
            {/* Toolbar */}
            <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
              <div style={{ flex: 1, position: 'relative' }}>
                <FileText size={13} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: '#94A3B8' }} />
                <input
                  placeholder="Rechercher un document…"
                  style={{ width: '100%', padding: '8px 12px 8px 30px', borderRadius: 7, border: `1px solid ${C.border}`, fontSize: 12.5, fontFamily: 'inherit', background: '#fff', boxSizing: 'border-box' }}
                />
              </div>
              <button
                onClick={() => { setUploadForm({ nom: '', type: 'Rapport', commentaire: '' }); setShowUploadModal(true); }}
                style={{
                  display: 'flex', alignItems: 'center', gap: 6, padding: '8px 14px',
                  borderRadius: 7, border: 'none', background: C.navy,
                  fontSize: 12, color: '#fff', cursor: 'pointer', fontFamily: 'inherit', fontWeight: 600,
                }}>
                <Upload size={12} /> Déposer un document
              </button>
            </div>

            {/* Stats GED */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 10 }}>
              {[
                { label: 'Documents total', value: String(GED_DOCS.length), color: C.navy },
                { label: 'Validés/Signés',  value: String(GED_DOCS.filter(d => ['validé','signé','approuvé'].includes(d.statut)).length), color: C.green },
                { label: 'En attente',      value: '2', color: C.amber },
                { label: 'Cette semaine',   value: '3', color: C.purple },
              ].map(k => (
                <div key={k.label} style={{ background: '#fff', border: `1px solid ${C.border}`, borderRadius: 8, padding: '10px 14px', textAlign: 'center' }}>
                  <div style={{ fontSize: 22, fontWeight: 800, color: k.color }}>{k.value}</div>
                  <div style={{ fontSize: 10.5, color: '#94A3B8' }}>{k.label}</div>
                </div>
              ))}
            </div>

            {/* Documents table */}
            <div style={{ background: '#fff', borderRadius: 10, border: `1px solid ${C.border}`, overflow: 'hidden' }}>
              <div style={{
                display: 'grid', gridTemplateColumns: '1fr 100px 120px 100px 90px 100px',
                padding: '8px 16px', background: '#F8FAFC', borderBottom: `1px solid ${C.border}`,
                fontSize: 10.5, fontWeight: 700, color: '#94A3B8', textTransform: 'uppercase', letterSpacing: '0.06em',
              }}>
                <span>Document</span><span>Type</span><span>Auteur</span><span>Date</span><span>Taille</span><span>Statut</span>
              </div>
              {gedDocs.map((d, i) => {
                const sc = DOC_STATUT[d.statut] ?? { color: C.slate, bg: '#F1F5F9' };
                const extColors: Record<string, string> = { pdf: '#EF4444', docx: C.navy, dwg: C.green, zip: C.amber };
                return (
                  <div
                    key={d.id}
                    style={{
                      display: 'grid', gridTemplateColumns: '1fr 100px 120px 100px 90px 100px',
                      padding: '10px 16px', gap: 8, alignItems: 'center',
                      borderBottom: i < gedDocs.length - 1 ? `1px solid ${C.border}` : 'none',
                      cursor: 'pointer',
                    }}
                    onMouseEnter={e => (e.currentTarget as HTMLDivElement).style.background = '#F8FAFC'}
                    onMouseLeave={e => (e.currentTarget as HTMLDivElement).style.background = 'transparent'}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                      <div style={{
                        width: 28, height: 28, borderRadius: 5, background: `${extColors[d.ext] ?? C.slate}15`,
                        display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
                      }}>
                        <span style={{ fontSize: 8, fontWeight: 800, color: extColors[d.ext] ?? C.slate, textTransform: 'uppercase' }}>{d.ext}</span>
                      </div>
                      <span style={{ fontSize: 12.5, fontWeight: 500, color: '#1E293B' }}>{d.nom}</span>
                    </div>
                    <span style={{ fontSize: 11, color: '#475569' }}>{d.type}</span>
                    <span style={{ fontSize: 11, color: '#94A3B8' }}>{d.auteur}</span>
                    <span style={{ fontSize: 11, color: '#94A3B8' }}>{new Date(d.date).toLocaleDateString('fr-FR')}</span>
                    <span style={{ fontSize: 11, color: '#94A3B8' }}>{d.taille}</span>
                    <div style={{ display: 'flex', gap: 4 }}>
                      <span style={{ fontSize: 10, fontWeight: 700, color: sc.color, background: sc.bg, padding: '2px 7px', borderRadius: 10 }}>{d.statut}</span>
                      <button onClick={() => setPreviewDoc(d)} title="Aperçu" style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#94A3B8', padding: 2 }}><Eye size={12} /></button>
                      <button onClick={() => { const a = document.createElement('a'); a.download = d.nom; a.href = '#'; a.click(); alert(`Téléchargement de "${d.nom}" (${d.taille}) démarré`); }} title="Télécharger" style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#94A3B8', padding: 2 }}><Download size={12} /></button>
                    </div>
                  </div>
                );
              })}
            </div>
          </>
        )}

        {/* ─── CARTE SIG ─────────────────────────────── */}
        {activeOnglet === 'carte-sig' && (
          <>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 300px', gap: 16, height: 480 }}>
              {/* Carte SIG réelle (Leaflet) */}
              <div style={{ borderRadius: 12, overflow: 'hidden', position: 'relative' }}>
                <ProjetsCarteLeaflet
                  height={480}
                  projets={[{
                    id: projet.id, nom: projet.nom, code: projet.code, region: projet.region,
                    domaine: projet.domaine, statut: projet.statut,
                    avancement: projet.avancement, budget: projet.budget,
                    localisation: projet.localisation,
                    refSIG: `SIG-${projet.code}`,
                  }]}
                />
                {/* Corner badge couches */}
                <div style={{ position: 'absolute', bottom: 12, left: 12, display: 'flex', gap: 6, zIndex: 500 }}>
                  {['Réseau HTA', 'Réseau BT', 'Postes HTA/BT', 'Compteurs'].map(l => (
                    <span key={l} style={{ fontSize: 9.5, background: 'rgba(14,52,96,0.85)', color: '#fff', padding: '3px 8px', borderRadius: 6, fontWeight: 600 }}>{l}</span>
                  ))}
                </div>
                <button
                  onClick={() => router.push('/cartographie')}
                  style={{ position: 'absolute', top: 12, right: 12, display: 'flex', alignItems: 'center', gap: 6, padding: '7px 14px', borderRadius: 7, border: 'none', background: C.orange, color: '#fff', fontSize: 12, fontWeight: 700, cursor: 'pointer', zIndex: 500 }}
                >
                  <MapPin size={12} /> Ouvrir la cartographie SIG complète
                </button>
              </div>

              {/* Panel infos géo */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                <div style={{ background: '#fff', borderRadius: 10, border: `1px solid ${C.border}`, padding: '16px' }}>
                  <div style={{ fontSize: 12.5, fontWeight: 700, color: '#1E293B', marginBottom: 12 }}>Géolocalisation projet</div>
                  {[
                    ['Région', projet.region],
                    ['Coordonnées', '14.6937° N, 17.4441° O'],
                    ['Zone couverte', '~120 km²'],
                    ['Villages cibles', '47 localités'],
                    ['Ménages raccordés', '3 240'],
                  ].map(([k, v]) => (
                    <div key={k} style={{ display: 'flex', justifyContent: 'space-between', padding: '5px 0', borderBottom: `1px solid ${C.border}`, fontSize: 11.5 }}>
                      <span style={{ color: '#94A3B8' }}>{k}</span>
                      <span style={{ fontWeight: 600, color: '#1E293B' }}>{v}</span>
                    </div>
                  ))}
                </div>
                <div style={{ background: '#fff', borderRadius: 10, border: `1px solid ${C.border}`, padding: '16px' }}>
                  <div style={{ fontSize: 12.5, fontWeight: 700, color: '#1E293B', marginBottom: 12 }}>Couches SIG actives</div>
                  {[
                    ['Lignes HTA', `${C.navy}`, '42 km tracés'],
                    ['Lignes BT', `${C.green}`, '186 km tracés'],
                    ['Postes de transformation', `${C.orange}`, '24 postes'],
                    ['Points terrain saisis', `${C.purple}`, '138 relevés GPS'],
                  ].map(([label, color, info]) => (
                    <div key={label} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '5px 0', borderBottom: `1px solid ${C.border}`, fontSize: 11.5 }}>
                      <div style={{ width: 10, height: 10, borderRadius: 3, background: color, flexShrink: 0 }} />
                      <span style={{ flex: 1, color: '#475569' }}>{label}</span>
                      <span style={{ color: '#94A3B8', fontSize: 10.5 }}>{info}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </>
        )}

        {/* ─── ACTIVITÉ / HISTORIQUE ─────────────────── */}
        {activeOnglet === 'activite' && (
          <>
            <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: 16 }}>
              {/* Timeline */}
              <div style={{ background: '#fff', borderRadius: 10, border: `1px solid ${C.border}`, padding: '16px 20px' }}>
                <div style={{ fontSize: 13, fontWeight: 700, color: '#1E293B', marginBottom: 16, display: 'flex', alignItems: 'center', gap: 6 }}>
                  <History size={13} style={{ color: C.navy }} /> Fil d&apos;activité — Audit Trail
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
                  {[
                    { date: '2026-05-25 14:32', type: 'tache', color: C.navy, icon: <CheckCircle2 size={12} />, msg: 'Tâche «Pose poteaux — Zone B» marquée Terminée', user: 'Traoré A.' },
                    { date: '2026-05-24 11:20', type: 'doc', color: C.purple, icon: <Paperclip size={12} />, msg: 'Document «PV réception partielle Lot 1» déposé dans GED', user: 'Commission' },
                    { date: '2026-05-23 16:05', type: 'validation', color: C.orange, icon: <Flag size={12} />, msg: 'Situation de travaux n°3 validée par DAF — 48 MFCFA débloqués', user: 'Diallo M.' },
                    { date: '2026-05-22 09:14', type: 'avancement', color: C.green, icon: <Activity size={12} />, msg: 'Avancement physique mis à jour : 68% → 71% (+3 pts)', user: 'Sène B.' },
                    { date: '2026-05-20 10:45', type: 'risque', color: C.red, icon: <AlertTriangle size={12} />, msg: 'Nouveau risque ouvert : «Retard livraison poteaux béton» (P×I = 16)', user: 'CP Traoré' },
                    { date: '2026-05-18 08:30', type: 'tache', color: C.navy, icon: <CheckCircle2 size={12} />, msg: 'Tâche «Fouilles fondations — Lot 2» passée En cours', user: 'Équipe terrain' },
                    { date: '2026-05-15 14:10', type: 'doc', color: C.purple, icon: <Paperclip size={12} />, msg: 'Photos chantier S20/2026 archivées — 18 Mo ajoutés', user: 'Superviseur' },
                    { date: '2026-05-12 09:00', type: 'validation', color: C.orange, icon: <Flag size={12} />, msg: 'ODM #DPE-2026-089 validé — Déplacement équipe Thiès', user: 'Dir. Admin.' },
                  ].map((e, i, arr) => (
                    <div key={i} style={{ display: 'flex', gap: 12, position: 'relative' }}>
                      {/* Ligne verticale */}
                      {i < arr.length - 1 && <div style={{ position: 'absolute', left: 16, top: 32, bottom: 0, width: 2, background: '#F1F5F9' }} />}
                      <div style={{ width: 32, height: 32, borderRadius: '50%', background: `${e.color}15`, border: `2px solid ${e.color}30`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, color: e.color, marginTop: 4 }}>
                        {e.icon}
                      </div>
                      <div style={{ flex: 1, paddingBottom: 16 }}>
                        <div style={{ fontSize: 12, color: '#1E293B', lineHeight: 1.4 }}>{e.msg}</div>
                        <div style={{ fontSize: 10, color: '#94A3B8', marginTop: 3 }}>
                          {e.user} · {new Date(e.date).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Stats activité */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                <div style={{ background: '#fff', borderRadius: 10, border: `1px solid ${C.border}`, padding: '16px' }}>
                  <div style={{ fontSize: 12.5, fontWeight: 700, color: '#1E293B', marginBottom: 12 }}>Activité 30 jours</div>
                  <ResponsiveContainer width="100%" height={120}>
                    <BarChart data={Array.from({ length: 6 }, (_, i) => ({ sem: `S${i + 1}`, events: [8, 14, 6, 22, 11, 18][i] }))} margin={{ top: 0, right: 0, left: -30, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#F1F5F9" />
                      <XAxis dataKey="sem" tick={{ fontSize: 10, fill: '#94A3B8' }} />
                      <YAxis tick={{ fontSize: 10, fill: '#94A3B8' }} />
                      <Tooltip formatter={(v: number) => [`${v} événements`]} />
                      <Bar dataKey="events" fill={C.navy} radius={[3, 3, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
                <div style={{ background: '#fff', borderRadius: 10, border: `1px solid ${C.border}`, padding: '16px' }}>
                  <div style={{ fontSize: 12.5, fontWeight: 700, color: '#1E293B', marginBottom: 10 }}>Par catégorie</div>
                  {[
                    ['Tâches', 12, C.navy],
                    ['Documents', 8, C.purple],
                    ['Validations', 5, C.orange],
                    ['Terrain', 9, C.green],
                    ['Risques', 3, C.red],
                  ].map(([l, v, c]) => (
                    <div key={String(l)} style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 7 }}>
                      <div style={{ width: 8, height: 8, borderRadius: '50%', background: String(c) }} />
                      <span style={{ fontSize: 11, color: '#475569', flex: 1 }}>{l}</span>
                      <div style={{ width: 80, height: 5, background: '#F1F5F9', borderRadius: 3, overflow: 'hidden' }}>
                        <div style={{ height: '100%', width: `${(Number(v) / 12) * 100}%`, background: String(c), borderRadius: 3 }} />
                      </div>
                      <span style={{ fontSize: 11, fontWeight: 700, color: '#1E293B', width: 18, textAlign: 'right' }}>{v}</span>
                    </div>
                  ))}
                </div>
                <div style={{ background: `${C.navy}08`, borderRadius: 10, border: `1px solid ${C.navy}20`, padding: '14px' }}>
                  <div style={{ fontSize: 11.5, fontWeight: 700, color: C.navy, marginBottom: 6 }}>Dernière synchronisation</div>
                  <div style={{ fontSize: 10.5, color: '#475569' }}>Aujourd&apos;hui à 14:32 — 3 nouveaux événements terrain remontés</div>
                </div>
              </div>
            </div>
          </>
        )}

        {/* ─── RISQUES ───────────────────────────────── */}
        {activeOnglet === 'risques' && (
          <>
            {/* Stats risques */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 10 }}>
              {[
                { label: 'Risques identifiés',  value: String(RISQUES.length),                                                color: C.navy },
                { label: 'Risques critiques',   value: String(RISQUES.filter(r => criticite(r.probabilite, r.impact) >= 12).length), color: C.red },
                { label: 'En cours traitement', value: String(RISQUES.filter(r => r.statut === 'en_cours').length),             color: C.amber },
                { label: 'Atténués',            value: String(RISQUES.filter(r => r.statut === 'atténué').length),              color: C.green },
              ].map(k => (
                <div key={k.label} style={{ background: '#fff', border: `1px solid ${C.border}`, borderRadius: 8, padding: '10px 14px', textAlign: 'center' }}>
                  <div style={{ fontSize: 22, fontWeight: 800, color: k.color }}>{k.value}</div>
                  <div style={{ fontSize: 10.5, color: '#94A3B8' }}>{k.label}</div>
                </div>
              ))}
            </div>

            {/* Matrice des risques + table */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: 16 }}>
              {/* Matrice 4x4 */}
              <div style={{ background: '#fff', borderRadius: 10, border: `1px solid ${C.border}`, padding: '16px' }}>
                <div style={{ fontSize: 13, fontWeight: 700, color: '#1E293B', marginBottom: 12 }}>Matrice Probabilité × Impact</div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 4 }}>
                  {Array.from({ length: 4 }, (_, pi) => 4 - pi).map(p =>
                    Array.from({ length: 4 }, (_, ii) => ii + 1).map(imp => {
                      const crit = p * imp;
                      const bg = crit >= 12 ? '#FEE2E2' : crit >= 6 ? '#FFF7ED' : '#DCFCE7';
                      const riqs = RISQUES.filter(r => r.probabilite === p && r.impact === imp);
                      return (
                        <div
                          key={`${p}-${imp}`}
                          title={riqs.map(r => r.intitule).join('\n')}
                          style={{
                            height: 40, borderRadius: 4, background: bg,
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                            fontSize: 11, fontWeight: riqs.length > 0 ? 800 : 400,
                            color: crit >= 12 ? C.red : crit >= 6 ? C.amber : C.green,
                            border: riqs.length > 0 ? `2px solid ${crit >= 12 ? C.red : crit >= 6 ? C.amber : C.green}` : `1px solid ${bg}`,
                          }}
                        >
                          {riqs.length > 0 ? riqs.length : ''}
                        </div>
                      );
                    })
                  )}
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 8 }}>
                  <span style={{ fontSize: 9.5, color: '#94A3B8' }}>Impact →</span>
                  <div style={{ display: 'flex', gap: 8 }}>
                    <span style={{ fontSize: 9.5, color: C.green, fontWeight: 600 }}>● Faible</span>
                    <span style={{ fontSize: 9.5, color: C.amber, fontWeight: 600 }}>● Modéré</span>
                    <span style={{ fontSize: 9.5, color: C.red, fontWeight: 600 }}>● Critique</span>
                  </div>
                </div>
              </div>

              {/* Table risques */}
              <div style={{ background: '#fff', borderRadius: 10, border: `1px solid ${C.border}`, overflow: 'hidden' }}>
                <div style={{ padding: '12px 16px', background: '#F8FAFC', borderBottom: `1px solid ${C.border}`, fontSize: 12.5, fontWeight: 700, color: '#1E293B' }}>
                  Registre des risques
                </div>
                {RISQUES.map((r, i) => {
                  const crit = criticite(r.probabilite, r.impact);
                  const cc = criticiteColor(crit);
                  const sc = RISQUE_STATUT[r.statut] ?? { color: C.slate, bg: '#F1F5F9', label: r.statut };
                  return (
                    <div
                      key={r.id}
                      style={{
                        padding: '11px 16px',
                        borderBottom: i < RISQUES.length - 1 ? `1px solid ${C.border}` : 'none',
                      }}
                    >
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 4 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                          <div style={{ width: 24, height: 24, borderRadius: 5, background: `${cc}20`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 10, fontWeight: 800, color: cc, flexShrink: 0 }}>
                            {crit}
                          </div>
                          <span style={{ fontSize: 12.5, fontWeight: 600, color: '#1E293B' }}>{r.intitule}</span>
                        </div>
                        <span style={{ fontSize: 10, fontWeight: 700, color: sc.color, background: sc.bg, padding: '2px 8px', borderRadius: 10, whiteSpace: 'nowrap' }}>
                          {sc.label}
                        </span>
                      </div>
                      <div style={{ fontSize: 10.5, color: '#64748B', paddingLeft: 32 }}>
                        <span style={{ color: '#94A3B8' }}>Catégorie:</span> {r.categorie} &nbsp;·&nbsp;
                        <span style={{ color: '#94A3B8' }}>P×I:</span> {r.probabilite}×{r.impact} &nbsp;·&nbsp;
                        <span style={{ color: '#94A3B8' }}>Mesure:</span> {r.action}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </>
        )}

      </div>

      {/* ══ MODAL ÉDITER PROJET ════════════════════════════ */}
      {showEditModal && (
        <>
          <div onClick={() => setShowEditModal(false)} style={{ position: 'fixed', inset: 0, zIndex: 200, background: 'rgba(0,0,0,0.45)', backdropFilter: 'blur(3px)' }} />
          <div style={{ position: 'fixed', top: '50%', left: '50%', transform: 'translate(-50%,-50%)', zIndex: 201, background: '#fff', borderRadius: 14, width: 680, maxHeight: '88vh', display: 'flex', flexDirection: 'column', boxShadow: '0 24px 64px rgba(0,0,0,0.22)' }}>
            {/* Header */}
            <div style={{ background: C.navy, padding: '16px 20px', borderRadius: '14px 14px 0 0', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0 }}>
              <div>
                <div style={{ fontSize: 15, fontWeight: 700, color: '#fff' }}>✏️ Modifier le projet</div>
                <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.6)', marginTop: 2 }}>{projet.code} — {projet.nom}</div>
              </div>
              <button onClick={() => setShowEditModal(false)} aria-label="Fermer la fenêtre de modification du projet" style={{ background: 'rgba(255,255,255,0.15)', border: 'none', borderRadius: 6, padding: 6, cursor: 'pointer', color: '#fff', display: 'flex' }}><X size={15} /></button>
            </div>
            {/* Body */}
            <div style={{ overflowY: 'auto', padding: '20px', display: 'flex', flexDirection: 'column', gap: 16, flex: 1 }}>
              {([
                ['Nom du projet', 'nom', 'text'],
                ['Chef de projet', 'chefProjet', 'text'],
                ['Région', 'region', 'text'],
                ['Localisation', 'localisation', 'text'],
              ] as [string, keyof typeof editForm, string][]).map(([label, key, type]) => (
                <div key={String(key)}>
                  <label style={{ fontSize: 11, fontWeight: 600, color: '#374151', display: 'block', marginBottom: 4 }}>{label}</label>
                  <input
                    type={type}
                    value={String(editForm[key] ?? '')}
                    onChange={e => setEditForm(prev => ({ ...prev, [key]: e.target.value }))}
                    style={{ width: '100%', boxSizing: 'border-box', padding: '8px 10px', fontSize: 12, border: '1px solid #D1D5DB', borderRadius: 6, color: '#111827', outline: 'none' }}
                  />
                </div>
              ))}
              <div>
                <label style={{ fontSize: 11, fontWeight: 600, color: '#374151', display: 'block', marginBottom: 4 }}>Description</label>
                <textarea
                  value={String(editForm.description ?? '')}
                  onChange={e => setEditForm(prev => ({ ...prev, description: e.target.value }))}
                  style={{ width: '100%', boxSizing: 'border-box', padding: '8px 10px', fontSize: 12, border: '1px solid #D1D5DB', borderRadius: 6, color: '#111827', outline: 'none', minHeight: 72, resize: 'vertical', fontFamily: 'inherit' }}
                />
              </div>
              <div>
                <label style={{ fontSize: 11, fontWeight: 600, color: '#374151', display: 'block', marginBottom: 4 }}>Objectif</label>
                <textarea
                  value={String(editForm.objectif ?? '')}
                  onChange={e => setEditForm(prev => ({ ...prev, objectif: e.target.value }))}
                  style={{ width: '100%', boxSizing: 'border-box', padding: '8px 10px', fontSize: 12, border: '1px solid #D1D5DB', borderRadius: 6, color: '#111827', outline: 'none', minHeight: 56, resize: 'vertical', fontFamily: 'inherit' }}
                />
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12 }}>
                {([
                  ['Budget total (MFCFA)', 'budget', 'number'],
                  ['Budget engagé (MFCFA)', 'budgetEngage', 'number'],
                  ['Budget décaissé (MFCFA)', 'budgetDecaisse', 'number'],
                ] as [string, keyof typeof editForm, string][]).map(([label, key, type]) => (
                  <div key={String(key)}>
                    <label style={{ fontSize: 11, fontWeight: 600, color: '#374151', display: 'block', marginBottom: 4 }}>{label}</label>
                    <input type={type} step="any" value={String(editForm[key] ?? '')} onChange={e => setEditForm(prev => ({ ...prev, [key]: parseFloat(e.target.value) || 0 }))}
                      style={{ width: '100%', boxSizing: 'border-box', padding: '8px 10px', fontSize: 12, border: '1px solid #D1D5DB', borderRadius: 6, color: '#111827', outline: 'none' }} />
                  </div>
                ))}
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                {([
                  ['Date de début', 'dateDebut', 'date'],
                  ['Date de fin prévue', 'dateFinPrevue', 'date'],
                ] as [string, keyof typeof editForm, string][]).map(([label, key, type]) => (
                  <div key={String(key)}>
                    <label style={{ fontSize: 11, fontWeight: 600, color: '#374151', display: 'block', marginBottom: 4 }}>{label}</label>
                    <input type={type} value={String(editForm[key] ?? '')} onChange={e => setEditForm(prev => ({ ...prev, [key]: e.target.value }))}
                      style={{ width: '100%', boxSizing: 'border-box', padding: '8px 10px', fontSize: 12, border: '1px solid #D1D5DB', borderRadius: 6, color: '#111827', outline: 'none' }} />
                  </div>
                ))}
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', gap: 12 }}>
                {([
                  ['Avancement (%)', 'avancement'],
                  ['Av. Planifié (%)', 'avancementPlanifie'],
                  ['CPI', 'cpi'],
                  ['SPI', 'spi'],
                ] as [string, keyof typeof editForm][]).map(([label, key]) => (
                  <div key={String(key)}>
                    <label style={{ fontSize: 11, fontWeight: 600, color: '#374151', display: 'block', marginBottom: 4 }}>{label}</label>
                    <input type="number" step="any" min="0" max={label.includes('%') ? '100' : undefined}
                      value={String(editForm[key] ?? '')}
                      onChange={e => setEditForm(prev => ({ ...prev, [key]: parseFloat(e.target.value) || 0 }))}
                      style={{ width: '100%', boxSizing: 'border-box', padding: '8px 10px', fontSize: 12, border: '1px solid #D1D5DB', borderRadius: 6, color: '#111827', outline: 'none' }} />
                  </div>
                ))}
              </div>
              <div>
                <label style={{ fontSize: 11, fontWeight: 600, color: '#374151', display: 'block', marginBottom: 4 }}>Priorité</label>
                <select value={String(editForm.priorite ?? 'Moyenne')} onChange={e => setEditForm(prev => ({ ...prev, priorite: e.target.value as Priorite }))}
                  style={{ width: '100%', boxSizing: 'border-box', padding: '8px 10px', fontSize: 12, border: '1px solid #D1D5DB', borderRadius: 6, color: '#111827', outline: 'none' }}>
                  <option value="Haute">Haute</option>
                  <option value="Moyenne">Moyenne</option>
                  <option value="Faible">Faible</option>
                </select>
              </div>
            </div>
            {/* Footer */}
            <div style={{ padding: '14px 20px', borderTop: '1px solid #E5E7EB', display: 'flex', gap: 10, justifyContent: 'flex-end', flexShrink: 0 }}>
              <button onClick={() => setShowEditModal(false)} style={{ padding: '8px 18px', fontSize: 12, fontWeight: 600, borderRadius: 7, border: '1px solid #D1D5DB', background: '#fff', color: '#374151', cursor: 'pointer' }}>Annuler</button>
              <button onClick={handleSaveProjet} style={{ padding: '8px 20px', fontSize: 12, fontWeight: 700, borderRadius: 7, border: 'none', background: C.orange, color: '#fff', cursor: 'pointer' }}>💾 Enregistrer</button>
            </div>
          </div>
        </>
      )}

      {/* ══ MODAL TÂCHE (Créer / Modifier) ════════════════ */}
      {showTacheModal && (
        <>
          <div onClick={() => setShowTacheModal(false)} style={{ position: 'fixed', inset: 0, zIndex: 200, background: 'rgba(0,0,0,0.45)', backdropFilter: 'blur(3px)' }} />
          <div style={{ position: 'fixed', top: '50%', left: '50%', transform: 'translate(-50%,-50%)', zIndex: 201, background: '#fff', borderRadius: 14, width: 500, boxShadow: '0 20px 60px rgba(0,0,0,0.22)' }}>
            <div style={{ background: C.navy, padding: '14px 18px', borderRadius: '14px 14px 0 0', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div style={{ fontSize: 14, fontWeight: 700, color: '#fff' }}>
                {editTacheId ? '✏️ Modifier la tâche' : '➕ Nouvelle tâche'}
              </div>
              <button onClick={() => setShowTacheModal(false)} aria-label="Fermer la fenêtre de tâche" style={{ background: 'rgba(255,255,255,0.15)', border: 'none', borderRadius: 6, padding: 6, cursor: 'pointer', color: '#fff', display: 'flex' }}><X size={14} /></button>
            </div>
            <div style={{ padding: '18px', display: 'flex', flexDirection: 'column', gap: 12 }}>
              <div>
                <label style={{ fontSize: 11, fontWeight: 600, color: '#374151', display: 'block', marginBottom: 4 }}>Nom de la tâche *</label>
                <input value={tacheForm.nom} onChange={e => setTacheForm(prev => ({ ...prev, nom: e.target.value }))} placeholder="Ex: Installation câbles HTA zone B" style={{ width: '100%', boxSizing: 'border-box', padding: '8px 10px', fontSize: 12, border: '1px solid #D1D5DB', borderRadius: 6, color: '#111827', outline: 'none' }} />
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                <div>
                  <label style={{ fontSize: 11, fontWeight: 600, color: '#374151', display: 'block', marginBottom: 4 }}>Date de début</label>
                  <input type="date" value={tacheForm.dateDebut} onChange={e => setTacheForm(prev => ({ ...prev, dateDebut: e.target.value }))} style={{ width: '100%', boxSizing: 'border-box', padding: '8px 10px', fontSize: 12, border: '1px solid #D1D5DB', borderRadius: 6, color: '#111827', outline: 'none' }} />
                </div>
                <div>
                  <label style={{ fontSize: 11, fontWeight: 600, color: '#374151', display: 'block', marginBottom: 4 }}>Date de fin</label>
                  <input type="date" value={tacheForm.dateFin} onChange={e => setTacheForm(prev => ({ ...prev, dateFin: e.target.value }))} style={{ width: '100%', boxSizing: 'border-box', padding: '8px 10px', fontSize: 12, border: '1px solid #D1D5DB', borderRadius: 6, color: '#111827', outline: 'none' }} />
                </div>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 10 }}>
                <div>
                  <label style={{ fontSize: 11, fontWeight: 600, color: '#374151', display: 'block', marginBottom: 4 }}>Type</label>
                  <select value={tacheForm.type} onChange={e => setTacheForm(prev => ({ ...prev, type: e.target.value as TypeTache }))} style={{ width: '100%', boxSizing: 'border-box', padding: '8px 10px', fontSize: 12, border: '1px solid #D1D5DB', borderRadius: 6, color: '#111827', outline: 'none' }}>
                    <option value="Normale">Normale</option><option value="Récapitulative">Récapitulative</option><option value="Jalon">Jalon</option>
                  </select>
                </div>
                <div>
                  <label style={{ fontSize: 11, fontWeight: 600, color: '#374151', display: 'block', marginBottom: 4 }}>Durée (j)</label>
                  <input type="number" min="1" value={tacheForm.duree} onChange={e => setTacheForm(prev => ({ ...prev, duree: e.target.value }))} style={{ width: '100%', boxSizing: 'border-box', padding: '8px 10px', fontSize: 12, border: '1px solid #D1D5DB', borderRadius: 6, color: '#111827', outline: 'none' }} />
                </div>
                <div>
                  <label style={{ fontSize: 11, fontWeight: 600, color: '#374151', display: 'block', marginBottom: 4 }}>Priorité</label>
                  <select value={tacheForm.priorite} onChange={e => setTacheForm(prev => ({ ...prev, priorite: e.target.value as Priorite }))} style={{ width: '100%', boxSizing: 'border-box', padding: '8px 10px', fontSize: 12, border: '1px solid #D1D5DB', borderRadius: 6, color: '#111827', outline: 'none' }}>
                    <option value="Haute">Haute</option><option value="Moyenne">Moyenne</option><option value="Faible">Faible</option>
                  </select>
                </div>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 10 }}>
                <div>
                  <label style={{ fontSize: 11, fontWeight: 600, color: '#374151', display: 'block', marginBottom: 4 }}>Statut</label>
                  <select value={tacheForm.statutTache} onChange={e => setTacheForm(prev => ({ ...prev, statutTache: e.target.value as StatutTache }))} style={{ width: '100%', boxSizing: 'border-box', padding: '8px 10px', fontSize: 12, border: '1px solid #D1D5DB', borderRadius: 6, color: '#111827', outline: 'none' }}>
                    <option value="a_faire">À faire</option><option value="en_cours">En cours</option><option value="bloque">Bloqué</option><option value="termine">Terminé</option>
                  </select>
                </div>
                <div>
                  <label style={{ fontSize: 11, fontWeight: 600, color: '#374151', display: 'block', marginBottom: 4 }}>Avancement</label>
                  <input type="range" min={0} max={100} step={5} value={tacheForm.avancement} onChange={e => setTacheForm(prev => ({ ...prev, avancement: Number(e.target.value) }))} style={{ width: '100%', accentColor: C.navy }} />
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                  <span style={{ fontSize: 12, fontWeight: 700, color: C.navy }}>{tacheForm.avancement}%</span>
                </div>
              </div>
              <div>
                <label style={{ fontSize: 11, fontWeight: 600, color: '#374151', display: 'block', marginBottom: 4 }}>Prédécesseur</label>
                <div style={{ display: 'flex', gap: 8 }}>
                  <select value={tacheForm.predId} onChange={e => setTacheForm(prev => ({ ...prev, predId: e.target.value }))} style={{ flex: 1, padding: '8px 10px', fontSize: 12, border: '1px solid #D1D5DB', borderRadius: 6, color: '#111827', outline: 'none' }}>
                    <option value="">— Aucun —</option>
                    {taches.filter(t => t.id !== editTacheId).map(t => (
                      <option key={t.id} value={t.id}>{t.ordre}. {t.nom}</option>
                    ))}
                  </select>
                  {tacheForm.predId && (
                    <select value={tacheForm.predType} onChange={e => setTacheForm(prev => ({ ...prev, predType: e.target.value as DepType }))} style={{ width: 70, padding: '8px 10px', fontSize: 12, border: '1px solid #D1D5DB', borderRadius: 6, color: '#111827', outline: 'none' }}>
                      <option value="FS">FS</option><option value="SS">SS</option><option value="FF">FF</option><option value="SF">SF</option>
                    </select>
                  )}
                </div>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                <div>
                  <label style={{ fontSize: 11, fontWeight: 600, color: '#374151', display: 'block', marginBottom: 4 }}>Coût prévu (FCFA)</label>
                  <input type="number" min={0} value={tacheForm.coutPrevu} onChange={e => setTacheForm(prev => ({ ...prev, coutPrevu: e.target.value === '' ? '' : Number(e.target.value) }))} style={{ width: '100%', boxSizing: 'border-box', padding: '8px 10px', fontSize: 12, border: '1px solid #D1D5DB', borderRadius: 6, color: '#111827', outline: 'none' }} />
                </div>
                <div>
                  <label style={{ fontSize: 11, fontWeight: 600, color: '#374151', display: 'block', marginBottom: 4 }}>Coût réel (FCFA)</label>
                  <input type="number" min={0} value={tacheForm.coutReel} onChange={e => setTacheForm(prev => ({ ...prev, coutReel: e.target.value === '' ? '' : Number(e.target.value) }))} style={{ width: '100%', boxSizing: 'border-box', padding: '8px 10px', fontSize: 12, border: '1px solid #D1D5DB', borderRadius: 6, color: '#111827', outline: 'none' }} />
                </div>
              </div>
              <div>
                <label style={{ fontSize: 11, fontWeight: 600, color: '#374151', display: 'block', marginBottom: 4 }}>Commentaire</label>
                <textarea value={tacheForm.commentaire} onChange={e => setTacheForm(prev => ({ ...prev, commentaire: e.target.value }))} style={{ width: '100%', boxSizing: 'border-box', padding: '8px 10px', fontSize: 12, border: '1px solid #D1D5DB', borderRadius: 6, color: '#111827', outline: 'none', minHeight: 52, resize: 'vertical', fontFamily: 'inherit' }} />
              </div>
            </div>
            <div style={{ padding: '12px 18px', borderTop: '1px solid #E5E7EB', display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
              <button onClick={() => setShowTacheModal(false)} style={{ padding: '7px 16px', fontSize: 11, fontWeight: 600, borderRadius: 6, border: '1px solid #D1D5DB', background: '#fff', color: '#374151', cursor: 'pointer' }}>Annuler</button>
              <button onClick={handleSaveTache} disabled={!tacheForm.nom.trim()} style={{ padding: '7px 18px', fontSize: 11, fontWeight: 700, borderRadius: 6, border: 'none', background: tacheForm.nom.trim() ? C.navy : '#E5E7EB', color: tacheForm.nom.trim() ? '#fff' : '#9CA3AF', cursor: tacheForm.nom.trim() ? 'pointer' : 'default' }}>
                {editTacheId ? '💾 Enregistrer' : '➕ Créer'}
              </button>
            </div>
          </div>
        </>
      )}

      {/* ══ MODAL NOUVEAU JALON ══════════════════════════════ */}
      {showJalonModal && (
        <>
          <div onClick={() => setShowJalonModal(false)} style={{ position: 'fixed', inset: 0, zIndex: 200, background: 'rgba(0,0,0,0.45)', backdropFilter: 'blur(3px)' }} />
          <div style={{ position: 'fixed', top: '50%', left: '50%', transform: 'translate(-50%,-50%)', zIndex: 201, background: '#fff', borderRadius: 12, width: 400, boxShadow: '0 20px 60px rgba(0,0,0,0.22)' }}>
            <div style={{ padding: '14px 18px', borderBottom: '1px solid #E5E7EB', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <span style={{ fontSize: 13, fontWeight: 700, color: '#1E293B' }}>🚩 Nouveau jalon</span>
              <button onClick={() => setShowJalonModal(false)} aria-label="Fermer la fenêtre de jalon" style={{ background: '#F1F5F9', border: 'none', borderRadius: 5, padding: 5, cursor: 'pointer', display: 'flex' }}><X size={13} /></button>
            </div>
            <div style={{ padding: '16px 18px', display: 'flex', flexDirection: 'column', gap: 12 }}>
              <div>
                <label style={{ fontSize: 11, fontWeight: 600, color: '#374151', display: 'block', marginBottom: 4 }}>Libellé du jalon *</label>
                <input value={jalonForm.label} onChange={e => setJalonForm(prev => ({ ...prev, label: e.target.value }))} placeholder="Ex: Mise en service phase 1" style={{ width: '100%', boxSizing: 'border-box', padding: '8px 10px', fontSize: 12, border: '1px solid #D1D5DB', borderRadius: 6, color: '#111827', outline: 'none' }} />
              </div>
              <div>
                <label style={{ fontSize: 11, fontWeight: 600, color: '#374151', display: 'block', marginBottom: 4 }}>Date cible *</label>
                <input type="date" value={jalonForm.date} onChange={e => setJalonForm(prev => ({ ...prev, date: e.target.value }))} style={{ width: '100%', boxSizing: 'border-box', padding: '8px 10px', fontSize: 12, border: '1px solid #D1D5DB', borderRadius: 6, color: '#111827', outline: 'none' }} />
              </div>
            </div>
            <div style={{ padding: '12px 18px', borderTop: '1px solid #E5E7EB', display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
              <button onClick={() => setShowJalonModal(false)} style={{ padding: '7px 14px', fontSize: 11, fontWeight: 600, borderRadius: 6, border: '1px solid #D1D5DB', background: '#fff', color: '#374151', cursor: 'pointer' }}>Annuler</button>
              <button onClick={handleAddJalon} disabled={!jalonForm.label.trim() || !jalonForm.date} style={{ padding: '7px 16px', fontSize: 11, fontWeight: 700, borderRadius: 6, border: 'none', background: jalonForm.label.trim() && jalonForm.date ? C.orange : '#E5E7EB', color: jalonForm.label.trim() && jalonForm.date ? '#fff' : '#9CA3AF', cursor: 'pointer' }}>
                🚩 Ajouter
              </button>
            </div>
          </div>
        </>
      )}

      {/* ══ MODAL DÉPÔT DOCUMENT ════════════════════════════ */}
      {showUploadModal && (
        <>
          <div onClick={() => setShowUploadModal(false)} style={{ position: 'fixed', inset: 0, zIndex: 200, background: 'rgba(0,0,0,0.45)', backdropFilter: 'blur(3px)' }} />
          <div style={{ position: 'fixed', top: '50%', left: '50%', transform: 'translate(-50%,-50%)', zIndex: 201, background: '#fff', borderRadius: 14, width: 480, boxShadow: '0 20px 60px rgba(0,0,0,0.22)' }}>
            <div style={{ background: C.navy, padding: '14px 18px', borderRadius: '14px 14px 0 0', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div style={{ fontSize: 14, fontWeight: 700, color: '#fff' }}>📎 Déposer un document</div>
              <button onClick={() => setShowUploadModal(false)} aria-label="Fermer la fenêtre de dépôt de document" style={{ background: 'rgba(255,255,255,0.15)', border: 'none', borderRadius: 6, padding: 6, cursor: 'pointer', color: '#fff', display: 'flex' }}><X size={14} /></button>
            </div>
            <div style={{ padding: '18px', display: 'flex', flexDirection: 'column', gap: 12 }}>
              <div>
                <label style={{ fontSize: 12, fontWeight: 600, color: '#374151', display: 'block', marginBottom: 4 }}>Nom du document *</label>
                <input value={uploadForm.nom} onChange={e => setUploadForm(p => ({ ...p, nom: e.target.value }))} placeholder="Ex: Rapport mensuel Mai 2026.pdf" style={{ width: '100%', boxSizing: 'border-box', padding: '8px 10px', fontSize: 13, border: '1px solid #D1D5DB', borderRadius: 6, outline: 'none' }} />
              </div>
              <div>
                <label style={{ fontSize: 12, fontWeight: 600, color: '#374151', display: 'block', marginBottom: 4 }}>Type de document</label>
                <select value={uploadForm.type} onChange={e => setUploadForm(p => ({ ...p, type: e.target.value }))} style={{ width: '100%', boxSizing: 'border-box', padding: '8px 10px', fontSize: 13, border: '1px solid #D1D5DB', borderRadius: 6, outline: 'none' }}>
                  {['Rapport', 'Contrat', 'Plan', 'PV', 'Étude', 'Photo', 'Facture', 'Correspondance', 'Autre'].map(t => <option key={t} value={t}>{t}</option>)}
                </select>
              </div>
              <div style={{ border: '2px dashed #D1D5DB', borderRadius: 8, padding: '24px', textAlign: 'center', cursor: 'pointer', background: '#F8FAFC' }} onClick={() => alert('Sélectionnez votre fichier depuis l\'explorateur')}>
                <Upload size={28} style={{ color: '#94A3B8', margin: '0 auto 8px', display: 'block' }} />
                <div style={{ fontSize: 13, color: '#64748B', fontWeight: 600 }}>Cliquer pour sélectionner un fichier</div>
                <div style={{ fontSize: 11, color: '#94A3B8', marginTop: 4 }}>PDF, Word, Excel, DWG, ZIP — max 50 Mo</div>
              </div>
              <div>
                <label style={{ fontSize: 12, fontWeight: 600, color: '#374151', display: 'block', marginBottom: 4 }}>Commentaire</label>
                <textarea value={uploadForm.commentaire} onChange={e => setUploadForm(p => ({ ...p, commentaire: e.target.value }))} style={{ width: '100%', boxSizing: 'border-box', padding: '8px 10px', fontSize: 13, border: '1px solid #D1D5DB', borderRadius: 6, outline: 'none', minHeight: 52, resize: 'vertical', fontFamily: 'inherit' }} />
              </div>
            </div>
            <div style={{ padding: '12px 18px', borderTop: '1px solid #E5E7EB', display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
              <button onClick={() => setShowUploadModal(false)} style={{ padding: '8px 16px', fontSize: 12, fontWeight: 600, borderRadius: 7, border: '1px solid #D1D5DB', background: '#fff', color: '#374151', cursor: 'pointer' }}>Annuler</button>
              <button
                onClick={() => {
                  if (!uploadForm.nom.trim()) return;
                  const ext = uploadForm.nom.split('.').pop() ?? 'pdf';
                  const newDoc = { id: `d${Date.now()}`, nom: uploadForm.nom, type: uploadForm.type, date: new Date().toISOString().split('T')[0], taille: '—', auteur: 'Vous', statut: 'publié', ext: ext.toLowerCase().substring(0, 4) as 'pdf' };
                  setGedDocs(prev => [newDoc, ...prev]);
                  setShowUploadModal(false);
                  setUploadForm({ nom: '', type: 'Rapport', commentaire: '' });
                }}
                disabled={!uploadForm.nom.trim()}
                style={{ padding: '8px 18px', fontSize: 12, fontWeight: 700, borderRadius: 7, border: 'none', background: uploadForm.nom.trim() ? C.navy : '#E5E7EB', color: uploadForm.nom.trim() ? '#fff' : '#9CA3AF', cursor: uploadForm.nom.trim() ? 'pointer' : 'not-allowed', opacity: uploadForm.nom.trim() ? 1 : 0.5 }}
              >
                📎 Déposer
              </button>
            </div>
          </div>
        </>
      )}

      {/* ══ ONGLET FICHE EXÉCUTIVE ═══════════════════════════════ */}
      {activeOnglet === 'fiche-executive' && projet && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>

          {/* ── Bannière identité projet ── */}
          <div style={{
            background: 'linear-gradient(135deg, #2D1167 0%, #3D1A6B 100%)',
            borderRadius: 12, padding: '20px 24px',
            display: 'flex', alignItems: 'flex-start', gap: 20, flexWrap: 'wrap',
          }}>
            <div style={{ width: 56, height: 56, borderRadius: 12, background: `${DOMAINE_CFG[projet.domaine as Domaine]?.color}30`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 26, flexShrink: 0 }}>
              {DOMAINE_CFG[projet.domaine as Domaine]?.emoji ?? '🏗'}
            </div>
            <div style={{ flex: 1, minWidth: 240 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 6, flexWrap: 'wrap' }}>
                <span style={{ fontSize: 18, fontWeight: 800, color: '#fff' }}>{projet.nom}</span>
                <span style={{ fontSize: 10, fontWeight: 700, padding: '2px 8px', borderRadius: 99, background: 'rgba(255,255,255,0.15)', color: 'rgba(255,255,255,0.90)' }}>{projet.code}</span>
                <span style={{ fontSize: 10, fontWeight: 700, padding: '2px 8px', borderRadius: 99, background: projet.statut === 'en_cours' ? '#16A34A30' : '#F4792030', color: projet.statut === 'en_cours' ? '#86EFAC' : '#FED7AA' }}>
                  {projet.statut === 'en_cours' ? '▶ En cours' : projet.statut === 'planifie' ? '📅 Planifié' : projet.statut === 'termine' ? '✅ Terminé' : projet.statut === 'en_retard' ? '⚠ En retard' : String(projet.statut)}
                </span>
              </div>
              <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.70)', lineHeight: 1.5 }}>
                {DOMAINE_CFG[projet.domaine as Domaine]?.label} · {projet.region} · Responsable : {projet.chefProjet} · Bailleur : {(projet.bailleurs[0]?.nom ?? 'SENELEC')}
              </div>
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              <button onClick={() => {
                const link = `${window.location.origin}/cockpit-projet?id=${projet.id}`;
                navigator.clipboard?.writeText(link).catch(() => undefined);
                alert(`Lien du cockpit copié :\n${link}`);
              }} style={{ padding: '7px 14px', fontSize: 11, fontWeight: 700, borderRadius: 7, border: '1.5px solid rgba(255,255,255,0.30)', background: 'rgba(255,255,255,0.12)', color: '#fff', cursor: 'pointer' }}>
                📤 Partager
              </button>
              <button onClick={() => {
                const w = window.open('', '_blank');
                if (!w) { alert('Veuillez autoriser les popups.'); return; }
                w.document.write(`<!DOCTYPE html><html><head><meta charset="UTF-8"><title>Cockpit — ${projet.code}</title>
                <style>body{font-family:Arial,sans-serif;margin:32px;color:#111}h1{color:#1B4F8A;font-size:20px;margin-bottom:2px}.sub{color:#64748B;font-size:12px;margin-bottom:20px}.kpi{display:inline-block;margin:0 18px 14px 0;background:#EFF6FF;border-radius:8px;padding:10px 18px}.kpi b{display:block;font-size:22px;color:#1B4F8A}.kpi span{font-size:10px;color:#64748B}table{width:100%;border-collapse:collapse;font-size:12px;margin-top:8px}td,th{border:1px solid #E2E8F0;padding:7px 10px;text-align:left}th{background:#1B4F8A;color:#fff}</style></head><body>
                <div style="margin-bottom:14px"><img src="${SENELEC_LOGO_DATA_URI}" alt="SENELEC" style="height:48px;width:auto;display:block" /></div>
                <h1>Fiche Exécutive Projet — ${projet.code}</h1>
                <div class="sub">${projet.nom} · ${projet.region} · Chef : ${projet.chefProjet} · Généré le ${new Date().toLocaleDateString('fr-FR')}</div>
                <div>
                  <div class="kpi"><b>${projet.avancement}%</b><span>Avancement</span></div>
                  <div class="kpi"><b>${projet.cpi.toFixed(2)}</b><span>CPI</span></div>
                  <div class="kpi"><b>${projet.spi.toFixed(2)}</b><span>SPI</span></div>
                  <div class="kpi"><b>${projet.budget.toLocaleString('fr-FR')} M</b><span>Budget (MFCFA)</span></div>
                  <div class="kpi"><b>${projet.priorite}</b><span>Priorité</span></div>
                </div>
                <table><tr><th>Indicateur</th><th>Valeur</th></tr>
                  <tr><td>Domaine</td><td>${DOMAINE_CFG[projet.domaine as Domaine]?.label ?? projet.domaine}</td></tr>
                  <tr><td>Budget engagé</td><td>${projet.budgetEngage.toLocaleString('fr-FR')} MFCFA</td></tr>
                  <tr><td>Budget décaissé</td><td>${projet.budgetDecaisse.toLocaleString('fr-FR')} MFCFA</td></tr>
                  <tr><td>Date début → fin prévue</td><td>${projet.dateDebut} → ${projet.dateFinPrevue}</td></tr>
                  <tr><td>Bailleur principal</td><td>${projet.bailleurs[0]?.nom ?? 'SENELEC'}</td></tr>
                </table>
                <script>window.onload=()=>window.print();</script></body></html>`);
                w.document.close();
              }} style={{ padding: '7px 14px', fontSize: 11, fontWeight: 700, borderRadius: 7, border: 'none', background: '#F47920', color: '#fff', cursor: 'pointer' }}>
                📄 Exporter PDF
              </button>
            </div>
          </div>

          {/* ── Grille KPI exécutifs ── */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5,1fr)', gap: 10 }}>
            {[
              { label: 'Avancement physique', value: `${projet.avancement}%`,   color: projet.avancement >= 70 ? C.green : projet.avancement >= 40 ? C.amber : C.red },
              { label: 'Budget total',         value: `${projet.budget.toLocaleString('fr-FR')} MFCFA`,   color: C.navy },
              { label: 'Décaissé',             value: `${projet.budgetDecaisse.toLocaleString('fr-FR')} MFCFA`, color: C.orange },
              { label: 'CPI (performance coût)', value: projet.cpi.toFixed(2),  color: projet.cpi >= 0.90 ? C.green : C.red },
              { label: 'SPI (performance délai)', value: projet.spi.toFixed(2), color: projet.spi >= 0.85 ? C.green : C.red },
            ].map(k => (
              <div key={k.label} style={{ background: '#fff', borderRadius: 10, padding: '14px 16px', border: `1px solid ${C.border}`, textAlign: 'center' }}>
                <div style={{ fontSize: 20, fontWeight: 800, color: k.color }}>{k.value}</div>
                <div style={{ fontSize: 10, color: '#94A3B8', marginTop: 4 }}>{k.label}</div>
              </div>
            ))}
          </div>

          {/* ── Deux colonnes principales ── */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>

            {/* Colonne gauche */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>

              {/* Description */}
              <div style={{ background: '#fff', borderRadius: 10, border: editingSection === 'description' ? `1px solid ${C.orange}` : `1px solid ${C.border}`, padding: '16px 20px' }}>
                <div style={{ fontSize: 12, fontWeight: 700, color: C.navy, marginBottom: 10, display: 'flex', alignItems: 'center', gap: 6 }}>
                  <span style={{ width: 4, height: 16, background: C.orange, borderRadius: 2, display: 'inline-block' }} />
                  DESCRIPTION DU PROJET
                  <SectionEditBtn section="description" />
                </div>
                {editingSection === 'description' ? (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                    <textarea
                      value={ficheDesc}
                      onChange={e => setFicheDesc(e.target.value)}
                      rows={5}
                      style={{ width: '100%', fontSize: 13, color: '#374151', lineHeight: 1.7, borderRadius: 7, border: `1px solid ${C.border}`, padding: '8px 10px', fontFamily: 'inherit', resize: 'vertical', outline: 'none' }}
                    />
                    <div style={{ display: 'flex', gap: 6, justifyContent: 'flex-end' }}>
                      <button onClick={closeFicheEdit} style={{ padding: '5px 12px', fontSize: 11, borderRadius: 6, border: `1px solid ${C.border}`, background: '#fff', cursor: 'pointer', color: '#64748B' }}>Annuler</button>
                      <button onClick={saveFicheDesc} style={{ padding: '5px 12px', fontSize: 11, borderRadius: 6, border: 'none', background: C.navy, color: '#fff', cursor: 'pointer', fontWeight: 700, display: 'flex', alignItems: 'center', gap: 4 }}><Save size={10} /> Enregistrer</button>
                    </div>
                  </div>
                ) : (
                  <div style={{ fontSize: 13, color: '#374151', lineHeight: 1.7 }}>
                    {String(projet.description || ficheDefaults.description)}
                  </div>
                )}
              </div>

              {/* Contexte */}
              <div style={{ background: '#fff', borderRadius: 10, border: editingSection === 'contexte' ? `1px solid ${C.orange}` : `1px solid ${C.border}`, padding: '16px 20px' }}>
                <div style={{ fontSize: 12, fontWeight: 700, color: C.navy, marginBottom: 10, display: 'flex', alignItems: 'center', gap: 6 }}>
                  <span style={{ width: 4, height: 16, background: '#8B5CF6', borderRadius: 2, display: 'inline-block' }} />
                  CONTEXTE & JUSTIFICATION
                  <SectionEditBtn section="contexte" />
                </div>
                {editingSection === 'contexte' ? (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                    <textarea
                      value={ficheContexte}
                      onChange={e => setFicheContexte(e.target.value)}
                      rows={5}
                      style={{ width: '100%', fontSize: 13, color: '#374151', lineHeight: 1.7, borderRadius: 7, border: `1px solid ${C.border}`, padding: '8px 10px', fontFamily: 'inherit', resize: 'vertical', outline: 'none' }}
                    />
                    <div style={{ display: 'flex', gap: 6, justifyContent: 'flex-end' }}>
                      <button onClick={closeFicheEdit} style={{ padding: '5px 12px', fontSize: 11, borderRadius: 6, border: `1px solid ${C.border}`, background: '#fff', cursor: 'pointer', color: '#64748B' }}>Annuler</button>
                      <button onClick={saveFicheContexte} style={{ padding: '5px 12px', fontSize: 11, borderRadius: 6, border: 'none', background: C.navy, color: '#fff', cursor: 'pointer', fontWeight: 700, display: 'flex', alignItems: 'center', gap: 4 }}><Save size={10} /> Enregistrer</button>
                    </div>
                  </div>
                ) : (
                  <div style={{ fontSize: 13, color: '#374151', lineHeight: 1.7 }}>
                    {String(projet.contexte || ficheDefaults.contexte)}
                  </div>
                )}
              </div>

              {/* Objectifs */}
              <div style={{ background: '#fff', borderRadius: 10, border: editingSection === 'objectifs' ? `1px solid ${C.orange}` : `1px solid ${C.border}`, padding: '16px 20px' }}>
                <div style={{ fontSize: 12, fontWeight: 700, color: C.navy, marginBottom: 10, display: 'flex', alignItems: 'center', gap: 6 }}>
                  <span style={{ width: 4, height: 16, background: C.green, borderRadius: 2, display: 'inline-block' }} />
                  OBJECTIFS DU PROJET
                  <SectionEditBtn section="objectifs" />
                </div>
                {editingSection === 'objectifs' ? (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                    {ficheObjectifs.map((obj, i) => (
                      <div key={i} style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                        <span style={{ width: 18, height: 18, borderRadius: '50%', background: `${C.green}20`, color: C.green, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 9, fontWeight: 800, flexShrink: 0 }}>{i+1}</span>
                        <input
                          value={obj}
                          onChange={e => { const next = [...ficheObjectifs]; next[i] = e.target.value; setFicheObjectifs(next); }}
                          style={{ flex: 1, fontSize: 12.5, color: '#374151', border: `1px solid ${C.border}`, borderRadius: 6, padding: '4px 8px', fontFamily: 'inherit', outline: 'none' }}
                        />
                        <button onClick={() => setFicheObjectifs(prev => prev.filter((_, j) => j !== i))} style={{ padding: '2px 6px', borderRadius: 5, border: `1px solid ${C.border}`, background: '#fff', color: C.red, cursor: 'pointer', fontSize: 10 }}>✕</button>
                      </div>
                    ))}
                    <button onClick={() => setFicheObjectifs(prev => [...prev, ''])} style={{ alignSelf: 'flex-start', fontSize: 11, padding: '4px 10px', borderRadius: 6, border: `1px dashed ${C.border}`, background: '#F8FAFC', color: '#64748B', cursor: 'pointer', marginTop: 4 }}>+ Ajouter un objectif</button>
                    <div style={{ display: 'flex', gap: 6, justifyContent: 'flex-end', marginTop: 4 }}>
                      <button onClick={closeFicheEdit} style={{ padding: '5px 12px', fontSize: 11, borderRadius: 6, border: `1px solid ${C.border}`, background: '#fff', cursor: 'pointer', color: '#64748B' }}>Annuler</button>
                      <button onClick={saveFicheObjectifs} style={{ padding: '5px 12px', fontSize: 11, borderRadius: 6, border: 'none', background: C.navy, color: '#fff', cursor: 'pointer', fontWeight: 700, display: 'flex', alignItems: 'center', gap: 4 }}><Save size={10} /> Enregistrer</button>
                    </div>
                  </div>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                    {(projet.objectifs?.length ? projet.objectifs : ficheDefaults.objectifs).map((obj, i) => (
                      <div key={i} style={{ display: 'flex', gap: 8, alignItems: 'flex-start', fontSize: 12.5, color: '#374151' }}>
                        <span style={{ width: 18, height: 18, borderRadius: '50%', background: `${C.green}20`, color: C.green, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 9, fontWeight: 800, flexShrink: 0, marginTop: 1 }}>{i+1}</span>
                        {obj}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* Colonne droite */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>

              {/* Livrables */}
              <div style={{ background: '#fff', borderRadius: 10, border: editingSection === 'livrables' ? `1px solid ${C.orange}` : `1px solid ${C.border}`, padding: '16px 20px' }}>
                <div style={{ fontSize: 12, fontWeight: 700, color: C.navy, marginBottom: 10, display: 'flex', alignItems: 'center', gap: 6 }}>
                  <span style={{ width: 4, height: 16, background: C.amber, borderRadius: 2, display: 'inline-block' }} />
                  LIVRABLES ATTENDUS
                  <SectionEditBtn section="livrables" />
                </div>
                {editingSection === 'livrables' ? (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                    {ficheLivrables.map((liv, i) => (
                      <div key={i} style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                        <span style={{ width: 18, height: 18, borderRadius: '50%', background: `${C.amber}20`, color: C.amber, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 9, fontWeight: 800, flexShrink: 0 }}>{i+1}</span>
                        <input
                          value={liv}
                          onChange={e => { const next = [...ficheLivrables]; next[i] = e.target.value; setFicheLivrables(next); }}
                          style={{ flex: 1, fontSize: 12.5, color: '#374151', border: `1px solid ${C.border}`, borderRadius: 6, padding: '4px 8px', fontFamily: 'inherit', outline: 'none' }}
                        />
                        <button onClick={() => setFicheLivrables(prev => prev.filter((_, j) => j !== i))} style={{ padding: '2px 6px', borderRadius: 5, border: `1px solid ${C.border}`, background: '#fff', color: C.red, cursor: 'pointer', fontSize: 10 }}>✕</button>
                      </div>
                    ))}
                    <button onClick={() => setFicheLivrables(prev => [...prev, ''])} style={{ alignSelf: 'flex-start', fontSize: 11, padding: '4px 10px', borderRadius: 6, border: `1px dashed ${C.border}`, background: '#F8FAFC', color: '#64748B', cursor: 'pointer', marginTop: 4 }}>+ Ajouter un livrable</button>
                    <div style={{ display: 'flex', gap: 6, justifyContent: 'flex-end', marginTop: 4 }}>
                      <button onClick={closeFicheEdit} style={{ padding: '5px 12px', fontSize: 11, borderRadius: 6, border: `1px solid ${C.border}`, background: '#fff', cursor: 'pointer', color: '#64748B' }}>Annuler</button>
                      <button onClick={saveFicheLivrables} style={{ padding: '5px 12px', fontSize: 11, borderRadius: 6, border: 'none', background: C.navy, color: '#fff', cursor: 'pointer', fontWeight: 700, display: 'flex', alignItems: 'center', gap: 4 }}><Save size={10} /> Enregistrer</button>
                    </div>
                  </div>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
                    {(projet.livrables?.length ? projet.livrables : ficheDefaults.livrables).map((liv, i) => (
                      <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '6px 10px', borderRadius: 7, background: '#F8FAFC', border: '1px solid #F1F5F9' }}>
                        <span style={{ width: 18, height: 18, borderRadius: '50%', background: `${C.amber}20`, color: C.amber, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 9, fontWeight: 800, flexShrink: 0 }}>{i+1}</span>
                        <span style={{ fontSize: 12, color: '#374151' }}>{liv}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Équipe projet */}
              <div style={{ background: '#fff', borderRadius: 10, border: editingSection === 'equipe' ? `1px solid ${C.orange}` : `1px solid ${C.border}`, padding: '16px 20px' }}>
                <div style={{ fontSize: 12, fontWeight: 700, color: C.navy, marginBottom: 10, display: 'flex', alignItems: 'center', gap: 6 }}>
                  <span style={{ width: 4, height: 16, background: '#0EA5E9', borderRadius: 2, display: 'inline-block' }} />
                  ÉQUIPE PROJET
                  <SectionEditBtn section="equipe" />
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  {/* Chef de projet (réel) */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <div style={{ width: 28, height: 28, borderRadius: 7, background: `${C.navy}20`, color: C.navy, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 10, fontWeight: 800, flexShrink: 0 }}>
                      {projet.chefProjet.split(' ').map((n: string) => n[0]).join('').slice(0,2)}
                    </div>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: 12, fontWeight: 600, color: '#1E293B' }}>{projet.chefProjet}</div>
                      <div style={{ fontSize: 10, color: '#94A3B8' }}>{chefInfo.poste} · {chefInfo.direction}</div>
                    </div>
                  </div>
                  {/* Membres RÉELS de l'équipe (personnel DPE) */}
                  {equipe.map((r: any) => (
                    <div key={r.id} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <div style={{ width: 28, height: 28, borderRadius: 7, background: '#0EA5E920', color: '#0EA5E9', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 10, fontWeight: 800, flexShrink: 0 }}>
                        {`${r.prenom} ${r.nom}`.split(' ').map((n: string) => n[0]).join('').slice(0,2)}
                      </div>
                      <div style={{ flex: 1 }}>
                        <div style={{ fontSize: 12, fontWeight: 600, color: '#1E293B' }}>{r.prenom} {r.nom}</div>
                        <div style={{ fontSize: 10, color: '#94A3B8' }}>{r.poste || 'Membre équipe'}{r.direction ? ` · ${r.direction}` : ''}</div>
                      </div>
                      {editingSection === 'equipe' && (
                        <button onClick={() => removeEquipeMember(r.id)} title="Retirer" style={{ border: 'none', background: 'transparent', color: C.red, cursor: 'pointer', padding: 2 }}><X size={13} /></button>
                      )}
                    </div>
                  ))}
                  {equipe.length === 0 && editingSection !== 'equipe' && (
                    <div style={{ fontSize: 11, color: '#94A3B8', fontStyle: 'italic' }}>Aucun membre assigné — utilisez « Modifier » pour ajouter du personnel DPE.</div>
                  )}
                  {editingSection === 'equipe' && (() => {
                    const q = normName(equipeSearch);
                    const dispo = personnelSelectionnable.filter(r => !projet.equipe.includes(r.id) && normName(`${r.prenom} ${r.nom}`) !== normName(projet.chefProjet));
                    const matches = q
                      ? dispo.filter(r => normName(`${r.prenom} ${r.nom} ${r.poste || ''} ${r.direction || ''}`).includes(q))
                      : dispo;
                    return (
                      <div style={{ marginTop: 6, paddingTop: 8, borderTop: `1px solid ${C.border}` }}>
                        <label style={{ fontSize: 10.5, fontWeight: 700, color: '#64748B' }}>Ajouter un membre (personnel DPE — {dispo.length} agents disponibles)</label>
                        <div style={{ position: 'relative', marginTop: 4 }}>
                          <Search size={12} style={{ position: 'absolute', left: 8, top: '50%', transform: 'translateY(-50%)', color: '#94A3B8' }} />
                          <input
                            value={equipeSearch}
                            onChange={(e) => setEquipeSearch(e.target.value)}
                            placeholder="Rechercher un agent par nom, poste, direction…"
                            style={{ width: '100%', fontSize: 12, padding: '6px 8px 6px 26px', borderRadius: 6, border: `1px solid ${C.border}`, fontFamily: 'inherit', outline: 'none', boxSizing: 'border-box' }}
                          />
                        </div>
                        <div style={{ marginTop: 6, maxHeight: 180, overflowY: 'auto', border: `1px solid ${C.border}`, borderRadius: 6 }}>
                          {matches.length === 0 && (
                            <div style={{ padding: '10px 12px', fontSize: 11, color: '#94A3B8', fontStyle: 'italic' }}>Aucun agent ne correspond.</div>
                          )}
                          {matches.slice(0, 60).map(r => (
                            <button
                              key={r.id}
                              onClick={() => { addEquipeMember(r.id); setEquipeSearch(''); }}
                              style={{ width: '100%', textAlign: 'left', display: 'flex', alignItems: 'center', gap: 8, padding: '6px 10px', border: 'none', borderBottom: `1px solid ${C.border}`, background: 'transparent', cursor: 'pointer' }}
                            >
                              <div style={{ width: 24, height: 24, borderRadius: 6, background: '#0EA5E920', color: '#0EA5E9', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 9, fontWeight: 800, flexShrink: 0 }}>
                                {`${r.prenom} ${r.nom}`.split(' ').map((n: string) => n[0]).join('').slice(0,2)}
                              </div>
                              <div style={{ flex: 1, minWidth: 0 }}>
                                <div style={{ fontSize: 12, fontWeight: 600, color: '#1E293B' }}>{r.prenom} {r.nom}</div>
                                <div style={{ fontSize: 10, color: '#94A3B8', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{r.poste || 'Membre équipe'}{r.direction ? ` · ${r.direction}` : ''}</div>
                              </div>
                              <Plus size={13} style={{ color: C.navy, flexShrink: 0 }} />
                            </button>
                          ))}
                          {matches.length > 60 && (
                            <div style={{ padding: '8px 12px', fontSize: 10.5, color: '#94A3B8' }}>{matches.length - 60} autres — affinez la recherche.</div>
                          )}
                        </div>
                        <div style={{ display: 'flex', gap: 6, justifyContent: 'flex-end', marginTop: 8 }}>
                          <button onClick={() => { setEquipeSearch(''); closeFicheEdit(); }} style={{ padding: '5px 12px', fontSize: 11, borderRadius: 6, border: 'none', background: C.navy, color: '#fff', cursor: 'pointer', fontWeight: 700, display: 'flex', alignItems: 'center', gap: 4 }}><Check size={10} /> Terminer</button>
                        </div>
                      </div>
                    );
                  })()}
                </div>
              </div>
            </div>
          </div>

          {/* ── Jalons clés ── */}
          <div style={{ background: '#fff', borderRadius: 10, border: editingSection === 'jalons' ? `1px solid ${C.orange}` : `1px solid ${C.border}`, padding: '16px 20px' }}>
            <div style={{ fontSize: 12, fontWeight: 700, color: C.navy, marginBottom: 14, display: 'flex', alignItems: 'center', gap: 6 }}>
              <span style={{ width: 4, height: 16, background: C.red, borderRadius: 2, display: 'inline-block' }} />
              JALONS CLÉS DU PROJET
              <SectionEditBtn section="jalons" />
            </div>
            {projet.jalons.length === 0 && (
              <div style={{ fontSize: 11, color: '#94A3B8', fontStyle: 'italic', marginBottom: 8 }}>Aucun jalon défini pour ce projet.</div>
            )}
            <div style={{ display: 'flex', gap: 0, alignItems: 'stretch', overflowX: 'auto' }}>
              {projet.jalons.map((j, i, arr) => {
                const done = j.atteint;
                const dateFmt = (() => { const d = new Date(j.date); return isNaN(d.getTime()) ? j.date : d.toLocaleDateString('fr-FR'); })();
                const editable = editingSection === 'jalons';
                return (
                <div key={i} style={{ flex: 1, minWidth: 110, display: 'flex', flexDirection: 'column', alignItems: 'center', position: 'relative' }}>
                  {i < arr.length - 1 && (
                    <div style={{ position: 'absolute', top: 14, left: '50%', width: '100%', height: 2, background: done ? C.green : '#E2E8F0', zIndex: 0 }} />
                  )}
                  <div
                    onClick={editable ? () => handleToggleJalon(i) : undefined}
                    title={editable ? 'Basculer atteint / non atteint' : undefined}
                    style={{ width: 28, height: 28, borderRadius: '50%', background: done ? C.green : '#F1F5F9', border: `3px solid ${done ? C.green : '#CBD5E1'}`, display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1, flexShrink: 0, cursor: editable ? 'pointer' : 'default' }}
                  >
                    {done ? <span style={{ fontSize: 10, color: '#fff' }}>✓</span> : <span style={{ width: 8, height: 8, borderRadius: '50%', background: '#CBD5E1', display: 'block' }} />}
                  </div>
                  <div style={{ fontSize: 10, fontWeight: 600, color: done ? '#1E293B' : '#64748B', textAlign: 'center', marginTop: 6, lineHeight: 1.3, maxWidth: 90 }}>{j.label}</div>
                  <div style={{ fontSize: 9.5, color: done ? C.green : '#94A3B8', fontWeight: 700, marginTop: 2 }}>{dateFmt}</div>
                  {editable && (
                    <button onClick={() => handleDeleteJalon(i)} title="Supprimer le jalon" style={{ marginTop: 4, border: 'none', background: 'transparent', color: C.red, cursor: 'pointer', padding: 2 }}><X size={12} /></button>
                  )}
                </div>
                );
              })}
            </div>
            {editingSection === 'jalons' && (
              <div style={{ marginTop: 12, paddingTop: 10, borderTop: `1px solid ${C.border}`, display: 'flex', gap: 8, alignItems: 'flex-end', flexWrap: 'wrap' }}>
                <div style={{ flex: 1, minWidth: 160 }}>
                  <label style={{ fontSize: 10, fontWeight: 700, color: '#64748B' }}>Libellé du jalon</label>
                  <input value={jalonForm.label} onChange={(e) => setJalonForm(f => ({ ...f, label: e.target.value }))} placeholder="Ex. Réception provisoire Lot 2" style={{ width: '100%', marginTop: 3, fontSize: 12, padding: '5px 8px', borderRadius: 6, border: `1px solid ${C.border}`, fontFamily: 'inherit', outline: 'none' }} />
                </div>
                <div>
                  <label style={{ fontSize: 10, fontWeight: 700, color: '#64748B' }}>Date</label>
                  <input type="date" value={jalonForm.date} onChange={(e) => setJalonForm(f => ({ ...f, date: e.target.value }))} style={{ marginTop: 3, fontSize: 12, padding: '5px 8px', borderRadius: 6, border: `1px solid ${C.border}`, fontFamily: 'inherit', outline: 'none' }} />
                </div>
                <button onClick={handleAddJalon} disabled={!jalonForm.label || !jalonForm.date} style={{ padding: '6px 12px', fontSize: 11, borderRadius: 6, border: 'none', background: (!jalonForm.label || !jalonForm.date) ? '#CBD5E1' : C.navy, color: '#fff', cursor: (!jalonForm.label || !jalonForm.date) ? 'not-allowed' : 'pointer', fontWeight: 700, display: 'flex', alignItems: 'center', gap: 4 }}><Plus size={12} /> Ajouter</button>
              </div>
            )}
          </div>

          {/* ── KPIs Table ── */}
          <div style={{ background: '#fff', borderRadius: 10, border: editingSection === 'kpis' ? `1px solid ${C.orange}` : `1px solid ${C.border}`, padding: '16px 20px' }}>
            <div style={{ fontSize: 12, fontWeight: 700, color: C.navy, marginBottom: 14, display: 'flex', alignItems: 'center', gap: 6 }}>
              <span style={{ width: 4, height: 16, background: C.purple, borderRadius: 2, display: 'inline-block' }} />
              INDICATEURS DE PERFORMANCE (KPIs)
              <SectionEditBtn section="kpis" readOnly />
            </div>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 11 }}>
              <thead>
                <tr style={{ background: '#F8FAFC' }}>
                  {['Indicateur', 'Valeur cible', 'Valeur actuelle', 'Écart', 'Statut'].map(h => (
                    <th key={h} style={{ padding: '8px 10px', textAlign: 'left', fontWeight: 700, color: '#64748B', fontSize: 10, textTransform: 'uppercase', borderBottom: '2px solid #E2E8F0', letterSpacing: '.5px' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {[
                  { indicateur: 'Taux d\'avancement physique pondéré', cible: '100%', actuel: `${projet.avancement}%`, ecart: `${projet.avancement - 100}%`, rag: projet.avancement >= 80 ? 'vert' : projet.avancement >= 50 ? 'amber' : 'rouge' },
                  { indicateur: 'Taux de décaissement (budget)', cible: '100%', actuel: `${Math.round((projet.budgetDecaisse/(projet.budget||1))*100)}%`, ecart: `${Math.round((projet.budgetDecaisse/(projet.budget||1))*100) - 100}%`, rag: (projet.budgetDecaisse/(projet.budget||1)) >= 0.8 ? 'vert' : (projet.budgetDecaisse/(projet.budget||1)) >= 0.5 ? 'amber' : 'rouge' },
                  { indicateur: 'CPI (Cost Performance Index)', cible: '≥ 1.00', actuel: projet.cpi.toFixed(2), ecart: (projet.cpi - 1).toFixed(2), rag: projet.cpi >= 1 ? 'vert' : projet.cpi >= 0.9 ? 'amber' : 'rouge' },
                  { indicateur: 'SPI (Schedule Performance Index)', cible: '≥ 1.00', actuel: projet.spi.toFixed(2), ecart: (projet.spi - 1).toFixed(2), rag: projet.spi >= 1 ? 'vert' : projet.spi >= 0.85 ? 'amber' : 'rouge' },
                  { indicateur: 'Jalons atteints / Total', cible: `${projet.jalons.length}/${projet.jalons.length}`, actuel: `${projet.jalons.filter(j => j.atteint).length}/${projet.jalons.length}`, ecart: `${projet.jalons.filter(j => j.atteint).length - projet.jalons.length}`, rag: projet.jalons.filter(j => j.atteint).length === projet.jalons.length ? 'vert' : 'amber' },
                ].map((row, i) => {
                  const ragColor = row.rag === 'vert' ? C.green : row.rag === 'amber' ? C.amber : C.red;
                  return (
                    <tr key={i} style={{ borderBottom: '1px solid #F1F5F9', background: i % 2 === 0 ? '#fff' : '#FAFAFA' }}>
                      <td style={{ padding: '8px 10px', color: '#374151', fontWeight: 500 }}>{row.indicateur}</td>
                      <td style={{ padding: '8px 10px', color: '#64748B', fontFamily: 'monospace' }}>{row.cible}</td>
                      <td style={{ padding: '8px 10px', fontWeight: 700, color: '#1E293B', fontFamily: 'monospace' }}>{row.actuel}</td>
                      <td style={{ padding: '8px 10px', fontFamily: 'monospace', color: row.rag === 'vert' ? C.green : C.red, fontWeight: 600 }}>{row.ecart}</td>
                      <td style={{ padding: '8px 10px' }}>
                        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 10, fontWeight: 700, color: ragColor, background: `${ragColor}18`, padding: '2px 8px', borderRadius: 99 }}>
                          <span style={{ width: 7, height: 7, borderRadius: '50%', background: ragColor, display: 'inline-block' }} />
                          {row.rag === 'vert' ? 'Satisfaisant' : row.rag === 'amber' ? 'À surveiller' : 'Critique'}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* ── Livrables par phase ── */}
          <div style={{ background: '#fff', borderRadius: 10, border: editingSection === 'phases' ? `1px solid ${C.orange}` : `1px solid ${C.border}`, padding: '16px 20px' }}>
            <div style={{ fontSize: 12, fontWeight: 700, color: C.navy, marginBottom: 14, display: 'flex', alignItems: 'center', gap: 6 }}>
              <span style={{ width: 4, height: 16, background: C.amber, borderRadius: 2, display: 'inline-block' }} />
              LIVRABLES PAR PHASE
              <SectionEditBtn section="phases" readOnly />
            </div>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 11 }}>
              <thead>
                <tr style={{ background: `${C.navy}10` }}>
                  {['Phase', 'Poids (%)', 'Av. %', 'Statut', 'Documents attendus'].map(h => (
                    <th key={h} style={{ padding: '8px 10px', textAlign: 'left', fontWeight: 700, color: C.navy, fontSize: 10, textTransform: 'uppercase', borderBottom: `2px solid ${C.navy}30`, letterSpacing: '.5px' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {(projet.phases ?? PHASES_DEFAUT).map((ph, i) => {
                  const docs: Record<number, string> = {
                    0: 'Dossiers d\'appel d\'offres, contrats, ordres de service',
                    1: 'Études APS/APD, plans d\'exécution validés',
                    2: 'Bons de commande, PV de réception fournitures',
                    3: 'Rapports journaliers, attachements, PV de réunions',
                    4: 'PV de réception provisoire, essais & mise en service',
                    5: 'Décompte final, PV de réception définitive, quitus',
                  };
                  const sc = ph.avancement === 100 ? C.green : ph.avancement > 0 ? C.navy : '#94A3B8';
                  const sLabel = ph.avancement === 100 ? '✅ Terminé' : ph.avancement > 0 ? '🔄 En cours' : '⏳ À venir';
                  return (
                    <tr key={ph.id} style={{ borderBottom: '1px solid #F1F5F9', background: i % 2 === 0 ? '#fff' : '#FAFAFA' }}>
                      <td style={{ padding: '8px 10px', color: '#1E293B', fontWeight: 600 }}>{ph.label}</td>
                      <td style={{ padding: '8px 10px', textAlign: 'center', fontFamily: 'monospace', fontWeight: 700, color: C.navy }}>{ph.poids}%</td>
                      <td style={{ padding: '8px 10px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                          <div style={{ flex: 1, height: 6, borderRadius: 3, background: '#E5E7EB', overflow: 'hidden', maxWidth: 60 }}>
                            <div style={{ width: `${ph.avancement}%`, height: '100%', background: sc, borderRadius: 3 }} />
                          </div>
                          <span style={{ fontSize: 10, fontWeight: 700, color: sc }}>{ph.avancement}%</span>
                        </div>
                      </td>
                      <td style={{ padding: '8px 10px' }}>
                        <span style={{ fontSize: 10, fontWeight: 700, color: sc }}>{sLabel}</span>
                      </td>
                      <td style={{ padding: '8px 10px', fontSize: 10, color: '#64748B' }}>{docs[i] ?? '—'}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* ── Zones du projet + Risques principaux (2 colonnes) ── */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
            {/* Zones */}
            <div style={{ background: '#fff', borderRadius: 10, border: editingSection === 'zones' ? `1px solid ${C.orange}` : `1px solid ${C.border}`, padding: '16px 20px' }}>
              <div style={{ fontSize: 12, fontWeight: 700, color: C.navy, marginBottom: 12, display: 'flex', alignItems: 'center', gap: 6 }}>
                <span style={{ width: 4, height: 16, background: '#0EA5E9', borderRadius: 2, display: 'inline-block' }} />
                ZONES D&apos;INTERVENTION
                <SectionEditBtn section="zones" readOnly />
              </div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                {([projet.localisation, projet.region, 'Zone Nord', 'Zone Centre', 'Zone Sud'].filter(Boolean) as string[]).map((z, i) => (
                  <span key={i} style={{ fontSize: 11, padding: '4px 10px', borderRadius: 99, background: '#EFF6FF', color: C.navy, border: '1px solid #BFDBFE', fontWeight: 600, display: 'flex', alignItems: 'center', gap: 4 }}>
                    📍 {z}
                  </span>
                ))}
              </div>
            </div>
            {/* Top 3 risques */}
            <div style={{ background: '#fff', borderRadius: 10, border: editingSection === 'budget' ? `1px solid ${C.orange}` : `1px solid ${C.border}`, padding: '16px 20px' }}>
              <div style={{ fontSize: 12, fontWeight: 700, color: C.navy, marginBottom: 12, display: 'flex', alignItems: 'center', gap: 6 }}>
                <span style={{ width: 4, height: 16, background: C.red, borderRadius: 2, display: 'inline-block' }} />
                RISQUES PRINCIPAUX
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                {RISQUES.slice(0, 3).map(r => {
                  const c = criticiteColor(criticite(r.probabilite, r.impact));
                  return (
                    <div key={r.id} style={{ display: 'flex', gap: 8, padding: '7px 10px', borderRadius: 7, background: `${c}08`, border: `1px solid ${c}30` }}>
                      <div style={{ width: 24, height: 24, borderRadius: 6, background: `${c}18`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 9, fontWeight: 800, color: c, flexShrink: 0 }}>{r.probabilite * r.impact}</div>
                      <div style={{ flex: 1 }}>
                        <div style={{ fontSize: 11, fontWeight: 600, color: '#1E293B' }}>{r.intitule}</div>
                        <div style={{ fontSize: 10, color: '#64748B', marginTop: 1 }}>{r.action}</div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

          {/* ── Budget & Financement ── */}
          <div style={{ background: '#fff', borderRadius: 10, border: `1px solid ${C.border}`, padding: '16px 20px' }}>
            <div style={{ fontSize: 12, fontWeight: 700, color: C.navy, marginBottom: 14, display: 'flex', alignItems: 'center', gap: 6 }}>
              <span style={{ width: 4, height: 16, background: C.green, borderRadius: 2, display: 'inline-block' }} />
              BUDGET & PLAN DE FINANCEMENT
              <SectionEditBtn section="budget" readOnly />
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 12, marginBottom: 14 }}>
              {[
                { label: 'Coût total du projet', value: `${projet.budget.toLocaleString('fr-FR')} MFCFA`, color: C.navy, sub: 'Budget total approuvé' },
                { label: 'Financé par bailleur', value: `${Math.round(projet.budget*0.75).toLocaleString('fr-FR')} MFCFA`, color: C.purple, sub: `${(projet.bailleurs[0]?.nom ?? 'SENELEC')} — 75%` },
                { label: 'Contrepartie SENELEC', value: `${Math.round(projet.budget*0.25).toLocaleString('fr-FR')} MFCFA`, color: C.orange, sub: 'Fonds propres — 25%' },
              ].map(b => (
                <div key={b.label} style={{ padding: '12px 14px', borderRadius: 8, background: '#F8FAFC', border: '1px solid #E2E8F0' }}>
                  <div style={{ fontSize: 16, fontWeight: 800, color: b.color }}>{b.value}</div>
                  <div style={{ fontSize: 11, fontWeight: 600, color: '#374151', marginTop: 2 }}>{b.label}</div>
                  <div style={{ fontSize: 10, color: '#94A3B8', marginTop: 1 }}>{b.sub}</div>
                </div>
              ))}
            </div>
            {/* Barre exécution budget */}
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: '#64748B', marginBottom: 6 }}>
                <span>Taux d'exécution budgétaire</span>
                <span style={{ fontWeight: 700 }}>{Math.round((projet.budgetDecaisse/(projet.budget||1))*100)}% — {projet.budgetDecaisse.toLocaleString('fr-FR')} MFCFA décaissés</span>
              </div>
              <div style={{ height: 10, background: '#F1F5F9', borderRadius: 99, overflow: 'hidden' }}>
                <div style={{ height: '100%', width: `${(projet.budgetDecaisse/(projet.budget||1))*100}%`, background: `linear-gradient(90deg, ${C.navy}, ${C.orange})`, borderRadius: 99 }} />
              </div>
            </div>
          </div>

        </div>
      )}

      {/* ══ MODAL APERÇU DOCUMENT ════════════════════════════ */}
      {previewDoc && (
        <>
          <div onClick={() => setPreviewDoc(null)} style={{ position: 'fixed', inset: 0, zIndex: 200, background: 'rgba(0,0,0,0.60)', backdropFilter: 'blur(4px)' }} />
          <div style={{ position: 'fixed', top: '50%', left: '50%', transform: 'translate(-50%,-50%)', zIndex: 201, background: '#fff', borderRadius: 14, width: 520, boxShadow: '0 24px 64px rgba(0,0,0,0.28)' }}>
            <div style={{ background: C.navy, padding: '14px 18px', borderRadius: '14px 14px 0 0', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div style={{ fontSize: 14, fontWeight: 700, color: '#fff' }}>👁 Aperçu document</div>
              <button onClick={() => setPreviewDoc(null)} aria-label="Fermer l'aperçu du document" style={{ background: 'rgba(255,255,255,0.15)', border: 'none', borderRadius: 6, padding: 6, cursor: 'pointer', color: '#fff', display: 'flex' }}><X size={14} /></button>
            </div>
            <div style={{ padding: '20px 22px', display: 'flex', flexDirection: 'column', gap: 12 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
                <div style={{ width: 52, height: 52, borderRadius: 10, background: '#EFF6FF', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <span style={{ fontSize: 11, fontWeight: 800, color: C.navy, textTransform: 'uppercase' }}>{previewDoc.ext}</span>
                </div>
                <div>
                  <div style={{ fontSize: 15, fontWeight: 700, color: '#1E293B' }}>{previewDoc.nom}</div>
                  <div style={{ fontSize: 11, color: '#94A3B8', marginTop: 3 }}>{previewDoc.type} · {previewDoc.taille} · {new Date(previewDoc.date).toLocaleDateString('fr-FR')}</div>
                </div>
              </div>
              {[
                ['Auteur / Dépositaire', previewDoc.auteur],
                ['Type', previewDoc.type],
                ['Statut', previewDoc.statut],
                ['Date dépôt', new Date(previewDoc.date).toLocaleDateString('fr-FR', { day: '2-digit', month: 'long', year: 'numeric' })],
                ['Taille fichier', previewDoc.taille],
              ].map(([k, v]) => (
                <div key={k} style={{ display: 'flex', justifyContent: 'space-between', padding: '7px 0', borderBottom: '1px solid #F1F5F9', fontSize: 13 }}>
                  <span style={{ color: '#94A3B8' }}>{k}</span>
                  <span style={{ fontWeight: 600, color: '#1E293B' }}>{v}</span>
                </div>
              ))}
            </div>
            <div style={{ padding: '14px 22px', borderTop: '1px solid #E5E7EB', display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
              <button onClick={() => setPreviewDoc(null)} style={{ padding: '8px 16px', fontSize: 12, fontWeight: 600, borderRadius: 7, border: '1px solid #D1D5DB', background: '#fff', color: '#374151', cursor: 'pointer' }}>Fermer</button>
              <button onClick={() => { alert(`Téléchargement de "${previewDoc.nom}" démarré`); setPreviewDoc(null); }} style={{ padding: '8px 18px', fontSize: 12, fontWeight: 700, borderRadius: 7, border: 'none', background: C.navy, color: '#fff', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6 }}>
                <Download size={13} /> Télécharger
              </button>
            </div>
          </div>
        </>
      )}

      {/* ══ MODAL ZONE ════════════════════════════════════ */}
      {showZoneModal && (
        <>
          <div onClick={() => setShowZoneModal(false)} style={{ position: 'fixed', inset: 0, zIndex: 300, background: 'rgba(0,0,0,0.55)', backdropFilter: 'blur(3px)' }} />
          <div style={{ position: 'fixed', top: '50%', left: '50%', transform: 'translate(-50%,-50%)', zIndex: 301, background: '#fff', borderRadius: 14, width: 620, boxShadow: '0 24px 64px rgba(0,0,0,0.28)', overflow: 'hidden' }}>
            <div style={{ background: C.navy, padding: '14px 18px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div style={{ fontSize: 14, fontWeight: 700, color: '#fff' }}>📍 {editZoneId ? 'Modifier la zone' : 'Ajouter une zone'}</div>
              <button onClick={() => setShowZoneModal(false)} aria-label="Fermer la fenêtre de zone" style={{ background: 'rgba(255,255,255,0.15)', border: 'none', borderRadius: 6, padding: 6, cursor: 'pointer', color: '#fff', display: 'flex' }}><X size={14} /></button>
            </div>
            <div style={{ padding: '20px 22px', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14, maxHeight: '70vh', overflowY: 'auto' }}>
              {([
                { label: 'Code zone *', key: 'code', type: 'text', placeholder: 'Z07' },
                { label: 'Localité *', key: 'localite', type: 'text', placeholder: 'Nom du village' },
                { label: 'Commune', key: 'commune', type: 'text', placeholder: 'Commune' },
                { label: 'Département', key: 'departement', type: 'text', placeholder: 'Département' },
              ] as const).map(f => (
                <div key={f.key}>
                  <label style={{ fontSize: 11, fontWeight: 600, color: '#374151', display: 'block', marginBottom: 4 }}>{f.label}</label>
                  <input value={String(zoneForm[f.key])} onChange={e => setZoneForm(prev => ({ ...prev, [f.key]: e.target.value }))}
                    placeholder={f.placeholder} style={{ width: '100%', boxSizing: 'border-box', padding: '7px 10px', borderRadius: 6, border: '1px solid #D1D5DB', fontSize: 12, fontFamily: 'inherit' }} />
                </div>
              ))}
              <div>
                <label style={{ fontSize: 11, fontWeight: 600, color: '#374151', display: 'block', marginBottom: 4 }}>Lot</label>
                <select value={zoneForm.lot} onChange={e => setZoneForm(prev => ({ ...prev, lot: e.target.value }))}
                  style={{ width: '100%', boxSizing: 'border-box', padding: '7px 10px', borderRadius: 6, border: '1px solid #D1D5DB', fontSize: 12, fontFamily: 'inherit' }}>
                  {['Lot 1', 'Lot 2', 'Lot 3', 'Lot 4', 'Lot 5'].map(l => <option key={l}>{l}</option>)}
                </select>
              </div>
              <div>
                <label style={{ fontSize: 11, fontWeight: 600, color: '#374151', display: 'block', marginBottom: 4 }}>Statut</label>
                <select value={zoneForm.statut} onChange={e => setZoneForm(prev => ({ ...prev, statut: e.target.value as StatutZone }))}
                  style={{ width: '100%', boxSizing: 'border-box', padding: '7px 10px', borderRadius: 6, border: '1px solid #D1D5DB', fontSize: 12, fontFamily: 'inherit' }}>
                  {(Object.entries(STATUT_ZONE_CFG) as [StatutZone, { label: string }][]).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
                </select>
              </div>
              {([
                { label: 'Ménages prévus', key: 'menagesPrevus' },
                { label: 'Ménages réalisés', key: 'menagesRealises' },
                { label: 'HTA prévus (km)', key: 'kmHtaPrevus' },
                { label: 'HTA réalisés (km)', key: 'kmHtaRealises' },
                { label: 'BT prévus (km)', key: 'kmBtPrevus' },
                { label: 'BT réalisés (km)', key: 'kmBtRealises' },
              ] as const).map(f => (
                <div key={f.key}>
                  <label style={{ fontSize: 11, fontWeight: 600, color: '#374151', display: 'block', marginBottom: 4 }}>{f.label}</label>
                  <input type="number" min={0} step={f.key.includes('km') || f.key.includes('Km') ? 0.1 : 1}
                    value={zoneForm[f.key]} onChange={e => setZoneForm(prev => ({ ...prev, [f.key]: Number(e.target.value) }))}
                    style={{ width: '100%', boxSizing: 'border-box', padding: '7px 10px', borderRadius: 6, border: '1px solid #D1D5DB', fontSize: 12, fontFamily: 'inherit' }} />
                </div>
              ))}
              <div style={{ gridColumn: '1 / -1' }}>
                <label style={{ fontSize: 11, fontWeight: 600, color: '#374151', display: 'block', marginBottom: 4 }}>Observations</label>
                <textarea rows={2} value={zoneForm.observation} onChange={e => setZoneForm(prev => ({ ...prev, observation: e.target.value }))}
                  placeholder="Notes, contraintes, avancement..." style={{ width: '100%', boxSizing: 'border-box', padding: '7px 10px', borderRadius: 6, border: '1px solid #D1D5DB', fontSize: 12, fontFamily: 'inherit', resize: 'vertical' }} />
              </div>
            </div>
            <div style={{ padding: '14px 22px', borderTop: '1px solid #E5E7EB', display: 'flex', gap: 8, justifyContent: 'space-between', alignItems: 'center' }}>
              {editZoneId && (
                <button onClick={() => { setZones(prev => prev.filter(z => z.id !== editZoneId)); setShowZoneModal(false); }}
                  style={{ padding: '7px 14px', fontSize: 11, fontWeight: 600, borderRadius: 6, border: '1px solid #EF3340', background: '#FEE2E2', color: '#EF3340', cursor: 'pointer' }}>
                  Supprimer
                </button>
              )}
              <div style={{ marginLeft: 'auto', display: 'flex', gap: 8 }}>
                <button onClick={() => setShowZoneModal(false)} style={{ padding: '7px 16px', fontSize: 12, fontWeight: 600, borderRadius: 7, border: '1px solid #D1D5DB', background: '#fff', color: '#374151', cursor: 'pointer' }}>Annuler</button>
                <button onClick={() => {
                  if (!zoneForm.code.trim() || !zoneForm.localite.trim()) { alert('Code et localité requis.'); return; }
                  if (editZoneId) {
                    setZones(prev => prev.map(z => z.id === editZoneId ? { ...zoneForm, id: editZoneId } : z));
                  } else {
                    setZones(prev => [...prev, { ...zoneForm, id: `z_${Date.now()}` }]);
                  }
                  setShowZoneModal(false);
                }} style={{ padding: '7px 18px', fontSize: 12, fontWeight: 700, borderRadius: 7, border: 'none', background: C.navy, color: '#fff', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6 }}>
                  <Check size={12} /> {editZoneId ? 'Mettre à jour' : 'Ajouter'}
                </button>
              </div>
            </div>
          </div>
        </>
      )}


    </div>
  );
}

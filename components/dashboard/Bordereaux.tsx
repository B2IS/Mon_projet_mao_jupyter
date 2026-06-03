'use client';

import React, { useState, useMemo, useRef } from 'react';
import {
  BookOpen, Plus, Search, Filter, Download,
  ChevronRight, Pencil, Trash2, Copy, Tag,
  CheckSquare, Users, AlertTriangle, FileText, X,
  History, Paperclip, Eye, Receipt, ClipboardCheck, TrendingUp,
} from 'lucide-react';
import { downloadExcel } from '@/lib/exportUtils';
import { useProjectStore, DOMAINE_CFG, type Domaine } from '@/lib/projectStore';
import { useAttachements, montantAttachement, type Attachement } from '@/lib/attachementStore';
import { useAuth } from '@/lib/authStore';
import toast from 'react-hot-toast';
import EditableTable, { type EditableColumn, type EditableRow } from '@/components/ui/EditableTable';
import DocumentAnnotator, { type AnnotatedDoc } from '@/components/ui/DocumentAnnotator';

/* ─── Versioning, décomptes & contrôle factures (PMI Cost Control / Earned Value) ── */
type DecompteStatut = 'brouillon' | 'soumis' | 'certifie' | 'paye';
interface PieceDecompte { nom: string; ext: string; taille?: string; url?: string }
interface Decompte {
  id: string;
  numero: number;            // N° du décompte (situation intérimaire)
  periode: string;           // période couverte
  date: string;
  montantHT: number;         // montant travaux de la période (FCFA)
  avancementCumule: number;  // % avancement physique cumulé
  retenueGarantiePct: number;// retenue de garantie (%)
  factureRef: string;        // facture rattachée pour contrôle
  statut: DecompteStatut;
  attachement?: PieceDecompte; // attachement / certificat de paiement
}
interface BordereauVersion {
  version: string;
  date: string;
  auteur: string;
  note: string;
}
const DECOMPTE_CFG: Record<DecompteStatut, { label: string; color: string; bg: string }> = {
  brouillon: { label: 'Brouillon',  color: '#64748B', bg: '#F1F5F9' },
  soumis:    { label: 'Soumis',     color: '#1B4F8A', bg: '#EFF6FF' },
  certifie:  { label: 'Certifié',   color: '#D97706', bg: '#FFF7ED' },
  paye:      { label: 'Payé',       color: '#16A34A', bg: '#DCFCE7' },
};
const VERSIONS_DEMO: Record<string, BordereauVersion[]> = {
  b1: [
    { version: 'v3.2', date: '2026-04-15', auteur: 'A. NDIAYE', note: 'Révision quantités HTA Nord après métré contradictoire' },
    { version: 'v3.1', date: '2026-03-02', auteur: 'A. NDIAYE', note: 'Ajout poste sectionnement HTA' },
    { version: 'v3.0', date: '2026-01-20', auteur: 'PMO',        note: 'Version contractuelle — marché notifié' },
    { version: 'v2.0', date: '2025-11-10', auteur: 'TRACTEBEL',  note: 'APD validé' },
  ],
  b2: [
    { version: 'v1.0', date: '2026-05-10', auteur: 'O. DIOP', note: 'Bordereau initial BT Sud' },
  ],
};
const DECOMPTES_DEMO: Record<string, Decompte[]> = {
  b1: [
    { id: 'd1', numero: 1, periode: 'Janv. 2026', date: '2026-02-05', montantHT: 39_200_000, avancementCumule: 18, retenueGarantiePct: 5, factureRef: 'FAC-2026-014', statut: 'paye',     attachement: { nom: 'Decompte_N1_HTA-Nord.pdf', ext: 'pdf', taille: '1.2 Mo' } },
    { id: 'd2', numero: 2, periode: 'Févr.–Mars 2026', date: '2026-04-08', montantHT: 63_200_000, avancementCumule: 47, retenueGarantiePct: 5, factureRef: 'FAC-2026-041', statut: 'certifie', attachement: { nom: 'Decompte_N2_HTA-Nord.pdf', ext: 'pdf', taille: '1.6 Mo' } },
    { id: 'd3', numero: 3, periode: 'Avr.–Mai 2026', date: '2026-05-22', montantHT: 37_100_000, avancementCumule: 64, retenueGarantiePct: 5, factureRef: 'FAC-2026-067', statut: 'soumis',   attachement: { nom: 'Attachement_N3.xlsx', ext: 'xlsx', taille: '420 Ko' } },
  ],
  b2: [],
};

/* ─── Brand ─────────────────────────────── */
const NAVY   = '#1B4F8A';
const ORANGE = '#F47920';
const RED    = '#EF3340';
const GREEN  = '#16A34A';
const AMBER  = '#D97706';
const PURPLE = '#8B5CF6';

/* ─── Types ─────────────────────────────── */
interface Article {
  id: string;
  code: string;
  designation: string;
  unite: string;
  pu: number;
  categorie: string;
}

interface LigneBordereau {
  id: string;
  articleId: string;
  quantite: number;
  lot: string;
}

interface Bordereau {
  id: string;
  projetId: string;
  version: string;
  articles: LigneBordereau[];
  dateCreation: string;
  statut: 'brouillon' | 'valide' | 'approuve';
}

interface MatriceRACI {
  id: string;
  projetId: string;
  version: string;
  date: string;
  acteurs: string[];
}

/* ─── Données démo ──────────────────────── */
const ARTICLES: Article[] = [
  { id: 'a1',  code: 'BTP-001', designation: 'Fourniture poteau béton 10m', unite: 'u',   pu: 245000, categorie: 'Structure' },
  { id: 'a2',  code: 'BTP-002', designation: 'Pose et scellement poteau',   unite: 'u',   pu: 92000,  categorie: 'Main d\'œuvre' },
  { id: 'a3',  code: 'CAB-001', designation: 'Câble torsadé BT 4×50mm²',   unite: 'm',   pu: 4800,   categorie: 'Câblage' },
  { id: 'a4',  code: 'CAB-002', designation: 'Câble HTA 12/20kV 150mm²',   unite: 'm',   pu: 18500,  categorie: 'Câblage' },
  { id: 'a5',  code: 'TRF-001', designation: 'Transformateur 160kVA',       unite: 'u',   pu: 8500000, categorie: 'Équipement' },
  { id: 'a6',  code: 'TRF-002', designation: 'Transformateur 400kVA',       unite: 'u',   pu: 15200000,categorie: 'Équipement' },
  { id: 'a7',  code: 'SEC-001', designation: 'Coffret de sectionnement HTA',unite: 'u',   pu: 1200000, categorie: 'Protection' },
  { id: 'a8',  code: 'CON-001', designation: 'Connecteur perforant',        unite: 'u',   pu: 12500,  categorie: 'Accessoires' },
  { id: 'a9',  code: 'ISO-001', designation: 'Isolateur composite HTA',     unite: 'u',   pu: 35000,  categorie: 'Accessoires' },
  { id: 'a10', code: 'MAT-001', designation: 'Matériel de mise à la terre', unite: 'ens', pu: 85000,  categorie: 'Sécurité' },
];

const BORDEREAUX_DEMO: Bordereau[] = [
  {
    id: 'b1', projetId: '', version: 'v3.2', dateCreation: '2026-04-15',
    statut: 'approuve',
    articles: [
      { id: 'l1', articleId: 'a1', quantite: 180, lot: 'HTA Nord' },
      { id: 'l2', articleId: 'a2', quantite: 180, lot: 'HTA Nord' },
      { id: 'l3', articleId: 'a4', quantite: 8500, lot: 'HTA Nord' },
    ],
  },
  {
    id: 'b2', projetId: '', version: 'v1.0', dateCreation: '2026-05-10',
    statut: 'brouillon',
    articles: [
      { id: 'l4', articleId: 'a3', quantite: 12500, lot: 'BT Sud' },
      { id: 'l5', articleId: 'a1', quantite: 45, lot: 'BT Sud' },
    ],
  },
];

const CATEGORIES = ['Tous', 'Structure', 'Câblage', 'Équipement', 'Protection', 'Accessoires', 'Sécurité', "Main d'œuvre"];

const MATRICES_DEMO: MatriceRACI[] = [
  { id: 'm1', projetId: '', version: '3', date: '2026-04-20', acteurs: ['CP', 'PMO', 'Finance', 'DG', 'Ingénieur'] },
  { id: 'm2', projetId: '', version: '2', date: '2026-05-08', acteurs: ['CP', 'UAGL', 'Contrôle interne'] },
];

const STATUT_CFG: Record<Bordereau['statut'], { label: string; color: string; bg: string }> = {
  brouillon: { label: 'Brouillon', color: '#64748B', bg: '#F1F5F9' },
  valide:    { label: 'Validé',    color: NAVY,      bg: '#EFF6FF' },
  approuve:  { label: 'Approuvé', color: GREEN,     bg: '#DCFCE7' },
};

/* ─── Helper ─────────────────────────────── */
function fmtFCFA(n: number): string {
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(2) + ' M';
  return n.toLocaleString('fr-FR');
}

const inlineInput: React.CSSProperties = {
  width: '100%', boxSizing: 'border-box', padding: '5px 7px', fontSize: 11.5,
  border: '1px solid #E2E8F0', borderRadius: 5, background: '#fff', outline: 'none', fontFamily: 'inherit',
};

/* ═══════════════════════════════════════════════════
   COMPOSANT PRINCIPAL
═══════════════════════════════════════════════════ */
export default function Bordereaux() {
  const store = useProjectStore();
  const [activeTab, setActiveTab] = useState<'bordereaux' | 'decomptes' | 'attachements' | 'bibliotheque' | 'matrices'>('bordereaux');
  const [decomptes, setDecomptes] = useState<Decompte[]>(DECOMPTES_DEMO['b1']);
  const [viewDoc, setViewDoc] = useState<AnnotatedDoc | null>(null);
  const [matriceView, setMatriceView] = useState<null | 'raci' | 'livrables' | 'risques'>(null);
  const decompteFileRef = useRef<HTMLInputElement | null>(null);
  const [pendingDecompteId, setPendingDecompteId] = useState<string | null>(null);
  const [searchQ, setSearchQ] = useState('');
  const [catFiltre, setCatFiltre] = useState('Tous');
  const [selectedBordereau, setSelectedBordereau] = useState<string | null>('b1');
  const [editBoQ, setEditBoQ] = useState(false);

  /* Colonnes BoQ par défaut — l'utilisateur peut en ajouter/renommer/supprimer */
  const boqColumns: EditableColumn[] = useMemo(() => ([
    { id: 'code',        label: 'Code',          type: 'text',   width: 90 },
    { id: 'designation', label: 'Désignation',   type: 'text' },
    { id: 'categorie',   label: 'Catégorie',     type: 'select', width: 130, options: ['Structure', 'Main d\'œuvre', 'Câblage', 'Équipement', 'Protection', 'Accessoires', 'Sécurité'] },
    { id: 'lot',         label: 'Lot',           type: 'text',   width: 110 },
    { id: 'unite',       label: 'Unité',         type: 'text',   width: 70, align: 'center' },
    { id: 'quantite',    label: 'Qté',           type: 'number', width: 90, align: 'right', total: true },
    { id: 'pu',          label: 'PU (FCFA)',     type: 'number', width: 110, align: 'right' },
    { id: 'total',       label: 'Total (FCFA)',  type: 'computed', width: 130, align: 'right', total: true, compute: (r) => Number(r.quantite || 0) * Number(r.pu || 0) },
  ]), []);

  const boqRows: EditableRow[] = useMemo(() => {
    const b = BORDEREAUX_DEMO.find(x => x.id === selectedBordereau);
    if (!b) return [];
    return b.articles.map(l => {
      const art = ARTICLES.find(a => a.id === l.articleId);
      return {
        id: l.id,
        code: art?.code ?? '',
        designation: art?.designation ?? '',
        categorie: art?.categorie ?? '',
        lot: l.lot,
        unite: art?.unite ?? '',
        quantite: l.quantite,
        pu: art?.pu ?? 0,
      } as EditableRow;
    });
  }, [selectedBordereau]);

  /* Articles filtrés */
  const articlesFiltres = useMemo(() => {
    return ARTICLES.filter(a => {
      const matchCat = catFiltre === 'Tous' || a.categorie === catFiltre;
      const matchQ   = !searchQ || a.designation.toLowerCase().includes(searchQ.toLowerCase()) || a.code.toLowerCase().includes(searchQ.toLowerCase());
      return matchCat && matchQ;
    });
  }, [searchQ, catFiltre]);

  const bSelected = BORDEREAUX_DEMO.find(b => b.id === selectedBordereau);

  /* Total bordereau sélectionné */
  const totalBordereau = useMemo(() => {
    if (!bSelected) return 0;
    return bSelected.articles.reduce((sum, l) => {
      const art = ARTICLES.find(a => a.id === l.articleId);
      return sum + (art ? art.pu * l.quantite : 0);
    }, 0);
  }, [bSelected]);

  /* ── Décomptes : montant de référence (BoQ b1) & exécution cumulée ── */
  const montantMarche = useMemo(() => {
    const b = BORDEREAUX_DEMO.find(x => x.id === 'b1');
    if (!b) return 0;
    return b.articles.reduce((s, l) => { const a = ARTICLES.find(x => x.id === l.articleId); return s + (a ? a.pu * l.quantite : 0); }, 0);
  }, []);
  const cumulDecomptes = decomptes.reduce((s, d) => s + d.montantHT, 0);
  const dernierAvancement = decomptes.length ? Math.max(...decomptes.map(d => d.avancementCumule)) : 0;
  const montantPaye = decomptes.filter(d => d.statut === 'paye').reduce((s, d) => s + d.montantHT, 0);
  const ecartBudget = montantMarche - cumulDecomptes;
  const tauxExecution = montantMarche > 0 ? (cumulDecomptes / montantMarche) * 100 : 0;

  /* Situation des biens et services — contractuel vs exécuté par ligne BoQ */
  const situationLignes = useMemo(() => {
    const b = BORDEREAUX_DEMO.find(x => x.id === 'b1');
    if (!b) return [] as { code: string; designation: string; unite: string; qteContr: number; qteExec: number; puUnit: number; montantContr: number; montantExec: number }[];
    return b.articles.map(l => {
      const a = ARTICLES.find(x => x.id === l.articleId);
      const pu = a?.pu ?? 0;
      const qteExec = Math.round(l.quantite * (dernierAvancement / 100));
      return {
        code: a?.code ?? '', designation: a?.designation ?? '', unite: a?.unite ?? '',
        qteContr: l.quantite, qteExec, puUnit: pu,
        montantContr: pu * l.quantite, montantExec: pu * qteExec,
      };
    });
  }, [dernierAvancement]);

  const ajouterDecompte = () => {
    const numero = decomptes.length + 1;
    const id = `d${Date.now()}`;
    setDecomptes(prev => [...prev, {
      id, numero, periode: `Période ${numero}`, date: new Date().toISOString().slice(0, 10),
      montantHT: 0, avancementCumule: dernierAvancement, retenueGarantiePct: 5,
      factureRef: '', statut: 'brouillon',
    }]);
  };
  const updateDecompte = (id: string, patch: Partial<Decompte>) =>
    setDecomptes(prev => prev.map(d => d.id === id ? { ...d, ...patch } : d));
  const supprimerDecompte = (id: string) => setDecomptes(prev => prev.filter(d => d.id !== id));
  const handleDecompteFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (!f || !pendingDecompteId) { return; }
    const ext = (f.name.split('.').pop() ?? 'pdf').toLowerCase();
    const sizeKb = f.size / 1024;
    const taille = sizeKb > 1024 ? `${(sizeKb / 1024).toFixed(1)} Mo` : `${Math.round(sizeKb)} Ko`;
    const decompteId = pendingDecompteId;
    const apply = (url: string) => {
      updateDecompte(decompteId, { attachement: { nom: f.name, ext, taille, url } });
      // Ouvre directement le document téléversé dans l'annotateur pour visualisation immédiate.
      setViewDoc({ nom: f.name, ext, taille, url });
    };
    // DATA URL (base64) : affichage fiable dans l'annotateur + persistance au rechargement
    // (un blob URL meurt à la fermeture de la page → le document ne s'affiche plus).
    const reader = new FileReader();
    reader.onload = () => apply(typeof reader.result === 'string' ? reader.result : URL.createObjectURL(f));
    reader.onerror = () => apply(URL.createObjectURL(f));
    reader.readAsDataURL(f);
    setPendingDecompteId(null);
    e.target.value = '';
  };
  const exportBordereauCSV = () => {
    const b = bSelected ?? BORDEREAUX_DEMO[0];
    downloadExcel(`bordereau_${b.version}`, {
      sheetName: 'Bordereau',
      title: `Bordereau des prix — ${b.version}`,
      subtitle: 'SENELEC · Direction Principale Équipement',
      headers: ['Code', 'Désignation', 'Catégorie', 'Lot', 'Unité', 'Quantité', 'PU (FCFA)', 'Total (FCFA)'],
      rows: b.articles.map(l => {
        const a = ARTICLES.find(x => x.id === l.articleId);
        return [a?.code ?? '', a?.designation ?? '', a?.categorie ?? '', l.lot, a?.unite ?? '', l.quantite, a?.pu ?? 0, (a?.pu ?? 0) * l.quantite];
      }),
    });
  };
  const exportSituationCSV = () => {
    downloadExcel('situation_biens_services', {
      sheetName: 'Situation',
      title: 'Situation des biens & services',
      subtitle: 'SENELEC · Direction Principale Équipement',
      headers: ['Code', 'Désignation', 'Unité', 'Qté contractuelle', 'Qté exécutée', 'PU', 'Montant contractuel', 'Montant exécuté', 'Écart', '% réalisation'],
      rows: situationLignes.map(s => [
        s.code, s.designation, s.unite, s.qteContr, s.qteExec, s.puUnit, s.montantContr, s.montantExec,
        s.montantContr - s.montantExec, s.montantContr > 0 ? +((s.montantExec / s.montantContr) * 100).toFixed(1) : 0,
      ]),
    });
  };

  const TABS = [
    { id: 'bordereaux',   label: 'Bordereaux des prix' },
    { id: 'decomptes',    label: 'Décomptes & Situation' },
    { id: 'attachements', label: 'Attachements de paiement (BOQ réalisé)' },
    { id: 'bibliotheque', label: 'Bibliothèque d\'articles' },
    { id: 'matrices',     label: 'Matrices de projet' },
  ];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', background: '#F8FAFD' }}>

      {/* ─── Header ───────────────────────────────────────────── */}
      <div style={{
        padding: '16px 24px 0',
        background: '#fff', borderBottom: '1px solid #E2E8F0', flexShrink: 0,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
          <div>
            <h1 style={{ fontSize: 20, fontWeight: 800, color: '#0F172A', margin: 0, display: 'flex', alignItems: 'center', gap: 10 }}>
              <BookOpen size={22} style={{ color: NAVY }} /> Bordereaux & Matrices de projet
            </h1>
            <p style={{ fontSize: 12.5, color: '#64748B', margin: '3px 0 0' }}>
              Bibliothèque d&apos;articles · Devis quantitatifs · Matrices RACI · Gabarits réutilisables
            </p>
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <button onClick={exportBordereauCSV} style={{
              display: 'flex', alignItems: 'center', gap: 6,
              padding: '7px 12px', borderRadius: 7, border: '1px solid #E2E8F0',
              background: '#fff', fontSize: 12.5, color: '#475569', cursor: 'pointer', fontFamily: 'inherit',
            }}>
              <Download size={13} /> Exporter Excel
            </button>
            <button onClick={() => { setActiveTab('bordereaux'); setEditBoQ(true); }} style={{
              display: 'flex', alignItems: 'center', gap: 6,
              padding: '7px 14px', borderRadius: 7, border: 'none',
              background: NAVY, color: '#fff', fontSize: 12.5, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit',
            }}>
              <Plus size={13} /> Nouveau bordereau
            </button>
          </div>
        </div>
        {/* Onglets */}
        <div style={{ display: 'flex' }}>
          {TABS.map(t => (
            <button key={t.id} onClick={() => setActiveTab(t.id as typeof activeTab)} style={{
              padding: '8px 16px', border: 'none',
              borderBottom: activeTab === t.id ? `2px solid ${ORANGE}` : '2px solid transparent',
              background: 'transparent', fontSize: 13,
              fontWeight: activeTab === t.id ? 700 : 400,
              color: activeTab === t.id ? ORANGE : '#64748B',
              cursor: 'pointer', fontFamily: 'inherit', marginBottom: -1,
            }}>{t.label}</button>
          ))}
        </div>
      </div>

      <div style={{ flex: 1, overflowY: 'auto', padding: '20px 24px' }}>

        {/* ════════ TAB: Bordereaux ════════ */}
        {activeTab === 'bordereaux' && (
          <div style={{ display: 'grid', gridTemplateColumns: '280px 1fr', gap: 16, height: '100%' }}>

            {/* Liste bordereaux */}
            <div style={{
              background: '#fff', borderRadius: 10, border: '1px solid #E2E8F0',
              boxShadow: '0 1px 4px rgba(0,0,0,0.05)', overflow: 'hidden', display: 'flex', flexDirection: 'column',
            }}>
              <div style={{ padding: '10px 12px', borderBottom: '1px solid #F1F5F9', fontSize: 13, fontWeight: 700, color: '#0F172A' }}>
                Bordereaux ({BORDEREAUX_DEMO.length})
              </div>
              {BORDEREAUX_DEMO.map(b => {
                const scfg = STATUT_CFG[b.statut];
                const total = b.articles.reduce((s, l) => {
                  const art = ARTICLES.find(a => a.id === l.articleId);
                  return s + (art ? art.pu * l.quantite : 0);
                }, 0);
                return (
                  <div key={b.id}
                    onClick={() => setSelectedBordereau(b.id)}
                    style={{
                      padding: '12px', borderBottom: '1px solid #F1F5F9', cursor: 'pointer',
                      background: selectedBordereau === b.id ? '#EFF6FF' : '#fff',
                      borderLeft: selectedBordereau === b.id ? `3px solid ${NAVY}` : '3px solid transparent',
                      transition: 'background 0.1s',
                    }}
                  >
                    <div style={{ fontSize: 12.5, fontWeight: 700, color: '#1E293B', marginBottom: 4 }}>
                      Bordereau {b.version}
                    </div>
                    <div style={{ fontSize: 11, color: '#94A3B8', marginBottom: 6 }}>
                      Créé le {b.dateCreation} · {b.articles.length} lignes
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                      <span style={{
                        fontSize: 10.5, fontWeight: 700, padding: '1px 6px', borderRadius: 8,
                        background: scfg.bg, color: scfg.color,
                      }}>{scfg.label}</span>
                      <span style={{ fontSize: 11, fontWeight: 700, color: '#1E293B' }}>
                        {fmtFCFA(total)} FCFA
                      </span>
                    </div>
                  </div>
                );
              })}
              <div style={{ padding: '10px 12px' }}>
                <button onClick={() => setEditBoQ(true)} style={{
                  width: '100%', padding: '7px', borderRadius: 7,
                  border: `1px dashed ${NAVY}`, background: '#F8FAFF',
                  color: NAVY, fontSize: 12, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit',
                  display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 5,
                }}>
                  <Plus size={12} /> Nouveau bordereau
                </button>
              </div>
            </div>

            {/* Détail bordereau */}
            <div style={{
              background: '#fff', borderRadius: 10, border: '1px solid #E2E8F0',
              boxShadow: '0 1px 4px rgba(0,0,0,0.05)', overflow: 'hidden', display: 'flex', flexDirection: 'column',
            }}>
              {bSelected ? (
                <>
                  <div style={{
                    padding: '12px 16px', borderBottom: '1px solid #F1F5F9',
                    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                  }}>
                    <div>
                      <div style={{ fontSize: 14, fontWeight: 700, color: '#0F172A' }}>
                        Bordereau {bSelected.version}
                        <span style={{
                          marginLeft: 8, fontSize: 10.5, fontWeight: 700,
                          padding: '2px 8px', borderRadius: 8,
                          background: STATUT_CFG[bSelected.statut].bg,
                          color: STATUT_CFG[bSelected.statut].color,
                        }}>
                          {STATUT_CFG[bSelected.statut].label}
                        </span>
                      </div>
                      <div style={{ fontSize: 11.5, color: '#94A3B8', marginTop: 2 }}>
                        {bSelected.articles.length} lignes · Créé le {bSelected.dateCreation}
                      </div>
                    </div>
                    <div style={{ display: 'flex', gap: 8 }}>
                      <button style={{ padding: '6px 12px', borderRadius: 6, border: '1px solid #E2E8F0', background: '#fff', fontSize: 12, cursor: 'pointer', fontFamily: 'inherit', display: 'flex', alignItems: 'center', gap: 5 }}>
                        <Copy size={12} /> Dupliquer
                      </button>
                      <button onClick={() => setEditBoQ(v => !v)} style={{ padding: '6px 12px', borderRadius: 6, border: 'none', background: editBoQ ? GREEN : NAVY, color: '#fff', fontSize: 12, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit', display: 'flex', alignItems: 'center', gap: 5 }}>
                        {editBoQ ? <><CheckSquare size={12} /> Terminer l&apos;édition</> : <><Pencil size={12} /> Modifier / Personnaliser</>}
                      </button>
                    </div>
                  </div>

                  {editBoQ ? (
                    <div style={{ flex: 1, overflowY: 'auto', padding: 16 }}>
                      <div style={{ fontSize: 11.5, color: '#64748B', marginBottom: 10, padding: '8px 12px', background: '#FFF7ED', borderRadius: 8, border: `1px solid ${ORANGE}40` }}>
                        💡 Mode personnalisation : cliquez sur l&apos;icône ⚙ d&apos;une colonne pour la renommer, changer son type ou la supprimer. Utilisez « + Colonne » pour adapter le bordereau à vos besoins (ex : délai, fournisseur, n° de lot…).
                      </div>
                      <EditableTable
                        title={`Bordereau ${bSelected.version}`}
                        initialColumns={boqColumns}
                        initialRows={boqRows}
                        addRowLabel="Ajouter un article"
                      />
                    </div>
                  ) : (<>
                  {/* En-têtes colonnes */}
                  <div style={{
                    display: 'grid', gridTemplateColumns: '80px 1fr 80px 80px 80px 110px',
                    padding: '7px 16px', background: '#F8FAFC',
                    borderBottom: '1px solid #F1F5F9',
                    fontSize: 10.5, fontWeight: 700, color: '#94A3B8',
                    textTransform: 'uppercase', letterSpacing: '0.07em', gap: 8,
                  }}>
                    <span>Code</span>
                    <span>Désignation</span>
                    <span style={{ textAlign: 'right' }}>Unité</span>
                    <span style={{ textAlign: 'right' }}>Qté</span>
                    <span style={{ textAlign: 'right' }}>PU (FCFA)</span>
                    <span style={{ textAlign: 'right' }}>Total (FCFA)</span>
                  </div>

                  <div style={{ flex: 1, overflowY: 'auto' }}>
                    {bSelected.articles.map((ligne, i) => {
                      const art = ARTICLES.find(a => a.id === ligne.articleId);
                      if (!art) return null;
                      const total = art.pu * ligne.quantite;
                      return (
                        <div key={ligne.id} style={{
                          display: 'grid', gridTemplateColumns: '80px 1fr 80px 80px 80px 110px',
                          padding: '9px 16px', borderBottom: '1px solid #F1F5F9',
                          fontSize: 12.5, gap: 8, alignItems: 'center',
                          transition: 'background 0.1s',
                        }}
                        onMouseEnter={e => (e.currentTarget.style.background = '#F8FAFC')}
                        onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
                        >
                          <span style={{ color: NAVY, fontWeight: 700, fontSize: 11 }}>{art.code}</span>
                          <div>
                            <div style={{ fontWeight: 500, color: '#1E293B' }}>{art.designation}</div>
                            <div style={{ fontSize: 10.5, color: '#94A3B8' }}>{ligne.lot} · {art.categorie}</div>
                          </div>
                          <span style={{ textAlign: 'right', color: '#475569', fontSize: 11.5 }}>{art.unite}</span>
                          <span style={{ textAlign: 'right', fontWeight: 600, color: '#1E293B' }}>
                            {ligne.quantite.toLocaleString('fr-FR')}
                          </span>
                          <span style={{ textAlign: 'right', color: '#475569', fontSize: 11.5 }}>
                            {fmtFCFA(art.pu)}
                          </span>
                          <span style={{ textAlign: 'right', fontWeight: 700, color: '#1E293B' }}>
                            {fmtFCFA(total)}
                          </span>
                        </div>
                      );
                    })}
                  </div>

                  {/* Total */}
                  <div style={{
                    padding: '12px 16px', borderTop: '2px solid #E2E8F0',
                    display: 'flex', justifyContent: 'flex-end', alignItems: 'center', gap: 16,
                  }}>
                    <span style={{ fontSize: 13, color: '#64748B' }}>Total bordereau :</span>
                    <span style={{ fontSize: 18, fontWeight: 900, color: NAVY }}>
                      {fmtFCFA(totalBordereau)} FCFA
                    </span>
                  </div>

                  {/* Historique des versions (référence contractuelle) */}
                  <div style={{ borderTop: '1px solid #F1F5F9', padding: '12px 16px' }}>
                    <div style={{ fontSize: 12, fontWeight: 700, color: '#0F172A', display: 'flex', alignItems: 'center', gap: 6, marginBottom: 10 }}>
                      <History size={14} style={{ color: PURPLE }} /> Historique des versions — référence conservée
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
                      {(VERSIONS_DEMO[bSelected.id] ?? []).map((v, i) => (
                        <div key={v.version} style={{ display: 'flex', gap: 10, position: 'relative', paddingBottom: 12 }}>
                          {i < (VERSIONS_DEMO[bSelected.id]?.length ?? 0) - 1 && (
                            <div style={{ position: 'absolute', left: 6, top: 16, bottom: 0, width: 2, background: '#E2E8F0' }} />
                          )}
                          <div style={{ width: 14, height: 14, borderRadius: '50%', background: i === 0 ? GREEN : '#CBD5E1', flexShrink: 0, marginTop: 2, border: '2px solid #fff', boxShadow: '0 0 0 1px #E2E8F0' }} />
                          <div style={{ flex: 1 }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                              <span style={{ fontSize: 12, fontWeight: 700, color: i === 0 ? GREEN : '#334155' }}>{v.version}</span>
                              {i === 0 && <span style={{ fontSize: 9, fontWeight: 700, color: GREEN, background: '#DCFCE7', padding: '1px 6px', borderRadius: 4 }}>ACTUELLE</span>}
                              <span style={{ fontSize: 10.5, color: '#94A3B8', marginLeft: 'auto' }}>{v.date} · {v.auteur}</span>
                            </div>
                            <div style={{ fontSize: 11, color: '#64748B', marginTop: 2 }}>{v.note}</div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                  </>)}
                </>
              ) : (
                <div style={{ padding: 40, textAlign: 'center', color: '#94A3B8', fontSize: 13 }}>
                  Sélectionnez un bordereau pour voir le détail
                </div>
              )}
            </div>
          </div>
        )}

        {/* ════════ TAB: Décomptes & Situation des biens et services ════════ */}
        {activeTab === 'decomptes' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>

            {/* Bandeau audit budgétaire (Earned Value / Cost Control) */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 12 }}>
              {[
                { label: 'Montant marché (réf. BoQ v3.2)', value: `${fmtFCFA(montantMarche)} F`, color: NAVY, icon: <BookOpen size={15} /> },
                { label: 'Décompté cumulé', value: `${fmtFCFA(cumulDecomptes)} F`, color: ORANGE, icon: <Receipt size={15} /> },
                { label: 'Payé (certifié)', value: `${fmtFCFA(montantPaye)} F`, color: GREEN, icon: <CheckSquare size={15} /> },
                { label: 'Reste à exécuter', value: `${fmtFCFA(ecartBudget)} F`, color: ecartBudget < 0 ? RED : '#475569', icon: <TrendingUp size={15} /> },
                { label: "Taux d'exécution", value: `${tauxExecution.toFixed(1)} %`, color: PURPLE, icon: <ClipboardCheck size={15} /> },
              ].map(k => (
                <div key={k.label} style={{ background: '#fff', borderRadius: 10, border: '1px solid #E2E8F0', borderTop: `3px solid ${k.color}`, padding: '12px 14px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, color: k.color, marginBottom: 6 }}>{k.icon}<span style={{ fontSize: 10, fontWeight: 700, color: '#94A3B8', textTransform: 'uppercase', letterSpacing: '0.04em' }}>{k.label}</span></div>
                  <div style={{ fontSize: 17, fontWeight: 800, color: k.color }}>{k.value}</div>
                </div>
              ))}
            </div>

            {/* Contrôle d'exécution — barre cumul vs marché */}
            <div style={{ background: '#fff', borderRadius: 10, border: '1px solid #E2E8F0', padding: '14px 16px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
                <span style={{ fontSize: 13, fontWeight: 700, color: '#0F172A' }}>Contrôle d&apos;exécution budgétaire</span>
                <span style={{ fontSize: 12, color: '#64748B' }}>Avancement physique cumulé : <strong style={{ color: NAVY }}>{dernierAvancement}%</strong></span>
              </div>
              <div style={{ height: 14, borderRadius: 8, background: '#F1F5F9', overflow: 'hidden', position: 'relative' }}>
                <div style={{ position: 'absolute', inset: 0, width: `${Math.min(tauxExecution, 100)}%`, background: `linear-gradient(90deg, ${NAVY}, ${ORANGE})`, borderRadius: 8 }} />
                <div style={{ position: 'absolute', left: `${dernierAvancement}%`, top: -2, bottom: -2, width: 2, background: GREEN }} title="Avancement physique" />
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 6, fontSize: 10.5, color: '#94A3B8' }}>
                <span>Financier décompté : {tauxExecution.toFixed(1)}%</span>
                <span style={{ color: GREEN }}>▮ Physique : {dernierAvancement}%</span>
              </div>
              {tauxExecution > dernierAvancement + 5 && (
                <div style={{ marginTop: 8, fontSize: 11, color: RED, display: 'flex', alignItems: 'center', gap: 5 }}>
                  <AlertTriangle size={12} /> Alerte : le décompté financier dépasse l&apos;avancement physique — vérifier la facturation.
                </div>
              )}
            </div>

            {/* Décomptes intérimaires & attachements */}
            <div style={{ background: '#fff', borderRadius: 10, border: '1px solid #E2E8F0', overflow: 'hidden' }}>
              <div style={{ padding: '12px 16px', borderBottom: '1px solid #F1F5F9', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <div style={{ fontSize: 13.5, fontWeight: 700, color: '#0F172A', display: 'flex', alignItems: 'center', gap: 8 }}>
                  <Receipt size={16} style={{ color: ORANGE }} /> Décomptes intérimaires & factures rattachées
                </div>
                <button onClick={ajouterDecompte} style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '6px 12px', borderRadius: 7, border: 'none', background: NAVY, color: '#fff', fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>
                  <Plus size={13} /> Nouveau décompte
                </button>
              </div>
              <input ref={decompteFileRef} type="file" style={{ display: 'none' }} accept=".pdf,.docx,.xlsx,.png,.jpg" onChange={handleDecompteFile} />
              {/* En-têtes */}
              <div style={{ display: 'grid', gridTemplateColumns: '52px 1fr 130px 110px 90px 110px 100px 150px 30px', gap: 8, padding: '8px 16px', background: '#F8FAFC', borderBottom: '1px solid #F1F5F9', fontSize: 10, fontWeight: 700, color: '#94A3B8', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                <span>N°</span><span>Période</span><span style={{ textAlign: 'right' }}>Montant HT</span><span>Facture</span><span style={{ textAlign: 'center' }}>Avanc.</span><span>Statut</span><span style={{ textAlign: 'center' }}>Attachement</span><span style={{ textAlign: 'center' }}>Actions</span><span />
              </div>
              {decomptes.length === 0 && <div style={{ padding: 24, textAlign: 'center', color: '#94A3B8', fontSize: 13 }}>Aucun décompte — cliquez sur « Nouveau décompte ».</div>}
              {decomptes.map(d => (
                <div key={d.id} style={{ display: 'grid', gridTemplateColumns: '52px 1fr 130px 110px 90px 110px 100px 150px 30px', gap: 8, padding: '9px 16px', borderBottom: '1px solid #F1F5F9', alignItems: 'center', fontSize: 12 }}>
                  <span style={{ fontWeight: 800, color: NAVY }}>N°{d.numero}</span>
                  <input value={d.periode} onChange={e => updateDecompte(d.id, { periode: e.target.value })} style={inlineInput} />
                  <input type="number" value={d.montantHT} onChange={e => updateDecompte(d.id, { montantHT: Number(e.target.value) })} style={{ ...inlineInput, textAlign: 'right', fontWeight: 700 }} />
                  <input value={d.factureRef} onChange={e => updateDecompte(d.id, { factureRef: e.target.value })} placeholder="FAC-…" style={inlineInput} />
                  <div style={{ display: 'flex', alignItems: 'center', gap: 4, justifyContent: 'center' }}>
                    <input type="number" min={0} max={100} value={d.avancementCumule} onChange={e => updateDecompte(d.id, { avancementCumule: Number(e.target.value) })} style={{ ...inlineInput, width: 44, textAlign: 'right' }} /><span style={{ color: '#94A3B8' }}>%</span>
                  </div>
                  <select value={d.statut} onChange={e => updateDecompte(d.id, { statut: e.target.value as DecompteStatut })}
                    style={{ ...inlineInput, fontWeight: 700, color: DECOMPTE_CFG[d.statut].color, background: DECOMPTE_CFG[d.statut].bg }}>
                    {(Object.keys(DECOMPTE_CFG) as DecompteStatut[]).map(s => <option key={s} value={s} style={{ background: '#fff', color: '#111' }}>{DECOMPTE_CFG[s].label}</option>)}
                  </select>
                  <div style={{ textAlign: 'center' }}>
                    {d.attachement ? (
                      <button onClick={() => setViewDoc({ nom: d.attachement!.nom, ext: d.attachement!.ext, taille: d.attachement!.taille, url: d.attachement!.url })}
                        title={d.attachement.nom}
                        style={{ display: 'inline-flex', alignItems: 'center', gap: 4, padding: '3px 7px', borderRadius: 6, border: `1px solid ${NAVY}30`, background: '#EFF6FF', color: NAVY, fontSize: 10.5, fontWeight: 600, cursor: 'pointer', maxWidth: 96, overflow: 'hidden', whiteSpace: 'nowrap', textOverflow: 'ellipsis' }}>
                        <Eye size={11} /> Ouvrir
                      </button>
                    ) : (
                      <button onClick={() => { setPendingDecompteId(d.id); decompteFileRef.current?.click(); }}
                        style={{ display: 'inline-flex', alignItems: 'center', gap: 4, padding: '3px 7px', borderRadius: 6, border: `1px dashed ${ORANGE}`, background: '#FFF7ED', color: ORANGE, fontSize: 10.5, fontWeight: 600, cursor: 'pointer' }}>
                        <Paperclip size={11} /> Joindre
                      </button>
                    )}
                  </div>
                  <div style={{ display: 'flex', gap: 4, justifyContent: 'center' }}>
                    {d.attachement && (
                      <button onClick={() => { setPendingDecompteId(d.id); decompteFileRef.current?.click(); }} title="Remplacer la pièce" style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#94A3B8', display: 'flex' }}><Paperclip size={13} /></button>
                    )}
                  </div>
                  <button onClick={() => supprimerDecompte(d.id)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#CBD5E1', display: 'flex' }}><Trash2 size={13} /></button>
                </div>
              ))}
              {/* Total décompté */}
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 14, padding: '10px 16px', borderTop: '2px solid #E2E8F0', background: '#F8FAFC' }}>
                <span style={{ fontSize: 12.5, color: '#64748B' }}>Cumul décompté :</span>
                <span style={{ fontSize: 15, fontWeight: 900, color: NAVY }}>{fmtFCFA(cumulDecomptes)} FCFA</span>
              </div>
            </div>

            {/* Situation des biens et services — contractuel vs exécuté */}
            <div style={{ background: '#fff', borderRadius: 10, border: '1px solid #E2E8F0', overflow: 'hidden' }}>
              <div style={{ padding: '12px 16px', borderBottom: '1px solid #F1F5F9', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <div style={{ fontSize: 13.5, fontWeight: 700, color: '#0F172A', display: 'flex', alignItems: 'center', gap: 8 }}>
                  <ClipboardCheck size={16} style={{ color: GREEN }} /> Situation des biens et services — contractuel vs exécuté
                </div>
                <button onClick={exportSituationCSV} style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '6px 12px', borderRadius: 7, border: '1px solid #E2E8F0', background: '#fff', color: '#475569', fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>
                  <Download size={13} /> Exporter situation
                </button>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '80px 1fr 70px 90px 90px 120px 120px 80px', gap: 6, padding: '8px 16px', background: '#F8FAFC', borderBottom: '1px solid #F1F5F9', fontSize: 10, fontWeight: 700, color: '#94A3B8', textTransform: 'uppercase' }}>
                <span>Code</span><span>Désignation</span><span style={{ textAlign: 'right' }}>U.</span><span style={{ textAlign: 'right' }}>Qté contr.</span><span style={{ textAlign: 'right' }}>Qté exéc.</span><span style={{ textAlign: 'right' }}>Mt contractuel</span><span style={{ textAlign: 'right' }}>Mt exécuté</span><span style={{ textAlign: 'right' }}>% réal.</span>
              </div>
              {situationLignes.map((s, i) => {
                const pct = s.montantContr > 0 ? (s.montantExec / s.montantContr) * 100 : 0;
                return (
                  <div key={i} style={{ display: 'grid', gridTemplateColumns: '80px 1fr 70px 90px 90px 120px 120px 80px', gap: 6, padding: '8px 16px', borderBottom: '1px solid #F1F5F9', fontSize: 11.5, alignItems: 'center' }}>
                    <span style={{ fontWeight: 700, color: NAVY }}>{s.code}</span>
                    <span style={{ color: '#1E293B' }}>{s.designation}</span>
                    <span style={{ textAlign: 'right', color: '#64748B' }}>{s.unite}</span>
                    <span style={{ textAlign: 'right' }}>{s.qteContr.toLocaleString('fr-FR')}</span>
                    <span style={{ textAlign: 'right', fontWeight: 600 }}>{s.qteExec.toLocaleString('fr-FR')}</span>
                    <span style={{ textAlign: 'right', color: '#475569' }}>{fmtFCFA(s.montantContr)}</span>
                    <span style={{ textAlign: 'right', fontWeight: 700, color: NAVY }}>{fmtFCFA(s.montantExec)}</span>
                    <span style={{ textAlign: 'right', fontWeight: 700, color: pct >= 80 ? GREEN : pct >= 40 ? AMBER : '#94A3B8' }}>{pct.toFixed(0)}%</span>
                  </div>
                );
              })}
              <div style={{ display: 'grid', gridTemplateColumns: '80px 1fr 70px 90px 90px 120px 120px 80px', gap: 6, padding: '10px 16px', borderTop: '2px solid #E2E8F0', background: '#F8FAFC', fontSize: 12, fontWeight: 800, color: NAVY }}>
                <span>TOTAL</span><span /><span /><span /><span />
                <span style={{ textAlign: 'right' }}>{fmtFCFA(situationLignes.reduce((s, x) => s + x.montantContr, 0))}</span>
                <span style={{ textAlign: 'right' }}>{fmtFCFA(situationLignes.reduce((s, x) => s + x.montantExec, 0))}</span>
                <span style={{ textAlign: 'right' }}>{tauxExecution.toFixed(0)}%</span>
              </div>
            </div>

          </div>
        )}

        {/* ════════ TAB: Attachements de paiement (BOQ réalisé) ════════ */}
        {activeTab === 'attachements' && <AttachementsPanel />}

        {/* ════════ TAB: Bibliothèque ════════ */}
        {activeTab === 'bibliotheque' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>

            {/* Barre de recherche */}
            <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
              <div style={{ position: 'relative', flex: 1 }}>
                <Search size={14} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: '#94A3B8' }} />
                <input
                  value={searchQ}
                  onChange={e => setSearchQ(e.target.value)}
                  placeholder="Rechercher un article (code, désignation)…"
                  style={{
                    width: '100%', padding: '9px 12px 9px 32px', borderRadius: 8,
                    border: '1px solid #E2E8F0', fontSize: 13, outline: 'none',
                    background: '#fff', fontFamily: 'inherit', boxSizing: 'border-box',
                  }}
                />
              </div>
              <select value={catFiltre} onChange={e => setCatFiltre(e.target.value)} style={{
                padding: '9px 12px', borderRadius: 8, border: '1px solid #E2E8F0',
                fontSize: 13, background: '#fff', color: '#475569', cursor: 'pointer', fontFamily: 'inherit',
              }}>
                {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
              <button style={{
                display: 'flex', alignItems: 'center', gap: 6,
                padding: '9px 14px', borderRadius: 8, border: 'none',
                background: NAVY, color: '#fff', fontSize: 12.5, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit',
              }}>
                <Plus size={13} /> Nouvel article
              </button>
            </div>

            {/* Tableau articles */}
            <div style={{
              background: '#fff', borderRadius: 10, border: '1px solid #E2E8F0',
              boxShadow: '0 1px 4px rgba(0,0,0,0.05)', overflow: 'hidden',
            }}>
              <div style={{
                display: 'grid', gridTemplateColumns: '90px 1fr 100px 80px 130px 90px',
                padding: '7px 16px', background: '#F8FAFC',
                borderBottom: '1px solid #F1F5F9',
                fontSize: 10.5, fontWeight: 700, color: '#94A3B8',
                textTransform: 'uppercase', letterSpacing: '0.07em', gap: 8,
              }}>
                <span>Code</span>
                <span>Désignation</span>
                <span>Catégorie</span>
                <span style={{ textAlign: 'right' }}>Unité</span>
                <span style={{ textAlign: 'right' }}>Prix unitaire (FCFA)</span>
                <span style={{ textAlign: 'center' }}>Actions</span>
              </div>

              {articlesFiltres.map((art, i) => (
                <div key={art.id} style={{
                  display: 'grid', gridTemplateColumns: '90px 1fr 100px 80px 130px 90px',
                  padding: '10px 16px', borderBottom: i < articlesFiltres.length - 1 ? '1px solid #F1F5F9' : 'none',
                  fontSize: 12.5, gap: 8, alignItems: 'center',
                  transition: 'background 0.1s',
                }}
                onMouseEnter={e => (e.currentTarget.style.background = '#F8FAFC')}
                onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
                >
                  <span style={{ color: NAVY, fontWeight: 700, fontSize: 11 }}>{art.code}</span>
                  <span style={{ fontWeight: 500, color: '#1E293B' }}>{art.designation}</span>
                  <span style={{
                    fontSize: 10.5, fontWeight: 600, padding: '2px 7px', borderRadius: 8,
                    background: '#F1F5F9', color: '#475569',
                  }}>{art.categorie}</span>
                  <span style={{ textAlign: 'right', color: '#475569' }}>{art.unite}</span>
                  <span style={{ textAlign: 'right', fontWeight: 700, color: '#1E293B' }}>
                    {fmtFCFA(art.pu)}
                  </span>
                  <div style={{ display: 'flex', gap: 6, justifyContent: 'center' }}>
                    <button style={{ padding: '4px', borderRadius: 5, border: 'none', background: '#EFF6FF', cursor: 'pointer' }}>
                      <Pencil size={11} style={{ color: NAVY }} />
                    </button>
                    <button style={{ padding: '4px', borderRadius: 5, border: 'none', background: '#FEE2E2', cursor: 'pointer' }}>
                      <Trash2 size={11} style={{ color: RED }} />
                    </button>
                  </div>
                </div>
              ))}

              {articlesFiltres.length === 0 && (
                <div style={{ padding: 32, textAlign: 'center', color: '#94A3B8', fontSize: 13 }}>
                  Aucun article trouvé pour cette recherche
                </div>
              )}
            </div>
          </div>
        )}

        {/* ════════ TAB: Matrices ════════ */}
        {activeTab === 'matrices' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>

            {/* Types de matrices */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 14 }}>
              {([
                { id: 'raci', label: 'Matrice RACI', desc: 'Responsable, Approbateur, Consulté, Informé', icon: <Users size={22} style={{ color: PURPLE }} />, color: PURPLE, count: 2 },
                { id: 'livrables', label: 'Matrice des livrables', desc: 'Types documentaires attendus par tâche', icon: <FileText size={22} style={{ color: NAVY }} />, color: NAVY, count: 3 },
                { id: 'risques', label: 'Matrice des risques', desc: 'Points de contrôle, preuves et escalades', icon: <AlertTriangle size={22} style={{ color: RED }} />, color: RED, count: 1 },
              ] as const).map(m => (
                <div key={m.label} style={{
                  background: '#fff', borderRadius: 10, border: '1px solid #E2E8F0',
                  borderTop: `3px solid ${m.color}`,
                  padding: '16px', boxShadow: '0 1px 4px rgba(0,0,0,0.05)',
                  cursor: 'pointer',
                }}>
                  <div style={{ marginBottom: 10 }}>{m.icon}</div>
                  <div style={{ fontSize: 14, fontWeight: 700, color: '#0F172A', marginBottom: 4 }}>{m.label}</div>
                  <div style={{ fontSize: 12, color: '#64748B', marginBottom: 12 }}>{m.desc}</div>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <span style={{ fontSize: 12, fontWeight: 700, color: m.color }}>{m.count} matrice{m.count > 1 ? 's' : ''}</span>
                    <button onClick={() => setMatriceView(m.id)} style={{
                      fontSize: 11.5, color: m.color, background: `${m.color}12`,
                      border: 'none', padding: '4px 10px', borderRadius: 6, cursor: 'pointer', fontFamily: 'inherit',
                    }}>
                      Voir →
                    </button>
                  </div>
                </div>
              ))}
            </div>

            {/* Matrices RACI démo */}
            <div style={{
              background: '#fff', borderRadius: 10, border: '1px solid #E2E8F0',
              boxShadow: '0 1px 4px rgba(0,0,0,0.05)', overflow: 'hidden',
            }}>
              <div style={{ padding: '12px 16px', borderBottom: '1px solid #F1F5F9', fontSize: 13.5, fontWeight: 700, color: '#0F172A' }}>
                Matrices RACI projet
              </div>
              {MATRICES_DEMO.map((m, i) => (
                <div key={m.id} style={{
                  padding: '12px 16px', borderBottom: i < MATRICES_DEMO.length - 1 ? '1px solid #F1F5F9' : 'none',
                  display: 'flex', alignItems: 'center', gap: 12,
                }}>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 13, fontWeight: 600, color: '#1E293B' }}>
                      Matrice RACI v{m.version} — Projet HTA {i === 0 ? 'Centre' : 'Nord'}
                    </div>
                    <div style={{ fontSize: 11, color: '#94A3B8', marginTop: 3 }}>
                      Acteurs : {m.acteurs.join(', ')} · Mise à jour {m.date}
                    </div>
                  </div>
                  <button onClick={() => setViewDoc({ nom: `Matrice_RACI_v${m.version}.xlsx`, ext: 'xlsx', taille: '180 Ko' })} style={{
                    padding: '6px 12px', borderRadius: 6, border: `1px solid ${PURPLE}`,
                    background: '#F5F3FF', color: PURPLE, fontSize: 12, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit',
                  }}>
                    Ouvrir
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

      </div>

      {/* Visionneuse / annotation in-app (global au module) */}
      {viewDoc && <DocumentAnnotator doc={viewDoc} onClose={() => setViewDoc(null)} />}

      {/* Visionneuse de matrice projet (RACI · livrables · risques) */}
      {matriceView && <MatriceViewer type={matriceView} onClose={() => setMatriceView(null)} />}
    </div>
  );
}

/* ─── Matrices de projet (RACI / livrables / risques) ─────────────────────── */
const MATRICE_DATA: Record<'raci' | 'livrables' | 'risques', { titre: string; couleur: string; cols: string[]; rows: string[][] }> = {
  raci: {
    titre: 'Matrice RACI — Responsabilités projet',
    couleur: PURPLE,
    cols: ['Activité / Livrable', 'Chef de Projet', 'Ingénieur', 'Contrôleur', 'Chef Dépt', 'UAGL'],
    rows: [
      ['Études APS / APD', 'A', 'R', 'C', 'I', '—'],
      ['Constitution DAO', 'R', 'C', 'C', 'A', 'I'],
      ['Évaluation des offres', 'A', 'R', 'C', 'I', '—'],
      ['Suivi travaux chantier', 'A', 'R', 'R', 'I', 'C'],
      ['Réception provisoire', 'R', 'C', 'R', 'A', 'I'],
      ['Décompte / Attachement', 'A', 'C', 'R', 'I', 'C'],
      ['Ordres de mission terrain', 'A', 'I', 'I', 'C', 'R'],
    ],
  },
  livrables: {
    titre: 'Matrice des livrables — Documents attendus par phase',
    couleur: NAVY,
    cols: ['Phase', 'Livrable attendu', 'Format', 'Responsable', 'Échéance'],
    rows: [
      ['Études', 'Rapport APS', 'PDF + DWG', 'Bureau d\'études', 'T0 + 45j'],
      ['Études', 'Rapport APD + CCTP', 'PDF + DWG', 'Bureau d\'études', 'T0 + 90j'],
      ['Passation', 'Dossier DAO complet', 'PDF', 'Chef de Projet', 'T0 + 120j'],
      ['Passation', 'PV d\'attribution', 'PDF', 'Commission', 'T0 + 165j'],
      ['Exécution', 'Plans d\'exécution', 'DWG', 'Entreprise', 'Mensuel'],
      ['Exécution', 'Situations / décomptes', 'XLSX', 'Entreprise', 'Mensuel'],
      ['Réception', 'PV réception provisoire', 'PDF', 'Commission', 'Fin travaux'],
      ['Réception', 'Dossier des ouvrages exécutés (DOE)', 'PDF + DWG', 'Entreprise', 'Réception déf.'],
    ],
  },
  risques: {
    titre: 'Matrice des risques — Points de contrôle & escalades',
    couleur: RED,
    cols: ['Risque', 'Point de contrôle', 'Preuve attendue', 'Criticité', 'Escalade'],
    rows: [
      ['Retard livraison matériel', 'Suivi commandes fournisseurs', 'Bon de commande + AR', 'Élevée', 'Chef de Dépt'],
      ['Dérive budgétaire', 'Revue CPI mensuelle', 'Tableau EVM', 'Élevée', 'DAF / Direction'],
      ['Non-conformité technique', 'Inspection terrain', 'PV + photos géolocalisées', 'Moyenne', 'Ingénieur'],
      ['Foncier non purgé', 'Vérification autorisations', 'Arrêté / PV palabre', 'Élevée', 'Direction'],
      ['Intempéries (hivernage)', 'Planning tampon', 'Journal de chantier', 'Faible', 'Chef de Projet'],
      ['Défaut de paiement', 'Suivi décaissements', 'OP / relevé bancaire', 'Moyenne', 'DAF'],
    ],
  },
};

function MatriceViewer({ type, onClose }: { type: 'raci' | 'livrables' | 'risques'; onClose: () => void }) {
  const m = MATRICE_DATA[type];
  const raciColor = (v: string) => v === 'R' ? '#1D4ED8' : v === 'A' ? '#DC2626' : v === 'C' ? '#D97706' : v === 'I' ? '#16A34A' : '#94A3B8';
  return (
    <div onClick={onClose} style={{ position: 'fixed', inset: 0, zIndex: 700, background: 'rgba(15,23,42,0.5)', backdropFilter: 'blur(3px)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
      <div onClick={e => e.stopPropagation()} style={{ background: '#fff', borderRadius: 12, width: 'min(860px, 96vw)', maxHeight: '88vh', display: 'flex', flexDirection: 'column', boxShadow: '0 24px 64px rgba(0,0,0,0.3)', overflow: 'hidden' }}>
        <div style={{ padding: '14px 18px', borderBottom: '1px solid #E2E8F0', display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderTop: `3px solid ${m.couleur}` }}>
          <div style={{ fontSize: 15, fontWeight: 800, color: '#0F172A' }}>{m.titre}</div>
          <button onClick={onClose} style={{ border: 'none', background: 'none', cursor: 'pointer', color: '#94A3B8' }}>✕</button>
        </div>
        {type === 'raci' && (
          <div style={{ padding: '8px 18px 0', display: 'flex', gap: 12, fontSize: 11, color: '#64748B', flexWrap: 'wrap' }}>
            <span><b style={{ color: '#1D4ED8' }}>R</b> Responsable</span>
            <span><b style={{ color: '#DC2626' }}>A</b> Approbateur</span>
            <span><b style={{ color: '#D97706' }}>C</b> Consulté</span>
            <span><b style={{ color: '#16A34A' }}>I</b> Informé</span>
          </div>
        )}
        <div style={{ overflow: 'auto', padding: 18 }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12.5 }}>
            <thead>
              <tr>{m.cols.map((c, i) => (
                <th key={i} style={{ textAlign: i === 0 ? 'left' : 'center', padding: '8px 10px', background: m.couleur, color: '#fff', fontSize: 11, fontWeight: 700, position: 'sticky', top: 0, whiteSpace: 'nowrap' }}>{c}</th>
              ))}</tr>
            </thead>
            <tbody>
              {m.rows.map((row, ri) => (
                <tr key={ri} style={{ background: ri % 2 ? '#F8FAFC' : '#fff' }}>
                  {row.map((cell, ci) => {
                    const isRaci = type === 'raci' && ci > 0;
                    return (
                      <td key={ci} style={{ padding: '8px 10px', borderBottom: '1px solid #F1F5F9', textAlign: ci === 0 ? 'left' : 'center', fontWeight: ci === 0 ? 600 : isRaci ? 800 : 400, color: isRaci ? raciColor(cell) : '#334155', whiteSpace: ci === 0 ? 'normal' : 'nowrap' }}>
                        {cell}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

/* ─── Attachements de paiement (BOQ quantités réalisées) ──────────────────── */
const ATT_STATUTS: Record<string, { label: string; bg: string; fg: string }> = {
  brouillon: { label: 'Brouillon', bg: '#F1F5F9', fg: '#64748B' },
  soumis: { label: 'Soumis (entreprise)', bg: '#FFFBEB', fg: '#B45309' },
  valide: { label: 'Validé (chef de projet)', bg: '#DCFCE7', fg: '#15803D' },
  rejete: { label: 'Rejeté', bg: '#FEE2E2', fg: '#B91C1C' },
};
const fmt = (n: number) => n.toLocaleString('fr-FR');

function AttachementsPanel() {
  const att = useAttachements();
  const { user, isRole } = useAuth();
  const store = useProjectStore();
  const [projetCode, setProjetCode] = useState(store.projets[0]?.code ?? '');
  const [selId, setSelId] = useState('');
  const userName = `${user?.prenom ?? ''} ${user?.nom ?? ''}`.trim();
  // Rôle « entreprise » = saisie ; chef de projet / pilotage = validation.
  const peutValider = isRole('CHEF_PROJ', 'CHEF_DEPT', 'DIR_DPE', 'PMO', 'ADMIN', 'CONTROLEUR');

  const liste = att.attachements.filter(a => a.projetCode === projetCode);
  const sel = att.attachements.find(a => a.id === selId);

  const nouveau = () => {
    const n = liste.length + 1;
    const id = att.createAttachement({
      projetCode, numero: n, periode: new Date().toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' }),
      entreprise: 'Entreprise titulaire',
      lignes: [
        { id: `l${Date.now()}1`, designation: 'Fourniture & pose poteau béton 10m', unite: 'u', prixUnitaire: 245000, qteContractuelle: 180, qteRealisee: 0 },
        { id: `l${Date.now()}2`, designation: 'Réseau HTA 54,6 mm²', unite: 'km', prixUnitaire: 14500000, qteContractuelle: 12, qteRealisee: 0 },
        { id: `l${Date.now()}3`, designation: 'Poste de transformation H61', unite: 'u', prixUnitaire: 6200000, qteContractuelle: 8, qteRealisee: 0 },
      ],
    });
    setSelId(id);
  };

  return (
    <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap', padding: '0 4px' }}>
      <div style={{ width: 300, flexShrink: 0 }}>
        <div style={{ display: 'flex', gap: 8, marginBottom: 10 }}>
          <select value={projetCode} onChange={e => { setProjetCode(e.target.value); setSelId(''); }} style={{ flex: 1, padding: '7px 9px', borderRadius: 8, border: '1.5px solid #CBD5E1', fontSize: 12 }}>
            {store.projets.map(p => <option key={p.id} value={p.code}>{p.code} — {p.nom.slice(0, 26)}</option>)}
          </select>
          <button onClick={nouveau} style={{ padding: '7px 12px', background: '#0E3460', color: '#fff', border: 'none', borderRadius: 8, fontSize: 12, fontWeight: 700, cursor: 'pointer' }}>+ Att.</button>
        </div>
        {liste.length === 0 ? <div style={{ color: '#94A3B8', fontSize: 12.5, padding: 8 }}>Aucun attachement. L'entreprise crée un attachement et saisit les quantités réalisées.</div> :
          liste.map(a => {
            const c = ATT_STATUTS[a.statut];
            return (
              <button key={a.id} onClick={() => setSelId(a.id)} style={{ display: 'block', width: '100%', textAlign: 'left', marginBottom: 6, padding: '10px 12px', borderRadius: 9, border: `1.5px solid ${a.id === selId ? '#0E3460' : '#E2E8F0'}`, background: a.id === selId ? '#EFF6FF' : '#fff', cursor: 'pointer', fontFamily: 'inherit' }}>
                <div style={{ fontWeight: 700, fontSize: 13 }}>Attachement N°{a.numero} — {a.periode}</div>
                <div style={{ fontSize: 11, color: '#64748B' }}>{a.entreprise} · {fmt(montantAttachement(a))} FCFA</div>
                <span style={{ fontSize: 10, fontWeight: 700, padding: '2px 7px', borderRadius: 10, background: c.bg, color: c.fg, marginTop: 4, display: 'inline-block' }}>{c.label}</span>
              </button>
            );
          })}
      </div>

      <div style={{ flex: 1, minWidth: 320 }}>
        {!sel ? <div style={{ background: '#fff', borderRadius: 12, border: '1px solid #E2E8F0', padding: 40, textAlign: 'center', color: '#94A3B8' }}>Sélectionnez ou créez un attachement.</div> : (() => {
          const editable = sel.statut === 'brouillon' || sel.statut === 'rejete';
          return (
            <div style={{ background: '#fff', borderRadius: 12, border: '1px solid #E2E8F0', overflow: 'hidden' }}>
              <div style={{ padding: '12px 16px', borderBottom: '1px solid #F1F5F9', display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap', background: '#F8FAFC' }}>
                <div style={{ flex: 1, minWidth: 180 }}>
                  <div style={{ fontWeight: 800, fontSize: 14, color: '#0E3460' }}>Attachement N°{sel.numero} — {sel.periode}</div>
                  <div style={{ fontSize: 11.5, color: '#64748B' }}>Entreprise : <input value={sel.entreprise} disabled={!editable} onChange={e => att.updateAttachement(sel.id, { entreprise: e.target.value })} style={{ border: 'none', background: 'transparent', fontSize: 11.5, color: '#334155', fontWeight: 600 }} /></div>
                </div>
                {editable && <button onClick={() => { att.soumettre(sel.id, userName); toast.success('Attachement soumis au chef de projet'); }} style={{ padding: '8px 14px', background: '#0E3460', color: '#fff', border: 'none', borderRadius: 8, fontSize: 12.5, fontWeight: 700, cursor: 'pointer' }}>Soumettre (entreprise)</button>}
              </div>
              {sel.statut === 'rejete' && <div style={{ padding: '8px 16px', background: '#FEF2F2', color: '#B91C1C', fontSize: 12 }}>Rejeté : {sel.motifRejet}</div>}
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
                  <thead><tr style={{ background: '#0E3460', color: '#fff', textAlign: 'left' }}>
                    <th style={attTh}>Désignation</th><th style={attTh}>Unité</th><th style={attTh}>PU (FCFA)</th><th style={attTh}>Qté contrat</th><th style={attTh}>Qté réalisée</th>{sel.statut !== 'brouillon' && <th style={attTh}>Qté validée</th>}<th style={attTh}>Montant</th>
                  </tr></thead>
                  <tbody>
                    {sel.lignes.map(l => {
                      const qte = l.qteValidee ?? l.qteRealisee;
                      return (
                        <tr key={l.id} style={{ borderBottom: '1px solid #F1F5F9' }}>
                          <td style={attTd}>{editable ? <input value={l.designation} onChange={e => att.updateLigne(sel.id, l.id, { designation: e.target.value })} style={attInp} /> : l.designation}</td>
                          <td style={attTd}>{l.unite}</td>
                          <td style={{ ...attTd, textAlign: 'right' }}>{fmt(l.prixUnitaire)}</td>
                          <td style={{ ...attTd, textAlign: 'right' }}>{l.qteContractuelle}</td>
                          <td style={{ ...attTd, textAlign: 'right' }}>
                            <input type="number" min={0} value={l.qteRealisee} disabled={!editable}
                              onChange={e => att.updateLigne(sel.id, l.id, { qteRealisee: Math.max(0, Number(e.target.value)) })}
                              style={{ ...attInp, width: 70, textAlign: 'right', color: l.qteRealisee > l.qteContractuelle ? '#EF4444' : '#0F172A' }} />
                          </td>
                          {sel.statut !== 'brouillon' && (
                            <td style={{ ...attTd, textAlign: 'right' }}>
                              <input type="number" min={0} value={l.qteValidee ?? l.qteRealisee} disabled={!peutValider || sel.statut === 'valide'}
                                onChange={e => att.updateLigne(sel.id, l.id, { qteValidee: Math.max(0, Number(e.target.value)) })}
                                style={{ ...attInp, width: 70, textAlign: 'right', fontWeight: 700 }} />
                            </td>
                          )}
                          <td style={{ ...attTd, textAlign: 'right', fontWeight: 700, color: '#15803D' }}>{fmt(Math.round(qte * l.prixUnitaire))}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
              <div style={{ padding: '12px 16px', background: '#F8FAFC', borderTop: '1px solid #E2E8F0', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 10 }}>
                <div style={{ fontSize: 14, fontWeight: 800, color: '#0E3460' }}>Montant attachement : {fmt(montantAttachement(sel))} FCFA</div>
                {sel.statut === 'soumis' && peutValider && (
                  <div style={{ display: 'flex', gap: 8 }}>
                    <button onClick={() => { const m = prompt('Motif du rejet ?') || 'Quantités non conformes'; att.rejeter(sel.id, userName, m); toast('Attachement rejeté', { icon: 'ℹ️' }); }} style={{ padding: '8px 14px', background: '#fff', color: '#B91C1C', border: '1px solid #FCA5A5', borderRadius: 8, fontSize: 12.5, fontWeight: 700, cursor: 'pointer' }}>Rejeter</button>
                    <button onClick={() => { att.valider(sel.id, userName); toast.success('Attachement validé — base du décompte/paiement'); }} style={{ padding: '8px 16px', background: '#16A34A', color: '#fff', border: 'none', borderRadius: 8, fontSize: 12.5, fontWeight: 700, cursor: 'pointer' }}>Valider (chef de projet)</button>
                  </div>
                )}
                {sel.statut === 'valide' && <span style={{ fontSize: 12, color: '#15803D', fontWeight: 700 }}>✓ Validé — sert de base au décompte/paiement.</span>}
              </div>
              {sel.historique.length > 0 && <div style={{ padding: '8px 16px', borderTop: '1px solid #F1F5F9', fontSize: 11, color: '#64748B' }}>{sel.historique.map((h, i) => <div key={i}>• {h.etape} — {h.par} ({new Date(h.date).toLocaleDateString('fr-FR')})</div>)}</div>}
            </div>
          );
        })()}
      </div>
    </div>
  );
}
const attTh: React.CSSProperties = { padding: '8px 10px', fontSize: 10.5, fontWeight: 700 };
const attTd: React.CSSProperties = { padding: '6px 10px' };
const attInp: React.CSSProperties = { padding: '4px 6px', borderRadius: 6, border: '1px solid #E2E8F0', fontSize: 12, fontFamily: 'inherit', width: '100%' };

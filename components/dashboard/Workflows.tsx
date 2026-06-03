'use client';

import { useState, useMemo, useRef } from 'react';
import DocumentAnnotator, { type AnnotatedDoc } from '@/components/ui/DocumentAnnotator';
import {
  Stamp, CheckCircle2, XCircle, Clock, ChevronRight,
  Paperclip, MessageSquare, Eye, RotateCcw,
  Search, ArrowRight, User, Calendar, Flag,
  FileText, Banknote, Truck, ClipboardCheck, Building2, Bell,
  GitBranch, Layers, Plus, Trash2, Edit2, Play, Pause,
  GripVertical, ChevronDown, Settings, Save, X, Copy,
  ArrowUp, ArrowDown, Zap, Shield, Mail,
} from 'lucide-react';
import { useNotificationStore } from '@/lib/notificationStore';
import SearchableSelect from '@/components/ui/SearchableSelect';
import { TEST_USERS } from '@/lib/authStore';

/* ─── Design Tokens ─────────────────────────────────── */
const C = {
  navy:   '#1B4F8A',
  orange: '#F47920',
  red:    '#EF3340',
  green:  '#16A34A',
  amber:  '#D97706',
  purple: '#8B5CF6',
  slate:  '#64748B',
  border: '#E2E8F0',
  bg:     '#F0F4F9',
  surface:'#ffffff',
} as const;

/* ─── Types ─────────────────────────────────────────── */
type TypeDossier = 'facture' | 'odm' | 'pv_reception' | 'marche' | 'rapport' | 'avenant' | 'courrier' | 'note' | 'autre';
type PrioriteDossier = 'urgent' | 'haute' | 'normale';
type StatutDossier = 'en_attente' | 'approuve' | 'rejete' | 'delegue';

interface PieceJointe { nom: string; taille: string; ext: 'pdf' | 'docx' | 'xlsx' | 'png' | 'dwg'; url?: string }
interface HistoriqueEtape { etape: string; acteur: string; date: string; commentaire?: string; decision?: 'approuve' | 'rejete' | 'delegue' }

interface DossierValidation {
  id: string;
  type: TypeDossier;
  reference: string;
  titre: string;
  projet: string;
  projetCode: string;
  montant?: number;
  devise?: string;
  soumetteur: string;
  dateCreation: string;
  dateLimite: string;
  priorite: PrioriteDossier;
  statut: StatutDossier;
  etapeActuelle: string;
  nombreEtapes: number;
  etapeIndex: number;
  signatureHash?: string; // Added for blockchain traceability
  signatureTimestamp?: string; // Added for blockchain traceability
  contexte: string;
  piecesJointes: PieceJointe[];
  historique: HistoriqueEtape[];
  slaHeures: number;
  heuresRestantes: number;
}

/* ─── Mock Data ─────────────────────────────────────── */
const DOSSIERS: DossierValidation[] = [
  {
    id: 'v1',
    type: 'facture',
    reference: 'FAC-2026-0342',
    titre: 'Facture travaux GC — Lot 1 Thiès',
    projet: 'PUDC Phase III — Électrification rurale Thiès',
    projetCode: 'PUDC-III',
    montant: 142_500_000,
    devise: 'FCFA',
    soumetteur: 'Entreprise SATEG',
    dateCreation: '2026-05-22',
    dateLimite: '2026-05-28',
    priorite: 'urgent',
    statut: 'en_attente',
    etapeActuelle: 'Validation DAF',
    nombreEtapes: 4,
    etapeIndex: 3,
    contexte: 'Situation de travaux n°4 correspondant à l\'achèvement du Lot 1 GC. PV de réception provisoire signé le 15/05/2026. Retenue de garantie de 5% applicable.',
    piecesJointes: [
      { nom: 'Facture_SATEG_0342.pdf', taille: '1.2 Mo', ext: 'pdf' },
      { nom: 'PV_reception_provisoire_Lot1.pdf', taille: '340 Ko', ext: 'pdf' },
      { nom: 'Situation_travaux_4.xlsx', taille: '88 Ko', ext: 'xlsx' },
    ],
    historique: [
      { etape: 'Soumission', acteur: 'SATEG (Fournisseur)', date: '2026-05-22 09:00', decision: 'approuve' },
      { etape: 'Contrôle pièces', acteur: 'Unité UAGL', date: '2026-05-23 14:20', commentaire: 'PV conforme, bordereau OK', decision: 'approuve' },
      { etape: 'Visa CP', acteur: 'Traoré A. (CP)', date: '2026-05-24 10:45', commentaire: 'Avancement réel confirmé sur site', decision: 'approuve' },
    ],
    slaHeures: 72,
    heuresRestantes: 18,
  },
  {
    id: 'v2',
    type: 'odm',
    reference: 'ODM-2026-089',
    titre: 'Ordre de Mission — Équipe supervision Kolda',
    projet: 'PUDC Phase II — Extension BT Kolda',
    projetCode: 'PUDC-II',
    montant: 485_000,
    devise: 'FCFA',
    soumetteur: 'Sène B. (Chef terrain)',
    dateCreation: '2026-05-24',
    dateLimite: '2026-05-27',
    priorite: 'haute',
    statut: 'en_attente',
    etapeActuelle: 'Validation Directeur',
    nombreEtapes: 3,
    etapeIndex: 3,
    contexte: 'Mission de supervision chantier Lot 3 — durée 5 jours, 3 agents terrain. Déplacement Dakar → Kolda (450 km). Per diem + carburant estimé.',
    piecesJointes: [
      { nom: 'ODM_Kolda_S22.pdf', taille: '280 Ko', ext: 'pdf' },
      { nom: 'Planning_mission.docx', taille: '95 Ko', ext: 'docx' },
    ],
    historique: [
      { etape: 'Demande', acteur: 'Sène B.', date: '2026-05-24 08:30', decision: 'approuve' },
      { etape: 'Visa RH', acteur: 'Diallo M. (RH)', date: '2026-05-24 16:10', commentaire: 'Agents disponibles confirmés', decision: 'approuve' },
    ],
    slaHeures: 48,
    heuresRestantes: 6,
  },
  {
    id: 'v3',
    type: 'pv_reception',
    reference: 'PVR-2026-014',
    titre: 'PV Réception Définitive — Lot 2 Fatick',
    projet: 'Projet Solaire Rural — Fatick',
    projetCode: 'PSR-FK',
    montant: 0,
    devise: 'FCFA',
    soumetteur: 'Commission de réception',
    dateCreation: '2026-05-20',
    dateLimite: '2026-05-30',
    priorite: 'normale',
    statut: 'en_attente',
    etapeActuelle: 'Signature Directeur DPE',
    nombreEtapes: 5,
    etapeIndex: 4,
    signatureHash: '0xabc123def456abc123def456abc123def456abc1', // Example hash
    signatureTimestamp: '2026-05-25 10:30:00', // Example timestamp
    contexte: 'PV de réception définitive après levée de toutes les réserves du PV provisoire (12 réserves levées le 10/05/2026). Déclenche la mainlevée de la caution de bonne exécution.',
    piecesJointes: [
      { nom: 'PVR_Definitif_Fatick_Lot2.pdf', taille: '2.1 Mo', ext: 'pdf' },
      { nom: 'Rapport_levee_reserves.pdf', taille: '450 Ko', ext: 'pdf' },
      { nom: 'Photos_reception.png', taille: '14 Mo', ext: 'png' },
    ],
    historique: [
      { etape: 'PV provisoire', acteur: 'Commission', date: '2026-04-15', decision: 'approuve' },
      { etape: 'Levée réserves', acteur: 'Bureau contrôle', date: '2026-05-10', decision: 'approuve' },
      { etape: 'Visa CP', acteur: 'Ndiaye P.', date: '2026-05-18', commentaire: 'Toutes réserves levées', decision: 'approuve' },
      { etape: 'Visa DAJ', acteur: 'Unité Juridique', date: '2026-05-20', commentaire: 'Documents conformes', decision: 'approuve' },
    ],
    slaHeures: 240,
    heuresRestantes: 120,
  },
  {
    id: 'v4',
    type: 'avenant',
    reference: 'AVN-2026-003',
    titre: 'Avenant n°2 — Prolongation délai Lot 3',
    projet: 'PUDC Phase III — Électrification rurale Thiès',
    projetCode: 'PUDC-III',
    montant: 0,
    devise: 'FCFA',
    soumetteur: 'Traoré A. (CP)',
    dateCreation: '2026-05-21',
    dateLimite: '2026-06-05',
    priorite: 'haute',
    statut: 'en_attente',
    etapeActuelle: 'Avis DAJ',
    nombreEtapes: 5,
    etapeIndex: 2,
    contexte: 'Prolongation de 45 jours suite aux conditions météo défavorables saison des pluies (cf. rapport météo + journal de chantier). Aucun impact budgétaire. Conformément à l\'article 45 du contrat initial.',
    piecesJointes: [
      { nom: 'Avenant_2_Lot3.docx', taille: '180 Ko', ext: 'docx' },
      { nom: 'Rapport_meteo_Kaolack.pdf', taille: '320 Ko', ext: 'pdf' },
      { nom: 'Journal_chantier_Lot3.xlsx', taille: '220 Ko', ext: 'xlsx' },
    ],
    historique: [
      { etape: 'Soumission CP', acteur: 'Traoré A.', date: '2026-05-21', decision: 'approuve' },
      { etape: 'Analyse UAGL', acteur: 'Unité UAGL', date: '2026-05-23', commentaire: 'Justificatifs recevables', decision: 'approuve' },
    ],
    slaHeures: 336,
    heuresRestantes: 230,
  },
  {
    id: 'v5',
    type: 'marche',
    reference: 'MCH-2026-008',
    titre: 'Marché fourniture câbles HTA — 33 kV',
    projet: 'Réseau HTA Tambacounda',
    projetCode: 'RHT-TBD',
    montant: 892_000_000,
    devise: 'FCFA',
    soumetteur: 'Commission d\'attribution',
    dateCreation: '2026-05-19',
    dateLimite: '2026-05-26',
    priorite: 'urgent',
    statut: 'en_attente',
    etapeActuelle: 'Approbation DG',
    nombreEtapes: 6,
    etapeIndex: 6,
    contexte: 'Attribution marché suite appel d\'offres restreint (3 offres reçues). Attributaire : SONECS SA — offre la moins-disante techniquement conforme. Économie de 8% vs estimation.',
    piecesJointes: [
      { nom: 'PV_Commission_attribution.pdf', taille: '890 Ko', ext: 'pdf' },
      { nom: 'Rapport_analyse_offres.pdf', taille: '1.8 Mo', ext: 'pdf' },
      { nom: 'Draft_marche_SONECS.docx', taille: '450 Ko', ext: 'docx' },
    ],
    historique: [
      { etape: 'Publication AO', acteur: 'DAJ', date: '2026-04-15', decision: 'approuve' },
      { etape: 'Réception offres', acteur: 'Commission', date: '2026-05-05', decision: 'approuve' },
      { etape: 'Évaluation technique', acteur: 'Bureau études', date: '2026-05-12', decision: 'approuve' },
      { etape: 'Évaluation financière', acteur: 'DAF', date: '2026-05-15', decision: 'approuve' },
      { etape: 'Avis DAJ', acteur: 'Unité Juridique', date: '2026-05-18', commentaire: 'Conformité réglementaire OK', decision: 'approuve' },
    ],
    slaHeures: 168,
    heuresRestantes: 12,
  },
  {
    id: 'v6',
    type: 'rapport',
    reference: 'RPT-2026-Q2',
    titre: 'Rapport trimestriel Q2 — Portefeuille DPE',
    projet: 'Portefeuille DPE SENELEC',
    projetCode: 'PORTF',
    soumetteur: 'PMO Direction',
    dateCreation: '2026-05-25',
    dateLimite: '2026-06-10',
    priorite: 'normale',
    statut: 'en_attente',
    etapeActuelle: 'Relecture PMO',
    nombreEtapes: 3,
    etapeIndex: 1,
    contexte: 'Rapport consolidé Q2 2026 pour transmission aux bailleurs (AFD, BEI, IDA). Inclut indicateurs PTBA, état avancement physique, situation financière, risques et recommandations.',
    piecesJointes: [
      { nom: 'Rapport_Q2_2026_DPE.docx', taille: '3.4 Mo', ext: 'docx' },
      { nom: 'Annexes_statistiques_Q2.xlsx', taille: '1.1 Mo', ext: 'xlsx' },
    ],
    historique: [
      { etape: 'Rédaction', acteur: 'Équipe PMO', date: '2026-05-25', decision: 'approuve' },
    ],
    slaHeures: 360,
    heuresRestantes: 340,
  },
  {
    id: 'v7',
    type: 'facture',
    reference: 'FAC-2026-0289',
    titre: 'Facture bureau d\'études — Mission APD',
    projet: 'Extension réseau BT — Saint-Louis',
    projetCode: 'EBT-SL',
    montant: 28_500_000,
    devise: 'FCFA',
    soumetteur: 'BETS Ingénierie',
    dateCreation: '2026-05-18',
    dateLimite: '2026-05-25',
    priorite: 'haute',
    statut: 'en_attente',
    etapeActuelle: 'Validation CP',
    nombreEtapes: 4,
    etapeIndex: 2,
    contexte: 'Facture correspondant à la phase APD complète (livrables : rapport APD, plans d\'exécution, CCTP, estimatif). Prestation conforme au TDR.',
    piecesJointes: [
      { nom: 'Facture_BETS_0289.pdf', taille: '680 Ko', ext: 'pdf' },
      { nom: 'Rapport_APD_SL.pdf', taille: '8.2 Mo', ext: 'pdf' },
    ],
    historique: [
      { etape: 'Soumission', acteur: 'BETS Ingénierie', date: '2026-05-18', decision: 'approuve' },
      { etape: 'Contrôle UAGL', acteur: 'Unité UAGL', date: '2026-05-20', commentaire: 'Livrables réceptionnés', decision: 'approuve' },
    ],
    slaHeures: 72,
    heuresRestantes: 3,
  },
  {
    id: 'v8',
    type: 'odm',
    reference: 'ODM-2026-094',
    titre: 'Ordre de Mission — Réunion AFD Paris',
    projet: 'Portefeuille DPE SENELEC',
    projetCode: 'PORTF',
    montant: 1_850_000,
    devise: 'FCFA',
    soumetteur: 'Dir. Projets',
    dateCreation: '2026-05-24',
    dateLimite: '2026-05-27',
    priorite: 'urgent',
    statut: 'en_attente',
    etapeActuelle: 'Validation DG',
    nombreEtapes: 3,
    etapeIndex: 3,
    contexte: 'Mission à Paris pour revue semestrielle avec équipe AFD (bailleur principal PUDC-III). 2 participants — 4 jours. Budget mission : vols + hébergement + per diem.',
    piecesJointes: [
      { nom: 'ODM_Paris_AFD.pdf', taille: '190 Ko', ext: 'pdf' },
      { nom: 'Convocation_AFD.pdf', taille: '420 Ko', ext: 'pdf' },
    ],
    historique: [
      { etape: 'Demande', acteur: 'Dir. Projets', date: '2026-05-24', decision: 'approuve' },
      { etape: 'Visa RH', acteur: 'DRH', date: '2026-05-24', decision: 'approuve' },
    ],
    slaHeures: 48,
    heuresRestantes: 8,
  },
];

/* ─── Config types ──────────────────────────────────── */
const TYPE_CFG: Record<TypeDossier, { label: string; color: string; bg: string; icon: React.ReactNode }> = {
  facture:     { label: 'Facture',         color: C.navy,   bg: '#EFF6FF', icon: <Banknote size={13} /> },
  odm:         { label: 'Ordre de mission', color: C.orange, bg: '#FFF7ED', icon: <Truck size={13} /> },
  pv_reception:{ label: 'PV Réception',    color: C.green,  bg: '#F0FDF4', icon: <ClipboardCheck size={13} /> },
  marche:      { label: 'Marché',          color: C.purple, bg: '#F5F3FF', icon: <Building2 size={13} /> },
  rapport:     { label: 'Rapport',         color: C.slate,  bg: '#F8FAFC', icon: <FileText size={13} /> },
  avenant:     { label: 'Avenant',         color: C.amber,  bg: '#FFFBEB', icon: <FileText size={13} /> },
  courrier:    { label: 'Courrier',        color: '#0891B2', bg: '#ECFEFF', icon: <FileText size={13} /> },
  note:        { label: 'Note de service', color: '#7C3AED', bg: '#F5F3FF', icon: <FileText size={13} /> },
  autre:       { label: 'Autre',           color: C.slate,  bg: '#F8FAFC', icon: <FileText size={13} /> },
};

const PRIO_CFG: Record<PrioriteDossier, { label: string; color: string; bg: string }> = {
  urgent: { label: 'URGENT',  color: C.red,   bg: '#FEE2E2' },
  haute:  { label: 'Haute',   color: C.amber, bg: '#FFF7ED' },
  normale:{ label: 'Normale', color: C.slate, bg: '#F1F5F9' },
};

const EXT_COLOR: Record<string, string> = { pdf: '#EF4444', docx: C.navy, xlsx: C.green, png: C.purple, dwg: '#0891B2' };

/* ─── Helpers ───────────────────────────────────────── */
function slaColor(h: number): string {
  if (h <= 6)  return C.red;
  if (h <= 24) return C.amber;
  return C.green;
}

function slaLabel(h: number): string {
  if (h < 24) return `${h}h restantes`;
  return `${Math.floor(h / 24)}j ${h % 24}h`;
}

/* ═══════════════════════════════════════════════════════
   COMPOSANT DOSSIER CARD
═══════════════════════════════════════════════════════ */
function DossierCard({
  dossier,
  selected,
  onSelect,
}: {
  dossier: DossierValidation;
  selected: boolean;
  onSelect: () => void;
}) {
  const tc = TYPE_CFG[dossier.type];
  const pc = PRIO_CFG[dossier.priorite];
  const sc = slaColor(dossier.heuresRestantes);

  return (
    <div
      onClick={onSelect}
      style={{
        padding: '14px 16px',
        background: selected ? '#EFF6FF' : '#fff',
        borderLeft: selected ? `3px solid ${C.navy}` : '3px solid transparent',
        borderBottom: `1px solid ${C.border}`,
        cursor: 'pointer',
        transition: 'background 0.15s',
      }}
      onMouseEnter={e => { if (!selected) (e.currentTarget as HTMLDivElement).style.background = '#FAFBFF'; }}
      onMouseLeave={e => { if (!selected) (e.currentTarget as HTMLDivElement).style.background = '#fff'; }}
    >
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}>
        {/* Type icon */}
        <div style={{ width: 32, height: 32, borderRadius: 8, background: tc.bg, display: 'flex', alignItems: 'center', justifyContent: 'center', color: tc.color, flexShrink: 0 }}>
          {tc.icon}
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          {/* Row 1 : ref + priorité */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 3 }}>
            <span style={{ fontSize: 10, fontWeight: 700, color: '#94A3B8', fontFamily: 'monospace' }}>{dossier.reference}</span>
            {dossier.priorite !== 'normale' && (
              <span style={{ fontSize: 9, fontWeight: 800, color: pc.color, background: pc.bg, padding: '1px 6px', borderRadius: 10, textTransform: 'uppercase' }}>{pc.label}</span>
            )}
            <span style={{ fontSize: 9, color: sc, fontWeight: 700, marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 3 }}>
              <Clock size={9} /> {slaLabel(dossier.heuresRestantes)}
            </span>
          </div>
          {/* Titre */}
          <div style={{ fontSize: 12.5, fontWeight: 600, color: '#1E293B', marginBottom: 4, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {dossier.titre}
          </div>
          {/* Projet + étape */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 10.5, color: '#94A3B8' }}>
            <span style={{ fontWeight: 600, color: C.navy }}>{dossier.projetCode}</span>
            <ChevronRight size={9} />
            <span>{dossier.etapeActuelle}</span>
            <span style={{ marginLeft: 'auto', fontSize: 9 }}>
              Étape {dossier.etapeIndex}/{dossier.nombreEtapes}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════
   PANNEAU DÉTAIL
═══════════════════════════════════════════════════════ */
function DetailPanel({
  dossier,
  onDecision,
  setDossiers, // Added setDossiers prop
}: {
  setDossiers: React.Dispatch<React.SetStateAction<DossierValidation[]>>; // Explicitly define setDossiers prop
  dossier: DossierValidation;
  onDecision: (id: string, decision: 'approuve' | 'rejete' | 'delegue') => void;
}) {
  const [commentaire, setCommentaire] = useState('');
  const [showComment, setShowComment] = useState(false);
  const [viewDoc, setViewDoc] = useState<AnnotatedDoc | null>(null);
  const [extraPieces, setExtraPieces] = useState<PieceJointe[]>([]);
  const [isSigning, setIsSigning] = useState(false);
  const { addNotification } = useNotificationStore();
  const [signatureHash, setSignatureHash] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const tc = TYPE_CFG[dossier.type];
  const pc = PRIO_CFG[dossier.priorite];

  const isPV = dossier.type === 'pv_reception';

  const allPieces = [...dossier.piecesJointes, ...extraPieces];
  const handleAttach = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (!f) return;
    const ext = (f.name.split('.').pop() ?? 'pdf').toLowerCase();
    // badge type (icône) — on rattache les variantes au type connu le plus proche
    const badgeExt = (
      ['png', 'jpg', 'jpeg', 'gif', 'bmp', 'svg', 'webp'].includes(ext) ? 'png' :
      ['doc', 'docx'].includes(ext) ? 'docx' :
      ['xls', 'xlsx', 'csv'].includes(ext) ? 'xlsx' :
      ['dwg', 'dxf', 'dgn'].includes(ext) ? 'dwg' : 'pdf'
    ) as PieceJointe['ext'];
    const sizeKb = f.size / 1024;
    const taille = sizeKb > 1024 ? `${(sizeKb / 1024).toFixed(1)} Mo` : `${Math.round(sizeKb)} Ko`;
    const apply = (fileUrl: string) => {
      setExtraPieces(prev => [...prev, { nom: f.name, taille, ext: badgeExt, url: fileUrl }]);
      // Ouvre immédiatement le document dans l'annotateur — on passe l'extension réelle
      setViewDoc({ nom: f.name, ext, taille, url: fileUrl });
    };
    // DATA URL (base64) : affichage fiable + persistance (un blob URL meurt au rechargement).
    const reader = new FileReader();
    reader.onload = () => apply(typeof reader.result === 'string' ? reader.result : URL.createObjectURL(f));
    reader.onerror = () => apply(URL.createObjectURL(f));
    reader.readAsDataURL(f);
    e.target.value = '';
  };

  const handleSign = () => {
    setIsSigning(true);
    // Simulation horodatage Blockchain
    setTimeout(() => {
      const hash = '0x' + Array.from({length: 40}, () => Math.floor(Math.random() * 16).toString(16)).join('');
      setSignatureHash(hash);
      setIsSigning(false);
      setDossiers(prev => prev.map(d => d.id === dossier.id ? { ...d, signatureHash: hash, signatureTimestamp: new Date().toLocaleString('fr-FR') } : d)); // Update dossier in parent state
      addNotification({
        type: 'success',
        title: 'Document certifié !',
        message: `Le document "${dossier.titre}" a été signé et scellé sur la blockchain. TxHash: ${hash.substring(0, 10)}...`,
      });
    }, 2500);
  };

  const progress = (dossier.etapeIndex / dossier.nombreEtapes) * 100;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', background: '#fff' }}>
      {/* En-tête dossier */}
      <div style={{ padding: '20px 24px', borderBottom: `1px solid ${C.border}`, background: '#FAFBFF' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
          <div style={{ width: 38, height: 38, borderRadius: 10, background: tc.bg, display: 'flex', alignItems: 'center', justifyContent: 'center', color: tc.color }}>
            {tc.icon}
          </div>
          <div style={{ flex: 1 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{ fontSize: 11, fontWeight: 700, color: tc.color, background: tc.bg, padding: '2px 8px', borderRadius: 6 }}>{tc.label}</span>
              <span style={{ fontSize: 10.5, fontWeight: 700, color: '#94A3B8', fontFamily: 'monospace' }}>{dossier.reference}</span>
              {dossier.priorite !== 'normale' && (
                <span style={{ fontSize: 9.5, fontWeight: 800, color: pc.color, background: pc.bg, padding: '2px 8px', borderRadius: 10, textTransform: 'uppercase' }}>{pc.label}</span>
              )}
            </div>
            <div style={{ fontSize: 15, fontWeight: 800, color: '#1E293B', marginTop: 3 }}>{dossier.titre}</div>
          </div>
        </div>

        {/* Méta */}
        <div style={{ display: 'flex', gap: 20, fontSize: 11, color: '#64748B' }}>
          <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
            <User size={10} /> {dossier.soumetteur}
          </span>
          <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
            <Calendar size={10} /> Soumis le {new Date(dossier.dateCreation).toLocaleDateString('fr-FR')}
          </span>
          <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
            <Flag size={10} /> Limite : {new Date(dossier.dateLimite).toLocaleDateString('fr-FR')}
          </span>
          {dossier.montant ? (
            <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
              <Banknote size={10} /> {dossier.montant.toLocaleString('fr-FR')} {dossier.devise}
            </span>
          ) : null}
          <span style={{ display: 'flex', alignItems: 'center', gap: 4, color: slaColor(dossier.heuresRestantes), fontWeight: 700 }}>
            <Clock size={10} /> {slaLabel(dossier.heuresRestantes)}
          </span>
        </div>

        {/* Progression circuit */}
        <div style={{ marginTop: 14 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 10.5, color: '#94A3B8', marginBottom: 4 }}>
            <span>Circuit de validation — Étape {dossier.etapeIndex}/{dossier.nombreEtapes}</span>
            <span style={{ fontWeight: 700, color: C.navy }}>{dossier.etapeActuelle}</span>
          </div>
          <div style={{ height: 6, background: '#F1F5F9', borderRadius: 3, overflow: 'hidden' }}>
            <div style={{ height: '100%', width: `${progress}%`, background: `linear-gradient(90deg, ${C.navy}, ${C.orange})`, borderRadius: 3, transition: 'width 0.6s ease' }} />
          </div>
        </div>
      </div>

      {/* Corps scrollable */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '20px 24px', display: 'flex', flexDirection: 'column', gap: 18 }}>

        {/* Contexte métier */}
        <div>
          <div style={{ fontSize: 11.5, fontWeight: 700, color: '#475569', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 8 }}>Contexte métier</div>
          <div style={{ fontSize: 13, color: '#374151', lineHeight: 1.65, background: '#F8FAFC', borderRadius: 8, padding: '12px 14px', border: `1px solid ${C.border}` }}>
            {dossier.contexte}
          </div>
        </div>

        {/* Pièces jointes */}
        <div>
          <div style={{ fontSize: 11.5, fontWeight: 700, color: '#475569', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 8, display: 'flex', alignItems: 'center', gap: 6 }}>
            <Paperclip size={11} /> Pièces jointes ({allPieces.length})
            <input ref={fileInputRef} type="file" style={{ display: 'none' }} onChange={handleAttach}
              accept=".pdf,.doc,.docx,.xls,.xlsx,.csv,.txt,.png,.jpg,.jpeg,.gif,.bmp,.svg,.webp,.ppt,.pptx,.dwg,.dxf,.dgn" />
            <button onClick={() => fileInputRef.current?.click()}
              style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 4, padding: '4px 10px', borderRadius: 6, border: `1px solid ${C.orange}`, background: `${C.orange}12`, color: C.orange, fontSize: 11, fontWeight: 700, cursor: 'pointer', textTransform: 'none', letterSpacing: 0 }}>
              <Plus size={12} /> Joindre un document
            </button>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {allPieces.map((pj, i) => (
              <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 12px', background: '#F8FAFC', borderRadius: 8, border: `1px solid ${C.border}` }}>
                <div style={{ width: 28, height: 28, borderRadius: 6, background: `${EXT_COLOR[pj.ext] ?? C.slate}15`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                  <span style={{ fontSize: 8, fontWeight: 800, color: EXT_COLOR[pj.ext] ?? C.slate, textTransform: 'uppercase' }}>{pj.ext}</span>
                </div>
                <div style={{ flex: 1, fontSize: 12 }}>
                  <div style={{ fontWeight: 600, color: '#1E293B' }}>{pj.nom}</div>
                  <div style={{ fontSize: 10.5, color: '#94A3B8' }}>{pj.taille}</div>
                </div>
                <button onClick={() => setViewDoc({ nom: pj.nom, ext: pj.ext, taille: pj.taille, url: pj.url })}
                  style={{ background: 'none', border: 'none', cursor: 'pointer', color: C.navy, display: 'flex', alignItems: 'center', gap: 4, fontSize: 11.5, fontWeight: 600, padding: '4px 8px', borderRadius: 6 }}>
                  <Eye size={12} /> Ouvrir & annoter
                </button>
              </div>
            ))}
          </div>
        </div>

        {/* Visionneuse / annotation in-app */}
        {viewDoc && <DocumentAnnotator doc={viewDoc} onClose={() => setViewDoc(null)} />}

        {/* Historique circuit */}
        <div>
          <div style={{ fontSize: 11.5, fontWeight: 700, color: '#475569', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 10 }}>Historique du circuit</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
            {dossier.historique.map((h, i) => (
              <div key={i} style={{ display: 'flex', gap: 12, position: 'relative' }}>
                {i < dossier.historique.length - 1 && (
                  <div style={{ position: 'absolute', left: 14, top: 28, bottom: 0, width: 2, background: '#F1F5F9' }} />
                )}
                <div style={{ width: 28, height: 28, borderRadius: '50%', background: h.decision === 'approuve' ? '#DCFCE7' : h.decision === 'rejete' ? '#FEE2E2' : '#EFF6FF', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, marginTop: 4 }}>
                  {h.decision === 'approuve' ? <CheckCircle2 size={13} style={{ color: C.green }} /> : h.decision === 'rejete' ? <XCircle size={13} style={{ color: C.red }} /> : <Clock size={13} style={{ color: C.navy }} />}
                </div>
                <div style={{ flex: 1, paddingBottom: 14 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 2 }}>
                    <span style={{ fontSize: 12.5, fontWeight: 600, color: '#1E293B' }}>{h.etape}</span>
                    <span style={{ fontSize: 10, color: '#94A3B8' }}>{h.date}</span>
                  </div>
                  <div style={{ fontSize: 11.5, color: '#64748B' }}>{h.acteur}</div>
                  {h.commentaire && (
                    <div style={{ fontSize: 11, color: '#64748B', background: '#F8FAFC', borderRadius: 6, padding: '5px 8px', marginTop: 5, fontStyle: 'italic' }}>
                      « {h.commentaire} »
                    </div>
                  )}
                </div>
              </div>
            ))}
            {/* Étape courante */}
            <div style={{ display: 'flex', gap: 12 }}>
              <div style={{ width: 28, height: 28, borderRadius: '50%', background: `${C.orange}20`, border: `2px solid ${C.orange}`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, marginTop: 4, animation: 'pulse 2s infinite' }}>
                <Clock size={13} style={{ color: C.orange }} />
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 12.5, fontWeight: 700, color: C.orange }}>{dossier.etapeActuelle}</div>
                <div style={{ fontSize: 11, color: '#94A3B8' }}>En attente de votre décision</div>
              </div>
            </div>
          </div>
        </div>

        {/* Commentaire */}
        {showComment && (
          <div>
            <div style={{ fontSize: 11.5, fontWeight: 700, color: '#475569', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 8 }}>Commentaire</div>
            <textarea
              value={commentaire}
              onChange={e => setCommentaire(e.target.value)}
              placeholder="Motivez votre décision (obligatoire pour un rejet)…"
              style={{ width: '100%', minHeight: 80, padding: '10px 12px', borderRadius: 8, border: `1px solid ${C.border}`, fontSize: 12.5, fontFamily: 'inherit', resize: 'vertical', boxSizing: 'border-box', outline: 'none', lineHeight: 1.5 }}
            />
          </div>
        )}

        {signatureHash && (
          <div style={{ background: '#F0FDF4', border: '1.5px solid #16A34A', borderRadius: 10, padding: '14px', marginTop: 10 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, color: '#166534' }}>
              <Shield size={18} />
              <div>
                <div style={{ fontSize: 13, fontWeight: 800 }}>Document certifié par Blockchain SENELEC</div>
                <div style={{ fontSize: 10, fontFamily: 'monospace', wordBreak: 'break-all', marginTop: 4, opacity: 0.8 }}>
                  TxHash: {signatureHash}
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Barre décision */}
      <div style={{ padding: '16px 24px', borderTop: `1px solid ${C.border}`, background: '#FAFBFF', display: 'flex', gap: 10, alignItems: 'center', flexShrink: 0 }}>
        <button
          onClick={() => setShowComment(v => !v)}
          style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 14px', borderRadius: 8, border: `1px solid ${C.border}`, background: '#fff', fontSize: 12.5, color: '#475569', cursor: 'pointer', fontFamily: 'inherit' }}
        >
          <MessageSquare size={13} /> Commenter
        </button>
        <button
          onClick={() => onDecision(dossier.id, 'delegue')}
          style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 14px', borderRadius: 8, border: `1px solid ${C.border}`, background: '#fff', fontSize: 12.5, color: C.slate, cursor: 'pointer', fontFamily: 'inherit' }}
        >
          <RotateCcw size={13} /> Déléguer
        </button>
        <div style={{ flex: 1 }} />
        <button
          onClick={() => onDecision(dossier.id, 'rejete')}
          style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '9px 18px', borderRadius: 8, border: `1px solid ${C.red}`, background: '#FEF2F2', fontSize: 12.5, fontWeight: 700, color: C.red, cursor: 'pointer', fontFamily: 'inherit' }}
        >
          <XCircle size={14} /> Rejeter
        </button>
        <button
          onClick={() => onDecision(dossier.id, 'approuve')}
          style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '9px 20px', borderRadius: 8, border: 'none', background: C.green, fontSize: 13, fontWeight: 700, color: '#fff', cursor: 'pointer', fontFamily: 'inherit', boxShadow: '0 2px 8px rgba(22,163,74,0.35)' }}
        >
          <CheckCircle2 size={14} /> Approuver
        </button>
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════
   COMPOSANT PRINCIPAL
═══════════════════════════════════════════════════════ */
/* ─── Workflow Builder Types ─────────────────────────────── */
interface WfStep {
  id: string; label: string; role: string; action: string;
  slaHeures: number; condition: string; ordre: number;
  /** E-mail du profil impliqué — notifié (in-app + mail) quand c'est son tour. */
  assigneeEmail?: string;
  /** Nom de la personne/profil affecté à cette étape. */
  assigneeNom?: string;
}
interface WorkflowTemplate {
  id: string; nom: string; type: TypeDossier; description: string;
  steps: WfStep[]; actif: boolean; createdAt: string;
}

const DEFAULT_TEMPLATES: WorkflowTemplate[] = [
  {
    id: 'wf1', nom: 'Circuit Validation Factures', type: 'facture', actif: true, createdAt: '2026-01-10',
    description: 'Circuit standard de validation des factures fournisseurs — 4 étapes',
    steps: [
      { id: 's1', label: 'Contrôle pièces justificatives', role: 'UAGL', action: 'vérifier', slaHeures: 24, condition: 'Toujours', ordre: 1, assigneeEmail: 'uagl@dpe.sn', assigneeNom: 'Geneviève SAGNA' },
      { id: 's2', label: 'Visa Chef de Projet', role: 'CHEF_PROJ', action: 'approuver', slaHeures: 48, condition: 'Montant > 0 FCFA', ordre: 2, assigneeEmail: 'chef.projet@dpe.sn', assigneeNom: 'Maodo SENE' },
      { id: 's3', label: 'Validation DAF', role: 'CTRL_FIN', action: 'approuver', slaHeures: 72, condition: 'Montant > 50 MFCFA', ordre: 3, assigneeEmail: 'finance@dpe.sn', assigneeNom: 'Yacine GUEYE' },
      { id: 's4', label: 'Ordre de paiement DG', role: 'DIR_DPE', action: 'signer', slaHeures: 24, condition: 'Montant > 500 MFCFA', ordre: 4, assigneeEmail: 'directeur@dpe.sn', assigneeNom: 'Djiby DIENG' },
    ]
  },
  {
    id: 'wf2', nom: 'Validation ODM', type: 'odm', actif: true, createdAt: '2026-01-15',
    description: 'Circuit Ordre de Mission — accord RH + validation directeur',
    steps: [
      { id: 's1', label: 'Soumission demande ODM', role: 'CHEF_DEPT', action: 'soumettre', slaHeures: 0, condition: 'Toujours', ordre: 1, assigneeEmail: 'chef.dept@dpe.sn', assigneeNom: 'Modou NDIAYE' },
      { id: 's2', label: 'Vérification disponibilité agents', role: 'RESP_LOG', action: 'vérifier', slaHeures: 24, condition: 'Toujours', ordre: 2, assigneeEmail: 'uagl@dpe.sn', assigneeNom: 'Geneviève SAGNA' },
      { id: 's3', label: 'Validation directeur', role: 'DIR_DPE', action: 'approuver', slaHeures: 48, condition: 'Durée > 5 jours ou Budget > 1 MFCFA', ordre: 3, assigneeEmail: 'directeur@dpe.sn', assigneeNom: 'Djiby DIENG' },
    ]
  },
  {
    id: 'wf3', nom: 'Approbation Marché', type: 'marche', actif: true, createdAt: '2026-02-01',
    description: 'Circuit complet approbation marchés — 6 étapes réglementaires',
    steps: [
      { id: 's1', label: 'Constitution dossier AO', role: 'CHEF_PROJ', action: 'préparer', slaHeures: 0, condition: 'Toujours', ordre: 1, assigneeEmail: 'chef.projet@dpe.sn', assigneeNom: 'Maodo SENE' },
      { id: 's2', label: 'Validation DAJ — Conformité légale', role: 'DAJ', action: 'vérifier', slaHeures: 72, condition: 'Toujours', ordre: 2 },
      { id: 's3', label: 'Évaluation technique des offres', role: 'Bureau études', action: 'évaluer', slaHeures: 120, condition: 'Toujours', ordre: 3, assigneeEmail: 'ingenieur@dpe.sn', assigneeNom: 'Cheikh FALL' },
      { id: 's4', label: 'Évaluation financière', role: 'CTRL_FIN', action: 'analyser', slaHeures: 48, condition: 'Toujours', ordre: 4, assigneeEmail: 'finance@dpe.sn', assigneeNom: 'Yacine GUEYE' },
      { id: 's5', label: 'Avis ARMP si requis', role: 'ARMP', action: 'avis', slaHeures: 336, condition: 'Montant > 500 MFCFA', ordre: 5 },
      { id: 's6', label: 'Approbation DG', role: 'DIR_DPE', action: 'approuver', slaHeures: 48, condition: 'Toujours', ordre: 6, assigneeEmail: 'directeur@dpe.sn', assigneeNom: 'Djiby DIENG' },
    ]
  },
];

const ROLES_WF = ['DIR_DPE', 'PMO', 'CHEF_PROJ', 'CTRL_FIN', 'CHEF_DEPT', 'RESP_LOG', 'DAJ', 'DAF', 'UAGL', 'Bureau études', 'ARMP', 'Commission réception'];
const ACTIONS_WF = ['approuver', 'vérifier', 'signer', 'soumettre', 'analyser', 'évaluer', 'préparer', 'avis', 'certifier'];
const CONDITIONS_WF = ['Toujours', 'Montant > 50 MFCFA', 'Montant > 200 MFCFA', 'Montant > 500 MFCFA', 'Durée > 5 jours', 'International', 'Sur dérogation'];

/** Annuaire DPE pour choisir l'acteur d'une étape (remplit nom + e-mail automatiquement). */
const ANNUAIRE_DPE = (() => {
  const seen = new Set<string>();
  return TEST_USERS
    .filter(u => u.email && !seen.has(u.email.toLowerCase()) && seen.add(u.email.toLowerCase()))
    .map(u => ({
      value: u.email,
      label: `${u.prenom} ${u.nom}`,
      sub: `${u.poste ?? u.role} · ${u.email}`,
      keywords: `${u.role} ${u.poste ?? ''} ${u.email}`,
    }))
    .sort((a, b) => a.label.localeCompare(b.label, 'fr'));
})();

export default function Workflows() {
  const [dossiers, setDossiers]         = useState<DossierValidation[]>(DOSSIERS);
  const [selectedId, setSelectedId]     = useState<string>(DOSSIERS[0].id);
  const [filterType, setFilterType]     = useState<TypeDossier | 'all'>('all');
  const [filterPrio, setFilterPrio]     = useState<PrioriteDossier | 'all'>('all');
  const [search, setSearch]             = useState('');
  const [decisions, setDecisions]       = useState<Record<string, { decision: string; at: string }>>({});

  // Workflow builder state
  const [activeTab, setActiveTab]       = useState<'parapheur' | 'builder' | 'modeles'>('parapheur');
  const [templates, setTemplates]       = useState<WorkflowTemplate[]>(DEFAULT_TEMPLATES);
  const [editingWf, setEditingWf]       = useState<WorkflowTemplate | null>(null);
  const [showWfModal, setShowWfModal]   = useState(false);
  const [wfForm, setWfForm]             = useState({ nom: '', type: 'facture' as TypeDossier, description: '' });
  const [editingStep, setEditingStep]   = useState<WfStep | null>(null);
  const [stepForm, setStepForm]         = useState({ label: '', role: 'CHEF_PROJ', action: 'approuver', slaHeures: 48, condition: 'Toujours', ordre: 1, assigneeEmail: '', assigneeNom: '' });
  const [showNewDossier, setShowNewDossier] = useState(false);
  const [ndForm, setNdForm]             = useState({ titre: '', type: 'courrier' as TypeDossier, projet: '', soumetteur: '', priorite: 'normale' as PrioriteDossier });
  const [ndFiles, setNdFiles]           = useState<PieceJointe[]>([]); // pièces jointes du nouveau dossier
  const ndFileRef = useRef<HTMLInputElement | null>(null);

  const { addNotification, notifyUser } = useNotificationStore();

  /** Ajoute un/des document(s) au nouveau dossier (base64 persistant). */
  const handleNdAttach = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || !files.length) return;
    Array.from(files).forEach(f => {
      const ext = (f.name.split('.').pop() ?? 'pdf').toLowerCase();
      const badgeExt = (
        ['png', 'jpg', 'jpeg', 'gif', 'bmp', 'svg', 'webp'].includes(ext) ? 'png' :
        ['doc', 'docx'].includes(ext) ? 'docx' :
        ['xls', 'xlsx', 'csv'].includes(ext) ? 'xlsx' :
        ['dwg', 'dxf', 'dgn'].includes(ext) ? 'dwg' : 'pdf'
      ) as PieceJointe['ext'];
      const sizeKb = f.size / 1024;
      const taille = sizeKb > 1024 ? `${(sizeKb / 1024).toFixed(1)} Mo` : `${Math.round(sizeKb)} Ko`;
      const reader = new FileReader();
      const apply = (url: string) => setNdFiles(prev => [...prev, { nom: f.name, taille, ext: badgeExt, url }]);
      reader.onload = () => apply(typeof reader.result === 'string' ? reader.result : URL.createObjectURL(f));
      reader.onerror = () => apply(URL.createObjectURL(f));
      reader.readAsDataURL(f);
    });
    e.target.value = '';
  };

  /** Trouve le modèle de circuit applicable à un type de dossier (actif en priorité). */
  const templateForType = (type: TypeDossier) =>
    templates.find(t => t.type === type && t.actif) ?? templates.find(t => t.type === type);

  const creerDossier = () => {
    if (!ndForm.titre.trim()) return;
    const tc = TYPE_CFG[ndForm.type];
    const tpl = templateForType(ndForm.type);
    const steps = tpl?.steps ?? [];
    const firstStep = steps[0];
    const nouveau: DossierValidation = {
      id: `dos-${Date.now()}`,
      type: ndForm.type,
      reference: `${ndForm.type.toUpperCase().slice(0, 3)}-${new Date().getFullYear()}-${String(Math.floor(Math.random() * 900) + 100)}`,
      titre: ndForm.titre.trim(),
      projet: ndForm.projet.trim() || 'Direction Principale Équipement',
      projetCode: 'DPE',
      soumetteur: ndForm.soumetteur.trim() || 'Maodo SENE',
      dateCreation: new Date().toISOString().slice(0, 10),
      dateLimite: new Date(Date.now() + 5 * 864e5).toISOString().slice(0, 10),
      priorite: ndForm.priorite,
      statut: 'en_attente',
      etapeActuelle: firstStep?.label ?? 'Contrôle initial',
      nombreEtapes: steps.length || 3, etapeIndex: steps.length ? 1 : 0,
      contexte: `${tc.label} ajouté au parapheur${ndFiles.length ? ` avec ${ndFiles.length} pièce(s) jointe(s)` : ''}.`,
      piecesJointes: ndFiles,
      historique: [],
      slaHeures: firstStep?.slaHeures || 72, heuresRestantes: firstStep?.slaHeures || 72,
    };
    setDossiers(prev => [nouveau, ...prev]);
    setSelectedId(nouveau.id);
    setShowNewDossier(false);
    setNdForm({ titre: '', type: 'courrier', projet: '', soumetteur: '', priorite: 'normale' });
    setNdFiles([]);
    // Notifie le 1er acteur du circuit (in-app + e-mail)
    if (firstStep?.assigneeEmail) {
      notifyUser({
        recipientEmail: firstStep.assigneeEmail,
        title: `Nouveau dossier à traiter : ${nouveau.titre}`,
        message: `Le dossier ${nouveau.reference} attend votre action « ${firstStep.action} » — étape « ${firstStep.label} ».`,
        type: 'warning', link: '/workflows', source: 'workflow', ref: nouveau.reference,
      });
      addNotification({ type: 'success', title: 'Circuit déclenché', message: `${firstStep.assigneeNom || firstStep.assigneeEmail} notifié(e) par e-mail + notification.` });
    } else if (tpl) {
      addNotification({ type: 'info', title: 'Dossier créé', message: `Aucun e-mail défini pour la 1re étape « ${firstStep?.label ?? ''} ». Renseignez-le dans le Constructeur.` });
    } else {
      addNotification({ type: 'info', title: 'Dossier créé', message: `Aucun circuit actif pour « ${tc.label} ». Créez-en un dans le Constructeur.` });
    }
  };

  const pending = dossiers.filter(d => d.statut === 'en_attente');
  const urgents = pending.filter(d => d.priorite === 'urgent');
  const slaRouge = pending.filter(d => d.heuresRestantes <= 6);

  const filtered = useMemo(() => {
    return pending
      .filter(d => filterType === 'all' || d.type === filterType)
      .filter(d => filterPrio === 'all' || d.priorite === filterPrio)
      .filter(d => !search || d.titre.toLowerCase().includes(search.toLowerCase()) || d.reference.toLowerCase().includes(search.toLowerCase()) || d.projetCode.toLowerCase().includes(search.toLowerCase()))
      .sort((a, b) => a.heuresRestantes - b.heuresRestantes);
  }, [pending, filterType, filterPrio, search]);

  const selected = dossiers.find(d => d.id === selectedId) ?? dossiers[0];

  function handleDecision(id: string, decision: 'approuve' | 'rejete' | 'delegue') {
    const d = dossiers.find(x => x.id === id);
    if (!d) return;
    const now = new Date().toLocaleString('fr-FR');
    setDecisions(prev => ({ ...prev, [id]: { decision, at: new Date().toLocaleTimeString('fr-FR') } }));

    const steps = templateForType(d.type)?.steps ?? [];

    if (decision === 'approuve') {
      const nextIndex = d.etapeIndex + 1;
      const histEntry: HistoriqueEtape = { etape: d.etapeActuelle, acteur: 'Vous', date: now, decision: 'approuve' };

      if (nextIndex <= d.nombreEtapes) {
        // Avance au prochain acteur du circuit
        const nextStep = steps[nextIndex - 1];
        const nextLabel = nextStep?.label ?? `Étape ${nextIndex}`;
        setDossiers(prev => prev.map(x => x.id === id ? {
          ...x, etapeIndex: nextIndex, etapeActuelle: nextLabel, statut: 'en_attente',
          slaHeures: nextStep?.slaHeures || x.slaHeures, heuresRestantes: nextStep?.slaHeures || x.heuresRestantes,
          historique: [...x.historique, histEntry],
        } : x));
        if (nextStep?.assigneeEmail) {
          notifyUser({
            recipientEmail: nextStep.assigneeEmail,
            title: `À traiter : ${d.titre}`,
            message: `Le dossier ${d.reference} attend votre action « ${nextStep.action} » — étape « ${nextLabel} ».`,
            type: 'warning', link: '/workflows', source: 'workflow', ref: d.reference,
          });
          addNotification({ type: 'success', title: 'Étape validée', message: `Transmis à ${nextStep.assigneeNom || nextStep.assigneeEmail} (e-mail + notification).` });
        } else {
          addNotification({ type: 'success', title: 'Étape validée', message: `Dossier transmis à l'étape « ${nextLabel} ». Aucun e-mail défini pour cet acteur.` });
        }
        return;
      }

      // Dernière étape : circuit terminé
      setDossiers(prev => prev.map(x => x.id === id ? { ...x, statut: 'approuve', etapeIndex: x.nombreEtapes, historique: [...x.historique, histEntry] } : x));
      addNotification({ type: 'success', title: 'Dossier approuvé', message: `${d.reference} — circuit de validation terminé.` });
      const next = filtered.find(x => x.id !== id);
      if (next) setSelectedId(next.id);
      return;
    }

    // Rejet ou délégation : clôture le dossier dans la file
    const decLabel = decision === 'rejete' ? 'rejeté' : 'délégué';
    setDossiers(prev => prev.map(x => x.id === id ? {
      ...x, statut: decision === 'rejete' ? 'rejete' : 'delegue',
      historique: [...x.historique, { etape: x.etapeActuelle, acteur: 'Vous', date: now, decision }],
    } : x));
    addNotification({ type: decision === 'rejete' ? 'error' : 'info', title: `Dossier ${decLabel}`, message: `${d.reference} a été ${decLabel}.` });
    const next = filtered.find(x => x.id !== id);
    if (next) setSelectedId(next.id);
  }

  /* ── Builder helpers ── */
  function openNewWfModal() {
    setWfForm({ nom: '', type: 'facture', description: '' });
    setShowWfModal(true);
  }

  function createWorkflow() {
    if (!wfForm.nom.trim()) return;
    const newWf: WorkflowTemplate = {
      id: `wf${Date.now()}`,
      nom: wfForm.nom,
      type: wfForm.type,
      description: wfForm.description,
      steps: [],
      actif: false,
      createdAt: new Date().toISOString().split('T')[0],
    };
    setTemplates(prev => [...prev, newWf]);
    setEditingWf(newWf);
    setShowWfModal(false);
    setActiveTab('builder');
  }

  function addStep() {
    if (!editingWf) return;
    const newStep: WfStep = {
      id: `s${Date.now()}`,
      label: stepForm.label || `Étape ${editingWf.steps.length + 1}`,
      role: stepForm.role,
      action: stepForm.action,
      slaHeures: stepForm.slaHeures,
      condition: stepForm.condition,
      ordre: editingWf.steps.length + 1,
      assigneeEmail: stepForm.assigneeEmail.trim() || undefined,
      assigneeNom: stepForm.assigneeNom.trim() || undefined,
    };
    const updated = { ...editingWf, steps: [...editingWf.steps, newStep] };
    setEditingWf(updated);
    setTemplates(prev => prev.map(t => t.id === updated.id ? updated : t));
    setStepForm({ label: '', role: 'CHEF_PROJ', action: 'approuver', slaHeures: 48, condition: 'Toujours', ordre: updated.steps.length + 1, assigneeEmail: '', assigneeNom: '' });
  }

  function updateStep(stepId: string) {
    if (!editingWf) return;
    const updatedSteps = editingWf.steps.map(s =>
      s.id === stepId ? { ...s, ...stepForm, id: stepId, assigneeEmail: stepForm.assigneeEmail.trim() || undefined, assigneeNom: stepForm.assigneeNom.trim() || undefined } : s
    );
    const updated = { ...editingWf, steps: updatedSteps };
    setEditingWf(updated);
    setTemplates(prev => prev.map(t => t.id === updated.id ? updated : t));
    setEditingStep(null);
    setStepForm({ label: '', role: 'CHEF_PROJ', action: 'approuver', slaHeures: 48, condition: 'Toujours', ordre: 1, assigneeEmail: '', assigneeNom: '' });
  }

  function removeStep(stepId: string) {
    if (!editingWf) return;
    const updatedSteps = editingWf.steps
      .filter(s => s.id !== stepId)
      .map((s, i) => ({ ...s, ordre: i + 1 }));
    const updated = { ...editingWf, steps: updatedSteps };
    setEditingWf(updated);
    setTemplates(prev => prev.map(t => t.id === updated.id ? updated : t));
  }

  function moveStep(stepId: string, dir: 'up' | 'down') {
    if (!editingWf) return;
    const idx = editingWf.steps.findIndex(s => s.id === stepId);
    if (dir === 'up' && idx === 0) return;
    if (dir === 'down' && idx === editingWf.steps.length - 1) return;
    const steps = [...editingWf.steps];
    const swap = dir === 'up' ? idx - 1 : idx + 1;
    [steps[idx], steps[swap]] = [steps[swap], steps[idx]];
    const reordered = steps.map((s, i) => ({ ...s, ordre: i + 1 }));
    const updated = { ...editingWf, steps: reordered };
    setEditingWf(updated);
    setTemplates(prev => prev.map(t => t.id === updated.id ? updated : t));
  }

  function toggleActive(wfId: string) {
    setTemplates(prev => prev.map(t => t.id === wfId ? { ...t, actif: !t.actif } : t));
    if (editingWf?.id === wfId) setEditingWf(prev => prev ? { ...prev, actif: !prev.actif } : prev);
  }

  function duplicateTemplate(wf: WorkflowTemplate) {
    const copy: WorkflowTemplate = {
      ...wf,
      id: `wf${Date.now()}`,
      nom: `${wf.nom} (copie)`,
      actif: false,
      createdAt: new Date().toISOString().split('T')[0],
    };
    setTemplates(prev => [...prev, copy]);
  }

  function deleteTemplate(wfId: string) {
    setTemplates(prev => prev.filter(t => t.id !== wfId));
    if (editingWf?.id === wfId) setEditingWf(null);
  }

  /* ── Tab styles ── */
  const TAB_ITEMS = [
    { id: 'parapheur' as const, label: 'Parapheur BPM', icon: <Stamp size={13} />, badge: pending.length },
    { id: 'builder'   as const, label: 'Constructeur',   icon: <GitBranch size={13} />, badge: 0 },
    { id: 'modeles'   as const, label: 'Modèles',        icon: <Layers size={13} />, badge: templates.length },
  ];

  return (
    // ... (rest of the component)
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', background: C.bg }}>

      {/* ══ Top header bar ══ */}
      <div style={{ background: '#0E3460', padding: '12px 24px', flexShrink: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 24 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <Stamp size={18} style={{ color: '#fff' }} />
            <span style={{ fontSize: 14, fontWeight: 800, color: '#fff' }}>Centre de Validation & Workflow BPM</span>
          </div>
          <div style={{ width: 1, height: 20, background: 'rgba(255,255,255,0.2)' }} />
          {[
            { label: 'En attente', value: pending.length, color: '#fff' },
            { label: 'Urgents', value: urgents.length, color: urgents.length > 0 ? '#FCA5A5' : '#86EFAC' },
            { label: 'SLA < 6h', value: slaRouge.length, color: slaRouge.length > 0 ? '#FCA5A5' : '#86EFAC' },
            { label: 'Traités', value: Object.keys(decisions).length, color: '#86EFAC' },
            { label: 'Workflows actifs', value: templates.filter(t => t.actif).length, color: '#93C5FD' },
          ].map(k => (
            <div key={k.label} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{ fontSize: 22, fontWeight: 800, color: k.color, lineHeight: 1 }}>{k.value}</span>
              <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.65)' }}>{k.label}</span>
            </div>
          ))}
          <div style={{ marginLeft: 'auto' }}>
            <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.6)', display: 'flex', alignItems: 'center', gap: 4 }}>
              <Bell size={11} /> Notifications BPM actives
            </span>
          </div>
        </div>
      </div>

      {/* ══ Tabs ══ */}
      <div style={{ background: '#fff', borderBottom: `1px solid ${C.border}`, padding: '0 24px', display: 'flex', gap: 0, flexShrink: 0 }}>
        {TAB_ITEMS.map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            style={{
              display: 'flex', alignItems: 'center', gap: 7,
              padding: '11px 20px', border: 'none', background: 'none',
              borderBottom: activeTab === tab.id ? `3px solid ${C.navy}` : '3px solid transparent',
              color: activeTab === tab.id ? C.navy : '#64748B',
              fontSize: 13, fontWeight: activeTab === tab.id ? 700 : 500,
              cursor: 'pointer', fontFamily: 'inherit', transition: 'all 0.15s',
            }}
          >
            {tab.icon}
            {tab.label}
            {tab.badge > 0 && (
              <span style={{
                fontSize: 10, fontWeight: 800, minWidth: 18, height: 18,
                background: activeTab === tab.id ? C.navy : '#E2E8F0',
                color: activeTab === tab.id ? '#fff' : '#64748B',
                borderRadius: 9, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '0 5px',
              }}>
                {tab.badge}
              </span>
            )}
          </button>
        ))}
        <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 8 }}>
          {activeTab === 'builder' && (
            <button
              onClick={openNewWfModal}
              style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '7px 14px', borderRadius: 7, border: 'none', background: C.navy, color: '#fff', fontSize: 12.5, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' }}
            >
              <Plus size={13} /> Nouveau workflow
            </button>
          )}
          {activeTab === 'modeles' && (
            <button
              onClick={openNewWfModal}
              style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '7px 14px', borderRadius: 7, border: 'none', background: C.navy, color: '#fff', fontSize: 12.5, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' }}
            >
              <Plus size={13} /> Créer un modèle
            </button>
          )}
        </div>
      </div>

      {/* ══ Contenu selon onglet ══ */}

      {/* ─── PARAPHEUR ─── */}
      {activeTab === 'parapheur' && (
        <div style={{ flex: 1, display: 'grid', gridTemplateColumns: '380px 1fr', overflow: 'hidden' }}>
          {/* ── Liste dossiers ── */}
          <div style={{ display: 'flex', flexDirection: 'column', borderRight: `1px solid ${C.border}`, background: '#fff', overflow: 'hidden' }}>
            <div style={{ padding: '12px 14px', borderBottom: `1px solid ${C.border}`, background: '#FAFBFF', flexShrink: 0 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 7, marginBottom: 8 }}>
                <div style={{ flex: 1, display: 'flex', alignItems: 'center', gap: 7, background: '#fff', border: `1px solid ${C.border}`, borderRadius: 7, padding: '6px 10px' }}>
                  <Search size={12} style={{ color: '#94A3B8' }} />
                  <input
                    value={search}
                    onChange={e => setSearch(e.target.value)}
                    placeholder="Référence, titre, projet…"
                    style={{ flex: 1, border: 'none', outline: 'none', fontSize: 12, fontFamily: 'inherit', color: '#1E293B', background: 'transparent' }}
                  />
                </div>
                <button onClick={() => setShowNewDossier(true)} title="Ajouter un élément au parapheur"
                  style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '6px 11px', borderRadius: 7, border: 'none', background: C.navy, color: '#fff', fontSize: 11.5, fontWeight: 700, cursor: 'pointer', flexShrink: 0 }}>
                  <Plus size={13} /> Nouveau
                </button>
              </div>
              <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap' }}>
                {(['all', 'facture', 'odm', 'pv_reception', 'marche', 'avenant', 'rapport', 'courrier', 'note', 'autre'] as (TypeDossier | 'all')[]).map(t => (
                  <button key={t} onClick={() => setFilterType(t)} style={{
                    padding: '3px 9px', borderRadius: 20, fontSize: 10.5,
                    border: `1px solid ${filterType === t ? C.navy : C.border}`,
                    background: filterType === t ? C.navy : '#fff',
                    color: filterType === t ? '#fff' : '#64748B',
                    cursor: 'pointer', fontFamily: 'inherit', fontWeight: filterType === t ? 700 : 400,
                  }}>
                    {t === 'all' ? `Tous (${pending.length})` : TYPE_CFG[t].label}
                  </button>
                ))}
              </div>
            </div>
            <div style={{ flex: 1, overflowY: 'auto' }}>
              {filtered.length === 0 ? (
                <div style={{ padding: 40, textAlign: 'center', color: '#94A3B8' }}>
                  <CheckCircle2 size={32} style={{ margin: '0 auto 12px', display: 'block', color: C.green }} />
                  <div style={{ fontSize: 13, fontWeight: 600 }}>File d&apos;attente vide</div>
                  <div style={{ fontSize: 11.5, marginTop: 4 }}>Tous les dossiers ont été traités</div>
                </div>
              ) : (
                filtered.map(d => (
                  <DossierCard key={d.id} dossier={d} selected={d.id === selectedId} onSelect={() => setSelectedId(d.id)} />
                ))
              )}
            </div>
          </div>
          {/* ── Panneau détail ── */}
          {selected && selected.statut === 'en_attente' ? (
            <DetailPanel dossier={selected} onDecision={handleDecision} setDossiers={setDossiers} />
          ) : (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', gap: 12, background: '#FAFBFF' }}>
              <CheckCircle2 size={48} style={{ color: decisions[selectedId]?.decision === 'approuve' ? C.green : decisions[selectedId]?.decision === 'rejete' ? C.red : C.amber }} />
              <div style={{ fontSize: 16, fontWeight: 700, color: '#1E293B', textTransform: 'capitalize' }}>
                Dossier {decisions[selectedId]?.decision ?? 'traité'}
              </div>
              <div style={{ fontSize: 12, color: '#94A3B8' }}>à {decisions[selectedId]?.at}</div>
              {filtered.length > 0 && (
                <button onClick={() => setSelectedId(filtered[0].id)} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '9px 18px', borderRadius: 8, border: 'none', background: C.navy, color: '#fff', fontSize: 13, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit', marginTop: 8 }}>
                  Dossier suivant <ArrowRight size={14} />
                </button>
              )}
            </div>
          )}
        </div>
      )}

      {/* ─── CONSTRUCTEUR ─── */}
      {activeTab === 'builder' && (
        <div style={{ flex: 1, display: 'grid', gridTemplateColumns: '260px 1fr', overflow: 'hidden' }}>

          {/* ── Sidebar : liste des modèles ── */}
          <div style={{ borderRight: `1px solid ${C.border}`, background: '#fff', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
            <div style={{ padding: '14px 16px', borderBottom: `1px solid ${C.border}`, background: '#FAFBFF' }}>
              <div style={{ fontSize: 11.5, fontWeight: 700, color: '#475569', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 10 }}>Modèles disponibles</div>
              <button onClick={openNewWfModal} style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 6, padding: '8px 12px', borderRadius: 7, border: `2px dashed ${C.border}`, background: '#F8FAFC', color: '#64748B', fontSize: 12.5, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit', justifyContent: 'center' }}>
                <Plus size={13} /> Nouveau workflow
              </button>
            </div>
            <div style={{ flex: 1, overflowY: 'auto', padding: '8px' }}>
              {templates.map(wf => (
                <div
                  key={wf.id}
                  onClick={() => setEditingWf(wf)}
                  style={{
                    padding: '10px 12px', borderRadius: 8, marginBottom: 4, cursor: 'pointer',
                    background: editingWf?.id === wf.id ? '#EFF6FF' : '#F8FAFC',
                    border: `1px solid ${editingWf?.id === wf.id ? C.navy : C.border}`,
                    transition: 'all 0.15s',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4 }}>
                    <span style={{ fontSize: 10, fontWeight: 700, padding: '2px 7px', borderRadius: 10, background: wf.actif ? '#DCFCE7' : '#F1F5F9', color: wf.actif ? C.green : '#94A3B8' }}>
                      {wf.actif ? '● Actif' : '○ Inactif'}
                    </span>
                    <span style={{ fontSize: 10, color: '#94A3B8', marginLeft: 'auto' }}>{wf.steps.length} étapes</span>
                  </div>
                  <div style={{ fontSize: 12.5, fontWeight: 700, color: '#1E293B', marginBottom: 2 }}>{wf.nom}</div>
                  <div style={{ fontSize: 10.5, color: '#94A3B8' }}>{TYPE_CFG[wf.type]?.label ?? wf.type}</div>
                </div>
              ))}
            </div>
          </div>

          {/* ── Zone édition ── */}
          {editingWf ? (
            <div style={{ display: 'flex', flexDirection: 'column', overflow: 'hidden', background: C.bg }}>
              {/* En-tête workflow */}
              <div style={{ padding: '16px 24px', background: '#fff', borderBottom: `1px solid ${C.border}`, display: 'flex', alignItems: 'center', gap: 12, flexShrink: 0 }}>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 16, fontWeight: 800, color: '#1E293B' }}>{editingWf.nom}</div>
                  <div style={{ fontSize: 12, color: '#64748B', marginTop: 2 }}>{editingWf.description || 'Aucune description'} — Type : <strong>{TYPE_CFG[editingWf.type]?.label ?? editingWf.type}</strong></div>
                </div>
                <button
                  onClick={() => toggleActive(editingWf.id)}
                  style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 14px', borderRadius: 8, border: `1px solid ${editingWf.actif ? C.green : C.border}`, background: editingWf.actif ? '#DCFCE7' : '#F8FAFC', color: editingWf.actif ? C.green : '#64748B', fontSize: 12.5, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' }}
                >
                  {editingWf.actif ? <><Pause size={13} /> Désactiver</> : <><Play size={13} /> Activer</>}
                </button>
                <button
                  onClick={() => duplicateTemplate(editingWf)}
                  style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 14px', borderRadius: 8, border: `1px solid ${C.border}`, background: '#fff', color: '#475569', fontSize: 12.5, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' }}
                >
                  <Copy size={13} /> Dupliquer
                </button>
              </div>

              {/* Corps scrollable */}
              <div style={{ flex: 1, overflowY: 'auto', padding: '20px 24px' }}>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 320px', gap: 24, alignItems: 'start' }}>

                  {/* ── Liste des étapes ── */}
                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
                      <div style={{ fontSize: 13, fontWeight: 700, color: '#1E293B' }}>Étapes du circuit ({editingWf.steps.length})</div>
                    </div>

                    {/* Étapes */}
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 16 }}>
                      {editingWf.steps.map((step, idx) => (
                        <div key={step.id} style={{ background: '#fff', borderRadius: 10, border: `1px solid ${C.border}`, padding: '12px 14px', display: 'flex', gap: 12, alignItems: 'flex-start' }}>
                          {/* Ordre */}
                          <div style={{ width: 28, height: 28, borderRadius: '50%', background: C.navy, color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, fontWeight: 800, flexShrink: 0 }}>
                            {idx + 1}
                          </div>
                          {/* Contenu */}
                          <div style={{ flex: 1 }}>
                            <div style={{ fontSize: 13, fontWeight: 700, color: '#1E293B', marginBottom: 5 }}>{step.label}</div>
                            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                              <span style={{ fontSize: 11, padding: '2px 8px', borderRadius: 6, background: '#EFF6FF', color: C.navy, fontWeight: 600 }}>
                                <Shield size={9} style={{ display: 'inline', marginRight: 3 }} />{step.role}
                              </span>
                              <span style={{ fontSize: 11, padding: '2px 8px', borderRadius: 6, background: '#F5F3FF', color: C.purple, fontWeight: 600 }}>
                                <Zap size={9} style={{ display: 'inline', marginRight: 3 }} />{step.action}
                              </span>
                              <span style={{ fontSize: 11, padding: '2px 8px', borderRadius: 6, background: '#FFF7ED', color: C.amber, fontWeight: 600 }}>
                                <Clock size={9} style={{ display: 'inline', marginRight: 3 }} />SLA : {step.slaHeures > 0 ? `${step.slaHeures}h` : 'Immédiat'}
                              </span>
                              {step.condition !== 'Toujours' && (
                                <span style={{ fontSize: 11, padding: '2px 8px', borderRadius: 6, background: '#F0FDF4', color: C.green, fontWeight: 600 }}>
                                  Si : {step.condition}
                                </span>
                              )}
                              {step.assigneeEmail ? (
                                <span style={{ fontSize: 11, padding: '2px 8px', borderRadius: 6, background: '#ECFEFF', color: '#0891B2', fontWeight: 600 }}>
                                  <Mail size={9} style={{ display: 'inline', marginRight: 3 }} />{step.assigneeNom ? `${step.assigneeNom} · ` : ''}{step.assigneeEmail}
                                </span>
                              ) : (
                                <span style={{ fontSize: 11, padding: '2px 8px', borderRadius: 6, background: '#FEF2F2', color: C.red, fontWeight: 600 }}>
                                  <Mail size={9} style={{ display: 'inline', marginRight: 3 }} />Aucun e-mail défini
                                </span>
                              )}
                            </div>
                          </div>
                          {/* Actions */}
                          <div style={{ display: 'flex', flexDirection: 'column', gap: 3, flexShrink: 0 }}>
                            <button onClick={() => moveStep(step.id, 'up')} disabled={idx === 0} style={{ padding: '3px 6px', border: `1px solid ${C.border}`, borderRadius: 5, background: '#fff', cursor: idx === 0 ? 'not-allowed' : 'pointer', color: idx === 0 ? '#CBD5E1' : '#475569' }}>
                              <ArrowUp size={11} />
                            </button>
                            <button onClick={() => moveStep(step.id, 'down')} disabled={idx === editingWf.steps.length - 1} style={{ padding: '3px 6px', border: `1px solid ${C.border}`, borderRadius: 5, background: '#fff', cursor: idx === editingWf.steps.length - 1 ? 'not-allowed' : 'pointer', color: idx === editingWf.steps.length - 1 ? '#CBD5E1' : '#475569' }}>
                              <ArrowDown size={11} />
                            </button>
                            <button onClick={() => { setEditingStep(step); setStepForm({ label: step.label, role: step.role, action: step.action, slaHeures: step.slaHeures, condition: step.condition, ordre: step.ordre, assigneeEmail: step.assigneeEmail ?? '', assigneeNom: step.assigneeNom ?? '' }); }} style={{ padding: '3px 6px', border: `1px solid ${C.border}`, borderRadius: 5, background: '#EFF6FF', cursor: 'pointer', color: C.navy }}>
                              <Edit2 size={11} />
                            </button>
                            <button onClick={() => removeStep(step.id)} style={{ padding: '3px 6px', border: `1px solid #FEE2E2`, borderRadius: 5, background: '#FEF2F2', cursor: 'pointer', color: C.red }}>
                              <Trash2 size={11} />
                            </button>
                          </div>
                        </div>
                      ))}

                      {/* Connecteur fin */}
                      {editingWf.steps.length > 0 && (
                        <div style={{ display: 'flex', justifyContent: 'center', color: '#CBD5E1' }}>
                          <ChevronDown size={16} />
                        </div>
                      )}

                      {/* Bouton ajouter */}
                      <div style={{ border: `2px dashed ${C.border}`, borderRadius: 10, padding: '12px', textAlign: 'center', background: '#FAFBFF' }}>
                        <div style={{ fontSize: 12, fontWeight: 600, color: '#94A3B8', marginBottom: 8 }}>Ajouter une étape</div>
                        <div style={{ display: 'flex', gap: 8, justifyContent: 'center' }}>
                          {['Approbation', 'Vérification', 'Signature'].map(preset => (
                            <button
                              key={preset}
                              onClick={() => {
                                setStepForm({ label: preset, role: preset === 'Signature' ? 'DIR_DPE' : preset === 'Vérification' ? 'CTRL_FIN' : 'CHEF_PROJ', action: preset === 'Signature' ? 'signer' : preset === 'Vérification' ? 'vérifier' : 'approuver', slaHeures: 48, condition: 'Toujours', ordre: editingWf.steps.length + 1, assigneeEmail: '', assigneeNom: '' });
                                setEditingStep(null);
                              }}
                              style={{ padding: '6px 12px', borderRadius: 6, border: `1px solid ${C.border}`, background: '#fff', fontSize: 11.5, fontWeight: 600, color: '#475569', cursor: 'pointer', fontFamily: 'inherit' }}
                            >
                              + {preset}
                            </button>
                          ))}
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* ── Formulaire ajout/édition étape ── */}
                  <div style={{ background: '#fff', borderRadius: 12, border: `1px solid ${C.border}`, padding: '18px', position: 'sticky', top: 0 }}>
                    <div style={{ fontSize: 13, fontWeight: 700, color: '#1E293B', marginBottom: 14, display: 'flex', alignItems: 'center', gap: 6 }}>
                      {editingStep ? <Edit2 size={13} /> : <Plus size={13} />}
                      {editingStep ? 'Modifier l\'étape' : 'Nouvelle étape'}
                    </div>

                    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                      <div>
                        <label style={{ fontSize: 11, fontWeight: 700, color: '#475569', display: 'block', marginBottom: 4 }}>Libellé *</label>
                        <input
                          value={stepForm.label}
                          onChange={e => setStepForm(p => ({ ...p, label: e.target.value }))}
                          placeholder="Ex : Visa Chef de Projet"
                          style={{ width: '100%', padding: '8px 10px', borderRadius: 7, border: `1px solid ${C.border}`, fontSize: 12.5, fontFamily: 'inherit', boxSizing: 'border-box', outline: 'none' }}
                        />
                      </div>
                      <div>
                        <label style={{ fontSize: 11, fontWeight: 700, color: '#475569', display: 'block', marginBottom: 4 }}>Rôle acteur</label>
                        <SearchableSelect
                          value={stepForm.role}
                          onChange={v => setStepForm(p => ({ ...p, role: v }))}
                          options={ROLES_WF}
                          searchPlaceholder="Rechercher un rôle…"
                        />
                      </div>
                      <div>
                        <label style={{ fontSize: 11, fontWeight: 700, color: '#475569', display: 'block', marginBottom: 4 }}>Action</label>
                        <SearchableSelect
                          value={stepForm.action}
                          onChange={v => setStepForm(p => ({ ...p, action: v }))}
                          options={ACTIONS_WF}
                          searchPlaceholder="Rechercher une action…"
                        />
                      </div>
                      <div>
                        <label style={{ fontSize: 11, fontWeight: 700, color: '#475569', display: 'block', marginBottom: 4 }}>SLA (heures) — 0 = immédiat</label>
                        <input
                          type="number"
                          min={0}
                          value={stepForm.slaHeures}
                          onChange={e => setStepForm(p => ({ ...p, slaHeures: parseInt(e.target.value) || 0 }))}
                          style={{ width: '100%', padding: '8px 10px', borderRadius: 7, border: `1px solid ${C.border}`, fontSize: 12.5, fontFamily: 'inherit', boxSizing: 'border-box', outline: 'none' }}
                        />
                      </div>
                      <div>
                        <label style={{ fontSize: 11, fontWeight: 700, color: '#475569', display: 'block', marginBottom: 4 }}>Condition d&apos;exécution</label>
                        <SearchableSelect
                          value={stepForm.condition}
                          onChange={v => setStepForm(p => ({ ...p, condition: v }))}
                          options={CONDITIONS_WF}
                          searchPlaceholder="Rechercher une condition…"
                        />
                      </div>
                      <div>
                        <label style={{ fontSize: 11, fontWeight: 700, color: '#475569', display: 'flex', alignItems: 'center', gap: 4, marginBottom: 4 }}>
                          <User size={11} /> Choisir dans l&apos;annuaire DPE (remplit nom + e-mail)
                        </label>
                        <SearchableSelect
                          value={stepForm.assigneeEmail}
                          onChange={v => {
                            const u = TEST_USERS.find(x => x.email === v);
                            setStepForm(p => ({ ...p, assigneeEmail: v, assigneeNom: u ? `${u.prenom} ${u.nom}` : p.assigneeNom }));
                          }}
                          options={ANNUAIRE_DPE}
                          placeholder="— Sélectionner une personne —"
                          searchPlaceholder="Nom, poste, rôle ou e-mail…"
                          allowEmpty
                        />
                        <div style={{ fontSize: 10, color: '#94A3B8', marginTop: 4 }}>
                          Ou saisissez manuellement le nom / l&apos;e-mail ci-dessous.
                        </div>
                      </div>
                      <div>
                        <label style={{ fontSize: 11, fontWeight: 700, color: '#475569', display: 'block', marginBottom: 4 }}>Personne affectée (nom)</label>
                        <input
                          value={stepForm.assigneeNom}
                          onChange={e => setStepForm(p => ({ ...p, assigneeNom: e.target.value }))}
                          placeholder="Ex : Maodo SENE"
                          style={{ width: '100%', padding: '8px 10px', borderRadius: 7, border: `1px solid ${C.border}`, fontSize: 12.5, fontFamily: 'inherit', boxSizing: 'border-box', outline: 'none' }}
                        />
                      </div>
                      <div>
                        <label style={{ fontSize: 11, fontWeight: 700, color: '#475569', display: 'flex', alignItems: 'center', gap: 4, marginBottom: 4 }}>
                          <Mail size={11} /> E-mail à notifier (quand c&apos;est son tour)
                        </label>
                        <input
                          type="email"
                          value={stepForm.assigneeEmail}
                          onChange={e => setStepForm(p => ({ ...p, assigneeEmail: e.target.value }))}
                          placeholder="prenom.nom@dpe.sn"
                          style={{ width: '100%', padding: '8px 10px', borderRadius: 7, border: `1px solid ${stepForm.assigneeEmail && !stepForm.assigneeEmail.includes('@') ? C.red : C.border}`, fontSize: 12.5, fontFamily: 'inherit', boxSizing: 'border-box', outline: 'none' }}
                        />
                        <div style={{ fontSize: 10, color: '#94A3B8', marginTop: 4 }}>
                          La personne reçoit une notification dans l&apos;application <strong>et</strong> un e-mail dès que le dossier arrive à cette étape.
                        </div>
                      </div>

                      <div style={{ display: 'flex', gap: 8, marginTop: 4 }}>
                        {editingStep ? (
                          <>
                            <button
                              onClick={() => updateStep(editingStep.id)}
                              style={{ flex: 1, padding: '9px', borderRadius: 7, border: 'none', background: C.navy, color: '#fff', fontSize: 12.5, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 5 }}
                            >
                              <Save size={13} /> Enregistrer
                            </button>
                            <button
                              onClick={() => { setEditingStep(null); setStepForm({ label: '', role: 'CHEF_PROJ', action: 'approuver', slaHeures: 48, condition: 'Toujours', ordre: 1, assigneeEmail: '', assigneeNom: '' }); }}
                              style={{ padding: '9px 12px', borderRadius: 7, border: `1px solid ${C.border}`, background: '#fff', color: '#64748B', fontSize: 12.5, cursor: 'pointer', fontFamily: 'inherit' }}
                            >
                              <X size={13} />
                            </button>
                          </>
                        ) : (
                          <button
                            onClick={addStep}
                            disabled={!stepForm.label.trim()}
                            style={{ flex: 1, padding: '9px', borderRadius: 7, border: 'none', background: stepForm.label.trim() ? C.green : '#E2E8F0', color: stepForm.label.trim() ? '#fff' : '#94A3B8', fontSize: 12.5, fontWeight: 700, cursor: stepForm.label.trim() ? 'pointer' : 'not-allowed', fontFamily: 'inherit', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 5 }}
                          >
                            <Plus size={13} /> Ajouter l&apos;étape
                          </button>
                        )}
                      </div>
                    </div>

                    {/* Aperçu flux */}
                    {editingWf.steps.length > 0 && (
                      <div style={{ marginTop: 16, paddingTop: 14, borderTop: `1px solid ${C.border}` }}>
                        <div style={{ fontSize: 11, fontWeight: 700, color: '#475569', marginBottom: 8 }}>APERÇU DU FLUX</div>
                        {editingWf.steps.map((s, i) => (
                          <div key={s.id} style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: i < editingWf.steps.length - 1 ? 2 : 0 }}>
                            <div style={{ width: 20, height: 20, borderRadius: '50%', background: C.navy, color: '#fff', fontSize: 9, fontWeight: 800, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>{i + 1}</div>
                            <div style={{ flex: 1 }}>
                              <div style={{ fontSize: 10.5, fontWeight: 600, color: '#1E293B' }}>{s.label}</div>
                              <div style={{ fontSize: 9.5, color: '#94A3B8' }}>{s.role} · {s.action}</div>
                            </div>
                            {i < editingWf.steps.length - 1 && (
                              <div style={{ position: 'absolute', left: 27, marginTop: 24, width: 2, height: 10, background: '#E2E8F0' }} />
                            )}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          ) : (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', gap: 16, background: '#FAFBFF' }}>
              <GitBranch size={48} style={{ color: '#CBD5E1' }} />
              <div style={{ fontSize: 16, fontWeight: 700, color: '#94A3B8' }}>Sélectionnez un modèle</div>
              <div style={{ fontSize: 13, color: '#CBD5E1' }}>ou créez un nouveau workflow</div>
              <button onClick={openNewWfModal} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '10px 20px', borderRadius: 8, border: 'none', background: C.navy, color: '#fff', fontSize: 13, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' }}>
                <Plus size={14} /> Nouveau workflow
              </button>
            </div>
          )}
        </div>
      )}

      {/* ─── MODÈLES ─── */}
      {activeTab === 'modeles' && (
        <div style={{ flex: 1, overflowY: 'auto', padding: '24px' }}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(340px, 1fr))', gap: 16 }}>
            {templates.map(wf => (
              <div key={wf.id} style={{ background: '#fff', borderRadius: 12, border: `1px solid ${C.border}`, overflow: 'hidden', boxShadow: '0 1px 3px rgba(0,0,0,0.06)', transition: 'box-shadow 0.2s' }}>
                {/* Header card */}
                <div style={{ padding: '16px 18px', borderBottom: `1px solid ${C.border}`, background: wf.actif ? '#F0FDF4' : '#F8FAFC' }}>
                  <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}>
                    <div style={{ width: 38, height: 38, borderRadius: 10, background: `${TYPE_CFG[wf.type]?.bg ?? '#F1F5F9'}`, display: 'flex', alignItems: 'center', justifyContent: 'center', color: TYPE_CFG[wf.type]?.color ?? C.slate, flexShrink: 0 }}>
                      {TYPE_CFG[wf.type]?.icon}
                    </div>
                    <div style={{ flex: 1 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 3 }}>
                        <span style={{ fontSize: 11, fontWeight: 700, padding: '2px 8px', borderRadius: 10, background: wf.actif ? '#DCFCE7' : '#F1F5F9', color: wf.actif ? C.green : '#94A3B8' }}>
                          {wf.actif ? '● Actif' : '○ Inactif'}
                        </span>
                        <span style={{ fontSize: 10.5, color: '#94A3B8', marginLeft: 'auto' }}>{wf.steps.length} étapes</span>
                      </div>
                      <div style={{ fontSize: 14, fontWeight: 800, color: '#1E293B' }}>{wf.nom}</div>
                      <div style={{ fontSize: 11.5, color: '#64748B', marginTop: 2 }}>{wf.description}</div>
                    </div>
                  </div>
                </div>

                {/* Étapes résumé */}
                <div style={{ padding: '12px 18px', borderBottom: `1px solid ${C.border}` }}>
                  {wf.steps.slice(0, 4).map((step, idx) => (
                    <div key={step.id} style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: idx < wf.steps.length - 1 ? 6 : 0 }}>
                      <div style={{ width: 20, height: 20, borderRadius: '50%', background: '#EFF6FF', color: C.navy, fontSize: 10, fontWeight: 800, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>{idx + 1}</div>
                      <div style={{ flex: 1, fontSize: 11.5, color: '#374151', fontWeight: 500 }}>{step.label}</div>
                      <div style={{ fontSize: 10, color: '#94A3B8', fontWeight: 600 }}>{step.role}</div>
                    </div>
                  ))}
                  {wf.steps.length > 4 && (
                    <div style={{ fontSize: 11, color: '#94A3B8', marginTop: 6, textAlign: 'center' }}>+{wf.steps.length - 4} étapes supplémentaires</div>
                  )}
                </div>

                {/* Méta + actions */}
                <div style={{ padding: '12px 18px', display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span style={{ fontSize: 10.5, color: '#94A3B8' }}>Créé le {new Date(wf.createdAt).toLocaleDateString('fr-FR')}</span>
                  <div style={{ flex: 1 }} />
                  <button
                    onClick={() => toggleActive(wf.id)}
                    style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '6px 11px', borderRadius: 6, border: `1px solid ${wf.actif ? C.green : C.border}`, background: wf.actif ? '#F0FDF4' : '#fff', color: wf.actif ? C.green : '#64748B', fontSize: 11.5, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' }}
                  >
                    {wf.actif ? <><Pause size={11} /> Désactiver</> : <><Play size={11} /> Activer</>}
                  </button>
                  <button
                    onClick={() => { setEditingWf(wf); setActiveTab('builder'); }}
                    style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '6px 11px', borderRadius: 6, border: `1px solid ${C.border}`, background: '#EFF6FF', color: C.navy, fontSize: 11.5, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' }}
                  >
                    <Edit2 size={11} /> Éditer
                  </button>
                  <button
                    onClick={() => duplicateTemplate(wf)}
                    style={{ padding: '6px 8px', borderRadius: 6, border: `1px solid ${C.border}`, background: '#fff', color: '#64748B', cursor: 'pointer' }}
                    title="Dupliquer"
                  >
                    <Copy size={11} />
                  </button>
                  <button
                    onClick={() => deleteTemplate(wf.id)}
                    style={{ padding: '6px 8px', borderRadius: 6, border: `1px solid #FEE2E2`, background: '#FEF2F2', color: C.red, cursor: 'pointer' }}
                    title="Supprimer"
                  >
                    <Trash2 size={11} />
                  </button>
                </div>
              </div>
            ))}

            {/* Card ajout */}
            <div
              onClick={openNewWfModal}
              style={{ background: '#F8FAFC', borderRadius: 12, border: `2px dashed ${C.border}`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', gap: 10, cursor: 'pointer', minHeight: 180, transition: 'border-color 0.2s' }}
              onMouseEnter={e => { (e.currentTarget as HTMLDivElement).style.borderColor = C.navy; }}
              onMouseLeave={e => { (e.currentTarget as HTMLDivElement).style.borderColor = C.border; }}
            >
              <div style={{ width: 44, height: 44, borderRadius: 12, background: '#EFF6FF', display: 'flex', alignItems: 'center', justifyContent: 'center', color: C.navy }}>
                <Plus size={20} />
              </div>
              <div style={{ fontSize: 13, fontWeight: 700, color: '#64748B' }}>Nouveau modèle</div>
              <div style={{ fontSize: 11.5, color: '#94A3B8' }}>Créer un circuit personnalisé</div>
            </div>
          </div>
        </div>
      )}

      {/* ══ Modal création workflow ══ */}
      {showWfModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
          <div style={{ background: '#fff', borderRadius: 14, width: 460, padding: '28px', boxShadow: '0 20px 60px rgba(0,0,0,0.25)' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 22 }}>
              <div style={{ fontSize: 17, fontWeight: 800, color: '#1E293B', display: 'flex', alignItems: 'center', gap: 8 }}>
                <GitBranch size={18} style={{ color: C.navy }} />
                Nouveau workflow
              </div>
              <button onClick={() => setShowWfModal(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#94A3B8', display: 'flex' }}>
                <X size={18} />
              </button>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              <div>
                <label style={{ fontSize: 11.5, fontWeight: 700, color: '#475569', display: 'block', marginBottom: 5 }}>Nom du workflow *</label>
                <input
                  value={wfForm.nom}
                  onChange={e => setWfForm(p => ({ ...p, nom: e.target.value }))}
                  placeholder="Ex : Circuit validation factures urgentes"
                  style={{ width: '100%', padding: '10px 12px', borderRadius: 8, border: `1px solid ${C.border}`, fontSize: 13, fontFamily: 'inherit', boxSizing: 'border-box', outline: 'none' }}
                  autoFocus
                />
              </div>
              <div>
                <label style={{ fontSize: 11.5, fontWeight: 700, color: '#475569', display: 'block', marginBottom: 5 }}>Type de dossier</label>
                <select
                  value={wfForm.type}
                  onChange={e => setWfForm(p => ({ ...p, type: e.target.value as TypeDossier }))}
                  style={{ width: '100%', padding: '10px 12px', borderRadius: 8, border: `1px solid ${C.border}`, fontSize: 13, fontFamily: 'inherit', background: '#fff', cursor: 'pointer', outline: 'none' }}
                >
                  {Object.entries(TYPE_CFG).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
                </select>
              </div>
              <div>
                <label style={{ fontSize: 11.5, fontWeight: 700, color: '#475569', display: 'block', marginBottom: 5 }}>Description</label>
                <textarea
                  value={wfForm.description}
                  onChange={e => setWfForm(p => ({ ...p, description: e.target.value }))}
                  placeholder="Décrivez l'objectif et le contexte d'utilisation de ce workflow…"
                  rows={3}
                  style={{ width: '100%', padding: '10px 12px', borderRadius: 8, border: `1px solid ${C.border}`, fontSize: 13, fontFamily: 'inherit', resize: 'vertical', boxSizing: 'border-box', outline: 'none', lineHeight: 1.5 }}
                />
              </div>

              <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', marginTop: 6 }}>
                <button onClick={() => setShowWfModal(false)} style={{ padding: '10px 20px', borderRadius: 8, border: `1px solid ${C.border}`, background: '#fff', color: '#64748B', fontSize: 13, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' }}>
                  Annuler
                </button>
                <button
                  onClick={createWorkflow}
                  disabled={!wfForm.nom.trim()}
                  style={{ padding: '10px 24px', borderRadius: 8, border: 'none', background: wfForm.nom.trim() ? C.navy : '#E2E8F0', color: wfForm.nom.trim() ? '#fff' : '#94A3B8', fontSize: 13, fontWeight: 700, cursor: wfForm.nom.trim() ? 'pointer' : 'not-allowed', fontFamily: 'inherit', display: 'flex', alignItems: 'center', gap: 6 }}
                >
                  <GitBranch size={13} /> Créer et configurer
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── Modal : Nouvel élément du parapheur ── */}
      {showNewDossier && (
        <>
          <div onClick={() => setShowNewDossier(false)} style={{ position: 'fixed', inset: 0, zIndex: 500, background: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(3px)' }} />
          <div style={{ position: 'fixed', top: '50%', left: '50%', transform: 'translate(-50%,-50%)', zIndex: 501, background: '#fff', borderRadius: 12, boxShadow: '0 20px 60px rgba(0,0,0,0.3)', width: 440, padding: 22 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
              <div style={{ fontSize: 16, fontWeight: 800, color: C.navy }}>Nouvel élément du parapheur</div>
              <button onClick={() => setShowNewDossier(false)} style={{ border: 'none', background: 'none', cursor: 'pointer', color: '#94A3B8' }}><X size={18} /></button>
            </div>
            <label style={{ fontSize: 10.5, fontWeight: 700, color: '#64748B', textTransform: 'uppercase', display: 'block', marginBottom: 4 }}>Type d&apos;élément</label>
            <select value={ndForm.type} onChange={e => setNdForm({ ...ndForm, type: e.target.value as TypeDossier })} style={{ width: '100%', padding: '8px 10px', borderRadius: 7, border: `1px solid ${C.border}`, fontSize: 13, marginBottom: 10, fontFamily: 'inherit' }}>
              {(Object.keys(TYPE_CFG) as TypeDossier[]).map(t => <option key={t} value={t}>{TYPE_CFG[t].label}</option>)}
            </select>
            <label style={{ fontSize: 10.5, fontWeight: 700, color: '#64748B', textTransform: 'uppercase', display: 'block', marginBottom: 4 }}>Objet / Titre *</label>
            <input value={ndForm.titre} onChange={e => setNdForm({ ...ndForm, titre: e.target.value })} placeholder="Ex : Courrier d'approbation marché HTA Nord" style={{ width: '100%', padding: '8px 10px', borderRadius: 7, border: `1px solid ${C.border}`, fontSize: 13, marginBottom: 10, boxSizing: 'border-box', fontFamily: 'inherit' }} />
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
              <div>
                <label style={{ fontSize: 10.5, fontWeight: 700, color: '#64748B', textTransform: 'uppercase', display: 'block', marginBottom: 4 }}>Projet / Direction</label>
                <input value={ndForm.projet} onChange={e => setNdForm({ ...ndForm, projet: e.target.value })} placeholder="DPE" style={{ width: '100%', padding: '8px 10px', borderRadius: 7, border: `1px solid ${C.border}`, fontSize: 13, boxSizing: 'border-box', fontFamily: 'inherit' }} />
              </div>
              <div>
                <label style={{ fontSize: 10.5, fontWeight: 700, color: '#64748B', textTransform: 'uppercase', display: 'block', marginBottom: 4 }}>Priorité</label>
                <select value={ndForm.priorite} onChange={e => setNdForm({ ...ndForm, priorite: e.target.value as PrioriteDossier })} style={{ width: '100%', padding: '8px 10px', borderRadius: 7, border: `1px solid ${C.border}`, fontSize: 13, fontFamily: 'inherit' }}>
                  {(Object.keys(PRIO_CFG) as PrioriteDossier[]).map(p => <option key={p} value={p}>{PRIO_CFG[p].label}</option>)}
                </select>
              </div>
            </div>
            {/* ── Pièces jointes (rapport · courrier · plans techniques) ── */}
            <label style={{ fontSize: 10.5, fontWeight: 700, color: '#64748B', textTransform: 'uppercase', display: 'block', margin: '12px 0 4px' }}>Documents joints</label>
            <input ref={ndFileRef} type="file" multiple style={{ display: 'none' }} onChange={handleNdAttach}
              accept=".pdf,.doc,.docx,.xls,.xlsx,.csv,.txt,.png,.jpg,.jpeg,.gif,.bmp,.svg,.webp,.ppt,.pptx,.dwg,.dxf,.dgn" />
            <button onClick={() => ndFileRef.current?.click()}
              style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, padding: '9px 12px', borderRadius: 7, border: `1.5px dashed ${C.orange}`, background: `${C.orange}0D`, color: C.orange, fontSize: 12.5, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' }}>
              <Paperclip size={13} /> Joindre un document (rapport, courrier, plans techniques…)
            </button>
            {ndFiles.length > 0 && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 5, marginTop: 8 }}>
                {ndFiles.map((pj, i) => (
                  <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '6px 9px', background: '#F8FAFC', borderRadius: 7, border: `1px solid ${C.border}` }}>
                    <span style={{ fontSize: 8, fontWeight: 800, color: EXT_COLOR[pj.ext] ?? C.slate, textTransform: 'uppercase', background: `${EXT_COLOR[pj.ext] ?? C.slate}15`, padding: '2px 5px', borderRadius: 4 }}>{pj.ext}</span>
                    <span style={{ flex: 1, fontSize: 11.5, fontWeight: 600, color: '#1E293B', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{pj.nom}</span>
                    <span style={{ fontSize: 10, color: '#94A3B8' }}>{pj.taille}</span>
                    <button onClick={() => setNdFiles(prev => prev.filter((_, j) => j !== i))} style={{ border: 'none', background: 'none', cursor: 'pointer', color: '#94A3B8', display: 'flex' }}><X size={12} /></button>
                  </div>
                ))}
              </div>
            )}

            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 18 }}>
              <button onClick={() => { setShowNewDossier(false); setNdFiles([]); }} style={{ padding: '8px 16px', borderRadius: 7, border: `1px solid ${C.border}`, background: '#fff', fontSize: 12, cursor: 'pointer' }}>Annuler</button>
              <button onClick={creerDossier} disabled={!ndForm.titre.trim()} style={{ padding: '8px 18px', borderRadius: 7, border: 'none', background: ndForm.titre.trim() ? C.navy : '#E5E7EB', color: ndForm.titre.trim() ? '#fff' : '#9CA3AF', fontSize: 12, fontWeight: 700, cursor: ndForm.titre.trim() ? 'pointer' : 'default' }}>Créer le workflow</button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

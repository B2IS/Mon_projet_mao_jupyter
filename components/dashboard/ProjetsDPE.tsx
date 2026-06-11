'use client';

import React, { useState, useCallback, useMemo, useRef } from 'react';
import { useRouter } from 'next/navigation';
import {
  Search, Plus, MapPin, User, Calendar, TrendingUp,
  ChevronRight, X, FileText,
  Users, AlertTriangle, CheckCircle,
  Activity, BarChart, GitBranch, Shield, FolderOpen,
  ChevronLeft, ChevronDown, RefreshCw, Play,
} from 'lucide-react';
import {
  PieChart, Pie, Cell, BarChart as ReBarChart, Bar,
  XAxis, YAxis, Tooltip, ResponsiveContainer,
} from 'recharts';
import {
  useProjectStore, DOMAINE_CFG, STATUT_CFG, REGIONS, CHEFS,
  type Projet, type StatutProjet, type Domaine, type Priorite, type Ressource,
} from '@/lib/projectStore';
import { useAuth, isOperationalReadOnly } from '@/lib/authStore';
import { readOnlyGuard } from '@/lib/operationalGuard';
import { useNotificationStore } from '@/lib/notificationStore';
import { useCriteriaStore } from '@/lib/criteriaStore';
import dynamic from 'next/dynamic';

const ProjetsCarteLeaflet = dynamic(() => import('@/components/ui/ProjetsCarteLeaflet'), {
  ssr: false,
  loading: () => (
    <div style={{ height: 200, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#94A3B8', fontSize: 12 }}>
      Chargement de la carte…
    </div>
  ),
});

/* ─────────────────────────── LOCAL-ONLY TYPES ───────────────────────────── */

type Bailleur = 'BM' | 'AFD' | 'BAD' | 'BEI' | 'JICA' | 'Fonds propres SENELEC' | 'État Sénégal' | 'PPP';
type Categorie = 'Investissement' | 'Fonctionnement' | 'Mixte';
type Devise = 'FCFA' | 'EUR' | 'USD';
type Role = 'Chef projet' | 'Ingénieur' | 'Technicien' | 'Administratif' | 'Expert';

interface TeamMember {
  id: string;
  role: Role;
  nom: string;
  allocation: number;
}

interface WizardJalon {
  label: string;
  date: string;
}

/* Critère de priorisation pondéré — arbitrage de portefeuille (PMI) */
interface PrioCritere {
  id: string;
  label: string;
  poids: number;   // poids relatif (%)
  note: number;    // note attribuée 1..5
}

/* Grille d'arbitrage par défaut — inspirée du scoring model PMI (Standard for Portfolio Mgmt).
   Les poids et critères sont entièrement modifiables selon le contexte par la DPE. */
const DEFAULT_CRITERES: PrioCritere[] = [
  { id: 'c1', label: 'Alignement stratégique (PSE / lettre de mission)', poids: 25, note: 3 },
  { id: 'c2', label: 'Impact socio-économique (ménages, accès, emplois)', poids: 20, note: 3 },
  { id: 'c3', label: 'Rentabilité économique (VAN / TRI)',               poids: 15, note: 3 },
  { id: 'c4', label: 'Financement sécurisé (engagement bailleur)',       poids: 15, note: 3 },
  { id: 'c5', label: 'Urgence / criticité réseau',                       poids: 15, note: 3 },
  { id: 'c6', label: 'Maturité & faisabilité technique',                 poids: 10, note: 3 },
];

const BAILLEURS: Bailleur[] = ['BM', 'AFD', 'BAD', 'BEI', 'JICA', 'Fonds propres SENELEC', 'État Sénégal', 'PPP'];

const WBS_TEMPLATES: Record<Domaine, string[]> = {
  production:   ['Phase études', 'Génie Civil fondations', 'Génie Électromécanique', 'Lignes évacuation', 'Tests/Mise en service', 'Formation', 'Clôture'],
  transport:    ['Études tracé', 'Acquisitions foncières', 'Fondations pylônes', 'Montage pylônes', 'Tirage câbles', 'Postes extrémités', 'Essais', 'Clôture'],
  // Distribution : inclut réseaux HTA/BT classiques + électrification rurale / accès universel
  distribution: ['Études réseau & bénéficiaires', 'Approvisionnement matériels HTA/BT', 'Travaux génie civil', 'Pose réseaux HTA/BT', 'Pose postes de transformation', 'Branchements sociaux & comptage', 'Mise en service', 'Réception & clôture'],
  commercial:   ['Cadrage', 'Spécifications fonctionnelles', 'Développement', 'Tests UAT', 'Déploiement', 'Formation utilisateurs', 'Clôture'],
  // Génie Civil (DGC) : bâtiments, routes, ouvrages d'art, VRD
  genie_civil:  ['Études & Conception GC', 'Autorisations & permis', 'Gros œuvre', 'Second œuvre & VRD', 'Corps d\'état techniques', 'Réception & livraison', 'Clôture'],
};

/* ─────────────────────────── HELPERS ────────────────────────────────────── */

function fmtMFCFA(n: number): string {
  return `${n.toFixed(1)} MFCFA`;
}

function cpiColor(cpi: number): string {
  if (cpi >= 1.0) return '#16A34A';
  if (cpi >= 0.9) return '#F47920';
  return '#EF3340';
}

function genCode(domaine: Domaine): string {
  const prefixes: Record<Domaine, string> = {
    production: 'PRD', transport: 'TRP', distribution: 'DST', commercial: 'COM', genie_civil: 'DGC',
  };
  return `${prefixes[domaine]}-${new Date().getFullYear()}-${String(Math.floor(Math.random() * 900) + 100)}`;
}

/* ─────────────────────────── DUAL PROGRESS BAR ──────────────────────────── */

function DualProgressBar({ planned, actual, color }: { planned: number; actual: number; color: string }) {
  const isLate = actual < planned;
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
        <span style={{ fontSize: 9, color: '#9CA3AF', width: 44, flexShrink: 0 }}>Planifié</span>
        <div style={{ flex: 1, height: 4, borderRadius: 99, background: '#E5E7EB', overflow: 'hidden' }}>
          <div style={{ width: `${Math.min(100, planned)}%`, height: '100%', borderRadius: 99, background: '#9CA3AF' }} />
        </div>
        <span style={{ fontSize: 9, color: '#9CA3AF', width: 26, textAlign: 'right', flexShrink: 0 }}>{planned}%</span>
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
        <span style={{ fontSize: 9, color: isLate ? '#EF3340' : color, width: 44, flexShrink: 0 }}>Réel</span>
        <div style={{ flex: 1, height: 4, borderRadius: 99, background: '#E5E7EB', overflow: 'hidden' }}>
          <div style={{ width: `${Math.min(100, actual)}%`, height: '100%', borderRadius: 99, background: isLate ? '#EF3340' : color }} />
        </div>
        <span style={{ fontSize: 9, color: isLate ? '#EF3340' : color, width: 26, textAlign: 'right', flexShrink: 0, fontWeight: 700 }}>{actual}%</span>
      </div>
    </div>
  );
}

/* ─────────────────────────── KPI BADGE ──────────────────────────────────── */

function KpiBadge({ label, value, color }: { label: string; value: string; color: string }) {
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: 3,
      fontSize: 9, fontWeight: 700, padding: '2px 6px', borderRadius: 4,
      background: `${color}18`, color,
    }}>
      {label}: {value}
    </span>
  );
}

/* ─────────────────────────── PROJECT CARD ───────────────────────────────── */

interface ProjectCardProps {
  projet: Projet;
  onOpen: (p: Projet) => void;
  onStatusChange: (id: string, statut: StatutProjet, reason: string) => void;
}

function ProjectCard({ projet, onOpen, onStatusChange }: ProjectCardProps) {
  const router = useRouter();
  const [hovered, setHovered] = useState(false);
  const [showStatusModal, setShowStatusModal] = useState(false);
  const [newStatut, setNewStatut] = useState<StatutProjet>(projet.statut);
  const [reason, setReason] = useState('');
  const cfg = DOMAINE_CFG[projet.domaine];
  const stCfg = STATUT_CFG[projet.statut];

  return (
  <>
    <div
      onClick={() => onOpen(projet)}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        background: '#FFFFFF',
        border: '1px solid #E5E7EB',
        borderLeft: `4px solid ${cfg.color}`,
        borderRadius: 10,
        padding: '14px 16px',
        cursor: 'pointer',
        transition: 'box-shadow 0.2s, transform 0.1s',
        boxShadow: hovered ? '0 4px 16px rgba(0,0,0,0.12)' : '0 1px 4px rgba(0,0,0,0.06)',
        transform: hovered ? 'translateY(-1px)' : 'none',
        display: 'flex',
        flexDirection: 'column',
        gap: 10,
      }}
    >
      {/* Top row */}
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}>
        <div style={{
          width: 36, height: 36, borderRadius: 8,
          background: `${cfg.color}18`, display: 'flex',
          alignItems: 'center', justifyContent: 'center', flexShrink: 0,
        }}>
          <span style={{ fontSize: 18 }}>{cfg.emoji}</span>
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap', marginBottom: 4 }}>
            <span style={{ fontSize: 9, fontFamily: 'monospace', color: '#6B7280', background: '#F3F4F6', padding: '1px 6px', borderRadius: 3 }}>{projet.code}</span>
            <span style={{
              display: 'inline-flex', alignItems: 'center', gap: 3,
              fontSize: 9, fontWeight: 600, padding: '1px 7px', borderRadius: 20,
              background: `${stCfg.color}15`, color: stCfg.color,
            }}>
              <span style={{ width: 7, height: 7, borderRadius: '50%', background: stCfg.color, display: 'inline-block' }} />{stCfg.label}
            </span>
            <span style={{ fontSize: 9, padding: '1px 7px', borderRadius: 20, background: `${cfg.color}15`, color: cfg.color, fontWeight: 600 }}>{cfg.label}</span>
          </div>
          <div style={{ fontSize: 13, fontWeight: 700, color: '#111827', lineHeight: 1.3, marginBottom: 2 }} title={projet.nom}>{projet.nom}</div>
          <div style={{ fontSize: 11, color: '#6B7280' }} title={projet.description}>{projet.description}</div>
        </div>
        <ChevronRight size={14} style={{ color: '#9CA3AF', flexShrink: 0 }} />
      </div>

      {/* Meta row */}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px 12px', fontSize: 10, color: '#6B7280' }}>
        <span style={{ display: 'flex', alignItems: 'center', gap: 3 }}><User size={10} />{projet.chefProjet}</span>
        <span style={{ display: 'flex', alignItems: 'center', gap: 3 }}><MapPin size={10} />{projet.localisation}</span>
        <span style={{ display: 'flex', alignItems: 'center', gap: 3 }}><Calendar size={10} />Fin : {projet.dateFinPrevue}</span>
      </div>

      {/* Progress */}
      <DualProgressBar planned={projet.avancementPlanifie} actual={projet.avancement} color={cfg.color} />

      {/* Budget */}
      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
        <div style={{ flex: 1, background: '#F9FAFB', borderRadius: 6, padding: '6px 8px', minWidth: 70 }}>
          <div style={{ fontSize: 9, color: '#9CA3AF', marginBottom: 2 }}>Prévu</div>
          <div style={{ fontSize: 11, fontWeight: 700, color: '#111827' }}>{fmtMFCFA(projet.budget)}</div>
        </div>
        <div style={{ flex: 1, background: '#F9FAFB', borderRadius: 6, padding: '6px 8px', minWidth: 70 }}>
          <div style={{ fontSize: 9, color: '#9CA3AF', marginBottom: 2 }}>Engagé</div>
          <div style={{ fontSize: 11, fontWeight: 700, color: '#F47920' }}>{fmtMFCFA(projet.budgetEngage)}</div>
        </div>
        <div style={{ flex: 1, background: '#F9FAFB', borderRadius: 6, padding: '6px 8px', minWidth: 70 }}>
          <div style={{ fontSize: 9, color: '#9CA3AF', marginBottom: 2 }}>Décaissé</div>
          <div style={{ fontSize: 11, fontWeight: 700, color: projet.budget > 0 && projet.budgetDecaisse / projet.budget > 0.9 ? '#EF3340' : '#1B4F8A' }}>{fmtMFCFA(projet.budgetDecaisse)}</div>
        </div>
      </div>

      {/* Dates + CPI/SPI */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 6 }}>
        <div style={{ display: 'flex', gap: 4 }}>
          <KpiBadge label="CPI" value={projet.cpi.toFixed(2)} color={cpiColor(projet.cpi)} />
          <KpiBadge label="SPI" value={projet.spi.toFixed(2)} color={cpiColor(projet.spi)} />
        </div>
        <div style={{ display: 'flex', gap: 4, fontSize: 9, color: '#9CA3AF' }}>
          <span>Début: {projet.dateDebut}</span>
          <span>•</span>
          <span style={{ color: projet.dateFinEstimee > projet.dateFinPrevue ? '#EF3340' : '#16A34A' }}>
            Est.: {projet.dateFinEstimee}
          </span>
        </div>
      </div>

      {/* Action buttons */}
      <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap', borderTop: '1px solid #F3F4F6', paddingTop: 8 }}>
        {([
          { label: 'Planning',  Icon: BarChart,   route: '/gantt'   },
          { label: 'EVM',       Icon: TrendingUp, route: '/evm'     },
          { label: 'WBS',       Icon: GitBranch,  route: '/wbs'     },
          { label: 'Risques',   Icon: Shield,     route: '/risques' },
          { label: 'Documents', Icon: FileText,   route: '/ged'     },
          { label: 'Équipe',    Icon: Users,      route: '/rh'      },
        ] as { label: string; Icon: React.ElementType; route: string }[]).map(({ label, Icon, route }) => (
          <button
            key={label}
            onClick={e => { e.stopPropagation(); router.push(route); }}
            style={{
              display: 'inline-flex', alignItems: 'center', gap: 3,
              fontSize: 9, fontWeight: 600, padding: '3px 7px', borderRadius: 5,
              border: `1px solid ${cfg.color}40`, background: `${cfg.color}08`,
              color: cfg.color, cursor: 'pointer',
            }}
          >
            <Icon size={10} />{label}
          </button>
        ))}
        {/* Quick status change */}
        {projet.statut === 'suspendu' ? (
          <button
            onClick={e => { e.stopPropagation(); onStatusChange(projet.id, 'en_cours', 'Reprise du projet'); }}
            style={{
              display: 'inline-flex', alignItems: 'center', gap: 3,
              fontSize: 9, fontWeight: 700, padding: '3px 7px', borderRadius: 5,
              border: '1px solid #16A34A40', background: '#16A34A10',
              color: '#16A34A', cursor: 'pointer',
            }}
          ><Play size={10} /> Reprendre</button>
        ) : projet.statut !== 'termine' && projet.statut !== 'archive' ? (
          <button
            onClick={e => { e.stopPropagation(); setNewStatut(projet.statut); setShowStatusModal(true); }}
            style={{
              display: 'inline-flex', alignItems: 'center', gap: 3,
              fontSize: 9, fontWeight: 600, padding: '3px 7px', borderRadius: 5,
              border: '1px solid #D1D5DB', background: '#F9FAFB',
              color: '#6B7280', cursor: 'pointer',
            }}
          ><RefreshCw size={10} /> Statut</button>
        ) : null}
      </div>
    </div>

    {/* ── Status Change Modal ── */}
    {showStatusModal && (
      <>
        <div
          onClick={() => setShowStatusModal(false)}
          style={{ position: 'fixed', inset: 0, zIndex: 300, background: 'rgba(0,0,0,0.45)', backdropFilter: 'blur(2px)' }}
        />
        <div
          onClick={e => e.stopPropagation()}
          style={{
            position: 'fixed', top: '50%', left: '50%', transform: 'translate(-50%,-50%)',
            zIndex: 301, background: '#FFF', borderRadius: 14, padding: 24, width: 380,
            boxShadow: '0 20px 60px rgba(0,0,0,0.22)',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 18 }}>
            <div>
              <div style={{ fontSize: 14, fontWeight: 700, color: '#111827' }}>Changer le statut</div>
              <div style={{ fontSize: 10, color: '#9CA3AF', marginTop: 2 }}>{projet.nom}</div>
            </div>
            <button onClick={() => setShowStatusModal(false)} aria-label="Fermer la modale de statut"
              style={{ background: '#F3F4F6', border: 'none', borderRadius: 6, padding: 6, cursor: 'pointer', color: '#6B7280', display: 'flex' }}>
              <X size={14} />
            </button>
          </div>

          {/* Status options */}
          <div style={{ marginBottom: 16 }}>
            <div style={{ fontSize: 11, fontWeight: 600, color: '#374151', marginBottom: 8 }}>Nouveau statut</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {(Object.entries(STATUT_CFG) as [StatutProjet, { label: string; color: string }][]).map(([key, scfg]) => (
                  <button key={key} onClick={() => setNewStatut(key)}
                    style={{
                      display: 'flex', alignItems: 'center', gap: 10,
                      padding: '8px 12px', borderRadius: 8,
                      border: `1.5px solid ${newStatut === key ? scfg.color : '#E5E7EB'}`,
                      background: newStatut === key ? `${scfg.color}10` : '#FAFAFA',
                      cursor: 'pointer', textAlign: 'left', transition: 'all 0.15s',
                    }}
                  >
                    <span style={{ width: 14, height: 14, borderRadius: '50%', background: scfg.color, display: 'inline-block', flexShrink: 0 }} />
                    <span style={{ fontSize: 12, fontWeight: 600, color: scfg.color, flex: 1 }}>{scfg.label}</span>
                    {projet.statut === key && (
                      <span style={{ fontSize: 9, color: '#9CA3AF', background: '#F3F4F6', padding: '1px 6px', borderRadius: 4 }}>Actuel</span>
                    )}
                  </button>
              ))}
            </div>
          </div>

          {/* Reason */}
          <div style={{ marginBottom: 20 }}>
            <div style={{ fontSize: 11, fontWeight: 600, color: '#374151', marginBottom: 6 }}>
              Motif du changement <span style={{ color: '#EF3340' }}>*</span>
            </div>
            <textarea
              value={reason}
              onChange={e => setReason(e.target.value)}
              placeholder="Décrivez la raison du changement de statut (obligatoire)..."
              style={{
                width: '100%', boxSizing: 'border-box', padding: '8px 10px', fontSize: 12,
                border: `1px solid ${reason.trim() ? '#D1D5DB' : '#FBBF24'}`,
                borderRadius: 6, resize: 'vertical', minHeight: 72, outline: 'none',
                color: '#111827', fontFamily: 'inherit',
              }}
            />
          </div>

          <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
            <button onClick={() => setShowStatusModal(false)}
              style={{ padding: '7px 16px', fontSize: 11, fontWeight: 600, borderRadius: 6, border: '1px solid #D1D5DB', background: '#FFF', color: '#374151', cursor: 'pointer' }}>
              Annuler
            </button>
            <button
              disabled={!reason.trim() || newStatut === projet.statut}
              onClick={() => {
                if (reason.trim() && newStatut !== projet.statut) {
                  onStatusChange(projet.id, newStatut, reason);
                  setShowStatusModal(false);
                  setReason('');
                }
              }}
              style={{
                padding: '7px 16px', fontSize: 11, fontWeight: 700, borderRadius: 6, border: 'none',
                background: !reason.trim() || newStatut === projet.statut ? '#E5E7EB' : STATUT_CFG[newStatut].color,
                color: !reason.trim() || newStatut === projet.statut ? '#9CA3AF' : '#FFF',
                cursor: !reason.trim() || newStatut === projet.statut ? 'not-allowed' : 'pointer',
                opacity: !reason.trim() || newStatut === projet.statut ? 0.5 : 1,
                transition: 'background 0.15s',
              }}
            >Confirmer</button>
          </div>
        </div>
      </>
    )}
  </>
  );
}

/* ─────────────────────────── DETAIL DRAWER ──────────────────────────────── */

type DrawerTab = 'general' | 'planning' | 'budget' | 'equipe' | 'documents' | 'risques';

function DetailDrawer({ projet, onClose, ressources }: { projet: Projet; onClose: () => void; ressources: Ressource[] }) {
  const store = readOnlyGuard(useProjectStore(), isOperationalReadOnly(useAuth().user));
  const router = useRouter();
  const [tab, setTab] = useState<DrawerTab>('general');
  const [showEdit, setShowEdit] = useState(false);
  const [editForm, setEditForm] = useState<Partial<Projet>>({});
  const cfg = DOMAINE_CFG[projet.domaine];
  const stCfg = STATUT_CFG[projet.statut];

  const openEdit = () => {
    setEditForm({
      nom: projet.nom, description: projet.description, objectif: projet.objectif ?? '',
      chefProjet: projet.chefProjet, region: projet.region, localisation: projet.localisation,
      budget: projet.budget, budgetEngage: projet.budgetEngage, budgetDecaisse: projet.budgetDecaisse,
      dateDebut: projet.dateDebut, dateFinPrevue: projet.dateFinPrevue,
      priorite: projet.priorite, avancement: projet.avancement, cpi: projet.cpi, spi: projet.spi,
    });
    setShowEdit(true);
  };

  const handleSave = () => {
    store.updateProjet(projet.id, editForm);
    setShowEdit(false);
  };

  const pieData = [
    { name: 'Décaissé', value: projet.budgetDecaisse },
    { name: 'Engagé restant', value: Math.max(0, projet.budgetEngage - projet.budgetDecaisse) },
    { name: 'Non engagé', value: Math.max(0, projet.budget - projet.budgetEngage) },
  ];
  const pieColors = ['#1B4F8A', '#F47920', '#E5E7EB'];

  const budgetBarData = [
    { name: 'Prévu', value: projet.budget },
    { name: 'Engagé', value: projet.budgetEngage },
    { name: 'Décaissé', value: projet.budgetDecaisse },
  ];

  const tabs: { key: DrawerTab; label: string }[] = [
    { key: 'general',   label: 'Vue générale' },
    { key: 'planning',  label: 'Planning'     },
    { key: 'budget',    label: 'Budget'       },
    { key: 'equipe',    label: 'Équipe'       },
    { key: 'documents', label: 'Documents'    },
    { key: 'risques',   label: 'Risques'      },
  ];

  return (
    <>
      {/* Overlay */}
      <div
        onClick={onClose}
        style={{
          position: 'fixed', inset: 0, zIndex: 40,
          background: 'rgba(0,0,0,0.4)', backdropFilter: 'blur(2px)',
        }}
      />
      {/* Drawer */}
      <div style={{
        position: 'fixed', top: 0, right: 0, bottom: 0,
        width: 480, zIndex: 50, background: '#FFFFFF',
        boxShadow: '-4px 0 24px rgba(0,0,0,0.15)',
        display: 'flex', flexDirection: 'column', overflow: 'hidden',
      }}>
        {/* Header */}
        <div style={{ background: cfg.color, padding: '16px 18px', flexShrink: 0 }}>
          <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
            <div style={{ flex: 1 }}>
              <div style={{ display: 'flex', gap: 6, marginBottom: 6, flexWrap: 'wrap' }}>
                <span style={{ fontSize: 9, fontFamily: 'monospace', background: 'rgba(255,255,255,0.2)', color: '#FFF', padding: '1px 7px', borderRadius: 3 }}>{projet.code}</span>
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: 3, fontSize: 9, fontWeight: 600, background: 'rgba(255,255,255,0.2)', color: '#FFF', padding: '1px 7px', borderRadius: 20 }}>
                  <span style={{ width: 7, height: 7, borderRadius: '50%', background: '#FFF', display: 'inline-block' }} />{stCfg.label}
                </span>
              </div>
              <div style={{ fontSize: 16, fontWeight: 700, color: '#FFF', lineHeight: 1.3 }}>{projet.nom}</div>
              <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.8)', marginTop: 3 }}>{cfg.label}</div>
            </div>
            <div style={{ display: 'flex', gap: 6 }}>
              <button onClick={() => { onClose(); router.push(`/cockpit-projet?id=${projet.id}`); }} style={{ background: 'rgba(255,255,255,0.2)', border: '1px solid rgba(255,255,255,0.3)', borderRadius: 6, padding: '5px 10px', cursor: 'pointer', color: '#FFF', display: 'flex', alignItems: 'center', gap: 4, fontSize: 11, fontWeight: 600 }}>
                ✏️ Modifier
              </button>
              <button onClick={() => { onClose(); router.push('/gantt'); }} style={{ background: 'rgba(255,255,255,0.2)', border: '1px solid rgba(255,255,255,0.3)', borderRadius: 6, padding: '5px 10px', cursor: 'pointer', color: '#FFF', display: 'flex', alignItems: 'center', gap: 4, fontSize: 11, fontWeight: 600 }}>
                📅 Planning
              </button>
              <button onClick={onClose} aria-label="Fermer le panneau de détail" style={{ background: 'rgba(255,255,255,0.2)', border: 'none', borderRadius: 6, padding: 6, cursor: 'pointer', color: '#FFF', display: 'flex' }}>
                <X size={16} />
              </button>
            </div>
          </div>
          {/* Mini KPIs */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 8, marginTop: 12 }}>
            {[
              { label: 'Avancement', value: `${projet.avancement}%` },
              { label: 'CPI', value: projet.cpi.toFixed(2) },
              { label: 'SPI', value: projet.spi.toFixed(2) },
              { label: 'Budget', value: `${projet.budget}M` },
            ].map(k => (
              <div key={k.label} style={{ background: 'rgba(255,255,255,0.15)', borderRadius: 6, padding: '6px 8px', textAlign: 'center' }}>
                <div style={{ fontSize: 9, color: 'rgba(255,255,255,0.7)', marginBottom: 2 }}>{k.label}</div>
                <div style={{ fontSize: 14, fontWeight: 700, color: '#FFF' }}>{k.value}</div>
              </div>
            ))}
          </div>
        </div>

        {/* Tabs */}
        <div style={{ display: 'flex', overflowX: 'auto', borderBottom: '1px solid #E5E7EB', background: '#FAFAFA', flexShrink: 0 }}>
          {tabs.map(t => (
            <button key={t.key} onClick={() => setTab(t.key)}
              style={{
                padding: '9px 14px', fontSize: 11, fontWeight: 600, border: 'none',
                background: 'transparent', cursor: 'pointer', whiteSpace: 'nowrap',
                color: tab === t.key ? cfg.color : '#6B7280',
                borderBottom: tab === t.key ? `2px solid ${cfg.color}` : '2px solid transparent',
              }}
            >{t.label}</button>
          ))}
        </div>

        {/* Content */}
        <div style={{ flex: 1, overflowY: 'auto', padding: 18 }}>
          {tab === 'general' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              {/* Progress donut */}
              <div style={{ background: '#F9FAFB', borderRadius: 10, padding: 14 }}>
                <div style={{ fontSize: 12, fontWeight: 600, color: '#374151', marginBottom: 10 }}>Avancement global</div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
                  <ResponsiveContainer width={100} height={100}>
                    <PieChart>
                      <Pie data={[{ value: projet.avancement }, { value: 100 - projet.avancement }]}
                        dataKey="value" startAngle={90} endAngle={-270} innerRadius={32} outerRadius={46}>
                        <Cell fill={cfg.color} />
                        <Cell fill="#E5E7EB" />
                      </Pie>
                    </PieChart>
                  </ResponsiveContainer>
                  <div>
                    <div style={{ fontSize: 28, fontWeight: 800, color: cfg.color }}>{projet.avancement}%</div>
                    <div style={{ fontSize: 11, color: '#9CA3AF' }}>Réalisé</div>
                    <div style={{ fontSize: 11, color: '#9CA3AF', marginTop: 4 }}>Planifié : {projet.avancementPlanifie}%</div>
                  </div>
                </div>
              </div>
              {/* Budget donut */}
              <div style={{ background: '#F9FAFB', borderRadius: 10, padding: 14 }}>
                <div style={{ fontSize: 12, fontWeight: 600, color: '#374151', marginBottom: 10 }}>Répartition budget</div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
                  <ResponsiveContainer width={100} height={100}>
                    <PieChart>
                      <Pie data={pieData} dataKey="value" innerRadius={28} outerRadius={46}>
                        {pieData.map((_, i) => <Cell key={i} fill={pieColors[i]} />)}
                      </Pie>
                    </PieChart>
                  </ResponsiveContainer>
                  <div style={{ flex: 1 }}>
                    {pieData.map((d, i) => (
                      <div key={d.name} style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4 }}>
                        <div style={{ width: 8, height: 8, borderRadius: 2, background: pieColors[i], flexShrink: 0 }} />
                        <span style={{ fontSize: 10, color: '#6B7280', flex: 1 }}>{d.name}</span>
                        <span style={{ fontSize: 10, fontWeight: 700, color: '#111827' }}>{d.value.toFixed(1)}M</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
              {/* Info grid */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                {[
                  ['Chef de projet', projet.chefProjet],
                  ['Localisation', projet.localisation],
                  ['Date début', projet.dateDebut],
                  ['Fin prévue', projet.dateFinPrevue],
                  ['Fin estimée', projet.dateFinEstimee],
                  ['Priorité', projet.priorite],
                ].map(([l, v]) => (
                  <div key={l} style={{ background: '#F9FAFB', borderRadius: 6, padding: '8px 10px' }}>
                    <div style={{ fontSize: 9, color: '#9CA3AF', marginBottom: 2 }}>{l}</div>
                    <div style={{ fontSize: 11, fontWeight: 600, color: '#111827' }}>{v}</div>
                  </div>
                ))}
              </div>
              {/* Geographic location map */}
              <div style={{ background: '#F9FAFB', borderRadius: 10, padding: 10 }}>
                <div style={{ fontSize: 12, fontWeight: 700, color: '#1B4F8A', display: 'flex', alignItems: 'center', gap: 6, marginBottom: 8 }}>
                  🗺️ Localisation — {projet.localisation}
                </div>
                <ProjetsCarteLeaflet
                  projets={[{
                    id: projet.id,
                    nom: projet.nom,
                    code: projet.code,
                    region: projet.region,
                    domaine: projet.domaine,
                    statut: projet.statut,
                    avancement: projet.avancement,
                    budget: projet.budget,
                    lat: (projet as any).lat,
                    lng: (projet as any).lng,
                  }]}
                  height={200}
                />
              </div>
              {/* Quick links */}
              <div style={{ display: 'flex', gap: 8 }}>
                {([
                  { label: 'Voir Gantt complet', route: '/gantt' },
                  { label: 'Analyse EVM', route: '/evm' },
                  { label: 'WBS détaillé', route: '/wbs' },
                ] as { label: string; route: string }[]).map(({ label, route }) => (
                  <button key={label} onClick={() => { onClose(); router.push(route); }} style={{
                    flex: 1, fontSize: 10, fontWeight: 600, padding: '7px 4px', borderRadius: 6,
                    border: `1px solid ${cfg.color}`, background: `${cfg.color}10`, color: cfg.color, cursor: 'pointer',
                  }}>{label}</button>
                ))}
              </div>
            </div>
          )}

          {tab === 'planning' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <div style={{ fontSize: 12, fontWeight: 600, color: '#374151' }}>Jalons principaux</div>
              {projet.jalons.map((j, i) => (
                <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 12px', background: '#F9FAFB', borderRadius: 8, border: '1px solid #E5E7EB' }}>
                  <div style={{ width: 28, height: 28, borderRadius: '50%', background: cfg.color, color: '#FFF', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 700, flexShrink: 0 }}>{i + 1}</div>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 12, fontWeight: 600, color: '#111827' }}>{j.label}</div>
                    <div style={{ fontSize: 10, color: '#9CA3AF' }}>{j.date}</div>
                  </div>
                  <CheckCircle size={14} style={{ color: '#16A34A' }} />
                </div>
              ))}
              <div style={{ padding: 12, background: '#EFF6FF', borderRadius: 8, fontSize: 11, color: '#1D4ED8' }}>
                Début : {projet.dateDebut} → Fin prévue : {projet.dateFinPrevue} → Fin estimée : {projet.dateFinEstimee}
              </div>
            </div>
          )}

          {tab === 'budget' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              <div style={{ fontSize: 12, fontWeight: 600, color: '#374151' }}>Analyse budgétaire (MFCFA)</div>
              <ResponsiveContainer width="100%" height={160}>
                <ReBarChart data={budgetBarData} margin={{ top: 0, right: 0, left: -20, bottom: 0 }}>
                  <XAxis dataKey="name" tick={{ fontSize: 10 }} />
                  <YAxis tick={{ fontSize: 10 }} />
                  <Tooltip formatter={(v: number) => [`${v.toFixed(1)} MFCFA`]} />
                  <Bar dataKey="value" radius={[4, 4, 0, 0]}>
                    {budgetBarData.map((_, i) => <Cell key={i} fill={['#1B4F8A', '#F47920', '#16A34A'][i]} />)}
                  </Bar>
                </ReBarChart>
              </ResponsiveContainer>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 8 }}>
                {[
                  { label: 'Budget prévu', value: fmtMFCFA(projet.budget), color: '#1B4F8A' },
                  { label: 'Engagé', value: fmtMFCFA(projet.budgetEngage), color: '#F47920' },
                  { label: 'Décaissé', value: fmtMFCFA(projet.budgetDecaisse), color: '#16A34A' },
                ].map(b => (
                  <div key={b.label} style={{ background: '#F9FAFB', borderRadius: 8, padding: '10px 10px', textAlign: 'center' }}>
                    <div style={{ fontSize: 9, color: '#9CA3AF', marginBottom: 4 }}>{b.label}</div>
                    <div style={{ fontSize: 13, fontWeight: 700, color: b.color }}>{b.value}</div>
                  </div>
                ))}
              </div>
              <div style={{ display: 'flex', gap: 8 }}>
                <KpiBadge label="CPI" value={projet.cpi.toFixed(2)} color={cpiColor(projet.cpi)} />
                <KpiBadge label="SPI" value={projet.spi.toFixed(2)} color={cpiColor(projet.spi)} />
              </div>
            </div>
          )}

          {tab === 'equipe' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              <div style={{ fontSize: 12, fontWeight: 600, color: '#374151' }}>Membres de l'équipe</div>
              {projet.equipe.length === 0 && (
                <div style={{ fontSize: 11, color: '#9CA3AF', padding: '12px 0' }}>Aucun membre affecté</div>
              )}
              {projet.equipe.map(rid => {
                const r = ressources.find(res => res.id === rid);
                const displayName = r ? `${r.prenom} ${r.nom}`.trim() : rid;
                const initial = displayName.charAt(0).toUpperCase();
                return (
                  <div key={rid} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 12px', background: '#F9FAFB', borderRadius: 8 }}>
                    <div style={{ width: 32, height: 32, borderRadius: '50%', background: cfg.color, color: '#FFF', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, fontWeight: 700, flexShrink: 0 }}>
                      {initial}
                    </div>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: 12, fontWeight: 600, color: '#111827' }}>{displayName}</div>
                      <div style={{ fontSize: 10, color: '#6B7280' }}>
                        {r ? `${r.direction ?? ''} — ${r.tauxHoraire.toLocaleString()} FCFA/h` : 'Ressource introuvable'}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {tab === 'documents' && (
            <div style={{ textAlign: 'center', padding: '32px 0', color: '#9CA3AF' }}>
              <FileText size={36} style={{ margin: '0 auto 10px', display: 'block', opacity: 0.4 }} />
              <div style={{ fontSize: 12 }}>Aucun document associé</div>
            </div>
          )}

          {tab === 'risques' && (
            <div style={{ textAlign: 'center', padding: '32px 0', color: '#9CA3AF' }}>
              <Shield size={36} style={{ margin: '0 auto 10px', display: 'block', opacity: 0.4 }} />
              <div style={{ fontSize: 12 }}>Aucun risque enregistré</div>
            </div>
          )}
        </div>
      </div>

      {/* ── EDIT MODAL ── */}
      {showEdit && (
        <>
          <div onClick={() => setShowEdit(false)} style={{ position: 'fixed', inset: 0, zIndex: 100, background: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(2px)' }} />
          <div style={{ position: 'fixed', top: '50%', left: '50%', transform: 'translate(-50%,-50%)', zIndex: 101, background: '#fff', borderRadius: 14, width: 620, maxHeight: '88vh', display: 'flex', flexDirection: 'column', boxShadow: '0 24px 64px rgba(0,0,0,0.25)' }}>
            <div style={{ background: cfg.color, padding: '14px 18px', borderRadius: '14px 14px 0 0', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0 }}>
              <div>
                <div style={{ fontSize: 14, fontWeight: 700, color: '#fff' }}>✏️ Modifier le projet</div>
                <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.7)', marginTop: 2 }}>{projet.code}</div>
              </div>
              <button onClick={() => setShowEdit(false)} aria-label="Annuler la modification" style={{ background: 'rgba(255,255,255,0.2)', border: 'none', borderRadius: 6, padding: 6, cursor: 'pointer', color: '#fff', display: 'flex' }}><X size={14} /></button>
            </div>
            <div style={{ overflowY: 'auto', padding: '18px', display: 'flex', flexDirection: 'column', gap: 12, flex: 1 }}>
              {[
                ['Nom du projet', 'nom', 'text'],
                ['Chef de projet', 'chefProjet', 'text'],
                ['Région / Localisation', 'region', 'text'],
              ].map(([label, key, type]) => (
                <div key={key}>
                  <label style={{ fontSize: 11, fontWeight: 600, color: '#374151', display: 'block', marginBottom: 3 }}>{label}</label>
                  <input type={type as string} value={String((editForm as Record<string, unknown>)[key] ?? '')} onChange={e => setEditForm(prev => ({ ...prev, [key]: e.target.value }))}
                    style={{ width: '100%', boxSizing: 'border-box', padding: '7px 10px', fontSize: 12, border: '1px solid #D1D5DB', borderRadius: 6, color: '#111827', outline: 'none' }} />
                </div>
              ))}
              <div>
                <label style={{ fontSize: 11, fontWeight: 600, color: '#374151', display: 'block', marginBottom: 3 }}>Description</label>
                <textarea value={String(editForm.description ?? '')} onChange={e => setEditForm(prev => ({ ...prev, description: e.target.value }))}
                  style={{ width: '100%', boxSizing: 'border-box', padding: '7px 10px', fontSize: 12, border: '1px solid #D1D5DB', borderRadius: 6, color: '#111827', outline: 'none', minHeight: 64, resize: 'vertical', fontFamily: 'inherit' }} />
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 10 }}>
                {([['Budget (MFCFA)', 'budget'],['Engagé (MFCFA)', 'budgetEngage'],['Décaissé (MFCFA)', 'budgetDecaisse']] as [string, keyof Projet][]).map(([label, key]) => (
                  <div key={String(key)}>
                    <label style={{ fontSize: 11, fontWeight: 600, color: '#374151', display: 'block', marginBottom: 3 }}>{label}</label>
                    <input type="number" step="any" value={String((editForm as Record<string, unknown>)[key] ?? '')} onChange={e => setEditForm(prev => ({ ...prev, [key]: parseFloat(e.target.value) || 0 }))}
                      style={{ width: '100%', boxSizing: 'border-box', padding: '7px 10px', fontSize: 12, border: '1px solid #D1D5DB', borderRadius: 6, color: '#111827', outline: 'none' }} />
                  </div>
                ))}
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                {([['Date début', 'dateDebut'],['Date fin prévue', 'dateFinPrevue']] as [string, keyof Projet][]).map(([label, key]) => (
                  <div key={String(key)}>
                    <label style={{ fontSize: 11, fontWeight: 600, color: '#374151', display: 'block', marginBottom: 3 }}>{label}</label>
                    <input type="date" value={String((editForm as Record<string, unknown>)[key] ?? '')} onChange={e => setEditForm(prev => ({ ...prev, [key]: e.target.value }))}
                      style={{ width: '100%', boxSizing: 'border-box', padding: '7px 10px', fontSize: 12, border: '1px solid #D1D5DB', borderRadius: 6, color: '#111827', outline: 'none' }} />
                  </div>
                ))}
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', gap: 10 }}>
                {([['Avancement (%)', 'avancement'],['CPI', 'cpi'],['SPI', 'spi']] as [string, keyof Projet][]).map(([label, key]) => (
                  <div key={String(key)}>
                    <label style={{ fontSize: 11, fontWeight: 600, color: '#374151', display: 'block', marginBottom: 3 }}>{label}</label>
                    <input type="number" step="any" value={String((editForm as Record<string, unknown>)[key] ?? '')} onChange={e => setEditForm(prev => ({ ...prev, [key]: parseFloat(e.target.value) || 0 }))}
                      style={{ width: '100%', boxSizing: 'border-box', padding: '7px 10px', fontSize: 12, border: '1px solid #D1D5DB', borderRadius: 6, color: '#111827', outline: 'none' }} />
                  </div>
                ))}
                <div>
                  <label style={{ fontSize: 11, fontWeight: 600, color: '#374151', display: 'block', marginBottom: 3 }}>Priorité</label>
                  <select value={String(editForm.priorite ?? 'Moyenne')} onChange={e => setEditForm(prev => ({ ...prev, priorite: e.target.value as Priorite }))}
                    style={{ width: '100%', boxSizing: 'border-box', padding: '7px 10px', fontSize: 12, border: '1px solid #D1D5DB', borderRadius: 6, color: '#111827', outline: 'none' }}>
                    <option value="Haute">Haute</option><option value="Moyenne">Moyenne</option><option value="Faible">Faible</option>
                  </select>
                </div>
              </div>
            </div>
            <div style={{ padding: '12px 18px', borderTop: '1px solid #E5E7EB', display: 'flex', gap: 8, justifyContent: 'flex-end', flexShrink: 0 }}>
              <button onClick={() => setShowEdit(false)} style={{ padding: '7px 16px', fontSize: 11, fontWeight: 600, borderRadius: 6, border: '1px solid #D1D5DB', background: '#fff', color: '#374151', cursor: 'pointer' }}>Annuler</button>
              <button onClick={handleSave} style={{ padding: '7px 18px', fontSize: 11, fontWeight: 700, borderRadius: 6, border: 'none', background: cfg.color, color: '#fff', cursor: 'pointer' }}>💾 Enregistrer</button>
            </div>
          </div>
        </>
      )}
    </>
  );
}

/* ─────────────────────────── WIZARD MODAL ───────────────────────────────── */

interface WizardForm {
  domaine: Domaine | '';
  nom: string;
  code: string;
  description: string;
  localisation: string;
  chefProjet: string;
  dateDebut: string;
  dateFinPrevue: string;
  priorite: Priorite;
  bailleur: Bailleur | '';
  montantPrevu: string;
  montantEngage: string;
  devise: Devise;
  tauxChange: string;
  categorie: Categorie;
  wbsChecked: string[];
  equipe: TeamMember[];
  jalons: WizardJalon[];
  kpis: string[];
}

const DEFAULT_FORM: WizardForm = {
  domaine: '',
  nom: '', code: '', description: '',
  localisation: '', chefProjet: '',
  dateDebut: '', dateFinPrevue: '',
  priorite: 'Moyenne',
  bailleur: '', montantPrevu: '', montantEngage: '',
  devise: 'FCFA', tauxChange: '',
  categorie: 'Investissement',
  wbsChecked: [],
  equipe: [],
  jalons: [],
  kpis: ['CPI', 'SPI', 'Budget', 'Délai'],
};

function WizardModal({ onClose }: { onClose: () => void }) {
  const store = readOnlyGuard(useProjectStore(), isOperationalReadOnly(useAuth().user));
  const [step, setStep] = useState(1);
  const [form, setForm] = useState<WizardForm>(DEFAULT_FORM);
  const [newMemberRole, setNewMemberRole] = useState<Role>('Ingénieur');
  const [newMemberNom, setNewMemberNom] = useState('');
  const [newMemberAlloc, setNewMemberAlloc] = useState('100');

  /* ── Priorisation multi-critères pondérée (grille gouvernance DPE/PMO/Admin) ── */
  const govCriteres = useCriteriaStore(s => s.prioritization);
  // Initialise la grille du projet depuis le référentiel de gouvernance (labels + poids),
  // notes à 3 par défaut. Si le référentiel est vide, repli sur la grille PMI standard.
  const [critList, setCritList] = useState<PrioCritere[]>(() =>
    (govCriteres.length ? govCriteres.map(c => ({ id: c.id, label: c.label, poids: c.poids, note: 3 })) : DEFAULT_CRITERES)
  );
  const [newCritLabel, setNewCritLabel] = useState('');
  const poidsTotal = critList.reduce((s, c) => s + c.poids, 0);
  // Score pondéré normalisé sur 100 : Σ(note×poids)/Σpoids × 20  (notes sur 5)
  const scorePondere = poidsTotal > 0
    ? Math.round((critList.reduce((s, c) => s + c.note * c.poids, 0) / poidsTotal) * 20)
    : 0;
  const prioriteCalc: Priorite = scorePondere >= 75 ? 'Haute' : scorePondere >= 50 ? 'Moyenne' : 'Faible';
  const [prioForcee, setPrioForcee] = useState<Priorite | null>(null);
  const prioriteAuto: Priorite = prioForcee ?? prioriteCalc;
  const updateCrit = (id: string, patch: Partial<PrioCritere>) =>
    setCritList(prev => prev.map(c => c.id === id ? { ...c, ...patch } : c));
  const removeCrit = (id: string) => setCritList(prev => prev.filter(c => c.id !== id));
  const addCrit = () => {
    if (!newCritLabel.trim()) return;
    setCritList(prev => [...prev, { id: `c${Date.now()}`, label: newCritLabel.trim(), poids: 10, note: 3 }]);
    setNewCritLabel('');
  };

  const totalSteps = 6;
  const progress = ((step - 1) / (totalSteps - 1)) * 100;

  const updateForm = useCallback(<K extends keyof WizardForm>(key: K, value: WizardForm[K]) => {
    setForm(prev => ({ ...prev, [key]: value }));
  }, []);

  const handleDomainSelect = useCallback((d: Domaine) => {
    const code = genCode(d);
    const wbs = WBS_TEMPLATES[d];
    setForm(prev => ({ ...prev, domaine: d, code, wbsChecked: [...wbs] }));
    setStep(2);
  }, []);

  const toggleWbs = useCallback((item: string) => {
    setForm(prev => ({
      ...prev,
      wbsChecked: prev.wbsChecked.includes(item)
        ? prev.wbsChecked.filter(i => i !== item)
        : [...prev.wbsChecked, item],
    }));
  }, []);

  const toggleKpi = useCallback((kpi: string) => {
    setForm(prev => ({
      ...prev,
      kpis: prev.kpis.includes(kpi)
        ? prev.kpis.filter(k => k !== kpi)
        : [...prev.kpis, kpi],
    }));
  }, []);

  const addMember = useCallback(() => {
    if (!newMemberNom.trim()) return;
    const member: TeamMember = {
      id: `m${Date.now()}`,
      role: newMemberRole,
      nom: newMemberNom.trim(),
      allocation: parseInt(newMemberAlloc, 10) || 100,
    };
    setForm(prev => ({ ...prev, equipe: [...prev.equipe, member] }));
    setNewMemberNom('');
    setNewMemberAlloc('100');
  }, [newMemberNom, newMemberRole, newMemberAlloc]);

  const removeMember = useCallback((id: string) => {
    setForm(prev => ({ ...prev, equipe: prev.equipe.filter(m => m.id !== id) }));
  }, []);

  const canNext = useMemo(() => {
    if (step === 1) return form.domaine !== '';
    if (step === 2) return form.nom.trim() !== '' && form.localisation !== '' && form.dateDebut !== '' && form.dateFinPrevue !== '';
    if (step === 3) return form.bailleur !== '' && form.montantPrevu.trim() !== '';
    return true;
  }, [step, form]);

  const handleFinish = useCallback(() => {
    if (form.domaine === '') return;
    store.createProjet({
      domaine: form.domaine as Domaine,
      nom: form.nom,
      code: form.code,
      description: form.description,
      objectif: '',
      chefProjet: form.chefProjet || 'À définir',
      localisation: form.localisation,
      region: form.localisation,
      avancement: 0,
      avancementPlanifie: 0,
      budget: parseFloat(form.montantPrevu) || 0,
      budgetEngage: parseFloat(form.montantEngage) || 0,
      budgetDecaisse: 0,
      dateDebut: form.dateDebut,
      dateFinPrevue: form.dateFinPrevue,
      dateFinEstimee: form.dateFinPrevue,
      statut: 'planifie' as const,
      priorite: prioriteAuto,
      cpi: 1.00,
      spi: 1.00,
      bailleurs: form.bailleur
        ? [{ nom: form.bailleur, montant: parseFloat(form.montantPrevu) || 0, devise: form.devise as 'FCFA' | 'EUR' | 'USD', pourcentage: 100 }]
        : [],
      equipe: [],
      jalons: form.jalons.map(j => ({ ...j, atteint: false })),
    });
    onClose();
  }, [form, store, onClose, prioriteAuto]);

  const inputStyle: React.CSSProperties = {
    width: '100%', boxSizing: 'border-box',
    padding: '8px 10px', fontSize: 12,
    border: '1px solid #D1D5DB', borderRadius: 6,
    background: '#FFF', color: '#111827',
    outline: 'none',
  };

  const labelStyle: React.CSSProperties = {
    fontSize: 11, fontWeight: 600, color: '#374151', marginBottom: 4, display: 'block',
  };

  return (
    <>
      <div onClick={onClose} style={{ position: 'fixed', inset: 0, zIndex: 50, background: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(3px)' }} />
      <div style={{
        position: 'fixed', inset: 0, zIndex: 51,
        display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '0 16px',
      }}>
        <div style={{
          width: '100%', maxWidth: 640,
          background: '#FFF', borderRadius: 14,
          boxShadow: '0 20px 60px rgba(0,0,0,0.2)',
          display: 'flex', flexDirection: 'column',
          maxHeight: '92vh', overflow: 'hidden',
        }}>
          {/* Wizard header */}
          <div style={{ background: '#1B4F8A', padding: '16px 20px', flexShrink: 0 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
              <div style={{ fontSize: 16, fontWeight: 700, color: '#FFF' }}>
                Nouveau Projet — Étape {step} / {totalSteps}
              </div>
              <button onClick={onClose} aria-label="Fermer le wizard" style={{ background: 'rgba(255,255,255,0.2)', border: 'none', borderRadius: 6, padding: 6, cursor: 'pointer', color: '#FFF', display: 'flex' }}>
                <X size={16} />
              </button>
            </div>
            {/* Step labels */}
            <div style={{ display: 'flex', gap: 4, marginBottom: 10 }}>
              {['Domaine', 'Infos', 'Budget', 'Priorité', 'WBS', 'Équipe'].map((s, i) => (
                <div key={s} style={{
                  flex: 1, textAlign: 'center', fontSize: 9, fontWeight: 600,
                  color: step === i + 1 ? '#F47920' : step > i + 1 ? 'rgba(255,255,255,0.8)' : 'rgba(255,255,255,0.4)',
                }}>{s}</div>
              ))}
            </div>
            {/* Progress bar */}
            <div style={{ height: 4, background: 'rgba(255,255,255,0.2)', borderRadius: 99, overflow: 'hidden' }}>
              <div style={{ width: `${progress}%`, height: '100%', background: '#F47920', borderRadius: 99, transition: 'width 0.3s' }} />
            </div>
          </div>

          {/* Step content */}
          <div style={{ flex: 1, overflowY: 'auto', padding: 20 }}>

            {/* Step 1: Domain */}
            {step === 1 && (
              <div>
                <div style={{ fontSize: 14, fontWeight: 700, color: '#111827', marginBottom: 16 }}>Choisissez le domaine du projet</div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                  {(Object.entries(DOMAINE_CFG) as [Domaine, typeof DOMAINE_CFG[Domaine]][]).map(([key, cfg]) => (
                    <button
                      key={key}
                      onClick={() => handleDomainSelect(key)}
                      style={{
                        padding: '20px 16px', borderRadius: 10, cursor: 'pointer',
                        border: `2px solid ${form.domaine === key ? cfg.color : '#E5E7EB'}`,
                        background: form.domaine === key ? `${cfg.color}10` : '#FAFAFA',
                        textAlign: 'left', transition: 'all 0.15s',
                      }}
                    >
                      <div style={{ fontSize: 24, marginBottom: 6 }}>{cfg.emoji}</div>
                      <div style={{ fontSize: 13, fontWeight: 700, color: cfg.color, marginBottom: 4 }}>{cfg.label}</div>
                      <div style={{ fontSize: 11, color: '#6B7280' }}>{cfg.desc}</div>
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Step 2: General info */}
            {step === 2 && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                <div style={{ fontSize: 14, fontWeight: 700, color: '#111827' }}>Informations générales</div>
                <div>
                  <label style={labelStyle}>Nom du projet *</label>
                  <input style={inputStyle} value={form.nom} onChange={e => updateForm('nom', e.target.value)} placeholder="Ex: Ligne THT 225 kV Tobène-Thiès" />
                </div>
                <div>
                  <label style={labelStyle}>Code projet (auto-généré)</label>
                  <input style={{ ...inputStyle, background: '#F3F4F6', color: '#6B7280' }} value={form.code} readOnly />
                </div>
                <div>
                  <label style={labelStyle}>Description</label>
                  <textarea style={{ ...inputStyle, minHeight: 60, resize: 'vertical' }} value={form.description} onChange={e => updateForm('description', e.target.value)} placeholder="Description du projet..." />
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                  <div>
                    <label style={labelStyle}>Localisation *</label>
                    <select style={inputStyle} value={form.localisation} onChange={e => updateForm('localisation', e.target.value)}>
                      <option value="">-- Région --</option>
                      {REGIONS.map(r => <option key={r} value={r}>{r}</option>)}
                    </select>
                  </div>
                  <div>
                    <label style={labelStyle}>Chef de projet</label>
                    <select style={inputStyle} value={form.chefProjet} onChange={e => updateForm('chefProjet', e.target.value)}>
                      <option value="">-- Sélectionner --</option>
                      {CHEFS.map(c => <option key={c} value={c}>{c}</option>)}
                    </select>
                  </div>
                  <div>
                    <label style={labelStyle}>Date début *</label>
                    <input type="date" style={inputStyle} value={form.dateDebut} onChange={e => updateForm('dateDebut', e.target.value)} />
                  </div>
                  <div>
                    <label style={labelStyle}>Date fin prévue *</label>
                    <input type="date" style={inputStyle} value={form.dateFinPrevue} onChange={e => updateForm('dateFinPrevue', e.target.value)} />
                  </div>
                  <div>
                    <label style={labelStyle}>Durée calculée</label>
                    <input style={{ ...inputStyle, background: '#F3F4F6', color: '#6B7280' }} readOnly
                      value={form.dateDebut && form.dateFinPrevue
                        ? `${Math.round((new Date(form.dateFinPrevue).getTime() - new Date(form.dateDebut).getTime()) / 86400000)} jours`
                        : '—'} />
                  </div>
                  <div>
                    <label style={labelStyle}>Priorité</label>
                    <input style={{ ...inputStyle, background: '#F3F4F6', color: '#6B7280' }} readOnly value="Définie à l'étape Priorité →" />
                  </div>
                </div>
              </div>
            )}

            {/* Step 3: Financing */}
            {step === 3 && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                <div style={{ fontSize: 14, fontWeight: 700, color: '#111827' }}>Financement</div>
                <div>
                  <label style={labelStyle}>Bailleur principal *</label>
                  <select style={inputStyle} value={form.bailleur} onChange={e => updateForm('bailleur', e.target.value as Bailleur)}>
                    <option value="">-- Sélectionner --</option>
                    {BAILLEURS.map(b => <option key={b} value={b}>{b}</option>)}
                  </select>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                  <div>
                    <label style={labelStyle}>Montant prévu (MFCFA) *</label>
                    <input type="number" step="0.1" style={inputStyle} value={form.montantPrevu} onChange={e => updateForm('montantPrevu', e.target.value)} placeholder="0.0" />
                  </div>
                  <div>
                    <label style={labelStyle}>Montant engagé (MFCFA)</label>
                    <input type="number" step="0.1" style={inputStyle} value={form.montantEngage} onChange={e => updateForm('montantEngage', e.target.value)} placeholder="0.0" />
                  </div>
                  <div>
                    <label style={labelStyle}>Taux décaissement (%)</label>
                    <input style={{ ...inputStyle, background: '#F3F4F6', color: '#6B7280' }} readOnly
                      value={form.montantPrevu && form.montantEngage && parseFloat(form.montantPrevu) > 0
                        ? `${Math.round((parseFloat(form.montantEngage) / parseFloat(form.montantPrevu)) * 100)}%`
                        : '0%'} />
                  </div>
                  <div>
                    <label style={labelStyle}>Devise</label>
                    <select style={inputStyle} value={form.devise} onChange={e => updateForm('devise', e.target.value as Devise)}>
                      <option value="FCFA">FCFA</option>
                      <option value="EUR">EUR</option>
                      <option value="USD">USD</option>
                    </select>
                  </div>
                  {form.devise !== 'FCFA' && (
                    <div>
                      <label style={labelStyle}>Taux de change</label>
                      <input type="number" style={inputStyle} value={form.tauxChange} onChange={e => updateForm('tauxChange', e.target.value)} placeholder="Ex: 655.957" />
                    </div>
                  )}
                  <div>
                    <label style={labelStyle}>Catégorie</label>
                    <select style={inputStyle} value={form.categorie} onChange={e => updateForm('categorie', e.target.value as Categorie)}>
                      <option value="Investissement">Investissement</option>
                      <option value="Fonctionnement">Fonctionnement</option>
                      <option value="Mixte">Mixte</option>
                    </select>
                  </div>
                </div>
              </div>
            )}

            {/* Step 4: Priorisation multi-critères pondérée (arbitrage portefeuille DPE) */}
            {step === 4 && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                <div>
                  <div style={{ fontSize: 14, fontWeight: 700, color: '#111827' }}>Priorisation & arbitrage de portefeuille</div>
                  <div style={{ fontSize: 11, color: '#6B7280', marginTop: 3 }}>
                    Grille de scoring pondérée (réf. PMI — <i>Standard for Portfolio Management</i>). Notez chaque critère de 1 à 5 ; les poids sont ajustables selon le contexte. La priorité est calculée automatiquement.
                  </div>
                </div>

                {/* En-tête grille */}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 90px 130px 70px 28px', gap: 8, padding: '0 4px', fontSize: 9.5, fontWeight: 700, color: '#94A3B8', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                  <span>Critère d&apos;arbitrage</span>
                  <span style={{ textAlign: 'center' }}>Poids %</span>
                  <span style={{ textAlign: 'center' }}>Note (1–5)</span>
                  <span style={{ textAlign: 'right' }}>Pondéré</span>
                  <span />
                </div>

                {critList.map(c => (
                  <div key={c.id} style={{ display: 'grid', gridTemplateColumns: '1fr 90px 130px 70px 28px', gap: 8, alignItems: 'center' }}>
                    <input value={c.label} onChange={e => updateCrit(c.id, { label: e.target.value })}
                      style={{ ...inputStyle, fontSize: 11.5 }} />
                    <input type="number" min={0} max={100} value={c.poids} onChange={e => updateCrit(c.id, { poids: Number(e.target.value) })}
                      style={{ ...inputStyle, textAlign: 'center', padding: '7px 4px' }} />
                    <div style={{ display: 'flex', gap: 3, justifyContent: 'center' }}>
                      {[1, 2, 3, 4, 5].map(n => (
                        <button key={n} onClick={() => updateCrit(c.id, { note: n })}
                          style={{ width: 20, height: 22, borderRadius: 5, cursor: 'pointer', fontSize: 10, fontWeight: 700,
                            border: `1px solid ${c.note >= n ? '#1B4F8A' : '#D1D5DB'}`,
                            background: c.note >= n ? '#1B4F8A' : '#fff', color: c.note >= n ? '#fff' : '#9CA3AF' }}>{n}</button>
                      ))}
                    </div>
                    <span style={{ textAlign: 'right', fontSize: 12, fontWeight: 700, color: '#1B4F8A' }}>{(c.note * c.poids / 100).toFixed(2)}</span>
                    <button onClick={() => removeCrit(c.id)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#CBD5E1', display: 'flex', justifyContent: 'center' }} aria-label={`Supprimer le critère ${c.label}`}><X size={13} /></button>
                  </div>
                ))}

                {/* Ajouter un critère */}
                <div style={{ display: 'flex', gap: 8 }}>
                  <input value={newCritLabel} onChange={e => setNewCritLabel(e.target.value)} onKeyDown={e => { if (e.key === 'Enter') addCrit(); }}
                    placeholder="Nouveau critère d'arbitrage…" style={{ ...inputStyle, flex: 1 }} />
                  <button onClick={addCrit} style={{ padding: '8px 14px', fontSize: 11, fontWeight: 700, background: '#F47920', color: '#fff', border: 'none', borderRadius: 6, cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 5 }}>
                    <Plus size={12} /> Critère
                  </button>
                </div>

                {/* Synthèse score */}
                <div style={{ display: 'flex', alignItems: 'center', gap: 16, padding: '14px 18px', borderRadius: 10, background: prioriteAuto === 'Haute' ? '#FEF2F2' : prioriteAuto === 'Moyenne' ? '#FFF7ED' : '#F0FDF4', border: `1px solid ${prioriteAuto === 'Haute' ? '#FCA5A5' : prioriteAuto === 'Moyenne' ? '#FED7AA' : '#BBF7D0'}` }}>
                  <div style={{ textAlign: 'center' }}>
                    <div style={{ fontSize: 30, fontWeight: 900, color: prioriteAuto === 'Haute' ? '#DC2626' : prioriteAuto === 'Moyenne' ? '#EA580C' : '#16A34A', lineHeight: 1 }}>{scorePondere}</div>
                    <div style={{ fontSize: 9, color: '#94A3B8', fontWeight: 700, marginTop: 2 }}>SCORE / 100</div>
                  </div>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 13, fontWeight: 800, color: '#0F172A' }}>Priorité calculée : <span style={{ color: prioriteAuto === 'Haute' ? '#DC2626' : prioriteAuto === 'Moyenne' ? '#EA580C' : '#16A34A' }}>{prioriteAuto}</span></div>
                    <div style={{ fontSize: 11, color: '#64748B', marginTop: 2 }}>
                      Somme des poids : {poidsTotal}% {poidsTotal !== 100 && <span style={{ color: '#EA580C', fontWeight: 600 }}>(recommandé : 100%)</span>} · Seuils : ≥75 Haute · 50–74 Moyenne · &lt;50 Faible
                    </div>
                  </div>
                  <select value={prioForcee ?? ''} onChange={e => setPrioForcee(e.target.value ? e.target.value as Priorite : null)}
                    style={{ ...inputStyle, width: 150 }} title="Vous pouvez forcer la priorité">
                    <option value="">Auto (selon score)</option>
                    <option value="Haute">Forcer : Haute</option>
                    <option value="Moyenne">Forcer : Moyenne</option>
                    <option value="Faible">Forcer : Faible</option>
                  </select>
                </div>
              </div>
            )}

            {/* Step 5: WBS */}
            {step === 5 && form.domaine !== '' && (
              <div>
                <div style={{ fontSize: 14, fontWeight: 700, color: '#111827', marginBottom: 6 }}>Modèle WBS — {DOMAINE_CFG[form.domaine].label}</div>
                <div style={{ fontSize: 11, color: '#6B7280', marginBottom: 14 }}>Sélectionnez les phases à inclure dans ce projet.</div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {WBS_TEMPLATES[form.domaine].map((item, i) => {
                    const checked = form.wbsChecked.includes(item);
                    const domColor = DOMAINE_CFG[form.domaine as Domaine].color;
                    return (
                      <label key={item} style={{
                        display: 'flex', alignItems: 'center', gap: 12, padding: '10px 12px',
                        borderRadius: 8, cursor: 'pointer',
                        border: `1px solid ${checked ? domColor : '#E5E7EB'}`,
                        background: checked ? `${domColor}08` : '#FAFAFA',
                        transition: 'all 0.15s',
                      }}>
                        <input type="checkbox" checked={checked} onChange={() => toggleWbs(item)}
                          style={{ accentColor: domColor, width: 14, height: 14, flexShrink: 0 }} />
                        <div style={{ width: 22, height: 22, borderRadius: 6, background: checked ? domColor : '#E5E7EB', color: '#FFF', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 10, fontWeight: 700, flexShrink: 0 }}>{i + 1}</div>
                        <span style={{ fontSize: 12, fontWeight: checked ? 600 : 400, color: checked ? '#111827' : '#6B7280' }}>{item}</span>
                      </label>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Step 6: Team & Calendar */}
            {step === 6 && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                <div style={{ fontSize: 14, fontWeight: 700, color: '#111827' }}>Équipe & Calendrier</div>

                {/* Add member */}
                <div style={{ background: '#F9FAFB', borderRadius: 10, padding: 14 }}>
                  <div style={{ fontSize: 12, fontWeight: 600, color: '#374151', marginBottom: 10 }}>Ajouter un membre</div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 80px', gap: 8, marginBottom: 8 }}>
                    <select style={inputStyle} value={newMemberRole} onChange={e => setNewMemberRole(e.target.value as Role)}>
                      {(['Chef projet', 'Ingénieur', 'Technicien', 'Administratif', 'Expert'] as Role[]).map(r => <option key={r} value={r}>{r}</option>)}
                    </select>
                    <input style={inputStyle} placeholder="Nom complet" value={newMemberNom} onChange={e => setNewMemberNom(e.target.value)} />
                    <input type="number" style={inputStyle} placeholder="%" value={newMemberAlloc} onChange={e => setNewMemberAlloc(e.target.value)} min={1} max={100} />
                  </div>
                  <button onClick={addMember} style={{
                    padding: '7px 14px', fontSize: 11, fontWeight: 600,
                    background: '#1B4F8A', color: '#FFF', border: 'none', borderRadius: 6, cursor: 'pointer',
                    display: 'inline-flex', alignItems: 'center', gap: 5,
                  }}>
                    <Plus size={12} /> Ajouter
                  </button>
                </div>

                {/* Team table */}
                {form.equipe.length > 0 && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                    {form.equipe.map(m => (
                      <div key={m.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 12px', background: '#F9FAFB', borderRadius: 8, border: '1px solid #E5E7EB' }}>
                        <div style={{ flex: 1, fontSize: 12, fontWeight: 600, color: '#111827' }}>{m.nom}</div>
                        <div style={{ fontSize: 11, color: '#6B7280' }}>{m.role}</div>
                        <div style={{ fontSize: 11, fontWeight: 600, color: '#1B4F8A' }}>{m.allocation}%</div>
                        <button onClick={() => removeMember(m.id)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#EF3340', padding: 2 }}><X size={12} /></button>
                      </div>
                    ))}
                  </div>
                )}

                {/* KPIs */}
                <div style={{ background: '#F9FAFB', borderRadius: 10, padding: 14 }}>
                  <div style={{ fontSize: 12, fontWeight: 600, color: '#374151', marginBottom: 10 }}>Convention de performance — KPIs à suivre</div>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                    {['CPI', 'SPI', 'Budget', 'Délai', 'Qualité', 'Sécurité'].map(kpi => {
                      const active = form.kpis.includes(kpi);
                      return (
                        <button key={kpi} onClick={() => toggleKpi(kpi)} style={{
                          padding: '5px 12px', fontSize: 11, fontWeight: 600, borderRadius: 20,
                          border: `1px solid ${active ? '#1B4F8A' : '#D1D5DB'}`,
                          background: active ? '#1B4F8A' : '#FFF',
                          color: active ? '#FFF' : '#6B7280', cursor: 'pointer',
                          transition: 'all 0.15s',
                        }}>{kpi}</button>
                      );
                    })}
                  </div>
                </div>

                {/* Jalons auto */}
                <div style={{ background: '#F9FAFB', borderRadius: 10, padding: 14 }}>
                  <div style={{ fontSize: 12, fontWeight: 600, color: '#374151', marginBottom: 10 }}>Jalons principaux (depuis WBS)</div>
                  {form.domaine !== '' && form.wbsChecked.slice(0, 3).map((item, i) => (
                    <div key={item} style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                      <span style={{ fontSize: 11, color: '#374151', flex: 1 }}>{item}</span>
                      <input type="date" style={{ ...inputStyle, width: 140 }} />
                    </div>
                  ))}
                  {form.domaine === '' && <div style={{ fontSize: 11, color: '#9CA3AF' }}>Sélectionnez d'abord un domaine</div>}
                </div>
              </div>
            )}
          </div>

          {/* Footer nav */}
          <div style={{ borderTop: '1px solid #E5E7EB', padding: '14px 20px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0 }}>
            <button
              onClick={() => setStep(s => Math.max(1, s - 1))}
              disabled={step === 1}
              style={{
                display: 'inline-flex', alignItems: 'center', gap: 5,
                padding: '8px 16px', fontSize: 12, fontWeight: 600, borderRadius: 8,
                border: '1px solid #D1D5DB', background: step === 1 ? '#F9FAFB' : '#FFF',
                color: step === 1 ? '#D1D5DB' : '#374151', cursor: step === 1 ? 'not-allowed' : 'pointer',
                opacity: step === 1 ? 0.5 : 1,
              }}
            >
              <ChevronLeft size={14} /> Précédent
            </button>
            <div style={{ display: 'flex', gap: 6 }}>
              {Array.from({ length: totalSteps }, (_, i) => (
                <div key={i} style={{ width: i + 1 === step ? 20 : 6, height: 6, borderRadius: 99, background: i + 1 <= step ? '#F47920' : '#E5E7EB', transition: 'all 0.3s' }} />
              ))}
            </div>
            {step < totalSteps ? (
              <button
                onClick={() => setStep(s => s + 1)}
                disabled={!canNext}
                style={{
                  display: 'inline-flex', alignItems: 'center', gap: 5,
                  padding: '8px 16px', fontSize: 12, fontWeight: 600, borderRadius: 8,
                  border: 'none', background: canNext ? '#F47920' : '#E5E7EB',
                  color: canNext ? '#FFF' : '#9CA3AF', cursor: canNext ? 'pointer' : 'not-allowed',
                  opacity: canNext ? 1 : 0.5,
                }}
              >
                Suivant <ChevronRight size={14} />
              </button>
            ) : (
              <button
                onClick={handleFinish}
                style={{
                  display: 'inline-flex', alignItems: 'center', gap: 5,
                  padding: '8px 16px', fontSize: 12, fontWeight: 600, borderRadius: 8,
                  border: 'none', background: '#16A34A', color: '#FFF', cursor: 'pointer',
                }}
              >
                <CheckCircle size={14} /> Créer le projet
              </button>
            )}
          </div>
        </div>
      </div>
    </>
  );
}

/* ─────────────────────────── MAIN PAGE ──────────────────────────────────── */

export default function ProjetsDPE() {
  const store = readOnlyGuard(useProjectStore(), isOperationalReadOnly(useAuth().user));
  const { user, isRole } = useAuth();
  // Le bandeau d'indicateurs CONSOLIDÉS n'est visible que pour les profils de
  // PILOTAGE (chef de département/cellule, PMO, Directeur, Experts S&E/CSE). Un chef
  // de projet (ou rôle opérationnel) ne voit JAMAIS d'agrégat consolidé : ses pages
  // ne concernent que ses propres projets. NB : un chef de département est niveau 2
  // pour la visibilité (scopé à son département) mais reste un profil de pilotage.
  const canSeeConsolidated = isRole('DIR_DPE', 'ADMIN', 'PMO', 'CHEF_DEPT', 'EXPERT');
  const router = useRouter();
  const allProjets = store.projets;

  // ── Filtrage par profil ──────────────────────────────────────────────────
  // La visibilité est DÉJÀ appliquée de façon centralisée par useProjectStore
  // (moteur RBAC/ABAC accessEngine + règle d'implication ND 005/2023) :
  //   • DIR_DPE / PMO / ADMIN → tout le portefeuille (consolidation DER/DPE) ;
  //   • CHEF_DEPT (Modou NDIAYE / Ngagne DIOP) → tous les projets de son département ;
  //   • CHEF_PROJ / Ingénieur / Contrôleur → uniquement ses projets (chef ou équipe).
  // On NE re-filtre PAS ici (l'ancien filtre comparait user.direction « DER » à
  // project.unite « DPD/DPT » et renvoyait donc 0 projet à tous les chefs).
  const projets = useMemo(() => (user ? allProjets : []), [allProjets, user]);

  const roleLabel = useMemo(() => {
    if (isRole('CHEF_PROJ')) return `Mes projets assignés (${projets.length})`;
    if (isRole('CHEF_DEPT')) return `Projets de mon unité (${projets.length})`;
    return null;
  }, [projets.length, isRole]);

  const [search, setSearch] = useState('');
  const [filterDomaine, setFilterDomaine] = useState<Domaine | 'tous'>('tous');
  const [filterStatut, setFilterStatut] = useState<StatutProjet | 'tous'>('tous');
  const [drawerProjetId, setDrawerProjetId] = useState<string | null>(null);
  const selectedProjet = drawerProjetId ? projets.find(p => p.id === drawerProjetId) ?? null : null;
  const [showWizard, setShowWizard] = useState(false);
  const [showMigrate, setShowMigrate] = useState(false);
  const searchRef = useRef<HTMLInputElement>(null);
  const { addNotification } = useNotificationStore();
  const [migrateForm, setMigrateForm] = useState({
    nom: '', code: '', domaine: 'distribution' as Domaine, region: REGIONS[0],
    chefProjet: CHEFS[0], budget: '', budgetEngage: '', avancement: '',
    dateDebut: '', dateFinPrevue: '',
  });

  const filtered = useMemo(() => {
    return projets.filter(p => {
      if (filterDomaine !== 'tous' && p.domaine !== filterDomaine) return false;
      if (filterStatut !== 'tous' && p.statut !== filterStatut) return false;
      if (search.trim()) {
        const q = search.toLowerCase();
        return (
          p.nom.toLowerCase().includes(q) ||
          p.code.toLowerCase().includes(q) ||
          p.chefProjet.toLowerCase().includes(q) ||
          p.localisation.toLowerCase().includes(q)
        );
      }
      return true;
    });
  }, [projets, filterDomaine, filterStatut, search]);

  const kpis = useMemo(() => ({
    total: projets.length,
    en_cours: projets.filter(p => p.statut === 'en_cours').length,
    termines: projets.filter(p => p.statut === 'termine').length,
    en_retard: projets.filter(p => p.statut === 'en_retard').length,
    budget: projets.reduce((acc, p) => acc + p.budget, 0),
  }), [projets]);

  // DPE energy KPIs (dérivés des données store + coefficients sectoriels)
  const dpeKpis = useMemo(() => {
    const distrib = projets.filter(p => p.domaine === 'distribution');
    const prod    = projets.filter(p => p.domaine === 'production');
    const trans   = projets.filter(p => p.domaine === 'transport');
    // Coefficients calibrés sur des ratios physiques réalistes (budget en MFCFA) :
    //  • ~25 m de réseau HTA/BT et ~1 compteur posé par MFCFA de distribution exécuté ;
    //  • un poste de transformation ≈ 12 MFCFA (≈ 0,08 poste / MFCFA) ;
    //  • production : MW installés ≈ 0,01 MW / MFCFA (très capitalistique).
    const kmReseau   = distrib.reduce((s, p) => s + (p.budget * 0.025 * p.avancement / 100), 0);
    const mwInstalle = prod.reduce((s, p) => s + (p.budget * 0.01 * p.avancement / 100), 0);
    const compteurs  = Math.round(distrib.reduce((s, p) => s + (p.budget * 1.0 * p.avancement / 100), 0));
    // Pertes techniques évitées (GWh/an) — impact réel des renforcements réseau (distribution + transport).
    const pertesEvitees = [...distrib, ...trans].reduce((s, p) => s + (p.budget * 0.0012 * p.avancement / 100), 0);
    const conformite = Math.round(projets.reduce((s, p) => s + (p.avancement >= 80 ? 92 : p.avancement >= 50 ? 75 : 55), 0) / Math.max(1, projets.length));
    const postes     = Math.round(distrib.reduce((s, p) => s + (p.budget * 0.08 * p.avancement / 100), 0) + trans.reduce((s, p) => s + (p.budget * 0.02 * p.avancement / 100), 0));
    return { kmReseau, mwInstalle, compteurs, pertesEvitees, conformite, postes };
  }, [projets]);

  const handleStatusChange = useCallback((id: string, statut: StatutProjet, reason: string) => {
    store.changeStatut(id, statut, reason);
  }, [store]);

  const handleMigrateProject = useCallback(() => {
    const budget = parseFloat(migrateForm.budget) || 0;
    const budgetEngage = parseFloat(migrateForm.budgetEngage) || 0;
    const avancement = Math.min(100, Math.max(0, parseFloat(migrateForm.avancement) || 0));

    store.createProjet({
      domaine: migrateForm.domaine,
      nom: migrateForm.nom.trim(),
      code: migrateForm.code.trim() || genCode(migrateForm.domaine),
      description: `Projet migré (en cours) — avancement initial ${avancement}%.`,
      objectif: '',
      chefProjet: migrateForm.chefProjet,
      localisation: migrateForm.region,
      region: migrateForm.region,
      avancement,
      avancementPlanifie: avancement, // Assuming planned is same as actual for migrated projects
      budget,
      budgetEngage,
      budgetDecaisse: Math.round(budgetEngage * 0.7), // Estimate 70% disbursed
      dateDebut: migrateForm.dateDebut,
      dateFinPrevue: migrateForm.dateFinPrevue,
      dateFinEstimee: migrateForm.dateFinPrevue, // Initially same as planned
      statut: 'en_cours' as const,
      priorite: 'Moyenne' as Priorite,
      cpi: 1.00, // Default to 1 for migrated
      spi: 1.00, // Default to 1 for migrated
      bailleurs: [], // Can be updated later
      equipe: [], // Can be updated later
      jalons: [], // Can be updated later
      metadata: { migrated: true, original_system: 'Legacy SIGEPP' }, // Add metadata for migrated projects
    });
    addNotification({
      type: 'success',
      title: 'Projet migré',
      message: `Le projet "${migrateForm.nom}" a été migré avec succès.`,
    });
    setShowMigrate(false);
    setMigrateForm({
      nom: '', code: '', domaine: 'distribution', region: REGIONS[0],
      chefProjet: CHEFS[0], budget: '', budgetEngage: '', avancement: '',
      dateDebut: '', dateFinPrevue: '',
    });
  }, [migrateForm, store]);

  const handleBulkMigrate = useCallback((bulkData: string) => {
    const lines = bulkData.split('\n').map(l => l.trim()).filter(Boolean);
    lines.forEach(line => {
      const [nom, domaineStr, region, budgetStr, avancementStr, dateDebut, dateFinPrevue] = line.split(';').map(s => s.trim());
      const domaine = domaineStr as Domaine;
      const budget = parseFloat(budgetStr) * 1_000_000 || 0; // Assuming input is in M FCFA
      const avancement = parseFloat(avancementStr) || 0;
      store.createProjet({
        domaine, nom, code: genCode(domaine),
        description: 'Projet migré en masse.', objectif: '',
        chefProjet: CHEFS[Math.floor(Math.random() * CHEFS.length)], localisation: region, region,
        avancement, avancementPlanifie: avancement,
        budget, budgetEngage: budget * (avancement / 100), budgetDecaisse: budget * (avancement / 100) * 0.7,
        dateDebut, dateFinPrevue, dateFinEstimee: dateFinPrevue,
        statut: 'en_cours' as const, priorite: 'Moyenne' as Priorite, cpi: 1, spi: 1,
        bailleurs: [], equipe: [], jalons: [],
        metadata: { migrated: true, original_system: 'Bulk Import' },
      });
    });
    addNotification({
      type: 'success',
      title: 'Projets migrés en masse',
      message: `${lines.length} projets ont été importés avec succès.`,
    });
    setShowMigrate(false);
    alert(`${lines.length} projets importés en masse.`);
  }, [store]);


  // Domaines limités au périmètre : uniquement ceux présents dans les projets visibles
  const availableDomaines = (['production', 'transport', 'distribution', 'commercial', 'genie_civil'] as Domaine[])
    .filter(d => allProjets.some(p => p.domaine === d));
  const domaineTabs: { key: Domaine | 'tous'; label: string }[] = [
    { key: 'tous', label: 'Tous' },
    ...availableDomaines.map(d => ({ key: d as Domaine, label: DOMAINE_CFG[d].label })),
  ];

  const statutOptions: { key: StatutProjet | 'tous'; label: string }[] = [
    { key: 'tous', label: 'Tous statuts' },
    { key: 'en_cours', label: 'En cours' },
    { key: 'planifie', label: 'Planifié' },
    { key: 'termine', label: 'Terminé' },
    { key: 'en_retard', label: 'En retard' },
    { key: 'suspendu', label: 'Suspendu' },
    { key: 'archive', label: 'Archivé' },
  ];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', overflowY: 'auto', background: '#F3F4F6' }}>

      {/* ── Header bar ── */}
      <div style={{ background: '#1B4F8A', padding: '14px 20px', flexShrink: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <FolderOpen size={22} style={{ color: '#FFF', opacity: 0.9 }} />
            <div>
              <h1 style={{ margin: 0, fontSize: 18, fontWeight: 700, color: '#FFF', letterSpacing: '-0.3px' }}>
                Gestion des Projets DPE
              </h1>
              {roleLabel && (
                <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.65)', marginTop: 2, display: 'flex', alignItems: 'center', gap: 4 }}>
                  <span style={{ width: 5, height: 5, borderRadius: '50%', background: '#F47920', display: 'inline-block' }}/>
                  {roleLabel}
                </div>
              )}
            </div>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            {/* Search */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, background: 'rgba(255,255,255,0.12)', borderRadius: 8, padding: '6px 12px', width: 220 }}>
              <Search size={13} style={{ color: 'rgba(255,255,255,0.6)', flexShrink: 0 }} />
              <input
                ref={searchRef}
                value={search}
                onChange={e => setSearch(e.target.value)}
                placeholder="Rechercher..."
                style={{
                  border: 'none', background: 'transparent', color: '#FFF',
                  fontSize: 12, outline: 'none', flex: 1,
                }}
              />
              {search && <button onClick={() => setSearch('')} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'rgba(255,255,255,0.6)', padding: 0, display: 'flex' }}><X size={12} /></button>}
            </div>
            {/* Statut filter */}
            <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
              <select
                value={filterStatut}
                onChange={e => setFilterStatut(e.target.value as StatutProjet | 'tous')}
                style={{
                  appearance: 'none', padding: '6px 28px 6px 12px', fontSize: 11, fontWeight: 600,
                  borderRadius: 8, border: '1px solid rgba(255,255,255,0.3)',
                  background: 'rgba(255,255,255,0.12)', color: '#FFF', cursor: 'pointer', outline: 'none',
                }}
              >
                {statutOptions.map(o => <option key={o.key} value={o.key} style={{ background: '#1B4F8A' }}>{o.label}</option>)}
              </select>
              <ChevronDown size={12} style={{ position: 'absolute', right: 8, color: 'rgba(255,255,255,0.6)', pointerEvents: 'none' }} />
            </div>
            {/* Migrer un projet en cours → workflow de migration multi-agents IA
                (chargement de ZIP/RAR/PDF/Excel → swarm OCR + planification). */}
            <button
              onClick={() => router.push('/migration')}
              title="Ouvrir l'atelier de migration multi-agents (OCR ODM + planification IA)"
              style={{
                display: 'inline-flex', alignItems: 'center', gap: 6,
                padding: '7px 14px', fontSize: 12, fontWeight: 700,
                background: '#fff', color: '#1B4F8A', border: '1px solid #1B4F8A',
                borderRadius: 8, cursor: 'pointer', whiteSpace: 'nowrap',
              }}
            >
              <RefreshCw size={14} /> Migrer un projet en cours
            </button>
            {/* Nouveau projet */}
            <button
              onClick={() => setShowWizard(true)}
              style={{
                display: 'inline-flex', alignItems: 'center', gap: 6,
                padding: '7px 14px', fontSize: 12, fontWeight: 700,
                background: '#F47920', color: '#FFF', border: 'none',
                borderRadius: 8, cursor: 'pointer', whiteSpace: 'nowrap',
                boxShadow: '0 2px 8px rgba(244,121,32,0.4)',
                transition: 'opacity 0.15s',
              }}
            >
              <Plus size={14} /> Nouveau Projet
            </button>
          </div>
        </div>

        {/* Domain filter tabs */}
        <div style={{ display: 'flex', gap: 4 }}>
          {domaineTabs.map(tab => {
            const isActive = filterDomaine === tab.key;
            const color = tab.key !== 'tous' ? DOMAINE_CFG[tab.key as Domaine].color : '#FFF';
            return (
              <button
                key={tab.key}
                onClick={() => setFilterDomaine(tab.key)}
                style={{
                  padding: '5px 14px', fontSize: 11, fontWeight: 600, borderRadius: 6,
                  border: 'none', cursor: 'pointer', transition: 'all 0.15s',
                  background: isActive ? '#F47920' : 'rgba(255,255,255,0.12)',
                  color: isActive ? '#FFF' : 'rgba(255,255,255,0.75)',
                  boxShadow: isActive ? '0 2px 8px rgba(244,121,32,0.35)' : 'none',
                }}
              >
                {tab.key !== 'tous' && (
                  <span style={{ display: 'inline-block', width: 7, height: 7, borderRadius: '50%', background: isActive ? '#FFF' : color, marginRight: 5, verticalAlign: 'middle' }} />
                )}
                {tab.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* ── KPI Strip ── */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3" style={{ padding: '12px 20px', flexShrink: 0 }}>
        {[
          { label: 'Total projets',    value: kpis.total,                    color: '#1B4F8A', bg: '#EFF6FF', icon: FolderOpen    },
          { label: 'En cours',         value: kpis.en_cours,                 color: '#F47920', bg: '#FFF7ED', icon: Activity      },
          { label: 'Terminés',         value: kpis.termines,                 color: '#16A34A', bg: '#F0FDF4', icon: CheckCircle   },
          { label: 'En retard',        value: kpis.en_retard,                color: '#EF3340', bg: '#FEF2F2', icon: AlertTriangle },
          { label: 'Budget total',     value: `${kpis.budget.toFixed(0)}M`,  color: '#8B5CF6', bg: '#F5F3FF', icon: TrendingUp    },
        ].map(({ label, value, color, bg, icon: Icon }) => (
          <div key={label} style={{
            background: '#FFF', borderRadius: 10, padding: '12px 14px',
            border: '1px solid #E5E7EB', display: 'flex', alignItems: 'center', gap: 12,
            boxShadow: '0 1px 3px rgba(0,0,0,0.06)',
          }}>
            <div style={{ width: 38, height: 38, borderRadius: 9, background: bg, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
              <Icon size={18} style={{ color }} strokeWidth={1.8} />
            </div>
            <div>
              <div style={{ fontSize: 9, color: '#9CA3AF', marginBottom: 2, textTransform: 'uppercase', letterSpacing: '0.05em' }}>{label}</div>
              <div style={{ fontSize: 20, fontWeight: 800, color, lineHeight: 1 }}>{value}</div>
            </div>
          </div>
        ))}
      </div>

      {/* ── DPE Energy & Indicateurs Métier Strip (pilotage uniquement) ── */}
      {canSeeConsolidated && (
      <div style={{ padding: '0 20px 10px', flexShrink: 0 }}>
        <div style={{ background: 'linear-gradient(135deg, #1B4F8A 0%, #0F3460 100%)', borderRadius: 10, padding: '12px 16px' }}>
          <div style={{ fontSize: 10, fontWeight: 700, color: 'rgba(255,255,255,0.6)', textTransform: 'uppercase', letterSpacing: '.8px', marginBottom: 10 }}>
            ⚡ Indicateurs DPE & Énergie — {isRole('DIR_DPE','ADMIN','PMO') ? 'Portefeuille consolidé' : 'Mon périmètre'}
          </div>
          <div className="grid grid-cols-2 md:grid-cols-6 gap-2">
            {[
              { icon: '🔌', label: 'Réseau HTA/BT',    val: `${dpeKpis.kmReseau.toFixed(0)} km`,      sub: 'déployé',         color: '#60A5FA' },
              { icon: '🏗️', label: 'Postes transfo',    val: String(dpeKpis.postes),                    sub: 'installés',       color: '#059669' },
              { icon: '⚡', label: 'MW installés',      val: `${dpeKpis.mwInstalle.toFixed(0)} MW`,    sub: 'production',      color: '#FCD34D' },
              { icon: '📊', label: 'Compteurs posés',   val: dpeKpis.compteurs.toLocaleString('fr'),   sub: 'actifs',          color: '#C084FC' },
              { icon: '🔌', label: 'Pertes techn. évitées', val: `${dpeKpis.pertesEvitees.toFixed(1)} GWh`, sub: 'par an (réseau renforcé)', color: '#6EE7B7' },
              { icon: '✅', label: 'Conformité DPE',    val: `${dpeKpis.conformite}%`,                 sub: 'moy. portefeuille', color: dpeKpis.conformite >= 80 ? '#4ADE80' : '#F87171' },
            ].map(k => (
              <div key={k.label} style={{ textAlign: 'center', padding: '8px 6px', borderRadius: 8, background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.12)' }}>
                <div style={{ fontSize: 16, marginBottom: 3 }}>{k.icon}</div>
                <div style={{ fontSize: 16, fontWeight: 800, color: k.color, lineHeight: 1 }}>{k.val}</div>
                <div style={{ fontSize: 9, color: 'rgba(255,255,255,0.5)', marginTop: 2 }}>{k.label}</div>
                <div style={{ fontSize: 8, color: 'rgba(255,255,255,0.35)' }}>{k.sub}</div>
              </div>
            ))}
          </div>
        </div>
      </div>
      )}

      {/* ── Projects Grid ── */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '0 20px 20px' }}>
        {filtered.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '60px 0', color: '#9CA3AF' }}>
            <FolderOpen size={48} strokeWidth={1} style={{ margin: '0 auto 12px', display: 'block', opacity: 0.3 }} />
            <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 4 }}>Aucun projet trouvé</div>
            <div style={{ fontSize: 12 }}>Modifiez vos filtres ou créez un nouveau projet</div>
          </div>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(340px, 1fr))', gap: 14 }}>
            {filtered.map(p => (
              <ProjectCard key={p.id} projet={p} onOpen={p => setDrawerProjetId(p.id)} onStatusChange={handleStatusChange} />
            ))}
          </div>
        )}
      </div>

      {/* ── Detail Drawer ── */}
      {selectedProjet && (
        <DetailDrawer projet={selectedProjet} onClose={() => setDrawerProjetId(null)} ressources={store.ressources} />
      )}

      {/* ── Wizard Modal ── */}
      {showWizard && (
        <WizardModal onClose={() => setShowWizard(false)} />
      )}

      {/* ── Migration projet en cours ── */}
      {showMigrate && (
        <MigrateModal onClose={() => setShowMigrate(false)} onMigrate={handleMigrateProject} onBulkMigrate={handleBulkMigrate} migrateForm={migrateForm} setMigrateForm={setMigrateForm} />
      )}
    </div>
  );
}

/* ─────────────────────────── MIGRATION D'UN PROJET EN COURS ──────────────── */
interface MigrateModalProps {
  onClose: () => void;
  onMigrate: () => void;
  onBulkMigrate: (bulkData: string) => void;
  migrateForm: {
    nom: string; code: string; domaine: Domaine; region: string;
    chefProjet: string; budget: string; budgetEngage: string; avancement: string;
    dateDebut: string; dateFinPrevue: string;
  };
  setMigrateForm: React.Dispatch<React.SetStateAction<{
    nom: string; code: string; domaine: Domaine; region: string;
    chefProjet: string; budget: string; budgetEngage: string; avancement: string;
    dateDebut: string; dateFinPrevue: string;
  }>>;
}

function MigrateModal({ onClose, onMigrate, onBulkMigrate, migrateForm, setMigrateForm }: MigrateModalProps) {
  const [mode, setMode] = useState<'unitaire' | 'masse'>('unitaire'); // State for switching between modes
  const [bulk, setBulk] = useState(''); // State for bulk import textarea
  const [done] = useState(false);
  const [bulkCount] = useState(0);
  
  const valid = migrateForm.nom.trim() && migrateForm.budget && migrateForm.dateDebut && migrateForm.dateFinPrevue;

  const lbl: React.CSSProperties = { display: 'block', fontSize: 10.5, fontWeight: 700, color: '#64748B', textTransform: 'uppercase', marginBottom: 4, marginTop: 10 };
  const inp: React.CSSProperties = { width: '100%', padding: '8px 10px', borderRadius: 7, border: '1px solid #E2E8F0', fontSize: 13, outline: 'none', boxSizing: 'border-box', fontFamily: 'inherit' };

  return (
    <>
      <div onClick={onClose} style={{ position: 'fixed', inset: 0, zIndex: 60, background: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(3px)' }} />
      <div style={{ position: 'fixed', top: '50%', left: '50%', transform: 'translate(-50%,-50%)', zIndex: 61, background: '#fff', borderRadius: 12, boxShadow: '0 20px 60px rgba(0,0,0,0.3)', width: 460, maxHeight: '88vh', overflowY: 'auto', padding: 22 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
          <div style={{ fontSize: 16, fontWeight: 800, color: '#1B4F8A' }}>Migrer un projet en cours</div>
          <button onClick={onClose} style={{ border: 'none', background: 'none', cursor: 'pointer', color: '#94A3B8' }}><X size={18} /></button>
        </div>
        <div style={{ fontSize: 11.5, color: '#64748B', marginBottom: 10 }}>Reprise d&apos;un projet déjà démarré : saisissez l&apos;essentiel, le reste est pré-rempli et modifiable.</div>

        {/* Bascule unitaire / en masse */}
        {!done && ( 
          <div style={{ display: 'flex', gap: 6, marginBottom: 12, background: '#F1F5F9', borderRadius: 8, padding: 3 }}>
            {([['unitaire', 'Projet unitaire'], ['masse', 'Import en masse']] as const).map(([m, label]) => (
              <button key={m} onClick={() => setMode(m)} style={{ flex: 1, padding: '7px 0', borderRadius: 6, border: 'none', cursor: 'pointer', fontSize: 12, fontWeight: 700, background: mode === m ? '#fff' : 'transparent', color: mode === m ? '#1B4F8A' : '#64748B', boxShadow: mode === m ? '0 1px 3px rgba(0,0,0,0.1)' : 'none' }}>{label}</button>
            ))}
          </div>
        )}

        {done ? (
          <div style={{ padding: '24px 8px', textAlign: 'center', color: '#16A34A' }}>
            <CheckCircle size={40} style={{ marginBottom: 8 }} /> 
            <div style={{ fontSize: 15, fontWeight: 700 }}>{bulkCount > 0 ? `${bulkCount} projet(s) migr\xe9(s) avec succ\xe8s` : 'Projet migr\xe9 avec succ\xe8s'}</div>
            <div style={{ fontSize: 12, color: '#64748B', marginTop: 4 }}>Ils apparaissent désormais dans le portefeuille (statut « En cours »).</div>
          </div>
        ) : mode === 'masse' ? (
          <>
            <label style={lbl}>Coller les projets (une ligne par projet)</label>
            <div style={{ fontSize: 10.5, color: '#94A3B8', marginBottom: 6 }}>Format : <code>Nom ; Domaine ; Région ; Budget(M) ; Avancement(%) ; Début(AAAA-MM-JJ) ; Fin(AAAA-MM-JJ)</code> — copiable depuis Excel.</div>
            <textarea value={bulk} onChange={e => setBulk(e.target.value)} rows={9} 
              placeholder={'Électrification 19 Localités ; Distribution ; Thiès ; 450 ; 35 ; 2025-03-01 ; 2026-12-31\nExtension BT Oumy Diallo ; Distribution ; Dakar ; 120 ; 60 ; 2025-06-01 ; 2026-09-30'}
              style={{ ...inp, fontFamily: 'monospace', fontSize: 11.5, lineHeight: 1.6, resize: 'vertical' }} />
            <div style={{ fontSize: 11, color: '#475569', marginTop: 6 }}>{bulk.split('\n').filter(l => l.trim()).length} ligne(s) détectée(s)</div>
            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 16 }}>
              <button onClick={onClose} style={{ padding: '8px 16px', borderRadius: 7, border: '1px solid #E2E8F0', background: '#fff', fontSize: 12, cursor: 'pointer' }}>Annuler</button>
              <button onClick={() => onBulkMigrate(bulk)} disabled={!bulk.trim()} style={{ padding: '8px 18px', borderRadius: 7, border: 'none', background: bulk.trim() ? '#1B4F8A' : '#E5E7EB', color: bulk.trim() ? '#fff' : '#9CA3AF', fontSize: 12, fontWeight: 700, cursor: bulk.trim() ? 'pointer' : 'default' }}>Importer les projets</button>
            </div>
          </>
        ) : (
          <>
            <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: 10 }}>
              <div><label style={lbl}>Nom du projet *</label><input value={migrateForm.nom} onChange={e => setMigrateForm({ ...migrateForm, nom: e.target.value })} placeholder="Ex : Électrification Rurale 19 Localités Thiès" style={inp} /></div>
              <div><label style={lbl}>Code</label><input value={migrateForm.code} onChange={e => setMigrateForm({ ...migrateForm, code: e.target.value })} placeholder="auto" style={inp} /></div>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
              <div><label style={lbl}>Domaine</label> 
                <select value={migrateForm.domaine} onChange={e => setMigrateForm({ ...migrateForm, domaine: e.target.value as Domaine })} style={inp}>
                  {Object.keys(DOMAINE_CFG).map(d => <option key={d} value={d}>{DOMAINE_CFG[d as Domaine].label}</option>)}
                </select>
              </div>
              <div><label style={lbl}>Région</label> 
                <select value={migrateForm.region} onChange={e => setMigrateForm({ ...migrateForm, region: e.target.value })} style={inp}>
                  {REGIONS.map(r => <option key={r} value={r}>{r}</option>)}
                </select>
              </div>
            </div>
            <div><label style={lbl}>Chef de projet</label> 
              <select value={migrateForm.chefProjet} onChange={e => setMigrateForm({ ...migrateForm, chefProjet: e.target.value })} style={inp}>
                {CHEFS.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 10 }}>
              <div><label style={lbl}>Budget (M FCFA) *</label><input type="number" value={migrateForm.budget} onChange={e => setMigrateForm({ ...migrateForm, budget: e.target.value })} style={inp} /></div>
              <div><label style={lbl}>Déjà engagé (M)</label><input type="number" value={migrateForm.budgetEngage} onChange={e => setMigrateForm({ ...migrateForm, budgetEngage: e.target.value })} style={inp} /></div>
              <div><label style={lbl}>Avancement (%)</label><input type="number" min={0} max={100} value={migrateForm.avancement} onChange={e => setMigrateForm({ ...migrateForm, avancement: e.target.value })} style={inp} /></div>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
              <div><label style={lbl}>Date début (réelle) *</label><input type="date" value={migrateForm.dateDebut} onChange={e => setMigrateForm({ ...migrateForm, dateDebut: e.target.value })} style={inp} /></div>
              <div><label style={lbl}>Fin prévue *</label><input type="date" value={migrateForm.dateFinPrevue} onChange={e => setMigrateForm({ ...migrateForm, dateFinPrevue: e.target.value })} style={inp} /></div>
            </div>
            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 18 }}>
              <button onClick={onClose} style={{ padding: '8px 16px', borderRadius: 7, border: '1px solid #E2E8F0', background: '#fff', fontSize: 12, cursor: 'pointer' }}>Annuler</button>
              <button onClick={onMigrate} disabled={!valid} style={{ padding: '8px 18px', borderRadius: 7, border: 'none', background: valid ? '#1B4F8A' : '#E5E8EB', color: valid ? '#fff' : '#9CA3AF', fontSize: 12, fontWeight: 700, cursor: valid ? 'pointer' : 'default' }}>Migrer le projet</button>
            </div>
          </>
        )}
      </div>
    </>
  );
}

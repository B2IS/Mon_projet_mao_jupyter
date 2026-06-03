'use client';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useState, useEffect, useRef } from 'react';
import {
  Home, FolderKanban, Layers, GanttChart, Activity,
  ShieldAlert, MapPin, Map, Wallet, FileSignature,
  ClipboardList, Car, Users2, BookOpen,
  CheckSquare2, FileText, Bot, Settings,
  Menu, ChevronRight, X, LogOut, Building2, Clock, DoorOpen, Repeat, Check,
  Network, BarChart3, FolderOpen, PenTool,
  Briefcase, LayoutDashboard, ClipboardCheck,
  TrendingUp, Zap, PieChart, Upload, Calculator, ShieldCheck,
} from 'lucide-react';
import { getAnalytics } from '@/lib/data';
import { useAuth, ROLES, DEMO_ACCOUNTS, type SidebarSectionId, type RoleCode, getDirectionLabel } from '@/lib/authStore';
import { getDepartementLabel } from '@/lib/dpeOrgStructure';
import { useTranslation } from '@/lib/i18n/I18nContext';
import type { TranslationKey } from '@/lib/i18n/translations';
import SenelecLogo from '@/components/ui/SenelecLogo';

const stats = getAnalytics();

/* ══════════════════════════════════════════════════════════════════════════
   TYPES
══════════════════════════════════════════════════════════════════════════ */
type BadgeType = 'danger' | 'warning' | 'info';

interface NavItem {
  href: string;
  icon: React.ComponentType<{ size?: number; style?: React.CSSProperties }>;
  label: string;
  tKey?: TranslationKey;
  labelByRole?: Partial<Record<RoleCode, string>>; // role-specific label
  badge?: string;
  badgeType?: BadgeType;
  onlyRoles?: RoleCode[]; // if set, only visible to these roles
  hideRoles?: RoleCode[];  // if set, hidden from these roles
  onlyDirections?: string[]; // if set, only visible to these directions (ex: ['DEP','DER'])
  hideDirections?: string[]; // if set, hidden from these directions
}

interface SidebarSection {
  id: string;
  icon: React.ComponentType<{ size?: number; style?: React.CSSProperties }>;
  label: string;
  tKey?: TranslationKey;
  labelByRole?: Partial<Record<RoleCode, string>>;
  shortLabel: string;
  directLink?: string;
  routes: string[];
  items: NavItem[];
}

/* ══════════════════════════════════════════════════════════════════════════
   NAVIGATION — Structure professionnelle par mission métier
   Chaque rôle ne voit que les vues pertinentes à sa mission.
   Principe Primavera P6 / SAP PS : accès par profil métier, pas technologie.
══════════════════════════════════════════════════════════════════════════ */
const SECTIONS: SidebarSection[] = [

  /* ── 1. Accueil ── Cockpit adapté au rôle */
  {
    id: 'accueil',
    icon: Home,
    label: 'Accueil',
    tKey: 'sidebar.accueil',
    shortLabel: 'Accueil',
    directLink: '/tableau-de-bord',
    routes: ['/tableau-de-bord'],
    items: [
      {
        href: '/tableau-de-bord',
        icon: LayoutDashboard,
        label: 'Tableau de bord',
        tKey: 'nav.dashboard',
        labelByRole: {
          DIR_DPE:     'Cockpit Direction — KPIs Portefeuille',
          PMO:         'Cockpit PMO — Vue Portefeuille',
          CHEF_PROJ:   'Mes Projets — Tableau de bord',
          CHEF_DEPT:   'Cockpit Département — KPIs',
          CTRL_FIN:    'Tableau de bord Financier',
          RESP_LOG:    'Tableau de bord Logistique',
        },
        badge: stats.alertesActives > 0 ? String(stats.alertesActives) : undefined,
        badgeType: 'danger',
      },
    ],
  },

  /* ── 2. Portefeuille & Projets ── Vue consolidée ou individuelle selon le rôle */
  {
    id: 'portefeuille',
    icon: FolderKanban,
    label: 'Portefeuille & Projets',
    tKey: 'sidebar.portefeuilleProjets',
    labelByRole: {
      DIR_DPE:   'Portefeuille Stratégique',
      PMO:       'Portefeuille & Planification',
      CHEF_DEPT: 'Mon Portefeuille de Projets',
      CHEF_PROJ: 'Mes Projets & Planning',
    },
    shortLabel: 'Portef.',
    routes: ['/portefeuille', '/programmes', '/projets', '/cockpit-projet', '/gestion-projet', '/gantt', '/wbs', '/taches'],
    items: [
      { href: '/portefeuille', icon: FolderKanban, label: 'Vue Portefeuille', tKey: 'nav.portfolio',
        hideRoles: ['CHEF_DEPT', 'CHEF_PROJ'],
      },
      { href: '/programmes', icon: Layers, label: 'Programmes',
        labelByRole: { PMO: 'Programmes multi-projets', CHEF_DEPT: 'Mes Programmes' },
        hideRoles: ['CHEF_DEPT', 'CHEF_PROJ'],
      },
      { href: '/projets', icon: Briefcase, label: 'Projets', tKey: 'nav.projects',
        labelByRole: { PMO: 'Tous les projets', DIR_DPE: 'Vue d\'ensemble projets', CHEF_DEPT: 'Mes Projets', CHEF_PROJ: 'Mes Projets', SECRETAIRE: 'Projets du département (lecture)' },
        hideRoles: ['DIR_DPE'],
      },
      { href: '/cockpit-projet', icon: LayoutDashboard, label: 'Fiche Exécutive Projet',
        labelByRole: { PMO: 'Cockpit Projet', CHEF_DEPT: 'Cockpit Projet', CHEF_PROJ: 'Mon Cockpit Projet' },
      },
      // ── DÉTAIL PLANNING (gestion de projet, WBS, tâches) : réservé à l'ÉQUIPE D'EXÉCUTION
      //    du chef de projet (Chef de Projet, Assistant, Ingénieur, Contrôleur) + Admin.
      //    Les autres (Directeur, Chef de Département, PMO, Expert, Chargé…) → planning HAUT
      //    NIVEAU uniquement (Gantt jalons/phases + Cockpit). ──
      { href: '/gestion-projet', icon: GanttChart, label: 'Gestion de Projet',
        labelByRole: { CHEF_PROJ: 'Ma Gestion de Projet', INGENIEUR: 'Gestion de Projet' },
        onlyRoles: ['CHEF_PROJ', 'ASSISTANT', 'INGENIEUR', 'CONTROLEUR', 'ADMIN'],
      },
      { href: '/gantt', icon: GanttChart, label: 'Chronogramme Portefeuille', tKey: 'nav.gantt',
        labelByRole: { DIR_DPE: 'Planning — Jalons & Phases', PMO: 'Planning / Gantt', CHEF_DEPT: 'Planning / Gantt', CHEF_PROJ: 'Mon Planning / Gantt' },
      },
      { href: '/wbs', icon: Network, label: 'Structure WBS', tKey: 'nav.wbs',
        onlyRoles: ['CHEF_PROJ', 'ASSISTANT', 'INGENIEUR', 'CONTROLEUR', 'ADMIN'] },
      {
        href: '/taches',
        icon: CheckSquare2,
        label: 'Tâches & Activités',
        tKey: 'nav.tasks',
        labelByRole: { CHEF_PROJ: 'Mes tâches & équipe' },
        onlyRoles: ['CHEF_PROJ', 'ASSISTANT', 'INGENIEUR', 'CONTROLEUR', 'ADMIN'],
        badge: stats.tachesEnRetard > 0 ? String(stats.tachesEnRetard) : undefined,
        badgeType: 'danger' as BadgeType,
      },
    ],
  },

  /* ── 3. Exécution & Contrôle ── Terrain, risques, SIG */
  {
    id: 'execution',
    icon: Activity,
    label: 'Exécution & Contrôle',
    tKey: 'sidebar.executionControle',
    labelByRole: {
      CHEF_DEPT: 'Supervision Terrain & Chantiers',
      CHEF_PROJ: 'Suivi Terrain & Risques',
      PMO:       'Contrôle & Risques Portefeuille',
    },
    shortLabel: 'Terrain',
    routes: ['/terrain', '/risques', '/cartographie'],
    items: [
      { href: '/terrain', icon: MapPin, label: 'Avancement Terrain', tKey: 'nav.terrain',
        labelByRole: { CHEF_DEPT: 'Avancement & supervision chantiers', CHEF_PROJ: 'Avancement physique chantiers' },
        hideRoles: ['DIR_DPE'],
      },
      {
        href: '/risques',
        icon: ShieldAlert,
        label: 'Risques & QHSE',
        tKey: 'nav.risks',
        labelByRole: { CHEF_DEPT: 'Risques projets unité', PMO: 'Registre risques portefeuille' },
        badge: '4', badgeType: 'warning',
      },
      { href: '/cartographie', icon: Map, label: 'Cartographie SIG', tKey: 'nav.map',
        labelByRole: { CHEF_DEPT: 'SIG Unité', PMO: 'SIG Portefeuille', DIR_DPE: 'SIG Stratégique' },
      },
    ],
  },

  /* ── 4. Finances & Engagements ── Vue budgétaire adaptée */
  {
    id: 'finances',
    icon: Wallet,
    label: 'Finances & Engagements',
    tKey: 'sidebar.financesEngagements',
    labelByRole: {
      DIR_DPE:   'Finances — Vue Exécutive',
      CTRL_FIN:  'Finances & Comptabilité',
      CHEF_PROJ: 'Finances du projet',
    },
    shortLabel: 'Finances',
    routes: ['/budget', '/marches', '/bordereaux', '/receptions', '/evm', '/fournisseurs', '/immobilisations'],
    items: [
      { href: '/budget',     icon: Wallet,         label: 'Budget & Décaissements', tKey: 'nav.budget',
        labelByRole: { DIR_DPE: 'Budget portefeuille — synthèse', CHEF_PROJ: 'Budget de mon projet' } },
      { href: '/marches',    icon: FileSignature,  label: 'Contrats & Marchés',   tKey: 'nav.markets', hideRoles: ['DIR_DPE'] },
      { href: '/bordereaux', icon: BookOpen,       label: 'Bordereaux / BOQ — Décomptes', hideRoles: ['DIR_DPE'] },
      { href: '/receptions', icon: ClipboardCheck, label: 'Réceptions & Paiements', hideRoles: ['DIR_DPE'],
        labelByRole: { RESP_LOG: 'Réceptions & Appui projet' } },
      { href: '/evm',        icon: TrendingUp,     label: 'Valeur Acquise EVM', tKey: 'nav.evm',
        labelByRole: { DIR_DPE: 'Performance EVM — Portefeuille', CHEF_PROJ: 'EVM de mon projet' } },
      { href: '/fournisseurs', icon: Building2,   label: 'Fournisseurs & Dettes',
        labelByRole: { CTRL_FIN: 'Fournisseurs — Intérêts moratoires', CHEF_PROJ: 'Fournisseurs du projet' } },
      { href: '/immobilisations', icon: Building2, label: 'Immobilisations & Amortissements',
        tKey: 'nav.assets', onlyRoles: ['CTRL_FIN', 'CHEF_DEPT', 'IMMO', 'AUDIT', 'RESP_LOG', 'ADMIN'],
        labelByRole: { RESP_LOG: 'Patrimoine & Inventaire' } },
    ],
  },

  /* ── 5. Logistique & Ressources ── ODM, flotte, RH */
  {
    id: 'logistique',
    icon: ClipboardList,
    label: 'Logistique & Ressources',
    tKey: 'sidebar.logistiqueRessources',
    labelByRole: {
      CHEF_DEPT: 'Mes ODM & Logistique',
      RESP_LOG:    'Gestion Logistique & RH',
      ASSISTANT:   'Agenda & Réunions',
      SECRETAIRE:  'Réunions & Pointage',
    },
    shortLabel: 'Logistique',
    routes: ['/odm', '/flotte', '/rh', '/reservation-salle', '/pointage'],
    items: [
      {
        href: '/odm',
        icon: ClipboardList,
        label: 'Ordres de Mission',
        tKey: 'nav.odm',
        labelByRole: { CHEF_DEPT: 'Mes ordres de mission', RESP_LOG: 'Gestion ODM & Validation' },
        badge: '5', badgeType: 'warning',
      },
      { href: '/flotte', icon: Car,    label: 'Flotte & Chauffeurs',  tKey: 'nav.fleet', hideRoles: ['CHEF_DEPT'] },
      { href: '/rh',     icon: Users2, label: 'Ressources Humaines',  hideRoles: ['CHEF_DEPT'] },
      { href: '/reservation-salle', icon: DoorOpen, label: 'Réservation de salle' },
      { href: '/pointage', icon: Clock, label: 'Pointage heures sup. → UAGL' },
    ],
  },

  /* ── 6. Transverses ── Parapheur, GED, rapports, analytique, IA */
  {
    id: 'transverses',
    icon: Zap,
    label: 'Transverses',
    tKey: 'sidebar.transverses',
    labelByRole: {
      DIR_DPE:  'Analytique & Rapports Direction',
      CTRL_FIN: 'Reporting & Validation Financière',
    },
    shortLabel: 'Transv.',
    routes: ['/suivi-evaluation', '/workflows', '/ged', '/analytique', '/studio-rapports', '/reporting', '/agents-ia', '/copilot', '/courriers', '/migration', '/constructeur-indicateurs'],
    items: [
      {
        href: '/workflows',
        icon: CheckSquare2,
        label: 'Parapheur / Validations',
        tKey: 'nav.workflows',
        labelByRole: { DIR_DPE: 'Circuit de validation', CTRL_FIN: 'Validation financière' },
        badge: '8', badgeType: 'danger',
      },
      { href: '/suivi-evaluation', icon: Activity, label: 'KPI & Suivi-Évaluation',
        labelByRole: { DIR_DPE: 'KPI & Résultats Stratégiques', PMO: 'KPI / Suivi-Évaluation', EXPERT: 'KPI métier', CHARGE: 'KPI métier' },
      },  // KPI de son métier à son niveau — POUR TOUS (données scopées)
      { href: '/ged',             icon: FolderOpen, label: 'GED & Documents',       tKey: 'nav.ged' },  // GED pour tous
      { href: '/analytique',      icon: PieChart,   label: 'Analytique & BI',
        labelByRole: { DIR_DPE: 'Tableaux de bord stratégiques', CTRL_FIN: 'Analytique financière' } },
      { href: '/constructeur-indicateurs', icon: Calculator, label: 'Constructeur d\'Indicateurs',
        tKey: 'nav.indicatorBuilder', onlyRoles: ['DIR_DPE', 'PMO', 'ADMIN', 'CHEF_DEPT'] },
      { href: '/studio-rapports', icon: PenTool,    label: 'Studio de Rapports',    hideRoles: ['CHEF_PROJ', 'CHEF_DEPT'] },
      { href: '/reporting',       icon: FileText,   label: 'Reporting & Exports', tKey: 'nav.reporting',
        labelByRole: { DIR_DPE: 'Rapports Direction & Bailleurs', CTRL_FIN: 'Rapports financiers' } },
      { href: '/courriers',       icon: FileText,   label: 'Courriers & Parapheur',  tKey: 'nav.courriers' },
      { href: '/agents-ia',       icon: Bot,        label: 'Centre IA',             tKey: 'nav.aiAgents' }, // hub : Assistant IA · Copilot M365 · Migration
    ],
  },

  /* ── 7. Paramétrage ── Admin uniquement */
  {
    id: 'parametrage',
    icon: Settings,
    label: 'Paramétrage',
    shortLabel: 'Config.',
    routes: ['/administration', '/dashboard-builder', '/administration/org-config'],
    items: [
      { href: '/administration',    icon: Settings,        label: 'Utilisateurs & Rôles' },
      { href: '/administration/acces', icon: ShieldCheck,  label: 'Habilitations par rôle', onlyRoles: ['ADMIN','DIR_DPE'] },
      { href: '/dashboard-builder', icon: LayoutDashboard, label: 'Vue personnalisée' },
      { href: '/administration/org-config', icon: Building2, label: 'Organigramme & Config', onlyRoles: ['DIR_DPE','PMO','ADMIN'] },
    ],
  },
];

/* ══════════════════════════════════════════════════════════════════════════
   LOGO SENELEC — Charte graphique officielle
   Deux pales translucides qui s'entraînent l'une l'autre :
   - Pale A : orange → rouge (#F58220 → #E2003B)
   - Pale B : violet → rose  (#7A2D8B → #C82060)
   Typographie "senelec" en blanc, inscription dans l'emblème.
══════════════════════════════════════════════════════════════════════════ */

/**
 * SenelecEmblem — deux grandes formes ovales qui se chevauchent,
 * exactement comme le logo officiel Senelec :
 *   forme gauche  : violet/magenta (gradient radial)
 *   forme droite  : orange → rouge (gradient radial)
 *   chevauchement : la forme droite passe par-dessus
 *   texte "senelec" en blanc au centre (version fullText seulement)
 */
function SenelecEmblem({ size = 32 }: { size?: number; showText?: boolean }) {
  // Logo officiel SENELEC (badge circulaire) — composant partagé, non redessiné.
  return <SenelecLogo size={size} />;
}

/** Logo complet — emblème + "senelec" + sous-titre SIGEPP·DPE. Utilisé dans le panel élargi. */
function SenelecMarkFull() {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10, userSelect: 'none' }}>
      {/* Nom du système */}
      <div style={{ lineHeight: 1.1 }}>
        <div style={{
          fontFamily: "'Inter','Segoe UI',Arial,sans-serif",
          fontSize: 14, fontWeight: 800, letterSpacing: '0.01em',
          color: '#2E5BB0',
        }}>SIGEPP-DPE</div>
        <div style={{
          fontFamily: "'Inter','Segoe UI',Arial,sans-serif",
          fontSize: 7.5, fontWeight: 600, letterSpacing: '0.10em',
          color: '#94A3B8', textTransform: 'uppercase', marginTop: 3,
        }}>Direction Principale Équipement</div>
      </div>
    </div>
  );
}

/* ══════════════════════════════════════════════════════════════════════════
   HELPERS
══════════════════════════════════════════════════════════════════════════ */
function detectSection(pathname: string): string {
  const found = SECTIONS.find(s =>
    s.routes.some(r => pathname === r || pathname.startsWith(r + '/'))
  );
  return found?.id ?? 'accueil';
}

function getItemLabel(item: NavItem, role: RoleCode | undefined, t: (k: TranslationKey) => string): string {
  if (role && item.labelByRole?.[role]) return item.labelByRole[role]!;
  if (item.tKey) return t(item.tKey);
  return item.label;
}

function getSectionLabel(sec: SidebarSection, role: RoleCode | undefined, t: (k: TranslationKey) => string): string {
  if (role && sec.labelByRole?.[role]) return sec.labelByRole[role]!;
  if (sec.tKey) return t(sec.tKey);
  return sec.label;
}

function isItemVisible(item: NavItem, role: RoleCode | undefined, direction: string | undefined, canAccessNavItem: (href: string) => boolean): boolean {
  if (!role) return true; // demo mode
  if (!canAccessNavItem(item.href)) return false;
  if (item.onlyRoles && !item.onlyRoles.includes(role)) return false;
  if (item.hideRoles && item.hideRoles.includes(role)) return false;
  if (direction) {
    if (item.onlyDirections && !item.onlyDirections.includes(direction)) return false;
    if (item.hideDirections && item.hideDirections.includes(direction)) return false;
  }
  return true;
}

/* ══════════════════════════════════════════════════════════════════════════
   SIDEBAR COMPONENT
══════════════════════════════════════════════════════════════════════════ */
export default function Sidebar() {
  const path = usePathname();
  const router = useRouter();
  const { user, login, logout, canAccessSection, canAccessNavItem } = useAuth();
  const [showProfileSwitch, setShowProfileSwitch] = useState(false);

  const switchProfile = (email: string) => {
    login(email, 'dpe2026');
    setShowProfileSwitch(false);
    setNavExpanded(false);
    setMobileOpen(false);
    router.push('/tableau-de-bord');
  };
  const { t } = useTranslation();
  const [mobileOpen,      setMobileOpen]      = useState(false);
  const [navExpanded,     setNavExpanded]     = useState(false);
  const [activeSectionId, setActiveSectionId] = useState<string>(() => detectSection(path));
  const hoverTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    setActiveSectionId(detectSection(path));
    // À chaque changement de page : on referme le panneau déroulé et le drawer mobile.
    setNavExpanded(false);
    setMobileOpen(false);
    if (hoverTimeout.current) clearTimeout(hoverTimeout.current);
  }, [path]);

  const role = user?.role;
  const userRole = user ? ROLES[user.role] : null;

  // Filter sections visible to this role.
  // Règle : on ne montre JAMAIS une section dont le panneau serait vide.
  // Une section est affichée si elle a un lien direct OU au moins un item visible.
  const visibleSections = SECTIONS.filter(s => {
    if (user && !canAccessSection(s.id as SidebarSectionId)) return false;
    if (s.directLink) return true;
    return s.items.some(item => isItemVisible(item, role, user?.direction, canAccessNavItem));
  });

  const activeSection = visibleSections.find(s => s.id === activeSectionId) ?? visibleSections[0] ?? SECTIONS[0];

  // Filter items within the active section
  const visibleItems = activeSection.items.filter(item => isItemVisible(item, role, user?.direction, canAccessNavItem));

  const handleLogout = () => {
    logout();
    router.push('/login');
  };

  const badgeColors: Record<BadgeType, { bg: string; text: string; border: string }> = {
    danger:  { bg: '#FEE2E2', text: '#DC2626', border: '#FECACA' },
    warning: { bg: '#FFF7ED', text: '#EA580C', border: '#FED7AA' },
    info:    { bg: '#EFF6FF', text: '#2563EB', border: '#BFDBFE' },
  };

  const handleSectionClick = (sec: SidebarSection) => {
    setActiveSectionId(sec.id);
    // Si la section a un lien direct (ex. Accueil), on navigue ET on referme le panneau + le drawer mobile.
    if (sec.directLink) {
      router.push(sec.directLink);
      setMobileOpen(false);
      setNavExpanded(false);
      if (hoverTimeout.current) clearTimeout(hoverTimeout.current);
    }
  };

  const panelContent = (
    <div
      style={{ display: 'flex', height: '100%', overflow: 'hidden' }}
      onMouseEnter={() => {
        if (hoverTimeout.current) clearTimeout(hoverTimeout.current);
        setNavExpanded(true);
      }}
      onMouseLeave={() => {
        hoverTimeout.current = setTimeout(() => setNavExpanded(false), 250);
      }}
    >

      {/* ═══════ RAIL GAUCHE — icônes sections (52px fixe) ═══════ */}
      <div style={{
        width: 52, flexShrink: 0,
        background: '#2D1167',
        display: 'flex', flexDirection: 'column', alignItems: 'center',
        borderRight: '1px solid rgba(255,255,255,0.10)',
      }}>
        {/* Logo compact */}
        <div style={{
          height: 'var(--header-h)', width: '100%', flexShrink: 0,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          borderBottom: '1px solid rgba(255,255,255,0.10)',
        }}>
          <SenelecEmblem size={30} />
        </div>

        {/* Section icons */}
        <nav style={{ flex: 1, overflowY: 'auto', width: '100%', padding: '4px 0' }}>
          {visibleSections.map(sec => {
            const Icon = sec.icon;
            const isActive = sec.id === activeSectionId;
            const hasAlert = sec.items.some(i => i.badge && parseInt(i.badge) > 0 && i.badgeType === 'danger');

            const btn = (
              <button
                key={sec.id}
                onClick={() => handleSectionClick(sec)}
                title={getSectionLabel(sec, role, t)}
                style={{
                  width: '100%', padding: '9px 0 8px',
                  display: 'flex', flexDirection: 'column',
                  alignItems: 'center', justifyContent: 'center', gap: 4,
                  background: isActive ? 'rgba(255,255,255,0.16)' : 'transparent',
                  border: 'none',
                  borderLeft: isActive ? '3px solid #F47920' : '3px solid transparent',
                  cursor: 'pointer', transition: 'background 0.12s',
                  fontFamily: 'inherit', position: 'relative',
                }}
                onMouseEnter={e => {
                  if (!isActive) (e.currentTarget as HTMLButtonElement).style.background = 'rgba(255,255,255,0.10)';
                }}
                onMouseLeave={e => {
                  if (!isActive) (e.currentTarget as HTMLButtonElement).style.background = 'transparent';
                }}
              >
                <Icon size={16} style={{ color: isActive ? '#F9B96F' : 'rgba(255,255,255,0.68)' }} />
                <span style={{
                  fontSize: 7, fontWeight: 600,
                  color: isActive ? '#F9B96F' : 'rgba(255,255,255,0.50)',
                  letterSpacing: '0.02em', textAlign: 'center',
                  lineHeight: 1.2, maxWidth: 44, wordBreak: 'break-word',
                }}>
                  {sec.shortLabel}
                </span>
                {hasAlert && !isActive && (
                  <div style={{
                    position: 'absolute', top: 6, right: 8,
                    width: 7, height: 7, borderRadius: '50%',
                    background: '#EF4444',
                    boxShadow: '0 0 0 1.5px #2D1167',
                  }} />
                )}
              </button>
            );

            return btn;
          })}
        </nav>

        {/* Toggle + avatar + logout */}
        <div style={{
          width: '100%', padding: '6px 0 10px',
          borderTop: '1px solid rgba(255,255,255,0.10)',
          display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 7,
        }}>
          <div
            title="Développer pour voir les éléments"
            style={{
              width: 32, height: 32, borderRadius: 7,
              background: 'rgba(255,255,255,0.08)',
              border: '1px solid rgba(255,255,255,0.15)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}
          >
            <ChevronRight size={14} color="rgba(255,255,255,0.50)" />
          </div>
          <div
            title={user ? `${user.prenom} ${user.nom} — ${userRole?.label}` : 'Utilisateur'}
            style={{
              width: 30, height: 30, borderRadius: 8,
              background: user ? user.avatarColor : '#3D1A6B',
              border: '2px solid rgba(255,255,255,0.25)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 10, fontWeight: 800, color: '#fff', cursor: 'default',
            }}
          >
            {user?.initials ?? 'DPE'}
          </div>
          <button
            onClick={handleLogout}
            title="Se déconnecter"
            style={{
              width: 30, height: 30, borderRadius: 7,
              background: 'transparent', border: 'none',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              cursor: 'pointer',
            }}
            onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.background = 'rgba(239,68,68,0.18)'; }}
            onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.background = 'transparent'; }}
          >
            <LogOut size={14} color="rgba(255,255,255,0.55)" />
          </button>
        </div>
      </div>

      {/* ═══════ PANEL DROIT — navigation contextuelle ═══════ */}
      <div style={{
        width: navExpanded ? 208 : 0,
        flexShrink: 0,
        overflow: 'hidden',
        transition: 'width 0.22s cubic-bezier(.4,0,.2,1)',
        display: 'flex', flexDirection: 'column',
        background: '#fff',
      }}>
        {/* Logo complet */}
        <div style={{
          height: 'var(--header-h)', padding: '0 12px',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          borderBottom: '1px solid var(--border)', flexShrink: 0, minWidth: 208,
        }}>
          <Link href="/tableau-de-bord" style={{ textDecoration: 'none' }}>
            <SenelecMarkFull />
          </Link>
          <button
            onClick={() => setMobileOpen(false)}
            className="sidebar-close-btn"
            style={{
              display: 'none', background: 'transparent',
              border: 'none', color: 'var(--text-muted)',
              cursor: 'pointer', padding: 4, borderRadius: 4,
            }}
          >
            <X size={14} />
          </button>
        </div>

        {/* Section label */}
        <div style={{
          padding: '10px 14px 6px', minWidth: 208, flexShrink: 0,
          display: 'flex', alignItems: 'center', gap: 6,
        }}>
          <div style={{
            width: 3, height: 16, borderRadius: 2,
            background: '#F47920', flexShrink: 0,
          }} />
          <span style={{
            fontSize: 10, fontWeight: 700, letterSpacing: '0.08em',
            textTransform: 'uppercase', color: '#64748B',
            whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
          }}>
            {getSectionLabel(activeSection, role, t)}
          </span>
        </div>

        {/* Nav items */}
        <nav style={{
          flex: 1, overflowY: 'auto', overflowX: 'hidden',
          padding: '2px 0 10px', minWidth: 208,
        }}>
          {visibleItems.map(item => {
            const Icon = item.icon;
            // Un SEUL item actif : on retient le href le plus SPÉCIFIQUE (le plus long)
            // qui correspond au chemin courant. Sans cela, « /administration » et
            // « /administration/acces » s'activeraient simultanément.
            const matchHref = visibleItems
              .filter(it => path === it.href || path.startsWith(it.href + '/'))
              .sort((a, b) => b.href.length - a.href.length)[0]?.href;
            const isActive = item.href === matchHref;
            const bc = item.badgeType ? badgeColors[item.badgeType] : null;
            const showBadge = !!item.badge && parseInt(item.badge, 10) > 0;
            const label = getItemLabel(item, role, t);

            return (
              <Link
                key={item.href}
                href={item.href}
                style={{ textDecoration: 'none', display: 'block' }}
                onClick={() => { setMobileOpen(false); setNavExpanded(false); if (hoverTimeout.current) clearTimeout(hoverTimeout.current); }}
              >
                <div
                  style={{
                    display: 'flex', alignItems: 'center', gap: 9,
                    margin: '1px 8px', padding: '8px 10px', borderRadius: 7,
                    borderLeft: isActive ? '3px solid #F47920' : '3px solid transparent',
                    background: isActive ? '#F3EBF9' : 'transparent',
                    cursor: 'pointer', transition: 'background 0.1s', whiteSpace: 'nowrap',
                  }}
                  onMouseEnter={e => {
                    if (!isActive) (e.currentTarget as HTMLDivElement).style.background = '#F8FAFC';
                  }}
                  onMouseLeave={e => {
                    if (!isActive) (e.currentTarget as HTMLDivElement).style.background = 'transparent';
                  }}
                >
                  <Icon size={14} style={{ color: isActive ? '#3D1A6B' : '#94A3B8', flexShrink: 0 }} />
                  <span style={{
                    flex: 1, fontSize: 13,
                    fontWeight: isActive ? 700 : 400,
                    color: isActive ? '#3D1A6B' : '#374151',
                    overflow: 'hidden', textOverflow: 'ellipsis',
                    lineHeight: 1.3,
                  }}>
                    {label}
                  </span>
                  {showBadge && bc && (
                    <span style={{
                      fontSize: 10, fontWeight: 700,
                      padding: '1px 6px', borderRadius: 99,
                      background: bc.bg, color: bc.text,
                      border: `1px solid ${bc.border}`, flexShrink: 0,
                    }}>
                      {item.badge}
                    </span>
                  )}
                </div>
              </Link>
            );
          })}
        </nav>

        {/* Utilisateur — cliquer pour CHANGER DE PROFIL */}
        <div style={{
          padding: '8px', minWidth: 208, position: 'relative',
          borderTop: '1px solid var(--border)',
          background: '#FAFBFD', flexShrink: 0,
        }}>
          {/* Sélecteur de profil (liste des comptes de démonstration) */}
          {showProfileSwitch && (
            <>
              <div onClick={() => setShowProfileSwitch(false)} style={{ position: 'fixed', inset: 0, zIndex: 998 }} />
              <div style={{
                position: 'absolute', bottom: 'calc(100% - 4px)', left: 8, right: 8, zIndex: 999,
                background: '#fff', border: '1px solid var(--border)', borderRadius: 10,
                boxShadow: '0 -8px 28px rgba(15,23,42,0.18)', overflow: 'hidden', maxHeight: 360, display: 'flex', flexDirection: 'column',
              }}>
                <div style={{ padding: '8px 12px', fontSize: 10, fontWeight: 800, color: '#64748B', textTransform: 'uppercase', letterSpacing: '0.06em', borderBottom: '1px solid #F1F5F9', display: 'flex', alignItems: 'center', gap: 5 }}>
                  <Repeat size={11} /> Changer de profil
                </div>
                <div style={{ overflowY: 'auto' }}>
                  {DEMO_ACCOUNTS.map(acc => {
                    const r = ROLES[acc.role];
                    const isCurrent = acc.email === user?.email;
                    return (
                      <button key={acc.email} onClick={() => switchProfile(acc.email)}
                        style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 8, padding: '7px 12px', border: 'none', background: isCurrent ? '#F3EBF9' : 'transparent', cursor: 'pointer', textAlign: 'left', borderBottom: '1px solid #F8FAFC' }}
                        onMouseEnter={e => { if (!isCurrent) (e.currentTarget as HTMLButtonElement).style.background = '#F8FAFC'; }}
                        onMouseLeave={e => { if (!isCurrent) (e.currentTarget as HTMLButtonElement).style.background = 'transparent'; }}>
                        <div style={{ width: 24, height: 24, borderRadius: 6, flexShrink: 0, background: acc.avatarColor, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 9, fontWeight: 800, color: '#fff' }}>{acc.initials}</div>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ fontSize: 11.5, fontWeight: 700, color: '#1E293B', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{acc.prenom} {acc.nom}</div>
                          <div style={{ fontSize: 9.5, color: r?.color ?? '#94A3B8', fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{r?.icon} {r?.label}</div>
                        </div>
                        {isCurrent && <Check size={13} style={{ color: '#3D1A6B', flexShrink: 0 }} />}
                      </button>
                    );
                  })}
                </div>
              </div>
            </>
          )}

          <div style={{
            display: 'flex', alignItems: 'center', gap: 8,
            padding: '7px 9px', background: '#fff', borderRadius: 9,
            border: `1px solid ${showProfileSwitch ? '#C4B5FD' : 'var(--border)'}`,
            boxShadow: '0 1px 3px rgba(0,0,0,0.05)',
          }}>
            <button
              onClick={() => setShowProfileSwitch(v => !v)}
              title="Cliquer pour changer de profil"
              style={{ flex: 1, minWidth: 0, display: 'flex', alignItems: 'center', gap: 8, background: 'none', border: 'none', cursor: 'pointer', padding: 0, textAlign: 'left', fontFamily: 'inherit' }}
            >
              <div style={{
                width: 28, height: 28, borderRadius: 7, flexShrink: 0,
                background: user ? user.avatarColor : '#3D1A6B',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: 10, fontWeight: 800, color: '#fff',
              }}>
                {user?.initials ?? 'DPE'}
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                  <span style={{ fontSize: 12, fontWeight: 700, color: '#1E293B', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {user ? `${user.prenom} ${user.nom}` : 'Utilisateur'}
                  </span>
                  <Repeat size={10} style={{ color: '#A78BFA', flexShrink: 0 }} />
                </div>
                <div style={{ fontSize: 10, color: userRole ? userRole.color : '#94A3B8', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontWeight: 600 }}>
                  {userRole ? `${userRole.icon} ${userRole.label}` : 'DPE'}
                </div>
                <div style={{ fontSize: 9, color: '#94A3B8', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {user ? getDirectionLabel(user.direction) : ''}
                  {user?.departement ? ` — ${getDepartementLabel(user.departement)}` : ''}
                  {user?.cellule && !user?.departement ? ` — ${user.cellule}` : ''}
                </div>
              </div>
            </button>
            <button
              onClick={handleLogout}
              title="Déconnexion"
              style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 2, color: '#94A3B8', flexShrink: 0 }}
              onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.color = '#EF4444'; }}
              onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.color = '#94A3B8'; }}
            >
              <LogOut size={13} />
            </button>
          </div>
        </div>
      </div>
    </div>
  );

  const sidebarWidth = navExpanded ? 260 : 52;

  return (
    <>
      {/* ── Desktop sidebar ── */}
      <aside
        className="sidebar-desktop"
        style={{
          width: sidebarWidth, flexShrink: 0,
          background: '#fff', borderRight: '1px solid var(--border)',
          display: 'flex', flexDirection: 'column',
          height: '100vh', overflow: 'hidden',
          boxShadow: '1px 0 0 0 var(--border)',
          transition: 'width 0.22s cubic-bezier(.4,0,.2,1)',
        }}
      >
        {panelContent}
      </aside>

      {/* ── Hamburger mobile ── */}
      <button
        onClick={() => setMobileOpen(true)}
        className="sidebar-hamburger"
        aria-label="Ouvrir le menu"
        style={{
          position: 'fixed', top: 11, left: 12, zIndex: 60,
          background: '#2D1167', color: '#fff',
          border: 'none', borderRadius: 7,
          width: 36, height: 36,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          cursor: 'pointer', boxShadow: '0 2px 8px rgba(45,17,103,0.40)',
        }}
      >
        <Menu size={18} />
      </button>

      {/* ── Overlay mobile ── */}
      {mobileOpen && (
        <div
          onClick={() => setMobileOpen(false)}
          style={{
            position: 'fixed', inset: 0,
            background: 'rgba(15,23,42,0.50)',
            zIndex: 50, backdropFilter: 'blur(3px)',
          }}
        />
      )}

      {/* ── Drawer mobile ── */}
      <aside
        className="sidebar-mobile"
        style={{
          position: 'fixed', top: 0,
          left: mobileOpen ? 0 : '-272px',
          width: 260, height: '100vh',
          background: '#fff', borderRight: '1px solid var(--border)',
          display: 'flex', flexDirection: 'column',
          zIndex: 60,
          transition: 'left 0.22s cubic-bezier(.4,0,.2,1)',
          boxShadow: mobileOpen ? '4px 0 32px rgba(15,23,42,0.18)' : 'none',
        }}
      >
        {panelContent}
      </aside>

      <style>{`
        @media (min-width: 769px) {
          .sidebar-hamburger { display: none !important; }
          .sidebar-mobile    { display: none !important; }
        }
        @media (max-width: 768px) {
          .sidebar-desktop   { display: none !important; }
          .sidebar-close-btn { display: flex !important; }
        }
      `}</style>
    </>
  );
}

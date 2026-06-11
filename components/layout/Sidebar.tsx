'use client';
/**
 * Sidebar SIGEPP-DPE — Double-level navigation
 * Rail (52px) → Sub-panel (220px)  |  Total: 272px expanded / 52px collapsed
 */
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useState, useEffect, useRef } from 'react';
import {
  Home, LayoutDashboard, Bell,
  FolderKanban, Layers, Briefcase, GanttChart, Network,
  Activity, MapPin, Map, ShieldAlert,
  Wallet, FileSignature, BookOpen, ClipboardCheck, TrendingUp, Building2,
  Boxes, Calculator, Car, ClipboardList, DoorOpen, Users2, Clock,
  PieChart, CheckSquare2, FolderOpen, PenTool, FileText, Bot, Zap,
  Settings, ShieldCheck, LayoutGrid,
  ChevronRight, Menu, X, LogOut, Repeat, Check, Search, Command,
  BarChart2, Sparkles, Banknote, AlertCircle,
  Target, Database, Plug2, MessagesSquare,
} from 'lucide-react';
import { getAnalytics } from '@/lib/data';
import { useAuth, ROLES, DEMO_ACCOUNTS, type SidebarSectionId, type RoleCode, getDirectionLabel } from '@/lib/authStore';
import { useParapheurStore } from '@/lib/parapheurStore';
import { useNotificationStore } from '@/lib/notificationStore';
import { getDepartementLabel } from '@/lib/dpeOrgStructure';
import { useTranslation } from '@/lib/i18n/I18nContext';
import SenelecLogo from '@/components/ui/SenelecLogo';
import { useSidebar } from '@/lib/sidebarContext';

const stats = getAnalytics();

/* ── Types ───────────────────────────────────────────────────────────────── */
type BadgeType = 'danger' | 'warning' | 'info' | 'success';

interface NavItem {
  href: string;
  icon: React.ComponentType<{ size?: number; style?: React.CSSProperties }>;
  label: string;
  labelByRole?: Partial<Record<RoleCode, string>>;
  badge?: string;
  badgeType?: BadgeType;
  onlyRoles?: RoleCode[];
  hideRoles?: RoleCode[];
  onlySection?: SidebarSectionId;
}

interface NavGroup {
  label: string;
  items: NavItem[];
}

interface Domain {
  id: string;
  icon: React.ComponentType<{ size?: number; style?: React.CSSProperties }>;
  label: string;
  shortLabel: string;
  groups: NavGroup[];
  sectionId?: SidebarSectionId;
}

/* ── Domain / Menu structure ─────────────────────────────────────────────────
   Architecture IA (Information Architecture) — principes appliqués :
   ① Groupes ≤ 5 items  ② Regroupement par tâche utilisateur, pas par feature
   ③ Intégrations = Système (infrastructure)  ④ Routes orphelines surfacées
   ⑤ Redondances supprimées (3 entrées temps → 1)  ⑥ IA en 1re classe
─────────────────────────────────────────────────────────────────────────── */
const DOMAINS: Domain[] = [

  /* ── 1. COCKPIT ──────────────────────────────────────────────────────────── */
  {
    id: 'cockpit',
    icon: Home,
    label: 'Cockpit & Pilotage',
    shortLabel: 'Cockpit',
    groups: [
      {
        label: 'Vue d\'ensemble',
        items: [
          {
            href: '/tableau-de-bord', icon: LayoutDashboard,
            label: 'Tableau de bord',
            labelByRole: { DIR_DPE: 'Cockpit Direction', PMO: 'Cockpit PMO', CHEF_PROJ: 'Mon Tableau de bord', CHEF_DEPT: 'Cockpit Département', CTRL_FIN: 'Dashboard Financier' },
          },
          {
            href: '/alertes', icon: Bell,
            label: 'Alertes & Notifications',
            badge: stats.alertesActives > 0 ? String(stats.alertesActives) : '4',
            badgeType: 'danger',
          },
        ],
      },
    ],
  },

  /* ── 2. OPÉRATIONS PROJET ────────────────────────────────────────────────── */
  {
    id: 'operations',
    icon: Activity,
    label: 'Cœur Opérationnel',
    shortLabel: 'Opérations',
    groups: [
      {
        label: 'Portefeuille & Programmes',
        items: [
          { href: '/portefeuille', icon: FolderKanban, label: 'Vue Portefeuille', hideRoles: ['CHEF_DEPT', 'CHEF_PROJ'] },
          { href: '/programmes', icon: Layers, label: 'Programmes', hideRoles: ['CHEF_DEPT', 'CHEF_PROJ'] },
          { href: '/projets', icon: Briefcase, label: 'Projets', labelByRole: { PMO: 'Tous les projets', CHEF_DEPT: 'Mes Projets', CHEF_PROJ: 'Mes Projets' }, hideRoles: ['DIR_DPE'] },
          { href: '/cockpit-projet', icon: LayoutDashboard, label: 'Fiche Exécutive Projet', labelByRole: { CHEF_PROJ: 'Mon Cockpit Projet' } },
          { href: '/springboard', icon: Sparkles, label: 'Springboard Chef de Projet', labelByRole: { CHEF_PROJ: 'Mon Springboard', PMO: 'Springboard PMO' }, onlyRoles: ['CHEF_PROJ', 'PMO', 'DIR_DPE', 'CHEF_DEPT', 'ADMIN'] },
        ],
      },
      {
        label: 'Planification & Pilotage',
        items: [
          { href: '/gestion-projet', icon: Target, label: 'Gestion de projet', labelByRole: { CHEF_PROJ: 'Mon projet' } },
          { href: '/gantt', icon: GanttChart, label: 'Chronogramme / Gantt', labelByRole: { DIR_DPE: 'Planning Jalons', PMO: 'Planning / Gantt', CHEF_PROJ: 'Mon Planning' } },
          { href: '/wbs', icon: Network, label: 'Structure WBS', onlyRoles: ['CHEF_PROJ', 'ASSISTANT', 'INGENIEUR', 'CONTROLEUR', 'ADMIN'] },
          { href: '/structuration', icon: Boxes, label: 'Structuration des actifs', onlyRoles: ['CHEF_PROJ', 'INGENIEUR', 'CONTROLEUR', 'CHEF_DEPT', 'PMO', 'IMMO', 'ADMIN'] },
          {
            href: '/taches', icon: CheckSquare2, label: 'Tâches & Activités',
            onlyRoles: ['CHEF_PROJ', 'ASSISTANT', 'INGENIEUR', 'CONTROLEUR', 'ADMIN'],
            badge: stats.tachesEnRetard > 0 ? String(stats.tachesEnRetard) : undefined, badgeType: 'danger',
          },
        ],
      },
      {
        label: 'Terrain & Maîtrise des risques',
        items: [
          { href: '/terrain', icon: MapPin, label: 'Avancement Terrain', hideRoles: ['DIR_DPE'] },
          { href: '/risques', icon: ShieldAlert, label: 'Risques & QHSE', badge: '4', badgeType: 'warning' },
          { href: '/cartographie', icon: Map, label: 'Cartographie SIG', badge: '4', badgeType: 'danger' },
        ],
      },
    ],
  },

  /* ── 3. INGÉNIERIE FINANCIÈRE ────────────────────────────────────────────── */
  {
    id: 'finances',
    icon: Wallet,
    label: 'Ingénierie Financière',
    shortLabel: 'Finances',
    sectionId: 'finances',
    groups: [
      {
        /* Budgets & pilotage financier — max 3 items */
        label: 'Budgets & Valorisation',
        items: [
          { href: '/budget', icon: Wallet, label: 'Budget & Décaissements', labelByRole: { DIR_DPE: 'Budget portefeuille', CHEF_PROJ: 'Budget de mon projet' } },
          { href: '/evm', icon: TrendingUp, label: 'Valeur Acquise (EVM)' },
          { href: '/fournisseurs', icon: Building2, label: 'Fournisseurs & Engagements' },
        ],
      },
      {
        /* Processus achat → réception → paiement */
        label: 'Marchés & Achats',
        items: [
          { href: '/marches', icon: FileSignature, label: 'Contrats & Marchés', hideRoles: ['DIR_DPE'] },
          { href: '/bordereaux', icon: BookOpen, label: 'Bordereaux / BOQ', hideRoles: ['DIR_DPE'] },
          { href: '/receptions', icon: ClipboardCheck, label: 'Réceptions & Paiements', hideRoles: ['DIR_DPE'] },
        ],
      },
    ],
  },

  /* ── 4. ACTIFS, RESSOURCES & LOGISTIQUE ──────────────────────────────────── */
  {
    id: 'actifs',
    icon: Building2,
    label: 'Actifs & Ressources',
    shortLabel: 'Actifs',
    groups: [
      {
        /* Immobilisations : entrée unique dans le sidebar → onglets internes */
        label: 'Immobilisations & Patrimoine',
        items: [
          { href: '/immobilisations', icon: Building2, label: 'Registre des actifs', labelByRole: { RESP_LOG: 'Patrimoine & Inventaire' } },
          { href: '/immobilisations/receptions', icon: ClipboardCheck, label: 'PV de réception (MES)', onlySection: 'immobilisations' },
          { href: '/immobilisations/amortissements', icon: Calculator, label: 'Plans d\'amortissement', onlySection: 'immobilisations' },
          { href: '/immobilisations/referentiel', icon: Boxes, label: 'Référentiel de structuration', onlySection: 'immobilisations' },
        ],
      },
      {
        label: 'Logistique & Terrain',
        items: [
          { href: '/flotte', icon: Car, label: 'Flotte & Chauffeurs', badge: '5', badgeType: 'info', hideRoles: ['CHEF_DEPT'] },
          { href: '/odm', icon: ClipboardList, label: 'Ordres de Mission' },
          { href: '/reservation-salle', icon: DoorOpen, label: 'Réservation de salle' },
        ],
      },
      {
        label: 'Ressources Humaines',
        items: [
          { href: '/rh', icon: Users2, label: 'Ressources Humaines', hideRoles: ['CHEF_DEPT'] },
          /* gestion-temps centralise : temps sup., pointage, suivi heures — 1 seule entrée */
          { href: '/gestion-temps', icon: Clock, label: 'Temps & Pointage', labelByRole: { DIR_DPE: 'Temps & Activités RH', RESP_LOG: 'Gestion des temps' } },
        ],
      },
    ],
  },

  /* ── 5. DATA, DOCUMENTS & IA ─────────────────────────────────────────────── */
  {
    id: 'data',
    icon: BarChart2,
    label: 'Intelligence & Documents',
    shortLabel: 'Intel & Docs',
    groups: [
      {
        label: 'Analyse & Performance',
        items: [
          { href: '/suivi-evaluation', icon: Activity, label: 'KPI & Suivi-Évaluation' },
          { href: '/analytique', icon: PieChart, label: 'Analytique & BI' },
          { href: '/constructeur-indicateurs', icon: Calculator, label: 'Constructeur d\'Indicateurs', onlyRoles: ['DIR_DPE', 'PMO', 'ADMIN', 'CHEF_DEPT'] },
        ],
      },
      {
        label: 'Rapports & Exports',
        items: [
          { href: '/studio-rapports', icon: PenTool, label: 'Studio de Rapports', hideRoles: ['CHEF_PROJ', 'CHEF_DEPT'] },
          { href: '/reporting', icon: FileText, label: 'Exports & Tableaux de bord' },
        ],
      },
      {
        label: 'Documents & Collaboration',
        items: [
          { href: '/ged', icon: FolderOpen, label: 'Espace documentaire' },
          { href: '/courriers', icon: MessagesSquare, label: 'Courriers' },
          { href: '/workflows', icon: CheckSquare2, label: 'Parapheur & Validations', badge: '8', badgeType: 'danger' },
        ],
      },
      {
        label: 'Intelligence Artificielle',
        items: [
          /* /agents-ia contient déjà 3 onglets : Assistant IA + Copilot M365 + Migration IA.
             /copilot est donc redondant → supprimé du sidebar (redirige vers /agents-ia). */
          { href: '/agents-ia', icon: Sparkles, label: 'Centre IA & Copilot', labelByRole: { DIR_DPE: 'Copilot Exécutif & IA' } },
        ],
      },
    ],
  },

  /* ── 6. SYSTÈME ─────────────────────────────────────────────────────────── */
  {
    id: 'systeme',
    icon: Settings,
    label: 'Système',
    shortLabel: 'Système',
    sectionId: 'parametrage',
    groups: [
      {
        label: 'Paramétrage & Admin',
        items: [
          { href: '/administration', icon: Settings, label: 'Utilisateurs & Rôles' },
          { href: '/administration/acces', icon: ShieldCheck, label: 'Habilitations & Droits', onlyRoles: ['ADMIN', 'DIR_DPE'] },
          { href: '/administration/org-config', icon: Building2, label: 'Organigramme & Config', onlyRoles: ['DIR_DPE', 'PMO', 'ADMIN'] },
          { href: '/dashboard-builder', icon: LayoutGrid, label: 'Dashboard personnalisé' },
        ],
      },
      {
        /* ERP et outils d'intégration/migration : c'est de l'infrastructure, pas du quotidien */
        label: 'Intégrations & Données',
        items: [
          { href: '/erp-interface', icon: Plug2, label: 'Interface ERP', labelByRole: { DIR_DPE: 'Connecteurs SAP / Oracle / Sage' }, onlyRoles: ['DIR_DPE', 'PMO', 'ADMIN', 'CTRL_FIN'] },
          { href: '/migration', icon: Database, label: 'Migration des données', onlyRoles: ['ADMIN', 'DIR_DPE', 'PMO'] },
        ],
      },
    ],
  },
];

/* ── Helpers ──────────────────────────────────────────────────────────────── */
function findActiveDomainId(path: string): string {
  let best = '', bestLen = -1;
  for (const d of DOMAINS) {
    for (const g of d.groups) {
      for (const it of g.items) {
        if (path === it.href || path.startsWith(it.href + '/')) {
          if (it.href.length > bestLen) { bestLen = it.href.length; best = d.id; }
        }
      }
    }
  }
  return best || 'cockpit';
}

function getLabel<T extends { label: string; labelByRole?: Partial<Record<RoleCode, string>> }>(
  item: T, role: RoleCode | undefined,
): string {
  return (role && item.labelByRole?.[role]) || item.label;
}

function isVisible(item: NavItem, role: RoleCode | undefined, canNav: (href: string) => boolean): boolean {
  if (!role) return true;
  if (!canNav(item.href)) return false;
  if (item.onlyRoles && !item.onlyRoles.includes(role)) return false;
  if (item.hideRoles && item.hideRoles.includes(role)) return false;
  return true;
}

const BADGE_COLORS: Record<BadgeType, { bg: string; text: string }> = {
  danger:  { bg: 'rgba(239,52,64,0.9)',   text: '#fff' },
  warning: { bg: 'rgba(234,88,12,0.9)',   text: '#fff' },
  info:    { bg: 'rgba(37,99,235,0.9)',   text: '#fff' },
  success: { bg: 'rgba(22,163,74,0.9)',   text: '#fff' },
};

/* ═══════════════════════════════════════════════════════════════════════════
   SIDEBAR COMPONENT
═══════════════════════════════════════════════════════════════════════════ */
export default function Sidebar() {
  const path = usePathname();
  const router = useRouter();
  const { user, login, logout, canAccessSection, canAccessNavItem } = useAuth();
  const { t } = useTranslation();

  const role = user?.role as RoleCode | undefined;
  const userRole = user ? ROLES[user.role as RoleCode] : null;

  // Badges dynamiques (live depuis les stores)
  const pendingParapheur = useParapheurStore(s => s.dossiers.filter(d => d.statut === 'en_attente').length);
  const inbox = useNotificationStore(s => s.inbox);
  const unreadInbox = inbox.filter(n => !n.read && n.recipientEmail === user?.email?.toLowerCase()).length;

  const { mobileOpen, closeMobile } = useSidebar();
  const [activeDomain, setActiveDomain] = useState(() => findActiveDomainId(path));
  const [subPanelOpen, setSubPanelOpen] = useState(true);
  const [showProfileSwitch, setShowProfileSwitch] = useState(false);

  /* Sync active domain on navigation */
  useEffect(() => {
    const d = findActiveDomainId(path);
    setActiveDomain(d);
    closeMobile();
  }, [path]);

  /* Active item href */
  const allItems = DOMAINS.flatMap(d => d.groups.flatMap(g => g.items));
  const activeHref = allItems
    .filter(i => path === i.href || path.startsWith(i.href + '/'))
    .sort((a, b) => b.href.length - a.href.length)[0]?.href ?? '';

  const handleLogout = () => { logout(); router.push('/login'); };
  const switchProfile = (email: string) => {
    login(email, 'dpe2026');
    setShowProfileSwitch(false);
    router.push('/tableau-de-bord');
  };

  /* Domain has alert badge? */
  function domainBadge(d: Domain): { count: string; type: BadgeType } | null {
    const PRIORITY: BadgeType[] = ['danger', 'warning', 'info', 'success'];
    let count = 0; let type: BadgeType = 'success';
    for (const g of d.groups) {
      for (const it of g.items) {
        if (it.badge && parseInt(it.badge) > 0) {
          count += parseInt(it.badge);
          const t = it.badgeType ?? 'info';
          if (PRIORITY.indexOf(t) < PRIORITY.indexOf(type)) type = t;
        }
      }
    }
    return count > 0 ? { count: count > 99 ? '99+' : String(count), type } : null;
  }

  /* ── Rail + Sub-panel ─────────────────────────────────────────── */
  const railContent = (
    <div style={{
      width: 52, flexShrink: 0, height: '100%',
      display: 'flex', flexDirection: 'column', overflow: 'hidden',
      background: 'radial-gradient(130% 60% at 50% -10%, rgba(244,121,32,0.22), transparent 60%), linear-gradient(180deg,#2D1167 0%,#1B0A40 100%)',
      borderRight: '1px solid rgba(255,255,255,0.07)',
    }}>
      {/* Logo mark */}
      <div style={{
        height: 56, display: 'flex', alignItems: 'center', justifyContent: 'center',
        flexShrink: 0, borderBottom: '1px solid rgba(255,255,255,0.08)',
      }}>
        <div style={{
          width: 34, height: 34, borderRadius: 10,
          background: 'rgba(255,255,255,0.10)',
          boxShadow: 'inset 0 0 0 1px rgba(255,255,255,0.12)',
          display: 'grid', placeItems: 'center',
        }}>
          <SenelecLogo size={20} />
        </div>
      </div>

      {/* Domain icons */}
      <nav style={{ flex: 1, display: 'flex', flexDirection: 'column', padding: '8px 0', gap: 2, overflowY: 'auto', overflowX: 'hidden' }}>
        {DOMAINS.map(domain => {
          const Icon = domain.icon;
          const isActive = activeDomain === domain.id;
          const badge = domainBadge(domain);
          const hasActiveItem = domain.groups.some(g => g.items.some(i => i.href === activeHref));

          return (
            <button
              key={domain.id}
              title={domain.label}
              aria-label={domain.label}
              onClick={() => {
                setActiveDomain(domain.id);
                setSubPanelOpen(prev => activeDomain === domain.id ? !prev : true);
              }}
              style={{
                position: 'relative',
                display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
                width: 44, height: 44, margin: '0 auto', borderRadius: 10,
                background: isActive && subPanelOpen
                  ? 'rgba(244,121,32,0.20)'
                  : hasActiveItem && !subPanelOpen
                    ? 'rgba(255,255,255,0.10)'
                    : 'transparent',
                border: isActive && subPanelOpen
                  ? '1px solid rgba(244,121,32,0.35)'
                  : '1px solid transparent',
                cursor: 'pointer',
                transition: 'background 0.15s, border-color 0.15s',
              }}
              onMouseEnter={e => {
                if (!isActive || !subPanelOpen) (e.currentTarget as HTMLButtonElement).style.background = 'rgba(255,255,255,0.10)';
              }}
              onMouseLeave={e => {
                const el = e.currentTarget as HTMLButtonElement;
                if (isActive && subPanelOpen) el.style.background = 'rgba(244,121,32,0.20)';
                else if (hasActiveItem && !subPanelOpen) el.style.background = 'rgba(255,255,255,0.10)';
                else el.style.background = 'transparent';
              }}
            >
              <Icon
                size={18}
                style={{
                  color: isActive && subPanelOpen ? '#F9A05C' : hasActiveItem ? '#fff' : 'rgba(255,255,255,0.55)',
                }}
              />
              {badge && (
                <span style={{
                  position: 'absolute', top: 5, right: 5,
                  width: 14, height: 14, borderRadius: 99,
                  background: BADGE_COLORS[badge.type].bg,
                  fontSize: 8, fontWeight: 800, color: '#fff',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  lineHeight: 1,
                }}>
                  {parseInt(badge.count) > 9 ? '9+' : badge.count}
                </span>
              )}
            </button>
          );
        })}
      </nav>

      {/* Rail bottom — logout only (user info lives in sub-panel card) */}
      <div style={{ flexShrink: 0, padding: '8px 0', borderTop: '1px solid rgba(255,255,255,0.08)', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
        <button
          onClick={handleLogout}
          title="Déconnexion"
          aria-label="Se déconnecter"
          style={{ background: 'rgba(255,255,255,0.06)', border: 'none', cursor: 'pointer', color: 'rgba(255,255,255,0.45)', display: 'flex', padding: 7, borderRadius: 7 }}
          onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.color = '#FCA5A5'; (e.currentTarget as HTMLButtonElement).style.background = 'rgba(239,68,68,0.12)'; }}
          onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.color = 'rgba(255,255,255,0.45)'; (e.currentTarget as HTMLButtonElement).style.background = 'rgba(255,255,255,0.06)'; }}
        >
          <LogOut size={14} />
        </button>
      </div>
    </div>
  );

  /* ── Sub-panel ─────────────────────────────────────────────────── */
  const activeDomainData = DOMAINS.find(d => d.id === activeDomain)!;

  const subPanel = (
    <div style={{
      width: subPanelOpen ? 220 : 0,
      flexShrink: 0, height: '100%', overflow: 'hidden',
      background: 'linear-gradient(180deg, #1F0D54 0%, #160A3A 100%)',
      transition: 'width 0.22s cubic-bezier(.4,0,.2,1)',
      display: 'flex', flexDirection: 'column',
    }}>
      <div style={{ width: 220, height: '100%', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        {/* Sub-panel header */}
        <div style={{
          height: 56, flexShrink: 0, padding: '0 14px',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          borderBottom: '1px solid rgba(255,255,255,0.07)',
          gap: 8,
        }}>
          <div style={{ minWidth: 0, flex: 1 }}>
            <div style={{ fontSize: 13.5, fontWeight: 800, color: '#fff', letterSpacing: '-0.2px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
              SIGEPP<span style={{ color: '#F9A05C' }}>-DPE</span>
            </div>
            <div style={{ fontSize: 8, color: 'rgba(255,255,255,0.45)', letterSpacing: '0.07em', textTransform: 'uppercase', whiteSpace: 'nowrap' }}>
              Direction Principale Équipement
            </div>
          </div>
          <button
            onClick={() => setSubPanelOpen(false)}
            style={{ background: 'rgba(255,255,255,0.06)', border: 'none', cursor: 'pointer', color: 'rgba(255,255,255,0.5)', display: 'flex', padding: 4, borderRadius: 6, flexShrink: 0 }}
            title="Fermer le panneau"
            aria-label="Fermer le panneau de navigation"
          >
            <ChevronRight size={13} />
          </button>
        </div>

        {/* Domain title */}
        <div style={{ padding: '10px 14px 6px', flexShrink: 0 }}>
          <div style={{ fontSize: 10, fontWeight: 800, color: '#F9A05C', letterSpacing: '0.1em', textTransform: 'uppercase' }}>
            {activeDomainData?.shortLabel}
          </div>
        </div>

        {/* Search */}
        <div style={{ padding: '0 10px 6px', flexShrink: 0 }}>
          <button
            onClick={() => document.dispatchEvent(new KeyboardEvent('keydown', { key: 'k', metaKey: true, bubbles: true }))}
            aria-label="Ouvrir la palette de commandes (⌘K)"
            style={{
              width: '100%', display: 'flex', alignItems: 'center', gap: 6,
              padding: '5px 8px', background: 'rgba(255,255,255,0.06)',
              border: '1px solid rgba(255,255,255,0.10)', borderRadius: 7,
              cursor: 'pointer', fontFamily: 'inherit',
              color: 'rgba(255,255,255,0.45)', fontSize: 11, textAlign: 'left',
            }}
          >
            <Search size={11} style={{ flexShrink: 0 }} />
            <span style={{ flex: 1 }}>Rechercher…</span>
            <kbd style={{ display: 'flex', alignItems: 'center', gap: 2, background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.12)', borderRadius: 4, padding: '1px 4px', fontSize: 8, fontWeight: 700, color: 'rgba(255,255,255,0.6)', fontFamily: 'inherit' }}>
              <Command size={8} />K
            </kbd>
          </button>
        </div>

        {/* Navigation items */}
        <nav style={{ flex: 1, overflowY: 'auto', overflowX: 'hidden', padding: '0 0 12px' }}>
          {activeDomainData?.groups.map((group, gi) => {
            const visibleItems = group.items.filter(item => isVisible(item, role, canAccessNavItem));
            if (!visibleItems.length) return null;

            return (
              <div key={gi} style={{ marginBottom: 4 }}>
                {/* Group header */}
                <div style={{
                  padding: '8px 14px 4px',
                  fontSize: 9.5, fontWeight: 700,
                  color: 'rgba(255,255,255,0.35)',
                  letterSpacing: '0.09em', textTransform: 'uppercase',
                  whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
                }}>
                  {group.label}
                </div>

                {/* Items */}
                {visibleItems.map(item => {
                  const Icon = item.icon;
                  const active = item.href === activeHref;
                  const hasBadge = item.badge && parseInt(item.badge) > 0;
                  const label = getLabel(item, role);

                  return (
                    <Link key={item.href} href={item.href} style={{ textDecoration: 'none', display: 'block', margin: '0 8px' }}>
                      <div
                        style={{
                          display: 'flex', alignItems: 'center', gap: 8,
                          padding: '6px 8px',
                          borderRadius: 8,
                          borderLeft: active ? '2px solid #F47920' : '2px solid transparent',
                          background: active ? 'linear-gradient(90deg,rgba(244,121,32,0.16),rgba(255,255,255,0.06))' : 'transparent',
                          cursor: 'pointer', transition: 'background 0.1s',
                        }}
                        onMouseEnter={e => { if (!active) (e.currentTarget as HTMLElement).style.background = 'rgba(255,255,255,0.06)'; }}
                        onMouseLeave={e => { if (!active) (e.currentTarget as HTMLElement).style.background = 'transparent'; }}
                      >
                        <Icon
                          size={13}
                          style={{ color: active ? '#F9A05C' : 'rgba(255,255,255,0.45)', flexShrink: 0 }}
                        />
                        <span style={{
                          flex: 1, minWidth: 0,
                          fontSize: 12.5, lineHeight: 1.3,
                          fontWeight: active ? 700 : 500,
                          color: active ? '#fff' : 'rgba(255,255,255,0.78)',
                          overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                        }}>
                          {label}
                        </span>
                        {hasBadge && item.badgeType && (
                          <span style={{
                            ...BADGE_COLORS[item.badgeType],
                            fontSize: 9, fontWeight: 800,
                            padding: '1px 5px', borderRadius: 99,
                            flexShrink: 0, lineHeight: 1.4,
                          }}>
                            {item.badge}
                          </span>
                        )}
                      </div>
                    </Link>
                  );
                })}
              </div>
            );
          })}
        </nav>

        {/* User card */}
        <div style={{ flexShrink: 0, borderTop: '1px solid rgba(255,255,255,0.07)', padding: '8px', position: 'relative' }}>

          {/* Profile switcher — position:fixed pour éviter le clip de overflow:hidden */}
          {showProfileSwitch && (
            <>
              <div onClick={() => setShowProfileSwitch(false)} style={{ position: 'fixed', inset: 0, zIndex: 998 }} />
              <div style={{
                position: 'fixed', bottom: 60, left: 52 + (subPanelOpen ? 220 : 0), width: 240, zIndex: 999,
                background: '#fff', border: '1px solid #E5E7EB', borderRadius: 10,
                boxShadow: '0 -8px 28px rgba(0,0,0,0.18)', overflow: 'hidden',
                maxHeight: 360, display: 'flex', flexDirection: 'column',
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
                        style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 8, padding: '7px 12px', border: 'none', background: isCurrent ? '#F3EBF9' : 'transparent', cursor: 'pointer', textAlign: 'left', fontFamily: 'inherit', borderBottom: '1px solid #F8FAFC' }}
                        onMouseEnter={e => { if (!isCurrent) (e.currentTarget as HTMLButtonElement).style.background = '#F8FAFC'; }}
                        onMouseLeave={e => { if (!isCurrent) (e.currentTarget as HTMLButtonElement).style.background = 'transparent'; }}
                      >
                        <div style={{ width: 24, height: 24, borderRadius: 6, background: acc.avatarColor, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 9, fontWeight: 800, color: '#fff', flexShrink: 0 }}>{acc.initials}</div>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ fontSize: 11.5, fontWeight: 700, color: '#1E293B', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{acc.prenom} {acc.nom}</div>
                          <div style={{ fontSize: 9.5, color: r?.color ?? '#94A3B8', fontWeight: 600 }}>{r?.label}</div>
                        </div>
                        {isCurrent && <Check size={13} style={{ color: '#3D1A6B', flexShrink: 0 }} />}
                      </button>
                    );
                  })}
                </div>
              </div>
            </>
          )}

          <div
            style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '6px 8px', background: 'rgba(255,255,255,0.06)', borderRadius: 10, border: '1px solid rgba(255,255,255,0.10)', cursor: 'pointer' }}
            onClick={() => setShowProfileSwitch(v => !v)}
          >
            <div style={{ width: 26, height: 26, borderRadius: 7, background: user?.avatarColor ?? '#3D1A6B', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 9, fontWeight: 800, color: '#fff', flexShrink: 0 }}>
              {user?.initials ?? 'DPE'}
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 11.5, fontWeight: 700, color: '#fff', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {user ? `${user.prenom} ${user.nom}` : 'Utilisateur'}
              </div>
              <div style={{ fontSize: 9, color: '#F9A05C', fontWeight: 700, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {userRole?.label ?? 'DPE'}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );

  /* ── Full sidebar assembly ──────────────────────────────────────── */
  const sidebarShell = (
    <div style={{ display: 'flex', height: '100%', overflow: 'hidden' }}>
      {railContent}
      {subPanel}
    </div>
  );

  const sidebarWidth = 52 + (subPanelOpen ? 220 : 0);

  return (
    <>
      {/* Desktop */}
      <aside
        className="sidebar-desktop"
        style={{
          width: sidebarWidth, flexShrink: 0, height: '100vh',
          background: '#2D1167',
          borderRight: '1px solid rgba(0,0,0,0.2)',
          boxShadow: '0 0 24px rgba(27,10,64,0.45)',
          overflow: 'hidden',
          transition: 'width 0.22s cubic-bezier(.4,0,.2,1)',
        }}
      >
        {sidebarShell}
      </aside>

      {/* Mobile overlay */}
      {mobileOpen && (
        <div
          onClick={closeMobile}
          style={{ position: 'fixed', inset: 0, background: 'rgba(15,23,42,0.55)', zIndex: 50, backdropFilter: 'blur(3px)' }}
        />
      )}

      {/* Mobile drawer — always shows full rail + sub-panel */}
      <aside
        className="sidebar-mobile"
        style={{
          position: 'fixed', top: 0, left: mobileOpen ? 0 : '-280px',
          width: 272, height: '100vh', zIndex: 60,
          transition: 'left 0.22s cubic-bezier(.4,0,.2,1)',
          boxShadow: mobileOpen ? '4px 0 32px rgba(15,23,42,0.20)' : 'none',
          overflow: 'hidden',
        }}
      >
        <div style={{ display: 'flex', height: '100%', overflow: 'hidden' }}>
          {/* Mobile rail with always-open sub-panel */}
          <div style={{
            width: 52, flexShrink: 0, height: '100%',
            display: 'flex', flexDirection: 'column',
            background: 'radial-gradient(130% 60% at 50% -10%, rgba(244,121,32,0.22), transparent 60%), linear-gradient(180deg,#2D1167 0%,#1B0A40 100%)',
            borderRight: '1px solid rgba(255,255,255,0.07)',
          }}>
            <div style={{ height: 56, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, borderBottom: '1px solid rgba(255,255,255,0.08)' }}>
              <div style={{ width: 34, height: 34, borderRadius: 10, background: 'rgba(255,255,255,0.10)', boxShadow: 'inset 0 0 0 1px rgba(255,255,255,0.12)', display: 'grid', placeItems: 'center' }}>
                <SenelecLogo size={20} />
              </div>
            </div>
            <nav style={{ flex: 1, display: 'flex', flexDirection: 'column', padding: '8px 0', gap: 2 }}>
              {DOMAINS.map(domain => {
                const Icon = domain.icon;
                const isActive = activeDomain === domain.id;
                const badge = domainBadge(domain);
                return (
                  <button key={domain.id} title={domain.label} aria-label={domain.label} onClick={() => setActiveDomain(domain.id)}
                    style={{ position: 'relative', display: 'flex', alignItems: 'center', justifyContent: 'center', width: 44, height: 44, margin: '0 auto', borderRadius: 10, background: isActive ? 'rgba(244,121,32,0.20)' : 'transparent', border: isActive ? '1px solid rgba(244,121,32,0.35)' : '1px solid transparent', cursor: 'pointer' }}>
                    <Icon size={18} style={{ color: isActive ? '#F9A05C' : 'rgba(255,255,255,0.55)' }} />
                    {badge && <span style={{ position: 'absolute', top: 5, right: 5, width: 14, height: 14, borderRadius: 99, background: BADGE_COLORS[badge.type].bg, fontSize: 8, fontWeight: 800, color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>{parseInt(badge.count) > 9 ? '9+' : badge.count}</span>}
                  </button>
                );
              })}
            </nav>
            <div style={{ flexShrink: 0, padding: '8px 0', borderTop: '1px solid rgba(255,255,255,0.08)', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
              <button onClick={handleLogout} title="Déconnexion" aria-label="Se déconnecter" style={{ background: 'rgba(255,255,255,0.06)', border: 'none', cursor: 'pointer', color: 'rgba(255,255,255,0.55)', display: 'flex', padding: 5, borderRadius: 7 }}>
                <LogOut size={13} />
              </button>
            </div>
          </div>
          {/* Mobile sub-panel always visible */}
          <div style={{ width: 220, background: 'linear-gradient(180deg, #1F0D54 0%, #160A3A 100%)', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
            <div style={{ height: 56, flexShrink: 0, padding: '0 14px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: '1px solid rgba(255,255,255,0.07)', gap: 8 }}>
              <div style={{ minWidth: 0, flex: 1 }}>
                <div style={{ fontSize: 13.5, fontWeight: 800, color: '#fff', letterSpacing: '-0.2px', whiteSpace: 'nowrap' }}>SIGEPP<span style={{ color: '#F9A05C' }}>-DPE</span></div>
                <div style={{ fontSize: 8, color: 'rgba(255,255,255,0.45)', letterSpacing: '0.07em', textTransform: 'uppercase' }}>Direction Principale Équipement</div>
              </div>
              <button onClick={closeMobile} title="Fermer le menu" aria-label="Fermer le menu de navigation" style={{ background: 'rgba(255,255,255,0.06)', border: 'none', cursor: 'pointer', color: 'rgba(255,255,255,0.5)', display: 'flex', padding: 4, borderRadius: 6 }}>
                <X size={14} />
              </button>
            </div>
            <div style={{ padding: '8px 14px 4px', fontSize: 10, fontWeight: 800, color: '#F9A05C', letterSpacing: '0.1em', textTransform: 'uppercase' }}>
              {DOMAINS.find(d => d.id === activeDomain)?.shortLabel}
            </div>
            <nav style={{ flex: 1, overflowY: 'auto', overflowX: 'hidden', padding: '0 0 12px' }}>
              {DOMAINS.find(d => d.id === activeDomain)?.groups.map((group, gi) => {
                const visibleItems = group.items.filter(item => isVisible(item, role, canAccessNavItem));
                if (!visibleItems.length) return null;
                return (
                  <div key={gi}>
                    <div style={{ padding: '8px 14px 4px', fontSize: 9.5, fontWeight: 700, color: 'rgba(255,255,255,0.35)', letterSpacing: '0.09em', textTransform: 'uppercase' }}>{group.label}</div>
                    {visibleItems.map(item => {
                      const Icon = item.icon;
                      const active = item.href === activeHref;
                      return (
                        <Link key={item.href} href={item.href} style={{ textDecoration: 'none', display: 'block', margin: '0 8px' }} onClick={closeMobile}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '7px 8px', borderRadius: 8, borderLeft: active ? '2px solid #F47920' : '2px solid transparent', background: active ? 'linear-gradient(90deg,rgba(244,121,32,0.16),rgba(255,255,255,0.06))' : 'transparent', cursor: 'pointer' }}>
                            <Icon size={13} style={{ color: active ? '#F9A05C' : 'rgba(255,255,255,0.45)', flexShrink: 0 }} />
                            <span style={{ flex: 1, fontSize: 12.5, fontWeight: active ? 700 : 500, color: active ? '#fff' : 'rgba(255,255,255,0.78)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                              {getLabel(item, role)}
                            </span>
                            {(() => {
                              // Badge dynamique pour workflows (parapheur live) et alertes (inbox live)
                              const dynamicBadge =
                                item.href === '/workflows' ? (pendingParapheur > 0 ? String(pendingParapheur) : null) :
                                item.href === '/alertes'   ? (unreadInbox > 0 ? String(unreadInbox) : null) :
                                (item.badge && parseInt(item.badge) > 0 ? item.badge : null);
                              const bType = item.badgeType ?? 'danger';
                              return dynamicBadge ? (
                                <span style={{ ...BADGE_COLORS[bType], fontSize: 9, fontWeight: 800, padding: '1px 5px', borderRadius: 99, flexShrink: 0 }}>
                                  {parseInt(dynamicBadge) > 99 ? '99+' : dynamicBadge}
                                </span>
                              ) : null;
                            })()}
                          </div>
                        </Link>
                      );
                    })}
                  </div>
                );
              })}
            </nav>
          </div>
        </div>
      </aside>

      <style>{`
        @media (min-width: 769px) {
          .sidebar-hamburger { display: none !important; }
          .sidebar-mobile    { display: none !important; }
        }
        @media (max-width: 768px) {
          .sidebar-desktop   { display: none !important; }
        }
        nav::-webkit-scrollbar { width: 4px; }
        nav::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.14); border-radius: 99px; }
        nav::-webkit-scrollbar-thumb:hover { background: rgba(255,255,255,0.26); }
        nav::-webkit-scrollbar-track { background: transparent; }
      `}</style>
    </>
  );
}

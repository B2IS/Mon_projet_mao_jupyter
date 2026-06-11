'use client';
import { useState, useEffect, useRef, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import {
  Home, FolderKanban, Layers, GanttChart, Activity,
  ShieldAlert, MapPin, Map, Wallet, FileSignature,
  ClipboardList, Car, Users2, BookOpen, CheckSquare2,
  FileText, Bot, Settings, Building2, Clock, DoorOpen,
  Network, BarChart3, FolderOpen, PenTool, Briefcase,
  LayoutDashboard, ClipboardCheck, TrendingUp, Zap,
  PieChart, Upload, Calculator, ShieldCheck, Boxes,
  Search, ArrowRight, Clock3, Star, Command,
} from 'lucide-react';

/* ─────────────────────────────────────────────────────────────────────────
   Toutes les pages navigables avec leur icône, section et mots-clés
───────────────────────────────────────────────────────────────────────── */
const ALL_PAGES = [
  { href: '/tableau-de-bord',        icon: LayoutDashboard,  label: 'Tableau de bord',                section: 'Accueil',               keywords: 'cockpit kpi dashboard accueil' },
  { href: '/portefeuille',           icon: FolderKanban,     label: 'Vue Portefeuille',               section: 'Portefeuille & Projets', keywords: 'portfolio projets consolidé' },
  { href: '/programmes',             icon: Layers,           label: 'Programmes',                     section: 'Portefeuille & Projets', keywords: 'programme multi-projets' },
  { href: '/projets',                icon: Briefcase,        label: 'Projets',                        section: 'Portefeuille & Projets', keywords: 'projets liste' },
  { href: '/cockpit-projet',         icon: LayoutDashboard,  label: 'Cockpit Projet',                 section: 'Portefeuille & Projets', keywords: 'fiche executive cockpit' },
  { href: '/gestion-projet',         icon: GanttChart,       label: 'Gestion de Projet',              section: 'Portefeuille & Projets', keywords: 'gestion planning phases' },
  { href: '/gantt',                  icon: GanttChart,       label: 'Chronogramme Gantt',             section: 'Portefeuille & Projets', keywords: 'gantt planning jalons planning' },
  { href: '/wbs',                    icon: Network,          label: 'Structure WBS',                  section: 'Portefeuille & Projets', keywords: 'wbs structure livrable' },
  { href: '/structuration',          icon: Boxes,            label: 'Structuration des actifs (IA)',  section: 'Portefeuille & Projets', keywords: 'ia actifs composant article' },
  { href: '/taches',                 icon: CheckSquare2,     label: 'Tâches & Activités',             section: 'Portefeuille & Projets', keywords: 'taches activites equipe' },
  { href: '/terrain',                icon: MapPin,           label: 'Avancement Terrain',             section: 'Exécution & Contrôle',  keywords: 'terrain chantier avancement physique' },
  { href: '/risques',                icon: ShieldAlert,      label: 'Risques & QHSE',                 section: 'Exécution & Contrôle',  keywords: 'risques qhse securite incidents' },
  { href: '/cartographie',           icon: Map,              label: 'Cartographie SIG',               section: 'Exécution & Contrôle',  keywords: 'carte sig gis géographique' },
  { href: '/budget',                 icon: Wallet,           label: 'Budget & Décaissements',         section: 'Finances',              keywords: 'budget decaissement financement' },
  { href: '/marches',                icon: FileSignature,    label: 'Contrats & Marchés',             section: 'Finances',              keywords: 'marche contrat appel offres' },
  { href: '/bordereaux',             icon: BookOpen,         label: 'Bordereaux / BOQ',               section: 'Finances',              keywords: 'bordereau boq decompte' },
  { href: '/receptions',             icon: ClipboardCheck,   label: 'Réceptions & Paiements',         section: 'Finances',              keywords: 'reception paiement livraison' },
  { href: '/evm',                    icon: TrendingUp,       label: 'Valeur Acquise EVM',             section: 'Finances',              keywords: 'evm valeur acquise cpi spi' },
  { href: '/fournisseurs',           icon: Building2,        label: 'Fournisseurs & Dettes',          section: 'Finances',              keywords: 'fournisseur dette interets moratoires' },
  { href: '/immobilisations',        icon: Building2,        label: 'Immobilisations & Amortissements', section: 'Actifs',             keywords: 'immobilisation patrimoine amortissement actif' },
  { href: '/odm',                    icon: ClipboardList,    label: 'Ordres de Mission',              section: 'Logistique',            keywords: 'odm ordre mission deplacement' },
  { href: '/flotte',                 icon: Car,              label: 'Flotte & Chauffeurs',            section: 'Logistique',            keywords: 'flotte vehicule chauffeur' },
  { href: '/rh',                     icon: Users2,           label: 'Ressources Humaines',            section: 'Logistique',            keywords: 'rh ressources humaines personnel' },
  { href: '/reservation-salle',      icon: DoorOpen,         label: 'Réservation de salle',           section: 'Logistique',            keywords: 'salle reunion reservation' },
  { href: '/pointage',               icon: Clock,            label: 'Pointage heures sup.',           section: 'Logistique',            keywords: 'pointage heures supplementaires uagl' },
  { href: '/workflows',              icon: CheckSquare2,     label: 'Parapheur / Validations',        section: 'Suivi & Reporting',     keywords: 'workflow validation parapheur circuit' },
  { href: '/suivi-evaluation',       icon: Activity,         label: 'KPI & Suivi-Évaluation',         section: 'Suivi & Reporting',     keywords: 'kpi suivi evaluation performance' },
  { href: '/ged',                    icon: FolderOpen,       label: 'GED & Documents',                section: 'Suivi & Reporting',     keywords: 'ged document gestion electronique' },
  { href: '/analytique',             icon: PieChart,         label: 'Analytique & BI',                section: 'Suivi & Reporting',     keywords: 'analytique bi tableau bord strategique' },
  { href: '/constructeur-indicateurs', icon: Calculator,     label: 'Constructeur d\'Indicateurs',    section: 'Suivi & Reporting',     keywords: 'indicateur constructeur formule kpi' },
  { href: '/studio-rapports',        icon: PenTool,          label: 'Studio de Rapports',             section: 'Suivi & Reporting',     keywords: 'rapport studio pdf export' },
  { href: '/reporting',              icon: FileText,         label: 'Reporting & Exports',            section: 'Suivi & Reporting',     keywords: 'reporting export bailleur' },
  { href: '/courriers',              icon: FileText,         label: 'Courriers & Parapheur',          section: 'Suivi & Reporting',     keywords: 'courrier parapheur correspondance' },
  { href: '/agents-ia',              icon: Bot,              label: 'Centre IA',                      section: 'Suivi & Reporting',     keywords: 'ia intelligence artificielle agents copilot' },
  { href: '/administration',         icon: Settings,         label: 'Utilisateurs & Rôles',           section: 'Paramétrage',           keywords: 'admin utilisateur role permission' },
  { href: '/dashboard-builder',      icon: LayoutDashboard,  label: 'Vue personnalisée',              section: 'Paramétrage',           keywords: 'dashboard builder personnalise' },
  { href: '/administration/org-config', icon: Building2,     label: 'Organigramme & Config',          section: 'Paramétrage',           keywords: 'organigramme configuration organisation' },
];

const RECENT_KEY = 'sigepp_cmd_recent';
const MAX_RECENT = 5;

function loadRecent(): string[] {
  try { return JSON.parse(localStorage.getItem(RECENT_KEY) || '[]'); } catch { return []; }
}
function saveRecent(href: string) {
  const prev = loadRecent().filter(h => h !== href);
  localStorage.setItem(RECENT_KEY, JSON.stringify([href, ...prev].slice(0, MAX_RECENT)));
}

function getPageByHref(href: string) {
  return ALL_PAGES.find(p => p.href === href);
}

function search(q: string) {
  if (!q.trim()) return [];
  const qLow = q.toLowerCase();
  return ALL_PAGES
    .filter(p =>
      p.label.toLowerCase().includes(qLow) ||
      p.section.toLowerCase().includes(qLow) ||
      p.keywords.includes(qLow)
    )
    .slice(0, 8);
}

/* ─────────────────────────────────────────────────────────────────────────
   Component
───────────────────────────────────────────────────────────────────────── */
export default function CommandPalette() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [cursor, setCursor] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  const results = query ? search(query) : [];
  const recentHrefs = loadRecent();
  const recentPages = recentHrefs.map(getPageByHref).filter(Boolean) as typeof ALL_PAGES;
  const items = query ? results : recentPages;
  const showEmpty = query.length > 0 && results.length === 0;

  const close = useCallback(() => { setOpen(false); setQuery(''); setCursor(0); }, []);

  const navigate = useCallback((href: string) => {
    saveRecent(href);
    router.push(href);
    close();
  }, [router, close]);

  /* Keyboard shortcut: Cmd+K / Ctrl+K */
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        setOpen(v => !v);
      }
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, []);

  /* Escape to close */
  useEffect(() => {
    if (!open) return;
    const onEsc = (e: KeyboardEvent) => { if (e.key === 'Escape') close(); };
    document.addEventListener('keydown', onEsc);
    return () => document.removeEventListener('keydown', onEsc);
  }, [open, close]);

  /* Arrow keys + Enter in list */
  useEffect(() => {
    if (!open || items.length === 0) return;
    const onNav = (e: KeyboardEvent) => {
      if (e.key === 'ArrowDown') { e.preventDefault(); setCursor(c => Math.min(c + 1, items.length - 1)); }
      if (e.key === 'ArrowUp')   { e.preventDefault(); setCursor(c => Math.max(c - 1, 0)); }
      if (e.key === 'Enter')     { e.preventDefault(); navigate(items[cursor]?.href ?? ''); }
    };
    document.addEventListener('keydown', onNav);
    return () => document.removeEventListener('keydown', onNav);
  }, [open, items, cursor, navigate]);

  /* Scroll selected item into view */
  useEffect(() => {
    const el = listRef.current?.children[cursor] as HTMLElement | undefined;
    el?.scrollIntoView({ block: 'nearest' });
  }, [cursor]);

  /* Focus input on open */
  useEffect(() => {
    if (open) { setCursor(0); setTimeout(() => inputRef.current?.focus(), 30); }
  }, [open]);

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        title="Recherche rapide (⌘K)"
        aria-label="Ouvrir la palette de commandes"
        style={{
          display: 'flex', alignItems: 'center', gap: 6,
          padding: '5px 11px',
          background: 'rgba(255,255,255,0.10)',
          border: '1px solid rgba(255,255,255,0.18)',
          borderRadius: 7, color: 'rgba(255,255,255,0.70)',
          fontSize: 12, cursor: 'pointer', fontFamily: 'inherit',
          transition: 'background 0.15s',
          width: 200, flexShrink: 0,
        }}
        onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.background = 'rgba(255,255,255,0.16)'; }}
        onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.background = 'rgba(255,255,255,0.10)'; }}
        className="hide-tablet"
      >
        <Search size={12} style={{ flexShrink: 0 }} />
        <span style={{ flex: 1, textAlign: 'left' }}>Rechercher...</span>
        <kbd style={{
          display: 'inline-flex', alignItems: 'center', gap: 2,
          padding: '1px 5px', borderRadius: 4,
          background: 'rgba(255,255,255,0.12)',
          border: '1px solid rgba(255,255,255,0.20)',
          fontSize: 9, fontWeight: 700, color: 'rgba(255,255,255,0.55)',
          fontFamily: 'inherit', letterSpacing: '0.02em',
        }}>
          <Command size={8} /> K
        </kbd>
      </button>
    );
  }

  return (
    <>
      {/* Overlay */}
      <div
        onClick={close}
        style={{
          position: 'fixed', inset: 0,
          background: 'rgba(15,23,42,0.55)',
          backdropFilter: 'blur(4px)',
          zIndex: 2000,
          animation: 'cmdFadeIn 0.12s ease',
        }}
      />

      {/* Panel */}
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Palette de commandes"
        style={{
          position: 'fixed',
          top: '16vh',
          left: '50%',
          transform: 'translateX(-50%)',
          width: 560,
          maxWidth: 'calc(100vw - 32px)',
          background: '#fff',
          borderRadius: 14,
          boxShadow: '0 24px 64px rgba(0,0,0,0.22), 0 4px 16px rgba(0,0,0,0.10)',
          border: '1px solid #E5E7EB',
          zIndex: 2001,
          overflow: 'hidden',
          animation: 'cmdSlideIn 0.15s cubic-bezier(0.16,1,0.3,1)',
        }}
      >
        {/* Search input */}
        <div style={{
          display: 'flex', alignItems: 'center', gap: 10,
          padding: '14px 16px',
          borderBottom: query.length > 0 || recentPages.length > 0 ? '1px solid #F3F4F6' : 'none',
        }}>
          <Search size={16} style={{ color: '#9CA3AF', flexShrink: 0 }} />
          <input
            ref={inputRef}
            value={query}
            onChange={e => { setQuery(e.target.value); setCursor(0); }}
            placeholder="Rechercher une page, module, action…"
            style={{
              flex: 1, border: 'none', outline: 'none',
              fontSize: 15, color: '#111827',
              fontFamily: 'inherit', background: 'transparent',
            }}
          />
          {query && (
            <button
              onClick={() => setQuery('')}
              style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#9CA3AF', padding: 2, display: 'flex', alignItems: 'center' }}
            >
              ✕
            </button>
          )}
          <kbd style={{
            display: 'inline-flex', alignItems: 'center',
            padding: '3px 7px', borderRadius: 6,
            background: '#F3F4F6', border: '1px solid #E5E7EB',
            fontSize: 10, fontWeight: 700, color: '#6B7280',
            fontFamily: 'inherit', flexShrink: 0,
          }}>ESC</kbd>
        </div>

        {/* Results */}
        <div
          ref={listRef}
          style={{ maxHeight: 400, overflowY: 'auto', padding: '6px 0' }}
          role="listbox"
        >
          {/* Section header */}
          {!query && recentPages.length > 0 && (
            <div style={{ padding: '4px 16px 2px', fontSize: 10, fontWeight: 700, color: '#9CA3AF', letterSpacing: '0.06em', textTransform: 'uppercase', display: 'flex', alignItems: 'center', gap: 5 }}>
              <Clock3 size={10} /> Récents
            </div>
          )}
          {query && results.length > 0 && (
            <div style={{ padding: '4px 16px 2px', fontSize: 10, fontWeight: 700, color: '#9CA3AF', letterSpacing: '0.06em', textTransform: 'uppercase', display: 'flex', alignItems: 'center', gap: 5 }}>
              <Search size={10} /> Résultats
            </div>
          )}

          {/* Items */}
          {items.map((page, i) => {
            const Icon = page.icon;
            const isActive = i === cursor;
            return (
              <div
                key={page.href}
                role="option"
                aria-selected={isActive}
                onClick={() => navigate(page.href)}
                onMouseEnter={() => setCursor(i)}
                style={{
                  display: 'flex', alignItems: 'center', gap: 11,
                  padding: '9px 16px',
                  cursor: 'pointer',
                  background: isActive ? '#F3EBF9' : 'transparent',
                  transition: 'background 0.08s',
                  borderLeft: isActive ? '3px solid #F47920' : '3px solid transparent',
                }}
              >
                <div style={{
                  width: 32, height: 32, borderRadius: 8, flexShrink: 0,
                  background: isActive ? '#EDE7F6' : '#F3F4F6',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}>
                  <Icon size={15} style={{ color: isActive ? '#3D1A6B' : '#6B7280' }} />
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 13.5, fontWeight: isActive ? 700 : 500, color: isActive ? '#3D1A6B' : '#111827' }}>
                    {page.label}
                  </div>
                  <div style={{ fontSize: 11, color: '#9CA3AF', marginTop: 1 }}>
                    {page.section}
                  </div>
                </div>
                <ArrowRight size={13} style={{ color: isActive ? '#F47920' : '#D1D5DB', flexShrink: 0 }} />
              </div>
            );
          })}

          {/* Empty state */}
          {showEmpty && (
            <div style={{ padding: '32px 16px', textAlign: 'center', color: '#9CA3AF' }}>
              <Search size={28} style={{ margin: '0 auto 10px', display: 'block', color: '#D1D5DB' }} />
              <div style={{ fontSize: 13, fontWeight: 600, color: '#6B7280' }}>Aucune page trouvée</div>
              <div style={{ fontSize: 11, marginTop: 4 }}>pour « {query} »</div>
            </div>
          )}

          {/* Initial empty (no recent) */}
          {!query && recentPages.length === 0 && (
            <div style={{ padding: '32px 16px', textAlign: 'center', color: '#9CA3AF' }}>
              <Command size={28} style={{ margin: '0 auto 10px', display: 'block', color: '#D1D5DB' }} />
              <div style={{ fontSize: 13, fontWeight: 600, color: '#6B7280' }}>Tapez pour rechercher</div>
              <div style={{ fontSize: 11, marginTop: 4 }}>Naviguez dans toutes les pages de SIGEPP-DPE</div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div style={{
          padding: '8px 16px',
          borderTop: '1px solid #F3F4F6',
          display: 'flex', alignItems: 'center', gap: 14,
          background: '#FAFAFA',
          fontSize: 10, color: '#9CA3AF',
        }}>
          <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
            <kbd style={{ background: '#fff', border: '1px solid #E5E7EB', borderRadius: 3, padding: '1px 5px', fontFamily: 'inherit' }}>↑↓</kbd>
            Naviguer
          </span>
          <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
            <kbd style={{ background: '#fff', border: '1px solid #E5E7EB', borderRadius: 3, padding: '1px 5px', fontFamily: 'inherit' }}>↵</kbd>
            Ouvrir
          </span>
          <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
            <kbd style={{ background: '#fff', border: '1px solid #E5E7EB', borderRadius: 3, padding: '1px 5px', fontFamily: 'inherit' }}>ESC</kbd>
            Fermer
          </span>
          <span style={{ marginLeft: 'auto', fontWeight: 600 }}>{ALL_PAGES.length} pages disponibles</span>
        </div>
      </div>

      <style>{`
        @keyframes cmdFadeIn   { from { opacity: 0; } to { opacity: 1; } }
        @keyframes cmdSlideIn  { from { opacity: 0; transform: translateX(-50%) translateY(-10px) scale(0.97); }
                                  to   { opacity: 1; transform: translateX(-50%) translateY(0)    scale(1);    } }
      `}</style>
    </>
  );
}

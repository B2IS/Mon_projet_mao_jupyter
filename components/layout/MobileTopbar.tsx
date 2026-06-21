'use client';
/**
 * MobileTopbar — Barre de navigation mobile (375–768 px).
 * Visible uniquement sur mobile via CSS (.mobile-topbar). Remplace le
 * hamburger flottant fixed pour éviter tout chevauchement avec le contenu.
 */
import { usePathname } from 'next/navigation';
import { Menu } from 'lucide-react';
import { useSidebar } from '@/lib/sidebarContext';
import { useAuth } from '@/lib/authStore';
import SenelecLogo from '@/components/ui/SenelecLogo';

const PAGE_TITLES: Record<string, string> = {
  /* COCKPIT */
  '/tableau-de-bord':          'Tableau de bord',
  '/springboard':              'Portail de Pilotage',
  '/alertes':                  'Alertes',
  /* M1 — PORTFOLIO */
  '/portefeuille':             'Portefeuille',
  '/programmes':               'Programmes',
  '/cockpit-projet':           'Cockpit Projet',
  /* M2 — PROJETS */
  '/projets':                  'Projets',
  '/gestion-projet':           'Gestion de Projet',
  /* M3-M4 — ÉTUDES / CONCEPTION */
  '/canevas':                  'Canevas & Plans',
  /* M5 — PLANIFICATION */
  '/wbs':                      'Structure WBS',
  '/gantt':                    'Chronogramme Gantt',
  '/risques':                  'Risques & QHSE',
  /* M6 — EXÉCUTION */
  '/taches':                   'Tâches',
  '/terrain':                  'Avancement Terrain',
  /* M9 — BUDGETS */
  '/budget':                   'Budget',
  '/evm':                      'Valeur Acquise (EVM)',
  /* M10 — MARCHÉS */
  '/fournisseurs':             'Fournisseurs',
  '/marches':                  'Marchés & Contrats',
  '/bordereaux':               'Bordereaux',
  '/receptions':               'Réceptions',
  /* M11 — IMMOBILISATIONS */
  '/immobilisations':          'Immobilisations',
  '/structuration':            'Structuration Swarm IA',
  /* M12 — GED */
  '/ged':                      'Documents',
  '/courriers':                'Courriers',
  '/workflows':                'Parapheur & Validations',
  /* M14 — REPORTING */
  '/reporting':                'Reporting',
  '/studio-rapports':          'Studio Rapports',
  /* M15 — KPI */
  '/suivi-evaluation':         'Suivi-Évaluation',
  '/analytique':               'Analytique',
  '/constructeur-indicateurs': 'Constructeur KPI',
  '/dashboard-builder':        'Dashboard Builder',
  /* M16-M17 — IA */
  '/agents-ia':                'Centre IA',
  '/migration':                'Swarm IA — Migration',
  /* LOGISTIQUE */
  '/flotte':                   'Flotte',
  '/odm':                      'Ordres de Mission',
  '/reservation-salle':        'Réservation Salles',
  /* RH */
  '/rh':                       'Ressources Humaines',
  '/gestion-temps':            'Gestion des Temps',
  '/suivi-temps':              'Suivi des Temps',
  '/pointage':                 'Pointage',
  /* SYSTÈME */
  '/administration':           'Administration',
  '/parametrage':              'Paramétrage',
  '/cartographie':             'Cartographie SIG',
  '/docs':                     'Documentation',
  '/erp-interface':            'Interface ERP',
};

export default function MobileTopbar() {
  const { openMobile } = useSidebar();
  const { user } = useAuth();
  const path = usePathname();

  const title = PAGE_TITLES[path] ?? 'SIGEP-DPE';

  return (
    <div className="mobile-topbar" style={{
      height: 52,
      background: 'linear-gradient(90deg, #2D1167 0%, #3D1A6B 100%)',
      display: 'flex', alignItems: 'center',
      gap: 10, padding: '0 14px',
      flexShrink: 0,
      boxShadow: '0 2px 8px rgba(45,17,103,0.30)',
    }}>
      {/* Hamburger */}
      <button
        onClick={openMobile}
        aria-label="Ouvrir le menu de navigation"
        style={{
          width: 36, height: 36, borderRadius: 8, flexShrink: 0,
          background: 'rgba(255,255,255,0.12)',
          border: '1px solid rgba(255,255,255,0.20)',
          color: '#fff', cursor: 'pointer',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}
      >
        <Menu size={18} />
      </button>

      {/* Logo + titre */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 7, flex: 1, minWidth: 0 }}>
        <div style={{ width: 26, height: 26, borderRadius: 7, background: 'rgba(255,255,255,0.10)', display: 'grid', placeItems: 'center', flexShrink: 0 }}>
          <SenelecLogo size={16} />
        </div>
        <span style={{ fontSize: 13, fontWeight: 700, color: '#fff', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {title}
        </span>
      </div>

      {/* Avatar */}
      {user && (
        <div style={{
          width: 30, height: 30, borderRadius: 8, flexShrink: 0,
          background: user.avatarColor ?? '#F47920',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: 10, fontWeight: 800, color: '#fff',
        }}>
          {user.initials}
        </div>
      )}
    </div>
  );
}

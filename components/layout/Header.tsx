'use client';
import { usePathname, useRouter } from 'next/navigation';
import { useState, useEffect, useRef, useMemo } from 'react';
import { Bell, Search, Calendar, ChevronDown, X, AlertTriangle, Clock, CheckCircle, Info, Stamp, LogOut, User, Settings, ArrowLeft, Mail, CheckCheck, Trash2 } from 'lucide-react';
import { ALERTES_WORKFLOW } from '@/lib/data';
import { useAuth, ROLES } from '@/lib/authStore';
import { useNotificationStore, selectInboxFor } from '@/lib/notificationStore';
import { useTranslation } from '@/lib/i18n/I18nContext';
import type { TranslationKey } from '@/lib/i18n/translations';

const TITLES: Record<string, { labelKey: TranslationKey; subKey: TranslationKey }> = {
  '/tableau-de-bord':   { labelKey: 'route.tableauDeBord.label',   subKey: 'route.tableauDeBord.sub' },
  '/portefeuille':      { labelKey: 'route.portefeuille.label',      subKey: 'route.portefeuille.sub' },
  '/programmes':        { labelKey: 'route.programmes.label',        subKey: 'route.programmes.sub' },
  '/projets':           { labelKey: 'route.projets.label',           subKey: 'route.projets.sub' },
  '/cockpit-projet':    { labelKey: 'route.cockpitProjet.label',     subKey: 'route.cockpitProjet.sub' },
  '/terrain':           { labelKey: 'route.terrain.label',           subKey: 'route.terrain.sub' },
  '/taches':            { labelKey: 'route.taches.label',            subKey: 'route.taches.sub' },
  '/budget':            { labelKey: 'route.budget.label',            subKey: 'route.budget.sub' },
  '/courriers':         { labelKey: 'route.courriers.label',         subKey: 'route.courriers.sub' },
  '/analytique':        { labelKey: 'route.analytique.label',        subKey: 'route.analytique.sub' },
  '/cartographie':      { labelKey: 'route.cartographie.label',      subKey: 'route.cartographie.sub' },
  '/workflows':         { labelKey: 'route.workflows.label',         subKey: 'route.workflows.sub' },
  '/administration':    { labelKey: 'route.administration.label',    subKey: 'route.administration.sub' },
  '/suivi-evaluation':  { labelKey: 'route.suiviEvaluation.label',   subKey: 'route.suiviEvaluation.sub' },
  '/odm':               { labelKey: 'route.odm.label',               subKey: 'route.odm.sub' },
  '/flotte':            { labelKey: 'route.flotte.label',            subKey: 'route.flotte.sub' },
  '/receptions':        { labelKey: 'route.receptions.label',        subKey: 'route.receptions.sub' },
  '/marches':           { labelKey: 'route.marches.label',           subKey: 'route.marches.sub' },
  '/gantt':             { labelKey: 'route.gantt.label',             subKey: 'route.gantt.sub' },
  '/studio-rapports':   { labelKey: 'route.studioRapports.label',    subKey: 'route.studioRapports.sub' },
  '/reporting':         { labelKey: 'route.reporting.label',         subKey: 'route.reporting.sub' },
  '/rh':                { labelKey: 'route.rh.label',                subKey: 'route.rh.sub' },
  '/wbs':               { labelKey: 'route.wbs.label',               subKey: 'route.wbs.sub' },
  '/evm':               { labelKey: 'route.evm.label',               subKey: 'route.evm.sub' },
  '/risques':           { labelKey: 'route.risques.label',           subKey: 'route.risques.sub' },
  '/ged':               { labelKey: 'route.ged.label',               subKey: 'route.ged.sub' },
  '/agents-ia':         { labelKey: 'route.agentsIa.label',          subKey: 'route.agentsIa.sub' },
  '/dashboard-builder': { labelKey: 'route.dashboardBuilder.label',  subKey: 'route.dashboardBuilder.sub' },
};

/* Tenant selector */
const TENANT_LABEL = 'DER — Direction Équipement Réseaux';

const PRIORITE_COLOR: Record<string, string> = {
  critique: '#EF3340',
  haute: '#F47920',
  moyenne: '#F59E0B',
  basse: '#16A34A',
};

const TYPE_ICON: Record<string, React.ElementType> = {
  retard: Clock,
  incident_grave: AlertTriangle,
  echeance_courrier: Info,
  budget: AlertTriangle,
};

export default function Header() {
  const path = usePathname();
  const router = useRouter();
  const { user, logout } = useAuth();
  const { lang, t } = useTranslation();
  const info = TITLES[path] || { labelKey: 'app.title' as TranslationKey, subKey: 'app.subtitle' as TranslationKey };
  const [showNotifs, setShowNotifs] = useState(false);
  const [today, setToday] = useState('');
  const [showUserMenu, setShowUserMenu] = useState(false);
  const bellRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const avatarRef = useRef<HTMLDivElement>(null);
  const userMenuRef = useRef<HTMLDivElement>(null);

  const roleInfo = user ? ROLES[user.role] : null;
  const tenantLabel = user ? user.direction : 'DER — Direction Équipement Réseaux';
  const initials = user ? user.initials : 'MS';
  const avatarColor = user ? user.avatarColor : '#F39200';

  /* Alertes système traitées — PERSISTÉES (ne réapparaissent plus à la navigation). */
  const dismissedAlertes = useNotificationStore(s => s.dismissedAlertes);
  const dismissAlerte = useNotificationStore(s => s.dismissAlerte);
  const dismissAlertes = useNotificationStore(s => s.dismissAlertes);
  const dismissed = useMemo(() => new Set(dismissedAlertes), [dismissedAlertes]);
  const activeAlertes = ALERTES_WORKFLOW.filter(a => a.statut === 'nouvelle' && !dismissed.has(a.id));

  /* Boîte de réception personnelle (notifications workflow & projet) */
  const inbox = useNotificationStore(s => s.inbox);
  const markInboxRead = useNotificationStore(s => s.markInboxRead);
  const markAllInboxRead = useNotificationStore(s => s.markAllInboxRead);
  const removeInbox = useNotificationStore(s => s.removeInbox);
  const myInbox = selectInboxFor(inbox, user?.email);
  const unreadInbox = myInbox.filter(n => !n.read).length;
  const newAlertes = activeAlertes.length + unreadInbox;

  const openInboxItem = (n: { id: string; link?: string }) => {
    markInboxRead(n.id);
    if (n.link) router.push(n.link);
    setShowNotifs(false);
  };

  const INBOX_ICON: Record<string, React.ElementType> = {
    success: CheckCircle, error: AlertTriangle, warning: AlertTriangle, info: Info,
  };
  const INBOX_COLOR: Record<string, string> = {
    success: '#16A34A', error: '#E2231A', warning: '#F47920', info: '#1B4F8A',
  };
  const relTime = (iso: string) => {
    const diff = Date.now() - new Date(iso).getTime();
    const m = Math.floor(diff / 60000);
    if (m < 1) return "à l'instant";
    if (m < 60) return `il y a ${m} min`;
    const h = Math.floor(m / 60);
    if (h < 24) return `il y a ${h} h`;
    const j = Math.floor(h / 24);
    return `il y a ${j} j`;
  };

  useEffect(() => {
    setToday(new Date().toLocaleDateString(lang === 'en' ? 'en-US' : 'fr-FR', {
      weekday: 'long', day: '2-digit', month: 'long', year: 'numeric'
    }));
  }, [lang]);

  /* Close panels on outside click */
  useEffect(() => {
    if (!showNotifs) return;
    const handler = (e: MouseEvent) => {
      if (
        bellRef.current && !bellRef.current.contains(e.target as Node) &&
        panelRef.current && !panelRef.current.contains(e.target as Node)
      ) setShowNotifs(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [showNotifs]);

  useEffect(() => {
    if (!showUserMenu) return;
    const handler = (e: MouseEvent) => {
      if (
        avatarRef.current && !avatarRef.current.contains(e.target as Node) &&
        userMenuRef.current && !userMenuRef.current.contains(e.target as Node)
      ) setShowUserMenu(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [showUserMenu]);

  return (
    <header style={{
      height: 'var(--header-h)',
      background: '#0E3460',
      display: 'flex', alignItems: 'center',
      gap: 10, padding: '0 20px',
      flexShrink: 0,
      boxShadow: '0 2px 8px rgba(14,52,96,0.25)',
      position: 'relative', zIndex: 10,
    }}>
      {/* Mobile spacer for hamburger */}
      <div style={{ width: 0 }} className="header-mobile-spacer" />

      {/* Bouton Retour — navigation entre pages */}
      {path !== '/tableau-de-bord' && (
        <button
          onClick={() => router.back()}
          title="Retour"
          aria-label="Retour"
          style={{
            display: 'flex', alignItems: 'center', gap: 5,
            background: 'rgba(255,255,255,0.12)',
            border: '1px solid rgba(255,255,255,0.20)',
            borderRadius: 7, padding: '5px 10px',
            color: '#fff', fontSize: 11.5, fontWeight: 700,
            cursor: 'pointer', fontFamily: 'inherit', flexShrink: 0,
          }}
        >
          <ArrowLeft size={14} />
          <span className="hide-mobile">Retour</span>
        </button>
      )}

      {/* Tenant selector */}
      <button style={{
        display: 'flex', alignItems: 'center', gap: 6,
        background: 'rgba(255,255,255,0.12)',
        border: '1px solid rgba(255,255,255,0.20)',
        borderRadius: 7, padding: '5px 10px',
        color: '#fff', fontSize: 11.5, fontWeight: 700,
        cursor: 'pointer', fontFamily: 'inherit',
        whiteSpace: 'nowrap',
        flexShrink: 0,
      }}>
        <span style={{ width: 7, height: 7, borderRadius: '50%', background: '#F39200', flexShrink: 0 }} />
        <span className="hide-mobile">{tenantLabel}</span>
        <ChevronDown size={11} style={{ opacity: 0.7 }} />
      </button>

      {/* Séparateur */}
      <div style={{ width: 1, height: 22, background: 'rgba(255,255,255,0.15)', flexShrink: 0 }} className="hide-mobile" />

      {/* Title */}
      <div style={{ flex: 1, minWidth: 0 }} className="hide-mobile">
        <div style={{ fontWeight: 700, fontSize: 13.5, color: '#fff', lineHeight: 1.2,
          overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {t(info.labelKey)}
        </div>
        {t(info.subKey) && (
          <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.55)', marginTop: 1 }}>{t(info.subKey)}</div>
        )}
      </div>

      {/* Spacer */}
      <div style={{ flex: 1 }} />

      {/* Search */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: 7,
        padding: '5px 11px',
        background: 'rgba(255,255,255,0.10)',
        border: '1px solid rgba(255,255,255,0.18)',
        borderRadius: 7, width: 200,
      }}
        className="hide-mobile"
      >
        <Search size={12} style={{ color: 'rgba(255,255,255,0.60)', flexShrink: 0 }} />
        <input
          placeholder="Rechercher..."
          style={{ background: 'transparent', border: 'none', outline: 'none',
            color: '#fff', fontSize: 12, flex: 1, fontFamily: 'inherit' }}
        />
      </div>

      {/* Date */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: 5,
        fontSize: 11, color: 'rgba(255,255,255,0.60)', whiteSpace: 'nowrap',
      }}
        className="hide-mobile"
      >
        <Calendar size={11} />
        <span style={{ textTransform: 'capitalize' }}>{today}</span>
      </div>

      {/* Parapheur / Centre de validation */}
      <button
        onClick={() => router.push('/workflows')}
        title="Centre de Validation — 8 documents en attente"
        style={{
          position: 'relative',
          background: 'rgba(255,255,255,0.10)',
          border: '1px solid rgba(255,255,255,0.20)',
          borderRadius: 7,
          width: 34, height: 34,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          color: '#fff', cursor: 'pointer', flexShrink: 0,
        }}
      >
        <Stamp size={15} />
        <span style={{
          position: 'absolute', top: -5, right: -5,
          minWidth: 17, height: 17, borderRadius: 9,
          background: '#F47920',
          fontSize: 9, fontWeight: 800, color: '#fff',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          border: '2px solid #0E3460',
          padding: '0 3px',
        }}>8</span>
      </button>

      {/* Notifications */}
      <div style={{ position: 'relative', flexShrink: 0 }}>
        <button
          ref={bellRef}
          onClick={() => setShowNotifs(v => !v)}
          style={{
            position: 'relative',
            background: showNotifs ? 'rgba(255,255,255,0.22)' : 'rgba(255,255,255,0.10)',
            border: '1px solid rgba(255,255,255,0.20)',
            borderRadius: 7,
            width: 34, height: 34,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            color: '#fff', cursor: 'pointer',
          }}
        >
          <Bell size={15} />
          {newAlertes > 0 && (
            <span style={{
              position: 'absolute', top: -5, right: -5,
              width: 17, height: 17, borderRadius: '50%',
              background: '#E2231A',
              fontSize: 9, fontWeight: 800, color: '#fff',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              border: '2px solid #0E3460',
            }}>
              {newAlertes}
            </span>
          )}
        </button>

        {/* Notification panel */}
        {showNotifs && (
          <div
            ref={panelRef}
            style={{
              position: 'absolute', top: 42, right: 0,
              width: 380, maxHeight: 480, overflowY: 'auto',
              background: '#FFF', borderRadius: 10,
              boxShadow: '0 8px 32px rgba(0,0,0,0.18)',
              border: '1px solid #E5E7EB',
              zIndex: 200,
            }}
          >
            {/* Panel header */}
            <div style={{
              padding: '12px 16px', display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              borderBottom: '1px solid #F3F4F6', background: '#FAFAFA', borderRadius: '10px 10px 0 0',
            }}>
              <div>
                <div style={{ fontSize: 13, fontWeight: 700, color: '#111827' }}>Alertes & Notifications</div>
                <div style={{ fontSize: 10, color: '#9CA3AF', marginTop: 1 }}>{newAlertes} non traitée{newAlertes > 1 ? 's' : ''}</div>
              </div>
              {myInbox.length > 0 && (
                <button
                  onClick={() => markAllInboxRead(user?.email)}
                  style={{ fontSize: 10, fontWeight: 600, color: '#1B4F8A', background: 'none', border: 'none', cursor: 'pointer', padding: 0, display: 'flex', alignItems: 'center', gap: 3 }}
                ><CheckCheck size={12} /> Tout lire</button>
              )}
            </div>

            {/* Boîte de réception personnelle */}
            {myInbox.length > 0 && (
              <div>
                <div style={{ padding: '8px 16px 4px', fontSize: 9.5, fontWeight: 800, color: '#94A3B8', textTransform: 'uppercase', letterSpacing: '0.05em', display: 'flex', alignItems: 'center', gap: 5 }}>
                  <Mail size={11} /> Mes notifications
                </div>
                {myInbox.slice(0, 12).map(n => {
                  const NIcon = INBOX_ICON[n.type] ?? Info;
                  const col = INBOX_COLOR[n.type] ?? '#1B4F8A';
                  return (
                    <div key={n.id}
                      onClick={() => openInboxItem(n)}
                      style={{
                        padding: '10px 16px', borderBottom: '1px solid #F3F4F6',
                        display: 'flex', gap: 10, alignItems: 'flex-start', cursor: 'pointer',
                        background: n.read ? 'transparent' : '#F0F7FF', transition: 'background 0.15s',
                      }}
                      onMouseEnter={e => (e.currentTarget.style.background = '#F9FAFB')}
                      onMouseLeave={e => (e.currentTarget.style.background = n.read ? 'transparent' : '#F0F7FF')}
                    >
                      <div style={{ width: 30, height: 30, borderRadius: 8, flexShrink: 0, background: `${col}15`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        <NIcon size={14} style={{ color: col }} />
                      </div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 2 }}>
                          {!n.read && <span style={{ width: 7, height: 7, borderRadius: '50%', background: col, flexShrink: 0 }} />}
                          <span style={{ fontSize: 11.5, fontWeight: 700, color: '#1E293B', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{n.title}</span>
                          {n.ref && <span style={{ fontSize: 9, color: '#9CA3AF', fontFamily: 'monospace', marginLeft: 'auto' }}>{n.ref}</span>}
                        </div>
                        <div style={{ fontSize: 11, color: '#475569', lineHeight: 1.4 }}>{n.message}</div>
                        <div style={{ fontSize: 9, color: '#9CA3AF', marginTop: 3 }}>{relTime(n.createdAt)}</div>
                      </div>
                      <button
                        onClick={e => { e.stopPropagation(); removeInbox(n.id); }}
                        style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#D1D5DB', padding: 2, flexShrink: 0 }}
                        title="Supprimer"
                      ><Trash2 size={12} /></button>
                    </div>
                  );
                })}
                <div style={{ padding: '6px 16px', fontSize: 9.5, fontWeight: 800, color: '#94A3B8', textTransform: 'uppercase', letterSpacing: '0.05em', borderTop: '1px solid #F3F4F6', background: '#FAFAFA' }}>
                  Alertes système
                </div>
              </div>
            )}

            {/* Alerts list */}
            <div>
              {activeAlertes.length === 0 ? (
                <div style={{ padding: '24px 16px', textAlign: 'center', color: '#9CA3AF' }}>
                  <CheckCircle size={28} style={{ margin: '0 auto 8px', display: 'block', color: '#16A34A' }} />
                  <div style={{ fontSize: 12 }}>Aucune alerte en attente</div>
                </div>
              ) : activeAlertes.map(a => {
                const NIcon = TYPE_ICON[a.type] ?? Info;
                const pColor = PRIORITE_COLOR[a.priorite] ?? '#6B7280';
                return (
                  <div key={a.id}
                    onClick={() => { router.push('/workflows'); setShowNotifs(false); }}
                    style={{
                    padding: '10px 16px', borderBottom: '1px solid #F3F4F6',
                    display: 'flex', gap: 10, alignItems: 'flex-start', cursor: 'pointer',
                    transition: 'background 0.15s',
                  }}
                    onMouseEnter={e => (e.currentTarget.style.background = '#F9FAFB')}
                    onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
                  >
                    <div style={{
                      width: 30, height: 30, borderRadius: 8, flexShrink: 0,
                      background: `${pColor}15`, display: 'flex', alignItems: 'center', justifyContent: 'center',
                    }}>
                      <NIcon size={14} style={{ color: pColor }} />
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 2 }}>
                        <span style={{
                          fontSize: 9, fontWeight: 700, padding: '1px 5px', borderRadius: 4,
                          background: `${pColor}18`, color: pColor, textTransform: 'uppercase',
                        }}>{a.priorite}</span>
                        <span style={{ fontSize: 9, color: '#9CA3AF' }}>{a.projetCode}</span>
                      </div>
                      <div style={{ fontSize: 11, color: '#374151', lineHeight: 1.4 }}>{a.message}</div>
                      <div style={{ fontSize: 9, color: '#9CA3AF', marginTop: 3 }}>{a.date}</div>
                    </div>
                    <button
                      onClick={e => { e.stopPropagation(); dismissAlerte(a.id); }}
                      style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#D1D5DB', padding: 2, flexShrink: 0 }}
                      title="Marquer comme traité"
                    ><X size={12} /></button>
                  </div>
                );
              })}
            </div>

            {/* Panel footer */}
            <div style={{
              padding: '10px 16px', borderTop: '1px solid #F3F4F6',
              display: 'flex', gap: 8, justifyContent: 'flex-end',
              background: '#FAFAFA', borderRadius: '0 0 10px 10px',
            }}>
              <button
                onClick={() => { dismissAlertes(ALERTES_WORKFLOW.map(a => a.id)); setShowNotifs(false); }}
                style={{ fontSize: 10, fontWeight: 600, padding: '5px 10px', borderRadius: 6, border: '1px solid #D1D5DB', background: '#FFF', color: '#374151', cursor: 'pointer' }}
              >Tout marquer traité</button>
              <button
                onClick={() => { router.push('/workflows'); setShowNotifs(false); }}
                style={{ fontSize: 10, fontWeight: 600, padding: '5px 10px', borderRadius: 6, border: 'none', background: '#1B4F8A', color: '#FFF', cursor: 'pointer' }}
              >Gérer les alertes</button>
            </div>
          </div>
        )}
      </div>

      {/* Sélecteur de langue retiré — application en français uniquement */}

      {/* Status */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: 5,
        fontSize: 10, fontWeight: 700,
        color: 'rgba(255,255,255,0.85)',
        background: 'rgba(255,255,255,0.08)',
        border: '1px solid rgba(255,255,255,0.16)',
        borderRadius: 5, padding: '3px 9px', flexShrink: 0,
      }}
        className="hide-mobile"
      >
        <span style={{ width: 5, height: 5, borderRadius: '50%',
          background: '#16A34A', boxShadow: '0 0 0 2px rgba(22,163,74,0.3)' }} />
        PROD
      </div>

      {/* Avatar */}
      <div style={{
        width: 32, height: 32, borderRadius: 8, flexShrink: 0,
        background: '#F39200',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontSize: 11, fontWeight: 800, color: '#fff', cursor: 'pointer',
        boxShadow: '0 2px 6px rgba(243,146,0,0.40)',
      }}>
        MS
      </div>

      <style>{`
        @media (max-width: 768px) {
          .header-mobile-spacer { width: 44px !important; }
        }
      `}</style>
    </header>
  );
}

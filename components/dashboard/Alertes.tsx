'use client';

import { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  Bell, AlertTriangle, AlertCircle, Info, Clock, Banknote, CheckCircle2,
  PackageCheck, FileWarning, MailOpen, Mail, Trash2, CheckCheck, X, Filter, Search, ExternalLink,
} from 'lucide-react';
import { useProjectStore } from '@/lib/projectStore';
import { useAuth } from '@/lib/authStore';
import { useNotificationStore, selectInboxFor } from '@/lib/notificationStore';
import { computeLiveAlertes } from '@/lib/alertEngine';
import type { WorkflowAlerte } from '@/lib/types';

/* ── Design tokens ─────────────────────────────────────── */
const C = {
  navy: '#3D1A6B', orange: '#F47920', red: '#EF3340', green: '#16A34A',
  amber: '#D97706', slate: '#64748B', border: '#E2E8F0', bg: '#F4F3F8', surface: '#fff',
};

const PRIORITE_META: Record<WorkflowAlerte['priorite'], { color: string; bg: string; label: string }> = {
  critique: { color: '#B91C1C', bg: '#FEE2E2', label: 'Critique' },
  haute:    { color: '#B45309', bg: '#FEF3C7', label: 'Haute' },
  normale:  { color: '#1D4ED8', bg: '#EFF6FF', label: 'Normale' },
};

const TYPE_META: Record<WorkflowAlerte['type'], { Icon: typeof Bell; label: string }> = {
  retard:           { Icon: Clock,       label: 'Retard' },
  budget:           { Icon: Banknote,    label: 'Budget' },
  incident_grave:   { Icon: AlertTriangle, label: 'Incident' },
  validation:       { Icon: CheckCircle2, label: 'Validation' },
  reception:        { Icon: PackageCheck, label: 'Réception' },
  echeance_courrier:{ Icon: FileWarning, label: 'Échéance' },
};

const NOTIF_ICON: Record<string, { color: string; Icon: typeof Bell }> = {
  success: { color: C.green,  Icon: CheckCircle2 },
  error:   { color: C.red,    Icon: AlertCircle },
  warning: { color: C.amber,  Icon: AlertTriangle },
  info:    { color: '#1D4ED8', Icon: Info },
};

function relTime(iso: string): string {
  const d = new Date(iso); const diff = Date.now() - d.getTime();
  const min = Math.floor(diff / 60000);
  if (min < 1) return "à l'instant";
  if (min < 60) return `il y a ${min} min`;
  const h = Math.floor(min / 60);
  if (h < 24) return `il y a ${h} h`;
  const j = Math.floor(h / 24);
  if (j < 30) return `il y a ${j} j`;
  return d.toLocaleDateString('fr-FR');
}

export default function Alertes() {
  const router = useRouter();
  const { user } = useAuth();
  const projets = useProjectStore().projets;

  const dismissedAlertes = useNotificationStore(s => s.dismissedAlertes);
  const dismissAlerte = useNotificationStore(s => s.dismissAlerte);
  const dismissAlertes = useNotificationStore(s => s.dismissAlertes);
  const inbox = useNotificationStore(s => s.inbox);
  const markInboxRead = useNotificationStore(s => s.markInboxRead);
  const markAllInboxRead = useNotificationStore(s => s.markAllInboxRead);
  const removeInbox = useNotificationStore(s => s.removeInbox);

  const dismissed = useMemo(() => new Set(dismissedAlertes), [dismissedAlertes]);
  const liveAlertes = useMemo(() => computeLiveAlertes(projets), [projets]);
  const activeAlertes = useMemo(() => liveAlertes.filter(a => !dismissed.has(a.id)), [liveAlertes, dismissed]);
  const myInbox = useMemo(() => selectInboxFor(inbox, user?.email), [inbox, user?.email]);
  const unreadInbox = myInbox.filter(n => !n.read).length;

  const [tab, setTab] = useState<'alertes' | 'notifications'>('alertes');
  const [gravite, setGravite] = useState<'tous' | WorkflowAlerte['priorite']>('tous');
  const [typeF, setTypeF] = useState<'tous' | WorkflowAlerte['type']>('tous');
  const [q, setQ] = useState('');

  const counts = useMemo(() => ({
    critique: activeAlertes.filter(a => a.priorite === 'critique').length,
    haute: activeAlertes.filter(a => a.priorite === 'haute').length,
    normale: activeAlertes.filter(a => a.priorite === 'normale').length,
  }), [activeAlertes]);

  const filtered = useMemo(() => activeAlertes.filter(a =>
    (gravite === 'tous' || a.priorite === gravite) &&
    (typeF === 'tous' || a.type === typeF) &&
    (!q || a.message.toLowerCase().includes(q.toLowerCase()) || a.projetCode.toLowerCase().includes(q.toLowerCase())),
  ), [activeAlertes, gravite, typeF, q]);

  const openProjet = (code: string) => router.push(`/cockpit-projet?code=${encodeURIComponent(code)}`);

  const kpis = [
    { label: 'Critiques', value: counts.critique, color: C.red,    bg: '#FEE2E2' },
    { label: 'Hautes',    value: counts.haute,    color: C.amber,  bg: '#FEF3C7' },
    { label: 'Normales',  value: counts.normale,  color: '#1D4ED8', bg: '#EFF6FF' },
    ...(unreadInbox > 0 ? [{ label: 'Notifications non lues', value: unreadInbox, color: C.navy, bg: '#EDE9FE' }] : [{ label: 'Boîte de réception', value: myInbox.length, color: C.navy, bg: '#EDE9FE' }]),
  ];

  return (
    <div style={{ flex: 1, overflowY: 'auto', background: C.bg, padding: '20px 24px', display: 'flex', flexDirection: 'column', gap: 16 }}>
      {/* En-tête */}
      <div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{ width: 38, height: 38, borderRadius: 10, background: C.navy, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
            <Bell size={19} color="#fff" />
          </div>
          <div>
            <h1 style={{ fontSize: 20, fontWeight: 800, color: '#0F172A', margin: 0, lineHeight: 1.1 }}>Alertes &amp; Notifications</h1>
            <div style={{ fontSize: 12.5, color: C.slate, marginTop: 2 }}>
              Alertes portefeuille recalculées en continu depuis l'état réel des projets · {activeAlertes.length} active{activeAlertes.length > 1 ? 's' : ''}
            </div>
          </div>
        </div>
      </div>

      {/* KPI strip */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12 }}>
        {kpis.map(k => (
          <div key={k.label} style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 10, padding: '12px 16px', borderLeft: `3px solid ${k.color}` }}>
            <div style={{ fontSize: 26, fontWeight: 800, color: k.color, lineHeight: 1 }}>{k.value}</div>
            <div style={{ fontSize: 11, color: C.slate, marginTop: 4 }}>{k.label}</div>
          </div>
        ))}
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', gap: 0, borderBottom: `1px solid ${C.border}` }}>
        {([['alertes', `Alertes portefeuille (${activeAlertes.length})`], ['notifications', `Mes notifications (${myInbox.length})`]] as const).map(([id, label]) => (
          <button key={id} onClick={() => setTab(id)}
            style={{
              padding: '9px 18px', border: 'none', background: 'transparent', cursor: 'pointer', fontFamily: 'inherit',
              fontSize: 13, fontWeight: tab === id ? 700 : 500, color: tab === id ? C.orange : C.slate,
              borderBottom: tab === id ? `2px solid ${C.orange}` : '2px solid transparent', marginBottom: -1,
            }}>
            {label}
          </button>
        ))}
        {tab === 'alertes' && activeAlertes.length > 0 && (
          <button onClick={() => dismissAlertes(activeAlertes.map(a => a.id))}
            style={{ marginLeft: 'auto', alignSelf: 'center', display: 'inline-flex', alignItems: 'center', gap: 5, fontSize: 11.5, fontWeight: 600, color: C.slate, background: 'transparent', border: 'none', cursor: 'pointer', padding: '4px 8px' }}>
            <CheckCheck size={13} /> Tout marquer traité
          </button>
        )}
        {tab === 'notifications' && unreadInbox > 0 && (
          <button onClick={() => markAllInboxRead(user?.email)}
            style={{ marginLeft: 'auto', alignSelf: 'center', display: 'inline-flex', alignItems: 'center', gap: 5, fontSize: 11.5, fontWeight: 600, color: C.slate, background: 'transparent', border: 'none', cursor: 'pointer', padding: '4px 8px' }}>
            <CheckCheck size={13} /> Tout marquer lu
          </button>
        )}
      </div>

      {/* ── ALERTES ── */}
      {tab === 'alertes' && (
        <>
          {/* Filtres */}
          <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, background: C.surface, border: `1px solid ${C.border}`, borderRadius: 8, padding: '6px 10px', flex: '1 1 220px', minWidth: 0 }}>
              <Search size={14} color={C.slate} />
              <input value={q} onChange={e => setQ(e.target.value)} placeholder="Rechercher une alerte ou un projet…"
                style={{ border: 'none', outline: 'none', fontSize: 13, fontFamily: 'inherit', width: '100%', background: 'transparent', color: '#0F172A' }} />
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <Filter size={14} color={C.slate} />
              <select value={gravite} onChange={e => setGravite(e.target.value as typeof gravite)} style={selStyle}>
                <option value="tous">Toutes gravités</option>
                <option value="critique">Critique</option>
                <option value="haute">Haute</option>
                <option value="normale">Normale</option>
              </select>
              <select value={typeF} onChange={e => setTypeF(e.target.value as typeof typeF)} style={selStyle}>
                <option value="tous">Tous types</option>
                {Object.entries(TYPE_META).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
              </select>
            </div>
          </div>

          {/* Liste */}
          <div style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 12, overflow: 'hidden' }}>
            {filtered.length === 0 ? (
              <div style={{ padding: '48px 16px', textAlign: 'center', color: '#94A3B8' }}>
                <CheckCircle2 size={34} style={{ margin: '0 auto 10px', display: 'block', color: C.green }} />
                <div style={{ fontSize: 13.5, fontWeight: 600, color: '#475569' }}>Aucune alerte {activeAlertes.length > 0 ? 'ne correspond aux filtres' : 'en attente'}</div>
                <div style={{ fontSize: 12, marginTop: 3 }}>Le portefeuille est sous contrôle sur ce périmètre.</div>
              </div>
            ) : filtered.map((a, i) => {
              const pm = PRIORITE_META[a.priorite];
              const tm = TYPE_META[a.type] ?? { Icon: Info, label: a.type };
              return (
                <div key={a.id}
                  onClick={() => openProjet(a.projetCode)}
                  style={{ display: 'flex', gap: 12, alignItems: 'flex-start', padding: '13px 16px', borderBottom: i < filtered.length - 1 ? `1px solid #F1F5F9` : 'none', cursor: 'pointer', borderLeft: `3px solid ${pm.color}`, transition: 'background .1s' }}
                  onMouseEnter={e => (e.currentTarget.style.background = '#FAFBFD')}
                  onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}>
                  <div style={{ width: 34, height: 34, borderRadius: 9, background: pm.bg, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                    <tm.Icon size={16} style={{ color: pm.color }} />
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 3, flexWrap: 'wrap' }}>
                      <span style={{ fontSize: 9.5, fontWeight: 800, padding: '2px 7px', borderRadius: 5, background: pm.bg, color: pm.color, textTransform: 'uppercase', letterSpacing: '.04em' }}>{pm.label}</span>
                      <span style={{ fontSize: 10.5, fontWeight: 700, color: C.navy }}>{a.projetCode}</span>
                      <span style={{ fontSize: 10, color: '#94A3B8' }}>· {tm.label}</span>
                    </div>
                    <div style={{ fontSize: 13, color: '#1E293B', lineHeight: 1.45 }}>{a.message}</div>
                    <div style={{ fontSize: 10.5, color: '#94A3B8', marginTop: 4 }}>{a.destinataire} · {a.date}</div>
                  </div>
                  <div style={{ display: 'flex', gap: 6, flexShrink: 0, alignItems: 'center' }}>
                    <button onClick={e => { e.stopPropagation(); openProjet(a.projetCode); }} title="Ouvrir le projet"
                      style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 11, fontWeight: 600, color: C.navy, background: `${C.navy}0D`, border: `1px solid ${C.navy}25`, borderRadius: 6, padding: '4px 9px', cursor: 'pointer' }}>
                      <ExternalLink size={11} /> Ouvrir
                    </button>
                    <button onClick={e => { e.stopPropagation(); dismissAlerte(a.id); }} aria-label="Marquer comme traité"
                      style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#CBD5E1', padding: 4 }}>
                      <X size={15} />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </>
      )}

      {/* ── NOTIFICATIONS ── */}
      {tab === 'notifications' && (
        <div style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 12, overflow: 'hidden' }}>
          {myInbox.length === 0 ? (
            <div style={{ padding: '48px 16px', textAlign: 'center', color: '#94A3B8' }}>
              <MailOpen size={34} style={{ margin: '0 auto 10px', display: 'block', color: '#CBD5E1' }} />
              <div style={{ fontSize: 13.5, fontWeight: 600, color: '#475569' }}>Aucune notification</div>
              <div style={{ fontSize: 12, marginTop: 3 }}>Les notifications de workflow, courriers et pointages apparaîtront ici.</div>
            </div>
          ) : myInbox.map((n, i) => {
            const meta = NOTIF_ICON[n.type] ?? NOTIF_ICON.info;
            return (
              <div key={n.id}
                onClick={() => { if (!n.read) markInboxRead(n.id); if (n.link) router.push(n.link); }}
                style={{ display: 'flex', gap: 12, alignItems: 'flex-start', padding: '13px 16px', borderBottom: i < myInbox.length - 1 ? `1px solid #F1F5F9` : 'none', cursor: 'pointer', background: n.read ? 'transparent' : '#FBFAFF', transition: 'background .1s' }}
                onMouseEnter={e => (e.currentTarget.style.background = '#FAFBFD')}
                onMouseLeave={e => (e.currentTarget.style.background = n.read ? 'transparent' : '#FBFAFF')}>
                <div style={{ width: 34, height: 34, borderRadius: 9, background: `${meta.color}15`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                  <meta.Icon size={16} style={{ color: meta.color }} />
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    {!n.read && <span style={{ width: 7, height: 7, borderRadius: 99, background: C.orange, flexShrink: 0 }} />}
                    <span style={{ fontSize: 13, fontWeight: n.read ? 600 : 700, color: '#1E293B' }}>{n.title}</span>
                    {n.source && <span style={{ fontSize: 10, color: '#94A3B8' }}>· {n.source}</span>}
                  </div>
                  <div style={{ fontSize: 12.5, color: '#475569', lineHeight: 1.45, marginTop: 2 }}>{n.message}</div>
                  <div style={{ fontSize: 10.5, color: '#94A3B8', marginTop: 4 }}>{relTime(n.createdAt)}</div>
                </div>
                <div style={{ display: 'flex', gap: 4, flexShrink: 0 }}>
                  {!n.read && (
                    <button onClick={e => { e.stopPropagation(); markInboxRead(n.id); }} aria-label="Marquer comme lu"
                      style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#CBD5E1', padding: 4 }}><Mail size={15} /></button>
                  )}
                  <button onClick={e => { e.stopPropagation(); removeInbox(n.id); }} aria-label="Supprimer la notification"
                    style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#CBD5E1', padding: 4 }}><Trash2 size={14} /></button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

const selStyle: React.CSSProperties = {
  padding: '7px 10px', borderRadius: 8, border: `1px solid ${C.border}`, background: '#fff',
  fontSize: 12.5, fontFamily: 'inherit', color: '#334155', cursor: 'pointer',
};

'use client';
/**
 * Parametrage.tsx — Préférences & Profil personnel
 * Page self-service accessible à tous les agents DPE.
 */
import { useState } from 'react';
import { useAuth } from '@/lib/authStore';
import { ROLES } from '@/lib/authTypes';
import { useNotificationStore } from '@/lib/notificationStore';
import toast from 'react-hot-toast';
import {
  User, Bell, Globe, Shield, Monitor, ChevronRight,
  Check, Save, Eye, EyeOff, Mail, Phone, Building2,
} from 'lucide-react';

const NAVY  = '#1B4F8A';
const ORANGE = '#F47920';
const BORDER = '#E2E8F0';

type Section = 'profil' | 'notifications' | 'apparence' | 'securite';

const SECTIONS: { id: Section; icon: React.ComponentType<{ size?: number; style?: React.CSSProperties }>; label: string; desc: string }[] = [
  { id: 'profil',         icon: User,    label: 'Profil',                  desc: 'Informations personnelles & poste' },
  { id: 'notifications',  icon: Bell,    label: 'Notifications',            desc: 'Alertes, emails et fréquence' },
  { id: 'apparence',      icon: Monitor, label: 'Apparence & Langue',       desc: 'Thème, langue d\'interface' },
  { id: 'securite',       icon: Shield,  label: 'Sécurité',                 desc: 'Mot de passe et sessions' },
];

const inp: React.CSSProperties = {
  width: '100%', padding: '9px 12px', borderRadius: 8,
  border: `1px solid ${BORDER}`, fontSize: 13, fontFamily: 'inherit',
  outline: 'none', color: '#0F172A',
};

export default function Parametrage() {
  const { user } = useAuth();
  const unreadCount = useNotificationStore(s =>
    s.inbox.filter(n => !n.read && n.recipientEmail === user?.email?.toLowerCase()).length
  );

  const [section, setSection] = useState<Section>('profil');

  // Profil state
  const [telephone, setTelephone] = useState(user?.poste ?? '');
  const [bio, setBio] = useState('');

  // Notifications state
  const [notifEmail, setNotifEmail]     = useState(true);
  const [notifInApp, setNotifInApp]     = useState(true);
  const [notifRisques, setNotifRisques] = useState(true);
  const [notifTaches, setNotifTaches]   = useState(true);
  const [notifWorkflow, setNotifWorkflow] = useState(true);
  const [digest, setDigest] = useState<'immediat' | 'quotidien' | 'hebdo'>('immediat');

  // Apparence
  const [langue, setLangue] = useState<'fr' | 'en'>('fr');
  const [theme, setTheme]   = useState<'clair' | 'sombre' | 'systeme'>('clair');
  const [dense, setDense]   = useState(false);

  // Sécurité
  const [showPwd, setShowPwd]   = useState(false);
  const [oldPwd, setOldPwd]     = useState('');
  const [newPwd, setNewPwd]     = useState('');
  const [confirmPwd, setConfirmPwd] = useState('');

  const role = user?.role ? ROLES[user.role as keyof typeof ROLES] : null;

  const save = () => {
    toast.success('Préférences enregistrées.');
  };

  const changePwd = () => {
    if (!oldPwd || !newPwd) { toast.error('Remplissez tous les champs.'); return; }
    if (newPwd !== confirmPwd) { toast.error('Les mots de passe ne correspondent pas.'); return; }
    if (newPwd.length < 8) { toast.error('Minimum 8 caractères.'); return; }
    toast.success('Mot de passe mis à jour.');
    setOldPwd(''); setNewPwd(''); setConfirmPwd('');
  };

  return (
    <div style={{ flex: 1, overflowY: 'auto', padding: '20px 24px', background: '#F4F6F9' }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 20 }}>
        <div style={{ width: 40, height: 40, borderRadius: 10, background: '#EFF6FF', display: 'grid', placeItems: 'center' }}>
          <User size={20} color={NAVY} />
        </div>
        <div>
          <h1 style={{ fontSize: 20, fontWeight: 800, color: '#0F172A', margin: 0 }}>Préférences & Profil</h1>
          <p style={{ fontSize: 12.5, color: '#64748B', margin: '2px 0 0' }}>
            {user ? `${user.prenom} ${user.nom}` : '—'} · {role?.label ?? 'Agent DPE'}
          </p>
        </div>
        {unreadCount > 0 && (
          <span style={{ marginLeft: 'auto', background: '#FEE2E2', color: '#B91C1C', fontSize: 11, fontWeight: 700, padding: '3px 10px', borderRadius: 20 }}>
            {unreadCount} notification{unreadCount > 1 ? 's' : ''} non lue{unreadCount > 1 ? 's' : ''}
          </span>
        )}
      </div>

      <div style={{ display: 'flex', gap: 16, alignItems: 'flex-start', flexWrap: 'wrap' }}>
        {/* Nav sections */}
        <div style={{ width: 220, flexShrink: 0, background: '#fff', borderRadius: 12, border: `1px solid ${BORDER}`, overflow: 'hidden' }}>
          {SECTIONS.map(s => (
            <button key={s.id} onClick={() => setSection(s.id)}
              style={{
                width: '100%', display: 'flex', alignItems: 'center', gap: 10, padding: '12px 14px',
                border: 'none', borderLeft: section === s.id ? `3px solid ${ORANGE}` : '3px solid transparent',
                background: section === s.id ? 'linear-gradient(90deg, rgba(244,121,32,.08), transparent)' : 'transparent',
                cursor: 'pointer', fontFamily: 'inherit', textAlign: 'left',
              }}>
              <s.icon size={15} style={{ color: section === s.id ? ORANGE : '#94A3B8', flexShrink: 0 }} />
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 13, fontWeight: section === s.id ? 700 : 500, color: section === s.id ? NAVY : '#334155' }}>{s.label}</div>
                <div style={{ fontSize: 10.5, color: '#94A3B8', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{s.desc}</div>
              </div>
              <ChevronRight size={12} style={{ color: '#CBD5E1', flexShrink: 0 }} />
            </button>
          ))}
        </div>

        {/* Content panel */}
        <div style={{ flex: 1, minWidth: 0, background: '#fff', borderRadius: 12, border: `1px solid ${BORDER}`, padding: 22 }}>

          {/* ─ Profil ─────────────────────────────────────────────────── */}
          {section === 'profil' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
              <div style={{ fontSize: 15, fontWeight: 800, color: NAVY }}>Informations personnelles</div>

              {/* Avatar */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
                <div style={{ width: 56, height: 56, borderRadius: 14, background: user?.avatarColor ?? NAVY, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18, fontWeight: 800, color: '#fff', flexShrink: 0 }}>
                  {user?.initials ?? 'DPE'}
                </div>
                <div>
                  <div style={{ fontSize: 16, fontWeight: 700, color: '#0F172A' }}>{user ? `${user.prenom} ${user.nom}` : '—'}</div>
                  <div style={{ fontSize: 12, color: '#64748B', marginTop: 2 }}>{user?.email}</div>
                  <div style={{ display: 'inline-block', marginTop: 4, padding: '2px 10px', borderRadius: 20, background: '#EFF6FF', color: NAVY, fontSize: 11, fontWeight: 700 }}>{role?.label}</div>
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(220px,1fr))', gap: 14 }}>
                <label style={{ display: 'flex', flexDirection: 'column', gap: 5, fontSize: 12, fontWeight: 700, color: '#475569' }}>
                  Prénom
                  <input value={user?.prenom ?? ''} disabled style={{ ...inp, background: '#F8FAFC', color: '#94A3B8' }} />
                </label>
                <label style={{ display: 'flex', flexDirection: 'column', gap: 5, fontSize: 12, fontWeight: 700, color: '#475569' }}>
                  Nom
                  <input value={user?.nom ?? ''} disabled style={{ ...inp, background: '#F8FAFC', color: '#94A3B8' }} />
                </label>
                <label style={{ display: 'flex', flexDirection: 'column', gap: 5, fontSize: 12, fontWeight: 700, color: '#475569' }}>
                  <span style={{ display: 'flex', gap: 5, alignItems: 'center' }}><Mail size={12} /> Email</span>
                  <input value={user?.email ?? ''} disabled style={{ ...inp, background: '#F8FAFC', color: '#94A3B8' }} />
                </label>
                <label style={{ display: 'flex', flexDirection: 'column', gap: 5, fontSize: 12, fontWeight: 700, color: '#475569' }}>
                  <span style={{ display: 'flex', gap: 5, alignItems: 'center' }}><Building2 size={12} /> Direction</span>
                  <input value={user?.direction ?? ''} disabled style={{ ...inp, background: '#F8FAFC', color: '#94A3B8' }} />
                </label>
                <label style={{ display: 'flex', flexDirection: 'column', gap: 5, fontSize: 12, fontWeight: 700, color: '#475569' }}>
                  <span style={{ display: 'flex', gap: 5, alignItems: 'center' }}><Phone size={12} /> Téléphone</span>
                  <input value={telephone} onChange={e => setTelephone(e.target.value)} placeholder="Ex : +221 77 000 00 00" style={inp} />
                </label>
              </div>

              <label style={{ display: 'flex', flexDirection: 'column', gap: 5, fontSize: 12, fontWeight: 700, color: '#475569' }}>
                Bio / Poste occupé
                <textarea value={bio} onChange={e => setBio(e.target.value)} rows={3}
                  placeholder="Décrivez brièvement votre rôle et vos responsabilités…"
                  style={{ ...inp, resize: 'vertical', lineHeight: 1.5 }} />
              </label>

              <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                <button onClick={save} style={{ display: 'flex', alignItems: 'center', gap: 7, padding: '9px 20px', borderRadius: 8, border: 'none', background: ORANGE, color: '#fff', fontSize: 13, fontWeight: 700, cursor: 'pointer' }}>
                  <Save size={14} /> Enregistrer
                </button>
              </div>
            </div>
          )}

          {/* ─ Notifications ──────────────────────────────────────────── */}
          {section === 'notifications' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
              <div style={{ fontSize: 15, fontWeight: 800, color: NAVY }}>Préférences de notifications</div>

              {/* Canaux */}
              <div>
                <div style={{ fontSize: 12, fontWeight: 700, color: '#475569', marginBottom: 10, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Canaux</div>
                {[
                  { key: 'email', label: 'Notifications par e-mail', val: notifEmail, set: setNotifEmail },
                  { key: 'inapp', label: 'Notifications in-app (cloche)', val: notifInApp, set: setNotifInApp },
                ].map(row => (
                  <div key={row.key} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 0', borderBottom: `1px solid ${BORDER}` }}>
                    <span style={{ fontSize: 13, color: '#334155' }}>{row.label}</span>
                    <button onClick={() => row.set(!row.val)}
                      style={{ width: 40, height: 22, borderRadius: 99, border: 'none', cursor: 'pointer', background: row.val ? ORANGE : '#CBD5E1', position: 'relative', transition: 'background .15s' }}>
                      <span style={{ position: 'absolute', top: 3, left: row.val ? 20 : 3, width: 16, height: 16, borderRadius: 99, background: '#fff', transition: 'left .15s', boxShadow: '0 1px 3px rgba(0,0,0,.2)' }} />
                    </button>
                  </div>
                ))}
              </div>

              {/* Types */}
              <div>
                <div style={{ fontSize: 12, fontWeight: 700, color: '#475569', marginBottom: 10, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Types d'événements</div>
                {[
                  { key: 'risques', label: 'Alertes risques & QHSE', val: notifRisques, set: setNotifRisques },
                  { key: 'taches', label: 'Tâches assignées & échéances', val: notifTaches, set: setNotifTaches },
                  { key: 'workflow', label: 'Documents à valider (parapheur)', val: notifWorkflow, set: setNotifWorkflow },
                ].map(row => (
                  <div key={row.key} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 0', borderBottom: `1px solid ${BORDER}` }}>
                    <span style={{ fontSize: 13, color: '#334155' }}>{row.label}</span>
                    <button onClick={() => row.set(!row.val)}
                      style={{ width: 40, height: 22, borderRadius: 99, border: 'none', cursor: 'pointer', background: row.val ? ORANGE : '#CBD5E1', position: 'relative', transition: 'background .15s' }}>
                      <span style={{ position: 'absolute', top: 3, left: row.val ? 20 : 3, width: 16, height: 16, borderRadius: 99, background: '#fff', transition: 'left .15s', boxShadow: '0 1px 3px rgba(0,0,0,.2)' }} />
                    </button>
                  </div>
                ))}
              </div>

              {/* Fréquence */}
              <div>
                <div style={{ fontSize: 12, fontWeight: 700, color: '#475569', marginBottom: 10, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Fréquence des résumés e-mail</div>
                <div style={{ display: 'flex', gap: 8 }}>
                  {(['immediat', 'quotidien', 'hebdo'] as const).map(v => (
                    <button key={v} onClick={() => setDigest(v)}
                      style={{ padding: '7px 16px', borderRadius: 8, border: `1.5px solid ${digest === v ? NAVY : BORDER}`, background: digest === v ? NAVY : '#fff', color: digest === v ? '#fff' : '#475569', fontSize: 12, fontWeight: digest === v ? 700 : 400, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 5 }}>
                      {digest === v && <Check size={11} />}
                      {v === 'immediat' ? 'Immédiat' : v === 'quotidien' ? 'Digest quotidien' : 'Résumé hebdo'}
                    </button>
                  ))}
                </div>
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                <button onClick={save} style={{ display: 'flex', alignItems: 'center', gap: 7, padding: '9px 20px', borderRadius: 8, border: 'none', background: ORANGE, color: '#fff', fontSize: 13, fontWeight: 700, cursor: 'pointer' }}>
                  <Save size={14} /> Enregistrer
                </button>
              </div>
            </div>
          )}

          {/* ─ Apparence ─────────────────────────────────────────────── */}
          {section === 'apparence' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
              <div style={{ fontSize: 15, fontWeight: 800, color: NAVY }}>Apparence & Langue</div>

              {/* Langue */}
              <div>
                <div style={{ fontSize: 12, fontWeight: 700, color: '#475569', marginBottom: 10, textTransform: 'uppercase', letterSpacing: '0.05em' }}><Globe size={12} style={{ display: 'inline', marginRight: 4 }} />Langue de l'interface</div>
                <div style={{ display: 'flex', gap: 10 }}>
                  {(['fr', 'en'] as const).map(l => (
                    <button key={l} onClick={() => setLangue(l)}
                      style={{ padding: '10px 24px', borderRadius: 10, border: `2px solid ${langue === l ? ORANGE : BORDER}`, background: langue === l ? '#FFF7ED' : '#fff', color: langue === l ? ORANGE : '#475569', fontSize: 13, fontWeight: langue === l ? 700 : 400, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6 }}>
                      {langue === l && <Check size={13} />}
                      {l === 'fr' ? '🇫🇷 Français' : '🇬🇧 English'}
                    </button>
                  ))}
                </div>
              </div>

              {/* Thème */}
              <div>
                <div style={{ fontSize: 12, fontWeight: 700, color: '#475569', marginBottom: 10, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Thème</div>
                <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                  {([
                    { val: 'clair', label: '☀️ Clair' },
                    { val: 'sombre', label: '🌙 Sombre' },
                    { val: 'systeme', label: '💻 Système' },
                  ] as const).map(t => (
                    <button key={t.val} onClick={() => setTheme(t.val)}
                      style={{ padding: '10px 20px', borderRadius: 10, border: `2px solid ${theme === t.val ? NAVY : BORDER}`, background: theme === t.val ? NAVY : '#fff', color: theme === t.val ? '#fff' : '#475569', fontSize: 13, fontWeight: theme === t.val ? 700 : 400, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6 }}>
                      {theme === t.val && <Check size={13} />}
                      {t.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Densité */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '14px 0', borderTop: `1px solid ${BORDER}` }}>
                <div>
                  <div style={{ fontSize: 13, fontWeight: 600, color: '#334155' }}>Mode compact</div>
                  <div style={{ fontSize: 11.5, color: '#94A3B8' }}>Réduit l'espacement des tableaux et listes</div>
                </div>
                <button onClick={() => setDense(!dense)}
                  style={{ width: 40, height: 22, borderRadius: 99, border: 'none', cursor: 'pointer', background: dense ? ORANGE : '#CBD5E1', position: 'relative', transition: 'background .15s' }}>
                  <span style={{ position: 'absolute', top: 3, left: dense ? 20 : 3, width: 16, height: 16, borderRadius: 99, background: '#fff', transition: 'left .15s', boxShadow: '0 1px 3px rgba(0,0,0,.2)' }} />
                </button>
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                <button onClick={save} style={{ display: 'flex', alignItems: 'center', gap: 7, padding: '9px 20px', borderRadius: 8, border: 'none', background: ORANGE, color: '#fff', fontSize: 13, fontWeight: 700, cursor: 'pointer' }}>
                  <Save size={14} /> Enregistrer
                </button>
              </div>
            </div>
          )}

          {/* ─ Sécurité ─────────────────────────────────────────────── */}
          {section === 'securite' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
              <div style={{ fontSize: 15, fontWeight: 800, color: NAVY }}>Sécurité du compte</div>

              <div style={{ padding: 14, background: '#F0FDF4', borderRadius: 10, border: '1px solid #BBF7D0', fontSize: 12.5, color: '#15803D' }}>
                ✅ Votre compte est protégé. Dernière connexion enregistrée depuis SENELEC DPE.
              </div>

              <div style={{ fontSize: 13, fontWeight: 700, color: NAVY }}>Changer le mot de passe</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12, maxWidth: 400 }}>
                {[
                  { label: 'Mot de passe actuel', val: oldPwd, set: setOldPwd },
                  { label: 'Nouveau mot de passe',    val: newPwd, set: setNewPwd },
                  { label: 'Confirmer le nouveau mot de passe', val: confirmPwd, set: setConfirmPwd },
                ].map((f, i) => (
                  <label key={i} style={{ display: 'flex', flexDirection: 'column', gap: 5, fontSize: 12, fontWeight: 700, color: '#475569' }}>
                    {f.label}
                    <div style={{ position: 'relative' }}>
                      <input type={showPwd ? 'text' : 'password'} value={f.val} onChange={e => f.set(e.target.value)}
                        style={{ ...inp, paddingRight: 36 }} />
                      <button type="button" onClick={() => setShowPwd(v => !v)}
                        style={{ position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: '#94A3B8', display: 'flex' }}>
                        {showPwd ? <EyeOff size={15} /> : <Eye size={15} />}
                      </button>
                    </div>
                  </label>
                ))}
              </div>
              <div style={{ fontSize: 11.5, color: '#94A3B8' }}>Minimum 8 caractères. Évitez les mots de passe déjà utilisés.</div>
              <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                <button onClick={changePwd} style={{ display: 'flex', alignItems: 'center', gap: 7, padding: '9px 20px', borderRadius: 8, border: 'none', background: NAVY, color: '#fff', fontSize: 13, fontWeight: 700, cursor: 'pointer' }}>
                  <Shield size={14} /> Mettre à jour
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

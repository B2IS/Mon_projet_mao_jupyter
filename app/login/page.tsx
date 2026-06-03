'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { TEST_USERS, DEMO_ACCOUNTS, ROLES, useAuth, getDirectionLabel } from '@/lib/authStore';
import { getDepartementLabel } from '@/lib/dpeOrgStructure';
import SenelecLogo from '@/components/ui/SenelecLogo';

/* ══════════════════════════════════════════════════════════════════
   SENELEC LOGO SVG — Charte graphique officielle
   Deux pales translucides : orange→rouge + violet→rose
══════════════════════════════════════════════════════════════════ */
/**
 * Logo Senelec pour la page login — deux grands ovales qui se chevauchent
 * (forme officielle : ovale gauche violet, ovale droit orange-rouge, texte blanc).
 */
function SenelecLogoLogin() {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10 }}>
      <SenelecLogo size={150} />
      {/* Tagline sous l'emblème */}
      <div style={{
        fontSize: 11, color: 'rgba(255,255,255,0.60)', fontStyle: 'italic',
        letterSpacing: '0.01em',
      }}>L&apos;énergie de tous les possibles</div>
    </div>
  );
}

/* ── Wrapper pour accéder au contexte Auth ─── */
function LoginInner() {
  const router   = useRouter();
  const { login, changePassword } = useAuth();
  const [email,    setEmail]    = useState('directeur@dpe.sn');
  const [password, setPassword] = useState('dpe2026');
  const [loading,  setLoading]  = useState(false);
  const [error,    setError]    = useState('');
  // Réinitialisation obligatoire (mot de passe expiré ≥ 6 mois)
  const [mustChange, setMustChange] = useState(false);
  const [newPwd, setNewPwd] = useState('');
  const [newPwd2, setNewPwd2] = useState('');
  const [cpError, setCpError] = useState('');

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    await new Promise(r => setTimeout(r, 700));
    const result = login(email, password);
    if (result.success) {
      if (result.mustChangePassword) { setMustChange(true); setLoading(false); return; }
      router.push('/tableau-de-bord');
    } else {
      setError(result.error ?? 'Identifiants incorrects.');
      setLoading(false);
    }
  };

  const handleChangePassword = (e: React.FormEvent) => {
    e.preventDefault();
    setCpError('');
    if (newPwd !== newPwd2) { setCpError('Les deux mots de passe ne correspondent pas.'); return; }
    const res = changePassword(email, password, newPwd);
    if (res.success) {
      setMustChange(false);
      router.push('/tableau-de-bord');
    } else {
      setCpError(res.error ?? 'Échec du changement de mot de passe.');
    }
  };

  // Connexion DIRECTE au clic sur un compte rapide (ne fait plus seulement pré-remplir).
  const loginAs = async (acc: typeof TEST_USERS[0]) => {
    setEmail(acc.email);
    setPassword(acc.password);
    setError('');
    setLoading(true);
    await new Promise(r => setTimeout(r, 250));
    const result = login(acc.email, acc.password);
    if (result.success) {
      if (result.mustChangePassword) { setMustChange(true); setLoading(false); return; }
      router.push('/tableau-de-bord');
    } else {
      setError(result.error ?? 'Identifiants incorrects.');
      setLoading(false);
    }
  };

  // Comptes "rapides" : comptes de démo fiables (un par rôle, @dpe.sn / dpe2026)
  const quickUsers = DEMO_ACCOUNTS;
  const selectedUser = TEST_USERS.find(u => u.email === email);

  return (
    <div style={{
      minHeight: '100vh',
      background: 'linear-gradient(145deg, #1A0840 0%, #2D1167 40%, #3D1A6B 70%, #5A2080 100%)',
      display: 'flex', alignItems: 'stretch', justifyContent: 'center',
      fontFamily: "'Inter','Segoe UI',system-ui,sans-serif",
      position: 'relative', overflow: 'hidden',
    }}>
      {/* Decorative orbs */}
      <div style={{ position: 'absolute', top: -80, right: -80, width: 320, height: 320, borderRadius: '50%',
        background: 'radial-gradient(circle, rgba(244,121,32,0.18) 0%, transparent 70%)', pointerEvents: 'none' }}/>
      <div style={{ position: 'absolute', bottom: -60, left: -60, width: 240, height: 240, borderRadius: '50%',
        background: 'radial-gradient(circle, rgba(200,32,96,0.14) 0%, transparent 70%)', pointerEvents: 'none' }}/>

      {/* Accent bar top — Senelec gradient */}
      <div style={{ position: 'fixed', top: 0, left: 0, right: 0, height: 4, zIndex: 10,
        background: 'linear-gradient(90deg, #F58220 0%, #E2003B 50%, #7A2D8B 100%)' }}/>

      {/* ═══ LEFT PANEL — Logo + comptes ═══ */}
      <div className="login-left" style={{
        flex: 1, maxWidth: 520,
        display: 'flex', flexDirection: 'column',
        alignItems: 'center', justifyContent: 'center',
        padding: '48px 36px',
      }}>
        {/* Logo Senelec */}
        <div style={{ marginBottom: 32, textAlign: 'center' }}>
          <SenelecLogoLogin />
          <div style={{ marginTop: 16, height: 1, background: 'rgba(255,255,255,0.12)', width: 200, margin: '14px auto 0' }}/>
          <div style={{ marginTop: 12, fontSize: 11, fontWeight: 700, letterSpacing: '0.18em',
            color: 'rgba(255,255,255,0.45)', textTransform: 'uppercase' }}>
            SIGEPP · DPE — V1.0
          </div>
          <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.30)', marginTop: 3 }}>
            Direction Principale Équipement
          </div>
        </div>

        {/* ── Comptes de démo ── */}
        <div style={{ width: '100%', maxWidth: 420 }}>
          <div style={{ fontSize: 10, fontWeight: 700, color: 'rgba(255,255,255,0.38)',
            letterSpacing: '0.10em', textTransform: 'uppercase', marginBottom: 10 }}>
            Comptes rapides — cliquez pour vous connecter (mot de passe : dpe2026)
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 5, maxHeight: 400, overflowY: 'auto',
            paddingRight: 4, scrollbarWidth: 'thin' }}>
            {quickUsers.map(acc => {
              const role = ROLES[acc.role];
              const isSel = email === acc.email;
              return (
                <button key={acc.id}
                  onClick={() => loginAs(acc)}
                  disabled={loading}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 10,
                    padding: '9px 12px',
                    background: isSel ? 'rgba(244,121,32,0.20)' : 'rgba(255,255,255,0.05)',
                    border: isSel ? '1px solid rgba(244,121,32,0.55)' : '1px solid rgba(255,255,255,0.08)',
                    borderRadius: 9, cursor: 'pointer', fontFamily: 'inherit', textAlign: 'left',
                    transition: 'all 0.12s',
                  }}
                  onMouseEnter={e => { if (!isSel) (e.currentTarget as HTMLElement).style.background = 'rgba(255,255,255,0.09)'; }}
                  onMouseLeave={e => { if (!isSel) (e.currentTarget as HTMLElement).style.background = 'rgba(255,255,255,0.05)'; }}
                >
                  <div style={{
                    width: 32, height: 32, borderRadius: 8, background: acc.avatarColor,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: 10, fontWeight: 800, color: '#fff', flexShrink: 0, letterSpacing: '-0.5px',
                  }}>{acc.initials}</div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 12, fontWeight: 700, color: '#fff', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                      {acc.prenom} {acc.nom}
                    </div>
                    <div style={{ fontSize: 9.5, color: 'rgba(255,255,255,0.50)', marginTop: 1 }}>
                      {role.icon} {acc.poste || role.label}
                    </div>
                    <div style={{ fontSize: 8.5, color: 'rgba(255,255,255,0.28)', marginTop: 1,
                      whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                      {getDirectionLabel(acc.direction)}
                      {acc.departement ? ` — ${getDepartementLabel(acc.departement)}` : ''}
                      {acc.cellule && !acc.departement ? ` — ${acc.cellule}` : ''}
                    </div>
                  </div>
                  {isSel && (
                    <span style={{
                      fontSize: 8, background: '#F47920', color: '#fff',
                      borderRadius: 4, padding: '2px 6px', fontWeight: 700, flexShrink: 0,
                    }}>✓</span>
                  )}
                </button>
              );
            })}
          </div>
          <div style={{ fontSize: 9, color: 'rgba(255,255,255,0.25)', marginTop: 8, textAlign: 'center' }}>
            {TEST_USERS.length} comptes disponibles — cliquez un compte rapide pour vous connecter directement, ou saisissez votre email Senelec.
          </div>
        </div>
      </div>

      {/* ═══ RIGHT PANEL — Formulaire ═══ */}
      <div style={{
        width: '100%', maxWidth: 440,
        display: 'flex', flexDirection: 'column',
        alignItems: 'center', justifyContent: 'center',
        padding: '40px 24px',
        background: 'rgba(255,255,255,0.03)',
        borderLeft: '1px solid rgba(255,255,255,0.07)',
        backdropFilter: 'blur(4px)',
      }}>
        <div style={{ width: '100%', maxWidth: 380 }}>
          {/* Card */}
          <div style={{
            background: '#fff', borderRadius: 18, padding: '32px 28px 24px',
            boxShadow: '0 32px 80px rgba(0,0,0,0.45), 0 0 0 1px rgba(255,255,255,0.06)',
          }}>
            {/* Header card (sans logo, à la demande) */}
            <div style={{ marginBottom: 22 }}>
              <h2 style={{ fontSize: 17, fontWeight: 800, color: '#3D1A6B', margin: 0 }}>Connexion</h2>
              <p style={{ fontSize: 10, color: '#94A3B8', marginTop: 2 }}>
                SIGEPP-DPE · Accès sécurisé RBAC
              </p>
            </div>

            {error && (
              <div style={{
                background: '#FEF2F2', border: '1px solid rgba(226,35,26,0.3)',
                borderRadius: 8, padding: '9px 13px', marginBottom: 14,
                fontSize: 11.5, color: '#991B1B', display: 'flex', gap: 7, alignItems: 'center',
              }}>
                ⚠️ {error}
              </div>
            )}

            <form onSubmit={handleLogin} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              {/* Email */}
              <div>
                <label style={{ display: 'block', fontSize: 10, fontWeight: 700, color: '#374151',
                  marginBottom: 5, letterSpacing: '0.06em', textTransform: 'uppercase' }}>
                  Email professionnel
                </label>
                <input
                  type="email" value={email}
                  onChange={e => setEmail(e.target.value)}
                  placeholder="prenom.nom@dpe.sn"
                  required
                  suppressHydrationWarning
                  autoComplete="username"
                  style={{
                    width: '100%', padding: '10px 12px',
                    border: '1.5px solid #CBD5E1', borderRadius: 9,
                    fontSize: 13, fontFamily: 'inherit', color: '#1A1A2E',
                    outline: 'none', boxSizing: 'border-box', transition: 'border-color 0.15s',
                  }}
                  onFocus={e => e.target.style.borderColor = '#3D1A6B'}
                  onBlur={e => e.target.style.borderColor = '#CBD5E1'}
                />
              </div>

              {/* Password */}
              <div>
                <label style={{ display: 'block', fontSize: 10, fontWeight: 700, color: '#374151',
                  marginBottom: 5, letterSpacing: '0.06em', textTransform: 'uppercase' }}>
                  Mot de passe
                </label>
                <input
                  type="password" value={password}
                  onChange={e => setPassword(e.target.value)}
                  placeholder="••••••••"
                  required
                  suppressHydrationWarning
                  autoComplete="current-password"
                  style={{
                    width: '100%', padding: '10px 12px',
                    border: '1.5px solid #CBD5E1', borderRadius: 9,
                    fontSize: 13, fontFamily: 'inherit', color: '#1A1A2E',
                    outline: 'none', boxSizing: 'border-box', transition: 'border-color 0.15s',
                  }}
                  onFocus={e => e.target.style.borderColor = '#3D1A6B'}
                  onBlur={e => e.target.style.borderColor = '#CBD5E1'}
                />
                <div style={{ fontSize: 9.5, color: '#94A3B8', marginTop: 4 }}>
                  Demo : <b style={{ color: '#374151' }}>dpe2026</b>
                </div>
              </div>

              {/* Selected account preview */}
              {selectedUser && (
                <div style={{
                  padding: '10px 12px', background: '#F5F3FF',
                  borderRadius: 9, border: '1px solid #DDD6FE',
                  display: 'flex', alignItems: 'center', gap: 10,
                }}>
                  <div style={{
                    width: 30, height: 30, borderRadius: 7,
                    background: selectedUser.avatarColor,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: 10, fontWeight: 800, color: '#fff', flexShrink: 0,
                  }}>{selectedUser.initials}</div>
                  <div>
                    <div style={{ fontSize: 11.5, fontWeight: 700, color: '#3D1A6B' }}>
                      {selectedUser.prenom} {selectedUser.nom}
                    </div>
                    <div style={{ fontSize: 9.5, color: '#7C3AED', marginTop: 1 }}>
                      {ROLES[selectedUser.role].icon} {selectedUser.poste || ROLES[selectedUser.role].label}
                    </div>
                    <div style={{ fontSize: 9, color: '#94A3B8', marginTop: 1 }}>
                      {getDirectionLabel(selectedUser.direction)}
                    </div>
                  </div>
                </div>
              )}

              {/* Submit */}
              <button
                type="submit" disabled={loading}
                style={{
                  width: '100%', padding: '12px',
                  background: loading ? '#94A3B8' : 'linear-gradient(135deg, #3D1A6B 0%, #5A2080 100%)',
                  color: '#fff', border: 'none', borderRadius: 9,
                  fontSize: 13.5, fontWeight: 800, cursor: loading ? 'not-allowed' : 'pointer',
                  display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                  fontFamily: 'inherit', marginTop: 2,
                  boxShadow: loading ? 'none' : '0 4px 16px rgba(61,26,107,0.35)',
                }}
              >
                {loading ? (
                  <>
                    <span style={{
                      width: 14, height: 14, borderRadius: '50%',
                      border: '2px solid rgba(255,255,255,0.3)', borderTopColor: '#fff',
                      display: 'inline-block', animation: 'spin 0.8s linear infinite',
                    }}/>
                    Authentification...
                  </>
                ) : '🔐  Se connecter'}
              </button>

              <div style={{
                padding: '7px 12px', background: '#F8FAFC', borderRadius: 7,
                fontSize: 9.5, color: '#94A3B8', textAlign: 'center',
              }}>
                🔒 Connexion chiffrée — SIGEPP-DPE V1.0 · SENELEC
              </div>
            </form>
          </div>

          <div style={{ textAlign: 'center', marginTop: 18, color: 'rgba(255,255,255,0.25)', fontSize: 9.5 }}>
            SENELEC — Direction Principale Équipement (DPE)<br/>
            SIGEPP V1.0 · Mai 2026 · Plateforme RBAC multi-rôles
          </div>
        </div>
      </div>

      {/* ═══ MODALE — Réinitialisation obligatoire (mot de passe expiré) ═══ */}
      {mustChange && (
        <div style={{
          position: 'fixed', inset: 0, zIndex: 50, background: 'rgba(15,23,42,0.62)',
          display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20,
        }}>
          <div style={{ background: '#fff', borderRadius: 16, padding: '26px 24px', width: '100%', maxWidth: 380,
            boxShadow: '0 32px 80px rgba(0,0,0,0.5)' }}>
            <h3 style={{ fontSize: 16, fontWeight: 800, color: '#3D1A6B', margin: 0 }}>Mot de passe expiré</h3>
            <p style={{ fontSize: 11, color: '#64748B', marginTop: 4 }}>
              Votre mot de passe doit être réinitialisé (politique : renouvellement tous les 6 mois).
              Il ne peut pas reprendre l&apos;un de vos 3 derniers mots de passe.
            </p>
            {cpError && (
              <div style={{ background: '#FEF2F2', border: '1px solid rgba(226,35,26,0.3)', borderRadius: 8,
                padding: '8px 12px', margin: '10px 0', fontSize: 11, color: '#991B1B' }}>⚠️ {cpError}</div>
            )}
            <form onSubmit={handleChangePassword} style={{ display: 'flex', flexDirection: 'column', gap: 12, marginTop: 12 }}>
              <input type="password" value={newPwd} onChange={e => setNewPwd(e.target.value)} required
                placeholder="Nouveau mot de passe (8 caractères min.)" autoComplete="new-password"
                style={{ width: '100%', padding: '10px 12px', border: '1.5px solid #CBD5E1', borderRadius: 9,
                  fontSize: 13, fontFamily: 'inherit', boxSizing: 'border-box' }} />
              <input type="password" value={newPwd2} onChange={e => setNewPwd2(e.target.value)} required
                placeholder="Confirmer le nouveau mot de passe" autoComplete="new-password"
                style={{ width: '100%', padding: '10px 12px', border: '1.5px solid #CBD5E1', borderRadius: 9,
                  fontSize: 13, fontFamily: 'inherit', boxSizing: 'border-box' }} />
              <button type="submit" style={{ width: '100%', padding: '11px', background: 'linear-gradient(135deg, #3D1A6B 0%, #5A2080 100%)',
                color: '#fff', border: 'none', borderRadius: 9, fontSize: 13, fontWeight: 800, cursor: 'pointer', fontFamily: 'inherit' }}>
                Réinitialiser et continuer
              </button>
            </form>
          </div>
        </div>
      )}

      <style>{`
        @keyframes spin { to { transform: rotate(360deg); } }
        .login-left { display: flex; }
        @media (max-width: 820px) { .login-left { display: none !important; } }
      `}</style>
    </div>
  );
}

export default function LoginPage() {
  // AuthProvider est fourni par le layout racine (app/layout.tsx) :
  // un seul contexte d'authentification partagé entre /login et le dashboard.
  return <LoginInner />;
}

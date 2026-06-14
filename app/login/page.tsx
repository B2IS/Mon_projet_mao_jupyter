'use client';
import { useState, useEffect, useRef, useCallback } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Eye, EyeOff, Lock, AlertCircle, ArrowRight, CheckCircle2 } from 'lucide-react';
import { DEMO_ACCOUNTS, ROLES, useAuth, getDirectionLabel } from '@/lib/authStore';
import { getDepartementLabel } from '@/lib/dpeOrgStructure';
import SenelecLogo from '@/components/ui/SenelecLogo';

// ─── Constantes ───────────────────────────────────────────────────────────────
const PURPLE    = '#3D1A6B';
const ORANGE    = '#F47920';
const BORDER_D  = '#CBD5E1';
const BORDER_F  = PURPLE;
const BORDER_E  = '#DC2626';

// ─── Helpers ──────────────────────────────────────────────────────────────────
function inputStyle(focused: boolean, hasError: boolean, valid: boolean): React.CSSProperties {
  const border = hasError ? BORDER_E : focused ? BORDER_F : valid ? '#16A34A' : BORDER_D;
  return {
    width: '100%', padding: '13px 44px 13px 14px',
    border: `1.5px solid ${border}`,
    borderRadius: 11, fontSize: 14, fontFamily: 'inherit', color: '#1A1A2E',
    outline: 'none', boxSizing: 'border-box', background: '#fff',
    transition: 'border-color 0.18s, box-shadow 0.18s',
    boxShadow: focused ? `0 0 0 3px ${hasError ? 'rgba(220,38,38,0.12)' : 'rgba(61,26,107,0.14)'}` : 'none',
  };
}

// ─── Composant principal ──────────────────────────────────────────────────────
export default function LoginPage() {
  const router       = useRouter();
  const searchParams = useSearchParams();
  const { login, changePassword } = useAuth();

  const [email,      setEmail]    = useState('directeur@dpe.sn');
  const [password,   setPassword] = useState('dpe2026');
  const [showPwd,    setShowPwd]  = useState(false);
  const [loading,    setLoading]  = useState(false);
  const [error,      setError]    = useState('');
  const [shake,      setShake]    = useState(false);
  const [success,    setSuccess]  = useState(false);

  // Champs touchés (validation on blur)
  const [emailTouched, setEmailTouched] = useState(false);
  const [pwdTouched,   setPwdTouched]   = useState(false);
  const [emailFocused, setEmailFocused] = useState(false);
  const [pwdFocused,   setPwdFocused]   = useState(false);

  // Changement de mot de passe obligatoire
  const [mustChange, setMustChange] = useState(false);
  const [newPwd,     setNewPwd]     = useState('');
  const [newPwd2,    setNewPwd2]    = useState('');
  const [cpError,    setCpError]    = useState('');
  const [showNewPwd, setShowNewPwd] = useState(false);

  const emailRef = useRef<HTMLInputElement>(null);
  const returnUrl = searchParams?.get('returnUrl') ?? '/tableau-de-bord';

  useEffect(() => { emailRef.current?.focus(); }, []);

  const triggerShake = useCallback(() => {
    setShake(true);
    setTimeout(() => setShake(false), 500);
  }, []);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (loading) return;
    setEmailTouched(true);
    setPwdTouched(true);
    setError('');
    setLoading(true);

    const result = await login(email, password);

    if (result.success) {
      if (result.mustChangePassword) {
        setMustChange(true);
        setLoading(false);
        return;
      }
      setSuccess(true);
      setTimeout(() => router.push(returnUrl), 350);
    } else {
      setError(result.error ?? 'Identifiants incorrects.');
      triggerShake();
      setLoading(false);
    }
  };

  const handleChangePassword = (e: React.FormEvent) => {
    e.preventDefault();
    setCpError('');
    if (newPwd.length < 8)   { setCpError('8 caractères minimum.'); return; }
    if (newPwd !== newPwd2)  { setCpError('Les deux mots de passe ne correspondent pas.'); return; }
    const res = changePassword(email, password, newPwd);
    if (res.success) {
      setMustChange(false);
      setSuccess(true);
      setTimeout(() => router.push(returnUrl), 350);
    } else {
      setCpError(res.error ?? 'Échec du changement.');
    }
  };

  const loginAs = async (acc: typeof DEMO_ACCOUNTS[0]) => {
    if (loading) return;
    setEmail(acc.email);
    setPassword('dpe2026');
    setError('');
    setLoading(true);
    const result = await login(acc.email, 'dpe2026');
    if (result.success) {
      if (result.mustChangePassword) { setMustChange(true); setLoading(false); return; }
      setSuccess(true);
      setTimeout(() => router.push(returnUrl), 350);
    } else {
      setError(result.error ?? 'Erreur de connexion.');
      triggerShake();
      setLoading(false);
    }
  };

  const emailInvalid = emailTouched && !email.includes('@');
  const pwdInvalid   = pwdTouched && password.length < 4;
  const emailValid   = email.includes('@') && email.length > 5;
  const pwdValid     = password.length >= 4;

  return (
    <div style={{
      minHeight: '100dvh',
      background: 'linear-gradient(150deg, #140830 0%, #2D1167 45%, #3D1A6B 75%, #5A2080 100%)',
      display: 'flex', alignItems: 'stretch', justifyContent: 'center',
      fontFamily: '-apple-system, BlinkMacSystemFont, "SF Pro Text", "Segoe UI", system-ui, sans-serif',
      position: 'relative', overflow: 'hidden',
    }}>
      {/* Accent bar */}
      <div style={{ position: 'fixed', top: 0, left: 0, right: 0, height: 3, zIndex: 100,
        background: 'linear-gradient(90deg, #F58220 0%, #E2003B 48%, #7A2D8B 100%)' }}/>

      {/* Orbs décoratifs */}
      <div style={{ position: 'absolute', top: -120, right: -80, width: 380, height: 380, borderRadius: '50%', pointerEvents: 'none',
        background: 'radial-gradient(circle, rgba(244,121,32,0.15) 0%, transparent 65%)' }}/>
      <div style={{ position: 'absolute', bottom: -80, left: -80, width: 300, height: 300, borderRadius: '50%', pointerEvents: 'none',
        background: 'radial-gradient(circle, rgba(200,32,96,0.12) 0%, transparent 70%)' }}/>
      <div style={{ position: 'absolute', top: '40%', left: '30%', width: 200, height: 200, borderRadius: '50%', pointerEvents: 'none',
        background: 'radial-gradient(circle, rgba(255,255,255,0.03) 0%, transparent 70%)' }}/>

      {/* ═══ PANNEAU GAUCHE — Logo + comptes rapides ═══ */}
      <div className="login-left" style={{
        flex: 1, maxWidth: 500, display: 'flex', flexDirection: 'column',
        alignItems: 'center', justifyContent: 'center', padding: '48px 32px',
      }}>
        {/* Logo + titre */}
        <div style={{ textAlign: 'center', marginBottom: 36 }}>
          <SenelecLogo size={130} />
          <div style={{ fontSize: 10.5, color: 'rgba(255,255,255,0.50)', fontStyle: 'italic', marginTop: 8 }}>
            L&apos;énergie de tous les possibles
          </div>
          <div style={{ marginTop: 16, height: 1, background: 'rgba(255,255,255,0.10)', width: 180, margin: '14px auto 0' }}/>
          <div style={{ marginTop: 10, fontSize: 10.5, fontWeight: 700, letterSpacing: '0.18em',
            color: 'rgba(255,255,255,0.38)', textTransform: 'uppercase' }}>
            SIGEPP · DPE · V1.0
          </div>
        </div>

        {/* Comptes rapides */}
        <div style={{ width: '100%', maxWidth: 420 }}>
          <div style={{ fontSize: 9.5, fontWeight: 700, color: 'rgba(255,255,255,0.32)',
            letterSpacing: '0.10em', textTransform: 'uppercase', marginBottom: 8 }}>
            Connexion rapide — un clic
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4,
            maxHeight: 420, overflowY: 'auto', paddingRight: 4 }}>
            {DEMO_ACCOUNTS.map(acc => {
              const role   = ROLES[acc.role];
              const isSel  = email === acc.email;
              return (
                <button key={acc.id} onClick={() => loginAs(acc)} disabled={loading}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 10, padding: '9px 12px',
                    background: isSel ? 'rgba(244,121,32,0.18)' : 'rgba(255,255,255,0.04)',
                    border: `1px solid ${isSel ? 'rgba(244,121,32,0.50)' : 'rgba(255,255,255,0.07)'}`,
                    borderRadius: 10, cursor: loading ? 'default' : 'pointer',
                    fontFamily: 'inherit', textAlign: 'left',
                    transition: 'all 0.15s ease', opacity: loading ? 0.6 : 1,
                  }}
                  onMouseEnter={e => { if (!isSel && !loading) (e.currentTarget as HTMLElement).style.background = 'rgba(255,255,255,0.08)'; }}
                  onMouseLeave={e => { if (!isSel) (e.currentTarget as HTMLElement).style.background = isSel ? 'rgba(244,121,32,0.18)' : 'rgba(255,255,255,0.04)'; }}
                >
                  <div style={{ width: 32, height: 32, borderRadius: 8, background: acc.avatarColor, flexShrink: 0,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: 10, fontWeight: 800, color: '#fff', letterSpacing: '-0.5px' }}>
                    {acc.initials}
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 12, fontWeight: 700, color: '#fff', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                      {acc.prenom} {acc.nom}
                    </div>
                    <div style={{ fontSize: 10.5, color: 'rgba(255,255,255,0.55)', marginTop: 1 }}>
                      {(acc as { poste?: string }).poste || role.label}
                    </div>
                    <div style={{ fontSize: 9.5, color: 'rgba(255,255,255,0.30)', marginTop: 1, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                      {getDirectionLabel(acc.direction)}
                      {(acc as { departement?: string }).departement ? ` — ${getDepartementLabel((acc as { departement?: string }).departement!)}` : ''}
                    </div>
                  </div>
                  {isSel && (
                    <span style={{ fontSize: 8, background: ORANGE, color: '#fff', borderRadius: 4, padding: '2px 6px', fontWeight: 700, flexShrink: 0 }}>✓</span>
                  )}
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* ═══ PANNEAU DROIT — Formulaire ═══ */}
      <div style={{
        width: '100%', maxWidth: 440, display: 'flex', flexDirection: 'column',
        alignItems: 'center', justifyContent: 'center', padding: '40px 24px',
        background: 'rgba(255,255,255,0.025)',
        borderLeft: '1px solid rgba(255,255,255,0.06)',
        backdropFilter: 'blur(8px)',
      }}>
        <div style={{ width: '100%', maxWidth: 380 }}>
          {/* Card */}
          <div style={{
            background: '#fff', borderRadius: 20, padding: '32px 28px 24px',
            boxShadow: '0 40px 100px rgba(0,0,0,0.50), 0 0 0 1px rgba(255,255,255,0.05)',
            transform: shake ? 'translateX(0)' : undefined,
            animation: shake ? 'shake 0.5s ease' : undefined,
          }}>
            {/* Logo mobile */}
            <div className="login-card-logo" style={{ display: 'none', justifyContent: 'center', marginBottom: 18 }}>
              <SenelecLogo size={110} />
            </div>

            {/* Titre */}
            <div style={{ marginBottom: 22 }}>
              <h2 style={{ fontSize: 18, fontWeight: 800, color: PURPLE, margin: 0, letterSpacing: '-0.3px' }}>
                Connexion
              </h2>
              <p style={{ fontSize: 11, color: '#94A3B8', marginTop: 3, marginBottom: 0 }}>
                SIGEPP-DPE · Accès sécurisé JWT / RBAC
              </p>
            </div>

            {/* Erreur */}
            {error && (
              <div role="alert" style={{
                background: '#FEF2F2', border: '1px solid rgba(220,38,38,0.25)',
                borderRadius: 10, padding: '10px 14px', marginBottom: 16,
                fontSize: 12.5, color: '#991B1B', display: 'flex', gap: 8, alignItems: 'flex-start',
              }}>
                <AlertCircle size={14} style={{ flexShrink: 0, marginTop: 1 }} />
                <span>{error}</span>
              </div>
            )}

            <form onSubmit={handleLogin} style={{ display: 'flex', flexDirection: 'column', gap: 14 }} noValidate>
              {/* Email */}
              <div>
                <label style={{ display: 'block', fontSize: 11, fontWeight: 600, color: '#374151',
                  marginBottom: 6, letterSpacing: '0.04em' }}>
                  Email professionnel
                </label>
                <div style={{ position: 'relative' }}>
                  <input
                    ref={emailRef}
                    type="email" value={email}
                    onChange={e => { setEmail(e.target.value); if (error) setError(''); }}
                    onFocus={() => setEmailFocused(true)}
                    onBlur={() => { setEmailFocused(false); setEmailTouched(true); }}
                    placeholder="prenom.nom@dpe.sn"
                    required autoComplete="username"
                    style={inputStyle(emailFocused, emailInvalid, emailValid && !emailFocused)}
                  />
                  {emailValid && !emailFocused && (
                    <CheckCircle2 size={15} color="#16A34A" style={{ position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)' }} />
                  )}
                </div>
                {emailInvalid && (
                  <p style={{ fontSize: 11, color: BORDER_E, margin: '4px 0 0', display: 'flex', alignItems: 'center', gap: 4 }}>
                    <AlertCircle size={11} /> Email invalide
                  </p>
                )}
              </div>

              {/* Mot de passe */}
              <div>
                <label style={{ display: 'block', fontSize: 11, fontWeight: 600, color: '#374151',
                  marginBottom: 6, letterSpacing: '0.04em' }}>
                  Mot de passe
                </label>
                <div style={{ position: 'relative' }}>
                  <input
                    type={showPwd ? 'text' : 'password'} value={password}
                    onChange={e => { setPassword(e.target.value); if (error) setError(''); }}
                    onFocus={() => setPwdFocused(true)}
                    onBlur={() => { setPwdFocused(false); setPwdTouched(true); }}
                    placeholder="••••••••"
                    required autoComplete="current-password"
                    style={inputStyle(pwdFocused, pwdInvalid, pwdValid && !pwdFocused)}
                  />
                  <button type="button" onClick={() => setShowPwd(v => !v)} tabIndex={-1}
                    style={{ position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)',
                      background: 'none', border: 'none', cursor: 'pointer', padding: 2,
                      color: '#94A3B8', display: 'flex', alignItems: 'center' }}
                    aria-label={showPwd ? 'Masquer le mot de passe' : 'Afficher le mot de passe'}>
                    {showPwd ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>
                {pwdInvalid && (
                  <p style={{ fontSize: 11, color: BORDER_E, margin: '4px 0 0', display: 'flex', alignItems: 'center', gap: 4 }}>
                    <AlertCircle size={11} /> Mot de passe trop court
                  </p>
                )}
                <div style={{ fontSize: 10.5, color: '#94A3B8', marginTop: 5 }}>
                  Demo : <b style={{ color: '#374151' }}>dpe2026</b>
                </div>
              </div>

              {/* Bouton */}
              <button type="submit" disabled={loading || success}
                onMouseDown={e => { if (!loading) (e.currentTarget as HTMLElement).style.transform = 'scale(0.97)'; }}
                onMouseUp={e => { (e.currentTarget as HTMLElement).style.transform = 'scale(1)'; }}
                onMouseLeave={e => { (e.currentTarget as HTMLElement).style.transform = 'scale(1)'; }}
                style={{
                  width: '100%', padding: '13px',
                  background: success
                    ? 'linear-gradient(135deg, #15803D 0%, #16A34A 100%)'
                    : loading
                    ? 'rgba(61,26,107,0.55)'
                    : `linear-gradient(135deg, ${PURPLE} 0%, #5A2080 100%)`,
                  color: '#fff', border: 'none', borderRadius: 11,
                  fontSize: 14, fontWeight: 700, cursor: loading || success ? 'default' : 'pointer',
                  display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                  fontFamily: 'inherit', marginTop: 4,
                  boxShadow: loading || success ? 'none' : '0 4px 20px rgba(61,26,107,0.40)',
                  transition: 'all 0.2s ease, transform 0.1s ease',
                  letterSpacing: '0.01em',
                }}>
                {success ? (
                  <><CheckCircle2 size={16} /> Connecté — redirection…</>
                ) : loading ? (
                  <>
                    <span style={{ width: 16, height: 16, borderRadius: '50%',
                      border: '2px solid rgba(255,255,255,0.25)', borderTopColor: '#fff',
                      display: 'inline-block', animation: 'spin 0.7s linear infinite' }} />
                    Authentification…
                  </>
                ) : (
                  <><ArrowRight size={16} /> Se connecter</>
                )}
              </button>

              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
                padding: '6px 10px', background: '#F8FAFC', borderRadius: 8,
                fontSize: 11, color: '#94A3B8' }}>
                <Lock size={11} /> Authentification JWT · SENELEC SIGEPP-DPE V1
              </div>
            </form>
          </div>

          <div style={{ textAlign: 'center', marginTop: 20, color: 'rgba(255,255,255,0.22)', fontSize: 10 }}>
            SENELEC · Direction Principale Équipement (DPE)<br/>
            SIGEPP V1.0 · Juin 2026 · Plateforme RBAC multi-rôles
          </div>
        </div>
      </div>

      {/* ═══ MODALE — Réinitialisation obligatoire ═══ */}
      {mustChange && (
        <div style={{
          position: 'fixed', inset: 0, zIndex: 50,
          background: 'rgba(10,5,30,0.70)', backdropFilter: 'blur(6px)',
          display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20,
        }}>
          <div style={{ background: '#fff', borderRadius: 18, padding: '28px 24px',
            width: '100%', maxWidth: 380, boxShadow: '0 40px 100px rgba(0,0,0,0.55)',
            animation: 'slideUp 0.25s ease' }}>
            <h3 style={{ fontSize: 16, fontWeight: 800, color: PURPLE, margin: 0 }}>
              Mot de passe expiré
            </h3>
            <p style={{ fontSize: 12, color: '#64748B', marginTop: 4 }}>
              Votre mot de passe doit être renouvelé (politique 6 mois). Il ne peut reprendre
              l&apos;un de vos 3 derniers mots de passe.
            </p>
            {cpError && (
              <div style={{ background: '#FEF2F2', border: '1px solid rgba(220,38,38,0.3)',
                borderRadius: 9, padding: '9px 12px', margin: '10px 0',
                fontSize: 12, color: '#991B1B', display: 'flex', gap: 6, alignItems: 'center' }}>
                <AlertCircle size={13} />{cpError}
              </div>
            )}
            <form onSubmit={handleChangePassword} style={{ display: 'flex', flexDirection: 'column', gap: 12, marginTop: 14 }}>
              <div style={{ position: 'relative' }}>
                <input type={showNewPwd ? 'text' : 'password'} value={newPwd}
                  onChange={e => setNewPwd(e.target.value)} required
                  placeholder="Nouveau mot de passe (8 car. min.)" autoComplete="new-password"
                  style={{ width: '100%', padding: '11px 42px 11px 13px', border: '1.5px solid #CBD5E1',
                    borderRadius: 10, fontSize: 13, fontFamily: 'inherit', boxSizing: 'border-box',
                    outline: 'none', transition: 'border-color 0.15s' }}
                  onFocus={e => e.target.style.borderColor = PURPLE}
                  onBlur={e => e.target.style.borderColor = '#CBD5E1'} />
                <button type="button" onClick={() => setShowNewPwd(v => !v)} tabIndex={-1}
                  style={{ position: 'absolute', right: 11, top: '50%', transform: 'translateY(-50%)',
                    background: 'none', border: 'none', cursor: 'pointer', color: '#94A3B8', display: 'flex' }}>
                  {showNewPwd ? <EyeOff size={15} /> : <Eye size={15} />}
                </button>
              </div>
              <input type={showNewPwd ? 'text' : 'password'} value={newPwd2}
                onChange={e => setNewPwd2(e.target.value)} required
                placeholder="Confirmer le nouveau mot de passe" autoComplete="new-password"
                style={{ width: '100%', padding: '11px 13px', border: '1.5px solid #CBD5E1',
                  borderRadius: 10, fontSize: 13, fontFamily: 'inherit', boxSizing: 'border-box',
                  outline: 'none', transition: 'border-color 0.15s' }}
                onFocus={e => e.target.style.borderColor = PURPLE}
                onBlur={e => e.target.style.borderColor = '#CBD5E1'} />
              <button type="submit" style={{ width: '100%', padding: '12px',
                background: `linear-gradient(135deg, ${PURPLE} 0%, #5A2080 100%)`,
                color: '#fff', border: 'none', borderRadius: 10,
                fontSize: 13.5, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit',
                boxShadow: '0 4px 16px rgba(61,26,107,0.35)' }}>
                Réinitialiser et continuer
              </button>
            </form>
          </div>
        </div>
      )}

      <style>{`
        @keyframes spin    { to { transform: rotate(360deg); } }
        @keyframes shake   { 0%,100%{transform:translateX(0)} 15%,45%,75%{transform:translateX(-6px)} 30%,60%,90%{transform:translateX(6px)} }
        @keyframes slideUp { from{opacity:0;transform:translateY(20px)} to{opacity:1;transform:translateY(0)} }
        .login-left { display: flex; }
        .login-card-logo { display: none !important; }
        @media (max-width: 820px) {
          .login-left { display: none !important; }
          .login-card-logo { display: flex !important; }
        }
        button:focus-visible { outline: 2px solid ${PURPLE}; outline-offset: 2px; }
        input:focus-visible  { outline: none; }
        ::-webkit-scrollbar { width: 4px; }
        ::-webkit-scrollbar-track { background: transparent; }
        ::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.15); border-radius: 4px; }
      `}</style>
    </div>
  );
}

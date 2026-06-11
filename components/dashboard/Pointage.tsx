'use client';

/**
 * Pointage.tsx — Bulletins d'heures supplémentaires → UAGL (canvas SENELEC)
 */
import { useMemo, useState } from 'react';
import {
  usePointage, COEFFICIENTS, totalHeures, totalHeuresPonderees, totauxParCoefficient,
  type Bulletin, type Coefficient,
} from '@/lib/pointageStore';
import { useAuth, DEMO_ACCOUNTS, type RoleCode } from '@/lib/authStore';
import { useNotificationStore } from '@/lib/notificationStore';
import { SENELEC_LOGO_DATA_URI } from '@/lib/senelecLogo';
import toast from 'react-hot-toast';
import { Clock, Plus, Trash2, Send, FileDown, CheckCircle2, X, Search } from 'lucide-react';

/** Destinataires (email) d'un rôle donné — pour notifier l'étape suivante du circuit. */
function recipientsForRole(...roles: RoleCode[]): { nom: string; email: string }[] {
  return DEMO_ACCOUNTS.filter(a => roles.includes(a.role)).map(a => ({ nom: `${a.prenom} ${a.nom}`, email: a.email }));
}

const NAVY = '#0E3460';
const MOIS = ['JANVIER', 'FÉVRIER', 'MARS', 'AVRIL', 'MAI', 'JUIN', 'JUILLET', 'AOÛT', 'SEPTEMBRE', 'OCTOBRE', 'NOVEMBRE', 'DÉCEMBRE'];
const STATUTS: Record<string, { label: string; bg: string; fg: string }> = {
  brouillon: { label: 'Brouillon', bg: '#F1F5F9', fg: '#64748B' },
  soumis_cp: { label: 'Soumis au Chef de Projet', bg: '#FFFBEB', fg: '#B45309' },
  soumis_uagl: { label: 'Soumis (Service des Salaires)', bg: '#FFFBEB', fg: '#B45309' },
  valide_cp: { label: 'Validé Chef Projet → Chef Dépt', bg: '#EFF6FF', fg: '#1D4ED8' },
  valide_dept: { label: 'Validé Chef Dépt → Salaires', bg: '#EFF6FF', fg: '#1D4ED8' },
  valide_uagl: { label: 'Traité (Service des Salaires)', bg: '#DCFCE7', fg: '#15803D' },
  rejete: { label: 'Rejeté', bg: '#FEE2E2', fg: '#B91C1C' },
};

export default function Pointage() {
  const { user, isRole } = useAuth();
  const store = usePointage();
  const [selId, setSelId] = useState<string>('');
  const myEmail = (user?.email ?? '').toLowerCase();
  // CIRCUIT OFFICIEL (cf. bulletin SENELEC, signataires ligne 17) :
  // (1) ÉTABLISSEMENT par les agents SOUS le chef de projet, SAUF l'ingénieur ;
  // (2) VALIDATION Chef de Projet ; (3) VALIDATION Chef de Département ;
  // (4) TRAITEMENT FINAL Service des Salaires (via UAGL).
  const canEtablir = isRole('ASSISTANT', 'CONTROLEUR', 'SECRETAIRE', 'CHAUFFEUR', 'ADMIN'); // ≠ ingénieur, ≠ chef de projet
  const canValiderCP = isRole('CHEF_PROJ', 'ADMIN');
  const canValiderDept = isRole('CHEF_DEPT', 'ADMIN');
  const isUAGL = isRole('RESP_LOG', 'ADMIN');

  const [bulletinSearch, setBulletinSearch] = useState('');

  const mesBulletins = useMemo(() => store.bulletins.filter(b => b.auteurEmail === myEmail), [store.bulletins, myEmail]);
  const aValiderCP = useMemo(() => store.bulletins.filter(b => b.statut === 'soumis_cp'), [store.bulletins]);
  const aValiderDept = useMemo(() => store.bulletins.filter(b => b.statut === 'valide_cp'), [store.bulletins]);
  const aTraiterUAGL = useMemo(() => store.bulletins.filter(b => b.statut === 'valide_dept' || b.statut === 'soumis_uagl'), [store.bulletins]);

  const filterBulletins = (list: typeof mesBulletins) => {
    if (!bulletinSearch.trim()) return list;
    const q = bulletinSearch.toLowerCase();
    return list.filter(b =>
      `${b.prenom} ${b.nom}`.toLowerCase().includes(q) ||
      b.mois.toLowerCase().includes(q) ||
      String(b.annee).includes(q) ||
      STATUTS[b.statut]?.label.toLowerCase().includes(q)
    );
  };
  const sel = store.bulletins.find(b => b.id === selId);

  const nouveau = () => {
    const id = store.createBulletin({
      mle: user?.poste?.includes('M') ? '' : '', prenom: user?.prenom ?? '', nom: user?.nom ?? '',
      direction: user?.direction ?? 'DER', departement: user?.departement ?? 'DPD_DISTRIBUTION',
      mois: MOIS[new Date().getMonth()], annee: new Date().getFullYear(), auteurEmail: myEmail,
    });
    setSelId(id); toast.success('Bulletin créé');
  };

  return (
    <div style={{ flex: 1, overflowY: 'auto', padding: '20px 24px', background: '#F4F6F9' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16, flexWrap: 'wrap' }}>
        <div style={{ width: 40, height: 40, borderRadius: 10, background: '#EFF6FF', display: 'grid', placeItems: 'center' }}><Clock size={22} color={NAVY} /></div>
        <div style={{ flex: 1, minWidth: 220 }}>
          <h1 style={{ fontSize: 20, fontWeight: 800, color: '#0F172A', margin: 0 }}>Pointage — Heures supplémentaires</h1>
          <p style={{ fontSize: 12.5, color: '#64748B', margin: '2px 0 0' }}>Bulletin officiel SENELEC · Établissement (agent) → Chef de Projet → Chef de Département → Service des Salaires</p>
        </div>
        {canEtablir && <button onClick={nouveau} style={btnPrimary}><Plus size={15} /> Nouveau bulletin</button>}
      </div>

      <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap' }}>
        {/* Liste */}
        <div style={{ width: 280, flexShrink: 0 }}>
          {/* Search bar */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '6px 8px', marginBottom: 8, borderRadius: 8, border: '1px solid #E2E8F0', background: '#FAFBFC' }}>
            <Search size={13} style={{ color: '#94A3B8', flexShrink: 0 }} />
            <input
              value={bulletinSearch} onChange={e => setBulletinSearch(e.target.value)}
              placeholder="Rechercher un bulletin…"
              style={{ flex: 1, border: 'none', background: 'transparent', fontSize: 12, color: '#334155', outline: 'none' }}
            />
            {bulletinSearch && (
              <button onClick={() => setBulletinSearch('')} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 2, color: '#94A3B8', display: 'flex', alignItems: 'center' }}><X size={11} /></button>
            )}
          </div>

          <SectionTitle>Mes bulletins ({filterBulletins(mesBulletins).length}{bulletinSearch ? `/${mesBulletins.length}` : ''})</SectionTitle>
          {filterBulletins(mesBulletins).length === 0 && <div style={{ color: '#94A3B8', fontSize: 12.5, padding: 8 }}>{bulletinSearch ? 'Aucun résultat.' : 'Aucun bulletin.'}</div>}
          {filterBulletins(mesBulletins).map(b => <BulletinCard key={b.id} b={b} active={b.id === selId} onClick={() => setSelId(b.id)} />)}

          {canValiderCP && filterBulletins(aValiderCP).length > 0 && (
            <>
              <SectionTitle>À valider (Chef de Projet) — {filterBulletins(aValiderCP).length}</SectionTitle>
              {filterBulletins(aValiderCP).map(b => <BulletinCard key={b.id} b={b} active={b.id === selId} onClick={() => setSelId(b.id)} valider />)}
            </>
          )}
          {canValiderDept && filterBulletins(aValiderDept).length > 0 && (
            <>
              <SectionTitle>À valider (Chef de Département) — {filterBulletins(aValiderDept).length}</SectionTitle>
              {filterBulletins(aValiderDept).map(b => <BulletinCard key={b.id} b={b} active={b.id === selId} onClick={() => setSelId(b.id)} valider />)}
            </>
          )}
          {isUAGL && filterBulletins(aTraiterUAGL).length > 0 && (
            <>
              <SectionTitle>À traiter (Service des Salaires) — {filterBulletins(aTraiterUAGL).length}</SectionTitle>
              {filterBulletins(aTraiterUAGL).map(b => <BulletinCard key={b.id} b={b} active={b.id === selId} onClick={() => setSelId(b.id)} valider />)}
            </>
          )}
        </div>

        {/* Détail */}
        <div style={{ flex: 1, minWidth: 320 }}>
          {sel ? <BulletinEditor key={sel.id} b={sel} canEtablir={canEtablir} canValiderCP={canValiderCP} canValiderDept={canValiderDept} isUAGL={isUAGL} userName={`${user?.prenom} ${user?.nom}`} /> : (
            <div style={{ background: '#fff', borderRadius: 12, border: '1px solid #E2E8F0', padding: '36px 28px', textAlign: 'center', color: '#64748B' }}>
              <Clock size={30} color="#CBD5E1" style={{ marginBottom: 10 }} />
              {canEtablir ? (
                <>
                  <div style={{ fontSize: 14, fontWeight: 700, color: '#334155', marginBottom: 4 }}>Aucun bulletin sélectionné</div>
                  <div style={{ fontSize: 12.5, marginBottom: 14 }}>Créez un bulletin d&apos;heures supplémentaires pour commencer la saisie.</div>
                  <button onClick={nouveau} style={btnPrimary}><Plus size={15} /> Nouveau bulletin</button>
                </>
              ) : (canValiderCP || canValiderDept || isUAGL) ? (
                <>
                  <div style={{ fontSize: 14, fontWeight: 700, color: '#334155', marginBottom: 4 }}>File de validation</div>
                  <div style={{ fontSize: 12.5 }}>Sélectionnez un bulletin dans la liste à gauche pour le {isUAGL ? 'traiter (Service des Salaires)' : 'valider'}.</div>
                </>
              ) : (
                <>
                  <div style={{ fontSize: 14, fontWeight: 700, color: '#334155', marginBottom: 4 }}>Aucune action requise</div>
                  <div style={{ fontSize: 12.5 }}>Votre profil n&apos;établit pas et ne valide pas de bulletins d&apos;heures supplémentaires.<br/>Circuit : Agent → Chef de Projet → Chef de Département → Service des Salaires (UAGL).</div>
                </>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function BulletinCard({ b, active, onClick, valider }: { b: Bulletin; active: boolean; onClick: () => void; valider?: boolean }) {
  const cfg = STATUTS[b.statut];
  return (
    <button onClick={onClick} style={{ display: 'block', width: '100%', textAlign: 'left', marginBottom: 6, padding: '10px 12px', borderRadius: 9, border: `1.5px solid ${active ? NAVY : '#E2E8F0'}`, background: active ? '#EFF6FF' : '#fff', cursor: 'pointer', fontFamily: 'inherit' }}>
      <div style={{ fontWeight: 700, fontSize: 13, color: '#0F172A' }}>{b.prenom} {b.nom} {valider ? '' : ''}</div>
      <div style={{ fontSize: 11, color: '#64748B' }}>{b.mois} {b.annee} · {b.lignes.length} ligne(s) · {totalHeuresPonderees(b)}h pond.</div>
      <span style={{ fontSize: 10, fontWeight: 700, padding: '2px 7px', borderRadius: 10, background: cfg.bg, color: cfg.fg, marginTop: 4, display: 'inline-block' }}>{cfg.label}</span>
    </button>
  );
}

function BulletinEditor({ b, canEtablir, canValiderCP, canValiderDept, isUAGL, userName }: { b: Bulletin; canEtablir: boolean; canValiderCP: boolean; canValiderDept: boolean; isUAGL: boolean; userName: string }) {
  const store = usePointage();
  const notifyUser = useNotificationStore(s => s.notifyUser);
  // Seuls les agents établisseurs (sous le chef de projet, hors ingénieur) saisissent/éditent.
  const editable = canEtablir && (b.statut === 'brouillon' || b.statut === 'rejete');

  // Notifie les destinataires de l'étape suivante du circuit.
  const notifyStep = (roles: RoleCode[], title: string, message: string) => {
    recipientsForRole(...roles).forEach(r => notifyUser({
      recipientEmail: r.email, title, message, type: 'info', link: '/pointage', source: 'Pointage', sendMail: true,
    }));
  };
  const who = `${b.prenom} ${b.nom} — ${b.mois} ${b.annee}`;
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [de, setDe] = useState('16:30');
  const [a, setA] = useState('19:00');
  const [projet, setProjet] = useState('');
  const [activite, setActivite] = useState('');
  const [coef, setCoef] = useState<Coefficient>(1.15);

  const heuresFromTime = () => {
    const [h1, m1] = de.split(':').map(Number); const [h2, m2] = a.split(':').map(Number);
    return Math.max(0, Math.round(((h2 * 60 + m2) - (h1 * 60 + m1)) / 6) / 10);
  };

  const ajouter = () => {
    const nb = heuresFromTime();
    if (nb <= 0) { toast.error('Créneau invalide'); return; }
    store.addLigne(b.id, { date, heureDe: de, heureA: a, projet, activite, nbHeures: nb, coefficient: coef, panier: false, sujetion: false, primeConduite: false, deplacement: 0 });
  };

  const totParCoef = totauxParCoefficient(b);

  const exportPDF = () => {
    const w = window.open('', '_blank'); if (!w) return;
    const rows = b.lignes.map(l => `<tr><td>${l.date}</td><td>${l.heureDe}</td><td>${l.heureA}</td><td>${l.projet}</td><td>${l.activite}</td><td style="text-align:center">${l.nbHeures}</td><td style="text-align:center">${l.coefficient}</td><td style="text-align:center">${l.panier ? '✓' : ''}</td><td style="text-align:center">${l.sujetion ? '✓' : ''}</td><td style="text-align:center">${l.primeConduite ? '✓' : ''}</td><td style="text-align:center">${l.deplacement || ''}</td></tr>`).join('');
    w.document.write(`<!DOCTYPE html><html><head><meta charset="utf-8"><title>Bulletin heures sup ${b.prenom} ${b.nom}</title>
    <style>body{font-family:Arial;font-size:11px;padding:24px;color:#1a1a1a}.h{display:flex;align-items:center;gap:14px;border-bottom:3px solid ${NAVY};padding-bottom:12px;margin-bottom:14px}.h img{height:46px}h1{font-size:15px;color:${NAVY};margin:0}table{width:100%;border-collapse:collapse;margin-top:10px}th,td{border:1px solid #94A3B8;padding:4px 6px;font-size:10px}th{background:${NAVY};color:#fff}.tot{font-weight:800;background:#F1F5F9}.sig{margin-top:30px;display:grid;grid-template-columns:1fr 1fr 1fr;gap:20px;text-align:center}.sig div{border-top:1px solid #000;padding-top:6px;font-size:10px}</style></head><body>
    <div class="h"><img src="${SENELEC_LOGO_DATA_URI}"/><div><div style="font-size:9px;color:#64748B">DIRECTION DES RESSOURCES HUMAINES</div><h1>BULLETIN D'HEURES SUPPLÉMENTAIRES</h1><div style="font-size:10px">${b.direction} · ${b.departement} · ${b.mois} ${b.annee}</div></div></div>
    <div style="font-size:11px;margin-bottom:6px"><b>Agent :</b> ${b.prenom} ${b.nom} ${b.mle ? '(MLE ' + b.mle + ')' : ''}</div>
    <table><thead><tr><th>Date</th><th>De</th><th>À</th><th>Projet/ODM</th><th>Activité</th><th>Nb h</th><th>Coef.</th><th>PAN</th><th>SUJ</th><th>PC</th><th>Dépl.</th></tr></thead>
    <tbody>${rows}<tr class="tot"><td colspan="5" style="text-align:right">TOTAL</td><td style="text-align:center">${totalHeures(b)}</td><td colspan="5"></td></tr></tbody></table>
    <div style="margin-top:8px;font-size:11px"><b>Total pondéré :</b> ${totalHeuresPonderees(b)} h ${COEFFICIENTS.map(c => `· ×${c}: ${totParCoef[String(c)] || 0}h`).join(' ')}</div>
    <div class="sig"><div>Chef de Projet</div><div>Chef de Département</div><div>Service des Salaires (UAGL)</div></div>
    </body></html>`);
    w.document.close(); setTimeout(() => w.print(), 350);
  };

  return (
    <div style={{ background: '#fff', borderRadius: 12, border: '1px solid #E2E8F0', overflow: 'hidden' }}>
      {/* En-tête bulletin */}
      <div style={{ padding: '14px 18px', borderBottom: '1px solid #F1F5F9', display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap', background: '#F8FAFC' }}>
        <img src={SENELEC_LOGO_DATA_URI} alt="SENELEC" style={{ height: 34 }} />
        <div style={{ flex: 1, minWidth: 160 }}>
          <div style={{ fontWeight: 800, color: NAVY, fontSize: 14 }}>{b.prenom} {b.nom}</div>
          <div style={{ fontSize: 11.5, color: '#64748B' }}>{b.direction} · {b.departement} · {b.mois} {b.annee}</div>
        </div>
        <button onClick={exportPDF} style={btnGhost}><FileDown size={14} /> PDF</button>
        {editable && <button onClick={() => {
          store.soumettre(b.id, userName);
          notifyStep(['CHEF_PROJ'], 'Bulletin d\'heures à valider', `${who} a soumis un bulletin d'heures supplémentaires — à valider.`);
          toast.success('Bulletin soumis au chef de projet');
        }} disabled={!b.lignes.length} style={{ ...btnPrimary, opacity: b.lignes.length ? 1 : 0.5 }}><Send size={14} /> Soumettre au chef de projet</button>}
      </div>

      {/* Saisie ligne */}
      {editable && (
        <div style={{ padding: 14, display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'flex-end', borderBottom: '1px solid #F1F5F9' }}>
          <Mini label="Date"><input type="date" value={date} onChange={e => setDate(e.target.value)} style={mini} /></Mini>
          <Mini label="De"><input type="time" value={de} onChange={e => setDe(e.target.value)} style={mini} /></Mini>
          <Mini label="À"><input type="time" value={a} onChange={e => setA(e.target.value)} style={mini} /></Mini>
          <Mini label="Projet/ODM"><input value={projet} onChange={e => setProjet(e.target.value)} placeholder="ODM N°…" style={{ ...mini, width: 120 }} /></Mini>
          <Mini label="Activité"><input value={activite} onChange={e => setActivite(e.target.value)} placeholder="Suivi travaux…" style={{ ...mini, width: 140 }} /></Mini>
          <Mini label="Coef."><select value={coef} onChange={e => setCoef(Number(e.target.value) as Coefficient)} style={mini}>{COEFFICIENTS.map(c => <option key={c} value={c}>×{c}</option>)}</select></Mini>
          <button onClick={ajouter} style={btnPrimary}><Plus size={14} /> Ligne ({heuresFromTime()}h)</button>
        </div>
      )}

      {b.statut === 'rejete' && <div style={{ padding: '8px 14px', background: '#FEF2F2', color: '#B91C1C', fontSize: 12 }}>Rejeté : {b.motifRejet}</div>}

      {/* Tableau */}
      <div style={{ overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
          <thead><tr style={{ background: NAVY, color: '#fff', textAlign: 'left' }}>
            <th style={th}>Date</th><th style={th}>De</th><th style={th}>À</th><th style={th}>Projet</th><th style={th}>Activité</th>
            <th style={th}>Nb h</th><th style={th}>Coef.</th><th style={th}>PAN</th><th style={th}>SUJ</th><th style={th}>PC</th>{editable && <th style={th}></th>}
          </tr></thead>
          <tbody>
            {b.lignes.length === 0 ? <tr><td colSpan={editable ? 11 : 10} style={{ padding: 20, textAlign: 'center', color: '#94A3B8' }}>Aucune ligne saisie.</td></tr> :
              b.lignes.map(l => (
                <tr key={l.id} style={{ borderBottom: '1px solid #F1F5F9' }}>
                  <td style={td}>{l.date}</td><td style={td}>{l.heureDe}</td><td style={td}>{l.heureA}</td>
                  <td style={td}>{l.projet}</td><td style={td}>{l.activite}</td>
                  <td style={{ ...td, textAlign: 'center', fontWeight: 700 }}>{l.nbHeures}</td>
                  <td style={{ ...td, textAlign: 'center' }}>×{l.coefficient}</td>
                  {(['panier', 'sujetion', 'primeConduite'] as const).map(k => (
                    <td key={k} style={{ ...td, textAlign: 'center' }}>
                      <input type="checkbox" checked={l[k]} disabled={!editable} onChange={e => store.updateLigne(b.id, l.id, { [k]: e.target.checked } as any)} />
                    </td>
                  ))}
                  {editable && <td style={{ ...td, textAlign: 'center' }}><button onClick={() => store.removeLigne(b.id, l.id)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#EF4444' }}><Trash2 size={13} /></button></td>}
                </tr>
              ))}
          </tbody>
        </table>
      </div>

      {/* Totaux */}
      <div style={{ padding: '12px 18px', background: '#F8FAFC', borderTop: '1px solid #E2E8F0', display: 'flex', gap: 18, flexWrap: 'wrap', fontSize: 12.5 }}>
        <span><b>Total :</b> {totalHeures(b)} h</span>
        <span style={{ color: NAVY, fontWeight: 800 }}>Total pondéré : {totalHeuresPonderees(b)} h</span>
        {COEFFICIENTS.map(c => <span key={c} style={{ color: '#64748B' }}>×{c}: {totParCoef[String(c)] || 0}h</span>)}
      </div>

      {/* Étape 2 — Validation par le CHEF DE PROJET */}
      {canValiderCP && b.statut === 'soumis_cp' && (
        <div style={{ padding: 14, borderTop: '1px solid #E2E8F0', display: 'flex', gap: 8, justifyContent: 'flex-end', alignItems: 'center' }}>
          <span style={{ fontSize: 11.5, color: '#64748B', marginRight: 'auto' }}>Étape 2/4 — Validation Chef de Projet</span>
          <button onClick={() => { const m = prompt('Motif du rejet ?') || 'Non conforme'; store.rejeter(b.id, userName, m); notifyUser({ recipientEmail: b.auteurEmail, title: 'Bulletin rejeté', message: `Votre bulletin (${b.mois} ${b.annee}) a été rejeté : ${m}`, type: 'warning', link: '/pointage', source: 'Pointage', sendMail: true }); toast('Bulletin rejeté', { icon: 'ℹ️' }); }} style={{ ...btnGhost, color: '#B91C1C', borderColor: '#FCA5A5' }}><X size={14} /> Rejeter</button>
          <button onClick={() => { store.valider(b.id, 'valide_cp', userName); notifyStep(['CHEF_DEPT'], 'Bulletin d\'heures à valider', `${who} — validé par le chef de projet, à valider (Chef de Département).`); toast.success('Validé — transmis au chef de département'); }} style={{ ...btnPrimary }}><CheckCircle2 size={14} /> Valider & transmettre au Chef de Département</button>
        </div>
      )}

      {/* Étape 3 — Validation par le CHEF DE DÉPARTEMENT */}
      {canValiderDept && b.statut === 'valide_cp' && (
        <div style={{ padding: 14, borderTop: '1px solid #E2E8F0', display: 'flex', gap: 8, justifyContent: 'flex-end', alignItems: 'center' }}>
          <span style={{ fontSize: 11.5, color: '#64748B', marginRight: 'auto' }}>Étape 3/4 — Validation Chef de Département</span>
          <button onClick={() => { const m = prompt('Motif du rejet ?') || 'Non conforme'; store.rejeter(b.id, userName, m); notifyUser({ recipientEmail: b.auteurEmail, title: 'Bulletin rejeté', message: `Votre bulletin (${b.mois} ${b.annee}) a été rejeté : ${m}`, type: 'warning', link: '/pointage', source: 'Pointage', sendMail: true }); toast('Bulletin rejeté', { icon: 'ℹ️' }); }} style={{ ...btnGhost, color: '#B91C1C', borderColor: '#FCA5A5' }}><X size={14} /> Rejeter</button>
          <button onClick={() => { store.valider(b.id, 'valide_dept', userName); notifyStep(['RESP_LOG'], 'Bulletin d\'heures à traiter', `${who} — validé Chef de Projet & Chef de Département, à traiter (Service des Salaires).`); toast.success('Validé — transmis au Service des Salaires'); }} style={{ ...btnPrimary }}><CheckCircle2 size={14} /> Valider & transmettre au Service des Salaires</button>
        </div>
      )}

      {/* Étape 4 — Traitement final SERVICE DES SALAIRES (via UAGL) */}
      {isUAGL && (b.statut === 'valide_dept' || b.statut === 'soumis_uagl') && (
        <div style={{ padding: 14, borderTop: '1px solid #E2E8F0', display: 'flex', gap: 8, justifyContent: 'flex-end', alignItems: 'center' }}>
          <span style={{ fontSize: 11.5, color: '#64748B', marginRight: 'auto' }}>Étape 4/4 — Traitement Service des Salaires</span>
          <button onClick={() => { const m = prompt('Motif du rejet ?') || 'Non conforme'; store.rejeter(b.id, userName, m); notifyUser({ recipientEmail: b.auteurEmail, title: 'Bulletin rejeté', message: `Votre bulletin (${b.mois} ${b.annee}) a été rejeté : ${m}`, type: 'warning', link: '/pointage', source: 'Pointage', sendMail: true }); toast('Bulletin rejeté', { icon: 'ℹ️' }); }} style={{ ...btnGhost, color: '#B91C1C', borderColor: '#FCA5A5' }}><X size={14} /> Rejeter</button>
          <button onClick={() => { store.valider(b.id, 'valide_uagl', userName); notifyUser({ recipientEmail: b.auteurEmail, title: 'Bulletin traité', message: `Votre bulletin (${b.mois} ${b.annee}) a été traité par le Service des Salaires.`, type: 'success', link: '/pointage', source: 'Pointage', sendMail: true }); toast.success('Bulletin traité (Service des Salaires)'); }} style={{ ...btnPrimary, background: '#16A34A' }}><CheckCircle2 size={14} /> Valider (Service des Salaires)</button>
        </div>
      )}

      {/* Historique */}
      {b.historique.length > 0 && (
        <div style={{ padding: '10px 18px', borderTop: '1px solid #F1F5F9', fontSize: 11, color: '#64748B' }}>
          {b.historique.map((h, i) => <div key={i}>• {h.etape} — {h.par} ({new Date(h.date).toLocaleDateString('fr-FR')})</div>)}
        </div>
      )}
    </div>
  );
}

function SectionTitle({ children }: { children: React.ReactNode }) {
  return <div style={{ fontSize: 10, fontWeight: 800, color: '#94A3B8', textTransform: 'uppercase', letterSpacing: '.05em', margin: '10px 0 6px' }}>{children}</div>;
}
function Mini({ label, children }: { label: string; children: React.ReactNode }) {
  return <div><label style={{ display: 'block', fontSize: 9.5, fontWeight: 700, color: '#94A3B8', textTransform: 'uppercase', marginBottom: 2 }}>{label}</label>{children}</div>;
}

const th: React.CSSProperties = { padding: '8px 10px', fontSize: 10.5, fontWeight: 700 };
const td: React.CSSProperties = { padding: '6px 10px' };
const mini: React.CSSProperties = { padding: '6px 8px', borderRadius: 7, border: '1.5px solid #CBD5E1', fontSize: 12, fontFamily: 'inherit' };
const btnPrimary: React.CSSProperties = { display: 'flex', alignItems: 'center', gap: 6, padding: '8px 14px', background: NAVY, color: '#fff', border: 'none', borderRadius: 8, fontSize: 12.5, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' };
const btnGhost: React.CSSProperties = { display: 'flex', alignItems: 'center', gap: 6, padding: '7px 12px', background: '#fff', color: '#475569', border: '1px solid #E2E8F0', borderRadius: 8, fontSize: 12.5, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' };

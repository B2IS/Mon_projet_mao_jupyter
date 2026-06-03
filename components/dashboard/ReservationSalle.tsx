'use client';

/**
 * ReservationSalle.tsx — Réservation de salles de réunion
 * Demandes adressées aux assistantes de direction, secrétaires et UAGL,
 * qui valident / refusent. Détection des conflits de créneaux.
 */
import { useMemo, useState } from 'react';
import { useMeetingRoom, DESTINATAIRES, type Reservation } from '@/lib/meetingRoomStore';
import { useAuth, DEMO_ACCOUNTS, type RoleCode } from '@/lib/authStore';
import { PERSONNEL_DPE } from '@/lib/dpePersonnel';
import { useNotificationStore } from '@/lib/notificationStore';
import SearchableSelect from '@/components/ui/SearchableSelect';
import toast from 'react-hot-toast';

/** Destinataires réels (nom + e-mail) d'une catégorie de demande. */
function recipientsFor(dest: string): { nom: string; email: string }[] {
  const byRole = (...roles: RoleCode[]) =>
    DEMO_ACCOUNTS.filter(a => roles.includes(a.role)).map(a => ({ nom: `${a.prenom} ${a.nom}`, email: a.email }));
  const byPoste = (re: RegExp) =>
    PERSONNEL_DPE.filter(p => re.test(p.poste || p.fonction || ''))
      .slice(0, 8)
      .map(p => ({ nom: `${p.prenom} ${p.nom}`, email: `${p.prenom}.${p.nom}`.toLowerCase().replace(/\s+/g, '') + '@senelec.sn' }));
  let list: { nom: string; email: string }[] = [];
  if (/uagl/i.test(dest)) list = [...byRole('RESP_LOG'), ...byPoste(/uagl/i)];
  else if (/assistant/i.test(dest)) list = [...byRole('ASSISTANT'), ...byPoste(/assistant/i)];
  else if (/secr[ée]tar/i.test(dest)) list = [...byRole('SECRETAIRE'), ...byPoste(/secr[ée]tair/i)];
  // dédoublonnage par e-mail
  const seen = new Set<string>();
  return list.filter(r => r.email && !seen.has(r.email) && seen.add(r.email));
}
import { CalendarDays, Plus, Check, X, Clock, Users, MapPin, DoorOpen } from 'lucide-react';

const NAVY = '#1B4F8A';
const STATUT_CFG: Record<string, { label: string; bg: string; fg: string }> = {
  demande: { label: 'En attente', bg: '#FFFBEB', fg: '#B45309' },
  confirmee: { label: 'Confirmée', bg: '#DCFCE7', fg: '#15803D' },
  refusee: { label: 'Refusée', bg: '#FEE2E2', fg: '#B91C1C' },
  annulee: { label: 'Annulée', bg: '#F1F5F9', fg: '#64748B' },
};

export default function ReservationSalle() {
  const { user, isRole } = useAuth();
  const store = useMeetingRoom();
  const notify = useNotificationStore(s => s.addNotification);
  const notifyUser = useNotificationStore(s => s.notifyUser);
  const [tab, setTab] = useState<'demande' | 'mes' | 'validation' | 'salles'>('demande');

  // Les valideurs : assistantes de direction, secrétaires, UAGL (RESP_LOG), admin/PMO.
  const isValideur = isRole('ASSISTANT', 'SECRETAIRE', 'RESP_LOG', 'ADMIN', 'PMO', 'CHEF_DEPT', 'DIR_DPE');

  // Form
  const [salleId, setSalleId] = useState(store.salles[0]?.id ?? '');
  const [objet, setObjet] = useState('');
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [hd, setHd] = useState('09:00');
  const [hf, setHf] = useState('10:00');
  const [participants, setParticipants] = useState(6);
  const [destinataire, setDestinataire] = useState(DESTINATAIRES[0]);
  const [destinataireEmail, setDestinataireEmail] = useState(''); // e-mail précis du valideur (optionnel)

  const myEmail = (user?.email ?? '').toLowerCase();
  const mesReservations = useMemo(() => store.reservations.filter(r => r.demandeurEmail === myEmail), [store.reservations, myEmail]);
  const aValider = useMemo(() => store.reservations.filter(r => r.statut === 'demande'), [store.reservations]);

  const submit = () => {
    if (!objet.trim() || !salleId || hf <= hd) { toast.error('Vérifiez l\'objet et le créneau (fin > début).'); return; }
    const res = store.demander({
      salleId, objet: objet.trim(), date, heureDebut: hd, heureFin: hf,
      demandeur: user ? `${user.prenom} ${user.nom}` : 'Utilisateur', demandeurEmail: myEmail,
      participants, destinataire,
    });
    if (!res.ok) {
      const c = res.conflit!;
      toast.error(`Conflit : la salle est déjà réservée de ${c.heureDebut} à ${c.heureFin} (${c.objet}).`);
      return;
    }
    // Notifier RÉELLEMENT chaque destinataire (in-app + e-mail simulé).
    // + l'e-mail précis saisi (la personne à qui on adresse la demande), si fourni.
    const emailTrim = destinataireEmail.trim().toLowerCase();
    const recipients = [...recipientsFor(destinataire)];
    if (/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(emailTrim) && !recipients.some(r => r.email.toLowerCase() === emailTrim)) {
      recipients.unshift({ nom: emailTrim, email: emailTrim });
    }
    recipients.forEach(r => notifyUser({
      recipientEmail: r.email,
      title: `Demande de réservation — ${salleNom(salleId)}`,
      message: `${user ? user.prenom + ' ' + user.nom : 'Un agent'} demande la salle « ${salleNom(salleId)} » le ${date} de ${hd} à ${hf} (${participants} participants) — objet : ${objet}. À valider.`,
      type: 'info', link: '/reservation-salle', source: 'Réservation salle', sendMail: true,
    }));
    notify({ type: 'success', title: 'Réservation salle', message: `Demande « ${objet} » adressée à ${recipients.length} destinataire(s) — ${destinataire}.`, duration: 4500 });
    toast.success(recipients.length ? `Demande envoyée à ${recipients.map(r => r.nom).join(', ')}.` : `Demande enregistrée (aucun destinataire ${destinataire} trouvé).`);
    setObjet(''); setTab('mes');
  };

  const salleNom = (id: string) => store.salles.find(s => s.id === id)?.nom ?? id;

  return (
    <div style={{ flex: 1, overflowY: 'auto', padding: '20px 24px', background: '#F4F6F9' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16 }}>
        <div style={{ width: 40, height: 40, borderRadius: 10, background: '#EFF6FF', display: 'grid', placeItems: 'center' }}><DoorOpen size={22} color={NAVY} /></div>
        <div>
          <h1 style={{ fontSize: 20, fontWeight: 800, color: '#0F172A', margin: 0 }}>Réservation de salles de réunion</h1>
          <p style={{ fontSize: 12.5, color: '#64748B', margin: '2px 0 0' }}>Demandes adressées aux assistantes de direction, secrétaires et à l'UAGL</p>
        </div>
      </div>

      <div style={{ display: 'flex', gap: 4, background: '#E8EDF4', borderRadius: 10, padding: 4, marginBottom: 16, flexWrap: 'wrap' }}>
        {([['demande', 'Nouvelle demande'], ['mes', `Mes réservations (${mesReservations.length})`], ...(isValideur ? [['validation', `À valider (${aValider.length})`], ['salles', `Salles (${store.salles.length})`]] : [])] as [string, string][]).map(([k, l]) => (
          <button key={k} onClick={() => setTab(k as any)} style={{ padding: '8px 14px', borderRadius: 7, border: 'none', background: tab === k ? NAVY : 'transparent', color: tab === k ? '#fff' : '#475569', fontSize: 12.5, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' }}>{l}</button>
        ))}
      </div>

      {/* Nouvelle demande */}
      {tab === 'demande' && (
        <div style={{ background: '#fff', borderRadius: 12, border: '1px solid #E2E8F0', padding: 18, maxWidth: 720 }}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(220px,1fr))', gap: 14 }}>
            <Field label="Salle">
              <select value={salleId} onChange={e => setSalleId(e.target.value)} style={inp}>
                {store.salles.filter(s => s.actif).map(s => <option key={s.id} value={s.id}>{s.nom} ({s.capacite} pl.)</option>)}
              </select>
            </Field>
            <Field label="Objet de la réunion">
              <input value={objet} onChange={e => setObjet(e.target.value)} placeholder="Ex : Comité de pilotage projet…" style={inp} />
            </Field>
            <Field label="Date"><input type="date" value={date} onChange={e => setDate(e.target.value)} style={inp} /></Field>
            <Field label="Participants"><input type="number" min={1} value={participants} onChange={e => setParticipants(Math.max(1, Number(e.target.value)))} style={inp} /></Field>
            <Field label="Heure début"><input type="time" value={hd} onChange={e => setHd(e.target.value)} style={inp} /></Field>
            <Field label="Heure fin"><input type="time" value={hf} onChange={e => setHf(e.target.value)} style={inp} /></Field>
            <Field label="Adresser la demande à">
              <SearchableSelect value={destinataire} onChange={setDestinataire}
                options={DESTINATAIRES as unknown as string[]} searchPlaceholder="Rechercher un destinataire…" />
            </Field>
            <Field label="E-mail du destinataire (optionnel)">
              <input type="email" value={destinataireEmail} onChange={e => setDestinataireEmail(e.target.value)}
                placeholder="ex : assistante.dir@senelec.sn" style={inp} />
            </Field>
          </div>
          {/* Destinataires réels (notifiés in-app + e-mail) */}
          {(() => {
            const emailTrim = destinataireEmail.trim().toLowerCase();
            const rec = [...recipientsFor(destinataire)];
            if (/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(emailTrim) && !rec.some(r => r.email.toLowerCase() === emailTrim)) {
              rec.unshift({ nom: emailTrim, email: emailTrim });
            }
            return (
              <div style={{ marginTop: 12, background: '#F8FAFC', border: '1px solid #E2E8F0', borderRadius: 8, padding: '10px 12px', fontSize: 12 }}>
                <div style={{ fontWeight: 700, color: '#334155', marginBottom: 4 }}>📧 Sera notifié à ({rec.length}) :</div>
                {rec.length === 0 ? <span style={{ color: '#94A3B8' }}>Aucun destinataire référencé pour « {destinataire} ».</span>
                  : <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                      {rec.map(r => <span key={r.email} style={{ background: '#EFF6FF', color: '#1D4ED8', borderRadius: 6, padding: '2px 8px' }}>{r.nom} · {r.email}</span>)}
                    </div>}
              </div>
            );
          })()}
          <div style={{ marginTop: 16, display: 'flex', justifyContent: 'flex-end' }}>
            <button onClick={submit} style={btnPrimary}><Plus size={15} /> Envoyer la demande</button>
          </div>
        </div>
      )}

      {/* Mes réservations */}
      {tab === 'mes' && <ReservList list={mesReservations} salleNom={salleNom} onAnnuler={id => store.annuler(id)} canCancel />}

      {/* À valider */}
      {tab === 'validation' && isValideur && (
        <ReservList list={aValider} salleNom={salleNom}
          onConfirm={id => { store.confirmer(id, user ? `${user.prenom} ${user.nom}` : 'Valideur'); toast.success('Réservation confirmée'); }}
          onRefuse={id => { const m = prompt('Motif du refus ?') || 'Indisponible'; store.refuser(id, user ? `${user.prenom} ${user.nom}` : 'Valideur', m); toast('Réservation refusée', { icon: 'ℹ️' }); }}
        />
      )}

      {/* Gestion des salles (éditable) */}
      {tab === 'salles' && isValideur && <SallesPanel />}
    </div>
  );
}

/* ─── Gestion des salles (ajout / édition / suppression) ─────────────────── */
function SallesPanel() {
  const store = useMeetingRoom();
  const [nom, setNom] = useState('');
  const [capacite, setCapacite] = useState(10);
  const [localisation, setLocalisation] = useState('Siège DPE');
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      <div style={{ background: '#fff', borderRadius: 12, border: '1px solid #E2E8F0', padding: 14, display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'flex-end' }}>
        <div style={{ flex: 2, minWidth: 180 }}><label style={lbl2}>Nom de la salle</label><input value={nom} onChange={e => setNom(e.target.value)} placeholder="Ex : Salle de réunion DIT" style={inp} /></div>
        <div style={{ width: 110 }}><label style={lbl2}>Capacité</label><input type="number" min={1} value={capacite} onChange={e => setCapacite(Math.max(1, Number(e.target.value)))} style={inp} /></div>
        <div style={{ flex: 1, minWidth: 160 }}><label style={lbl2}>Localisation</label><input value={localisation} onChange={e => setLocalisation(e.target.value)} style={inp} /></div>
        <button onClick={() => { if (!nom.trim()) return; store.addSalle({ nom: nom.trim(), capacite, localisation, equipements: [], actif: true }); setNom(''); toast.success('Salle ajoutée'); }} disabled={!nom.trim()} style={{ ...btnPrimary, opacity: nom.trim() ? 1 : 0.5 }}>+ Ajouter</button>
      </div>
      <div style={{ background: '#fff', borderRadius: 12, border: '1px solid #E2E8F0', overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12.5 }}>
          <thead><tr style={{ textAlign: 'left', background: '#F8FAFC', color: '#64748B', borderBottom: '2px solid #E2E8F0' }}>
            <th style={{ padding: '8px 10px' }}>Nom</th><th style={{ padding: '8px 10px' }}>Capacité</th><th style={{ padding: '8px 10px' }}>Localisation</th><th style={{ padding: '8px 10px', textAlign: 'center' }}>Active</th><th style={{ padding: '8px 10px', textAlign: 'center' }}>Suppr.</th>
          </tr></thead>
          <tbody>
            {store.salles.map(s => (
              <tr key={s.id} style={{ borderBottom: '1px solid #F1F5F9' }}>
                <td style={{ padding: '6px 10px' }}><input value={s.nom} onChange={e => store.updateSalle(s.id, { nom: e.target.value })} style={{ ...inp, padding: '5px 8px', fontSize: 12.5 }} /></td>
                <td style={{ padding: '6px 10px' }}><input type="number" min={1} value={s.capacite} onChange={e => store.updateSalle(s.id, { capacite: Math.max(1, Number(e.target.value)) })} style={{ ...inp, width: 70, padding: '5px 8px' }} /></td>
                <td style={{ padding: '6px 10px' }}><input value={s.localisation} onChange={e => store.updateSalle(s.id, { localisation: e.target.value })} style={{ ...inp, padding: '5px 8px', fontSize: 12.5 }} /></td>
                <td style={{ padding: '6px 10px', textAlign: 'center' }}><input type="checkbox" checked={s.actif} onChange={e => store.updateSalle(s.id, { actif: e.target.checked })} /></td>
                <td style={{ padding: '6px 10px', textAlign: 'center' }}><button onClick={() => { if (confirm(`Supprimer « ${s.nom} » ?`)) { store.removeSalle(s.id); toast.success('Salle supprimée'); } }} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#EF4444' }}>🗑</button></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
const lbl2: React.CSSProperties = { display: 'block', fontSize: 10, fontWeight: 700, color: '#64748B', textTransform: 'uppercase', marginBottom: 4 };

function ReservList({ list, salleNom, onConfirm, onRefuse, onAnnuler, canCancel }: {
  list: Reservation[]; salleNom: (id: string) => string;
  onConfirm?: (id: string) => void; onRefuse?: (id: string) => void; onAnnuler?: (id: string) => void; canCancel?: boolean;
}) {
  if (list.length === 0) return <div style={{ textAlign: 'center', padding: 40, color: '#94A3B8' }}>Aucune réservation.</div>;
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      {list.map(r => {
        const cfg = STATUT_CFG[r.statut];
        return (
          <div key={r.id} style={{ background: '#fff', borderRadius: 12, border: '1px solid #E2E8F0', padding: 14, display: 'flex', gap: 14, alignItems: 'center', flexWrap: 'wrap' }}>
            <div style={{ flex: 1, minWidth: 220 }}>
              <div style={{ fontWeight: 700, fontSize: 14, color: '#0F172A' }}>{r.objet}</div>
              <div style={{ fontSize: 12, color: '#64748B', marginTop: 3, display: 'flex', gap: 14, flexWrap: 'wrap' }}>
                <span><MapPin size={11} style={{ verticalAlign: -1 }} /> {salleNom(r.salleId)}</span>
                <span><CalendarDays size={11} style={{ verticalAlign: -1 }} /> {r.date}</span>
                <span><Clock size={11} style={{ verticalAlign: -1 }} /> {r.heureDebut}–{r.heureFin}</span>
                <span><Users size={11} style={{ verticalAlign: -1 }} /> {r.participants}</span>
              </div>
              <div style={{ fontSize: 11, color: '#94A3B8', marginTop: 2 }}>
                Demandeur : {r.demandeur} · Adressé à : {r.destinataire}{r.traitePar ? ` · Traité par ${r.traitePar}` : ''}{r.motifRefus ? ` · Motif : ${r.motifRefus}` : ''}
              </div>
            </div>
            <span style={{ fontSize: 11, fontWeight: 700, padding: '3px 10px', borderRadius: 20, background: cfg.bg, color: cfg.fg }}>{cfg.label}</span>
            {r.statut === 'demande' && onConfirm && (
              <div style={{ display: 'flex', gap: 6 }}>
                <button onClick={() => onConfirm(r.id)} title="Confirmer" style={{ ...iconBtn, color: '#15803D', borderColor: '#86EFAC' }}><Check size={15} /></button>
                <button onClick={() => onRefuse?.(r.id)} title="Refuser" style={{ ...iconBtn, color: '#B91C1C', borderColor: '#FCA5A5' }}><X size={15} /></button>
              </div>
            )}
            {canCancel && (r.statut === 'demande' || r.statut === 'confirmee') && onAnnuler && (
              <button onClick={() => onAnnuler(r.id)} style={{ ...iconBtn, fontSize: 11, width: 'auto', padding: '6px 10px', fontWeight: 700 }}>Annuler</button>
            )}
          </div>
        );
      })}
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <div><label style={{ display: 'block', fontSize: 10, fontWeight: 700, color: '#64748B', textTransform: 'uppercase', marginBottom: 4 }}>{label}</label>{children}</div>;
}

const inp: React.CSSProperties = { width: '100%', padding: '8px 10px', borderRadius: 8, border: '1.5px solid #CBD5E1', fontSize: 13, fontFamily: 'inherit', boxSizing: 'border-box' };
const btnPrimary: React.CSSProperties = { display: 'flex', alignItems: 'center', gap: 6, padding: '9px 18px', background: NAVY, color: '#fff', border: 'none', borderRadius: 8, fontSize: 13, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' };
const iconBtn: React.CSSProperties = { width: 34, height: 34, borderRadius: 8, border: '1px solid #E2E8F0', background: '#fff', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' };

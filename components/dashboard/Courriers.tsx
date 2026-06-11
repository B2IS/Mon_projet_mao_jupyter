'use client';

import { useState, useRef } from 'react';
import {
  Mail, Send, Search, Plus, X, ChevronRight, CheckCircle, Clock,
  AlertCircle, FileText, Filter, Paperclip, Eye, Tag, Archive, GitBranch, FolderOpen,
} from 'lucide-react';
import { useRouter } from 'next/navigation';
import toast from 'react-hot-toast';
import { useProjectStore } from '@/lib/projectStore';
import { useParapheurStore, type ParapheurDossier } from '@/lib/parapheurStore';
import { useNotificationStore } from '@/lib/notificationStore';
import { TEST_USERS } from '@/lib/authStore';
import SearchableSelect from '@/components/ui/SearchableSelect';
import CreateWorkflowModal, { type WorkflowSource } from '@/components/ui/CreateWorkflowModal';
import DocumentAnnotator from '@/components/ui/DocumentAnnotator';

/** Annuaire DPE (profils réels + e-mails) pour imputer un courrier au bon agent. */
const ANNUAIRE_DPE = (() => {
  const seen = new Set<string>();
  return TEST_USERS
    .filter(u => u.email && !seen.has(u.email.toLowerCase()) && seen.add(u.email.toLowerCase()))
    .map(u => ({ value: u.email, label: `${u.prenom} ${u.nom}`, sub: `${u.poste ?? u.role} · ${u.email}`, keywords: `${u.role} ${u.poste ?? ''}` }))
    .sort((a, b) => a.label.localeCompare(b.label, 'fr'));
})();
const labelForEmail = (email: string) => ANNUAIRE_DPE.find(a => a.value === email)?.label ?? email;

/* ═══════════════════════════════════════════════════════════════════════
   MOCK DATA
═══════════════════════════════════════════════════════════════════════ */
type PrioriteCourrier = 'URGENT' | 'NORMAL' | 'INFO';
type StatutEntrant   = 'À QUALIFIER' | 'QUALIFIÉ' | 'DIFFUSÉ';
type StatutSortant   = 'Brouillon' | 'En attente signature' | 'Envoyé' | 'Accusé réception';

/** Pièce jointe RÉELLE d'un courrier (fichier en base64) — annotable + circulable. */
export interface CourrierPiece { nom: string; ext: string; url: string; taille: string }

interface CourrierEntrant {
  id: string;
  num: string;
  expediteur: string;
  objet: string;
  recu: string;
  priorite: PrioriteCourrier;
  statut: StatutEntrant;
  pieceJointe: boolean;
  pieces?: CourrierPiece[];   // documents réels joints (base64) — annotation + workflow
  impute?: string;        // nom du profil chargé du traitement
  imputeEmail?: string;   // e-mail du profil (notification réelle)
  imputeNotes?: string;   // instructions de traitement
}

const extFromName = (name: string): string => {
  const e = (name.split('.').pop() ?? 'pdf').toLowerCase();
  return ['png', 'jpg', 'jpeg', 'gif', 'bmp', 'webp'].includes(e) ? 'png'
    : ['doc', 'docx'].includes(e) ? 'docx'
    : ['xls', 'xlsx', 'csv'].includes(e) ? 'xlsx'
    : ['dwg', 'dxf', 'dgn'].includes(e) ? 'dwg' : e === 'pdf' ? 'pdf' : 'pdf';
};

interface CourrierSortant {
  id: string;
  num: string;
  destinataire: string;
  objet: string;
  date: string;
  statut: StatutSortant;
}

interface ANO {
  id: string;
  ref: string;
  projet: string;
  bailleur: string;
  type: string;
  dateEnvoi: string;
  sla: number;
  jRestants: number;
  statut: string;
}

const ENTRANTS: CourrierEntrant[] = [
  { id: 'e1', num: 'ENT-2026-0412', expediteur: 'MEPC / Direction Générale', objet: 'Demande de rapport trimestriel avancement projets ruraux électrification phase III', recu: '24/05/2026 09:15', priorite: 'URGENT', statut: 'À QUALIFIER', pieceJointe: true, pieces: [{ nom: 'Rapport-T1-2026-MEPC.pdf', ext: 'pdf', url: '', taille: '2.4 MB' }] },
  { id: 'e2', num: 'ENT-2026-0411', expediteur: 'Banque Mondiale – TTL', objet: 'Mission de supervision Juillet 2026 – planning et documents à préparer', recu: '23/05/2026 14:30', priorite: 'URGENT', statut: 'QUALIFIÉ', pieceJointe: true, pieces: [{ nom: 'Planning-Mission-BM-Juillet2026.pdf', ext: 'pdf', url: '', taille: '1.1 MB' }, { nom: 'Checklist-documents.xlsx', ext: 'xlsx', url: '', taille: '280 KB' }] },
  { id: 'e3', num: 'ENT-2026-0410', expediteur: 'Préfecture de Tambacounda', objet: 'Autorisation de travaux – Réseau BT zone rurale Koumpentoum', recu: '22/05/2026 10:00', priorite: 'NORMAL', statut: 'QUALIFIÉ', pieceJointe: false },
  { id: 'e4', num: 'ENT-2026-0409', expediteur: 'Ministère de l\'Énergie', objet: 'Circulaire n°2026-018 – Nouvelles directives passation de marchés PUDC', recu: '21/05/2026 08:45', priorite: 'NORMAL', statut: 'DIFFUSÉ', pieceJointe: true, pieces: [{ nom: 'Circulaire-2026-018-PUDC.pdf', ext: 'pdf', url: '', taille: '892 KB' }] },
  { id: 'e5', num: 'ENT-2026-0408', expediteur: 'AFD – Bureau Dakar', objet: 'Transmission relevé de dépenses C8 – Programme électrification rurale', recu: '20/05/2026 16:20', priorite: 'URGENT', statut: 'DIFFUSÉ', pieceJointe: true, pieces: [{ nom: 'Releve-depenses-C8.pdf', ext: 'pdf', url: '', taille: '3.2 MB' }, { nom: 'Annexe-comptable.xlsx', ext: 'xlsx', url: '', taille: '445 KB' }] },
  { id: 'e6', num: 'ENT-2026-0407', expediteur: 'Entreprise GTSEN', objet: 'Situation mensuelle chantier lot 3 – Région de Kolda', recu: '19/05/2026 11:00', priorite: 'NORMAL', statut: 'QUALIFIÉ', pieceJointe: true, pieces: [{ nom: 'Situation-chantier-Lot3-Mai2026.pdf', ext: 'pdf', url: '', taille: '5.8 MB' }] },
  { id: 'e7', num: 'ENT-2026-0406', expediteur: 'BEI – Luxembourg', objet: 'Demande de no-objection – Révision plan de passation de marchés 2026', recu: '18/05/2026 09:30', priorite: 'URGENT', statut: 'À QUALIFIER', pieceJointe: false },
  { id: 'e8', num: 'ENT-2026-0405', expediteur: 'Gouvernance locale – Saint-Louis', objet: 'Compte rendu réunion comité de pilotage – Projet PERAL Saint-Louis', recu: '17/05/2026 15:10', priorite: 'INFO', statut: 'DIFFUSÉ', pieceJointe: true, pieces: [{ nom: 'CR-COPIL-PERAL-Saint-Louis.pdf', ext: 'pdf', url: '', taille: '1.6 MB' }] },
];

const SORTANTS: CourrierSortant[] = [
  { id: 's1', num: 'SOR-2026-0187', destinataire: 'MEPC / Direction Générale', objet: 'Réponse rapport trimestriel T1-2026 – DPE SENELEC', date: '24/05/2026', statut: 'Brouillon' },
  { id: 's2', num: 'SOR-2026-0186', destinataire: 'Banque Mondiale', objet: 'Transmission PV réception partielle lot 2 – PUDC phase II', date: '22/05/2026', statut: 'En attente signature' },
  { id: 's3', num: 'SOR-2026-0185', destinataire: 'AFD – Bureau Dakar', objet: 'Rapport financier semestriel – Programme ER-SEN-2023', date: '20/05/2026', statut: 'Envoyé' },
  { id: 's4', num: 'SOR-2026-0184', destinataire: 'Entreprise SAER-Elec', objet: 'Mise en demeure – Retard livraison équipements HTA', date: '18/05/2026', statut: 'Accusé réception' },
  { id: 's5', num: 'SOR-2026-0183', destinataire: 'Préfecture Kolda', objet: 'Demande autorisation voirie – Travaux ligne HTA Vélingara', date: '16/05/2026', statut: 'Accusé réception' },
];

const ANOS: ANO[] = [
  { id: 'a1', ref: 'ANO-BM-2026-031', projet: 'PUDC Phase III', bailleur: 'Banque Mondiale', type: 'Passation Marché', dateEnvoi: '10/05/2026', sla: 21, jRestants: 7, statut: 'En cours' },
  { id: 'a2', ref: 'ANO-AFD-2026-018', projet: 'PERAL Saint-Louis', bailleur: 'AFD', type: 'Marché Travaux', dateEnvoi: '05/05/2026', sla: 14, jRestants: -5, statut: 'En retard' },
  { id: 'a3', ref: 'ANO-BEI-2026-009', projet: 'PERACOD II', bailleur: 'BEI', type: 'Plan PPM', dateEnvoi: '12/05/2026', sla: 30, jRestants: 18, statut: 'En cours' },
  { id: 'a4', ref: 'ANO-BM-2026-028', projet: 'PUDC Phase II', bailleur: 'Banque Mondiale', type: 'Avenant Contrat', dateEnvoi: '01/05/2026', sla: 21, jRestants: 0, statut: 'Approuvé' },
  { id: 'a5', ref: 'ANO-BADEA-2026-005', projet: 'Electrif. Rurales Casamance', bailleur: 'BADEA', type: 'Etude environnement', dateEnvoi: '08/05/2026', sla: 30, jRestants: 14, statut: 'En cours' },
];

/* ═══════════════════════════════════════════════════════════════════════
   HELPERS
═══════════════════════════════════════════════════════════════════════ */
function pillPriorite(p: PrioriteCourrier) {
  if (p === 'URGENT') return <span className="pill pill-ko">{p}</span>;
  if (p === 'NORMAL') return <span className="pill pill-info">{p}</span>;
  return <span className="pill pill-navy">{p}</span>;
}

function pillStatutEntrant(s: StatutEntrant) {
  if (s === 'À QUALIFIER') return <span className="pill pill-warn">{s}</span>;
  if (s === 'QUALIFIÉ')    return <span className="pill pill-info">{s}</span>;
  return <span className="pill pill-ok">{s}</span>;
}

function pillStatutSortant(s: StatutSortant) {
  if (s === 'Brouillon')            return <span className="pill pill-navy">{s}</span>;
  if (s === 'En attente signature') return <span className="pill pill-warn">{s}</span>;
  if (s === 'Envoyé')               return <span className="pill pill-info">{s}</span>;
  return <span className="pill pill-ok">{s}</span>;
}

function pillANO(s: string) {
  if (s === 'En retard') return <span className="pill pill-ko">{s}</span>;
  if (s === 'Approuvé')  return <span className="pill pill-ok">{s}</span>;
  return <span className="pill pill-warn">{s}</span>;
}

/* ═══════════════════════════════════════════════════════════════════════
   PANEL QUALIFIER (slide-in)
═══════════════════════════════════════════════════════════════════════ */
function QualifierPanel({ courrier, onClose, onConfirm }: {
  courrier: CourrierEntrant; onClose: () => void;
  onConfirm: (id: string, data: { imputeEmail: string; impute: string; urgence: PrioriteCourrier; notes: string }) => void;
}) {
  const [destinataire, setDestinataire] = useState('');  // = e-mail du profil
  const [urgence, setUrgence] = useState<PrioriteCourrier>('NORMAL');
  const [notes, setNotes] = useState('');

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 200, display: 'flex' }} onClick={onClose}>
      <div style={{ flex: 1 }} />
      <div
        style={{ width: 380, background: 'var(--bg-card)', borderLeft: '1px solid var(--border-2)', boxShadow: '-4px 0 24px rgba(14,52,96,0.12)', display: 'flex', flexDirection: 'column', height: '100%' }}
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div style={{ padding: '14px 16px', borderBottom: '1px solid var(--border-2)', background: 'var(--navy)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <div style={{ color: '#fff', fontWeight: 700, fontSize: 13 }}>Qualifier le courrier</div>
            <div style={{ color: 'rgba(255,255,255,0.65)', fontSize: 10 }}>{courrier.num}</div>
          </div>
          <button onClick={onClose} aria-label="Fermer le panneau" className="btn btn-ghost btn-xs" style={{ color: '#fff', borderColor: 'rgba(255,255,255,0.3)' }}><X size={13} /></button>
        </div>

        {/* Objet */}
        <div style={{ padding: '12px 16px', background: 'var(--bg)', borderBottom: '1px solid var(--border-2)' }}>
          <div className="kpi-label" style={{ marginBottom: 4 }}>Objet</div>
          <div style={{ fontSize: 12, color: 'var(--text)', lineHeight: 1.4 }}>{courrier.objet}</div>
          <div style={{ marginTop: 6, fontSize: 11, color: 'var(--muted)' }}>De : <strong>{courrier.expediteur}</strong> · {courrier.recu}</div>
        </div>

        {/* Formulaire */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '16px', display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div className="form-group">
            <label className="form-label">Imputer à (profil chargé du traitement) *</label>
            <SearchableSelect value={destinataire} onChange={setDestinataire} options={ANNUAIRE_DPE}
              placeholder="Rechercher un agent DPE…" searchPlaceholder="Nom, poste, e-mail…" />
            <div style={{ fontSize: 10, color: 'var(--muted)', marginTop: 4 }}>L&apos;agent sélectionné sera notifié (in-app + e-mail) et le courrier entrera dans son parapheur.</div>
          </div>
          <div className="form-group">
            <label className="form-label">Niveau d'urgence</label>
            <select className="form-input" value={urgence} onChange={e => setUrgence(e.target.value as PrioriteCourrier)}>
              <option value="URGENT">URGENT</option>
              <option value="NORMAL">NORMAL</option>
              <option value="INFO">INFO</option>
            </select>
          </div>
          <div className="form-group">
            <label className="form-label">Notes de qualification</label>
            <textarea className="form-input" rows={4} value={notes} onChange={e => setNotes(e.target.value)} placeholder="Instructions, contexte, points d'attention..." style={{ resize: 'vertical' }} />
          </div>
        </div>

        {/* Footer */}
        <div style={{ padding: '12px 16px', borderTop: '1px solid var(--border-2)', display: 'flex', gap: 8 }}>
          <button className="btn btn-ghost btn-sm" onClick={onClose} style={{ flex: 1 }}>Annuler</button>
          <button className="btn btn-primary btn-sm" style={{ flex: 2 }} disabled={!destinataire}
            onClick={() => { onConfirm(courrier.id, { imputeEmail: destinataire, impute: labelForEmail(destinataire), urgence, notes }); onClose(); }}>
            <CheckCircle size={12} /> Imputer & Diffuser
          </button>
        </div>
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════════
   MODALE RÉUTILISABLE — Nouveau courrier (entrant · sortant · ANO)
═══════════════════════════════════════════════════════════════════════ */
export interface NouveauCourrierData {
  sens: 'entrant' | 'sortant' | 'ano';
  tiers: string; objet: string; priorite: PrioriteCourrier;
  typeAno: string; sla: number; files: CourrierPiece[];
}
function NouveauCourrierModal({ sens, onClose, onCreate }: {
  sens: 'entrant' | 'sortant' | 'ano';
  onClose: () => void;
  onCreate: (d: NouveauCourrierData) => void;
}) {
  const [tiers, setTiers] = useState('');
  const [objet, setObjet] = useState('');
  const [priorite, setPriorite] = useState<PrioriteCourrier>('NORMAL');
  const [typeAno, setTypeAno] = useState('Passation Marché');
  const [sla, setSla] = useState(21);
  const [files, setFiles] = useState<CourrierPiece[]>([]);
  const fileRef = useRef<HTMLInputElement | null>(null);

  const titre = sens === 'entrant' ? 'Nouveau courrier entrant'
    : sens === 'sortant' ? 'Nouveau courrier sortant'
    : 'Nouvel ANO (Avis de Non-Objection)';
  const tiersLabel = sens === 'entrant' ? 'Expéditeur' : sens === 'sortant' ? 'Destinataire' : 'Bailleur';
  const objetLabel = sens === 'ano' ? 'Projet concerné' : 'Objet du courrier';
  const valid = tiers.trim() !== '' && objet.trim() !== '';

  const onFiles = (e: React.ChangeEvent<HTMLInputElement>) => {
    const fs = e.target.files; if (!fs || !fs.length) return;
    Array.from(fs).forEach(f => {
      const sizeKb = f.size / 1024;
      const taille = sizeKb > 1024 ? `${(sizeKb / 1024).toFixed(1)} Mo` : `${Math.round(sizeKb)} Ko`;
      const r = new FileReader();
      const add = (url: string) => setFiles(p => [...p, { nom: f.name, ext: extFromName(f.name), url, taille }]);
      r.onload = () => add(typeof r.result === 'string' ? r.result : URL.createObjectURL(f));
      r.onerror = () => add(URL.createObjectURL(f));
      r.readAsDataURL(f);
    });
    e.target.value = '';
  };

  const lab: React.CSSProperties = { fontSize: 10.5, fontWeight: 700, color: '#64748B', textTransform: 'uppercase', display: 'block', margin: '10px 0 4px' };

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 600, background: 'rgba(15,23,42,0.5)', backdropFilter: 'blur(3px)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }} onClick={onClose}>
      <div style={{ width: 460, background: '#fff', borderRadius: 12, boxShadow: '0 24px 64px rgba(0,0,0,0.3)', padding: 22 }} onClick={e => e.stopPropagation()}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
          <div style={{ fontSize: 16, fontWeight: 800, color: 'var(--navy)' }}>{titre}</div>
          <button onClick={onClose} aria-label="Fermer la fenêtre" style={{ border: 'none', background: 'none', cursor: 'pointer', color: '#94A3B8' }}><X size={18} /></button>
        </div>

        <label style={lab}>{tiersLabel} *</label>
        <input value={tiers} onChange={e => setTiers(e.target.value)} placeholder={sens === 'entrant' ? 'Ex : Ministère de l\'Énergie' : sens === 'sortant' ? 'Ex : Banque Mondiale' : 'Ex : AFD'}
          className="form-input" style={{ width: '100%', boxSizing: 'border-box' }} />

        <label style={lab}>{objetLabel} *</label>
        <input value={objet} onChange={e => setObjet(e.target.value)} placeholder={sens === 'ano' ? 'Ex : PUDC Phase III' : 'Ex : Transmission rapport trimestriel T2-2026'}
          className="form-input" style={{ width: '100%', boxSizing: 'border-box' }} />

        {sens !== 'ano' ? (
          <>
            <label style={lab}>Priorité</label>
            <select value={priorite} onChange={e => setPriorite(e.target.value as PrioriteCourrier)} className="form-input" style={{ width: '100%' }}>
              <option value="URGENT">URGENT</option><option value="NORMAL">NORMAL</option><option value="INFO">INFO</option>
            </select>
          </>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 110px', gap: 10 }}>
            <div>
              <label style={lab}>Type d&apos;ANO</label>
              <select value={typeAno} onChange={e => setTypeAno(e.target.value)} className="form-input" style={{ width: '100%' }}>
                {['Passation Marché', 'Marché Travaux', 'Avenant Contrat', 'Plan PPM', 'Etude environnement'].map(t => <option key={t} value={t}>{t}</option>)}
              </select>
            </div>
            <div>
              <label style={lab}>SLA (jours)</label>
              <input type="number" min={1} value={sla} onChange={e => setSla(Math.max(1, Number(e.target.value)))} className="form-input" style={{ width: '100%', boxSizing: 'border-box' }} />
            </div>
          </div>
        )}

        {/* Pièces jointes */}
        <label style={lab}>Documents joints</label>
        <input ref={fileRef} type="file" multiple style={{ display: 'none' }} onChange={onFiles}
          accept=".pdf,.doc,.docx,.xls,.xlsx,.csv,.txt,.png,.jpg,.jpeg,.dwg,.dxf,.dgn,.ppt,.pptx" />
        <button onClick={() => fileRef.current?.click()}
          style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, padding: '9px 12px', borderRadius: 7, border: '1.5px dashed var(--orange)', background: 'rgba(243,146,0,0.06)', color: 'var(--orange)', fontSize: 12.5, fontWeight: 700, cursor: 'pointer' }}>
          <Paperclip size={13} /> Joindre un document (rapport, courrier, plans techniques…)
        </button>
        {files.length > 0 && (
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5, marginTop: 8 }}>
            {files.map((f, i) => (
              <span key={i} style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 11, background: '#F1F5F9', color: '#334155', borderRadius: 6, padding: '3px 8px' }}>
                <FileText size={11} /> {f.nom}
                <X size={10} style={{ cursor: 'pointer' }} onClick={() => setFiles(p => p.filter((_, j) => j !== i))} />
              </span>
            ))}
          </div>
        )}

        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 18 }}>
          <button onClick={onClose} className="btn btn-ghost btn-sm">Annuler</button>
          <button disabled={!valid} className="btn btn-primary btn-sm"
            onClick={() => onCreate({ sens, tiers: tiers.trim(), objet: objet.trim(), priorite, typeAno, sla, files })}
            style={!valid ? { opacity: 0.5, cursor: 'not-allowed' } : undefined}>
            {sens === 'ano' ? 'Créer l\'ANO' : 'Créer le courrier'}
          </button>
        </div>
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════════
   COMPOSANT PRINCIPAL
═══════════════════════════════════════════════════════════════════════ */
type TabType = 'entrants' | 'sortants' | 'anos' | 'archives';

export default function Courriers() {
  const router = useRouter();
  const addDossier = useParapheurStore(s => s.addDossier);
  const notifyUser = useNotificationStore(s => s.notifyUser);
  const { projets } = useProjectStore();

  const [tab, setTab] = useState<TabType>('entrants');
  const [search, setSearch] = useState('');
  const [periode, setPeriode] = useState('tous');
  const [direction, setDirection] = useState('tous');
  const [qualifierCourrier, setQualifierCourrier] = useState<CourrierEntrant | null>(null);
  const [detailItem, setDetailItem] = useState<{ type: 'entrant' | 'sortant' | 'ano'; item: any } | null>(null);

  /* État des données (modifiable via le workflow) */
  const [entrants, setEntrants] = useState<CourrierEntrant[]>(ENTRANTS);
  const [sortants, setSortants] = useState<CourrierSortant[]>(SORTANTS);
  const [anos, setAnos] = useState<ANO[]>(ANOS);
  const [newCourrier, setNewCourrier] = useState<null | 'entrant' | 'sortant' | 'ano'>(null);
  const [wfSource, setWfSource] = useState<WorkflowSource | null>(null);
  const [annotPiece, setAnnotPiece] = useState<CourrierPiece | null>(null);
  const [projetLie, setProjetLie] = useState<Record<string, string>>({});
  const [gedFolderInput, setGedFolderInput] = useState('');
  const [gedAction, setGedAction] = useState<string | null>(null); // courrierNum being processed
  // Ouvre le constructeur de workflow (destinataires + rôles) sur un courrier,
  // en transmettant les VRAIES pièces jointes (fichiers réels) au circuit.
  const ouvrirWorkflow = (c: CourrierEntrant) => setWfSource({
    titre: c.objet, reference: c.num, type: 'courrier', soumetteur: c.expediteur,
    piecesJointes: (c.pieces && c.pieces.length)
      ? c.pieces.map(p => ({ nom: p.nom, taille: p.taille, ext: (['pdf', 'docx', 'xlsx', 'png', 'dwg'].includes(p.ext) ? p.ext : 'pdf') as 'pdf', url: p.url }))
      : (c.pieceJointe ? [{ nom: `${c.num}.pdf`, taille: '—', ext: 'pdf' }] : []),
  });

  const makeNum = (prefix: string) => `${prefix}-${new Date().getFullYear()}-${String(Math.floor(Math.random() * 9000) + 1000)}`;
  const creerCourrier = (d: NouveauCourrierData) => {
    if (d.sens === 'entrant') {
      setEntrants(prev => [{ id: `e${Date.now()}`, num: makeNum('ENT'), expediteur: d.tiers, objet: d.objet, recu: new Date().toLocaleString('fr-FR'), priorite: d.priorite, statut: 'À QUALIFIER', pieceJointe: d.files.length > 0, pieces: d.files }, ...prev]);
      setTab('entrants');
    } else if (d.sens === 'sortant') {
      setSortants(prev => [{ id: `s${Date.now()}`, num: makeNum('SOR'), destinataire: d.tiers, objet: d.objet, date: new Date().toLocaleDateString('fr-FR'), statut: 'Brouillon' }, ...prev]);
      setTab('sortants');
    } else {
      setAnos(prev => [{ id: `a${Date.now()}`, ref: makeNum('ANO'), projet: d.objet, bailleur: d.tiers, type: d.typeAno, dateEnvoi: new Date().toLocaleDateString('fr-FR'), sla: d.sla, jRestants: d.sla, statut: 'En cours' }, ...prev]);
      setTab('anos');
    }
    setNewCourrier(null);
  };

  /* Transitions de workflow */
  // IMPUTATION : on affecte le courrier au profil chargé du traitement, on le
  // notifie réellement (in-app + e-mail) et on crée son dossier de parapheur.
  const qualifierDiffuser = (id: string, data: { imputeEmail: string; impute: string; urgence: PrioriteCourrier; notes: string }) => {
    const c = entrants.find(x => x.id === id);
    setEntrants(prev => prev.map(x => x.id === id
      ? { ...x, statut: 'DIFFUSÉ' as const, priorite: data.urgence, impute: data.impute, imputeEmail: data.imputeEmail, imputeNotes: data.notes }
      : x));
    if (!c) return;
    const now = new Date();
    const dossier: ParapheurDossier = {
      id: `cour-imp-${c.id}-${now.getTime()}`,
      type: 'courrier', reference: c.num, titre: c.objet,
      projet: 'Direction Principale Équipement', projetCode: 'DPE',
      soumetteur: c.expediteur,
      dateCreation: now.toISOString().slice(0, 10),
      dateLimite: new Date(now.getTime() + 5 * 864e5).toISOString().slice(0, 10),
      priorite: data.urgence === 'URGENT' ? 'urgent' : 'normale',
      statut: 'en_attente',
      etapeActuelle: `Traitement — ${data.impute}`,
      nombreEtapes: 3, etapeIndex: 1,
      contexte: `Courrier ${c.num} de ${c.expediteur} — « ${c.objet} ». Imputé à ${data.impute}.${data.notes ? ` Instructions : ${data.notes}` : ''}`,
      piecesJointes: c.pieceJointe ? [{ nom: `${c.num}.pdf`, taille: '—', ext: 'pdf' }] : [],
      historique: [
        { etape: 'Réception', acteur: c.expediteur, date: c.recu },
        { etape: 'Imputation', acteur: 'Bureau Courrier', date: now.toLocaleString('fr-FR'), commentaire: data.notes },
      ],
      slaHeures: 72, heuresRestantes: 72, source: `Courrier ${c.num}`,
    };
    addDossier(dossier);
    notifyUser({
      recipientEmail: data.imputeEmail,
      title: `Courrier à traiter : ${c.objet}`,
      message: `Le courrier ${c.num} (${data.urgence}) vous est imputé.${data.notes ? ` Instructions : ${data.notes}` : ''}`,
      type: data.urgence === 'URGENT' ? 'warning' : 'info', link: '/workflows', source: 'Courrier', sendMail: true,
    });
    toast.success(`Courrier ${c.num} imputé à ${data.impute} — notifié et placé dans son parapheur.`, { duration: 4000 });
  };
  const diffuser = (id: string) =>
    setEntrants(prev => prev.map(c => c.id === id ? { ...c, statut: 'DIFFUSÉ' as const } : c));
  const soumettre = (id: string) =>
    setSortants(prev => prev.map(c => c.id === id ? { ...c, statut: 'En attente signature' as const } : c));
  const signer = (id: string) =>
    setSortants(prev => prev.map(c => c.id === id ? { ...c, statut: 'Envoyé' as const } : c));

  /* Filtrage entrants */
  const filteredEntrants = entrants.filter(c => {
    const s = search.toLowerCase();
    return !s || c.num.toLowerCase().includes(s) || c.expediteur.toLowerCase().includes(s) || c.objet.toLowerCase().includes(s);
  });

  const filteredSortants = sortants.filter(c => {
    const s = search.toLowerCase();
    return !s || c.num.toLowerCase().includes(s) || c.destinataire.toLowerCase().includes(s) || c.objet.toLowerCase().includes(s);
  });

  /* KPI counts */
  const kpiEntrants = entrants.filter(c => c.statut === 'À QUALIFIER').length;
  const kpiSortants = sortants.filter(c => c.statut === 'En attente signature').length;
  const kpiANOs     = anos.filter(c => c.jRestants <= 7).length;
  const kpiTraites  = entrants.filter(c => c.statut === 'DIFFUSÉ').length;

  return (
    <div className="page-content">
      {/* ── KPIs ── */}
      <div className="kpi-grid">
        <div className="kpi-card">
          <div className="kpi-label">Entrants à qualifier</div>
          <div className="kpi-value orange">{kpiEntrants}</div>
          <div className="kpi-sub">En attente de traitement</div>
        </div>
        <div className="kpi-card navy">
          <div className="kpi-label">Sortants en attente</div>
          <div className="kpi-value">{kpiSortants}</div>
          <div className="kpi-sub">Signature requise</div>
        </div>
        <div className="kpi-card red">
          <div className="kpi-label">ANOs urgents</div>
          <div className="kpi-value red">{kpiANOs}</div>
          <div className="kpi-sub">SLA ≤ 7 jours</div>
        </div>
        <div className="kpi-card green">
          <div className="kpi-label">Traités aujourd'hui</div>
          <div className="kpi-value green">{kpiTraites}</div>
          <div className="kpi-sub">Diffusés ce jour</div>
        </div>
      </div>

      {/* ── Tour de contrôle ── */}
      <div className="card">
        <div className="card-header">
          <span className="card-title">Tour de contrôle courriers</span>
          <span style={{ fontSize: 10, color: 'var(--muted)' }}>Mis à jour : 24/05/2026 10:30</span>
        </div>
        <div className="card-body" style={{ padding: '12px 16px' }}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 12 }}>
            {[
              { label: 'Entrants à qualifier', value: 12, color: 'var(--orange)', bg: 'rgba(243,146,0,0.08)', icon: <Mail size={18} /> },
              { label: 'Sortants en attente', value: 5,  color: 'var(--navy)',  bg: 'var(--navy-light)', icon: <Send size={18} /> },
              { label: 'ANOs urgents',         value: 3,  color: 'var(--red)',   bg: 'rgba(226,35,26,0.08)', icon: <AlertCircle size={18} /> },
              { label: 'Traités aujourd\'hui', value: 8,  color: 'var(--green)', bg: 'var(--green-light)', icon: <CheckCircle size={18} /> },
            ].map((k, i) => (
              <div key={i} style={{ padding: '16px', borderRadius: 10, background: k.bg, border: `1px solid ${k.color}22`, textAlign: 'center' }}>
                <div style={{ color: k.color, marginBottom: 8, display: 'flex', justifyContent: 'center' }}>{k.icon}</div>
                <div style={{ fontSize: 28, fontWeight: 900, color: k.color, lineHeight: 1 }}>{k.value}</div>
                <div style={{ fontSize: 10, color: 'var(--muted)', marginTop: 4, fontWeight: 600 }}>{k.label}</div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ── Barre outils ── */}
      <div className="card">
        <div className="card-body" style={{ padding: '10px 14px' }}>
          <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
            {/* Tabs */}
            <div className="tabs" style={{ flexShrink: 0 }}>
              {([
                { key: 'entrants', label: 'Entrants', count: ENTRANTS.length },
                { key: 'sortants', label: 'Sortants', count: SORTANTS.length },
                { key: 'anos',     label: 'ANOs',     count: anos.length },
                { key: 'archives', label: 'Archivés',  count: 42 },
              ] as { key: TabType; label: string; count: number }[]).map(t => (
                <button key={t.key} className={`tab${tab === t.key ? ' active' : ''}`} onClick={() => setTab(t.key)}>
                  {t.label} <span style={{ fontSize: 10, background: tab === t.key ? 'var(--navy)' : 'var(--border-2)', color: tab === t.key ? '#fff' : 'var(--muted)', borderRadius: 99, padding: '1px 6px', marginLeft: 3 }}>{t.count}</span>
                </button>
              ))}
            </div>

            {/* Recherche */}
            <div style={{ position: 'relative', flex: 1, minWidth: 180 }}>
              <Search size={12} style={{ position: 'absolute', left: 9, top: '50%', transform: 'translateY(-50%)', color: 'var(--muted)' }} />
              <input className="form-input" style={{ paddingLeft: 28, width: '100%' }} placeholder="Rechercher N°, expéditeur, objet..." value={search} onChange={e => setSearch(e.target.value)} />
            </div>

            <select className="form-input" style={{ width: 'auto' }} value={periode} onChange={e => setPeriode(e.target.value)}>
              <option value="tous">Toutes périodes</option>
              <option value="today">Aujourd'hui</option>
              <option value="week">Cette semaine</option>
              <option value="month">Ce mois</option>
            </select>
            <select className="form-input" style={{ width: 'auto' }} value={direction} onChange={e => setDirection(e.target.value)}>
              <option value="tous">Toutes directions</option>
              <option>DPE</option>
              <option>DEP</option>
              <option>DGC</option>
            </select>
            <button className="btn btn-primary btn-sm" onClick={() => setNewCourrier(tab === 'sortants' ? 'sortant' : tab === 'anos' ? 'ano' : 'entrant')}><Plus size={12} /> Nouveau</button>
          </div>
        </div>
      </div>

      {/* ── Tab Entrants ── */}
      {tab === 'entrants' && (
        <div className="card">
          <div className="card-header">
            <span className="card-title">Courriers entrants ({filteredEntrants.length})</span>
            <div style={{ display: 'flex', gap: 6 }}>
              <button className="btn btn-ghost btn-xs" onClick={() => { setSearch(''); setPeriode('tous'); setDirection('tous'); }}><Filter size={11} /> Réinitialiser</button>
              <button className="btn btn-navy btn-xs" onClick={() => toast('Sélectionnez les courriers à archiver puis confirmez.')}><Archive size={11} /> Archiver sélection</button>
            </div>
          </div>
          <div style={{ overflowX: 'auto' }}>
            <table className="tbl">
              <thead>
                <tr>
                  <th>N° Courrier</th>
                  <th>Expéditeur</th>
                  <th>Objet</th>
                  <th>Reçu</th>
                  <th>Priorité</th>
                  <th>Statut</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredEntrants.length === 0 && (
                  <tr><td colSpan={7} style={{ textAlign: 'center', padding: '32px 16px', color: 'var(--muted)', fontSize: 13 }}>
                    <Mail size={28} style={{ display: 'block', margin: '0 auto 8px', opacity: 0.3 }} />
                    Aucun courrier entrant{search ? ' correspondant à la recherche' : ''}. <button className="btn btn-primary btn-xs" style={{ marginLeft: 8 }} onClick={() => setNewCourrier('entrant')}><Plus size={11} /> Nouveau</button>
                  </td></tr>
                )}
                {filteredEntrants.map(c => (
                  <tr key={c.id}>
                    <td>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                        <Mail size={12} style={{ color: 'var(--navy)', flexShrink: 0 }} />
                        <span style={{ fontFamily: 'monospace', fontSize: 11, fontWeight: 600, color: 'var(--navy)' }}>{c.num}</span>
                        {c.pieceJointe && <span title="Pièce jointe" style={{ display: 'inline-flex' }}><Paperclip size={10} style={{ color: 'var(--muted)' }} /></span>}
                      </div>
                    </td>
                    <td style={{ maxWidth: 160 }}>{c.expediteur}</td>
                    <td style={{ maxWidth: 280 }}>
                      <span title={c.objet} style={{ display: 'block', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: 260 }}>{c.objet}</span>
                      {c.impute && <span style={{ display: 'inline-flex', alignItems: 'center', gap: 3, marginTop: 3, fontSize: 9.5, fontWeight: 700, color: '#1B4F8A', background: '#EFF6FF', borderRadius: 4, padding: '1px 6px' }}>→ {c.impute}</span>}
                    </td>
                    <td style={{ whiteSpace: 'nowrap', fontSize: 11 }}>{c.recu}</td>
                    <td>{pillPriorite(c.priorite)}</td>
                    <td>{pillStatutEntrant(c.statut)}</td>
                    <td>
                      <div style={{ display: 'flex', gap: 4 }}>
                        <button className="btn btn-ghost btn-xs" onClick={() => setDetailItem({ type: 'entrant', item: c })}><Eye size={10} /> Ouvrir</button>
                        {c.pieces && c.pieces.length > 0 && (
                          <button className="btn btn-xs" title="Annoter / commenter la pièce jointe"
                            style={{ background: 'rgba(243,146,0,0.10)', color: 'var(--orange)', border: '1px solid rgba(243,146,0,0.3)' }}
                            onClick={() => setAnnotPiece(c.pieces![0])}>
                            <FileText size={10} /> Annoter
                          </button>
                        )}
                        <button className="btn btn-xs" title="Créer un workflow (destinataires + rôles) à partir de ce courrier"
                          style={{ background: 'rgba(124,58,237,0.10)', color: '#7C3AED', border: '1px solid rgba(124,58,237,0.3)' }}
                          onClick={() => ouvrirWorkflow(c)}>
                          <GitBranch size={10} /> Workflow
                        </button>
                        {c.statut === 'À QUALIFIER' && (
                          <button className="btn btn-xs" style={{ background: 'rgba(243,146,0,0.12)', color: 'var(--orange)', border: '1px solid rgba(243,146,0,0.3)' }}
                            onClick={() => setQualifierCourrier(c)}>
                            <Tag size={10} /> Qualifier
                          </button>
                        )}
                        {c.statut === 'QUALIFIÉ' && (
                          <button className="btn btn-xs" style={{ background: 'rgba(14,52,96,0.08)', color: 'var(--navy)', border: '1px solid rgba(14,52,96,0.2)' }}
                            onClick={() => diffuser(c.id)}>
                            <Send size={10} /> Diffuser
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ── Tab Sortants ── */}
      {tab === 'sortants' && (
        <div className="card">
          <div className="card-header">
            <span className="card-title">Courriers sortants ({filteredSortants.length})</span>
            <button className="btn btn-primary btn-sm" onClick={() => setNewCourrier('sortant')}><Plus size={12} /> Nouveau courrier</button>
          </div>
          <div style={{ overflowX: 'auto' }}>
            <table className="tbl">
              <thead>
                <tr>
                  <th>N° Courrier</th>
                  <th>Destinataire</th>
                  <th>Objet</th>
                  <th>Date</th>
                  <th>Statut</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredSortants.length === 0 && (
                  <tr><td colSpan={6} style={{ textAlign: 'center', padding: '32px 16px', color: 'var(--muted)', fontSize: 13 }}>
                    <Send size={28} style={{ display: 'block', margin: '0 auto 8px', opacity: 0.3 }} />
                    Aucun courrier sortant{search ? ' correspondant à la recherche' : ''}. <button className="btn btn-primary btn-xs" style={{ marginLeft: 8 }} onClick={() => setNewCourrier('sortant')}><Plus size={11} /> Nouveau</button>
                  </td></tr>
                )}
                {filteredSortants.map(c => (
                  <tr key={c.id}>
                    <td>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                        <Send size={12} style={{ color: 'var(--orange)', flexShrink: 0 }} />
                        <span style={{ fontFamily: 'monospace', fontSize: 11, fontWeight: 600, color: 'var(--navy)' }}>{c.num}</span>
                      </div>
                    </td>
                    <td style={{ maxWidth: 180 }}>{c.destinataire}</td>
                    <td style={{ maxWidth: 280 }}>
                      <span title={c.objet} style={{ display: 'block', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: 260 }}>{c.objet}</span>
                    </td>
                    <td style={{ whiteSpace: 'nowrap', fontSize: 11 }}>{c.date}</td>
                    <td>{pillStatutSortant(c.statut)}</td>
                    <td>
                      <div style={{ display: 'flex', gap: 4 }}>
                        <button className="btn btn-ghost btn-xs" onClick={() => setDetailItem({ type: 'sortant', item: c })}><Eye size={10} /> Voir</button>
                        {c.statut === 'Brouillon' && <button className="btn btn-primary btn-xs" onClick={() => soumettre(c.id)}>Soumettre</button>}
                        {c.statut === 'En attente signature' && <button className="btn btn-navy btn-xs" onClick={() => signer(c.id)}>Signer</button>}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ── Tab ANOs ── */}
      {tab === 'anos' && (
        <div className="card">
          <div className="card-header">
            <span className="card-title">Avis de Non-Objection — ANOs ({anos.length})</span>
            <button className="btn btn-primary btn-sm" onClick={() => setNewCourrier('ano')}><Plus size={12} /> Nouvel ANO</button>
          </div>
          <div className="banner banner-warn" style={{ margin: '12px 16px 0' }}>
            <AlertCircle size={14} />
            <span><strong>{anos.filter(a => a.jRestants < 0).length} ANO(s) en retard</strong> — Actions requises immédiatement.</span>
          </div>
          <div style={{ overflowX: 'auto', padding: '0 0 12px' }}>
            <table className="tbl">
              <thead>
                <tr>
                  <th>Ref ANO</th>
                  <th>Projet</th>
                  <th>Bailleur</th>
                  <th>Type</th>
                  <th>Date envoi</th>
                  <th>SLA (j)</th>
                  <th>J restants</th>
                  <th>Statut</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {anos.map(a => {
                  const jColor = a.jRestants < 0 ? 'var(--red)' : a.jRestants <= 7 ? 'var(--amber)' : 'var(--green)';
                  const jBg    = a.jRestants < 0 ? 'rgba(226,35,26,0.1)' : a.jRestants <= 7 ? 'rgba(245,158,11,0.1)' : 'rgba(22,163,74,0.1)';
                  return (
                    <tr key={a.id}>
                      <td style={{ fontFamily: 'monospace', fontSize: 11, fontWeight: 600, color: 'var(--navy)' }}>{a.ref}</td>
                      <td>{a.projet}</td>
                      <td><span className="pill pill-navy">{a.bailleur}</span></td>
                      <td style={{ fontSize: 11 }}>{a.type}</td>
                      <td style={{ fontSize: 11 }}>{a.dateEnvoi}</td>
                      <td style={{ textAlign: 'center', fontWeight: 700 }}>{a.sla}</td>
                      <td>
                        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, padding: '3px 10px', borderRadius: 99, background: jBg, color: jColor, fontWeight: 800, fontSize: 12 }}>
                          <Clock size={10} />
                          {a.jRestants < 0 ? `${Math.abs(a.jRestants)}j dépassé` : `${a.jRestants}j`}
                        </span>
                      </td>
                      <td>{pillANO(a.statut)}</td>
                      <td>
                        <div style={{ display: 'flex', gap: 4 }}>
                          <button className="btn btn-ghost btn-xs" onClick={() => setDetailItem({ type: 'ano', item: a })}><Eye size={10} /> Voir</button>
                          {a.statut !== 'Approuvé' && <button className="btn btn-xs" style={{ background: 'rgba(22,163,74,0.1)', color: 'var(--green)', border: '1px solid rgba(22,163,74,0.3)' }} onClick={() => toast.success(`Relance envoyée pour l'ANO ${a.ref}.`)}>Relancer</button>}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ── Tab Archivés ── */}
      {tab === 'archives' && (
        <div className="card">
          <div className="card-body" style={{ textAlign: 'center', padding: 60 }}>
            <Archive size={40} style={{ color: 'var(--border-2)', margin: '0 auto 12px', display: 'block' }} />
            <div style={{ color: 'var(--muted)', fontSize: 13 }}>42 courriers archivés</div>
            <div style={{ color: 'var(--muted)', fontSize: 11, marginTop: 4 }}>Utilisez la recherche pour retrouver un courrier archivé</div>
          </div>
        </div>
      )}

      {/* Panel qualifier */}
      {qualifierCourrier && <QualifierPanel courrier={qualifierCourrier} onClose={() => setQualifierCourrier(null)} onConfirm={qualifierDiffuser} />}
      {wfSource && <CreateWorkflowModal source={wfSource} onClose={() => setWfSource(null)} onCreated={() => router.push('/workflows')} />}
      {annotPiece && <DocumentAnnotator doc={{ nom: annotPiece.nom, ext: annotPiece.ext, taille: annotPiece.taille, url: annotPiece.url }} onClose={() => setAnnotPiece(null)} />}

      {/* Panel détail */}
      {detailItem && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 200, display: 'flex' }} onClick={() => setDetailItem(null)}>
          <div style={{ flex: 1 }} />
          <div style={{ width: 400, background: '#fff', borderLeft: '1px solid #E2E8F0', boxShadow: '-4px 0 24px rgba(14,52,96,0.12)', display: 'flex', flexDirection: 'column', height: '100%' }} onClick={e => e.stopPropagation()}>
            <div style={{ padding: '14px 16px', borderBottom: '1px solid #E2E8F0', background: '#1B4F8A', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <div style={{ color: '#fff', fontWeight: 700, fontSize: 13 }}>Détail {detailItem.type === 'entrant' ? 'Courrier entrant' : detailItem.type === 'sortant' ? 'Courrier sortant' : 'ANO'}</div>
                <div style={{ color: 'rgba(255,255,255,0.65)', fontSize: 10 }}>{detailItem.item.num ?? detailItem.item.ref ?? detailItem.item.id}</div>
              </div>
              <button onClick={() => setDetailItem(null)} aria-label="Fermer le détail" className="btn btn-ghost btn-xs" style={{ color: '#fff', borderColor: 'rgba(255,255,255,0.3)' }}><X size={13} /></button>
            </div>
            <div style={{ flex: 1, overflowY: 'auto', padding: '16px', display: 'flex', flexDirection: 'column', gap: 12 }}>
              {detailItem.type === 'entrant' && (() => {
                const c = detailItem.item as CourrierEntrant;
                const hasPieces = c.pieces && c.pieces.length > 0;
                return (
                  <>
                    {/* Metadata */}
                    <div style={{ display: 'grid', gap: 10 }}>
                      <div><div style={{ fontSize: 10, color: '#94A3B8', fontWeight: 600, textTransform: 'uppercase', marginBottom: 3 }}>Expediteur</div><div style={{ fontSize: 12.5, color: '#1E293B', fontWeight: 600 }}>{c.expediteur}</div></div>
                      <div><div style={{ fontSize: 10, color: '#94A3B8', fontWeight: 600, textTransform: 'uppercase', marginBottom: 3 }}>Objet</div><div style={{ fontSize: 12, color: '#1E293B', lineHeight: 1.5 }}>{c.objet}</div></div>
                      <div style={{ display: 'flex', gap: 12 }}>
                        <div><div style={{ fontSize: 10, color: '#94A3B8', fontWeight: 600, textTransform: 'uppercase', marginBottom: 3 }}>Recu le</div><div style={{ fontSize: 12, color: '#1E293B' }}>{c.recu}</div></div>
                        <div><div style={{ fontSize: 10, color: '#94A3B8', fontWeight: 600, textTransform: 'uppercase', marginBottom: 3 }}>Statut</div><div>{pillPriorite(c.priorite)} {pillStatutEntrant(c.statut)}</div></div>
                      </div>
                    </div>

                    {/* Documents joints */}
                    <div>
                      <div style={{ fontSize: 10, color: '#94A3B8', fontWeight: 600, textTransform: 'uppercase', marginBottom: 8 }}>Documents joints ({hasPieces ? c.pieces!.length : 0})</div>
                      {hasPieces ? (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                          {c.pieces!.map((p, pi) => (
                            <div key={pi} style={{ border: '1.5px solid #E2E8F0', borderRadius: 10, overflow: 'hidden' }}>
                              {/* Preview zone */}
                              <div style={{ background: '#F8FAFC', padding: '18px 0', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6, cursor: 'pointer', borderBottom: '1px solid #E2E8F0' }}
                                onClick={() => setAnnotPiece(p)}>
                                <div style={{ width: 48, height: 60, background: p.ext === 'pdf' ? '#FEE2E2' : p.ext === 'xlsx' ? '#DCFCE7' : '#DBEAFE', borderRadius: 6, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 800, color: p.ext === 'pdf' ? '#DC2626' : p.ext === 'xlsx' ? '#15803D' : '#1D4ED8', boxShadow: '0 2px 6px rgba(0,0,0,0.1)' }}>
                                  .{p.ext.toUpperCase()}
                                </div>
                                <div style={{ fontSize: 10.5, fontWeight: 600, color: '#334155', maxWidth: 180, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{p.nom}</div>
                                <div style={{ fontSize: 9.5, color: '#94A3B8' }}>{p.taille}</div>
                                <div style={{ fontSize: 9.5, color: '#3D1A6B', fontWeight: 600 }}>Cliquer pour annoter</div>
                              </div>
                              {/* Actions document */}
                              <div style={{ display: 'flex', gap: 6, padding: '8px 10px', flexWrap: 'wrap' }}>
                                <button className="btn btn-xs" onClick={() => setAnnotPiece(p)}
                                  style={{ background: 'rgba(244,121,32,0.1)', color: '#F47920', border: '1px solid rgba(244,121,32,0.3)' }}>
                                  <FileText size={10} /> Annoter
                                </button>
                                <button className="btn btn-xs" onClick={() => ouvrirWorkflow(c)}
                                  style={{ background: 'rgba(124,58,237,0.1)', color: '#7C3AED', border: '1px solid rgba(124,58,237,0.3)' }}>
                                  <GitBranch size={10} /> Workflow
                                </button>
                                <button className="btn btn-xs" onClick={() => setGedAction(c.num)}
                                  style={{ background: 'rgba(14,52,96,0.08)', color: '#1B4F8A', border: '1px solid rgba(14,52,96,0.2)' }}>
                                  <FolderOpen size={10} /> Vers GED
                                </button>
                              </div>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <div style={{ padding: '16px', background: '#F8FAFC', borderRadius: 8, fontSize: 11.5, color: '#94A3B8', textAlign: 'center' }}>
                          Aucun document joint
                        </div>
                      )}
                    </div>

                    {/* Lier a un projet */}
                    <div>
                      <div style={{ fontSize: 10, color: '#94A3B8', fontWeight: 600, textTransform: 'uppercase', marginBottom: 6 }}>Lier a un projet</div>
                      {projetLie[c.id] ? (
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 10px', background: '#EFF6FF', borderRadius: 8, fontSize: 12 }}>
                          <span style={{ flex: 1, fontWeight: 600, color: '#1B4F8A' }}>{projetLie[c.id]}</span>
                          <button className="btn btn-ghost btn-xs" onClick={() => setProjetLie(p => { const n = { ...p }; delete n[c.id]; return n; })} style={{ color: '#94A3B8' }}><X size={10} /></button>
                        </div>
                      ) : (
                        <select onChange={e => { if (e.target.value) setProjetLie(p => ({ ...p, [c.id]: e.target.value })); e.currentTarget.value = ''; }}
                          style={{ width: '100%', padding: '7px 9px', borderRadius: 8, border: '1.5px solid #E2E8F0', fontSize: 12, color: '#64748B', background: '#fff', cursor: 'pointer' }}>
                          <option value="">Selectionner un projet...</option>
                          {projets.map(p => <option key={p.id} value={p.nom}>{p.nom}</option>)}
                        </select>
                      )}
                    </div>

                    {/* Envoyer vers GED modal */}
                    {gedAction === c.num && (
                      <div style={{ border: '1.5px solid #E2E8F0', borderRadius: 10, padding: '12px', background: '#FFFBEB' }}>
                        <div style={{ fontSize: 11, fontWeight: 700, color: '#0F172A', marginBottom: 8 }}>Enregistrer dans le GED</div>
                        <div style={{ fontSize: 10.5, color: '#64748B', marginBottom: 6 }}>Nom du dossier de classement</div>
                        <input value={gedFolderInput} onChange={e => setGedFolderInput(e.target.value)}
                          placeholder="ex: Courriers BM 2026 / BEST Lot 1"
                          style={{ width: '100%', boxSizing: 'border-box', padding: '7px 9px', borderRadius: 7, border: '1.5px solid #E2E8F0', fontSize: 12, color: '#0F172A', background: '#fff', marginBottom: 8 }} />
                        <div style={{ display: 'flex', gap: 6 }}>
                          <button className="btn btn-primary btn-xs" disabled={!gedFolderInput.trim()}
                            onClick={() => { toast.success('Document envoye vers GED — dossier : ' + gedFolderInput); setGedAction(null); setGedFolderInput(''); }}
                            style={{ flex: 1 }}>
                            <FolderOpen size={10} /> Confirmer
                          </button>
                          <button className="btn btn-ghost btn-xs" onClick={() => { setGedAction(null); setGedFolderInput(''); }}><X size={10} /></button>
                        </div>
                      </div>
                    )}
                  </>
                );
              })()}
              {detailItem.type === 'sortant' && (
                <>
                  <div><div style={{ fontSize: 10, color: '#94A3B8', fontWeight: 600, textTransform: 'uppercase', marginBottom: 3 }}>Destinataire</div><div style={{ fontSize: 12, color: '#1E293B' }}>{detailItem.item.destinataire}</div></div>
                  <div><div style={{ fontSize: 10, color: '#94A3B8', fontWeight: 600, textTransform: 'uppercase', marginBottom: 3 }}>Objet</div><div style={{ fontSize: 12, color: '#1E293B', lineHeight: 1.5 }}>{detailItem.item.objet}</div></div>
                  <div><div style={{ fontSize: 10, color: '#94A3B8', fontWeight: 600, textTransform: 'uppercase', marginBottom: 3 }}>Date</div><div style={{ fontSize: 12, color: '#1E293B' }}>{detailItem.item.date}</div></div>
                  <div><div style={{ fontSize: 10, color: '#94A3B8', fontWeight: 600, textTransform: 'uppercase', marginBottom: 3 }}>Statut</div><div style={{ fontSize: 12 }}>{pillStatutSortant(detailItem.item.statut)}</div></div>
                </>
              )}
              {detailItem.type === 'ano' && (
                <>
                  <div><div style={{ fontSize: 10, color: '#94A3B8', fontWeight: 600, textTransform: 'uppercase', marginBottom: 3 }}>Référence</div><div style={{ fontSize: 12, color: '#1E293B', fontFamily: 'monospace' }}>{detailItem.item.ref}</div></div>
                  <div><div style={{ fontSize: 10, color: '#94A3B8', fontWeight: 600, textTransform: 'uppercase', marginBottom: 3 }}>Projet</div><div style={{ fontSize: 12, color: '#1E293B' }}>{detailItem.item.projet}</div></div>
                  <div><div style={{ fontSize: 10, color: '#94A3B8', fontWeight: 600, textTransform: 'uppercase', marginBottom: 3 }}>Bailleur</div><div style={{ fontSize: 12 }}><span className="pill pill-navy">{detailItem.item.bailleur}</span></div></div>
                  <div><div style={{ fontSize: 10, color: '#94A3B8', fontWeight: 600, textTransform: 'uppercase', marginBottom: 3 }}>Type</div><div style={{ fontSize: 12, color: '#1E293B' }}>{detailItem.item.type}</div></div>
                  <div><div style={{ fontSize: 10, color: '#94A3B8', fontWeight: 600, textTransform: 'uppercase', marginBottom: 3 }}>Date envoi</div><div style={{ fontSize: 12, color: '#1E293B' }}>{detailItem.item.dateEnvoi}</div></div>
                  <div><div style={{ fontSize: 10, color: '#94A3B8', fontWeight: 600, textTransform: 'uppercase', marginBottom: 3 }}>SLA</div><div style={{ fontSize: 12, color: '#1E293B' }}>{detailItem.item.sla} jours</div></div>
                  <div><div style={{ fontSize: 10, color: '#94A3B8', fontWeight: 600, textTransform: 'uppercase', marginBottom: 3 }}>Statut</div><div style={{ fontSize: 12 }}>{pillANO(detailItem.item.statut)}</div></div>
                </>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ── Modale : nouveau courrier / ANO ── */}
      {newCourrier && (
        <NouveauCourrierModal sens={newCourrier} onClose={() => setNewCourrier(null)} onCreate={creerCourrier} />
      )}
    </div>
  );
}

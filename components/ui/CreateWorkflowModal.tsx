'use client';

/**
 * CreateWorkflowModal — créer un workflow de validation sur un document ou un
 * courrier chargé : on définit les DESTINATAIRES et leur RÔLE dans le traitement
 * (imputation, visa, avis, approbation, signature…). Le dossier est déposé dans
 * le parapheur (module Workflows) et le 1er acteur est notifié.
 */

import { useState } from 'react';
import { X, Plus, Trash2, GitBranch, ArrowDown } from 'lucide-react';
import toast from 'react-hot-toast';
import SearchableSelect from '@/components/ui/SearchableSelect';
import { useParapheurStore, type ParapheurDossier, type ParapheurEtape, type ParapheurPiece } from '@/lib/parapheurStore';
import { useNotificationStore } from '@/lib/notificationStore';
import { TEST_USERS } from '@/lib/authStore';

export interface WorkflowSource {
  titre: string;
  reference: string;
  type?: string;                 // 'courrier' | 'document' | …
  projet?: string;
  soumetteur?: string;
  piecesJointes?: ParapheurPiece[];
}

const ROLES = [
  'Imputation', 'Visa', 'Avis technique', 'Avis juridique', 'Avis financier',
  'Approbation', 'Traitement', 'Signature', 'Diffusion', 'Information',
];

const ANNUAIRE = (() => {
  const seen = new Set<string>();
  return TEST_USERS
    .filter(u => u.email && !seen.has(u.email.toLowerCase()) && seen.add(u.email.toLowerCase()))
    .map(u => ({ value: u.email, label: `${u.prenom} ${u.nom}`, sub: `${u.poste ?? u.role} · ${u.email}`, keywords: `${u.role} ${u.poste ?? ''}` }))
    .sort((a, b) => a.label.localeCompare(b.label, 'fr'));
})();
const nameForEmail = (e: string) => ANNUAIRE.find(a => a.value === e)?.label ?? e;

interface StepDraft { role: string; email: string; }

export default function CreateWorkflowModal({ source, onClose, onCreated }: {
  source: WorkflowSource;
  onClose: () => void;
  onCreated?: (dossier: ParapheurDossier) => void;
}) {
  const addDossier = useParapheurStore(s => s.addDossier);
  const notifyUser = useNotificationStore(s => s.notifyUser);
  const [titre, setTitre] = useState(source.titre);
  const [priorite, setPriorite] = useState<'urgent' | 'haute' | 'normale'>('normale');
  const [steps, setSteps] = useState<StepDraft[]>([{ role: 'Imputation', email: '' }]);

  const setStep = (i: number, patch: Partial<StepDraft>) => setSteps(prev => prev.map((s, j) => j === i ? { ...s, ...patch } : s));
  const addStep = () => setSteps(prev => [...prev, { role: 'Visa', email: '' }]);
  const removeStep = (i: number) => setSteps(prev => prev.filter((_, j) => j !== i));

  const valid = titre.trim() !== '' && steps.length > 0 && steps.every(s => s.email && s.role);

  const submit = () => {
    if (!valid) return;
    const now = new Date();
    const etapes: ParapheurEtape[] = steps.map((s, i) => ({
      ordre: i + 1, role: s.role, acteurNom: nameForEmail(s.email), acteurEmail: s.email,
      statut: 'en_attente',
    }));
    const first = etapes[0];
    const dossier: ParapheurDossier = {
      id: `wf-${now.getTime()}`,
      type: source.type ?? 'document',
      reference: source.reference,
      titre: titre.trim(),
      projet: source.projet ?? 'Direction Principale Équipement', projetCode: 'DPE',
      soumetteur: source.soumetteur ?? 'Utilisateur',
      dateCreation: now.toISOString().slice(0, 10),
      dateLimite: new Date(now.getTime() + 5 * 864e5).toISOString().slice(0, 10),
      priorite,
      statut: 'en_attente',
      etapeActuelle: `${first.role} — ${first.acteurNom}`,
      nombreEtapes: etapes.length, etapeIndex: 1,
      contexte: `Workflow créé sur « ${titre.trim()} » (${source.reference}). Circuit : ${etapes.map(e => `${e.role} → ${e.acteurNom}`).join(' ; ')}.`,
      piecesJointes: source.piecesJointes ?? [],
      historique: [{ etape: 'Création du workflow', acteur: source.soumetteur ?? 'Utilisateur', date: now.toLocaleString('fr-FR') }],
      slaHeures: 72, heuresRestantes: 72,
      source: source.reference,
      etapes,
    };
    addDossier(dossier);
    // Notifie chaque destinataire (le 1er est l'étape active).
    etapes.forEach((e, i) => notifyUser({
      recipientEmail: e.acteurEmail,
      title: `Workflow — ${e.role} : ${titre.trim()}`,
      message: i === 0
        ? `Action requise (${e.role}) sur « ${titre.trim()} » (${source.reference}).`
        : `Vous interviendrez à l'étape ${i + 1} (${e.role}) du circuit « ${titre.trim()} ».`,
      type: i === 0 ? (priorite === 'urgent' ? 'warning' : 'info') : 'info',
      link: '/workflows', source: 'Workflow', sendMail: i === 0,
    }));
    toast.success(`Workflow créé (${etapes.length} étape${etapes.length > 1 ? 's' : ''}) — ${first.acteurNom} notifié.`, { duration: 4000 });
    onCreated?.(dossier);
    onClose();
  };

  const lab: React.CSSProperties = { fontSize: 10.5, fontWeight: 700, color: '#64748B', textTransform: 'uppercase', display: 'block', margin: '12px 0 4px' };

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 700, background: 'rgba(15,23,42,0.55)', backdropFilter: 'blur(3px)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }} onClick={onClose}>
      <div style={{ width: 560, maxHeight: '90vh', overflowY: 'auto', background: '#fff', borderRadius: 12, boxShadow: '0 24px 64px rgba(0,0,0,0.3)', padding: 22 }} onClick={e => e.stopPropagation()}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 16, fontWeight: 800, color: '#0E3460' }}>
            <GitBranch size={18} style={{ color: '#F47920' }} /> Créer un workflow
          </div>
          <button onClick={onClose} style={{ border: 'none', background: 'none', cursor: 'pointer', color: '#94A3B8' }}><X size={18} /></button>
        </div>
        <div style={{ fontSize: 11.5, color: '#64748B' }}>Pièce : <strong>{source.reference}</strong></div>

        <label style={lab}>Objet du workflow *</label>
        <input value={titre} onChange={e => setTitre(e.target.value)} className="form-input" style={{ width: '100%', boxSizing: 'border-box' }} />

        <label style={lab}>Priorité</label>
        <select value={priorite} onChange={e => setPriorite(e.target.value as typeof priorite)} className="form-input" style={{ width: '100%' }}>
          <option value="normale">Normale</option>
          <option value="haute">Haute</option>
          <option value="urgent">Urgent</option>
        </select>

        <label style={lab}>Circuit — destinataires &amp; rôles *</label>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {steps.map((s, i) => (
            <div key={i}>
              <div style={{ display: 'flex', gap: 8, alignItems: 'flex-start', background: '#F8FAFC', border: '1px solid #E2E8F0', borderRadius: 9, padding: 10 }}>
                <div style={{ width: 24, height: 24, borderRadius: '50%', background: '#0E3460', color: '#fff', fontSize: 11, fontWeight: 800, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, marginTop: 2 }}>{i + 1}</div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <SearchableSelect value={s.email} onChange={v => setStep(i, { email: v })} options={ANNUAIRE}
                    placeholder="Destinataire (agent DPE)…" searchPlaceholder="Nom, poste, e-mail…" />
                  <div style={{ marginTop: 6 }}>
                    <select value={s.role} onChange={e => setStep(i, { role: e.target.value })} className="form-input" style={{ width: '100%', fontSize: 12 }}>
                      {ROLES.map(r => <option key={r} value={r}>{r}</option>)}
                    </select>
                  </div>
                </div>
                {steps.length > 1 && (
                  <button onClick={() => removeStep(i)} title="Retirer l'étape" style={{ border: 'none', background: 'none', cursor: 'pointer', color: '#EF3340', marginTop: 4 }}><Trash2 size={15} /></button>
                )}
              </div>
              {i < steps.length - 1 && <div style={{ textAlign: 'center', color: '#CBD5E1' }}><ArrowDown size={14} /></div>}
            </div>
          ))}
        </div>
        <button onClick={addStep} style={{ marginTop: 8, display: 'flex', alignItems: 'center', gap: 6, padding: '8px 12px', borderRadius: 7, border: '1.5px dashed #1B4F8A', background: 'rgba(27,79,138,0.05)', color: '#1B4F8A', fontSize: 12.5, fontWeight: 700, cursor: 'pointer' }}>
          <Plus size={13} /> Ajouter un destinataire / une étape
        </button>

        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 18 }}>
          <button onClick={onClose} className="btn btn-ghost btn-sm">Annuler</button>
          <button disabled={!valid} onClick={submit} className="btn btn-primary btn-sm" style={!valid ? { opacity: 0.5, cursor: 'not-allowed' } : undefined}>
            <GitBranch size={13} /> Lancer le workflow
          </button>
        </div>
      </div>
    </div>
  );
}

'use client';

import React, { useState, useRef, useEffect, useCallback } from 'react';
import {
  useProjectStore,
  DOMAINE_CFG,
  STATUT_CFG,
  type TacheWBS,
  type StatutTache,
  type TypeTache,
  type Priorite,
  type DepType,
  type Ressource,
  type Assignation,
  type Livrable,
  type TypeLivrable,
  type PrioriteLivrable,
  type StatutLivrable,
} from '@/lib/projectStore';
import { useAuth, isOperationalReadOnly } from '@/lib/authStore';
import { readOnlyGuard } from '@/lib/operationalGuard';
import {
  ChevronRight,
  ChevronDown,
  Plus,
  Trash2,
  Edit2,
  Diamond,
  Save,
  Search,
  LayoutList,
  Columns,
  BarChart2,
  X,
  UserPlus,
  UserMinus,
  FileText,
  CheckSquare,
  Paperclip,
} from 'lucide-react';

// ─── Style helpers ────────────────────────────────────────────────────────────

const TACHE_STATUT_CFG: Record<StatutTache, { label: string; color: string; bg: string }> = {
  a_faire:  { label: 'À faire',  color: '#374151', bg: '#F3F4F6' },
  en_cours: { label: 'En cours', color: '#1E40AF', bg: '#DBEAFE' },
  bloque:   { label: 'Bloqué',   color: '#991B1B', bg: '#FEE2E2' },
  termine:  { label: 'Terminé',  color: '#166534', bg: '#DCFCE7' },
};

const PRIORITE_CFG: Record<Priorite, { label: string; color: string; bg: string }> = {
  Haute:   { label: 'Haute',   color: '#991B1B', bg: '#FEE2E2' },
  Moyenne: { label: 'Moyenne', color: '#92400E', bg: '#FEF3C7' },
  Faible:  { label: 'Faible',  color: '#166534', bg: '#DCFCE7' },
};

const inp: React.CSSProperties = {
  padding: '4px 8px',
  border: '1px solid #CBD5E1',
  borderRadius: 5,
  fontSize: 12,
  fontFamily: 'inherit',
  background: '#fff',
  color: '#1A1A2E',
  outline: 'none',
};

const pill = (bg: string, color: string): React.CSSProperties => ({
  display: 'inline-block',
  padding: '2px 8px',
  borderRadius: 12,
  fontSize: 10,
  fontWeight: 700,
  background: bg,
  color,
});

const btn = (bg: string, color: string): React.CSSProperties => ({
  padding: '6px 14px',
  background: bg,
  color,
  border: 'none',
  borderRadius: 7,
  fontSize: 12,
  fontWeight: 600,
  cursor: 'pointer',
  display: 'inline-flex',
  alignItems: 'center',
  gap: 5,
  fontFamily: 'inherit',
});

// ─── Resource popover ─────────────────────────────────────────────────────────

interface ResourcePopoverProps {
  tache: TacheWBS;
  ressources: Ressource[];
  projetId: string;
  onClose: () => void;
  anchorRef: React.RefObject<HTMLTableCellElement | null>;
  onAssign: (ressourceId: string, unite: number) => void;
  onRemove: (assignationId: string) => void;
}

function ResourcePopover({ tache, ressources, projetId, onClose, anchorRef, onAssign, onRemove }: ResourcePopoverProps) {
  const [selRes, setSelRes] = useState('');
  const [unite, setUnite] = useState(100);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node) &&
          anchorRef.current && !anchorRef.current.contains(e.target as Node)) {
        onClose();
      }
    }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [onClose, anchorRef]);

  const assigned = tache.assignations.map(a => {
    const r = ressources.find(x => x.id === a.ressourceId);
    return { ...a, nomComplet: r ? `${r.prenom} ${r.nom}`.trim() : a.ressourceId };
  });

  const available = ressources.filter(r =>
    !tache.assignations.some(a => a.ressourceId === r.id)
  );

  return (
    <div
      ref={ref}
      style={{
        position: 'absolute',
        zIndex: 200,
        background: '#fff',
        border: '1px solid #CBD5E1',
        borderRadius: 10,
        boxShadow: '0 8px 32px rgba(0,0,0,0.18)',
        padding: 16,
        minWidth: 280,
        top: '100%',
        left: 0,
      }}
    >
      <div style={{ fontWeight: 700, fontSize: 12, color: '#1B4F8A', marginBottom: 10 }}>
        Ressources — {tache.nom}
      </div>
      {assigned.length === 0 && (
        <div style={{ fontSize: 11, color: '#94A3B8', marginBottom: 8 }}>Aucune ressource affectée.</div>
      )}
      {assigned.map(a => (
        <div key={a.id} style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6, background: '#F8FAFC', borderRadius: 6, padding: '4px 8px' }}>
          <span style={{ fontSize: 11, flex: 1, color: '#374151' }}>{a.nomComplet}</span>
          <span style={{ fontSize: 10, color: '#1B4F8A', fontWeight: 700 }}>{a.unite}%</span>
          <button onClick={() => onRemove(a.id)} aria-label={`Retirer ${a.nomComplet}`} title="Retirer cette ressource" style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#EF3340', padding: 0 }}>
            <UserMinus size={13} />
          </button>
        </div>
      ))}
      {available.length > 0 && (
        <div style={{ marginTop: 10, borderTop: '1px solid #F1F5F9', paddingTop: 10 }}>
          <div style={{ fontSize: 11, color: '#64748B', marginBottom: 6, fontWeight: 600 }}>Affecter une ressource</div>
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
            <select
              value={selRes}
              onChange={e => setSelRes(e.target.value)}
              style={{ ...inp, flex: 1, minWidth: 120 }}
            >
              <option value="">Sélectionner…</option>
              {available.map(r => (
                <option key={r.id} value={r.id}>{`${r.prenom} ${r.nom}`.trim()}</option>
              ))}
            </select>
            <input
              type="number"
              min={1}
              max={100}
              value={unite}
              onChange={e => setUnite(Number(e.target.value))}
              style={{ ...inp, width: 54 }}
              placeholder="%"
            />
            <button
              onClick={() => { if (selRes) { onAssign(selRes, unite); setSelRes(''); setUnite(100); } }}
              style={{ ...btn('#1B4F8A', '#fff'), padding: '4px 10px' }}
            >
              <UserPlus size={12} />
            </button>
          </div>
        </div>
      )}
      <button onClick={onClose} aria-label="Fermer" style={{ position: 'absolute', top: 8, right: 8, background: 'none', border: 'none', cursor: 'pointer', color: '#94A3B8' }}>
        <X size={14} />
      </button>
    </div>
  );
}

// ─── Nouvelle tâche modal ─────────────────────────────────────────────────────

interface NouvelleModalProps {
  projetId: string;
  taches: TacheWBS[];
  onSave: (data: Omit<TacheWBS, 'id'>) => void;
  onClose: () => void;
}

function NouvelleModal({ projetId, taches, onSave, onClose }: NouvelleModalProps) {
  const [nom, setNom] = useState('');
  const [type, setType] = useState<TypeTache>('Normale');
  const [duree, setDuree] = useState(5);
  const [dateDebut, setDateDebut] = useState(new Date().toISOString().split('T')[0]);
  const [priorite, setPriorite] = useState<Priorite>('Moyenne');
  const [predId, setPredId] = useState('');
  const [predType, setPredType] = useState<DepType>('FS');
  const [statut, setStatut] = useState<StatutTache>('a_faire');
  const [commentaire, setCommentaire] = useState('');
  const [coutPrevu, setCoutPrevu] = useState<number | ''>('');
  const [coutReel, setCoutReel] = useState<number | ''>('');

  function calcFin(start: string, days: number): string {
    const d = new Date(start);
    let added = 0;
    while (added < days) {
      d.setDate(d.getDate() + 1);
      if (d.getDay() !== 0 && d.getDay() !== 6) added++;
    }
    return d.toISOString().split('T')[0];
  }

  function handleSubmit() {
    if (!nom.trim()) return;
    const data: Omit<TacheWBS, 'id'> = {
      projetId,
      nom: nom.trim(),
      type,
      niveau: 2,
      ordre: taches.length + 1,
      duree,
      dateDebut,
      dateFin: calcFin(dateDebut, duree),
      avancement: 0,
      statutTache: statut,
      priorite,
      predecesseurs: predId ? [{ tacheId: predId, type: predType, delai: 0 }] : [],
      assignations: [],
      commentaire: commentaire.trim(),
      coutPrevu: typeof coutPrevu === 'number' ? coutPrevu : undefined,
      coutReel: typeof coutReel === 'number' ? coutReel : undefined,
    };
    onSave(data);
    onClose();
  }

  return (
    <div
      style={{ position: 'fixed', inset: 0, background: 'rgba(14,52,96,0.45)', zIndex: 100, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}
      onClick={onClose}
    >
      <div
        style={{ background: '#fff', borderRadius: 14, padding: 28, width: '100%', maxWidth: 500, boxShadow: '0 24px 64px rgba(0,0,0,0.25)' }}
        onClick={e => e.stopPropagation()}
      >
        <h3 style={{ fontSize: 16, fontWeight: 700, color: '#0E3460', marginBottom: 20, display: 'flex', alignItems: 'center', gap: 8 }}>
          <Plus size={18} /> Nouvelle tâche
        </h3>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div>
            <label style={{ fontSize: 11, fontWeight: 600, color: '#64748B', display: 'block', marginBottom: 4 }}>Nom *</label>
            <input value={nom} onChange={e => setNom(e.target.value)} style={{ ...inp, width: '100%', boxSizing: 'border-box' }} placeholder="Nom de la tâche" />
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <div>
              <label style={{ fontSize: 11, fontWeight: 600, color: '#64748B', display: 'block', marginBottom: 4 }}>Type</label>
              <select value={type} onChange={e => setType(e.target.value as TypeTache)} style={{ ...inp, width: '100%' }}>
                <option>Normale</option>
                <option>Récapitulative</option>
                <option>Jalon</option>
              </select>
            </div>
            <div>
              <label style={{ fontSize: 11, fontWeight: 600, color: '#64748B', display: 'block', marginBottom: 4 }}>Durée (jours)</label>
              <input type="number" min={1} value={duree} onChange={e => setDuree(Number(e.target.value))} style={{ ...inp, width: '100%', boxSizing: 'border-box' }} />
            </div>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <div>
              <label style={{ fontSize: 11, fontWeight: 600, color: '#64748B', display: 'block', marginBottom: 4 }}>Date début</label>
              <input type="date" value={dateDebut} onChange={e => setDateDebut(e.target.value)} style={{ ...inp, width: '100%', boxSizing: 'border-box' }} />
            </div>
            <div>
              <label style={{ fontSize: 11, fontWeight: 600, color: '#64748B', display: 'block', marginBottom: 4 }}>Priorité</label>
              <select value={priorite} onChange={e => setPriorite(e.target.value as Priorite)} style={{ ...inp, width: '100%' }}>
                <option>Haute</option>
                <option>Moyenne</option>
                <option>Faible</option>
              </select>
            </div>
          </div>
          <div>
            <label style={{ fontSize: 11, fontWeight: 600, color: '#64748B', display: 'block', marginBottom: 4 }}>Prédécesseur (optionnel)</label>
            <div style={{ display: 'flex', gap: 8 }}>
              <select value={predId} onChange={e => setPredId(e.target.value)} style={{ ...inp, flex: 1 }}>
                <option value="">Aucun</option>
                {taches.map(t => (
                  <option key={t.id} value={t.id}>{t.ordre}. {t.nom}</option>
                ))}
              </select>
              {predId && (
                <select value={predType} onChange={e => setPredType(e.target.value as DepType)} style={{ ...inp, width: 70 }}>
                  <option>FS</option>
                  <option>SS</option>
                  <option>FF</option>
                  <option>SF</option>
                </select>
              )}
            </div>
          </div>
          <div>
            <label style={{ fontSize: 11, fontWeight: 600, color: '#64748B', display: 'block', marginBottom: 4 }}>Statut initial</label>
            <select value={statut} onChange={e => setStatut(e.target.value as StatutTache)} style={{ ...inp, width: '100%' }}>
              <option value="a_faire">À faire</option>
              <option value="en_cours">En cours</option>
              <option value="bloque">Bloqué</option>
              <option value="termine">Terminé</option>
            </select>
          </div>
          <div>
            <label style={{ fontSize: 11, fontWeight: 600, color: '#64748B', display: 'block', marginBottom: 4 }}>Commentaire</label>
            <textarea value={commentaire} onChange={e => setCommentaire(e.target.value)} style={{ ...inp, width: '100%', boxSizing: 'border-box', minHeight: 48, resize: 'vertical' }} placeholder="Notes, observations..." />
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <div>
              <label style={{ fontSize: 11, fontWeight: 600, color: '#64748B', display: 'block', marginBottom: 4 }}>Coût prévu (FCFA)</label>
              <input type="number" min={0} value={coutPrevu} onChange={e => setCoutPrevu(e.target.value === '' ? '' : Number(e.target.value))} style={{ ...inp, width: '100%', boxSizing: 'border-box' }} />
            </div>
            <div>
              <label style={{ fontSize: 11, fontWeight: 600, color: '#64748B', display: 'block', marginBottom: 4 }}>Coût réel (FCFA)</label>
              <input type="number" min={0} value={coutReel} onChange={e => setCoutReel(e.target.value === '' ? '' : Number(e.target.value))} style={{ ...inp, width: '100%', boxSizing: 'border-box' }} />
            </div>
          </div>
        </div>
        <div style={{ display: 'flex', gap: 10, marginTop: 22, justifyContent: 'flex-end' }}>
          <button style={btn('#F1F5F9', '#374151')} onClick={onClose}>Annuler</button>
          <button style={btn('#1B4F8A', '#fff')} onClick={handleSubmit}>
            <Save size={14} /> Créer la tâche
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Modifier tâche modal ─────────────────────────────────────────────────────

interface EditTaskModalProps {
  projetId: string;
  tache: TacheWBS;
  taches: TacheWBS[];
  onSave: (patch: Partial<TacheWBS>) => void;
  onClose: () => void;
  onDelete?: () => void;
}

function EditTaskModal({ projetId, tache, taches, onSave, onClose, onDelete }: EditTaskModalProps) {
  const [nom, setNom] = useState(tache.nom);
  const [type, setType] = useState<TypeTache>(tache.type);
  const [niveau, setNiveau] = useState(tache.niveau);
  const [ordre, setOrdre] = useState(tache.ordre);
  const [duree, setDuree] = useState(tache.duree);
  const [dateDebut, setDateDebut] = useState(tache.dateDebut);
  const [dateFin, setDateFin] = useState(tache.dateFin);
  const [avancement, setAvancement] = useState(tache.avancement);
  const [statut, setStatut] = useState<StatutTache>(tache.statutTache);
  const [priorite, setPriorite] = useState<Priorite>(tache.priorite);
  const [predId, setPredId] = useState(tache.predecesseurs[0]?.tacheId ?? '');
  const [predType, setPredType] = useState<DepType>(tache.predecesseurs[0]?.type ?? 'FS');
  const [predLag, setPredLag] = useState(tache.predecesseurs[0]?.delai ?? 0);
  const [commentaire, setCommentaire] = useState(tache.commentaire ?? '');
  const [coutPrevu, setCoutPrevu] = useState<number | ''>(tache.coutPrevu ?? '');
  const [coutReel, setCoutReel] = useState<number | ''>(tache.coutReel ?? '');

  function handleSubmit() {
    if (!nom.trim()) return;
    const patch: Partial<TacheWBS> = {
      nom: nom.trim(),
      type,
      niveau,
      ordre,
      duree,
      dateDebut,
      dateFin,
      avancement,
      statutTache: statut,
      priorite,
      predecesseurs: predId ? [{ tacheId: predId, type: predType, delai: predLag }] : [],
      commentaire: commentaire.trim(),
      coutPrevu: typeof coutPrevu === 'number' ? coutPrevu : undefined,
      coutReel: typeof coutReel === 'number' ? coutReel : undefined,
    };
    onSave(patch);
    onClose();
  }

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(14,52,96,0.45)', zIndex: 100, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}
      onClick={onClose}>
      <div style={{ background: '#fff', borderRadius: 14, padding: 28, width: '100%', maxWidth: 520, maxHeight: '90vh', overflowY: 'auto', boxShadow: '0 24px 64px rgba(0,0,0,0.25)' }}
        onClick={e => e.stopPropagation()}>
        <h3 style={{ fontSize: 16, fontWeight: 700, color: '#0E3460', marginBottom: 20, display: 'flex', alignItems: 'center', gap: 8 }}>
          <Edit2 size={18} /> Modifier la tâche
        </h3>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div>
            <label style={{ fontSize: 11, fontWeight: 600, color: '#64748B', display: 'block', marginBottom: 4 }}>Nom *</label>
            <input value={nom} onChange={e => setNom(e.target.value)} style={{ ...inp, width: '100%', boxSizing: 'border-box' }} />
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 10 }}>
            <div>
              <label style={{ fontSize: 11, fontWeight: 600, color: '#64748B', display: 'block', marginBottom: 4 }}>Type</label>
              <select value={type} onChange={e => setType(e.target.value as TypeTache)} style={{ ...inp, width: '100%' }}>
                <option>Normale</option>
                <option>Récapitulative</option>
                <option>Jalon</option>
              </select>
            </div>
            <div>
              <label style={{ fontSize: 11, fontWeight: 600, color: '#64748B', display: 'block', marginBottom: 4 }}>Niveau</label>
              <input type="number" min={1} max={5} value={niveau} onChange={e => setNiveau(Number(e.target.value))} style={{ ...inp, width: '100%', boxSizing: 'border-box' }} />
            </div>
            <div>
              <label style={{ fontSize: 11, fontWeight: 600, color: '#64748B', display: 'block', marginBottom: 4 }}>Ordre</label>
              <input type="number" min={1} value={ordre} onChange={e => setOrdre(Number(e.target.value))} style={{ ...inp, width: '100%', boxSizing: 'border-box' }} />
            </div>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
            <div>
              <label style={{ fontSize: 11, fontWeight: 600, color: '#64748B', display: 'block', marginBottom: 4 }}>Date début</label>
              <input type="date" value={dateDebut} onChange={e => setDateDebut(e.target.value)} style={{ ...inp, width: '100%', boxSizing: 'border-box' }} />
            </div>
            <div>
              <label style={{ fontSize: 11, fontWeight: 600, color: '#64748B', display: 'block', marginBottom: 4 }}>Date fin</label>
              <input type="date" value={dateFin} onChange={e => setDateFin(e.target.value)} style={{ ...inp, width: '100%', boxSizing: 'border-box' }} />
            </div>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
            <div>
              <label style={{ fontSize: 11, fontWeight: 600, color: '#64748B', display: 'block', marginBottom: 4 }}>Durée (jours)</label>
              <input type="number" min={1} value={duree} onChange={e => setDuree(Number(e.target.value))} style={{ ...inp, width: '100%', boxSizing: 'border-box' }} />
            </div>
            <div>
              <label style={{ fontSize: 11, fontWeight: 600, color: '#64748B', display: 'block', marginBottom: 4 }}>Priorité</label>
              <select value={priorite} onChange={e => setPriorite(e.target.value as Priorite)} style={{ ...inp, width: '100%' }}>
                <option>Haute</option>
                <option>Moyenne</option>
                <option>Faible</option>
              </select>
            </div>
          </div>
          <div>
            <label style={{ fontSize: 11, fontWeight: 600, color: '#64748B', display: 'block', marginBottom: 4 }}>Avancement : {avancement}%</label>
            <input type="range" min={0} max={100} step={5} value={avancement}
              onChange={e => setAvancement(Number(e.target.value))}
              style={{ width: '100%', accentColor: '#1B4F8A' }} />
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
            <div>
              <label style={{ fontSize: 11, fontWeight: 600, color: '#64748B', display: 'block', marginBottom: 4 }}>Statut</label>
              <select value={statut} onChange={e => setStatut(e.target.value as StatutTache)} style={{ ...inp, width: '100%' }}>
                <option value="a_faire">À faire</option>
                <option value="en_cours">En cours</option>
                <option value="bloque">Bloqué</option>
                <option value="termine">Terminé</option>
              </select>
            </div>
            <div>
              <label style={{ fontSize: 11, fontWeight: 600, color: '#64748B', display: 'block', marginBottom: 4 }}>Prédécesseur</label>
              <div style={{ display: 'flex', gap: 6 }}>
                <select value={predId} onChange={e => setPredId(e.target.value)} style={{ ...inp, flex: 1 }}>
                  <option value="">Aucun</option>
                  {taches.filter(t => t.id !== tache.id).map(t => (
                    <option key={t.id} value={t.id}>{t.ordre}. {t.nom}</option>
                  ))}
                </select>
                {predId && (
                  <select value={predType} onChange={e => setPredType(e.target.value as DepType)} style={{ ...inp, width: 60 }}>
                    <option>FS</option><option>SS</option><option>FF</option><option>SF</option>
                  </select>
                )}
              </div>
            </div>
          </div>
          {predId && (
            <div>
              <label style={{ fontSize: 11, fontWeight: 600, color: '#64748B', display: 'block', marginBottom: 4 }}>Décalage liaison (jours)</label>
              <input type="number" value={predLag} onChange={e => setPredLag(Number(e.target.value))} style={{ ...inp, width: 100, boxSizing: 'border-box' }} />
            </div>
          )}
          <div>
            <label style={{ fontSize: 11, fontWeight: 600, color: '#64748B', display: 'block', marginBottom: 4 }}>Commentaire</label>
            <textarea value={commentaire} onChange={e => setCommentaire(e.target.value)} style={{ ...inp, width: '100%', boxSizing: 'border-box', minHeight: 48, resize: 'vertical' }} placeholder="Notes, observations..." />
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
            <div>
              <label style={{ fontSize: 11, fontWeight: 600, color: '#64748B', display: 'block', marginBottom: 4 }}>Coût prévu (FCFA)</label>
              <input type="number" min={0} value={coutPrevu} onChange={e => setCoutPrevu(e.target.value === '' ? '' : Number(e.target.value))} style={{ ...inp, width: '100%', boxSizing: 'border-box' }} />
            </div>
            <div>
              <label style={{ fontSize: 11, fontWeight: 600, color: '#64748B', display: 'block', marginBottom: 4 }}>Coût réel (FCFA)</label>
              <input type="number" min={0} value={coutReel} onChange={e => setCoutReel(e.target.value === '' ? '' : Number(e.target.value))} style={{ ...inp, width: '100%', boxSizing: 'border-box' }} />
            </div>
          </div>
        </div>
        <div style={{ display: 'flex', gap: 10, marginTop: 22, justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            {onDelete && (
              <button style={{ ...btn('#FEE2E2', '#EF4444'), border: '1px solid #FCA5A5' }} onClick={onDelete}>
                <Trash2 size={14} /> Supprimer
              </button>
            )}
          </div>
          <div style={{ display: 'flex', gap: 10 }}>
            <button style={btn('#F1F5F9', '#374151')} onClick={onClose}>Annuler</button>
            <button style={btn('#1B4F8A', '#fff')} onClick={handleSubmit}>
              <Save size={14} /> Enregistrer
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Gantt / Planning mini-view ───────────────────────────────────────────────

interface GanttViewProps {
  taches: TacheWBS[];
  collapsed: Set<string>;
}

function GanttView({ taches, collapsed }: GanttViewProps) {
  const visible = taches.filter(t => {
    if (t.niveau <= 1) return true;
    // hide if any parent (niveau 1) is collapsed
    const parentIdx = taches.slice(0, taches.indexOf(t)).reverse().findIndex(p => p.niveau < t.niveau);
    const parent = taches.slice(0, taches.indexOf(t)).reverse()[parentIdx];
    return !parent || !collapsed.has(parent.id);
  });

  if (visible.length === 0) return <div style={{ padding: 24, color: '#94A3B8', fontSize: 13 }}>Aucune tâche.</div>;

  const allDates = visible.flatMap(t => [new Date(t.dateDebut), new Date(t.dateFin)]);
  const minDate = new Date(Math.min(...allDates.map(d => d.getTime())));
  const maxDate = new Date(Math.max(...allDates.map(d => d.getTime())));
  const totalDays = Math.max(1, (maxDate.getTime() - minDate.getTime()) / 86400000);

  function pct(date: string): number {
    return ((new Date(date).getTime() - minDate.getTime()) / 86400000 / totalDays) * 100;
  }
  function width(start: string, end: string): number {
    return Math.max(0.5, ((new Date(end).getTime() - new Date(start).getTime()) / 86400000 / totalDays) * 100);
  }

  return (
    <div style={{ overflowX: 'auto' }}>
      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
        <thead>
          <tr style={{ background: '#1B4F8A', color: '#fff' }}>
            <th style={{ padding: '8px 12px', textAlign: 'left', width: 260, whiteSpace: 'nowrap' }}>Tâche</th>
            <th style={{ padding: '8px 12px', width: '100%', minWidth: 400 }}>Calendrier</th>
          </tr>
        </thead>
        <tbody>
          {visible.map((t, i) => {
            const isRecap = t.type === 'Récapitulative';
            const isJalon = t.type === 'Jalon';
            const barColor = isRecap ? '#1B4F8A' : isJalon ? '#F59E0B' : '#F47920';
            return (
              <tr
                key={t.id}
                style={{
                  background: isRecap ? '#EFF6FF' : isJalon ? '#FFFBEB' : i % 2 === 0 ? '#fff' : '#FAFAFA',
                  borderBottom: '1px solid #F1F5F9',
                }}
              >
                <td style={{ padding: '6px 12px', fontWeight: isRecap ? 700 : 400, paddingLeft: 12 + (t.niveau - 1) * 16 }}>
                  {isJalon && <Diamond size={10} style={{ color: '#F59E0B', marginRight: 4 }} />}
                  {t.nom}
                </td>
                <td style={{ padding: '6px 8px', position: 'relative', height: 32 }}>
                  <div style={{ position: 'relative', height: 18, marginTop: 6 }}>
                    {!isJalon ? (
                      <>
                        <div style={{
                          position: 'absolute',
                          left: `${pct(t.dateDebut)}%`,
                          width: `${width(t.dateDebut, t.dateFin)}%`,
                          height: 14,
                          top: 2,
                          background: '#E2E8F0',
                          borderRadius: 4,
                        }} />
                        <div style={{
                          position: 'absolute',
                          left: `${pct(t.dateDebut)}%`,
                          width: `${(width(t.dateDebut, t.dateFin) || 0) * (t.avancement || 0) / 100}%`,
                          height: 14,
                          top: 2,
                          background: barColor,
                          borderRadius: 4,
                          opacity: 0.85,
                        }} />
                      </>
                    ) : (
                      <div style={{
                        position: 'absolute',
                        left: `${pct(t.dateDebut)}%`,
                        width: 14,
                        height: 14,
                        top: 2,
                        background: '#F59E0B',
                        transform: 'rotate(45deg)',
                        borderRadius: 2,
                      }} />
                    )}
                  </div>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

type View = 'liste' | 'kanban' | 'planning';

export default function Taches() {
  const store = readOnlyGuard(useProjectStore(), isOperationalReadOnly(useAuth().user));
  const [selectedProjetId, setSelectedProjetId] = useState<string>(
    store.projets.length > 0 ? store.projets[0].id : ''
  );
  const [view, setView] = useState<View>('liste');
  const [search, setSearch] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [editModalTache, setEditModalTache] = useState<TacheWBS | null>(null);
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());
  const [editingCell, setEditingCell] = useState<{ tacheId: string; field: string } | null>(null);
  const [resourcePopover, setResourcePopover] = useState<string | null>(null);
  const resourceCellRefs = useRef<Record<string, React.RefObject<HTMLTableCellElement | null>>>({});
  const [editValues, setEditValues] = useState<Record<string, Record<string, string>>>({});
  // Livrables
  const [livrableTaskId, setLivrableTaskId] = useState<string | null>(null);
  const [livrableForm, setLivrableForm] = useState<{ nom: string; typeLivrable: TypeLivrable; proprietaireNom: string; dateRequise: string; priorite: PrioriteLivrable; statut: StatutLivrable }>({
    nom: '', typeLivrable: 'General', proprietaireNom: '', dateRequise: '', priorite: 'Moyenne', statut: 'Nouveau',
  });
  const [livrableEdit, setLivrableEdit] = useState<string | null>(null); // livrableId being edited

  const selectedProjet = store.projets.find(p => p.id === selectedProjetId) ?? null;

  // Build list of tasks to show (respects collapse)
  const allTaches: TacheWBS[] = selectedProjet ? [...selectedProjet.taches].sort((a, b) => a.ordre - b.ordre) : [];

  const visibleTaches = allTaches.filter(t => {
    // Find parent (first task with lower level before this one)
    const idx = allTaches.indexOf(t);
    for (let i = idx - 1; i >= 0; i--) {
      if (allTaches[i].niveau < t.niveau) {
        if (collapsed.has(allTaches[i].id)) return false;
        break;
      }
    }
    return true;
  });

  const filteredTaches = visibleTaches.filter(t => {
    const q = search.toLowerCase();
    return !q || t.nom.toLowerCase().includes(q);
  });

  // KPIs
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const totalTaches = allTaches.length;
  const enCours = allTaches.filter(t => t.statutTache === 'en_cours').length;
  const terminees = allTaches.filter(t => t.statutTache === 'termine').length;
  const enRetard = allTaches.filter(t => {
    if (t.statutTache === 'termine') return false;
    return new Date(t.dateFin) < today;
  }).length;
  const avgAvancement = totalTaches
    ? Math.round(allTaches.reduce((s, t) => s + t.avancement, 0) / totalTaches)
    : 0;

  function toggleCollapse(id: string) {
    setCollapsed(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function hasChildren(t: TacheWBS): boolean {
    const idx = allTaches.indexOf(t);
    return idx < allTaches.length - 1 && allTaches[idx + 1].niveau > t.niveau;
  }

  function getEditValue(tacheId: string, field: string, defaultVal: string): string {
    return editValues[tacheId]?.[field] ?? defaultVal;
  }

  function setEditValue(tacheId: string, field: string, val: string) {
    setEditValues(prev => ({ ...prev, [tacheId]: { ...prev[tacheId], [field]: val } }));
  }

  function commitEdit(projetId: string, tacheId: string, field: string, rawVal: string) {
    const patch: Partial<TacheWBS> = {};
    if (field === 'nom') patch.nom = rawVal;
    else if (field === 'duree') patch.duree = parseInt(rawVal) || 1;
    else if (field === 'dateDebut') patch.dateDebut = rawVal;
    else if (field === 'dateFin') patch.dateFin = rawVal;
    else if (field === 'predecesseurs') {
      // parse e.g. "3FS"
      const match = rawVal.match(/^(\d+)(FS|SS|FF|SF)?$/);
      if (match) {
        const ord = parseInt(match[1]);
        const dt = (match[2] ?? 'FS') as DepType;
        const pred = allTaches.find(t => t.ordre === ord);
        patch.predecesseurs = pred ? [{ tacheId: pred.id, type: dt, delai: 0 }] : [];
      }
    }
    if (Object.keys(patch).length) {
      store.updateTache(projetId, tacheId, patch);
    }
    setEditingCell(null);
  }

  function getResourceCellRef(tacheId: string): React.RefObject<HTMLTableCellElement | null> {
    if (!resourceCellRefs.current[tacheId]) {
      resourceCellRefs.current[tacheId] = React.createRef<HTMLTableCellElement>();
    }
    return resourceCellRefs.current[tacheId];
  }

  function predLabel(t: TacheWBS): string {
    if (!t.predecesseurs.length) return '';
    return t.predecesseurs.map(p => {
      const pred = allTaches.find(x => x.id === p.tacheId);
      return pred ? `${pred.ordre}${p.type}` : p.tacheId;
    }).join(', ');
  }

  const isRetard = useCallback((t: TacheWBS) => {
    if (t.statutTache === 'termine') return false;
    return new Date(t.dateFin) < today;
  }, [today]);

  const KANBAN_COLS: StatutTache[] = ['a_faire', 'en_cours', 'bloque', 'termine'];

  // ── Render ──────────────────────────────────────────────────────────────────

  const viewBtnStyle = (active: boolean): React.CSSProperties => ({
    padding: '6px 14px',
    background: active ? '#1B4F8A' : '#F1F5F9',
    color: active ? '#fff' : '#374151',
    border: 'none',
    borderRadius: 7,
    fontSize: 12,
    fontWeight: 600,
    cursor: 'pointer',
    display: 'inline-flex',
    alignItems: 'center',
    gap: 5,
    fontFamily: 'inherit',
  });

  const kpiStyle: React.CSSProperties = {
    background: '#fff',
    borderRadius: 10,
    padding: '14px 18px',
    flex: 1,
    minWidth: 120,
    boxShadow: '0 1px 4px rgba(0,0,0,0.06)',
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', overflowY: 'auto', background: '#F4F6F9', padding: '20px 24px' }}>

      {/* ── Top bar ── */}
      <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap', marginBottom: 16 }}>
        <select
          value={selectedProjetId}
          onChange={e => setSelectedProjetId(e.target.value)}
          style={{ ...inp, fontSize: 13, fontWeight: 600, minWidth: 240, flex: 1 }}
        >
          {store.projets.map(p => (
            <option key={p.id} value={p.id}>{p.code} — {p.nom}</option>
          ))}
        </select>

        <div style={{ display: 'flex', gap: 4 }}>
          <button style={viewBtnStyle(view === 'liste')} onClick={() => setView('liste')}>
            <LayoutList size={14} /> Liste
          </button>
          <button style={viewBtnStyle(view === 'kanban')} onClick={() => setView('kanban')}>
            <Columns size={14} /> Kanban
          </button>
          <button style={viewBtnStyle(view === 'planning')} onClick={() => setView('planning')}>
            <BarChart2 size={14} /> Planning
          </button>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 7, padding: '6px 11px', border: '1px solid #CBD5E1', borderRadius: 7, background: '#fff', minWidth: 160 }}>
          <Search size={13} style={{ color: '#94A3B8', flexShrink: 0 }} />
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Rechercher une tâche…"
            style={{ border: 'none', background: 'transparent', outline: 'none', fontSize: 12, fontFamily: 'inherit', color: '#1A1A2E', width: '100%' }}
          />
        </div>

        <button
          style={{ ...btn('#F47920', '#fff'), cursor: selectedProjet ? 'pointer' : 'not-allowed', opacity: selectedProjet ? 1 : 0.5 }}
          onClick={() => selectedProjet && setShowModal(true)}
          disabled={!selectedProjet}
          title={selectedProjet ? 'Créer une nouvelle tâche' : 'Sélectionnez un projet d\'abord'}
        >
          <Plus size={14} /> Nouvelle tâche
        </button>
        <button
          style={{ ...btn('#1B4F8A', '#fff'), cursor: selectedProjet ? 'pointer' : 'not-allowed', opacity: selectedProjet ? 1 : 0.5 }}
          onClick={() => selectedProjet && store.saveBaseline(selectedProjetId)}
          disabled={!selectedProjet}
          title={selectedProjet ? 'Enregistrer le planning de référence' : 'Sélectionnez un projet d\'abord'}
        >
          <Save size={14} /> Enregistrer baseline
        </button>
      </div>

      {/* ── KPI strip ── */}
      <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', marginBottom: 16 }}>
        <div style={kpiStyle}>
          <div style={{ fontSize: 10, color: '#94A3B8', fontWeight: 600, textTransform: 'uppercase', letterSpacing: 0.5 }}>Total tâches</div>
          <div style={{ fontSize: 26, fontWeight: 800, color: '#1B4F8A' }}>{totalTaches}</div>
        </div>
        <div style={kpiStyle}>
          <div style={{ fontSize: 10, color: '#94A3B8', fontWeight: 600, textTransform: 'uppercase', letterSpacing: 0.5 }}>En cours</div>
          <div style={{ fontSize: 26, fontWeight: 800, color: '#F47920' }}>{enCours}</div>
        </div>
        <div style={kpiStyle}>
          <div style={{ fontSize: 10, color: '#94A3B8', fontWeight: 600, textTransform: 'uppercase', letterSpacing: 0.5 }}>Terminées</div>
          <div style={{ fontSize: 26, fontWeight: 800, color: '#16A34A' }}>{terminees}</div>
        </div>
        <div style={kpiStyle}>
          <div style={{ fontSize: 10, color: '#94A3B8', fontWeight: 600, textTransform: 'uppercase', letterSpacing: 0.5 }}>En retard</div>
          <div style={{ fontSize: 26, fontWeight: 800, color: '#EF3340' }}>{enRetard}</div>
        </div>
        <div style={kpiStyle}>
          <div style={{ fontSize: 10, color: '#94A3B8', fontWeight: 600, textTransform: 'uppercase', letterSpacing: 0.5 }}>% Avancement moy.</div>
          <div style={{ fontSize: 26, fontWeight: 800, color: '#374151' }}>{avgAvancement}%</div>
          <div style={{ marginTop: 4, height: 4, background: '#E2E8F0', borderRadius: 4 }}>
            <div style={{ height: 4, background: '#F47920', borderRadius: 4, width: `${avgAvancement}%` }} />
          </div>
        </div>
      </div>

      {/* ── No project selected ── */}
      {!selectedProjet && (
        <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', gap: 12, color: '#94A3B8' }}>
          <LayoutList size={48} style={{ opacity: 0.3 }} />
          <div style={{ fontSize: 15, fontWeight: 600 }}>Sélectionner un projet pour afficher ses tâches</div>
        </div>
      )}

      {/* ── Liste view ── */}
      {selectedProjet && view === 'liste' && (
        <div style={{ background: '#fff', borderRadius: 12, overflow: 'hidden', boxShadow: '0 1px 4px rgba(0,0,0,0.06)' }}>
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
              <thead>
                <tr style={{ background: '#1B4F8A', color: '#fff' }}>
                  <th style={{ padding: '10px 8px', width: 32, textAlign: 'center' }}>#</th>
                  <th style={{ padding: '10px 12px', textAlign: 'left', minWidth: 200 }}>Nom</th>
                  <th style={{ padding: '10px 8px', textAlign: 'center', whiteSpace: 'nowrap' }}>Type</th>
                  <th style={{ padding: '10px 8px', textAlign: 'center' }}>Durée</th>
                  <th style={{ padding: '10px 8px', textAlign: 'center', whiteSpace: 'nowrap' }}>Début</th>
                  <th style={{ padding: '10px 8px', textAlign: 'center', whiteSpace: 'nowrap' }}>Fin</th>
                  <th style={{ padding: '10px 8px', textAlign: 'center', whiteSpace: 'nowrap' }}>Prédécesseur</th>
                  <th style={{ padding: '10px 8px', textAlign: 'left', minWidth: 120 }}>Ressources</th>
                  <th style={{ padding: '10px 8px', textAlign: 'center', minWidth: 140 }}>Avancement</th>
                  <th style={{ padding: '10px 8px', textAlign: 'center' }}>Statut</th>
                  <th style={{ padding: '10px 8px', textAlign: 'center', whiteSpace: 'nowrap' }}>Livrables</th>
                  <th style={{ padding: '10px 8px', textAlign: 'center' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredTaches.length === 0 && (
                  <tr>
                    <td colSpan={12} style={{ textAlign: 'center', padding: 32, color: '#94A3B8' }}>
                      Aucune tâche{search ? ' correspondant à la recherche' : ''}
                    </td>
                  </tr>
                )}
                {filteredTaches.map((t, i) => {
                  const isRecap = t.type === 'Récapitulative';
                  const isJalon = t.type === 'Jalon';
                  const retard = isRetard(t);
                  const sc = TACHE_STATUT_CFG[t.statutTache];
                  const pc = PRIORITE_CFG[t.priorite];
                  const rowBg = isRecap ? '#EFF6FF' : isJalon ? '#FFFBEB' : i % 2 === 0 ? '#fff' : '#FAFAFA';
                  const assignedNames = t.assignations.map(a => {
                    const r = store.ressources.find(x => x.id === a.ressourceId);
                    return r ? `${r.prenom} ${r.nom}`.trim() : a.ressourceId;
                  });
                  const predLabel_ = predLabel(t);
                  const resRef = getResourceCellRef(t.id);

                  return (
                    <tr
                      key={t.id}
                      style={{ background: rowBg, borderBottom: '1px solid #F1F5F9', transition: 'background 0.1s' }}
                    >
                      {/* # */}
                      <td style={{ padding: '6px 8px', textAlign: 'center', color: '#94A3B8', fontWeight: 600 }}>
                        {t.ordre}
                      </td>

                      {/* Nom */}
                      <td style={{ padding: '6px 12px', paddingLeft: 12 + (t.niveau - 1) * 16 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                          {isRecap && hasChildren(t) && (
                            <button
                              onClick={() => toggleCollapse(t.id)}
                              aria-label={collapsed.has(t.id) ? `Développer ${t.nom}` : `Réduire ${t.nom}`}
                              style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0, color: '#1B4F8A', display: 'flex' }}
                            >
                              {collapsed.has(t.id) ? <ChevronRight size={14} /> : <ChevronDown size={14} />}
                            </button>
                          )}
                          {isJalon && <Diamond size={12} style={{ color: '#F59E0B', flexShrink: 0 }} />}
                          {editingCell?.tacheId === t.id && editingCell?.field === 'nom' ? (
                            <input
                              autoFocus
                              value={getEditValue(t.id, 'nom', t.nom)}
                              onChange={e => setEditValue(t.id, 'nom', e.target.value)}
                              onBlur={() => commitEdit(selectedProjetId, t.id, 'nom', getEditValue(t.id, 'nom', t.nom))}
                              onKeyDown={e => {
                                if (e.key === 'Enter') commitEdit(selectedProjetId, t.id, 'nom', getEditValue(t.id, 'nom', t.nom));
                                if (e.key === 'Escape') setEditingCell(null);
                              }}
                              style={{ ...inp, width: 180 }}
                            />
                          ) : (
                            <span
                              onDoubleClick={() => { setEditingCell({ tacheId: t.id, field: 'nom' }); setEditValue(t.id, 'nom', t.nom); }}
                              style={{ fontWeight: isRecap ? 700 : 400, color: '#1A1A2E', cursor: 'text', fontSize: 12 }}
                              title="Double-cliquer pour modifier"
                            >
                              {t.nom}
                            </span>
                          )}
                        </div>
                      </td>

                      {/* Type */}
                      <td style={{ padding: '6px 8px', textAlign: 'center' }}>
                        <span style={pill(isRecap ? '#DBEAFE' : isJalon ? '#FEF3C7' : '#F3F4F6', isRecap ? '#1E40AF' : isJalon ? '#92400E' : '#374151')}>
                          {t.type}
                        </span>
                      </td>

                      {/* Durée */}
                      <td style={{ padding: '6px 8px', textAlign: 'center' }}>
                        {editingCell?.tacheId === t.id && editingCell?.field === 'duree' ? (
                          <input
                            autoFocus
                            type="number"
                            min={1}
                            value={getEditValue(t.id, 'duree', String(t.duree))}
                            onChange={e => setEditValue(t.id, 'duree', e.target.value)}
                            onBlur={() => commitEdit(selectedProjetId, t.id, 'duree', getEditValue(t.id, 'duree', String(t.duree)))}
                            onKeyDown={e => {
                              if (e.key === 'Enter') commitEdit(selectedProjetId, t.id, 'duree', getEditValue(t.id, 'duree', String(t.duree)));
                              if (e.key === 'Escape') setEditingCell(null);
                            }}
                            style={{ ...inp, width: 52 }}
                          />
                        ) : (
                          <span
                            onDoubleClick={() => { setEditingCell({ tacheId: t.id, field: 'duree' }); setEditValue(t.id, 'duree', String(t.duree)); }}
                            style={{ cursor: 'text', color: '#374151' }}
                            title="Double-cliquer pour modifier"
                          >
                            {t.duree}j
                          </span>
                        )}
                      </td>

                      {/* Début */}
                      <td style={{ padding: '6px 8px', textAlign: 'center', whiteSpace: 'nowrap', color: retard ? '#E2231A' : '#374151', fontWeight: retard ? 700 : 400 }}>
                        {editingCell?.tacheId === t.id && editingCell?.field === 'dateDebut' ? (
                          <input
                            autoFocus
                            type="date"
                            value={getEditValue(t.id, 'dateDebut', t.dateDebut)}
                            onChange={e => setEditValue(t.id, 'dateDebut', e.target.value)}
                            onBlur={() => commitEdit(selectedProjetId, t.id, 'dateDebut', getEditValue(t.id, 'dateDebut', t.dateDebut))}
                            onKeyDown={e => {
                              if (e.key === 'Enter') commitEdit(selectedProjetId, t.id, 'dateDebut', getEditValue(t.id, 'dateDebut', t.dateDebut));
                              if (e.key === 'Escape') setEditingCell(null);
                            }}
                            style={{ ...inp }}
                          />
                        ) : (
                          <span onDoubleClick={() => { setEditingCell({ tacheId: t.id, field: 'dateDebut' }); setEditValue(t.id, 'dateDebut', t.dateDebut); }} style={{ cursor: 'text' }} title="Double-cliquer pour modifier">
                            {t.dateDebut}
                          </span>
                        )}
                      </td>

                      {/* Fin */}
                      <td style={{ padding: '6px 8px', textAlign: 'center', whiteSpace: 'nowrap', color: retard ? '#E2231A' : '#374151', fontWeight: retard ? 700 : 400 }}>
                        {editingCell?.tacheId === t.id && editingCell?.field === 'dateFin' ? (
                          <input
                            autoFocus
                            type="date"
                            value={getEditValue(t.id, 'dateFin', t.dateFin)}
                            onChange={e => setEditValue(t.id, 'dateFin', e.target.value)}
                            onBlur={() => commitEdit(selectedProjetId, t.id, 'dateFin', getEditValue(t.id, 'dateFin', t.dateFin))}
                            onKeyDown={e => {
                              if (e.key === 'Enter') commitEdit(selectedProjetId, t.id, 'dateFin', getEditValue(t.id, 'dateFin', t.dateFin));
                              if (e.key === 'Escape') setEditingCell(null);
                            }}
                            style={{ ...inp }}
                          />
                        ) : (
                          <span onDoubleClick={() => { setEditingCell({ tacheId: t.id, field: 'dateFin' }); setEditValue(t.id, 'dateFin', t.dateFin); }} style={{ cursor: 'text' }} title="Double-cliquer pour modifier">
                            {t.dateFin}
                          </span>
                        )}
                      </td>

                      {/* Prédécesseur */}
                      <td style={{ padding: '6px 8px', textAlign: 'center' }}>
                        {editingCell?.tacheId === t.id && editingCell?.field === 'predecesseurs' ? (
                          <input
                            autoFocus
                            value={getEditValue(t.id, 'predecesseurs', predLabel_)}
                            onChange={e => setEditValue(t.id, 'predecesseurs', e.target.value)}
                            onBlur={() => commitEdit(selectedProjetId, t.id, 'predecesseurs', getEditValue(t.id, 'predecesseurs', predLabel_))}
                            onKeyDown={e => {
                              if (e.key === 'Enter') commitEdit(selectedProjetId, t.id, 'predecesseurs', getEditValue(t.id, 'predecesseurs', predLabel_));
                              if (e.key === 'Escape') setEditingCell(null);
                            }}
                            placeholder="ex: 3FS"
                            style={{ ...inp, width: 68 }}
                          />
                        ) : (
                          <span
                            onDoubleClick={() => { setEditingCell({ tacheId: t.id, field: 'predecesseurs' }); setEditValue(t.id, 'predecesseurs', predLabel_); }}
                            style={{ cursor: 'text', color: '#6B7280', fontSize: 11 }}
                            title="Double-cliquer pour modifier (ex: 3FS)"
                          >
                            {predLabel_ || <span style={{ color: '#CBD5E1' }}>—</span>}
                          </span>
                        )}
                      </td>

                      {/* Ressources */}
                      <td
                        ref={resRef}
                        style={{ padding: '6px 8px', position: 'relative' }}
                      >
                        <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', alignItems: 'center' }}>
                          {assignedNames.slice(0, 2).map((n, ni) => (
                            <span key={ni} style={{ fontSize: 10, background: '#EFF6FF', color: '#1E40AF', borderRadius: 4, padding: '1px 5px' }}>{n}</span>
                          ))}
                          {assignedNames.length > 2 && (
                            <span style={{ fontSize: 10, color: '#94A3B8' }}>+{assignedNames.length - 2}</span>
                          )}
                          <button
                            onClick={() => setResourcePopover(resourcePopover === t.id ? null : t.id)}
                            aria-label="Gérer les ressources affectées"
                            title="Affecter / retirer des ressources"
                            style={{ background: 'none', border: '1px solid #CBD5E1', borderRadius: 4, cursor: 'pointer', padding: '1px 5px', color: '#64748B', fontSize: 10, fontFamily: 'inherit' }}
                          >
                            <UserPlus size={10} />
                          </button>
                        </div>
                        {resourcePopover === t.id && (
                          <ResourcePopover
                            tache={t}
                            ressources={store.ressources}
                            projetId={selectedProjetId}
                            onClose={() => setResourcePopover(null)}
                            anchorRef={resRef}
                            onAssign={(ressourceId, unite) => store.assignRessource(selectedProjetId, t.id, ressourceId, unite)}
                            onRemove={(asgnId) => store.removeAssignation(selectedProjetId, t.id, asgnId)}
                          />
                        )}
                      </td>

                      {/* Avancement */}
                      <td style={{ padding: '6px 8px', minWidth: 140 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                          <div style={{ flex: 1, height: 6, background: '#E2E8F0', borderRadius: 4, overflow: 'hidden' }}>
                            <div style={{ height: 6, background: '#F47920', borderRadius: 4, width: `${t.avancement}%`, transition: 'width 0.3s' }} />
                          </div>
                          <input
                            type="number"
                            min={0}
                            max={100}
                            value={t.avancement}
                            onChange={e => {
                              const v = Math.max(0, Math.min(100, parseInt(e.target.value) || 0));
                              store.updateAvancement(selectedProjetId, t.id, v);
                            }}
                            style={{ ...inp, width: 44, padding: '2px 4px', textAlign: 'center' }}
                          />
                          <span style={{ fontSize: 10, color: '#94A3B8' }}>%</span>
                        </div>
                      </td>

                      {/* Statut */}
                      <td style={{ padding: '6px 8px', textAlign: 'center' }}>
                        <select
                          value={t.statutTache}
                          onChange={e => store.updateTache(selectedProjetId, t.id, { statutTache: e.target.value as StatutTache })}
                          style={{ ...inp, padding: '3px 6px', background: sc.bg, color: sc.color, fontWeight: 600, border: 'none', borderRadius: 8 }}
                        >
                          <option value="a_faire">À faire</option>
                          <option value="en_cours">En cours</option>
                          <option value="bloque">Bloqué</option>
                          <option value="termine">Terminé</option>
                        </select>
                      </td>

                      {/* Livrables */}
                      <td style={{ padding: '6px 8px', textAlign: 'center' }}>
                        <button
                          onClick={() => {
                            setLivrableTaskId(t.id);
                            setLivrableForm({ nom: '', typeLivrable: 'General', proprietaireNom: '', dateRequise: '', priorite: 'Moyenne', statut: 'Nouveau' });
                            setLivrableEdit(null);
                          }}
                          title="Gérer les livrables"
                          style={{ background: (t.livrables?.length ?? 0) > 0 ? '#EDE9FE' : '#F8FAFC', border: `1px solid ${(t.livrables?.length ?? 0) > 0 ? '#DDD6FE' : '#E2E8F0'}`, borderRadius: 6, cursor: 'pointer', padding: '3px 8px', display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 10, fontWeight: 700, color: (t.livrables?.length ?? 0) > 0 ? '#7C3AED' : '#94A3B8' }}>
                          <FileText size={11} />
                          {(t.livrables?.length ?? 0) > 0 ? t.livrables!.length : '+'}
                        </button>
                      </td>

                      {/* Actions */}
                      <td style={{ padding: '6px 8px', textAlign: 'center', whiteSpace: 'nowrap' }}>
                        <button
                          onClick={() => setEditModalTache(t)}
                          style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#1B4F8A', padding: '2px 4px' }}
                          aria-label={`Modifier la tâche ${t.nom}`}
                          title="Modifier"
                        >
                          <Edit2 size={13} />
                        </button>
                        <button
                          onClick={() => { if (confirm(`Supprimer « ${t.nom} » ?`)) store.deleteTache(selectedProjetId, t.id); }}
                          style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#EF3340', padding: '2px 4px' }}
                          aria-label={`Supprimer la tâche ${t.nom}`}
                          title="Supprimer"
                        >
                          <Trash2 size={13} />
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ── Kanban view ── */}
      {selectedProjet && view === 'kanban' && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 14, minWidth: 720, overflowX: 'auto' }}>
          {KANBAN_COLS.map(col => {
            const sc = TACHE_STATUT_CFG[col];
            const items = allTaches.filter(t => t.statutTache === col && (!search || t.nom.toLowerCase().includes(search.toLowerCase())));
            return (
              <div key={col} style={{ background: '#F8FAFC', borderRadius: 10, padding: 12, minHeight: 380, border: '1px solid #E2E8F0' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
                  <span style={{ fontSize: 12, fontWeight: 700, color: '#374151' }}>{sc.label}</span>
                  <span style={pill(sc.bg, sc.color)}>{items.length}</span>
                </div>
                {items.map(t => {
                  const pc = PRIORITE_CFG[t.priorite];
                  const retard = isRetard(t);
                  const assignedNames = t.assignations.map(a => {
                    const r = store.ressources.find(x => x.id === a.ressourceId);
                    return r ? `${r.prenom} ${r.nom}`.trim() : '';
                  }).filter(Boolean);
                  return (
                    <div
                      key={t.id}
                      style={{
                        background: '#fff',
                        borderRadius: 8,
                        padding: '10px 12px',
                        marginBottom: 8,
                        boxShadow: '0 1px 3px rgba(0,0,0,0.07)',
                        borderLeft: `3px solid ${t.priorite === 'Haute' ? '#EF3340' : t.priorite === 'Moyenne' ? '#F47920' : '#16A34A'}`,
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 4, marginBottom: 4 }}>
                        {t.type === 'Jalon' && <Diamond size={10} style={{ color: '#F59E0B', marginTop: 2, flexShrink: 0 }} />}
                        <div style={{ fontSize: 12, fontWeight: 600, color: '#1A1A2E', lineHeight: 1.3 }}>{t.nom}</div>
                      </div>
                      <div style={{ fontSize: 10, color: '#94A3B8', marginBottom: 6 }}>{selectedProjet.code}</div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 4 }}>
                        <span style={pill(pc.bg, pc.color)}>{pc.label}</span>
                        <span style={{ fontSize: 10, color: retard ? '#E2231A' : '#94A3B8', fontWeight: retard ? 700 : 400 }}>
                          {t.dateFin}
                        </span>
                      </div>
                      {assignedNames.length > 0 && (
                        <div style={{ marginTop: 6, fontSize: 10, color: '#6B7280' }}>
                          {assignedNames.slice(0, 2).join(', ')}{assignedNames.length > 2 ? ` +${assignedNames.length - 2}` : ''}
                        </div>
                      )}
                      <div style={{ marginTop: 8, height: 4, background: '#E2E8F0', borderRadius: 4 }}>
                        <div style={{ height: 4, background: '#F47920', borderRadius: 4, width: `${t.avancement}%` }} />
                      </div>
                      <div style={{ fontSize: 10, color: '#94A3B8', textAlign: 'right', marginTop: 2 }}>{t.avancement}%</div>
                    </div>
                  );
                })}
                {items.length === 0 && (
                  <div style={{ textAlign: 'center', padding: '24px 0', color: '#CBD5E1', fontSize: 12 }}>Aucune tâche</div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* ── Planning (Gantt-lite) view ── */}
      {selectedProjet && view === 'planning' && (
        <div style={{ background: '#fff', borderRadius: 12, overflow: 'hidden', boxShadow: '0 1px 4px rgba(0,0,0,0.06)' }}>
          <GanttView taches={allTaches} collapsed={collapsed} />
        </div>
      )}

      {/* ── Nouvelle tâche modal ── */}
      {showModal && selectedProjet && (
        <NouvelleModal
          projetId={selectedProjetId}
          taches={allTaches}
          onSave={data => store.createTache(data)}
          onClose={() => setShowModal(false)}
        />
      )}

      {/* ── Modifier tâche modal ── */}
      {editModalTache && selectedProjet && (
        <EditTaskModal
          projetId={selectedProjetId}
          tache={editModalTache}
          taches={allTaches}
          onSave={patch => store.updateTache(selectedProjetId, editModalTache.id, patch)}
          onClose={() => setEditModalTache(null)}
          onDelete={() => { store.deleteTache(selectedProjetId, editModalTache.id); setEditModalTache(null); }}
        />
      )}

      {/* ══ MODAL : Gérer les livrables ══ */}
      {livrableTaskId && selectedProjet && (() => {
        const tache = allTaches.find(t => t.id === livrableTaskId);
        if (!tache) return null;
        const livrables = tache.livrables ?? [];
        const STATUT_LBL: Record<StatutLivrable, { label: string; bg: string; color: string }> = {
          Nouveau:   { label: 'Nouveau',   bg: '#F3F4F6', color: '#374151' },
          En_cours:  { label: 'En cours',  bg: '#DBEAFE', color: '#1E40AF' },
          Termine:   { label: 'Terminé',   bg: '#DCFCE7', color: '#166534' },
          Rejete:    { label: 'Rejeté',    bg: '#FEE2E2', color: '#991B1B' },
        };
        const PRIO_LBL: Record<PrioriteLivrable, string> = { Elevee: '🔴 Élevée', Moyenne: '🟡 Moyenne', Faible: '🟢 Faible' };
        return (
          <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)', zIndex: 3000, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <div style={{ background: '#fff', borderRadius: 14, padding: 24, width: 700, maxHeight: '88vh', overflow: 'hidden', display: 'flex', flexDirection: 'column', boxShadow: '0 20px 60px rgba(0,0,0,0.25)' }}>
              {/* Header */}
              <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 20 }}>
                <div>
                  <div style={{ fontWeight: 800, fontSize: 15, color: '#1B4F8A' }}>Gérer les livrables</div>
                  <div style={{ fontSize: 12, color: '#64748B', marginTop: 2 }}>Tâche : {tache.nom}</div>
                </div>
                <button onClick={() => setLivrableTaskId(null)} style={{ border: 'none', background: 'none', cursor: 'pointer', fontSize: 20, color: '#9CA3AF' }}>×</button>
              </div>

              {/* Add/Edit form */}
              <div style={{ background: '#F8FAFC', border: '1px solid #E2E8F0', borderRadius: 10, padding: '14px 16px', marginBottom: 16 }}>
                <div style={{ fontWeight: 700, fontSize: 12, color: '#374151', marginBottom: 10 }}>
                  {livrableEdit ? '✏️ Modifier le livrable' : '+ Nouveau livrable'}
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                  <div>
                    <label style={{ fontSize: 10, fontWeight: 700, color: '#6B7280', display: 'block', marginBottom: 3 }}>* Nom</label>
                    <input value={livrableForm.nom} onChange={e => setLivrableForm(f => ({ ...f, nom: e.target.value }))}
                      placeholder="Ex: Bordereau des livraisons"
                      style={{ width: '100%', padding: '6px 8px', border: '1px solid #CBD5E1', borderRadius: 6, fontSize: 12, boxSizing: 'border-box' }} />
                  </div>
                  <div>
                    <label style={{ fontSize: 10, fontWeight: 700, color: '#6B7280', display: 'block', marginBottom: 3 }}>Type</label>
                    <select value={livrableForm.typeLivrable} onChange={e => setLivrableForm(f => ({ ...f, typeLivrable: e.target.value as TypeLivrable }))}
                      style={{ width: '100%', padding: '6px 8px', border: '1px solid #CBD5E1', borderRadius: 6, fontSize: 12, boxSizing: 'border-box' }}>
                      {(['Bordereau','Plan','Rapport','PV','Contrat','Note','General'] as TypeLivrable[]).map(t => (
                        <option key={t} value={t}>{t}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label style={{ fontSize: 10, fontWeight: 700, color: '#6B7280', display: 'block', marginBottom: 3 }}>Propriétaire</label>
                    <input value={livrableForm.proprietaireNom} onChange={e => setLivrableForm(f => ({ ...f, proprietaireNom: e.target.value }))}
                      placeholder="Nom du propriétaire"
                      style={{ width: '100%', padding: '6px 8px', border: '1px solid #CBD5E1', borderRadius: 6, fontSize: 12, boxSizing: 'border-box' }} />
                  </div>
                  <div>
                    <label style={{ fontSize: 10, fontWeight: 700, color: '#6B7280', display: 'block', marginBottom: 3 }}>Date requise</label>
                    <input type="date" value={livrableForm.dateRequise} onChange={e => setLivrableForm(f => ({ ...f, dateRequise: e.target.value }))}
                      style={{ width: '100%', padding: '6px 8px', border: '1px solid #CBD5E1', borderRadius: 6, fontSize: 12, boxSizing: 'border-box' }} />
                  </div>
                  <div>
                    <label style={{ fontSize: 10, fontWeight: 700, color: '#6B7280', display: 'block', marginBottom: 3 }}>Priorité</label>
                    <select value={livrableForm.priorite} onChange={e => setLivrableForm(f => ({ ...f, priorite: e.target.value as PrioriteLivrable }))}
                      style={{ width: '100%', padding: '6px 8px', border: '1px solid #CBD5E1', borderRadius: 6, fontSize: 12, boxSizing: 'border-box' }}>
                      <option value="Elevee">Élevée</option>
                      <option value="Moyenne">Moyenne</option>
                      <option value="Faible">Faible</option>
                    </select>
                  </div>
                  <div>
                    <label style={{ fontSize: 10, fontWeight: 700, color: '#6B7280', display: 'block', marginBottom: 3 }}>Statut</label>
                    <select value={livrableForm.statut} onChange={e => setLivrableForm(f => ({ ...f, statut: e.target.value as StatutLivrable }))}
                      style={{ width: '100%', padding: '6px 8px', border: '1px solid #CBD5E1', borderRadius: 6, fontSize: 12, boxSizing: 'border-box' }}>
                      <option value="Nouveau">Nouveau</option>
                      <option value="En_cours">En cours</option>
                      <option value="Termine">Terminé</option>
                      <option value="Rejete">Rejeté</option>
                    </select>
                  </div>
                </div>
                <div style={{ display: 'flex', gap: 8, marginTop: 12, justifyContent: 'flex-end' }}>
                  {livrableEdit && (
                    <button onClick={() => { setLivrableEdit(null); setLivrableForm({ nom: '', typeLivrable: 'General', proprietaireNom: '', dateRequise: '', priorite: 'Moyenne', statut: 'Nouveau' }); }}
                      style={{ padding: '6px 14px', border: '1px solid #D1D5DB', background: '#fff', borderRadius: 6, fontSize: 11, cursor: 'pointer' }}>
                      Annuler
                    </button>
                  )}
                  <button onClick={() => {
                    if (!livrableForm.nom.trim()) return;
                    const user = (() => { try { return JSON.parse(localStorage.getItem('sigepp_dpe_user') || 'null'); } catch { return null; } })();
                    if (livrableEdit) {
                      store.updateLivrable(selectedProjetId, livrableTaskId, livrableEdit, { ...livrableForm });
                      setLivrableEdit(null);
                    } else {
                      store.addLivrable(selectedProjetId, livrableTaskId, { ...livrableForm, proprietaireId: user?.id ?? 'u-current', piecesJointes: [], creePar: user ? `${user.prenom} ${user.nom}` : 'Utilisateur' });
                    }
                    setLivrableForm({ nom: '', typeLivrable: 'General', proprietaireNom: '', dateRequise: '', priorite: 'Moyenne', statut: 'Nouveau' });
                  }}
                    disabled={!livrableForm.nom.trim()}
                    style={{ padding: '6px 16px', background: livrableForm.nom.trim() ? '#1B4F8A' : '#CBD5E1', color: '#fff', border: 'none', borderRadius: 6, fontSize: 11, fontWeight: 700, cursor: livrableForm.nom.trim() ? 'pointer' : 'not-allowed', opacity: livrableForm.nom.trim() ? 1 : 0.5 }}>
                    {livrableEdit ? 'Mettre à jour' : 'Enregistrer et fermer'}
                  </button>
                </div>
              </div>

              {/* Livrables list */}
              <div style={{ flex: 1, overflowY: 'auto' }}>
                {livrables.length === 0 ? (
                  <div style={{ textAlign: 'center', padding: 24, color: '#9CA3AF', fontSize: 12 }}>
                    <FileText size={24} style={{ margin: '0 auto 8px' }} />
                    <p>Aucun livrable pour cette tâche.</p>
                  </div>
                ) : (
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 11 }}>
                    <thead>
                      <tr style={{ background: '#F8FAFC' }}>
                        {['Type','Nom','Propriétaire','Date requise','Priorité','Statut','Actions'].map(h => (
                          <th key={h} style={{ padding: '7px 10px', textAlign: 'left', color: '#64748B', fontWeight: 700, borderBottom: '1px solid #E2E8F0', whiteSpace: 'nowrap' }}>{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {livrables.map(lv => {
                        const sc = STATUT_LBL[lv.statut];
                        return (
                          <tr key={lv.id} style={{ borderBottom: '1px solid #F1F5F9' }}>
                            <td style={{ padding: '6px 10px' }}>
                              <span style={{ background: '#EDE9FE', color: '#7C3AED', borderRadius: 6, padding: '2px 7px', fontSize: 10, fontWeight: 700 }}>{lv.typeLivrable}</span>
                            </td>
                            <td style={{ padding: '6px 10px', fontWeight: 600, color: '#1B4F8A', maxWidth: 160, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={lv.nom}>{lv.nom}</td>
                            <td style={{ padding: '6px 10px', color: '#374151' }}>{lv.proprietaireNom || '—'}</td>
                            <td style={{ padding: '6px 10px', color: '#64748B' }}>
                              {lv.dateRequise ? new Date(lv.dateRequise).toLocaleDateString('fr-FR') : '—'}
                              {lv.dateRequise && new Date(lv.dateRequise) < new Date() && lv.statut !== 'Termine' && (
                                <span style={{ marginLeft: 4, color: '#EF4444', fontSize: 9, fontWeight: 800 }}>⚠ RETARD</span>
                              )}
                            </td>
                            <td style={{ padding: '6px 10px' }}>
                              <span style={{ fontSize: 10 }}>{PRIO_LBL[lv.priorite]}</span>
                            </td>
                            <td style={{ padding: '6px 10px' }}>
                              <select value={lv.statut} onChange={e => store.updateLivrable(selectedProjetId, livrableTaskId, lv.id, { statut: e.target.value as StatutLivrable })}
                                style={{ padding: '2px 6px', border: 'none', borderRadius: 8, background: sc.bg, color: sc.color, fontSize: 10, fontWeight: 700, cursor: 'pointer' }}>
                                <option value="Nouveau">Nouveau</option>
                                <option value="En_cours">En cours</option>
                                <option value="Termine">Terminé</option>
                                <option value="Rejete">Rejeté</option>
                              </select>
                            </td>
                            <td style={{ padding: '6px 10px', whiteSpace: 'nowrap' }}>
                              <button onClick={() => {
                                setLivrableEdit(lv.id);
                                setLivrableForm({ nom: lv.nom, typeLivrable: lv.typeLivrable, proprietaireNom: lv.proprietaireNom, dateRequise: lv.dateRequise, priorite: lv.priorite, statut: lv.statut });
                              }}
                                aria-label={`Modifier le livrable ${lv.nom}`}
                                style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#1B4F8A', padding: '2px 4px' }} title="Modifier">
                                <Edit2 size={12} />
                              </button>
                              <button onClick={() => { if (confirm('Supprimer ce livrable ?')) store.deleteLivrable(selectedProjetId, livrableTaskId, lv.id); }}
                                aria-label={`Supprimer le livrable ${lv.nom}`}
                                style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#EF4444', padding: '2px 4px' }} title="Supprimer">
                                <Trash2 size={12} />
                              </button>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                )}
              </div>

              <div style={{ marginTop: 14, display: 'flex', justifyContent: 'flex-end' }}>
                <button onClick={() => setLivrableTaskId(null)}
                  style={{ padding: '8px 20px', border: '1px solid #D1D5DB', background: '#fff', borderRadius: 7, fontSize: 12, cursor: 'pointer' }}>
                  Fermer
                </button>
              </div>
            </div>
          </div>
        );
      })()}
    </div>
  );
}

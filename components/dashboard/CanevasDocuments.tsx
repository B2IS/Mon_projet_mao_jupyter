'use client';

import { useState, useMemo } from 'react';
import {
  FileText, Plus, Search, Copy, Edit3, Trash2,
  Download, Eye, BookOpen, Tag, ChevronRight,
  CheckCircle, Star, Clock,
} from 'lucide-react';
import { useCanevasStore, type Canevas, type CanevasCategorie } from '@/lib/canevasStore';
import toast from 'react-hot-toast';

/* ── Brand ── */
const NAVY   = '#1B4F8A';
const ORANGE = '#F47920';
const GREEN  = '#16A34A';
const AMBER  = '#D97706';
const PURPLE = '#7C3AED';
const RED    = '#EF3340';
const BORDER = '#E2E8F0';

const CAT_COLORS: Record<CanevasCategorie, string> = {
  'Passation Marchés':  NAVY,
  'Suivi-Évaluation':   PURPLE,
  'Réception Travaux':  GREEN,
  'Pilotage Projet':    ORANGE,
  'Gouvernance DPE':    AMBER,
};

const CATEGORIES: CanevasCategorie[] = [
  'Passation Marchés', 'Suivi-Évaluation', 'Réception Travaux', 'Pilotage Projet', 'Gouvernance DPE',
];

/* ── Sous-composant carte ── */
function CanevasCard({
  canevas,
  onView,
  onUse,
  onClone,
  onDelete,
}: {
  canevas: Canevas;
  onView:   () => void;
  onUse:    () => void;
  onClone:  () => void;
  onDelete: () => void;
}) {
  const color = CAT_COLORS[canevas.categorie] ?? NAVY;
  const isOfficial = canevas.statut === 'officiel';

  return (
    <div style={{
      background: '#fff', borderRadius: 12, border: `1px solid ${BORDER}`,
      boxShadow: '0 1px 4px rgba(0,0,0,.06)', display: 'flex', flexDirection: 'column',
      transition: 'box-shadow .15s',
    }}
      onMouseEnter={e => (e.currentTarget.style.boxShadow = '0 4px 16px rgba(0,0,0,.12)')}
      onMouseLeave={e => (e.currentTarget.style.boxShadow = '0 1px 4px rgba(0,0,0,.06)')}
    >
      {/* Header */}
      <div style={{ padding: '14px 16px 10px', borderBottom: `1px solid ${BORDER}` }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}>
          <div style={{ width: 36, height: 36, borderRadius: 8, background: color + '18',
            display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
            <FileText size={17} color={color} />
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
              {isOfficial && (
                <span style={{ fontSize: 9, fontWeight: 700, background: '#FFFBEB', color: AMBER,
                  border: `1px solid ${AMBER}44`, padding: '1px 6px', borderRadius: 10, whiteSpace: 'nowrap' }}>
                  ★ OFFICIEL
                </span>
              )}
              <span style={{ fontSize: 9.5, color: color, fontWeight: 700, background: color + '12',
                padding: '1px 7px', borderRadius: 10, whiteSpace: 'nowrap' }}>
                {canevas.categorie}
              </span>
            </div>
            <p style={{ fontSize: 13, fontWeight: 700, color: '#0F172A', margin: '4px 0 2px',
              lineHeight: 1.3, display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
              {canevas.nom}
            </p>
            <p style={{ fontSize: 11, color: '#64748B', margin: 0,
              display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
              {canevas.description}
            </p>
          </div>
        </div>
      </div>

      {/* Meta */}
      <div style={{ padding: '8px 16px', display: 'flex', gap: 12, fontSize: 10.5, color: '#94A3B8' }}>
        <span title="Référence"><Tag size={10} style={{ marginRight: 3 }} />{canevas.reference}</span>
        <span title="Utilisations"><Star size={10} style={{ marginRight: 3 }} />{canevas.usageCount}×</span>
        <span title="Mise à jour"><Clock size={10} style={{ marginRight: 3 }} />{canevas.dateMAJ}</span>
      </div>

      {/* Variables chips */}
      {canevas.variables.length > 0 && (
        <div style={{ padding: '0 16px 8px', display: 'flex', flexWrap: 'wrap', gap: 4 }}>
          {canevas.variables.slice(0, 4).map(v => (
            <span key={v.cle} style={{ fontSize: 9.5, background: '#F8FAFC', border: `1px solid ${BORDER}`,
              padding: '1px 6px', borderRadius: 8, color: '#64748B', fontFamily: 'monospace' }}>
              {v.cle}
            </span>
          ))}
          {canevas.variables.length > 4 && (
            <span style={{ fontSize: 9.5, color: '#94A3B8' }}>+{canevas.variables.length - 4}</span>
          )}
        </div>
      )}

      {/* Actions */}
      <div style={{ padding: '10px 16px', borderTop: `1px solid ${BORDER}`,
        display: 'flex', gap: 6, marginTop: 'auto' }}>
        <button onClick={onUse} style={{
          flex: 1, background: NAVY, color: '#fff', border: 'none', borderRadius: 7,
          padding: '7px 10px', fontSize: 12, fontWeight: 700, cursor: 'pointer',
          display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 5,
        }}>
          <ChevronRight size={13} /> Utiliser
        </button>
        <button onClick={onView} title="Aperçu" style={{ background: '#F1F5F9', border: 'none', borderRadius: 7, padding: '7px 10px', cursor: 'pointer' }}>
          <Eye size={14} color="#64748B" />
        </button>
        <button onClick={onClone} title="Dupliquer" style={{ background: '#F1F5F9', border: 'none', borderRadius: 7, padding: '7px 10px', cursor: 'pointer' }}>
          <Copy size={14} color="#64748B" />
        </button>
        {canevas.statut !== 'officiel' && (
          <button onClick={onDelete} title="Supprimer" style={{ background: '#FEF2F2', border: 'none', borderRadius: 7, padding: '7px 10px', cursor: 'pointer' }}>
            <Trash2 size={14} color={RED} />
          </button>
        )}
      </div>
    </div>
  );
}

/* ── Modal aperçu / utilisation ── */
function CanevasModal({
  canevas,
  mode,
  onClose,
  onConfirmUse,
}: {
  canevas: Canevas;
  mode: 'view' | 'use';
  onClose: () => void;
  onConfirmUse: (values: Record<string, string>) => void;
}) {
  const [values, setValues] = useState<Record<string, string>>(() => {
    const init: Record<string, string> = {};
    canevas.variables.forEach(v => { init[v.cle] = v.exemple; });
    return init;
  });

  const preview = useMemo(() => {
    let text = canevas.contenu;
    Object.entries(values).forEach(([k, v]) => { text = text.replaceAll(k, v || k); });
    return text;
  }, [canevas.contenu, values]);

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.5)', zIndex: 9999,
      display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
      <div style={{ background: '#fff', borderRadius: 14, width: '100%', maxWidth: 900,
        maxHeight: '90vh', display: 'flex', flexDirection: 'column', boxShadow: '0 20px 60px rgba(0,0,0,.25)' }}>
        {/* Modal header */}
        <div style={{ padding: '16px 20px', borderBottom: `1px solid ${BORDER}`,
          display: 'flex', alignItems: 'center', gap: 12 }}>
          <FileText size={18} color={NAVY} />
          <div style={{ flex: 1 }}>
            <p style={{ margin: 0, fontWeight: 800, fontSize: 14, color: '#0F172A' }}>{canevas.nom}</p>
            <p style={{ margin: 0, fontSize: 11, color: '#64748B' }}>{canevas.reference}</p>
          </div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#94A3B8', fontSize: 20, lineHeight: 1 }}>×</button>
        </div>

        <div style={{ flex: 1, overflow: 'hidden', display: 'flex', minHeight: 0 }}>
          {/* Variables panel (only in "use" mode) */}
          {mode === 'use' && canevas.variables.length > 0 && (
            <div style={{ width: 280, borderRight: `1px solid ${BORDER}`, overflowY: 'auto',
              padding: '14px 16px', display: 'flex', flexDirection: 'column', gap: 10, flexShrink: 0 }}>
              <p style={{ margin: '0 0 4px', fontSize: 11, fontWeight: 700, color: '#64748B',
                textTransform: 'uppercase', letterSpacing: '0.06em' }}>Variables à compléter</p>
              {canevas.variables.map(v => (
                <div key={v.cle}>
                  <label style={{ fontSize: 11, fontWeight: 600, color: '#374151', display: 'block', marginBottom: 3 }}>
                    {v.libelle} {v.obligatoire && <span style={{ color: RED }}>*</span>}
                  </label>
                  <input
                    value={values[v.cle] ?? ''}
                    onChange={e => setValues(prev => ({ ...prev, [v.cle]: e.target.value }))}
                    placeholder={v.exemple}
                    style={{ width: '100%', border: `1px solid ${BORDER}`, borderRadius: 6, padding: '5px 8px',
                      fontSize: 12, boxSizing: 'border-box', outline: 'none', color: '#1E293B' }}
                  />
                  <span style={{ fontSize: 9.5, color: '#94A3B8', fontFamily: 'monospace' }}>{v.cle}</span>
                </div>
              ))}
            </div>
          )}

          {/* Content preview */}
          <div style={{ flex: 1, overflowY: 'auto', padding: '16px 20px' }}>
            <pre style={{ fontFamily: 'inherit', fontSize: 12.5, color: '#1E293B', lineHeight: 1.7,
              whiteSpace: 'pre-wrap', wordBreak: 'break-word', margin: 0 }}>
              {preview}
            </pre>
          </div>
        </div>

        {/* Modal footer */}
        <div style={{ padding: '12px 20px', borderTop: `1px solid ${BORDER}`, display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
          <button onClick={onClose} style={{ background: '#F1F5F9', border: 'none', borderRadius: 7,
            padding: '8px 16px', fontSize: 13, fontWeight: 600, cursor: 'pointer', color: '#374151' }}>
            Fermer
          </button>
          {mode === 'use' && (
            <button onClick={() => onConfirmUse(values)}
              style={{ background: NAVY, color: '#fff', border: 'none', borderRadius: 7,
                padding: '8px 18px', fontSize: 13, fontWeight: 700, cursor: 'pointer',
                display: 'flex', alignItems: 'center', gap: 6 }}>
              <CheckCircle size={14} /> Valider & Créer le document
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

/* ══════════════════════════════════════════════════════════════════════════════
   COMPOSANT PRINCIPAL
   ══════════════════════════════════════════════════════════════════════════════ */
export default function CanevasDocuments() {
  const { canevas, addCanevas, deleteCanevas, incrementUsage } = useCanevasStore();
  const [search, setSearch]         = useState('');
  const [catFilter, setCatFilter]   = useState<CanevasCategorie | 'Tous'>('Tous');
  const [modal, setModal]           = useState<{ canevas: Canevas; mode: 'view' | 'use' } | null>(null);
  const [showNewForm, setShowNewForm] = useState(false);
  const [newNom, setNewNom]         = useState('');
  const [newDesc, setNewDesc]       = useState('');
  const [newCat, setNewCat]         = useState<CanevasCategorie>('Pilotage Projet');

  const filtered = useMemo(() => {
    return canevas.filter(c => {
      if (catFilter !== 'Tous' && c.categorie !== catFilter) return false;
      if (search) {
        const q = search.toLowerCase();
        return c.nom.toLowerCase().includes(q) || c.description.toLowerCase().includes(q) ||
          c.reference.toLowerCase().includes(q);
      }
      return true;
    });
  }, [canevas, catFilter, search]);

  const handleUse = (c: Canevas, values: Record<string, string>) => {
    let contenu = c.contenu;
    Object.entries(values).forEach(([k, v]) => { contenu = contenu.replaceAll(k, v || k); });
    incrementUsage(c.id);
    // Copie dans le presse-papier
    navigator.clipboard.writeText(contenu).catch(() => {});
    toast.success(`Document « ${c.nom} » prêt — contenu copié dans le presse-papier`);
    setModal(null);
  };

  const handleClone = (c: Canevas) => {
    addCanevas({
      ...c,
      nom:    `Copie — ${c.nom}`,
      statut: 'perso',
      auteur: 'Utilisateur',
    });
    toast.success('Canevas cloné dans votre bibliothèque personnelle');
  };

  const handleDelete = (id: string) => {
    if (window.confirm('Supprimer ce canevas personnalisé ?')) {
      deleteCanevas(id);
      toast.success('Canevas supprimé');
    }
  };

  const handleCreateNew = () => {
    if (!newNom.trim()) { toast.error('Nom requis'); return; }
    addCanevas({
      nom: newNom.trim(), categorie: newCat, statut: 'perso',
      description: newDesc.trim() || 'Canevas personnalisé',
      reference: 'Usage interne',
      contenu: `# ${newNom.trim()}\n\n_Rédigez votre canevas ici…_\n\n## Section 1\n\n## Section 2`,
      variables: [],
      auteur: 'Utilisateur',
    });
    setNewNom(''); setNewDesc(''); setShowNewForm(false);
    toast.success('Nouveau canevas créé');
  };

  const countByCategory = useMemo(() => {
    const m: Partial<Record<CanevasCategorie, number>> = {};
    canevas.forEach(c => { m[c.categorie] = (m[c.categorie] ?? 0) + 1; });
    return m;
  }, [canevas]);

  return (
    <div style={{ padding: '20px 24px', maxWidth: 1400, margin: '0 auto' }}>
      {/* ── En-tête ── */}
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 14, marginBottom: 20 }}>
        <div style={{ width: 44, height: 44, borderRadius: 10, background: NAVY + '14',
          display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <BookOpen size={22} color={NAVY} />
        </div>
        <div style={{ flex: 1 }}>
          <h1 style={{ margin: 0, fontSize: 20, fontWeight: 800, color: '#0F172A' }}>
            Bibliothèque de Canevas & Documents-types
          </h1>
          <p style={{ margin: '3px 0 0', fontSize: 12.5, color: '#64748B' }}>
            Canevas officiels DPE · DAPT · Fiches projet · PV Réception · Rapports — utilisables, personnalisables, exportables
          </p>
        </div>
        <button onClick={() => setShowNewForm(v => !v)}
          style={{ display: 'flex', alignItems: 'center', gap: 6, background: NAVY, color: '#fff',
            border: 'none', borderRadius: 8, padding: '8px 14px', fontSize: 13, fontWeight: 700, cursor: 'pointer' }}>
          <Plus size={14} /> Nouveau canevas
        </button>
      </div>

      {/* ── Formulaire nouveau canevas ── */}
      {showNewForm && (
        <div style={{ background: '#F8FAFC', border: `1px solid ${BORDER}`, borderRadius: 10,
          padding: '14px 16px', marginBottom: 16, display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'flex-end' }}>
          <div style={{ flex: 2, minWidth: 200 }}>
            <label style={{ fontSize: 11, fontWeight: 600, color: '#374151', display: 'block', marginBottom: 4 }}>Nom du canevas *</label>
            <input value={newNom} onChange={e => setNewNom(e.target.value)} placeholder="Ex : Note d'orientation projet"
              style={{ width: '100%', border: `1px solid ${BORDER}`, borderRadius: 6, padding: '6px 10px', fontSize: 13, boxSizing: 'border-box' }} />
          </div>
          <div style={{ flex: 1, minWidth: 160 }}>
            <label style={{ fontSize: 11, fontWeight: 600, color: '#374151', display: 'block', marginBottom: 4 }}>Catégorie</label>
            <select value={newCat} onChange={e => setNewCat(e.target.value as CanevasCategorie)}
              style={{ width: '100%', border: `1px solid ${BORDER}`, borderRadius: 6, padding: '6px 10px', fontSize: 13 }}>
              {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>
          <div style={{ flex: 2, minWidth: 200 }}>
            <label style={{ fontSize: 11, fontWeight: 600, color: '#374151', display: 'block', marginBottom: 4 }}>Description</label>
            <input value={newDesc} onChange={e => setNewDesc(e.target.value)} placeholder="Brève description…"
              style={{ width: '100%', border: `1px solid ${BORDER}`, borderRadius: 6, padding: '6px 10px', fontSize: 13, boxSizing: 'border-box' }} />
          </div>
          <button onClick={handleCreateNew}
            style={{ background: GREEN, color: '#fff', border: 'none', borderRadius: 7, padding: '8px 16px', fontSize: 13, fontWeight: 700, cursor: 'pointer' }}>
            Créer
          </button>
          <button onClick={() => setShowNewForm(false)}
            style={{ background: '#F1F5F9', border: 'none', borderRadius: 7, padding: '8px 14px', fontSize: 13, cursor: 'pointer', color: '#64748B' }}>
            Annuler
          </button>
        </div>
      )}

      {/* ── Barre de filtre ── */}
      <div style={{ display: 'flex', gap: 10, marginBottom: 16, flexWrap: 'wrap', alignItems: 'center' }}>
        <div style={{ position: 'relative', flex: 1, minWidth: 200 }}>
          <Search size={13} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: '#94A3B8' }} />
          <input value={search} onChange={e => setSearch(e.target.value)}
            placeholder="Rechercher par nom, description, référence…"
            style={{ width: '100%', paddingLeft: 30, paddingRight: 10, paddingTop: 8, paddingBottom: 8,
              border: `1px solid ${BORDER}`, borderRadius: 8, fontSize: 13, boxSizing: 'border-box', outline: 'none' }} />
        </div>
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
          {(['Tous', ...CATEGORIES] as (CanevasCategorie | 'Tous')[]).map(cat => (
            <button key={cat} onClick={() => setCatFilter(cat)}
              style={{ fontSize: 11.5, fontWeight: 600, borderRadius: 20, padding: '5px 12px', cursor: 'pointer',
                border: `1.5px solid ${catFilter === cat ? (cat === 'Tous' ? NAVY : CAT_COLORS[cat as CanevasCategorie]) : BORDER}`,
                background: catFilter === cat ? (cat === 'Tous' ? NAVY : CAT_COLORS[cat as CanevasCategorie]) + '14' : '#fff',
                color: catFilter === cat ? (cat === 'Tous' ? NAVY : CAT_COLORS[cat as CanevasCategorie]) : '#64748B',
              }}>
              {cat}
              {cat !== 'Tous' && <span style={{ marginLeft: 4, opacity: 0.65 }}>({countByCategory[cat as CanevasCategorie] ?? 0})</span>}
            </button>
          ))}
        </div>
        <span style={{ fontSize: 12, color: '#94A3B8' }}>{filtered.length} canevas</span>
      </div>

      {/* ── Grille ── */}
      {filtered.length === 0 ? (
        <div style={{ textAlign: 'center', padding: 48, color: '#94A3B8', fontSize: 14 }}>
          Aucun canevas correspondant à la recherche.
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: 16 }}>
          {filtered.map(c => (
            <CanevasCard
              key={c.id}
              canevas={c}
              onView={() => setModal({ canevas: c, mode: 'view' })}
              onUse={() => setModal({ canevas: c, mode: 'use' })}
              onClone={() => handleClone(c)}
              onDelete={() => handleDelete(c.id)}
            />
          ))}
        </div>
      )}

      {/* ── Modal ── */}
      {modal && (
        <CanevasModal
          canevas={modal.canevas}
          mode={modal.mode}
          onClose={() => setModal(null)}
          onConfirmUse={(values) => handleUse(modal.canevas, values)}
        />
      )}
    </div>
  );
}

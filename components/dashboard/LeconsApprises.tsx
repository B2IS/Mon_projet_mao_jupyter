'use client';

/**
 * LeconsApprises.tsx — Registre des Leçons Apprises (RETEX)
 * --------------------------------------------------------
 * Les chefs de projet capitalisent les leçons apprises ; les leçons partagées
 * sont consultables par tous les profils pour apprendre des projets passés.
 */

import { useEffect, useMemo, useState } from 'react';
import {
  BookOpen, Plus, Search, ThumbsUp, Trash2, X, Lightbulb, Filter,
} from 'lucide-react';
import { useAuth } from '@/lib/authStore';
import { useProjectStore } from '@/lib/projectStore';
import {
  useLeconsApprisesStore,
  CATEGORIE_LECON_LABEL, PHASE_LECON_LABEL, TYPE_LECON_LABEL, TYPE_LECON_COLOR, IMPACT_LECON_LABEL,
  type LeconApprise, type CategorieLecon, type PhaseLecon, type TypeLecon, type ImpactLecon, type NouvelleLecon,
} from '@/lib/leconsApprisesStore';

const AUTHOR_ROLES = ['CHEF_PROJ', 'CHEF_DEPT', 'INGENIEUR', 'EXPERT', 'CONTROLEUR', 'PMO', 'ADMIN'];

const CATS = Object.keys(CATEGORIE_LECON_LABEL) as CategorieLecon[];
const PHASES = Object.keys(PHASE_LECON_LABEL) as PhaseLecon[];
const TYPES = Object.keys(TYPE_LECON_LABEL) as TypeLecon[];

export default function LeconsApprises() {
  const { user, isRole } = useAuth();
  const store = useProjectStore();
  const { lecons, add, remove, toggleUtile, seed } = useLeconsApprisesStore();

  useEffect(() => { seed(); }, [seed]);

  const canAuthor = AUTHOR_ROLES.some(r => isRole(r as Parameters<typeof isRole>[0]));
  const userId = user?.id ?? '';

  const [query, setQuery] = useState('');
  const [fType, setFType] = useState<TypeLecon | ''>('');
  const [fCat, setFCat] = useState<CategorieLecon | ''>('');
  const [fPhase, setFPhase] = useState<PhaseLecon | ''>('');
  const [showForm, setShowForm] = useState(false);

  // Une leçon est visible si elle est partagée OU si l'utilisateur en est l'auteur.
  const visibles = useMemo(
    () => lecons.filter(l => l.partagee || l.auteurId === userId),
    [lecons, userId],
  );

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return visibles.filter(l =>
      (!fType || l.type === fType) &&
      (!fCat || l.categorie === fCat) &&
      (!fPhase || l.phase === fPhase) &&
      (!q || [l.titre, l.contexte, l.probleme, l.solution, l.recommandation, l.projetNom ?? '', l.tags.join(' ')]
        .join(' ').toLowerCase().includes(q)),
    );
  }, [visibles, query, fType, fCat, fPhase]);

  const kpis = useMemo(() => ({
    total: visibles.length,
    succes: visibles.filter(l => l.type === 'succes').length,
    echec: visibles.filter(l => l.type === 'echec').length,
    amelioration: visibles.filter(l => l.type === 'amelioration').length,
  }), [visibles]);

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minHeight: 0, padding: 16, gap: 12 }}>
      {/* En-tête */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12 }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <BookOpen size={18} style={{ color: 'var(--navy)' }} />
            <h1 style={{ fontSize: 18, fontWeight: 800, color: 'var(--navy)', margin: 0 }}>Registre des leçons apprises</h1>
          </div>
          <p style={{ fontSize: 12, color: 'var(--muted)', margin: '4px 0 0' }}>
            Capitalisation de l'expérience projet (RETEX) — partagée pour apprendre des projets passés.
          </p>
        </div>
        {canAuthor && (
          <button onClick={() => setShowForm(true)} className="btn btn-navy btn-sm" style={{ flexShrink: 0 }}>
            <Plus size={14} /> Nouvelle leçon
          </button>
        )}
      </div>

      {/* KPIs */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: 8 }}>
        <Kpi label="Leçons accessibles" value={kpis.total} color="var(--navy)" />
        <Kpi label="Bonnes pratiques" value={kpis.succes} color={TYPE_LECON_COLOR.succes} />
        <Kpi label="Difficultés" value={kpis.echec} color={TYPE_LECON_COLOR.echec} />
        <Kpi label="Axes d'amélioration" value={kpis.amelioration} color={TYPE_LECON_COLOR.amelioration} />
      </div>

      {/* Filtres */}
      <div className="card" style={{ padding: 10, display: 'flex', flexWrap: 'wrap', gap: 8, alignItems: 'center' }}>
        <div style={{ position: 'relative', flex: 1, minWidth: 180 }}>
          <Search size={13} style={{ position: 'absolute', left: 8, top: 9, color: 'var(--muted)' }} />
          <input value={query} onChange={e => setQuery(e.target.value)} placeholder="Rechercher une leçon…"
            style={{ width: '100%', padding: '6px 8px 6px 28px', fontSize: 12, border: '1px solid var(--border-2)', borderRadius: 6 }} />
        </div>
        <Filter size={13} style={{ color: 'var(--muted)' }} />
        <Select value={fType} onChange={v => setFType(v as TypeLecon | '')} placeholder="Tous types"
          options={TYPES.map(t => [t, TYPE_LECON_LABEL[t]])} />
        <Select value={fCat} onChange={v => setFCat(v as CategorieLecon | '')} placeholder="Toutes catégories"
          options={CATS.map(c => [c, CATEGORIE_LECON_LABEL[c]])} />
        <Select value={fPhase} onChange={v => setFPhase(v as PhaseLecon | '')} placeholder="Toutes phases"
          options={PHASES.map(p => [p, PHASE_LECON_LABEL[p]])} />
      </div>

      {/* Liste */}
      <div style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 10, minHeight: 0 }}>
        {filtered.length === 0 && (
          <div className="card" style={{ padding: 24, textAlign: 'center', color: 'var(--muted)', fontSize: 13 }}>
            <Lightbulb size={20} style={{ marginBottom: 6 }} />
            <div>Aucune leçon ne correspond. {canAuthor && 'Cliquez sur « Nouvelle leçon » pour en ajouter une.'}</div>
          </div>
        )}
        {filtered.map(l => (
          <LeconCard
            key={l.id}
            lecon={l}
            userId={userId}
            canDelete={l.auteurId === userId || isRole('ADMIN')}
            onUtile={() => toggleUtile(l.id, userId)}
            onDelete={() => remove(l.id)}
          />
        ))}
      </div>

      {showForm && canAuthor && user && (
        <LeconForm
          projets={store.projets.map(p => ({ id: p.id, nom: p.nom }))}
          onClose={() => setShowForm(false)}
          onSubmit={(data) => { add(data); setShowForm(false); }}
          author={{ id: user.id, nom: `${user.prenom} ${user.nom}`, role: user.role }}
        />
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// CARTE LEÇON
// ─────────────────────────────────────────────────────────────────────────────

function LeconCard({ lecon, userId, canDelete, onUtile, onDelete }: {
  lecon: LeconApprise; userId: string; canDelete: boolean; onUtile: () => void; onDelete: () => void;
}) {
  const [open, setOpen] = useState(false);
  const voted = lecon.utilePar.includes(userId);
  return (
    <div className="card" style={{ padding: 14 }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}>
        <span style={{ marginTop: 3, width: 10, height: 10, borderRadius: 3, background: TYPE_LECON_COLOR[lecon.type], flexShrink: 0 }} />
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
            <span style={{ fontSize: 9, fontWeight: 700, color: TYPE_LECON_COLOR[lecon.type], textTransform: 'uppercase' }}>{TYPE_LECON_LABEL[lecon.type]}</span>
            <Tag>{CATEGORIE_LECON_LABEL[lecon.categorie]}</Tag>
            <Tag>{PHASE_LECON_LABEL[lecon.phase]}</Tag>
            <Tag>Impact {IMPACT_LECON_LABEL[lecon.impact]}</Tag>
            {!lecon.partagee && <Tag>Privée</Tag>}
          </div>
          <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--text)', marginTop: 4 }}>{lecon.titre}</div>
          <div style={{ fontSize: 10, color: 'var(--muted)', marginTop: 2 }}>
            {lecon.projetNom ? `${lecon.projetNom} · ` : ''}{lecon.auteur} ({lecon.auteurRole}) · {new Date(lecon.createdAt).toLocaleDateString('fr-FR')}
          </div>
        </div>
        <div style={{ display: 'flex', gap: 6, flexShrink: 0 }}>
          <button onClick={onUtile} title="Utile"
            style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 11, fontWeight: 700, padding: '4px 8px', borderRadius: 6, cursor: 'pointer',
              border: `1px solid ${voted ? 'var(--green)' : 'var(--border-2)'}`, background: voted ? '#DCFCE7' : '#fff', color: voted ? '#15803D' : 'var(--muted)' }}>
            <ThumbsUp size={12} /> {lecon.utilePar.length}
          </button>
          {canDelete && (
            <button onClick={onDelete} title="Supprimer"
              style={{ border: '1px solid var(--border-2)', background: '#fff', borderRadius: 6, cursor: 'pointer', padding: '4px 8px', color: 'var(--red)' }}>
              <Trash2 size={12} />
            </button>
          )}
        </div>
      </div>

      <button onClick={() => setOpen(o => !o)}
        style={{ marginTop: 8, border: 'none', background: 'transparent', color: 'var(--navy)', fontSize: 11, fontWeight: 700, cursor: 'pointer', padding: 0 }}>
        {open ? 'Masquer le détail' : 'Voir le détail (contexte · solution · recommandation)'}
      </button>

      {open && (
        <div style={{ marginTop: 8, display: 'flex', flexDirection: 'column', gap: 8, fontSize: 12 }}>
          <Field label="Contexte" value={lecon.contexte} />
          <Field label="Problème / opportunité" value={lecon.probleme} />
          <Field label="Action / solution" value={lecon.solution} />
          <Field label="Recommandation" value={lecon.recommandation} highlight />
          {lecon.tags.length > 0 && (
            <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
              {lecon.tags.map(t => <Tag key={t}>#{t}</Tag>)}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// FORMULAIRE
// ─────────────────────────────────────────────────────────────────────────────

function LeconForm({ projets, author, onClose, onSubmit }: {
  projets: { id: string; nom: string }[];
  author: { id: string; nom: string; role: string };
  onClose: () => void;
  onSubmit: (l: NouvelleLecon) => void;
}) {
  const [titre, setTitre] = useState('');
  const [projetId, setProjetId] = useState('');
  const [categorie, setCategorie] = useState<CategorieLecon>('technique');
  const [phase, setPhase] = useState<PhaseLecon>('execution');
  const [type, setType] = useState<TypeLecon>('amelioration');
  const [impact, setImpact] = useState<ImpactLecon>('moyen');
  const [contexte, setContexte] = useState('');
  const [probleme, setProbleme] = useState('');
  const [solution, setSolution] = useState('');
  const [recommandation, setRecommandation] = useState('');
  const [tags, setTags] = useState('');
  const [partagee, setPartagee] = useState(true);

  const valid = titre.trim() && recommandation.trim();

  const submit = () => {
    if (!valid) return;
    const projet = projets.find(p => p.id === projetId);
    onSubmit({
      titre: titre.trim(),
      projetId: projetId || undefined,
      projetNom: projet?.nom,
      auteurId: author.id, auteur: author.nom, auteurRole: author.role,
      categorie, phase, type, impact,
      contexte: contexte.trim(), probleme: probleme.trim(), solution: solution.trim(),
      recommandation: recommandation.trim(),
      tags: tags.split(',').map(t => t.trim()).filter(Boolean),
      partagee,
    });
  };

  return (
    <div onClick={onClose} style={{ position: 'fixed', inset: 0, background: 'rgba(15,23,42,0.45)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: 16 }}>
      <div onClick={e => e.stopPropagation()} className="card" style={{ width: 560, maxWidth: '100%', maxHeight: '90vh', overflowY: 'auto', padding: 0 }}>
        <div style={{ padding: '14px 16px', borderBottom: '1px solid var(--border-2)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <span style={{ fontSize: 15, fontWeight: 800, color: 'var(--navy)' }}>Nouvelle leçon apprise</span>
          <button onClick={onClose} style={{ border: 'none', background: 'transparent', cursor: 'pointer', color: 'var(--muted)' }}><X size={18} /></button>
        </div>
        <div style={{ padding: 16, display: 'flex', flexDirection: 'column', gap: 10 }}>
          <Input label="Titre *" value={titre} onChange={setTitre} placeholder="Ex. Sécuriser les approvisionnements à long délai" />
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
            <FormSelect label="Projet" value={projetId} onChange={setProjetId}
              options={[['', '— Aucun / transverse —'], ...projets.map(p => [p.id, p.nom] as [string, string])]} />
            <FormSelect label="Type" value={type} onChange={v => setType(v as TypeLecon)}
              options={TYPES.map(t => [t, TYPE_LECON_LABEL[t]])} />
            <FormSelect label="Catégorie" value={categorie} onChange={v => setCategorie(v as CategorieLecon)}
              options={CATS.map(c => [c, CATEGORIE_LECON_LABEL[c]])} />
            <FormSelect label="Phase" value={phase} onChange={v => setPhase(v as PhaseLecon)}
              options={PHASES.map(p => [p, PHASE_LECON_LABEL[p]])} />
            <FormSelect label="Impact" value={impact} onChange={v => setImpact(v as ImpactLecon)}
              options={(Object.keys(IMPACT_LECON_LABEL) as ImpactLecon[]).map(i => [i, IMPACT_LECON_LABEL[i]])} />
          </div>
          <Textarea label="Contexte" value={contexte} onChange={setContexte} />
          <Textarea label="Problème / opportunité" value={probleme} onChange={setProbleme} />
          <Textarea label="Action / solution" value={solution} onChange={setSolution} />
          <Textarea label="Recommandation réutilisable *" value={recommandation} onChange={setRecommandation} />
          <Input label="Tags (séparés par des virgules)" value={tags} onChange={setTags} placeholder="délais, approvisionnement" />
          <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12, cursor: 'pointer' }}>
            <input type="checkbox" checked={partagee} onChange={e => setPartagee(e.target.checked)} />
            Partager avec tous les profils (consultable pour apprendre)
          </label>
        </div>
        <div style={{ padding: '12px 16px', borderTop: '1px solid var(--border-2)', display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
          <button onClick={onClose} className="btn btn-sm" style={{ border: '1px solid var(--border-2)', background: '#fff' }}>Annuler</button>
          <button onClick={submit} disabled={!valid} className="btn btn-navy btn-sm" style={{ opacity: valid ? 1 : 0.5 }}>Enregistrer</button>
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// PRIMITIVES UI
// ─────────────────────────────────────────────────────────────────────────────

function Kpi({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <div className="card" style={{ padding: '10px 12px' }}>
      <div style={{ fontSize: 10, color: 'var(--muted)' }}>{label}</div>
      <div style={{ fontSize: 20, fontWeight: 800, color }}>{value}</div>
    </div>
  );
}

function Tag({ children }: { children: React.ReactNode }) {
  return (
    <span style={{ fontSize: 9, color: 'var(--muted)', background: 'var(--bg)', border: '1px solid var(--border-2)', padding: '1px 6px', borderRadius: 999 }}>{children}</span>
  );
}

function Field({ label, value, highlight }: { label: string; value: string; highlight?: boolean }) {
  if (!value) return null;
  return (
    <div style={{ background: highlight ? '#EFF6FF' : 'var(--bg)', borderRadius: 6, padding: '6px 8px' }}>
      <div style={{ fontSize: 9, fontWeight: 700, color: 'var(--navy)', textTransform: 'uppercase', marginBottom: 2 }}>{label}</div>
      <div style={{ fontSize: 12, color: 'var(--text)', whiteSpace: 'pre-wrap' }}>{value}</div>
    </div>
  );
}

function Select({ value, onChange, placeholder, options }: {
  value: string; onChange: (v: string) => void; placeholder: string; options: [string, string][];
}) {
  return (
    <select value={value} onChange={e => onChange(e.target.value)}
      style={{ padding: '6px 8px', fontSize: 12, border: '1px solid var(--border-2)', borderRadius: 6 }}>
      <option value="">{placeholder}</option>
      {options.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
    </select>
  );
}

function Input({ label, value, onChange, placeholder }: { label: string; value: string; onChange: (v: string) => void; placeholder?: string }) {
  return (
    <label style={{ display: 'flex', flexDirection: 'column', gap: 3, fontSize: 11, color: 'var(--muted)' }}>
      {label}
      <input value={value} onChange={e => onChange(e.target.value)} placeholder={placeholder}
        style={{ padding: '6px 8px', fontSize: 12, border: '1px solid var(--border-2)', borderRadius: 6, color: 'var(--text)' }} />
    </label>
  );
}

function Textarea({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  return (
    <label style={{ display: 'flex', flexDirection: 'column', gap: 3, fontSize: 11, color: 'var(--muted)' }}>
      {label}
      <textarea value={value} onChange={e => onChange(e.target.value)} rows={2}
        style={{ padding: '6px 8px', fontSize: 12, border: '1px solid var(--border-2)', borderRadius: 6, color: 'var(--text)', resize: 'vertical' }} />
    </label>
  );
}

function FormSelect({ label, value, onChange, options }: {
  label: string; value: string; onChange: (v: string) => void; options: [string, string][];
}) {
  return (
    <label style={{ display: 'flex', flexDirection: 'column', gap: 3, fontSize: 11, color: 'var(--muted)' }}>
      {label}
      <select value={value} onChange={e => onChange(e.target.value)}
        style={{ padding: '6px 8px', fontSize: 12, border: '1px solid var(--border-2)', borderRadius: 6, color: 'var(--text)' }}>
        {options.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
      </select>
    </label>
  );
}

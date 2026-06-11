'use client';
/**
 * Immobilisations.tsx — Immobilisations & Amortissements (rattachées aux projets)
 * ------------------------------------------------------------------------------
 * Registre des actifs par projet, jusqu'au niveau de détail, avec gestion des
 * amortissements (plan annuel linéaire/dégressif, VNC) par la direction en
 * charge des immobilisations (DGC — Gestion des Immos) et la Finance.
 */

import React, { useMemo, useState, useEffect } from 'react';
import {
  Building2, Plus, Trash2, Calculator, X, TrendingDown, Layers, Save, Search,
} from 'lucide-react';
import { useProjectStore } from '@/lib/projectStore';
import { useTranslation } from '@/lib/i18n/I18nContext';
import {
  useImmobilisationStore, planAmortissement, amortissementCumule, valeurNetteComptable,
  CATEGORIES_IMMO, STATUT_IMMO_LABEL,
  type Immobilisation, type MethodeAmortissement, type CategorieImmo, type StatutImmobilisation,
} from '@/lib/immobilisationStore';
import { IMMO_CLASSES, ACTIFS_LIVRABLES, UNITES_ACTIF, BAILLEURS } from '@/lib/referentielsDPE';

const fmt = (n: number) => `${n.toLocaleString('fr-FR', { maximumFractionDigits: 1 })} M`;
const card: React.CSSProperties = { background: '#fff', border: '1px solid #E2E8F0', borderRadius: 12, padding: 16 };
const inp: React.CSSProperties = { width: '100%', padding: '7px 9px', borderRadius: 7, border: '1px solid #CBD5E1', fontSize: 12.5, color: '#0F172A', background: '#fff' };

export default function Immobilisations() {
  const { lang } = useTranslation();
  const { projets } = useProjectStore();
  const { immobilisations, add, update, remove, seedFor } = useImmobilisationStore();
  const T = (fr: string, en: string) => (lang === 'en' ? en : fr);

  const [projetId, setProjetId] = useState<string>('');
  const [showForm, setShowForm] = useState(false);
  const [planId, setPlanId] = useState<string | null>(null);
  const [search, setSearch] = useState('');

  // Sélection du 1er projet visible + seed démonstration
  useEffect(() => {
    if (!projetId && projets.length) setProjetId(projets[0].id);
  }, [projets, projetId]);
  useEffect(() => {
    if (projetId) seedFor(projetId);
  }, [projetId, seedFor]);

  const assets = useMemo(
    () => immobilisations.filter(i => i.projetId === projetId),
    [immobilisations, projetId]
  );

  const filteredAssets = useMemo(() => {
    if (!search.trim()) return assets;
    const q = search.toLowerCase();
    return assets.filter(a =>
      a.code.toLowerCase().includes(q) ||
      a.designation.toLowerCase().includes(q) ||
      a.categorie.toLowerCase().includes(q) ||
      (a.localisation || '').toLowerCase().includes(q) ||
      (a.statut || '').toLowerCase().includes(q)
    );
  }, [assets, search]);

  const totals = useMemo(() => {
    const brut = assets.reduce((s, a) => s + a.valeurAcquisition, 0);
    const cumul = assets.reduce((s, a) => s + amortissementCumule(a), 0);
    return { brut, cumul, vnc: brut - cumul, count: assets.length };
  }, [assets]);

  const projet = projets.find(p => p.id === projetId);
  const planImmo = assets.find(a => a.id === planId) || null;

  return (
    <div style={{ padding: 20, maxWidth: 1280, margin: '0 auto', width: '100%' }}>
      {/* En-tête */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 14, flexWrap: 'wrap' }}>
        <div style={{ width: 40, height: 40, borderRadius: 10, background: '#FEF3C7', display: 'grid', placeItems: 'center' }}>
          <Building2 size={22} style={{ color: '#B45309' }} />
        </div>
        <div style={{ flex: 1, minWidth: 200 }}>
          <h1 style={{ fontSize: 20, fontWeight: 800, color: '#0F172A', margin: 0 }}>
            {T('Immobilisations & Amortissements', 'Fixed Assets & Depreciation')}
          </h1>
          <p style={{ fontSize: 13, color: '#64748B', margin: '2px 0 0' }}>
            {T('Actifs rattachés aux projets — gestion des amortissements (DGC / Finance).',
               'Project-linked assets — depreciation management (DGC / Finance).')}
          </p>
        </div>
        <select value={projetId} onChange={e => { setProjetId(e.target.value); setShowForm(false); setPlanId(null); }} style={{ ...inp, width: 'auto', minWidth: 240, fontWeight: 600 }}>
          {projets.length === 0 && <option value="">{T('Aucun projet visible', 'No visible project')}</option>}
          {projets.map(p => <option key={p.id} value={p.id}>{p.code} — {p.nom}</option>)}
        </select>
      </div>

      {/* KPI projet */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(170px, 1fr))', gap: 12, marginBottom: 16 }}>
        <Kpi label={T('Valeur brute', 'Gross value')} value={fmt(totals.brut)} color="#1D4ED8" icon={<Layers size={16} />} />
        <Kpi label={T('Amort. cumulés', 'Accum. depreciation')} value={fmt(totals.cumul)} color="#B45309" icon={<TrendingDown size={16} />} />
        <Kpi label={T('Valeur nette (VNC)', 'Net book value')} value={fmt(totals.vnc)} color="#16A34A" icon={<Building2 size={16} />} />
        <Kpi label={T('Nb immobilisations', 'Asset count')} value={String(totals.count)} color="#7C3AED" icon={<Calculator size={16} />} />
      </div>

      {/* Barre d'action */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10, flexWrap: 'wrap', gap: 8 }}>
        <span style={{ fontSize: 13, fontWeight: 700, color: '#334155' }}>
          {T('Registre des immobilisations', 'Asset register')}{projet ? ` — ${projet.nom}` : ''}
          {search && <span style={{ fontWeight: 400, color: '#64748B', marginLeft: 8 }}>{filteredAssets.length}/{assets.length}</span>}
        </span>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
          <div style={{ position: 'relative' }}>
            <Search size={13} style={{ position: 'absolute', left: 9, top: '50%', transform: 'translateY(-50%)', color: '#94A3B8', pointerEvents: 'none' }} />
            <input
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder={T('Rechercher…', 'Search…')}
              style={{ ...inp, width: 210, paddingLeft: 28, paddingRight: search ? 28 : 10 }}
            />
            {search && (
              <button onClick={() => setSearch('')} aria-label={T('Effacer la recherche', 'Clear search')} style={{ position: 'absolute', right: 6, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: '#94A3B8', padding: 0 }}>
                <X size={12} />
              </button>
            )}
          </div>
        <button onClick={() => setShowForm(v => !v)} disabled={!projetId} style={{
          display: 'inline-flex', alignItems: 'center', gap: 6, padding: '8px 14px', borderRadius: 8,
          background: '#B45309', color: '#fff', border: 'none', fontSize: 12.5, fontWeight: 700,
          cursor: projetId ? 'pointer' : 'not-allowed', opacity: projetId ? 1 : 0.5,
        }}>
          {showForm ? <X size={14} /> : <Plus size={14} />} {showForm ? T('Fermer', 'Close') : T('Nouvelle immobilisation', 'New asset')}
        </button>
        </div>
      </div>

      {showForm && projetId && (
        <AssetForm projetId={projetId} onSave={(a) => { add(a); setShowForm(false); }} onCancel={() => setShowForm(false)} T={T} />
      )}

      {/* Tableau */}
      <div style={{ ...card, padding: 0, overflowX: 'auto', marginTop: 12 }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12.5 }}>
          <thead>
            <tr style={{ background: '#F8FAFC', textAlign: 'left', color: '#475569' }}>
              {[T('Code', 'Code'), T('Désignation', 'Description'), T('Catégorie', 'Category'), T('Valeur brute', 'Gross'),
                T('Mise en service', 'In-service'), T('Durée', 'Life'), T('Méthode', 'Method'),
                T('Amort. cumulé', 'Accum.'), T('VNC', 'NBV'), T('Statut', 'Status'), ''].map((h, i) => (
                <th key={i} style={{ padding: '10px 12px', fontWeight: 700, whiteSpace: 'nowrap' }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {filteredAssets.length === 0 && (
              <tr><td colSpan={11} style={{ padding: 24, textAlign: 'center', color: '#94A3B8' }}>
                {search ? T('Aucun résultat pour cette recherche.', 'No results for this search.') : T('Aucune immobilisation pour ce projet.', 'No assets for this project.')}
              </td></tr>
            )}
            {filteredAssets.map(a => {
              const st = STATUT_IMMO_LABEL[a.statut];
              return (
                <tr key={a.id} style={{ borderTop: '1px solid #EEF2F7' }}>
                  <td style={{ padding: '9px 12px', fontWeight: 600 }}>{a.code}</td>
                  <td style={{ padding: '9px 12px' }}>{a.designation}{a.localisation ? <span style={{ color: '#94A3B8' }}> · {a.localisation}</span> : null}</td>
                  <td style={{ padding: '9px 12px', whiteSpace: 'nowrap' }}>{a.categorie}</td>
                  <td style={{ padding: '9px 12px', textAlign: 'right', whiteSpace: 'nowrap' }}>{fmt(a.valeurAcquisition)}</td>
                  <td style={{ padding: '9px 12px', whiteSpace: 'nowrap' }}>
                    <div style={{ fontSize: 11.5, fontWeight: 600, color: '#0F172A' }}>{a.dateMiseEnService}</div>
                    {a.datePVReception && a.datePVReception !== a.dateMiseEnService && (
                      <div style={{ fontSize: 10, color: '#64748B', marginTop: 2 }}>PV: {a.datePVReception}</div>
                    )}
                  </td>
                  <td style={{ padding: '9px 12px', textAlign: 'center' }}>{a.dureeAmortissement} {T('ans', 'yr')}</td>
                  <td style={{ padding: '9px 12px' }}>{a.methode === 'lineaire' ? T('Linéaire', 'Straight-line') : T('Dégressif', 'Declining')}</td>
                  <td style={{ padding: '9px 12px', textAlign: 'right', color: '#B45309', whiteSpace: 'nowrap' }}>{fmt(amortissementCumule(a))}</td>
                  <td style={{ padding: '9px 12px', textAlign: 'right', fontWeight: 700, color: '#16A34A', whiteSpace: 'nowrap' }}>{fmt(valeurNetteComptable(a))}</td>
                  <td style={{ padding: '9px 12px' }}><span style={{ fontSize: 11, fontWeight: 700, color: st.color, background: `${st.color}18`, padding: '3px 8px', borderRadius: 20, whiteSpace: 'nowrap' }}>{lang === 'en' ? st.en : st.fr}</span></td>
                  <td style={{ padding: '9px 12px', whiteSpace: 'nowrap' }}>
                    <button onClick={() => setPlanId(a.id)} title={T('Plan d\'amortissement', 'Depreciation schedule')} aria-label={T('Voir le plan d\'amortissement', 'View depreciation schedule')} style={iconBtn}><Calculator size={14} /></button>
                    <button onClick={() => remove(a.id)} title={T('Supprimer', 'Delete')} aria-label={T('Supprimer l\'immobilisation', 'Delete asset')} style={{ ...iconBtn, color: '#DC2626' }}><Trash2 size={14} /></button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Plan d'amortissement (modal) */}
      {planImmo && (
        <PlanModal immo={planImmo} onClose={() => setPlanId(null)} onMethode={(m) => update(planImmo.id, { methode: m })} T={T} lang={lang} />
      )}
    </div>
  );
}

function Kpi({ label, value, color, icon }: { label: string; value: string; color: string; icon: React.ReactNode }) {
  return (
    <div style={{ ...card, borderLeft: `4px solid ${color}` }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, color: '#64748B', fontSize: 11.5, fontWeight: 600 }}>{icon} {label}</div>
      <div style={{ fontSize: 24, fontWeight: 800, color, marginTop: 4 }}>{value}</div>
    </div>
  );
}

function AssetForm({ projetId, onSave, onCancel, T }: {
  projetId: string;
  onSave: (a: Omit<Immobilisation, 'id' | 'createdAt' | 'updatedAt'>) => void;
  onCancel: () => void;
  T: (fr: string, en: string) => string;
}) {
  const [f, setF] = useState({
    code: '', designation: '', categorie: 'Poste HTA/BT' as CategorieImmo,
    valeurAcquisition: '', valeurResiduelle: '0', datePVReception: '',
    dateMiseEnService: new Date().toISOString().split('T')[0],
    dureeAmortissement: '20', methode: 'lineaire' as MethodeAmortissement,
    localisation: '', statut: 'en_service' as StatutImmobilisation,
    classeComptable: '', actifLivrable: '', unite: '', bailleur: '',  // nomenclatures officielles DPE
  });
  const valid = f.code.trim() && f.designation.trim() && parseFloat(f.valeurAcquisition) > 0;
  return (
    <div style={{ ...card, background: '#FFFBEB', borderColor: '#FCD34D' }}>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 10 }}>
        <L label={T('Code immobilisation', 'Asset code')}><input style={inp} value={f.code} onChange={e => setF({ ...f, code: e.target.value })} placeholder="IMM-..." /></L>
        <L label={T('Désignation', 'Description')}><input style={inp} value={f.designation} onChange={e => setF({ ...f, designation: e.target.value })} /></L>
        <L label={T('Catégorie', 'Category')}>
          <select style={inp} value={f.categorie} onChange={e => setF({ ...f, categorie: e.target.value as CategorieImmo })}>
            {CATEGORIES_IMMO.map(c => <option key={c} value={c}>{c}</option>)}
          </select>
        </L>
        <L label={T('Valeur brute (M FCFA)', 'Gross value (M FCFA)')}><input style={inp} inputMode="decimal" value={f.valeurAcquisition} onChange={e => setF({ ...f, valeurAcquisition: e.target.value })} /></L>
        <L label={T('Valeur résiduelle', 'Residual value')}><input style={inp} inputMode="decimal" value={f.valeurResiduelle} onChange={e => setF({ ...f, valeurResiduelle: e.target.value })} /></L>
        <L label={T('Date PV Reception', 'Reception PV date')}><input type="date" style={inp} value={f.datePVReception} onChange={e => setF({ ...f, datePVReception: e.target.value })} /></L>
        <L label={T('Date mise en service', 'In-service date')}><input type="date" style={inp} value={f.dateMiseEnService} onChange={e => setF({ ...f, dateMiseEnService: e.target.value })} /></L>
        <L label={T('Durée (années)', 'Useful life (years)')}><input style={inp} inputMode="numeric" value={f.dureeAmortissement} onChange={e => setF({ ...f, dureeAmortissement: e.target.value })} /></L>
        <L label={T('Méthode', 'Method')}>
          <select style={inp} value={f.methode} onChange={e => setF({ ...f, methode: e.target.value as MethodeAmortissement })}>
            <option value="lineaire">{T('Linéaire', 'Straight-line')}</option>
            <option value="degressif">{T('Dégressif', 'Declining balance')}</option>
          </select>
        </L>
        <L label={T('Localisation', 'Location')}><input style={inp} value={f.localisation} onChange={e => setF({ ...f, localisation: e.target.value })} /></L>
        <L label="Classe comptable (NATURE)">
          <select style={inp} value={f.classeComptable} onChange={e => setF({ ...f, classeComptable: e.target.value })}>
            <option value="">—</option>{IMMO_CLASSES.map(c => <option key={c} value={c}>{c}</option>)}
          </select>
        </L>
        <L label="Actif livrable">
          <select style={inp} value={f.actifLivrable} onChange={e => setF({ ...f, actifLivrable: e.target.value })}>
            <option value="">—</option>{ACTIFS_LIVRABLES.map(a => <option key={a} value={a}>{a}</option>)}
          </select>
        </L>
        <L label="Unité">
          <select style={inp} value={f.unite} onChange={e => setF({ ...f, unite: e.target.value })}>
            <option value="">—</option>{UNITES_ACTIF.map(u => <option key={u} value={u}>{u}</option>)}
          </select>
        </L>
        <L label="Bailleur">
          <select style={inp} value={f.bailleur} onChange={e => setF({ ...f, bailleur: e.target.value })}>
            <option value="">—</option>{BAILLEURS.map(b => <option key={b} value={b}>{b}</option>)}
          </select>
        </L>
        <L label={T('Statut', 'Status')}>
          <select style={inp} value={f.statut} onChange={e => setF({ ...f, statut: e.target.value as StatutImmobilisation })}>
            {Object.entries(STATUT_IMMO_LABEL).map(([k, v]) => <option key={k} value={k}>{v.fr}</option>)}
          </select>
        </L>
      </div>
      <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
        <button disabled={!valid} onClick={() => onSave({
          projetId, code: f.code.trim(), designation: f.designation.trim(), categorie: f.categorie,
          valeurAcquisition: parseFloat(f.valeurAcquisition) || 0, valeurResiduelle: parseFloat(f.valeurResiduelle) || 0,
          dateMiseEnService: f.dateMiseEnService, datePVReception: f.datePVReception || undefined,
          dureeAmortissement: parseInt(f.dureeAmortissement) || 1,
          methode: f.methode, localisation: f.localisation.trim() || undefined, statut: f.statut,
          classeComptable: f.classeComptable || undefined, actifLivrable: f.actifLivrable || undefined,
          unite: f.unite || undefined, bailleur: f.bailleur || undefined,
        })} style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '8px 16px', borderRadius: 8, background: valid ? '#B45309' : '#E5E7EB', color: valid ? '#fff' : '#9CA3AF', border: 'none', fontSize: 12.5, fontWeight: 700, cursor: valid ? 'pointer' : 'not-allowed' }}>
          <Save size={14} /> {T('Enregistrer', 'Save')}
        </button>
        <button onClick={onCancel} style={{ padding: '8px 16px', borderRadius: 8, background: '#fff', border: '1px solid #CBD5E1', fontSize: 12.5, fontWeight: 600, cursor: 'pointer' }}>{T('Annuler', 'Cancel')}</button>
      </div>
    </div>
  );
}

function PlanModal({ immo, onClose, onMethode, T, lang }: {
  immo: Immobilisation; onClose: () => void; onMethode: (m: MethodeAmortissement) => void;
  T: (fr: string, en: string) => string; lang: string;
}) {
  const plan = planAmortissement(immo);
  return (
    <div onClick={onClose} style={{ position: 'fixed', inset: 0, background: 'rgba(15,23,42,.5)', display: 'grid', placeItems: 'center', zIndex: 50, padding: 16 }}>
      <div onClick={e => e.stopPropagation()} style={{ ...card, maxWidth: 640, width: '100%', maxHeight: '85vh', overflowY: 'auto' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12 }}>
          <div>
            <h3 style={{ margin: 0, fontSize: 15, fontWeight: 800, color: '#0F172A' }}>{T('Plan d\'amortissement', 'Depreciation schedule')}</h3>
            <p style={{ margin: '2px 0 0', fontSize: 12.5, color: '#64748B' }}>{immo.code} — {immo.designation}</p>
          </div>
          <button onClick={onClose} aria-label={T('Fermer', 'Close')} style={iconBtn}><X size={16} /></button>
        </div>
        <div style={{ display: 'flex', gap: 8, margin: '12px 0', alignItems: 'center', flexWrap: 'wrap' }}>
          <span style={{ fontSize: 12, color: '#64748B' }}>{T('Méthode', 'Method')} :</span>
          {(['lineaire', 'degressif'] as MethodeAmortissement[]).map(m => (
            <button key={m} onClick={() => onMethode(m)} style={{
              padding: '5px 12px', borderRadius: 20, fontSize: 12, fontWeight: 700, cursor: 'pointer',
              border: `1px solid ${immo.methode === m ? '#B45309' : '#CBD5E1'}`,
              background: immo.methode === m ? '#B45309' : '#fff', color: immo.methode === m ? '#fff' : '#475569',
            }}>{m === 'lineaire' ? T('Linéaire', 'Straight-line') : T('Dégressif', 'Declining')}</button>
          ))}
        </div>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12.5 }}>
          <thead>
            <tr style={{ background: '#F8FAFC', color: '#475569', textAlign: 'right' }}>
              <th style={{ padding: '8px 10px', textAlign: 'left' }}>{T('Exercice', 'Year')}</th>
              <th style={{ padding: '8px 10px' }}>{T('Base début', 'Opening')}</th>
              <th style={{ padding: '8px 10px' }}>{T('Dotation', 'Charge')}</th>
              <th style={{ padding: '8px 10px' }}>{T('Cumul', 'Accum.')}</th>
              <th style={{ padding: '8px 10px' }}>VNC</th>
            </tr>
          </thead>
          <tbody>
            {plan.map(l => (
              <tr key={l.annee} style={{ borderTop: '1px solid #EEF2F7', textAlign: 'right' }}>
                <td style={{ padding: '7px 10px', textAlign: 'left', fontWeight: 600 }}>{l.annee}</td>
                <td style={{ padding: '7px 10px' }}>{fmt(l.baseDebut)}</td>
                <td style={{ padding: '7px 10px', color: '#B45309' }}>{fmt(l.annuite)}</td>
                <td style={{ padding: '7px 10px' }}>{fmt(l.cumul)}</td>
                <td style={{ padding: '7px 10px', fontWeight: 700, color: '#16A34A' }}>{fmt(l.vnc)}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <p style={{ fontSize: 11, color: '#94A3B8', marginTop: 10 }}>
          {T('Montants en millions FCFA. Dotation linéaire = (valeur brute − valeur résiduelle) ÷ durée.',
             'Amounts in million FCFA. Straight-line charge = (gross − residual) ÷ useful life.')}
        </p>
      </div>
    </div>
  );
}

function L({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label style={{ display: 'block' }}>
      <span style={{ fontSize: 11, fontWeight: 600, color: '#64748B', display: 'block', marginBottom: 3 }}>{label}</span>
      {children}
    </label>
  );
}

const iconBtn: React.CSSProperties = {
  display: 'inline-grid', placeItems: 'center', width: 28, height: 28, borderRadius: 6,
  background: '#F1F5F9', border: 'none', cursor: 'pointer', color: '#475569', marginLeft: 4,
};

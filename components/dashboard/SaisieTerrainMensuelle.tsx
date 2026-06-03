'use client';
/**
 * SaisieTerrainMensuelle — Saisie terrain À TOUTE VISITE (plus seulement mensuelle),
 * adaptée au TYPE de projet + canevas PERSONNALISABLE par projet + sync mobile.
 *
 * • Sélection d'un projet (parmi les projets visibles du profil).
 * • Le canevas (phases pondérées + indicateurs physiques) provient de terrainConfigStore :
 *   modèle par type/domaine, éditable par l'admin, surchargeable PAR PROJET.
 * • Saisie possible à N'IMPORTE QUELLE date de visite (pas seulement par mois).
 * • Personnalisation en place : ajout/suppression d'indicateurs pour le projet courant.
 * • Avancement physique pondéré calculé en direct (modèle des matrices DPD/DPT).
 * • Enregistrement hors-ligne (brouillon) puis synchronisation (file mobileSyncStore).
 */

import { useMemo, useState } from 'react';
import { Smartphone, Wifi, WifiOff, CheckCircle2, Clock, RefreshCw, Save, MapPin, Camera, SlidersHorizontal, Plus, Trash2 } from 'lucide-react';
import { useProjectStore } from '@/lib/projectStore';
import { useAuth } from '@/lib/authStore';
import { computeWeightedProgress, type PhaseKey } from '@/lib/terrainTemplates';
import {
  useTerrainConfigStore,
  type IndicateurPhysique,
  type IndicateurUnite,
} from '@/lib/terrainConfigStore';
import { getTemplateByType } from '@/lib/terrainTemplates';
import { useMobileSyncStore, type SaisieTerrain, type SyncStatut } from '@/lib/mobileSyncStore';

const STATUT_CFG: Record<SyncStatut, { label: string; color: string; bg: string }> = {
  brouillon:    { label: 'Brouillon (local)', color: '#92400E', bg: '#FEF3C7' },
  en_attente:   { label: 'En attente sync',   color: '#9A3412', bg: '#FFEDD5' },
  synchronise:  { label: 'Synchronisé',       color: '#166534', bg: '#DCFCE7' },
};

/** Types de visite (la saisie n'est plus mensuelle : on peut saisir à chaque visite). */
const VISITE_TYPES = ['Visite de chantier', 'Avancement physique', 'Réception partielle', 'Constat terrain', 'Mesures DPE/Énergie', 'Visite hebdomadaire', 'Visite mensuelle'];

const todayISO = () => new Date().toISOString().slice(0, 10);          // YYYY-MM-DD
const monthOf = (d: string) => (d || todayISO()).slice(0, 7);          // YYYY-MM

const UNITES: { value: IndicateurUnite; label: string }[] = [
  { value: 'pct', label: '%' },
  { value: 'km', label: 'km' },
  { value: 'nombre', label: 'nombre' },
  { value: 'unite', label: 'unité' },
  { value: 'ml', label: 'ml' },
];

export default function SaisieTerrainMensuelle() {
  const { projets: filteredProjets } = useProjectStore();
  const { user } = useAuth();
  const saisies = useMobileSyncStore(s => s.saisies);
  const addSaisie = useMobileSyncStore(s => s.addSaisie);
  const syncAll = useMobileSyncStore(s => s.syncAll);
  const syncOne = useMobileSyncStore(s => s.syncOne);

  // ── Config terrain personnalisable ──
  const resolveFor = useTerrainConfigStore(s => s.resolveFor);
  const projectOverrides = useTerrainConfigStore(s => s.projectOverrides);
  const setProjectOverride = useTerrainConfigStore(s => s.setProjectOverride);
  const clearProjectOverride = useTerrainConfigStore(s => s.clearProjectOverride);

  const [online, setOnline] = useState(true);
  const [projetCode, setProjetCode] = useState(filteredProjets[0]?.code ?? '');
  const [dateVisite, setDateVisite] = useState(todayISO());
  const [visiteLibelle, setVisiteLibelle] = useState(VISITE_TYPES[0]);
  const [phaseProgress, setPhaseProgress] = useState<Partial<Record<PhaseKey, number>>>({});
  const [indicVals, setIndicVals] = useState<Record<string, string>>({});
  const [facturation, setFacturation] = useState('');
  const [obs, setObs] = useState('');
  const [photos, setPhotos] = useState(0);
  const [flash, setFlash] = useState<string | null>(null);
  const [showCustom, setShowCustom] = useState(false);

  // nouvel indicateur (personnalisation projet)
  const [newIndLabel, setNewIndLabel] = useState('');
  const [newIndUnite, setNewIndUnite] = useState<IndicateurUnite>('nombre');
  const [newIndPhase, setNewIndPhase] = useState<PhaseKey>('travaux');

  const projet = useMemo(() => filteredProjets.find(p => p.code === projetCode), [filteredProjets, projetCode]);
  // Canevas effectif (surcharge projet → modèle type → auto-détection). Dépend des overrides.
  const template = useMemo(
    () => projet ? resolveFor(projet.code, projet.domaine, projet.nom, projet.description) : undefined,
    [projet, resolveFor, projectOverrides],
  );
  const isCustomized = !!(projet && projectOverrides[projet.code]);

  const weighted = useMemo(
    () => template ? computeWeightedProgress(phaseProgress, template.phases) : 0,
    [phaseProgress, template],
  );

  const pending = saisies.filter(s => s.statut !== 'synchronise').length;

  const resetForm = () => { setPhaseProgress({}); setIndicVals({}); setFacturation(''); setObs(''); setPhotos(0); };

  // ── Personnalisation du canevas pour le projet courant ──
  const addIndicateurProjet = () => {
    if (!projet || !template || !newIndLabel.trim()) return;
    const key = `c_${Date.now()}`;
    const ind: IndicateurPhysique = { key, label: newIndLabel.trim(), unite: newIndUnite, phase: newIndPhase };
    setProjectOverride(projet.code, { indicateurs: [...template.indicateurs, ind] });
    setNewIndLabel('');
  };
  const removeIndicateurProjet = (key: string) => {
    if (!projet || !template) return;
    setProjectOverride(projet.code, { indicateurs: template.indicateurs.filter(i => i.key !== key) });
  };
  const resetCanevasProjet = () => { if (projet) clearProjectOverride(projet.code); };
  const setPhasePoids = (phaseKey: PhaseKey, poids: number) => {
    if (!projet || !template) return;
    const phases = template.phases.map(p => p.key === phaseKey ? { ...p, poids: Math.max(0, Math.min(100, poids)) } : p);
    setProjectOverride(projet.code, { phases });
  };

  const handleSave = (statut: SyncStatut) => {
    if (!projet || !template) return;
    const indicateurs: Record<string, number | string> = {};
    for (const [k, v] of Object.entries(indicVals)) {
      if (v === '') continue;
      const num = Number(v);
      indicateurs[k] = Number.isNaN(num) ? v : num;
    }
    addSaisie({
      projetCode: projet.code, projetNom: projet.nom, templateType: template.type,
      periode: monthOf(dateVisite), dateVisite, visiteLibelle,
      region: projet.region, localisation: projet.localisation,
      phaseProgress: { ...phaseProgress },
      indicateurs,
      facturationMois: facturation ? Number(facturation) : undefined,
      observations: obs || undefined,
      photos,
      auteur: user ? `${user.prenom} ${user.nom}` : 'Agent terrain',
      device: 'Web / Terrain',
      statut: statut === 'synchronise' && !online ? 'en_attente' : statut,
    });
    resetForm();
    setFlash(statut === 'synchronise'
      ? (online ? '✅ Saisie synchronisée' : '📴 Hors-ligne — saisie mise en file d’attente')
      : '💾 Brouillon enregistré localement');
    setTimeout(() => setFlash(null), 3500);
  };

  const handleSyncAll = () => {
    if (!online) { setFlash('📴 Hors-ligne — connectez-vous pour synchroniser'); setTimeout(() => setFlash(null), 3000); return; }
    const n = syncAll();
    setFlash(n > 0 ? `🔄 ${n} saisie(s) synchronisée(s)` : 'Tout est déjà synchronisé');
    setTimeout(() => setFlash(null), 3000);
  };

  const fmt = (d?: string) => d ? new Date(d).toLocaleString('fr-FR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' }) : '—';

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      {/* Barre état connexion + sync */}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12, alignItems: 'center', background: online ? '#ECFDF5' : '#FEF2F2', border: `1px solid ${online ? '#A7F3D0' : '#FECACA'}`, borderRadius: 12, padding: '10px 16px' }}>
        <Smartphone size={18} color={online ? '#16A34A' : '#EF3340'} />
        <span style={{ fontSize: 13, fontWeight: 800, color: online ? '#166534' : '#991B1B' }}>
          Synchronisation mobile terrain
        </span>
        <button onClick={() => setOnline(o => !o)} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '5px 12px', borderRadius: 8, border: 'none', cursor: 'pointer', fontSize: 12, fontWeight: 700, background: online ? '#16A34A' : '#EF3340', color: '#fff' }}>
          {online ? <Wifi size={13} /> : <WifiOff size={13} />} {online ? 'En ligne' : 'Hors-ligne'}
        </button>
        <span style={{ fontSize: 12, color: '#475569' }}>
          {pending > 0 ? <><b style={{ color: '#D97706' }}>{pending}</b> saisie(s) en attente</> : 'File vide'}
        </span>
        <button onClick={handleSyncAll} style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 6, padding: '6px 14px', borderRadius: 8, border: '1px solid #1B4F8A', background: '#1B4F8A', color: '#fff', cursor: 'pointer', fontSize: 12, fontWeight: 700 }}>
          <RefreshCw size={13} /> Tout synchroniser
        </button>
      </div>

      {flash && (
        <div style={{ padding: '10px 14px', borderRadius: 10, background: '#EFF6FF', border: '1px solid #BFDBFE', color: '#1E3A8A', fontSize: 13, fontWeight: 600 }}>{flash}</div>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(320px, 1fr) minmax(340px, 1.2fr)', gap: 16 }}>
        {/* ─── Formulaire de saisie ─── */}
        <div style={{ background: '#fff', borderRadius: 12, border: '1px solid #E2E8F0', padding: 16 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
            <div style={{ fontSize: 13, fontWeight: 800, color: '#0F172A' }}>Saisie à la visite</div>
            {projet && (
              <button onClick={() => setShowCustom(v => !v)} title="Personnaliser le canevas de ce projet"
                style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '5px 10px', borderRadius: 7, border: '1px solid #CBD5E1', background: showCustom ? '#1B4F8A' : '#fff', color: showCustom ? '#fff' : '#334155', fontSize: 11, fontWeight: 700, cursor: 'pointer' }}>
                <SlidersHorizontal size={12} /> Personnaliser{isCustomized ? ' •' : ''}
              </button>
            )}
          </div>

          <label style={lbl}>Projet</label>
          <select value={projetCode} onChange={e => { setProjetCode(e.target.value); resetForm(); }} style={inp}>
            {filteredProjets.length === 0 && <option value="">Aucun projet visible</option>}
            {filteredProjets.map(p => <option key={p.id} value={p.code}>{p.code} — {p.nom}</option>)}
          </select>

          {template && (
            <div style={{ margin: '8px 0 12px', fontSize: 11, color: '#64748B' }}>
              Canevas : <b style={{ color: '#1B4F8A' }}>{template.label}</b>
              {isCustomized && <span style={{ marginLeft: 6, fontSize: 10, fontWeight: 700, color: '#9A3412', background: '#FFEDD5', padding: '1px 6px', borderRadius: 5 }}>personnalisé</span>}
              {projet && <> · <MapPin size={10} style={{ verticalAlign: 'middle' }} /> {projet.localisation || projet.region} · Réf. SIG <code style={{ color: '#1B4F8A' }}>SIG-{projet.code}</code></>}
            </div>
          )}

          {/* Date de visite + type (plus de saisie mensuelle obligatoire) */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
            <div>
              <label style={lbl}>Date de la visite</label>
              <input type="date" value={dateVisite} max={todayISO()} onChange={e => setDateVisite(e.target.value || todayISO())} style={inp} />
            </div>
            <div>
              <label style={lbl}>Type de visite</label>
              <select value={visiteLibelle} onChange={e => setVisiteLibelle(e.target.value)} style={inp}>
                {VISITE_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
              </select>
            </div>
          </div>

          {/* ─── Panneau de personnalisation du canevas (par projet) ─── */}
          {showCustom && projet && template && (
            <div style={{ marginTop: 12, padding: 12, background: '#F8FAFC', border: '1px dashed #94A3B8', borderRadius: 10 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                <span style={{ fontSize: 11.5, fontWeight: 800, color: '#334155' }}>Canevas du projet {projet.code}</span>
                {isCustomized && (
                  <button onClick={resetCanevasProjet} style={{ fontSize: 10.5, fontWeight: 700, color: '#9A3412', background: 'none', border: 'none', cursor: 'pointer', textDecoration: 'underline' }}>
                    Rétablir le modèle
                  </button>
                )}
              </div>

              {/* Pondération des phases */}
              <div style={{ fontSize: 10.5, fontWeight: 700, color: '#64748B', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 6 }}>Pondération des phases (%)</div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6, marginBottom: 12 }}>
                {template.phases.map(ph => (
                  <div key={ph.key} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <span style={{ fontSize: 10.5, color: '#475569', flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{ph.label}</span>
                    <input type="number" min={0} max={100} value={ph.poids}
                      onChange={e => setPhasePoids(ph.key, Number(e.target.value) || 0)}
                      style={{ ...inp, width: 64, padding: '4px 6px' }} />
                  </div>
                ))}
              </div>
              <div style={{ fontSize: 10, color: template.phases.reduce((s, p) => s + p.poids, 0) === 100 ? '#16A34A' : '#D97706', marginBottom: 10, fontWeight: 700 }}>
                Somme des poids : {template.phases.reduce((s, p) => s + p.poids, 0)}% {template.phases.reduce((s, p) => s + p.poids, 0) !== 100 && '(idéalement 100%)'}
              </div>

              {/* Indicateurs : suppression + ajout */}
              <div style={{ fontSize: 10.5, fontWeight: 700, color: '#64748B', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 6 }}>Indicateurs physiques</div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5, marginBottom: 10 }}>
                {template.indicateurs.map(ind => (
                  <span key={ind.key} style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 10.5, background: '#fff', border: '1px solid #CBD5E1', borderRadius: 6, padding: '3px 6px' }}>
                    {ind.label}
                    <button onClick={() => removeIndicateurProjet(ind.key)} title="Retirer" style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#EF3340', display: 'flex', padding: 0 }}><Trash2 size={11} /></button>
                  </span>
                ))}
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 80px 1fr auto', gap: 6, alignItems: 'end' }}>
                <div>
                  <label style={{ ...lbl, fontSize: 9.5 }}>Nouvel indicateur</label>
                  <input value={newIndLabel} onChange={e => setNewIndLabel(e.target.value)} placeholder="ex. Poteaux posés" style={{ ...inp, padding: '5px 7px' }} />
                </div>
                <div>
                  <label style={{ ...lbl, fontSize: 9.5 }}>Unité</label>
                  <select value={newIndUnite} onChange={e => setNewIndUnite(e.target.value as IndicateurUnite)} style={{ ...inp, padding: '5px 7px' }}>
                    {UNITES.map(u => <option key={u.value} value={u.value}>{u.label}</option>)}
                  </select>
                </div>
                <div>
                  <label style={{ ...lbl, fontSize: 9.5 }}>Phase</label>
                  <select value={newIndPhase} onChange={e => setNewIndPhase(e.target.value as PhaseKey)} style={{ ...inp, padding: '5px 7px' }}>
                    {template.phases.map(ph => <option key={ph.key} value={ph.key}>{ph.label}</option>)}
                  </select>
                </div>
                <button onClick={addIndicateurProjet} disabled={!newIndLabel.trim()} style={{ padding: '7px 10px', borderRadius: 7, border: 'none', background: newIndLabel.trim() ? '#1B4F8A' : '#CBD5E1', color: '#fff', cursor: newIndLabel.trim() ? 'pointer' : 'default', display: 'flex', alignItems: 'center', gap: 4, fontSize: 11, fontWeight: 700 }}>
                  <Plus size={12} /> Ajouter
                </button>
              </div>
            </div>
          )}

          {/* Avancement par phase (pondéré) */}
          {template && (
            <>
              <div style={{ fontSize: 12, fontWeight: 700, color: '#334155', margin: '14px 0 6px' }}>Avancement par phase</div>
              {template.phases.map(ph => (
                <div key={ph.key} style={{ marginBottom: 8 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: '#475569' }}>
                    <span>{ph.label} <span style={{ color: '#94A3B8' }}>({ph.poids}%)</span></span>
                    <b>{phaseProgress[ph.key] ?? 0}%</b>
                  </div>
                  <input type="range" min={0} max={100} value={phaseProgress[ph.key] ?? 0}
                    onChange={e => setPhaseProgress(p => ({ ...p, [ph.key]: Number(e.target.value) }))}
                    style={{ width: '100%' }} />
                </div>
              ))}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 12px', background: '#F1F5F9', borderRadius: 8, marginTop: 4 }}>
                <span style={{ fontSize: 12, fontWeight: 700, color: '#334155' }}>Avancement physique pondéré</span>
                <span style={{ fontSize: 18, fontWeight: 800, color: weighted >= 70 ? '#16A34A' : weighted >= 40 ? '#F47920' : '#EF3340' }}>{weighted}%</span>
              </div>

              {/* Indicateurs physiques selon le canevas (configurable) */}
              <div style={{ fontSize: 12, fontWeight: 700, color: '#334155', margin: '14px 0 6px' }}>Indicateurs physiques</div>
              {template.indicateurs.length === 0 && (
                <div style={{ fontSize: 11, color: '#94A3B8', fontStyle: 'italic' }}>Aucun indicateur — ajoutez-en via « Personnaliser ».</div>
              )}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                {template.indicateurs.map(ind => (
                  <div key={ind.key}>
                    <label style={{ ...lbl, fontSize: 10.5 }}>{ind.label}</label>
                    <input value={indicVals[ind.key] ?? ''} onChange={e => setIndicVals(v => ({ ...v, [ind.key]: e.target.value }))}
                      placeholder={ind.unite === 'nombre' ? 'ex. 36/36 ou 18' : ind.unite === 'km' ? 'km' : ind.unite === 'ml' ? 'ml' : ind.unite === 'unite' ? 'unité' : '%'} style={inp} />
                  </div>
                ))}
              </div>
            </>
          )}

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginTop: 10 }}>
            <div>
              <label style={lbl}>Facturation période (MFCFA)</label>
              <input value={facturation} onChange={e => setFacturation(e.target.value)} placeholder="0" style={inp} />
            </div>
            <div>
              <label style={lbl}>Photos jointes</label>
              <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                <button onClick={() => setPhotos(n => n + 1)} style={{ ...inp, width: 'auto', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4 }}><Camera size={13} /> +1</button>
                <b style={{ fontSize: 13 }}>{photos}</b>
              </div>
            </div>
          </div>

          <label style={{ ...lbl, marginTop: 10 }}>Observations terrain</label>
          <textarea value={obs} onChange={e => setObs(e.target.value)} rows={2} style={{ ...inp, resize: 'vertical' }} placeholder="Réalisation à date, points bloquants…" />

          <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
            <button onClick={() => handleSave('brouillon')} disabled={!projet} style={{ flex: 1, padding: '9px', borderRadius: 8, border: '1px solid #CBD5E1', background: '#fff', color: '#334155', fontWeight: 700, fontSize: 12, cursor: projet ? 'pointer' : 'default' }}>
              <Save size={13} style={{ verticalAlign: 'middle', marginRight: 4 }} /> Brouillon
            </button>
            <button onClick={() => handleSave('synchronise')} disabled={!projet} style={{ flex: 1, padding: '9px', borderRadius: 8, border: 'none', background: '#1B4F8A', color: '#fff', fontWeight: 700, fontSize: 12, cursor: projet ? 'pointer' : 'default' }}>
              Enregistrer & synchroniser
            </button>
          </div>
        </div>

        {/* ─── Liste des saisies ─── */}
        <div style={{ background: '#fff', borderRadius: 12, border: '1px solid #E2E8F0', padding: 16, maxHeight: 720, overflowY: 'auto' }}>
          <div style={{ fontSize: 13, fontWeight: 800, color: '#0F172A', marginBottom: 12 }}>Saisies terrain ({saisies.length})</div>
          {saisies.map(s => <SaisieCard key={s.id} s={s} onSync={() => syncOne(s.id)} online={online} fmt={fmt} />)}
        </div>
      </div>
    </div>
  );
}

function SaisieCard({ s, onSync, online, fmt }: { s: SaisieTerrain; onSync: () => void; online: boolean; fmt: (d?: string) => string }) {
  const cfg = STATUT_CFG[s.statut];
  const tpl = getTemplateByType(s.templateType);
  const weighted = computeWeightedProgress(s.phaseProgress, tpl?.phases);
  const dateLabel = s.dateVisite
    ? new Date(s.dateVisite).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', year: '2-digit' })
    : s.periode;
  return (
    <div style={{ border: '1px solid #E2E8F0', borderRadius: 10, padding: 12, marginBottom: 10 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8 }}>
        <div style={{ minWidth: 0 }}>
          <div style={{ fontSize: 9, fontFamily: 'monospace', color: '#1B4F8A', fontWeight: 700 }}>{s.projetCode} · {dateLabel}{s.visiteLibelle ? ` · ${s.visiteLibelle}` : ''}</div>
          <div style={{ fontSize: 12, fontWeight: 700, color: '#0F172A', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{s.projetNom}</div>
          <div style={{ fontSize: 10.5, color: '#64748B' }}>{tpl?.label ?? s.templateType} · {s.localisation}</div>
        </div>
        <span style={{ flexShrink: 0, fontSize: 9.5, fontWeight: 700, padding: '3px 8px', borderRadius: 6, background: cfg.bg, color: cfg.color, height: 'fit-content' }}>{cfg.label}</span>
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, margin: '8px 0 4px' }}>
        <div style={{ flex: 1, height: 6, borderRadius: 99, background: '#E5E7EB', overflow: 'hidden' }}>
          <div style={{ width: `${weighted}%`, height: '100%', background: weighted >= 70 ? '#16A34A' : weighted >= 40 ? '#F47920' : '#EF3340' }} />
        </div>
        <b style={{ fontSize: 12, color: '#334155' }}>{weighted}%</b>
      </div>
      {s.observations && <div style={{ fontSize: 10.5, color: '#64748B', marginTop: 2 }}>{s.observations}</div>}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 6, fontSize: 10, color: '#94A3B8' }}>
        <span>{s.auteur} · 📷 {s.photos} · {s.statut === 'synchronise' ? <><CheckCircle2 size={10} style={{ verticalAlign: 'middle' }} /> {fmt(s.syncedAt)}</> : <><Clock size={10} style={{ verticalAlign: 'middle' }} /> {fmt(s.createdAt)}</>}</span>
        {s.statut !== 'synchronise' && (
          <button onClick={onSync} disabled={!online} style={{ padding: '3px 10px', borderRadius: 6, border: 'none', background: online ? '#1B4F8A' : '#CBD5E1', color: '#fff', fontSize: 10.5, fontWeight: 700, cursor: online ? 'pointer' : 'default' }}>Synchroniser</button>
        )}
      </div>
    </div>
  );
}

const lbl: React.CSSProperties = { display: 'block', fontSize: 11, fontWeight: 600, color: '#475569', marginBottom: 4 };
const inp: React.CSSProperties = { width: '100%', padding: '7px 9px', border: '1px solid #E2E8F0', borderRadius: 7, fontSize: 12.5, fontFamily: 'inherit', background: '#F8FAFC', boxSizing: 'border-box' };

'use client';

/**
 * PatrimoineSIG.tsx — Explorateur du PATRIMOINE GÉOGRAPHIQUE (référentiel maître)
 * ------------------------------------------------------------------------------
 * Vue « map-first » : l'objet central est l'ACTIF GÉOGRAPHIQUE, pas le projet.
 * On part de la carte / d'un actif et on remonte vers les projets et les
 * immobilisations qui lui sont rattachés (navigation inversée).
 */

import { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { MapPin, Layers, Building2, Briefcase, ChevronRight, X, Search } from 'lucide-react';
import { MapContainer, TileLayer, CircleMarker, Popup } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import { useProjectStore, REGIONS } from '@/lib/projectStore';
import { useImmobilisationStore } from '@/lib/immobilisationStore';
import {
  derivePatrimoine, mergePatrimoine, usePatrimoineGeoStore,
  TYPE_ACTIF_LABEL, TYPE_ACTIF_COLOR, STATUT_ACTIF_LABEL,
  type ActifGeo, type TypeActifGeo, type StatutActifGeo,
} from '@/lib/patrimoineGeoStore';

const ALL_TYPES: TypeActifGeo[] = ['poste', 'ligne', 'centrale', 'ouvrage', 'site'];

export default function PatrimoineSIG() {
  const store = useProjectStore();
  const immos = useImmobilisationStore(s => s.immobilisations);
  const actifsManuels = usePatrimoineGeoStore(s => s.actifsManuels);
  const router = useRouter();

  // Index projets & immos pour résoudre les libellés des liens.
  const projetById = useMemo(() => {
    const m: Map<string, (typeof store.projets)[number]> = new Map();
    store.projets.forEach(p => m.set(p.id, p));
    return m;
  }, [store.projets]);

  const immoById = useMemo(() => {
    const m: Map<string, (typeof immos)[number]> = new Map();
    immos.forEach(i => m.set(i.id, i));
    return m;
  }, [immos]);

  // RÉFÉRENTIEL : dérivé du SI (projets visibles + immos) + actifs manuels.
  const actifs = useMemo(
    () => mergePatrimoine(derivePatrimoine(store.projets, immos), actifsManuels),
    [store.projets, immos, actifsManuels],
  );

  // ── Filtres ──
  const [activeTypes, setActiveTypes] = useState<Set<TypeActifGeo>>(new Set(ALL_TYPES));
  const [region, setRegion] = useState<string>('');
  const [statut, setStatut] = useState<StatutActifGeo | ''>('');
  const [query, setQuery] = useState('');
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return actifs.filter(a =>
      activeTypes.has(a.type) &&
      (!region || a.region.toLowerCase() === region.toLowerCase()) &&
      (!statut || a.statut === statut) &&
      (!q || a.nom.toLowerCase().includes(q) || a.code.toLowerCase().includes(q) || a.localisation.toLowerCase().includes(q)),
    );
  }, [actifs, activeTypes, region, statut, query]);

  const selected = useMemo(
    () => filtered.find(a => a.id === selectedId) ?? null,
    [filtered, selectedId],
  );

  // ── KPIs ──
  const kpis = useMemo(() => {
    const parType: Record<TypeActifGeo, number> = { poste: 0, ligne: 0, centrale: 0, ouvrage: 0, site: 0 };
    let valeur = 0;
    for (const a of filtered) {
      parType[a.type] += 1;
      valeur += a.valeurAcquisition ?? 0;
    }
    return { total: filtered.length, parType, valeur };
  }, [filtered]);

  const toggleType = (t: TypeActifGeo) => {
    setActiveTypes(prev => {
      const next = new Set(prev);
      if (next.has(t)) next.delete(t); else next.add(t);
      return next;
    });
  };

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minHeight: 0, padding: 16, gap: 12 }}>
      {/* En-tête */}
      <div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <MapPin size={18} style={{ color: 'var(--navy)' }} />
          <h1 style={{ fontSize: 18, fontWeight: 800, color: 'var(--navy)', margin: 0 }}>Patrimoine SIG</h1>
          <span style={{ fontSize: 10, fontWeight: 700, background: '#EFF6FF', color: '#1B4F8A', padding: '2px 8px', borderRadius: 999 }}>
            Référentiel maître
          </span>
        </div>
        <p style={{ fontSize: 12, color: 'var(--muted)', margin: '4px 0 0' }}>
          Le patrimoine géographique est l'objet central : sélectionnez un actif pour voir les projets et immobilisations rattachés.
        </p>
      </div>

      {/* KPIs */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: 8 }}>
        <KpiCard label="Actifs géolocalisés" value={String(kpis.total)} color="var(--navy)" />
        <KpiCard label="Postes / Transfo." value={String(kpis.parType.poste)} color={TYPE_ACTIF_COLOR.poste} />
        <KpiCard label="Lignes" value={String(kpis.parType.ligne)} color={TYPE_ACTIF_COLOR.ligne} />
        <KpiCard label="Centrales" value={String(kpis.parType.centrale)} color={TYPE_ACTIF_COLOR.centrale} />
        <KpiCard label="Valeur immobilisée" value={`${kpis.valeur.toLocaleString('fr-FR', { maximumFractionDigits: 0 })} MFCFA`} color="var(--green)" />
      </div>

      {/* Corps : filtres + liste · carte · détail */}
      <div style={{ flex: 1, display: 'flex', gap: 12, minHeight: 0 }}>
        {/* Colonne gauche : filtres + liste */}
        <div style={{ width: 300, display: 'flex', flexDirection: 'column', gap: 10, minHeight: 0 }}>
          <div className="card" style={{ padding: 12, display: 'flex', flexDirection: 'column', gap: 10 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11, fontWeight: 700, color: 'var(--navy)' }}>
              <Layers size={13} /> Couches du référentiel
            </div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
              {ALL_TYPES.map(t => {
                const on = activeTypes.has(t);
                return (
                  <button
                    key={t}
                    onClick={() => toggleType(t)}
                    style={{
                      fontSize: 10, fontWeight: 700, padding: '4px 8px', borderRadius: 999, cursor: 'pointer',
                      border: `1px solid ${TYPE_ACTIF_COLOR[t]}`,
                      background: on ? TYPE_ACTIF_COLOR[t] : 'transparent',
                      color: on ? '#fff' : TYPE_ACTIF_COLOR[t],
                    }}>
                    {TYPE_ACTIF_LABEL[t].split(' ')[0]}
                  </button>
                );
              })}
            </div>

            <div style={{ position: 'relative' }}>
              <Search size={12} style={{ position: 'absolute', left: 8, top: 9, color: 'var(--muted)' }} />
              <input
                value={query}
                onChange={e => setQuery(e.target.value)}
                placeholder="Rechercher un actif…"
                style={{ width: '100%', padding: '6px 8px 6px 26px', fontSize: 11, border: '1px solid var(--border-2)', borderRadius: 6 }}
              />
            </div>

            <select value={region} onChange={e => setRegion(e.target.value)}
              style={{ width: '100%', padding: '6px 8px', fontSize: 11, border: '1px solid var(--border-2)', borderRadius: 6 }}>
              <option value="">Toutes les régions</option>
              {REGIONS.map(r => <option key={r} value={r}>{r}</option>)}
            </select>

            <select value={statut} onChange={e => setStatut(e.target.value as StatutActifGeo | '')}
              style={{ width: '100%', padding: '6px 8px', fontSize: 11, border: '1px solid var(--border-2)', borderRadius: 6 }}>
              <option value="">Tous les statuts</option>
              {(Object.keys(STATUT_ACTIF_LABEL) as StatutActifGeo[]).map(s => (
                <option key={s} value={s}>{STATUT_ACTIF_LABEL[s]}</option>
              ))}
            </select>
          </div>

          <div className="card" style={{ flex: 1, minHeight: 0, overflowY: 'auto', padding: 8 }}>
            <div style={{ fontSize: 10, color: 'var(--muted)', fontWeight: 700, padding: '0 4px 6px' }}>
              {filtered.length} actif(s)
            </div>
            {filtered.map(a => (
              <button
                key={a.id}
                onClick={() => setSelectedId(a.id === selectedId ? null : a.id)}
                style={{
                  width: '100%', textAlign: 'left', display: 'flex', alignItems: 'center', gap: 8,
                  padding: '6px 8px', borderRadius: 6, cursor: 'pointer', marginBottom: 2,
                  border: 'none', background: a.id === selectedId ? '#EFF6FF' : 'transparent',
                }}>
                <span style={{ width: 8, height: 8, borderRadius: '50%', background: TYPE_ACTIF_COLOR[a.type], flexShrink: 0 }} />
                <span style={{ flex: 1, minWidth: 0 }}>
                  <span style={{ display: 'block', fontSize: 11, fontWeight: 700, color: 'var(--text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{a.nom}</span>
                  <span style={{ display: 'block', fontSize: 9, color: 'var(--muted)' }}>{a.region} · {STATUT_ACTIF_LABEL[a.statut]}</span>
                </span>
              </button>
            ))}
          </div>
        </div>

        {/* Carte centrale */}
        <div className="card" style={{ flex: 1, minHeight: 320, padding: 0, position: 'relative', overflow: 'hidden' }}>
          <MapContainer center={[14.5, -14.5]} zoom={7}
            style={{ width: '100%', height: '100%', minHeight: 320 }} attributionControl={false}>
            <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
            {filtered.map(a => {
              const isSel = a.id === selectedId;
              return (
                <CircleMarker
                  key={a.id}
                  center={[a.lat, a.lng]}
                  radius={isSel ? 10 : 6}
                  pathOptions={{ fillColor: TYPE_ACTIF_COLOR[a.type], fillOpacity: 0.9, color: '#fff', weight: isSel ? 3 : 1.5 }}
                  eventHandlers={{ click: () => setSelectedId(isSel ? null : a.id) }}>
                  <Popup>
                    <div style={{ fontFamily: 'Inter,sans-serif', minWidth: 200 }}>
                      <div style={{ fontSize: 9, color: TYPE_ACTIF_COLOR[a.type], fontWeight: 700 }}>{TYPE_ACTIF_LABEL[a.type]}</div>
                      <div style={{ fontSize: 13, fontWeight: 700, color: '#0E3460', marginBottom: 4 }}>{a.nom}</div>
                      <div style={{ fontSize: 10, color: '#64748B' }}>{a.region} · {a.localisation}</div>
                      <div style={{ fontSize: 10, color: '#374151', marginTop: 4 }}>
                        {a.projetIds.length} projet(s) · {a.immobilisationIds.length} immo(s)
                      </div>
                    </div>
                  </Popup>
                </CircleMarker>
              );
            })}
          </MapContainer>
        </div>

        {/* Détail de l'actif sélectionné */}
        {selected && (
          <div className="card" style={{ width: 320, display: 'flex', flexDirection: 'column', minHeight: 0, overflowY: 'auto' }}>
            <div style={{ padding: '12px 14px', borderBottom: '1px solid var(--border-2)', display: 'flex', alignItems: 'flex-start', gap: 8 }}>
              <span style={{ width: 10, height: 10, borderRadius: '50%', background: TYPE_ACTIF_COLOR[selected.type], marginTop: 4 }} />
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 9, fontWeight: 700, color: TYPE_ACTIF_COLOR[selected.type] }}>{TYPE_ACTIF_LABEL[selected.type]}</div>
                <div style={{ fontSize: 14, fontWeight: 800, color: 'var(--navy)' }}>{selected.nom}</div>
                <div style={{ fontSize: 10, color: 'var(--muted)' }}>{selected.code}</div>
              </div>
              <button onClick={() => setSelectedId(null)} style={{ border: 'none', background: 'transparent', cursor: 'pointer', color: 'var(--muted)' }}>
                <X size={16} />
              </button>
            </div>

            <div style={{ padding: '10px 14px', display: 'flex', flexDirection: 'column', gap: 6, fontSize: 11 }}>
              <Row label="Région" value={selected.region} />
              <Row label="Localisation" value={selected.localisation || '—'} />
              <Row label="Statut" value={STATUT_ACTIF_LABEL[selected.statut]} />
              <Row label="Coordonnées" value={`${selected.lat.toFixed(4)}, ${selected.lng.toFixed(4)}`} />
              {typeof selected.valeurAcquisition === 'number' && (
                <Row label="Valeur" value={`${selected.valeurAcquisition.toLocaleString('fr-FR')} MFCFA`} />
              )}
            </div>

            {/* Projets rattachés */}
            <Section icon={<Briefcase size={13} />} title={`Projets rattachés (${selected.projetIds.length})`}>
              {selected.projetIds.length === 0 && <Empty />}
              {selected.projetIds.map(pid => {
                const p = projetById.get(pid);
                if (!p) return null;
                return (
                  <button
                    key={pid}
                    onClick={() => router.push(`/cockpit-projet?projet=${encodeURIComponent(p.id)}`)}
                    style={linkRowStyle}>
                    <span style={{ flex: 1, minWidth: 0 }}>
                      <span style={{ display: 'block', fontSize: 11, fontWeight: 700, color: 'var(--text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{p.nom}</span>
                      <span style={{ display: 'block', fontSize: 9, color: 'var(--muted)' }}>{p.avancement}% · {p.budget.toFixed(0)} MFCFA</span>
                    </span>
                    <ChevronRight size={12} style={{ color: 'var(--muted)' }} />
                  </button>
                );
              })}
            </Section>

            {/* Immobilisations rattachées */}
            <Section icon={<Building2 size={13} />} title={`Immobilisations (${selected.immobilisationIds.length})`}>
              {selected.immobilisationIds.length === 0 && <Empty />}
              {selected.immobilisationIds.map(iid => {
                const im = immoById.get(iid);
                if (!im) return null;
                return (
                  <button
                    key={iid}
                    onClick={() => router.push('/immobilisations')}
                    style={linkRowStyle}>
                    <span style={{ flex: 1, minWidth: 0 }}>
                      <span style={{ display: 'block', fontSize: 11, fontWeight: 700, color: 'var(--text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{im.designation}</span>
                      <span style={{ display: 'block', fontSize: 9, color: 'var(--muted)' }}>{im.categorie} · {im.valeurAcquisition.toLocaleString('fr-FR')} MFCFA</span>
                    </span>
                    <ChevronRight size={12} style={{ color: 'var(--muted)' }} />
                  </button>
                );
              })}
            </Section>
          </div>
        )}
      </div>
    </div>
  );
}

const linkRowStyle: React.CSSProperties = {
  width: '100%', display: 'flex', alignItems: 'center', gap: 8, padding: '6px 8px',
  borderRadius: 6, cursor: 'pointer', border: '1px solid var(--border-2)', background: '#fff', marginBottom: 4,
};

function KpiCard({ label, value, color }: { label: string; value: string; color: string }) {
  return (
    <div className="card" style={{ padding: '10px 12px' }}>
      <div style={{ fontSize: 10, color: 'var(--muted)' }}>{label}</div>
      <div style={{ fontSize: 18, fontWeight: 800, color }}>{value}</div>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8 }}>
      <span style={{ color: 'var(--muted)' }}>{label}</span>
      <span style={{ fontWeight: 700, color: 'var(--text)', textAlign: 'right' }}>{value}</span>
    </div>
  );
}

function Section({ icon, title, children }: { icon: React.ReactNode; title: string; children: React.ReactNode }) {
  return (
    <div style={{ padding: '8px 14px', borderTop: '1px solid var(--border-2)' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11, fontWeight: 700, color: 'var(--navy)', marginBottom: 6 }}>
        {icon} {title}
      </div>
      {children}
    </div>
  );
}

function Empty() {
  return <div style={{ fontSize: 10, color: 'var(--muted)', fontStyle: 'italic' }}>Aucun élément rattaché.</div>;
}

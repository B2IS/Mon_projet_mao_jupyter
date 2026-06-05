'use client';
/**
 * Structuration.tsx — Structuration des ACTIFS d'un projet (IA), niveau « Modèle
 * Type SENELEC ». L'utilisateur choisit un projet, l'IA construit l'arbre
 * Composant → Sous-composant → Article à partir du bordereau (BOQ), puis il valide
 * (human-in-the-loop). La structuration alimente la gestion de projet ET l'Immo.
 */
import { useMemo, useState } from 'react';
import { Boxes, Wand2, ChevronRight, ChevronDown, CheckCircle2, Building2, Trash2 } from 'lucide-react';
import toast from 'react-hot-toast';
import { useProjectStore } from '@/lib/projectStore';
import { useZonesStore, buildBOQ } from '@/lib/zonesQuantitesStore';
import { useStructurationStore } from '@/lib/structuration/store';
import { structurerDepuisBOQ, type BOQInputRow } from '@/lib/structuration/builder';
import SearchableSelect from '@/components/ui/SearchableSelect';

const fmt = (n: number) => n.toLocaleString('fr-FR');

export default function Structuration() {
  const store = useProjectStore();
  const zones = useZonesStore();
  const struct = useStructurationStore();
  const projets = store.projets;
  const [projetCode, setProjetCode] = useState<string>(projets[0]?.code ?? '');
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());
  const projet = projets.find(p => p.code === projetCode);
  const current = struct.byProjet[projetCode];

  /** Construit les lignes BOQ d'entrée à partir des zones & quantités du projet. */
  const boqRows = useMemo<BOQInputRow[]>(() => {
    const data = zones.byProjet[projetCode];
    if (!data) return [];
    const rows: BOQInputRow[] = [];
    try {
      const boq = buildBOQ(data);
      boq.forEach(b => rows.push({
        code: (b as { code?: string }).code,
        designation: (b as { designation?: string; label?: string }).designation || (b as { label?: string }).label || 'Article',
        unite: (b as { unite?: string }).unite || 'U',
        quantite: (b as { quantite?: number; qte?: number }).quantite ?? (b as { qte?: number }).qte ?? 0,
        prixUnitaire: (b as { prixUnitaire?: number; pu?: number }).prixUnitaire ?? (b as { pu?: number }).pu ?? 0,
        devise: 'CFA',
      }));
    } catch { /* pas de BOQ exploitable */ }
    return rows;
  }, [zones.byProjet, projetCode]);

  const generer = () => {
    if (!projet) return;
    if (!boqRows.length) { toast.error('Aucun bordereau (BOQ) disponible — charge d\'abord les zones & quantités / le bordereau du projet dans Migration.'); return; }
    const s = structurerDepuisBOQ(boqRows, { projetCode: projet.code, projetNom: projet.nom, deviseRef: 'CFA', source: 'IA (BOQ)' });
    struct.save(s);
    toast.success(`Structuration générée : ${s.composants.length} composant(s), ${fmt(s.total)} FCFA.`);
  };
  const toggle = (id: string) => setCollapsed(c => { const n = new Set(c); n.has(id) ? n.delete(id) : n.add(id); return n; });

  return (
    <div style={{ padding: '18px 24px', display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 10 }}>
        <div>
          <h1 className="page-title" style={{ display: 'flex', alignItems: 'center', gap: 8 }}><Boxes size={20} style={{ color: '#F47920' }} /> Structuration des actifs (IA)</h1>
          <p style={{ fontSize: 12.5, color: '#64748B', margin: '3px 0 0' }}>Décomposition automatique Composant → Sous-composant → Article depuis le bordereau — fini la structuration manuelle dans Excel.</p>
        </div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
          <div style={{ minWidth: 280 }}>
            <SearchableSelect value={projetCode} onChange={setProjetCode}
              options={projets.map(p => ({ value: p.code, label: `${p.code || p.id} — ${p.nom}`.slice(0, 70), sub: p.domaine }))}
              placeholder="Choisir un projet…" searchPlaceholder="Projet…" />
          </div>
          <button onClick={generer} disabled={!projet}
            style={{ display: 'flex', alignItems: 'center', gap: 7, padding: '9px 16px', borderRadius: 9, border: 'none', background: '#F47920', color: '#fff', fontSize: 13, fontWeight: 700, cursor: projet ? 'pointer' : 'not-allowed' }}>
            <Wand2 size={15} /> Générer la structuration (IA)
          </button>
        </div>
      </div>

      {/* Bandeau source BOQ */}
      <div style={{ fontSize: 12, color: '#64748B', background: '#F8FAFC', border: '1px solid #E2E8F0', borderRadius: 9, padding: '10px 14px' }}>
        Bordereau détecté pour ce projet : <strong>{boqRows.length}</strong> ligne(s). {current ? <span style={{ color: '#16A34A', fontWeight: 700 }}>· Structuration {current.valide ? 'validée' : 'générée (à valider)'}.</span> : '· Aucune structuration encore générée.'}
      </div>

      {current && (
        <div style={{ background: '#fff', border: '1px solid #E2E8F0', borderRadius: 12, overflow: 'hidden' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 16px', borderBottom: '1px solid #F1F5F9', background: '#FAFBFD', flexWrap: 'wrap', gap: 8 }}>
            <div style={{ fontSize: 13, fontWeight: 800, color: '#0E3460' }}>{current.composants.length} composants · Total {fmt(current.total)} {current.deviseRef}</div>
            <div style={{ display: 'flex', gap: 8 }}>
              {!current.valide && (
                <button onClick={() => { struct.valider(projetCode); toast.success('Structuration validée — capitalisable en Immobilisation.'); }}
                  style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '7px 14px', borderRadius: 8, border: 'none', background: '#16A34A', color: '#fff', fontSize: 12, fontWeight: 700, cursor: 'pointer' }}>
                  <CheckCircle2 size={13} /> Valider la structuration
                </button>
              )}
              {current.valide && <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, fontSize: 12, fontWeight: 700, color: '#16A34A' }}><CheckCircle2 size={14} /> Validée · prête pour Immobilisation</span>}
              <button onClick={() => { struct.remove(projetCode); toast('Structuration supprimée', { icon: '🗑️' }); }}
                style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '7px 10px', borderRadius: 8, border: '1px solid #FCA5A5', background: '#FEF2F2', color: '#B91C1C', fontSize: 12, fontWeight: 700, cursor: 'pointer' }}>
                <Trash2 size={13} />
              </button>
            </div>
          </div>
          <div style={{ maxHeight: '60vh', overflowY: 'auto' }}>
            {current.composants.map(c => (
              <div key={c.id} style={{ borderBottom: '1px solid #F1F5F9' }}>
                <button onClick={() => toggle(c.id)} style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 8, padding: '10px 14px', background: '#F1F5F9', border: 'none', cursor: 'pointer', fontFamily: 'inherit', textAlign: 'left' }}>
                  {collapsed.has(c.id) ? <ChevronRight size={14} /> : <ChevronDown size={14} />}
                  <Building2 size={14} style={{ color: '#0E3460' }} />
                  <span style={{ flex: 1, fontSize: 12.5, fontWeight: 800, color: '#0E3460' }}>{c.nom}</span>
                  <span style={{ fontSize: 12, fontWeight: 700, color: '#475569' }}>{fmt(c.total)} {current.deviseRef}</span>
                </button>
                {!collapsed.has(c.id) && c.sousComposants.map(sc => (
                  <div key={sc.id}>
                    <button onClick={() => toggle(sc.id)} style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 8, padding: '8px 14px 8px 30px', background: '#fff', border: 'none', cursor: 'pointer', fontFamily: 'inherit', textAlign: 'left' }}>
                      {collapsed.has(sc.id) ? <ChevronRight size={12} /> : <ChevronDown size={12} />}
                      <span style={{ flex: 1, fontSize: 12, fontWeight: 600, color: '#1E293B' }}>{sc.code ? `${sc.code} · ` : ''}{sc.nom}</span>
                      <span style={{ fontSize: 11.5, color: '#64748B' }}>{sc.articles.length} art.</span>
                      <span style={{ fontSize: 11.5, fontWeight: 700, color: '#475569', minWidth: 90, textAlign: 'right' }}>{fmt(sc.total)}</span>
                    </button>
                    {!collapsed.has(sc.id) && (
                      <div style={{ overflowX: 'auto' }}>
                        <table className="tbl" style={{ fontSize: 11 }}>
                          <thead><tr><th>Code</th><th>Désignation</th><th>Unité</th><th style={{ textAlign: 'right' }}>Qté</th><th style={{ textAlign: 'right' }}>PU</th><th style={{ textAlign: 'right' }}>Total</th></tr></thead>
                          <tbody>
                            {sc.articles.map(a => (
                              <tr key={a.id}><td style={{ fontFamily: 'monospace', fontSize: 10 }}>{a.code || '—'}</td><td>{a.designation}</td><td>{a.unite}</td><td style={{ textAlign: 'right' }}>{fmt(a.quantite)}</td><td style={{ textAlign: 'right' }}>{fmt(a.prixUnitaire)}</td><td style={{ textAlign: 'right', fontWeight: 700 }}>{fmt(a.total)}</td></tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

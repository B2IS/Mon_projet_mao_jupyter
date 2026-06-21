'use client';
import { useState } from 'react';
import {
  GitCompare, CheckCircle2, AlertTriangle, XCircle, Map, Camera,
  FileText, TrendingUp, Plus, Search, ChevronRight, Eye,
  ArrowRight, Layers, Building2, Zap,
} from 'lucide-react';

const C = {
  navy:   '#1B2A4A',
  orange: '#F47920',
  blue:   '#1E40AF',
  green:  '#059669',
  amber:  '#D97706',
  red:    '#DC2626',
  purple: '#7C3AED',
  slate:  '#64748B',
  bg:     '#F8FAFC',
  card:   '#FFFFFF',
  border: '#E2E8F0',
};

type PhaseType = 'AS_PLANNED' | 'AS_DESIGNED' | 'AS_BUILT';
type EcartType = 'CONFORME' | 'ECART_MINEUR' | 'ECART_MAJEUR' | 'MANQUANT' | 'SURPLUS';

interface LigneRecolement {
  id: string;
  reference: string;
  designation: string;
  ouvrage: string;
  localite: string;
  qtePlanned: number;
  qteDesigned: number;
  qteBuilt: number;
  unite: string;
  ecart: EcartType;
  hasSIG: boolean;
  photos: number;
  note?: string;
}

interface DossierRecolement {
  id: string;
  projet: string;
  domaine: string;
  localite: string;
  region: string;
  entreprise: string;
  dateReception: string;
  tauxConformite: number;
  statut: 'EN_COURS' | 'VALIDE' | 'LITIGE';
  lignes: LigneRecolement[];
}

const DOSSIERS: DossierRecolement[] = [];

const ECART_CONFIG: Record<EcartType, { label: string; color: string; bg: string; icon: typeof CheckCircle2 }> = {
  CONFORME:     { label: 'Conforme',     color: '#059669', bg: '#F0FDF4', icon: CheckCircle2 },
  ECART_MINEUR: { label: 'Écart mineur', color: '#D97706', bg: '#FFF7ED', icon: AlertTriangle },
  ECART_MAJEUR: { label: 'Écart majeur', color: '#DC2626', bg: '#FEF2F2', icon: XCircle },
  MANQUANT:     { label: 'Manquant',     color: '#7C3AED', bg: '#F5F3FF', icon: XCircle },
  SURPLUS:      { label: 'Surplus',      color: '#0D9488', bg: '#F0FDFA', icon: AlertTriangle },
};

function PhaseTag({ phase }: { phase: PhaseType }) {
  const conf = {
    AS_PLANNED: { label: 'AS PLANNED', color: '#1D4ED8', bg: '#EFF6FF' },
    AS_DESIGNED: { label: 'AS DESIGNED', color: '#7C3AED', bg: '#F5F3FF' },
    AS_BUILT:   { label: 'AS BUILT',   color: '#059669', bg: '#F0FDF4' },
  }[phase];
  return (
    <span style={{ fontSize: 10, fontWeight: 800, letterSpacing: '0.05em', color: conf.color, background: conf.bg, padding: '3px 8px', borderRadius: 6, whiteSpace: 'nowrap' }}>
      {conf.label}
    </span>
  );
}

export default function Recolement() {
  const [activeDossier, setActiveDossier] = useState<string | null>(null);
  const [search, setSearch] = useState('');

  const dossier = activeDossier ? DOSSIERS.find(d => d.id === activeDossier) : null;
  const filteredDossiers = DOSSIERS.filter(d =>
    !search || d.projet.toLowerCase().includes(search.toLowerCase()) ||
    d.localite.toLowerCase().includes(search.toLowerCase())
  );

  const totalConformes = DOSSIERS.flatMap(d => d.lignes).filter(l => l.ecart === 'CONFORME').length;
  const totalEcarts = DOSSIERS.flatMap(d => d.lignes).filter(l => l.ecart !== 'CONFORME').length;
  const totalSIG = DOSSIERS.flatMap(d => d.lignes).filter(l => l.hasSIG).length;

  return (
    <div style={{ background: C.bg, minHeight: '100vh', padding: '24px 28px' }}>

      {/* Header */}
      <div style={{ marginBottom: 24 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4, color: C.slate, fontSize: 12 }}>
          <span>Projets</span>
          <ChevronRight size={12} />
          <span>Clôture → SIG</span>
          <ChevronRight size={12} />
          <span style={{ color: C.navy, fontWeight: 600 }}>Récolement Numérique</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div>
            <h1 style={{ fontSize: 22, fontWeight: 800, color: C.navy, margin: 0 }}>
              Récolement Numérique
            </h1>
            <p style={{ fontSize: 13, color: C.slate, margin: '4px 0 0' }}>
              Comparaison automatique As Planned → As Designed → As Built · Le récolement constitue la vérité terrain
            </p>
          </div>
          <button style={{ display: 'flex', alignItems: 'center', gap: 7, padding: '9px 18px', background: C.orange, color: '#fff', border: 'none', borderRadius: 9, fontSize: 13, fontWeight: 700, cursor: 'pointer' }}>
            <Plus size={15} /> Nouveau dossier
          </button>
        </div>
      </div>

      {/* Cycle de vie visuel */}
      <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 12, padding: '16px 20px', marginBottom: 20 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
          <span style={{ fontSize: 11.5, fontWeight: 700, color: C.slate }}>Cycle de vie :</span>
          <PhaseTag phase="AS_PLANNED" />
          <ArrowRight size={14} style={{ color: C.slate }} />
          <PhaseTag phase="AS_DESIGNED" />
          <ArrowRight size={14} style={{ color: C.slate }} />
          <PhaseTag phase="AS_BUILT" />
          <ArrowRight size={14} style={{ color: C.slate }} />
          <span style={{ fontSize: 11.5, fontWeight: 800, color: '#059669', background: '#F0FDF4', padding: '3px 10px', borderRadius: 6, border: '1px solid #BBF7D0' }}>
            ✓ Mise à jour SIG Patrimoine
          </span>
        </div>
        <p style={{ fontSize: 11.5, color: C.slate, margin: '8px 0 0' }}>
          Le Récolement valide la conformité des ouvrages réalisés par rapport aux prévisions et déclenche automatiquement la mise à jour du référentiel patrimonial SIG.
        </p>
      </div>

      {/* KPIs */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 14, marginBottom: 20 }}>
        {[
          { label: 'Dossiers actifs', value: DOSSIERS.filter(d => d.statut === 'EN_COURS').length, color: C.amber, icon: GitCompare },
          { label: 'Lignes conformes', value: totalConformes, color: C.green, icon: CheckCircle2 },
          { label: 'Écarts détectés', value: totalEcarts, color: C.red, icon: AlertTriangle },
          { label: 'Géolocalisés SIG', value: totalSIG, color: C.blue, icon: Map },
        ].map(k => {
          const Icon = k.icon;
          return (
            <div key={k.label} style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 10, padding: '14px 16px', display: 'flex', alignItems: 'center', gap: 12 }}>
              <div style={{ width: 36, height: 36, borderRadius: 9, background: `${k.color}14`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                <Icon size={18} style={{ color: k.color }} />
              </div>
              <div>
                <div style={{ fontSize: 22, fontWeight: 800, color: k.color, lineHeight: 1 }}>{k.value}</div>
                <div style={{ fontSize: 11, color: C.slate, fontWeight: 600, marginTop: 2 }}>{k.label}</div>
              </div>
            </div>
          );
        })}
      </div>

      {!dossier ? (
        <>
          {/* Search */}
          <div style={{ position: 'relative', maxWidth: 360, marginBottom: 16 }}>
            <Search size={14} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: C.slate }} />
            <input
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Rechercher un dossier…"
              style={{ width: '100%', paddingLeft: 32, paddingRight: 12, paddingTop: 8, paddingBottom: 8, border: `1px solid ${C.border}`, borderRadius: 8, fontSize: 12.5, color: C.navy, background: C.card, outline: 'none', boxSizing: 'border-box' }}
            />
          </div>

          {/* Liste dossiers */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {filteredDossiers.map(d => {
              const statutConf = {
                EN_COURS: { label: 'En cours', color: C.amber, bg: '#FFF7ED' },
                VALIDE:   { label: 'Validé',   color: C.green,  bg: '#F0FDF4' },
                LITIGE:   { label: 'Litige',   color: C.red,    bg: '#FEF2F2' },
              }[d.statut];
              const ecarts = d.lignes.filter(l => l.ecart !== 'CONFORME').length;

              return (
                <div
                  key={d.id}
                  onClick={() => setActiveDossier(d.id)}
                  style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 12, padding: '16px 20px', cursor: 'pointer', transition: 'box-shadow 0.15s' }}
                  onMouseEnter={e => { (e.currentTarget as HTMLDivElement).style.boxShadow = '0 4px 16px rgba(0,0,0,0.08)'; (e.currentTarget as HTMLDivElement).style.borderColor = '#CBD5E1'; }}
                  onMouseLeave={e => { (e.currentTarget as HTMLDivElement).style.boxShadow = 'none'; (e.currentTarget as HTMLDivElement).style.borderColor = C.border; }}
                >
                  <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 16 }}>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                        <span style={{ fontSize: 11, fontFamily: 'monospace', color: C.slate }}>{d.id}</span>
                        <span style={{ fontSize: 11, fontWeight: 700, color: '#7C3AED', background: '#F5F3FF', padding: '2px 7px', borderRadius: 5 }}>{d.domaine}</span>
                        <span style={{ fontSize: 11, fontWeight: 700, color: statutConf.color, background: statutConf.bg, padding: '2px 7px', borderRadius: 5 }}>{statutConf.label}</span>
                      </div>
                      <h3 style={{ fontSize: 14, fontWeight: 700, color: C.navy, margin: '0 0 8px' }}>{d.projet}</h3>
                      <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap' }}>
                        <span style={{ fontSize: 12, color: C.slate, display: 'flex', alignItems: 'center', gap: 5 }}><Building2 size={12} />{d.entreprise}</span>
                        <span style={{ fontSize: 12, color: C.slate, display: 'flex', alignItems: 'center', gap: 5 }}><Map size={12} />{d.localite}, {d.region}</span>
                        <span style={{ fontSize: 12, color: C.slate }}>Réception {d.dateReception}</span>
                      </div>
                    </div>
                    <div style={{ flexShrink: 0, textAlign: 'right' }}>
                      <div style={{ fontSize: 26, fontWeight: 800, color: d.tauxConformite >= 95 ? C.green : d.tauxConformite >= 80 ? C.amber : C.red, lineHeight: 1 }}>
                        {d.tauxConformite}%
                      </div>
                      <div style={{ fontSize: 10, color: C.slate, fontWeight: 600 }}>conformité</div>
                      {ecarts > 0 && (
                        <div style={{ fontSize: 11, color: C.red, fontWeight: 700, marginTop: 4 }}>
                          {ecarts} écart{ecarts > 1 ? 's' : ''}
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Progress bar */}
                  <div style={{ marginTop: 12, height: 6, background: '#F1F5F9', borderRadius: 99, overflow: 'hidden' }}>
                    <div style={{ width: `${d.tauxConformite}%`, height: '100%', background: d.tauxConformite >= 95 ? C.green : d.tauxConformite >= 80 ? C.amber : C.red, borderRadius: 99 }} />
                  </div>
                </div>
              );
            })}
          </div>
        </>
      ) : (
        /* Détail dossier */
        <div>
          <button
            onClick={() => setActiveDossier(null)}
            style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12.5, color: C.orange, fontWeight: 700, background: 'none', border: 'none', cursor: 'pointer', marginBottom: 16, padding: 0 }}
          >
            ← Retour aux dossiers
          </button>

          <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 12, padding: '20px', marginBottom: 16 }}>
            <h2 style={{ fontSize: 16, fontWeight: 800, color: C.navy, margin: '0 0 4px' }}>{dossier.projet}</h2>
            <p style={{ fontSize: 12.5, color: C.slate, margin: 0 }}>{dossier.entreprise} · {dossier.localite} · Réception {dossier.dateReception}</p>
          </div>

          {/* Tableau comparatif */}
          <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 12, overflow: 'hidden' }}>
            <div style={{ padding: '14px 20px', borderBottom: `1px solid ${C.border}`, display: 'flex', alignItems: 'center', gap: 10 }}>
              <GitCompare size={16} style={{ color: C.orange }} />
              <span style={{ fontSize: 14, fontWeight: 700, color: C.navy }}>Comparaison As Planned → As Designed → As Built</span>
            </div>
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12.5, tableLayout: 'fixed' }}>
                <colgroup>
                  <col style={{ width: 80 }} />
                  <col />
                  <col style={{ width: 120 }} />
                  <col style={{ width: 80 }} />
                  <col style={{ width: 80 }} />
                  <col style={{ width: 80 }} />
                  <col style={{ width: 110 }} />
                  <col style={{ width: 70 }} />
                  <col style={{ width: 60 }} />
                </colgroup>
                <thead>
                  <tr style={{ background: '#F8FAFC' }}>
                    {['Réf.', 'Désignation', 'Ouvrage', 'As Planned', 'As Designed', 'As Built', 'Écart', 'SIG', 'Photos'].map(h => (
                      <th key={h} style={{ padding: '10px 12px', textAlign: 'left', fontSize: 10.5, fontWeight: 700, color: C.slate, textTransform: 'uppercase', letterSpacing: '0.05em', borderBottom: `1px solid ${C.border}`, whiteSpace: 'nowrap' }}>
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {dossier.lignes.map((ligne, i) => {
                    const ecartConf = ECART_CONFIG[ligne.ecart];
                    const EcartIcon = ecartConf.icon;
                    return (
                      <tr key={ligne.id} style={{ background: i % 2 === 0 ? '#FAFBFC' : C.card, borderBottom: `1px solid ${C.border}` }}>
                        <td style={{ padding: '10px 12px', fontFamily: 'monospace', fontSize: 11, color: C.slate, whiteSpace: 'nowrap' }}>{ligne.reference}</td>
                        <td style={{ padding: '10px 12px', color: C.navy, fontWeight: 600, wordBreak: 'break-word', lineHeight: 1.4 }}>{ligne.designation}
                          {ligne.note && <div style={{ fontSize: 11, color: C.slate, fontWeight: 400, marginTop: 2 }}>{ligne.note}</div>}
                        </td>
                        <td style={{ padding: '10px 12px', color: C.slate, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{ligne.ouvrage}</td>
                        <td style={{ padding: '10px 12px', textAlign: 'right', fontWeight: 700, color: '#1D4ED8', whiteSpace: 'nowrap' }}>
                          {ligne.qtePlanned.toLocaleString()} <span style={{ fontWeight: 400, color: C.slate }}>{ligne.unite}</span>
                        </td>
                        <td style={{ padding: '10px 12px', textAlign: 'right', fontWeight: 700, color: '#7C3AED', whiteSpace: 'nowrap' }}>
                          {ligne.qteDesigned.toLocaleString()} <span style={{ fontWeight: 400, color: C.slate }}>{ligne.unite}</span>
                        </td>
                        <td style={{ padding: '10px 12px', textAlign: 'right', fontWeight: 700, color: '#059669', whiteSpace: 'nowrap' }}>
                          {ligne.qteBuilt.toLocaleString()} <span style={{ fontWeight: 400, color: C.slate }}>{ligne.unite}</span>
                        </td>
                        <td style={{ padding: '10px 12px', whiteSpace: 'nowrap' }}>
                          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, fontSize: 11, fontWeight: 700, color: ecartConf.color, background: ecartConf.bg, padding: '3px 8px', borderRadius: 6 }}>
                            <EcartIcon size={11} />{ecartConf.label}
                          </span>
                        </td>
                        <td style={{ padding: '10px 12px', textAlign: 'center', whiteSpace: 'nowrap' }}>
                          {ligne.hasSIG
                            ? <span style={{ fontSize: 11, fontWeight: 700, color: C.green }}>✓ SIG</span>
                            : <span style={{ fontSize: 11, fontWeight: 700, color: C.red }}>✗</span>
                          }
                        </td>
                        <td style={{ padding: '10px 12px', textAlign: 'center', whiteSpace: 'nowrap' }}>
                          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 11, color: C.slate }}>
                            <Camera size={11} />{ligne.photos}
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Footer dossier */}
            <div style={{ padding: '14px 20px', borderTop: `1px solid ${C.border}`, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16, flexWrap: 'wrap' }}>
              <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap' }}>
                <span style={{ fontSize: 12, color: C.green, fontWeight: 700 }}>✓ {dossier.lignes.filter(l => l.ecart === 'CONFORME').length} conformes</span>
                <span style={{ fontSize: 12, color: C.amber, fontWeight: 700 }}>⚠ {dossier.lignes.filter(l => l.ecart === 'ECART_MINEUR').length} écarts mineurs</span>
                <span style={{ fontSize: 12, color: C.red, fontWeight: 700 }}>✗ {dossier.lignes.filter(l => l.ecart === 'MANQUANT' || l.ecart === 'ECART_MAJEUR').length} manquants</span>
              </div>
              <button style={{ display: 'flex', alignItems: 'center', gap: 7, padding: '9px 18px', background: C.green, color: '#fff', border: 'none', borderRadius: 9, fontSize: 13, fontWeight: 700, cursor: 'pointer' }}>
                <Zap size={14} /> Valider & Activer patrimoine SIG
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

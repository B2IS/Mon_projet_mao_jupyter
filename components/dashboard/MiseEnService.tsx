'use client';
import { useState } from 'react';
import {
  Zap, CheckCircle2, Clock, FileText, Map, Building2,
  Plus, Search, ChevronRight, Calendar, ArrowRight,
  Database, AlertCircle, TrendingUp, Shield,
} from 'lucide-react';

const C = {
  navy:   '#1B2A4A',
  orange: '#F47920',
  blue:   '#1E40AF',
  green:  '#059669',
  amber:  '#D97706',
  red:    '#DC2626',
  teal:   '#0D9488',
  slate:  '#64748B',
  bg:     '#F8FAFC',
  card:   '#FFFFFF',
  border: '#E2E8F0',
};

type StatutMES = 'EN_PREPARATION' | 'PV_SIGNE' | 'ACTIF' | 'SUSPENDU';

interface ActifMES {
  id: string;
  assetId: string;
  designation: string;
  famille: string;
  ouvrage: string;
  localite: string;
  region: string;
  domaine: string;
  projet: string;
  quantite: number;
  unite: string;
  valeurBrute: number;
  dateMES: string;
  dureeAmortissement: number;
  statutMES: StatutMES;
  hasSIG: boolean;
  hasImmo: boolean;
  pvReference: string;
}

interface DossierMES {
  id: string;
  projet: string;
  domaine: string;
  localite: string;
  region: string;
  entreprise: string;
  datePVReception: string;
  dateMES?: string;
  statut: StatutMES;
  actifs: ActifMES[];
  valeurTotale: number;
}

const DOSSIERS_MES: DossierMES[] = [
  {
    id: 'MES-001',
    projet: 'Programme HTB Backbone Kaolack',
    domaine: 'Transport',
    localite: 'Kaolack', region: 'Kaolack',
    entreprise: 'NEXANS Africa',
    datePVReception: '2025-03-10',
    dateMES: '2025-04-01',
    statut: 'ACTIF',
    valeurTotale: 4_850_000_000,
    actifs: [
      { id: 'A001', assetId: 'IMMO-HTB-2025-001', designation: 'Ligne HTB 225 kV simple terne', famille: 'Réseaux HTB', ouvrage: 'Ligne Tobène–Kaolack', localite: 'Kaolack', region: 'Kaolack', domaine: 'Transport', projet: 'Programme HTB Backbone', quantite: 120, unite: 'km', valeurBrute: 3_600_000_000, dateMES: '2025-04-01', dureeAmortissement: 40, statutMES: 'ACTIF', hasSIG: true, hasImmo: true, pvReference: 'PV-MES-001/2025' },
      { id: 'A002', assetId: 'IMMO-HTB-2025-002', designation: 'Pylône métal 3KA', famille: 'Structures HTB', ouvrage: 'Ligne Tobène–Kaolack', localite: 'Mbour', region: 'Thiès', domaine: 'Transport', projet: 'Programme HTB Backbone', quantite: 360, unite: 'u', valeurBrute: 1_250_000_000, dateMES: '2025-04-01', dureeAmortissement: 40, statutMES: 'ACTIF', hasSIG: true, hasImmo: true, pvReference: 'PV-MES-001/2025' },
    ],
  },
  {
    id: 'MES-002',
    projet: 'Extension réseau HTA Thiès Nord',
    domaine: 'Distribution',
    localite: 'Thiès', region: 'Thiès',
    entreprise: 'ELEC-BTP Sénégal',
    datePVReception: '2025-05-20',
    statut: 'EN_PREPARATION',
    valeurTotale: 680_000_000,
    actifs: [
      { id: 'A003', assetId: 'IMMO-HTA-2025-003', designation: 'Transformateur 630 kVA', famille: 'Transformateurs HTA', ouvrage: 'Poste HTA Thiès Nord', localite: 'Thiès', region: 'Thiès', domaine: 'Distribution', projet: 'Extension HTA Thiès Nord', quantite: 3, unite: 'u', valeurBrute: 180_000_000, dateMES: '', dureeAmortissement: 20, statutMES: 'EN_PREPARATION', hasSIG: true, hasImmo: false, pvReference: 'PV-RECEP-002/2025' },
      { id: 'A004', assetId: 'IMMO-HTA-2025-004', designation: 'Câble HTA 3x95 mm²', famille: 'Réseaux HTA', ouvrage: 'Réseau HTA Thiès Nord', localite: 'Thiès', region: 'Thiès', domaine: 'Distribution', projet: 'Extension HTA Thiès Nord', quantite: 4280, unite: 'm', valeurBrute: 385_000_000, dateMES: '', dureeAmortissement: 30, statutMES: 'EN_PREPARATION', hasSIG: true, hasImmo: false, pvReference: 'PV-RECEP-002/2025' },
      { id: 'A005', assetId: 'IMMO-HTA-2025-005', designation: 'Disjoncteur 24 kV', famille: 'Appareillage HTA', ouvrage: 'Poste HTA Thiès Nord', localite: 'Thiès', region: 'Thiès', domaine: 'Distribution', projet: 'Extension HTA Thiès Nord', quantite: 4, unite: 'u', valeurBrute: 115_000_000, dateMES: '', dureeAmortissement: 15, statutMES: 'EN_PREPARATION', hasSIG: false, hasImmo: false, pvReference: 'PV-RECEP-002/2025' },
    ],
  },
];

const STATUT_CONFIG: Record<StatutMES, { label: string; color: string; bg: string; icon: typeof Zap }> = {
  EN_PREPARATION: { label: 'En préparation', color: C.amber,  bg: '#FFF7ED', icon: Clock },
  PV_SIGNE:       { label: 'PV signé',        color: C.blue,   bg: '#EFF6FF', icon: FileText },
  ACTIF:          { label: 'Actif',            color: C.green,  bg: '#F0FDF4', icon: Zap },
  SUSPENDU:       { label: 'Suspendu',         color: C.red,    bg: '#FEF2F2', icon: AlertCircle },
};

function formatAmount(v: number) {
  if (v >= 1_000_000_000) return `${(v / 1_000_000_000).toFixed(1)} Md FCFA`;
  if (v >= 1_000_000) return `${(v / 1_000_000).toFixed(0)} M FCFA`;
  return `${v.toLocaleString()} FCFA`;
}

export default function MiseEnService() {
  const [activeDossier, setActiveDossier] = useState<string | null>(null);
  const [search, setSearch] = useState('');

  const dossier = activeDossier ? DOSSIERS_MES.find(d => d.id === activeDossier) : null;
  const totalActifs = DOSSIERS_MES.flatMap(d => d.actifs);
  const totalImmo = DOSSIERS_MES.reduce((s, d) => s + d.valeurTotale, 0);
  const actifsActifs = totalActifs.filter(a => a.statutMES === 'ACTIF').length;
  const actifsSIG = totalActifs.filter(a => a.hasSIG).length;
  const actifsImmo = totalActifs.filter(a => a.hasImmo).length;

  return (
    <div style={{ background: C.bg, minHeight: '100vh', padding: '24px 28px' }}>

      {/* Header */}
      <div style={{ marginBottom: 24 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4, color: C.slate, fontSize: 12 }}>
          <span>Projets</span>
          <ChevronRight size={12} />
          <span>Clôture → SIG</span>
          <ChevronRight size={12} />
          <span style={{ color: C.navy, fontWeight: 600 }}>Mise en Service</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div>
            <h1 style={{ fontSize: 22, fontWeight: 800, color: C.navy, margin: 0 }}>
              Mise en Service & Activation Patrimoine
            </h1>
            <p style={{ fontSize: 13, color: C.slate, margin: '4px 0 0' }}>
              PV de réception · Validation ouvrages · Activation automatique du patrimoine SIG · Création des immobilisations
            </p>
          </div>
          <button style={{ display: 'flex', alignItems: 'center', gap: 7, padding: '9px 18px', background: C.orange, color: '#fff', border: 'none', borderRadius: 9, fontSize: 13, fontWeight: 700, cursor: 'pointer' }}>
            <Plus size={15} /> Nouveau dossier MES
          </button>
        </div>
      </div>

      {/* Flux MES */}
      <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 12, padding: '16px 20px', marginBottom: 20 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
          <span style={{ fontSize: 11.5, fontWeight: 700, color: C.slate }}>Flux :</span>
          {[
            { label: 'PV Réception', color: '#1D4ED8', bg: '#EFF6FF' },
            { label: 'Validation ouvrages', color: '#7C3AED', bg: '#F5F3FF' },
            { label: 'PV Mise en Service', color: '#059669', bg: '#F0FDF4' },
          ].map((step, i) => (
            <>
              <span key={step.label} style={{ fontSize: 11, fontWeight: 800, color: step.color, background: step.bg, padding: '3px 10px', borderRadius: 6 }}>{step.label}</span>
              {i < 2 && <ArrowRight key={`arrow-${i}`} size={14} style={{ color: C.slate }} />}
            </>
          ))}
          <ArrowRight size={14} style={{ color: C.slate }} />
          <span style={{ fontSize: 11, fontWeight: 800, color: C.teal, background: '#F0FDFA', padding: '3px 10px', borderRadius: 6, border: '1px solid #99F6E4' }}>
            Maj SIG
          </span>
          <ArrowRight size={14} style={{ color: C.slate }} />
          <span style={{ fontSize: 11, fontWeight: 800, color: C.orange, background: '#FFF7ED', padding: '3px 10px', borderRadius: 6, border: '1px solid #FED7AA' }}>
            Immobilisation
          </span>
          <ArrowRight size={14} style={{ color: C.slate }} />
          <span style={{ fontSize: 11, fontWeight: 800, color: '#9333EA', background: '#FAF5FF', padding: '3px 10px', borderRadius: 6, border: '1px solid #E9D5FF' }}>
            Amortissement
          </span>
        </div>
      </div>

      {/* KPIs */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 14, marginBottom: 20 }}>
        {[
          { label: 'Actifs en service', value: actifsActifs, color: C.green, icon: Zap, sub: `${totalActifs.length} total` },
          { label: 'Valeur immobilisée', value: formatAmount(totalImmo), color: C.orange, icon: TrendingUp, sub: 'portefeuille' },
          { label: 'Géolocalisés SIG', value: actifsSIG, color: C.blue, icon: Map, sub: `${totalActifs.length - actifsSIG} sans SIG` },
          { label: 'Immobilisés SAP', value: actifsImmo, color: C.teal, icon: Database, sub: `${totalActifs.length - actifsImmo} en attente` },
        ].map(k => {
          const Icon = k.icon;
          return (
            <div key={k.label} style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 10, padding: '14px 16px', display: 'flex', alignItems: 'center', gap: 12 }}>
              <div style={{ width: 36, height: 36, borderRadius: 9, background: `${k.color}14`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                <Icon size={18} style={{ color: k.color }} />
              </div>
              <div>
                <div style={{ fontSize: typeof k.value === 'string' ? 15 : 22, fontWeight: 800, color: k.color, lineHeight: 1 }}>{k.value}</div>
                <div style={{ fontSize: 11, color: C.slate, fontWeight: 600, marginTop: 2 }}>{k.label}</div>
                <div style={{ fontSize: 10, color: '#94A3B8', marginTop: 1 }}>{k.sub}</div>
              </div>
            </div>
          );
        })}
      </div>

      {!dossier ? (
        <>
          <div style={{ position: 'relative', maxWidth: 360, marginBottom: 16 }}>
            <Search size={14} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: C.slate }} />
            <input
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Rechercher un dossier MES…"
              style={{ width: '100%', paddingLeft: 32, paddingRight: 12, paddingTop: 8, paddingBottom: 8, border: `1px solid ${C.border}`, borderRadius: 8, fontSize: 12.5, color: C.navy, background: C.card, outline: 'none', boxSizing: 'border-box' }}
            />
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {DOSSIERS_MES.filter(d => !search || d.projet.toLowerCase().includes(search.toLowerCase())).map(d => {
              const conf = STATUT_CONFIG[d.statut];
              const Icon = conf.icon;
              const actifsOk = d.actifs.filter(a => a.hasImmo).length;
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
                        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 11, fontWeight: 700, color: conf.color, background: conf.bg, padding: '2px 8px', borderRadius: 5 }}>
                          <Icon size={10} />{conf.label}
                        </span>
                      </div>
                      <h3 style={{ fontSize: 14, fontWeight: 700, color: C.navy, margin: '0 0 8px' }}>{d.projet}</h3>
                      <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap', marginBottom: 10 }}>
                        <span style={{ fontSize: 12, color: C.slate, display: 'flex', alignItems: 'center', gap: 5 }}><Building2 size={12} />{d.entreprise}</span>
                        <span style={{ fontSize: 12, color: C.slate, display: 'flex', alignItems: 'center', gap: 5 }}><Map size={12} />{d.localite}, {d.region}</span>
                        <span style={{ fontSize: 12, color: C.slate, display: 'flex', alignItems: 'center', gap: 5 }}><Calendar size={12} />PV réception {d.datePVReception}</span>
                        {d.dateMES && <span style={{ fontSize: 12, color: C.green, fontWeight: 700, display: 'flex', alignItems: 'center', gap: 5 }}><Zap size={12} />MES {d.dateMES}</span>}
                      </div>
                      <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap' }}>
                        <div style={{ fontSize: 12, color: C.slate }}><span style={{ fontWeight: 700, color: C.navy }}>{d.actifs.length}</span> actifs patrimoniaux</div>
                        <div style={{ fontSize: 12, color: C.slate }}><span style={{ fontWeight: 700, color: actifsOk === d.actifs.length ? C.green : C.amber }}>{actifsOk}/{d.actifs.length}</span> immobilisés</div>
                        <div style={{ fontSize: 12, color: C.slate }}><span style={{ fontWeight: 700, color: C.orange }}>{formatAmount(d.valeurTotale)}</span></div>
                      </div>
                    </div>
                    <div style={{ flexShrink: 0, textAlign: 'right' }}>
                      <div style={{ fontSize: 11, color: C.slate, fontWeight: 600, marginBottom: 8 }}>Valeur totale</div>
                      <div style={{ fontSize: 20, fontWeight: 800, color: C.orange }}>{formatAmount(d.valeurTotale)}</div>
                    </div>
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
            ← Retour aux dossiers MES
          </button>

          <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 12, padding: '20px', marginBottom: 16 }}>
            <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 20 }}>
              <div>
                <h2 style={{ fontSize: 16, fontWeight: 800, color: C.navy, margin: '0 0 4px' }}>{dossier.projet}</h2>
                <p style={{ fontSize: 12.5, color: C.slate, margin: 0 }}>{dossier.entreprise} · {dossier.localite} · PV Réception {dossier.datePVReception}</p>
              </div>
              {dossier.statut === 'EN_PREPARATION' && (
                <button style={{ display: 'flex', alignItems: 'center', gap: 7, padding: '9px 18px', background: C.green, color: '#fff', border: 'none', borderRadius: 9, fontSize: 13, fontWeight: 700, cursor: 'pointer', flexShrink: 0 }}>
                  <Zap size={14} /> Activer la MES
                </button>
              )}
            </div>
          </div>

          {/* Registre actifs */}
          <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 12, overflow: 'hidden' }}>
            <div style={{ padding: '14px 20px', borderBottom: `1px solid ${C.border}`, display: 'flex', alignItems: 'center', gap: 10 }}>
              <Database size={16} style={{ color: C.orange }} />
              <span style={{ fontSize: 14, fontWeight: 700, color: C.navy }}>Registre des actifs patrimoniaux</span>
            </div>
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12.5, tableLayout: 'fixed' }}>
                <colgroup>
                  <col style={{ width: 110 }} />
                  <col />
                  <col style={{ width: 120 }} />
                  <col style={{ width: 90 }} />
                  <col style={{ width: 70 }} />
                  <col style={{ width: 130 }} />
                  <col style={{ width: 60 }} />
                  <col style={{ width: 60 }} />
                  <col style={{ width: 80 }} />
                </colgroup>
                <thead>
                  <tr style={{ background: '#F8FAFC' }}>
                    {['Asset ID', 'Désignation', 'Famille', 'Ouvrage', 'Qté', 'Valeur brute', 'SIG', 'Immo.', 'Amort.'].map(h => (
                      <th key={h} style={{ padding: '10px 12px', textAlign: 'left', fontSize: 10.5, fontWeight: 700, color: C.slate, textTransform: 'uppercase', letterSpacing: '0.05em', borderBottom: `1px solid ${C.border}`, whiteSpace: 'nowrap' }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {dossier.actifs.map((actif, i) => (
                    <tr key={actif.id} style={{ background: i % 2 === 0 ? '#FAFBFC' : C.card, borderBottom: `1px solid ${C.border}` }}>
                      <td style={{ padding: '10px 12px', fontFamily: 'monospace', fontSize: 10.5, color: C.slate, whiteSpace: 'nowrap' }}>{actif.assetId}</td>
                      <td style={{ padding: '10px 12px', color: C.navy, fontWeight: 600, wordBreak: 'break-word', lineHeight: 1.4 }}>{actif.designation}</td>
                      <td style={{ padding: '10px 12px', color: C.slate, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{actif.famille}</td>
                      <td style={{ padding: '10px 12px', color: C.slate, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{actif.ouvrage}</td>
                      <td style={{ padding: '10px 12px', textAlign: 'right', fontWeight: 700, color: C.navy, whiteSpace: 'nowrap' }}>
                        {actif.quantite.toLocaleString()} <span style={{ fontWeight: 400, color: C.slate, fontSize: 11 }}>{actif.unite}</span>
                      </td>
                      <td style={{ padding: '10px 12px', textAlign: 'right', fontWeight: 700, color: C.orange, whiteSpace: 'nowrap' }}>
                        {formatAmount(actif.valeurBrute)}
                      </td>
                      <td style={{ padding: '10px 12px', textAlign: 'center', whiteSpace: 'nowrap' }}>
                        {actif.hasSIG
                          ? <span style={{ fontSize: 11, fontWeight: 700, color: C.green }}>✓</span>
                          : <span style={{ fontSize: 11, fontWeight: 700, color: C.red }}>✗</span>
                        }
                      </td>
                      <td style={{ padding: '10px 12px', textAlign: 'center', whiteSpace: 'nowrap' }}>
                        {actif.hasImmo
                          ? <span style={{ fontSize: 11, fontWeight: 700, color: C.green }}>✓</span>
                          : <span style={{ fontSize: 11, fontWeight: 700, color: C.amber }}>En att.</span>
                        }
                      </td>
                      <td style={{ padding: '10px 12px', textAlign: 'center', whiteSpace: 'nowrap' }}>
                        <span style={{ fontSize: 11, color: C.slate }}>{actif.dureeAmortissement} ans</span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div style={{ padding: '14px 20px', borderTop: `1px solid ${C.border}`, display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12 }}>
              <div style={{ display: 'flex', gap: 20 }}>
                <span style={{ fontSize: 12.5, color: C.slate }}>Valeur totale : <strong style={{ color: C.orange }}>{formatAmount(dossier.valeurTotale)}</strong></span>
                <span style={{ fontSize: 12.5, color: C.slate }}>SIG : <strong style={{ color: C.green }}>{dossier.actifs.filter(a => a.hasSIG).length}/{dossier.actifs.length}</strong></span>
                <span style={{ fontSize: 12.5, color: C.slate }}>Immobilisés : <strong style={{ color: dossier.actifs.every(a => a.hasImmo) ? C.green : C.amber }}>{dossier.actifs.filter(a => a.hasImmo).length}/{dossier.actifs.length}</strong></span>
              </div>
              <div style={{ display: 'flex', gap: 8 }}>
                <button style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 14px', background: '#F1F5F9', color: C.navy, border: 'none', borderRadius: 8, fontSize: 12.5, fontWeight: 600, cursor: 'pointer' }}>
                  <Shield size={13} /> Générer PV
                </button>
                <button style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 14px', background: C.teal, color: '#fff', border: 'none', borderRadius: 8, fontSize: 12.5, fontWeight: 700, cursor: 'pointer' }}>
                  <Map size={13} /> Mettre à jour SIG
                </button>
                <button style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 14px', background: C.orange, color: '#fff', border: 'none', borderRadius: 8, fontSize: 12.5, fontWeight: 700, cursor: 'pointer' }}>
                  <Database size={13} /> Créer immobilisations
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

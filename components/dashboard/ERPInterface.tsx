'use client';
/**
 * ERPInterface.tsx — Connecteur bidirectionnel SIGEPP-DPE ↔ ERP
 * ─────────────────────────────────────────────────────────────────────────────
 * FLUX :
 *   IN  ← ERP  : données financières (engagements, décaissements, paiements)
 *   OUT → ERP  : immobilisations + plans d'amortissement SYSCOHADA
 *
 * ERP supportés (simulation) : SAP S/4HANA · Oracle ERP Cloud · Sage X3
 * Design SENELEC : violet #3D1A6B / orange #F47920
 */

import React, { useState, useMemo } from 'react';
import toast from 'react-hot-toast';
import {
  Repeat, RefreshCw, CheckCircle2, XCircle, AlertTriangle,
  ArrowDownToLine, ArrowUpFromLine, Building2, ChevronRight,
  Settings2, Activity, Clock, Shield, Zap, FileText,
  Plus, Trash2, Eye, EyeOff, Copy, Check,
} from 'lucide-react';
import { useImmoModule } from '@/lib/immobilisations/store';
import { planConsolide, vncActif } from '@/lib/immobilisations/amortissement';

// ── Tokens ───────────────────────────────────────────────────────────────────
const PURPLE = '#3D1A6B';
const ORANGE = '#F47920';
const INK    = '#0F172A';
const MUT    = '#64748B';
const cfa    = (n: number) => `${Math.round(n).toLocaleString('fr-FR')} FCFA`;
const num: React.CSSProperties = { fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap' };
const card: React.CSSProperties = { background: '#fff', border: '1px solid #E2E8F0', borderRadius: 14, padding: 20 };
const inp: React.CSSProperties = { width: '100%', padding: '9px 11px', borderRadius: 8, border: '1px solid #CBD5E1', fontSize: 13, color: INK };
const btnPrimary: React.CSSProperties = { display: 'inline-flex', alignItems: 'center', gap: 7, padding: '9px 18px', borderRadius: 9, background: PURPLE, color: '#fff', border: 'none', fontSize: 13, fontWeight: 700, cursor: 'pointer' };
const btnGhost: React.CSSProperties = { display: 'inline-flex', alignItems: 'center', gap: 5, padding: '7px 13px', borderRadius: 8, background: '#fff', border: '1px solid #CBD5E1', fontSize: 12.5, fontWeight: 600, color: '#475569', cursor: 'pointer' };
const iconBtn: React.CSSProperties = { display: 'inline-grid', placeItems: 'center', width: 32, height: 32, borderRadius: 7, background: '#F1F5F9', border: 'none', cursor: 'pointer', color: '#475569' };

// ── Types ─────────────────────────────────────────────────────────────────────
type ERPType = 'SAP' | 'Oracle' | 'Sage' | 'Custom';
type SyncStatus = 'idle' | 'running' | 'success' | 'error';
type TabId = 'connexions' | 'sync-in' | 'sync-out' | 'journal';

interface ERPConnector {
  id: string;
  name: string;
  type: ERPType;
  url: string;
  username: string;
  apiKey: string;
  active: boolean;
  lastSync?: string;
}

interface SyncLog {
  id: string;
  direction: 'in' | 'out';
  connector: string;
  entity: string;
  records: number;
  status: 'success' | 'error' | 'partial';
  message: string;
  at: string;
}

// ── Demo data ─────────────────────────────────────────────────────────────────
const DEMO_CONNECTORS: ERPConnector[] = [
  {
    id: 'sap-1',
    name: 'SAP S/4HANA DPE',
    type: 'SAP',
    url: 'https://sap.senelec.sn:443/sap/opu/odata/sap',
    username: 'SIGEPP_SVC',
    apiKey: 'sk-sap-dpe-••••••••••••••••',
    active: true,
    lastSync: '2026-06-09T08:32:00',
  },
  {
    id: 'oracle-1',
    name: 'Oracle ERP Cloud — Finance',
    type: 'Oracle',
    url: 'https://fa-senelec.oraclecloud.com/fscmRestApi/resources',
    username: 'api_sigepp@senelec.sn',
    apiKey: 'sk-oracle-fin-••••••••••••',
    active: false,
    lastSync: undefined,
  },
];

const DEMO_LOGS: SyncLog[] = [
  { id: 'l1', direction: 'in',  connector: 'SAP S/4HANA DPE',  entity: 'Engagements budgétaires',      records: 148, status: 'success', message: '148 lignes importées sans erreur.', at: '2026-06-09T08:32:15' },
  { id: 'l2', direction: 'in',  connector: 'SAP S/4HANA DPE',  entity: 'Décaissements (FI-AP)',         records: 62,  status: 'success', message: '62 paiements importés.',           at: '2026-06-09T08:32:28' },
  { id: 'l3', direction: 'out', connector: 'SAP S/4HANA DPE',  entity: 'Immobilisations (AM)',          records: 4,   status: 'success', message: '4 actifs transmis (AA01).',       at: '2026-06-08T16:11:05' },
  { id: 'l4', direction: 'out', connector: 'SAP S/4HANA DPE',  entity: 'Plans d\'amortissement (AA)',   records: 1,   status: 'success', message: '1 plan linéaire publié.',         at: '2026-06-08T16:11:22' },
  { id: 'l5', direction: 'in',  connector: 'Oracle ERP Cloud', entity: 'Factures fournisseurs',        records: 0,   status: 'error',   message: 'Connexion refusée : token expiré.', at: '2026-06-07T09:44:00' },
];

// Champs financiers importables depuis ERP
const ENTITES_IN = [
  { id: 'engagements',   label: 'Engagements budgétaires',    desc: 'Lignes d\'engagement IPSAS / OHADA',     icon: '📋' },
  { id: 'decaissements', label: 'Décaissements réels (FI-AP)', desc: 'Paiements fournisseurs déjà ordonnancés', icon: '💸' },
  { id: 'factures',      label: 'Factures fournisseurs',       desc: 'AP Invoice + statut (payé / en attente)',icon: '🧾' },
  { id: 'depenses',      label: 'Dépenses de fonctionnement',  desc: 'Charges FO hors investissement',          icon: '📊' },
  { id: 'trésorerie',    label: 'Flux de trésorerie',          desc: 'Cash-flow projet (décaissements nets)',   icon: '💰' },
];

// Champs exportables vers ERP
const ENTITES_OUT = [
  { id: 'immos',    label: 'Immobilisations (actifs)',       desc: 'Fiche actif, valeur brute, nature SYSCOHADA', icon: '🏗️' },
  { id: 'amort',    label: 'Plans d\'amortissement',         desc: 'Dotations annuelles, VNC, cumuls',            icon: '📉' },
  { id: 'pvs',      label: 'PV de réception / MES',          desc: 'Date MES, n° PV, commission signataire',      icon: '📝' },
  { id: 'doi',      label: 'Règles DOI (décomposition)',      desc: 'Classification ACTIF → composant → DOI',     icon: '🔑' },
];

function uid() { return `erp_${Date.now().toString(36)}`; }
function fmtDt(iso: string) {
  const d = new Date(iso);
  return `${d.toLocaleDateString('fr-FR')} ${d.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}`;
}

const ERP_LOGOS: Record<ERPType, { color: string; short: string }> = {
  SAP:    { color: '#0FAAFF', short: 'SAP' },
  Oracle: { color: '#C74634', short: 'ORC' },
  Sage:   { color: '#00B050', short: 'SGE' },
  Custom: { color: '#8B5CF6', short: 'API' },
};

// ── Composant principal ───────────────────────────────────────────────────────
export default function ERPInterface() {
  const [tab, setTab] = useState<TabId>('connexions');
  const [connectors, setConnectors] = useState<ERPConnector[]>(DEMO_CONNECTORS);
  const [logs, setLogs] = useState<SyncLog[]>(DEMO_LOGS);
  const [editId, setEditId] = useState<string | null>(null);
  const [showAdd, setShowAdd] = useState(false);

  const addLog = (log: Omit<SyncLog, 'id' | 'at'>) => {
    setLogs(prev => [{ ...log, id: uid(), at: new Date().toISOString() }, ...prev]);
  };

  const TABS: { id: TabId; label: string; icon: React.ComponentType<{ size?: number }> }[] = [
    { id: 'connexions', label: 'Connexions ERP', icon: Settings2 },
    { id: 'sync-in',    label: 'Import données financières ←',  icon: ArrowDownToLine },
    { id: 'sync-out',   label: 'Export immobilisations →',      icon: ArrowUpFromLine },
    { id: 'journal',    label: 'Journal de synchronisation',    icon: Activity },
  ];

  return (
    <div style={{ padding: 20, maxWidth: 1200, margin: '0 auto', width: '100%' }}>
      {/* En-tête */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 18 }}>
        <div style={{ width: 46, height: 46, borderRadius: 13, background: `${PURPLE}14`, display: 'grid', placeItems: 'center' }}>
          <Repeat size={24} color={PURPLE} />
        </div>
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 800, color: INK, margin: 0 }}>Interface ERP</h1>
          <p style={{ fontSize: 13, color: MUT, margin: '3px 0 0' }}>
            Synchronisation bidirectionnelle SIGEPP-DPE ↔ SAP · Oracle ERP · Sage X3
          </p>
        </div>
        <div style={{ marginLeft: 'auto', display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <StatusPill active={connectors.filter(c => c.active).length} total={connectors.length} />
        </div>
      </div>

      {/* KPI bar */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 12, marginBottom: 20 }}>
        <KpiCard label="Connecteurs actifs"  value={String(connectors.filter(c => c.active).length)} color={PURPLE} icon={<Shield size={16}/>} />
        <KpiCard label="Syncs réussies"      value={String(logs.filter(l => l.status === 'success').length)} color="#16A34A" icon={<CheckCircle2 size={16}/>} />
        <KpiCard label="Erreurs"             value={String(logs.filter(l => l.status === 'error').length)}   color="#DC2626" icon={<XCircle size={16}/>} />
        <KpiCard label="Enregistrements TX"  value={String(logs.reduce((s, l) => s + l.records, 0))} color={ORANGE} icon={<Zap size={16}/>} />
      </div>

      {/* Onglets */}
      <nav style={{ display: 'flex', gap: 5, flexWrap: 'wrap', borderBottom: '1px solid #E2E8F0', marginBottom: 20, paddingBottom: 2 }}>
        {TABS.map(t => {
          const active = t.id === tab;
          const Icon = t.icon;
          return (
            <button key={t.id} onClick={() => setTab(t.id)} style={{
              display: 'inline-flex', alignItems: 'center', gap: 7, padding: '9px 14px',
              borderRadius: '9px 9px 0 0', border: 'none', cursor: 'pointer', fontFamily: 'inherit',
              fontSize: 13, fontWeight: active ? 700 : 500,
              color: active ? PURPLE : MUT,
              background: active ? `${PURPLE}0D` : 'transparent',
              borderBottom: active ? `2.5px solid ${ORANGE}` : '2.5px solid transparent',
            }}>
              <Icon size={14} /> {t.label}
            </button>
          );
        })}
      </nav>

      {tab === 'connexions' && (
        <ConnexionsTab
          connectors={connectors} setConnectors={setConnectors}
          editId={editId} setEditId={setEditId}
          showAdd={showAdd} setShowAdd={setShowAdd}
        />
      )}
      {tab === 'sync-in' && <SyncInTab connectors={connectors} addLog={addLog} />}
      {tab === 'sync-out' && <SyncOutTab connectors={connectors} addLog={addLog} />}
      {tab === 'journal' && <JournalTab logs={logs} />}
    </div>
  );
}

// ── Onglet Connexions ─────────────────────────────────────────────────────────
function ConnexionsTab({ connectors, setConnectors, editId, setEditId, showAdd, setShowAdd }: {
  connectors: ERPConnector[];
  setConnectors: React.Dispatch<React.SetStateAction<ERPConnector[]>>;
  editId: string | null;
  setEditId: (id: string | null) => void;
  showAdd: boolean;
  setShowAdd: (v: boolean) => void;
}) {
  return (
    <>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14, flexWrap: 'wrap', gap: 8 }}>
        <p style={{ color: MUT, fontSize: 13, margin: 0 }}>
          Configurez les connecteurs ERP pour la synchronisation bidirectionnelle.
        </p>
        <button onClick={() => setShowAdd(true)} style={btnPrimary}>
          <Plus size={14} /> Ajouter un connecteur
        </button>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(340px, 1fr))', gap: 14 }}>
        {connectors.map(c => (
          <ConnectorCard
            key={c.id} connector={c}
            onEdit={() => setEditId(c.id)}
            onToggle={() => setConnectors(prev => prev.map(x => x.id === c.id ? { ...x, active: !x.active } : x))}
            onDelete={() => setConnectors(prev => prev.filter(x => x.id !== c.id))}
          />
        ))}
      </div>

      {(showAdd || editId) && (
        <ConnectorFormModal
          connector={editId ? connectors.find(c => c.id === editId) : undefined}
          onSave={(data) => {
            if (editId) {
              setConnectors(prev => prev.map(c => c.id === editId ? { ...c, ...data } : c));
              setEditId(null);
            } else {
              setConnectors(prev => [...prev, { ...data, id: uid(), active: false }]);
              setShowAdd(false);
            }
          }}
          onClose={() => { setEditId(null); setShowAdd(false); }}
        />
      )}

      <div style={{ ...card, marginTop: 20, background: `${PURPLE}05`, border: `1px solid ${PURPLE}22` }}>
        <div style={{ display: 'flex', gap: 10, alignItems: 'flex-start' }}>
          <Shield size={18} color={PURPLE} style={{ flexShrink: 0, marginTop: 2 }} />
          <div>
            <div style={{ fontSize: 13, fontWeight: 700, color: PURPLE, marginBottom: 4 }}>Sécurité & authentification</div>
            <div style={{ fontSize: 12.5, color: MUT, lineHeight: 1.7 }}>
              Les clés API sont masquées après saisie et stockées localement (non transmises). En production,
              connectez-vous via <b>OAuth 2.0 / SAML</b> pour SAP et Oracle. Sage X3 supporte REST API + token.
              Activez le <b>TLS 1.3</b> sur les URLs de connexion.
            </div>
          </div>
        </div>
      </div>
    </>
  );
}

function ConnectorCard({ connector: c, onEdit, onToggle, onDelete }: {
  connector: ERPConnector;
  onEdit: () => void; onToggle: () => void; onDelete: () => void;
}) {
  const logo = ERP_LOGOS[c.type];
  return (
    <div style={{ ...card, padding: 18 }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12, marginBottom: 14 }}>
        <div style={{ width: 42, height: 42, borderRadius: 10, background: `${logo.color}18`, display: 'grid', placeItems: 'center', flexShrink: 0, border: `1px solid ${logo.color}33` }}>
          <span style={{ fontSize: 11, fontWeight: 800, color: logo.color }}>{logo.short}</span>
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 14, fontWeight: 800, color: INK, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{c.name}</div>
          <div style={{ fontSize: 11, color: MUT, marginTop: 2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{c.url}</div>
        </div>
        <div style={{
          flexShrink: 0, fontSize: 11, fontWeight: 700, padding: '3px 9px', borderRadius: 6,
          background: c.active ? '#DCFCE7' : '#F1F5F9',
          color: c.active ? '#16A34A' : MUT,
        }}>{c.active ? '● Actif' : '○ Inactif'}</div>
      </div>

      <div style={{ fontSize: 12, color: MUT, marginBottom: 14 }}>
        <div><b>Utilisateur :</b> {c.username}</div>
        <div style={{ marginTop: 3 }}><b>Clé API :</b> {c.apiKey}</div>
        {c.lastSync && <div style={{ marginTop: 3 }}><b>Dernière sync :</b> {fmtDt(c.lastSync)}</div>}
      </div>

      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
        <button onClick={onToggle} style={{ ...btnGhost, fontSize: 12, ...(c.active ? {} : { borderColor: ORANGE, color: ORANGE }) }}>
          {c.active ? 'Désactiver' : 'Activer'}
        </button>
        <button onClick={onEdit} aria-label="Modifier le connecteur" style={{ ...iconBtn }}><Settings2 size={14} /></button>
        <button onClick={onDelete} aria-label="Supprimer le connecteur" style={{ ...iconBtn, color: '#DC2626' }}><Trash2 size={14} /></button>
        <button onClick={() => {
          toast(`Test ${c.name} : ${c.active ? 'connecté' : 'inactif'} — ${c.url}`);
        }} style={{ ...btnGhost, marginLeft: 'auto', fontSize: 12 }}>
          <RefreshCw size={12} /> Tester
        </button>
      </div>
    </div>
  );
}

function ConnectorFormModal({ connector, onSave, onClose }: {
  connector?: ERPConnector;
  onSave: (data: Omit<ERPConnector, 'id' | 'active'>) => void;
  onClose: () => void;
}) {
  const [f, setF] = useState({
    name: connector?.name ?? '',
    type: (connector?.type ?? 'SAP') as ERPType,
    url: connector?.url ?? '',
    username: connector?.username ?? '',
    apiKey: connector?.apiKey ?? '',
    lastSync: connector?.lastSync,
  });
  const [showKey, setShowKey] = useState(false);
  const [copied, setCopied] = useState(false);
  const valid = f.name.trim().length > 2 && f.url.trim().startsWith('http') && f.username.trim().length > 1;

  return (
    <div onClick={onClose} style={{ position: 'fixed', inset: 0, background: 'rgba(15,23,42,.5)', display: 'grid', placeItems: 'center', zIndex: 60, padding: 16 }}>
      <div onClick={e => e.stopPropagation()} style={{ ...card, maxWidth: 540, width: '100%', maxHeight: '88vh', overflowY: 'auto' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 18 }}>
          <h3 style={{ margin: 0, fontSize: 16, fontWeight: 800, color: INK, display: 'flex', alignItems: 'center', gap: 8 }}>
            <Repeat size={17} color={PURPLE} />
            {connector ? 'Modifier le connecteur' : 'Nouveau connecteur ERP'}
          </h3>
          <button onClick={onClose} style={iconBtn}><XCircle size={16} /></button>
        </div>

        <Fld label="Nom du connecteur"><input style={inp} value={f.name} onChange={e => setF({ ...f, name: e.target.value })} placeholder="ex : SAP S/4HANA DPE" /></Fld>
        <Fld label="Type ERP">
          <select style={inp} value={f.type} onChange={e => setF({ ...f, type: e.target.value as ERPType })}>
            <option value="SAP">SAP S/4HANA</option>
            <option value="Oracle">Oracle ERP Cloud</option>
            <option value="Sage">Sage X3</option>
            <option value="Custom">API personnalisée</option>
          </select>
        </Fld>
        <Fld label="URL de base (endpoint REST / OData)"><input style={inp} value={f.url} onChange={e => setF({ ...f, url: e.target.value })} placeholder="https://..." /></Fld>
        <Fld label="Utilisateur / client ID"><input style={inp} value={f.username} onChange={e => setF({ ...f, username: e.target.value })} /></Fld>
        <Fld label="Clé API / token">
          <div style={{ position: 'relative' }}>
            <input
              type={showKey ? 'text' : 'password'}
              style={{ ...inp, paddingRight: 72 }}
              value={f.apiKey}
              onChange={e => setF({ ...f, apiKey: e.target.value })}
              placeholder="sk-••••••••••••••••••"
            />
            <div style={{ position: 'absolute', right: 4, top: '50%', transform: 'translateY(-50%)', display: 'flex', gap: 2 }}>
              <button type="button" onClick={() => setShowKey(v => !v)} style={{ ...iconBtn, width: 28, height: 28 }}>
                {showKey ? <EyeOff size={13} /> : <Eye size={13} />}
              </button>
              <button type="button" onClick={() => { navigator.clipboard.writeText(f.apiKey); setCopied(true); setTimeout(() => setCopied(false), 1500); }} style={{ ...iconBtn, width: 28, height: 28 }}>
                {copied ? <Check size={13} color="#16A34A" /> : <Copy size={13} />}
              </button>
            </div>
          </div>
        </Fld>

        <div style={{ display: 'flex', gap: 8, marginTop: 18 }}>
          <button disabled={!valid} onClick={() => onSave(f)} style={{ ...btnPrimary, opacity: valid ? 1 : 0.5, cursor: valid ? 'pointer' : 'not-allowed' }}>
            <CheckCircle2 size={15} /> Enregistrer
          </button>
          <button onClick={onClose} style={btnGhost}>Annuler</button>
        </div>
      </div>
    </div>
  );
}

// ── Onglet Sync IN ─────────────────────────────────────────────────────────────
function SyncInTab({ connectors, addLog }: {
  connectors: ERPConnector[];
  addLog: (log: Omit<SyncLog, 'id' | 'at'>) => void;
}) {
  const [selectedConnector, setSelectedConnector] = useState<string>(connectors.find(c => c.active)?.id ?? '');
  const [selectedEntities, setSelectedEntities] = useState<string[]>([]);
  const [status, setStatus] = useState<SyncStatus>('idle');
  const [result, setResult] = useState<string>('');

  const activeConnectors = connectors.filter(c => c.active);
  const connector = connectors.find(c => c.id === selectedConnector);

  const toggleEntity = (id: string) => {
    setSelectedEntities(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);
  };

  const runSync = () => {
    if (!selectedConnector || !selectedEntities.length) return;
    setStatus('running');
    setResult('');

    setTimeout(() => {
      const results: string[] = [];
      selectedEntities.forEach(eid => {
        const entity = ENTITES_IN.find(e => e.id === eid)!;
        const records = Math.floor(Math.random() * 200) + 10;
        addLog({
          direction: 'in',
          connector: connector?.name ?? 'ERP',
          entity: entity.label,
          records,
          status: 'success',
          message: `${records} enregistrements importés dans SIGEPP-DPE.`,
        });
        results.push(`✅ ${entity.label} : ${records} lignes`);
      });
      setStatus('success');
      setResult(results.join('\n'));
    }, 2000);
  };

  return (
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 }}>
      <div>
        <div style={{ ...card, marginBottom: 14 }}>
          <SectionTitle icon={<ArrowDownToLine size={15} color={PURPLE} />} label="Source ERP" />
          {activeConnectors.length === 0 ? (
            <div style={{ color: '#DC2626', fontSize: 13 }}>Aucun connecteur actif. Activez-en un dans Connexions ERP.</div>
          ) : (
            <select style={{ ...inp, marginTop: 8 }} value={selectedConnector} onChange={e => setSelectedConnector(e.target.value)}>
              <option value="">— Choisir un connecteur —</option>
              {activeConnectors.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          )}
        </div>

        <div style={card}>
          <SectionTitle icon={<FileText size={15} color={PURPLE} />} label="Entités à importer" />
          <div style={{ marginTop: 10, display: 'flex', flexDirection: 'column', gap: 8 }}>
            {ENTITES_IN.map(e => (
              <label key={e.id} style={{ display: 'flex', alignItems: 'flex-start', gap: 10, cursor: 'pointer', padding: '8px 10px', borderRadius: 8, background: selectedEntities.includes(e.id) ? `${PURPLE}0A` : '#F8FAFC', border: `1px solid ${selectedEntities.includes(e.id) ? PURPLE + '44' : '#E2E8F0'}` }}>
                <input type="checkbox" checked={selectedEntities.includes(e.id)} onChange={() => toggleEntity(e.id)} style={{ marginTop: 2, accentColor: PURPLE, flexShrink: 0 }} />
                <div>
                  <div style={{ fontSize: 13, fontWeight: 700, color: INK }}>{e.icon} {e.label}</div>
                  <div style={{ fontSize: 11.5, color: MUT }}>{e.desc}</div>
                </div>
              </label>
            ))}
          </div>
        </div>
      </div>

      <div>
        <div style={card}>
          <SectionTitle icon={<Zap size={15} color={ORANGE} />} label="Lancer l'import" />
          <div style={{ marginTop: 12, fontSize: 12.5, color: MUT, lineHeight: 1.8 }}>
            <b>Données importées :</b><br />
            • Engagements → alimentent le module Budget & Décaissements<br />
            • Décaissements → actualisent l'avancement financier des projets<br />
            • Factures → mises en relation avec les marchés SIGEPP<br />
            • Trésorerie → Cash-flow projet en temps réel
          </div>

          <button
            disabled={!selectedConnector || !selectedEntities.length || status === 'running'}
            onClick={runSync}
            style={{ ...btnPrimary, marginTop: 16, width: '100%', justifyContent: 'center', opacity: (!selectedConnector || !selectedEntities.length || status === 'running') ? 0.5 : 1 }}>
            {status === 'running' ? <><RefreshCw size={14} style={{ animation: 'spin 1s linear infinite' }} /> Synchronisation…</> : <><ArrowDownToLine size={14} /> Importer depuis l&apos;ERP</>}
          </button>

          {status === 'success' && result && (
            <div style={{ marginTop: 14, background: '#F0FDF4', border: '1px solid #BBF7D0', borderRadius: 10, padding: '12px 16px' }}>
              <div style={{ fontSize: 12, fontWeight: 700, color: '#14532D', marginBottom: 6, display: 'flex', alignItems: 'center', gap: 5 }}>
                <CheckCircle2 size={14} /> Import réussi
              </div>
              <pre style={{ margin: 0, fontSize: 11.5, color: '#166534', fontFamily: 'monospace', whiteSpace: 'pre-wrap' }}>{result}</pre>
            </div>
          )}

          {status === 'error' && (
            <div style={{ marginTop: 14, background: '#FEF2F2', border: '1px solid #FECACA', borderRadius: 10, padding: '12px 16px' }}>
              <div style={{ fontSize: 12, fontWeight: 700, color: '#991B1B', display: 'flex', alignItems: 'center', gap: 5 }}>
                <XCircle size={14} /> Erreur de synchronisation
              </div>
            </div>
          )}
        </div>

        <div style={{ ...card, marginTop: 14, background: '#FFFBEB', border: '1px solid #FDE68A' }}>
          <div style={{ display: 'flex', gap: 8, alignItems: 'flex-start' }}>
            <AlertTriangle size={16} color="#D97706" style={{ flexShrink: 0, marginTop: 2 }} />
            <div style={{ fontSize: 12, color: '#92400E', lineHeight: 1.7 }}>
              <b>Mappage de champs :</b> Les données importées sont mappées automatiquement selon le référentiel SIGEPP.
              Vérifiez la correspondance codes projets ERP ↔ codes SIGEPP dans <b>Paramétrage → Mapping ERP</b>.
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Onglet Sync OUT ────────────────────────────────────────────────────────────
function SyncOutTab({ connectors, addLog }: {
  connectors: ERPConnector[];
  addLog: (log: Omit<SyncLog, 'id' | 'at'>) => void;
}) {
  const { actifs, pvs } = useImmoModule();
  const [selectedConnector, setSelectedConnector] = useState<string>(connectors.find(c => c.active)?.id ?? '');
  const [selectedEntities, setSelectedEntities] = useState<string[]>(['immos', 'amort']);
  const [status, setStatus] = useState<SyncStatus>('idle');
  const [result, setResult] = useState<string>('');

  const activeConnectors = connectors.filter(c => c.active);
  const connector = connectors.find(c => c.id === selectedConnector);
  const actifsPV = useMemo(() => actifs.filter(a => pvs.some(v => v.actifId === a.id)), [actifs, pvs]);

  const toggleEntity = (id: string) => {
    setSelectedEntities(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);
  };

  const runExport = () => {
    if (!selectedConnector || !selectedEntities.length) return;
    setStatus('running');
    setResult('');

    setTimeout(() => {
      const results: string[] = [];

      if (selectedEntities.includes('immos')) {
        results.push(`✅ Immobilisations : ${actifs.length} actifs transmis (transaction AA01)`);
        addLog({ direction: 'out', connector: connector?.name ?? 'ERP', entity: 'Immobilisations (actifs)', records: actifs.length, status: 'success', message: `${actifs.length} actifs transmis.` });
      }
      if (selectedEntities.includes('amort')) {
        results.push(`✅ Plans amortissement : ${actifsPV.length} plans SYSCOHADA envoyés`);
        addLog({ direction: 'out', connector: connector?.name ?? 'ERP', entity: "Plans d'amortissement", records: actifsPV.length, status: 'success', message: `${actifsPV.length} plans linéaires publiés.` });
      }
      if (selectedEntities.includes('pvs')) {
        results.push(`✅ PV de réception : ${pvs.length} PV transmis (date MES)`);
        addLog({ direction: 'out', connector: connector?.name ?? 'ERP', entity: 'PV de réception / MES', records: pvs.length, status: 'success', message: `${pvs.length} PV envoyés.` });
      }
      if (selectedEntities.includes('doi')) {
        results.push(`✅ Règles DOI : classification ACTIF → composant → DOI transmise`);
        addLog({ direction: 'out', connector: connector?.name ?? 'ERP', entity: 'Règles DOI (décomposition)', records: actifs.length, status: 'success', message: 'Règles DOI exportées.' });
      }

      setStatus('success');
      setResult(results.join('\n'));
    }, 2200);
  };

  return (
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 }}>
      <div>
        <div style={{ ...card, marginBottom: 14 }}>
          <SectionTitle icon={<ArrowUpFromLine size={15} color={PURPLE} />} label="Destination ERP" />
          {activeConnectors.length === 0 ? (
            <div style={{ color: '#DC2626', fontSize: 13 }}>Aucun connecteur actif.</div>
          ) : (
            <select style={{ ...inp, marginTop: 8 }} value={selectedConnector} onChange={e => setSelectedConnector(e.target.value)}>
              <option value="">— Choisir un connecteur —</option>
              {activeConnectors.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          )}
        </div>

        <div style={card}>
          <SectionTitle icon={<Building2 size={15} color={PURPLE} />} label="Données à exporter" />
          <div style={{ marginTop: 10, display: 'flex', flexDirection: 'column', gap: 8 }}>
            {ENTITES_OUT.map(e => (
              <label key={e.id} style={{ display: 'flex', alignItems: 'flex-start', gap: 10, cursor: 'pointer', padding: '8px 10px', borderRadius: 8, background: selectedEntities.includes(e.id) ? `${ORANGE}0A` : '#F8FAFC', border: `1px solid ${selectedEntities.includes(e.id) ? ORANGE + '44' : '#E2E8F0'}` }}>
                <input type="checkbox" checked={selectedEntities.includes(e.id)} onChange={() => toggleEntity(e.id)} style={{ marginTop: 2, accentColor: ORANGE, flexShrink: 0 }} />
                <div>
                  <div style={{ fontSize: 13, fontWeight: 700, color: INK }}>{e.icon} {e.label}</div>
                  <div style={{ fontSize: 11.5, color: MUT }}>{e.desc}</div>
                </div>
              </label>
            ))}
          </div>
        </div>
      </div>

      <div>
        {/* Aperçu des actifs à envoyer */}
        <div style={{ ...card, marginBottom: 14 }}>
          <SectionTitle icon={<Eye size={15} color={PURPLE} />} label={`Aperçu — ${actifs.length} actifs à transmettre`} />
          {actifs.length === 0 ? (
            <div style={{ color: MUT, fontSize: 13, marginTop: 8 }}>Aucun actif. Créez des actifs dans le module Immobilisations.</div>
          ) : (
            <div style={{ marginTop: 10, maxHeight: 220, overflowY: 'auto' }}>
              {actifs.map(a => {
                const pv = pvs.find(v => v.actifId === a.id);
                const vnc = pv ? vncActif(a, pv) : null;
                return (
                  <div key={a.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '7px 0', borderBottom: '1px solid #F1F5F9', fontSize: 12.5 }}>
                    <div style={{ width: 8, height: 8, borderRadius: '50%', background: pv ? '#16A34A' : '#94A3B8', flexShrink: 0 }} />
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontWeight: 700, color: INK, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{a.code}</div>
                      <div style={{ color: MUT, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontSize: 11 }}>{a.designation}</div>
                    </div>
                    <div style={{ textAlign: 'right', flexShrink: 0 }}>
                      <div style={{ ...num, color: ORANGE, fontWeight: 700, fontSize: 11.5 }}>{cfa(a.valeurTotale)}</div>
                      {vnc !== null && <div style={{ ...num, color: '#16A34A', fontSize: 11 }}>VNC {cfa(vnc)}</div>}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        <div style={card}>
          <SectionTitle icon={<Zap size={15} color={ORANGE} />} label="Lancer l'export" />
          <div style={{ marginTop: 10, fontSize: 12.5, color: MUT, lineHeight: 1.8 }}>
            <b>Données envoyées à l'ERP :</b><br />
            • Immobilisations → module <b>AM (Asset Management)</b> SAP<br />
            • Plans amortissement → dotations annuelles par exercice<br />
            • PV → date de mise en service (MES/DateStart)<br />
            • DOI → règles de décomposition SYSCOHADA
          </div>

          <button
            disabled={!selectedConnector || !selectedEntities.length || status === 'running'}
            onClick={runExport}
            style={{ ...btnPrimary, marginTop: 16, width: '100%', justifyContent: 'center', background: ORANGE, opacity: (!selectedConnector || !selectedEntities.length || status === 'running') ? 0.5 : 1 }}>
            {status === 'running' ? <><RefreshCw size={14} style={{ animation: 'spin 1s linear infinite' }} /> Export en cours…</> : <><ArrowUpFromLine size={14} /> Exporter vers l&apos;ERP</>}
          </button>

          {status === 'success' && result && (
            <div style={{ marginTop: 14, background: '#F0FDF4', border: '1px solid #BBF7D0', borderRadius: 10, padding: '12px 16px' }}>
              <div style={{ fontSize: 12, fontWeight: 700, color: '#14532D', marginBottom: 6, display: 'flex', alignItems: 'center', gap: 5 }}>
                <CheckCircle2 size={14} /> Export réussi
              </div>
              <pre style={{ margin: 0, fontSize: 11.5, color: '#166534', fontFamily: 'monospace', whiteSpace: 'pre-wrap' }}>{result}</pre>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ── Onglet Journal ─────────────────────────────────────────────────────────────
function JournalTab({ logs }: { logs: SyncLog[] }) {
  const [filter, setFilter] = useState<'all' | 'in' | 'out' | 'error'>('all');
  const filtered = useMemo(() => logs.filter(l => {
    if (filter === 'all') return true;
    if (filter === 'error') return l.status === 'error';
    return l.direction === filter;
  }), [logs, filter]);

  return (
    <>
      <div style={{ display: 'flex', gap: 6, marginBottom: 14, flexWrap: 'wrap' }}>
        {([['all', 'Tout'], ['in', '← Import'], ['out', '→ Export'], ['error', 'Erreurs']] as const).map(([id, label]) => (
          <button key={id} onClick={() => setFilter(id)} style={{
            padding: '6px 13px', borderRadius: 7, border: '1px solid #E2E8F0', cursor: 'pointer', fontFamily: 'inherit',
            fontSize: 12.5, fontWeight: 600,
            background: filter === id ? PURPLE : '#fff',
            color: filter === id ? '#fff' : MUT,
          }}>{label}</button>
        ))}
        <span style={{ fontSize: 12, color: MUT, marginLeft: 4, lineHeight: '32px' }}>{filtered.length} entrée{filtered.length > 1 ? 's' : ''}</span>
      </div>

      <div style={{ ...card, padding: 0 }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12.5 }}>
          <thead>
            <tr style={{ background: '#F8FAFC', color: '#475569' }}>
              <th style={{ padding: '10px 14px', textAlign: 'left', fontWeight: 700 }}>Date/heure</th>
              <th style={{ padding: '10px 14px', textAlign: 'left', fontWeight: 700 }}>Direction</th>
              <th style={{ padding: '10px 14px', textAlign: 'left', fontWeight: 700 }}>Connecteur</th>
              <th style={{ padding: '10px 14px', textAlign: 'left', fontWeight: 700 }}>Entité</th>
              <th style={{ padding: '10px 14px', textAlign: 'right', fontWeight: 700 }}>Enreg.</th>
              <th style={{ padding: '10px 14px', textAlign: 'left', fontWeight: 700 }}>Statut</th>
              <th style={{ padding: '10px 14px', textAlign: 'left', fontWeight: 700 }}>Message</th>
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 && (
              <tr><td colSpan={7} style={{ padding: 24, textAlign: 'center', color: '#94A3B8' }}>Aucune entrée de journal.</td></tr>
            )}
            {filtered.map(l => (
              <tr key={l.id} style={{ borderTop: '1px solid #F1F5F9' }}>
                <td style={{ padding: '9px 14px', ...num, color: MUT, whiteSpace: 'nowrap' }}>{fmtDt(l.at)}</td>
                <td style={{ padding: '9px 14px' }}>
                  <span style={{
                    display: 'inline-flex', alignItems: 'center', gap: 4,
                    fontSize: 11, fontWeight: 700, padding: '3px 8px', borderRadius: 5,
                    background: l.direction === 'in' ? '#EFF6FF' : '#FFF7ED',
                    color: l.direction === 'in' ? '#1D4ED8' : '#C2410C',
                  }}>
                    {l.direction === 'in' ? <ArrowDownToLine size={10} /> : <ArrowUpFromLine size={10} />}
                    {l.direction === 'in' ? 'Import' : 'Export'}
                  </span>
                </td>
                <td style={{ padding: '9px 14px', fontWeight: 600, color: INK }}>{l.connector}</td>
                <td style={{ padding: '9px 14px', color: INK }}>{l.entity}</td>
                <td style={{ padding: '9px 14px', textAlign: 'right', ...num, fontWeight: 700 }}>{l.records}</td>
                <td style={{ padding: '9px 14px' }}>
                  <span style={{
                    display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 11, fontWeight: 700, padding: '3px 8px', borderRadius: 5,
                    background: l.status === 'success' ? '#F0FDF4' : l.status === 'error' ? '#FEF2F2' : '#FFFBEB',
                    color: l.status === 'success' ? '#16A34A' : l.status === 'error' ? '#DC2626' : '#D97706',
                  }}>
                    {l.status === 'success' ? <CheckCircle2 size={10} /> : l.status === 'error' ? <XCircle size={10} /> : <AlertTriangle size={10} />}
                    {l.status === 'success' ? 'Succès' : l.status === 'error' ? 'Erreur' : 'Partiel'}
                  </span>
                </td>
                <td style={{ padding: '9px 14px', color: MUT, maxWidth: 280, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{l.message}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}

// ── Atomes UI ─────────────────────────────────────────────────────────────────
function KpiCard({ label, value, color, icon }: { label: string; value: string; color: string; icon?: React.ReactNode }) {
  return (
    <div style={{ background: '#fff', border: '1px solid #E2E8F0', borderRadius: 12, padding: '14px 16px' }}>
      <div style={{ fontSize: 11, color: MUT, fontWeight: 600, display: 'flex', alignItems: 'center', gap: 5 }}>{icon}{label}</div>
      <div style={{ fontSize: 22, fontWeight: 800, color, marginTop: 4, ...num }}>{value}</div>
    </div>
  );
}

function StatusPill({ active, total }: { active: number; total: number }) {
  return (
    <div style={{ display: 'inline-flex', alignItems: 'center', gap: 7, background: active > 0 ? '#F0FDF4' : '#FEF2F2', border: `1px solid ${active > 0 ? '#BBF7D0' : '#FECACA'}`, borderRadius: 8, padding: '6px 14px' }}>
      <div style={{ width: 8, height: 8, borderRadius: '50%', background: active > 0 ? '#16A34A' : '#DC2626', animation: active > 0 ? 'pulse 2s infinite' : 'none' }} />
      <span style={{ fontSize: 12.5, fontWeight: 700, color: active > 0 ? '#14532D' : '#991B1B' }}>
        {active}/{total} connecteur{total > 1 ? 's' : ''} actif{active > 1 ? 's' : ''}
      </span>
    </div>
  );
}

function SectionTitle({ icon, label }: { icon: React.ReactNode; label: string }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 7, fontSize: 13, fontWeight: 800, color: INK }}>
      {icon}{label}
    </div>
  );
}

function Fld({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label style={{ display: 'block', marginBottom: 12 }}>
      <span style={{ fontSize: 11, fontWeight: 600, color: MUT, display: 'block', marginBottom: 4 }}>{label}</span>
      {children}
    </label>
  );
}

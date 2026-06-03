/**
 * org-config/page.tsx — Administration de l'organigramme DPE
 * CRUD complet : Directions, Départements, Postes, Rôles, Agents
 * Import/Export JSON, reset par défaut
 */

'use client';

import { useState, useRef, useCallback } from 'react';
import {
  Save, Plus, Trash2, Edit3, Download, Upload, RotateCcw,
  ChevronDown, ChevronUp, Search, Building2, Users, Briefcase,
  Shield, Layers, AlertTriangle, CheckCircle, X,
} from 'lucide-react';
import { useOrgConfig, type OrgDirection, type OrgDepartement, type OrgPoste, type OrgRoleConfig, type OrgAgent } from '@/lib/orgConfigStore';

type Tab = 'directions' | 'departements' | 'postes' | 'roles' | 'agents';

const TABS: { id: Tab; label: string; icon: React.ElementType }[] = [
  { id: 'directions', label: 'Directions', icon: Building2 },
  { id: 'departements', label: 'Départements', icon: Layers },
  { id: 'postes', label: 'Postes', icon: Briefcase },
  { id: 'roles', label: 'Rôles SIGEPP', icon: Shield },
  { id: 'agents', label: 'Agents', icon: Users },
];

export default function OrgConfigPage() {
  const config = useOrgConfig();
  const [tab, setTab] = useState<Tab>('directions');
  const [search, setSearch] = useState('');
  const [editing, setEditing] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [importJson, setImportJson] = useState('');
  const [showImport, setShowImport] = useState(false);
  const [toast, setToast] = useState('');
  const fileRef = useRef<HTMLInputElement>(null);

  const showToast = useCallback((msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(''), 3000);
  }, []);

  // ─── Export ─────────────────────────────────────────────────────────────
  const handleExport = () => {
    const blob = new Blob([config.exportConfig()], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `sigepp-org-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
    showToast('Configuration exportée');
  };

  const handleImport = () => {
    try {
      config.importConfig(importJson);
      setShowImport(false);
      setImportJson('');
      showToast('Configuration importée avec succès');
    } catch {
      showToast('Erreur : JSON invalide');
    }
  };

  const handleFileUpload = (files: FileList | null) => {
    if (!files?.[0]) return;
    const reader = new FileReader();
    reader.onload = e => {
      try {
        const text = String(e.target?.result ?? '');
        config.importConfig(text);
        showToast('Configuration importée');
      } catch {
        showToast('Erreur : fichier JSON invalide');
      }
    };
    reader.readAsText(files[0]);
  };

  // ─── Render table content ───────────────────────────────────────────────
  const renderContent = () => {
    switch (tab) {
      case 'directions':
        return <DirectionsTable search={search} onEdit={setEditing} onShowForm={setShowForm} />;
      case 'departements':
        return <DepartementsTable search={search} onEdit={setEditing} onShowForm={setShowForm} />;
      case 'postes':
        return <PostesTable search={search} onEdit={setEditing} onShowForm={setShowForm} />;
      case 'roles':
        return <RolesTable search={search} onEdit={setEditing} onShowForm={setShowForm} />;
      case 'agents':
        return <AgentsTable search={search} onEdit={setEditing} onShowForm={setShowForm} />;
    }
  };

  return (
    <div className="page-content">
      {/* Header */}
      <div className="page-header" style={{ marginBottom: 16 }}>
        <div>
          <div className="page-title">Configuration organisationnelle</div>
          <div className="page-subtitle">
            Dernière modification : {new Date(config.lastModified).toLocaleString('fr-FR')}
          </div>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button className="btn btn-secondary btn-sm" onClick={() => setShowImport(true)}>
            <Upload size={14} /> Importer
          </button>
          <button className="btn btn-secondary btn-sm" onClick={handleExport}>
            <Download size={14} /> Exporter
          </button>
          <button className="btn btn-danger btn-sm" onClick={() => {
            if (confirm('Réinitialiser toute la configuration ?')) {
              config.resetToDefaults();
              showToast('Configuration réinitialisée');
            }
          }}>
            <RotateCcw size={14} /> Réinit.
          </button>
        </div>
      </div>

      {/* Tabs + Search */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16, gap: 12 }}>
        <div style={{ display: 'flex', gap: 4 }}>
          {TABS.map(t => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              style={{
                padding: '8px 14px', borderRadius: 8, border: 'none',
                background: tab === t.id ? 'var(--primary)' : 'transparent',
                color: tab === t.id ? '#fff' : 'var(--text-secondary)',
                fontSize: 12, fontWeight: 600, cursor: 'pointer',
                display: 'flex', alignItems: 'center', gap: 6,
              }}
            >
              <t.icon size={14} /> {t.label}
            </button>
          ))}
        </div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <div className="filter-search" style={{ width: 200 }}>
            <Search size={12} />
            <input
              placeholder="Rechercher…"
              value={search}
              onChange={e => setSearch(e.target.value)}
              style={{ fontSize: 12 }}
            />
          </div>
          <button className="btn btn-primary btn-sm" onClick={() => { setEditing(null); setShowForm(true); }}>
            <Plus size={14} /> Ajouter
          </button>
        </div>
      </div>

      {/* Content */}
      <div className="card">
        <div className="card-body" style={{ padding: 0 }}>
          {renderContent()}
        </div>
      </div>

      {/* Import modal */}
      {showImport && (
        <div style={{
          position: 'fixed', inset: 0, zIndex: 100,
          background: 'rgba(0,0,0,0.40)', display: 'flex',
          alignItems: 'center', justifyContent: 'center',
        }}>
          <div className="card" style={{ width: 520, maxHeight: '80vh', display: 'flex', flexDirection: 'column' }}>
            <div className="card-header">
              <span className="card-title">Importer une configuration</span>
              <button onClick={() => setShowImport(false)} style={{ background: 'none', border: 'none', cursor: 'pointer' }}>
                <X size={16} />
              </button>
            </div>
            <div className="card-body" style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <textarea
                className="form-textarea"
                style={{ minHeight: 180, fontFamily: 'monospace', fontSize: 11 }}
                placeholder="Collez le JSON ici…"
                value={importJson}
                onChange={e => setImportJson(e.target.value)}
              />
              <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                Ou sélectionnez un fichier JSON :
              </div>
              <input
                ref={fileRef}
                type="file"
                accept=".json"
                style={{ display: 'none' }}
                onChange={e => handleFileUpload(e.target.files)}
              />
              <button className="btn btn-secondary btn-sm" onClick={() => fileRef.current?.click()}>
                <Upload size={14} /> Choisir un fichier
              </button>
            </div>
            <div className="card-footer" style={{ justifyContent: 'flex-end' }}>
              <button className="btn btn-secondary" onClick={() => setShowImport(false)}>Annuler</button>
              <button className="btn btn-primary" onClick={handleImport}>Importer</button>
            </div>
          </div>
        </div>
      )}

      {/* Toast */}
      {toast && (
        <div style={{
          position: 'fixed', bottom: 20, right: 20, zIndex: 200,
          padding: '10px 16px', borderRadius: 8,
          background: 'var(--success)', color: '#fff',
          fontSize: 12, fontWeight: 600, boxShadow: '0 4px 12px rgba(0,0,0,0.20)',
        }}>
          {toast}
        </div>
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// DIRECTIONS
// ═══════════════════════════════════════════════════════════════════════════

function DirectionsTable({ search, onEdit, onShowForm }: { search: string; onEdit: (id: string) => void; onShowForm: (v: boolean) => void }) {
  const config = useOrgConfig();
  const [showInactive, setShowInactive] = useState(false);
  const filtered = config.directions.filter(d =>
    (showInactive || d.active) &&
    (d.label.toLowerCase().includes(search.toLowerCase()) || d.code.toLowerCase().includes(search.toLowerCase()))
  );

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'flex-end', padding: '8px 12px' }}>
        <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11, color: 'var(--text-muted)', cursor: 'pointer' }}>
          <input type="checkbox" checked={showInactive} onChange={e => setShowInactive(e.target.checked)} />
          Afficher inactifs
        </label>
      </div>
      <div className="table-responsive">
        <table className="tbl">
          <thead>
            <tr>
              <th>Code</th><th>Nom</th><th>Nom court</th><th>Effectif</th><th>Statut</th><th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map(d => (
              <tr key={d.code}>
                <td><code style={{ fontSize: 11 }}>{d.code}</code></td>
                <td>{d.label}</td>
                <td>{d.shortLabel}</td>
                <td>{d.effectif}</td>
                <td>
                  <span className={`badge ${d.active ? 'badge-success' : 'badge-neutral'}`}>
                    {d.active ? 'Actif' : 'Inactif'}
                  </span>
                </td>
                <td>
                  <div style={{ display: 'flex', gap: 4 }}>
                    <button className="btn btn-ghost btn-xs" onClick={() => onEdit(d.code)}><Edit3 size={12} /></button>
                    <button className="btn btn-danger btn-xs" onClick={() => config.removeDirection(d.code)}><Trash2 size={12} /></button>
                  </div>
                </td>
              </tr>
            ))}
            {filtered.length === 0 && <tr><td colSpan={6} className="tbl-empty">Aucune direction</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// DÉPARTEMENTS
// ═══════════════════════════════════════════════════════════════════════════

function DepartementsTable({ search, onEdit, onShowForm }: { search: string; onEdit: (id: string) => void; onShowForm: (v: boolean) => void }) {
  const config = useOrgConfig();
  const [showInactive, setShowInactive] = useState(false);
  const filtered = config.departements.filter(d =>
    (showInactive || d.active) &&
    (d.label.toLowerCase().includes(search.toLowerCase()) || d.code.toLowerCase().includes(search.toLowerCase()))
  );

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'flex-end', padding: '8px 12px' }}>
        <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11, color: 'var(--text-muted)', cursor: 'pointer' }}>
          <input type="checkbox" checked={showInactive} onChange={e => setShowInactive(e.target.checked)} />
          Afficher inactifs
        </label>
      </div>
      <div className="table-responsive">
        <table className="tbl">
          <thead>
            <tr><th>Code</th><th>Nom</th><th>Direction</th><th>Statut</th><th>Actions</th></tr>
          </thead>
          <tbody>
            {filtered.map(d => {
              const dir = config.directions.find(x => x.code === d.directionCode);
              return (
                <tr key={d.code}>
                  <td><code style={{ fontSize: 11 }}>{d.code}</code></td>
                  <td>{d.label}</td>
                  <td>{dir?.label ?? d.directionCode}</td>
                  <td>
                    <span className={`badge ${d.active ? 'badge-success' : 'badge-neutral'}`}>
                      {d.active ? 'Actif' : 'Inactif'}
                    </span>
                  </td>
                  <td>
                    <div style={{ display: 'flex', gap: 4 }}>
                      <button className="btn btn-ghost btn-xs" onClick={() => onEdit(d.code)}><Edit3 size={12} /></button>
                      <button className="btn btn-danger btn-xs" onClick={() => config.removeDepartement(d.code)}><Trash2 size={12} /></button>
                    </div>
                  </td>
                </tr>
              );
            })}
            {filtered.length === 0 && <tr><td colSpan={5} className="tbl-empty">Aucun département</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// POSTES
// ═══════════════════════════════════════════════════════════════════════════

function PostesTable({ search, onEdit, onShowForm }: { search: string; onEdit: (id: string) => void; onShowForm: (v: boolean) => void }) {
  const config = useOrgConfig();
  const [showInactive, setShowInactive] = useState(false);
  const filtered = config.postes.filter(p =>
    (showInactive || p.active) &&
    (p.label.toLowerCase().includes(search.toLowerCase()) || p.code.toLowerCase().includes(search.toLowerCase()) || p.keywords.some(k => k.includes(search.toLowerCase())))
  );

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'flex-end', padding: '8px 12px' }}>
        <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11, color: 'var(--text-muted)', cursor: 'pointer' }}>
          <input type="checkbox" checked={showInactive} onChange={e => setShowInactive(e.target.checked)} />
          Afficher inactifs
        </label>
      </div>
      <div className="table-responsive">
        <table className="tbl">
          <thead>
            <tr><th>Code</th><th>Intitulé</th><th>Rôle</th><th>Niveau</th><th>Mots-clés</th><th>Statut</th><th>Actions</th></tr>
          </thead>
          <tbody>
            {filtered.map(p => {
              const role = config.roles.find(r => r.code === p.roleCode);
              return (
                <tr key={p.code}>
                  <td><code style={{ fontSize: 11 }}>{p.code}</code></td>
                  <td>{p.label}</td>
                  <td><span className="badge badge-primary">{role?.label ?? p.roleCode}</span></td>
                  <td>{['DPE','Direction','Département','Agent'][p.niveau] ?? p.niveau}</td>
                  <td style={{ fontSize: 10 }}>{p.keywords.join(', ')}</td>
                  <td>
                    <span className={`badge ${p.active ? 'badge-success' : 'badge-neutral'}`}>
                      {p.active ? 'Actif' : 'Inactif'}
                    </span>
                  </td>
                  <td>
                    <div style={{ display: 'flex', gap: 4 }}>
                      <button className="btn btn-ghost btn-xs" onClick={() => onEdit(p.code)}><Edit3 size={12} /></button>
                      <button className="btn btn-danger btn-xs" onClick={() => config.removePoste(p.code)}><Trash2 size={12} /></button>
                    </div>
                  </td>
                </tr>
              );
            })}
            {filtered.length === 0 && <tr><td colSpan={7} className="tbl-empty">Aucun poste</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// RÔLES
// ═══════════════════════════════════════════════════════════════════════════

function RolesTable({ search, onEdit, onShowForm }: { search: string; onEdit: (id: string) => void; onShowForm: (v: boolean) => void }) {
  const config = useOrgConfig();
  const [showInactive, setShowInactive] = useState(false);
  const filtered = config.roles.filter(r =>
    (showInactive || r.active) &&
    (r.label.toLowerCase().includes(search.toLowerCase()) || r.code.toLowerCase().includes(search.toLowerCase()))
  );

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'flex-end', padding: '8px 12px' }}>
        <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11, color: 'var(--text-muted)', cursor: 'pointer' }}>
          <input type="checkbox" checked={showInactive} onChange={e => setShowInactive(e.target.checked)} />
          Afficher inactifs
        </label>
      </div>
      <div className="table-responsive">
        <table className="tbl">
          <thead>
            <tr><th>Code</th><th>Label</th><th>Description</th><th>Couleur</th><th>Sections</th><th>Statut</th><th>Actions</th></tr>
          </thead>
          <tbody>
            {filtered.map(r => (
              <tr key={r.code}>
                <td><code style={{ fontSize: 11 }}>{r.code}</code></td>
                <td>{r.label}</td>
                <td style={{ fontSize: 11 }}>{r.description}</td>
                <td>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <div style={{ width: 16, height: 16, borderRadius: 4, background: r.color, border: '1px solid var(--border)' }} />
                    <span style={{ fontSize: 10, fontFamily: 'monospace' }}>{r.color}</span>
                  </div>
                </td>
                <td style={{ fontSize: 10 }}>{r.sections.slice(0, 3).join(', ')}{r.sections.length > 3 ? '…' : ''}</td>
                <td>
                  <span className={`badge ${r.active ? 'badge-success' : 'badge-neutral'}`}>
                    {r.active ? 'Actif' : 'Inactif'}
                  </span>
                </td>
                <td>
                  <div style={{ display: 'flex', gap: 4 }}>
                    <button className="btn btn-ghost btn-xs" onClick={() => onEdit(r.code)}><Edit3 size={12} /></button>
                    <button className="btn btn-danger btn-xs" onClick={() => config.removeRole(r.code)}><Trash2 size={12} /></button>
                  </div>
                </td>
              </tr>
            ))}
            {filtered.length === 0 && <tr><td colSpan={7} className="tbl-empty">Aucun rôle</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// AGENTS
// ═══════════════════════════════════════════════════════════════════════════

function AgentsTable({ search, onEdit, onShowForm }: { search: string; onEdit: (id: string) => void; onShowForm: (v: boolean) => void }) {
  const config = useOrgConfig();
  const [showInactive, setShowInactive] = useState(false);
  const filtered = config.agents.filter(a =>
    (showInactive || a.active) &&
    (`${a.prenom} ${a.nom}`.toLowerCase().includes(search.toLowerCase()) ||
     a.matricule.toLowerCase().includes(search.toLowerCase()) ||
     a.poste.toLowerCase().includes(search.toLowerCase()))
  );

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'flex-end', padding: '8px 12px' }}>
        <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11, color: 'var(--text-muted)', cursor: 'pointer' }}>
          <input type="checkbox" checked={showInactive} onChange={e => setShowInactive(e.target.checked)} />
          Afficher inactifs
        </label>
      </div>
      <div className="table-responsive">
        <table className="tbl">
          <thead>
            <tr><th>Matricule</th><th>Nom</th><th>Poste</th><th>Direction</th><th>Rôle</th><th>Statut</th><th>Actions</th></tr>
          </thead>
          <tbody>
            {filtered.map(a => {
              const dir = config.directions.find(d => d.code === a.directionCode);
              const role = config.roles.find(r => r.code === a.roleCode);
              return (
                <tr key={a.id}>
                  <td><code style={{ fontSize: 11 }}>{a.matricule}</code></td>
                  <td style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <div style={{ width: 24, height: 24, borderRadius: 6, background: a.avatarColor, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 9, fontWeight: 700, color: '#fff' }}>
                      {a.initials}
                    </div>
                    {a.prenom} {a.nom}
                  </td>
                  <td>{a.poste}</td>
                  <td>{dir?.shortLabel ?? a.directionCode}</td>
                  <td><span className="badge badge-primary">{role?.label ?? a.roleCode}</span></td>
                  <td>
                    <span className={`badge ${a.active ? 'badge-success' : 'badge-neutral'}`}>
                      {a.active ? 'Actif' : 'Inactif'}
                    </span>
                  </td>
                  <td>
                    <div style={{ display: 'flex', gap: 4 }}>
                      <button className="btn btn-ghost btn-xs" onClick={() => onEdit(a.id)}><Edit3 size={12} /></button>
                      <button className="btn btn-danger btn-xs" onClick={() => config.removeAgent(a.id)}><Trash2 size={12} /></button>
                    </div>
                  </td>
                </tr>
              );
            })}
            {filtered.length === 0 && <tr><td colSpan={7} className="tbl-empty">Aucun agent — importez depuis le fichier personnel ou ajoutez manuellement</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  );
}

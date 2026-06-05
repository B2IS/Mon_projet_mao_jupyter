'use client';

import { useState, useRef, useCallback } from 'react';
import {
  FileText, File, Image, Download, Share2, Plus, Search, Upload,
  Folder, FolderOpen, ChevronRight, Grid, List, X, CheckCircle,
  Eye, RotateCcw, History, Check, AlertTriangle, Clock,
  ThumbsUp, ThumbsDown, GitBranch, Archive, RefreshCw, Lock, Unlock, Edit2, Save,
} from 'lucide-react';
import { logAudit, type AuditType } from '@/lib/auditStore';
import DocumentAnnotator, { type AnnotatedDoc } from '@/components/ui/DocumentAnnotator';
import { useParapheurStore, type ParapheurDossier } from '@/lib/parapheurStore';
import { useAuth } from '@/lib/authStore';
import toast from 'react-hot-toast';

/** Journalise une action GED dans le journal d'audit (CCF ADM-03 · GED-03). */
function gedAudit(action: string, objet: string, detail?: string, type: AuditType = 'document'): void {
  try {
    const u = JSON.parse(localStorage.getItem('sigepp_dpe_user') || 'null');
    logAudit({ utilisateur: u ? `${u.prenom} ${u.nom}` : 'Système', email: u?.email, role: u?.role,
      action, objet, type, detail, direction: u?.direction });
  } catch { /* noop */ }
}

/* ═══════════════════════════════════════════════════════════════════════
   TYPES & MOCK DATA
═══════════════════════════════════════════════════════════════════════ */
type TypeDoc = 'PDF' | 'Word' | 'Excel' | 'Image' | 'SHP';
type StatutValidation = 'Publié' | 'En révision' | 'Soumis' | 'En attente';

interface Document {
  id: string;
  nom: string;
  type: TypeDoc;
  taille: string;
  auteur: string;
  date: string;
  version: string;
  projet: string;
  categorie: string;
  sousCat: string;
  statut: StatutValidation;
  tags: string[];
  /** URL (objet blob) du fichier réellement téléversé — permet la visualisation. */
  fileUrl?: string;
  /** Extension réelle du fichier téléversé (pdf, png, docx…). */
  fileExt?: string;
}

/* Déduit le TypeDoc + (catégorie, sous-catégorie) à partir du nom de fichier / type choisi. */
function typeDocFromExt(ext: string): TypeDoc {
  const e = ext.toLowerCase();
  if (e === 'pdf') return 'PDF';
  if (['doc', 'docx', 'odt', 'rtf'].includes(e)) return 'Word';
  if (['xls', 'xlsx', 'csv'].includes(e)) return 'Excel';
  if (['png', 'jpg', 'jpeg', 'gif', 'bmp', 'svg', 'webp'].includes(e)) return 'Image';
  if (['zip', 'shp', 'kml', 'kmz', 'geojson', 'dwg', 'dxf'].includes(e)) return 'SHP';
  return 'PDF';
}
const TYPE_TO_CAT: Record<string, { categorie: string; sousCat: string }> = {
  APD: { categorie: 'Études', sousCat: 'APD' },
  APS: { categorie: 'Études', sousCat: 'APS' },
  Marché: { categorie: 'Marchés', sousCat: 'Marchés' },
  Avenant: { categorie: 'Marchés', sousCat: 'Avenants' },
  Facture: { categorie: 'Finance', sousCat: 'Factures' },
  Rapport: { categorie: 'Rapports', sousCat: 'Mensuels' },
  Plan: { categorie: 'Cartographie', sousCat: 'Plans' },
  Shapefile: { categorie: 'Cartographie', sousCat: 'Shapefiles' },
};

const DOCUMENTS: Document[] = [
  { id: 'd1',  nom: 'APD-PUDC-Phase3-Electrification.pdf',       type: 'PDF',   taille: '8.4 Mo',  auteur: 'BEI Consult',        date: '20/05/2026', version: 'v3.1', projet: 'PUDC Phase III',  categorie: 'Études',          sousCat: 'APD',             statut: 'Publié',     tags: ['APD','HTA','rural'] },
  { id: 'd2',  nom: 'Marche-Travaux-Lot2-SAER.docx',             type: 'Word',  taille: '1.2 Mo',  auteur: 'Juriste DPE',        date: '18/05/2026', version: 'v1.0', projet: 'PUDC Phase II',   categorie: 'Marchés',         sousCat: 'Marchés',         statut: 'Publié',     tags: ['marché','travaux'] },
  { id: 'd3',  nom: 'FMR-Q1-2026-AFD-PERAL.xlsx',                type: 'Excel', taille: '345 Ko',  auteur: 'RAF DPE',            date: '15/05/2026', version: 'v2.0', projet: 'PERAL St-Louis',  categorie: 'Finance',         sousCat: 'Rapports FMR',    statut: 'En révision',tags: ['FMR','AFD','finance'] },
  { id: 'd4',  nom: 'Rapport-Mensuel-Avancement-Mai26.pdf',      type: 'PDF',   taille: '2.1 Mo',  auteur: 'CP PUDC',            date: '24/05/2026', version: 'v1.0', projet: 'PUDC Phase III',  categorie: 'Rapports',        sousCat: 'Mensuels',        statut: 'Soumis',     tags: ['rapport','mensuel'] },
  { id: 'd5',  nom: 'Plan-Reseau-BT-Kolda-Zone3.jpg',            type: 'Image', taille: '4.7 Mo',  auteur: 'Topographe SENELEC', date: '10/05/2026', version: 'v1.2', projet: 'PUDC Phase III',  categorie: 'Cartographie',    sousCat: 'Plans',           statut: 'Publié',     tags: ['plan','BT','Kolda'] },
  { id: 'd6',  nom: 'DAO-Fourniture-Transformateurs-HTA.pdf',    type: 'PDF',   taille: '5.6 Mo',  auteur: 'DAF SENELEC',        date: '05/05/2026', version: 'v4.0', projet: 'PERACOD II',      categorie: 'Marchés',         sousCat: 'DAO',             statut: 'Publié',     tags: ['DAO','HTA','transformateur'] },
  { id: 'd7',  nom: 'Avenant-1-GTSEN-HTA-Tambacounda.docx',       type: 'Word',  taille: '890 Ko',  auteur: 'Juriste DPE',        date: '03/05/2026', version: 'v1.0', projet: 'PUDC Phase II',   categorie: 'Marchés',         sousCat: 'Avenants',        statut: 'En attente', tags: ['avenant','HTA'] },
  { id: 'd8',  nom: 'PV-Reception-Provisoire-Lot1.pdf',          type: 'PDF',   taille: '1.5 Mo',  auteur: 'Comité Réception',   date: '01/05/2026', version: 'v1.0', projet: 'PERAL St-Louis',  categorie: 'Marchés',         sousCat: 'PV réception',    statut: 'Publié',     tags: ['PV','réception'] },
  { id: 'd9',  nom: 'Shapefile-Reseau-HTA-Dakar.zip',             type: 'SHP',   taille: '12.3 Mo', auteur: 'GIS SENELEC',        date: '28/04/2026', version: 'v2.3', projet: 'PUDC Phase III',  categorie: 'Cartographie',    sousCat: 'Shapefiles',      statut: 'Publié',     tags: ['SIG','HTA','Dakar'] },
  { id: 'd10', nom: 'ANO-BM-031-Transmission.pdf',               type: 'PDF',   taille: '220 Ko',  auteur: 'UAGL Aïssatou',      date: '10/05/2026', version: 'v1.0', projet: 'PUDC Phase III',  categorie: 'Correspondances', sousCat: 'ANOs',            statut: 'Publié',     tags: ['ANO','Banque Mondiale'] },
  { id: 'd11', nom: 'Facture-GTSEN-Situation7.xlsx',              type: 'Excel', taille: '156 Ko',  auteur: 'RAF DPE',            date: '22/05/2026', version: 'v1.0', projet: 'PUDC Phase II',   categorie: 'Finance',         sousCat: 'Factures',        statut: 'En attente', tags: ['facture','GTSEN'] },
  { id: 'd12', nom: 'Note-Technique-Equipements-HTA.docx',       type: 'Word',  taille: '670 Ko',  auteur: 'Ingénieur DPE',      date: '17/05/2026', version: 'v1.1', projet: 'PERACOD II',      categorie: 'Études',          sousCat: 'Études spéciales', statut: 'Soumis',    tags: ['note','HTA','technique'] },
];

interface Version {
  v: string;
  date: string;
  auteur: string;
  note: string;
  taille: string;
}

const VERSIONS_MAP: Record<string, Version[]> = {
  d1: [
    { v: 'v3.1', date: '20/05/2026', auteur: 'BEI Consult', note: 'Corrections suite révision AFD', taille: '8.4 Mo' },
    { v: 'v3.0', date: '10/04/2026', auteur: 'BEI Consult', note: 'Mise à jour tracé HTA Zone Nord', taille: '8.1 Mo' },
    { v: 'v2.0', date: '15/02/2026', auteur: 'BEI Consult', note: 'Intégration commentaires DER', taille: '7.8 Mo' },
    { v: 'v1.0', date: '01/12/2025', auteur: 'Bureau Études', note: 'Première version APD', taille: '6.2 Mo' },
  ],
  d4: [
    { v: 'v1.0', date: '24/05/2026', auteur: 'CP PUDC', note: 'Rapport mensuel initial', taille: '2.1 Mo' },
  ],
  d3: [
    { v: 'v2.0', date: '15/05/2026', auteur: 'RAF DPE', note: 'Intégration avances DPE', taille: '345 Ko' },
    { v: 'v1.0', date: '01/04/2026', auteur: 'RAF DPE', note: 'Rapport FMR initial Q1', taille: '290 Ko' },
  ],
};

type WFStatut = 'En attente' | 'Soumis' | 'En révision' | 'Approuvé' | 'Publié' | 'Rejeté';

const WF_STEPS: WFStatut[] = ['En attente', 'Soumis', 'En révision', 'Approuvé', 'Publié'];

interface TreeNode {
  label: string;
  icon: string;
  children: { label: string; count: number; sousCat: string }[];
  cat: string;
}

const TREE: TreeNode[] = [
  { label: 'Études', icon: '📐', cat: 'Études', children: [
    { label: 'APS', count: 3, sousCat: 'APS' },
    { label: 'APD', count: 5, sousCat: 'APD' },
    { label: 'Études spéciales', count: 4, sousCat: 'Études spéciales' },
  ]},
  { label: 'Marchés & Contrats', icon: '📋', cat: 'Marchés', children: [
    { label: 'DAO', count: 6, sousCat: 'DAO' },
    { label: 'Marchés', count: 12, sousCat: 'Marchés' },
    { label: 'Avenants', count: 4, sousCat: 'Avenants' },
    { label: 'PV réception', count: 8, sousCat: 'PV réception' },
  ]},
  { label: 'Finance', icon: '💰', cat: 'Finance', children: [
    { label: 'Factures', count: 18, sousCat: 'Factures' },
    { label: 'Décaissements', count: 9, sousCat: 'Décaissements' },
    { label: 'Rapports FMR', count: 7, sousCat: 'Rapports FMR' },
  ]},
  { label: 'Rapports', icon: '📊', cat: 'Rapports', children: [
    { label: 'Mensuels', count: 24, sousCat: 'Mensuels' },
    { label: 'Trimestriels', count: 8, sousCat: 'Trimestriels' },
    { label: 'Annuels', count: 3, sousCat: 'Annuels' },
  ]},
  { label: 'Correspondances', icon: '✉️', cat: 'Correspondances', children: [
    { label: 'Courriers IN', count: 47, sousCat: 'Courriers IN' },
    { label: 'Courriers OUT', count: 38, sousCat: 'Courriers OUT' },
    { label: 'ANOs', count: 15, sousCat: 'ANOs' },
  ]},
  { label: 'Cartographie', icon: '🗺️', cat: 'Cartographie', children: [
    { label: 'Shapefiles', count: 6, sousCat: 'Shapefiles' },
    { label: 'Plans', count: 22, sousCat: 'Plans' },
    { label: 'As-built', count: 11, sousCat: 'As-built' },
  ]},
];

/* ═══════════════════════════════════════════════════════════════════════
   HELPERS
═══════════════════════════════════════════════════════════════════════ */
function DocIcon({ type }: { type: TypeDoc }) {
  if (type === 'PDF')   return <div style={{ width: 32, height: 32, borderRadius: 6, background: 'rgba(226,35,26,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><FileText size={16} style={{ color: 'var(--red)' }} /></div>;
  if (type === 'Word')  return <div style={{ width: 32, height: 32, borderRadius: 6, background: 'rgba(37,99,235,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><File size={16} style={{ color: 'var(--blue)' }} /></div>;
  if (type === 'Excel') return <div style={{ width: 32, height: 32, borderRadius: 6, background: 'rgba(22,163,74,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><File size={16} style={{ color: 'var(--green)' }} /></div>;
  if (type === 'Image') return <div style={{ width: 32, height: 32, borderRadius: 6, background: 'rgba(245,158,11,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><Image size={16} style={{ color: 'var(--amber)' }} /></div>;
  return <div style={{ width: 32, height: 32, borderRadius: 6, background: 'rgba(14,52,96,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><Folder size={16} style={{ color: 'var(--navy)' }} /></div>;
}

function pillStatut(s: StatutValidation) {
  if (s === 'Publié')      return <span className="pill pill-ok">{s}</span>;
  if (s === 'En révision') return <span className="pill pill-warn">{s}</span>;
  if (s === 'Soumis')      return <span className="pill pill-info">{s}</span>;
  return <span className="pill pill-navy">{s}</span>;
}

/* ═══════════════════════════════════════════════════════════════════════
   UPLOAD MODAL
═══════════════════════════════════════════════════════════════════════ */
function formatTaille(bytes: number): string {
  if (bytes >= 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} Mo`;
  if (bytes >= 1024) return `${(bytes / 1024).toFixed(0)} Ko`;
  return `${bytes} o`;
}

function UploadModal({ onClose, onAdd }: { onClose: () => void; onAdd: (doc: Document) => void }) {
  const [titre, setTitre] = useState('');
  const [type, setType] = useState('');
  const [projet, setProjet] = useState('');
  const [tags, setTags] = useState('');
  const [valReq, setValReq] = useState(false);
  const [dragging, setDragging] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const fichier = file?.name ?? null;

  const handleAdd = () => {
    if (!file) return;
    const ext = (file.name.split('.').pop() || '').toLowerCase();
    const td = typeDocFromExt(ext);
    const cat = TYPE_TO_CAT[type] ?? { categorie: 'Études', sousCat: 'Études spéciales' };
    const nom = titre.trim()
      ? (titre.trim().includes('.') ? titre.trim() : `${titre.trim()}.${ext}`)
      : file.name;
    const build = (fileUrl: string): Document => ({
      id: `doc_${Date.now().toString(36)}`,
      nom,
      type: td,
      taille: formatTaille(file.size),
      auteur: 'Moi',
      date: new Date().toLocaleDateString('fr-FR'),
      version: 'v1.0',
      projet: projet || '—',
      categorie: cat.categorie,
      sousCat: cat.sousCat,
      statut: valReq ? 'Soumis' : 'Publié',
      tags: tags.split(',').map(t => t.trim()).filter(Boolean),
      fileUrl,
      fileExt: ext,
    });
    // Lecture en DATA URL (base64) : l'aperçu/annotation s'affiche de façon fiable et
    // SURVIT au rechargement (un blob URL meurt à la fermeture de la page → doc invisible).
    const reader = new FileReader();
    reader.onload = () => { onAdd(build(typeof reader.result === 'string' ? reader.result : URL.createObjectURL(file))); onClose(); };
    reader.onerror = () => { onAdd(build(URL.createObjectURL(file))); onClose(); };
    reader.readAsDataURL(file);
  };

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 300, background: 'rgba(0,0,0,0.55)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
      <div style={{ width: '100%', maxWidth: 560, background: 'var(--bg-card)', borderRadius: 14, overflow: 'hidden', boxShadow: 'var(--shadow-lg)' }}>
        <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--border-2)', background: 'var(--navy)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div style={{ color: '#fff', fontWeight: 700, fontSize: 14 }}>Ajouter un document</div>
          <button className="btn btn-ghost btn-xs" style={{ color: '#fff', borderColor: 'rgba(255,255,255,0.3)' }} onClick={onClose}><X size={13} /></button>
        </div>
        <div style={{ padding: 20, display: 'flex', flexDirection: 'column', gap: 14 }}>
          {/* Drop zone */}
          <div
            onDragOver={e => { e.preventDefault(); setDragging(true); }}
            onDragLeave={() => setDragging(false)}
            onDrop={e => { e.preventDefault(); setDragging(false); const f = e.dataTransfer.files[0]; if (f) setFile(f); }}
            onClick={() => inputRef.current?.click()}
            style={{ border: `2px dashed ${dragging ? 'var(--orange)' : 'var(--border-2)'}`, borderRadius: 10, padding: '28px 20px', textAlign: 'center', cursor: 'pointer', background: dragging ? 'rgba(243,146,0,0.05)' : 'var(--bg)', transition: 'all 0.15s' }}
          >
            <input ref={inputRef} type="file" style={{ display: 'none' }} onChange={e => { if (e.target.files?.[0]) setFile(e.target.files[0]); }} />
            <Upload size={24} style={{ color: dragging ? 'var(--orange)' : 'var(--muted)', margin: '0 auto 8px', display: 'block' }} />
            {fichier
              ? <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--navy)' }}>📄 {fichier}</div>
              : <>
                  <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)' }}>Glissez-déposez ou cliquez</div>
                  <div style={{ fontSize: 11, color: 'var(--muted)', marginTop: 3 }}>PDF, Word, Excel, Image, SHP — max 50 Mo</div>
                </>
            }
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <div className="form-group">
              <label className="form-label">Titre du document *</label>
              <input className="form-input" value={titre} onChange={e => setTitre(e.target.value)} placeholder="Nom descriptif..." />
            </div>
            <div className="form-group">
              <label className="form-label">Type</label>
              <select className="form-input" value={type} onChange={e => setType(e.target.value)}>
                <option value="">— Sélectionner —</option>
                <option>APD</option><option>APS</option><option>Marché</option><option>Avenant</option>
                <option>Facture</option><option>Rapport</option><option>Plan</option><option>Shapefile</option>
              </select>
            </div>
            <div className="form-group">
              <label className="form-label">Projet associé</label>
              <select className="form-input" value={projet} onChange={e => setProjet(e.target.value)}>
                <option value="">— Aucun —</option>
                <option>PUDC Phase III</option><option>PERAL Saint-Louis</option>
                <option>PERACOD II</option><option>Electrif. Casamance</option>
              </select>
            </div>
            <div className="form-group">
              <label className="form-label">Tags (virgule séparés)</label>
              <input className="form-input" value={tags} onChange={e => setTags(e.target.value)} placeholder="ex: APD, HTA, rural" />
            </div>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <input type="checkbox" id="valreq" checked={valReq} onChange={e => setValReq(e.target.checked)} />
            <label htmlFor="valreq" style={{ fontSize: 12, color: 'var(--text)', cursor: 'pointer' }}>Soumettre à validation avant publication</label>
          </div>
        </div>
        <div style={{ padding: '12px 20px', borderTop: '1px solid var(--border-2)', display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
          <button className="btn btn-ghost btn-sm" onClick={onClose}>Annuler</button>
          <button className="btn btn-primary btn-sm" disabled={!file} style={{ opacity: file ? 1 : 0.5, cursor: file ? 'pointer' : 'not-allowed' }} onClick={handleAdd}><Upload size={12} /> Ajouter document</button>
        </div>
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════════
   MODALE — MODIFIER UN DOCUMENT (métadonnées + remplacement de fichier)
═══════════════════════════════════════════════════════════════════════ */
function EditDocModal({ doc, onClose, onSave }: { doc: Document; onClose: () => void; onSave: (d: Document) => void }) {
  const [form, setForm] = useState<Document>({ ...doc });
  const fileRef = useRef<HTMLInputElement | null>(null);
  const TYPES: TypeDoc[] = ['PDF', 'Word', 'Excel', 'Image', 'SHP'];
  const STATUTS: StatutValidation[] = ['En attente', 'Soumis', 'En révision', 'Publié'];

  const replaceFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0]; if (!f) return;
    const ext = (f.name.split('.').pop() ?? '').toLowerCase();
    const type: TypeDoc = ['png','jpg','jpeg','gif','webp','bmp','svg'].includes(ext) ? 'Image'
      : ext === 'pdf' ? 'PDF' : ['doc','docx'].includes(ext) ? 'Word' : ['xls','xlsx','csv'].includes(ext) ? 'Excel' : ['shp','kml','geojson'].includes(ext) ? 'SHP' : form.type;
    const sizeKb = f.size / 1024; const taille = sizeKb > 1024 ? `${(sizeKb/1024).toFixed(1)} Mo` : `${Math.round(sizeKb)} Ko`;
    const reader = new FileReader();
    reader.onload = () => {
      const url = typeof reader.result === 'string' ? reader.result : URL.createObjectURL(f);
      const [maj, min] = (form.version.replace(/^v/i, '').split('.').map(Number));
      const nextVer = `v${maj || 1}.${(min ?? 0) + 1}`;
      setForm(prev => ({ ...prev, nom: f.name, type, taille, fileUrl: url, fileExt: ext, version: nextVer }));
    };
    reader.readAsDataURL(f);
    e.target.value = '';
  };

  const inp: React.CSSProperties = { width: '100%', padding: '8px 10px', borderRadius: 7, border: '1px solid #E2E8F0', fontSize: 13, fontFamily: 'inherit', boxSizing: 'border-box', marginBottom: 10 };
  const lbl: React.CSSProperties = { fontSize: 10.5, fontWeight: 700, color: '#64748B', textTransform: 'uppercase', display: 'block', marginBottom: 4 };

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 340, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }} onClick={onClose}>
      <div style={{ width: '100%', maxWidth: 480, background: '#fff', borderRadius: 14, overflow: 'hidden', boxShadow: '0 24px 64px rgba(0,0,0,0.3)', maxHeight: '88vh', display: 'flex', flexDirection: 'column' }} onClick={e => e.stopPropagation()}>
        <div style={{ padding: '14px 18px', background: 'var(--navy)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span style={{ color: '#fff', fontWeight: 700, fontSize: 14 }}><Edit2 size={13} style={{ verticalAlign: 'middle', marginRight: 6 }} />Modifier le document</span>
          <button onClick={onClose} className="btn btn-ghost btn-xs" style={{ color: '#fff', borderColor: 'rgba(255,255,255,0.3)' }}><X size={12} /></button>
        </div>
        <div style={{ padding: 18, overflowY: 'auto' }}>
          <label style={lbl}>Nom du document</label>
          <input style={inp} value={form.nom} onChange={e => setForm({ ...form, nom: e.target.value })} />
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
            <div><label style={lbl}>Type</label>
              <select style={inp} value={form.type} onChange={e => setForm({ ...form, type: e.target.value as TypeDoc })}>{TYPES.map(t => <option key={t} value={t}>{t}</option>)}</select></div>
            <div><label style={lbl}>Statut</label>
              <select style={inp} value={form.statut} onChange={e => setForm({ ...form, statut: e.target.value as StatutValidation })}>{STATUTS.map(s => <option key={s} value={s}>{s}</option>)}</select></div>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
            <div><label style={lbl}>Catégorie</label><input style={inp} value={form.categorie} onChange={e => setForm({ ...form, categorie: e.target.value })} /></div>
            <div><label style={lbl}>Sous-catégorie</label><input style={inp} value={form.sousCat} onChange={e => setForm({ ...form, sousCat: e.target.value })} /></div>
          </div>
          <label style={lbl}>Projet</label>
          <input style={inp} value={form.projet} onChange={e => setForm({ ...form, projet: e.target.value })} />
          <label style={lbl}>Tags (séparés par des virgules)</label>
          <input style={inp} value={form.tags.join(', ')} onChange={e => setForm({ ...form, tags: e.target.value.split(',').map(t => t.trim()).filter(Boolean) })} />

          <input ref={fileRef} type="file" style={{ display: 'none' }} onChange={replaceFile}
            accept=".pdf,.doc,.docx,.xls,.xlsx,.csv,.png,.jpg,.jpeg,.gif,.webp,.bmp,.svg,.shp,.kml,.geojson,.txt,.ppt,.pptx,.dwg" />
          <button onClick={() => fileRef.current?.click()} style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, padding: '9px', borderRadius: 7, border: '1.5px dashed var(--navy)', background: 'rgba(27,79,138,0.05)', color: 'var(--navy)', fontSize: 12.5, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' }}>
            <RefreshCw size={13} /> Remplacer le fichier {form.fileExt ? `(actuel : ${form.fileExt}, ${form.version})` : ''}
          </button>
        </div>
        <div style={{ padding: '12px 18px', borderTop: '1px solid #E2E8F0', display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
          <button className="btn btn-ghost btn-sm" onClick={onClose}>Annuler</button>
          <button className="btn btn-primary btn-sm" disabled={!form.nom.trim()} onClick={() => onSave(form)}><Save size={12} /> Enregistrer</button>
        </div>
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════════
   COMPOSANT PRINCIPAL
═══════════════════════════════════════════════════════════════════════ */
export default function GED() {
  const { user } = useAuth();
  const addDossier = useParapheurStore(s => s.addDossier);
  const [docs, setDocs] = useState<Document[]>(DOCUMENTS);
  const [versions, setVersions] = useState<Record<string, Version[]>>(VERSIONS_MAP);
  const [search, setSearch] = useState('');
  const [tri, setTri] = useState<'date' | 'nom' | 'taille'>('date');
  const [vue, setVue] = useState<'grille' | 'liste'>('liste');
  const [catActive, setCatActive] = useState<string | null>(null);
  const [sousCatActive, setSousCatActive] = useState<string | null>(null);
  const [expanded, setExpanded] = useState<string[]>(['Études']);
  const [showUpload, setShowUpload] = useState(false);
  const [viewerDoc, setViewerDoc] = useState<string | null>(null);
  const [annotDoc, setAnnotDoc] = useState<AnnotatedDoc | null>(null);
  /** Ouvre un document (chargé ou de référence) dans l'annotateur (surligner, commenter…). */
  const annoter = useCallback((d: Document) => {
    const ext = (d.fileExt || (d.type === 'PDF' ? 'pdf' : d.type === 'Image' ? 'png' : d.type === 'Excel' ? 'xlsx' : d.type === 'Word' ? 'docx' : 'pdf')).toLowerCase();
    setAnnotDoc({ nom: d.nom, ext, taille: d.taille, url: d.fileUrl });
    gedAudit('Ouverture annotation document', d.nom);
  }, []);
  const [editDoc, setEditDoc] = useState<Document | null>(null);

  /** Enregistre les modifications de métadonnées d'un document (modifiable). */
  const saveEditDoc = (updated: Document) => {
    setDocs(prev => prev.map(d => d.id === updated.id ? { ...updated, date: new Date().toLocaleDateString('fr-FR') } : d));
    gedAudit('Modification de document (GED)', updated.nom, `type ${updated.type} · statut ${updated.statut}`);
    setEditDoc(null);
  };
  const [showVersions, setShowVersions] = useState<string | null>(null);
  const [showWorkflow, setShowWorkflow] = useState<string | null>(null);
  const [wfComment, setWfComment] = useState('');
  const [newVerForm, setNewVerForm] = useState({ note: '', taille: '' });
  const [showNewVer, setShowNewVer] = useState(false);

  /* Lance un workflow de validation RÉEL sur un document chargé : crée un
     dossier dans le parapheur (BPM) — visible dans le module Workflows. */
  const launchToParapheur = useCallback((d: Document) => {
    const now = new Date();
    const dossier: ParapheurDossier = {
      id: `ged-${d.id}-${now.getTime()}`,
      type: 'document',
      reference: `GED-${d.id.toUpperCase()}`,
      titre: d.nom,
      projet: d.projet,
      projetCode: d.projet,
      soumetteur: user ? `${user.prenom} ${user.nom}` : 'Utilisateur',
      dateCreation: now.toISOString(),
      dateLimite: new Date(now.getTime() + 5 * 864e5).toISOString(),
      priorite: 'normale',
      statut: 'en_attente',
      etapeActuelle: 'Révision',
      nombreEtapes: 4,
      etapeIndex: 1,
      contexte: `Document « ${d.nom} » (${d.type}, ${d.version}) soumis depuis la GED pour circuit de validation.`,
      piecesJointes: [{ nom: d.nom, taille: d.taille, ext: (d.fileExt as 'pdf') || 'pdf' }],
      historique: [{ etape: 'Soumission', acteur: user ? `${user.prenom} ${user.nom}` : 'Utilisateur', date: now.toISOString(), commentaire: 'Soumission au parapheur depuis la GED' }],
      slaHeures: 120,
      heuresRestantes: 120,
      source: `GED · ${d.nom}`,
    };
    addDossier(dossier);
    gedAudit('Lancement workflow parapheur', d.nom, `Dossier ${dossier.reference} créé`);
    toast.success(`Workflow lancé : « ${d.nom} » est dans le parapheur (BPM).`, { duration: 4000 });
  }, [user, addDossier]);

  /* Workflow helpers */
  const advanceDoc = useCallback((id: string) => {
    setDocs(prev => prev.map(d => {
      if (d.id !== id) return d;
      const idx = WF_STEPS.indexOf(d.statut as WFStatut);
      const next = WF_STEPS[Math.min(idx + 1, WF_STEPS.length - 1)];
      gedAudit('Changement de statut document', d.nom, `${d.statut} → ${next}`);
      return { ...d, statut: next as StatutValidation };
    }));
    setWfComment('');
    setShowWorkflow(null);
  }, []);

  const rejectDoc = useCallback((id: string) => {
    setDocs(prev => prev.map(d => d.id === id ? { ...d, statut: 'En attente' as StatutValidation } : d));
    setWfComment('');
    setShowWorkflow(null);
  }, []);

  const addVersion = useCallback((docId: string) => {
    const doc = docs.find(d => d.id === docId);
    if (!doc || !newVerForm.note.trim()) return;
    const existingVers = versions[docId] ?? [];
    const lastMajor = existingVers.length > 0 ? parseFloat(existingVers[0].v.slice(1)) : 0;
    const newV = `v${(lastMajor + 1).toFixed(1)}`;
    const newVer: Version = {
      v: newV, date: new Date().toLocaleDateString('fr-FR'), auteur: 'Moi',
      note: newVerForm.note, taille: newVerForm.taille || doc.taille,
    };
    setVersions(prev => ({ ...prev, [docId]: [newVer, ...(prev[docId] ?? [])] }));
    setDocs(prev => prev.map(d => d.id === docId ? { ...d, version: newV, statut: 'Soumis' as StatutValidation } : d));
    setNewVerForm({ note: '', taille: '' });
    setShowNewVer(false);
  }, [docs, versions, newVerForm]);

  /* Filtrage */
  const filtered = docs.filter(d => {
    if (catActive && d.categorie !== catActive) return false;
    if (sousCatActive && d.sousCat !== sousCatActive) return false;
    if (search) {
      const s = search.toLowerCase();
      return d.nom.toLowerCase().includes(s) || d.projet.toLowerCase().includes(s) || d.tags.some(t => t.toLowerCase().includes(s));
    }
    return true;
  }).sort((a, b) => {
    if (tri === 'nom') return a.nom.localeCompare(b.nom);
    if (tri === 'taille') return parseFloat(a.taille) - parseFloat(b.taille);
    return b.date.localeCompare(a.date);
  });

  const enAttenteValidation = docs.filter(d => d.statut === 'En attente' || d.statut === 'Soumis');

  return (
    <div className="page-content">
      {/* ── KPIs ── */}
      <div className="kpi-grid">
        <div className="kpi-card navy">
          <div className="kpi-label">Documents totaux</div>
          <div className="kpi-value">{docs.length + 1235}</div>
          <div className="kpi-sub">Toutes catégories</div>
        </div>
        <div className="kpi-card">
          <div className="kpi-label">Ajoutés ce mois</div>
          <div className="kpi-value orange">{docs.filter(d => d.date.includes('05/2026')).length + 40}</div>
          <div className="kpi-sub">+12% vs mois précédent</div>
        </div>
        <div className="kpi-card amber">
          <div className="kpi-label">En attente validation</div>
          <div className="kpi-value" style={{ color: 'var(--amber)' }}>{enAttenteValidation.length}</div>
          <div className="kpi-sub">Workflow en cours</div>
        </div>
        <div className="kpi-card red">
          <div className="kpi-label">Expirant dans 30j</div>
          <div className="kpi-value red">8</div>
          <div className="kpi-sub">Renouvellement requis</div>
        </div>
      </div>

      {/* ── Corps principal ── */}
      <div style={{ display: 'flex', gap: 14, flex: 1, minHeight: 0 }}>
        {/* Arborescence */}
        <div className="card" style={{ width: 220, flexShrink: 0, overflowY: 'auto' }}>
          <div className="card-header">
            <span className="card-title">Bibliothèque</span>
          </div>
          <div style={{ padding: '8px 0' }}>
            <div
              onClick={() => { setCatActive(null); setSousCatActive(null); }}
              style={{ padding: '7px 14px', cursor: 'pointer', fontSize: 12, fontWeight: catActive === null ? 700 : 400, color: catActive === null ? 'var(--navy)' : 'var(--text)', background: catActive === null ? 'var(--navy-light)' : 'transparent', display: 'flex', alignItems: 'center', gap: 6 }}
            >
              <FolderOpen size={13} style={{ color: 'var(--orange)' }} /> Tous les documents
            </div>
            {TREE.map(node => {
              const isExpanded = expanded.includes(node.label);
              const isActive = catActive === node.cat && !sousCatActive;
              return (
                <div key={node.label}>
                  <div
                    onClick={() => {
                      setExpanded(prev => isExpanded ? prev.filter(x => x !== node.label) : [...prev, node.label]);
                      setCatActive(node.cat);
                      setSousCatActive(null);
                    }}
                    style={{ padding: '7px 14px', cursor: 'pointer', fontSize: 12, fontWeight: isActive ? 700 : 500, color: isActive ? 'var(--navy)' : 'var(--text)', background: isActive ? 'var(--navy-light)' : 'transparent', display: 'flex', alignItems: 'center', gap: 6 }}
                  >
                    <span style={{ fontSize: 13 }}>{node.icon}</span>
                    <span style={{ flex: 1 }}>{node.label}</span>
                    <ChevronRight size={11} style={{ color: 'var(--muted)', transform: isExpanded ? 'rotate(90deg)' : 'none', transition: 'transform 0.15s' }} />
                  </div>
                  {isExpanded && node.children.map(ch => {
                    const isSubActive = sousCatActive === ch.sousCat;
                    return (
                      <div key={ch.sousCat}
                        onClick={() => { setCatActive(node.cat); setSousCatActive(ch.sousCat); }}
                        style={{ padding: '5px 14px 5px 32px', cursor: 'pointer', fontSize: 11, color: isSubActive ? 'var(--navy)' : 'var(--muted)', fontWeight: isSubActive ? 700 : 400, background: isSubActive ? 'var(--navy-light)' : 'transparent', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}
                      >
                        <span>• {ch.label}</span>
                        <span style={{ fontSize: 10, background: 'var(--border-2)', borderRadius: 99, padding: '0 5px' }}>{ch.count}</span>
                      </div>
                    );
                  })}
                </div>
              );
            })}
          </div>
        </div>

        {/* Panneau principal */}
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 12, minWidth: 0 }}>
          {/* Barre outils */}
          <div className="card">
            <div className="card-body" style={{ padding: '10px 14px' }}>
              <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
                <div style={{ position: 'relative', flex: 1, minWidth: 200 }}>
                  <Search size={12} style={{ position: 'absolute', left: 9, top: '50%', transform: 'translateY(-50%)', color: 'var(--muted)' }} />
                  <input className="form-input" style={{ paddingLeft: 28, width: '100%' }} placeholder="Recherche plein texte — nom, projet, tag..." value={search} onChange={e => setSearch(e.target.value)} />
                </div>
                <select className="form-input" style={{ width: 'auto' }} value={tri} onChange={e => setTri(e.target.value as 'date' | 'nom' | 'taille')}>
                  <option value="date">Trier par date</option>
                  <option value="nom">Trier par nom</option>
                  <option value="taille">Trier par taille</option>
                </select>
                <div style={{ display: 'flex', borderRadius: 6, overflow: 'hidden', border: '1px solid var(--border-2)' }}>
                  <button onClick={() => setVue('liste')} style={{ padding: '5px 10px', background: vue === 'liste' ? 'var(--navy)' : 'transparent', color: vue === 'liste' ? '#fff' : 'var(--muted)', border: 'none', cursor: 'pointer' }}><List size={13} /></button>
                  <button onClick={() => setVue('grille')} style={{ padding: '5px 10px', background: vue === 'grille' ? 'var(--navy)' : 'transparent', color: vue === 'grille' ? '#fff' : 'var(--muted)', border: 'none', cursor: 'pointer' }}><Grid size={13} /></button>
                </div>
                <button className="btn btn-primary btn-sm" onClick={() => setShowUpload(true)}>📤 Ajouter document</button>
              </div>
            </div>
          </div>

          {/* Documents en attente validation */}
          {enAttenteValidation.length > 0 && (
            <div className="card">
              <div className="card-header">
                <span className="card-title">En attente de validation ({enAttenteValidation.length})</span>
                <span style={{ fontSize: 10, color: 'var(--amber)' }}>Workflow requis</span>
              </div>
              <div style={{ padding: '8px 16px', display: 'flex', flexDirection: 'column', gap: 6 }}>
                {enAttenteValidation.map(d => (
                  <div key={d.id} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '8px 10px', background: 'var(--bg)', borderRadius: 8, border: '1px solid var(--border-2)' }}>
                    <DocIcon type={d.type} />
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 12, fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{d.nom}</div>
                      <div style={{ fontSize: 10, color: 'var(--muted)' }}>{d.projet} · {d.auteur} · {d.date}</div>
                    </div>
                    {pillStatut(d.statut)}
                    {/* Workflow steps */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 10, color: 'var(--muted)' }}>
                      {(['Soumis','Réviser','Approuver','Publier'] as const).map((step, i) => (
                        <span key={step} style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                          <span style={{ padding: '2px 7px', borderRadius: 4, background: i === 0 ? 'var(--navy)' : 'var(--border-2)', color: i === 0 ? '#fff' : 'var(--muted)', fontSize: 9, fontWeight: 600 }}>{step}</span>
                          {i < 3 && <ChevronRight size={9} style={{ color: 'var(--border-2)' }} />}
                        </span>
                      ))}
                    </div>
                    <div style={{ display: 'flex', gap: 4 }}>
                      <button className="btn btn-ghost btn-xs" onClick={() => setShowWorkflow(d.id)}><Eye size={10} /> Workflow</button>
                      <button className="btn btn-xs" style={{ background: 'rgba(27,79,138,0.1)', color: 'var(--navy)', border: '1px solid rgba(27,79,138,0.3)' }} onClick={() => launchToParapheur(d)} title="Envoyer ce document dans le parapheur (BPM)"><GitBranch size={10} /> Parapheur</button>
                      <button className="btn btn-xs" style={{ background: 'rgba(22,163,74,0.1)', color: 'var(--green)', border: '1px solid rgba(22,163,74,0.3)' }} onClick={() => advanceDoc(d.id)}><CheckCircle size={10} /> Approuver</button>
                      <button className="btn btn-xs" style={{ background: 'rgba(239,51,64,0.1)', color: 'var(--red)', border: '1px solid rgba(239,51,64,0.3)' }} onClick={() => rejectDoc(d.id)}><ThumbsDown size={10} /> Rejeter</button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Grille / Liste documents */}
          <div className="card" style={{ flex: 1 }}>
            <div className="card-header">
              <span className="card-title">
                {catActive ? (sousCatActive || catActive) : 'Tous les documents'} ({filtered.length})
              </span>
              <span style={{ fontSize: 10, color: 'var(--muted)' }}>Vue : {vue}</span>
            </div>

            {vue === 'liste' ? (
              <div style={{ overflowX: 'auto' }}>
                <table className="tbl">
                  <thead>
                    <tr>
                      <th>Document</th>
                      <th>Projet</th>
                      <th>Auteur</th>
                      <th>Date</th>
                      <th>Taille</th>
                      <th>Version</th>
                      <th>Statut</th>
                      <th>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filtered.map(d => (
                      <tr key={d.id}>
                        <td>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                            <DocIcon type={d.type} />
                            <div>
                              <div style={{ fontSize: 12, fontWeight: 600, maxWidth: 220, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{d.nom}</div>
                              <div style={{ display: 'flex', gap: 4, marginTop: 2, flexWrap: 'wrap' }}>
                                {d.tags.slice(0, 3).map(t => <span key={t} style={{ fontSize: 9, padding: '1px 5px', background: 'var(--navy-light)', color: 'var(--navy)', borderRadius: 3, fontWeight: 600 }}>{t}</span>)}
                              </div>
                            </div>
                          </div>
                        </td>
                        <td style={{ fontSize: 11 }}>{d.projet}</td>
                        <td style={{ fontSize: 11 }}>{d.auteur}</td>
                        <td style={{ fontSize: 11, whiteSpace: 'nowrap' }}>{d.date}</td>
                        <td style={{ fontSize: 11 }}>{d.taille}</td>
                        <td><span className="pill pill-navy">{d.version}</span></td>
                        <td>{pillStatut(d.statut)}</td>
                        <td>
                          <div style={{ display: 'flex', gap: 3 }}>
                            <button className="btn btn-ghost btn-xs" title="Visualiser" onClick={() => setViewerDoc(d.id)}><Eye size={10} /></button>
                            <button className="btn btn-ghost btn-xs" title="Annoter / commenter" onClick={() => annoter(d)}><Edit2 size={10} style={{ color: 'var(--orange)' }} /></button>
                            <button className="btn btn-ghost btn-xs" title="Modifier" onClick={() => setEditDoc(d)}><Edit2 size={10} /></button>
                            <button className="btn btn-ghost btn-xs" title="Télécharger" onClick={() => {
                              const a = document.createElement('a');
                              if (d.fileUrl) { a.href = d.fileUrl; a.download = d.nom; }
                              else {
                                a.href = 'data:text/plain;charset=utf-8,' + encodeURIComponent(`Document : ${d.nom}\nVersion : ${d.version}\nAuteur : ${d.auteur}\nDate : ${d.date}\nStatut : ${d.statut}\n\n(Document SENELEC — SIGEPP-DPE)`);
                                a.download = d.nom.replace(/\s+/g, '_') + '.txt';
                              }
                              a.click();
                            }}><Download size={10} /></button>
                            <button className="btn btn-ghost btn-xs" title="Partager" onClick={() => {
                              const link = `${window.location.origin}/ged?doc=${d.id}`;
                              navigator.clipboard?.writeText(link).catch(() => undefined);
                              alert(`Lien du document copié :\n${link}`);
                            }}><Share2 size={10} /></button>
                            <button className="btn btn-ghost btn-xs" title="Workflow validation" onClick={() => setShowWorkflow(d.id)}><GitBranch size={10} /></button>
                            <button className="btn btn-ghost btn-xs" title="Historique versions" onClick={() => setShowVersions(showVersions === d.id ? null : d.id)}><History size={10} /></button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="card-body">
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: 12 }}>
                  {filtered.map(d => (
                    <div key={d.id} style={{ border: '1px solid var(--border-2)', borderRadius: 10, padding: 14, background: 'var(--bg)', display: 'flex', flexDirection: 'column', gap: 10 }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                        <DocIcon type={d.type} />
                        {pillStatut(d.statut)}
                      </div>
                      <div>
                        <div style={{ fontSize: 12, fontWeight: 700, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', color: 'var(--text)' }} title={d.nom}>{d.nom}</div>
                        <div style={{ fontSize: 10, color: 'var(--muted)', marginTop: 2 }}>{d.projet}</div>
                      </div>
                      <div style={{ fontSize: 10, color: 'var(--muted)', display: 'flex', justifyContent: 'space-between' }}>
                        <span>{d.date}</span>
                        <span>{d.taille}</span>
                      </div>
                      <div style={{ display: 'flex', gap: 4 }}>
                        <button className="btn btn-ghost btn-xs" style={{ flex: 1 }} onClick={() => setViewerDoc(d.id)}><Eye size={10} /> Voir</button>
                        <button className="btn btn-ghost btn-xs" style={{ flex: 1 }} title="Annoter / commenter" onClick={() => annoter(d)}><Edit2 size={10} style={{ color: 'var(--orange)' }} /> Annoter</button>
                        <button className="btn btn-ghost btn-xs" title="Modifier les métadonnées" onClick={() => setEditDoc(d)}><Edit2 size={10} /></button>
                        <button className="btn btn-ghost btn-xs" style={{ flex: 1 }} onClick={() => {
                          const a = document.createElement('a');
                          if (d.fileUrl) { a.href = d.fileUrl; a.download = d.nom; }
                          else { a.href = 'data:text/plain;charset=utf-8,' + encodeURIComponent(`Document : ${d.nom}\nVersion : ${d.version}\nAuteur : ${d.auteur}\nDate : ${d.date}\nStatut : ${d.statut}\n\n(Document SENELEC — SIGEPP-DPE)`); a.download = d.nom.replace(/\s+/g, '_') + '.txt'; }
                          a.click();
                        }}><Download size={10} /> DL</button>
                        <button className="btn btn-ghost btn-xs" title="Historique versions" onClick={() => setShowVersions(showVersions === d.id ? null : d.id)}><History size={10} /></button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Panel historique versions */}
      {showVersions && (() => {
        const doc = docs.find(d => d.id === showVersions);
        if (!doc) return null;
        const verList = versions[showVersions] ?? [{ v: doc.version, date: doc.date, auteur: doc.auteur, note: 'Version courante', taille: doc.taille }];
        return (
          <div style={{ position: 'fixed', inset: 0, zIndex: 300, background: 'rgba(0,0,0,0.45)', display: 'flex', alignItems: 'center', justifyContent: 'center' }} onClick={() => { setShowVersions(null); setShowNewVer(false); }}>
            <div style={{ width: '100%', maxWidth: 520, background: 'var(--bg-card)', borderRadius: 14, overflow: 'hidden', boxShadow: 'var(--shadow-lg)', maxHeight: '85vh', display: 'flex', flexDirection: 'column' }} onClick={e => e.stopPropagation()}>
              <div style={{ padding: '14px 18px', background: 'var(--navy)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexShrink: 0 }}>
                <div>
                  <div style={{ color: '#fff', fontWeight: 700, fontSize: 13 }}>📋 Historique des versions</div>
                  <div style={{ color: 'rgba(255,255,255,0.6)', fontSize: 10, marginTop: 2 }}>{doc.nom}</div>
                </div>
                <button onClick={() => setShowVersions(null)} className="btn btn-ghost btn-xs" style={{ color: '#fff', borderColor: 'rgba(255,255,255,0.3)' }}><X size={12} /></button>
              </div>
              <div style={{ flex: 1, overflowY: 'auto', padding: '14px 18px', display: 'flex', flexDirection: 'column', gap: 10 }}>
                {verList.map((v, i) => (
                  <div key={v.v} style={{ display: 'flex', gap: 12, alignItems: 'flex-start', padding: '10px 12px', background: i === 0 ? 'var(--navy-light)' : 'var(--bg)', borderRadius: 8, border: `1px solid ${i === 0 ? 'rgba(27,79,138,0.3)' : 'var(--border-2)'}` }}>
                    <div style={{ width: 28, height: 28, borderRadius: 6, background: i === 0 ? 'var(--navy)' : 'var(--border-2)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                      <span style={{ fontSize: 9, fontWeight: 800, color: i === 0 ? '#fff' : 'var(--muted)' }}>{v.v}</span>
                    </div>
                    <div style={{ flex: 1 }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                        <span style={{ fontWeight: 700, color: 'var(--navy)', fontSize: 12 }}>{v.v} {i === 0 && <span style={{ fontSize: 9, background: 'var(--navy)', color: '#fff', padding: '1px 5px', borderRadius: 3, marginLeft: 4 }}>ACTUEL</span>}</span>
                        <span style={{ fontSize: 10, color: 'var(--muted)' }}>{v.date}</span>
                      </div>
                      <div style={{ fontSize: 11, color: 'var(--muted)', marginTop: 2 }}>{v.auteur} · {v.note}</div>
                      <div style={{ fontSize: 10, color: 'var(--muted)', marginTop: 1 }}>Taille : {v.taille}</div>
                    </div>
                    <div style={{ display: 'flex', gap: 3 }}>
                      <button className="btn btn-ghost btn-xs" title="Télécharger cette version" onClick={() => {
                        const a = document.createElement('a');
                        a.href = 'data:text/plain;charset=utf-8,' + encodeURIComponent(`Version ${v.v}\nDate : ${v.date}\nAuteur : ${v.auteur}\nNote : ${v.note}\nTaille : ${v.taille}`);
                        a.download = `version_${v.v}.txt`;
                        a.click();
                      }}><Download size={10} /></button>
                      {i > 0 && <button className="btn btn-ghost btn-xs" title="Restaurer cette version" onClick={() => {
                        setDocs(prev => prev.map(d => d.id === showVersions ? { ...d, version: v.v } : d));
                      }}><RotateCcw size={10} /></button>}
                    </div>
                  </div>
                ))}
              </div>
              <div style={{ padding: '12px 18px', borderTop: '1px solid var(--border-2)', flexShrink: 0 }}>
                {showNewVer ? (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                    <input className="form-input" placeholder="Note de version (ex: Corrections BEI suite révision...)" value={newVerForm.note} onChange={e => setNewVerForm(p => ({ ...p, note: e.target.value }))} />
                    <div style={{ display: 'flex', gap: 8 }}>
                      <input className="form-input" placeholder="Taille (ex: 9.2 Mo)" style={{ flex: 1 }} value={newVerForm.taille} onChange={e => setNewVerForm(p => ({ ...p, taille: e.target.value }))} />
                      <button className="btn btn-primary btn-sm" onClick={() => addVersion(showVersions ?? '')}><Check size={11} /> Créer</button>
                      <button className="btn btn-ghost btn-sm" onClick={() => setShowNewVer(false)}>Annuler</button>
                    </div>
                  </div>
                ) : (
                  <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
                    <button className="btn btn-ghost btn-sm" onClick={() => setShowVersions(null)}>Fermer</button>
                    <button className="btn btn-primary btn-sm" onClick={() => setShowNewVer(true)}><Plus size={12} /> Nouvelle version</button>
                  </div>
                )}
              </div>
            </div>
          </div>
        );
      })()}

      {/* Panel workflow validation */}
      {showWorkflow && (() => {
        const doc = docs.find(d => d.id === showWorkflow);
        if (!doc) return null;
        const curIdx = WF_STEPS.indexOf(doc.statut as WFStatut);
        return (
          <div style={{ position: 'fixed', inset: 0, zIndex: 300, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center' }} onClick={() => setShowWorkflow(null)}>
            <div style={{ width: '100%', maxWidth: 560, background: 'var(--bg-card)', borderRadius: 14, overflow: 'hidden', boxShadow: 'var(--shadow-lg)' }} onClick={e => e.stopPropagation()}>
              <div style={{ padding: '14px 18px', background: 'var(--navy)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                  <div style={{ color: '#fff', fontWeight: 700, fontSize: 13 }}>🔄 Workflow de validation</div>
                  <div style={{ color: 'rgba(255,255,255,0.6)', fontSize: 10, marginTop: 2 }}>{doc.nom} · {doc.version}</div>
                </div>
                <button onClick={() => setShowWorkflow(null)} className="btn btn-ghost btn-xs" style={{ color: '#fff', borderColor: 'rgba(255,255,255,0.3)' }}><X size={12} /></button>
              </div>
              <div style={{ padding: '18px 20px' }}>
                {/* Progress bar */}
                <div style={{ display: 'flex', alignItems: 'center', marginBottom: 20, gap: 0 }}>
                  {WF_STEPS.map((step, i) => {
                    const done = i <= curIdx;
                    const active = i === curIdx;
                    return (
                      <div key={step} style={{ display: 'flex', alignItems: 'center', flex: i < WF_STEPS.length - 1 ? 1 : undefined }}>
                        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
                          <div style={{ width: 28, height: 28, borderRadius: '50%', background: done ? (active ? 'var(--navy)' : 'var(--green)') : 'var(--border-2)', display: 'flex', alignItems: 'center', justifyContent: 'center', border: active ? '2px solid var(--orange)' : 'none' }}>
                            {done && !active ? <Check size={12} style={{ color: '#fff' }} /> : <span style={{ fontSize: 10, fontWeight: 700, color: done ? '#fff' : 'var(--muted)' }}>{i + 1}</span>}
                          </div>
                          <span style={{ fontSize: 9, fontWeight: active ? 700 : 400, color: active ? 'var(--navy)' : done ? 'var(--green)' : 'var(--muted)', textAlign: 'center', maxWidth: 60 }}>{step}</span>
                        </div>
                        {i < WF_STEPS.length - 1 && (
                          <div style={{ flex: 1, height: 2, background: i < curIdx ? 'var(--green)' : 'var(--border-2)', margin: '0 4px', marginBottom: 18 }} />
                        )}
                      </div>
                    );
                  })}
                </div>

                {/* Metadata */}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 14 }}>
                  {[
                    ['Projet', doc.projet], ['Auteur', doc.auteur],
                    ['Type', doc.type], ['Version', doc.version],
                    ['Date dépôt', doc.date], ['Taille', doc.taille],
                  ].map(([k, v]) => (
                    <div key={k} style={{ padding: '8px 10px', background: 'var(--bg)', borderRadius: 7, fontSize: 11 }}>
                      <div style={{ color: 'var(--muted)', marginBottom: 2 }}>{k}</div>
                      <div style={{ fontWeight: 600, color: 'var(--text)' }}>{v}</div>
                    </div>
                  ))}
                </div>

                {/* Comment */}
                <div style={{ marginBottom: 14 }}>
                  <label style={{ fontSize: 11, fontWeight: 600, color: 'var(--text)', display: 'block', marginBottom: 4 }}>Commentaire (optionnel)</label>
                  <textarea rows={2} className="form-input" style={{ width: '100%', boxSizing: 'border-box', resize: 'vertical' }} value={wfComment} onChange={e => setWfComment(e.target.value)} placeholder="Motif d'approbation, observations de révision..." />
                </div>

                {/* Actions */}
                <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
                  <button className="btn btn-ghost btn-sm" onClick={() => setShowWorkflow(null)}>Fermer</button>
                  {curIdx < WF_STEPS.length - 1 && (
                    <button className="btn btn-sm" style={{ background: 'rgba(239,51,64,0.1)', color: 'var(--red)', border: '1px solid rgba(239,51,64,0.3)' }} onClick={() => rejectDoc(showWorkflow ?? '')}>
                      <ThumbsDown size={11} /> Rejeter / Retourner
                    </button>
                  )}
                  {curIdx < WF_STEPS.length - 1 && (
                    <button className="btn btn-primary btn-sm" onClick={() => advanceDoc(showWorkflow ?? '')}>
                      <ThumbsUp size={11} /> {curIdx === WF_STEPS.length - 2 ? 'Publier' : 'Valider & Avancer'}
                    </button>
                  )}
                  {curIdx === WF_STEPS.length - 1 && (
                    <button className="btn btn-sm" style={{ background: 'rgba(100,116,139,0.1)', color: 'var(--slate)', border: '1px solid rgba(100,116,139,0.3)' }}>
                      <Archive size={11} /> Archiver
                    </button>
                  )}
                </div>
              </div>
            </div>
          </div>
        );
      })()}

      {/* Visualiseur de document */}
      {/* Annotateur in-app (surligner, commenter, note, stylo) sur documents chargés */}
      {annotDoc && <DocumentAnnotator doc={annotDoc} onClose={() => setAnnotDoc(null)} />}

      {viewerDoc && (() => {
        const doc = docs.find(d => d.id === viewerDoc);
        if (!doc) return null;
        const isImage = doc.type === 'Image';
        const isPdf = doc.type === 'PDF' || doc.fileExt === 'pdf';
        const canPreview = !!doc.fileUrl && (isImage || isPdf);
        return (
          <div style={{ position: 'fixed', inset: 0, zIndex: 320, background: 'rgba(0,0,0,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }} onClick={() => setViewerDoc(null)}>
            <div style={{ width: '100%', maxWidth: 880, height: '88vh', background: 'var(--bg-card)', borderRadius: 14, overflow: 'hidden', boxShadow: 'var(--shadow-lg)', display: 'flex', flexDirection: 'column' }} onClick={e => e.stopPropagation()}>
              <div style={{ padding: '14px 18px', background: 'var(--navy)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexShrink: 0 }}>
                <div style={{ minWidth: 0 }}>
                  <div style={{ color: '#fff', fontWeight: 700, fontSize: 13, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{doc.nom}</div>
                  <div style={{ color: 'rgba(255,255,255,0.6)', fontSize: 10, marginTop: 2 }}>{doc.projet} · {doc.version} · {doc.taille}</div>
                </div>
                <div style={{ display: 'flex', gap: 6, alignItems: 'center', flexShrink: 0 }}>
                  <button className="btn btn-ghost btn-xs" style={{ color: '#fff', borderColor: 'rgba(255,255,255,0.3)' }} onClick={() => {
                    const a = document.createElement('a');
                    if (doc.fileUrl) { a.href = doc.fileUrl; a.download = doc.nom; }
                    else { a.href = 'data:text/plain;charset=utf-8,' + encodeURIComponent(`Document : ${doc.nom}\nVersion : ${doc.version}\nAuteur : ${doc.auteur}\nDate : ${doc.date}`); a.download = doc.nom.replace(/\s+/g, '_') + '.txt'; }
                    a.click();
                  }}><Download size={11} /> Télécharger</button>
                  <button className="btn btn-ghost btn-xs" style={{ color: '#fff', borderColor: 'rgba(255,255,255,0.3)' }} onClick={() => setViewerDoc(null)}><X size={12} /></button>
                </div>
              </div>
              <div style={{ flex: 1, overflow: 'auto', background: '#525659', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                {canPreview && isImage && (
                  <img src={doc.fileUrl} alt={doc.nom} style={{ maxWidth: '100%', maxHeight: '100%', objectFit: 'contain' }} />
                )}
                {canPreview && isPdf && (
                  <iframe src={doc.fileUrl} title={doc.nom} style={{ width: '100%', height: '100%', border: 'none', background: '#fff' }} />
                )}
                {!canPreview && (
                  <div style={{ textAlign: 'center', color: '#fff', padding: 40 }}>
                    <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 14 }}><DocIcon type={doc.type} /></div>
                    <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 6 }}>{doc.nom}</div>
                    <div style={{ fontSize: 12, opacity: 0.75, maxWidth: 380, margin: '0 auto 16px' }}>
                      {doc.fileUrl
                        ? `L'aperçu intégré n'est pas disponible pour ce type de fichier (${doc.type}). Téléchargez-le pour l'ouvrir.`
                        : 'Ce document de démonstration n\'a pas de fichier téléversé. Ajoutez un document via « Ajouter document » pour le visualiser.'}
                    </div>
                    {doc.fileUrl && (
                      <button className="btn btn-primary btn-sm" onClick={() => {
                        const a = document.createElement('a'); a.href = doc.fileUrl!; a.download = doc.nom; a.click();
                      }}><Download size={12} /> Télécharger le fichier</button>
                    )}
                  </div>
                )}
              </div>
            </div>
          </div>
        );
      })()}

      {showUpload && <UploadModal onClose={() => setShowUpload(false)} onAdd={(doc) => { setDocs(prev => [doc, ...prev]); gedAudit('Dépôt de document (GED)', doc.nom, `v${doc.version} · ${doc.type}`); setShowUpload(false); }} />}

      {editDoc && <EditDocModal doc={editDoc} onClose={() => setEditDoc(null)} onSave={saveEditDoc} />}
    </div>
  );
}


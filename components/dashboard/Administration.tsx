'use client';

import { useState, useCallback } from 'react';
import {
  Lock, Edit2, Trash2,
  Check, X, AlertTriangle, Eye, ToggleLeft,
  ToggleRight, Search, UserPlus, Key,
  Calculator, FunctionSquare, Info, Save,
  LayoutDashboard, PlusCircle, Plus,
} from 'lucide-react';
import { ROLES, ROLE_SECTIONS, type RoleCode, type SidebarSectionId, ROLES as AUTH_ROLES, normalizeDirectionCode } from '@/lib/authStore';
import { PERSONNEL_DPE, posteToRole } from '@/lib/dpePersonnel';
import { useNotificationStore } from '@/lib/notificationStore';
import { useIntegrationConfig } from '@/lib/integrationConfigStore';
import { useAlertConfig, CANAL_META, type GraviteAlerte } from '@/lib/alertConfigStore';
import { usePermissionStore } from '@/lib/permissionStore';
import { DPE_ORG } from '@/lib/dpeOrgStructure';
import { useAuth } from '@/lib/authStore';
import { useCriteriaStore, type CritereGroup } from '@/lib/criteriaStore';
import { useAuditStore, auditToCSV, logAudit } from '@/lib/auditStore';
import { usePasswordPolicyStore } from '@/lib/passwordPolicyStore';
import CalculBuilder from './CalculBuilder';
import { useTerrainConfigStore, type IndicateurUnite as TerrainIndUnite, type PhaseKey as TerrainPhaseKey } from '@/lib/terrainConfigStore';

/* ─── Visibilité réelle par rôle (sections du menu — source authStore) ─── */
const SECTION_LABELS: Record<SidebarSectionId, string> = {
  accueil:      'Accueil / Tableau de bord',
  portefeuille: 'Portefeuille & Projets',
  mes_projets:  'Mes Projets',
  execution:    'Exécution & Contrôle',
  finances:     'Finances & Engagements',
  immobilisations: 'Immobilisations & Patrimoine',
  logistique:   'Logistique & Ressources',
  transverses:  'Suivi, Reporting & Collaboration (GED, Workflows, IA…)',
  parametrage:  'Paramétrage / Administration',
};
const SECTION_ORDER: SidebarSectionId[] = ['accueil', 'portefeuille', 'mes_projets', 'execution', 'finances', 'logistique', 'transverses', 'parametrage'];
const ROLE_ORDER: RoleCode[] = ['DIR_DPE', 'PMO', 'CHEF_DEPT', 'CHEF_PROJ', 'INGENIEUR', 'EXPERT', 'CONTROLEUR', 'CHARGE', 'ASSISTANT', 'SECRETAIRE', 'CHAUFFEUR', 'CTRL_FIN', 'RESP_LOG', 'ADMIN'];

/* ═══════════════════════════════════════════════════════════════════════
   TYPES & MOCK DATA
═══════════════════════════════════════════════════════════════════════ */

type RoleId = RoleCode; // Use RoleCode from authStore

interface Utilisateur {
  id: string;
  nom: string;
  email: string;
  tenant: string;
  profil: string;          // profil/poste EXACT issu du fichier DPE
  roles: RoleId[];         // mapping interne pour la matrice de permissions
  modules: string[];
  dernierLogin: string;
  actif: boolean;
}

interface Tenant {
  id: string;
  nom: string;
  code: string;
  shortLabel?: string;
  nbUtilisateurs: number;
  modules: string[];
  statut: 'actif' | 'inactif';
  description: string;
}

interface Permission {
  id: string;
  label: string;
}

interface Regle {
  roles: Record<RoleId, boolean>;
}

interface Module {
  id: string;
  nom: string;
  description: string;
  tenantsActifs: string[];
}

interface SessionSuspecte {
  id: string;
  utilisateur: string;
  ip: string;
  date: string;
  raison: string;
  bloque: boolean;
}

interface CalculatedField {
  id: string;
  nom: string;
  code: string;
  formule: string;
  unite: string;
  description: string;
  statut: 'actif' | 'test';
}

interface DashboardWidget {
  id: string;
  type: 'kpi_card' | 'bar_chart' | 'pie_chart' | 'project_table';
  title: string;
  config: Record<string, any>; // e.g., { kpiCode: 'TPB_REAL', color: '#F47920' }
}

interface CustomDashboard {
  id: string;
  name: string;
  description: string;
  widgets: DashboardWidget[];
  createdAt: string;
  lastModified: string;
}

/* ─── Utilisateurs — dérivés du FICHIER DU PERSONNEL DPE (profils réels) ─── */

const slug = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z]+/g, '.').replace(/^\.|\.$/g, '');

const UTILISATEURS: Utilisateur[] = PERSONNEL_DPE.map((a, i) => ({
  id: a.mle || `u${i}`,
  nom: `${a.prenom} ${a.nom}`.trim(),
  email: `${slug(a.prenom)}.${slug(a.nom)}@senelec.sn`,
  tenant: normalizeDirectionCode(a.direction),
  profil: a.poste,
  roles: [posteToRole(a.fonction, a.poste, a.direction) as RoleCode],
  modules: ['PROJET', 'GED', 'REPORTING'],
  dernierLogin: '—',
  actif: true,
}));

/** Nombre réel d'agents par direction (calculé depuis le fichier personnel) */
const REAL_PERSONNEL_COUNT: Record<string, number> = PERSONNEL_DPE.reduce((acc, a) => {
  const code = normalizeDirectionCode(a.direction);
  acc[code] = (acc[code] || 0) + 1;
  return acc;
}, {} as Record<string, number>);

/* ─── Tenants — codes alignés sur normalizeDirectionCode, effectifs réels depuis FICHIER PERSONNEL DPE ─── */
const TENANTS: Tenant[] = [
  { id: 't1',  nom: 'Direction Principale Équipement',         code: 'EM_DPE',      nbUtilisateurs: REAL_PERSONNEL_COUNT['EM_DPE']      ?? 0, statut: 'actif', description: 'Direction Principale Équipement (EM DPE)',          modules: ['PROJET','SCHEDULE','FINANCE','GED','COURRIER','REPORTING','RISK','MARCHE','TERRAIN','SIG'] },
  { id: 't2',  nom: 'Direction Équipement Réseaux',            code: 'DER',         nbUtilisateurs: REAL_PERSONNEL_COUNT['DER']         ?? 0, statut: 'actif', description: 'Direction Équipement Réseaux — DPD / DPT',          modules: ['PROJET','SCHEDULE','FINANCE','GED','TERRAIN','SIG'] },
  { id: 't3',  nom: 'Direction Génie Civil & Immobilisations', code: 'DGC',         nbUtilisateurs: REAL_PERSONNEL_COUNT['DGC']         ?? 0, statut: 'actif', description: 'Direction Génie Civil — DPI / DET&GI',              modules: ['PROJET','SCHEDULE','GED','TERRAIN','SIG'] },
  { id: 't4',  nom: 'Direction Équipement Production',         code: 'DEP',         nbUtilisateurs: REAL_PERSONNEL_COUNT['DEP']         ?? 0, statut: 'actif', description: 'Direction Équipement Production — DPER / DPEC',     modules: ['PROJET','SCHEDULE','FINANCE','GED','TERRAIN'] },
  { id: 't5',  nom: 'Direction Innovation Technologique',      code: 'DIT',         nbUtilisateurs: REAL_PERSONNEL_COUNT['DIT']         ?? 0, statut: 'actif', description: 'Direction Innovation Technologique — DPC / DSSE',     modules: ['PROJET','SCHEDULE','GED','TERRAIN','SIG'] },
  { id: 't6',  nom: 'Coordination Compact 2026',               code: 'CC26',        nbUtilisateurs: REAL_PERSONNEL_COUNT['CC26']        ?? 0, statut: 'actif', description: 'Coordination Compact 2026 (MCA)',                   modules: ['PROJET','FINANCE','BAILLEUR','REPORTING'] },
  { id: 't7',  nom: 'Coordination Programmes BM-UE',           code: 'CPBM_UE',     nbUtilisateurs: REAL_PERSONNEL_COUNT['CPBM_UE']     ?? 0, statut: 'actif', description: 'Coordination Programmes Banque Mondiale — UE',      modules: ['PROJET','FINANCE','BAILLEUR','REPORTING'] },
  { id: 't8',  nom: 'Coordination PAMACEL & EE',               code: 'CPAMACEL_EE', nbUtilisateurs: REAL_PERSONNEL_COUNT['CPAMACEL_EE'] ?? 0, statut: 'actif', description: 'Coordination Programme AMACEL & Énergies Emergentes',modules: ['PROJET','FINANCE','BAILLEUR','REPORTING'] },
  { id: 't9',  nom: 'Coordination PADERAU',                    code: 'CPADERAU',    nbUtilisateurs: REAL_PERSONNEL_COUNT['CPADERAU']    ?? 0, statut: 'actif', description: 'Coordination Programme PADERAU',                    modules: ['PROJET','FINANCE','BAILLEUR','REPORTING'] },
  { id: 't10', nom: 'Cellule Suivi & Évaluation',             code: 'CSE',         nbUtilisateurs: REAL_PERSONNEL_COUNT['CSE']         ?? 0, statut: 'actif', description: 'Cellule Suivi-Évaluation transverse',               modules: ['PROJET','REPORTING'] },
];

/* ─── Rôles & Permissions ─── */
const ROLES_LIST = Object.values(AUTH_ROLES).map(r => ({
  id: r.code,
  label: r.label,
  color: r.color,
}));

const PERMISSIONS: Permission[] = [
  { id: 'read_projets',    label: 'Lire projets'       },
  { id: 'write_projets',   label: 'Modifier projets'   },
  { id: 'delete_projets',  label: 'Supprimer projets'  },
  { id: 'valider',         label: 'Valider documents'  },
  { id: 'signer',          label: 'Signer courriers'   },
  { id: 'configurer',      label: 'Configurer système' },
  { id: 'exporter',        label: 'Exporter données'   },
  { id: 'admin_users',     label: 'Gérer utilisateurs' },
];

const MATRICE: Record<RoleCode, Record<string, boolean>> = {
  ADMIN:       { read_projets: true,  write_projets: true,  delete_projets: true,  valider: true,  signer: true,  configurer: true,  exporter: true,  admin_users: true  },
  PMO:         { read_projets: true,  write_projets: true,  delete_projets: false, valider: true,  signer: false, configurer: false, exporter: true,  admin_users: false },
  DIR_DPE:     { read_projets: true,  write_projets: true,  delete_projets: false, valider: true,  signer: true,  configurer: false, exporter: true,  admin_users: false },
  CHEF_PROJ:   { read_projets: true,  write_projets: true,  delete_projets: false, valider: false, signer: false, configurer: false, exporter: true,  admin_users: false },
  CHEF_DEPT:   { read_projets: true,  write_projets: true,  delete_projets: false, valider: true,  signer: false, configurer: false, exporter: true,  admin_users: false },
  INGENIEUR:   { read_projets: true,  write_projets: false, delete_projets: false, valider: false, signer: false, configurer: false, exporter: true,  admin_users: false },
  EXPERT:      { read_projets: true,  write_projets: false, delete_projets: false, valider: false, signer: false, configurer: false, exporter: true,  admin_users: false },
  CONTROLEUR:  { read_projets: true,  write_projets: false, delete_projets: false, valider: false, signer: false, configurer: false, exporter: true,  admin_users: false },
  CHARGE:      { read_projets: true,  write_projets: false, delete_projets: false, valider: false, signer: false, configurer: false, exporter: true,  admin_users: false },
  ASSISTANT:   { read_projets: true,  write_projets: false, delete_projets: false, valider: false, signer: false, configurer: false, exporter: true,  admin_users: false },
  SECRETAIRE:  { read_projets: true,  write_projets: false, delete_projets: false, valider: false, signer: false, configurer: false, exporter: true,  admin_users: false },
  CHAUFFEUR:   { read_projets: false, write_projets: false, delete_projets: false, valider: false, signer: false, configurer: false, exporter: false, admin_users: false },
  CTRL_FIN:    { read_projets: true,  write_projets: false, delete_projets: false, valider: false, signer: false, configurer: false, exporter: true,  admin_users: false },
  RESP_LOG:    { read_projets: true,  write_projets: true,  delete_projets: false, valider: true,  signer: false, configurer: false, exporter: true,  admin_users: false },
  MARCHES:     { read_projets: true,  write_projets: false, delete_projets: false, valider: true,  signer: false, configurer: false, exporter: true,  admin_users: false },
  SIG:         { read_projets: true,  write_projets: false, delete_projets: false, valider: false, signer: false, configurer: false, exporter: true,  admin_users: false },
  IMMO:        { read_projets: true,  write_projets: true,  delete_projets: false, valider: false, signer: false, configurer: false, exporter: true,  admin_users: false },
  AUDIT:       { read_projets: true,  write_projets: false, delete_projets: false, valider: false, signer: false, configurer: false, exporter: true,  admin_users: false },
  CONTROLEUR_TRAVAUX: { read_projets: true, write_projets: false, delete_projets: false, valider: false, signer: false, configurer: false, exporter: true, admin_users: false },
};

/* ─── Modules ─── */
const MODULES_LIST = [
  { id: 'PROJET',    nom: 'Projets DPE',               description: 'Gestion portefeuille et fiches projets' },
  { id: 'SCHEDULE',  nom: 'Planning / Gantt',          description: 'Planification et suivi Gantt & WBS' },
  { id: 'FINANCE',   nom: 'Finance & Budget',          description: 'Suivi budgétaire, décaissements, EVM' },
  { id: 'RESOURCE',  nom: 'Ressources Humaines',       description: 'Affectation et suivi des ressources' },
  { id: 'SIG',       nom: 'Cartographie SIG',          description: 'Cartographie et système d\'information géographique' },
  { id: 'COURRIER',  nom: 'Courriers & ANOs',          description: 'Gestion courriers entrants/sortants et ANOs' },
  { id: 'GED',       nom: 'GED — Documents',           description: 'Bibliothèque documentaire et versioning' },
  { id: 'REPORTING', nom: 'Reporting & Analytique',    description: 'Tableaux de bord, KPIs, exports' },
  { id: 'BAILLEUR',  nom: 'Interface Bailleurs',       description: 'Portail bailleurs de fonds' },
  { id: 'TERRAIN',   nom: 'Terrain & Mobile',          description: 'Application terrain pour contrôleurs' },
  { id: 'MARCHE',    nom: 'Marchés & Contrats',        description: 'Suivi marchés, contrats et réceptions' },
  { id: 'RISK',      nom: 'Risques',                  description: 'Registre et matrice des risques' },
];

/* ─── Sécurité ─── */

/* ═══════════════════════════════════════════════════════════════════════
   HELPERS
═══════════════════════════════════════════════════════════════════════ */
type TabAdminType = 'utilisateurs' | 'tenants' | 'roles' | 'modules' | 'securite' | 'calculs' | 'criteres' | 'dashboard_builder' | 'integrations' | 'alertes' | 'terrain' | 'audit';
function pillRole(role: RoleCode) {
  const r = ROLES_LIST.find(x => x.id === role);
  if (!r) return null;
  return <span key={role} style={{ fontSize: 9, padding: '2px 6px', borderRadius: 99, background: r.color + '18', color: r.color, border: `1px solid ${r.color}33`, fontWeight: 700 }}>{r.label}</span>;
}

/* ═══════════════════════════════════════════════════════════════════════
   MODAL INVITER UTILISATEUR
═══════════════════════════════════════════════════════════════════════ */
interface PendingInvitation {
  id: string;
  nom: string;
  prenom: string;
  email: string;
  role: RoleCode;
  direction: string;
  sentAt: string;
}

function InviterModal({ onClose, onSend }: { onClose: () => void; onSend?: (inv: PendingInvitation) => void }) {
  const [step, setStep] = useState<1|2|3>(1);
  const [nom, setNom] = useState('');
  const [prenom, setPrenom] = useState('');
  const [email, setEmail] = useState('');
  const [tenant, setTenant] = useState('');
  const [direction, setDirection] = useState<string>(''); // Changed to string to allow any input
  const [role, setRole] = useState<RoleId | ''>('');
  const [modules, setModules] = useState<Set<string>>(new Set());
  const [sent, setSent] = useState(false);

  const DIRECTIONS = ['DER — Direction Équipement Réseaux', 'DIT — Direction Infrastructure & Transport', 'DPE — Direction Principale Équipement', 'UAGL — Unité Logistique', 'PMO Bureau'];
  const PERMS = [
    { id: 'lecture',     label: 'Lecture seule',              desc: 'Peut consulter tous les éléments autorisés' },
    { id: 'creation',    label: 'Création de données',        desc: 'Peut créer des projets, tâches, ODM' },
    { id: 'modification',label: 'Modification',               desc: 'Peut modifier les données existantes' },
    { id: 'validation',  label: 'Validation / Approbation',   desc: 'Peut approuver et valider les workflows' },
    { id: 'export',      label: 'Export & Rapports',          desc: 'Peut exporter, générer des rapports PDF' },
    { id: 'suppression', label: 'Suppression',                desc: 'Peut supprimer des éléments (restreint)' },
  ];
  const [perms, setPerms] = useState<Set<string>>(new Set(['lecture', 'creation']));

  const toggleModule = (id: string) => setModules(prev => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n; });
  const togglePerm   = (id: string) => setPerms(prev => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n; });
  const canNext1 = nom.trim() && prenom.trim() && email.includes('@') && tenant && role;
  const canSend  = canNext1 && modules.size > 0;

  const handleSend = () => {
    if (role) {
      onSend?.({ id: `inv_${Date.now()}`, nom, prenom, email, role: role, direction, sentAt: new Date().toLocaleDateString('fr-FR') });
    }
    setSent(true);
    setTimeout(onClose, 2500);
  };

  const steps = [
    { n: 1, label: 'Identité & Rôle' },
    { n: 2, label: 'Modules & Accès' },
    { n: 3, label: 'Permissions & Confirmation' },
  ];

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 300, background: 'rgba(0,0,0,0.60)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20, backdropFilter: 'blur(4px)' }}>
      <div style={{ width: '100%', maxWidth: 580, background: '#fff', borderRadius: 16, overflow: 'hidden', boxShadow: '0 20px 60px rgba(0,0,0,0.25)' }}>
        {/* Header */}
        <div style={{ padding: '18px 24px', background: 'linear-gradient(135deg, #2D1167 0%, #3D1A6B 100%)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <div style={{ color: '#fff', fontWeight: 800, fontSize: 15 }}>👤 Inviter un collaborateur</div>
            <div style={{ color: 'rgba(255,255,255,0.65)', fontSize: 11, marginTop: 2 }}>Configurer l'identité, les modules et les permissions d'accès</div>
          </div>
          <button onClick={onClose} style={{ background: 'rgba(255,255,255,0.12)', border: '1px solid rgba(255,255,255,0.20)', borderRadius: 8, width: 32, height: 32, cursor: 'pointer', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><X size={14} /></button>
        </div>

        {/* Stepper */}
        <div style={{ display: 'flex', borderBottom: '1px solid #E2E8F0', background: '#FAFBFD' }}>
          {steps.map((s, i) => (
            <button key={s.n} onClick={() => s.n < step ? setStep(s.n as 1|2|3) : undefined} style={{
              flex: 1, padding: '10px 0', border: 'none', cursor: s.n < step ? 'pointer' : 'default',
              background: 'transparent', borderBottom: step === s.n ? '2px solid #3D1A6B' : '2px solid transparent',
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
            }}>
              <div style={{
                width: 22, height: 22, borderRadius: '50%', fontSize: 10, fontWeight: 700,
                background: step > s.n ? '#22C55E' : step === s.n ? '#3D1A6B' : '#E2E8F0',
                color: step >= s.n ? '#fff' : '#94A3B8',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}>{step > s.n ? '✓' : s.n}</div>
              <span style={{ fontSize: 11, fontWeight: step === s.n ? 700 : 500, color: step === s.n ? '#3D1A6B' : '#64748B' }}>{s.label}</span>
              {i < steps.length - 1 && <span style={{ color: '#CBD5E1', fontSize: 10 }}>›</span>}
            </button>
          ))}
        </div>

        {/* Body */}
        <div style={{ padding: 24, minHeight: 260 }}>
          {sent ? (
            <div style={{ textAlign: 'center', padding: '40px 0' }}>
              <div style={{ fontSize: 42, marginBottom: 12 }}>✅</div>
              <div style={{ fontSize: 16, fontWeight: 700, color: '#16A34A' }}>Invitation envoyée !</div>
              <div style={{ fontSize: 12, color: '#64748B', marginTop: 6 }}>Un email a été envoyé à {email}. Le lien expire dans 48h.</div>
            </div>
          ) : step === 1 ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <div className="form-group" style={{ margin: 0 }}>
                  <label className="form-label">Prénom *</label>
                  <input className="form-input" value={prenom} onChange={e => setPrenom(e.target.value)} placeholder="Prénom" />
                </div>
                <div className="form-group" style={{ margin: 0 }}>
                  <label className="form-label">Nom *</label>
                  <input className="form-input" value={nom} onChange={e => setNom(e.target.value)} placeholder="NOM" />
                </div>
                <div className="form-group" style={{ margin: 0 }}>
                  <label className="form-label">Email professionnel *</label>
                  <input className="form-input" type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="prenom.nom@senelec.sn" />
                </div>
                <div className="form-group" style={{ margin: 0 }}>
                  <label className="form-label">Rôle SIGEPP *</label>
                  <select className="form-input" value={role} onChange={e => setRole(e.target.value as RoleCode | '')}>
                    <option value="">— Sélectionner —</option>
                    {ROLES_LIST.map(r => <option key={r.id} value={r.id}>{r.label}</option>)}
                  </select>
                </div>
                <div className="form-group" style={{ margin: 0 }}>
                  <label className="form-label">Organisation / Tenant *</label>
                  <select className="form-input" value={tenant} onChange={e => setTenant(e.target.value)}>
                    <option value="">— Sélectionner —</option>
                    {TENANTS.map(t => <option key={t.id} value={t.code}>{t.code} — {t.nom}</option>)}
                  </select>
                </div>
                <div className="form-group" style={{ margin: 0 }}>
                  <label className="form-label">Direction / Unité</label>
                  <select className="form-input" value={direction} onChange={e => setDirection(e.target.value)}>
                    <option value="">— Optionnel —</option>
                    {DIRECTIONS.map(d => <option key={d} value={d}>{d}</option>)}
                  </select>
                </div>
              </div>
              {role && ROLES_LIST.find(r=>r.id===role) && ( // Check if role is valid before displaying
                <div style={{ padding: '10px 14px', background: '#F3EBF9', borderRadius: 8, border: '1px solid #E9D5FF', fontSize: 11.5, color: '#3D1A6B' }}>
                  🎯 <strong>Accès préconfiguré pour le rôle {ROLES_LIST.find(r=>r.id===role)?.label} :</strong>{' '}
                  les modules et permissions par défaut seront proposés à l'étape suivante.
                </div>
              )}
            </div>
          ) : step === 2 ? (
            <div>
              <div style={{ fontSize: 12, fontWeight: 700, color: '#374151', marginBottom: 12 }}>Modules accessibles ({modules.size} sélectionné{modules.size !== 1 ? 's' : ''})</div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                {MODULES_LIST.map(m => {
                  const active = modules.has(m.id);
                  return (
                    <button key={m.id} onClick={() => toggleModule(m.id)} style={{
                      textAlign: 'left', padding: '10px 12px', borderRadius: 9,
                      border: `1.5px solid ${active ? '#3D1A6B' : '#E2E8F0'}`,
                      background: active ? '#F3EBF9' : '#FAFBFD',
                      cursor: 'pointer', display: 'flex', alignItems: 'flex-start', gap: 8,
                    }}>
                      <div style={{
                        width: 16, height: 16, borderRadius: 4, marginTop: 1, flexShrink: 0,
                        background: active ? '#3D1A6B' : '#E2E8F0', border: `1px solid ${active ? '#3D1A6B' : '#CBD5E1'}`,
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                      }}>
                        {active && <Check size={10} color="#fff" />}
                      </div>
                      <div>
                        <div style={{ fontSize: 12, fontWeight: 600, color: active ? '#3D1A6B' : '#1E293B' }}>{m.nom}</div>
                        <div style={{ fontSize: 10, color: '#94A3B8', marginTop: 1 }}>{m.description}</div>
                      </div>
                    </button>
                  );
                })}
              </div>
              {role === 'CHEF_PROJ' && ( // Use RoleCode directly
                <div style={{ marginTop: 14, padding: '10px 14px', background: '#EFF6FF', borderRadius: 8, border: '1px solid #BFDBFE', fontSize: 11.5, color: '#1D4ED8' }}>
                  💡 En tant que <strong>Chef de Projet</strong>, l'utilisateur verra uniquement les projets qui lui seront assignés par le PMO ou l'administrateur.
                </div>
              )}
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              <div style={{ fontSize: 12, fontWeight: 700, color: '#374151', marginBottom: 4 }}>Permissions granulaires</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                {PERMS.map(p => {
                  const active = perms.has(p.id);
                  return (
                    <label key={p.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 12px', borderRadius: 8, background: active ? '#F3EBF9' : '#FAFBFD', border: `1px solid ${active ? '#DDD6FE' : '#E2E8F0'}`, cursor: 'pointer' }}>
                      <input type="checkbox" checked={active} onChange={() => togglePerm(p.id)} style={{ accentColor: '#3D1A6B', width: 14, height: 14 }} />
                      <div>
                        <div style={{ fontSize: 12, fontWeight: 600, color: '#1E293B' }}>{p.label}</div>
                        <div style={{ fontSize: 10, color: '#94A3B8' }}>{p.desc}</div>
                      </div>
                    </label>
                  );
                })}
              </div>
              {/* Résumé */}
              <div style={{ padding: '12px 14px', background: '#F8FAFC', borderRadius: 8, border: '1px solid #E2E8F0', fontSize: 11.5 }}>
                <div style={{ fontWeight: 700, color: '#374151', marginBottom: 6 }}>📋 Résumé de l'invitation :</div>
                <div style={{ color: '#475569', lineHeight: 1.7 }}>
                  <div>👤 {prenom} {nom} — {email}</div>
                  <div>🏢 {TENANTS.find(t => t.code === tenant)?.nom ?? tenant}{direction ? ` — ${direction}` : ''}</div>
                  <div>🔑 {ROLES_LIST.find(r=>r.id===role)?.label ?? role}</div>
                  <div>📦 {modules.size} module{modules.size !== 1 ? 's' : ''} · {perms.size} permission{perms.size !== 1 ? 's' : ''}</div>
                </div>
              </div>
              <div style={{ fontSize: 10.5, color: '#94A3B8', display: 'flex', alignItems: 'center', gap: 6 }}>
                <AlertTriangle size={11} /> Le lien d'invitation expire dans 48h. L'utilisateur devra choisir son mot de passe.
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        {!sent && (
          <div style={{ padding: '12px 24px', borderTop: '1px solid #E2E8F0', display: 'flex', gap: 8, justifyContent: 'space-between', alignItems: 'center', background: '#FAFBFD' }}>
            <button className="btn btn-ghost btn-sm" onClick={step === 1 ? onClose : () => setStep(s => (s - 1) as 1|2|3)}>
              {step === 1 ? 'Annuler' : '← Retour'}
            </button>
            {step < 3 ? (
              <button className="btn btn-primary btn-sm" disabled={step === 1 && !canNext1} onClick={() => setStep(s => (s + 1) as 1|2|3)}>
                Suivant →
              </button>
            ) : (
              <button className="btn btn-primary btn-sm" disabled={!canSend} onClick={handleSend}>
                <UserPlus size={13} /> Envoyer l'invitation
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════════
   COMPOSANT PRINCIPAL
═══════════════════════════════════════════════════════════════════════ */
export default function Administration() {
  const { addNotification } = useNotificationStore();
  // ── Habilitations configurables (sections + direction + niveau de vue par rôle) ──
  const sectionOverrides = usePermissionStore(s => s.sectionOverrides);
  const roleScopes        = usePermissionStore(s => s.roleScopes);
  const toggleRoleSection = usePermissionStore(s => s.toggleRoleSection);
  const setRoleDirection  = usePermissionStore(s => s.setRoleDirection);
  const setRoleNiveau     = usePermissionStore(s => s.setRoleNiveau);
  const resetRoleScope    = usePermissionStore(s => s.resetRole);
  /** Sections effectives d'un rôle = surcharge admin si définie, sinon défaut code. */
  const effectiveSections = (rc: RoleCode): string[] => sectionOverrides[rc] ?? ROLE_SECTIONS[rc];

  // ── Politique de mot de passe configurable (admin) ──
  const pwdPolicy        = usePasswordPolicyStore(s => s.config);
  const setPwdPolicy     = usePasswordPolicyStore(s => s.setConfig);
  const resetPwdPolicy   = usePasswordPolicyStore(s => s.resetConfig);

  // ── Canevas terrain & structure des phases (configurable par type/domaine) ──
  const terrainTemplates    = useTerrainConfigStore(s => s.templates);
  const setPhaseWeight      = useTerrainConfigStore(s => s.setPhaseWeight);
  const addTerrainIndic     = useTerrainConfigStore(s => s.addIndicateur);
  const removeTerrainIndic  = useTerrainConfigStore(s => s.removeIndicateur);
  const resetTerrainConfig  = useTerrainConfigStore(s => s.resetTemplates);
  const [terrainSelType, setTerrainSelType] = useState<string>('');
  const [newTIndLabel, setNewTIndLabel] = useState('');
  const [newTIndUnite, setNewTIndUnite] = useState<TerrainIndUnite>('nombre');
  const [newTIndPhase, setNewTIndPhase] = useState<TerrainPhaseKey>('travaux');

  const [tab, setTab] = useState<TabAdminType>('utilisateurs');
  const [search, setSearch] = useState('');
  const [filterTenant, setFilterTenant] = useState('tous');
  const [filterRole, setFilterRole] = useState('tous');
  const [showInvite, setShowInvite] = useState(false);
  const [pendingInvitations, setPendingInvitations] = useState<PendingInvitation[]>([]);
  const [moduleActif, setModuleActif] = useState<Record<string, Record<string, boolean>>>(
    Object.fromEntries(MODULES_LIST.map(m => [m.id, Object.fromEntries(TENANTS.map(t => [t.id, t.modules.includes(m.id)]))]))
  );

  // ── Calculated Fields state ──
  const [calculatedFields, setCalculatedFields] = useState<CalculatedField[]>([
    { id: 'cf1', nom: 'Taux de performance budget', code: 'TPB_REAL', formule: '(budgetDecaisse / budgetEngage) * 100', unite: '%', description: 'Rapport entre le décaissé réel et l\'engagé contractuel', statut: 'actif' },
    { id: 'cf2', nom: 'Indice Efficience Senelec', code: 'IES_PROJ', formule: '(avancement / budgetDecaisse) * K_SECTORIEL', unite: 'pts', description: 'Score d\'efficience interne basé sur les coefficients DPE', statut: 'test' },
    { id: 'cf3', nom: 'Écart Prévisionnel Fin', code: 'VAR_FIN', formule: 'dateFinPrevue - dateFinEstimee', unite: 'jours', description: 'Dérive temporelle totale calculée par rapport à la baseline', statut: 'actif' },
  ]);
  // ── Édition des utilisateurs (surcharges locales : statut, rôles, profil) ──
  const [userEdits, setUserEdits] = useState<Record<string, Partial<Utilisateur>>>({});
  const [editUser, setEditUser] = useState<Utilisateur | null>(null);

  const [showCFForm, setShowCFForm] = useState(false);
  const [editingCFId, setEditingCFId] = useState<string | null>(null);
  const [cfForm, setCFForm] = useState<Omit<CalculatedField, 'id'>>({ nom: '', code: '', formule: '', unite: '', description: '', statut: 'test' });
  const [cfValidationMessage, setCfValidationMessage] = useState<{ type: 'info' | 'error' | 'success'; message: string } | null>(null);
  
  // ── Dashboard Builder state ──
  const [customDashboards, setCustomDashboards] = useState<CustomDashboard[]>([
    { id: 'cd1', name: 'Dashboard Direction DPE', description: 'Vue consolidée pour la direction', createdAt: '2026-01-01', lastModified: '2026-05-27', widgets: [
      { id: 'w1', type: 'kpi_card', title: 'Total Projets', config: { kpiCode: 'totalProjets', color: '#1B4F8A' } },
      { id: 'w2', type: 'bar_chart', title: 'Budget par Domaine', config: { dataType: 'budgetByDomain', xAxis: 'domaine', yAxis: 'budget' } },
      { id: 'w3', type: 'project_table', title: 'Projets Critiques', config: { filter: 'critiques', columns: ['code', 'nom', 'cpi', 'spi'] } },
    ]},
  ]);
  const [showDashboardForm, setShowDashboardForm] = useState(false);
  const [dashboardForm, setDashboardForm] = useState<Omit<CustomDashboard, 'id' | 'createdAt' | 'lastModified' | 'widgets'>>({ name: '', description: '' });
  const [selectedDashboard, setSelectedDashboard] = useState<CustomDashboard | null>(null);
  const [showWidgetForm, setShowWidgetForm] = useState(false);
  const [editingWidgetId, setEditingWidgetId] = useState<string | null>(null);
  const [widgetForm, setWidgetForm] = useState<Omit<DashboardWidget, 'id'>>({ type: 'kpi_card', title: '', config: {} });

  // Helper function for formula validation
  const validateFormula = useCallback((formula: string, currentCode: string, existingFields: CalculatedField[]): { isValid: boolean; message: string } => {
    if (!formula.trim()) {
      return { isValid: false, message: 'La formule ne peut pas être vide.' };
    }

    // Basic syntax check: balanced parentheses
    let balance = 0;
    for (const char of formula) {
      if (char === '(') balance++;
      else if (char === ')') balance--;
      if (balance < 0) return { isValid: false, message: 'Parenthèses mal équilibrées.' };
    }
    if (balance !== 0) return { isValid: false, message: 'Parenthèses mal équilibrées.' };

    // Check for invalid characters (beyond numbers, operators, field names, parentheses, spaces)
    const allowedCharsRegex = /^[a-zA-Z0-9_+\-*/().\s]*$/;
    if (!allowedCharsRegex.test(formula)) {
      return { isValid: false, message: 'Caractères non autorisés dans la formule.' };
    }

    // Basic circular reference check (direct self-reference)
    const fieldNamesInFormula: string[] = formula.match(/[a-zA-Z_][a-zA-Z0-9_]*/g) || [];
    if (fieldNamesInFormula.includes(currentCode)) {
        return { isValid: false, message: `Erreur: La formule ne peut pas référencer son propre code '${currentCode}'.` };
    }
    // More advanced circular reference detection would require building a dependency graph.

    return { isValid: true, message: 'Formule valide.' };
  }, []);


  const filteredUsers = UTILISATEURS.map(u => ({ ...u, ...userEdits[u.id] })).filter(u => {
    if (filterTenant !== 'tous' && u.tenant !== filterTenant) return false;
    if (filterRole !== 'tous' && !u.roles.includes(filterRole as RoleCode)) return false;
    if (search) {
      const s = search.toLowerCase();
      return u.nom.toLowerCase().includes(s) || u.email.toLowerCase().includes(s);
    }
    return true;
  });

  const toggleModule = (moduleId: string, tenantId: string) => {
    setModuleActif(prev => ({
      ...prev,
      [moduleId]: { ...prev[moduleId], [tenantId]: !prev[moduleId]?.[tenantId] },
    }));
  };

  return (
    <div className="page-content">
      {/* ── KPIs ── */}
      <div className="kpi-grid">
        <div className="kpi-card navy">
          <div className="kpi-label">Utilisateurs actifs</div>
          <div className="kpi-value">{UTILISATEURS.filter(u => u.actif).length}</div>
          <div className="kpi-sub">Sur {UTILISATEURS.length} inscrits</div>
        </div>
        <div className="kpi-card">
          <div className="kpi-label">Tenants actifs</div>
          <div className="kpi-value orange">{TENANTS.filter(t => t.statut === 'actif').length}</div>
          <div className="kpi-sub">Organisations connectées</div>
        </div>
        <div className="kpi-card green">
          <div className="kpi-label">Rôles définis</div>
          <div className="kpi-value green">{ROLES_LIST.length}</div>
          <div className="kpi-sub">Matrice permissions active</div>
        </div>
        <div className="kpi-card red">
          <div className="kpi-label">Sessions suspectes</div>
          <div className="kpi-value red">0</div>
          <div className="kpi-sub">0 bloquées</div>
        </div>
      </div>

      {/* ── Navigation onglets ── */}
      <div className="card">
        <div className="card-body" style={{ padding: '10px 14px' }}>
          <div className="tabs">
            {([
              { key: 'utilisateurs', label: '👥 Utilisateurs', badge: UTILISATEURS.filter(u => !u.actif).length },
              { key: 'tenants',      label: '🏢 Tenants',       badge: 0 },
              { key: 'roles',        label: '🔑 Rôles & Permissions', badge: 0 },
              { key: 'modules',      label: '📦 Modules',       badge: 0 },
              { key: 'calculs',      label: '📐 Fonctions & Calculs', badge: 0 },
              { key: 'criteres',     label: '⚖️ Critères & Scoring', badge: 0 },
              { key: 'terrain',      label: '🏗️ Phases & Canevas terrain', badge: 0 },
              { key: 'dashboard_builder', label: '📈 Dashboard Builder', badge: customDashboards.length },
              { key: 'securite',     label: '🔒 Sécurité',      badge: 0 },
              { key: 'audit',        label: '📋 Journal d\'audit', badge: 0 },
              { key: 'integrations', label: '🌐 Intégrations',  badge: 0 },
              { key: 'alertes',      label: '🚨 Alertes & canaux', badge: 0 },
            ] as { key: TabAdminType; label: string; badge: number }[]).map(t => (
              <button key={t.key} className={`tab${tab === t.key ? ' active' : ''}`} onClick={() => setTab(t.key)}>
                {t.label}
                {t.badge > 0 && <span style={{ fontSize: 9, background: 'var(--red)', color: '#fff', borderRadius: 99, padding: '1px 5px', marginLeft: 3 }}>{t.badge}</span>}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* ═══════════════════════════════════════════════════════════════
          TAB UTILISATEURS
      ═══════════════════════════════════════════════════════════════ */}
      {tab === 'utilisateurs' && (
        <div className="card">
          <div className="card-header">
            <span className="card-title">Utilisateurs ({filteredUsers.length})</span>
            <div style={{ display: 'flex', gap: 8 }}>
              <div style={{ position: 'relative', flexShrink: 0 }}>
                <Search size={11} style={{ position: 'absolute', left: 8, top: '50%', transform: 'translateY(-50%)', color: 'var(--muted)' }} />
                <input className="form-input" style={{ paddingLeft: 24, width: 160 }} placeholder="Chercher..." value={search} onChange={e => setSearch(e.target.value)} />
              </div>
              <select className="form-input" style={{ width: 'auto' }} value={filterTenant} onChange={e => setFilterTenant(e.target.value)}>
                <option value="tous">Toutes directions</option>
                {[...new Set(UTILISATEURS.map(u => u.tenant))].map(t => <option key={t} value={t}>{t}</option>)}
              </select>
              <select className="form-input" style={{ width: 'auto', flexShrink: 0 }} value={filterRole} onChange={e => setFilterRole(e.target.value)}>
                <option value="tous">Tous rôles</option>
                {ROLES_LIST.map(r => <option key={r.id} value={r.id}>{r.label}</option>)}
              </select>
              <button className="btn btn-primary btn-sm" onClick={() => setShowInvite(true)}><UserPlus size={12} /> Inviter</button>
            </div>
          </div>
          <div style={{ overflowX: 'auto' }}>
            <table className="tbl">
              <thead>
                <tr>
                  <th>Utilisateur</th>
                  <th>Direction</th>
                  <th>Profil / Poste occupé (DPE)</th>
                  <th>Accès</th>
                  <th>Statut</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredUsers.length === 0 && (
                  <tr>
                    <td colSpan={6} style={{ textAlign: 'center', padding: '32px 24px', color: 'var(--muted)', fontSize: 12 }}>
                      Aucun utilisateur trouvé pour ces critères. Modifiez les filtres ou invitez un collaborateur.
                    </td>
                  </tr>
                )}
                {filteredUsers.map(u => (
                  <tr key={u.id}>
                    <td>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <div style={{ width: 32, height: 32, borderRadius: '50%', background: 'var(--navy)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontSize: 11, fontWeight: 700, flexShrink: 0 }}>
                          {u.nom.split(' ').map(n => n[0]).join('').slice(0, 2)}
                        </div>
                        <div>
                          <div style={{ fontSize: 12, fontWeight: 600 }}>{u.nom}</div>
                          <div style={{ fontSize: 10, color: 'var(--muted)' }}>{u.email}</div>
                        </div>
                      </div>
                    </td>
                    <td><span className="pill pill-navy">{TENANTS.find(t => t.code === u.tenant)?.shortLabel ?? u.tenant}</span></td>
                    <td style={{ fontSize: 11.5, color: '#334155', maxWidth: 320 }}>{u.profil}</td>
                    <td><div style={{ display: 'flex', gap: 3, flexWrap: 'wrap' }}>{u.roles.map(r => pillRole(r))}</div></td>
                    <td>
                      {u.actif
                        ? <span className="pill pill-ok">Actif</span>
                        : <span className="pill pill-ko">Inactif</span>
                      }
                    </td>
                    <td>
                      <div style={{ display: 'flex', gap: 3 }}>
                        <button aria-label="Modifier l'utilisateur" className="btn btn-ghost btn-xs" title="Modifier" onClick={() => setEditUser(u)}><Edit2 size={10} /></button>
                        <button className="btn btn-danger btn-xs" title={u.actif ? 'Désactiver' : 'Réactiver'}
                          onClick={() => {
                            setUserEdits(prev => ({ ...prev, [u.id]: { ...prev[u.id], actif: !u.actif } }));
                            addNotification({ type: u.actif ? 'warning' : 'success', title: u.actif ? 'Utilisateur désactivé' : 'Utilisateur réactivé', message: u.nom });
                          }}>
                          {u.actif ? <Trash2 size={10} /> : <Check size={10} />}
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ── Modal d'édition d'un utilisateur ── */}
      {editUser && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(15,23,42,0.55)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }} onClick={() => setEditUser(null)}>
          <div className="card" style={{ width: 'min(560px, 100%)', maxHeight: '90vh', overflowY: 'auto' }} onClick={e => e.stopPropagation()}>
            <div className="card-header">
              <span className="card-title">Modifier l&apos;utilisateur</span>
              <button className="btn btn-ghost btn-sm" onClick={() => setEditUser(null)}><X size={12} /></button>
            </div>
            <div className="card-body" style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <div style={{ width: 40, height: 40, borderRadius: '50%', background: 'var(--navy)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontSize: 13, fontWeight: 700 }}>
                  {editUser.nom.split(' ').map(n => n[0]).join('').slice(0, 2)}
                </div>
                <div>
                  <div style={{ fontSize: 13, fontWeight: 700 }}>{editUser.nom}</div>
                  <div style={{ fontSize: 11, color: 'var(--muted)' }}>{editUser.email} · {editUser.tenant}</div>
                </div>
              </div>

              <div className="form-group" style={{ margin: 0 }}>
                <label className="form-label">Profil / Poste</label>
                <input className="form-input" value={editUser.profil} onChange={e => setEditUser(u => u ? { ...u, profil: e.target.value } : u)} />
              </div>

              <div className="form-group" style={{ margin: 0 }}>
                <label className="form-label">Statut</label>
                <button className="btn btn-sm" onClick={() => setEditUser(u => u ? { ...u, actif: !u.actif } : u)}
                  style={{ display: 'inline-flex', alignItems: 'center', gap: 6, background: editUser.actif ? '#DCFCE7' : '#FEE2E2', color: editUser.actif ? '#166534' : '#991B1B', border: '1px solid var(--border-2)' }}>
                  {editUser.actif ? <ToggleRight size={14} /> : <ToggleLeft size={14} />} {editUser.actif ? 'Actif' : 'Inactif'}
                </button>
              </div>

              <div className="form-group" style={{ margin: 0 }}>
                <label className="form-label">Rôles (matrice de permissions)</label>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                  {ROLE_ORDER.map(rc => {
                    const on = editUser.roles.includes(rc);
                    return (
                      <button key={rc} className="btn btn-sm"
                        onClick={() => setEditUser(u => u ? { ...u, roles: on ? u.roles.filter(r => r !== rc) : [...u.roles, rc] } : u)}
                        style={{ background: on ? 'var(--navy)' : 'var(--bg)', color: on ? '#fff' : 'var(--muted)', border: '1px solid var(--border-2)', fontSize: 10.5 }}>
                        {ROLES[rc]?.label ?? rc}
                      </button>
                    );
                  })}
                </div>
              </div>

              <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
                <button className="btn btn-ghost btn-sm" onClick={() => setEditUser(null)}>Annuler</button>
                <button className="btn btn-primary btn-sm" onClick={() => {
                  setUserEdits(prev => ({ ...prev, [editUser.id]: { actif: editUser.actif, roles: editUser.roles, profil: editUser.profil } }));
                  addNotification({ type: 'success', title: 'Utilisateur mis à jour', message: editUser.nom });
                  setEditUser(null);
                }}><Save size={12} /> Enregistrer</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── Invitations en attente ── */}
      {tab === 'utilisateurs' && pendingInvitations.length > 0 && (
        <div className="card">
          <div className="card-header">
            <span className="card-title">📬 Invitations en attente ({pendingInvitations.length})</span>
          </div>
          <div style={{ overflowX: 'auto' }}>
            <table className="tbl">
              <thead>
                <tr>
                  <th>Nom complet</th>
                  <th>Email</th>
                  <th>Rôle</th>
                  <th>Direction</th>
                  <th>Envoyée le</th>
                  <th>Action</th>
                </tr>
              </thead>
              <tbody>
                {pendingInvitations.map(inv => {
                  const r = ROLES_LIST.find(x => x.id === inv.role);
                  return (
                    <tr key={inv.id}>
                      <td style={{ fontWeight: 600 }}>{inv.prenom} {inv.nom}</td>
                      <td style={{ fontSize: 11, color: 'var(--muted)' }}>{inv.email}</td>
                      <td>{r && <span style={{ fontSize: 9, padding: '2px 6px', borderRadius: 99, background: r.color + '18', color: r.color, border: `1px solid ${r.color}33`, fontWeight: 700 }}>{r.label}</span>}</td>
                      <td style={{ fontSize: 11, color: 'var(--muted)' }}>{inv.direction}</td>
                      <td style={{ fontSize: 11 }}>{inv.sentAt}</td>
                      <td>
                        <button className="btn btn-danger btn-xs" onClick={() => setPendingInvitations(p => p.filter(x => x.id !== inv.id))}>
                          <X size={10} /> Révoquer
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ═══════════════════════════════════════════════════════════════
          TAB TENANTS
      ═══════════════════════════════════════════════════════════════ */}
      {tab === 'tenants' && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: 14 }}>
          {TENANTS.map(t => (
            <div key={t.id} className="card">
              <div className="card-header">
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  {/* Logo placeholder */}
                  <div style={{ width: 40, height: 40, borderRadius: 8, background: t.statut === 'actif' ? 'var(--navy)' : 'var(--border-2)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                    <span style={{ color: '#fff', fontSize: 11, fontWeight: 900, fontFamily: 'monospace' }}>{t.code.slice(0, 3)}</span>
                  </div>
                  <div>
                    <div className="card-title" style={{ textTransform: 'none', fontSize: 12 }}>{t.nom}</div>
                    <div style={{ fontSize: 10, color: 'var(--muted)' }}>Code : {t.code}</div>
                  </div>
                </div>
                {t.statut === 'actif' ? <span className="pill pill-ok">Actif</span> : <span className="pill pill-ko">Inactif</span>}
              </div>
              <div className="card-body">
                <div style={{ fontSize: 11, color: 'var(--muted)', marginBottom: 10 }}>{t.description}</div>
                <div style={{ display: 'flex', gap: 12, marginBottom: 10, fontSize: 11 }}>
                  <div style={{ textAlign: 'center' }}>
                    <div style={{ fontWeight: 700, fontSize: 18, color: 'var(--navy)' }}>{t.nbUtilisateurs}</div>
                    <div style={{ color: 'var(--muted)', fontSize: 10 }}>Utilisateurs</div>
                  </div>
                  <div style={{ textAlign: 'center' }}>
                    <div style={{ fontWeight: 700, fontSize: 18, color: 'var(--orange)' }}>{t.modules.length}</div>
                    <div style={{ color: 'var(--muted)', fontSize: 10 }}>Modules</div>
                  </div>
                </div>
                {/* Modules activés */}
                <div style={{ fontSize: 10, fontWeight: 600, color: 'var(--muted)', marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.06em' }}>Modules activés</div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                  {t.modules.map(m => <span key={m} className="pill pill-navy" style={{ fontSize: 9 }}>{m}</span>)}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* ═══════════════════════════════════════════════════════════════
          TAB RÔLES & PERMISSIONS
      ═══════════════════════════════════════════════════════════════ */}
      {tab === 'roles' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>

        {/* ── Périmètre par rôle : Direction affectée + Niveau de vue (configurable) ── */}
        <div className="card">
          <div className="card-header">
            <span className="card-title">Périmètre par rôle — Direction affectée & Niveau de vue</span>
            <span style={{ fontSize: 10, color: 'var(--muted)' }}>Définissez la direction de rattachement et l'étendue de visibilité de chaque rôle</span>
          </div>
          <div style={{ overflowX: 'auto' }}>
            <table className="tbl">
              <thead>
                <tr>
                  <th style={{ minWidth: 150 }}>Rôle</th>
                  <th style={{ minWidth: 230 }}>Direction / Coordination affectée</th>
                  <th style={{ minWidth: 220 }}>Niveau de vue</th>
                  <th style={{ minWidth: 80, textAlign: 'center' }}>Réinit.</th>
                </tr>
              </thead>
              <tbody>
                {ROLE_ORDER.map(rc => {
                  const sc = roleScopes[rc] ?? {};
                  const NIVEAUX = [
                    { v: '',  label: '— Défaut (selon organigramme) —' },
                    { v: '0', label: 'Niveau 0 — Tout voir (DPE/transverse)' },
                    { v: '1', label: 'Niveau 1 — Direction entière' },
                    { v: '2', label: 'Niveau 2 — Département (strict)' },
                    { v: '3', label: 'Niveau 3 — Agent (périmètre minimal)' },
                  ];
                  return (
                    <tr key={rc}>
                      <td>
                        <span style={{ padding: '2px 8px', borderRadius: 6, background: ROLES[rc].color + '18', color: ROLES[rc].color, fontSize: 11, fontWeight: 700 }}>{ROLES[rc].icon} {ROLES[rc].label}</span>
                      </td>
                      <td>
                        <select
                          className="form-input"
                          style={{ width: '100%', fontSize: 11.5 }}
                          value={sc.direction ?? ''}
                          onChange={e => { setRoleDirection(rc, e.target.value); addNotification({ type: 'success', title: 'Périmètre mis à jour', message: `${ROLES[rc].label} → ${e.target.value || 'direction par défaut'}` }); }}
                        >
                          <option value="">— Défaut (direction du compte) —</option>
                          {DPE_ORG.map(d => <option key={d.code} value={d.code}>{d.shortLabel} — {d.label}</option>)}
                        </select>
                      </td>
                      <td>
                        <select
                          className="form-input"
                          style={{ width: '100%', fontSize: 11.5 }}
                          value={sc.niveau != null ? String(sc.niveau) : ''}
                          onChange={e => { const v = e.target.value; setRoleNiveau(rc, v === '' ? null : (Number(v) as 0|1|2|3)); }}
                        >
                          {NIVEAUX.map(n => <option key={n.v} value={n.v}>{n.label}</option>)}
                        </select>
                      </td>
                      <td style={{ textAlign: 'center' }}>
                        {(sc.direction || sc.niveau != null || sectionOverrides[rc]) ? (
                          <button className="btn btn-ghost btn-xs" title="Réinitialiser ce rôle" onClick={() => { resetRoleScope(rc); addNotification({ type: 'info', title: 'Rôle réinitialisé', message: `${ROLES[rc].label} revient à la configuration par défaut.` }); }}>
                            <X size={11} />
                          </button>
                        ) : <span style={{ fontSize: 10, color: 'var(--muted)' }}>—</span>}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <div className="card-body" style={{ borderTop: '1px solid var(--border-2)', fontSize: 11, color: 'var(--muted)' }}>
            <Info size={11} style={{ display: 'inline', verticalAlign: -1, marginRight: 4 }} />
            Le <strong>niveau de vue</strong> détermine l'étendue des données : <strong>0</strong> = tout le portefeuille DPE,
            <strong> 1</strong> = toute la direction, <strong>2</strong> = uniquement le département de rattachement (isolation stricte —
            ex. DPD ne voit jamais Transport/Production/Commercial), <strong>3</strong> = périmètre agent.
          </div>
        </div>

        {/* ── Ce que voit chaque rôle (sections du menu — CONFIGURABLE) ── */}
        <div className="card">
          <div className="card-header">
            <span className="card-title">Modules / sections accessibles par rôle</span>
            <span style={{ fontSize: 10, color: 'var(--muted)' }}>Cliquez une case pour activer / désactiver une section pour ce rôle</span>
          </div>
          <div style={{ overflowX: 'auto' }}>
            <table className="tbl">
              <thead>
                <tr>
                  <th style={{ minWidth: 220 }}>Section du menu</th>
                  {ROLE_ORDER.map(rc => (
                    <th key={rc} style={{ textAlign: 'center', minWidth: 92 }}>
                      <span style={{ padding: '2px 6px', borderRadius: 4, background: ROLES[rc].color + '22', color: ROLES[rc].color, fontSize: 10, fontWeight: 700 }}>{ROLES[rc].icon} {ROLES[rc].label}</span>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {SECTION_ORDER.map(sec => (
                  <tr key={sec}>
                    <td style={{ fontWeight: 600, fontSize: 12 }}>{SECTION_LABELS[sec]}</td>
                    {ROLE_ORDER.map(rc => {
                      const on = effectiveSections(rc).includes(sec);
                      const isAdmin = rc === 'ADMIN';
                      return (
                        <td key={rc} style={{ textAlign: 'center' }}>
                          <button
                            disabled={isAdmin}
                            title={isAdmin ? 'Administrateur — accès complet (non modifiable)' : on ? 'Désactiver' : 'Activer'}
                            onClick={() => !isAdmin && toggleRoleSection(rc, sec)}
                            style={{ background: 'none', border: 'none', cursor: isAdmin ? 'default' : 'pointer', padding: 2, opacity: isAdmin ? 0.5 : 1 }}
                          >
                            {on
                              ? <Check size={14} style={{ color: 'var(--green)' }} />
                              : <X size={14} style={{ color: 'var(--border-2)' }} />}
                          </button>
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {/* Description des rôles réels */}
          <div className="card-body" style={{ borderTop: '1px solid var(--border-2)', display: 'flex', flexDirection: 'column', gap: 6 }}>
            {ROLE_ORDER.map(rc => (
              <div key={rc} style={{ display: 'flex', gap: 8, alignItems: 'flex-start', fontSize: 11.5 }}>
                <span style={{ flexShrink: 0, padding: '2px 8px', borderRadius: 6, background: ROLES[rc].color + '15', color: ROLES[rc].color, fontWeight: 700, minWidth: 150 }}>{ROLES[rc].icon} {ROLES[rc].label}</span>
                <span style={{ color: 'var(--muted)' }}>{ROLES[rc].description}</span>
              </div>
            ))}
          </div>
        </div>

        {/* ── Matrice fine Permissions × Profils applicatifs ── */}
        <div className="card">
          <div className="card-header">
            <span className="card-title">Matrice Permissions × Profils applicatifs</span>
            <span style={{ fontSize: 10, color: 'var(--muted)' }}>Lecture seule — contactez l'admin système pour modifier</span>
          </div>
          <div style={{ overflowX: 'auto' }}>
            <table className="tbl">
              <thead>
                <tr>
                  <th style={{ minWidth: 160 }}>Permission</th>
                  {ROLES_LIST.map(r => (
                    <th key={r.id} style={{ textAlign: 'center', minWidth: 80 }}>
                      <span style={{ padding: '2px 6px', borderRadius: 4, background: r.color + '22', color: r.color, fontSize: 10 }}>{r.label}</span>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {PERMISSIONS.map(p => (
                  <tr key={p.id}>
                    <td style={{ fontWeight: 600, fontSize: 12 }}>{p.label}</td>
                    {ROLES_LIST.filter(r => r.id !== 'ADMIN').map(r => ( // ADMIN has all, no need to show explicitly
                      <td key={r.id} style={{ textAlign: 'center' }}>
                        {MATRICE[r.id][p.id]
                          ? <Check size={14} style={{ color: 'var(--green)' }} />
                          : <X size={14} style={{ color: 'var(--border-2)' }} />
                        }
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {/* Légende rôles */}
          <div className="card-body" style={{ borderTop: '1px solid var(--border-2)' }}>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              {ROLES_LIST.map(r => (
                <div key={r.id} style={{ display: 'flex', gap: 6, alignItems: 'center', padding: '6px 10px', borderRadius: 8, background: r.color + '12', border: `1px solid ${r.color}22` }}>
                  <Key size={11} style={{ color: r.color }} />
                  <span style={{ fontSize: 11, fontWeight: 600, color: r.color }}>{r.label}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        </div>
      )}

      {/* ═══════════════════════════════════════════════════════════════
          TAB MODULES
      ═══════════════════════════════════════════════════════════════ */}
      {tab === 'modules' && (
        <div className="card">
          <div className="card-header">
            <span className="card-title">Modules ({MODULES_LIST.length})</span>
            <span style={{ fontSize: 10, color: 'var(--muted)' }}>Activation par tenant</span>
          </div>
          <div style={{ overflowX: 'auto' }}>
            <table className="tbl">
              <thead>
                <tr>
                  <th style={{ minWidth: 160 }}>Module</th>
                  <th style={{ minWidth: 220 }}>Description</th>
                  {TENANTS.slice(0, 7).map(t => (
                    <th key={t.id} style={{ textAlign: 'center', minWidth: 60 }}>{t.code}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {MODULES_LIST.map(m => (
                  <tr key={m.id}>
                    <td>
                      <div style={{ fontWeight: 700, fontSize: 12, color: 'var(--navy)' }}>{m.nom}</div>
                      <div style={{ fontSize: 9, color: 'var(--muted)', fontFamily: 'monospace' }}>{m.id}</div>
                    </td>
                    <td style={{ fontSize: 11 }}>{m.description}</td>
                    {TENANTS.slice(0, 7).map(t => {
                      const actif = moduleActif[m.id]?.[t.id] ?? false;
                      return (
                        <td key={t.id} style={{ textAlign: 'center' }}>
                          <button
                            onClick={() => toggleModule(m.id, t.id)}
                            style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 4 }}
                            title={actif ? 'Désactiver' : 'Activer'}
                          >
                            {actif
                              ? <ToggleRight size={18} style={{ color: 'var(--green)' }} />
                              : <ToggleLeft size={18} style={{ color: 'var(--border-2)' }} />
                            }
                          </button>
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ═══════════════════════════════════════════════════════════════
          TAB SÉCURITÉ
      ═══════════════════════════════════════════════════════════════ */}
      {tab === 'securite' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          {/* Sessions suspectes */}
          <div className="card">
            <div className="card-header">
              <span className="card-title">Connexions suspectes</span>
              <span className="pill pill-ko">0 alertes</span>
            </div>
            <div style={{ overflowX: 'auto' }}>
              <table className="tbl">
                <thead>
                  <tr>
                    <th>Utilisateur</th>
                    <th>Adresse IP</th>
                    <th>Date & Heure</th>
                    <th>Raison</th>
                    <th>Statut</th>
                    <th>Action</th>
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <td colSpan={6} style={{ textAlign: 'center', color: 'var(--muted)', padding: 24 }}>Aucune session suspecte détectée.</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>

          {/* Sessions actives */}
          <div className="card">
            <div className="card-header">
              <span className="card-title">Sessions actives en ce moment</span>
              <span style={{ fontSize: 11, color: 'var(--green)', fontWeight: 700 }}>● 7 connectés</span>
            </div>
            <div style={{ padding: '12px 16px', display: 'flex', flexDirection: 'column', gap: 8 }}>
              {UTILISATEURS.filter(u => u.actif).slice(0, 6).map(u => (
                <div key={u.id} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '8px 10px', background: 'var(--bg)', borderRadius: 8, border: '1px solid var(--border-2)' }}>
                  <div style={{ width: 8, height: 8, borderRadius: '50%', background: 'var(--green)', flexShrink: 0 }} />
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 12, fontWeight: 600 }}>{u.nom}</div>
                    <div style={{ fontSize: 10, color: 'var(--muted)' }}>{u.email} · {u.tenant}</div>
                  </div>
                  <div style={{ fontSize: 10, color: 'var(--muted)' }}>{u.dernierLogin}</div>
                  <button className="btn btn-danger btn-xs" onClick={() => addNotification({ type: 'info', title: 'Déconnexion forcée', message: `Session de ${u.nom} révoquée.` })}>Déconnecter</button>
                </div>
              ))}
            </div>
          </div>

          {/* Politique mots de passe — CONFIGURABLE */}
          <div className="card">
            <div className="card-header">
              <div>
                <span className="card-title">Politique de mots de passe</span>
                <div style={{ fontSize: 11, color: 'var(--muted)', marginTop: 2 }}>Règles de sécurité d&apos;accès — configurables sans recompilation</div>
              </div>
              <button className="btn btn-ghost btn-sm" onClick={() => { resetPwdPolicy(); addNotification({ type: 'info', title: 'Politique réinitialisée', message: 'Les valeurs par défaut ont été restaurées.' }); }}>
                <X size={11} /> Réinitialiser
              </button>
            </div>
            <div className="card-body">
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: 14 }}>
                {/* Longueur minimale */}
                <div style={{ padding: '12px 14px', background: 'var(--bg)', borderRadius: 8, border: '1px solid var(--border-2)' }}>
                  <label style={{ fontSize: 10, color: 'var(--muted)', display: 'block', marginBottom: 6, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em' }}>Longueur minimale</label>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <input
                      type="number" min={4} max={64}
                      className="form-input" style={{ width: 80 }}
                      value={pwdPolicy.minLength}
                      onChange={e => setPwdPolicy({ minLength: Math.max(4, Math.min(64, Number(e.target.value) || 8)) })}
                    />
                    <span style={{ fontSize: 12, color: 'var(--muted)' }}>caractères</span>
                  </div>
                </div>

                {/* Verrouillage après N tentatives */}
                <div style={{ padding: '12px 14px', background: 'var(--bg)', borderRadius: 8, border: '1px solid var(--border-2)' }}>
                  <label style={{ fontSize: 10, color: 'var(--muted)', display: 'block', marginBottom: 6, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em' }}>Verrouillage après</label>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <input
                      type="number" min={1} max={20}
                      className="form-input" style={{ width: 80 }}
                      value={pwdPolicy.maxFailedAttempts}
                      onChange={e => setPwdPolicy({ maxFailedAttempts: Math.max(1, Math.min(20, Number(e.target.value) || 3)) })}
                    />
                    <span style={{ fontSize: 12, color: 'var(--muted)' }}>tentatives</span>
                  </div>
                </div>

                {/* Durée verrouillage */}
                <div style={{ padding: '12px 14px', background: 'var(--bg)', borderRadius: 8, border: '1px solid var(--border-2)' }}>
                  <label style={{ fontSize: 10, color: 'var(--muted)', display: 'block', marginBottom: 6, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em' }}>Durée du verrouillage</label>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <input
                      type="number" min={1} max={1440}
                      className="form-input" style={{ width: 80 }}
                      value={pwdPolicy.lockoutMinutes}
                      onChange={e => setPwdPolicy({ lockoutMinutes: Math.max(1, Math.min(1440, Number(e.target.value) || 15)) })}
                    />
                    <span style={{ fontSize: 12, color: 'var(--muted)' }}>minutes</span>
                  </div>
                </div>

                {/* Expiration */}
                <div style={{ padding: '12px 14px', background: 'var(--bg)', borderRadius: 8, border: '1px solid var(--border-2)' }}>
                  <label style={{ fontSize: 10, color: 'var(--muted)', display: 'block', marginBottom: 6, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em' }}>Réinitialisation périodique</label>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <input
                      type="number" min={0} max={36}
                      className="form-input" style={{ width: 80 }}
                      value={pwdPolicy.expiryMonths}
                      onChange={e => setPwdPolicy({ expiryMonths: Math.max(0, Math.min(36, Number(e.target.value) || 6)) })}
                    />
                    <span style={{ fontSize: 12, color: 'var(--muted)' }}>mois {pwdPolicy.expiryMonths === 0 && '(désactivé)'}</span>
                  </div>
                </div>

                {/* Historique */}
                <div style={{ padding: '12px 14px', background: 'var(--bg)', borderRadius: 8, border: '1px solid var(--border-2)' }}>
                  <label style={{ fontSize: 10, color: 'var(--muted)', display: 'block', marginBottom: 6, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em' }}>Historique interdit</label>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <input
                      type="number" min={0} max={24}
                      className="form-input" style={{ width: 80 }}
                      value={pwdPolicy.historyCount}
                      onChange={e => setPwdPolicy({ historyCount: Math.max(0, Math.min(24, Number(e.target.value) || 3)) })}
                    />
                    <span style={{ fontSize: 12, color: 'var(--muted)' }}>derniers mdp</span>
                  </div>
                </div>
              </div>

              {/* Complexité — exigences optionnelles */}
              <div style={{ marginTop: 16 }}>
                <div style={{ fontSize: 11, color: 'var(--muted)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 8 }}>Exigences de complexité</div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                  {([
                    { key: 'requireUppercase', label: 'Majuscule (A-Z)' },
                    { key: 'requireLowercase', label: 'Minuscule (a-z)' },
                    { key: 'requireDigit', label: 'Chiffre (0-9)' },
                    { key: 'requireSpecial', label: 'Caractère spécial' },
                  ] as const).map(({ key, label }) => {
                    const on = pwdPolicy[key];
                    return (
                      <button
                        key={key}
                        onClick={() => setPwdPolicy({ [key]: !on })}
                        className="btn btn-sm"
                        style={{
                          background: on ? 'var(--navy)' : 'var(--bg)',
                          color: on ? '#fff' : 'var(--muted)',
                          border: '1px solid var(--border-2)',
                          display: 'inline-flex', alignItems: 'center', gap: 6,
                        }}
                      >
                        {on ? <ToggleRight size={14} /> : <ToggleLeft size={14} />} {label}
                      </button>
                    );
                  })}
                </div>
              </div>

              <div style={{ marginTop: 14, padding: '10px 12px', background: '#F0F9FF', borderRadius: 8, border: '1px solid #BAE6FD', fontSize: 11, color: '#075985', display: 'flex', gap: 8, alignItems: 'flex-start' }}>
                <Info size={14} style={{ flexShrink: 0, marginTop: 1 }} />
                <span>Ces règles s&apos;appliquent immédiatement à la connexion : longueur minimale exigée, verrouillage après {pwdPolicy.maxFailedAttempts} tentative(s) pendant {pwdPolicy.lockoutMinutes} min, réinitialisation obligatoire {pwdPolicy.expiryMonths > 0 ? `tous les ${pwdPolicy.expiryMonths} mois` : 'désactivée'}, et interdiction de réutiliser les {pwdPolicy.historyCount} derniers mots de passe.</span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ═══════════════════════════════════════════════════════════════
          TAB TERRAIN — Structure des phases & canevas de saisie (par type/domaine)
      ═══════════════════════════════════════════════════════════════ */}
      {tab === 'terrain' && (() => {
        const types = Object.values(terrainTemplates).sort((a, b) =>
          a.domaine === b.domaine ? a.label.localeCompare(b.label) : a.domaine.localeCompare(b.domaine));
        const selType = terrainSelType && terrainTemplates[terrainSelType] ? terrainSelType : (types[0]?.type ?? '');
        const tpl = terrainTemplates[selType];
        const sumPoids = tpl ? tpl.phases.reduce((s, p) => s + p.poids, 0) : 0;
        const UNITES_T: { value: TerrainIndUnite; label: string }[] = [
          { value: 'pct', label: '%' }, { value: 'km', label: 'km' }, { value: 'nombre', label: 'nombre' }, { value: 'unite', label: 'unité' }, { value: 'ml', label: 'ml' },
        ];
        return (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <div className="card">
              <div className="card-header">
                <div>
                  <span className="card-title">Phases & canevas de saisie terrain</span>
                  <div style={{ fontSize: 11, color: 'var(--muted)', marginTop: 2 }}>Structure des phases (pondération) + indicateurs physiques, par type de projet & domaine — appliqués au formulaire terrain</div>
                </div>
                <button className="btn btn-ghost btn-sm" onClick={() => { resetTerrainConfig(); addNotification({ type: 'info', title: 'Canevas réinitialisés', message: 'Les modèles terrain ont été restaurés (valeurs par défaut).' }); }}>
                  <X size={11} /> Réinitialiser
                </button>
              </div>
              <div className="card-body">
                {/* Sélecteur de type/domaine */}
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 14 }}>
                  {types.map(t => (
                    <button key={t.type} onClick={() => setTerrainSelType(t.type)} className="btn btn-sm"
                      style={{ background: t.type === selType ? 'var(--navy)' : 'var(--bg)', color: t.type === selType ? '#fff' : 'var(--muted)', border: '1px solid var(--border-2)' }}>
                      {t.label} <span style={{ opacity: 0.7, fontSize: 10 }}>· {t.domaine}</span>
                    </button>
                  ))}
                </div>

                {tpl && (
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: 16 }}>
                    {/* Pondération des phases */}
                    <div>
                      <div style={{ fontSize: 12, fontWeight: 800, color: 'var(--navy)', marginBottom: 8 }}>Structure des phases — pondération (%)</div>
                      {tpl.phases.map(ph => (
                        <div key={ph.key} style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
                          <span style={{ flex: 1, fontSize: 12, color: 'var(--ink)' }}>{ph.label}</span>
                          <input type="number" min={0} max={100} value={ph.poids}
                            onChange={e => setPhaseWeight(selType, ph.key, Number(e.target.value) || 0)}
                            className="form-input" style={{ width: 80 }} />
                          <span style={{ fontSize: 11, color: 'var(--muted)' }}>%</span>
                        </div>
                      ))}
                      <div style={{ marginTop: 8, padding: '8px 12px', borderRadius: 8, fontSize: 12, fontWeight: 700,
                        background: sumPoids === 100 ? '#DCFCE7' : '#FEF3C7', color: sumPoids === 100 ? '#166534' : '#92400E' }}>
                        Somme des pondérations : {sumPoids}% {sumPoids !== 100 && '— ajustez pour atteindre 100%'}
                      </div>
                    </div>

                    {/* Indicateurs physiques */}
                    <div>
                      <div style={{ fontSize: 12, fontWeight: 800, color: 'var(--navy)', marginBottom: 8 }}>Indicateurs physiques du formulaire</div>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginBottom: 12 }}>
                        {tpl.indicateurs.map(ind => (
                          <div key={ind.key} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '6px 10px', background: 'var(--bg)', borderRadius: 8, border: '1px solid var(--border-2)' }}>
                            <span style={{ flex: 1, fontSize: 12, color: 'var(--ink)' }}>{ind.label}</span>
                            <span style={{ fontSize: 10, color: 'var(--muted)', fontWeight: 600 }}>{ind.unite} · {tpl.phases.find(p => p.key === ind.phase)?.label ?? ind.phase}</span>
                            <button onClick={() => removeTerrainIndic(selType, ind.key)} title="Supprimer" className="btn btn-danger btn-xs"><Trash2 size={11} /></button>
                          </div>
                        ))}
                        {tpl.indicateurs.length === 0 && <div style={{ fontSize: 11, color: 'var(--muted)', fontStyle: 'italic' }}>Aucun indicateur.</div>}
                      </div>

                      {/* Ajout d'un indicateur */}
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 90px 1fr auto', gap: 6, alignItems: 'end' }}>
                        <div className="form-group" style={{ margin: 0 }}>
                          <label className="form-label" style={{ fontSize: 10 }}>Nouvel indicateur</label>
                          <input className="form-input" value={newTIndLabel} onChange={e => setNewTIndLabel(e.target.value)} placeholder="ex. Poteaux posés (nb)" />
                        </div>
                        <div className="form-group" style={{ margin: 0 }}>
                          <label className="form-label" style={{ fontSize: 10 }}>Unité</label>
                          <select className="form-input" value={newTIndUnite} onChange={e => setNewTIndUnite(e.target.value as TerrainIndUnite)}>
                            {UNITES_T.map(u => <option key={u.value} value={u.value}>{u.label}</option>)}
                          </select>
                        </div>
                        <div className="form-group" style={{ margin: 0 }}>
                          <label className="form-label" style={{ fontSize: 10 }}>Phase</label>
                          <select className="form-input" value={newTIndPhase} onChange={e => setNewTIndPhase(e.target.value as TerrainPhaseKey)}>
                            {tpl.phases.map(ph => <option key={ph.key} value={ph.key}>{ph.label}</option>)}
                          </select>
                        </div>
                        <button className="btn btn-primary btn-sm" disabled={!newTIndLabel.trim()}
                          onClick={() => { addTerrainIndic(selType, newTIndLabel, newTIndUnite, newTIndPhase); setNewTIndLabel(''); }}>
                          <Plus size={12} /> Ajouter
                        </button>
                      </div>
                    </div>
                  </div>
                )}

                <div style={{ marginTop: 16, padding: '10px 12px', background: '#F0F9FF', borderRadius: 8, border: '1px solid #BAE6FD', fontSize: 11, color: '#075985', display: 'flex', gap: 8, alignItems: 'flex-start' }}>
                  <Info size={14} style={{ flexShrink: 0, marginTop: 1 }} />
                  <span>Ces canevas alimentent la <b>Saisie Terrain</b> (phases pondérées + indicateurs). Chaque chef de projet peut en plus <b>personnaliser le canevas d&apos;un projet précis</b> directement dans la saisie. La saisie n&apos;est plus mensuelle : elle se fait à <b>chaque visite</b> (date réelle).</span>
                </div>
              </div>
            </div>
          </div>
        );
      })()}

      {/* ═══════════════════════════════════════════════════════════════
          TAB CALCULS (Calculated Fields)
      ═══════════════════════════════════════════════════════════════ */}
      {tab === 'calculs' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <CalculBuilder />
          <div className="card">
            <div className="card-header">
              <div>
                <span className="card-title">Champs calculés & Formules Métier</span>
                <div style={{ fontSize: 11, color: 'var(--muted)', marginTop: 2 }}>Définissez les formules de KPIs transversales utilisant les métriques du store</div>
              </div>
              <button className="btn btn-primary btn-sm" onClick={() => { setEditingCFId(null); setCFForm({ nom: '', code: '', formule: '', unite: '', description: '', statut: 'test' }); setCfValidationMessage(null); setShowCFForm(true); }}><Plus size={12} /> Ajouter une formule</button>
            </div>
            
            {showCFForm && (
              <div className="card-body" style={{ background: '#F8FAFC', borderBottom: '1px solid #E2E8F0', padding: 20 }}>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12, marginBottom: 12 }}>
                  <div className="form-group">
                    <label className="form-label">Nom de l&apos;indicateur</label>
                    <input className="form-input" value={cfForm.nom} onChange={e => setCFForm({...cfForm, nom: e.target.value})} placeholder="ex: Taux de rentabilité..." />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Code variable</label>
                    <input className="form-input" value={cfForm.code} onChange={e => setCFForm({...cfForm, code: e.target.value})} placeholder="KPI_NOM_CODE" />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Unité de mesure</label>
                    <input className="form-input" value={cfForm.unite} onChange={e => setCFForm({...cfForm, unite: e.target.value})} placeholder="%, pts, FCFA..." />
                  </div>
                </div>
                <div className="form-group">
                  <label className="form-label">Formule (Syntaxe SQL/JS)</label>
                  <div style={{ display: 'flex', gap: 8 }}>
                    <input className="form-input" style={{ flex: 1, fontFamily: 'monospace' }} value={cfForm.formule} onChange={e => {
                      setCFForm({...cfForm, formule: e.target.value});
                      setCfValidationMessage(null);
                      // Live validation as user types
                      const result = validateFormula(e.target.value, cfForm.code, calculatedFields);
                      if (!result.isValid) {
                        setCfValidationMessage({ type: 'error', message: result.message });
                      } else if (e.target.value.trim()) { // Only show success if not empty
                        setCfValidationMessage({ type: 'info', message: 'Formule en cours de saisie...' });
                      }
                    }} placeholder="(budgetDecaisse / budgetEngage) * 100" />
                    <button className="btn btn-ghost btn-sm" title="Vérifier la syntaxe" onClick={() => {
                      const result = validateFormula(cfForm.formule, cfForm.code, calculatedFields);
                      setCfValidationMessage({ type: result.isValid ? 'success' : 'error', message: result.message });
                    }}><Calculator size={14} /></button>
                  </div>
                  <div style={{ display: 'flex', gap: 6, marginTop: 6 }}>
                    {['budget', 'budgetEngage', 'budgetDecaisse', 'avancement', 'cpi', 'spi'].map(m => (
                      <button key={m} onClick={() => setCFForm({...cfForm, formule: cfForm.formule + m})} style={{ fontSize: 9, padding: '2px 6px', background: '#fff', border: '1px solid #E2E8F0', borderRadius: 4, cursor: 'pointer' }}>{m}</button>
                    ))}
                  </div>
                  {cfValidationMessage && (
                    <div style={{ fontSize: 11, marginTop: 8, padding: '6px 10px', borderRadius: 6, border: `1px solid ${cfValidationMessage.type === 'error' ? '#EF4444' : '#16A34A'}`, background: cfValidationMessage.type === 'error' ? '#FEF2F2' : '#F0FDF4', color: cfValidationMessage.type === 'error' ? '#991B1B' : '#166534' }}>
                      {cfValidationMessage.message}
                    </div>
                  )}
                </div>
                <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 16 }}>
                  <button className="btn btn-ghost btn-sm" onClick={() => { setShowCFForm(false); setEditingCFId(null); setCfValidationMessage(null); }}>Annuler</button>
                  <button className="btn btn-primary btn-sm" onClick={() => {
                    const others = editingCFId ? calculatedFields.filter(x => x.id !== editingCFId) : calculatedFields;
                    const result = validateFormula(cfForm.formule, cfForm.code, others);
                    if (!result.isValid || !cfForm.nom.trim() || !cfForm.code.trim() || !cfForm.unite.trim()) {
                      setCfValidationMessage({ type: 'error', message: result.message });
                      addNotification({ type: 'error', title: 'Erreur de formule', message: result.message });
                      return;
                    }
                    if (editingCFId) {
                      setCalculatedFields(prev => prev.map(x => x.id === editingCFId ? { ...cfForm, id: editingCFId } : x));
                      addNotification({ type: 'success', title: 'Formule mise à jour', message: `Le champ calculé "${cfForm.nom}" a été modifié.` });
                    } else {
                      setCalculatedFields([...calculatedFields, {...cfForm, id: `cf${Date.now()}`}]);
                      addNotification({ type: 'success', title: 'Formule enregistrée', message: `Le champ calculé "${cfForm.nom}" a été ajouté.` });
                    }
                    setShowCFForm(false); setEditingCFId(null);
                  }}><Save size={12} /> {editingCFId ? 'Mettre à jour' : 'Enregistrer la formule'}</button>
                </div>
              </div>
            )}

            <div style={{ overflowX: 'auto' }}>
              <table className="tbl">
                <thead>
                  <tr>
                    <th>Indicateur</th>
                    <th>Code / Variable</th>
                    <th>Formule de calcul</th>
                    <th>Unité</th>
                    <th>Statut</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {calculatedFields.map(f => (
                    <tr key={f.id}>
                      <td>
                        <div style={{ fontWeight: 700, color: 'var(--navy)' }}>{f.nom}</div>
                        <div style={{ fontSize: 10, color: 'var(--muted)' }}>{f.description}</div>
                      </td>
                      <td><code style={{ fontSize: 10, background: '#F1F5F9', padding: '2px 6px', borderRadius: 4 }}>{f.code}</code></td>
                      <td><code style={{ fontSize: 11, color: '#0369A1' }}>{f.formule}</code></td>
                      <td><span className="pill pill-navy">{f.unite}</span></td>
                      <td>
                        <span className={`pill ${f.statut === 'actif' ? 'pill-ok' : 'pill-warn'}`}>
                          {f.statut === 'actif' ? 'Production' : 'En test'}
                        </span>
                      </td>
                      <td>
                        <div style={{ display: 'flex', gap: 4 }}>
                          <button aria-label={`Modifier la formule ${f.nom}`} className="btn btn-ghost btn-xs" onClick={() => { setEditingCFId(f.id); setCFForm({ nom: f.nom, code: f.code, formule: f.formule, unite: f.unite, description: f.description, statut: f.statut }); setShowCFForm(true); setCfValidationMessage(null); }}><Edit2 size={10} /></button>
                          <button aria-label={`Supprimer la formule ${f.nom}`} className="btn btn-ghost btn-xs" onClick={() => setCalculatedFields(prev => prev.filter(x => x.id !== f.id))}><Trash2 size={10} /></button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <div style={{ padding: '14px 18px', background: '#FFF7ED', border: '1px solid #FED7AA', borderRadius: 12, display: 'flex', gap: 12 }}>
            <Info size={20} color="#D97706" />
            <div>
              <div style={{ fontSize: 13, fontWeight: 700, color: '#92400E' }}>Gouvernance des calculs</div>
              <div style={{ fontSize: 11.5, color: '#92400E', marginTop: 3, lineHeight: 1.5 }}>
                Les champs calculés définis ici sont injectés dynamiquement dans le store global. Ils peuvent être utilisés dans le <strong>Dashboard Builder</strong> et le module <strong>Analytique</strong>. La modification d&apos;une formule entraîne le recalcul instantané de tous les rapports rattachés.
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ═══════════════════════════════════════════════════════════════
          TAB CRITÈRES & SCORING (priorisation projets + notation fournisseurs)
      ═══════════════════════════════════════════════════════════════ */}
      {tab === 'criteres' && <CriteresGouvernance />}

      {/* ═══════════════════════════════════════════════════════════════
          TAB DASHBOARD BUILDER
      ═══════════════════════════════════════════════════════════════ */}
      {tab === 'dashboard_builder' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div className="card">
            <div className="card-header">
              <div>
                <span className="card-title">Tableaux de bord personnalisés</span>
                <div style={{ fontSize: 11, color: 'var(--muted)', marginTop: 2 }}>Créez et gérez des tableaux de bord sur mesure pour différents besoins</div>
              </div>
              <button className="btn btn-primary btn-sm" onClick={() => { setShowDashboardForm(true); setDashboardForm({ name: '', description: '' }); }}><Plus size={12} /> Nouveau Dashboard</button>
            </div>

            {showDashboardForm && (
              <div className="card-body" style={{ background: '#F8FAFC', borderBottom: '1px solid #E2E8F0', padding: 20 }}>
                <div className="form-group">
                  <label className="form-label">Nom du Dashboard</label>
                  <input className="form-input" value={dashboardForm.name} onChange={e => setDashboardForm({...dashboardForm, name: e.target.value})} placeholder="ex: Suivi Mensuel DPE" />
                </div>
                <div className="form-group">
                  <label className="form-label">Description</label>
                  <textarea className="form-input" value={dashboardForm.description} onChange={e => setDashboardForm({...dashboardForm, description: e.target.value})} placeholder="Décrivez l'objectif de ce tableau de bord" rows={2} />
                </div>
                <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 16 }}>
                  <button className="btn btn-ghost btn-sm" onClick={() => setShowDashboardForm(false)}>Annuler</button>
                  <button className="btn btn-primary btn-sm" onClick={() => {
                    const newDashboard: CustomDashboard = {
                      id: `cd${Date.now()}`,
                      name: dashboardForm.name,
                      description: dashboardForm.description,
                      widgets: [],
                      createdAt: new Date().toISOString().split('T')[0],
                      lastModified: new Date().toISOString().split('T')[0],
                    };
                    setCustomDashboards([...customDashboards, newDashboard]);
                    setShowDashboardForm(false);
                    setDashboardForm({ name: '', description: '' });
                    addNotification({ type: 'success', title: 'Dashboard créé', message: `Le dashboard "${newDashboard.name}" a été créé.` });
                  }}>
                    <Save size={12} /> Créer Dashboard
                  </button>
                </div>
              </div>
            )}

            <div style={{ overflowX: 'auto' }}>
              <table className="tbl">
                <thead>
                  <tr>
                    <th>Dashboard</th>
                    <th>Description</th>
                    <th>Widgets</th>
                    <th>Créé le</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {customDashboards.map(db => (
                    <tr key={db.id}>
                      <td>
                        <div style={{ fontWeight: 700, color: 'var(--navy)' }}>{db.name}</div>
                      </td>
                      <td>{db.description}</td>
                      <td>{db.widgets.length}</td>
                      <td>{db.createdAt}</td>
                      <td>
                        <div style={{ display: 'flex', gap: 4 }}>
                          <button className="btn btn-ghost btn-xs" onClick={() => setSelectedDashboard(db)}><Edit2 size={10} /> Configurer</button>
                          <button className="btn btn-ghost btn-xs" onClick={() => addNotification({ type: 'info', title: 'Aperçu dashboard', message: `Le rendu de « ${db.name} » sera disponible après déploiement du moteur de widgets.` })}><Eye size={10} /> Voir</button>
                          <button className="btn btn-ghost btn-xs" onClick={() => {
                            setCustomDashboards(prev => prev.filter(x => x.id !== db.id));
                            addNotification({ type: 'info', title: 'Dashboard supprimé', message: `Le dashboard "${db.name}" a été supprimé.` });
                          }}><Trash2 size={10} /></button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {selectedDashboard && (
            <div className="card">
              <div className="card-header">
                <div>
                  <span className="card-title">Widgets pour "{selectedDashboard.name}"</span>
                  <div style={{ fontSize: 11, color: 'var(--muted)', marginTop: 2 }}>Ajoutez des cartes, graphiques ou tableaux à ce dashboard</div>
                </div>
                <button className="btn btn-primary btn-sm" onClick={() => { setEditingWidgetId(null); setWidgetForm({ type: 'kpi_card', title: '', config: {} }); setShowWidgetForm(true); }}><Plus size={12} /> Ajouter Widget</button>
              </div>

              {showWidgetForm && (
                <div className="card-body" style={{ background: '#F8FAFC', borderBottom: '1px solid #E2E8F0', padding: 20 }}>
                  <div className="form-group">
                    <label className="form-label">Titre du Widget</label>
                    <input className="form-input" value={widgetForm.title} onChange={e => setWidgetForm({...widgetForm, title: e.target.value})} placeholder="ex: Avancement Global" />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Type de Widget</label>
                    <select className="form-input" value={widgetForm.type} onChange={e => setWidgetForm({...widgetForm, type: e.target.value as DashboardWidget['type']})}>
                      <option value="kpi_card">Carte KPI</option>
                      <option value="bar_chart">Graphique à barres</option>
                      <option value="pie_chart">Graphique circulaire</option>
                      <option value="project_table">Tableau de projets</option>
                    </select>
                  </div>
                  {/* Simplified config for now */}
                  <div className="form-group">
                    <label className="form-label">Configuration (JSON)</label>
                    <textarea className="form-input" value={JSON.stringify(widgetForm.config, null, 2)} onChange={e => { try { setWidgetForm({...widgetForm, config: JSON.parse(e.target.value)}); } catch {} }} rows={4} placeholder="{ &quot;kpiCode&quot;: &quot;totalProjets&quot; }" />
                  </div>
                  <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 16 }}>
                    <button className="btn btn-ghost btn-sm" onClick={() => { setShowWidgetForm(false); setEditingWidgetId(null); }}>Annuler</button>
                    <button className="btn btn-primary btn-sm" onClick={() => {
                      if (editingWidgetId) {
                        const updated: DashboardWidget = { ...widgetForm, id: editingWidgetId };
                        setSelectedDashboard(prev => prev ? { ...prev, widgets: prev.widgets.map(x => x.id === editingWidgetId ? updated : x) } : null);
                        setCustomDashboards(prev => prev.map(db => db.id === selectedDashboard.id ? { ...db, widgets: db.widgets.map(x => x.id === editingWidgetId ? updated : x) } : db));
                        addNotification({ type: 'success', title: 'Widget modifié', message: `Le widget "${updated.title}" a été mis à jour.` });
                      } else {
                        const newWidget: DashboardWidget = { ...widgetForm, id: `w${Date.now()}` };
                        setSelectedDashboard(prev => prev ? { ...prev, widgets: [...prev.widgets, newWidget] } : null);
                        setCustomDashboards(prev => prev.map(db => db.id === selectedDashboard.id ? { ...db, widgets: [...db.widgets, newWidget] } : db));
                        addNotification({ type: 'success', title: 'Widget ajouté', message: `Le widget "${newWidget.title}" a été ajouté au dashboard.` });
                      }
                      setShowWidgetForm(false);
                      setEditingWidgetId(null);
                      setWidgetForm({ type: 'kpi_card', title: '', config: {} });
                    }}>
                      <PlusCircle size={12} /> {editingWidgetId ? 'Mettre à jour' : 'Ajouter Widget'}
                    </button>
                  </div>
                </div>
              )}

              {/* List of widgets */}
              <div className="card-body">
                {selectedDashboard.widgets.length === 0 ? (
                  <div style={{ textAlign: 'center', padding: '20px 0', color: 'var(--muted)' }}>Aucun widget ajouté.</div>
                ) : (
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(250px, 1fr))', gap: 12 }}>
                    {selectedDashboard.widgets.map(w => (
                      <div key={w.id} style={{ border: '1px solid var(--border)', borderRadius: 8, padding: 12, background: 'var(--bg-secondary)' }}>
                        <div style={{ fontWeight: 700, color: 'var(--navy)', marginBottom: 4 }}>{w.title}</div>
                        <div style={{ fontSize: 11, color: 'var(--muted)' }}>Type: {w.type}</div>
                        <div style={{ fontSize: 10, color: 'var(--muted)', marginTop: 4 }}>Config: {JSON.stringify(w.config)}</div>
                        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 4, marginTop: 8 }}>
                          <button aria-label={`Modifier le widget ${w.title}`} className="btn btn-ghost btn-xs" title="Modifier" onClick={() => { setEditingWidgetId(w.id); setWidgetForm({ type: w.type, title: w.title, config: w.config }); setShowWidgetForm(true); }}><Edit2 size={10} /></button>
                          <button aria-label={`Supprimer le widget ${w.title}`} className="btn btn-ghost btn-xs" onClick={() => {
                            setSelectedDashboard(prev => prev ? { ...prev, widgets: prev.widgets.filter(x => x.id !== w.id) } : null);
                            setCustomDashboards(prev => prev.map(db => db.id === selectedDashboard.id ? { ...db, widgets: db.widgets.filter(x => x.id !== w.id) } : db));
                            addNotification({ type: 'info', title: 'Widget supprimé', message: `Le widget "${w.title}" a été supprimé.` });
                          }}><Trash2 size={10} /></button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      )}

      {tab === 'integrations' && (
        <div className="card">
          <div className="card-header">
            <span className="card-title">🌐 Intégrations externes</span>
          </div>
          <div className="card-body" style={{ display: 'flex', flexDirection: 'column', gap: 28 }}>
            <ArcGISConfigPanel />
            <div style={{ height: 1, background: 'var(--border)' }} />
            <CopilotConfigPanel />
          </div>
        </div>
      )}

      {tab === 'alertes' && <AlertesConfigPanel />}
      {tab === 'audit' && <JournalAuditPanel />}

      {showInvite && <InviterModal onClose={() => setShowInvite(false)} onSend={inv => setPendingInvitations(p => [...p, inv])} />}
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════════
   JOURNAL D'AUDIT — CCF MVP · ADM-03
   « date · heure · utilisateur · action · objet concerné · export CSV »
═══════════════════════════════════════════════════════════════════════ */
function JournalAuditPanel() {
  const entries = useAuditStore(s => s.entries);
  const [q, setQ] = useState('');
  const [type, setType] = useState<string>('tous');
  const TYPES = ['tous', 'connexion', 'projet', 'document', 'workflow', 'planning', 'finance', 'administration', 'export', 'sig', 'autre'];
  const TYPE_COLOR: Record<string, string> = {
    connexion: '#0E7490', projet: '#1B4F8A', document: '#7C3AED', workflow: '#16A34A',
    planning: '#D97706', finance: '#B45309', administration: '#475569', export: '#0891B2', sig: '#059669', autre: '#64748B',
  };
  const filtered = entries.filter(e =>
    (type === 'tous' || e.type === type) &&
    (!q || `${e.utilisateur} ${e.action} ${e.objet} ${e.detail ?? ''} ${e.email ?? ''}`.toLowerCase().includes(q.toLowerCase())),
  );
  const exportCSV = () => {
    const csv = auditToCSV(filtered);
    const blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = `journal_audit_sigepp_${new Date().toISOString().slice(0, 10)}.csv`;
    a.click(); URL.revokeObjectURL(url);
  };
  return (
    <div className="card">
      <div className="card-header" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 8 }}>
        <span className="card-title">📋 Journal d&apos;audit — {filtered.length} événement(s)</span>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
          <input className="form-input" style={{ width: 200 }} placeholder="Rechercher (utilisateur, action, objet…)" value={q} onChange={e => setQ(e.target.value)} />
          <select className="form-input" style={{ width: 'auto' }} value={type} onChange={e => setType(e.target.value)}>
            {TYPES.map(t => <option key={t} value={t}>{t === 'tous' ? 'Tous les types' : t}</option>)}
          </select>
          <button className="btn btn-navy btn-sm" onClick={exportCSV} disabled={!filtered.length}>⬇ Export CSV</button>
        </div>
      </div>
      <div style={{ padding: '8px 14px 4px', fontSize: 11.5, color: '#64748B' }}>
        Traçabilité inaltérable (append-only) de toutes les actions — conforme au CCF MVP (ADM-03). Aucune entrée ne peut être supprimée.
      </div>
      <div style={{ overflowX: 'auto', padding: '0 0 12px' }}>
        <table className="tbl">
          <thead>
            <tr><th>Date</th><th>Heure</th><th>Utilisateur</th><th>Rôle</th><th>Type</th><th>Action</th><th>Objet</th><th>Détail</th></tr>
          </thead>
          <tbody>
            {filtered.length === 0 ? (
              <tr><td colSpan={8} style={{ padding: 24, textAlign: 'center', color: '#94A3B8' }}>Aucun événement journalisé pour ce filtre. Connectez-vous, créez un projet ou déposez un document pour générer des entrées.</td></tr>
            ) : filtered.slice(0, 500).map(e => {
              const d = new Date(e.date);
              return (
                <tr key={e.id}>
                  <td style={{ whiteSpace: 'nowrap' }}>{d.toLocaleDateString('fr-FR')}</td>
                  <td style={{ whiteSpace: 'nowrap', fontFamily: 'monospace', fontSize: 11 }}>{d.toLocaleTimeString('fr-FR')}</td>
                  <td style={{ fontWeight: 600 }}>{e.utilisateur}</td>
                  <td><span style={{ fontSize: 10, color: '#64748B' }}>{e.role ?? '—'}</span></td>
                  <td><span style={{ fontSize: 10, fontWeight: 700, color: '#fff', background: TYPE_COLOR[e.type] ?? '#64748B', borderRadius: 6, padding: '2px 7px' }}>{e.type}</span></td>
                  <td>{e.action}</td>
                  <td style={{ fontFamily: 'monospace', fontSize: 11 }}>{e.objet}</td>
                  <td style={{ fontSize: 11, color: '#64748B' }}>{e.detail ?? ''}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════════
   ALERTES & CANAUX — configuration des notifications (email/SMS/WhatsApp…)
═══════════════════════════════════════════════════════════════════════ */
const GRAVITE_CFG: Record<GraviteAlerte, { label: string; color: string; bg: string }> = {
  info:     { label: 'Info',     color: '#2563EB', bg: '#DBEAFE' },
  warning:  { label: 'Warning',  color: '#D97706', bg: '#FEF3C7' },
  critique: { label: 'Critique', color: '#DC2626', bg: '#FEE2E2' },
};

function AlertesConfigPanel() {
  const { canaux, regles, setCanal, toggleCanal, toggleRegle, toggleRegleCanal, setRegle, resetConfig } = useAlertConfig();

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      {/* Canaux */}
      <div className="card">
        <div className="card-header">
          <span className="card-title">📡 Canaux de notification</span>
          <button className="btn btn-secondary btn-sm" onClick={() => { if (confirm('Réinitialiser toute la configuration des alertes ?')) resetConfig(); }}>Réinitialiser</button>
        </div>
        <div className="card-body" style={{ padding: 0 }}>
          <table className="tbl">
            <thead>
              <tr><th>Canal</th><th>Actif</th><th>Destinataire / Endpoint</th><th>Paramètre</th></tr>
            </thead>
            <tbody>
              {canaux.map(c => (
                <tr key={c.id}>
                  <td style={{ fontWeight: 700 }}>{CANAL_META[c.id].emoji} {c.label}</td>
                  <td>
                    <button onClick={() => toggleCanal(c.id)} style={{ background: 'none', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 5, color: c.actif ? 'var(--green)' : 'var(--muted)', fontSize: 11, fontWeight: 700 }}>
                      {c.actif ? <ToggleRight size={20} /> : <ToggleLeft size={20} />}
                      {c.actif ? 'Activé' : 'Désactivé'}
                    </button>
                  </td>
                  <td><input className="form-input" value={c.cible} onChange={e => setCanal(c.id, { cible: e.target.value })} style={{ minWidth: 200, fontSize: 12 }} /></td>
                  <td><input className="form-input" value={c.parametre} onChange={e => setCanal(c.id, { parametre: e.target.value })} placeholder="—" style={{ minWidth: 160, fontSize: 12 }} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Règles d'alerte */}
      <div className="card">
        <div className="card-header">
          <span className="card-title">🚨 Règles d&apos;alerte par type d&apos;événement</span>
          <span style={{ fontSize: 10, color: 'var(--muted)' }}>Cochez les canaux déclenchés pour chaque événement</span>
        </div>
        <div className="card-body" style={{ padding: 0, overflowX: 'auto' }}>
          <table className="tbl">
            <thead>
              <tr>
                <th style={{ minWidth: 220 }}>Événement</th>
                <th>Gravité</th>
                <th>Actif</th>
                <th>Seuil</th>
                {canaux.map(c => <th key={c.id} style={{ textAlign: 'center' }} title={c.label}>{CANAL_META[c.id].emoji}</th>)}
              </tr>
            </thead>
            <tbody>
              {regles.map(r => {
                const g = GRAVITE_CFG[r.gravite];
                return (
                  <tr key={r.id} style={{ opacity: r.actif ? 1 : 0.5 }}>
                    <td>
                      <div style={{ fontWeight: 700, color: 'var(--text)' }}>{r.label}</div>
                      <div style={{ fontSize: 10, color: 'var(--muted)' }}>{r.description}</div>
                    </td>
                    <td>
                      <select value={r.gravite} onChange={e => setRegle(r.id, { gravite: e.target.value as GraviteAlerte })}
                        className="form-input" style={{ fontSize: 11, padding: '3px 6px', width: 'auto', background: g.bg, color: g.color, fontWeight: 700, border: 'none' }}>
                        {(Object.keys(GRAVITE_CFG) as GraviteAlerte[]).map(k => <option key={k} value={k}>{GRAVITE_CFG[k].label}</option>)}
                      </select>
                    </td>
                    <td>
                      <button onClick={() => toggleRegle(r.id)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: r.actif ? 'var(--green)' : 'var(--muted)' }}>
                        {r.actif ? <ToggleRight size={20} /> : <ToggleLeft size={20} />}
                      </button>
                    </td>
                    <td>
                      {r.seuil != null ? (
                        <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                          <input type="number" className="form-input" value={r.seuil} onChange={e => setRegle(r.id, { seuil: parseFloat(e.target.value) || 0 })} style={{ width: 56, fontSize: 11, padding: '3px 6px' }} />
                          <span style={{ fontSize: 10, color: 'var(--muted)' }}>{r.seuilUnite}</span>
                        </span>
                      ) : <span style={{ color: 'var(--muted)', fontSize: 11 }}>—</span>}
                    </td>
                    {canaux.map(c => {
                      const on = r.canaux.includes(c.id);
                      const dispo = c.actif;
                      return (
                        <td key={c.id} style={{ textAlign: 'center' }}>
                          <button onClick={() => dispo && toggleRegleCanal(r.id, c.id)} disabled={!dispo}
                            title={dispo ? c.label : `${c.label} (canal désactivé)`}
                            style={{ width: 22, height: 22, borderRadius: 6, cursor: dispo ? 'pointer' : 'not-allowed',
                              border: `1px solid ${on && dispo ? 'var(--green)' : 'var(--border)'}`,
                              background: on && dispo ? 'var(--green)' : '#fff', color: '#fff',
                              display: 'inline-flex', alignItems: 'center', justifyContent: 'center', opacity: dispo ? 1 : 0.35 }}>
                            {on && <Check size={13} />}
                          </button>
                        </td>
                      );
                    })}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
      <div style={{ fontSize: 11, color: 'var(--muted)', padding: '0 4px' }}>
        ℹ️ Les canaux désactivés (colonne grisée) ne peuvent pas être sélectionnés. Activez d&apos;abord le canal ci-dessus.
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════════
   ARCGIS CONFIG PANEL
═══════════════════════════════════════════════════════════════════════ */
function ArcGISConfigPanel() {
  const config = useIntegrationConfig();
  const [form, setForm] = useState({ ...config.arcgis });
  const [saved, setSaved] = useState(false);

  const update = (k: keyof typeof form, v: string) => setForm(p => ({ ...p, [k]: v }));

  const handleSave = () => {
    config.updateArcGIS(form);
    setSaved(true);
    setTimeout(() => setSaved(false), 3000);
  };

  const inp: React.CSSProperties = {
    width: '100%', boxSizing: 'border-box', padding: '8px 10px', fontSize: 12,
    border: '1px solid var(--border)', borderRadius: 6, color: 'var(--text)', outline: 'none',
  };
  const lbl: React.CSSProperties = { fontSize: 11, fontWeight: 600, color: 'var(--text-secondary)', display: 'block', marginBottom: 4 };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--navy)', marginBottom: 4 }}>ArcGIS Enterprise / Online (ESRI)</div>
      <div style={{ fontSize: 11, color: 'var(--muted)', marginBottom: 8 }}>
        Configurez ici les paramètres de connexion au SIG patrimoine réseau. Les variables d'environnement restent prioritaires si définies.
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
        <div><label style={lbl}>Portal URL</label><input style={inp} value={form.portalUrl} onChange={e => update('portalUrl', e.target.value)} placeholder="https://senelec.maps.arcgis.com" /></div>
        <div><label style={lbl}>Nom d'utilisateur</label><input style={inp} value={form.username} onChange={e => update('username', e.target.value)} placeholder="dpe_sig_admin" /></div>
        <div><label style={lbl}>Mot de passe</label><input style={inp} type="password" value={form.password} onChange={e => update('password', e.target.value)} placeholder="••••••••" /></div>
        <div><label style={lbl}>Client ID (OAuth)</label><input style={inp} value={form.clientId} onChange={e => update('clientId', e.target.value)} placeholder="optionnel" /></div>
        <div><label style={lbl}>Client Secret (OAuth)</label><input style={inp} type="password" value={form.clientSecret} onChange={e => update('clientSecret', e.target.value)} placeholder="optionnel" /></div>
        <div><label style={lbl}>FeatureServer URL</label><input style={inp} value={form.featureServerUrl} onChange={e => update('featureServerUrl', e.target.value)} placeholder="https://services.../FeatureServer" /></div>
        <div><label style={lbl}>GeometryServer URL</label><input style={inp} value={form.geometryServerUrl} onChange={e => update('geometryServerUrl', e.target.value)} placeholder="https://services.../GeometryServer" /></div>
      </div>

      <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 8 }}>
        <button className="btn btn-secondary btn-sm" onClick={() => { config.resetArcGIS(); setForm({ ...config.arcgis }); }}>Réinitialiser</button>
        <button className="btn btn-primary btn-sm" onClick={handleSave}><Save size={13} /> Enregistrer</button>
      </div>
      {saved && (
        <div style={{ textAlign: 'right', fontSize: 11, color: 'var(--success)', fontWeight: 600 }}>✅ Configuration ArcGIS sauvegardée</div>
      )}
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════════
   MICROSOFT COPILOT CONFIG PANEL — IA d'entreprise via comptes M365 / Entra ID
═══════════════════════════════════════════════════════════════════════ */
/** Derive tenantId from known SENELEC email domains (no user input needed) */
function deriveTenantFromEmail(email: string): string {
  const domain = (email.split('@')[1] || '').toLowerCase();
  // Known SENELEC domains → common tenant slug (real UUID lives in env MS_TENANT_ID)
  if (domain === 'senelec.sn' || domain === 'enerticai.com') return 'senelec.sn';
  return 'organizations'; // generic multi-tenant fallback
}

function CopilotConfigPanel() {
  const config = useIntegrationConfig();
  const [email, setEmail]       = useState(config.copilot.account || '');
  const [apiKey, setApiKey]     = useState(config.copilot.apiKey || '');
  const [advanced, setAdvanced] = useState(false);
  const [endpoint, setEndpoint] = useState(config.copilot.endpoint || 'https://senelec.openai.azure.com');
  const [deployment, setDeployment] = useState(config.copilot.deployment || 'gpt-4o');
  const [connecting, setConnecting] = useState(false);
  const [saved, setSaved]       = useState(false);
  const [showKey, setShowKey]   = useState(false);

  const isConnected = config.copilot.enabled && !!config.copilot.account;
  const emailValid  = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);

  const inp: React.CSSProperties = {
    width: '100%', boxSizing: 'border-box', padding: '9px 12px', fontSize: 13,
    border: '1px solid var(--border)', borderRadius: 8, color: 'var(--text)',
    background: 'var(--bg)', outline: 'none',
  };
  const lbl: React.CSSProperties = { fontSize: 11, fontWeight: 600, color: 'var(--text-secondary)', display: 'block', marginBottom: 4 };

  const handleConnect = () => {
    if (!emailValid) return;
    setConnecting(true);
    setTimeout(() => {
      config.updateCopilot({
        enabled: true,
        account: email,
        apiKey,
        endpoint: endpoint || 'https://senelec.openai.azure.com',
        deployment: deployment || 'gpt-4o',
        tenantId: deriveTenantFromEmail(email),
        // clientId left unchanged (set via env MS_CLIENT_ID or previous admin config)
      });
      setConnecting(false);
      setSaved(true);
      setTimeout(() => setSaved(false), 4000);
    }, 900);
  };

  const handleDisconnect = () => {
    config.updateCopilot({ enabled: false, account: '', apiKey: '' });
    setEmail('');
    setApiKey('');
  };

  /* ── Connected state ── */
  if (isConnected) return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        <div style={{
          width: 44, height: 44, borderRadius: 10,
          background: 'linear-gradient(135deg, #0078D4 0%, #1E40AF 100%)',
          display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
        }}>
          <svg width="22" height="22" viewBox="0 0 23 23" fill="none">
            <rect x="1"  y="1"  width="10" height="10" fill="#F25022"/>
            <rect x="12" y="1"  width="10" height="10" fill="#7FBA00"/>
            <rect x="1"  y="12" width="10" height="10" fill="#00A4EF"/>
            <rect x="12" y="12" width="10" height="10" fill="#FFB900"/>
          </svg>
        </div>
        <div>
          <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text)' }}>Microsoft Copilot</div>
          <div style={{ fontSize: 11, color: 'var(--success)', fontWeight: 600, display: 'flex', alignItems: 'center', gap: 4 }}>
            <span style={{ width: 7, height: 7, borderRadius: '50%', background: 'var(--success)', display: 'inline-block' }} />
            Connecté · {config.copilot.account}
          </div>
        </div>
        <button
          onClick={handleDisconnect}
          style={{ marginLeft: 'auto', padding: '6px 14px', fontSize: 12, fontWeight: 600,
            border: '1px solid var(--border)', borderRadius: 7, background: 'transparent',
            color: 'var(--danger)', cursor: 'pointer' }}
        >
          Déconnecter
        </button>
      </div>

      {/* Info banner */}
      <div style={{
        background: 'linear-gradient(135deg, rgba(0,120,212,.08) 0%, rgba(30,64,175,.06) 100%)',
        border: '1px solid rgba(0,120,212,.2)', borderRadius: 10, padding: '12px 14px',
        fontSize: 12, color: 'var(--text)', lineHeight: 1.6,
      }}>
        <div style={{ fontWeight: 600, marginBottom: 4, color: '#0078D4' }}>Copilot actif sur cette plateforme</div>
        Le moteur IA de la plateforme utilise votre compte Microsoft pour les suggestions contextuelles, l'analyse des ODM, les prédictions EVM et le Centre IA.
        Le tenant <strong>{deriveTenantFromEmail(config.copilot.account)}</strong> est détecté automatiquement.
      </div>

      {/* Advanced toggle */}
      <button onClick={() => setAdvanced(v => !v)} style={{
        display: 'flex', alignItems: 'center', gap: 6, fontSize: 11, fontWeight: 600,
        color: 'var(--text-secondary)', background: 'none', border: 'none', cursor: 'pointer', padding: 0,
      }}>
        <span style={{ transform: advanced ? 'rotate(90deg)' : 'rotate(0deg)', transition: '.15s', display: 'inline-block' }}>▶</span>
        Paramètres avancés (endpoint, déploiement)
      </button>
      {advanced && (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
          <div>
            <label style={lbl}>Endpoint Azure OpenAI</label>
            <input style={inp} value={endpoint}
              onChange={e => { setEndpoint(e.target.value); config.updateCopilot({ endpoint: e.target.value }); }}
              placeholder="https://senelec.openai.azure.com" />
          </div>
          <div>
            <label style={lbl}>Déploiement (modèle)</label>
            <input style={inp} value={deployment}
              onChange={e => { setDeployment(e.target.value); config.updateCopilot({ deployment: e.target.value }); }}
              placeholder="gpt-4o" />
          </div>
          <div style={{ gridColumn: '1/-1' }}>
            <label style={lbl}>Clé API Azure OpenAI (si sans SSO)</label>
            <div style={{ position: 'relative' }}>
              <input style={{ ...inp, paddingRight: 40 }} type={showKey ? 'text' : 'password'} value={apiKey}
                onChange={e => { setApiKey(e.target.value); config.updateCopilot({ apiKey: e.target.value }); }}
                placeholder="••••••••" />
              <button onClick={() => setShowKey(v => !v)} style={{
                position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)',
                background: 'none', border: 'none', cursor: 'pointer', color: 'var(--muted)', fontSize: 12,
              }}>{showKey ? '🙈' : '👁'}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );

  /* ── Not connected state ── */
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
      {/* Logo + title */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
        <div style={{
          width: 48, height: 48, borderRadius: 12,
          background: 'linear-gradient(135deg, #0078D4 0%, #1E40AF 100%)',
          display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
        }}>
          <svg width="24" height="24" viewBox="0 0 23 23" fill="none">
            <rect x="1"  y="1"  width="10" height="10" fill="#F25022"/>
            <rect x="12" y="1"  width="10" height="10" fill="#7FBA00"/>
            <rect x="1"  y="12" width="10" height="10" fill="#00A4EF"/>
            <rect x="12" y="12" width="10" height="10" fill="#FFB900"/>
          </svg>
        </div>
        <div>
          <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--text)' }}>Se connecter avec Microsoft</div>
          <div style={{ fontSize: 11, color: 'var(--muted)' }}>Utilisez votre compte SENELEC (@senelec.sn) pour activer Copilot</div>
        </div>
      </div>

      {/* Email field */}
      <div>
        <label style={lbl}>Adresse e-mail Microsoft</label>
        <input
          style={{ ...inp, borderColor: email && !emailValid ? 'var(--danger)' : 'var(--border)' }}
          type="email"
          value={email}
          onChange={e => setEmail(e.target.value)}
          placeholder="prenom.nom@senelec.sn"
          autoComplete="email"
          onKeyDown={e => e.key === 'Enter' && emailValid && handleConnect()}
        />
        {email && !emailValid && (
          <div style={{ fontSize: 11, color: 'var(--danger)', marginTop: 4 }}>Adresse e-mail invalide</div>
        )}
        {emailValid && (
          <div style={{ fontSize: 11, color: 'var(--muted)', marginTop: 4 }}>
            Tenant détecté : <strong>{deriveTenantFromEmail(email)}</strong> · aucune configuration supplémentaire requise
          </div>
        )}
      </div>

      {/* API Key optional */}
      <div>
        <label style={lbl}>Clé API Azure OpenAI <span style={{ fontWeight: 400, color: 'var(--muted)' }}>(optionnelle)</span></label>
        <div style={{ position: 'relative' }}>
          <input
            style={{ ...inp, paddingRight: 40 }}
            type={showKey ? 'text' : 'password'}
            value={apiKey}
            onChange={e => setApiKey(e.target.value)}
            placeholder="Laissez vide si votre compte Microsoft suffit"
          />
          <button onClick={() => setShowKey(v => !v)} style={{
            position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)',
            background: 'none', border: 'none', cursor: 'pointer', color: 'var(--muted)', fontSize: 12,
          }}>{showKey ? '🙈' : '👁'}</button>
        </div>
      </div>

      {/* Advanced toggle */}
      <button onClick={() => setAdvanced(v => !v)} style={{
        display: 'flex', alignItems: 'center', gap: 6, fontSize: 11, fontWeight: 600,
        color: 'var(--text-secondary)', background: 'none', border: 'none', cursor: 'pointer', padding: 0,
      }}>
        <span style={{ transform: advanced ? 'rotate(90deg)' : 'rotate(0deg)', transition: '.15s', display: 'inline-block' }}>▶</span>
        Paramètres avancés (endpoint, déploiement)
      </button>
      {advanced && (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
          <div>
            <label style={lbl}>Endpoint Azure OpenAI</label>
            <input style={inp} value={endpoint} onChange={e => setEndpoint(e.target.value)} placeholder="https://senelec.openai.azure.com" />
          </div>
          <div>
            <label style={lbl}>Déploiement (modèle)</label>
            <input style={inp} value={deployment} onChange={e => setDeployment(e.target.value)} placeholder="gpt-4o" />
          </div>
        </div>
      )}

      {/* Connect button */}
      <button
        onClick={handleConnect}
        disabled={!emailValid || connecting}
        style={{
          display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10,
          padding: '11px 20px', fontSize: 13, fontWeight: 700,
          background: emailValid && !connecting
            ? 'linear-gradient(135deg, #0078D4 0%, #1E40AF 100%)'
            : 'var(--border)',
          color: emailValid && !connecting ? '#fff' : 'var(--muted)',
          border: 'none', borderRadius: 9, cursor: emailValid && !connecting ? 'pointer' : 'default',
          transition: 'all .2s', boxShadow: emailValid && !connecting ? '0 4px 14px rgba(0,120,212,.3)' : 'none',
        }}
      >
        {connecting ? (
          <>
            <span style={{ width: 16, height: 16, border: '2px solid rgba(255,255,255,.4)', borderTopColor: '#fff', borderRadius: '50%', animation: 'spin 0.7s linear infinite', display: 'inline-block' }} />
            Connexion en cours…
          </>
        ) : (
          <>
            <svg width="18" height="18" viewBox="0 0 23 23" fill="none" style={{ flexShrink: 0 }}>
              <rect x="1"  y="1"  width="10" height="10" fill="#F25022"/>
              <rect x="12" y="1"  width="10" height="10" fill="#7FBA00"/>
              <rect x="1"  y="12" width="10" height="10" fill="#00A4EF"/>
              <rect x="12" y="12" width="10" height="10" fill="#FFB900"/>
            </svg>
            Se connecter avec Microsoft
          </>
        )}
      </button>

      {saved && (
        <div style={{
          display: 'flex', alignItems: 'center', gap: 8, padding: '10px 14px',
          background: 'rgba(22,163,74,.1)', border: '1px solid rgba(22,163,74,.3)',
          borderRadius: 8, fontSize: 12, color: 'var(--success)', fontWeight: 600,
        }}>
          <Check size={14} /> Compte Microsoft connecté avec succès
        </div>
      )}
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════════
   CRITÈRES & SCORING — grilles pondérées paramétrables (DPE / PMO / Admin)
   • Priorisation projets (arbitrage portefeuille)
   • Notation fournisseurs (évaluation marchés)
═══════════════════════════════════════════════════════════════════════ */
function CriteresGouvernance() {
  const { user } = useAuth();
  const role = user?.role;
  const canEdit = role === 'DIR_DPE' || role === 'PMO' || role === 'ADMIN';

  const prioritization = useCriteriaStore(s => s.prioritization);
  const supplier       = useCriteriaStore(s => s.supplier);
  const addCritere     = useCriteriaStore(s => s.addCritere);
  const updateCritere  = useCriteriaStore(s => s.updateCritere);
  const removeCritere  = useCriteriaStore(s => s.removeCritere);
  const resetGroup     = useCriteriaStore(s => s.resetGroup);
  const { addNotification } = useNotificationStore();

  const [draftLabel, setDraftLabel] = useState<Record<CritereGroup, string>>({ prioritization: '', supplier: '' });

  const renderGrid = (group: CritereGroup, list: typeof prioritization, title: string, subtitle: string, accent: string) => {
    const total = list.reduce((s, c) => s + (Number(c.poids) || 0), 0);
    const balanced = total === 100;
    return (
      <div className="card">
        <div className="card-header">
          <div>
            <span className="card-title">{title}</span>
            <div style={{ fontSize: 11, color: 'var(--muted)', marginTop: 2 }}>{subtitle}</div>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <span style={{ fontSize: 12, fontWeight: 800, color: balanced ? 'var(--success)' : '#D97706' }}>
              Σ poids : {total}% {balanced ? '✓' : '(idéal 100%)'}
            </span>
            {canEdit && (
              <button className="btn btn-ghost btn-sm" onClick={() => { resetGroup(group); addNotification({ type: 'info', title: 'Grille réinitialisée', message: title }); }}>
                <RefreshIcon /> Réinitialiser
              </button>
            )}
          </div>
        </div>
        <div style={{ overflowX: 'auto' }}>
          <table className="tbl">
            <thead>
              <tr>
                <th style={{ width: '60%' }}>Critère</th>
                <th style={{ width: 140 }}>Poids (%)</th>
                <th style={{ width: 90 }}>Part</th>
                {canEdit && <th style={{ width: 70 }}>Actions</th>}
              </tr>
            </thead>
            <tbody>
              {list.map(c => (
                <tr key={c.id}>
                  <td>
                    {canEdit
                      ? <input className="form-input" value={c.label} onChange={e => updateCritere(group, c.id, { label: e.target.value })} style={{ width: '100%' }} />
                      : <span style={{ fontWeight: 600, color: 'var(--navy)' }}>{c.label}</span>}
                  </td>
                  <td>
                    {canEdit
                      ? <input className="form-input" type="number" min={0} max={100} value={c.poids} onChange={e => updateCritere(group, c.id, { poids: Math.max(0, Math.min(100, Number(e.target.value) || 0)) })} style={{ width: 90 }} />
                      : <span>{c.poids}%</span>}
                  </td>
                  <td>
                    <div style={{ height: 6, borderRadius: 99, background: '#E5E7EB', overflow: 'hidden' }}>
                      <div style={{ width: `${total > 0 ? (c.poids / total) * 100 : 0}%`, height: '100%', background: accent }} />
                    </div>
                  </td>
                  {canEdit && (
                    <td>
                      <button className="btn btn-ghost btn-xs" onClick={() => removeCritere(group, c.id)} title="Supprimer"><Trash2 size={11} /></button>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {canEdit && (
          <div className="card-body" style={{ display: 'flex', gap: 8, borderTop: '1px solid #E2E8F0' }}>
            <input className="form-input" style={{ flex: 1 }} placeholder="Nouveau critère…" value={draftLabel[group]}
              onChange={e => setDraftLabel(d => ({ ...d, [group]: e.target.value }))}
              onKeyDown={e => { if (e.key === 'Enter' && draftLabel[group].trim()) { addCritere(group, draftLabel[group]); setDraftLabel(d => ({ ...d, [group]: '' })); } }} />
            <button className="btn btn-primary btn-sm" disabled={!draftLabel[group].trim()}
              onClick={() => { if (draftLabel[group].trim()) { addCritere(group, draftLabel[group]); setDraftLabel(d => ({ ...d, [group]: '' })); } }}>
              <Plus size={12} /> Ajouter
            </button>
          </div>
        )}
      </div>
    );
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      {!canEdit && (
        <div style={{ padding: '12px 16px', background: '#FFF7ED', border: '1px solid #FED7AA', borderRadius: 12, display: 'flex', gap: 10, alignItems: 'center' }}>
          <Lock size={16} color="#D97706" />
          <span style={{ fontSize: 12, color: '#92400E' }}>
            Lecture seule — seuls les profils <strong>DPE</strong>, <strong>PMO</strong> et <strong>Administrateur</strong> peuvent modifier ces grilles.
          </span>
        </div>
      )}
      {renderGrid('prioritization', prioritization,
        'Critères de priorisation des projets',
        'Grille d’arbitrage du portefeuille (réf. PMI). Utilisée dans l’assistant de création de projet.',
        '#1B4F8A')}
      {renderGrid('supplier', supplier,
        'Critères de scoring des fournisseurs',
        'Grille d’évaluation des prestataires / marchés. Utilisée dans le module Marchés.',
        '#F47920')}

      <div style={{ padding: '14px 18px', background: '#EFF6FF', border: '1px solid #BFDBFE', borderRadius: 12, display: 'flex', gap: 12 }}>
        <Info size={20} color="#1D4ED8" />
        <div style={{ fontSize: 11.5, color: '#1E3A8A', lineHeight: 1.5 }}>
          Ces grilles pondérées constituent le <strong>référentiel de gouvernance</strong> partagé. La priorisation projet
          alimente l&apos;arbitrage de portefeuille ; le scoring fournisseur alimente l&apos;évaluation des marchés.
          Toute modification est appliquée instantanément aux modules concernés.
        </div>
      </div>
    </div>
  );
}

/** Petite icône de réinitialisation (réutilise un glyphe inline pour éviter un import). */
function RefreshIcon() {
  return <span style={{ fontSize: 12, marginRight: 2 }}>↻</span>;
}

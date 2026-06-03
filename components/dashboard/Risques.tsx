'use client';

import { useState, useMemo } from 'react';
import {
  BarChart, Bar, LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer,
  CartesianGrid, Legend,
} from 'recharts';
import {
  AlertTriangle, Shield, Plus, Download, Filter, X, ChevronUp, ChevronDown,
  TrendingUp, Clock,
} from 'lucide-react';
import { useScopeDomaines } from '@/lib/projectStore';

/* ═══════════════════════════════════════════════════════════════════════════════
   TYPES
═══════════════════════════════════════════════════════════════════════════════ */

type Domaine = 'Production' | 'Transport' | 'Distribution' | 'Commercial' | 'Génie Civil';

/** Mappe les codes domaine du store (scope RBAC) vers les libellés affichés ici. */
const DOMAINE_CODE_TO_LABEL: Record<string, Domaine> = {
  production: 'Production',
  transport: 'Transport',
  distribution: 'Distribution',
  commercial: 'Commercial',
  genie_civil: 'Génie Civil',
};
type Categorie = 'Technique' | 'Financier' | 'Calendrier' | 'Externe' | 'Organisationnel';
type Criticite = 'Critique' | 'Important' | 'Modéré' | 'Faible';
type StatutRisque = 'Actif' | 'En traitement' | 'Clos' | 'Survenu';

interface Risque {
  id: string;
  domaine: Domaine;
  categorie: Categorie;
  description: string;
  probabilite: 1 | 2 | 3 | 4 | 5;
  impact: 1 | 2 | 3 | 4 | 5;
  score: number;
  criticite: Criticite;
  responsable: string;
  mesures: string;
  statut: StatutRisque;
  dateRevision: string;
  progTraitement: number;
}

/* ═══════════════════════════════════════════════════════════════════════════════
   MOCK DATA — 20 risques
═══════════════════════════════════════════════════════════════════════════════ */

const RISQUES: Risque[] = [
  { id: 'R-001', domaine: 'Transport', categorie: 'Financier', description: 'Hausse prix matériaux (acier, câbles)', probabilite: 4, impact: 4, score: 16, criticite: 'Critique', responsable: 'DAF SENELEC', mesures: 'Clauses d\'indexation prix, stock tampon 20%, contrats cadre fournisseurs', statut: 'En traitement', dateRevision: '15/06/2025', progTraitement: 40 },
  { id: 'R-002', domaine: 'Production', categorie: 'Calendrier', description: 'Retards importations équipements', probabilite: 4, impact: 3, score: 12, criticite: 'Important', responsable: 'Chef Projet DER', mesures: 'Commande anticipée 3 mois, 2 fournisseurs alternatifs, clauses de pénalité', statut: 'En traitement', dateRevision: '30/06/2025', progTraitement: 55 },
  { id: 'R-003', domaine: 'Transport', categorie: 'Technique', description: 'Instabilité réseau pendant travaux', probabilite: 3, impact: 4, score: 12, criticite: 'Important', responsable: 'DTNI SENELEC', mesures: 'Plan de consignation détaillé, coordination avec dispatching, redondance alimentation', statut: 'Actif', dateRevision: '20/06/2025', progTraitement: 30 },
  { id: 'R-004', domaine: 'Transport', categorie: 'Externe', description: 'Non disponibilité terrains/Droits ROW', probabilite: 3, impact: 5, score: 15, criticite: 'Critique', responsable: 'Direction Foncier', mesures: 'Lobby institutionnel DG, tracé alternatif étude, accord collectivités locales', statut: 'En traitement', dateRevision: '01/07/2025', progTraitement: 25 },
  { id: 'R-005', domaine: 'Distribution', categorie: 'Calendrier', description: 'Intempéries saison des pluies', probabilite: 4, impact: 2, score: 8, criticite: 'Modéré', responsable: 'Chef chantier', mesures: 'Flottement Gantt 6 semaines, travaux saison sèche, engins tropicaux', statut: 'Actif', dateRevision: '31/05/2025', progTraitement: 70 },
  { id: 'R-006', domaine: 'Commercial', categorie: 'Externe', description: 'Changement réglementaire tarifaire', probabilite: 2, impact: 5, score: 10, criticite: 'Important', responsable: 'Dir. Commerciale', mesures: 'Veille réglementaire CRSE, lobbying SENELEC, scénarios tarifaires alternatifs', statut: 'Actif', dateRevision: '30/06/2025', progTraitement: 20 },
  { id: 'R-007', domaine: 'Production', categorie: 'Financier', description: 'Problèmes de financement bailleur', probabilite: 2, impact: 5, score: 10, criticite: 'Important', responsable: 'Coord. UGP', mesures: 'Reporting mensuel bailleurs, mission supervision trimestrielle, plan rattrapage', statut: 'Actif', dateRevision: '15/07/2025', progTraitement: 35 },
  { id: 'R-008', domaine: 'Transport', categorie: 'Organisationnel', description: 'Défaillance sous-traitant clé', probabilite: 3, impact: 4, score: 12, criticite: 'Important', responsable: 'Juriste marchés', mesures: 'Cautionnement bancaire 10%, liste sous-traitants pré-qualifiés, clause substitution', statut: 'En traitement', dateRevision: '15/06/2025', progTraitement: 60 },
  { id: 'R-009', domaine: 'Distribution', categorie: 'Technique', description: 'Accidents de travail chantier', probabilite: 3, impact: 3, score: 9, criticite: 'Important', responsable: 'HSE SENELEC', mesures: 'Plan HSE renforcé, formations sécurité hebdo, équipements EPI certifiés', statut: 'En traitement', dateRevision: '31/05/2025', progTraitement: 75 },
  { id: 'R-010', domaine: 'Production', categorie: 'Technique', description: 'Obsolescence technologique équipements', probabilite: 2, impact: 3, score: 6, criticite: 'Modéré', responsable: 'DIT SENELEC', mesures: 'Spécifications techniques actualisées, veille technologique, clauses mise à jour', statut: 'Actif', dateRevision: '30/07/2025', progTraitement: 50 },
  { id: 'R-011', domaine: 'Distribution', categorie: 'Externe', description: 'Résistance communautés locales', probabilite: 3, impact: 3, score: 9, criticite: 'Important', responsable: 'ESSS SENELEC', mesures: 'Plan engagement communautaire, consultations publiques, indemnisations justes', statut: 'En traitement', dateRevision: '20/06/2025', progTraitement: 45 },
  { id: 'R-012', domaine: 'Transport', categorie: 'Organisationnel', description: 'Pénurie main d\'œuvre qualifiée', probabilite: 3, impact: 3, score: 9, criticite: 'Important', responsable: 'DRH SENELEC', mesures: 'Partenariat EPT, formation 12 techniciens, sous-traitance partielle internationale', statut: 'En traitement', dateRevision: '15/07/2025', progTraitement: 50 },
  { id: 'R-013', domaine: 'Production', categorie: 'Financier', description: 'Fluctuation taux de change USD/XOF', probabilite: 4, impact: 3, score: 12, criticite: 'Important', responsable: 'DAF SENELEC', mesures: 'Couverture change hedging, contrats en XOF si possible, réserve pour aléas 8%', statut: 'En traitement', dateRevision: '30/06/2025', progTraitement: 40 },
  { id: 'R-014', domaine: 'Production', categorie: 'Technique', description: 'Cyber-attaque infrastructure SCADA', probabilite: 2, impact: 5, score: 10, criticite: 'Important', responsable: 'DSI SENELEC', mesures: 'Audit sécurité SCADA, firewall industriels, plan de continuité informatique', statut: 'Actif', dateRevision: '01/08/2025', progTraitement: 30 },
  { id: 'R-015', domaine: 'Distribution', categorie: 'Calendrier', description: 'Dépassement délai études techniques', probabilite: 4, impact: 2, score: 8, criticite: 'Modéré', responsable: 'Bureau études', mesures: 'Calendrier études avec jalons mensuels, bureau contrôle externe, validation anticipée', statut: 'En traitement', dateRevision: '15/06/2025', progTraitement: 65 },
  { id: 'R-016', domaine: 'Commercial', categorie: 'Organisationnel', description: 'Rotation élevée équipes projet', probabilite: 2, impact: 2, score: 4, criticite: 'Modéré', responsable: 'DRH SENELEC', mesures: 'Plan de rétention, primes de performance, documentation procédures', statut: 'Actif', dateRevision: '31/07/2025', progTraitement: 25 },
  { id: 'R-017', domaine: 'Transport', categorie: 'Externe', description: 'Conflits sociaux zones d\'intervention', probabilite: 2, impact: 4, score: 8, criticite: 'Modéré', responsable: 'ESSS SENELEC', mesures: 'Protocoles engagement communautaire, fonds d\'investissement local, médiation', statut: 'Actif', dateRevision: '30/06/2025', progTraitement: 35 },
  { id: 'R-018', domaine: 'Distribution', categorie: 'Financier', description: 'Dépassement budget génie civil', probabilite: 3, impact: 3, score: 9, criticite: 'Important', responsable: 'DAF/DGC', mesures: 'Révision prix contractuelle indice TP01, réserve de contingence 8% débloquée', statut: 'En traitement', dateRevision: '20/06/2025', progTraitement: 50 },
  { id: 'R-019', domaine: 'Commercial', categorie: 'Technique', description: 'Défauts compteurs AMI déployés', probabilite: 2, impact: 3, score: 6, criticite: 'Modéré', responsable: 'DIT/Direction Comptage', mesures: 'Réception technique stricte, garantie fabricant 5 ans, stock de remplacement', statut: 'Actif', dateRevision: '31/07/2025', progTraitement: 60 },
  { id: 'R-020', domaine: 'Production', categorie: 'Externe', description: 'Changement politique énergétique nationale', probabilite: 1, impact: 5, score: 5, criticite: 'Modéré', responsable: 'DG SENELEC', mesures: 'Veille politique, alignement stratégie PSE 2050, diversification financements', statut: 'Actif', dateRevision: '01/09/2025', progTraitement: 15 },
  { id: 'R-021', domaine: 'Génie Civil', categorie: 'Technique', description: 'Tassements/fondations postes H61 et bâtiments techniques', probabilite: 3, impact: 4, score: 12, criticite: 'Important', responsable: 'DET&GI / DGC', mesures: 'Études géotechniques préalables, contrôle BET, réception des fonds de fouille', statut: 'En traitement', dateRevision: '20/06/2025', progTraitement: 55 },
  { id: 'R-022', domaine: 'Génie Civil', categorie: 'Financier', description: 'Révision des prix matériaux GC (ciment, acier à béton)', probabilite: 4, impact: 3, score: 12, criticite: 'Important', responsable: 'DAF / DGC', mesures: 'Clause d\'actualisation indice TP, approvisionnement anticipé, réserve 8%', statut: 'Actif', dateRevision: '30/06/2025', progTraitement: 35 },
];

/* ═══════════════════════════════════════════════════════════════════════════════
   CHART DATA
═══════════════════════════════════════════════════════════════════════════════ */

const DOMAINE_CHART_DATA = [
  { domain: 'Production', Technique: 2, Financier: 3, Calendrier: 1, Externe: 1, Organisationnel: 0 },
  { domain: 'Transport', Technique: 1, Financier: 1, Calendrier: 0, Externe: 2, Organisationnel: 2 },
  { domain: 'Distribution', Technique: 1, Financier: 1, Calendrier: 2, Externe: 1, Organisationnel: 0 },
  { domain: 'Commercial', Technique: 1, Financier: 0, Calendrier: 0, Externe: 1, Organisationnel: 1 },
  { domain: 'Génie Civil', Technique: 1, Financier: 1, Calendrier: 1, Externe: 0, Organisationnel: 0 },
];

const EVOLUTION_RISQUES = [
  { mois: 'Dec 2024', actifs: 42, exposition: 8.2 },
  { mois: 'Jan 2025', actifs: 44, exposition: 8.8 },
  { mois: 'Fév 2025', actifs: 41, exposition: 8.5 },
  { mois: 'Mar 2025', actifs: 43, exposition: 9.1 },
  { mois: 'Avr 2025', actifs: 46, exposition: 9.4 },
  { mois: 'Mai 2025', actifs: 46, exposition: 9.2 },
];

/* ═══════════════════════════════════════════════════════════════════════════════
   HELPERS
═══════════════════════════════════════════════════════════════════════════════ */

function cellColor(score: number): string {
  if (score >= 15) return '#EF3340';
  if (score >= 8) return '#F47920';
  if (score >= 4) return '#F59E0B';
  return '#16A34A';
}

function cellBg(score: number): string {
  if (score >= 15) return 'rgba(239,51,64,0.15)';
  if (score >= 8) return 'rgba(244,121,32,0.15)';
  if (score >= 4) return 'rgba(245,158,11,0.12)';
  return 'rgba(22,163,74,0.12)';
}

function criticiteColor(c: Criticite): string {
  if (c === 'Critique') return '#EF3340';
  if (c === 'Important') return '#F47920';
  if (c === 'Modéré') return '#F59E0B';
  return '#16A34A';
}

function criticiteKpiColor(c: Criticite): { bg: string; border: string; text: string } {
  if (c === 'Critique') return { bg: 'rgba(239,51,64,0.08)', border: 'rgba(239,51,64,0.2)', text: '#EF3340' };
  if (c === 'Important') return { bg: 'rgba(244,121,32,0.08)', border: 'rgba(244,121,32,0.2)', text: '#F47920' };
  if (c === 'Modéré') return { bg: 'rgba(245,158,11,0.08)', border: 'rgba(245,158,11,0.2)', text: '#F59E0B' };
  return { bg: 'rgba(22,163,74,0.08)', border: 'rgba(22,163,74,0.2)', text: '#16A34A' };
}

function statutColor(s: StatutRisque): string {
  if (s === 'Actif') return '#EF3340';
  if (s === 'En traitement') return '#F47920';
  if (s === 'Clos') return '#16A34A';
  return '#7C3AED';
}

const PROB_LABELS = ['1 Rare', '2 Peu prob.', '3 Possible', '4 Probable', '5 Quasi-cert.'];
const IMP_LABELS = ['1 Négligeable', '2 Mineur', '3 Modéré', '4 Majeur', '5 Catastrophique'];
const CAT_COLORS: Record<Categorie, string> = {
  Technique: '#1B4F8A', Financier: '#F47920', Calendrier: '#F59E0B', Externe: '#EF3340', Organisationnel: '#7C3AED',
};

/* ═══════════════════════════════════════════════════════════════════════════════
   MODAL: Risque Détail
═══════════════════════════════════════════════════════════════════════════════ */

function RisqueDetailModal({ risque, onClose, onUpdate }: { risque: Risque; onClose: () => void; onUpdate: (r: Risque) => void }) {
  const [editMode, setEditMode] = useState(false);
  const [form, setForm] = useState({ statut: risque.statut, responsable: risque.responsable, mesures: risque.mesures, progTraitement: risque.progTraitement, dateRevision: risque.dateRevision });

  const handleSave = () => {
    onUpdate({ ...risque, ...form });
    setEditMode(false);
    onClose();
  };
  return (
    <div onClick={onClose} style={{ position: 'fixed', inset: 0, zIndex: 9000, background: 'rgba(27,79,138,0.55)', display: 'flex', alignItems: 'center', justifyContent: 'center', backdropFilter: 'blur(2px)' }}>
      <div onClick={e => e.stopPropagation()} style={{ background: '#fff', borderRadius: 14, boxShadow: '0 20px 60px rgba(0,0,0,0.25)', width: '100%', maxWidth: 680, margin: 16, maxHeight: '90vh', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        <div style={{ background: '#1B4F8A', padding: '16px 20px', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <div>
            <div style={{ color: 'rgba(255,255,255,0.6)', fontSize: 10, marginBottom: 3 }}>{risque.id} · {risque.domaine} · {risque.categorie}</div>
            <div style={{ color: '#fff', fontWeight: 800, fontSize: 14 }}>{risque.description}</div>
          </div>
          <button onClick={onClose} style={{ background: 'rgba(255,255,255,0.15)', border: 'none', color: '#fff', borderRadius: 6, padding: '5px 10px', cursor: 'pointer', fontWeight: 700, marginLeft: 12, flexShrink: 0 }}>×</button>
        </div>
        <div style={{ flex: 1, overflowY: 'auto', padding: 20, display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 12 }}>
            {[
              { label: 'Probabilité', value: `${risque.probabilite}/5`, sub: PROB_LABELS[risque.probabilite - 1], color: '#F47920' },
              { label: 'Impact', value: `${risque.impact}/5`, sub: IMP_LABELS[risque.impact - 1], color: '#1B4F8A' },
              { label: 'Score P×I', value: `${risque.score}`, sub: risque.criticite, color: criticiteColor(risque.criticite) },
            ].map(k => (
              <div key={k.label} style={{ padding: '12px 14px', background: '#F8FAFC', borderRadius: 10, textAlign: 'center' }}>
                <div style={{ fontSize: 11, color: '#94A3B8', marginBottom: 4 }}>{k.label}</div>
                <div style={{ fontSize: 24, fontWeight: 800, color: k.color }}>{k.value}</div>
                <div style={{ fontSize: 10, fontWeight: 700, color: k.color }}>{k.sub}</div>
              </div>
            ))}
          </div>
          <div style={{ background: '#F8FAFC', borderRadius: 10, padding: 16 }}>
            <div style={{ fontSize: 10, fontWeight: 700, color: '#94A3B8', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 8 }}>Mesures d'atténuation</div>
            <p style={{ fontSize: 13, color: '#374151', margin: 0, lineHeight: 1.65 }}>{risque.mesures}</p>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <div style={{ background: '#F8FAFC', borderRadius: 10, padding: 14 }}>
              <div style={{ fontSize: 10, fontWeight: 700, color: '#94A3B8', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 10 }}>Suivi</div>
              {[
                { label: 'Responsable', value: risque.responsable },
                { label: 'Date révision', value: risque.dateRevision },
                { label: 'Statut', value: risque.statut },
              ].map(r => (
                <div key={r.label} style={{ display: 'flex', justifyContent: 'space-between', paddingBottom: 6, marginBottom: 6, borderBottom: '1px solid #E2E8F0' }}>
                  <span style={{ fontSize: 12, color: '#94A3B8' }}>{r.label}</span>
                  <span style={{ fontSize: 12, fontWeight: 700, color: '#374151' }}>{r.value}</span>
                </div>
              ))}
            </div>
            <div style={{ background: '#F8FAFC', borderRadius: 10, padding: 14 }}>
              <div style={{ fontSize: 10, fontWeight: 700, color: '#94A3B8', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 10 }}>Traitement</div>
              <div style={{ fontSize: 13, color: '#374151', fontWeight: 700, marginBottom: 8 }}>{risque.progTraitement}% réalisé</div>
              <div style={{ height: 8, background: '#E2E8F0', borderRadius: 4, overflow: 'hidden', marginBottom: 8 }}>
                <div style={{ height: '100%', width: `${risque.progTraitement}%`, background: risque.progTraitement >= 70 ? '#16A34A' : risque.progTraitement >= 40 ? '#F47920' : '#EF3340', borderRadius: 4 }} />
              </div>
            </div>
          </div>
        </div>
        {editMode && (
          <div style={{ padding: '12px 20px', borderTop: '1px solid #F1F5F9', background: '#FAFAFA', display: 'flex', flexDirection: 'column', gap: 10 }}>
            <div style={{ fontSize: 12, fontWeight: 700, color: '#374151' }}>Mise à jour rapide</div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
              <div>
                <label style={{ fontSize: 10, fontWeight: 600, color: '#6B7280', display: 'block', marginBottom: 3 }}>Statut</label>
                <select value={form.statut} onChange={e => setForm(f => ({ ...f, statut: e.target.value as StatutRisque }))} style={{ width: '100%', padding: '7px 8px', fontSize: 12, border: '1px solid #D1D5DB', borderRadius: 6, outline: 'none' }}>
                  {(['Actif', 'En traitement', 'Clos', 'Survenu'] as StatutRisque[]).map(s => <option key={s}>{s}</option>)}
                </select>
              </div>
              <div>
                <label style={{ fontSize: 10, fontWeight: 600, color: '#6B7280', display: 'block', marginBottom: 3 }}>Progression (%)</label>
                <input type="number" min="0" max="100" value={form.progTraitement} onChange={e => setForm(f => ({ ...f, progTraitement: parseInt(e.target.value) || 0 }))} style={{ width: '100%', boxSizing: 'border-box', padding: '7px 8px', fontSize: 12, border: '1px solid #D1D5DB', borderRadius: 6, outline: 'none' }} />
              </div>
            </div>
            <div>
              <label style={{ fontSize: 10, fontWeight: 600, color: '#6B7280', display: 'block', marginBottom: 3 }}>Responsable</label>
              <input value={form.responsable} onChange={e => setForm(f => ({ ...f, responsable: e.target.value }))} style={{ width: '100%', boxSizing: 'border-box', padding: '7px 8px', fontSize: 12, border: '1px solid #D1D5DB', borderRadius: 6, outline: 'none' }} />
            </div>
            <div>
              <label style={{ fontSize: 10, fontWeight: 600, color: '#6B7280', display: 'block', marginBottom: 3 }}>Mesures d'atténuation</label>
              <textarea value={form.mesures} onChange={e => setForm(f => ({ ...f, mesures: e.target.value }))} style={{ width: '100%', boxSizing: 'border-box', padding: '7px 8px', fontSize: 12, border: '1px solid #D1D5DB', borderRadius: 6, outline: 'none', resize: 'vertical', minHeight: 52, fontFamily: 'inherit' }} />
            </div>
          </div>
        )}
        <div style={{ padding: '12px 20px', borderTop: '1px solid #E2E8F0', display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
          <button onClick={onClose} style={{ padding: '8px 16px', borderRadius: 8, border: '1px solid #E2E8F0', background: '#fff', cursor: 'pointer', fontSize: 13, fontFamily: 'inherit' }}>Fermer</button>
          {editMode
            ? <button onClick={handleSave} style={{ padding: '8px 18px', borderRadius: 8, border: 'none', background: '#1B4F8A', color: '#fff', cursor: 'pointer', fontSize: 13, fontWeight: 700, fontFamily: 'inherit' }}>💾 Enregistrer</button>
            : <button onClick={() => setEditMode(true)} style={{ padding: '8px 18px', borderRadius: 8, border: 'none', background: '#1B4F8A', color: '#fff', cursor: 'pointer', fontSize: 13, fontWeight: 700, fontFamily: 'inherit' }}>✏️ Mettre à jour</button>
          }
        </div>
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════════════════
   MODAL: Nouveau Risque
═══════════════════════════════════════════════════════════════════════════════ */

function NouveauRisqueModal({ onClose, onAdd, domaineOptions }: { onClose: () => void; onAdd: (r: Risque) => void; domaineOptions: Domaine[] }) {
  const [form, setForm] = useState({ domaine: (domaineOptions[0] ?? 'Production') as Domaine, categorie: 'Technique' as Categorie, description: '', prob: 3, impact: 3, responsable: '', mesures: '' });
  const score = form.prob * form.impact;

  const handleSave = () => {
    if (!form.description.trim()) return;
    const sc = form.prob * form.impact;
    const crit: Criticite = sc >= 15 ? 'Critique' : sc >= 8 ? 'Important' : sc >= 4 ? 'Modéré' : 'Faible';
    onAdd({
      id: `R-${String(Date.now()).slice(-3)}`,
      domaine: form.domaine,
      categorie: form.categorie,
      description: form.description,
      probabilite: form.prob as 1|2|3|4|5,
      impact: form.impact as 1|2|3|4|5,
      score: sc,
      criticite: crit,
      responsable: form.responsable || 'À définir',
      mesures: form.mesures || 'En cours d\'élaboration',
      statut: 'Actif',
      dateRevision: new Date().toLocaleDateString('fr-FR'),
      progTraitement: 0,
    });
    onClose();
  };

  return (
    <div onClick={onClose} style={{ position: 'fixed', inset: 0, zIndex: 9000, background: 'rgba(27,79,138,0.55)', display: 'flex', alignItems: 'center', justifyContent: 'center', backdropFilter: 'blur(2px)' }}>
      <div onClick={e => e.stopPropagation()} style={{ background: '#fff', borderRadius: 14, boxShadow: '0 20px 60px rgba(0,0,0,0.25)', width: '100%', maxWidth: 560, margin: 16, maxHeight: '90vh', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        <div style={{ background: '#1B4F8A', padding: '16px 20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span style={{ color: '#fff', fontWeight: 800, fontSize: 14 }}>Nouveau Risque</span>
          <button onClick={onClose} style={{ background: 'rgba(255,255,255,0.15)', border: 'none', color: '#fff', borderRadius: 6, padding: '5px 10px', cursor: 'pointer', fontWeight: 700 }}>×</button>
        </div>
        <div style={{ flex: 1, overflowY: 'auto', padding: 20, display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div>
            <label style={labelStyle}>Description du risque *</label>
            <textarea style={{ ...inputStyle, resize: 'vertical' } as React.CSSProperties} rows={3} value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} placeholder="Décrire le risque identifié..." />
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <div>
              <label style={labelStyle}>Domaine</label>
              <select style={inputStyle} value={form.domaine} onChange={e => setForm(f => ({ ...f, domaine: e.target.value as Domaine }))}>
                {domaineOptions.map(d => <option key={d}>{d}</option>)}
              </select>
            </div>
            <div>
              <label style={labelStyle}>Catégorie</label>
              <select style={inputStyle} value={form.categorie} onChange={e => setForm(f => ({ ...f, categorie: e.target.value as Categorie }))}>
                {(['Technique', 'Financier', 'Calendrier', 'Externe', 'Organisationnel'] as Categorie[]).map(c => <option key={c}>{c}</option>)}
              </select>
            </div>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <div>
              <label style={labelStyle}>Probabilité (1–5): <strong style={{ color: '#F47920' }}>{form.prob}</strong></label>
              <input type="range" min={1} max={5} value={form.prob} onChange={e => setForm(f => ({ ...f, prob: +e.target.value }))} style={{ width: '100%' }} />
              <div style={{ fontSize: 10, color: '#94A3B8' }}>{PROB_LABELS[form.prob - 1]}</div>
            </div>
            <div>
              <label style={labelStyle}>Impact (1–5): <strong style={{ color: '#1B4F8A' }}>{form.impact}</strong></label>
              <input type="range" min={1} max={5} value={form.impact} onChange={e => setForm(f => ({ ...f, impact: +e.target.value }))} style={{ width: '100%' }} />
              <div style={{ fontSize: 10, color: '#94A3B8' }}>{IMP_LABELS[form.impact - 1]}</div>
            </div>
          </div>
          <div style={{ padding: '12px 16px', background: cellBg(score), borderRadius: 10, border: `1px solid ${cellColor(score)}40`, display: 'flex', alignItems: 'center', gap: 12 }}>
            <span style={{ fontSize: 28, fontWeight: 800, color: cellColor(score) }}>{score}</span>
            <div>
              <div style={{ fontSize: 13, fontWeight: 700, color: cellColor(score) }}>Score P×I</div>
              <div style={{ fontSize: 11, color: '#64748B' }}>
                {score >= 15 ? 'CRITIQUE' : score >= 8 ? 'IMPORTANT' : score >= 4 ? 'MODÉRÉ' : 'FAIBLE'}
              </div>
            </div>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <div>
              <label style={labelStyle}>Responsable</label>
              <input style={inputStyle} value={form.responsable} onChange={e => setForm(f => ({ ...f, responsable: e.target.value }))} placeholder="Nom responsable" />
            </div>
          </div>
          <div>
            <label style={labelStyle}>Mesures d'atténuation</label>
            <textarea style={{ ...inputStyle, resize: 'vertical' } as React.CSSProperties} rows={3} value={form.mesures} onChange={e => setForm(f => ({ ...f, mesures: e.target.value }))} placeholder="Décrire les actions de traitement..." />
          </div>
        </div>
        <div style={{ padding: '12px 20px', borderTop: '1px solid #E2E8F0', display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
          <button onClick={onClose} style={{ padding: '8px 16px', borderRadius: 8, border: '1px solid #E2E8F0', background: '#fff', cursor: 'pointer', fontSize: 13, fontFamily: 'inherit' }}>Annuler</button>
          <button onClick={handleSave} disabled={!form.description.trim()} style={{ padding: '8px 18px', borderRadius: 8, border: 'none', background: form.description.trim() ? '#EF3340' : '#E5E7EB', color: form.description.trim() ? '#fff' : '#9CA3AF', cursor: form.description.trim() ? 'pointer' : 'default', fontSize: 13, fontWeight: 700, fontFamily: 'inherit' }}>💾 Enregistrer</button>
        </div>
      </div>
    </div>
  );
}

const labelStyle: React.CSSProperties = { fontSize: 12, fontWeight: 600, color: '#374151', display: 'block', marginBottom: 5 };
const inputStyle: React.CSSProperties = { width: '100%', padding: '8px 10px', border: '1px solid #E2E8F0', borderRadius: 7, fontSize: 13, fontFamily: 'inherit', background: '#F8FAFC', boxSizing: 'border-box' };

/* ═══════════════════════════════════════════════════════════════════════════════
   COMPOSANT PRINCIPAL
═══════════════════════════════════════════════════════════════════════════════ */

export default function Risques() {
  const scopeDomaines = useScopeDomaines();
  // Libellés des domaines visibles par le profil courant (RBAC).
  const domaineOptions = useMemo<Domaine[]>(
    () => scopeDomaines.map(c => DOMAINE_CODE_TO_LABEL[c]).filter(Boolean) as Domaine[],
    [scopeDomaines],
  );
  const monoDomaine = domaineOptions.length === 1;

  const [risques, setRisques] = useState<Risque[]>(RISQUES);
  const [filterDomaine, setFilterDomaine] = useState<Domaine | 'Tous'>('Tous');
  const [filterCat, setFilterCat] = useState<Categorie | 'Toutes'>('Toutes');
  const [filterCrit, setFilterCrit] = useState<Criticite | 'Toutes'>('Toutes');
  const [sortCol, setSortCol] = useState<string>('score');
  const [sortAsc, setSortAsc] = useState(false);
  const [selectedRisque, setSelectedRisque] = useState<Risque | null>(null);
  const [showAddModal, setShowAddModal] = useState(false);
  const [heatmapSel, setHeatmapSel] = useState<{ p: number; i: number } | null>(null);

  const handleAddRisque = (r: Risque) => {
    setRisques(prev => [r, ...prev]);
  };

  const handleUpdateRisque = (updated: Risque) => {
    setRisques(prev => prev.map(r => r.id === updated.id ? updated : r));
    setSelectedRisque(null);
  };

  // Périmètre RBAC : un profil ne voit QUE les risques de ses domaines. Toutes les
  // statistiques (KPIs, graphes) sont calculées sur ce sous-ensemble — aucune
  // consolidation avec des projets/domaines hors périmètre.
  const scopedRisques = useMemo(
    () => domaineOptions.length ? risques.filter(r => domaineOptions.includes(r.domaine)) : risques,
    [risques, domaineOptions],
  );

  const kpis = useMemo(() => ({
    critique: scopedRisques.filter(r => r.criticite === 'Critique').length,
    important: scopedRisques.filter(r => r.criticite === 'Important').length,
    modere: scopedRisques.filter(r => r.criticite === 'Modéré').length,
    faible: scopedRisques.filter(r => r.criticite === 'Faible').length,
  }), [scopedRisques]);

  const filtered = useMemo(() => {
    let list = scopedRisques;
    if (filterDomaine !== 'Tous') list = list.filter(r => r.domaine === filterDomaine);
    if (filterCat !== 'Toutes') list = list.filter(r => r.categorie === filterCat);
    if (filterCrit !== 'Toutes') list = list.filter(r => r.criticite === filterCrit);
    return [...list].sort((a, b) => {
      const colMap: Record<string, (r: Risque) => number | string> = {
        score: r => r.score,
        probabilite: r => r.probabilite,
        impact: r => r.impact,
        domaine: r => r.domaine,
        categorie: r => r.categorie,
      };
      const fn = colMap[sortCol] ?? ((r: Risque) => r.score);
      const va = fn(a);
      const vb = fn(b);
      if (typeof va === 'string') return sortAsc ? va.localeCompare(vb as string) : (vb as string).localeCompare(va);
      return sortAsc ? (va as number) - (vb as number) : (vb as number) - (va as number);
    });
  }, [scopedRisques, filterDomaine, filterCat, filterCrit, sortCol, sortAsc]);

  const heatmapCellRisques = heatmapSel
    ? scopedRisques.filter(r => r.probabilite === heatmapSel.p && r.impact === heatmapSel.i)
    : [];

  function toggleSort(col: string) {
    if (sortCol === col) setSortAsc(!sortAsc);
    else { setSortCol(col); setSortAsc(false); }
  }

  const SortIcon = ({ col }: { col: string }) => {
    if (sortCol !== col) return null;
    return sortAsc ? <ChevronUp size={10} /> : <ChevronDown size={10} />;
  };

  const topCritiques = [...scopedRisques]
    .filter(r => r.criticite === 'Critique' || (r.criticite === 'Important' && r.score >= 12))
    .sort((a, b) => b.score - a.score)
    .slice(0, 3);

  return (
    <div style={{ flex: 1, overflowY: 'auto', padding: 20, background: '#F4F6F9' }}>

      {/* ── Header ───────────────────────────────────────────────────────────── */}
      <div style={{ background: '#1B4F8A', borderRadius: 12, padding: '14px 20px', marginBottom: 20, display: 'flex', flexWrap: 'wrap', gap: 12, alignItems: 'center' }}>
        <div style={{ flex: 1, minWidth: 200 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <Shield size={20} color="#F47920" />
            <span style={{ color: '#fff', fontSize: 16, fontWeight: 800 }}>Registre des Risques</span>
          </div>
          <div style={{ color: 'rgba(255,255,255,0.6)', fontSize: 11, marginTop: 3, paddingLeft: 30 }}>Gestion des risques projets — {monoDomaine ? domaineOptions[0] : `${domaineOptions.length || 4} domaine(s)`} · {scopedRisques.length} risques</div>
        </div>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
          {!monoDomaine && (
            <select value={filterDomaine} onChange={e => setFilterDomaine(e.target.value as Domaine | 'Tous')} style={{ padding: '6px 10px', borderRadius: 7, border: 'none', fontSize: 12, fontFamily: 'inherit', background: 'rgba(255,255,255,0.15)', color: '#fff', cursor: 'pointer' }}>
              <option value="Tous" style={{ color: '#1B4F8A' }}>Tous domaines</option>
              {domaineOptions.map(d => <option key={d} value={d} style={{ color: '#1B4F8A' }}>{d}</option>)}
            </select>
          )}
          <button onClick={() => setShowAddModal(true)} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '7px 14px', borderRadius: 8, border: 'none', background: '#EF3340', color: '#fff', cursor: 'pointer', fontSize: 12, fontWeight: 700, fontFamily: 'inherit' }}>
            <Plus size={13} /> Nouveau Risque
          </button>
          <button style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '7px 14px', borderRadius: 8, border: '1px solid rgba(255,255,255,0.3)', background: 'transparent', color: '#fff', cursor: 'pointer', fontSize: 12, fontWeight: 700, fontFamily: 'inherit' }}>
            <Download size={13} /> Exporter
          </button>
        </div>
      </div>

      {/* ── Row 1: KPI Cards ─────────────────────────────────────────────────── */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px,1fr))', gap: 14, marginBottom: 20 }}>
        {([
          { label: 'Risques critiques', sub: 'Score ≥ 16', count: kpis.critique, crit: 'Critique' as Criticite },
          { label: 'Risques importants', sub: 'Score 9–15', count: kpis.important, crit: 'Important' as Criticite },
          { label: 'Risques modérés', sub: 'Score 4–8', count: kpis.modere, crit: 'Modéré' as Criticite },
          { label: 'Risques faibles', sub: 'Score 1–3', count: kpis.faible, crit: 'Faible' as Criticite },
        ] as { label: string; sub: string; count: number; crit: Criticite }[]).map(kpi => {
          const colors = criticiteKpiColor(kpi.crit);
          return (
            <div key={kpi.label} style={{ background: '#fff', borderRadius: 12, boxShadow: '0 1px 4px rgba(0,0,0,0.07)', padding: '16px 18px', borderLeft: `4px solid ${colors.text}` }}>
              <div style={{ fontSize: 32, fontWeight: 800, color: colors.text }}>{kpi.count}</div>
              <div style={{ fontSize: 12, fontWeight: 700, color: '#374151', marginTop: 2 }}>{kpi.label}</div>
              <div style={{ fontSize: 10, color: '#94A3B8', marginTop: 2 }}>{kpi.sub}</div>
            </div>
          );
        })}
      </div>

      {/* ── Row 2: Heatmap 5×5 ──────────────────────────────────────────────── */}
      <div style={{ background: '#fff', borderRadius: 12, boxShadow: '0 1px 4px rgba(0,0,0,0.07)', padding: 20, marginBottom: 20 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
          <div>
            <div style={{ fontWeight: 800, fontSize: 15, color: '#1B4F8A' }}>Matrice de Risques — 5×5</div>
            <div style={{ fontSize: 11, color: '#94A3B8' }}>Cliquez sur une cellule pour voir les risques correspondants</div>
          </div>
          <div style={{ display: 'flex', gap: 12 }}>
            {[{ label: '1–3 Faible', color: '#16A34A' }, { label: '4–7 Modéré', color: '#F59E0B' }, { label: '8–14 Important', color: '#F47920' }, { label: '15–25 Critique', color: '#EF3340' }].map(l => (
              <div key={l.label} style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                <div style={{ width: 12, height: 12, borderRadius: 3, background: l.color, opacity: 0.8 }} />
                <span style={{ fontSize: 10, color: '#64748B' }}>{l.label}</span>
              </div>
            ))}
          </div>
        </div>

        <div style={{ display: 'flex', gap: 16 }}>
          {/* Matrix */}
          <div style={{ flex: 1 }}>
            {/* Impact axis header */}
            <div style={{ display: 'flex', marginLeft: 80, marginBottom: 4 }}>
              {IMP_LABELS.map(l => (
                <div key={l} style={{ flex: 1, fontSize: 9, color: '#94A3B8', textAlign: 'center', lineHeight: 1.3 }}>{l}</div>
              ))}
            </div>
            <div style={{ display: 'flex', alignItems: 'center', marginBottom: 2, marginLeft: 80 }}>
              <div style={{ fontSize: 9, fontWeight: 700, color: '#94A3B8', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Impact →</div>
            </div>

            {/* Grid rows P: 5→1 */}
            {[5, 4, 3, 2, 1].map(p => (
              <div key={p} style={{ display: 'flex', gap: 4, marginBottom: 4, alignItems: 'stretch' }}>
                <div style={{ width: 80, flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'flex-end', paddingRight: 8 }}>
                  <span style={{ fontSize: 9, color: '#94A3B8', textAlign: 'right', lineHeight: 1.3 }}>{PROB_LABELS[p - 1]}</span>
                </div>
                {[1, 2, 3, 4, 5].map(i => {
                  const score = p * i;
                  const col = cellColor(score);
                  const bg = cellBg(score);
                  const cellRisques = scopedRisques.filter(r => r.probabilite === p && r.impact === i);
                  const isActive = heatmapSel?.p === p && heatmapSel?.i === i;
                  return (
                    <div key={i} onClick={() => setHeatmapSel(prev => prev?.p === p && prev?.i === i ? null : { p, i })}
                      style={{
                        flex: 1, minHeight: 64, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'flex-start',
                        padding: '5px 3px', background: bg, border: isActive ? `2px solid ${col}` : `1px solid ${col}30`,
                        borderRadius: 8, cursor: 'pointer', transition: 'all 0.12s', boxShadow: isActive ? `0 0 0 3px ${col}30` : 'none',
                      }}>
                      <span style={{ fontSize: 11, fontWeight: 800, color: col }}>{score}</span>
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 2, justifyContent: 'center', marginTop: 2 }}>
                        {cellRisques.map(r => (
                          <span key={r.id} style={{ fontSize: 7, fontWeight: 700, background: `${col}30`, color: col, borderRadius: 3, padding: '1px 3px', whiteSpace: 'nowrap' }}>
                            {r.id}
                          </span>
                        ))}
                      </div>
                    </div>
                  );
                })}
              </div>
            ))}
            <div style={{ marginLeft: 80, fontSize: 9, fontWeight: 700, color: '#94A3B8', textTransform: 'uppercase', letterSpacing: '0.06em', marginTop: 4, textAlign: 'center' }}>← Probabilité</div>
          </div>

          {/* Selected cell panel */}
          {heatmapSel && (
            <div style={{ width: 280, flexShrink: 0, background: '#F8FAFC', borderRadius: 10, padding: 14 }}>
              <div style={{ fontWeight: 700, fontSize: 12, color: '#1B4F8A', marginBottom: 10 }}>
                Cellule P={heatmapSel.p} × I={heatmapSel.i} · Score={heatmapSel.p * heatmapSel.i}
              </div>
              {heatmapCellRisques.length === 0 ? (
                <div style={{ color: '#94A3B8', fontSize: 12 }}>Aucun risque dans cette cellule</div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {heatmapCellRisques.map(r => (
                    <div key={r.id} onClick={() => setSelectedRisque(r)} style={{ background: '#fff', borderRadius: 8, padding: '10px 12px', cursor: 'pointer', border: '1px solid #E2E8F0', boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
                      <div style={{ fontSize: 10, color: '#94A3B8', marginBottom: 2 }}>{r.id} · {r.domaine}</div>
                      <div style={{ fontSize: 12, fontWeight: 700, color: '#1B4F8A' }}>{r.description}</div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 6 }}>
                        <span style={{ fontSize: 10, fontWeight: 700, padding: '2px 7px', borderRadius: 20, background: `${criticiteColor(r.criticite)}18`, color: criticiteColor(r.criticite) }}>{r.criticite}</span>
                        <span style={{ fontSize: 10, color: '#94A3B8' }}>{r.responsable}</span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
              <button onClick={() => setHeatmapSel(null)} style={{ marginTop: 12, width: '100%', padding: '6px 0', borderRadius: 7, border: '1px solid #E2E8F0', background: '#fff', cursor: 'pointer', fontSize: 11, fontFamily: 'inherit', color: '#64748B' }}>Fermer</button>
            </div>
          )}
        </div>
      </div>

      {/* ── Row 3: Charts ──────────────────────────────────────────────────── */}
      <div style={{ display: 'grid', gridTemplateColumns: '45% 55%', gap: 16, marginBottom: 20 }}>
        {/* Stacked bar by domain */}
        <div style={{ background: '#fff', borderRadius: 12, boxShadow: '0 1px 4px rgba(0,0,0,0.07)', padding: 20 }}>
          <div style={{ fontWeight: 700, fontSize: 14, color: '#1B4F8A', marginBottom: 16 }}>Risques par domaine et catégorie</div>
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={DOMAINE_CHART_DATA.filter(d => !domaineOptions.length || domaineOptions.includes(d.domain as Domaine))} margin={{ top: 4, right: 10, left: -20, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#F1F5F9" />
              <XAxis dataKey="domain" tick={{ fontSize: 10 }} />
              <YAxis tick={{ fontSize: 10 }} />
              <Tooltip contentStyle={{ fontSize: 11, borderRadius: 8 }} />
              <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: 10 }} />
              <Bar dataKey="Technique" stackId="a" fill={CAT_COLORS.Technique} />
              <Bar dataKey="Financier" stackId="a" fill={CAT_COLORS.Financier} />
              <Bar dataKey="Calendrier" stackId="a" fill={CAT_COLORS.Calendrier} />
              <Bar dataKey="Externe" stackId="a" fill={CAT_COLORS.Externe} />
              <Bar dataKey="Organisationnel" stackId="a" fill={CAT_COLORS.Organisationnel} radius={[3, 3, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Evolution risques */}
        <div style={{ background: '#fff', borderRadius: 12, boxShadow: '0 1px 4px rgba(0,0,0,0.07)', padding: 20 }}>
          <div style={{ fontWeight: 700, fontSize: 14, color: '#1B4F8A', marginBottom: 16 }}>Évolution exposition aux risques</div>
          <ResponsiveContainer width="100%" height={220}>
            <LineChart data={EVOLUTION_RISQUES} margin={{ top: 4, right: 20, left: -10, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#F1F5F9" />
              <XAxis dataKey="mois" tick={{ fontSize: 9 }} />
              <YAxis yAxisId="left" tick={{ fontSize: 9 }} domain={[35, 55]} />
              <YAxis yAxisId="right" orientation="right" tick={{ fontSize: 9 }} domain={[7, 11]} />
              <Tooltip contentStyle={{ fontSize: 11, borderRadius: 8 }} />
              <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: 10 }} />
              <Line yAxisId="left" type="monotone" dataKey="actifs" name="Risques actifs" stroke="#EF3340" strokeWidth={2} dot={{ r: 3 }} />
              <Line yAxisId="right" type="monotone" dataKey="exposition" name="Score exposition moy." stroke="#F47920" strokeWidth={2} strokeDasharray="5 3" dot={{ r: 3 }} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* ── Row 4: Risk Register Table ──────────────────────────────────────── */}
      <div style={{ background: '#fff', borderRadius: 12, boxShadow: '0 1px 4px rgba(0,0,0,0.07)', padding: 20, marginBottom: 20 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14, flexWrap: 'wrap', gap: 10 }}>
          <div>
            <div style={{ fontWeight: 800, fontSize: 15, color: '#1B4F8A' }}>Registre des risques</div>
            <div style={{ fontSize: 11, color: '#94A3B8' }}>{filtered.length} risques affichés</div>
          </div>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
            <Filter size={13} color="#94A3B8" />
            <select value={filterCat} onChange={e => setFilterCat(e.target.value as Categorie | 'Toutes')} style={{ padding: '6px 10px', borderRadius: 7, border: '1px solid #E2E8F0', fontSize: 11, fontFamily: 'inherit', background: '#F8FAFC' }}>
              <option value="Toutes">Toutes catégories</option>
              {(['Technique', 'Financier', 'Calendrier', 'Externe', 'Organisationnel'] as Categorie[]).map(c => <option key={c} value={c}>{c}</option>)}
            </select>
            <select value={filterCrit} onChange={e => setFilterCrit(e.target.value as Criticite | 'Toutes')} style={{ padding: '6px 10px', borderRadius: 7, border: '1px solid #E2E8F0', fontSize: 11, fontFamily: 'inherit', background: '#F8FAFC' }}>
              <option value="Toutes">Toutes criticités</option>
              {(['Critique', 'Important', 'Modéré', 'Faible'] as Criticite[]).map(c => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>
        </div>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 1000 }}>
            <thead>
              <tr>
                {[
                  { col: 'id', label: '#' },
                  { col: 'domaine', label: 'Domaine' },
                  { col: 'categorie', label: 'Catégorie' },
                  { col: 'description', label: 'Description du risque' },
                  { col: 'probabilite', label: 'P' },
                  { col: 'impact', label: 'I' },
                  { col: 'score', label: 'Score' },
                  { col: 'criticite', label: 'Criticité' },
                  { col: 'responsable', label: 'Responsable' },
                  { col: 'statut', label: 'Statut' },
                  { col: 'dateRevision', label: 'Date rév.' },
                  { col: 'actions', label: 'Actions' },
                ].map(h => (
                  <th key={h.col} onClick={() => !['description', 'mesures', 'actions', 'dateRevision'].includes(h.col) && toggleSort(h.col)}
                    style={{ textAlign: 'left', fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.5px', color: '#94A3B8', padding: '8px 10px', borderBottom: '1px solid #F1F5F9', whiteSpace: 'nowrap', cursor: ['description', 'mesures', 'actions', 'dateRevision'].includes(h.col) ? 'default' : 'pointer', userSelect: 'none' }}>
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 3 }}>{h.label} <SortIcon col={h.col} /></span>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.map(r => (
                <tr key={r.id} style={{ borderBottom: '1px solid #F8FAFC', cursor: 'pointer' }}
                  onMouseEnter={e => (e.currentTarget.style.background = '#F8FAFC')}
                  onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
                  onClick={() => setSelectedRisque(r)}>
                  <td style={{ padding: '9px 10px', fontSize: 10, fontWeight: 700, color: '#94A3B8' }}>{r.id}</td>
                  <td style={{ padding: '9px 10px', fontSize: 11 }}>
                    <span style={{ padding: '2px 7px', borderRadius: 5, fontSize: 10, fontWeight: 700, background: 'rgba(27,79,138,0.1)', color: '#1B4F8A' }}>{r.domaine}</span>
                  </td>
                  <td style={{ padding: '9px 10px' }}>
                    <span style={{ padding: '2px 7px', borderRadius: 5, fontSize: 10, fontWeight: 700, background: `${CAT_COLORS[r.categorie]}18`, color: CAT_COLORS[r.categorie] }}>{r.categorie}</span>
                  </td>
                  <td style={{ padding: '9px 10px', fontSize: 12, maxWidth: 240, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={r.description}>{r.description}</td>
                  <td style={{ padding: '9px 10px', textAlign: 'center', fontSize: 14, fontWeight: 800, color: '#F47920' }}>{r.probabilite}</td>
                  <td style={{ padding: '9px 10px', textAlign: 'center', fontSize: 14, fontWeight: 800, color: '#1B4F8A' }}>{r.impact}</td>
                  <td style={{ padding: '9px 10px', textAlign: 'center' }}>
                    <span style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: 32, height: 22, borderRadius: 6, background: cellBg(r.score), color: cellColor(r.score), fontSize: 12, fontWeight: 800 }}>{r.score}</span>
                  </td>
                  <td style={{ padding: '9px 10px' }}>
                    <span style={{ fontSize: 10, fontWeight: 700, padding: '3px 8px', borderRadius: 20, background: `${criticiteColor(r.criticite)}18`, color: criticiteColor(r.criticite) }}>{r.criticite}</span>
                  </td>
                  <td style={{ padding: '9px 10px', fontSize: 11, color: '#64748B', whiteSpace: 'nowrap' }}>{r.responsable}</td>
                  <td style={{ padding: '9px 10px' }}>
                    <span style={{ fontSize: 10, fontWeight: 700, padding: '3px 8px', borderRadius: 20, background: `${statutColor(r.statut)}18`, color: statutColor(r.statut) }}>{r.statut}</span>
                  </td>
                  <td style={{ padding: '9px 10px', fontSize: 11, color: '#94A3B8', whiteSpace: 'nowrap' }}>{r.dateRevision}</td>
                  <td style={{ padding: '9px 10px' }}>
                    <button onClick={e => { e.stopPropagation(); setSelectedRisque(r); }} style={{ padding: '4px 10px', borderRadius: 6, border: '1px solid #E2E8F0', background: '#fff', cursor: 'pointer', fontSize: 11, fontFamily: 'inherit', color: '#1B4F8A' }}>Voir</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* ── Row 5: Treatment Plans (Top 3) ──────────────────────────────────── */}
      <div style={{ marginBottom: 20 }}>
        <div style={{ fontWeight: 800, fontSize: 15, color: '#1B4F8A', marginBottom: 14 }}>Plans de traitement — Risques prioritaires</div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px,1fr))', gap: 14 }}>
          {topCritiques.map(r => (
            <div key={r.id} style={{ background: '#fff', borderRadius: 12, boxShadow: '0 1px 4px rgba(0,0,0,0.07)', overflow: 'hidden', borderTop: `3px solid ${criticiteColor(r.criticite)}` }}>
              <div style={{ padding: '14px 16px', borderBottom: '1px solid #F1F5F9' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8 }}>
                  <div>
                    <div style={{ fontSize: 10, color: '#94A3B8', marginBottom: 2 }}>{r.id} · {r.domaine} · {r.categorie}</div>
                    <div style={{ fontSize: 13, fontWeight: 700, color: '#1B4F8A', maxWidth: 240 }}>{r.description}</div>
                  </div>
                  <div style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: 36, height: 36, borderRadius: 8, background: cellBg(r.score), color: cellColor(r.score), fontSize: 16, fontWeight: 800, flexShrink: 0 }}>
                    {r.score}
                  </div>
                </div>
                <span style={{ fontSize: 10, fontWeight: 700, padding: '3px 8px', borderRadius: 20, background: `${criticiteColor(r.criticite)}18`, color: criticiteColor(r.criticite) }}>{r.criticite}</span>
              </div>
              <div style={{ padding: '12px 16px' }}>
                <div style={{ fontSize: 11, color: '#64748B', marginBottom: 10, lineHeight: 1.55 }}>{r.mesures}</div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 11, color: '#374151' }}>
                    <AlertTriangle size={11} color={criticiteColor(r.criticite)} />
                    <span style={{ fontWeight: 600 }}>{r.responsable}</span>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 11, color: '#94A3B8' }}>
                    <Clock size={11} />
                    {r.dateRevision}
                  </div>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                  <span style={{ fontSize: 11, color: '#94A3B8' }}>Traitement</span>
                  <span style={{ fontSize: 11, fontWeight: 700, color: r.progTraitement >= 70 ? '#16A34A' : r.progTraitement >= 40 ? '#F47920' : '#EF3340' }}>{r.progTraitement}%</span>
                </div>
                <div style={{ height: 6, background: '#F1F5F9', borderRadius: 3, overflow: 'hidden' }}>
                  <div style={{ height: '100%', width: `${r.progTraitement}%`, background: r.progTraitement >= 70 ? '#16A34A' : r.progTraitement >= 40 ? '#F47920' : '#EF3340', borderRadius: 3 }} />
                </div>
                <button onClick={() => setSelectedRisque(r)} style={{ marginTop: 12, width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, padding: '8px 0', borderRadius: 8, border: '1px solid #E2E8F0', background: '#fff', cursor: 'pointer', fontSize: 12, fontFamily: 'inherit', color: '#1B4F8A', fontWeight: 700 }}>
                  <TrendingUp size={13} /> Voir plan complet
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Modals */}
      {selectedRisque && <RisqueDetailModal risque={selectedRisque} onClose={() => setSelectedRisque(null)} onUpdate={handleUpdateRisque} />}
      {showAddModal && <NouveauRisqueModal onClose={() => setShowAddModal(false)} onAdd={handleAddRisque} domaineOptions={domaineOptions} />}
    </div>
  );
}

'use client';

import { useState, useMemo, useCallback } from 'react';
import {
  Building2, AlertTriangle, Calculator, FileText, Download,
  Search, Filter, ChevronDown, ChevronUp, Clock, TrendingUp,
  Wallet, CheckCircle2, XCircle, ArrowUpRight, ArrowDownRight,
  Printer, Eye, Plus, Trash2, Pencil, Save, X,
} from 'lucide-react';
import { SENELEC_LOGO_DATA_URI } from '@/lib/senelecLogo';

/* ─── Types ─────────────────────────────────────────────────────────────────── */

type StatutFournisseur = 'actif' | 'suspendu' | 'blacklist';
type StatutFacture = 'impayee' | 'partielle' | 'payee' | 'litige';

interface Facture {
  id: string;
  ref: string;
  montantHT: number;
  montantTTC: number;
  tva: number;
  dateEmission: string;
  dateEcheance: string;
  datePaiement?: string;
  montantPaye: number;
  montantDu: number;
  joursRetard: number;
  interetsMoratoires: number;
  statut: StatutFacture;
  marcheRef?: string;
  projet?: string;
}

interface Fournisseur {
  id: string;
  code: string;
  raisonSociale: string;
  type: string;               // GC, Fournitures, Conseil, etc.
  statut: StatutFournisseur;
  contact: string;
  email: string;
  telephone: string;
  adresse: string;
  ville: string;
  ninea: string;
  rc: string;
  iban?: string;
  banque?: string;
  agregeSenelec: boolean;
  dateAgrement?: string;
  delaiPaiementContractuel: number; // jours
  tauxInteretMoratoire: number;     // % annuel (ex: 9.5 pour BCEAO + 5)
  factures: Facture[];
  // Propriétés calculées (injectées via useMemo)
  totalDu?: number;
  totalInterets?: number;
  nbImpayees?: number;
  nbLitiges?: number;
}

/* ─── Configuration ─────────────────────────────────────────────────────────── */

const TAUX_LEGAL_DEFAUT = 9.5; // BCEAO taux directeur ~4.5% + 5 points
const TAUX_BCEAO = 4.5;

const CFG_STATUT_FOURNISSEUR: Record<StatutFournisseur, { label: string; color: string; bg: string }> = {
  actif:     { label: 'Actif',     color: '#16A34A', bg: '#DCFCE7' },
  suspendu:  { label: 'Suspendu',  color: '#D97706', bg: '#FFFBEB' },
  blacklist: { label: 'Blacklist', color: '#EF3340', bg: '#FEE2E2' },
};

const CFG_STATUT_FACTURE: Record<StatutFacture, { label: string; color: string; bg: string }> = {
  impayee:   { label: 'Impayée',   color: '#EF3340', bg: '#FEE2E2' },
  partielle: { label: 'Partielle', color: '#D97706', bg: '#FFFBEB' },
  payee:     { label: 'Payée',     color: '#16A34A', bg: '#DCFCE7' },
  litige:    { label: 'Litige',    color: '#7C3AED', bg: '#F5F3FF' },
};

/* ─── Fonction de calcul des intérêts moratoires ────────────────────────────────
   Formule OHADA / droit sénégalais :
   Intérêts = Montant dû × Taux annuel × (Jours de retard / 365)
   Le taux de base est le taux directeur BCEAO majoré de 5 points (arrêté 2024).
═══════════════════════════════════════════════════════════════════════════════ */

function calculInteretsMoratoires(montantDu: number, joursRetard: number, tauxAnnuel: number): number {
  if (joursRetard <= 0 || montantDu <= 0) return 0;
  const interets = montantDu * (tauxAnnuel / 100) * (joursRetard / 365);
  return Math.round(interets * 100) / 100;
}

function fmtN(v: number): string {
  return v.toLocaleString('fr-FR', { minimumFractionDigits: 0, maximumFractionDigits: 0 });
}
function fmtN2(v: number): string {
  return v.toLocaleString('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

/* ─── Données de démonstration ──────────────────────────────────────────────── */

function genererFactures(fournisseurId: string, taux: number): Facture[] {
  const today = new Date('2026-05-28');
  const base: Facture[] = [
    { id: `${fournisseurId}-F001`, ref: 'FAC-2026-0412', montantHT: 45_000_000, tva: 8_100_000, montantTTC: 53_100_000, dateEmission: '15/02/2026', dateEcheance: '15/03/2026', montantPaye: 0, montantDu: 53_100_000, joursRetard: 0, interetsMoratoires: 0, statut: 'impayee', marcheRef: 'M-HTA-NORD-2024', projet: 'PRJ-DER-2024-001' },
    { id: `${fournisseurId}-F002`, ref: 'FAC-2026-0418', montantHT: 28_500_000, tva: 5_130_000, montantTTC: 33_630_000, dateEmission: '20/02/2026', dateEcheance: '22/03/2026', montantPaye: 15_000_000, montantDu: 18_630_000, joursRetard: 0, interetsMoratoires: 0, statut: 'partielle', marcheRef: 'M-BT-SUD-2025', projet: 'PRJ-DPD-2024-007' },
    { id: `${fournisseurId}-F003`, ref: 'FAC-2026-0503', montantHT: 62_000_000, tva: 11_160_000, montantTTC: 73_160_000, dateEmission: '10/03/2026', dateEcheance: '10/04/2026', montantPaye: 73_160_000, montantDu: 0, joursRetard: 0, interetsMoratoires: 0, statut: 'payee', marcheRef: 'M-TRANS-2024', projet: 'PRJ-DER-2023-005' },
    { id: `${fournisseurId}-F004`, ref: 'FAC-2026-0521', montantHT: 18_200_000, tva: 3_276_000, montantTTC: 21_476_000, dateEmission: '28/03/2026', dateEcheance: '28/04/2026', montantPaye: 0, montantDu: 21_476_000, joursRetard: 0, interetsMoratoires: 0, statut: 'litige', marcheRef: 'M-GC-2025', projet: 'PRJ-DGC-2025-012' },
  ];
  return base.map(f => {
    const [jE, mE, aE] = f.dateEcheance.split('/').map(Number);
    const echeance = new Date(aE, mE - 1, jE);
    const jr = Math.max(0, Math.floor((today.getTime() - echeance.getTime()) / (1000 * 60 * 60 * 24)));
    const md = f.statut === 'payee' ? 0 : f.montantTTC - f.montantPaye;
    const im = calculInteretsMoratoires(md, jr, taux);
    return { ...f, joursRetard: jr, montantDu: md, interetsMoratoires: im };
  });
}

const FOURNISSEURS_INITIAUX: Fournisseur[] = [
  {
    id: 'F001', code: 'F-SATEG-001', raisonSociale: 'SATEG Sénégal', type: 'Génie Civil', statut: 'actif',
    contact: 'Mamadou BA', email: 'm.ba@sateg.sn', telephone: '+221 33 824 12 00', adresse: 'Zone industrielle, Parcelles Assainies', ville: 'Dakar',
    ninea: '005162652', rc: 'SN-DKR-2015-B-11234', iban: 'SN08 SNIB 0123 4567 8901 2345', banque: 'SGBS',
    agregeSenelec: true, dateAgrement: '2018-03-15', delaiPaiementContractuel: 30, tauxInteretMoratoire: TAUX_LEGAL_DEFAUT,
    factures: genererFactures('F001', TAUX_LEGAL_DEFAUT),
  },
  {
    id: 'F002', code: 'F-AFRICA-002', raisonSociale: 'Africa Poles Ltd', type: 'Fournitures électriques', statut: 'actif',
    contact: 'Aminata DIOP', email: 'contact@africapoles.com', telephone: '+221 33 889 45 00', adresse: 'Sicap Liberté, Villa n°45', ville: 'Dakar',
    ninea: '003284712', rc: 'SN-DKR-2012-B-08912', iban: 'SN05 CBAO 0099 1122 3344 5566', banque: 'CBAO',
    agregeSenelec: true, dateAgrement: '2016-07-20', delaiPaiementContractuel: 45, tauxInteretMoratoire: 10.5,
    factures: genererFactures('F002', 10.5),
  },
  {
    id: 'F003', code: 'F-TRACT-003', raisonSociale: 'Tractebel Engineering', type: 'Bureau d\'études', statut: 'actif',
    contact: 'Jean-Pierre MARTIN', email: 'jp.martin@tractebel.engie.com', telephone: '+32 2 773 98 00', adresse: 'Avenue Ariane 7', ville: 'Bruxelles',
    ninea: 'N/A — UE', rc: 'BE 0403.471.292', iban: 'BE68 5390 0754 7034', banque: 'ING Belgique',
    agregeSenelec: true, dateAgrement: '2019-01-10', delaiPaiementContractuel: 60, tauxInteretMoratoire: 8.0,
    factures: genererFactures('F003', 8.0),
  },
  {
    id: 'F004', code: 'F-COLAS-004', raisonSociale: 'Colas Sénégal SA', type: 'VRD / Génie Civil', statut: 'actif',
    contact: 'Ibrahima SOW', email: 'i.sow@colas.sn', telephone: '+221 33 832 15 00', adresse: 'Route de Rufisque, KM 5', ville: 'Dakar',
    ninea: '004562198', rc: 'SN-DKR-2010-B-06789', iban: 'SN12 BICIS 0077 8899 0011 2233', banque: 'BICIS',
    agregeSenelec: true, dateAgrement: '2015-11-05', delaiPaiementContractuel: 30, tauxInteretMoratoire: TAUX_LEGAL_DEFAUT,
    factures: genererFactures('F004', TAUX_LEGAL_DEFAUT),
  },
  {
    id: 'F005', code: 'F-ECO-005', raisonSociale: 'ÉcoÉnergie SARL', type: 'Solaire / Renouvelable', statut: 'suspendu',
    contact: 'Fatou DIAW', email: 'f.diaw@ecoenergie.sn', telephone: '+221 77 654 32 10', adresse: 'Mermoz, Résidence du Parc', ville: 'Dakar',
    ninea: '006789345', rc: 'SN-DKR-2021-B-02345', iban: 'SN09 NSIA 0101 0202 0303 0404', banque: 'NSIA',
    agregeSenelec: false, delaiPaiementContractuel: 30, tauxInteretMoratoire: 11.0,
    factures: genererFactures('F005', 11.0),
  },
];

/* ═══════════════════════════════════════════════════════════════════════════════
   COMPOSANT PRINCIPAL
═══════════════════════════════════════════════════════════════════════════════ */

export default function Fournisseurs() {
  const [fournisseurs, setFournisseurs] = useState<Fournisseur[]>(FOURNISSEURS_INITIAUX);
  const [search, setSearch] = useState('');
  const [filtreStatut, setFiltreStatut] = useState<'tous' | StatutFournisseur>('tous');
  const [filtreType, setFiltreType] = useState<string>('tous');
  const [selectedFournisseur, setSelectedFournisseur] = useState<Fournisseur | null>(null);
  const [selectedFacture, setSelectedFacture] = useState<Facture | null>(null);
  const [showDetail, setShowDetail] = useState(false);
  const [recalcKey, setRecalcKey] = useState(0);
  const [editTauxId, setEditTauxId] = useState<string | null>(null);
  const [nouveauTaux, setNouveauTaux] = useState('');

  /* ─── Recalcul global des intérêts ────────────────────────────────────────── */
  const data = useMemo(() => {
    const today = new Date('2026-05-28');
    return fournisseurs.map(f => {
      const facturesRecalc = f.factures.map(fac => {
        const [jE, mE, aE] = fac.dateEcheance.split('/').map(Number);
        const echeance = new Date(aE, mE - 1, jE);
        const jr = Math.max(0, Math.floor((today.getTime() - echeance.getTime()) / (1000 * 60 * 60 * 24)));
        const md = fac.statut === 'payee' ? 0 : fac.montantTTC - fac.montantPaye;
        const im = calculInteretsMoratoires(md, jr, f.tauxInteretMoratoire);
        return { ...fac, joursRetard: jr, montantDu: md, interetsMoratoires: im };
      });
      const totalDu = facturesRecalc.reduce((s, f) => s + f.montantDu, 0);
      const totalInterets = facturesRecalc.reduce((s, f) => s + f.interetsMoratoires, 0);
      const nbImpayees = facturesRecalc.filter(f => f.statut === 'impayee' || f.statut === 'partielle').length;
      const nbLitiges = facturesRecalc.filter(f => f.statut === 'litige').length;
      return { ...f, factures: facturesRecalc, totalDu, totalInterets, nbImpayees, nbLitiges };
    });
  }, [fournisseurs, recalcKey]);

  /* ─── Filtres ─────────────────────────────────────────────────────────────── */
  const types = useMemo(() => ['tous', ...Array.from(new Set(data.map(f => f.type)))], [data]);

  const filtered = useMemo(() => {
    return data.filter(f => {
      const s = search.toLowerCase();
      const matchSearch = !s || f.raisonSociale.toLowerCase().includes(s) || f.code.toLowerCase().includes(s) || f.ninea.includes(s);
      const matchStatut = filtreStatut === 'tous' || f.statut === filtreStatut;
      const matchType = filtreType === 'tous' || f.type === filtreType;
      return matchSearch && matchStatut && matchType;
    });
  }, [data, search, filtreStatut, filtreType]);

  /* ─── KPIs consolidés ─────────────────────────────────────────────────────── */
  const kpis = useMemo(() => {
    const totalDette = data.reduce((s, f) => s + f.totalDu, 0);
    const totalInterets = data.reduce((s, f) => s + f.totalInterets, 0);
    const totalFacturesImpayees = data.reduce((s, f) => s + f.nbImpayees, 0);
    const nbFournisseurs = data.length;
    const fournisseursRetard = data.filter(f => f.nbImpayees > 0).length;
    const detteCritique = data.filter(f => f.totalDu > 50_000_000).length;
    return { totalDette, totalInterets, totalFacturesImpayees, nbFournisseurs, fournisseursRetard, detteCritique };
  }, [data]);

  /* ─── Handlers ────────────────────────────────────────────────────────────── */
  const handleRecalculer = useCallback(() => setRecalcKey(k => k + 1), []);

  const handleModifierTaux = (id: string, tauxActuel: number) => {
    setEditTauxId(id);
    setNouveauTaux(String(tauxActuel));
  };

  const handleSauverTaux = (id: string) => {
    const taux = parseFloat(nouveauTaux);
    if (isNaN(taux) || taux < 0 || taux > 50) { alert('Veuillez saisir un taux valide entre 0 et 50%.'); return; }
    setFournisseurs(prev => prev.map(f => f.id === id ? { ...f, tauxInteretMoratoire: taux } : f));
    setEditTauxId(null);
    setRecalcKey(k => k + 1);
  };

  const handleSimulerPaiement = (fournisseurId: string, factureId: string) => {
    const montantStr = prompt('Montant du paiement simulé (FCFA) :');
    if (!montantStr) return;
    const montant = parseFloat(montantStr.replace(/\s/g, ''));
    if (isNaN(montant) || montant <= 0) { alert('Montant invalide.'); return; }
    setFournisseurs(prev => prev.map(f => {
      if (f.id !== fournisseurId) return f;
      const factures = f.factures.map(fac => {
        if (fac.id !== factureId) return fac;
        const nouveauPaye = fac.montantPaye + montant;
        const nouveauDu = Math.max(0, fac.montantTTC - nouveauPaye);
        let nouveauStatut: StatutFacture = fac.statut;
        if (nouveauDu <= 0) nouveauStatut = 'payee';
        else if (nouveauPaye > 0) nouveauStatut = 'partielle';
        return { ...fac, montantPaye: nouveauPaye, montantDu: nouveauDu, statut: nouveauStatut };
      });
      return { ...f, factures };
    }));
    setRecalcKey(k => k + 1);
    alert(`Paiement de ${fmtN(montant)} FCFA enregistré.`);
  };

  const handleResoudreLitige = (fournisseurId: string, factureId: string) => {
    setFournisseurs(prev => prev.map(f => {
      if (f.id !== fournisseurId) return f;
      return {
        ...f,
        factures: f.factures.map(fac =>
          fac.id === factureId
            ? { ...fac, statut: (fac.montantDu <= 0 ? 'payee' : fac.montantPaye > 0 ? 'partielle' : 'impayee') as StatutFacture }
            : fac,
        ),
      };
    }));
    setRecalcKey(k => k + 1);
  };

  const handleExportPDF = () => {
    const pw = window.open('', '_blank');
    if (!pw) { alert('Veuillez autoriser les popups.'); return; }
    const rows = filtered.map(f => `
      <tr>
        <td style="font-weight:700;color:#1B4F8A;font-size:10px">${f.code}</td>
        <td>${f.raisonSociale}</td>
        <td>${f.type}</td>
        <td style="text-align:right">${fmtN(f.totalDu)}</td>
        <td style="text-align:right;color:${f.totalInterets > 0 ? '#EF3340' : '#16A34A'}">${fmtN2(f.totalInterets)}</td>
        <td style="text-align:center">${f.nbImpayees}</td>
        <td style="text-align:center;font-size:9px;font-weight:700;padding:2px 6px;border-radius:4px;background:${CFG_STATUT_FOURNISSEUR[f.statut].bg};color:${CFG_STATUT_FOURNISSEUR[f.statut].color}">${CFG_STATUT_FOURNISSEUR[f.statut].label}</td>
      </tr>`).join('');
    pw.document.write(`<!DOCTYPE html><html lang="fr"><head><meta charset="UTF-8"><title>Fournisseurs SENELEC — Intérêts moratoires</title><style>
      @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap');
      body{font-family:'Inter',Arial,sans-serif;padding:40px 48px;color:#1E293B;font-size:11px}
      .bar{height:5px;background:#F47920;border-radius:3px;margin-bottom:24px}
      .logo{font-size:8px;font-weight:700;letter-spacing:0.18em;color:#94A3B8;text-transform:uppercase;margin-bottom:16px}
      h1{font-size:20px;font-weight:800;color:#0F172A;margin:0 0 4px}
      .meta{font-size:9px;color:#64748B;margin-bottom:20px}
      .kpi-grid{display:grid;grid-template-columns:repeat(3,1fr);gap:12px;margin:16px 0 24px}
      .kpi{background:#F8FAFC;border-radius:10px;padding:14px 16px;border-left:4px solid #F47920}
      .kpi-val{font-size:20px;font-weight:800;color:#0F172A}
      .kpi-lbl{font-size:8px;color:#64748B;margin-top:4px;text-transform:uppercase;letter-spacing:0.06em}
      table{width:100%;border-collapse:separate;border-spacing:0;font-size:9px;border-radius:8px;overflow:hidden;box-shadow:0 1px 3px rgba(0,0,0,0.06);margin:14px 0 20px}
      th{background:#0F172A;color:#fff;padding:8px 10px;text-align:left;font-size:8px;text-transform:uppercase;letter-spacing:0.06em;font-weight:600}
      td{border-bottom:1px solid #F1F5F9;padding:7px 10px}
      tr:nth-child(even) td{background:#F8FAFC}
      .footer{margin-top:32px;padding-top:12px;border-top:1px solid #E2E8F0;font-size:8px;color:#94A3B8;display:flex;justify-content:space-between}
      .alert{background:#FFFBEB;border:1px solid #FDE68A;color:#92400E;padding:10px 14px;border-radius:8px;margin:10px 0;font-size:10px}
    </style></head><body>
      <div class="bar"></div>
      <div style="margin-bottom:12px"><img src="${SENELEC_LOGO_DATA_URI}" alt="SENELEC" style="height:44px;width:auto;display:block" /></div>
      <div class="logo">SENELEC · SIGEPP-DPE · Gestion Fournisseurs</div>
      <h1>État des dettes et intérêts moratoires</h1>
      <div class="meta">Généré le 28/05/2026 · Taux légal : BCEAO ${TAUX_BCEAO}% + 5 points = ${TAUX_LEGAL_DEFAUT}%</div>
      <div class="alert">⚠️ Les intérêts moratoires sont calculés selon l'arrêté interministériel fixant le taux de l'intérêt légal (BCEAO + 5 points). Le montant total des intérêts cumulés est de <strong>${fmtN2(kpis.totalInterets)} FCFA</strong>.</div>
      <div class="kpi-grid">
        <div class="kpi"><div class="kpi-val">${fmtN(kpis.totalDette)}</div><div class="kpi-lbl">Dette totale fournisseurs (FCFA)</div></div>
        <div class="kpi"><div class="kpi-val">${fmtN2(kpis.totalInterets)}</div><div class="kpi-lbl">Intérêts moratoires cumulés (FCFA)</div></div>
        <div class="kpi"><div class="kpi-val">${kpis.totalFacturesImpayees}</div><div class="kpi-lbl">Factures en retard</div></div>
      </div>
      <table><thead><tr><th>Code</th><th>Raison sociale</th><th>Type</th><th style="text-align:right">Montant dû</th><th style="text-align:right">Intérêts moratoires</th><th style="text-align:center">Factures en retard</th><th>Statut</th></tr></thead>
      <tbody>${rows}</tbody>
      </table>
      <div class="footer"><span>CONFIDENTIEL — Usage interne SENELEC · SIGEPP-DPE uniquement</span><span>Document généré par SIGEPP-DPE · 28/05/2026</span></div>
    </body></html>`);
    pw.document.close(); setTimeout(() => pw.print(), 500);
  };

  /* ─── Rendu ───────────────────────────────────────────────────────────────── */
  return (
    <div className="page-content">

      {/* ════════ KPIs ════════ */}
      <div className="kpi-grid">
        <div className="kpi-card navy">
          <div className="kpi-label">Fournisseurs actifs</div>
          <div className="kpi-value">{kpis.nbFournisseurs}</div>
          <div className="kpi-sub">dont {kpis.fournisseursRetard} avec retard</div>
        </div>
        <div className="kpi-card amber">
          <div className="kpi-label">Dette totale fournisseurs</div>
          <div className="kpi-value amber">{fmtN(kpis.totalDette)}</div>
          <div className="kpi-sub">FCFA — TTC</div>
        </div>
        <div className="kpi-card red">
          <div className="kpi-label">Intérêts moratoires cumulés</div>
          <div className="kpi-value red">{fmtN2(kpis.totalInterets)}</div>
          <div className="kpi-sub">FCFA — calcul BCEAO + 5 pts</div>
        </div>
        <div className="kpi-card green">
          <div className="kpi-label">Factures en retard</div>
          <div className="kpi-value green">{kpis.totalFacturesImpayees}</div>
          <div className="kpi-sub">dont {kpis.detteCritique} dettes &gt; 50M</div>
        </div>
      </div>

      {/* ════════ Alerte légale ════════ */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '12px 16px', background: '#FFFBEB', border: '1px solid #FDE68A', borderRadius: 8, marginBottom: 14, fontSize: 11, color: '#92400E' }}>
        <AlertTriangle size={16} style={{ flexShrink: 0 }} />
        <div>
          <strong style={{ fontWeight: 700 }}>Base légale — Intérêts moratoires</strong>
          <div style={{ marginTop: 2, lineHeight: 1.5 }}>
            Taux directeur BCEAO : <strong>{TAUX_BCEAO}%</strong> · Taux légal majoré (arrêté 2024) : <strong>{TAUX_LEGAL_DEFAUT}%</strong> annuel.
            Formule : <em>Montant dû × Taux × (Jours de retard / 365)</em>. Le total des intérêts cumulés est de <strong>{fmtN2(kpis.totalInterets)} FCFA</strong>.
          </div>
        </div>
      </div>

      {/* ════════ Barre d'outils ════════ */}
      <div className="card" style={{ marginBottom: 14 }}>
        <div className="card-body" style={{ padding: '10px 14px', display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
          <div style={{ position: 'relative', flex: 1, minWidth: 200 }}>
            <Search size={12} style={{ position: 'absolute', left: 9, top: '50%', transform: 'translateY(-50%)', color: '#94A3B8' }} />
            <input className="form-input" style={{ paddingLeft: 28, width: '100%' }} placeholder="Rechercher fournisseur, code, NINEA..." value={search} onChange={e => setSearch(e.target.value)} />
          </div>
          <select className="form-input" style={{ width: 'auto' }} value={filtreStatut} onChange={e => setFiltreStatut(e.target.value as any)}>
            <option value="tous">Tous statuts</option>
            <option value="actif">Actif</option>
            <option value="suspendu">Suspendu</option>
            <option value="blacklist">Blacklist</option>
          </select>
          <select className="form-input" style={{ width: 'auto' }} value={filtreType} onChange={e => setFiltreType(e.target.value)}>
            {types.map(t => <option key={t} value={t}>{t === 'tous' ? 'Tous types' : t}</option>)}
          </select>
          <button className="btn btn-primary btn-sm" onClick={handleRecalculer}>
            <Calculator size={12} /> Recalculer intérêts
          </button>
          <button className="btn btn-ghost btn-sm" onClick={handleExportPDF}>
            <Printer size={12} /> Imprimer état
          </button>
        </div>
      </div>

      {/* ════════ Tableau fournisseurs ════════ */}
      <div className="card" style={{ overflow: 'hidden' }}>
        <div className="card-header">
          <span className="card-title">Fournisseurs SENELEC-DPE ({filtered.length})</span>
          <span style={{ fontSize: 10, color: 'var(--muted)' }}>Taux légal appliqué : {TAUX_LEGAL_DEFAUT}%</span>
        </div>
        <div style={{ overflowX: 'auto' }}>
          <table className="tbl">
            <thead>
              <tr>
                <th>Code</th>
                <th>Raison sociale</th>
                <th>Type</th>
                <th style={{ textAlign: 'right' }}>Montant dû (TTC)</th>
                <th style={{ textAlign: 'right' }}>Intérêts moratoires</th>
                <th style={{ textAlign: 'center' }}>Factures</th>
                <th style={{ textAlign: 'center' }}>Taux appliqué</th>
                <th>Statut</th>
                <th style={{ textAlign: 'center' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map(f => (
                <tr key={f.id} style={{ background: f.totalDu > 50_000_000 ? 'rgba(239,51,64,0.03)' : undefined }}>
                  <td style={{ fontFamily: 'monospace', fontSize: 10, fontWeight: 700, color: '#1B4F8A' }}>{f.code}</td>
                  <td>
                    <div style={{ fontSize: 12, fontWeight: 600, color: '#0F172A' }}>{f.raisonSociale}</div>
                    <div style={{ fontSize: 9, color: '#94A3B8' }}>{f.ville} · {f.ninea}</div>
                  </td>
                  <td style={{ fontSize: 11 }}>{f.type}</td>
                  <td style={{ textAlign: 'right', fontWeight: 700, fontSize: 12, color: f.totalDu > 0 ? '#EF3340' : '#16A34A' }}>
                    {fmtN(f.totalDu)}
                  </td>
                  <td style={{ textAlign: 'right', fontWeight: 700, fontSize: 12, color: f.totalInterets > 0 ? '#EF3340' : '#16A34A' }}>
                    {fmtN2(f.totalInterets)}
                  </td>
                  <td style={{ textAlign: 'center' }}>
                    <span style={{ fontSize: 11, fontWeight: 700 }}>{f.nbImpayees}</span>
                    {f.nbLitiges > 0 && <span style={{ fontSize: 9, color: '#7C3AED', marginLeft: 4 }}>({f.nbLitiges} litige{f.nbLitiges > 1 ? 's' : ''})</span>}
                  </td>
                  <td style={{ textAlign: 'center' }}>
                    {editTauxId === f.id ? (
                      <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                        <input type="number" value={nouveauTaux} onChange={e => setNouveauTaux(e.target.value)}
                          style={{ width: 60, padding: '3px 6px', fontSize: 11, border: '1px solid #E2E8F0', borderRadius: 4, textAlign: 'right' }} step="0.1" min="0" max="50" />
                        <button onClick={() => handleSauverTaux(f.id)} style={{ padding: '2px 6px', background: '#16A34A', color: '#fff', border: 'none', borderRadius: 4, fontSize: 10, cursor: 'pointer' }}><Save size={10} /></button>
                        <button onClick={() => setEditTauxId(null)} style={{ padding: '2px 6px', background: '#EF3340', color: '#fff', border: 'none', borderRadius: 4, fontSize: 10, cursor: 'pointer' }}><X size={10} /></button>
                      </div>
                    ) : (
                      <button onClick={() => handleModifierTaux(f.id, f.tauxInteretMoratoire)}
                        style={{ fontSize: 10, fontWeight: 700, color: '#1B4F8A', background: '#EFF6FF', padding: '2px 8px', borderRadius: 4, border: 'none', cursor: 'pointer' }}>
                        {f.tauxInteretMoratoire}%
                      </button>
                    )}
                  </td>
                  <td>
                    <span style={{
                      fontSize: 9, fontWeight: 700, padding: '2px 8px', borderRadius: 4,
                      background: CFG_STATUT_FOURNISSEUR[f.statut].bg, color: CFG_STATUT_FOURNISSEUR[f.statut].color,
                    }}>{CFG_STATUT_FOURNISSEUR[f.statut].label}</span>
                  </td>
                  <td style={{ textAlign: 'center' }}>
                    <div style={{ display: 'flex', gap: 4, justifyContent: 'center' }}>
                      <button className="btn btn-ghost btn-xs" onClick={() => { setSelectedFournisseur(f); setShowDetail(true); }}><Eye size={10} /> Détail</button>
                      <button className="btn btn-ghost btn-xs" onClick={() => handleModifierTaux(f.id, f.tauxInteretMoratoire)}><Pencil size={10} /> Taux</button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr style={{ background: '#F8FAFC', fontWeight: 700 }}>
                <td colSpan={3} style={{ textAlign: 'right', fontSize: 11 }}>TOTAL PORTEFEUILLE</td>
                <td style={{ textAlign: 'right', color: '#EF3340', fontSize: 12 }}>{fmtN(kpis.totalDette)}</td>
                <td style={{ textAlign: 'right', color: '#EF3340', fontSize: 12 }}>{fmtN2(kpis.totalInterets)}</td>
                <td style={{ textAlign: 'center' }}>{kpis.totalFacturesImpayees}</td>
                <td colSpan={3} />
              </tr>
            </tfoot>
          </table>
        </div>
      </div>

      {/* ════════ Panneau détail fournisseur ════════ */}
      {showDetail && selectedFournisseur && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 200, display: 'flex' }} onClick={() => setShowDetail(false)}>
          <div style={{ flex: 1 }} />
          <div style={{ width: 520, background: '#fff', borderLeft: '1px solid #E2E8F0', boxShadow: '-4px 0 24px rgba(14,52,96,0.12)', display: 'flex', flexDirection: 'column', height: '100%' }} onClick={e => e.stopPropagation()}>
            {/* Header */}
            <div style={{ padding: '14px 16px', borderBottom: '1px solid #E2E8F0', background: '#1B4F8A', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <div style={{ color: '#fff', fontWeight: 700, fontSize: 13 }}>{selectedFournisseur.raisonSociale}</div>
                <div style={{ color: 'rgba(255,255,255,0.65)', fontSize: 10 }}>{selectedFournisseur.code} · {selectedFournisseur.type}</div>
              </div>
              <button onClick={() => setShowDetail(false)} className="btn btn-ghost btn-xs" style={{ color: '#fff', borderColor: 'rgba(255,255,255,0.3)' }}><X size={13} /></button>
            </div>

            <div style={{ flex: 1, overflowY: 'auto', padding: '16px', display: 'flex', flexDirection: 'column', gap: 14 }}>
              {/* Coordonnées */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, fontSize: 11 }}>
                <div><div style={{ fontSize: 9, color: '#94A3B8', fontWeight: 600, textTransform: 'uppercase' }}>Contact</div><div style={{ color: '#1E293B' }}>{selectedFournisseur.contact}</div></div>
                <div><div style={{ fontSize: 9, color: '#94A3B8', fontWeight: 600, textTransform: 'uppercase' }}>Email</div><div style={{ color: '#1E293B' }}>{selectedFournisseur.email}</div></div>
                <div><div style={{ fontSize: 9, color: '#94A3B8', fontWeight: 600, textTransform: 'uppercase' }}>Téléphone</div><div style={{ color: '#1E293B' }}>{selectedFournisseur.telephone}</div></div>
                <div><div style={{ fontSize: 9, color: '#94A3B8', fontWeight: 600, textTransform: 'uppercase' }}>Ville</div><div style={{ color: '#1E293B' }}>{selectedFournisseur.ville}</div></div>
                <div><div style={{ fontSize: 9, color: '#94A3B8', fontWeight: 600, textTransform: 'uppercase' }}>NINEA</div><div style={{ color: '#1E293B', fontFamily: 'monospace' }}>{selectedFournisseur.ninea}</div></div>
                <div><div style={{ fontSize: 9, color: '#94A3B8', fontWeight: 600, textTransform: 'uppercase' }}>RC</div><div style={{ color: '#1E293B' }}>{selectedFournisseur.rc}</div></div>
                <div><div style={{ fontSize: 9, color: '#94A3B8', fontWeight: 600, textTransform: 'uppercase' }}>Banque</div><div style={{ color: '#1E293B' }}>{selectedFournisseur.banque ?? '—'}</div></div>
                <div><div style={{ fontSize: 9, color: '#94A3B8', fontWeight: 600, textTransform: 'uppercase' }}>IBAN</div><div style={{ color: '#1E293B', fontFamily: 'monospace', fontSize: 10 }}>{selectedFournisseur.iban ?? '—'}</div></div>
              </div>

              {/* Agrément & délai */}
              <div style={{ padding: '10px 12px', background: '#F8FAFC', borderRadius: 8, border: '1px solid #E2E8F0', display: 'flex', gap: 16, flexWrap: 'wrap', fontSize: 11 }}>
                <div><span style={{ color: '#94A3B8' }}>Agrément SENELEC :</span> <strong style={{ color: selectedFournisseur.agregeSenelec ? '#16A34A' : '#EF3340' }}>{selectedFournisseur.agregeSenelec ? '✅ Agréé' : '❌ Non agréé'}</strong></div>
                <div><span style={{ color: '#94A3B8' }}>Délai paiement :</span> <strong>{selectedFournisseur.delaiPaiementContractuel} jours</strong></div>
                <div><span style={{ color: '#94A3B8' }}>Taux moratoire :</span> <strong>{selectedFournisseur.tauxInteretMoratoire}% / an</strong></div>
              </div>

              {/* KPI fournisseur */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 10 }}>
                <div style={{ padding: '10px 12px', background: '#FEE2E2', borderRadius: 8, textAlign: 'center' }}>
                  <div style={{ fontSize: 16, fontWeight: 800, color: '#EF3340' }}>{fmtN(selectedFournisseur.totalDu ?? 0)}</div>
                  <div style={{ fontSize: 8, color: '#94A3B8', textTransform: 'uppercase', marginTop: 3 }}>Montant dû (TTC)</div>
                </div>
                <div style={{ padding: '10px 12px', background: '#FFF7ED', borderRadius: 8, textAlign: 'center' }}>
                  <div style={{ fontSize: 16, fontWeight: 800, color: '#D97706' }}>{fmtN2(selectedFournisseur.totalInterets ?? 0)}</div>
                  <div style={{ fontSize: 8, color: '#94A3B8', textTransform: 'uppercase', marginTop: 3 }}>Intérêts moratoires</div>
                </div>
                <div style={{ padding: '10px 12px', background: '#EFF6FF', borderRadius: 8, textAlign: 'center' }}>
                  <div style={{ fontSize: 16, fontWeight: 800, color: '#1B4F8A' }}>{selectedFournisseur.nbImpayees ?? 0}</div>
                  <div style={{ fontSize: 8, color: '#94A3B8', textTransform: 'uppercase', marginTop: 3 }}>Factures en retard</div>
                </div>
              </div>

              {/* Factures */}
              <div>
                <div style={{ fontSize: 12, fontWeight: 700, color: '#0F172A', marginBottom: 8, display: 'flex', alignItems: 'center', gap: 6 }}>
                  <FileText size={14} /> Factures ({selectedFournisseur.factures.length})
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {selectedFournisseur.factures.map(fac => (
                    <div key={fac.id} style={{ padding: '10px 12px', borderRadius: 8, border: '1px solid #E2E8F0', background: fac.joursRetard > 0 ? '#FFFBEB' : '#F8FAFC' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                        <div>
                          <div style={{ fontSize: 11, fontWeight: 700, color: '#1B4F8A', fontFamily: 'monospace' }}>{fac.ref}</div>
                          <div style={{ fontSize: 10, color: '#64748B', marginTop: 2 }}>{fac.projet} · {fac.marcheRef}</div>
                        </div>
                        <span style={{
                          fontSize: 9, fontWeight: 700, padding: '2px 7px', borderRadius: 4,
                          background: CFG_STATUT_FACTURE[fac.statut].bg, color: CFG_STATUT_FACTURE[fac.statut].color,
                        }}>{CFG_STATUT_FACTURE[fac.statut].label}</span>
                      </div>
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', gap: 8, marginTop: 8, fontSize: 10 }}>
                        <div><div style={{ color: '#94A3B8', fontSize: 8, textTransform: 'uppercase' }}>Montant TTC</div><div style={{ fontWeight: 700 }}>{fmtN(fac.montantTTC)}</div></div>
                        <div><div style={{ color: '#94A3B8', fontSize: 8, textTransform: 'uppercase' }}>Payé</div><div style={{ fontWeight: 700, color: '#16A34A' }}>{fmtN(fac.montantPaye)}</div></div>
                        <div><div style={{ color: '#94A3B8', fontSize: 8, textTransform: 'uppercase' }}>Dû</div><div style={{ fontWeight: 700, color: fac.montantDu > 0 ? '#EF3340' : '#16A34A' }}>{fmtN(fac.montantDu)}</div></div>
                        <div><div style={{ color: '#94A3B8', fontSize: 8, textTransform: 'uppercase' }}>Retard</div><div style={{ fontWeight: 700, color: fac.joursRetard > 30 ? '#EF3340' : fac.joursRetard > 0 ? '#D97706' : '#16A34A' }}>{fac.joursRetard}j</div></div>
                      </div>
                      {fac.interetsMoratoires > 0 && (
                        <div style={{ marginTop: 6, padding: '6px 10px', background: '#FEE2E2', borderRadius: 6, fontSize: 10, color: '#EF3340', display: 'flex', alignItems: 'center', gap: 6 }}>
                          <Calculator size={12} />
                          <strong>Intérêts moratoires : {fmtN2(fac.interetsMoratoires)} FCFA</strong>
                          <span style={{ color: '#94A3B8', marginLeft: 'auto' }}>({fac.montantDu} × {selectedFournisseur.tauxInteretMoratoire}% × {fac.joursRetard}/365)</span>
                        </div>
                      )}
                      {fac.statut !== 'payee' && (
                        <div style={{ marginTop: 8, display: 'flex', gap: 6 }}>
                          <button className="btn btn-primary btn-xs" onClick={() => handleSimulerPaiement(selectedFournisseur.id, fac.id)}>
                            <Wallet size={10} /> Simuler paiement
                          </button>
                          {fac.statut === 'litige' && (
                            <button className="btn btn-ghost btn-xs" style={{ color: '#7C3AED' }} onClick={() => handleResoudreLitige(selectedFournisseur.id, fac.id)}>
                              <FileText size={10} /> Résoudre litige
                            </button>
                          )}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      <style>{`@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}

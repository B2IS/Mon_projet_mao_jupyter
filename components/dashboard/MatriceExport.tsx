/**
 * MatriceExport.tsx — Extraction de la MATRICE GLOBALE des projets
 * -----------------------------------------------------------------------------
 * Permet d'extraire le portefeuille projets en Excel (.xlsx) ou PDF, filtré
 * PAR DOMAINE ou TOUS DOMAINES COMBINÉS.
 *
 * Destiné en priorité aux profils de pilotage transverse (Directeur, PMO,
 * Experts Suivi-Évaluation / CSE) qui doivent produire la matrice complète.
 * Les autres profils exportent automatiquement leur périmètre visible.
 *
 * La liste `projets` reçue est DÉJÀ filtrée selon le périmètre de l'utilisateur
 * (useProjectStore) : pour un super-rôle elle contient tout le portefeuille,
 * pour un chef de projet uniquement ses projets.
 */
'use client';

import { useMemo, useState } from 'react';
import { Download, FileSpreadsheet, FileText, X, Filter } from 'lucide-react';
import type { Projet, Domaine } from '@/lib/projectStore';
import { DOMAINE_CFG, STATUT_CFG } from '@/lib/projectStore';
import { downloadExcel, printBranded, fmtNombre, type ExcelSheet } from '@/lib/exportUtils';

const ALL_DOMAINES: Domaine[] = ['production', 'transport', 'distribution', 'commercial', 'genie_civil'];

const MATRIX_HEADERS = [
  'Code', 'Projet', 'Domaine', 'Programme', 'Bailleur(s)', 'Unité', 'Département',
  'Chef de projet', 'Région', 'Localisation', 'Statut', 'Priorité',
  'Avanc. réel %', 'Avanc. planifié %',
  'Budget (M FCFA)', 'Engagé (M FCFA)', 'Décaissé (M FCFA)', 'Taux décaiss. %',
  'CPI', 'SPI', 'Début', 'Fin prévue', 'Fin estimée',
];

const COL_WIDTHS = [16, 46, 13, 12, 18, 10, 18, 22, 14, 18, 12, 10, 13, 14, 15, 15, 16, 13, 8, 8, 12, 12, 12];

function projetToRow(p: Projet): (string | number)[] {
  const tauxDec = p.budget > 0 ? Math.round((p.budgetDecaisse / p.budget) * 1000) / 10 : 0;
  const bailleurs = (p.bailleurs || []).map(b => b.nom).join(', ');
  return [
    p.code || '—',
    p.nom,
    DOMAINE_CFG[p.domaine]?.label ?? p.domaine,
    p.programme || '—',
    bailleurs || '—',
    p.unite || '—',
    p.departement || '—',
    p.chefProjet || '—',
    p.region || '—',
    p.localisation || '—',
    STATUT_CFG[p.statut]?.label ?? p.statut,
    p.priorite ?? '—',
    p.avancementReel ?? p.avancement ?? 0,
    p.avancementPlanifie ?? 0,
    Math.round(p.budget ?? 0),
    Math.round(p.budgetEngage ?? 0),
    Math.round(p.budgetDecaisse ?? 0),
    tauxDec,
    p.cpi ?? 0,
    p.spi ?? 0,
    p.dateDebut || '—',
    p.dateFinPrevue || '—',
    p.dateFinEstimee || '—',
  ];
}

/** Ligne de synthèse agrégée par domaine. */
function syntheseRows(projets: Projet[]): (string | number)[][] {
  const rows: (string | number)[][] = [];
  let tN = 0, tBud = 0, tDec = 0, tAvSum = 0;
  for (const d of ALL_DOMAINES) {
    const grp = projets.filter(p => p.domaine === d);
    if (grp.length === 0) continue;
    const bud = grp.reduce((s, p) => s + (p.budget || 0), 0);
    const dec = grp.reduce((s, p) => s + (p.budgetDecaisse || 0), 0);
    const avMoy = grp.reduce((s, p) => s + (p.avancementReel ?? p.avancement ?? 0), 0) / grp.length;
    rows.push([
      DOMAINE_CFG[d].label, grp.length, Math.round(bud), Math.round(dec),
      bud > 0 ? Math.round((dec / bud) * 1000) / 10 : 0, Math.round(avMoy),
    ]);
    tN += grp.length; tBud += bud; tDec += dec; tAvSum += avMoy * grp.length;
  }
  rows.push([
    'TOTAL', tN, Math.round(tBud), Math.round(tDec),
    tBud > 0 ? Math.round((tDec / tBud) * 1000) / 10 : 0,
    tN > 0 ? Math.round(tAvSum / tN) : 0,
  ]);
  return rows;
}

export default function MatriceExport({
  projets,
  canGlobal,
  buttonLabel = 'Extraire la matrice',
}: {
  projets: Projet[];
  canGlobal: boolean;
  buttonLabel?: string;
}) {
  const [open, setOpen] = useState(false);
  const [domaine, setDomaine] = useState<Domaine | 'tous'>('tous');

  // Domaines réellement présents dans le périmètre visible
  const domainesPresents = useMemo(
    () => ALL_DOMAINES.filter(d => projets.some(p => p.domaine === d)),
    [projets],
  );

  const selection = useMemo(
    () => (domaine === 'tous' ? projets : projets.filter(p => p.domaine === domaine)),
    [projets, domaine],
  );

  const dateStr = new Date().toLocaleDateString('fr-FR');
  const perimetre = canGlobal ? 'Portefeuille global DPE' : 'Mon périmètre';

  const exportExcel = () => {
    const sheets: ExcelSheet[] = [];

    if (domaine === 'tous') {
      // Feuille de synthèse par domaine
      sheets.push({
        sheetName: 'Synthèse domaines',
        title: 'SENELEC · DPE — Matrice des projets · Synthèse par domaine',
        subtitle: `${perimetre} — ${projets.length} projet(s) — généré le ${dateStr}`,
        headers: ['Domaine', 'Nb projets', 'Budget (M FCFA)', 'Décaissé (M FCFA)', 'Taux décaiss. %', 'Avanc. moyen %'],
        rows: syntheseRows(projets),
        colWidths: [18, 12, 18, 18, 16, 16],
      });
      // Feuille matrice complète combinée
      sheets.push({
        sheetName: 'Matrice globale',
        title: 'SENELEC · DPE — Matrice globale des projets (tous domaines)',
        subtitle: `${perimetre} — ${projets.length} projet(s) — généré le ${dateStr}`,
        headers: MATRIX_HEADERS,
        rows: projets.map(projetToRow),
        colWidths: COL_WIDTHS,
      });
      // Une feuille par domaine présent
      for (const d of domainesPresents) {
        const grp = projets.filter(p => p.domaine === d);
        sheets.push({
          sheetName: DOMAINE_CFG[d].label.slice(0, 31),
          title: `SENELEC · DPE — Matrice projets · ${DOMAINE_CFG[d].label}`,
          subtitle: `${grp.length} projet(s) — généré le ${dateStr}`,
          headers: MATRIX_HEADERS,
          rows: grp.map(projetToRow),
          colWidths: COL_WIDTHS,
        });
      }
    } else {
      sheets.push({
        sheetName: DOMAINE_CFG[domaine].label.slice(0, 31),
        title: `SENELEC · DPE — Matrice projets · ${DOMAINE_CFG[domaine].label}`,
        subtitle: `${perimetre} — ${selection.length} projet(s) — généré le ${dateStr}`,
        headers: MATRIX_HEADERS,
        rows: selection.map(projetToRow),
        colWidths: COL_WIDTHS,
      });
    }

    const tag = domaine === 'tous' ? 'tous_domaines' : domaine;
    downloadExcel(`matrice_projets_dpe_${tag}`, sheets);
    setOpen(false);
  };

  const exportPDF = () => {
    const rightCols = [12, 13, 14, 15, 16, 17, 18, 19]; // colonnes numériques
    const title = domaine === 'tous'
      ? 'Matrice globale des projets — DPE (tous domaines)'
      : `Matrice des projets — ${DOMAINE_CFG[domaine].label}`;
    printBranded({
      title,
      subtitle: `${perimetre} — ${selection.length} projet(s) — ${dateStr}`,
      landscape: true,
      confidentiel: true,
      tables: [
        ...(domaine === 'tous' ? [{
          title: 'Synthèse par domaine',
          headers: ['Domaine', 'Nb', 'Budget (M)', 'Décaissé (M)', 'Taux %', 'Avanc. %'],
          rows: syntheseRows(projets),
          rightAlign: [1, 2, 3, 4, 5],
        }] : []),
        {
          title: 'Détail des projets',
          headers: MATRIX_HEADERS,
          rows: selection.map(projetToRow),
          rightAlign: rightCols,
        },
      ],
    });
    setOpen(false);
  };

  return (
    <div style={{ position: 'relative' }}>
      <button
        onClick={() => setOpen(o => !o)}
        style={{
          display: 'flex', alignItems: 'center', gap: 7, padding: '8px 14px',
          background: 'linear-gradient(135deg, #1B4F8A 0%, #0E3460 100%)', color: '#fff',
          border: 'none', borderRadius: 9, fontSize: 12, fontWeight: 700, cursor: 'pointer',
          fontFamily: 'inherit', boxShadow: '0 2px 10px rgba(14,52,96,0.28)',
        }}
      >
        <Download size={15} /> {buttonLabel}
      </button>

      {open && (
        <>
          <div onClick={() => setOpen(false)} style={{ position: 'fixed', inset: 0, zIndex: 200 }} />
          <div style={{
            position: 'absolute', top: 'calc(100% + 8px)', right: 0, zIndex: 201,
            background: '#fff', borderRadius: 14, boxShadow: '0 20px 60px rgba(0,0,0,0.28)',
            border: '1px solid #E2E8F0', padding: 18, width: 340,
          }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 7, fontWeight: 800, fontSize: 14, color: '#0E3460' }}>
                <Filter size={16} /> Extraire la matrice
              </div>
              <button onClick={() => setOpen(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#94A3B8' }}>
                <X size={18} />
              </button>
            </div>

            <div style={{ fontSize: 11, color: '#64748B', marginBottom: 6, fontWeight: 600 }}>
              Domaine métier
            </div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 14 }}>
              <button
                onClick={() => setDomaine('tous')}
                style={chip(domaine === 'tous', '#1B4F8A')}
              >Tous combinés</button>
              {domainesPresents.map(d => (
                <button key={d} onClick={() => setDomaine(d)} style={chip(domaine === d, DOMAINE_CFG[d].color)}>
                  {DOMAINE_CFG[d].emoji} {DOMAINE_CFG[d].label}
                </button>
              ))}
            </div>

            <div style={{
              fontSize: 11, color: '#475569', background: '#F8FAFC', borderRadius: 8,
              padding: '8px 10px', marginBottom: 14, border: '1px solid #EEF2F7',
            }}>
              <b>{selection.length}</b> projet(s) — {perimetre}
              {!canGlobal && <div style={{ marginTop: 2, color: '#94A3B8' }}>Périmètre limité à vos projets.</div>}
            </div>

            <div style={{ display: 'flex', gap: 8 }}>
              <button onClick={exportExcel} disabled={selection.length === 0} style={actBtn('#16A34A', selection.length === 0)}>
                <FileSpreadsheet size={15} /> Excel
              </button>
              <button onClick={exportPDF} disabled={selection.length === 0} style={actBtn('#B91C1C', selection.length === 0)}>
                <FileText size={15} /> PDF
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

function chip(active: boolean, color: string): React.CSSProperties {
  return {
    padding: '5px 11px', borderRadius: 20,
    border: `1.5px solid ${active ? color : '#E2E8F0'}`,
    background: active ? color : '#fff', color: active ? '#fff' : '#374151',
    fontSize: 11, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit',
  };
}

function actBtn(color: string, disabled: boolean): React.CSSProperties {
  return {
    flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
    padding: '9px 12px', background: disabled ? '#CBD5E1' : color, color: '#fff',
    border: 'none', borderRadius: 9, fontSize: 12.5, fontWeight: 700,
    cursor: disabled ? 'not-allowed' : 'pointer', fontFamily: 'inherit',
  };
}

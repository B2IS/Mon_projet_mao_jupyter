'use client';
/**
 * ImmobilisationsWorkspace.tsx — Atelier Immobilisations & Patrimoine
 * ------------------------------------------------------------------
 * 4 sections deep-linkées :
 *   • referentiel    — bibliothèque des familles d'actifs (feuilles 1–3)
 *   • actifs         — registre des actifs assemblés sur localisation (feuille 4)
 *   • receptions     — PV de réception provisoire (mise en service)
 *   • amortissements — plans d'amortissement générés depuis les PV
 *
 * Design SENELEC : violet #3D1A6B / orange #F47920, cartes, couleurs
 * sémantiques, chiffres tabulaires, hiérarchie WBS.
 */

import React, { useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  Boxes, Building2, ClipboardCheck, Calculator, ChevronRight, ChevronDown,
  Plus, Trash2, X, Save, Layers, TrendingDown, MapPin, FileText, Check,
  ArrowRight, Zap, BookOpen, Search, Upload,
} from 'lucide-react';
import { FAMILLES_ACTIFS, coutFamille } from '@/lib/immobilisations/referentiel';
import { LISTES_VALEURS, getListe } from '@/lib/immobilisations/listeValeurs';
import {
  MODELE_DECOMPOSITION, REGLES_DOI, composantsDe, trouverComposant, ORGANISATIONS_DEPENSE,
} from '@/lib/immobilisations/decomposition';
import { feuilles, type ActifStructure, type ActifNode } from '@/lib/immobilisations/assembleur';
import {
  planConsolide, amortirActif, vncActif, type PVReception, type MethodeAmort, type ClassificationActif,
} from '@/lib/immobilisations/amortissement';
import { useImmoModule } from '@/lib/immobilisations/store';

export type ImmoSection = 'referentiel' | 'actifs' | 'receptions' | 'amortissements';

// ── Tokens ───────────────────────────────────────────────────────────────────
const PURPLE = '#3D1A6B', ORANGE = '#F47920', INK = '#0F172A', MUT = '#64748B';

// ── Bordereau du marché — données demo (structure réelle colonnes Excel) ──────
interface BordereauLigne {
  numeroTache: string;
  description: string;
  classification: string;
  actifLivrable: string;
  cr: string;
  domaineBIT: string;
  unite: string;
  qte: number;
  puFCFA: number;
  totalFCFA: number;
  marche: string;
}

const BORDEREAU_DEMO: BordereauLigne[] = [
  { numeroTache: 'REEQ.COUP.1',   description: 'REEQUIPEMENT ELECTRIQUE POSTES HTA/BT EN GIS COUPURE Kiniabour',     classification: 'POSTE DE DISTRIBUTION HTA/BT', actifLivrable: 'Equipement Electrique Poste HTA/BT GIS',       cr: '66209', domaineBIT: 'BIT Distribution', unite: 'U', qte: 1, puFCFA: 13_200_000, totalFCFA: 13_200_000, marche: '19DX30213583-LOT1' },
  { numeroTache: 'REEQ.COUP.2',   description: 'REEQUIPEMENT ELECTRIQUE POSTES HTA/BT EN GIS COUPURE CHERIF LO',     classification: 'POSTE DE DISTRIBUTION HTA/BT', actifLivrable: 'Equipement Electrique Poste HTA/BT GIS',       cr: '66209', domaineBIT: 'BIT Distribution', unite: 'U', qte: 1, puFCFA: 13_537_630, totalFCFA: 13_537_630, marche: '19DX30213583-LOT1' },
  { numeroTache: 'REEQ.COUP.3',   description: 'REEQUIPEMENT ELECTRIQUE POSTES HTA/BT EN GIS COUPURE PAM ECOLE 15',  classification: 'POSTE DE DISTRIBUTION HTA/BT', actifLivrable: 'Equipement Electrique Poste HTA/BT GIS',       cr: '66209', domaineBIT: 'BIT Distribution', unite: 'U', qte: 1, puFCFA: 13_537_630, totalFCFA: 13_537_630, marche: '19DX30213583-LOT1' },
  { numeroTache: 'REEQ.TE.1',     description: 'REEQUIPEMENT ELECTRIQUE POSTES HTA/BT EN GIS TE PM Baobab',          classification: 'POSTE DE DISTRIBUTION HTA/BT', actifLivrable: 'Equipement Electrique Poste HTA/BT TE',        cr: '66236', domaineBIT: 'BIT Distribution', unite: 'U', qte: 1, puFCFA: 14_505_783, totalFCFA: 14_505_783, marche: '18DX30211605' },
  { numeroTache: 'REEQ.TE.2',     description: 'POSTE HTA/BT EN TE Mbour Forage',                                    classification: 'POSTE DE DISTRIBUTION HTA/BT', actifLivrable: 'Equipement Electrique Poste HTA/BT TE',        cr: '66236', domaineBIT: 'BIT Distribution', unite: 'U', qte: 1, puFCFA: 12_850_000, totalFCFA: 12_850_000, marche: '18DX30211605' },
  { numeroTache: 'PREFA.COUP.1',  description: 'POSTE PREFABRIQUE EN COUPURE 30 KV RTS GANDON',                     classification: 'POSTE DE DISTRIBUTION HTA/BT', actifLivrable: 'Poste Préfabriqué Coupure HTA/BT',             cr: '66245', domaineBIT: 'BIT Distribution', unite: 'U', qte: 1, puFCFA: 21_416_228, totalFCFA: 21_416_228, marche: '19DX30213583-LOT1' },
  { numeroTache: 'GC.POST.1',     description: 'GENIE CIVIL POSTE HTB/HTA BEL AIR',                                  classification: 'GENIE CIVIL POSTE TRANSPORT',  actifLivrable: 'Structure béton armé et Canalisation',        cr: '66101', domaineBIT: 'BIT Transport', unite: 'U', qte: 1, puFCFA: 8_400_000, totalFCFA: 8_400_000, marche: '20DE10033791' },
  { numeroTache: 'EE.HTA.1',      description: 'EQUIPEMENT ELECTRIQUE HTA POSTE HTB AIS',                            classification: 'EQUIPEMENT ELECTRIQUE HTA POSTE HTB', actifLivrable: 'Disjoncteur HTA 36kV',               cr: '66101', domaineBIT: 'BIT Transport', unite: 'U', qte: 3, puFCFA: 4_200_000, totalFCFA: 12_600_000, marche: '20DE10033791' },
  { numeroTache: 'TELEC.1',       description: 'EQUIPEMENT DE TELECONDUITE Coffret ITI 4 voies',                     classification: 'EQUIPEMENT TELECONDUITE',      actifLivrable: 'Coffret ITI 4 voies',                         cr: '66209', domaineBIT: 'BIT Distribution', unite: 'U', qte: 1, puFCFA: 1_850_000, totalFCFA: 1_850_000, marche: '19DX30213583-LOT1' },
  { numeroTache: 'CABLAGE.1',     description: 'Cable souterrain HTA 3×150mm² NFC33-220',                           classification: 'LIGNE SOUTERRAINE HTA',        actifLivrable: 'Cable souterrain HTA',                        cr: '66215', domaineBIT: 'BIT Distribution', unite: 'ml', qte: 450, puFCFA: 28_500, totalFCFA: 12_825_000, marche: '18DX30211605' },
  { numeroTache: 'TRSF.225.1',    description: 'Transformateur de puissance 225/30kV 40 MVA',                        classification: 'EQUIPEMENT ELECTRIQUE HTB POSTE AIS', actifLivrable: 'Transformateur puissance HTB',           cr: '66101', domaineBIT: 'BIT Transport', unite: 'U', qte: 1, puFCFA: 185_000_000, totalFCFA: 185_000_000, marche: '20DE10033791' },
  { numeroTache: 'ETU.EIES.1',    description: "Etude d'Impact Environnemental et Social — Phase construction",      classification: 'ETUDES ET CONFORMITES E&S',    actifLivrable: "Etudes d'Impact Environnemental et Social",   cr: '66300', domaineBIT: 'BIT Distribution', unite: 'FF', qte: 1, puFCFA: 3_500_000, totalFCFA: 3_500_000, marche: '19DX30213583-LOT1' },
];

// ─── Bordereau Modal ──────────────────────────────────────────────────────────
function BordereauModal({
  onSelect, onClose,
}: { onSelect: (l: BordereauLigne) => void; onClose: () => void }) {
  const [query, setQuery] = useState('');
  const [selected, setSelected] = useState<string | null>(null);

  const filtered = useMemo(() => {
    const q = query.toLowerCase();
    if (!q) return BORDEREAU_DEMO;
    return BORDEREAU_DEMO.filter(l =>
      l.description.toLowerCase().includes(q) ||
      l.numeroTache.toLowerCase().includes(q) ||
      l.classification.toLowerCase().includes(q) ||
      l.marche.toLowerCase().includes(q)
    );
  }, [query]);

  const ligne = BORDEREAU_DEMO.find(l => l.numeroTache === selected);

  return (
    <div onClick={onClose} style={{
      position: 'fixed', inset: 0, background: 'rgba(15,23,42,0.55)',
      zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16,
    }}>
      <div onClick={e => e.stopPropagation()} style={{
        background: '#fff', borderRadius: 16, width: '100%', maxWidth: 900,
        maxHeight: '88vh', display: 'flex', flexDirection: 'column',
        boxShadow: '0 24px 80px rgba(0,0,0,0.18)',
      }}>
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '18px 22px', borderBottom: '1px solid #E2E8F0' }}>
          <div style={{ width: 38, height: 38, borderRadius: 10, background: `${ORANGE}14`, display: 'grid', placeItems: 'center', flexShrink: 0 }}>
            <BookOpen size={18} color={ORANGE} />
          </div>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 15, fontWeight: 800, color: INK }}>Lire le prix depuis le bordereau du marché</div>
            <div style={{ fontSize: 11.5, color: MUT, marginTop: 1 }}>Sélectionnez une ligne — le montant FCFA sera appliqué à la valeur brute de l'actif</div>
          </div>
          <button onClick={onClose} style={{ border: 'none', background: 'none', cursor: 'pointer', color: MUT, padding: 4 }}><X size={18} /></button>
        </div>

        {/* Search */}
        <div style={{ padding: '12px 22px', borderBottom: '1px solid #F1F5F9' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, background: '#F8FAFC', border: '1.5px solid #E2E8F0', borderRadius: 9, padding: '8px 12px' }}>
            <Search size={14} color={MUT} />
            <input value={query} onChange={e => setQuery(e.target.value)} placeholder="Rechercher par description, code tâche, marché…"
              style={{ flex: 1, border: 'none', background: 'none', fontSize: 13, color: INK, outline: 'none', fontFamily: 'inherit' }} />
          </div>
        </div>

        {/* Table */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '0 0 4px' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
            <thead>
              <tr style={{ background: '#F8FAFC', position: 'sticky', top: 0, zIndex: 1 }}>
                {['', 'N° Tâche', 'Description', 'Classification', 'CR', 'Qté', 'P.U. FCFA', 'TOTAL FCFA', 'Marché'].map((h, i) => (
                  <th key={i} style={{ padding: '9px 10px', fontWeight: 700, color: '#475569', textAlign: i >= 5 ? 'right' : 'left', whiteSpace: 'nowrap', borderBottom: '1px solid #E2E8F0', fontSize: 11 }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.map(l => {
                const isSelected = l.numeroTache === selected;
                return (
                  <tr key={l.numeroTache} onClick={() => setSelected(l.numeroTache)}
                    style={{ cursor: 'pointer', borderBottom: '1px solid #F1F5F9', background: isSelected ? `${ORANGE}0D` : undefined, transition: 'background 0.1s' }}>
                    <td style={{ padding: '8px 10px', textAlign: 'center' }}>
                      <div style={{ width: 16, height: 16, borderRadius: '50%', border: `2px solid ${isSelected ? ORANGE : '#CBD5E1'}`, background: isSelected ? ORANGE : '#fff', display: 'grid', placeItems: 'center' }}>
                        {isSelected && <div style={{ width: 6, height: 6, borderRadius: '50%', background: '#fff' }} />}
                      </div>
                    </td>
                    <td style={{ padding: '8px 10px', fontWeight: 700, color: ORANGE, whiteSpace: 'nowrap' }}>{l.numeroTache}</td>
                    <td style={{ padding: '8px 10px', color: INK, maxWidth: 260, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{l.description}</td>
                    <td style={{ padding: '8px 10px', color: MUT, maxWidth: 160, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontSize: 11 }}>{l.classification}</td>
                    <td style={{ padding: '8px 10px', color: '#1B4F8A', fontWeight: 700, ...num }}>{l.cr}</td>
                    <td style={{ padding: '8px 10px', textAlign: 'right', ...num }}>{l.qte} {l.unite}</td>
                    <td style={{ padding: '8px 10px', textAlign: 'right', ...num }}>{l.puFCFA.toLocaleString('fr-FR')}</td>
                    <td style={{ padding: '8px 10px', textAlign: 'right', fontWeight: 700, color: PURPLE, ...num }}>{l.totalFCFA.toLocaleString('fr-FR')}</td>
                    <td style={{ padding: '8px 10px', color: MUT, fontSize: 11 }}>{l.marche}</td>
                  </tr>
                );
              })}
              {filtered.length === 0 && (
                <tr><td colSpan={9} style={{ padding: 32, textAlign: 'center', color: '#94A3B8' }}>Aucune ligne ne correspond à votre recherche.</td></tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Footer / confirm */}
        <div style={{ padding: '14px 22px', borderTop: '1px solid #E2E8F0', display: 'flex', alignItems: 'center', gap: 12 }}>
          {ligne ? (
            <div style={{ flex: 1, fontSize: 12.5, color: '#374151' }}>
              <span style={{ fontWeight: 700, color: ORANGE }}>{ligne.numeroTache}</span> · {ligne.description.slice(0, 60)}{ligne.description.length > 60 ? '…' : ''} ·
              <span style={{ fontWeight: 800, color: PURPLE, ...num }}> {ligne.totalFCFA.toLocaleString('fr-FR')} FCFA</span>
            </div>
          ) : (
            <div style={{ flex: 1, fontSize: 12, color: MUT }}>Sélectionnez une ligne du bordereau pour appliquer son montant.</div>
          )}
          <button onClick={onClose} style={{ padding: '8px 14px', border: '1px solid #E2E8F0', borderRadius: 8, background: '#fff', cursor: 'pointer', fontSize: 12.5, color: '#374151', fontFamily: 'inherit' }}>
            Annuler
          </button>
          <button disabled={!ligne} onClick={() => ligne && onSelect(ligne)}
            style={{ padding: '9px 18px', background: ligne ? ORANGE : '#F1F5F9', color: ligne ? '#fff' : '#94A3B8', border: 'none', borderRadius: 8, cursor: ligne ? 'pointer' : 'not-allowed', fontSize: 13, fontWeight: 700, fontFamily: 'inherit', display: 'flex', alignItems: 'center', gap: 6, transition: 'all 0.15s' }}>
            <Check size={14} /> Appliquer ce montant
          </button>
        </div>
      </div>
    </div>
  );
}
const cfa = (n: number) => `${Math.round(n).toLocaleString('fr-FR')} FCFA`;
const card: React.CSSProperties = { background: '#fff', border: '1px solid #E2E8F0', borderRadius: 14, padding: 16 };
const inp: React.CSSProperties = { width: '100%', padding: '8px 10px', borderRadius: 8, border: '1px solid #CBD5E1', fontSize: 13, color: INK, background: '#fff' };
const num: React.CSSProperties = { fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap' };

const TABS: { id: ImmoSection; href: string; label: string; icon: React.ComponentType<{ size?: number }> }[] = [
  { id: 'actifs', href: '/immobilisations', label: 'Registre des actifs', icon: Building2 },
  { id: 'referentiel', href: '/immobilisations/referentiel', label: 'Référentiel de structuration', icon: Boxes },
  { id: 'receptions', href: '/immobilisations/receptions', label: 'PV de réception (MES)', icon: ClipboardCheck },
  { id: 'amortissements', href: '/immobilisations/amortissements', label: "Plans d'amortissement", icon: Calculator },
];

export default function ImmobilisationsWorkspace({ section }: { section: ImmoSection }) {
  const { actifs, seed } = useImmoModule();
  useEffect(() => { if (!actifs.length) seed(); }, [actifs.length, seed]);

  return (
    <div style={{ padding: 20, maxWidth: 1320, margin: '0 auto', width: '100%' }}>
      {/* En-tête */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 14 }}>
        <div style={{ width: 42, height: 42, borderRadius: 11, background: `${PURPLE}14`, display: 'grid', placeItems: 'center' }}>
          <Building2 size={22} style={{ color: PURPLE }} />
        </div>
        <div>
          <h1 style={{ fontSize: 21, fontWeight: 800, color: INK, margin: 0 }}>Immobilisations & Patrimoine</h1>
          <p style={{ fontSize: 13, color: MUT, margin: '2px 0 0' }}>
            Du référentiel de structuration (Liste de valeurs · Décomposition) au plan d'amortissement.
          </p>
        </div>
      </div>

      {/* Onglets (deep-link) */}
      <nav style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 18, borderBottom: '1px solid #E2E8F0', paddingBottom: 2 }}>
        {TABS.map(t => {
          const active = t.id === section;
          const Icon = t.icon;
          return (
            <Link key={t.id} href={t.href} style={{ textDecoration: 'none' }}>
              <span style={{
                display: 'inline-flex', alignItems: 'center', gap: 7, padding: '9px 14px',
                fontSize: 13, fontWeight: active ? 700 : 500, borderRadius: '9px 9px 0 0',
                color: active ? PURPLE : MUT, background: active ? `${PURPLE}0D` : 'transparent',
                borderBottom: active ? `2.5px solid ${ORANGE}` : '2.5px solid transparent', cursor: 'pointer',
              }}>
                <Icon size={15} /> {t.label}
              </span>
            </Link>
          );
        })}
      </nav>

      {section === 'referentiel' && <Referentiel />}
      {section === 'actifs' && <Actifs />}
      {section === 'receptions' && <Receptions />}
      {section === 'amortissements' && <Amortissements />}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// SECTION 1 — RÉFÉRENTIEL DE STRUCTURATION (logique : Feuilles 1–3)
// ─────────────────────────────────────────────────────────────────────────────
type VueRef = 'valeurs' | 'decomposition';
function Referentiel() {
  const [vue, setVue] = useState<VueRef>('valeurs');
  const sous: { id: VueRef; label: string }[] = [
    { id: 'valeurs', label: 'Liste de valeurs' },
    { id: 'decomposition', label: 'Modèle de décomposition' },
  ];
  return (
    <>
      <div style={{ display: 'inline-flex', gap: 4, background: '#F1F5F9', borderRadius: 9, padding: 3, marginBottom: 16 }}>
        {sous.map(s => (
          <button key={s.id} onClick={() => setVue(s.id)} style={{
            padding: '7px 14px', borderRadius: 7, border: 'none', cursor: 'pointer', fontSize: 12.5, fontWeight: 700,
            background: vue === s.id ? '#fff' : 'transparent', color: vue === s.id ? PURPLE : MUT,
            boxShadow: vue === s.id ? '0 1px 3px rgba(0,0,0,.08)' : 'none',
          }}>{s.label}</button>
        ))}
      </div>
      {vue === 'valeurs' && <VueListeValeurs />}
      {vue === 'decomposition' && <VueDecomposition />}
    </>
  );
}

/** Feuil 1 — Liste de valeurs : référentiels d'attributs. */
function VueListeValeurs() {
  const [open, setOpen] = useState<string | null>(LISTES_VALEURS[0].cle);
  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: 12 }}>
      {LISTES_VALEURS.map(l => {
        const ex = open === l.cle;
        return (
          <div key={l.cle} style={{ ...card, padding: 0, overflow: 'hidden' }}>
            <button onClick={() => setOpen(ex ? null : l.cle)} aria-expanded={ex} style={{
              width: '100%', textAlign: 'left', padding: 14, border: 'none', cursor: 'pointer',
              background: ex ? `${PURPLE}08` : '#fff', display: 'block',
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8 }}>
                <span style={{ fontSize: 14, fontWeight: 700, color: INK }}>{l.libelle}</span>
                {ex ? <ChevronDown size={16} color={MUT} /> : <ChevronRight size={16} color={MUT} />}
              </div>
              <div style={{ fontSize: 12, color: MUT, marginTop: 4, lineHeight: 1.45 }}>{l.description}</div>
              <div style={{ marginTop: 8 }}>
                <span style={{ fontSize: 11, fontWeight: 700, color: ORANGE, background: `${ORANGE}14`, padding: '2px 8px', borderRadius: 20 }}>
                  {l.exhaustif ?? l.valeurs.length} valeurs au modèle
                </span>
              </div>
            </button>
            {ex && (
              <div style={{ borderTop: '1px solid #EEF2F7', padding: 12, display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                {l.valeurs.map(v => (
                  <span key={v} style={{ fontSize: 11.5, color: '#334155', background: '#F1F5F9', padding: '3px 9px', borderRadius: 6 }}>{v}</span>
                ))}
                {l.exhaustif && l.exhaustif > l.valeurs.length && (
                  <span style={{ fontSize: 11.5, color: MUT, padding: '3px 4px' }}>+ {l.exhaustif - l.valeurs.length} autres (backend)…</span>
                )}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

/** Feuil 3 — Modèle de décomposition : ACTIF → Composant → Sous-composant + NATURE/DOI. */
function VueDecomposition() {
  const [open, setOpen] = useState<string | null>(MODELE_DECOMPOSITION[0].actif);
  return (
    <>
      <div style={{ display: 'grid', gap: 12 }}>
        {MODELE_DECOMPOSITION.map(a => {
          const ex = open === a.actif;
          return (
            <div key={a.actif} style={{ ...card, padding: 0 }}>
              <button onClick={() => setOpen(ex ? null : a.actif)} aria-expanded={ex} style={{
                width: '100%', textAlign: 'left', padding: 14, border: 'none', cursor: 'pointer',
                background: ex ? `${PURPLE}08` : '#fff', display: 'flex', alignItems: 'center', gap: 10,
              }}>
                {ex ? <ChevronDown size={16} color={MUT} /> : <ChevronRight size={16} color={MUT} />}
                <span style={{ fontSize: 11, fontWeight: 700, color: MUT }}>ACTIF</span>
                <span style={{ fontSize: 15, fontWeight: 800, color: PURPLE }}>{a.actif}</span>
                <span style={{ flex: 1 }} />
                <span style={{ fontSize: 12, color: MUT }}>{a.composants.length} composants</span>
              </button>
              {ex && (
                <div style={{ borderTop: '1px solid #EEF2F7', padding: 12, display: 'grid', gap: 10 }}>
                  {a.composants.map(c => (
                    <div key={c.classification} style={{ border: '1px solid #EEF2F7', borderRadius: 10, padding: 12 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                        <span style={{ fontSize: 13.5, fontWeight: 700, color: INK }}>{c.classification}</span>
                        <span style={{ fontSize: 11, color: MUT }}>(Composant)</span>
                        {c.nature && <Tag color="#1D4ED8" txt={`NATURE ${c.nature}`} />}
                        {c.regleDOI && <Tag color="#B45309" txt={c.regleDOI} />}
                        <Tag color="#15803D" txt={c.cadreBordereau} />
                      </div>
                      <div style={{ marginTop: 8, display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                        {c.sousComposants.map(sc => (
                          <span key={sc} style={{ fontSize: 11.5, color: '#334155', background: '#F8FAFC', border: '1px solid #EEF2F7', padding: '3px 9px', borderRadius: 6 }}>{sc}</span>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>
      <div style={{ ...card, marginTop: 14 }}>
        <div style={{ fontSize: 13, fontWeight: 700, color: INK, marginBottom: 8 }}>Règles DOI (Demande Ouverture Imputation)</div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: 8 }}>
          {REGLES_DOI.map(r => (
            <div key={r.regle} style={{ display: 'flex', gap: 8, alignItems: 'flex-start' }}>
              <Tag color="#B45309" txt={r.regle} />
              <span style={{ fontSize: 12, color: '#475569' }}>{r.description}</span>
            </div>
          ))}
        </div>
      </div>
    </>
  );
}

function Tag({ color, txt }: { color: string; txt: string }) {
  return <span style={{ fontSize: 10.5, fontWeight: 700, color, background: `${color}14`, padding: '2px 7px', borderRadius: 5, whiteSpace: 'nowrap' }}>{txt}</span>;
}

// ─────────────────────────────────────────────────────────────────────────────
// SECTION 2 — REGISTRE DES ACTIFS (assemblage)
// ─────────────────────────────────────────────────────────────────────────────
function Actifs() {
  const { actifs, assemblerActif, supprimerActif } = useImmoModule();
  const [form, setForm] = useState(false);
  const [openId, setOpenId] = useState<string | null>(null);

  const total = useMemo(() => actifs.reduce((s, a) => s + a.valeurTotale, 0), [actifs]);

  return (
    <>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10, marginBottom: 12, flexWrap: 'wrap' }}>
        <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
          <Mini label="Actifs assemblés" value={String(actifs.length)} color={PURPLE} />
          <Mini label="Valeur brute totale" value={cfa(total)} color={ORANGE} />
        </div>
        <button onClick={() => setForm(v => !v)} style={btnPrimary}>
          {form ? <X size={15} /> : <Plus size={15} />} {form ? 'Fermer' : 'Assembler un actif'}
        </button>
      </div>

      {form && <FormAssemblage onDone={a => { if (a) { setForm(false); setOpenId(a.id); } }} assemblerActif={assemblerActif} />}

      <div style={{ display: 'grid', gap: 12, marginTop: 12 }}>
        {actifs.length === 0 && <Empty texte="Aucun actif. Assemblez un actif depuis une famille du référentiel." />}
        {actifs.map(a => {
          const expanded = openId === a.id;
          return (
            <div key={a.id} style={{ ...card, padding: 0 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: 14 }}>
                <button onClick={() => setOpenId(expanded ? null : a.id)} aria-expanded={expanded} style={iconGhost}>
                  {expanded ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
                </button>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
                    <span style={{ fontSize: 11, fontWeight: 700, color: ORANGE }}>{a.code}</span>
                    <span style={{ fontSize: 14.5, fontWeight: 700, color: INK }}>{a.designation}</span>
                  </div>
                  {(a.localisation.region || a.localisation.feeder) && (
                    <div style={{ fontSize: 12, color: MUT, marginTop: 3, display: 'inline-flex', alignItems: 'center', gap: 5 }}>
                      <MapPin size={12} /> {[a.localisation.region, a.localisation.departement, a.localisation.feeder].filter(Boolean).join(' · ')}
                    </div>
                  )}
                  {a.sourceBordereau && (
                    <div style={{ fontSize: 10.5, color: ORANGE, marginTop: 2, display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                      <BookOpen size={10} /> Bordereau : {a.sourceBordereau}
                    </div>
                  )}
                </div>
                <span style={{ ...num, fontSize: 15, fontWeight: 800, color: PURPLE }}>{cfa(a.valeurTotale)}</span>
                <button onClick={() => supprimerActif(a.id)} title="Supprimer" style={{ ...iconGhost, color: '#DC2626' }}><Trash2 size={15} /></button>
              </div>
              {expanded && (
                <div style={{ borderTop: '1px solid #EEF2F7', padding: '4px 10px 12px' }}>
                  {a.arbre.map(n => <ActifRow key={n.code} node={n} />)}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </>
  );
}

function ActifRow({ node, depth = 0 }: { node: ActifNode; depth?: number }) {
  return (
    <>
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, padding: '5px 8px', paddingLeft: 8 + depth * 16, fontSize: 12.5 }}>
        <span style={{ color: node.estGroupe ? PURPLE : '#334155', fontWeight: node.estGroupe ? 700 : 400 }}>
          <span style={{ color: MUT, fontSize: 11, marginRight: 6 }}>{node.code}</span>{node.designation}
          {!node.estGroupe && node.quantite != null && node.quantite !== 1 && <span style={{ color: MUT }}> · {node.quantite} {node.unite}</span>}
        </span>
        <span style={{ ...num, color: node.estGroupe ? PURPLE : '#475569', fontWeight: node.estGroupe ? 700 : 500 }}>{cfa(node.valeur)}</span>
      </div>
      {node.enfants?.map(e => <ActifRow key={e.code} node={e} depth={depth + 1} />)}
    </>
  );
}

function FormAssemblage({ assemblerActif, onDone }: {
  assemblerActif: ReturnType<typeof useImmoModule.getState>['assemblerActif'];
  onDone: (a: ActifStructure | null) => void;
}) {
  const { actifs } = useImmoModule();
  const [familleCode, setFamilleCode] = useState(FAMILLES_ACTIFS[0].code);
  const nextNum = useMemo(() => {
    const max = actifs.filter(a => a.familleCode === familleCode)
      .map(a => parseInt(a.code.split('.').pop() || '0', 10)).reduce((m, v) => Math.max(m, v), 0);
    return max + 1;
  }, [actifs, familleCode]);
  const [numero, setNumero] = useState(nextNum);
  const [designation, setDesignation] = useState('');
  const [region, setRegion] = useState('');
  const [departement, setDept] = useState('');
  const [feeder, setFeeder] = useState('');
  const [bordereauLigne, setBordereauLigne] = useState<BordereauLigne | null>(null);
  const [showBordereau, setShowBordereau] = useState(false);
  useEffect(() => setNumero(nextNum), [nextNum]);

  const famille = FAMILLES_ACTIFS.find(f => f.code === familleCode)!;
  const valRefentiel = coutFamille(famille);
  const valeurFinale = bordereauLigne?.totalFCFA ?? valRefentiel;
  const valid = designation.trim().length > 2;

  return (
    <>
      {showBordereau && (
        <BordereauModal
          onSelect={l => { setBordereauLigne(l); setShowBordereau(false); }}
          onClose={() => setShowBordereau(false)}
        />
      )}
      <div style={{ ...card, background: `${PURPLE}06`, borderColor: '#DDD6FE' }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 10 }}>
          <Field label="Famille (référentiel)">
            <select style={inp} value={familleCode} onChange={e => { setFamilleCode(e.target.value); setBordereauLigne(null); }}>
              {FAMILLES_ACTIFS.map(f => <option key={f.code} value={f.code}>{f.code} — {f.libelle}</option>)}
            </select>
          </Field>
          <Field label="N° d'instance"><input style={inp} type="number" min={1} value={numero} onChange={e => setNumero(parseInt(e.target.value) || 1)} /></Field>
          <Field label="Désignation du projet">
            <input style={inp} value={designation} onChange={e => setDesignation(e.target.value)} placeholder="REEQUIPEMENT … COUPURE CHERIF LO" />
          </Field>
          <Field label="Région"><input style={inp} value={region} onChange={e => setRegion(e.target.value)} /></Field>
          <Field label="Département"><input style={inp} value={departement} onChange={e => setDept(e.target.value)} /></Field>
          <Field label="Feeder"><input style={inp} value={feeder} onChange={e => setFeeder(e.target.value)} /></Field>
        </div>

        {/* Prix bordereau */}
        <div style={{ marginTop: 12, padding: '10px 14px', background: bordereauLigne ? `${ORANGE}08` : '#F8FAFC', border: `1px solid ${bordereauLigne ? `${ORANGE}30` : '#E2E8F0'}`, borderRadius: 9, display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
          <div style={{ flex: 1, minWidth: 200 }}>
            <div style={{ fontSize: 10, fontWeight: 700, color: MUT, textTransform: 'uppercase', letterSpacing: '.4px', marginBottom: 2 }}>Valeur brute (FCFA)</div>
            {bordereauLigne ? (
              <div style={{ fontSize: 13, fontWeight: 800, color: PURPLE, ...num }}>
                {cfa(bordereauLigne.totalFCFA)}
                <span style={{ marginLeft: 8, fontSize: 10, background: `${ORANGE}18`, color: ORANGE, padding: '2px 7px', borderRadius: 4, fontWeight: 700 }}>
                  Lu depuis bordereau · {bordereauLigne.numeroTache} · {bordereauLigne.marche}
                </span>
                <button onClick={() => setBordereauLigne(null)} style={{ marginLeft: 6, border: 'none', background: 'none', cursor: 'pointer', color: '#DC2626', verticalAlign: 'middle', padding: 2 }}><X size={12} /></button>
              </div>
            ) : (
              <div style={{ fontSize: 13, color: '#94A3B8', ...num }}>
                Référentiel : {cfa(valRefentiel)}
                <span style={{ marginLeft: 6, fontSize: 10, background: '#F1F5F9', color: MUT, padding: '2px 6px', borderRadius: 4 }}>estimé</span>
              </div>
            )}
          </div>
          <button onClick={() => setShowBordereau(true)}
            style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '7px 14px', background: '#fff', border: `1.5px solid ${ORANGE}`, borderRadius: 8, cursor: 'pointer', fontSize: 12.5, fontWeight: 700, color: ORANGE, fontFamily: 'inherit', whiteSpace: 'nowrap' }}>
            <BookOpen size={14} /> Lire depuis bordereau
          </button>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginTop: 10, flexWrap: 'wrap' }}>
          <span style={{ fontSize: 12.5, color: MUT }}>
            Code généré : <b style={{ color: ORANGE }}>{famille.code}.{numero}</b> · Valeur : <b style={{ ...num, color: PURPLE }}>{cfa(valeurFinale)}</b>
          </span>
          <div style={{ flex: 1 }} />
          <button disabled={!valid} onClick={() => onDone(assemblerActif({
            familleCode, numero, designation: designation.trim(),
            localisation: { region: region.trim() || undefined, departement: departement.trim() || undefined, feeder: feeder.trim() || undefined },
            valeurBordereau: bordereauLigne?.totalFCFA,
            sourceBordereau: bordereauLigne ? `${bordereauLigne.numeroTache} · ${bordereauLigne.marche}` : undefined,
          }))} style={{ ...btnPrimary, opacity: valid ? 1 : 0.5, cursor: valid ? 'pointer' : 'not-allowed' }}>
            <Save size={15} /> Assembler
          </button>
        </div>
      </div>
    </>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// SECTION 3 — PV DE RÉCEPTION (mise en service)
// ─────────────────────────────────────────────────────────────────────────────
function Receptions() {
  const { actifs, pvs, creerPV, supprimerPV } = useImmoModule();
  const router = useRouter();
  const [editId, setEditId] = useState<string | null>(null);
  const [justValidated, setJustValidated] = useState<{ pvNumero: string; actifCode: string; actifDesignation: string } | null>(null);

  const handleSavePV = (p: Omit<PVReception, 'id'>) => {
    const actif = actifs.find(a => a.id === p.actifId);
    creerPV(p);
    setEditId(null);
    setJustValidated({
      pvNumero: p.numero,
      actifCode: actif?.code ?? '',
      actifDesignation: actif?.designation ?? '',
    });
    // Auto-navigate to amortissements after short delay (let state settle)
    setTimeout(() => router.push('/immobilisations/amortissements'), 1800);
  };

  return (
    <>
      {/* Banner de confirmation post-PV */}
      {justValidated && (
        <div style={{
          display: 'flex', alignItems: 'center', gap: 14,
          background: '#F0FDF4', border: '1px solid #BBF7D0', borderRadius: 12,
          padding: '12px 18px', marginBottom: 14, flexWrap: 'wrap',
        }}>
          <div style={{ width: 34, height: 34, borderRadius: 9, background: '#16A34A', display: 'grid', placeItems: 'center', flexShrink: 0 }}>
            <Zap size={16} color="#fff" />
          </div>
          <div style={{ flex: 1, minWidth: 200 }}>
            <div style={{ fontSize: 13.5, fontWeight: 800, color: '#14532D' }}>
              Plan d'amortissement déclenché — {justValidated.pvNumero}
            </div>
            <div style={{ fontSize: 12, color: '#166534', marginTop: 2 }}>
              Actif <b>{justValidated.actifCode}</b> · {justValidated.actifDesignation} · Décomposition SYSCOHADA appliquée · Prorata temporis activé
            </div>
          </div>
          <Link href="/immobilisations/amortissements" style={{ textDecoration: 'none' }}>
            <button style={{ ...btnPrimary, background: '#16A34A', fontSize: 12 }}>
              <ArrowRight size={13} /> Voir le plan
            </button>
          </Link>
          <button onClick={() => setJustValidated(null)} style={{ ...iconGhost, flexShrink: 0 }}><X size={14} /></button>
        </div>
      )}

      <div style={{ ...card, padding: 0, overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12.5 }}>
          <thead>
            <tr style={{ background: '#F8FAFC', textAlign: 'left', color: '#475569' }}>
              {['Code', 'Actif', 'Valeur brute', 'PV n°', 'Mise en service', 'Durée', 'Méthode', 'Statut', ''].map((h, i) => (
                <th key={i} style={{ padding: '11px 12px', fontWeight: 700, whiteSpace: 'nowrap' }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {actifs.length === 0 && <tr><td colSpan={9} style={{ padding: 24, textAlign: 'center', color: '#94A3B8' }}>Aucun actif à réceptionner.</td></tr>}
            {actifs.map(a => {
              const pv = pvs.find(v => v.actifId === a.id);
              return (
                <tr key={a.id} style={{ borderTop: '1px solid #EEF2F7' }}>
                  <td style={{ padding: '10px 12px', fontWeight: 700, color: ORANGE }}>{a.code}</td>
                  <td style={{ padding: '10px 12px', maxWidth: 320 }}>{a.designation}</td>
                  <td style={{ padding: '10px 12px', ...num }}>{cfa(a.valeurTotale)}</td>
                  <td style={{ padding: '10px 12px' }}>{pv ? <b>{pv.numero}</b> : <span style={{ color: '#94A3B8' }}>—</span>}</td>
                  <td style={{ padding: '10px 12px', ...num }}>{pv ? frDate(pv.dateReceptionProvisoire) : '—'}</td>
                  <td style={{ padding: '10px 12px', textAlign: 'center' }}>{pv ? `${pv.dureeAmort} ans` : '—'}</td>
                  <td style={{ padding: '10px 12px' }}>{pv ? (pv.methode === 'lineaire' ? 'Linéaire' : 'Dégressif') : '—'}</td>
                  <td style={{ padding: '10px 12px' }}>
                    {pv ? (
                      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 11, fontWeight: 700, color: '#16A34A', background: '#F0FDF4', padding: '3px 8px', borderRadius: 6 }}>
                        <Zap size={10} /> Amortissable
                      </span>
                    ) : (
                      <span style={{ fontSize: 11, color: '#94A3B8' }}>En attente PV</span>
                    )}
                  </td>
                  <td style={{ padding: '10px 12px', whiteSpace: 'nowrap' }}>
                    <button onClick={() => setEditId(editId === a.id ? null : a.id)} style={{ ...btnGhost, ...(pv ? {} : { borderColor: ORANGE, color: ORANGE }) }}>
                      {pv ? 'Modifier' : <><Plus size={13} /> Réceptionner</>}
                    </button>
                    {pv && <button onClick={() => supprimerPV(pv.id)} title="Annuler le PV" style={{ ...iconGhost, color: '#DC2626' }}><Trash2 size={14} /></button>}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {editId && (() => {
        const a = actifs.find(x => x.id === editId)!;
        const pv = pvs.find(v => v.actifId === editId);
        return <FormPV actif={a} pv={pv} onSave={handleSavePV} onClose={() => setEditId(null)} />;
      })()}
    </>
  );
}

function FormPV({ actif, pv, onSave, onClose }: {
  actif: ActifStructure; pv?: PVReception;
  onSave: (p: Omit<PVReception, 'id'>) => void; onClose: () => void;
}) {
  const [f, setF] = useState({
    numero: pv?.numero ?? `PV-${new Date().getFullYear()}-`,
    dateReceptionProvisoire: pv?.dateReceptionProvisoire ?? new Date().toISOString().slice(0, 10),
    dureeAmort: String(pv?.dureeAmort ?? 20),
    methode: (pv?.methode ?? 'lineaire') as MethodeAmort,
    valeurResiduelle: String(pv?.valeurResiduelle ?? 0),
    signePar: pv?.signePar ?? '',
    observations: pv?.observations ?? '',
  });
  // Classification (Liste de valeurs + Décomposition) — utilisée au moment d'immobiliser.
  const [c, setC] = useState<ClassificationActif>(pv?.classification ?? {});
  const composantsDispo = c.organisationDepense ? composantsDe(c.organisationDepense) : [];
  const compObj = c.composant ? trouverComposant(c.composant) : undefined;
  const sousDispo = compObj?.sousComposants ?? [];

  // Sélection d'un composant ⇒ NATURE + règle DOI auto-renseignées.
  const choisirComposant = (classification: string) => {
    const co = trouverComposant(classification);
    setC(prev => ({ ...prev, composant: classification, sousComposant: undefined, nature: co?.nature, regleDOI: co?.regleDOI }));
  };
  const valid = f.numero.trim().length > 3 && !!f.dateReceptionProvisoire;
  const opt = (cle: string) => getListe(cle)?.valeurs ?? [];

  return (
    <div onClick={onClose} style={overlay}>
      <div onClick={e => e.stopPropagation()} style={{ ...card, maxWidth: 680, width: '100%', maxHeight: '88vh', overflowY: 'auto' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12, gap: 12 }}>
          <div style={{ minWidth: 0 }}>
            <h3 style={{ margin: 0, fontSize: 16, fontWeight: 800, color: INK, display: 'flex', alignItems: 'center', gap: 8 }}>
              <ClipboardCheck size={18} color={PURPLE} /> PV de réception → mise en service
            </h3>
            <p style={{ margin: '3px 0 0', fontSize: 12.5, color: MUT, overflowWrap: 'anywhere' }}>{actif.code} — {actif.designation}</p>
            <p style={{ margin: '2px 0 0', fontSize: 12.5, ...num, color: PURPLE, fontWeight: 700 }}>{cfa(actif.valeurTotale)}</p>
          </div>
          <button onClick={onClose} style={{ ...iconGhost, flexShrink: 0 }}><X size={16} /></button>
        </div>

        {/* Bloc 1 — réception / amortissement */}
        <FieldSet titre="Réception & amortissement">
          <div style={gridForm}>
            <Field label="N° du PV"><input style={inp} value={f.numero} onChange={e => setF({ ...f, numero: e.target.value })} /></Field>
            <Field label="Date réception provisoire (MES)"><input type="date" style={inp} value={f.dateReceptionProvisoire} onChange={e => setF({ ...f, dateReceptionProvisoire: e.target.value })} /></Field>
            <Field label="Durée d'amortissement (ans)"><input style={inp} inputMode="numeric" value={f.dureeAmort} onChange={e => setF({ ...f, dureeAmort: e.target.value })} /></Field>
            <Field label="Méthode">
              <select style={inp} value={f.methode} onChange={e => setF({ ...f, methode: e.target.value as MethodeAmort })}>
                <option value="lineaire">Linéaire (prorata temporis)</option>
                <option value="degressif">Dégressif</option>
              </select>
            </Field>
            <Field label="Valeur résiduelle (FCFA)"><input style={inp} inputMode="numeric" value={f.valeurResiduelle} onChange={e => setF({ ...f, valeurResiduelle: e.target.value })} /></Field>
            <Field label="Signé par"><input style={inp} value={f.signePar} onChange={e => setF({ ...f, signePar: e.target.value })} placeholder="Commission de réception" /></Field>
          </div>
        </FieldSet>

        {/* Bloc 2 — classification (Liste de valeurs + Décomposition) */}
        <FieldSet titre="Classification de l'actif (Liste de valeurs · Décomposition)">
          <div style={gridForm}>
            <Field label="Organisation de dépense">
              <select style={inp} value={c.organisationDepense ?? ''} onChange={e => setC({ ...c, organisationDepense: e.target.value || undefined, composant: undefined, sousComposant: undefined, nature: undefined, regleDOI: undefined })}>
                <option value="">—</option>
                {ORGANISATIONS_DEPENSE.map(o => <option key={o} value={o}>{o}</option>)}
              </select>
            </Field>
            <Field label="Composant (Classification Actif Projet)">
              <select style={inp} value={c.composant ?? ''} disabled={!c.organisationDepense} onChange={e => choisirComposant(e.target.value)}>
                <option value="">—</option>
                {composantsDispo.map(co => <option key={co.classification} value={co.classification}>{co.classification}</option>)}
              </select>
            </Field>
            <Field label="Sous-composant (Actif Livrable)">
              <select style={inp} value={c.sousComposant ?? ''} disabled={!c.composant} onChange={e => setC({ ...c, sousComposant: e.target.value || undefined })}>
                <option value="">—</option>
                {sousDispo.map(sc => <option key={sc} value={sc}>{sc}</option>)}
              </select>
            </Field>
            <Field label="NATURE (classe comptable)"><input style={{ ...inp, background: '#F8FAFC' }} value={c.nature ?? ''} onChange={e => setC({ ...c, nature: e.target.value || undefined })} placeholder="auto" /></Field>
            <Field label="Règle DOI"><input style={{ ...inp, background: '#F8FAFC' }} value={c.regleDOI ?? ''} onChange={e => setC({ ...c, regleDOI: e.target.value || undefined })} placeholder="auto" /></Field>
            <Field label="Domaine Budget (BIT)">
              <select style={inp} value={c.domaineBIT ?? ''} onChange={e => setC({ ...c, domaineBIT: e.target.value || undefined })}>
                <option value="">—</option>{opt('domaine_budget').map(v => <option key={v} value={v}>{v}</option>)}
              </select>
            </Field>
            <Field label="Processus opérationnel">
              <select style={inp} value={c.processus ?? ''} onChange={e => setC({ ...c, processus: e.target.value || undefined })}>
                <option value="">—</option>{opt('processus').map(v => <option key={v} value={v}>{v}</option>)}
              </select>
            </Field>
            <Field label="Bailleur">
              <select style={inp} value={c.bailleur ?? ''} onChange={e => setC({ ...c, bailleur: e.target.value || undefined })}>
                <option value="">—</option>{opt('bailleur').map(v => <option key={v} value={v}>{v}</option>)}
              </select>
            </Field>
            <Field label="Unité actif livrable">
              <select style={inp} value={c.unite ?? ''} onChange={e => setC({ ...c, unite: e.target.value || undefined })}>
                <option value="">—</option>{opt('unite').map(v => <option key={v} value={v}>{v}</option>)}
              </select>
            </Field>
            <Field label="Statut RMA">
              <select style={inp} value={c.statutRMA ?? ''} onChange={e => setC({ ...c, statutRMA: e.target.value || undefined })}>
                <option value="">—</option>{opt('statut_rma').map(v => <option key={v} value={v}>{v}</option>)}
              </select>
            </Field>
          </div>
        </FieldSet>

        <Field label="Observations"><input style={inp} value={f.observations} onChange={e => setF({ ...f, observations: e.target.value })} /></Field>

        {/* Aperçu décomposition + plan d'amortissement */}
        {(compObj || f.dateReceptionProvisoire) && (
          <FieldSet titre="Aperçu — déclenchement amortissement">
            {compObj && sousDispo.length > 0 && (
              <div style={{ marginBottom: 10 }}>
                <div style={{ fontSize: 11, fontWeight: 700, color: MUT, marginBottom: 5 }}>
                  Sous-composants capitalisés ({sousDispo.length} articles)
                </div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5 }}>
                  {sousDispo.map(sc => (
                    <span key={sc} style={{ fontSize: 11, background: `${PURPLE}0F`, color: PURPLE, border: `1px solid ${PURPLE}22`, borderRadius: 5, padding: '3px 8px', fontWeight: 600 }}>
                      {sc}
                    </span>
                  ))}
                </div>
              </div>
            )}
            {c.nature && (
              <div style={{ fontSize: 11, color: MUT, marginBottom: 4 }}>
                <b>Compte SYSCOHADA :</b> {c.nature}
                {c.regleDOI && <> &nbsp;·&nbsp; <b>DOI :</b> {c.regleDOI}</>}
              </div>
            )}
            {f.dateReceptionProvisoire && (
              <div style={{ fontSize: 11, color: '#059669', fontWeight: 700, marginTop: 4 }}>
                <Zap size={11} style={{ verticalAlign: 'middle', marginRight: 3 }} />
                Plan linéaire (prorata temporis) sur {f.dureeAmort || 20} ans — départ {frDate(f.dateReceptionProvisoire)} — dotation annuelle ≈ {cfa((actif.valeurTotale - (parseFloat(f.valeurResiduelle) || 0)) / (parseInt(f.dureeAmort) || 20))}
              </div>
            )}
          </FieldSet>
        )}

        <div style={{ display: 'flex', gap: 8, marginTop: 14 }}>
          <button disabled={!valid} onClick={() => onSave({
            numero: f.numero.trim(), actifId: actif.id, dateReceptionProvisoire: f.dateReceptionProvisoire,
            dureeAmort: parseInt(f.dureeAmort) || 20, methode: f.methode, valeurResiduelle: parseFloat(f.valeurResiduelle) || 0,
            signePar: f.signePar.trim() || undefined, observations: f.observations.trim() || undefined,
            dateSignature: f.dateReceptionProvisoire,
            classification: Object.values(c).some(Boolean) ? c : undefined,
          })} style={{ ...btnPrimary, opacity: valid ? 1 : 0.5, cursor: valid ? 'pointer' : 'not-allowed' }}>
            <Zap size={15} /> Valider & déclencher l'amortissement
          </button>
          <button onClick={onClose} style={btnGhost}>Annuler</button>
        </div>
      </div>
    </div>
  );
}

const gridForm: React.CSSProperties = { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 10 };
function FieldSet({ titre, children }: { titre: string; children: React.ReactNode }) {
  return (
    <fieldset style={{ border: '1px solid #EEF2F7', borderRadius: 12, padding: '10px 14px 14px', margin: '0 0 14px', minWidth: 0 }}>
      <legend style={{ fontSize: 11, fontWeight: 800, color: PURPLE, textTransform: 'uppercase', letterSpacing: '0.04em', padding: '0 6px' }}>{titre}</legend>
      {children}
    </fieldset>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// SECTION 4 — PLANS D'AMORTISSEMENT
// ─────────────────────────────────────────────────────────────────────────────
function Amortissements() {
  const { actifs, pvs } = useImmoModule();
  const recus = useMemo(() => actifs.filter(a => pvs.some(v => v.actifId === a.id)), [actifs, pvs]);
  const [sel, setSel] = useState<string>('');
  useEffect(() => { if (!sel && recus.length) setSel(recus[0].id); }, [recus, sel]);
  const [vue, setVue] = useState<'consolide' | 'articles'>('consolide');

  const actif = recus.find(a => a.id === sel);
  const pv = actif ? pvs.find(v => v.actifId === actif.id) : undefined;

  if (recus.length === 0) return <Empty texte="Aucun actif réceptionné. Établissez un PV de réception pour générer un plan d'amortissement." />;

  return (
    <>
      <div style={{ display: 'flex', gap: 10, alignItems: 'center', marginBottom: 14, flexWrap: 'wrap' }}>
        <select value={sel} onChange={e => setSel(e.target.value)} style={{ ...inp, width: 'auto', minWidth: 320, fontWeight: 600 }}>
          {recus.map(a => <option key={a.id} value={a.id}>{a.code} — {a.designation}</option>)}
        </select>
        <div style={{ display: 'flex', gap: 4, background: '#F1F5F9', borderRadius: 9, padding: 3 }}>
          {(['consolide', 'articles'] as const).map(v => (
            <button key={v} onClick={() => setVue(v)} style={{
              padding: '6px 14px', borderRadius: 7, border: 'none', cursor: 'pointer', fontSize: 12.5, fontWeight: 700,
              background: vue === v ? '#fff' : 'transparent', color: vue === v ? PURPLE : MUT,
              boxShadow: vue === v ? '0 1px 3px rgba(0,0,0,.08)' : 'none',
            }}>{v === 'consolide' ? 'Plan consolidé' : 'Par article'}</button>
          ))}
        </div>
      </div>

      {actif && pv && (
        <>
          <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', marginBottom: 14 }}>
            <Mini label="Valeur brute" value={cfa(actif.valeurTotale)} color={ORANGE} icon={<Layers size={14} />} />
            <Mini label="Amort. cumulés (à ce jour)" value={cfa(actif.valeurTotale - vncActif(actif, pv))} color="#B45309" icon={<TrendingDown size={14} />} />
            <Mini label="VNC (à ce jour)" value={cfa(vncActif(actif, pv))} color="#15803D" icon={<Building2 size={14} />} />
            <Mini label="PV" value={`${pv.numero} · ${frDate(pv.dateReceptionProvisoire)}`} color={PURPLE} icon={<FileText size={14} />} />
          </div>

          {vue === 'consolide' ? <PlanConsolide actif={actif} pv={pv} /> : <PlanArticles actif={actif} pv={pv} />}
        </>
      )}
    </>
  );
}

function PlanConsolide({ actif, pv }: { actif: ActifStructure; pv: PVReception }) {
  const plan = planConsolide(actif, pv);
  return (
    <div style={{ ...card, padding: 0, overflowX: 'auto' }}>
      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12.5 }}>
        <thead>
          <tr style={{ background: '#F8FAFC', color: '#475569', textAlign: 'right' }}>
            <th style={{ padding: '10px 12px', textAlign: 'left' }}>Exercice</th>
            <th style={{ padding: '10px 12px', textAlign: 'left' }}>Clôture</th>
            <th style={{ padding: '10px 12px' }}>Base (VNC début)</th>
            <th style={{ padding: '10px 12px' }}>Jours</th>
            <th style={{ padding: '10px 12px' }}>Dotation</th>
            <th style={{ padding: '10px 12px' }}>Cumul</th>
            <th style={{ padding: '10px 12px' }}>VNC fin</th>
          </tr>
        </thead>
        <tbody>
          {plan.map(l => (
            <tr key={l.exercice} style={{ borderTop: '1px solid #EEF2F7', textAlign: 'right' }}>
              <td style={{ padding: '8px 12px', textAlign: 'left', fontWeight: 700 }}>{l.exercice}</td>
              <td style={{ padding: '8px 12px', textAlign: 'left', ...num }}>{frDate(l.date)}</td>
              <td style={{ padding: '8px 12px', ...num }}>{cfa(l.base)}</td>
              <td style={{ padding: '8px 12px', ...num, color: MUT }}>{l.jours}</td>
              <td style={{ padding: '8px 12px', ...num, color: '#B45309' }}>{cfa(l.dotation)}</td>
              <td style={{ padding: '8px 12px', ...num }}>{cfa(l.cumul)}</td>
              <td style={{ padding: '8px 12px', ...num, fontWeight: 700, color: '#15803D' }}>{cfa(l.vnc)}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <p style={{ fontSize: 11, color: '#94A3B8', padding: '8px 12px', margin: 0 }}>
        Prorata temporis : 1re clôture au 31/12 de l'année de mise en service au prorata des jours. Dotation linéaire = (valeur brute − valeur résiduelle) ÷ durée.
      </p>
    </div>
  );
}

function PlanArticles({ actif, pv }: { actif: ActifStructure; pv: PVReception }) {
  const lignes = amortirActif(actif, pv);
  const annees = useMemo(() => {
    const set = new Set<number>();
    lignes.forEach(l => l.plan.forEach(e => set.add(e.exercice)));
    return [...set].sort((a, b) => a - b);
  }, [lignes]);
  return (
    <div style={{ ...card, padding: 0, overflowX: 'auto' }}>
      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
        <thead>
          <tr style={{ background: '#F8FAFC', color: '#475569' }}>
            <th style={{ padding: '10px 12px', textAlign: 'left', position: 'sticky', left: 0, background: '#F8FAFC', minWidth: 240 }}>Article capitalisé</th>
            <th style={{ padding: '10px 12px', textAlign: 'right' }}>Valeur brute</th>
            {annees.map(y => <th key={y} style={{ padding: '10px 12px', textAlign: 'right' }}>Dot. {y}</th>)}
          </tr>
        </thead>
        <tbody>
          {lignes.map(({ node, plan }) => {
            const byYear = new Map(plan.map(e => [e.exercice, e.dotation]));
            return (
              <tr key={node.code} style={{ borderTop: '1px solid #EEF2F7' }}>
                <td style={{ padding: '7px 12px', position: 'sticky', left: 0, background: '#fff' }}>
                  <span style={{ color: MUT, fontSize: 10.5, marginRight: 5 }}>{node.code}</span>{node.designation}
                </td>
                <td style={{ padding: '7px 12px', textAlign: 'right', ...num, fontWeight: 600 }}>{cfa(node.valeur)}</td>
                {annees.map(y => (
                  <td key={y} style={{ padding: '7px 12px', textAlign: 'right', ...num, color: byYear.get(y) ? '#B45309' : '#CBD5E1' }}>
                    {byYear.get(y) ? cfa(byYear.get(y)!) : '—'}
                  </td>
                ))}
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

// ── Atomes UI ────────────────────────────────────────────────────────────────
function Mini({ label, value, color, icon }: { label: string; value: string; color: string; icon?: React.ReactNode }) {
  return (
    <div style={{ ...card, padding: '10px 14px', minWidth: 150 }}>
      <div style={{ fontSize: 11, color: MUT, fontWeight: 600, display: 'flex', alignItems: 'center', gap: 5 }}>{icon}{label}</div>
      <div style={{ fontSize: 18, fontWeight: 800, color, marginTop: 3, ...num }}>{value}</div>
    </div>
  );
}
function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <label style={{ display: 'block', marginTop: 8 }}><span style={{ fontSize: 11, fontWeight: 600, color: MUT, display: 'block', marginBottom: 3 }}>{label}</span>{children}</label>;
}
function Empty({ texte }: { texte: string }) {
  return <div style={{ ...card, textAlign: 'center', padding: 40, color: '#94A3B8' }}>{texte}</div>;
}
function frDate(d: string) { const x = new Date(d); return isNaN(x.getTime()) ? d : x.toLocaleDateString('fr-FR'); }

const btnPrimary: React.CSSProperties = { display: 'inline-flex', alignItems: 'center', gap: 7, padding: '9px 16px', borderRadius: 9, background: PURPLE, color: '#fff', border: 'none', fontSize: 13, fontWeight: 700, cursor: 'pointer' };
const btnGhost: React.CSSProperties = { display: 'inline-flex', alignItems: 'center', gap: 5, padding: '7px 12px', borderRadius: 8, background: '#fff', border: '1px solid #CBD5E1', fontSize: 12.5, fontWeight: 600, color: '#475569', cursor: 'pointer', marginRight: 4 };
const iconGhost: React.CSSProperties = { display: 'inline-grid', placeItems: 'center', width: 30, height: 30, borderRadius: 7, background: '#F1F5F9', border: 'none', cursor: 'pointer', color: '#475569' };
const overlay: React.CSSProperties = { position: 'fixed', inset: 0, background: 'rgba(15,23,42,.5)', display: 'grid', placeItems: 'center', zIndex: 60, padding: 16 };

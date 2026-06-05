/**
 * builder.ts — Construit l'arbre de structuration (Composant → Sous-composant →
 * Article) à partir des lignes d'un bordereau (BOQ). C'est le calcul qui était
 * fait À LA MAIN dans Excel pour chaque projet.
 *
 * Deux stratégies, combinées :
 *  1) CODES HIÉRARCHIQUES (ex. POSTE.TE.1.2.1.1) → parent = code sans le dernier segment.
 *  2) EN-TÊTES DE SECTION (lignes sans quantité, en MAJUSCULES) → début d'un composant.
 */
import type { ArticleBOQ, Composant, SousComposant, StructurationProjet, Devise, AttributsImmo } from './types';

export interface BOQInputRow {
  code?: string;
  designation: string;
  unite?: string;
  quantite?: number;
  prixUnitaire?: number;
  fourniture?: number;
  transport?: number;
  montage?: number;
  devise?: Devise;
  attributs?: AttributsImmo;
}

let _seq = 0;
const uid = (p: string) => `${p}_${Date.now().toString(36)}_${(_seq++).toString(36)}`;
const num = (v: unknown) => { const n = typeof v === 'number' ? v : parseFloat(String(v ?? '').replace(/[^\d.,-]/g, '').replace(',', '.')); return Number.isFinite(n) ? n : 0; };
const isHeader = (r: BOQInputRow) => {
  const q = num(r.quantite); const d = (r.designation || '').trim();
  return q === 0 && d.length > 2 && d === d.toUpperCase() && /[A-ZÀ-Ÿ]/.test(d);
};
const parentCode = (code?: string) => (code && code.includes('.') ? code.split('.').slice(0, -1).join('.') : undefined);
const rootCode = (code?: string) => (code ? code.split('.').slice(0, Math.max(1, code.split('.').length - 2)).join('.') : undefined);

function articleFromRow(r: BOQInputRow): ArticleBOQ {
  const qte = num(r.quantite), pu = num(r.prixUnitaire);
  const f = num(r.fourniture), t = num(r.transport), m = num(r.montage);
  const total = (f + t + m) > 0 ? (f + t + m) * (qte || 1) : qte * pu;
  return {
    id: uid('art'), code: r.code, designation: r.designation, unite: r.unite || 'U',
    quantite: qte, prixUnitaire: pu, devise: r.devise || 'CFA',
    fourniture: f || undefined, transport: t || undefined, montage: m || undefined,
    total: Math.round(total),
  };
}

/**
 * Construit la structuration. `rows` = lignes du bordereau (priced + headers).
 */
export function structurerDepuisBOQ(
  rows: BOQInputRow[],
  meta: { projetCode: string; projetNom: string; deviseRef?: Devise; source?: string; attributsDefaut?: AttributsImmo },
): StructurationProjet {
  const composants = new Map<string, Composant>();
  const sousComposants = new Map<string, SousComposant>();
  const ensureComposant = (key: string, nom: string, code?: string, attrs?: AttributsImmo): Composant => {
    let c = composants.get(key);
    if (!c) { c = { id: uid('cmp'), code, nom, attributs: { ...meta.attributsDefaut, ...attrs }, sousComposants: [], total: 0 }; composants.set(key, c); }
    return c;
  };
  const ensureSousComposant = (compKey: string, key: string, nom: string, code?: string, attrs?: AttributsImmo): SousComposant => {
    let s = sousComposants.get(key);
    if (!s) {
      s = { id: uid('sc'), code, nom, attributs: { ...meta.attributsDefaut, ...attrs }, articles: [], total: 0, immobilisable: true };
      sousComposants.set(key, s);
      ensureComposant(compKey, nom).sousComposants.push(s);
    }
    return s;
  };

  let currentComposantKey = 'GENERAL';
  let currentComposantName = 'Général';
  composants.set('GENERAL', { id: uid('cmp'), code: undefined, nom: 'Général', attributs: { ...meta.attributsDefaut }, sousComposants: [], total: 0 });

  for (const r of rows) {
    if (isHeader(r)) { currentComposantKey = r.code || r.designation; currentComposantName = r.designation; ensureComposant(currentComposantKey, currentComposantName, r.code, r.attributs); continue; }
    if (num(r.quantite) <= 0 && num(r.prixUnitaire) <= 0 && num(r.fourniture) <= 0) continue; // ligne vide

    const art = articleFromRow(r);
    // Stratégie codes : composant = racine, sous-composant = parent du code article
    const scCode = parentCode(r.code);
    const cmpCode = rootCode(r.code) || currentComposantKey;
    const cmpName = composants.get(cmpCode)?.nom || currentComposantName;
    ensureComposant(cmpCode, cmpName, rootCode(r.code), r.attributs);
    const scKey = scCode || `${cmpCode}::SC`;
    const sc = ensureSousComposant(cmpCode, scKey, r.designation.slice(0, 60), scCode, r.attributs);
    sc.articles.push(art);
  }

  // Totaux + nettoyage des conteneurs vides
  const list = [...composants.values()].filter(c => c.sousComposants.length > 0);
  let total = 0;
  list.forEach(c => {
    c.sousComposants.forEach(sc => { sc.total = sc.articles.reduce((s, a) => s + a.total, 0); });
    c.total = c.sousComposants.reduce((s, sc) => s + sc.total, 0);
    total += c.total;
  });

  return {
    projetCode: meta.projetCode, projetNom: meta.projetNom,
    deviseRef: meta.deviseRef || 'CFA',
    composants: list, total: Math.round(total),
    source: meta.source || 'IA (BOQ)', dateCreation: new Date().toISOString(), valide: false,
  };
}

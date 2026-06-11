/**
 * referentiel.ts — RÉFÉRENTIEL DE STRUCTURATION DES ACTIFS (feuilles 1–3)
 * ----------------------------------------------------------------------
 * Bibliothèque de « familles d'actifs » réutilisables, extraite du bordereau
 * PASE2 (Téléconduite / GIS). Chaque famille décrit, une seule fois, la
 * décomposition normalisée Composant → Sous-composant → Article avec les
 * prix unitaires figés (Fourniture / Transport / Montage en FCFA).
 *
 * Les PROJETS (feuille 4) ne RE-saisissent rien : ils INSTANCIENT une famille
 * sur une localisation (Région / Département / Feeder) — cf. assembleur.ts.
 *
 * Source des montants : bordereau « REEQUIPEMENT … GIS » fourni par la DPE.
 */

import type { CategorieImmo } from '@/lib/immobilisationStore';

// ─────────────────────────────────────────────────────────────────────────────
// TYPES
// ─────────────────────────────────────────────────────────────────────────────

/** Nœud du gabarit : soit un groupe (a des enfants), soit un article chiffré. */
export interface RefNode {
  code: string;            // suffixe relatif (ex. '1', '3.1', '5.2')
  designation: string;
  unite?: string;          // U, ens, u…
  quantite?: number;       // ratio/quantité (REEQ.MAN : 1.88, 0.54…)
  fourniture?: number;     // FCFA
  transport?: number;      // FCFA
  montage?: number;        // FCFA
  enfants?: RefNode[];     // présent ⇒ c'est un GROUPE (composant)
}

/** Famille d'actif = gabarit complet d'un type de poste/ouvrage. */
export interface FamilleActif {
  code: string;            // 'REEQ.COUP', 'PREFA.TE'…
  libelle: string;
  description: string;
  categorie: CategorieImmo;
  compteImmo: string;      // compte SYSCOHADA (66209 travaux régie / 66210 préfa)
  compteAffect: string;    // compte d'affectation (534)
  classeProjet: string;    // '03'
  dureeAmort: number;      // durée d'amortissement (années)
  noeuds: RefNode[];
}

// ─────────────────────────────────────────────────────────────────────────────
// SOUS-ARBRES PARTAGÉS (réutilisés par plusieurs familles — DRY)
// ─────────────────────────────────────────────────────────────────────────────

/** ACCESSOIRES ELECTRIQUES — identique sur COUP / TE / MAN. */
const ACCESSOIRES = (code: string): RefNode => ({
  code, designation: 'ACCESSOIRES ELECTRIQUES', unite: 'ens', quantite: 1,
  fourniture: 3_108_518.34, transport: 190_187.21, montage: 692_682.87,
});

/** DIVERS TRAVAUX DE GENIE CIVIL. */
const GENIE_CIVIL = (code: string): RefNode => ({
  code, designation: 'DIVERS TRAVAUX DE GENIE CIVIL', enfants: [
    { code: `${code}.1`, designation: "Chassis de stabilisation pour l'installation des EE sur les postes existants", unite: 'u', quantite: 1, fourniture: 1_157.80 },
    { code: `${code}.2`, designation: 'Refections mineures (peinture/etancheité/aeration)', unite: 'u', quantite: 1, fourniture: 8_567.72 },
  ],
});

/** AUTRES TRAVAUX DIVERS. */
const AUTRES_TRAVAUX = (code: string): RefNode => ({
  code, designation: 'AUTRES TRAVAUX DIVERS', enfants: [
    { code: `${code}.1`, designation: 'Amelioration des valeurs de terre des postes', unite: 'u', quantite: 1, fourniture: 231.56, montage: 2_554.44 },
    { code: `${code}.2`, designation: 'Transport et pose de transformateur adaptés aux postes prefabriqués (fourniture par Senelec)', unite: 'u', quantite: 1, fourniture: 231.56, montage: 808.92 },
  ],
});

/** EQUIPEMENT DE TELECONDUITE. */
const TELECONDUITE = (code: string): RefNode => ({
  code, designation: 'EQUIPEMENT DE TELECONDUITE', enfants: [
    { code: `${code}.1`, designation: 'Coffret ITI 4 voies', unite: 'ens', quantite: 1, fourniture: 3_061_660, transport: 30_617 },
    { code: `${code}.2`, designation: 'Antenne GSM/GPRS/3G', unite: 'ens', quantite: 1, fourniture: 173_670, transport: 13_894, montage: 21_287 },
    { code: `${code}.3`, designation: "Forfait/poste pour l'installation des accessoires de raccordement et fixations des ITI et RTU", unite: 'ens', quantite: 1, fourniture: 34_734, montage: 127_722 },
  ],
});

/** TESTS POINT à POINT & INTEGRATION. */
const TESTS = (code: string): RefNode => ({
  code, designation: 'TESTS POINT à POINT & INTEGRATION', enfants: [
    { code: `${code}.1`, designation: 'Essais point à point', unite: 'u', quantite: 1, fourniture: 213_334, montage: 42_574 },
  ],
});

/** Génère N articles « Dépose complète » identiques (désaffectation). */
const deposes = (libelle: string, fourniture: number, montage: number, n: number): RefNode[] =>
  Array.from({ length: n }, (_, i) => ({
    code: String(i + 1), designation: `${libelle} N°${i + 1}`, unite: 'u', quantite: 1, fourniture, montage,
  }));

// ─────────────────────────────────────────────────────────────────────────────
// RÉFÉRENTIEL DES FAMILLES
// ─────────────────────────────────────────────────────────────────────────────

export const FAMILLES_ACTIFS: FamilleActif[] = [
  // ── REEQ.COUP — Équipement électrique en coupure (GIS 2IP) ─────────────────
  {
    code: 'REEQ.COUP', libelle: 'Rééquipement GIS — Coupure',
    description: 'Équipement électrique poste HTA/BT H59 cellule fermée GIS, en coupure (2 IP).',
    categorie: 'Poste HTA/BT', compteImmo: '66209', compteAffect: '534', classeProjet: '03', dureeAmort: 20,
    noeuds: [
      { code: '1', designation: 'EE en Coupure 30 kV en Cellule GIS Compactes 2IP POSTE HTA/BT', unite: 'ens', quantite: 1, fourniture: 5_576_720, transport: 108_756, montage: 127_722 },
      ACCESSOIRES('2'),
      GENIE_CIVIL('3'),
      AUTRES_TRAVAUX('4'),
      TELECONDUITE('5'),
      TESTS('6'),
    ],
  },
  // ── REEQ.TE — Équipement électrique en Té (GIS 3IP) ────────────────────────
  {
    code: 'REEQ.TE', libelle: 'Rééquipement GIS — Té',
    description: 'Équipement électrique poste HTA/BT H59 cellule fermée GIS, en Té (3 IP).',
    categorie: 'Poste HTA/BT', compteImmo: '66209', compteAffect: '534', classeProjet: '03', dureeAmort: 20,
    noeuds: [
      { code: '1', designation: 'EE en Té 30 kV en Cellule GIS Compactes 3IP POSTE HTA/BT', unite: 'ens', quantite: 1, fourniture: 6_526_798, transport: 126_831, montage: 127_722 },
      ACCESSOIRES('2'),
      GENIE_CIVIL('3'),
      AUTRES_TRAVAUX('4'),
      TELECONDUITE('5'),
      TESTS('6'),
    ],
  },
  // ── REEQ.MAN — Poste de manœuvre HTA en GIS ────────────────────────────────
  {
    code: 'REEQ.MAN', libelle: 'Rééquipement GIS — Poste de manœuvre',
    description: 'Rééquipement électrique poste manœuvre HTA en GIS (cellules blindées).',
    categorie: 'Poste HTA/BT', compteImmo: '66209', compteAffect: '534', classeProjet: '03', dureeAmort: 20,
    noeuds: [
      { code: '1', designation: 'Cellules blindées Interrupteur motorisé + ens connecteurs separables', unite: 'u', quantite: 1.88, fourniture: 2_089_278, transport: 20_430, montage: 42_574 },
      { code: '2', designation: 'Cellules blindées Interrupteur-sectionneur à fusibles combinés + ens Connecteurs separables', unite: 'u', quantite: 0.54, fourniture: 2_446_228, transport: 24_000, montage: 42_574 },
      { code: '3', designation: 'Cellules blindées Depart Disjoncteur motorisé + ens de connecteurs separables', unite: 'u', quantite: 0.04, fourniture: 7_443_521, transport: 73_973, montage: 42_574 },
      { code: '4', designation: 'Cellules blindées Tranformateur de Tension auxiliaire 30 000V/230V', unite: 'u', quantite: 0, fourniture: 2_323_969, transport: 23_240, montage: 42_574 },
      { code: '5', designation: 'Liaison HTA 3x 50mm² + connecteurs + transformateur 100KVA + Liaison BT + disjoncteur BT 160A', unite: 'ens', quantite: 0.50, fourniture: 2_300_000, transport: 40_000, montage: 60_000 },
      ACCESSOIRES('6'),
      GENIE_CIVIL('7'),
      AUTRES_TRAVAUX('8'),
      TELECONDUITE('9'),
      TESTS('10'),
    ],
  },
  // ── PREFA.COUP — Poste préfabriqué en coupure ──────────────────────────────
  {
    code: 'PREFA.COUP', libelle: 'Poste préfabriqué — Coupure',
    description: 'Poste préfabriqué HTA/BT GIS en coupure 30 kV avec couloir de manœuvre.',
    categorie: 'Poste HTA/BT', compteImmo: '66210', compteAffect: '534', classeProjet: '03', dureeAmort: 25,
    noeuds: [
      { code: '1', designation: 'Poste préfabriqué en coupure avec couloir de manœuvre comprenant :', unite: 'u', quantite: 1, fourniture: 15_999_184, transport: 159_853, montage: 617_323 },
      { code: '2', designation: 'Massif en beton armé/fouille + boucle en fond de fouille de terres + ceinture équipotentielle', unite: 'u', quantite: 1, montage: 868_350 },
      { code: '3', designation: 'Transport et pose de transformateur adaptés aux postes prefabriqués (fourniture par Senelec)', unite: 'u', quantite: 1, fourniture: 11_578, montage: 40_446 },
      TELECONDUITE('4'),
      TESTS('5'),
    ],
  },
  // ── PREFA.TE — Poste préfabriqué en Té ─────────────────────────────────────
  {
    code: 'PREFA.TE', libelle: 'Poste préfabriqué — Té',
    description: 'Poste préfabriqué HTA/BT GIS en Té 30 kV avec couloir de manœuvre.',
    categorie: 'Poste HTA/BT', compteImmo: '66210', compteAffect: '534', classeProjet: '03', dureeAmort: 25,
    noeuds: [
      { code: '1', designation: 'Poste préfabriqué en Té avec couloir de manœuvre comprenant :', unite: 'u', quantite: 1, fourniture: 18_260_969, transport: 182_008, montage: 617_323 },
      { code: '2', designation: 'Massif en beton armé/fouille + boucle en fond de fouille de terres + ceinture équipotentielle', unite: 'u', quantite: 1, montage: 868_350 },
      { code: '3', designation: 'Transport et pose de transformateur adaptés aux postes prefabriqués (fourniture par Senelec)', unite: 'u', quantite: 1, fourniture: 11_578, montage: 40_446 },
      TELECONDUITE('4'),
      TESTS('5'),
    ],
  },
  // ── DESAF.HAUT — Désaffectation postes hauts maçonnés ──────────────────────
  {
    code: 'DESAF.HAUT', libelle: 'Désaffectation — Postes hauts',
    description: 'Dépose complète des équipements des postes hauts maçonnés (75 unités type).',
    categorie: 'Poste HTA/BT', compteImmo: '66209', compteAffect: '534', classeProjet: '03', dureeAmort: 10,
    noeuds: [
      { code: 'D', designation: 'DESAFFECTATION EQUIPEMENT POSTE HTA/BT HAUT',
        enfants: deposes('Dépose complete des équipements des postes hauts maçonnés', 9_263, 91_960, 75) },
    ],
  },
  // ── DESAF.BAS — Désaffectation postes bas maçonnés ─────────────────────────
  {
    code: 'DESAF.BAS', libelle: 'Désaffectation — Postes bas',
    description: 'Dépose complète des équipements des postes bas maçonnés (10 unités type).',
    categorie: 'Poste HTA/BT', compteImmo: '66209', compteAffect: '534', classeProjet: '03', dureeAmort: 10,
    noeuds: [
      { code: 'D', designation: 'DESAFFECTATION EQUIPEMENT POSTE HTA/BT BAS',
        enfants: deposes('Dépose complete des équipements des postes bas maçonnés', 11_578, 93_663, 10) },
    ],
  },
];

// ─────────────────────────────────────────────────────────────────────────────
// HELPERS
// ─────────────────────────────────────────────────────────────────────────────

/** Coût total d'un nœud (article = (F+T+M)×qté ; groupe = somme des enfants). */
export function coutNode(n: RefNode): number {
  if (n.enfants?.length) return n.enfants.reduce((s, e) => s + coutNode(e), 0);
  const pu = (n.fourniture ?? 0) + (n.transport ?? 0) + (n.montage ?? 0);
  return pu * (n.quantite ?? 1);
}

/** Coût total d'une famille (1 instance). */
export function coutFamille(f: FamilleActif): number {
  return f.noeuds.reduce((s, n) => s + coutNode(n), 0);
}

/** Nombre d'articles (feuilles) d'une famille. */
export function nbArticles(f: FamilleActif): number {
  const count = (n: RefNode): number => (n.enfants?.length ? n.enfants.reduce((s, e) => s + count(e), 0) : 1);
  return f.noeuds.reduce((s, n) => s + count(n), 0);
}

export function getFamille(code: string): FamilleActif | undefined {
  return FAMILLES_ACTIFS.find(f => f.code === code);
}

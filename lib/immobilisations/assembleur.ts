/**
 * assembleur.ts — ASSEMBLAGE DE PROJET (feuille 4)
 * ------------------------------------------------
 * Instancie une FAMILLE du référentiel sur une localisation pour produire un
 * ACTIF structuré (WBS chiffré). Aucune ressaisie : on duplique le gabarit,
 * on préfixe les codes (REEQ.COUP → REEQ.COUP.2) et on calcule les montants.
 *
 *   getFamille('REEQ.COUP')  +  n°2  +  « Cherif Lo »
 *        →  REEQ.COUP.2 (5 813 198 + 3 991 388 + … = 13 537 630 FCFA)
 */

import { getFamille, coutNode, type RefNode, type FamilleActif } from './referentiel';

export interface Localisation {
  region?: string;
  departement?: string;
  feeder?: string;
  poste?: string;
}

/** Nœud instancié : miroir de RefNode avec code absolu + montant calculé. */
export interface ActifNode {
  code: string;            // code absolu (ex. 'REEQ.COUP.2.5.1')
  parent?: string;         // code du parent (ex. 'REEQ.COUP.2.5')
  designation: string;
  unite?: string;
  quantite?: number;
  fourniture?: number;
  transport?: number;
  montage?: number;
  valeur: number;          // (F+T+M)×qté, ou somme des enfants
  enfants?: ActifNode[];
  estGroupe: boolean;
}

export interface ActifStructure {
  id: string;
  code: string;            // 'REEQ.COUP.2'
  familleCode: string;     // 'REEQ.COUP'
  designation: string;     // 'REEQUIPEMENT … COUPURE CHERIF LO'
  localisation: Localisation;
  arbre: ActifNode[];      // WBS hiérarchique
  valeurTotale: number;    // FCFA
  /** Référence bordereau du marché si la valeur provient d'un import. */
  sourceBordereau?: string;
  dateAssemblage: string;
}

let _seq = 0;
const uid = () => `act-${Date.now().toString(36)}-${(_seq++).toString(36)}`;

/** Instancie récursivement un nœud du gabarit avec préfixe de code absolu. */
function instancieNode(n: RefNode, prefix: string, parent: string): ActifNode {
  // Code absolu : le placeholder 'D' (désaffectation) n'ajoute pas de segment.
  const code = n.code === 'D' ? prefix : `${prefix}.${n.code}`;
  if (n.enfants?.length) {
    const enfants = n.enfants.map(e => instancieNode(e, prefix, code));
    return {
      code, parent, designation: n.designation,
      valeur: enfants.reduce((s, e) => s + e.valeur, 0), enfants, estGroupe: true,
    };
  }
  return {
    code, parent, designation: n.designation, unite: n.unite, quantite: n.quantite,
    fourniture: n.fourniture, transport: n.transport, montage: n.montage,
    valeur: coutNode(n), estGroupe: false,
  };
}

/** Assemble un actif = 1 instance d'une famille. */
export function assembler(params: {
  familleCode: string;
  numero: number;             // n° d'instance (2 → REEQ.COUP.2)
  designation: string;        // libellé projet (ex. 'REEQUIPEMENT … CHERIF LO')
  localisation?: Localisation;
  /** Prix lu depuis le bordereau du marché (TOTAL EN FCFA). Écrase la valorisation du référentiel. */
  valeurBordereau?: number;
  /** Référence de la ligne bordereau sélectionnée (pour traçabilité). */
  sourceBordereau?: string;
}): ActifStructure | null {
  const famille = getFamille(params.familleCode);
  if (!famille) return null;
  const code = `${famille.code}.${params.numero}`;
  const arbre = famille.noeuds.map(n => instancieNode(n, code, code));
  const valeurRef = arbre.reduce((s, n) => s + n.valeur, 0);
  return {
    id: uid(), code, familleCode: famille.code, designation: params.designation,
    localisation: params.localisation ?? {}, arbre,
    valeurTotale: params.valeurBordereau ?? valeurRef,
    sourceBordereau: params.sourceBordereau,
    dateAssemblage: new Date().toISOString(),
  };
}

/** Aplatit l'arbre en lignes-feuilles (articles capitalisables). */
export function feuilles(actif: ActifStructure): ActifNode[] {
  const out: ActifNode[] = [];
  const walk = (n: ActifNode) => n.enfants?.length ? n.enfants.forEach(walk) : out.push(n);
  actif.arbre.forEach(walk);
  return out;
}

/** Coût d'une famille pour 1 instance (aperçu avant assemblage). */
export function apercuFamille(familleCode: string): { total: number; famille: FamilleActif } | null {
  const famille = getFamille(familleCode);
  if (!famille) return null;
  return { total: famille.noeuds.reduce((s, n) => s + coutNode(n), 0), famille };
}

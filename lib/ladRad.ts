/**
 * ladRad.ts — Pipeline LAD (Lecture Automatique de Documents) pour SIGEPP-DPE
 *
 * LAD = RAD + OCR + ICR, applicable à tout type de projet DPE
 * (Transport, Distribution, Production, Commercial, Génie Civil, etc.)
 *
 * RAD : Reconnaissance Automatique de Documents — classification par type
 * ICR : Reconnaissance Intelligente de Caractères — extraction champs structurés
 */

// ─── Types ───────────────────────────────────────────────────────────────────

export type DocType =
  | 'facture'
  | 'decompte'
  | 'bpu'
  | 'dao'
  | 'pv_reception'
  | 'contrat'
  | 'bordereau'
  | 'rapport_avancement'
  | 'bon_commande'
  | 'attestation'
  | 'plan_technique'
  | 'budget_tableau'
  | 'excel_donnees'
  | 'courrier'
  | 'inconnu';

export interface DocTypeInfo {
  type: DocType;
  label: string;
  labelFr: string;
  confidence: number; // 0–1
  icon: string;
  couleur: string;
}

export interface ChampExtrait {
  cle: string;
  label: string;
  valeur: string;
  confiance: number; // 0–1
}

export interface ResultatLAD {
  docType: DocTypeInfo;
  champs: ChampExtrait[];
  metadata: {
    filename: string;
    taille?: number;
    dateExtraction: string;
    nbMotsDetectes: number;
    methodeOCR: 'natif' | 'jszip' | 'xlsx' | 'direct';
  };
  resume: string;
}

// ─── Catalogue de types de documents ─────────────────────────────────────────

const DOC_CATALOGUE: Record<DocType, { label: string; labelFr: string; icon: string; couleur: string }> = {
  facture:            { label: 'Invoice / Facture',         labelFr: 'Facture',                icon: '🧾', couleur: '#0EA5E9' },
  decompte:           { label: 'Decompte / Payment Term',   labelFr: 'Décompte de facturation', icon: '🔢', couleur: '#6366F1' },
  bpu:                { label: 'Unit Price Schedule (BPU)',  labelFr: 'Bordereau des Prix Unitaires', icon: '📋', couleur: '#F59E0B' },
  dao:                { label: 'Tender Dossier (DAO)',       labelFr: "Dossier d'Appel d'Offres", icon: '📂', couleur: '#8B5CF6' },
  pv_reception:       { label: 'Reception Certificate (PV)', labelFr: 'PV de Réception / MES',  icon: '✅', couleur: '#10B981' },
  contrat:            { label: 'Contract / Marché',          labelFr: 'Contrat / Marché',        icon: '📜', couleur: '#1E40AF' },
  bordereau:          { label: 'Delivery Note / Bordereau',  labelFr: 'Bordereau de livraison',  icon: '📦', couleur: '#F97316' },
  rapport_avancement: { label: 'Progress Report',            labelFr: "Rapport d'Avancement",    icon: '📊', couleur: '#06B6D4' },
  bon_commande:       { label: 'Purchase Order (BC)',         labelFr: 'Bon de Commande',         icon: '🛒', couleur: '#EC4899' },
  attestation:        { label: 'Certificate / Attestation',  labelFr: 'Attestation / Certificat', icon: '🏆', couleur: '#84CC16' },
  plan_technique:     { label: 'Technical Plan / Drawing',   labelFr: 'Plan Technique / Dessin', icon: '📐', couleur: '#64748B' },
  budget_tableau:     { label: 'Budget Table',               labelFr: 'Tableau Budgétaire',      icon: '💰', couleur: '#059669' },
  excel_donnees:      { label: 'Data Spreadsheet',           labelFr: 'Tableau de Données',      icon: '📈', couleur: '#16A34A' },
  courrier:           { label: 'Letter / Correspondence',    labelFr: 'Courrier / Correspondance', icon: '✉️', couleur: '#78716C' },
  inconnu:            { label: 'Unknown Document',           labelFr: 'Document non identifié',  icon: '❓', couleur: '#9CA3AF' },
};

// ─── Règles RAD (patterns de détection) ──────────────────────────────────────

interface RegleRAD {
  type: DocType;
  poids: number;
  motsCles: string[];     // tous ces mots = +poids complet
  motsClesOu: string[];   // au moins 1 de ces mots = +poids/2
  regex?: RegExp[];
}

const REGLES_RAD: RegleRAD[] = [
  {
    type: 'facture',
    poids: 10,
    motsCles: ['facture'],
    motsClesOu: ['montant ttc', 'tva', 'n° fa', 'fa-', 'numéro de facture', 'invoice', 'fournisseur', 'réf. facture'],
    regex: [/FA[-\s]?\d{4}\/\d{2}/i, /\bFA\d{4,6}\b/i, /facture\s+n[o°]\s*\d+/i],
  },
  {
    type: 'decompte',
    poids: 10,
    motsCles: ['décompte'],
    motsClesOu: ['terme de facturation', 'avance démarrage', 'avance appro', 'retenue de garantie', 'déduction', 'net à payer'],
    regex: [/décompte\s+n[o°]\s*\d+/i, /terme\s+n[o°]\s*\d+/i],
  },
  {
    type: 'bpu',
    poids: 10,
    motsCles: ['bordereau des prix'],
    motsClesOu: ['prix unitaire', 'bpu', 'désignation', 'unité', 'quantité', 'sous-détail'],
    regex: [/\bBPU\b/i, /bordereau\s+des\s+prix/i],
  },
  {
    type: 'dao',
    poids: 10,
    motsCles: ["appel d'offres"],
    motsClesOu: ['dao', 'dossier de consultation', 'cahier des charges', 'soumissionnaire', 'offre technique', 'offre financière', 'marché public'],
    regex: [/\bDAO\b/i, /appel\s+d['''`]offres/i, /cahier\s+des\s+charges\s+techniques/i],
  },
  {
    type: 'pv_reception',
    poids: 10,
    motsCles: ['procès-verbal'],
    motsClesOu: ['réception', 'mise en service', 'mes', 'pv de réception', 'réceptionné', 'levée de réserves', 'réception définitive', 'réception provisoire'],
    regex: [/procès[- ]verbal/i, /\bPV\s+de\s+r[eé]ception/i, /\bMES\b/],
  },
  {
    type: 'contrat',
    poids: 10,
    motsCles: ['marché'],
    motsClesOu: ['contrat', 'titulaire', 'objet du marché', 'conditions générales', 'montant du marché', "prix du marché", 'n° de marché', 'numéro de marché'],
    regex: [/march[eé]\s+n[o°]\s*[\d\-\/]+/i, /contrat\s+n[o°]\s*[\d\-\/]+/i],
  },
  {
    type: 'bordereau',
    poids: 8,
    motsCles: ['bordereau'],
    motsClesOu: ['livraison', 'expédition', 'bon de livraison', 'références', 'quantité livrée'],
    regex: [/bordereau\s+de\s+livraison/i, /bon\s+de\s+livraison\s+n[o°]/i],
  },
  {
    type: 'rapport_avancement',
    poids: 9,
    motsCles: ["avancement"],
    motsClesOu: ["rapport d'avancement", 'état d\'avancement', 'compte rendu', 'taux d\'avancement', 'planning', 'jalons', 'actions menées', 'points ouverts'],
    regex: [/rapport\s+d['''`]avancement/i, /compte[- ]rendu\s+de\s+réunion/i, /[eé]tat\s+d['''`]avancement/i],
  },
  {
    type: 'bon_commande',
    poids: 9,
    motsCles: ['bon de commande'],
    motsClesOu: ['bc', 'commande n°', 'référence commande', 'délai de livraison', 'conditions de paiement'],
    regex: [/bon\s+de\s+commande\s+n[o°]\s*[\d\-\/]+/i, /\bBC[-\s]?\d{4,}/i],
  },
  {
    type: 'attestation',
    poids: 8,
    motsCles: ['attestation'],
    motsClesOu: ['certifie', 'certifions', 'certifié', 'conformité', 'nous soussignés', 'le présent document'],
    regex: [/attestation\s+de\s+(conformit[eé]|r[eé]alisation|capacit[eé])/i],
  },
  {
    type: 'plan_technique',
    poids: 7,
    motsCles: ['plan'],
    motsClesOu: ['dessin', 'schéma', 'coupe', 'façade', 'élévation', 'échelle', 'cote', 'nord'],
    regex: [/[eé]chelle\s*:\s*1\/\d+/i, /\bDWG\b|\bDXF\b|\bPDF\b.*plan/i],
  },
  {
    type: 'budget_tableau',
    poids: 8,
    motsCles: ['budget'],
    motsClesOu: ['prévision', 'réalisé', 'écart', 'dotation', 'engagement', 'décaissement', 'solde', 'vpb', 'dvp'],
    regex: [/budget\s+(annuel|prévisionnel|de\s+projet)/i, /\bVPB\b|\bDVP\b|\bBIT\b/],
  },
  {
    type: 'excel_donnees',
    poids: 6,
    motsCles: [],
    motsClesOu: ['feuille', 'cellule', 'colonne', 'ligne', 'tableau', 'données'],
    regex: [/###\s+Feuille\s+«/i],
  },
  {
    type: 'courrier',
    poids: 7,
    motsCles: [],
    motsClesOu: ['monsieur', 'madame', 'veuillez agréer', 'cordialement', 'objet:', 'référence:', 'dakar, le', 'à l\'attention de'],
    regex: [/[Vv]euillez\s+agr[eé]er|[Cc]ordialement|[Hh]autement/],
  },
];

// ─── RAD : Classification automatique du document ─────────────────────────────

export function detecterTypeDocument(texte: string, nomFichier: string): DocTypeInfo {
  const ext = nomFichier.split('.').pop()?.toLowerCase() ?? '';
  const textNorm = texte.toLowerCase();

  // Cas spéciaux par extension
  if (['xlsx', 'xls', 'xlsm', 'ods', 'csv'].includes(ext)) {
    // Affinage pour Excel : budget vs données génériques
    const scores = scoreRegles(textNorm, texte);
    const budget = scores['budget_tableau'] ?? 0;
    const bpu = scores['bpu'] ?? 0;
    if (budget > 4) return buildInfo('budget_tableau', Math.min(budget / 15, 0.95));
    if (bpu > 4) return buildInfo('bpu', Math.min(bpu / 15, 0.95));
    return buildInfo('excel_donnees', 0.75);
  }

  const scores = scoreRegles(textNorm, texte);
  const sorted = Object.entries(scores).sort((a, b) => b[1] - a[1]);

  if (sorted.length === 0 || sorted[0][1] === 0) {
    return buildInfo('inconnu', 0);
  }

  const [bestType, bestScore] = sorted[0];
  const secondScore = sorted[1]?.[1] ?? 0;

  // Confiance : ratio du meilleur sur le second + normalisation
  const gap = bestScore - secondScore;
  const confidence = Math.min(0.95, (bestScore / 15) * (1 + gap / 10));

  return buildInfo(bestType as DocType, confidence);
}

function scoreRegles(textNorm: string, texteOriginal: string): Record<string, number> {
  const scores: Record<string, number> = {};
  for (const regle of REGLES_RAD) {
    let score = 0;
    // Mots-clés obligatoires (tous présents = score plein)
    if (regle.motsCles.length > 0) {
      const tousPresents = regle.motsCles.every(m => textNorm.includes(m.toLowerCase()));
      if (tousPresents) score += regle.poids;
    }
    // Mots-clés optionnels
    const nbOu = regle.motsClesOu.filter(m => textNorm.includes(m.toLowerCase())).length;
    score += nbOu * (regle.poids / 2 / Math.max(regle.motsClesOu.length, 1));
    // Patterns regex (fort signal)
    if (regle.regex) {
      for (const rx of regle.regex) {
        if (rx.test(texteOriginal)) score += regle.poids * 0.8;
      }
    }
    if (score > 0) scores[regle.type] = score;
  }
  return scores;
}

function buildInfo(type: DocType, confidence: number): DocTypeInfo {
  const cat = DOC_CATALOGUE[type];
  return { type, confidence, ...cat };
}

// ─── ICR : Extraction intelligente des champs par type ───────────────────────

type ExtracteurFn = (texte: string) => ChampExtrait[];

const EXTRACTEURS: Partial<Record<DocType, ExtracteurFn>> = {
  facture: extraireChampsFacture,
  decompte: extraireChampsDecompte,
  bpu: extraireChampsBPU,
  pv_reception: extraireChampsPVReception,
  contrat: extraireChampsContrat,
  rapport_avancement: extraireChampsRapport,
  bon_commande: extraireChampsBonCommande,
  budget_tableau: extraireChampsBudget,
  dao: extraireChampsDAO,
};

export function extraireChamps(texte: string, docType: DocType): ChampExtrait[] {
  const fn = EXTRACTEURS[docType];
  if (!fn) return extraireChampsGeneriques(texte);
  return fn(texte);
}

// ── Extracteurs spécialisés ──────────────────────────────────────────────────

function champ(cle: string, label: string, valeur: string, confiance = 0.85): ChampExtrait {
  return { cle, label, valeur: valeur.trim(), confiance };
}

function extraireParRegex(texte: string, patterns: Array<[string, string, RegExp, number?]>): ChampExtrait[] {
  const champs: ChampExtrait[] = [];
  for (const [cle, label, rx, conf] of patterns) {
    const m = texte.match(rx);
    if (m?.[1]) champs.push(champ(cle, label, m[1].trim(), conf ?? 0.85));
  }
  return champs;
}

function extraireChampsFacture(t: string): ChampExtrait[] {
  return extraireParRegex(t, [
    ['numero_fa',    'N° Facture',         /(?:facture\s*n[o°]?|numéro\s*facture|N°\s*FA)[\s:]+([A-Z0-9\-\/]+)/i],
    ['date_facture', 'Date de facture',    /date(?:\s+de\s+facture)?[\s:]+(\d{1,2}[\/\-\.]\d{1,2}[\/\-\.]\d{2,4})/i],
    ['fournisseur',  'Fournisseur',        /(?:fournisseur|émetteur|société|entreprise)[\s:]+([A-ZÉÀÈÊ][^\n]{3,60})/i],
    ['ref_marche',   'Réf. Marché',        /(?:marché|ref[.]?\s*marché|n°\s*marché)[\s:]+([A-Z0-9\-\/]{3,30})/i],
    ['montant_ht',   'Montant HT',         /montant\s+(?:hors\s+taxes?|ht)[\s:]+([0-9\s\.,]+(?:FCFA|MFCFA|XOF|€)?)/i],
    ['tva',          'TVA',                /tva\s*(?:18%?)?[\s:]+([0-9\s\.,]+(?:FCFA|MFCFA|XOF|€)?)/i],
    ['montant_ttc',  'Montant TTC',        /(?:total\s+)?(?:montant\s+)?(?:ttc|toutes\s+taxes)[\s:]+([0-9\s\.,]+(?:FCFA|MFCFA|XOF|€)?)/i],
    ['projet',       'Projet',             /(?:projet|chantier|objet)[\s:]+([A-ZÉÀÈÊ][^\n]{5,80})/i],
    ['ref_commande', 'N° BC / Commande',   /(?:bon\s+de\s+commande|bc|commande)\s*n[o°]?[\s:]+([A-Z0-9\-\/]+)/i],
  ]);
}

function extraireChampsDecompte(t: string): ChampExtrait[] {
  return extraireParRegex(t, [
    ['numero_decompte', 'N° Décompte',       /décompte\s+n[o°]?[\s:]+(\d+[a-z]?(?:\s+bis|\s+rév\.?)?)/i],
    ['terme',           'Terme de factura.', /terme\s+n[o°]?[\s:]+(\d+)/i],
    ['montant_ht',      'Montant HT',        /montant\s+ht[\s:]+([0-9\s\.,]+)/i],
    ['avance_demarr',   'Déd. Avance Dém.',  /(?:avance\s+démarrage|déduction\s+avance)[\s:]+([0-9\s\.,]+)/i],
    ['avance_appro',    'Déd. Avance Appro.',/avance\s+(?:approvisionnement|appro)[\s:]+([0-9\s\.,]+)/i],
    ['retenue',         'Retenue garantie',  /retenue(?:\s+de\s+garantie)?[\s:]+([0-9\s\.,]+)/i],
    ['net_payer',       'Net à payer',        /net\s+à\s+payer[\s:]+([0-9\s\.,]+)/i],
    ['date',            'Date',              /date[\s:]+(\d{1,2}[\/\-\.]\d{1,2}[\/\-\.]\d{2,4})/i],
    ['ref_fa',          'Réf. FA',           /(?:N°\s*FA|Réf\.\s*FA|FA)[\s:]*([A-Z0-9\/\-]{6,})/i],
    ['statut',          'Statut',            /(payé|certifié|facturé|en\s+cours|rejeté)/i],
  ]);
}

function extraireChampsBPU(t: string): ChampExtrait[] {
  const champs = extraireParRegex(t, [
    ['ref_bpu',   'Réf. BPU',           /(?:ref|réf|n°|numéro)\s*bpu[\s:]+([A-Z0-9\-\/]+)/i],
    ['marche',    'Objet du marché',    /objet[\s:]+([A-ZÉÀÈÊ][^\n]{10,100})/i],
    ['date',      'Date',               /date[\s:]+(\d{1,2}[\/\-\.]\d{1,2}[\/\-\.]\d{2,4})/i],
    ['titulaire', 'Titulaire',          /titulaire[\s:]+([A-ZÉÀÈÊ][^\n]{5,60})/i],
  ]);
  // Compter les postes
  const postes = (t.match(/^\s*\d+[\.\-\)]/gm) ?? []).length;
  if (postes > 0) champs.push(champ('nb_postes', 'Nbre de postes', `${postes}`, 0.7));
  return champs;
}

function extraireChampsPVReception(t: string): ChampExtrait[] {
  return extraireParRegex(t, [
    ['numero_pv',    'N° PV',              /(?:pv|procès-verbal)\s+n[o°]?[\s:]+([A-Z0-9\-\/]+)/i],
    ['date_recep',   'Date de réception',  /(?:date|réceptionné\s+le)[\s:]+(\d{1,2}[\/\-\.]\d{1,2}[\/\-\.]\d{2,4})/i],
    ['projet',       'Projet / Lot',        /(?:projet|lot|chantier|objet)[\s:]+([A-ZÉÀÈÊ][^\n]{5,100})/i],
    ['titulaire',    'Titulaire / Entreprise', /(?:titulaire|entreprise|prestataire)[\s:]+([A-ZÉÀÈÊ][^\n]{5,60})/i],
    ['type_recep',   'Type de réception',  /(réception\s+(?:provisoire|définitive)|mise\s+en\s+service)/i],
    ['reserves',     'Réserves',           /réserves?\s*:?\s+([^\n]{10,200})/i],
    ['ref_marche',   'Réf. Marché',        /marché\s+n[o°]?[\s:]+([A-Z0-9\-\/]{3,30})/i],
  ]);
}

function extraireChampsContrat(t: string): ChampExtrait[] {
  return extraireParRegex(t, [
    ['num_marche',   'N° de marché',       /march[eé]\s+n[o°]?[\s:]+([A-Z0-9\-\/]{3,30})/i],
    ['objet',        'Objet du marché',    /objet(?:\s+du\s+march[eé])?[\s:]+([A-ZÉÀÈÊ][^\n]{10,150})/i],
    ['titulaire',    'Titulaire',          /titulaire[\s:]+([A-ZÉÀÈÊ][^\n]{5,80})/i],
    ['montant',      'Montant du marché',  /montant(?:\s+du\s+march[eé])?[\s:]+([0-9\s\.,]+(?:FCFA|MFCFA|XOF)?)/i],
    ['date_sign',    'Date de signature',  /(?:sign[eé]e?\s+le|date\s+de\s+signature)[\s:]+(\d{1,2}[\/\-\.]\d{1,2}[\/\-\.]\d{2,4})/i],
    ['duree',        'Durée d\'exécution', /dur[eé]e(?:\s+d['''`]ex[eé]cution)?[\s:]+(\d+\s*(?:mois|jours|semaines|ans))/i],
    ['bailleur',     'Bailleur / Financement', /(?:bailleur|financement|financé\s+par)[\s:]+([A-ZÉÀÈÊ][^\n]{3,80})/i],
    ['ref_contrat',  'Réf. Contrat',       /contrat\s+n[o°]?[\s:]+([A-Z0-9\-\/]{3,30})/i],
  ]);
}

function extraireChampsRapport(t: string): ChampExtrait[] {
  return extraireParRegex(t, [
    ['projet',        'Projet',              /(?:projet|chantier|objet)[\s:]+([A-ZÉÀÈÊ][^\n]{5,100})/i],
    ['periode',       'Période du rapport',  /(?:période|mois|du|pour\s+la\s+période)[\s:]+([^\n]{5,50})/i],
    ['taux_avancement','Taux d\'avancement', /(?:taux|avancement|progression)[\s:]*(\d{1,3}\s*%)/],
    ['date_rapport',  'Date du rapport',     /(?:date|fait\s+le|établi\s+le)[\s:]+(\d{1,2}[\/\-\.]\d{1,2}[\/\-\.]\d{2,4})/i],
    ['redacteur',     'Rédacteur',           /(?:établi\s+par|rédigé\s+par|rédacteur|auteur)[\s:]+([A-ZÉÀÈÊ][^\n]{3,60})/i],
    ['points_ouverts','Points ouverts',      /points?\s+ouverts?[\s:]+(\d+)/i],
    ['jalons',        'Jalons atteints',     /jalons?\s+atteints?[\s:]+([^\n]{5,100})/i],
  ]);
}

function extraireChampsBonCommande(t: string): ChampExtrait[] {
  return extraireParRegex(t, [
    ['num_bc',        'N° Bon de Commande', /(?:bon\s+de\s+commande|bc)\s*n[o°]?[\s:]+([A-Z0-9\-\/]+)/i],
    ['fournisseur',   'Fournisseur',        /(?:fournisseur|destinataire)[\s:]+([A-ZÉÀÈÊ][^\n]{5,80})/i],
    ['date_commande', 'Date de commande',   /date[\s:]+(\d{1,2}[\/\-\.]\d{1,2}[\/\-\.]\d{2,4})/i],
    ['montant_total', 'Montant total',      /(?:montant\s+total|total\s+ht|total\s+ttc)[\s:]+([0-9\s\.,]+(?:FCFA|XOF)?)/i],
    ['delai',         'Délai de livraison', /(?:délai|livraison\s+prévue)[\s:]+([^\n]{5,60})/i],
    ['ref_projet',    'Réf. Projet',        /(?:projet|chantier|destination)[\s:]+([A-ZÉÀÈÊ][^\n]{5,80})/i],
  ]);
}

function extraireChampsBudget(t: string): ChampExtrait[] {
  const champs = extraireParRegex(t, [
    ['projet',       'Projet',            /(?:projet|chantier|opération)[\s:]+([A-ZÉÀÈÊ][^\n]{5,100})/i],
    ['annee',        'Exercice budgétaire',/(?:année|exercice|budget\s+\d{4})[\s:]+(\d{4})/],
    ['dotation',     'Dotation totale',   /(?:dotation|budget\s+total|enveloppe)[\s:]+([0-9\s\.,]+(?:MFCFA|FCFA)?)/i],
    ['realise',      'Réalisé / Engagé',  /(?:réalisé|engagé|décaissé)[\s:]+([0-9\s\.,]+(?:MFCFA|FCFA)?)/i],
    ['ecart',        'Écart',             /(?:écart|solde|reste)[\s:]+([0-9\s\.,]+(?:MFCFA|FCFA)?)/i],
  ]);
  // Indicateurs financiers DPE
  for (const ind of ['VPB', 'DVP', 'BIT', 'MTFn', 'TAFB', 'TAFA']) {
    const m = t.match(new RegExp(`\\b${ind}\\b[\\s:]+([0-9\\s\\.,]+)`, 'i'));
    if (m?.[1]) champs.push(champ(ind.toLowerCase(), ind, m[1].trim(), 0.8));
  }
  return champs;
}

function extraireChampsDAO(t: string): ChampExtrait[] {
  return extraireParRegex(t, [
    ['ref_dao',        'Réf. DAO',           /(?:dao|dossier|appel\s+d['''`]offres)\s*n[o°]?[\s:]+([A-Z0-9\-\/]+)/i],
    ['objet',          'Objet du marché',    /objet[\s:]+([A-ZÉÀÈÊ][^\n]{10,150})/i],
    ['date_limite',    'Date limite de dépôt',/(?:date\s+limite|dépôt\s+des\s+offres)[\s:]+([^\n]{5,50})/i],
    ['autorite',       'Autorité contractante',/(?:autorité\s+contractante|maître\s+d['''`]ouvrage|acheteur)[\s:]+([A-ZÉÀÈÊ][^\n]{5,80})/i],
    ['montant_estime', 'Montant estimatif',  /(?:montant\s+estimatif|budget\s+estimé)[\s:]+([0-9\s\.,]+(?:MFCFA|FCFA)?)/i],
    ['type_marche',    'Type de marché',     /(?:fournitures?|travaux|services?|prestations?)[\s:]+([^\n]{10,100})/i],
  ]);
}

function extraireChampsGeneriques(t: string): ChampExtrait[] {
  return extraireParRegex(t, [
    ['reference',  'Référence',   /(?:référence|réf|n°|numéro)[\s:]+([A-Z0-9\-\/]{3,30})/i],
    ['date',       'Date',        /date[\s:]+(\d{1,2}[\/\-\.]\d{1,2}[\/\-\.]\d{2,4})/i],
    ['objet',      'Objet',       /objet[\s:]+([A-ZÉÀÈÊ][^\n]{5,150})/i],
    ['emetteur',   'Émetteur',    /(?:de|émetteur|expéditeur|auteur)[\s:]+([A-ZÉÀÈÊ][^\n]{5,80})/i],
    ['destinataire','Destinataire',/(?:à|destinataire)[\s:]+([A-ZÉÀÈÊ][^\n]{5,80})/i],
    ['montant',    'Montant',     /montant[\s:]+([0-9\s\.,]+(?:FCFA|MFCFA|XOF|€)?)/i],
  ]);
}

// ─── Entrée principale LAD ────────────────────────────────────────────────────

export function analyserDocument(
  texte: string,
  nomFichier: string,
  methodeOCR: ResultatLAD['metadata']['methodeOCR'] = 'natif',
  taille?: number,
): ResultatLAD {
  const docType = detecterTypeDocument(texte, nomFichier);
  const champs = extraireChamps(texte, docType.type);
  const nbMots = texte.split(/\s+/).filter(Boolean).length;

  // Résumé automatique
  const champsSaillants = champs.slice(0, 4).map(c => `${c.label}: ${c.valeur}`).join(' · ');
  const resume = [
    `[${docType.icon} ${docType.labelFr}]`,
    champsSaillants || `${nbMots} mots extraits`,
    docType.confidence < 0.5 ? '— type incertain' : '',
  ].filter(Boolean).join(' ');

  return {
    docType,
    champs,
    metadata: {
      filename: nomFichier,
      taille,
      dateExtraction: new Date().toISOString(),
      nbMotsDetectes: nbMots,
      methodeOCR,
    },
    resume,
  };
}

// ─── Utilitaires d'affichage ──────────────────────────────────────────────────

/** Génère un texte structuré pour injecter le résultat LAD dans le contexte IA. */
export function formaterPourIA(resultat: ResultatLAD): string {
  const { docType, champs, metadata } = resultat;
  const lines: string[] = [
    `### Document analysé : ${metadata.filename}`,
    `**Type détecté (RAD)** : ${docType.icon} ${docType.labelFr} (confiance : ${Math.round(docType.confidence * 100)}%)`,
    `**Méthode d'extraction** : ${metadata.methodeOCR.toUpperCase()} · ${metadata.nbMotsDetectes} mots`,
  ];
  if (champs.length > 0) {
    lines.push('**Champs extraits (ICR)** :');
    for (const c of champs) {
      lines.push(`- ${c.label} : ${c.valeur}`);
    }
  }
  return lines.join('\n');
}

/** Retourne les types de documents disponibles pour un sélecteur UI. */
export function listeTypesDocuments(): Array<{ type: DocType; label: string; icon: string; couleur: string }> {
  return (Object.entries(DOC_CATALOGUE) as Array<[DocType, typeof DOC_CATALOGUE[DocType]]>).map(
    ([type, info]) => ({ type, label: info.labelFr, icon: info.icon, couleur: info.couleur }),
  );
}

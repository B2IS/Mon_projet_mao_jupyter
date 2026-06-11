/**
 * engine.ts — Moteur de migration intelligente IA
 * Analyse les documents uploadés et extrait automatiquement :
 *   • type de projet, budget, délais
 *   • WBS, livrables, risques
 *   • fournisseurs, localisation
 *
 * Prêt pour intégration avec API OCR/NLP (OpenAI, Azure Document Intelligence, etc.)
 */

import type { MigrationDocument, ExtractedData, MigrationProject } from './types';

export async function analyzeDocuments(docs: MigrationDocument[]): Promise<ExtractedData> {
  const data: ExtractedData = {};
  const fullText = docs.map(d => d.extractedText ?? '').join('\n');

  // ── Extraction code BIT (clé unique SENELEC) depuis noms + contenu ──
  data.codeBIT = extractBITCode(docs.map(d => d.name).join('\n') + '\n' + fullText);

  for (const doc of docs) {
    const name = doc.name.toLowerCase();
    const text = (doc.extractedText ?? '');
    const textLow = text.toLowerCase();

    // Nom du projet — extraction ciblée + rejet des faux positifs (titres de section)
    if (!data.projectName) {
      const SECTION_BLACKLIST = /^(principales?|dates?|durées?|objectifs?|résumé|context|introduction|annexe|chapitre|section|partie|page|tableau|figure)/i;
      const candidates = [
        extractWithRegex(text, /(?:intitulé du projet|project title|nom du projet)\s*[:\-]?\s*([^\n]{8,120})/i),
        extractWithRegex(text, /(?:projet|project)\s*[:]\s*([A-Z][^\n]{8,120})/),
        extractWithRegex(text, /(?:objet|titre)\s*[:\-]\s*([A-Z][^\n]{8,120})/),
      ].filter(Boolean).filter(c => !SECTION_BLACKLIST.test(c!.trim())) as string[];
      data.projectName = candidates[0] ?? inferProjectName(doc.name);
    }

    // Budget sur tous les docs
    const amount = extractAmount(textLow);
    if (amount && (!data.budget || amount > data.budget)) data.budget = amount;

    // Dates
    if (!data.startDate) data.startDate = extractDate(text, /d[eé]but\s*[:\-]?\s*(\d{2}[\/\-]\d{2}[\/\-]\d{4})/i);
    if (!data.endDate)   data.endDate   = extractDate(text, /(?:fin|livraison|achèvement)\s*[:\-]?\s*(\d{2}[\/\-]\d{2}[\/\-]\d{4})/i);

    // Bailleur / contractor
    if (!data.contractor) {
      data.contractor =
        extractWithRegex(text, /(?:bailleur|financé par|funded by)\s*[:\-]?\s*([^\n]{3,60})/i)
        ?? extractWithRegex(text, /(?:entreprise|titulaire|contractor|adjudicataire)\s*[:\-]?\s*([^\n]{3,60})/i);
    }

    // Localisation
    if (!data.location) {
      data.location =
        extractWithRegex(text, /(?:région|localisation|site|zone)\s*[:\-]?\s*([^\n]{3,60})/i)
        ?? extractWithRegex(text, /\b(Dakar|Thiès|Ziguinchor|Saint[\-\s]Louis|Kaolack|Tambacounda|Louga|Diourbel|Fatick|Kolda|Kaffrine|Matam|Sédhiou|Kédougou)\b/i);
    }

    // Milestones depuis PV/rapports
    if (name.includes('pv') || name.includes('reception') || name.includes('rapport')) {
      const ms = extractMilestones(text);
      if (ms.length) data.milestones = [...(data.milestones || []), ...ms];
    }
  }

  // ── Lots ──
  const lots = detectLots(fullText);
  if (lots.length > 0) data.lots = lots;

  // ── Valeurs par défaut ──
  if (!data.projectName) data.projectName = data.codeBIT ? `Projet ${data.codeBIT}` : 'Projet migré — ' + new Date().toLocaleDateString('fr-FR');
  if (!data.projectCode) data.projectCode = data.codeBIT ?? undefined;
  if (!data.budget)      data.budget = 0;
  if (!data.currency)    data.currency = 'FCFA';
  if (!data.startDate)   data.startDate = new Date().toISOString().split('T')[0];
  if (!data.endDate)     data.endDate = addMonths(data.startDate, 12);
  if (!data.wbsItems || data.wbsItems.length === 0) data.wbsItems = generateDefaultWBS(data.projectType);
  if (!data.risks || data.risks.length === 0)       data.risks = generateDefaultRisks();

  return data;
}
export function generateProjectStructure(data: ExtractedData): Partial<MigrationProject> {
  // Génère une structure de projet SIGEPP à partir des données extraites
  const wbs = data.wbsItems ?? generateDefaultWBS(data.projectType);
  const risks = data.risks ?? generateDefaultRisks();

  return {
    name: data.projectName ?? 'Nouveau projet',
    extractedData: { ...data, wbsItems: wbs, risks },
    status: 'analyzed',
    confidence: computeConfidence(data),
    updatedAt: new Date().toISOString(),
  };
}

export function computeConfidence(data: ExtractedData): number {
  let score = 0;
  // Critères majeurs (pondérés par importance métier)
  if (data.codeBIT)                            score += 25; // BIT = clé unique → poids fort
  if (data.projectName && data.projectName.length > 5) score += 15;
  if (data.budget && data.budget > 0)          score += 18;
  if (data.startDate && data.endDate)          score += 12;
  if (data.contractor || data.supplier)        score += 8;
  if (data.location)                           score += 7;
  if (data.wbsItems && data.wbsItems.length > 0) score += 6;
  if (data.milestones && data.milestones.length > 0) score += 4;
  if (data.lots && data.lots.length > 0)       score += 3;
  if (data.risks && data.risks.length > 0)     score += 2;
  // Base line : heuristique a au moins analysé les docs → 0 bonus si 0 champs
  const baseBonus = score > 0 ? 5 : 0;
  return Math.min(100, score + baseBonus);
}

/**
 * Détecte les lots dans un texte de marché/DAO/BOQ. Reconnaît « Lot 1 », « LOT N°2 »,
 * « Lot A : … », etc. Pour chaque lot, capture l'intitulé et, si présent à proximité,
 * un montant. Dédoublonne par numéro de lot.
 */
export function detectLots(text: string): { numero: string; label: string; budget?: number; localisation?: string }[] {
  if (!text) return [];
  const out: { numero: string; label: string; budget?: number; localisation?: string }[] = [];
  const seen = new Set<string>();
  // « Lot 1 : intitulé », « LOT N° 2 - intitulé », « Lot A — intitulé »
  const re = /\blot\s*(?:n[°o]\s*)?([0-9]{1,2}|[A-H])\s*[:\-–.]?\s*([^\n;]{0,90})/gi;
  let m: RegExpExecArray | null;
  while ((m = re.exec(text)) !== null) {
    const numero = m[1].toUpperCase().trim();
    if (seen.has(numero)) continue;
    seen.add(numero);
    let label = (m[2] || '').trim().replace(/\s{2,}/g, ' ');
    // coupe l'intitulé au premier séparateur fort
    label = label.split(/\s+(?:lot|montant|budget|prix)\b/i)[0].trim();
    // Montant SEULEMENT s'il y a un contexte monétaire (évite de prendre un nb de localités).
    const seg = m[2] || '';
    const amt = /\b(fcfa|f\s?cfa|xof|mfcfa|frs?|m\b|millions?|milliards?)\b/i.test(seg) ? extractAmount(seg) : 0;
    out.push({ numero, label: label || `Lot ${numero}`, budget: amt && amt > 0 ? amt : undefined });
    if (out.length >= 20) break;
  }
  return out;
}

// ─── Extraction code BIT (clé unique SENELEC) ───────────────────────────────

/**
 * Cherche un code BIT dans un texte selon les patterns SENELEC connus.
 * Retourne le premier match ou undefined.
 */
export function extractBITCode(text: string): string | undefined {
  const patterns = [
    // BESTSN-CRM-EXPI-GENE-LOT1-0025 ou BESTSN-RPP-EXPI-GENE-TOUS-0008
    /\b(BESTSN[\-_][A-Z0-9]+(?:[\-_][A-Z0-9]+){2,6})\b/i,
    // BEST-SN-xxx ou BEST-SENEGAL-xxx
    /\b(BEST[\-_](?:SN|SENEGAL)[\-_][A-Z0-9\-]+)\b/i,
    // EIUL-Lot3, EIUL-LOT-3
    /\b(EIUL[\-_](?:LOT[\-_]?)?[0-9A-Z]+)\b/i,
    // EXP-IRAF-xxx
    /\b(EXP[\-_]IRAF[\-_][A-Z0-9\-]+)\b/i,
    // TBEA-Lot1, TBEA-LOT-1-2
    /\b(TBEA[\-_](?:LOT[\-_]?)?[0-9A-Z\-]+)\b/i,
    // DPE-XXXX ou DPE/XXXX
    /\b(DPE[\-_\/][A-Z0-9]{3,12})\b/i,
    // Code générique type SENELEC: 2-3 lettres + tiret + chiffres
    /\b([A-Z]{2,6}[\-][0-9]{4,8})\b/,
  ];
  for (const re of patterns) {
    const m = text.match(re);
    if (m?.[1]) return m[1].toUpperCase();
  }
  return undefined;
}

// ─── Helpers privés ─────────────────────────────────────────────────────────

function extractWithRegex(text: string, regex: RegExp): string | undefined {
  const m = text.match(regex);
  return m?.[1]?.trim();
}

function extractAmount(text: string): number | undefined {
  const patterns = [
    /montant\s*total\s*[:\-]?\s*([\d\s.,]+)\s*(?:FCFA|XOF|CFA)/i,
    /budget\s*[:\-]?\s*([\d\s.,]+)\s*(?:FCFA|XOF|CFA)/i,
    /total\s*[:\-]?\s*([\d\s.,]+)/i,
  ];
  for (const p of patterns) {
    const m = text.match(p);
    if (m) {
      const raw = m[1].replace(/\s/g, '').replace(',', '.');
      const n = parseFloat(raw);
      if (!isNaN(n)) return n > 1e9 ? n / 1e6 : n; // normaliser en millions si besoin
    }
  }
  return undefined;
}

function extractDate(text: string, regex: RegExp): string | undefined {
  const m = text.match(regex);
  if (!m) return undefined;
  const raw = m[1];
  // dd/mm/yyyy → yyyy-mm-dd
  const parts = raw.split(/[\/\-]/);
  if (parts.length === 3) {
    if (parts[2].length === 4) return `${parts[2]}-${parts[1]}-${parts[0]}`;
    if (parts[0].length === 4) return `${parts[0]}-${parts[1]}-${parts[2]}`;
  }
  return raw;
}

function extractMilestones(text: string): { name: string; date: string }[] {
  const milestones: { name: string; date: string }[] = [];
  const regex = /(?:jalon|milestone|étape|phase)\s*[:\-]?\s*([^\n]{3,60})\s*(\d{2}[\/\-]\d{2}[\/\-]\d{4})/gi;
  let m;
  while ((m = regex.exec(text)) !== null) {
    milestones.push({ name: m[1].trim(), date: extractDate(m[0], /(\d{2}[\/\-]\d{2}[\/\-]\d{4})/) ?? '' });
  }
  return milestones;
}

function inferProjectName(filename: string): string {
  return filename
    .replace(/\.[^.]+$/, '')
    .replace(/[_\-]/g, ' ')
    .replace(/\b(contrat|contract|dao|pv|rapport|plan|budget|devis|boq)\b/gi, '')
    .trim()
    .replace(/\s+/g, ' ');
}

function generateDefaultWBS(projectType?: string): { code: string; label: string; budget: number }[] {
  const base = [
    { code: '1.0', label: 'Études & Conception', budget: 15 },
    { code: '2.0', label: 'Acquisition terrain & Servitudes', budget: 10 },
    { code: '3.0', label: 'Travaux Génie Civil', budget: 30 },
    { code: '4.0', label: 'Fourniture & Installation', budget: 25 },
    { code: '5.0', label: 'Mise en service & Essais', budget: 10 },
    { code: '6.0', label: 'Formation & Documentation', budget: 5 },
    { code: '7.0', label: 'Gestion de projet & Contingences', budget: 5 },
  ];
  if (projectType?.toLowerCase().includes('solaire')) {
    return [
      { code: '1.0', label: 'Études & APS/APD', budget: 10 },
      { code: '2.0', label: 'Fourniture Modules & Onduleurs', budget: 35 },
      { code: '3.0', label: 'Génie Civil & Fondations', budget: 15 },
      { code: '4.0', label: 'Installation & Câblage', budget: 20 },
      { code: '5.0', label: 'Mise en service & ESS', budget: 12 },
      { code: '6.0', label: 'Formation O&M', budget: 5 },
      { code: '7.0', label: 'Gestion de projet', budget: 3 },
    ];
  }
  return base;
}

function generateDefaultRisks(): { description: string; severity: string }[] {
  return [
    { description: 'Retard approbation bailleur', severity: 'haute' },
    { description: 'Hausse prix matériaux (cuivre, acier)', severity: 'moyenne' },
    { description: 'Conditions climatiques saisonnières', severity: 'moyenne' },
    { description: 'Difficultés d\'accès terrain', severity: 'basse' },
  ];
}

function addMonths(dateStr: string, months: number): string {
  const d = new Date(dateStr);
  d.setMonth(d.getMonth() + months);
  return d.toISOString().split('T')[0];
}

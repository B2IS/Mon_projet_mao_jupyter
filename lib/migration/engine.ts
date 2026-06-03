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
  // TODO: remplacer par appel API IA réel (OCR + NLP)
  // Pour l'instant : extraction heuristique basique depuis le nom + texte
  const data: ExtractedData = {};

  for (const doc of docs) {
    const name = doc.name.toLowerCase();
    const text = (doc.extractedText ?? '').toLowerCase();

    // Heuristique simple sur le nom du fichier
    if (name.includes('contrat') || name.includes('contract')) {
      data.projectName = extractWithRegex(text, /projet\s*[:\-]?\s*([^\n]{3,80})/i)
        ?? extractWithRegex(text, /project\s*[:\-]?\s*([^\n]{3,80})/i)
        ?? inferProjectName(name);
    }
    if (name.includes('budget') || name.includes('devis') || name.includes('boq')) {
      const amount = extractAmount(text);
      if (amount) data.budget = amount;
    }
    if (name.includes('planning') || name.includes('gantt') || name.includes('schedule')) {
      data.startDate = extractDate(text, /d[eé]but\s*[:\-]?\s*(\d{2}[\/\-]\d{2}[\/\-]\d{4})/i);
      data.endDate = extractDate(text, /fin\s*[:\-]?\s*(\d{2}[\/\-]\d{2}[\/\-]\d{4})/i);
    }
    if (name.includes('pv') || name.includes('reception')) {
      // Extraction jalons
      const milestones = extractMilestones(text);
      if (milestones.length) data.milestones = milestones;
    }
  }

  // ── Détection des LOTS sur l'ensemble du texte des documents ──
  const fullText = docs.map(d => d.extractedText ?? '').join('\n');
  const lots = detectLots(fullText);
  if (lots.length > 1) data.lots = lots;

  // Valeurs par défaut si non trouvées
  if (!data.projectName) data.projectName = 'Projet migré — ' + new Date().toLocaleDateString('fr-FR');
  if (!data.budget) data.budget = 0;
  if (!data.currency) data.currency = 'FCFA';
  if (!data.startDate) data.startDate = new Date().toISOString().split('T')[0];
  if (!data.endDate) data.endDate = addMonths(data.startDate, 12);

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
  if (data.projectName) score += 20;
  if (data.projectCode) score += 10;
  if (data.budget && data.budget > 0) score += 20;
  if (data.startDate && data.endDate) score += 15;
  if (data.contractor || data.supplier) score += 10;
  if (data.location) score += 10;
  if (data.wbsItems && data.wbsItems.length > 0) score += 10;
  if (data.milestones && data.milestones.length > 0) score += 5;
  return Math.min(100, score);
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

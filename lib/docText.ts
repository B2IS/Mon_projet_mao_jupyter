/**
 * docText.ts — Pipeline LAD (Lecture Automatique de Documents) côté client.
 * Mutualisé entre le chat IA, le wizard de migration et la GED.
 *
 * Étapes du pipeline :
 *  1. OCR/Extraction — lire le texte brut selon le format :
 *     .txt/.csv/.json/.md/.xml  → lecture directe
 *     .xlsx/.xls/.ods           → chaque feuille en CSV (SheetJS)
 *     .pdf                      → texte natif via pdf.js (texte sélectionnable)
 *     .docx                     → parsing OOXML (archive ZIP)
 *  2. RAD — classer automatiquement le type de document
 *  3. ICR — extraire les champs structurés selon le type détecté
 */
import * as XLSX from 'xlsx';
import { analyserDocument, formaterPourIA, type ResultatLAD } from './ladRad';

export type { ResultatLAD };

/** Extrait le texte d'un PDF natif (texte sélectionnable) via pdf.js, page par page. */
export async function extractPdfText(file: File): Promise<string | undefined> {
  try {
    const pdfjs = await import('pdfjs-dist/build/pdf');
    // Worker servi depuis /public (copié de pdfjs-dist) : aucune résolution de module
    // côté webpack → build Vercel fiable, et fonctionne on-premise (pas de CDN requis).
    try { pdfjs.GlobalWorkerOptions.workerSrc = '/pdf.worker.min.js'; } catch { /* déjà configuré */ }
    const buf = await file.arrayBuffer();
    const doc = await pdfjs.getDocument({ data: buf, isEvalSupported: false }).promise;
    const parts: string[] = [];
    const maxPages = Math.min(doc.numPages, 60);
    for (let p = 1; p <= maxPages; p++) {
      const page = await doc.getPage(p);
      const content = await page.getTextContent();
      const line = content.items
        .map((it) => ('str' in it ? (it as { str: string }).str : ''))
        .join(' ')
        .replace(/\s+/g, ' ')
        .trim();
      if (line) parts.push(`### Page ${p}\n${line}`);
    }
    const out = parts.join('\n\n').trim();
    if (out) return out;
    return '⚠️ Ce PDF ne contient pas de texte sélectionnable (probablement un scan/image). Une reconnaissance optique (OCR) est nécessaire.';
  } catch {
    return undefined;
  }
}

/** Extrait le texte d'un .docx (Office Open XML = archive ZIP). */
export async function extractDocxText(file: File): Promise<string | undefined> {
  try {
    const JSZip = (await import('jszip')).default;
    const zip = await JSZip.loadAsync(await file.arrayBuffer());
    const docXml = zip.file('word/document.xml');
    if (!docXml) return undefined;
    const xml = await docXml.async('string');
    const text = xml
      .replace(/<\/w:p>/g, '\n')
      .replace(/<w:tab\/?>(?:<\/w:tab>)?/g, '\t')
      .replace(/<[^>]+>/g, '')
      .replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>')
      .replace(/&quot;/g, '"').replace(/&apos;/g, "'")
      .replace(/\n{3,}/g, '\n\n')
      .trim();
    return text || undefined;
  } catch {
    return undefined;
  }
}

/** Extrait le contenu textuel d'un fichier uploadé (OCR brut). */
export async function extractFileText(file: File): Promise<string | undefined> {
  const name = file.name.toLowerCase();
  const isExcel = /\.(xlsx|xls|xlsm|ods)$/.test(name) ||
    file.type.includes('spreadsheet') || file.type.includes('excel');
  const isPlain = /\.(txt|csv|tsv|json|md|log|xml)$/.test(name) ||
    file.type.startsWith('text/') || file.type === 'application/json';
  const isPdf = /\.pdf$/.test(name) || file.type === 'application/pdf';
  const isDocx = /\.docx$/.test(name) ||
    file.type === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';

  try {
    if (isExcel) {
      const buf = await file.arrayBuffer();
      const wb = XLSX.read(buf, { type: 'array' });
      const parts: string[] = [];
      wb.SheetNames.forEach((sheetName) => {
        const ws = wb.Sheets[sheetName];
        if (!ws) return;
        const csv = XLSX.utils.sheet_to_csv(ws, { blankrows: false });
        if (csv.trim()) parts.push(`### Feuille « ${sheetName} »\n${csv.trim()}`);
      });
      return parts.join('\n\n') || undefined;
    }
    if (isPlain) {
      const txt = await file.text();
      return txt.trim() || undefined;
    }
    if (isPdf) return await extractPdfText(file);
    if (isDocx) return await extractDocxText(file);
  } catch {
    return undefined;
  }
  return undefined;
}

/**
 * Pipeline LAD complet : OCR → RAD (classification) → ICR (extraction champs).
 * Applicable à tout type de document DPE (facture, décompte, BPU, DAO, PV, contrat…).
 * Retourne le texte brut + le résultat structuré LAD + le texte enrichi pour l'IA.
 */
export async function analyzeDocument(file: File): Promise<{
  texte: string | undefined;
  lad: ResultatLAD | undefined;
  texteIA: string | undefined;
}> {
  const name = file.name.toLowerCase();
  let methode: ResultatLAD['metadata']['methodeOCR'] = 'natif';

  if (/\.(xlsx|xls|xlsm|ods|csv)$/.test(name)) methode = 'xlsx';
  else if (/\.docx$/.test(name)) methode = 'jszip';
  else if (/\.(txt|csv|tsv|json|md|log|xml)$/.test(name)) methode = 'direct';

  const texte = await extractFileText(file);
  if (!texte) return { texte: undefined, lad: undefined, texteIA: undefined };

  const lad = analyserDocument(texte, file.name, methode, file.size);
  const entete = formaterPourIA(lad);
  const texteIA = `${entete}\n\n---\n\n${texte}`;

  return { texte, lad, texteIA };
}

/**
 * docText.ts — Extraction client-side du contenu textuel des documents.
 * Mutualisé entre le chat IA et le wizard de migration.
 *  - .txt / .csv / .json / .md / .xml   → lecture directe
 *  - .xlsx / .xls / .ods                → chaque feuille convertie en CSV
 *  - .pdf                               → texte natif via pdf.js (page par page)
 *  - .docx                              → parsing OOXML (archive ZIP)
 *  - autres (.doc binaire / image)      → undefined (OCR requis côté backend)
 */
import * as XLSX from 'xlsx';

/** Extrait le texte d'un PDF natif (texte sélectionnable) via pdf.js, page par page. */
export async function extractPdfText(file: File): Promise<string | undefined> {
  try {
    const pdfjs = await import('pdfjs-dist/build/pdf');
    try {
      pdfjs.GlobalWorkerOptions.workerSrc = new URL(
        'pdfjs-dist/build/pdf.worker.min.js',
        import.meta.url,
      ).toString();
    } catch { /* worker déjà configuré */ }
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

/** Extrait le contenu textuel d'un fichier uploadé pour le fournir à l'IA / au moteur. */
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

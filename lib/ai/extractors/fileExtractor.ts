/**
 * fileExtractor.ts — Browser-side document content extraction
 *
 * Extrait le contenu textuel de tous les formats supportés :
 *   - XLSX/XLS/CSV  → texte tabulaire (sheetjs)
 *   - DOCX/DOC      → texte brut (mammoth)
 *   - PDF           → texte (pdfjs) ou base64 si PDF scanné
 *   - Images        → base64 compressé pour analyse vision LLM
 *   - TXT/XML/JSON  → texte brut
 *
 * Utilisé côté navigateur uniquement (migration/page.tsx).
 */

import type { SwarmInputFile } from '@/lib/ai/types';

const MAX_TEXT_CHARS  = 60_000;   // limite texte envoyé à l'API
const MAX_IMAGE_BYTES = 4_000_000; // 4 MB max pour base64 image

// ── Helpers ────────────────────────────────────────────────────────────────────

async function readAsArrayBuffer(file: File): Promise<ArrayBuffer> {
  return new Promise((res, rej) => {
    const r = new FileReader();
    r.onload  = () => res(r.result as ArrayBuffer);
    r.onerror = () => rej(r.error);
    r.readAsArrayBuffer(file);
  });
}

async function readAsText(file: File): Promise<string> {
  return new Promise((res, rej) => {
    const r = new FileReader();
    r.onload  = () => res(r.result as string);
    r.onerror = () => rej(r.error);
    r.readAsText(file, 'utf-8');
  });
}

async function readAsDataURL(file: File): Promise<string> {
  return new Promise((res, rej) => {
    const r = new FileReader();
    r.onload  = () => res(r.result as string);
    r.onerror = () => rej(r.error);
    r.readAsDataURL(file);
  });
}

/** Compresse une image via canvas pour réduire la taille base64 */
async function compressImage(file: File, maxDim = 1400, quality = 0.82): Promise<string> {
  const url = URL.createObjectURL(file);
  try {
    const img = await new Promise<HTMLImageElement>((res, rej) => {
      const i = new Image();
      i.onload  = () => res(i);
      i.onerror = () => rej(new Error('Image load error'));
      i.src = url;
    });

    let { width, height } = img;
    if (width > maxDim || height > maxDim) {
      const ratio = Math.min(maxDim / width, maxDim / height);
      width  = Math.round(width  * ratio);
      height = Math.round(height * ratio);
    }

    const canvas = document.createElement('canvas');
    canvas.width  = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d')!;
    ctx.drawImage(img, 0, 0, width, height);
    return canvas.toDataURL('image/jpeg', quality);
  } finally {
    URL.revokeObjectURL(url);
  }
}

// ── Extracteurs par format ─────────────────────────────────────────────────────

async function extractXLSX(file: File): Promise<string> {
  try {
    const XLSX = await import('xlsx');
    const ab   = await readAsArrayBuffer(file);
    const wb   = XLSX.read(ab, { type: 'array', cellDates: true });

    const lines: string[] = [`=== FICHIER EXCEL : ${file.name} ===`];
    for (const sheetName of wb.SheetNames.slice(0, 6)) {
      const ws   = wb.Sheets[sheetName];
      const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(ws, {
        defval: '', raw: false, dateNF: 'YYYY-MM-DD',
      });
      if (rows.length === 0) continue;
      lines.push(`\n--- Feuille : ${sheetName} (${rows.length} lignes) ---`);
      // En-têtes
      const headers = Object.keys(rows[0] ?? {});
      lines.push(headers.join(' | '));
      lines.push('---');
      // Données (max 300 lignes par feuille)
      for (const row of rows.slice(0, 300)) {
        lines.push(Object.values(row).map(v => String(v ?? '')).join(' | '));
      }
      if (rows.length > 300) lines.push(`[...${rows.length - 300} lignes supplémentaires...]`);
    }
    return lines.join('\n').slice(0, MAX_TEXT_CHARS);
  } catch (e) {
    return `[Erreur lecture Excel ${file.name}: ${e}]`;
  }
}

async function extractDOCX(file: File): Promise<string> {
  try {
    const mammoth = await import('mammoth');
    const ab = await readAsArrayBuffer(file);
    const result = await mammoth.extractRawText({ arrayBuffer: ab });
    return `=== FICHIER WORD : ${file.name} ===\n\n${result.value}`.slice(0, MAX_TEXT_CHARS);
  } catch (e) {
    return `[Erreur lecture DOCX ${file.name}: ${e}]`;
  }
}

async function extractPDF(file: File): Promise<{ text: string; isScanned: boolean }> {
  try {
    const pdfjsLib = await import('pdfjs-dist');
    // Chemin du worker CDN (évite les problèmes bundler)
    if (!pdfjsLib.GlobalWorkerOptions.workerSrc) {
      pdfjsLib.GlobalWorkerOptions.workerSrc = `//cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjsLib.version}/pdf.worker.min.js`;
    }
    const ab  = await readAsArrayBuffer(file);
    const pdf = await pdfjsLib.getDocument({ data: ab }).promise;
    const lines: string[] = [`=== FICHIER PDF : ${file.name} (${pdf.numPages} pages) ===`];

    let totalChars = 0;
    let pagesWithText = 0;

    for (let i = 1; i <= Math.min(pdf.numPages, 30); i++) {
      const page    = await pdf.getPage(i);
      const content = await page.getTextContent();
      const text    = content.items
        .map((item: { str?: string }) => item.str ?? '')
        .join(' ')
        .replace(/\s+/g, ' ')
        .trim();

      if (text.length > 20) {
        pagesWithText++;
        lines.push(`\n--- Page ${i} ---`);
        lines.push(text);
        totalChars += text.length;
        if (totalChars > MAX_TEXT_CHARS) break;
      }
    }

    const textRatio = pagesWithText / Math.min(pdf.numPages, 30);
    const isScanned = textRatio < 0.3; // < 30% des pages avec texte = probablement scanné

    if (isScanned) {
      return { text: lines.join('\n').slice(0, 2000), isScanned: true };
    }
    return { text: lines.join('\n').slice(0, MAX_TEXT_CHARS), isScanned: false };
  } catch (e) {
    return { text: `[Erreur lecture PDF ${file.name}: ${e}]`, isScanned: false };
  }
}

async function extractCSV(file: File): Promise<string> {
  const text = await readAsText(file);
  return `=== FICHIER CSV : ${file.name} ===\n\n${text}`.slice(0, MAX_TEXT_CHARS);
}

async function extractText(file: File): Promise<string> {
  const text = await readAsText(file);
  return `=== FICHIER TEXTE : ${file.name} ===\n\n${text}`.slice(0, MAX_TEXT_CHARS);
}

// ── Extracteur principal ───────────────────────────────────────────────────────

/**
 * Extrait le contenu d'un fichier browser-side.
 * Retourne un SwarmInputFile enrichi avec textContent et/ou dataUrl.
 */
export async function extractFileContent(
  ufile: { file: File; name: string; size: number; ext: string; domain?: string },
): Promise<Omit<SwarmInputFile, never>> {
  const ext = ufile.ext.toLowerCase();

  // ── Images & scans ──────────────────────────────────────────────────────────
  if (['jpg', 'jpeg', 'png', 'bmp', 'webp', 'tiff', 'tif'].includes(ext)) {
    let dataUrl: string | undefined;
    if (ufile.size <= MAX_IMAGE_BYTES) {
      try { dataUrl = await compressImage(ufile.file); } catch { /* ignore */ }
    }
    return { name: ufile.name, ext: ufile.ext, size: ufile.size, isImage: true, dataUrl };
  }

  // ── Excel ───────────────────────────────────────────────────────────────────
  if (['xlsx', 'xls', 'ods'].includes(ext)) {
    const textContent = await extractXLSX(ufile.file);
    return { name: ufile.name, ext: ufile.ext, size: ufile.size, textContent };
  }

  // ── Word ────────────────────────────────────────────────────────────────────
  if (['docx', 'doc'].includes(ext)) {
    const textContent = await extractDOCX(ufile.file);
    return { name: ufile.name, ext: ufile.ext, size: ufile.size, textContent };
  }

  // ── PDF ─────────────────────────────────────────────────────────────────────
  if (ext === 'pdf') {
    const { text, isScanned } = await extractPDF(ufile.file);
    if (isScanned && ufile.size <= MAX_IMAGE_BYTES) {
      // PDF scanné → envoyer comme image pour vision LLM
      let dataUrl: string | undefined;
      try { dataUrl = await readAsDataURL(ufile.file); } catch { /* ignore */ }
      return { name: ufile.name, ext: ufile.ext, size: ufile.size, isImage: true, dataUrl, textContent: text };
    }
    return { name: ufile.name, ext: ufile.ext, size: ufile.size, textContent: text };
  }

  // ── CSV ─────────────────────────────────────────────────────────────────────
  if (ext === 'csv') {
    const textContent = await extractCSV(ufile.file);
    return { name: ufile.name, ext: ufile.ext, size: ufile.size, textContent };
  }

  // ── Texte brut ──────────────────────────────────────────────────────────────
  if (['txt', 'xml', 'json', 'xer', 'kml', 'geojson'].includes(ext)) {
    const textContent = await extractText(ufile.file);
    return { name: ufile.name, ext: ufile.ext, size: ufile.size, textContent };
  }

  // ── Autres (zip, rar, dxf…) ─────────────────────────────────────────────────
  return { name: ufile.name, ext: ufile.ext, size: ufile.size };
}

/** Extrait le contenu de tous les fichiers en parallèle (avec concurrence limitée à 4) */
export async function extractAllFiles(
  ufiles: Array<{ file: File; name: string; size: number; ext: string; domain?: string }>,
  onProgress?: (done: number, total: number) => void,
): Promise<SwarmInputFile[]> {
  const results: SwarmInputFile[] = [];
  let done = 0;

  // Traitement par batches de 4 pour éviter de bloquer le thread UI
  for (let i = 0; i < ufiles.length; i += 4) {
    const batch = ufiles.slice(i, i + 4);
    const batchResults = await Promise.all(batch.map(f => extractFileContent(f)));
    results.push(...batchResults);
    done += batch.length;
    onProgress?.(done, ufiles.length);
  }

  return results;
}

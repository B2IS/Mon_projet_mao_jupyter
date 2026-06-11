/**
 * zipExtract.ts — Extraction de contenu textuel depuis ZIP/RAR
 * ─────────────────────────────────────────────────────────────
 * Utilise JSZip (déjà installé) pour décompresser et lire le contenu des
 * fichiers à l'intérieur d'une archive ZIP. Pour les RAR/7z (formats
 * propriétaires), on liste les noms via le Central Directory puis on
 * enrichit la description IA avec les noms de fichiers.
 *
 * Workflow migration :
 *   ZIP uploadé → listEntry() → extractTextFromZip() → [N fichiers virtuels]
 *     → chaque fichier virtuel est traité comme un MigrationDocument
 *     → analysé par le swarm LLM
 */

import JSZip from 'jszip';

/* ─── Types ────────────────────────────────────────────────────────────────── */

export interface ExtractedZipFile {
  name: string;         // nom complet dans l'archive (ex: "Lot1/Contrat.pdf")
  basename: string;     // nom court (ex: "Contrat.pdf")
  ext: string;
  text: string;         // texte extrait (vide si binaire non lisible)
  size: number;
  isText: boolean;
  file?: File;          // objet File si l'on veut passer au viewer
}

/* ─── Extensions lisibles en texte côté browser ────────────────────────────── */
const TEXT_EXTS = new Set([
  'txt', 'csv', 'json', 'xml', 'html', 'htm', 'md', 'log',
  'geojson', 'kml', 'svg', 'yaml', 'yml', 'ini', 'cfg',
]);

/** Extensions ignorées (images, vidéos, binaires sans texte utile). */
const SKIP_EXTS = new Set([
  'jpg', 'jpeg', 'png', 'gif', 'bmp', 'tif', 'tiff', 'webp',
  'mp4', 'avi', 'mov', 'mp3', 'wav',
  'exe', 'dll', 'so', 'bin', 'obj',
  'zip', 'rar', '7z', 'gz', 'tar',
]);

/** Taille max d'un fichier texte à lire (5 Mo) pour éviter OOM. */
const MAX_TEXT_SIZE = 5 * 1024 * 1024;

/* ─── Extraction DOCX (via mammoth si dispo, sinon XML brut) ───────────────── */
async function extractDocxText(blob: Blob): Promise<string> {
  try {
    // Mammoth est disponible dans le projet
    const mammoth = await import('mammoth');
    const arrayBuffer = await blob.arrayBuffer();
    const result = await mammoth.extractRawText({ arrayBuffer });
    return result.value;
  } catch {
    // Fallback : lit le word/document.xml brut
    try {
      const innerZip = await JSZip.loadAsync(blob);
      const docXml = await innerZip.file('word/document.xml')?.async('string');
      if (docXml) {
        return docXml.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
      }
    } catch {}
    return '';
  }
}

/* ─── Extraction XLSX (via SheetJS) ────────────────────────────────────────── */
async function extractXlsxText(blob: Blob): Promise<string> {
  try {
    const XLSX = await import('xlsx');
    const arrayBuffer = await blob.arrayBuffer();
    const wb = XLSX.read(arrayBuffer, { type: 'array' });
    const lines: string[] = [];
    for (const sheetName of wb.SheetNames.slice(0, 5)) {
      const ws = wb.Sheets[sheetName];
      const csv = XLSX.utils.sheet_to_csv(ws, { blankrows: false });
      if (csv.trim()) lines.push(`[Feuille: ${sheetName}]\n${csv.slice(0, 3000)}`);
    }
    return lines.join('\n\n');
  } catch {
    return '';
  }
}

/* ─── Extraction PDF via pdf.js (même worker que docText.ts) ────────────────── */
async function extractPdfText(blob: Blob): Promise<string> {
  try {
    const pdfjs = await import('pdfjs-dist/build/pdf');
    try { pdfjs.GlobalWorkerOptions.workerSrc = '/pdf.worker.min.js'; } catch { /* already set */ }
    const buf = await blob.arrayBuffer();
    const doc = await pdfjs.getDocument({ data: buf, isEvalSupported: false }).promise;
    const parts: string[] = [];
    const maxPages = Math.min(doc.numPages, 30); // limite à 30 pages par PDF dans un ZIP
    for (let p = 1; p <= maxPages; p++) {
      const page = await doc.getPage(p);
      const content = await page.getTextContent();
      const line = content.items
        .map((it: unknown) => (it && typeof it === 'object' && 'str' in it ? (it as { str: string }).str : ''))
        .join(' ')
        .replace(/\s+/g, ' ')
        .trim();
      if (line) parts.push(`### Page ${p}\n${line}`);
    }
    const out = parts.join('\n\n').trim();
    if (out) return out;
    // PDF sans texte sélectionnable (scan/image)
    return `[PDF scanné — ${(blob.size / 1024).toFixed(0)} Ko — pas de texte sélectionnable (OCR requis)]`;
  } catch {
    return `[PDF — ${(blob.size / 1024).toFixed(0)} Ko — lecture impossible]`;
  }
}

/* ─── Cœur : extraction ZIP ─────────────────────────────────────────────────── */

/**
 * Charge un ZIP, extrait le texte de chaque fichier interne et retourne
 * un tableau de `ExtractedZipFile` prêts à être injectés dans le swarm IA.
 */
export async function extractZipContents(
  zipFile: File,
  onProgress?: (done: number, total: number) => void,
): Promise<ExtractedZipFile[]> {
  const zip = await JSZip.loadAsync(zipFile);
  const entries = Object.values(zip.files).filter(f => !f.dir);
  const results: ExtractedZipFile[] = [];
  let done = 0;

  for (const entry of entries) {
    const name     = entry.name;
    const basename = name.split('/').pop() ?? name;
    const ext      = basename.split('.').pop()?.toLowerCase() ?? '';

    // Ignorer les fichiers système et binaires non utiles
    if (basename.startsWith('.__') || basename === '.DS_Store') { done++; continue; }
    if (SKIP_EXTS.has(ext)) {
      // On liste quand même la présence du fichier
      results.push({ name, basename, ext, text: `[Fichier binaire: ${basename}]`, size: 0, isText: false });
      done++;
      onProgress?.(done, entries.length);
      continue;
    }

    try {
      const blob = await entry.async('blob');
      const size = blob.size;

      // Ignore si trop lourd
      if (size > MAX_TEXT_SIZE * 2) {
        results.push({ name, basename, ext, text: `[Fichier volumineux: ${basename} — ${(size/1024/1024).toFixed(1)} Mo]`, size, isText: false });
        done++;
        onProgress?.(done, entries.length);
        continue;
      }

      let text = '';
      let isText = false;

      if (TEXT_EXTS.has(ext) && size <= MAX_TEXT_SIZE) {
        text = await entry.async('string');
        isText = true;
      } else if ((ext === 'docx' || ext === 'doc') && size <= MAX_TEXT_SIZE) {
        text = await extractDocxText(blob);
        isText = true;
      } else if ((ext === 'xlsx' || ext === 'xls') && size <= MAX_TEXT_SIZE) {
        text = await extractXlsxText(blob);
        isText = true;
      } else if (ext === 'pdf') {
        text = await extractPdfText(blob);
        // Si pdf.js a extrait du texte réel (pas un placeholder), on le marque comme texte
        isText = text.length > 100 && !text.startsWith('[PDF');
      } else {
        // Tentative lecture UTF-8
        try {
          text = await entry.async('string');
          // Vérifie si c'est lisible (pas trop de caractères non-ASCII)
          const readable = text.slice(0, 200).replace(/[\x00-\x1F\x80-\xFF]/g, '').length / 200;
          if (readable < 0.7) { text = `[Fichier binaire: ${basename}]`; isText = false; }
          else isText = true;
        } catch {
          text = `[Fichier: ${basename} — non lisible]`;
        }
      }

      // Construit l'objet File pour le viewer si nécessaire
      const fileObj = new File([blob], basename, { type: blob.type || 'application/octet-stream' });

      results.push({ name, basename, ext, text: text.slice(0, 8000), size, isText, file: fileObj });
    } catch (e) {
      results.push({ name, basename, ext, text: `[Erreur lecture: ${basename}]`, size: 0, isText: false });
    }

    done++;
    onProgress?.(done, entries.length);
  }

  return results;
}

/**
 * Convertit les fichiers extraits en documents pour le swarm IA.
 * Filtre les fichiers avec du texte exploitable.
 */
export function zipFilesToSwarmDocs(
  extracted: ExtractedZipFile[],
  zipName: string,
): { name: string; text: string }[] {
  const docs: { name: string; text: string }[] = [];

  // 1) Résumé de l'archive (liste de tous les fichiers)
  const allNames = extracted.map(f => `  • ${f.basename} (${(f.size/1024).toFixed(0)} Ko)`).join('\n');
  docs.push({
    name: `[ARCHIVE] ${zipName}`,
    text: `Archive ZIP: ${zipName}\nContenu (${extracted.length} fichiers):\n${allNames}`,
  });

  // 2) Fichiers avec contenu texte réel
  for (const f of extracted) {
    if (f.isText && f.text.trim().length > 50) {
      docs.push({ name: f.basename, text: f.text });
    }
  }

  return docs;
}

/* ─── RAR/7z — listing via Central Directory (sans décompression) ──────────── */

/** Pour les archives non-ZIP (RAR, 7z), on retourne juste la liste des noms. */
export function rarListingToSwarmDoc(
  fileNames: string[],
  archiveName: string,
): { name: string; text: string } {
  const list = fileNames.map(n => `  • ${n}`).join('\n');
  return {
    name: `[ARCHIVE RAR/7z] ${archiveName}`,
    text: `Archive ${archiveName}\nContenu (${fileNames.length} fichiers):\n${list}\n\n[Extraction automatique non disponible pour RAR/7z côté navigateur — les noms de fichiers sont utilisés pour l'analyse IA]`,
  };
}

/** Détermine si un File est un ZIP, RAR ou 7z. */
export function getArchiveType(file: File): 'zip' | 'rar' | '7z' | null {
  const name = file.name.toLowerCase();
  if (name.endsWith('.zip')) return 'zip';
  if (name.endsWith('.rar')) return 'rar';
  if (name.endsWith('.7z'))  return '7z';
  return null;
}

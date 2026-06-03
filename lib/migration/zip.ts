/**
 * zip.ts — Lecture des entrées d'une archive ZIP côté navigateur, SANS dépendance.
 * ------------------------------------------------------------------------------
 * On parse uniquement le « Central Directory » du ZIP pour lister les NOMS des
 * fichiers contenus (pas besoin de décompresser pour obtenir les noms). Cela
 * permet à l'IA de migration de « voir » les documents du dossier projet
 * (contrat, DAO, BOQ, PV, rapports…) à partir d'une seule archive.
 *
 * Format ZIP (APPNOTE) :
 *  • End Of Central Directory (EOCD)  — signature 0x06054b50
 *  • Central Directory File Header     — signature 0x02014b50
 *
 * Limites connues : ZIP64 non géré (archives > 4 Go / > 65535 entrées). Pour ces
 * cas — ou pour RAR/7z (formats propriétaires) — l'extraction est déléguée au
 * back-end (le fichier est alors traité comme un « bundle »).
 */

const EOCD_SIG = 0x06054b50;
const CDFH_SIG = 0x02014b50;

export interface ZipEntry {
  name: string;
  compressedSize: number;
  uncompressedSize: number;
  isDirectory: boolean;
}

/** Liste les entrées (fichiers) contenues dans une archive ZIP. */
export async function listZipEntries(file: File): Promise<ZipEntry[]> {
  const buf = new Uint8Array(await file.arrayBuffer());
  const view = new DataView(buf.buffer);

  // 1) Localiser l'EOCD en remontant depuis la fin (commentaire ≤ 65535 octets)
  const maxBack = Math.min(buf.length, 65557);
  let eocd = -1;
  for (let i = buf.length - 22; i >= buf.length - maxBack && i >= 0; i--) {
    if (view.getUint32(i, true) === EOCD_SIG) { eocd = i; break; }
  }
  if (eocd === -1) throw new Error('EOCD introuvable (archive ZIP invalide ou ZIP64)');

  const totalEntries = view.getUint16(eocd + 10, true);
  let offset = view.getUint32(eocd + 16, true); // début du central directory

  const decoder = new TextDecoder('utf-8');
  const entries: ZipEntry[] = [];

  for (let n = 0; n < totalEntries; n++) {
    if (offset + 46 > buf.length || view.getUint32(offset, true) !== CDFH_SIG) break;
    const compressedSize = view.getUint32(offset + 20, true);
    const uncompressedSize = view.getUint32(offset + 24, true);
    const nameLen = view.getUint16(offset + 28, true);
    const extraLen = view.getUint16(offset + 30, true);
    const commentLen = view.getUint16(offset + 32, true);
    const nameBytes = buf.subarray(offset + 46, offset + 46 + nameLen);
    const name = decoder.decode(nameBytes);
    entries.push({
      name,
      compressedSize,
      uncompressedSize,
      isDirectory: name.endsWith('/'),
    });
    offset += 46 + nameLen + extraLen + commentLen;
  }

  return entries.filter(e => !e.isDirectory && !!e.name.trim());
}

/** Vrai si le fichier est une archive (par extension). */
export function isArchive(name: string): boolean {
  return /\.(zip|rar|7z)$/i.test(name);
}

/** Vrai si l'archive est un ZIP (seul format lisible côté navigateur sans dépendance). */
export function isZip(name: string): boolean {
  return /\.zip$/i.test(name);
}

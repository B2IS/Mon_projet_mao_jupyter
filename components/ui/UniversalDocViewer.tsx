'use client';

import { useState, useEffect } from 'react';
import { FileText, Archive, Table2, Code2, Image as ImageIcon, AlertTriangle } from 'lucide-react';

/* ─────────────────────────────────────────────────────────────
   Helpers
───────────────────────────────────────────────────────────── */
function dataUrlToBytes(dataUrl: string): Uint8Array {
  const base64 = dataUrl.split(',')[1] ?? '';
  const bin = atob(base64);
  const buf = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) buf[i] = bin.charCodeAt(i);
  return buf;
}

function dataUrlToText(dataUrl: string): string {
  const bytes = dataUrlToBytes(dataUrl);
  try { return new TextDecoder('utf-8', { fatal: true }).decode(bytes); }
  catch { return new TextDecoder('latin1').decode(bytes); }
}

function Spinner() {
  return (
    <div style={{ padding: 40, textAlign: 'center', color: '#64748B', fontSize: 13 }}>
      <div style={{ width: 28, height: 28, border: '3px solid #E2E8F0', borderTopColor: '#1B4F8A', borderRadius: '50%', animation: 'spin 0.8s linear infinite', margin: '0 auto 12px' }} />
      Chargement…
      <style>{`@keyframes spin{from{transform:rotate(0)}to{transform:rotate(360deg)}}`}</style>
    </div>
  );
}

function ErrBox({ msg }: { msg: string }) {
  return (
    <div style={{ padding: 32, display: 'flex', alignItems: 'center', gap: 10, color: '#DC2626', background: '#FEF2F2', margin: 20, borderRadius: 10 }}>
      <AlertTriangle size={18} /> <span>{msg}</span>
    </div>
  );
}

/* ─────────────────────────────────────────────────────────────
   PDF viewer
───────────────────────────────────────────────────────────── */
function PdfViewer({ fileUrl }: { fileUrl: string }) {
  return <iframe src={fileUrl} title="Aperçu PDF" style={{ width: '100%', height: '100%', border: 'none', background: '#fff' }} />;
}

/* ─────────────────────────────────────────────────────────────
   Image viewer (PNG · JPG · GIF · BMP · WEBP · TIFF · SVG)
───────────────────────────────────────────────────────────── */
function ImageViewer({ fileUrl, fileName }: { fileUrl: string; fileName: string }) {
  return (
    <div style={{ flex: 1, overflow: 'auto', background: '#1E293B', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}>
      <img src={fileUrl} alt={fileName} style={{ maxWidth: '100%', maxHeight: '100%', objectFit: 'contain', boxShadow: '0 8px 32px rgba(0,0,0,.4)', borderRadius: 4 }} />
    </div>
  );
}

/* ─────────────────────────────────────────────────────────────
   Word viewer (.docx/.doc) — mammoth → srcdoc
───────────────────────────────────────────────────────────── */
function WordViewer({ fileUrl }: { fileUrl: string }) {
  const [html, setHtml] = useState<string | null>(null);
  const [err,  setErr]  = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const bytes = dataUrlToBytes(fileUrl);
        const mammoth = await import('mammoth');
        const result  = await mammoth.convertToHtml({ arrayBuffer: bytes.buffer as ArrayBuffer });
        if (!cancelled) setHtml(result.value);
      } catch (e: unknown) {
        if (!cancelled) setErr(e instanceof Error ? e.message : 'Lecture impossible');
      }
    })();
    return () => { cancelled = true; };
  }, [fileUrl]);

  if (err)  return <ErrBox msg={`Word : ${err}`} />;
  if (!html) return <Spinner />;

  const srcdoc = `<!DOCTYPE html><html><head><meta charset="utf-8"><style>
    body{font-family:'Segoe UI',Arial,sans-serif;font-size:13px;line-height:1.7;color:#1E293B;max-width:820px;margin:32px auto;padding:0 24px 48px}
    h1,h2,h3{color:#1B4F8A;margin-top:1.4em}
    table{border-collapse:collapse;width:100%;margin:1em 0}
    td,th{border:1px solid #CBD5E1;padding:6px 10px}
    th{background:#EFF6FF;font-weight:700}
    p{margin:0.5em 0}img{max-width:100%}
  </style></head><body>${html}</body></html>`;

  return <iframe srcDoc={srcdoc} title="Aperçu Word" sandbox="allow-same-origin" style={{ width: '100%', height: '100%', border: 'none', background: '#fff' }} />;
}

/* ─────────────────────────────────────────────────────────────
   Excel viewer (.xlsx/.xls) — @e965/xlsx → tables + onglets
───────────────────────────────────────────────────────────── */
type SheetData = { name: string; rows: (string | number)[][] };

function ExcelViewer({ fileUrl }: { fileUrl: string }) {
  const [sheets, setSheets] = useState<SheetData[] | null>(null);
  const [active, setActive] = useState(0);
  const [err,    setErr]    = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const bytes = dataUrlToBytes(fileUrl);
        const XLSX  = await import('@e965/xlsx');
        const wb    = XLSX.read(bytes, { type: 'array' });
        const result: SheetData[] = wb.SheetNames.map(name => ({
          name,
          rows: XLSX.utils.sheet_to_json<(string | number)[]>(wb.Sheets[name], { header: 1, defval: '' }),
        }));
        if (!cancelled) { setSheets(result); setActive(0); }
      } catch (e: unknown) {
        if (!cancelled) setErr(e instanceof Error ? e.message : 'Lecture impossible');
      }
    })();
    return () => { cancelled = true; };
  }, [fileUrl]);

  if (err)     return <ErrBox msg={`Excel : ${err}`} />;
  if (!sheets) return <Spinner />;

  const sheet = sheets[active];
  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      {sheets.length > 1 && (
        <div style={{ display: 'flex', background: '#1E293B', flexShrink: 0, overflowX: 'auto' }}>
          {sheets.map((s, i) => (
            <button key={s.name} onClick={() => setActive(i)} style={{
              padding: '8px 16px', border: 'none', cursor: 'pointer', fontSize: 11, fontWeight: 700,
              fontFamily: 'inherit', whiteSpace: 'nowrap',
              background: i === active ? '#16A34A' : 'transparent',
              color: i === active ? '#fff' : 'rgba(255,255,255,.6)',
              borderBottom: i === active ? '2px solid #22C55E' : '2px solid transparent',
            }}>{s.name}</button>
          ))}
        </div>
      )}
      <div style={{ flex: 1, overflow: 'auto', background: '#fff' }}>
        <table style={{ borderCollapse: 'collapse', fontSize: 11.5, width: '100%' }}>
          <tbody>
            {sheet.rows.map((row, ri) => (
              <tr key={ri} style={{ background: ri === 0 ? '#EFF6FF' : ri % 2 === 0 ? '#F8FAFC' : '#fff' }}>
                {(row as (string|number)[]).map((cell, ci) => (
                  ri === 0
                    ? <th key={ci} style={{ border: '1px solid #CBD5E1', padding: '5px 10px', textAlign: 'left', fontWeight: 700, color: '#1B4F8A', whiteSpace: 'nowrap', position: 'sticky', top: 0, background: '#EFF6FF' }}>{String(cell ?? '')}</th>
                    : <td key={ci} style={{ border: '1px solid #E2E8F0', padding: '4px 10px', color: '#1E293B', whiteSpace: 'nowrap' }}>{String(cell ?? '')}</td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

/* ─────────────────────────────────────────────────────────────
   CSV viewer — parse inline → table
───────────────────────────────────────────────────────────── */
function CsvViewer({ fileUrl }: { fileUrl: string }) {
  const [rows, setRows] = useState<string[][] | null>(null);

  useEffect(() => {
    const text = dataUrlToText(fileUrl);
    // Detect delimiter (comma, semicolon, tab)
    const first = text.split('\n')[0] ?? '';
    const delim = first.includes(';') ? ';' : first.includes('\t') ? '\t' : ',';
    const parsed = text.trim().split('\n').map(line =>
      line.split(delim).map(c => c.replace(/^"|"$/g, '').trim())
    );
    setRows(parsed);
  }, [fileUrl]);

  if (!rows) return <Spinner />;

  return (
    <div style={{ flex: 1, overflow: 'auto', background: '#fff' }}>
      <table style={{ borderCollapse: 'collapse', fontSize: 11.5, width: '100%' }}>
        <tbody>
          {rows.map((row, ri) => (
            <tr key={ri} style={{ background: ri === 0 ? '#EFF6FF' : ri % 2 === 0 ? '#F8FAFC' : '#fff' }}>
              {row.map((cell, ci) => (
                ri === 0
                  ? <th key={ci} style={{ border: '1px solid #CBD5E1', padding: '5px 10px', textAlign: 'left', fontWeight: 700, color: '#1B4F8A', position: 'sticky', top: 0, background: '#EFF6FF', whiteSpace: 'nowrap' }}>{cell}</th>
                  : <td key={ci} style={{ border: '1px solid #E2E8F0', padding: '4px 10px', color: '#1E293B', whiteSpace: 'nowrap' }}>{cell}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/* ─────────────────────────────────────────────────────────────
   Text/Code viewer (TXT · XML · JSON · KML · XER · MPP · DXF · SCD…)
───────────────────────────────────────────────────────────── */
function TextViewer({ fileUrl, ext }: { fileUrl: string; ext: string }) {
  const [text, setText] = useState<string | null>(null);

  useEffect(() => {
    const raw = dataUrlToText(fileUrl);
    setText(raw.slice(0, 500_000)); // max 500 Ko affiché
  }, [fileUrl]);

  if (!text) return <Spinner />;

  // Colorisation basique par type
  const isXml  = ['xml', 'kml', 'kmz', 'scd', 'cid', 'icd'].includes(ext);
  const isJson = ext === 'json';

  let display = text;
  if (isJson) {
    try { display = JSON.stringify(JSON.parse(text), null, 2); } catch { /* garder tel quel */ }
  }

  return (
    <div style={{ flex: 1, overflow: 'auto', background: '#0F172A', padding: '20px 24px' }}>
      <div style={{ marginBottom: 8, display: 'flex', gap: 6, alignItems: 'center' }}>
        <Code2 size={13} color="#60A5FA" />
        <span style={{ fontSize: 10.5, fontWeight: 700, color: '#60A5FA', textTransform: 'uppercase', letterSpacing: '.08em' }}>
          {isXml ? 'XML / Markup' : isJson ? 'JSON' : ext.toUpperCase()}
        </span>
        <span style={{ fontSize: 10, color: '#475569', marginLeft: 'auto' }}>
          {(text.length / 1024).toFixed(1)} Ko
        </span>
      </div>
      <pre style={{ margin: 0, fontFamily: "'JetBrains Mono', 'Fira Code', 'Cascadia Code', monospace", fontSize: 11.5, color: '#94A3B8', whiteSpace: 'pre-wrap', lineHeight: 1.65 }}>
        {display}
      </pre>
    </div>
  );
}

/* ─────────────────────────────────────────────────────────────
   ZIP / RAR / KMZ — liste des fichiers avec JSZip
───────────────────────────────────────────────────────────── */
type ZipEntry = { path: string; size: number; isDir: boolean };

function ZipViewer({ fileUrl, fileName }: { fileUrl: string; fileName: string }) {
  const [entries, setEntries] = useState<ZipEntry[] | null>(null);
  const [err,     setErr]     = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        if (fileName.toLowerCase().endsWith('.rar')) {
          if (!cancelled) setErr('Les archives RAR ne peuvent pas être lues dans le navigateur. Téléchargez le fichier.');
          return;
        }
        const bytes  = dataUrlToBytes(fileUrl);
        const JSZip  = (await import('jszip')).default;
        const zip    = await JSZip.loadAsync(bytes);
        const list: ZipEntry[] = [];
        zip.forEach((path, entry) => {
          list.push({ path, size: (entry as { _data?: { uncompressedSize?: number } })._data?.uncompressedSize ?? 0, isDir: entry.dir });
        });
        list.sort((a, b) => a.path.localeCompare(b.path));
        if (!cancelled) setEntries(list);
      } catch (e: unknown) {
        if (!cancelled) setErr(e instanceof Error ? e.message : 'Archive illisible');
      }
    })();
    return () => { cancelled = true; };
  }, [fileUrl, fileName]);

  if (err)      return <ErrBox msg={err} />;
  if (!entries) return <Spinner />;

  const files = entries.filter(e => !e.isDir);
  const totalSize = files.reduce((s, e) => s + e.size, 0);

  return (
    <div style={{ flex: 1, overflow: 'auto', background: '#fff', padding: 0 }}>
      {/* Résumé */}
      <div style={{ background: '#1E293B', padding: '10px 18px', display: 'flex', gap: 20, alignItems: 'center' }}>
        <Archive size={15} color="#60A5FA" />
        <span style={{ fontSize: 12, fontWeight: 700, color: '#E2E8F0' }}>
          {files.length} fichier(s) · {(totalSize / 1024).toFixed(0)} Ko décompressé
        </span>
        <span style={{ fontSize: 11, color: '#64748B' }}>{entries.filter(e => e.isDir).length} dossier(s)</span>
      </div>
      {/* Liste */}
      {entries.map(e => {
        const depth = (e.path.match(/\//g) ?? []).length;
        const name  = e.path.split('/').filter(Boolean).pop() ?? e.path;
        const ext   = name.split('.').pop()?.toLowerCase() ?? '';
        const isDir = e.isDir;
        return (
          <div key={e.path} style={{
            display: 'flex', alignItems: 'center', gap: 8,
            padding: '6px 18px', paddingLeft: 18 + depth * 16,
            borderBottom: '1px solid #F1F5F9',
            background: isDir ? '#F8FAFC' : '#fff',
          }}>
            {isDir
              ? <Archive size={12} color="#94A3B8" />
              : <FileText size={12} color={ext === 'pdf' ? '#DC2626' : ['xlsx','xls','csv'].includes(ext) ? '#059669' : ['docx','doc'].includes(ext) ? '#2563EB' : ext === 'xml' || ext === 'kml' ? '#D97706' : '#64748B'} />
            }
            <span style={{ fontSize: 12, color: isDir ? '#475569' : '#1E293B', fontWeight: isDir ? 700 : 400 }}>
              {name}
            </span>
            {!isDir && e.size > 0 && (
              <span style={{ marginLeft: 'auto', fontSize: 10, color: '#94A3B8' }}>
                {e.size > 1024 * 1024 ? `${(e.size/1024/1024).toFixed(1)} Mo` : `${(e.size/1024).toFixed(0)} Ko`}
              </span>
            )}
          </div>
        );
      })}
    </div>
  );
}

/* ─────────────────────────────────────────────────────────────
   PPTX viewer — JSZip → slide count + titres
───────────────────────────────────────────────────────────── */
type Slide = { idx: number; title: string };

function PptxViewer({ fileUrl }: { fileUrl: string }) {
  const [slides, setSlides] = useState<Slide[] | null>(null);
  const [err,    setErr]    = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const bytes  = dataUrlToBytes(fileUrl);
        const JSZip  = (await import('jszip')).default;
        const zip    = await JSZip.loadAsync(bytes);

        const slideFiles = Object.keys(zip.files)
          .filter(k => /ppt\/slides\/slide\d+\.xml$/i.test(k))
          .sort((a, b) => {
            const na = parseInt(a.match(/\d+/)?.[0] ?? '0');
            const nb = parseInt(b.match(/\d+/)?.[0] ?? '0');
            return na - nb;
          });

        const result: Slide[] = [];
        for (let i = 0; i < slideFiles.length; i++) {
          const xml   = await zip.files[slideFiles[i]].async('text');
          // Extract first <a:t> text node as title
          const match = xml.match(/<a:t>([^<]{3,100})<\/a:t>/);
          result.push({ idx: i + 1, title: match?.[1]?.trim() || `Diapositive ${i + 1}` });
        }
        if (!cancelled) setSlides(result);
      } catch (e: unknown) {
        if (!cancelled) setErr(e instanceof Error ? e.message : 'Lecture impossible');
      }
    })();
    return () => { cancelled = true; };
  }, [fileUrl]);

  if (err)     return <ErrBox msg={`PowerPoint : ${err}`} />;
  if (!slides) return <Spinner />;

  return (
    <div style={{ flex: 1, overflow: 'auto', background: '#fff', padding: 20 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16, padding: '10px 14px', background: '#F1F5F9', borderRadius: 8 }}>
        <FileText size={14} color="#D97706" />
        <span style={{ fontWeight: 700, fontSize: 13, color: '#1E293B' }}>
          {slides.length} diapositive(s)
        </span>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        {slides.map(s => (
          <div key={s.idx} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 14px', border: '1px solid #E2E8F0', borderRadius: 8, background: '#F8FAFC' }}>
            <div style={{ width: 28, height: 28, borderRadius: 6, background: '#FFF7ED', border: '1px solid #FDE68A', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
              <span style={{ fontSize: 10, fontWeight: 800, color: '#D97706' }}>{s.idx}</span>
            </div>
            <span style={{ fontSize: 12.5, color: '#1E293B' }}>{s.title}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ─────────────────────────────────────────────────────────────
   ROUTER — dispatche selon l'extension
───────────────────────────────────────────────────────────── */
export function isPreviewable(ext: string): boolean {
  const e = ext.toLowerCase();
  return ['pdf','docx','doc','xlsx','xls','csv',
          'png','jpg','jpeg','gif','bmp','webp','svg','tiff','tif',
          'txt','xml','json','kml','xer','mpp','dxf','scd','cid','icd',
          'zip','kmz','pptx','ppt'].includes(e);
}

interface Props {
  fileUrl:  string;
  fileExt:  string;
  fileName: string;
}

export default function UniversalDocViewer({ fileUrl, fileExt, fileName }: Props) {
  const ext = fileExt.toLowerCase().replace(/^\./, '');

  // PDF
  if (ext === 'pdf') return <PdfViewer fileUrl={fileUrl} />;

  // Word
  if (['docx', 'doc'].includes(ext)) return <WordViewer fileUrl={fileUrl} />;

  // Excel
  if (['xlsx', 'xls'].includes(ext)) return <ExcelViewer fileUrl={fileUrl} />;

  // CSV
  if (ext === 'csv') return <CsvViewer fileUrl={fileUrl} />;

  // Images
  if (['png','jpg','jpeg','gif','bmp','webp','svg','tiff','tif'].includes(ext))
    return <ImageViewer fileUrl={fileUrl} fileName={fileName} />;

  // PowerPoint
  if (['pptx','ppt'].includes(ext)) return <PptxViewer fileUrl={fileUrl} />;

  // ZIP / KMZ
  if (['zip','kmz','rar'].includes(ext)) return <ZipViewer fileUrl={fileUrl} fileName={fileName} />;

  // Texte / Code / XML / SIG / Planning
  if (['txt','xml','json','kml','xer','mpp','dxf','dwg','scd','cid','icd'].includes(ext))
    return <TextViewer fileUrl={fileUrl} ext={ext} />;

  // Fallback (ne devrait pas arriver si isPreviewable est vérifié en amont)
  return (
    <div style={{ padding: 40, textAlign: 'center', color: '#64748B' }}>
      <FileText size={32} style={{ marginBottom: 10, opacity: 0.4 }} />
      <div>Format <strong>.{ext}</strong> non prévisualisable</div>
    </div>
  );
}

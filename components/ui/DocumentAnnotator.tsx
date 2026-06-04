'use client';

import React, { useState, useRef, useCallback } from 'react';
import {
  X, MessageSquarePlus, Highlighter, StickyNote, MousePointer2,
  Pen, Trash2, Download, Save, ZoomIn, ZoomOut, Type,
} from 'lucide-react';

/* ════════════════════════════════════════════════════════════════════════════
   DocumentAnnotator — visionneuse + annotation in-app, tous formats
   - Ouvre n'importe quel document (PDF, DOCX, XLSX, PNG, …)
   - Outils : commentaire épinglé, surlignage, note autocollante, texte libre, stylo
   - Liste latérale des annotations, suppression, sauvegarde, export
   Mimique le comportement des bons logiciels d'annotation documentaire.
═══════════════════════════════════════════════════════════════════════════════ */

const NAVY = '#1B4F8A';
const ORANGE = '#F47920';
const RED = '#EF3340';
const GREEN = '#16A34A';

export interface AnnotatedDoc {
  nom: string;
  ext: string;           // pdf | docx | xlsx | png | …
  taille?: string;
  url?: string;          // URL réelle du fichier (object URL) — affiche le vrai contenu
}

type Tool = 'select' | 'comment' | 'highlight' | 'note' | 'text' | 'pen';

interface Annotation {
  id: string;
  type: Tool;
  x: number;             // % position dans la page
  y: number;
  w?: number;            // % pour highlight
  h?: number;
  text?: string;
  color: string;
  author: string;
  at: string;
  points?: { x: number; y: number }[]; // pour le stylo
}

const TOOLS: { id: Tool; icon: React.ReactNode; label: string }[] = [
  { id: 'select',    icon: <MousePointer2 size={15} />,    label: 'Sélection' },
  { id: 'comment',   icon: <MessageSquarePlus size={15} />, label: 'Commentaire' },
  { id: 'highlight', icon: <Highlighter size={15} />,       label: 'Surligner' },
  { id: 'note',      icon: <StickyNote size={15} />,        label: 'Note' },
  { id: 'text',      icon: <Type size={15} />,              label: 'Texte' },
  { id: 'pen',       icon: <Pen size={15} />,               label: 'Stylo' },
];

const COLORS = ['#F47920', '#EF3340', '#16A34A', '#1B4F8A', '#8B5CF6', '#FACC15'];

export default function DocumentAnnotator({ doc, onClose, author = 'Maodo SENE' }: {
  doc: AnnotatedDoc;
  onClose: () => void;
  author?: string;
}) {
  const [tool, setTool] = useState<Tool>('select');
  const [color, setColor] = useState(COLORS[0]);
  const [zoom, setZoom] = useState(1);
  const [annotations, setAnnotations] = useState<Annotation[]>([]);
  const [activeAnn, setActiveAnn] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  // Drag state for highlight / pen
  const drawing = useRef<{ startX: number; startY: number; points: { x: number; y: number }[] } | null>(null);
  const pageRef = useRef<HTMLDivElement | null>(null);

  const pctCoords = useCallback((e: React.MouseEvent) => {
    const el = pageRef.current;
    if (!el) return { x: 0, y: 0 };
    const r = el.getBoundingClientRect();
    return {
      x: ((e.clientX - r.left) / r.width) * 100,
      y: ((e.clientY - r.top) / r.height) * 100,
    };
  }, []);

  const addAnnotation = (a: Omit<Annotation, 'id' | 'author' | 'at' | 'color'>) => {
    const ann: Annotation = {
      ...a, id: `ann_${Date.now()}`, color, author,
      at: new Date().toLocaleString('fr-FR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' }),
    };
    setAnnotations(prev => [...prev, ann]);
    setActiveAnn(ann.id);
    setSaved(false);
  };

  const handlePageMouseDown = (e: React.MouseEvent) => {
    if (tool === 'highlight' || tool === 'pen') {
      const { x, y } = pctCoords(e);
      drawing.current = { startX: x, startY: y, points: [{ x, y }] };
    }
  };
  const handlePageMouseMove = (e: React.MouseEvent) => {
    if (tool === 'pen' && drawing.current) {
      const { x, y } = pctCoords(e);
      drawing.current.points.push({ x, y });
      // force re-render via state of a temp? we keep simple: re-render on mouseup
    }
  };
  const handlePageMouseUp = (e: React.MouseEvent) => {
    const { x, y } = pctCoords(e);
    if (tool === 'comment' || tool === 'note' || tool === 'text') {
      addAnnotation({ type: tool, x, y, text: '' });
    } else if (tool === 'highlight' && drawing.current) {
      const sx = drawing.current.startX, sy = drawing.current.startY;
      addAnnotation({ type: 'highlight', x: Math.min(sx, x), y: Math.min(sy, y), w: Math.abs(x - sx), h: Math.max(Math.abs(y - sy), 2.5), text: '' });
      drawing.current = null;
    } else if (tool === 'pen' && drawing.current) {
      addAnnotation({ type: 'pen', x: 0, y: 0, points: [...drawing.current.points, { x, y }] });
      drawing.current = null;
    }
  };

  const updateText = (id: string, text: string) => {
    setAnnotations(prev => prev.map(a => a.id === id ? { ...a, text } : a));
    setSaved(false);
  };
  const deleteAnn = (id: string) => {
    setAnnotations(prev => prev.filter(a => a.id !== id));
    if (activeAnn === id) setActiveAnn(null);
    setSaved(false);
  };

  const save = () => { setSaved(true); setTimeout(() => setSaved(false), 2500); };

  const exportNotes = () => {
    const lines = annotations.map((a, i) => `${i + 1}. [${a.type}] ${a.text || '(sans texte)'} — ${a.author}, ${a.at}`).join('\n');
    const content = `ANNOTATIONS — ${doc.nom}\nExporté le ${new Date().toLocaleString('fr-FR')}\n\n${lines || 'Aucune annotation.'}`;
    const a = document.createElement('a');
    a.href = 'data:text/plain;charset=utf-8,' + encodeURIComponent(content);
    a.download = `annotations_${doc.nom.replace(/\.[^.]+$/, '')}.txt`;
    a.click();
  };

  const extColor = doc.ext === 'pdf' ? RED : doc.ext === 'xlsx' ? GREEN : doc.ext === 'png' ? '#8B5CF6' : NAVY;
  const cursorForTool = tool === 'select' ? 'default' : tool === 'highlight' ? 'crosshair' : tool === 'pen' ? 'crosshair' : 'copy';

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 600, display: 'flex', flexDirection: 'column', background: '#1E293B' }}>
      {/* ── Barre supérieure ── */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '10px 18px', background: '#0F172A', color: '#fff', flexShrink: 0 }}>
        <div style={{ width: 30, height: 30, borderRadius: 7, background: `${extColor}25`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
          <span style={{ fontSize: 9, fontWeight: 800, color: extColor, textTransform: 'uppercase' }}>{doc.ext}</span>
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 13.5, fontWeight: 700, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{doc.nom}</div>
          <div style={{ fontSize: 10.5, color: '#94A3B8' }}>{doc.taille ?? '—'} · Mode annotation · {annotations.length} annotation{annotations.length > 1 ? 's' : ''}</div>
        </div>
        {/* Zoom */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 4, background: '#1E293B', borderRadius: 7, padding: 3 }}>
          <button onClick={() => setZoom(z => Math.max(0.5, +(z - 0.1).toFixed(1)))} style={iconBtnDark}><ZoomOut size={14} /></button>
          <span style={{ fontSize: 11, width: 38, textAlign: 'center' }}>{Math.round(zoom * 100)}%</span>
          <button onClick={() => setZoom(z => Math.min(2, +(z + 0.1).toFixed(1)))} style={iconBtnDark}><ZoomIn size={14} /></button>
        </div>
        <button onClick={save} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '7px 14px', borderRadius: 7, border: 'none', background: saved ? GREEN : ORANGE, color: '#fff', fontSize: 12, fontWeight: 700, cursor: 'pointer' }}>
          <Save size={13} /> {saved ? 'Enregistré ✓' : 'Enregistrer'}
        </button>
        <button onClick={exportNotes} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '7px 12px', borderRadius: 7, border: '1px solid #334155', background: 'transparent', color: '#fff', fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>
          <Download size={13} /> Annotations
        </button>
        <button onClick={onClose} style={{ ...iconBtnDark, padding: 7 }}><X size={18} /></button>
      </div>

      {/* ── Barre d'outils ── */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 18px', background: '#15233B', borderTop: '1px solid #1E293B', flexShrink: 0 }}>
        {TOOLS.map(t => (
          <button key={t.id} onClick={() => setTool(t.id)} title={t.label}
            style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '7px 11px', borderRadius: 7, border: 'none', cursor: 'pointer', fontSize: 11.5, fontWeight: 600,
              background: tool === t.id ? ORANGE : '#1E293B', color: tool === t.id ? '#fff' : '#CBD5E1' }}>
            {t.icon} {t.label}
          </button>
        ))}
        <div style={{ width: 1, height: 22, background: '#334155', margin: '0 4px' }} />
        {COLORS.map(c => (
          <button key={c} onClick={() => setColor(c)} title="Couleur"
            style={{ width: 22, height: 22, borderRadius: '50%', background: c, border: color === c ? '3px solid #fff' : '2px solid #334155', cursor: 'pointer', flexShrink: 0 }} />
        ))}
        <div style={{ marginLeft: 'auto', fontSize: 11, color: '#94A3B8' }}>
          {tool === 'select' ? 'Cliquez une annotation pour l\'éditer' : tool === 'highlight' ? 'Glissez pour surligner' : tool === 'pen' ? 'Glissez pour dessiner' : 'Cliquez sur le document pour placer'}
        </div>
      </div>

      {/* ── Zone document + panneau annotations ── */}
      <div style={{ flex: 1, display: 'flex', overflow: 'hidden' }}>
        {/* Document */}
        <div style={{ flex: 1, overflow: 'auto', padding: 28, display: 'flex', justifyContent: 'center', alignItems: 'flex-start' }}>
          <div
            ref={pageRef}
            onMouseDown={handlePageMouseDown}
            onMouseMove={handlePageMouseMove}
            onMouseUp={handlePageMouseUp}
            style={{
              position: 'relative', width: 720 * zoom, minHeight: 940 * zoom, background: '#fff',
              borderRadius: 4, boxShadow: '0 12px 40px rgba(0,0,0,0.4)', cursor: cursorForTool, flexShrink: 0,
            }}
          >
            <DocPreview doc={doc} />

            {/* Annotations rendues */}
            {annotations.map(a => {
              if (a.type === 'highlight') {
                return <div key={a.id} onClick={() => setActiveAnn(a.id)} style={{ position: 'absolute', left: `${a.x}%`, top: `${a.y}%`, width: `${a.w}%`, height: `${a.h}%`, background: `${a.color}55`, border: activeAnn === a.id ? `1px solid ${a.color}` : 'none', borderRadius: 2, cursor: 'pointer' }} />;
              }
              if (a.type === 'pen' && a.points) {
                const d = a.points.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x} ${p.y}`).join(' ');
                return <svg key={a.id} viewBox="0 0 100 100" preserveAspectRatio="none" style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', pointerEvents: 'none' }}><path d={d} fill="none" stroke={a.color} strokeWidth={0.4} strokeLinecap="round" strokeLinejoin="round" /></svg>;
              }
              // comment pin / note / text
              return (
                <div key={a.id} onClick={(e) => { e.stopPropagation(); setActiveAnn(a.id); }}
                  style={{ position: 'absolute', left: `${a.x}%`, top: `${a.y}%`, transform: 'translate(-4px,-4px)', cursor: 'pointer', zIndex: activeAnn === a.id ? 20 : 10 }}>
                  {a.type === 'comment' && (
                    <div style={{ width: 24, height: 24, borderRadius: '50% 50% 50% 2px', background: a.color, display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 2px 6px rgba(0,0,0,0.3)' }}>
                      <MessageSquarePlus size={12} color="#fff" />
                    </div>
                  )}
                  {a.type === 'note' && (
                    <div style={{ width: 150, background: a.color, borderRadius: 4, padding: 6, boxShadow: '0 3px 10px rgba(0,0,0,0.3)' }}>
                      <textarea autoFocus={activeAnn === a.id} value={a.text} onChange={e => updateText(a.id, e.target.value)} onClick={e => e.stopPropagation()}
                        placeholder="Note…" style={{ width: '100%', border: 'none', background: 'transparent', resize: 'none', fontSize: 11, color: '#fff', outline: 'none', fontFamily: 'inherit', minHeight: 44 }} />
                    </div>
                  )}
                  {a.type === 'text' && (
                    <input autoFocus={activeAnn === a.id} value={a.text} onChange={e => updateText(a.id, e.target.value)} onClick={e => e.stopPropagation()}
                      placeholder="Texte…" style={{ border: 'none', background: 'transparent', fontSize: 14, fontWeight: 700, color: a.color, outline: 'none', fontFamily: 'inherit', minWidth: 60 }} />
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* Panneau annotations */}
        <div style={{ width: 280, background: '#0F172A', color: '#fff', flexShrink: 0, display: 'flex', flexDirection: 'column', borderLeft: '1px solid #1E293B' }}>
          <div style={{ padding: '12px 16px', borderBottom: '1px solid #1E293B', fontSize: 12, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', color: '#94A3B8' }}>
            Annotations ({annotations.length})
          </div>
          <div style={{ flex: 1, overflowY: 'auto', padding: 12, display: 'flex', flexDirection: 'column', gap: 8 }}>
            {annotations.length === 0 && (
              <div style={{ fontSize: 12, color: '#64748B', textAlign: 'center', padding: 24, lineHeight: 1.6 }}>
                Sélectionnez un outil ci-dessus puis cliquez sur le document pour ajouter une annotation.
              </div>
            )}
            {annotations.map((a, i) => (
              <div key={a.id} onClick={() => setActiveAnn(a.id)}
                style={{ background: activeAnn === a.id ? '#1E293B' : '#15233B', borderRadius: 8, padding: 10, cursor: 'pointer', border: activeAnn === a.id ? `1px solid ${a.color}` : '1px solid transparent' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 5 }}>
                  <span style={{ width: 10, height: 10, borderRadius: '50%', background: a.color, flexShrink: 0 }} />
                  <span style={{ fontSize: 10.5, fontWeight: 700, color: '#CBD5E1', textTransform: 'capitalize' }}>{i + 1}. {a.type === 'comment' ? 'Commentaire' : a.type === 'highlight' ? 'Surlignage' : a.type === 'note' ? 'Note' : a.type === 'pen' ? 'Dessin' : 'Texte'}</span>
                  <button onClick={(e) => { e.stopPropagation(); deleteAnn(a.id); }} style={{ marginLeft: 'auto', background: 'none', border: 'none', cursor: 'pointer', color: '#64748B', display: 'flex' }}><Trash2 size={13} /></button>
                </div>
                {(a.type === 'comment' || a.type === 'text' || a.type === 'note') && (
                  <input value={a.text} onChange={e => updateText(a.id, e.target.value)} onClick={e => e.stopPropagation()}
                    placeholder="Saisir le commentaire…" style={{ width: '100%', background: '#0F172A', border: '1px solid #334155', borderRadius: 5, padding: '5px 7px', fontSize: 11.5, color: '#fff', outline: 'none', fontFamily: 'inherit', boxSizing: 'border-box' }} />
                )}
                <div style={{ fontSize: 9.5, color: '#64748B', marginTop: 5 }}>{a.author} · {a.at}</div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

/* Aperçu représentatif selon le format */
function DocPreview({ doc }: { doc: AnnotatedDoc }) {
  const base: React.CSSProperties = { position: 'absolute', inset: 0, padding: '56px 60px', pointerEvents: 'none', userSelect: 'none' };

  // Si on a l'URL réelle du fichier, on affiche le vrai contenu
  if (doc.url) {
    const e = doc.ext.toLowerCase();
    if (e === 'png' || e === 'jpg' || e === 'jpeg' || e === 'gif' || e === 'bmp' || e === 'svg' || e === 'webp') {
      return (
        <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#F8FAFC' }}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={doc.url} alt={doc.nom} style={{ maxWidth: '100%', maxHeight: '100%', objectFit: 'contain', pointerEvents: 'none' }} />
        </div>
      );
    }
    if (e === 'pdf') {
      // pointerEvents:none → indispensable : sinon l'iframe capture tous les clics
      // et la couche d'annotation (surlignage, commentaire…) ne reçoit jamais d'événement.
      return <iframe src={doc.url} title={doc.nom} style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', border: 'none', background: '#fff', pointerEvents: 'none' }} />;
    }
    // autres formats (docx, xlsx…) : pas de rendu navigateur natif → aperçu + lien d'ouverture
    return (
      <div style={{ ...base, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 14, pointerEvents: 'none' }}>
        <div style={{ fontSize: 17, fontWeight: 800, color: NAVY }}>{doc.nom}</div>
        <div style={{ fontSize: 12, color: '#64748B', textAlign: 'center', maxWidth: 360 }}>
          Ce format ({doc.ext.toUpperCase()}) ne s&apos;affiche pas nativement dans le navigateur. Vous pouvez annoter par-dessus, ou ouvrir le fichier d&apos;origine.
        </div>
        <a href={doc.url} download={doc.nom} style={{ padding: '8px 16px', borderRadius: 8, background: NAVY, color: '#fff', fontSize: 12.5, fontWeight: 700, textDecoration: 'none', pointerEvents: 'auto' }}>Ouvrir / Télécharger le fichier</a>
      </div>
    );
  }
  if (doc.ext === 'xlsx') {
    return (
      <div style={base}>
        <div style={{ fontSize: 20, fontWeight: 800, color: NAVY, marginBottom: 20 }}>{doc.nom.replace(/\.[^.]+$/, '')}</div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', border: '1px solid #CBD5E1' }}>
          {Array.from({ length: 45 }).map((_, i) => (
            <div key={i} style={{ borderRight: '1px solid #E2E8F0', borderBottom: '1px solid #E2E8F0', padding: '7px 8px', fontSize: 11, background: i < 5 ? '#F1F5F9' : '#fff', fontWeight: i < 5 ? 700 : 400, color: i < 5 ? NAVY : '#475569' }}>
              {i < 5 ? ['Code', 'Désignation', 'Qté', 'PU', 'Total'][i] : ''}
            </div>
          ))}
        </div>
      </div>
    );
  }
  if (doc.ext === 'png') {
    return (
      <div style={{ ...base, display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', gap: 12 }}>
        <div style={{ width: '70%', height: '50%', background: 'linear-gradient(135deg,#E0F2FE,#BAE6FD)', borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'center', color: NAVY, fontSize: 14, fontWeight: 700 }}>
          🖼️ {doc.nom}
        </div>
        <div style={{ fontSize: 12, color: '#94A3B8' }}>Image — annotez directement dessus</div>
      </div>
    );
  }
  // pdf / docx / défaut : page de texte
  return (
    <div style={base}>
      <div style={{ fontSize: 22, fontWeight: 800, color: '#0F172A', marginBottom: 6 }}>{doc.nom.replace(/\.[^.]+$/, '')}</div>
      <div style={{ fontSize: 11, color: '#94A3B8', marginBottom: 24 }}>Direction Principale Équipement (DPE) — SENELEC</div>
      {Array.from({ length: 18 }).map((_, i) => (
        <div key={i} style={{ height: 9, width: i % 6 === 0 ? '40%' : `${78 + (i % 4) * 5}%`, borderRadius: 3, marginBottom: 13, background: i % 6 === 0 ? '#94A3B8' : '#E2E8F0' }} />
      ))}
    </div>
  );
}

const iconBtnDark: React.CSSProperties = {
  background: 'transparent', border: 'none', color: '#fff', cursor: 'pointer',
  display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: 6, padding: 5,
};

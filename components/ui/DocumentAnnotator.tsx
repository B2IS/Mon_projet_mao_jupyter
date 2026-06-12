'use client';
import React, { useState, useRef, useCallback, useEffect } from 'react';
import {
  X, MessageSquarePlus, Highlighter, StickyNote, MousePointer2,
  Pen, Trash2, Download, Save, ZoomIn, ZoomOut, Type,
  CheckCircle, Check, XCircle, Clock, ChevronRight, ChevronLeft,
  ListChecks,
} from 'lucide-react';

/* ════════════════════════════════════════════════════════════════════════════
   DocumentAnnotator — visionneuse + annotation découplée
   Architecture :
     ┌─ page-container ──────────────────────────────────────────────┐
     │  ┌─ doc-layer ────────────────────────┐                       │
     │  │  iframe / img / placeholder        │  ← toujours visible   │
     │  │  (pointer-events: auto en select)  │                       │
     │  └────────────────────────────────────┘                       │
     │  ┌─ annotation-overlay ───────────────┐                       │
     │  │  SVG annotations persistées        │  ← z-index: 10        │
     │  │  canvas dessin temps-réel          │  ← z-index: 11        │
     │  │  div pins (commentaires/notes)     │  ← z-index: 12        │
     │  └────────────────────────────────────┘                       │
     └───────────────────────────────────────────────────────────────┘
   La couche overlay reçoit les événements pointeur SEULEMENT quand
   tool ≠ 'select' → en mode select, l'iframe est interactive (scroll PDF).
════════════════════════════════════════════════════════════════════════════ */

export interface AnnotatedDoc {
  nom: string;
  ext: string;
  taille?: string;
  url?: string;
  file?: File; // optionnel : objet File natif pour un rendu sans fetch
}

type Tool = 'select' | 'comment' | 'highlight' | 'note' | 'text' | 'pen';

type RevisionStatut = 'pending' | 'accepted' | 'rejected';

interface Annotation {
  id: string;
  type: Tool;
  x: number; y: number;           // % dans la page
  w?: number; h?: number;         // % pour highlight
  text?: string;
  color: string;
  author: string;
  at: string;
  points?: { x: number; y: number }[]; // chemins SVG stylo
  statut?: RevisionStatut;        // mode révision Word
}

const REVISION_CFG: Record<RevisionStatut, { label: string; bg: string; fg: string; dot: string }> = {
  pending:  { label: 'En attente', bg: '#FFFBEB', fg: '#92400E', dot: '#F59E0B' },
  accepted: { label: 'Accepté',    bg: '#F0FDF4', fg: '#15803D', dot: '#22C55E' },
  rejected: { label: 'Rejeté',     bg: '#FFF1F2', fg: '#B91C1C', dot: '#EF4444' },
};

const TOOLS: { id: Tool; Icon: typeof MousePointer2; label: string; hint: string }[] = [
  { id: 'select',    Icon: MousePointer2,    label: 'Sélection', hint: 'Cliquez une annotation pour l\'éditer / faire défiler le document' },
  { id: 'comment',   Icon: MessageSquarePlus, label: 'Commentaire', hint: 'Cliquez sur le document pour épingler un commentaire' },
  { id: 'highlight', Icon: Highlighter,       label: 'Surligner', hint: 'Glissez pour surligner une zone' },
  { id: 'note',      Icon: StickyNote,        label: 'Note', hint: 'Cliquez pour ajouter une note autocollante' },
  { id: 'text',      Icon: Type,              label: 'Texte', hint: 'Cliquez pour ajouter du texte libre' },
  { id: 'pen',       Icon: Pen,               label: 'Stylo', hint: 'Glissez pour dessiner librement' },
];
const COLORS = ['#F47920', '#EF3340', '#16A34A', '#1B4F8A', '#8B5CF6', '#FACC15'];

const EXT_COLOR: Record<string, string> = {
  pdf: '#EF3340', xlsx: '#16A34A', xls: '#16A34A',
  png: '#8B5CF6', jpg: '#8B5CF6', jpeg: '#8B5CF6', gif: '#8B5CF6',
  docx: '#1B4F8A', doc: '#1B4F8A',
};

function newId() { return `ann_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`; }
function nowLabel() {
  return new Date().toLocaleString('fr-FR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });
}

/* ── Composant principal ─────────────────────────────────────────────────── */
export default function DocumentAnnotator({
  doc,
  onClose,
  author = 'Utilisateur',
}: {
  doc: AnnotatedDoc;
  onClose: () => void;
  author?: string;
}) {
  /* ── Clé localStorage unique par document ── */
  const annKey = `sigepp-annotations-${doc.nom.replace(/[^a-z0-9]/gi, '_').toLowerCase()}`;

  /* ── État ── */
  const [tool, setTool]               = useState<Tool>('select');
  const [color, setColor]             = useState(COLORS[0]);
  const [zoom, setZoom]               = useState(1);
  const [annotations, setAnnotations] = useState<Annotation[]>(() => {
    // Charge les annotations persistées au montage
    if (typeof window === 'undefined') return [];
    try {
      const raw = localStorage.getItem(`sigepp-annotations-${doc.nom.replace(/[^a-z0-9]/gi, '_').toLowerCase()}`);
      return raw ? JSON.parse(raw) : [];
    } catch { return []; }
  });
  const [activeId, setActiveId]       = useState<string | null>(null);
  const [saved, setSaved]             = useState(false);
  const [showRevisions, setShowRevisions] = useState(false);

  /* Helpers mode révision */
  const setStatut = useCallback((id: string, statut: RevisionStatut) => {
    setAnnotations(prev => prev.map(a => a.id === id ? { ...a, statut } : a));
  }, []);
  const acceptAll = useCallback(() => {
    setAnnotations(prev => prev.map(a => ({ ...a, statut: 'accepted' as RevisionStatut })));
  }, []);
  const rejectAll = useCallback(() => {
    setAnnotations(prev => prev.map(a => ({ ...a, statut: 'rejected' as RevisionStatut })));
  }, []);
  const pendingCount = annotations.filter(a => !a.statut || a.statut === 'pending').length;

  /* Refs pour le dessin temps-réel */
  const pageRef   = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const drawing   = useRef<{
    active: boolean;
    startPct: { x: number; y: number };
    points: { x: number; y: number }[];
  }>({ active: false, startPct: { x: 0, y: 0 }, points: [] });

  /* Initialise le canvas quand zoom change */
  useEffect(() => {
    const canvas = canvasRef.current;
    const page   = pageRef.current;
    if (!canvas || !page) return;
    canvas.width  = page.offsetWidth;
    canvas.height = page.offsetHeight;
    clearCanvas();
  }, [zoom]);

  function clearCanvas() {
    const ctx = canvasRef.current?.getContext('2d');
    if (ctx && canvasRef.current) ctx.clearRect(0, 0, canvasRef.current.width, canvasRef.current.height);
  }

  /* Convertit un événement souris en coordonnées % de la page */
  function pct(e: React.MouseEvent | MouseEvent): { x: number; y: number } {
    const el = pageRef.current;
    if (!el) return { x: 0, y: 0 };
    const r = el.getBoundingClientRect();
    return {
      x: Math.max(0, Math.min(100, ((e.clientX - r.left) / r.width) * 100)),
      y: Math.max(0, Math.min(100, ((e.clientY - r.top)  / r.height) * 100)),
    };
  }

  /* px absolus depuis % */
  function pxFromPct(px: number, py: number) {
    const el = pageRef.current;
    if (!el) return { x: 0, y: 0 };
    return { x: (px / 100) * el.offsetWidth, y: (py / 100) * el.offsetHeight };
  }

  /* ── Gestion pointer sur l'overlay ── */
  const onOverlayDown = useCallback((e: React.MouseEvent) => {
    if (tool === 'select') return;
    e.preventDefault();
    const p = pct(e);

    if (tool === 'highlight' || tool === 'pen') {
      drawing.current = { active: true, startPct: p, points: [p] };
    } else {
      /* comment / note / text → place immédiatement */
      const ann: Annotation = {
        id: newId(), type: tool, x: p.x, y: p.y,
        text: '', color, author, at: nowLabel(), statut: 'pending',
      };
      setAnnotations(prev => [...prev, ann]);
      setActiveId(ann.id);
      setSaved(false);
    }
  }, [tool, color, author]);

  const onOverlayMove = useCallback((e: React.MouseEvent) => {
    if (!drawing.current.active) return;
    const p = pct(e);
    drawing.current.points.push(p);

    const canvas = canvasRef.current;
    const ctx    = canvas?.getContext('2d');
    if (!ctx || !canvas) return;

    if (tool === 'pen') {
      /* Dessin temps-réel du stylo */
      const pts = drawing.current.points;
      if (pts.length < 2) return;
      const el = pageRef.current!;
      const last = pts[pts.length - 2];
      const curr = pts[pts.length - 1];
      ctx.beginPath();
      ctx.strokeStyle = color;
      ctx.lineWidth   = 2.5;
      ctx.lineCap     = 'round';
      ctx.lineJoin    = 'round';
      ctx.moveTo(last.x / 100 * el.offsetWidth, last.y / 100 * el.offsetHeight);
      ctx.lineTo(curr.x / 100 * el.offsetWidth, curr.y / 100 * el.offsetHeight);
      ctx.stroke();
    } else if (tool === 'highlight') {
      /* Aperçu du rectangle de surlignage */
      const { startPct } = drawing.current;
      const el = pageRef.current!;
      clearCanvas();
      const sx = startPct.x / 100 * el.offsetWidth;
      const sy = startPct.y / 100 * el.offsetHeight;
      const ex = p.x / 100 * el.offsetWidth;
      const ey = p.y / 100 * el.offsetHeight;
      ctx.fillStyle = `${color}55`;
      ctx.strokeStyle = color;
      ctx.lineWidth = 1;
      ctx.fillRect(Math.min(sx, ex), Math.min(sy, ey), Math.abs(ex - sx), Math.abs(ey - sy));
      ctx.strokeRect(Math.min(sx, ex), Math.min(sy, ey), Math.abs(ex - sx), Math.abs(ey - sy));
    }
  }, [tool, color]);

  const onOverlayUp = useCallback((e: React.MouseEvent) => {
    if (!drawing.current.active) return;
    drawing.current.active = false;
    clearCanvas();

    const p = pct(e);

    if (tool === 'pen') {
      const pts = [...drawing.current.points, p];
      if (pts.length > 1) {
        setAnnotations(prev => [...prev, {
          id: newId(), type: 'pen', x: 0, y: 0,
          points: pts, color, author, at: nowLabel(), statut: 'pending',
        }]);
        setSaved(false);
      }
    } else if (tool === 'highlight') {
      const { startPct } = drawing.current;
      const w = Math.abs(p.x - startPct.x);
      const h = Math.abs(p.y - startPct.y);
      if (w > 0.5 && h > 0.2) {
        setAnnotations(prev => [...prev, {
          id: newId(), type: 'highlight',
          x: Math.min(startPct.x, p.x), y: Math.min(startPct.y, p.y),
          w, h: Math.max(h, 1.5),
          color, author, at: nowLabel(), text: '', statut: 'pending',
        }]);
        setSaved(false);
      }
    }
  }, [tool, color, author]);

  /* ── CRUD annotations ── */
  const updateText = (id: string, text: string) => {
    setAnnotations(prev => prev.map(a => a.id === id ? { ...a, text } : a));
    setSaved(false);
  };
  const deleteAnn = (id: string) => {
    setAnnotations(prev => prev.filter(a => a.id !== id));
    if (activeId === id) setActiveId(null);
    setSaved(false);
  };

  const handleSave = useCallback(() => {
    // Persiste dans localStorage
    try { localStorage.setItem(annKey, JSON.stringify(annotations)); } catch { /* quota */ }
    setSaved(true);
    setTimeout(() => setSaved(false), 2500);
  }, [annKey, annotations]);

  /* Auto-sauvegarde à chaque modification d'annotation */
  useEffect(() => {
    if (annotations.length === 0) return; // ne pas écraser si on vient juste d'ouvrir
    try { localStorage.setItem(annKey, JSON.stringify(annotations)); } catch { /* quota */ }
  }, [annotations, annKey]);

  const exportNotes = () => {
    const lines = annotations.map((a, i) =>
      `${i + 1}. [${a.type.toUpperCase()}] ${a.text || '(sans texte)'} — ${a.author}, ${a.at}`
    ).join('\n');
    const content = `ANNOTATIONS — ${doc.nom}\nExporté le ${new Date().toLocaleString('fr-FR')}\n\n${lines || 'Aucune annotation.'}`;
    const a = document.createElement('a');
    a.href = 'data:text/plain;charset=utf-8,' + encodeURIComponent(content);
    a.download = `annotations_${doc.nom.replace(/\.[^.]+$/, '')}.txt`;
    a.click();
  };

  const extColor = EXT_COLOR[doc.ext?.toLowerCase()] ?? '#1B4F8A';
  const overlayCaptures = tool !== 'select'; /* overlay reçoit pointeur seulement en mode annotation */

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 600,
      display: 'flex', flexDirection: 'column',
      background: '#1E293B', fontFamily: 'inherit',
    }}>
      {/* ── Barre supérieure ── */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: 12,
        padding: '10px 18px', background: '#0F172A', flexShrink: 0,
        borderBottom: '1px solid #1E293B',
      }}>
        <div style={{ width: 32, height: 32, borderRadius: 8, background: `${extColor}22`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, border: `1px solid ${extColor}44` }}>
          <span style={{ fontSize: 9, fontWeight: 800, color: extColor, textTransform: 'uppercase' }}>{doc.ext}</span>
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 13.5, fontWeight: 700, color: '#fff', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{doc.nom}</div>
          <div style={{ fontSize: 10, color: '#64748B' }}>{doc.taille ?? '—'} · {annotations.length} annotation{annotations.length > 1 ? 's' : ''}</div>
        </div>

        {/* Zoom */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 4, background: '#1E293B', borderRadius: 7, padding: '3px 4px' }}>
          <button onClick={() => setZoom(z => Math.max(0.5, +(z - 0.1).toFixed(1)))} style={darkBtn}><ZoomOut size={14} /></button>
          <span style={{ fontSize: 11, color: '#94A3B8', width: 40, textAlign: 'center' }}>{Math.round(zoom * 100)}%</span>
          <button onClick={() => setZoom(z => Math.min(2.5, +(z + 0.1).toFixed(1)))} style={darkBtn}><ZoomIn size={14} /></button>
        </div>

        <button onClick={handleSave} style={{
          display: 'flex', alignItems: 'center', gap: 6, padding: '7px 14px',
          borderRadius: 7, border: 'none', cursor: 'pointer', fontFamily: 'inherit',
          background: saved ? '#059669' : '#F47920', color: '#fff', fontSize: 12, fontWeight: 700,
          transition: 'background 0.2s',
        }}>
          {saved ? <><CheckCircle size={13} /> Enregistré</> : <><Save size={13} /> Enregistrer</>}
        </button>
        <button onClick={exportNotes} style={{ ...darkBtn, padding: '7px 12px', gap: 6, display: 'flex', alignItems: 'center', border: '1px solid #334155', borderRadius: 7, fontSize: 12, fontWeight: 600, color: '#CBD5E1' }}>
          <Download size={13} /> Annotations
        </button>
        <button onClick={() => setShowRevisions(v => !v)} title="Panneau révisions (mode Word)" style={{
          display: 'flex', alignItems: 'center', gap: 6, padding: '7px 12px',
          borderRadius: 7, border: '1px solid #334155', cursor: 'pointer', fontFamily: 'inherit',
          background: showRevisions ? '#1B4F8A' : 'transparent', color: showRevisions ? '#fff' : '#CBD5E1',
          fontSize: 12, fontWeight: 600,
        }}>
          <ListChecks size={13} /> Révisions {pendingCount > 0 && <span style={{ background: '#F59E0B', color: '#000', borderRadius: 10, padding: '0 5px', fontSize: 10 }}>{pendingCount}</span>}
        </button>
        <button onClick={onClose} title="Fermer" style={{ ...darkBtn, padding: 8, marginLeft: 4 }}><X size={18} /></button>
      </div>

      {/* ── Barre d'outils ── */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap',
        padding: '8px 18px', background: '#162032', flexShrink: 0,
        borderBottom: '1px solid #1E293B',
      }}>
        {TOOLS.map(({ id, Icon, label }) => (
          <button key={id} onClick={() => setTool(id)} title={label}
            style={{
              display: 'flex', alignItems: 'center', gap: 6, padding: '6px 11px',
              borderRadius: 7, border: 'none', cursor: 'pointer', fontFamily: 'inherit',
              fontSize: 11.5, fontWeight: 600, transition: 'background 0.1s',
              background: tool === id ? '#F47920' : '#1E3A5F',
              color: tool === id ? '#fff' : '#94A3B8',
            }}>
            <Icon size={14} /> {label}
          </button>
        ))}
        <div style={{ width: 1, height: 22, background: '#334155', margin: '0 4px' }} />
        {COLORS.map(c => (
          <button key={c} onClick={() => setColor(c)} title="Couleur"
            style={{
              width: 20, height: 20, borderRadius: '50%', background: c, border: 'none', cursor: 'pointer', flexShrink: 0,
              outline: color === c ? `3px solid ${c}` : '2px solid transparent',
              outlineOffset: '2px', transition: 'outline 0.1s',
            }}
          />
        ))}
        <div style={{ marginLeft: 'auto', fontSize: 10.5, color: '#64748B', fontStyle: 'italic' }}>
          {TOOLS.find(t => t.id === tool)?.hint}
        </div>
      </div>

      {/* ── Corps : document + panneau révisions ── */}
      <div style={{ flex: 1, display: 'flex', overflow: 'hidden' }}>

        {/* Zone document */}
        <div style={{ flex: 1, overflow: 'auto', padding: 28, display: 'flex', justifyContent: 'center', alignItems: 'flex-start', background: '#1A2840' }}>
          <div
            ref={pageRef}
            style={{
              position: 'relative',
              width: 720 * zoom,
              minHeight: 940 * zoom,
              background: '#fff',
              borderRadius: 4,
              boxShadow: '0 12px 48px rgba(0,0,0,0.50)',
              flexShrink: 0,
              overflow: 'hidden',
            }}
          >
            {/* ── Couche 1 : document ── */}
            <DocContent doc={doc} overlayCaptures={overlayCaptures} />

            {/* ── Couche 2 : annotations SVG persistées ── */}
            <svg
              viewBox="0 0 100 100"
              preserveAspectRatio="none"
              style={{
                position: 'absolute', inset: 0,
                width: '100%', height: '100%',
                pointerEvents: 'none', zIndex: 10,
                overflow: 'visible',
              }}
            >
              {annotations.map(a => {
                if (a.type === 'highlight') {
                  return (
                    <rect
                      key={a.id}
                      x={a.x} y={a.y} width={a.w} height={a.h}
                      fill={`${a.color}55`}
                      stroke={activeId === a.id ? a.color : 'transparent'}
                      strokeWidth={0.3}
                      style={{ cursor: 'pointer', pointerEvents: 'auto' }}
                      onClick={() => setActiveId(a.id)}
                    />
                  );
                }
                if (a.type === 'pen' && a.points) {
                  const d = a.points.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x} ${p.y}`).join(' ');
                  return (
                    <path key={a.id} d={d} fill="none"
                      stroke={a.color} strokeWidth={0.5}
                      strokeLinecap="round" strokeLinejoin="round"
                      style={{ pointerEvents: 'none' }}
                    />
                  );
                }
                return null;
              })}
            </svg>

            {/* ── Couche 3 : canvas dessin temps-réel ── */}
            <canvas
              ref={canvasRef}
              style={{
                position: 'absolute', inset: 0,
                width: '100%', height: '100%',
                pointerEvents: 'none', zIndex: 11,
              }}
            />

            {/* ── Couche 4 : pins (commentaires / notes / textes) ── */}
            <div style={{ position: 'absolute', inset: 0, zIndex: 12, pointerEvents: 'none' }}>
              {annotations
                .filter(a => ['comment', 'note', 'text'].includes(a.type))
                .map(a => (
                  <Pin
                    key={a.id}
                    ann={a}
                    active={activeId === a.id}
                    onActivate={() => setActiveId(a.id)}
                    onTextChange={updateText}
                  />
                ))}
            </div>

            {/* ── Couche 5 : overlay transparent (capture clics annotation) ── */}
            {overlayCaptures && (
              <div
                onMouseDown={onOverlayDown}
                onMouseMove={onOverlayMove}
                onMouseUp={onOverlayUp}
                onMouseLeave={onOverlayUp}
                style={{
                  position: 'absolute', inset: 0, zIndex: 13,
                  cursor: tool === 'highlight' || tool === 'pen' ? 'crosshair' : 'copy',
                }}
              />
            )}
          </div>
        </div>

        {/* ── Panneau annotations / révisions ── */}
        <aside style={{
          width: 300, background: '#0F172A', color: '#fff',
          flexShrink: 0, display: 'flex', flexDirection: 'column',
          borderLeft: '1px solid #1E293B',
        }}>
          {/* En-tête panneau */}
          <div style={{
            padding: '10px 14px', borderBottom: '1px solid #1E293B',
            display: 'flex', flexDirection: 'column', gap: 6,
          }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <span style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.07em', color: '#64748B' }}>
                {showRevisions ? `Révisions (${annotations.length})` : `Annotations (${annotations.length})`}
              </span>
              {annotations.length > 0 && !showRevisions && (
                <button onClick={() => { setAnnotations([]); setActiveId(null); setSaved(false); }}
                  style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#475569', fontSize: 10, display: 'flex', alignItems: 'center', gap: 3 }}>
                  <Trash2 size={11} /> Supprimer tout
                </button>
              )}
            </div>
            {/* Boutons Accept/Reject All — mode révision uniquement */}
            {showRevisions && annotations.length > 0 && (
              <div style={{ display: 'flex', gap: 6 }}>
                <button onClick={acceptAll} style={{
                  flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 5,
                  padding: '5px 8px', borderRadius: 6, border: 'none', cursor: 'pointer',
                  background: '#15803D', color: '#fff', fontSize: 11, fontWeight: 700,
                }}>
                  <Check size={11} /> Accepter tout
                </button>
                <button onClick={rejectAll} style={{
                  flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 5,
                  padding: '5px 8px', borderRadius: 6, border: 'none', cursor: 'pointer',
                  background: '#B91C1C', color: '#fff', fontSize: 11, fontWeight: 700,
                }}>
                  <XCircle size={11} /> Rejeter tout
                </button>
              </div>
            )}
            {/* Stats révision */}
            {showRevisions && annotations.length > 0 && (
              <div style={{ display: 'flex', gap: 4, fontSize: 10 }}>
                {(['pending', 'accepted', 'rejected'] as RevisionStatut[]).map(s => {
                  const count = annotations.filter(a => (a.statut ?? 'pending') === s).length;
                  const cfg = REVISION_CFG[s];
                  return count > 0 ? (
                    <span key={s} style={{ padding: '2px 6px', borderRadius: 10, background: cfg.bg, color: cfg.fg, fontWeight: 700 }}>
                      {count} {cfg.label}
                    </span>
                  ) : null;
                })}
              </div>
            )}
          </div>

          <div style={{ flex: 1, overflowY: 'auto', padding: 10, display: 'flex', flexDirection: 'column', gap: 6 }}>
            {annotations.length === 0 && (
              <div style={{ padding: '32px 16px', textAlign: 'center', color: '#475569', fontSize: 12, lineHeight: 1.6 }}>
                <MessageSquarePlus size={28} style={{ margin: '0 auto 12px', display: 'block', color: '#334155' }} />
                Sélectionnez un outil et cliquez sur le document pour annoter.
              </div>
            )}
            {annotations.map((a, i) => (
              <AnnCard key={a.id} ann={a} index={i} active={activeId === a.id}
                onActivate={() => setActiveId(a.id)}
                onTextChange={updateText}
                onDelete={deleteAnn}
                showRevision={showRevisions}
                onSetStatut={setStatut}
              />
            ))}
          </div>
        </aside>
      </div>
    </div>
  );
}

/* ── Pin overlay (commentaire / note / texte) ─────────────────────────── */
function Pin({ ann, active, onActivate, onTextChange }: {
  ann: Annotation; active: boolean;
  onActivate: () => void;
  onTextChange: (id: string, text: string) => void;
}) {
  return (
    <div
      style={{
        position: 'absolute', left: `${ann.x}%`, top: `${ann.y}%`,
        transform: 'translate(-6px, -6px)',
        zIndex: active ? 20 : 15,
        pointerEvents: 'auto',
      }}
      onClick={e => { e.stopPropagation(); onActivate(); }}
    >
      {ann.type === 'comment' && (
        <div style={{
          width: 26, height: 26, borderRadius: '50% 50% 50% 2px',
          background: ann.color, display: 'flex', alignItems: 'center', justifyContent: 'center',
          boxShadow: `0 2px 8px ${ann.color}66`,
          border: active ? '2px solid #fff' : '2px solid transparent',
          cursor: 'pointer',
        }}>
          <MessageSquarePlus size={13} color="#fff" />
        </div>
      )}
      {ann.type === 'note' && (
        <div style={{
          minWidth: 140, maxWidth: 200,
          background: ann.color, borderRadius: '4px 4px 4px 0', padding: 8,
          boxShadow: `0 4px 12px ${ann.color}66`,
          border: active ? '2px solid #fff' : '2px solid transparent',
          cursor: 'pointer',
        }}>
          <textarea
            autoFocus={active}
            value={ann.text}
            onChange={e => onTextChange(ann.id, e.target.value)}
            onClick={e => e.stopPropagation()}
            placeholder="Note…"
            style={{ width: '100%', border: 'none', background: 'transparent', resize: 'none', fontSize: 11, color: '#fff', outline: 'none', fontFamily: 'inherit', minHeight: 48 }}
          />
        </div>
      )}
      {ann.type === 'text' && (
        <input
          autoFocus={active}
          value={ann.text}
          onChange={e => onTextChange(ann.id, e.target.value)}
          onClick={e => e.stopPropagation()}
          placeholder="Texte…"
          style={{ border: 'none', background: 'transparent', fontSize: 16, fontWeight: 700, color: ann.color, outline: 'none', fontFamily: 'inherit', minWidth: 60, cursor: 'text', textShadow: '0 1px 3px rgba(0,0,0,0.15)' }}
        />
      )}
    </div>
  );
}

/* ── Carte annotation dans le panneau latéral ────────────────────────── */
function AnnCard({ ann, index, active, onActivate, onTextChange, onDelete, showRevision, onSetStatut }: {
  ann: Annotation; index: number; active: boolean;
  onActivate: () => void;
  onTextChange: (id: string, text: string) => void;
  onDelete: (id: string) => void;
  showRevision?: boolean;
  onSetStatut?: (id: string, s: RevisionStatut) => void;
}) {
  const typeLabel: Record<string, string> = {
    comment: 'Commentaire', highlight: 'Surlignage',
    note: 'Note', pen: 'Dessin', text: 'Texte',
  };
  const statut: RevisionStatut = ann.statut ?? 'pending';
  const cfg = REVISION_CFG[statut];
  return (
    <div
      onClick={onActivate}
      style={{
        background: active ? '#1E293B' : '#162032',
        borderRadius: 8, padding: 10, cursor: 'pointer',
        border: active ? `1px solid ${ann.color}` : showRevision ? `1px solid ${cfg.dot}44` : '1px solid #1E293B',
        transition: 'border-color 0.12s',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 6 }}>
        <span style={{ width: 9, height: 9, borderRadius: '50%', background: showRevision ? cfg.dot : ann.color, flexShrink: 0 }} />
        <span style={{ fontSize: 10.5, fontWeight: 700, color: '#CBD5E1', flex: 1 }}>
          {index + 1}. {typeLabel[ann.type] ?? ann.type}
        </span>
        {showRevision && (
          <span style={{ fontSize: 9, padding: '1px 5px', borderRadius: 8, background: cfg.bg, color: cfg.fg, fontWeight: 700 }}>
            {cfg.label}
          </span>
        )}
        <button onClick={e => { e.stopPropagation(); onDelete(ann.id); }}
          style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#475569', display: 'flex', padding: 2, borderRadius: 4 }}
          onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.color = '#EF4444'; }}
          onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.color = '#475569'; }}
        >
          <Trash2 size={12} />
        </button>
      </div>
      {['comment', 'text', 'note'].includes(ann.type) && (
        <input
          value={ann.text}
          onChange={e => onTextChange(ann.id, e.target.value)}
          onClick={e => e.stopPropagation()}
          placeholder="Saisir le commentaire…"
          style={{
            width: '100%', background: '#0F172A',
            border: '1px solid #334155', borderRadius: 5,
            padding: '5px 7px', fontSize: 11.5, color: '#E2E8F0',
            outline: 'none', fontFamily: 'inherit', boxSizing: 'border-box',
          }}
        />
      )}
      <div style={{ fontSize: 9, color: '#475569', marginTop: 5 }}>{ann.author} · {ann.at}</div>
      {/* Boutons accept/reject par annotation */}
      {showRevision && onSetStatut && statut === 'pending' && (
        <div style={{ display: 'flex', gap: 4, marginTop: 7 }} onClick={e => e.stopPropagation()}>
          <button onClick={() => onSetStatut(ann.id, 'accepted')} style={{
            flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 4,
            padding: '4px 0', borderRadius: 5, border: 'none', cursor: 'pointer',
            background: '#15803D', color: '#fff', fontSize: 10, fontWeight: 700,
          }}>
            <Check size={10} /> Accepter
          </button>
          <button onClick={() => onSetStatut(ann.id, 'rejected')} style={{
            flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 4,
            padding: '4px 0', borderRadius: 5, border: 'none', cursor: 'pointer',
            background: '#B91C1C', color: '#fff', fontSize: 10, fontWeight: 700,
          }}>
            <XCircle size={10} /> Rejeter
          </button>
        </div>
      )}
      {showRevision && onSetStatut && statut !== 'pending' && (
        <button onClick={e => { e.stopPropagation(); onSetStatut(ann.id, 'pending'); }} style={{
          marginTop: 5, width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 4,
          padding: '3px 0', borderRadius: 5, border: '1px solid #334155', cursor: 'pointer',
          background: 'transparent', color: '#64748B', fontSize: 9, fontWeight: 600,
        }}>
          <Clock size={9} /> Remettre en attente
        </button>
      )}
    </div>
  );
}

/* ══════════════════════════════════════════════════════════════════════════
   VIEWERS RÉELS — XLSX · DOCX · ZIP · DWG · Image · PDF
   ══════════════════════════════════════════════════════════════════════════ */

/* ── XLSX Viewer (SheetJS) ─────────────────────────────────────────────── */
function XLSXViewer({ doc }: { doc: AnnotatedDoc }) {
  const [sheets, setSheets]     = useState<string[]>([]);
  const [activeIdx, setActive]  = useState(0);
  const [tableHTML, setHTML]    = useState<string>('');
  const [loading, setLoading]   = useState(true);
  const [error, setError]       = useState<string | null>(null);
  const wbRef = useRef<unknown>(null);

  useEffect(() => {
    async function load() {
      setLoading(true); setError(null);
      try {
        const XLSX = await import('xlsx');
        let buf: ArrayBuffer;
        if (doc.file) {
          buf = await doc.file.arrayBuffer();
        } else if (doc.url) {
          const r = await fetch(doc.url);
          if (!r.ok) throw new Error(`HTTP ${r.status}`);
          buf = await r.arrayBuffer();
        } else throw new Error('Aucune source');

        const wb = XLSX.read(buf, { type: 'array' });
        wbRef.current = wb;
        setSheets(wb.SheetNames);
        const ws = wb.Sheets[wb.SheetNames[0]];
        setHTML(XLSX.utils.sheet_to_html(ws, { id: 'xls-tbl' }));
      } catch (e: unknown) {
        setError(e instanceof Error ? e.message : 'Erreur chargement');
      } finally { setLoading(false); }
    }
    load();
  }, [doc.url, doc.file]);

  async function switchSheet(idx: number) {
    setActive(idx);
    const XLSX = await import('xlsx');
    const wb = wbRef.current as import('xlsx').WorkBook | null;
    if (!wb) return;
    const ws = wb.Sheets[wb.SheetNames[idx]];
    setHTML(XLSX.utils.sheet_to_html(ws, { id: 'xls-tbl' }));
  }

  if (loading) return <ViewerSpinner label="Chargement tableur…" />;
  if (error)   return <ViewerError label={error} nom={doc.nom} url={doc.url} />;

  return (
    <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', overflow: 'hidden', background: '#fff' }}>
      {/* Onglets feuilles */}
      {sheets.length > 1 && (
        <div style={{ display: 'flex', gap: 2, padding: '6px 12px', background: '#F1F5F9', borderBottom: '1px solid #E2E8F0', flexWrap: 'wrap' }}>
          {sheets.map((s, i) => (
            <button key={s} onClick={() => switchSheet(i)}
              style={{ padding: '4px 12px', borderRadius: '6px 6px 0 0', fontSize: 11, fontWeight: i === activeIdx ? 700 : 400,
                background: i === activeIdx ? '#fff' : 'transparent', border: i === activeIdx ? '1px solid #CBD5E1' : '1px solid transparent',
                borderBottom: 'none', color: i === activeIdx ? '#1B4F8A' : '#64748B', cursor: 'pointer' }}>
              {s}
            </button>
          ))}
        </div>
      )}
      {/* Tableau */}
      <div style={{ flex: 1, overflow: 'auto', padding: '0 0 20px 0' }}>
        <style>{`
          #xls-tbl { border-collapse: collapse; font-size: 11px; width: 100%; }
          #xls-tbl td, #xls-tbl th { border: 1px solid #E2E8F0; padding: 5px 8px; white-space: nowrap; color: #334155; }
          #xls-tbl tr:first-child td, #xls-tbl tr:first-child th { background: #F1F5F9; font-weight: 700; color: #1B4F8A; position: sticky; top: 0; }
          #xls-tbl tr:nth-child(even) td { background: #FAFAFA; }
        `}</style>
        <div dangerouslySetInnerHTML={{ __html: tableHTML }} style={{ pointerEvents: 'none' }} />
      </div>
    </div>
  );
}

/* ── DOCX Viewer (mammoth) ─────────────────────────────────────────────── */
function DOCXViewer({ doc }: { doc: AnnotatedDoc }) {
  const [html, setHtml]       = useState<string>('');
  const [loading, setLoading] = useState(true);
  const [error, setError]     = useState<string | null>(null);

  useEffect(() => {
    async function load() {
      setLoading(true); setError(null);
      try {
        const mammoth = await import('mammoth');
        let buf: ArrayBuffer;
        if (doc.file) {
          buf = await doc.file.arrayBuffer();
        } else if (doc.url) {
          const r = await fetch(doc.url);
          if (!r.ok) throw new Error(`HTTP ${r.status}`);
          buf = await r.arrayBuffer();
        } else throw new Error('Aucune source');

        const result = await mammoth.convertToHtml({ arrayBuffer: buf });
        setHtml(result.value || '<p style="color:#94A3B8">Document vide ou non lisible.</p>');
      } catch (e: unknown) {
        setError(e instanceof Error ? e.message : 'Erreur chargement');
      } finally { setLoading(false); }
    }
    load();
  }, [doc.url, doc.file]);

  if (loading) return <ViewerSpinner label="Chargement document Word…" />;
  if (error)   return <ViewerError label={error} nom={doc.nom} url={doc.url} />;

  return (
    <div style={{ position: 'absolute', inset: 0, overflow: 'auto', background: '#F8FAFC', padding: '0 0 32px 0' }}>
      <div style={{ maxWidth: 820, margin: '32px auto', background: '#fff', boxShadow: '0 2px 16px #0001', borderRadius: 6, padding: '56px 72px', pointerEvents: 'none' }}>
        <style>{`
          .docx-view h1,.docx-view h2,.docx-view h3 { color: #1B4F8A; margin: 1.2em 0 0.4em; }
          .docx-view h1 { font-size: 20px; font-weight: 800; }
          .docx-view h2 { font-size: 16px; font-weight: 700; }
          .docx-view h3 { font-size: 14px; font-weight: 600; }
          .docx-view p  { font-size: 13px; line-height: 1.8; color: #334155; margin: 0 0 0.7em; }
          .docx-view table { border-collapse: collapse; width: 100%; margin: 1em 0; }
          .docx-view td,.docx-view th { border: 1px solid #CBD5E1; padding: 6px 10px; font-size: 12px; }
          .docx-view th { background: #F1F5F9; font-weight: 700; color: #1B4F8A; }
          .docx-view ul,.docx-view ol { padding-left: 24px; margin: 0.5em 0; }
          .docx-view li { font-size: 13px; color: #334155; line-height: 1.7; }
          .docx-view strong { color: #0F172A; }
        `}</style>
        <div className="docx-view" dangerouslySetInnerHTML={{ __html: html }} />
      </div>
    </div>
  );
}

/* ── ZIP Viewer (JSZip) ────────────────────────────────────────────────── */
interface ZipNode { name: string; path: string; isDir: boolean; size?: number; children?: ZipNode[]; }

function ZIPViewer({ doc }: { doc: AnnotatedDoc }) {
  const [tree, setTree]       = useState<ZipNode[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError]     = useState<string | null>(null);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const zipRef = useRef<unknown>(null);

  useEffect(() => {
    async function load() {
      setLoading(true); setError(null);
      try {
        const JSZip = (await import('jszip')).default;
        let buf: ArrayBuffer;
        if (doc.file) buf = await doc.file.arrayBuffer();
        else if (doc.url) { const r = await fetch(doc.url); buf = await r.arrayBuffer(); }
        else throw new Error('Aucune source');

        const zip = await JSZip.loadAsync(buf);
        zipRef.current = zip;
        // Construire arbre de fichiers
        const nodes: ZipNode[] = [];
        zip.forEach((relPath, file) => {
          const parts = relPath.split('/').filter(Boolean);
          let cur = nodes;
          parts.forEach((part, i) => {
            const fullPath = parts.slice(0, i + 1).join('/');
            let node = cur.find(n => n.name === part);
            if (!node) {
              node = { name: part, path: fullPath, isDir: i < parts.length - 1 || file.dir, children: [] };
              cur.push(node);
            }
            if (i === parts.length - 1 && !file.dir) {
              node.isDir = false;
              node.size  = (file as { _data?: { uncompressedSize?: number } })._data?.uncompressedSize;
            }
            cur = node.children!;
          });
        });
        setTree(nodes);
        // Expand first level by default
        const firstDirs = nodes.filter(n => n.isDir).map(n => n.path);
        setExpanded(new Set(firstDirs));
      } catch (e: unknown) {
        setError(e instanceof Error ? e.message : 'Erreur ZIP');
      } finally { setLoading(false); }
    }
    load();
  }, [doc.url, doc.file]);

  function toggle(path: string) {
    setExpanded(prev => { const s = new Set(prev); s.has(path) ? s.delete(path) : s.add(path); return s; });
  }

  function fmtSize(b?: number) {
    if (!b) return '';
    if (b < 1024) return `${b} o`;
    if (b < 1048576) return `${(b/1024).toFixed(1)} Ko`;
    return `${(b/1048576).toFixed(1)} Mo`;
  }

  function fileIcon(name: string) {
    const e = name.split('.').pop()?.toLowerCase();
    if (!e) return '📄';
    if (['pdf'].includes(e)) return '📕';
    if (['xlsx','xls','csv'].includes(e)) return '📊';
    if (['docx','doc'].includes(e)) return '📘';
    if (['png','jpg','jpeg','gif','webp'].includes(e)) return '🖼️';
    if (['zip','rar','7z'].includes(e)) return '📦';
    return '📄';
  }

  function ZipNodeRow({ node, depth = 0 }: { node: ZipNode; depth?: number }) {
    const isOpen = expanded.has(node.path);
    return (
      <>
        <div onClick={() => node.isDir && toggle(node.path)}
          style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '5px 12px',
            paddingLeft: 12 + depth * 20, cursor: node.isDir ? 'pointer' : 'default',
            borderBottom: '1px solid #F1F5F9', background: depth === 0 ? '#FAFAFA' : '#fff',
            transition: 'background .12s' }}>
          <span style={{ fontSize: 15 }}>{node.isDir ? (isOpen ? '📂' : '📁') : fileIcon(node.name)}</span>
          <span style={{ fontSize: 12, color: node.isDir ? '#1B4F8A' : '#334155', fontWeight: node.isDir ? 700 : 400, flex: 1 }}>{node.name}</span>
          {!node.isDir && node.size != null && <span style={{ fontSize: 10, color: '#94A3B8' }}>{fmtSize(node.size)}</span>}
        </div>
        {node.isDir && isOpen && node.children?.map(c => <ZipNodeRow key={c.path} node={c} depth={depth + 1} />)}
      </>
    );
  }

  if (loading) return <ViewerSpinner label="Ouverture de l'archive…" />;
  if (error)   return <ViewerError label={error} nom={doc.nom} url={doc.url} />;

  const total = (() => { let n = 0; const count = (ns: ZipNode[]) => ns.forEach(nd => { if (!nd.isDir) n++; count(nd.children ?? []); }); count(tree); return n; })();

  return (
    <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', background: '#fff', overflow: 'hidden' }}>
      {/* Header */}
      <div style={{ padding: '12px 16px', background: '#1B4F8A', color: '#fff', display: 'flex', alignItems: 'center', gap: 10 }}>
        <span style={{ fontSize: 20 }}>📦</span>
        <div>
          <div style={{ fontWeight: 700, fontSize: 13 }}>{doc.nom}</div>
          <div style={{ fontSize: 11, opacity: 0.75 }}>{total} fichier(s)</div>
        </div>
        {doc.url && (
          <a href={doc.url} download={doc.nom}
            style={{ marginLeft: 'auto', padding: '5px 12px', borderRadius: 6, background: 'rgba(255,255,255,.15)', color: '#fff', fontSize: 11, textDecoration: 'none', fontWeight: 700 }}>
            Télécharger
          </a>
        )}
      </div>
      {/* Arbre */}
      <div style={{ flex: 1, overflow: 'auto' }}>
        {tree.map(n => <ZipNodeRow key={n.path} node={n} />)}
      </div>
    </div>
  );
}

/* ── DWG / DXF Viewer ──────────────────────────────────────────────────── */
function DWGViewer({ doc }: { doc: AnnotatedDoc }) {
  const [dwgHtml, setDwgHtml] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Tente de charger comme DXF (format texte lisible similaire à DWG)
    async function tryDXF() {
      if (!doc.url && !doc.file) { setLoading(false); return; }
      try {
        let text = '';
        if (doc.file) text = await doc.file.text();
        else { const r = await fetch(doc.url!); text = await r.text(); }
        // Vérifier si c'est un DXF (commence par "0\nSECTION" ou contient "AUTOCAD")
        if (text.slice(0, 50).includes('SECTION') || text.slice(0, 100).toUpperCase().includes('AUTOCAD')) {
          // Extraire infos de base du DXF
          const layers = [...new Set([...text.matchAll(/^LAYER\n[\s\S]*?^\s*8\n(.+)/gm)].map(m => m[1]?.trim()).filter(Boolean))];
          const entities = (text.match(/^(LINE|ARC|CIRCLE|POLYLINE|TEXT|MTEXT|INSERT|BLOCK)\s*$/gm) || []).length;
          setDwgHtml(`<div style="padding:24px">
            <div style="font-size:13px;color:#475569;margin-bottom:16px">Format DXF détecté — rendu vectoriel natif</div>
            <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px">
              <div style="background:#F1F5F9;border-radius:8px;padding:14px">
                <div style="font-size:11px;color:#94A3B8;font-weight:700;margin-bottom:6px">ENTITÉS CAO</div>
                <div style="font-size:28px;font-weight:800;color:#1B4F8A">${entities}</div>
              </div>
              <div style="background:#F1F5F9;border-radius:8px;padding:14px">
                <div style="font-size:11px;color:#94A3B8;font-weight:700;margin-bottom:6px">CALQUES</div>
                <div style="font-size:28px;font-weight:800;color:#16A34A">${layers.length || '?'}</div>
              </div>
            </div>
            ${layers.length ? `<div style="margin-top:16px">
              <div style="font-size:11px;font-weight:700;color:#64748B;margin-bottom:8px">Calques détectés</div>
              <div style="display:flex;flex-wrap:wrap;gap:6px">${layers.map(l => `<span style="background:#E0F2FE;color:#0369A1;font-size:11px;padding:3px 8px;border-radius:12px">${l}</span>`).join('')}</div>
            </div>` : ''}
          </div>`);
        }
        setLoading(false);
      } catch { setLoading(false); }
    }
    tryDXF();
  }, [doc.url, doc.file]);

  return (
    <div style={{ position: 'absolute', inset: 0, overflow: 'auto', background: '#0F172A' }}>
      {/* Header DWG */}
      <div style={{ padding: '20px 24px', background: '#1E293B', borderBottom: '1px solid #334155', display: 'flex', alignItems: 'center', gap: 14 }}>
        <div style={{ width: 44, height: 44, borderRadius: 10, background: '#F47920', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 22 }}>⚙️</div>
        <div>
          <div style={{ fontWeight: 800, fontSize: 14, color: '#F1F5F9' }}>{doc.nom}</div>
          <div style={{ fontSize: 11, color: '#94A3B8' }}>Fichier CAO — {doc.ext.toUpperCase()}</div>
        </div>
        {doc.url && (
          <a href={doc.url} download={doc.nom}
            style={{ marginLeft: 'auto', padding: '8px 16px', borderRadius: 8, background: '#F47920', color: '#fff', fontSize: 12, textDecoration: 'none', fontWeight: 700 }}>
            Ouvrir dans AutoCAD
          </a>
        )}
      </div>
      {/* Contenu */}
      <div style={{ padding: 24, color: '#CBD5E1' }}>
        {loading && <div style={{ textAlign: 'center', padding: 40, color: '#64748B' }}>Analyse du fichier…</div>}
        {!loading && dwgHtml && <div dangerouslySetInnerHTML={{ __html: dwgHtml }} style={{ color: '#CBD5E1' }} />}
        {!loading && !dwgHtml && (
          <>
            {/* Grille CAO simulée */}
            <svg viewBox="0 0 600 360" style={{ width: '100%', maxWidth: 600, margin: '0 auto', display: 'block', opacity: 0.6 }}>
              {/* Grille */}
              {Array.from({ length: 13 }).map((_, i) => (
                <line key={`v${i}`} x1={i * 50} y1={0} x2={i * 50} y2={360} stroke="#1E3A5F" strokeWidth={0.5} />
              ))}
              {Array.from({ length: 8 }).map((_, i) => (
                <line key={`h${i}`} x1={0} y1={i * 50} x2={600} y2={i * 50} stroke="#1E3A5F" strokeWidth={0.5} />
              ))}
              {/* Forme symbolique DWG */}
              <rect x={80} y={60} width={340} height={220} fill="none" stroke="#F47920" strokeWidth={2} />
              <rect x={120} y={100} width={100} height={80} fill="none" stroke="#3B82F6" strokeWidth={1.5} />
              <rect x={260} y={100} width={120} height={80} fill="none" stroke="#3B82F6" strokeWidth={1.5} />
              <line x1={80} y1={200} x2={420} y2={200} stroke="#16A34A" strokeWidth={1.5} strokeDasharray="8,4" />
              <circle cx={300} cy={210} r={30} fill="none" stroke="#EF3340" strokeWidth={1.5} />
              <text x={300} y={310} textAnchor="middle" fill="#64748B" fontSize={11} fontFamily="monospace">{doc.nom.replace(/\.[^.]+$/, '')}</text>
            </svg>
            <div style={{ textAlign: 'center', marginTop: 20 }}>
              <div style={{ fontSize: 13, color: '#64748B', marginBottom: 12 }}>Le format DWG nécessite AutoCAD ou un viewer CAO dédié.</div>
              <div style={{ display: 'flex', gap: 10, justifyContent: 'center', flexWrap: 'wrap' }}>
                {[
                  { label: 'Autodesk Viewer', url: 'https://viewer.autodesk.com' },
                  { label: 'DWG TrueView', url: 'https://www.autodesk.com/products/dwg-trueview' },
                  { label: 'Opendesk', url: 'https://opendesign.com' },
                ].map(({ label, url }) => (
                  <a key={label} href={url} target="_blank" rel="noopener noreferrer"
                    style={{ padding: '6px 14px', borderRadius: 6, background: '#1E293B', color: '#94A3B8', fontSize: 11, textDecoration: 'none', border: '1px solid #334155', fontWeight: 600 }}>
                    {label} ↗
                  </a>
                ))}
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

/* ── JSON Viewer ──────────────────────────────────────────────────────── */
function JSONViewer({ doc }: { doc: AnnotatedDoc }) {
  const [data, setData]       = useState<unknown>(null);
  const [raw, setRaw]         = useState<string>('');
  const [loading, setLoading] = useState(true);
  const [error, setError]     = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<'tree' | 'raw'>('tree');

  useEffect(() => {
    async function load() {
      setLoading(true);
      try {
        let text = '';
        if (doc.file) text = await doc.file.text();
        else if (doc.url) { const r = await fetch(doc.url); text = await r.text(); }
        else throw new Error('Aucune source');
        const parsed = JSON.parse(text);
        setData(parsed);
        setRaw(JSON.stringify(parsed, null, 2));
      } catch (e: unknown) {
        setError(e instanceof Error ? e.message : 'JSON invalide');
      } finally { setLoading(false); }
    }
    load();
  }, [doc.url, doc.file]);

  if (loading) return <ViewerSpinner label="Chargement JSON…" />;
  if (error)   return <ViewerError label={error} nom={doc.nom} url={doc.url} />;

  function JSONNode({ val, depth = 0 }: { val: unknown; depth?: number }) {
    if (val === null) return <span style={{ color: '#94A3B8' }}>null</span>;
    if (typeof val === 'boolean') return <span style={{ color: '#F59E0B' }}>{String(val)}</span>;
    if (typeof val === 'number') return <span style={{ color: '#34D399' }}>{val}</span>;
    if (typeof val === 'string') return <span style={{ color: '#F87171' }}>&quot;{val}&quot;</span>;
    if (Array.isArray(val)) {
      if (val.length === 0) return <span style={{ color: '#94A3B8' }}>[]</span>;
      return (
        <span>
          <span style={{ color: '#94A3B8' }}>[{val.length}] </span>
          {depth < 3 && val.slice(0, 8).map((v, i) => (
            <span key={i}>
              <span style={{ paddingLeft: (depth + 1) * 14, display: 'block', fontSize: 11 }}>
                <span style={{ color: '#64748B' }}>{i}: </span>
                <JSONNode val={v} depth={depth + 1} />
              </span>
            </span>
          ))}
          {val.length > 8 && <span style={{ paddingLeft: (depth + 1) * 14, display: 'block', fontSize: 11, color: '#64748B' }}>… {val.length - 8} de plus</span>}
        </span>
      );
    }
    if (typeof val === 'object' && val !== null) {
      const entries = Object.entries(val as Record<string, unknown>);
      if (entries.length === 0) return <span style={{ color: '#94A3B8' }}>{'{}'}</span>;
      return (
        <span>
          {entries.slice(0, depth < 2 ? 50 : 10).map(([k, v]) => (
            <span key={k} style={{ paddingLeft: (depth + 1) * 14, display: 'block', fontSize: 11.5 }}>
              <span style={{ color: '#60A5FA', fontWeight: 600 }}>{k}</span>
              <span style={{ color: '#94A3B8' }}>: </span>
              <JSONNode val={v} depth={depth + 1} />
            </span>
          ))}
          {entries.length > (depth < 2 ? 50 : 10) && <span style={{ paddingLeft: (depth + 1) * 14, display: 'block', fontSize: 11, color: '#64748B' }}>… {entries.length - 10} clés de plus</span>}
        </span>
      );
    }
    return <span style={{ color: '#CBD5E1' }}>{String(val)}</span>;
  }

  return (
    <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', background: '#0F172A', overflow: 'hidden' }}>
      {/* Header */}
      <div style={{ padding: '10px 16px', background: '#1E293B', borderBottom: '1px solid #334155', display: 'flex', alignItems: 'center', gap: 10 }}>
        <span style={{ fontSize: 18 }}>{ }</span>
        <div style={{ fontWeight: 700, fontSize: 13, color: '#F1F5F9', flex: 1 }}>{doc.nom}</div>
        <div style={{ display: 'flex', gap: 4 }}>
          {(['tree', 'raw'] as const).map(m => (
            <button key={m} onClick={() => setViewMode(m)}
              style={{ padding: '3px 10px', borderRadius: 4, fontSize: 11, fontWeight: 700, border: 'none', cursor: 'pointer',
                background: viewMode === m ? '#3B82F6' : '#334155', color: viewMode === m ? '#fff' : '#94A3B8' }}>
              {m === 'tree' ? '🌲 Arbre' : '📝 Brut'}
            </button>
          ))}
        </div>
      </div>
      {/* Contenu */}
      <div style={{ flex: 1, overflow: 'auto', padding: 16, fontFamily: 'monospace' }}>
        {viewMode === 'tree' ? (
          <div style={{ fontSize: 12, lineHeight: 1.7, color: '#CBD5E1' }}>
            <JSONNode val={data} />
          </div>
        ) : (
          <pre style={{ fontSize: 11.5, color: '#CBD5E1', margin: 0, whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>{raw}</pre>
        )}
      </div>
    </div>
  );
}

/* ── Text Viewer (TXT / CSV / Markdown) ──────────────────────────────── */
function TextViewer({ doc }: { doc: AnnotatedDoc }) {
  const [text, setText]       = useState<string>('');
  const [loading, setLoading] = useState(true);
  const ext = doc.ext?.toLowerCase() ?? '';

  useEffect(() => {
    async function load() {
      setLoading(true);
      try {
        let t = '';
        if (doc.file) t = await doc.file.text();
        else if (doc.url) { const r = await fetch(doc.url); t = await r.text(); }
        setText(t);
      } finally { setLoading(false); }
    }
    load();
  }, [doc.url, doc.file]);

  if (loading) return <ViewerSpinner label="Chargement…" />;

  const isCSV = ext === 'csv';
  if (isCSV) {
    // Rendu tableau pour CSV
    const lines = text.split('\n').filter(Boolean);
    const rows = lines.map(l => l.split(',').map(c => c.trim().replace(/^"|"$/g, '')));
    return (
      <div style={{ position: 'absolute', inset: 0, overflow: 'auto', background: '#fff' }}>
        <table style={{ borderCollapse: 'collapse', fontSize: 11, width: '100%' }}>
          {rows.map((r, ri) => (
            <tr key={ri} style={{ background: ri === 0 ? '#F1F5F9' : ri % 2 === 0 ? '#FAFAFA' : '#fff' }}>
              {r.map((c, ci) => ri === 0
                ? <th key={ci} style={{ border: '1px solid #E2E8F0', padding: '5px 8px', fontWeight: 700, color: '#1B4F8A', position: 'sticky', top: 0, background: '#F1F5F9' }}>{c}</th>
                : <td key={ci} style={{ border: '1px solid #E2E8F0', padding: '5px 8px', color: '#334155' }}>{c}</td>
              )}
            </tr>
          ))}
        </table>
      </div>
    );
  }

  return (
    <div style={{ position: 'absolute', inset: 0, overflow: 'auto', background: '#1E293B', padding: 24 }}>
      <pre style={{ fontSize: 12.5, color: '#CBD5E1', fontFamily: 'monospace', lineHeight: 1.7, margin: 0, whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>
        {text}
      </pre>
    </div>
  );
}

/* ── Helpers UI ───────────────────────────────────────────────────────── */
function ViewerSpinner({ label }: { label: string }) {
  return (
    <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 14, background: '#F8FAFC' }}>
      <div style={{ width: 36, height: 36, border: '3px solid #E2E8F0', borderTopColor: '#1B4F8A', borderRadius: '50%', animation: 'spin .8s linear infinite' }} />
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      <div style={{ fontSize: 12, color: '#64748B' }}>{label}</div>
    </div>
  );
}

function ViewerError({ label, nom, url }: { label: string; nom: string; url?: string }) {
  return (
    <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 14, padding: 40, background: '#FFF7F7' }}>
      <div style={{ fontSize: 36 }}>⚠️</div>
      <div style={{ fontSize: 13, fontWeight: 700, color: '#EF3340' }}>{label}</div>
      <div style={{ fontSize: 12, color: '#64748B' }}>{nom}</div>
      {url && <a href={url} download={nom} style={{ padding: '8px 18px', borderRadius: 8, background: '#1B4F8A', color: '#fff', fontSize: 12, fontWeight: 700, textDecoration: 'none' }}>Télécharger</a>}
    </div>
  );
}

/* ── Dispatcher principal ──────────────────────────────────────────────── */
function DocContent({ doc, overlayCaptures }: { doc: AnnotatedDoc; overlayCaptures: boolean }) {
  const ext = doc.ext?.toLowerCase() ?? '';

  /* Images */
  if (['png', 'jpg', 'jpeg', 'gif', 'bmp', 'svg', 'webp'].includes(ext) && doc.url) {
    return (
      <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#F8FAFC', pointerEvents: 'none' }}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={doc.url} alt={doc.nom} style={{ maxWidth: '100%', maxHeight: '100%', objectFit: 'contain', pointerEvents: 'none', userSelect: 'none' }} />
      </div>
    );
  }

  /* PDF — iframe */
  if (ext === 'pdf' && doc.url) {
    return (
      <iframe src={doc.url} title={doc.nom}
        style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', border: 'none', background: '#fff',
          pointerEvents: overlayCaptures ? 'none' : 'auto' }} />
    );
  }

  /* XLSX / XLS — SheetJS */
  if (['xlsx', 'xls', 'csv'].includes(ext) && (doc.url || doc.file)) {
    return <XLSXViewer doc={doc} />;
  }

  /* DOCX / DOC — mammoth */
  if (['docx', 'doc'].includes(ext) && (doc.url || doc.file)) {
    return <DOCXViewer doc={doc} />;
  }

  /* ZIP — JSZip */
  if (['zip', 'rar', '7z'].includes(ext) && (doc.url || doc.file)) {
    return <ZIPViewer doc={doc} />;
  }

  /* DWG / DXF — viewer CAO */
  if (['dwg', 'dxf'].includes(ext)) {
    return <DWGViewer doc={doc} />;
  }

  /* JSON — viewer structuré */
  if (ext === 'json' && (doc.url || doc.file)) {
    return <JSONViewer doc={doc} />;
  }

  /* TXT / CSV texte brut */
  if (['txt', 'csv', 'log', 'md'].includes(ext) && (doc.url || doc.file)) {
    return <TextViewer doc={doc} />;
  }

  /* Autres formats avec URL → téléchargement */
  if (doc.url) {
    return (
      <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 14, padding: 40 }}>
        <div style={{ fontSize: 56, opacity: 0.2 }}>📄</div>
        <div style={{ fontSize: 15, fontWeight: 700, color: '#1B4F8A' }}>{doc.nom}</div>
        <div style={{ fontSize: 12, color: '#64748B', textAlign: 'center', maxWidth: 340 }}>
          Format <strong>{ext.toUpperCase()}</strong> — prévisualisation non disponible.
        </div>
        <a href={doc.url} download={doc.nom} style={{ padding: '8px 18px', borderRadius: 8, background: '#1B4F8A', color: '#fff', fontSize: 13, fontWeight: 700, textDecoration: 'none' }}>
          Télécharger
        </a>
      </div>
    );
  }

  /* Aucune source */
  return (
    <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 8, padding: 40 }}>
      <div style={{ fontSize: 48, opacity: 0.1 }}>📄</div>
      <div style={{ fontSize: 13, color: '#94A3B8' }}>Aucun fichier chargé</div>
    </div>
  );
}

const darkBtn: React.CSSProperties = {
  background: 'transparent', border: 'none', color: '#94A3B8',
  cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
  borderRadius: 6, padding: 5,
};

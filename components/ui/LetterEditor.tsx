'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import {
  X, Bold, Italic, Underline, AlignLeft, AlignCenter, AlignRight, AlignJustify,
  List, ListOrdered, Printer, Download, PenLine, Wand2, Loader, Check, Stamp,
  ChevronDown, RotateCcw, Share2,
} from 'lucide-react';
import { SENELEC_LOGO_DATA_URI } from '@/lib/senelecLogo';
import { chatOnce } from '@/lib/llmClient';
import { useAuth } from '@/lib/authStore';
import { useSignatureStore } from '@/lib/signatureStore';

/* ── Types ─────────────────────────────────────────────────────────────────── */

export interface LetterEditorProps {
  onClose: () => void;
  /** Courrier entrant auquel on répond (pré-remplit objet + corps via IA) */
  responseTo?: {
    num: string;
    expediteur: string;
    objet: string;
    recu: string;
  } | null;
  /** Callback appelé à l'enregistrement brouillon */
  onSave?: (data: { num: string; destinataire: string; objet: string }) => void;
}

/* ── Cachets disponibles ────────────────────────────────────────────────────── */

const CACHETS = [
  { code: 'DPE', label: 'Direction Principale Équipement', color: '#1B4F8A' },
  { code: 'DER', label: 'Direction Équipement Réseaux',    color: '#059669' },
  { code: 'DGC', label: 'Direction Génie Civil',           color: '#7C3AED' },
  { code: 'DEP', label: 'Direction Équipement Production', color: '#D97706' },
  { code: 'DIT', label: 'Direction Innovation Techno.',    color: '#0E7490' },
  { code: 'DPT', label: 'Direction Projets Transport',     color: '#9333EA' },
] as const;

/* ── Hash léger (djb2) — pas besoin de Web Crypto pour cet usage ────────────── */

function simpleHash(str: string): string {
  let h = 5381;
  for (let i = 0; i < str.length; i++) h = ((h << 5) + h) ^ str.charCodeAt(i);
  return Math.abs(h >>> 0).toString(36).toUpperCase().slice(0, 8).padStart(8, '0');
}

/* ── Pad de signature manuscrite ────────────────────────────────────────────── */

function SignaturePad({ onSave, onCancel }: {
  onSave: (dataUrl: string) => void;
  onCancel: () => void;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const drawing = useRef(false);
  const [hasDrawing, setHasDrawing] = useState(false);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d')!;
    ctx.fillStyle = '#fff';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.strokeStyle = '#1B4F8A';
    ctx.lineWidth = 2.5;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
  }, []);

  const getPos = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current!;
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    if ('touches' in e) {
      return {
        x: (e.touches[0].clientX - rect.left) * scaleX,
        y: (e.touches[0].clientY - rect.top) * scaleY,
      };
    }
    return {
      x: (e.clientX - rect.left) * scaleX,
      y: (e.clientY - rect.top) * scaleY,
    };
  };

  const onDown = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    drawing.current = true;
    const ctx = canvasRef.current!.getContext('2d')!;
    const { x, y } = getPos(e);
    ctx.beginPath();
    ctx.moveTo(x, y);
    setHasDrawing(true);
  };

  const onMove = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    if (!drawing.current) return;
    e.preventDefault();
    const ctx = canvasRef.current!.getContext('2d')!;
    const { x, y } = getPos(e);
    ctx.lineTo(x, y);
    ctx.stroke();
  };

  const onUp = () => { drawing.current = false; };

  const clear = () => {
    const canvas = canvasRef.current!;
    const ctx = canvas.getContext('2d')!;
    ctx.fillStyle = '#fff';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    setHasDrawing(false);
  };

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 9999, background: 'rgba(15,23,42,0.75)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ background: '#fff', borderRadius: 14, padding: 24, width: 420, boxShadow: '0 24px 64px rgba(0,0,0,0.4)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
          <div>
            <div style={{ fontWeight: 800, fontSize: 15, color: '#1E293B' }}>Créer votre signature électronique</div>
            <div style={{ fontSize: 11, color: '#64748B', marginTop: 2 }}>Signez dans la zone ci-dessous avec votre souris ou votre doigt</div>
          </div>
          <button onClick={onCancel} style={{ border: 'none', background: 'none', cursor: 'pointer', color: '#94A3B8', padding: 4 }}><X size={18} /></button>
        </div>

        <div style={{ border: '2px dashed #CBD5E1', borderRadius: 8, overflow: 'hidden', background: '#F8FAFC', marginBottom: 10, position: 'relative' }}>
          <canvas
            ref={canvasRef}
            width={376}
            height={130}
            style={{ display: 'block', width: '100%', cursor: 'crosshair', touchAction: 'none' }}
            onMouseDown={onDown}
            onMouseMove={onMove}
            onMouseUp={onUp}
            onMouseLeave={onUp}
            onTouchStart={onDown}
            onTouchMove={onMove}
            onTouchEnd={onUp}
          />
          {!hasDrawing && (
            <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', pointerEvents: 'none' }}>
              <span style={{ fontSize: 12, color: '#CBD5E1', fontStyle: 'italic' }}>Tracez votre signature ici…</span>
            </div>
          )}
        </div>

        <div style={{ display: 'flex', gap: 8, marginTop: 14 }}>
          <button onClick={clear} style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '8px 12px', border: '1px solid #E2E8F0', borderRadius: 7, background: '#F8FAFC', cursor: 'pointer', fontSize: 12, color: '#64748B' }}>
            <RotateCcw size={12} /> Effacer
          </button>
          <button onClick={onCancel} style={{ padding: '8px 14px', border: '1px solid #E2E8F0', borderRadius: 7, background: '#F8FAFC', cursor: 'pointer', fontSize: 12, color: '#64748B' }}>
            Annuler
          </button>
          <button
            onClick={() => onSave(canvasRef.current!.toDataURL('image/png'))}
            disabled={!hasDrawing}
            style={{ flex: 1, padding: '8px 14px', borderRadius: 7, background: hasDrawing ? '#1B4F8A' : '#E2E8F0', color: hasDrawing ? '#fff' : '#94A3B8', border: 'none', cursor: hasDrawing ? 'pointer' : 'default', fontWeight: 700, fontSize: 12, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 5 }}>
            <Check size={12} /> Enregistrer la signature
          </button>
        </div>

        <div style={{ marginTop: 12, padding: '8px 12px', background: '#F0FDF4', borderRadius: 7, fontSize: 10, color: '#15803D' }}>
          La signature est chiffrée et stockée localement dans votre profil SIGEPP. Elle ne quitte pas votre navigateur.
        </div>
      </div>
    </div>
  );
}

/* ── Composant principal ─────────────────────────────────────────────────────── */

export default function LetterEditor({ onClose, responseTo, onSave }: LetterEditorProps) {
  const { user } = useAuth();
  const { getSignature, setSignature } = useSignatureStore();

  const editorRef = useRef<HTMLDivElement>(null);

  /* Champs de l'en-tête */
  const [destinataire, setDestinataire] = useState('');
  const [objet, setObjet] = useState(
    responseTo ? `Réponse à votre courrier réf. ${responseTo.num} — ${responseTo.objet}` : ''
  );
  const [lieu, setLieu] = useState('Dakar');
  const [refNum, setRefNum] = useState(
    () => `DPE/${new Date().getFullYear()}/${String(Math.floor(Math.random() * 900) + 100).padStart(3, '0')}`
  );

  /* UI state */
  const [aiLoading, setAiLoading] = useState(false);
  const [showCachet, setShowCachet] = useState(false);
  const [showSigPad, setShowSigPad] = useState(false);
  const [saved, setSaved] = useState(false);
  const [aiError, setAiError] = useState('');

  const today = new Date().toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' });
  const userSig = user ? getSignature(user.email) : null;

  /* Contenu initial de l'éditeur */
  useEffect(() => {
    if (!editorRef.current) return;
    editorRef.current.innerHTML = responseTo
      ? `<p>Monsieur / Madame,</p>
<p>En réponse à votre courrier référencé <strong>${responseTo.num}</strong> en date du ${responseTo.recu}, relatif à l'objet <em>« ${responseTo.objet} »</em>,</p>
<p>J'ai l'honneur de porter à votre connaissance que…</p>
<p>&nbsp;</p>
<p>Veuillez agréer, Monsieur / Madame, l'expression de ma haute considération.</p>`
      : `<p>Monsieur / Madame,</p>
<p>&nbsp;</p>
<p>&nbsp;</p>
<p>&nbsp;</p>
<p>Veuillez agréer, Monsieur / Madame, l'expression de ma haute considération.</p>`;
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  /* Commandes de mise en forme (execCommand — supporté universellement) */
  const fmt = useCallback((cmd: string, val?: string) => {
    editorRef.current?.focus();
    // eslint-disable-next-line @typescript-eslint/no-deprecated
    document.execCommand(cmd, false, val ?? '');
  }, []);

  /* Insertion cachet SVG inline */
  const insertCachet = (code: string, label: string, color: string) => {
    const date = new Date().toLocaleDateString('fr-FR');
    const svg = `<img src="data:image/svg+xml;charset=utf-8,${encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" width="110" height="110" viewBox="0 0 110 110">
  <circle cx="55" cy="55" r="52" fill="none" stroke="${color}" stroke-width="3.5"/>
  <circle cx="55" cy="55" r="46" fill="none" stroke="${color}" stroke-width="1" stroke-dasharray="4 3" opacity="0.6"/>
  <text x="55" y="38" text-anchor="middle" font-family="serif" font-size="9" font-weight="700" fill="${color}" text-transform="uppercase">${label.substring(0, 22)}</text>
  <text x="55" y="60" text-anchor="middle" font-family="serif" font-size="24" font-weight="900" fill="${color}">${code}</text>
  <text x="55" y="73" text-anchor="middle" font-family="sans-serif" font-size="7.5" fill="${color}">SENELEC · SÉNÉGAL</text>
  <text x="55" y="85" text-anchor="middle" font-family="sans-serif" font-size="7" fill="${color}" opacity="0.8">${date}</text>
</svg>`)}" alt="Cachet ${code}" style="width:100px;height:100px;display:inline-block;vertical-align:middle;margin:6px;" />`;
    editorRef.current?.focus();
    // eslint-disable-next-line @typescript-eslint/no-deprecated
    document.execCommand('insertHTML', false, svg);
    setShowCachet(false);
  };

  /* Insertion signature électronique */
  const insertSignature = () => {
    if (!user) return;
    const hash = simpleHash(`${user.email}-${refNum}-${Date.now()}`);
    const sigImgTag = userSig?.dataUrl
      ? `<img src="${userSig.dataUrl}" alt="Signature" style="height:52px;max-width:200px;display:block;margin:4px 0;" />`
      : `<div style="height:52px;width:180px;border-bottom:1.5px solid #1B4F8A;margin:4px 0;"></div>`;

    const html = `<div style="margin-top:36px;padding-top:8px;text-align:right;font-family:sans-serif;">
<div style="font-size:10px;color:#334155;font-weight:600;margin-bottom:2px;">Le Directeur Principal Équipement</div>
${sigImgTag}
<div style="font-size:10.5px;font-weight:700;color:#1E293B;">${user.prenom} ${user.nom}</div>
<div style="font-size:9px;color:#64748B;">${user.poste ?? ''}</div>
<div style="margin-top:8px;padding-top:5px;border-top:1px dashed #CBD5E1;font-size:7px;color:#94A3B8;font-family:monospace;line-height:1.6;">
✓ Signé électroniquement · SIGEPP-DPE v2 · ${today} · Réf&nbsp;: SIG-${hash}
</div></div>`;
    editorRef.current?.focus();
    // eslint-disable-next-line @typescript-eslint/no-deprecated
    document.execCommand('insertHTML', false, html);
  };

  /* Génération IA de réponse */
  const generateAI = async () => {
    if (!responseTo) return;
    setAiLoading(true);
    setAiError('');
    try {
      const resp = await chatOnce(
        [
          {
            role: 'system',
            content:
              'Tu es expert en rédaction administrative francophone à SENELEC (Société Nationale d\'Électricité du Sénégal). ' +
              'Tu rédiges des courriers officiels en français formel, selon les normes de la fonction publique sénégalaise. ' +
              'Génère uniquement le corps du courrier (sans en-tête, sans formule de politesse finale, sans signature). ' +
              'Style concis, professionnel, respectueux.',
          },
          {
            role: 'user',
            content:
              `Rédige le corps d'une réponse officielle au courrier suivant :\n\n` +
              `Expéditeur : ${responseTo.expediteur}\n` +
              `Objet : ${responseTo.objet}\n` +
              `Reçu le : ${responseTo.recu}\n\n` +
              `La réponse doit :\n` +
              `- Accuser réception du courrier\n` +
              `- Apporter une réponse professionnelle adaptée à l'objet\n` +
              `- Mentionner les actions en cours ou prévues\n` +
              `- Être concise (3-5 paragraphes max, sans listes)`,
          },
        ],
        { maxTokens: 700 }
      );

      if (editorRef.current) {
        const paragraphs = resp
          .trim()
          .split(/\n{2,}/)
          .filter(Boolean)
          .map(p => `<p>${p.replace(/\n/g, '<br/>')}</p>`)
          .join('');
        editorRef.current.innerHTML =
          `<p>Monsieur / Madame,</p>` +
          paragraphs +
          `<p>&nbsp;</p>` +
          `<p>Veuillez agréer, Monsieur / Madame, l'expression de ma haute considération.</p>`;
      }
    } catch (err) {
      setAiError(err instanceof Error ? err.message : 'Erreur génération IA');
    } finally {
      setAiLoading(false);
    }
  };

  /* Impression dans un nouvel onglet */
  const handlePrint = () => {
    const body = editorRef.current?.innerHTML ?? '';
    const dirLabel = user?.direction
      ? `${user.direction} — SENELEC DPE`
      : 'Direction Principale Équipement — SENELEC';

    const html = `<!DOCTYPE html>
<html lang="fr">
<head>
<meta charset="UTF-8">
<title>Courrier SENELEC — ${objet}</title>
<style>
  * { box-sizing: border-box; margin: 0; padding: 0; }
  @page { size: A4; margin: 20mm 20mm 25mm 20mm; }
  body { font-family: "Times New Roman", Times, serif; font-size: 11pt; color: #1a1a2e; background: #fff; }
  .header { display: flex; align-items: flex-start; justify-content: space-between; border-bottom: 3px solid #1B4F8A; padding-bottom: 12px; margin-bottom: 0; }
  .logo { height: 60px; }
  .brand { padding-left: 14px; }
  .brand .name { font-size: 20pt; font-weight: 900; color: #1B4F8A; letter-spacing: 3px; font-family: sans-serif; }
  .brand .sub { font-size: 7.5pt; color: #475569; text-transform: uppercase; letter-spacing: 1px; font-family: sans-serif; }
  .addr { text-align: right; font-size: 8pt; color: #475569; line-height: 1.7; font-family: sans-serif; }
  .dir-bar { background: #1B4F8A; color: #fff; text-align: center; padding: 5px; font-size: 8.5pt; font-weight: 700; letter-spacing: 1.5px; text-transform: uppercase; font-family: sans-serif; margin-bottom: 22px; }
  .meta { display: flex; justify-content: space-between; margin-bottom: 18px; gap: 20px; }
  .meta-dest .lbl { font-size: 7pt; text-transform: uppercase; color: #64748B; margin-bottom: 4px; font-family: sans-serif; }
  .meta-dest .val { font-size: 11pt; font-weight: 600; }
  .meta-right { text-align: right; font-size: 10pt; line-height: 1.9; font-family: sans-serif; }
  .objet-line { margin-bottom: 18px; font-size: 10.5pt; font-family: sans-serif; }
  hr { border: none; border-top: 1px solid #CBD5E1; margin-bottom: 18px; }
  .body { font-size: 11pt; line-height: 1.8; text-align: justify; }
  .body p { margin-bottom: 10pt; }
  .foot { margin-top: 32px; padding-top: 8px; border-top: 1px solid #E2E8F0; font-size: 7pt; color: #94A3B8; text-align: center; font-family: sans-serif; }
</style>
</head>
<body>
<div class="header">
  <div style="display:flex;align-items:flex-start;">
    <img class="logo" src="${SENELEC_LOGO_DATA_URI}" alt="SENELEC" />
    <div class="brand">
      <div class="name">SENELEC</div>
      <div class="sub">Société Nationale d'Électricité</div>
    </div>
  </div>
  <div class="addr">
    Immeuble SENELEC, 28 Rue Vincens<br/>
    BP 93 — Dakar, Sénégal<br/>
    Tél : +221 33 839 30 00<br/>
    www.senelec.sn
  </div>
</div>
<div class="dir-bar">${dirLabel}</div>
<div class="meta">
  <div class="meta-dest">
    <div class="lbl">À l'attention de</div>
    <div class="val">${destinataire || '— Destinataire —'}</div>
  </div>
  <div class="meta-right">
    <div><em>${lieu}, le ${today}</em></div>
    <div><strong>Réf :</strong> ${refNum}</div>
  </div>
</div>
<div class="objet-line"><strong>Objet :</strong> ${objet || '—'}</div>
<hr />
<div class="body">${body}</div>
<div class="foot">Document SIGEPP-DPE · SENELEC · ${refNum} · ${today}</div>
</body>
</html>`;

    const w = window.open('', '_blank', 'width=900,height=1100');
    if (!w) return;
    w.document.write(html);
    w.document.close();
    w.focus();
    setTimeout(() => w.print(), 600);
  };

  /* Enregistrement brouillon */
  const handleSave = () => {
    if (onSave) onSave({ num: refNum, destinataire, objet });
    setSaved(true);
    setTimeout(() => setSaved(false), 2500);
  };

  /* Enregistrement signature */
  const handleSigSave = (dataUrl: string) => {
    if (!user) return;
    setSignature({
      userId: user.email,
      displayName: `${user.prenom} ${user.nom}`,
      poste: user.poste ?? '',
      direction: user.direction,
      dataUrl,
      createdAt: new Date().toISOString(),
    });
    setShowSigPad(false);
  };

  /* Bouton de barre d'outils */
  const ToolBtn = ({
    onClick, title, children, active,
  }: { onClick: () => void; title: string; children: React.ReactNode; active?: boolean }) => (
    <button
      onMouseDown={e => { e.preventDefault(); onClick(); }}
      title={title}
      style={{
        width: 29, height: 29,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        border: `1px solid ${active ? '#93C5FD' : '#E2E8F0'}`,
        borderRadius: 5,
        background: active ? '#EFF6FF' : '#fff',
        cursor: 'pointer', color: active ? '#1D4ED8' : '#334155', flexShrink: 0,
        transition: 'background 0.1s',
      }}
    >
      {children}
    </button>
  );

  const Sep = () => <div style={{ width: 1, height: 20, background: '#E2E8F0', margin: '0 2px', flexShrink: 0 }} />;

  return (
    <>
      {/* ═══════════════════════════════════════════════════════════════════
          OVERLAY
      ═══════════════════════════════════════════════════════════════════ */}
      <div
        style={{
          position: 'fixed', inset: 0, zIndex: 800,
          background: 'rgba(15,23,42,0.65)',
          backdropFilter: 'blur(4px)',
          display: 'flex', flexDirection: 'column',
        }}
        onClick={() => setShowCachet(false)}
      >
        {/* ── Barre supérieure ──────────────────────────────────────────── */}
        <div style={{
          background: '#1B4F8A', color: '#fff',
          padding: '8px 16px',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          flexShrink: 0, gap: 12,
          boxShadow: '0 2px 12px rgba(0,0,0,0.3)',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }} />

          <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
            {responseTo && (
              <button
                onClick={generateAI}
                disabled={aiLoading}
                style={{
                  display: 'flex', alignItems: 'center', gap: 6,
                  padding: '6px 14px', borderRadius: 7,
                  background: aiLoading ? 'rgba(255,255,255,0.1)' : 'rgba(243,146,0,0.9)',
                  color: '#fff', border: 'none',
                  cursor: aiLoading ? 'wait' : 'pointer',
                  fontWeight: 700, fontSize: 12, whiteSpace: 'nowrap',
                }}>
                {aiLoading
                  ? <><Loader size={12} style={{ animation: 'spin 1s linear infinite' }} /> Génération IA…</>
                  : <><Wand2 size={12} /> Générer réponse IA</>}
              </button>
            )}

            <button
              onClick={handlePrint}
              style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '6px 12px', borderRadius: 7, background: 'rgba(255,255,255,0.13)', color: '#fff', border: '1px solid rgba(255,255,255,0.22)', cursor: 'pointer', fontSize: 12 }}>
              <Printer size={13} /> Imprimer / PDF
            </button>

            <button
              onClick={handleSave}
              style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '6px 12px', borderRadius: 7, background: saved ? 'rgba(22,163,74,0.8)' : 'rgba(255,255,255,0.13)', color: '#fff', border: '1px solid rgba(255,255,255,0.22)', cursor: 'pointer', fontSize: 12 }}>
              {saved ? <><Check size={13} /> Enregistré</> : <><Download size={13} /> Enreg. brouillon</>}
            </button>

            <button
              onClick={() => navigator.clipboard?.writeText(`Réf SIGEPP : ${refNum}`).then(() => {}).catch(() => {})}
              style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '6px 10px', borderRadius: 7, background: 'rgba(255,255,255,0.13)', color: '#fff', border: '1px solid rgba(255,255,255,0.22)', cursor: 'pointer', fontSize: 12 }}>
              <Share2 size={13} />
            </button>

            <button
              onClick={onClose}
              style={{ width: 32, height: 32, display: 'flex', alignItems: 'center', justifyContent: 'center', border: '1px solid rgba(255,255,255,0.25)', borderRadius: 7, background: 'rgba(255,255,255,0.1)', cursor: 'pointer', color: '#fff' }}
              aria-label="Fermer l'éditeur">
              <X size={16} />
            </button>
          </div>
        </div>

        {/* Erreur IA */}
        {aiError && (
          <div style={{ background: '#FEF2F2', borderBottom: '1px solid #FECACA', padding: '8px 18px', fontSize: 11.5, color: '#DC2626', display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
            <X size={13} /> {aiError} — Vérifiez que Ollama est lancé ou que la clé Groq est configurée.
            <button onClick={() => setAiError('')} style={{ marginLeft: 'auto', border: 'none', background: 'none', cursor: 'pointer', color: '#DC2626', fontSize: 11 }}>Fermer</button>
          </div>
        )}

        {/* ── Barre de formatage ────────────────────────────────────────── */}
        <div
          style={{
            background: '#F8FAFC', borderBottom: '1px solid #E2E8F0',
            padding: '5px 16px',
            display: 'flex', alignItems: 'center', gap: 3, flexWrap: 'wrap',
            flexShrink: 0,
          }}
          onClick={e => e.stopPropagation()}
        >
          <ToolBtn onClick={() => fmt('bold')} title="Gras (Ctrl+B)"><Bold size={12} /></ToolBtn>
          <ToolBtn onClick={() => fmt('italic')} title="Italique (Ctrl+I)"><Italic size={12} /></ToolBtn>
          <ToolBtn onClick={() => fmt('underline')} title="Souligné (Ctrl+U)"><Underline size={12} /></ToolBtn>
          <Sep />
          <ToolBtn onClick={() => fmt('justifyLeft')} title="Aligner à gauche"><AlignLeft size={12} /></ToolBtn>
          <ToolBtn onClick={() => fmt('justifyCenter')} title="Centrer"><AlignCenter size={12} /></ToolBtn>
          <ToolBtn onClick={() => fmt('justifyRight')} title="Aligner à droite"><AlignRight size={12} /></ToolBtn>
          <ToolBtn onClick={() => fmt('justifyFull')} title="Justifier"><AlignJustify size={12} /></ToolBtn>
          <Sep />
          <ToolBtn onClick={() => fmt('insertUnorderedList')} title="Liste à puces"><List size={12} /></ToolBtn>
          <ToolBtn onClick={() => fmt('insertOrderedList')} title="Liste numérotée"><ListOrdered size={12} /></ToolBtn>
          <Sep />

          {/* Cachet */}
          <div style={{ position: 'relative' }} onClick={e => e.stopPropagation()}>
            <button
              onMouseDown={e => { e.preventDefault(); setShowCachet(v => !v); }}
              title="Insérer un cachet officiel"
              style={{
                display: 'flex', alignItems: 'center', gap: 5,
                padding: '4px 10px', height: 29,
                border: `1px solid ${showCachet ? '#93C5FD' : '#E2E8F0'}`,
                borderRadius: 5,
                background: showCachet ? '#EFF6FF' : '#fff',
                cursor: 'pointer', fontSize: 11,
                color: showCachet ? '#1D4ED8' : '#334155',
                fontWeight: 600,
              }}>
              <Stamp size={12} /> Cachet <ChevronDown size={10} />
            </button>

            {showCachet && (
              <div style={{
                position: 'absolute', top: 33, left: 0, zIndex: 200,
                background: '#fff', border: '1px solid #E2E8F0',
                borderRadius: 9, boxShadow: '0 8px 28px rgba(0,0,0,0.18)',
                minWidth: 250, overflow: 'hidden',
              }}>
                <div style={{ padding: '8px 14px 6px', fontSize: 9.5, fontWeight: 700, color: '#94A3B8', textTransform: 'uppercase', letterSpacing: 0.5 }}>
                  Sélectionner le cachet
                </div>
                {CACHETS.map(c => (
                  <button
                    key={c.code}
                    onMouseDown={e => { e.preventDefault(); insertCachet(c.code, c.label, c.color); }}
                    style={{
                      display: 'flex', alignItems: 'center', gap: 10,
                      width: '100%', padding: '9px 14px',
                      border: 'none', background: 'none',
                      cursor: 'pointer', textAlign: 'left',
                      borderBottom: '1px solid #F1F5F9',
                    }}
                    onMouseEnter={e => (e.currentTarget.style.background = '#F8FAFC')}
                    onMouseLeave={e => (e.currentTarget.style.background = 'none')}
                  >
                    <div style={{
                      width: 32, height: 32, borderRadius: '50%',
                      border: `2.5px solid ${c.color}`,
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      fontSize: 7.5, fontWeight: 900, color: c.color, flexShrink: 0,
                    }}>{c.code}</div>
                    <div>
                      <div style={{ fontWeight: 700, fontSize: 12, color: '#1E293B' }}>{c.code}</div>
                      <div style={{ fontSize: 10, color: '#64748B' }}>{c.label}</div>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Signature */}
          <button
            onMouseDown={e => {
              e.preventDefault();
              if (!userSig) {
                setShowSigPad(true);
              } else {
                insertSignature();
              }
            }}
            title={userSig ? 'Insérer ma signature électronique' : 'Créer ma signature électronique'}
            style={{
              display: 'flex', alignItems: 'center', gap: 5,
              padding: '4px 11px', height: 29,
              border: `1px solid ${userSig ? '#93C5FD' : '#E2E8F0'}`,
              borderRadius: 5,
              background: userSig ? '#EFF6FF' : '#fff',
              cursor: 'pointer', fontSize: 11,
              color: userSig ? '#1D4ED8' : '#334155',
              fontWeight: 600,
            }}>
            <PenLine size={12} /> {userSig ? 'Insérer signature' : 'Créer signature…'}
          </button>

          {userSig && (
            <button
              onMouseDown={e => { e.preventDefault(); setShowSigPad(true); }}
              title="Modifier ma signature"
              style={{ padding: '4px 9px', height: 29, border: '1px solid #E2E8F0', borderRadius: 5, background: '#fff', cursor: 'pointer', fontSize: 10.5, color: '#64748B' }}>
              Modifier
            </button>
          )}

          {/* Aperçu signature */}
          {userSig && (
            <img
              src={userSig.dataUrl}
              alt="Ma signature"
              style={{ height: 22, borderRadius: 3, border: '1px solid #E2E8F0', padding: '1px 4px', background: '#fff' }}
            />
          )}
        </div>

        {/* ── Zone d'édition (fond gris = bureau) ──────────────────────── */}
        <div
          style={{ flex: 1, overflowY: 'auto', padding: '28px 0 40px', background: '#78909C' }}
          onClick={e => { e.stopPropagation(); setShowCachet(false); }}
        >
          {/* Feuille A4 */}
          <div style={{
            width: 794, minHeight: 1122, margin: '0 auto',
            background: '#fff',
            boxShadow: '0 6px 40px rgba(0,0,0,0.35)',
            padding: '44px 60px 56px',
            display: 'flex', flexDirection: 'column',
            fontFamily: '"Times New Roman", Times, serif',
          }}>

            {/* ── En-tête SENELEC ── */}
            <div style={{
              display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between',
              borderBottom: '3.5px solid #1B4F8A', paddingBottom: 14, marginBottom: 0,
            }}>
              <div style={{ display: 'flex', alignItems: 'flex-start', gap: 14 }}>
                <img src={SENELEC_LOGO_DATA_URI} alt="SENELEC" style={{ height: 58, flexShrink: 0 }} />
                <div style={{ paddingTop: 4 }}>
                  <div style={{ fontSize: 22, fontWeight: 900, color: '#1B4F8A', letterSpacing: 3, fontFamily: 'Arial, sans-serif', lineHeight: 1 }}>
                    SENELEC
                  </div>
                  <div style={{ fontSize: 8, color: '#475569', textTransform: 'uppercase', letterSpacing: 1.2, fontFamily: 'sans-serif', marginTop: 3 }}>
                    Société Nationale d'Électricité
                  </div>
                  <div style={{ fontSize: 7.5, color: '#64748B', fontFamily: 'sans-serif', marginTop: 2 }}>
                    République du Sénégal
                  </div>
                </div>
              </div>
              <div style={{ textAlign: 'right', fontSize: 8.5, color: '#475569', lineHeight: 1.75, fontFamily: 'sans-serif' }}>
                <div style={{ fontWeight: 700, color: '#334155', fontSize: 9, marginBottom: 2 }}>Siège Social</div>
                <div>Immeuble SENELEC, 28 Rue Vincens</div>
                <div>BP 93 — Dakar, Sénégal</div>
                <div>Tél : +221 33 839 30 00</div>
                <div>www.senelec.sn</div>
              </div>
            </div>

            {/* Bande direction */}
            <div style={{
              background: '#1B4F8A', color: '#fff',
              textAlign: 'center', padding: '6px 0',
              fontSize: 8.5, fontWeight: 800, letterSpacing: 2,
              textTransform: 'uppercase', fontFamily: 'sans-serif',
              marginBottom: 26,
            }}>
              Direction Principale Équipement &mdash; DPE
            </div>

            {/* Destinataire + Date/Réf */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 22, gap: 24 }}>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 8, textTransform: 'uppercase', color: '#94A3B8', fontWeight: 700, fontFamily: 'sans-serif', marginBottom: 5, letterSpacing: 0.5 }}>
                  À l'attention de
                </div>
                <input
                  value={destinataire}
                  onChange={e => setDestinataire(e.target.value)}
                  placeholder="Monsieur le Ministre / Directeur Général / …"
                  style={{
                    width: '100%', fontFamily: '"Times New Roman", serif',
                    fontSize: 12, border: 'none',
                    borderBottom: '1px dashed #CBD5E1', outline: 'none',
                    padding: '2px 0', background: 'transparent', color: '#1E293B',
                    boxSizing: 'border-box',
                  }}
                />
              </div>
              <div style={{ textAlign: 'right', fontFamily: 'sans-serif', flexShrink: 0 }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 4, marginBottom: 5, fontSize: 11 }}>
                  <input
                    value={lieu}
                    onChange={e => setLieu(e.target.value)}
                    style={{ textAlign: 'right', border: 'none', borderBottom: '1px dashed #CBD5E1', outline: 'none', background: 'transparent', fontSize: 11, width: 72, color: '#334155' }}
                  />
                  <span style={{ color: '#334155', fontStyle: 'italic', fontSize: 11 }}>, le {today}</span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 5 }}>
                  <span style={{ color: '#94A3B8', fontSize: 9 }}>Réf :</span>
                  <input
                    value={refNum}
                    onChange={e => setRefNum(e.target.value)}
                    style={{ fontWeight: 700, color: '#1B4F8A', border: 'none', borderBottom: '1px dashed #CBD5E1', outline: 'none', background: 'transparent', fontSize: 10, width: 170, textAlign: 'right', fontFamily: 'monospace' }}
                  />
                </div>
              </div>
            </div>

            {/* Objet */}
            <div style={{ marginBottom: 20, display: 'flex', alignItems: 'baseline', gap: 7 }}>
              <span style={{ fontWeight: 700, fontSize: 12, color: '#1E293B', fontFamily: 'sans-serif', flexShrink: 0 }}>Objet :</span>
              <input
                value={objet}
                onChange={e => setObjet(e.target.value)}
                placeholder="Objet du courrier"
                style={{ flex: 1, fontFamily: '"Times New Roman", serif', fontSize: 12, fontWeight: 600, border: 'none', borderBottom: '1px dashed #CBD5E1', outline: 'none', background: 'transparent', color: '#1E293B', padding: '2px 0', minWidth: 0 }}
              />
            </div>

            <div style={{ borderTop: '1px solid #CBD5E1', marginBottom: 22 }} />

            {/* Corps éditable */}
            <div
              ref={editorRef}
              contentEditable
              suppressContentEditableWarning
              onMouseDown={() => setShowCachet(false)}
              style={{
                flex: 1, outline: 'none',
                minHeight: 380,
                fontSize: 12, lineHeight: 1.9,
                color: '#1E293B',
                fontFamily: '"Times New Roman", Times, serif',
                textAlign: 'justify',
              }}
            />

            {/* Pied de page */}
            <div style={{ borderTop: '1px solid #CBD5E1', marginTop: 36, paddingTop: 8, fontSize: 7.5, color: '#94A3B8', textAlign: 'center', fontFamily: 'sans-serif' }}>
              Document généré par SIGEPP-DPE · SENELEC · Réf {refNum} · {today}
            </div>
          </div>
        </div>

        {/* Astuce raccourcis */}
        <div style={{ background: '#1E293B', padding: '5px 18px', fontSize: 10, color: '#64748B', display: 'flex', gap: 16, flexShrink: 0 }}>
          <span><kbd style={{ background: '#334155', color: '#94A3B8', padding: '1px 5px', borderRadius: 3, fontSize: 9 }}>Ctrl+B</kbd> Gras</span>
          <span><kbd style={{ background: '#334155', color: '#94A3B8', padding: '1px 5px', borderRadius: 3, fontSize: 9 }}>Ctrl+I</kbd> Italique</span>
          <span><kbd style={{ background: '#334155', color: '#94A3B8', padding: '1px 5px', borderRadius: 3, fontSize: 9 }}>Ctrl+U</kbd> Souligné</span>
          <span style={{ marginLeft: 'auto', color: '#475569' }}>
            {user ? `${user.prenom} ${user.nom} · ${user.poste ?? user.role}` : 'SIGEPP-DPE'}
          </span>
        </div>
      </div>

      {/* Pad de signature */}
      {showSigPad && (
        <SignaturePad onSave={handleSigSave} onCancel={() => setShowSigPad(false)} />
      )}

      {/* Animation spin inline */}
      <style>{`@keyframes spin{from{transform:rotate(0deg)}to{transform:rotate(360deg)}}`}</style>
    </>
  );
}

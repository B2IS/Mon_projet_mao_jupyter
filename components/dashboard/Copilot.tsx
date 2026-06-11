'use client';

import { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import {
  Send, Bot, User, Plus, Copy, Check, StopCircle,
  Download, ChevronDown, BarChart3, AlertTriangle,
  TrendingUp, DollarSign, MapPin, Calendar, FileText,
  Sparkles, Settings2,
} from 'lucide-react';
import { useProjectStore } from '@/lib/projectStore';
import { useAuth } from '@/lib/authStore';
import { streamChat, getKey, GROQ_MODELS, type ChatMessage } from '@/lib/groqChat';
import { SENELEC_LOGO_DATA_URI } from '@/lib/senelecLogo';
import toast from 'react-hot-toast';

/* ─── Tokens ──────────────────────────────────────────── */
const NAVY   = '#1B4F8A';
const ORANGE = '#F47920';
const BORDER = '#E2E8F0';
const BG     = '#F8FAFD';

/* ─── Types ───────────────────────────────────────────── */
interface Msg { id: string; role: 'user' | 'assistant'; content: string; ts: Date; model?: string; }

/* ─── Prompt système basé sur les données réelles ────── */
function buildSystemPrompt(projets: ReturnType<typeof useProjectStore>['projets'], userName: string): string {
  const total  = projets.length;
  const actifs = projets.filter(p => p.statut === 'en_cours');
  const avgAv  = total > 0 ? Math.round(projets.reduce((s, p) => s + p.avancement, 0) / total) : 0;
  const avgCpi = total > 0 ? (projets.reduce((s, p) => s + p.cpi, 0) / total).toFixed(2) : '1.00';
  const avgSpi = total > 0 ? (projets.reduce((s, p) => s + p.spi, 0) / total).toFixed(2) : '1.00';
  const tBudget = projets.reduce((s, p) => s + p.budget, 0);
  const tDec    = projets.reduce((s, p) => s + p.budgetDecaisse, 0);
  const enRetard = projets.filter(p => p.spi < 0.85 || p.statut === 'en_retard');
  const critiques = projets.filter(p => p.cpi < 0.90 || p.spi < 0.80);

  const projList = projets.slice(0, 40).map(p => {
    const bailleur = p.bailleurs?.[0]?.nom ?? 'SENELEC';
    const jalonsAtteints = (p.jalons ?? []).filter(j => j.atteint).length;
    const jalonsTotal    = (p.jalons ?? []).length;
    return `- ${p.code} | ${p.nom.slice(0, 50)} | ${p.domaine} | ${p.region} | Av:${p.avancement}% | CPI:${p.cpi.toFixed(2)} | SPI:${p.spi.toFixed(2)} | Budget:${p.budget}MFCFA | Décaissé:${p.budgetDecaisse}MFCFA | Statut:${p.statut} | Chef:${p.chefProjet} | Bailleur:${bailleur} | Jalons:${jalonsAtteints}/${jalonsTotal}`;
  }).join('\n');

  const retardList = enRetard.slice(0, 10).map(p =>
    `- ${p.code} | SPI:${p.spi.toFixed(2)} | CPI:${p.cpi.toFixed(2)} | ${p.nom.slice(0, 40)} | Chef:${p.chefProjet}`
  ).join('\n');

  return `Tu es le **Copilot IA officiel de SIGEPP-DPE** — la plateforme de gouvernance de projets de SENELEC (Direction Principale Équipement, Sénégal).

## Ton rôle
Expert sénior en gestion de projets d'infrastructure électrique. Tu analyses le portefeuille en temps réel, fournis des recommandations stratégiques et opérationnelles précises, assistes dans la prise de décision et la rédaction de documents officiels SENELEC.

## Utilisateur connecté
Nom: ${userName} | Plateforme: SIGEPP-DPE | Organisation: SENELEC DPE

## DONNÉES PORTEFEUILLE TEMPS RÉEL (${new Date().toLocaleDateString('fr-FR')})
- Total projets: ${total} | Actifs: ${actifs.length}
- Avancement moyen: ${avgAv}% | CPI moyen: ${avgCpi} | SPI moyen: ${avgSpi}
- Budget total: ${tBudget.toLocaleString('fr-FR')} MFCFA | Décaissé: ${tDec.toLocaleString('fr-FR')} MFCFA (${tBudget > 0 ? Math.round((tDec / tBudget) * 100) : 0}%)
- Projets en retard (SPI<0.85): ${enRetard.length} | Projets critiques (CPI<0.90 ou SPI<0.80): ${critiques.length}

## LISTE DES PROJETS (données réelles)
${projList}

${enRetard.length > 0 ? `## PROJETS EN ALERTE\n${retardList}` : ''}

## Instructions de réponse
- Réponds TOUJOURS en **français**
- Utilise des **tableaux markdown** pour toutes données comparatives
- Donne toujours au moins **une recommandation d'action concrète et chiffrée**
- Format montants: X MFCFA ou X Md FCFA
- Sois direct, factuel, orienté décision — pas de généralités vagues
- Pour les analyses de projet: inclus EVM (CPI, SPI, EAC, TCPI, VAC)
- Pour les retards: propose un plan de rattrapage avec dates et responsables
- Utilise le contexte réel des projets listés ci-dessus`;
}

/* ─── Rendu Markdown riche ───────────────────────────── */
function MarkdownBlock({ text }: { text: string }) {
  const lines = text.split('\n');
  const elements: React.ReactNode[] = [];
  let i = 0;

  function parseInline(s: string, key?: string): React.ReactNode[] {
    const parts: React.ReactNode[] = [];
    const re = /(\*\*(.+?)\*\*|`([^`]+)`|\*(.+?)\*)/g;
    let last = 0; let m: RegExpExecArray | null;
    while ((m = re.exec(s)) !== null) {
      if (m.index > last) parts.push(s.slice(last, m.index));
      if (m[2] !== undefined) parts.push(<strong key={`${key}-${m.index}`} style={{ fontWeight: 700, color: NAVY }}>{m[2]}</strong>);
      else if (m[3] !== undefined) parts.push(<code key={`${key}-${m.index}`} style={{ fontFamily: 'monospace', background: '#F1F5F9', padding: '1px 5px', borderRadius: 4, fontSize: '0.88em', color: '#7C3AED' }}>{m[3]}</code>);
      else if (m[4] !== undefined) parts.push(<em key={`${key}-${m.index}`}>{m[4]}</em>);
      last = m.index + m[0].length;
    }
    if (last < s.length) parts.push(s.slice(last));
    return parts;
  }

  while (i < lines.length) {
    const line = lines[i];

    // Table
    if (line.trim().startsWith('|') && i + 1 < lines.length && lines[i + 1].trim().startsWith('|---')) {
      const headers = line.split('|').filter(c => c.trim()).map(c => c.trim());
      i += 2;
      const rows: string[][] = [];
      while (i < lines.length && lines[i].trim().startsWith('|')) {
        rows.push(lines[i].split('|').filter(c => c.trim()).map(c => c.trim()));
        i++;
      }
      elements.push(
        <div key={`tbl-${i}`} style={{ overflowX: 'auto', margin: '10px 0', borderRadius: 8, border: `1px solid ${BORDER}` }}>
          <table style={{ borderCollapse: 'collapse', width: '100%', fontSize: 11.5 }}>
            <thead>
              <tr style={{ background: NAVY }}>
                {headers.map((h, j) => <th key={j} style={{ padding: '7px 11px', color: '#fff', textAlign: 'left', fontWeight: 700, whiteSpace: 'nowrap', fontSize: 11 }}>{h}</th>)}
              </tr>
            </thead>
            <tbody>
              {rows.map((row, ri) => (
                <tr key={ri} style={{ background: ri % 2 === 0 ? '#F8FAFC' : '#fff', borderBottom: `1px solid ${BORDER}` }}>
                  {row.map((cell, ci) => <td key={ci} style={{ padding: '6px 11px', color: '#334155', fontSize: 11 }}>{parseInline(cell, `cell-${ri}-${ci}`)}</td>)}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      );
      continue;
    }

    // Headings
    if (/^### (.+)/.test(line)) {
      elements.push(<h3 key={i} style={{ fontSize: 12.5, fontWeight: 800, color: NAVY, margin: '12px 0 4px', borderLeft: `3px solid ${ORANGE}`, paddingLeft: 8 }}>{parseInline(line.slice(4))}</h3>);
    } else if (/^## (.+)/.test(line)) {
      elements.push(<h2 key={i} style={{ fontSize: 13.5, fontWeight: 800, color: NAVY, margin: '14px 0 6px', borderBottom: `2px solid ${BORDER}`, paddingBottom: 4 }}>{parseInline(line.slice(3))}</h2>);
    } else if (/^# (.+)/.test(line)) {
      elements.push(<h1 key={i} style={{ fontSize: 15, fontWeight: 900, color: NAVY, margin: '16px 0 8px' }}>{parseInline(line.slice(2))}</h1>);
    } else if (line.startsWith('> ')) {
      elements.push(<blockquote key={i} style={{ borderLeft: `3px solid ${ORANGE}`, paddingLeft: 12, margin: '8px 0', color: '#64748B', fontStyle: 'italic', fontSize: 12 }}>{parseInline(line.slice(2))}</blockquote>);
    } else if (/^---+$/.test(line.trim())) {
      elements.push(<hr key={i} style={{ border: 'none', borderTop: `1px solid ${BORDER}`, margin: '12px 0' }} />);
    } else if (/^[-•*]\s/.test(line)) {
      const bullets: string[] = [];
      while (i < lines.length && /^[-•*]\s/.test(lines[i])) {
        bullets.push(lines[i].replace(/^[-•*]\s/, ''));
        i++;
      }
      elements.push(
        <ul key={`ul-${i}`} style={{ margin: '4px 0', paddingLeft: 18 }}>
          {bullets.map((b, bi) => <li key={bi} style={{ fontSize: 12.5, color: '#334155', marginBottom: 3, lineHeight: 1.55 }}>{parseInline(b, `li-${bi}`)}</li>)}
        </ul>
      );
      continue;
    } else if (/^\d+\.\s/.test(line)) {
      const items: string[] = [];
      while (i < lines.length && /^\d+\.\s/.test(lines[i])) {
        items.push(lines[i].replace(/^\d+\.\s/, ''));
        i++;
      }
      elements.push(
        <ol key={`ol-${i}`} style={{ margin: '4px 0', paddingLeft: 18 }}>
          {items.map((it, ii) => <li key={ii} style={{ fontSize: 12.5, color: '#334155', marginBottom: 3, lineHeight: 1.55 }}>{parseInline(it, `oi-${ii}`)}</li>)}
        </ol>
      );
      continue;
    } else if (!line.trim()) {
      elements.push(<div key={i} style={{ height: 5 }} />);
    } else {
      elements.push(<p key={i} style={{ fontSize: 12.5, color: '#334155', margin: '2px 0', lineHeight: 1.6 }}>{parseInline(line, `p-${i}`)}</p>);
    }
    i++;
  }
  return <>{elements}</>;
}

/* ─── Suggestions dynamiques ─────────────────────────── */
function buildSuggestions(projets: ReturnType<typeof useProjectStore>['projets']) {
  const retards   = projets.filter(p => p.spi < 0.85).slice(0, 2);
  const topBudget = [...projets].sort((a, b) => b.budget - a.budget)[0];

  return [
    { icon: <BarChart3 size={12} />, label: 'Performance portefeuille', q: 'Analyse complète des KPIs du portefeuille DPE avec tableau comparatif CPI/SPI par domaine et par région' },
    ...(retards.length > 0 ? [{ icon: <AlertTriangle size={12} />, label: `${retards.length} projet(s) en retard`, q: `Analyse détaillée des projets en retard : ${retards.map(p => p.code).join(', ')}. Causes probables et plans de rattrapage recommandés avec jalons de contrôle.` }] : []),
    { icon: <DollarSign size={12} />, label: 'Situation budgétaire', q: 'Tableau complet de la situation budgétaire par domaine et par bailleur avec analyse des écarts et taux de décaissement' },
    ...(topBudget ? [{ icon: <TrendingUp size={12} />, label: `Analyse ${topBudget.code}`, q: `Analyse complète EVM du projet ${topBudget.code} — ${topBudget.nom} : performance coût/délai, risques identifiés, recommandations` }] : []),
    { icon: <Calendar size={12} />, label: 'Jalons critiques', q: 'Quels sont les jalons les plus critiques à court terme ? Analyse des risques de dérive planning.' },
    { icon: <MapPin size={12} />, label: 'Couverture SIG', q: 'Situation de la couverture électrique par région — localités MES, en cours de travaux et taux d\'électrification estimé' },
    { icon: <FileText size={12} />, label: 'Note de comité', q: 'Prépare une note de synthèse executive pour le comité de pilotage DPE — format officiel SENELEC avec tableau de bord et points d\'alerte' },
    { icon: <Sparkles size={12} />, label: 'Rapport bailleur', q: 'Rédige une note de synthèse destinée aux bailleurs (BM/AFD/BAD) sur l\'état d\'avancement du portefeuille — format trimestriel' },
  ].slice(0, 7);
}

/* ─── Composant principal ─────────────────────────────── */
export default function Copilot() {
  const { user }  = useAuth();
  const store     = useProjectStore();
  const userName  = user ? `${user.prenom} ${user.nom}` : 'Utilisateur';

  const [messages,    setMessages]    = useState<Msg[]>([]);
  const [input,       setInput]       = useState('');
  const [streaming,   setStreaming]   = useState(false);
  const [streamingId, setStreamingId] = useState<string | null>(null);
  const [model,       setModel]       = useState<'fast' | 'smart'>('smart');
  const [showModel,   setShowModel]   = useState(false);
  const [copiedId,    setCopiedId]    = useState<string | null>(null);
  const [keyOk,       setKeyOk]       = useState<boolean | null>(null);

  const abortRef = useRef<AbortController | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef  = useRef<HTMLTextAreaElement>(null);

  const systemPrompt = useMemo(() => buildSystemPrompt(store.projets, userName), [store.projets, userName]);
  const suggestions  = useMemo(() => buildSuggestions(store.projets), [store.projets]);

  useEffect(() => { setKeyOk(getKey().startsWith('gsk_')); }, []);

  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [messages]);

  // Message de bienvenue avec données réelles
  useEffect(() => {
    if (messages.length === 0) {
      const p  = store.projets;
      const tb = p.reduce((s, x) => s + x.budget, 0);
      const td = p.reduce((s, x) => s + x.budgetDecaisse, 0);
      const alertes = p.filter(x => x.cpi < 0.9 || x.spi < 0.85).length;
      const decPct  = tb > 0 ? Math.round((td / tb) * 100) : 0;
      const avgCpi  = p.length > 0 ? (p.reduce((s, x) => s + x.cpi, 0) / p.length).toFixed(2) : '—';
      const avgSpi  = p.length > 0 ? (p.reduce((s, x) => s + x.spi, 0) / p.length).toFixed(2) : '—';
      setMessages([{
        id: 'welcome',
        role: 'assistant',
        ts: new Date(),
        content: `Bonjour **${userName}** — Copilot DPE connecté au portefeuille en temps réel.\n\n## Tableau de bord synthétique\n| Indicateur | Valeur |\n|---|---|\n| Projets au portefeuille | **${p.length}** |\n| Budget total | **${tb.toLocaleString('fr-FR')} MFCFA** |\n| Taux de décaissement | **${decPct}%** |\n| CPI moyen | **${avgCpi}** |\n| SPI moyen | **${avgSpi}** |\n| Projets en alerte | **${alertes}** 🔴 |\n\nPosez-moi une question précise sur vos projets, le budget, les risques ou la planification — je travaille sur vos **données réelles SIGEPP-DPE**.`,
      }]);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const send = useCallback(async (text?: string) => {
    const q = (text ?? input).trim();
    if (!q || streaming) return;
    if (!keyOk) { toast.error('Clé Groq non configurée — allez dans Paramètres > Migration.'); return; }

    setInput('');
    // Reset textarea height
    if (inputRef.current) { inputRef.current.style.height = 'auto'; }

    const uid  = `u-${Date.now()}`;
    const aid  = `a-${Date.now() + 1}`;
    const userMsg: Msg = { id: uid, role: 'user',      content: q, ts: new Date() };
    const asstMsg: Msg = { id: aid, role: 'assistant', content: '', ts: new Date(), model: GROQ_MODELS[model] };

    setMessages(prev => [...prev, userMsg, asstMsg]);
    setStreaming(true);
    setStreamingId(aid);

    const history: ChatMessage[] = [
      { role: 'system', content: systemPrompt },
      ...messages.slice(-8).map(m => ({ role: m.role as 'user' | 'assistant', content: m.content })),
      { role: 'user', content: q },
    ];

    abortRef.current = new AbortController();
    try {
      await streamChat(history, {
        model: GROQ_MODELS[model],
        temperature: 0.35,
        maxTokens: 2048,
        signal: abortRef.current.signal,
        onToken: (token) => {
          setMessages(prev => prev.map(m => m.id === aid ? { ...m, content: m.content + token } : m));
        },
      });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Erreur Groq';
      if (!msg.includes('abort')) {
        toast.error(msg);
        setMessages(prev => prev.map(m => m.id === aid ? { ...m, content: `❌ ${msg}` } : m));
      } else {
        setMessages(prev => prev.map(m => m.id === aid ? { ...m, content: m.content + '\n\n*[Génération interrompue]*' } : m));
      }
    } finally {
      setStreaming(false);
      setStreamingId(null);
      inputRef.current?.focus();
    }
  }, [input, streaming, keyOk, messages, systemPrompt, model]);

  const stop = () => abortRef.current?.abort();

  const copyMsg = (content: string, id: string) => {
    navigator.clipboard.writeText(content).then(() => {
      setCopiedId(id);
      setTimeout(() => setCopiedId(null), 2000);
    });
  };

  const exportPDF = () => {
    const pw = window.open('', '_blank');
    if (!pw) return;
    const rows = messages.map(m => {
      const html = m.content
        .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
        .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
        .replace(/\n/g, '<br/>');
      return `<div style="margin-bottom:14px;display:flex;gap:10px;flex-direction:${m.role === 'user' ? 'row-reverse' : 'row'};align-items:flex-start"><div style="width:26px;height:26px;border-radius:6px;flex-shrink:0;background:${m.role === 'user' ? NAVY : '#EFF6FF'};display:flex;align-items:center;justify-content:center;font-size:9px;font-weight:800;color:${m.role === 'user' ? '#fff' : NAVY}">${m.role === 'user' ? 'V' : 'IA'}</div><div style="max-width:82%;padding:9px 13px;border-radius:${m.role === 'user' ? '12px 12px 2px 12px' : '12px 12px 12px 2px'};background:${m.role === 'user' ? NAVY : '#F8FAFC'};border:1px solid ${m.role === 'user' ? 'transparent' : BORDER};font-size:11px;color:${m.role === 'user' ? '#fff' : '#1E293B'};line-height:1.65">${html}<div style="font-size:8px;margin-top:5px;opacity:0.45">${m.ts.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}</div></div></div>`;
    }).join('');
    pw.document.write(`<!DOCTYPE html><html lang="fr"><head><meta charset="UTF-8"><title>Copilot DPE</title><style>body{font-family:'Segoe UI',Arial,sans-serif;padding:32px 40px;color:#1E293B;font-size:11px;max-width:760px;margin:0 auto}strong{color:${NAVY};font-weight:700}.bar{height:4px;background:${ORANGE};margin-bottom:20px}h1{font-size:16px;font-weight:800;color:#0F172A;margin:0 0 4px}.meta{font-size:9px;color:#64748B;margin-bottom:24px}.footer{margin-top:32px;padding-top:12px;border-top:1px solid ${BORDER};font-size:8px;color:#94A3B8;text-align:center}</style></head><body><div class="bar"></div><div style="margin-bottom:10px"><img src="${SENELEC_LOGO_DATA_URI}" alt="SENELEC" style="height:38px;width:auto;display:block"/></div><h1>Conversation Copilot DPE — SIGEPP</h1><div class="meta">Exportée le ${new Date().toLocaleDateString('fr-FR', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })} · ${messages.length} messages · Modèle: ${GROQ_MODELS[model]}</div>${rows}<div class="footer">CONFIDENTIEL — Usage interne SENELEC DPE · Généré par SIGEPP-DPE Copilot IA</div></body></html>`);
    pw.document.close();
    setTimeout(() => pw.print(), 500);
  };

  return (
    <div style={{ display: 'flex', height: '100%', overflow: 'hidden', background: BG }}>

      {/* ── Sidebar gauche ── */}
      <div style={{ width: 210, flexShrink: 0, borderRight: `1px solid ${BORDER}`, display: 'flex', flexDirection: 'column', background: '#fff' }}>
        <div style={{ padding: '12px 10px 8px' }}>
          <button
            onClick={() => { setMessages([]); setTimeout(() => setMessages([]), 50); }}
            style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 6, padding: '8px 11px', borderRadius: 8, border: `1px solid ${BORDER}`, background: BG, cursor: 'pointer', fontSize: 12, fontWeight: 600, color: NAVY, fontFamily: 'inherit' }}
          >
            <Plus size={13} /> Nouvelle conversation
          </button>
        </div>

        {/* Suggestions */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '0 6px 8px' }}>
          <div style={{ fontSize: 9, fontWeight: 700, color: '#94A3B8', textTransform: 'uppercase', letterSpacing: '0.09em', padding: '8px 4px 4px' }}>Analyses rapides</div>
          {suggestions.map((s, i) => (
            <button key={i} onClick={() => send(s.q)} disabled={streaming}
              style={{ width: '100%', textAlign: 'left', padding: '7px 8px', borderRadius: 7, border: 'none', background: 'transparent', cursor: streaming ? 'not-allowed' : 'pointer', fontSize: 11, color: '#475569', display: 'flex', alignItems: 'flex-start', gap: 7, marginBottom: 1, opacity: streaming ? 0.5 : 1, fontFamily: 'inherit' }}
              onMouseEnter={e => { if (!streaming) e.currentTarget.style.background = '#F1F5F9'; }}
              onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; }}
            >
              <span style={{ color: ORANGE, flexShrink: 0, marginTop: 1 }}>{s.icon}</span>
              <span style={{ lineHeight: 1.4 }}>{s.label}</span>
            </button>
          ))}
        </div>

        {/* Stats rapides */}
        <div style={{ padding: '10px 12px', borderTop: `1px solid ${BORDER}` }}>
          {(() => {
            const p  = store.projets;
            const tb = p.reduce((s, x) => s + x.budget, 0);
            const td = p.reduce((s, x) => s + x.budgetDecaisse, 0);
            return [
              { l: 'Projets',         v: String(p.length),                                                           c: NAVY      },
              { l: 'Alertes CPI/SPI', v: String(p.filter(x => x.cpi < 0.9 || x.spi < 0.85).length),                 c: '#EF3340' },
              { l: 'Budget',          v: `${(tb / 1000).toFixed(1)} Md`,                                             c: '#7C3AED' },
              { l: 'Décaissé',        v: `${tb > 0 ? Math.round((td / tb) * 100) : 0}%`,                             c: '#16A34A' },
            ].map(s => (
              <div key={s.l} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 5 }}>
                <span style={{ fontSize: 10, color: '#94A3B8' }}>{s.l}</span>
                <span style={{ fontSize: 12, fontWeight: 800, color: s.c }}>{s.v}</span>
              </div>
            ));
          })()}
        </div>
      </div>

      {/* ── Zone chat ── */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>

        {/* Header */}
        <div style={{ padding: '10px 18px', borderBottom: `1px solid ${BORDER}`, display: 'flex', alignItems: 'center', gap: 10, flexShrink: 0, background: '#fff' }}>
          <div style={{ width: 36, height: 36, borderRadius: 10, background: `linear-gradient(135deg, ${NAVY}, #2563EB)`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
            <Bot size={18} color="#fff" />
          </div>
          <div style={{ flex: 1 }}>
            <div style={{ fontWeight: 800, fontSize: 14, color: NAVY }}>Copilot DPE · SIGEPP</div>
            <div style={{ fontSize: 10, color: '#94A3B8' }}>
              {keyOk === false ? '⚠ Clé Groq non configurée' : keyOk === true ? `🟢 Connecté · ${store.projets.length} projets chargés · Groq ${GROQ_MODELS[model]}` : '…'}
            </div>
          </div>
          <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
            {messages.length > 1 && (
              <button onClick={exportPDF} style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '5px 10px', borderRadius: 7, border: `1px solid ${BORDER}`, background: '#fff', cursor: 'pointer', fontSize: 11, fontWeight: 600, color: NAVY, fontFamily: 'inherit' }}>
                <Download size={12} /> Exporter
              </button>
            )}
            {/* Sélecteur modèle */}
            <div style={{ position: 'relative' }}>
              <button onClick={() => setShowModel(v => !v)}
                style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '5px 9px', borderRadius: 7, border: `1px solid ${BORDER}`, background: '#fff', cursor: 'pointer', fontSize: 11, color: '#475569', fontFamily: 'inherit' }}>
                <Settings2 size={12} />
                {model === 'smart' ? '70B' : '8B'}
                <ChevronDown size={10} />
              </button>
              {showModel && (
                <div style={{ position: 'absolute', right: 0, top: '110%', background: '#fff', border: `1px solid ${BORDER}`, borderRadius: 8, boxShadow: '0 8px 24px rgba(0,0,0,0.1)', zIndex: 50, minWidth: 230, padding: 6 }}>
                  {([['smart', 'llama-3.3-70b-versatile', 'Analyses complexes, rapport de qualité', NAVY], ['fast', 'llama-3.1-8b-instant', 'Réponses rapides, questions simples', '#7C3AED']] as const).map(([key, name, desc, color]) => (
                    <button key={key} onClick={() => { setModel(key); setShowModel(false); }}
                      style={{ width: '100%', textAlign: 'left', padding: '8px 10px', borderRadius: 6, border: 'none', background: model === key ? '#F0F4FF' : 'transparent', cursor: 'pointer', fontFamily: 'inherit' }}>
                      <div style={{ fontSize: 12, fontWeight: model === key ? 700 : 500, color }}>{name}</div>
                      <div style={{ fontSize: 10, color: '#94A3B8', marginTop: 1 }}>{desc}</div>
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Messages */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '20px 22px', display: 'flex', flexDirection: 'column', gap: 16 }} onClick={() => showModel && setShowModel(false)}>
          {messages.map(m => (
            <div key={m.id} style={{ display: 'flex', gap: 10, flexDirection: m.role === 'user' ? 'row-reverse' : 'row', alignItems: 'flex-start' }}>
              <div style={{ width: 30, height: 30, borderRadius: 8, flexShrink: 0, background: m.role === 'user' ? NAVY : '#EFF6FF', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                {m.role === 'user' ? <User size={14} color="#fff" /> : <Bot size={14} color={NAVY} />}
              </div>
              <div style={{ maxWidth: '80%', position: 'relative' }}>
                <div style={{
                  padding: '10px 14px',
                  borderRadius: m.role === 'user' ? '13px 13px 3px 13px' : '13px 13px 13px 3px',
                  background: m.role === 'user' ? NAVY : '#fff',
                  border: m.role === 'user' ? 'none' : `1px solid ${BORDER}`,
                  boxShadow: '0 1px 3px rgba(0,0,0,0.06)',
                  color: m.role === 'user' ? '#fff' : '#1E293B',
                }}>
                  {m.role === 'user'
                    ? <p style={{ fontSize: 13, margin: 0, lineHeight: 1.55 }}>{m.content}</p>
                    : <>
                        <MarkdownBlock text={m.content} />
                        {m.id === streamingId && streaming && (
                          <span style={{ display: 'inline-block', width: 7, height: 13, background: NAVY, borderRadius: 1, marginLeft: 2, animation: 'blink 0.8s step-end infinite' }} />
                        )}
                      </>
                  }
                  <div style={{ fontSize: 9, marginTop: 5, opacity: 0.45, textAlign: m.role === 'user' ? 'right' : 'left', display: 'flex', alignItems: 'center', gap: 5, justifyContent: m.role === 'user' ? 'flex-end' : 'flex-start' }}>
                    <span>{m.ts.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}</span>
                    {m.model && <span>· {m.model.split('-').slice(0, 2).join('-')}</span>}
                  </div>
                </div>
                {m.content && m.id !== streamingId && (
                  <button onClick={() => copyMsg(m.content, m.id)} aria-label="Copier"
                    style={{ position: 'absolute', top: 6, [m.role === 'user' ? 'left' : 'right']: -28, background: '#fff', border: `1px solid ${BORDER}`, borderRadius: 6, padding: 4, cursor: 'pointer', display: 'flex', opacity: 0, transition: 'opacity 0.15s' }}
                    onMouseEnter={e => { e.currentTarget.style.opacity = '1'; }}
                    onMouseLeave={e => { e.currentTarget.style.opacity = '0'; }}
                  >
                    {copiedId === m.id ? <Check size={11} color="#16A34A" /> : <Copy size={11} color="#64748B" />}
                  </button>
                )}
              </div>
            </div>
          ))}

          {/* Indicateur de typing */}
          {streaming && messages.length > 0 && messages[messages.length - 1]?.content === '' && (
            <div style={{ display: 'flex', gap: 10, alignItems: 'flex-start' }}>
              <div style={{ width: 30, height: 30, borderRadius: 8, background: '#EFF6FF', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                <Bot size={14} color={NAVY} />
              </div>
              <div style={{ padding: '12px 16px', borderRadius: '13px 13px 13px 3px', background: '#fff', border: `1px solid ${BORDER}`, display: 'flex', gap: 5, alignItems: 'center' }}>
                {[0, 1, 2].map(i => (
                  <div key={i} style={{ width: 6, height: 6, borderRadius: '50%', background: ORANGE, animation: `wave 1.3s ease-in-out ${i * 0.18}s infinite` }} />
                ))}
              </div>
            </div>
          )}
          <div ref={bottomRef} />
        </div>

        {/* Zone de saisie */}
        <div style={{ padding: '11px 18px 13px', borderTop: `1px solid ${BORDER}`, background: '#fff', flexShrink: 0 }}>
          {keyOk === false && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '7px 11px', borderRadius: 7, background: '#FEF3C7', border: '1px solid #FCD34D', marginBottom: 8, fontSize: 11, color: '#92400E' }}>
              <AlertTriangle size={12} />
              Clé Groq manquante — configurez <strong style={{ margin: '0 3px' }}>NEXT_PUBLIC_GROQ_API_KEY</strong> ou saisissez-la dans Migration.
            </div>
          )}
          <div style={{ display: 'flex', gap: 8, alignItems: 'flex-end' }}>
            <textarea
              ref={inputRef}
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); void send(); } }}
              onInput={e => { const t = e.currentTarget; t.style.height = 'auto'; t.style.height = Math.min(t.scrollHeight, 120) + 'px'; }}
              placeholder="Posez une question sur vos projets, budget, risques, planning… (Entrée pour envoyer, Maj+Entrée pour nouvelle ligne)"
              rows={1}
              disabled={streaming}
              style={{ flex: 1, resize: 'none', padding: '9px 12px', fontSize: 12.5, fontFamily: 'inherit', border: `1px solid ${streaming ? ORANGE : BORDER}`, borderRadius: 9, outline: 'none', lineHeight: 1.5, background: '#fff', color: '#1E293B', transition: 'border-color 0.2s', maxHeight: 120, overflowY: 'auto' }}
            />
            {streaming
              ? <button onClick={stop} style={{ padding: '9px 12px', borderRadius: 8, border: 'none', background: '#FEE2E2', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 5, flexShrink: 0, color: '#DC2626', fontSize: 11, fontWeight: 700, fontFamily: 'inherit' }}>
                  <StopCircle size={14} /> Stop
                </button>
              : <button onClick={() => void send()} disabled={!input.trim()} aria-label="Envoyer"
                  style={{ padding: '9px 12px', borderRadius: 8, border: 'none', background: input.trim() ? NAVY : '#E2E8F0', cursor: input.trim() ? 'pointer' : 'not-allowed', display: 'flex', alignItems: 'center', flexShrink: 0, color: input.trim() ? '#fff' : '#94A3B8', transition: 'background 0.15s' }}>
                  <Send size={15} />
                </button>
            }
          </div>
          {/* Pills de raccourcis */}
          <div style={{ display: 'flex', gap: 5, marginTop: 7, flexWrap: 'wrap' }}>
            {[
              { l: 'Rapport T2 2026', q: 'Génère le rapport trimestriel T2 2026 du portefeuille DPE avec tableau de bord complet, indicateurs clés et points d\'attention' },
              { l: 'EVM global',       q: 'Analyse EVM complète du portefeuille : tableau CPI / SPI / EAC / VAC / TCPI pour chaque projet actif' },
              { l: 'Risques critiques',q: 'Liste tous les projets avec CPI < 0.90 ou SPI < 0.85 dans un tableau avec causes probables et recommandations d\'actions correctives' },
              { l: 'Plan de charge',   q: 'Analyse de la charge des chefs de projet : combien de projets actifs par chef ? Recommande une redistribution si déséquilibré' },
            ].map(p => (
              <button key={p.l} onClick={() => void send(p.q)} disabled={streaming}
                style={{ fontSize: 10, padding: '3px 9px', borderRadius: 20, border: `1px solid ${BORDER}`, background: '#fff', color: '#64748B', cursor: streaming ? 'not-allowed' : 'pointer', fontFamily: 'inherit', transition: 'all 0.12s', opacity: streaming ? 0.45 : 1, whiteSpace: 'nowrap' }}
                onMouseEnter={e => { if (!streaming) { e.currentTarget.style.borderColor = NAVY; e.currentTarget.style.color = NAVY; } }}
                onMouseLeave={e => { e.currentTarget.style.borderColor = BORDER; e.currentTarget.style.color = '#64748B'; }}
              >
                {p.l}
              </button>
            ))}
          </div>
        </div>
      </div>

      <style>{`
        @keyframes blink { 0%,100%{opacity:1} 50%{opacity:0} }
        @keyframes wave  { 0%,80%,100%{transform:scale(0.6);opacity:0.4} 40%{transform:scale(1.0);opacity:1} }
      `}</style>
    </div>
  );
}

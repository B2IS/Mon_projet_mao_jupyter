'use client';

import { useState, useCallback, useMemo } from 'react';
import {
  Bot, Briefcase, Calendar, Wallet, Shield, MapPin,
  ClipboardList, Loader2, CheckCircle2, AlertTriangle,
  Download, RefreshCw, ChevronDown, ChevronUp, Play,
  Sparkles, BarChart3, Users,
} from 'lucide-react';
import { useProjectStore } from '@/lib/projectStore';
import { useAuth } from '@/lib/authStore';
import { chatOnce, getKey, GROQ_MODELS, type ChatMessage } from '@/lib/groqChat';
import { SENELEC_LOGO_DATA_URI } from '@/lib/senelecLogo';
import toast from 'react-hot-toast';

/* ─── Tokens ──────────────────────────────────────────── */
const NAVY   = '#1B4F8A';
const ORANGE = '#F47920';
const BORDER = '#E2E8F0';
const BG     = '#F8FAFD';

/* ─── Types ───────────────────────────────────────────── */
type AgentStatus = 'idle' | 'running' | 'done' | 'error';

interface AgentResult {
  id: string;
  label: string;
  icon: React.ReactNode;
  color: string;
  status: AgentStatus;
  output: string;
  duration?: number;
  model?: string;
}

interface ProjetOption { code: string; nom: string; avancement: number; cpi: number; spi: number; }

/* ─── Définitions des 6 agents ───────────────────────── */
const AGENT_DEFS: Array<{ id: string; label: string; icon: React.ReactNode; color: string; persona: string; }> = [
  {
    id: 'directeur',
    label: 'Directeur / Stratégie',
    icon: <Briefcase size={16} />,
    color: NAVY,
    persona: 'Tu es le Directeur Stratégique DPE. Analyse la performance globale du portefeuille, les alignements stratégiques, les risques au niveau direction et les recommandations de gouvernance.',
  },
  {
    id: 'planificateur',
    label: 'Planificateur',
    icon: <Calendar size={16} />,
    color: '#0891B2',
    persona: 'Tu es l\'expert Planification & Scheduling. Analyse le planning, les jalons, les dépendances critiques, les retards, le chemin critique et propose des plans de rattrapage détaillés.',
  },
  {
    id: 'financier',
    label: 'Financier / EVM',
    icon: <Wallet size={16} />,
    color: '#16A34A',
    persona: 'Tu es l\'expert Contrôle Financier et EVM. Analyse le budget, les indices CPI/SPI, EAC, VAC, TCPI, les écarts de coût, les décaissements par bailleur, les engagements marchés.',
  },
  {
    id: 'risques',
    label: 'Risques & QHSE',
    icon: <Shield size={16} />,
    color: '#DC2626',
    persona: 'Tu es l\'expert Risques et QHSE. Identifie les risques techniques, contractuels, environnementaux et QHSE. Évalue la probabilité et l\'impact. Propose des mesures d\'atténuation chiffrées.',
  },
  {
    id: 'sig',
    label: 'SIG / Terrain',
    icon: <MapPin size={16} />,
    color: '#7C3AED',
    persona: 'Tu es l\'expert SIG et Opérations Terrain. Analyse la couverture géographique, les localités MES, les taux d\'électrification régionaux, les contraintes terrain et l\'avancement physique.',
  },
  {
    id: 'chef_projet',
    label: 'Chef de Projet',
    icon: <ClipboardList size={16} />,
    color: ORANGE,
    persona: 'Tu es le Chef de Projet sénior PMI/PMP. Analyse l\'exécution opérationnelle, la mobilisation des ressources, les contrats, les blocages et formule des recommandations d\'actions immédiates prioritaires.',
  },
];

/* ─── Markdown compact ───────────────────────────────── */
function MiniMarkdown({ text }: { text: string }) {
  const lines = text.split('\n');
  const elems: React.ReactNode[] = [];
  let i = 0;

  function inline(s: string, k?: string): React.ReactNode[] {
    const parts: React.ReactNode[] = [];
    const re = /(\*\*(.+?)\*\*|`([^`]+)`)/g;
    let last = 0; let m: RegExpExecArray | null;
    while ((m = re.exec(s)) !== null) {
      if (m.index > last) parts.push(s.slice(last, m.index));
      if (m[2] !== undefined) parts.push(<strong key={`${k}-${m.index}`} style={{ fontWeight: 700, color: NAVY }}>{m[2]}</strong>);
      else if (m[3] !== undefined) parts.push(<code key={`${k}-${m.index}`} style={{ fontFamily: 'monospace', background: '#F1F5F9', padding: '0 4px', borderRadius: 3, fontSize: '0.87em', color: '#7C3AED' }}>{m[3]}</code>);
      last = m.index + m[0].length;
    }
    if (last < s.length) parts.push(s.slice(last));
    return parts;
  }

  while (i < lines.length) {
    const line = lines[i];
    if (line.trim().startsWith('|') && i + 1 < lines.length && lines[i + 1].trim().startsWith('|---')) {
      const headers = line.split('|').filter(c => c.trim()).map(c => c.trim());
      i += 2;
      const rows: string[][] = [];
      while (i < lines.length && lines[i].trim().startsWith('|')) {
        rows.push(lines[i].split('|').filter(c => c.trim()).map(c => c.trim()));
        i++;
      }
      elems.push(
        <div key={`t${i}`} style={{ overflowX: 'auto', margin: '8px 0', borderRadius: 6, border: `1px solid ${BORDER}` }}>
          <table style={{ borderCollapse: 'collapse', width: '100%', fontSize: 11 }}>
            <thead><tr style={{ background: NAVY }}>
              {headers.map((h, j) => <th key={j} style={{ padding: '5px 9px', color: '#fff', textAlign: 'left', fontWeight: 700, whiteSpace: 'nowrap' }}>{h}</th>)}
            </tr></thead>
            <tbody>
              {rows.map((row, ri) => (
                <tr key={ri} style={{ background: ri % 2 === 0 ? '#F8FAFC' : '#fff', borderBottom: `1px solid ${BORDER}` }}>
                  {row.map((cell, ci) => <td key={ci} style={{ padding: '5px 9px', color: '#334155', fontSize: 10.5 }}>{inline(cell)}</td>)}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      );
      continue;
    }
    if (/^##+ (.+)/.test(line)) {
      const txt = line.replace(/^#+ /, '');
      elems.push(<div key={i} style={{ fontSize: 12, fontWeight: 800, color: NAVY, margin: '10px 0 4px', borderLeft: `3px solid ${ORANGE}`, paddingLeft: 7 }}>{inline(txt)}</div>);
    } else if (/^[-•*]\s/.test(line)) {
      const bullets: string[] = [];
      while (i < lines.length && /^[-•*]\s/.test(lines[i])) { bullets.push(lines[i].replace(/^[-•*]\s/, '')); i++; }
      elems.push(<ul key={`ul${i}`} style={{ margin: '3px 0', paddingLeft: 16 }}>
        {bullets.map((b, bi) => <li key={bi} style={{ fontSize: 11.5, color: '#334155', marginBottom: 2, lineHeight: 1.5 }}>{inline(b)}</li>)}
      </ul>);
      continue;
    } else if (/^\d+\.\s/.test(line)) {
      const items: string[] = [];
      while (i < lines.length && /^\d+\.\s/.test(lines[i])) { items.push(lines[i].replace(/^\d+\.\s/, '')); i++; }
      elems.push(<ol key={`ol${i}`} style={{ margin: '3px 0', paddingLeft: 16 }}>
        {items.map((it, ii) => <li key={ii} style={{ fontSize: 11.5, color: '#334155', marginBottom: 2, lineHeight: 1.5 }}>{inline(it)}</li>)}
      </ol>);
      continue;
    } else if (!line.trim()) {
      elems.push(<div key={i} style={{ height: 4 }} />);
    } else {
      elems.push(<p key={i} style={{ fontSize: 11.5, color: '#334155', margin: '2px 0', lineHeight: 1.55 }}>{inline(line)}</p>);
    }
    i++;
  }
  return <>{elems}</>;
}

/* ─── Carte d'un agent ───────────────────────────────── */
function AgentCard({ agent, expanded, onToggle }: {
  agent: AgentResult;
  expanded: boolean;
  onToggle: () => void;
}) {
  const statusBg: Record<AgentStatus, string> = {
    idle:    '#F1F5F9',
    running: '#FFF7ED',
    done:    '#F0FDF4',
    error:   '#FEF2F2',
  };
  const statusBorder: Record<AgentStatus, string> = {
    idle:    BORDER,
    running: ORANGE,
    done:    '#86EFAC',
    error:   '#FECACA',
  };

  return (
    <div style={{ borderRadius: 10, border: `1px solid ${statusBorder[agent.status]}`, background: statusBg[agent.status], overflow: 'hidden', transition: 'border-color 0.3s' }}>
      <button
        onClick={onToggle}
        style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 10, padding: '11px 14px', background: 'transparent', border: 'none', cursor: 'pointer', textAlign: 'left', fontFamily: 'inherit' }}
      >
        <div style={{ width: 34, height: 34, borderRadius: 9, background: `${agent.color}15`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, color: agent.color }}>
          {agent.icon}
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 12.5, fontWeight: 700, color: '#1E293B' }}>{agent.label}</div>
          <div style={{ fontSize: 10.5, color: '#64748B', marginTop: 1 }}>
            {agent.status === 'idle'    && 'En attente'}
            {agent.status === 'running' && <span style={{ color: ORANGE, fontWeight: 600 }}>Analyse en cours…</span>}
            {agent.status === 'done'    && <span style={{ color: '#16A34A', fontWeight: 600 }}>Terminé {agent.duration ? `· ${agent.duration}s` : ''}</span>}
            {agent.status === 'error'   && <span style={{ color: '#DC2626', fontWeight: 600 }}>Erreur</span>}
          </div>
        </div>
        <div style={{ flexShrink: 0, display: 'flex', alignItems: 'center', gap: 8 }}>
          {agent.status === 'running' && <Loader2 size={16} style={{ color: ORANGE, animation: 'spin 1s linear infinite' }} />}
          {agent.status === 'done'    && <CheckCircle2 size={16} style={{ color: '#16A34A' }} />}
          {agent.status === 'error'   && <AlertTriangle size={16} style={{ color: '#DC2626' }} />}
          {agent.output && (expanded ? <ChevronUp size={14} color="#94A3B8" /> : <ChevronDown size={14} color="#94A3B8" />)}
        </div>
      </button>

      {expanded && agent.output && (
        <div style={{ padding: '0 14px 14px', borderTop: `1px solid ${statusBorder[agent.status]}` }}>
          <div style={{ paddingTop: 10 }}>
            <MiniMarkdown text={agent.output} />
          </div>
          {agent.model && (
            <div style={{ marginTop: 8, fontSize: 9.5, color: '#94A3B8' }}>Modèle: {agent.model}</div>
          )}
        </div>
      )}
    </div>
  );
}

/* ─── Composant principal ─────────────────────────────── */
export default function AgentsIA() {
  const { user }  = useAuth();
  const store     = useProjectStore();
  const userName  = user ? `${user.prenom} ${user.nom}` : 'Utilisateur';

  const [selectedCode,   setSelectedCode]   = useState<string>('all');
  const [agents,         setAgents]         = useState<AgentResult[]>(() =>
    AGENT_DEFS.map(d => ({ id: d.id, label: d.label, icon: d.icon, color: d.color, status: 'idle' as AgentStatus, output: '' }))
  );
  const [synthesis,      setSynthesis]      = useState<string>('');
  const [synthStatus,    setSynthStatus]    = useState<AgentStatus>('idle');
  const [running,        setRunning]        = useState(false);
  const [expanded,       setExpanded]       = useState<Record<string, boolean>>({});
  const [expandSynth,    setExpandSynth]    = useState(true);

  // Options de sélection de projet
  const projOptions = useMemo<ProjetOption[]>(() => {
    return store.projets.map(p => ({ code: p.code, nom: p.nom, avancement: p.avancement, cpi: p.cpi, spi: p.spi }));
  }, [store.projets]);

  // Données du projet sélectionné
  const selectedProjets = useMemo(() => {
    if (selectedCode === 'all') return store.projets;
    return store.projets.filter(p => p.code === selectedCode);
  }, [selectedCode, store.projets]);

  function buildProjectContext(): string {
    const ps = selectedProjets;
    const total = ps.length;
    const tb = ps.reduce((s, p) => s + p.budget, 0);
    const td = ps.reduce((s, p) => s + p.budgetDecaisse, 0);
    const avgCpi = total > 0 ? (ps.reduce((s, p) => s + p.cpi, 0) / total).toFixed(2) : 'N/A';
    const avgSpi = total > 0 ? (ps.reduce((s, p) => s + p.spi, 0) / total).toFixed(2) : 'N/A';
    const critiques = ps.filter(p => p.cpi < 0.90 || p.spi < 0.80);

    // Top 10 most critical projects (lowest CPI+SPI) — keep token budget under ~500
    const sorted = [...ps].sort((a, b) => (a.cpi + a.spi) - (b.cpi + b.spi)).slice(0, 10);

    // Ultra-compact single-line format
    const header = 'CODE|CPI|SPI|AVA%|VAC_M|REG|DOM';
    const rows = sorted.map(p => {
      const EAC = p.cpi > 0 ? p.budget / p.cpi : p.budget;
      const VAC = Math.round(p.budget - EAC);
      return `${p.code}|${p.cpi.toFixed(2)}|${p.spi.toFixed(2)}|${p.avancement}|${VAC}|${p.region.slice(0,6)}|${p.domaine.slice(0,6)}`;
    }).join('\n');

    return `SIGEPP-DPE SÉNÉGAL — ${selectedCode === 'all' ? 'PORTEFEUILLE' : `PROJET ${selectedCode}`} — ${new Date().toLocaleDateString('fr-FR')}
Projets:${total} | Budget:${Math.round(tb/1000)}Md | Décaissé:${Math.round(td/tb*100)}% | CPI:${avgCpi} | SPI:${avgSpi} | Critiques:${critiques.length}/${total}

${header}
${rows}`;
  }

  const launch = useCallback(async () => {
    if (!getKey().startsWith('gsk_')) { toast.error('Clé Groq non configurée.'); return; }
    if (running) return;

    setRunning(true);
    setSynthesis('');
    setSynthStatus('idle');
    setExpanded({});

    // Reset agents to idle — each will be set to running individually
    setAgents(AGENT_DEFS.map(d => ({
      id: d.id, label: d.label, icon: d.icon, color: d.color, status: 'idle' as AgentStatus, output: '',
    })));

    const ctx = buildProjectContext();

    const runAgent = async (def: typeof AGENT_DEFS[0]): Promise<string> => {
      // Mark this agent as running just before its turn
      setAgents(prev => prev.map(a => a.id === def.id ? { ...a, status: 'running' } : a));
      const t0 = Date.now();
      const messages: ChatMessage[] = [
        { role: 'system', content: `${def.persona} Réponds en français, tableaux markdown, 4 recommandations chiffrées max.` },
        { role: 'user', content: `Analyse ${def.label} — SIGEPP-DPE:\n${ctx}` },
      ];
      try {
        const output = await chatOnce(messages, { model: GROQ_MODELS.fast, temperature: 0.35, maxTokens: 400 });
        const duration = Math.round((Date.now() - t0) / 1000);
        setAgents(prev => prev.map(a => a.id === def.id ? { ...a, status: 'done', output, duration, model: GROQ_MODELS.fast } : a));
        setExpanded(prev => ({ ...prev, [def.id]: true }));
        return output;
      } catch (err) {
        const msg = err instanceof Error ? err.message : 'Erreur';
        setAgents(prev => prev.map(a => a.id === def.id ? { ...a, status: 'error', output: `❌ ${msg}` } : a));
        return `Erreur agent ${def.label}: ${msg}`;
      }
    };

    // Exécution séquentielle avec 8s entre chaque agent (TPM: 6000/min = 100 tok/s)
    // Chaque requête ~900 tokens; après 8s refill ~800 → budget reste sain
    const delay = (ms: number) => new Promise<void>(r => setTimeout(r, ms));
    const results: string[] = [];
    for (let i = 0; i < AGENT_DEFS.length; i++) {
      if (i > 0) await delay(8000);
      results.push(await runAgent(AGENT_DEFS[i]));
    }

    // Agent de synthèse — attendre 10s pour laisser le TPM se recharger
    await delay(10000);
    setSynthStatus('running');
    // Combine only first 200 chars per agent to stay under TPM
    const truncated = results.map((r, i) => `[${AGENT_DEFS[i].label}]: ${r.slice(0, 200)}`).join('\n');
    const synthMessages: ChatMessage[] = [
      { role: 'system', content: 'Tu es Directeur DPE SENELEC. Synthèse exécutive en français: tableau de bord, top 5 alertes, plan actions 30/60/90j.' },
      { role: 'user', content: `Synthèse multi-agents ${selectedCode === 'all' ? 'portefeuille' : selectedCode}:\n${truncated}` },
    ];
    try {
      const synth = await chatOnce(synthMessages, { model: GROQ_MODELS.smart, temperature: 0.3, maxTokens: 500 });
      setSynthesis(synth);
      setSynthStatus('done');
      setExpandSynth(true);
      toast.success('Analyse complète — 6 agents + synthèse exécutive générés');
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Erreur synthèse';
      setSynthesis(`❌ Erreur synthèse: ${msg}`);
      setSynthStatus('error');
      toast.error('Erreur lors de la synthèse');
    }

    setRunning(false);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedCode, store.projets, userName, running]);

  const exportPDF = () => {
    const pw = window.open('', '_blank');
    if (!pw) return;
    const agentRows = agents
      .filter(a => a.output)
      .map(a => `<section style="margin-bottom:28px;page-break-inside:avoid"><h2 style="font-size:14px;font-weight:800;color:${a.color};margin:0 0 8px;border-bottom:2px solid #E2E8F0;padding-bottom:5px">${a.label}</h2><div style="font-size:11px;line-height:1.6;color:#334155;white-space:pre-wrap">${a.output.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>').replace(/\n/g, '<br/>')}</div></section>`)
      .join('');
    const synthRow = synthesis ? `<section style="margin-top:32px;padding-top:20px;border-top:3px solid ${NAVY}"><h2 style="font-size:16px;font-weight:900;color:${NAVY};margin:0 0 12px">SYNTHÈSE EXÉCUTIVE CONSOLIDÉE</h2><div style="font-size:11.5px;line-height:1.65;color:#1E293B;white-space:pre-wrap">${synthesis.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>').replace(/\n/g, '<br/>')}</div></section>` : '';
    pw.document.write(`<!DOCTYPE html><html lang="fr"><head><meta charset="UTF-8"><title>Analyse Multi-Agents DPE</title><style>body{font-family:'Segoe UI',Arial,sans-serif;padding:32px 44px;color:#1E293B;font-size:11px;max-width:800px;margin:0 auto}strong{color:${NAVY};font-weight:700}.bar{height:5px;background:${ORANGE};margin-bottom:24px}h1{font-size:18px;font-weight:900;color:#0F172A;margin:0 0 4px}.meta{font-size:10px;color:#64748B;margin-bottom:28px}@media print{section{page-break-inside:avoid}}</style></head><body><div class="bar"></div><div style="margin-bottom:12px"><img src="${SENELEC_LOGO_DATA_URI}" alt="SENELEC" style="height:42px;width:auto;display:block"/></div><h1>Analyse Multi-Agents IA — ${selectedCode === 'all' ? 'Portefeuille DPE' : `Projet ${selectedCode}`}</h1><div class="meta">Générée le ${new Date().toLocaleDateString('fr-FR', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })} · SIGEPP-DPE · ${agents.filter(a => a.status === 'done').length}/6 agents · Groq ${GROQ_MODELS.smart}</div>${agentRows}${synthRow}<div style="margin-top:32px;padding-top:12px;border-top:1px solid #E2E8F0;font-size:8px;color:#94A3B8;text-align:center">CONFIDENTIEL — Usage interne SENELEC DPE · Analyse IA assistée par SIGEPP-DPE · Non contractuel</div></body></html>`);
    pw.document.close();
    setTimeout(() => pw.print(), 500);
  };

  const doneCount = agents.filter(a => a.status === 'done').length;
  const totalAgents = agents.length;
  const progress = running ? Math.round((doneCount / totalAgents) * 80) + (synthStatus === 'done' ? 20 : 0) : (synthStatus === 'done' ? 100 : 0);

  return (
    <div className="agents-ia-shell" style={{ display: 'flex', height: '100%', overflow: 'hidden', background: BG }}>

      {/* ── Sidebar config ── */}
      <div className="agents-ia-sidebar" style={{ width: 230, flexShrink: 0, borderRight: `1px solid ${BORDER}`, display: 'flex', flexDirection: 'column', background: '#fff' }}>
        <div style={{ padding: '16px 14px 10px', borderBottom: `1px solid ${BORDER}` }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 14 }}>
            <div style={{ width: 34, height: 34, borderRadius: 9, background: `${NAVY}12`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Bot size={18} color={NAVY} />
            </div>
            <div>
              <div style={{ fontSize: 13, fontWeight: 800, color: NAVY }}>Agents IA</div>
              <div style={{ fontSize: 10, color: '#94A3B8' }}>Analyse multi-agents Groq</div>
            </div>
          </div>

          {/* Sélecteur de périmètre */}
          <div style={{ marginBottom: 10 }}>
            <label style={{ fontSize: 10, fontWeight: 700, color: '#64748B', textTransform: 'uppercase', letterSpacing: '0.07em', display: 'block', marginBottom: 5 }}>Périmètre d'analyse</label>
            <select
              value={selectedCode}
              onChange={e => setSelectedCode(e.target.value)}
              disabled={running}
              style={{ width: '100%', padding: '7px 9px', borderRadius: 7, border: `1px solid ${BORDER}`, fontSize: 11.5, fontFamily: 'inherit', background: '#fff', color: '#1E293B', cursor: running ? 'not-allowed' : 'pointer', outline: 'none' }}
            >
              <option value="all">Portefeuille complet ({store.projets.length} projets)</option>
              {projOptions.map(p => (
                <option key={p.code} value={p.code}>{p.code} — {p.nom.slice(0, 30)}{p.nom.length > 30 ? '…' : ''}</option>
              ))}
            </select>
          </div>

          {/* Bouton lancer */}
          <button
            onClick={() => void launch()}
            disabled={running}
            style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 7, padding: '10px 0', borderRadius: 8, border: 'none', background: running ? '#E2E8F0' : `linear-gradient(135deg, ${NAVY}, #2563EB)`, color: running ? '#94A3B8' : '#fff', cursor: running ? 'not-allowed' : 'pointer', fontSize: 12.5, fontWeight: 700, fontFamily: 'inherit', transition: 'all 0.2s' }}
          >
            {running
              ? <><Loader2 size={14} style={{ animation: 'spin 1s linear infinite' }} /> Analyse en cours…</>
              : <><Play size={14} /> Lancer l'analyse</>
            }
          </button>

          {/* Barre de progression */}
          {(running || progress > 0) && (
            <div style={{ marginTop: 10 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 3 }}>
                <span style={{ fontSize: 9.5, color: '#94A3B8' }}>{doneCount}/{totalAgents} agents</span>
                <span style={{ fontSize: 9.5, color: NAVY, fontWeight: 700 }}>{progress}%</span>
              </div>
              <div style={{ height: 4, borderRadius: 2, background: '#E2E8F0', overflow: 'hidden' }}>
                <div style={{ height: '100%', width: `${progress}%`, background: running ? ORANGE : '#16A34A', borderRadius: 2, transition: 'width 0.4s ease' }} />
              </div>
            </div>
          )}
        </div>

        {/* Statistiques */}
        <div style={{ flex: 1, padding: '12px 14px', overflowY: 'auto' }}>
          <div style={{ fontSize: 9.5, fontWeight: 700, color: '#94A3B8', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 8 }}>Portefeuille sélectionné</div>
          {(() => {
            const ps = selectedProjets;
            const tb = ps.reduce((s, p) => s + p.budget, 0);
            const td = ps.reduce((s, p) => s + p.budgetDecaisse, 0);
            const avgCpi = ps.length > 0 ? (ps.reduce((s, p) => s + p.cpi, 0) / ps.length).toFixed(2) : '—';
            const avgSpi = ps.length > 0 ? (ps.reduce((s, p) => s + p.spi, 0) / ps.length).toFixed(2) : '—';
            const alertes = ps.filter(p => p.cpi < 0.9 || p.spi < 0.85).length;
            return [
              { l: 'Projets',    v: String(ps.length),                                    c: NAVY      },
              { l: 'Budget',     v: `${(tb / 1000).toFixed(1)} Md FCFA`,                  c: '#475569'  },
              { l: 'Décaissé',   v: `${tb > 0 ? Math.round((td/tb)*100) : 0}%`,           c: '#16A34A' },
              { l: 'CPI moyen',  v: avgCpi,                                                c: parseFloat(avgCpi) >= 1 ? '#16A34A' : '#DC2626' },
              { l: 'SPI moyen',  v: avgSpi,                                                c: parseFloat(avgSpi) >= 1 ? '#16A34A' : '#DC2626' },
              { l: 'Alertes',    v: String(alertes),                                       c: alertes > 0 ? '#DC2626' : '#16A34A' },
            ].map(s => (
              <div key={s.l} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6, padding: '4px 0', borderBottom: `1px solid ${BORDER}` }}>
                <span style={{ fontSize: 10.5, color: '#94A3B8' }}>{s.l}</span>
                <span style={{ fontSize: 12, fontWeight: 800, color: s.c }}>{s.v}</span>
              </div>
            ));
          })()}

          <div style={{ marginTop: 14 }}>
            <div style={{ fontSize: 9.5, fontWeight: 700, color: '#94A3B8', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 8 }}>6 Agents spécialisés</div>
            {AGENT_DEFS.map(d => (
              <div key={d.id} style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 6 }}>
                <div style={{ width: 22, height: 22, borderRadius: 6, background: `${d.color}15`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, color: d.color, fontSize: 11 }}>
                  {d.icon}
                </div>
                <span style={{ fontSize: 11, color: '#475569' }}>{d.label}</span>
              </div>
            ))}
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 8, paddingTop: 8, borderTop: `1px solid ${BORDER}` }}>
              <div style={{ width: 22, height: 22, borderRadius: 6, background: `${NAVY}15`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                <Sparkles size={12} color={NAVY} />
              </div>
              <span style={{ fontSize: 11, color: '#475569', fontWeight: 600 }}>Synthèse exécutive</span>
            </div>
          </div>
        </div>

        {/* Export */}
        {synthStatus === 'done' && (
          <div style={{ padding: '10px 14px', borderTop: `1px solid ${BORDER}` }}>
            <button onClick={exportPDF}
              style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, padding: '8px 0', borderRadius: 8, border: `1px solid ${BORDER}`, background: '#fff', cursor: 'pointer', fontSize: 12, fontWeight: 600, color: NAVY, fontFamily: 'inherit' }}>
              <Download size={13} /> Exporter PDF
            </button>
          </div>
        )}
      </div>

      {/* ── Zone résultats ── */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '20px 22px' }}>

        {/* État initial */}
        {!running && synthStatus === 'idle' && doneCount === 0 && (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '60%', gap: 16, opacity: 0.7 }}>
            <div style={{ width: 64, height: 64, borderRadius: 18, background: `${NAVY}10`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Bot size={30} color={NAVY} />
            </div>
            <div style={{ textAlign: 'center' }}>
              <div style={{ fontSize: 16, fontWeight: 800, color: NAVY, marginBottom: 6 }}>Analyse Multi-Agents IA</div>
              <div style={{ fontSize: 12, color: '#64748B', maxWidth: 380, lineHeight: 1.6 }}>
                Sélectionnez un projet ou analysez l'intégralité du portefeuille avec 6 agents IA spécialisés opérant en parallèle sur Groq.
              </div>
            </div>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', justifyContent: 'center' }}>
              {[{ icon: <BarChart3 size={11} />, l: 'EVM & Finance' }, { icon: <Users size={11} />, l: 'Risques & QHSE' }, { icon: <MapPin size={11} />, l: 'SIG & Terrain' }].map(t => (
                <div key={t.l} style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '5px 10px', borderRadius: 20, background: '#fff', border: `1px solid ${BORDER}`, fontSize: 11, color: '#64748B' }}>
                  <span style={{ color: NAVY }}>{t.icon}</span>{t.l}
                </div>
              ))}
            </div>
            <button onClick={() => void launch()}
              style={{ display: 'flex', alignItems: 'center', gap: 7, padding: '11px 22px', borderRadius: 9, border: 'none', background: `linear-gradient(135deg, ${NAVY}, #2563EB)`, color: '#fff', cursor: 'pointer', fontSize: 13, fontWeight: 700, fontFamily: 'inherit', boxShadow: '0 4px 14px rgba(27,79,138,0.3)' }}>
              <Play size={15} /> Lancer l'analyse IA
            </button>
          </div>
        )}

        {/* Cartes des agents */}
        {(running || doneCount > 0) && (
          <>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
              <div style={{ fontSize: 13, fontWeight: 800, color: NAVY }}>
                {running ? `Analyse en cours… ${doneCount}/${totalAgents} agents` : `${doneCount}/${totalAgents} agents complétés`}
              </div>
              {!running && doneCount > 0 && (
                <button onClick={() => void launch()}
                  style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '6px 12px', borderRadius: 7, border: `1px solid ${BORDER}`, background: '#fff', cursor: 'pointer', fontSize: 11, fontWeight: 600, color: NAVY, fontFamily: 'inherit' }}>
                  <RefreshCw size={12} /> Relancer
                </button>
              )}
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: 10, marginBottom: 20 }}>
              {agents.map(a => (
                <AgentCard
                  key={a.id}
                  agent={a}
                  expanded={!!expanded[a.id]}
                  onToggle={() => setExpanded(prev => ({ ...prev, [a.id]: !prev[a.id] }))}
                />
              ))}
            </div>

            {/* Synthèse exécutive */}
            <div style={{ borderRadius: 12, border: `2px solid ${synthStatus === 'done' ? NAVY : synthStatus === 'running' ? ORANGE : BORDER}`, background: synthStatus === 'done' ? '#F0F4FF' : '#fff', overflow: 'hidden', transition: 'border-color 0.3s' }}>
              <button
                onClick={() => setExpandSynth(v => !v)}
                style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 10, padding: '14px 16px', background: 'transparent', border: 'none', cursor: 'pointer', textAlign: 'left', fontFamily: 'inherit' }}
              >
                <div style={{ width: 38, height: 38, borderRadius: 10, background: `${NAVY}15`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                  <Sparkles size={18} color={NAVY} />
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 13.5, fontWeight: 800, color: NAVY }}>Synthèse Exécutive Consolidée</div>
                  <div style={{ fontSize: 11, color: '#64748B', marginTop: 1 }}>
                    {synthStatus === 'idle'    && 'En attente de la finalisation des agents…'}
                    {synthStatus === 'running' && <span style={{ color: ORANGE, fontWeight: 600 }}>Consolidation des 6 rapports…</span>}
                    {synthStatus === 'done'    && <span style={{ color: NAVY, fontWeight: 600 }}>Rapport exécutif prêt — Groq {GROQ_MODELS.smart}</span>}
                    {synthStatus === 'error'   && <span style={{ color: '#DC2626' }}>Erreur de consolidation</span>}
                  </div>
                </div>
                <div style={{ flexShrink: 0, display: 'flex', alignItems: 'center', gap: 8 }}>
                  {synthStatus === 'running' && <Loader2 size={18} style={{ color: ORANGE, animation: 'spin 1s linear infinite' }} />}
                  {synthStatus === 'done'    && <CheckCircle2 size={18} style={{ color: NAVY }} />}
                  {synthesis && (expandSynth ? <ChevronUp size={15} color="#94A3B8" /> : <ChevronDown size={15} color="#94A3B8" />)}
                </div>
              </button>

              {expandSynth && synthesis && (
                <div style={{ padding: '0 16px 16px', borderTop: `1px solid ${BORDER}` }}>
                  <div style={{ paddingTop: 12 }}>
                    <MiniMarkdown text={synthesis} />
                  </div>
                  {synthStatus === 'done' && (
                    <button onClick={exportPDF}
                      style={{ marginTop: 12, display: 'flex', alignItems: 'center', gap: 6, padding: '7px 14px', borderRadius: 7, border: `1px solid ${BORDER}`, background: '#fff', cursor: 'pointer', fontSize: 11, fontWeight: 600, color: NAVY, fontFamily: 'inherit' }}>
                      <Download size={12} /> Exporter rapport complet PDF
                    </button>
                  )}
                </div>
              )}
            </div>
          </>
        )}
      </div>

      <style>{`
        @keyframes spin { to { transform: rotate(360deg); } }
      `}</style>
    </div>
  );
}

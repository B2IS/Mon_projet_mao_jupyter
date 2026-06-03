/**
 * AIMultimodalChat.tsx — Chat IA multimodal pour SIGEPP-DPE
 * Support : texte, images, documents (PDF/Word/Excel), audio
 * Affichage riche : Markdown, tableaux, code, streaming
 */

'use client';

import { useState, useRef, useCallback, useEffect } from 'react';
import {
  Send, ImagePlus, Paperclip, Mic, Bot, User,
  Sparkles, FileText, Trash2, Copy, Check,
  ChevronDown, Settings, Loader2, X,
  BarChart3, FileSearch, ClipboardList, MessageSquare,
} from 'lucide-react';
import * as XLSX from 'xlsx';
import { sendMessage, streamMessage, SYSTEM_PROMPTS, generateReport } from '@/lib/ai/aiEngine';
import type { AIMessage, AIAttachment, AIConversation, AIGenerationOptions, AIModel } from '@/lib/ai/aiEngine';
import MarkdownRenderer from './MarkdownRenderer';
import { useIntegrationConfig, type CopilotStoredConfig } from '@/lib/integrationConfigStore';
import toast from 'react-hot-toast';

/** Extrait le texte d'un PDF natif (texte sélectionnable) via pdf.js, page par page. */
async function extractPdfText(file: File): Promise<string | undefined> {
  try {
    // pdfjs-dist v3 : pas de top-level await (compatible bundler Next.js).
    const pdfjs: typeof import('pdfjs-dist') = await import('pdfjs-dist');
    // Worker bundlé (webpack émet le fichier) — pas de dépendance CDN.
    try {
      pdfjs.GlobalWorkerOptions.workerSrc = new URL(
        'pdfjs-dist/build/pdf.worker.min.js',
        import.meta.url,
      ).toString();
    } catch { /* worker déjà configuré */ }
    const buf = await file.arrayBuffer();
    const doc = await pdfjs.getDocument({ data: buf, isEvalSupported: false }).promise;
    const parts: string[] = [];
    const maxPages = Math.min(doc.numPages, 60); // garde-fou
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
    // PDF scanné (images) → aucun texte sélectionnable.
    return '⚠️ Ce PDF ne contient pas de texte sélectionnable (probablement un scan/image). Une reconnaissance optique (OCR) est nécessaire pour en extraire le contenu.';
  } catch {
    return undefined;
  }
}

/** Extrait le texte d'un .docx (format Office Open XML = archive ZIP). */
async function extractDocxText(file: File): Promise<string | undefined> {
  try {
    const JSZip = (await import('jszip')).default;
    const zip = await JSZip.loadAsync(await file.arrayBuffer());
    const docXml = zip.file('word/document.xml');
    if (!docXml) return undefined;
    const xml = await docXml.async('string');
    // Paragraphes <w:p> → sauts de ligne ; texte dans <w:t>.
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

/**
 * Extrait le contenu textuel d'un fichier uploadé pour le fournir à l'IA.
 * - .txt / .csv / .json / .md           → lecture directe
 * - .xlsx / .xls / .ods                 → conversion de chaque feuille en CSV
 * - .pdf                                → extraction du texte natif via pdf.js
 * - .docx                               → extraction via parsing OOXML (ZIP)
 * - autres (.doc binaire / image)       → pas d'extraction client (renvoie undefined)
 */
async function extractFileText(file: File): Promise<string | undefined> {
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

interface AgentPersona {
  id: string;
  name: string;
  icon: React.ElementType;
  description: string;
  systemPrompt: string;
  color: string;
}

const AGENTS: AgentPersona[] = [
  {
    id: 'copilote',
    name: 'Copilote Projet',
    icon: MessageSquare,
    description: 'Assistant général pour la gestion de projets DPE',
    systemPrompt: SYSTEM_PROMPTS.copilote_projet,
    color: '#1B4F8A',
  },
  {
    id: 'rapporteur',
    name: 'Générateur de Rapports',
    icon: FileText,
    description: 'Génère des rapports longs et structurés avec tableaux',
    systemPrompt: SYSTEM_PROMPTS.generation_rapport,
    color: '#16A34A',
  },
  {
    id: 'analyste',
    name: 'Analyste Documentaire',
    icon: FileSearch,
    description: 'Analyse contrats, DAO, PV, rapports',
    systemPrompt: SYSTEM_PROMPTS.analyse_document,
    color: '#D97706',
  },
  {
    id: 'kpi',
    name: 'Analyste KPIs',
    icon: BarChart3,
    description: 'Tableaux comparatifs, EVM, courbes S',
    systemPrompt: SYSTEM_PROMPTS.rapport_projet,
    color: '#9333EA',
  },
];

const MODELS: { value: AIModel; label: string; group?: string }[] = [
  // ── Open-source performants (souveraineté des données — recommandés) ──
  { value: 'llama-3.3-70b', label: '🦙 Llama 3.3 70B (open-source)', group: 'Open-source' },
  { value: 'qwen-2.5-72b',  label: '🌐 Qwen2.5 72B (open-source)',  group: 'Open-source' },
  { value: 'deepseek-v3',   label: '🧠 DeepSeek-V3 (open-source)',  group: 'Open-source' },
  { value: 'mistral-large', label: '🇪🇺 Mistral Large 2 (open-source)', group: 'Open-source' },
  { value: 'mixtral-8x7b',  label: '⚡ Mixtral 8×7B (open-source)',  group: 'Open-source' },
  { value: 'gemma-2-27b',   label: '💎 Gemma 2 27B (open-source)',  group: 'Open-source' },
  // ── Cloud propriétaires ──
  { value: 'copilot', label: 'Microsoft Copilot (compte M365)', group: 'Cloud' },
  { value: 'gpt-4o', label: 'GPT-4o', group: 'Cloud' },
  { value: 'gpt-4o-mini', label: 'GPT-4o Mini', group: 'Cloud' },
  { value: 'claude-3-5-sonnet', label: 'Claude 3.5', group: 'Cloud' },
  { value: 'gemini-1-5-pro', label: 'Gemini 1.5', group: 'Cloud' },
];

export default function AIMultimodalChat() {
  const [conversations, setConversations] = useState<AIConversation[]>([]);
  const [activeConvId, setActiveConvId] = useState<string | null>(null);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [selectedAgent, setSelectedAgent] = useState<AgentPersona>(AGENTS[0]);
  const [selectedModel, setSelectedModel] = useState<AIModel>('llama-3.3-70b');
  const [showAgentMenu, setShowAgentMenu] = useState(false);
  const [showModelMenu, setShowModelMenu] = useState(false);
  const [showCopilotCfg, setShowCopilotCfg] = useState(false);
  const copilotCfg = useIntegrationConfig(s => s.copilot);
  const updateCopilotCfg = useIntegrationConfig(s => s.updateCopilot);
  const [attachments, setAttachments] = useState<AIAttachment[]>([]);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const imageInputRef = useRef<HTMLInputElement>(null);
  const chatEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const activeConv = conversations.find(c => c.id === activeConvId);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [activeConv?.messages, isLoading]);

  const createConversation = useCallback(() => {
    const conv: AIConversation = {
      id: `conv_${Date.now()}`,
      title: `Conversation ${conversations.length + 1}`,
      messages: [],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    setConversations(prev => [conv, ...prev]);
    setActiveConvId(conv.id);
    return conv.id;
  }, [conversations.length]);

  const handleSend = useCallback(async () => {
    if (!input.trim() && attachments.length === 0) return;
    if (isLoading) return;

    const convId = activeConvId || createConversation();
    const userMsg: AIMessage = {
      id: `msg_${Date.now()}`,
      role: 'user',
      content: input.trim(),
      attachments: attachments.length > 0 ? [...attachments] : undefined,
      timestamp: new Date().toISOString(),
    };

    setConversations(prev => prev.map(c =>
      c.id === convId
        ? { ...c, messages: [...c.messages, userMsg], updatedAt: new Date().toISOString() }
        : c
    ));
    setInput('');
    setAttachments([]);
    setIsLoading(true);

    try {
      const conv = conversations.find(c => c.id === convId) || { messages: [userMsg] };
      const allMsgs = [...conv.messages, userMsg];

      const options: AIGenerationOptions = {
        model: selectedModel,
        systemPrompt: selectedAgent.systemPrompt,
        temperature: 0.7,
        maxTokens: 4096,
      };

      // Streaming
      const aiMsgId = `ai_${Date.now()}`;
      let streamedContent = '';

      setConversations(prev => prev.map(c =>
        c.id === convId
          ? { ...c, messages: [...c.messages, { id: aiMsgId, role: 'assistant', content: '', timestamp: new Date().toISOString(), isStreaming: true }] }
          : c
      ));

      for await (const chunk of streamMessage(allMsgs, options)) {
        streamedContent += chunk;
        setConversations(prev => prev.map(c =>
          c.id === convId
            ? {
                ...c,
                messages: c.messages.map(m =>
                  m.id === aiMsgId ? { ...m, content: streamedContent } : m
                ),
              }
            : c
        ));
      }

      // Finalize
      const finalMsg = await sendMessage(allMsgs, options);
      setConversations(prev => prev.map(c =>
        c.id === convId
          ? {
              ...c,
              messages: c.messages.map(m =>
                m.id === aiMsgId ? { ...finalMsg, id: aiMsgId, isStreaming: false } : m
              ),
              updatedAt: new Date().toISOString(),
            }
          : c
      ));
    } catch (e: any) {
      setConversations(prev => prev.map(c =>
        c.id === convId
          ? {
              ...c,
              messages: [...c.messages, {
                id: `err_${Date.now()}`,
                role: 'assistant',
                content: `**Erreur** : ${e.message || 'Impossible de générer la réponse'}`,
                timestamp: new Date().toISOString(),
              }],
            }
          : c
      ));
    } finally {
      setIsLoading(false);
    }
  }, [input, attachments, activeConvId, createConversation, conversations, selectedModel, selectedAgent]);

  const handleFileUpload = useCallback((files: FileList | null, type: AIAttachment['type']) => {
    if (!files) return;
    const fileArr = Array.from(files);
    // Crée d'abord les pièces jointes (placeholder), puis enrichit avec le texte extrait.
    const newAttachments: AIAttachment[] = fileArr.map(file => ({
      id: `att_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
      type,
      mimeType: file.type,
      name: file.name,
      url: URL.createObjectURL(file),
      size: file.size,
    }));
    setAttachments(prev => [...prev, ...newAttachments]);

    // Extraction asynchrone du contenu (documents texte / Excel / CSV)
    if (type === 'document') {
      newAttachments.forEach((att, i) => {
        extractFileText(fileArr[i]).then((text) => {
          if (!text) return;
          setAttachments(prev => prev.map(a =>
            a.id === att.id ? { ...a, extractedText: text } : a
          ));
        });
      });
    }
  }, []);

  const removeAttachment = useCallback((id: string) => {
    setAttachments(prev => prev.filter(a => a.id !== id));
  }, []);

  const copyToClipboard = useCallback((text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  }, []);

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  }, [handleSend]);

  const clearConversation = useCallback(() => {
    if (!activeConvId) return;
    setConversations(prev => prev.map(c =>
      c.id === activeConvId ? { ...c, messages: [] } : c
    ));
  }, [activeConvId]);

  return (
    <div style={{ display: 'flex', height: 'calc(100vh - 120px)', gap: 12 }}>
      {/* Sidebar conversations */}
      <div style={{ width: 260, flexShrink: 0, display: 'flex', flexDirection: 'column', gap: 8 }}>
        <button
          className="btn btn-primary"
          onClick={createConversation}
          style={{ justifyContent: 'center', gap: 6 }}
        >
          <Sparkles size={14} /> Nouvelle conversation
        </button>

        <div style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 4 }}>
          {conversations.map(conv => (
            <button
              key={conv.id}
              onClick={() => setActiveConvId(conv.id)}
              style={{
                padding: '10px 12px',
                borderRadius: 8,
                border: 'none',
                background: conv.id === activeConvId ? 'var(--primary)' : 'var(--bg-card)',
                color: conv.id === activeConvId ? '#fff' : 'var(--text-secondary)',
                cursor: 'pointer',
                textAlign: 'left',
                fontSize: 12,
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                transition: 'background 0.2s',
              }}
            >
              <MessageSquare size={14} />
              <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {conv.title}
              </span>
              <span style={{ fontSize: 10, opacity: 0.6 }}>
                {conv.messages.filter(m => m.role === 'assistant').length}
              </span>
            </button>
          ))}
        </div>
      </div>

      {/* Chat area */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 12 }}>
        {/* Header */}
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '8px 12px', background: 'var(--bg-card)', borderRadius: 10,
          border: '1px solid var(--border)',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            {/* Agent selector */}
            <div style={{ position: 'relative' }}>
              <button
                onClick={() => setShowAgentMenu(v => !v)}
                style={{
                  display: 'flex', alignItems: 'center', gap: 6,
                  padding: '6px 10px', borderRadius: 6,
                  background: selectedAgent.color + '15',
                  border: `1px solid ${selectedAgent.color}40`,
                  color: selectedAgent.color,
                  fontSize: 12, fontWeight: 600, cursor: 'pointer',
                }}
              >
                <selectedAgent.icon size={14} />
                {selectedAgent.name}
                <ChevronDown size={12} />
              </button>
              {showAgentMenu && (
                <div style={{
                  position: 'absolute', top: '100%', left: 0, zIndex: 100,
                  marginTop: 4, background: 'var(--bg-card)',
                  border: '1px solid var(--border)', borderRadius: 8,
                  boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
                  minWidth: 220, padding: 6,
                }}>
                  {AGENTS.map(agent => (
                    <button
                      key={agent.id}
                      onClick={() => { setSelectedAgent(agent); setShowAgentMenu(false); }}
                      style={{
                        display: 'flex', alignItems: 'center', gap: 8,
                        width: '100%', padding: '8px 10px', borderRadius: 6,
                        border: 'none', background: 'transparent',
                        cursor: 'pointer', textAlign: 'left',
                        color: agent.id === selectedAgent.id ? agent.color : 'var(--text-secondary)',
                        fontSize: 12,
                      }}
                    >
                      <agent.icon size={14} />
                      <div>
                        <div style={{ fontWeight: 600 }}>{agent.name}</div>
                        <div style={{ fontSize: 10, opacity: 0.7 }}>{agent.description}</div>
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Model selector */}
            <div style={{ position: 'relative' }}>
              <button
                onClick={() => setShowModelMenu(v => !v)}
                style={{
                  display: 'flex', alignItems: 'center', gap: 4,
                  padding: '6px 10px', borderRadius: 6,
                  background: 'var(--gray-100)', border: '1px solid var(--border)',
                  color: 'var(--text-muted)', fontSize: 11, cursor: 'pointer',
                }}
              >
                <Settings size={12} />
                {MODELS.find(m => m.value === selectedModel)?.label}
                <ChevronDown size={10} />
              </button>
              {showModelMenu && (
                <div style={{
                  position: 'absolute', top: '100%', left: 0, zIndex: 100,
                  marginTop: 4, background: 'var(--bg-card)',
                  border: '1px solid var(--border)', borderRadius: 8,
                  boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
                  minWidth: 220, padding: 4,
                }}>
                  {MODELS.map((m, i) => (
                    <div key={m.value}>
                    {(i === 0 || MODELS[i - 1].group !== m.group) && (
                      <div style={{ padding: '6px 10px 2px', fontSize: 9, fontWeight: 800, letterSpacing: '0.06em', textTransform: 'uppercase', color: 'var(--text-muted, #94A3B8)' }}>
                        {m.group}
                      </div>
                    )}
                    <button
                      onClick={() => {
                        setSelectedModel(m.value);
                        setShowModelMenu(false);
                        // Choisir Copilot non configuré → ouvrir la saisie des identifiants Microsoft.
                        if (m.value === 'copilot' && !copilotCfg.enabled) setShowCopilotCfg(true);
                      }}
                      style={{
                        display: 'block', width: '100%', padding: '6px 10px',
                        borderRadius: 4, border: 'none', background: 'transparent',
                        cursor: 'pointer', textAlign: 'left',
                        color: m.value === selectedModel ? 'var(--primary)' : 'var(--text-secondary)',
                        fontSize: 11,
                      }}
                    >
                      {m.label}{m.value === 'copilot' && copilotCfg.enabled ? ' 🟢' : ''}
                    </button>
                    </div>
                  ))}
                </div>
              )}
              {selectedModel === 'copilot' && (
                <button onClick={() => setShowCopilotCfg(true)} title="Connexion Microsoft Copilot"
                  style={{ marginLeft: 4, fontSize: 10, padding: '2px 7px', borderRadius: 6, border: `1px solid ${copilotCfg.enabled ? '#16A34A' : '#E2E8F0'}`, background: copilotCfg.enabled ? '#F0FDF4' : '#fff', color: copilotCfg.enabled ? '#15803D' : '#64748B', cursor: 'pointer', fontWeight: 700 }}>
                  {copilotCfg.enabled ? `connecté · ${copilotCfg.account || 'M365'}` : 'connecter…'}
                </button>
              )}
            </div>
            {showCopilotCfg && <CopilotConfigModal copilot={copilotCfg} onSave={updateCopilotCfg} onClose={() => setShowCopilotCfg(false)} />}
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            {activeConv && activeConv.messages.length > 0 && (
              <button
                className="btn btn-ghost btn-xs"
                onClick={clearConversation}
                title="Vider la conversation"
              >
                <Trash2 size={12} />
              </button>
            )}
          </div>
        </div>

        {/* Messages */}
        <div style={{
          flex: 1, overflowY: 'auto', padding: '0 8px',
          display: 'flex', flexDirection: 'column', gap: 16,
        }}>
          {!activeConv || activeConv.messages.length === 0 ? (
            <div style={{
              flex: 1, display: 'flex', flexDirection: 'column',
              alignItems: 'center', justifyContent: 'center', gap: 16,
              color: 'var(--text-muted)',
            }}>
              <Bot size={48} style={{ opacity: 0.3 }} />
              <div style={{ textAlign: 'center' }}>
                <div style={{ fontSize: 16, fontWeight: 700, marginBottom: 8 }}>
                  SIGEPP-IA Multimodal
                </div>
                <div style={{ fontSize: 12, maxWidth: 400, lineHeight: 1.6 }}>
                  Envoyez un message, uploadez un document, ou demandez un rapport complet.
                  Je génère des réponses longues avec tableaux, analyses et recommandations.
                </div>
              </div>
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', justifyContent: 'center' }}>
                {[
                  'Génère un rapport sur le portefeuille DEP',
                  'Analyse le risque du projet PRJ-DER-001',
                  'Tableau comparatif budgets PADAES vs PADERAU',
                  'Rédige un compte-rendu de réunion',
                ].map((suggestion, i) => (
                  <button
                    key={i}
                    onClick={() => setInput(suggestion)}
                    style={{
                      padding: '6px 12px', borderRadius: 16,
                      border: '1px solid var(--border)',
                      background: 'var(--bg-card)',
                      color: 'var(--text-secondary)',
                      fontSize: 11, cursor: 'pointer',
                    }}
                  >
                    {suggestion}
                  </button>
                ))}
              </div>
            </div>
          ) : (
            activeConv.messages.map((msg) => (
              <div
                key={msg.id}
                style={{
                  display: 'flex',
                  gap: 10,
                  alignItems: 'flex-start',
                  flexDirection: msg.role === 'user' ? 'row-reverse' : 'row',
                }}
              >
                <div style={{
                  width: 28, height: 28, borderRadius: 8,
                  background: msg.role === 'assistant' ? selectedAgent.color : '#F39200',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  flexShrink: 0,
                }}>
                  {msg.role === 'assistant' ? <Bot size={14} color="#fff" /> : <User size={14} color="#fff" />}
                </div>

                <div style={{
                  maxWidth: '85%',
                  background: msg.role === 'user' ? 'var(--primary)' : 'var(--bg-card)',
                  color: msg.role === 'user' ? '#fff' : 'var(--text-primary)',
                  padding: '10px 14px', borderRadius: 12,
                  border: msg.role === 'user' ? 'none' : '1px solid var(--border)',
                }}>
                  {/* Attachments */}
                  {msg.attachments && msg.attachments.length > 0 && (
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 8 }}>
                      {msg.attachments.map(att => (
                        <div key={att.id} style={{
                          display: 'flex', alignItems: 'center', gap: 4,
                          padding: '4px 8px', borderRadius: 6,
                          background: 'rgba(0,0,0,0.05)', fontSize: 11,
                        }}>
                          <Paperclip size={10} />
                          {att.name}
                          <span style={{ opacity: 0.6 }}>({(att.size / 1024).toFixed(0)} ko)</span>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Content */}
                  {msg.role === 'assistant' ? (
                    <MarkdownRenderer content={msg.content} />
                  ) : (
                    <div style={{ fontSize: 13, lineHeight: 1.6, whiteSpace: 'pre-wrap' }}>
                      {msg.content}
                    </div>
                  )}

                  {/* Actions for assistant messages */}
                  {msg.role === 'assistant' && msg.content && !msg.isStreaming && (
                    <div style={{
                      display: 'flex', alignItems: 'center', gap: 6,
                      marginTop: 8, paddingTop: 8,
                      borderTop: '1px solid var(--border)',
                    }}>
                      <button
                        onClick={() => copyToClipboard(msg.content, msg.id)}
                        style={{
                          background: 'none', border: 'none', cursor: 'pointer',
                          color: copiedId === msg.id ? 'var(--success)' : 'var(--text-muted)',
                          display: 'flex', alignItems: 'center', gap: 3,
                          fontSize: 10,
                        }}
                      >
                        {copiedId === msg.id ? <Check size={10} /> : <Copy size={10} />}
                        {copiedId === msg.id ? 'Copié' : 'Copier'}
                      </button>
                      {msg.model && (
                        <span style={{ fontSize: 9, color: 'var(--text-placeholder)', marginLeft: 'auto' }}>
                          {msg.model} • {msg.tokensUsed} tokens
                        </span>
                      )}
                    </div>
                  )}

                  {msg.isStreaming && (
                    <div style={{ display: 'flex', gap: 3, marginTop: 4 }}>
                      <span style={{ width: 6, height: 6, borderRadius: '50%', background: 'var(--primary)', animation: 'pulse 1s infinite' }} />
                      <span style={{ width: 6, height: 6, borderRadius: '50%', background: 'var(--primary)', animation: 'pulse 1s infinite 0.2s' }} />
                      <span style={{ width: 6, height: 6, borderRadius: '50%', background: 'var(--primary)', animation: 'pulse 1s infinite 0.4s' }} />
                    </div>
                  )}
                </div>
              </div>
            ))
          )}
          <div ref={chatEndRef} />
        </div>

        {/* Input area */}
        <div style={{
          background: 'var(--bg-card)',
          borderRadius: 12,
          border: '1px solid var(--border)',
          padding: '8px 12px',
        }}>
          {/* Attachments preview */}
          {attachments.length > 0 && (
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 8, paddingBottom: 8, borderBottom: '1px solid var(--border)' }}>
              {attachments.map(att => (
                <div key={att.id} style={{
                  display: 'flex', alignItems: 'center', gap: 4,
                  padding: '4px 8px', borderRadius: 6,
                  background: 'var(--gray-100)', fontSize: 11,
                }}>
                  {att.type === 'image' ? <ImagePlus size={10} /> : <FileText size={10} />}
                  {att.name}
                  {att.type === 'document' && (
                    <span style={{ fontSize: 9, fontWeight: 700, color: att.extractedText ? 'var(--success)' : 'var(--text-placeholder)' }}>
                      {att.extractedText ? '✓ lu' : '…'}
                    </span>
                  )}
                  <button onClick={() => removeAttachment(att.id)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--danger)', padding: 0 }}>
                    <X size={10} />
                  </button>
                </div>
              ))}
            </div>
          )}

          <div style={{ display: 'flex', alignItems: 'flex-end', gap: 8 }}>
            <textarea
              ref={textareaRef}
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder={`Message ${selectedAgent.name}…`}
              style={{
                flex: 1, resize: 'none', border: 'none', background: 'transparent',
                fontSize: 13, lineHeight: 1.5, color: 'var(--text-primary)',
                fontFamily: 'inherit', outline: 'none', minHeight: 24, maxHeight: 120,
              }}
              rows={Math.min(6, input.split('\n').length + 1)}
            />

            <div style={{ display: 'flex', alignItems: 'center', gap: 4, flexShrink: 0 }}>
              <button
                onClick={() => imageInputRef.current?.click()}
                style={{
                  background: 'none', border: 'none', cursor: 'pointer',
                  color: 'var(--text-muted)', padding: 6,
                }}
                title="Ajouter une image"
              >
                <ImagePlus size={18} />
              </button>
              <input
                ref={imageInputRef}
                type="file"
                accept="image/*"
                multiple
                style={{ display: 'none' }}
                onChange={e => handleFileUpload(e.target.files, 'image')}
              />

              <button
                onClick={() => fileInputRef.current?.click()}
                style={{
                  background: 'none', border: 'none', cursor: 'pointer',
                  color: 'var(--text-muted)', padding: 6,
                }}
                title="Ajouter un document"
              >
                <Paperclip size={18} />
              </button>
              <input
                ref={fileInputRef}
                type="file"
                accept=".pdf,.doc,.docx,.xls,.xlsx,.txt,.csv"
                multiple
                style={{ display: 'none' }}
                onChange={e => handleFileUpload(e.target.files, 'document')}
              />

              <button
                onClick={handleSend}
                disabled={isLoading || (!input.trim() && attachments.length === 0)}
                style={{
                  background: isLoading || (!input.trim() && attachments.length === 0) ? 'var(--gray-200)' : 'var(--primary)',
                  color: '#fff', border: 'none', borderRadius: 8,
                  padding: '8px 12px', cursor: isLoading ? 'not-allowed' : 'pointer',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}
              >
                {isLoading ? <Loader2 size={16} style={{ animation: 'spin 1s linear infinite' }} /> : <Send size={16} />}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ─── Modale de connexion Microsoft Copilot (compte M365 / Azure OpenAI) ──── */
function CopilotConfigModal({ copilot, onSave, onClose }: {
  copilot: CopilotStoredConfig;
  onSave: (cfg: Partial<CopilotStoredConfig>) => void;
  onClose: () => void;
}) {
  const [form, setForm] = useState<CopilotStoredConfig>({ ...copilot });
  const set = (k: keyof CopilotStoredConfig, v: string) => setForm(f => ({ ...f, [k]: v }));
  const field = (label: string, key: keyof CopilotStoredConfig, ph: string, type = 'text') => (
    <div>
      <label style={{ display: 'block', fontSize: 10.5, fontWeight: 700, color: '#64748B', textTransform: 'uppercase', marginBottom: 4 }}>{label}</label>
      <input type={type} value={String(form[key] ?? '')} placeholder={ph} onChange={e => set(key, e.target.value)}
        style={{ width: '100%', padding: '8px 10px', borderRadius: 8, border: '1.5px solid #CBD5E1', fontSize: 13, fontFamily: 'inherit', boxSizing: 'border-box' }} />
    </div>
  );
  const valid = form.account.trim() && form.tenantId.trim() && form.clientId.trim();
  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 400, background: 'rgba(15,23,42,0.55)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }} onClick={onClose}>
      <div onClick={e => e.stopPropagation()} style={{ background: '#fff', borderRadius: 14, width: '100%', maxWidth: 460, boxShadow: '0 24px 70px rgba(0,0,0,0.35)', overflow: 'hidden' }}>
        <div style={{ padding: '14px 18px', borderBottom: '1px solid #F1F5F9', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ fontWeight: 800, fontSize: 15, color: '#0F172A' }}>☁️ Connexion Microsoft Copilot</div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#94A3B8' }}><X size={18} /></button>
        </div>
        <div style={{ padding: 18, display: 'flex', flexDirection: 'column', gap: 12, maxHeight: '70vh', overflowY: 'auto' }}>
          <div style={{ fontSize: 12, color: '#64748B' }}>Saisissez les identifiants de votre compte <strong>Microsoft 365 / Entra ID</strong> (Azure OpenAI) pour utiliser Copilot.</div>
          {field('Compte Microsoft (UPN / e-mail)', 'account', 'prenom.nom@senelec.sn')}
          {field('Tenant ID (Entra)', 'tenantId', 'xxxxxxxx-xxxx-xxxx-…')}
          {field('Client ID (App registration)', 'clientId', 'xxxxxxxx-xxxx-xxxx-…')}
          {field('Endpoint Azure OpenAI', 'endpoint', 'https://senelec.openai.azure.com')}
          {field('Déploiement (modèle)', 'deployment', 'gpt-4o')}
          {field('Clé API (optionnelle si SSO Entra)', 'apiKey', '••••••••', 'password')}
        </div>
        <div style={{ padding: '12px 18px', borderTop: '1px solid #F1F5F9', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          {copilot.enabled
            ? <button onClick={() => { onSave({ enabled: false }); toast('Copilot déconnecté', { icon: 'ℹ️' }); onClose(); }}
                style={{ padding: '8px 14px', borderRadius: 8, border: '1px solid #FCA5A5', background: '#FEF2F2', color: '#B91C1C', fontSize: 12.5, fontWeight: 700, cursor: 'pointer' }}>Déconnecter</button>
            : <span />}
          <button onClick={() => { if (!valid) return; onSave({ ...form, enabled: true }); toast.success('Microsoft Copilot connecté'); onClose(); }} disabled={!valid}
            style={{ padding: '9px 18px', borderRadius: 8, border: 'none', background: valid ? '#2563EB' : '#CBD5E1', color: '#fff', fontSize: 13, fontWeight: 700, cursor: valid ? 'pointer' : 'not-allowed' }}>
            Connecter & utiliser Copilot
          </button>
        </div>
      </div>
    </div>
  );
}

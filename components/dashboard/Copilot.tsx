'use client';

import { useState, useRef, useEffect } from 'react';
import { Send, Bot, User, BarChart2, AlertTriangle, DollarSign, TrendingUp, MapPin, Clock, Zap, MessageSquare, BookOpen, ChevronRight, FileSearch, Shield, Database, FileText } from 'lucide-react';
import { useProjectStore } from '@/lib/projectStore';
import { SENELEC_LOGO_DATA_URI } from '@/lib/senelecLogo';

/* ═══════════════════════════════════════════════════════════════════
   TYPES & DONNÉES
═══════════════════════════════════════════════════════════════════ */
interface Message {
  id: number;
  role: 'user' | 'assistant';
  content: string;
  ts: Date;
  typing?: boolean;
}

interface Suggestion {
  icon: React.ReactNode;
  label: string;
  query: string;
}

interface HistoConv {
  id: string;
  titre: string;
  date: string;
  preview: string;
}

const SUGGESTIONS: Suggestion[] = [
  { icon: <BarChart2 size={13} />, label: 'Analyser performance portefeuille', query: 'Analyse la performance globale du portefeuille DPE en mai 2026' },
  { icon: <AlertTriangle size={13} />, label: 'Projets en retard critique', query: 'Quels sont les projets avec SPI < 0.85 ?' },
  { icon: <DollarSign size={13} />, label: 'État décaissements BM', query: 'Quel est l\'état des décaissements Banque Mondiale ?' },
  { icon: <TrendingUp size={13} />, label: 'Prévision fin PRJ-DER-001', query: 'Quelle est la prévision d\'achèvement pour PRJ-DER-2024-001 ?' },
  { icon: <MapPin size={13} />, label: 'Localités non électrifiées Casamance', query: 'Quelles sont les localités non électrifiées en Casamance ?' },
  { icon: <Clock size={13} />, label: 'Jalons critiques juin 2026', query: 'Quels sont les jalons critiques à surveiller en juin 2026 ?' },
];

const HISTORIQUE: HistoConv[] = [
  { id: 'h1', titre: 'Analyse portefeuille avril', date: '30/04/2026', preview: 'Avancement moyen 44%, budget engagé 56%...' },
  { id: 'h2', titre: 'Risques Casamance', date: '20/04/2026', preview: 'SPI = 0.72 sur PRJ-DER-2026-014, plan de rattrapage...' },
  { id: 'h3', titre: 'Rapport Q1 2026', date: '01/04/2026', preview: 'Synthèse T1 2026 : 3 projets réceptionnés, budget...' },
  { id: 'h4', titre: 'Budget BM PADAES', date: '15/03/2026', preview: 'État décaissements : 67% du tirage BM effectué...' },
  { id: 'h5', titre: 'Analyse EVM globale', date: '01/03/2026', preview: 'CPI portefeuille = 0.94, SPI global = 0.88...' },
];

const CAPACITES = [
  { icon: <BarChart2 size={14} />, label: 'Analyse de portefeuille', desc: 'KPIs, avancement, budget, EVM (store)', color: 'var(--navy)' },
  { icon: <AlertTriangle size={14} />, label: 'Détection d\'anomalies', desc: 'Alertes SPI/CPI, retards, blocages', color: 'var(--red)' },
  { icon: <DollarSign size={14} />, label: 'Suivi budgétaire', desc: 'Décaissements, engagements, bailleurs', color: 'var(--green)' },
  { icon: <MapPin size={14} />, label: 'SIG & Cartographie', desc: 'Localités, MES, patrimoine réseau', color: 'var(--orange)' },
  { icon: <FileSearch size={14} />, label: 'RAG Documentaire', desc: 'Recherche sémantique GED, OCR', color: '#7C3AED' },
  { icon: <TrendingUp size={14} />, label: 'Prévisions & Scénarios', desc: 'Projection achèvement, simulation', color: '#2563EB' },
  { icon: <Database size={14} />, label: 'Store SIGEPP-DPE', desc: 'Réponses basées sur vos données réelles', color: '#0EA5E9' },
  { icon: <Shield size={14} />, label: 'Supervision humaine', desc: 'Recommandations sous contrôle utilisateur', color: '#D97706' },
];

/* ── Simulation réponses IA ─────────────────────────────────────── */
function buildAnswer(q: string): string {
  const ql = q.toLowerCase();

  if (ql.includes('spi') && (ql.includes('0.85') || ql.includes('retard'))) {
    return `J'identifie **7 projets en retard de planning** (SPI < 0.85) dans le portefeuille DPE :\n\n• **PRJ-DER-2026-014** — Sédhiou Électrification · SPI = **0.72** 🔴 critique\n• **PRJ-DER-2026-008** — Mbour Zones périurbaines · SPI = **0.68** 🔴 critique\n• **PRJ-DER-2025-022** — Kédougou BT · CPI = **0.81** ⚠ dépassement\n• **PRJ-DGC-2025-001** — Centre Thiès · Avancement 30% · Retard fondations\n• **PRJ-DIT-2025-007** — AMI Compteurs Dakar · Avancement 8% · Phase étude bloquée\n• **PRJ-DER-2024-001** — Électrification Thiès · Retard poteaux béton\n• **PRJ-CC26-2024-001** — Ligne 225kV · Jalons pose pylônes à risque\n\n**Recommandations :**\n→ Convoquer les CP de Sédhiou et Mbour pour plan de rattrapage\n→ Audit technique Kédougou prévu 15/06/2026\n\nVoulez-vous que je génère un plan de rattrapage détaillé pour ces 7 projets ?`;
  }

  if (ql.includes('performance') || ql.includes('portefeuille')) {
    return `**Synthèse Performance Portefeuille DPE — Mai 2026 :**\n\n📊 **Vue globale**\n• 12 projets au portefeuille · 10 actifs · 2 en étude\n• Avancement moyen : **50%** (↑ +3% vs avril)\n• Budget total : **132 Md FCFA** · Engagé : **58%** · Décaissé : **41%**\n\n🟢 **Points forts**\n• PRJ-DEP-2025-003 Parc Éolien Taiba : **92%** — réception imminente\n• PRJ-DEP-2024-007 Solaire Hybride : **80%** — dans les délais\n• PRJ-DER-2023-005 HTA Kaolack : **78%** — bonne exécution\n\n🔴 **Points d'attention**\n• 4 projets en alerte rouge (SPI < 0.80)\n• 2 projets avec dépassement budgétaire potentiel\n• 17 localités MES à cartographier dans le SIG\n\n📅 **Prochains jalons critiques**\n• 05/06 — Raccordement réseau solaire Touba\n• 15/06 — Mise sous tension HTA Kaolack\n• 30/06 — Audit technique Kédougou\n\nVoulez-vous un zoom sur une direction spécifique ?`;
  }

  if (ql.includes('décaissement') || ql.includes('banque mondiale') || ql.includes('bm')) {
    return `**État Décaissements Banque Mondiale — Portefeuille DPE :**\n\n💰 **Situation globale BM**\n• Convention : **22 M USD** (PADAES Phase II)\n• Tiré à ce jour : **14.7 M USD** (67% du plafond)\n• Solde disponible : **7.3 M USD**\n• Prochaine DRF attendue : **15/06/2026** — 2.1 M USD\n\n📋 **Projets BM actifs**\n• PRJ-DER-2023-005 HTA Kaolack : 79% BM · DRF4 en préparation\n• PRJ-DIT-2025-007 AMI Compteurs : 100% BM · Phase étude\n• PRJ-DEP-2024-007 Solaire Hybride : 60% BM · Décaissement T2 OK\n\n⚠ **Alerte**\nLe délai moyen de traitement des DRF est de **18 jours**.\nLa DRF3 (Kaolack) a nécessité 24 jours — au-delà du seuil SLA de 21j.\n\n**Action recommandée :** Préparer DRF4 dès réception des PV de réception partielle prévus le 10/06/2026.`;
  }

  if (ql.includes('der-2024-001') || ql.includes('prévision') || ql.includes('achèvement')) {
    return `**Prévision d'Achèvement — PRJ-DER-2024-001**\n*Électrification Thiès — 19 localités (AFD/SENELEC)*\n\n📈 **Situation actuelle** (24/05/2026)\n• Avancement physique : **45%**\n• SPI : **0.88** — léger retard planning\n• CPI : **0.96** — budget maîtrisé\n• CP : Aïssatou Ndiaye\n\n📅 **Prévisions EVM**\n• Date contractuelle : **30/06/2026**\n• Estimation achèvement (EAC) : **31/08/2026** *(retard 2 mois)*\n• Cause principale : retard livraison poteaux béton (fournisseur)\n• Solution en cours : approvisionnement fournisseur alternatif · livraison 15/06\n\n🎯 **Localités à risque**\n• Keur Samba (L002) : **0%** — non démarrée\n• Pambal (L004) : **0%** — problème accès terrain\n• Ndiaye (L001) : **35%** — en cours mais lent\n\n**Recommandation :** Réunion de crise avec l'entreprise ELEC AFRIQUE + AFD pour extension délai et avenant — estimation surcoût : 4,5 M FCFA.`;
  }

  if (ql.includes('casamance') || ql.includes('localit')) {
    return `**Localités non électrifiées — Casamance (Ziguinchor, Kolda, Sédhiou)**\n\n🗺 **Situation SIG actuelle**\n• Localités ciblées portefeuille : **42**\n• Localités MES (électrifiées) : **18** (43%)\n• Localités en cours de travaux : **12** (29%)\n• Localités non démarrées : **12** (29%)\n\n🔴 **Projets couvrant la zone**\n• **PRJ-DER-2024-001** — 24 localités Ziguinchor · 65% avancement\n• **PRJ-DER-2026-014** — 18 localités Sédhiou · 22% · SPI critique\n\n📋 **Localités prioritaires non électrifiées**\n• Niaguis-Sud · Pop. 1 200 · Distance réseau 8.4 km\n• Kaguitte · Pop. 980 · Terrain difficile\n• Mpack · Pop. 650 · Attente foncier\n• Thionck-Essyl · Pop. 2 100 · Phase étude APD en cours\n• Kolda-Rurale 7 · Pop. 430 · Sans financement identifié\n\n**Action recommandée :** Inclure les 5 localités prioritaires dans le pipeline DPE 2027 — estimation budget : 3.2 Md FCFA · Bailleur potentiel : AFD Phase III.`;
  }

  if (ql.includes('jalon') || ql.includes('juin 2026')) {
    return `**Jalons Critiques — Juin 2026**\n\n📅 **Semaine du 01-07 juin**\n• **05/06** — PRJ-DEP-2024-007 : Raccordement réseau solaire *(propriété DEP — Mamadou Ndiaye)*\n• **05/06** — PRJ-DEP-2025-003 : Dernières turbines éoliennes Taiba\n\n📅 **Semaine du 08-14 juin**\n• **10/06** — PRJ-DER-2024-001 : PV réception partielle poteaux\n• **10/06** — PRJ-CC26-2024-001 : Rapport avancement trimestre BM\n• **15/06** — PRJ-DER-2023-005 : Mise sous tension HTA Kaolack *(jalon contractuel)*\n\n📅 **Semaine du 15-21 juin**\n• **15/06** — PRJ-DER-2026-008 : Signature contrat travaux Mbour *(retard initial prévu 01/07)*\n• **15/06** — PRJ-DER-2026-014 : Livraison matériel Sédhiou — fournisseur alternatif\n\n📅 **Fin juin**\n• **30/06** — PRJ-DGC-2025-001 : Levée fondations Centre Thiès *(à risque)*\n• **30/06** — PRJ-DER-2025-022 : Audit technique Kédougou + plan rattrapage BAD\n\n⚠ **3 jalons à risque élevé :** Mise sous tension Kaolack, Contrat Mbour, Fondations Thiès\n\nVoulez-vous un tableau de suivi à envoyer aux CP concernés ?`;
  }

  // Réponse par défaut
  return `Bonjour Maodo 👋 Je suis votre **assistant DPE SENELEC**.\n\nVoici la situation du portefeuille au **24 mai 2026** :\n\n• **12 projets** au portefeuille · **10 actifs**\n• Avancement moyen : **50%** (↑ vs avril)\n• Budget total : **132 Md FCFA** · Engagé **58%** · Décaissé **41%**\n• **4 projets** en alerte rouge · SPI < 0.80\n• **17 localités MES** à cartographier dans le SIG\n• Prochain jalon critique : **05/06/2026** — Solaire Hybride Touba\n\n**Directions pilotées :** DEP · DER · DIT · DGC · CC26\n\nPosez-moi une question sur vos projets, le budget, les risques ou la performance !`;
}

/* ── Rendu Markdown simplifié ───────────────────────────────────── */
function RenderContent({ text }: { text: string }) {
  return (
    <div style={{ lineHeight: 1.6 }}>
      {text.split('\n').map((line, i) => {
        const parts = line.split(/\*\*(.+?)\*\*/g);
        return (
          <span key={i}>
            {parts.map((p, j) =>
              j % 2 === 1
                ? <strong key={j} style={{ color: 'var(--navy)', fontWeight: 700 }}>{p}</strong>
                : p
            )}
            {i < text.split('\n').length - 1 && <br />}
          </span>
        );
      })}
    </div>
  );
}

/* ── Messages d'exemple pré-chargés ────────────────────────────── */
const INITIAL_MESSAGES: Message[] = [
  {
    id: 1, role: 'assistant', ts: new Date(Date.now() - 300000),
    content: 'Bonjour Maodo 👋 Je suis votre assistant DPE. Posez-moi une question sur vos projets, budget, risques ou performance...\n\nJe suis connecté au portefeuille DPE SENELEC en temps réel. Que souhaitez-vous analyser ?',
  },
  {
    id: 2, role: 'user', ts: new Date(Date.now() - 250000),
    content: 'Quels sont les projets avec SPI < 0.85 ?',
  },
  {
    id: 3, role: 'assistant', ts: new Date(Date.now() - 245000),
    content: "J'identifie **7 projets en retard de planning** (SPI < 0.85) :\n\n• **PRJ-DER-2026-014** — Sédhiou · SPI = **0.72** 🔴\n• **PRJ-DER-2026-008** — Mbour · SPI = **0.68** 🔴\n• **PRJ-DER-2025-022** — Kédougou · CPI = **0.81** ⚠\n\nVoulez-vous un plan de rattrapage détaillé pour ces projets ?",
  },
  {
    id: 4, role: 'user', ts: new Date(Date.now() - 180000),
    content: 'Résume le rapport mensuel de mai 2026',
  },
  {
    id: 5, role: 'assistant', ts: new Date(Date.now() - 175000),
    content: "**Synthèse Rapport Mai 2026 :**\n\nLe portefeuille DPE affiche **50% d'avancement moyen** en mai. Le budget engagé atteint **58%** du budget total (76,5 Md FCFA).\n\n**Points clés :**\n• Parc Éolien Taiba : 92% — réception imminente\n• Solaire Hybride Touba : 80% — raccordement 05/06\n• 4 projets en alerte rouge nécessitent attention\n• 17 localités MES à intégrer dans le SIG patrimoine",
  },
];

/* ═══════════════════════════════════════════════════════════════════
   COMPOSANT PRINCIPAL
═══════════════════════════════════════════════════════════════════ */
export default function Copilot() {
  const store = useProjectStore();
  const [messages, setMessages] = useState<Message[]>(INITIAL_MESSAGES);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [activeHisto, setActiveHisto] = useState<string | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Build a store-aware answer using real project data
  function buildStoreAnswer(q: string): string {
    const ql = q.toLowerCase();
    const projets = store.projets;
    const total = projets.length;
    const avgProg = total > 0 ? Math.round(projets.reduce((s, p) => s + p.avancement, 0) / total) : 0;
    const avgCpi  = total > 0 ? (projets.reduce((s, p) => s + p.cpi, 0) / total).toFixed(2) : '1.00';
    const avgSpi  = total > 0 ? (projets.reduce((s, p) => s + p.spi, 0) / total).toFixed(2) : '1.00';
    const totalBudget = projets.reduce((s, p) => s + p.budget, 0);
    const totalDec    = projets.reduce((s, p) => s + p.budgetDecaisse, 0);
    const decPct = totalBudget > 0 ? Math.round((totalDec / totalBudget) * 100) : 0;
    const enRetard = projets.filter(p => p.statut === 'en_retard' || p.spi < 0.85);
    const critiques = projets.filter(p => p.cpi < 0.90 || p.spi < 0.85);

    if (ql.includes('store') || ql.includes('données') || ql.includes('réel') || ql.includes('vrai')) {
      return `**Données réelles SIGEPP-DPE Store :**\n\n📁 **${total} projets** au portefeuille\n• Avancement moyen : **${avgProg}%**\n• Budget total : **${totalBudget.toFixed(0)} MFCFA** · Décaissé : **${decPct}%**\n• CPI moyen : **${avgCpi}** · SPI moyen : **${avgSpi}**\n• En retard : **${enRetard.length}** projets\n\n**Projets actifs (store) :**\n${projets.slice(0, 5).map(p => `• **${p.code}** — ${p.nom.substring(0, 35)} · ${p.avancement}% · CPI:${p.cpi.toFixed(2)}`).join('\n')}\n\n*Source : store ProjectStore SIGEPP-DPE en temps réel*`;
    }

    if ((ql.includes('retard') || ql.includes('spi')) && projets.length > 0) {
      const list = enRetard.slice(0, 5);
      return `**Projets en retard — données réelles store :**\n\n${list.length > 0 ? list.map(p => `• **${p.code}** — ${p.nom.substring(0, 35)}\n  SPI: **${p.spi.toFixed(2)}** · CPI: **${p.cpi.toFixed(2)}** · ${p.avancement}% · ${p.region}`).join('\n') : 'Aucun projet en retard critique'}\n\n${enRetard.length} projet(s) nécessitent une attention immédiate.\n\n*Données store en temps réel — ${total} projets analysés*`;
    }

    if (ql.includes('performance') || ql.includes('portefeuille') || ql.includes('kpi')) {
      return `**Synthèse Performance — Store SIGEPP-DPE :**\n\n📊 **${total} projets** actifs au portefeuille\n• Avancement : **${avgProg}%** (objectif : 60%)\n• Budget total : **${totalBudget.toFixed(0)} MFCFA**\n• Décaissé : **${totalDec.toFixed(0)} MFCFA** (${decPct}%)\n• CPI moyen : **${avgCpi}** ${Number(avgCpi) >= 0.95 ? '🟢' : '🔴'}\n• SPI moyen : **${avgSpi}** ${Number(avgSpi) >= 0.90 ? '🟢' : '🟡'}\n• Alertes critiques : **${critiques.length}** projets\n\n**Top 3 meilleures performances :**\n${[...projets].sort((a, b) => b.avancement - a.avancement).slice(0, 3).map(p => `• ${p.code} — ${p.nom.substring(0,30)} : ${p.avancement}%`).join('\n')}\n\n*Analyse basée sur les données réelles du store*`;
    }

    if (ql.includes('budget') || ql.includes('financi')) {
      const byDomain = ['production', 'transport', 'distribution', 'commercial', 'genie_civil'].map(d => {
        const dp = projets.filter(p => p.domaine === d);
        return { d, budget: dp.reduce((s, p) => s + p.budget, 0), dec: dp.reduce((s, p) => s + p.budgetDecaisse, 0) };
      });
      return `**Situation Budgétaire — Données Store :**\n\n💰 **Total portefeuille : ${totalBudget.toFixed(0)} MFCFA**\n• Décaissé : **${totalDec.toFixed(0)} MFCFA** (${decPct}%)\n• Reste à décaisser : **${(totalBudget - totalDec).toFixed(0)} MFCFA**\n\n**Par domaine :**\n${byDomain.map(x => `• ${x.d.charAt(0).toUpperCase() + x.d.slice(1)} : **${x.budget.toFixed(0)} M** · Décaissé ${x.budget > 0 ? Math.round((x.dec / x.budget) * 100) : 0}%`).join('\n')}\n\n*Source : store SIGEPP-DPE — mise à jour en temps réel*`;
    }

    // Fall back to the static answer
    return buildAnswer(q);
  }

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, loading]);

  async function send(text?: string) {
    const q = (text ?? input).trim();
    if (!q || loading) return;
    setInput('');

    const userMsg: Message = { id: Date.now(), role: 'user', content: q, ts: new Date() };
    setMessages(m => [...m, userMsg]);
    setLoading(true);

    await new Promise(r => setTimeout(r, 800 + Math.random() * 700));

    const answer = buildStoreAnswer(q);
    const assistantMsg: Message = { id: Date.now() + 1, role: 'assistant', content: answer, ts: new Date() };
    setMessages(m => [...m, assistantMsg]);
    setLoading(false);
    inputRef.current?.focus();
  }

  function handleSuggestion(s: Suggestion) {
    setInput(s.query);
    inputRef.current?.focus();
  }

  function exportConversationPDF() {
    const pw = window.open('', '_blank');
    if (!pw) { alert('Veuillez autoriser les popups.'); return; }
    const msgRows = messages.map(m => `
      <div style="margin-bottom:14px;display:flex;gap:10px;flex-direction:${m.role === 'user' ? 'row-reverse' : 'row'};align-items:flex-start">
        <div style="width:28px;height:28px;border-radius:6px;background:${m.role === 'user' ? '#1B4F8A' : '#EFF6FF'};display:flex;align-items:center;justify-content:center;flex-shrink:0;font-size:10px;font-weight:700;color:${m.role === 'user' ? '#fff' : '#1B4F8A'}">${m.role === 'user' ? 'V' : 'IA'}</div>
        <div style="max-width:80%;padding:10px 14px;border-radius:${m.role === 'user' ? '12px 12px 2px 12px' : '12px 12px 12px 2px'};background:${m.role === 'user' ? '#1B4F8A' : '#F8FAFC'};border:1px solid ${m.role === 'user' ? 'transparent' : '#E2E8F0'};font-size:11px;color:${m.role === 'user' ? '#fff' : '#1E293B'};line-height:1.6">
          ${m.content.replace(/\n/g, '<br/>')}
          <div style="font-size:8px;margin-top:6px;opacity:0.5;text-align:${m.role === 'user' ? 'right' : 'left'}">${m.ts.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}</div>
        </div>
      </div>`).join('');
    pw.document.write(`<!DOCTYPE html><html lang="fr"><head><meta charset="UTF-8"><title>Conversation Copilot DPE</title><style>
      @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap');
      body{font-family:'Inter',Arial,sans-serif;padding:32px 40px;color:#1E293B;font-size:11px;max-width:700px;margin:0 auto}
      .bar{height:4px;background:#F47920;border-radius:2px;margin-bottom:20px}
      .logo{font-size:8px;font-weight:700;letter-spacing:0.18em;color:#94A3B8;text-transform:uppercase;margin-bottom:12px}
      h1{font-size:18px;font-weight:800;color:#0F172A;margin:0 0 4px}
      .meta{font-size:9px;color:#64748B;margin-bottom:20px}
      .footer{margin-top:32px;padding-top:12px;border-top:1px solid #E2E8F0;font-size:8px;color:#94A3B8;text-align:center}
    </style></head><body>
      <div class="bar"></div>
      <div style="margin-bottom:12px"><img src="${SENELEC_LOGO_DATA_URI}" alt="SENELEC" style="height:44px;width:auto;display:block" /></div>
      <div class="logo">SENELEC · SIGEPP-DPE · Copilot IA</div>
      <h1>Conversation Copilot DPE</h1>
      <div class="meta">Exportée le ${new Date().toLocaleDateString('fr-FR')} · ${messages.length} messages · Assistant intelligent SIGEPP-DPE</div>
      <div style="margin-top:20px">${msgRows}</div>
      <div class="footer">CONFIDENTIEL — Usage interne SENELEC · Document généré par SIGEPP-DPE</div>
    </body></html>`);
    pw.document.close(); setTimeout(() => pw.print(), 500);
  }

  return (
    <div style={{ display: 'flex', height: '100%', overflow: 'hidden', gap: 0 }}>
      {/* ── Sidebar historique ──────────────────────────────────────── */}
      <div style={{ width: 200, flexShrink: 0, borderRight: '1px solid var(--border-2)', display: 'flex', flexDirection: 'column', background: 'var(--bg)' }}>
        <div style={{ padding: '12px 14px', borderBottom: '1px solid var(--border-2)' }}>
          <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 10 }}>
            <MessageSquare size={10} style={{ verticalAlign: 'middle', marginRight: 4 }} />Historique
          </div>
          <button
            onClick={() => { setMessages(INITIAL_MESSAGES.slice(0, 1)); setActiveHisto(null); }}
            className="btn btn-navy btn-sm" style={{ width: '100%', justifyContent: 'center', fontSize: 10 }}>
            + Nouvelle conversation
          </button>
        </div>
        <div style={{ flex: 1, overflowY: 'auto', padding: '8px 6px' }}>
          {HISTORIQUE.map(h => (
            <button
              key={h.id}
              onClick={() => setActiveHisto(h.id)}
              style={{
                width: '100%', textAlign: 'left', padding: '8px 10px', borderRadius: 6,
                background: activeHisto === h.id ? 'var(--navy-light)' : 'transparent',
                border: 'none', cursor: 'pointer', marginBottom: 2,
                borderLeft: activeHisto === h.id ? '2px solid var(--navy)' : '2px solid transparent',
              }}>
              <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--navy)', marginBottom: 2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{h.titre}</div>
              <div style={{ fontSize: 9, color: 'var(--muted)', marginBottom: 2 }}>{h.date}</div>
              <div style={{ fontSize: 9, color: 'var(--muted-2)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{h.preview}</div>
            </button>
          ))}
        </div>

        {/* Capacités IA */}
        <div style={{ borderTop: '1px solid var(--border-2)', padding: '10px 12px' }}>
          <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 8 }}>
            <Zap size={10} style={{ verticalAlign: 'middle', marginRight: 4 }} />Ce que je peux faire
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            {CAPACITES.map(c => (
              <div key={c.label} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '4px 0' }}>
                <span style={{ color: c.color }}>{c.icon}</span>
                <div>
                  <div style={{ fontSize: 10, fontWeight: 600, color: 'var(--navy)' }}>{c.label}</div>
                  <div style={{ fontSize: 9, color: 'var(--muted)' }}>{c.desc}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ── Zone chat principale ─────────────────────────────────────── */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', background: 'var(--bg-card)' }}>
        {/* Header */}
        <div style={{ padding: '12px 18px', borderBottom: '1px solid var(--border-2)', display: 'flex', alignItems: 'center', gap: 10, flexShrink: 0, background: 'var(--bg-card)' }}>
          <div style={{ width: 36, height: 36, borderRadius: 10, background: 'linear-gradient(135deg, var(--navy) 0%, #2563EB 100%)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
            <Bot size={18} style={{ color: '#fff' }} />
          </div>
          <div>
            <div style={{ fontWeight: 700, fontSize: 14, color: 'var(--navy)' }}>Copilot DPE — SENELEC</div>
            <div style={{ fontSize: 10, color: 'var(--muted)' }}>Assistant intelligent · Projets, Budget, Risques, SIG, Reporting</div>
          </div>
          <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 8 }}>
            {messages.length > 1 && (
              <button onClick={exportConversationPDF}
                style={{ fontSize: 10, fontWeight: 600, color: '#1B4F8A', background: '#EFF6FF', padding: '4px 10px', borderRadius: 6, border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4 }}>
                <FileText size={12} /> Exporter PDF
              </button>
            )}
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 10, color: 'var(--green)', background: 'var(--green-light)', padding: '3px 10px', borderRadius: 99 }}>
              <span style={{ width: 6, height: 6, borderRadius: '50%', background: 'var(--green)', display: 'inline-block' }} />
              En ligne · Connecté SIGEPP
            </div>
          </div>
        </div>

        {/* Messages */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '16px 20px', display: 'flex', flexDirection: 'column', gap: 16 }}>
          {messages.map(m => (
            <div key={m.id} style={{ display: 'flex', gap: 10, flexDirection: m.role === 'user' ? 'row-reverse' : 'row', alignItems: 'flex-start' }}>
              {/* Avatar */}
              <div style={{
                width: 32, height: 32, borderRadius: 8, flexShrink: 0,
                background: m.role === 'user' ? 'var(--navy)' : 'var(--blue-light)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}>
                {m.role === 'user'
                  ? <User size={14} style={{ color: '#fff' }} />
                  : <Bot size={14} style={{ color: 'var(--navy)' }} />}
              </div>
              {/* Bulle */}
              <div style={{
                maxWidth: '75%',
                padding: '10px 14px',
                borderRadius: m.role === 'user' ? '12px 12px 2px 12px' : '12px 12px 12px 2px',
                background: m.role === 'user' ? 'var(--navy)' : 'rgba(14,52,96,0.04)',
                border: m.role === 'user' ? 'none' : '1px solid var(--border-2)',
                fontSize: 12, color: m.role === 'user' ? '#fff' : 'var(--text-2)',
                lineHeight: 1.55,
              }}>
                {m.role === 'user'
                  ? <span>{m.content}</span>
                  : <RenderContent text={m.content} />}
                <div style={{ fontSize: 9, marginTop: 6, opacity: 0.6, textAlign: m.role === 'user' ? 'right' : 'left' }}>
                  {m.ts.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}
                </div>
              </div>
            </div>
          ))}

          {/* Typing indicator */}
          {loading && (
            <div style={{ display: 'flex', gap: 10, alignItems: 'flex-start' }}>
              <div style={{ width: 32, height: 32, borderRadius: 8, background: 'var(--blue-light)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                <Bot size={14} style={{ color: 'var(--navy)' }} />
              </div>
              <div style={{ padding: '12px 16px', borderRadius: '12px 12px 12px 2px', background: 'rgba(14,52,96,0.04)', border: '1px solid var(--border-2)', display: 'flex', gap: 5, alignItems: 'center' }}>
                {[0, 1, 2].map(i => (
                  <div key={i} style={{ width: 7, height: 7, borderRadius: '50%', background: 'var(--orange)', animation: `bounce 1.2s ease-in-out ${i * 0.2}s infinite` }} />
                ))}
              </div>
            </div>
          )}
          <div ref={bottomRef} />
        </div>

        {/* Input */}
        <div style={{ padding: '12px 18px', borderTop: '1px solid var(--border-2)', flexShrink: 0, background: 'var(--bg-card)' }}>
          <div style={{ display: 'flex', gap: 8, alignItems: 'flex-end' }}>
            <input
              ref={inputRef}
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(); } }}
              placeholder="Posez une question sur vos projets, budget, risques, SIG..."
              className="form-input"
              style={{ flex: 1, fontSize: 12 }}
              disabled={loading}
            />
            <button
              onClick={() => send()}
              disabled={!input.trim() || loading}
              className="btn btn-primary"
              style={{ opacity: !input.trim() || loading ? 0.5 : 1, flexShrink: 0 }}>
              <Send size={13} />
            </button>
          </div>
          <div style={{ fontSize: 9, color: 'var(--muted)', marginTop: 5, textAlign: 'center' }}>
            Entrée pour envoyer · Les réponses sont simulées · Ne pas partager de données confidentielles
          </div>
        </div>
      </div>

      {/* ── Panel droit — Suggestions ─────────────────────────────────── */}
      <div style={{ width: 220, flexShrink: 0, borderLeft: '1px solid var(--border-2)', display: 'flex', flexDirection: 'column', background: 'var(--bg)', overflowY: 'auto' }}>
        <div style={{ padding: '12px 14px', borderBottom: '1px solid var(--border-2)' }}>
          <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
            Suggestions contextuelles
          </div>
        </div>
        <div style={{ padding: '10px 10px', display: 'flex', flexDirection: 'column', gap: 6 }}>
          {SUGGESTIONS.map(s => (
            <button
              key={s.label}
              onClick={() => handleSuggestion(s)}
              style={{
                textAlign: 'left', padding: '10px 12px',
                borderRadius: 8, background: 'var(--bg-card)',
                border: '1px solid var(--border-2)', cursor: 'pointer',
                fontSize: 11, color: 'var(--text-2)', lineHeight: 1.4,
                transition: 'all 0.14s', width: '100%',
                display: 'flex', alignItems: 'flex-start', gap: 8,
              }}
              onMouseEnter={e => { e.currentTarget.style.borderColor = 'var(--navy)'; e.currentTarget.style.background = 'var(--navy-light)'; e.currentTarget.style.color = 'var(--navy)'; }}
              onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--border-2)'; e.currentTarget.style.background = 'var(--bg-card)'; e.currentTarget.style.color = 'var(--text-2)'; }}>
              <span style={{ color: 'var(--orange)', flexShrink: 0, marginTop: 1 }}>{s.icon}</span>
              <span>{s.label}</span>
            </button>
          ))}
        </div>

        {/* Stats rapides — real store data */}
        <div style={{ padding: '10px 14px', borderTop: '1px solid var(--border-2)', marginTop: 'auto' }}>
          <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 8 }}>Stats rapides</div>
          {(() => {
            const p = store.projets;
            const tot = p.length;
            const alertes = p.filter(x => x.spi < 0.85 || x.cpi < 0.90 || x.statut === 'en_retard').length;
            const jalons = p.reduce((s, x) => s + (x.jalons?.length ?? 0), 0);
            const tb = p.reduce((s, x) => s + x.budget, 0);
            const td = p.reduce((s, x) => s + x.budgetDecaisse, 0);
            const decPct = tb > 0 ? Math.round((td / tb) * 100) : 0;
            return [
              { label: 'Projets actifs', value: String(tot), color: 'var(--navy)' },
              { label: 'Alertes actives', value: String(alertes), color: 'var(--red)' },
              { label: 'Jalons total', value: String(jalons), color: 'var(--orange)' },
              { label: 'Budget décaissé', value: `${decPct}%`, color: 'var(--green)' },
            ];
          })().map(s => (
            <div key={s.label} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 5 }}>
              <span style={{ fontSize: 10, color: 'var(--muted)' }}>{s.label}</span>
              <span style={{ fontSize: 13, fontWeight: 700, color: s.color }}>{s.value}</span>
            </div>
          ))}
        </div>
      </div>

      <style>{`
        @keyframes bounce {
          0%, 80%, 100% { transform: scale(0.7); opacity: 0.4; }
          40% { transform: scale(1); opacity: 1; }
        }
      `}</style>
    </div>
  );
}

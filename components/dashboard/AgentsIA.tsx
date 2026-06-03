'use client';

import { useState, useRef, useEffect } from 'react';
import {
  Bot, Send, User,
  Briefcase, Calendar, Wallet, FolderOpen, Activity, FileText,
  Shield, RefreshCw, MapPin, ClipboardList, TrendingUp, X, Cloud, CheckCircle2,
} from 'lucide-react';
import { useProjectStore } from '@/lib/projectStore';
import { useAuth, type RoleCode } from '@/lib/authStore';
import { useIntegrationConfig } from '@/lib/integrationConfigStore';
import toast from 'react-hot-toast';

/* ─── Brand ─────────────────────────────── */
const NAVY   = '#3D1A6B';
const ORANGE = '#F47920';
const GREEN  = '#16A34A';
const AMBER  = '#D97706';
const PURPLE = '#8B5CF6';
const TEAL   = '#0F766E';
const SKY    = '#0EA5E9';

/* ─── Types ─────────────────────────────── */
type AgentRole = 'direction' | 'chef_projet' | 'planification' | 'finance' | 'ged' | 'suivi_eval' | 'redaction' | 'terrain' | 'logistique';

interface Message {
  id: string;
  role: 'user' | 'agent';
  content: string;
  timestamp: Date;
  sources?: string[];
}

interface AgentConfig {
  role: AgentRole;
  label: string;
  subtitle: string;
  desc: string;
  color: string;
  bg: string;
  icon: React.ReactNode;
  perimetres: string[];
  suggestions: string[];
}

/* ─── Configuration des agents ──────────────────────────────────────────────── */
const AGENTS: AgentConfig[] = [
  {
    role: 'direction',
    label: 'Copilote Directeur DPE',
    subtitle: 'Tableau de bord stratégique & arbitrages',
    desc: 'Analyse le portefeuille, détecte les projets critiques, prépare les revues de direction et produit des synthèses exécutives pour les bailleurs.',
    color: NAVY,
    bg: '#F3EBF9',
    icon: <TrendingUp size={20} style={{ color: NAVY }} />,
    perimetres: ['Portefeuille', 'KPI stratégiques', 'Bailleurs', 'Décision'],
    suggestions: [
      'Synthèse exécutive du portefeuille S1 2026',
      'Quels projets nécessitent un arbitrage urgent ?',
      'Prépare la note pour le bailleur AFD',
      'Comparaison performance réalisé vs objectifs annuels',
    ],
  },
  {
    role: 'chef_projet',
    label: 'Copilote Chef de Projet',
    subtitle: 'Assistant pilotage quotidien',
    desc: 'Assiste le chef de projet dans le pilotage, le suivi des jalons, la gestion des écarts et la préparation des comités.',
    color: NAVY,
    bg: '#EFF6FF',
    icon: <Briefcase size={20} style={{ color: NAVY }} />,
    perimetres: ['Planning', 'GED', 'Bordereau', 'KPI', 'Journal d\'audit'],
    suggestions: [
      'Résume-moi les écarts de planning du projet BT Sud',
      'Quels jalons sont à risque cette semaine ?',
      'Crée le WBS initial depuis le modèle DPE',
      'Prépare le compte-rendu de comité du 27/05',
    ],
  },
  {
    role: 'planification',
    label: 'Agent Planification',
    subtitle: 'Assistant ordonnancement et baselines',
    desc: 'Aide à structurer les plannings, calculer les chemins critiques, comparer les baselines et détecter les conflits de ressources.',
    color: PURPLE,
    bg: '#F5F3FF',
    icon: <Calendar size={20} style={{ color: PURPLE }} />,
    perimetres: ['Planning', 'Ressources', 'Baselines', 'Calendriers'],
    suggestions: [
      'Contrôle les écarts calendrier / baseline v2',
      'Quelles tâches sont sur le chemin critique ?',
      'Détecte les conflits de ressources sur S3-S5',
      'Simule l\'impact d\'un décalage de 2 semaines',
    ],
  },
  {
    role: 'finance',
    label: 'Agent Financier',
    subtitle: 'Assistant contrôle budgétaire',
    desc: 'Assiste dans la validation des factures, le rapprochement avec les contrats, le calcul des CPI/SPI et la chaîne de bon à payer.',
    color: GREEN,
    bg: '#DCFCE7',
    icon: <Wallet size={20} style={{ color: GREEN }} />,
    perimetres: ['Marchés', 'Factures', 'Budget', 'ERP', 'KPI financiers'],
    suggestions: [
      'Vérifie les factures en attente de validation',
      'Calcule le CPI et SPI du portefeuille',
      'Prépare le bordereau et les quantités lot HTA',
      'Détecte les dépassements budgétaires',
    ],
  },
  {
    role: 'ged',
    label: 'Agent GED & Conformité',
    subtitle: 'Contrôle documentaire et conformité',
    desc: 'Vérifie la complétude des dossiers, détecte les pièces manquantes, contrôle les délais de conservation et assure la traçabilité.',
    color: AMBER,
    bg: '#FFF7ED',
    icon: <FolderOpen size={20} style={{ color: AMBER }} />,
    perimetres: ['GED', 'Contrats', 'Courriers', 'Archivage'],
    suggestions: [
      'Vérifie les pièces obligatoires manquantes',
      'Liste les documents expirés ou à renouveler',
      'Contrôle la conformité du dossier CT-HTA-009',
      'Classe automatiquement les documents reçus',
    ],
  },
  {
    role: 'suivi_eval',
    label: 'Analyste Suivi-Évaluation',
    subtitle: 'Consolidation KPI et reporting',
    desc: 'Consolide les indicateurs physiques et financiers, détecte les anomalies, prépare les alertes et produit les rapports périodiques.',
    color: ORANGE,
    bg: '#FFF7ED',
    icon: <Activity size={20} style={{ color: ORANGE }} />,
    perimetres: ['KPI', 'Suivi-Évaluation', 'Alertes', 'Reporting'],
    suggestions: [
      'Consolide les KPI du portefeuille T2 2026',
      'Quelles anomalies terrain sont en attente ?',
      'Génère l\'alerte pour les projets SPI < 0.85',
      'Prépare le tableau de bord mensuel direction',
    ],
  },
  {
    role: 'redaction',
    label: 'Agent Rédaction Rapport',
    subtitle: 'Génération documentaire assistée',
    desc: 'Rédige des synthèses, rapports, comptes-rendus de comité, notes de décision et rapports périodiques à partir des données projet.',
    color: SKY,
    bg: '#E0F2FE',
    icon: <FileText size={20} style={{ color: SKY }} />,
    perimetres: ['Studio de rapports', 'GED', 'Comités', 'Planning'],
    suggestions: [
      'Rédige le rapport mensuel projet BT Sud',
      'Assemble le rapport comité mensuel mai 2026',
      'Génère la note de décision pour réallocation budget',
      'Prépare la synthèse exécutive T2 2026',
    ],
  },
  {
    role: 'terrain',
    label: 'Agent Terrain & Géolocalisation',
    subtitle: 'Saisies terrain, GPS, ODM, photos',
    desc: 'Assiste la saisie des états d\'avancement physique, la géolocalisation des travaux, la création d\'ordres de mission et la validation des photos de chantier.',
    color: GREEN,
    bg: '#DCFCE7',
    icon: <MapPin size={20} style={{ color: GREEN }} />,
    perimetres: ['Avancement physique', 'GPS', 'ODM', 'Photos'],
    suggestions: [
      'Crée un ordre de mission pour demain matin',
      'Sauvegarde l\'avancement du lot HTA Nord — 68%',
      'Quelles tâches terrain sont à valider aujourd\'hui ?',
      'Localise les chantiers actifs sur la carte',
    ],
  },
  {
    role: 'logistique',
    label: 'Agent Logistique & RH',
    subtitle: 'Gestion ODM, flotte, ressources humaines',
    desc: 'Optimise les ordres de mission, suit la disponibilité de la flotte véhicules, gère les affectations du personnel terrain et les compteurs de présence.',
    color: TEAL,
    bg: '#CCFBF1',
    icon: <ClipboardList size={20} style={{ color: TEAL }} />,
    perimetres: ['ODM', 'Flotte', 'RH', 'Présences'],
    suggestions: [
      'Bilan des ODM émis cette semaine',
      'Quels véhicules sont disponibles demain ?',
      'Affecte l\'ingénieur Diop au chantier BT Nord',
      'Synthèse présences équipes terrain — mai 2026',
    ],
  },
];

/* ─── Agents visibles par rôle ─────────── */
// Principe : chaque rôle voit uniquement les agents pertinents à sa mission
// Hiérarchie ascendante : RESP_LOG → CTRL_FIN → CHEF_PROJ → CHEF_DEPT → PMO → DIR_DPE
const ROLE_AGENTS: Record<RoleCode, AgentRole[]> = {
  DIR_DPE:   ['direction', 'suivi_eval', 'redaction'],
  PMO:       ['planification', 'suivi_eval', 'chef_projet', 'redaction', 'ged'],
  CHEF_DEPT: ['chef_projet', 'suivi_eval', 'planification', 'ged', 'redaction'],
  CHEF_PROJ: ['chef_projet', 'planification', 'ged'],
  INGENIEUR: ['chef_projet', 'planification', 'ged', 'terrain'],
  EXPERT:    ['chef_projet', 'planification', 'suivi_eval', 'redaction', 'ged'],
  CONTROLEUR:['suivi_eval', 'chef_projet', 'planification', 'finance'],
  CHARGE:    ['chef_projet', 'suivi_eval', 'terrain'],
  ASSISTANT: ['chef_projet', 'ged', 'redaction'],
  SECRETAIRE:['ged', 'redaction'],
  CHAUFFEUR: ['logistique'],
  CTRL_FIN:  ['finance', 'ged'],
  RESP_LOG:  ['logistique'],
  MARCHES:   ['finance', 'ged', 'redaction'],
  SIG:       ['terrain', 'ged'],
  IMMO:      ['finance', 'ged'],
  AUDIT:     ['suivi_eval', 'redaction', 'ged'],
  CONTROLEUR_TRAVAUX: ['terrain', 'suivi_eval', 'ged'],
  ADMIN:     ['direction', 'chef_projet', 'planification', 'finance', 'ged', 'suivi_eval', 'redaction', 'terrain', 'logistique'],
};

/* ─── Réponses simulées par agent ───────────────────────────────────────────── */
type ProjectData = ReturnType<typeof useProjectStore>['projets'];

function buildAgentReply(q: string, agent: AgentConfig, projets: ProjectData): string {
  const qLow = q.toLowerCase();
  const totalProjets = projets.length;
  const projetsCritiques = projets.filter(p => p.cpi < 0.90 || p.spi < 0.85).length;
  const avgCpi = totalProjets > 0 ? +(projets.reduce((s, p) => s + p.cpi, 0) / totalProjets).toFixed(2) : 1.0;
  const avgSpi = totalProjets > 0 ? +(projets.reduce((s, p) => s + p.spi, 0) / totalProjets).toFixed(2) : 1.0;

  switch (agent.role) {
    case 'chef_projet':
      if (qLow.includes('jalonss') || qLow.includes('jalon')) return `📍 **Jalons critiques identifiés :**\n\n• Validation étude APD — 28/06 (HTA Ouest)\n• Livraison lot poteaux — 03/07 (BT Sud)\n• PV réception partielle — 15/07 (Électrification Nord)\n\n⚠️ 2 jalons à risque (délai +12j et blocage fournisseur).`;
      if (qLow.includes('wbs')) return `📊 **Création WBS depuis modèle DPE :**\n\n✅ Modèle « Réseau HTA » appliqué\n• Lot 1 : Études (5 tâches)\n• Lot 2 : Approvisionnements (8 tâches)\n• Lot 3 : Travaux (12 tâches)\n• Lot 4 : Réception & Clôture (4 tâches)\n\nWBS créé et lié au projet sélectionné.`;
      return `🤖 **Analyse copilote chef de projet :**\n\n${totalProjets} projets actifs dans votre périmètre.\n${projetsCritiques} projets en situation critique.\n\nJe suis prêt à vous assister dans le pilotage. Précisez votre demande sur le planning, les jalons, les écarts ou la préparation d'un comit\xe9.
📋 **Rappel procédure :** le chef de projet doit valider les jalons critiques avant le 15 du mois (Planifier & Exécuter, art. 4.2).`;
  
    case 'planification':
      if (qLow.includes('chemin critique') || qLow.includes('critique')) return `🔴 **Chemin critique — Projet BT Sud :**\n\n1. Commande poteaux béton (S2-S3) → **bloqué** +12j\n2. Pose zone Nord (S3-S5)\n3. Réception partielle (S5)\n\n⚠️ Impact potentiel sur la date de fin : +2 semaines.\nRecommandation : négocier livraison accélérée fournisseur.`;
      if (qLow.includes('conflit') || qLow.includes('ressource')) return `👥 **Conflits ressources S3-S5 :**\n\n• Entreprise A : 120% de charge en S3 → surallocation détectée\n• CP Traoré : 2 projets simultanés S4 → arbitrage requis\n\nSolution proposée : décaler la tâche « Inspection qualité » de S4 à S5.`;
      return `📅 **Agent Planification activé.**\n\nAudit de l'ordonnancement en cours sur ${totalProjets} projets.\nDétection des conflits de ressources et comparaison baseline en attente de votre commande.
📋 **Rappel procédure :** la baseline doit être comparée au planning actuel chaque semaine (Structuration SIGEPP, art. 5.3).`;

    case 'finance':
      if (qLow.includes('cpi') || qLow.includes('spi')) {        
        return `💰 **KPIs financiers portefeuille :**\n\n• CPI moyen : **${avgCpi}** ${avgCpi >= 0.90 ? '✅' : '🔴 Alerte'}\n• SPI moyen : **${avgSpi}** ${avgSpi >= 0.85 ? '✅' : '⚠️ Attention'}\n• ${projetsCritiques} projets sous les seuils d\'alerte\n\nRecommandation : révision budgétaire sur les 3 projets les plus critiques.`;
      }
      if (qLow.includes('facture') || qLow.includes('validation')) return `📋 **Factures en attente de validation :**\n\n• FAC-2026-0145 : 184 500 000 FCFA · CT-HTA-009 · En révision PMO\n• FAC-2026-0138 : 42 300 000 FCFA · CT-BT-003 · Validation finance\n\n⏱️ Délai moyen de traitement : 4 jours. Chaîne bon à payer opérationnelle.`;
      return `💼 **Agent Financier activé.**\n\nAccès autorisé : Marchés, Factures, Budget, ERP.\nPérimètre : Projet sélectionné · Lecture/édition contrôlée.\n\nQue souhaitez-vous analyser ou valider ?
📋 **Rappel procédure :** les factures doivent être validées sous 5 jours ouvrés (Passation marchés DAO, art. 6.1).`;

    case 'ged':
      if (qLow.includes('manquant') || qLow.includes('pièce')) return `📎 **Pièces obligatoires manquantes :**\n\n• Contrat CT-HTA-009 : PV de démarrage absent\n• Projet BT Sud : Plans d'exécution non versionnés\n• ODM-2026-045 : Rapport de mission incomplet\n\n🔴 3 dossiers non conformes nécessitent action immédiate.`;
      return `📁 **Agent GED & Conformité activé.**\n\nContrôle documentaire en cours. Base GED indexée, politiques de conservation appliquées.\nDemandez-moi de vérifier un dossier ou de détecter les anomalies.
📋 **Rappel procédure :** les documents doivent être archivés dans les 30 jours suivant la clôture (GED, art. 3.2).`;

    case 'suivi_eval':
      if (qLow.includes('anomalie') || qLow.includes('terrain')) return `⚠️ **Anomalies terrain en attente :**\n\n• Lot HTA Nord : taux physique 61% · source mission 28/06 · **à confirmer**\n• Programme BT Sud : justificatif financier manquant · relance envoyée\n• 2 photos géolocalisées reçues · 1 PV signé attendu · 1 rapport en retard\n\nActions proposées : relance automatique superviseur terrain.`;
      return `📊 **Analyste Suivi-Évaluation activé.**\n\nConsolidation des indicateurs en temps réel.\n• Exécution physique : **61%**\n• Exécution financière : **54%**\n• KPI validés : **8/10**\n• Rapports à publier : **4**\n• Anomalies détectées : **6**\n\nQue souhaitez-vous analyser ou exporter ?
📋 **Rappel procédure :** le rapport mensuel doit être publié avant le 5 du mois suivant (Reporting, art. 2.1).`;

    case 'redaction':
      if (qLow.includes('rapport mensuel') || qLow.includes('mensuel')) return `✍️ **Rédaction rapport mensuel en cours...**\n\n📄 **Rapport Mensuel — Projet BT Sud — Mai 2026**\n\n**1. Synthèse exécutive**\nLe projet BT Sud affiche un avancement de 61% avec un CPI de ${projets[0]?.cpi.toFixed(2) ?? '0.92'} et un SPI de ${projets[0]?.spi.toFixed(2) ?? '0.88'}.\n\n**2. Faits majeurs du mois**\n• Livraison des poteaux béton avec un retard de 12j\n• Réception partielle lot 1 programmée le 03/07\n• Budget engagé : 54%\n\n**3. Points de vigilance**\n• Blocage fournisseur à lever avant le 30/05\n• 3 jalons critiques en S5-S6\n\n*[Section automatiquement générée depuis les données SIGEPP-DPE]*`; // Using projets[0] as a placeholder, ideally would be project-specific
      return `✍️ **Agent Rédaction activé.**\n\nJe peux générer : rapports mensuels, synthèses comité, notes de décision, comptes-rendus.\n\nPréciez le type de document et le projet ou programme concerné.
📋 **Rappel procédure :** le rapport doit contenir synthèse, faits majeurs et points de vigilance (Évaluation des rapports, art. 1.3).`;

    case 'direction':
      if (qLow.includes('synthèse') || qLow.includes('portefeuille')) {        
        const onTimeProjets = projets.filter(p => p.spi >= 0.85).length;
        const avgAvancement = totalProjets > 0 ? Math.round(projets.reduce((sum, p) => sum + p.avancement, 0) / totalProjets) : 0;
        const totalBudget = projets.reduce((sum, p) => sum + p.budget, 0);
        const totalDecaisse = projets.reduce((sum, p) => sum + p.budgetDecaisse, 0);
        const budgetEngagePct = totalBudget > 0 ? Math.round((projets.reduce((sum, p) => sum + p.budgetEngage, 0) / totalBudget) * 100) : 0;
        const decaissePct = totalBudget > 0 ? Math.round((totalDecaisse / totalBudget) * 100) : 0;

        return `📊 **Synthèse Exécutive Portefeuille — S1 2026**\n\n• ${totalProjets} projets actifs · ${onTimeProjets} dans les délais · ${projetsCritiques} critiques\n• Budget engagé : ${budgetEngagePct}% · Décaissements : ${decaissePct}%\n• Avancement physique moyen : ${avgAvancement}%\n\n🔴 **Points d'arbitrage :**\n• BT Sud : retard fournisseur +12j — arbitrage procurement requis\n• HTA Ouest : dépassement budgétaire +8% — révision marchés\n• Électrification Nord : CP en arrêt maladie — remplacement interim\n\n✅ Rapport prêt pour la revue de direction du 03/07.`;
      }
      if (qLow.includes('arbitrage') || qLow.includes('urgent')) return `⚡ **Projets nécessitant arbitrage immédiat :**\n\n1. **BT Sud** — Blocage fournisseur poteaux (+12j) → Décision sourcing alternatif\n2. **HTA Ouest** — Dépassement +8% budget → Avenant ou réallocation\n3. **Électrification Nord** — CP en arrêt maladie → Remplacement interim\n\n📋 3 arbitrages à soumettre au CODIR avant le 05/07.`;
      return `👔 **Copilote Directeur DPE activé.**\n\nVision portefeuille consolidée : ${totalProjets} projets, budget total géré.\n${projetsCritiques} projets en situation critique nécessitent votre attention.\n\nJe peux préparer des synthèses exécutives, notes de décision ou rapports bailleurs.
📋 **Rappel procédure :** la revue de direction se tient trimestriellement (Workflow approbation budgets, art. 2.4).`;

    case 'terrain':
      if (qLow.includes('ordre de mission') || qLow.includes('odm')) return `📋 **Création Ordre de Mission :**\n\n• Ingénieur : Omar DIOP\n• Destination : Chantier BT Nord — Thiès\n• Date : Demain 08h00\n• Véhicule affecté : TG-8821-DK\n• Objet : Supervision lot 3 — pose poteaux\n\n✅ ODM-2026-089 créé · En attente validation superviseur.`;
      if (qLow.includes('avancement') || qLow.includes('68')) return `📍 **Enregistrement avancement :**\n\n• Projet : HTA Nord\n• Lot : Travaux de réseau HTA\n• Avancement physique : **68%** ✅\n• Géolocalisation : 14.7231°N, -16.9421°W\n• Photo joints : 3 · Validés : 3\n\nSaisie enregistrée et synchronisée avec le SIGEPP.`;
      return `🔧 **Agent Terrain activé.**\n\nAccès à : Saisies avancement, GPS, ODM, photos chantier.\nVos missions du jour : 2 chantiers actifs, 1 ODM en cours, 3 photos à valider.\n\nComment puis-je vous assister sur le terrain ?
📋 **Rappel procédure :** l'ODM doit être validé par le responsable UAGL avant départ (Workflow ODM, art. 3.1).`;

    case 'logistique': // Assuming 'tot' here refers to total active projects, which might not be directly relevant for logistique, but keeping for consistency.
      if (qLow.includes('véhicule') || qLow.includes('flotte') || qLow.includes('disponible')) return `🚗 **Disponibilité flotte — Demain :**\n\n✅ TG-8821-DK — Toyota HiLux · Libre\n✅ TG-4502-DK — Nissan Patrol · Libre\n⚠️ TG-1237-DK — Land Cruiser · En maintenance (retour prévu 28/05)\n❌ TG-9044-DK — Réservé Direction\n\n2 véhicules disponibles sur 4.`;
      if (qLow.includes('odm') || qLow.includes('bilan') || qLow.includes('semaine')) return `📋 **Bilan ODM — Semaine 21 (du 19 au 25/05) :**\n\n• ODM émis : 12 · Validés : 10 · En attente : 2\n• Km parcourus : 1 847 km\n• Personnes déployées : 8 ingénieurs\n• Chantiers visités : 5\n\n💡 Coût missions : 1 240 000 FCFA (budget mensuel : 6 500 000 FCFA — 19%)`;
      return `🚗 **Agent Logistique & RH activé.**\n\nGestion : ${totalProjets} projets actifs · Flotte 4 véhicules · Équipe terrain 8 personnes.\nODM en cours : 2 · Absences à gérer : 1\n\nQue souhaitez-vous planifier ou suivre ?
📋 **Rappel procédure :** le contrôle des kilométrages est mensuel (Gestion flotte, art. 4.2).`;

    default:
      return `Je suis l'agent ${agent.label}. Comment puis-je vous assister ?`;
  }
}

let msgIdCounter = 0;
const nextMsgId = (): string => `msg_${++msgIdCounter}`;

const TYPING_DELAY_MIN = 800;
const TYPING_DELAY_MAX = 1400; // 800 + 600
/* ═══════════════════════════════════════════════════
   COMPOSANT PRINCIPAL
═══════════════════════════════════════════════════ */
export default function AgentsIA() {
  const store = useProjectStore();
  const { user } = useAuth();
  const role = user?.role ?? 'ADMIN';

  // Agents visible for this role
  const visibleAgentRoles = ROLE_AGENTS[role as RoleCode] ?? ROLE_AGENTS.ADMIN;
  const visibleAgents = AGENTS.filter(a => visibleAgentRoles.includes(a.role));

  const defaultAgent = visibleAgents[0]?.role ?? 'chef_projet';
  const [activeAgent, setActiveAgent] = useState<AgentRole>(defaultAgent);

  const [messages, setMessages] = useState<Record<AgentRole, Message[]>>({
    direction:    [],
    chef_projet:  [],
    planification:[],
    finance:      [],
    ged:          [],
    suivi_eval:   [],
    redaction:    [],
    terrain:      [],
    logistique:   [],
  });
  const [input, setInput]     = useState('');
  const [loading, setLoading] = useState(false);
  const [showCopilot, setShowCopilot] = useState(false);
  const copilot = useIntegrationConfig(s => s.copilot);
  const updateCopilot = useIntegrationConfig(s => s.updateCopilot);
  const bottomRef = useRef<HTMLDivElement>(null);

  // If active agent is no longer visible (role switch), reset
  const safeActiveAgent = visibleAgentRoles.includes(activeAgent) ? activeAgent : defaultAgent;
  const agent   = AGENTS.find(a => a.role === safeActiveAgent) ?? visibleAgents[0];
  const thread  = messages[safeActiveAgent];

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [thread]);

  const sendMessage = async () => {
    if (!input.trim() || loading) return;
    const q = input.trim();
    setInput('');

    const userMsg: Message = { id: nextMsgId(), role: 'user', content: q, timestamp: new Date() };
    setMessages(prev => ({ ...prev, [safeActiveAgent]: [...prev[safeActiveAgent], userMsg] }));
    setLoading(true);
    
    await new Promise(r => setTimeout(r, TYPING_DELAY_MIN + Math.random() * (TYPING_DELAY_MAX - TYPING_DELAY_MIN)));

    const replyContent = buildAgentReply(q, agent, store.projets);
    const agentMsg: Message = {
      id: nextMsgId(), role: 'agent', content: replyContent, timestamp: new Date(),
      sources: ['planning', 'GED', 'bordereau'].slice(0, Math.floor(Math.random() * 3) + 1),
    };
    setMessages(prev => ({ ...prev, [safeActiveAgent]: [...prev[safeActiveAgent], agentMsg] }));
    setLoading(false);
  };

  const useSuggestion = (s: string) => {
    setInput(s);
  };

  const clearThread = () => {
    setMessages(prev => ({ ...prev, [safeActiveAgent]: [] }));
  };

  /* Formatter le markdown simplifié */
  function renderContent(text: string) {
    return text.split('\n').map((line, i) => {
      if (line.startsWith('**') && line.endsWith('**')) {
        return <div key={i} style={{ fontWeight: 700, color: '#1E293B', marginBottom: 2 }}>{line.replace(/\*\*/g, '')}</div>;
      }
      if (line.startsWith('• ') || line.startsWith('- ')) {
        return <div key={i} style={{ paddingLeft: 12, color: '#475569', lineHeight: 1.5 }}>• {line.slice(2)}</div>;
      }
      if (line.startsWith('📍') || line.startsWith('📊') || line.startsWith('🤖') || line.startsWith('💰') || line.startsWith('📋') || line.startsWith('📎') || line.startsWith('📁') || line.startsWith('⚠️') || line.startsWith('✍️') || line.startsWith('📅') || line.startsWith('👥') || line.startsWith('💼') || line.startsWith('🔴') || line.startsWith('📄') || line.startsWith('✅')) {
        return <div key={i} style={{ color: '#1E293B', lineHeight: 1.6, marginBottom: 2 }}>{line}</div>;
      }
      if (line === '') return <div key={i} style={{ height: 6 }} />;
      return <div key={i} style={{ color: '#475569', lineHeight: 1.6 }}>{line}</div>;
    });
  }

  return (
    <div style={{ display: 'flex', height: '100%', background: '#F8FAFD', overflow: 'hidden' }}>

      {/* ── Rail gauche : sélection agent ── */}
      <div style={{
        width: 260, flexShrink: 0, background: '#fff',
        borderRight: '1px solid #E2E8F0', overflowY: 'auto',
        display: 'flex', flexDirection: 'column',
      }}>
        {/* Header */}
        <div style={{ padding: '16px 14px 12px', borderBottom: '1px solid #F1F5F9' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
            <Bot size={20} style={{ color: NAVY }} />
            <span style={{ fontSize: 14, fontWeight: 800, color: '#0F172A' }}>Agents IA de rôle</span>
          </div>
          <div style={{ fontSize: 11.5, color: '#94A3B8' }}>
            {visibleAgents.length} agent{visibleAgents.length > 1 ? 's' : ''} pour votre profil · Périmètres contrôlés · Journal d&apos;audit
          </div>
        </div>

        {/* Liste agents filtrés par rôle */}
        <nav style={{ flex: 1, padding: '8px 8px' }}>
          {visibleAgents.map(ag => {
            const isActive  = ag.role === safeActiveAgent;
            const msgCount  = messages[ag.role].filter(m => m.role === 'user').length;
            return (
              <button
                key={ag.role}
                onClick={() => setActiveAgent(ag.role as AgentRole)}
                style={{
                  width: '100%', padding: '10px 10px', marginBottom: 4,
                  borderRadius: 8, border: 'none', cursor: 'pointer', fontFamily: 'inherit',
                  background: isActive ? ag.bg : 'transparent',
                  borderLeft: isActive ? `3px solid ${ag.color}` : '3px solid transparent',
                  textAlign: 'left',
                  transition: 'background 0.1s',
                }}
                onMouseEnter={e => { if (!isActive) (e.currentTarget as HTMLButtonElement).style.background = '#F8FAFC'; }}
                onMouseLeave={e => { if (!isActive) (e.currentTarget as HTMLButtonElement).style.background = 'transparent'; }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <div style={{
                    width: 32, height: 32, borderRadius: 8, flexShrink: 0,
                    background: `${ag.color}15`, display: 'flex', alignItems: 'center', justifyContent: 'center',
                  }}>
                    {ag.icon}
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 12.5, fontWeight: isActive ? 700 : 600, color: isActive ? ag.color : '#1E293B', lineHeight: 1.2 }}>
                      {ag.label}
                    </div>
                    <div style={{ fontSize: 10.5, color: '#94A3B8', marginTop: 1 }}>{ag.subtitle}</div>
                  </div>
                  {msgCount > 0 && (
                    <span style={{
                      fontSize: 9.5, fontWeight: 700, padding: '1px 5px', borderRadius: 10,
                      background: ag.bg, color: ag.color,
                    }}>{msgCount}</span>
                  )}
                </div>
              </button>
            );
          })}
        </nav>

        {/* Footer info */}
        <div style={{ padding: '10px 12px', borderTop: '1px solid #F1F5F9', background: '#FAFBFD' }}>
          <div style={{ fontSize: 10.5, color: '#94A3B8', lineHeight: 1.5 }}>
            🔒 Chaque agent est limité par des permissions, des jeux de données autorisés et des journaux d&apos;audit explicites.
          </div>
        </div>
      </div>

      {/* ── Zone principale : chat ── */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>

        {/* Header agent actif */}
        <div style={{
          padding: '14px 20px', background: '#fff', borderBottom: '1px solid #E2E8F0',
          display: 'flex', alignItems: 'center', gap: 14, flexShrink: 0,
        }}>
          <div style={{
            width: 42, height: 42, borderRadius: 10, flexShrink: 0,
            background: `${agent.color}15`, display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            {agent.icon}
          </div>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 15, fontWeight: 800, color: '#0F172A', display: 'flex', alignItems: 'center', gap: 8 }}>
              {agent.label}
              <span style={{
                fontSize: 10, fontWeight: 700, padding: '2px 7px', borderRadius: 10,
                background: `${agent.color}18`, color: agent.color,
              }}>
                Rôle actif
              </span>
            </div>
            <div style={{ fontSize: 11.5, color: '#64748B', marginTop: 2 }}>
              {agent.desc}
            </div>
          </div>
          {/* Périmètres */}
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', maxWidth: 280 }}>
            {agent.perimetres.map(p => (
              <span key={p} style={{
                fontSize: 10, fontWeight: 600, padding: '2px 7px', borderRadius: 6,
                background: '#F1F5F9', color: '#475569',
              }}>{p}</span>
            ))}
          </div>
          {/* Connexion Microsoft Copilot */}
          <button onClick={() => setShowCopilot(true)} title="Connexion Microsoft Copilot" style={{
            display: 'flex', alignItems: 'center', gap: 6, padding: '6px 11px', borderRadius: 8,
            border: `1px solid ${copilot.enabled ? '#16A34A' : '#E2E8F0'}`,
            background: copilot.enabled ? '#F0FDF4' : '#fff', cursor: 'pointer', fontSize: 11.5, fontWeight: 700,
            color: copilot.enabled ? '#15803D' : '#475569', fontFamily: 'inherit',
          }}>
            <Cloud size={14} /> {copilot.enabled ? `Copilot · ${copilot.account || 'connecté'}` : 'Connecter Copilot'}
          </button>
          <button onClick={clearThread} title="Effacer la conversation" style={{
            width: 32, height: 32, borderRadius: 7, border: '1px solid #E2E8F0',
            background: '#fff', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <RefreshCw size={13} style={{ color: '#94A3B8' }} />
          </button>
        </div>

        {copilot.enabled && (
          <div style={{ padding: '6px 20px', background: '#F0FDF4', borderBottom: '1px solid #DCFCE7', fontSize: 11.5, color: '#15803D', display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0 }}>
            <CheckCircle2 size={13} /> Réponses générées via <strong>Microsoft Copilot</strong> ({copilot.deployment || 'gpt-4o'}) — compte {copilot.account || 'Microsoft 365 SENELEC'}.
          </div>
        )}

        {showCopilot && <CopilotModal copilot={copilot} onSave={updateCopilot} onClose={() => setShowCopilot(false)} />}

        {/* Thread messages */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '20px' }}>

          {/* Message de bienvenue si vide */}
          {thread.length === 0 && (
            <div style={{ textAlign: 'center', marginBottom: 28 }}>
              <div style={{
                width: 60, height: 60, borderRadius: 16, margin: '0 auto 14px',
                background: `${agent.color}15`, display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}>
                <div style={{ transform: 'scale(1.5)' }}>{agent.icon}</div>
              </div>
              <div style={{ fontSize: 16, fontWeight: 800, color: '#0F172A', marginBottom: 6 }}>
                {agent.label}
              </div>
              <div style={{ fontSize: 13, color: '#64748B', maxWidth: 400, margin: '0 auto', lineHeight: 1.6 }}>
                {agent.desc}
              </div>

              {/* Suggestions */}
              <div style={{ marginTop: 20, display: 'flex', flexWrap: 'wrap', gap: 8, justifyContent: 'center' }}>
                {agent.suggestions.map((s, i) => (
                  <button
                    key={i}
                    onClick={() => useSuggestion(s)}
                    style={{
                      padding: '8px 14px', borderRadius: 20,
                      border: `1px solid ${agent.color}40`,
                      background: `${agent.color}08`, color: agent.color,
                      fontSize: 12.5, cursor: 'pointer', fontFamily: 'inherit', fontWeight: 500,
                      transition: 'all 0.1s',
                    }}
                    onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.background = `${agent.color}18`; }}
                    onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.background = `${agent.color}08`; }}
                  >
                    {s}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Messages */}
          {thread.map(msg => (
            <div key={msg.id} style={{
              display: 'flex', gap: 12, marginBottom: 16,
              flexDirection: msg.role === 'user' ? 'row-reverse' : 'row',
              alignItems: 'flex-start',
            }}>
              {/* Avatar */}
              <div style={{
                width: 32, height: 32, borderRadius: 8, flexShrink: 0,
                background: msg.role === 'user' ? '#1E293B' : `${agent.color}15`,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}>
                {msg.role === 'user'
                  ? <User size={14} style={{ color: '#fff' }} />
                  : agent.icon
                }
              </div>

              {/* Bulle */}
              <div style={{ maxWidth: '70%' }}>
                <div style={{
                  padding: '12px 14px', borderRadius: 12,
                  borderBottomRightRadius: msg.role === 'user' ? 4 : 12,
                  borderBottomLeftRadius:  msg.role === 'agent' ? 4 : 12,
                  background: msg.role === 'user' ? '#1E293B' : '#fff',
                  border: msg.role === 'agent' ? '1px solid #E2E8F0' : 'none',
                  boxShadow: msg.role === 'agent' ? '0 1px 4px rgba(0,0,0,0.06)' : 'none',
                  color: msg.role === 'user' ? '#fff' : '#1E293B',
                  fontSize: 13, lineHeight: 1.6,
                }}>
                  {msg.role === 'agent' ? renderContent(msg.content) : msg.content}
                </div>

                {/* Sources */}
                {msg.sources && msg.sources.length > 0 && (
                  <div style={{ display: 'flex', gap: 5, marginTop: 5, flexWrap: 'wrap', justifyContent: msg.role === 'user' ? 'flex-end' : 'flex-start' }}>
                    {msg.sources.map(s => (
                      <span key={s} style={{
                        fontSize: 10, padding: '1px 6px', borderRadius: 8,
                        background: '#F1F5F9', color: '#64748B', border: '1px solid #E2E8F0',
                      }}>
                        📎 Source : {s}
                      </span>
                    ))}
                  </div>
                )}

                <div style={{
                  fontSize: 10, color: '#94A3B8', marginTop: 4,
                  textAlign: msg.role === 'user' ? 'right' : 'left',
                }}>
                  {msg.timestamp.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}
                </div>
              </div>
            </div>
          ))}

          {/* Indicateur typing */}
          {loading && (
            <div style={{ display: 'flex', gap: 12, alignItems: 'center', marginBottom: 16 }}>
              <div style={{
                width: 32, height: 32, borderRadius: 8, flexShrink: 0,
                background: `${agent.color}15`, display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}>
                {agent.icon}
              </div>
              <div style={{
                padding: '12px 16px', borderRadius: 12, borderBottomLeftRadius: 4,
                background: '#fff', border: '1px solid #E2E8F0',
                display: 'flex', gap: 4, alignItems: 'center',
              }}>
                {[0, 1, 2].map(i => (
                  <div key={i} style={{
                    width: 6, height: 6, borderRadius: '50%', background: agent.color,
                    animation: `bounce 1s ease ${i * 0.15}s infinite`,
                    opacity: 0.7,
                  }} />
                ))}
              </div>
            </div>
          )}

          <div ref={bottomRef} />
        </div>

        {/* ── Zone saisie ── */}
        <div style={{
          padding: '14px 20px', background: '#fff', borderTop: '1px solid #E2E8F0', flexShrink: 0,
        }}>
          {/* Suggestions rapides (si thread vide ou > 0) */}
          {thread.length === 0 && (
            <div style={{ display: 'flex', gap: 6, marginBottom: 10, flexWrap: 'wrap' }}>
              {agent.suggestions.slice(0, 2).map((s, i) => (
                <button key={i} onClick={() => useSuggestion(s)} style={{
                  padding: '5px 10px', borderRadius: 16, fontSize: 11.5,
                  border: `1px solid ${agent.color}30`, background: `${agent.color}08`,
                  color: agent.color, cursor: 'pointer', fontFamily: 'inherit',
                }}>
                  {s.slice(0, 45)}{s.length > 45 ? '…' : ''}
                </button>
              ))}
            </div>
          )}

          <div style={{ display: 'flex', gap: 10, alignItems: 'flex-end' }}>
            <div style={{ flex: 1, position: 'relative' }}>
              <textarea
                value={input}
                onChange={e => setInput(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage(); } }}
                placeholder={`Demandez à ${agent.label.split(' ').slice(-2).join(' ')}…`}
                rows={1}
                style={{
                  width: '100%', padding: '10px 14px',
                  borderRadius: 10, border: '1px solid #E2E8F0',
                  fontSize: 13, outline: 'none', resize: 'none', fontFamily: 'inherit',
                  boxSizing: 'border-box', lineHeight: 1.5,
                  boxShadow: '0 1px 4px rgba(0,0,0,0.05)',
                }}
                onFocus={e => e.currentTarget.style.borderColor = agent.color}
                onBlur={e => e.currentTarget.style.borderColor = '#E2E8F0'}
              />
            </div>
            <button
              onClick={sendMessage}
              disabled={!input.trim() || loading}
              style={{
                width: 40, height: 40, borderRadius: 10, border: 'none',
                background: !input.trim() || loading ? '#E2E8F0' : agent.color,
                color: !input.trim() || loading ? '#94A3B8' : '#fff',
                cursor: !input.trim() || loading ? 'default' : 'pointer',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                transition: 'background 0.15s',
                flexShrink: 0,
              }}
            >
              <Send size={16} />
            </button>
          </div>

          {/* Cadre de contrôle */}
          <div style={{ display: 'flex', gap: 12, marginTop: 8, alignItems: 'center', fontSize: 10.5, color: '#94A3B8' }}>
            <Shield size={11} style={{ color: '#94A3B8' }} />
            <span>Périmètre : {agent.perimetres.join(' · ')}</span>
            <span>·</span>
            <span>Journal d&apos;audit actif</span>
          </div>
        </div>
      </div>

      <style>{`
        @keyframes bounce {
          0%, 100% { transform: translateY(0); }
          50% { transform: translateY(-4px); }
        }
      `}</style>
    </div>
  );
}

/* ─── Modale de connexion Microsoft Copilot ──────────────────────────────── */
import type { CopilotStoredConfig } from '@/lib/integrationConfigStore';
function CopilotModal({ copilot, onSave, onClose }: {
  copilot: CopilotStoredConfig;
  onSave: (cfg: Partial<CopilotStoredConfig>) => void;
  onClose: () => void;
}) {
  const [form, setForm] = useState<CopilotStoredConfig>({ ...copilot });
  const set = (k: keyof CopilotStoredConfig, v: string | boolean) => setForm(f => ({ ...f, [k]: v }));
  const fld = (label: string, key: keyof CopilotStoredConfig, placeholder: string, type = 'text') => (
    <div>
      <label style={{ display: 'block', fontSize: 10.5, fontWeight: 700, color: '#64748B', textTransform: 'uppercase', marginBottom: 4 }}>{label}</label>
      <input type={type} value={String(form[key] ?? '')} placeholder={placeholder}
        onChange={e => set(key, e.target.value)}
        style={{ width: '100%', padding: '8px 10px', borderRadius: 8, border: '1.5px solid #CBD5E1', fontSize: 13, fontFamily: 'inherit', boxSizing: 'border-box' }} />
    </div>
  );
  const valid = form.tenantId.trim() && form.clientId.trim() && form.account.trim();

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 300, background: 'rgba(15,23,42,0.55)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
      <div style={{ background: '#fff', borderRadius: 14, width: '100%', maxWidth: 480, boxShadow: '0 24px 70px rgba(0,0,0,0.35)', overflow: 'hidden' }}>
        <div style={{ padding: '14px 18px', borderBottom: '1px solid #F1F5F9', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontWeight: 800, fontSize: 15, color: '#0F172A' }}>
            <Cloud size={18} style={{ color: '#2563EB' }} /> Connexion Microsoft Copilot
          </div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#94A3B8' }}><X size={18} /></button>
        </div>
        <div style={{ padding: 18, display: 'flex', flexDirection: 'column', gap: 12, maxHeight: '70vh', overflowY: 'auto' }}>
          <div style={{ fontSize: 12, color: '#64748B' }}>
            Connectez votre compte <strong>Microsoft 365 / Entra ID</strong> (Azure OpenAI) pour générer les réponses via Copilot.
          </div>
          {fld('Compte Microsoft (UPN / e-mail)', 'account', 'prenom.nom@senelec.sn')}
          {fld('Tenant ID (Entra)', 'tenantId', 'xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx')}
          {fld('Client ID (App registration)', 'clientId', 'xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx')}
          {fld('Endpoint Azure OpenAI', 'endpoint', 'https://senelec.openai.azure.com')}
          {fld('Déploiement (modèle)', 'deployment', 'gpt-4o')}
          {fld('Clé API (optionnelle si SSO Entra)', 'apiKey', '••••••••', 'password')}
        </div>
        <div style={{ padding: '12px 18px', borderTop: '1px solid #F1F5F9', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10 }}>
          {copilot.enabled ? (
            <button onClick={() => { onSave({ enabled: false }); toast('Copilot déconnecté', { icon: 'ℹ️' }); onClose(); }}
              style={{ padding: '8px 14px', borderRadius: 8, border: '1px solid #FCA5A5', background: '#FEF2F2', color: '#B91C1C', fontSize: 12.5, fontWeight: 700, cursor: 'pointer' }}>Déconnecter</button>
          ) : <span />}
          <button onClick={() => { if (!valid) return; onSave({ ...form, enabled: true }); toast.success('Microsoft Copilot connecté'); onClose(); }}
            disabled={!valid}
            style={{ padding: '9px 18px', borderRadius: 8, border: 'none', background: valid ? '#2563EB' : '#CBD5E1', color: '#fff', fontSize: 13, fontWeight: 700, cursor: valid ? 'pointer' : 'not-allowed' }}>
            Connecter & utiliser Copilot
          </button>
        </div>
      </div>
    </div>
  );
}

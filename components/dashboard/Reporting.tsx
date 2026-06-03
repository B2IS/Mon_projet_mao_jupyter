'use client';

import { useState } from 'react';
import {
  FileText, Download, Eye, RefreshCw, CheckCircle, Clock, BarChart2,
  TrendingUp, Send, Plus, Calendar, Globe, ChevronDown, Printer, AlertTriangle, Users
} from 'lucide-react';
import { useProjectStore, DOMAINE_CFG } from '@/lib/projectStore';
import { SENELEC_LOGO_DATA_URI } from '@/lib/senelecLogo';

/* ═══════════════════════════════════════════════════════════════════
   TYPES & MOCK DATA
═══════════════════════════════════════════════════════════════════ */
type TypeRapport = 'mensuel_cp' | 'trimestriel_dpe' | 'bailleur_bm' | 'bailleur_afd' | 'bailleur_bad' | 'evm' | 'sig' | 'risques' | 'uagl';
type Format = 'PDF' | 'Excel' | 'Word';
type Langue = 'FR' | 'EN';

interface RapportType {
  id: TypeRapport; label: string; description: string;
  icon: React.ReactNode; color: string; formats: Format[]; pages: number;
  bailleur?: string;
}

interface RapportRecent {
  id: string; nom: string; type: string; periode: string;
  generePar: string; date: string; taille: string;
  format: Format; color: string;
}

interface RapportPlanifie {
  id: string; label: string; frequence: string;
  prochaine: string; destinataires: string[]; actif: boolean; color: string;
}

const TYPES_RAPPORT: RapportType[] = [
  {
    id: 'mensuel_cp', label: 'Rapport Mensuel CP', description: 'Rapport mensuel du Chef de Projet — avancement, budget, jalons, incidents',
    icon: <FileText size={16} />, color: 'var(--orange)', formats: ['PDF', 'Word'], pages: 12,
  },
  {
    id: 'trimestriel_dpe', label: 'Rapport Trimestriel DPE', description: 'Rapport trimestriel Direction Principale Équipement — synthèse portefeuille',
    icon: <BarChart2 size={16} />, color: 'var(--navy)', formats: ['PDF', 'Word'], pages: 28,
  },
  {
    id: 'bailleur_bm', label: 'Rapport Bailleur — Banque Mondiale', description: 'Format IFR / ISR Banque Mondiale — PADAES Phase II — USD',
    icon: <Globe size={16} />, color: '#2563EB', formats: ['PDF', 'Word', 'Excel'], pages: 35,
    bailleur: 'BM',
  },
  {
    id: 'bailleur_afd', label: 'Rapport Bailleur — AFD', description: 'Format Rapport Technique AFD — EUR — Indicateurs IRD',
    icon: <Globe size={16} />, color: '#16A34A', formats: ['PDF', 'Word'], pages: 22,
    bailleur: 'AFD',
  },
  {
    id: 'bailleur_bad', label: 'Rapport Bailleur — BAD', description: 'Format PAD-ESSS Banque Africaine de Développement — UA',
    icon: <Globe size={16} />, color: '#F59E0B', formats: ['PDF', 'Word'], pages: 18,
    bailleur: 'BAD',
  },
  {
    id: 'evm', label: 'Rapport EVM', description: 'Earned Value Management — SPI, CPI, EAC, VAC par projet et consolidé',
    icon: <TrendingUp size={16} />, color: '#7C3AED', formats: ['PDF', 'Excel'], pages: 15,
  },
  {
    id: 'sig', label: 'Rapport SIG Patrimonial', description: 'Cartographie réseau — MES, localités, patrimoine, saisies terrain',
    icon: <FileText size={16} />, color: '#0891B2', formats: ['PDF', 'Excel'], pages: 20,
  },
  {
    id: 'risques', label: 'Rapport Risques', description: 'Matrice des risques, plans de mitigation, incidents ouverts, alertes',
    icon: <AlertTriangle size={16} />, color: 'var(--red)', formats: ['PDF', 'Word'], pages: 10,
  },
  {
    id: 'uagl', label: 'Rapport UAGL', description: 'Unité Accès & Gestion des Localités — électrification, indicateurs accès',
    icon: <Users size={16} />, color: '#F97316', formats: ['PDF', 'Excel'], pages: 16,
  },
];

const RAPPORTS_RECENTS: RapportRecent[] = [
  { id: 'R001', nom: 'Synthèse Portefeuille DPE — Avril 2026', type: 'Trimestriel DPE', periode: 'Avril 2026', generePar: 'Maodo Sène', date: '30/04/2026 08:15', taille: '2.4 Mo', format: 'PDF', color: 'var(--navy)' },
  { id: 'R002', nom: 'Rapport Financier BM — IFR Q1 2026', type: 'Bailleur BM', periode: 'T1 2026', generePar: 'Aliou Dieng', date: '30/04/2026 09:00', taille: '3.1 Mo', format: 'Word', color: '#2563EB' },
  { id: 'R003', nom: 'Avancement Travaux — S20 2026', type: 'Mensuel CP', periode: 'Semaine 20', generePar: 'Aïssatou Ndiaye', date: '17/05/2026 07:00', taille: '4.7 Mo', format: 'PDF', color: 'var(--orange)' },
  { id: 'R004', nom: 'EVM Consolidé Mai 2026', type: 'Rapport EVM', periode: 'Mai 2026', generePar: 'Maodo Sène', date: '16/05/2026 10:30', taille: '1.2 Mo', format: 'Excel', color: '#7C3AED' },
  { id: 'R005', nom: 'Rapport SIG — Localités MES Mai', type: 'SIG Patrimonial', periode: 'Mai 2026', generePar: 'Fatou Diaw', date: '15/05/2026 14:00', taille: '8.3 Mo', format: 'PDF', color: '#0891B2' },
  { id: 'R006', nom: 'Risques Portefeuille — S19 2026', type: 'Rapport Risques', periode: 'Semaine 19', generePar: 'Maodo Sène', date: '10/05/2026 08:45', taille: '0.9 Mo', format: 'PDF', color: 'var(--red)' },
  { id: 'R007', nom: 'Rapport Bailleur AFD — PADERAU Mai', type: 'Bailleur AFD', periode: 'Mai 2026', generePar: 'Moussa Sarr', date: '05/05/2026 11:00', taille: '2.8 Mo', format: 'Word', color: '#16A34A' },
  { id: 'R008', nom: 'Rapport Mensuel CP — DER Avril', type: 'Mensuel CP', periode: 'Avril 2026', generePar: 'Ibrahima Sow', date: '01/05/2026 07:30', taille: '1.8 Mo', format: 'PDF', color: 'var(--orange)' },
];

const RAPPORTS_PLANIFIES: RapportPlanifie[] = [
  { id: 'P001', label: 'Rapport Mensuel Portefeuille', frequence: 'Le 1er de chaque mois à 07h00', prochaine: '01/06/2026 07:00', destinataires: ['dg@senelec.sn', 'dpe@senelec.sn'], actif: true, color: 'var(--navy)' },
  { id: 'P002', label: 'Avancement Travaux Hebdo', frequence: 'Chaque lundi à 07h00', prochaine: '27/05/2026 07:00', destinataires: ['dep@senelec.sn', 'der@senelec.sn'], actif: true, color: 'var(--orange)' },
  { id: 'P003', label: 'EVM Mensuel Consolidé', frequence: 'Le 1er de chaque mois à 09h00', prochaine: '01/06/2026 09:00', destinataires: ['dg@senelec.sn', 'daf@senelec.sn'], actif: true, color: '#7C3AED' },
  { id: 'P004', label: 'Rapport Risques Hebdomadaire', frequence: 'Chaque vendredi à 17h00', prochaine: '24/05/2026 17:00', destinataires: ['comite-risques@senelec.sn'], actif: false, color: 'var(--red)' },
];

const EXPORTS_TB = [
  { label: 'Portefeuille PDF', icon: <BarChart2 size={12} />, color: 'var(--navy)' },
  { label: 'EVM Excel', icon: <TrendingUp size={12} />, color: '#7C3AED' },
  { label: 'Budget Excel', icon: <FileText size={12} />, color: 'var(--green)' },
  { label: 'Risques PDF', icon: <AlertTriangle size={12} />, color: 'var(--red)' },
  { label: 'Terrain Excel', icon: <Users size={12} />, color: 'var(--orange)' },
];

/* ═══════════════════════════════════════════════════════════════════
   COMPOSANT PRINCIPAL
═══════════════════════════════════════════════════════════════════ */
export default function Reporting() {
  const store = useProjectStore();
  const [tab, setTab] = useState<'generateur' | 'recents' | 'planifies' | 'bailleurs'>('generateur');
  const [selectedType, setSelectedType] = useState<TypeRapport>('mensuel_cp');
  const [selectedPeriode, setSelectedPeriode] = useState('Mai 2026');
  const [selectedDir, setSelectedDir] = useState('Tous');
  const [selectedProjet, setSelectedProjet] = useState('Tous');
  const [selectedLangue, setSelectedLangue] = useState<Langue>('FR');
  const [selectedFormat, setSelectedFormat] = useState<Format>('PDF');
  const [generating, setGenerating] = useState(false);
  const [generated, setGenerated] = useState(false);
  const [genProgress, setGenProgress] = useState(0);
  const [activeToggle, setActiveToggle] = useState<Record<string, boolean>>({});

  const typeInfo = TYPES_RAPPORT.find(t => t.id === selectedType)!;

  function handleGenerate() {
    setGenerating(true);
    setGenerated(false);
    setGenProgress(0);
    const interval = setInterval(() => {
      setGenProgress(p => {
        if (p >= 100) { clearInterval(interval); setGenerating(false); setGenerated(true); return 100; }
        return p + 20;
      });
    }, 500);
  }

  function handleDownloadPDF() {
    const typeInfo = TYPES_RAPPORT.find((t: RapportType) => t.id === selectedType)!;
    const printWindow = window.open('', '_blank');
    if (!printWindow) { alert('Veuillez autoriser les popups pour télécharger le rapport.'); return; }

    const projets = store.projets;
    const totalBudget = projets.reduce((s, p) => s + p.budget, 0);
    const totalEngage = projets.reduce((s, p) => s + p.budgetEngage, 0);
    const totalDecaisse = projets.reduce((s, p) => s + p.budgetDecaisse, 0);
    const avgAvancement = projets.length > 0 ? Math.round(projets.reduce((s, p) => s + p.avancement, 0) / projets.length) : 0;
    const avgCpi = projets.length > 0 ? (projets.reduce((s, p) => s + p.cpi, 0) / projets.length).toFixed(2) : '1.00';
    const avgSpi = projets.length > 0 ? (projets.reduce((s, p) => s + p.spi, 0) / projets.length).toFixed(2) : '1.00';
    const enRetard = projets.filter(p => p.statut === 'en_retard').length;
    const critiques = projets.filter(p => p.cpi < 0.85 || p.spi < 0.8).length;
    const tauxDecaiss = totalBudget > 0 ? ((totalDecaisse / totalBudget) * 100).toFixed(1) : '0';
    const tauxEngage = totalBudget > 0 ? ((totalEngage / totalBudget) * 100).toFixed(1) : '0';

    const statutLabels: Record<string, string> = { en_cours:'En cours', planifie:'Planifié', termine:'Terminé', en_retard:'En retard', suspendu:'Suspendu', archive:'Archivé' };

    const rowsHtml = projets.map(p => `
      <tr>
        <td style="font-weight:700;color:#0E3460">${p.code}</td>
        <td>${p.nom.substring(0,40)}</td>
        <td style="font-size:10px">${DOMAINE_CFG[p.domaine].label}</td>
        <td style="text-align:center;font-weight:700;color:${p.avancement>=p.avancementPlanifie?'#16A34A':'#F59E0B'}">${p.avancement}%</td>
        <td style="text-align:right">${p.budget.toLocaleString('fr-FR')}</td>
        <td style="text-align:right;color:${p.budgetDecaisse/p.budget>0.5?'#16A34A':'#F59E0B'}">${p.budgetDecaisse.toLocaleString('fr-FR')}</td>
        <td style="text-align:center;font-weight:700;color:${p.cpi>=0.9?'#16A34A':p.cpi>=0.8?'#F59E0B':'#EF4444'}">${p.cpi.toFixed(2)}</td>
        <td style="text-align:center;color:${p.spi>=0.85?'#16A34A':'#F59E0B'}">${p.spi.toFixed(2)}</td>
        <td><span style="padding:2px 8px;border-radius:4px;font-size:9px;font-weight:700;background:${p.statut==='en_retard'?'#FEE2E2':p.statut==='termine'?'#DCFCE7':'#EFF6FF'};color:${p.statut==='en_retard'?'#DC2626':p.statut==='termine'?'#16A34A':'#1D4ED8'}">${statutLabels[p.statut]??p.statut}</span></td>
      </tr>`).join('');

    // Analyse analytique spécifique par type de rapport
    const analyses: Record<string, { titre: string; sections: Array<{ h: string; p: string }> }> = {
      mensuel_cp: {
        titre: 'Rapport Mensuel Chef de Projet',
        sections: [
          { h: '1. Synthèse d\'avancement', p: `Le portefeuille DPE enregistre un avancement moyen pondéré de ${avgAvancement}% au ${selectedPeriode}, contre un planifié de ${avgAvancement + 3}%. ${enRetard} projet(s) présente(nt) un retard significatif nécessitant une attention immédiate. Les tâches critiques ont été identifiées et font l'objet d'un suivi rapproché par les chefs de projet. La tendance de progression mensuelle est de +2.8 points, conforme au planning de référence (baseline v2.1).` },
          { h: '2. Performance budgétaire', p: `Le budget total du portefeuille s'élève à ${totalBudget.toLocaleString('fr-FR')} MFCFA. Le taux d'engagement atteint ${tauxEngage}% et le taux de décaissement ${tauxDecaiss}%. L'analyse des écarts budgétaires révèle que ${critiques} projet(s) présente(nt) un CPI inférieur à 0,85, signalant un risque de dépassement budgétaire. Un CPI moyen de ${avgCpi} indique une performance coûts globalement satisfaisante.` },
          { h: '3. Jalons et livrables', p: `Sur la période, 3 jalons majeurs ont été atteints conformément au chronogramme. 2 jalons présentent un décalage de 5 à 10 jours dû à des contraintes d'approvisionnement en matériaux (poteaux béton). Les équipes terrain ont soumis ${projets.length * 3} relevés GPS validés. La coordination avec les bureaux d'études est maintenue à un rythme hebdomadaire.` },
          { h: '4. Risques identifiés', p: `Le registre des risques recense 5 risques actifs dont 2 à criticité élevée (P×I ≥ 12). Le risque principal concerne les délais de livraison des matériaux électriques en provenance d'Asie (+4 semaines de délai). Une commande d'urgence auprès d'un fournisseur alternatif a été initiée. Le risque financier lié aux variations de taux de change est couvert par les clauses contractuelles de révision de prix.` },
        ]
      },
      trimestriel_dpe: {
        titre: 'Rapport Trimestriel Direction Principale Équipement',
        sections: [
          { h: '1. Bilan stratégique du portefeuille', p: `Au terme du ${selectedPeriode}, le portefeuille DPE compte ${projets.length} projets actifs répartis sur ${new Set(projets.map(p=>p.region)).size} régions du Sénégal. L'enveloppe budgétaire totale s'élève à ${(totalBudget/1000).toFixed(1)} milliards FCFA, représentant un programme d'investissement structurant pour l'accès universel à l'électricité. L'avancement physique moyen pondéré de ${avgAvancement}% est conforme aux objectifs du Plan National de Développement Énergétique (PNDE 2022-2030).` },
          { h: '2. Performance EVM — Indicateurs de valeur acquise', p: `L'analyse Earned Value Management révèle un CPI moyen de ${avgCpi} et un SPI de ${avgSpi} pour l'ensemble du portefeuille. Un CPI > 1,00 traduit une performance coûts favorable sur les projets en phase d'exécution avancée. Le SPI de ${avgSpi} indique ${parseFloat(avgSpi)>=0.95?'une performance planning satisfaisante, les équipes terrain maintenant le rythme prévu':'un léger retard de planning nécessitant un rattrapage d\'ici la fin du trimestre'}. L'EAC (Estimate At Completion) consolidé est estimé à ${((totalBudget / parseFloat(avgCpi)) / 1000).toFixed(1)} Mds FCFA.` },
          { h: '3. Développement social et accès à l\'énergie', p: `Les projets d'électrification rurale ont permis le raccordement de 12 400 nouveaux ménages sur la période, contribuant directement aux objectifs SDG7. Les zones d'intervention prioritaires (Casamance, Kédougou, Sédhiou) ont bénéficié de 68% des investissements. Le taux d'électrification national progresse de 0.8 point de pourcentage, portant l'indicateur à 72.3%. Ces réalisations s'inscrivent dans le cadre des engagements SENELEC envers les bailleurs internationaux.` },
          { h: '4. Perspectives et orientations T3 2026', p: `Le prochain trimestre sera marqué par la mise en service de 3 projets majeurs (Casamance Phase 2, HTA Kaolack, Solaire Hybride Touba) représentant 2 800 localités nouvellement électrifiées. Les arbitrages budgétaires nécessaires pour couvrir les surcoûts identifiés (estimés à +4.2%) seront soumis à la Direction Générale pour validation. Le renforcement des équipes de supervision terrain est recommandé pour maintenir les délais de recette technique.` },
        ]
      },
      bailleur_bm: {
        titre: 'Intermediate Financial Report — Banque Mondiale',
        sections: [
          { h: 'Executive Summary', p: `This Intermediate Financial Report covers the period ending ${selectedPeriode} for the PADAES Phase II project financed by the World Bank (Credit No. SENELEC-BM-2024-001, USD 22 million). The project demonstrates satisfactory progress with a Disbursement Rate of ${tauxDecaiss}% against the planned target of 45% at this stage. Overall Project Implementation Progress is rated Moderately Satisfactory (MS). The achievement of agreed milestones remains on track with minor delays in procurement activities.` },
          { h: '1. Financial Performance', p: `Total project expenditure for the period amounts to ${(totalDecaisse*0.3).toFixed(0)} MFCFA (USD ${((totalDecaisse*0.3)/600).toFixed(2)} million equivalent). Cumulative disbursements reach ${tauxDecaiss}% of total credit allocation. Budget variance is within the acceptable ±10% threshold defined in the Financing Agreement. Procurement of major contracts (civil works, equipment supply) is 78% complete with no significant delays in payment processing.` },
          { h: '2. Fiduciary Compliance', p: `Financial management capacity remains Satisfactory. All transactions have been processed through the designated Project Account and are fully documented in the project financial management system (SIGEPP-DPE). Internal audit findings from the last quarter have been addressed. The external auditor's report for FY2025 received an unqualified opinion. All WB procurement thresholds and prior-review requirements have been respected.` },
          { h: '3. Environmental & Social Safeguards', p: `ESMP implementation is rated Satisfactory with no Category A incidents reported. Community consultation processes have been completed in all 24 project localities. Grievance redress mechanisms have received and resolved 12 complaints during the period. Resettlement action plans (RAP) are fully implemented in Ziguinchor and Kaolack sub-projects. Gender mainstreaming activities are on track with 34% women participation in community engagement events.` },
        ]
      },
      bailleur_afd: {
        titre: 'Rapport Technique et Financier — Agence Française de Développement',
        sections: [
          { h: '1. Contexte et avancement du programme', p: `Le Programme d'Appui au Développement de l'Électrification Rurale et de l'Accès à l'Énergie Universelle (PADERAU) financé par l'AFD (Contrat CZZ1234-01F, 80 M EUR) enregistre un taux d'exécution physique de ${avgAvancement}% à la clôture de la période ${selectedPeriode}. Les activités de génie civil (HTA/BT) avancent conformément au chronogramme révisé approuvé en décembre 2025. L'indicateur principal de résultat IRD01 (ménages raccordés) atteint 68% de la cible intermédiaire.` },
          { h: '2. Analyse financière', p: `Les décaissements cumulés s'élèvent à ${(totalDecaisse*0.4).toFixed(0)} MFCFA sur une enveloppe totale de ${totalBudget.toLocaleString('fr-FR')} MFCFA. Le taux de décaissement de ${tauxDecaiss}% est légèrement en deçà du plan de décaissement prévisionnel (cible ${parseFloat(tauxDecaiss)+8}%) en raison des délais d'obtention des ANO (Avis de Non-Objection) sur certains appels d'offres. Des mesures correctives ont été prises pour accélérer le rythme de passation des marchés.` },
          { h: '3. Indicateurs de résultats IRD', p: `IRD01 — Ménages raccordés: 8 240 / cible 12 000 (68%). IRD02 — Longueur réseau HTA construite: 142 km / cible 200 km (71%). IRD03 — Postes de transformation installés: 67 / cible 90 (74%). IRD04 — Taux d'accès à l'électricité zones cibles: +6.2 points / cible +8 points. L'ensemble des indicateurs montre une trajectoire positive permettant d'anticiper l'atteinte des cibles à l'échéance du programme (juin 2027).` },
        ]
      },
      evm: {
        titre: 'Rapport Earned Value Management — Portefeuille DPE',
        sections: [
          { h: '1. Analyse de la valeur acquise', p: `L'analyse EVM du portefeuille DPE au ${selectedPeriode} révèle les indicateurs suivants:\n• BCWS (Budget Cost of Work Scheduled): ${(totalBudget * 0.62).toFixed(0)} MFCFA\n• BCWP (Budget Cost of Work Performed): ${(totalBudget * parseFloat(avgSpi) * 0.62).toFixed(0)} MFCFA\n• ACWP (Actual Cost of Work Performed): ${(totalBudget * parseFloat(avgSpi) * 0.62 / parseFloat(avgCpi)).toFixed(0)} MFCFA\n\nLe Schedule Variance (SV) est de ${((parseFloat(avgSpi)-1)*totalBudget*0.62).toFixed(0)} MFCFA, indiquant ${parseFloat(avgSpi)>=1?'une avance sur le planning':'un retard de planning à combler'}.` },
          { h: '2. Indices de performance CPI / SPI', p: `Le Cost Performance Index moyen du portefeuille est de CPI = ${avgCpi}. ${parseFloat(avgCpi)>=1?'Un CPI supérieur à 1,00 traduit une performance coûts favorable : le travail accompli a coûté moins que prévu au budget.':parseFloat(avgCpi)>=0.9?'Le CPI légèrement inférieur à 1,00 indique une légère sur-consommation budgétaire, dans les limites acceptables du seuil d\'alerte.':'Un CPI inférieur à 0,9 signale un dépassement budgétaire significatif nécessitant un plan de récupération.'} Le SPI = ${avgSpi} reflète ${parseFloat(avgSpi)>=0.95?'une performance planning satisfaisante':'un retard de planning à surveiller'}. ${critiques} projet(s) présentent simultanément CPI < 0,85 et SPI < 0,8, classés en zone de surveillance renforcée.` },
          { h: '3. EAC — Estimation à l\'achèvement', p: `L'Estimate At Completion (EAC) calculé selon la méthode CPI donne: EAC = BAC/CPI = ${totalBudget.toLocaleString('fr-FR')} / ${avgCpi} = ${Math.round(totalBudget / parseFloat(avgCpi)).toLocaleString('fr-FR')} MFCFA. La Variance At Completion (VAC) est estimée à ${(totalBudget - Math.round(totalBudget / parseFloat(avgCpi))).toLocaleString('fr-FR')} MFCFA ${totalBudget - Math.round(totalBudget / parseFloat(avgCpi))>=0?'(économie potentielle)':'(dépassement prévu)'}. L'Estimate To Complete (ETC) est de ${Math.round((totalBudget / parseFloat(avgCpi)) - totalDecaisse).toLocaleString('fr-FR')} MFCFA.` },
          { h: '4. Recommandations', p: `Mesures immédiates recommandées: (1) Renforcer le contrôle des coûts sur les ${critiques} projets en zone rouge CPI/SPI; (2) Réviser les plannings détaillés des projets avec SPI < 0,80 avec extension de délai documentée; (3) Déclencher un audit interne des factures sur les projets à forte variance; (4) Mettre à jour les baselines budgétaires après approbation des avenants en cours; (5) Présenter l'EAC révisé au Comité de Pilotage de juin 2026.` },
        ]
      },
      risques: {
        titre: 'Rapport Registre des Risques — Portefeuille DPE',
        sections: [
          { h: '1. Tableau de bord des risques', p: `Le registre des risques du portefeuille DPE recense à la date du ${selectedPeriode} un total de 5 risques actifs dont 2 classés critiques (P×I ≥ 12). La cartographie des risques met en évidence une concentration sur les domaines financier et approvisionnement. Les risques terrain (conditions météo, accès sites) sont atténués par la planification saisonnière des chantiers. Aucun incident majeur de sécurité (QHSE) n'est enregistré ce mois.` },
          { h: '2. Analyse des risques critiques', p: `RISQUE R1 — Retard livraison poteaux béton (P=4, I=4, Criticité=16): Ce risque est actuellement le plus impactant du portefeuille. Le délai de livraison a été revu à +4 semaines par le fournisseur principal. Action corrective: commande d'urgence lancée auprès de Colas SA et Africa Poles Ltd. Impact estimé: glissement de 15 jours sur le chemin critique du projet PRJ-DER-2024-001. RISQUE R2 — Dépassement budget GC (P=3, I=4, Criticité=12): Un avenant de +6.8% est en cours de négociation avec l'entreprise SATEG.` },
          { h: '3. Plans de mitigation', p: `Les plans de mitigation actifs ont permis de réduire de 23% l'exposition globale aux risques ce trimestre. La mise en place d'un stock tampon de matériaux critiques (transformateurs 160 kVA) permet d'absorber des délais de livraison jusqu'à 6 semaines. La clause de pénalités de retard (0,5%/semaine) dans les contrats fournisseurs constitue un mécanisme d'incitation efficace. Le plan de continuité des travaux (rotation des équipes entre sites) minimise l'impact des aléas météorologiques.` },
        ]
      },
      sig: {
        titre: 'Rapport SIG Patrimonial — Cartographie Réseau DPE',
        sections: [
          { h: '1. État du patrimoine électrique', p: `Le système d'information géographique (SIG) du patrimoine SENELEC-DPE recense à la date du ${selectedPeriode}: 847 km de réseau HTA officiels, 2 340 km de réseau BT, 1 204 postes de transformation HTA/BT, et 387 000 compteurs installés. 32 km de réseau HTA déclaré sont en attente de promotion en patrimoine officiel suite aux travaux récents. Le délai moyen de mise à jour cartographique est de 4,2 jours, légèrement au-dessus du SLA contractuel de 3 jours.` },
          { h: '2. Saisies terrain et promotion patrimoine', p: `18 saisies terrain ont été réalisées sur la période, dont 4 sont en attente de validation pour promotion en patrimoine officiel. Les localités concernées représentent 12.4 km de réseau HTA et 9 postes à intégrer dans ArcGIS Enterprise. La conformité des données GPS est vérifiée à 96%, avec une précision de localisation ±2m.` },
          { h: '3. Recommandations patrimoniales', p: `Les équipes UAGL doivent prioriser la promotion des 4 saisies terrain en attente (Niaguis, Boutoupa, Diourbel-N, Kaolack-Sud) avant la clôture du mois. Il est recommandé de lancer un audit de mise à jour cartographique sur les régions de Tambacounda et Matam, dont les données n'ont pas été révisées depuis 8 mois. L'intégration avec ArcGIS Enterprise doit être maintenue à un cycle de synchronisation quotidien.` },
        ]
      },
      uagl: {
        titre: 'Rapport UAGL — Accès & Gestion des Localités',
        sections: [
          { h: '1. Indicateurs d\'accès à l\'électricité', p: `L'Unité Accès & Gestion des Localités (UAGL) rapporte pour la période ${selectedPeriode} un total de 84 localités nouvellement électrifiées, portant le cumul annuel à 312 localités. Le taux d'électrification national atteint 72.3%, en progression de +0.8 point. Les zones à déploiement prioritaire (Casamance, Kédougou, Sédhiou) ont bénéficié de 58% des nouvelles connexions. La cible annuelle de 500 localités électrifiées est atteignable au rythme actuel.` },
          { h: '2. Performance des missions terrain', p: `Les équipes terrain ont réalisé ${Math.round(projets.length * 4.5)} missions de supervision sur la période, couvrant l'ensemble des 14 régions. Le taux de retour des formulaires de saisie est de 94%, en amélioration par rapport aux 87% du mois précédent. La synchronisation offline des données terrain est effective dans 89% des cas. Les Ordres de Mission validés représentent un coût logistique de 12.4 MFCFA pour la période.` },
        ]
      },
    };

    const analyseContent = analyses[selectedType] ?? analyses['mensuel_cp'];

    // ── ANALYSE IA CONTEXTUALISÉE — fondée sur les DONNÉES RÉELLES du périmètre.
    //    (Master Prompt PMO : synthèse exécutive, classification, EVM, projets
    //     critiques nommés, recommandations actionnables.)
    const ctxSections = (() => {
      if (projets.length === 0) return [] as Array<{ h: string; p: string }>;
      const critiquesList = projets.filter(p => p.cpi < 0.9 || p.spi < 0.85 || p.statut === 'en_retard')
        .sort((a, b) => a.cpi - b.cpi).slice(0, 5);
      const topBudget = [...projets].sort((a, b) => b.budget - a.budget).slice(0, 3);
      const suspendus = projets.filter(p => p.statut === 'suspendu');
      const termines = projets.filter(p => p.statut === 'termine').length;
      const parDomaine = Array.from(new Set(projets.map(p => p.domaine)))
        .map(d => ({ d, n: projets.filter(p => p.domaine === d).length, b: projets.filter(p => p.domaine === d).reduce((s, p) => s + p.budget, 0) }))
        .sort((a, b) => b.b - a.b);
      const eac = parseFloat(avgCpi) > 0 ? Math.round(totalBudget / parseFloat(avgCpi)) : totalBudget;
      const vac = totalBudget - eac;
      const nf = (n: number) => n.toLocaleString('fr-FR');
      return [
        { h: '0.1 Synthèse exécutive (analyse IA)', p:
          `Au ${selectedPeriode}, le périmètre analysé compte <strong>${projets.length} projet(s)</strong> (${termines} terminé(s), ${enRetard} en retard, ${suspendus.length} suspendu(s)) pour une enveloppe de <strong>${nf(totalBudget)} MFCFA</strong>, décaissée à <strong>${tauxDecaiss}%</strong>. `
          + `L'avancement physique moyen pondéré atteint <strong>${avgAvancement}%</strong>. Répartition par domaine : `
          + parDomaine.map(x => `${DOMAINE_CFG[x.d].label} (${x.n} projets, ${nf(x.b)} MFCFA)`).join(' · ') + '. '
          + (critiquesList.length ? `<strong>${critiquesList.length} projet(s) appellent une attention immédiate</strong> (CPI/SPI sous seuil ou retard).` : `Aucun projet en situation critique sur le périmètre.`) },
        { h: '0.2 Performance EVM consolidée', p:
          `CPI moyen <strong>${avgCpi}</strong>, SPI moyen <strong>${avgSpi}</strong>. Estimation à l'achèvement (EAC) ≈ <strong>${nf(eac)} MFCFA</strong>, soit un écart à terminaison (VAC) de <strong>${nf(vac)} MFCFA</strong> ${vac >= 0 ? '(favorable)' : '(défavorable — surcoût projeté)'}. `
          + `Taux d'engagement ${tauxEngage}%, taux de décaissement ${tauxDecaiss}%. `
          + (parseFloat(avgSpi) >= 0.95 ? 'Le rythme d\'exécution est globalement conforme à la planification de référence.' : 'Un retard de planning est constaté ; un rattrapage ciblé est requis sur les projets sous SPI 0,85.') },
        { h: '0.3 Projets prioritaires & critiques (données réelles)', p:
          (critiquesList.length
            ? '<strong>À surveiller :</strong> ' + critiquesList.map(p => `${p.code || p.nom.slice(0, 28)} (${p.nom.slice(0, 34)} — CPI ${p.cpi.toFixed(2)} / SPI ${p.spi.toFixed(2)}, ${p.avancement}%)`).join(' ; ') + '. '
            : 'Aucun projet critique. ')
          + '<br/><strong>Plus forts budgets :</strong> ' + topBudget.map(p => `${p.code || p.nom.slice(0, 24)} (${nf(p.budget)} MFCFA, ${p.avancement}%)`).join(' ; ') + '.'
          + (suspendus.length ? `<br/><strong>Suspendus :</strong> ${suspendus.map(p => p.code || p.nom.slice(0, 24)).join(', ')} — relance contractuelle à instruire.` : '') },
        { h: '0.4 Recommandations PMO (actionnables)', p:
          '(1) ' + (critiquesList.length ? `Plan de redressement coûts/délais sur ${critiquesList.length} projet(s) en zone rouge (revue hebdomadaire dédiée). ` : 'Maintenir le pilotage standard. ')
          + `(2) ${vac < 0 ? `Provisionner le surcoût projeté de ${nf(Math.abs(vac))} MFCFA et soumettre l'EAC révisé au Comité de Pilotage. ` : 'Sécuriser la marge favorable et l\'allouer aux aléas. '}`
          + `(3) ${suspendus.length ? `Instruire la reprise/résiliation des ${suspendus.length} projet(s) suspendu(s). ` : 'Mettre à jour les baselines après avenants. '}`
          + '(4) Consolider les attachements (BOQ quantités réalisées) validés par les chefs de projet pour fiabiliser le décaissement. '
          + '(5) Vérifier la complétude documentaire (GED) avant chaque jalon de paiement.' },
      ];
    })();
    const allSections = [...ctxSections, ...analyseContent.sections];

    const analyseHtml = allSections.map(s => `
      <div class="section-box">
        <div class="section-title">${s.h}</div>
        <div class="section-body">${s.p}</div>
      </div>`).join('');

    printWindow.document.write(`<!DOCTYPE html><html lang="${selectedLangue === 'FR' ? 'fr' : 'en'}"><head>
      <meta charset="UTF-8">
      <title>${analyseContent.titre} — ${selectedPeriode}</title>
      <style>
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap');
        * { box-sizing: border-box; }
        body { font-family: 'Inter', Arial, sans-serif; margin: 0; padding: 0; color: #1E293B; font-size: 11px; line-height: 1.6; background: #fff; }
        .page { padding: 40px 48px 32px; page-break-after: always; min-height: 100vh; position: relative; }
        .header-bar { height: 5px; background: ${typeInfo.color}; border-radius: 3px; margin-bottom: 28px; }
        .logo-line { font-size: 8px; font-weight: 700; letter-spacing: 0.18em; color: #94A3B8; text-transform: uppercase; margin-bottom: 16px; display: flex; align-items: center; gap: 8px; }
        .logo-line::before { content: ''; display: inline-block; width: 20px; height: 20px; background: ${typeInfo.color}; border-radius: 4px; opacity: 0.15; }
        h1 { font-size: 22px; font-weight: 800; color: #0F172A; margin: 0 0 6px; line-height: 1.25; letter-spacing: -0.01em; }
        h2 { font-size: 13px; font-weight: 700; color: #0F172A; margin: 24px 0 10px; border-bottom: 1.5px solid #E2E8F0; padding-bottom: 6px; text-transform: uppercase; letter-spacing: 0.04em; }
        .meta { font-size: 9px; color: #64748B; margin-bottom: 20px; display: flex; flex-wrap: wrap; gap: 12px; }
        .meta strong { color: #334155; font-weight: 600; }
        .kpi-grid { display: grid; grid-template-columns: repeat(4,1fr); gap: 12px; margin: 16px 0 24px; }
        .kpi { background: #F8FAFC; border-radius: 10px; padding: 14px 16px; border-left: 4px solid ${typeInfo.color}; box-shadow: 0 1px 2px rgba(0,0,0,0.04); }
        .kpi-val { font-size: 20px; font-weight: 800; color: #0F172A; letter-spacing: -0.02em; }
        .kpi-lbl { font-size: 8px; color: #64748B; margin-top: 4px; font-weight: 500; text-transform: uppercase; letter-spacing: 0.06em; }
        table { width: 100%; border-collapse: separate; border-spacing: 0; margin: 14px 0 20px; font-size: 9px; border-radius: 8px; overflow: hidden; box-shadow: 0 1px 3px rgba(0,0,0,0.06); }
        th { background: #0F172A; color: #fff; padding: 8px 10px; text-align: left; font-size: 8px; text-transform: uppercase; letter-spacing: 0.06em; font-weight: 600; }
        th:first-child { border-radius: 8px 0 0 0; }
        th:last-child { border-radius: 0 8px 0 0; }
        td { border-bottom: 1px solid #F1F5F9; padding: 7px 10px; vertical-align: middle; }
        tr:last-child td { border-bottom: none; }
        tr:last-child td:first-child { border-radius: 0 0 0 8px; }
        tr:last-child td:last-child { border-radius: 0 0 8px 0; }
        tr:nth-child(even) td { background: #F8FAFC; }
        tr:hover td { background: #F1F5F9; }
        tfoot tr td { background: #EFF6FF !important; font-weight: 700; border-top: 2px solid #BFDBFE; }
        .footer { margin-top: 32px; padding-top: 12px; border-top: 1px solid #E2E8F0; font-size: 8px; color: #94A3B8; display: flex; justify-content: space-between; align-items: center; }
        .alert { padding: 10px 14px; border-radius: 8px; margin: 10px 0; font-size: 10px; font-weight: 500; display: flex; align-items: center; gap: 8px; }
        .alert-warn { background: #FFFBEB; border: 1px solid #FDE68A; color: #92400E; }
        .alert-ok { background: #F0FDF4; border: 1px solid #BBF7D0; color: #166534; }
        .section-box { margin: 0 0 20px; page-break-inside: avoid; }
        .section-title { font-size: 11px; font-weight: 700; color: #0F172A; margin: 0 0 8px; border-left: 3px solid ${typeInfo.color}; padding-left: 10px; }
        .section-body { font-size: 10px; line-height: 1.8; color: #374151; margin: 0; padding: 12px 16px; background: #FAFBFC; border-radius: 8px; border: 1px solid #F1F5F9; white-space: pre-line; }
        @media print { body { -webkit-print-color-adjust: exact; print-color-adjust: exact; } .page { page-break-after: auto; } }
      </style>
    </head><body>
      <div class="page">
        <div class="header-bar"></div>
        <div style="margin-bottom:14px"><img src="${SENELEC_LOGO_DATA_URI}" alt="SENELEC" style="height:46px;width:auto;display:block" /></div>
        <div class="logo-line">SENELEC · SIGEPP-DPE · Direction Principale Équipement</div>
        <h1>${analyseContent.titre}</h1>
        <div class="meta">
          <span>Période : <strong>${selectedPeriode}</strong></span>
          <span>Langue : <strong>${selectedLangue === 'FR' ? 'Français' : 'English'}</strong></span>
          <span>Généré le : <strong>${new Date().toLocaleDateString('fr-FR', { day: '2-digit', month: 'long', year: 'numeric' })}</strong></span>
          <span><strong>${projets.length}</strong> projets</span>
          <span>Direction : <strong>${selectedDir}</strong></span>
        </div>
        ${parseFloat(avgCpi) < 0.9 ? `<div class="alert alert-warn">⚠️ Alerte performance : CPI moyen = ${avgCpi} — ${critiques} projet(s) en dépassement budgétaire critique</div>` : `<div class="alert alert-ok">✅ Performance satisfaisante — CPI moyen ${avgCpi} | SPI ${avgSpi}</div>`}
        <div class="kpi-grid">
          <div class="kpi"><div class="kpi-val">${projets.length}</div><div class="kpi-lbl">Projets portefeuille</div></div>
          <div class="kpi"><div class="kpi-val">${avgAvancement}%</div><div class="kpi-lbl">Avancement moyen pondéré</div></div>
          <div class="kpi"><div class="kpi-val">${tauxDecaiss}%</div><div class="kpi-lbl">Taux décaissement</div></div>
          <div class="kpi"><div class="kpi-val">${avgCpi} / ${avgSpi}</div><div class="kpi-lbl">CPI / SPI portefeuille</div></div>
        </div>
        <h2>Graphiques de performance</h2>
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:20px;margin:16px 0 24px">
          <!-- Barres horizontales avancement -->
          <div style="background:#F8FAFC;border-radius:10px;padding:14px 16px;border:1px solid #E2E8F0">
            <div style="font-size:10px;font-weight:700;color:#64748B;margin-bottom:10px;text-transform:uppercase;letter-spacing:0.06em">Avancement par projet (%)</div>
            <svg width="100%" height="${Math.max(180, projets.length * 22)}" viewBox="0 0 400 ${projets.length * 22}" style="display:block">
              ${projets.map((p, i) => {
                const y = i * 22 + 4;
                const w = (p.avancement / 100) * 280;
                const planW = (p.avancementPlanifie / 100) * 280;
                return `<rect x="100" y="${y}" width="${planW}" height="6" fill="#E2E8F0" rx="3"/>
                        <rect x="100" y="${y}" width="${w}" height="6" fill="${p.avancement >= p.avancementPlanifie ? '#16A34A' : '#F59E0B'}" rx="3"/>
                        <text x="95" y="${y + 5}" font-size="8" fill="#64748B" text-anchor="end">${p.code}</text>
                        <text x="${100 + w + 4}" y="${y + 5}" font-size="8" fill="${p.avancement >= p.avancementPlanifie ? '#16A34A' : '#F59E0B'}" font-weight="700">${p.avancement}%</text>`;
              }).join('')}
              <text x="100" y="${projets.length * 22 - 2}" font-size="7" fill="#94A3B8">0</text>
              <text x="380" y="${projets.length * 22 - 2}" font-size="7" fill="#94A3B8" text-anchor="end">100%</text>
            </svg>
          </div>
          <!-- Donut répartition budget domaine -->
          <div style="background:#F8FAFC;border-radius:10px;padding:14px 16px;border:1px solid #E2E8F0">
            <div style="font-size:10px;font-weight:700;color:#64748B;margin-bottom:10px;text-transform:uppercase;letter-spacing:0.06em">Répartition budget par domaine</div>
            <svg width="100%" height="180" viewBox="0 0 200 180" style="display:block;margin:0 auto">
              ${(() => {
                const domainTotals: Record<string, number> = {};
                projets.forEach(p => { domainTotals[p.domaine] = (domainTotals[p.domaine] || 0) + p.budget; });
                const total = Object.values(domainTotals).reduce((a, b) => a + b, 0);
                const colors: Record<string, string> = { production: '#1B4F8A', transport: '#F47920', distribution: '#16A34A', commercial: '#7C3AED', genie_civil: '#B45309' };
                let angle = 0;
                const cx = 100, cy = 80, r = 60, r2 = 38;
                const slices = Object.entries(domainTotals).map(([d, v]) => {
                  const pct = v / total;
                  const a = pct * 360;
                  const start = angle * Math.PI / 180;
                  const end = (angle + a) * Math.PI / 180;
                  const large = a > 180 ? 1 : 0;
                  const x1 = cx + r * Math.cos(start), y1 = cy + r * Math.sin(start);
                  const x2 = cx + r * Math.cos(end), y2 = cy + r * Math.sin(end);
                  const x3 = cx + r2 * Math.cos(end), y3 = cy + r2 * Math.sin(end);
                  const x4 = cx + r2 * Math.cos(start), y4 = cy + r2 * Math.sin(start);
                  const path = `M ${x1} ${y1} A ${r} ${r} 0 ${large} 1 ${x2} ${y2} L ${x3} ${y3} A ${r2} ${r2} 0 ${large} 0 ${x4} ${y4} Z`;
                  const labelAngle = (angle + a / 2) * Math.PI / 180;
                  const lx = cx + (r + 14) * Math.cos(labelAngle);
                  const ly = cy + (r + 14) * Math.sin(labelAngle);
                  angle += a;
                  return `<path d="${path}" fill="${colors[d] || '#94A3B8'}" stroke="#fff" stroke-width="2"/>
                          <text x="${lx}" y="${ly}" font-size="7" fill="#374151" text-anchor="middle" font-weight="600">${(pct * 100).toFixed(0)}%</text>`;
                }).join('');
                const legend = Object.entries(domainTotals).map(([d, v], i) => {
                  const y = 155 + i * 12;
                  return `<rect x="10" y="${y - 6}" width="8" height="8" fill="${colors[d] || '#94A3B8'}" rx="2"/>
                          <text x="22" y="${y}" font-size="7" fill="#64748B">${(DOMAINE_CFG as any)[d].label} — ${((v / total) * 100).toFixed(1)}%</text>`;
                }).join('');
                return slices + legend;
              })()}
            </svg>
          </div>
        </div>
        <!-- Barres CPI/SPI -->
        <div style="background:#F8FAFC;border-radius:10px;padding:14px 16px;border:1px solid #E2E8F0;margin-bottom:20px">
          <div style="font-size:10px;font-weight:700;color:#64748B;margin-bottom:10px;text-transform:uppercase;letter-spacing:0.06em">Indices de performance CPI / SPI par projet</div>
          <svg width="100%" height="${Math.max(160, projets.length * 18)}" viewBox="0 0 500 ${projets.length * 18}" style="display:block">
            ${projets.map((p, i) => {
              const y = i * 18 + 4;
              const cpiW = Math.min((p.cpi / 1.5) * 160, 160);
              const spiW = Math.min((p.spi / 1.5) * 160, 160);
              return `<text x="95" y="${y + 6}" font-size="8" fill="#64748B" text-anchor="end">${p.code}</text>
                      <rect x="105" y="${y}" width="${cpiW}" height="5" fill="${p.cpi >= 1 ? '#16A34A' : p.cpi >= 0.9 ? '#F59E0B' : '#EF4444'}" rx="2"/>
                      <text x="${105 + cpiW + 3}" y="${y + 5}" font-size="7" fill="#64748B">${p.cpi.toFixed(2)}</text>
                      <rect x="280" y="${y}" width="${spiW}" height="5" fill="${p.spi >= 1 ? '#16A34A' : p.spi >= 0.85 ? '#F59E0B' : '#EF4444'}" rx="2"/>
                      <text x="${280 + spiW + 3}" y="${y + 5}" font-size="7" fill="#64748B">${p.spi.toFixed(2)}</text>`;
            }).join('')}
            <text x="105" y="${projets.length * 18 - 2}" font-size="7" fill="#94A3B8" font-weight="700">CPI</text>
            <text x="280" y="${projets.length * 18 - 2}" font-size="7" fill="#94A3B8" font-weight="700">SPI</text>
          </svg>
        </div>
        <h2>Analyse détaillée</h2>
        ${analyseHtml}
        <h2>Tableau de synthèse des projets</h2>
        <table>
          <thead><tr><th>Code</th><th>Projet</th><th>Domaine</th><th style="text-align:center">Av.%</th><th style="text-align:right">Budget (MFCFA)</th><th style="text-align:right">Décaissé (MFCFA)</th><th style="text-align:center">CPI</th><th style="text-align:center">SPI</th><th>Statut</th></tr></thead>
          <tbody>${rowsHtml}</tbody>
          <tfoot><tr>
            <td colspan="4" style="border-radius:0 0 0 8px">TOTAL PORTEFEUILLE (${projets.length} projets)</td>
            <td style="text-align:right">${totalBudget.toLocaleString('fr-FR')}</td>
            <td style="text-align:right">${totalDecaisse.toLocaleString('fr-FR')}</td>
            <td style="text-align:center">${avgCpi}</td>
            <td style="text-align:center">${avgSpi}</td>
            <td style="border-radius:0 0 8px 0">—</td>
          </tr></tfoot>
        </table>
        <div class="footer">
          <span>CONFIDENTIEL — Usage interne SENELEC · SIGEPP-DPE uniquement</span>
          <span>Document généré par SIGEPP-DPE · ${new Date().toLocaleDateString('fr-FR')} · Page 1/${typeInfo.pages}</span>
        </div>
      </div>
    </body></html>`);
    printWindow.document.close();
    printWindow.focus();
    setTimeout(() => { printWindow.print(); }, 700);
  }

  function togglePlanifie(id: string) {
    setActiveToggle(prev => ({ ...prev, [id]: !(prev[id] ?? RAPPORTS_PLANIFIES.find(p => p.id === id)?.actif) }));
  }

  function isActif(p: RapportPlanifie) {
    return activeToggle[p.id] !== undefined ? activeToggle[p.id] : p.actif;
  }

  return (
    <div className="page-content">
      {/* ── KPIs ─────────────────────────────────────────────────────── */}
      <div className="kpi-grid">
        <div className="kpi-card navy">
          <div className="kpi-label">Projets dans le portefeuille</div>
          <div className="kpi-value">{store.projets.length}</div>
          <div className="kpi-sub">données réelles SIGEPP-DPE</div>
        </div>
        <div className="kpi-card amber">
          <div className="kpi-label">Avancement moyen</div>
          <div className="kpi-value amber">
            {store.projets.length > 0
              ? Math.round(store.projets.reduce((s, p) => s + p.avancement, 0) / store.projets.length)
              : 0}%
          </div>
          <div className="kpi-sub">portefeuille pondéré</div>
        </div>
        <div className="kpi-card green">
          <div className="kpi-label">Budget total</div>
          <div className="kpi-value green" style={{ fontSize: 18 }}>
            {(store.projets.reduce((s, p) => s + p.budget, 0) / 1000).toFixed(1)} Md
          </div>
          <div className="kpi-sub">FCFA — tous projets</div>
        </div>
        <div className="kpi-card">
          <div className="kpi-label">Rapports planifiés</div>
          <div className="kpi-value orange">{RAPPORTS_PLANIFIES.length}</div>
          <div className="kpi-sub">dont {RAPPORTS_PLANIFIES.filter(p => p.actif).length} actifs</div>
        </div>
      </div>

      {/* ── Navigation onglets ───────────────────────────────────────── */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 8 }}>
        <div className="tabs">
          {([
            { key: 'generateur', label: 'Générateur', icon: <Plus size={11} /> },
            { key: 'recents', label: `Rapports récents (${RAPPORTS_RECENTS.length})`, icon: <Clock size={11} /> },
            { key: 'planifies', label: `Planification (${RAPPORTS_PLANIFIES.length})`, icon: <Calendar size={11} /> },
            { key: 'bailleurs', label: 'Formats Bailleurs', icon: <Globe size={11} /> },
          ] as const).map(t => (
            <button key={t.key} className={`tab ${tab === t.key ? 'active' : ''}`} onClick={() => setTab(t.key)}>
              {t.icon} {t.label}
            </button>
          ))}
        </div>
        <div style={{ display: 'flex', gap: 6 }}>
          {EXPORTS_TB.map((e, i) => (
            <button
              key={e.label}
              onClick={() => {
                const types: TypeRapport[] = ['trimestriel_dpe', 'evm', 'mensuel_cp', 'risques', 'uagl'];
                setSelectedType(types[i] ?? 'trimestriel_dpe');
                setTab('generateur');
                setSelectedFormat(i === 1 || i === 4 ? 'Excel' : 'PDF');
              }}
              className="btn btn-ghost btn-sm"
              style={{ color: e.color, borderColor: e.color + '44', fontSize: 10 }}
            >
              {e.icon} {e.label}
            </button>
          ))}
        </div>
      </div>

      {/* ── Tab: Générateur ─────────────────────────────────────────── */}
      {tab === 'generateur' && (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 340px', gap: 14, alignItems: 'start' }}>
          {/* Sélection type */}
          <div className="card">
            <div className="card-header">
              <span className="card-title">Type de Rapport</span>
              <span style={{ fontSize: 10, color: 'var(--muted)' }}>{TYPES_RAPPORT.length} modèles disponibles</span>
            </div>
            <div className="card-body" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(250px, 1fr))', gap: 10 }}>
              {TYPES_RAPPORT.map(t => (
                <button
                  key={t.id}
                  onClick={() => { setSelectedType(t.id); setSelectedFormat(t.formats[0]); setGenerated(false); setGenProgress(0); }}
                  style={{
                    textAlign: 'left', padding: '12px 14px', borderRadius: 8, border: `1.5px solid ${selectedType === t.id ? t.color : 'var(--border-2)'}`,
                    background: selectedType === t.id ? t.color + '10' : 'var(--bg)',
                    cursor: 'pointer', transition: 'all 0.14s',
                  }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 6 }}>
                    <span style={{ color: t.color }}>{t.icon}</span>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--navy)' }}>{t.label}</div>
                      {t.bailleur && (
                        <span style={{ fontSize: 9, fontWeight: 700, color: t.color, background: t.color + '18', padding: '1px 5px', borderRadius: 4 }}>
                          {t.bailleur}
                        </span>
                      )}
                    </div>
                    {selectedType === t.id && <CheckCircle size={14} style={{ color: t.color, flexShrink: 0 }} />}
                  </div>
                  <div style={{ fontSize: 10, color: 'var(--muted)', lineHeight: 1.4 }}>{t.description}</div>
                  <div style={{ fontSize: 9, color: 'var(--muted)', marginTop: 5 }}>
                    {t.pages} pages · {t.formats.join(' · ')}
                  </div>
                </button>
              ))}
            </div>
          </div>

          {/* Panneau paramètres + génération */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            <div className="card">
              <div className="card-header">
                <span className="card-title" style={{ color: typeInfo.color }}>{typeInfo.label}</span>
                <span style={{ fontSize: 10, color: 'var(--muted)' }}>{typeInfo.pages} pages</span>
              </div>
              <div className="card-body" style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                <div className="form-group">
                  <label className="form-label">Période</label>
                  <select className="form-input" value={selectedPeriode} onChange={e => setSelectedPeriode(e.target.value)}>
                    {['Mai 2026', 'Avril 2026', 'Mars 2026', 'T1 2026', 'T4 2025', 'Personnalisée'].map(p => <option key={p}>{p}</option>)}
                  </select>
                </div>
                <div className="form-group">
                  <label className="form-label">Direction</label>
                  <select className="form-input" value={selectedDir} onChange={e => setSelectedDir(e.target.value)}>
                    {['Tous','DEP','DER','DIT','DGC','CC26'].map(d => <option key={d}>{d}</option>)}
                  </select>
                </div>
                <div className="form-group">
                  <label className="form-label">Projet (optionnel)</label>
                  <select className="form-input" value={selectedProjet} onChange={e => setSelectedProjet(e.target.value)}>
                    <option>Tous</option>
                    <option>PRJ-DER-2024-001</option>
                    <option>PRJ-DER-2023-005</option>
                    <option>PRJ-DEP-2024-007</option>
                    <option>PRJ-CC26-2024-001</option>
                  </select>
                </div>
                <div className="form-group">
                  <label className="form-label">Langue</label>
                  <div style={{ display: 'flex', gap: 6 }}>
                    {(['FR','EN'] as Langue[]).map(l => (
                      <button key={l} onClick={() => setSelectedLangue(l)} className={`btn btn-sm ${selectedLangue === l ? 'btn-navy' : 'btn-ghost'}`} style={{ flex: 1, justifyContent: 'center' }}>
                        {l === 'FR' ? '🇫🇷 Français' : '🇬🇧 English'}
                      </button>
                    ))}
                  </div>
                </div>
                <div className="form-group">
                  <label className="form-label">Format</label>
                  <div style={{ display: 'flex', gap: 6 }}>
                    {typeInfo.formats.map(f => (
                      <button key={f} onClick={() => setSelectedFormat(f)}
                        className={`btn btn-sm ${selectedFormat === f ? 'btn-primary' : 'btn-ghost'}`}
                        style={{ flex: 1, justifyContent: 'center', fontSize: 10 }}>
                        {f}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Barre de progression */}
                {(generating || generated) && (
                  <div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4, fontSize: 10 }}>
                      <span style={{ color: 'var(--muted)' }}>{generating ? 'Génération en cours...' : '✅ Rapport prêt'}</span>
                      <span style={{ fontWeight: 700, color: genProgress === 100 ? 'var(--green)' : 'var(--orange)' }}>{genProgress}%</span>
                    </div>
                    <div className="progress-bar">
                      <div className="progress-fill" style={{ width: `${genProgress}%`, background: genProgress === 100 ? 'var(--green)' : 'var(--orange)', transition: 'width 0.4s ease' }} />
                    </div>
                  </div>
                )}

                {/* Boutons action */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginTop: 4 }}>
                  {!generated ? (
                    <button
                      onClick={handleGenerate}
                      disabled={generating}
                      className="btn btn-primary"
                      style={{ justifyContent: 'center', opacity: generating ? 0.7 : 1 }}>
                      {generating
                        ? <><RefreshCw size={13} style={{ animation: 'spin 1s linear infinite' }} /> Génération en cours...</>
                        : <><Send size={13} /> Générer rapport</>}
                    </button>
                  ) : (
                    <>
                      <button onClick={handleDownloadPDF} className="btn btn-primary" style={{ justifyContent: 'center' }}>
                        <Download size={13} /> Télécharger {selectedFormat} ({Math.round(typeInfo.pages * 0.2)} Mo)
                      </button>
                      <button onClick={() => { setGenerated(false); setGenProgress(0); }} className="btn btn-ghost btn-sm" style={{ justifyContent: 'center' }}>
                        Nouveau rapport
                      </button>
                    </>
                  )}
                </div>
              </div>
            </div>

            {/* Aperçu page */}
            <div className="card" style={{ overflow: 'hidden' }}>
              <div className="card-header"><span className="card-title">Aperçu page de garde</span></div>
              <div style={{ padding: 12, background: '#F8FAFC' }}>
                <div style={{ background: '#fff', borderRadius: 6, padding: '16px 20px', boxShadow: '0 2px 8px rgba(0,0,0,0.08)', fontSize: 10 }}>
                  <div style={{ borderBottom: `3px solid ${typeInfo.color}`, paddingBottom: 10, marginBottom: 12 }}>
                    <div style={{ fontSize: 8, fontWeight: 700, color: '#888', letterSpacing: '0.1em' }}>SENELEC — DIRECTION PRINCIPALE ÉQUIPEMENT</div>
                    <div style={{ fontSize: 14, fontWeight: 700, color: '#0E3460', marginTop: 4 }}>{typeInfo.label}</div>
                    <div style={{ fontSize: 9, color: '#888', marginTop: 2 }}>Période : {selectedPeriode} · Généré le 24/05/2026 · {selectedLangue === 'FR' ? 'Français' : 'English'}</div>
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6, marginBottom: 10 }}>
                    {[
                      { l: 'Projets actifs', v: '10' },
                      { l: 'Avancement moyen', v: '50%' },
                      { l: 'Budget total', v: '132 Md' },
                      { l: 'Taux décaissement', v: '41%' },
                    ].map(k => (
                      <div key={k.l} style={{ background: '#F4F6F9', borderRadius: 4, padding: '5px 8px', borderLeft: `2px solid ${typeInfo.color}` }}>
                        <div style={{ fontSize: 12, fontWeight: 700, color: '#0E3460' }}>{k.v}</div>
                        <div style={{ fontSize: 7, color: '#888' }}>{k.l}</div>
                      </div>
                    ))}
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', borderTop: '1px solid #eee', paddingTop: 8, fontSize: 7, color: '#888' }}>
                    <span>CONFIDENTIEL — USAGE INTERNE SENELEC</span>
                    <span>Page 1 / {typeInfo.pages}</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── Tab: Rapports récents ────────────────────────────────────── */}
      {tab === 'recents' && (
        <div className="card" style={{ overflow: 'hidden' }}>
          <div style={{ overflowX: 'auto' }}>
            <table className="tbl">
              <thead>
                <tr>
                  <th>Rapport</th>
                  <th>Type</th>
                  <th>Période</th>
                  <th>Généré par</th>
                  <th>Date & Heure</th>
                  <th>Taille</th>
                  <th>Format</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {RAPPORTS_RECENTS.map((r, i) => (
                  <tr key={r.id} style={{ background: i % 2 === 0 ? 'transparent' : 'var(--bg)' }}>
                    <td>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <div style={{ width: 28, height: 28, borderRadius: 6, background: r.color + '18', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                          <FileText size={13} style={{ color: r.color }} />
                        </div>
                        <div>
                          <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--navy)' }}>{r.nom}</div>
                          <div style={{ fontSize: 9, color: 'var(--muted)' }}>{r.id}</div>
                        </div>
                      </div>
                    </td>
                    <td>
                      <span style={{ fontSize: 10, fontWeight: 700, color: r.color, background: r.color + '18', padding: '2px 7px', borderRadius: 4 }}>{r.type}</span>
                    </td>
                    <td style={{ fontSize: 11 }}>{r.periode}</td>
                    <td style={{ fontSize: 11, color: 'var(--muted)' }}>{r.generePar}</td>
                    <td style={{ fontSize: 11, whiteSpace: 'nowrap' }}>{r.date}</td>
                    <td style={{ fontSize: 11, color: 'var(--muted)' }}>{r.taille}</td>
                    <td>
                      <span style={{
                        fontSize: 9, fontWeight: 700, padding: '2px 7px', borderRadius: 5,
                        background: r.format === 'PDF' ? '#FEE2E2' : r.format === 'Excel' ? '#DCFCE7' : '#DBEAFE',
                        color: r.format === 'PDF' ? 'var(--red)' : r.format === 'Excel' ? 'var(--green)' : '#1E40AF',
                      }}>{r.format}</span>
                    </td>
                    <td>
                      <div style={{ display: 'flex', gap: 4 }}>
                        <button className="btn btn-ghost btn-xs" title="Télécharger" onClick={() => {
                          const pw = window.open('', '_blank');
                          if (!pw) return;
                          pw.document.write(`<!DOCTYPE html><html><head><title>${r.nom}</title><style>
                            @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap');
                            *{box-sizing:border-box}body{font-family:'Inter',Arial,sans-serif;padding:40px 48px;color:#1E293B;font-size:11px;line-height:1.6}
                            .bar{height:5px;background:${r.color};border-radius:3px;margin-bottom:24px}
                            .logo{font-size:8px;font-weight:700;letter-spacing:0.18em;color:#94A3B8;text-transform:uppercase;margin-bottom:16px}
                            h1{font-size:20px;font-weight:800;color:#0F172A;margin:0 0 4px;letter-spacing:-0.01em}
                            .meta{font-size:9px;color:#64748B;margin-bottom:20px}
                            table{width:100%;border-collapse:separate;border-spacing:0;margin:16px 0;font-size:9px;border-radius:8px;overflow:hidden;box-shadow:0 1px 3px rgba(0,0,0,0.06)}
                            th{background:#0F172A;color:#fff;padding:8px 12px;text-align:left;font-size:8px;text-transform:uppercase;letter-spacing:0.06em;font-weight:600}
                            th:first-child{border-radius:8px 0 0 0}th:last-child{border-radius:0 8px 0 0}
                            td{border-bottom:1px solid #F1F5F9;padding:8px 12px}
                            tr:nth-child(even) td{background:#F8FAFC}
                            .footer{margin-top:32px;padding-top:12px;border-top:1px solid #E2E8F0;font-size:8px;color:#94A3B8;display:flex;justify-content:space-between}
                            @media print{body{-webkit-print-color-adjust:exact;print-color-adjust:exact}}
                          </style></head><body>
                            <div class="bar"></div>
                            <div style="margin-bottom:14px"><img src="${SENELEC_LOGO_DATA_URI}" alt="SENELEC" style="height:46px;width:auto;display:block" /></div>
                            <div class="logo">SENELEC · SIGEPP-DPE · Direction Principale Équipement</div>
                            <h1>${r.nom}</h1>
                            <div class="meta">Période : <strong>${r.periode}</strong> · Généré par <strong>${r.generePar}</strong> · ${r.date} · Format : ${r.format}</div>
                            <table><thead><tr><th>Code</th><th>Indicateur</th><th>Valeur</th><th>Statut</th></tr></thead>
                            <tbody>
                              <tr><td style="font-weight:700;color:#0F172A">IND-001</td><td>Avancement moyen pondéré</td><td style="font-weight:700">53%</td><td><span style="padding:2px 8px;border-radius:4px;font-size:8px;font-weight:700;background:#F0FDF4;color:#166534">En cours</span></td></tr>
                              <tr><td style="font-weight:700;color:#0F172A">IND-002</td><td>CPI portefeuille</td><td style="font-weight:700">0.94</td><td><span style="padding:2px 8px;border-radius:4px;font-size:8px;font-weight:700;background:#FFFBEB;color:#92400E">Attention</span></td></tr>
                              <tr><td style="font-weight:700;color:#0F172A">IND-003</td><td>Taux décaissement</td><td style="font-weight:700">60.1%</td><td><span style="padding:2px 8px;border-radius:4px;font-size:8px;font-weight:700;background:#F0FDF4;color:#166534">Normal</span></td></tr>
                            </tbody>
                            </table>
                            <div class="footer">
                              <span>CONFIDENTIEL — Usage interne SENELEC · SIGEPP-DPE uniquement</span>
                              <span>Document généré par SIGEPP-DPE · ${new Date().toLocaleDateString('fr-FR')}</span>
                            </div>
                          </body></html>`);
                          pw.document.close(); setTimeout(() => pw.print(), 500);
                        }}><Download size={10} /></button>
                        <button className="btn btn-ghost btn-xs" title="Aperçu" onClick={() => alert(`Aperçu : ${r.nom}\nType : ${r.type}\nPériode : ${r.periode}\nFichier : ${r.taille}`)}><Eye size={10} /></button>
                        <button className="btn btn-ghost btn-xs" title="Envoyer" onClick={() => alert(`Envoi du rapport "${r.nom}" aux destinataires concernés.`)}><Send size={10} /></button>
                        <button className="btn btn-ghost btn-xs" title="Imprimer" onClick={() => window.print()}><Printer size={10} /></button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ── Tab: Planification ──────────────────────────────────────── */}
      {tab === 'planifies' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {RAPPORTS_PLANIFIES.map(p => {
            const actif = isActif(p);
            return (
              <div key={p.id} className="card" style={{ borderLeft: `3px solid ${actif ? p.color : 'var(--border-2)'}`, opacity: actif ? 1 : 0.7 }}>
                <div className="card-body" style={{ display: 'flex', alignItems: 'center', gap: 14, flexWrap: 'wrap' }}>
                  <div style={{ width: 40, height: 40, borderRadius: 10, background: p.color + '18', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                    <Calendar size={18} style={{ color: p.color }} />
                  </div>
                  <div style={{ flex: 1, minWidth: 200 }}>
                    <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--navy)', marginBottom: 3 }}>{p.label}</div>
                    <div style={{ display: 'flex', gap: 16, fontSize: 11, color: 'var(--muted)', flexWrap: 'wrap' }}>
                      <span><Clock size={10} style={{ verticalAlign: 'middle' }} /> {p.frequence}</span>
                      <span><Calendar size={10} style={{ verticalAlign: 'middle' }} /> Prochain : <strong style={{ color: 'var(--navy)' }}>{p.prochaine}</strong></span>
                    </div>
                    <div style={{ display: 'flex', gap: 4, marginTop: 5, flexWrap: 'wrap' }}>
                      {p.destinataires.map(d => (
                        <span key={d} style={{ fontSize: 9, background: 'var(--bg)', border: '1px solid var(--border-2)', borderRadius: 4, padding: '1px 6px', color: 'var(--muted)' }}>{d}</span>
                      ))}
                    </div>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexShrink: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      <div style={{ width: 8, height: 8, borderRadius: '50%', background: actif ? 'var(--green)' : 'var(--muted)' }} />
                      <span style={{ fontSize: 10, fontWeight: 600, color: actif ? 'var(--green)' : 'var(--muted)' }}>{actif ? 'Actif' : 'Inactif'}</span>
                    </div>
                    <button
                      onClick={() => togglePlanifie(p.id)}
                      className={`btn btn-sm ${actif ? 'btn-ghost' : 'btn-navy'}`}
                      style={{ color: actif ? 'var(--red)' : undefined }}>
                      {actif ? 'Désactiver' : 'Activer'}
                    </button>
                    <button
                      onClick={() => { setSelectedType('mensuel_cp'); setTab('generateur'); setTimeout(() => { handleGenerate(); }, 100); }}
                      className="btn btn-primary btn-sm">
                      <RefreshCw size={11} /> Forcer génération
                    </button>
                  </div>
                </div>
              </div>
            );
          })}

          {/* Stats planification */}
          <div className="kpi-grid" style={{ marginTop: 4 }}>
            {[
              { label: 'Rapports auto ce mois', value: '9', icon: <RefreshCw size={14} />, color: 'var(--navy)' },
              { label: 'Taux succès', value: '100%', icon: <CheckCircle size={14} />, color: 'var(--green)' },
              { label: 'Destinataires auto', value: '8', icon: <Send size={14} />, color: 'var(--orange)' },
              { label: 'Planifications actives', value: RAPPORTS_PLANIFIES.filter(p => isActif(p)).length.toString(), icon: <Calendar size={14} />, color: '#7C3AED' },
            ].map(k => (
              <div key={k.label} className="kpi-card">
                <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
                  <div style={{ width: 32, height: 32, borderRadius: 8, background: k.color + '18', display: 'flex', alignItems: 'center', justifyContent: 'center', color: k.color }}>
                    {k.icon}
                  </div>
                  <div>
                    <div className="kpi-value" style={{ fontSize: 18, color: k.color }}>{k.value}</div>
                    <div className="kpi-label">{k.label}</div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── Tab: Formats Bailleurs ───────────────────────────────────── */}
      {tab === 'bailleurs' && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: 14 }}>
          {[
            {
              bailleur: 'Banque Mondiale', code: 'BM', color: '#2563EB', format: 'IFR/ISR',
              desc: 'Intermediate Financial Report / Implementation Status Report',
              langues: ['EN', 'FR'], contacts: ['wb-dakar@worldbank.org'],
              rapports: ['Rapport d\'avancement semestriel', 'IFR financier trimestriel', 'ISR missions supervision'],
              convention: 'PADAES Phase II — 22 M USD · PAPSEN III — 15 M USD',
            },
            {
              bailleur: 'AFD', code: 'AFD', color: '#16A34A', format: 'RT + RFC',
              desc: 'Rapport Technique + Rapport Financier Consolidé',
              langues: ['FR'], contacts: ['senegal@afd.fr'],
              rapports: ['Rapport d\'avancement trimestriel', 'Rapport de démarrage', 'Rapport d\'achèvement'],
              convention: 'PADERAU — 80 M EUR · Électrification Casamance — 12 M EUR',
            },
            {
              bailleur: 'BAD / AfDB', code: 'BAD', color: '#F59E0B', format: 'PAD-ESSS',
              desc: 'Project Appraisal Document — Environmental & Social Standards',
              langues: ['FR', 'EN'], contacts: ['afdb-dakar@afdb.org'],
              rapports: ['Rapport d\'avancement semestriel', 'Rapport de supervision', 'PCR — Rapport d\'achèvement'],
              convention: 'Accès universel électricité — 45 M UA',
            },
            {
              bailleur: 'MCA Sénégal II', code: 'MCA', color: '#F97316', format: 'QPR',
              desc: 'Quarterly Progress Report — Compact II Access to Electricity',
              langues: ['EN', 'FR'], contacts: ['mca@senegal.mcc.gov'],
              rapports: ['Rapport trimestriel QPR', 'Rapport annuel', 'Rapport d\'évaluation mi-parcours'],
              convention: 'Compact II — 550 M USD · Ligne 225kV + Accès',
            },
          ].map(b => (
            <div key={b.code} className="card" style={{ overflow: 'hidden' }}>
              <div style={{ height: 4, background: b.color }} />
              <div className="card-body" style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                  <div>
                    <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--navy)' }}>{b.bailleur}</div>
                    <span style={{ fontSize: 9, fontWeight: 700, color: b.color, background: b.color + '18', padding: '2px 8px', borderRadius: 4 }}>{b.format}</span>
                  </div>
                  <Globe size={20} style={{ color: b.color, opacity: 0.4 }} />
                </div>
                <div style={{ fontSize: 10, color: 'var(--muted)' }}>{b.desc}</div>
                <div style={{ fontSize: 10, color: 'var(--navy)', fontWeight: 600, background: 'var(--bg)', borderRadius: 6, padding: '6px 10px' }}>{b.convention}</div>
                <div>
                  <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--muted)', marginBottom: 5, textTransform: 'uppercase', letterSpacing: '0.06em' }}>Rapports requis</div>
                  {b.rapports.map(r => (
                    <div key={r} style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 10, color: 'var(--text-2)', marginBottom: 3 }}>
                      <ChevronDown size={9} style={{ color: b.color, transform: 'rotate(-90deg)' }} /> {r}
                    </div>
                  ))}
                </div>
                <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                  {b.langues.map(l => (
                    <span key={l} style={{ fontSize: 9, fontWeight: 700, padding: '2px 6px', borderRadius: 4, background: 'var(--bg)', color: 'var(--muted)', border: '1px solid var(--border-2)' }}>
                      {l === 'FR' ? '🇫🇷 FR' : '🇬🇧 EN'}
                    </span>
                  ))}
                  {b.contacts.map(c => (
                    <span key={c} style={{ fontSize: 9, color: 'var(--muted)', padding: '2px 6px', borderRadius: 4, background: 'var(--bg)', border: '1px solid var(--border-2)' }}>{c}</span>
                  ))}
                </div>
                <div style={{ display: 'flex', gap: 6 }}>
                  <button
                    onClick={() => alert(`Modèle ${b.format} — ${b.bailleur}\n\nConvention: ${b.convention}\nFormat: ${b.format}\nLangues: ${b.langues.join(', ')}\nContact: ${b.contacts[0]}\n\nCliquez sur "Générateur" pour créer ce rapport avec vos données.`)}
                    className="btn btn-ghost btn-sm" style={{ flex: 1, justifyContent: 'center', color: b.color, borderColor: b.color + '44', fontSize: 10 }}>
                    <Eye size={10} /> Voir modèle
                  </button>
                  <button
                    onClick={() => {
                      const typeMap: Record<string, TypeRapport> = { 'BM': 'bailleur_bm', 'AFD': 'bailleur_afd', 'BAD': 'bailleur_bad', 'MCA': 'trimestriel_dpe' };
                      const t = typeMap[b.code] ?? 'trimestriel_dpe';
                      setSelectedType(t); setTab('generateur'); setSelectedFormat('PDF');
                    }}
                    className="btn btn-sm" style={{ flex: 1, justifyContent: 'center', background: b.color, color: '#fff', border: 'none', fontSize: 10 }}>
                    <Send size={10} /> Générer rapport
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      <style>{`@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}

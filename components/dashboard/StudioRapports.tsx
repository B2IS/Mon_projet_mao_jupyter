'use client';

import { useState, useMemo, useCallback } from 'react';
import {
  PenTool, Plus, Trash2, ArrowUp, ArrowDown, Download,
  Eye, Share2, Save, FileText, BarChart3, Map, Image,
  CheckSquare, AlertTriangle, Users, Wallet, Calendar,
  Clock, Bot, Edit3, ChevronDown, ChevronUp,
  Layers, TrendingUp, X, Search,
} from 'lucide-react';
import {
  useProjectStore, DOMAINE_CFG, type Domaine,
  computeAvancementReel, PHASES_DEFAUT,
} from '@/lib/projectStore';
import { SENELEC_LOGO_DATA_URI } from '@/lib/senelecLogo';

/* ─── Brand ─────────────────────────────── */
const NAVY   = '#3D1A6B';
const ORANGE = '#F47920';
const RED    = '#EF3340';
const GREEN  = '#16A34A';
const AMBER  = '#D97706';
const PURPLE = '#8B5CF6';

/* ═══════════════════════════════════════════════════
   SECTION TYPES (Studio)
═══════════════════════════════════════════════════ */
type SectionType =
  | 'synthese' | 'planning' | 'jalons' | 'finances'
  | 'bordereaux' | 'photos' | 'cartographie' | 'risques'
  | 'decisions' | 'annexes';

interface Section { id: string; type: SectionType; label: string; active: boolean; }
interface RapportModele { id: string; label: string; sections: SectionType[]; auteur: string; date: string; }

const CATALOGUE: { type: SectionType; label: string; desc: string; icon: React.ReactNode; color: string }[] = [
  { type: 'synthese',     label: 'Synthèse exécutive',     desc: 'KPI globaux, contexte, faits majeurs',         icon: <FileText size={16} />,      color: NAVY    },
  { type: 'planning',     label: 'Planning & Jalons',        desc: 'Gantt condensé, jalons, écarts de délai',      icon: <Calendar size={16} />,      color: PURPLE  },
  { type: 'jalons',       label: 'Jalons critiques',         desc: 'Jalons franchis, à venir et en retard',        icon: <CheckSquare size={16} />,   color: GREEN   },
  { type: 'finances',     label: 'Budget & Finances',        desc: 'Budget, décaissements, CPI, SPI',              icon: <Wallet size={16} />,        color: GREEN   },
  { type: 'bordereaux',   label: 'Bordereaux & Quantités',   desc: 'Articles, quantités, montants cumulés',        icon: <BarChart3 size={16} />,     color: AMBER   },
  { type: 'photos',       label: 'Photos terrain & Annexes', desc: 'Photos géolocalisées, PV, constats',           icon: <Image size={16} />,         color: ORANGE  },
  { type: 'cartographie', label: 'Cartes & SIG',             desc: 'Carte des réalisations, zones, actifs',        icon: <Map size={16} />,           color: '#0EA5E9' },
  { type: 'risques',      label: 'Risques & QHSE',           desc: 'Risques ouverts, plans d\'action, criticité',  icon: <AlertTriangle size={16} />, color: RED     },
  { type: 'decisions',    label: 'Décisions & Arbitrages',   desc: 'Journal décisions, arbitrages, dates',         icon: <Users size={16} />,         color: PURPLE  },
  { type: 'annexes',      label: 'Annexes documentaires',    desc: 'Pièces jointes, références GED',               icon: <FileText size={16} />,      color: '#64748B' },
];

const MODELES: RapportModele[] = [
  { id: 'm1', label: 'Rapport mensuel projet',   sections: ['synthese', 'planning', 'finances', 'risques'],                                       auteur: 'CP Diallo',   date: '2026-05-01' },
  { id: 'm2', label: 'Rapport comité direction', sections: ['synthese', 'jalons', 'finances', 'decisions'],                                        auteur: 'PMO Central', date: '2026-04-15' },
  { id: 'm3', label: 'Rapport terrain complet',  sections: ['synthese', 'planning', 'photos', 'cartographie', 'annexes'],                          auteur: 'CP Ndiaye',   date: '2026-05-10' },
  { id: 'm4', label: 'Rapport T2 2026',          sections: ['synthese', 'planning', 'jalons', 'finances', 'bordereaux', 'risques', 'decisions'],   auteur: 'PMO Central', date: '2026-05-20' },
];

let idCounter = 100;
function uid() { return `sec_${++idCounter}`; }

/* ═══════════════════════════════════════════════════
   RAPPORT TRIMESTRIEL — Types & constants
═══════════════════════════════════════════════════ */
const TRIMESTRES = ['T1', 'T2', 'T3', 'T4'] as const;
type Trimestre = typeof TRIMESTRES[number];

const DOMAINES_RAPPORT: { id: Domaine; label: string; emoji: string; unites: string[]; color: string }[] = [
  { id: 'production',   label: 'Production d\'énergie',  emoji: '🔋', unites: ['DPEC', 'DPER'],                        color: '#F37021' },
  { id: 'transport',    label: 'Transport',                 emoji: '⚡', unites: ['DPT'],                                 color: '#1B4F8A' },
  { id: 'distribution', label: 'Distribution',              emoji: '🔌', unites: ['DPD', 'CPBM-UE'],                      color: '#16A34A' },
  { id: 'commercial',   label: 'Commercial',                emoji: '📊', unites: ['DIT', 'DPC', 'DSSE', 'CPADERAU', 'CPAMACEL_EE', 'CC26'], color: '#8B5CF6' },
];

// Simulate quarterly progress
function getQuarterlyPct(baseProgress: number, trim: Trimestre): number {
  const factors: Record<Trimestre, number> = { T1: 0.22, T2: 0.48, T3: 0.74, T4: 1.0 };
  return Math.round(baseProgress * factors[trim]);
}

/* ─── AI text templates — riches et spécifiques ── */
function generateAIText(domaine: Domaine | string, trim: Trimestre, year: number, sectionType: 'faits' | 'indicateurs' | 'contraintes'): string {
  const domCfg = DOMAINES_RAPPORT.find(d => d.id === domaine);
  const label = domCfg?.label ?? domaine;

  if (sectionType === 'faits') {
    return [
      `FAITS MAJEURS — ${label.toUpperCase()} · ${trim} ${year}`,
      '',
      `Au cours du ${trim} ${year}, le domaine ${label} a enregistré des avancées considérables dans l'exécution de son programme d'investissements. Les principales réalisations sont les suivantes :`,
      '',
      `1. EXÉCUTION PHYSIQUE`,
      `   • Les travaux de pose de réseaux et d'installation des équipements se sont poursuivis conformément au planning contractuel révisé.`,
      `   • Plusieurs lots ont atteint leur réception provisoire technique, marquant une étape clé du programme.`,
      `   • La cadence d'exécution a été maintenue grâce à des réunions hebdomadaires de coordination avec les entreprises adjudicataires.`,
      `   • Les équipes terrain ont déployé des ressources supplémentaires pour combler les retards constatés en début de période.`,
      '',
      `2. JALONS ATTEINTS`,
      `   • Validation des études d'exécution pour les nouvelles zones d'extension`,
      `   • Réception partielle des équipements critiques commandés en ${trim === 'T1' ? 'T4' : trim === 'T2' ? 'T1' : trim === 'T3' ? 'T2' : 'T3'} ${year}`,
      `   • Signature des actes de réception provisoire pour les lots achevés`,
      `   • Mise en service des ouvrages réceptionnés après tests et essais concluants`,
      '',
      `3. COORDINATION ET GOUVERNANCE`,
      `   • Les comités de suivi bi-mensuels ont permis de traiter rapidement les difficultés opérationnelles.`,
      `   • La DPE a assuré la supervision permanente des chantiers, avec des visites terrain régulières des ingénieurs de suivi.`,
      `   • Les PV de réunion et rapports d'avancement ont été transmis aux bailleurs de fonds dans les délais contractuels.`,
      `   • Le tableau de bord de suivi a été mis à jour en temps réel, permettant un suivi précis de la pondération des phases.`,
      '',
      `4. DÉCAISSEMENTS ET FACTURATION`,
      `   • Les demandes de paiement des entreprises ont été traitées dans un délai moyen de 28 jours.`,
      `   • Les situations de travaux ont été certifiées conformément aux bordereaux des prix contractuels.`,
      `   • Le rythme de décaissement est conforme aux prévisions du plan de financement ${year}.`,
    ].join('\n');
  }
  if (sectionType === 'indicateurs') {
    return [
      `INDICATEURS DE PERFORMANCE — ${label.toUpperCase()} · ${trim} ${year}`,
      '',
      `PERFORMANCE DÉLAIS (SPI — Schedule Performance Index) :`,
      `L'indice de performance des délais (SPI) reflète l'avancement physique réel par rapport au planning contractuel. Un SPI < 1,00 indique un retard, un SPI ≥ 1,00 indique que le projet est en avance ou dans les délais. Pour ce trimestre, les projets du domaine ${label} présentent une performance globalement satisfaisante, avec des actions correctives en cours sur les lots en retard.`,
      '',
      `PERFORMANCE COÛTS (CPI — Cost Performance Index) :`,
      `L'indice CPI mesure l'efficience budgétaire. Un CPI ≥ 1,00 traduit une maîtrise des coûts. Les analyses EVM (Earned Value Management) conduites sur la période montrent une bonne maîtrise des dépenses pour la majorité des projets. Des dépassements localisés ont été identifiés sur certains postes d'approvisionnement, des mesures correctives ont été engagées.`,
      '',
      `TAUX D'EXÉCUTION FINANCIÈRE :`,
      `• Taux de décaissement sur la période : conforme aux prévisions`,
      `• Taux de mandatement annuel : en progression par rapport à ${trim === 'T1' ? "l'exercice précédent" : 'la même période'}`,
      `• Taux d'engagement : élevé, cohérent avec les engagements contractuels en cours`,
      `• Solde disponible : géré conformément au plan de décaissement agréé avec les bailleurs`,
      '',
      `QUALITÉ ET CONFORMITÉ :`,
      `• Les contrôles qualité et QHSE sont réalisés conformément au plan assurance qualité`,
      `• Aucun incident majeur de sécurité n'a été enregistré sur la période`,
      `• Les non-conformités identifiées ont été traitées selon les procédures de levée de réserves`,
      `• La traçabilité documentaire (GED SIGEPP-DPE) est maintenue à jour`,
    ].join('\n');
  }
  return [
    `CONTRAINTES ET PLAN D'ACTIONS — ${label.toUpperCase()} · ${trim} ${year}`,
    '',
    `CONTRAINTES IDENTIFIÉES :`,
    '',
    `1. APPROVISIONNEMENT ET LOGISTIQUE`,
    `   • Retards dans la livraison de certains équipements à délai long (transformateurs, câbles HTB/HTA) en raison des tensions sur les chaînes d'approvisionnement mondiales et des procédures douanières.`,
    `   • Délais d'acheminement des matériaux vers les sites éloignés (zones rurales) en raison de l'état des pistes en saison des pluies.`,
    `   Mesure corrective : Renforcement des stocks de sécurité, anticipation des commandes, négociation de délais de livraison contractuels avec les fournisseurs.`,
    '',
    `2. PROCÉDURES ADMINISTRATIVES ET FONCIÈRES`,
    `   • Retards dans la libération d'emprise sur certains lots, nécessitant des démarches auprès des autorités locales et des propriétaires fonciers.`,
    `   • Lenteurs dans le traitement des avis de dommages et des indemnisations de cultures.`,
    `   Mesure corrective : Mobilisation des équipes juridiques et des préfectures concernées, accélération des procédures de compensation.`,
    '',
    `3. RESSOURCES HUMAINES ET TECHNIQUES`,
    `   • Disponibilité limitée de certains profils techniques spécialisés (ingénieurs en ligne, techniciens de maintenance HTA/BT).`,
    `   • Risque de turn-over au niveau des entreprises sous-traitantes impactant la continuité des équipes terrain.`,
    `   Mesure corrective : Recrutement complémentaire en cours, renforcement des équipes par des experts temporaires.`,
    '',
    `4. RISQUES MÉTÉOROLOGIQUES`,
    `   • La saison des pluies (juin-octobre) impacte significativement l'accessibilité des sites et la productivité des travaux en milieu rural.`,
    `   Mesure corrective : Reprogrammation des activités critiques hors période pluvieuse, sécurisation des voies d'accès.`,
    '',
    `PLAN D'ACTIONS PRIORITAIRES :`,
    `   ✓ Réunion hebdomadaire de suivi avec les entreprises pour identifier les blocages`,
    `   ✓ Tableau de bord des risques mis à jour mensuellement et partagé avec la Direction`,
    `   ✓ Saisine formelle des autorités compétentes pour les libérations d'emprise`,
    `   ✓ Révision du calendrier d'approvisionnement pour anticiper les délais`,
    `   ✓ Activation des clauses contractuelles de pénalités de retard si nécessaire`,
  ].join('\n');
}

/* ─── Section content components for preview — données réelles ── */

function PreviewSectionContent({ sec, projet }: {
  sec: Section;
  projet: NonNullable<ReturnType<typeof useProjectStore>['projets'][0]> | undefined;
}) {
  if (!projet) return <div style={{ color: '#94A3B8', fontSize: 12, fontStyle: 'italic', padding: '12px 16px' }}>Aucun projet sélectionné.</div>;

  const phases = projet.phases ?? PHASES_DEFAUT;
  const avPondere = computeAvancementReel(phases);
  const ecartBudget = ((projet.budgetDecaisse / Math.max(projet.budget, 1)) * 100).toFixed(1);
  const vc = projet.budgetEngage - projet.budgetDecaisse;
  const ev = (projet.avancement / 100) * projet.budget;
  const ac = projet.budgetDecaisse;
  const pv = (projet.avancementPlanifie / 100) * projet.budget;
  const bac = projet.budget;
  const eac = projet.cpi > 0 ? Math.round(bac / projet.cpi) : bac;
  const etc = eac - ac;
  const tcpi = (bac - ev) > 0 ? ((bac - ac) / (bac - ev)) : 0;

  const tbl = (headers: string[], rows: (string | number)[][], totals?: (string|number)[]) => (
    <div style={{ overflowX: 'auto', marginBottom: 12 }}>
      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 11 }}>
        <thead>
          <tr style={{ background: NAVY, color: '#fff' }}>
            {headers.map((h, i) => <th key={i} style={{ padding: '6px 10px', textAlign: i === 0 ? 'left' : 'center', fontWeight: 700, whiteSpace: 'nowrap' }}>{h}</th>)}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, ri) => (
            <tr key={ri} style={{ background: ri % 2 === 0 ? '#F8FAFC' : '#fff', borderBottom: '1px solid #E5E7EB' }}>
              {row.map((cell, ci) => (
                <td key={ci} style={{ padding: '5px 10px', textAlign: ci === 0 ? 'left' : 'center', fontWeight: ci === 0 ? 400 : 600, color: ci === 0 ? '#374151' : '#1E293B', fontFamily: ci > 0 ? 'monospace' : 'inherit' }}>{cell}</td>
              ))}
            </tr>
          ))}
        </tbody>
        {totals && (
          <tfoot>
            <tr style={{ background: `${NAVY}15`, borderTop: '2px solid #CBD5E1' }}>
              {totals.map((cell, ci) => (
                <td key={ci} style={{ padding: '6px 10px', textAlign: ci === 0 ? 'left' : 'center', fontWeight: 800, color: NAVY, fontFamily: ci > 0 ? 'monospace' : 'inherit' }}>{cell}</td>
              ))}
            </tr>
          </tfoot>
        )}
      </table>
    </div>
  );

  if (sec.type === 'synthese') {
    const statusLabel = projet.statut === 'en_retard' ? '⚠ En retard' : projet.statut === 'termine' ? '✓ Terminé' : projet.statut === 'suspendu' ? '⚡ Suspendu' : '✅ En cours';
    const statusColor = projet.statut === 'en_retard' ? RED : projet.statut === 'termine' ? GREEN : projet.statut === 'suspendu' ? AMBER : GREEN;
    return (
      <div>
        {/* KPI grid */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 10, marginBottom: 16 }}>
          {[
            { label: 'Avancement physique', value: `${projet.avancement}%`, color: NAVY, sub: `Planifié : ${projet.avancementPlanifie}%` },
            { label: 'Av. pondéré', value: `${avPondere.toFixed(2)}%`, color: PURPLE, sub: 'Pondération par phases' },
            { label: 'CPI (coûts)', value: projet.cpi.toFixed(2), color: projet.cpi >= 0.9 ? GREEN : RED, sub: projet.cpi >= 1 ? 'Sous budget' : 'Dépassement' },
            { label: 'SPI (délais)', value: projet.spi.toFixed(2), color: projet.spi >= 0.85 ? GREEN : AMBER, sub: projet.spi >= 1 ? 'En avance' : 'Léger retard' },
          ].map(k => (
            <div key={k.label} style={{ border: `2px solid ${k.color}30`, borderRadius: 8, padding: '10px 12px', textAlign: 'center', background: `${k.color}08` }}>
              <div style={{ fontSize: 22, fontWeight: 900, color: k.color }}>{k.value}</div>
              <div style={{ fontSize: 10.5, fontWeight: 700, color: '#374151', margin: '3px 0 2px' }}>{k.label}</div>
              <div style={{ fontSize: 9.5, color: '#94A3B8' }}>{k.sub}</div>
            </div>
          ))}
        </div>
        {/* Summary table */}
        {tbl(
          ['Indicateur', 'Valeur', 'Statut'],
          [
            ['Code projet', projet.code, ''],
            ['Intitulé', projet.nom.slice(0, 45), ''],
            ['Bailleur / Financement', projet.bailleurs?.[0]?.nom ?? 'SENELEC', ''],
            ['Domaine', DOMAINE_CFG[projet.domaine as Domaine]?.label ?? projet.domaine, ''],
            ['Unité de gestion', projet.unite ?? 'DPE', ''],
            ['Date démarrage', projet.dateDebut ?? 'N/D', ''],
            ['Date fin contractuelle', projet.dateFinPrevue ?? 'N/D', ''],
            ['Avancement physique', `${projet.avancement}%`, projet.avancement >= projet.avancementPlanifie ? '✅ OK' : '⚠ Écart'],
            ['Avancement planifié', `${projet.avancementPlanifie}%`, ''],
            ['Statut global', statusLabel, ''],
          ]
        )}
        {/* Narrative */}
        <div style={{ background: '#F8FAFC', borderRadius: 6, border: '1px solid #E2E8F0', padding: '12px 14px', fontSize: 11.5, color: '#374151', lineHeight: 1.7 }}>
          <strong style={{ color: NAVY }}>Analyse synthétique :</strong> Le projet <strong>{projet.code} — {projet.nom}</strong> présente
          un avancement physique de <strong>{projet.avancement}%</strong> pour un avancement planifié de {projet.avancementPlanifie}%.
          L'avancement physique pondéré est de <strong>{avPondere.toFixed(2)}%</strong>, reflétant la répartition réelle des phases du cycle projet.
          {` L'indice de performance des coûts (CPI = ${projet.cpi.toFixed(2)}) ${projet.cpi >= 1 ? "indique une bonne maîtrise budgétaire" : "signale un risque de dépassement budgétaire"}.`}
          {` L'indice de performance des délais (SPI = ${projet.spi.toFixed(2)}) ${projet.spi >= 1 ? "confirme le respect du calendrier contractuel" : "révèle un écart par rapport au planning initial, qui fait l'objet d'un plan de rattrapage"}.`}
          {` Le statut global du projet est : `}<span style={{ color: statusColor, fontWeight: 700 }}>{statusLabel}</span>.
        </div>
      </div>
    );
  }

  if (sec.type === 'planning') {
    const COLORS7 = ['#7C3AED','#1D4ED8','#0F766E','#B45309','#EF3340','#16A34A','#374151'];
    return (
      <div>
        <div style={{ fontSize: 12, fontWeight: 700, color: NAVY, marginBottom: 8 }}>Pondération — Avancement par phase</div>
        {tbl(
          ['Phase', 'Poids (%)', 'Av. réel (%)', 'Contribution pondérée', 'Statut'],
          phases.map((ph, i) => [
            ph.label,
            `${ph.poids}%`,
            `${ph.avancement}%`,
            `${((ph.poids * ph.avancement) / 100).toFixed(2)}%`,
            ph.avancement === 100 ? '✅ Terminé' : ph.avancement > 0 ? '🔄 En cours' : '⏳ Non démarré'
          ]),
          ['TOTAL', '100%', `${Math.round(phases.reduce((s, ph) => s + ph.avancement, 0) / phases.length)}%`, `${avPondere.toFixed(2)}%`, '']
        )}
        <div style={{ background: '#F8FAFC', borderRadius: 6, border: '1px solid #E2E8F0', padding: '10px 12px', marginTop: 8 }}>
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
            {phases.map((ph, i) => (
              <div key={ph.id} style={{ flex: 1, minWidth: 60, textAlign: 'center' }}>
                <div style={{ fontSize: 9, fontWeight: 700, color: COLORS7[i], marginBottom: 3, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{ph.label.split(' ')[0]}</div>
                <div style={{ height: 48, background: '#E5E7EB', borderRadius: 4, position: 'relative', overflow: 'hidden' }}>
                  <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, height: `${ph.avancement}%`, background: COLORS7[i], borderRadius: 4 }}/>
                  <span style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 9, fontWeight: 800, color: ph.avancement > 50 ? '#fff' : COLORS7[i] }}>{ph.avancement}%</span>
                </div>
                <div style={{ fontSize: 8, color: '#94A3B8', marginTop: 2 }}>{ph.poids}%</div>
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  if (sec.type === 'finances') {
    return (
      <div>
        <div style={{ fontSize: 12, fontWeight: 700, color: NAVY, marginBottom: 8 }}>Tableau des indicateurs financiers</div>
        {tbl(
          ['Indicateur financier', 'Montant (MFCFA) / Valeur', '% Budget', 'Interprétation'],
          [
            ['Budget Total (BAC)', `${projet.budget.toLocaleString('fr-FR')}`, '100%', 'Budget à l\'achèvement'],
            ['Marchés attribués (EAC engagé)', `${projet.budgetEngage.toLocaleString('fr-FR')}`, `${((projet.budgetEngage / Math.max(projet.budget,1))*100).toFixed(1)}%`, 'Engagements'],
            ['Décaissements cumulés (AC)', `${projet.budgetDecaisse.toLocaleString('fr-FR')}`, `${ecartBudget}%`, 'Actual Cost'],
            ['Valeur acquise (EV)', `${Math.round(ev).toLocaleString('fr-FR')}`, `${projet.avancement}%`, 'Earned Value'],
            ['Valeur planifiée (PV)', `${Math.round(pv).toLocaleString('fr-FR')}`, `${projet.avancementPlanifie}%`, 'Planned Value'],
            ['Variation coût (CV = EV-AC)', `${Math.round(ev - ac).toLocaleString('fr-FR')}`, '', ev >= ac ? '✅ Sous coût' : '⚠ Dépassement'],
            ['Variation délai (SV = EV-PV)', `${Math.round(ev - pv).toLocaleString('fr-FR')}`, '', ev >= pv ? '✅ En avance' : '⚠ Retard'],
            ['CPI (Indice performance coût)', projet.cpi.toFixed(3), '', projet.cpi >= 1 ? '✅ ≥ 1 Bon' : '⚠ < 1 Surveiller'],
            ['SPI (Indice performance délai)', projet.spi.toFixed(3), '', projet.spi >= 1 ? '✅ ≥ 1 Bon' : '⚠ < 1 Retard'],
            ['Coût final estimé (EAC)', `${eac.toLocaleString('fr-FR')}`, `${((eac/Math.max(projet.budget,1))*100).toFixed(1)}%`, eac <= projet.budget ? '✅ Dans budget' : '⚠ Dépassement probable'],
            ['Coût restant estimé (ETC)', `${Math.max(0,etc).toLocaleString('fr-FR')}`, '', 'Pour terminer'],
            ['TCPI (indice à terminer)', tcpi.toFixed(3), '', tcpi <= 1 ? '✅ Atteignable' : '⚠ Objectif difficile'],
            ['Solde disponible', `${Math.max(0, projet.budget - projet.budgetEngage).toLocaleString('fr-FR')}`, `${Math.max(0,((projet.budget - projet.budgetEngage)/Math.max(projet.budget,1))*100).toFixed(1)}%`, 'Non engagé'],
          ]
        )}
        <div style={{ background: '#FFF7ED', border: '1px solid #FED7AA', borderRadius: 6, padding: '10px 14px', fontSize: 11, color: '#92400E', marginTop: 6 }}>
          <strong>Note EVM :</strong> Earned Value Management (EVM) selon le référentiel PMI. CPI = Earned Value / Actual Cost. SPI = Earned Value / Planned Value. EAC = BAC / CPI. TCPI = (BAC - EV) / (BAC - AC).
        </div>
      </div>
    );
  }

  if (sec.type === 'risques') {
    const risques = [
      { libelle: 'Retard approv. équipements HTB/HTA', prob: 'Élevée', impact: 'Majeur', crit: 'Critique', mitigation: 'Commandes anticipées, stocks sécurité', statut: 'Ouvert' },
      { libelle: 'Difficultés d\'accès sites saison pluies', prob: 'Élevée', impact: 'Modéré', crit: 'Important', mitigation: 'Sécurisation voies accès, reprogrammation', statut: 'En cours' },
      { libelle: 'Libération d\'emprise foncière tardive', prob: 'Moyenne', impact: 'Majeur', crit: 'Important', mitigation: 'Saisine préfectures, indemnisations accélérées', statut: 'Ouvert' },
      { libelle: 'Turn-over entreprises sous-traitantes', prob: 'Faible', impact: 'Modéré', crit: 'Modéré', mitigation: 'Clauses contractuelles, qualification alternatives', statut: 'Surveillé' },
      { libelle: 'Hausse prix matériaux (acier, câbles)', prob: 'Moyenne', impact: 'Modéré', crit: 'Modéré', mitigation: 'Révision prix contractuelle, négociation', statut: 'Surveillé' },
    ];
    return (
      <div>
        <div style={{ fontSize: 12, fontWeight: 700, color: NAVY, marginBottom: 8 }}>Registre des risques</div>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 11 }}>
            <thead>
              <tr style={{ background: RED, color: '#fff' }}>
                {['Risque identifié', 'Prob.', 'Impact', 'Criticité', 'Mesure de mitigation', 'Statut'].map((h, i) => (
                  <th key={i} style={{ padding: '6px 8px', textAlign: 'left', fontWeight: 700 }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {risques.map((r, i) => {
                const critColor = r.crit === 'Critique' ? '#DC2626' : r.crit === 'Important' ? '#D97706' : '#16A34A';
                return (
                  <tr key={i} style={{ background: i % 2 === 0 ? '#FFF5F5' : '#fff', borderBottom: '1px solid #FEE2E2' }}>
                    <td style={{ padding: '6px 8px', fontWeight: 600, color: '#1E293B' }}>{r.libelle}</td>
                    <td style={{ padding: '6px 8px', textAlign: 'center', fontSize: 10.5, color: r.prob === 'Élevée' ? '#DC2626' : r.prob === 'Moyenne' ? '#D97706' : '#16A34A', fontWeight: 700 }}>{r.prob}</td>
                    <td style={{ padding: '6px 8px', textAlign: 'center', fontSize: 10.5 }}>{r.impact}</td>
                    <td style={{ padding: '6px 8px', textAlign: 'center' }}>
                      <span style={{ padding: '2px 7px', borderRadius: 4, background: `${critColor}20`, color: critColor, fontSize: 10, fontWeight: 700 }}>{r.crit}</span>
                    </td>
                    <td style={{ padding: '6px 8px', fontSize: 10.5, color: '#374151' }}>{r.mitigation}</td>
                    <td style={{ padding: '6px 8px', textAlign: 'center' }}>
                      <span style={{ padding: '2px 6px', borderRadius: 4, background: r.statut === 'Ouvert' ? '#FEE2E2' : r.statut === 'En cours' ? '#FFF7ED' : '#F0FDF4', color: r.statut === 'Ouvert' ? '#DC2626' : r.statut === 'En cours' ? '#D97706' : '#16A34A', fontSize: 10, fontWeight: 700 }}>{r.statut}</span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    );
  }

  if (sec.type === 'jalons') {
    const jalons = phases.map((ph, i) => ({
      jalon: `Achèvement ${ph.label}`,
      prevue: projet.dateDebut ? 'Q' + (i + 1) + ' ' + (new Date(projet.dateDebut).getFullYear()) : 'N/D',
      reelle: ph.avancement === 100 ? 'Atteint' : ph.avancement > 80 ? 'En cours' : 'À venir',
      statut: ph.avancement === 100 ? '✅' : ph.avancement > 0 ? '🔄' : '⏳',
      pct: `${ph.avancement}%`,
    }));
    return (
      <div>
        <div style={{ fontSize: 12, fontWeight: 700, color: NAVY, marginBottom: 8 }}>Jalons contractuels — Suivi d'avancement</div>
        {tbl(
          ['Jalon / Livrable', 'Date prévue', 'Situation', '% Av.', 'Statut'],
          jalons.map(j => [j.jalon, j.prevue, j.reelle, j.pct, j.statut])
        )}
      </div>
    );
  }

  if (sec.type === 'bordereaux') {
    return (
      <div>
        <div style={{ fontSize: 12, fontWeight: 700, color: NAVY, marginBottom: 8 }}>Bordereaux des quantités réalisées</div>
        {tbl(
          ['Désignation', 'Unité', 'Qté prévue', 'Qté réalisée', 'Taux (%)', 'Montant (MFCFA)'],
          [
            ['Ligne HTA aérienne', 'km', '45.0', `${Math.round(projet.avancement * 0.45)}`, `${projet.avancement}%`, `${Math.round(projet.budget * 0.32).toLocaleString('fr-FR')}`],
            ['Ligne BT aérienne', 'km', '123.0', `${Math.round(projet.avancement * 1.23)}`, `${projet.avancement}%`, `${Math.round(projet.budget * 0.18).toLocaleString('fr-FR')}`],
            ['Postes de transformation', 'u', '32', `${Math.round(projet.avancement * 0.32)}`, `${projet.avancement}%`, `${Math.round(projet.budget * 0.25).toLocaleString('fr-FR')}`],
            ['Branchements ménages', 'u', '2 500', `${Math.round(projet.avancement * 25)}`, `${projet.avancement}%`, `${Math.round(projet.budget * 0.15).toLocaleString('fr-FR')}`],
            ['Câbles BT souterrain', 'km', '8.5', `${Math.round(projet.avancement * 0.085)}`, `${projet.avancement}%`, `${Math.round(projet.budget * 0.10).toLocaleString('fr-FR')}`],
          ],
          ['TOTAL', '', '', '', `${projet.avancement}%`, `${Math.round(projet.budget * projet.avancement / 100).toLocaleString('fr-FR')}`]
        )}
      </div>
    );
  }

  if (sec.type === 'decisions') {
    return (
      <div>
        <div style={{ fontSize: 12, fontWeight: 700, color: NAVY, marginBottom: 8 }}>Journal des décisions et arbitrages</div>
        {tbl(
          ['Date', 'Décision / Arbitrage', 'Décideur', 'Échéance', 'Statut'],
          [
            ['15/04/2026', 'Révision délai lot 3 — extension 45 jours', 'DIR DPE', '30/04/2026', '✅ Acté'],
            ['22/04/2026', 'Approbation avenant n°2 (changement tracé)', 'PMO DPE', '15/05/2026', '✅ Signé'],
            ['05/05/2026', 'Résolution litige sous-traitant pose câbles', 'Chef Projet', '20/05/2026', '🔄 En cours'],
            ['12/05/2026', 'Accélération approvisionnement transformateurs', 'RESP LOG', '01/06/2026', '🔄 En cours'],
            ['18/05/2026', 'Validation PV réception provisoire lots 1 & 2', 'CP + Entreprise', '25/05/2026', '✅ Signé'],
          ]
        )}
      </div>
    );
  }

  // Default for other section types
  return (
    <div style={{ background: '#F8FAFC', borderRadius: 6, border: '1px dashed #CBD5E1', padding: '16px', fontSize: 12, color: '#64748B', fontStyle: 'italic' }}>
      Section <strong>{sec.label}</strong> — Données disponibles à la génération. Cliquez sur <strong>✨ Générer tout via IA</strong> pour remplir automatiquement.
    </div>
  );
}

/* ─── Financial indicators table per domain ── */
function FinancialTable({ projets, trim, year }: {
  projets: ReturnType<typeof useProjectStore>['projets'];
  trim: Trimestre; year: number;
}) {
  const totalBudget   = projets.reduce((s, p) => s + p.budget, 0);
  const totalAttribue = projets.reduce((s, p) => s + p.budgetEngage, 0);
  const totalCumul    = projets.reduce((s, p) => s + p.budgetDecaisse, 0);
  const qFactor: Record<Trimestre, number> = { T1: 0.25, T2: 0.5, T3: 0.75, T4: 1.0 };
  const budgetAnnee   = totalBudget * 0.3;
  const facturAnnee   = totalCumul * qFactor[trim];
  const prevuPeriode  = totalBudget * 0.06;
  const facturePeriode = totalCumul * 0.07;
  const tauxPeriode   = totalAttribue > 0 ? (facturePeriode / prevuPeriode) * 100 : 0;
  const tauxAnnuel    = budgetAnnee > 0 ? (facturAnnee / budgetAnnee) * 100 : 0;
  const tauxCumulAttribue = totalAttribue > 0 ? (totalCumul / totalAttribue) * 100 : 0;
  const tauxCumulBudget   = totalBudget > 0 ? (totalCumul / totalBudget) * 100 : 0;

  const fmt = (n: number) => n.toLocaleString('fr-FR', { maximumFractionDigits: 1 });
  const fmtPct = (n: number) => `${n.toFixed(1)}%`;

  const rows: { label: string; value: string; comment: string }[] = [
    { label: 'Montant total budgétisé des projets',         value: `${fmt(totalBudget)} MFCFA`,           comment: `${projets.length} projets` },
    { label: 'Montant total attribué des projets',           value: `${fmt(totalAttribue)} MFCFA`,         comment: `${fmtPct((totalAttribue/Math.max(totalBudget,1))*100)} du budget` },
    { label: 'Montant total facturé (cumul à date)',         value: `${fmt(totalCumul)} MFCFA`,            comment: fmtPct(tauxCumulBudget) },
    { label: `Montant total budgétisé ${year}`,             value: `${fmt(budgetAnnee)} MFCFA`,           comment: '30% budget annuel' },
    { label: `Montant total facturé en ${year}`,            value: `${fmt(facturAnnee)} MFCFA`,           comment: fmtPct(tauxAnnuel) },
    { label: `Montant total prévu sur la période ${trim}`,  value: `${fmt(prevuPeriode)} MFCFA`,          comment: 'Prévision trimestrielle' },
    { label: `Montant total facturé sur la période ${trim}`, value: `${fmt(facturePeriode)} MFCFA`,       comment: fmtPct(tauxPeriode) },
    { label: 'Taux d\'av. financier réalisé / période',     value: fmtPct(tauxPeriode),                   comment: tauxPeriode >= 80 ? '✅ Satisfaisant' : '⚠️ À surveiller' },
    { label: 'Taux d\'av. financier annuel',                value: fmtPct(tauxAnnuel),                    comment: tauxAnnuel >= 70 ? '✅ Satisfaisant' : '⚠️ À surveiller' },
    { label: 'Taux d\'av. financier cumul / attribué',      value: fmtPct(tauxCumulAttribue),             comment: '' },
    { label: 'Taux d\'av. financier cumul / budget global', value: fmtPct(tauxCumulBudget),               comment: '' },
  ];

  return (
    <div style={{ overflowX: 'auto', marginBottom: 12 }}>
      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 11 }}>
        <thead>
          <tr style={{ background: NAVY, color: '#fff' }}>
            <th style={{ padding: '6px 10px', textAlign: 'left', fontWeight: 700 }}>Indicateurs</th>
            <th style={{ padding: '6px 10px', textAlign: 'right', fontWeight: 700, whiteSpace: 'nowrap' }}>Réalisations {trim} en M FCFA / %</th>
            <th style={{ padding: '6px 10px', textAlign: 'left', fontWeight: 700 }}>Commentaires</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row, i) => (
            <tr key={i} style={{ background: i % 2 === 0 ? '#F8FAFC' : '#fff', borderBottom: '1px solid #E5E7EB' }}>
              <td style={{ padding: '5px 10px', color: '#374151', fontWeight: i >= 7 ? 700 : 400 }}>{row.label}</td>
              <td style={{ padding: '5px 10px', textAlign: 'right', fontWeight: 700, color: i >= 7 ? NAVY : '#1E293B', fontFamily: 'monospace' }}>{row.value}</td>
              <td style={{ padding: '5px 10px', color: '#64748B', fontSize: 10 }}>{row.comment}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/* ─── Physical table per domain ── */
function PhysicalTable({ projets, trim }: {
  projets: ReturnType<typeof useProjectStore>['projets']; trim: Trimestre;
}) {
  if (projets.length === 0) return (
    <div style={{ padding: '12px', color: '#94A3B8', fontSize: 11, fontStyle: 'italic' }}>Aucun projet dans ce domaine</div>
  );
  const phaseCurrent = (p: typeof projets[0]): string => {
    const phases = p.phases ?? PHASES_DEFAUT;
    const active = [...phases].reverse().find(ph => ph.avancement > 0);
    return active?.label ?? 'Préparation';
  };
  return (
    <div style={{ overflowX: 'auto', marginBottom: 12 }}>
      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 10.5 }}>
        <thead>
          <tr style={{ background: '#374151', color: '#fff' }}>
            <th style={{ padding: '5px 8px', textAlign: 'left' }}>Code</th>
            <th style={{ padding: '5px 8px', textAlign: 'left' }}>Désignation</th>
            <th style={{ padding: '5px 8px', textAlign: 'center' }}>Phase en cours</th>
            <th style={{ padding: '5px 8px', textAlign: 'center' }}>Av. Planifié</th>
            <th style={{ padding: '5px 8px', textAlign: 'center' }}>Av. Physique</th>
            <th style={{ padding: '5px 8px', textAlign: 'center' }}>Av. pondéré</th>
            <th style={{ padding: '5px 8px', textAlign: 'center' }}>Statut</th>
            <th style={{ padding: '5px 8px', textAlign: 'right' }}>Budget MFCFA</th>
          </tr>
        </thead>
        <tbody>
          {projets.map((p, i) => {
            const phases = p.phases ?? PHASES_DEFAUT;
            const avPondere = computeAvancementReel(phases);
            const ecart = p.avancement - p.avancementPlanifie;
            const statusColor = p.statut === 'en_retard' ? RED : p.statut === 'termine' ? GREEN : p.avancement < p.avancementPlanifie ? AMBER : GREEN;
            return (
              <tr key={p.id} style={{ background: i % 2 === 0 ? '#F8FAFC' : '#fff', borderBottom: '1px solid #E5E7EB' }}>
                <td style={{ padding: '5px 8px', fontFamily: 'monospace', fontSize: 10, color: NAVY, fontWeight: 700 }}>{p.code}</td>
                <td style={{ padding: '5px 8px', color: '#1E293B', maxWidth: 180 }}>
                  <div style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={p.nom}>{p.nom}</div>
                  <div style={{ fontSize: 9, color: '#94A3B8' }}>{p.unite ?? ''}</div>
                </td>
                <td style={{ padding: '5px 8px', textAlign: 'center', color: '#374151', fontSize: 9.5 }}>{phaseCurrent(p)}</td>
                <td style={{ padding: '5px 8px', textAlign: 'center', color: '#374151', fontWeight: 600 }}>{getQuarterlyPct(p.avancementPlanifie, trim)}%</td>
                <td style={{ padding: '5px 8px', textAlign: 'center', fontWeight: 700, color: ecart < -5 ? RED : ecart < 0 ? AMBER : GREEN }}>
                  {getQuarterlyPct(p.avancement, trim)}%
                </td>
                <td style={{ padding: '5px 8px', textAlign: 'center' }}>
                  <span style={{ fontWeight: 800, color: NAVY, fontSize: 11 }}>{avPondere.toFixed(2)}%</span>
                </td>
                <td style={{ padding: '5px 8px', textAlign: 'center' }}>
                  <span style={{ fontSize: 9, fontWeight: 700, color: statusColor, background: `${statusColor}18`, padding: '2px 6px', borderRadius: 4 }}>
                    {ecart < -5 ? '▼ Retard' : ecart < 0 ? '⚠ Écart' : '✓ OK'}
                  </span>
                </td>
                <td style={{ padding: '5px 8px', textAlign: 'right', fontWeight: 700, color: '#1E293B', fontFamily: 'monospace' }}>
                  {p.budget.toLocaleString('fr-FR')}
                </td>
              </tr>
            );
          })}
        </tbody>
        <tfoot>
          <tr style={{ background: `${NAVY}12`, borderTop: '2px solid #E5E7EB' }}>
            <td colSpan={7} style={{ padding: '6px 8px', fontWeight: 700, color: NAVY, fontSize: 11 }}>TOTAL</td>
            <td style={{ padding: '6px 8px', textAlign: 'right', fontWeight: 800, color: NAVY, fontFamily: 'monospace', fontSize: 11 }}>
              {projets.reduce((s, p) => s + p.budget, 0).toLocaleString('fr-FR')} MFCFA
            </td>
          </tr>
        </tfoot>
      </table>
    </div>
  );
}

/* ─── Phase weighting panel ── */
function PhasePanelMini({ projets }: { projets: ReturnType<typeof useProjectStore>['projets'] }) {
  if (projets.length === 0) return null;
  // Average phase advances across domain projects
  const avgPhases = PHASES_DEFAUT.map((ph, i) => {
    const avgs = projets.map(p => (p.phases ?? PHASES_DEFAUT)[i]?.avancement ?? 0);
    return { ...ph, avancement: Math.round(avgs.reduce((s, v) => s + v, 0) / avgs.length) };
  });
  const avReel = computeAvancementReel(avgPhases);
  const COLORS = ['#7C3AED','#1D4ED8','#0F766E','#B45309','#EF3340','#16A34A','#374151'];

  return (
    <div style={{ background: '#F8FAFC', border: '1px solid #E5E7EB', borderRadius: 6, padding: '10px 12px', marginTop: 8 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
        <span style={{ fontSize: 11, fontWeight: 700, color: '#374151' }}>Pondération (moy. domaine)</span>
        <span style={{ fontSize: 12, fontWeight: 800, color: NAVY }}>Av. réel pondéré : {avReel.toFixed(2)}%</span>
      </div>
      <div style={{ display: 'flex', gap: 6 }}>
        {avgPhases.map((ph, i) => (
          <div key={ph.id} style={{ flex: 1, textAlign: 'center' }}>
            <div style={{ fontSize: 8, fontWeight: 700, color: COLORS[i], marginBottom: 2, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{ph.label.split(' ')[0]}</div>
            <div style={{ fontSize: 8, color: '#94A3B8', marginBottom: 3 }}>{ph.poids}%</div>
            <div style={{ height: 40, background: '#E5E7EB', borderRadius: 3, position: 'relative', overflow: 'hidden' }}>
              <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, height: `${ph.avancement}%`, background: COLORS[i], borderRadius: 3 }} />
              <span style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 8, fontWeight: 700, color: ph.avancement > 50 ? '#fff' : COLORS[i] }}>
                {ph.avancement}%
              </span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ─── Domain section card ── */
function DomainSectionCard({
  dom, projets, trim, year,
}: {
  dom: typeof DOMAINES_RAPPORT[0];
  projets: ReturnType<typeof useProjectStore>['projets'];
  trim: Trimestre; year: number;
}) {
  const [expanded,    setExpanded]    = useState(true);
  const [activeTab,   setActiveTab]   = useState<'physique' | 'financier' | 'faits' | 'contraintes'>('physique');
  const [faitsMajeurs, setFaits]      = useState('');
  const [contraintes,  setContraintes] = useState('');
  const [generating,  setGenerating]  = useState(false);
  const [aiSection,   setAiSection]   = useState<'faits' | 'contraintes' | null>(null);

  const generateAI = useCallback(async (type: 'faits' | 'contraintes') => {
    setGenerating(true); setAiSection(type);
    await new Promise(r => setTimeout(r, 900));
    const text = generateAIText(dom.id, trim, year, type);
    if (type === 'faits') setFaits(text);
    else setContraintes(text);
    setGenerating(false); setAiSection(null);
  }, [dom.id, trim, year]);

  const tabStyle = (t: string): React.CSSProperties => ({
    padding: '4px 10px', border: 'none', fontSize: 10.5, fontWeight: 600, cursor: 'pointer', borderRadius: '4px 4px 0 0',
    background: activeTab === t ? '#fff' : '#F1F5F9', color: activeTab === t ? dom.color : '#64748B',
    borderBottom: activeTab === t ? `2px solid ${dom.color}` : '2px solid transparent',
  });

  return (
    <div style={{ background: '#fff', border: `1px solid #E5E7EB`, borderRadius: 8, overflow: 'hidden', marginBottom: 16, boxShadow: '0 1px 4px rgba(0,0,0,0.06)' }}>
      {/* Header */}
      <div style={{ padding: '10px 14px', background: `${dom.color}12`, borderBottom: '1px solid #E5E7EB', display: 'flex', alignItems: 'center', justifyContent: 'space-between', cursor: 'pointer' }}
        onClick={() => setExpanded(e => !e)}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{ width: 32, height: 32, borderRadius: 8, background: `${dom.color}22`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16 }}>
            {dom.emoji}
          </div>
          <div>
            <div style={{ fontSize: 13, fontWeight: 800, color: dom.color }}>{dom.label}</div>
            <div style={{ fontSize: 10, color: '#64748B' }}>Unités : {dom.unites.join(', ')} · {projets.length} projet(s)</div>
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          {projets.length > 0 && (
            <div style={{ display: 'flex', gap: 6 }}>
              <span style={{ fontSize: 10, padding: '2px 8px', borderRadius: 4, background: `${dom.color}18`, color: dom.color, fontWeight: 700 }}>
                Budget : {projets.reduce((s, p) => s + p.budget, 0).toLocaleString('fr-FR')} MFCFA
              </span>
              <span style={{ fontSize: 10, padding: '2px 8px', borderRadius: 4, background: '#F0FDF4', color: GREEN, fontWeight: 700 }}>
                Av. moy : {Math.round(projets.reduce((s, p) => s + p.avancement, 0) / projets.length)}%
              </span>
            </div>
          )}
          {expanded ? <ChevronUp size={16} color="#64748B" /> : <ChevronDown size={16} color="#64748B" />}
        </div>
      </div>

      {expanded && (
        <div style={{ padding: '12px 14px' }}>
          {/* Sub-tabs */}
          <div style={{ display: 'flex', gap: 0, marginBottom: 12, borderBottom: '1px solid #E5E7EB' }}>
            {([['physique', '📊 Situation physique'], ['financier', '💰 Situation financière'], ['faits', '📌 Faits majeurs'], ['contraintes', '⚠️ Contraintes & Plan d\'actions']] as const).map(([t, label]) => (
              <button key={t} style={tabStyle(t)} onClick={() => setActiveTab(t)}>{label}</button>
            ))}
          </div>

          {activeTab === 'physique' && (
            <>
              <PhysicalTable projets={projets} trim={trim} />
              <PhasePanelMini projets={projets} />
            </>
          )}

          {activeTab === 'financier' && (
            <FinancialTable projets={projets} trim={trim} year={year} />
          )}

          {(activeTab === 'faits' || activeTab === 'contraintes') && (
            <div>
              <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 8, gap: 6 }}>
                <button
                  onClick={() => generateAI(activeTab)}
                  disabled={generating}
                  style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '5px 12px', background: NAVY, color: '#fff', border: 'none', borderRadius: 5, fontSize: 10.5, fontWeight: 700, cursor: generating ? 'wait' : 'pointer', opacity: generating ? 0.7 : 1 }}>
                  <Bot size={12} /> {generating && aiSection === activeTab ? 'Génération IA...' : '✨ Générer via IA'}
                </button>
              </div>
              <textarea
                value={activeTab === 'faits' ? faitsMajeurs : contraintes}
                onChange={e => activeTab === 'faits' ? setFaits(e.target.value) : setContraintes(e.target.value)}
                placeholder={activeTab === 'faits'
                  ? 'Décrivez les faits majeurs du trimestre pour ce domaine (ou cliquez sur Générer via IA)...'
                  : 'Décrivez les contraintes et le plan d\'actions (ou cliquez sur Générer via IA)...'
                }
                style={{ width: '100%', boxSizing: 'border-box', minHeight: 140, border: '1px solid #D1D5DB', borderRadius: 6, padding: '10px', fontSize: 12, lineHeight: 1.6, color: '#374151', fontFamily: 'inherit', resize: 'vertical', outline: 'none' }}
              />
              {(activeTab === 'faits' ? faitsMajeurs : contraintes) && (
                <div style={{ marginTop: 6, fontSize: 10, color: '#94A3B8', textAlign: 'right' }}>
                  {(activeTab === 'faits' ? faitsMajeurs : contraintes).length} caractères · <span style={{ color: GREEN }}>✓ Contenu prêt</span>
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

/* ═══════════════════════════════════════════════════
   RAPPORT TRIMESTRIEL MAIN VIEW
═══════════════════════════════════════════════════ */
function RapportTrimestriel() {
  const store = useProjectStore();
  const [trim,   setTrim]   = useState<Trimestre>('T1');
  const [year,   setYear]   = useState(2026);
  const [filter, setFilter] = useState<Domaine | 'all'>('all');
  const [showPreview, setShowPreview] = useState(false);

  const domainesWithProjets = useMemo(() =>
    DOMAINES_RAPPORT.map(d => ({
      ...d,
      projets: store.projets.filter(p => p.domaine === d.id),
    })).filter(d => filter === 'all' || d.id === filter),
  // eslint-disable-next-line react-hooks/exhaustive-deps
  [store.projets, filter]);

  const totalBudget   = store.projets.reduce((s, p) => s + p.budget, 0);
  const totalDecaisse = store.projets.reduce((s, p) => s + p.budgetDecaisse, 0);
  const avgAv         = store.projets.length > 0 ? Math.round(store.projets.reduce((s, p) => s + p.avancement, 0) / store.projets.length) : 0;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', background: '#F8FAFD' }}>
      {/* Header */}
      <div style={{ padding: '12px 20px', background: `linear-gradient(135deg, ${NAVY} 0%, #2D1167 100%)`, flexShrink: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div>
            <div style={{ fontSize: 16, fontWeight: 800, color: '#fff', display: 'flex', alignItems: 'center', gap: 8 }}>
              <Layers size={18} color="#C4B5FD" />
              Rapport Global Trimestriel — {trim} {year}
            </div>
            <div style={{ fontSize: 11, color: '#C4B5FD', marginTop: 2 }}>
              Direction Principale Équipement · SENELEC · Portefeuille {store.projets.length} projets
            </div>
          </div>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            {/* Quarter selector */}
            <div style={{ display: 'flex', background: 'rgba(255,255,255,0.12)', borderRadius: 6, overflow: 'hidden' }}>
              {TRIMESTRES.map(t => (
                <button key={t} onClick={() => setTrim(t)}
                  style={{ padding: '5px 12px', border: 'none', background: trim === t ? 'rgba(255,255,255,0.25)' : 'transparent', color: '#fff', fontWeight: trim === t ? 800 : 500, fontSize: 12, cursor: 'pointer' }}>{t}</button>
              ))}
            </div>
            {/* Year selector */}
            <select value={year} onChange={e => setYear(Number(e.target.value))}
              style={{ padding: '5px 8px', background: 'rgba(255,255,255,0.12)', border: '1px solid rgba(255,255,255,0.3)', borderRadius: 5, color: '#fff', fontSize: 12, cursor: 'pointer', outline: 'none' }}>
              {[2024, 2025, 2026, 2027].map(y => <option key={y} value={y} style={{ color: '#1e293b', background: '#fff' }}>{y}</option>)}
            </select>
            <button onClick={() => setShowPreview(v => !v)}
              style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '5px 12px', background: 'rgba(255,255,255,0.15)', border: '1px solid rgba(255,255,255,0.3)', borderRadius: 5, color: '#fff', fontSize: 11, fontWeight: 700, cursor: 'pointer' }}>
              <Eye size={13} /> {showPreview ? 'Édition' : 'Aperçu Word'}
            </button>
            <button onClick={() => toast.info('Export Word / PDF du rapport trimestriel — fonctionnalité à venir.')} style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '5px 12px', background: ORANGE, border: 'none', borderRadius: 5, color: '#fff', fontSize: 11, fontWeight: 700, cursor: 'pointer' }}>
              <Download size={13} /> Exporter Word / PDF
            </button>
          </div>
        </div>

        {/* KPI bar */}
        <div style={{ display: 'flex', gap: 12, marginTop: 10 }}>
          {[
            { label: 'Projets', value: store.projets.length, unit: '', color: '#A78BFA' },
            { label: 'Budget total', value: (totalBudget / 1000).toFixed(1), unit: 'GMFCFA', color: '#FCD34D' },
            { label: 'Décaissé cumul', value: (totalDecaisse / 1000).toFixed(1), unit: 'GMFCFA', color: '#6EE7B7' },
            { label: 'Av. moy. physique', value: avgAv, unit: '%', color: '#93C5FD' },
            { label: 'Taux exécution fin.', value: Math.round((totalDecaisse / Math.max(totalBudget, 1)) * 100), unit: '%', color: '#FCA5A5' },
          ].map(k => (
            <div key={k.label} style={{ background: 'rgba(255,255,255,0.1)', borderRadius: 6, padding: '6px 12px', minWidth: 80, textAlign: 'center' }}>
              <div style={{ fontSize: 16, fontWeight: 800, color: k.color }}>{k.value}<span style={{ fontSize: 10, fontWeight: 600 }}> {k.unit}</span></div>
              <div style={{ fontSize: 9, color: 'rgba(255,255,255,0.6)', marginTop: 1 }}>{k.label}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Domain filter */}
      <div style={{ padding: '8px 20px', background: '#fff', borderBottom: '1px solid #E5E7EB', display: 'flex', gap: 6, alignItems: 'center', flexShrink: 0 }}>
        <span style={{ fontSize: 10.5, fontWeight: 700, color: '#64748B' }}>Domaine :</span>
        {[{ id: 'all', label: 'Tous', color: NAVY }, ...DOMAINES_RAPPORT].map(d => (
          <button key={d.id} onClick={() => setFilter(d.id as Domaine | 'all')}
            style={{ padding: '3px 10px', borderRadius: 20, border: `1px solid ${filter === d.id ? ('color' in d ? d.color : NAVY) : '#E5E7EB'}`, background: filter === d.id ? (('color' in d ? d.color : NAVY) + '15') : '#fff', color: filter === d.id ? ('color' in d ? d.color : NAVY) : '#64748B', fontSize: 10.5, fontWeight: filter === d.id ? 700 : 400, cursor: 'pointer' }}>
            {'emoji' in d ? `${d.emoji} ` : ''}{d.label}
          </button>
        ))}
      </div>

      {/* Content */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '16px 20px' }}>
        {showPreview ? (
          /* ── Word/PDF Preview ── */
          <div style={{ maxWidth: 794, margin: '0 auto', background: '#fff', boxShadow: '0 4px 32px rgba(0,0,0,0.12)', borderRadius: 4, padding: '48px 56px', minHeight: 1000 }}>
            {/* Cover */}
            <div style={{ borderBottom: `4px solid ${NAVY}`, paddingBottom: 24, marginBottom: 32 }}>
              <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
                <div>
                  <div style={{ fontSize: 11, fontWeight: 700, color: ORANGE, textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 6 }}>SENELEC — Direction Principale Équipement</div>
                  <div style={{ fontSize: 26, fontWeight: 900, color: NAVY, marginBottom: 4 }}>Rapport Global {trim} {year}</div>
                  <div style={{ fontSize: 13, color: '#64748B' }}>Portefeuille de projets DPE · {store.projets.length} projets · {DOMAINES_RAPPORT.length} domaines</div>
                </div>
                <div style={{ textAlign: 'right', fontSize: 11, color: '#94A3B8' }}>
                  <div>Généré le {new Date().toLocaleDateString('fr-FR')}</div>
                  <div>SIGEPP-DPE V1.0</div>
                  <div style={{ color: RED, fontWeight: 700, marginTop: 4 }}>CONFIDENTIEL</div>
                </div>
              </div>
            </div>
            {/* KPI Summary */}
            <div style={{ marginBottom: 28 }}>
              <div style={{ fontSize: 15, fontWeight: 800, color: NAVY, marginBottom: 12 }}>I. Synthèse du Portefeuille</div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 10, marginBottom: 14 }}>
                {[
                  { label: 'Projets', value: `${store.projets.length}`, color: NAVY },
                  { label: 'Budget portefeuille', value: `${(totalBudget / 1000).toFixed(1)} GMFCFA`, color: '#374151' },
                  { label: 'Av. physique moyen', value: `${avgAv}%`, color: avgAv >= 50 ? GREEN : AMBER },
                  { label: 'Tx exécution financière', value: `${Math.round((totalDecaisse / Math.max(totalBudget, 1)) * 100)}%`, color: NAVY },
                ].map(k => (
                  <div key={k.label} style={{ border: `1px solid #E5E7EB`, borderRadius: 6, padding: '10px', textAlign: 'center' }}>
                    <div style={{ fontSize: 18, fontWeight: 800, color: k.color }}>{k.value}</div>
                    <div style={{ fontSize: 9.5, color: '#64748B', marginTop: 2 }}>{k.label}</div>
                  </div>
                ))}
              </div>
            </div>
            {/* Domain sections */}
            {DOMAINES_RAPPORT.map((dom, i) => {
              const domProjets = store.projets.filter(p => p.domaine === dom.id);
              if (domProjets.length === 0) return null;
              return (
                <div key={dom.id} style={{ marginBottom: 28 }}>
                  <div style={{ fontSize: 15, fontWeight: 800, color: dom.color, marginBottom: 10, display: 'flex', alignItems: 'center', gap: 6 }}>
                    <span>{String.fromCharCode(73, 73) + (i > 0 ? '.'.repeat(0) : '')}{i + 1 + 1}.</span> {dom.emoji} {dom.label}
                  </div>
                  <div style={{ fontSize: 11, fontWeight: 700, color: '#374151', marginBottom: 6 }}>a) Situation financière {trim} {year}</div>
                  <FinancialTable projets={domProjets} trim={trim} year={year} />
                  <div style={{ fontSize: 11, fontWeight: 700, color: '#374151', margin: '10px 0 6px' }}>b) Situation physique — Avancement physique pondéré</div>
                  <PhysicalTable projets={domProjets} trim={trim} />
                </div>
              );
            })}
            <div style={{ borderTop: '1px solid #E5E7EB', marginTop: 40, paddingTop: 14, display: 'flex', justifyContent: 'space-between', fontSize: 10, color: '#94A3B8' }}>
              <span>SIGEPP-DPE · Direction Principale Équipement SENELEC</span>
              <span>Rapport {trim} {year} · Confidentiel</span>
            </div>
          </div>
        ) : (
          /* ── Domain cards (edit mode) ── */
          domainesWithProjets.length === 0 ? (
            <div style={{ textAlign: 'center', padding: 48, color: '#94A3B8', fontSize: 14 }}>
              Aucun projet trouvé pour ce domaine
            </div>
          ) : (
            domainesWithProjets.map(dom => (
              <DomainSectionCard key={dom.id} dom={dom} projets={dom.projets} trim={trim} year={year} />
            ))
          )
        )}
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════
   COMPOSANT PRINCIPAL — StudioRapports
═══════════════════════════════════════════════════ */
export default function StudioRapports() {
  const store = useProjectStore();
  const [mainTab, setMainTab] = useState<'studio' | 'trimestriel'>('studio');

  // Studio state
  const [selectedProjet, setSelectedProjet] = useState<string>(store.projets[0]?.id ?? '');
  const [sections, setSections] = useState<Section[]>([
    { id: uid(), type: 'synthese',  label: 'Synthèse exécutive',  active: true },
    { id: uid(), type: 'planning',  label: 'Planning & Jalons',   active: true },
    { id: uid(), type: 'risques',   label: 'Risques & QHSE',      active: true },
    { id: uid(), type: 'finances',  label: 'Budget & Finances',   active: true },
  ]);
  const [titreRapport, setTitreRapport]     = useState('Rapport mensuel — Projet');
  const [activeView, setActiveView]         = useState<'editeur' | 'preview'>('editeur');
  const [selectedModele, setSelectedModele] = useState<string | null>(null);
  const [catalogSearch, setCatalogSearch]   = useState('');

  const projet = useMemo(
    () => store.projets.find(p => p.id === selectedProjet) ?? store.projets[0],
    [selectedProjet, store.projets]
  );

  const addSection    = (type: SectionType) => { const cat = CATALOGUE.find(c => c.type === type); if (!cat) return; setSections(prev => [...prev, { id: uid(), type, label: cat.label, active: true }]); };
  const removeSection = (id: string)         => setSections(prev => prev.filter(s => s.id !== id));
  const moveSection   = (id: string, dir: 'up' | 'down') => {
    setSections(prev => {
      const idx = prev.findIndex(s => s.id === id); if (idx < 0) return prev;
      const newArr = [...prev]; const sw = dir === 'up' ? idx - 1 : idx + 1;
      if (sw < 0 || sw >= newArr.length) return prev;
      [newArr[idx], newArr[sw]] = [newArr[sw], newArr[idx]];
      return newArr;
    });
  };
  const loadModele = (mid: string) => {
    const m = MODELES.find(x => x.id === mid); if (!m) return;
    setSections(m.sections.map(t => { const cat = CATALOGUE.find(c => c.type === t); return { id: uid(), type: t, label: cat?.label ?? t, active: true }; }));
    setTitreRapport(m.label); setSelectedModele(mid);
  };

  const dcfg = projet ? DOMAINE_CFG[projet.domaine as Domaine] : null;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', background: '#F8FAFD' }}>

      {/* ─── Main Tab Bar ─── */}
      <div style={{ display: 'flex', background: '#fff', borderBottom: '1px solid #E2E8F0', padding: '0 20px', flexShrink: 0 }}>
        {[
          { id: 'studio',       label: '🎨 Studio de Rapports',      desc: 'Rapport projet composable' },
          { id: 'trimestriel',  label: '📋 Rapport Trimestriel',      desc: 'Par domaine · Format DPE' },
        ].map(tab => (
          <button key={tab.id} onClick={() => setMainTab(tab.id as typeof mainTab)}
            style={{ padding: '12px 20px', border: 'none', background: 'transparent', borderBottom: `3px solid ${mainTab === tab.id ? NAVY : 'transparent'}`, color: mainTab === tab.id ? NAVY : '#64748B', fontWeight: mainTab === tab.id ? 700 : 400, fontSize: 12.5, cursor: 'pointer', fontFamily: 'inherit', transition: 'all 0.15s', display: 'flex', flexDirection: 'column', alignItems: 'flex-start' }}>
            {tab.label}
            <span style={{ fontSize: 9, color: '#94A3B8', fontWeight: 400, marginTop: 1 }}>{tab.desc}</span>
          </button>
        ))}
      </div>

      {/* ─── Tab Content ─── */}
      {mainTab === 'trimestriel' ? (
        <RapportTrimestriel />
      ) : (

      /* ─── STUDIO TAB ─── */
      <>
        {/* Studio Header */}
        <div style={{ padding: '14px 24px 0', background: '#fff', borderBottom: '1px solid #E2E8F0', flexShrink: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <PenTool size={22} style={{ color: NAVY }} />
              <div>
                <input value={titreRapport} onChange={e => setTitreRapport(e.target.value)}
                  style={{ fontSize: 18, fontWeight: 800, color: '#0F172A', border: 'none', outline: 'none', background: 'transparent', fontFamily: 'inherit', width: 400 }} />
                <div style={{ fontSize: 12, color: '#94A3B8', marginTop: 1 }}>Studio de rapports composables · Sections libres · Export PDF / Excel / API</div>
              </div>
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              <button onClick={() => setActiveView(activeView === 'editeur' ? 'preview' : 'editeur')}
                style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '7px 12px', borderRadius: 7, border: '1px solid #E2E8F0', background: activeView === 'preview' ? '#EFF6FF' : '#fff', fontSize: 12.5, color: activeView === 'preview' ? NAVY : '#475569', cursor: 'pointer', fontFamily: 'inherit', fontWeight: activeView === 'preview' ? 700 : 400 }}>
                <Eye size={13} /> {activeView === 'editeur' ? 'Prévisualiser' : 'Éditeur'}
              </button>
              <button onClick={() => toast.info('Enregistrement du rapport — fonctionnalité à venir.')} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '7px 12px', borderRadius: 7, border: '1px solid #E2E8F0', background: '#fff', fontSize: 12.5, color: '#475569', cursor: 'pointer', fontFamily: 'inherit' }}><Save size={13} /> Enregistrer</button>
              <button onClick={() => toast.info('Export PDF — utilisez le bouton ✨ Générer Rapport Complet dans le panneau droit.')} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '7px 14px', borderRadius: 7, border: 'none', background: ORANGE, color: '#fff', fontSize: 12.5, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' }}><Download size={13} /> Exporter PDF</button>
            </div>
          </div>
          <div style={{ display: 'flex', gap: 12, alignItems: 'center', paddingBottom: 12 }}>
            <select value={selectedProjet} onChange={e => setSelectedProjet(e.target.value)}
              style={{ padding: '7px 10px', borderRadius: 7, border: '1px solid #E2E8F0', background: '#fff', fontSize: 12.5, cursor: 'pointer', fontFamily: 'inherit', color: '#1E293B' }}>
              {store.projets.map(p => <option key={p.id} value={p.id}>{p.code} — {p.nom.slice(0, 40)}</option>)}
            </select>
            <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
              <span style={{ fontSize: 11.5, color: '#94A3B8' }}>Modèles :</span>
              {MODELES.map(m => (
                <button key={m.id} onClick={() => loadModele(m.id)}
                  style={{ padding: '4px 10px', borderRadius: 6, cursor: 'pointer', fontFamily: 'inherit', fontSize: 11.5, fontWeight: selectedModele === m.id ? 700 : 400, border: `1px solid ${selectedModele === m.id ? NAVY : '#E2E8F0'}`, background: selectedModele === m.id ? '#EFF6FF' : '#fff', color: selectedModele === m.id ? NAVY : '#64748B' }}>
                  {m.label}
                </button>
              ))}
            </div>
          </div>
        </div>

        {activeView === 'editeur' ? (
          <div style={{ flex: 1, display: 'grid', gridTemplateColumns: '260px 1fr 260px', gap: 0, overflow: 'hidden' }}>
            {/* Left panel */}
            <div style={{ background: '#fff', borderRight: '1px solid #E2E8F0', overflowY: 'auto', padding: '16px' }}>
              <div style={{ fontSize: 11.5, fontWeight: 700, color: '#94A3B8', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 8 }}>Sections disponibles</div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 5, marginBottom: 10, padding: '5px 8px', borderRadius: 7, border: '1px solid #E2E8F0', background: '#FAFBFC' }}>
                <Search size={12} style={{ color: '#94A3B8', flexShrink: 0 }} />
                <input
                  value={catalogSearch} onChange={e => setCatalogSearch(e.target.value)}
                  placeholder="Filtrer les sections…"
                  style={{ flex: 1, border: 'none', background: 'transparent', fontSize: 12, color: '#334155', outline: 'none' }}
                />
                {catalogSearch && (
                  <button onClick={() => setCatalogSearch('')} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 1, color: '#94A3B8', display: 'flex', alignItems: 'center' }}><X size={11} /></button>
                )}
              </div>
              {CATALOGUE.filter(cat => !catalogSearch.trim() || cat.label.toLowerCase().includes(catalogSearch.toLowerCase()) || cat.desc.toLowerCase().includes(catalogSearch.toLowerCase())).map(cat => {
                const added = sections.some(s => s.type === cat.type);
                return (
                  <div key={cat.type} style={{ display: 'flex', alignItems: 'flex-start', gap: 10, padding: '10px', borderRadius: 8, marginBottom: 6, border: '1px solid #E2E8F0', background: added ? '#F8FAFC' : '#fff', opacity: added ? 0.6 : 1, cursor: added ? 'default' : 'pointer' }}
                    onClick={() => { if (!added) addSection(cat.type); }}>
                    <div style={{ width: 30, height: 30, borderRadius: 7, flexShrink: 0, background: `${cat.color}18`, display: 'flex', alignItems: 'center', justifyContent: 'center', color: cat.color }}>{cat.icon}</div>
                    <div>
                      <div style={{ fontSize: 12.5, fontWeight: 600, color: '#1E293B' }}>{cat.label}</div>
                      <div style={{ fontSize: 10.5, color: '#94A3B8', marginTop: 2 }}>{cat.desc}</div>
                    </div>
                    {!added && <Plus size={14} style={{ color: '#94A3B8', marginLeft: 'auto', flexShrink: 0 }} />}
                  </div>
                );
              })}
            </div>

            {/* Center */}
            <div style={{ overflowY: 'auto', padding: '16px 20px', background: '#F8FAFD' }}>
              <div style={{ fontSize: 13, fontWeight: 700, color: '#0F172A', marginBottom: 14 }}>
                Sections du rapport <span style={{ fontSize: 11, fontWeight: 400, color: '#94A3B8', marginLeft: 8 }}>({sections.length} sections)</span>
              </div>
              {sections.length === 0 && (
                <div style={{ padding: 48, textAlign: 'center', background: '#fff', borderRadius: 10, border: '2px dashed #CBD5E1' }}>
                  <PenTool size={32} style={{ color: '#CBD5E1', margin: '0 auto 12px' }} />
                  <div style={{ fontSize: 14, color: '#94A3B8' }}>Ajoutez des sections ou chargez un modèle</div>
                </div>
              )}
              {sections.map((sec, i) => {
                const cat = CATALOGUE.find(c => c.type === sec.type);
                return (
                  <div key={sec.id} style={{ background: '#fff', borderRadius: 10, border: '1px solid #E2E8F0', marginBottom: 10, overflow: 'hidden', boxShadow: '0 1px 4px rgba(0,0,0,0.05)' }}>
                    <div style={{ padding: '11px 14px', display: 'flex', alignItems: 'center', gap: 10, borderBottom: '1px solid #F1F5F9', background: `${cat?.color ?? NAVY}08` }}>
                      <div style={{ color: cat?.color ?? NAVY }}>{cat?.icon}</div>
                      <div style={{ flex: 1 }}>
                        <div style={{ fontSize: 13, fontWeight: 700, color: '#1E293B' }}>{i + 1}. {sec.label}</div>
                        <div style={{ fontSize: 10.5, color: '#94A3B8' }}>{cat?.desc}</div>
                      </div>
                      <div style={{ display: 'flex', gap: 4 }}>
                        <button onClick={() => moveSection(sec.id, 'up')} disabled={i === 0} aria-label="Monter la section" style={{ width: 26, height: 26, borderRadius: 5, border: 'none', background: i === 0 ? '#F1F5F9' : '#EFF6FF', cursor: i === 0 ? 'not-allowed' : 'pointer', opacity: i === 0 ? 0.5 : 1, display: 'flex', alignItems: 'center', justifyContent: 'center', color: i === 0 ? '#CBD5E1' : NAVY }}><ArrowUp size={12} /></button>
                        <button onClick={() => moveSection(sec.id, 'down')} disabled={i === sections.length - 1} aria-label="Descendre la section" style={{ width: 26, height: 26, borderRadius: 5, border: 'none', background: i === sections.length - 1 ? '#F1F5F9' : '#EFF6FF', cursor: i === sections.length - 1 ? 'not-allowed' : 'pointer', opacity: i === sections.length - 1 ? 0.5 : 1, display: 'flex', alignItems: 'center', justifyContent: 'center', color: i === sections.length - 1 ? '#CBD5E1' : NAVY }}><ArrowDown size={12} /></button>
                        <button onClick={() => removeSection(sec.id)} aria-label="Supprimer la section" style={{ width: 26, height: 26, borderRadius: 5, border: 'none', background: '#FEE2E2', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: RED }}><Trash2 size={12} /></button>
                      </div>
                    </div>
                    <div style={{ padding: '12px 14px', fontSize: 12, color: '#94A3B8', fontStyle: 'italic' }}>
                      {sec.type === 'synthese'   && projet && `${projet.code} · Av. ${projet.avancement}% · CPI ${projet.cpi.toFixed(2)} · SPI ${projet.spi.toFixed(2)}`}
                      {sec.type === 'finances'   && projet && `Budget : ${projet.budget.toLocaleString('fr-FR')} MFCFA · Décaissé : ${projet.budgetDecaisse.toLocaleString('fr-FR')} MFCFA`}
                      {sec.type !== 'synthese' && sec.type !== 'finances' && cat?.desc}
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Right panel */}
            <div style={{ background: '#fff', borderLeft: '1px solid #E2E8F0', overflowY: 'auto', padding: '16px' }}>
              <div style={{ fontSize: 11.5, fontWeight: 700, color: '#94A3B8', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 12 }}>Paramètres export</div>
              {projet && dcfg && (
                <div style={{ padding: '12px', borderRadius: 8, border: '1px solid #E2E8F0', background: `${dcfg.color}08`, marginBottom: 14 }}>
                  <div style={{ fontSize: 12, fontWeight: 700, color: '#1E293B', marginBottom: 4 }}>{dcfg.emoji} {projet.code}</div>
                  <div style={{ fontSize: 11, color: '#64748B' }}>{projet.nom.slice(0, 50)}</div>
                  <div style={{ fontSize: 11, color: '#94A3B8', marginTop: 4 }}>{dcfg.label} · {projet.avancement}% · CPI {projet.cpi.toFixed(2)}</div>
                </div>
              )}
              <button
                onClick={() => {
                  const pw = window.open('', '_blank');
                  if (!pw || !projet) return;
                  const phaseRows = (projet.phases ?? PHASES_DEFAUT).map((ph, i) =>
                    `<tr style="background:${i%2===0?'#f8fafc':'#fff'}"><td style="padding:5px 10px">${ph.label}</td><td style="padding:5px 10px;text-align:center">${ph.poids}%</td><td style="padding:5px 10px;text-align:center">${ph.avancement}%</td><td style="padding:5px 10px;text-align:center">${((ph.poids*ph.avancement)/100).toFixed(2)}%</td><td style="padding:5px 10px;text-align:center">${ph.avancement===100?'✅ Terminé':ph.avancement>0?'🔄 En cours':'⏳ Non démarré'}</td></tr>`
                  ).join('');
                  const ev = (projet.avancement / 100) * projet.budget;
                  const ac = projet.budgetDecaisse;
                  const pv = (projet.avancementPlanifie / 100) * projet.budget;
                  const eac = projet.cpi > 0 ? Math.round(projet.budget / projet.cpi) : projet.budget;
                  pw.document.write(`<!DOCTYPE html><html lang="fr"><head><meta charset="UTF-8"><title>${titreRapport}</title>
<style>
  @page { margin: 2cm; }
  body { font-family: 'Segoe UI', Arial, sans-serif; margin: 0; color: #1E293B; font-size: 12px; }
  .cover { border-bottom: 5px solid #3D1A6B; padding-bottom: 24px; margin-bottom: 32px; display: flex; justify-content: space-between; align-items: flex-start; }
  .cover-logo { display: flex; align-items: center; gap: 12px; }
  .logo-shape { width: 72px; height: 58px; display: flex; align-items: center; justify-content: center; }
  .logo-shape img { width: 72px; height: auto; max-height: 58px; object-fit: contain; display: block; }
  h1 { color: #3D1A6B; margin: 0 0 4px; font-size: 22px; }
  h2 { color: #3D1A6B; font-size: 15px; border-left: 4px solid #F47920; padding-left: 10px; margin: 28px 0 12px; }
  h3 { color: #374151; font-size: 13px; margin: 16px 0 8px; }
  table { border-collapse: collapse; width: 100%; margin-bottom: 16px; }
  th { background: #3D1A6B; color: white; padding: 7px 10px; text-align: left; font-size: 11px; }
  td { padding: 5px 10px; border-bottom: 1px solid #E5E7EB; font-size: 11px; }
  .kpi-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 12px; margin: 16px 0; }
  .kpi-box { border: 2px solid #E2E8F0; border-radius: 8px; padding: 12px; text-align: center; }
  .kpi-val { font-size: 22px; font-weight: 900; color: #3D1A6B; }
  .kpi-lbl { font-size: 10px; color: #64748B; margin-top: 3px; }
  .badge-ok { background: #DCFCE7; color: #16A34A; padding: 2px 8px; border-radius: 4px; font-weight: 700; font-size: 10px; }
  .badge-warn { background: #FEF3C7; color: #D97706; padding: 2px 8px; border-radius: 4px; font-weight: 700; font-size: 10px; }
  .badge-err { background: #FEE2E2; color: #DC2626; padding: 2px 8px; border-radius: 4px; font-weight: 700; font-size: 10px; }
  .note { background: #FFF7ED; border: 1px solid #FED7AA; border-radius: 6px; padding: 10px 14px; font-size: 11px; color: #92400E; margin: 8px 0; }
  .footer { margin-top: 40px; border-top: 1px solid #E2E8F0; padding-top: 12px; display: flex; justify-content: space-between; font-size: 10px; color: #94A3B8; }
  @media print { .no-print { display: none; } }
</style></head><body>

<div class="cover">
  <div class="cover-logo">
    <div class="logo-shape"><img src="${SENELEC_LOGO_DATA_URI}" alt="SENELEC" /></div>
    <div>
      <h1>${titreRapport}</h1>
      <div style="color:#64748B;font-size:12px">Direction Principale Équipement · SENELEC</div>
      <div style="color:#94A3B8;font-size:11px;margin-top:4px">SIGEPP-DPE · Généré le ${new Date().toLocaleDateString('fr-FR')} · Confidentiel</div>
    </div>
  </div>
  <div style="text-align:right;font-size:11px;color:#94A3B8">
    <div>Projet : <strong>${projet.code}</strong></div>
    <div>${projet.nom.slice(0,50)}</div>
    <div style="margin-top:6px;color:#EF3340;font-weight:700">DOCUMENT CONFIDENTIEL</div>
  </div>
</div>

<h2>I. Synthèse Exécutive</h2>
<div class="kpi-grid">
  <div class="kpi-box"><div class="kpi-val">${projet.avancement}%</div><div class="kpi-lbl">Avancement physique</div></div>
  <div class="kpi-box"><div class="kpi-val">${computeAvancementReel(projet.phases ?? PHASES_DEFAUT).toFixed(2)}%</div><div class="kpi-lbl">Av. physique pondéré</div></div>
  <div class="kpi-box"><div class="kpi-val">${projet.cpi.toFixed(2)}</div><div class="kpi-lbl">CPI (performance coût)</div></div>
  <div class="kpi-box"><div class="kpi-val">${projet.spi.toFixed(2)}</div><div class="kpi-lbl">SPI (performance délai)</div></div>
</div>
<table>
  <tr><th>Indicateur</th><th>Valeur</th><th>Statut</th></tr>
  <tr><td>Code projet</td><td>${projet.code}</td><td></td></tr>
  <tr style="background:#f8fafc"><td>Intitulé</td><td>${projet.nom}</td><td></td></tr>
  <tr><td>Bailleur</td><td>${projet.bailleurs?.[0]?.nom ?? 'SENELEC'}</td><td></td></tr>
  <tr style="background:#f8fafc"><td>Avancement physique</td><td>${projet.avancement}%</td><td>${projet.avancement >= projet.avancementPlanifie ? '<span class="badge-ok">✅ OK</span>' : '<span class="badge-warn">⚠ Écart</span>'}</td></tr>
  <tr><td>Avancement planifié</td><td>${projet.avancementPlanifie}%</td><td></td></tr>
  <tr style="background:#f8fafc"><td>Budget total (BAC)</td><td>${projet.budget.toLocaleString('fr-FR')} MFCFA</td><td></td></tr>
  <tr><td>Décaissements cumulés</td><td>${projet.budgetDecaisse.toLocaleString('fr-FR')} MFCFA</td><td>${((projet.budgetDecaisse/Math.max(projet.budget,1))*100).toFixed(1)}%</td></tr>
</table>

<h2>II. Planning & Pondération des phases</h2>
<table>
  <tr><th>Phase</th><th>Poids (%)</th><th>Avancement réel (%)</th><th>Contribution pondérée</th><th>Statut</th></tr>
  ${phaseRows}
  <tr style="background:#EEF2FF;font-weight:700"><td>TOTAL</td><td>100%</td><td>${Math.round((projet.phases ?? PHASES_DEFAUT).reduce((s,ph)=>s+ph.avancement,0)/(projet.phases ?? PHASES_DEFAUT).length)}%</td><td>${computeAvancementReel(projet.phases ?? PHASES_DEFAUT).toFixed(2)}%</td><td></td></tr>
</table>

<h2>III. Analyse Financière — EVM (Earned Value Management)</h2>
<table>
  <tr><th>Indicateur</th><th>Valeur (MFCFA)</th><th>%</th><th>Interprétation</th></tr>
  <tr><td>Budget à l'achèvement (BAC)</td><td>${projet.budget.toLocaleString('fr-FR')}</td><td>100%</td><td>Budget total contractuel</td></tr>
  <tr style="background:#f8fafc"><td>Valeur planifiée (PV)</td><td>${Math.round(pv).toLocaleString('fr-FR')}</td><td>${projet.avancementPlanifie}%</td><td>Travaux prévus à date</td></tr>
  <tr><td>Valeur acquise (EV)</td><td>${Math.round(ev).toLocaleString('fr-FR')}</td><td>${projet.avancement}%</td><td>Travaux réellement exécutés</td></tr>
  <tr style="background:#f8fafc"><td>Coût réel (AC)</td><td>${ac.toLocaleString('fr-FR')}</td><td>${((ac/Math.max(projet.budget,1))*100).toFixed(1)}%</td><td>Dépenses effectives</td></tr>
  <tr><td>Variation coût (CV = EV-AC)</td><td>${Math.round(ev-ac).toLocaleString('fr-FR')}</td><td></td><td>${ev>=ac?'<span class="badge-ok">Sous budget</span>':'<span class="badge-err">Dépassement</span>'}</td></tr>
  <tr style="background:#f8fafc"><td>Variation délai (SV = EV-PV)</td><td>${Math.round(ev-pv).toLocaleString('fr-FR')}</td><td></td><td>${ev>=pv?'<span class="badge-ok">En avance</span>':'<span class="badge-warn">Retard</span>'}</td></tr>
  <tr><td>CPI</td><td>${projet.cpi.toFixed(3)}</td><td></td><td>${projet.cpi>=1?'<span class="badge-ok">✅ Bon</span>':'<span class="badge-warn">⚠ Surveiller</span>'}</td></tr>
  <tr style="background:#f8fafc"><td>SPI</td><td>${projet.spi.toFixed(3)}</td><td></td><td>${projet.spi>=1?'<span class="badge-ok">✅ Bon</span>':'<span class="badge-warn">⚠ Retard</span>'}</td></tr>
  <tr><td>Coût final estimé (EAC)</td><td>${eac.toLocaleString('fr-FR')}</td><td>${((eac/Math.max(projet.budget,1))*100).toFixed(1)}%</td><td>${eac<=projet.budget?'<span class="badge-ok">Dans budget</span>':'<span class="badge-err">Dépassement probable</span>'}</td></tr>
</table>
<div class="note">⚠ Rapport généré automatiquement par SIGEPP-DPE. Les données sont extraites en temps réel de la base de données de gestion de projets de la Direction Principale Équipement de SENELEC.</div>

${sections.map((s,i) => {
  const cat = CATALOGUE.find(c => c.type === s.type);
  if (s.type === 'synthese' || s.type === 'planning' || s.type === 'finances') return '';
  return `<h2>${['I','II','III','IV','V','VI','VII','VIII','IX','X'][i+2]}. ${s.label}</h2><p style="color:#64748B;font-style:italic">Section ${s.label} — Données issues du système SIGEPP-DPE.</p>`;
}).join('')}

<div class="footer">
  <span>SIGEPP-DPE · Direction Principale Équipement SENELEC · ${new Date().getFullYear()}</span>
  <span>Document CONFIDENTIEL · Usage interne uniquement</span>
</div>
</body></html>`);
                  pw.document.close();
                  setTimeout(() => pw.print(), 500);
                }}
                style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, padding: '10px 12px', borderRadius: 7, marginBottom: 10, border: 'none', background: `linear-gradient(135deg, ${NAVY} 0%, #5B21B6 100%)`, color: '#fff', fontSize: 12.5, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit', boxShadow: '0 2px 8px rgba(61,26,107,0.35)' }}>
                <Bot size={14} /> ✨ Générer Rapport Complet
              </button>
              {[{ label: 'Export PDF', color: RED }, { label: 'Export Word', color: GREEN }, { label: 'Partager API', color: PURPLE }].map(btn => (
                <button key={btn.label} onClick={() => {
                  if (btn.label === 'Export PDF') {
                    const pw = window.open('', '_blank');
                    if (!pw) return;
                    pw.document.write(`<html><head><title>${titreRapport}</title><style>body{font-family:Arial,sans-serif;margin:40px;color:#1E293B}h1{color:#3D1A6B;border-bottom:3px solid #F47920;padding-bottom:12px}h2{color:#3D1A6B;margin-top:24px}table{border-collapse:collapse;width:100%}td,th{border:1px solid #E2E8F0;padding:8px 12px;font-size:12px}</style></head><body><h1>${titreRapport}</h1><p style="color:#64748B">Généré le ${new Date().toLocaleDateString('fr-FR')} · SIGEPP-DPE SENELEC</p>${projet ? `<h2>Projet : ${projet.code} — ${projet.nom}</h2><table><tr><th>Indicateur</th><th>Valeur</th></tr><tr><td>Avancement physique</td><td>${projet.avancement}%</td></tr><tr><td>CPI</td><td>${projet.cpi.toFixed(2)}</td></tr><tr><td>SPI</td><td>${projet.spi.toFixed(2)}</td></tr><tr><td>Budget</td><td>${projet.budget.toLocaleString('fr-FR')} MFCFA</td></tr><tr><td>Décaissé</td><td>${projet.budgetDecaisse.toLocaleString('fr-FR')} MFCFA</td></tr></table>` : ''}<p style="color:#94A3B8;margin-top:32px;font-size:11px">Rapport généré depuis SIGEPP-DPE · ${sections.length} section(s)</p></body></html>`);
                    pw.document.close(); pw.print();
                  } else if (btn.label === 'Export Word') {
                    const content = `RAPPORT\r\n${titreRapport}\r\nGénéré le ${new Date().toLocaleDateString('fr-FR')}\r\n\r\n${projet ? `Projet: ${projet.code} — ${projet.nom}\r\nAvancement: ${projet.avancement}%\r\nCPI: ${projet.cpi.toFixed(2)}\r\nSPI: ${projet.spi.toFixed(2)}\r\nBudget: ${projet.budget.toLocaleString('fr-FR')} MFCFA\r\n\r\n` : ''}${sections.map((s, i) => `${i+1}. ${s.label}`).join('\r\n')}`;
                    const blob = new Blob([content], { type: 'application/msword' });
                    const url = URL.createObjectURL(blob);
                    const a = document.createElement('a'); a.href = url; a.download = `${titreRapport.replace(/\s+/g, '_')}.doc`; a.click(); URL.revokeObjectURL(url);
                  } else {
                    const apiLink = `https://api.senelec.sn/dpe/rapports/${titreRapport.replace(/\s+/g, '-').toLowerCase()}?token=dpe_${Date.now()}`;
                    navigator.clipboard?.writeText(apiLink).then(() => undefined).catch(() => undefined);
                    alert(`Lien API copié :\n${apiLink}`);
                  }
                }} style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 8, padding: '8px 12px', borderRadius: 7, marginBottom: 7, border: `1px solid ${btn.color}30`, background: `${btn.color}10`, color: btn.color, fontSize: 12, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' }}>
                  <Download size={13} /> {btn.label}
                </button>
              ))}
              <button onClick={() => toast.info('Envoi automatique mensuel — configuration disponible dans les paramètres du rapport.')} style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 8, padding: '8px 12px', borderRadius: 7, border: '1px solid #E2E8F0', background: '#fff', color: '#64748B', fontSize: 12, cursor: 'pointer', fontFamily: 'inherit' }}>
                <Clock size={13} /> Envoi automatique mensuel
              </button>
            </div>
          </div>
        ) : (
          <div style={{ flex: 1, overflowY: 'auto', padding: '32px', background: '#F1F5F9' }}>
            <div style={{ maxWidth: 794, margin: '0 auto', background: '#fff', borderRadius: 4, boxShadow: '0 4px 32px rgba(0,0,0,0.12)', padding: '48px 56px', minHeight: 1000 }}>
              <div style={{ borderBottom: `4px solid ${NAVY}`, paddingBottom: 20, marginBottom: 32 }}>
                <div style={{ fontSize: 24, fontWeight: 900, color: '#0F172A', marginBottom: 6 }}>{titreRapport}</div>
                {projet && dcfg && <div style={{ fontSize: 13, color: '#64748B' }}>Projet : {projet.code} — {projet.nom} · {dcfg.label} {dcfg.emoji}</div>}
                <div style={{ fontSize: 12, color: '#94A3B8', marginTop: 4 }}>Généré le {new Date().toLocaleDateString('fr-FR')} · SIGEPP-DPE</div>
              </div>
              {sections.map((sec, i) => {
                const cat = CATALOGUE.find(c => c.type === sec.type);
                return (
                  <div key={sec.id} style={{ marginBottom: 36 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
                      <div style={{ width: 4, height: 20, background: cat?.color ?? NAVY, borderRadius: 2 }} />
                      <div style={{ fontSize: 16, fontWeight: 800, color: '#0F172A' }}>{i + 1}. {sec.label}</div>
                    </div>
                    {projet && sec.type === 'synthese' && (
                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12, marginBottom: 12 }}>
                        {[
                          { label: 'Avancement', value: `${projet.avancement}%`, color: NAVY },
                          { label: 'CPI', value: projet.cpi.toFixed(2), color: projet.cpi >= 0.90 ? GREEN : RED },
                          { label: 'SPI', value: projet.spi.toFixed(2), color: projet.spi >= 0.85 ? GREEN : AMBER },
                          { label: 'Budget décaissé', value: `${Math.round((projet.budgetDecaisse / projet.budget) * 100)}%`, color: PURPLE },
                        ].map(k => (
                          <div key={k.label} style={{ border: `1px solid #E2E8F0`, borderRadius: 8, padding: '12px', textAlign: 'center' }}>
                            <div style={{ fontSize: 20, fontWeight: 800, color: k.color }}>{k.value}</div>
                            <div style={{ fontSize: 11, color: '#64748B' }}>{k.label}</div>
                          </div>
                        ))}
                      </div>
                    )}
                    <div style={{ borderRadius: 6, border: '1px solid #E2E8F0', overflow: 'hidden' }}>
                      <PreviewSectionContent sec={sec} projet={projet} />
                    </div>
                  </div>
                );
              })}
              {sections.length === 0 && <div style={{ textAlign: 'center', color: '#94A3B8', fontSize: 14, padding: 40 }}>Aucune section sélectionnée</div>}
              <div style={{ borderTop: '1px solid #E2E8F0', marginTop: 40, paddingTop: 16, display: 'flex', justifyContent: 'space-between', fontSize: 11, color: '#94A3B8' }}>
                <span>SIGEPP-DPE · Senelec Direction Principale Équipement</span>
                <span>Page 1 / 1 · Confidentiel</span>
              </div>
            </div>
          </div>
        )}
      </>
      )}
    </div>
  );
}

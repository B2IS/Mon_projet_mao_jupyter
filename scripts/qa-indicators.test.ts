/**
 * qa-indicators.test.ts — Tests QA du moteur d'indicateurs SIGEPP-DPE
 * Vérifie « voir les données → sélectionner → calculer » avec données fictives,
 * aligné sur les indicateurs du Rapport Trimestriel global DPE (T1 2026).
 * Exécution : npx tsx scripts/qa-indicators.test.ts
 */
import {
  evaluateFormula, formatIndicator, ragStatus,
  type IndicatorProjet,
} from '../lib/indicatorStore';

// ── Portefeuille fictif (sous-ensemble des champs projet utilisés) ──
const P: IndicatorProjet[] = [
  { budget: 1000, budgetEngage: 800, budgetDecaisse: 500, avancement: 50, avancementPlanifie: 60, cpi: 1.0, spi: 0.9, statut: 'en_cours' },
  { budget: 2000, budgetEngage: 1500, budgetDecaisse: 1000, avancement: 80, avancementPlanifie: 80, cpi: 1.1, spi: 1.0, statut: 'en_cours' },
  { budget: 500,  budgetEngage: 500,  budgetDecaisse: 500,  avancement: 100, avancementPlanifie: 100, cpi: 1.2, spi: 1.1, statut: 'termine' },
  { budget: 1500, budgetEngage: 600,  budgetDecaisse: 200,  avancement: 20, avancementPlanifie: 50, cpi: 0.8, spi: 0.7, statut: 'en_retard' },
];

type Case = { label: string; formula: string; projets: IndicatorProjet[]; expect: number; tol?: number };

// Calculs attendus (à la main) :
//  SUM(budget)=5000 ; SUM(budgetDecaisse)=2200 → financier = 44%
//  WAVG(avancement) pondéré budget = (50*1000+80*2000+100*500+20*1500)/5000 = (50000+160000+50000+30000)/5000 = 290000/5000 = 58
//  WAVG(avancementPlanifie) = (60*1000+80*2000+100*500+50*1500)/5000 = (60000+160000+50000+75000)/5000 = 345000/5000 = 69
//  TRP physique = 58/69*100 = 84.06%
//  COUNT=4 ; COUNT_ACTIF=2 ; COUNT_TERMINE=1 ; COUNT_RETARD=1
//  AVG(cpi) = (1.0+1.1+1.2+0.8)/4 = 1.025
const CASES: Case[] = [
  { label: 'SUM budget total', formula: 'SUM(budget)', projets: P, expect: 5000 },
  { label: 'Taux de réalisation financière (décaissé/budget)', formula: 'SUM(budgetDecaisse) / SUM(budget) * 100', projets: P, expect: 44 },
  { label: 'Taux engagement (engagé/budget)', formula: 'SUM(budgetEngage) / SUM(budget) * 100', projets: P, expect: 68 },
  { label: 'Taux de réalisation physique (TRP pondéré)', formula: 'WAVG(avancement) / WAVG(avancementPlanifie) * 100', projets: P, expect: 84.06, tol: 0.05 },
  { label: 'CPI moyen portefeuille', formula: 'AVG(cpi)', projets: P, expect: 1.025, tol: 0.001 },
  { label: 'Nombre total de projets', formula: 'COUNT()', projets: P, expect: 4 },
  { label: 'Projets en cours d\'exécution', formula: 'COUNT_ACTIF()', projets: P, expect: 2 },
  { label: 'Projets terminés', formula: 'COUNT_TERMINE()', projets: P, expect: 1 },
  { label: 'Projets en retard', formula: 'COUNT_RETARD()', projets: P, expect: 1 },
  { label: 'Taux d\'achèvement (terminés/total)', formula: 'COUNT_TERMINE() / COUNT() * 100', projets: P, expect: 25 },
  // ── SÉLECTION : sous-ensemble (uniquement les 2 projets "en_cours") ──
  { label: 'SÉLECTION — financier sur 2 projets en cours', formula: 'SUM(budgetDecaisse) / SUM(budget) * 100',
    projets: P.filter(p => p.statut === 'en_cours'), expect: 50 }, // 1500/3000*100
  { label: 'SÉLECTION — COUNT sur sous-ensemble', formula: 'COUNT()',
    projets: P.filter(p => p.statut === 'en_cours'), expect: 2 },
];

let pass = 0, fail = 0;
console.log('\n═══ QA — Moteur d\'indicateurs SIGEPP-DPE (données fictives) ═══\n');
for (const c of CASES) {
  const r = evaluateFormula(c.formula, c.projets);
  const tol = c.tol ?? 0.0001;
  const ok = r.ok && Math.abs(r.value - c.expect) <= tol;
  ok ? pass++ : fail++;
  console.log(`${ok ? '✅' : '❌'} ${c.label}`);
  if (!ok) console.log(`     formule="${c.formula}" attendu=${c.expect} obtenu=${r.ok ? r.value : 'ERREUR:' + r.error}`);
}

// ── Test du statut RAG (seuils) ──
const ragGreen = ragStatus(85, { good: 80, warn: 50, direction: 'higher' }) === 'green';
const ragAmber = ragStatus(60, { good: 80, warn: 50, direction: 'higher' }) === 'amber';
const ragRed   = ragStatus(30, { good: 80, warn: 50, direction: 'higher' }) === 'red';
[['RAG vert (≥cible)', ragGreen], ['RAG ambre (≥alerte)', ragAmber], ['RAG rouge (<alerte)', ragRed]].forEach(([l, ok]) => {
  ok ? pass++ : fail++;
  console.log(`${ok ? '✅' : '❌'} ${l}`);
});

// ── Test sécurité : formule invalide rejetée (pas d'eval) ──
const inj = evaluateFormula('process.exit(1)', P);
const injOk = !inj.ok;
injOk ? pass++ : fail++;
console.log(`${injOk ? '✅' : '❌'} Sécurité — formule non arithmétique rejetée (pas d'eval)`);

console.log(`\n─── Résultat : ${pass} réussis / ${fail} échoués sur ${CASES.length + 4} ───\n`);
process.exit(fail === 0 ? 0 : 1);

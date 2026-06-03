/**
 * qa-access.test.ts — Tests QA de la logique d'accès organisationnel SIGEPP-DPE
 * Vérifie « chaque utilisateur ne voit que son périmètre » (ND 005/2023).
 * Exécution : npx tsx scripts/qa-access.test.ts
 */
import {
  computeVisibilityScope, isProjectVisible, getNiveauHierarchique,
  type UserOrgProfile, type ProjetMinimal,
} from '../lib/accessEngine';

// ── Données fictives : portefeuille couvrant toutes les unités/programmes ──
const PROJETS: (ProjetMinimal & { nom: string })[] = [
  { id: 'F-TRANS-1', nom: 'Ligne THT Tobène-Touba',      unite: 'DPT', departement: 'DPT_TRANSPORT',    domaine: 'transport',    programme: 'PADAES' },
  { id: 'F-TRANS-2', nom: 'Poste HT Kaolack',            unite: 'DPT', departement: 'DPT_TRANSPORT',    domaine: 'transport',    programme: 'BEST' },
  { id: 'F-DIST-1',  nom: 'Extension BT Thiès',          unite: 'DPD', departement: 'DPD_DISTRIBUTION', domaine: 'distribution', programme: 'PADAES' },
  { id: 'F-DIST-2',  nom: 'Électrification rurale Kolda', unite: 'PADERAU', departement: 'DPD_DISTRIBUTION', domaine: 'distribution', programme: 'PADERAU' },
  { id: 'F-PROD-C',  nom: 'Réhab. centrale fuel C4',      unite: 'DEP', departement: 'DEP_PEC',          domaine: 'production',   programme: 'PES' },
  { id: 'F-PROD-R',  nom: 'Centrale solaire Méouane',     unite: 'DEP', departement: 'DEP_PER',          domaine: 'production',   programme: 'PES' },
  { id: 'F-COMM-1',  nom: 'Déploiement AMI Dakar',        unite: 'DIT', departement: 'DIT_COMMERCIAL',   domaine: 'commercial',   programme: 'BEST' },
  { id: 'F-SMART-1', nom: 'SCADA postes sources',         unite: 'DIT', departement: 'DIT_SMARTGRID',    domaine: 'commercial',   programme: 'Fonds propres' },
  { id: 'F-GC-1',    nom: 'Bâtiment technique DGC',       unite: 'DGC', departement: 'DGC_INVEST',       domaine: 'production',   programme: 'BEST' },
  { id: 'F-GC-2',    nom: 'Siège régional St-Louis (GC)', unite: 'DGC', departement: 'DGC_INVEST',       domaine: 'genie_civil',  programme: 'DGC' },
  { id: 'F-MCA-1',   nom: 'Accès universel MCA',          unite: 'CC26', domaine: 'mca',                 programme: 'Compact2026' },
];

const ALL = PROJETS.map(p => p.id);

// ── Profils fictifs + ensembles de projets ATTENDUS ──
type Case = { label: string; user: UserOrgProfile; expectNiveau: 0|1|2|3; expect: string[] };
const CASES: Case[] = [
  { label: 'DIR_DPE (EM_DPE) — voit tout',
    user: { role: 'DIR_DPE', direction: 'EM_DPE' }, expectNiveau: 0, expect: ALL },
  { label: 'PMO (CSE) — voit tout',
    user: { role: 'PMO', direction: 'CSE', cellule: 'CSE' }, expectNiveau: 0, expect: ALL },
  { label: 'ADMIN — voit tout',
    user: { role: 'ADMIN', direction: 'EM_DPE' }, expectNiveau: 0, expect: ALL },
  { label: 'Chef Dept DPD — UNIQUEMENT distribution (jamais transport)',
    user: { role: 'CHEF_DEPT', direction: 'DER', departement: 'DPD_DISTRIBUTION' },
    expectNiveau: 2, expect: ['F-DIST-1', 'F-DIST-2'] },
  { label: 'Ingénieur DPT — UNIQUEMENT transport (jamais distribution)',
    user: { role: 'INGENIEUR', direction: 'DER', departement: 'DPT_TRANSPORT' },
    expectNiveau: 2, expect: ['F-TRANS-1', 'F-TRANS-2'] },
  { label: 'Contrôleur DPT — UNIQUEMENT transport',
    user: { role: 'CONTROLEUR', direction: 'DER', departement: 'DPT_TRANSPORT' },
    expectNiveau: 2, expect: ['F-TRANS-1', 'F-TRANS-2'] },
  { label: 'Chef Dept DER (sans département) — toute la direction Réseaux',
    user: { role: 'CHEF_DEPT', direction: 'DER' },
    expectNiveau: 1, expect: ['F-TRANS-1', 'F-TRANS-2', 'F-DIST-1', 'F-DIST-2'] },
  { label: 'Chef Projet DEP_PEC — UNIQUEMENT production conventionnelle',
    user: { role: 'CHEF_PROJ', direction: 'DEP', departement: 'DEP_PEC' },
    expectNiveau: 2, expect: ['F-PROD-C'] },
  { label: 'Chef Projet DEP_PER — UNIQUEMENT production renouvelable',
    user: { role: 'CHEF_PROJ', direction: 'DEP', departement: 'DEP_PER' },
    expectNiveau: 2, expect: ['F-PROD-R'] },
  { label: 'Chef Dept DIT_COMMERCIAL — UNIQUEMENT commercial',
    user: { role: 'CHEF_DEPT', direction: 'DIT', departement: 'DIT_COMMERCIAL' },
    expectNiveau: 2, expect: ['F-COMM-1'] },
  { label: 'Directeur DEP (sans département) — toute la production',
    user: { role: 'CHEF_DEPT', direction: 'DEP' },
    expectNiveau: 1, expect: ['F-PROD-C', 'F-PROD-R'] },
  { label: 'Directeur DIT (sans département) — commercial + smartgrid',
    user: { role: 'CHEF_DEPT', direction: 'DIT' },
    expectNiveau: 1, expect: ['F-COMM-1', 'F-SMART-1'] },
  { label: 'Directeur DGC — uniquement génie civil',
    user: { role: 'CHEF_DEPT', direction: 'DGC' },
    expectNiveau: 1, expect: ['F-GC-1', 'F-GC-2'] },
  { label: 'Chargé CPBM-UE — projets bailleurs BM/UE (par programme PADAES/BEST)',
    user: { role: 'CHARGE', direction: 'CPBM_UE' },
    expectNiveau: 2, expect: ['F-TRANS-1', 'F-TRANS-2', 'F-DIST-1', 'F-COMM-1', 'F-GC-1'] },
  { label: 'Coordo CC26 — uniquement projets Compact/MCA',
    user: { role: 'CHEF_DEPT', direction: 'CC26' },
    expectNiveau: 1, expect: ['F-MCA-1'] },
  { label: 'Coordo CPADERAU — uniquement programme PADERAU',
    user: { role: 'CHEF_DEPT', direction: 'CPADERAU' },
    expectNiveau: 1, expect: ['F-DIST-2'] },
];

// ── Exécution ──
function visibleFor(user: UserOrgProfile): string[] {
  const scope = computeVisibilityScope(user);
  return PROJETS.filter(p => isProjectVisible(p, scope)).map(p => p.id);
}
function sameSet(a: string[], b: string[]): boolean {
  const sa = new Set(a), sb = new Set(b);
  return sa.size === sb.size && [...sa].every(x => sb.has(x));
}

let pass = 0, fail = 0;
console.log('\n═══ QA — Visibilité organisationnelle SIGEPP-DPE ═══\n');
for (const c of CASES) {
  const niveau = getNiveauHierarchique(c.user);
  const got = visibleFor(c.user).sort();
  const exp = [...c.expect].sort();
  const okNiveau = niveau === c.expectNiveau;
  const okSet = sameSet(got, exp);
  const ok = okNiveau && okSet;
  ok ? pass++ : fail++;
  console.log(`${ok ? '✅' : '❌'} ${c.label}`);
  if (!okNiveau) console.log(`     niveau attendu ${c.expectNiveau}, obtenu ${niveau}`);
  if (!okSet) {
    console.log(`     attendu : [${exp.join(', ')}]`);
    console.log(`     obtenu  : [${got.join(', ')}]`);
    const extra = got.filter(x => !exp.includes(x));
    const miss  = exp.filter(x => !got.includes(x));
    if (extra.length) console.log(`     ⚠️  FUITE (vus à tort) : [${extra.join(', ')}]`);
    if (miss.length)  console.log(`     ⚠️  MANQUANTS          : [${miss.join(', ')}]`);
  }
}
console.log(`\n─── Résultat : ${pass} réussis / ${fail} échoués sur ${CASES.length} ───\n`);
process.exit(fail === 0 ? 0 : 1);

/**
 * org-scope.spec.ts — PREUVE EXÉCUTABLE de la règle de sécurité absolue.
 * « Un utilisateur voit son unité + ses sous-unités + ses affectations,
 *   JAMAIS les unités parallèles. » (Master Prompt — principe fondateur)
 *
 * Exécution :  npm run test:security   (ts-node + node:test, sans base réelle)
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { OrgScopeService } from '../src/common/security/org-scope.service';

// ── Référentiel organisationnel simulé (chemins matérialisés) ──────────────────
const ORG = [
  'DPE', 'DPE.CT', 'DPE.CAB', 'DPE.CSE',
  'DPE.DEP', 'DPE.DEP.ENC', 'DPE.DEP.ENR',
  'DPE.DER', 'DPE.DER.DPT', 'DPE.DER.DPD',
  'DPE.DGC', 'DPE.DGC.IGC', 'DPE.DGC.SIG', 'DPE.DGC.IMMO',
  'DPE.DIT', 'DPE.DIT.SMG', 'DPE.DIT.COM',
  // Piège de collision de préfixe de chaîne (prouve la frontière `.`) :
  'DPE.DER.DPT2',
].map((path, i) => ({ id: `u${i}`, path, code: path.split('.').pop()! }));

const byCode = (c: string) => ORG.find((o) => o.code === c)!;

const USERS: Record<string, any> = {
  chefDPT: { id: 'chefDPT', orgUnit: byCode('DPT'), affectations: [] },
  dirDER:  { id: 'dirDER',  orgUnit: byCode('DER'), affectations: [] },
  chefSIG: { id: 'chefSIG', orgUnit: byCode('SIG'), affectations: [] },
  pmo:     { id: 'pmo',     orgUnit: byCode('CSE'), affectations: [] },
  dirDPE:  { id: 'dirDPE',  orgUnit: byCode('DPE'), affectations: [] },
  // Affectation secondaire : agent DPT détaché aussi sur SIG.
  agentDual: { id: 'agentDual', orgUnit: byCode('DPT'), affectations: [{ orgUnitId: byCode('SIG').id }] },
};

// ── Prisma simulé (mêmes signatures que celles appelées par le service) ─────────
const prismaMock: any = {
  appUser: { findUnique: async ({ where }: any) => USERS[where.id] ?? null },
  orgUnit: {
    findMany: async ({ where }: any = {}) => {
      if (where?.id?.in) return ORG.filter((o) => where.id.in.includes(o.id));
      return ORG; // cas DPE/CSE → tout
    },
  },
};

const svc = new OrgScopeService(prismaMock);

// Applique le filtre Prisma (pathFilter) à un ensemble de chemins → visibilité réelle.
function visibleVia(filter: any, paths: string[]): string[] {
  return paths.filter((orgPath) =>
    filter.OR.some((cond: any) =>
      typeof cond.orgPath === 'string' ? cond.orgPath === orgPath
        : orgPath.startsWith(cond.orgPath.startsWith),
    ),
  );
}

// ════════════════════════════════════════════════════════════════════════════
test('Chef Projet DPT voit DPT et ses sous-unités, JAMAIS les unités parallèles', async () => {
  assert.equal(await svc.canSee('chefDPT', 'DPE.DER.DPT'), true);
  assert.equal(await svc.canSee('chefDPT', 'DPE.DER.DPT.LOT1'), true);   // sous-unité
  assert.equal(await svc.canSee('chefDPT', 'DPE.DER.DPD'), false);       // parallèle
  assert.equal(await svc.canSee('chefDPT', 'DPE.DEP'), false);
  assert.equal(await svc.canSee('chefDPT', 'DPE.DGC.SIG'), false);
  assert.equal(await svc.canSee('chefDPT', 'DPE.DIT'), false);
  assert.equal(await svc.canSee('chefDPT', 'DPE.DER'), false);           // parent : non
  assert.equal(await svc.canSee('chefDPT', 'DPE'), false);
});

test('FRONTIÈRE: DPT ne voit pas DPT2 (collision de préfixe de chaîne)', async () => {
  // Sans la frontière `.`, un startsWith brut ferait fuiter DPT2. Doit rester FALSE.
  assert.equal(await svc.canSee('chefDPT', 'DPE.DER.DPT2'), false);
});

test('Directeur DER voit DER + DPT + DPD, jamais DEP/DGC/DIT', async () => {
  for (const ok of ['DPE.DER', 'DPE.DER.DPT', 'DPE.DER.DPD', 'DPE.DER.DPT.X'])
    assert.equal(await svc.canSee('dirDER', ok), true, ok);
  for (const ko of ['DPE.DEP', 'DPE.DEP.ENC', 'DPE.DGC', 'DPE.DIT', 'DPE'])
    assert.equal(await svc.canSee('dirDER', ko), false, ko);
});

test('Affectation secondaire: agent DPT+SIG voit les deux périmètres', async () => {
  assert.equal(await svc.canSee('agentDual', 'DPE.DER.DPT'), true);
  assert.equal(await svc.canSee('agentDual', 'DPE.DGC.SIG'), true);
  assert.equal(await svc.canSee('agentDual', 'DPE.DER.DPD'), false);     // toujours pas le parallèle
});

test('DPE et PMO Central (CSE) = consolidé global', async () => {
  assert.equal(await svc.canSeeConsolidated('dirDPE'), true);
  assert.equal(await svc.canSeeConsolidated('pmo'), true);
  assert.equal(await svc.canSeeConsolidated('chefDPT'), false);
  for (const any of ['DPE.DEP', 'DPE.DGC.SIG', 'DPE.DIT.COM'])
    assert.equal(await svc.canSee('pmo', any), true, any);
});

test('pathFilter (filtre Prisma) exclut bien les unités parallèles', async () => {
  const filter = await svc.pathFilter('chefDPT');
  const vis = visibleVia(filter, ORG.map((o) => o.path));
  assert.deepEqual(vis.sort(), ['DPE.DER.DPT'].sort());                  // DPT seul (pas DPT2, pas DPD)
  assert.ok(!vis.includes('DPE.DER.DPD'));
  assert.ok(!vis.includes('DPE.DER.DPT2'));
});

test('Héritage: un projet caché ⇒ ses objets (KPI/doc/marché) le sont aussi', async () => {
  // Tous les objets métier partagent le même orgPath ⇒ même verdict canSee.
  const projetDPD = 'DPE.DER.DPD';
  for (const objet of [projetDPD, projetDPD, projetDPD]) // projet, kpi, marché : même path
    assert.equal(await svc.canSee('chefDPT', objet), false);
});

# SIGEPP-DPE — Backend Enterprise (refonte selon Master Prompt)

Backend **NestJS / DDD / CQRS / PostgreSQL (Prisma) / Camunda 8 / Keycloak**,
**organization-driven** : l'organisation est le référentiel maître, tous les objets
métier héritent de sa sécurité (ABAC + Row-Level Security).

## Démarrage (1 commande pour la base)
```bash
npm install
docker compose up -d db                              # PostgreSQL 16
cp .env.example .env                                 # DATABASE_URL déjà pointé sur localhost:5432
npm run prisma:migrate                               # schéma (miroir 01_data_model.sql)
npm run prisma:seed                                  # organigramme DPE + RH + programmes
psql "$DATABASE_URL" -f prisma/rls/enable_rls.sql    # active la Row-Level Security
npm run start:dev                                    # REST http://localhost:4000/api · GraphQL /graphql
```
Tout-en-conteneur : `docker compose up` (db + api). Build vérifiés : `npm run build` ✓,
amorçage complet du graphe Nest + génération du schéma GraphQL ✓, `npm run test:security` 7/7 ✓.

## Endpoints (Phases 1–2)
| Route | Rôle |
|-------|------|
| `GET /api/org/tree` | arbre organisationnel officiel DPE |
| `GET /api/org/me/scope` | **mon périmètre** (ABAC : unité + sous-unités) |
| `GET /api/projets` | portefeuille **filtré automatiquement** par l'org |
| `GET /api/programmes` | programmes transverses (CPBM-UE, CC26, PAMACEL, PADERAU…) |
| `GET /api/projets/:id/planning` | WBS + baseline + **EVM** (CPI/SPI/EAC/VAC) + surcharges ressources |
| `GET /api/marches` | marchés/contrats visibles (héritage org via `orgPath`) |
| `GET /api/attachements` | attachements BOQ visibles + **montant réalisé** |
| `POST /api/attachements/:id/submit` | l'entreprise soumet les quantités réalisées (CQRS) |
| `POST /api/attachements/:id/validate` | le chef de projet valide / ajuste les quantités (CQRS) |
| `POST /api/attachements/:id/reject` | rejet motivé (CQRS) |
| `GET /api/finances/cashflow` | cashflow agrégé sur le périmètre (taux engagement/décaissement) |
| `GET /api/immobilisations/:id/amortissement` | plan d'amortissement linéaire |
| `GET /api/uagl/{missions,vehicules,pointages,reservations}` | logistique org-scopée |
| `GET /api/ged/documents` · `GET /api/gis/sites` · `GET /api/kpi` · `GET /api/risques` | objets org-scopés (KPI consolidé = DPE/CSE) |
| `GET/POST /api/workflows/definitions` · `:cle/version` · `:cle/simulate` · `:cle/start` | Workflow Studio (Camunda 8) versionné |
| `POST /api/ai/agents/:agent/ask` · `/ai/migration/analyze` | agents IA org-secured · migration HITL |
| `GET /api/admin/{roles,modules,settings,delegations}` | Administration (config ; permissions calculées) |
| `GET/POST /api/lowcode/{forms,dashboards,reports}` | Low-Code Studio (schémas JSON, global ou org-scopé) |
| **GraphQL** `/graphql` | `meScope`, `orgTree`, `projets`, `kpi` — mêmes règles org (code-first) |

Toutes les routes (REST **et** GraphQL) appliquent l'**héritage de sécurité** via
`OrgScopeService.pathFilter()` / `canSee()` — un objet hors périmètre est invisible *et* non modifiable.

## Sécurité (cœur)
- `common/security/org-scope.service.ts` — moteur d'accès : visiblePaths / pathFilter /
  canSee / canSeeConsolidated (DPE/CSE = global). **Frontière `.` stricte** : `path = p`
  OU `path LIKE p.%` — aucune fuite d'unité parallèle même en cas de collision de préfixe.
- `common/security/abac.guard.ts` — guard ABAC (après AuthN Keycloak OIDC/SSO/MFA).
- Défense en profondeur : RLS PostgreSQL (docs/architecture/01_data_model.sql) au niveau
  base, doublée du guard au niveau API.

### Preuve exécutable de la règle absolue
```bash
npm run test:security      # 7/7 ✓ (ts-node + node:test, sans base réelle)
```
Vérifie : Chef DPT → DPT seul (jamais DPD/DEP/DGC/DIT, ni le parent DER) ; **collision de
préfixe** (DPT ⊀ DPT2) ; Directeur DER → DER+DPT+DPD ; affectation secondaire ; DPE/CSE
consolidé ; `pathFilter` exclut les parallèles ; héritage (projet caché ⇒ KPI/doc/marché cachés).

## Feuille de route (refonte totale — phases)
- [x] Phase 1 — Socle : Organisation + RH + Sécurité ABAC + Projet (héritage) + schéma SQL/Prisma + seed.
- [x] Phase 2 — Cœur projet : Programmes, Planning (WBS/baseline/**EVM**), Marchés, Attachements BOQ
      (CQRS submit/validate/reject), tous org-scoped + détection surcharge ressources.
- [x] Phase 3 — Finances & patrimoine : Budget/CBS, Décaissements, Cashflow, Immobilisations (amortissement).
- [x] Phase 4 — Transverses : UAGL (ODM/flotte/pointage/salles), GED (MinIO/OCR), GIS (ArcGIS/Sites).
- [x] Phase 5 — Pilotage : KPI sécurisés (consolidé = DPE/CSE), Risques, S&E.
- [x] Phase 6 — Workflow : Camunda 8 (défs versionnées, instances org-scoped, candidate-groups).
- [x] Phase 7 — AI Center : agents org-secured (RAG borné au périmètre), migration IA (HITL).
- [~] Phase 8 — Frontend : client typé `lib/api/sigeppApi.ts` (REST + GraphQL, drapeau
      `NEXT_PUBLIC_SIGEPP_API`) prêt ; branchement écran par écran sans régression.
- [x] Modules 15 & 18 — Low-Code Studio (forms/dashboards/reports) & Administration (rôles/
      modules/paramètres/délégations) ; Workflow Studio (créer/versionner/simuler).
- [x] GraphQL BFF org-aware (code-first, `/graphql`) — livrable 7 en code réel.
- [x] RLS PostgreSQL exécutable — `prisma/rls/enable_rls.sql` (`can_see_path`, policies, audit append-only).
- [x] Infra — `docker-compose.yml` (db + api) + `Dockerfile` multi-stage.

> Backend **compilé vert** (`npx tsc` exit 0 · `npm run build` ✓), graphe Nest amorcé de bout en
> bout (20 modules + schéma GraphQL généré), `npm run test:security` **7/7**. Une seule instance
> Prisma (`PrismaModule` @Global). Démarrage réel : `docker compose up -d db` puis migrate/seed/RLS/start.

> Le frontend SIGEPP-DPE actuel (Next.js) reste le produit fonctionnel et la référence
> UX ; il sera connecté à ce backend module par module, sans rupture.

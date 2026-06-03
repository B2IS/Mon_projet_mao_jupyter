# SIGEPP-DPE — Livrables Enterprise (matrices, GraphQL, RAG, déploiement, structure)

> Complète `02_architecture.md` (architecture) et `01_data_model.sql` (modèle/SQL).
> Tout dérive du **référentiel maître : l'organisation**. Aucune permission manuelle.

---

## 11. Matrice RBAC (rôles ↔ capacités)

Les rôles sont **dérivés du poste** (`poste.niveauFonctionnel`) + affectation (`UserAffectation.roleCode`),
jamais saisis à la main.

| Rôle (poste) | Niv | Lecture | Écriture projet | Valider décompte | Budget | Immo | Admin | KPI consolidé |
|--------------|:---:|:------:|:--------------:|:----------------:|:-----:|:----:|:-----:|:-------------:|
| Directeur DPE | 0 | ✔ global | — | ✔ | ✔ | ✔ | — | ✔ |
| PMO Central (CSE) | 1 | ✔ global | — | — | ✔ | — | — | ✔ |
| Directeur (DER/DEP/DGC/DIT) | 0 | ✔ sa direction | ✔ | ✔ | ✔ | — | — | — |
| Chef de Département | 1 | ✔ son dépt | ✔ | ✔ | ✔ | — | — | — |
| Chef de Projet | 2 | ✔ ses projets | ✔ (siens) | ✔ (siens) | lecture | — | — | — |
| Finance | 2 | ✔ son périmètre | — | — | ✔ | — | — | — |
| Marchés | 2 | ✔ son périmètre | marchés | — | — | — | — | — |
| UAGL | 2 | ✔ son périmètre | ODM/flotte | — | — | — | — | — |
| S&E (par direction) | 1 | ✔ sa direction | — | — | — | — | — | — |
| Immobilisation (DGC) | 2 | ✔ DGC | — | — | — | ✔ | — | — |
| Administrateur | — | selon org | — | — | — | — | ✔ | — |
| Agent | 3 | ✔ son unité | — | — | — | — | — | — |

> « ✔ global » n'est accordé qu'à **DPE** et **CSE** (PMO Central). Tous les autres sont bornés par l'org.

---

## 12. Matrice ABAC (attributs → décision)

Décision = `permit` **ssi** toutes les règles passent. Attributs portés par le sujet (user)
et la ressource (objet métier).

| Attribut ressource | Attribut sujet | Règle (PEP/PDP) | Mise en œuvre |
|--------------------|----------------|-----------------|---------------|
| `orgPath` | `visiblePaths(user)` | `∃ p ∈ visiblePaths : orgPath LIKE p%` | `OrgScopeService.canSee()` + RLS `can_see_path()` |
| `consolide=true` (KPI) | `orgUnit.code ∈ {DPE,CSE}` | consolidé ⇒ DPE/CSE only | `KpiController` + policy SQL |
| `chefProjetId` | `user.id` | écriture projet ⇒ chef (ou délégué validé) | guard métier |
| `statut` (attachement) | `roleCode` | `soumettre`=entreprise, `valider`=chef | CQRS handlers |
| `objetType/objetId` (workflow) | `candidateGroup` | étape ⇒ groupe dérivé `orgPath+roleCode` | Camunda candidate-groups |
| `document.orgPath` | `visiblePaths` | doc suit la visibilité de son unité | RLS + ACL MinIO |

**Règle absolue encodée** : un utilisateur voit *son unité + sous-unités + affectations*,
**jamais les unités parallèles**. Exemple vérifié — *Chef Projet DPT* : `visiblePaths = ['DPE.DER.DPT']`
⇒ voit `DPE.DER.DPT%`, ne voit jamais `DPE.DER.DPD`, `DPE.DEP%`, `DPE.DGC%`, `DPE.DIT%`.

---

## 7+. Surface GraphQL (org-aware)

Schéma BFF — chaque résolveur applique `OrgScopeService` (mêmes règles que REST/RLS) :

```graphql
type OrgUnit { id: ID!, code: String!, label: String!, type: String!, path: String!, children: [OrgUnit!]! }
type Projet  { id: ID!, codeBit: String, nom: String!, domaine: String!, orgPath: String!,
               budgetMfcfa: Float!, avancement: Int!, cpi: Float, spi: Float, statut: String! }
type EVM     { pv: Float!, ev: Float!, ac: Float!, bac: Float!, cpi: Float!, spi: Float!, eac: Float!, vac: Float! }
type Kpi     { id: ID!, code: String!, libelle: String!, cible: Float!, valeur: Float!, consolide: Boolean! }

type Query {
  meScope: [String!]!                         # visiblePaths du demandeur
  orgTree: OrgUnit!
  projets(direction: String, programme: String): [Projet!]!   # filtrés org
  planning(projetId: ID!): EVM!
  marches: [Marche!]!
  attachements: [Attachement!]!
  kpi(consolide: Boolean): [Kpi!]!            # consolidés réservés DPE/CSE
}
type Mutation {
  submitAttachement(id: ID!): Attachement!
  validateAttachement(id: ID!, ajustements: [AjustementInput!]): Attachement!
  startWorkflow(cle: String!, objetType: String!, objetId: ID!, orgPath: String!): WorkflowInstance!
}
```

---

## 14. Architecture RAG (AI Project Intelligence Engine)

```
Ingestion ─ OCR (Tesseract/Document AI) ─► NLP (classification, NER) ─► Chunking
   ─► Embeddings (OpenAI / open-source) ─► Vector DB (pgvector / Elasticsearch kNN)
                                                   │  (chaque vecteur porte orgPath)
Question ─► AbacGuard ─► visiblePaths(user) ─► Retrieval FILTRÉ (orgPath ∈ scope)
   ─► LangGraph (plan → tools → synthèse) ─► Réponse ancrée + citations (du périmètre only)
```

**Sécurité RAG** : le retrieval n'interroge que les vecteurs dont `orgPath` est dans le périmètre
du demandeur ⇒ un agent ne « fuit » jamais un document hors-périmètre. Implémenté côté API par
`AiController.ask()` (filtre `documents.orgPath startsWith p`).

**Migration IA (HITL)** : `POST /api/ai/migration/analyze` → extraction (Direction/Dépt/Programme/
Bailleur) → proposition Fiche/WBS/Planning/Budget/Risques/KPI/GED → **validation humaine obligatoire**
avant persistance.

---

## 10. Dashboards par profil (cockpit adaptatif)

| Profil | Cockpit | Indicateurs clés |
|--------|---------|------------------|
| Directeur DPE / PMO | Consolidé global | Santé portefeuille, EVM agrégé, KPI énergie consolidés, alertes |
| Directeur (DER/DEP/DGC/DIT) | Sa direction | Projets direction, avancement, budget engagé/décaissé, risques |
| Chef de Département | Son département | Ses projets, jalons, EVM par projet, décomptes en attente |
| Chef de Projet | Ses projets | Gantt, CPI/SPI, BOQ/attachements, risques, livrables |
| Finance | Périmètre | Cashflow, taux engagement/décaissement, décaissements |
| Marchés | Périmètre | DAO/AO en cours, contrats, avenants, réceptions |
| UAGL | Périmètre | ODM, flotte, pointages, réservations salles |
| S&E (par direction) | Sa direction | Cadre logique, KPI direction, reporting, audit |

---

## 15. Plan de déploiement

```
┌── Edge (Ingress/TLS) ──────────────────────────────────────────────┐
│  Keycloak (OIDC/SSO/MFA, federation Entra/Azure AD)                 │
├── Frontend (React/MUI/AG-Grid) — conteneur statique (Nginx)         │
├── API Gateway NestJS (REST+GraphQL) — réplicas N, stateless         │
├── Workers : projections CQRS, consumers Kafka/outbox                │
├── Camunda 8 (Zeebe) — orchestration workflows                       │
├── Data : PostgreSQL (RLS) · Redis · Elasticsearch · pgvector        │
├── Stockage : MinIO (GED) · ArcGIS Enterprise (GIS)                  │
└── Observabilité : OpenTelemetry → Prometheus/Grafana · ELK          │
```

- **Conteneurisation** Docker, orchestration **Kubernetes** (Helm). 1 base = source de vérité.
- **Multi-environnement** : `dev` / `recette` / `prod` (mêmes images, config par env/secret).
- **Multi-tenant** : `org_path` racine par tenant + RLS ⇒ isolation logique forte.
- **Défense en profondeur** : RLS PostgreSQL **et** `AbacGuard` API **et** filtre retrieval RAG.
- **CI/CD** : build → tests (unit/e2e) → `prisma migrate deploy` → scan SAST/DAST → déploiement bleu/vert.

---

## 16. Structure du code source

```
senelec-dpe/
├── app/                         # FRONTEND Next.js (produit fonctionnel + référence UX)
│   └── (dashboard)/             #   16 modules : tableau-de-bord, projets, marchés, finances…
├── components/dashboard/        #   écrans (Bordereaux, Pointage, ReservationSalle, GestionProjet…)
├── lib/                         #   accessEngine, dpeOrgStructure, stores (RBAC/ABAC côté client)
├── backend/                     # BACKEND Python — OCR / Migration IA (pipelines)
├── backend-enterprise/          # BACKEND NestJS Enterprise (organization-driven)
│   ├── prisma/
│   │   ├── schema.prisma        #   modèle (miroir 01_data_model.sql), tous objets ⊃ orgPath
│   │   └── seed.ts              #   organigramme DPE + RH + programmes
│   └── src/
│       ├── common/
│       │   ├── prisma.service.ts
│       │   └── security/        #   org-scope.service.ts (cœur ABAC) · abac.guard.ts
│       ├── modules/
│       │   ├── organisation/    #   arbre org + /me/scope  (référentiel maître)
│       │   ├── projet/          #   portefeuille org-scoped
│       │   ├── programme/  planning/(EVM)  marche/  attachement/(CQRS)   ← Phase 2
│       │   ├── finance/  immobilisation/(amortissement)                  ← Phase 3
│       │   ├── uagl/  ged/  gis/                                          ← Phase 4
│       │   ├── kpi/(consolidé) risque/                                    ← Phase 5
│       │   ├── workflow/(Camunda)                                         ← Phase 6
│       │   └── ai/(agents + migration HITL)                               ← Phase 7
│       ├── app.module.ts        #   tous les bounded contexts câblés
│       └── main.ts              #   bootstrap (prefix /api, port 4000)
└── docs/architecture/
    ├── 01_data_model.sql        # SQL + RLS (livrables 2,3)
    ├── 02_architecture.md       # archi, modules, BPMN, API, agents (livrables 1,4,5,6,8,9,13)
    └── 03_livrables.md          # ce document (livrables 7,10,11,12,14,15,16)
```

**Industrialisable** : DDD/CQRS, modules isolés, sécurité centralisée (`OrgScopeService` réutilisé
par chaque contrôleur), schéma typé Prisma, migrations versionnées, build TypeScript vert (exit 0).

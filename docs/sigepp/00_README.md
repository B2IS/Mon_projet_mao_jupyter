# SIGEPP — Dossier de conception Enterprise (par étapes)

> **SIGEPP** (sans suffixe) — Système Intégré de Gouvernance, d'Exécution et de Pilotage des Projets
> et Investissements de la **DPE / SENELEC**. Évolution Enterprise de la **V1 existante**
> (38 pages · 20 stores · 42 composants · RBAC/ABAC/GED/ODM/BOQ/EVM/GIS/IA/Dashboards).
> **Principe directeur : ne jamais repartir de zéro — capitaliser sur la V1.**

## Livraison par étapes

| Étape | Livrable | Fichier | Statut |
|:--:|----------|---------|:------:|
| 1 | Architecture fonctionnelle complète | `01_architecture_fonctionnelle.md` | ✅ |
| 2 | Modèle organisationnel DPE détaillé | `02_organisation_dpe.md` | ✅ |
| 3 | Matrice RBAC complète par poste réel | `03_rbac_par_poste.md` | ✅ |
| 4 | Modèle de données complet | `04_modele_donnees.md` | ✅ |
| 5 | Module Portefeuille | `05_module_portefeuille.md` | ✅ |
| 6 | Matrice ABAC | → `../architecture/03_livrables.md` §12 (V1) | ♻️ |
| 7 | Navigation & UX | → `lib/authStore.tsx` + `components/layout/Sidebar.tsx` (V1) | ♻️ |
| 8 | Workflows BPMN | → `../architecture/02_architecture.md` §4 (V1) | ♻️ |
| 9 | Dashboards | → `03_livrables.md` §10 (V1) | ♻️ |
| 10 | Data Hub | `04_modele_donnees.md` §2 | ✅ |
| 11 | Knowledge Graph | `04_modele_donnees.md` §3 | ✅ |
| 12 | Project Factory IA | → `02_architecture.md` §6 + `backend-enterprise/.../ai` (V1) | ♻️→ |
| 13 | Agents IA (22) | `02_architecture.md` §6 + `agents.registry.ts` | ♻️→ |
| 14 | APIs | `backend-enterprise/README.md` + GraphQL `schema.gql` (V1) | ♻️ |
| 15 | Structure Frontend | `app/(dashboard)/` + `components/` + `lib/` (V1) | ♻️ |
| 16 | Structure Backend | `backend-enterprise/src/` (NestJS/DDD/CQRS) (V1) | ♻️ |
| 17 | Génération code module par module | Portefeuille → Programmes → Projets → … | ⏭️ |

Légende : ✅ produit ici · ♻️ déjà livré en V1 (réutilisé, non refait) · ⏭️ à venir.

## Référentiels existants réutilisés (ne pas refaire)
- `docs/architecture/01_data_model.sql` — schéma SQL + RLS.
- `docs/architecture/02_architecture.md` — DDD/CQRS, BPMN, API, agents IA, RAG, stack.
- `docs/architecture/03_livrables.md` — matrices RBAC/ABAC, GraphQL, RAG, dashboards, déploiement.
- `backend-enterprise/` — NestJS organization-driven (org-scope prouvé 7/7, GraphQL, RLS, 18 modules).
- App Next.js — 38 pages, sécurité org appliquée à tout (menus/données/édition).

## Suite proposée (Étape 17 — génération module par module)
1. **Portefeuille** (spec Étape 5) → onglets EPS / Priorisation / Arbitrages / Comité + API.
2. **Programmes** → bénéfices, dépendances, cadre logique.
3. **Projets** → OBS/changements/livrables (compléter l'existant).
4. **Marchés**, **Finances**, **Immobilisations**, **S&E**, **Data Hub**, **Knowledge Graph**.

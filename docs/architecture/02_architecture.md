# SIGEPP-DPE — Architecture Enterprise (Blueprint exploitable)

> Système Intégré de Gouvernance, d'Exécution et de Pilotage des Projets — DPE/SENELEC.
> Niveau cible : Oracle Primavera P6 / Oracle Unifier / SAP PPM / MS Project Enterprise.
> **Principe fondateur : Organization-Driven** — l'organisation est le référentiel maître ;
> tous les objets métier (projet, marché, budget, KPI, risque, document, mission…) en héritent.

---

## 1. Architecture applicative (DDD / CQRS / Event-Driven)

```
┌────────────────────────────────────────────────────────────────────┐
│  FRONTEND  React + TypeScript + Material UI + AG Grid Enterprise     │
│  (l'app SIGEPP-DPE actuelle = client de référence des écrans/UX)     │
└───────────────┬────────────────────────────────────────────────────┘
                │ REST + GraphQL (BFF)
┌───────────────▼────────────────────────────────────────────────────┐
│  API GATEWAY (NestJS)  — AuthN Keycloak (OIDC/SSO/MFA) + ABAC guard  │
├──────────────────────────────────────────────────────────────────── ┤
│  BOUNDED CONTEXTS (NestJS modules, DDD)                              │
│   • Organisation & RH (référentiel maître)                          │
│   • Portefeuille / Programme / Projet                               │
│   • Planning (WBS, baseline, EVM)        • Marchés & Contrats        │
│   • Finances & Attachements (BOQ)        • Immobilisations           │
│   • UAGL & Logistique (ODM, flotte, pointage, salles)               │
│   • GED (MinIO)        • GIS (ArcGIS)    • Suivi-Évaluation / KPI    │
│   • Workflow (Camunda 8)  • Low-Code  • AI Center (LangGraph/RAG)    │
│  CQRS : Commands (write) → Events (Kafka/Outbox) → Read models       │
└───────────────┬───────────────┬───────────────┬─────────────────────┘
        PostgreSQL          Redis          Elasticsearch
        (source of truth)   (cache)        (recherche sémantique + RAG)
        Camunda 8 (workflow) · MinIO (GED) · ArcGIS (GIS) · Power BI Embedded
```

CQRS : chaque commande émet un **Domain Event** (transactional outbox) consommé pour
construire les **read models** (dashboards, recherche) et déclencher les workflows Camunda.

---

## 2. Modèle de sécurité à 5 dimensions (ABAC + Org Hierarchy)

| Dimension | Source | Mise en œuvre |
|-----------|--------|---------------|
| **1. Organisation** | `org_unit.path` (arbre matérialisé) | RLS PostgreSQL `can_see_path()` (cf. `01_data_model.sql`) |
| **2. Fonction** | `poste.niveau_fonctionnel`, `user_affectation.role_code` | Guard ABAC NestJS |
| **3. Projet** | `projet.org_path` + implication (chef/membre) | RLS + policy d'implication |
| **4. Workflow** | `workflow_instance.org_path` + rôle d'étape | Camunda candidate-groups dérivés de l'org |
| **5. Document** | `document.org_path` | RLS + ACL MinIO |

**Règle absolue** (encodée en SQL) : un utilisateur voit *son unité + ses sous-unités*,
**jamais les unités parallèles**. Héritage automatique : projet caché ⇒ KPI / rapports /
documents / contrats / analyses IA correspondants cachés.

**Cas vérifiés (déjà actifs dans l'app)** : Chef Projet DPT → DPT seul ; Directeur DER →
DER+DPT+DPD, jamais DEP/DGC/DIT ; S&E DEP → DEP seul ; PMO Central (CSE) & Directeur DPE → consolidé.

IAM : **Keycloak** (Entra/Azure AD federation) — OIDC, SSO, **MFA**, mapping `keycloak_sub → app_user`.
Audit : table `audit_log` **append-only** (UPDATE/DELETE révoqués) = journalisation immuable.

---

## 3. Modules (16) ↔ écrans existants

| # | Module (prompt) | Écran SIGEPP-DPE |
|---|-----------------|------------------|
| 1 | Cockpit Exécutif | `/tableau-de-bord` |
| 2 | Gouvernance Portefeuille | `/portefeuille` |
| 3 | Programmes | `/programmes` |
| 4 | Projets | `/projets`, `/cockpit-projet`, `/gestion-projet`, `/gantt`, `/wbs`, `/taches` |
| 5 | Marchés & Contrats | `/marches`, `/bordereaux` |
| 6 | Finances | `/budget`, `/evm`, `/bordereaux` (attachements BOQ), `/receptions`, `/fournisseurs` |
| 7 | Immobilisations | `/immobilisations` |
| 8 | UAGL & Logistique | `/odm`, `/flotte`, `/pointage`, `/reservation-salle` |
| 9 | RH Projet | `/rh` |
| 10 | GED | `/ged` |
| 11 | GIS | `/cartographie` |
| 12 | Suivi-Évaluation | `/suivi-evaluation`, `/reporting`, `/studio-rapports`, `/constructeur-indicateurs` |
| 13 | Administration | `/administration` |
| 14 | Workflow Studio | `/workflows` |
| 15 | Low-Code Studio | `/dashboard-builder` + Admin (Fonctions & Calculs, Critères, Canevas terrain) |
| 16 | AI Center | `/agents-ia`, `/migration`, `/copilot` |

---

## 4. Workflows BPMN (Camunda 8) — versionnés, simulables, auditables

Processus DPE (cycle de vie) à modéliser en BPMN 2.0 :

```
Identification Besoin → Étude Opportunité → APS → APD → Validation Projet
   → Inscription BIT → DAO → AO → Contrat → Exécution → Réception
   → Immobilisation → Clôture
```

Workflows transverses : Budget, Facture, **Décompte/Attachement** (entreprise→CP→UAGL),
Mission (ODM), Réservation salle, Pointage heures sup. (CP→Dépt→UAGL).
Chaque `workflow_def` est versionné (`cle`,`version`,`bpmn_xml`) ; candidate-groups dérivés
de l'organisation (`org_path` + `role_code`).

---

## 5. Surface API (REST + GraphQL)

REST (extrait) — toutes les routes filtrées par RLS (org) :
```
GET  /api/org/tree                         arbre organisationnel
GET  /api/me/scope                         mon périmètre (visible_org_paths)
GET  /api/projets?direction=&programme=    portefeuille filtré
POST /api/projets/migrate                  migration IA (multi-lots, HITL)
GET  /api/projets/:id/planning             WBS + baseline + EVM
POST /api/attachements/:id/submit|validate BOQ réalisé → paiement
GET  /api/kpi?dimension=...                KPI sécurisés (filtrage auto)
POST /api/workflows/:cle/start             instancier un process Camunda
POST /api/ai/agents/:agent/ask             agent IA (org-secured)
```
GraphQL : un schéma `Query`/`Mutation` org-aware (résolveurs appliquant `can_see_path`).

---

## 6. AI Center — moteur + agents (org-secured)

**AI Project Intelligence Engine** : OCR → NLP → classification → extraction d'entités →
analyse (contrats/budgets/planning) → détection risques → génération (WBS/KPI/reporting).
Pipeline **LangGraph + RAG** (Vector DB) ; chaque réponse respecte le périmètre du demandeur.

**Roster d'agents** (chacun hérite de la sécurité org) :
PMO Central · DEP · DPT · DPD · DGC · SIG · Immobilisation · DIT · Finance · Marchés · UAGL ·
S&E DEP/DER/DGC/DIT/CC26/CPBM-UE/PAMACEL/PADERAU · Executive.

**Migration IA** : à partir de Contrats/DAO/Bordereaux/Rapports/Plans/MS Project/Excel →
identifie Direction/Département/Programme/Bailleur/Responsables → construit Fiche/WBS/Planning/
Budget/Risques/GED → **validation humaine obligatoire**.

---

## 7. Stack & déploiement

Frontend React/TS/MUI/AG-Grid · Backend NestJS (DDD/CQRS/Event-Driven) · Camunda 8 ·
Keycloak · PostgreSQL · Redis · Elasticsearch · ArcGIS Enterprise · MinIO · Power BI Embedded ·
LangGraph/OpenAI/RAG. Déploiement conteneurisé (Docker/K8s), 1 base = source de vérité,
read-models projetés, RLS appliquée au niveau base **et** guard ABAC au niveau API.

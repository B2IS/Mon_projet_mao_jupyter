# SIGEPP — Étape 1 : Architecture fonctionnelle complète

> **SIGEPP** — Système Intégré de Gouvernance, d'Exécution et de Pilotage des Projets et
> Investissements de la **Direction Principale Équipement (DPE) / SENELEC**.
> Cible : **supérieur** à Primavera P6 · Unifier · SAP PPM · MS Project Enterprise · ServiceNow SPM.
> Ce document fait évoluer la **V1 existante** (38 pages · 20 stores · 42 composants · RBAC/ABAC/GED/
> ODM/BOQ/EVM/GIS/IA/Dashboards). **On ne repart jamais de zéro** : chaque capacité ci-dessous indique
> *(V1)* si déjà présente ou *(+)* si c'est l'ajout Enterprise.

---

## 1. Positionnement

SIGEPP n'est **pas** un logiciel de gestion de projets : c'est la **plateforme officielle de
gouvernance des investissements** de la DPE — **source unique de vérité**.

> **Aucun** projet, marché, immobilisation ou reporting officiel **hors plateforme**.
> **Toute** décision : tracée · historisée · auditable.

## 2. Les 9 principes fondateurs → traduction fonctionnelle

| # | Principe | Implémentation fonctionnelle |
|---|----------|------------------------------|
| 1 | **Organization Driven** | L'organisation = référentiel maître ; tout objet porte `org_path` *(V1)* |
| 2 | **Governance Driven** | Comités, arbitrages, décisions, jalons de gouvernance, gates de phase *(+)* |
| 3 | **Responsibility Driven** | RACI par objet, dérivé du RH (poste → responsabilité) *(+)* |
| 4 | **Portfolio Driven** | EPS, portefeuille stratégique/opérationnel, priorisation, scoring *(V1→enrichi)* |
| 5 | **Program Driven** | Programmes CPBM-UE/CC26/PAMACEL/PADERAU, bénéfices, dépendances *(V1)* |
| 6 | **Project Driven** | OBS/WBS/CBS/Gantt/baseline/EVM/risques/livrables *(V1)* |
| 7 | **Asset Driven** | Cycle pré-immo → mise en service → capitalisation → amortissement *(V1)* |
| 8 | **Data Driven** | **Data Hub** (MDM, catalogue, qualité, historisation, traçabilité) *(+)* |
| 9 | **AI Driven** | **Project Factory** + Intelligence Engine + 22 agents org-secured *(V1→enrichi)* |

## 3. Carte des capacités (Capability Map)

```
┌── GOUVERNANCE ─────────────────────────────────────────────────────────────┐
│ Stratégie · Comités · Arbitrages · Décisions · Scorecard · Gates de phase   │ (+)
├── PORTEFEUILLE & PROGRAMMES ────────────────────────────────────────────────┤
│ EPS · Portef. stratégique/opérationnel · Priorisation · Scoring · Bénéfices │ (V1→)
├── PROJETS & EXÉCUTION ───────────────────────────────────────────────────────┤
│ Charte · OBS · WBS · CBS · Gantt · Baseline · Ressources · Risques ·        │
│ Changements · Livrables · Terrain/GPS · Pointage · Avancement · Contrôle    │ (V1)
├── MARCHÉS & CONTRATS ────────────────────────────────────────────────────────┤
│ DAO · AO · Contrats · Avenants · BOQ · Décomptes/Attachements · Réceptions  │ (V1)
├── FINANCES ───────────────────────────────────────────────────────────────────┤
│ Budget/CBS · Décaissements · EVM (CPI/SPI/EAC/VAC) · Cashflow · Fournisseurs│ (V1)
├── IMMOBILISATIONS ─────────────────────────────────────────────────────────────┤
│ Pré-immo · Mise en service · Capitalisation · Amortissements                │ (V1)
├── SUIVI-ÉVALUATION & PMO ──────────────────────────────────────────────────────┤
│ KPI · Cadre logique · Santé portefeuille · Reporting officiel · Audit       │ (V1)
├── GED · GIS · UAGL ────────────────────────────────────────────────────────────┤
│ Documents/OCR/Annotation/Versioning/Signature · ArcGIS+PostGIS · ODM/Flotte │ (V1→PostGIS +)
├── DATA HUB · KNOWLEDGE GRAPH ──────────────────────────────────────────────────┤
│ MDM · Référentiels · Catalogue · Qualité · Historisation · Graphe Neo4j     │ (+)
├── IA ──────────────────────────────────────────────────────────────────────────┤
│ Project Factory · Intelligence Engine (OCR→NLP→génération) · 22 Agents · RAG│ (V1→)
├── LOW-CODE ───────────────────────────────────────────────────────────────────┤
│ Formulaires · colonnes · tableaux · KPI · dashboards · workflows · menus    │ (V1→absolu +)
└── ADMINISTRATION & SÉCURITÉ ──────────────────────────────────────────────────┘
  RBAC · ABAC · Org Security · Workflow Security · MFA · SSO · Audit Trail      (V1→MFA/SSO +)
```

## 4. Chaînes de valeur (flux fonctionnels bout-en-bout)

1. **Idée → Investissement** : Besoin → Opportunité → APS → APD → Validation → **Inscription BIT**
   → DAO → AO → Contrat → Exécution → Réception → **Immobilisation** → Clôture (BPMN Camunda, gates).
2. **Décompte (paiement)** : Entreprise saisit BOQ réalisé → Chef de Projet valide/ajuste →
   UAGL/Finance → décaissement → EVM mis à jour *(V1, CQRS backend)*.
3. **Reporting officiel** : données Data Hub (source unique) → KPI sécurisés → rapport généré
   (logo SENELEC) → diffusion selon périmètre org. **Aucun reporting hors plateforme.**
4. **Migration/Project Factory** : DAO/Contrat/Excel/MS Project → IA extrait → propose EPS/OBS/WBS/
   CBS/planning/budget/risques/KPI/GED → **validation humaine obligatoire** → objets créés.

## 5. Règle absolue de visibilité (transversale à TOUT)

Un utilisateur ne voit que **son unité + ses sous-unités + ses affectations** — jamais les unités
parallèles. Appliquée à : menus · pages · tableaux · projets · KPI · contrats · budgets · marchés ·
documents · workflows · dashboards · **APIs** · **agents IA**. *(Cœur V1 : `OrgScopeService` +
`computeVisibilityScope`, frontière `.` stricte, prouvée par test 7/7.)*

- **PMO Central / CSE** : vue **consolidée DPE**.
- **S&E affecté** : uniquement son périmètre (idem KPI, dashboards, rapports, workflows, analyses IA).
- **Édition opérationnelle** : s'arrête au **département & chef de cellule** (niveau 2) + équipe projet ;
  niveaux 0/1 = **lecture seule** *(V1, verrou `readOnlyGuard`)*.

## 6. Écart V1 → SIGEPP (ce que cette évolution ajoute)

| Domaine | V1 | Ajout Enterprise SIGEPP |
|---------|----|--------------------------|
| Données | 20 stores front + Postgres backend | **Data Hub / MDM**, catalogue, qualité, historisation, lineage |
| Graphe | — | **Knowledge Graph Neo4j** (raisonnement IA) |
| Géo | Leaflet/ArcGIS | **PostGIS** (géométrie serveur) + ArcGIS Enterprise |
| IA | Agents + migration | **Project Factory** (EPS/OBS/WBS/CBS auto) + 22 agents + RAG/Vector DB |
| Gouvernance | Workflows | **Gates de phase**, comités, scorecard, décisions historisées |
| IAM | RBAC/ABAC local | **Keycloak** SSO/MFA, fédération |
| Low-Code | Builders ciblés | **Low-Code absolu** (tout configurable) |

➡️ Étapes suivantes : **2** organisation détaillée · **3** RBAC par poste réel · **4** modèle de
données · **5** module Portefeuille. Voir `docs/architecture/02_architecture.md` et `03_livrables.md`
(blueprint technique, BPMN, API, RAG, déploiement) déjà produits pour la V1 — réutilisés, non refaits.

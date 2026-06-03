# SIGEPP-X — Architecture Fonctionnelle Complète (Étape 1)

> **Système Intégré de Gouvernance, d’Exécution et de Pilotage des Projets et Investissements**  
> Direction Principale Équipement — SENELEC  
> Version cible : Entreprise (supérieur à Primavera P6 + Unifier + SAP PPM + MS Project Enterprise)

---

## 1. Vision & Positionnement Stratégique

SIGEPP-X **n’est pas** un logiciel de gestion de projets.  
C’est la **plateforme officielle unique de gouvernance des investissements** de la DPE.

**Règle absolue** :  
Aucun projet, marché, immobilisation, budget, reporting officiel ou décision d’investissement ne doit exister en dehors de SIGEPP-X.

### 1.1 Objectifs Stratégiques
- Source unique de vérité (SSOT) pour l’ensemble du cycle de vie des investissements DPE.
- Gouvernance 100 % traçable, historisée et auditable.
- Pilotage multi-niveaux : Organisation → Portefeuille → Programme → Projet → Actif.
- Intégration native de l’IA pour l’accélération (Project Factory, analyse, reporting).
- Low-Code absolu pour la configurabilité sans développement.

### 1.2 Principes Fondateurs (non négociables)
1. **Organization Driven** — L’organisation est l’entité centrale ; tout objet en hérite.
2. **Governance Driven** — Décisions, workflows et validations sont tracés et versionnés.
3. **Responsibility Driven** — Chaque objet a un responsable unique + délégations explicites.
4. **Portfolio / Program / Project / Asset Driven** — Hiérarchie complète.
5. **Data Driven + AI Driven** — Data Hub + Knowledge Graph + Agents IA.

---

## 2. Périmètre Fonctionnel (20 Modules Cibles)

| # | Module | Description | Couverture SIGEPP V1 (existante) | Gap critique pour X |
|---|--------|-------------|----------------------------------|---------------------|
| 1 | **Organisation & Référentiels** | Structure DPE, postes, affectations, hiérarchie | Partiel (dpeOrgStructure, dpePersonnel) | MDM complet, affectations multiples, historique |
| 2 | **Portefeuille & Programmes** | EPS, programmes, alignement stratégique | Portefeuille + Programmes | Consolidation multi-programmes, scoring stratégique |
| 3 | **Gestion des Projets** | WBS, CBS, planning, baseline, EVM, jalons | Très avancé (projectStore, Cockpit, Gantt, WBS) | Project Factory IA, workflow cycle de vie complet |
| 4 | **Marchés & Contrats** | DAO, AO, contrats, avenants, pénalités | Marches + Bordereaux + Réceptions | Intégration complète avec budget et immobilisations |
| 5 | **Finances & Attachements** | Budget, engagements, décaissements, BOQ, décomptes | Budget + EVM + Bordereaux | Workflow attachement entreprise → CP → UAGL |
| 6 | **Immobilisations** | Création, réception, mise en service, amortissement | ImmobilisationStore | Lien automatique avec projets/marchés/réceptions |
| 7 | **UAGL & Logistique** | ODM, flotte, pointage, réservation salles | Complet (ODM, Flotte, Pointage, Réservation) | Intégration workflow RH & Finance |
| 8 | **RH Projet** | Affectations, compétences, charge, timesheet | RH + Suivi Temps | Compétences + plan de charge multi-projets |
| 9 | **GED & Documents** | Versioning, classification, signature, archivage | GED Store + Attachement | MinIO + classification IA automatique |
| 10 | **GIS & Cartographie** | ArcGIS Enterprise, SIG projets, actifs | ProjetsCarteLeaflet (Leaflet) | Migration vers ArcGIS Enterprise + layers actifs |
| 11 | **Suivi-Évaluation & KPI** | Indicateurs, tableaux de bord, S&E | Studio Rapports + Constructeur Indicateurs + Analytique | Data Hub + Knowledge Graph + IA narrative |
| 12 | **Workflows & Approbations** | BPMN 2.0, Camunda 8, circuits de validation | Workflows + NotificationStore | Modélisation complète des processus DPE |
| 13 | **Risques & Opportunités** | Registre, matrice, mitigation, opportunités | Risques (partiel) | Intégration avec planning, budget, marchés |
| 14 | **Low-Code Studio** | Formulaires, colonnes, dashboards, règles | Dashboard Builder + Critères + Terrain Config | Extension à tous les objets (projet, marché, etc.) |
| 15 | **AI Center & Agents** | Project Factory, OCR, NLP, Agents IA | Agents IA + Migration + Copilot (début) | 20+ Agents spécialisés + RAG + LangGraph |
| 16 | **Reporting & Analytics** | Rapports officiels, Power BI Embedded, exports | Studio Rapports + Matrice Export | Reporting IA contextualisé + conformité DPE |
| 17 | **Administration & IAM** | Utilisateurs, rôles, permissions, audit | Administration très avancée | Keycloak + MFA + SSO + Audit Trail immuable |
| 18 | **Data Hub & Qualité** | MDM, référentiels, gouvernance données, traçabilité | Absent (ou dispersé) | **Nouveau module critique** |
| 19 | **Knowledge Graph** | Graphe sémantique Organisation → Actif | Absent | **Nouveau module critique** |
| 20 | **Audit & Conformité** | Journal immuable, conformité réglementaire, traçabilité | Audit partiel (auth + notifications) | Append-only + reporting conformité |

---

## 3. Cycle de Vie des Investissements DPE (Processus Métier)

```
Identification Besoin
  → Étude Opportunité (APS)
    → APD / Validation Projet
      → Inscription BIT
        → DAO → AO → Attribution Marché
          → Exécution (Projet + Marché + Budget)
            → Réception Provisoire / Définitive
              → Mise en Service / Immobilisation
                → Clôture & Capitalisation
```

**Workflows transverses obligatoires** :
- Budget (engagement → décaissement → décompte)
- Attachement / Décompte (Entreprise → Contrôle → UAGL → Finance)
- ODM / Missions
- Réservation ressources
- Validation documents (signature électronique)

Chaque étape génère des **Domain Events** tracés.

---

## 4. Règles de Gouvernance Absolues

1. **Visibilité Organisationnelle** : Un utilisateur ne voit que son unité + ses sous-unités. Jamais les unités parallèles.
2. **Responsabilité Unique** : Chaque projet/marché/immobilisation a un Chef de Projet / Responsable unique + liste de délégués explicites.
3. **Modification** : Seul le responsable + délégués + ADMIN peuvent modifier. Les autres consultent ou proposent.
4. **Source Unique de Vérité** : Toute donnée officielle (budget, planning, rapport) provient de SIGEPP-X.
5. **Traçabilité Complète** : Toute modification = événement + acteur + horodatage + motif (si requis).
6. **Validation Humaine IA** : L’IA propose ; l’humain valide (sauf règles automatiques configurées).

---

## 5. Capacités IA Cibles (AI-Driven)

### 5.1 AI Project Factory
Entrées acceptées : DAO, Contrats, Études, FDP, Rapports, Excel, MS Project, PDF scannés.  
Sorties générées (avec validation humaine) :
- EPS / OBS
- WBS + CBS
- Planning (dates, durées, dépendances)
- Budget détaillé
- Risques & opportunités
- KPI auto-proposés
- Structure GED initiale

### 5.2 Agents IA (20+)
Chaque agent respecte RBAC + ABAC + hiérarchie organisationnelle :
- DG Agent, Executive Agent, PMO Agent
- DEP / DER / DPT / DPD / DGC / DIT Agents
- CPBM-UE, CC26, PAMACEL, PADERAU Agents
- SIG Agent, Finance Agent, Marchés Agent, Immobilisation Agent
- UAGL Agent, Risk Agent, Audit Agent, Knowledge Agent
- Migration Agent (import legacy)

### 5.3 Moteur IA Transverse
- OCR + NLP (documents scannés)
- Classification automatique
- Extraction entités (dates, montants, clauses)
- Analyse contrats / budgets / planning / risques
- Génération narrative de rapports contextualisés

---

## 6. Low-Code Absolu

Tout objet configurable sans code :
- Formulaires dynamiques (champs, règles de validation)
- Colonnes et vues (tableaux)
- KPI et formules calculées
- Workflows (règles de transition)
- Dashboards et rapports
- Menus et navigation par profil

---

## 7. Sécurité & Conformité

**Modèle à 5 dimensions** :
1. Organisation (arbre hiérarchique + RLS)
2. Fonction / Poste
3. Implication Projet (chef, membre, délégué)
4. Étape Workflow
5. Document / GED

**Technologies** :
- RBAC + ABAC
- Keycloak (SSO, MFA, federation Entra ID)
- Audit Trail append-only (PostgreSQL)
- RLS PostgreSQL pour isolation organisationnelle

---

## 8. Gap Analysis — SIGEPP V1 → SIGEPP-X

**Points forts V1 (à conserver et industrialiser)** :
- Modèle de données projets très complet (phases pondérées, jalons, WBS, EVM, zones & quantités)
- RBAC/ABAC déjà implémenté avec hiérarchie DPE réelle
- Personnel DPE réel + mapping fonction/poste
- GED + ODM + Flotte + Pointage + Immobilisations opérationnels
- Agents IA et Copilot en amorce
- Studio Rapports + Constructeur Indicateurs

**Gaps critiques à combler pour X** :
- Data Hub central + Gouvernance des données
- Knowledge Graph (Neo4j)
- Workflow Engine Camunda 8 (BPMN versionné)
- Project Factory IA complet (OCR/NLP/génération)
- 20 Agents IA spécialisés avec respect strict de la hiérarchie
- Intégration ArcGIS Enterprise (au lieu de Leaflet seul)
- Power BI Embedded pour reporting officiel
- Low-Code universel (pas seulement dashboards)
- Audit Trail immuable + reporting conformité
- Architecture DDD/CQRS/Event-Driven + API Gateway

---

## 9. Indicateurs de Succès (KPI Cibles)

- 100 % des projets DPE dans SIGEPP-X (zéro hors plateforme)
- 100 % des marchés suivis dans SIGEPP-X
- 100 % des immobilisations créées depuis SIGEPP-X
- Délai de production de reporting officiel divisé par 5
- Taux de conformité DPE ≥ 95 % (automatiquement mesuré)
- Traçabilité complète : 0 décision sans journal

---

## 10. Prochaines Étapes (selon mandat)

- **Étape 2** : Modèle organisationnel DPE détaillé (EPS, OBS, postes réels, affectations multiples)
- **Étape 3** : Matrice RBAC complète par poste réel
- **Étape 4** : Modèle de données complet (entités, relations, historisation)
- **Étape 5** : Module Portefeuille (architecture + specs fonctionnelles)

---

*Document produit conformément au mandat SIGEPP-X — 31 mai 2026.*

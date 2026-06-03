# SIGEPP — Modules à affecter par poste (fondé sur la Note de Direction N°005/2023)

> Source : ND 005/2023 portant organisation de la DPE (missions & activités par structure).
> Principe : **organization-driven** — Organisation (1er niveau) → Projets (2e) → Fonctionnalités (3e).
> Sécurité de TOUT module : **RBAC + ABAC + Hiérarchie DPE** (un agent ne voit que son unité, ses
> sous-unités et ses projets affectés — jamais les unités parallèles).

---

## 1. Sidebar principale (7 sections) — conforme à la cible

| # | Section | Contenu |
|---|---------|---------|
| 1 | **Accueil** | Cockpit adaptatif au profil |
| 2 | **Portefeuille & Projets** | Programmes · Portefeuille · Projets (fiche A→J) · Planning |
| 3 | **Exécution & Contrôle** | Terrain · Missions · Contrôles · QHSE · Risques · Alertes · GIS · Non-conformités |
| 4 | **Finances & Engagements** | Budget · EVM · Marchés/DAO · BOQ/Décomptes · Réceptions · Immobilisations |
| 5 | **Logistique & Ressources** | ODM · Flotte · Chauffeurs · RH projet · Salles · Heures sup |
| 6 | **Transverses** | GED · Courriers · Reporting T1-T4 · Studio Rapports · Workflow · Agents IA · Migration IA |
| 7 | **Paramétrage** | Organisation · Utilisateurs · Postes · Rôles · Permissions · Workflows · KPI · Référentiels · API · Audit *(Admin & Directeur DPE)* |

## 2. Fiche projet (onglets A→J = structure rapport trimestriel T1-T4)

A. Vue Générale · B. Situation Financière · C. Situation Physique · D. Performance (KPI) ·
E. Marchés · F. Réalisations (faits majeurs/livrables) · G. Contraintes (risques/blocages) ·
H. Recommandations (actions correctives/préventives) · I. Documents · J. Planning (WBS/Gantt/baseline).

## 3. Matrice MODULES PAR POSTE — traçable à la ND 005/2023

> Légende : ●=plein accès (édition selon habilitation) · ◐=lecture/consultation · —=non.
> La colonne « Périmètre » = portée ABAC calculée (org_path + affectation projet).

| Poste (ND 005) | Périmètre | Accueil | Portef./Projets | Exécution | Finances | Logistique | Transverses | Param. |
|----------------|-----------|:---:|:---:|:---:|:---:|:---:|:---:|:---:|
| **Directeur Principal Équipement** | DPE (tout, consolidé) | ● cockpit DG | ◐ tous | — | ◐ synthèse | — | ◐ reporting/IA | ● |
| **Conseillers Techniques** | DPE (tout) | ◐ | ◐ tous | ◐ | ◐ | — | ◐ analyse/IA | — |
| **Chef Cellule Suivi-Évaluation (PMO)** | DPE (consolidé) | ● cockpit PMO | ◐ tous | ◐ | ◐ | — | ● S&E/KPI/reporting | — |
| **Expert Gestion de Projet / CSE** | DPE (consolidé) | ◐ | ◐ tous | ◐ | — | — | ● S&E/reporting | — |
| **Responsable S&E affecté** *(DEP/DER/DGC/DIT/CPBM/CC26/PAMACEL/PADERAU)* | **son unité uniquement** | ● cockpit S&E | ◐ projets unité | ◐ avancement | — | — | ● KPI/reporting unité | — |
| **Coordonnateur Administration & Budget** | DPE | ◐ | ◐ | — | ● budgets | ◐ | ◐ reporting | — |
| **Directeur de Direction** *(DEP/DER/DGC/DIT)* | **sa direction + sous-unités** | ● cockpit Direction | ◐ direction (jalons/phases) | — | ◐ direction | — | ◐ reporting | — |
| **Chef de Département** *(DPT, DPD, DEP_*, DGC_*, DIT_*)* | **son département** | ● cockpit Dépt | ● projets dépt (haut niveau) | ◐ supervision | ● dépt | — | ◐ reporting | — |
| **Chefs de Cellule programme** *(CPBM-UE, CC26, PAMACEL, PADERAU)* | **sa cellule (rang dépt)** | ● cockpit cellule | ● projets/marchés/budgets cellule | ◐ | ● cellule | ◐ | ◐ reporting | — |
| **Chef de Projet** | **ses projets affectés** | ● mes projets | ● projets/planning/WBS détail | ● terrain | ● budget/EVM/marchés/BOQ | — | ◐ GED/reporting/IA | — |
| **Ingénieur d'Études** | ses tâches/activités affectées | ◐ | ● études/WBS/tâches | ● terrain/SIG | — | — | ◐ GED · Migration IA | — |
| **Contrôleur (de travaux)** | son périmètre projet | ◐ | ● détail projet | ● avancement/NC/photos/réceptions | ◐ | — | ◐ GED/reporting | — |
| **Cartographe / Géomaticien / Expert SIG** | son unité | ◐ | ◐ projets | ● Cartographie/GIS | — | — | ◐ GED | — |
| **Assistant CHEF DE PROJET** | équipe projet | ◐ | ● détail projet (édition validée par chef) | ◐ | ◐ | — | ◐ GED/courriers | — |
| **Assistante de Direction / Secrétaire / Archiviste** | son unité | ◐ | ◐ projets (lecture) | — | — | — | ● GED/Courriers/Reporting | — |
| **RAF / Finance / Comptable** | son périmètre | ◐ | ◐ | — | ● budget/AE/CP/décaissements/EVM/cashflow | — | ◐ reporting fin. | — |
| **Marchés / Passation** | son périmètre | ◐ | ◐ | — | ● DAO/DRPO/AO/contrats/avenants | — | ◐ | — |
| **Chef UAGL / Logistique** | son unité (UAGL) | ● cockpit UAGL | — | — | — | ● ODM/flotte/chauffeurs/carburant/salles | ◐ | — |
| **Chauffeur** | **ses missions/véhicules uniquement** | ◐ | — | — | — | ● ses ODM/flotte | + IA | — |
| **Service Immobilisations** *(Chef Service, groupes, agents)* | DGC / patrimoine | ◐ | ◐ | — | ● Immobilisations/MES/amortissements | — | ◐ | — |
| **QHSE / Environnement Social / HSE** | son unité | ◐ | ◐ | ● risques/QHSE/NC | — | — | ◐ reporting | — |
| **Audit interne** | tout (lecture seule) | ◐ | ◐ tout | ◐ | ◐ | ◐ | ◐ | — |
| **DSI / Administrateur** | tout | ● | ● | ● | ● | ● | ● | ● (n'intervient pas dans les validations métier) |

## 4. Ancrage ND 005/2023 (extraits → modules)

- **Expert Suivi-Évaluation** (p.5) : « mise à jour SIGP, tableau de bord d'exécution, alerter sur les
  écarts, rendre compte mensuellement » → **Suivi-Évaluation · KPI · Reporting · Alertes** (sur sa direction).
- **Départements Transport/Distribution/Conventionnelles/Renouvelables** (p.6-8) : « APS, APD, études
  d'opportunité, fiches projets (SIGP), dossiers Comité d'Investissements, DAO avec la Cellule passation,
  conventions de marché, ingénierie + suivi technique et financier, QHSE, réception des ouvrages, rapport
  de fin de projet, garantie, archivage des plans de récolement » → **Projets · Planning · Marchés/DAO ·
  Finances (suivi) · Exécution/Terrain/QHSE · Réceptions · GED · Risques · Reporting**.
- **DGC** : Génie Civil regroupé + **SIG** + **Immobilisations** (patrimoine) → **GIS · Immobilisations**.
- **UAGL** (par unité) : ODM, flotte, ressources → **Logistique** (scopé à l'unité ; UAGL DPD ≠ DPT).
- **Cellules programme** (CPBM-UE, CC26, PAMACEL, PADERAU rattachées DPE) : périmètre programme strict.

## 5. Règle de visibilité (appliquée à TOUS les modules)

`visible(objet, user)` ssi `org_path(objet) = p` OU `org_path(objet) commence par p + '.'`,
pour `p ∈ visiblePaths(user)` (frontière `.` stricte). Chaque objet porte **Direction · Département ·
Service · Programme · Projet · Responsable** → écrans, KPI, rapports, dashboards, documents, workflows,
agents IA et API filtrés automatiquement. *(Implémenté : `computeVisibilityScope` / `OrgScopeService`,
prouvé par `org-scope.spec.ts` 7/7.)*

> Exemples garantis : Directeur DER → DER uniquement ; Chef DPT → DPT ; Chef Projet DPT → ses projets ;
> Responsable S&E DPT → KPI des projets DPT ; Chauffeur DPT → ses missions. Jamais les unités parallèles.

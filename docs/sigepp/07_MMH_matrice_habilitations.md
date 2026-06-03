# SIGEPP — Annexe : Matrice Multi-dimensionnelle d'Habilitation (MMH)

> Annexe du cahier des charges SIGEPP. La MMH **remplace la matrice RBAC plate** : les accès sont
> calculés en combinant **6 dimensions**. Aucun accès n'est saisi manuellement.

## 1. Les 6 dimensions de l'habilitation

| Dimension | Source (attribut) | Où c'est calculé |
|-----------|-------------------|------------------|
| **Fonction** | `poste` / `fonction` (RH) | `getNiveauHierarchique`, `isAssistantProjet` |
| **Organisation** | `direction · département · service · programme` → `org_path` | `OrgScopeService.visiblePaths`, `computeVisibilityScope` |
| **Projet** | rattachement projet (`org_path` du projet) | `OrgScopeService.pathFilter`, `isProjectVisible` |
| **Affectation** | `user_affectation[]` (chef/membre, périmètres secondaires) | `visiblePaths` (affectations) + implication projet |
| **Étape Workflow** | `workflow_instance.etape` + rôle d'étape | gardes CQRS (attachement, pointage), candidate-groups |
| **Type d'objet** | classe métier (projet, marché, KPI, immo, doc, ODM…) | filtre `orgPath` hérité + politiques par type |

**Décision d'accès** = `permit` ssi : (Fonction autorise le module) **ET** (org_path objet ∈ périmètre)
**ET** (projet visible si objet de projet) **ET** (étape workflow autorise l'action). Frontière `.` stricte
→ **jamais d'unité parallèle**. *(Prouvé : `backend-enterprise/test/org-scope.spec.ts` 7/7.)*

## 2. Règle d'or — attributs obligatoires de tout objet

Tout objet métier (projet · marché · contrat · budget · KPI · risque · immobilisation · document ·
workflow · dashboard · ODM · agent IA) porte **obligatoirement** :
`Direction · Département · Service · Programme · Projet · Responsable`.
Dashboards, KPI, workflows, documents, IA et rapports **héritent automatiquement** de ces attributs.
**Aucune exception.**

## 3. Matrice par profil (Périmètre · Modules · Actions · Interdits · Statut)

> Statut : ✅ implémenté · ◑ partiel · ➕ à affiner. « Périmètre » = portée ABAC calculée.

### 3.1 Niveau stratégique
| Profil | Périmètre | Modules | Actions | N'a jamais | Statut |
|--------|-----------|---------|---------|-----------|:---:|
| **Directeur Principal Équipement** | DPE (tout, consolidé) | Accueil exécutif · Gouvernance · Organisation · Référentiels · Portefeuille · Programmes · Projets · Finances · Marchés · Immobilisations · PMO&S&E · GIS · GED · IA · Reporting | Arbitrer · Valider · Consulter · Exporter | Paramétrage technique · IAM | ✅ |
| **Conseiller Technique** | DPE (tout) | Gouvernance · Portefeuille · Programmes · Projets · Reporting · GIS · GED | Analyser · Recommander · Consulter | Paramétrage · Comptes · Sécurité | ✅ |
| **PMO Central / Chef Cellule S&E** | DPE (consolidé) | Portefeuille · Programmes · Projets · KPI · Risques · Reporting · Santé portefeuille · Audit projet | Consolider · Suivre · Reporter | Administration · IAM | ✅ |

### 3.2 Directeurs de direction (visibilité STRICTE à leur direction)
| Profil | Périmètre | Modules | N'a jamais | Statut |
|--------|-----------|---------|-----------|:---:|
| **Directeur DEP** | DEP + Conventionnelles + Renouvelables | Accueil · Portefeuille/Projets DEP · Finances DEP · Marchés DEP · KPI DEP · GED DEP | DER · DGC · DIT · CPBM-UE · CC26 · PAMACEL · PADERAU | ✅ |
| **Directeur DER** | DER + DPT + DPD | Accueil · Portefeuille/Projets DER · Marchés · Finances · GIS · KPI DER | DEP · DGC · DIT | ✅ |
| **Directeur DGC** | DGC + SIG + Immobilisations | Génie Civil · SIG · Immobilisations · GED · KPI | DEP · DER · DIT | ✅ |
| **Directeur DIT** | DIT + Smart Grid + Commercial | Innovation · Smart Grid · Commercial · KPI | DEP · DER · DGC | ✅ |

### 3.3 Cellules programme (périmètre programme STRICT)
| Profil | Périmètre | Modules | Statut |
|--------|-----------|---------|:---:|
| **CPBM-UE** | CPBM-UE uniquement | Portefeuille · Projets · Marchés · KPI · GED CPBM-UE | ✅ |
| **CC26** | CC26 uniquement | Portefeuille · Projets · KPI · GED CC26 | ✅ |
| **PAMACEL (CPAMACEL&EE)** | PAMACEL uniquement | Portefeuille · Projets · KPI | ✅ |
| **PADERAU (CPADERAU)** | PADERAU uniquement | Portefeuille · Projets · KPI | ✅ |

### 3.4 Départements & équipe projet
| Profil | Périmètre | Modules | N'a jamais | Statut |
|--------|-----------|---------|-----------|:---:|
| **Chef de Département DPT** | DPT | Projets · Planning · WBS · Risques · Marchés · GED · KPI | DPD · DEP · DGC · DIT | ✅ |
| **Chef de Département DPD** | DPD | Projets · Planning · Marchés · KPI · GED | DPT · DEP · DGC · DIT | ✅ |
| **Chef de Projet** | **ses projets affectés** | Mes Projets · Planning · WBS · Tâches · GED projet · Risques · BOQ · Décomptes · Rapports | Les autres projets du département | ✅ |
| **Ingénieur Projet** | activités/tâches affectées | Tâches · Planning · Documents · Avancement | Budgets complets · Contrats complets | ◑ |
| **Contrôleur de Travaux** | son périmètre | Terrain · Contrôles · Réceptions · Photos · Non-conformités | Finances · Budgets · Marchés | ➕ |
| **Responsable S&E (affecté)** | **son unité uniquement** (ex. S&E DPT → DPT) | KPI · Projets · Dashboards · Rapports · IA — de son unité | DPD/DEP/… (unités parallèles) | ✅ |

### 3.5 Fonctions transverses (par périmètre)
| Profil | Périmètre | Modules | N'a jamais | Statut |
|--------|-----------|---------|-----------|:---:|
| **Finance / RAF** | son périmètre | Budgets · Décaissements · EVM · Cashflow · Réceptions financières | hors périmètre | ✅ |
| **Marchés** | son périmètre | DAO · DRPO · AO · Contrats · Avenants · Décomptes | hors périmètre | ◑ |
| **UAGL** | son unité | ODM · Flotte · Véhicules · Chauffeurs · Carburant · Salles | autre unité (UAGL DPD ≠ DPT) | ✅ |
| **SIG** | son unité | Cartographie · Réseaux · Actifs · Géolocalisation | données financières | ◑ |
| **Immobilisations** | DGC / patrimoine | Actifs · Immobilisations · Capitalisation · MES · Amortissements | tâches projet détaillées | ◑ |
| **Audit** | DPE (tout) | Tout en **lecture seule** · audit · historique complet | toute écriture | ◑ |
| **DSI / Administrateur** | global | Utilisateurs · Rôles · Permissions · Intégrations · Workflows · Paramétrage | **ne valide jamais** un processus métier | ✅ |

## 4. Mapping d'implémentation (dimension → code)

```
Fonction      → RoleCode + poste (isAssistantProjet, getNiveauHierarchique)
Organisation  → org_path matérialisé ; OrgScopeService.pathFilter() (frontière '.')
Projet        → projet.org_path + implication (chef/membre) ; isProjectVisible()
Affectation   → user_affectation[] (périmètres secondaires) ; visiblePaths()
Workflow      → statut d'étape + rôle ; gardes CQRS (Submit/Validate/Reject), pointage CP→Dépt→Salaires
Type d'objet  → toutes les tables portent orgPath ; RLS PostgreSQL can_see_path() + policies par type
```

Front : `ROLE_SECTIONS` / `ROLE_NAV_ITEMS` (Fonction → modules) × `computeVisibilityScope` (Organisation/
Projet/Affectation) × `readOnlyGuard` / `isOperationalReadOnly` (Workflow/édition). Back : `OrgScopeService`
+ RLS (défense en profondeur) + GraphQL org-aware.

## 5. Écarts à affiner (➕ / ◑) — par rapport à la MMH

1. **Contrôleur de Travaux** : la MMH le prive de Finances/Budgets/Marchés. Aujourd'hui le rôle
   `CONTROLEUR` partage le périmètre du chef de projet (incl. finances). → distinguer par **poste**
   « Contrôleur de Travaux » vs « Contrôleur de Projet » (ABAC), comme pour l'assistant.
2. **Marchés / SIG / Immobilisations / Audit** : profils définis par **fonction** sans rôle dédié.
   → ajouter des fonctions (poste-based) ou des rôles `MARCHES`, `SIG`, `IMMO`, `AUDIT` pour coller
   exactement aux modules/interdits de la MMH (ex. SIG sans finances ; Audit lecture seule globale).
3. **Ingénieur** : masquer « budgets complets / contrats complets » (lecture limitée).

> Ces écarts sont des **affinages de fonction** (poste), pas des trous de sécurité : la règle de
> visibilité organisationnelle (périmètre) est déjà garantie pour TOUS les profils.

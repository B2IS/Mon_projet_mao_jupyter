# SIGEPP — Étape 2 : Modèle organisationnel DPE détaillé

> Référentiel **maître**. Source : organigramme officiel DPE (ND 005/2023) + effectif réel
> (Fichier du personnel au 10/03/2026). Encodé dans `lib/dpeOrgStructure.ts` / `accessEngine.ts`.

---

## 1. Arbre organisationnel (chemin matérialisé `org_path`)

```
DPE  (Direction Principale Équipement) ........................ niveau 0
├── CT   — Conseillers Techniques ............................. niveau 0 (état-major)
├── CAB  — Coordination Administration Budget ................. niveau 1
├── CSE  — PMO Central / Cellule Suivi-Évaluation ............. niveau 0 (consolidé DPE)
├── DEP  — Dir. Équipement Production .......................... niveau 1
│   ├── DEP_PEC — Dépt Énergies Conventionnelles .............. niveau 2
│   └── DEP_PER — Dépt Énergies Renouvelables ................. niveau 2
├── DER  — Dir. Équipement Réseaux ............................. niveau 1
│   ├── DPT — Dépt Projets Transport .......................... niveau 2
│   └── DPD — Dépt Projets Distribution ....................... niveau 2
├── DGC  — Dir. Génie Civil .................................... niveau 1
│   ├── DGC_INVEST — Dépt Investissements GC .................. niveau 2
│   ├── SIG        — Service SIG .............................. niveau 2
│   └── IMMO       — Service Immobilisations .................. niveau 2
├── DIT  — Dir. Innovation & Technologies ...................... niveau 1
│   ├── DIT_SMARTGRID — Smart Grid ............................ niveau 2
│   └── DIT_COMMERCIAL — Commercial ........................... niveau 2
├── CPBM_UE  — Coordination Programmes BM-UE ......... niveau 2 (rang département, ⟂ DPE)
├── CC26     — Coordination Compact 2026 (MCA) ....... niveau 2 (rang département, ⟂ DPE)
├── CPAMACEL_EE — Coordination PAMACEL & Eff. Énerg. . niveau 2 (rang département, ⟂ DPE)
└── CPADERAU — Coordination Programme PADERAU ........ niveau 2 (rang département, ⟂ DPE)
```

> **CPBM-UE, CC26, PAMACEL, PADERAU** = unités organisationnelles **spécialisées de niveau
> départemental**, **directement rattachées à la DPE** (parallèles aux directions, pas sous DER).
> Leurs chefs de cellule ont le **rang de chef de département (niveau 2)**.

## 2. Niveaux hiérarchiques (calculés, jamais saisis)

| Niveau | Portée | Unités / rôles | Vue |
|:------:|--------|----------------|-----|
| **0** | Consolidé DPE | Directeur DPE, Conseillers Tech., **PMO Central/CSE**, Admin | Global / stratégique |
| **1** | Direction entière | Directeurs DEP/DER/DGC/DIT, CAB | Sa direction + sous-unités |
| **2** | Département / cellule | Chefs DPT/DPD/DEP_*/DGC_*/DIT_*, **chefs de cellule CPBM/CC26/PAMACEL/PADERAU**, Chef de Projet, Ingénieur, Contrôleur | Son département/cellule strict |
| **3** | Agent support | Assistant, Secrétaire, Chauffeur, UAGL | Son unité (consultation) |

Règle de calcul (`getNiveauHierarchique`) : Directeur DPE/Admin/CSE → 0 ; rôle PMO → 1 ;
`departement` renseigné → 2 ; **chef de cellule programme → 2** ; CHEF_DEPT direction → 1 ;
fonction « directeur » → 1 ; chef projet/ingénieur/contrôleur/expert/chargé → 2 ; sinon 3.

## 3. Règle absolue de visibilité (formalisée)

Soit `P(u)` l'ensemble des chemins visibles de l'utilisateur `u` :
```
P(u) = { org_path(u) } ∪ { affectations secondaires }            si niveau(u) ∈ {1,2,3}
P(u) = { tous les chemins }                                       si u ∈ {DPE, CSE}  (consolidé)
```
Un objet d'`org_path = x` est visible **ssi** `∃ p ∈ P(u) : x = p OU x commence par p + '.'`
(**frontière `.` stricte** — aucune fuite d'unité parallèle, même en collision de préfixe).
*Prouvé : `backend-enterprise/test/org-scope.spec.ts` (7/7).*

## 4. Référentiel RH central

Chaque utilisateur (`app_user`) :

| Champ | Rôle |
|-------|------|
| `matricule` | identifiant unique |
| `nom`, `prenom` | identité |
| `poste`, `fonction` | métier → dérive le niveau fonctionnel |
| `direction`, `departement`, `service` | rattachement → `org_path` |
| `superieur_id` | ligne hiérarchique |
| `niveau_hierarchique` | **calculé** (0–3) |
| `affectations[]` | **multi-affectation** (unité + rôle) → périmètres additionnels |

➡️ **Permissions calculées automatiquement** depuis (poste × org_path × affectations).
**Aucune permission manuelle.** Toute modification d'affectation recalcule le périmètre.

## 5. Mapping postes réels → rôles RBAC (extrait — détaillé à l'Étape 3)

| Poste réel (roster) | Rôle SIGEPP | Niveau |
|---------------------|-------------|:------:|
| Directeur Principal Équipement | `DIR_DPE` | 0 |
| Chef de Cellule Suivi-Évaluation / CSE | `PMO` | 0 |
| Coordinateur CPBM-UE / CC26 / PAMACEL / PADERAU | `CHEF_DEPT` | **2** |
| Chef de Département (DPT, DPD, DEP_*, DGC_*, DIT_*) | `CHEF_DEPT` | 2 |
| Chef de Projet | `CHEF_PROJ` | 2 |
| Ingénieur d'Étude / Dessinateur / Cartographe | `INGENIEUR` | 2 |
| Contrôleur de Projet | `CONTROLEUR` | 2 |
| Comptable / Contrôleur financier | `CTRL_FIN` | 2 |
| Chef UAGL / Logistique | `RESP_LOG` | 2 |
| Assistant·e de direction | `ASSISTANT` | 3 |
| Secrétaire / Archiviste | `SECRETAIRE` | 3 |
| Chauffeur | `CHAUFFEUR` | 3 |

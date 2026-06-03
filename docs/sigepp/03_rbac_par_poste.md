# SIGEPP — Étape 3 : Matrice RBAC complète par poste réel

> Les **rôles** sont dérivés du **poste** ; les **droits données** (RBAC) sont **intersectés** avec le
> **périmètre organisationnel** (ABAC, Étape 6). Aucune permission n'est saisie : tout est calculé.
> Source : `lib/authStore.tsx` (ROLE_SECTIONS / ROLE_NAV_ITEMS / moduleAccess) + `accessEngine.ts`.

---

## 1. Capacités (verbes) gouvernées

`VOIR` (lecture) · `EDITER` (CRUD opérationnel) · `VALIDER` (gate/workflow) · `CONSOLIDER`
(vue multi-unités) · `CONFIGURER` (low-code/admin) · `MIGRER` (Project Factory).

## 2. Matrice Poste × Module × Capacité

Légende : 👁 voir · ✏️ éditer · ✅ valider · 📊 consolidé · ⚙️ configurer · — aucun.

| Poste (rôle) | Niv | Gouvernance | Portef. | Projets/Planning | Marchés | Finances | Immo | S&E/KPI | GED | UAGL | IA | Migration | Admin |
|---|:--:|:--:|:--:|:--:|:--:|:--:|:--:|:--:|:--:|:--:|:--:|:--:|:--:|
| **Directeur DPE** (DIR_DPE) | 0 | ✅ | 📊 | 👁 | 👁 | 📊 | 👁 | 📊 | 👁 | 👁 | ✅IA | — | — |
| **PMO Central / S&E DPE** (PMO/CSE) | 0 | 👁 | 📊 | 👁 | 👁 | 📊 | — | 📊✅ | 👁 | — | ✅IA | ✅ | — |
| **Directeur d'unité** (DEP/DER/DGC/DIT) | 1 | ✅ | 👁 | 👁 | 👁 | 👁 | — | 👁 | 👁 | 👁 | ✅IA | — | — |
| **Chef de Département** | 2 | — | 👁 | ✏️✅ | ✏️ | ✏️ | — | 👁 | ✏️ | 👁 | ✅IA | ✅ | — |
| **Chef de Cellule** (CPBM/CC26/PAMACEL/PADERAU) | 2 | — | 👁 | ✏️✅ | ✏️ | ✏️ | — | 👁 | ✏️ | 👁 | ✅IA | ✅ | — |
| **Chef de Projet** | 2 | — | — | ✏️✅ | ✏️ | ✏️ | — | 👁 | ✏️ | — | ✅IA | ✅ | — |
| **Ingénieur / Études** | 2 | — | — | ✏️ | — | — | — | 👁 | ✏️ | — | ✅IA | ✅ | — |
| **Contrôleur de Projet** (équipe CP) | 2 | — | — | ✏️* | ✏️* | ✏️* | — | 👁 | ✏️* | — | ✅IA | — | — |
| **Assistant CP** (équipe CP) | 3 | — | — | ✏️* | ✏️* | 👁 | — | 👁 | ✏️* | — | ✅IA | — | — |
| **Finance / Marchés** (CTRL_FIN) | 2 | — | — | 👁 | ✏️ | ✏️✅ | ✏️ | 👁 | 👁 | — | ✅IA | — | — |
| **UAGL / Logistique** (RESP_LOG) | 2 | — | — | — | 👁 | 👁 | — | — | — | ✏️✅ | ✅IA | — | — |
| **Secrétaire / Archiviste** | 3 | — | — | — | — | — | — | — | ✏️ | — | ✅IA | — | — |
| **Chauffeur** | 3 | — | — | — | — | — | — | — | — | 👁(ses ODM) | ✅IA | — | — |
| **Administrateur** | — | ⚙️ | ⚙️ | ⚙️ | ⚙️ | ⚙️ | ⚙️ | ⚙️ | ⚙️ | ⚙️ | ⚙️ | ✅ | ⚙️ |

`*` = édition **soumise à validation du Chef de Projet** (équipe projet). `📊` = consolidé réservé **DPE/CSE**.

## 3. Règles transversales (déjà implémentées en V1)

1. **IA pour tous** : Agents IA + Copilot accessibles aux 14 rôles (sécurité au niveau *données* via scope).
2. **Migration IA réservée** : Chef de Projet · Chef de Département · Ingénieur · **Chef de Cellule (PMO)** · Admin.
3. **Édition opérationnelle** (planning/WBS/tâches/terrain/gestion) : **niveau 2 + équipe projet** ;
   niveaux 0/1 = **lecture seule** (verrou `readOnlyGuard` + `isOperationalReadOnly`).
4. **KPI consolidés / indicateurs énergie DPE** : **DPE + CSE** uniquement.
5. **Modifier** un objet ⇒ poste habilité **ET** objet dans le périmètre org **ET** (si projet) implication.

## 4. Du poste réel au droit effectif (algorithme)

```
droit_effectif(user, objet, action) =
      capacite_role(poste(user), module(objet), action)        // RBAC (cette matrice)
  AND visible(objet.org_path, P(user))                          // ABAC org (Étape 6)
  AND ( action ≠ EDITER OR niveau(user) ≥ 2 )                   // plafond opérationnel
  AND ( action ≠ EDITER OR implique(user, objet) OR role ∈ {CHEF_DEPT,ADMIN} )
  AND ( action ≠ VALIDER OR habilite_gate(poste(user), etape) ) // Workflow security
```

➡️ La matrice RBAC est **configurable** (Low-Code / Administration → Habilitations par rôle), mais le
rôle reste autoritaire : un Directeur (niveau 0) n'édite jamais l'opérationnel même habilité.

# SIGEPP-DPE

Plateforme intégrée de gouvernance, d'exécution et de pilotage des projets d'équipement pour la Direction du Patrimoine et des Équipements (DPE) — SENELEC. Couvre l'ensemble du cycle de vie des projets d'investissement : planification, EVM, marchés publics, contrôle terrain, gestion des actifs, analyse IA de dossiers, et reporting exécutif.

**Production :** https://sigeppdpe.vercel.app  
**Repo :** https://github.com/B2IS/Mon_projet_mao_jupyter (`master` = prod · `sigepp-deploy` = dev)

---

## Stack

| Couche | Lib | Version |
|--------|-----|---------|
| Framework | Next.js (App Router) | 15.3.9 |
| UI | React | 19.0.0 |
| Typage | TypeScript strict | 5.x |
| Runtime | Node.js | ≥ 20 |
| État | Zustand | 5.0.13 |
| CSS | Tailwind CSS v4 (PostCSS) | 4.x |
| Icônes | Lucide React | 0.460.0 |
| Graphiques | Recharts | 2.12.0 |
| Cartes | Leaflet + react-leaflet | 1.9.4 / 5.0.0 |
| PDF | pdfjs-dist (client-side) | 3.11.174 |
| Excel | xlsx | 0.18.5 |
| Word (import) | mammoth | 1.12.0 |
| Word (export) | docx | 9.7.1 |
| ZIP | jszip | 3.10.1 |
| IA | groq-sdk | 1.2.1 |
| Notifications | react-hot-toast | 2.4.1 |
| Hébergement | Vercel | — |

---

## Architecture

### Routes (App Router)

```
app/
├── (auth)/                  login, reset mot de passe
├── (dashboard)/             routes protégées + sidebar
│   ├── tableau-de-bord/
│   ├── springboard/         tableau de bord personnalisable
│   ├── portefeuille/        vue portefeuille multi-projets
│   ├── projets/             liste des projets
│   ├── gestion-projet/      pilotage opérationnel
│   ├── cockpit-projet/      KPIs temps réel d'un projet
│   ├── taches/              WBS + tâches
│   ├── gantt/               planning Gantt
│   ├── wbs/                 structure de décomposition
│   ├── evm/                 Earned Value Management (CPI/SPI)
│   ├── budget/              budgets, courbes S, engagements
│   ├── marches/             DAO / AO / contrats / décomptes
│   ├── bordereaux/          bordereaux de prix
│   ├── receptions/          réception de travaux
│   ├── risques/             registre des risques
│   ├── suivi-evaluation/    indicateurs de performance
│   ├── analytique/          tableaux analytiques
│   ├── reporting/           rapports consolidés
│   ├── studio-rapports/     constructeur de rapports
│   ├── dashboard-builder/   constructeur de tableaux de bord
│   ├── constructeur-indicateurs/
│   ├── immobilisations/     actifs / patrimoine
│   ├── structuration/       décomposition actifs par IA
│   ├── cartographie/        SIG / Leaflet
│   ├── ged/                 gestion électronique de documents
│   ├── courriers/           registre courriers in/out
│   ├── workflows/           circuits de validation
│   ├── parapheur/           signature électronique
│   ├── rh/                  ressources humaines DPE
│   ├── pointage/            pointage terrain
│   ├── gestion-temps/       feuilles de temps
│   ├── suivi-temps/         suivi des temps par projet
│   ├── terrain/             rapports terrain + contrôles
│   ├── odm/                 ordres de mission
│   ├── flotte/              gestion de flotte
│   ├── reservation-salle/
│   ├── fournisseurs/        référentiel fournisseurs
│   ├── programmes/          programmes d'investissement
│   ├── erp-interface/       connecteur ERP SENELEC
│   ├── agents-ia/           assistant IA multimodal + Copilot
│   ├── migration/           import + analyse IA de dossiers projets
│   ├── administration/      utilisateurs, rôles, audit
│   ├── alertes/             moteur d'alertes configurable
│   └── copilot/             Copilot M365
└── api/
    ├── ai/copilot/          POST — chat contextuel Groq
    ├── integrations/
    │   ├── arcgis/          proxy ArcGIS REST
    │   └── oracle/          proxy Oracle EBS
    └── swarm/               POST — exécution pipeline multi-agents
```

### Gestion d'état — Zustand stores

Tous les stores utilisent le middleware `persist` (localStorage). Ils sont des modules `'use client'` — aucun n'est exécuté côté serveur.

| Store | Domaine |
|-------|---------|
| `projectStore` | Projets, tâches, jalons, dépendances |
| `authStore` | Session, RBAC, profils de test |
| `immobilisationStore` | Actifs, composants, sous-composants |
| `structurationStore` | Pipeline de décomposition IA des actifs |
| `pointageStore` | Pointages terrain |
| `tempsStore` | Saisies de temps |
| `parapheurStore` | Circuit de signature |
| `orgConfigStore` | Structure organisationnelle SENELEC |
| `permissionStore` | Surcharges de scope RBAC par rôle |
| `auditStore` | Journal d'audit global |
| `alertConfigStore` | Règles et seuils d'alertes |
| `odmConfigStore` | Configuration et règles ODM |
| `terrainConfigStore` | Templates rapports terrain |
| `zonesQuantitesStore` | Zones et quantités BEST (BOQ) |
| `criteriaStore` | Critères d'évaluation fournisseurs |
| `mobileSyncStore` | Queue de synchronisation hors-ligne |
| `timesheetStore` | Feuilles de temps consolidées |
| `indicatorStore` | KPIs configurés |
| `notificationStore` | Notifications in-app |
| `decompteCircuitStore` | Circuit de validation des décomptes |
| `attachementStore` | Pièces jointes et métadonnées GED |
| `passwordPolicyStore` | Politique de mots de passe |
| `meetingRoomStore` | Réservations de salles |

### RBAC

Défini dans `lib/authStore.tsx`, résolu par `lib/accessEngine.ts`, référence des profils dans `lib/profilsDPEOfficiels.ts`.

Rôles :

```
DIR_DPE  PMO  CHEF_PROJ  CHEF_DEPT  INGENIEUR  EXPERT
CONTROLEUR  CHARGE  ASSISTANT  SECRETAIRE  CHAUFFEUR
CTRL_FIN  RESP_LOG  MARCHES  SIG  IMMO  AUDIT
CONTROLEUR_TRAVAUX  ADMIN
```

Le scope de visibilité (directions, projets, périmètre financier) est calculé à la connexion via `computeVisibilityScope(profile, override)`. Les surcharges sont stockées dans `permissionStore.roleScopes`.

---

## Pipeline IA — analyse de dossiers projets

### Architecture swarm (`lib/migration/llmSwarm.ts`)

Pipeline LangGraph-inspired à 5 nœuds partageant un état commun (`SwarmState`) :

```
NODE 1  DocClassifier      classification des types de documents
NODE 2  ProjectExtractor   métadonnées projet, BIT codes, bailleur vs titulaire
NODE 3  BudgetAnalyst      montants, lots, devises (FCFA/USD/EUR), bordereau
NODE 4  RiskAssessor       risques identifiés et criticité
NODE 5  QAAgent            validation croisée, score de confiance global
```

Modèles Groq par ordre de priorité :
1. `llama-3.3-70b-versatile`
2. `llama-3.1-8b-instant`
3. `mixtral-8x7b-32768`
4. `gemma2-9b-it`
5. Heuristique locale (fallback sans réseau)

Context budgets :

| Nœud | Docs prioritaires | Autres | Total |
|------|------------------|--------|-------|
| DocClassifier | 1 500 c/doc | — | variable |
| ProjectExtractor | 12 000 c/doc | 3 000 c/doc | ~70 k |
| BudgetAnalyst | 10 000 c/doc | 4 000 c/doc | ~45 k |
| RiskAssessor | 6 000 c/doc | 3 000 c/doc | ~30 k |

### Extraction de texte (`lib/docText.ts`)

Extraction entièrement client-side :

| Format | Lib | Notes |
|--------|-----|-------|
| PDF | pdfjs-dist | worker depuis `/public/pdf.worker.min.js` ; max 60 pages |
| XLSX / XLS | xlsx | mode array_buffer |
| DOCX | mammoth | extractRawText |
| ZIP | jszip | récursif sur les fichiers contenus |
| TXT / CSV / JSON / XML / MD | FileReader | lecture directe |

Le texte est pré-extrait à l'upload et stocké dans `doc.extractedText`. La re-lecture du fichier brut n'a lieu qu'en fallback pour les documents sans texte pré-extrait.

---

## Variables d'environnement

| Variable | Usage |
|----------|-------|
| `NEXT_PUBLIC_GROQ_API_KEY` | Clé API Groq — toujours lue via `getKey()` dans `lib/groqChat.ts` |

`getKey()` applique la priorité : `localStorage['groq_api_key']` > variable d'environnement. Ne jamais injecter la clé directement dans un composant.

---

## Setup local

```bash
git clone https://github.com/B2IS/Mon_projet_mao_jupyter
cd Mon_projet_mao_jupyter
git checkout sigepp-deploy

npm install
echo "NEXT_PUBLIC_GROQ_API_KEY=gsk_..." > .env.local

npm run dev      # http://localhost:3000
npm run build
npm run clean    # rm -rf .next
```

Comptes de démonstration (mot de passe : `dpe2026`) :

| Email | Rôle |
|-------|------|
| `directeur@dpe.sn` | DIR_DPE |
| `pmo@dpe.sn` | PMO |
| `chef.dept@dpe.sn` | CHEF_DEPT |

---

## Notes de build

### pdfjs-dist — fallback `canvas`

pdfjs-dist tente de résoudre le module natif `canvas` (absent sur Vercel). Workaround dans `next.config.ts` :

```ts
webpack: (config) => {
  config.resolve.fallback = { ...config.resolve.fallback, canvas: false };
  return config;
},
```

### SWC — génériques dans les fichiers `.tsx`

SWC interprète `new Map<K, V>()` comme du JSX (`<K,` = ouverture de tag). Dans tout fichier `.tsx` :

```ts
// ✗  new Map<string, string>()
// ✓  let m: Map<string, string> = new Map()
```

### Next.js 15 — `useSearchParams()` sans Suspense

`useSearchParams()` dans un composant `'use client'` provoque une erreur de prerender en production si le composant parent n'est pas un `<Suspense>` côté serveur. `export const dynamic = 'force-dynamic'` dans un fichier `'use client'` **n'est pas traité** par le build — ce n'est pas un contournement valide. Solution : supprimer `useSearchParams` ou séparer en un server component wrappant le client component dans `<Suspense>`.

### Leaflet — SSR désactivé

```ts
const Map = dynamic(() => import('./MapComponent'), { ssr: false });
```

### GitHub — limite 100 MB

Tout fichier > 100 MB doit être dans `.gitignore` avant le premier commit. En cas de commit accidentel : `git filter-branch --index-filter 'git rm --cached --ignore-unmatch <path>'`.

---

## Déploiement Vercel

- Projet : `bis-s-projects/sigepp_dpe`
- Team : `team_6ChblNDD4gNQ8J9jpAYGjU6k`
- Alias : `sigeppdpe.vercel.app`
- Branche déclenchante : `master`

Le push sur `master` déclenche automatiquement un build. Ne pas lancer `npx vercel --prod` en parallèle d'un push GitHub — les builds se mettent en file et se bloquent. En cas de file bloquée, annuler via l'API Vercel (`PATCH /v12/deployments/:id/cancel`) avant de retrigger.

`NEXT_PUBLIC_GROQ_API_KEY` doit être configurée dans Vercel → Settings → Environment Variables.

---

© SENELEC — Direction Principale Équipement. Usage interne.

# SIGEPP-DPE — Système Intégré de Gouvernance, d'Exécution et de Pilotage de Projet

**Direction Principale Équipement (DPE) — SENELEC**  
Application Next.js pour le pilotage multi-projets, la gestion du personnel, les finances et la logistique, conforme à la Note de Direction 005/2023 (Organisation DPE).

---

## Architecture

```
senelec-dpe/
├── app/                    # Next.js 15 App Router (routes, layouts, pages)
│   ├── (dashboard)/        # Routes protégées (tableau-de-bord, projets, budget...)
│   ├── globals.css         # Styles globaux + variables CSS + responsive
│   └── layout.tsx          # Root layout avec AuthProvider
├── components/
│   ├── dashboard/          # Pages métier (TableauDeBord, AgentsIA, Portefeuille, ProjetsDPE, Budget...)
│   ├── layout/             # Header, Sidebar, Navigation
│   └── ui/                 # Composants réutilisables (SenelecLogo, ToastContainer...)
├── lib/
│   ├── authStore.tsx       # Store auth Zustand + TEST_USERS + ROLE_SECTIONS + RBAC
│   ├── projectStore.tsx    # Store projets + WBS + jalons + KPI
│   ├── dpePersonnel.ts     # Fichier du personnel DPE (201 agents — 10/03/2026)
│   ├── integrationConfigStore.tsx # Configuration intégrations (Microsoft Copilot, etc.)
│   └── ...                 # Données, stores, utilitaires
├── public/                 # Assets statiques
├── package.json            # Scripts npm (dev, build, start, lint, clean)
└── README.md
```

---

## Stack Technique

- **Framework** : Next.js 15 (App Router)
- **Langage** : TypeScript 5
- **Style** : TailwindCSS 4 + CSS variables inline
- **Charts** : Recharts
- **Maps** : Leaflet + react-leaflet
- **State** : Zustand (auth, notifications)
- **Icons** : Lucide React
- **UI** : clsx, tailwind-merge
- **Build** : Static export prerender (35 routes)

---

## Prérequis

- Node.js ≥ 20
- npm

---

## Démarrage Rapide

```bash
# Dépendances
npm install

# Lancer le serveur de développement
npm run dev
```

Accès : `http://localhost:3000`

### Scripts disponibles

```bash
npm run dev      # Serveur de développement (port 3000)
npm run build    # Build statique de production
npm run start    # Serveur de production (port 3002)
npm run clean    # Nettoyage du cache Next.js (.next)
npm run lint     # Linting ESLint
```

---

## Configuration

### Intégration Microsoft Copilot
Pour activer les agents IA avec Microsoft Copilot :

1. Connectez-vous avec un compte autorisé (DIR_DPE, PMO, CHEF_PROJ, etc.)
2. Accédez au module **Centre IA** (`/agents-ia`)
3. Cliquez sur **"Connecter Copilot"**
4. Remplissez les champs :
   - **Compte Microsoft** : Votre UPN (prenom.nom@senelec.sn)
   - **Tenant ID** : ID de votre tenant Entra ID
   - **Client ID** : ID de l'app registration Azure OpenAI
   - **Endpoint** : URL de votre déploiement Azure OpenAI
   - **Déploiement** : Nom du modèle (ex: gpt-4o)
   - **Clé API** : Optionnelle si SSO Entra configuré

Les réponses des agents IA seront alors générées via Microsoft Copilot avec traçabilité complète.

### Personnalisation des Rôles
Les permissions peuvent être ajustées via le store `lib/permissionStore.ts` :

```typescript
// Surcharge des sections visibles pour un rôle
overrideRoleSections('CHEF_PROJ', ['accueil', 'mes_projets', 'execution', 'finances', 'transverses']);

// Surcharge du niveau de visibilité
setRoleScope('DIR_DPE', { niveau: 0, direction: 'EM_DPE' });
```

---

## Guide de Développement

### Ajouter un nouvel Agent IA
Pour créer un agent personnalisé dans `components/dashboard/AgentsIA.tsx` :

```typescript
{
  role: 'mon_agent' as AgentRole,
  label: 'Mon Agent Personnalisé',
  subtitle: 'Description courte',
  desc: 'Description détaillée des capacités',
  color: '#3D1A6B',
  bg: '#F3EBF9',
  icon: <Bot size={20} style={{ color: '#3D1A6B' }} />,
  perimetres: ['Périmètre1', 'Périmètre2'],
  suggestions: ['Suggestion 1', 'Suggestion 2'],
}
```

Puis ajoutez la logique de réponse dans `buildAgentReply()`.

### Ajouter une nouvelle section Sidebar
Dans `components/layout/Sidebar.tsx`, ajoutez une section à `SECTIONS` :

```typescript
{
  id: 'ma_section',
  icon: MonIcon,
  label: 'Ma Section',
  shortLabel: 'Section',
  routes: ['/ma-route'],
  items: [
    { href: '/ma-route', icon: MonIcon, label: 'Ma Page' },
  ],
}
```

Et définissez les permissions dans `lib/authStore.tsx` :

```typescript
export const ROLE_SECTIONS: Record<RoleCode, SidebarSectionId[]> = {
  DIR_DPE: [...existingSections, 'ma_section'],
  // ...
};
```

### Créer un nouveau store Zustand
Utilisez le pattern établi dans `lib/authStore.tsx` :

```typescript
import { create } from 'zustand';

interface MyStore {
  data: DataType[];
  setData: (data: DataType[]) => void;
  updateItem: (id: string, updates: Partial<DataType>) => void;
}

export const useMyStore = create<MyStore>((set) => ({
  data: [],
  setData: (data) => set({ data }),
  updateItem: (id, updates) => set((state) => ({
    data: state.data.map(item => item.id === id ? { ...item, ...updates } : item)
  })),
}));
```

---

## Dépannage

### Problème : Les agents IA ne répondent pas
**Cause** : Configuration Copilot incorrecte ou non connectée  
**Solution** :
1. Vérifiez la configuration dans le module Centre IA
2. Testez avec un compte de démo (demo_dir@dpe.sn)
3. Les réponses simulées fonctionnent même sans Copilot

### Problème : Sidebar ne s'affiche pas correctement
**Cause** : Permissions de rôle incorrectes  
**Solution** :
1. Vérifiez que `ROLE_SECTIONS` inclut la section souhaitée
2. Vérifiez que `ROLE_NAV_ITEMS` inclut les routes
3. Consultez la console pour les erreurs de permission

### Problème : Utilisateur verrouillé
**Cause** : Trop de tentatives de connexion échouées  
**Solution** :
1. Attendre la fin du délai de verrouillage (configuré dans `passwordPolicyStore`)
2. Utiliser le compte admin pour réinitialiser
3. Le mot de passe correct déverrouille automatiquement

### Problème : Données non visibles
**Cause** : Périmètre de visibilité trop restrictif  
**Solution** :
1. Vérifiez la direction/departement de l'utilisateur
2. Ajustez le niveau de visibilité dans `permissionStore`
3. Utilisez un compte admin pour tester

---

---

## Bonnes Pratiques & Conventions

### Conventions de Code
- **Composants** : PascalCase pour les composants React (`TableauDeBord.tsx`)
- **Stores** : camelCase avec préfixe `use` (`useAuthStore`, `useProjectStore`)
- **Types** : Interfaces TypeScript pour tous les objets complexes
- **Styles** : Inline styles pour les composants dynamiques, Tailwind pour le layout
- **Imports** : Regroupement par catégorie (React, lib, components, types)

### Gestion d'État
- **État global** : Zustand stores (auth, projects, config)
- **État local** : React hooks (useState, useEffect, useMemo)
- **État serveur** : App Router Next.js (server components)
- **Persistance** : localStorage pour la session utilisateur

### Sécurité
- **RBAC** : Contrôle d'accès basé sur les rôles (authStore)
- **ABAC** : Contrôle d'accès basé sur les attributs (poste, direction)
- **Audit** : Journal d'audit pour toutes les actions sensibles
- **Validation** : Validation des entrées utilisateur côté client et serveur
- **Sanitization** : Échappement des données utilisateur pour prévenir XSS

### Performance
- **Code splitting** : Dynamic imports pour les composants lourds
- **Memoization** : useMemo et useCallback pour les calculs coûteux
- **Virtualization** : Pour les listes longues (react-window)
- **Lazy loading** : Chargement différé des images et composants
- **Optimisation images** : Format WebP, compression automatique

### Accessibilité
- **Contraste** : Ratio de contraste minimum 4.5:1
- **Navigation** : Support clavier complet
- **ARIA** : Labels et rôles ARIA appropriés
- **Screen readers** : Texte alternatif pour les images
- **Focus** : Indicateurs de focus visibles

### Internationalisation
- **Locales** : Support français (fr-FR) par défaut
- **Formats** : Dates et nombres formatés selon la locale
- **Devise** : FCFA pour les montants financiers
- **Traductions** : Système i18n via `lib/i18n/`

---

## Tests

### Tests Unitaires
```bash
# Exécuter les tests unitaires
npm test

# Avec couverture
npm test -- --coverage
```

### Tests E2E
```bash
# Lancer les tests Playwright
npm run test:e2e

# Mode headed
npm run test:e2e -- --headed
```

### Tests de Charge
```bash
# Tests de performance avec k6
npm run test:load
```

---

## Déploiement

### Build de Production
```bash
# Build statique
npm run build

# Vérifier le build
npm run start
```

### Variables d'Environnement
Créer un fichier `.env.local` :

```env
NEXT_PUBLIC_API_URL=https://api.senelec.sn
NEXT_PUBLIC_COPLOT_ENDPOINT=https://senelec.openai.azure.com
AZURE_TENANT_ID=your-tenant-id
AZURE_CLIENT_ID=your-client-id
AZURE_CLIENT_SECRET=your-client-secret
```

### CI/CD
Le projet utilise GitHub Actions pour le CI/CD :

- **Build** : À chaque push sur `main`
- **Tests** : Exécution automatique des tests
- **Lint** : Vérification du code avec ESLint
- **Deploy** : Déploiement automatique sur Vercel

---

## Contribution

### Workflow de Contribution
1. Forker le projet
2. Créer une branche feature (`feature/ma-fonctionnalite`)
3. Committer avec des messages clairs
4. Pusher vers le fork
5. Ouvrir une Pull Request

### Messages de Commit
Utiliser le format Conventional Commits :

```
feat: ajouter l'agent IA de planification
fix: corriger le bug de sidebar mobile
docs: mettre à jour le README
refactor: optimiser le store authStore
test: ajouter des tests pour AgentsIA
```

### Code Review
- Respecter les conventions de code
- Ajouter des tests pour les nouvelles fonctionnalités
- Mettre à jour la documentation
- Vérifier l'accessibilité

---

## Ressources

### Documentation Interne
- **Note de Direction 005/2023** : Organisation DPE
- **Procédures SIGEPP** : Workflow et processus
- **Guide Utilisateur** : Manuel utilisateur

### Documentation Technique
- **Next.js Documentation** : https://nextjs.org/docs
- **Zustand Documentation** : https://zustand-demo.pmnd.rs
- **TailwindCSS Documentation** : https://tailwindcss.com/docs
- **Recharts Documentation** : https://recharts.org

### Support
- **Email support** : support@senelec.sn
- **Ticket JIRA** : https://jira.senelec.sn
- **Teams Channel** : #sigepp-dpe-dev

---

## Rôles du Personnel DPE

Les profils utilisateurs sont extraits du **Fichier du Personnel DPE au 10/03/2026** (201 agents). Le mapping `posteToRole` mappe automatiquement chaque **poste occupé** vers son rôle SIGEPP-DPE :

| Rôle | Code | Effectif |
|------|------|----------|
| Directeur DPE | `DIR_DPE` | 3 |
| PMO / Cellule Suivi-Évaluation | `PMO` | 8 |
| Chef de Département / Service / Unité | `CHEF_DEPT` | 18 |
| Chef de Projet | `CHEF_PROJ` | 43 |
| Ingénieur / Études / Géomaticien / Dessinateur | `INGENIEUR` | 14 |
| Expert Technique | `EXPERT` | 13 |
| Contrôleur de Projet | `CONTROLEUR` | 18 |
| Chargé de Mission | `CHARGE` | 5 |
| Assistant | `ASSISTANT` | 34 |
| Secrétaire | `SECRETAIRE` | 6 |
| Chauffeur | `CHAUFFEUR` | 31 |
| Contrôleur Financier / Comptable | `CTRL_FIN` | 4 |
| Responsable Logistique | `RESP_LOG` | 4 |
| Administrateur Système | `ADMIN` | 1 |

Chaque rôle dispose de permissions granulaires (`ROLE_SECTIONS`, `ROLE_ROUTES`) définies dans `lib/authStore.tsx`.

---

## Comptes de Test

15 comptes de démo avec rattachement organique (Note de Direction 005/2023) :

| Email | Mot de passe | Rôle | Direction | Poste affiché |
|-------|--------------|------|-----------|---------------|
| `directeur@dpe.sn` | `dpe2026` | DIR_DPE | EM DPE | Directeur DPE |
| `serigne.mbaye@dpe.sn` | `dpe2026` | **Coordonnateur CC26** | EM DPE | **Coordonnateur CC26** |
| `pmo@dpe.sn` | `dpe2026` | PMO | EM DPE | PMO |
| `chef.projet@dpe.sn` | `dpe2026` | CHEF_PROJ | DER | Chef de Projet |
| `chef.dept@dpe.sn` | `dpe2026` | CHEF_DEPT | DGC | Chef de Département |
| `chef.dept2@dpe.sn` | `dpe2026` | CHEF_DEPT | CC26 | Chef de Département |
| `ingenieur@dpe.sn` | `dpe2026` | INGENIEUR | DER | Ingénieur |
| `expert@dpe.sn` | `dpe2026` | EXPERT | EM DPE | Expert |
| `controleur@dpe.sn` | `dpe2026` | CONTROLEUR | DER | Contrôleur |
| `charge@dpe.sn` | `dpe2026` | CHARGE | CPBM - UE | Chargé de Mission |
| `assistant@dpe.sn` | `dpe2026` | ASSISTANT | DIT | Assistant |
| `secretaire@dpe.sn` | `dpe2026` | SECRETAIRE | DER | Secrétaire |
| `chauffeur@dpe.sn` | `dpe2026` | CHAUFFEUR | DER | Chauffeur |
| `finance@dpe.sn` | `dpe2026` | CTRL_FIN | CPBM - UE | Contrôleur Financier |
| `uagl@dpe.sn` | `dpe2026` | RESP_LOG | DER | Responsable Logistique |
| `admin@dpe.sn` | `dpe2026` | ADMIN | DER | Administrateur |


---

## Rattachement Organique (ND 005/2023)

Les directions du fichier personnel sont mappées vers des labels lisibles via `getDirectionLabel` :

| Code | Label |
|------|-------|
| `EM DPE` | État-Major — Direction Principale Équipement |
| `DER` | Direction Équipement Réseaux |
| `DGC` | Direction Génie Civil |
| `DEP` | Direction Équipement Production |
| `DIT` | Direction Innovation Technologique |
| `CC26` | Coordination Compact 2026 |
| `CPBM - UE` | Coordination Programmes BM-UE |
| `CPAMACEL&EE` | Coordination PAMACEL & Efficacité Énergétique |
| `CPADERAU` | Coordination Programme PADERAU |
| `CSE` | Cellule Suivi & Évaluation — DPE |

---

## Fonctionnalités Clés

### Mapping posteToRole
La fonction `posteToRole(fonction, poste, direction)` dans `components/dashboard/Administration.tsx` mappe automatiquement chaque poste occupé du fichier personnel vers un rôle SIGEPP-DPE. **100% des 201 agents sont couverts** — aucun fallback total.

### Responsive Design
- Grids Tailwind responsive (`grid-cols-1 md:grid-cols-N`) dans les dashboards
- Sidebar avec menu mobile (hamburger)
- Media queries dans `globals.css` pour padding, flex-wrap, et tables
- Support mobile et tablette

### Système d'Agents IA
Le composant `components/dashboard/AgentsIA.tsx` fournit 9 agents spécialisés par rôle métier :

| Agent | Rôle | Périmètres |
|-------|------|------------|
| Copilote Directeur DPE | DIR_DPE, PMO | Portefeuille, KPI stratégiques, Bailleurs, Décision |
| Copilote Chef de Projet | CHEF_PROJ, INGENIEUR | Planning, GED, Bordereau, KPI, Journal d'audit |
| Agent Planification | PMO, CHEF_PROJ | Planning, Ressources, Baselines, Calendriers |
| Agent Financier | CTRL_FIN, MARCHES | Marchés, Factures, Budget, ERP, KPI financiers |
| Agent GED & Conformité | TOUS | GED, Contrats, Courriers, Archivage |
| Analyste Suivi-Évaluation | PMO, EXPERT | KPI, Suivi-Évaluation, Alertes, Reporting |
| Agent Rédaction Rapport | TOUS | Studio de rapports, GED, Comités, Planning |
| Agent Terrain & Géolocalisation | INGENIEUR, SIG | Avancement physique, GPS, ODM, Photos |
| Agent Logistique & RH | RESP_LOG, CHAUFFEUR | ODM, Flotte, RH, Présences |

Chaque agent est limité par des permissions, des jeux de données autorisés et des journaux d'audit explicites. Intégration Microsoft Copilot disponible.

### Navigation Contextuelle (Sidebar)
Le composant `components/layout/Sidebar.tsx` implémente une navigation adaptée au rôle :

- **Rail gauche** : Icônes des sections (52px fixe)
- **Panel droit** : Navigation contextuelle (208px au survol)
- **Filtre par rôle** : Chaque profil ne voit que les sections pertinentes
- **Filtre par direction** : Restriction organisationnelle (DER, DGC, DEP, etc.)
- **Badges d'alerte** : Indicateurs visuels sur les sections contenant des alertes
- **Support mobile** : Drawer avec overlay et hamburger menu

### Tableau de Bord Exécutif
Le composant `components/dashboard/TableauDeBord.tsx` fournit un cockpit adapté au profil :

- **Vue consolidée** : Pour DIR_DPE, PMO, ADMIN (portefeuille global)
- **Vue département** : Pour CHEF_DEPT (projets de l'unité)
- **Vue détaillée** : Pour CHEF_PROJ (mes projets)
- **Cockpit support** : Pour RESP_LOG, SECRETAIRE, CHAUFFEUR (espace de travail métier)
- **Indicateurs DPE** : Réseau HTA/BT, Postes transfo, MW installés, Compteurs, Économie énergie, Conformité
- **Arbitrages rapides** : Décisions stratégiques en attente
- **Export PDF/Excel** : Génération de rapports exécutifs

### Système RBAC Avancé
Le store `lib/authStore.tsx` implémente un contrôle d'accès basé sur les rôles :

- **19 rôles métiers** : DIR_DPE, PMO, CHEF_PROJ, CHEF_DEPT, INGENIEUR, EXPERT, CONTROLEUR, CHARGE, ASSISTANT, SECRETAIRE, CHAUFFEUR, CTRL_FIN, RESP_LOG, MARCHES, SIG, IMMO, AUDIT, CONTROLEUR_TRAVAUX, ADMIN
- **Permissions granulaires** : ROLE_SECTIONS, ROLE_ROUTES, ROLE_NAV_ITEMS
- **Filtre organisationnel** : Directions, départements, cellules
- **ABAC par poste** : Distinction assistant projet vs assistant direction
- **Lecture seule opérationnelle** : Niveaux 0-1 en lecture, niveau 2 en édition
- **Politique de mot de passe** : Force, historique, expiration, verrouillage
- **Accès universel** : Courriers et Parapheur accessibles à TOUS les profils (vie de bureau)

### Modules Disponibles — SIGEPP–DPE

## Système Intégré de Gouvernance, d'Exécution et de Pilotage des Projets de DPE

---

# 1. ACCUEIL — Executive Cockpit & Gouvernance

Le module Accueil constitue le centre de pilotage stratégique temps réel de la DPE.

Il fournit :

- Vision consolidée portefeuille
- Suivi des projets critiques
- Arbitrages stratégiques
- Alertes exécutives
- Indicateurs de performance
- Risques majeurs
- Décisions prioritaires

---

## Fonctionnalités principales

### Cockpit Exécutif

- Vue consolidée portefeuille DPE
- Vue par direction métier
- Vue programmes bailleurs
- KPI stratégiques temps réel
- CAPEX consolidé
- Avancement physique et financier
- Détection des dérives
- Alertes critiques

---

### Pilotage Exécutif

- Arbitrages portefeuille
- Priorisation projets
- Gestion des décisions stratégiques
- Validation exécutive
- Gestion des seuils critiques
- Gestion des escalades

---

### Monitoring Global

- Santé portefeuille
- CPI / SPI consolidés
- Risques stratégiques
- Délais critiques
- Taux décaissement
- Performance directions
- Performance bailleurs

---

### Cartographie Dynamique

- Carte des projets nationaux
- Zones critiques
- Cartographie patrimoine
- Géolocalisation projets
- Heatmaps CAPEX

---

### Centre d'Alertes

- Dépassements budget
- Retards critiques
- Blocages workflow
- Risques élevés
- Contrats critiques
- Échéances ANO

---

# 2. PORTEFEUILLE — Gouvernance Portefeuille & Programmes

Le module Portefeuille permet le pilotage stratégique multi-programmes et multi-projets.

---

## Fonctionnalités principales

### Gestion Portefeuille

- Portefeuille DPE global
- Portefeuilles directions
- Portefeuilles bailleurs
- Programmes stratégiques
- Segmentation portefeuille

---

### Gouvernance Programmes

- Gestion programmes
- Structuration programmes
- Dépendances inter-projets
- Priorisation stratégique
- Arbitrages CAPEX/OPEX

---

### Gestion des Investissements

- Pipeline projets
- Études opportunité
- Faisabilité
- Arbitrage investissements
- Analyse rentabilité
- Analyse impacts

---

### Scoring & Priorisation

- Scoring multicritère
- Analyse stratégique
- Criticité projets
- Alignement stratégique
- Analyse risques portefeuille

---

### Suivi Exécutif

- KPI portefeuille
- Santé programmes
- Courbes avancement
- Taux exécution
- Taux consommation
- KPI bailleurs

---

### Simulation & Forecast

- Scénarios budgétaires
- Prévisions CAPEX
- Simulations portefeuille
- Analyse impacts retards
- Forecast stratégique

---

# 3. PROJETS — Exécution Opérationnelle & Terrain

Le module Projets constitue le cœur opérationnel du SIGEPP–DPE.

---

## Fonctionnalités principales

### Tableau de Bord Projet

- Santé projet
- Avancement physique
- Avancement financier
- KPI projet
- Alertes projet
- État validations

---

### Planification & Scheduling

- Diagramme de Gantt
- Chemin critique
- Jalons
- Calendriers projets
- Planning multi-équipes
- Planning ressources

---

### Structuration Projet

- WBS hiérarchique
- OBS
- CBS
- Lots travaux
- Découpage géographique
- Structuration actifs

---

### Gestion des Tâches

- Affectation tâches
- Suivi exécution
- Validation terrain
- Workflow tâches
- Contrôle réalisation
- Escalade automatique

---

### Gestion Terrain

- Suivi terrain mobile
- Rapports terrain
- Photos géolocalisées
- PV terrain
- Missions terrain
- Contrôles qualité
- Inspections

---

### Gestion des Ressources

- Ressources humaines
- Équipements
- Matériels
- Disponibilité ressources
- Charges ressources
- Optimisation affectations

---

### Gestion des Risques

- Registre risques
- Analyse impacts
- Plans mitigation
- Risques critiques
- Heatmaps risques

---

### Gestion ESSS / HSE

- Non-conformités
- Incidents
- Plans actions
- Conformité ESSS
- Audits HSE

---

### Cartographie Projet

- SIG / ArcGIS
- Localisation ouvrages
- Cartographie réseaux
- Zones impact
- Cartographie travaux

---

### Gestion des Livrables

- Livrables techniques
- Réceptions
- PV réception
- Mise en service
- Historique livrables

---

# 4. FINANCES — Budget, Contrôle & Marchés

Le module Finances permet le contrôle financier complet des investissements DPE.

---

## Fonctionnalités principales

### Gestion Budgétaire

- BIT
- Budgets annuels
- Révisions budgétaires
- Engagements
- Disponibilités budgétaires
- Arbitrages financiers

---

### Contrôle des Coûts

- Suivi coûts
- Forecast financier
- CPI / SPI
- Earned Value Management
- Détection dérives
- Analyse écarts

---

### Gestion AE / CP

- Autorisations Engagement
- Crédits Paiement
- Suivi consommation
- Suivi décaissements

---

### Gestion des Marchés

- DAO
- DRPO
- AMI
- Contrats
- Avenants
- Pénalités
- Cautions
- Assurances
- ANO bailleurs

---

### Gestion Fournisseurs

- Fournisseurs
- Prestataires
- Évaluation prestataires
- Historique fournisseurs
- Performance fournisseurs

---

### Bordereaux & Décomptes

- Bordereaux prix
- Décomptes
- Situations travaux
- Contrôle quantités
- Validation paiements

---

### Facturation & Paiements

- Factures
- Validation factures
- Workflow paiement
- Historique paiements
- Décaissements bailleurs

---

### Immobilisations & Patrimoine

- Actifs
- Capitalisation
- Mise en service
- Patrimoine réseau
- Liaison Oracle FA

---

### Reporting Financier

- Cashflow
- États financiers projets
- Reporting bailleurs
- Reporting exécutif
- Prévisions financières

---

# 5. LOGISTIQUE — UAGL & Support Opérationnel

Le module Logistique digitalise l'ensemble des opérations UAGL et support terrain.

---

## Fonctionnalités principales

### Gestion Flotte

- Véhicules
- Affectations
- Disponibilités
- Maintenance flotte
- Assurance véhicules
- Historique flotte

---

### Gestion ODM & Missions

- Ordres de mission
- Workflow missions
- Affectation chauffeurs
- Validation déplacements
- Historique missions

---

### Gestion Chauffeurs

- Affectation chauffeurs
- Planning chauffeurs
- Suivi déplacements
- Performance chauffeurs

---

### Gestion Carburant

- Dotation carburant
- Consommation
- Historique carburant
- Contrôle anomalies

---

### Gestion Logistique Projet

- Matériels terrain
- Affectations matériels
- Disponibilité équipements
- Logistique opérations

---

### Gestion Approvisionnements

- Demandes internes
- Commandes
- Réceptions
- Suivi livraisons
- Validation prestations

---

### Gestion Fournisseurs Logistiques

- Prestataires logistiques
- Historique prestations
- Évaluation fournisseurs

---

### Reporting Logistique

- KPI logistiques
- Coûts logistiques
- Taux disponibilité flotte
- Temps traitement ODM

---

# 6. TRANSVERSES — Services Enterprise

Le module Transverses fournit les services centraux et intelligents du SIGEPP–DPE.

---

## Fonctionnalités principales

### GED Enterprise

- Gestion documentaire
- OCR intelligent
- Versionning
- Archivage légal
- Recherche full-text
- Signatures électroniques

---

### Gestion Courriers

- Courriers entrants/sortants
- Bordereaux
- Affectations
- Workflow validation
- Historique courrier

---

### Workflow Engine

- BPMN low-code
- Workflow designer
- SLA
- Escalades
- Notifications
- Versioning workflows

---

### Analytique & BI

- Data warehouse
- Dashboards dynamiques
- KPI temps réel
- Data visualisation
- Reporting avancé

---

### Studio Rapports

- Création rapports dynamiques
- Templates bailleurs
- Export PDF/Excel
- Rapports automatisés
- Génération périodique

---

### Audit & Compliance

- Logs immuables
- Historique complet
- Audit trail
- Conformité procédures
- Forensic tracking

---

### Administration Référentiels

- Codifications projets
- Taxonomies
- Référentiels métiers
- Référentiels géographiques

---

### Agents IA & Assistance Intelligente

- Copilote projet IA
- Analyse documentaire IA
- Détection dérives
- Prévisions budgétaires IA
- Assistant reporting
- Résumé intelligent réunions
- Recherche sémantique
- OCR intelligent
- NLP documentaire

---

### Intégration & Interopérabilité

- Oracle ERP
- Oracle FA
- SIG/GIS
- GED Oracle
- APIs externes
- Synchronisation systèmes

---

# 7. RH — Administration du Personnel & Ressources

Le module RH permet la gestion administrative et opérationnelle des ressources humaines projet.

---

## Fonctionnalités principales

### Gestion Administrative Personnel

- Dossiers agents
- Affectations
- Organigrammes
- Postes
- Profils utilisateurs

---

### Gestion Ressources Projets

- Affectation équipes
- Disponibilité ressources
- Charges ressources
- Planning ressources

---

### Gestion Compétences

- Référentiel compétences
- Certifications
- Habilitations
- Formations

---

### Gestion Temps & Activités

- Timesheets
- Pointages projets
- Suivi charges
- Répartition heures

---

### Gestion Missions & Déplacements

- Ordres mission
- Déplacements
- Historique missions
- Validation hiérarchique

---

### Gestion Performance

- KPI équipes
- Performance projets
- Productivité équipes

---

### Gestion Habilitations

- RBAC
- ABAC
- Accès métiers
- Workflow habilitations

---

### Reporting RH

- Disponibilité ressources
- Charges projets
- Taux occupation
- KPI RH projets

---

## Licence

Propriétaire — Direction Principale Équipement, SENELEC, Sénégal.

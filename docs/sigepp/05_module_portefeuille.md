# SIGEPP — Étape 5 : Module Portefeuille

> Évolution Enterprise du module **Portefeuille** existant (`app/(dashboard)/portefeuille/` +
> `components/dashboard/Portefeuille.tsx`, V1). Objet : faire du portefeuille la **plateforme unique**
> de gouvernance des investissements DPE — priorisation, scoring, arbitrages, santé, décisions tracées.

---

## 1. Objectif & positionnement

Le Portefeuille est le **point d'entrée de gouvernance** (niveaux 0–1) : il consolide programmes &
projets, **priorise** l'allocation des enveloppes, **arbitre** sous contrainte budgétaire, et **suit la
santé** d'ensemble. **Aucun investissement n'existe hors de ce portefeuille.**

## 2. Sous-modules

| Sous-module | Fonction | Accès |
|-------------|----------|-------|
| **EPS** (Enterprise Project Structure) | Arborescence Portefeuille → Programme → Projet, par org | DIR/PMO 📊 · Directeur d'unité (sa direction) |
| **Portefeuille stratégique** | Vision pluriannuelle, enveloppes, axes stratégiques, bénéfices | DIR_DPE, PMO |
| **Portefeuille opérationnel** | Projets actifs, avancement, EVM agrégé, jalons, alertes | DIR/PMO/Directeur |
| **Priorisation & Scoring** | Notation multicritère configurable → classement | DPE/PMO/Admin (édition critères) |
| **Arbitrages** | Scénarios d'allocation sous contrainte budgétaire, comparaison | DIR_DPE, PMO |
| **Scorecard / Santé** | Feux (coût/délai/risque/qualité), tendance, top-risques | tous (selon périmètre) |
| **Comité & Décisions** | Ordre du jour, décisions **historisées & auditables** | DIR/PMO (✅), autres 👁 |

## 3. Modèle de priorisation (multicritère, configurable)

`score(projet) = Σ_c poids_c × note_c(projet)` avec critères paramétrables (Low-Code / Admin) :

| Critère (exemple) | Poids | Échelle |
|-------------------|:-----:|---------|
| Alignement stratégique | 25 % | 1–5 |
| Impact énergétique (MW, clients) | 20 % | 1–5 |
| Maturité (études/DAO prêts) | 15 % | 1–5 |
| Bailleur / financement sécurisé | 15 % | 1–5 |
| Risque (inversé) | 15 % | 1–5 |
| Délai de mise en service | 10 % | 1–5 |

➡️ Critères & poids **éditables** par **DPE / PMO / Admin** (V1 : déjà configurable). Le classement
alimente les **arbitrages** (sélection sous enveloppe).

## 4. Santé du portefeuille (scorecard)

Par projet et agrégé : **Coût** (CPI), **Délai** (SPI), **Risque** (exposition), **Qualité/Avancement**.
Feu = vert/orange/rouge selon seuils configurables. Vue **consolidée DPE** réservée DPE/CSE ; chaque
direction voit la santé de **son** périmètre (règle absolue de visibilité).

## 5. Écrans (UX)

1. **Cockpit Portefeuille** — KPIs enveloppe/engagé/décaissé, santé globale (feux), top-risques,
   répartition par direction/programme/bailleur, carte PostGIS des projets *(adaptatif par niveau)*.
2. **EPS** — arbre interactif Portefeuille→Programme→Projet (AG Grid Enterprise, drill-down org-scopé).
3. **Priorisation** — tableau scoring éditable, tri par score, simulation de poids.
4. **Arbitrages** — scénarios « inclus/exclus » sous enveloppe, Δ budget/bénéfices, comparaison A/B.
5. **Comité** — ordre du jour, vote, **décision historisée** (qui/quoi/quand/pourquoi) → audit_log.

## 6. Données (cf. Étape 4)

`eps_node` · `portefeuille` · `programme` · `projet` · `priorisation` + `critere_priorisation` ·
`comite` · `decision` · `kpi` (santé) · projection KG `(Portefeuille)-[:CONTIENT]->(Programme)->(Projet)`.

## 7. Sécurité (RBAC × ABAC × niveau)

- **Visibilité** : EPS et listes filtrés par `OrgScopeService.pathFilter()` ; consolidé = DPE/CSE.
- **Édition** : critères/poids → DPE/PMO/Admin ; **décisions de comité** → niveaux 0/1 (gouvernance) ;
  un Chef de Projet **ne voit pas** le portefeuille stratégique (réservé Directeur/PMO) *(V1)*.
- **Audit** : toute décision/arbitrage → `audit_log` append-only.

## 8. Workflows (Camunda 8)

`arbitrage_portefeuille` : Proposition (PMO) → Analyse → **Comité (décision)** → Notification →
Mise à jour EPS/enveloppes. `inscription_programme` : Demande → Validation DPE → Rattachement org.

## 9. APIs

```
GET  /api/portefeuille?type=STRATEGIQUE|OPERATIONNEL     (org-scopé)
GET  /api/portefeuille/eps                               (arbre EPS du périmètre)
GET  /api/portefeuille/sante                             (scorecard agrégée)
POST /api/portefeuille/priorisation/simuler             (recalcul scores)
POST /api/portefeuille/arbitrage                         (scénario → décision, CQRS + audit)
GraphQL: portefeuille, eps, sante (résolveurs appliquant can_see_path)
```

## 10. Évolution depuis la V1 (incrémental, sans repartir de zéro)

| Existant V1 | Ajout SIGEPP |
|-------------|--------------|
| Page `/portefeuille`, listes, arbitrages rapides, scoring configurable | **EPS** structuré, **comité & décisions historisées**, **scorecard santé** feux, **arbitrages scénarisés** sous enveloppe, **carte PostGIS**, **APIs + GraphQL** org-scopés, **audit append-only** |

➡️ **Implémentation** : reprendre `Portefeuille.tsx` (V1) → ajouter onglets *EPS / Priorisation /
Arbitrages / Comité* + brancher sur l'API `backend-enterprise` (client `lib/api/sigeppApi.ts`).
Prochaine étape de génération (Étape 6+ : module suivant — Programmes, puis Projets, etc.).

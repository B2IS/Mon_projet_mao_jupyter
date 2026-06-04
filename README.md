# SIGEPP-DPE

**Système Intégré de Gouvernance, d'Exécution et de Pilotage des Projets**
Direction Principale Équipement (DPE) — **SENELEC**

Plateforme web de gouvernance de portefeuille, d'exécution opérationnelle et de
suivi‑évaluation des projets d'équipement électrique (production, transport,
distribution, commercial, génie civil), conforme à l'organisation de la DPE
(Note de Direction 005/2023).

---

## Fonctionnalités principales

- **Portefeuille & cockpit projet** — fiche exécutive, WBS, planning/Gantt, EVM
  (CPI/SPI), jalons, livrables, équipe, risques.
- **Suivi‑évaluation** — indicateurs SENELEC par domaine, tableaux de bord
  adaptés au profil, programmes et reporting consolidé.
- **Terrain & SIG** — cartographie des projets, zones & quantités (BOQ),
  géoréférencement des localités, intégration ArcGIS.
- **Marchés & finances** — contrats, avenants, décomptes, ANO bailleurs, budget,
  décaissements, immobilisations.
- **Logistique (UAGL)** — ordres de mission, flotte, pointage / heures
  supplémentaires, réceptions, réservation de salles.
- **GED & courriers** — documents versionnés, parapheur, workflows de validation.
- **Assistant IA** — analyse de documents, génération de rapports et extraction
  de données, avec connexion à **Microsoft Copilot / Azure OpenAI**.

## Matrice d'habilitation (MMH)

L'accès aux données et aux actions est déterminé par la combinaison
**Fonction × Organisation × Affectation × Implication** : chaque profil ne voit
que les projets et le personnel de son périmètre (unité / département), et les
rôles opérationnels ne voient que les projets dans lesquels ils sont impliqués.

## Stack technique

| Couche | Technologie |
|--------|-------------|
| Frontend | Next.js 15 (App Router), React 19, TypeScript |
| État | Zustand (avec persistance locale) |
| Cartographie | Leaflet / react‑leaflet, ArcGIS |
| Documents | pdfjs‑dist, SheetJS (xlsx) |
| IA | Microsoft Copilot / Azure OpenAI (proxy serveur) |

## Démarrage

```bash
npm install
npm run dev        # serveur de développement (http://localhost:3000)
npm run build      # build de production
npm run start      # exécution du build de production
npm run lint       # vérification du code
```

## Configuration

Variables d'environnement (optionnelles — sinon configurables dans l'interface) :

```
AZURE_OPENAI_ENDPOINT      # endpoint Azure OpenAI / Copilot
AZURE_OPENAI_DEPLOYMENT    # nom du déploiement de modèle
AZURE_OPENAI_KEY           # clé d'API
```

La connexion à Microsoft Copilot peut également être renseignée directement
depuis l'assistant IA de l'application (compte Microsoft 365 / Entra ID).

## Structure du projet

```
app/            Routes et layouts (Next.js App Router)
components/     Pages métier, layout et composants réutilisables
lib/            Stores, moteur d'habilitation, données de référence, utilitaires
public/         Ressources statiques
```

---

© SENELEC — Direction Principale Équipement. Usage interne.

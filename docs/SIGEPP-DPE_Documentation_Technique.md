# SIGEPP-DPE — Documentation Technique
## Système Intégré de Gestion et de Pilotage de Projets — Direction Principale Équipement

**SENELEC · Direction Principale Équipement (DPE)**
**Version :** 1.0 · **Auteur :** Maodo SENE, Chef de Projet DPD (DER) · **Date :** Juin 2026

---

## Table des matières

1. [Vision & Architecture](#1-vision--architecture)
2. [Stack technique](#2-stack-technique)
3. [Modules fonctionnels](#3-modules-fonctionnels)
4. [Structure du code](#4-structure-du-code)
5. [Prérequis système](#5-prérequis-système)
6. [Déploiement on-premise (production)](#6-déploiement-on-premise-production)
7. [Démarrage développement local](#7-démarrage-développement-local)
8. [Configuration variables d'environnement](#8-configuration-variables-denvironnement)
9. [Base de données & migration](#9-base-de-données--migration)
10. [Intelligence Artificielle](#10-intelligence-artificielle)
11. [Sécurité & habilitations](#11-sécurité--habilitations)
12. [Maintenance & monitoring](#12-maintenance--monitoring)
13. [Architecture RBAC & organigramme](#13-architecture-rbac--organigramme)
14. [Correspondance fiche projet BEST](#14-correspondance-fiche-projet-best)

---

## 1. Vision & Architecture

### Idée centrale

SIGEPP-DPE est une **solution digitale intégrée** construite autour de **7 composantes interconnectées**, avec le **SIG comme socle central** garantissant la cohérence et la fiabilité de l'ensemble des données :

```
┌─────────────────────────────────────────────────────────────────────┐
│                    SIGEPP-DPE — SIGEPP Portefeuille                 │
│                                                                     │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────────────────┐  │
│  │  Outils GP   │  │     BI       │  │         GED              │  │
│  │  (Gantt/WBS/ │  │  (Dashboards │  │ (Stockage / Versioning / │  │
│  │  Risques/EVM)│  │  multi-niv.) │  │  Annotations / Paraph.)  │  │
│  └──────┬───────┘  └──────┬───────┘  └──────────┬───────────────┘  │
│         │                 │                     │                   │
│  ┌──────▼─────────────────▼─────────────────────▼───────────────┐  │
│  │           SIG — Système d'Information Géographique           │  │
│  │  Socle central : référentiel patrimonial, cartographie,       │  │
│  │  saisies terrain, MES localités, consolidation données        │  │
│  └──────┬─────────────────┬─────────────────────┬───────────────┘  │
│         │                 │                     │                   │
│  ┌──────▼───────┐  ┌──────▼───────┐  ┌──────────▼───────────────┐  │
│  │  Workflows   │  │ Communication│  │   Immobilisations        │  │
│  │  (Parapheur/ │  │  Projet      │  │   (Actifs/Amort/SYSCOHADA│  │
│  │  Validations)│  │  (Courriers) │  │   Bordereau/PV/ERP)      │  │
│  └──────────────┘  └──────────────┘  └──────────────────────────┘  │
└─────────────────────────────────────────────────────────────────────┘
```

---

## 2. Stack technique

### Frontend

| Composant | Technologie | Version |
|-----------|-------------|---------|
| Framework | **Next.js** (App Router) | 15.x |
| Langage | **TypeScript** (strict mode) | 5.x |
| UI styling | **Tailwind CSS** (v4) | 4.x |
| Composants | Lucide React (icônes SVG) | latest |
| État global | **Zustand** (localStorage persist) | latest |
| Cartographie | **Leaflet** + React-Leaflet (SSR désactivé) | latest |
| Graphiques | **Recharts** | latest |
| Documents | pdf.js, JSZip, xlsx, docx | — |
| Routing | Next.js App Router (fichiers `page.tsx`) | — |

### Backend

| Composant | Technologie | Version |
|-----------|-------------|---------|
| API | **FastAPI** (Python) | ≥0.110 |
| Serveur ASGI | **Uvicorn** (+ Gunicorn prod) | ≥0.29 |
| ORM | **SQLAlchemy** + Alembic | ≥2.0 |
| Base de données | **PostgreSQL** 16 | 16-alpine |
| Auth | JWT — python-jose + passlib/bcrypt | — |
| Validation | **Pydantic** v2 | ≥2.6 |

### Intelligence Artificielle

| Composant | Technologie | Usage |
|-----------|-------------|-------|
| LLM local | **Ollama** (container dédié) | Inférence on-premise |
| Transformers | HuggingFace transformers + torch | NLP, extraction |
| Multi-agents | **LangGraph** + MCP | Swarm IA, orchestration |
| Similarité | sentence-transformers | Recherche sémantique |
| OCR | **docTR** (Mindee, deep learning) | OCR PDF scannés / ODM |
| OCR fallback | EasyOCR → Tesseract | Robustesse multi-langue |
| Extraction doc | pdfplumber, python-docx, openpyxl | Lecture PDF/Word/Excel |

### Déploiement

| Composant | Technologie |
|-----------|-------------|
| Containerisation | **Docker** + Docker Compose |
| Orchestration (opt.) | Kubernetes (K8s) |
| Reverse proxy | **Nginx** |
| Base de données cloud | **Supabase** (fallback PostgreSQL local) |
| Monitoring | Prometheus + Grafana |
| Logging | structlog |

---

## 3. Modules fonctionnels

### Cockpit & Pilotage
| Module | Route | Description |
|--------|-------|-------------|
| Tableau de bord | `/tableau-de-bord` | Vue consolidée KPIs portefeuille |
| Alertes | `/alertes` | Notifications temps réel, alertes critiques |
| Copilot IA | `/copilot` | Assistant conversationnel SENELEC (chat IA) |

### Cœur Opérationnel
| Module | Route | Description |
|--------|-------|-------------|
| Vue Portefeuille | `/portefeuille` | Tous les projets DPE |
| Programmes | `/programmes` | Groupements multi-projets |
| Projets | `/projets` | Fiche projet détaillée |
| Cockpit Projet | `/cockpit-projet` | Fiche exécutive par projet |
| Gestion de projet | `/gestion-projet` | Workflow complet |
| Gantt | `/gantt` | Chronogramme / planning |
| WBS | `/wbs` | Structure de découpage du travail |
| Structuration actifs | `/structuration` | Référentiel actifs SYSCOHADA |
| Tâches | `/taches` | Gestion des activités |
| Avancement Terrain | `/terrain` | Saisie mensuelle terrain |
| Risques & QHSE | `/risques` | Registre des risques, matrice |
| Cartographie SIG | `/cartographie` | Carte réseau électrique |

### Ingénierie Financière
| Module | Route | Description |
|--------|-------|-------------|
| Budget | `/budget` | Enveloppes par CR, décaissements |
| EVM | `/evm` | Earned Value Management (CPI/SPI) |
| Fournisseurs | `/fournisseurs` | Tiers, dettes, paiements |
| Marchés | `/marches` | Contrats et marchés |
| Bordereaux | `/bordereaux` | BOQ / Bordereau des quantités |
| Réceptions | `/receptions` | PV réception, paiements |

### Actifs & Ressources
| Module | Route | Description |
|--------|-------|-------------|
| Immobilisations | `/immobilisations` | Registre actifs SYSCOHADA |
| PV de réception | `/immobilisations/receptions` | Mise en service |
| Amortissements | `/immobilisations/amortissements` | Plans linéaires prorata temporis |
| Référentiel | `/immobilisations/referentiel` | Familles actifs (REEQ.COUP, PREFA...) |
| Flotte | `/flotte` | Véhicules et chauffeurs |
| ODM | `/odm` | Ordres de mission (extraction IA + imputation CR) |
| Réservation salle | `/reservation-salle` | Salles de réunion |
| RH | `/rh` | Ressources humaines |
| Temps & Pointage | `/gestion-temps` | Feuilles de temps |

### Data, Documents & IA
| Module | Route | Description |
|--------|-------|-------------|
| KPI & Suivi-Éval | `/suivi-evaluation` | Indicateurs de résultats |
| Analytique BI | `/analytique` | Dashboards BI avancés |
| Constructeur KPI | `/constructeur-indicateurs` | Création d'indicateurs custom |
| Studio Rapports | `/studio-rapports` | Générateur rapports custom |
| Reporting | `/reporting` | **Génération IA + Studio IA éditable** |
| GED | `/ged` | Gestion documentaire + annotations |
| Courriers | `/courriers` | Gestion du courrier entrant/sortant |
| Workflows | `/workflows` | Parapheur & circuit de validation |
| Centre IA | `/agents-ia` | Swarm multi-agents IA |
| Copilot IA | `/copilot` | Assistant conversationnel |

### Système
| Module | Route | Description |
|--------|-------|-------------|
| Utilisateurs & Rôles | `/administration` | Gestion utilisateurs |
| Habilitations | `/administration/acces` | RBAC, droits fins |
| Organigramme | `/administration/org-config` | Structure DPE |
| Vue Personnalisée | `/dashboard-builder` | Dashboards custom |
| Interface ERP | `/erp-interface` | Connecteurs SAP/Oracle/Sage |
| Migration données | `/migration` | Import/migration legacy |

---

## 4. Structure du code

```
senelec-dpe/
├── app/                        # Next.js App Router
│   ├── (dashboard)/            # Routes protégées
│   │   ├── tableau-de-bord/
│   │   ├── projets/
│   │   ├── budget/
│   │   ├── immobilisations/
│   │   │   ├── page.tsx
│   │   │   ├── receptions/
│   │   │   ├── amortissements/
│   │   │   └── referentiel/
│   │   └── ... (42 routes)
│   ├── layout.tsx              # Layout global (auth guard)
│   └── globals.css             # Variables CSS SENELEC
│
├── components/
│   ├── dashboard/              # 40+ composants métier
│   │   ├── Reporting.tsx       # Génération rapports + Studio IA
│   │   ├── ODM.tsx             # Ordres de mission + extraction IA
│   │   ├── ImmobilisationsWorkspace.tsx  # Actifs SYSCOHADA
│   │   ├── Copilot.tsx         # Assistant IA conversationnel
│   │   └── ...
│   ├── layout/
│   │   ├── Sidebar.tsx         # Navigation 5 domaines + RBAC
│   │   └── Header.tsx
│   └── ui/                     # Composants réutilisables
│
├── lib/
│   ├── authStore.ts            # Zustand auth + rôles RBAC
│   ├── projectStore.ts         # Store projets (Zustand + localStorage)
│   ├── dpeOrgStructure.ts      # Organigramme DPE (DEP/DER/DIT/DGC)
│   ├── i18n/                   # Internationalisation FR/EN
│   ├── immobilisations/
│   │   ├── referentiel.ts      # Familles actifs SYSCOHADA
│   │   ├── assembleur.ts       # Instanciation WBS actifs
│   │   ├── amortissement.ts    # Calculs prorata temporis
│   │   └── store.ts            # Store immobilisations (Zustand)
│   └── data.ts                 # Analytics globales
│
├── backend/                    # FastAPI Python
│   ├── src/
│   │   ├── api/app.py          # Entrée FastAPI
│   │   ├── routers/            # Endpoints par module
│   │   ├── models/             # SQLAlchemy ORM
│   │   ├── schemas/            # Pydantic schemas
│   │   └── services/           # Logique métier + IA
│   ├── requirements.txt
│   └── Dockerfile
│
├── Dockerfile.frontend
├── docker-compose.yml          # Stack complète (PG + Backend + Frontend + Ollama)
└── docs/                       # Documentation technique
```

---

## 5. Prérequis système

### Serveur on-premise (recommandé)

| Composant | Minimum | Recommandé |
|-----------|---------|------------|
| CPU | 4 cœurs | 8+ cœurs |
| RAM | 8 Go | 16–32 Go |
| Stockage | 50 Go SSD | 200+ Go SSD |
| GPU | Optionnel | NVIDIA RTX (pour LLM local) |
| OS | Ubuntu 22.04 LTS | Ubuntu 22.04 LTS |

### Logiciels requis

```bash
# Système
Docker >= 24.0
Docker Compose >= 2.20
Git >= 2.40
Nginx >= 1.24  # Reverse proxy

# Optionnel (dev local)
Node.js >= 20.x (LTS)
Python >= 3.11
```

---

## 6. Déploiement on-premise (production)

### Étape 1 — Cloner le dépôt

```bash
git clone https://github.com/senelec-dpe/sigepp-dpe.git
cd sigepp-dpe
```

### Étape 2 — Configurer les variables d'environnement

```bash
# Frontend
cp .env.local.example .env.local
nano .env.local

# Backend
cp backend/.env.example backend/.env
nano backend/.env
```

> Voir section [8. Variables d'environnement](#8-configuration-variables-denvironnement) pour les valeurs.

### Étape 3 — Build et lancement (Docker Compose)

```bash
# Construction des images
docker compose build --no-cache

# Lancement de tous les services
docker compose up -d

# Vérification des statuts
docker compose ps
docker compose logs -f frontend
docker compose logs -f backend
```

### Étape 4 — Initialiser la base de données

```bash
# Appliquer les migrations Alembic
docker compose exec backend alembic upgrade head

# (Optionnel) Charger des données de démonstration
docker compose exec backend python scripts/seed_demo.py
```

### Étape 5 — Configurer Nginx (reverse proxy)

Créer `/etc/nginx/sites-available/sigepp-dpe` :

```nginx
server {
    listen 80;
    server_name sigepp.senelec.sn;

    # Redirection HTTPS
    return 301 https://$host$request_uri;
}

server {
    listen 443 ssl http2;
    server_name sigepp.senelec.sn;

    ssl_certificate /etc/ssl/certs/sigepp.crt;
    ssl_certificate_key /etc/ssl/private/sigepp.key;
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_ciphers HIGH:!aNULL:!MD5;

    # Frontend Next.js
    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
    }

    # Backend FastAPI
    location /api/ {
        proxy_pass http://localhost:8000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        client_max_body_size 50M;  # Pour l'upload de fichiers (PDF, Excel)
    }

    # API IA (Ollama)
    location /ollama/ {
        proxy_pass http://localhost:11434/;
        proxy_set_header Host $host;
    }
}
```

```bash
sudo ln -s /etc/nginx/sites-available/sigepp-dpe /etc/nginx/sites-enabled/
sudo nginx -t && sudo systemctl reload nginx
```

### Étape 6 — Activer Ollama (LLM local)

```bash
# Dans le container Ollama
docker compose exec ollama ollama pull mistral:7b-instruct
docker compose exec ollama ollama pull llama3:8b

# Vérifier
curl http://localhost:11434/api/tags
```

### Étape 7 — Créer le compte administrateur

```bash
docker compose exec backend python scripts/create_admin.py \
  --email admin@senelec.sn \
  --password [MOT_DE_PASSE_FORT] \
  --role ADMIN
```

### Étape 8 — Vérification finale

| Service | URL | Statut attendu |
|---------|-----|---------------|
| Frontend SIGEPP-DPE | `https://sigepp.senelec.sn` | Page de login |
| API Backend | `https://sigepp.senelec.sn/api/docs` | Swagger UI |
| PostgreSQL | `localhost:5432` | Connexion DB |
| Ollama LLM | `http://localhost:11434` | `{"models":[...]}` |

---

## 7. Démarrage développement local

### Sans Docker (développement rapide)

```bash
# 1. Prérequis
node --version    # >= 20
python --version  # >= 3.11

# 2. Frontend
npm install
npm run dev       # → http://localhost:3000

# 3. Backend (dans un terminal séparé)
cd backend
python -m venv .venv
source .venv/bin/activate  # Windows: .venv\Scripts\activate
pip install -r requirements.txt
uvicorn src.api.app:app --reload --port 8000
```

### Notes importantes pour le build

```bash
# Résoudre l'erreur tsbuildinfo (masque parfois les vraies erreurs TS)
rm tsconfig.tsbuildinfo && npm run build

# Leaflet doit être importé avec ssr:false (pas de window côté serveur)
const CartoMap = dynamic(() => import('@/components/dashboard/CartoMap'), { ssr: false });

# Tailwind CSS v4 : utiliser @import "tailwindcss" (pas @tailwind base/components)
```

---

## 8. Configuration variables d'environnement

### `.env.local` (Frontend)

```env
# API Backend
NEXT_PUBLIC_API_URL=https://sigepp.senelec.sn/api

# Supabase (optionnel si PostgreSQL local)
NEXT_PUBLIC_SUPABASE_URL=https://xxxxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJ...

# Anthropic (Claude API — pour IA cloud en option)
ANTHROPIC_API_KEY=sk-ant-...

# Ollama LLM (on-premise)
NEXT_PUBLIC_OLLAMA_URL=http://localhost:11434

# App
NEXT_PUBLIC_APP_ENV=production
NEXT_PUBLIC_APP_VERSION=1.0.0
```

### `backend/.env`

```env
# Base de données
DATABASE_URL=postgresql://sigepp:sigepp2026@localhost:5432/sigepp_dpe

# Supabase
SUPABASE_URL=https://xxxxx.supabase.co
SUPABASE_KEY=eyJ...  # Service Role Key (privée, jamais côté client)

# JWT
SECRET_KEY=votre_secret_jwt_très_long_et_aléatoire_256bits
ALGORITHM=HS256
ACCESS_TOKEN_EXPIRE_MINUTES=1440  # 24h

# Ollama
OLLAMA_BASE_URL=http://ollama:11434
DEFAULT_LLM_MODEL=mistral:7b-instruct

# Anthropic Claude (fallback cloud)
ANTHROPIC_API_KEY=sk-ant-...

# Environnement
APP_ENV=production
DEBUG=False
ALLOWED_HOSTS=sigepp.senelec.sn,localhost
CORS_ORIGINS=https://sigepp.senelec.sn
```

---

## 9. Base de données & migration

### Schéma principal

```sql
-- Projets
projects (id, code, nom, domaine, statut, budget, budget_engage, 
          budget_decaisse, avancement, avancement_planifie, cpi, spi,
          region, date_debut, date_fin, direction_id, chef_projet_id)

-- Actifs SYSCOHADA
immobilisations (id, code, famille_code, designation, valeur_totale, 
                 source_bordereau, date_assemblage, localisation_json,
                 arbre_json, created_by, created_at)

-- PV Réception
pv_reception (id, numero, actif_id, date_reception_provisoire, 
              duree_amort, methode, valeur_residuelle, signe_par)

-- ODM
ordres_mission (id, numero, objet, destination, date_depart, 
                date_retour, participants_json, cr_budgets_json,
                taux_journalier, created_by)

-- Utilisateurs
users (id, email, nom, prenom, role, direction_code, dept_code, 
       is_active, last_login, hashed_password)

-- Documents GED
documents (id, nom, type, projet_id, version, taille, checksum, 
           uploaded_by, annotations_json, created_at)
```

### Commandes Alembic

```bash
# Créer une nouvelle migration
docker compose exec backend alembic revision --autogenerate -m "description"

# Appliquer toutes les migrations
docker compose exec backend alembic upgrade head

# Rollback d'une migration
docker compose exec backend alembic downgrade -1

# Voir l'historique
docker compose exec backend alembic history --verbose
```

---

## 10. Intelligence Artificielle

### Architecture IA en 3 niveaux

```
Niveau 1 — Extraction documentaire (synchrone, local)
  pdfplumber / python-docx / openpyxl → parseurs directs
  docTR → OCR deep learning (PDF scannés, formulaires)
  EasyOCR → fallback multi-langue (arabe, français, anglais)

Niveau 2 — NLP & Analyse (local ou cloud)
  Ollama (on-premise) :
    mistral:7b-instruct → génération de texte, analyses
    llama3:8b → raisonnement, recommandations
  Sentence-transformers → recherche sémantique, similarité

Niveau 3 — Orchestration multi-agents (LangGraph + MCP)
  Agents spécialisés : extraction, analyse, rapport, alerte
  MCP (Model Context Protocol) → exposition des outils métier
```

### Module ODM — Extraction intelligente

Le module ODM utilise une cascade d'extraction :

1. **Appel backend** → pdfplumber + docTR OCR
2. **Fallback client** → FileReader si fichier texte < 512 Ko
3. **parseExtractionText** → regex SENELEC (matricules C0xxxx, CRs)
4. **Imputation CR** → groupage par CR × per diem × durée
   - International (France, Paris, Lyon, Chine…) → **143 000 FCFA/j**
   - National → **25 000 FCFA/j**

### Module Reporting — Studio IA

Après génération, le **Studio IA** permet :

- **Chat conversationnel** : modifier, reformuler, développer des sections
- **Édition inline** : cliquer ✏️ sur n'importe quelle section
- **Restauration** : revenir à la version générée automatiquement
- **Traduction** : FR ↔ EN (format IFR/ISR Banque Mondiale)
- **Adaptation du ton** : formel, stratégique, technique, exécutif
- **Commandes naturelles** : "Reformule la section 2", "Ajoute des risques", "Traduis tout"

### Activer le LLM cloud (Anthropic Claude)

Pour des capacités IA maximales (comparables à Claude.ai), configurer :

```env
# backend/.env
ANTHROPIC_API_KEY=sk-ant-...
PREFERRED_LLM_PROVIDER=anthropic  # ou "ollama" pour on-premise
ANTHROPIC_MODEL=claude-opus-4-5
```

Le backend bascule automatiquement sur Ollama si Anthropic n'est pas configuré.

---

## 11. Sécurité & habilitations

### Rôles RBAC

| Rôle | Code | Périmètre |
|------|------|-----------|
| Directeur DPE | `DIR_DPE` | Vision stratégique globale |
| PMO | `PMO` | Tous les projets, configuration |
| Chef de département | `CHEF_DEPT` | Projets de sa direction |
| Chef de projet | `CHEF_PROJ` | Son projet uniquement |
| Ingénieur | `INGENIEUR` | Lecture + saisie terrain |
| Contrôleur financier | `CTRL_FIN` | Modules financiers |
| Assistant | `ASSISTANT` | Lecture + saisie limitée |
| Resp. Logistique | `RESP_LOG` | Actifs, flotte, ODM |
| Gestionnaire Immo | `IMMO` | Immobilisations uniquement |
| Administrateur | `ADMIN` | Accès total |

### Bonnes pratiques sécurité

```bash
# 1. Rotation des clés JWT (production)
SECRET_KEY=$(openssl rand -hex 32)

# 2. HTTPS obligatoire — certificat Let's Encrypt
certbot --nginx -d sigepp.senelec.sn

# 3. Firewall — n'exposer que les ports nécessaires
ufw allow 22/tcp    # SSH
ufw allow 80/tcp    # HTTP (redirect HTTPS)
ufw allow 443/tcp   # HTTPS
ufw deny 5432       # PostgreSQL (jamais public)
ufw deny 11434      # Ollama (interne uniquement)

# 4. Backups PostgreSQL automatiques
0 2 * * * docker compose exec postgres pg_dump -U sigepp sigepp_dpe | gzip > /backups/sigepp_$(date +%Y%m%d).sql.gz
```

---

## 12. Maintenance & monitoring

### Logs

```bash
# Logs temps réel
docker compose logs -f --tail=100 frontend
docker compose logs -f --tail=100 backend

# Logs structurés (structlog JSON)
docker compose exec backend cat /app/logs/sigepp.log | python3 -m json.tool
```

### Mise à jour de l'application

```bash
git pull origin main
docker compose build --no-cache frontend backend
docker compose up -d --no-deps frontend backend
docker compose exec backend alembic upgrade head
```

### Health checks

| Endpoint | URL | Attendu |
|----------|-----|---------|
| Frontend | `GET /api/health` | `{"status":"ok"}` |
| Backend | `GET /api/v1/health` | `{"status":"ok","db":"connected"}` |
| Ollama | `GET /api/tags` | Liste des modèles |

### Monitoring Prometheus

```bash
# Port métriques backend
curl http://localhost:8000/metrics

# Métriques clés à surveiller
sigepp_api_requests_total
sigepp_ai_inference_duration_seconds
sigepp_db_connections_active
sigepp_document_extractions_total
```

---

## 13. Architecture RBAC & organigramme

### Directions DPE

```
Direction Principale Équipement (DPE)
├── DEP — Direction Équipement Production
├── DER — Direction Équipement Réseau
│   ├── Département Projet Distribution
│   ├── Département Projet Énergie Renouvelable
│   └── Département Projet Commercial
├── DIT — Direction Ingénierie & Techniques
└── DGC — Direction Génie Civil
```

### Centres de Responsabilité (CR) utilisés dans les ODM

| CR | Description |
|----|-------------|
| QE003 | Département Projet Distribution |
| QE022 | Service Environnement et Promotion |
| PE003 | Département Projet Énergie Renouvelable |
| PE102 | Département Projet Réseau |
| PE201 | Département Contrôle des Marchés |
| PE221 | Département Projet Distribution |
| PE303 | Département Projet Commercial |
| 70022 | Service Accès & Localités |

---

## 14. Correspondance fiche projet BEST

### Projet analysé : BEST-ECOWAS / PRAE-ECOWAS-REAP 2

Projet de référence : **Projet Régional d'Accès à l'Électricité de la CEDEAO (ECOWAS-REAP)**, Composante 1.

| Préoccupation projet BEST | Prise en compte dans SIGEPP-DPE |
|---------------------------|----------------------------------|
| Suivi 3 lots (Ziguinchor/Sédhiou, Kolda, Kédougou/Tamba/Kaolack) | Filtrage par région/direction dans tous les modules |
| 6 régions d'intervention | Cartographie SIG avec couches régionales |
| Jalons contractuels (ODS → réception) | Module Gantt + alertes jalons critiques |
| Supervision IC (Ingénieur Conseil) | Rôle `INGENIEUR` avec périmètre projet |
| Rapports IFR/ISR Banque Mondiale | Reporting → Format Bailleur BM (USD) |
| EIES & PAR (sauvegarde environnementale) | Module Risques QHSE + GED documents E&S |
| Décaissements AID / suivi financier | Module Budget CR + EVM + Reporting financier |
| Modifications localités avant exécution | Module Terrain SIG avec historique saisies |
| Coordination CEDEAO / UMOP | Rôle PMO + Workflows parapheur |
| Bordereau des quantités (BOQ) | Module Bordereaux + lecture prix depuis Excel |
| 97 000 connexions / 1 256 postes HTA/BT | Registre actifs immobilisations + SIG |
| Ordres de Mission terrain | ODM module avec extraction IA + imputation CR |
| Saisons des pluies / planification | Module Risques + alerte calendrier |
| Chef de projet M. Maodo SENE | Compte `CHEF_PROJ` / `PMO` configuré |

---

## Contacts & Support

| Rôle | Nom | Contact |
|------|-----|---------|
| Chef de Projet DPD | Maodo SENE, PMP® | maodo.sene@enerticai.com |
| Direction DPE | — | dpe@senelec.sn |
| Support technique | — | it-support@senelec.sn |

---

*Document généré par SIGEPP-DPE — Juin 2026 — CONFIDENTIEL SENELEC*

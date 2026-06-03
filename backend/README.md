# SIGEPP-DPE — Backend OCR / Migration multi-agents (Python)

Service Python du moteur de migration intelligente : OCR / extraction de texte
(pdfplumber), analyse multi-agents et assemblage des projets migrés.

## Démarrage
```bash
cd backend
python -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
# ou via Docker :
docker compose up --build
```

## Structure
- `src/api`        — endpoints (extraction texte, swarm analyze/finalize)
- `src/pipelines`  — pipelines d'ingestion / migration
- `src/features`, `src/entity`, `src/models` — extraction & modèles
- `src/migration`  — logique de migration multi-agents
- `notebooks/`, `tests/`, `models/`, `data/`

> Le backend **Enterprise NestJS** (refonte organization-driven) est dans
> `../backend-enterprise/` (séparé de ce service Python).

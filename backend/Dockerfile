# ─────────────────────────────────────────────────────────────────────────────
# Dockerfile — SIGEP-DPE Backend (FastAPI + IA Open Source)
# Multi-stage build pour minimiser la taille de l'image finale
# ─────────────────────────────────────────────────────────────────────────────

# ── Stage 1 : Build & Dépendances ──
FROM python:3.11-slim AS builder

WORKDIR /app

# Installer les outils système nécessaires (compilation, git)
RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential \
    git \
    && rm -rf /var/lib/apt/lists/*

# Copier et installer les dépendances Python
COPY requirements.txt .
RUN pip install --no-cache-dir --user -r requirements.txt

# ── Stage 2 : Runtime ──
FROM python:3.11-slim AS runtime

WORKDIR /app

# Créer un utilisateur non-root pour la sécurité
RUN groupadd -r sigep && useradd -r -g sigep sigep

# Copier uniquement les packages installés depuis le stage builder
COPY --from=builder /root/.local /home/sigep/.local
ENV PATH=/home/sigep/.local/bin:$PATH

# Copier le code source
COPY --chown=sigep:sigep src/ ./src/
COPY --chown=sigep:sigep .env ./

# Créer les répertoires de données et logs
RUN mkdir -p data/raw data/processed data/external models reports logs && chown -R sigep:sigep .

USER sigep

# Exposer le port de l'API
EXPOSE 8000

# Healthcheck
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
    CMD python -c "import urllib.request; urllib.request.urlopen('http://localhost:8000/health')" || exit 1

# Lancer l'application via Uvicorn
CMD ["python", "-m", "uvicorn", "src.api.app:app", "--host", "0.0.0.0", "--port", "8000", "--workers", "2"]

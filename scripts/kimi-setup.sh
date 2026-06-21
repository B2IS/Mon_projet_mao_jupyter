#!/usr/bin/env bash
# =============================================================================
# kimi-setup.sh — Installation Kimi K2 sur Docker (SIGEP-DPE)
#
# Usage :
#   ./scripts/kimi-setup.sh           # GPU NVIDIA (recommandé)
#   ./scripts/kimi-setup.sh --cpu     # CPU uniquement (pas de GPU)
#   ./scripts/kimi-setup.sh --status  # état du serveur
#   ./scripts/kimi-setup.sh --stop    # arrêter les conteneurs
#
# Prérequis GPU  : Docker Desktop + NVIDIA Container Toolkit
# Prérequis CPU  : Docker Desktop uniquement
# Espace disque  : ~26 GB (Q4_K_M) ou ~9 GB (IQ2_M CPU)
# RAM minimum    : 32 GB (GPU) / 16 GB (CPU)
# =============================================================================

set -euo pipefail

MODELS_DIR="$(cd "$(dirname "$0")/.." && pwd)/models/kimi"
COMPOSE_FILE="$(cd "$(dirname "$0")/.." && pwd)/docker-compose.llm.yml"

# Modèles HuggingFace (bartowski GGUF — stable + bien quantifiés)
HF_REPO="bartowski/Kimi-K2-Instruct-GGUF"
GPU_MODEL="Kimi-K2-Instruct-Q4_K_M.gguf"     # ~26 GB — qualité max, GPU 24+ GB VRAM
CPU_MODEL="Kimi-K2-Instruct-IQ2_M.gguf"       # ~9  GB — CPU uniquement

MODE="gpu"

# ── Parsing arguments ─────────────────────────────────────────────────────────
for arg in "$@"; do
  case $arg in
    --cpu)    MODE="cpu" ;;
    --status) MODE="status" ;;
    --stop)   MODE="stop" ;;
    --help|-h)
      grep '^#' "$0" | head -15 | sed 's/^# \{0,2\}//'
      exit 0
      ;;
  esac
done

# ── Helpers ───────────────────────────────────────────────────────────────────
info()    { echo -e "\033[1;34m[INFO]\033[0m  $*"; }
success() { echo -e "\033[1;32m[OK]\033[0m    $*"; }
warn()    { echo -e "\033[1;33m[WARN]\033[0m  $*"; }
error()   { echo -e "\033[1;31m[ERR]\033[0m   $*" >&2; exit 1; }

# ── Status ────────────────────────────────────────────────────────────────────
if [[ $MODE == "status" ]]; then
  info "État des conteneurs SIGEP LLM :"
  docker ps --filter "name=sigep-kimi" --format "  {{.Names}}  {{.Status}}  ({{.Ports}})" 2>/dev/null || true
  info "Test endpoint :"
  curl -sf http://localhost:8080/v1/models 2>/dev/null | python3 -m json.tool 2>/dev/null || \
    warn "Serveur non disponible sur http://localhost:8080"
  exit 0
fi

# ── Stop ──────────────────────────────────────────────────────────────────────
if [[ $MODE == "stop" ]]; then
  info "Arrêt des conteneurs SIGEP LLM..."
  docker compose -f "$COMPOSE_FILE" down
  success "Conteneurs arrêtés."
  exit 0
fi

# ── Vérifications prérequis ───────────────────────────────────────────────────
command -v docker >/dev/null 2>&1 || error "Docker non installé — https://docs.docker.com/desktop/"

if [[ $MODE == "gpu" ]]; then
  if ! docker info 2>/dev/null | grep -q "nvidia"; then
    warn "NVIDIA Container Toolkit non détecté. Bascule automatique en mode CPU."
    MODE="cpu"
  fi
fi

# ── Téléchargement du modèle ──────────────────────────────────────────────────
mkdir -p "$MODELS_DIR"

if [[ $MODE == "gpu" ]]; then
  TARGET_MODEL="$GPU_MODEL"
else
  TARGET_MODEL="$CPU_MODEL"
fi

if [[ -f "$MODELS_DIR/$TARGET_MODEL" ]]; then
  success "Modèle déjà présent : $MODELS_DIR/$TARGET_MODEL"
else
  info "Téléchargement $TARGET_MODEL depuis HuggingFace ($HF_REPO)..."
  info "(cela peut prendre 10-30 min selon votre connexion)"

  if command -v huggingface-cli >/dev/null 2>&1; then
    huggingface-cli download "$HF_REPO" "$TARGET_MODEL" --local-dir "$MODELS_DIR"
  elif command -v python3 >/dev/null 2>&1; then
    python3 -c "
import subprocess, sys
try:
    from huggingface_hub import hf_hub_download
    hf_hub_download(repo_id='$HF_REPO', filename='$TARGET_MODEL', local_dir='$MODELS_DIR')
except ImportError:
    print('[WARN] huggingface_hub non installé — pip install huggingface-hub')
    sys.exit(1)
"
  else
    # Fallback wget direct depuis HuggingFace CDN
    warn "huggingface-cli non disponible — téléchargement direct wget..."
    wget -c --show-progress \
      "https://huggingface.co/${HF_REPO}/resolve/main/${TARGET_MODEL}" \
      -O "$MODELS_DIR/$TARGET_MODEL" || \
      error "Téléchargement échoué. Installez huggingface-cli : pip install huggingface-hub"
  fi
  success "Modèle téléchargé : $MODELS_DIR/$TARGET_MODEL"
fi

# ── Mise à jour .env (KIMI_MODEL_FILE) ───────────────────────────────────────
ENV_FILE="$(cd "$(dirname "$0")/.." && pwd)/.env.local"
if [[ -f "$ENV_FILE" ]]; then
  if grep -q "^KIMI_MODEL_FILE=" "$ENV_FILE"; then
    sed -i.bak "s|^KIMI_MODEL_FILE=.*|KIMI_MODEL_FILE=$TARGET_MODEL|" "$ENV_FILE" && rm -f "${ENV_FILE}.bak"
    info ".env.local mis à jour : KIMI_MODEL_FILE=$TARGET_MODEL"
  fi
fi

# ── Lancement Docker ──────────────────────────────────────────────────────────
info "Démarrage du serveur llama.cpp Docker (mode $MODE)..."

if [[ $MODE == "gpu" ]]; then
  KIMI_MODEL_FILE="$GPU_MODEL" docker compose -f "$COMPOSE_FILE" up -d kimi-llm
else
  KIMI_CPU_MODEL="$CPU_MODEL" docker compose -f "$COMPOSE_FILE" --profile cpu up -d kimi-llm-cpu
fi

# ── Attente santé ─────────────────────────────────────────────────────────────
info "Attente démarrage serveur (jusqu'à 2 min)..."
for i in $(seq 1 24); do
  if curl -sf http://localhost:8080/health >/dev/null 2>&1; then
    success "Serveur Kimi K2 opérationnel sur http://localhost:8080"
    break
  fi
  if [[ $i -eq 24 ]]; then
    warn "Timeout — le modèle charge encore. Réessayez dans 1 min :"
    warn "  curl http://localhost:8080/v1/models"
  fi
  sleep 5
done

# ── Résumé ────────────────────────────────────────────────────────────────────
echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo " Kimi K2 — SIGEP-DPE Swarm"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo " Endpoint  :  http://localhost:8080/v1"
echo " Modèle    :  $TARGET_MODEL  (mode $MODE)"
echo " Alias     :  kimi-k2"
echo ""
echo " Test rapide :"
echo "   curl http://localhost:8080/v1/models"
echo ""
echo " Dans SIGEP-DPE, le swarm utilisera automatiquement ce"
echo " serveur (priorité 1) dès qu'il est disponible."
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

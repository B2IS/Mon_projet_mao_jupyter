"""
config/config.py — Point central de configuration SIGEP-DPE Backend
Charge les variables d'environnement et expose des objets singletons
réutilisables dans toute l'application.
"""
import os
from pathlib import Path

from src.entity.config_entity import AppConfig, DatabaseConfig

# ── Singletons de configuration ──
APP_CFG = AppConfig()
DB_CFG = DatabaseConfig()

# ── Chemins utiles ──
ROOT_DIR = Path(__file__).resolve().parent.parent.parent  # racine backend/
SRC_DIR = ROOT_DIR / "src"
DATA_DIR = ROOT_DIR / "data"
MODELS_DIR = ROOT_DIR / "models"
REPORTS_DIR = ROOT_DIR / "reports"
LOGS_DIR = ROOT_DIR / APP_CFG.log_dir

# Créer les répertoires manquants
for d in (DATA_DIR / "raw", DATA_DIR / "processed", DATA_DIR / "external", MODELS_DIR, REPORTS_DIR, LOGS_DIR):
    d.mkdir(parents=True, exist_ok=True)

# ── CORS Origins (liste Python) ──
CORS_ORIGINS = [o.strip() for o in APP_CFG.cors_origins.split(",") if o.strip()]

# ── Flags d'environnement ──
IS_DEV = APP_CFG.app_env.lower() == "development"
IS_PROD = APP_CFG.app_env.lower() == "production"

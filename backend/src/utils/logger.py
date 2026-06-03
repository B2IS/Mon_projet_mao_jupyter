"""
utils/logger.py — Logging structuré SIGEP-DPE Backend
Utilise structlog pour produire des logs JSON en production et lisibles en dev.
"""
import logging
import sys
from pathlib import Path

import structlog

from src.config.config import APP_CFG, LOGS_DIR


def configure_logging() -> None:
    """Configure structlog + logging standard pour l'application."""
    log_level = getattr(logging, APP_CFG.log_level.upper(), logging.INFO)

    # Fichier de log rotatif simple
    log_file = LOGS_DIR / "sigep-backend.log"
    file_handler = logging.FileHandler(log_file, encoding="utf-8")
    file_handler.setLevel(log_level)
    file_handler.setFormatter(logging.Formatter("%(asctime)s [%(levelname)s] %(message)s"))

    # Handler console
    console_handler = logging.StreamHandler(sys.stdout)
    console_handler.setLevel(log_level)

    # Config standard logging
    logging.basicConfig(
        level=log_level,
        handlers=[console_handler, file_handler],
        format="%(asctime)s [%(levelname)s] %(name)s — %(message)s",
    )

    # Config structlog
    structlog.configure(
        processors=[
            structlog.stdlib.filter_by_level,
            structlog.stdlib.add_logger_name,
            structlog.stdlib.add_log_level,
            structlog.stdlib.PositionalArgumentsFormatter(),
            structlog.processors.TimeStamper(fmt="iso"),
            structlog.processors.StackInfoRenderer(),
            structlog.processors.format_exc_info,
            structlog.processors.UnicodeDecoder(),
            structlog.processors.JSONRenderer() if APP_CFG.app_env == "production" else structlog.dev.ConsoleRenderer(),
        ],
        context_class=dict,
        logger_factory=structlog.stdlib.LoggerFactory(),
        wrapper_class=structlog.stdlib.BoundLogger,
        cache_logger_on_first_use=True,
    )


def get_logger(name: str):
    """Retourne un logger structlog nommé."""
    return structlog.get_logger(name)

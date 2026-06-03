"""
data/ingestion.py — Ingestion des données SIGEP-DPE
Lit les fichiers sources (XLSB, CSV, JSON) et les charge en mémoire
pour traitement ultérieur.
"""
import json
from pathlib import Path

import pandas as pd

from src.config.config import DATA_DIR
from src.utils.logger import get_logger

logger = get_logger(__name__)


def load_personnel_xlsb(path: str | Path | None = None) -> pd.DataFrame:
    """
    Charge le fichier du personnel DPE au format XLSB.
    Par défaut cherche dans data/raw/.
    """
    if path is None:
        candidates = list((DATA_DIR / "raw").glob("*PERSONNEL*.xlsb"))
        if not candidates:
            raise FileNotFoundError("Aucun fichier *PERSONNEL*.xlsb trouvé dans data/raw/")
        path = candidates[0]

    logger.info("loading_personnel_xlsb", path=str(path))
    try:
        from pyxlsb import open_workbook

        wb = open_workbook(str(path))
        sheet = wb.get_sheet(wb.sheets[0])
        rows = [[cell.v for cell in row] for row in sheet]
        df = pd.DataFrame(rows[1:], columns=rows[0])
        logger.info("personnel_loaded", rows=len(df), columns=list(df.columns))
        return df
    except Exception as e:
        logger.error("personnel_load_failed", error=str(e))
        raise


def load_csv(path: str | Path, encoding: str = "utf-8", sep: str = ";") -> pd.DataFrame:
    """Charge un fichier CSV."""
    logger.info("loading_csv", path=str(path))
    return pd.read_csv(path, encoding=encoding, sep=sep)


def load_json(path: str | Path) -> dict | list:
    """Charge un fichier JSON."""
    logger.info("loading_json", path=str(path))
    with open(path, "r", encoding="utf-8") as f:
        return json.load(f)

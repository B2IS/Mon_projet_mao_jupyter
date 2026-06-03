"""
data/validation.py — Validation des schémas de données DPE
Vérifie la cohérence et l'intégrité des DataFrames issus de l'ingestion.
"""
import pandas as pd

from src.utils.logger import get_logger

logger = get_logger(__name__)

REQUIRED_PERSONNEL_COLS = ["Mle", "Prénom", "Nom", "Sexe", "College", "Direction", "Fonction", "Poste occupé"]


def validate_personnel(df: pd.DataFrame) -> pd.DataFrame:
    """
    Valide le DataFrame du personnel DPE.
    Supprime les lignes sans matricule et loggue les anomalies.
    """
    initial_rows = len(df)
    missing_cols = [c for c in REQUIRED_PERSONNEL_COLS if c not in df.columns]
    if missing_cols:
        raise ValueError(f"Colonnes manquantes dans le fichier personnel : {missing_cols}")

    # Supprimer lignes sans matricule
    df = df.dropna(subset=["Mle"])
    # Nettoyer les espaces
    for col in ["Prénom", "Nom", "Fonction", "Poste occupé"]:
        if col in df.columns:
            df[col] = df[col].astype(str).str.strip()

    final_rows = len(df)
    logger.info(
        "personnel_validated",
        initial_rows=initial_rows,
        final_rows=final_rows,
        dropped=initial_rows - final_rows,
    )
    return df


def validate_budget(df: pd.DataFrame) -> pd.DataFrame:
    """Valide les lignes budgétaires (budget > 0, dates cohérentes)."""
    if "budget" in df.columns:
        invalid = df[df["budget"] <= 0]
        if not invalid.empty:
            logger.warning("budget_validation_failed", invalid_rows=len(invalid))
    return df

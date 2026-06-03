"""
api/routes/finances.py — Finances & Budget DPE
Suivi budgétaire, EVM (Earned Value Management), marchés et décaissements.
"""
from typing import Annotated

from fastapi import APIRouter, Depends
from pydantic import BaseModel, Field

from src.api.routes.auth import get_current_user, UserOut
from src.utils.logger import get_logger

logger = get_logger(__name__)
router = APIRouter()


class BudgetLine(BaseModel):
    projet_id: str
    budget_alloue: float = Field(..., gt=0)
    budget_decaisse: float = Field(default=0, ge=0)
    budget_engage: float = Field(default=0, ge=0)
    periode: str  # ex: "2026-Q2"


class EVMMetrics(BaseModel):
    projet_id: str
    cpi: float = Field(..., ge=0)
    spi: float = Field(..., ge=0)
    cv: float
    sv: float
    eac: float
    etc: float
    vat: float


@router.get("/evm/{project_id}")
async def get_evm_metrics(
    project_id: str,
    current_user: Annotated[UserOut, Depends(get_current_user)],
):
    """Calcule les indicateurs EVM (CPI, SPI, EAC, ETC) pour un projet."""
    # TODO : requête réelle depuis PostgreSQL
    logger.info("evm_metrics", project_id=project_id, user=current_user.email)
    return EVMMetrics(
        projet_id=project_id,
        cpi=0.95,
        spi=0.88,
        cv=-12000000,
        sv=-18000000,
        eac=450000000,
        etc=180000000,
        vat=270000000,
    )


@router.post("/budget-line", status_code=201)
async def create_budget_line(
    payload: BudgetLine,
    current_user: Annotated[UserOut, Depends(get_current_user)],
):
    """Crée ou met à jour une ligne budgétaire pour un projet."""
    logger.info("budget_line_created", project_id=payload.projet_id, periode=payload.periode, user=current_user.email)
    return {"status": "created", "data": payload}


@router.get("/dashboard")
async def finance_dashboard(
    current_user: Annotated[UserOut, Depends(get_current_user)],
    periode: str | None = None,
):
    """Tableau de bord financier consolidé du portefeuille DPE."""
    return {
        "periode": periode or "2026-YTD",
        "total_budget": 8_450_000_000,
        "total_decaisse": 3_200_000_000,
        "total_engage": 5_100_000_000,
        "cpi_moyen": 0.94,
        "spi_moyen": 0.89,
        "alertes": [
            {"niveau": "critique", "message": "3 projets dépassent l'EAC de +15%"},
            {"niveau": "warning", "message": "2 marchés en retard de paiement"},
        ],
    }

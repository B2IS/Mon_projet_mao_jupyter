"""
api/routes/logistics.py — Logistique & Ressources DPE
Gestion des Ordres de Mission (ODM), flotte de véhicules et ressources humaines.
"""
from typing import Annotated
from uuid import uuid4

from fastapi import APIRouter, Depends
from pydantic import BaseModel, Field

from src.api.routes.auth import get_current_user, UserOut
from src.utils.logger import get_logger

logger = get_logger(__name__)
router = APIRouter()


class ODMCreate(BaseModel):
    objet: str = Field(..., min_length=5)
    destination: str
    date_depart: str
    date_retour: str
    participants: list[str]
    transport: str = Field(default="Véhicule de service")
    budget_estime: float = Field(default=0, ge=0)
    agent_demandeur: str


class ODMOut(ODMCreate):
    id: str
    ref: str
    statut: str  # brouillon | valide | en_cours | cloture


class VehicleStatus(BaseModel):
    immatriculation: str
    marque: str
    modele: str
    disponible: bool
    km_actuel: int
    derniere_revision: str | None = None


# ── Mock DB ──
ODM_DB: dict[str, ODMOut] = {}


@router.post("/odm", response_model=ODMOut, status_code=201)
async def create_odm(
    payload: ODMCreate,
    current_user: Annotated[UserOut, Depends(get_current_user)],
):
    """Crée un nouvel Ordre de Mission (ODM)."""
    odm = ODMOut(
        id=str(uuid4()),
        ref=f"ODM-2026-{len(ODM_DB)+1:04d}",
        statut="brouillon",
        **payload.model_dump(),
    )
    ODM_DB[odm.id] = odm
    logger.info("odm_created", ref=odm.ref, user=current_user.email)
    return odm


@router.get("/odm")
async def list_odms(
    current_user: Annotated[UserOut, Depends(get_current_user)],
    statut: str | None = None,
    skip: int = 0,
    limit: int = 50,
):
    """Liste les ODM avec filtre par statut."""
    data = list(ODM_DB.values())
    if statut:
        data = [o for o in data if o.statut == statut]
    return {"total": len(data), "odms": data[skip : skip + limit]}


@router.get("/flotte")
async def list_fleet(current_user: Annotated[UserOut, Depends(get_current_user)]):
    """Retourne l'état de la flotte de véhicules DPE."""
    return {
        "vehicules": [
            VehicleStatus(immatriculation="DK-1234-AA", marque="Toyota", modele="Land Cruiser", disponible=True, km_actuel=45200, derniere_revision="2026-02-15"),
            VehicleStatus(immatriculation="DK-5678-BB", marque="Ford", modele="Ranger", disponible=False, km_actuel=31200, derniere_revision="2026-01-20"),
        ],
        "total": 2,
        "disponibles": 1,
    }

"""
api/routes/personnel.py — Gestion du personnel DPE
Import et exposition des données du fichier du personnel au 10/03/2026.
"""
from typing import Annotated

from fastapi import APIRouter, Depends
from pydantic import BaseModel

from src.api.routes.auth import get_current_user, UserOut
from src.utils.logger import get_logger

logger = get_logger(__name__)
router = APIRouter()


class AgentDPE(BaseModel):
    matricule: str
    prenom: str
    nom: str
    sexe: str
    college: str
    age: int
    anciennete: int
    direction: str
    fonction: str
    poste: str | None = None
    site: str | None = None


# TODO : remplacer par requête Supabase / import du fichier xlsb
PERSONNEL_MOCK: list[AgentDPE] = [
    AgentDPE(matricule="C00464", prenom="Ibrahima", nom="DIACK", sexe="M", college="Cadre", age=53, anciennete=26, direction="EM DPE", fonction="Directeur", poste="Directeur Innovation Technologique", site="Cité Keur Gorgui"),
    AgentDPE(matricule="C00502", prenom="Serigne Ibrahima", nom="MBAYE", sexe="M", college="Cadre", age=54, anciennete=25, direction="EM DPE", fonction="rang Directeur", poste="Coordinateur Compact 2026", site="Cité Keur Gorgui"),
    AgentDPE(matricule="C00522", prenom="Djiby", nom="DIENG", sexe="M", college="Cadre", age=53, anciennete=26, direction="EM DPE", fonction="Directeur", poste="Directeur Principal Equipement", site="Cité Keur Gorgui"),
    AgentDPE(matricule="C00588", prenom="Mapenda", nom="FAYE", sexe="M", college="Cadre", age=48, anciennete=20, direction="EM DPE", fonction="Chef de Département", poste="Chef de Cellule Suivi Evaluation / CSE", site="Cité Keur Gorgui"),
    AgentDPE(matricule="C00768", prenom="Maodo", nom="SENE", sexe="M", college="Cadre", age=46, anciennete=19, direction="DER", fonction="Chef de Projet", poste="Chef de Projet / DPD", site="Cité Keur Gorgui"),
]


@router.get("/")
async def list_personnel(
    current_user: Annotated[UserOut, Depends(get_current_user)],
    direction: str | None = None,
    fonction: str | None = None,
    skip: int = 0,
    limit: int = 50,
):
    """Liste le personnel DPE avec filtres par direction et fonction."""
    data = PERSONNEL_MOCK
    if direction:
        data = [a for a in data if a.direction == direction]
    if fonction:
        data = [a for a in data if a.fonction == fonction]
    logger.info("list_personnel", user=current_user.email, filters={"direction": direction, "fonction": fonction})
    return {"total": len(data), "skip": skip, "limit": limit, "agents": data[skip : skip + limit]}


@router.get("/directions")
async def list_directions():
    """Retourne les directions DPE issues du fichier personnel."""
    directions = sorted({a.direction for a in PERSONNEL_MOCK})
    return {"directions": directions}


@router.get("/fonctions")
async def list_fonctions():
    """Retourne les fonctions uniques du fichier personnel."""
    fonctions = sorted({a.fonction for a in PERSONNEL_MOCK})
    return {"fonctions": fonctions}

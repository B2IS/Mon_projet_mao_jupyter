"""
api/routes/projects.py — Gestion du portefeuille de projets DPE
Endpoints CRUD pour les projets, programmes, jalons et indicateurs EVM.
"""
from datetime import datetime
from typing import Annotated
from uuid import uuid4

from fastapi import APIRouter, Depends
from pydantic import BaseModel, Field

from src.api.routes.auth import get_current_user, UserOut
from src.utils.logger import get_logger

logger = get_logger(__name__)
router = APIRouter()


class Jalon(BaseModel):
    id: str
    label: str
    date: str
    atteint: bool = False


class ProjetCreate(BaseModel):
    code: str = Field(..., min_length=3, max_length=20)
    nom: str = Field(..., min_length=3, max_length=200)
    domaine: str = Field(..., pattern=r"^(production|transport|distribution|commercial|smart_grid|genie_civil)$")
    chef_projet: str
    budget: float = Field(..., gt=0)
    date_debut: str
    date_fin_prevue: str
    jalons: list[Jalon] = []


class ProjetOut(ProjetCreate):
    id: str
    statut: str
    avancement: float = 0.0
    cpi: float = 1.0
    spi: float = 1.0
    created_at: datetime


# ── Mock DB (remplacer par Supabase / PostgreSQL) ──
FAKE_DB: dict[str, ProjetOut] = {}


@router.get("/", response_model=list[ProjetOut])
async def list_projects(
    current_user: Annotated[UserOut, Depends(get_current_user)],
    skip: int = 0,
    limit: int = 100,
    domaine: str | None = None,
):
    """Liste les projets du portefeuille avec filtre optionnel par domaine."""
    projets = list(FAKE_DB.values())
    if domaine:
        projets = [p for p in projets if p.domaine == domaine]
    logger.info("list_projects", user=current_user.email, count=len(projets), domaine=domaine)
    return projets[skip : skip + limit]


@router.post("/", response_model=ProjetOut, status_code=201)
async def create_project(
    payload: ProjetCreate,
    current_user: Annotated[UserOut, Depends(get_current_user)],
):
    """Crée un nouveau projet dans le portefeuille DPE."""
    projet = ProjetOut(
        id=str(uuid4()),
        statut="planifie",
        avancement=0.0,
        cpi=1.0,
        spi=1.0,
        created_at=datetime.utcnow(),
        **payload.model_dump(),
    )
    FAKE_DB[projet.id] = projet
    logger.info("project_created", id=projet.id, code=projet.code, user=current_user.email)
    return projet


@router.get("/{project_id}", response_model=ProjetOut)
async def get_project(
    project_id: str,
    current_user: Annotated[UserOut, Depends(get_current_user)],
):
    """Retourne le détail d'un projet."""
    projet = FAKE_DB.get(project_id)
    if not projet:
        from src.utils.exception import NotFoundError
        raise NotFoundError("Projet", project_id)
    return projet


@router.delete("/{project_id}", status_code=204)
async def delete_project(
    project_id: str,
    current_user: Annotated[UserOut, Depends(get_current_user)],
):
    """Supprime un projet (admin uniquement)."""
    if project_id in FAKE_DB:
        del FAKE_DB[project_id]
        logger.info("project_deleted", id=project_id, user=current_user.email)
    return None

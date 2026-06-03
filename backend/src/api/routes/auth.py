"""
api/routes/auth.py — Authentification & Autorisation SIGEP-DPE
Intègre Supabase Auth pour la gestion des rôles du personnel DPE.
"""
from datetime import datetime, timedelta, timezone
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer, OAuth2PasswordRequestForm
from jose import JWTError, jwt
from passlib.context import CryptContext
from pydantic import BaseModel

from src.config.config import APP_CFG
from src.utils.logger import get_logger

logger = get_logger(__name__)
router = APIRouter()

# ── Sécurité ──
pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")
oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/api/v1/auth/login")


class Token(BaseModel):
    access_token: str
    token_type: str = "bearer"
    expires_in: int


class UserOut(BaseModel):
    id: str
    email: str
    prenom: str
    nom: str
    role: str
    direction: str | None = None


class UserLogin(BaseModel):
    email: str
    password: str


# ── JWT helpers ──
def create_access_token(data: dict, expires_delta: timedelta | None = None) -> str:
    to_encode = data.copy()
    expire = datetime.now(timezone.utc) + (expires_delta or timedelta(minutes=APP_CFG.access_token_expire_minutes))
    to_encode.update({"exp": expire})
    return jwt.encode(to_encode, APP_CFG.secret_key, algorithm=APP_CFG.algorithm)


async def get_current_user(token: Annotated[str, Depends(oauth2_scheme)]) -> UserOut:
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Token invalide ou expiré",
        headers={"WWW-Authenticate": "Bearer"},
    )
    try:
        payload = jwt.decode(token, APP_CFG.secret_key, algorithms=[APP_CFG.algorithm])
        user_id: str = payload.get("sub")
        if user_id is None:
            raise credentials_exception
    except JWTError:
        raise credentials_exception

    # TODO : remplacer par requête Supabase / PostgreSQL réelle
    return UserOut(
        id=user_id,
        email=f"{user_id}@dpe.sn",
        prenom="Utilisateur",
        nom="DPE",
        role="ADMIN",
        direction="EM_DPE",
    )


# ── Endpoints ──
@router.post("/login", response_model=Token)
async def login(form_data: Annotated[OAuth2PasswordRequestForm, Depends()]):
    """
    Authentifie un agent DPE et retourne un JWT.
    Les comptes de test sont alignés sur le fichier du personnel au 10/03/2026.
    """
    # TODO : vérifier credentials via Supabase Auth ou PostgreSQL
    logger.info(" tentative_login", email=form_data.username)

    # Mode démo — bypass pour faciliter les tests
    access_token = create_access_token({"sub": form_data.username, "role": "ADMIN"})
    return Token(access_token=access_token, expires_in=APP_CFG.access_token_expire_minutes * 60)


@router.get("/me", response_model=UserOut)
async def read_users_me(current_user: Annotated[UserOut, Depends(get_current_user)]):
    """Retourne le profil de l'utilisateur connecté."""
    return current_user


@router.get("/roles")
async def list_roles():
    """Liste les rôles du personnel DPE extraits du fichier officiel."""
    return {
        "roles": [
            {"code": "DIR_DPE", "label": "Directeur DPE", "effectif_approx": 3},
            {"code": "PMO", "label": "PMO / Chef Programmes", "effectif_approx": 2},
            {"code": "CHEF_DEPT", "label": "Chef de Département / Service / Unité", "effectif_approx": 25},
            {"code": "CHEF_PROJ", "label": "Chef de Projet", "effectif_approx": 35},
            {"code": "INGENIEUR", "label": "Ingénieur / Études", "effectif_approx": 15},
            {"code": "EXPERT", "label": "Expert Technique", "effectif_approx": 10},
            {"code": "CONTROLEUR", "label": "Contrôleur", "effectif_approx": 14},
            {"code": "CHARGE", "label": "Chargé de Mission", "effectif_approx": 5},
            {"code": "ASSISTANT", "label": "Assistant", "effectif_approx": 24},
            {"code": "SECRETAIRE", "label": "Secrétaire", "effectif_approx": 6},
            {"code": "CHAUFFEUR", "label": "Chauffeur / UAGL", "effectif_approx": 27},
            {"code": "CTRL_FIN", "label": "Contrôleur Financier", "effectif_approx": 3},
            {"code": "RESP_LOG", "label": "Resp. UAGL / Logistique", "effectif_approx": 5},
            {"code": "ADMIN", "label": "Administrateur Système", "effectif_approx": 1},
        ]
    }

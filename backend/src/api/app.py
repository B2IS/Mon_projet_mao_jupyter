"""
api/app.py — Point d'entrée FastAPI SIGEP-DPE Backend
Architecture ML : API RESTful + IA Open Source + Supabase
"""
from contextlib import asynccontextmanager

from fastapi import FastAPI, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from src.config.config import APP_CFG, CORS_ORIGINS, IS_DEV
from src.utils.logger import configure_logging, get_logger
from src.utils.exception import SIGEPException, sigep_exception_handler, generic_exception_handler

logger = get_logger(__name__)


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Gestion du cycle de vie : démarrage et arrêt gracieux."""
    configure_logging()
    logger.info(
        "sigep_backend_startup",
        app=APP_CFG.app_name,
        version=APP_CFG.app_version,
        env=APP_CFG.app_env,
    )
    yield
    logger.info("sigep_backend_shutdown")


app = FastAPI(
    title="SIGEP-DPE API",
    description="""
    Backend du Système Intégré de Gouvernance, d'Exécution et de Pilotage (SIGEP)
    de la Direction Principale Équipement — SENELEC.

    ## Fonctionnalités
    - **Projets** : gestion du portefeuille multi-projets, EVM, Gantt
    - **RH** : gestion du personnel DPE (fichier au 10/03/2026)
    - **IA** : agents IA open source (LLM local Ollama, embeddings HuggingFace)
    - **Finances** : budget, marchés, décaissements
    - **Logistique** : ODM, flotte, missions terrain
    """,
    version=APP_CFG.app_version,
    docs_url="/docs" if IS_DEV else None,
    redoc_url="/redoc" if IS_DEV else None,
    lifespan=lifespan,
)

# ── Middlewares ──
app.add_middleware(
    CORSMiddleware,
    allow_origins=CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ── Exception handlers ──
app.add_exception_handler(SIGEPException, sigep_exception_handler)
app.add_exception_handler(Exception, generic_exception_handler)


# ═════════════════════════════════════════════════════════════════════════════
# ROUTES RACINE
# ═════════════════════════════════════════════════════════════════════════════

@app.get("/", tags=["Health"])
async def root():
    return {
        "app": APP_CFG.app_name,
        "version": APP_CFG.app_version,
        "env": APP_CFG.app_env,
        "status": "running",
    }


@app.get("/health", tags=["Health"], status_code=status.HTTP_200_OK)
async def health_check():
    """Endpoint de healthcheck pour Docker / Kubernetes / load balancers."""
    return {"status": "healthy", "version": APP_CFG.app_version}


# ═════════════════════════════════════════════════════════════════════════════
# ROUTES MÉTIER (imports différés pour éviter les imports circulaires)
# ═════════════════════════════════════════════════════════════════════════════

from src.api.routes import auth, projects, personnel, ai, finances, logistics, migration  # noqa: E402

app.include_router(auth.router, prefix="/api/v1/auth", tags=["Authentification"])
app.include_router(projects.router, prefix="/api/v1/projects", tags=["Projets"])
app.include_router(personnel.router, prefix="/api/v1/personnel", tags=["Personnel DPE"])
app.include_router(ai.router, prefix="/api/v1/ai", tags=["IA Open Source"])
app.include_router(finances.router, prefix="/api/v1/finances", tags=["Finances"])
app.include_router(logistics.router, prefix="/api/v1/logistics", tags=["Logistique"])
app.include_router(migration.router, prefix="/api/v1/migration", tags=["Migration IA (Swarm LangGraph)"])

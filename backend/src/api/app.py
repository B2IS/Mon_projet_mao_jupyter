"""
api/app.py — Backend spécialisé SIGEP-DPE (FastAPI)
Rôle unique : IA/migration documents (OCR, LangGraph swarm, embeddings ML)
Le CRUD métier est géré par NestJS backend-enterprise (port 4000).
"""
from contextlib import asynccontextmanager

from fastapi import FastAPI, status
from fastapi.middleware.cors import CORSMiddleware

from src.config.config import APP_CFG, CORS_ORIGINS, IS_DEV
from src.utils.logger import configure_logging, get_logger
from src.utils.exception import SIGEPException, sigep_exception_handler, generic_exception_handler

logger = get_logger(__name__)


@asynccontextmanager
async def lifespan(app: FastAPI):
    configure_logging()
    logger.info("sigep_ai_backend_startup", version=APP_CFG.app_version, env=APP_CFG.app_env)
    yield
    logger.info("sigep_ai_backend_shutdown")


app = FastAPI(
    title="SIGEP-DPE — AI & Migration Backend",
    description="""
Backend spécialisé IA & migration documentaire.

## Responsabilités exclusives
- **IA** : inférence LLM (Ollama / Kimi K2 / HuggingFace), embeddings, RAG
- **Migration** : pipeline LangGraph multi-agents pour import de documents (PDF, Word, Excel, ZIP)
- **OCR** : extraction texte depuis images et documents scannés

Le CRUD projets, finances, workflows, RH est géré par **NestJS** (port 4000).
    """,
    version=APP_CFG.app_version,
    docs_url="/docs" if IS_DEV else None,
    redoc_url="/redoc" if IS_DEV else None,
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.add_exception_handler(SIGEPException, sigep_exception_handler)
app.add_exception_handler(Exception, generic_exception_handler)


@app.get("/", tags=["Health"])
async def root():
    return {"app": "sigep-ai-backend", "version": APP_CFG.app_version, "role": "ai+migration"}


@app.get("/health", tags=["Health"], status_code=status.HTTP_200_OK)
async def health_check():
    return {"status": "healthy", "version": APP_CFG.app_version}


# ── Routes spécialisées (IA + migration uniquement) ──
from src.api.routes import ai, migration  # noqa: E402

app.include_router(ai.router,        prefix="/api/v1/ai",        tags=["IA (LLM, OCR, Embeddings)"])
app.include_router(migration.router, prefix="/api/v1/migration", tags=["Migration IA (LangGraph Swarm)"])

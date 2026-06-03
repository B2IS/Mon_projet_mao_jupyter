"""
api/routes/ai.py — IA Open Source SIGEP-DPE
Intègre Ollama (LLM local) et HuggingFace (embeddings) pour l'analyse
de documents, la génération de rapports et le copilotage projet.
"""
import os
from typing import Annotated

import httpx
from fastapi import APIRouter, Depends, UploadFile, File
from pydantic import BaseModel, Field

from src.api.routes.auth import get_current_user, UserOut
from src.config.config import APP_CFG
from src.utils.logger import get_logger

logger = get_logger(__name__)
router = APIRouter()


class PromptRequest(BaseModel):
    prompt: str = Field(..., min_length=1, max_length=4000, description="Texte de la requête utilisateur")
    model: str = Field(default=APP_CFG.ollama_model, description="Modèle Ollama à utiliser")
    system: str | None = Field(default=None, description="Instruction système optionnelle")
    temperature: float = Field(default=0.7, ge=0.0, le=2.0)


class PromptResponse(BaseModel):
    response: str
    model: str
    duration_ms: int | None = None


class EmbeddingRequest(BaseModel):
    texts: list[str] = Field(..., min_length=1, max_length=50)


class EmbeddingResponse(BaseModel):
    embeddings: list[list[float]]
    model: str
    dimensions: int


@router.post("/generate", response_model=PromptResponse)
async def generate_text(
    payload: PromptRequest,
    current_user: Annotated[UserOut, Depends(get_current_user)],
):
    """
    Génère une réponse textuelle via un LLM open source local (Ollama).
    Par défaut utilise **Llama 3** (ou tout modèle téléchargé dans Ollama).
    """
    ollama_url = f"{APP_CFG.ollama_base_url}/api/generate"
    body = {
        "model": payload.model,
        "prompt": payload.prompt,
        "system": payload.system or (
            "Tu es l'agent IA officiel de la Direction Principale Équipement (DPE) — SENELEC. "
            "Tu aides les agents DPE dans la gestion de projets, le pilotage de portefeuille, "
            "l'analyse de documents techniques et la rédaction de rapports. Réponds de manière "
            "professionnelle, concise et ancrée dans les procédures SIGP."
        ),
        "options": {"temperature": payload.temperature},
        "stream": False,
    }

    try:
        async with httpx.AsyncClient(timeout=120.0) as client:
            resp = await client.post(ollama_url, json=body)
            resp.raise_for_status()
            data = resp.json()
            logger.info("ollama_generate", user=current_user.email, model=payload.model, prompt_len=len(payload.prompt))
            return PromptResponse(
                response=data.get("response", "").strip(),
                model=payload.model,
                duration_ms=data.get("total_duration", 0) // 1_000_000,
            )
    except httpx.HTTPStatusError as e:
        logger.error("ollama_http_error", status=e.response.status_code, detail=str(e))
        return PromptResponse(
            response=f"Erreur Ollama ({e.response.status_code}) : assurez-vous que le modèle '{payload.model}' est téléchargé.\n"
                     f"Commande : `ollama pull {payload.model}`",
            model=payload.model,
        )
    except Exception as e:
        logger.error("ollama_exception", error=str(e))
        return PromptResponse(
            response=f"Service IA temporairement indisponible : {str(e)}",
            model=payload.model,
        )


@router.post("/embeddings", response_model=EmbeddingResponse)
async def create_embeddings(
    payload: EmbeddingRequest,
    current_user: Annotated[UserOut, Depends(get_current_user)],
):
    """
    Génère des embeddings sémantiques via **sentence-transformers** (HuggingFace).
    Utile pour la recherche sémantique dans la GED et la classification de documents.
    """
    try:
        # Lazy import pour ne pas charger le modèle au démarrage
        from sentence_transformers import SentenceTransformer

        model_name = APP_CFG.hf_model_name
        model = SentenceTransformer(model_name)
        embeddings = model.encode(payload.texts, convert_to_numpy=True).tolist()
        dims = len(embeddings[0]) if embeddings else 0

        logger.info("hf_embeddings", user=current_user.email, model=model_name, count=len(payload.texts))
        return EmbeddingResponse(embeddings=embeddings, model=model_name, dimensions=dims)
    except Exception as e:
        logger.error("hf_embeddings_error", error=str(e))
        return EmbeddingResponse(embeddings=[], model=APP_CFG.hf_model_name, dimensions=0)


@router.post("/extract-odm")
async def extract_odm_from_pdf(
    current_user: Annotated[UserOut, Depends(get_current_user)],
    file: UploadFile = File(..., description="PDF Ordre de Mission à analyser"),
):
    """
    Extrait automatiquement les champs d'un Ordre de Mission (ODM) depuis un PDF.
    Utilise des heuristiques + LLM pour la reconnaissance de structure.
    """
    content = await file.read()
    logger.info("odm_extract_upload", user=current_user.email, filename=file.filename, size=len(content))

    # TODO : intégrer pdfplumber / PyMuPDF + prompt LLM pour extraction structurée
    return {
        "filename": file.filename,
        "status": "extraction_simulee",
        "extracted": {
            "ref": f"ODM-IA-{os.urandom(4).hex().upper()}",
            "objet": "Mission terrain — extraction automatique",
            "destination": "À déterminer par IA",
            "budget_estime": 0,
        },
        "note": "Intégration pdfplumber + LLM en cours de développement",
    }

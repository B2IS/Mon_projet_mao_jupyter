"""
api/routes/migration.py — API du Swarm de Migration IA (LangGraph)
==================================================================
Endpoints :
  GET  /capabilities  — bibliothèques OCR/parsers disponibles + moteur swarm + LLM
  POST /analyze       — upload (docs ou archive ZIP/RAR) → extraction → swarm
                        → renvoie le projet structuré + immobilisations + QA
                        (s'arrête au GATE HUMAIN : status = awaiting_human)
  POST /finalize      — applique les corrections du chef de projet (human-in-the-loop)
                        → projet prêt à créer/gérer dans SIGEPP + handover DAIC

Authentification volontairement OUVERTE en mode démo (aucun JWT requis côté
frontend prototype). À sécuriser en production via Depends(get_current_user).
"""
from __future__ import annotations

from typing import Any

from fastapi import APIRouter, UploadFile, File
from pydantic import BaseModel, Field

from src.migration.extraction import extract_from_file, CAPABILITIES, ocr_available
from src.migration.graph import run_swarm_analyze, run_swarm_finalize, engine_info
from src.migration.llm import llm
from src.utils.logger import get_logger

logger = get_logger(__name__)
router = APIRouter()

_MAX_TEXT_PREVIEW = 1200


# ─────────────────────────────────────────────────────────────────────────────
# Schémas
# ─────────────────────────────────────────────────────────────────────────────

class DocSummary(BaseModel):
    name: str
    doc_type: str
    pages: int = 0
    ocr_used: bool = False
    chars: int = 0
    preview: str = ""
    error: str = ""


class AnalyzeResponse(BaseModel):
    status: str
    project: dict[str, Any]
    risks: list[dict[str, Any]]
    immobilisations: list[dict[str, Any]]
    qa: dict[str, Any]
    documents: list[DocSummary]
    history: list[str]
    notes: list[str]
    engine: dict[str, Any]
    # état complet renvoyé pour permettre le /finalize (human-in-the-loop)
    state: dict[str, Any]


class FinalizeRequest(BaseModel):
    state: dict[str, Any]
    overrides: dict[str, Any] = Field(default_factory=dict)


class FinalizeResponse(BaseModel):
    status: str
    project: dict[str, Any]
    immobilisations: list[dict[str, Any]]
    risks: list[dict[str, Any]]


# ─────────────────────────────────────────────────────────────────────────────
# Endpoints
# ─────────────────────────────────────────────────────────────────────────────

@router.get("/capabilities")
async def capabilities():
    """Indique les capacités réelles du backend (parsers, OCR, swarm, LLM)."""
    return {
        "extraction": CAPABILITIES,
        "ocr_available": ocr_available(),
        "engine": engine_info(),
        "llm_backend": llm.backend(),
    }


@router.post("/analyze", response_model=AnalyzeResponse)
async def analyze(files: list[UploadFile] = File(...)):
    """Extrait les documents (archives dépliées) puis exécute le swarm IA
    jusqu'au gate de validation humaine."""
    documents: list[dict[str, Any]] = []
    for f in files:
        data = await f.read()
        for doc in extract_from_file(f.filename or "document", data):
            documents.append(doc.dict())

    state = run_swarm_analyze(documents)

    summaries = [
        DocSummary(
            name=d.get("name", ""), doc_type=d.get("doc_type", "other"),
            pages=d.get("pages", 0), ocr_used=d.get("ocr_used", False),
            chars=len(d.get("text", "") or ""),
            preview=(d.get("text", "") or "")[:_MAX_TEXT_PREVIEW],
            error=d.get("error", ""),
        )
        for d in state.get("documents", [])
    ]

    return AnalyzeResponse(
        status=state.get("status", "awaiting_human"),
        project=state.get("project", {}),
        risks=state.get("risks", []),
        immobilisations=state.get("immobilisations", []),
        qa=state.get("qa", {}),
        documents=summaries,
        history=state.get("history", []),
        notes=state.get("notes", []),
        engine={**engine_info(), "llm_backend": llm.backend()},
        state=state,
    )


class ExtractTextResponse(BaseModel):
    name: str
    doc_type: str
    text: str
    ocr_used: bool = False
    pages: int = 0


@router.post("/extract-text", response_model=ExtractTextResponse)
async def extract_text(file: UploadFile = File(...)):
    """Extraction de texte PROPRE d'un document (PDF/DOCX/XLSX/image…) via les
    parsers + OCR open source. Utilisé notamment par l'ingestion ODM
    (remplace toute lecture binaire brute côté navigateur)."""
    data = await file.read()
    docs = extract_from_file(file.filename or "document", data)
    text = "\n\n".join((d.text or "") for d in docs).strip()
    return ExtractTextResponse(
        name=file.filename or "document",
        doc_type=docs[0].doc_type if docs else "other",
        text=text,
        ocr_used=any(d.ocr_used for d in docs),
        pages=sum(d.pages for d in docs),
    )


@router.post("/finalize", response_model=FinalizeResponse)
async def finalize(payload: FinalizeRequest):
    """Applique les corrections humaines et produit le projet final SIGEPP
    + le dossier d'immobilisations prêt pour la DAIC."""
    final = run_swarm_finalize(payload.state, payload.overrides)
    return FinalizeResponse(
        status=final.get("status", "finalized"),
        project=final.get("project", {}),
        immobilisations=final.get("immobilisations", []),
        risks=final.get("risks", []),
    )

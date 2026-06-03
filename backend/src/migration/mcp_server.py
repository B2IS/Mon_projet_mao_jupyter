"""
migration/mcp_server.py — Exposition du Swarm via MCP (Model Context Protocol)
==============================================================================
Permet à des clients MCP (Claude Desktop, IDE, autres agents) d'appeler le
swarm de migration comme un ensemble d'OUTILS standardisés. Cela rend la
plateforme interopérable et « branchable » sur d'autres agents/LLM.

Lancement :  python -m src.migration.mcp_server      (transport stdio)

MCP est OPTIONNEL : si le paquet `mcp` n'est pas installé, ce module
n'enregistre rien et affiche un message d'aide.
"""
from __future__ import annotations

import os
from typing import Any

from src.migration.extraction import extract_from_file, CAPABILITIES, ocr_available
from src.migration.graph import run_swarm_analyze, run_swarm_finalize, engine_info
from src.migration.llm import llm

try:
    from mcp.server.fastmcp import FastMCP  # type: ignore
    _HAS_MCP = True
except Exception:  # pragma: no cover
    _HAS_MCP = False


if _HAS_MCP:
    mcp = FastMCP("sigepp-migration")

    @mcp.tool()
    def migration_capabilities() -> dict:
        """Capacités du backend de migration (parsers, OCR, swarm LangGraph, LLM)."""
        return {
            "extraction": CAPABILITIES,
            "ocr_available": ocr_available(),
            "engine": engine_info(),
            "llm_backend": llm.backend(),
        }

    @mcp.tool()
    def analyze_paths(paths: list[str]) -> dict:
        """Analyse des fichiers du dossier projet (chemins disque) via le swarm.
        Renvoie le projet structuré, les immobilisations (handover DAIC) et le QA."""
        documents: list[dict[str, Any]] = []
        for p in paths:
            if not os.path.exists(p):
                continue
            with open(p, "rb") as fh:
                data = fh.read()
            for doc in extract_from_file(os.path.basename(p), data):
                documents.append(doc.dict())
        state = run_swarm_analyze(documents)
        return {
            "status": state.get("status"),
            "project": state.get("project"),
            "immobilisations": state.get("immobilisations"),
            "risks": state.get("risks"),
            "qa": state.get("qa"),
            "history": state.get("history"),
        }

    @mcp.tool()
    def analyze_texts(documents: list[dict]) -> dict:
        """Analyse à partir de textes déjà extraits : [{name, text, doc_type?}]."""
        docs = [{"name": d.get("name", "doc"), "text": d.get("text", ""),
                 "doc_type": d.get("doc_type", "other")} for d in documents]
        state = run_swarm_analyze(docs)
        return {
            "status": state.get("status"),
            "project": state.get("project"),
            "immobilisations": state.get("immobilisations"),
            "risks": state.get("risks"),
            "qa": state.get("qa"),
            "state": state,
        }

    @mcp.tool()
    def finalize_project(state: dict, overrides: dict | None = None) -> dict:
        """Finalise le projet après validation humaine (applique les corrections)."""
        final = run_swarm_finalize(state, overrides or {})
        return {
            "status": final.get("status"),
            "project": final.get("project"),
            "immobilisations": final.get("immobilisations"),
        }


def main() -> None:
    if not _HAS_MCP:
        print("Le paquet 'mcp' n'est pas installé. Installez-le : pip install mcp")
        return
    mcp.run()  # transport stdio par défaut


if __name__ == "__main__":
    main()

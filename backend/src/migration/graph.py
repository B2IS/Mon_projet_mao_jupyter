"""
migration/graph.py — Orchestration du Swarm via LangGraph
=========================================================
Construit le graphe d'états (StateGraph) reliant les agents spécialisés :

  document_intelligence → project_planner → scheduler → risk_analyst
      → immobilisation_accountant → qa_validator → (gate HUMAIN) → assembler

Le QA peut RENVOYER une fois vers le planificateur si la confiance est trop
faible (boucle d'auto-correction du swarm). Le graphe s'arrête au QA pour la
VALIDATION HUMAINE (human-in-the-loop) ; l'assembleur n'est exécuté qu'après
approbation/correction du chef de projet (via `run_swarm_finalize`).

LangGraph est OPTIONNEL : si non installé, un exécuteur séquentiel équivalent
prend le relais (mode dégradé), garantissant le fonctionnement de l'API.
"""
from __future__ import annotations

from typing import Any

from src.migration.state import SwarmState, empty_state
from src.migration import agents
from src.utils.logger import get_logger

logger = get_logger(__name__)

try:
    from langgraph.graph import StateGraph, START, END  # type: ignore
    _HAS_LANGGRAPH = True
except Exception:  # pragma: no cover
    _HAS_LANGGRAPH = False


# Ordre d'analyse (jusqu'au gate humain ; l'assembleur est exécuté après validation)
ANALYZE_AGENTS = [
    ("document_intelligence", agents.document_intelligence),
    ("project_planner", agents.project_planner),
    ("scheduler", agents.scheduler),
    ("risk_analyst", agents.risk_analyst),
    ("immobilisation_accountant", agents.immobilisation_accountant),
    ("qa_validator", agents.qa_validator),
]


def _after_qa(state: dict) -> str:
    """Auto-correction : une seule reprise si la confiance est très faible."""
    conf = (state.get("qa") or {}).get("confidence", 0)
    already_retried = state.get("history", []).count("project_planner") > 1
    return "retry" if (conf < 30 and not already_retried) else "done"


def build_graph():
    """Compile le StateGraph LangGraph (nécessite langgraph installé)."""
    g = StateGraph(SwarmState)
    for name, fn in ANALYZE_AGENTS:
        g.add_node(name, fn)
    g.add_edge(START, "document_intelligence")
    g.add_edge("document_intelligence", "project_planner")
    g.add_edge("project_planner", "scheduler")
    g.add_edge("scheduler", "risk_analyst")
    g.add_edge("risk_analyst", "immobilisation_accountant")
    g.add_edge("immobilisation_accountant", "qa_validator")
    g.add_conditional_edges("qa_validator", _after_qa, {"retry": "project_planner", "done": END})
    return g.compile()


_COMPILED = None


def _graph():
    global _COMPILED
    if _COMPILED is None and _HAS_LANGGRAPH:
        _COMPILED = build_graph()
    return _COMPILED


def _sequential(state: dict) -> dict:
    """Exécuteur de repli (sans langgraph) — applique les agents en séquence,
    avec la même boucle d'auto-correction QA (une reprise)."""
    s: dict = dict(state)
    for name, fn in ANALYZE_AGENTS:
        s.update(fn(s))
    if _after_qa(s) == "retry":
        for name, fn in ANALYZE_AGENTS[1:]:  # reprise depuis le planner
            s.update(fn(s))
    return s


# ─────────────────────────────────────────────────────────────────────────────
# API du module
# ─────────────────────────────────────────────────────────────────────────────

def run_swarm_analyze(documents: list[dict[str, Any]]) -> dict:
    """Lance le swarm sur les documents extraits → état au gate humain."""
    state = empty_state()
    state["documents"] = documents
    if _HAS_LANGGRAPH:
        try:
            return dict(_graph().invoke(state))
        except Exception as e:  # pragma: no cover
            logger.warning("langgraph_invoke_failed_fallback_sequential", error=str(e))
    return _sequential(state)


def run_swarm_finalize(state: dict, overrides: dict[str, Any] | None = None) -> dict:
    """Exécute l'assembleur APRÈS validation humaine (applique les corrections)."""
    s = dict(state)
    s["human_overrides"] = overrides or {}
    s["human_validated"] = True
    s.update(agents.assembler(s))
    return s


def engine_info() -> dict:
    return {
        "langgraph": _HAS_LANGGRAPH,
        "agents": [name for name, _ in ANALYZE_AGENTS] + ["assembler"],
    }

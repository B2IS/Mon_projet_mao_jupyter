"""
migration/state.py — État partagé du Swarm de Migration IA (LangGraph)
======================================================================
Définit l'état circulant entre les agents du graphe ainsi que les modèles
de données structurés produits (projet, WBS, jalons, risques, immobilisations,
rapport QA). Ces structures sont alignées sur le modèle de données du frontend
(`projectStore`, `immobilisationStore`) pour une intégration sans friction.
"""
from __future__ import annotations

from typing import Any, Optional, TypedDict
from pydantic import BaseModel, Field


# ─────────────────────────────────────────────────────────────────────────────
# MODÈLES DE SORTIE STRUCTURÉS (alignés sur le frontend)
# ─────────────────────────────────────────────────────────────────────────────

class WBSItem(BaseModel):
    code: str
    label: str
    budget: float = 0.0            # M FCFA
    duree_jours: int = 0


class Milestone(BaseModel):
    name: str
    date: str = ""                 # YYYY-MM-DD


class Risk(BaseModel):
    description: str
    severity: str = "moyenne"      # haute | moyenne | basse
    mitigation: str = ""


class Immobilisation(BaseModel):
    """Fiche immobilisation prête pour transmission DAIC (amortissement)."""
    code: str
    designation: str
    categorie: str = "Autre"       # cf. CATEGORIES_IMMO du frontend
    valeur_acquisition: float = 0  # M FCFA (valeur brute)
    valeur_residuelle: float = 0
    date_mise_en_service: str = ""
    duree_amortissement: int = 10  # années
    methode: str = "lineaire"      # lineaire | degressif
    localisation: str = ""
    statut: str = "en_cours"       # en_service | en_cours | cede | reforme
    source_document: str = ""      # traçabilité (doc d'origine)
    justification: str = ""        # pourquoi c'est immobilisable (contexte Senelec)


class ProjectDraft(BaseModel):
    name: str = "Projet migré"
    code: str = ""
    domaine: str = "distribution"  # production|transport|distribution|commercial|electricite
    description: str = ""
    objectif: str = ""
    chef_projet: str = ""
    localisation: str = ""
    region: str = ""
    budget: float = 0.0            # M FCFA
    devise: str = "FCFA"
    bailleur: str = ""
    programme: str = ""
    unite: str = ""                # DPD, DPT, DEP, PADERAU…
    direction: str = ""
    date_debut: str = ""
    date_fin_prevue: str = ""
    wbs: list[WBSItem] = Field(default_factory=list)
    jalons: list[Milestone] = Field(default_factory=list)
    livrables: list[str] = Field(default_factory=list)
    parties_prenantes: list[str] = Field(default_factory=list)
    marches: list[dict[str, Any]] = Field(default_factory=list)


class QAFinding(BaseModel):
    field: str
    level: str                     # error | warning | info
    message: str


class QAReport(BaseModel):
    confidence: float = 0.0        # 0–100
    findings: list[QAFinding] = Field(default_factory=list)
    is_ready_for_human: bool = False


class ExtractedDoc(BaseModel):
    name: str
    doc_type: str = "other"        # contract|dao|boq|report|pv|plan|excel|pdf|word|ppt|dwg|photo|other
    text: str = ""
    pages: int = 0
    ocr_used: bool = False
    error: str = ""


# ─────────────────────────────────────────────────────────────────────────────
# ÉTAT DU GRAPHE LANGGRAPH
# ─────────────────────────────────────────────────────────────────────────────

class SwarmState(TypedDict, total=False):
    # Entrées
    raw_files: list[dict[str, Any]]      # [{name, content_b64 | text, mime}]
    # Intermédiaires
    documents: list[dict[str, Any]]      # ExtractedDoc.dict()
    corpus: str                          # texte concaténé pour le contexte LLM
    project: dict[str, Any]              # ProjectDraft.dict()
    risks: list[dict[str, Any]]
    immobilisations: list[dict[str, Any]]
    qa: dict[str, Any]                   # QAReport.dict()
    # Pilotage du swarm
    next_agent: str
    history: list[str]                   # journal des agents exécutés (traçabilité)
    notes: list[str]                     # messages internes du swarm
    # Human-in-the-loop
    human_validated: bool
    human_overrides: dict[str, Any]      # corrections saisies par le chef de projet
    status: str                          # extracted|drafted|qa_done|awaiting_human|finalized


def empty_state() -> SwarmState:
    return SwarmState(
        raw_files=[], documents=[], corpus="", project={}, risks=[],
        immobilisations=[], qa={}, next_agent="document_intelligence",
        history=[], notes=[], human_validated=False, human_overrides={},
        status="init",
    )

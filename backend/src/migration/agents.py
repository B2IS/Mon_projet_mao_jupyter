"""
migration/agents.py — Agents du Swarm de Migration (rôles spécialisés)
======================================================================
Chaque agent est un NŒUD du graphe LangGraph : il reçoit l'état partagé et
renvoie une mise à jour partielle. Tous les agents combinent :
  • un appel LLM (Ollama/OpenAI) avec un prompt expert « contexte Senelec DPE »,
  • un REPLI HEURISTIQUE déterministe (regex/règles) si le LLM est indisponible.

Rôles (swarm) :
  - document_intelligence  : lit/classe/synthétise les documents (OCR/NLP)
  - project_planner        : structure le projet (nom, domaine, budget, dates, WBS…)
  - scheduler              : planning, WBS, jalons
  - risk_analyst           : registre des risques
  - immobilisation_accountant : comptable expert immobilisations (handover DAIC)
  - qa_validator           : contrôle qualité, complétude, confiance → HITL
  - assembler              : assemble le livrable final SIGEPP
"""
from __future__ import annotations

import re
from datetime import date, timedelta
from typing import Any

from src.migration.llm import llm
from src.migration.state import (
    ProjectDraft, WBSItem, Milestone, Risk, Immobilisation, QAReport, QAFinding,
)
from src.utils.logger import get_logger

logger = get_logger(__name__)

SENELEC_CTX = (
    "Tu es un agent expert de la Direction Principale Équipement (DPE) de SENELEC "
    "(électricité, Sénégal). Domaines: production, transport (lignes HTB/postes), "
    "distribution (HTA/BT), commercial (AMI/compteurs), électrification/accès universel. "
    "Programmes/bailleurs typiques: PASE, PADAES, PADERAU, BEST, Compact 2026 (MCA), PAMACEL, "
    "BAD, Banque Mondiale, UE, AFD, BEI. Montants en millions de FCFA."
)


# ─────────────────────────────────────────────────────────────────────────────
# Helpers
# ─────────────────────────────────────────────────────────────────────────────

def _corpus(state: dict) -> str:
    docs = state.get("documents", [])
    parts = []
    for d in docs:
        head = f"\n===== DOCUMENT: {d.get('name','?')} (type={d.get('doc_type','?')}) =====\n"
        parts.append(head + (d.get("text", "") or "")[:8000])
    return "\n".join(parts)[:24000]


def _filenames(state: dict) -> list[str]:
    return [d.get("name", "") for d in state.get("documents", [])]


def _log(state: dict, agent: str) -> list[str]:
    return [*state.get("history", []), agent]


# ─────────────────────────────────────────────────────────────────────────────
# 1) DOCUMENT INTELLIGENCE
# ─────────────────────────────────────────────────────────────────────────────

def document_intelligence(state: dict) -> dict:
    corpus = _corpus(state)
    notes = list(state.get("notes", []))
    n_docs = len(state.get("documents", []))
    ocr = sum(1 for d in state.get("documents", []) if d.get("ocr_used"))
    notes.append(f"[DocIntel] {n_docs} document(s) analysés ({ocr} via OCR).")
    return {
        "corpus": corpus,
        "history": _log(state, "document_intelligence"),
        "notes": notes,
        "status": "extracted",
        "next_agent": "project_planner",
    }


# ─────────────────────────────────────────────────────────────────────────────
# 2) PROJECT PLANNER
# ─────────────────────────────────────────────────────────────────────────────

def project_planner(state: dict) -> dict:
    corpus = state.get("corpus", "") or _corpus(state)
    names = _filenames(state)

    data = llm.complete_json(
        SENELEC_CTX + "\nTu es CHEF DE PROJET. Extrait la fiche projet.",
        "À partir des documents ci-dessous, renvoie un JSON avec les clés: "
        "name, code, domaine (production|transport|distribution|commercial|electricite), "
        "description, objectif, chef_projet, localisation, region, budget (millions FCFA, number), "
        "devise, bailleur, programme, unite, direction, date_debut (YYYY-MM-DD), "
        "date_fin_prevue (YYYY-MM-DD), livrables (liste), parties_prenantes (liste).\n\n"
        f"DOCUMENTS:\n{corpus}",
    )

    if data:
        proj = ProjectDraft(**_coerce_project(data))
    else:
        proj = _heuristic_project(corpus, names)

    return {
        "project": proj.dict(),
        "history": _log(state, "project_planner"),
        "status": "drafted",
        "next_agent": "scheduler",
    }


def _coerce_project(d: dict) -> dict:
    allowed = ProjectDraft.model_fields.keys()
    out = {k: v for k, v in d.items() if k in allowed}
    if isinstance(out.get("budget"), str):
        out["budget"] = _num(out["budget"])
    if out.get("domaine"):
        out["domaine"] = _norm_domaine(str(out["domaine"]))
    return out


def _heuristic_project(corpus: str, names: list[str]) -> ProjectDraft:
    text = corpus.lower()
    name = _first(corpus, r"projet\s*[:\-]?\s*([^\n]{4,90})") or _infer_name(names)
    budget = _amount(text)
    return ProjectDraft(
        name=name or "Projet migré",
        code=_first(corpus, r"(?:n[°o]\s*march[ée]|code)\s*[:\-]?\s*([A-Z0-9\-/]{3,30})") or "",
        domaine=_guess_domaine(text),
        budget=budget,
        bailleur=_guess_bailleur(text),
        programme=_guess_programme(text),
        date_debut=_first_date(text, r"d[eé]but\s*[:\-]?\s*(\d{2}[\/\-]\d{2}[\/\-]\d{4})") or "",
        date_fin_prevue=_first_date(text, r"fin\s*[:\-]?\s*(\d{2}[\/\-]\d{2}[\/\-]\d{4})") or "",
        localisation=_first(corpus, r"(?:localisation|site|r[ée]gion)\s*[:\-]?\s*([^\n]{3,60})") or "",
    )


# ─────────────────────────────────────────────────────────────────────────────
# 3) SCHEDULER (WBS + jalons)
# ─────────────────────────────────────────────────────────────────────────────

def scheduler(state: dict) -> dict:
    proj = state.get("project", {})
    domaine = proj.get("domaine", "distribution")
    corpus = state.get("corpus", "")

    data = llm.complete_json(
        SENELEC_CTX + "\nTu es PLANIFICATEUR. Construis le WBS et les jalons.",
        "Renvoie un JSON {\"wbs\":[{code,label,budget,duree_jours}], "
        "\"jalons\":[{name,date}]} cohérent avec un projet "
        f"de domaine '{domaine}'. Documents:\n{corpus[:8000]}",
    )
    wbs: list[WBSItem] = []
    jalons: list[Milestone] = []
    if data:
        for w in data.get("wbs", []) or []:
            try:
                wbs.append(WBSItem(code=str(w.get("code", "")), label=str(w.get("label", "")),
                                   budget=_num(w.get("budget", 0)), duree_jours=int(w.get("duree_jours", 0) or 0)))
            except Exception:
                continue
        for m in data.get("jalons", []) or []:
            jalons.append(Milestone(name=str(m.get("name", "")), date=str(m.get("date", ""))))
    if not wbs:
        wbs = _default_wbs(domaine)
    proj["wbs"] = [w.dict() for w in wbs]
    proj["jalons"] = [m.dict() for m in jalons] or proj.get("jalons", [])
    return {"project": proj, "history": _log(state, "scheduler"), "next_agent": "risk_analyst"}


# ─────────────────────────────────────────────────────────────────────────────
# 4) RISK ANALYST
# ─────────────────────────────────────────────────────────────────────────────

def risk_analyst(state: dict) -> dict:
    corpus = state.get("corpus", "")
    data = llm.complete_json(
        SENELEC_CTX + "\nTu es ANALYSTE RISQUES.",
        "Identifie les risques projet. Renvoie {\"risks\":[{description,severity,mitigation}]} "
        f"(severity: haute|moyenne|basse). Documents:\n{corpus[:8000]}",
    )
    risks: list[Risk] = []
    if data:
        for r in data.get("risks", []) or []:
            risks.append(Risk(description=str(r.get("description", "")),
                              severity=str(r.get("severity", "moyenne")),
                              mitigation=str(r.get("mitigation", ""))))
    if not risks:
        risks = _default_risks(corpus)
    return {"risks": [r.dict() for r in risks], "history": _log(state, "risk_analyst"),
            "next_agent": "immobilisation_accountant"}


# ─────────────────────────────────────────────────────────────────────────────
# 5) IMMOBILISATION ACCOUNTANT (handover DAIC)
# ─────────────────────────────────────────────────────────────────────────────

# Catalogue Senelec : libellé détecté → (catégorie, durée d'amortissement usuelle)
IMMO_RULES: list[tuple[str, str, int]] = [
    (r"poste\s+(?:source\s+)?h?tb|poste\s+225|poste\s+90", "Poste HTB", 20),
    (r"poste\s+h?ta|poste\s+30\s*kv|poste\s+mt|cabine", "Poste HTA/BT", 20),
    (r"transformateur|transfo", "Transformateur", 15),
    (r"ligne\s+h?tb|ligne\s+225|ligne\s+90|225\s*kv", "Ligne HTB", 25),
    (r"ligne\s+h?ta|r[ée]seau\s+h?ta|dorsale|30\s*kv", "Ligne HTA", 25),
    (r"r[ée]seau\s+bt|ligne\s+bt|branchement", "Ligne BT", 20),
    (r"centrale|groupe\s+[ée]lectrog|turbine|photovolta|solaire|[ée]olien", "Centrale / Production", 20),
    (r"batterie|stockage|bess", "Stockage / Batteries", 10),
    (r"b[âa]timent|g[ée]nie\s+civil|local\s+technique|cl[ôo]ture", "Bâtiment & Génie Civil", 25),
    (r"compteur|ami|pr[ée]paiement", "Compteurs / AMI", 8),
    (r"v[ée]hicule|pick-?up|4x4", "Matériel roulant", 5),
    (r"serveur|ordinateur|logiciel|scada|idms", "Matériel informatique", 5),
]


def immobilisation_accountant(state: dict) -> dict:
    corpus = state.get("corpus", "")
    proj = state.get("project", {})
    mes = proj.get("date_fin_prevue") or proj.get("date_debut") or date.today().isoformat()

    data = llm.complete_json(
        SENELEC_CTX + "\nTu es COMPTABLE EXPERT EN IMMOBILISATIONS (contexte Senelec). "
        "Objectif: identifier TOUT ce qui est immobilisable pour transmission à la DAIC "
        "(amortissements). Sois exhaustif et conservateur.",
        "Depuis les documents (BOQ, contrat, PV de réception…), liste les immobilisations. "
        "Renvoie {\"immobilisations\":[{code,designation,categorie,valeur_acquisition (M FCFA),"
        "valeur_residuelle,date_mise_en_service (YYYY-MM-DD),duree_amortissement (années),"
        "methode (lineaire|degressif),localisation,statut,source_document,justification}]}.\n\n"
        f"Date de mise en service par défaut: {mes}.\nDocuments:\n{corpus[:9000]}",
    )

    immos: list[Immobilisation] = []
    if data:
        for it in data.get("immobilisations", []) or []:
            try:
                immos.append(Immobilisation(
                    code=str(it.get("code") or f"IMM-{len(immos)+1:03d}"),
                    designation=str(it.get("designation", "")),
                    categorie=str(it.get("categorie", "Autre")),
                    valeur_acquisition=_num(it.get("valeur_acquisition", 0)),
                    valeur_residuelle=_num(it.get("valeur_residuelle", 0)),
                    date_mise_en_service=str(it.get("date_mise_en_service", mes)) or mes,
                    duree_amortissement=int(it.get("duree_amortissement", 10) or 10),
                    methode=str(it.get("methode", "lineaire")),
                    localisation=str(it.get("localisation", proj.get("localisation", ""))),
                    statut=str(it.get("statut", "en_cours")),
                    source_document=str(it.get("source_document", "")),
                    justification=str(it.get("justification", "")),
                ))
            except Exception:
                continue
    if not immos:
        immos = _heuristic_immos(corpus, proj, mes)

    return {"immobilisations": [i.dict() for i in immos],
            "history": _log(state, "immobilisation_accountant"),
            "next_agent": "qa_validator"}


def _heuristic_immos(corpus: str, proj: dict, mes: str) -> list[Immobilisation]:
    text = corpus.lower()
    found: list[Immobilisation] = []
    seen: set[str] = set()
    idx = 1
    for pattern, categorie, duree in IMMO_RULES:
        if re.search(pattern, text):
            if categorie in seen:
                continue
            seen.add(categorie)
            qte = _count_near(text, pattern)
            found.append(Immobilisation(
                code=f"IMM-{idx:03d}",
                designation=f"{categorie}" + (f" (×{qte})" if qte > 1 else ""),
                categorie=categorie,
                valeur_acquisition=0.0,
                duree_amortissement=duree,
                date_mise_en_service=mes,
                statut="en_cours",
                localisation=proj.get("localisation", ""),
                justification="Détecté automatiquement dans le dossier (à valoriser par la DAIC).",
            ))
            idx += 1
    if not found:
        found.append(Immobilisation(
            code="IMM-001", designation="Ouvrage électrique du projet", categorie="Autre",
            duree_amortissement=20, date_mise_en_service=mes, statut="en_cours",
            justification="À compléter — aucun actif explicitement détecté.",
        ))
    return found


# ─────────────────────────────────────────────────────────────────────────────
# 6) QA VALIDATOR
# ─────────────────────────────────────────────────────────────────────────────

def qa_validator(state: dict) -> dict:
    proj = state.get("project", {})
    immos = state.get("immobilisations", [])
    findings: list[QAFinding] = []

    def need(field: str, label: str, level: str = "warning"):
        if not proj.get(field):
            findings.append(QAFinding(field=field, level=level, message=f"{label} manquant(e)."))

    need("name", "Nom du projet", "error")
    need("budget", "Budget")
    need("date_debut", "Date de début")
    need("date_fin_prevue", "Date de fin prévue")
    need("domaine", "Domaine")
    need("bailleur", "Bailleur/Financement", "info")
    if not proj.get("wbs"):
        findings.append(QAFinding(field="wbs", level="warning", message="WBS vide."))
    if not immos:
        findings.append(QAFinding(field="immobilisations", level="warning",
                                  message="Aucune immobilisation identifiée."))
    if any(_num(i.get("valeur_acquisition")) == 0 for i in immos):
        findings.append(QAFinding(field="immobilisations", level="info",
                                  message="Valeurs d'immobilisation à compléter avant transmission DAIC."))

    score = 100
    for f in findings:
        score -= {"error": 25, "warning": 10, "info": 3}.get(f.level, 5)
    score = max(0, min(100, score))

    qa = QAReport(confidence=score, findings=findings, is_ready_for_human=True)
    return {"qa": qa.dict(), "history": _log(state, "qa_validator"),
            "status": "awaiting_human", "next_agent": "assembler"}


# ─────────────────────────────────────────────────────────────────────────────
# 7) ASSEMBLER (après validation humaine)
# ─────────────────────────────────────────────────────────────────────────────

def assembler(state: dict) -> dict:
    proj = dict(state.get("project", {}))
    overrides = state.get("human_overrides", {}) or {}
    # Applique les corrections du chef de projet (human-in-the-loop)
    for k, v in overrides.items():
        proj[k] = v
    return {
        "project": proj,
        "history": _log(state, "assembler"),
        "status": "finalized",
        "next_agent": "END",
    }


# ─────────────────────────────────────────────────────────────────────────────
# Outils heuristiques
# ─────────────────────────────────────────────────────────────────────────────

def _num(v: Any) -> float:
    if isinstance(v, (int, float)):
        return float(v)
    s = re.sub(r"[^\d.,]", "", str(v or "")).replace(" ", "").replace(",", ".")
    try:
        return float(s) if s else 0.0
    except Exception:
        return 0.0


def _first(text: str, pattern: str) -> str:
    m = re.search(pattern, text, re.I)
    return m.group(1).strip() if m else ""


def _first_date(text: str, pattern: str) -> str:
    m = re.search(pattern, text, re.I)
    if not m:
        return ""
    parts = re.split(r"[\/\-]", m.group(1))
    if len(parts) == 3 and len(parts[2]) == 4:
        return f"{parts[2]}-{parts[1]}-{parts[0]}"
    return m.group(1)


def _amount(text: str) -> float:
    for p in (r"montant\s*(?:total)?\s*[:\-]?\s*([\d\s.,]+)\s*(?:m?\s*fcfa|xof|cfa)",
              r"budget\s*[:\-]?\s*([\d\s.,]+)"):
        m = re.search(p, text, re.I)
        if m:
            n = _num(m.group(1))
            return n / 1e6 if n > 1e7 else n
    return 0.0


def _count_near(text: str, pattern: str) -> int:
    m = re.search(r"(\d{1,4})\s*(?:x|unit|pc|nb)?\s*[^\n]{0,20}" + pattern, text, re.I)
    return int(m.group(1)) if m else 1


def _norm_domaine(s: str) -> str:
    s = s.lower()
    for k in ("production", "transport", "distribution", "commercial", "electricite", "électricité"):
        if k[:6] in s:
            return "electricite" if "lect" in k else k
    return "distribution"


def _guess_domaine(text: str) -> str:
    if re.search(r"centrale|production|turbine|solaire|[ée]olien|photovolta", text):
        return "production"
    if re.search(r"ligne\s+h?tb|225\s*kv|90\s*kv|poste\s+source|interconnex", text):
        return "transport"
    if re.search(r"compteur|ami|pr[ée]paiement|commercial", text):
        return "commercial"
    if re.search(r"[ée]lectrification|acc[èe]s\s+universel|rural|localit", text):
        return "electricite"
    return "distribution"


def _guess_bailleur(text: str) -> str:
    for b in ("banque mondiale", "world bank", "union européenne", "afd", "bei", "bad",
              "mca", "compact", "boad", "kfw"):
        if b in text:
            return b.upper()
    return ""


def _guess_programme(text: str) -> str:
    for p in ("padaes", "paderau", "best", "pamacel", "pase", "compact"):
        if p in text:
            return p.upper()
    return ""


def _infer_name(names: list[str]) -> str:
    for n in names:
        base = re.sub(r"\.[^.]+$", "", n).replace("_", " ").replace("-", " ")
        base = re.sub(r"\b(contrat|dao|pv|rapport|plan|budget|boq)\b", "", base, flags=re.I).strip()
        if len(base) > 5:
            return base[:80]
    return ""


def _default_wbs(domaine: str) -> list[WBSItem]:
    common = [
        ("1.0", "Études & Conception", 15, 45),
        ("2.0", "Sauvegardes E&S (EIES/PAR) & Foncier", 8, 40),
        ("3.0", "Approvisionnement & Fournitures", 30, 60),
        ("4.0", "Travaux", 35, 120),
        ("5.0", "Mise en service & Réception", 8, 20),
        ("6.0", "Gestion de projet & Clôture", 4, 15),
    ]
    return [WBSItem(code=c, label=l, budget=b, duree_jours=d) for c, l, b, d in common]


def _default_risks(corpus: str) -> list[Risk]:
    return [
        Risk(description="Retard de libération des emprises / foncier", severity="haute",
             mitigation="Anticiper PAR et indemnisations avec les autorités."),
        Risk(description="Retard d'approvisionnement (supports béton, transfos)", severity="moyenne",
             mitigation="Commandes anticipées et suivi fournisseurs."),
        Risk(description="Retard de décaissement / paiement des factures", severity="moyenne",
             mitigation="Suivi rapproché du circuit financier."),
        Risk(description="Disponibilité du poste source pour mise en service", severity="basse",
             mitigation="Coordination avec l'exploitation."),
    ]

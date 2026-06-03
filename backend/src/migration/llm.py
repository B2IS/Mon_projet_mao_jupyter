"""
migration/llm.py — Abstraction LLM pour le Swarm (open source par défaut)
=========================================================================
Fournit un appel LLM unifié utilisé par tous les agents :
  • Ollama local (Llama 3 / Mistral / Qwen…) — open source, par défaut.
  • Tout backend compatible OpenAI (si OPENAI_BASE_URL/API_KEY fournis).
  • Repli HEURISTIQUE déterministe si aucun LLM n'est disponible, afin que
    le swarm produise TOUJOURS un résultat exploitable (mode dégradé).

`complete_json()` force une sortie JSON robuste (extraction tolérante).
"""
from __future__ import annotations

import json
import os
import re
from typing import Any, Optional

import httpx

from src.config.config import APP_CFG
from src.utils.logger import get_logger

logger = get_logger(__name__)

_OPENAI_BASE = os.getenv("OPENAI_BASE_URL", "").rstrip("/")
_OPENAI_KEY = os.getenv("OPENAI_API_KEY", "")
_OPENAI_MODEL = os.getenv("OPENAI_MODEL", "gpt-4o-mini")
_LLM_TIMEOUT = float(os.getenv("LLM_TIMEOUT", "60"))


class LLM:
    """Client LLM multi-backend avec repli heuristique."""

    def __init__(self) -> None:
        self.ollama_url = APP_CFG.ollama_base_url.rstrip("/")
        self.ollama_model = APP_CFG.ollama_model

    # ── Détection de disponibilité ──────────────────────────────────────────
    def backend(self) -> str:
        if _OPENAI_BASE and _OPENAI_KEY:
            return "openai"
        if self._ollama_alive():
            return "ollama"
        return "heuristic"

    def _ollama_alive(self) -> bool:
        try:
            r = httpx.get(f"{self.ollama_url}/api/tags", timeout=2.0)
            return r.status_code == 200
        except Exception:
            return False

    # ── Appels ──────────────────────────────────────────────────────────────
    def complete(self, system: str, user: str, temperature: float = 0.2) -> str:
        b = self.backend()
        try:
            if b == "openai":
                return self._openai(system, user, temperature)
            if b == "ollama":
                return self._ollama(system, user, temperature)
        except Exception as e:  # pragma: no cover - réseau
            logger.warning("llm_call_failed", backend=b, error=str(e))
        return ""  # repli heuristique géré par les agents

    def complete_json(self, system: str, user: str, temperature: float = 0.1) -> Optional[dict[str, Any]]:
        sys = (system + "\n\nRéponds UNIQUEMENT avec un objet JSON valide, sans texte autour, "
               "sans bloc ```").strip()
        raw = self.complete(sys, user, temperature)
        return _safe_json(raw)

    # ── Implémentations backend ──────────────────────────────────────────────
    def _ollama(self, system: str, user: str, temperature: float) -> str:
        body = {
            "model": self.ollama_model,
            "prompt": user,
            "system": system,
            "stream": False,
            "options": {"temperature": temperature},
        }
        r = httpx.post(f"{self.ollama_url}/api/generate", json=body, timeout=_LLM_TIMEOUT)
        r.raise_for_status()
        return r.json().get("response", "")

    def _openai(self, system: str, user: str, temperature: float) -> str:
        headers = {"Authorization": f"Bearer {_OPENAI_KEY}", "Content-Type": "application/json"}
        body = {
            "model": _OPENAI_MODEL,
            "temperature": temperature,
            "messages": [
                {"role": "system", "content": system},
                {"role": "user", "content": user},
            ],
        }
        r = httpx.post(f"{_OPENAI_BASE}/chat/completions", headers=headers, json=body, timeout=_LLM_TIMEOUT)
        r.raise_for_status()
        return r.json()["choices"][0]["message"]["content"]


def _safe_json(text: str) -> Optional[dict[str, Any]]:
    """Extraction JSON tolérante (gère ```json, texte parasite, etc.)."""
    if not text:
        return None
    text = text.strip()
    # retire les fences ```json ... ```
    text = re.sub(r"^```(?:json)?|```$", "", text, flags=re.MULTILINE).strip()
    try:
        return json.loads(text)
    except Exception:
        pass
    # cherche le 1er objet { ... } équilibré
    start = text.find("{")
    if start == -1:
        return None
    depth = 0
    for i in range(start, len(text)):
        if text[i] == "{":
            depth += 1
        elif text[i] == "}":
            depth -= 1
            if depth == 0:
                try:
                    return json.loads(text[start:i + 1])
                except Exception:
                    return None
    return None


# Singleton réutilisable
llm = LLM()

"""AI service facade — now backed by Groq (OpenAI-compatible API).

This module keeps the exact public API the API routes already call
(`generate`, `generate_stream`, `generate_json`, `generate_explained`,
`translate`, `is_live`, `AIServiceError`) so no route logic changes when the
provider switches from Gemini to Groq. The heavy lifting lives in
`ai/groq_service.py`.

When GROQ_API_KEY is unset, every function degrades to deterministic **mock
mode** so the app works end-to-end without external calls.
"""

from __future__ import annotations

import hashlib
import json
import time
from collections.abc import Iterator
from typing import Any

from ai import groq_service
from ai.groq_service import AIServiceError, is_live  # re-export

# Provider metadata (consumed by the /ai/status endpoint and startup log).
PROVIDER = groq_service.PROVIDER


def active_model() -> str:
    return groq_service.primary_model()


def fallback_model() -> str:
    return groq_service.fallback_model()


SYSTEM_INSTRUCTION = (
    "You are an AI investigation assistant for an Indian state police department "
    "(CrimeAI). Help investigating officers analyze FIRs, evidence, witnesses, "
    "and suspects. Be precise, factual, and concise. Use clear headings and "
    "bullet points. Never fabricate facts that are not supported by the provided "
    "case data; when information is missing, say so explicitly. Do not give legal "
    "advice; frame outputs as investigative assistance only."
)

# Tiny TTL cache: key -> (expires_at, value).
_CACHE: dict[str, tuple[float, str]] = {}
_CACHE_TTL_SECONDS = 600


def _cache_key(feature: str, prompt: str) -> str:
    return hashlib.sha256(f"{feature}::{prompt}".encode("utf-8")).hexdigest()


def _cache_get(key: str) -> str | None:
    entry = _CACHE.get(key)
    if not entry:
        return None
    expires_at, value = entry
    if expires_at < time.time():
        _CACHE.pop(key, None)
        return None
    return value


def _cache_set(key: str, value: str) -> None:
    _CACHE[key] = (time.time() + _CACHE_TTL_SECONDS, value)


def _messages(prompt: str, *, system: str = SYSTEM_INSTRUCTION) -> list[dict]:
    return [
        {"role": "system", "content": system},
        {"role": "user", "content": prompt},
    ]


# --- Mock responses (used only when GROQ_API_KEY is unset) -------------------

def _mock_response(feature: str, prompt: str) -> str:
    return (
        f"**[AI mock mode]** — set `GROQ_API_KEY` in backend/.env to enable live "
        f"Groq ({active_model()}) responses.\n\n"
        f"This is a placeholder **{feature.replace('_', ' ')}** generated from the "
        f"case context below so the interface works end-to-end.\n\n"
        f"- Summary of the supplied case data\n"
        f"- Notable gaps in evidence or witness coverage\n"
        f"- Suggested next investigative steps\n\n"
        f"_Context received ({len(prompt)} chars)._"
    )


def _mock_json(feature: str, prompt: str) -> dict[str, Any]:
    lowered = prompt.lower()
    if "query:" in lowered:
        lowered = lowered.rsplit("query:", 1)[1]
    filters: dict[str, Any] = {}
    for crime in ["theft", "robbery", "cybercrime", "fraud", "assault", "murder"]:
        if crime in lowered:
            filters["crime_type"] = crime.title()
            break
    if "vehicle" in lowered:
        filters["crime_type"] = "Vehicle Theft"
    if "closed" in lowered:
        filters["status"] = "Closed"
    elif "open" in lowered:
        filters["status"] = "Open"
    return {
        "filters": filters,
        "explanation": "[mock] Parsed filters heuristically; configure GROQ_API_KEY for full NL understanding.",
    }


def _mock_explained(question: str, context: str) -> dict[str, Any]:
    has_evidence = "## EVIDENCE" in context and "None recorded" not in context.split("## EVIDENCE")[1][:40]
    return {
        "answer": (
            "[AI mock mode] Based on the supplied case data, this is a placeholder "
            "explained answer. Configure GROQ_API_KEY for live reasoning."
        ),
        "recommendation": "Review the referenced records and corroborate the timeline.",
        "reasoning_chain": [
            "Parsed the FIR details and crime classification.",
            "Reviewed available evidence and witness coverage.",
            "Identified gaps where corroborating data is missing.",
            "Formed a recommendation grounded in the present records.",
        ],
        "confidence": 62 if has_evidence else 38,
        "confidence_rationale": (
            "Confidence reflects how completely the case data covers the question "
            "(mock heuristic based on evidence presence)."
        ),
    }


# --- Public generation API (Groq-backed) -------------------------------------

def generate(feature: str, prompt: str, *, temperature: float = 0.3, use_cache: bool = True) -> str:
    """Generate a complete text response."""
    key = _cache_key(feature, prompt)
    if use_cache:
        cached = _cache_get(key)
        if cached is not None:
            return cached

    if not is_live():
        result = _mock_response(feature, prompt)
        if use_cache:
            _cache_set(key, result)
        return result

    text = groq_service.chat(_messages(prompt), temperature=temperature)
    if use_cache:
        _cache_set(key, text)
    return text


def generate_stream(feature: str, prompt: str, *, temperature: float = 0.3) -> Iterator[str]:
    """Yield response text in chunks for streaming to the client."""
    if not is_live():
        for word in _mock_response(feature, prompt).split(" "):
            yield word + " "
        return

    try:
        yield from groq_service.chat_stream(_messages(prompt), temperature=temperature)
    except AIServiceError as exc:
        # Surface a readable message in-band so the UI shows the real reason.
        yield f"\n\n⚠️ {exc}"


def generate_json(feature: str, prompt: str, *, temperature: float = 0.0) -> dict[str, Any]:
    """Generate a JSON object (used for NL→structured-filter translation)."""
    if not is_live():
        return _mock_json(feature, prompt)

    raw = groq_service.chat(_messages(prompt), temperature=temperature, json_mode=True)
    try:
        return json.loads(raw or "{}")
    except (json.JSONDecodeError, TypeError):
        return {"filters": {}, "explanation": "Could not parse model output."}


EXPLAIN_INSTRUCTION = (
    SYSTEM_INSTRUCTION
    + " Respond ONLY with a JSON object of shape: "
    '{"answer": str, "recommendation": str, '
    '"reasoning_chain": [str, ...], '
    '"confidence": number between 0 and 100, '
    '"confidence_rationale": str}. '
    "The reasoning_chain must be 3-6 ordered steps showing how you moved from the "
    "case data to the answer. Set confidence lower when key data (evidence, "
    "witnesses, suspects) is missing, higher when the data strongly supports the "
    "conclusion. Base everything strictly on the provided context."
)


def generate_explained(feature: str, question: str, context: str, *, temperature: float = 0.2) -> dict[str, Any]:
    """Explainable answer: prose + reasoning chain + confidence."""
    if not is_live():
        return _mock_explained(question, context)

    prompt = f"Question: {question}\n\n--- CASE CONTEXT ---\n{context}"
    raw = groq_service.chat(
        _messages(prompt, system=EXPLAIN_INSTRUCTION), temperature=temperature, json_mode=True
    )
    try:
        parsed = json.loads(raw or "{}")
    except (json.JSONDecodeError, TypeError):
        parsed = {}

    try:
        confidence = float(parsed.get("confidence", 50))
    except (TypeError, ValueError):
        confidence = 50.0
    confidence = max(0.0, min(100.0, confidence))

    chain = parsed.get("reasoning_chain") or []
    if not isinstance(chain, list):
        chain = [str(chain)]

    return {
        "answer": str(parsed.get("answer", "")).strip() or "No answer was produced.",
        "recommendation": str(parsed.get("recommendation", "")).strip(),
        "reasoning_chain": [str(step) for step in chain][:8],
        "confidence": round(confidence, 1),
        "confidence_rationale": str(parsed.get("confidence_rationale", "")).strip(),
    }


# --- Translation -------------------------------------------------------------

LANGUAGE_NAMES = {"en": "English", "hi": "Hindi", "kn": "Kannada"}


def translate(text_value: str, target_lang: str, *, source_lang: str | None = None) -> dict:
    """Translate text into the target language. Degrades gracefully on failure."""
    target_name = LANGUAGE_NAMES.get(target_lang, target_lang)
    if not text_value.strip():
        return {"text": text_value, "translated": False, "note": ""}
    if source_lang and source_lang == target_lang:
        return {"text": text_value, "translated": False, "note": ""}

    if not is_live():
        return {
            "text": text_value,
            "translated": False,
            "note": "Translation unavailable in mock mode; showing original text.",
        }

    source_clause = f"from {LANGUAGE_NAMES.get(source_lang, source_lang)} " if source_lang else ""
    prompt = (
        f"Translate the following text {source_clause}into {target_name}. "
        "Return ONLY the translated text with no preamble, quotes, or notes.\n\n"
        f"{text_value}"
    )
    try:
        translated = groq_service.chat(
            _messages(prompt, system="You are a precise translator."), temperature=0.1
        )
        return {"text": translated.strip() or text_value, "translated": True, "note": ""}
    except AIServiceError as exc:
        return {"text": text_value, "translated": False, "note": str(exc)}


def health() -> dict:
    return groq_service.health()

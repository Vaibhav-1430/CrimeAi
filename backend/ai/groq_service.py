"""Groq inference service (OpenAI-compatible API).

Replaces the previous Gemini integration. Uses the official `openai` SDK
pointed at Groq's OpenAI-compatible endpoint
(https://api.groq.com/openai/v1).

Features:
  * Primary model with automatic **fallback** to a secondary model on
    model-availability / capacity errors.
  * Graceful **mock mode** when GROQ_API_KEY is unset, so the whole app works
    end-to-end without external calls.
  * Structured **error classification**: rate limit, invalid key, network
    failure, model unavailable.
  * chat / streaming-chat / JSON-mode primitives.

Configuration (env):
  GROQ_API_KEY          required for live mode
  GROQ_MODEL            primary model id   (default openai/gpt-oss-120b)
  GROQ_FALLBACK_MODEL   fallback model id  (default qwen/qwen3-32b)
"""

from __future__ import annotations

import logging
import os
from collections.abc import Iterator
from typing import Any

from dotenv import load_dotenv

load_dotenv()

logger = logging.getLogger("crimeai.ai")
if not logger.handlers:
    _h = logging.StreamHandler()
    _h.setFormatter(logging.Formatter("%(asctime)s [%(levelname)s] %(name)s: %(message)s"))
    logger.addHandler(_h)
    logger.setLevel(logging.INFO)

GROQ_BASE_URL = "https://api.groq.com/openai/v1"
PROVIDER = "Groq"


def get_api_key() -> str:
    return os.getenv("GROQ_API_KEY", "").strip()


def primary_model() -> str:
    return os.getenv("GROQ_MODEL", "openai/gpt-oss-120b").strip()


def fallback_model() -> str:
    return os.getenv("GROQ_FALLBACK_MODEL", "qwen/qwen3-32b").strip()


def is_live() -> bool:
    """True when a Groq API key is configured (read dynamically)."""
    return bool(get_api_key())


class AIServiceError(Exception):
    """Raised on a Groq failure, carrying a user-safe message and a category."""

    def __init__(self, message: str, *, category: str = "error"):
        super().__init__(message)
        self.category = category


# --- Client (cached per key) -------------------------------------------------

_client: Any = None
_client_key: str | None = None


def _get_client():
    global _client, _client_key
    api_key = get_api_key()
    if not api_key:
        _client, _client_key = None, None
        return None
    if _client is not None and _client_key == api_key:
        return _client
    try:
        from openai import OpenAI

        _client = OpenAI(base_url=GROQ_BASE_URL, api_key=api_key, timeout=60.0, max_retries=2)
        _client_key = api_key
    except Exception as exc:  # pragma: no cover - import/construction failure
        logger.exception("Failed to construct Groq client: %s", exc)
        _client = None
    return _client


# --- Error classification ----------------------------------------------------

def _classify(exc: Exception) -> AIServiceError:
    """Map an OpenAI-SDK/Groq exception to a categorized AIServiceError."""
    # Import lazily so the module loads even if openai isn't installed yet.
    try:
        from openai import (
            APIConnectionError,
            APITimeoutError,
            AuthenticationError,
            NotFoundError,
            PermissionDeniedError,
            RateLimitError,
        )
    except Exception:  # pragma: no cover
        AuthenticationError = PermissionDeniedError = RateLimitError = ()  # type: ignore
        APIConnectionError = APITimeoutError = NotFoundError = ()  # type: ignore

    if isinstance(exc, RateLimitError):
        return AIServiceError(
            "Groq rate limit reached (HTTP 429). Slow down or check your plan limits.",
            category="rate_limit",
        )
    if isinstance(exc, (AuthenticationError, PermissionDeniedError)):
        return AIServiceError(
            "Groq rejected the API key (auth error). Verify GROQ_API_KEY is valid and enabled.",
            category="invalid_key",
        )
    if isinstance(exc, NotFoundError):
        return AIServiceError(
            "The requested Groq model is unavailable or unknown. Check GROQ_MODEL.",
            category="model_unavailable",
        )
    if isinstance(exc, (APIConnectionError, APITimeoutError)):
        return AIServiceError(
            "Could not reach Groq (network failure or timeout). Try again shortly.",
            category="network",
        )

    text = str(exc).lower()
    if "rate" in text and "limit" in text:
        return AIServiceError("Groq rate limit reached.", category="rate_limit")
    if "api key" in text or "unauthorized" in text or "401" in text:
        return AIServiceError("Groq rejected the API key.", category="invalid_key")
    if "model" in text and ("not found" in text or "decommission" in text or "unavailable" in text):
        return AIServiceError("Groq model unavailable.", category="model_unavailable")
    return AIServiceError(f"Groq request failed: {str(exc)[:200]}", category="error")


def _should_fallback(err: AIServiceError) -> bool:
    """Whether to retry the request on the fallback model."""
    return err.category in {"model_unavailable", "rate_limit"}


# --- Core completion calls ---------------------------------------------------

def chat(
    messages: list[dict],
    *,
    temperature: float = 0.3,
    json_mode: bool = False,
) -> str:
    """Non-streaming chat completion with automatic fallback. Raises AIServiceError."""
    client = _get_client()
    if client is None:
        raise AIServiceError("Groq is not configured (no API key).", category="invalid_key")

    kwargs: dict[str, Any] = {"messages": messages, "temperature": temperature}
    if json_mode:
        kwargs["response_format"] = {"type": "json_object"}

    for attempt, model in enumerate((primary_model(), fallback_model())):
        try:
            logger.info("Groq chat model=%s attempt=%d", model, attempt + 1)
            response = client.chat.completions.create(model=model, **kwargs)
            return response.choices[0].message.content or ""
        except Exception as exc:  # noqa: BLE001
            err = _classify(exc)
            logger.warning("Groq chat failed model=%s: %s", model, err)
            if attempt == 0 and _should_fallback(err):
                logger.info("Falling back to model=%s", fallback_model())
                continue
            raise err
    raise AIServiceError("Groq request failed on all models.", category="error")


def chat_stream(messages: list[dict], *, temperature: float = 0.3) -> Iterator[str]:
    """Streaming chat completion. Falls back to the secondary model on capacity errors."""
    client = _get_client()
    if client is None:
        raise AIServiceError("Groq is not configured (no API key).", category="invalid_key")

    for attempt, model in enumerate((primary_model(), fallback_model())):
        try:
            logger.info("Groq stream model=%s attempt=%d", model, attempt + 1)
            stream = client.chat.completions.create(
                model=model, messages=messages, temperature=temperature, stream=True
            )
            for chunk in stream:
                delta = chunk.choices[0].delta.content if chunk.choices else None
                if delta:
                    yield delta
            return
        except Exception as exc:  # noqa: BLE001
            err = _classify(exc)
            logger.warning("Groq stream failed model=%s: %s", model, err)
            if attempt == 0 and _should_fallback(err):
                continue
            raise err


def health() -> dict:
    """Lightweight health probe for the status endpoint."""
    if not is_live():
        return {"status": "mock", "detail": "GROQ_API_KEY not set; running in mock mode."}
    try:
        client = _get_client()
        client.chat.completions.create(
            model=primary_model(),
            messages=[{"role": "user", "content": "ping"}],
            max_tokens=1,
            temperature=0,
        )
        return {"status": "healthy", "detail": "Groq reachable."}
    except Exception as exc:  # noqa: BLE001
        err = _classify(exc)
        return {"status": "degraded", "detail": str(err), "category": err.category}

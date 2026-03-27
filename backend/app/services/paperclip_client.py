from __future__ import annotations

import json
import os
from typing import Any, Callable
from urllib.error import HTTPError, URLError
from urllib.request import Request, urlopen

DEFAULT_PAPERCLIP_BASE_URL = "http://127.0.0.1:8787"
PAPERCLIP_SUMMARY_PATH = "/api/task/{task_id}"
DEFAULT_TIMEOUT_SECONDS = 15


class PaperclipConsumerError(RuntimeError):
    """Raised when the Papzin & Crew backend cannot reach Paperclip."""


def _resolve_base_url(base_url: str | None = None) -> str:
    resolved = base_url or os.getenv("PAPERCLIP_BASE_URL") or DEFAULT_PAPERCLIP_BASE_URL
    return resolved.rstrip("/")


def build_paperclip_summary_request(task_id: int, *, base_url: str | None = None) -> Request:
    """Build the Paperclip dashboard API request for one task summary."""

    url = f"{_resolve_base_url(base_url)}{PAPERCLIP_SUMMARY_PATH.format(task_id=int(task_id))}"
    return Request(url=url, headers={"Accept": "application/json"}, method="GET")


def fetch_paperclip_summary(
    task_id: int,
    *,
    base_url: str | None = None,
    opener: Callable[..., Any] = urlopen,
) -> dict[str, Any]:
    """Fetch one live Paperclip summary and return it as a dict."""

    request = build_paperclip_summary_request(task_id, base_url=base_url)
    try:
        with opener(request, timeout=DEFAULT_TIMEOUT_SECONDS) as response:
            raw = response.read()
    except HTTPError as exc:  # pragma: no cover - exercised through mocked integrations
        raise PaperclipConsumerError(f"Paperclip rejected task lookup with HTTP {exc.code}") from exc
    except URLError as exc:  # pragma: no cover - exercised through mocked integrations
        raise PaperclipConsumerError(f"Paperclip lookup failed: {exc.reason}") from exc

    if not raw:
        return {}
    return json.loads(raw.decode("utf-8"))

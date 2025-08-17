import json
import logging
import os
import time
import uuid
from typing import Any, Dict
from contextvars import ContextVar

# Context variables to carry request-scoped data across async tasks
_request_id_var: ContextVar[str] = ContextVar("request_id", default="-")


def set_request_id(request_id: str) -> None:
    _request_id_var.set(request_id)


def get_request_id() -> str:
    try:
        return _request_id_var.get()
    except Exception:
        return "-"


def clear_request_id() -> None:
    try:
        _request_id_var.set("-")
    except Exception:
        pass


class RequestIdFilter(logging.Filter):
    """Ensures every log record has a request_id attribute for formatters."""

    def filter(self, record: logging.LogRecord) -> bool:
        if not hasattr(record, "request_id") or not record.request_id:
            try:
                record.request_id = get_request_id()
            except Exception:
                record.request_id = "-"
        return True


class JSONFormatter(logging.Formatter):
    """Simple JSON log formatter that includes request_id when available."""

    def __init__(self, default_fields: Dict[str, Any] | None = None) -> None:
        super().__init__()
        self.default_fields = default_fields or {}

    def format(self, record: logging.LogRecord) -> str:
        base: Dict[str, Any] = {
            "ts": time.strftime("%Y-%m-%dT%H:%M:%S", time.gmtime()),
            "level": record.levelname,
            "logger": record.name,
            "msg": record.getMessage(),
            "request_id": getattr(record, "request_id", None) or get_request_id(),
        }
        # Attach standard metadata
        base.update({
            "module": record.module,
            "func": record.funcName,
            "line": record.lineno,
        })
        # Include any custom extras added via logger.*(..., extra={...})
        for k, v in record.__dict__.items():
            if k in ("args", "msg", "message", "exc_info", "exc_text", "stack_info", "stack_text"):
                continue
            if k in base or k.startswith("_"):
                continue
            # Avoid dumping objects that are not JSON-serializable
            try:
                json.dumps(v)
                base[k] = v
            except Exception:
                base[k] = str(v)
        if self.default_fields:
            base.update(self.default_fields)
        return json.dumps(base, ensure_ascii=False)


def setup_logging() -> None:
    """
    Configure root logging according to env vars:
    - LOG_LEVEL (default INFO)
    - LOG_FORMAT=json|text (default json)
    """
    level_name = os.getenv("LOG_LEVEL", "INFO").upper()
    level = getattr(logging, level_name, logging.INFO)

    log_format = (os.getenv("LOG_FORMAT", "json") or "json").lower()

    root = logging.getLogger()
    # Clear existing handlers to avoid duplicate logs when reloaded
    for h in list(root.handlers):
        root.removeHandler(h)
    root.setLevel(level)

    handler = logging.StreamHandler()
    if log_format == "json":
        formatter = JSONFormatter()
    else:
        formatter = logging.Formatter(
            fmt="%(asctime)s %(levelname)s %(name)s [%(request_id)s] %(message)s",
            datefmt="%Y-%m-%dT%H:%M:%S",
        )
    handler.setFormatter(formatter)
    # Ensure request_id is always present for text formatter and available to filters
    handler.addFilter(RequestIdFilter())
    root.addHandler(handler)

    # Quiet noisy libraries
    logging.getLogger("botocore").setLevel(logging.WARNING)
    logging.getLogger("urllib3").setLevel(logging.WARNING)
    logging.getLogger("uvicorn.access").setLevel(logging.WARNING)


def generate_request_id(header_value: str | None = None) -> str:
    """
    Use incoming header if provided and non-empty; otherwise generate a UUID4 hex string.
    """
    hv = (header_value or "").strip()
    if hv:
        return hv
    return uuid.uuid4().hex

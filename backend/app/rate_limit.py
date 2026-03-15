import ipaddress
import os
import time
from collections import defaultdict, deque
from threading import Lock
from typing import DefaultDict, Deque, Iterable

from fastapi import HTTPException, Request, status


class InMemoryRateLimiter:
    def __init__(self) -> None:
        self._events: DefaultDict[str, Deque[float]] = defaultdict(deque)
        self._lock = Lock()

    def hit(self, bucket: str, subject: str, limit: int, window_seconds: int) -> None:
        if limit <= 0 or window_seconds <= 0:
            return
        now = time.monotonic()
        key = f"{bucket}:{subject}"
        cutoff = now - window_seconds
        with self._lock:
            events = self._events[key]
            while events and events[0] <= cutoff:
                events.popleft()
            if len(events) >= limit:
                retry_after = max(1, int(events[0] + window_seconds - now)) if events else window_seconds
                raise HTTPException(
                    status_code=status.HTTP_429_TOO_MANY_REQUESTS,
                    detail={
                        "error": "Rate limit exceeded",
                        "error_code": "rate_limited",
                        "bucket": bucket,
                        "limit": limit,
                        "window_seconds": window_seconds,
                        "retry_after_seconds": retry_after,
                    },
                    headers={"Retry-After": str(retry_after)},
                )
            events.append(now)


rate_limiter = InMemoryRateLimiter()


def _bool_env(name: str, default: str = "1") -> bool:
    return os.getenv(name, default).strip().lower() not in {"0", "false", "no", "off", ""}


def _parse_trusted_proxies(raw: str) -> list[ipaddress._BaseNetwork]:
    trusted: list[ipaddress._BaseNetwork] = []
    for entry in raw.split(","):
        candidate = entry.strip()
        if not candidate:
            continue
        try:
            if "/" in candidate:
                trusted.append(ipaddress.ip_network(candidate, strict=False))
            else:
                trusted.append(ipaddress.ip_network(candidate + "/32", strict=False))
        except ValueError:
            try:
                trusted.append(ipaddress.ip_network(candidate + "/128", strict=False))
            except ValueError:
                continue
    return trusted


def _client_ip(request: Request) -> str | None:
    return getattr(request.client, "host", None) if request.client else None


def _ip_in_trusted_proxies(host: str | None, trusted_proxies: Iterable[ipaddress._BaseNetwork]) -> bool:
    if not host:
        return False
    try:
        ip_obj = ipaddress.ip_address(host)
    except ValueError:
        return False
    return any(ip_obj in network for network in trusted_proxies)


def _trusted_forwarded_value(request: Request) -> str | None:
    trusted_proxies = _parse_trusted_proxies(os.getenv("RATE_LIMIT_TRUSTED_PROXIES", ""))
    if not _ip_in_trusted_proxies(_client_ip(request), trusted_proxies):
        return None

    forwarded = request.headers.get("x-forwarded-for", "")
    for raw_part in forwarded.split(","):
        candidate = raw_part.strip()
        if not candidate:
            continue
        try:
            ipaddress.ip_address(candidate)
            return candidate
        except ValueError:
            continue

    real_ip = request.headers.get("x-real-ip", "").strip()
    if real_ip:
        try:
            ipaddress.ip_address(real_ip)
            return real_ip
        except ValueError:
            return None
    return None


def get_client_subject(request: Request) -> str:
    """
    Resolve the rate-limit subject.

    Security posture:
    - default: use the direct client socket address only
    - trust x-forwarded-for / x-real-ip only when the immediate peer matches
      RATE_LIMIT_TRUSTED_PROXIES (comma-separated IPs/CIDRs)

    This keeps the default fail-closed for deployments that have not explicitly
    configured a trusted reverse proxy to overwrite incoming forwarding headers.
    """
    trusted_forwarded = _trusted_forwarded_value(request)
    direct_client = _client_ip(request)
    return trusted_forwarded or direct_client or "unknown"


def enforce_rate_limit(request: Request, bucket: str, limit_env: str, window_env: str, *, enabled_env: str = "ENABLE_INPROCESS_RATE_LIMITING") -> None:
    if not _bool_env(enabled_env, "1"):
        return
    limit = int(os.getenv(limit_env, "0") or "0")
    window_seconds = int(os.getenv(window_env, "60") or "60")
    if limit <= 0:
        return
    rate_limiter.hit(bucket=bucket, subject=get_client_subject(request), limit=limit, window_seconds=window_seconds)

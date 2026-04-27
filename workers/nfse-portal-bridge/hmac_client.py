"""Cabeçalhos HMAC alinhados a frontend/src/lib/adn-hmac.ts (ADN-03)."""

from __future__ import annotations

import hashlib
import hmac
import json
import time
from typing import Any, Mapping
from urllib.error import HTTPError, URLError
from urllib.request import Request, urlopen


def _json_bytes(payload: Mapping[str, Any] | list[Any]) -> bytes:
    return json.dumps(payload, separators=(",", ":"), ensure_ascii=False).encode("utf-8")


def signed_headers(secret: str, body_bytes: bytes) -> dict[str, str]:
    ts = str(int(time.time()))
    sig = hmac.new(secret.encode("utf-8"), body_bytes, hashlib.sha256).hexdigest()
    return {
        "Content-Type": "application/json",
        "x-adn-timestamp": ts,
        "x-adn-signature": sig,
    }


def internal_json_request(
    base_url: str,
    secret: str,
    method: str,
    path: str,
    payload: Mapping[str, Any] | list[Any],
    *,
    timeout: int = 120,
) -> Any:
    body = _json_bytes(payload)
    hdrs = signed_headers(secret, body)
    url = base_url.rstrip("/") + path
    req = Request(url, data=body, method=method.upper(), headers=hdrs)
    try:
        with urlopen(req, timeout=timeout) as resp:
            raw = resp.read().decode("utf-8")
            return json.loads(raw) if raw else {}
    except HTTPError as e:
        err = e.read().decode("utf-8", errors="replace")
        raise RuntimeError(f"HTTP {e.code} {method} {path}: {err}") from e
    except URLError as e:
        raise RuntimeError(f"URL {url}: {e}") from e


def internal_json_post(base_url: str, secret: str, path: str, payload: Mapping[str, Any] | list[Any]) -> Any:
    return internal_json_request(base_url, secret, "POST", path, payload)


def http_put_bytes(url: str, data: bytes, content_type: str, timeout: int = 300) -> int:
    req = Request(
        url,
        data=data,
        method="PUT",
        headers={"Content-Type": content_type},
    )
    with urlopen(req, timeout=timeout) as resp:
        return int(resp.status)

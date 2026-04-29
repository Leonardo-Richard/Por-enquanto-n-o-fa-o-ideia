"""Normaliza `summary_json` do Postgres (dict ou string JSON) para dict."""

from __future__ import annotations

import json
from typing import Any


def summary_as_dict(raw: Any) -> dict[str, Any]:
    if isinstance(raw, dict):
        return raw
    if isinstance(raw, str) and raw.strip():
        try:
            parsed = json.loads(raw)
        except json.JSONDecodeError:
            return {}
        return parsed if isinstance(parsed, dict) else {}
    return {}

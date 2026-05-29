"""Fallback SQL directo quando PATCH HMAC ao portal falha."""

from __future__ import annotations

import json
import sys

import psycopg

from download_engine import sanitize_user_safe_detail


def force_fail_job_in_db(dsn: str, jid: str, message: str, *, reason: str = "patch_failed") -> bool:
    """
    Fallback de último recurso: se o PATCH ao portal falhar e o job ficar em «running»,
    marca-o como failed directamente na BD.
    """
    if not jid:
        return False
    safe = sanitize_user_safe_detail(message or "", max_len=2000)
    summary = {
        "phase": "error",
        "message": safe or "Job marcado como failed pelo worker (fallback BD após falha de PATCH).",
        "fallback": reason,
    }
    try:
        with psycopg.connect(dsn) as conn:
            with conn.cursor() as cur:
                cur.execute(
                    """
                    UPDATE adn_sync_jobs
                    SET status = 'failed',
                        completed_at = NOW(),
                        updated_at = NOW(),
                        summary_json = COALESCE(summary_json, '{}'::jsonb) || %s::jsonb
                    WHERE id = %s::uuid AND status = 'running'
                    """,
                    (json.dumps(summary, ensure_ascii=False), jid),
                )
            conn.commit()
        return True
    except Exception as e:  # noqa: BLE001
        print(
            f"[nfse-portal-bridge] Fallback BD para failed também falhou: {e}",
            file=sys.stderr,
            flush=True,
        )
        return False


def force_complete_job_in_db(
    dsn: str,
    jid: str,
    summary: dict,
    *,
    reason: str = "patch_completed_failed",
) -> bool:
    """Fallback quando o motor terminou com sucesso mas PATCH «completed» falhou."""
    if not jid:
        return False
    payload = dict(summary or {})
    payload.setdefault("phase", "completed")
    payload["fallback"] = reason
    try:
        with psycopg.connect(dsn) as conn:
            with conn.cursor() as cur:
                cur.execute(
                    """
                    UPDATE adn_sync_jobs
                    SET status = 'completed',
                        completed_at = NOW(),
                        updated_at = NOW(),
                        summary_json = COALESCE(summary_json, '{}'::jsonb) || %s::jsonb
                    WHERE id = %s::uuid AND status = 'running'
                    """,
                    (json.dumps(payload, ensure_ascii=False, default=str), jid),
                )
            conn.commit()
        return True
    except Exception as e:  # noqa: BLE001
        print(
            f"[nfse-portal-bridge] Fallback BD para completed falhou: {e}",
            file=sys.stderr,
            flush=True,
        )
        return False

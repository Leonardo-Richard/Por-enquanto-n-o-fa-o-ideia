"""Reclaim de jobs ADN em «running» órfãos."""

from __future__ import annotations

import json
import os
from datetime import datetime, timedelta, timezone

import psycopg
from psycopg.rows import dict_row


def reclaim_stale_running_jobs(
    conn: psycopg.Connection,
) -> tuple[int, int, int]:
    """
    Recupera jobs em «running» órfãos (started_at anterior ao corte):

    - Se ainda restam tentativas (ADN_STALE_MAX_RECLAIMS), repõe para queued (incrementando
      summary_json.reclaimAttempts) para o worker tentar a recolha de novo.
    - Se já atingiu o máximo, marca failed com motivo claro (evita loop infinito).

    Retorna (n_requeued, n_failed, hours).
    """
    if os.environ.get("ADN_CLEAN_STALE_ON_WORKER_START", "1").strip() == "0":
        return (0, 0, 24)
    try:
        hours = max(1, int(os.environ.get("ADN_STALE_JOB_HOURS", "24") or "24"))
    except ValueError:
        hours = 24
    try:
        max_reclaims = max(1, int(os.environ.get("ADN_STALE_MAX_RECLAIMS", "3") or "3"))
    except ValueError:
        max_reclaims = 3
    cutoff = datetime.now(timezone.utc) - timedelta(hours=hours)

    n_requeued = 0
    n_failed = 0
    with conn.cursor(row_factory=dict_row) as cur:
        cur.execute(
            """
            SELECT id::text AS id,
                   COALESCE((summary_json->>'reclaimAttempts')::int, 0) AS attempts
            FROM adn_sync_jobs
            WHERE status = 'running'
              AND completed_at IS NULL
              AND started_at IS NOT NULL
              AND started_at < %s::timestamptz
            FOR UPDATE SKIP LOCKED
            """,
            (cutoff,),
        )
        rows = cur.fetchall() or []
        for row in rows:
            jid = str(row["id"])
            attempts = int(row.get("attempts") or 0)
            if attempts >= max_reclaims:
                payload = {
                    "phase": "error",
                    "message": (
                        f"Job permaneceu em running sem conclusão após {max_reclaims} "
                        "tentativas — marcado como failed para evitar loop."
                    ),
                    "reclaimAttempts": attempts,
                    "reclaimExhausted": True,
                }
                cur.execute(
                    """
                    UPDATE adn_sync_jobs
                    SET status = 'failed',
                        completed_at = NOW(),
                        updated_at = NOW(),
                        summary_json = COALESCE(summary_json, '{}'::jsonb) || %s::jsonb
                    WHERE id = %s::uuid
                    """,
                    (json.dumps(payload, ensure_ascii=False), jid),
                )
                n_failed += 1
            else:
                next_attempt = attempts + 1
                payload = {
                    "phase": "queued",
                    "reclaimAttempts": next_attempt,
                    "reclaimMaxAttempts": max_reclaims,
                    "reclaimMessage": (
                        f"Worker repôs job em queued (tentativa {next_attempt}/{max_reclaims}) "
                        f"após {hours}h em running sem conclusão — vai tentar nova recolha."
                    ),
                }
                cur.execute(
                    """
                    UPDATE adn_sync_jobs
                    SET status = 'queued',
                        started_at = NULL,
                        completed_at = NULL,
                        updated_at = NOW(),
                        summary_json = COALESCE(summary_json, '{}'::jsonb) || %s::jsonb
                    WHERE id = %s::uuid
                    """,
                    (json.dumps(payload, ensure_ascii=False), jid),
                )
                n_requeued += 1
    conn.commit()
    return (n_requeued, n_failed, hours)

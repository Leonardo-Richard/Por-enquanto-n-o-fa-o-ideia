"""Claim atómico de jobs ADN na fila Postgres."""

from __future__ import annotations

import psycopg
from psycopg.rows import dict_row


def claim_next_job(conn: psycopg.Connection) -> dict | None:
    sql = """
    WITH picked AS (
      SELECT j.id
      FROM adn_sync_jobs j
      INNER JOIN organizations o ON o.id = j.organization_id
      WHERE j.status = 'queued' AND o.adn_sync_enabled = true
      ORDER BY j.created_at ASC
      LIMIT 1
      FOR UPDATE SKIP LOCKED
    )
    UPDATE adn_sync_jobs j
    SET status = 'running',
        started_at = now(),
        updated_at = now()
    FROM picked
    WHERE j.id = picked.id
    RETURNING j.id, j.organization_id, j.company_id, j.summary_json;
    """
    with conn.cursor(row_factory=dict_row) as cur:
        cur.execute(sql)
        row = cur.fetchone()
    conn.commit()
    return row


def load_company(conn: psycopg.Connection, company_id: str) -> dict:
    with conn.cursor(row_factory=dict_row) as cur:
        cur.execute(
            "SELECT cnpj_digits, trade_name FROM companies WHERE id = %s LIMIT 1;",
            (company_id,),
        )
        row = cur.fetchone()
    if not row:
        raise RuntimeError(f"Empresa não encontrada: {company_id}")
    return row

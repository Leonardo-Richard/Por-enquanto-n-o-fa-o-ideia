"""Insere um job ADN em estado queued (smoke). Lê DATABASE_URL do ficheiro .env na raiz do monorepo."""
from __future__ import annotations

import json
import re
import sys
from pathlib import Path

import psycopg

ROOT = Path(__file__).resolve().parents[1]
ENV_PATH = ROOT / ".env"


def load_database_url() -> str:
    if not ENV_PATH.is_file():
        print("Falta .env na raiz.", file=sys.stderr)
        sys.exit(1)
    text = ENV_PATH.read_text(encoding="utf-8")
    for line in text.splitlines():
        line = line.strip()
        if not line or line.startswith("#"):
            continue
        m = re.match(r"^DATABASE_URL=(.*)$", line)
        if m:
            v = m.group(1).strip().strip('"').strip("'")
            if v:
                return v
    print("DATABASE_URL não encontrado em .env.", file=sys.stderr)
    sys.exit(1)


def main() -> None:
    dsn = load_database_url()
    org = "d3b344e3-030e-45de-9c25-e76ba282dafe"
    company = "47e76252-f55b-4097-802a-17639871ccd6"
    summary = json.dumps({"phase": "queued", "message": "enqueue_adn_smoke_job.py"})
    reset_sql = """
    UPDATE adn_sync_jobs
    SET status = 'queued', started_at = NULL, updated_at = now()
    WHERE organization_id = %s::uuid AND status = 'running';
    """
    sql = """
    INSERT INTO adn_sync_jobs (organization_id, company_id, status, trigger, summary_json)
    VALUES (%s::uuid, %s::uuid, 'queued', 'manual', %s::jsonb)
    RETURNING id, status;
    """
    with psycopg.connect(dsn) as conn:
        with conn.cursor() as cur:
            cur.execute(reset_sql, (org,))
            reset_n = cur.rowcount
            cur.execute(sql, (org, company, summary))
            row = cur.fetchone()
        conn.commit()
    if reset_n:
        print(f"Repostos {reset_n} job(s) que estavam 'running'.")
    print("Job enfileirado:", row)


if __name__ == "__main__":
    main()

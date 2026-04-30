"""Uso interno: activa adn_sync_enabled para a org do enqueue_adn_smoke_job.py."""
from __future__ import annotations

import re
import sys
from pathlib import Path

import psycopg

ROOT = Path(__file__).resolve().parents[1]
ORG = "d3b344e3-030e-45de-9c25-e76ba282dafe"


def load_database_url() -> str:
    p = ROOT / ".env"
    if not p.is_file():
        print("Falta .env na raiz.", file=sys.stderr)
        sys.exit(1)
    for line in p.read_text(encoding="utf-8").splitlines():
        line = line.strip()
        if not line or line.startswith("#"):
            continue
        m = re.match(r"^DATABASE_URL=(.*)$", line)
        if m:
            v = m.group(1).strip().strip('"').strip("'")
            if v:
                return v
    sys.exit(1)


def main() -> None:
    dsn = load_database_url()
    with psycopg.connect(dsn) as conn:
        with conn.cursor() as cur:
            cur.execute(
                "UPDATE organizations SET adn_sync_enabled = true WHERE id = %s::uuid RETURNING id;",
                (ORG,),
            )
            row = cur.fetchone()
        conn.commit()
    print("adn_sync_enabled=true:", row)


def reset_stuck_smoke_jobs() -> None:
    """Repor jobs `running` da org smoke para `queued` (evita bloqueio quando não há worker)."""
    dsn = load_database_url()
    with psycopg.connect(dsn) as conn:
        with conn.cursor() as cur:
            cur.execute(
                """
                UPDATE adn_sync_jobs
                SET status = 'queued', started_at = NULL, updated_at = now()
                WHERE organization_id = %s::uuid AND status = 'running'
                RETURNING id::text;
                """,
                (ORG,),
            )
            rows = cur.fetchall()
        conn.commit()
    print("repostos para queued:", rows)


if __name__ == "__main__":
    import sys

    if len(sys.argv) > 1 and sys.argv[1] == "--reset-job":
        reset_stuck_smoke_jobs()
    else:
        main()

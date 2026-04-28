"""Garante buckets privados necessários para ADN no Supabase Storage."""
from __future__ import annotations

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
    with psycopg.connect(dsn) as conn:
        with conn.cursor() as cur:
            cur.execute(
                """
                INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
                VALUES (
                  'adn-certificates',
                  'adn-certificates',
                  false,
                  5242880,
                  ARRAY['application/json', 'application/x-pkcs12']
                )
                ON CONFLICT (id) DO UPDATE
                SET allowed_mime_types = EXCLUDED.allowed_mime_types,
                    file_size_limit = EXCLUDED.file_size_limit,
                    public = EXCLUDED.public;
                """
            )
            cur.execute(
                """
                INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
                VALUES ('adn-artifacts', 'adn-artifacts', false, NULL, ARRAY['application/xml', 'application/pdf'])
                ON CONFLICT (id) DO NOTHING;
                """
            )
            conn.commit()
            cur.execute("SELECT id, name, public, file_size_limit FROM storage.buckets ORDER BY name;")
            rows = cur.fetchall()
    print(rows)


if __name__ == "__main__":
    main()

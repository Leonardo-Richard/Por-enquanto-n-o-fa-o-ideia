"""
Enfileira um job ADN para uma empresa real (dados em Postgres).

Sem argumentos: escolhe a primeira empresa com certificado activo no cofre
(company_certificates + vault_ref) e activa adn_sync na organização.

Uso:
  python scripts/enqueue_adn_real_company_job.py
  python scripts/enqueue_adn_real_company_job.py <organization_uuid> <company_uuid>
  python scripts/enqueue_adn_real_company_job.py --cnpj 12345678000190
  python scripts/enqueue_adn_real_company_job.py --index 2

Lê DATABASE_URL de .env na raiz (igual a enqueue_adn_smoke_job.py).
"""
from __future__ import annotations

import json
import re
import sys
from pathlib import Path

import psycopg
from psycopg.rows import dict_row

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


def pick_company_auto(
    conn: psycopg.Connection, cnpj_filter: str | None, index_one_based: int
) -> tuple[str, str, str, str]:
    """Devolve (org_id, company_id, cnpj, trade_name)."""
    params: list = []
    cnpj_sql = ""
    if cnpj_filter:
        digits = re.sub(r"\D", "", cnpj_filter)
        if len(digits) != 14:
            raise SystemExit("CNPJ deve ter 14 dígitos.")
        cnpj_sql = "AND c.cnpj_digits = %s"
        params.append(digits)

    sql = f"""
    SELECT c.id AS company_id,
           c.cnpj_digits,
           COALESCE(c.trade_name, '') AS trade_name,
           o.id AS org_id,
           COALESCE(o.name, '') AS org_name
    FROM companies c
    INNER JOIN organizations o ON o.id = c.organization_id
    INNER JOIN company_certificates cc
      ON cc.company_id = c.id AND cc.status = 'active'
    WHERE 1=1 {cnpj_sql}
    ORDER BY cc.updated_at DESC NULLS LAST, c.created_at DESC
    LIMIT 50;
    """
    with conn.cursor(row_factory=dict_row) as cur:
        cur.execute(sql, params)
        rows = cur.fetchall()
    if not rows:
        raise SystemExit(
            "Nenhuma empresa com certificado activo (company_certificates). "
            "Carregue um certificado no portal ou passe org+company por argumento."
        )
    if len(rows) > 1 and not cnpj_filter:
        print("Empresas elegíveis (certificado activo):", flush=True)
        for i, r in enumerate(rows, 1):
            print(
                f"  {i}. CNPJ={r['cnpj_digits']} | {r['trade_name'][:60]} | company={r['company_id']}",
                flush=True,
            )
    idx = max(1, min(index_one_based, len(rows))) - 1
    r = rows[idx]
    return (
        str(r["org_id"]),
        str(r["company_id"]),
        str(r["cnpj_digits"]),
        str(r["trade_name"] or ""),
    )


def main() -> None:
    cnpj_filter: str | None = None
    index_one_based = 1
    args = [a for a in sys.argv[1:] if a]
    org_id: str | None = None
    company_id: str | None = None

    pos_args: list[str] = []
    for a in args:
        if a.startswith("--cnpj="):
            cnpj_filter = a.split("=", 1)[1].strip()
        elif a.startswith("--index="):
            try:
                index_one_based = max(1, int(a.split("=", 1)[1].strip()))
            except ValueError:
                raise SystemExit("--index=N precisa de um inteiro >= 1") from None
        elif a.startswith("--cnpj"):
            print("Use --cnpj=14digitos", file=sys.stderr)
            sys.exit(2)
        elif not a.startswith("--"):
            pos_args.append(a)

    if len(pos_args) >= 2:
        org_id = pos_args[0].strip()
        company_id = pos_args[1].strip()

    dsn = load_database_url()
    summary = json.dumps(
        {
            "phase": "queued",
            "message": "enqueue_adn_real_company_job.py",
            "fetchMode": "incremental",
        }
    )
    reset_running_sql = """
    UPDATE adn_sync_jobs
    SET status = 'queued', started_at = NULL, updated_at = now()
    WHERE organization_id = %s::uuid AND status = 'running';
    """
    insert_sql = """
    INSERT INTO adn_sync_jobs (organization_id, company_id, status, trigger, summary_json)
    VALUES (%s::uuid, %s::uuid, 'queued', 'manual', %s::jsonb)
    RETURNING id, status;
    """

    with psycopg.connect(dsn) as conn:
        if org_id and company_id:
            with conn.cursor(row_factory=dict_row) as cur:
                cur.execute(
                    "SELECT cnpj_digits, trade_name FROM companies WHERE id = %s::uuid LIMIT 1;",
                    (company_id,),
                )
                co = cur.fetchone()
            if not co:
                raise SystemExit("company_id não encontrado.")
            cnpj = str(co["cnpj_digits"])
            name = str(co["trade_name"] or "")
        else:
            org_id, company_id, cnpj, name = pick_company_auto(
                conn, cnpj_filter, index_one_based
            )

        with conn.cursor() as cur:
            cur.execute(
                "UPDATE organizations SET adn_sync_enabled = true WHERE id = %s::uuid;",
                (org_id,),
            )
            cur.execute(reset_running_sql, (org_id,))
            reset_n = cur.rowcount
            cur.execute(insert_sql, (org_id, company_id, summary))
            row = cur.fetchone()
        conn.commit()

    if reset_n:
        print(f"Repostos {reset_n} job(s) em running para a mesma organização.", flush=True)
    print(
        f"Organização: {org_id}\n"
        f"Empresa: {company_id}\n"
        f"CNPJ: {cnpj} | {name}\n"
        f"Job enfileirado: {row}",
        flush=True,
    )


if __name__ == "__main__":
    main()

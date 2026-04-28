"""
Consome jobs ADN (`adn_sync_jobs` = queued), corre o código do NFSE_dist na mesma VM (Windows)
e envia XML/PDF de volta ao portal (rotas internas HMAC).

Variáveis de ambiente:
  DATABASE_URL          — Postgres (igual ao portal)
  API_INTERNAL_URL      — Ex.: http://localhost:3001 (preferido)
  PORTAL_INTERNAL_URL   — Fallback legado quando API_INTERNAL_URL não definido
  ADN_WORKER_HMAC_SECRET — Mesmo segredo que o portal (NFR20)
  NFSE_DIST_ROOT        — Opcional; default: <repo>/third_party/NFSE_dist
  NFSE_DIST_CLIENTS_LOCAL_PATH — Opcional; copia para clients.local.json antes da recolha
  POLL_INTERVAL_SEC     — Opcional; default 15
  NFSE_BRIDGE_SKIP_NFSE_DIST — Se "1", não corre run_download_workflow (smoke: fila + PATCH + uploads vazios).
  NFSE_LOCAL_MIRROR_DISABLED — Se "1", não copia XML/PDF para organizations.local_download_root (LM-02A).
  Argumentos: --once — processa no máximo um job (ou sai se a fila estiver vazia).
"""

from __future__ import annotations

import os
import sys
import time
import traceback
import json
from pathlib import Path

import psycopg
from psycopg.rows import dict_row

from cert_materialization import (
    load_active_company_certificate_ref,
    materialize_company_certificate_from_vault,
)
from nfse_runner import clear_company_data_directory, run_download_workflow_once, write_clients_json
from mirror_local import load_org_mirror_context, mirror_data_directory_to_local
from portal_artifacts import patch_job, sync_data_directory


class NoCompanyArtifactsError(RuntimeError):
    """Job sem ficheiros da empresa após execução do downloader."""


def _repo_root() -> Path:
    return Path(__file__).resolve().parents[2]


def _nfse_root() -> Path:
    raw = os.environ.get("NFSE_DIST_ROOT", "").strip()
    if raw:
        return Path(raw)
    return _repo_root() / "third_party" / "NFSE_dist"


def _require_env(name: str) -> str:
    v = os.environ.get(name, "").strip()
    if not v:
        raise RuntimeError(f"Variável obrigatória em falta: {name}")
    return v


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


def _fetch_mode_from_job(job: dict) -> str:
    raw = job.get("summary_json")
    data = raw if isinstance(raw, dict) else {}
    mode = str(data.get("fetchMode") or "incremental").strip().lower()
    return "all" if mode == "all" else "incremental"


def _reset_checkpoint_for_full_fetch(nfse_root: Path, cnpj: str) -> None:
    cp = nfse_root / "data" / cnpj / "checkpoint.json"
    cp.parent.mkdir(parents=True, exist_ok=True)
    cp.write_text(json.dumps({"last_nsu": "0"}, ensure_ascii=False), encoding="utf-8")


def process_one_job(job: dict, dsn: str, portal_url: str, secret: str, nfse: Path) -> None:
    oid = str(job["organization_id"])
    cid = str(job["company_id"])
    jid = str(job["id"])
    with psycopg.connect(dsn) as conn:
        co = load_company(conn, cid)
        cert_ref = load_active_company_certificate_ref(conn, oid, cid)
    cnpj = str(co["cnpj_digits"])
    nome = str(co["trade_name"] or cnpj)
    run_started_epoch = time.time()
    fetch_mode = _fetch_mode_from_job(job)

    write_clients_json(nfse, cnpj, nome)
    if fetch_mode == "all":
        _reset_checkpoint_for_full_fetch(nfse, cnpj)
        print(
            f"[nfse-portal-bridge] Modo fetch=all: checkpoint reiniciado para {cnpj}.",
            flush=True,
        )
    cert_sync = materialize_company_certificate_from_vault(
        organization_id=oid,
        company_id=cid,
        cnpj_digits=cnpj,
        nfse_root=nfse,
        vault_ref=cert_ref,
    )
    if cert_sync.get("materialized"):
        print(
            f"[nfse-portal-bridge] Certificado materializado do cofre para {cnpj}.",
            flush=True,
        )
    cleanup_enabled = os.environ.get("NFSE_CLEAN_BEFORE_RUN", "").strip() == "1"
    if cleanup_enabled:
        cleanup = clear_company_data_directory(nfse, cnpj)
        if cleanup["failed"] > 0:
            print(
                f"[nfse-portal-bridge] Aviso: {cleanup['failed']} ficheiro(s) antigos não puderam ser removidos para {cnpj}.",
                flush=True,
            )
    skip_nfse_dist = os.environ.get("NFSE_BRIDGE_SKIP_NFSE_DIST", "").strip() == "1"
    if skip_nfse_dist:
        print(
            "[nfse-portal-bridge] NFSE_BRIDGE_SKIP_NFSE_DIST=1 — a saltar run_download_workflow (smoke).",
            flush=True,
        )
    else:
        run_download_workflow_once(nfse)

    counts = sync_data_directory(
        base_url=portal_url,
        secret=secret,
        organization_id=oid,
        company_id=cid,
        job_id=jid,
        cnpj=cnpj,
        nfse_root=nfse,
        min_xml_mtime_epoch=run_started_epoch,
    )
    mirror_summary: dict = {
        "mirrorWritten": 0,
        "mirrorFailed": 0,
        "mirrorHadFailures": False,
    }
    try:
        with psycopg.connect(dsn) as mconn:
            ctx = load_org_mirror_context(mconn, oid, cid)
        disabled = os.environ.get("NFSE_LOCAL_MIRROR_DISABLED", "").strip() == "1"
        mirror_summary = mirror_data_directory_to_local(
            root=ctx.get("root"),
            cnpj_digits=str(ctx.get("cnpj_digits") or cnpj),
            system_code=str(ctx.get("system_code") or ""),
            nfse_root=nfse,
            disabled_env=disabled,
        )
    except Exception as e:  # noqa: BLE001
        print(f"[nfse-portal-bridge] espelho local ignorado após erro: {e!s}", flush=True)
        err_hint = f"mirror_context:{type(e).__name__}"
        mirror_summary = {
            "mirrorWritten": 0,
            "mirrorFailed": 0,
            "mirrorHadFailures": True,
            "mirrorErrorsSample": [f"{err_hint}:{e!s}"[:200]],
        }

    artifacts_total = counts["xml"] + counts["pdf"]
    if artifacts_total <= 0 and not skip_nfse_dist and not bool(cert_sync.get("materialized")):
        raise NoCompanyArtifactsError(
            "Nenhum XML/PDF da empresa foi encontrado após execução do job e não houve "
            "materialização de certificado a partir do cofre. O job foi marcado como failed."
        )

    patch_job(
        base_url=portal_url,
        secret=secret,
        job_id=jid,
        organization_id=oid,
        status="completed",
        summary={
            "phase": "completed",
            "engine": "NFSE_dist",
            "fetchMode": fetch_mode,
            "artifactsXml": counts["xml"],
            "artifactsPdf": counts["pdf"],
            "skipped": counts["skipped"],
            "syntheticAccessKeys": counts.get("syntheticKey", 0),
            "noNewArtifacts": artifacts_total <= 0,
            "certificateMaterialized": bool(cert_sync.get("materialized")),
            "certificateMaterializedReason": str(cert_sync.get("reason") or ""),
            **mirror_summary,
        },
    )


def fail_job(portal_url: str, secret: str, oid: str, jid: str, msg: str) -> None:
    patch_job(
        base_url=portal_url,
        secret=secret,
        job_id=jid,
        organization_id=oid,
        status="failed",
        summary={"phase": "error", "message": msg[:2000]},
    )


def main() -> None:
    dsn = _require_env("DATABASE_URL")
    portal_url = (
        os.environ.get("API_INTERNAL_URL", "").strip()
        or _require_env("PORTAL_INTERNAL_URL").strip()
    ).rstrip("/")
    secret = _require_env("ADN_WORKER_HMAC_SECRET")
    nfse = _nfse_root()
    interval = int(os.environ.get("POLL_INTERVAL_SEC", "15") or "15")
    poll_once = "--once" in sys.argv

    print(f"[nfse-portal-bridge] NFSE_DIST_ROOT={nfse}", flush=True)
    print(f"[nfse-portal-bridge] INTERNAL_API_URL={portal_url}", flush=True)
    if poll_once:
        print("[nfse-portal-bridge] Modo --once (um ciclo ou um job).", flush=True)

    while True:
        try:
            with psycopg.connect(dsn) as conn:
                job = claim_next_job(conn)
            if not job:
                if poll_once:
                    print("[nfse-portal-bridge] Nenhum job na fila (queued + org ADN activa).", flush=True)
                    return
                time.sleep(interval)
                continue
            jid = str(job["id"])
            oid = str(job["organization_id"])
            print(f"[nfse-portal-bridge] Job {jid} em execução…", flush=True)
            try:
                process_one_job(job, dsn, portal_url, secret, nfse)
                print(f"[nfse-portal-bridge] Job {jid} concluído.", flush=True)
                if poll_once:
                    return
            except KeyboardInterrupt:
                # Evita job preso em "running" quando o worker é interrompido manualmente.
                try:
                    fail_job(portal_url, secret, oid, jid, "Execução interrompida manualmente (KeyboardInterrupt).")
                except Exception as e2:  # noqa: BLE001
                    print(
                        f"[nfse-portal-bridge] Falha ao marcar job interrompido como failed: {e2}",
                        file=sys.stderr,
                        flush=True,
                    )
                print("[nfse-portal-bridge] Interrompido durante processamento do job.", flush=True)
                return
            except Exception as e:  # noqa: BLE001
                tb = traceback.format_exc()
                print(tb, file=sys.stderr, flush=True)
                try:
                    fail_job(portal_url, secret, oid, jid, f"{e!s}\n{tb}")
                except Exception as e2:  # noqa: BLE001
                    print(f"[nfse-portal-bridge] Falha ao marcar job como failed: {e2}", file=sys.stderr, flush=True)
                if poll_once:
                    return
        except KeyboardInterrupt:
            print("[nfse-portal-bridge] Interrompido.", flush=True)
            return
        except Exception as e:  # noqa: BLE001
            print(f"[nfse-portal-bridge] Erro de ciclo: {e}", file=sys.stderr, flush=True)
            time.sleep(interval)


if __name__ == "__main__":
    main()

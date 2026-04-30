"""
Consome jobs ADN (`adn_sync_jobs` = queued), corre o código do NFSE_dist na mesma VM (Windows)
e envia XML/PDF de volta ao portal (rotas internas HMAC).

Variáveis de ambiente:
  DATABASE_URL          — Postgres (igual ao portal). Alternativa: ADN_WORKER_DATABASE_URL (Easypanel por vezes não injecta DATABASE_URL).
  API_INTERNAL_URL      — Ex.: http://localhost:3001 (preferido)
  PORTAL_INTERNAL_URL   — Fallback legado quando API_INTERNAL_URL não definido
  ADN_WORKER_HMAC_SECRET — Mesmo segredo que o portal (NFR20)
  NFSE_DIST_ROOT        — Opcional; default: <repo>/third_party/NFSE_dist
  NFSE_DIST_CLIENTS_LOCAL_PATH — Opcional; copia para clients.local.json antes da recolha
  POLL_INTERVAL_SEC     — Opcional; default 15
  ADN_DOWNLOAD_ENGINE   — Opcional; default nfse_dist. Valores: nfse_dist | playwright_extension
  ADN_PLAYWRIGHT_MOTOR_NODE — Opcional; default node.exe (Windows) / node
  ADN_PLAYWRIGHT_MOTOR_SCRIPT — Opcional; default <repo>/workers/adn-playwright-motor/cli.js
  ADN_BROWSER_PHASE_TIMEOUT_SEC — Opcional; timeout do subprocesso motor B (default 3600)
  ADN_BROWSER_LOCK_PATH — Opcional; ficheiro de lock entre processos do motor B (default <repo>/.adn_browser_worker.lock)
  ADN_CHROME_USER_DATA_DIR — Perfil Chrome (modo browser real no motor Node; ver workers/adn-playwright-motor/README.md)
  ADN_BROWSER_EXTENSION_DIR — Pasta da extensão descompactada (modo browser real)
  ADN_NFSE_LOGIN_URL — Opcional; URL do Emissor Nacional (motor Node)
  ADN_PLAYWRIGHT_CHANNEL — Opcional; ex. chrome (Chrome instalado; certificado Windows)
  ADN_PLAYWRIGHT_USE_BROWSER — Opcional; 1 força modo browser; senão activa se perfil+extensão definidos
  ADN_PLAYWRIGHT_FATIA_ZERO — Opcional; 1 força só XML de teste (sem Playwright)
  NFSE_BRIDGE_SKIP_NFSE_DIST — Se "1", não corre descarga NFSE_dist nem motor Playwright (smoke).
      Recomendação (FR-ADN-B-07): skip ambos os motores de descarga; ver runbook adn-motor-cenario-b.
  NFSE_LOCAL_MIRROR_ENABLED — Se "1", copia XML/PDF para organizations.local_download_root quando definida (opt-in).
  NFSE_LOCAL_MIRROR_DISABLED — Se "1", não copia mesmo com ENABLED (prevalece; LM-02A).
  Argumentos: --once — processa no máximo um job (ou sai se a fila estiver vazia).

Runbook motor cenário B: docs/runbooks/adn-motor-cenario-b.md
"""

from __future__ import annotations

import os
import sys
import time
import traceback
import json
from pathlib import Path

# Carrega `.env` na raiz do repo (override=False: variáveis já definidas no shell ganham).
try:
    from dotenv import load_dotenv

    _REPO_ROOT = Path(__file__).resolve().parent.parent.parent
    load_dotenv(_REPO_ROOT / ".env", override=False, encoding="utf-8-sig")
except ImportError:
    pass

import psycopg
from psycopg.rows import dict_row

from cert_materialization import (
    load_active_company_certificate_ref,
    materialize_company_certificate_from_vault,
)
from nfse_runner import clear_company_data_directory, run_download_workflow_once, write_clients_json
from local_mirror_policy import local_mirror_writes_enabled
from mirror_local import load_org_mirror_context, mirror_data_directory_to_local
from portal_artifacts import patch_job, sync_data_directory
from job_logging import job_log
from job_summary import summary_as_dict
from remirror_job import process_remirror_job
from download_engine import (
    MotorExecutionError,
    get_download_engine,
    infer_failure_category_from_exception,
    playwright_browser_file_lock,
    run_playwright_motor_subprocess,
    sanitize_user_safe_detail,
    VALID_FAILURE_CATEGORIES,
)


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


def _resolve_database_url() -> str:
    """
    DSN Postgres. Ordem: DATABASE_URL, ADN_WORKER_DATABASE_URL, POSTGRES_URL, POSTGRESQL_URL.
    Alguns painéis (ex.: Easypanel) não passam DATABASE_URL ao contentor; use ADN_WORKER_DATABASE_URL com o mesmo valor.
    """
    for key in ("DATABASE_URL", "ADN_WORKER_DATABASE_URL", "POSTGRES_URL", "POSTGRESQL_URL"):
        v = os.environ.get(key, "").strip()
        if v:
            return v
    raise RuntimeError(
        "Variável obrigatória em falta: defina DATABASE_URL ou ADN_WORKER_DATABASE_URL "
        "(connection string postgresql://… igual ao portal). "
        "Em alguns hosts DATABASE_URL é reservado ou ignorado — duplique a URI em ADN_WORKER_DATABASE_URL."
    )


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
    data = summary_as_dict(job.get("summary_json"))
    mode = str(data.get("fetchMode") or "incremental").strip().lower()
    return "all" if mode == "all" else "incremental"


def _count_xml_for_upload(nfse_root: Path, cnpj: str, min_mtime: float | None) -> int:
    data_dir = nfse_root / "data" / cnpj
    if not data_dir.is_dir():
        return 0
    n = 0
    for p in data_dir.rglob("*.xml"):
        if min_mtime is not None:
            try:
                if p.stat().st_mtime < min_mtime:
                    continue
            except OSError:
                continue
        n += 1
    return n


def _reset_checkpoint_for_full_fetch(nfse_root: Path, cnpj: str) -> None:
    cp = nfse_root / "data" / cnpj / "checkpoint.json"
    cp.parent.mkdir(parents=True, exist_ok=True)
    cp.write_text(json.dumps({"last_nsu": "0"}, ensure_ascii=False), encoding="utf-8")


def process_one_job(job: dict, dsn: str, portal_url: str, secret: str, nfse: Path) -> None:
    oid = str(job["organization_id"])
    cid = str(job["company_id"])
    jid = str(job["id"])
    job_summary = summary_as_dict(job.get("summary_json"))
    if job_summary.get("remirrorFromJobId"):
        src = str(job_summary.get("remirrorFromJobId") or "").strip()
        job_log(jid, "remirror", f"org={oid} company={cid} job_origem={src}")
        process_remirror_job(job, dsn, portal_url, secret)
        job_log(jid, "remirror", "fluxo remirror terminado (ver PATCH no portal).")
        print(f"[nfse-portal-bridge] Job {jid} (remirror) concluído.", flush=True)
        return
    job_log(jid, "início", f"org={oid} company={cid} API={portal_url}")
    with psycopg.connect(dsn) as conn:
        co = load_company(conn, cid)
        cert_ref = load_active_company_certificate_ref(conn, oid, cid)
    cnpj = str(co["cnpj_digits"])
    nome = str(co["trade_name"] or cnpj)
    run_started_epoch = time.time()
    fetch_mode = _fetch_mode_from_job(job)
    job_log(jid, "contexto", f"CNPJ={cnpj} fetchMode={fetch_mode}")

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
    engine = get_download_engine()
    skip_nfse_dist = os.environ.get("NFSE_BRIDGE_SKIP_NFSE_DIST", "").strip() == "1"

    if engine not in ("nfse_dist", "playwright_extension"):
        raise RuntimeError(
            f"ADN_DOWNLOAD_ENGINE inválido: {engine!r} (use nfse_dist ou playwright_extension)."
        )

    if skip_nfse_dist:
        print(
            "[nfse-portal-bridge] NFSE_BRIDGE_SKIP_NFSE_DIST=1 — a saltar ambos os motores de descarga (smoke).",
            flush=True,
        )
        job_log(jid, "descarga", "NFSE_dist + motor B saltados (smoke)")
    elif engine == "nfse_dist":
        job_log(
            jid,
            "NFSE_dist",
            "a iniciar recolha no Ambiente Nacional (demora comum: vários minutos a horas; não interrompa).",
        )
        run_download_workflow_once(nfse)
        job_log(jid, "NFSE_dist", "recolha local terminou; a preparar upload para o portal.")
    else:
        # playwright_extension — subprocesso Node; lock em disco serializa vários poll_jobs na mesma VM.
        data_out = nfse / "data" / cnpj
        data_out.mkdir(parents=True, exist_ok=True)
        with playwright_browser_file_lock(_repo_root()):
            job_log(jid, "motor_B", "a iniciar subprocesso Playwright (motor cenário B).")
            code, err_tail, cat = run_playwright_motor_subprocess(
                repo_root=_repo_root(),
                output_dir=data_out,
                cnpj=cnpj,
                job_id=jid,
            )
            if code != 0:
                job_log(jid, "motor_B", f"falha exit={code} category={cat}")
                raise MotorExecutionError(
                    f"Motor Playwright terminou com código {code}.",
                    category=cat,
                    stderr_tail=err_tail,
                )
            job_log(jid, "motor_B", "subprocesso terminou com sucesso; a preparar upload para o portal.")

    n_xml_cand = _count_xml_for_upload(nfse, cnpj, run_started_epoch)
    job_log(
        jid,
        "upload",
        f"{n_xml_cand} XML elegiveis (mtime >= inicio do job) em data/{cnpj}/ -> POST .../adn/uploads/prepare",
    )
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
    job_log(
        jid,
        "upload",
        f"concluído: xml={counts['xml']} pdf={counts['pdf']} skipped={counts['skipped']} syntheticKey={counts.get('syntheticKey', 0)}",
    )
    mirror_summary: dict = {
        "mirrorWritten": 0,
        "mirrorFailed": 0,
        "mirrorHadFailures": False,
    }
    try:
        with psycopg.connect(dsn) as mconn:
            ctx = load_org_mirror_context(mconn, oid, cid)
        job_log(jid, "espelho_local", "espelho em disco só com NFSE_LOCAL_MIRROR_ENABLED=1 (senão só portal).")
        mirror_summary = mirror_data_directory_to_local(
            root=ctx.get("root"),
            cnpj_digits=str(ctx.get("cnpj_digits") or cnpj),
            system_code=str(ctx.get("system_code") or ""),
            trade_name=str(ctx.get("trade_name") or ""),
            nfse_root=nfse,
            disabled_env=not local_mirror_writes_enabled(),
        )
    except Exception as e:  # noqa: BLE001
        print(f"[nfse-portal-bridge] espelho local ignorado após erro: {e!s}", flush=True)
        err_hint = f"mirror_context:{type(e).__name__}"
        mirror_summary = {
            "mirrorWritten": 0,
            "mirrorFailed": 0,
            "mirrorHadFailures": True,
            "mirrorErrorsSample": [f"{err_hint}:{e!s}"[:200]],
            "mirrorOperationalHint": (
                f"Erro antes do espelho: {type(e).__name__}: {e!s}"[:500]
            ),
            "mirrorSkipReason": "mirror_context_error",
        }
    job_log(
        jid,
        "espelho_local",
        f"resumo written={mirror_summary.get('mirrorWritten', 0)} failed={mirror_summary.get('mirrorFailed', 0)} "
        f"hadFailures={mirror_summary.get('mirrorHadFailures')}",
    )

    artifacts_total = counts["xml"] + counts["pdf"]
    if artifacts_total <= 0 and not skip_nfse_dist and not bool(cert_sync.get("materialized")):
        raise NoCompanyArtifactsError(
            "Nenhum XML/PDF da empresa foi encontrado após execução do job e não houve "
            "materialização de certificado a partir do cofre. O job foi marcado como failed."
        )

    download_engine_label = "nfse_dist" if engine == "nfse_dist" else "playwright_extension"
    engine_legacy = "NFSE_dist" if engine == "nfse_dist" else "playwright_extension"

    job_log(jid, "portal", "PATCH job=completed (a aplicar resumo no portal…)")
    patch_job(
        base_url=portal_url,
        secret=secret,
        job_id=jid,
        organization_id=oid,
        status="completed",
        summary={
            "phase": "completed",
            "engine": engine_legacy,
            "downloadEngine": download_engine_label,
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
    job_log(jid, "portal", "PATCH job=completed aplicado no portal.")


def fail_job(
    portal_url: str,
    secret: str,
    oid: str,
    jid: str,
    msg: str,
    *,
    failure_category: str | None = None,
    user_safe_detail: str | None = None,
) -> None:
    job_log(jid, "portal", "PATCH job=failed (a aplicar no portal…)")
    safe_msg = sanitize_user_safe_detail(msg, max_len=2000)
    summary: dict = {"phase": "error", "message": safe_msg}
    cat = (failure_category or "").strip().lower()
    if cat in VALID_FAILURE_CATEGORIES:
        summary["failureCategory"] = cat
    if user_safe_detail:
        summary["userSafeDetail"] = sanitize_user_safe_detail(user_safe_detail, max_len=500)
    patch_job(
        base_url=portal_url,
        secret=secret,
        job_id=jid,
        organization_id=oid,
        status="failed",
        summary=summary,
    )
    job_log(jid, "portal", "PATCH job=failed gravado no portal (pode actualizar a UI).")


def main() -> None:
    dsn = _resolve_database_url()
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
            job_log(jid, "fila", "job reservado (status=running na base); a processar.")
            try:
                process_one_job(job, dsn, portal_url, secret, nfse)
                job_log(jid, "fim", "process_one_job terminou sem excepção.")
                print(f"[nfse-portal-bridge] Job {jid} concluído.", flush=True)
                if poll_once:
                    return
            except MotorExecutionError as me:
                try:
                    fail_job(
                        portal_url,
                        secret,
                        oid,
                        jid,
                        str(me),
                        failure_category=me.category,
                        user_safe_detail=me.stderr_tail[:500] if me.stderr_tail else None,
                    )
                except Exception as e2:  # noqa: BLE001
                    print(f"[nfse-portal-bridge] Falha ao marcar job como failed: {e2}", file=sys.stderr, flush=True)
                if poll_once:
                    return
            except KeyboardInterrupt:
                # Evita job preso em "running" quando o worker é interrompido manualmente.
                try:
                    fail_job(
                        portal_url,
                        secret,
                        oid,
                        jid,
                        "Execução interrompida manualmente.",
                        failure_category="unknown",
                    )
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
                job_log(jid, "ERRO", f"{type(e).__name__}: {e!s}"[:500])
                print(tb, file=sys.stderr, flush=True)
                cat = infer_failure_category_from_exception(e)
                if isinstance(e, NoCompanyArtifactsError):
                    cat = "unknown"
                try:
                    fail_job(
                        portal_url,
                        secret,
                        oid,
                        jid,
                        str(e),
                        failure_category=cat,
                    )
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

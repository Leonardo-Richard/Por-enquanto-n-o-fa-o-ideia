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
  ADN_WORKER_INSECURE_SSL — Se "1", desactiva verificação TLS nos pedidos HTTPS do worker (só diagnóstico).
  ADN_CLEAN_STALE_ON_WORKER_START — Se "0", não recupera jobs «running» órfãos ao arrancar. Por omissão "1":
      jobs em running com started_at há mais de ADN_STALE_JOB_HOURS são REPOSTOS para queued (reclaim) para nova tentativa.
      Apenas após esgotar ADN_STALE_MAX_RECLAIMS é que ficam definitivamente em failed.
  ADN_STALE_JOB_HOURS — Idade mínima (horas) para considerar running órfão; default 24 (mínimo 1).
  ADN_STALE_RECHECK_SEC — Período (segundos) entre verificações de running órfãos durante o ciclo (default 1800 = 30 min). 0 desactiva.
  ADN_STALE_MAX_RECLAIMS — Máximo de reclaims antes de marcar failed definitivamente (default 3, mínimo 1).
  Argumentos: --once — processa no máximo um job (ou sai se a fila estiver vazia).

Runbook motor cenário B: docs/runbooks/adn-motor-cenario-b.md
"""

from __future__ import annotations

import os
import sys
import time
import traceback
import json
from datetime import datetime, timedelta, timezone
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


def _reclaim_stale_running_jobs_if_configured(
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
        win_purge = cert_sync.get("windowsStorePurge") or {}
        purged_n = int(win_purge.get("purged") or 0)
        if purged_n > 0:
            print(
                f"[nfse-portal-bridge] Loja Pessoal do Windows: {purged_n} certificado(s) "
                f"ICP-Brasil de outras empresas removidos (deixa apenas o do CNPJ activo {cnpj}). "
                f"Detalhe: {win_purge.get('details') or ''}",
                flush=True,
            )
        elif win_purge.get("reason") not in (None, "not_windows", "disabled_by_env", "ok"):
            print(
                f"[nfse-portal-bridge] Aviso: limpeza de certificados de outras empresas falhou "
                f"({win_purge.get('reason')}); o auto-confirm do diálogo pode escolher o cert errado.",
                flush=True,
            )
        win_import = cert_sync.get("windowsStoreImport") or {}
        if win_import.get("imported"):
            print(
                f"[nfse-portal-bridge] Certificado importado para a loja Pessoal do Windows (CurrentUser\\My) — {cnpj}.",
                flush=True,
            )
        elif win_import.get("reason") not in (None, "not_windows", "disabled_by_env"):
            print(
                f"[nfse-portal-bridge] Aviso: importação automática para a loja do Windows falhou ({win_import.get('reason')}). "
                "O motor cenário B precisa do certificado na loja; se o Chrome devolver 403, instale o .pfx manualmente.",
                flush=True,
            )
        cas = cert_sync.get("chromeAutoSelect") or {}
        if cas.get("set"):
            print(
                f"[nfse-portal-bridge] Chrome AutoSelect activo para {cas.get('pattern')} -> "
                f"CN={cas.get('subjectCn')!s} (sem pop-up de certificado).",
                flush=True,
            )
        elif cas.get("reason") not in (None, "not_windows", "disabled_by_env", "not_attempted"):
            print(
                f"[nfse-portal-bridge] Aviso: AutoSelect do Chrome não pôde ser configurado "
                f"({cas.get('reason')}); pode aparecer pop-up de selecção de certificado.",
                flush=True,
            )
        cef = cert_sync.get("chromeExtensionForceInstall") or {}
        if cef.get("set"):
            print(
                f"[nfse-portal-bridge] Chrome force-install activo para extensão "
                f"{cef.get('extensionId')} (Web Store). O Chrome vai instalar/actualizar "
                "automaticamente a extensão «Baixar NFSe» ao arrancar o perfil.",
                flush=True,
            )
        elif cef.get("reason") not in (None, "not_windows", "disabled_by_env"):
            print(
                f"[nfse-portal-bridge] Aviso: força-instalação da extensão NÃO pôde ser configurada "
                f"({cef.get('reason')}); o Chrome 137+ não carrega extensões via --load-extension.",
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
            # Em Chromium for Testing as policies AutoSelectCertificateForUrls são
            # ignoradas; arrancamos um watcher Win32 que detecta o diálogo nativo
            # «Selecione um certificado» e envia ENTER para o aceitar (o cert
            # default já foi importado para a loja Pessoal).
            from cert_dialog_clicker import start_watcher as _start_cert_dialog_watcher

            _stop_cert_watcher = _start_cert_dialog_watcher()
            try:
                code, err_tail, cat = run_playwright_motor_subprocess(
                    repo_root=_repo_root(),
                    output_dir=data_out,
                    cnpj=cnpj,
                    job_id=jid,
                )
            finally:
                _stop_cert_watcher()
            if code != 0:
                job_log(jid, "motor_B", f"falha exit={code} category={cat}")
                # Imprime no console do worker as últimas linhas do stderr/stdout do motor
                # (sem tocar no payload PATCH para o portal — `err_tail` continua truncado lá).
                tail_for_console = (err_tail or "").strip()
                if tail_for_console:
                    print(
                        "[nfse-portal-bridge] motor_B stderr/stdout (últimas linhas):",
                        flush=True,
                    )
                    for line in tail_for_console.splitlines()[-40:]:
                        print(f"    {line}", flush=True)
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

    completed_summary = {
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
    }

    job_log(jid, "portal", "PATCH job=completed (a aplicar resumo no portal…)")
    try:
        patch_job(
            base_url=portal_url,
            secret=secret,
            job_id=jid,
            organization_id=oid,
            status="completed",
            summary=completed_summary,
        )
        job_log(jid, "portal", "PATCH job=completed aplicado no portal.")
    except Exception as e_patch:  # noqa: BLE001
        # **Importante**: o motor SUCEDEU (artefactos subidos, espelho gravado).
        # Não voltamos a propagar a excepção, senão o catch genérico do main loop
        # marcaria o job como `failed` indevidamente. Em vez disso, aplicamos o
        # estado correcto (`completed`) directamente na BD e logamos.
        print(
            f"[nfse-portal-bridge] PATCH job=completed falhou ({e_patch}); "
            "motor já tinha SUCEDIDO — a aplicar fallback directo na BD para completed.",
            file=sys.stderr,
            flush=True,
        )
        applied = _force_complete_job_in_db(
            dsn,
            jid,
            completed_summary,
            reason=f"patch_completed_failed:{type(e_patch).__name__}",
        )
        if applied:
            job_log(
                jid,
                "portal",
                "PATCH job=completed falhou no portal; status gravado como completed via fallback BD.",
            )
            print(
                f"[nfse-portal-bridge] Job {jid} marcado como completed via fallback BD "
                f"(artefactos: xml={counts['xml']}, pdf={counts['pdf']}).",
                flush=True,
            )
        else:
            # Se nem o fallback BD funcionar, propagar para o catch genérico (job ficaria `failed`).
            raise


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


def _force_fail_job_in_db(dsn: str, jid: str, message: str, *, reason: str = "patch_failed") -> bool:
    """
    Fallback de último recurso: se o PATCH ao portal falhar (rede, 503, etc.) e o job ficar
    em «running», marca-o como failed directamente na BD para não ficar preso.
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


def _force_complete_job_in_db(
    dsn: str,
    jid: str,
    summary: dict,
    *,
    reason: str = "patch_completed_failed",
) -> bool:
    """
    Fallback de recuperação quando o motor TERMINOU COM SUCESSO (artefactos subidos,
    espelho gravado) mas o PATCH «completed» falhou (ex.: 500/503 transitórios do portal).

    Marca directamente na BD `status='completed'` com o resumo já calculado, evitando
    perder a corrida do motor. Se não fosse este fallback, o catch genérico do main loop
    chamaria `_try_fail_job` e o utilizador veria FALHA mesmo com as notas baixadas.
    """
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


def _try_fail_job(
    dsn: str,
    portal_url: str,
    secret: str,
    oid: str,
    jid: str,
    msg: str,
    *,
    failure_category: str | None = None,
    user_safe_detail: str | None = None,
) -> None:
    """Tenta `PATCH` no portal; se falhar, garante que o job sai de «running» via SQL directo."""
    try:
        fail_job(
            portal_url,
            secret,
            oid,
            jid,
            msg,
            failure_category=failure_category,
            user_safe_detail=user_safe_detail,
        )
        return
    except Exception as e2:  # noqa: BLE001
        print(
            f"[nfse-portal-bridge] PATCH job=failed falhou ({e2}); a aplicar fallback directo na BD…",
            file=sys.stderr,
            flush=True,
        )
    if _force_fail_job_in_db(dsn, jid, msg, reason="patch_failed"):
        print(
            f"[nfse-portal-bridge] Job {jid} marcado como failed via fallback BD.",
            flush=True,
        )


def main() -> None:
    # Marca de versão visível nos logs — se não aparecer no Easypanel, a imagem ainda é antiga (rebuild sem o último Git).
    print("[nfse-portal-bridge] worker_build=dsn-resolver-v2", flush=True)
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

    with psycopg.connect(dsn) as _stale_conn:
        n_requeued, n_failed_stale, stale_hours = _reclaim_stale_running_jobs_if_configured(_stale_conn)
    if n_requeued > 0 or n_failed_stale > 0:
        print(
            f"[nfse-portal-bridge] Reclaim de running órfãos (>{stale_hours}h): "
            f"requeued={n_requeued} failed_após_máximo={n_failed_stale}. "
            "(ADN_STALE_JOB_HOURS, ADN_STALE_MAX_RECLAIMS)",
            flush=True,
        )

    try:
        recheck_sec = int(os.environ.get("ADN_STALE_RECHECK_SEC", "1800") or "1800")
    except ValueError:
        recheck_sec = 1800
    last_stale_check = time.time()

    while True:
        try:
            if recheck_sec > 0 and (time.time() - last_stale_check) >= recheck_sec:
                last_stale_check = time.time()
                try:
                    with psycopg.connect(dsn) as _rc:
                        n2_rq, n2_fl, h2 = _reclaim_stale_running_jobs_if_configured(_rc)
                    if n2_rq > 0 or n2_fl > 0:
                        print(
                            f"[nfse-portal-bridge] Verificação periódica (>{h2}h): "
                            f"requeued={n2_rq} failed_após_máximo={n2_fl}.",
                            flush=True,
                        )
                except Exception as e_rc:  # noqa: BLE001
                    print(
                        f"[nfse-portal-bridge] Aviso: verificação periódica de órfãos falhou: {e_rc}",
                        file=sys.stderr,
                        flush=True,
                    )

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
                _try_fail_job(
                    dsn,
                    portal_url,
                    secret,
                    oid,
                    jid,
                    str(me),
                    failure_category=me.category,
                    user_safe_detail=me.stderr_tail[:500] if me.stderr_tail else None,
                )
                if poll_once:
                    return
            except KeyboardInterrupt:
                # Evita job preso em "running" quando o worker é interrompido manualmente.
                _try_fail_job(
                    dsn,
                    portal_url,
                    secret,
                    oid,
                    jid,
                    "Execução interrompida manualmente.",
                    failure_category="unknown",
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
                _try_fail_job(
                    dsn,
                    portal_url,
                    secret,
                    oid,
                    jid,
                    str(e),
                    failure_category=cat,
                )
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

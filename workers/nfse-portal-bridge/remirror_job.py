"""
Regrava na pasta raiz (local_download_root) os artefactos já ingeridos no Storage
a partir de um job ADN concluído (remirror).
"""

from __future__ import annotations

import os
from pathlib import Path
from typing import Any

import psycopg
from psycopg.rows import dict_row

from cert_materialization import _download_supabase_object
from job_logging import job_log
from job_summary import summary_as_dict
from local_mirror_policy import local_mirror_writes_enabled
from mirror_local import dominio_mirror_folder_name, load_org_mirror_context
from portal_artifacts import patch_job


def fail_job(portal_url: str, secret: str, oid: str, jid: str, msg: str) -> None:
    job_log(jid, "remirror/portal", "PATCH job=failed (a aplicar…)")
    patch_job(
        base_url=portal_url,
        secret=secret,
        job_id=jid,
        organization_id=oid,
        status="failed",
        summary={"phase": "error", "message": msg[:2000]},
    )
    job_log(jid, "remirror/portal", "PATCH job=failed aplicado.")


def process_remirror_job(job: dict, dsn: str, portal_url: str, secret: str) -> None:
    jid = str(job["id"])
    oid = str(job["organization_id"])
    cid = str(job["company_id"])
    summary = summary_as_dict(job.get("summary_json"))
    source_id = str(summary.get("remirrorFromJobId") or "").strip()
    if not source_id:
        fail_job(portal_url, secret, oid, jid, "Job de espelho sem remirrorFromJobId no resumo.")
        return

    if not local_mirror_writes_enabled():
        fail_job(
            portal_url,
            secret,
            oid,
            jid,
            "Espelho em disco DESLIGADO neste worker (NFSE_LOCAL_MIRROR_DISABLED=1 ou NFSE_LOCAL_MIRROR_ENABLED=0). "
            "Remova esses overrides para regravar em pasta raiz. Os ficheiros já estão no portal para descarregar pelo browser.",
        )
        return

    with psycopg.connect(dsn) as conn:
        ctx = load_org_mirror_context(conn, oid, cid)
        with conn.cursor(row_factory=dict_row) as cur:
            cur.execute(
                """
                SELECT kind, access_key, storage_bucket, storage_object_key
                FROM adn_artifacts
                WHERE organization_id = %s AND company_id = %s AND adn_sync_job_id = %s
                ORDER BY access_key, kind
                """,
                (oid, cid, source_id),
            )
            rows: list[dict[str, Any]] = list(cur.fetchall() or [])

    job_log(jid, "remirror", f"artefactos na base para job_origem={source_id}: {len(rows)} linha(s).")
    root = (ctx.get("root") or "").strip()
    if not root:
        fail_job(
            portal_url,
            secret,
            oid,
            jid,
            "Sem pasta raiz configurada na organização (local_download_root).",
        )
        return

    cnpj = str(ctx.get("cnpj_digits") or "")
    folder = dominio_mirror_folder_name(
        system_code=str(ctx.get("system_code") or ""),
        trade_name=str(ctx.get("trade_name") or ""),
        cnpj_digits=cnpj,
    )
    dest_root = Path(root) / folder

    if not rows:
        fail_job(portal_url, secret, oid, jid, "Nenhum artefacto encontrado para o job de origem.")
        return

    job_log(jid, "remirror", f"a gravar até {len(rows)} ficheiro(s) em disco local…")
    written = 0
    failed = 0
    errors_sample: list[str] = []

    for r in rows:
        kind = str(r.get("kind") or "").lower()
        if kind not in ("xml", "pdf"):
            continue
        access_key = str(r.get("access_key") or "").strip()
        bucket = str(r.get("storage_bucket") or "").strip()
        obj_key = str(r.get("storage_object_key") or "").strip()
        if not access_key or not bucket or not obj_key:
            failed += 1
            continue
        try:
            data = _download_supabase_object(bucket, obj_key)
            dest_root.mkdir(parents=True, exist_ok=True)
            out_path = dest_root / f"{access_key}.{kind}"
            out_path.write_bytes(data)
            written += 1
        except Exception as e:  # noqa: BLE001
            failed += 1
            if len(errors_sample) < 3:
                errors_sample.append(f"{access_key}.{kind}:{e!s}"[:200])

    out_summary: dict[str, Any] = {
        "phase": "completed" if failed == 0 else "partial",
        "engine": "remirror_from_storage",
        "remirrorFromJobId": source_id,
        "mirrorWritten": written,
        "mirrorFailed": failed,
        "mirrorHadFailures": failed > 0,
        "mirrorDestinationPath": str(dest_root),
        "mirrorOperationalHint": (
            f"Regravados {written} ficheiro(s) a partir do Storage em {dest_root}."
            if written > 0
            else f"Nada gravado em {dest_root}; falhas={failed}. Verifique permissões da pasta e credenciais Supabase no worker."
        )[:500],
    }
    if errors_sample:
        out_summary["mirrorErrorsSample"] = errors_sample

    st = "completed" if failed == 0 else "partial"
    job_log(jid, "remirror/portal", f"PATCH job={st} (written={written} failed={failed})…")
    patch_job(
        base_url=portal_url,
        secret=secret,
        job_id=jid,
        organization_id=oid,
        status=st,
        summary=out_summary,
    )
    job_log(jid, "remirror/portal", f"PATCH job={st} aplicado no portal.")

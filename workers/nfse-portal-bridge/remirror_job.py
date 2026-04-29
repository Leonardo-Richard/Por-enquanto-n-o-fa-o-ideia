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
from job_summary import summary_as_dict
from mirror_local import load_org_mirror_context, sanitize_system_code
from portal_artifacts import patch_job


def fail_job(portal_url: str, secret: str, oid: str, jid: str, msg: str) -> None:
    patch_job(
        base_url=portal_url,
        secret=secret,
        job_id=jid,
        organization_id=oid,
        status="failed",
        summary={"phase": "error", "message": msg[:2000]},
    )


def process_remirror_job(job: dict, dsn: str, portal_url: str, secret: str) -> None:
    jid = str(job["id"])
    oid = str(job["organization_id"])
    cid = str(job["company_id"])
    summary = summary_as_dict(job.get("summary_json"))
    source_id = str(summary.get("remirrorFromJobId") or "").strip()
    if not source_id:
        fail_job(portal_url, secret, oid, jid, "Job de espelho sem remirrorFromJobId no resumo.")
        return

    disabled = os.environ.get("NFSE_LOCAL_MIRROR_DISABLED", "").strip() == "1"
    if disabled:
        fail_job(
            portal_url,
            secret,
            oid,
            jid,
            "Espelho local desactivado (NFSE_LOCAL_MIRROR_DISABLED=1).",
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
    safe_sys = sanitize_system_code(str(ctx.get("system_code") or ""))
    dest_root = Path(root) / f"{safe_sys} - {cnpj}"

    if not rows:
        fail_job(portal_url, secret, oid, jid, "Nenhum artefacto encontrado para o job de origem.")
        return

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
    }
    if errors_sample:
        out_summary["mirrorErrorsSample"] = errors_sample

    st = "completed" if failed == 0 else "partial"
    patch_job(
        base_url=portal_url,
        secret=secret,
        job_id=jid,
        organization_id=oid,
        status=st,
        summary=out_summary,
    )

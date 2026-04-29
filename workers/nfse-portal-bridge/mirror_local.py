"""
Espelha XML/PDF do NFSE_dist (pasta data/<CNPJ>/) para disco local da organização (FR61, LM-02A).

Chamado após sync_data_directory; falhas de I/O não abortam o job (D2 / FR62).
"""

from __future__ import annotations

import logging
import re
import shutil
from pathlib import Path
from typing import Any

from psycopg.rows import dict_row
from xml_chave import extract_access_key_from_xml

log = logging.getLogger(__name__)

_INVALID_SYS = re.compile(r'[<>:"|?*\\\x00-\x1f]')


def sanitize_system_code(raw: str) -> str:
    """Componente de pasta seguro (FR6 / arquitectura LM §7.1)."""
    s = _INVALID_SYS.sub("_", (raw or "").strip())
    s = re.sub(r"_+", "_", s).strip("_")
    if not s:
        return "system"
    return s[:80]


def mirror_data_directory_to_local(
    *,
    root: str | None,
    cnpj_digits: str,
    system_code: str,
    nfse_root: Path,
    disabled_env: bool,
) -> dict[str, Any]:
    """
    Retorna contagens para summaryJson: mirrorWritten, mirrorFailed, mirrorHadFailures, mirrorErrorsSample.
    """
    out: dict[str, Any] = {
        "mirrorWritten": 0,
        "mirrorFailed": 0,
        "mirrorHadFailures": False,
    }
    if disabled_env:
        log.info("[mirror_local] NFSE_LOCAL_MIRROR_DISABLED=1 — espelho ignorado.")
        return out

    r = (root or "").strip()
    if not r:
        log.info("[mirror_local] Sem local_download_root — espelho ignorado.")
        return out

    safe_sys = sanitize_system_code(system_code)
    data_dir = nfse_root / "data" / cnpj_digits
    if not data_dir.is_dir():
        log.info("[mirror_local] data_dir inexistente: %s", data_dir)
        return out

    # Requisito operacional: uma única pasta no root, sem subpastas por CNPJ/código.
    # Formato: "<codigo> - <cnpj>".
    dest_root = Path(r) / f"{safe_sys} - {cnpj_digits}"
    errors_sample: list[str] = []

    for xml_path in data_dir.rglob("*.xml"):
        try:
            xml_text = xml_path.read_text(encoding="utf-8")
        except OSError as e:
            out["mirrorFailed"] += 1
            msg = f"read_xml:{xml_path.name}:{e!s}"
            log.warning("[mirror_local] %s", msg)
            if len(errors_sample) < 3:
                errors_sample.append(msg[:200])
            continue

        chave = extract_access_key_from_xml(xml_text)
        # Fallback para XMLs sem chave de 44 dígitos (ex.: alguns layouts municipais/NSU).
        # Mantém rastreabilidade pelo nome base do ficheiro.
        doc_id = chave if chave and len(chave) == 44 else xml_path.stem
        if not doc_id:
            continue

        try:
            dest_root.mkdir(parents=True, exist_ok=True)
            dest_xml = dest_root / f"{doc_id}.xml"
            shutil.copy2(xml_path, dest_xml)
            out["mirrorWritten"] += 1
        except OSError as e:
            out["mirrorFailed"] += 1
            msg = f"copy_xml:{doc_id}:{e!s}"
            log.warning("[mirror_local] %s", msg)
            if len(errors_sample) < 3:
                errors_sample.append(msg[:200])
            continue

        pdf_path = xml_path.with_suffix(".pdf")
        if pdf_path.is_file():
            try:
                shutil.copy2(pdf_path, dest_root / f"{doc_id}.pdf")
                out["mirrorWritten"] += 1
            except OSError as e:
                out["mirrorFailed"] += 1
                msg = f"copy_pdf:{doc_id}:{e!s}"
                log.warning("[mirror_local] %s", msg)
                if len(errors_sample) < 3:
                    errors_sample.append(msg[:200])

    if out["mirrorFailed"] > 0:
        out["mirrorHadFailures"] = True
    if errors_sample:
        out["mirrorErrorsSample"] = errors_sample

    log.info(
        "[mirror_local] written=%s failed=%s root=%s",
        out["mirrorWritten"],
        out["mirrorFailed"],
        r[:3] + "…" if len(r) > 8 else r,
    )
    if out["mirrorWritten"] == 0 and out["mirrorFailed"] == 0 and r:
        print(
            f"[mirror_local] Nenhum XML/PDF copiado para {dest_root} "
            f"(pasta origem NFSE_dist: existe={data_dir.is_dir()}).",
            flush=True,
        )
    return out


def load_org_mirror_context(conn: Any, organization_id: str, company_id: str) -> dict[str, str | None]:
    """organization.local_download_root + company.system_code + cnpj_digits."""
    with conn.cursor(row_factory=dict_row) as cur:
        cur.execute(
            """
            SELECT o.local_download_root AS root, c.system_code, c.cnpj_digits
            FROM organizations o
            INNER JOIN companies c
              ON c.organization_id = o.id AND c.id = %s
            WHERE o.id = %s
            LIMIT 1;
            """,
            (company_id, organization_id),
        )
        row = cur.fetchone()
    if not row:
        raise RuntimeError("Organização/empresa não encontrada para espelho local.")
    return {
        "root": row["root"],
        "system_code": str(row["system_code"] or ""),
        "cnpj_digits": str(row["cnpj_digits"] or ""),
    }

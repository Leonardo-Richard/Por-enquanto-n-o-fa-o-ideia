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
    """Componente de pasta seguro (legado / segmento «código»)."""
    s = _INVALID_SYS.sub("_", (raw or "").strip())
    s = re.sub(r"_+", "_", s).strip("_")
    if not s:
        return "system"
    return s[:80]


def sanitize_dominio_codigo_segment(raw: str) -> str:
    """Código da empresa (ex.: Domínio Web): sem hífen interno — o único «-» separa código de apelido."""
    s = _INVALID_SYS.sub("_", (raw or "").strip())
    s = s.replace("-", "_")
    s = re.sub(r"_+", "_", s).strip("_")
    if not s:
        return "0"
    return s[:80]


def sanitize_dominio_apelido_segment(raw: str) -> str:
    """Apelido / nome fantasia: espaços internos permitidos (ex.: «EXEMPLO SP»); sem caracteres inválidos no Windows."""
    s = _INVALID_SYS.sub("_", (raw or "").strip())
    s = s.replace("-", "_")
    s = re.sub(r"\s+", " ", s).strip()
    s = s.rstrip(". ")
    if not s:
        return "EMPRESA"
    return s[:120]


def dominio_mirror_folder_name(*, system_code: str, trade_name: str, cnpj_digits: str) -> str:
    """
    Padrão alinhado à Central Domínio (rotinas automáticas): «Código-Apelido», sem espaços em volta do traço.
    O utilizador deve alinhar system_code ao código da empresa na Domínio e trade_name ao apelido.
    """
    codigo = sanitize_dominio_codigo_segment(system_code)
    apelido_raw = (trade_name or "").strip()
    apelido = sanitize_dominio_apelido_segment(apelido_raw) if apelido_raw else sanitize_dominio_apelido_segment(cnpj_digits)
    return f"{codigo}-{apelido}"


def mirror_data_directory_to_local(
    *,
    root: str | None,
    cnpj_digits: str,
    system_code: str,
    trade_name: str,
    nfse_root: Path,
    disabled_env: bool,
) -> dict[str, Any]:
    """
    Retorna contagens para summaryJson: mirrorWritten, mirrorFailed, mirrorHadFailures,
    mirrorErrorsSample, mirrorDestinationPath, mirrorSourceXmlCount, mirrorOperationalHint.
    """
    out: dict[str, Any] = {
        "mirrorWritten": 0,
        "mirrorFailed": 0,
        "mirrorHadFailures": False,
    }
    if disabled_env:
        log.info("[mirror_local] NFSE_LOCAL_MIRROR_DISABLED=1 — espelho ignorado.")
        out["mirrorOperationalHint"] = (
            "Espelho desactivado: defina NFSE_LOCAL_MIRROR_DISABLED diferente de «1» no ambiente do worker."
        )
        out["mirrorSkipReason"] = "disabled_env"
        return out

    r = (root or "").strip()
    if not r:
        log.info("[mirror_local] Sem local_download_root — espelho ignorado.")
        out["mirrorOperationalHint"] = (
            "Sem pasta raiz na organização (local_download_root). Configure em Configurações do portal."
        )
        out["mirrorSkipReason"] = "no_local_download_root"
        return out

    folder = dominio_mirror_folder_name(
        system_code=system_code, trade_name=trade_name, cnpj_digits=cnpj_digits
    )
    data_dir = nfse_root / "data" / cnpj_digits
    # Uma pasta no root: «Código-Apelido» (Domínio Web / rotinas automáticas), sem espaços em volta do hífen.
    dest_root = (Path(r) / folder).resolve()
    out["mirrorDestinationPath"] = str(dest_root)
    out["mirrorSourceCnpj"] = cnpj_digits
    out["mirrorSourceSystemCode"] = sanitize_system_code(system_code)
    out["mirrorFolderPattern"] = "dominio_codigo_apelido"

    if not data_dir.is_dir():
        log.info("[mirror_local] data_dir inexistente: %s", data_dir)
        out["mirrorSourceXmlCount"] = 0
        out["mirrorDataDirExpected"] = str(data_dir.resolve())
        out["mirrorOperationalHint"] = (
            f"Pasta de origem inexistente no NFSE_dist: {data_dir}. "
            f"Confirme NFSE_DIST_ROOT e se o CNPJ {cnpj_digits} coincide com a empresa do job."
        )
        out["mirrorSkipReason"] = "no_nfse_data_directory"
        return out

    errors_sample: list[str] = []
    xml_paths = sorted(data_dir.rglob("*.xml"), key=lambda p: str(p))
    out["mirrorSourceXmlCount"] = len(xml_paths)

    for xml_path in xml_paths:
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

    if out["mirrorWritten"] == 0:
        if out["mirrorSourceXmlCount"] == 0:
            hint = (
                f"Nenhum .xml em {data_dir} (recursivo). O NFSE_dist não gerou ficheiros para este CNPJ neste job, "
                f"ou usou outra pasta de dados. Destino que seria usado: {dest_root}"
            )
            out["mirrorSkipReason"] = "no_xml_in_data_directory"
        elif out["mirrorFailed"] > 0:
            hint = (
                f"Havia {out['mirrorSourceXmlCount']} XML na origem mas todas as cópias falharam "
                f"(permissões, OneDrive «só online», antivírus, caminho inválido). Destino: {dest_root}"
            )
            out["mirrorSkipReason"] = "copy_failures"
        else:
            hint = (
                f"Havia {out['mirrorSourceXmlCount']} XML mas 0 cópias e 0 falhas registadas — "
                f"verifique conteúdo dos XML (doc_id vazio). Destino: {dest_root}"
            )
            out["mirrorSkipReason"] = "zero_writes_no_failures"
        out["mirrorOperationalHint"] = hint[:500]
        print(f"[mirror_local] {hint}", flush=True)
    else:
        out["mirrorOperationalHint"] = (
            f"Copiados {out['mirrorWritten']} ficheiros para {dest_root} "
            f"(origem: {out['mirrorSourceXmlCount']} XML encontrados)."
        )[:500]

    return out


def load_org_mirror_context(conn: Any, organization_id: str, company_id: str) -> dict[str, str | None]:
    """organization.local_download_root + company.system_code, trade_name, cnpj_digits."""
    with conn.cursor(row_factory=dict_row) as cur:
        cur.execute(
            """
            SELECT o.local_download_root AS root, c.system_code, c.cnpj_digits, c.trade_name
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
        "trade_name": str(row["trade_name"] or ""),
    }

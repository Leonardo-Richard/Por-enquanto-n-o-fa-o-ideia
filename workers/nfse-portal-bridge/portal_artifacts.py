"""Envia ficheiros gerados pelo NFSE_dist (pasta data/) para o portal via prepare → PUT → commit."""

from __future__ import annotations

import hashlib
import json
import xml.etree.ElementTree as ET
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

from hmac_client import http_put_bytes, internal_json_post, internal_json_request
from xml_chave import extract_access_key_from_xml


def _sha256_hex(data: bytes) -> str:
    return hashlib.sha256(data).hexdigest()


def _synthetic_access_key_44(cnpj: str, doc_id: str) -> str:
    """
    Gera uma chave técnica de 44 dígitos para layouts sem chave ADN de 44.
    Determinística por (CNPJ, doc_id) para idempotência entre XML/PDF.
    """
    seed = f"{cnpj}:{doc_id}".encode("utf-8")
    # 44 dígitos: prefixo reservado + 41 dígitos derivados do hash.
    digits = str(int(hashlib.sha256(seed).hexdigest(), 16))
    tail = digits[-41:].rjust(41, "0")
    return f"9{cnpj[:2]}{tail}"


def _issued_at_iso_from_xml(xml_text: str) -> str:
    try:
        root = ET.fromstring(xml_text)
        for path in (".//{*}dhEmi", ".//{*}dtEmi", ".//{*}DataEmissao", ".//{*}DataHoraGeracao"):
            node = root.find(path)
            if node is not None and node.text:
                raw = node.text.strip()
                if "T" in raw:
                    dt = datetime.fromisoformat(raw.replace("Z", "+00:00"))
                    return dt.astimezone(timezone.utc).isoformat()
                return datetime.strptime(raw[:10], "%Y-%m-%d").replace(tzinfo=timezone.utc).isoformat()
    except Exception:
        pass
    return datetime.now(timezone.utc).isoformat()


def upload_file(
    *,
    base_url: str,
    secret: str,
    organization_id: str,
    company_id: str,
    job_id: str,
    kind: str,
    access_key: str,
    content: bytes,
    content_type: str,
) -> dict[str, Any]:
    sha = _sha256_hex(content)
    prep_body = {
        "organizationId": organization_id,
        "companyId": company_id,
        "accessKey": access_key,
        "sha256": sha,
        "contentType": content_type,
        "kind": kind,
    }
    prep = internal_json_post(base_url, secret, "/api/internal/v1/adn/uploads/prepare", prep_body)
    upload_url = prep.get("uploadUrl")
    draft_id = prep.get("artifactDraftId")
    if not upload_url or not draft_id:
        raise RuntimeError(f"Resposta prepare inesperada: {json.dumps(prep)[:500]}")
    http_put_bytes(upload_url, content, content_type)
    issued_at = (
        _issued_at_iso_from_xml(content.decode("utf-8"))
        if kind == "xml"
        else datetime.now(timezone.utc).isoformat()
    )
    commit_body = {
        "artifactDraftId": draft_id,
        "issuedAt": issued_at,
        "byteSize": len(content),
        "contentType": content_type,
        "adnSyncJobId": job_id,
    }
    return internal_json_post(base_url, secret, "/api/internal/v1/adn/artifacts/commit", commit_body)


def sync_data_directory(
    *,
    base_url: str,
    secret: str,
    organization_id: str,
    company_id: str,
    job_id: str,
    cnpj: str,
    nfse_root: Path,
    min_xml_mtime_epoch: float | None = None,
) -> dict[str, int]:
    """Sobe XML e PDF sob data/<cnpj>/ (estrutura NFSE_dist)."""
    data_dir = nfse_root / "data" / cnpj
    counts = {"xml": 0, "pdf": 0, "skipped": 0, "syntheticKey": 0}
    if not data_dir.is_dir():
        return counts

    for xml_path in data_dir.rglob("*.xml"):
        if min_xml_mtime_epoch is not None:
            try:
                if xml_path.stat().st_mtime < min_xml_mtime_epoch:
                    counts["skipped"] += 1
                    continue
            except OSError:
                counts["skipped"] += 1
                continue
        try:
            xml_text = xml_path.read_text(encoding="utf-8")
        except OSError:
            counts["skipped"] += 1
            continue
        chave = extract_access_key_from_xml(xml_text)
        doc_id = xml_path.stem
        if not chave or len(chave) != 44 or not chave.isdigit():
            chave = _synthetic_access_key_44(cnpj, doc_id)
            counts["syntheticKey"] += 1
        xml_bytes = xml_text.encode("utf-8")
        upload_file(
            base_url=base_url,
            secret=secret,
            organization_id=organization_id,
            company_id=company_id,
            job_id=job_id,
            kind="xml",
            access_key=chave,
            content=xml_bytes,
            content_type="application/xml",
        )
        counts["xml"] += 1
        pdf_path = xml_path.with_suffix(".pdf")
        if pdf_path.is_file():
            pdf_bytes = pdf_path.read_bytes()
            upload_file(
                base_url=base_url,
                secret=secret,
                organization_id=organization_id,
                company_id=company_id,
                job_id=job_id,
                kind="pdf",
                access_key=chave,
                content=pdf_bytes,
                content_type="application/pdf",
            )
            counts["pdf"] += 1
    return counts


def patch_job(
    *,
    base_url: str,
    secret: str,
    job_id: str,
    organization_id: str,
    status: str,
    summary: dict[str, Any],
) -> None:
    body = {
        "organizationId": organization_id,
        "status": status,
        "summaryJson": summary,
        "completedAt": datetime.now(timezone.utc).isoformat(),
    }
    internal_json_request(base_url, secret, "PATCH", f"/api/internal/v1/adn/jobs/{job_id}", body)

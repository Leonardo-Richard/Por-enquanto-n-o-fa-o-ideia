"""
Materializa certificado da empresa no ambiente do NFSE_dist a partir de company_certificates.vault_ref.

Suporta vault_ref:
- supabase-storage:<bucket>:<object_path>

Formato preferido do objeto no cofre (JSON envelope v1):
{
  "version": 1,
  "format": "pkcs12",
  "pkcs12Base64": "...",
  "password": "..."
}
"""

from __future__ import annotations

import base64
import binascii
import json
import os
import platform
import ssl
import subprocess
import sys
import urllib.parse
import urllib.request
from pathlib import Path
from typing import Any

from psycopg.rows import dict_row

from ssl_context import worker_ssl_context


def _supabase_base_url() -> str:
    base = (
        os.environ.get("NEXT_PUBLIC_SUPABASE_URL", "").strip()
        or os.environ.get("SUPABASE_URL", "").strip()
    )
    if not base:
        raise RuntimeError("Falta NEXT_PUBLIC_SUPABASE_URL/SUPABASE_URL para ler cofre de certificado.")
    return base.rstrip("/")


def _supabase_service_role_key() -> str:
    key = os.environ.get("SUPABASE_SERVICE_ROLE_KEY", "").strip()
    if not key:
        raise RuntimeError("Falta SUPABASE_SERVICE_ROLE_KEY para ler cofre de certificado.")
    return key


def _parse_supabase_vault_ref(vault_ref: str) -> tuple[str, str] | None:
    prefix = "supabase-storage:"
    if not vault_ref.startswith(prefix):
        return None
    rest = vault_ref[len(prefix) :]
    i = rest.find(":")
    if i <= 0 or i >= len(rest) - 1:
        return None
    return rest[:i], rest[i + 1 :]


def _download_supabase_object(bucket: str, object_path: str) -> bytes:
    base = _supabase_base_url()
    key = _supabase_service_role_key()
    bucket_enc = urllib.parse.quote(bucket, safe="")
    path_enc = urllib.parse.quote(object_path, safe="/")
    url = f"{base}/storage/v1/object/{bucket_enc}/{path_enc}"
    req = urllib.request.Request(
        url,
        headers={
            "Authorization": f"Bearer {key}",
            "apikey": key,
        },
        method="GET",
    )
    try:
        ctx: ssl.SSLContext = worker_ssl_context()
        with urllib.request.urlopen(req, timeout=20, context=ctx) as res:
            return res.read()
    except urllib.error.HTTPError as e:  # type: ignore[attr-defined]
        detail = (e.read() or b"")[:300].decode("utf-8", errors="replace")
        raise RuntimeError(
            f"Falha ao descarregar certificado do cofre (HTTP {e.code}): {detail}"
        ) from e
    except urllib.error.URLError as e:  # type: ignore[attr-defined]
        raise RuntimeError(f"Falha de rede ao descarregar certificado do cofre: {e.reason}") from e


def _read_clients_local(nfse_root: Path) -> list[dict[str, Any]]:
    path = nfse_root / "clients.local.json"
    if not path.is_file():
        return []
    try:
        text = path.read_text(encoding="utf-8").strip()
        if not text:
            return []
        data = json.loads(text)
        return data if isinstance(data, list) else []
    except (OSError, json.JSONDecodeError):
        return []


def _existing_password_from_clients_local(nfse_root: Path, cnpj: str) -> str:
    for item in _read_clients_local(nfse_root):
        if not isinstance(item, dict):
            continue
        if str(item.get("cnpj") or "").strip() != cnpj:
            continue
        pwd = item.get("senha_cert")
        if isinstance(pwd, str) and pwd:
            return pwd
    return ""


def _upsert_clients_local_with_password(nfse_root: Path, cnpj: str, password: str) -> None:
    path = nfse_root / "clients.local.json"
    items = _read_clients_local(nfse_root)
    by_cnpj: dict[str, dict[str, Any]] = {}
    for item in items:
        if isinstance(item, dict) and str(item.get("cnpj") or "").strip():
            key = str(item["cnpj"]).strip()
            by_cnpj[key] = dict(item)

    prev = by_cnpj.get(cnpj, {})
    merged = {**prev, "cnpj": cnpj, "senha_cert": password}
    # Quando materializamos PFX local, removemos seleção por loja/thumbprint para evitar conflito.
    merged.pop("thumbprint", None)
    merged.pop("cert_store", None)
    by_cnpj[cnpj] = merged
    path.write_text(
        json.dumps(list(by_cnpj.values()), indent=2, ensure_ascii=False) + "\n",
        encoding="utf-8",
    )


def _extract_pkcs12_and_password(raw: bytes, nfse_root: Path, cnpj: str) -> tuple[bytes, str]:
    # Formato novo (envelope JSON com bytes + senha).
    try:
        data = json.loads(raw.decode("utf-8"))
    except (UnicodeDecodeError, json.JSONDecodeError):
        data = None

    if isinstance(data, dict) and int(data.get("version") or 0) == 1 and data.get("format") == "pkcs12":
        b64 = data.get("pkcs12Base64")
        pwd = data.get("password")
        if not isinstance(b64, str) or not b64:
            raise RuntimeError("Envelope de certificado inválido: pkcs12Base64 ausente.")
        if not isinstance(pwd, str) or not pwd:
            raise RuntimeError("Envelope de certificado inválido: password ausente.")
        try:
            cert_bytes = base64.b64decode(b64, validate=True)
        except (ValueError, binascii.Error):
            cert_bytes = base64.b64decode(b64)
        return cert_bytes, pwd

    # Compatibilidade com formato antigo (bytes PKCS#12 crus no cofre).
    # Sem senha no cofre antigo, tentamos reaproveitar clients.local (se existir).
    fallback_pwd = _existing_password_from_clients_local(nfse_root, cnpj)
    if not fallback_pwd:
        raise RuntimeError(
            "Certificado no cofre está em formato legado sem senha. "
            "Reenvie o certificado pelo portal para concluir a integração automática."
        )
    return raw, fallback_pwd


def load_active_company_certificate_ref(conn: Any, organization_id: str, company_id: str) -> str | None:
    with conn.cursor(row_factory=dict_row) as cur:
        cur.execute(
            """
            SELECT status, vault_ref
            FROM company_certificates
            WHERE organization_id = %s AND company_id = %s
            LIMIT 1;
            """,
            (organization_id, company_id),
        )
        row = cur.fetchone()
    if not row:
        return None
    if str(row.get("status") or "") != "active":
        return None
    ref = str(row.get("vault_ref") or "").strip()
    return ref or None


def _import_pfx_into_windows_store(cert_path: Path, password: str) -> dict[str, Any]:
    """
    Importa o .pfx para a loja Pessoal (CurrentUser\\My) do Windows usando `certutil`.

    Necessário para o motor cenário B (Chrome controlado por Playwright):
    o Chrome só consegue apresentar o certificado client TLS se ele estiver na
    loja do Windows do utilizador que corre o worker — ter só o .pfx no disco
    não é suficiente.

    Controlado por `ADN_AUTO_IMPORT_PFX_WINDOWS` (default "1" no Windows).
    """
    if platform.system() != "Windows":
        return {"imported": False, "reason": "not_windows"}
    if os.environ.get("ADN_AUTO_IMPORT_PFX_WINDOWS", "1").strip() == "0":
        return {"imported": False, "reason": "disabled_by_env"}
    if not password:
        return {"imported": False, "reason": "no_password"}
    if not cert_path.is_file():
        return {"imported": False, "reason": "pfx_not_found"}

    cmd = [
        "certutil",
        "-user",
        "-p",
        password,
        "-importPFX",
        "-f",
        "My",
        str(cert_path),
        "NoExport,NoRoot",
    ]
    try:
        proc = subprocess.run(
            cmd,
            capture_output=True,
            text=True,
            timeout=120,
            check=False,
        )
    except FileNotFoundError:
        return {"imported": False, "reason": "certutil_not_found"}
    except subprocess.TimeoutExpired:
        return {"imported": False, "reason": "certutil_timeout"}

    if proc.returncode == 0:
        return {"imported": True, "reason": "ok"}
    out = (proc.stderr or proc.stdout or "")[:300]
    print(
        f"[cert-import] certutil rc={proc.returncode}: {out!s}",
        file=sys.stderr,
        flush=True,
    )
    return {"imported": False, "reason": f"certutil_rc_{proc.returncode}"}


def materialize_company_certificate_from_vault(
    *,
    organization_id: str,
    company_id: str,
    cnpj_digits: str,
    nfse_root: Path,
    vault_ref: str | None,
) -> dict[str, Any]:
    if not vault_ref:
        return {"materialized": False, "reason": "no_active_vault_ref"}

    parsed = _parse_supabase_vault_ref(vault_ref)
    if not parsed:
        return {"materialized": False, "reason": "unsupported_vault_ref"}

    bucket, object_path = parsed
    raw = _download_supabase_object(bucket, object_path)
    cert_bytes, password = _extract_pkcs12_and_password(raw, nfse_root, cnpj_digits)

    cert_dir = nfse_root / "certificates"
    cert_dir.mkdir(parents=True, exist_ok=True)
    cert_path = cert_dir / f"{cnpj_digits}.pfx"
    cert_path.write_bytes(cert_bytes)
    _upsert_clients_local_with_password(nfse_root, cnpj_digits, password)

    win_import = _import_pfx_into_windows_store(cert_path, password)

    return {
        "materialized": True,
        "reason": "ok",
        "vaultRefKind": "supabase-storage",
        "targetCertPath": str(cert_path),
        "windowsStoreImport": win_import,
    }

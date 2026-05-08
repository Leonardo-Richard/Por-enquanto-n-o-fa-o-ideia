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


def _extract_pfx_subject_cn(cert_path: Path, password: str) -> str | None:
    """Lê o CN (Subject) do .pfx via PowerShell. Devolve None se falhar."""
    if platform.system() != "Windows" or not cert_path.is_file() or not password:
        return None
    ps_script = (
        "$ErrorActionPreference='Stop';"
        "$cert = New-Object System.Security.Cryptography.X509Certificates.X509Certificate2;"
        "$secure = ConvertTo-SecureString -String $env:ADN_PFX_PWD -AsPlainText -Force;"
        "$flags = [System.Security.Cryptography.X509Certificates.X509KeyStorageFlags]::DefaultKeySet;"
        "$cert.Import($env:ADN_PFX_PATH, $secure, $flags);"
        "$cn = ($cert.Subject -split ',') | Where-Object { $_.Trim().StartsWith('CN=') } | "
        "ForEach-Object { $_.Trim().Substring(3) } | Select-Object -First 1;"
        "if ($cn) { [Console]::Out.Write($cn) }"
    )
    env = os.environ.copy()
    env["ADN_PFX_PATH"] = str(cert_path)
    env["ADN_PFX_PWD"] = password
    try:
        proc = subprocess.run(
            [
                "powershell.exe",
                "-NoProfile",
                "-ExecutionPolicy",
                "Bypass",
                "-Command",
                ps_script,
            ],
            capture_output=True,
            text=True,
            timeout=30,
            check=False,
            env=env,
        )
    except (FileNotFoundError, subprocess.TimeoutExpired):
        return None
    if proc.returncode != 0:
        return None
    cn = (proc.stdout or "").strip()
    return cn or None


def _set_chrome_autoselect_policy(subject_cn: str) -> dict[str, Any]:
    """
    Configura a Chrome policy `AutoSelectCertificateForUrls` para escolher AUTOMATICAMENTE
    o certificado da empresa actual (filtro SUBJECT.CN exacto) ao falar com `nfse.gov.br`.

    Controlado por:
      ADN_AUTO_SELECT_CERT_CHROME — "0" desactiva (default ligado).
      ADN_AUTO_SELECT_URL_PATTERN — pattern Chrome (default https://[*.]nfse.gov.br).
    """
    if platform.system() != "Windows":
        return {"set": False, "reason": "not_windows"}
    if os.environ.get("ADN_AUTO_SELECT_CERT_CHROME", "1").strip() == "0":
        return {"set": False, "reason": "disabled_by_env"}
    if not subject_cn:
        return {"set": False, "reason": "no_subject_cn"}

    pattern = (
        os.environ.get("ADN_AUTO_SELECT_URL_PATTERN", "").strip()
        or "https://[*.]nfse.gov.br"
    )
    rule = json.dumps(
        {"pattern": pattern, "filter": {"SUBJECT": {"CN": subject_cn}}},
        ensure_ascii=False,
    )

    # Escreve em HKLM e HKCU (mesmo motivo do force-install: Chrome do Playwright
    # nem sempre vê HKCU consoante o contexto de lançamento).
    ps_script = (
        "$rule=$env:ADN_RULE;"
        "foreach ($root in 'HKLM:','HKCU:') {"
        "  $key=\"$root\\SOFTWARE\\Policies\\Google\\Chrome\\AutoSelectCertificateForUrls\";"
        "  try {"
        "    New-Item -Path $key -Force | Out-Null;"
        "    Set-ItemProperty -Path $key -Name '1' -Value $rule -Type String"
        "  } catch { }"
        "}"
    )
    env = os.environ.copy()
    env["ADN_RULE"] = rule
    try:
        proc = subprocess.run(
            [
                "powershell.exe",
                "-NoProfile",
                "-ExecutionPolicy",
                "Bypass",
                "-Command",
                ps_script,
            ],
            capture_output=True,
            text=True,
            timeout=15,
            check=False,
            env=env,
        )
    except (FileNotFoundError, subprocess.TimeoutExpired) as e:
        return {"set": False, "reason": f"powershell_error:{type(e).__name__}"}
    if proc.returncode == 0:
        return {"set": True, "reason": "ok", "subjectCn": subject_cn, "pattern": pattern}
    return {
        "set": False,
        "reason": f"ps_rc_{proc.returncode}",
        "stderr": (proc.stderr or "")[:200],
    }


"""
ID estável da extensão "Baixar NFSe Nota Fiscal de Serviço Eletrônica" na Chrome Web Store.
Usado para forçar a instalação via política `ExtensionInstallForcelist` (necessário desde
Chrome 137+, que removeu a flag `--load-extension` em builds oficiais).
"""
ADN_BROWSER_EXTENSION_ID_DEFAULT = "enehmclajcndmgefbmjhecccoegbdgea"
ADN_BROWSER_EXTENSION_UPDATE_URL = "https://clients2.google.com/service/update2/crx"


def _set_chrome_extension_force_install_policy() -> dict[str, Any]:
    """
    Configura a Chrome policy `ExtensionInstallForcelist` (HKCU) para forçar a instalação
    da extensão «Baixar NFSe» da Chrome Web Store no perfil que o motor Playwright lança.

    Necessário porque o Chrome 137+ removeu o suporte a `--load-extension` em builds
    branded (Chrome estável). Com a policy, o Chrome instala automaticamente a extensão
    a partir da Web Store assim que o perfil arranca, com o ID original.

    Variáveis:
      ADN_FORCE_INSTALL_EXTENSION — "0" desactiva (default ligado).
      ADN_BROWSER_EXTENSION_ID    — sobrepõe o ID (raramente necessário).
    """
    if platform.system() != "Windows":
        return {"set": False, "reason": "not_windows"}
    if os.environ.get("ADN_FORCE_INSTALL_EXTENSION", "1").strip() == "0":
        return {"set": False, "reason": "disabled_by_env"}

    ext_id = (
        os.environ.get("ADN_BROWSER_EXTENSION_ID", "").strip()
        or ADN_BROWSER_EXTENSION_ID_DEFAULT
    )
    value = f"{ext_id};{ADN_BROWSER_EXTENSION_UPDATE_URL}"
    """
    Escreve a policy em HKLM (máquina-wide) E HKCU (utilizador) — Chrome lê de ambas
    raízes e a HKLM aplica-se mesmo quando o processo é lançado por outro contexto
    (caso típico do Playwright). Se o operador não for administrador, HKLM falha mas
    HKCU é tentado como fallback.
    """
    ps_script = (
        "$value=$env:ADN_FORCE_VALUE;"
        "$reasons=@();"
        "foreach ($root in 'HKLM:','HKCU:') {"
        "  $key=\"$root\\SOFTWARE\\Policies\\Google\\Chrome\\ExtensionInstallForcelist\";"
        "  try {"
        "    New-Item -Path $key -Force | Out-Null;"
        "    Set-ItemProperty -Path $key -Name '1' -Value $value -Type String;"
        "    $reasons += \"$root ok\""
        "  } catch {"
        "    $reasons += \"$root fail:$($_.Exception.Message)\""
        "  }"
        "};"
        "Write-Output ($reasons -join '; ')"
    )
    env = os.environ.copy()
    env["ADN_FORCE_VALUE"] = value
    try:
        proc = subprocess.run(
            [
                "powershell.exe",
                "-NoProfile",
                "-ExecutionPolicy",
                "Bypass",
                "-Command",
                ps_script,
            ],
            capture_output=True,
            text=True,
            timeout=20,
            check=False,
            env=env,
        )
    except (FileNotFoundError, subprocess.TimeoutExpired) as e:
        return {"set": False, "reason": f"powershell_error:{type(e).__name__}"}
    out = (proc.stdout or "").strip()
    # Pelo menos uma das raízes tem que ter sucesso.
    if proc.returncode == 0 and "ok" in out:
        scope = "machine+user" if "HKLM: ok" in out and "HKCU: ok" in out else (
            "machine_only" if "HKLM: ok" in out else "user_only"
        )
        return {"set": True, "reason": "ok", "extensionId": ext_id, "scope": scope, "details": out}
    return {
        "set": False,
        "reason": f"ps_rc_{proc.returncode}",
        "details": out,
        "stderr": (proc.stderr or "")[:200],
    }


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

    chrome_autoselect: dict[str, Any] = {"set": False, "reason": "not_attempted"}
    subject_cn = _extract_pfx_subject_cn(cert_path, password)
    if subject_cn:
        chrome_autoselect = _set_chrome_autoselect_policy(subject_cn)

    chrome_force_install = _set_chrome_extension_force_install_policy()

    return {
        "materialized": True,
        "reason": "ok",
        "vaultRefKind": "supabase-storage",
        "targetCertPath": str(cert_path),
        "windowsStoreImport": win_import,
        "chromeAutoSelect": chrome_autoselect,
        "chromeExtensionForceInstall": chrome_force_install,
        "subjectCn": subject_cn,
    }

"""
Motor de descarga ADN: NFSE_dist vs cenário B (Playwright via subprocess).

Variáveis relevantes: ADN_DOWNLOAD_ENGINE, ADN_PLAYWRIGHT_MOTOR_NODE, ADN_PLAYWRIGHT_MOTOR_SCRIPT,
ADN_BROWSER_PHASE_TIMEOUT_SEC, ADN_BROWSER_LOCK_PATH, NFSE_BRIDGE_SKIP_NFSE_DIST,
ADN_CHROME_USER_DATA_DIR, ADN_BROWSER_EXTENSION_DIR, ADN_NFSE_LOGIN_URL, ADN_PLAYWRIGHT_CHANNEL,
ADN_PLAYWRIGHT_USE_BROWSER, ADN_PLAYWRIGHT_FATIA_ZERO (herdadas pelo subprocesso do motor Node).
"""

from __future__ import annotations

import os
import re
import subprocess
import sys
from pathlib import Path

from filelock import FileLock

# Categorias estáveis para summary_json (FR-ADN-B-04)
VALID_FAILURE_CATEGORIES = frozenset(
    {"session", "portal", "extension", "disk", "timeout", "unknown"}
)

def get_download_engine() -> str:
    raw = os.environ.get("ADN_DOWNLOAD_ENGINE", "").strip().lower()
    if not raw:
        return "nfse_dist"
    if raw in ("nfse_dist", "playwright_extension"):
        return raw
    return raw


def playwright_phase_timeout_sec() -> int:
    raw = os.environ.get("ADN_BROWSER_PHASE_TIMEOUT_SEC", "").strip()
    if not raw:
        return 3600
    try:
        return max(30, int(raw))
    except ValueError:
        return 3600


def sanitize_user_safe_detail(text: str, max_len: int = 500) -> str:
    """Remove caminhos UNC, HTML e prefixos sensíveis da mensagem exposta ao portal."""
    if not text:
        return ""
    s = text[:8000]
    # UNC \\servidor\share ou \\?\ (extended path)
    s = re.sub(r"\\\\\?\\[^\s]{4,200}", "[path]", s, flags=re.IGNORECASE)
    s = re.sub(r"\\\\[^\s\\]+\\[^\s]{2,200}", "[path]", s)
    s = re.sub(r"[A-Za-z]:\\[^\s]{2,500}", "[path]", s)
    s = re.sub(r"<[^>]+>", "", s)
    s = re.sub(r"\s+", " ", s).strip()
    return s[:max_len]


def infer_failure_category_from_exception(exc: BaseException) -> str:
    """Heurística para excepções Python (sem stderr do motor)."""
    name = type(exc).__name__
    msg = str(exc).lower()
    if "timeout" in name.lower() or "timeout" in msg:
        return "timeout"
    # Portal nacional / HTTP ocupado (NFSE_dist, rede)
    if any(
        x in msg
        for x in (
            "503",
            "502",
            "504",
            "429",
            "service unavailable",
            "bad gateway",
            "gateway timeout",
            "rate limit",
            "too many requests",
            "manutenção",
            "indisponível",
            "ocupado",
            "connection refused",
        )
    ):
        return "portal"
    if "permission" in msg or "acesso" in msg or "denied" in msg:
        return "disk"
    if "espaço" in msg or "space" in msg or "disk" in msg:
        return "disk"
    if "session" in msg or "login" in msg or "certific" in msg:
        return "session"
    return "unknown"


def map_exit_and_stderr_to_category(exit_code: int, stderr_text: str) -> str:
    """
    Alinha-se à tabela do README do adn-playwright-motor (prefixos STDERR_CAT_*).
    """
    for line in stderr_text.splitlines():
        line_stripped = line.strip()
        if line_stripped.startswith("STDERR_CAT_SESSION"):
            return "session"
        if line_stripped.startswith("STDERR_CAT_PORTAL"):
            return "portal"
        if line_stripped.startswith("STDERR_CAT_EXTENSION"):
            return "extension"
        if line_stripped.startswith("STDERR_CAT_DISK"):
            return "disk"
        if line_stripped.startswith("STDERR_CAT_TIMEOUT"):
            return "timeout"
    if exit_code == 10:
        return "session"
    if exit_code == 11:
        return "portal"
    if exit_code == 12:
        return "extension"
    if exit_code == 13:
        return "disk"
    if exit_code == 14 or exit_code == -15:  # SIGTERM mapped - Windows uses different codes
        return "timeout"
    if exit_code != 0:
        return "unknown"
    return "unknown"


def default_playwright_script(repo_root: Path) -> Path:
    return repo_root / "workers" / "adn-playwright-motor" / "cli.js"


def run_playwright_motor_subprocess(
    *,
    repo_root: Path,
    output_dir: Path,
    cnpj: str,
    job_id: str,
) -> tuple[int, str, str]:
    """
    Executa o motor Node. Retorna (exit_code, stderr_completo, failure_category).
    """
    node = os.environ.get("ADN_PLAYWRIGHT_MOTOR_NODE", "").strip() or (
        "node.exe" if sys.platform == "win32" else "node"
    )
    script_raw = os.environ.get("ADN_PLAYWRIGHT_MOTOR_SCRIPT", "").strip()
    script = Path(script_raw) if script_raw else default_playwright_script(repo_root)
    if not script.is_file():
        return (
            127,
            f"motor script missing: {script}",
            "unknown",
        )

    timeout_sec = playwright_phase_timeout_sec()
    env = os.environ.copy()
    # Perfil / extensão nunca vão no PATCH — só env do subprocesso
    cmd = [
        node,
        str(script),
        "--output-dir",
        str(output_dir),
        "--cnpj",
        cnpj,
        "--job-id",
        job_id,
    ]
    try:
        proc = subprocess.run(
            cmd,
            capture_output=True,
            text=True,
            timeout=timeout_sec,
            env=env,
            cwd=str(script.parent),
        )
    except subprocess.TimeoutExpired as e:
        cat = "timeout"
        err = (e.stderr or "") + "\nSTDERR_CAT_TIMEOUT subprocess.TimeoutExpired"
        return (-9, err, cat)
    except OSError as e:
        return (1, str(e), "unknown")

    stderr = proc.stderr or ""
    stdout = proc.stdout or ""
    combined = (stderr + "\n" + stdout)[-8000:]
    category = map_exit_and_stderr_to_category(proc.returncode, combined)
    return (proc.returncode, combined, category)


def playwright_browser_file_lock(repo_root: Path) -> FileLock:
    """
    Lock entre processos para o subprocesso browser (NFR-ADN-B-04).
    Caminho: ADN_BROWSER_LOCK_PATH ou <repo>/.adn_browser_worker.lock
    timeout=-1: aguarda até o outro worker libertar (vários poll_jobs na mesma VM).
    """
    custom = os.environ.get("ADN_BROWSER_LOCK_PATH", "").strip()
    lock_path = Path(custom) if custom else (repo_root / ".adn_browser_worker.lock")
    lock_path.parent.mkdir(parents=True, exist_ok=True)
    return FileLock(str(lock_path), timeout=-1)


class MotorExecutionError(RuntimeError):
    """Falha do motor Playwright (subprocesso) com categoria segura para o portal."""

    def __init__(self, message: str, *, category: str = "unknown", stderr_tail: str = "") -> None:
        super().__init__(message)
        self.category = category if category in VALID_FAILURE_CATEGORIES else "unknown"
        self.stderr_tail = stderr_tail[:2000]

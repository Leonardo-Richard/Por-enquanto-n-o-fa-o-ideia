"""Logs uniformes na consola do worker ADN (sempre com job id para grep / suporte)."""

from __future__ import annotations


def _ascii_safe_for_console(s: str) -> str:
    """Windows (cp1252) rebenta em print() com caracteres como >= (U+2265)."""
    return s.encode("ascii", "replace").decode("ascii")


def job_log(job_id: str, step: str, detail: str = "") -> None:
    extra = f" - {detail}" if detail else ""
    line = f"[adn-job {job_id}] {step}{extra}"
    # Sempre ASCII: no Windows, print() usa cp1252 e rebenta com ≥, …, etc.
    print(_ascii_safe_for_console(line), flush=True)

"""
Contexto SSL central para pedidos HTTPS do worker (Supabase Storage + API interna do portal).

Por omissão usa o bundle de CAs da Mozilla via `certifi`. Se a variável `ADN_WORKER_INSECURE_SSL=1`
estiver definida, devolve um contexto sem verificação (apenas diagnóstico — nunca em produção).
"""

from __future__ import annotations

import os
import ssl

try:
    import certifi  # type: ignore
except ImportError:
    certifi = None  # type: ignore[assignment]


def _insecure_requested() -> bool:
    return os.environ.get("ADN_WORKER_INSECURE_SSL", "").strip() == "1"


def worker_ssl_context() -> ssl.SSLContext:
    """
    Devolve um `ssl.SSLContext` apropriado para o worker.

    - `ADN_WORKER_INSECURE_SSL=1`: contexto sem verificação (só diagnóstico).
    - Caso contrário: contexto com bundle `certifi` (preferido) ou defaults do sistema.
    """
    if _insecure_requested():
        ctx = ssl.create_default_context()
        ctx.check_hostname = False
        ctx.verify_mode = ssl.CERT_NONE
        return ctx

    if certifi is not None:
        try:
            return ssl.create_default_context(cafile=certifi.where())
        except (OSError, ssl.SSLError):
            pass
    return ssl.create_default_context()

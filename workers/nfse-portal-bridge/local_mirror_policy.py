"""
Política de espelho XML/PDF em pasta raiz no host do worker.

Predefinição (browser / portal): não gravar em disco local da organização.
Opt-in: NFSE_LOCAL_MIRROR_ENABLED=1 e pasta raiz configurada.
NFSE_LOCAL_MIRROR_DISABLED=1 força desligar (prevalece sobre ENABLED).
"""

from __future__ import annotations

import os


def local_mirror_writes_enabled() -> bool:
    if os.environ.get("NFSE_LOCAL_MIRROR_DISABLED", "").strip() == "1":
        return False
    return os.environ.get("NFSE_LOCAL_MIRROR_ENABLED", "").strip() == "1"

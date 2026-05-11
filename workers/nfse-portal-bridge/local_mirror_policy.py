"""
Política de espelho XML/PDF em pasta raiz no host do worker.

Predefinição (worker on-premise / Windows com pasta configurada no portal):
LIGADO automaticamente. Se o utilizador configurou `local_download_root` na
organização, o esperado é receber os ficheiros lá.

Override:
  - `NFSE_LOCAL_MIRROR_DISABLED=1`: força desligar (cloud sem disco local, ou
    diagnóstico). Tem prioridade absoluta.
  - `NFSE_LOCAL_MIRROR_ENABLED=0`: também desliga (forma alternativa).
  - `NFSE_LOCAL_MIRROR_ENABLED=1`: força ligar (redundante com o default; mantido
    por retro-compatibilidade).

Quando ligado mas `local_download_root` não estiver definido na organização,
`mirror_data_directory_to_local` salta o passo graciosamente com
`mirrorSkipReason=no_local_download_root` (não é erro).
"""

from __future__ import annotations

import os


def local_mirror_writes_enabled() -> bool:
    """LIGADO por defeito; desligado apenas se o operador for explícito."""
    if os.environ.get("NFSE_LOCAL_MIRROR_DISABLED", "").strip() == "1":
        return False
    enabled_raw = os.environ.get("NFSE_LOCAL_MIRROR_ENABLED", "").strip().lower()
    if enabled_raw in {"0", "false", "no", "off"}:
        return False
    return True

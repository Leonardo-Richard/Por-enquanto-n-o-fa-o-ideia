"""
Executa o mesmo fluxo que o menu [1] do NFSE_dist (run_download_workflow).
Deve correr com cwd = raiz do NFSE_dist e clients.json já escrito.
"""

from __future__ import annotations

import json
import os
import shutil
import sys
from pathlib import Path


def ensure_layout(nfse_root: Path) -> None:
    for sub in ("logs", "data", "certificates"):
        (nfse_root / sub).mkdir(parents=True, exist_ok=True)


def write_clients_json(nfse_root: Path, cnpj: str, nome: str) -> None:
    cfg = [{"cnpj": cnpj, "nome": nome or cnpj}]
    (nfse_root / "clients.json").write_text(
        json.dumps(cfg, indent=2, ensure_ascii=False) + "\n",
        encoding="utf-8",
    )


def copy_local_patch_if_configured(nfse_root: Path) -> None:
    """Opcional: caminho absoluto para um clients.local.json gerido fora do git."""
    src = os.environ.get("NFSE_DIST_CLIENTS_LOCAL_PATH", "").strip()
    if not src:
        return
    p = Path(src)
    if p.is_file():
        shutil.copyfile(p, nfse_root / "clients.local.json")


def run_download_workflow_once(nfse_root: Path) -> None:
    """Importa o NFSE_dist já descompactado em nfse_root."""
    nfse_root = nfse_root.resolve()
    if not (nfse_root / "main.py").is_file():
        raise FileNotFoundError(
            f"NFSE_dist não encontrado em {nfse_root}. Execute na raiz do monorepo: npm run vendor:nfse-dist",
        )
    ensure_layout(nfse_root)
    os.chdir(nfse_root)
    if str(nfse_root) not in sys.path:
        sys.path.insert(0, str(nfse_root))
    copy_local_patch_if_configured(nfse_root)
    import main as nfse_main  # pylint: disable=import-outside-toplevel,import-error

    nfse_main.run_download_workflow()

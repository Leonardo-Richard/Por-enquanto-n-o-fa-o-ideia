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


def _filter_local_patch_by_clients(nfse_root: Path) -> None:
    """Mantém no clients.local.json apenas CNPJs presentes no clients.json do job atual."""
    cfg_path = nfse_root / "clients.json"
    local_path = nfse_root / "clients.local.json"
    if not cfg_path.is_file() or not local_path.is_file():
        return

    try:
        cfg_data = json.loads(cfg_path.read_text(encoding="utf-8") or "[]")
        allowed = {
            str(item.get("cnpj", "")).strip()
            for item in cfg_data
            if isinstance(item, dict) and str(item.get("cnpj", "")).strip()
        }
        local_data = json.loads(local_path.read_text(encoding="utf-8") or "[]")
        if not isinstance(local_data, list):
            return
        filtered = [
            item
            for item in local_data
            if isinstance(item, dict) and str(item.get("cnpj", "")).strip() in allowed
        ]
        local_path.write_text(
            json.dumps(filtered, indent=2, ensure_ascii=False) + "\n",
            encoding="utf-8",
        )
    except (OSError, json.JSONDecodeError):
        return


def copy_local_patch_if_configured(nfse_root: Path) -> None:
    """Opcional: caminho absoluto para um clients.local.json gerido fora do git."""
    src = os.environ.get("NFSE_DIST_CLIENTS_LOCAL_PATH", "").strip()
    if not src:
        return
    p = Path(src)
    if p.is_file():
        shutil.copyfile(p, nfse_root / "clients.local.json")
    _filter_local_patch_by_clients(nfse_root)


def run_download_workflow_once(nfse_root: Path) -> None:
    """Importa o NFSE_dist já descompactado em nfse_root."""
    nfse_root = nfse_root.resolve()
    if not (nfse_root / "main.py").is_file():
        raise FileNotFoundError(
            f"NFSE_dist não encontrado em {nfse_root}. Execute na raiz do monorepo: npm run vendor:nfse-dist",
        )
    ensure_layout(nfse_root)
    os.chdir(nfse_root)
    _filter_local_patch_by_clients(nfse_root)
    if str(nfse_root) not in sys.path:
        sys.path.insert(0, str(nfse_root))
    copy_local_patch_if_configured(nfse_root)
    import main as nfse_main  # pylint: disable=import-outside-toplevel,import-error

    nfse_main.run_download_workflow()

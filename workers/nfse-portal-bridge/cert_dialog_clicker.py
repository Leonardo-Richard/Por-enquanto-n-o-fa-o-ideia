"""
Watcher Win32 que detecta o pop-up nativo «Selecione um certificado» e simula
ENTER para confirmar a selecção (botão OK por defeito).

Razão de ser:
    Chromium for Testing (binário bundled do Playwright) não respeita as policies
    `AutoSelectCertificateForUrls`. Quando o portal NFS-e exige certificado client,
    o Chromium mostra o diálogo modal nativo do Windows. Como o cert da empresa
    já foi importado para a loja Pessoal (CurrentUser\\My) por
    `cert_materialization._import_pfx_into_windows_store`, o pop-up apresenta um
    único certificado pré-seleccionado — basta um ENTER para confirmar.

API:
    start_watcher() -> stop()  # noqa: D401 (devolve um callable que pára o thread)

Comportamento:
    - Thread daemon (não bloqueia o exit do worker).
    - Polling de 500 ms.
    - Para cada janela top-level com título contendo «certificado»/«certificate»,
      envia ENTER (WM_KEYDOWN/WM_KEYUP) no handle.
    - Limita-se a `ADN_CERT_DIALOG_MAX_CLICKS` cliques (default 50) para evitar
      ciclo infinito caso algo fique mal.
    - Em plataformas não-Windows ou se `pywin32` não estiver disponível, o watcher
      é uma no-op silenciosa.
"""

from __future__ import annotations

import os
import sys
import threading
import time
from typing import Callable

_DIALOG_TITLE_NEEDLES = (
    "selecione um certificado",
    "selecionar certificado",
    "select a certificate",
    "selecciona um certificado",
)


def _is_supported_platform() -> bool:
    return sys.platform == "win32" and os.environ.get(
        "ADN_CERT_DIALOG_AUTOCLICK", "1"
    ).strip() != "0"


def _import_pywin32():
    try:
        import win32con  # type: ignore
        import win32gui  # type: ignore

        return win32gui, win32con
    except ImportError:
        return None, None


def _find_cert_dialog_handles(win32gui_mod) -> list[int]:
    found: list[int] = []

    def _enum(hwnd: int, _ctx) -> None:
        try:
            title = win32gui_mod.GetWindowText(hwnd) or ""
        except Exception:
            return
        if not win32gui_mod.IsWindowVisible(hwnd):
            return
        lower = title.lower()
        if any(needle in lower for needle in _DIALOG_TITLE_NEEDLES):
            found.append(hwnd)

    try:
        win32gui_mod.EnumWindows(_enum, None)
    except Exception:
        pass
    return found


def _send_enter(win32gui_mod, win32con_mod, hwnd: int) -> bool:
    try:
        win32gui_mod.PostMessage(hwnd, win32con_mod.WM_KEYDOWN, win32con_mod.VK_RETURN, 0)
        time.sleep(0.05)
        win32gui_mod.PostMessage(hwnd, win32con_mod.WM_KEYUP, win32con_mod.VK_RETURN, 0)
        return True
    except Exception:
        return False


def _watcher_loop(stop_event: threading.Event, max_clicks: int) -> None:
    win32gui_mod, win32con_mod = _import_pywin32()
    if win32gui_mod is None:
        return
    seen: set[int] = set()
    clicks = 0
    while not stop_event.is_set() and clicks < max_clicks:
        for hwnd in _find_cert_dialog_handles(win32gui_mod):
            if hwnd in seen:
                continue
            if _send_enter(win32gui_mod, win32con_mod, hwnd):
                seen.add(hwnd)
                clicks += 1
                print(
                    f"[cert-dialog-clicker] ENTER enviado ao diálogo nativo de certificado "
                    f"(hwnd={hwnd}, total={clicks}).",
                    flush=True,
                )
        stop_event.wait(0.5)


def start_watcher() -> Callable[[], None]:
    """
    Arranca o watcher em thread daemon. Devolve um callable que sinaliza paragem
    e aguarda até 1 s pelo término. Sem efeito em plataformas não-suportadas.
    """
    if not _is_supported_platform():
        return lambda: None

    win32gui_mod, _ = _import_pywin32()
    if win32gui_mod is None:
        print(
            "[cert-dialog-clicker] pywin32 não disponível; ignorar autoclick "
            "(instale `pywin32` no Python do worker).",
            flush=True,
        )
        return lambda: None

    max_clicks = max(
        1,
        int(os.environ.get("ADN_CERT_DIALOG_MAX_CLICKS", "50") or "50"),
    )
    stop = threading.Event()
    t = threading.Thread(target=_watcher_loop, args=(stop, max_clicks), daemon=True)
    t.start()

    def _stop() -> None:
        stop.set()
        t.join(timeout=1.0)

    return _stop

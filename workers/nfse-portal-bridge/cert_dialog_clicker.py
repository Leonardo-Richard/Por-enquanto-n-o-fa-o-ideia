"""
Watcher Win32 que detecta o pop-up «Selecione um certificado» do Chrome/Chromium
e confirma com ENTER (botão OK por defeito).

Razão de ser:
    Chromium for Testing (binário bundled do Playwright) IGNORA a policy
    `AutoSelectCertificateForUrls`. Quando o portal NFS-e exige certificado
    client, o Chrome mostra um diálogo modal a pedir selecção de certificado.
    Como `cert_materialization._purge_other_company_certs_in_windows_store`
    deixa apenas 1 certificado ICP-Brasil de empresa na loja `CurrentUser\\My`,
    basta confirmar (ENTER) para autenticar com o certificado correcto.

Estratégia em 3 camadas (do mais seguro para o mais agressivo):

    1. **Top-level Win32**: `EnumWindows` → procura janelas com título contendo
       «selecione um certificado» (legado, ainda usado em Edge/Chromium em
       certos modos). Envia ENTER por `PostMessage`.

    2. **Child windows**: `EnumChildWindows` em janelas top-level cuja classe
       começa por `Chrome_WidgetWin_` — o diálogo de cert do Chrome moderno é
       renderizado como child window com classe específica
       (`SECCERTSELDIALOG`/`#32770`/etc.).

    3. **Foreground fallback**: como último recurso, se não houver match nas
       camadas 1 e 2 mas a janela em foreground for do Chrome (classe
       `Chrome_WidgetWin_`), envia ENTER global via `keybd_event` após
       `SetForegroundWindow`. Activado por `ADN_CERT_DIALOG_GLOBAL_ENTER=1`
       (default ligado, porque é o caminho que funciona com Chrome moderno).

Logging diagnóstico:
    - A cada `ADN_CERT_DIALOG_DIAG_SEC` segundos (default 8s), imprime título +
      classe de janelas top-level relevantes (Chrome/NFS-e) para podermos ver
      como o diálogo aparece no ambiente real.
    - Cada tentativa de ENTER imprime o método usado (PostMessage / keybd_event).

Variáveis de ambiente:
    - `ADN_CERT_DIALOG_AUTOCLICK`     — `0` desliga (default ligado).
    - `ADN_CERT_DIALOG_MAX_CLICKS`    — limite cliques (default 50).
    - `ADN_CERT_DIALOG_DIAG_SEC`      — intervalo de dump de janelas (default 8).
    - `ADN_CERT_DIALOG_GLOBAL_ENTER`  — `0` desliga camada 3 (default ligado).
    - `ADN_CERT_DIALOG_GLOBAL_DELAY`  — segundos antes do primeiro ENTER global
                                        (default 6, evita disparar antes do
                                        Chrome estar com o pop-up no ecrã).
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

_CHROME_WIDGET_CLASS_PREFIX = "Chrome_WidgetWin_"
_NFSE_TITLE_HINTS = ("nfs-e", "nfse", "emissornacional", "google chrome", "chromium")


def _is_supported_platform() -> bool:
    return sys.platform == "win32" and os.environ.get(
        "ADN_CERT_DIALOG_AUTOCLICK", "1"
    ).strip() != "0"


def _import_pywin32():
    try:
        import win32api  # type: ignore
        import win32con  # type: ignore
        import win32gui  # type: ignore

        return win32api, win32con, win32gui
    except ImportError:
        return None, None, None


def _safe_get_class(win32gui_mod, hwnd: int) -> str:
    try:
        return win32gui_mod.GetClassName(hwnd) or ""
    except Exception:
        return ""


def _safe_get_title(win32gui_mod, hwnd: int) -> str:
    try:
        return win32gui_mod.GetWindowText(hwnd) or ""
    except Exception:
        return ""


def _enum_top_level(win32gui_mod) -> list[tuple[int, str, str]]:
    """Devolve [(hwnd, title, class)] de janelas top-level visíveis."""
    found: list[tuple[int, str, str]] = []

    def _cb(hwnd: int, _ctx) -> None:
        try:
            if not win32gui_mod.IsWindowVisible(hwnd):
                return
        except Exception:
            return
        title = _safe_get_title(win32gui_mod, hwnd)
        cls = _safe_get_class(win32gui_mod, hwnd)
        found.append((hwnd, title, cls))

    try:
        win32gui_mod.EnumWindows(_cb, None)
    except Exception:
        pass
    return found


def _enum_children(win32gui_mod, parent_hwnd: int) -> list[tuple[int, str, str]]:
    """Devolve [(hwnd, title, class)] de child windows recursivamente."""
    found: list[tuple[int, str, str]] = []

    def _cb(hwnd: int, _ctx) -> None:
        title = _safe_get_title(win32gui_mod, hwnd)
        cls = _safe_get_class(win32gui_mod, hwnd)
        found.append((hwnd, title, cls))

    try:
        win32gui_mod.EnumChildWindows(parent_hwnd, _cb, None)
    except Exception:
        pass
    return found


def _title_matches_cert_dialog(title: str) -> bool:
    if not title:
        return False
    lower = title.lower()
    return any(needle in lower for needle in _DIALOG_TITLE_NEEDLES)


def _post_enter(win32gui_mod, win32con_mod, hwnd: int) -> bool:
    try:
        win32gui_mod.PostMessage(hwnd, win32con_mod.WM_KEYDOWN, win32con_mod.VK_RETURN, 0)
        time.sleep(0.04)
        win32gui_mod.PostMessage(hwnd, win32con_mod.WM_KEYUP, win32con_mod.VK_RETURN, 0)
        return True
    except Exception:
        return False


def _global_enter(win32api_mod, win32con_mod, win32gui_mod, hwnd_focus: int | None) -> bool:
    """SetForegroundWindow (best-effort) + keybd_event ENTER (input global)."""
    if hwnd_focus is not None:
        try:
            win32gui_mod.SetForegroundWindow(hwnd_focus)
            time.sleep(0.08)
        except Exception:
            pass
    try:
        win32api_mod.keybd_event(win32con_mod.VK_RETURN, 0, 0, 0)
        time.sleep(0.05)
        win32api_mod.keybd_event(
            win32con_mod.VK_RETURN, 0, win32con_mod.KEYEVENTF_KEYUP, 0
        )
        return True
    except Exception:
        return False


def _is_chrome_window(cls: str, title: str) -> bool:
    if cls.startswith(_CHROME_WIDGET_CLASS_PREFIX):
        return True
    lower = title.lower()
    return any(hint in lower for hint in _NFSE_TITLE_HINTS)


def _watcher_loop(stop_event: threading.Event, max_clicks: int) -> None:
    win32api_mod, win32con_mod, win32gui_mod = _import_pywin32()
    if win32gui_mod is None:
        return

    diag_interval = max(
        1.0, float(os.environ.get("ADN_CERT_DIALOG_DIAG_SEC", "8") or "8")
    )
    global_enter_enabled = (
        os.environ.get("ADN_CERT_DIALOG_GLOBAL_ENTER", "1").strip() != "0"
    )
    global_enter_delay = max(
        0.0, float(os.environ.get("ADN_CERT_DIALOG_GLOBAL_DELAY", "6") or "6")
    )
    global_enter_max = max(
        1, int(os.environ.get("ADN_CERT_DIALOG_GLOBAL_MAX", "4") or "4")
    )
    global_enter_interval = max(
        0.5,
        float(os.environ.get("ADN_CERT_DIALOG_GLOBAL_INTERVAL_SEC", "3") or "3"),
    )

    started_at = time.time()
    last_diag = 0.0
    seen_hwnd: set[int] = set()
    clicks = 0
    last_global_enter = 0.0
    global_enter_count = 0

    print(
        f"[cert-dialog-clicker] watcher iniciado "
        f"(needles={_DIALOG_TITLE_NEEDLES}, "
        f"global_enter={'on' if global_enter_enabled else 'off'}, "
        f"global_delay={global_enter_delay}s, max_clicks={max_clicks}).",
        flush=True,
    )

    while not stop_event.is_set() and clicks < max_clicks:
        top = _enum_top_level(win32gui_mod)

        # ---- Camada 1 + 2: procurar diálogo por título ----
        targets: list[tuple[int, str, str, str]] = []
        chrome_top: list[tuple[int, str, str]] = []
        for hwnd, title, cls in top:
            if _title_matches_cert_dialog(title):
                targets.append((hwnd, title, cls, "top-level"))
                continue
            if _is_chrome_window(cls, title):
                chrome_top.append((hwnd, title, cls))
                for chwnd, ctitle, ccls in _enum_children(win32gui_mod, hwnd):
                    if _title_matches_cert_dialog(ctitle):
                        targets.append((chwnd, ctitle, ccls, f"child of {hwnd}"))

        # ---- Diagnóstico periódico ----
        now = time.time()
        if (now - last_diag) >= diag_interval:
            last_diag = now
            sample = ", ".join(
                f"hwnd={h} cls={c!r} title={t!r}"
                for h, t, c in chrome_top[:6]
            )
            print(
                f"[cert-dialog-clicker] diag top_level={len(top)} "
                f"chrome_or_nfse={len(chrome_top)} cert_matches={len(targets)} "
                f"clicks={clicks} sample=[{sample}]",
                flush=True,
            )

        # ---- Camadas 1 + 2: ENTER directo nos hwnd com título ----
        for hwnd, title, cls, origin in targets:
            if hwnd in seen_hwnd:
                continue
            seen_hwnd.add(hwnd)
            print(
                f"[cert-dialog-clicker] alvo encontrado origem={origin} hwnd={hwnd} "
                f"cls={cls!r} title={title!r}",
                flush=True,
            )
            if _post_enter(win32gui_mod, win32con_mod, hwnd):
                clicks += 1
                print(
                    f"[cert-dialog-clicker] PostMessage ENTER → hwnd={hwnd} (clicks={clicks})",
                    flush=True,
                )
            # Reforço com input global, alguns Chromium descartam PostMessage.
            if _global_enter(win32api_mod, win32con_mod, win32gui_mod, hwnd):
                clicks += 1
                print(
                    f"[cert-dialog-clicker] keybd_event ENTER (foco hwnd={hwnd}) (clicks={clicks})",
                    flush=True,
                )

        # ---- Camada 3: foreground fallback ----
        # Quando o título do diálogo NÃO é exposto pela API Win32 (Chromium for
        # Testing), enviamos ENTER global enquanto o foreground for o Chrome.
        # Limitado a `ADN_CERT_DIALOG_GLOBAL_MAX` cliques (default 4) para não
        # interferir com a navegação após login (acções subsequentes não
        # esperam ENTER global).
        if (
            global_enter_enabled
            and not targets
            and clicks < max_clicks
            and global_enter_count < global_enter_max
            and (now - started_at) >= global_enter_delay
            and (now - last_global_enter) >= global_enter_interval
        ):
            try:
                fg_hwnd = win32gui_mod.GetForegroundWindow()
            except Exception:
                fg_hwnd = 0
            if fg_hwnd:
                fg_cls = _safe_get_class(win32gui_mod, fg_hwnd)
                fg_title = _safe_get_title(win32gui_mod, fg_hwnd)
                if _is_chrome_window(fg_cls, fg_title):
                    last_global_enter = now
                    if _global_enter(
                        win32api_mod, win32con_mod, win32gui_mod, fg_hwnd
                    ):
                        clicks += 1
                        global_enter_count += 1
                        print(
                            f"[cert-dialog-clicker] foreground keybd_event ENTER "
                            f"(fg_hwnd={fg_hwnd} cls={fg_cls!r} title={fg_title!r}) "
                            f"(global={global_enter_count}/{global_enter_max} "
                            f"clicks={clicks})",
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

    win32api_mod, _, win32gui_mod = _import_pywin32()
    if win32gui_mod is None or win32api_mod is None:
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
    t = threading.Thread(
        target=_watcher_loop, args=(stop, max_clicks), daemon=True
    )
    t.start()

    def _stop() -> None:
        stop.set()
        t.join(timeout=1.0)

    return _stop

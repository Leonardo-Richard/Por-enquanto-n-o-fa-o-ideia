"""Testes unitários do módulo download_engine (sanitização e categorias)."""

from __future__ import annotations

import unittest

from download_engine import (
    infer_failure_category_from_exception,
    map_exit_and_stderr_to_category,
    sanitize_user_safe_detail,
)


class TestSanitize(unittest.TestCase):
    def test_strips_unc_paths(self) -> None:
        raw = r"falha em \\servidor\share\pastas\file.xml"
        out = sanitize_user_safe_detail(raw)
        self.assertNotIn("servidor", out.lower())
        self.assertIn("[path]", out.lower())

    def test_truncates(self) -> None:
        long_text = "x" * 600
        self.assertLessEqual(len(sanitize_user_safe_detail(long_text, max_len=100)), 100)


class TestCategories(unittest.TestCase):
    def test_stderr_prefix_session(self) -> None:
        self.assertEqual(
            map_exit_and_stderr_to_category(99, "STDERR_CAT_SESSION falhou login"),
            "session",
        )

    def test_exit_12_extension(self) -> None:
        self.assertEqual(map_exit_and_stderr_to_category(12, ""), "extension")

    def test_timeout_exception(self) -> None:
        self.assertEqual(
            infer_failure_category_from_exception(TimeoutError("timeout")),
            "timeout",
        )

    def test_infer_portal_http_503(self) -> None:
        self.assertEqual(
            infer_failure_category_from_exception(RuntimeError("HTTP 503 from gateway")),
            "portal",
        )

    def test_infer_portal_portuguese(self) -> None:
        self.assertEqual(
            infer_failure_category_from_exception(RuntimeError("Portal indisponível")),
            "portal",
        )


if __name__ == "__main__":
    unittest.main()

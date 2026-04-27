import { test, expect } from "@playwright/test";

/**
 * Smoke mínimo: página pública + login (sem DB não valida fluxo completo).
 * Com DATABASE_URL + migrações + utilizador de teste, expandir para fluxo LER-08.
 */
test.describe("@smoke", () => {
  test("site público responde", async ({ page }) => {
    await page.goto("/");
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
  });

  test("página de login visível", async ({ page }) => {
    await page.goto("/login");
    await expect(page.getByRole("heading", { name: "Entrar" })).toBeVisible();
  });
});

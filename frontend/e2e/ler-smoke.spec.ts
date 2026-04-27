import { test, expect } from "@playwright/test";

/**
 * Fluxo LER-08: registo → nova empresa → painel → utilizadores (admin).
 * Ative com PLAYWRIGHT_LER_SMOKE=1 e Postgres + migrações + servidor em 3000.
 */
const runLerSmoke =
  process.env.PLAYWRIGHT_LER_SMOKE === "1" ||
  process.env.PLAYWRIGHT_LER_SMOKE === "true";

test.describe("@smoke LER fluxo crítico", () => {
  test.skip(
    !runLerSmoke,
    "defina PLAYWRIGHT_LER_SMOKE=1 (e DATABASE_URL + app em execução) para este teste",
  );

  test("registo → nova empresa → painel → utilizadores", async ({ page }) => {
    const suffix = `${Date.now()}_${Math.floor(Math.random() * 1e6)}`;
    const email = `ler_e2e_${suffix}@example.com`;
    const password = "SenhaE2E-8chars";

    await page.goto("/registo");
    await expect(page.getByRole("heading", { name: "Criar conta" })).toBeVisible();

    await page.getByLabel("Nome").fill("Utilizador E2E");
    await page.getByLabel("E-mail").fill(email);
    await page.getByLabel("Senha", { exact: true }).fill(password);
    await page.getByRole("button", { name: "Registar" }).click();

    await page.waitForURL(/\/empresas/, { timeout: 30_000 });

    await page.getByRole("link", { name: "Nova empresa" }).click();
    await expect(page.getByRole("heading", { name: "Nova empresa" })).toBeVisible();

    await page.locator("#cnpj").click();
    await page.locator("#cnpj").fill("");
    await page.locator("#cnpj").pressSequentially("11222333000181", { delay: 15 });

    await page.getByLabel(/Nome fantasia/i).fill("Empresa E2E");
    await page.locator("#systemCode").fill("e2e-sistema");
    await page.getByRole("button", { name: /Salvar e abrir detalhes/i }).click();

    await page.waitForURL(/\/empresas\/[0-9a-f-]{36}/i, { timeout: 30_000 });

    const companyUrl = page.url();
    const companyId = companyUrl.match(/\/empresas\/([0-9a-f-]{36})/i)?.[1];
    expect(companyId).toBeTruthy();

    await page.goto("/dashboard");
    await expect(page.getByRole("heading", { name: "Painel" })).toBeVisible();

    await page.goto(`/empresas/${companyId}/usuarios`);
    await expect(page.getByRole("heading", { name: "Utilizadores" })).toBeVisible();
  });
});

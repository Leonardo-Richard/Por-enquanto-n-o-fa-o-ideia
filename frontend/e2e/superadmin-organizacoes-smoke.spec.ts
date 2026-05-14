import { test, expect } from "@playwright/test";
import postgres from "postgres";

/**
 * SORG-06 AC7 / aviso FR50 (fluxo browser).
 * - Teste sem env: redirecionamento para login (sempre executável em CI).
 * - Fluxo completo: `PLAYWRIGHT_SUPERADMIN_ORG_SMOKE=1` + `DATABASE_URL` + app em 3000 (promove utilizador recém-registado via SQL).
 */
const runSuperadminOrgFlow =
  process.env.PLAYWRIGHT_SUPERADMIN_ORG_SMOKE === "1" ||
  process.env.PLAYWRIGHT_SUPERADMIN_ORG_SMOKE === "true";

test.describe("superadmin — organizações (smoke)", () => {
  test("sem sessão: /admin/organizacoes envia para início de sessão", async ({ page }) => {
    await page.goto("/admin/organizacoes");
    await expect(page).toHaveURL(/\/login/);
  });

  /**
   * SMEM-06 AC3 — evidência de redireccionamento real (302 → /dashboard) para não-superadmin autenticado.
   */
  test("utilizador autenticado sem superadmin: /admin/organizacoes vai para /dashboard", async ({ page }) => {
    test.skip(
      !process.env.DATABASE_URL?.trim(),
      "DATABASE_URL necessário (registo persiste utilizador na BD)",
    );
    const suffix = `${Date.now()}_${Math.floor(Math.random() * 1e6)}`;
    const email = `admin_gate_norm_${suffix}@example.com`;
    const password = "SenhaE2E-8chars";

    await page.goto("/registo");
    await expect(page.getByRole("heading", { name: "Criar conta" })).toBeVisible();

    await page.getByLabel("Nome").fill("E2E Admin Gate Norm");
    await page.getByLabel("E-mail").fill(email);
    await page.getByLabel("Senha", { exact: true }).fill(password);
    await page.getByRole("checkbox", { name: /Política de privacidade/i }).check();
    await page.getByRole("button", { name: "Registar" }).click();

    await page.waitForURL(/\/empresas/, { timeout: 30_000 });

    await page.goto("/admin/organizacoes");
    await expect(page).toHaveURL(/\/dashboard/, { timeout: 15_000 });
  });

  test("fluxo: registo → superadmin na BD → criar org → aviso FR50 → Acessar agora → painel", async ({
    page,
  }) => {
    test.skip(
      !runSuperadminOrgFlow || !process.env.DATABASE_URL,
      "defina PLAYWRIGHT_SUPERADMIN_ORG_SMOKE=1 e DATABASE_URL (e servidor Next em execução)",
    );

    const suffix = `${Date.now()}_${Math.floor(Math.random() * 1e6)}`;
    const email = `sorg_e2e_${suffix}@example.com`;
    const password = "SenhaE2E-8chars";

    await page.goto("/registo");
    await expect(page.getByRole("heading", { name: "Criar conta" })).toBeVisible();

    await page.getByLabel("Nome").fill("E2E Superadmin Org");
    await page.getByLabel("E-mail").fill(email);
    await page.getByLabel("Senha", { exact: true }).fill(password);
    await page.getByRole("checkbox", { name: /Política de privacidade/i }).check();
    await page.getByRole("button", { name: "Registar" }).click();

    await page.waitForURL(/\/empresas/, { timeout: 30_000 });

    const sql = postgres(process.env.DATABASE_URL!, { max: 1, prepare: false });
    try {
      await sql`UPDATE "user" SET "isSuperadmin" = true WHERE email = ${email}`;
    } finally {
      await sql.end({ timeout: 5 });
    }

    await page.context().clearCookies();
    await page.goto("/login");
    await page.getByLabel("E-mail").fill(email);
    await page.getByLabel("Senha").fill(password);
    await page.getByRole("button", { name: "Continuar" }).click();
    await page.waitForURL(/\/(dashboard|empresas)/, { timeout: 30_000 });

    await page.goto("/admin/organizacoes");
    await expect(page.getByRole("heading", { name: "Organizações" })).toBeVisible({ timeout: 20_000 });

    await page.getByRole("button", { name: "Nova organização" }).click();
    await expect(page.getByRole("heading", { name: "Nova organização" })).toBeVisible();
    await page.getByLabel("Nome da organização").fill(`Org E2E ${suffix}`);
    await page.getByRole("button", { name: "Criar organização" }).click();

    await expect(page.getByText(/administrador local vinculado/i)).toBeVisible({ timeout: 20_000 });
    await page.getByRole("button", { name: "Acessar agora" }).click();
    await expect(page).toHaveURL(/\/dashboard/, { timeout: 25_000 });
  });
});

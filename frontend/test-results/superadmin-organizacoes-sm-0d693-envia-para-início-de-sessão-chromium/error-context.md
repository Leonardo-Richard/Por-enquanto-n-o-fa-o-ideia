# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: superadmin-organizacoes-smoke.spec.ts >> superadmin — organizações (smoke) >> sem sessão: /admin/organizacoes envia para início de sessão
- Location: e2e\superadmin-organizacoes-smoke.spec.ts:14:7

# Error details

```
Error: expect(page).toHaveURL(expected) failed

Expected pattern: /\/login/
Received string:  "http://127.0.0.1:3010/admin/organizacoes"
Timeout: 5000ms

Call log:
  - Expect "toHaveURL" with timeout 5000ms
    9 × unexpected value "http://127.0.0.1:3010/admin/organizacoes"

```

# Test source

```ts
  1  | import { test, expect } from "@playwright/test";
  2  | import postgres from "postgres";
  3  | 
  4  | /**
  5  |  * SORG-06 AC7 / aviso FR50 (fluxo browser).
  6  |  * - Teste sem env: redirecionamento para login (sempre executável em CI).
  7  |  * - Fluxo completo: `PLAYWRIGHT_SUPERADMIN_ORG_SMOKE=1` + `DATABASE_URL` + app em 3000 (promove utilizador recém-registado via SQL).
  8  |  */
  9  | const runSuperadminOrgFlow =
  10 |   process.env.PLAYWRIGHT_SUPERADMIN_ORG_SMOKE === "1" ||
  11 |   process.env.PLAYWRIGHT_SUPERADMIN_ORG_SMOKE === "true";
  12 | 
  13 | test.describe("superadmin — organizações (smoke)", () => {
  14 |   test("sem sessão: /admin/organizacoes envia para início de sessão", async ({ page }) => {
  15 |     await page.goto("/admin/organizacoes");
> 16 |     await expect(page).toHaveURL(/\/login/);
     |                        ^ Error: expect(page).toHaveURL(expected) failed
  17 |   });
  18 | 
  19 |   /**
  20 |    * SMEM-06 AC3 — evidência de redireccionamento real (302 → /dashboard) para não-superadmin autenticado.
  21 |    */
  22 |   test("utilizador autenticado sem superadmin: /admin/organizacoes vai para /dashboard", async ({ page }) => {
  23 |     test.skip(
  24 |       !process.env.DATABASE_URL?.trim(),
  25 |       "DATABASE_URL necessário (registo persiste utilizador na BD)",
  26 |     );
  27 |     const suffix = `${Date.now()}_${Math.floor(Math.random() * 1e6)}`;
  28 |     const email = `admin_gate_norm_${suffix}@example.com`;
  29 |     const password = "SenhaE2E-8chars";
  30 | 
  31 |     await page.goto("/registo");
  32 |     await expect(page.getByRole("heading", { name: "Criar conta" })).toBeVisible();
  33 | 
  34 |     await page.getByLabel("Nome").fill("E2E Admin Gate Norm");
  35 |     await page.getByLabel("E-mail").fill(email);
  36 |     await page.getByLabel("Senha", { exact: true }).fill(password);
  37 |     await page.getByRole("button", { name: "Registar" }).click();
  38 | 
  39 |     await page.waitForURL(/\/empresas/, { timeout: 30_000 });
  40 | 
  41 |     await page.goto("/admin/organizacoes");
  42 |     await expect(page).toHaveURL(/\/dashboard/, { timeout: 15_000 });
  43 |   });
  44 | 
  45 |   test("fluxo: registo → superadmin na BD → criar org → aviso FR50 → Acessar agora → painel", async ({
  46 |     page,
  47 |   }) => {
  48 |     test.skip(
  49 |       !runSuperadminOrgFlow || !process.env.DATABASE_URL,
  50 |       "defina PLAYWRIGHT_SUPERADMIN_ORG_SMOKE=1 e DATABASE_URL (e servidor Next em execução)",
  51 |     );
  52 | 
  53 |     const suffix = `${Date.now()}_${Math.floor(Math.random() * 1e6)}`;
  54 |     const email = `sorg_e2e_${suffix}@example.com`;
  55 |     const password = "SenhaE2E-8chars";
  56 | 
  57 |     await page.goto("/registo");
  58 |     await expect(page.getByRole("heading", { name: "Criar conta" })).toBeVisible();
  59 | 
  60 |     await page.getByLabel("Nome").fill("E2E Superadmin Org");
  61 |     await page.getByLabel("E-mail").fill(email);
  62 |     await page.getByLabel("Senha", { exact: true }).fill(password);
  63 |     await page.getByRole("button", { name: "Registar" }).click();
  64 | 
  65 |     await page.waitForURL(/\/empresas/, { timeout: 30_000 });
  66 | 
  67 |     const sql = postgres(process.env.DATABASE_URL!, { max: 1, prepare: false });
  68 |     try {
  69 |       await sql`UPDATE "user" SET "isSuperadmin" = true WHERE email = ${email}`;
  70 |     } finally {
  71 |       await sql.end({ timeout: 5 });
  72 |     }
  73 | 
  74 |     await page.context().clearCookies();
  75 |     await page.goto("/login");
  76 |     await page.getByLabel("E-mail").fill(email);
  77 |     await page.getByLabel("Senha").fill(password);
  78 |     await page.getByRole("button", { name: "Continuar" }).click();
  79 |     await page.waitForURL(/\/(dashboard|empresas)/, { timeout: 30_000 });
  80 | 
  81 |     await page.goto("/admin/organizacoes");
  82 |     await expect(page.getByRole("heading", { name: "Organizações" })).toBeVisible({ timeout: 20_000 });
  83 | 
  84 |     await page.getByRole("button", { name: "Nova organização" }).click();
  85 |     await expect(page.getByRole("heading", { name: "Nova organização" })).toBeVisible();
  86 |     await page.getByLabel("Nome da organização").fill(`Org E2E ${suffix}`);
  87 |     await page.getByRole("button", { name: "Criar organização" }).click();
  88 | 
  89 |     await expect(page.getByText(/administrador local vinculado/i)).toBeVisible({ timeout: 20_000 });
  90 |     await page.getByRole("button", { name: "Acessar agora" }).click();
  91 |     await expect(page).toHaveURL(/\/dashboard/, { timeout: 25_000 });
  92 |   });
  93 | });
  94 | 
```
# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: ler-smoke.spec.ts >> LER smoke — público >> GET /api/health devolve ok
- Location: e2e\ler-smoke.spec.ts:41:7

# Error details

```
Error: expect(received).toBeTruthy()

Received: false
```

# Test source

```ts
  1   | import { test, expect } from "@playwright/test";
  2   | import { isValidCnpj } from "@repo/shared";
  3   | 
  4   | const WEIGHTS_1 = [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2] as const;
  5   | const WEIGHTS_2 = [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2] as const;
  6   | 
  7   | function checkDigit(digits: string, weights: readonly number[]): number {
  8   |   let sum = 0;
  9   |   for (let i = 0; i < weights.length; i++) {
  10  |     sum += parseInt(digits[i]!, 10) * weights[i]!;
  11  |   }
  12  |   const mod = sum % 11;
  13  |   return mod < 2 ? 0 : 11 - mod;
  14  | }
  15  | 
  16  | /** CNPJ válido aleatório (evita colisão em re-execuções locais com a mesma BD). */
  17  | function randomValidCnpjDigits(): string {
  18  |   for (let attempt = 0; attempt < 8000; attempt++) {
  19  |     let base = "";
  20  |     for (let j = 0; j < 12; j++) {
  21  |       base += Math.floor(Math.random() * 10).toString();
  22  |     }
  23  |     if (/^(\d)\1{11}$/.test(base)) {
  24  |       continue;
  25  |     }
  26  |     const d1 = checkDigit(base, WEIGHTS_1);
  27  |     const d2 = checkDigit(base + String(d1), WEIGHTS_2);
  28  |     const full = base + String(d1) + String(d2);
  29  |     if (!/^(\d)\1{13}$/.test(full) && isValidCnpj(full)) {
  30  |       return full;
  31  |     }
  32  |   }
  33  |   throw new Error("Não foi possível gerar CNPJ válido para o smoke.");
  34  | }
  35  | 
  36  | const runFullFlow =
  37  |   (process.env.PLAYWRIGHT_LER_SMOKE === "1" || process.env.PLAYWRIGHT_LER_SMOKE === "true") &&
  38  |   Boolean(process.env.DATABASE_URL?.trim());
  39  | 
  40  | test.describe("LER smoke — público", () => {
  41  |   test("GET /api/health devolve ok", async ({ request }) => {
  42  |     const res = await request.get("/api/health");
> 43  |     expect(res.ok()).toBeTruthy();
      |                      ^ Error: expect(received).toBeTruthy()
  44  |     const body = (await res.json()) as { status?: string };
  45  |     expect(body.status).toBe("ok");
  46  |   });
  47  | 
  48  |   test("início e login carregam sem 5xx", async ({ page }) => {
  49  |     const home = await page.goto("/");
  50  |     expect(home?.status() ?? 0).toBeLessThan(500);
  51  |     await expect(page.getByText("Portal de Automação de NF").first()).toBeVisible();
  52  | 
  53  |     const login = await page.goto("/login");
  54  |     expect(login?.status()).toBeLessThan(500);
  55  |     await expect(page.getByRole("heading", { name: "Entrar" })).toBeVisible();
  56  |     await expect(page.getByRole("button", { name: "Continuar" })).toBeVisible();
  57  |   });
  58  | });
  59  | 
  60  | test.describe("LER smoke — fluxo crítico", () => {
  61  |   test("registo → empresa monitorada → utilizadores", async ({ page }) => {
  62  |     test.skip(
  63  |       !runFullFlow,
  64  |       "defina PLAYWRIGHT_LER_SMOKE=1 e DATABASE_URL (e servidor Next em execução)",
  65  |     );
  66  | 
  67  |     const suffix = `${Date.now()}_${Math.floor(Math.random() * 1e6)}`;
  68  |     const email = `ler_smoke_${suffix}@example.com`;
  69  |     const password = "SenhaE2E-8chars";
  70  |     const cnpjDigits = randomValidCnpjDigits();
  71  | 
  72  |     await page.goto("/registo");
  73  |     await expect(page.getByRole("heading", { name: "Criar conta" })).toBeVisible();
  74  | 
  75  |     await page.getByLabel("Nome").fill(`Smoke LER ${suffix}`);
  76  |     await page.getByLabel("E-mail").fill(email);
  77  |     await page.getByLabel("Senha", { exact: true }).fill(password);
  78  |     await page.getByRole("button", { name: "Registar" }).click();
  79  | 
  80  |     await page.waitForURL(/\/empresas/, { timeout: 45_000 });
  81  |     await expect(page.getByRole("heading", { name: "Escolha sua organização" })).toBeVisible({
  82  |       timeout: 25_000,
  83  |     });
  84  | 
  85  |     await page.getByRole("link", { name: "Nova empresa monitorada" }).click();
  86  |     await expect(page).toHaveURL(/\/empresas\/nova/);
  87  |     await expect(page.getByRole("heading", { name: "Empresas monitoradas" })).toBeVisible();
  88  | 
  89  |     await page.getByLabel("CNPJ").fill(cnpjDigits);
  90  |     await page.getByLabel(/Nome fantasia/i).fill(`Fantasia ${suffix}`);
  91  |     await page.getByLabel("Código do sistema").fill(`sys-${suffix}`);
  92  |     await page.getByRole("button", { name: "Salvar e abrir detalhes" }).click();
  93  | 
  94  |     await page.waitForURL(/\/empresas\/[0-9a-f-]{10,}/i, { timeout: 45_000 });
  95  | 
  96  |     await page.getByRole("link", { name: /Utilizadores/i }).click();
  97  |     await expect(page.getByRole("heading", { name: /Utilizadores/i })).toBeVisible({ timeout: 25_000 });
  98  |   });
  99  | });
  100 | 
```
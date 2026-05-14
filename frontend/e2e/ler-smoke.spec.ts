import { test, expect } from "@playwright/test";
import { isValidCnpj } from "@repo/shared";

const WEIGHTS_1 = [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2] as const;
const WEIGHTS_2 = [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2] as const;

function checkDigit(digits: string, weights: readonly number[]): number {
  let sum = 0;
  for (let i = 0; i < weights.length; i++) {
    sum += parseInt(digits[i]!, 10) * weights[i]!;
  }
  const mod = sum % 11;
  return mod < 2 ? 0 : 11 - mod;
}

/** CNPJ válido aleatório (evita colisão em re-execuções locais com a mesma BD). */
function randomValidCnpjDigits(): string {
  for (let attempt = 0; attempt < 8000; attempt++) {
    let base = "";
    for (let j = 0; j < 12; j++) {
      base += Math.floor(Math.random() * 10).toString();
    }
    if (/^(\d)\1{11}$/.test(base)) {
      continue;
    }
    const d1 = checkDigit(base, WEIGHTS_1);
    const d2 = checkDigit(base + String(d1), WEIGHTS_2);
    const full = base + String(d1) + String(d2);
    if (!/^(\d)\1{13}$/.test(full) && isValidCnpj(full)) {
      return full;
    }
  }
  throw new Error("Não foi possível gerar CNPJ válido para o smoke.");
}

const runFullFlow =
  (process.env.PLAYWRIGHT_LER_SMOKE === "1" || process.env.PLAYWRIGHT_LER_SMOKE === "true") &&
  Boolean(process.env.DATABASE_URL?.trim());

test.describe("LER smoke — público", () => {
  test("GET /api/health devolve ok", async ({ request }) => {
    const res = await request.get("/api/health");
    expect(res.ok()).toBeTruthy();
    const body = (await res.json()) as { status?: string };
    expect(body.status).toBe("ok");
  });

  test("início e login carregam sem 5xx", async ({ page }) => {
    const home = await page.goto("/");
    expect(home?.status() ?? 0).toBeLessThan(500);
    await expect(page.getByText("Portal de Automação de NF").first()).toBeVisible();

    const login = await page.goto("/login");
    expect(login?.status()).toBeLessThan(500);
    await expect(page.getByRole("heading", { name: "Entrar" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Continuar" })).toBeVisible();
  });
});

test.describe("LER smoke — fluxo crítico", () => {
  test("registo → empresa monitorada → utilizadores", async ({ page }) => {
    test.skip(
      !runFullFlow,
      "defina PLAYWRIGHT_LER_SMOKE=1 e DATABASE_URL (e servidor Next em execução)",
    );

    const suffix = `${Date.now()}_${Math.floor(Math.random() * 1e6)}`;
    const email = `ler_smoke_${suffix}@example.com`;
    const password = "SenhaE2E-8chars";
    const cnpjDigits = randomValidCnpjDigits();

    await page.goto("/registo");
    await expect(page.getByRole("heading", { name: "Criar conta" })).toBeVisible();

    await page.getByLabel("Nome").fill(`Smoke LER ${suffix}`);
    await page.getByLabel("E-mail").fill(email);
    await page.getByLabel("Senha", { exact: true }).fill(password);
    await page.getByRole("checkbox", { name: /Política de privacidade/i }).check();
    await page.getByRole("button", { name: "Registar" }).click();

    await page.waitForURL(/\/empresas/, { timeout: 45_000 });
    await expect(page.getByRole("heading", { name: "Escolha sua organização" })).toBeVisible({
      timeout: 25_000,
    });

    await page.getByRole("link", { name: "Nova empresa monitorada" }).click();
    await expect(page).toHaveURL(/\/empresas\/nova/);
    await expect(page.getByRole("heading", { name: "Empresas monitoradas" })).toBeVisible();

    await page.getByLabel("CNPJ").fill(cnpjDigits);
    await page.getByLabel(/Nome fantasia/i).fill(`Fantasia ${suffix}`);
    await page.getByLabel("Código do sistema").fill(`sys-${suffix}`);
    await page.getByRole("button", { name: "Salvar e abrir detalhes" }).click();

    await page.waitForURL(/\/empresas\/[0-9a-f-]{10,}/i, { timeout: 45_000 });

    await page.getByRole("link", { name: /Utilizadores/i }).click();
    await expect(page.getByRole("heading", { name: /Utilizadores/i })).toBeVisible({ timeout: 25_000 });
  });
});

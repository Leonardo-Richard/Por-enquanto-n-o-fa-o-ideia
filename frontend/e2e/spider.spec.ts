import { test, expect } from "@playwright/test";

/**
 * Percorre páginas HTML do mesmo origin (BFS a partir de `/` + sementes),
 * seguindo `a[href]` e falhando se alguma navegação principal devolver 5xx.
 * Não cobre rotas só acessíveis por POST ou por UI não ligada a `<a href>`.
 */
const SEED_PATHS = [
  "/",
  "/login",
  "/registo",
  "/recuperar",
  "/dashboard",
  "/empresas",
  "/empresas/nova",
  "/empresas-monitoradas",
  "/execucoes",
  "/configuracoes",
  "/admin/organizacoes",
];

const MAX_VISITS = 200;

const STATIC_EXT = new Set([
  "ico",
  "png",
  "jpg",
  "jpeg",
  "gif",
  "webp",
  "svg",
  "txt",
  "xml",
  "json",
  "webmanifest",
  "map",
  "woff",
  "woff2",
  "ttf",
  "eot",
  "css",
  "js",
]);

function pathnameLooksLikeStaticAsset(pathname: string): boolean {
  const seg = pathname.split("/").pop() ?? "";
  if (!seg.includes(".")) return false;
  const ext = seg.split(".").pop()?.toLowerCase() ?? "";
  return STATIC_EXT.has(ext);
}

function shouldSkipPath(pathname: string): boolean {
  if (pathname.startsWith("/_next")) return true;
  if (pathname.startsWith("/api")) return true;
  return pathnameLooksLikeStaticAsset(pathname);
}

function normalizeInternalHref(href: string, baseURL: string): string | null {
  if (href.startsWith("mailto:") || href.startsWith("tel:") || href.startsWith("javascript:")) {
    return null;
  }
  try {
    const resolved = new URL(href, baseURL);
    const base = new URL(baseURL);
    if (resolved.origin !== base.origin) return null;
    const withoutHash = `${resolved.pathname}${resolved.search}`;
    return withoutHash || "/";
  } catch {
    return null;
  }
}

test.describe("spider — site", () => {
  test("todas as URLs visitadas respondem sem 5xx", async ({ page, baseURL }) => {
    test.setTimeout(180_000);
    expect(baseURL).toBeTruthy();

    const visited = new Set<string>();
    const queue: string[] = [];
    const enqueue = (p: string) => {
      const pathOnly = p.split("#")[0];
      const pathname = pathOnly.split("?")[0];
      if (shouldSkipPath(pathname)) return;
      if (visited.has(pathOnly)) return;
      queue.push(pathOnly);
    };

    for (const s of SEED_PATHS) enqueue(s);

    const failures: { path: string; status: number | null }[] = [];

    while (queue.length > 0 && visited.size < MAX_VISITS) {
      const path = queue.shift()!;
      const pathname = path.split("?")[0];
      if (shouldSkipPath(pathname)) continue;
      if (visited.has(path)) continue;
      visited.add(path);

      const response = await page.goto(path, { waitUntil: "domcontentloaded" });
      const status = response?.status() ?? null;
      if (status !== null && status >= 500) {
        failures.push({ path, status });
        continue;
      }

      const hrefs = await page.$$eval(
        "a[href]",
        (anchors) =>
          anchors
            .map((a) => a.getAttribute("href"))
            .filter((h): h is string => typeof h === "string" && h.length > 0),
      );

      for (const href of hrefs) {
        const n = normalizeInternalHref(href, baseURL!);
        if (!n) continue;
        enqueue(n);
      }
    }

    expect(
      failures,
      `Respostas 5xx: ${failures.map((f) => `${f.path} → ${f.status}`).join("; ") || "(nenhuma)"}`,
    ).toEqual([]);
  });
});

/**
 * Spider HTTP do site (sem browser): GET em BFS, extrai href de <a>,
 * falha com exit 1 se alguma página HTML devolver status >= 500.
 *
 * Uso: SPIDER_BASE_URL=http://127.0.0.1:3000 node scripts/site-spider.mjs
 */

const BASE = process.env.SPIDER_BASE_URL ?? "http://127.0.0.1:3000";

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

function pathnameLooksLikeStaticAsset(pathname) {
  const seg = pathname.split("/").pop() ?? "";
  if (!seg.includes(".")) return false;
  const ext = seg.split(".").pop()?.toLowerCase() ?? "";
  return STATIC_EXT.has(ext);
}

function shouldSkipPath(pathname) {
  if (pathname.startsWith("/_next")) return true;
  if (pathname.startsWith("/api")) return true;
  return pathnameLooksLikeStaticAsset(pathname);
}

function normalizeInternalHref(href, origin) {
  if (!href || href.startsWith("mailto:") || href.startsWith("tel:") || href.startsWith("javascript:")) {
    return null;
  }
  try {
    const resolved = new URL(href, origin);
    if (resolved.origin !== new URL(origin).origin) return null;
    return `${resolved.pathname}${resolved.search}` || "/";
  } catch {
    return null;
  }
}

function extractAnchorHrefs(html) {
  const out = [];
  const re = /<a\b[^>]*\bhref\s*=\s*["']([^"']+)["'][^>]*>/gi;
  let m;
  while ((m = re.exec(html)) !== null) out.push(m[1]);
  return out;
}

async function main() {
  const origin = new URL(BASE).origin;
  const visited = new Set();
  const queue = [];
  const failures = [];

  const enqueue = (p) => {
    const pathOnly = p.split("#")[0];
    const pathname = pathOnly.split("?")[0];
    if (shouldSkipPath(pathname)) return;
    if (visited.has(pathOnly)) return;
    queue.push(pathOnly);
  };

  for (const s of SEED_PATHS) enqueue(s);

  while (queue.length > 0 && visited.size < MAX_VISITS) {
    const path = queue.shift();
    const pathname = path.split("?")[0];
    if (shouldSkipPath(pathname)) continue;
    if (visited.has(path)) continue;
    visited.add(path);

    const url = `${origin}${path.startsWith("/") ? path : `/${path}`}`;
    let res;
    try {
      res = await fetch(url, {
        redirect: "follow",
        headers: { Accept: "text/html,application/xhtml+xml" },
      });
    } catch (e) {
      failures.push({ path, status: null, error: String(e?.message ?? e) });
      continue;
    }

    if (res.status >= 500) {
      failures.push({ path, status: res.status });
      continue;
    }

    const ct = res.headers.get("content-type") ?? "";
    if (!ct.includes("text/html")) continue;

    const html = await res.text();
    for (const href of extractAnchorHrefs(html)) {
      const n = normalizeInternalHref(href, origin);
      if (n) enqueue(n);
    }
  }

  if (failures.length > 0) {
    console.error("Spider encontrou falhas:", JSON.stringify(failures, null, 2));
    process.exit(1);
  }

  console.log(`Spider OK — ${visited.size} URLs visitadas (base ${origin}).`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});

import { readFileSync, existsSync } from "node:fs";
import { join } from "node:path";

function loadEnvFile(p) {
  if (!existsSync(p)) return {};
  const out = {};
  for (const line of readFileSync(p, "utf8").split("\n")) {
    const t = line.trim();
    if (!t || t.startsWith("#")) continue;
    const i = t.indexOf("=");
    if (i < 1) continue;
    const k = t.slice(0, i).trim();
    let v = t.slice(i + 1).trim();
    if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) {
      v = v.slice(1, -1);
    }
    out[k] = v;
  }
  return out;
}

const root = process.cwd();
const merged = {
  ...loadEnvFile(join(root, ".env")),
  ...loadEnvFile(join(root, "apps", "web", ".env.local")),
};
const db = merged.DATABASE_URL;
const h = merged.ADN_WORKER_HMAC_SECRET;
console.log("DATABASE_URL", db ? "set" : "MISSING");
console.log("ADN_WORKER_HMAC_SECRET", h && String(h).length ? `set (len ${String(h).length})` : "MISSING_OR_EMPTY");

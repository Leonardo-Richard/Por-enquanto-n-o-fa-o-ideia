/**
 * Descobre o host Session pooler (5432) que aceita o tenant do projeto.
 * Executar na raiz do monorepo: npm run probe:pooler -w web
 */
import fs from "node:fs";
import path from "node:path";
import postgres from "postgres";

function loadRootEnv() {
  let dir = process.cwd();
  for (let i = 0; i < 14; i++) {
    const f = path.join(dir, ".env");
    if (fs.existsSync(f)) {
      const text = fs.readFileSync(f, "utf8");
      for (const raw of text.split(/\r?\n/)) {
        const line = raw.trim();
        if (!line || line.startsWith("#")) continue;
        const eq = line.indexOf("=");
        if (eq === -1) continue;
        const k = line.slice(0, eq).trim();
        let v = line.slice(eq + 1).trim();
        if (
          (v.startsWith('"') && v.endsWith('"')) ||
          (v.startsWith("'") && v.endsWith("'"))
        ) {
          v = v.slice(1, -1);
        }
        process.env[k] = v;
      }
    }
    const parent = path.dirname(dir);
    if (parent === dir) break;
    dir = parent;
  }
}

function sessionPoolerUrl({ ref, password, host }) {
  const u = new URL("postgresql://x:y@placeholder:5432/postgres");
  u.username = `postgres.${ref}`;
  u.password = password;
  u.hostname = host;
  u.port = "5432";
  u.pathname = "/postgres";
  u.searchParams.set("sslmode", "require");
  return u.toString();
}

loadRootEnv();

const supa = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
const refMatch = supa.match(/https:\/\/([a-z0-9-]+)\.supabase\.co/i);
const ref = refMatch?.[1];
const dbUrl = process.env.DATABASE_URL || "";

if (!ref) {
  console.error("NEXT_PUBLIC_SUPABASE_URL em falta ou inválido no .env.");
  process.exit(1);
}

let normalized = dbUrl.trim();
if (!normalized) {
  console.error("DATABASE_URL em falta no .env (usa password para testar).");
  process.exit(1);
}
if (normalized.startsWith("postgres://")) {
  normalized = "postgresql://" + normalized.slice("postgres://".length);
}

let password = "";
try {
  const parsed = new URL(normalized);
  password = decodeURIComponent(parsed.password || "");
} catch {
  console.error("DATABASE_URL não é uma URI válida.");
  process.exit(1);
}

if (!password) {
  console.error("Não foi possível ler a password a partir de DATABASE_URL.");
  process.exit(1);
}

const regionSlugs = [
  "us-east-1",
  "us-east-2",
  "us-west-1",
  "us-west-2",
  "sa-east-1",
  "eu-west-1",
  "eu-west-2",
  "eu-central-1",
  "eu-central-2",
  "ap-south-1",
  "ap-southeast-1",
  "ap-northeast-1",
  "ca-central-1",
];

/** O prefixo aws-0 vs aws-1 depende do projeto/branch — testar ambos. */
function poolerHostsForRegion(r) {
  return [
    `aws-0-${r}.pooler.supabase.com`,
    `aws-1-${r}.pooler.supabase.com`,
  ];
}

async function tryConnect(host) {
  const url = sessionPoolerUrl({ ref, password, host });
  const sql = postgres(url, {
    max: 1,
    prepare: false,
    connect_timeout: 6,
    idle_timeout: 2,
  });
  try {
    await sql`select 1 as ok`;
    return { ok: true, url };
  } catch (e) {
    const msg = e?.message || String(e);
    const short = msg.includes("Tenant")
      ? "tenant/região"
      : msg.slice(0, 72).replace(/\s+/g, " ");
    return { ok: false, short };
  } finally {
    try {
      await sql.end({ timeout: 2 });
    } catch {
      /* */
    }
  }
}

console.log(`Ref: ${ref}\nA testar Session pooler (5432)…\n`);

for (const r of regionSlugs) {
  for (const host of poolerHostsForRegion(r)) {
    const { ok, url, short } = await tryConnect(host);
    if (ok) {
      console.log(`Sucesso: ${host}\n\nCola no .env:\nDATABASE_URL=${url}\n`);
      process.exit(0);
    }
    console.log(`  ${host} → ${short}`);
  }
}

console.error(
  "\nNenhum pooler testado funcionou. No Supabase: Connect → Session pooler → copia a URI para DATABASE_URL.",
);
process.exit(1);

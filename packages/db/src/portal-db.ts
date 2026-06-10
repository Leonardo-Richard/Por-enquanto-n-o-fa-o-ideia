import { loadEnvConfig } from "@next/env";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { createDb, type Db } from "./client";
import {
  normalizePostgresUrl,
  resolveDatabaseUrlFromEnv,
} from "./resolve-database-url";

export {
  DATABASE_URL_FALLBACK_KEYS,
  databaseUrlFromComponents,
  parseDatabaseUrlForDiagnostics,
  resolveDatabaseUrlFromEnv,
  supabaseProjectRefFromPublicUrl,
} from "./resolve-database-url";

let triedLoadRootEnv = false;

function stripBom(s: string): string {
  return s.charCodeAt(0) === 0xfeff ? s.slice(1) : s;
}

function stripQuotes(s: string): string {
  const t = s.trim();
  if (t.length >= 2) {
    if (t.startsWith('"') && t.endsWith('"')) return t.slice(1, -1);
    if (t.startsWith("'") && t.endsWith("'")) return t.slice(1, -1);
  }
  return t;
}

/** Sem depender de `loadEnvConfig` (Turbopack/worker pode não atualizar `process.env`). */
function parseDatabaseUrlFromEnvFileContent(content: string): string | undefined {
  const text = stripBom(content);
  for (const rawLine of text.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#")) continue;
    const eq = line.indexOf("=");
    if (eq === -1) continue;
    const key = line.slice(0, eq).trim();
    if (key !== "DATABASE_URL") continue;
    const value = stripQuotes(line.slice(eq + 1));
    if (value) return value;
  }
  return undefined;
}

/** Diretório mais próximo do cwd (para cima) que define `DATABASE_URL` em `.env` / `.env.local`. */
function readDatabaseUrlFromDisk(): string | undefined {
  let dir = process.cwd();
  for (let i = 0; i < 16; i++) {
    let levelUrl: string | undefined;
    for (const basename of [".env", ".env.local"] as const) {
      const file = path.join(dir, basename);
      if (!existsSync(file)) continue;
      try {
        const parsed = parseDatabaseUrlFromEnvFileContent(readFileSync(file, "utf8"));
        if (parsed?.trim()) levelUrl = parsed.trim();
      } catch {
        /* ficheiro bloqueado ou inválido */
      }
    }
    if (levelUrl) return levelUrl;
    const parent = path.dirname(dir);
    if (parent === dir) break;
    dir = parent;
  }
  return undefined;
}

function tryLoadEnvFromMonorepo() {
  if (resolveDatabaseUrlFromEnv(process.env) || triedLoadRootEnv) return;
  triedLoadRootEnv = true;
  if (process.env.NODE_ENV === "production") return;
  const dev = true;
  let dir = process.cwd();
  for (let i = 0; i < 16; i++) {
    for (const basename of [".env", ".env.local"] as const) {
      const file = path.join(dir, basename);
      if (existsSync(file)) {
        loadEnvConfig(dir, dev);
        break;
      }
    }
    const parent = path.dirname(dir);
    if (parent === dir) break;
    dir = parent;
  }
}

export function requireDatabaseUrl(): string {
  tryLoadEnvFromMonorepo();
  let url = resolveDatabaseUrlFromEnv(process.env)?.url;
  if (!url && process.env.NODE_ENV !== "production") {
    url = readDatabaseUrlFromDisk();
    if (url) {
      process.env["DATABASE_URL"] = url;
    }
  }
  if (!url) {
    throw new Error(
      "DATABASE_URL não definido. Use PORTAL_DATABASE_URL, DATABASE_URL ou SUPABASE_DB_PASSWORD + SUPABASE_DB_HOST (+ NEXT_PUBLIC_SUPABASE_URL).",
    );
  }
  const trimmed = normalizePostgresUrl(url);
  if (/^https?:\/\//i.test(trimmed)) {
    throw new Error(
      "DATABASE_URL não pode ser https://… (URL do projeto). No Supabase use a URI Postgres: postgresql://… (Connection string → Transaction pooler ou Session).",
    );
  }
  return trimmed;
}

const instanceCache = new Map<string, ReturnType<typeof createDb>>();

/**
 * Cliente Drizzle singleton por app (frontend vs backend) sem duplicar resolução de `DATABASE_URL`.
 */
export function createPortalDbAccessor(cacheKey: string): {
  getDbInstance: () => ReturnType<typeof createDb>;
  getDb: () => Db;
} {
  function getDbInstance() {
    let instance = instanceCache.get(cacheKey);
    if (!instance) {
      instance = createDb(requireDatabaseUrl());
      instanceCache.set(cacheKey, instance);
    }
    return instance;
  }

  return {
    getDbInstance,
    getDb: () => getDbInstance().db,
  };
}

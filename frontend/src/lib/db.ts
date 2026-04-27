import { createDb } from "@repo/db";
import { loadEnvConfig } from "@next/env";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";

declare global {
  // eslint-disable-next-line no-var
  var __portalDb: ReturnType<typeof createDb> | undefined;
}

let triedLoadRootEnv = false;

function databaseUrlFromEnv(): string | undefined {
  return process.env["DATABASE_URL"];
}

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
  if (databaseUrlFromEnv() || triedLoadRootEnv) return;
  triedLoadRootEnv = true;
  const dev = process.env.NODE_ENV !== "production";
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

function requireDatabaseUrl(): string {
  tryLoadEnvFromMonorepo();
  let url = databaseUrlFromEnv()?.trim();
  if (!url) {
    url = readDatabaseUrlFromDisk();
    if (url) {
      process.env["DATABASE_URL"] = url;
    }
  }
  if (!url) {
    throw new Error(
      "DATABASE_URL não definido (nem em process.env nem em .env/.env.local acessível a partir do cwd).",
    );
  }
  const trimmed = url.trim();
  if (/^https?:\/\//i.test(trimmed)) {
    throw new Error(
      "DATABASE_URL não pode ser https://… (URL do projeto). No Supabase use a URI Postgres: postgresql://… (Connection string → Transaction pooler ou Session).",
    );
  }
  return trimmed;
}

export function getDbInstance() {
  if (!globalThis.__portalDb) {
    globalThis.__portalDb = createDb(requireDatabaseUrl());
  }
  return globalThis.__portalDb;
}

export function getDb() {
  return getDbInstance().db;
}

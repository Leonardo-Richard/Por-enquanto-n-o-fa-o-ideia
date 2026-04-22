import { createDb } from "@repo/db";

declare global {
  // eslint-disable-next-line no-var
  var __portalDb: ReturnType<typeof createDb> | undefined;
}

function requireDatabaseUrl(): string {
  const url = process.env.DATABASE_URL;
  if (!url) {
    throw new Error("DATABASE_URL não definido");
  }
  return url;
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

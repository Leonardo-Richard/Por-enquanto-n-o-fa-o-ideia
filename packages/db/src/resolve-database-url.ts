/** Ordem de precedência — componentes Supabase e `PORTAL_DATABASE_URL` antes de `DATABASE_URL` genérica (Easypanel injecta a última). */
export const DATABASE_URL_FALLBACK_KEYS = ["DATABASE_URL", "POSTGRES_URL", "POSTGRESQL_URL"] as const;

export type DatabaseUrlEnvKey =
  | "PORTAL_DATABASE_URL"
  | (typeof DATABASE_URL_FALLBACK_KEYS)[number]
  | "SUPABASE_DB_COMPONENTS";

export function supabaseProjectRefFromPublicUrl(url: string | undefined): string | undefined {
  if (!url?.trim()) return undefined;
  const match = url.trim().match(/https:\/\/([a-z0-9-]+)\.supabase\.co/i);
  return match?.[1];
}

/** Monta URI a partir de variáveis separadas (password isolada — menos erros de copy/paste no painel). */
export function databaseUrlFromComponents(env: NodeJS.ProcessEnv): string | undefined {
  const password = env["SUPABASE_DB_PASSWORD"]?.trim();
  if (!password) return undefined;

  const ref =
    env["SUPABASE_PROJECT_REF"]?.trim() ||
    supabaseProjectRefFromPublicUrl(env["NEXT_PUBLIC_SUPABASE_URL"]) ||
    supabaseProjectRefFromPublicUrl(env["SUPABASE_URL"]);

  const user = env["SUPABASE_DB_USER"]?.trim() || (ref ? `postgres.${ref}` : undefined);
  const host = env["SUPABASE_DB_HOST"]?.trim();
  if (!user || !host) return undefined;

  const port = env["SUPABASE_DB_PORT"]?.trim() || "5432";
  const database = env["SUPABASE_DB_NAME"]?.trim() || "postgres";
  const poolerMode = env["SUPABASE_DB_POOLER"]?.trim()?.toLowerCase();

  const userEnc = encodeURIComponent(user);
  const passEnc = encodeURIComponent(password);
  let url = `postgresql://${userEnc}:${passEnc}@${host}:${port}/${database}?sslmode=require`;
  if (poolerMode === "transaction") {
    url += "&pgbouncer=true";
  }
  return url;
}

export function resolveDatabaseUrlFromEnv(
  env: NodeJS.ProcessEnv,
): { url: string; source: DatabaseUrlEnvKey } | undefined {
  const portal = env["PORTAL_DATABASE_URL"]?.trim();
  if (portal) return { url: portal, source: "PORTAL_DATABASE_URL" };

  const composed = databaseUrlFromComponents(env);
  if (composed) return { url: composed, source: "SUPABASE_DB_COMPONENTS" };

  for (const key of DATABASE_URL_FALLBACK_KEYS) {
    const value = env[key]?.trim();
    if (value) return { url: value, source: key };
  }
  return undefined;
}

export function normalizePostgresUrl(url: string): string {
  const trimmed = url.trim();
  if (trimmed.startsWith("postgres://")) {
    return `postgresql://${trimmed.slice("postgres://".length)}`;
  }
  return trimmed;
}

export function parseDatabaseUrlForDiagnostics(
  url: string,
): { host: string; user: string; port: string; database: string } | undefined {
  try {
    const parsed = new URL(normalizePostgresUrl(url));
    return {
      host: parsed.hostname,
      user: decodeURIComponent(parsed.username),
      port: parsed.port || "5432",
      database: parsed.pathname.replace(/^\//, "") || "postgres",
    };
  } catch {
    return undefined;
  }
}

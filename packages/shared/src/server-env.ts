import { z } from "zod";

const nodeEnvSchema = z.enum(["development", "production", "test"]);

const nodeEnvField = z.preprocess(
  (v) => (v === "" || v === undefined ? "development" : v),
  nodeEnvSchema,
);

const optionalNonEmptyString = z.preprocess(
  (v) => (typeof v === "string" && v.trim() === "" ? undefined : v),
  z.string().min(1).optional(),
);

const serverEnvSchema = z.object({
  NODE_ENV: nodeEnvField,
  DATABASE_URL: optionalNonEmptyString,
  BETTER_AUTH_SECRET: optionalNonEmptyString,
  BETTER_AUTH_URL: optionalNonEmptyString,
  BETTER_AUTH_TRUSTED_ORIGINS: optionalNonEmptyString,
  NEXT_PUBLIC_APP_URL: optionalNonEmptyString,
  API_INTERNAL_URL: optionalNonEmptyString,
  API_BASE_URL: optionalNonEmptyString,
  ADN_WORKER_HMAC_SECRET: optionalNonEmptyString,
  READINESS_SECRET: optionalNonEmptyString,
  CRON_SECRET: optionalNonEmptyString,
});

export type ServerEnv = z.infer<typeof serverEnvSchema>;

let cached: ServerEnv | undefined;

/** Ambiente servidor validado (lazy). Não substitui `requireDatabaseUrl` — só tipa/leitura segura. */
export function getServerEnv(): ServerEnv {
  if (!cached) {
    const parsed = serverEnvSchema.safeParse(process.env);
    if (!parsed.success) {
      const msg = parsed.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`).join("; ");
      throw new Error(`Variáveis de ambiente inválidas: ${msg}`);
    }
    cached = parsed.data;
  }
  return cached;
}

/** Reinicia cache (testes). */
export function resetServerEnvCache(): void {
  cached = undefined;
}

export function requireBetterAuthSecretInProduction(): string {
  const env = getServerEnv();
  const secret = env.BETTER_AUTH_SECRET;
  if (env.NODE_ENV === "production") {
    if (!secret || secret.length < 32) {
      throw new Error("BETTER_AUTH_SECRET deve ter pelo menos 32 caracteres em produção");
    }
    return secret;
  }
  return secret ?? "dev-dev-dev-dev-dev-dev-dev-dev-12-3456-7890-abcd";
}

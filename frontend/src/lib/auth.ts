import * as schema from "@repo/db";
import { APIError } from "better-auth";
import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { nextCookies } from "better-auth/next-js";
import { ALLOWED_LEGAL_DOCUMENT_VERSIONS } from "./legal-documents";
import { getDb } from "./db";

const allowedLegalDocumentVersions = new Set<string>(ALLOWED_LEGAL_DOCUMENT_VERSIONS);

function getBaseUrl(): string {
  return (
    process.env.BETTER_AUTH_URL ??
    process.env.NEXT_PUBLIC_APP_URL ??
    "http://localhost:3000"
  );
}

/** Origem normalizada (scheme + host + port) para `trustedOrigins` do Better Auth. */
function toTrustedOrigin(raw: string): string | null {
  const t = raw.trim().replace(/\/+$/, "");
  if (!t) return null;
  try {
    return new URL(t).origin;
  } catch {
    return null;
  }
}

/**
 * Better Auth exige que o header `Origin` do browser esteja nesta lista.
 * Usa `BETTER_AUTH_URL`, `NEXT_PUBLIC_APP_URL` e opcionalmente `BETTER_AUTH_TRUSTED_ORIGINS`
 * (URLs ou origens separadas por vírgula) — evita 403 «Invalid origin» quando só uma env
 * coincide com o domínio real (ex.: EasyPanel vs URL antiga).
 */
function getTrustedOrigins(): string[] {
  const extra = process.env.BETTER_AUTH_TRUSTED_ORIGINS?.trim() ?? "";
  const pieces: string[] = [
    process.env.BETTER_AUTH_URL?.trim() ?? "",
    process.env.NEXT_PUBLIC_APP_URL?.trim() ?? "",
    ...(extra ? extra.split(",").map((s) => s.trim()) : []),
  ];
  const origins = new Set<string>();
  for (const p of pieces) {
    const o = toTrustedOrigin(p);
    if (o) origins.add(o);
  }
  const fallback = toTrustedOrigin(getBaseUrl());
  if (fallback) origins.add(fallback);
  return origins.size > 0 ? [...origins] : ["http://localhost:3000"];
}

function getSecret(): string {
  const s = process.env.BETTER_AUTH_SECRET;
  if (process.env.NODE_ENV === "production") {
    if (!s || s.length < 32) {
      throw new Error("BETTER_AUTH_SECRET deve ter pelo menos 32 caracteres");
    }
    return s;
  }
  return s ?? "dev-dev-dev-dev-dev-dev-dev-dev-12-3456-7890-abcd";
}

function buildAuth() {
  return betterAuth({
    database: drizzleAdapter(getDb(), {
      provider: "pg",
      schema: {
        user: schema.user,
        session: schema.session,
        account: schema.account,
        verification: schema.verification,
      },
    }),
    baseURL: getBaseUrl(),
    secret: getSecret(),
    trustedOrigins: getTrustedOrigins(),
    emailAndPassword: {
      enabled: true,
      minPasswordLength: 8,
      sendResetPassword: async ({ user, url }) => {
        if (process.env.NODE_ENV === "development") {
          console.info("[recuperar-senha]", user.email, url);
        }
      },
    },
    user: {
      additionalFields: {
        isSuperadmin: {
          type: "boolean",
          required: false,
          defaultValue: false,
          input: false,
        },
        legalDocumentVersion: {
          type: "string",
          required: true,
          input: true,
          transform: {
            input: (value: unknown) => {
              const trimmed = typeof value === "string" ? value.trim() : "";
              if (!allowedLegalDocumentVersions.has(trimmed)) {
                throw APIError.from("BAD_REQUEST", {
                  message:
                    "É necessário aceitar a política de privacidade e os termos na versão actual para criar conta.",
                  code: "LEGAL_DOCUMENT_VERSION_INVALID",
                });
              }
              return trimmed;
            },
          },
        },
      },
    },
    session: {
      additionalFields: {
        activeCompanyId: {
          type: "string",
          required: false,
          input: false,
        },
        activeOrganizationId: {
          type: "string",
          required: false,
          input: false,
        },
      },
    },
    plugins: [nextCookies()],
  });
}

type AuthInstance = ReturnType<typeof buildAuth>;

let authSingleton: AuthInstance | undefined;

function getAuthInstance(): AuthInstance {
  if (!authSingleton) {
    authSingleton = buildAuth();
  }
  return authSingleton;
}

/** Lazy: só liga à base quando a primeira operação de auth é pedida (FR3 / SB-01). */
export const auth = new Proxy({} as AuthInstance, {
  has(_target, prop) {
    // `toNextJsHandler` faz `'handler' in auth ? auth.handler(request) : auth(request)`.
    // O alvo vazio faria `handler` parecer ausente e o código chamaria `auth()` (erro).
    // Não chamar getAuthInstance() aqui: preserva lazy init e evita exigir DATABASE_URL
    // só por causa do operador `in`.
    if (prop === "handler") return true;
    return prop in (getAuthInstance() as object);
  },
  get(_target, prop, receiver) {
    const inst = getAuthInstance();
    const value = Reflect.get(inst as object, prop, receiver) as unknown;
    if (typeof value === "function") {
      return (value as (...args: unknown[]) => unknown).bind(inst);
    }
    return value;
  },
});

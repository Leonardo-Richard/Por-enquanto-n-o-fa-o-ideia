import * as schema from "@repo/db";
import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { nextCookies } from "better-auth/next-js";
import { getDb } from "./db";

function getBaseUrl(): string {
  return (
    process.env.BETTER_AUTH_URL ??
    process.env.NEXT_PUBLIC_APP_URL ??
    "http://localhost:3000"
  );
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
    trustedOrigins: [getBaseUrl()],
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

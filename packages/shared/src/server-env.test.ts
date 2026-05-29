import { afterEach, describe, expect, it } from "vitest";
import {
  getServerEnv,
  requireBetterAuthSecretInProduction,
  resetServerEnvCache,
} from "./server-env";

describe("server-env", () => {
  afterEach(() => {
    resetServerEnvCache();
  });

  it("normaliza strings vazias e aplica default NODE_ENV", () => {
    process.env.NODE_ENV = "";
    process.env.BETTER_AUTH_URL = "";
    const env = getServerEnv();
    expect(env.NODE_ENV).toBe("development");
    expect(env.BETTER_AUTH_URL).toBeUndefined();
  });

  it("exige BETTER_AUTH_SECRET longo em produção", () => {
    process.env.NODE_ENV = "production";
    process.env.BETTER_AUTH_SECRET = "curto";
    expect(() => requireBetterAuthSecretInProduction()).toThrow(/32 caracteres/);
  });

  it("permite segredo de desenvolvimento fora de produção", () => {
    process.env.NODE_ENV = "development";
    delete process.env.BETTER_AUTH_SECRET;
    expect(requireBetterAuthSecretInProduction()).toContain("dev-dev");
  });
});

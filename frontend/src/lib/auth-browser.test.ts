import { afterEach, describe, expect, it, vi } from "vitest";
import { signInEmail } from "./auth-browser";

describe("signInEmail", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("propaga mensagem de erro em formato jsonError", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: false,
        json: async () => ({
          error: { code: "invalid", message: "E-mail ou senha incorretos." },
        }),
      }),
    );

    const r = await signInEmail("a@b.com", "wrong");
    expect(r).toEqual({
      ok: false,
      message: "E-mail ou senha incorretos.",
    });
  });
});

import { describe, expect, it } from "vitest";
import { parseOpsWindowMinutes } from "@/server/api/v1/handlers/ops-aggregates";

describe("parseOpsWindowMinutes", () => {
  it("default 60", () => {
    expect(parseOpsWindowMinutes(new URLSearchParams())).toBe(60);
  });

  it("aceita windowMinutes e limita 5–1440", () => {
    expect(parseOpsWindowMinutes(new URLSearchParams("windowMinutes=15"))).toBe(15);
    expect(parseOpsWindowMinutes(new URLSearchParams("windowMinutes=3"))).toBe(5);
    expect(parseOpsWindowMinutes(new URLSearchParams("windowMinutes=99999"))).toBe(24 * 60);
  });

  it("aceita alias window", () => {
    expect(parseOpsWindowMinutes(new URLSearchParams("window=90"))).toBe(90);
  });
});

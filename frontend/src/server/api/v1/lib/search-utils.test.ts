import { describe, expect, it } from "vitest";
import { sanitizeIlikeFragment, strongerRole } from "./search-utils";

describe("search-utils", () => {
  it("sanitizeIlikeFragment remove wildcards ILIKE", () => {
    expect(sanitizeIlikeFragment("  foo%bar_baz\\x  ")).toBe("foobarbazx");
  });

  it("strongerRole devolve o papel mais permissivo", () => {
    expect(strongerRole("user", "admin")).toBe("admin");
    expect(strongerRole(null, "user")).toBe("user");
    expect(strongerRole(undefined, null)).toBe(null);
  });
});

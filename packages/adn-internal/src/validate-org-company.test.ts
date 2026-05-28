import { describe, expect, it } from "vitest";
import { assertOrgCompanyAdnEnabled } from "./validate-org-company";

describe("assertOrgCompanyAdnEnabled", () => {
  it("é função exportada", () => {
    expect(typeof assertOrgCompanyAdnEnabled).toBe("function");
  });
});

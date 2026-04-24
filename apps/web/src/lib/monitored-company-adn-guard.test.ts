import { describe, expect, it } from "vitest";
import { shouldOfferAdnSyncForRow } from "./monitored-company-adn-guard";

describe("shouldOfferAdnSyncForRow (NFR29 / AC9)", () => {
  const org = "11111111-1111-1111-1111-111111111111";

  it("true quando org activa coincide com a da empresa", () => {
    expect(shouldOfferAdnSyncForRow(org, org)).toBe(true);
  });

  it("false quando org activa difere", () => {
    expect(shouldOfferAdnSyncForRow(org, "22222222-2222-2222-2222-222222222222")).toBe(false);
  });

  it("false quando não há org activa (null)", () => {
    expect(shouldOfferAdnSyncForRow(null, org)).toBe(false);
  });

  it("false quando não há org activa (undefined)", () => {
    expect(shouldOfferAdnSyncForRow(undefined, org)).toBe(false);
  });
});

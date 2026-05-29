import { describe, expect, it } from "vitest";
import {
  adnSyncJobStatusSchema,
  adnSyncJobTriggerSchema,
  mapAdnJobTriggerToDisplay,
} from "./adn-job-types";

describe("adn-job-types", () => {
  it("aceita valores alinhados ao CHECK SQL", () => {
    expect(adnSyncJobStatusSchema.parse("queued")).toBe("queued");
    expect(adnSyncJobTriggerSchema.parse("monthly")).toBe("monthly");
  });

  it("rejeita trigger desconhecido", () => {
    expect(() => adnSyncJobTriggerSchema.parse("signup")).toThrow();
  });

  it("mapAdnJobTriggerToDisplay converte scheduled para monthly", () => {
    expect(mapAdnJobTriggerToDisplay("scheduled")).toBe("monthly");
    expect(mapAdnJobTriggerToDisplay("manual")).toBe("manual");
  });
});

import { describe, expect, it } from "vitest";
import { executionTriggerLabel } from "./execution-display";

describe("executionTriggerLabel", () => {
  it("mensal não contém dia 1º", () => {
    const label = executionTriggerLabel("monthly");
    expect(label).not.toContain("dia 1º");
    expect(label.toLowerCase()).toContain("mensal");
  });

  it("preserva manual e signup", () => {
    expect(executionTriggerLabel("manual")).toBe("Manual");
    expect(executionTriggerLabel("signup")).toBe("Pós-cadastro");
  });
});

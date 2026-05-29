import { describe, expect, it } from "vitest";
import { mergeAdnJobSummary } from "./merge-job-summary";

describe("mergeAdnJobSummary", () => {
  it("preserva campos existentes ao adicionar lastArtifactId", () => {
    const merged = mergeAdnJobSummary(
      { phase: "completed", artifactsXml: 3 },
      { lastArtifactId: "art-1" },
    );
    expect(merged).toEqual({
      phase: "completed",
      artifactsXml: 3,
      lastArtifactId: "art-1",
    });
  });

  it("trata summary nulo ou inválido como objeto vazio", () => {
    expect(mergeAdnJobSummary(null, { lastArtifactId: "x" })).toEqual({ lastArtifactId: "x" });
    expect(mergeAdnJobSummary(["bad"], { lastArtifactId: "x" })).toEqual({ lastArtifactId: "x" });
  });
});

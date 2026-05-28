import type { AdnExecutionsOverviewResponse } from "@repo/shared";
import { apiFetch } from "@/lib/api-client";

export async function fetchAdnExecutionsOverview(
  organizationId: string,
): Promise<AdnExecutionsOverviewResponse> {
  const path = `/api/v1/organizations/${organizationId}/adn/executions-overview`;
  const res = await apiFetch(path, { credentials: "include" });
  if (!res.ok) {
    const t = await res.text();
    let message = "Não foi possível carregar o resumo de execuções.";
    try {
      const j = JSON.parse(t) as { message?: string };
      if (j.message) {
        message = j.message;
      }
    } catch {
      if (t) {
        message = t.slice(0, 200);
      }
    }
    throw new Error(message);
  }
  return (await res.json()) as AdnExecutionsOverviewResponse;
}

import { apiFetch } from "@/lib/api-client";

export type AdnRecentJobRow = {
  id: string;
  companyId: string;
  companyCnpjMasked: string;
  status: string;
  trigger: string;
  summary: Record<string, unknown> | null;
  createdAt: string;
  updatedAt: string;
};

export type AdnRecentJobsResponse = {
  jobs: AdnRecentJobRow[];
  nextCursor: string | null;
};

export async function fetchAdnRecentJobs(
  organizationId: string,
  options?: { limit?: number; cursor?: string | null },
): Promise<AdnRecentJobsResponse> {
  const params = new URLSearchParams();
  if (options?.limit) {
    params.set("limit", String(options.limit));
  }
  if (options?.cursor) {
    params.set("cursor", options.cursor);
  }
  const q = params.toString();
  const path = `/api/v1/organizations/${organizationId}/adn/recent-jobs${q ? `?${q}` : ""}`;
  const res = await apiFetch(path, { credentials: "include" });
  if (!res.ok) {
    const t = await res.text();
    let message = "Não foi possível carregar as execuções.";
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
  return (await res.json()) as AdnRecentJobsResponse;
}

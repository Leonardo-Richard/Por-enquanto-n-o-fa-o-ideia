/**
 * Cliente HTTP ADN (GET/POST sync) — fonte única para ficha e lista (NFR26).
 * IDs na URL devem vir sempre da API / props (NFR29).
 */

export type AdnSyncLastJob = {
  id: string;
  status: string;
  trigger: string;
  summary: Record<string, unknown> | null;
  createdAt: string;
  updatedAt: string;
};

export type AdnSyncGetResult =
  | { kind: "active"; lastJob: AdnSyncLastJob | null }
  | { kind: "feature_off" }
  | { kind: "forbidden" }
  | { kind: "error" };

export type AdnSyncPostResult =
  | { kind: "accepted" }
  | { kind: "forbidden"; message?: string }
  | { kind: "rate_limited"; retryAfter: string | null; message: string }
  | { kind: "other_error"; message: string };

const MAX_CONCURRENT_ADN_GETS = 3;
let adnGetInFlight = 0;
const adnGetWaitQueue: Array<() => void> = [];

function acquireAdnGetSlot(): Promise<void> {
  if (adnGetInFlight < MAX_CONCURRENT_ADN_GETS) {
    adnGetInFlight += 1;
    return Promise.resolve();
  }
  return new Promise<void>((resolve) => {
    adnGetWaitQueue.push(() => {
      adnGetInFlight += 1;
      resolve();
    });
  });
}

function releaseAdnGetSlot(): void {
  adnGetInFlight -= 1;
  const next = adnGetWaitQueue.shift();
  if (next) {
    next();
  }
}

export function buildAdnSyncSyncUrl(organizationId: string, companyId: string): string {
  return `/api/v1/organizations/${organizationId}/monitored-companies/${companyId}/adn/sync`;
}

export async function interpretAdnSyncGetResponse(res: Response): Promise<AdnSyncGetResult> {
  if (res.status === 404) {
    return { kind: "feature_off" };
  }
  if (res.status === 403) {
    return { kind: "forbidden" };
  }
  if (!res.ok) {
    return { kind: "error" };
  }
  const b = (await res.json()) as { lastJob: AdnSyncLastJob | null };
  return { kind: "active", lastJob: b.lastJob ?? null };
}

export async function interpretAdnSyncPostResponse(res: Response): Promise<AdnSyncPostResult> {
  if (res.status === 202) {
    return { kind: "accepted" };
  }
  if (res.status === 403) {
    const j = (await res.json().catch(() => null)) as { message?: string } | null;
    return { kind: "forbidden", message: j?.message };
  }
  if (res.status === 429) {
    const retry = res.headers.get("Retry-After");
    const j = (await res.json().catch(() => null)) as { message?: string } | null;
    const baseMsg =
      j?.message ?? "Serviço ocupado. Aguarde antes de voltar a pedir sincronização ADN.";
    return {
      kind: "rate_limited",
      retryAfter: retry,
      message: retry ? `${baseMsg} (tente novamente em ~${retry}s)` : baseMsg,
    };
  }
  const j = (await res.json().catch(() => null)) as { message?: string } | null;
  return { kind: "other_error", message: j?.message ?? "Não foi possível pedir a sincronização." };
}

export async function fetchAdnSyncStatus(
  organizationId: string,
  companyId: string,
  fetchFn: typeof fetch = fetch,
): Promise<AdnSyncGetResult> {
  await acquireAdnGetSlot();
  try {
    const r = await fetchFn(buildAdnSyncSyncUrl(organizationId, companyId), {
      credentials: "include",
    });
    return await interpretAdnSyncGetResponse(r);
  } finally {
    releaseAdnGetSlot();
  }
}

export async function postAdnSyncRequest(
  organizationId: string,
  companyId: string,
  idempotencyKey: string,
  fetchFn: typeof fetch = fetch,
): Promise<AdnSyncPostResult> {
  const r = await fetchFn(buildAdnSyncSyncUrl(organizationId, companyId), {
    method: "POST",
    credentials: "include",
    headers: {
      "Content-Type": "application/json",
      "Idempotency-Key": idempotencyKey,
    },
    body: JSON.stringify({}),
  });
  return interpretAdnSyncPostResponse(r);
}

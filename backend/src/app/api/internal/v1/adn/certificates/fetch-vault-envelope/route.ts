import { fetchVaultEnvelopeSchema, handleFetchVaultEnvelope } from "@repo/adn-internal";
import { adnHandlerToResponse } from "@/lib/adn-handler-response";
import { getDb } from "@/lib/db";
import { toPublicApiError } from "@/server/api/v1/lib/errors";
import { parseInternalAdnBody } from "@/server/api/internal/v1/adn/lib/parse-internal-adn";

export async function POST(request: Request) {
  try {
    const parsed = await parseInternalAdnBody(request, fetchVaultEnvelopeSchema);
    if (!parsed.ok) return parsed.response;

    const result = await handleFetchVaultEnvelope(getDb(), parsed.data);
    return adnHandlerToResponse(result);
  } catch (e) {
    return toPublicApiError(e);
  }
}

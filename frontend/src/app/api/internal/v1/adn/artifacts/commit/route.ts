import {
  commitArtifactSchema,
  handleCommitArtifact,
} from "@repo/adn-internal";
import {
  adnCommitVerifyStorageSha256,
  downloadAdnObjectBytes,
} from "@/lib/adn-storage";
import { adnHandlerToResponse } from "@/lib/adn-handler-response";
import { getDb } from "@/lib/db";
import { maybeForwardInternalApi } from "@/lib/internal-api-forward";
import { toPublicApiError } from "@/server/api/v1/lib/errors";
import { parseInternalAdnBody } from "@/server/api/internal/v1/adn/lib/parse-internal-adn";

export async function POST(request: Request) {
  try {
    const forwarded = await maybeForwardInternalApi(request);
    if (forwarded) return forwarded;

    const parsed = await parseInternalAdnBody(request, commitArtifactSchema);
    if (!parsed.ok) return parsed.response;

    const verifyStorage = adnCommitVerifyStorageSha256();
    const result = await handleCommitArtifact(getDb(), parsed.data, {
      downloadObjectBytes: verifyStorage
        ? async (_bucket, objectPath) => downloadAdnObjectBytes(objectPath)
        : undefined,
    });
    return adnHandlerToResponse(result);
  } catch (e) {
    return toPublicApiError(e);
  }
}

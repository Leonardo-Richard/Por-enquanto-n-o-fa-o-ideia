import { handlePrepareUpload, prepareUploadSchema } from "@repo/adn-internal";
import {
  adnStorageBucket,
  canonicalAdnObjectPath,
  createAdnPresignedPutUrl,
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

    const parsed = await parseInternalAdnBody(request, prepareUploadSchema);
    if (!parsed.ok) return parsed.response;

    const result = await handlePrepareUpload(getDb(), parsed.data, {
      storageBucket: adnStorageBucket(),
      canonicalObjectPath: canonicalAdnObjectPath,
      createPresignedPutUrl: createAdnPresignedPutUrl,
    });
    return adnHandlerToResponse(result);
  } catch (e) {
    return toPublicApiError(e);
  }
}

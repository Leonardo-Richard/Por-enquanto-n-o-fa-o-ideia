import { handlePatchJob, patchJobSchema } from "@repo/adn-internal";
import { z } from "zod";
import { insertAuditEvent } from "@/lib/audit";
import { adnHandlerToResponse } from "@/lib/adn-handler-response";
import { getDb } from "@/lib/db";
import { jsonError, toPublicApiError } from "@/server/api/v1/lib/errors";
import { parseInternalAdnBody } from "@/server/api/internal/v1/adn/lib/parse-internal-adn";

export async function PATCH(request: Request, ctx: { params: Promise<{ jobId: string }> }) {
  try {
    const { jobId } = await ctx.params;
    if (!z.string().uuid().safeParse(jobId).success) return jsonError(400, "jobId inválido.");

    const parsed = await parseInternalAdnBody(request, patchJobSchema);
    if (!parsed.ok) return parsed.response;

    const result = await handlePatchJob(getDb(), jobId, parsed.data, insertAuditEvent);
    return adnHandlerToResponse(result);
  } catch (e) {
    return toPublicApiError(e);
  }
}

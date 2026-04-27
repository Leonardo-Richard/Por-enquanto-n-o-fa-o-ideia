import { NextResponse } from "next/server";
import type { z } from "zod";
import { requireAdnWorkerSecret, verifyAdnWorkerHmacHeaders } from "@/lib/adn-hmac";
import {
  adnInternalIpRateKey,
  clientIpFromRequest,
  consumeAdnRateLimit,
  getAdnInternalRequestLimit,
} from "@/lib/adn-rate-limit";
import { adnJsonFromZodError } from "@/lib/adn-zod-response";
import { jsonError } from "@/server/api/v1/lib/errors";

const TS = "x-adn-timestamp";
const SIG = "x-adn-signature";

export async function parseInternalAdnBody<T extends z.ZodTypeAny>(
  request: Request,
  schema: T,
): Promise<
  | { ok: true; data: z.infer<T>; rawBody: Buffer }
  | { ok: false; response: NextResponse }
> {
  const secret = requireAdnWorkerSecret();
  if (!secret) {
    return { ok: false, response: jsonError(503, "Serviço ADN interno não configurado.") };
  }

  const rawText = await request.text();
  const rawBody = Buffer.from(rawText, "utf8");
  const ts = request.headers.get(TS) ?? request.headers.get(TS.toUpperCase());
  const sig = request.headers.get(SIG) ?? request.headers.get(SIG.toUpperCase());
  const v = verifyAdnWorkerHmacHeaders(secret, rawBody, ts, sig);
  if (!v.ok) {
    return { ok: false, response: jsonError(401, "Não autorizado.") };
  }

  const ip = clientIpFromRequest(request);
  const lim = getAdnInternalRequestLimit();
  const rl = consumeAdnRateLimit({
    key: adnInternalIpRateKey(ip),
    max: lim.max,
    windowMs: lim.windowMs,
  });
  if (!rl.ok) {
    const res = NextResponse.json(
      { message: "Demasiados pedidos internos ADN. Tente novamente mais tarde.", error_code: "ADN_RATE_LIMIT" },
      { status: 429 },
    );
    res.headers.set("Retry-After", String(rl.retryAfterSec));
    return { ok: false, response: res };
  }

  let json: unknown;
  try {
    json = rawText.length === 0 ? {} : JSON.parse(rawText);
  } catch {
    return {
      ok: false,
      response: NextResponse.json(
        { message: "JSON inválido.", error_code: "ADN_INVALID_JSON" },
        { status: 400 },
      ),
    };
  }

  const parsed = schema.safeParse(json);
  if (!parsed.success) {
    return {
      ok: false,
      response: adnJsonFromZodError(400, "Payload inválido.", "ADN_INVALID_PAYLOAD", parsed.error),
    };
  }

  return { ok: true, data: parsed.data, rawBody };
}

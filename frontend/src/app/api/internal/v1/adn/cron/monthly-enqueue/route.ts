import { timingSafeEqual } from "node:crypto";
import { eq, inArray } from "drizzle-orm";
import { NextResponse } from "next/server";
import {
  buildSchedMonthlyIdempotencyKey,
  decideMonthlyScheduledEnqueue,
  monthlyPeriodKeySp,
} from "@repo/scheduling";
import { adnSyncJobs, companies, organizations } from "@repo/db";
import { getDb } from "@/lib/db";

function unauthorized(): NextResponse {
  return NextResponse.json({ error: "unauthorized" }, { status: 401 });
}

function validateCronBearer(request: Request): NextResponse | null {
  const secret = process.env.CRON_SECRET?.trim();
  if (!secret) {
    console.error(
      JSON.stringify({
        scope: "cron_monthly_enqueue",
        error: "CRON_SECRET_missing",
      }),
    );
    return NextResponse.json({ error: "misconfigured" }, { status: 500 });
  }
  const authHeader = request.headers.get("authorization");
  const auth = typeof authHeader === "string" ? authHeader.trim() : "";
  const expected = `Bearer ${secret}`;
  const a = Buffer.from(auth, "utf8");
  const b = Buffer.from(expected, "utf8");
  if (a.length !== b.length || !timingSafeEqual(a, b)) {
    return unauthorized();
  }
  return null;
}

/** Cron deve sempre executar na função dinâmica (segredo + DB). */
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const authErr = validateCronBearer(request);
  if (authErr) {
    return authErr;
  }

  const db = getDb();
  const now = new Date();
  const periodKey = monthlyPeriodKeySp(now);

  const candidates = await db
    .select({
      companyId: companies.id,
      organizationId: companies.organizationId,
      monthlyRunDay: companies.monthlyRunDay,
      adnEnabled: organizations.adnSyncEnabled,
    })
    .from(companies)
    .innerJoin(organizations, eq(companies.organizationId, organizations.id))
    .where(eq(organizations.adnSyncEnabled, true));

  const candidateKeys = candidates.map((c) =>
    buildSchedMonthlyIdempotencyKey(c.companyId, periodKey),
  );

  const existingRows =
    candidateKeys.length > 0
      ? await db
          .select({ key: adnSyncJobs.idempotencyKey })
          .from(adnSyncJobs)
          .where(inArray(adnSyncJobs.idempotencyKey, candidateKeys))
      : [];

  const existingKeySet = new Set(
    existingRows.map((r) => r.key).filter((k): k is string => typeof k === "string" && k.length > 0),
  );

  let enqueued = 0;
  let skipped = 0;

  for (const row of candidates) {
    const monthlyKey = buildSchedMonthlyIdempotencyKey(row.companyId, periodKey);
    const existingKeys = new Set<string>();
    if (existingKeySet.has(monthlyKey)) {
      existingKeys.add(monthlyKey);
    }

    const decision = decideMonthlyScheduledEnqueue({
      now,
      companyId: row.companyId,
      monthlyRunDay: Number(row.monthlyRunDay),
      active: row.adnEnabled,
      existingKeys,
    });

    if (decision.action !== "enqueue") {
      skipped += 1;
      continue;
    }

    const inserted = await db
      .insert(adnSyncJobs)
      .values({
        organizationId: row.organizationId,
        companyId: row.companyId,
        status: "queued",
        trigger: "monthly",
        requestedByUserId: null,
        idempotencyKey: decision.idempotencyKey,
        summaryJson: {
          phase: "queued",
          message: "Agendamento mensal automático.",
          fetchMode: "incremental",
          scheduledFor: decision.scheduledForIso,
          periodKey: decision.periodKey,
        },
      })
      .onConflictDoNothing({ target: adnSyncJobs.idempotencyKey })
      .returning({ id: adnSyncJobs.id });

    if (inserted.length > 0) {
      enqueued += 1;
      existingKeySet.add(decision.idempotencyKey);
    } else {
      skipped += 1;
    }
  }

  return NextResponse.json(
    {
      ok: true,
      periodKey,
      enqueued,
      skipped,
      candidates: candidates.length,
      now: now.toISOString(),
    },
    { headers: { "Cache-Control": "no-store" } },
  );
}

export const POST = GET;

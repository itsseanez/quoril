// app/api/jobs/ingest/route.ts
//
// Called daily by Vercel cron (see vercel.json).
// Also callable manually: POST /api/jobs/ingest
// Protected by CRON_SECRET env var.
//
// Companies and their ATS identifiers are stored in the Company table.
// To add a new company: insert a row via `npx prisma studio` or the seed script.

import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { IngestionService } from "@/lib/ingestion/ingestion.service";
import { GreenhouseAdapter } from "@/lib/ingestion/adapters/greenhouse.adapter";
import { LeverAdapter } from "@/lib/ingestion/adapters/lever.adapter";
import { AshbyAdapter } from "@/lib/ingestion/adapters/ashby.adapter";
import { WorkdayAdapter } from "@/lib/ingestion/adapters/workday.adapter";
import { ATSAdapter } from "@/lib/ingestion/base.adapter";

// ── adapter factory ───────────────────────────────────────────────────────────

async function buildAdapters(): Promise<ATSAdapter[]> {
  const companies = await prisma.company.findMany({
    where: { isActive: true },
    orderBy: { name: "asc" },
  });

  if (companies.length === 0) {
    console.warn("[ingest] No active companies found in the database.");
  }

  const adapters: ATSAdapter[] = [];

  for (const c of companies) {
    if (c.greenhouseSlug) {
      adapters.push(
        new GreenhouseAdapter({
          companySlug: c.greenhouseSlug,
          companyName: c.name,
          boardSlug: c.greenhouseSlug,
        })
      );
    }

    if (c.leverSite) {
      adapters.push(
        new LeverAdapter({
          companySlug: c.leverSite,
          companyName: c.name,
          site: c.leverSite,
        })
      );
    }

    if (c.ashbyBoardId) {
      adapters.push(
        new AshbyAdapter({
          companySlug: c.ashbyBoardId,
          companyName: c.name,
          boardId: c.ashbyBoardId,
        })
      );
    }

    if (c.workdayTenant && c.workdayInstance && c.workdaySiteName) {
      adapters.push(
        new WorkdayAdapter({
          companySlug: c.workdayTenant,
          companyName: c.name,
          tenant: c.workdayTenant,
          instance: c.workdayInstance,
          siteName: c.workdaySiteName,
        })
      );
    }
  }

  return adapters;
}

// ── handlers ──────────────────────────────────────────────────────────────────

export async function POST(req: NextRequest) {
  // Verify cron secret
  const secret =
    req.headers.get("x-cron-secret") ??
    req.nextUrl.searchParams.get("secret");

  if (secret !== process.env.CRON_SECRET) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const adapters = await buildAdapters();

    if (adapters.length === 0) {
      return Response.json(
        { error: "No active companies configured. Add companies via prisma studio or the seed script." },
        { status: 400 }
      );
    }

    // Optionally scope to a single company for manual testing:
    // POST /api/jobs/ingest?secret=x&company=stripe
    const companyFilter = req.nextUrl.searchParams.get("company");
    const filtered = companyFilter
      ? adapters.filter((a) => a.sourceKey.includes(companyFilter))
      : adapters;

    if (filtered.length === 0) {
      return Response.json(
        { error: `No adapter found matching company: ${companyFilter}` },
        { status: 400 }
      );
    }

    const service = new IngestionService();
    const results = await service.runAll(filtered);

    const total = results.reduce((sum, r) => sum + r.upserted, 0);
    const totalErrors = results.reduce((sum, r) => sum + r.errors.length, 0);

    console.log(
      `[ingest] Done. Adapters: ${filtered.length}, Upserted: ${total}, Errors: ${totalErrors}`
    );

    return Response.json({ ok: true, results, total, totalErrors });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("[ingest] Unhandled error:", message);
    return Response.json({ error: message }, { status: 500 });
  }
}

// Allow GET for easy manual testing in the browser (still requires secret)
export async function GET(req: NextRequest) {
  return POST(req);
}
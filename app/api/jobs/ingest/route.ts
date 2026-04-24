// app/api/jobs/ingest/route.ts

import { NextRequest } from "next/server";
import { IngestionService } from "@/lib/ingestion/ingestion.service";
import { GreenhouseAdapter } from "@/lib/ingestion/adapters/greenhouse.adapter";
import { LeverAdapter } from "@/lib/ingestion/adapters/lever.adapter";
import { AshbyAdapter } from "@/lib/ingestion/adapters/ashby.adapter";

function buildAdapters() {
  const adapters = [];

  // Greenhouse companies — comma-separated slugs in env
  const ghSlugs = (process.env.GREENHOUSE_SLUGS ?? "").split(",").map(s => s.trim()).filter(Boolean);
  for (const slug of ghSlugs) {
    adapters.push(new GreenhouseAdapter({ companySlug: slug, boardSlug: slug }));
  }

  // Lever companies
  const leverSlugs = (process.env.LEVER_SLUGS ?? "").split(",").map(s => s.trim()).filter(Boolean);
  for (const slug of leverSlugs) {
    adapters.push(new LeverAdapter({ companySlug: slug, site: slug }));
  }

  // Ashby companies
  const ashbySlugs = (process.env.ASHBY_SLUGS ?? "").split(",").map(s => s.trim()).filter(Boolean);
  for (const slug of ashbySlugs) {
    adapters.push(new AshbyAdapter({ companySlug: slug, boardId: slug }));
  }

  return adapters;
}

export async function POST(req: NextRequest) {
  const secret = req.headers.get("x-cron-secret") ?? req.nextUrl.searchParams.get("secret");
  if (secret !== process.env.CRON_SECRET) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const adapters = buildAdapters();
  if (adapters.length === 0) {
    return Response.json({ error: "No adapters configured" }, { status: 400 });
  }

  const service = new IngestionService();
  const results = await service.runAll(adapters);

  const total = results.reduce((sum, r) => sum + r.upserted, 0);
  console.log(`[ingest] Done. Total upserted: ${total}`);

  return Response.json({ ok: true, results, total });
}

export const GET = POST;
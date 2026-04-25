import { Pool } from "pg";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@prisma/client";
import { IngestionService } from "../lib/ingestion/ingestion.service";
import { GreenhouseAdapter } from "../lib/ingestion/adapters/greenhouse.adapter";
import { LeverAdapter } from "../lib/ingestion/adapters/lever.adapter";
import { AshbyAdapter } from "../lib/ingestion/adapters/ashby.adapter";
import { ATSAdapter } from "../lib/ingestion/base.adapter";

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

async function buildAdapters(): Promise<ATSAdapter[]> {
  const companies = await prisma.company.findMany({
    where: { isActive: true },
    orderBy: { name: "asc" },
  });

  const adapters: ATSAdapter[] = [];

  for (const c of companies) {
    if (c.greenhouseSlug) {
      adapters.push(new GreenhouseAdapter({
        companySlug: c.greenhouseSlug,
        companyName: c.name,
        boardSlug: c.greenhouseSlug,
      }));
    }
    if (c.leverSite) {
      adapters.push(new LeverAdapter({
        companySlug: c.leverSite,
        companyName: c.name,
        site: c.leverSite,
      }));
    }
    if (c.ashbyBoardId) {
      adapters.push(new AshbyAdapter({
        companySlug: c.ashbyBoardId,
        companyName: c.name,
        boardId: c.ashbyBoardId,
      }));
    }
  }

  return adapters;
}

async function main() {
  const companyFilter = process.argv[2]; // e.g. `npm run ingest -- stripe`

  const allAdapters = await buildAdapters();

  const adapters = companyFilter
    ? allAdapters.filter((a) => a.sourceKey.includes(companyFilter))
    : allAdapters;

  if (adapters.length === 0) {
    console.error(
      companyFilter
        ? `No adapter found matching: ${companyFilter}`
        : "No active companies in database. Run npm run seed first."
    );
    process.exit(1);
  }

  console.log(`Running ${adapters.length} adapter(s)...`);

  const service = new IngestionService();
  const results = await service.runAll(adapters);

  console.table(
    results.map((r) => ({
      source:      r.source,
      company:     r.companySlug,
      fetched:     r.fetched,
      upserted:    r.upserted,
      skipped:     r.skipped,
      deactivated: r.deactivated,
      errors:      r.errors.length,
      ms:          r.durationMs,
    }))
  );

  const failed = results.filter((r) => r.errors.length > 0);
  if (failed.length > 0) {
    console.error("\nErrors:");
    failed.forEach((r) =>
      r.errors.forEach((e) => console.error(`  [${r.companySlug}] ${e}`))
    );
    process.exit(1);
  }
}

main()
  .catch((err) => { console.error(err); process.exit(1); })
  .finally(() => prisma.$disconnect());
// scripts/extract-skills.ts
//
// Backfill extracted skills for all active jobs that don't have them yet.
// Uses Groq API with exponential backoff to handle rate limits.
//
// Usage:
//   npm run extract-skills              — process all jobs missing skills
//   npm run extract-skills -- stripe    — process only jobs from a specific company

import { Pool } from "pg";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@prisma/client";
import { extractSkillsWithAI, extractSkills } from "../lib/ingestion/utils/skills";

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

const BATCH_SIZE = 3;    // 3 concurrent requests per batch
const DELAY_MS   = 2000; // 2s between batches — stays under Groq free tier (~30 req/min)

async function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function withRetry<T>(
  fn: () => Promise<T>,
  retries = 3,
  delayMs = 2000
): Promise<T> {
  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      return await fn();
    } catch (err) {
      const is429 =
        err instanceof Error &&
        (err.message.includes("429") || err.message.includes("rate limit"));

      if (is429 && attempt < retries) {
        const wait = delayMs * attempt; // 2s, 4s, 6s
        console.warn(
          `    Rate limited, retrying in ${wait}ms (attempt ${attempt}/${retries})`
        );
        await sleep(wait);
      } else {
        throw err;
      }
    }
  }
  throw new Error("Max retries exceeded");
}

async function main() {
  const companyFilter = process.argv[2]; // optional: target a single company

  const jobs = await prisma.job.findMany({
    where: {
      isActive: true,
      extractedSkills: { isEmpty: true },
      ...(companyFilter ? { company: { contains: companyFilter, mode: "insensitive" } } : {}),
    },
    select: { id: true, description: true, title: true, company: true },
    orderBy: { createdAt: "desc" },
  });

  console.log(
    companyFilter
      ? `Found ${jobs.length} jobs for "${companyFilter}" needing skill extraction`
      : `Found ${jobs.length} jobs needing skill extraction`
  );

  if (jobs.length === 0) {
    console.log("Nothing to do.");
    return;
  }

  let processed = 0;
  let usedFallback = 0;
  let failed = 0;

  for (let i = 0; i < jobs.length; i += BATCH_SIZE) {
    const batch = jobs.slice(i, i + BATCH_SIZE);

    await Promise.all(
      batch.map(async (job) => {
        try {
          const skills = await withRetry(() =>
            extractSkillsWithAI(job.description)
          );

          await prisma.job.update({
            where: { id: job.id },
            data: { extractedSkills: skills },
          });

          console.log(
            `  ✓ [${job.company}] ${job.title}\n    → [${skills.join(", ")}]`
          );
          processed++;
        } catch (err) {
          console.error(
            `  ✗ [${job.company}] ${job.title}:`,
            err instanceof Error ? err.message : err
          );

          // Fall back to static extraction so the field is never left empty
          try {
            const fallback = extractSkills(job.description);
            await prisma.job.update({
              where: { id: job.id },
              data: { extractedSkills: fallback },
            });
            console.log(
              `    ↩ Static fallback → [${fallback.join(", ")}]`
            );
            usedFallback++;
          } catch (fallbackErr) {
            console.error(
              `    ✗ Fallback also failed:`,
              fallbackErr instanceof Error ? fallbackErr.message : fallbackErr
            );
            failed++;
          }
        }
      })
    );

    const progress = Math.min(i + BATCH_SIZE, jobs.length);
    console.log(`\nProgress: ${progress}/${jobs.length}`);

    // Pause between batches to respect rate limits
    if (progress < jobs.length) await sleep(DELAY_MS);
  }

  console.log(`
Done.
  ✓ AI extraction:      ${processed}
  ↩ Static fallback:    ${usedFallback}
  ✗ Failed:             ${failed}
  Total:                ${jobs.length}
  `);
}

main()
  .catch((err) => {
    console.error("Unhandled error:", err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
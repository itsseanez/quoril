import { prisma } from "../lib/prisma";
import { extractSkillsWithAI } from "../lib/ingestion/utils/skills";

const BATCH_SIZE = 5;      // smaller batch = safer for rate limits
const DELAY_MS = 300;      // small spacing between requests

async function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// 🔁 retry wrapper for 429s / transient failures
async function withRetry<T>(
  fn: () => Promise<T>,
  retries = 3
): Promise<T> {
  try {
    return await fn();
  } catch (err: any) {
    const isRateLimit = err?.message?.includes("429");

    if (isRateLimit && retries > 0) {
      console.warn("Rate limited. Retrying in 1s...");
      await sleep(1000);
      return withRetry(fn, retries - 1);
    }

    throw err;
  }
}

async function main() {
  const jobs = await prisma.job.findMany({
    where: {
      extractedSkills: { isEmpty: true },
      isActive: true,
    },
    select: {
      id: true,
      description: true,
      title: true,
    },
    orderBy: {
      createdAt: "desc",
    },
  });

  console.log(`Found ${jobs.length} jobs needing skill extraction`);

  let processed = 0;
  let failed = 0;

  for (let i = 0; i < jobs.length; i += BATCH_SIZE) {
    const batch = jobs.slice(i, i + BATCH_SIZE);

    for (const job of batch) {
      try {
        const skills = await withRetry(() =>
          extractSkillsWithAI(job.description)
        );

        await prisma.job.update({
          where: { id: job.id },
          data: { extractedSkills: skills },
        });

        console.log(`✓ ${job.title} → [${skills.join(", ")}]`);
        processed++;

        await sleep(DELAY_MS);
      } catch (err) {
        console.error(`✗ ${job.title}:`, err);
        failed++;
      }
    }

    console.log(
      `Progress: ${Math.min(i + BATCH_SIZE, jobs.length)}/${jobs.length}`
    );
  }

  console.log(`\nDone. Processed: ${processed}, Failed: ${failed}`);
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
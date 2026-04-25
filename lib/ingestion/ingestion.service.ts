// lib/ingestion/ingestion.service.ts

import { prisma } from "@/lib/prisma";
import { ATSAdapter } from "./base.adapter";
import { NormalizedJob, IngestResult } from "./types";
import { extractSkills } from "./utils/skills";

export class IngestionService {
  /**
   * Run a single adapter, upsert results, return a structured result.
   */
  async runAdapter(adapter: ATSAdapter): Promise<IngestResult> {
    const start = Date.now();
    const errors: string[] = [];
    let fetched = 0, upserted = 0, skipped = 0, deactivated = 0;

    // Create an in-progress log row
    const runLog = await prisma.ingestionRun.create({
      data: { source: adapter.sourceKey, status: "running" },
    });

    try {
      const jobs = await adapter.fetchFiltered();
      fetched = jobs.length;

      // Upsert in batches of 50 to avoid overwhelming Prisma/Postgres
      const BATCH_SIZE = 50;
      for (let i = 0; i < jobs.length; i += BATCH_SIZE) {
        const batch = jobs.slice(i, i + BATCH_SIZE);
        const results = await Promise.allSettled(
          batch.map((job) => this.upsertJob(job))
        );

        for (const result of results) {
          if (result.status === "fulfilled") {
            upserted++;
          } else {
            errors.push(result.reason?.message ?? "Unknown upsert error");
            skipped++;
          }
        }
      }

      // Tombstone jobs that weren't seen this run
      deactivated = await this.tombstoneStaleJobs(
        adapter.sourceKey.split(":")[0], // "greenhouse"
        jobs.map((j) => j.sourceJobId)
      );

      await prisma.ingestionRun.update({
        where: { id: runLog.id },
        data: {
          status: errors.length > 0 ? "partial" : "success",
          jobsFetched: fetched,
          jobsUpserted: upserted,
          jobsSkipped: skipped,
          errors: errors.length > 0 ? errors : undefined,
          finishedAt: new Date(),
        },
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      errors.push(message);
      console.error(`[ingest] ${adapter.sourceKey} failed:`, message);

      await prisma.ingestionRun.update({
        where: { id: runLog.id },
        data: { status: "failed", errors, finishedAt: new Date() },
      });
    }

    return {
      source: adapter.sourceKey.split(":")[0],
      companySlug: adapter.sourceKey.split(":")[1],
      fetched,
      upserted,
      skipped,
      deactivated,
      errors,
      durationMs: Date.now() - start,
    };
  }

  /**
   * Run multiple adapters concurrently (with a concurrency cap).
   */
  async runAll(adapters: ATSAdapter[]): Promise<IngestResult[]> {
    const CONCURRENCY = 5; // don't hammer external APIs simultaneously
    const results: IngestResult[] = [];

    for (let i = 0; i < adapters.length; i += CONCURRENCY) {
      const batch = adapters.slice(i, i + CONCURRENCY);
      const batchResults = await Promise.allSettled(
        batch.map((a) => this.runAdapter(a))
      );
      for (const r of batchResults) {
        if (r.status === "fulfilled") results.push(r.value);
        // Failures are already logged inside runAdapter
      }
    }
    return results;
  }

  private async upsertJob(job: NormalizedJob): Promise<void> {
    const extractedSkills = extractSkills(job.description);

    await prisma.job.upsert({
      where: { sourceJobId: job.sourceJobId },
      create: {
        extractedSkills,
        sourceJobId: job.sourceJobId,
        title: job.title,
        company: job.company,
        companySlug: job.companySlug,
        location: job.location,
        remote: job.remote,
        description: job.description,
        descriptionHtml: job.descriptionHtml,
        applyUrl: job.applyUrl,
        source: job.source,
        postedAt: job.postedAt,
        employmentType: job.employmentType,
        seniorityLevel: job.seniorityLevel,
        department: job.department,
        rawData: job.rawData,
        isActive: true,
        firstSeenAt: new Date(),
        lastSeenAt: new Date(),
      },
      update: {
        extractedSkills,
        title: job.title,
        location: job.location,
        remote: job.remote,
        description: job.description,
        descriptionHtml: job.descriptionHtml,
        applyUrl: job.applyUrl,
        seniorityLevel: job.seniorityLevel,
        department: job.department,
        isActive: true,
        lastSeenAt: new Date(),
        // rawData intentionally not updated on every run — keep original for audit
      },
    });
  }

  /**
   * Mark jobs from a source as inactive if they weren't in the latest fetch.
   * Returns count of deactivated jobs.
   */
  private async tombstoneStaleJobs(
    source: string,
    seenIds: string[]
  ): Promise<number> {
    const result = await prisma.job.updateMany({
      where: {
        source,
        isActive: true,
        sourceJobId: { notIn: seenIds },
        // Only tombstone jobs that haven't been seen in 48h 
        // to avoid marking jobs inactive on flaky API responses
        lastSeenAt: { lt: new Date(Date.now() - 48 * 60 * 60 * 1000) },
      },
      data: { isActive: false },
    });
    return result.count;
  }
}
// lib/ingestion/adapters/greenhouse.adapter.ts

import { ATSAdapter } from "../base.adapter";
import { AdapterConfig } from "../types";
import { NormalizedJob, ATSSource } from "../types";
import { cleanDescription } from "../utils/html";
import { normalizeLocation } from "../utils/location";
import { deriveSeniority } from "../utils/seniority";

const GREENHOUSE_BASE = "https://boards-api.greenhouse.io/v1/boards";

interface GreenhouseJob {
  id: number;
  title: string;
  location: { name: string };
  content: string;
  absolute_url: string;
  departments: { name: string }[];
  offices: { name: string }[];
  updated_at: string;
}

interface GreenhouseConfig extends AdapterConfig {
  boardSlug: string;
}

export class GreenhouseAdapter extends ATSAdapter<GreenhouseConfig> {
  get sourceKey() {
    return `greenhouse:${this.config.companySlug}`;
  }

  async fetchJobs(): Promise<NormalizedJob[]> {
    const url = `${GREENHOUSE_BASE}/${this.config.boardSlug}/jobs?content=true`;

    const res = await fetch(url, {
      next: { revalidate: 0 },
      signal: AbortSignal.timeout(15_000),
    });

    if (!res.ok) {
      throw new Error(`Greenhouse fetch failed for ${this.config.boardSlug}: HTTP ${res.status}`);
    }

    const data = await res.json();
    const jobs: GreenhouseJob[] = data.jobs ?? [];

    return jobs.map((job) => this.normalize(job));
  }

  private normalize(job: GreenhouseJob): NormalizedJob {
    const rawLocation = job.location?.name ?? "";
    const { location, remote } = normalizeLocation(rawLocation);

    return {
      externalId: String(job.id),
      sourceJobId: `greenhouse-${job.id}`,
      source: "greenhouse" as ATSSource,
      title: job.title,
      company: this.config.companyName ?? this.config.companySlug,
      companySlug: this.config.companySlug,
      applyUrl: job.absolute_url,
      description: cleanDescription(job.content ?? ""),  // ← replaces the manual chain
      descriptionHtml: job.content ?? "",                // ← keep raw for storage/reprocessing
      location,
      remote,
      postedAt: job.updated_at ? new Date(job.updated_at) : null,
      employmentType: "full_time",
      seniorityLevel: deriveSeniority(job.title),
      department: job.departments?.[0]?.name ?? null,
      rawData: job as unknown as Record<string, unknown>,
    };
  }
}
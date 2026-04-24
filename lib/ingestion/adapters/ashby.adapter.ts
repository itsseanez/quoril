// lib/ingestion/adapters/ashby.adapter.ts

import { ATSAdapter, AdapterConfig } from "../base.adapter";
import { NormalizedJob, ATSSource } from "../types";
import { stripHtml } from "../utils/html";
import { normalizeLocation } from "../utils/location";
import { deriveSeniority } from "../utils/seniority";

// Ashby's public job board API
const ASHBY_BASE = "https://api.ashbyhq.com/posting-api/job-board";

interface AshbyJob {
  id: string;
  title: string;
  department?: { name: string };
  team?: { name: string };
  location?: { name: string };
  locationName?: string;
  applyUrl: string;
  jobUrl: string;
  descriptionHtml?: string;
  descriptionPlain?: string;
  employmentType?: string;
  isRemote?: boolean;
  publishedDate?: string;
}

interface AshbyConfig extends AdapterConfig {
  boardId: string; // Ashby organization handle
}

export class AshbyAdapter extends ATSAdapter<AshbyConfig> {
  get sourceKey() {
    return `ashby:${this.config.companySlug}`;
  }

  async fetchJobs(): Promise<NormalizedJob[]> {
    // Ashby returns all jobs in one response
    const url = `${ASHBY_BASE}/${this.config.boardId}`;
    const res = await fetch(url, {
      headers: { "Accept": "application/json" },
      signal: AbortSignal.timeout(15_000),
    });

    if (!res.ok) {
      throw new Error(`Ashby fetch failed for ${this.config.boardId}: HTTP ${res.status}`);
    }

    const data = await res.json();
    const jobs: AshbyJob[] = data.jobs ?? data.jobPostings ?? [];

    return jobs.map((job) => this.normalize(job));
  }

  private normalize(job: AshbyJob): NormalizedJob {
    const rawLocation = job.location?.name ?? job.locationName ?? "";
    const { location, remote: locationRemote } = normalizeLocation(rawLocation);
    const remote = locationRemote || job.isRemote === true;

    const description = job.descriptionPlain
      ? job.descriptionPlain.slice(0, 800)
      : stripHtml(job.descriptionHtml ?? "").slice(0, 800);

    return {
      externalId: job.id,
      sourceJobId: `ashby-${job.id}`,
      source: "ashby" as ATSSource,
      title: job.title,
      company: this.config.companyName ?? this.config.companySlug,
      companySlug: this.config.companySlug,
      applyUrl: job.applyUrl ?? job.jobUrl,
      description,
      descriptionHtml: job.descriptionHtml,
      location,
      remote,
      postedAt: job.publishedDate ? new Date(job.publishedDate) : null,
      employmentType: this.mapEmploymentType(job.employmentType),
      seniorityLevel: deriveSeniority(job.title),
      department: job.department?.name ?? job.team?.name ?? null,
      rawData: job as unknown as Record<string, unknown>,
    };
  }

  private mapEmploymentType(raw?: string) {
    if (!raw) return "full_time";
    const lower = raw.toLowerCase();
    if (lower.includes("part")) return "part_time";
    if (lower.includes("contract")) return "contract";
    if (lower.includes("intern")) return "internship";
    return "full_time";
  }
}
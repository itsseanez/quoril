// lib/ingestion/adapters/workday.adapter.ts

import { ATSAdapter, AdapterConfig } from "../base.adapter";
import { NormalizedJob, ATSSource } from "../types";
import { stripHtml } from "../utils/html";
import { normalizeLocation } from "../utils/location";
import { deriveSeniority } from "../utils/seniority";

interface WorkdayConfig extends AdapterConfig {
  tenant: string;   // e.g. "netflix"
  instance: string; // e.g. "wd5"
  siteName: string; // e.g. "Netflix_External_Career_Site"
}

interface WorkdayJob {
  id: string;
  title: string;
  locationsText?: string;
  timeType?: { descriptor: string };
  jobPostingId: string;
  externalUrl: string;
  jobDescription?: { content: string };
  postedOn?: string;
}

export class WorkdayAdapter extends ATSAdapter<WorkdayConfig> {
  get sourceKey() {
    return `workday:${this.config.companySlug}`;
  }

  async fetchJobs(): Promise<NormalizedJob[]> {
    const { tenant, instance, siteName } = this.config;
    const base = `https://${tenant}.${instance}.myworkdayjobs.com/wday/cxs/${tenant}/${siteName}/jobs`;

    const all: WorkdayJob[] = [];
    const LIMIT = 20;
    let offset = 0;

    while (true) {
      const res = await fetch(base, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ appliedFacets: {}, limit: LIMIT, offset, searchText: "" }),
        signal: AbortSignal.timeout(20_000),
      });

      if (!res.ok) throw new Error(`Workday fetch failed for ${tenant}: HTTP ${res.status}`);

      const data = await res.json();
      const jobs: WorkdayJob[] = data.jobPostings ?? [];
      all.push(...jobs);

      if (jobs.length < LIMIT) break; // last page
      offset += LIMIT;

      // Safety valve — Workday tenants can have thousands of postings
      if (offset > 5000) {
        console.warn(`[workday] ${tenant} hit 5000 job cap`);
        break;
      }
    }

    return all.map((j) => this.normalize(j));
  }

  private normalize(job: WorkdayJob): NormalizedJob {
    const rawLocation = job.locationsText ?? "";
    const { location, remote } = normalizeLocation(rawLocation);

    return {
      externalId: job.id,
      sourceJobId: `workday-${job.id}`,
      source: "workday" as ATSSource,
      title: job.title,
      company: this.config.companyName ?? this.config.companySlug,
      companySlug: this.config.companySlug,
      applyUrl: job.externalUrl,
      description: stripHtml(job.jobDescription?.content ?? "").slice(0, 800),
      descriptionHtml: job.jobDescription?.content,
      location,
      remote,
      postedAt: job.postedOn ? new Date(job.postedOn) : null,
      employmentType: "full_time",
      seniorityLevel: deriveSeniority(job.title),
      department: null,
      rawData: job as unknown as Record<string, unknown>,
    };
  }
}
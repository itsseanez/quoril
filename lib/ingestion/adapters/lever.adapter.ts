// lib/ingestion/adapters/lever.adapter.ts

import { ATSAdapter, AdapterConfig } from "../base.adapter";
import { NormalizedJob, ATSSource, EmploymentType } from "../types";
import { stripHtml } from "../utils/html";
import { normalizeLocation } from "../utils/location";
import { deriveSeniority } from "../utils/seniority";

// Lever's public postings API — no auth required
const LEVER_BASE = "https://api.lever.co/v0/postings";

interface LeverPosting {
  id: string;
  text: string;             // job title
  applyUrl: string;
  hostedUrl: string;
  createdAt: number;        // Unix ms
  categories: {
    commitment?: string;    // "Full-time", "Part-time", "Contract", etc.
    department?: string;
    location?: string;
    team?: string;
  };
  description: string;      // HTML
  descriptionPlain: string; // plain text (Lever provides this!)
  lists: { text: string; content: string }[];  // bullet sections
  additional: string;       // HTML "additional info" section
  workplaceType: "remote" | "hybrid" | "onsite" | "";
}

interface LeverConfig extends AdapterConfig {
  site: string; // Lever site slug, usually same as company name, e.g. "notion"
}

const LEVER_COMMITMENT_MAP: Record<string, EmploymentType> = {
  "full-time": "full_time",
  "part-time": "part_time",
  "contract": "contract",
  "internship": "internship",
  "intern": "internship",
};

export class LeverAdapter extends ATSAdapter<LeverConfig> {
  get sourceKey() {
    return `lever:${this.config.companySlug}`;
  }

  async fetchJobs(): Promise<NormalizedJob[]> {
    const jobs: LeverPosting[] = [];
    let offset: string | null = null;

    // Lever paginates with cursor-based offset
    while (true) {
      const params = new URLSearchParams({ limit: "250" });
      if (offset) params.set("offset", offset);
      
      const url = `${LEVER_BASE}/${this.config.site}?${params}`;
      const res = await fetch(url, { signal: AbortSignal.timeout(15_000) });

      if (!res.ok) {
        throw new Error(`Lever fetch failed for ${this.config.site}: HTTP ${res.status}`);
      }

      const data = await res.json();
      jobs.push(...(data.data ?? []));

      // Lever signals "no more pages" with hasNext: false
      if (!data.hasNext) break;
      offset = data.next ?? null;
      if (!offset) break;
    }

    return jobs.map((p) => this.normalize(p));
  }

  private normalize(posting: LeverPosting): NormalizedJob {
    const rawLocation = posting.categories?.location ?? "";
    const { location, remote: locationRemote } = normalizeLocation(rawLocation);
    const remote = locationRemote || posting.workplaceType === "remote";

    // Lever provides plain text — use it and skip HTML stripping
    const description = [
      posting.descriptionPlain,
      ...posting.lists.map((l) => `${l.text}\n${stripHtml(l.content)}`),
    ]
      .filter(Boolean)
      .join("\n\n")
      .slice(0, 800);

    const commitmentRaw = (posting.categories?.commitment ?? "").toLowerCase();
    const employmentType = LEVER_COMMITMENT_MAP[commitmentRaw] ?? "full_time";

    return {
      externalId: posting.id,
      sourceJobId: `lever-${posting.id}`,
      source: "lever" as ATSSource,
      title: posting.text,
      company: this.config.companyName ?? this.config.companySlug,
      companySlug: this.config.companySlug,
      applyUrl: posting.applyUrl ?? posting.hostedUrl,
      description,
      descriptionHtml: posting.description,
      location,
      remote,
      postedAt: posting.createdAt ? new Date(posting.createdAt) : null,
      employmentType,
      seniorityLevel: deriveSeniority(posting.text),
      department: posting.categories?.department ?? null,
      rawData: posting as unknown as Record<string, unknown>,
    };
  }
}
// lib/ingestion/base.adapter.ts

import { NormalizedJob, AdapterConfig, IngestResult } from "./types";
import { isUsOrRemote } from "./utils/location";

export type { AdapterConfig };

export abstract class ATSAdapter<TConfig extends AdapterConfig = AdapterConfig> {
  protected config: TConfig;

  constructor(config: TConfig) {
    this.config = config;
  }

  /**
   * Fetch all active jobs from the ATS for this company.
   * Must handle pagination internally — callers expect a complete list.
   */
  abstract fetchJobs(): Promise<NormalizedJob[]>;

  /**
   * Source identifier for this adapter instance, used in logging.
   * e.g. "greenhouse:stripe"
   */
  abstract get sourceKey(): string;

  /**
   * Filter to US/remote jobs. Override if a specific ATS handles this better.
   */
  protected shouldInclude(job: NormalizedJob): boolean {
    if (!job.location) return true; // remote/unspecified
    return isUsOrRemote(job.location);
  }

  /**
   * Convenience: fetch and filter in one call.
   */
  async fetchFiltered(): Promise<NormalizedJob[]> {
    const all = await this.fetchJobs();
    return all.filter((j) => this.shouldInclude(j));
  }
}
// lib/ingestion/types.ts

export interface NormalizedJob {
  // Required
  externalId: string;        // ATS-specific ID
  sourceJobId: string;       // "{source}:{externalId}" — dedup key
  source: ATSSource;
  title: string;
  company: string;
  companySlug: string;
  applyUrl: string;
  description: string;       // cleaned plain text
  
  // Optional
  descriptionHtml?: string;
  location: string | null;
  remote: boolean;
  postedAt: Date | null;
  employmentType: EmploymentType | null;
  seniorityLevel: SeniorityLevel | null;
  department: string | null;
  rawData: Record<string, unknown>;
}

export type ATSSource = 
  | "greenhouse" 
  | "lever" 
  | "ashby" 
  | "workday" 
  | "smartrecruiters";

export type EmploymentType = 
  | "full_time" 
  | "part_time" 
  | "contract" 
  | "internship";

export type SeniorityLevel = 
  | "intern" 
  | "junior" 
  | "mid" 
  | "senior" 
  | "staff" 
  | "principal" 
  | "exec";

export interface AdapterConfig {
  companySlug: string;      // "stripe", "notion", etc.
  companyName?: string;     // Display name override, e.g. "Stripe"
  // ATS-specific config extends this
}

export interface IngestResult {
  source: string;
  companySlug: string;
  fetched: number;
  upserted: number;
  skipped: number;
  deactivated: number;
  errors: string[];
  durationMs: number;
}
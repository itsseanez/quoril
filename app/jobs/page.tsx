"use client";

// app/jobs/page.tsx
//
// NOTE: This is a client component so filters work without a full page reload.
// Jobs + user data are fetched via a lightweight API route (see below).
// For SSR, swap to a server component and pass initialData as props.

import { useEffect, useState, useTransition } from "react";
import Link from "next/link";
import styles from "./jobs.module.css";
import { UserButton } from "@clerk/nextjs";
import TopBar from "@/components/TopBar/TopBar";

// ── types ─────────────────────────────────────────────────────────────────────

interface Job {
  id: string;
  title: string;
  company: string;
  location: string | null;
  remote: boolean;
  description: string;
  applyUrl: string;
  createdAt: string;
  score: number;
  scoreLabel: string;
  saved: boolean;
  applied: boolean;
}

// ── icons ─────────────────────────────────────────────────────────────────────

const MapPinIcon = () => (
  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z"/>
    <circle cx="12" cy="10" r="3"/>
  </svg>
);

const BuildingIcon = () => (
  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <rect width="16" height="20" x="4" y="2" rx="2"/>
    <path d="M9 22v-4h6v4"/>
    <path d="M8 6h.01M16 6h.01M12 6h.01M12 10h.01M8 10h.01M16 10h.01M12 14h.01M8 14h.01M16 14h.01"/>
  </svg>
);

const BookmarkIcon = ({ filled }: { filled: boolean }) => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill={filled ? "currentColor" : "none"} stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="m19 21-7-4-7 4V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2v16z"/>
  </svg>
);

const ExternalLinkIcon = () => (
  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
    <path d="M15 3h6v6M10 14 21 3M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/>
  </svg>
);

const SearchIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="11" cy="11" r="8"/>
    <path d="m21 21-4.35-4.35"/>
  </svg>
);

// ── score badge ───────────────────────────────────────────────────────────────

function ScoreBadge({ score, label }: { score: number; label: string }) {
  const cls =
    score >= 75 ? styles.scoreGreat :
    score >= 50 ? styles.scoreGood :
    score >= 30 ? styles.scorePartial :
    styles.scoreLow;

  return (
    <div className={`${styles.scoreBadge} ${cls}`}>
      <span className={styles.scoreNumber}>{score}</span>
      <span className={styles.scoreLabel}>{label}</span>
    </div>
  );
}

// ── job card ──────────────────────────────────────────────────────────────────

function JobCard({ job, onSave, onApply }: {
  job: Job;
  onSave: (id: string) => void;
  onApply: (id: string) => void;
}) {
  const [expanded, setExpanded] = useState(false);

  return (
    <div className={styles.jobCard}>
      <div className={styles.jobCardTop}>
        <div className={styles.jobCardLeft}>
          <div className={styles.jobTitle}>{job.title}</div>
          <div className={styles.jobMeta}>
            <span className={styles.jobMetaItem}><BuildingIcon />{job.company}</span>
            {(job.location || job.remote) && (
              <span className={styles.jobMetaItem}>
                <MapPinIcon />
                {job.remote ? "Remote" : job.location}
              </span>
            )}
            {job.remote && job.location && (
              <span className={styles.jobMetaItem}><MapPinIcon />{job.location}</span>
            )}
          </div>
        </div>
        <ScoreBadge score={job.score} label={job.scoreLabel} />
      </div>

      {/* Description preview */}
      <p className={`${styles.jobDesc} ${expanded ? styles.jobDescExpanded : ""}`}>
        {job.description.slice(0, expanded ? 600 : 300)}
        {!expanded && job.description.length > 300 && "…"}
      </p>
      {job.description.length > 300 && (
        <button className={styles.expandBtn} onClick={() => setExpanded((e) => !e)}>
          {expanded ? "Show less" : "Show more"}
        </button>
      )}

      <div className={styles.jobCardActions}>
        <button
          className={`${styles.saveBtn} ${job.saved ? styles.saveBtnActive : ""}`}
          onClick={() => onSave(job.id)}
          title={job.saved ? "Unsave" : "Save"}
        >
          <BookmarkIcon filled={job.saved} />
          {job.saved ? "Saved" : "Save"}
        </button>

        {job.applied ? (
          <span className={styles.appliedBadge}>✓ Applied</span>
        ) : (
          <button
            className={styles.applyBtn}
            onClick={() => onApply(job.id)}
          >
            Apply <ExternalLinkIcon />
          </button>
        )}
      </div>
    </div>
  );
}

// ── main page ─────────────────────────────────────────────────────────────────

export default function JobsPage() {
  const [jobs, setJobs] = useState<Job[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [locationFilter, setLocationFilter] = useState("");
  const [remoteOnly, setRemoteOnly] = useState(false);
  const [savedOnly, setSavedOnly] = useState(false);
  const [, startTransition] = useTransition();

  useEffect(() => {
    fetch("/api/jobs")
      .then((r) => r.json())
      .then((data) => {
        setJobs(data.jobs ?? []);
        setLoading(false);
      });
  }, []);

  function handleSave(jobId: string) {
    // Optimistic update
    setJobs((prev) =>
      prev.map((j) => (j.id === jobId ? { ...j, saved: !j.saved } : j))
    );
    fetch("/api/jobs/save", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ jobId }),
    });
  }

  function handleApply(jobId: string) {
    const job = jobs.find((j) => j.id === jobId);
    if (!job) return;

    // Optimistic update
    startTransition(() => {
      setJobs((prev) =>
        prev.map((j) => (j.id === jobId ? { ...j, applied: true } : j))
      );
    });

    // Log application then open URL
    fetch("/api/jobs/apply", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ jobId }),
    }).then(() => {
      window.open(job.applyUrl, "_blank", "noopener,noreferrer");
    });
  }

  // ── filtering ──────────────────────────────────────────────────────────────

  const filtered = jobs.filter((j) => {
    if (remoteOnly && !j.remote) return false;
    if (savedOnly && !j.saved) return false;
    if (locationFilter && !j.location?.toLowerCase().includes(locationFilter.toLowerCase()) && !j.remote) return false;
    if (search) {
      const q = search.toLowerCase();
      if (
        !j.title.toLowerCase().includes(q) &&
        !j.company.toLowerCase().includes(q) &&
        !j.description.toLowerCase().includes(q)
      ) return false;
    }
    return true;
  });

  // Sort by score descending
  const sorted = [...filtered].sort((a, b) => b.score - a.score);

  return (
    <div className={styles.shell}>
      {/* ── Topbar ── */}
      <TopBar />

      <main className={styles.main}>
        <div className={styles.pageHeader}>
          <div>
            <h1 className={styles.heading}>Job feed</h1>
            <p className={styles.sub}>
              {loading ? "Loading…" : `${sorted.length} role${sorted.length !== 1 ? "s" : ""} matched to your profile`}
            </p>
          </div>
        </div>

        {/* ── Filters ── */}
        <div className={styles.filters}>
          <div className={styles.searchWrap}>
            <SearchIcon />
            <input
              className={styles.searchInput}
              placeholder="Search title, company, or keywords…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          <input
            className={styles.filterInput}
            placeholder="Filter by location…"
            value={locationFilter}
            onChange={(e) => setLocationFilter(e.target.value)}
          />
          <label className={styles.filterToggle}>
            <input type="checkbox" checked={remoteOnly} onChange={(e) => setRemoteOnly(e.target.checked)} />
            Remote only
          </label>
          <label className={styles.filterToggle}>
            <input type="checkbox" checked={savedOnly} onChange={(e) => setSavedOnly(e.target.checked)} />
            Saved only
          </label>
        </div>

        {/* ── Job list ── */}
        {loading ? (
          <div className={styles.emptyState}>Loading jobs…</div>
        ) : sorted.length === 0 ? (
          <div className={styles.emptyState}>
            <div className={styles.emptyTitle}>No jobs found</div>
            <div className={styles.emptySub}>Try adjusting your filters or check back after the next ingestion run.</div>
          </div>
        ) : (
          <div className={styles.jobList}>
            {sorted.map((job) => (
              <JobCard
                key={job.id}
                job={job}
                onSave={handleSave}
                onApply={handleApply}
              />
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
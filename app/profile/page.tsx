"use client";

// app/profile/page.tsx

import { useEffect, useState } from "react";
import Link from "next/link";
import styles from "./profile.module.css";

// ── types ─────────────────────────────────────────────────────────────────────

type Intent = "locked" | "hybrid" | "exploratory";
type Level  = "entry" | "mid" | "senior";

interface ProfileData {
  firstName: string;
  lastName: string;
  email: string;
  targetRole: string | null;
  experienceLevel: string | null;
  intentState: string;
  location: string | null;
  skills: string[];
}

const INTENT_OPTIONS: { id: Intent; label: string; desc: string }[] = [
  { id: "locked",      label: "Locked",      desc: "Optimizing for one specific role" },
  { id: "hybrid",      label: "Hybrid",      desc: "Primary direction, open to adjacent roles" },
  { id: "exploratory", label: "Exploratory", desc: "Still discovering what fits" },
];

const LEVEL_OPTIONS: { id: Level; label: string }[] = [
  { id: "entry",  label: "Entry level" },
  { id: "mid",    label: "Mid level"   },
  { id: "senior", label: "Senior"      },
];

// ── save status ───────────────────────────────────────────────────────────────

type SaveState = "idle" | "saving" | "saved" | "error";

// ── completeness ──────────────────────────────────────────────────────────────

function completeness(p: ProfileData): number {
  const fields = [
    !!p.intentState,
    !!p.targetRole,
    !!p.experienceLevel,
    !!p.location,
    p.skills.length > 0,
  ];
  return Math.round((fields.filter(Boolean).length / fields.length) * 100);
}

// ── main page ─────────────────────────────────────────────────────────────────

export default function ProfilePage() {
  const [profile, setProfile] = useState<ProfileData | null>(null);
  const [loading, setLoading] = useState(true);
  const [saveState, setSaveState] = useState<SaveState>("idle");
  const [skillInput, setSkillInput] = useState("");

  useEffect(() => {
    fetch("/api/profile")
      .then((r) => r.json())
      .then((data) => {
        setProfile(data.user);
        setLoading(false);
      });
  }, []);

  function update(patch: Partial<ProfileData>) {
    setProfile((prev) => prev ? { ...prev, ...patch } : prev);
    setSaveState("idle");
  }

  async function save() {
    if (!profile) return;
    setSaveState("saving");
    try {
      const res = await fetch("/api/profile", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          targetRole:      profile.targetRole,
          experienceLevel: profile.experienceLevel,
          intentState:     profile.intentState,
          location:        profile.location,
          skills:          profile.skills,
        }),
      });
      if (!res.ok) throw new Error();
      setSaveState("saved");
      setTimeout(() => setSaveState("idle"), 2500);
    } catch {
      setSaveState("error");
    }
  }

  function addSkill() {
    const trimmed = skillInput.trim();
    if (!trimmed || profile?.skills.includes(trimmed)) return;
    update({ skills: [...(profile?.skills ?? []), trimmed] });
    setSkillInput("");
  }

  function removeSkill(name: string) {
    update({ skills: profile?.skills.filter((s) => s !== name) ?? [] });
  }

  if (loading) {
    return (
      <div className={styles.shell}>
        <Topbar />
        <main className={styles.main}>
          <div className={styles.loadingState}>Loading profile…</div>
        </main>
      </div>
    );
  }

  if (!profile) return null;

  const pct = completeness(profile);

  return (
    <div className={styles.shell}>
      <Topbar />

      <main className={styles.main}>
        <div className={styles.pageHeader}>
          <div>
            <h1 className={styles.heading}>Profile</h1>
            <p className={styles.sub}>This shapes your job scores, recommendations, and AI advice.</p>
          </div>
          <button
            className={`${styles.saveBtn} ${saveState === "saved" ? styles.saveBtnSaved : saveState === "error" ? styles.saveBtnError : ""}`}
            onClick={save}
            disabled={saveState === "saving"}
          >
            {saveState === "saving" ? "Saving…"
              : saveState === "saved" ? "✓ Saved"
              : saveState === "error" ? "Error — retry"
              : "Save changes"}
          </button>
        </div>

        {/* Completeness bar */}
        <div className={styles.completenessWrap}>
          <div className={styles.completenessBar}>
            <div className={styles.completenessFill} style={{ width: `${pct}%` }} />
          </div>
          <span className={styles.completenessLabel}>{pct}% complete</span>
        </div>

        <div className={styles.sections}>

          {/* ── Account (read-only) ── */}
          <section className={styles.section}>
            <div className={styles.sectionHeader}>
              <span className={styles.sectionTitle}>Account</span>
              <span className={styles.sectionSub}>Managed by Clerk — edit in account settings</span>
            </div>
            <div className={styles.readOnlyGrid}>
              <div className={styles.readOnlyField}>
                <span className={styles.readOnlyLabel}>Name</span>
                <span className={styles.readOnlyValue}>
                  {profile.firstName || profile.lastName
                    ? `${profile.firstName} ${profile.lastName}`.trim()
                    : "—"}
                </span>
              </div>
              <div className={styles.readOnlyField}>
                <span className={styles.readOnlyLabel}>Email</span>
                <span className={styles.readOnlyValue}>{profile.email}</span>
              </div>
            </div>
          </section>

          <div className={styles.divider} />

          {/* ── Job search intent ── */}
          <section className={styles.section}>
            <div className={styles.sectionHeader}>
              <span className={styles.sectionTitle}>Search intent</span>
              <span className={styles.sectionSub}>Controls how Quoril ranks and recommends roles</span>
            </div>
            <div className={styles.intentGrid}>
              {INTENT_OPTIONS.map((o) => {
                const selected = profile.intentState === o.id;
                return (
                  <button
                    key={o.id}
                    className={`${styles.intentOption} ${selected ? styles.intentOptionSelected : ""}`}
                    onClick={() => update({ intentState: o.id })}
                  >
                    <div className={`${styles.intentDot} ${selected ? styles.intentDotSelected : ""}`}>
                      {selected && <div className={styles.intentDotInner} />}
                    </div>
                    <div className={styles.intentText}>
                      <span className={styles.intentLabel}>{o.label}</span>
                      <span className={styles.intentDesc}>{o.desc}</span>
                    </div>
                  </button>
                );
              })}
            </div>
          </section>

          <div className={styles.divider} />

          {/* ── Role & experience ── */}
          <section className={styles.section}>
            <div className={styles.sectionHeader}>
              <span className={styles.sectionTitle}>Role & experience</span>
              <span className={styles.sectionSub}>Used to score and filter your job feed</span>
            </div>
            <div className={styles.fieldGroup}>
              <div className={styles.field}>
                <label className={styles.label}>Target role</label>
                <input
                  className={styles.input}
                  placeholder="e.g. Software Engineer Intern"
                  value={profile.targetRole ?? ""}
                  onChange={(e) => update({ targetRole: e.target.value || null })}
                />
              </div>
              <div className={styles.field}>
                <label className={styles.label}>Experience level</label>
                <div className={styles.levelGroup}>
                  {LEVEL_OPTIONS.map((l) => (
                    <button
                      key={l.id}
                      className={`${styles.levelPill} ${profile.experienceLevel === l.id ? styles.levelPillSelected : ""}`}
                      onClick={() => update({ experienceLevel: l.id })}
                    >
                      {l.label}
                    </button>
                  ))}
                </div>
              </div>
              <div className={styles.field}>
                <label className={styles.label}>Location</label>
                <input
                  className={styles.input}
                  placeholder="e.g. San Francisco, CA or Remote"
                  value={profile.location ?? ""}
                  onChange={(e) => update({ location: e.target.value || null })}
                />
              </div>
            </div>
          </section>

          <div className={styles.divider} />

          {/* ── Skills ── */}
          <section className={styles.section}>
            <div className={styles.sectionHeader}>
              <span className={styles.sectionTitle}>Skills</span>
              <span className={styles.sectionSub}>Matched against job descriptions for your score</span>
            </div>
            <div className={styles.skillInputRow}>
              <input
                className={styles.input}
                placeholder="e.g. React, Python, SQL"
                value={skillInput}
                onChange={(e) => setSkillInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") { e.preventDefault(); addSkill(); }
                }}
              />
              <button className={styles.addBtn} onClick={addSkill}>Add</button>
            </div>
            {profile.skills.length > 0 ? (
              <div className={styles.skillTags}>
                {profile.skills.map((s) => (
                  <span key={s} className={styles.skillTag}>
                    {s}
                    <button
                      className={styles.skillTagRemove}
                      onClick={() => removeSkill(s)}
                      aria-label={`Remove ${s}`}
                    >
                      ×
                    </button>
                  </span>
                ))}
              </div>
            ) : (
              <p className={styles.emptySkills}>No skills added yet.</p>
            )}
          </section>

        </div>

        {/* Sticky save bar on mobile */}
        <div className={styles.stickyBar}>
          <button
            className={`${styles.saveBtn} ${styles.saveBtnFull} ${saveState === "saved" ? styles.saveBtnSaved : ""}`}
            onClick={save}
            disabled={saveState === "saving"}
          >
            {saveState === "saving" ? "Saving…" : saveState === "saved" ? "✓ Saved" : "Save changes"}
          </button>
        </div>
      </main>
    </div>
  );
}

// ── topbar ────────────────────────────────────────────────────────────────────

function Topbar() {
  return (
    <header className={styles.topbar}>
      <Link href="/dashboard" className={styles.topbarBrand}>Quoril</Link>
      <nav className={styles.topbarNav}>
        <Link href="/dashboard" className={styles.topbarLink}>Dashboard</Link>
        <Link href="/jobs"         className={styles.topbarLink}>Jobs</Link>
        <Link href="/applications" className={styles.topbarLink}>Applications</Link>
        <Link href="/profile"      className={`${styles.topbarLink} ${styles.topbarLinkActive}`}>Profile</Link>
      </nav>
    </header>
  );
}
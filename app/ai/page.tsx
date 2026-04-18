"use client";

// app/ai/page.tsx

import { useState, useRef, useEffect } from "react";
import Link from "next/link";
import styles from "./ai.module.css";

// ── types ─────────────────────────────────────────────────────────────────────

type Mode = "progress" | "actions" | "skills" | "interview" | "roles";

const MODES: { id: Mode; label: string; desc: string; icon: string }[] = [
  { id: "progress",  label: "Progress",       desc: "How your search is going",         icon: "◎" },
  { id: "actions",   label: "Next actions",   desc: "What to do this week",             icon: "→" },
  { id: "skills",    label: "Skill gaps",     desc: "What to learn for your target role", icon: "△" },
  { id: "interview", label: "Interview prep", desc: "Questions to prepare for",         icon: "?" },
  { id: "roles",     label: "Role recs",      desc: "Roles you should apply to next",   icon: "✦" },
];

// ── streaming helper ──────────────────────────────────────────────────────────

async function streamGroq(
  mode: Mode,
  onChunk: (text: string) => void,
  onDone: () => void,
  onError: (e: string) => void
) {
  const res = await fetch("/api/ai", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ mode }),
  });

  if (!res.ok) {
    onError("Failed to reach AI. Try again.");
    return;
  }

  const reader = res.body?.getReader();
  const decoder = new TextDecoder();
  if (!reader) { onError("Stream unavailable."); return; }

  let buffer = "";

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split("\n");
    buffer = lines.pop() ?? "";

    for (const line of lines) {
      if (!line.startsWith("data: ")) continue;
      const payload = line.slice(6).trim();
      if (payload === "[DONE]") { onDone(); return; }
      try {
        const json = JSON.parse(payload);
        const chunk = json.choices?.[0]?.delta?.content;
        if (chunk) onChunk(chunk);
      } catch {
        // skip malformed lines
      }
    }
  }

  onDone();
}

// ── main page ─────────────────────────────────────────────────────────────────

export default function AIPage() {
  const [activeMode, setActiveMode] = useState<Mode>("progress");
  const [responses, setResponses] = useState<Partial<Record<Mode, string>>>({});
  const [loading, setLoading] = useState<Mode | null>(null);
  const [error, setError] = useState<string | null>(null);
  const outputRef = useRef<HTMLDivElement>(null);

  // Auto-load on first visit
  useEffect(() => {
    handleRun("progress");
  }, []);

  // Scroll output to bottom as it streams
  useEffect(() => {
    if (outputRef.current) {
      outputRef.current.scrollTop = outputRef.current.scrollHeight;
    }
  }, [responses[activeMode]]);

  async function handleRun(mode: Mode) {
    if (loading) return;
    setError(null);
    setLoading(mode);
    setResponses((prev) => ({ ...prev, [mode]: "" }));

    await streamGroq(
      mode,
      (chunk) => setResponses((prev) => ({ ...prev, [mode]: (prev[mode] ?? "") + chunk })),
      () => setLoading(null),
      (e) => { setError(e); setLoading(null); }
    );
  }

  const currentResponse = responses[activeMode];
  const isLoading = loading === activeMode;

  return (
    <div className={styles.shell}>
      <header className={styles.topbar}>
        <Link href="/dashboard" className={styles.topbarBrand}>Quoril</Link>
        <nav className={styles.topbarNav}>
          <Link href="/dashboard" className={styles.topbarLink}>Dashboard</Link>
          <Link href="/jobs" className={styles.topbarLink}>Jobs</Link>
          <Link href="/applications" className={styles.topbarLink}>Applications</Link>
          <Link href="/profile" className={styles.topbarLink}>Profile</Link>
        </nav>
      </header>

      <main className={styles.main}>
        <div className={styles.pageHeader}>
          <div>
            <h1 className={styles.heading}>AI Advisor</h1>
            <p className={styles.sub}>Powered by your real data — applications, skills, and goals.</p>
          </div>
        </div>

        <div className={styles.layout}>
          {/* ── Sidebar ── */}
          <div className={styles.sidebar}>
            {MODES.map((m) => (
              <button
                key={m.id}
                className={`${styles.modeBtn} ${activeMode === m.id ? styles.modeBtnActive : ""}`}
                onClick={() => {
                  setActiveMode(m.id);
                  if (!responses[m.id]) handleRun(m.id);
                }}
              >
                <span className={styles.modeIcon}>{m.icon}</span>
                <div className={styles.modeText}>
                  <span className={styles.modeLabel}>{m.label}</span>
                  <span className={styles.modeDesc}>{m.desc}</span>
                </div>
                {loading === m.id && <span className={styles.spinner} />}
                {responses[m.id] && loading !== m.id && (
                  <span className={styles.doneIndicator} />
                )}
              </button>
            ))}
          </div>

          {/* ── Output ── */}
          <div className={styles.outputWrap}>
            <div className={styles.outputHeader}>
              <span className={styles.outputTitle}>
                {MODES.find((m) => m.id === activeMode)?.label}
              </span>
              <button
                className={styles.refreshBtn}
                onClick={() => handleRun(activeMode)}
                disabled={!!loading}
                title="Regenerate"
              >
                ↻ Refresh
              </button>
            </div>

            <div className={styles.output} ref={outputRef}>
              {error && (
                <div className={styles.errorMsg}>{error}</div>
              )}
              {!currentResponse && !isLoading && !error && (
                <div className={styles.placeholder}>
                  Select a category to get started.
                </div>
              )}
              {isLoading && !currentResponse && (
                <div className={styles.thinking}>
                  <span className={styles.thinkingDot} />
                  <span className={styles.thinkingDot} />
                  <span className={styles.thinkingDot} />
                </div>
              )}
              {currentResponse && (
                <div className={styles.responseText}>
                  {currentResponse}
                  {isLoading && <span className={styles.cursor} />}
                </div>
              )}
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
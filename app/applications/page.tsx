"use client";

// app/applications/page.tsx

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import styles from "./applications.module.css";
import { InterviewDateModal } from "@/app/applications/components/InterviewDateModal";
import TopBar from "@/components/TopBar/TopBar";

// ── types ─────────────────────────────────────────────────────────────────────

type Status = "applied" | "interviewing" | "offer" | "rejected";

interface Application {
  id: string;
  company: string;
  jobTitle: string;
  applyUrl: string | null;
  status: Status;
  notes: string | null;
  appliedAt: string;
  interviewDate: string | null;
}

const STATUS_ORDER: Status[] = ["applied", "interviewing", "offer", "rejected"];

const STATUS_META: Record<Status, { label: string; next: Status | null }> = {
  applied:      { label: "Applied",      next: "interviewing" },
  interviewing: { label: "Interviewing", next: "offer" },
  offer:        { label: "Offer",        next: null },
  rejected:     { label: "Rejected",     next: null },
};

// ── icons ─────────────────────────────────────────────────────────────────────

const PlusIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
    <path d="M12 5v14M5 12h14"/>
  </svg>
);

const ExternalIcon = () => (
  <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
    <path d="M15 3h6v6M10 14 21 3M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/>
  </svg>
);

const TrashIcon = () => (
  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M3 6h18M19 6l-1 14H6L5 6M10 11v6M14 11v6M9 6V4h6v2"/>
  </svg>
);

const XIcon = () => (
  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
    <path d="M18 6 6 18M6 6l12 12"/>
  </svg>
);

const ChevronIcon = () => (
  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
    <path d="m9 18 6-6-6-6"/>
  </svg>
);

// ── status pill ───────────────────────────────────────────────────────────────

function StatusPill({ status, onClick }: { status: Status; onClick: () => void }) {
  return (
    <button
      className={`${styles.statusPill} ${styles[`status_${status}`]}`}
      onClick={onClick}
      title={STATUS_META[status].next ? `Move to ${STATUS_META[status].next}` : "Final status"}
    >
      {STATUS_META[status].label}
      {STATUS_META[status].next && <ChevronIcon />}
    </button>
  );
}

// ── add modal ─────────────────────────────────────────────────────────────────

function AddModal({ onClose, onAdd }: {
  onClose: () => void;
  onAdd: (app: Application) => void;
}) {
  const [form, setForm] = useState({
    company: "",
    jobTitle: "",
    applyUrl: "",
    appliedAt: new Date().toISOString().slice(0, 10),
    interviewDate: "",
    notes: "",
  });
  const [saving, setSaving] = useState(false);

  async function submit() {
    if (!form.company.trim() || !form.jobTitle.trim()) return;
    setSaving(true);
    const res = await fetch("/api/applications", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(form),
    });
    const data = await res.json();
    onAdd(data.application);
    onClose();
  }

  return (
    <div className={styles.modalOverlay} onClick={onClose}>
      <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
        <div className={styles.modalHeader}>
          <span className={styles.modalTitle}>Log application</span>
          <button className={styles.modalClose} onClick={onClose}>×</button>
        </div>

        <div className={styles.modalBody}>
          <div className={styles.fieldRow}>
            <div className={styles.field}>
              <label className={styles.label}>Company <span className={styles.req}>*</span></label>
              <input
                className={styles.input}
                placeholder="e.g. Stripe"
                value={form.company}
                onChange={(e) => setForm((f) => ({ ...f, company: e.target.value }))}
                autoFocus
              />
            </div>
            <div className={styles.field}>
              <label className={styles.label}>Job title <span className={styles.req}>*</span></label>
              <input
                className={styles.input}
                placeholder="e.g. Software Engineer"
                value={form.jobTitle}
                onChange={(e) => setForm((f) => ({ ...f, jobTitle: e.target.value }))}
              />
            </div>
          </div>

          <div className={styles.field}>
            <label className={styles.label}>Job posting URL</label>
            <input
              className={styles.input}
              placeholder="https://…"
              value={form.applyUrl}
              onChange={(e) => setForm((f) => ({ ...f, applyUrl: e.target.value }))}
            />
          </div>

          <div className={styles.fieldRow}>
            <div className={styles.field}>
              <label className={styles.label}>Date applied</label>
              <input
                className={styles.input}
                type="date"
                value={form.appliedAt}
                onChange={(e) => setForm((f) => ({ ...f, appliedAt: e.target.value }))}
              />
            </div>
            <div className={styles.field}>
              <label className={styles.label}>Interview date</label>
              <input
                className={styles.input}
                type="date"
                value={form.interviewDate}
                onChange={(e) => setForm((f) => ({ ...f, interviewDate: e.target.value }))}
              />
            </div>
          </div>

          <div className={styles.field}>
            <label className={styles.label}>Notes</label>
            <textarea
              className={styles.textarea}
              placeholder="Recruiter name, referral, anything useful…"
              value={form.notes}
              onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
              rows={3}
            />
          </div>
        </div>

        <div className={styles.modalFooter}>
          <button className={styles.btnCancel} onClick={onClose}>Cancel</button>
          <button
            className={styles.btnSave}
            onClick={submit}
            disabled={saving || !form.company.trim() || !form.jobTitle.trim()}
          >
            {saving ? "Saving…" : "Log application"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── application row ───────────────────────────────────────────────────────────

function AppRow({ app, onStatusChange, onNotesChange, onDelete, onReject }: {
  app: Application;
  onStatusChange: (id: string, status: Status, interviewDate: string | null) => void;
  onNotesChange: (id: string, notes: string) => void;
  onDelete: (id: string) => void;
  onReject: (id: string) => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const [notes, setNotes] = useState(app.notes ?? "");
  const [saving, setSaving] = useState(false);
  const [showInterviewModal, setShowInterviewModal] = useState(false);
  const pendingNext = useRef<Status | null>(null);

  async function saveNotes() {
    if (notes === app.notes) return;
    setSaving(true);
    await fetch(`/api/applications/${app.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ notes }),
    });
    setSaving(false);
    onNotesChange(app.id, notes);
  }

  function advanceStatus() {
    const next = STATUS_META[app.status].next;
    if (!next) return;

    if (next === "interviewing") {
      pendingNext.current = next;
      setShowInterviewModal(true);
      return;
    }

    onStatusChange(app.id, next, null);
    fetch(`/api/applications/${app.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: next, interviewDate: null }),
    });
  }

  function handleInterviewConfirm(date: string) {
    setShowInterviewModal(false);
    const next = pendingNext.current;
    if (!next) return;
    pendingNext.current = null;
    onStatusChange(app.id, next, date);
    fetch(`/api/applications/${app.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: next, interviewDate: date }),
    });
  }

  const appliedDate = new Date(app.appliedAt).toLocaleDateString("en-US", {
    month: "long", day: "numeric", year: "numeric",
  });

  const interviewDate = app.interviewDate
    ? new Date(app.interviewDate.slice(0, 10) + "T00:00:00").toLocaleDateString("en-US", {
        month: "long", day: "numeric",
      })
    : null;

  return (
    <>
      <div className={`${styles.appRow} ${expanded ? styles.appRowExpanded : ""}`}>
        <div className={styles.appRowMain} onClick={() => setExpanded((e) => !e)}>
          <div className={styles.appRowLeft}>
            <div className={styles.appTitle}>{app.jobTitle}</div>
            <div className={styles.appMeta}>
              <span>{app.company}</span>
              <span className={styles.dot}>·</span>
              <span>{appliedDate}</span>
              {interviewDate && (
                <>
                  <span className={styles.dot}>·</span>
                  <span className={styles.interviewBadge}>Interview {interviewDate}</span>
                </>
              )}
            </div>
          </div>
          <div className={styles.appRowRight} onClick={(e) => e.stopPropagation()}>
            {app.applyUrl && (
              <a
                href={app.applyUrl}
                target="_blank"
                rel="noopener noreferrer"
                className={styles.appLink}
                title="View posting"
              >
                <ExternalIcon />
              </a>
            )}
            <StatusPill status={app.status} onClick={advanceStatus} />
            {app.status !== "rejected" && (
              <button
                className={styles.rejectBtn}
                onClick={() => onReject(app.id)}
                title="Mark as rejected"
              >
                <XIcon />
              </button>
            )}
            <button
              className={styles.deleteBtn}
              onClick={() => onDelete(app.id)}
              title="Delete"
            >
              <TrashIcon />
            </button>
          </div>
        </div>

        {expanded && (
          <div className={styles.appRowDetail}>
            <textarea
              className={styles.notesInput}
              placeholder="Add notes…"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              onBlur={saveNotes}
              rows={3}
            />
            {saving && <span className={styles.savingLabel}>Saving…</span>}
          </div>
        )}
      </div>

      <InterviewDateModal
        open={showInterviewModal}
        onConfirm={handleInterviewConfirm}
        onCancel={() => {
          setShowInterviewModal(false);
          pendingNext.current = null;
        }}
      />
    </>
  );
}

// ── main page ─────────────────────────────────────────────────────────────────

export default function ApplicationsPage() {
  const [apps, setApps] = useState<Application[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [filterStatus, setFilterStatus] = useState<Status | "all">("all");

  useEffect(() => {
    fetch("/api/applications")
      .then((r) => r.json())
      .then((data) => {
        setApps(data.applications ?? []);
        setLoading(false);
      });
  }, []);

  function handleAdd(app: Application) {
    setApps((prev) => [app, ...prev]);
  }

  function handleStatusChange(
    id: string,
    status: Status,
    interviewDate?: string | null
  ) {
    setApps((prev) =>
      prev.map((a) =>
        a.id === id
          ? {
              ...a,
              status,
              ...(interviewDate !== undefined && { interviewDate }),
            }
          : a
      )
    );
  }

  function handleNotesChange(id: string, notes: string) {
    setApps((prev) => prev.map((a) => a.id === id ? { ...a, notes } : a));
  }

  function handleDelete(id: string) {
    if (!confirm("Delete this application?")) return;
    setApps((prev) => prev.filter((a) => a.id !== id));
    fetch(`/api/applications/${id}`, { method: "DELETE" });
  }

  function handleReject(id: string) {
    setApps((prev) =>
      prev.map((a) => a.id === id ? { ...a, status: "rejected" } : a)
    );
    fetch(`/api/applications/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: "rejected" }),
    });
  }

  const filtered = filterStatus === "all"
    ? apps
    : apps.filter((a) => a.status === filterStatus);

  const counts = STATUS_ORDER.reduce<Record<string, number>>((acc, s) => {
    acc[s] = apps.filter((a) => a.status === s).length;
    return acc;
  }, {});

  return (
    <div className={styles.shell}>
      <TopBar />

      <main className={styles.main}>
        <div className={styles.pageHeader}>
          <div>
            <h1 className={styles.heading}>Applications</h1>
            <p className={styles.sub}>
              {loading ? "Loading…" : `${apps.length} application${apps.length !== 1 ? "s" : ""} tracked`}
            </p>
          </div>
          <button className={styles.addBtn} onClick={() => setShowModal(true)}>
            <PlusIcon /> Log application
          </button>
        </div>

        {/* Status filter tabs */}
        <div className={styles.filterTabs}>
          <button
            className={`${styles.filterTab} ${filterStatus === "all" ? styles.filterTabActive : ""}`}
            onClick={() => setFilterStatus("all")}
          >
            All <span className={styles.filterCount}>{apps.length}</span>
          </button>
          {STATUS_ORDER.map((s) => (
            <button
              key={s}
              className={`${styles.filterTab} ${filterStatus === s ? styles.filterTabActive : ""}`}
              onClick={() => setFilterStatus(s)}
            >
              {STATUS_META[s].label}
              {counts[s] > 0 && <span className={styles.filterCount}>{counts[s]}</span>}
            </button>
          ))}
        </div>

        {/* List */}
        {loading ? (
          <div className={styles.emptyState}>Loading…</div>
        ) : filtered.length === 0 ? (
          <div className={styles.emptyState}>
            <div className={styles.emptyTitle}>
              {filterStatus === "all" ? "No applications yet" : `No ${filterStatus} applications`}
            </div>
            <div className={styles.emptySub}>
              {filterStatus === "all"
                ? "Hit the button above to log your first one."
                : "Move applications here as your search progresses."}
            </div>
          </div>
        ) : (
          <div className={styles.appList}>
            {filtered.map((app) => (
              <AppRow
                key={app.id}
                app={app}
                onStatusChange={handleStatusChange}
                onNotesChange={handleNotesChange}
                onDelete={handleDelete}
                onReject={handleReject}
              />
            ))}
          </div>
        )}
      </main>

      {showModal && (
        <AddModal onClose={() => setShowModal(false)} onAdd={handleAdd} />
      )}
    </div>
  );
}
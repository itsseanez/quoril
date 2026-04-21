"use client";

// components/ResumeImport/ResumeImport.tsx

import { useRef, useState } from "react";
import type { ParsedResume } from "@/app/api/resume/parse/route";
import styles from "./ResumeImport.module.css";

type Stage = "upload" | "parsing" | "review" | "applying" | "done";

interface Props {
  onComplete: () => void;
  onSkip?: () => void;
  existingResume?: { fileName: string; uploadedAt: string } | null;
}

// ── icons ─────────────────────────────────────────────────────────────────────

const UploadIcon = () => (
  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
    <polyline points="17 8 12 3 7 8"/>
    <line x1="12" y1="3" x2="12" y2="15"/>
  </svg>
);

const SpinnerIcon = () => (
  <svg className={styles.spinner} width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
    <path d="M21 12a9 9 0 1 1-6.219-8.56"/>
  </svg>
);

const CheckIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="20 6 9 17 4 12"/>
  </svg>
);

const XIcon = () => (
  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
    <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
  </svg>
);

const LinkIcon = () => (
  <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/>
    <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/>
  </svg>
);

// ── upload zone ───────────────────────────────────────────────────────────────

function UploadZone({
  onFile,
  existingResume,
}: {
  onFile: (file: File) => void;
  existingResume?: Props["existingResume"];
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);
  const [error, setError] = useState("");

  function handleFile(file: File) {
    setError("");
    if (file.type !== "application/pdf") { setError("Please upload a PDF file."); return; }
    if (file.size > 5 * 1024 * 1024)    { setError("File must be under 5 MB.");  return; }
    onFile(file);
  }

  return (
    <div className={styles.uploadZoneWrap}>
      {existingResume && (
        <div className={styles.existingBanner}>
          <span className={styles.existingLabel}>Current resume</span>
          <span className={styles.existingName}>{existingResume.fileName}</span>
          <span className={styles.existingDate}>
            Uploaded {new Date(existingResume.uploadedAt).toLocaleDateString()}
          </span>
        </div>
      )}
      <div
        className={`${styles.uploadZone} ${dragging ? styles.uploadZoneDragging : ""}`}
        onClick={() => inputRef.current?.click()}
        onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
        onDragLeave={() => setDragging(false)}
        onDrop={(e) => { e.preventDefault(); setDragging(false); const f = e.dataTransfer.files[0]; if (f) handleFile(f); }}
      >
        <div className={styles.uploadIcon}><UploadIcon /></div>
        <div className={styles.uploadTitle}>{existingResume ? "Upload a new resume" : "Upload your resume"}</div>
        <div className={styles.uploadSub}>Drag & drop or click to browse · PDF only · max 5 MB</div>
        {error && <div className={styles.uploadError}>{error}</div>}
      </div>
      <input ref={inputRef} type="file" accept="application/pdf" className={styles.hiddenInput}
        onChange={(e) => { const f = e.target.files?.[0]; if (f) handleFile(f); }} />
    </div>
  );
}

// ── review screen ─────────────────────────────────────────────────────────────

function ReviewScreen({
  preview, onChange, onConfirm, onBack, applying,
}: {
  preview: ParsedResume;
  onChange: (p: ParsedResume) => void;
  onConfirm: () => void;
  onBack: () => void;
  applying: boolean;
}) {
  const [skillInput, setSkillInput] = useState("");
  const [techInput, setTechInput] = useState<Record<number, string>>({});

  function addSkill() {
    const t = skillInput.trim();
    if (t && !preview.skills.includes(t)) {
      onChange({ ...preview, skills: [...preview.skills, t] });
      setSkillInput("");
    }
  }

  function removeSkill(s: string) {
    onChange({ ...preview, skills: preview.skills.filter((x) => x !== s) });
  }

  function removeWork(i: number) {
    onChange({ ...preview, workHistory: preview.workHistory.filter((_, idx) => idx !== i) });
  }

  function removeProject(i: number) {
    onChange({ ...preview, projects: preview.projects.filter((_, idx) => idx !== i) });
  }

  function updateProject(i: number, patch: Partial<ParsedResume["projects"][number]>) {
    const updated = preview.projects.map((p, idx) => idx === i ? { ...p, ...patch } : p);
    onChange({ ...preview, projects: updated });
  }

  function addTechToProject(i: number) {
    const t = (techInput[i] ?? "").trim();
    if (!t || preview.projects[i].techStack.includes(t)) return;
    updateProject(i, { techStack: [...preview.projects[i].techStack, t] });
    setTechInput((prev) => ({ ...prev, [i]: "" }));
  }

  function removeTechFromProject(projIdx: number, tech: string) {
    updateProject(projIdx, { techStack: preview.projects[projIdx].techStack.filter((t) => t !== tech) });
  }

  const levels: ParsedResume["experienceLevel"][] = ["entry", "mid", "senior"];

  return (
    <div className={styles.review}>
      <div className={styles.reviewHeader}>
        <div className={styles.reviewTitle}>Review what we found</div>
        <div className={styles.reviewSub}>Edit anything before saving to your profile.</div>
      </div>

      <div className={styles.reviewSections}>

        {/* ── Profile fields ── */}
        <div className={styles.reviewSection}>
          <div className={styles.reviewSectionTitle}>Profile fields</div>
          <div className={styles.reviewField}>
            <label className={styles.reviewLabel}>Target role</label>
            <input className={styles.reviewInput} value={preview.targetRole ?? ""} placeholder="e.g. Software Engineer"
              onChange={(e) => onChange({ ...preview, targetRole: e.target.value || null })} />
          </div>
          <div className={styles.reviewField}>
            <label className={styles.reviewLabel}>Experience level</label>
            <div className={styles.levelGroup}>
              {levels.map((l) => (
                <button key={l}
                  className={`${styles.levelPill} ${preview.experienceLevel === l ? styles.levelPillSelected : ""}`}
                  onClick={() => onChange({ ...preview, experienceLevel: l })}>
                  {l}
                </button>
              ))}
            </div>
          </div>
          <div className={styles.reviewField}>
            <label className={styles.reviewLabel}>Location</label>
            <input className={styles.reviewInput} value={preview.location ?? ""} placeholder="e.g. San Francisco, CA"
              onChange={(e) => onChange({ ...preview, location: e.target.value || null })} />
          </div>
        </div>

        {/* ── Skills ── */}
        <div className={styles.reviewSection}>
          <div className={styles.reviewSectionTitle}>Skills ({preview.skills.length})</div>
          <div className={styles.skillInputRow}>
            <input className={styles.reviewInput} value={skillInput} placeholder="Add a skill…"
              onChange={(e) => setSkillInput(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addSkill(); } }} />
            <button className={styles.addBtn} onClick={addSkill}>Add</button>
          </div>
          <div className={styles.skillTags}>
            {preview.skills.map((s) => (
              <span key={s} className={styles.skillTag}>
                {s}
                <button className={styles.skillTagRemove} onClick={() => removeSkill(s)} aria-label={`Remove ${s}`}><XIcon /></button>
              </span>
            ))}
            {preview.skills.length === 0 && <span className={styles.emptyNote}>No skills detected — add them above.</span>}
          </div>
        </div>

        {/* ── Work history ── */}
        <div className={styles.reviewSection}>
          <div className={styles.reviewSectionTitle}>Work history ({preview.workHistory.length})</div>
          {preview.workHistory.length === 0 && <span className={styles.emptyNote}>No work history detected.</span>}
          <div className={styles.workList}>
            {preview.workHistory.map((w, i) => (
              <div key={i} className={styles.workItem}>
                <div className={styles.workItemLeft}>
                  <div className={styles.workTitle}>{w.title}</div>
                  <div className={styles.workMeta}>
                    {w.company}
                    {(w.startDate || w.endDate) && (
                      <span className={styles.workDates}>{" · "}{w.startDate ?? "?"} — {w.endDate ?? "Present"}</span>
                    )}
                  </div>
                  {w.summary && <div className={styles.workSummary}>{w.summary}</div>}
                </div>
                <button className={styles.workRemoveBtn} onClick={() => removeWork(i)} aria-label="Remove"><XIcon /></button>
              </div>
            ))}
          </div>
        </div>

        {/* ── Projects ── */}
        <div className={styles.reviewSection}>
          <div className={styles.reviewSectionTitle}>Projects ({preview.projects.length})</div>
          {preview.projects.length === 0 && <span className={styles.emptyNote}>No projects detected.</span>}
          <div className={styles.projectList}>
            {preview.projects.map((p, i) => (
              <div key={i} className={styles.projectItem}>
                <div className={styles.projectItemHeader}>
                  <div className={styles.projectItemLeft}>
                    <input
                      className={`${styles.reviewInput} ${styles.projectNameInput}`}
                      value={p.name}
                      placeholder="Project name"
                      onChange={(e) => updateProject(i, { name: e.target.value })}
                    />
                    <input
                      className={`${styles.reviewInput} ${styles.projectUrlInput}`}
                      value={p.url ?? ""}
                      placeholder="URL (GitHub, live site…)"
                      onChange={(e) => updateProject(i, { url: e.target.value || null })}
                    />
                  </div>
                  <button className={styles.workRemoveBtn} onClick={() => removeProject(i)} aria-label="Remove project"><XIcon /></button>
                </div>

                {p.description !== null && (
                  <textarea
                    className={`${styles.reviewInput} ${styles.projectDescInput}`}
                    value={p.description ?? ""}
                    placeholder="Short description…"
                    rows={2}
                    onChange={(e) => updateProject(i, { description: e.target.value || null })}
                  />
                )}

                {/* Tech stack for this project */}
                <div className={styles.projectTechRow}>
                  <div className={styles.skillTags}>
                    {p.techStack.map((t) => (
                      <span key={t} className={`${styles.skillTag} ${styles.techTag}`}>
                        {t}
                        <button className={styles.skillTagRemove} onClick={() => removeTechFromProject(i, t)} aria-label={`Remove ${t}`}><XIcon /></button>
                      </span>
                    ))}
                  </div>
                  <div className={styles.skillInputRow}>
                    <input
                      className={`${styles.reviewInput} ${styles.techInput}`}
                      value={techInput[i] ?? ""}
                      placeholder="Add tech…"
                      onChange={(e) => setTechInput((prev) => ({ ...prev, [i]: e.target.value }))}
                      onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addTechToProject(i); } }}
                    />
                    <button className={styles.addBtn} onClick={() => addTechToProject(i)}>Add</button>
                  </div>
                </div>

                {p.endDate === null && (
                  <div className={styles.ongoingBadge}>ongoing</div>
                )}
              </div>
            ))}
          </div>
        </div>

      </div>

      <div className={styles.reviewActions}>
        <button className={styles.btnBack} onClick={onBack} disabled={applying}>← Back</button>
        <button className={styles.btnConfirm} onClick={onConfirm} disabled={applying}>
          {applying ? <><SpinnerIcon /> Saving…</> : <><CheckIcon /> Save to profile</>}
        </button>
      </div>
    </div>
  );
}

// ── main component ────────────────────────────────────────────────────────────

export default function ResumeImport({ onComplete, onSkip, existingResume }: Props) {
  const [stage, setStage] = useState<Stage>("upload");
  const [error, setError] = useState("");
  const [preview, setPreview] = useState<ParsedResume | null>(null);

  async function handleFile(file: File) {
    setError("");
    setStage("parsing");
    try {
      const form = new FormData();
      form.append("file", file);
      const uploadRes = await fetch("/api/resume/upload", { method: "POST", body: form });
      if (!uploadRes.ok) { const e = await uploadRes.json(); throw new Error(e.error ?? "Upload failed"); }
      const { rawText } = await uploadRes.json();

      const parseRes = await fetch("/api/resume/parse", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ rawText }),
      });
      if (!parseRes.ok) { const e = await parseRes.json(); throw new Error(e.error ?? "Parse failed"); }
      const { preview: parsed } = await parseRes.json();
      setPreview(parsed);
      setStage("review");
    } catch (err) {
      setError((err as Error).message ?? "Something went wrong");
      setStage("upload");
    }
  }

  async function handleApply() {
    if (!preview) return;
    setStage("applying");
    try {
      const res = await fetch("/api/resume/apply", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(preview),
      });
      if (!res.ok) throw new Error("Failed to save");
      setStage("done");
      onComplete();
    } catch (err) {
      setError((err as Error).message ?? "Failed to save");
      setStage("review");
    }
  }

  if (stage === "parsing") {
    return (
      <div className={styles.parsingState}>
        <SpinnerIcon />
        <div className={styles.parsingTitle}>Reading your resume…</div>
        <div className={styles.parsingSub}>This takes a few seconds.</div>
      </div>
    );
  }

  if ((stage === "review" || stage === "applying") && preview) {
    return (
      <ReviewScreen
        preview={preview}
        onChange={setPreview}
        onConfirm={handleApply}
        onBack={() => setStage("upload")}
        applying={stage === "applying"}
      />
    );
  }

  return (
    <div className={styles.root}>
      <UploadZone onFile={handleFile} existingResume={existingResume} />
      {error && <div className={styles.errorBanner}>{error}</div>}
      {onSkip && (
        <div className={styles.skipRow}>
          <button className={styles.skipBtn} onClick={onSkip}>Skip for now — fill in manually</button>
        </div>
      )}
    </div>
  );
}
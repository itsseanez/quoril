"use client";

// app/profile/page.tsx

import { useEffect, useState } from "react";
import styles from "./profile.module.css";
import TopBar from "@/components/TopBar/TopBar";
import ResumeImport from "@/components/ResumeImport/ResumeImport";

// ── types ─────────────────────────────────────────────────────────────────────

type Intent = "locked" | "hybrid" | "exploratory";
type Level  = "entry" | "mid" | "senior";

interface WorkHistoryItem {
  id:        string;
  company:   string;
  title:     string;
  startDate: string | null;
  endDate:   string | null;
  summary:   string | null;
}

interface ProjectItem {
  id:          string;
  name:        string;
  description: string | null;
  url:         string | null;
  techStack:   string[];
  startDate:   string | null;
  endDate:     string | null;
}

interface WorkDraft {
  id?:       string;
  company:   string;
  title:     string;
  startDate: string;
  endDate:   string;
  current:   boolean;
  summary:   string;
}

interface ProjectDraft {
  id?:         string;
  name:        string;
  description: string;
  url:         string;
  techStack:   string[];
  startDate:   string;
  endDate:     string;
  ongoing:     boolean;
}

interface ProfileData {
  firstName:       string;
  lastName:        string;
  email:           string;
  targetRole:      string | null;
  experienceLevel: string | null;
  intentState:     string;
  location:        string | null;
  skills:          string[];
  resume: {
    fileName:   string;
    uploadedAt: string;
    parsedAt:   string | null;
  } | null;
  workHistory: WorkHistoryItem[];
  projects:    ProjectItem[];
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

type SaveState = "idle" | "saving" | "saved" | "error";

function completeness(p: ProfileData): number {
  const fields = [!!p.intentState, !!p.targetRole, !!p.experienceLevel, !!p.location, p.skills.length > 0];
  return Math.round((fields.filter(Boolean).length / fields.length) * 100);
}

function emptyWorkDraft(): WorkDraft {
  return { company: "", title: "", startDate: "", endDate: "", current: false, summary: "" };
}

function workItemToDraft(w: WorkHistoryItem): WorkDraft {
  return {
    id: w.id, company: w.company, title: w.title,
    startDate: w.startDate ? w.startDate.slice(0, 7) : "",
    endDate:   w.endDate   ? w.endDate.slice(0, 7)   : "",
    current:   !w.endDate, summary: w.summary ?? "",
  };
}

function emptyProjectDraft(): ProjectDraft {
  return { name: "", description: "", url: "", techStack: [], startDate: "", endDate: "", ongoing: false };
}

function projectItemToDraft(p: ProjectItem): ProjectDraft {
  return {
    id: p.id, name: p.name, description: p.description ?? "", url: p.url ?? "",
    techStack: p.techStack,
    startDate: p.startDate ? p.startDate.slice(0, 7) : "",
    endDate:   p.endDate   ? p.endDate.slice(0, 7)   : "",
    ongoing:   !p.endDate,
  };
}

// ── icons ─────────────────────────────────────────────────────────────────────

const XIcon = () => (
  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
    <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
  </svg>
);
const PencilIcon = () => (
  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
    <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
  </svg>
);
const PlusIcon = () => (
  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
    <line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>
  </svg>
);
const LinkIcon = () => (
  <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/>
    <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/>
  </svg>
);

// ── WorkHistoryEditor ─────────────────────────────────────────────────────────

function WorkHistoryEditor({ items, onChange }: { items: WorkHistoryItem[]; onChange: (u: WorkHistoryItem[]) => void }) {
  const [editingId, setEditingId] = useState<string | null>(null);
  const [addingNew, setAddingNew] = useState(false);
  const [draft, setDraft]         = useState<WorkDraft>(emptyWorkDraft());
  const [saveState, setSaveState] = useState<SaveState>("idle");

  function startEdit(item: WorkHistoryItem) { setAddingNew(false); setEditingId(item.id); setDraft(workItemToDraft(item)); setSaveState("idle"); }
  function startAdd()  { setEditingId(null); setAddingNew(true); setDraft(emptyWorkDraft()); setSaveState("idle"); }
  function cancel()    { setEditingId(null); setAddingNew(false); setDraft(emptyWorkDraft()); }

  async function save() {
    if (!draft.title.trim() || !draft.company.trim()) return;
    setSaveState("saving");
    const payload = { id: draft.id, title: draft.title.trim(), company: draft.company.trim(),
      startDate: draft.startDate || null, endDate: draft.current ? null : (draft.endDate || null),
      summary: draft.summary.trim() || null };
    try {
      const res = await fetch("/api/profile/work-history", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
      if (!res.ok) throw new Error();
      const { entry } = await res.json();
      onChange(addingNew ? [...items, entry] : items.map((w) => w.id === entry.id ? entry : w));
      setSaveState("saved");
      setTimeout(() => { cancel(); setSaveState("idle"); }, 800);
    } catch { setSaveState("error"); }
  }

  async function remove(id: string) {
    await fetch("/api/profile/work-history", { method: "DELETE", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id }) });
    onChange(items.filter((w) => w.id !== id));
  }

  const isEditing = editingId !== null || addingNew;

  return (
    <div className={styles.workEditor}>
      <div className={styles.workList}>
        {items.length === 0 && !isEditing && <p className={styles.emptySkills}>No work history added yet.</p>}
        {items.map((w) => (
          <div key={w.id} className={`${styles.workItem} ${editingId === w.id ? styles.workItemEditing : ""}`}>
            {editingId === w.id ? (
              <WorkDraftForm draft={draft} onChange={setDraft} onSave={save} onCancel={cancel} saveState={saveState} />
            ) : (
              <>
                <div className={styles.workItemLeft}>
                  <div className={styles.workTitle}>{w.title}</div>
                  <div className={styles.workMeta}>
                    {w.company}
                    {(w.startDate || w.endDate) && (
                      <span className={styles.workDates}>
                        {" · "}
                        {w.startDate ? new Date(w.startDate).toLocaleDateString("en-US", { year: "numeric", month: "short" }) : "?"}
                        {" — "}
                        {w.endDate ? new Date(w.endDate).toLocaleDateString("en-US", { year: "numeric", month: "short" }) : "Present"}
                      </span>
                    )}
                  </div>
                  {w.summary && <div className={styles.workSummary}>{w.summary}</div>}
                </div>
                <div className={styles.workItemActions}>
                  <button className={styles.workActionBtn} onClick={() => startEdit(w)} aria-label="Edit"><PencilIcon /></button>
                  <button className={styles.workActionBtn} onClick={() => remove(w.id)} aria-label="Remove"><XIcon /></button>
                </div>
              </>
            )}
          </div>
        ))}
        {addingNew && (
          <div className={`${styles.workItem} ${styles.workItemEditing}`}>
            <WorkDraftForm draft={draft} onChange={setDraft} onSave={save} onCancel={cancel} saveState={saveState} />
          </div>
        )}
      </div>
      {!isEditing && <button className={styles.addWorkBtn} onClick={startAdd}><PlusIcon /> Add position</button>}
    </div>
  );
}

function WorkDraftForm({ draft, onChange, onSave, onCancel, saveState }: { draft: WorkDraft; onChange: (d: WorkDraft) => void; onSave: () => void; onCancel: () => void; saveState: SaveState }) {
  const valid = draft.title.trim() && draft.company.trim();
  return (
    <div className={styles.workDraftForm}>
      <div className={styles.workDraftRow}>
        <div className={styles.workDraftField}>
          <label className={styles.workDraftLabel}>Title *</label>
          <input className={styles.input} placeholder="e.g. Software Engineer" value={draft.title} onChange={(e) => onChange({ ...draft, title: e.target.value })} />
        </div>
        <div className={styles.workDraftField}>
          <label className={styles.workDraftLabel}>Company *</label>
          <input className={styles.input} placeholder="e.g. Acme Corp" value={draft.company} onChange={(e) => onChange({ ...draft, company: e.target.value })} />
        </div>
      </div>
      <div className={styles.workDraftRow}>
        <div className={styles.workDraftField}>
          <label className={styles.workDraftLabel}>Start date</label>
          <input className={styles.input} type="month" value={draft.startDate} onChange={(e) => onChange({ ...draft, startDate: e.target.value })} />
        </div>
        <div className={styles.workDraftField}>
          <label className={styles.workDraftLabel}>End date</label>
          <input className={styles.input} type="month" value={draft.endDate} onChange={(e) => onChange({ ...draft, endDate: e.target.value })} disabled={draft.current} />
          <label className={styles.currentCheckLabel}>
            <input type="checkbox" checked={draft.current} onChange={(e) => onChange({ ...draft, current: e.target.checked, endDate: "" })} />
            Current role
          </label>
        </div>
      </div>
      <div className={styles.workDraftField}>
        <label className={styles.workDraftLabel}>Summary</label>
        <textarea className={`${styles.input} ${styles.workDraftTextarea}`} placeholder="One sentence describing your role and key contribution…" value={draft.summary} onChange={(e) => onChange({ ...draft, summary: e.target.value })} rows={2} />
      </div>
      <div className={styles.workDraftActions}>
        <button className={styles.btnBack} onClick={onCancel}>Cancel</button>
        <button className={styles.workSaveBtn} onClick={onSave} disabled={!valid || saveState === "saving"}>
          {saveState === "saving" ? "Saving…" : saveState === "saved" ? "✓ Saved" : saveState === "error" ? "Error — retry" : "Save"}
        </button>
      </div>
    </div>
  );
}

// ── ProjectEditor ─────────────────────────────────────────────────────────────

function ProjectEditor({ items, onChange }: { items: ProjectItem[]; onChange: (u: ProjectItem[]) => void }) {
  const [editingId, setEditingId] = useState<string | null>(null);
  const [addingNew, setAddingNew] = useState(false);
  const [draft, setDraft]         = useState<ProjectDraft>(emptyProjectDraft());
  const [saveState, setSaveState] = useState<SaveState>("idle");

  function startEdit(item: ProjectItem) { setAddingNew(false); setEditingId(item.id); setDraft(projectItemToDraft(item)); setSaveState("idle"); }
  function startAdd()  { setEditingId(null); setAddingNew(true); setDraft(emptyProjectDraft()); setSaveState("idle"); }
  function cancel()    { setEditingId(null); setAddingNew(false); setDraft(emptyProjectDraft()); }

  async function save() {
    if (!draft.name.trim()) return;
    setSaveState("saving");
    const payload = {
      id: draft.id, name: draft.name.trim(),
      description: draft.description.trim() || null,
      url: draft.url.trim() || null,
      techStack: draft.techStack,
      startDate: draft.startDate || null,
      endDate: draft.ongoing ? null : (draft.endDate || null),
    };
    try {
      const res = await fetch("/api/profile/projects", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
      if (!res.ok) throw new Error();
      const { entry } = await res.json();
      onChange(addingNew ? [...items, entry] : items.map((p) => p.id === entry.id ? entry : p));
      setSaveState("saved");
      setTimeout(() => { cancel(); setSaveState("idle"); }, 800);
    } catch { setSaveState("error"); }
  }

  async function remove(id: string) {
    await fetch("/api/profile/projects", { method: "DELETE", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id }) });
    onChange(items.filter((p) => p.id !== id));
  }

  const isEditing = editingId !== null || addingNew;

  return (
    <div className={styles.workEditor}>
      <div className={styles.workList}>
        {items.length === 0 && !isEditing && <p className={styles.emptySkills}>No projects added yet.</p>}
        {items.map((p) => (
          <div key={p.id} className={`${styles.workItem} ${editingId === p.id ? styles.workItemEditing : ""}`}>
            {editingId === p.id ? (
              <ProjectDraftForm draft={draft} onChange={setDraft} onSave={save} onCancel={cancel} saveState={saveState} />
            ) : (
              <>
                <div className={styles.workItemLeft}>
                  <div className={styles.workTitle}>
                    {p.name}
                    {p.url && (
                      <a href={p.url} target="_blank" rel="noopener noreferrer" className={styles.projectLink}>
                        <LinkIcon />
                      </a>
                    )}
                  </div>
                  {p.description && <div className={styles.workSummary}>{p.description}</div>}
                  {p.techStack.length > 0 && (
                    <div className={styles.projectTechStack}>
                      {p.techStack.map((t) => <span key={t} className={styles.projectTechTag}>{t}</span>)}
                    </div>
                  )}
                  {(p.startDate || p.endDate) && (
                    <div className={styles.workMeta}>
                      <span className={styles.workDates}>
                        {p.startDate ? new Date(p.startDate).toLocaleDateString("en-US", { year: "numeric", month: "short" }) : "?"}
                        {" — "}
                        {p.endDate ? new Date(p.endDate).toLocaleDateString("en-US", { year: "numeric", month: "short" }) : "Ongoing"}
                      </span>
                    </div>
                  )}
                </div>
                <div className={styles.workItemActions}>
                  <button className={styles.workActionBtn} onClick={() => startEdit(p)} aria-label="Edit"><PencilIcon /></button>
                  <button className={styles.workActionBtn} onClick={() => remove(p.id)} aria-label="Remove"><XIcon /></button>
                </div>
              </>
            )}
          </div>
        ))}
        {addingNew && (
          <div className={`${styles.workItem} ${styles.workItemEditing}`}>
            <ProjectDraftForm draft={draft} onChange={setDraft} onSave={save} onCancel={cancel} saveState={saveState} />
          </div>
        )}
      </div>
      {!isEditing && <button className={styles.addWorkBtn} onClick={startAdd}><PlusIcon /> Add project</button>}
    </div>
  );
}

function ProjectDraftForm({ draft, onChange, onSave, onCancel, saveState }: { draft: ProjectDraft; onChange: (d: ProjectDraft) => void; onSave: () => void; onCancel: () => void; saveState: SaveState }) {
  const [techInput, setTechInput] = useState("");
  const valid = draft.name.trim();

  function addTech() {
    const t = techInput.trim();
    if (t && !draft.techStack.includes(t)) { onChange({ ...draft, techStack: [...draft.techStack, t] }); setTechInput(""); }
  }

  return (
    <div className={styles.workDraftForm}>
      <div className={styles.workDraftRow}>
        <div className={styles.workDraftField}>
          <label className={styles.workDraftLabel}>Project name *</label>
          <input className={styles.input} placeholder="e.g. Portfolio site" value={draft.name} onChange={(e) => onChange({ ...draft, name: e.target.value })} />
        </div>
        <div className={styles.workDraftField}>
          <label className={styles.workDraftLabel}>URL</label>
          <input className={styles.input} placeholder="https://github.com/…" value={draft.url} onChange={(e) => onChange({ ...draft, url: e.target.value })} />
        </div>
      </div>
      <div className={styles.workDraftField}>
        <label className={styles.workDraftLabel}>Description</label>
        <textarea className={`${styles.input} ${styles.workDraftTextarea}`} placeholder="What does this project do?" value={draft.description} onChange={(e) => onChange({ ...draft, description: e.target.value })} rows={2} />
      </div>
      <div className={styles.workDraftField}>
        <label className={styles.workDraftLabel}>Tech stack</label>
        <div className={styles.skillInputRow}>
          <input className={styles.input} placeholder="e.g. React, TypeScript" value={techInput}
            onChange={(e) => setTechInput(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addTech(); } }} />
          <button className={styles.addBtn} onClick={addTech}>Add</button>
        </div>
        {draft.techStack.length > 0 && (
          <div className={styles.skillTags} style={{ marginTop: 8 }}>
            {draft.techStack.map((t) => (
              <span key={t} className={styles.skillTag}>
                {t}
                <button className={styles.skillTagRemove} onClick={() => onChange({ ...draft, techStack: draft.techStack.filter((x) => x !== t) })} aria-label={`Remove ${t}`}>×</button>
              </span>
            ))}
          </div>
        )}
      </div>
      <div className={styles.workDraftRow}>
        <div className={styles.workDraftField}>
          <label className={styles.workDraftLabel}>Start date</label>
          <input className={styles.input} type="month" value={draft.startDate} onChange={(e) => onChange({ ...draft, startDate: e.target.value })} />
        </div>
        <div className={styles.workDraftField}>
          <label className={styles.workDraftLabel}>End date</label>
          <input className={styles.input} type="month" value={draft.endDate} onChange={(e) => onChange({ ...draft, endDate: e.target.value })} disabled={draft.ongoing} />
          <label className={styles.currentCheckLabel}>
            <input type="checkbox" checked={draft.ongoing} onChange={(e) => onChange({ ...draft, ongoing: e.target.checked, endDate: "" })} />
            Ongoing
          </label>
        </div>
      </div>
      <div className={styles.workDraftActions}>
        <button className={styles.btnBack} onClick={onCancel}>Cancel</button>
        <button className={styles.workSaveBtn} onClick={onSave} disabled={!valid || saveState === "saving"}>
          {saveState === "saving" ? "Saving…" : saveState === "saved" ? "✓ Saved" : saveState === "error" ? "Error — retry" : "Save"}
        </button>
      </div>
    </div>
  );
}

// ── main page ─────────────────────────────────────────────────────────────────

export default function ProfilePage() {
  const [profile, setProfile]                   = useState<ProfileData | null>(null);
  const [loading, setLoading]                   = useState(true);
  const [saveState, setSaveState]               = useState<SaveState>("idle");
  const [skillInput, setSkillInput]             = useState("");
  const [showResumeImport, setShowResumeImport] = useState(false);

  useEffect(() => {
    fetch("/api/profile").then((r) => r.json()).then((data) => { setProfile(data.user); setLoading(false); });
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
        method: "PATCH", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ targetRole: profile.targetRole, experienceLevel: profile.experienceLevel, intentState: profile.intentState, location: profile.location, skills: profile.skills }),
      });
      if (!res.ok) throw new Error();
      setSaveState("saved");
      setTimeout(() => setSaveState("idle"), 2500);
    } catch { setSaveState("error"); }
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

  async function handleResumeComplete() {
    setShowResumeImport(false);
    const data = await fetch("/api/profile").then((r) => r.json());
    setProfile(data.user);
  }

  if (loading) return (
    <div className={styles.shell}><TopBar /><main className={styles.main}><div className={styles.loadingState}>Loading profile…</div></main></div>
  );

  if (!profile) return null;

  const pct = completeness(profile);

  return (
    <div className={styles.shell}>
      <TopBar />
      <main className={styles.main}>
        <div className={styles.pageHeader}>
          <div>
            <h1 className={styles.heading}>Profile</h1>
            <p className={styles.sub}>This shapes your job scores, recommendations, and AI advice.</p>
          </div>
          <button
            className={`${styles.saveBtn} ${saveState === "saved" ? styles.saveBtnSaved : saveState === "error" ? styles.saveBtnError : ""}`}
            onClick={save} disabled={saveState === "saving"}
          >
            {saveState === "saving" ? "Saving…" : saveState === "saved" ? "✓ Saved" : saveState === "error" ? "Error — retry" : "Save changes"}
          </button>
        </div>

        <div className={styles.completenessWrap}>
          <div className={styles.completenessBar}><div className={styles.completenessFill} style={{ width: `${pct}%` }} /></div>
          <span className={styles.completenessLabel}>{pct}% complete</span>
        </div>

        <div className={styles.sections}>

          {/* ── Account ── */}
          <section className={styles.section}>
            <div className={styles.sectionHeader}>
              <span className={styles.sectionTitle}>Account</span>
              <span className={styles.sectionSub}>Managed by Clerk — edit in account settings</span>
            </div>
            <div className={styles.readOnlyGrid}>
              <div className={styles.readOnlyField}>
                <span className={styles.readOnlyLabel}>Name</span>
                <span className={styles.readOnlyValue}>{profile.firstName || profile.lastName ? `${profile.firstName} ${profile.lastName}`.trim() : "—"}</span>
              </div>
              <div className={styles.readOnlyField}>
                <span className={styles.readOnlyLabel}>Email</span>
                <span className={styles.readOnlyValue}>{profile.email}</span>
              </div>
            </div>
          </section>

          <div className={styles.divider} />

          {/* ── Search intent ── */}
          <section className={styles.section}>
            <div className={styles.sectionHeader}>
              <span className={styles.sectionTitle}>Search intent</span>
              <span className={styles.sectionSub}>Controls how Quoril ranks and recommends roles</span>
            </div>
            <div className={styles.intentGrid}>
              {INTENT_OPTIONS.map((o) => {
                const selected = profile.intentState === o.id;
                return (
                  <button key={o.id} className={`${styles.intentOption} ${selected ? styles.intentOptionSelected : ""}`} onClick={() => update({ intentState: o.id })}>
                    <div className={`${styles.intentDot} ${selected ? styles.intentDotSelected : ""}`}>{selected && <div className={styles.intentDotInner} />}</div>
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
                <input className={styles.input} placeholder="e.g. Software Engineer Intern" value={profile.targetRole ?? ""} onChange={(e) => update({ targetRole: e.target.value || null })} />
              </div>
              <div className={styles.field}>
                <label className={styles.label}>Experience level</label>
                <div className={styles.levelGroup}>
                  {LEVEL_OPTIONS.map((l) => (
                    <button key={l.id} className={`${styles.levelPill} ${profile.experienceLevel === l.id ? styles.levelPillSelected : ""}`} onClick={() => update({ experienceLevel: l.id })}>{l.label}</button>
                  ))}
                </div>
              </div>
              <div className={styles.field}>
                <label className={styles.label}>Location</label>
                <input className={styles.input} placeholder="e.g. San Francisco, CA or Remote" value={profile.location ?? ""} onChange={(e) => update({ location: e.target.value || null })} />
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
              <input className={styles.input} placeholder="e.g. React, Python, SQL" value={skillInput}
                onChange={(e) => setSkillInput(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addSkill(); } }} />
              <button className={styles.addBtn} onClick={addSkill}>Add</button>
            </div>
            {profile.skills.length > 0 ? (
              <div className={styles.skillTags}>
                {profile.skills.map((s) => (
                  <span key={s} className={styles.skillTag}>{s}<button className={styles.skillTagRemove} onClick={() => removeSkill(s)} aria-label={`Remove ${s}`}>×</button></span>
                ))}
              </div>
            ) : <p className={styles.emptySkills}>No skills added yet.</p>}
          </section>

          <div className={styles.divider} />

          {/* ── Work history ── */}
          <section className={styles.section}>
            <div className={styles.sectionHeader}>
              <span className={styles.sectionTitle}>Work history</span>
              <span className={styles.sectionSub}>Used by the AI advisor to personalise guidance</span>
            </div>
            <WorkHistoryEditor items={profile.workHistory} onChange={(updated) => update({ workHistory: updated })} />
          </section>

          <div className={styles.divider} />

          {/* ── Projects ── */}
          <section className={styles.section}>
            <div className={styles.sectionHeader}>
              <span className={styles.sectionTitle}>Projects</span>
              <span className={styles.sectionSub}>Shown to the AI advisor — helps with portfolio and skills feedback</span>
            </div>
            <ProjectEditor items={profile.projects ?? []} onChange={(updated) => update({ projects: updated })} />
          </section>

          <div className={styles.divider} />

          {/* ── Resume ── */}
          <section className={styles.section}>
            <div className={styles.sectionHeader}>
              <span className={styles.sectionTitle}>Resume</span>
              <span className={styles.sectionSub}>Used to auto-fill your profile and power AI features</span>
            </div>
            {!showResumeImport ? (
              <>
                {profile.resume ? (
                  <div className={styles.resumeCard}>
                    <div className={styles.resumeInfo}>
                      <div className={styles.resumeFileName}>{profile.resume.fileName}</div>
                      <div className={styles.resumeMeta}>
                        Uploaded {new Date(profile.resume.uploadedAt).toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric" })}
                        {profile.resume.parsedAt ? ` · Parsed ${new Date(profile.resume.parsedAt).toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric" })}` : " · Not yet parsed"}
                      </div>
                    </div>
                    <button className={styles.resumeReplaceBtn} onClick={() => setShowResumeImport(true)}>Replace</button>
                  </div>
                ) : (
                  <div className={styles.resumeEmpty}>
                    <div className={styles.resumeEmptyText}>No resume uploaded yet.</div>
                    <button className={styles.resumeUploadBtn} onClick={() => setShowResumeImport(true)}>Upload resume</button>
                  </div>
                )}
              </>
            ) : (
              <div className={styles.resumeImportWrap}>
                <ResumeImport onComplete={handleResumeComplete} onSkip={() => setShowResumeImport(false)} existingResume={profile.resume ?? undefined} />
              </div>
            )}
          </section>

        </div>

        <div className={styles.stickyBar}>
          <button className={`${styles.saveBtn} ${styles.saveBtnFull} ${saveState === "saved" ? styles.saveBtnSaved : ""}`} onClick={save} disabled={saveState === "saving"}>
            {saveState === "saving" ? "Saving…" : saveState === "saved" ? "✓ Saved" : "Save changes"}
          </button>
        </div>
      </main>
    </div>
  );
}
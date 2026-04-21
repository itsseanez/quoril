"use client";

// app/onboarding/page.tsx
//
// Flow A (resume imported): Resume → Intent → Dashboard
// Flow B (skipped):         Resume → Intent → Role → Skills → Dashboard

import { useState } from "react";
import { useRouter } from "next/navigation";
import styles from "./onboarding.module.css";
import ResumeImport from "@/components/ResumeImport/ResumeImport";

// "fast" path has 2 steps, "manual" path has 4
const STEPS_FAST   = ["Resume", "Intent"];
const STEPS_MANUAL = ["Resume", "Intent", "Role", "Skills"];

const ArrowRight = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
    <path d="M5 12h14M12 5l7 7-7 7" />
  </svg>
);

export default function OnboardingPage() {
  const router  = useRouter();
  const [step, setStep]       = useState(0);
  const [imported, setImported] = useState(false); // true = resume was fully imported
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState({
    intentState:     "",
    targetRole:      "",
    experienceLevel: "",
    skills:          [] as string[],
    location:        "",
  });

  const steps = imported ? STEPS_FAST : STEPS_MANUAL;

  // Called when resume import + review completes successfully
  function handleResumeComplete() {
    setImported(true);
    setStep(1); // go to intent
  }

  // Called when user skips the resume step
  function handleResumeSkip() {
    setImported(false);
    setStep(1); // go to intent, then role + skills
  }

  async function finishWithIntent(intentState: string) {
    // Fast path: resume was imported, just save intent and go to dashboard
    setLoading(true);
    await fetch("/api/profile/setup", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...data, intentState }),
    });
    router.push("/dashboard");
  }

  async function finishManual() {
    // Manual path: save everything and go to dashboard
    setLoading(true);
    await fetch("/api/profile/setup", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });
    router.push("/dashboard");
  }

  return (
    <div className={styles.page}>
      <div className={styles.bg} />
      <div className={styles.card}>
        <div className={styles.brand}>
          <span className={styles.brandAccent}>Quoril</span> — setup
        </div>

        {/* Progress bar */}
        <div className={styles.progress}>
          {steps.map((_, i) => (
            <div
              key={i}
              className={`${styles.progressStep} ${
                i < step
                  ? styles.progressStepDone
                  : i === step
                  ? styles.progressStepActive
                  : ""
              }`}
            />
          ))}
        </div>

        {/* ── Step 0: Resume ── */}
        {step === 0 && (
          <div className={styles.stepContent}>
            <p className={styles.stepMeta}>Step 1 of {steps.length}</p>
            <h1 className={styles.stepTitle}>Import your resume</h1>
            <p className={styles.stepSub}>
              We'll auto-fill your profile from it. You can review everything before it saves.
            </p>
            <ResumeImport
              onComplete={handleResumeComplete}
              onSkip={handleResumeSkip}
            />
          </div>
        )}

        {/* ── Step 1: Intent ── */}
        {step === 1 && (
          <IntentStep
            value={data.intentState}
            onChange={(v) => setData((d) => ({ ...d, intentState: v }))}
            // Fast path: finish immediately after intent
            onNext={imported
              ? () => finishWithIntent(data.intentState)
              : () => setStep(2)
            }
            onBack={() => setStep(0)}
            stepLabel={`Step 2 of ${steps.length}`}
            isFinal={imported}
            loading={loading}
          />
        )}

        {/* ── Step 2: Role (manual path only) ── */}
        {step === 2 && !imported && (
          <RoleStep
            value={data.targetRole}
            expValue={data.experienceLevel}
            onChange={(v) => setData((d) => ({ ...d, targetRole: v }))}
            onExpChange={(v) => setData((d) => ({ ...d, experienceLevel: v }))}
            onNext={() => setStep(3)}
            onBack={() => setStep(1)}
            stepLabel="Step 3 of 4"
          />
        )}

        {/* ── Step 3: Skills (manual path only) ── */}
        {step === 3 && !imported && (
          <SkillsStep
            skills={data.skills}
            location={data.location}
            onChange={(v) => setData((d) => ({ ...d, skills: v }))}
            onLocationChange={(v) => setData((d) => ({ ...d, location: v }))}
            onBack={() => setStep(2)}
            onFinish={finishManual}
            loading={loading}
            stepLabel="Step 4 of 4"
          />
        )}
      </div>
    </div>
  );
}

// ── Intent step ───────────────────────────────────────────────────────────────

function IntentStep({
  value,
  onChange,
  onNext,
  onBack,
  stepLabel,
  isFinal,
  loading,
}: {
  value: string;
  onChange: (v: string) => void;
  onNext: () => void;
  onBack: () => void;
  stepLabel: string;
  isFinal: boolean;
  loading?: boolean;
}) {
  const options = [
    { id: "locked",      label: "I know exactly what I want",     sub: "e.g. Software Engineer Intern at a startup" },
    { id: "hybrid",      label: "I have a direction but I'm open", sub: "e.g. Something in backend or DevOps" },
    { id: "exploratory", label: "I'm still figuring it out",       sub: "Show me what's out there" },
  ];

  return (
    <div className={styles.stepContent}>
      <p className={styles.stepMeta}>{stepLabel}</p>
      <h1 className={styles.stepTitle}>Where are you in your search?</h1>
      <p className={styles.stepSub}>This shapes how Quoril ranks and recommends jobs for you.</p>

      <div className={styles.intentGrid}>
        {options.map((o) => {
          const selected = value === o.id;
          return (
            <button
              key={o.id}
              className={`${styles.intentOption} ${selected ? styles.intentOptionSelected : ""}`}
              onClick={() => onChange(o.id)}
            >
              <div className={`${styles.intentDot} ${selected ? styles.intentDotSelected : ""}`}>
                {selected && <div className={styles.intentDotInner} />}
              </div>
              <div className={styles.intentText}>
                <span className={styles.intentLabel}>{o.label}</span>
                <span className={styles.intentSub}>{o.sub}</span>
              </div>
            </button>
          );
        })}
      </div>

      <div className={styles.actions}>
        <button className={styles.btnBack} onClick={onBack}>Back</button>
        <div className={styles.actionsRight}>
          <button
            className={isFinal ? styles.btnFinish : styles.btnNext}
            onClick={onNext}
            disabled={!value || loading}
          >
            {loading ? "Setting up…" : isFinal ? <>Go to dashboard <ArrowRight /></> : <>Continue <ArrowRight /></>}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Role step ─────────────────────────────────────────────────────────────────

function RoleStep({
  value,
  expValue,
  onChange,
  onExpChange,
  onNext,
  onBack,
  stepLabel,
}: {
  value: string;
  expValue: string;
  onChange: (v: string) => void;
  onExpChange: (v: string) => void;
  onNext: () => void;
  onBack: () => void;
  stepLabel: string;
}) {
  const levels = [
    { id: "entry",  label: "Entry level" },
    { id: "mid",    label: "Mid level"   },
    { id: "senior", label: "Senior"      },
  ];

  return (
    <div className={styles.stepContent}>
      <p className={styles.stepMeta}>{stepLabel}</p>
      <h1 className={styles.stepTitle}>What role are you after?</h1>
      <p className={styles.stepSub}>Don't worry if you're not sure — you can update this anytime.</p>

      <div className={styles.fieldGroup}>
        <div className={styles.field}>
          <label className={styles.label}>Target role</label>
          <input
            className={styles.input}
            placeholder="e.g. Software Engineer Intern"
            value={value}
            onChange={(e) => onChange(e.target.value)}
          />
        </div>
        <div className={styles.field}>
          <label className={styles.label}>Experience level</label>
          <div className={styles.levelGroup}>
            {levels.map((l) => (
              <button
                key={l.id}
                className={`${styles.levelPill} ${expValue === l.id ? styles.levelPillSelected : ""}`}
                onClick={() => onExpChange(l.id)}
              >
                {l.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className={styles.actions}>
        <button className={styles.btnBack} onClick={onBack}>Back</button>
        <div className={styles.actionsRight}>
          <button className={styles.btnNext} onClick={onNext} disabled={!expValue}>
            Continue <ArrowRight />
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Skills step ───────────────────────────────────────────────────────────────

function SkillsStep({
  skills,
  location,
  onChange,
  onLocationChange,
  onBack,
  onFinish,
  loading,
  stepLabel,
}: {
  skills: string[];
  location: string;
  onChange: (v: string[]) => void;
  onLocationChange: (v: string) => void;
  onBack: () => void;
  onFinish: () => void;
  loading: boolean;
  stepLabel: string;
}) {
  const [input, setInput] = useState("");

  function addSkill() {
    const trimmed = input.trim();
    if (trimmed && !skills.includes(trimmed)) {
      onChange([...skills, trimmed]);
      setInput("");
    }
  }

  function removeSkill(skill: string) {
    onChange(skills.filter((s) => s !== skill));
  }

  return (
    <div className={styles.stepContent}>
      <p className={styles.stepMeta}>{stepLabel}</p>
      <h1 className={styles.stepTitle}>Skills & location</h1>
      <p className={styles.stepSub}>Add the technologies and tools you know. These power your job match scores.</p>

      <div className={styles.fieldGroup}>
        <div className={styles.field}>
          <label className={styles.label}>Your skills</label>
          <div className={styles.skillInputRow}>
            <input
              className={styles.input}
              placeholder="e.g. React, Python, SQL"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addSkill(); } }}
            />
            <button className={styles.addBtn} onClick={addSkill}>Add</button>
          </div>
          {skills.length > 0 && (
            <div className={styles.skillTags}>
              {skills.map((s) => (
                <span key={s} className={styles.skillTag}>
                  {s}
                  <button className={styles.skillTagRemove} onClick={() => removeSkill(s)} aria-label={`Remove ${s}`}>×</button>
                </span>
              ))}
            </div>
          )}
        </div>
        <div className={styles.field}>
          <label className={styles.label}>Location</label>
          <input
            className={styles.input}
            placeholder="e.g. San Francisco, CA or Remote"
            value={location}
            onChange={(e) => onLocationChange(e.target.value)}
          />
        </div>
      </div>

      <div className={styles.actions}>
        <button className={styles.btnBack} onClick={onBack}>Back</button>
        <div className={styles.actionsRight}>
          <button className={styles.btnFinish} onClick={onFinish} disabled={loading}>
            {loading ? "Setting up…" : <>Finish setup <ArrowRight /></>}
          </button>
        </div>
      </div>
    </div>
  );
}
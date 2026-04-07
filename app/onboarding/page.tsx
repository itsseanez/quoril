"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import styles from "./onboarding.module.css";

const STEPS = ["Intent", "Role", "Skills"];

const ArrowRight = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
    <path d="M5 12h14M12 5l7 7-7 7" />
  </svg>
);

export default function OnboardingPage() {
  const router = useRouter();
  const [step, setStep] = useState(0);
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState({
    intentState: "",
    targetRole: "",
    experienceLevel: "",
    skills: [] as string[],
    location: "",
  });

  async function finish() {
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
          {STEPS.map((_, i) => (
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

        {step === 0 && (
          <IntentStep
            value={data.intentState}
            onChange={(v) => setData((d) => ({ ...d, intentState: v }))}
            onNext={() => setStep(1)}
          />
        )}
        {step === 1 && (
          <RoleStep
            value={data.targetRole}
            expValue={data.experienceLevel}
            onChange={(v) => setData((d) => ({ ...d, targetRole: v }))}
            onExpChange={(v) => setData((d) => ({ ...d, experienceLevel: v }))}
            onNext={() => setStep(2)}
            onBack={() => setStep(0)}
          />
        )}
        {step === 2 && (
          <SkillsStep
            skills={data.skills}
            location={data.location}
            onChange={(v) => setData((d) => ({ ...d, skills: v }))}
            onLocationChange={(v) => setData((d) => ({ ...d, location: v }))}
            onBack={() => setStep(1)}
            onFinish={finish}
            loading={loading}
          />
        )}
      </div>
    </div>
  );
}

function IntentStep({
  value,
  onChange,
  onNext,
}: {
  value: string;
  onChange: (v: string) => void;
  onNext: () => void;
}) {
  const options = [
    {
      id: "locked",
      label: "I know exactly what I want",
      sub: "e.g. Software Engineer Intern at a startup",
    },
    {
      id: "hybrid",
      label: "I have a direction but I'm open",
      sub: "e.g. Something in backend or DevOps",
    },
    {
      id: "exploratory",
      label: "I'm still figuring it out",
      sub: "Show me what's out there",
    },
  ];

  return (
    <div className={styles.stepContent}>
      <p className={styles.stepMeta}>Step 1 of 3</p>
      <h1 className={styles.stepTitle}>Where are you in your search?</h1>
      <p className={styles.stepSub}>
        This shapes how Quoril ranks and recommends jobs for you.
      </p>

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
        <div className={styles.actionsRight}>
          <button className={styles.btnNext} onClick={onNext} disabled={!value}>
            Continue <ArrowRight />
          </button>
        </div>
      </div>
    </div>
  );
}

function RoleStep({
  value,
  expValue,
  onChange,
  onExpChange,
  onNext,
  onBack,
}: {
  value: string;
  expValue: string;
  onChange: (v: string) => void;
  onExpChange: (v: string) => void;
  onNext: () => void;
  onBack: () => void;
}) {
  const levels = [
    { id: "entry", label: "Entry level" },
    { id: "mid", label: "Mid level" },
    { id: "senior", label: "Senior" },
  ];

  return (
    <div className={styles.stepContent}>
      <p className={styles.stepMeta}>Step 2 of 3</p>
      <h1 className={styles.stepTitle}>What role are you after?</h1>
      <p className={styles.stepSub}>
        Don't worry if you're not sure — you can update this anytime.
      </p>

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
        <button className={styles.btnBack} onClick={onBack}>
          Back
        </button>
        <div className={styles.actionsRight}>
          <button className={styles.btnNext} onClick={onNext} disabled={!expValue}>
            Continue <ArrowRight />
          </button>
        </div>
      </div>
    </div>
  );
}

function SkillsStep({
  skills,
  location,
  onChange,
  onLocationChange,
  onBack,
  onFinish,
  loading,
}: {
  skills: string[];
  location: string;
  onChange: (v: string[]) => void;
  onLocationChange: (v: string) => void;
  onBack: () => void;
  onFinish: () => void;
  loading: boolean;
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
      <p className={styles.stepMeta}>Step 3 of 3</p>
      <h1 className={styles.stepTitle}>Skills & location</h1>
      <p className={styles.stepSub}>
        Add the technologies and tools you know. These power your job match scores.
      </p>

      <div className={styles.fieldGroup}>
        <div className={styles.field}>
          <label className={styles.label}>Your skills</label>
          <div className={styles.skillInputRow}>
            <input
              className={styles.input}
              placeholder="e.g. React, Python, SQL"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  addSkill();
                }
              }}
            />
            <button className={styles.addBtn} onClick={addSkill}>
              Add
            </button>
          </div>
          {skills.length > 0 && (
            <div className={styles.skillTags}>
              {skills.map((s) => (
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
        <button className={styles.btnBack} onClick={onBack}>
          Back
        </button>
        <div className={styles.actionsRight}>
          <button
            className={styles.btnFinish}
            onClick={onFinish}
            disabled={loading}
          >
            {loading ? "Setting up…" : "Finish setup"}
            {!loading && <ArrowRight />}
          </button>
        </div>
      </div>
    </div>
  );
}
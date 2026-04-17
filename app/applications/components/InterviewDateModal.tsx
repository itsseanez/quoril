"use client";

import { useEffect, useRef, useState } from "react";
import styles from "./Interviewdatemodal.module.css";

interface InterviewDateModalProps {
  open: boolean;
  onConfirm: (date: string) => void;
  onCancel: () => void;
}

export function InterviewDateModal({ open, onConfirm, onCancel }: InterviewDateModalProps) {
  const [date, setDate] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (open) {
      setDate("");
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [open]);

  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onCancel();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onCancel]);

  if (!open) return null;

  function handleConfirm() {
    if (!date) return;
    onConfirm(date);
  }

  return (
    <div className={styles.overlay} onClick={(e) => { if (e.target === e.currentTarget) onCancel(); }}>
      <div className={styles.modal} role="dialog" aria-modal="true" aria-labelledby="modal-title">
        <div className={styles.body}>
          <div className={styles.titleRow}>
            <h2 id="modal-title" className={styles.title}>Schedule interview</h2>
            <button className={styles.closeBtn} onClick={onCancel} aria-label="Close">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round">
                <path d="M18 6 6 18M6 6l12 12"/>
              </svg>
            </button>
          </div>
          <p className={styles.subtitle}>Moving to interviewing — when's the interview?</p>

          <div className={styles.field}>
            <label className={styles.label} htmlFor="interview-date">Interview date</label>
            <div className={styles.inputWrap}>
              <svg className={styles.calIcon} width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                <rect x="3" y="4" width="18" height="18" rx="2"/>
                <path d="M16 2v4M8 2v4M3 10h18"/>
              </svg>
              <input
                ref={inputRef}
                id="interview-date"
                type="date"
                className={styles.input}
                value={date}
                onChange={(e) => setDate(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleConfirm()}
              />
            </div>
          </div>
        </div>

        <div className={styles.footer}>
          <button className={styles.cancelBtn} onClick={onCancel}>Cancel</button>
          <button className={styles.confirmBtn} onClick={handleConfirm} disabled={!date}>
            Confirm date
          </button>
        </div>
      </div>
    </div>
  );
}
// components/AiInsightCard.tsx
// Drop this into your dashboard page inside the two-col grid.
// It fetches a quick "progress" summary on load and links to /ai for the full experience.
"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import styles from "./AiInsightCard.module.css";

export default function AiInsightCard() {
  const [text, setText] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        const res = await fetch("/api/ai", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ mode: "actions" }),
        });

        if (!res.ok) throw new Error();

        const reader = res.body?.getReader();
        const decoder = new TextDecoder();
        if (!reader) throw new Error();

        let buffer = "";
        let collected = "";

        while (true) {
          const { done, value } = await reader.read();
          if (done || cancelled) break;

          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split("\n");
          buffer = lines.pop() ?? "";

          for (const line of lines) {
            if (!line.startsWith("data: ")) continue;
            const payload = line.slice(6).trim();
            if (payload === "[DONE]") break;
            try {
              const json = JSON.parse(payload);
              const chunk = json.choices?.[0]?.delta?.content;
              if (chunk) {
                collected += chunk;
                // Show first ~280 chars as a teaser
                if (!cancelled) setText(collected.slice(0, 280));
              }
            } catch { /* skip */ }
          }
        }
      } catch {
        if (!cancelled) setError(true);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    load();
    return () => { cancelled = true; };
  }, []);

  return (
    <div className={styles.card}>
      <div className={styles.cardHeader}>
        <div className={styles.headerLeft}>
          <span className={styles.icon}>✦</span>
          <span className={styles.title}>AI Advisor</span>
        </div>
      </div>

      <div className={styles.body}>
        {loading && !text && (
          <div className={styles.thinking}>
            <span className={styles.dot} />
            <span className={styles.dot} />
            <span className={styles.dot} />
          </div>
        )}
        {error && (
          <p className={styles.error}>Couldn't load insight. <Link href="/ai">Try the full page.</Link></p>
        )}
        {text && (
          <>
            <p className={styles.text}>
              {text}{loading && <span className={styles.cursor} />}
              {!loading && text.length >= 280 && "…"}
            </p>
            {!loading && (
              <Link href="/ai" className={styles.cta}>
                See full analysis →
              </Link>
            )}
          </>
        )}
      </div>
    </div>
  );
}
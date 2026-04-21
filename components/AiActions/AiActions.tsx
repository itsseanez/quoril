"use client";

import { useEffect, useState } from "react";
import styles from "./AiActions.module.css";

interface AiActionsProps {
  userId: string;
}

export default function AiActions({ userId }: AiActionsProps) {
  const [actions, setActions] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  useEffect(() => {
    let buffer = "";

    fetch("/api/ai", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ mode: "actions" }),
    })
      .then(async (res) => {
        if (!res.ok) throw new Error("Failed");

        const reader = res.body!.getReader();
        const decoder = new TextDecoder();

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          const chunk = decoder.decode(value, { stream: true });
          for (const line of chunk.split("\n")) {
            if (!line.startsWith("data: ")) continue;
            const data = line.slice(6).trim();
            if (data === "[DONE]") break;
            try {
              const json = JSON.parse(data);
              buffer += json.choices?.[0]?.delta?.content ?? "";
            } catch {
              // skip malformed SSE frames
            }
          }
        }

        // Each numbered item is two sentences. Extract only the first sentence.
        const parsed: string[] = [];
        const matches = [...buffer.matchAll(/\d+\.\s+([\s\S]+?)(?=\n\d+\.|\n*$)/g)];

        for (const m of matches) {
          const block = m[1].trim();
          // First sentence ends at the first ". " after at least 20 chars,
          // guarding against abbreviations at the start of the action.
          const splitIdx = block.indexOf(". ", 20);
          parsed.push(splitIdx !== -1 ? block.slice(0, splitIdx + 1).trim() : block);
        }

        setActions(parsed.slice(0, 5));
        setLoading(false);
      })
      .catch(() => {
        setError(true);
        setLoading(false);
      });
  }, [userId]);

  if (error) {
    return (
      <div className={styles.errorState}>
        Could not load actions right now.{" "}
        <button
          className={styles.retryBtn}
          onClick={() => { setError(false); setLoading(true); }}
        >
          Retry
        </button>
      </div>
    );
  }

  if (loading) {
    return (
      <div className={styles.skeletonList}>
        {[...Array(5)].map((_, i) => (
          <div
            key={i}
            className={styles.skeleton}
            style={{ animationDelay: `${i * 0.07}s` }}
          />
        ))}
      </div>
    );
  }

  return (
    <ol className={styles.list}>
      {actions.map((action, i) => (
        <li key={i} className={styles.item}>
          <span className={styles.num}>{i + 1}</span>
          <span className={styles.what}>{action}</span>
        </li>
      ))}
    </ol>
  );
}
// lib/ingestion/utils/html.ts
//
// HTML processing utilities for the Quoril ingestion pipeline.
// All functions are pure and stateless — safe to use in parallel adapter runs.

// ── Types ─────────────────────────────────────────────────────────────────────

export interface CleanDescriptionOptions {
  /** Maximum character length for the final plain-text description. Default: 600 */
  maxLength?: number;
  /** Minimum index at which a "cut phrase" triggers truncation. Default: 50 */
  minBlurbOffset?: number;
}

// ── Internal helpers ──────────────────────────────────────────────────────────

function decodeOnce(s: string): string {
  return s
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&apos;/g, "'")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&nbsp;/g, " ")
    .replace(/&#(\d+);/g, (_, code: string) => String.fromCharCode(Number(code)))
    .replace(/&#x([0-9a-f]+);/gi, (_, hex: string) =>
      String.fromCharCode(parseInt(hex, 16))
    );
}

// ── removeBoilerplate ─────────────────────────────────────────────────────────
//
// Strips company intro/outro boilerplate from raw ATS HTML before it is parsed.
// Expects real HTML tags — call decodeEntities first if the input is
// entity-encoded (e.g. Greenhouse's double-encoded content).
//
// Strategy 1: Remove known CSS-class blocks (content-intro, content-conclusion)
//             using a stack-based div counter so nested divs don't cause early
//             exits.
// Strategy 2: If boilerplate remains, slice at the first role-specific heading.

export function removeBoilerplate(html: string): string {
  let result = html;

  // Strategy 1 — strip named div blocks entirely
  for (const cls of ["content-intro", "content-conclusion"]) {
    const open = new RegExp(`<div[^>]*class=[^>]*${cls}[^>]*>`, "gi");
    let match: RegExpExecArray | null;

    while ((match = open.exec(result)) !== null) {
      let depth = 1;
      let i = match.index + match[0].length;

      while (i < result.length && depth > 0) {
        if (result[i] === "<") {
          if (result.slice(i, i + 5) === "<div " || result.slice(i, i + 5) === "<div>") {
            depth++;
          } else if (result.slice(i, i + 6) === "</div>") {
            depth--;
            if (depth === 0) {
              result = result.slice(0, match.index) + result.slice(i + 6);
              open.lastIndex = match.index;
              break;
            }
          }
        }
        i++;
      }
    }
  }

  // Strategy 2 — cut before the first role-specific heading
  const roleHeadings: RegExp[] = [
    /(<h[1-3][^>]*>\s*about\s+the\s+role)/i,
    /(<h[1-3][^>]*>\s*the\s+role)/i,
    /(<h[1-3][^>]*>\s*position\s+overview)/i,
    /(<h[1-3][^>]*>\s*job\s+summary)/i,
    /(<h[1-3][^>]*>\s*what\s+you.{0,10}do)/i,
    /(<h[1-3][^>]*>\s*responsibilities)/i,
    /(<h[1-3][^>]*>\s*about\s+this\s+role)/i,
    /(<h[1-3][^>]*>\s*role\s+overview)/i,
    /(<h[1-3][^>]*>\s*the\s+opportunity)/i,
  ];

  for (const pattern of roleHeadings) {
    const m = result.match(pattern);
    if (m && m.index !== undefined && m.index > 0) {
      result = result.slice(m.index);
      break;
    }
  }

  return result.trim();
}

// ── stripHtml ─────────────────────────────────────────────────────────────────
//
// Converts an HTML string to readable plain text.
//
// Tags are stripped first while entities are still escaped and safe — this
// prevents decoded &lt; / &gt; from being misread as tag delimiters.
// Entity decoding then runs twice to handle any remaining encoded sequences
// in text nodes (e.g. &amp; inside a paragraph).

export function stripHtml(html: string): string {
  return decodeOnce(decodeOnce(
    html
      // Newline before closing block tags so text doesn't concatenate
      .replace(/<\/(p|h[1-6]|li|div|section|article|header|footer|blockquote)>/gi, "\n")
      // Newline for self-closing breaks
      .replace(/<(br|hr)\s*\/?>/gi, "\n")
      // Strip all remaining tags
      .replace(/<[^>]+>/g, "")
  ))
    // Normalize whitespace — collapse runs of spaces/tabs but preserve newlines
    .replace(/[ \t]+/g, " ")
    .replace(/\n[ \t]+/g, "\n")
    .replace(/[ \t]+\n/g, "\n")
    // Collapse 3+ consecutive newlines to 2
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

// ── trimCompanyBlurb ──────────────────────────────────────────────────────────
//
// After HTML is stripped, removes any remaining company introduction copy
// that appears before the actual role description in plain text.
//
// Also truncates to `maxLength` at a sentence boundary so descriptions stored
// in the DB are consistently sized for matching and display.

export function trimCompanyBlurb(
  text: string,
  options: CleanDescriptionOptions = {}
): string {
  const { maxLength = 600, minBlurbOffset = 50 } = options;

  const cutPhrases: string[] = [
    "about the role",
    "the role",
    "position overview",
    "job summary",
    "what you will do",
    "what you'll do",
    "what you\u2019ll do", // curly apostrophe variant
    "responsibilities",
    "about this role",
    "role overview",
    "the opportunity",
    "your mission",
    "the position",
    "what we're looking for",
    "what we\u2019re looking for",
  ];

  const lower = text.toLowerCase();
  let earliest = -1;

  for (const phrase of cutPhrases) {
    const idx = lower.indexOf(phrase);
    if (idx !== -1 && (earliest === -1 || idx < earliest)) {
      earliest = idx;
    }
  }

  // Only cut if the phrase isn't right at the start — there must be preamble
  if (earliest > minBlurbOffset) {
    text = text.slice(earliest).trim();
  }

  // Strip the leading heading phrase itself (e.g. "About the Role:")
  text = text
    .replace(
      /^(about\s+the\s+role|the\s+role|position\s+overview|job\s+summary|what\s+you.{0,10}do|responsibilities|about\s+this\s+role|role\s+overview|the\s+opportunity|your\s+mission|the\s+position|what\s+we.{0,5}re\s+looking\s+for)\s*[:\-]?\s*/i,
      ""
    )
    .trim();

  // Truncate to maxLength at the last sentence boundary
  if (text.length > maxLength) {
    const truncated = text.slice(0, maxLength);
    const lastPeriod = truncated.lastIndexOf(".");
    // Only use sentence boundary if it's not too early (avoids tiny snippets)
    text =
      (lastPeriod > maxLength * 0.4
        ? truncated.slice(0, lastPeriod + 1)
        : truncated) + "...";
  }

  return text;
}

// ── cleanDescription ──────────────────────────────────────────────────────────
//
// Convenience function: runs the full pipeline on raw ATS HTML.
// Order: decodeEntities → removeBoilerplate → stripHtml → trimCompanyBlurb
//
// Decoding happens first so that removeBoilerplate's regexes see real HTML
// tags rather than entity-encoded ones (Greenhouse double-encodes its content).
//
// Use this in adapters instead of chaining the functions manually.

export function cleanDescription(
  rawHtml: string,
  options: CleanDescriptionOptions = {}
): string {
  const decoded = decodeOnce(rawHtml);
  return trimCompanyBlurb(stripHtml(removeBoilerplate(decoded)), options);
}

// ── decodeEntities ────────────────────────────────────────────────────────────
//
// Exported for cases where you need entity decoding on plain text that was
// already stripped but still contains escaped sequences (e.g. Lever's
// descriptionPlain field). Runs two passes to handle double-encoded input.

export function decodeEntities(text: string): string {
  return decodeOnce(decodeOnce(text));
}
import { describe, it, expect } from "vitest";
import { stripHtml, removeBoilerplate, trimCompanyBlurb, cleanDescription } from "@/lib/ingestion/utils/html";

describe("stripHtml", () => {
  it("strips basic tags", () => {
    expect(stripHtml("<p>Hello world</p>")).toBe("Hello world");
  });

  it("inserts newlines at block boundaries so text doesn't run together", () => {
    const result = stripHtml("<p>First</p><p>Second</p>");
    expect(result).toContain("\n");
    expect(result).toContain("First");
    expect(result).toContain("Second");
  });

  it("decodes HTML entities", () => {
    expect(stripHtml("&amp; &lt; &gt; &quot; &nbsp;")).toBe('& < > "');
  });

  it("decodes double-encoded entities", () => {
    expect(stripHtml("&amp;amp;")).toBe("&");
  });

  it("collapses excessive whitespace", () => {
    const result = stripHtml("<p>too   many   spaces</p>");
    expect(result).toBe("too many spaces");
  });
});

describe("removeBoilerplate", () => {
  it("removes content-intro div blocks", () => {
    const html = `<div class="content-intro"><p>We are a great company!</p></div><h2>About the Role</h2><p>You will build things.</p>`;
    const result = removeBoilerplate(html);
    expect(result).not.toContain("We are a great company");
    expect(result).toContain("About the Role");
  });

  it("removes content-conclusion div blocks", () => {
    const html = `<p>You will build things.</p><div class="content-conclusion"><p>We offer great benefits.</p></div>`;
    const result = removeBoilerplate(html);
    expect(result).not.toContain("We offer great benefits");
  });

  it("handles nested divs inside content-intro without early exit", () => {
    const html = `<div class="content-intro"><div><div><p>Nested blurb</p></div></div></div><p>Real content</p>`;
    const result = removeBoilerplate(html);
    expect(result).not.toContain("Nested blurb");
    expect(result).toContain("Real content");
  });

  it("slices at role heading if class-based removal didn't fully clean it", () => {
    const html = `<p>Company blurb here.</p><h2>About the Role</h2><p>You will build things.</p>`;
    const result = removeBoilerplate(html);
    expect(result).not.toContain("Company blurb here");
    expect(result).toContain("You will build things");
  });

  it("returns content untouched if no boilerplate detected", () => {
    const html = `<p>You will build things.</p>`;
    expect(removeBoilerplate(html)).toContain("You will build things");
  });
});

describe("trimCompanyBlurb", () => {
  it("removes preamble before known cut phrases", () => {
    const text = "We are a fast-growing startup changing the world.\n\nAbout the Role\nYou will build things.";
    const result = trimCompanyBlurb(text);
    expect(result).not.toContain("fast-growing startup");
    expect(result).toContain("You will build things");
  });

  it("does not cut if phrase appears at the very start", () => {
    const text = "About the role: You will build things.";
    const result = trimCompanyBlurb(text);
    expect(result).toContain("You will build things");
  });

  it("truncates long text at a sentence boundary", () => {
    const long = "You will build things. ".repeat(40);
    const result = trimCompanyBlurb(long);
    expect(result.length).toBeLessThanOrEqual(620); // maxLength + "..."
    expect(result.endsWith("...")).toBe(true);
  });

  it("respects custom maxLength", () => {
    const long = "You will build things. ".repeat(10);
    const result = trimCompanyBlurb(long, { maxLength: 100 });
    expect(result.length).toBeLessThanOrEqual(115);
  });
});

describe("cleanDescription — full pipeline", () => {
  it("runs the full pipeline and returns clean plain text", () => {
    const raw = `
      <div class="content-intro"><p>We are Acme Corp, a leader in innovation.</p></div>
      <h2>About the Role</h2>
      <p>You will build &amp; maintain our core platform.</p>
    `;
    const result = cleanDescription(raw);
    expect(result).not.toContain("Acme Corp");
    expect(result).toContain("build & maintain");
    expect(result).not.toContain("<");
  });
});
import { describe, it, expect } from "vitest";
import { isUsOrRemote, normalizeLocation, formatLocationDisplay } from "@/lib/ingestion/utils/location";

describe("isUsOrRemote", () => {
  // Should include
  it.each([
    [""],
    ["Remote"],
    ["remote"],
    ["Remote - US"],
    ["Worldwide"],
    ["Anywhere"],
    ["San Francisco, CA"],
    ["New York, NY"],
    ["Austin, TX"],
    ["California"],
    ["TX"],
    ["United States"],
    ["New York City"],
    ["Seattle, WA"],
    ["Washington, DC"],
    ["Remote (New York)"],
  ])("includes: %s", (location) => {
    expect(isUsOrRemote(location)).toBe(true);
  });

  // Should exclude
  it.each([
    ["London, UK"],
    ["Toronto, Canada"],
    ["Berlin, Germany"],
    ["Paris, France"],
    ["Sydney, Australia"],
    ["Bangalore, India"],
    ["Singapore"],
    ["Amsterdam, Netherlands"],
    ["Tokyo, Japan"],
    ["São Paulo, Brazil"],
  ])("excludes: %s", (location) => {
    expect(isUsOrRemote(location)).toBe(false);
  });
});

describe("normalizeLocation", () => {
  it("marks empty string as remote with null location", () => {
    expect(normalizeLocation("")).toEqual({ location: null, remote: true });
  });

  it("marks 'Remote' as remote", () => {
    expect(normalizeLocation("Remote")).toEqual({ location: "Remote", remote: true });
  });

  it("marks 'Remote - US' as remote, preserves location string", () => {
    expect(normalizeLocation("Remote - US")).toEqual({ location: "Remote - US", remote: true });
  });

  it("marks non-remote location correctly", () => {
    expect(normalizeLocation("San Francisco, CA")).toEqual({
      location: "San Francisco, CA",
      remote: false,
    });
  });

  it("trims whitespace", () => {
    const result = normalizeLocation("  Austin, TX  ");
    expect(result.location).toBe("Austin, TX");
  });
});

describe("formatLocationDisplay", () => {
  it("returns 'Remote' when remote and no location", () => {
    expect(formatLocationDisplay(null, true)).toBe("Remote");
  });

  it("returns 'Remote' when location is just 'Remote'", () => {
    expect(formatLocationDisplay("Remote", true)).toBe("Remote");
  });

  it("appends geographic context for 'Remote - New York'", () => {
    expect(formatLocationDisplay("Remote - New York", true)).toBe("Remote · New York");
  });

  it("returns location as-is when not remote", () => {
    expect(formatLocationDisplay("San Francisco, CA", false)).toBe("San Francisco, CA");
  });

  it("returns null when not remote and no location", () => {
    expect(formatLocationDisplay(null, false)).toBeNull();
  });
});
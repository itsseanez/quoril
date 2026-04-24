// lib/ingestion/utils/location.ts
//
// Location utilities for the Quoril ingestion pipeline.
// Determines whether a job location is US-based or remote,
// and normalizes raw location strings into a consistent shape.

// ── Types ─────────────────────────────────────────────────────────────────────

export interface NormalizedLocation {
  /** The cleaned location string, or null if unspecified/remote-only. */
  location: string | null;
  /** True if the role is remote or has no location constraint. */
  remote: boolean;
}

// ── Reference sets ────────────────────────────────────────────────────────────

/** Full US state names (lowercase). */
const US_STATE_NAMES = new Set([
  "alabama", "alaska", "arizona", "arkansas", "california", "colorado",
  "connecticut", "delaware", "florida", "georgia", "hawaii", "idaho",
  "illinois", "indiana", "iowa", "kansas", "kentucky", "louisiana",
  "maine", "maryland", "massachusetts", "michigan", "minnesota",
  "mississippi", "missouri", "montana", "nebraska", "nevada",
  "new hampshire", "new jersey", "new mexico", "new york",
  "north carolina", "north dakota", "ohio", "oklahoma", "oregon",
  "pennsylvania", "rhode island", "south carolina", "south dakota",
  "tennessee", "texas", "utah", "vermont", "virginia", "washington",
  "west virginia", "wisconsin", "wyoming",
]);

/** USPS two-letter abbreviations (lowercase), including DC and territories. */
const US_STATE_ABBREVS = new Set([
  "al", "ak", "az", "ar", "ca", "co", "ct", "de", "fl", "ga",
  "hi", "id", "il", "in", "ia", "ks", "ky", "la", "me", "md",
  "ma", "mi", "mn", "ms", "mo", "mt", "ne", "nv", "nh", "nj",
  "nm", "ny", "nc", "nd", "oh", "ok", "or", "pa", "ri", "sc",
  "sd", "tn", "tx", "ut", "vt", "va", "wa", "wv", "wi", "wy",
  "dc", "pr", "gu", "vi", "mp", "as",
]);

/**
 * Major US metros that appear in ATS listings but aren't caught by state
 * matching (e.g. "New York City" doesn't contain a state abbreviation token).
 * Stored as substrings to match against the full lowercased location string.
 */
const US_CITY_SUBSTRINGS = new Set([
  "san francisco", "new york city", "new york, ny", "los angeles",
  "seattle", "austin", "boston", "chicago", "denver", "atlanta",
  "miami", "portland", "san jose", "san diego", "brooklyn",
  "manhattan", "nyc", "silicon valley", "bay area", "sf, ca",
  "palo alto", "mountain view", "menlo park", "redwood city",
  "bellevue", "kirkland", "phoenix", "salt lake city", "raleigh",
  "charlotte", "nashville", "minneapolis", "detroit", "pittsburgh",
  "dallas", "houston", "philadelphia", "las vegas", "orlando",
  "tampa", "san antonio", "kansas city", "st. louis", "baltimore",
  "washington, d.c", "washington dc",
]);

/**
 * Non-US country/city names. If any of these substrings appear in the location
 * string, the job is rejected as non-US (unless a US indicator also appears,
 * which is handled in isUsOrRemote below).
 */
const NON_US_SUBSTRINGS: string[] = [
  // Countries
  "canada", "united kingdom", "germany", "france", "australia",
  "india", "brazil", "netherlands", "spain", "italy", "poland",
  "sweden", "singapore", "japan", "china", "mexico", "ireland",
  "switzerland", "denmark", "norway", "finland", "austria",
  "belgium", "portugal", "israel", "new zealand", "south korea",
  "taiwan", "hong kong", "argentina", "colombia", "chile",
  "ukraine", "czech republic", "hungary", "romania", "bulgaria",
  "greece", "turkey", "saudi arabia", "uae", "south africa",
  "nigeria", "kenya", "ghana", "egypt", "pakistan", "bangladesh",
  "indonesia", "malaysia", "philippines", "vietnam", "thailand",
  // Major non-US cities
  "toronto", "vancouver", "montreal", "ottawa", "calgary",
  "london", "manchester", "edinburgh", "birmingham", "bristol",
  "berlin", "munich", "hamburg", "frankfurt", "cologne",
  "paris", "lyon", "marseille",
  "sydney", "melbourne", "brisbane", "perth",
  "amsterdam", "rotterdam",
  "madrid", "barcelona",
  "milan", "rome",
  "warsaw", "krakow",
  "stockholm", "gothenburg",
  "copenhagen",
  "oslo",
  "helsinki",
  "zurich", "geneva",
  "vienna",
  "brussels",
  "lisbon",
  "tel aviv",
  "tokyo", "osaka",
  "seoul",
  "beijing", "shanghai",
  "bangalore", "mumbai", "delhi", "hyderabad", "pune",
  "são paulo", "rio de janeiro",
  "mexico city", "guadalajara",
  "dublin",
  "auckland",
  "jakarta",
  "kuala lumpur",
  "manila",
  "bangkok",
  "ho chi minh",
];

// ── isUsOrRemote ──────────────────────────────────────────────────────────────
//
// Returns true if a raw location string represents a US-based or remote role.
//
// Decision tree:
//   1. Empty / "Worldwide" / "Anywhere" → remote, allow
//   2. Contains "remote" → allow (location may still specify a country below,
//      but for Quoril's purposes remote-anywhere roles are shown)
//   3. Contains an explicit non-US country or city → reject
//   4. Contains an explicit US indicator ("united states", ", us", etc.) → allow
//   5. Tokenise on commas/slashes and check each token against state names
//      and abbreviations → allow if any match
//   6. Check full string for US city substrings → allow if found
//   7. Default → reject (conservative — better to miss a US job than to show
//      a non-US job)

export function isUsOrRemote(raw: string): boolean {
  if (!raw) return true;

  const lower = raw.toLowerCase().trim();

  // 1. Explicit remote / unspecified
  if (lower === "worldwide" || lower === "anywhere" || lower === "remote") {
    return true;
  }

  // 2. Contains "remote" — allow regardless of country suffix
  //    (handles "Remote - US", "Remote (USA)", "Remote / Anywhere", etc.)
  if (lower.includes("remote")) return true;

  // 3. Reject if an explicit non-US country or city appears
  //    We do this before the US checks so "London, UK" doesn't sneak through
  //    a "United Kingdom" check that comes after finding "London".
  for (const nonUs of NON_US_SUBSTRINGS) {
    if (lower.includes(nonUs)) return false;
  }

  // 4. Explicit US markers
  if (
    lower.includes("united states") ||
    lower.includes(", us") ||
    lower.includes(", usa") ||
    lower.includes("(us)") ||
    lower.includes("(usa)") ||
    lower.endsWith(" us") ||
    lower.endsWith(" usa")
  ) {
    return true;
  }

  // 5. Tokenize on common separators and check each token
  const tokens = lower
    .split(/[,\/|•\-–—]+/)
    .map((t) => t.trim())
    .filter(Boolean);

  for (const token of tokens) {
    if (US_STATE_NAMES.has(token)) return true;
    if (US_STATE_ABBREVS.has(token)) return true;
  }

  // 6. US city substring check (applied to the full string, not tokens,
  //    because city names often appear mid-string without delimiters)
  for (const city of US_CITY_SUBSTRINGS) {
    if (lower.includes(city)) return true;
  }

  // 7. Conservative default — reject
  return false;
}

// ── normalizeLocation ─────────────────────────────────────────────────────────
//
// Converts a raw ATS location string into a { location, remote } pair.
//
// - `remote` is true if the role is explicitly remote or has no location.
// - `location` is the cleaned raw string (trimmed, null if empty), kept as-is
//   for display purposes. We intentionally don't parse it further here because
//   structured city/state/country parsing is a separate concern (and fragile).

export function normalizeLocation(raw: string): NormalizedLocation {
  const trimmed = raw?.trim() ?? "";
  const lower = trimmed.toLowerCase();

  const remote =
    !trimmed ||
    lower === "worldwide" ||
    lower === "anywhere" ||
    lower === "remote" ||
    lower.includes("remote");

  return {
    location: trimmed || null,
    remote,
  };
}

// ── formatLocationDisplay ─────────────────────────────────────────────────────
//
// Produces a human-readable display string for the job card UI.
// Examples:
//   remote=true,  location="Remote - US"        → "Remote"
//   remote=true,  location="Remote (New York)"  → "Remote · New York"
//   remote=false, location="San Francisco, CA"  → "San Francisco, CA"
//   remote=false, location=null                 → null

export function formatLocationDisplay(
  location: string | null,
  remote: boolean
): string | null {
  if (remote) {
    if (!location) return "Remote";

    // If the location string adds geographic context beyond just "remote",
    // surface that context after a separator.
    const cleaned = location
      .replace(/remote\s*[-–—()/\\]?\s*/gi, "")
      .replace(/^\s*[-–—()/\\]\s*/, "")
      .replace(/\s*[-–—()/\\]\s*$/, "")
      .trim();

    return cleaned ? `Remote · ${cleaned}` : "Remote";
  }

  return location;
}

// ── extractCountry ────────────────────────────────────────────────────────────
//
// Best-effort extraction of a country string from a raw location.
// Used for analytics and future multi-region expansion — not for filtering.
// Returns "US" for US locations, "Unknown" if undetermined.

export function extractCountry(raw: string): string {
  if (!raw) return "Unknown";
  const lower = raw.toLowerCase();

  if (
    lower.includes("united states") ||
    lower.includes(", us") ||
    lower.includes(", usa") ||
    isUsOrRemote(raw)
  ) {
    return "US";
  }

  // Spot-check common non-US countries for analytics
  const countryMap: [string, string][] = [
    ["canada", "CA"],
    ["united kingdom", "GB"],
    ["uk", "GB"],
    ["germany", "DE"],
    ["france", "FR"],
    ["australia", "AU"],
    ["india", "IN"],
    ["brazil", "BR"],
    ["netherlands", "NL"],
    ["singapore", "SG"],
    ["ireland", "IE"],
  ];

  for (const [substr, code] of countryMap) {
    if (lower.includes(substr)) return code;
  }

  return "Unknown";
}
// lib/ingestion/utils/seniority.ts

import { SeniorityLevel } from "../types";

const SENIORITY_PATTERNS: [RegExp, SeniorityLevel][] = [
  [/\b(intern|internship|co-op)\b/i,                          "intern"],
  [/\b(junior|jr\.?|associate(?!\s+director))\b/i,            "junior"],
  [/\b(staff|principal|distinguished)\b/i,                    "staff"],
  [/\b(senior|sr\.?)\b/i,                                     "senior"],
  [/\b(lead|tech lead|team lead)\b/i,                         "staff"],
  [/\b(director|vp|vice president|head of|cto|ceo|cpo)\b/i,  "exec"],
  [/\b(manager|engineering manager|em\b)\b/i,                 "exec"],
];

export function deriveSeniority(title: string): SeniorityLevel | null {
  for (const [pattern, level] of SENIORITY_PATTERNS) {
    if (pattern.test(title)) return level;
  }
  return "mid"; // default assumption for unlabeled roles
}
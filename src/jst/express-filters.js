/**
 * Detect "ส่งด่วน / ส่งทันที" orders by matching the merged channel string
 * (which combines LogisticsCompanyName, Label.Name, Label.Code, etc.
 *  — see order-parser.js).
 *
 * Verified markers from real JST data (2026-05-23):
 *   LogisticsCompanyName values to alert on:
 *     - "Instant Delivery - ส่งทันที (แพ็ก 30 นาที)"     → ส่งทันที (urgent)
 *     - "Instant Delivery - ส่งทันที (แพ็ก 2 ชั่วโมง)"   → ส่งทันที (urgent)
 *     - "Express Delivery (SPX)"                          → ส่งด่วน
 *     - "Express Delivery (SHP Food)"                     → ส่งด่วน
 *
 * NOT matched (24h+ standard, too noisy for must-act-within-30-min alert):
 *   - "SPX Express", "Flash Express", "J&T Express", "LEX TH",
 *     "Standard Delivery - ส่งธรรมดาในประเทศ"
 */

const DEFAULT_PATTERNS = [
  "Instant Delivery - ส่งทันที (แพ็ก 30 นาที)",
  "Instant Delivery - ส่งทันที (แพ็ก 2 ชั่วโมง)",
  "Express Delivery (SPX)",
  "Express Delivery (SHP Food)",
];

// Substrings that bump a matched order from "ส่งด่วน" → "ส่งทันที" (urgent,
// usually 30-min or 2-hr pack window). Express Delivery (SPX) and (SHP Food)
// are still same-day but don't have a tight pack deadline, so they stay as
// "ส่งด่วน".
const URGENT_INSTANT_HINTS = [
  "instant delivery",
  "ส่งทันที",
  "จัดส่งทันที",
  "jsthourdelivery",
];

const normalize = (s) => String(s || "").toLowerCase().replace(/\s+/g, " ").trim();

export async function loadPatterns() {
  const v = await chrome.storage.sync.get({ expressPatterns: DEFAULT_PATTERNS });
  return v.expressPatterns;
}

export function savePatterns(patterns) {
  const cleaned = (patterns || [])
    .map((p) => normalize(p))
    .filter((p) => p.length > 0);
  return chrome.storage.sync.set({ expressPatterns: cleaned });
}

export function matchesExpress(channel, patterns = DEFAULT_PATTERNS) {
  const c = normalize(channel);
  if (!c) return false;
  return patterns.some((p) => c.includes(normalize(p)));
}

export function classifyExpressType(channel) {
  const c = normalize(channel);
  if (URGENT_INSTANT_HINTS.some((h) => c.includes(normalize(h)))) return "ส่งทันที";
  return "ส่งด่วน";
}

export const __TESTING__ = { DEFAULT_PATTERNS, URGENT_INSTANT_HINTS, normalize };

/**
 * Detect "ส่งด่วน / ส่งทันที" orders by matching the merged channel string
 * (which combines LogisticsCompanyName, Label.Name, Label.Code, etc.
 *  — see order-parser.js).
 *
 * Verified markers from real JST data:
 *   - LogisticsCompanyName: "Instant Delivery - ส่งทันที (แพ็ก 2 ชั่วโมง)"
 *   - Label.Code: "JstHourDelivery"
 *   - Label.Name: "จัดส่งทันที"
 *
 * Other potential brand names (not yet seen in samples, included for safety):
 *   - "Shopee Express Instant", "SPX Instant Delivery"
 *   - "Lalamove", "GrabExpress", "LINE MAN", "Pandago", "Robinhood"
 *
 * NOTE: "SPX Express" / "Flash Express" / "J&T Express" / "JstNextDay" are
 * standard (24h+) express and are NOT matched by default — they're too noisy
 * for a "must-act-within-30-min" alert.
 */

const DEFAULT_PATTERNS = [
  "ส่งทันที",
  "จัดส่งทันที",
  "ส่งภายในวันเดียวกัน",
  "ส่งด่วนทันใจ",
  "JstHourDelivery",
  "Instant Delivery",
  "แพ็ก 30 นาที",
  "แพ็ก 2 ชั่วโมง",
  "shopee express instant",
  "spx instant",
  "spx same day",
  "spx sameday",
  "Lalamove",
  "GrabExpress",
  "Grab Express",
  "LINE MAN",
  "LineMan",
  "Pandago",
  "Robinhood",
];

const URGENT_INSTANT_HINTS = [
  "ส่งทันที",
  "จัดส่งทันที",
  "JstHourDelivery",
  "instant",
  "lalamove",
  "grab",
  "lineman",
  "line man",
  "pandago",
  "robinhood",
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

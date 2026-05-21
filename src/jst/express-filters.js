const DEFAULT_PATTERNS = [
  "ส่งด่วน",
  "ส่งทันที",
  "ส่งภายในวันเดียวกัน",
  "ส่งด่วนทันใจ",
  "shopee express instant",
  "shopee express same day",
  "spx instant",
  "spx same day",
  "spx instant delivery",
  "spx sameday",
  "lalamove",
  "grabexpress",
  "grab express",
  "line man",
  "lineman",
  "pandago",
  "robinhood",
];

const URGENT_INSTANT_HINTS = ["ส่งทันที", "instant", "lalamove", "grab", "lineman", "line man", "pandago"];

const normalize = (s) => String(s || "").toLowerCase().replace(/\s+/g, " ").trim();

export function loadPatterns() {
  return chrome.storage.sync.get({ expressPatterns: DEFAULT_PATTERNS }).then((v) => v.expressPatterns);
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

/** Classify into "ส่งทันที" (30-min SLA) vs "ส่งด่วน" (general express). */
export function classifyExpressType(channel) {
  const c = normalize(channel);
  if (URGENT_INSTANT_HINTS.some((h) => c.includes(h))) return "ส่งทันที";
  return "ส่งด่วน";
}

export const __TESTING__ = { DEFAULT_PATTERNS, normalize };

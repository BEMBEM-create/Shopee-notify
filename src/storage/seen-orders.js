const PREFIX = "seen:jst:";
const PRUNE_AFTER_MS = 7 * 24 * 60 * 60 * 1000;

const k = (orderSn) => `${PREFIX}${orderSn}`;

export async function getSeen(orderSn) {
  const key = k(orderSn);
  const v = await chrome.storage.local.get(key);
  return v[key] || null;
}

export async function markAnnounced(orderSn, patch = {}) {
  const key = k(orderSn);
  const cur = (await chrome.storage.local.get(key))[key] || {};
  const now = Date.now();
  const next = {
    firstSeenAt: cur.firstSeenAt || now,
    announcedAt: cur.announcedAt || now,
    lastUrgentAt: cur.lastUrgentAt || null,
    ...patch,
  };
  await chrome.storage.local.set({ [key]: next });
  return next;
}

export async function markUrgentAnnounced(orderSn) {
  return markAnnounced(orderSn, { lastUrgentAt: Date.now() });
}

export async function pruneOld() {
  const all = await chrome.storage.local.get(null);
  const now = Date.now();
  const toRemove = [];
  for (const [key, val] of Object.entries(all)) {
    if (!key.startsWith(PREFIX)) continue;
    const seen = val?.firstSeenAt || 0;
    if (now - seen > PRUNE_AFTER_MS) toRemove.push(key);
  }
  if (toRemove.length) await chrome.storage.local.remove(toRemove);
  return toRemove.length;
}

export async function listSeen() {
  const all = await chrome.storage.local.get(null);
  return Object.entries(all)
    .filter(([key]) => key.startsWith(PREFIX))
    .map(([key, val]) => ({ orderSn: key.slice(PREFIX.length), ...val }));
}

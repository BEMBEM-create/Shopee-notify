import { JstWebSource } from "../sources/jst-web.js";
import { registerSource } from "../sources/source.js";
import { loadPatterns, matchesExpress, classifyExpressType } from "../jst/express-filters.js";
import { getSeen, markAnnounced, markUrgentAnnounced, pruneOld } from "../storage/seen-orders.js";
import { synthesize } from "../tts/google-tts.js";

const TAG = "[shopee-notify/sw]";
const log = (...a) => console.log(TAG, ...a);
const warn = (...a) => console.warn(TAG, ...a);
const error = (...a) => console.error(TAG, ...a);

const ALARM_POLL = "poll-jst";
const ALARM_URGENT = "urgent-sweep";
const ALARM_PRUNE = "prune-seen";

const DEFAULTS = {
  enabled: false,
  pollIntervalSec: 30,
  urgentThresholdMin: 10,
  ttsProvider: "google",
  voice: "th-TH-Neural2-C",
  speakingRate: 1.0,
  googleApiKey: "",
  muted: false,
  quietHoursStart: "",
  quietHoursEnd: "",
  lastPollAt: 0,
  lastPollOrders: 0,
  lastPollError: "",
  announcedToday: 0,
  announcedDateKey: "",
};

registerSource(JstWebSource);

chrome.runtime.onInstalled.addListener(async () => {
  log("installed");
  const cur = await chrome.storage.local.get(Object.keys(DEFAULTS));
  const next = { ...DEFAULTS, ...cur };
  await chrome.storage.local.set(next);
  await rescheduleAlarms();
});

chrome.runtime.onStartup.addListener(() => {
  rescheduleAlarms().catch(error);
});

chrome.alarms.onAlarm.addListener(async (alarm) => {
  try {
    if (alarm.name === ALARM_POLL) await pollOnce();
    else if (alarm.name === ALARM_URGENT) await urgentSweep();
    else if (alarm.name === ALARM_PRUNE) await pruneOld();
  } catch (e) {
    error(`alarm ${alarm.name} failed:`, e);
  }
});

chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
  if (msg?.target === "offscreen") return;
  (async () => {
    try {
      if (msg?.type === "poll-now") {
        await pollOnce();
        sendResponse({ ok: true });
      } else if (msg?.type === "settings-updated") {
        await rescheduleAlarms();
        sendResponse({ ok: true });
      } else if (msg?.type === "simulate-order") {
        await handleOrder(msg.order, { simulated: true });
        sendResponse({ ok: true });
      } else if (msg?.type === "test-voice") {
        await announce({ text: msg.text || "ทดสอบเสียงไทย Siri-like", forceSpeak: true });
        sendResponse({ ok: true });
      } else if (msg?.type === "get-status") {
        const s = await getSettings();
        sendResponse({ ok: true, status: s });
      } else {
        sendResponse({ ok: false, reason: "unknown" });
      }
    } catch (e) {
      error("onMessage:", e);
      sendResponse({ ok: false, error: String(e.message || e) });
    }
  })();
  return true;
});

async function getSettings() {
  const cur = await chrome.storage.local.get(Object.keys(DEFAULTS));
  return { ...DEFAULTS, ...cur };
}

async function rescheduleAlarms() {
  const { enabled, pollIntervalSec } = await getSettings();
  await chrome.alarms.clearAll();
  if (enabled) {
    const periodInMinutes = Math.max(0.25, pollIntervalSec / 60);
    chrome.alarms.create(ALARM_POLL, { periodInMinutes });
    chrome.alarms.create(ALARM_URGENT, { periodInMinutes: 1 });
  }
  chrome.alarms.create(ALARM_PRUNE, { periodInMinutes: 24 * 60 });
  log("alarms scheduled, enabled=", enabled);
}

async function pollOnce() {
  const settings = await getSettings();
  if (!settings.enabled) return;
  const patterns = await loadPatterns();
  const ctx = { now: new Date(), lookbackMinutes: 90, log, warn, error };
  try {
    const orders = await JstWebSource.fetchNewOrders(ctx);
    await chrome.storage.local.set({
      lastPollAt: Date.now(),
      lastPollOrders: orders.length,
      lastPollError: "",
    });
    for (const o of orders) {
      if (!matchesExpress(o.channel, patterns)) continue;
      await handleOrder(o, { simulated: false });
    }
  } catch (e) {
    await chrome.storage.local.set({
      lastPollAt: Date.now(),
      lastPollError: String(e.message || e),
    });
  }
}

async function handleOrder(order, { simulated }) {
  const seen = await getSeen(order.orderSn);
  if (seen?.announcedAt && !simulated) return;
  await markAnnounced(order.orderSn, {
    deadlineSec: order.deadlineSec,
    shopName: order.shopName,
    channel: order.channel,
    type: classifyExpressType(order.channel),
  });
  await bumpAnnouncedCount();
  await announceOrder(order);
}

async function urgentSweep() {
  const settings = await getSettings();
  if (!settings.enabled) return;
  const all = await chrome.storage.local.get(null);
  const now = Math.floor(Date.now() / 1000);
  for (const [key, val] of Object.entries(all)) {
    if (!key.startsWith("seen:jst:")) continue;
    if (!val?.announcedAt || !val?.deadlineSec) continue;
    const minutesLeft = Math.round((val.deadlineSec - now) / 60);
    if (minutesLeft <= 0) continue;
    if (minutesLeft > settings.urgentThresholdMin) continue;
    const lastUrgent = val.lastUrgentAt || 0;
    if (Date.now() - lastUrgent < 5 * 60_000) continue;
    const orderSn = key.slice("seen:jst:".length);
    await markUrgentAnnounced(orderSn);
    await announceOrder({
      orderSn,
      shopName: val.shopName || "",
      channel: val.channel || "",
      deadlineSec: val.deadlineSec,
    }, { urgent: true });
  }
}

async function announceOrder(order, { urgent = false } = {}) {
  const settings = await getSettings();
  if (settings.muted) return;
  if (inQuietHours(settings)) return;
  const minutesLeft = order.deadlineSec
    ? Math.max(0, Math.round((order.deadlineSec - Math.floor(Date.now() / 1000)) / 60))
    : null;
  const type = classifyExpressType(order.channel);
  const prefix = urgent ? "เตือนซ้ำ " : "";
  const tail = minutesLeft != null ? ` ต้องจัดส่งภายใน ${minutesLeft} นาที` : "";
  const shop = order.shopName ? ` ของร้าน ${order.shopName}` : "";
  const text = `${prefix}คุณมีออเดอร์${type}${shop}${tail}`;

  await chrome.notifications.create(`order-${order.orderSn}-${Date.now()}`, {
    type: "basic",
    iconUrl: chrome.runtime.getURL("assets/icon-128.png"),
    title: urgent ? `ออเดอร์${type} ใกล้หมดเวลา!` : `ออเดอร์${type}ใหม่`,
    message: `${order.shopName || "(ไม่ระบุร้าน)"} · เหลือ ${minutesLeft ?? "?"} นาที`,
    priority: 2,
    silent: true,
  });

  await announce({ text });
}

async function announce({ text, forceSpeak = false }) {
  await ensureOffscreen();
  const settings = await getSettings();
  let audioBase64 = null;
  if (settings.ttsProvider === "google" && settings.googleApiKey) {
    try {
      const r = await synthesize({
        text,
        apiKey: settings.googleApiKey,
        voice: settings.voice,
        speakingRate: settings.speakingRate,
      });
      audioBase64 = r.audioBase64;
    } catch (e) {
      warn("google tts failed, falling back to web speech:", e.message);
    }
  }
  await chrome.runtime.sendMessage({
    target: "offscreen",
    type: "play",
    payload: {
      chimeUrl: chrome.runtime.getURL("assets/chime.wav"),
      audioBase64,
      text: !audioBase64 || forceSpeak ? text : null,
      speakingRate: settings.speakingRate,
    },
  });
}

async function ensureOffscreen() {
  const url = chrome.runtime.getURL("src/offscreen/offscreen.html");
  if (chrome.offscreen?.hasDocument) {
    const has = await chrome.offscreen.hasDocument();
    if (has) return;
  }
  try {
    await chrome.offscreen.createDocument({
      url,
      reasons: ["AUDIO_PLAYBACK"],
      justification: "Play TTS audio for Shopee express order notifications",
    });
  } catch (e) {
    if (!String(e.message).includes("Only a single offscreen")) throw e;
  }
}

function inQuietHours(settings) {
  const { quietHoursStart, quietHoursEnd } = settings;
  if (!quietHoursStart || !quietHoursEnd) return false;
  const now = new Date();
  const mins = now.getHours() * 60 + now.getMinutes();
  const [sH, sM] = quietHoursStart.split(":").map(Number);
  const [eH, eM] = quietHoursEnd.split(":").map(Number);
  const start = sH * 60 + sM;
  const end = eH * 60 + eM;
  return start < end ? mins >= start && mins < end : mins >= start || mins < end;
}

async function bumpAnnouncedCount() {
  const cur = await chrome.storage.local.get(["announcedToday", "announcedDateKey"]);
  const today = new Date().toISOString().slice(0, 10);
  const next =
    cur.announcedDateKey === today
      ? { announcedToday: (cur.announcedToday || 0) + 1, announcedDateKey: today }
      : { announcedToday: 1, announcedDateKey: today };
  await chrome.storage.local.set(next);
}

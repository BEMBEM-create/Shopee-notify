const FIELDS = [
  "enabled",
  "pollIntervalSec",
  "urgentThresholdMin",
  "muted",
  "quietHoursStart",
  "quietHoursEnd",
  "ttsProvider",
  "googleApiKey",
  "voice",
  "speakingRate",
];

const DEFAULT_PATTERNS = [
  "ส่งด่วน",
  "ส่งทันที",
  "Shopee Express Instant",
  "Shopee Express Same Day",
  "SPX Instant",
  "SPX Same Day",
  "Lalamove",
  "GrabExpress",
  "LINE MAN",
  "Pandago",
];

const $ = (id) => document.getElementById(id);

async function load() {
  const local = await chrome.storage.local.get(FIELDS);
  const sync = await chrome.storage.sync.get({ expressPatterns: DEFAULT_PATTERNS });
  for (const f of FIELDS) {
    const el = $(f);
    if (!el) continue;
    const v = local[f];
    if (el.type === "checkbox") el.checked = !!v;
    else if (v != null) el.value = v;
  }
  $("speakingRateVal").textContent = Number($("speakingRate").value).toFixed(2);
  $("expressPatterns").value = sync.expressPatterns.join("\n");
  await refreshStatus();
}

async function save() {
  const local = {};
  for (const f of FIELDS) {
    const el = $(f);
    if (!el) continue;
    if (el.type === "checkbox") local[f] = el.checked;
    else if (el.type === "number" || el.tagName === "SELECT" && /^\d/.test(el.value)) local[f] = Number(el.value);
    else if (el.id === "speakingRate") local[f] = Number(el.value);
    else if (el.id === "pollIntervalSec" || el.id === "urgentThresholdMin") local[f] = Number(el.value);
    else local[f] = el.value;
  }
  const patterns = $("expressPatterns").value.split("\n").map((s) => s.trim()).filter(Boolean);
  await chrome.storage.local.set(local);
  await chrome.storage.sync.set({ expressPatterns: patterns });
  await chrome.runtime.sendMessage({ type: "settings-updated" });
  $("saveStatus").textContent = "บันทึกแล้ว · " + new Date().toLocaleTimeString();
  setTimeout(() => ($("saveStatus").textContent = ""), 3000);
  await refreshStatus();
}

async function refreshStatus() {
  const s = await chrome.runtime.sendMessage({ type: "get-status" }).catch(() => null);
  if (!s?.status) { $("status").textContent = "ไม่สามารถดึงสถานะได้"; return; }
  const st = s.status;
  const lastPoll = st.lastPollAt ? new Date(st.lastPollAt).toLocaleString() : "—";
  $("status").textContent = [
    `enabled: ${st.enabled}`,
    `poll interval: ${st.pollIntervalSec}s`,
    `urgent threshold: ${st.urgentThresholdMin} min`,
    `last poll: ${lastPoll}`,
    `last poll orders: ${st.lastPollOrders}`,
    `last poll error: ${st.lastPollError || "(none)"}`,
    `announced today: ${st.announcedToday}`,
  ].join("\n");
}

$("speakingRate").addEventListener("input", (e) => {
  $("speakingRateVal").textContent = Number(e.target.value).toFixed(2);
});

$("save").addEventListener("click", save);

$("testVoice").addEventListener("click", async () => {
  await chrome.runtime.sendMessage({
    type: "test-voice",
    text: "ทดสอบเสียงไทย คุณมีออเดอร์ส่งด่วน ของร้านทดสอบ ต้องจัดส่งภายใน 30 นาที",
  });
});

$("simulateOrder").addEventListener("click", async () => {
  const now = Math.floor(Date.now() / 1000);
  const fakeOrder = {
    id: `jst:SIM-${Date.now()}`,
    orderSn: `SIM-${Date.now()}`,
    shopName: "ร้านทดสอบ ABC",
    platform: "Shopee",
    channel: "Shopee Express Instant",
    payTimeSec: now,
    deadlineSec: now + 28 * 60,
    status: "wait_ship",
    raw: { sim: true },
  };
  await chrome.runtime.sendMessage({ type: "simulate-order", order: fakeOrder });
});

$("pollNow").addEventListener("click", async () => {
  await chrome.runtime.sendMessage({ type: "poll-now" });
  setTimeout(refreshStatus, 1000);
});

load();
setInterval(refreshStatus, 10_000);

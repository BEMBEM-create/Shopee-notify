const FIELDS = [
  "enabled",
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
  "ส่งทันที",
  "จัดส่งทันที",
  "JstHourDelivery",
  "Instant Delivery",
  "แพ็ก 30 นาที",
  "แพ็ก 2 ชั่วโมง",
  "shopee express instant",
  "spx instant",
  "spx same day",
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
    else if (el.id === "speakingRate") local[f] = Number(el.value);
    else if (el.id === "urgentThresholdMin") local[f] = Number(el.value);
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
  const lastCap = st.lastCaptureAt ? new Date(st.lastCaptureAt).toLocaleString() : "—";
  const lag = st.lastCaptureAt
    ? Math.round((Date.now() - st.lastCaptureAt) / 1000) + "s ago"
    : "ไม่เคยจับข้อมูล (ต้องเปิดแท็บ JST ค้างไว้)";
  $("status").textContent = [
    `enabled: ${st.enabled}`,
    `urgent threshold: ${st.urgentThresholdMin} min`,
    `last capture: ${lastCap} (${lag})`,
    `last capture orders: ${st.lastCaptureOrders}`,
    `  ของซึ่งเป็นส่งด่วน: ${st.lastCaptureExpress}`,
    `last error: ${st.lastError || "(none)"}`,
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
    text: "ทดสอบเสียงไทย คุณมีออเดอร์ส่งทันที ต้องแพ็คภายใน 30 นาที",
  });
});

$("simulateOrder").addEventListener("click", async () => {
  const now = Math.floor(Date.now() / 1000);
  const fakeOrder = {
    id: `jst:SIM-${Date.now()}`,
    orderId: `SIM-${Date.now()}`,
    orderSn: `2605SIM${Date.now().toString().slice(-6)}`,
    shopName: "Maydicine_drugstore_Shopee",
    platform: "Shopee",
    channel: "Instant Delivery - ส่งทันที (แพ็ก 30 นาที) | JstHourDelivery | จัดส่งทันที",
    logisticsName: "Instant Delivery - ส่งทันที (แพ็ก 30 นาที)",
    packMinutes: 30,
    payTimeSec: now,
    deadlineSec: now + 28 * 60,
    statusCode: "WaitConfirm",
    raw: { sim: true },
  };
  await chrome.runtime.sendMessage({ type: "simulate-order", order: fakeOrder });
});

$("pollNow").addEventListener("click", async () => {
  const r = await chrome.runtime.sendMessage({ type: "poll-now" });
  if (!r?.ok) {
    alert("ไม่พบแท็บ JST ที่เปิดอยู่ — กรุณาเปิด https://asia.jsterp.com ก่อน");
  }
  setTimeout(refreshStatus, 1500);
});

load();
setInterval(refreshStatus, 5_000);

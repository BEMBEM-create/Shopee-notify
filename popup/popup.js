const $ = (id) => document.getElementById(id);

function statRow(label, value, isError = false) {
  const v = document.createElement("div");
  v.className = "stat";
  const l = document.createElement("span");
  l.className = "stat-label";
  l.textContent = label;
  const val = document.createElement("span");
  val.className = "stat-value" + (isError ? " error" : "");
  val.textContent = value;
  v.append(l, val);
  return v;
}

async function refresh() {
  const r = await chrome.runtime.sendMessage({ type: "get-status" }).catch(() => null);
  const statusEl = $("status");

  if (!r?.status) {
    $("banner").className = "banner";
    $("dot").className = "dot off";
    $("bannerTitle").textContent = "ไม่พบสถานะ";
    $("bannerSub").textContent = "เปิดแท็บ JST ค้างไว้";
    $("toggle").textContent = "เปิดการแจ้งเตือน";
    $("toggle").classList.remove("is-on");
    statusEl.innerHTML = '<div class="status-empty">ยังไม่มีข้อมูล</div>';
    return;
  }

  const st = r.status;

  // Banner + toggle reflect the on/off state.
  $("banner").className = "banner" + (st.enabled ? " on" : "");
  $("dot").className = "dot " + (st.enabled ? "on" : "off");
  $("bannerTitle").textContent = st.enabled ? "กำลังทำงาน" : "ปิดอยู่";
  $("bannerSub").textContent = st.enabled
    ? "กำลังเฝ้าระวังออเดอร์ส่งด่วน"
    : "กดปุ่มด้านล่างเพื่อเริ่มแจ้งเตือน";
  $("toggle").textContent = st.enabled ? "ปิดการแจ้งเตือน" : "เปิดการแจ้งเตือน";
  $("toggle").classList.toggle("is-on", st.enabled);

  // Friendly status detail rows.
  const lastCap = st.lastCaptureAt ? new Date(st.lastCaptureAt).toLocaleTimeString() : "—";
  const lag = st.lastCaptureAt ? Math.round((Date.now() - st.lastCaptureAt) / 1000) + " วินาทีก่อน" : "—";

  statusEl.replaceChildren(
    statRow("จับข้อมูลล่าสุด", lastCap),
    statRow("ผ่านมาแล้ว", lag),
    statRow("ออเดอร์ / ส่งด่วน", `${st.lastCaptureOrders ?? 0} / ${st.lastCaptureExpress ?? 0}`),
    statRow("ประกาศวันนี้", String(st.announcedToday ?? 0)),
  );
  if (st.lastError) statusEl.append(statRow("ข้อผิดพลาด", st.lastError, true));
}

$("toggle").addEventListener("click", async () => {
  const cur = await chrome.storage.local.get({ enabled: false });
  await chrome.storage.local.set({ enabled: !cur.enabled });
  await chrome.runtime.sendMessage({ type: "settings-updated" });
  refresh();
});

$("pollNow").addEventListener("click", async () => {
  const r = await chrome.runtime.sendMessage({ type: "poll-now" });
  if (!r?.ok) alert("ไม่พบแท็บ JST");
  setTimeout(refresh, 1500);
});

$("openOptions").addEventListener("click", () => chrome.runtime.openOptionsPage());

refresh();
setInterval(refresh, 2000);

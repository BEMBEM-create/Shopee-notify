const $ = (id) => document.getElementById(id);

async function refresh() {
  const r = await chrome.runtime.sendMessage({ type: "get-status" }).catch(() => null);
  if (!r?.status) { $("status").textContent = "n/a"; return; }
  const st = r.status;
  $("dot").className = "dot " + (st.enabled ? "on" : "off");
  const lastCap = st.lastCaptureAt ? new Date(st.lastCaptureAt).toLocaleTimeString() : "—";
  const lag = st.lastCaptureAt ? Math.round((Date.now() - st.lastCaptureAt) / 1000) + "s" : "—";
  $("status").textContent = [
    `enabled: ${st.enabled}`,
    `last capture: ${lastCap} (${lag} ago)`,
    `orders / express: ${st.lastCaptureOrders} / ${st.lastCaptureExpress}`,
    `announced today: ${st.announcedToday}`,
    st.lastError ? `error: ${st.lastError}` : "",
  ].filter(Boolean).join("\n");
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

const $ = (id) => document.getElementById(id);

async function refresh() {
  const r = await chrome.runtime.sendMessage({ type: "get-status" }).catch(() => null);
  if (!r?.status) { $("status").textContent = "n/a"; return; }
  const st = r.status;
  $("dot").className = "dot " + (st.enabled ? "on" : "off");
  const lastPoll = st.lastPollAt ? new Date(st.lastPollAt).toLocaleTimeString() : "—";
  const lag = st.lastPollAt ? Math.round((Date.now() - st.lastPollAt) / 1000) + "s" : "—";
  $("status").textContent = [
    `enabled: ${st.enabled}`,
    `interval: ${st.pollIntervalSec}s`,
    `last poll: ${lastPoll} (${lag} ago)`,
    `orders last poll: ${st.lastPollOrders}`,
    `announced today: ${st.announcedToday}`,
    st.lastPollError ? `error: ${st.lastPollError}` : "",
  ].filter(Boolean).join("\n");
}

$("toggle").addEventListener("click", async () => {
  const cur = await chrome.storage.local.get({ enabled: false });
  await chrome.storage.local.set({ enabled: !cur.enabled });
  await chrome.runtime.sendMessage({ type: "settings-updated" });
  refresh();
});

$("pollNow").addEventListener("click", async () => {
  await chrome.runtime.sendMessage({ type: "poll-now" });
  setTimeout(refresh, 500);
});

$("openOptions").addEventListener("click", () => chrome.runtime.openOptionsPage());

refresh();
setInterval(refresh, 2000);

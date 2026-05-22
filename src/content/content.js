// Content script รันบนแท็บ JST — มีหน้าที่:
//   1) Inject page-world script เพื่อ intercept XHR/fetch
//   2) Forward order payloads ที่ดักได้ → service worker
//   3) จัดการ "active poll" — ตั้ง setInterval ส่ง replay request ไปยัง
//      page-world เพื่อ poll ถี่กว่า 1 นาที (JST refresh เองทุก 1 นาที ปกติ)
//
// Active poll ต้องทำใน content script เพราะ chrome.alarms ขั้นต่ำ 30 วินาที
// และต้อง postMessage ไปยัง page-world (SW ทำตรงๆ ไม่ได้)

(function init() {
  if (window.__shopeeNotifyContentLoaded) return;
  window.__shopeeNotifyContentLoaded = true;

  const tag = "[shopee-notify/content]";
  console.log(tag, "loaded on", location.host);

  injectPageScript();
  startActivePoll();

  window.addEventListener("message", (ev) => {
    if (ev.source !== window) return;
    const data = ev.data;
    if (!data || data.__shopeeNotify !== true) return;
    if (data.kind === "xhr-capture") {
      chrome.runtime
        .sendMessage({ type: "passive-capture", url: data.url, body: data.body })
        .then((r) => {
          if (r?.ok && r.orders != null) {
            console.log(tag, `forwarded capture: ${r.orders} orders, ${r.express} express`);
          }
        })
        .catch(() => {});
    }
  });

  chrome.runtime.onMessage.addListener((msg) => {
    if (msg?.type === "set-active-poll") {
      applyActivePoll(msg.intervalSec);
    }
  });
})();

let _activePollTimer = null;

function startActivePoll() {
  chrome.storage.local
    .get({ activePollSec: 0, enabled: false })
    .then((s) => applyActivePoll(s.enabled ? s.activePollSec : 0));
}

function applyActivePoll(intervalSec) {
  if (_activePollTimer) {
    clearInterval(_activePollTimer);
    _activePollTimer = null;
  }
  const sec = Number(intervalSec) || 0;
  if (sec <= 0) {
    console.log("[shopee-notify/content] active poll disabled");
    return;
  }
  console.log(`[shopee-notify/content] active poll every ${sec}s`);
  _activePollTimer = setInterval(() => {
    window.postMessage({ __shopeeNotify: true, kind: "active-poll-replay" }, "*");
  }, sec * 1000);
}

function injectPageScript() {
  try {
    const s = document.createElement("script");
    s.src = chrome.runtime.getURL("src/content/injector.js");
    s.onload = () => s.remove();
    (document.head || document.documentElement).appendChild(s);
  } catch (e) {
    console.warn("[shopee-notify/content] inject failed", e);
  }
}

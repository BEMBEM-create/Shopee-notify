// Content script รันบนแท็บ JST — ตอนนี้มีหน้าที่:
//   1) Inject page-world script เพื่อ intercept XHR/fetch (passive fallback)
//   2) Forward order payloads ที่ดักได้ → service worker
//
// Active polling อยู่ที่ background SW (ไม่ต้องอาศัย content script)
// แต่ถ้า SW โดน CSRF/anti-bot ค่อย enable passive interceptor ผ่าน flag

(function init() {
  if (window.__shopeeNotifyContentLoaded) return;
  window.__shopeeNotifyContentLoaded = true;

  const tag = "[shopee-notify/content]";
  console.log(tag, "loaded on", location.host);

  injectPageScript();

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
})();

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

// page-world script: ดักจับ XHR/fetch ของ JST แล้วส่งกลับมาทาง postMessage
// Primary capture mechanism — content script forwards to background SW.

(function () {
  if (window.__shopeeNotifyInjected) return;
  window.__shopeeNotifyInjected = true;

  // Match the JST order-list endpoint specifically.
  // Verified: POST https://asia.jsterp.com/OMS/MiniShopOrder/NewQueryOrders
  const ORDER_URL_RE = /jsterp\.com.*(QueryOrders|MiniShopOrder)/i;

  const send = (url, body) => {
    window.postMessage(
      { __shopeeNotify: true, kind: "xhr-capture", url: String(url), body: safeText(body) },
      "*",
    );
  };

  const safeText = (b) => {
    try {
      if (b == null) return null;
      if (typeof b === "string") return b.length > 2_000_000 ? null : b;
      return null;
    } catch {
      return null;
    }
  };

  const origFetch = window.fetch;
  window.fetch = async function (input, init) {
    const url = typeof input === "string" ? input : input?.url;
    const resp = await origFetch.apply(this, arguments);
    try {
      if (url && ORDER_URL_RE.test(url)) {
        const clone = resp.clone();
        clone.text().then((t) => send(url, t)).catch(() => {});
      }
    } catch {}
    return resp;
  };

  const OrigXHR = window.XMLHttpRequest;
  function PatchedXHR() {
    const xhr = new OrigXHR();
    let _url = "";
    const origOpen = xhr.open;
    xhr.open = function (method, url) {
      _url = url;
      return origOpen.apply(this, arguments);
    };
    xhr.addEventListener("load", () => {
      try {
        if (_url && ORDER_URL_RE.test(_url)) {
          send(_url, xhr.responseText);
        }
      } catch {}
    });
    return xhr;
  }
  PatchedXHR.prototype = OrigXHR.prototype;
  window.XMLHttpRequest = PatchedXHR;
})();

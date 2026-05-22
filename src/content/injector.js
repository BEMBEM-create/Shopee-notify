// page-world script: ดักจับ XHR/fetch ของ JST แล้วส่งกลับมาทาง postMessage
// Primary capture mechanism — content script forwards to background SW.
//
// นอกจากนี้ยัง support "active replay" — เมื่อ content script ส่ง postMessage
// kind: "active-poll-replay" มา จะ re-execute request ตัวล่าสุดที่ดักจับได้
// (ด้วย session/cookie ของ page เลย ไม่ต้อง reverse CSRF) — ทำให้ poll ถี่กว่า
// 1 นาทีได้โดยไม่ reload tab

(function () {
  if (window.__shopeeNotifyInjected) return;
  window.__shopeeNotifyInjected = true;

  // Match the JST order-list endpoint specifically.
  // Verified: POST https://asia.jsterp.com/OMS/MiniShopOrder/NewQueryOrders
  const ORDER_URL_RE = /jsterp\.com.*(QueryOrders|MiniShopOrder)/i;

  // Latest replayable request — saved on every intercepted order-list call.
  // We replay this on demand for sub-minute active polling.
  let lastReplayable = null;

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
        const reqBody = init?.body;
        if (typeof reqBody === "string" || reqBody == null) {
          lastReplayable = {
            kind: "fetch",
            url: String(url),
            method: init?.method || "GET",
            body: typeof reqBody === "string" ? reqBody : null,
            headers: serializeHeaders(init?.headers),
            credentials: init?.credentials || "same-origin",
          };
        }
      }
    } catch {}
    return resp;
  };

  const OrigXHR = window.XMLHttpRequest;
  function PatchedXHR() {
    const xhr = new OrigXHR();
    let _url = "";
    let _method = "GET";
    let _headers = {};
    let _body = null;
    const origOpen = xhr.open;
    const origSetHeader = xhr.setRequestHeader;
    const origSend = xhr.send;
    xhr.open = function (method, url) {
      _method = method;
      _url = url;
      return origOpen.apply(this, arguments);
    };
    xhr.setRequestHeader = function (name, value) {
      _headers[name] = value;
      return origSetHeader.apply(this, arguments);
    };
    xhr.send = function (body) {
      if (typeof body === "string" || body == null) _body = body ?? null;
      return origSend.apply(this, arguments);
    };
    xhr.addEventListener("load", () => {
      try {
        if (_url && ORDER_URL_RE.test(_url)) {
          send(_url, xhr.responseText);
          // XHR is also replayable via fetch (same origin, same cookies)
          lastReplayable = {
            kind: "fetch",
            url: String(_url),
            method: _method,
            body: _body,
            headers: { ..._headers },
            credentials: "same-origin",
          };
        }
      } catch {}
    });
    return xhr;
  }
  PatchedXHR.prototype = OrigXHR.prototype;
  window.XMLHttpRequest = PatchedXHR;

  function serializeHeaders(h) {
    if (!h) return {};
    if (h instanceof Headers) {
      const o = {};
      h.forEach((v, k) => (o[k] = v));
      return o;
    }
    if (Array.isArray(h)) return Object.fromEntries(h);
    if (typeof h === "object") return { ...h };
    return {};
  }

  // Listen for replay requests from the content script.
  window.addEventListener("message", (ev) => {
    if (ev.source !== window) return;
    const data = ev.data;
    if (!data || data.__shopeeNotify !== true) return;
    if (data.kind === "active-poll-replay") {
      if (!lastReplayable) return; // nothing captured yet
      const { url, method, body, headers, credentials } = lastReplayable;
      origFetch(url, {
        method,
        headers,
        body: method === "GET" || method === "HEAD" ? undefined : body,
        credentials,
      }).then((resp) => {
        // patched fetch wasn't used (we called origFetch to avoid re-patching),
        // so we manually forward the response too
        resp.clone().text().then((t) => send(url, t)).catch(() => {});
      }).catch((e) => {
        console.warn("[shopee-notify] active-poll replay failed", e);
      });
    }
  });
})();

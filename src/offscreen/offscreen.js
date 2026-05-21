const queue = [];
let playing = false;

chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
  if (msg?.target !== "offscreen") return;
  if (msg.type === "play") {
    queue.push(msg.payload);
    drain();
    sendResponse({ ok: true, queued: queue.length });
    return true;
  }
  if (msg.type === "ping") {
    sendResponse({ ok: true });
    return true;
  }
});

async function drain() {
  if (playing) return;
  playing = true;
  try {
    while (queue.length) {
      const item = queue.shift();
      await playItem(item).catch((e) => console.warn("[shopee-notify] offscreen play error", e));
      await sleep(250);
    }
  } finally {
    playing = false;
  }
}

async function playItem(item) {
  if (item.chimeUrl) {
    await playAudio(item.chimeUrl).catch(() => {});
  }
  if (item.audioBase64) {
    const url = `data:audio/mp3;base64,${item.audioBase64}`;
    await playAudio(url);
  } else if (item.text) {
    await speakWeb(item.text, item.speakingRate || 1.0);
  }
}

function playAudio(url) {
  return new Promise((resolve, reject) => {
    const audio = new Audio(url);
    audio.onended = () => resolve();
    audio.onerror = () => reject(new Error("audio play failed"));
    audio.play().catch(reject);
  });
}

function speakWeb(text, rate) {
  return new Promise((resolve) => {
    if (!("speechSynthesis" in window)) return resolve();
    const u = new SpeechSynthesisUtterance(text);
    u.lang = "th-TH";
    u.rate = rate;
    u.onend = () => resolve();
    u.onerror = () => resolve();
    const pick = () => {
      const voices = speechSynthesis.getVoices();
      const th = voices.find((v) => v.lang?.toLowerCase().startsWith("th"));
      if (th) u.voice = th;
      speechSynthesis.speak(u);
    };
    if (speechSynthesis.getVoices().length) pick();
    else speechSynthesis.addEventListener("voiceschanged", pick, { once: true });
  });
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

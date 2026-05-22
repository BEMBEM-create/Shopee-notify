const ENDPOINT = "https://texttospeech.googleapis.com/v1/text:synthesize";

const cacheKey = (text, voice, rate) => `tts:${voice}:${rate}:${hash(text)}`;

function hash(s) {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = ((h << 5) - h + s.charCodeAt(i)) | 0;
  return (h >>> 0).toString(36);
}

export async function synthesize({ text, apiKey, voice = "th-TH-Chirp3-HD-Aoede", speakingRate = 1.0 }) {
  if (!apiKey) throw new Error("missing google tts api key");

  const ck = cacheKey(text, voice, speakingRate);
  const cached = (await chrome.storage.local.get(ck))[ck];
  if (cached?.audio) return { audioBase64: cached.audio, cached: true };

  const resp = await fetch(`${ENDPOINT}?key=${encodeURIComponent(apiKey)}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      input: { text },
      voice: { languageCode: "th-TH", name: voice },
      audioConfig: { audioEncoding: "MP3", speakingRate },
    }),
  });
  if (!resp.ok) {
    const t = await resp.text().catch(() => "");
    throw new Error(`google tts ${resp.status}: ${t.slice(0, 200)}`);
  }
  const json = await resp.json();
  if (!json.audioContent) throw new Error("google tts: no audioContent");

  await trimCacheIfNeeded();
  await chrome.storage.local.set({ [ck]: { audio: json.audioContent, at: Date.now() } });
  return { audioBase64: json.audioContent, cached: false };
}

const CACHE_CAP_BYTES = 5 * 1024 * 1024;

async function trimCacheIfNeeded() {
  const all = await chrome.storage.local.get(null);
  const entries = Object.entries(all)
    .filter(([k]) => k.startsWith("tts:"))
    .map(([k, v]) => [k, v, v?.audio?.length || 0]);
  const total = entries.reduce((sum, [, , size]) => sum + size, 0);
  if (total <= CACHE_CAP_BYTES) return;
  entries.sort((a, b) => (a[1]?.at || 0) - (b[1]?.at || 0));
  let remove = total - CACHE_CAP_BYTES * 0.7;
  const toRemove = [];
  for (const [k, , size] of entries) {
    if (remove <= 0) break;
    toRemove.push(k);
    remove -= size;
  }
  if (toRemove.length) await chrome.storage.local.remove(toRemove);
}

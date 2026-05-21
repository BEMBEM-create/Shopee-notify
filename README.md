# Shopee Express Notifier (via JST)

Chrome extension (Manifest V3) ที่ poll JST ERP เพื่อแจ้งเตือนเสียงไทยทันทีเมื่อมีออเดอร์ "ส่งด่วน / ส่งทันที" เข้ามาจากทุกร้าน Shopee พร้อม **urgent re-announce** ทุก 5 นาทีถ้าเหลือเวลาน้อย

> เปิดแท็บ JST เพียงแท็บเดียว ครอบคลุมทุกร้าน (JST รวมออเดอร์จาก Shopee + Lazada + TikTok + อื่นๆ ให้แล้ว)

## ติดตั้ง (Developer Mode)

1. โคลน repo แล้วเปิด `chrome://extensions`
2. เปิด **Developer mode** (มุมขวาบน)
3. **Load unpacked** → เลือกโฟลเดอร์นี้
4. คลิกไอคอน extension → **ตั้งค่า**

## ขั้นแรก: ค้นหา JST endpoint จริง

`src/jst/endpoints.js` ใช้ค่า **best-guess** — ต้อง verify บนบัญชี JST ของคุณก่อนเปิด polling:

1. Login `https://www.jsterp.com/` → ไปหน้าออเดอร์ "รอจัดส่ง"
2. เปิด DevTools → **Network** → กรอง `XHR` + คำว่า `order` หรือ `list`
3. คลิกที่หน้า refresh — ดู request ที่ response มี: `order_sn`, `shop_name`, `logistics_*`, `pay_*`, `ship_*` / `deadline`
4. คลิกขวา request นั้น → **Copy as cURL** → จด path
5. อัปเดต `ENDPOINTS.ORDER_LIST.path` ใน `src/jst/endpoints.js`
6. บันทึก response เป็น `src/jst/__samples__/order-list.json` สำหรับเทียบ field ตอน parse

> ถ้า active polling โดน CSRF / anti-bot → content script มี **passive interceptor** (`src/content/injector.js`) อยู่แล้ว patch `fetch`/`XHR` บน page-world เอา payload ออกมา

## ตั้งค่าเสียง

- **Google Cloud TTS Neural2** (แนะนำ) — สมัครที่ console.cloud.google.com → enable Text-to-Speech API → สร้าง API key → ใส่ในหน้า Settings
  - ค่าใช้จ่าย ~$0.0013/ประกาศ (cache ตามประโยคซ้ำในตัว)
- **Web Speech API** (ฟรี) — ใช้เสียง OS, macOS "Kanya" ใกล้ Siri / Windows คุณภาพต่ำ

## การทำงาน

1. Background SW poll JST ทุก 30 วินาที (default; ปรับ 15/30/60 ได้)
2. Parse → กรองช่องทาง "ส่งด่วน / ส่งทันที" ตาม `expressPatterns`
3. Dedup ผ่าน `chrome.storage.local` (key `seen:jst:<order_sn>`)
4. ออเดอร์ใหม่ → chime + TTS + Chrome notification
5. ถ้า `minutesLeft ≤ 10` และยังไม่ pickup → announce ซ้ำทุก 5 นาที (urgent sweep)

## ความเสี่ยง

- JST อาจเปลี่ยน internal endpoint/field — รวมศูนย์ที่ `src/jst/endpoints.js` + `src/jst/order-parser.js` เพื่อแก้ที่เดียว
- Poll ถี่เกินไปอาจดูเหมือน bot → default 30s ปลอดภัย ปรับขึ้นถ้าจำเป็น
- ใช้ session ของผู้ใช้เอง ดึงข้อมูลร้านตัวเอง — ToS อยู่ในพื้นที่สีเทา ใช้ความเสี่ยงผู้ใช้
- ต้องเปิดแท็บ JST ค้าง (login active) — ปักหมุดแท็บไว้

## โครงสร้าง

```
manifest.json
src/
  background/service-worker.js   poll loop, dedupe, urgent sweep, notification
  content/content.js, injector.js  passive XHR interceptor (fallback)
  sources/source.js, jst-web.js  pluggable data source interface + JST impl
  jst/endpoints.js, order-parser.js, express-filters.js
  storage/seen-orders.js
  tts/google-tts.js
  offscreen/offscreen.html, offscreen.js  audio playback (MV3 workaround)
options/  หน้า settings + test buttons
popup/    popup สถานะ + toggle
```

## พัฒนาต่อ

- เพิ่ม Source B: Seller Center scrape สำหรับ realtime (ไม่มี JST sync delay) — ใช้ interface เดียวกัน
- เพิ่ม Source C: JST OpenAPI / Shopee Open Platform เมื่อได้สิทธิ์ partner
- คุณภาพเสียง: ลอง Azure / ElevenLabs Thai

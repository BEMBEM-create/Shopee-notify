# Shopee Express Notifier (via JST)

Chrome extension (Manifest V3) ที่แจ้งเตือนเสียงไทยทันทีเมื่อมีออเดอร์ "ส่งด่วน / ส่งทันที" เข้ามาจากทุกร้านบน Shopee/TikTok/Lazada — โดยดักจับ response ของ JST ERP (`asia.jsterp.com`) ที่ JST refresh เองทุก 1 นาที พร้อม **urgent re-announce** ทุก 5 นาทีถ้าเหลือเวลาน้อย

## โหมดทำงาน: Passive Interception

Extension **ไม่ poll JST เอง** เพราะไม่รู้ schema ของ request body — แต่ใช้วิธี:
1. Inject script ลง `asia.jsterp.com` patch `fetch` / `XMLHttpRequest`
2. ทุกครั้งที่ JST refresh เอง (ทุก ~1 นาที) เราดักจับ response
3. Parse + เช็คช่องทาง "ส่งด่วน/ส่งทันที" + dedup + ประกาศเสียง

**ข้อจำกัด**: ต้องเปิดแท็บ JST ค้างไว้บนหน้า "คำสั่งซื้อรอจัดส่ง" ตลอด — ปักหมุดแท็บไว้ (คลิกขวา → Pin)

ถ้าผู้ใช้รู้ schema ของ POST body ของ `/OMS/MiniShopOrder/NewQueryOrders` ภายหลัง สามารถเปิด active polling ใน `src/sources/jst-web.js` (โครงสร้างวางไว้แล้ว)

## ติดตั้ง

1. ดาวน์โหลด/clone branch นี้
2. `chrome://extensions` → Developer mode → **Load unpacked** → เลือกโฟลเดอร์นี้
3. ปักหมุดไอคอนบน toolbar
4. คลิก **ตั้งค่า** → ติ๊ก enable + กรอก Google TTS API key (ถ้าใช้)

## หน้า JST ที่ต้องเปิดค้าง

`https://asia.jsterp.com/OMS/MiniShopOrder` (หรือเปลี่ยนเป็นหน้าออเดอร์ที่แสดง "คำสั่งซื้อรอจัดส่ง") — Pin tab ไว้ เพื่อให้ JST refresh เองอัตโนมัติ extension ดักทุก response

## การ detect "ส่งด่วน / ส่งทันที"

Extension รวมหลายฟิลด์ของ JST เป็น "channel string" เดียวแล้ว match กับ pattern list:
- `LogisticsCompanyName` — เช่น `"Instant Delivery - ส่งทันที (แพ็ก 30 นาที)"`, `"Instant Delivery - ส่งทันที (แพ็ก 2 ชั่วโมง)"`
- `Labels` ของออเดอร์ — เช่น `Code: "JstHourDelivery"` + `Name: "จัดส่งทันที"`
- ผู้ใช้ตั้งเองในหน้า options

**Pack deadline auto-extraction**: ถ้า channel มีคำว่า `แพ็ก N นาที` หรือ `แพ็ก N ชั่วโมง` extension จะคำนวณ deadline = `PayTime + N` (ไม่ใช่ `PlanDeliveryDate` ที่อาจไกล 48 ชม.) — สำคัญสำหรับ variant "แพ็ก 30 นาที" ที่ต้องเร่งจัดของจริงๆ

## ประโยคประกาศ

- ออเดอร์ใหม่: `"คุณมีออเดอร์ส่งทันที ต้องแพ็คภายใน [N] นาที"`
- Urgent (เหลือ ≤ 10 นาที): `"เตือนซ้ำ คุณมีออเดอร์ส่งทันที ต้องแพ็คภายใน [N] นาที"`
- ถ้าไม่ใช่ pack variant: `"ต้องจัดส่งภายใน [N] นาที"`

ชื่อร้าน (เช่น `Maydicine_drugstore_Shopee`) ถูกตัดออกจากเสียงพูด เพราะเสียง TTS ไทยจะอ่านอักษรอังกฤษทีละตัว ฟังไม่ลื่น — แต่ยังโชว์ในกล่อง notification ของ Chrome เพื่อให้เห็นว่าร้านไหน

## เสียง TTS

**Google Cloud TTS Neural2** (แนะนำ) — เสียง `th-TH-Neural2-C`, ~$0.0013/ประกาศ, มี cache ในตัว 5 MB

ขั้นตอน:
1. https://console.cloud.google.com/ → enable **Text-to-Speech API**
2. **Credentials** → สร้าง API key
3. วาง key ในหน้า Options → กด **ทดสอบเสียง**

**Web Speech API** (ฟรี) ใช้เสียง OS — macOS "Kanya" ใกล้ Siri, Windows คุณภาพต่ำกว่า

## ทดสอบ

ใน Options page:
- **ทดสอบเสียง**: ฟังประโยคทดสอบ
- **ทดสอบประกาศออเดอร์**: รัน pipeline ทั้งระบบด้วย fake order (channel = "Instant Delivery - ส่งทันที (แพ็ก 30 นาที)")
- **Poll ตอนนี้**: reload แท็บ JST → trigger capture ใหม่

## โครงสร้าง

```
manifest.json
src/
  background/service-worker.js   handles passive-capture, urgent sweep, notification, TTS
  content/content.js             forwards interceptor messages → SW
  content/injector.js            page-world fetch/XHR patch (primary capture)
  jst/endpoints.js               verified endpoint URL
  jst/order-parser.js            column-oriented response → NormalizedOrder
                                 + extractPackMinutes() for "แพ็ก N นาที/ชั่วโมง"
  jst/express-filters.js         pattern matching + ส่งทันที vs ส่งด่วน classification
  jst/__samples__/order-list.json  real JST response (truncated PII)
  sources/source.js, jst-web.js  scaffold for active polling (future)
  storage/seen-orders.js         dedupe + urgent state
  tts/google-tts.js              Neural2 + cache
  offscreen/                     audio playback (MV3 workaround)
options/, popup/
```

## ความเสี่ยง

- ต้องเปิดแท็บ JST ค้าง — ถ้าปิดจะไม่มี capture
- JST อาจเปลี่ยน internal endpoint/field — รวมศูนย์ไว้ที่ `endpoints.js` + `order-parser.js`
- Google TTS API key ถูก expose ในเครื่อง user เอง → จำกัด API key ที่ Cloud Console เป็น `chrome-extension://*` referrer หรือ restrict ที่ Text-to-Speech API เฉพาะ
- ToS: ใช้ session ผู้ใช้เอง อยู่ในพื้นที่สีเทา — ใช้ความเสี่ยงผู้ใช้

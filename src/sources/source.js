/**
 * NormalizedOrder shape (every Source must produce these)
 *   id            string  unique stable id (prefixed by source, e.g. "jst:1234567890")
 *   orderSn       string  external order number (Shopee/Lazada/...)
 *   shopName      string  ชื่อร้าน
 *   platform      string  "Shopee" | "Lazada" | "TikTok" | ...
 *   channel       string  ชื่อช่องทางขนส่ง (raw จาก source) — ใช้กรอง express
 *   payTimeSec    number  unix seconds, optional
 *   deadlineSec   number  unix seconds — เวลาที่ต้อง pickup/ship เสร็จ
 *   status        string  raw status (เพื่อ debug)
 *   raw           object  payload ดิบจาก source (debug only)
 *
 * Source interface
 *   id: string
 *   label: string
 *   async fetchNewOrders(ctx) => NormalizedOrder[]
 *     ctx = { now: Date, lookbackMinutes: number, log, warn, error }
 */

export const SOURCE_REGISTRY = new Map();

export function registerSource(source) {
  if (!source || typeof source.fetchNewOrders !== "function") {
    throw new Error("invalid source");
  }
  SOURCE_REGISTRY.set(source.id, source);
}

export function getSource(id) {
  return SOURCE_REGISTRY.get(id);
}

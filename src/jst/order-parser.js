/**
 * Parse JST order-list response into NormalizedOrder[].
 *
 * JST field naming varies by tenant; we try a list of common aliases.
 * VERIFY against actual response and prune to the real fields once known.
 */

const pick = (obj, keys) => {
  for (const k of keys) {
    if (obj == null) continue;
    const v = obj[k];
    if (v != null && v !== "") return v;
  }
  return undefined;
};

const toSec = (v) => {
  if (v == null || v === "") return undefined;
  if (typeof v === "number") return v > 1e12 ? Math.floor(v / 1000) : v;
  const t = Date.parse(String(v).replace(" ", "T"));
  return Number.isFinite(t) ? Math.floor(t / 1000) : undefined;
};

export function parseOrderList(payload) {
  const list =
    payload?.data?.datas ??
    payload?.data?.list ??
    payload?.data?.rows ??
    payload?.datas ??
    payload?.list ??
    payload?.rows ??
    (Array.isArray(payload) ? payload : []);

  return (list || [])
    .map((row) => normalizeRow(row))
    .filter((o) => o && o.id);
}

function normalizeRow(row) {
  if (!row || typeof row !== "object") return null;
  const orderSn = pick(row, ["order_sn", "platform_order_id", "platform_code", "out_trade_no", "tid", "shop_order_sn"]);
  if (!orderSn) return null;

  const shopName = pick(row, ["shop_name", "shopName", "store_name", "shop"]);
  const platform = pick(row, ["platform", "platform_name", "channel_name"]) || "";
  const channel = pick(row, [
    "logistics_name",
    "logisticsName",
    "express_company",
    "lc_name",
    "lc_alias",
    "shipping_method",
    "delivery_name",
  ]);
  const payTimeSec = toSec(pick(row, ["pay_date", "pay_time", "paid_at", "payDateTime"]));
  const deadlineSec = toSec(
    pick(row, [
      "send_deadline",
      "shipping_deadline",
      "deliver_deadline",
      "ship_by_date",
      "delivery_deadline",
      "tts",
    ]),
  );
  const status = pick(row, ["status", "order_status", "shop_status"]);

  return {
    id: `jst:${orderSn}`,
    orderSn: String(orderSn),
    shopName: shopName ? String(shopName) : "",
    platform: String(platform),
    channel: channel ? String(channel) : "",
    payTimeSec,
    deadlineSec,
    status: status ? String(status) : "",
    raw: row,
  };
}

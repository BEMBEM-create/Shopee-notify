/**
 * Parse JST order-list response (column-oriented format) into NormalizedOrder[].
 *
 * JST returns:
 *   payload.Rows.cols         -> array<string>  column names
 *   payload.Rows.rows         -> array<array>   each inner array maps 1:1 to cols
 *   payload.Rows.ItemCols.Labels  -> sub-column header for Labels cells
 *
 * KEY GOTCHA: JST express variants have a PACK deadline embedded in the
 * channel name (e.g. "Instant Delivery - ส่งทันที (แพ็ก 30 นาที)"). For
 * these orders, PlanDeliveryDate is the FAR-future delivery deadline, while
 * the seller-facing urgent deadline is payTime + packMinutes. We extract
 * that window and prefer it over PlanDeliveryDate when present.
 *
 * Reference response: src/jst/__samples__/order-list.json
 */

const toSec = (v) => {
  if (v == null || v === "") return undefined;
  if (typeof v === "number") return v > 1e12 ? Math.floor(v / 1000) : v;
  const s = String(v).trim();
  if (!s || s.startsWith("0001-")) return undefined;
  const t = Date.parse(s.replace(" ", "T"));
  return Number.isFinite(t) ? Math.floor(t / 1000) : undefined;
};

const str = (v) => (v == null ? "" : String(v));

function rowToObject(row, cols) {
  const o = {};
  const n = Math.min(row.length, cols.length);
  for (let i = 0; i < n; i++) o[cols[i]] = row[i];
  return o;
}

function decodeLabels(labelsCell, header) {
  if (!Array.isArray(labelsCell) || !Array.isArray(header)) return [];
  return labelsCell.map((row) => {
    const o = {};
    const n = Math.min(row.length, header.length);
    for (let i = 0; i < n; i++) o[header[i]] = row[i];
    return o;
  });
}

/** Extract pack-window minutes from a channel string like "(แพ็ก 30 นาที)" or "(แพ็ก 2 ชั่วโมง)". */
export function extractPackMinutes(channel) {
  if (!channel) return undefined;
  const s = String(channel);
  // Thai units
  const mMin = s.match(/แพ็ก\s*(\d+(?:\.\d+)?)\s*นาที/);
  if (mMin) return Number(mMin[1]);
  const mHr = s.match(/แพ็ก\s*(\d+(?:\.\d+)?)\s*ชั่วโมง/);
  if (mHr) return Number(mHr[1]) * 60;
  // English (defensive — not yet seen but cheap)
  const mEnHr = s.match(/pack\s*(?:within)?\s*(\d+(?:\.\d+)?)\s*hour/i);
  if (mEnHr) return Number(mEnHr[1]) * 60;
  const mEnMin = s.match(/pack\s*(?:within)?\s*(\d+(?:\.\d+)?)\s*min/i);
  if (mEnMin) return Number(mEnMin[1]);
  return undefined;
}

export function parseOrderList(payload) {
  const rows = payload?.Rows?.rows;
  const cols = payload?.Rows?.cols;
  if (!Array.isArray(rows) || !Array.isArray(cols)) return [];
  const labelsHeader = payload?.Rows?.ItemCols?.Labels;

  return rows
    .map((row) => normalizeRow(row, cols, labelsHeader))
    .filter(Boolean);
}

function normalizeRow(row, cols, labelsHeader) {
  const o = rowToObject(row, cols);
  const orderId = str(o.OrderId);
  if (!orderId) return null;

  const labels = decodeLabels(o.Labels, labelsHeader);
  const labelNames = labels.map((l) => str(l.Name)).filter(Boolean);
  const labelCodes = labels.map((l) => str(l.Code)).filter(Boolean);
  const logisticsName = str(o.LogisticsCompanyName);

  const payTimeSec = toSec(o.PayTime);
  const orderTimeSec = toSec(o.OrderTime);
  const planDeliveryDeadlineSec = toSec(o.PlanDeliveryDate);
  const pickupDeadlineSec = toSec(o.EndPickupTime);

  const packMinutes = extractPackMinutes(logisticsName);
  const anchorSec = payTimeSec ?? orderTimeSec;
  const packDeadlineSec =
    packMinutes != null && anchorSec != null
      ? anchorSec + Math.round(packMinutes * 60)
      : undefined;

  // Pick the EARLIEST meaningful deadline as the seller-facing one.
  const deadlineCandidates = [
    packDeadlineSec,
    pickupDeadlineSec,
    planDeliveryDeadlineSec,
  ].filter((v) => typeof v === "number");
  const deadlineSec = deadlineCandidates.length
    ? Math.min(...deadlineCandidates)
    : undefined;

  const channelParts = [
    logisticsName,
    str(o.LogisticsCompanyCode),
    str(o.DeliveryWayDisplay),
    str(o.OrderTypeDisplay),
    str(o.LogisticProviderDisplay),
    ...labelNames,
    ...labelCodes,
  ].filter(Boolean);
  const channel = channelParts.join(" | ");

  return {
    id: `jst:${orderId}`,
    orderId,
    orderSn: str(o.PlatformOrderId) || orderId,
    shopName: str(o.ShopName),
    shopId: str(o.ShopId),
    platform: str(o.PlatformId) || str(o.OrderFromPlatfrom) || str(o.PlatformBuyerPlatformId),
    channel,
    logisticsName,
    labels,
    packMinutes,
    payTimeSec,
    orderTimeSec,
    deadlineSec,
    packDeadlineSec,
    pickupDeadlineSec,
    planDeliveryDeadlineSec,
    remainderHours:
      typeof o.RemainderDeliveryTime === "number"
        ? o.RemainderDeliveryTime
        : Number(o.RemainderDeliveryTime) || undefined,
    statusCode: str(o.StatusCode),
    statusDisplay: str(o.StatusDisplay),
    platformStatus: str(o.PlatformStatus),
    amount: typeof o.Amount === "number" ? o.Amount : Number(o.Amount) || 0,
    raw: o,
  };
}

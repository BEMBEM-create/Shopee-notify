import { JST_ORIGIN, ENDPOINTS, DEFAULT_QUERY_BODY } from "../jst/endpoints.js";
import { parseOrderList } from "../jst/order-parser.js";

async function postJson(path, body) {
  const url = `${JST_ORIGIN}${path}`;
  const resp = await fetch(url, {
    method: "POST",
    credentials: "include",
    headers: {
      "Content-Type": "application/json;charset=UTF-8",
      Accept: "application/json, text/plain, */*",
    },
    body: JSON.stringify(body || {}),
  });
  if (!resp.ok) {
    const text = await resp.text().catch(() => "");
    const err = new Error(`JST HTTP ${resp.status}: ${text.slice(0, 200)}`);
    err.status = resp.status;
    throw err;
  }
  return resp.json();
}

export const JstWebSource = {
  id: "jst-web",
  label: "JST Web (scrape, MVP)",

  async fetchNewOrders({ now, lookbackMinutes = 60, log, error: logError }) {
    const payDateFrom = new Date(now.getTime() - lookbackMinutes * 60_000);
    const body = {
      ...DEFAULT_QUERY_BODY,
      payDateBegin: payDateFrom.toISOString().slice(0, 19).replace("T", " "),
      payDateEnd: now.toISOString().slice(0, 19).replace("T", " "),
    };
    try {
      const json = await postJson(ENDPOINTS.ORDER_LIST.path, body);
      const orders = parseOrderList(json);
      log?.(`fetched ${orders.length} orders from JST`);
      return orders;
    } catch (err) {
      logError?.("JST fetch failed:", err.message || err);
      throw err;
    }
  },
};

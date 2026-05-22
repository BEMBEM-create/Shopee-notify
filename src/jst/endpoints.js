/**
 * JST internal endpoint constants — VERIFIED via DevTools on 2026-05-22.
 *
 * Domain: asia.jsterp.com (Thailand/Asia tenant)
 * Endpoint: POST /OMS/MiniShopOrder/NewQueryOrders
 *           returns column-oriented payload (see __samples__/order-list.json)
 *
 * Request body schema is NOT yet known (would need DevTools Payload tab).
 * We default to passive interception (injector.js dumps JST's own requests),
 * with active polling as a best-effort fallback using a guessed body.
 */

export const JST_ORIGIN = "https://asia.jsterp.com";

export const ENDPOINTS = {
  ORDER_LIST: {
    path: "/OMS/MiniShopOrder/NewQueryOrders",
    method: "POST",
    note: "Body schema unverified — passive interception preferred",
  },
};

/**
 * Heuristic for matching JST order requests in injected XHR/fetch interceptor.
 * Any URL containing "QueryOrders" or "Order" on asia.jsterp.com is captured.
 */
export const URL_INTERCEPT_PATTERN = /jsterp\.com.*(QueryOrders|Order)/i;

/** Best-effort default body for active polling — likely needs tweaks. */
export const DEFAULT_QUERY_BODY = {
  PageIndex: 1,
  PageSize: 50,
  StatusTabCode: "WaitConfirm",
};

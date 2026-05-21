/**
 * JST internal endpoint constants.
 *
 * IMPORTANT: ค่าด้านล่างเป็น best-guess ตามรูปแบบ JST ทั่วไป
 * ต้อง verify บนบัญชีจริงผ่าน DevTools Network ก่อน enable polling:
 *   1) เปิด https://www.jsterp.com/ → ไปหน้าคำสั่งซื้อ "รอจัดส่ง"
 *   2) DevTools → Network → กรอง "list" หรือ "query"
 *   3) จับ request ที่ตอบกลับมี order_sn / shop_name / logistics
 *   4) แทนค่า PATH ด้านล่าง + บันทึก sample เป็น __samples__/order-list.json
 *
 * Verified: <รอ verify บน production session ของผู้ใช้>
 */

export const JST_ORIGIN = "https://www.jsterp.com";

export const ENDPOINTS = {
  ORDER_LIST: {
    path: "/erp/webapi/order_query/queryOrder",
    method: "POST",
    note: "VERIFY: รูปแบบ /erp/webapi/* หรือ /openweb/* — แก้หลัง sniff network จริง",
  },
};

export const DEFAULT_QUERY_BODY = {
  pageIndex: 1,
  pageSize: 50,
  status: "WaitConfirm",
  sortField: "pay_date",
  sortOrder: "desc",
};

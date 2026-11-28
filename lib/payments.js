// Payments.
// Modes:
//   razorpay : RAZORPAY_KEY_ID + RAZORPAY_KEY_SECRET are set → gateway checkout (UPI, cards, netbanking)
//   upi      : default without keys (or PAYMENT_MODE=upi) → customer pays our UPI QR / UPI ID directly,
//              submits the UPI reference (UTR), and the admin confirms receipt in the dashboard
//   demo     : PAYMENT_MODE=demo → simulated payment for testing the flow
//   off      : PAYMENT_MODE=off → checkout is disabled (no orders can be taken)
const crypto = require("crypto");
const QRCode = require("qrcode");

const KEY_ID = process.env.RAZORPAY_KEY_ID || "";
const KEY_SECRET = process.env.RAZORPAY_KEY_SECRET || "";
const WEBHOOK_SECRET = process.env.RAZORPAY_WEBHOOK_SECRET || "";

const REQUESTED = String(process.env.PAYMENT_MODE || "").trim().toLowerCase();
const mode =
  REQUESTED === "off" ? "off"
  : REQUESTED === "demo" ? "demo"
  : REQUESTED !== "upi" && KEY_ID && KEY_SECRET ? "razorpay"
  : "upi";

// ---------------- Direct UPI ----------------
// The UPI ID and payee name are editable in Admin → Settings; these env vars are the fallback.
const UPI_ID_ENV = String(process.env.UPI_ID || "").trim();
const UPI_PAYEE_ENV = String(process.env.UPI_PAYEE_NAME || "").trim();
// Static QR used until a UPI ID is configured. Versioned so a replaced image is never served stale from cache.
const UPI_QR_IMAGE = (() => {
  try {
    const buf = require("fs").readFileSync(require("path").join(__dirname, "..", "public", "img", "upi-qr.png"));
    return "/img/upi-qr.png?v=" + crypto.createHash("sha1").update(buf).digest("hex").slice(0, 8);
  } catch { return "/img/upi-qr.png"; }
})();

const isValidVpa = (v) => /^[a-zA-Z0-9][a-zA-Z0-9._-]{1,255}@[a-zA-Z][a-zA-Z0-9.-]{1,63}$/.test(String(v || ""));
// UPI reference number / UTR / RRN shown on the payment success screen: 12 digits.
const normaliseUtr = (v) => String(v == null ? "" : v).replace(/[\s-]/g, "");
const isValidUtr = (v) => /^\d{12}$/.test(v);

/** upi://pay deep link with the exact amount and order ID as the note. */
function upiUri({ vpa, payee, amount, orderId }) {
  const enc = encodeURIComponent;
  return `upi://pay?pa=${enc(vpa).replace(/%40/g, "@")}&pn=${enc(payee)}&am=${Number(amount).toFixed(2)}&cu=INR&tn=${enc("OG order " + orderId)}`;
}

/** Payment instructions sent to the browser for a direct-UPI order. */
async function upiPayment(order, { vpa, payee }) {
  const amount = order.total;
  if (vpa && isValidVpa(vpa)) {
    const uri = upiUri({ vpa, payee, amount, orderId: order.id });
    const qrSvg = await QRCode.toString(uri, { type: "svg", margin: 3, errorCorrectionLevel: "M", color: { dark: "#111111", light: "#ffffff" } });
    return { provider: "upi", amount, payee, vpa, uri, qrSvg, qrImage: null, exactAmount: true };
  }
  return { provider: "upi", amount, payee, vpa: null, uri: null, qrSvg: null, qrImage: UPI_QR_IMAGE, exactAmount: false };
}

function safeEqualHex(a, b) {
  const ba = Buffer.from(String(a), "utf8");
  const bb = Buffer.from(String(b), "utf8");
  return ba.length === bb.length && crypto.timingSafeEqual(ba, bb);
}

/** Create a Razorpay order for the given amount (rupees). */
async function createGatewayOrder(order) {
  const res = await fetch("https://api.razorpay.com/v1/orders", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: "Basic " + Buffer.from(`${KEY_ID}:${KEY_SECRET}`).toString("base64"),
    },
    body: JSON.stringify({
      amount: order.total * 100, // paise
      currency: "INR",
      receipt: order.id,
      notes: { og_order_id: order.id },
    }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok || !data.id) {
    const msg = (data.error && data.error.description) || `Razorpay error ${res.status}`;
    throw new Error(msg);
  }
  return data;
}

/** Verify the signature Razorpay Checkout returns to the browser. */
function verifyCheckoutSignature(gatewayOrderId, paymentId, signature) {
  const expected = crypto.createHmac("sha256", KEY_SECRET).update(`${gatewayOrderId}|${paymentId}`).digest("hex");
  return safeEqualHex(expected, signature);
}

/** Verify a webhook body (raw string) against X-Razorpay-Signature. */
function verifyWebhook(rawBody, signature) {
  if (!WEBHOOK_SECRET || !signature) return false;
  const expected = crypto.createHmac("sha256", WEBHOOK_SECRET).update(rawBody).digest("hex");
  return safeEqualHex(expected, signature);
}

module.exports = {
  mode, keyId: KEY_ID, createGatewayOrder, verifyCheckoutSignature, verifyWebhook, hasWebhookSecret: !!WEBHOOK_SECRET,
  UPI_ID_ENV, UPI_PAYEE_ENV, UPI_QR_IMAGE, isValidVpa, normaliseUtr, isValidUtr, upiPayment,
};

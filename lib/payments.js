// Payment gateway integration (Razorpay — UPI, cards, netbanking, wallets).
// Modes:
//   razorpay : RAZORPAY_KEY_ID + RAZORPAY_KEY_SECRET are set → real prepaid checkout
//   demo     : PAYMENT_MODE=demo and no keys → simulated payment for testing the flow
//   off      : neither → checkout is disabled (no unpaid orders can be taken)
const crypto = require("crypto");

const KEY_ID = process.env.RAZORPAY_KEY_ID || "";
const KEY_SECRET = process.env.RAZORPAY_KEY_SECRET || "";
const WEBHOOK_SECRET = process.env.RAZORPAY_WEBHOOK_SECRET || "";

const mode = KEY_ID && KEY_SECRET ? "razorpay" : process.env.PAYMENT_MODE === "demo" ? "demo" : "off";

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

module.exports = { mode, keyId: KEY_ID, createGatewayOrder, verifyCheckoutSignature, verifyWebhook, hasWebhookSecret: !!WEBHOOK_SECRET };

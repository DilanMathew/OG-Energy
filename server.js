// OG — storefront + order API + admin dashboard. Data lives in PostgreSQL (lib/db.js).
const http = require("http");
const fs = require("fs");
const path = require("path");
const zlib = require("zlib");
const crypto = require("crypto");
const db = require("./lib/db");
const pay = require("./lib/payments");
const { buildDemoOrders } = require("./lib/demo");

const PORT = process.env.PORT || 3000;
const ROOT = path.join(__dirname, "public");
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || "";
const SESSION_SECRET = process.env.SESSION_SECRET || crypto.randomBytes(32).toString("hex");
if (!process.env.SESSION_SECRET) console.warn("[og] SESSION_SECRET not set — admin sessions reset on every restart.");
if (!ADMIN_PASSWORD) console.warn("[og] ADMIN_PASSWORD not set — admin login is disabled.");
console.log(`[og] payment mode: ${pay.mode} · database: ${db.DB_LABEL}`);

// ---------------- Delivery rules ----------------
// Priority states (2–3 days), identified by pincode prefix: Tamil Nadu 60–66, Karnataka 56–59, Kerala 67–69.
// Everywhere else in India: within 7 days. Both are subject to availability.
const PRIORITY = {
  "Tamil Nadu": ["60", "61", "62", "63", "64", "65", "66"],
  Karnataka: ["56", "57", "58", "59"],
  Kerala: ["67", "68", "69"],
};
const ALL_STATES = [
  "Tamil Nadu", "Karnataka", "Kerala",
  "Andaman and Nicobar Islands", "Andhra Pradesh", "Arunachal Pradesh", "Assam", "Bihar", "Chandigarh", "Chhattisgarh",
  "Dadra and Nagar Haveli and Daman and Diu", "Delhi", "Goa", "Gujarat", "Haryana", "Himachal Pradesh", "Jammu and Kashmir",
  "Jharkhand", "Ladakh", "Lakshadweep", "Madhya Pradesh", "Maharashtra", "Manipur", "Meghalaya", "Mizoram", "Nagaland",
  "Odisha", "Puducherry", "Punjab", "Rajasthan", "Sikkim", "Telangana", "Tripura", "Uttar Pradesh", "Uttarakhand", "West Bengal",
];
// Territories whose pincodes share a priority-state prefix (e.g. Puducherry 605xxx, Lakshadweep 682xxx).
const PREFIX_EXEMPT = new Set(["Puducherry", "Lakshadweep"]);
const ETA_FAST = "2–3 days";
const ETA_STD = "7 days";
const etaFor = (state) => (PRIORITY[state] ? ETA_FAST : ETA_STD);
function priorityStateForPincode(pin) {
  if (!/^[1-9]\d{5}$/.test(pin)) return null;
  const p = pin.slice(0, 2);
  return Object.keys(PRIORITY).find((s) => PRIORITY[s].includes(p)) || null;
}

// ---------------- Helpers ----------------
const TYPES = {
  ".html": "text/html; charset=utf-8", ".css": "text/css; charset=utf-8", ".js": "application/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8", ".svg": "image/svg+xml", ".png": "image/png", ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg", ".webp": "image/webp", ".ico": "image/x-icon", ".txt": "text/plain; charset=utf-8",
};
// Version tag for CSS/JS URLs, derived from their contents at startup.
const ASSET_VERSION = (() => {
  const h = crypto.createHash("sha1");
  for (const f of ["styles.css", "app.js", "upi.js", "admin/admin.css", "admin/admin.js"]) {
    try { h.update(fs.readFileSync(path.join(ROOT, f))); } catch {}
  }
  return h.digest("hex").slice(0, 10);
})();
const COMPRESSIBLE = new Set([".html", ".css", ".js", ".json", ".svg", ".txt"]);

const BASE_HEADERS = {
  "X-Content-Type-Options": "nosniff",
  "Referrer-Policy": "strict-origin-when-cross-origin",
  "Permissions-Policy": "camera=(), microphone=(), geolocation=()",
};

function json(res, status, body, extra = {}) {
  const data = JSON.stringify(body);
  res.writeHead(status, { ...BASE_HEADERS, "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store", ...extra });
  res.end(data);
}
const fail = (res, status, error) => json(res, status, { error });

function readBody(req, limit = 64 * 1024) {
  return new Promise((resolve, reject) => {
    let size = 0;
    const chunks = [];
    req.on("data", (c) => {
      size += c.length;
      if (size > limit) { reject(Object.assign(new Error("Payload too large"), { status: 413 })); req.destroy(); return; }
      chunks.push(c);
    });
    req.on("end", () => resolve(Buffer.concat(chunks).toString("utf8")));
    req.on("error", reject);
  });
}
async function readJson(req) {
  const raw = await readBody(req);
  if (!raw) return {};
  try { return JSON.parse(raw); } catch { throw Object.assign(new Error("Invalid JSON"), { status: 400 }); }
}

function clientIp(req) {
  return (req.headers["x-forwarded-for"] || "").split(",")[0].trim() || req.socket.remoteAddress || "?";
}
const isHttps = (req) => req.headers["x-forwarded-proto"] === "https";

// Simple in-memory rate limiter
const buckets = new Map();
function rateLimit(key, max, windowMs) {
  const t = Date.now();
  const b = buckets.get(key);
  if (!b || b.reset < t) { buckets.set(key, { n: 1, reset: t + windowMs }); return true; }
  b.n++;
  return b.n <= max;
}
setInterval(() => { const t = Date.now(); for (const [k, b] of buckets) if (b.reset < t) buckets.delete(k); }, 60000).unref();

// ---------------- Admin session ----------------
const COOKIE = "og_admin";
const SESSION_HOURS = 12;
const sign = (s) => crypto.createHmac("sha256", SESSION_SECRET).update(s).digest("base64url");
function makeToken() {
  const payload = Buffer.from(JSON.stringify({ exp: Date.now() + SESSION_HOURS * 3600e3 })).toString("base64url");
  return `${payload}.${sign(payload)}`;
}
function verifyToken(tok) {
  if (!tok || !tok.includes(".")) return false;
  const [payload, sig] = tok.split(".");
  const expected = sign(payload);
  if (sig.length !== expected.length || !crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(expected))) return false;
  try { return JSON.parse(Buffer.from(payload, "base64url").toString()).exp > Date.now(); } catch { return false; }
}
function getCookie(req, name) {
  const m = (req.headers.cookie || "").split(";").map((s) => s.trim()).find((s) => s.startsWith(name + "="));
  return m ? decodeURIComponent(m.slice(name.length + 1)) : "";
}
const isAdmin = (req) => verifyToken(getCookie(req, COOKIE));
function passwordMatches(input) {
  const a = crypto.createHash("sha256").update(String(input)).digest();
  const b = crypto.createHash("sha256").update(ADMIN_PASSWORD).digest();
  return ADMIN_PASSWORD.length > 0 && crypto.timingSafeEqual(a, b);
}

// ---------------- WhatsApp reorder reminder ----------------
const DEFAULT_REMINDER =
  "Hi {name}! 👋 Your {product} sachets are almost over — they run out around {date}.\n\n" +
  "Reorder now so you don't miss a day: {link}\n\n— Team OG";
const reminderTemplate = () => db.getSetting("reminder_template", DEFAULT_REMINDER);

// ---------------- Direct UPI ----------------
const DEFAULT_UPI_PAYEE = "Hirthik Jebasekaran J"; // name on the UPI QR
async function upiConfig() {
  const vpa = (await db.getSetting("upi_id", "")) || pay.UPI_ID_ENV;
  const payee = (await db.getSetting("upi_payee", "")) || pay.UPI_PAYEE_ENV || DEFAULT_UPI_PAYEE;
  return { vpa: pay.isValidVpa(vpa) ? vpa : "", payee };
}

// ---------------- Validation ----------------
const clean = (v, max) => String(v == null ? "" : v).replace(/[\u0000-\u001f\u007f]/g, " ").trim().slice(0, max);
function validateCustomer(c = {}) {
  const out = {
    name: clean(c.name, 80),
    phone: clean(c.phone, 15).replace(/\D/g, "").replace(/^(91|0)(?=\d{10}$)/, ""),
    email: clean(c.email, 120).toLowerCase(),
    address1: clean(c.address1, 200),
    address2: clean(c.address2, 200),
    city: clean(c.city, 60),
    state: clean(c.state, 30),
    pincode: clean(c.pincode, 6),
  };
  const errors = {};
  if (out.name.length < 2) errors.name = "Enter your full name";
  if (!/^[6-9]\d{9}$/.test(out.phone)) errors.phone = "Enter a valid 10-digit mobile number";
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(out.email)) errors.email = "Enter a valid email";
  if (out.address1.length < 5) errors.address1 = "Enter your house / street address";
  if (out.city.length < 2) errors.city = "Enter your city";
  if (!ALL_STATES.includes(out.state)) errors.state = "Select your state";
  const pinState = priorityStateForPincode(out.pincode);
  if (!/^[1-9]\d{5}$/.test(out.pincode)) errors.pincode = "Enter a valid 6-digit pincode";
  else if (!PREFIX_EXEMPT.has(out.state)) {
    if (PRIORITY[out.state] && pinState !== out.state) errors.pincode = `This pincode is not in ${out.state}`;
    else if (pinState && pinState !== out.state) errors.pincode = `This pincode is in ${pinState}`;
  }
  return { customer: out, errors };
}

async function priceCart(rawItems) {
  if (!Array.isArray(rawItems) || !rawItems.length) throw Object.assign(new Error("Your cart is empty"), { status: 400 });
  if (rawItems.length > 20) throw Object.assign(new Error("Too many items"), { status: 400 });
  const merged = new Map();
  for (const it of rawItems) {
    const product = await db.getProduct(String(it.productId || ""));
    if (!product || !product.active) throw Object.assign(new Error("A product in your cart is no longer available"), { status: 400 });
    const flavor = product.flavors.find((f) => f.name === it.flavor);
    if (!flavor) throw Object.assign(new Error(`Choose a valid flavour for ${product.name}`), { status: 400 });
    const qty = Math.floor(Number(it.qty));
    if (!(qty >= 1 && qty <= 10)) throw Object.assign(new Error("Quantity must be between 1 and 10"), { status: 400 });
    const key = product.id + "|" + flavor.name;
    const prev = merged.get(key);
    merged.set(key, { productId: product.id, name: product.name, flavor: flavor.name, price: product.price, qty: (prev ? prev.qty : 0) + qty, product });
  }
  const items = [...merged.values()];
  const perProduct = {};
  for (const it of items) perProduct[it.productId] = (perProduct[it.productId] || 0) + it.qty;
  for (const it of items) {
    const p = it.product;
    if (!p.inStock) throw Object.assign(new Error(`${p.name} is currently out of stock`), { status: 409 });
    if (p.stock !== null && perProduct[p.id] > p.stock) throw Object.assign(new Error(`Only ${p.stock} left of ${p.name}`), { status: 409 });
  }
  const subtotal = items.reduce((a, i) => a + i.price * i.qty, 0);
  const shipping = Math.max(0, parseInt(await db.getSetting("shipping_fee", "0"), 10) || 0);
  return { items: items.map(({ product, ...rest }) => rest), subtotal, shipping, total: subtotal + shipping };
}

function newOrderId() {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  const bytes = crypto.randomBytes(6);
  let s = "";
  for (const b of bytes) s += alphabet[b % alphabet.length];
  return `OG-${db.istDay().slice(2).replace(/-/g, "")}-${s}`;
}

const publicOrder = (o) => ({
  id: o.id, status: o.status, createdAt: o.createdAt, paidAt: o.paidAt, items: o.items,
  subtotal: o.subtotal, shipping: o.shipping, total: o.total, tracking: o.tracking,
  city: o.customer.city, state: o.customer.state, eta: etaFor(o.customer.state),
  paymentProvider: o.paymentProvider,
  paymentRef: o.paymentProvider === "upi" && o.paymentId ? "••••" + String(o.paymentId).slice(-4) : null,
});

// ---------------- API routes ----------------
const ORDER_STATUSES = ["pending_payment", "verifying", "paid", "packed", "shipped", "delivered", "cancelled", "refunded"];

async function handleApi(req, res, url) {
  const p = url.pathname;
  const m = req.method;

  // --- Public ---
  if (m === "GET" && p === "/api/config") {
    return json(res, 200, {
      paymentMode: pay.mode,
      razorpayKey: pay.mode === "razorpay" ? pay.keyId : null,
      states: ALL_STATES,
      priorityStates: Object.keys(PRIORITY),
      eta: { priority: ETA_FAST, standard: ETA_STD },
      shippingFee: parseInt(await db.getSetting("shipping_fee", "0"), 10) || 0,
    });
  }
  if (m === "GET" && p === "/api/products") {
    return json(res, 200, { products: (await db.listProducts()).map(({ inStockFlag, active, stock, ...rest }) => ({ ...rest, lowStock: stock !== null && stock > 0 && stock <= 10 ? stock : null })) });
  }
  if (m === "GET" && p.startsWith("/api/pincode/")) {
    const pin = p.split("/").pop();
    if (!/^[1-9]\d{5}$/.test(pin)) return json(res, 200, { ok: false });
    const state = priorityStateForPincode(pin);
    return json(res, 200, state ? { ok: true, priority: true, state, eta: ETA_FAST } : { ok: true, priority: false, state: null, eta: ETA_STD });
  }
  if (m === "POST" && p === "/api/track") {
    const b = await readJson(req);
    if (!rateLimit("track:" + clientIp(req), 60, 60000)) return json(res, 200, { ok: true });
    if (/^[a-z0-9]{8,40}$/.test(b.sid || "") && ["visit", "add_to_cart", "checkout_start"].includes(b.type)) await db.trackEvent(b.sid, b.type);
    return json(res, 200, { ok: true });
  }

  if (m === "POST" && p === "/api/orders") {
    if (!rateLimit("order:" + clientIp(req), 30, 10 * 60000)) return fail(res, 429, "Too many attempts. Please wait a few minutes.");
    if (pay.mode === "off") return fail(res, 503, "Online payments are being set up. Please check back shortly.");
    const b = await readJson(req);
    const { customer, errors } = validateCustomer(b.customer);
    if (Object.keys(errors).length) return json(res, 400, { error: "Please check your details", fields: errors });
    let priced;
    try { priced = await priceCart(b.items); } catch (e) { return fail(res, e.status || 400, e.message); }

    const order = await db.createOrder({ id: newOrderId(), customer, ...priced, paymentProvider: pay.mode });
    if (/^[a-z0-9]{8,40}$/.test(b.sid || "")) db.trackEvent(b.sid, "checkout_start").catch((e) => console.error("[og] track failed:", e.message));

    if (pay.mode === "razorpay") {
      try {
        const g = await pay.createGatewayOrder(order);
        await db.setGatewayOrderId(order.id, g.id);
        return json(res, 201, {
          order: publicOrder(order),
          payment: { provider: "razorpay", key: pay.keyId, gatewayOrderId: g.id, amount: g.amount, currency: g.currency,
            prefill: { name: customer.name, email: customer.email, contact: "+91" + customer.phone } },
        });
      } catch (e) {
        console.error("[og] razorpay order failed:", e.message);
        await db.updateOrderAdmin(order.id, { status: "cancelled", adminNote: "Gateway error: " + e.message });
        return fail(res, 502, "Payment gateway is unavailable right now. Please try again.");
      }
    }
    if (pay.mode === "upi") {
      return json(res, 201, { order: publicOrder(order), payment: await pay.upiPayment(order, await upiConfig()) });
    }
    return json(res, 201, { order: publicOrder(order), payment: { provider: "demo" } });
  }

  let mm;
  if (m === "POST" && (mm = p.match(/^\/api\/orders\/([A-Z0-9-]{6,30})\/verify$/))) {
    if (pay.mode !== "razorpay") return fail(res, 400, "Not available");
    const b = await readJson(req);
    const order = await db.getOrder(mm[1]);
    if (!order || order.gatewayOrderId !== b.razorpay_order_id) return fail(res, 404, "Order not found");
    if (!pay.verifyCheckoutSignature(b.razorpay_order_id, b.razorpay_payment_id, b.razorpay_signature)) {
      return fail(res, 400, "Payment could not be verified. If money was debited, it will be confirmed automatically or refunded.");
    }
    const updated = await db.markPaid(order.id, String(b.razorpay_payment_id).slice(0, 64));
    return json(res, 200, { order: publicOrder(updated) });
  }
  // Direct UPI: re-open payment instructions for an unpaid order (e.g. "Complete payment" on the track page).
  if (m === "POST" && (mm = p.match(/^\/api\/orders\/([A-Z0-9-]{6,30})\/upi$/))) {
    if (!rateLimit("upi:" + clientIp(req), 30, 10 * 60000)) return fail(res, 429, "Too many attempts. Please wait a few minutes.");
    const b = await readJson(req);
    const order = await db.getOrder(mm[1]);
    const phone = clean(b.phone, 15).replace(/\D/g, "").slice(-10);
    if (!order || order.customer.phone !== phone || order.paymentProvider !== "upi") return fail(res, 404, "Order not found");
    if (order.status !== "pending_payment") return fail(res, 409, "This order doesn't need a payment");
    return json(res, 200, { order: publicOrder(order), payment: await pay.upiPayment(order, await upiConfig()) });
  }
  // Direct UPI: customer submits the 12-digit UPI reference (UTR) after paying; the admin then confirms it.
  if (m === "POST" && (mm = p.match(/^\/api\/orders\/([A-Z0-9-]{6,30})\/upi-submit$/))) {
    if (!rateLimit("utr:" + clientIp(req), 15, 10 * 60000)) return fail(res, 429, "Too many attempts. Please wait a few minutes.");
    const b = await readJson(req);
    const order = await db.getOrder(mm[1]);
    if (!order || order.paymentProvider !== "upi") return fail(res, 404, "Order not found");
    const utr = pay.normaliseUtr(b.utr);
    if (!pay.isValidUtr(utr)) return json(res, 400, { error: "Enter the 12-digit UPI reference number", fields: { utr: "Enter the 12-digit UPI reference number" } });
    const r = await db.submitUpiPayment(order.id, utr);
    if (r.error === "duplicate") return json(res, 409, { error: "This UPI reference is already linked to another order. Please check the number.", fields: { utr: "Already used for another order" } });
    if (r.error === "state") return fail(res, 409, r.status === "cancelled" ? "This order was cancelled. Please place a new order." : "This order is already confirmed.");
    if (r.error) return fail(res, 404, "Order not found");
    return json(res, 200, { order: publicOrder(r.order) });
  }
  if (m === "POST" && (mm = p.match(/^\/api\/orders\/([A-Z0-9-]{6,30})\/demo-pay$/))) {
    if (pay.mode !== "demo") return fail(res, 400, "Not available");
    const order = await db.getOrder(mm[1]);
    if (!order) return fail(res, 404, "Order not found");
    const updated = await db.markPaid(order.id, "demo_" + crypto.randomBytes(6).toString("hex"));
    return json(res, 200, { order: publicOrder(updated) });
  }
  if (m === "POST" && p === "/api/orders/lookup") {
    if (!rateLimit("lookup:" + clientIp(req), 20, 10 * 60000)) return fail(res, 429, "Too many attempts. Please wait a few minutes.");
    const b = await readJson(req);
    const order = await db.getOrder(clean(b.id, 30).toUpperCase());
    const phone = clean(b.phone, 15).replace(/\D/g, "").slice(-10);
    if (!order || order.customer.phone !== phone) return fail(res, 404, "No order found with that ID and phone number");
    return json(res, 200, { order: publicOrder(order) });
  }

  if (m === "POST" && p === "/api/razorpay/webhook") {
    const raw = await readBody(req, 512 * 1024);
    if (!pay.verifyWebhook(raw, req.headers["x-razorpay-signature"])) return fail(res, 400, "Invalid signature");
    let evt;
    try { evt = JSON.parse(raw); } catch { return fail(res, 400, "Invalid JSON"); }
    const payment = evt.payload && evt.payload.payment && evt.payload.payment.entity;
    if ((evt.event === "payment.captured" || evt.event === "order.paid") && payment && payment.order_id) {
      const order = await db.getOrderByGatewayId(payment.order_id);
      if (order && payment.amount === order.total * 100) await db.markPaid(order.id, payment.id);
    }
    return json(res, 200, { ok: true });
  }

  // --- Admin ---
  if (p.startsWith("/api/admin/")) {
    if (m !== "GET" && req.headers["x-og-admin"] !== "1") return fail(res, 403, "Forbidden");

    if (m === "POST" && p === "/api/admin/login") {
      if (!ADMIN_PASSWORD) return fail(res, 503, "Admin login is not configured. Set ADMIN_PASSWORD on the server.");
      if (!rateLimit("login:" + clientIp(req), 8, 15 * 60000)) return fail(res, 429, "Too many attempts. Try again in 15 minutes.");
      const b = await readJson(req);
      if (!passwordMatches(b.password || "")) return fail(res, 401, "Incorrect password");
      const cookie = `${COOKIE}=${makeToken()}; Path=/; HttpOnly; SameSite=Strict; Max-Age=${SESSION_HOURS * 3600}${isHttps(req) ? "; Secure" : ""}`;
      return json(res, 200, { ok: true }, { "Set-Cookie": cookie });
    }
    if (m === "POST" && p === "/api/admin/logout") {
      return json(res, 200, { ok: true }, { "Set-Cookie": `${COOKIE}=; Path=/; HttpOnly; SameSite=Strict; Max-Age=0` });
    }
    if (!isAdmin(req)) return fail(res, 401, "Not signed in");

    if (m === "GET" && p === "/api/admin/me") {
      const u = await upiConfig();
      return json(res, 200, { ok: true, paymentMode: pay.mode, webhook: pay.hasWebhookSecret, upi: { vpa: u.vpa, payee: u.payee, qrImage: pay.UPI_QR_IMAGE } });
    }
    if (m === "GET" && p === "/api/admin/stats") {
      const days = parseInt(url.searchParams.get("days"), 10);
      return json(res, 200, await db.stats([7, 30, 90, 365].includes(days) ? days : 0));
    }
    if (m === "GET" && p === "/api/admin/orders") {
      return json(res, 200, { orders: await db.listOrders({ status: url.searchParams.get("status"), q: clean(url.searchParams.get("q"), 60) }) });
    }
    if (m === "GET" && p === "/api/admin/orders.csv") {
      const rows = await db.listOrders({ status: url.searchParams.get("status"), limit: 100000 });
      const esc = (v) => {
        let s = String(v == null ? "" : v);
        if (/^[=+\-@\t\r]/.test(s)) s = "'" + s; // guard against spreadsheet formula injection
        return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
      };
      const head = ["Order ID", "Created", "Status", "Name", "Phone", "Email", "Address", "City", "State", "Pincode", "Items", "Subtotal", "Shipping", "Total", "Payment ID", "Paid at", "Tracking"];
      const lines = rows.map((o) => [o.id, o.createdAt, o.status, o.customer.name, o.customer.phone, o.customer.email,
        [o.customer.address1, o.customer.address2].filter(Boolean).join(", "), o.customer.city, o.customer.state, o.customer.pincode,
        o.items.map((i) => `${i.qty}× ${i.name} (${i.flavor})`).join("; "), o.subtotal, o.shipping, o.total, o.paymentId, o.paidAt, o.tracking].map(esc).join(","));
      res.writeHead(200, { ...BASE_HEADERS, "Content-Type": "text/csv; charset=utf-8", "Content-Disposition": `attachment; filename="og-orders-${db.istDay()}.csv"`, "Cache-Control": "no-store" });
      return res.end("﻿" + [head.join(","), ...lines].join("\n"));
    }
    if ((mm = p.match(/^\/api\/admin\/orders\/([A-Z0-9-]{6,30})$/))) {
      if (m === "GET") { const o = await db.getOrder(mm[1]); return o ? json(res, 200, { order: o }) : fail(res, 404, "Not found"); }
      if (m === "PATCH") {
        const b = await readJson(req);
        const o = await db.getOrder(mm[1]);
        if (!o) return fail(res, 404, "Not found");
        if (b.status !== undefined) {
          if (!ORDER_STATUSES.includes(b.status)) return fail(res, 400, "Invalid status");
          if (b.status === "paid" && (o.status === "pending_payment" || o.status === "verifying")) {
            return fail(res, 400, o.paymentProvider === "upi" ? "Use “Confirm payment received” to mark a UPI order paid" : "Orders become paid only through the payment gateway");
          }
          if (b.status === "verifying" && o.status !== "verifying") return fail(res, 400, "Only the customer can submit a UPI payment for verification");
          if (b.status === "pending_payment" && o.status !== "pending_payment" && o.status !== "verifying") return fail(res, 400, "Cannot move a paid order back to pending");
        }
        const updated = await db.updateOrderAdmin(o.id, {
          status: b.status,
          tracking: b.tracking !== undefined ? clean(b.tracking, 120) : undefined,
          adminNote: b.adminNote !== undefined ? clean(b.adminNote, 500) : undefined,
        });
        return json(res, 200, { order: updated });
      }
    }
    // Direct UPI: admin confirms the money arrived (checked in their UPI / bank app) → order becomes paid.
    if (m === "POST" && (mm = p.match(/^\/api\/admin\/orders\/([A-Z0-9-]{6,30})\/confirm-payment$/))) {
      const o = await db.getOrder(mm[1]);
      if (!o) return fail(res, 404, "Not found");
      if (o.paymentProvider !== "upi") return fail(res, 400, "Only UPI orders are confirmed manually");
      if (o.status !== "pending_payment" && o.status !== "verifying") return fail(res, 409, "This order is not awaiting payment");
      const b = await readJson(req);
      const utr = b.utr ? pay.normaliseUtr(b.utr) : o.paymentId || "";
      if (!pay.isValidUtr(utr)) return fail(res, 400, "Enter the 12-digit UPI reference (UTR) from the payment you received");
      const r = await db.submitUpiPayment(o.id, utr); // records the reference + duplicate check
      if (r.error === "duplicate") return fail(res, 409, "That UPI reference is already used on another order");
      if (r.error) return fail(res, 409, "This order is not awaiting payment");
      return json(res, 200, { order: await db.markPaid(o.id, utr, "admin (UPI verified)") });
    }
    if (m === "GET" && p === "/api/admin/products") return json(res, 200, { products: await db.listProducts({ includeInactive: true }) });
    if (m === "PATCH" && (mm = p.match(/^\/api\/admin\/products\/([a-z0-9-]{2,40})$/))) {
      const prod = await db.getProduct(mm[1]);
      if (!prod) return fail(res, 404, "Not found");
      const b = await readJson(req);
      const price = Math.round(Number(b.price));
      const mrp = b.mrp === null || b.mrp === "" ? null : Math.round(Number(b.mrp));
      const stock = b.stock === null || b.stock === "" ? null : Math.round(Number(b.stock));
      if (!(price >= 1 && price <= 1000000)) return fail(res, 400, "Enter a valid price");
      if (mrp !== null && !(mrp >= price)) return fail(res, 400, "MRP must be blank or at least the price");
      if (stock !== null && !(stock >= 0)) return fail(res, 400, "Stock must be blank (untracked) or 0 or more");
      const supplyDays = b.supplyDays === undefined ? prod.supplyDays : b.supplyDays === null || b.supplyDays === "" ? null : Math.round(Number(b.supplyDays));
      if (supplyDays !== null && !(supplyDays >= 1 && supplyDays <= 365)) return fail(res, 400, "Days per unit must be blank or 1–365");
      return json(res, 200, { product: await db.updateProduct(prod.id, { price, mrp, stock, inStock: !!b.inStock, active: !!b.active, supplyDays }) });
    }
    if (m === "GET" && p === "/api/admin/reminders") {
      return json(res, 200, { ...(await db.reorderReminders()), template: await reminderTemplate() });
    }
    if (m === "POST" && (mm = p.match(/^\/api\/admin\/reminders\/([A-Z0-9-]{6,30})$/))) {
      if (!(await db.getOrder(mm[1]))) return fail(res, 404, "Not found");
      const b = await readJson(req);
      if (!["sent", "skipped", "reset"].includes(b.action)) return fail(res, 400, "Invalid action");
      await db.setReminder(mm[1], b.action, b.action === "sent" ? String(b.message || "").slice(0, 2000) : null);
      return json(res, 200, { ok: true });
    }
    if (p === "/api/admin/demo-orders") {
      if (m === "POST") await db.insertDemoOrders(buildDemoOrders(await db.listProducts({ includeInactive: true })));
      else if (m === "DELETE") await db.clearDemoOrders();
      return json(res, 200, { count: await db.countDemoOrders() });
    }
    if (p === "/api/admin/settings") {
      if (m === "PATCH") {
        const b = await readJson(req);
        if (b.shippingFee !== undefined) {
          const fee = Math.round(Number(b.shippingFee));
          if (!(fee >= 0 && fee <= 10000)) return fail(res, 400, "Enter a valid shipping fee");
          await db.setSetting("shipping_fee", fee);
        }
        if (b.upiId !== undefined) {
          const v = String(b.upiId).trim();
          if (v && !pay.isValidVpa(v)) return fail(res, 400, "Enter a valid UPI ID, e.g. name@okaxis");
          await db.setSetting("upi_id", v);
        }
        if (b.upiPayee !== undefined) {
          const v = clean(b.upiPayee, 60);
          if (v.length < 2) return fail(res, 400, "Enter the account holder name shown in UPI apps");
          await db.setSetting("upi_payee", v);
        }
        if (b.reminderTemplate !== undefined) {
          const t = String(b.reminderTemplate).replace(/\r/g, "").trim().slice(0, 1000);
          if (!t) return fail(res, 400, "The reminder message can't be empty");
          await db.setSetting("reminder_template", t);
        }
      }
      const u = await upiConfig();
      return json(res, 200, {
        shippingFee: parseInt(await db.getSetting("shipping_fee", "0"), 10) || 0, reminderTemplate: await reminderTemplate(),
        upiId: u.vpa, upiPayee: u.payee, upiQrImage: pay.UPI_QR_IMAGE,
      });
    }
  }

  return fail(res, 404, "Not found");
}

// ---------------- Static files ----------------
function serveStatic(req, res, url) {
  let urlPath;
  try { urlPath = decodeURIComponent(url.pathname); } catch { res.writeHead(400); return res.end("Bad Request"); }
  if (urlPath === "/admin") { res.writeHead(301, { Location: "/admin/" }); return res.end(); }
  if (urlPath === "/track") urlPath = "/track.html";
  if (urlPath === "/policies") urlPath = "/policies.html";
  if (urlPath.endsWith("/")) urlPath += "index.html";

  const filePath = path.normalize(path.join(ROOT, urlPath));
  if (!filePath.startsWith(ROOT + path.sep)) { res.writeHead(403); return res.end("Forbidden"); }

  fs.stat(filePath, (err, stat) => {
    let target = filePath;
    let status = 200;
    if (err || !stat.isFile()) {
      if (path.extname(urlPath)) { res.writeHead(404, { "Content-Type": "text/plain" }); return res.end("Not found"); }
      target = path.join(ROOT, "index.html");
    }
    const ext = path.extname(target).toLowerCase();
    fs.readFile(target, (readErr, data) => {
      if (readErr) { res.writeHead(500); return res.end("Server Error"); }
      // Stamp asset URLs in HTML with the build version so browsers never mix old CSS/JS with new pages.
      if (ext === ".html") data = Buffer.from(data.toString("utf8").replace(/__V__/g, ASSET_VERSION));
      const etag = '"' + crypto.createHash("sha1").update(data).digest("base64url").slice(0, 20) + '"';
      const headers = {
        ...BASE_HEADERS,
        "Content-Type": TYPES[ext] || "application/octet-stream",
        // HTML/CSS/JS: always revalidate (cheap 304s). Images: cache for a day.
        "Cache-Control": ext === ".webp" || ext === ".png" || ext === ".jpg" ? "public, max-age=86400" : "no-cache",
        ETag: etag,
      };
      if (target.includes(path.sep + "admin" + path.sep)) {
        headers["X-Frame-Options"] = "DENY";
        headers["X-Robots-Tag"] = "noindex, nofollow";
      }
      if (req.headers["if-none-match"] === etag) { res.writeHead(304, headers); return res.end(); }
      if (COMPRESSIBLE.has(ext) && /\bgzip\b/.test(req.headers["accept-encoding"] || "")) {
        headers["Content-Encoding"] = "gzip";
        headers["Vary"] = "Accept-Encoding";
        data = zlib.gzipSync(data);
      }
      headers["Content-Length"] = data.length;
      res.writeHead(status, headers);
      res.end(req.method === "HEAD" ? undefined : data);
    });
  });
}

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, "http://localhost");
  if (url.pathname === "/health") {
    try { await db.ping(); res.writeHead(200, { "Content-Type": "text/plain" }); return res.end("ok"); }
    catch { res.writeHead(503, { "Content-Type": "text/plain" }); return res.end("database unavailable"); }
  }
  if (url.pathname.startsWith("/api/")) {
    try {
      await handleApi(req, res, url);
    } catch (e) {
      if (!res.headersSent) fail(res, e.status || 500, e.status ? e.message : "Something went wrong");
      if (!e.status) console.error("[og] API error:", e);
    }
    return;
  }
  if (req.method !== "GET" && req.method !== "HEAD") { res.writeHead(405, { Allow: "GET, HEAD" }); return res.end(); }
  serveStatic(req, res, url);
});

db.ready.then(
  () => server.listen(PORT, "0.0.0.0", () => console.log(`[og] live on port ${PORT}`)),
  (e) => { console.error("[og] database startup failed:", e.message); process.exit(1); }
);

// Finish in-flight requests and close database connections cleanly on redeploy.
process.on("SIGTERM", () => {
  console.log("[og] shutting down");
  server.close(() => db.pool.end().finally(() => process.exit(0)));
  setTimeout(() => process.exit(0), 10000).unref();
});

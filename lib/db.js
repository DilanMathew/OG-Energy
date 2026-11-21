// SQLite storage (Node's built-in node:sqlite — no external dependencies).
const fs = require("fs");
const path = require("path");
const { DatabaseSync } = require("node:sqlite");

const DATA_DIR = process.env.DATA_DIR || process.env.RAILWAY_VOLUME_MOUNT_PATH || path.join(__dirname, "..", "data");
fs.mkdirSync(DATA_DIR, { recursive: true });
const DB_PATH = path.join(DATA_DIR, "og.sqlite");

const db = new DatabaseSync(DB_PATH);
db.exec(`
  PRAGMA journal_mode = WAL;
  PRAGMA foreign_keys = ON;

  CREATE TABLE IF NOT EXISTS products (
    id          TEXT PRIMARY KEY,
    name        TEXT NOT NULL,
    short_name  TEXT NOT NULL,
    subtitle    TEXT NOT NULL,
    description TEXT NOT NULL,
    flavors     TEXT NOT NULL,           -- JSON array of {name, image}
    image       TEXT NOT NULL,
    accent      TEXT NOT NULL,
    price       INTEGER NOT NULL,        -- rupees
    mrp         INTEGER,
    stock       INTEGER,                 -- NULL = not tracked
    in_stock    INTEGER NOT NULL DEFAULT 1,
    active      INTEGER NOT NULL DEFAULT 1,
    sort        INTEGER NOT NULL DEFAULT 0
  );

  CREATE TABLE IF NOT EXISTS orders (
    id                TEXT PRIMARY KEY,
    created_at        TEXT NOT NULL,
    updated_at        TEXT NOT NULL,
    status            TEXT NOT NULL,
    name              TEXT NOT NULL,
    phone             TEXT NOT NULL,
    email             TEXT NOT NULL,
    address1          TEXT NOT NULL,
    address2          TEXT,
    city              TEXT NOT NULL,
    state             TEXT NOT NULL,
    pincode           TEXT NOT NULL,
    items             TEXT NOT NULL,     -- JSON
    subtotal          INTEGER NOT NULL,
    shipping          INTEGER NOT NULL,
    total             INTEGER NOT NULL,
    payment_provider  TEXT NOT NULL,
    gateway_order_id  TEXT,
    payment_id        TEXT,
    paid_at           TEXT,
    tracking          TEXT,
    admin_note        TEXT,
    history           TEXT NOT NULL DEFAULT '[]'
  );
  CREATE INDEX IF NOT EXISTS idx_orders_created ON orders(created_at);
  CREATE INDEX IF NOT EXISTS idx_orders_status ON orders(status);
  CREATE INDEX IF NOT EXISTS idx_orders_gateway ON orders(gateway_order_id);

  -- One row per visitor per day per funnel step (deduplicated, bounded growth).
  CREATE TABLE IF NOT EXISTS events (
    day  TEXT NOT NULL,
    sid  TEXT NOT NULL,
    type TEXT NOT NULL,
    PRIMARY KEY (day, sid, type)
  );

  CREATE TABLE IF NOT EXISTS settings (
    key   TEXT PRIMARY KEY,
    value TEXT NOT NULL
  );
`);

// ---- Seed catalogue (only inserted if missing; admin edits are kept) ----
const SEED = [
  {
    id: "og-whey",
    name: "OG Whey Protein Concentrate",
    short_name: "Whey",
    subtitle: "1 box · 28 sachets × 34g · 24g protein each",
    description: "European-imported whey protein concentrate in single-serve sachets. Tear, shake, go — one for every day of the month.",
    flavors: [
      { name: "Swiss Choco", image: "/img/sachet-whey-choco.webp" },
      { name: "Vanilla", image: "/img/sachet-whey-vanilla.webp" },
    ],
    image: "/img/whey-box.webp",
    accent: "#F7931E",
    price: 3799,
    mrp: 3999,
    sort: 1,
  },
  {
    id: "og-yeast",
    name: "OG Fermented Yeast Protein",
    short_name: "Yeast Protein",
    subtitle: "1 box · 28 sachets × 34g · 24g protein each",
    description: "Fermented yeast protein imported from Europe — a dairy-free protein source in the same grab-and-go sachet format.",
    flavors: [
      { name: "Choco Berry", image: null },
      { name: "Vanilla", image: "/img/sachet-yeast-vanilla.webp" },
    ],
    image: "/img/yeast-box.webp",
    accent: "#8DC63F",
    price: 2799,
    mrp: 2999,
    sort: 2,
  },
  {
    id: "og-creatine",
    name: "OG Creatine Monohydrate + Taurine",
    short_name: "Creatine + Taurine",
    subtitle: "120g tub · Fruit Fusion & Orange",
    description: "Creatine monohydrate with taurine — made to improve muscle strength, cognitive function and performance.^",
    flavors: [
      { name: "Fruit Fusion", image: "/img/creatine.webp" },
      { name: "Orange", image: "/img/creatine.webp" },
    ],
    image: "/img/creatine.webp",
    accent: "#E9A23B",
    price: 799,
    mrp: 999,
    sort: 3,
  },
];

const insertProduct = db.prepare(`
  INSERT OR IGNORE INTO products (id, name, short_name, subtitle, description, flavors, image, accent, price, mrp, sort)
  VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`);
for (const p of SEED) {
  insertProduct.run(p.id, p.name, p.short_name, p.subtitle, p.description, JSON.stringify(p.flavors), p.image, p.accent, p.price, p.mrp, p.sort);
}
db.prepare("INSERT OR IGNORE INTO settings (key, value) VALUES ('shipping_fee', '0')").run();

// ---- One-time catalogue updates for existing databases ----
// v2: new prices/MRPs, Choco Berry (yeast) and Fruit Fusion (creatine) flavours, creatine copy.
{
  const cur = db.prepare("SELECT value FROM settings WHERE key = 'catalog_version'").get();
  if (!cur || Number(cur.value) < 2) {
    const upd = db.prepare("UPDATE products SET price = ?, mrp = ?, flavors = ?, subtitle = ?, description = ? WHERE id = ?");
    for (const p of SEED) upd.run(p.price, p.mrp, JSON.stringify(p.flavors), p.subtitle, p.description, p.id);
    db.prepare("INSERT INTO settings (key, value) VALUES ('catalog_version', '2') ON CONFLICT(key) DO UPDATE SET value = '2'").run();
    console.log("[og] catalogue updated to v2");
  }
}

const now = () => new Date().toISOString();

// ---- Products ----
const rowToProduct = (r) => ({
  id: r.id,
  name: r.name,
  shortName: r.short_name,
  subtitle: r.subtitle,
  description: r.description,
  flavors: JSON.parse(r.flavors),
  image: r.image,
  accent: r.accent,
  price: r.price,
  mrp: r.mrp,
  stock: r.stock,
  inStock: !!r.in_stock && (r.stock === null || r.stock > 0),
  inStockFlag: !!r.in_stock,
  active: !!r.active,
});

function listProducts({ includeInactive = false } = {}) {
  const rows = db.prepare(`SELECT * FROM products ${includeInactive ? "" : "WHERE active = 1"} ORDER BY sort`).all();
  return rows.map(rowToProduct);
}
function getProduct(id) {
  const r = db.prepare("SELECT * FROM products WHERE id = ?").get(id);
  return r ? rowToProduct(r) : null;
}
function updateProduct(id, { price, mrp, stock, inStock, active }) {
  db.prepare(`UPDATE products SET price = ?, mrp = ?, stock = ?, in_stock = ?, active = ? WHERE id = ?`)
    .run(price, mrp, stock, inStock ? 1 : 0, active ? 1 : 0, id);
  return getProduct(id);
}

// ---- Settings ----
function getSetting(key, fallback) {
  const r = db.prepare("SELECT value FROM settings WHERE key = ?").get(key);
  return r ? r.value : fallback;
}
function setSetting(key, value) {
  db.prepare("INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value").run(key, String(value));
}

// ---- Orders ----
const rowToOrder = (r) =>
  r && {
    id: r.id,
    createdAt: r.created_at,
    updatedAt: r.updated_at,
    status: r.status,
    customer: { name: r.name, phone: r.phone, email: r.email, address1: r.address1, address2: r.address2, city: r.city, state: r.state, pincode: r.pincode },
    items: JSON.parse(r.items),
    subtotal: r.subtotal,
    shipping: r.shipping,
    total: r.total,
    paymentProvider: r.payment_provider,
    gatewayOrderId: r.gateway_order_id,
    paymentId: r.payment_id,
    paidAt: r.paid_at,
    tracking: r.tracking,
    adminNote: r.admin_note,
    history: JSON.parse(r.history || "[]"),
  };

function createOrder(o) {
  const ts = now();
  db.prepare(`
    INSERT INTO orders (id, created_at, updated_at, status, name, phone, email, address1, address2, city, state, pincode,
                        items, subtotal, shipping, total, payment_provider, history)
    VALUES (?, ?, ?, 'pending_payment', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`).run(
    o.id, ts, ts, o.customer.name, o.customer.phone, o.customer.email, o.customer.address1, o.customer.address2 || null,
    o.customer.city, o.customer.state, o.customer.pincode, JSON.stringify(o.items), o.subtotal, o.shipping, o.total,
    o.paymentProvider, JSON.stringify([{ at: ts, status: "pending_payment", by: "customer" }])
  );
  return getOrder(o.id);
}
function getOrder(id) {
  return rowToOrder(db.prepare("SELECT * FROM orders WHERE id = ?").get(id));
}
function getOrderByGatewayId(gid) {
  return rowToOrder(db.prepare("SELECT * FROM orders WHERE gateway_order_id = ?").get(gid));
}
function setGatewayOrderId(id, gid) {
  db.prepare("UPDATE orders SET gateway_order_id = ?, updated_at = ? WHERE id = ?").run(gid, now(), id);
}

function pushHistory(order, status, by, extra) {
  const h = order.history.concat([{ at: now(), status, by, ...(extra || {}) }]);
  return JSON.stringify(h.slice(-50));
}

/** Idempotently mark an order paid and decrement tracked stock. Returns the order. */
function markPaid(id, paymentId) {
  db.exec("BEGIN IMMEDIATE");
  try {
    const order = getOrder(id);
    if (!order || order.status !== "pending_payment") {
      db.exec("COMMIT");
      return order;
    }
    const ts = now();
    db.prepare("UPDATE orders SET status = 'paid', payment_id = ?, paid_at = ?, updated_at = ?, history = ? WHERE id = ?")
      .run(paymentId, ts, ts, pushHistory(order, "paid", "payment"), id);
    const dec = db.prepare("UPDATE products SET stock = MAX(stock - ?, 0) WHERE id = ? AND stock IS NOT NULL");
    for (const it of order.items) dec.run(it.qty, it.productId);
    db.exec("COMMIT");
  } catch (e) {
    db.exec("ROLLBACK");
    throw e;
  }
  return getOrder(id);
}

function updateOrderAdmin(id, { status, tracking, adminNote }) {
  const order = getOrder(id);
  if (!order) return null;
  const ts = now();
  const history = status && status !== order.status ? pushHistory(order, status, "admin") : JSON.stringify(order.history);
  db.prepare("UPDATE orders SET status = ?, tracking = ?, admin_note = ?, updated_at = ?, history = ? WHERE id = ?").run(
    status || order.status,
    tracking !== undefined ? tracking : order.tracking,
    adminNote !== undefined ? adminNote : order.adminNote,
    ts,
    history,
    id
  );
  return getOrder(id);
}

function listOrders({ status, q, limit = 200, offset = 0 } = {}) {
  const where = [];
  const args = [];
  if (status && status !== "all") {
    if (status === "open") where.push("status IN ('paid','packed','shipped')");
    else { where.push("status = ?"); args.push(status); }
  }
  if (q) {
    where.push("(id LIKE ? OR name LIKE ? OR phone LIKE ? OR email LIKE ? OR pincode LIKE ? OR city LIKE ?)");
    const like = `%${q}%`;
    args.push(like, like, like, like, like, like);
  }
  const sql = `SELECT * FROM orders ${where.length ? "WHERE " + where.join(" AND ") : ""} ORDER BY created_at DESC LIMIT ? OFFSET ?`;
  return db.prepare(sql).all(...args, limit, offset).map(rowToOrder);
}

// ---- Analytics ----
const IST = "'+5 hours', '+30 minutes'";
const PAID = "('paid','packed','shipped','delivered')";

function istDay(d = new Date()) {
  return new Date(d.getTime() + 330 * 60000).toISOString().slice(0, 10);
}

function trackEvent(sid, type) {
  db.prepare("INSERT OR IGNORE INTO events (day, sid, type) VALUES (?, ?, ?)").run(istDay(), sid, type);
}

function stats(days) {
  const since = days ? istDay(new Date(Date.now() - (days - 1) * 86400000)) : "0000-00-00";
  const dayExpr = `date(created_at, ${IST})`;

  const k = db.prepare(`
    SELECT
      COALESCE(SUM(CASE WHEN status IN ${PAID} THEN total END), 0)  AS revenue,
      COALESCE(SUM(CASE WHEN status IN ${PAID} THEN 1 END), 0)      AS paid,
      COALESCE(SUM(CASE WHEN status = 'pending_payment' THEN 1 END), 0) AS pending,
      COALESCE(SUM(CASE WHEN status IN ('cancelled','refunded') THEN 1 END), 0) AS cancelled,
      COUNT(*) AS created
    FROM orders WHERE ${dayExpr} >= ?`).get(since);

  const funnelRows = db.prepare(`SELECT type, COUNT(DISTINCT sid) AS n FROM events WHERE day >= ? GROUP BY type`).all(since);
  const f = Object.fromEntries(funnelRows.map((r) => [r.type, r.n]));

  const daily = db.prepare(`
    SELECT ${dayExpr} AS day,
      COALESCE(SUM(CASE WHEN status IN ${PAID} THEN total END), 0) AS revenue,
      COALESCE(SUM(CASE WHEN status IN ${PAID} THEN 1 END), 0) AS orders
    FROM orders WHERE ${dayExpr} >= ? GROUP BY day ORDER BY day`).all(since);
  const visitsDaily = db.prepare(`SELECT day, COUNT(DISTINCT sid) AS n FROM events WHERE type = 'visit' AND day >= ? GROUP BY day`).all(since);

  const byState = db.prepare(`
    SELECT state, COUNT(*) AS orders, SUM(total) AS revenue FROM orders
    WHERE status IN ${PAID} AND ${dayExpr} >= ? GROUP BY state ORDER BY revenue DESC`).all(since);

  const paidOrders = db.prepare(`SELECT items FROM orders WHERE status IN ${PAID} AND ${dayExpr} >= ?`).all(since);
  const mix = {};
  for (const r of paidOrders) {
    for (const it of JSON.parse(r.items)) {
      const key = `${it.name} — ${it.flavor}`;
      mix[key] = mix[key] || { label: key, productId: it.productId, units: 0, revenue: 0 };
      mix[key].units += it.qty;
      mix[key].revenue += it.qty * it.price;
    }
  }

  const queue = db.prepare(`SELECT status, COUNT(*) AS n FROM orders WHERE status IN ('paid','packed','shipped') GROUP BY status`).all();

  return {
    since,
    revenue: k.revenue,
    paidOrders: k.paid,
    pendingPayments: k.pending,
    cancelled: k.cancelled,
    ordersCreated: k.created,
    aov: k.paid ? Math.round(k.revenue / k.paid) : 0,
    funnel: {
      visitors: f.visit || 0,
      addedToCart: f.add_to_cart || 0,
      checkoutStarted: f.checkout_start || 0,
      paid: k.paid,
    },
    daily,
    visitsDaily,
    byState,
    productMix: Object.values(mix).sort((a, b) => b.revenue - a.revenue),
    queue: Object.fromEntries(queue.map((r) => [r.status, r.n])),
  };
}

module.exports = {
  DB_PATH,
  listProducts, getProduct, updateProduct,
  getSetting, setSetting,
  createOrder, getOrder, getOrderByGatewayId, setGatewayOrderId, markPaid, updateOrderAdmin, listOrders,
  trackEvent, stats, istDay,
};

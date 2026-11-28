// PostgreSQL storage (DATABASE_URL). On first start against an empty database, any existing
// SQLite data (og.sqlite in DATA_DIR) is imported once — see lib/import-sqlite.js.
const { Pool } = require("pg");
const { importFromSqlite } = require("./import-sqlite");

if (!process.env.DATABASE_URL) {
  console.error("[og] DATABASE_URL is not set. Connect the Postgres service (DATABASE_URL=${{Postgres.DATABASE_URL}}).");
  process.exit(1);
}

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  max: Number(process.env.PG_POOL_MAX) || 10,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 10000,
});
pool.on("error", (e) => console.error("[og] idle Postgres connection error:", e.message));

const DB_LABEL = (() => {
  try { const u = new URL(process.env.DATABASE_URL); return `postgres://${u.hostname}${u.port ? ":" + u.port : ""}${u.pathname}`; }
  catch { return "postgres"; }
})();

const q = (sql, args = []) => pool.query(sql, args);
const one = async (sql, args) => (await q(sql, args)).rows[0];
const all = async (sql, args) => (await q(sql, args)).rows;

/** Run fn(client) in a transaction. */
async function tx(fn) {
  const c = await pool.connect();
  try {
    await c.query("BEGIN");
    const out = await fn(c);
    await c.query("COMMIT");
    return out;
  } catch (e) {
    await c.query("ROLLBACK").catch(() => {});
    throw e;
  } finally {
    c.release();
  }
}

// Timestamps are stored as ISO-8601 text (same as before), JSON fields as text.
const SCHEMA = `
  CREATE TABLE IF NOT EXISTS products (
    id          TEXT PRIMARY KEY,
    name        TEXT NOT NULL,
    short_name  TEXT NOT NULL,
    subtitle    TEXT NOT NULL,
    description TEXT NOT NULL,
    flavors     TEXT NOT NULL,
    image       TEXT NOT NULL,
    accent      TEXT NOT NULL,
    price       INTEGER NOT NULL,
    mrp         INTEGER,
    stock       INTEGER,
    in_stock    INTEGER NOT NULL DEFAULT 1,
    active      INTEGER NOT NULL DEFAULT 1,
    sort        INTEGER NOT NULL DEFAULT 0,
    supply_days INTEGER
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
    items             TEXT NOT NULL,
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
  CREATE INDEX IF NOT EXISTS idx_orders_phone ON orders(phone);
  CREATE INDEX IF NOT EXISTS idx_orders_payment ON orders(payment_id);

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

  -- Reorder reminders the admin has acted on (one per order): 'sent' or 'skipped'.
  CREATE TABLE IF NOT EXISTS reminders (
    order_id TEXT PRIMARY KEY REFERENCES orders(id),
    status   TEXT NOT NULL,
    at       TEXT NOT NULL,
    message  TEXT
  );
`;

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
    supply_days: 28, // 28 sachets = 28 days
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
    supply_days: 28,
  },
  {
    id: "og-creatine",
    name: "OG Creatine Monohydrate + Taurine",
    short_name: "Creatine + Taurine",
    subtitle: "120g tub · Fruit Fusion & Orange",
    description: "Creatine monohydrate with taurine — made to improve muscle strength, support cognitive function and boost performance.^",
    // `main` swaps the product image per flavour; `color` matches the flavour badge on the pack.
    flavors: [
      { name: "Fruit Fusion", main: "/img/creatine-fruit-fusion.webp", color: "#E23A4E", text: "#ffffff" },
      { name: "Orange", main: "/img/creatine.webp", color: "#E9A23B", text: "#111111" },
    ],
    image: "/img/creatine-fruit-fusion.webp",
    accent: "#E9A23B",
    price: 799,
    mrp: 999,
    sort: 3,
    supply_days: null,
  },
];
const CATALOG_VERSION = 5;

/** Create tables, import legacy SQLite data once, seed the catalogue. Safe with several app replicas. */
async function init() {
  const c = await pool.connect();
  try {
    await c.query("SELECT pg_advisory_lock(726101)"); // one replica initialises at a time
    await c.query(SCHEMA);
    await importFromSqlite(c);

    const empty = Number((await c.query("SELECT COUNT(*) AS n FROM products")).rows[0].n) === 0;
    for (const p of SEED) {
      await c.query(
        `INSERT INTO products (id, name, short_name, subtitle, description, flavors, image, accent, price, mrp, sort, supply_days)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12) ON CONFLICT (id) DO NOTHING`,
        [p.id, p.name, p.short_name, p.subtitle, p.description, JSON.stringify(p.flavors), p.image, p.accent, p.price, p.mrp, p.sort, p.supply_days]
      );
    }
    await c.query("INSERT INTO settings (key, value) VALUES ('shipping_fee', '0') ON CONFLICT (key) DO NOTHING");
    if (empty) await c.query(`INSERT INTO settings (key, value) VALUES ('catalog_version', '${CATALOG_VERSION}') ON CONFLICT (key) DO NOTHING`);
    await upgradeCatalogue(c);
  } finally {
    await c.query("SELECT pg_advisory_unlock(726101)").catch(() => {});
    c.release();
  }
}

// One-time catalogue updates for databases carried over from older versions (same steps as the SQLite era).
async function upgradeCatalogue(c) {
  const ver = async () => Number(((await c.query("SELECT value FROM settings WHERE key = 'catalog_version'")).rows[0] || {}).value || 0);
  const setVer = (v) => c.query("INSERT INTO settings (key, value) VALUES ('catalog_version', $1) ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value", [String(v)]);
  if ((await ver()) < 2) {
    for (const p of SEED) {
      await c.query("UPDATE products SET price = $1, mrp = $2, flavors = $3, subtitle = $4, description = $5 WHERE id = $6",
        [p.price, p.mrp, JSON.stringify(p.flavors), p.subtitle, p.description, p.id]);
    }
    await setVer(2);
    console.log("[og] catalogue updated to v2");
  }
  if ((await ver()) < 3) {
    const cr = SEED.find((p) => p.id === "og-creatine");
    await c.query("UPDATE products SET flavors = $1, image = $2, description = $3 WHERE id = $4", [JSON.stringify(cr.flavors), cr.image, cr.description, cr.id]);
    await setVer(3);
    console.log("[og] catalogue updated to v3");
  }
  if ((await ver()) < 5) {
    const w = SEED.find((p) => p.id === "og-whey");
    await c.query("UPDATE products SET description = $1 WHERE id = $2", [w.description, w.id]);
    await setVer(5);
    console.log("[og] catalogue updated to v5");
  }
}

const ready = init();
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
  supplyDays: r.supply_days,
});

async function listProducts({ includeInactive = false } = {}) {
  const rows = await all(`SELECT * FROM products ${includeInactive ? "" : "WHERE active = 1"} ORDER BY sort`);
  return rows.map(rowToProduct);
}
async function getProduct(id) {
  const r = await one("SELECT * FROM products WHERE id = $1", [id]);
  return r ? rowToProduct(r) : null;
}
async function updateProduct(id, { price, mrp, stock, inStock, active, supplyDays }) {
  await q("UPDATE products SET price = $1, mrp = $2, stock = $3, in_stock = $4, active = $5, supply_days = $6 WHERE id = $7",
    [price, mrp, stock, inStock ? 1 : 0, active ? 1 : 0, supplyDays, id]);
  return getProduct(id);
}

// ---- Settings ----
async function getSetting(key, fallback) {
  const r = await one("SELECT value FROM settings WHERE key = $1", [key]);
  return r ? r.value : fallback;
}
async function setSetting(key, value) {
  await q("INSERT INTO settings (key, value) VALUES ($1, $2) ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value", [key, String(value)]);
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

async function createOrder(o) {
  const ts = now();
  await q(`
    INSERT INTO orders (id, created_at, updated_at, status, name, phone, email, address1, address2, city, state, pincode,
                        items, subtotal, shipping, total, payment_provider, history)
    VALUES ($1, $2, $3, 'pending_payment', $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17)`, [
    o.id, ts, ts, o.customer.name, o.customer.phone, o.customer.email, o.customer.address1, o.customer.address2 || null,
    o.customer.city, o.customer.state, o.customer.pincode, JSON.stringify(o.items), o.subtotal, o.shipping, o.total,
    o.paymentProvider, JSON.stringify([{ at: ts, status: "pending_payment", by: "customer" }]),
  ]);
  return getOrder(o.id);
}
async function getOrder(id, client = pool) {
  return rowToOrder((await client.query("SELECT * FROM orders WHERE id = $1", [id])).rows[0]);
}
async function getOrderByGatewayId(gid) {
  return rowToOrder(await one("SELECT * FROM orders WHERE gateway_order_id = $1", [gid]));
}
async function setGatewayOrderId(id, gid) {
  await q("UPDATE orders SET gateway_order_id = $1, updated_at = $2 WHERE id = $3", [gid, now(), id]);
}

function pushHistory(order, status, by, extra) {
  const h = order.history.concat([{ at: now(), status, by, ...(extra || {}) }]);
  return JSON.stringify(h.slice(-50));
}

/** Idempotently mark an order paid and decrement tracked stock. Returns the order. */
async function markPaid(id, paymentId, by = "payment") {
  await tx(async (c) => {
    const r = (await c.query("SELECT * FROM orders WHERE id = $1 FOR UPDATE", [id])).rows[0];
    const order = rowToOrder(r);
    if (!order || (order.status !== "pending_payment" && order.status !== "verifying")) return;
    const ts = now();
    await c.query("UPDATE orders SET status = 'paid', payment_id = $1, paid_at = $2, updated_at = $3, history = $4 WHERE id = $5",
      [paymentId, ts, ts, pushHistory(order, "paid", by), id]);
    for (const it of order.items) {
      await c.query("UPDATE products SET stock = GREATEST(stock - $1, 0) WHERE id = $2 AND stock IS NOT NULL", [it.qty, it.productId]);
    }
  });
  return getOrder(id);
}

async function updateOrderAdmin(id, { status, tracking, adminNote }) {
  const found = await tx(async (c) => {
    const order = rowToOrder((await c.query("SELECT * FROM orders WHERE id = $1 FOR UPDATE", [id])).rows[0]);
    if (!order) return false;
    // A UPI reference the admin could not find is released (kept in history) so the customer can submit the right one.
    const rejectingUpi = order.status === "verifying" && status === "pending_payment";
    const history = status && status !== order.status
      ? pushHistory(order, status, "admin", rejectingUpi && order.paymentId ? { note: "UPI payment not found", ref: order.paymentId } : undefined)
      : JSON.stringify(order.history);
    await c.query("UPDATE orders SET status = $1, tracking = $2, admin_note = $3, updated_at = $4, history = $5, payment_id = $6 WHERE id = $7", [
      status || order.status,
      tracking !== undefined ? tracking : order.tracking,
      adminNote !== undefined ? adminNote : order.adminNote,
      now(),
      history,
      rejectingUpi ? null : order.paymentId,
      id,
    ]);
    return true;
  });
  return found ? getOrder(id) : null;
}

/**
 * Customer submits the UPI reference (UTR) after paying by QR / UPI ID. Moves the order to 'verifying'
 * until the admin confirms the money arrived. Returns { order } or { error: "state" | "duplicate" }.
 */
// Lock the order row and the UTR (transaction-scoped advisory lock) so two requests can never
// attach the same UTR to different orders, or confirm the same order twice.
async function lockUpi(c, id, utr) {
  const order = rowToOrder((await c.query("SELECT * FROM orders WHERE id = $1 FOR UPDATE", [id])).rows[0]);
  if (!order) return { error: "missing" };
  if (order.status !== "pending_payment" && order.status !== "verifying") return { error: "state", status: order.status };
  await c.query("SELECT pg_advisory_xact_lock(726102, hashtext($1))", [utr]);
  const dup = (await c.query(
    "SELECT id FROM orders WHERE payment_id = $1 AND id <> $2 AND status NOT IN ('pending_payment','cancelled') LIMIT 1", [utr, id])).rows[0];
  if (dup) return { error: "duplicate" };
  return { order };
}

async function submitUpiPayment(id, utr) {
  const out = await tx(async (c) => {
    const { order, error, status } = await lockUpi(c, id, utr);
    if (error) return { error, status };
    const history = order.status === "verifying" && order.paymentId === utr
      ? JSON.stringify(order.history)
      : pushHistory(order, "verifying", "customer", { ref: utr });
    await c.query("UPDATE orders SET status = 'verifying', payment_id = $1, updated_at = $2, history = $3 WHERE id = $4", [utr, now(), history, id]);
    return { ok: true };
  });
  return out.ok ? { order: await getOrder(id) } : out;
}

/** Admin confirms a UPI payment arrived: atomically records the UTR, marks paid and decrements stock. */
async function confirmUpiPayment(id, utr, by) {
  const out = await tx(async (c) => {
    const { order, error, status } = await lockUpi(c, id, utr);
    if (error) return { error, status };
    const ts = now();
    await c.query("UPDATE orders SET status = 'paid', payment_id = $1, paid_at = $2, updated_at = $3, history = $4 WHERE id = $5",
      [utr, ts, ts, pushHistory(order, "paid", by, { ref: utr }), id]);
    for (const it of order.items) {
      await c.query("UPDATE products SET stock = GREATEST(stock - $1, 0) WHERE id = $2 AND stock IS NOT NULL", [it.qty, it.productId]);
    }
    return { ok: true };
  });
  return out.ok ? { order: await getOrder(id) } : out;
}

async function listOrders({ status, q: search, limit = 200, offset = 0 } = {}) {
  const where = [];
  const args = [];
  const arg = (v) => (args.push(v), "$" + args.length);
  if (status && status !== "all") {
    if (status === "open") where.push("status IN ('verifying','paid','packed','shipped')");
    else where.push(`status = ${arg(status)}`);
  }
  if (search) {
    const like = arg(`%${search.replace(/[\\%_]/g, "\\$&")}%`);
    where.push(`(id ILIKE ${like} OR name ILIKE ${like} OR phone ILIKE ${like} OR email ILIKE ${like} OR pincode ILIKE ${like} OR city ILIKE ${like} OR payment_id ILIKE ${like})`);
  }
  const sql = `SELECT * FROM orders ${where.length ? "WHERE " + where.join(" AND ") : ""} ORDER BY created_at DESC LIMIT ${arg(limit)} OFFSET ${arg(offset)}`;
  return (await all(sql, args)).map(rowToOrder);
}

// ---- Reorder reminders ----
// A box lasts (qty × product supply_days) days from delivery (or payment, if not yet marked delivered).
// A reminder is due from `leadDays` before it runs out (day 25 of 28) until it is sent or skipped,
// and drops off if the customer has since placed another order for a reminder product.
const DAY = 864e5;
const REMINDER_LEAD_DAYS = 3;
const REMINDER_UPCOMING_DAYS = 7;
const REMINDER_MAX_OVERDUE_DAYS = 30;
const PAID = "('paid','packed','shipped','delivered')";

async function reorderReminders(at = Date.now()) {
  const supply = Object.fromEntries((await all("SELECT id, supply_days FROM products")).map((r) => [r.id, r.supply_days]));
  const rows = await all(`
    SELECT o.*, r.status AS r_status, r.at AS r_at, r.message AS r_message
    FROM orders o LEFT JOIN reminders r ON r.order_id = o.id
    WHERE o.status IN ${PAID} ORDER BY o.created_at`);

  const cards = [];
  const latestByPhone = {};
  for (const r of rows) {
    const o = rowToOrder(r);
    const lines = o.items.filter((i) => supply[i.productId] > 0);
    if (!lines.length) continue;
    const totalDays = lines.reduce((s, i) => s + i.qty * supply[i.productId], 0);
    const delivered = o.history.find((h) => h.status === "delivered");
    const start = (delivered && delivered.at) || o.paidAt || o.createdAt;
    const runOut = Date.parse(start) + totalDays * DAY;
    const card = {
      orderId: o.id,
      name: o.customer.name,
      phone: o.customer.phone,
      city: o.customer.city,
      items: lines.map((i) => ({ name: i.name, flavor: i.flavor, qty: i.qty })),
      startedAt: start,
      startedFrom: delivered ? "delivery" : "payment",
      totalDays,
      daysUsed: Math.max(0, Math.floor((at - Date.parse(start)) / DAY)),
      daysLeft: Math.ceil((runOut - at) / DAY),
      runOutAt: new Date(runOut).toISOString(),
      dueAt: new Date(runOut - REMINDER_LEAD_DAYS * DAY).toISOString(),
      reminder: r.r_status ? { status: r.r_status, at: r.r_at, message: r.r_message } : null,
      createdAt: o.createdAt,
    };
    cards.push(card);
    latestByPhone[o.customer.phone] = card.orderId; // rows are oldest → newest
  }

  const due = [], upcoming = [], done = [];
  for (const c of cards) {
    if (c.reminder) {
      if (at - Date.parse(c.reminder.at) < 30 * DAY) done.push(c);
      continue;
    }
    if (latestByPhone[c.phone] !== c.orderId) continue; // already reordered
    const dueIn = Date.parse(c.dueAt) - at;
    if (dueIn <= 0 && c.daysLeft >= -REMINDER_MAX_OVERDUE_DAYS) due.push(c);
    else if (dueIn > 0 && dueIn <= REMINDER_UPCOMING_DAYS * DAY) upcoming.push(c);
  }
  due.sort((a, b) => a.daysLeft - b.daysLeft);
  upcoming.sort((a, b) => Date.parse(a.dueAt) - Date.parse(b.dueAt));
  done.sort((a, b) => Date.parse(b.reminder.at) - Date.parse(a.reminder.at));
  return { leadDays: REMINDER_LEAD_DAYS, due, upcoming, done };
}

async function setReminder(orderId, status, message) {
  if (status === "reset") await q("DELETE FROM reminders WHERE order_id = $1", [orderId]);
  else await q(`INSERT INTO reminders (order_id, status, at, message) VALUES ($1, $2, $3, $4)
    ON CONFLICT (order_id) DO UPDATE SET status = EXCLUDED.status, at = EXCLUDED.at, message = EXCLUDED.message`,
    [orderId, status, now(), message || null]);
}

// ---- Demo orders (ids contain "-DEMO") ----
async function countDemoOrders() {
  return Number((await one("SELECT COUNT(*) AS n FROM orders WHERE id LIKE '%-DEMO%'")).n);
}
async function insertDemoOrders(orders) {
  return tx(async (c) => {
    await clearDemoOrders(c);
    for (const o of orders) {
      const cu = o.customer;
      await c.query(`
        INSERT INTO orders (id, created_at, updated_at, status, name, phone, email, address1, address2, city, state, pincode,
          items, subtotal, shipping, total, payment_provider, payment_id, paid_at, tracking, admin_note, history)
        VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21,$22)`, [
        o.id, o.createdAt, o.updatedAt, o.status, cu.name, cu.phone, cu.email, cu.address1, cu.address2, cu.city, cu.state, cu.pincode,
        JSON.stringify(o.items), o.subtotal, o.shipping, o.total, o.paymentProvider, o.paymentId, o.paidAt, o.tracking, o.adminNote, JSON.stringify(o.history),
      ]);
      if (o.reminder) await c.query("INSERT INTO reminders (order_id, status, at, message) VALUES ($1, $2, $3, $4)", [o.id, o.reminder.status, o.reminder.at, o.reminder.message]);
    }
    return orders.length;
  });
}
async function clearDemoOrders(client = pool) {
  await client.query("DELETE FROM reminders WHERE order_id LIKE '%-DEMO%'");
  return (await client.query("DELETE FROM orders WHERE id LIKE '%-DEMO%'")).rowCount;
}

// ---- Analytics ----
function istDay(d = new Date()) {
  return new Date(d.getTime() + 330 * 60000).toISOString().slice(0, 10);
}

async function trackEvent(sid, type) {
  await q("INSERT INTO events (day, sid, type) VALUES ($1, $2, $3) ON CONFLICT DO NOTHING", [istDay(), sid, type]);
}

// IST calendar day of an order, as 'YYYY-MM-DD'.
const DAY_EXPR = "to_char((created_at::timestamptz AT TIME ZONE 'Asia/Kolkata'), 'YYYY-MM-DD')";

async function stats(days) {
  const since = days ? istDay(new Date(Date.now() - (days - 1) * 86400000)) : "0000-00-00";
  const [k, funnelRows, daily, visitsDaily, byState, paidOrders, queue] = await Promise.all([
    one(`
      SELECT
        COALESCE(SUM(CASE WHEN status IN ${PAID} THEN total END), 0)::int  AS revenue,
        COUNT(*) FILTER (WHERE status IN ${PAID})::int                     AS paid,
        COUNT(*) FILTER (WHERE status = 'pending_payment')::int            AS pending,
        COUNT(*) FILTER (WHERE status = 'verifying')::int                  AS verifying,
        COUNT(*) FILTER (WHERE status IN ('cancelled','refunded'))::int    AS cancelled,
        COUNT(*)::int AS created
      FROM orders WHERE ${DAY_EXPR} >= $1`, [since]),
    all("SELECT type, COUNT(DISTINCT sid)::int AS n FROM events WHERE day >= $1 GROUP BY type", [since]),
    all(`
      SELECT ${DAY_EXPR} AS day,
        COALESCE(SUM(CASE WHEN status IN ${PAID} THEN total END), 0)::int AS revenue,
        COUNT(*) FILTER (WHERE status IN ${PAID})::int AS orders
      FROM orders WHERE ${DAY_EXPR} >= $1 GROUP BY 1 ORDER BY 1`, [since]),
    all("SELECT day, COUNT(DISTINCT sid)::int AS n FROM events WHERE type = 'visit' AND day >= $1 GROUP BY day ORDER BY day", [since]),
    all(`
      SELECT state, COUNT(*)::int AS orders, SUM(total)::int AS revenue FROM orders
      WHERE status IN ${PAID} AND ${DAY_EXPR} >= $1 GROUP BY state ORDER BY revenue DESC, state`, [since]),
    all(`SELECT items FROM orders WHERE status IN ${PAID} AND ${DAY_EXPR} >= $1 ORDER BY created_at`, [since]),
    all("SELECT status, COUNT(*)::int AS n FROM orders WHERE status IN ('verifying','paid','packed','shipped') GROUP BY status"),
  ]);
  const f = Object.fromEntries(funnelRows.map((r) => [r.type, r.n]));

  const mix = {};
  for (const r of paidOrders) {
    for (const it of JSON.parse(r.items)) {
      const key = `${it.name} — ${it.flavor}`;
      mix[key] = mix[key] || { label: key, productId: it.productId, units: 0, revenue: 0 };
      mix[key].units += it.qty;
      mix[key].revenue += it.qty * it.price;
    }
  }

  return {
    since,
    revenue: k.revenue,
    paidOrders: k.paid,
    pendingPayments: k.pending,
    verifyingPayments: k.verifying,
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

/** Cheap connectivity check for /health. */
async function ping() {
  await q("SELECT 1");
}

module.exports = {
  DB_LABEL, ready, ping, pool,
  listProducts, getProduct, updateProduct,
  getSetting, setSetting,
  createOrder, getOrder, getOrderByGatewayId, setGatewayOrderId, markPaid, submitUpiPayment, confirmUpiPayment, updateOrderAdmin, listOrders,
  trackEvent, stats, istDay,
  reorderReminders, setReminder,
  countDemoOrders, insertDemoOrders, clearDemoOrders,
};

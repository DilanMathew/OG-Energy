// One-time import of the old SQLite database (og.sqlite on the Railway volume) into Postgres.
// Runs at startup only when Postgres has no orders and no products yet and the import has not
// already happened. Everything is copied in one transaction and the row counts are checked before
// committing, so it either copies everything or nothing. The SQLite file is opened read-only.
const fs = require("fs");
const path = require("path");

const TABLES = ["products", "settings", "orders", "reminders", "events"]; // parents before children
const BATCH = 500;

function sqlitePath() {
  const dir = process.env.DATA_DIR || process.env.RAILWAY_VOLUME_MOUNT_PATH || path.join(__dirname, "..", "data");
  return path.join(dir, "og.sqlite");
}

async function importFromSqlite(c) {
  const done = (await c.query("SELECT value FROM settings WHERE key = 'imported_from_sqlite'")).rows[0];
  if (done) return;
  const file = sqlitePath();
  if (!fs.existsSync(file)) return;
  const counts = (await c.query("SELECT (SELECT COUNT(*) FROM orders) AS o, (SELECT COUNT(*) FROM products) AS p")).rows[0];
  if (Number(counts.o) > 0 || Number(counts.p) > 0) {
    console.warn(`[og] found ${file} but Postgres already has data — skipping SQLite import.`);
    return;
  }

  const { DatabaseSync } = require("node:sqlite");
  const src = new DatabaseSync(file, { readOnly: true });
  const summary = {};
  try {
    await c.query("BEGIN");
    for (const table of TABLES) {
      const exists = src.prepare("SELECT 1 FROM sqlite_master WHERE type = 'table' AND name = ?").get(table);
      if (!exists) { summary[table] = 0; continue; }
      const pgCols = new Set((await c.query(
        "SELECT column_name FROM information_schema.columns WHERE table_schema = current_schema() AND table_name = $1", [table])).rows.map((r) => r.column_name));
      const cols = src.prepare(`PRAGMA table_info(${table})`).all().map((r) => r.name).filter((n) => pgCols.has(n));
      const rows = src.prepare(`SELECT ${cols.join(", ")} FROM ${table}`).all();
      if (table === "settings") await c.query("DELETE FROM settings"); // the SQLite copy is the source of truth
      for (let i = 0; i < rows.length; i += BATCH) {
        const chunk = rows.slice(i, i + BATCH);
        const args = [];
        const tuples = chunk.map((r) => "(" + cols.map((col) => (args.push(r[col] === undefined ? null : r[col]), "$" + args.length)).join(", ") + ")");
        await c.query(`INSERT INTO ${table} (${cols.join(", ")}) VALUES ${tuples.join(", ")}`, args);
      }
      const copied = Number((await c.query(`SELECT COUNT(*) AS n FROM ${table}`)).rows[0].n);
      if (copied !== rows.length) throw new Error(`${table}: copied ${copied} rows, expected ${rows.length}`);
      summary[table] = copied;
    }
    // Revenue cross-check: the money totals must match exactly.
    const srcTotal = src.prepare("SELECT COALESCE(SUM(total), 0) AS t FROM orders").get().t;
    const pgTotal = Number((await c.query("SELECT COALESCE(SUM(total), 0) AS t FROM orders")).rows[0].t);
    if (Number(srcTotal) !== pgTotal) throw new Error(`order totals differ: SQLite ${srcTotal}, Postgres ${pgTotal}`);

    await c.query("INSERT INTO settings (key, value) VALUES ('imported_from_sqlite', $1)",
      [JSON.stringify({ at: new Date().toISOString(), file, rows: summary })]);
    await c.query("COMMIT");
    console.log("[og] imported SQLite data into Postgres:", JSON.stringify(summary));
  } catch (e) {
    await c.query("ROLLBACK").catch(() => {});
    console.error("[og] SQLite import FAILED, nothing was changed:", e.message);
    throw e; // refuse to start rather than run on a half-empty database
  } finally {
    src.close();
  }
}

module.exports = { importFromSqlite };

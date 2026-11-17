import { createClient, type Client, type InValue } from "@libsql/client";
import bcrypt from "bcryptjs";
import { SEED_EXPERIENCES, SEED_PARTNERS } from "./seed";

const g = globalThis as unknown as { __rnrClient?: Client; __rnrReady?: Promise<void> };

function client(): Client {
  if (!g.__rnrClient) {
    const url = (process.env.DATABASE_URL ?? "").trim() || "file:./dev.db";
    const authToken = (process.env.DATABASE_AUTH_TOKEN ?? "").trim() || undefined;
    g.__rnrClient = createClient({ url, authToken });
  }
  return g.__rnrClient;
}

export type Row = Record<string, unknown>;
export type Args = InValue[];

const SCHEMA = [
  `CREATE TABLE IF NOT EXISTS settings (key TEXT PRIMARY KEY, value TEXT NOT NULL)`,
  `CREATE TABLE IF NOT EXISTS users (id INTEGER PRIMARY KEY AUTOINCREMENT, email TEXT NOT NULL UNIQUE, name TEXT NOT NULL, hash TEXT NOT NULL, role TEXT NOT NULL DEFAULT 'OWNER', created_at INTEGER NOT NULL)`,
  `CREATE TABLE IF NOT EXISTS partners (id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT NOT NULL, role TEXT NOT NULL DEFAULT '', phone TEXT NOT NULL DEFAULT '', notes TEXT NOT NULL DEFAULT '', active INTEGER NOT NULL DEFAULT 1)`,
  `CREATE TABLE IF NOT EXISTS experiences (id INTEGER PRIMARY KEY AUTOINCREMENT, slug TEXT NOT NULL UNIQUE, title TEXT NOT NULL, category TEXT NOT NULL DEFAULT 'nile', summary TEXT NOT NULL DEFAULT '', description TEXT NOT NULL DEFAULT '', duration TEXT NOT NULL DEFAULT '', time_hint TEXT NOT NULL DEFAULT '', price_usd REAL NOT NULL DEFAULT 0, cost_usd REAL NOT NULL DEFAULT 0, unit TEXT NOT NULL DEFAULT 'PERSON', partner_id INTEGER, image TEXT NOT NULL DEFAULT '', sort INTEGER NOT NULL DEFAULT 0, active INTEGER NOT NULL DEFAULT 1)`,
  `CREATE TABLE IF NOT EXISTS bookings (id INTEGER PRIMARY KEY AUTOINCREMENT, ref TEXT NOT NULL UNIQUE, token TEXT NOT NULL UNIQUE, status TEXT NOT NULL, source TEXT NOT NULL DEFAULT 'WEBSITE',
    check_in TEXT NOT NULL, check_out TEXT NOT NULL, guests INTEGER NOT NULL, name TEXT NOT NULL, email TEXT NOT NULL DEFAULT '', phone TEXT NOT NULL DEFAULT '', country TEXT NOT NULL DEFAULT '',
    arrival TEXT NOT NULL DEFAULT '', notes TEXT NOT NULL DEFAULT '', nightly_usd REAL NOT NULL, nights INTEGER NOT NULL, stay_usd REAL NOT NULL, cleaning_usd REAL NOT NULL DEFAULT 0, extras_usd REAL NOT NULL DEFAULT 0,
    total_usd REAL NOT NULL, deposit_usd REAL NOT NULL, pay_method TEXT NOT NULL DEFAULT 'TRANSFER', currency TEXT NOT NULL DEFAULT 'USD', hold_until INTEGER, staff_notes TEXT NOT NULL DEFAULT '',
    seen INTEGER NOT NULL DEFAULT 0, ip TEXT NOT NULL DEFAULT '', created_at INTEGER NOT NULL, updated_at INTEGER NOT NULL)`,
  `CREATE INDEX IF NOT EXISTS bookings_dates ON bookings (check_in, check_out)`,
  `CREATE TABLE IF NOT EXISTS booking_items (id INTEGER PRIMARY KEY AUTOINCREMENT, booking_id INTEGER NOT NULL, experience_id INTEGER, title TEXT NOT NULL, date TEXT NOT NULL, time TEXT NOT NULL DEFAULT '',
    qty INTEGER NOT NULL DEFAULT 1, unit TEXT NOT NULL DEFAULT 'PERSON', price_usd REAL NOT NULL, line_usd REAL NOT NULL, cost_usd REAL NOT NULL DEFAULT 0, partner_id INTEGER, status TEXT NOT NULL DEFAULT 'TO_ARRANGE', note TEXT NOT NULL DEFAULT '')`,
  `CREATE INDEX IF NOT EXISTS items_booking ON booking_items (booking_id)`,
  `CREATE TABLE IF NOT EXISTS payments (id INTEGER PRIMARY KEY AUTOINCREMENT, booking_id INTEGER NOT NULL, amount_usd REAL NOT NULL DEFAULT 0, method TEXT NOT NULL, status TEXT NOT NULL DEFAULT 'PENDING',
    receipt_id INTEGER, note TEXT NOT NULL DEFAULT '', created_at INTEGER NOT NULL)`,
  `CREATE INDEX IF NOT EXISTS payments_booking ON payments (booking_id)`,
  `CREATE TABLE IF NOT EXISTS receipts (id INTEGER PRIMARY KEY AUTOINCREMENT, booking_id INTEGER NOT NULL, mime TEXT NOT NULL, data TEXT NOT NULL, size INTEGER NOT NULL, created_at INTEGER NOT NULL)`,
  `CREATE TABLE IF NOT EXISTS blocks (id INTEGER PRIMARY KEY AUTOINCREMENT, date_from TEXT NOT NULL, date_to TEXT NOT NULL, reason TEXT NOT NULL DEFAULT '', created_at INTEGER NOT NULL)`,
  `CREATE TABLE IF NOT EXISTS events (id INTEGER PRIMARY KEY AUTOINCREMENT, booking_id INTEGER NOT NULL, text TEXT NOT NULL, created_at INTEGER NOT NULL)`,
  `CREATE INDEX IF NOT EXISTS events_booking ON events (booking_id)`,
  `CREATE TABLE IF NOT EXISTS hits (key TEXT NOT NULL, at INTEGER NOT NULL)`,
  `CREATE INDEX IF NOT EXISTS hits_key ON hits (key, at)`,
];

async function setup() {
  const c = client();
  await c.batch(SCHEMA, "write");
  // First run: add the starting experiences and partners (the owner edits them in the admin).
  const n = await c.execute("SELECT COUNT(*) AS n FROM experiences");
  if (Number(n.rows[0]?.n ?? 0) === 0) {
    const ids: number[] = [];
    for (const p of SEED_PARTNERS) {
      const r = await c.execute({ sql: "INSERT INTO partners (name, role, phone, notes) VALUES (?, ?, ?, ?)", args: [p.name, p.role, p.phone, p.notes] });
      ids.push(Number(r.lastInsertRowid));
    }
    for (const [i, e] of SEED_EXPERIENCES.entries()) {
      await c.execute({ sql: `INSERT OR IGNORE INTO experiences (slug, title, category, summary, description, duration, time_hint, price_usd, cost_usd, unit, partner_id, image, sort) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)`,
        args: [e.slug, e.title, e.category, e.summary, e.description, e.duration, e.timeHint, e.priceUsd, e.costUsd, e.unit, e.partner != null ? ids[e.partner] ?? null : null, e.image, i] });
    }
  }
  // The owner login comes from ADMIN_EMAIL / ADMIN_PASSWORD and is kept in step on every start.
  const email = (process.env.ADMIN_EMAIL ?? "").trim().toLowerCase();
  const pass = process.env.ADMIN_PASSWORD ?? "";
  if (email && pass.length >= 10) {
    const u = await c.execute({ sql: "SELECT id, hash FROM users WHERE email = ?", args: [email] });
    if (!u.rows.length) {
      await c.execute({ sql: "INSERT INTO users (email, name, hash, role, created_at) VALUES (?, ?, ?, 'OWNER', ?)", args: [email, "Owner", await bcrypt.hash(pass, 10), Date.now()] });
    } else if (!(await bcrypt.compare(pass, String(u.rows[0].hash)))) {
      await c.execute({ sql: "UPDATE users SET hash = ?, role = 'OWNER' WHERE id = ?", args: [await bcrypt.hash(pass, 10), Number(u.rows[0].id)] });
    }
  }
}

export function ready(): Promise<void> {
  if (!g.__rnrReady) g.__rnrReady = setup().catch((e) => { g.__rnrReady = undefined; throw e; });
  return g.__rnrReady;
}

function plain(rs: { columns: string[]; rows: ArrayLike<unknown>[] }): Row[] {
  return rs.rows.map((r) => Object.fromEntries(rs.columns.map((c, i) => [c, r[i] as unknown])));
}

export async function all<T = Row>(sql: string, args: Args = []): Promise<T[]> {
  await ready();
  return plain(await client().execute({ sql, args })) as T[];
}
export async function one<T = Row>(sql: string, args: Args = []): Promise<T | null> {
  return (await all<T>(sql, args))[0] ?? null;
}
export async function run(sql: string, args: Args = []): Promise<{ id: number; changes: number }> {
  await ready();
  const r = await client().execute({ sql, args });
  return { id: Number(r.lastInsertRowid ?? 0), changes: r.rowsAffected };
}
/** Several writes that must all happen or none (e.g. a booking and its items). */
export async function tx(stmts: { sql: string; args?: Args }[]): Promise<void> {
  await ready();
  await client().batch(stmts.map((s) => ({ sql: s.sql, args: s.args ?? [] })), "write");
}

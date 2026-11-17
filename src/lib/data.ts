// Reading and writing the residence's data. Server-only.
import { randomBytes, randomInt } from "node:crypto";
import { all, one, run, tx } from "./db";
import { getSettings, type Settings } from "./settings";
import { quote, stayProblems, type ExtraIn, type ExperiencePrice, type Unit } from "./pricing.ts";
import { takenNights, isFree, type StayRow } from "./availability.ts";
import { isISODate, todayInEgypt, eachDay, addDays, nightsBetween } from "./dates.ts";
import { isCurrency } from "./money.ts";

export type Experience = { id: number; slug: string; title: string; category: string; summary: string; description: string; duration: string; timeHint: string; priceUsd: number; costUsd: number; unit: Unit; partnerId: number | null; image: string; sort: number; active: boolean };
export type Partner = { id: number; name: string; role: string; phone: string; notes: string; active: boolean };
export type Booking = { id: number; ref: string; token: string; status: string; source: string; checkIn: string; checkOut: string; guests: number; name: string; email: string; phone: string; country: string; arrival: string; notes: string;
  nightlyUsd: number; nights: number; stayUsd: number; cleaningUsd: number; extrasUsd: number; totalUsd: number; depositUsd: number; payMethod: string; currency: string; holdUntil: number | null; staffNotes: string; seen: boolean; partnerRef: string; createdAt: number; updatedAt: number };
export type Item = { id: number; bookingId: number; experienceId: number | null; title: string; date: string; time: string; qty: number; unit: Unit; priceUsd: number; lineUsd: number; costUsd: number; partnerId: number | null; status: string; note: string };
export type Payment = { id: number; bookingId: number; amountUsd: number; method: string; status: string; receiptId: number | null; note: string; createdAt: number };

export const STATUS_LABEL: Record<string, string> = {
  REQUEST: "Talking on WhatsApp", AWAITING_DEPOSIT: "Waiting for deposit", RECEIPT_SENT: "Receipt sent — check it", CONFIRMED: "Confirmed",
  CHECKED_IN: "Checked in", COMPLETED: "Completed", CANCELLED: "Cancelled",
};
export const SOURCE_LABEL: Record<string, string> = { WEBSITE: "Website", EGYPT_KNIGHT: "Egypt Knight Tours", WHATSAPP: "WhatsApp", PHONE: "Phone", AGENCY: "Agency", BOOKING_COM: "Booking.com", AIRBNB: "Airbnb", OTHER: "Other" };
export const sourceLabel = (s: string) => SOURCE_LABEL[s] ?? s;
export const SOURCES = ["WEBSITE", "EGYPT_KNIGHT", "WHATSAPP", "PHONE", "AGENCY", "BOOKING_COM", "AIRBNB", "OTHER"] as const;

const n = (v: unknown) => Number(v ?? 0);
const s = (v: unknown) => (v == null ? "" : String(v));

function toExperience(r: Record<string, unknown>): Experience {
  return { id: n(r.id), slug: s(r.slug), title: s(r.title), category: s(r.category), summary: s(r.summary), description: s(r.description), duration: s(r.duration), timeHint: s(r.time_hint),
    priceUsd: n(r.price_usd), costUsd: n(r.cost_usd), unit: s(r.unit) === "GROUP" ? "GROUP" : "PERSON", partnerId: r.partner_id == null ? null : n(r.partner_id), image: s(r.image), sort: n(r.sort), active: n(r.active) === 1 };
}
export function toBooking(r: Record<string, unknown>): Booking {
  return { id: n(r.id), ref: s(r.ref), token: s(r.token), status: s(r.status), source: s(r.source), checkIn: s(r.check_in), checkOut: s(r.check_out), guests: n(r.guests), name: s(r.name), email: s(r.email), phone: s(r.phone),
    country: s(r.country), arrival: s(r.arrival), notes: s(r.notes), nightlyUsd: n(r.nightly_usd), nights: n(r.nights), stayUsd: n(r.stay_usd), cleaningUsd: n(r.cleaning_usd), extrasUsd: n(r.extras_usd), totalUsd: n(r.total_usd),
    depositUsd: n(r.deposit_usd), payMethod: s(r.pay_method), currency: s(r.currency), holdUntil: r.hold_until == null ? null : n(r.hold_until), staffNotes: s(r.staff_notes), seen: n(r.seen) === 1, partnerRef: s(r.partner_ref), createdAt: n(r.created_at), updatedAt: n(r.updated_at) };
}
function toItem(r: Record<string, unknown>): Item {
  return { id: n(r.id), bookingId: n(r.booking_id), experienceId: r.experience_id == null ? null : n(r.experience_id), title: s(r.title), date: s(r.date), time: s(r.time), qty: n(r.qty), unit: s(r.unit) === "GROUP" ? "GROUP" : "PERSON",
    priceUsd: n(r.price_usd), lineUsd: n(r.line_usd), costUsd: n(r.cost_usd), partnerId: r.partner_id == null ? null : n(r.partner_id), status: s(r.status), note: s(r.note) };
}
function toPayment(r: Record<string, unknown>): Payment {
  return { id: n(r.id), bookingId: n(r.booking_id), amountUsd: n(r.amount_usd), method: s(r.method), status: s(r.status), receiptId: r.receipt_id == null ? null : n(r.receipt_id), note: s(r.note), createdAt: n(r.created_at) };
}

// ---------- experiences & partners ----------
export async function listExperiences(activeOnly = true): Promise<Experience[]> {
  const rows = await all(`SELECT * FROM experiences ${activeOnly ? "WHERE active = 1" : ""} ORDER BY sort, id`);
  return rows.map(toExperience);
}
export async function getExperience(id: number) { const r = await one("SELECT * FROM experiences WHERE id = ?", [id]); return r ? toExperience(r) : null; }
export async function listPartners(): Promise<Partner[]> {
  return (await all("SELECT * FROM partners ORDER BY active DESC, name")).map((r) => ({ id: n(r.id), name: s(r.name), role: s(r.role), phone: s(r.phone), notes: s(r.notes), active: n(r.active) === 1 }));
}
export const priceOf = (e: Experience): ExperiencePrice => ({ id: e.id, title: e.title, priceUsd: e.priceUsd, costUsd: e.costUsd, unit: e.unit, partnerId: e.partnerId, timeHint: e.timeHint });

// ---------- availability ----------
export async function loadTaken(exceptId?: number): Promise<Set<string>> {
  const today = todayInEgypt();
  const stays = (await all("SELECT id, check_in, check_out, status, hold_until FROM bookings WHERE check_out >= ?", [today]))
    .map((r): StayRow => ({ id: n(r.id), checkIn: s(r.check_in), checkOut: s(r.check_out), status: s(r.status), holdUntil: r.hold_until == null ? null : n(r.hold_until) }));
  const blocks = (await all("SELECT date_from, date_to FROM blocks WHERE date_to >= ?", [today])).map((r) => ({ from: s(r.date_from), to: s(r.date_to) }));
  return takenNights(stays, blocks, Date.now(), exceptId);
}

// ---------- creating a booking from the website ----------
export type NewBookingIn = { checkIn: string; checkOut: string; guests: number; extras: ExtraIn[]; name: string; email: string; phone: string; country: string; arrival: string; notes: string; payMethod: string; currency: string };
export type CreateResult = { ok: true; token: string; ref: string; booking: Booking } | { ok: false; error: string };

const clip = (x: unknown, max: number) => String(x ?? "").replace(/[\u0000-\u001f\u007f]/g, " ").trim().slice(0, max);

export async function newRef(): Promise<string> {
  for (let i = 0; i < 20; i++) {
    const ref = `RN-${randomInt(1000, 9999)}`;
    if (!(await one("SELECT id FROM bookings WHERE ref = ?", [ref]))) return ref;
  }
  return `RN-${Date.now().toString().slice(-6)}`;
}
export const newToken = () => randomBytes(18).toString("base64url");

export async function createWebsiteBooking(raw: NewBookingIn, ip: string): Promise<CreateResult> {
  const st = await getSettings();
  const checkIn = raw.checkIn, checkOut = raw.checkOut, guests = Math.floor(Number(raw.guests));
  if (!isISODate(checkIn) || !isISODate(checkOut)) return { ok: false, error: "Please choose your dates." };
  const problems = stayProblems({ checkIn, checkOut, guests, today: todayInEgypt(), rules: st });
  if (problems.length) return { ok: false, error: problems[0] };
  const name = clip(raw.name, 80), phone = clip(raw.phone, 30), email = clip(raw.email, 120).toLowerCase();
  if (name.length < 2) return { ok: false, error: "Please enter your full name." };
  if (phone.replace(/\D/g, "").length < 7) return { ok: false, error: "Please enter your WhatsApp number with country code." };
  if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return { ok: false, error: "That email address doesn't look right." };
  const payMethod = raw.payMethod === "WHATSAPP" ? "WHATSAPP" : "TRANSFER";
  const currency = isCurrency(raw.currency) ? raw.currency : "USD";

  const days = new Set(eachDay(checkIn, checkOut));
  const extras = (Array.isArray(raw.extras) ? raw.extras : []).slice(0, 30)
    .filter((x) => x && Number.isInteger(Number(x.experienceId)) && typeof x.date === "string" && days.has(x.date))
    .map((x) => ({ experienceId: Number(x.experienceId), date: x.date, qty: x.qty == null ? undefined : Number(x.qty) }));
  const catalog = (await listExperiences()).map(priceOf);
  const q = quote({ checkIn, checkOut, guests, extras, rules: st, catalog });

  const taken = await loadTaken();
  if (!isFree(taken, checkIn, checkOut)) return { ok: false, error: "Sorry — some of those nights were just booked. Please pick other dates." };

  const ref = await newRef(), token = newToken(), now = Date.now();
  const status = payMethod === "WHATSAPP" ? "REQUEST" : "AWAITING_DEPOSIT";
  const holdUntil = now + Math.max(1, st.holdHours) * 3600_000;
  const stmts: { sql: string; args: (string | number | null)[] }[] = [
    { sql: `INSERT INTO bookings (ref, token, status, source, check_in, check_out, guests, name, email, phone, country, arrival, notes, nightly_usd, nights, stay_usd, cleaning_usd, extras_usd, total_usd, deposit_usd, pay_method, currency, hold_until, ip, created_at, updated_at)
            VALUES (?,?,?,'WEBSITE',?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
      args: [ref, token, status, checkIn, checkOut, guests, name, email, phone, clip(raw.country, 60), clip(raw.arrival, 120), clip(raw.notes, 1000), st.nightlyUsd, q.nights, q.stayUsd, q.cleaningUsd, q.extrasUsd, q.totalUsd, q.depositUsd, payMethod, currency, holdUntil, ip.slice(0, 64), now, now] },
    ...q.lines.map((l) => ({ sql: `INSERT INTO booking_items (booking_id, experience_id, title, date, time, qty, unit, price_usd, line_usd, cost_usd, partner_id) VALUES ((SELECT id FROM bookings WHERE ref = ?),?,?,?,?,?,?,?,?,?,?)`,
      args: [ref, l.experienceId, l.title, l.date, l.time, l.qty, l.unit, l.priceUsd, l.lineUsd, l.costUsd, l.partnerId] })),
    { sql: "INSERT INTO events (booking_id, text, created_at) VALUES ((SELECT id FROM bookings WHERE ref = ?), ?, ?)", args: [ref, `Booked on the website · ${payMethod === "WHATSAPP" ? "wants to talk on WhatsApp first" : "will pay the deposit by transfer"}`, now] },
  ];
  await tx(stmts);
  const b = await getBookingByToken(token);
  if (!b) return { ok: false, error: "Something went wrong. Please try again or message us on WhatsApp." };
  return { ok: true, token, ref, booking: b };
}

// ---------- reading bookings ----------
export async function getBookingByToken(token: string): Promise<Booking | null> {
  if (!/^[A-Za-z0-9_-]{16,40}$/.test(token)) return null;
  const r = await one("SELECT * FROM bookings WHERE token = ?", [token]);
  return r ? toBooking(r) : null;
}
export async function getBooking(id: number): Promise<Booking | null> { const r = await one("SELECT * FROM bookings WHERE id = ?", [id]); return r ? toBooking(r) : null; }
export async function getItems(bookingId: number): Promise<Item[]> { return (await all("SELECT * FROM booking_items WHERE booking_id = ? ORDER BY date, time, id", [bookingId])).map(toItem); }
export async function getPayments(bookingId: number): Promise<Payment[]> { return (await all("SELECT * FROM payments WHERE booking_id = ? ORDER BY created_at DESC", [bookingId])).map(toPayment); }
export async function getEvents(bookingId: number) { return (await all("SELECT text, created_at FROM events WHERE booking_id = ? ORDER BY created_at DESC LIMIT 50", [bookingId])).map((r) => ({ text: s(r.text), at: n(r.created_at) })); }
export async function logEvent(bookingId: number, text: string) { await run("INSERT INTO events (booking_id, text, created_at) VALUES (?, ?, ?)", [bookingId, text.slice(0, 300), Date.now()]); }

export async function paidUsd(bookingId: number): Promise<number> {
  const r = await one<{ t: number }>("SELECT COALESCE(SUM(amount_usd), 0) AS t FROM payments WHERE booking_id = ? AND status = 'CONFIRMED'", [bookingId]);
  return Number(r?.t ?? 0);
}

export async function listBookings(o: { filter?: string; q?: string } = {}): Promise<(Booking & { paid: number })[]> {
  const where: string[] = []; const args: (string | number)[] = [];
  const today = todayInEgypt();
  if (o.filter === "upcoming") { where.push("check_out >= ? AND status NOT IN ('CANCELLED')"); args.push(today); }
  else if (o.filter === "action") { where.push("status IN ('REQUEST','AWAITING_DEPOSIT','RECEIPT_SENT')"); }
  else if (o.filter === "past") { where.push("check_out < ?"); args.push(today); }
  else if (o.filter === "cancelled") { where.push("status = 'CANCELLED'"); }
  if (o.q) { where.push("(name LIKE ? OR ref LIKE ? OR phone LIKE ? OR email LIKE ?)"); const l = `%${o.q.slice(0, 60)}%`; args.push(l, l, l, l); }
  const rows = await all(`SELECT b.*, (SELECT COALESCE(SUM(amount_usd),0) FROM payments p WHERE p.booking_id = b.id AND p.status = 'CONFIRMED') AS paid
    FROM bookings b ${where.length ? "WHERE " + where.join(" AND ") : ""} ORDER BY ${o.filter === "past" ? "check_in DESC" : "check_in ASC"} LIMIT 300`, args);
  return rows.map((r) => ({ ...toBooking(r), paid: n(r.paid) }));
}

/** Stays overlapping a date window (for the calendar). */
export async function bookingsBetween(from: string, to: string): Promise<Booking[]> {
  return (await all("SELECT * FROM bookings WHERE check_in < ? AND check_out > ? AND status != 'CANCELLED' ORDER BY check_in", [to, from])).map(toBooking);
}
export async function blocksBetween(from: string, to: string) {
  return (await all("SELECT * FROM blocks WHERE date_from < ? AND date_to > ? ORDER BY date_from", [to, from])).map((r) => ({ id: n(r.id), from: s(r.date_from), to: s(r.date_to), reason: s(r.reason) }));
}

/** Experiences coming up that still need arranging, soonest first. */
export async function toArrange(days = 14) {
  const today = todayInEgypt();
  const rows = await all(`SELECT i.*, b.ref, b.name AS guest, b.status AS bstatus, b.guests, b.arrival, p.name AS partner, p.phone AS partner_phone
    FROM booking_items i JOIN bookings b ON b.id = i.booking_id LEFT JOIN partners p ON p.id = i.partner_id
    WHERE i.status = 'TO_ARRANGE' AND i.date >= ? AND i.date <= ? AND b.status IN ('CONFIRMED','CHECKED_IN','RECEIPT_SENT') ORDER BY i.date, i.time`, [today, addDays(today, days)]);
  return rows.map((r) => ({ ...toItem(r), ref: s(r.ref), guest: s(r.guest), guests: n(r.guests), arrival: s(r.arrival), bstatus: s(r.bstatus), partner: s(r.partner), partnerPhone: s(r.partner_phone) }));
}

// ---------- bookings made by Egypt Knight Tours through the private link ----------
export type PartnerBookingIn = { checkIn: string; checkOut: string; guests: number; name: string; phone: string; email: string; notes: string; partnerRef: string; staffName: string };

export async function createPartnerBooking(raw: PartnerBookingIn): Promise<CreateResult> {
  const st = await getSettings();
  const checkIn = String(raw.checkIn ?? ""), checkOut = String(raw.checkOut ?? ""), guests = Math.floor(Number(raw.guests));
  if (!isISODate(checkIn) || !isISODate(checkOut)) return { ok: false, error: "Choose check-in and check-out dates." };
  // Egypt Knight is trusted on stay length (it may book a single night before a cruise); only dates and guests are checked.
  const problems = stayProblems({ checkIn, checkOut, guests, today: todayInEgypt(), rules: { ...st, minNights: 1, maxNights: 60 } });
  if (problems.length) return { ok: false, error: problems[0] };
  const name = clip(raw.name, 80);
  if (name.length < 2) return { ok: false, error: "Enter the guest's name." };
  if (!isFree(await loadTaken(), checkIn, checkOut)) return { ok: false, error: "Those nights are no longer free at the residence. Pick other dates." };
  const nightly = st.agencyNightlyUsd > 0 ? st.agencyNightlyUsd : st.nightlyUsd;
  const nights = nightsBetween(checkIn, checkOut);
  const stay = Math.round(nights * nightly * 100) / 100, total = Math.round((stay + st.cleaningUsd) * 100) / 100;
  const ref = await newRef(), token = newToken(), now = Date.now();
  const partnerRef = clip(raw.partnerRef, 40), staff = clip(raw.staffName, 60);
  await tx([
    { sql: `INSERT INTO bookings (ref, token, status, source, check_in, check_out, guests, name, email, phone, notes, nightly_usd, nights, stay_usd, cleaning_usd, extras_usd, total_usd, deposit_usd, pay_method, currency, hold_until, partner_ref, staff_notes, seen, created_at, updated_at)
            VALUES (?,?,'CONFIRMED','EGYPT_KNIGHT',?,?,?,?,?,?,?,?,?,?,?,0,?,0,'AGENCY','USD',NULL,?,?,0,?,?)`,
      args: [ref, token, checkIn, checkOut, guests, name, clip(raw.email, 120), clip(raw.phone, 30), clip(raw.notes, 1000), nightly, nights, stay, st.cleaningUsd, total, partnerRef, `Booked by Egypt Knight Tours${staff ? ` (${staff})` : ""}${partnerRef ? ` · their order ${partnerRef}` : ""}`, now, now] },
    { sql: "INSERT INTO events (booking_id, text, created_at) VALUES ((SELECT id FROM bookings WHERE ref = ?), ?, ?)", args: [ref, `Booked by Egypt Knight Tours${staff ? ` — ${staff}` : ""}`, now] },
  ]);
  const b = await getBookingByToken(token);
  return b ? { ok: true, token, ref, booking: b } : { ok: false, error: "The booking couldn't be saved. Please try again." };
}

export async function listPartnerBookings(limit = 100): Promise<(Booking & { paid: number })[]> {
  const rows = await all(`SELECT b.*, (SELECT COALESCE(SUM(amount_usd),0) FROM payments p WHERE p.booking_id = b.id AND p.status = 'CONFIRMED') AS paid
    FROM bookings b WHERE source = 'EGYPT_KNIGHT' ORDER BY check_in DESC LIMIT ?`, [limit]);
  return rows.map((r) => ({ ...toBooking(r), paid: n(r.paid) }));
}

// ---------- requests sent from the residence to Egypt Knight ----------
export type SentRequest = { id: number; bookingId: number; ref: string; summary: string; createdBy: string; createdAt: number; bookingRef?: string; guest?: string };
export async function listSentRequests(bookingId?: number): Promise<SentRequest[]> {
  const rows = await all(`SELECT r.*, b.ref AS booking_ref, b.name AS guest FROM partner_requests r LEFT JOIN bookings b ON b.id = r.booking_id ${bookingId ? "WHERE r.booking_id = ?" : ""} ORDER BY r.created_at DESC LIMIT 200`, bookingId ? [bookingId] : []);
  return rows.map((r) => ({ id: n(r.id), bookingId: n(r.booking_id), ref: s(r.ref), summary: s(r.summary), createdBy: s(r.created_by), createdAt: n(r.created_at), bookingRef: s(r.booking_ref), guest: s(r.guest) }));
}

export type { Settings };

"use server";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { requireStaff, destroySession } from "@/lib/auth";
import { run, one, tx } from "@/lib/db";
import { getBooking, getExperience, logEvent, loadTaken, newRef, newToken } from "@/lib/data";
import { getSettings, saveSettings, DEFAULTS, type Settings } from "@/lib/settings";
import { isISODate, nightsBetween } from "@/lib/dates";
import { isFree } from "@/lib/availability";
import { r2, unitQty } from "@/lib/pricing";

const str = (fd: FormData, k: string, max = 500) => String(fd.get(k) ?? "").replace(/\u0000/g, "").trim().slice(0, max);
const num = (fd: FormData, k: string) => { const v = Number(String(fd.get(k) ?? "").replace(",", ".")); return Number.isFinite(v) ? v : 0; };
const int = (fd: FormData, k: string) => Math.floor(num(fd, k));
function back(id: number, msg: string): never { revalidatePath(`/admin/bookings/${id}`); redirect(`/admin/bookings/${id}?m=${encodeURIComponent(msg)}`); }

export async function logout() { await destroySession(); redirect("/admin/login"); }

/** Recalculate a booking's money after its stay or experiences change. */
async function recalc(id: number) {
  await run(`UPDATE bookings SET extras_usd = (SELECT COALESCE(SUM(line_usd), 0) FROM booking_items WHERE booking_id = ? AND status != 'CANCELLED'),
    total_usd = stay_usd + cleaning_usd + (SELECT COALESCE(SUM(line_usd), 0) FROM booking_items WHERE booking_id = ? AND status != 'CANCELLED'), updated_at = ? WHERE id = ?`, [id, id, Date.now(), id]);
}

const STATUSES = ["REQUEST", "AWAITING_DEPOSIT", "RECEIPT_SENT", "CONFIRMED", "CHECKED_IN", "COMPLETED", "CANCELLED"];

export async function setStatus(fd: FormData) {
  const s = await requireStaff();
  const id = int(fd, "id"), status = str(fd, "status");
  if (!STATUSES.includes(status)) back(id, "Unknown status");
  const b = await getBooking(id); if (!b) redirect("/admin/bookings");
  // Re-opening a cancelled or expired booking must not double-book.
  if (["REQUEST", "AWAITING_DEPOSIT", "RECEIPT_SENT", "CONFIRMED", "CHECKED_IN"].includes(status)) {
    const taken = await loadTaken(id);
    if (!isFree(taken, b.checkIn, b.checkOut)) back(id, "Can't do that: some of these nights are now taken by another booking.");
  }
  const hold = ["REQUEST", "AWAITING_DEPOSIT"].includes(status) ? Date.now() + 24 * 3600_000 : null;
  await run("UPDATE bookings SET status = ?, hold_until = ?, seen = 1, updated_at = ? WHERE id = ?", [status, hold, Date.now(), id]);
  await logEvent(id, `${s.name || s.email}: status → ${status.replace(/_/g, " ").toLowerCase()}`);
  back(id, "Saved");
}

export async function extendHold(fd: FormData) {
  const s = await requireStaff(); const id = int(fd, "id");
  const b = await getBooking(id); if (!b) redirect("/admin/bookings");
  const taken = await loadTaken(id);
  if (!isFree(taken, b.checkIn, b.checkOut)) back(id, "Can't extend: some nights are now taken by another booking.");
  await run("UPDATE bookings SET hold_until = ?, updated_at = ? WHERE id = ?", [Math.max(Date.now(), b.holdUntil ?? 0) + 24 * 3600_000, Date.now(), id]);
  await logEvent(id, `${s.name || s.email}: hold extended by 24 hours`);
  back(id, "Hold extended by 24 hours");
}

export async function savePaymentDecision(fd: FormData) {
  const s = await requireStaff(); const id = int(fd, "id"), pid = int(fd, "pid"); const ok = str(fd, "decision") === "confirm";
  const amount = num(fd, "amount");
  const p = await one<{ booking_id: number }>("SELECT booking_id FROM payments WHERE id = ?", [pid]);
  if (!p || Number(p.booking_id) !== id) back(id, "Payment not found");
  await run("UPDATE payments SET status = ?, amount_usd = CASE WHEN ? > 0 THEN ? ELSE amount_usd END WHERE id = ?", [ok ? "CONFIRMED" : "REJECTED", amount, amount, pid]);
  const b = await getBooking(id);
  if (ok && b && ["REQUEST", "AWAITING_DEPOSIT", "RECEIPT_SENT"].includes(b.status)) await run("UPDATE bookings SET status = 'CONFIRMED', hold_until = NULL, updated_at = ? WHERE id = ?", [Date.now(), id]);
  if (!ok && b && b.status === "RECEIPT_SENT") await run("UPDATE bookings SET status = 'AWAITING_DEPOSIT', hold_until = ?, updated_at = ? WHERE id = ?", [Date.now() + 24 * 3600_000, Date.now(), id]);
  await logEvent(id, `${s.name || s.email}: payment ${ok ? "confirmed" : "rejected"}`);
  back(id, ok ? "Payment confirmed — booking confirmed" : "Payment rejected — guest has 24 hours to send a new one");
}

export async function addPayment(fd: FormData) {
  const s = await requireStaff(); const id = int(fd, "id"); const amount = r2(num(fd, "amount"));
  if (amount === 0) back(id, "Enter an amount");
  const method = ["CASH", "INSTAPAY", "TRANSFER", "CARD", "AGENCY", "REFUND"].includes(str(fd, "method")) ? str(fd, "method") : "CASH";
  const signed = method === "REFUND" ? -Math.abs(amount) : amount;
  await run("INSERT INTO payments (booking_id, amount_usd, method, status, note, created_at) VALUES (?, ?, ?, 'CONFIRMED', ?, ?)", [id, signed, method, str(fd, "note", 200), Date.now()]);
  await logEvent(id, `${s.name || s.email}: ${method === "REFUND" ? "refund" : "payment"} of $${Math.abs(signed)} recorded (${method.toLowerCase()})`);
  back(id, "Payment recorded");
}

export async function updateItem(fd: FormData) {
  await requireStaff(); const id = int(fd, "id"), item = int(fd, "item");
  const status = ["TO_ARRANGE", "ARRANGED", "DONE", "CANCELLED"].includes(str(fd, "status")) ? str(fd, "status") : "TO_ARRANGE";
  const partner = int(fd, "partner");
  await run("UPDATE booking_items SET status = ?, partner_id = ?, time = ?, note = ? WHERE id = ? AND booking_id = ?", [status, partner || null, str(fd, "time", 20), str(fd, "note", 200), item, id]);
  await recalc(id);
  back(id, "Experience updated");
}

export async function addItem(fd: FormData) {
  const s = await requireStaff(); const id = int(fd, "id");
  const b = await getBooking(id); const e = await getExperience(int(fd, "experience"));
  const date = str(fd, "date");
  if (!b || !e) back(id, "Choose an experience");
  if (!isISODate(date) || date < b!.checkIn || date > b!.checkOut) back(id, "Choose a date during the stay");
  const qty = unitQty(e!.unit, b!.guests, int(fd, "qty") || undefined);
  const price = num(fd, "price") > 0 ? num(fd, "price") : e!.priceUsd;
  await run(`INSERT INTO booking_items (booking_id, experience_id, title, date, time, qty, unit, price_usd, line_usd, cost_usd, partner_id) VALUES (?,?,?,?,?,?,?,?,?,?,?)`,
    [id, e!.id, e!.title, date, e!.timeHint, qty, e!.unit, price, r2(qty * price), r2(qty * e!.costUsd), e!.partnerId]);
  await recalc(id);
  await logEvent(id, `${s.name || s.email}: added ${e!.title}`);
  back(id, "Experience added");
}

export async function removeItem(fd: FormData) {
  const s = await requireStaff(); const id = int(fd, "id"), item = int(fd, "item");
  await run("DELETE FROM booking_items WHERE id = ? AND booking_id = ?", [item, id]);
  await recalc(id); await logEvent(id, `${s.name || s.email}: removed an experience`);
  back(id, "Experience removed");
}

export async function updateStay(fd: FormData) {
  const s = await requireStaff(); const id = int(fd, "id");
  const checkIn = str(fd, "checkIn"), checkOut = str(fd, "checkOut"), guests = int(fd, "guests");
  const nightly = r2(num(fd, "nightly")), cleaning = r2(num(fd, "cleaning")), deposit = r2(num(fd, "deposit"));
  if (!isISODate(checkIn) || !isISODate(checkOut) || nightsBetween(checkIn, checkOut) < 1) back(id, "Check the dates");
  if (guests < 1 || guests > 20 || nightly < 0) back(id, "Check guests and price");
  const b = await getBooking(id);
  if (b && b.status !== "CANCELLED" && !isFree(await loadTaken(id), checkIn, checkOut)) back(id, "Those dates overlap another booking or a blocked date");
  const nights = nightsBetween(checkIn, checkOut);
  await run(`UPDATE bookings SET check_in = ?, check_out = ?, guests = ?, nightly_usd = ?, nights = ?, stay_usd = ?, cleaning_usd = ?, deposit_usd = ?, updated_at = ? WHERE id = ?`,
    [checkIn, checkOut, guests, nightly, nights, r2(nights * nightly), cleaning, deposit, Date.now(), id]);
  await recalc(id); await logEvent(id, `${s.name || s.email}: stay changed to ${checkIn} → ${checkOut}, ${guests} guests, $${nightly}/night`);
  back(id, "Stay updated");
}

export async function updateGuest(fd: FormData) {
  await requireStaff(); const id = int(fd, "id");
  await run("UPDATE bookings SET name = ?, phone = ?, email = ?, country = ?, arrival = ?, notes = ?, staff_notes = ?, source = ?, updated_at = ? WHERE id = ?",
    [str(fd, "name", 80) || "Guest", str(fd, "phone", 30), str(fd, "email", 120), str(fd, "country", 60), str(fd, "arrival", 120), str(fd, "notes", 1000), str(fd, "staffNotes", 2000), str(fd, "source", 20) || "WEBSITE", Date.now(), id]);
  back(id, "Guest details saved");
}

export async function createManual(fd: FormData) {
  const s = await requireStaff();
  const st = await getSettings();
  const checkIn = str(fd, "checkIn"), checkOut = str(fd, "checkOut"), guests = int(fd, "guests") || 1;
  const nightly = num(fd, "nightly") > 0 ? r2(num(fd, "nightly")) : st.nightlyUsd;
  const name = str(fd, "name", 80);
  const err = (m: string): never => redirect(`/admin/bookings/new?e=${encodeURIComponent(m)}`);
  if (!isISODate(checkIn) || !isISODate(checkOut) || nightsBetween(checkIn, checkOut) < 1) err("Check the dates");
  if (name.length < 2) err("Enter the guest's name");
  if (!isFree(await loadTaken(), checkIn, checkOut) && fd.get("force") !== "on") err("Those dates overlap another booking or blocked dates. Tick 'book anyway' if you're sure.");
  const status = ["CONFIRMED", "AWAITING_DEPOSIT", "REQUEST"].includes(str(fd, "status")) ? str(fd, "status") : "CONFIRMED";
  const nights = nightsBetween(checkIn, checkOut), stay = r2(nights * nightly), total = r2(stay + st.cleaningUsd);
  const ref = await newRef(), token = newToken(), now = Date.now();
  await tx([
    { sql: `INSERT INTO bookings (ref, token, status, source, check_in, check_out, guests, name, email, phone, country, arrival, notes, nightly_usd, nights, stay_usd, cleaning_usd, extras_usd, total_usd, deposit_usd, pay_method, currency, hold_until, staff_notes, seen, created_at, updated_at)
            VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,0,?,?,'TRANSFER','USD',?,?,1,?,?)`,
      args: [ref, token, status, str(fd, "source", 20) || "WHATSAPP", checkIn, checkOut, guests, name, str(fd, "email", 120), str(fd, "phone", 30), str(fd, "country", 60), str(fd, "arrival", 120), "",
        nightly, nights, stay, st.cleaningUsd, total, Math.ceil(total * st.depositPct / 100), status === "CONFIRMED" ? null : now + st.holdHours * 3600_000, str(fd, "staffNotes", 2000), now, now] },
    { sql: "INSERT INTO events (booking_id, text, created_at) VALUES ((SELECT id FROM bookings WHERE ref = ?), ?, ?)", args: [ref, `${s.name || s.email}: booking added by hand`, now] },
  ]);
  const b = await one<{ id: number }>("SELECT id FROM bookings WHERE ref = ?", [ref]);
  redirect(`/admin/bookings/${b?.id}?m=${encodeURIComponent("Booking created. Add experiences and payments below.")}`);
}

export async function addBlock(fd: FormData) {
  await requireStaff();
  const from = str(fd, "from"), to = str(fd, "to");
  const m = str(fd, "m");
  if (!isISODate(from) || !isISODate(to) || to <= from) redirect(`/admin/calendar?m=${m}&e=1`);
  await run("INSERT INTO blocks (date_from, date_to, reason, created_at) VALUES (?, ?, ?, ?)", [from, to, str(fd, "reason", 100), Date.now()]);
  revalidatePath("/admin/calendar"); redirect(`/admin/calendar?m=${m || from.slice(0, 7)}`);
}
export async function deleteBlock(fd: FormData) {
  await requireStaff();
  await run("DELETE FROM blocks WHERE id = ?", [int(fd, "bid")]);
  revalidatePath("/admin/calendar"); redirect(`/admin/calendar?m=${str(fd, "m")}`);
}

const slugify = (s: string) => s.toLowerCase().normalize("NFKD").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 60) || `exp-${Date.now()}`;

export async function saveExperience(fd: FormData) {
  const s = await requireStaff();
  const id = int(fd, "id");
  const title = str(fd, "title", 100);
  if (title.length < 2) redirect(`/admin/experiences/${id || "new"}?e=1`);
  const unit = str(fd, "unit") === "GROUP" ? "GROUP" : "PERSON";
  const image = str(fd, "imageUrl", 300) || str(fd, "image", 300);
  const safeImage = /^(\/(photos|art)\/[\w.-]+|https:\/\/[^\s"'<>]+)$/.test(image) ? image : "/photos/feluccas.webp";
  const vals = [title, str(fd, "category", 30) || "nile", str(fd, "summary", 200), str(fd, "description", 1500), str(fd, "duration", 60), str(fd, "timeHint", 20),
    Math.max(0, r2(num(fd, "price"))), unit, int(fd, "partner") || null, safeImage, int(fd, "sort"), fd.get("active") === "on" ? 1 : 0];
  if (id) {
    // Only the owner sees and changes what partners are paid.
    if (s.role === "OWNER") await run("UPDATE experiences SET cost_usd = ? WHERE id = ?", [Math.max(0, r2(num(fd, "cost"))), id]);
    await run("UPDATE experiences SET title = ?, category = ?, summary = ?, description = ?, duration = ?, time_hint = ?, price_usd = ?, unit = ?, partner_id = ?, image = ?, sort = ?, active = ? WHERE id = ?", [...vals, id]);
  } else {
    let slug = slugify(title);
    if (await one("SELECT id FROM experiences WHERE slug = ?", [slug])) slug = `${slug}-${Date.now().toString(36)}`;
    await run("INSERT INTO experiences (title, category, summary, description, duration, time_hint, price_usd, unit, partner_id, image, sort, active, slug, cost_usd) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?)",
      [...vals, slug, s.role === "OWNER" ? Math.max(0, r2(num(fd, "cost"))) : 0]);
  }
  revalidatePath("/admin/experiences"); redirect("/admin/experiences?m=Saved");
}

export async function savePartner(fd: FormData) {
  await requireStaff();
  const id = int(fd, "id"); const name = str(fd, "name", 80);
  if (name.length < 2) redirect("/admin/partners?e=1");
  const v = [name, str(fd, "role", 40), str(fd, "phone", 30), str(fd, "notes", 300), fd.get("active") === "off" ? 0 : 1];
  if (id) await run("UPDATE partners SET name = ?, role = ?, phone = ?, notes = ?, active = ? WHERE id = ?", [...v, id]);
  else await run("INSERT INTO partners (name, role, phone, notes, active) VALUES (?, ?, ?, ?, ?)", v);
  revalidatePath("/admin/partners"); redirect("/admin/partners?m=Saved");
}

export async function saveSettingsForm(fd: FormData) {
  await requireStaff(true);
  const pos = (k: string, min = 0) => Math.max(min, num(fd, k));
  const patch: Partial<Settings> = {
    nightlyUsd: r2(pos("nightlyUsd", 1)), cleaningUsd: r2(pos("cleaningUsd")), depositPct: Math.min(100, Math.round(pos("depositPct"))),
    minNights: Math.max(1, Math.round(pos("minNights", 1))), maxNights: Math.max(1, Math.round(pos("maxNights", 1))), maxGuests: Math.max(1, Math.round(pos("maxGuests", 1))), holdHours: Math.max(1, Math.round(pos("holdHours", 1))),
    rates: { EUR: pos("rateEUR") || DEFAULTS.rates.EUR, EGP: pos("rateEGP") || DEFAULTS.rates.EGP },
    whatsapp: str(fd, "whatsapp", 20).replace(/\D/g, "") || DEFAULTS.whatsapp, email: str(fd, "email", 120),
    instapay: str(fd, "instapay", 120), bankDetails: str(fd, "bankDetails", 600), paymentNote: str(fd, "paymentNote", 300),
    checkInTime: str(fd, "checkInTime", 10), checkOutTime: str(fd, "checkOutTime", 10), address: str(fd, "address", 200), mapsUrl: /^https:\/\//.test(str(fd, "mapsUrl", 400)) ? str(fd, "mapsUrl", 400) : "",
    arrivalInfo: str(fd, "arrivalInfo", 1500), houseRules: str(fd, "houseRules", 1500), cancellationPolicy: str(fd, "cancellationPolicy", 1500), reviewUrl: /^https:\/\//.test(str(fd, "reviewUrl", 400)) ? str(fd, "reviewUrl", 400) : "",
  };
  await saveSettings(patch);
  revalidatePath("/", "layout"); redirect("/admin/settings?m=Saved");
}

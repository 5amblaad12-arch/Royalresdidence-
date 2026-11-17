// All prices are kept in US dollars. The server always recalculates; it never trusts totals sent by a browser.
import { nightsBetween } from "./dates.ts";

export type Unit = "PERSON" | "GROUP";
export type PriceRules = { nightlyUsd: number; cleaningUsd: number; depositPct: number; minNights: number; maxGuests: number; maxNights: number };
export type ExtraIn = { experienceId: number; date: string; qty?: number };
export type ExperiencePrice = { id: number; title: string; priceUsd: number; costUsd: number; unit: Unit; partnerId: number | null; timeHint: string };
export type QuoteLine = { experienceId: number; title: string; date: string; qty: number; unit: Unit; priceUsd: number; lineUsd: number; costUsd: number; partnerId: number | null; time: string };
export type Quote = { nights: number; stayUsd: number; cleaningUsd: number; extrasUsd: number; totalUsd: number; depositUsd: number; lines: QuoteLine[] };

export const r2 = (n: number) => Math.round(n * 100) / 100;

/** How many units of an experience are charged: people for PERSON (1…guests), always 1 for GROUP. */
export function unitQty(unit: Unit, guests: number, qty?: number): number {
  if (unit === "GROUP") return 1;
  const q = Math.floor(Number(qty ?? guests));
  if (!Number.isFinite(q) || q < 1) return guests;
  return Math.min(q, guests);
}

export function quote(o: { checkIn: string; checkOut: string; guests: number; extras: ExtraIn[]; rules: PriceRules; catalog: ExperiencePrice[] }): Quote {
  const nights = nightsBetween(o.checkIn, o.checkOut);
  const stayUsd = r2(nights * o.rules.nightlyUsd);
  const byId = new Map(o.catalog.map((e) => [e.id, e]));
  const lines: QuoteLine[] = [];
  for (const x of o.extras) {
    const e = byId.get(x.experienceId);
    if (!e) continue;
    const qty = unitQty(e.unit, o.guests, x.qty);
    lines.push({ experienceId: e.id, title: e.title, date: x.date, qty, unit: e.unit, priceUsd: e.priceUsd, lineUsd: r2(qty * e.priceUsd), costUsd: r2(qty * e.costUsd), partnerId: e.partnerId, time: e.timeHint });
  }
  lines.sort((a, b) => a.date.localeCompare(b.date) || a.time.localeCompare(b.time));
  const extrasUsd = r2(lines.reduce((s, l) => s + l.lineUsd, 0));
  const cleaningUsd = nights > 0 ? r2(o.rules.cleaningUsd) : 0;
  const totalUsd = r2(stayUsd + cleaningUsd + extrasUsd);
  const pct = Math.min(100, Math.max(0, o.rules.depositPct));
  const depositUsd = Math.min(totalUsd, Math.ceil((totalUsd * pct) / 100));
  return { nights, stayUsd, cleaningUsd, extrasUsd, totalUsd, depositUsd, lines };
}

/** Problems with a requested stay, in plain words. Empty list = fine. */
export function stayProblems(o: { checkIn: string; checkOut: string; guests: number; today: string; rules: PriceRules }): string[] {
  const p: string[] = [];
  const n = nightsBetween(o.checkIn, o.checkOut);
  if (o.checkIn < o.today) p.push("Check-in can't be in the past.");
  if (n < 1) p.push("Check-out must be after check-in.");
  else if (n < o.rules.minNights) p.push(`The minimum stay is ${o.rules.minNights} nights.`);
  else if (n > o.rules.maxNights) p.push(`For stays longer than ${o.rules.maxNights} nights, please message us on WhatsApp.`);
  if (!Number.isInteger(o.guests) || o.guests < 1) p.push("Please choose the number of guests.");
  else if (o.guests > o.rules.maxGuests) p.push(`The residence sleeps up to ${o.rules.maxGuests} guests.`);
  return p;
}

// Which nights are taken. A booking holds its nights while it is active; a hold that was never paid
// (request / waiting for deposit) lets go automatically when its hold time passes.
import { eachNight } from "./dates.ts";

export const HOLDING = ["REQUEST", "AWAITING_DEPOSIT", "RECEIPT_SENT", "CONFIRMED", "CHECKED_IN", "COMPLETED"] as const;
export const EXPIRES = ["REQUEST", "AWAITING_DEPOSIT"] as const;

export type StayRow = { id?: number; checkIn: string; checkOut: string; status: string; holdUntil: number | null };
export type BlockRow = { from: string; to: string };

export function isHolding(b: StayRow, now: number): boolean {
  if (!(HOLDING as readonly string[]).includes(b.status)) return false;
  if ((EXPIRES as readonly string[]).includes(b.status) && b.holdUntil != null && b.holdUntil < now) return false;
  return true;
}

export function takenNights(stays: StayRow[], blocks: BlockRow[], now: number, exceptId?: number): Set<string> {
  const s = new Set<string>();
  for (const b of stays) if (b.id !== exceptId && isHolding(b, now)) for (const d of eachNight(b.checkIn, b.checkOut)) s.add(d);
  for (const k of blocks) for (const d of eachNight(k.from, k.to)) s.add(d);
  return s;
}

export function isFree(taken: Set<string>, checkIn: string, checkOut: string): boolean {
  return eachNight(checkIn, checkOut).every((d) => !taken.has(d));
}

// Dates are plain "YYYY-MM-DD" strings everywhere (no time zones to go wrong).
// A stay from checkIn to checkOut uses the nights checkIn … checkOut-1.

const ISO = /^\d{4}-\d{2}-\d{2}$/;

export function isISODate(s: unknown): s is string {
  if (typeof s !== "string" || !ISO.test(s)) return false;
  const d = new Date(s + "T00:00:00Z");
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === s;
}

export function addDays(iso: string, n: number): string {
  const d = new Date(iso + "T00:00:00Z");
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

export function nightsBetween(checkIn: string, checkOut: string): number {
  return Math.round((Date.parse(checkOut + "T00:00:00Z") - Date.parse(checkIn + "T00:00:00Z")) / 86400000);
}

/** Every night of a stay: checkIn, checkIn+1 … checkOut-1. */
export function eachNight(checkIn: string, checkOut: string): string[] {
  const out: string[] = [];
  const n = nightsBetween(checkIn, checkOut);
  for (let i = 0; i < n && i < 400; i++) out.push(addDays(checkIn, i));
  return out;
}

/** Every day of a stay including the check-out day (for planning experiences). */
export function eachDay(checkIn: string, checkOut: string): string[] {
  return [...eachNight(checkIn, checkOut), checkOut];
}

/** Today's date in Aswan (Egypt time). */
export function todayInEgypt(now: Date = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Africa/Cairo", year: "numeric", month: "2-digit", day: "2-digit" }).format(now);
}

const WD = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const MO = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

/** "Fri 12 Feb" */
export function fmtDay(iso: string): string {
  const d = new Date(iso + "T00:00:00Z");
  return `${WD[d.getUTCDay()]} ${d.getUTCDate()} ${MO[d.getUTCMonth()]}`;
}
/** "12 Feb 2027" */
export function fmtLong(iso: string): string {
  const d = new Date(iso + "T00:00:00Z");
  return `${d.getUTCDate()} ${MO[d.getUTCMonth()]} ${d.getUTCFullYear()}`;
}
/** "12 – 16 Feb" or "28 Feb – 3 Mar" */
export function fmtRange(a: string, b: string): string {
  const x = new Date(a + "T00:00:00Z"), y = new Date(b + "T00:00:00Z");
  if (x.getUTCMonth() === y.getUTCMonth() && x.getUTCFullYear() === y.getUTCFullYear()) return `${x.getUTCDate()} – ${y.getUTCDate()} ${MO[y.getUTCMonth()]}`;
  return `${x.getUTCDate()} ${MO[x.getUTCMonth()]} – ${y.getUTCDate()} ${MO[y.getUTCMonth()]}`;
}
export function weekday(iso: string): string { return WD[new Date(iso + "T00:00:00Z").getUTCDay()]; }
export function monthName(m: number): string { return ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"][m]; }

// Prices are stored in USD and shown in the guest's chosen currency using rates the owner sets in Settings.
export const CURRENCIES = ["USD", "EUR", "EGP"] as const;
export type Currency = (typeof CURRENCIES)[number];
export type Rates = { EUR: number; EGP: number };

export function isCurrency(x: unknown): x is Currency { return typeof x === "string" && (CURRENCIES as readonly string[]).includes(x); }

export function convert(usd: number, cur: Currency, rates: Rates): number {
  if (cur === "USD") return usd;
  const r = cur === "EUR" ? rates.EUR : rates.EGP;
  return usd * (Number.isFinite(r) && r > 0 ? r : 1);
}

/** "$530", "€488", "EGP 26,500". EGP is rounded to the nearest 5 pounds; others to whole units unless they have cents. */
export function fmtMoney(usd: number, cur: Currency = "USD", rates: Rates = { EUR: 1, EGP: 1 }): string {
  let v = convert(usd, cur, rates);
  if (cur === "EGP") { v = Math.round(v / 5) * 5; return `EGP ${v.toLocaleString("en-US")}`; }
  const whole = Math.abs(v - Math.round(v)) < 0.005;
  const s = v.toLocaleString("en-US", { minimumFractionDigits: whole ? 0 : 2, maximumFractionDigits: whole ? 0 : 2 });
  return cur === "EUR" ? `€${s}` : `$${s}`;
}

export const usd = (n: number) => fmtMoney(n, "USD");

// Helpers for public pages: the guest's chosen currency and price formatting.
import { cookies } from "next/headers";
import { isCurrency, fmtMoney, type Currency, type Rates } from "./money";

export async function getCurrency(): Promise<Currency> {
  const c = (await cookies()).get("cur")?.value;
  return isCurrency(c) ? c : "USD";
}

export function pricer(cur: Currency, rates: Rates) {
  return (usd: number) => fmtMoney(usd, cur, rates);
}

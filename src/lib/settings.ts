import { all, run } from "./db";
import type { PriceRules } from "./pricing.ts";
import type { Rates } from "./money.ts";

export type Settings = PriceRules & {
  holdHours: number;
  rates: Rates;
  whatsapp: string; // digits with country code
  email: string;
  instapay: string; // InstaPay address / phone
  bankDetails: string;
  paymentNote: string;
  checkInTime: string;
  checkOutTime: string;
  address: string;
  mapsUrl: string;
  arrivalInfo: string; // sent on the guest's trip page once confirmed (door code, building, etc.)
  houseRules: string;
  cancellationPolicy: string;
  reviewUrl: string; // Google review link sent after check-out
  agencyNightlyUsd: number; // price per night when Egypt Knight books the residence (0 = same as the normal price)
  mapLat: number; // map pin (set the exact building in Settings)
  mapLng: number;
};

export const DEFAULTS: Settings = {
  nightlyUsd: 85, cleaningUsd: 0, depositPct: 25, minNights: 2, maxGuests: 6, maxNights: 30, holdHours: 24,
  rates: { EUR: 0.92, EGP: 50 },
  whatsapp: "201128348803", email: "",
  instapay: "", bankDetails: "", paymentNote: "Please write your booking reference in the transfer note.",
  checkInTime: "14:00", checkOutTime: "12:00",
  address: "Corniche, Aswan, Egypt — about 2 minutes from Tulip Aswan Hotel",
  mapsUrl: "",
  arrivalInfo: "",
  houseRules: "No smoking inside. No parties or events. Quiet hours 23:00–08:00. Please respect the neighbours.",
  cancellationPolicy: "To change or cancel, message us on WhatsApp as early as you can. We'll explain clearly whether any part of your deposit can be refunded before you decide.",
  reviewUrl: "",
  agencyNightlyUsd: 0,
  mapLat: 24.1096, mapLng: 32.9014, // next to Tolip Aswan Hotel until the owner sets the exact building
};

export async function getSettings(): Promise<Settings> {
  const rows = await all<{ key: string; value: string }>("SELECT key, value FROM settings");
  const s: Record<string, unknown> = { ...DEFAULTS, rates: { ...DEFAULTS.rates } };
  for (const r of rows) {
    if (!(r.key in DEFAULTS)) continue;
    try { s[r.key] = JSON.parse(r.value); } catch { /* keep default */ }
  }
  return s as Settings;
}

export async function saveSettings(patch: Partial<Settings>): Promise<void> {
  for (const [k, v] of Object.entries(patch)) {
    if (!(k in DEFAULTS) || v === undefined) continue;
    await run("INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value", [k, JSON.stringify(v)]);
  }
}

export { waDigits, waLink } from "./wa.ts";

// What the residence asks Egypt Knight Tours for, through the private link (see link.ts).
import { callLink, linkReady } from "./link";

export const ekUrl = () => (process.env.EGYPT_KNIGHT_URL ?? "").trim();
export const ekReady = () => linkReady(ekUrl());

export type EkCatalog = { tours: { id: string; title: string; price: number; perPerson: boolean; days: number; destination: string }[]; serviceTypes: [string, string][] };
export type EkRequest = { ref: string; status: string; statusLabel: string; currency: string; priceTotal: number; services: { label: string; type: string; date: string | null; time: string | null; people: number | null; status: string; statusLabel: string }[] };

export async function ekCatalog() { return callLink<EkCatalog>(ekUrl(), "GET", "/api/link/catalog"); }
export async function ekRequests(refs: string[]) {
  if (!refs.length) return { ok: true as const, data: { requests: [] as EkRequest[] } };
  return callLink<{ requests: EkRequest[] }>(ekUrl(), "GET", `/api/link/requests?refs=${encodeURIComponent(refs.slice(0, 100).join(","))}`);
}
export async function ekSendRequest(body: Record<string, unknown>) { return callLink<{ ok: true; ref: string; label: string }>(ekUrl(), "POST", "/api/link/requests", body); }

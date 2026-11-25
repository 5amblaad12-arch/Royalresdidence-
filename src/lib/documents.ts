// Loads a booking's data and renders one of its PDFs (booking confirmation, invoice, payment receipt).
import { getItems, getPayments, type Booking } from "./data";
import { getSettings } from "./settings";
import { siteUrl } from "./notify";
import { renderPdf, fileName, receiptable, type PdfKind } from "./pdf.ts";

/** "booking" | "invoice" | "receipt-12" → kind + payment id, or null if the name is not one of ours. */
export function parseDoc(doc: string): { kind: PdfKind; paymentId?: number } | null {
  if (doc === "booking" || doc === "invoice") return { kind: doc };
  const m = /^receipt-(\d{1,9})$/.exec(doc);
  return m ? { kind: "receipt", paymentId: Number(m[1]) } : null;
}

export async function bookingPdf(b: Booking, kind: PdfKind, paymentId?: number): Promise<{ bytes: Uint8Array; name: string } | null> {
  const [items, payments, st] = await Promise.all([getItems(b.id), getPayments(b.id), getSettings()]);
  if (kind === "receipt" && !receiptable(payments).some((p) => p.id === paymentId)) return null;
  const bytes = await renderPdf({ kind, paymentId, booking: b, items, payments, settings: { ...st, siteUrl: siteUrl() } });
  return { bytes, name: fileName(kind, b.ref, payments, paymentId) };
}

/** Links to every document this booking has, for the guest page and the admin. */
export async function documentLinks(b: Booking, paymentsIn?: { id: number; amountUsd: number; status: string; createdAt: number; method: string; note: string }[]) {
  const payments = paymentsIn ?? (await getPayments(b.id));
  const base = `/trip/${b.token}/pdf`;
  const confirmed = ["CONFIRMED", "CHECKED_IN", "COMPLETED"].includes(b.status);
  return [
    { key: "booking", label: confirmed ? "Booking confirmation" : "Booking summary", href: `${base}/booking` },
    { key: "invoice", label: "Invoice", href: `${base}/invoice` },
    ...receiptable(payments).map((p, i) => ({ key: `receipt-${p.id}`, label: `Receipt ${i + 1} · $${p.amountUsd}`, href: `${base}/receipt-${p.id}` })),
  ];
}

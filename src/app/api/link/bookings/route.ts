// For Egypt Knight Tours (signed requests only): book the residence for one of their guests, and list those bookings.
import { readLinked } from "@/lib/link";
import { createPartnerBooking, listPartnerBookings, STATUS_LABEL } from "@/lib/data";
import { getSettings } from "@/lib/settings";
import { alertTo, sendEmail, siteUrl } from "@/lib/notify";
import { fmtRange } from "@/lib/dates";
import { usd } from "@/lib/money";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const r = await readLinked(req); if (!r.ok) return r.res;
  const list = await listPartnerBookings();
  return Response.json({ bookings: list.map((b) => ({ ref: b.ref, checkIn: b.checkIn, checkOut: b.checkOut, nights: b.nights, guests: b.guests, name: b.name, status: b.status, statusLabel: STATUS_LABEL[b.status] ?? b.status, totalUsd: b.totalUsd, paidUsd: b.paid, partnerRef: b.partnerRef })) });
}

export async function POST(req: Request) {
  const r = await readLinked(req); if (!r.ok) return r.res;
  const x = r.body;
  const res = await createPartnerBooking({ checkIn: String(x.checkIn ?? ""), checkOut: String(x.checkOut ?? ""), guests: Number(x.guests), name: String(x.name ?? ""), phone: String(x.phone ?? ""),
    email: String(x.email ?? ""), notes: String(x.notes ?? ""), partnerRef: String(x.partnerRef ?? ""), staffName: String(x.staffName ?? "") });
  if (!res.ok) return Response.json({ error: res.error }, { status: 400 });
  const b = res.booking;
  try {
    const st = await getSettings();
    await sendEmail({ to: alertTo(st.email), subject: `Egypt Knight booked ${b.ref} · ${b.name} · ${fmtRange(b.checkIn, b.checkOut)}`,
      text: `Egypt Knight Tours booked the residence.\n\n${b.name} · ${b.guests} guests${b.phone ? ` · ${b.phone}` : ""}\n${fmtRange(b.checkIn, b.checkOut)} (${b.nights} nights)\nTotal ${usd(b.totalUsd)} (partner price)\n${b.staffNotes}\n${b.notes ? `Notes: ${b.notes}\n` : ""}\nOpen: ${siteUrl()}/admin/bookings/${b.id}` });
  } catch { /* email is optional */ }
  return Response.json({ ok: true, ref: b.ref, status: b.status, statusLabel: STATUS_LABEL[b.status], nights: b.nights, totalUsd: b.totalUsd });
}

import { createWebsiteBooking, getItems } from "@/lib/data";
import { getSettings } from "@/lib/settings";
import { allow, alertTo, clientIp, sendEmail, siteUrl } from "@/lib/notify";
import { fmtRange, fmtDay } from "@/lib/dates";
import { usd } from "@/lib/money";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  let body: Record<string, unknown>;
  try { body = await req.json(); } catch { return Response.json({ error: "Bad request." }, { status: 400 }); }
  // Bots fill the hidden "website" field; pretend all is well and do nothing.
  if (typeof body.website === "string" && body.website.trim()) return Response.json({ error: "Please message us on WhatsApp to book." }, { status: 400 });
  const ip = clientIp(req.headers);
  if (!(await allow(`book:${ip}`, 6, 3600_000))) return Response.json({ error: "Too many bookings from this connection. Please message us on WhatsApp." }, { status: 429 });

  const r = await createWebsiteBooking({
    checkIn: String(body.checkIn ?? ""), checkOut: String(body.checkOut ?? ""), guests: Number(body.guests),
    extras: Array.isArray(body.extras) ? (body.extras as { experienceId: number; date: string; qty?: number }[]) : [],
    name: String(body.name ?? ""), email: String(body.email ?? ""), phone: String(body.phone ?? ""), country: String(body.country ?? ""),
    arrival: String(body.arrival ?? ""), notes: String(body.notes ?? ""), payMethod: String(body.payMethod ?? ""), currency: String(body.currency ?? "USD"),
  }, ip);
  if (!r.ok) return Response.json({ error: r.error }, { status: 400 });

  // Email alert to the owner (only if email is set up). Never blocks the booking.
  try {
    const st = await getSettings();
    const b = r.booking; const items = await getItems(b.id);
    await sendEmail({
      to: alertTo(st.email),
      subject: `New booking ${b.ref} · ${b.name} · ${fmtRange(b.checkIn, b.checkOut)}`,
      text: [`New booking on the website: ${b.ref}`, ``, `${b.name} · ${b.guests} guests · ${b.phone}${b.email ? ` · ${b.email}` : ""}`, `${fmtRange(b.checkIn, b.checkOut)} (${b.nights} nights)`, b.arrival ? `Arriving: ${b.arrival}` : "",
        ...items.map((i) => `• ${fmtDay(i.date)} — ${i.title}${i.unit === "PERSON" ? ` × ${i.qty}` : ""} (${usd(i.lineUsd)})`), ``, `Total ${usd(b.totalUsd)} · deposit ${usd(b.depositUsd)}`,
        b.payMethod === "WHATSAPP" ? "The guest wants to talk on WhatsApp first." : "The guest will pay the deposit by transfer.", b.notes ? `Notes: ${b.notes}` : "", ``, `Open: ${siteUrl()}/admin/bookings/${b.id}`].filter((x) => x !== "").join("\n"),
    });
  } catch { /* email is optional */ }

  return Response.json({ ok: true, token: r.token, ref: r.ref });
}

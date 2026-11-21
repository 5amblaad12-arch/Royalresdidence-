// "Add to calendar": the stay and every planned trip as a calendar file (works with Apple, Google and Outlook calendars).
import { getBookingByToken, getItems } from "@/lib/data";
import { getSettings } from "@/lib/settings";
import { addDays } from "@/lib/dates";

export const dynamic = "force-dynamic";
const esc = (s: string) => s.replace(/\\/g, "\\\\").replace(/;/g, "\;").replace(/,/g, "\\,").replace(/\r?\n/g, "\\n");
const day = (iso: string) => iso.replace(/-/g, "");
const at = (iso: string, hhmm: string) => `${day(iso)}T${hhmm.replace(":", "").padEnd(4, "0")}00`;

export async function GET(_req: Request, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const b = await getBookingByToken(token);
  if (!b || b.status === "CANCELLED") return new Response("Not found", { status: 404 });
  const [items, st] = await Promise.all([getItems(b.id), getSettings()]);
  const now = new Date().toISOString().replace(/[-:]/g, "").slice(0, 15) + "Z";
  const loc = esc(`The Royal Nile Residence, ${st.address}`);
  const ev = (uid: string, start: string, end: string, title: string, desc: string) =>
    ["BEGIN:VEVENT", `UID:${uid}@royalnileresidence`, `DTSTAMP:${now}`, start, end, `SUMMARY:${esc(title)}`, `DESCRIPTION:${esc(desc)}`, `LOCATION:${loc}`, "END:VEVENT"].join("\r\n");
  const out = ["BEGIN:VCALENDAR", "VERSION:2.0", "PRODID:-//The Royal Nile Residence//Trip//EN", "CALSCALE:GREGORIAN", "METHOD:PUBLISH",
    "BEGIN:VTIMEZONE", "TZID:Africa/Cairo", "BEGIN:STANDARD", "DTSTART:19700101T000000", "TZOFFSETFROM:+0200", "TZOFFSETTO:+0200", "END:STANDARD", "END:VTIMEZONE",
    ev(`${b.ref}-stay`, `DTSTART;VALUE=DATE:${day(b.checkIn)}`, `DTEND;VALUE=DATE:${day(b.checkOut)}`, `Aswan — The Royal Nile Residence (${b.ref})`, `Check-in from ${st.checkInTime}, check-out by ${st.checkOutTime}. Questions: WhatsApp +${st.whatsapp}`),
    ...items.filter((i) => i.status !== "CANCELLED").map((i) => {
      const t = /^\d{1,2}:\d{2}$/.test(i.time) ? i.time.padStart(5, "0") : "";
      return t
        ? ev(`${b.ref}-${i.id}`, `DTSTART;TZID=Africa/Cairo:${at(i.date, t)}`, `DTEND;TZID=Africa/Cairo:${at(i.date, `${String(Math.min(23, Number(t.slice(0, 2)) + 2)).padStart(2, "0")}:${t.slice(3)}`)}`, i.title, `Booked with your stay ${b.ref}.`)
        : ev(`${b.ref}-${i.id}`, `DTSTART;VALUE=DATE:${day(i.date)}`, `DTEND;VALUE=DATE:${day(addDays(i.date, 1))}`, i.title, `Booked with your stay ${b.ref}. We'll confirm the time on WhatsApp.`);
    }),
    "END:VCALENDAR"].join("\r\n");
  return new Response(out, { headers: { "Content-Type": "text/calendar; charset=utf-8", "Content-Disposition": `attachment; filename="aswan-trip-${b.ref}.ics"`, "Cache-Control": "private, no-store" } });
}

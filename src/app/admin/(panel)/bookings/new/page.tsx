import Link from "next/link";
import { requireStaff } from "@/lib/auth";
import { getSettings } from "@/lib/settings";
import { SOURCES } from "@/lib/data";
import { createManual } from "../../actions";

export const dynamic = "force-dynamic";

export default async function NewBooking({ searchParams }: { searchParams: Promise<{ e?: string }> }) {
  await requireStaff();
  const { e } = await searchParams;
  const st = await getSettings();
  return (
    <div style={{ maxWidth: 760 }}>
      <div className="adm-h"><div><Link className="small link" href="/admin/bookings">‹ Bookings</Link><h1>New booking</h1></div></div>
      <p className="muted" style={{ marginBottom: 16 }}>For bookings that come by phone, WhatsApp, an agency, Booking.com or Airbnb. Adding them here keeps the website calendar correct.</p>
      {e ? <div className="msg bad">{e}</div> : null}
      <form action={createManual} className="card pad stack">
        <div className="grid2" style={{ gap: 14 }}>
          <label className="field"><span>Check-in</span><input type="date" name="checkIn" required /></label>
          <label className="field"><span>Check-out</span><input type="date" name="checkOut" required /></label>
          <label className="field"><span>Guests</span><input type="number" name="guests" min={1} max={20} defaultValue={2} required /></label>
          <label className="field"><span>Price per night (USD)</span><input type="number" step="0.01" name="nightly" defaultValue={st.nightlyUsd} /></label>
          <label className="field"><span>Guest name</span><input name="name" required /></label>
          <label className="field"><span>WhatsApp / phone</span><input name="phone" /></label>
          <label className="field"><span>Email</span><input name="email" type="email" /></label>
          <label className="field"><span>Country</span><input name="country" /></label>
          <label className="field"><span>Came from</span><select name="source" defaultValue="WHATSAPP">{SOURCES.map((s) => <option key={s} value={s}>{s.replace("_", ".").toLowerCase()}</option>)}</select></label>
          <label className="field"><span>Status</span><select name="status" defaultValue="CONFIRMED"><option value="CONFIRMED">Confirmed</option><option value="AWAITING_DEPOSIT">Waiting for deposit (hold {st.holdHours}h)</option><option value="REQUEST">Talking on WhatsApp (hold {st.holdHours}h)</option></select></label>
          <label className="field" style={{ gridColumn: "1 / -1" }}><span>Arrival (flight / train / time)</span><input name="arrival" /></label>
          <label className="field" style={{ gridColumn: "1 / -1" }}><span>Team notes (guests don't see these)</span><textarea name="staffNotes" /></label>
        </div>
        <label className="row small"><input type="checkbox" name="force" /> Book anyway if the dates overlap (only if you're sure)</label>
        <button className="btn btn-navy" type="submit">Create booking</button>
      </form>
    </div>
  );
}

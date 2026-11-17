import Link from "next/link";
import { requireStaff } from "@/lib/auth";
import { all, one } from "@/lib/db";
import { bookingsBetween, toArrange, STATUS_LABEL, toBooking } from "@/lib/data";
import { getSettings } from "@/lib/settings";
import { isHolding } from "@/lib/availability";
import { addDays, eachNight, fmtDay, fmtRange, todayInEgypt, nightsBetween, monthName } from "@/lib/dates";
import { usd } from "@/lib/money";
import { waLink } from "@/lib/wa";
import { STATUS_PILL } from "@/components/ui";

export const dynamic = "force-dynamic";

export default async function Today({ searchParams }: { searchParams: Promise<{ denied?: string }> }) {
  const s = await requireStaff();
  const { denied } = await searchParams;
  const owner = s.role === "OWNER";
  const today = todayInEgypt();
  const mStart = today.slice(0, 8) + "01";
  const [y, mo] = today.split("-").map(Number);
  const mEnd = new Date(Date.UTC(y, mo, 1)).toISOString().slice(0, 10);
  const daysInMonth = nightsBetween(mStart, mEnd);
  const now = Date.now();

  const [st, monthStays, arrange, actionRows, recentRows, extrasRow, moneyRow, upcoming] = await Promise.all([
    getSettings(), bookingsBetween(mStart, mEnd), toArrange(10),
    all("SELECT * FROM bookings WHERE status IN ('REQUEST','AWAITING_DEPOSIT','RECEIPT_SENT') ORDER BY created_at DESC LIMIT 20"),
    all("SELECT * FROM bookings ORDER BY created_at DESC LIMIT 6"),
    one<{ t: number; c: number; cost: number }>(`SELECT COALESCE(SUM(i.line_usd),0) AS t, COUNT(*) AS c, COALESCE(SUM(i.cost_usd),0) AS cost FROM booking_items i JOIN bookings b ON b.id = i.booking_id
      WHERE i.date >= ? AND i.date < ? AND i.status != 'CANCELLED' AND b.status IN ('CONFIRMED','CHECKED_IN','COMPLETED','RECEIPT_SENT')`, [mStart, mEnd]),
    one<{ t: number }>("SELECT COALESCE(SUM(amount_usd),0) AS t FROM payments WHERE status = 'CONFIRMED' AND created_at >= ?", [Date.parse(mStart + "T00:00:00+02:00")]),
    all(`SELECT b.*, (SELECT COALESCE(SUM(amount_usd),0) FROM payments p WHERE p.booking_id = b.id AND p.status='CONFIRMED') AS paid FROM bookings b
      WHERE b.check_in <= ? AND b.check_out >= ? AND b.status IN ('CONFIRMED','CHECKED_IN','RECEIPT_SENT') ORDER BY b.check_in`, [addDays(today, 7), today]),
  ]);

  let nights = 0;
  for (const b of monthStays) if (isHolding(b, now)) nights += eachNight(b.checkIn, b.checkOut).filter((d) => d >= mStart && d < mEnd).length;
  const action = actionRows.map(toBooking).filter((b) => isHolding(b, now) || b.status === "RECEIPT_SENT");
  const recent = recentRows.map(toBooking);
  const arrivals = upcoming.map((r) => ({ ...toBooking(r), paid: Number(r.paid) })).filter((b) => b.checkIn >= today);
  const departures = upcoming.map(toBooking).filter((b) => b.checkOut >= today && b.checkOut <= addDays(today, 7) && b.status === "CHECKED_IN");
  const hello = new Date().toLocaleString("en-GB", { timeZone: "Africa/Cairo", hour: "numeric", hour12: false });
  const h = Number(hello);

  return (
    <div>
      {denied ? <div className="msg bad">Only the owner can open that page.</div> : null}
      <div className="adm-h"><div><div className="small muted">{fmtDay(today)} {y}</div><h1>{h < 12 ? "Good morning" : h < 18 ? "Good afternoon" : "Good evening"} 👋</h1></div><span className="spacer" /><Link className="btn btn-navy btn-sm" href="/admin/bookings/new">+ New booking</Link></div>

      <div className="stats">
        <div className="stat"><small>Nights booked · {monthName(mo - 1)}</small><b>{nights} / {daysInMonth}</b><span>{Math.round((nights / daysInMonth) * 100)}% full</span></div>
        <div className="stat"><small>Need your action</small><b>{action.length}</b><span style={{ color: action.length ? "var(--amber)" : undefined }}>{action.length ? "requests & receipts" : "all clear"}</span></div>
        <div className="stat"><small>Experiences · {monthName(mo - 1)}</small><b>{usd(Number(extrasRow?.t ?? 0))}</b><span>{Number(extrasRow?.c ?? 0)} booked{owner ? ` · your margin ${usd(Number(extrasRow?.t ?? 0) - Number(extrasRow?.cost ?? 0))}` : ""}</span></div>
        <div className="stat"><small>Money in · {monthName(mo - 1)}</small><b>{usd(Number(moneyRow?.t ?? 0))}</b><span>confirmed payments</span></div>
      </div>

      <div className="adm-2 mt24">
        <div className="stack">
          <div className="card pad">
            <div className="row"><b>Needs your action</b><span className="spacer" /><Link className="small link" href="/admin/bookings?f=action">View all</Link></div>
            {action.length ? <div className="tbl-wrap mt8"><table className="tbl"><tbody>{action.map((b) => (
              <tr key={b.id}><td><Link href={`/admin/bookings/${b.id}`}><b>{b.name}</b><div className="small muted">{b.ref}{!b.seen ? " · NEW" : ""}</div></Link></td><td className="small">{fmtRange(b.checkIn, b.checkOut)} · {b.guests} guests</td>
                <td><span className={`pill ${STATUS_PILL[b.status]}`}>{STATUS_LABEL[b.status]}</span></td><td className="small">{usd(b.totalUsd)}</td></tr>))}</tbody></table></div>
              : <p className="small muted mt8">Nothing waiting. New website bookings and uploaded receipts show up here.</p>}
          </div>

          <div className="card pad">
            <div className="row"><b>Arriving in the next 7 days</b></div>
            {arrivals.length ? <div className="tbl-wrap mt8"><table className="tbl"><tbody>{arrivals.map((b) => (
              <tr key={b.id}><td><Link href={`/admin/bookings/${b.id}`}><b>{b.name}</b></Link><div className="small muted">{b.arrival || "Arrival time not given"}</div></td><td className="small">{fmtDay(b.checkIn)} → {fmtDay(b.checkOut)}</td>
                <td className="small">{b.totalUsd - b.paid > 0 ? <span className="pill pill-amber">{usd(b.totalUsd - b.paid)} to collect</span> : <span className="pill pill-green">Paid</span>}</td>
                <td><a className="btn btn-wa btn-sm" href={waLink(b.phone, `Hi ${b.name.split(" ")[0]}! Looking forward to welcoming you to Aswan on ${fmtDay(b.checkIn)}.`)} target="_blank" rel="noopener">WhatsApp</a></td></tr>))}</tbody></table></div>
              : <p className="small muted mt8">No arrivals this week.</p>}
            {departures.length ? <p className="small mt16"><b>Leaving soon:</b> {departures.map((b) => `${b.name} (${fmtDay(b.checkOut)})`).join(", ")}</p> : null}
          </div>

          <div className="card pad">
            <b>Latest bookings</b>
            <div className="tbl-wrap mt8"><table className="tbl"><tbody>{recent.map((b) => (
              <tr key={b.id}><td><Link href={`/admin/bookings/${b.id}`}><b>{b.name}</b> <span className="small muted">{b.ref}</span></Link></td><td className="small">{fmtRange(b.checkIn, b.checkOut)}</td><td className="small muted">{b.source.replace("_", ".").toLowerCase()}</td><td><span className={`pill ${STATUS_PILL[b.status]}`}>{STATUS_LABEL[b.status]}</span></td></tr>))}</tbody></table></div>
          </div>
        </div>

        <div className="card pad">
          <b>To arrange</b><div className="small muted">Experiences in the next 10 days not yet booked with a partner</div>
          {arrange.length ? arrange.map((i) => (
            <div key={i.id} style={{ padding: "12px 0", borderTop: "1px solid #EEE9E0" }} className="mt8">
              <div className="row" style={{ flexWrap: "nowrap" }}><div style={{ flex: 1 }}><b className="small">{i.title}{i.unit === "PERSON" ? ` × ${i.qty}` : ""}</b><div className="small muted">{fmtDay(i.date)}{i.time ? ` · ${i.time}` : ""} · {i.guest} ({i.ref})</div><div className="small muted">{i.partner || "No partner chosen"}</div></div>
                <Link className="link small" href={`/admin/bookings/${i.bookingId}`}>Open</Link></div>
              {i.partnerPhone ? <a className="btn btn-wa btn-sm mt8" href={waLink(i.partnerPhone, `Hi ${i.partner}, booking for ${fmtDay(i.date)}${i.time ? ` at ${i.time}` : ""}: ${i.title}${i.unit === "PERSON" ? ` for ${i.qty} people` : ""}. Guest: ${i.guest}. Pickup at The Royal Nile Residence.${i.title.toLowerCase().includes("pickup") && i.arrival ? ` Arrival: ${i.arrival}.` : ""} Can you confirm?`)} target="_blank" rel="noopener">Message {i.partner.split(" ")[0]}</a> : null}
            </div>
          )) : <p className="small muted mt16">Everything is arranged. 👌</p>}
          <p className="small muted mt16">Rate used for EGP prices: 1 USD = {st.rates.EGP} EGP</p>
        </div>
      </div>
    </div>
  );
}

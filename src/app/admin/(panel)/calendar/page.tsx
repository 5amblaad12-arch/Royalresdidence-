import Link from "next/link";
import { requireStaff } from "@/lib/auth";
import { bookingsBetween, blocksBetween } from "@/lib/data";
import { isHolding } from "@/lib/availability";
import { addDays, monthName, todayInEgypt, fmtDay } from "@/lib/dates";
import { addBlock, deleteBlock } from "../actions";

export const dynamic = "force-dynamic";
const COLOR: Record<string, string> = { CONFIRMED: "#3C161A", CHECKED_IN: "#2F7D64", COMPLETED: "#B59A94", RECEIPT_SENT: "#8B6D38", AWAITING_DEPOSIT: "#8B6D38", REQUEST: "#C9A06A" };

export default async function CalendarPage({ searchParams }: { searchParams: Promise<{ m?: string; e?: string }> }) {
  await requireStaff();
  const sp = await searchParams;
  const today = todayInEgypt();
  const m = /^\d{4}-\d{2}$/.test(sp.m ?? "") ? sp.m! : today.slice(0, 7);
  const [y, mo] = m.split("-").map(Number);
  const start = `${m}-01`;
  const end = new Date(Date.UTC(y, mo, 1)).toISOString().slice(0, 10);
  const prev = new Date(Date.UTC(y, mo - 2, 1)).toISOString().slice(0, 7);
  const next = end.slice(0, 7);
  const lead = (new Date(start + "T00:00:00Z").getUTCDay() + 6) % 7;
  const gridStart = addDays(start, -lead);
  const cells = Array.from({ length: 42 }, (_, i) => addDays(gridStart, i));
  const [stays, blocks] = await Promise.all([bookingsBetween(cells[0], addDays(cells[41], 1)), blocksBetween(cells[0], addDays(cells[41], 1))]);
  const now = Date.now();
  const live = stays.filter((b) => isHolding(b, now));
  return (
    <div>
      <div className="adm-h"><h1>{monthName(mo - 1)} {y}</h1><span className="spacer" />
        <Link className="btn btn-light btn-sm" href={`/admin/calendar?m=${prev}`}>‹</Link><Link className="btn btn-light btn-sm" href="/admin/calendar">Today</Link><Link className="btn btn-light btn-sm" href={`/admin/calendar?m=${next}`}>›</Link></div>
      <div className="row small" style={{ marginBottom: 12 }}>{[["#3C161A", "Confirmed"], ["#8B6D38", "Receipt to check"], ["#8B6D38", "Held — waiting"], ["#2F7D64", "Checked in"], ["#C9BFB1", "Blocked"]].map(([c, t]) => <span key={t} className="row" style={{ gap: 6 }}><i style={{ width: 12, height: 12, borderRadius: 3, background: c, display: "inline-block" }} />{t}</span>)}</div>
      <div className="mcal">
        {["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].map((d) => <div key={d} className="h">{d}</div>)}
        {cells.map((d) => {
          const night = live.filter((b) => b.checkIn <= d && d < b.checkOut);
          const outs = live.filter((b) => b.checkOut === d);
          const blk = blocks.filter((k) => k.from <= d && d < k.to);
          return (
            <div key={d} className={`${d.slice(0, 7) !== m ? "off" : ""} ${d === today ? "today" : ""}`}>
              <b style={{ color: d < today ? "var(--faint)" : undefined }}>{Number(d.slice(8))}</b>
              {night.map((b) => <Link key={b.id} className="ev" href={`/admin/bookings/${b.id}`} style={{ background: COLOR[b.status] ?? "#777" }} title={`${b.name} · ${b.ref}`}>{b.checkIn === d ? "▶ " : ""}{b.name}</Link>)}
              {outs.map((b) => <div key={`o${b.id}`} className="small muted" style={{ fontSize: 11 }}>↩ {b.name.split(" ")[0]} leaves</div>)}
              {blk.map((k) => <span key={k.id} className="ev" style={{ background: "#C9BFB1" }}>{k.reason || "Blocked"}</span>)}
            </div>
          );
        })}
      </div>

      <div className="adm-2 mt24">
        <div className="card pad">
          <b>Block dates</b><div className="small muted">For maintenance, family use, or bookings you take elsewhere without details. The website won't sell these nights.</div>
          {sp.e ? <div className="msg bad mt8">Check the dates — "to" must be after "from".</div> : null}
          <form action={addBlock} className="f-inline mt16"><input type="hidden" name="m" value={m} />
            <label className="field"><span>From (first night)</span><input type="date" name="from" required /></label>
            <label className="field"><span>To (day it's free again)</span><input type="date" name="to" required /></label>
            <label className="field" style={{ flex: 1 }}><span>Reason</span><input name="reason" placeholder="e.g. Maintenance" /></label>
            <button className="btn btn-navy btn-sm" type="submit">Block</button>
          </form>
        </div>
        <div className="card pad">
          <b>Blocked this view</b>
          {blocks.length ? blocks.map((k) => <form key={k.id} action={deleteBlock} className="row mt8" style={{ padding: "8px 0", borderTop: "1px solid #EEE9E0" }}><input type="hidden" name="bid" value={k.id} /><input type="hidden" name="m" value={m} /><span className="small" style={{ flex: 1 }}>{fmtDay(k.from)} → {fmtDay(k.to)} · {k.reason || "Blocked"}</span><button className="link small" type="submit">Remove</button></form>) : <p className="small muted mt8">No blocked dates.</p>}
        </div>
      </div>
    </div>
  );
}

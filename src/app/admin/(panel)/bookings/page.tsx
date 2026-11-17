import Link from "next/link";
import { requireStaff } from "@/lib/auth";
import { listBookings, STATUS_LABEL, sourceLabel } from "@/lib/data";
import { fmtRange } from "@/lib/dates";
import { usd } from "@/lib/money";
import { STATUS_PILL } from "@/components/ui";

export const dynamic = "force-dynamic";
const TABS = [["upcoming", "Upcoming"], ["action", "Needs action"], ["past", "Past"], ["cancelled", "Cancelled"], ["all", "All"]];

export default async function Bookings({ searchParams }: { searchParams: Promise<{ f?: string; q?: string }> }) {
  await requireStaff();
  const sp = await searchParams;
  const f = TABS.some(([k]) => k === sp.f) ? sp.f! : "upcoming";
  const q = (sp.q ?? "").trim();
  const rows = await listBookings({ filter: f === "all" ? undefined : f, q: q || undefined });
  return (
    <div>
      <div className="adm-h"><h1>Bookings</h1><span className="spacer" /><Link className="btn btn-navy btn-sm" href="/admin/bookings/new">+ New booking</Link></div>
      <div className="row">
        <div className="tabs">{TABS.map(([k, t]) => <Link key={k} href={`/admin/bookings?f=${k}${q ? `&q=${encodeURIComponent(q)}` : ""}`} className={k === f ? "on" : ""}>{t}</Link>)}</div>
        <span className="spacer" />
        <form className="row" action="/admin/bookings"><input type="hidden" name="f" value={f} /><input className="input" name="q" defaultValue={q} placeholder="Search name, ref, phone…" style={{ width: 240, padding: "9px 12px" }} /><button className="btn btn-light btn-sm" type="submit">Search</button></form>
      </div>
      <div className="card mt16 tbl-wrap">
        <table className="tbl">
          <thead><tr><th>Guest</th><th>Dates</th><th>Guests</th><th>Source</th><th>Status</th><th style={{ textAlign: "right" }}>Total</th><th style={{ textAlign: "right" }}>Paid</th></tr></thead>
          <tbody>
            {rows.map((b) => (
              <tr key={b.id}>
                <td><Link href={`/admin/bookings/${b.id}`}><b>{b.name}</b>{!b.seen ? <span className="badge" style={{ marginLeft: 6 }}>NEW</span> : null}<div className="small muted">{b.ref} · {b.phone}</div></Link></td>
                <td className="small">{fmtRange(b.checkIn, b.checkOut)} <span className="muted">({b.nights}n)</span></td>
                <td className="small">{b.guests}</td>
                <td className="small muted">{sourceLabel(b.source)}</td>
                <td><span className={`pill ${STATUS_PILL[b.status]}`}>{STATUS_LABEL[b.status]}</span></td>
                <td className="small" style={{ textAlign: "right" }}>{usd(b.totalUsd)}</td>
                <td className="small" style={{ textAlign: "right", color: b.paid >= b.totalUsd ? "var(--green)" : undefined }}>{usd(b.paid)}</td>
              </tr>
            ))}
            {!rows.length ? <tr><td colSpan={7} className="muted" style={{ padding: 30, textAlign: "center" }}>No bookings here yet.</td></tr> : null}
          </tbody>
        </table>
      </div>
    </div>
  );
}

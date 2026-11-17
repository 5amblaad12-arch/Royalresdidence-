import Link from "next/link";
import { requireStaff } from "@/lib/auth";
import { listPartnerBookings, listSentRequests, STATUS_LABEL } from "@/lib/data";
import { ekReady, ekRequests, ekUrl } from "@/lib/egyptknight";
import { fmtRange } from "@/lib/dates";
import { usd } from "@/lib/money";
import { STATUS_PILL } from "@/components/ui";

export const dynamic = "force-dynamic";

export default async function EgyptKnightPage() {
  await requireStaff();
  const ready = ekReady();
  const [incoming, sent] = await Promise.all([listPartnerBookings(), listSentRequests()]);
  const live = ready ? await ekRequests(sent.map((x) => x.ref)) : null;
  const byRef = new Map((live?.ok ? live.data.requests : []).map((r) => [r.ref, r]));
  return (
    <div>
      <div className="adm-h"><div><h1>Egypt Knight Tours</h1><p className="muted small">Two separate businesses, linked. Egypt Knight can book the residence from its admin; you can book Egypt Knight tours for your guests from any booking.</p></div><span className="spacer" />
        {ready ? <a className="btn btn-light btn-sm" href={`${ekUrl().replace(/\/$/, "")}/admin/corporate`} target="_blank" rel="noopener">Open Egypt Knight admin ↗</a> : null}</div>
      {!ready ? <div className="msg bad">Not connected yet. In the hosting settings add <b>LINK_SECRET</b> (the same long random text on both sites) and <b>EGYPT_KNIGHT_URL</b> (e.g. https://egyptknight.com).</div> : null}

      <div className="card mt16">
        <div className="pad" style={{ paddingBottom: 6 }}><b>Booked by Egypt Knight</b><div className="small muted">Their guests staying at the residence. Price per night is set in Settings &amp; prices.</div></div>
        <div className="tbl-wrap"><table className="tbl">
          <thead><tr><th>Guest</th><th>Dates</th><th>Guests</th><th>Their order</th><th>Status</th><th style={{ textAlign: "right" }}>Total</th><th style={{ textAlign: "right" }}>Paid</th></tr></thead>
          <tbody>{incoming.map((b) => (
            <tr key={b.id}><td><Link href={`/admin/bookings/${b.id}`}><b>{b.name}</b><div className="small muted">{b.ref}</div></Link></td><td className="small">{fmtRange(b.checkIn, b.checkOut)}</td><td className="small">{b.guests}</td><td className="small">{b.partnerRef || "—"}</td>
              <td><span className={`pill ${STATUS_PILL[b.status]}`}>{STATUS_LABEL[b.status]}</span></td><td className="small" style={{ textAlign: "right" }}>{usd(b.totalUsd)}</td><td className="small" style={{ textAlign: "right" }}>{usd(b.paid)}</td></tr>))}
            {!incoming.length ? <tr><td colSpan={7} className="muted small" style={{ padding: 22, textAlign: "center" }}>No bookings from Egypt Knight yet.</td></tr> : null}</tbody>
        </table></div>
      </div>

      <div className="card mt16">
        <div className="pad" style={{ paddingBottom: 6 }}><b>Sent to Egypt Knight</b><div className="small muted">Tours and services you booked with them for your guests, with their live status.</div></div>
        <div className="tbl-wrap"><table className="tbl">
          <thead><tr><th>Request</th><th>For</th><th>What</th><th>Status at Egypt Knight</th><th style={{ textAlign: "right" }}>Their price</th></tr></thead>
          <tbody>{sent.map((x) => { const r = byRef.get(x.ref); return (
            <tr key={x.id}><td className="small"><b>{x.ref}</b><div className="muted">{new Date(x.createdAt).toLocaleDateString("en-GB", { timeZone: "Africa/Cairo", day: "numeric", month: "short" })}</div></td>
              <td className="small"><Link href={`/admin/bookings/${x.bookingId}`}><b>{x.guest}</b> <span className="muted">{x.bookingRef}</span></Link></td>
              <td className="small">{x.summary}</td>
              <td>{r ? <span className={`pill ${r.status === "CONFIRMED" ? "pill-green" : r.status === "CANCELLED" ? "pill-red" : r.status === "COMPLETED" ? "pill-grey" : "pill-amber"}`}>{r.statusLabel}</span> : <span className="pill pill-grey">{live && !live.ok ? "Unavailable" : "—"}</span>}</td>
              <td className="small" style={{ textAlign: "right" }}>{r && r.priceTotal > 0 ? `${r.currency} ${r.priceTotal.toLocaleString("en-US")}` : "—"}</td></tr>); })}
            {!sent.length ? <tr><td colSpan={5} className="muted small" style={{ padding: 22, textAlign: "center" }}>Nothing sent yet. Open a booking and use "Book with Egypt Knight".</td></tr> : null}</tbody>
        </table></div>
        {live && !live.ok ? <p className="small pad" style={{ color: "var(--amber)" }}>{live.error}</p> : null}
      </div>
    </div>
  );
}

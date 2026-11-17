import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { getBookingByToken, getItems, paidUsd } from "@/lib/data";
import { getSettings } from "@/lib/settings";
import { fmtMoney, isCurrency } from "@/lib/money";
import { fmtDay, fmtLong, fmtRange, eachDay, nightsBetween, todayInEgypt } from "@/lib/dates";
import { waLink } from "@/lib/wa";
import { WaIcon } from "@/components/ui";
import ReceiptUpload from "@/components/ReceiptUpload";
import CopyText from "@/components/CopyText";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "My trip", robots: { index: false, follow: false } };

export default async function Trip({ params, searchParams }: { params: Promise<{ token: string }>; searchParams: Promise<Record<string, string | undefined>> }) {
  const { token } = await params; const sp = await searchParams;
  const b = await getBookingByToken(token);
  if (!b) notFound();
  const [st, items, paid] = await Promise.all([getSettings(), getItems(b.id), paidUsd(b.id)]);
  const cur = isCurrency(b.currency) ? b.currency : "USD";
  const m = (u: number) => fmtMoney(u, cur, st.rates);
  const usdAlso = (u: number) => cur === "USD" ? fmtMoney(u) : `${m(u)} (${fmtMoney(u)})`;
  const egp = (u: number) => fmtMoney(u, "EGP", st.rates);
  const first = b.name.split(" ")[0];
  const today = todayInEgypt();
  const toGo = nightsBetween(today, b.checkIn);
  const expired = ["REQUEST", "AWAITING_DEPOSIT"].includes(b.status) && b.holdUntil != null && b.holdUntil < Date.now();
  const holdText = b.holdUntil ? new Date(b.holdUntil).toLocaleString("en-GB", { timeZone: "Africa/Cairo", weekday: "short", day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" }) + " (Aswan time)" : "";
  const balance = Math.max(0, b.totalUsd - paid);
  const summaryMsg = [`Hi! This is ${b.name}. My booking ${b.ref} at The Royal Nile Residence:`, `${fmtRange(b.checkIn, b.checkOut)} · ${b.guests} guests`, ...items.map((i) => `• ${fmtDay(i.date)} — ${i.title}`), `Total ${fmtMoney(b.totalUsd)}`].join("\n");
  const confirmed = ["CONFIRMED", "CHECKED_IN", "COMPLETED"].includes(b.status);

  let title = `You're all set, ${first} 🎉`, sub = "Your stay is confirmed. Everything you need is on this page.";
  if (b.status === "CANCELLED") { title = "This booking was cancelled"; sub = "If this is a mistake, message us on WhatsApp."; }
  else if (expired) { title = `Your hold has ended, ${first}`; sub = "Your dates are no longer held. Message us and we'll check if they're still free."; }
  else if (b.status === "AWAITING_DEPOSIT") { title = `Almost done, ${first}`; sub = `Your dates are held until ${holdText}. Pay the deposit to confirm.`; }
  else if (b.status === "REQUEST") { title = `Thanks, ${first}!`; sub = `Your dates are held until ${holdText}. Send us your booking on WhatsApp and we'll take it from there.`; }
  else if (b.status === "RECEIPT_SENT") { title = `Thank you, ${first}`; sub = "We've got your receipt and are checking it. You'll hear from us on WhatsApp shortly."; }

  return (
    <div>
      <div className="trip-h"><div className="wrap">
        <div className="row"><span className="cap" style={{ color: "var(--gold2)" }}>My trip</span><span className="spacer" /><span className="small" style={{ opacity: .85 }}>Booking {b.ref}</span></div>
        <h1 className="mt16">{title}</h1>
        <p className="mt8" style={{ color: "#C9D6DE", maxWidth: 620 }}>{sub}</p>
        <div className="trip-stats">
          {toGo > 0 && b.status !== "CANCELLED" ? <div><b>{toGo}</b><span>{toGo === 1 ? "day to go" : "days to go"}</span></div> : null}
          <div><b>{b.nights}</b><span>nights</span></div><div><b>{b.guests}</b><span>guests</span></div><div><b>{items.length}</b><span>experiences</span></div>
        </div>
      </div></div>

      <div className="wrap trip-b" style={{ paddingBottom: 60 }}>
        {sp.new ? <div className="ok" style={{ marginBottom: 16, boxShadow: "var(--shadow)" }}>Booking received ✓ Save this page — it's your private trip page (we'll also send the link on WhatsApp).</div> : null}
        <div className="split">
          <div className="stack">
            {(b.status === "AWAITING_DEPOSIT" && !expired) ? (
              <div className="card pad" style={{ boxShadow: "var(--shadow)" }}>
                <div className="cap">Step 1 · Pay the deposit</div>
                <h3 className="mt8">{usdAlso(b.depositUsd)}</h3>
                <p className="small muted mt8">{cur !== "EGP" ? <>≈ {egp(b.depositUsd)} if you pay in Egyptian pounds. </> : null}Write <b>{b.ref}</b> in the transfer note.</p>
                <dl className="kv mt16">
                  {st.instapay ? <><dt>InstaPay</dt><dd><CopyText text={st.instapay} /></dd></> : null}
                  {st.bankDetails ? <><dt>Bank transfer</dt><dd style={{ whiteSpace: "pre-line" }}>{st.bankDetails}</dd></> : null}
                  <dt>Reference</dt><dd><CopyText text={b.ref} /></dd>
                </dl>
                {!st.instapay && !st.bankDetails ? <p className="small mt16">Payment details will be sent to you on WhatsApp.</p> : null}
                {st.paymentNote ? <p className="small muted mt16">{st.paymentNote}</p> : null}
                <div className="cap mt24">Step 2 · Upload your receipt</div>
                <div className="mt16"><ReceiptUpload token={token} /></div>
              </div>
            ) : null}

            {(b.status === "REQUEST" || b.status === "AWAITING_DEPOSIT" || expired) && b.status !== "CANCELLED" ? (
              <div className="card pad">
                <b>{expired ? "Want these dates?" : "Send us your booking on WhatsApp"}</b>
                <p className="small muted mt8">{expired ? "Message us and we'll check right away." : "So we can reply straight away and answer any questions."}</p>
                <a className="btn btn-wa btn-block mt16" href={waLink(st.whatsapp, summaryMsg)} target="_blank" rel="noopener"><WaIcon /> Send on WhatsApp</a>
              </div>
            ) : null}

            {confirmed && st.arrivalInfo ? (
              <div className="card pad" style={{ boxShadow: "var(--shadow)" }}>
                <div className="cap">Arrival</div>
                <p className="mt8" style={{ whiteSpace: "pre-line" }}>{st.arrivalInfo}</p>
              </div>
            ) : null}

            <div className="card pad">
              <h3>Your days</h3>
              <div className="mt8">
                {eachDay(b.checkIn, b.checkOut).map((d, i, all) => {
                  const mine = items.filter((x) => x.date === d && x.status !== "CANCELLED");
                  const label = i === 0 ? `Arrive & check in from ${st.checkInTime}` : i === all.length - 1 ? `Check-out by ${st.checkOutTime}` : "";
                  if (!label && !mine.length) return null;
                  return (
                    <div key={d} className="row" style={{ alignItems: "flex-start", flexWrap: "nowrap", padding: "12px 0", borderTop: "1px solid var(--rule)" }}>
                      <div style={{ width: 80, flex: "none" }} className="small muted"><b>{fmtDay(d)}</b></div>
                      <div style={{ flex: 1 }}>
                        {label ? <div><b>{label}</b></div> : null}
                        {mine.map((x) => <div key={x.id} className={label ? "mt8" : ""}><b>{x.title}</b>{x.unit === "PERSON" ? <span className="muted"> × {x.qty}</span> : null}<div className="small muted">{x.time ? `${x.time} · ` : ""}{x.status === "ARRANGED" || x.status === "DONE" ? "Arranged ✓" : "We'll confirm the time"}{x.note ? ` · ${x.note}` : ""}</div></div>)}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
            <div className="grid2" style={{ gap: 12 }}>
              <Link className="card pad" href="/getting-here" style={{ textDecoration: "none" }}>📍 <b>How to get here</b></Link>
              <a className="card pad" href={waLink(st.whatsapp, `Hi! About my booking ${b.ref}: `)} target="_blank" rel="noopener" style={{ textDecoration: "none" }}>💬 <b>Message us</b></a>
              <Link className="card pad" href="/experiences" style={{ textDecoration: "none" }}>➕ <b>Add more experiences</b></Link>
              <Link className="card pad" href="/terms" style={{ textDecoration: "none" }}>📖 <b>House rules</b></Link>
            </div>
          </div>

          <aside className="stack">
            <div className="card pad" style={{ boxShadow: "var(--shadow)" }}>
              <b>Summary</b>
              <dl className="kv mt16" style={{ gridTemplateColumns: "100px 1fr" }}>
                <dt>Dates</dt><dd>{fmtLong(b.checkIn)} → {fmtLong(b.checkOut)}</dd><dt>Guests</dt><dd>{b.guests}</dd><dt>Name</dt><dd>{b.name}</dd><dt>WhatsApp</dt><dd>{b.phone}</dd>
              </dl>
              <div className="mt16">
                <div className="sum-row"><span>{b.nights} nights</span><span>{m(b.stayUsd)}</span></div>
                {b.cleaningUsd ? <div className="sum-row"><span>Cleaning</span><span>{m(b.cleaningUsd)}</span></div> : null}
                {items.filter((x) => x.status !== "CANCELLED").map((x) => <div key={x.id} className="sum-row small"><span>{x.title}</span><span>{m(x.lineUsd)}</span></div>)}
                <div className="sum-tot"><span>Total</span><span>{m(b.totalUsd)}</span></div>
                <div className="sum-row small"><span>Paid</span><span>{m(paid)}</span></div>
                <div className="sum-row small"><b>Still to pay</b><b>{m(balance)}</b></div>
              </div>
              {cur !== "USD" ? <p className="small muted mt8">Prices in {cur} are approximate; the booking is in US dollars ({fmtMoney(b.totalUsd)}).</p> : null}
            </div>
            <p className="small muted">Keep this link private — anyone with it can see your booking.</p>
          </aside>
        </div>
      </div>
    </div>
  );
}

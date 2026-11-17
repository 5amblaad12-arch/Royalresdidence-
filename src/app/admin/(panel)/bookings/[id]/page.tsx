import Link from "next/link";
import { notFound } from "next/navigation";
import { requireStaff } from "@/lib/auth";
import { run } from "@/lib/db";
import { getBooking, getItems, getPayments, getEvents, listExperiences, listPartners, STATUS_LABEL, SOURCES } from "@/lib/data";
import { getSettings } from "@/lib/settings";
import { fmtDay, fmtLong, eachDay } from "@/lib/dates";
import { usd, fmtMoney } from "@/lib/money";
import { waLink } from "@/lib/wa";
import { siteUrl } from "@/lib/notify";
import { STATUS_PILL } from "@/components/ui";
import { setStatus, extendHold, savePaymentDecision, addPayment, updateItem, addItem, removeItem, updateStay, updateGuest } from "../../actions";

export const dynamic = "force-dynamic";

const NEXT: Record<string, [string, string][]> = {
  REQUEST: [["AWAITING_DEPOSIT", "Waiting for deposit"], ["CONFIRMED", "Confirm booking"]],
  AWAITING_DEPOSIT: [["CONFIRMED", "Confirm booking"]],
  RECEIPT_SENT: [["CONFIRMED", "Confirm booking"]],
  CONFIRMED: [["CHECKED_IN", "Guest checked in"]],
  CHECKED_IN: [["COMPLETED", "Guest checked out"]],
  COMPLETED: [],
  CANCELLED: [["AWAITING_DEPOSIT", "Re-open booking"]],
};

export default async function BookingPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ m?: string }> }) {
  const s = await requireStaff();
  const owner = s.role === "OWNER";
  const { id: idStr } = await params; const { m } = await searchParams;
  const id = Number(idStr);
  const b = await getBooking(id);
  if (!b) notFound();
  if (!b.seen) await run("UPDATE bookings SET seen = 1 WHERE id = ?", [id]);
  const [st, items, payments, events, exps, partners] = await Promise.all([getSettings(), getItems(id), getPayments(id), getEvents(id), listExperiences(false), listPartners()]);
  const paid = payments.filter((p) => p.status === "CONFIRMED").reduce((a, p) => a + p.amountUsd, 0);
  const balance = b.totalUsd - paid;
  const live = items.filter((i) => i.status !== "CANCELLED");
  const margin = live.reduce((a, i) => a + i.lineUsd - i.costUsd, 0);
  const first = b.name.split(" ")[0];
  const trip = `${siteUrl()}/trip/${b.token}`;
  const expired = ["REQUEST", "AWAITING_DEPOSIT"].includes(b.status) && b.holdUntil != null && b.holdUntil < Date.now();
  const pName = (pid: number | null) => partners.find((p) => p.id === pid);
  const msgs: [string, string][] = [
    ["Booking confirmed", `Hi ${first}! Your stay at The Royal Nile Residence is confirmed ✅\n${fmtLong(b.checkIn)} → ${fmtLong(b.checkOut)} · ${b.guests} guests\nYour trip page (times, payment, directions): ${trip}\nWe can't wait to welcome you to Aswan!`],
    ["Payment details", `Hi ${first}! To confirm booking ${b.ref}, please pay the deposit of ${usd(b.depositUsd)} (≈ ${fmtMoney(b.depositUsd, "EGP", st.rates)}).${st.instapay ? `\nInstaPay: ${st.instapay}` : ""}${st.bankDetails ? `\nBank: ${st.bankDetails}` : ""}\nThen upload the receipt here: ${trip}`],
    ["Arrival info", `Hi ${first}! Everything is ready for you on ${fmtDay(b.checkIn)}.\n${st.arrivalInfo || st.address}\nCheck-in from ${st.checkInTime}. Your trip page: ${trip}`],
    ["Ask for a review", `Thank you for staying with us, ${first}! We hope you loved Aswan. If you have a minute, a review helps us a lot: ${st.reviewUrl || trip}`],
  ];

  return (
    <div>
      {m ? <div className={`msg ${/can't|check|overlap|not found|enter|choose/i.test(m) ? "bad" : ""}`}>{m}</div> : null}
      <div className="adm-h">
        <div><Link className="small link" href="/admin/bookings">‹ Bookings</Link><h1>{b.name} <span className="muted" style={{ fontWeight: 500, fontSize: 18 }}>{b.ref}</span></h1>
          <div className="row mt8"><span className={`pill ${STATUS_PILL[b.status]}`}>{STATUS_LABEL[b.status]}</span>{expired ? <span className="pill pill-red">Hold expired — dates are free again</span> : null}{b.holdUntil && !expired ? <span className="small muted">Held until {new Date(b.holdUntil).toLocaleString("en-GB", { timeZone: "Africa/Cairo", day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}</span> : null}<span className="small muted">via {b.source.replace("_", ".").toLowerCase()}</span></div></div>
        <span className="spacer" />
        {(NEXT[b.status] ?? []).map(([st2, t]) => <form key={st2} action={setStatus}><input type="hidden" name="id" value={id} /><input type="hidden" name="status" value={st2} /><button className="btn btn-navy btn-sm" type="submit">{t}</button></form>)}
        {["REQUEST", "AWAITING_DEPOSIT"].includes(b.status) ? <form action={extendHold}><input type="hidden" name="id" value={id} /><button className="btn btn-light btn-sm" type="submit">Hold 24h more</button></form> : null}
        {b.status !== "CANCELLED" && b.status !== "COMPLETED" ? <form action={setStatus}><input type="hidden" name="id" value={id} /><input type="hidden" name="status" value="CANCELLED" /><button className="btn btn-light btn-sm" style={{ color: "var(--red)" }} type="submit">Cancel booking</button></form> : null}
        <a className="btn btn-light btn-sm" href={`/trip/${b.token}`} target="_blank" rel="noopener">Guest's page ↗</a>
      </div>

      <div className="adm-2">
        <div className="stack">
          <div className="card pad">
            <div className="row"><b>Experiences & transfers</b><span className="spacer" /><span className="small muted">{usd(b.extrasUsd)}{owner ? ` · your margin ${usd(margin)}` : ""}</span></div>
            {items.map((i) => {
              const p = pName(i.partnerId);
              return (
                <form key={i.id} action={updateItem} style={{ padding: "12px 0", borderTop: "1px solid #EEE9E0", opacity: i.status === "CANCELLED" ? .5 : 1 }} className="mt8">
                  <input type="hidden" name="id" value={id} /><input type="hidden" name="item" value={i.id} />
                  <div className="row"><b>{fmtDay(i.date)} · {i.title}{i.unit === "PERSON" ? ` × ${i.qty}` : ""}</b><span className="spacer" /><span className="small">{usd(i.lineUsd)}{owner ? <span className="muted"> · cost {usd(i.costUsd)}</span> : null}</span></div>
                  <div className="f-inline mt8">
                    <label className="field"><span>Time</span><input name="time" defaultValue={i.time} style={{ width: 90 }} /></label>
                    <label className="field"><span>Partner</span><select name="partner" defaultValue={i.partnerId ?? ""}><option value="">—</option>{partners.map((x) => <option key={x.id} value={x.id}>{x.name}</option>)}</select></label>
                    <label className="field"><span>Status</span><select name="status" defaultValue={i.status}><option value="TO_ARRANGE">To arrange</option><option value="ARRANGED">Arranged ✓</option><option value="DONE">Done</option><option value="CANCELLED">Cancelled</option></select></label>
                    <label className="field" style={{ flex: 1 }}><span>Note for guest</span><input name="note" defaultValue={i.note} placeholder="e.g. Captain Mostafa, dock below the building" /></label>
                    <button className="btn btn-light btn-sm" type="submit">Save</button>
                    <button className="btn btn-light btn-sm" formAction={removeItem} type="submit" title="Delete">🗑</button>
                  </div>
                  {p?.phone ? <a className="link small mt8" style={{ display: "inline-block" }} href={waLink(p.phone, `Hi ${p.name}, booking for ${fmtDay(i.date)}${i.time ? ` at ${i.time}` : ""}: ${i.title}${i.unit === "PERSON" ? ` for ${i.qty} people` : ""}. Guest: ${b.name}${b.phone ? ` (${b.phone})` : ""}. Pickup at The Royal Nile Residence.${i.title.toLowerCase().includes("pickup") && b.arrival ? ` Arrival: ${b.arrival}.` : ""} Can you confirm?`)} target="_blank" rel="noopener">WhatsApp {p.name} with the details →</a> : null}
                </form>
              );
            })}
            <form action={addItem} className="f-inline mt16" style={{ paddingTop: 14, borderTop: "1px solid #EEE9E0" }}>
              <input type="hidden" name="id" value={id} />
              <label className="field"><span>Add experience</span><select name="experience" required>{exps.map((e) => <option key={e.id} value={e.id}>{e.title} — {usd(e.priceUsd)}</option>)}</select></label>
              <label className="field"><span>Day</span><select name="date">{eachDay(b.checkIn, b.checkOut).map((d) => <option key={d} value={d}>{fmtDay(d)}</option>)}</select></label>
              <label className="field"><span>People</span><input name="qty" type="number" min={1} max={b.guests} defaultValue={b.guests} style={{ width: 80 }} /></label>
              <label className="field"><span>Price each (blank = usual)</span><input name="price" type="number" step="0.01" style={{ width: 110 }} /></label>
              <button className="btn btn-navy btn-sm" type="submit">Add</button>
            </form>
          </div>

          <div className="card pad">
            <div className="row"><b>Payments</b><span className="spacer" /><span className="small">Paid <b>{usd(paid)}</b> of {usd(b.totalUsd)} · {balance > 0 ? <b style={{ color: "var(--amber)" }}>{usd(balance)} to collect</b> : balance < 0 ? <b>overpaid {usd(-balance)}</b> : <b style={{ color: "var(--green)" }}>fully paid</b>}</span></div>
            {payments.map((p) => (
              <div key={p.id} className="row mt8" style={{ padding: "10px 0", borderTop: "1px solid #EEE9E0" }}>
                <div style={{ flex: 1 }}><b className="small">{usd(p.amountUsd)} · {p.method.toLowerCase()}</b> <span className={`pill ${p.status === "CONFIRMED" ? "pill-green" : p.status === "PENDING" ? "pill-amber" : "pill-red"}`}>{p.status.toLowerCase()}</span>
                  <div className="small muted">{new Date(p.createdAt).toLocaleString("en-GB", { timeZone: "Africa/Cairo", day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}{p.note ? ` · ${p.note}` : ""}</div></div>
                {p.receiptId ? <a className="btn btn-light btn-sm" href={`/api/admin/receipt/${p.receiptId}`} target="_blank" rel="noopener">View receipt</a> : null}
                {p.status === "PENDING" ? <form action={savePaymentDecision} className="row" style={{ gap: 6 }}><input type="hidden" name="id" value={id} /><input type="hidden" name="pid" value={p.id} />
                  <input className="input" name="amount" type="number" step="0.01" defaultValue={p.amountUsd} style={{ width: 100, padding: "7px 9px" }} title="Amount received (USD)" />
                  <button className="btn btn-navy btn-sm" name="decision" value="confirm" type="submit">Confirm</button><button className="btn btn-light btn-sm" name="decision" value="reject" type="submit">Reject</button></form> : null}
              </div>
            ))}
            <form action={addPayment} className="f-inline mt16" style={{ paddingTop: 14, borderTop: "1px solid #EEE9E0" }}>
              <input type="hidden" name="id" value={id} />
              <label className="field"><span>Amount (USD)</span><input name="amount" type="number" step="0.01" required style={{ width: 110 }} /></label>
              <label className="field"><span>How</span><select name="method"><option value="CASH">Cash</option><option value="INSTAPAY">InstaPay</option><option value="TRANSFER">Bank transfer</option><option value="CARD">Card</option><option value="AGENCY">Agency / platform</option><option value="REFUND">Refund (money out)</option></select></label>
              <label className="field" style={{ flex: 1 }}><span>Note</span><input name="note" placeholder="e.g. paid in EGP 12,000 on arrival" /></label>
              <button className="btn btn-navy btn-sm" type="submit">Record</button>
            </form>
          </div>

          <div className="card pad">
            <b>Message {first} on WhatsApp</b>
            <div className="row mt16">{msgs.map(([t, txt]) => <a key={t} className="btn btn-wa btn-sm" href={waLink(b.phone, txt)} target="_blank" rel="noopener">{t}</a>)}</div>
            {!b.phone ? <p className="small muted mt8">Add the guest's WhatsApp number below to use these.</p> : null}
          </div>
        </div>

        <div className="stack">
          <form action={updateStay} className="card pad">
            <input type="hidden" name="id" value={id} />
            <b>Stay</b>
            <div className="grid2 mt16" style={{ gap: 10 }}>
              <label className="field"><span>Check-in</span><input type="date" name="checkIn" defaultValue={b.checkIn} /></label>
              <label className="field"><span>Check-out</span><input type="date" name="checkOut" defaultValue={b.checkOut} /></label>
              <label className="field"><span>Guests</span><input type="number" name="guests" min={1} max={20} defaultValue={b.guests} /></label>
              <label className="field"><span>Per night (USD)</span><input type="number" step="0.01" name="nightly" defaultValue={b.nightlyUsd} /></label>
              <label className="field"><span>Cleaning (USD)</span><input type="number" step="0.01" name="cleaning" defaultValue={b.cleaningUsd} /></label>
              <label className="field"><span>Deposit (USD)</span><input type="number" step="0.01" name="deposit" defaultValue={b.depositUsd} /></label>
            </div>
            <div className="mt16 small"><div className="sum-row"><span>{b.nights} nights</span><span>{usd(b.stayUsd)}</span></div><div className="sum-row"><span>Experiences</span><span>{usd(b.extrasUsd)}</span></div>{b.cleaningUsd ? <div className="sum-row"><span>Cleaning</span><span>{usd(b.cleaningUsd)}</span></div> : null}<div className="sum-tot" style={{ fontSize: 16 }}><span>Total</span><span>{usd(b.totalUsd)}</span></div></div>
            <button className="btn btn-light btn-sm mt16" type="submit">Save stay</button>
          </form>

          <form action={updateGuest} className="card pad">
            <input type="hidden" name="id" value={id} />
            <div className="row"><b>Guest</b><span className="spacer" />{b.phone ? <a className="link small" href={waLink(b.phone, `Hi ${first}! `)} target="_blank" rel="noopener">WhatsApp</a> : null}{b.email ? <a className="link small" href={`mailto:${b.email}`}>Email</a> : null}</div>
            <div className="stack mt16">
              <label className="field"><span>Name</span><input name="name" defaultValue={b.name} /></label>
              <label className="field"><span>WhatsApp</span><input name="phone" defaultValue={b.phone} /></label>
              <label className="field"><span>Email</span><input name="email" defaultValue={b.email} /></label>
              <label className="field"><span>Country</span><input name="country" defaultValue={b.country} /></label>
              <label className="field"><span>Arrival</span><input name="arrival" defaultValue={b.arrival} /></label>
              <label className="field"><span>Came from</span><select name="source" defaultValue={b.source}>{SOURCES.map((x) => <option key={x} value={x}>{x.replace("_", ".").toLowerCase()}</option>)}</select></label>
              <label className="field"><span>Guest's message</span><textarea name="notes" defaultValue={b.notes} /></label>
              <label className="field"><span>Team notes (private)</span><textarea name="staffNotes" defaultValue={b.staffNotes} /></label>
            </div>
            <button className="btn btn-light btn-sm mt16" type="submit">Save guest</button>
          </form>

          <div className="card pad">
            <b>History</b>
            {events.map((e, k) => <div key={k} className="small mt8"><span className="muted">{new Date(e.at).toLocaleString("en-GB", { timeZone: "Africa/Cairo", day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}</span> · {e.text}</div>)}
            <div className="small muted mt8">Booked {new Date(b.createdAt).toLocaleString("en-GB", { timeZone: "Africa/Cairo" })} · currency shown to guest: {b.currency}</div>
          </div>
        </div>
      </div>
    </div>
  );
}

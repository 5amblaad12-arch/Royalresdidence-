import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { getBookingByToken, getItems, paidUsd, listExperiences } from "@/lib/data";
import { getSettings } from "@/lib/settings";
import { fmtMoney, isCurrency } from "@/lib/money";
import { fmtDay, fmtLong, fmtRange, eachDay, nightsBetween, todayInEgypt, weekday } from "@/lib/dates";
import { waLink } from "@/lib/wa";
import { WaIcon } from "@/components/ui";
import ReceiptUpload from "@/components/ReceiptUpload";
import CopyText from "@/components/CopyText";
import { Confetti, Countdown, ShareTrip } from "@/components/TripFx";
import { documentLinks } from "@/lib/documents";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "My trip", robots: { index: false, follow: false } };

const DAY_PHOTO = ["/photos/balcony.webp", "/photos/feluccas.webp", "/photos/panorama.webp", "/photos/westbank.webp", "/photos/dome.webp", "/photos/twin_wide.webp"];

export default async function Trip({ params, searchParams }: { params: Promise<{ token: string }>; searchParams: Promise<Record<string, string | undefined>> }) {
  const { token } = await params; const sp = await searchParams;
  const b = await getBookingByToken(token);
  if (!b) notFound();
  const [st, items, paid, exps, docs] = await Promise.all([getSettings(), getItems(b.id), paidUsd(b.id), listExperiences(false), documentLinks(b)]);
  const img = new Map(exps.map((e) => [e.id, e.image]));
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
  const live = items.filter((i) => i.status !== "CANCELLED");
  const confirmed = ["CONFIRMED", "CHECKED_IN", "COMPLETED"].includes(b.status);
  const cancelled = b.status === "CANCELLED";
  const site = (process.env.NEXT_PUBLIC_SITE_URL ?? "").replace(/\/$/, "");
  const summaryMsg = [`Hi! This is ${b.name}. My booking ${b.ref} at The Royal Nile Residence:`, `${fmtRange(b.checkIn, b.checkOut)} · ${b.guests} guests`, ...live.map((i) => `• ${fmtDay(i.date)} — ${i.title}`), `Total ${fmtMoney(b.totalUsd)}`].join("\n");
  const directions = `https://www.google.com/maps/dir/?api=1&destination=${st.mapLat},${st.mapLng}`;

  // Headline for each situation
  let kicker = "Booking confirmed", title = <>Aswan is waiting<br />for you, <i>{first}</i></>, sub = "Everything is set. This page has your days, your times and how to find us — keep it handy.";
  if (cancelled) { kicker = "Booking cancelled"; title = <>This booking was cancelled</>; sub = "If this is a mistake, message us on WhatsApp and we'll sort it out."; }
  else if (expired) { kicker = "Hold ended"; title = <>Your dates are no longer held, {first}</>; sub = "Message us and we'll check right away if they're still free."; }
  else if (b.status === "AWAITING_DEPOSIT") { kicker = sp.new ? "Booking received 🎉" : "One step left"; title = <>Almost there, <i>{first}</i>!</>; sub = `Your dates are held until ${holdText}. Pay the deposit below and Aswan is yours.`; }
  else if (b.status === "REQUEST") { kicker = sp.new ? "Booking received 🎉" : "Dates on hold"; title = <>Your Aswan trip is taking shape, <i>{first}</i></>; sub = `Your dates are held until ${holdText}. Send us your booking on WhatsApp and we'll take it from there.`; }
  else if (b.status === "RECEIPT_SENT") { kicker = "Receipt received"; title = <>Thank you, <i>{first}</i>!</>; sub = "We're checking your payment now — you'll hear from us on WhatsApp very soon."; }
  else if (b.status === "CHECKED_IN") { kicker = "Welcome"; title = <>Welcome to Aswan, <i>{first}</i></>; sub = "We hope you love it. Need anything? We're one message away."; }
  else if (b.status === "COMPLETED") { kicker = "Thank you"; title = <>Thank you for staying with us, <i>{first}</i></>; sub = "We hope Aswan was everything you wanted. Come back soon."; }

  // The 4-step tracker
  const s2Done = paid > 0 || confirmed, s3Done = confirmed, s4Done = ["CHECKED_IN", "COMPLETED"].includes(b.status);
  const track = [
    { t: "Booked", d: fmtDay(new Date(b.createdAt).toISOString().slice(0, 10)), done: true },
    { t: b.status === "REQUEST" ? "Chat on WhatsApp" : b.status === "RECEIPT_SENT" ? "Checking payment" : "Deposit", d: s2Done ? "Received" : b.status === "RECEIPT_SENT" ? "In progress" : "Next step", done: s2Done, now: !s2Done && !cancelled },
    { t: "Confirmed", d: s3Done ? "All set" : "After deposit", done: s3Done, now: s2Done && !s3Done },
    { t: "Aswan!", d: fmtDay(b.checkIn), done: s4Done, now: s3Done && !s4Done },
  ];
  const doneCount = track.filter((x) => x.done).length;
  const celebrate = !cancelled && !expired && (!!sp.new || confirmed);

  return (
    <div className="tp">
      <Confetti id={`${b.ref}-${confirmed ? "c" : "n"}`} fire={celebrate} />

      <section className="tp-hero">
        <img className="tp-hero-img" src="/photos/feluccas.webp" alt="" />
        <div className="wrap tp-hero-in">
          <div className="tp-top"><span className="tp-kicker">{!cancelled && !expired ? <svg className="tp-check" viewBox="0 0 52 52" aria-hidden="true"><circle cx="26" cy="26" r="24" /><path d="M15 27l7 7 15-16" /></svg> : null}{kicker}</span><span className="tp-ref">Booking <b>{b.ref}</b></span></div>
          <h1 className="tp-title">{title}</h1>
          <p className="tp-sub">{sub}</p>
          {!cancelled && toGo > 0 ? <Countdown checkIn={b.checkIn} time={st.checkInTime} /> : null}
          {!cancelled ? <div className="tp-actions">
            <a className="tp-btn" href={`/trip/${token}/calendar`} download>📅 Add to calendar</a>
            <ShareTrip title="Our trip to Aswan" text={`We're going to Aswan! ${fmtRange(b.checkIn, b.checkOut)} at The Royal Nile Residence — a private apartment on the Nile.`} url={site || "https://theroyalnileresidence.com"} />
            <a className="tp-btn tp-btn-wa" href={waLink(st.whatsapp, `Hi! About my booking ${b.ref}: `)} target="_blank" rel="noopener"><WaIcon size={16} /> Message us</a>
          </div> : null}
        </div>
      </section>

      <div className="wrap tp-body">
        {!cancelled ? (
          <div className="tp-track" style={{ ["--p" as string]: `${((doneCount - 1) / 3) * 100}%` }}>
            <div className="tp-track-bar"><span /></div>
            {track.map((x, i) => <div key={i} className={`tp-step ${x.done ? "done" : ""} ${x.now ? "now" : ""}`} style={{ ["--i" as string]: i }}><i>{x.done ? "✓" : i + 1}</i><b>{x.t}</b><small>{x.d}</small></div>)}
          </div>
        ) : null}

        <div className="tp-grid">
          <div className="tp-col">
            {sp.new ? <div className="tp-note">💡 Save this page — it's your private trip page. We'll also send you the link on WhatsApp.</div> : null}

            {b.status === "AWAITING_DEPOSIT" && !expired ? (
              <div className="tp-card tp-pay">
                <div className="tp-pay-h"><div><span className="tp-label">Pay the deposit</span><div className="tp-amount">{usdAlso(b.depositUsd)}</div>{cur !== "EGP" ? <small>≈ {egp(b.depositUsd)} if you pay in Egyptian pounds</small> : null}</div><span className="tp-timer">⏳ Held until<br /><b>{holdText.replace(" (Aswan time)", "")}</b></span></div>
                <ol className="tp-paysteps">
                  <li><b>Send the deposit</b>
                    <dl className="kv mt8">
                      {st.instapay ? <><dt>InstaPay</dt><dd><CopyText text={st.instapay} /></dd></> : null}
                      {st.bankDetails ? <><dt>Bank transfer</dt><dd style={{ whiteSpace: "pre-line" }}>{st.bankDetails}</dd></> : null}
                      <dt>Reference</dt><dd><CopyText text={b.ref} /></dd>
                    </dl>
                    {!st.instapay && !st.bankDetails ? <p className="small mt8">We'll send the payment details on WhatsApp.</p> : null}
                    {st.paymentNote ? <p className="small muted mt8">{st.paymentNote}</p> : null}
                  </li>
                  <li><b>Upload the receipt</b><div className="mt8"><ReceiptUpload token={token} /></div></li>
                  <li><b>We confirm</b><p className="small muted">Usually within a few hours — your page updates and we message you.</p></li>
                </ol>
              </div>
            ) : null}

            {(b.status === "REQUEST" || b.status === "AWAITING_DEPOSIT" || expired) && !cancelled ? (
              <div className="tp-card tp-wa">
                <div><b>{expired ? "Still want these dates?" : "Send us your booking on WhatsApp"}</b><p className="small muted">{expired ? "We'll check right away." : "So we can reply straight away and answer any questions."}</p></div>
                <a className="btn btn-wa" href={waLink(st.whatsapp, summaryMsg)} target="_blank" rel="noopener"><WaIcon /> Send on WhatsApp</a>
              </div>
            ) : null}

            {confirmed && st.arrivalInfo ? <div className="tp-card tp-arrive"><span className="tp-label">🔑 Arrival details</span><p className="mt8" style={{ whiteSpace: "pre-line" }}>{st.arrivalInfo}</p></div> : null}

            <div className="tp-card">
              <div className="tp-card-h"><h2>Your days in Aswan</h2><span>{b.nights} nights · {live.length} {live.length === 1 ? "experience" : "experiences"}</span></div>
              <ol className="tp-days">
                {eachDay(b.checkIn, b.checkOut).map((d, i, all) => {
                  const mine = live.filter((x) => x.date === d);
                  const head = i === 0 ? `Arrival · check-in from ${st.checkInTime}` : i === all.length - 1 ? `Check-out by ${st.checkOutTime}` : mine.length ? `Day ${i + 1}` : `Day ${i + 1} · free to explore`;
                  return (
                    <li key={d} className="tp-day" style={{ ["--i" as string]: i }}>
                      <div className="tp-day-d"><small>{weekday(d)}</small><b>{Number(d.slice(8))}</b></div>
                      <div className="tp-day-b">
                        <div className="tp-day-t">{head}</div>
                        {mine.length ? mine.map((x) => (
                          <div key={x.id} className="tp-item">
                            <img src={(x.experienceId && img.get(x.experienceId)) || DAY_PHOTO[i % DAY_PHOTO.length]} alt="" loading="lazy" />
                            <div><b>{x.title}{x.unit === "PERSON" ? <span> × {x.qty}</span> : null}</b><small>{x.time ? `${x.time}` : "Time to be confirmed"}{x.note ? ` · ${x.note}` : ""}</small></div>
                            <span className={`tp-chip ${x.status === "ARRANGED" || x.status === "DONE" ? "ok" : ""}`}>{x.status === "ARRANGED" || x.status === "DONE" ? "Arranged ✓" : "Being arranged"}</span>
                          </div>
                        )) : i === 0 ? <div className="tp-free"><img src="/photos/balcony.webp" alt="" loading="lazy" /><span>Settle in and watch the sunset from your balcony 🌅</span></div> : null}
                      </div>
                    </li>
                  );
                })}
              </ol>
              {!cancelled ? <Link className="tp-addmore" href="/experiences">+ Want more? See all Aswan experiences</Link> : null}
            </div>
          </div>

          <aside className="tp-col tp-side">
            <div className="tp-card tp-sum">
              <img src="/photos/twin_wide.webp" alt="" />
              <div className="tp-sum-b">
                <b className="tp-sum-t">The Royal Nile Residence</b>
                <div className="tp-dates"><div><small>Check-in</small><b>{fmtDay(b.checkIn)}</b><span>from {st.checkInTime}</span></div><div><small>Check-out</small><b>{fmtDay(b.checkOut)}</b><span>by {st.checkOutTime}</span></div></div>
                <div className="tp-lines">
                  <div><span>{b.nights} nights · {b.guests} guests</span><span>{m(b.stayUsd)}</span></div>
                  {b.cleaningUsd ? <div><span>Cleaning</span><span>{m(b.cleaningUsd)}</span></div> : null}
                  {live.map((x) => <div key={x.id} className="small"><span>{x.title}</span><span>{m(x.lineUsd)}</span></div>)}
                </div>
                <div className="tp-tot"><span>Total</span><b>{m(b.totalUsd)}</b></div>
                <div className="tp-paid"><div><span>Paid</span><b>{m(paid)}</b></div><div><span>On arrival</span><b>{m(balance)}</b></div></div>
                {cur !== "USD" ? <p className="small muted mt8">Shown in {cur}; the booking is in US dollars ({fmtMoney(b.totalUsd)}).</p> : null}
              </div>
            </div>
            <div className="tp-card tp-docs">
              <span className="tp-label">📄 Your documents</span>
              <ul>
                {docs.map((d) => (
                  <li key={d.key}>
                    <a href={d.href} target="_blank" rel="noopener"><i aria-hidden="true">PDF</i><span>{d.label}</span></a>
                    <a className="tp-dl" href={`${d.href}?download=1`} aria-label={`Download ${d.label}`} title="Download">↓</a>
                  </li>
                ))}
              </ul>
              <p className="small muted">Receipts appear here as soon as we confirm each payment.</p>
            </div>
            <div className="tp-card tp-map">
              <span className="tp-label">📍 Finding us</span>
              <p className="small mt8">{st.address}</p>
              <div className="row mt16"><a className="btn btn-navy btn-sm" href={directions} target="_blank" rel="noopener">Directions ↗</a><Link className="btn btn-light btn-sm" href="/getting-here">Getting here</Link></div>
            </div>
            <div className="tp-card small muted">Booked for <b style={{ color: "var(--ink)" }}>{b.name}</b> · {b.phone}<br />Dates: {fmtLong(b.checkIn)} → {fmtLong(b.checkOut)}<br />Keep this link private — anyone with it can see your booking. <Link className="link" href="/terms">House rules</Link></div>
          </aside>
        </div>
      </div>
    </div>
  );
}

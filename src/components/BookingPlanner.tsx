"use client";
import { useEffect, useMemo, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { quote, stayProblems, unitQty, type PriceRules, type Unit } from "@/lib/pricing";
import { fmtMoney, type Currency, type Rates } from "@/lib/money";
import { eachDay, eachNight, fmtDay, fmtRange, monthName, nightsBetween, weekday } from "@/lib/dates";
import { waLink } from "@/lib/wa";

type Exp = { id: number; slug: string; title: string; summary: string; duration: string; timeHint: string; image: string; priceUsd: number; costUsd: number; unit: Unit; partnerId: null };
type Extra = { key: string; experienceId: number; date: string; qty: number };
type Props = { today: string; taken: string[]; initial: { checkIn: string; checkOut: string; guests: number }; currency: Currency; rates: Rates; rules: PriceRules; holdHours: number; whatsapp: string; experiences: Exp[] };

const ym = (iso: string) => iso.slice(0, 7);
function addMonths(m: string, n: number) { const [y, mo] = m.split("-").map(Number); const d = new Date(Date.UTC(y, mo - 1 + n, 1)); return d.toISOString().slice(0, 7); }

function Month({ month, today, taken, checkIn, checkOut, pickOut, onPick }: { month: string; today: string; taken: Set<string>; checkIn: string; checkOut: string; pickOut: boolean; onPick: (d: string) => void }) {
  const [y, m] = month.split("-").map(Number);
  const first = new Date(Date.UTC(y, m - 1, 1));
  const lead = (first.getUTCDay() + 6) % 7; // Monday first
  const days = new Date(Date.UTC(y, m, 0)).getUTCDate();
  const cells: (string | null)[] = [...Array(lead).fill(null), ...Array.from({ length: days }, (_, i) => `${month}-${String(i + 1).padStart(2, "0")}`)];
  return (
    <div>
      <div className="cal-h"><b>{monthName(m - 1)} {y}</b></div>
      <div className="cal-w">{["M", "T", "W", "T", "F", "S", "S"].map((d, i) => <span key={i}>{d}</span>)}</div>
      <div className="cal-d">
        {cells.map((d, i) => {
          if (!d) return <span key={i} />;
          const past = d < today;
          const isTaken = taken.has(d);
          // While choosing check-out, a taken day can still be the check-out day if every night before it is free.
          const okAsOut = pickOut && d > checkIn && eachNight(checkIn, d).every((x) => !taken.has(x));
          const disabled = past || (isTaken && !okAsOut);
          const edge = d === checkIn || d === checkOut;
          const inside = checkIn && checkOut && d > checkIn && d < checkOut;
          return <button key={d} type="button" disabled={disabled} className={`${isTaken ? "taken" : ""} ${edge ? "edge" : inside ? "in" : ""}`} onClick={() => onPick(d)} aria-label={`${fmtDay(d)}${isTaken ? " (booked)" : ""}`} aria-pressed={!!edge}>{Number(d.slice(8))}</button>;
        })}
      </div>
    </div>
  );
}

export default function BookingPlanner(p: Props) {
  const router = useRouter();
  const taken = useMemo(() => new Set(p.taken), [p.taken]);
  const byId = useMemo(() => new Map(p.experiences.map((e) => [e.id, e])), [p.experiences]);
  const bySlug = useMemo(() => new Map(p.experiences.map((e) => [e.slug, e])), [p.experiences]);
  const [step, setStep] = useState(1);
  const [checkIn, setIn] = useState(p.initial.checkIn);
  const [checkOut, setOut] = useState(p.initial.checkOut);
  const [guests, setGuests] = useState(p.initial.guests);
  const [month, setMonth] = useState(ym(p.initial.checkIn || p.today));
  const [extras, setExtras] = useState<Extra[]>([]);
  const [suggested, setSuggested] = useState(false);
  const [picker, setPicker] = useState<string | null>(null);
  const [f, setF] = useState({ name: "", phone: "", email: "", country: "", arrival: "", notes: "", website: "" });
  const [pay, setPay] = useState<"TRANSFER" | "WHATSAPP">("TRANSFER");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const money = (usd: number) => fmtMoney(usd, p.currency, p.rates);

  const hasDates = !!checkIn && !!checkOut;
  const problems = hasDates ? stayProblems({ checkIn, checkOut, guests, today: p.today, rules: p.rules }) : [];
  const free = hasDates && eachNight(checkIn, checkOut).every((d) => !taken.has(d));
  const days = hasDates ? eachDay(checkIn, checkOut) : [];
  const q = hasDates ? quote({ checkIn, checkOut, guests, rules: p.rules, catalog: p.experiences, extras: extras.map((x) => ({ experienceId: x.experienceId, date: x.date, qty: x.qty })) }) : null;

  // Dates changed: drop planned trips that now fall outside the stay.
  useEffect(() => {
    if (!hasDates) return;
    const ok = new Set(eachDay(checkIn, checkOut));
    setExtras((xs) => xs.filter((x) => ok.has(x.date)));
  }, [checkIn, checkOut, hasDates]);
  useEffect(() => { window.scrollTo({ top: 0, behavior: "smooth" }); }, [step]);

  function pickDay(d: string) {
    setErr("");
    if (!checkIn || checkOut || d <= checkIn) { setIn(d); setOut(""); return; }
    if (!eachNight(checkIn, d).every((x) => !taken.has(x))) { setErr("Some nights in between are already booked. Please choose other dates."); setIn(d); setOut(""); return; }
    setOut(d);
  }

  function suggest() {
    if (suggested || extras.length) { setSuggested(true); return; }
    const nights = nightsBetween(checkIn, checkOut);
    const plan: [string, number][] = [["airport-pickup", 0], ["sunset-felucca", 1], ["philae-temple", 2]];
    const xs: Extra[] = [];
    for (const [slug, i] of plan) {
      const e = bySlug.get(slug);
      if (e && i < Math.max(1, nights)) xs.push({ key: `${slug}-${i}`, experienceId: e.id, date: days[Math.min(i, days.length - 1)], qty: guests });
    }
    setExtras(xs); setSuggested(true);
  }

  function next() {
    setErr("");
    if (step === 1) {
      if (!hasDates) return setErr("Please choose your check-in and check-out dates.");
      if (problems.length) return setErr(problems[0]);
      if (!free) return setErr("Some of those nights are booked. Please choose other dates.");
      suggest(); setStep(2);
    } else if (step === 2) setStep(3);
  }

  async function submit(e: FormEvent) {
    e.preventDefault(); setErr("");
    if (f.name.trim().length < 2) return setErr("Please enter your full name.");
    if (f.phone.replace(/\D/g, "").length < 7) return setErr("Please enter your WhatsApp number with country code.");
    setBusy(true);
    try {
      const r = await fetch("/api/bookings", { method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ checkIn, checkOut, guests, extras: extras.map((x) => ({ experienceId: x.experienceId, date: x.date, qty: x.qty })), ...f, payMethod: pay, currency: p.currency }) });
      const j = await r.json().catch(() => ({}));
      if (!r.ok || !j.token) { setErr(j.error || "Something went wrong. Please try again, or message us on WhatsApp."); setBusy(false); return; }
      router.push(`/trip/${j.token}?new=1`);
    } catch { setErr("No connection. Please check your internet and try again."); setBusy(false); }
  }

  const hint = (d: string, i: number) => {
    if (i === 0) return "Arriving by plane or train? Add a pickup";
    if (d === checkOut) return "Joining a cruise? Add a drop-off";
    return ["Abu Simbel? Best with an early start", "Nubian village visit", "Tombs of the Nobles at sunset", "Nubian home dinner"][i % 4];
  };

  const summary = q ? (
    <div className="card" style={{ overflow: "hidden", boxShadow: "var(--shadow)" }}>
      <img src="/photos/twin_wide.webp" alt="" style={{ height: 120, width: "100%", objectFit: "cover" }} />
      <div className="pad">
        <b>Your Aswan trip</b>
        <div className="small muted">{fmtRange(checkIn, checkOut)} · {guests} {guests > 1 ? "guests" : "guest"}</div>
        <div className="mt16">
          <div className="sum-row"><span>{q.nights} nights × {money(p.rules.nightlyUsd)}</span><span>{money(q.stayUsd)}</span></div>
          {q.cleaningUsd ? <div className="sum-row"><span>Cleaning</span><span>{money(q.cleaningUsd)}</span></div> : null}
          {q.lines.map((l, i) => <div key={i} className="sum-row small"><span>{l.title}{l.unit === "PERSON" ? ` × ${l.qty}` : ""} <span className="muted">· {fmtDay(l.date)}</span></span><span>{money(l.lineUsd)}</span></div>)}
          <div className="sum-tot"><span>Total</span><span>{money(q.totalUsd)}</span></div>
          <div className="sum-row small muted"><span>Deposit to confirm ({p.rules.depositPct}%)</span><span>{money(q.depositUsd)}</span></div>
        </div>
      </div>
    </div>
  ) : null;

  return (
    <div className="wrap planner has-sticky">
      <div className="row"><div><div className="small muted" style={{ fontWeight: 700, letterSpacing: ".06em" }}>STEP {step} OF 3</div><h1 style={{ fontSize: "clamp(30px,4vw,42px)" }}>{step === 1 ? "Pick your dates" : step === 2 ? "Plan your Aswan" : "Confirm your booking"}</h1></div>
        <span className="spacer" />{step > 1 ? <button className="btn btn-light btn-sm" type="button" onClick={() => setStep(step - 1)}>‹ Back</button> : null}</div>
      <div className="steps">{[1, 2, 3].map((i) => <i key={i} className={i <= step ? "on" : ""} />)}</div>

      <div className="p-grid mt24">
        <div>
          {step === 1 && (
            <div>
              <div className="card pad">
                <div className="row" style={{ marginBottom: 14 }}>
                  <button className="cal-nav" type="button" disabled={month <= ym(p.today)} onClick={() => setMonth(addMonths(month, -1))} aria-label="Previous month">‹</button>
                  <span className="spacer" />
                  <span className="small muted">{checkIn && !checkOut ? "Now pick your check-out day" : "Pick your check-in day"}</span>
                  <span className="spacer" />
                  <button className="cal-nav" type="button" disabled={month >= addMonths(ym(p.today), 12)} onClick={() => setMonth(addMonths(month, 1))} aria-label="Next month">›</button>
                </div>
                <div className="cals">
                  {[0, 1].map((k) => <Month key={k} month={addMonths(month, k)} today={p.today} taken={taken} checkIn={checkIn} checkOut={checkOut} pickOut={!!checkIn && !checkOut} onPick={pickDay} />)}
                </div>
                <div className="small muted mt16"><s>12</s> = already booked · minimum stay {p.rules.minNights} nights</div>
              </div>
              <div className="card pad mt16 row">
                <div><b>Guests</b><div className="small muted">Up to {p.rules.maxGuests} · 3 bedrooms</div></div><span className="spacer" />
                <div className="stepper"><button type="button" disabled={guests <= 1} onClick={() => setGuests(guests - 1)} aria-label="Fewer guests">−</button><b style={{ minWidth: 20, textAlign: "center" }}>{guests}</b><button type="button" disabled={guests >= p.rules.maxGuests} onClick={() => setGuests(guests + 1)} aria-label="More guests">+</button></div>
              </div>
            </div>
          )}

          {step === 2 && (
            <div>
              <div className="tip"><span>✨</span><span>We made a plan for {guests} {guests > 1 ? "guests" : "guest"}. Change anything you like — or skip it. Prices are local rates, booked by us.</span></div>
              <div className="mt16">
                {days.map((d, i) => {
                  const mine = extras.filter((x) => x.date === d);
                  return (
                    <div key={d} className="day">
                      <div className={`day-n ${i === 0 ? "first" : ""}`}><small>{weekday(d).toUpperCase()}</small><b>{Number(d.slice(8))}</b></div>
                      <div>
                        <div className="small muted" style={{ marginBottom: 6 }}>{i === 0 ? "Arrival day" : d === checkOut ? "Check-out day" : `Day ${i + 1}`}</div>
                        {mine.map((x) => {
                          const e = byId.get(x.experienceId); if (!e) return null;
                          const qty = unitQty(e.unit, guests, x.qty);
                          return (
                            <div key={x.key} className="slot">
                              <img src={e.image} alt="" />
                              <div className="slot-t"><b>{e.title}</b><span>{e.timeHint ? `${e.timeHint} · ` : ""}{e.duration}</span>
                                {e.unit === "PERSON" && guests > 1 ? <div className="small" style={{ marginTop: 4 }}>
                                  <select className="input" style={{ padding: "4px 8px", width: "auto", fontSize: 13 }} value={qty} onChange={(ev) => setExtras((xs) => xs.map((y) => y.key === x.key ? { ...y, qty: Number(ev.target.value) } : y))} aria-label="People">
                                    {Array.from({ length: guests }, (_, k) => <option key={k} value={k + 1}>{k + 1} {k ? "people" : "person"}</option>)}
                                  </select></div> : null}
                              </div>
                              <b style={{ fontSize: 14 }}>{money(qty * e.priceUsd)}</b>
                              <button type="button" className="x" onClick={() => setExtras((xs) => xs.filter((y) => y.key !== x.key))} aria-label={`Remove ${e.title}`}>×</button>
                            </div>
                          );
                        })}
                        <button type="button" className="add" onClick={() => setPicker(d)}>+ {mine.length ? "Add something else" : hint(d, i)}</button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {step === 3 && (
            <form id="details" onSubmit={submit} noValidate>
              <div className="card pad">
                <h3>Your details</h3>
                <div className="grid2 mt16" style={{ gap: 14 }}>
                  <label className="field"><span>Full name *</span><input value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} autoComplete="name" required maxLength={80} /></label>
                  <label className="field"><span>WhatsApp number *</span><input value={f.phone} onChange={(e) => setF({ ...f, phone: e.target.value })} autoComplete="tel" inputMode="tel" placeholder="+44 7700 900123" required maxLength={30} /></label>
                  <label className="field"><span>Email (optional)</span><input type="email" value={f.email} onChange={(e) => setF({ ...f, email: e.target.value })} autoComplete="email" maxLength={120} /></label>
                  <label className="field"><span>Country</span><input value={f.country} onChange={(e) => setF({ ...f, country: e.target.value })} autoComplete="country-name" maxLength={60} /></label>
                  <label className="field" style={{ gridColumn: "1 / -1" }}><span>How are you arriving? (flight / train / cruise and time)</span><input value={f.arrival} onChange={(e) => setF({ ...f, arrival: e.target.value })} placeholder="e.g. Flight MS 0095, lands 13:40" maxLength={120} /></label>
                  <label className="field" style={{ gridColumn: "1 / -1" }}><span>Anything we should know?</span><textarea value={f.notes} onChange={(e) => setF({ ...f, notes: e.target.value })} maxLength={1000} placeholder="Celebrations, children's ages, dietary needs…" /></label>
                  <label className="hp" aria-hidden="true">Website<input tabIndex={-1} autoComplete="off" value={f.website} onChange={(e) => setF({ ...f, website: e.target.value })} /></label>
                </div>
              </div>
              <div className="card pad mt16">
                <h3>How would you like to confirm?</h3>
                <div className="stack mt16">
                  <label className="choice"><input type="radio" name="pay" checked={pay === "TRANSFER"} onChange={() => setPay("TRANSFER")} />
                    <div><b>Pay the {money(q?.depositUsd ?? 0)} deposit</b><div className="small muted">By InstaPay or bank transfer — details on the next page. Upload the receipt and we confirm. The rest is paid on arrival.</div></div></label>
                  <label className="choice"><input type="radio" name="pay" checked={pay === "WHATSAPP"} onChange={() => setPay("WHATSAPP")} />
                    <div><b>Talk to us on WhatsApp first</b><div className="small muted">We hold your dates for {p.holdHours} hours while we chat.</div></div></label>
                </div>
                <p className="small muted mt16">By booking you agree to our <a className="link" href="/terms" target="_blank">booking terms & house rules</a>.</p>
              </div>
              <div className="mt16 lg-hide">{summary}</div>
            </form>
          )}
          {err ? <div className="err mt16" role="alert">{err}</div> : null}
        </div>
        <aside className="p-side">{summary ?? <div className="card pad"><b>Your Aswan trip</b><p className="small muted mt8">Choose your dates to see the price.</p><p className="small mt16"><a className="link" href={waLink(p.whatsapp, "Hi! I'd like to ask about availability.")} target="_blank" rel="noopener">Questions? WhatsApp us</a></p></div>}</aside>
      </div>

      {picker ? (
        <div className="sheet-bg" onClick={() => setPicker(null)} role="dialog" aria-modal="true" aria-label="Add an experience">
          <div className="sheet" onClick={(e) => e.stopPropagation()}>
            <div className="row"><div><div className="small muted">{fmtDay(picker)}</div><h3>Add to your day</h3></div><span className="spacer" /><button type="button" className="x" onClick={() => setPicker(null)} aria-label="Close">×</button></div>
            {p.experiences.filter((e) => !extras.some((x) => x.date === picker && x.experienceId === e.id)).map((e) => (
              <button key={e.id} type="button" className="pick" onClick={() => { setExtras((xs) => [...xs, { key: `${e.id}-${picker}-${Date.now()}`, experienceId: e.id, date: picker, qty: guests }]); setPicker(null); }}>
                <img src={e.image} alt="" />
                <div style={{ flex: 1 }}><b>{e.title}</b><div className="small muted">{e.summary}</div><div className="small mt8">{e.duration}{e.timeHint ? ` · ${e.timeHint}` : ""}</div></div>
                <div style={{ textAlign: "right" }}><b>{money(e.priceUsd)}</b><div className="small muted">{e.unit === "GROUP" ? "per car" : "/ person"}</div></div>
              </button>
            ))}
          </div>
        </div>
      ) : null}

      <div className="bar"><div className="wrap">
        <div style={{ minWidth: 0 }}>
          {q ? <><div className="small muted">{fmtRange(checkIn, checkOut)} · {guests} {guests > 1 ? "guests" : "guest"}{extras.length ? ` · ${extras.length} ${extras.length > 1 ? "experiences" : "experience"}` : ""}</div>
            <div style={{ fontSize: 20 }}><b>{money(q.totalUsd)}</b> {step === 1 ? (free && !problems.length ? <span className="small" style={{ color: "var(--green)", fontWeight: 700 }}>● Available</span> : <span className="small" style={{ color: "var(--red)", fontWeight: 700 }}>{problems[0] ?? "Not available"}</span>) : null}</div></>
            : <div className="small muted">{checkIn ? `Check-in ${fmtDay(checkIn)} — now pick check-out` : "Choose your dates"}</div>}
        </div>
        <span className="spacer" />
        {step < 3 ? <>
          {step === 2 ? <button className="btn btn-light hide-s" type="button" onClick={() => { setExtras([]); setStep(3); }}>Skip</button> : null}
          <button className="btn btn-navy" type="button" onClick={next} disabled={step === 1 && (!hasDates || !free || problems.length > 0)}>Continue</button></>
          : <button className="btn btn-navy" type="submit" form="details" disabled={busy}>{busy ? "Booking…" : pay === "WHATSAPP" ? "Hold my dates" : "Book & see payment details"}</button>}
      </div></div>
    </div>
  );
}


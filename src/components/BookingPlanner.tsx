"use client";
// The booking wizard: 1) dates & guests  2) plan your days in Aswan  3) details & confirm.
// Prices are recalculated on the server when the booking is sent; here they're shown live.
import { useEffect, useMemo, useRef, useState, type FormEvent, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { quote, stayProblems, unitQty, type PriceRules, type Unit } from "@/lib/pricing";
import { fmtMoney, type Currency, type Rates } from "@/lib/money";
import { eachDay, eachNight, fmtDay, fmtRange, monthName, nightsBetween, weekday } from "@/lib/dates";
import { waLink } from "@/lib/wa";
import { CATEGORY_LABEL } from "@/lib/content";

type Exp = { id: number; slug: string; title: string; summary: string; duration: string; timeHint: string; image: string; category: string; priceUsd: number; costUsd: number; unit: Unit; partnerId: null };
type Extra = { key: string; experienceId: number; date: string; qty: number };
type Props = { today: string; taken: string[]; windows: { checkIn: string; checkOut: string }[]; initial: { checkIn: string; checkOut: string; guests: number }; currency: Currency; rates: Rates; rules: PriceRules; holdHours: number; whatsapp: string; experiences: Exp[] };

const STEPS = ["Dates", "Your days", "Confirm"];
const CODES: [string, string][] = [["+44", "🇬🇧 UK"], ["+1", "🇺🇸 US / CA"], ["+49", "🇩🇪 DE"], ["+33", "🇫🇷 FR"], ["+39", "🇮🇹 IT"], ["+34", "🇪🇸 ES"], ["+31", "🇳🇱 NL"], ["+61", "🇦🇺 AU"], ["+20", "🇪🇬 EG"], ["+966", "🇸🇦 SA"], ["+971", "🇦🇪 AE"], ["+249", "🇸🇩 SD"], ["+86", "🇨🇳 CN"], ["+81", "🇯🇵 JP"], ["+7", "🇷🇺 RU"], ["+", "🌍 Other"]];
const ARRIVE: [string, string, string][] = [["plane", "✈️", "Plane"], ["train", "🚆", "Train"], ["cruise", "⛴️", "Nile cruise"], ["car", "🚗", "Car"], ["unsure", "🤷", "Not sure yet"]];

const ym = (iso: string) => iso.slice(0, 7);
function addMonths(m: string, n: number) { const [y, mo] = m.split("-").map(Number); return new Date(Date.UTC(y, mo - 1 + n, 1)).toISOString().slice(0, 7); }

/** Smoothly counts a number up/down when it changes. */
function useTween(value: number, ms = 450) {
  const [v, setV] = useState(value); const from = useRef(value); const shown = useRef(value);
  useEffect(() => {
    if (typeof window === "undefined" || window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) { setV(value); shown.current = value; return; }
    from.current = shown.current; const start = performance.now(); let raf = 0;
    const tick = (t: number) => { const k = Math.min(1, (t - start) / ms); const e = 1 - Math.pow(1 - k, 3); const x = from.current + (value - from.current) * e; shown.current = x; setV(x); if (k < 1) raf = requestAnimationFrame(tick); };
    raf = requestAnimationFrame(tick); return () => cancelAnimationFrame(raf);
  }, [value, ms]);
  return v;
}

function Month(p: { month: string; today: string; taken: Set<string>; checkIn: string; checkOut: string; hover: string; onHover: (d: string) => void; onPick: (d: string) => void }) {
  const [y, m] = p.month.split("-").map(Number);
  const lead = (new Date(Date.UTC(y, m - 1, 1)).getUTCDay() + 6) % 7;
  const days = new Date(Date.UTC(y, m, 0)).getUTCDate();
  const cells: (string | null)[] = [...Array(lead).fill(null), ...Array.from({ length: days }, (_, i) => `${p.month}-${String(i + 1).padStart(2, "0")}`)];
  const picking = !!p.checkIn && !p.checkOut;
  const end = p.checkOut || (picking && p.hover > p.checkIn ? p.hover : "");
  return (
    <div className="bk-month">
      <div className="bk-month-t">{monthName(m - 1)} <span>{y}</span></div>
      <div className="bk-wd">{["Mo", "Tu", "We", "Th", "Fr", "Sa", "Su"].map((d) => <span key={d}>{d}</span>)}</div>
      <div className="bk-days" onMouseLeave={() => p.onHover("")}>
        {cells.map((d, i) => {
          if (!d) return <span key={i} />;
          const past = d < p.today, isTaken = p.taken.has(d);
          const okAsOut = picking && d > p.checkIn && eachNight(p.checkIn, d).every((x) => !p.taken.has(x));
          const disabled = past || (isTaken && !okAsOut);
          const isStart = d === p.checkIn, isEnd = !!end && d === end;
          const inside = !!p.checkIn && !!end && d > p.checkIn && d < end;
          const cls = ["bk-d", isTaken && !okAsOut && !past ? "is-taken" : "", isStart ? "is-start" : "", isEnd ? "is-end" : "", inside ? "is-in" : "", isStart && end ? "has-end" : "", !p.checkOut && picking && (inside || isEnd) ? "is-preview" : "", d === p.today ? "is-today" : ""].filter(Boolean).join(" ");
          return (
            <button key={d} type="button" className={cls} disabled={disabled} onMouseEnter={() => p.onHover(d)} onFocus={() => p.onHover(d)} onClick={() => p.onPick(d)}
              aria-label={`${fmtDay(d)}${isTaken ? ", booked" : ""}${isStart ? ", check-in" : ""}${isEnd ? ", check-out" : ""}`} aria-pressed={isStart || isEnd}>
              <span>{Number(d.slice(8))}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

function Qty({ value, max, onChange, label }: { value: number; max: number; onChange: (n: number) => void; label: string }) {
  return (
    <span className="bk-qty" aria-label={label}>
      <button type="button" onClick={() => onChange(Math.max(1, value - 1))} disabled={value <= 1} aria-label="One fewer">−</button>
      <b>{value}</b>
      <button type="button" onClick={() => onChange(Math.min(max, value + 1))} disabled={value >= max} aria-label="One more">+</button>
    </span>
  );
}

export default function BookingPlanner(p: Props) {
  const router = useRouter();
  const taken = useMemo(() => new Set(p.taken), [p.taken]);
  const byId = useMemo(() => new Map(p.experiences.map((e) => [e.id, e])), [p.experiences]);
  const bySlug = useMemo(() => new Map(p.experiences.map((e) => [e.slug, e])), [p.experiences]);
  const cats = useMemo(() => [...new Set(p.experiences.map((e) => e.category))], [p.experiences]);
  const [step, setStep] = useState(1);
  const [checkIn, setIn] = useState(p.initial.checkIn);
  const [checkOut, setOut] = useState(p.initial.checkOut);
  const [hover, setHover] = useState("");
  const [guests, setGuests] = useState(p.initial.guests);
  const [month, setMonth] = useState(ym(p.initial.checkIn || p.today));
  const [extras, setExtras] = useState<Extra[]>([]);
  const [suggested, setSuggested] = useState(false);
  const [picker, setPicker] = useState<string | null>(null);
  const [pickCat, setPickCat] = useState("all");
  const [f, setF] = useState({ name: "", code: "+44", phone: "", email: "", country: "", arriveBy: "plane", arriveTime: "", arriveInfo: "", notes: "", website: "" });
  const [pay, setPay] = useState<"TRANSFER" | "WHATSAPP">("TRANSFER");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const [bad, setBad] = useState<Record<string, boolean>>({});
  const [sheet, setSheet] = useState(false);
  const money = (usd: number) => fmtMoney(usd, p.currency, p.rates);

  const hasDates = !!checkIn && !!checkOut;
  const problems = hasDates ? stayProblems({ checkIn, checkOut, guests, today: p.today, rules: p.rules }) : [];
  const free = hasDates && eachNight(checkIn, checkOut).every((d) => !taken.has(d));
  const ok1 = hasDates && free && !problems.length;
  const days = hasDates ? eachDay(checkIn, checkOut) : [];
  const q = hasDates ? quote({ checkIn, checkOut, guests, rules: p.rules, catalog: p.experiences, extras: extras.map((x) => ({ experienceId: x.experienceId, date: x.date, qty: x.qty })) }) : null;
  const total = useTween(q?.totalUsd ?? 0);

  useEffect(() => {
    if (!hasDates) return;
    const ok = new Set(eachDay(checkIn, checkOut));
    setExtras((xs) => xs.filter((x) => ok.has(x.date)));
  }, [checkIn, checkOut, hasDates]);
  useEffect(() => { window.scrollTo({ top: 0, behavior: "smooth" }); setSheet(false); }, [step]);
  useEffect(() => { document.body.style.overflow = picker || sheet ? "hidden" : ""; return () => { document.body.style.overflow = ""; }; }, [picker, sheet]);
  useEffect(() => {
    if (!picker) return;
    const k = (e: KeyboardEvent) => { if (e.key === "Escape") setPicker(null); };
    window.addEventListener("keydown", k); return () => window.removeEventListener("keydown", k);
  }, [picker]);

  function pickDay(d: string) {
    setErr("");
    if (!checkIn || checkOut || d <= checkIn) { setIn(d); setOut(""); return; }
    if (!eachNight(checkIn, d).every((x) => !taken.has(x))) { setErr("Some nights in between are booked — pick other dates."); setIn(d); setOut(""); return; }
    setOut(d);
  }
  function addExtra(e: Exp, date: string) { setExtras((xs) => [...xs, { key: `${e.id}-${date}-${Math.random().toString(36).slice(2, 7)}`, experienceId: e.id, date, qty: guests }]); }

  function suggest() {
    if (suggested || extras.length) { setSuggested(true); return; }
    const nights = nightsBetween(checkIn, checkOut);
    const plan: [string, number][] = [["airport-pickup", 0], ["sunset-felucca", 1], ["philae-temple", 2]];
    const xs: Extra[] = [];
    for (const [slug, i] of plan) { const e = bySlug.get(slug); if (e && i < Math.max(1, nights)) xs.push({ key: `${slug}-${i}`, experienceId: e.id, date: days[Math.min(i, days.length - 1)], qty: guests }); }
    setExtras(xs); setSuggested(true);
  }
  function go(n: number) {
    setErr("");
    if (n >= 2 && step === 1) {
      if (!hasDates) return setErr("Choose your check-in and check-out days.");
      if (problems.length) return setErr(problems[0]);
      if (!free) return setErr("Some of those nights are booked. Please choose other dates.");
      suggest();
    }
    if (n > step + 1) return;
    setStep(n);
  }

  /** One idea for an empty day, so it can be added in a single tap. */
  function ideaFor(d: string, i: number): Exp | null {
    const used = new Set(extras.map((x) => x.experienceId));
    const want = i === 0 ? ["airport-pickup"] : d === checkOut ? ["cruise-dropoff", "airport-pickup"] : ["abu-simbel", "nubian-village", "tombs-of-the-nobles", "nubian-dinner", "sunset-felucca", "philae-temple"];
    for (const s of want) { const e = bySlug.get(s); if (e && (!used.has(e.id) || e.unit === "GROUP" && !extras.some((x) => x.experienceId === e.id && x.date === d))) return e; }
    return null;
  }

  async function submit(e?: FormEvent) {
    e?.preventDefault(); setErr("");
    const nb: Record<string, boolean> = {};
    if (f.name.trim().length < 2) nb.name = true;
    if (f.phone.replace(/\D/g, "").length < 6) nb.phone = true;
    if (f.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(f.email)) nb.email = true;
    setBad(nb);
    if (Object.keys(nb).length) { setErr(nb.name ? "Please enter your full name." : nb.phone ? "Please enter your WhatsApp number." : "That email doesn't look right."); return; }
    const phone = f.phone.trim().startsWith("+") ? f.phone.trim() : `${f.code === "+" ? "+" : f.code + " "}${f.phone.trim().replace(/^0+/, "")}`;
    const by = ARRIVE.find((a) => a[0] === f.arriveBy)?.[2] ?? "";
    const arrival = [by !== "Not sure yet" ? by : "", f.arriveInfo.trim(), f.arriveTime ? `around ${f.arriveTime}` : ""].filter(Boolean).join(" · ");
    setBusy(true);
    try {
      const r = await fetch("/api/bookings", { method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ checkIn, checkOut, guests, extras: extras.map((x) => ({ experienceId: x.experienceId, date: x.date, qty: x.qty })), name: f.name, phone, email: f.email, country: f.country, arrival, notes: f.notes, website: f.website, payMethod: pay, currency: p.currency }) });
      const j = await r.json().catch(() => ({}));
      if (!r.ok || !j.token) { setErr(j.error || "Something went wrong. Please try again, or message us on WhatsApp."); setBusy(false); return; }
      router.push(`/trip/${j.token}?new=1`);
    } catch { setErr("No connection. Please check your internet and try again."); setBusy(false); }
  }

  const primary = step === 1 ? { label: ok1 ? "Continue — plan your days" : "Continue", on: () => go(2), off: !ok1 }
    : step === 2 ? { label: extras.length ? "Continue — your details" : "Continue without trips", on: () => go(3), off: false }
      : { label: busy ? "Booking…" : pay === "WHATSAPP" ? "Hold my dates" : "Book & see how to pay", on: () => submit(), off: busy };

  const tripCard: ReactNode = (
    <div className="bk-card">
      <div className="bk-card-img"><img src="/photos/twin_wide.webp" alt="" /><div><small>The Royal Nile Residence</small><b>Your Aswan trip</b></div></div>
      <div className="bk-card-b">
        <div className="bk-dates">
          <div className={!checkIn ? "empty" : ""}><small>Check-in</small><b>{checkIn ? fmtDay(checkIn) : "Add date"}</b></div>
          <span aria-hidden="true">→</span>
          <div className={!checkOut ? "empty" : ""}><small>Check-out</small><b>{checkOut ? fmtDay(checkOut) : "Add date"}</b></div>
        </div>
        <div className="bk-meta">{q ? `${q.nights} ${q.nights > 1 ? "nights" : "night"} · ` : ""}{guests} {guests > 1 ? "guests" : "guest"} · whole apartment</div>
        {q ? (
          <>
            {q.lines.length ? <ul className="bk-plan">{q.lines.map((l, i) => <li key={i}><span>{fmtDay(l.date)}</span><b>{l.title}{l.unit === "PERSON" ? ` × ${l.qty}` : ""}</b><em>{money(l.lineUsd)}</em></li>)}</ul> : null}
            <div className="bk-lines">
              <div><span>{q.nights} × {money(p.rules.nightlyUsd)}</span><span>{money(q.stayUsd)}</span></div>
              {q.cleaningUsd ? <div><span>Cleaning</span><span>{money(q.cleaningUsd)}</span></div> : null}
              {q.extrasUsd ? <div><span>Experiences</span><span>{money(q.extrasUsd)}</span></div> : null}
            </div>
            <div className="bk-total"><span>Total</span><b>{money(Math.round(total))}</b></div>
            <div className="bk-dep">Deposit to confirm ({p.rules.depositPct}%) <b>{money(q.depositUsd)}</b><br />The rest is paid on arrival.</div>
          </>
        ) : <p className="bk-hint">Pick your dates to see the price.</p>}
        <button className="btn btn-navy btn-block bk-cta-d" type="button" onClick={primary.on} disabled={primary.off}>{primary.label} <span aria-hidden="true">→</span></button>
        <ul className="bk-trust"><li>✓ Whole apartment, just for you</li><li>✓ Trips at local prices</li><li>✓ A real person on <a href={waLink(p.whatsapp, "Hi! I have a question before booking.")} target="_blank" rel="noopener">WhatsApp</a></li></ul>
      </div>
    </div>
  );

  return (
    <div className="bk">
      <div className="bk-top"><div className="wrap">
        <ol className="bk-steps">
          {STEPS.map((s, i) => {
            const n = i + 1; const done = n < step;
            return <li key={s} className={n === step ? "on" : done ? "done" : ""}><button type="button" onClick={() => go(n)} disabled={n > step + 1 || (n === step + 1 && step === 1 && !ok1)}><span>{done ? "✓" : n}</span>{s}</button></li>;
          })}
        </ol>
      </div></div>

      <div className="wrap bk-grid">
        <div className="bk-main" key={step}>
          {step === 1 && (
            <section>
              <h1 className="bk-h">When are you coming?</h1>
              <p className="bk-sub">The whole apartment is yours — pick your nights. Booked days are crossed out.</p>
              {p.windows.length ? <div className="bk-chips"><span>Next free</span>{p.windows.map((w) => <button key={w.checkIn} type="button" className={w.checkIn === checkIn && w.checkOut === checkOut ? "on" : ""} onClick={() => { setIn(w.checkIn); setOut(w.checkOut); setMonth(ym(w.checkIn)); setErr(""); }}>{fmtRange(w.checkIn, w.checkOut)}</button>)}</div> : null}
              <div className="bk-panel">
                <div className="bk-cal-nav">
                  <button type="button" className="bk-arrow" disabled={month <= ym(p.today)} onClick={() => setMonth(addMonths(month, -1))} aria-label="Previous month">‹</button>
                  <div className="bk-cal-hint">{!checkIn || checkOut ? "Select your check-in day" : "Now select your check-out day"}</div>
                  <button type="button" className="bk-arrow" disabled={month >= addMonths(ym(p.today), 12)} onClick={() => setMonth(addMonths(month, 1))} aria-label="Next month">›</button>
                </div>
                <div className="bk-cals">{[0, 1].map((k) => <Month key={k} month={addMonths(month, k)} today={p.today} taken={taken} checkIn={checkIn} checkOut={checkOut} hover={hover} onHover={setHover} onPick={pickDay} />)}</div>
                <div className="bk-sel">
                  {hasDates ? <><b>{fmtDay(checkIn)} → {fmtDay(checkOut)}</b> · {nightsBetween(checkIn, checkOut)} nights {ok1 ? <span className="bk-ok">✓ Available</span> : <span className="bk-no">{problems[0] ?? "Not available"}</span>}<button type="button" className="link small" onClick={() => { setIn(""); setOut(""); }}>Clear</button></>
                    : <span className="muted">Minimum stay {p.rules.minNights} nights · check-in from the afternoon</span>}
                </div>
              </div>
              <div className="bk-panel bk-guests">
                <div><b>Who's coming?</b><small>Up to {p.rules.maxGuests} guests · 1 king room + 2 twin rooms</small></div>
                <div className="bk-people">{Array.from({ length: p.rules.maxGuests }, (_, i) => <button key={i} type="button" className={i < guests ? "on" : ""} onClick={() => setGuests(i + 1)} aria-label={`${i + 1} guests`}>👤</button>)}</div>
                <Qty value={guests} max={p.rules.maxGuests} onChange={setGuests} label="Guests" />
              </div>
            </section>
          )}

          {step === 2 && (
            <section>
              <h1 className="bk-h">Plan your days in Aswan</h1>
              <p className="bk-sub">We've started a plan for {guests} {guests > 1 ? "guests" : "guest"}. Add, remove or change anything — we book it at local prices.</p>
              <ol className="bk-timeline">
                {days.map((d, i) => {
                  const mine = extras.filter((x) => x.date === d);
                  const idea = mine.length ? null : ideaFor(d, i);
                  const label = i === 0 ? "Arrival day" : d === checkOut ? "Check-out day" : `Day ${i + 1}`;
                  return (
                    <li key={d} className="bk-day" style={{ ["--i" as string]: i }}>
                      <div className="bk-day-dot"><small>{weekday(d)}</small><b>{Number(d.slice(8))}</b></div>
                      <div className="bk-day-b">
                        <div className="bk-day-t">{label}<span>{fmtDay(d)}</span></div>
                        {mine.map((x) => {
                          const e = byId.get(x.experienceId); if (!e) return null;
                          const qty = unitQty(e.unit, guests, x.qty);
                          return (
                            <div key={x.key} className="bk-slot">
                              <img src={e.image} alt="" />
                              <div className="bk-slot-t"><b>{e.title}</b><small>{e.timeHint ? `${e.timeHint} · ` : ""}{e.duration}<span className="bk-slot-pm"> · {money(qty * e.priceUsd)}</span></small>
                                {e.unit === "PERSON" && guests > 1 ? <div className="bk-slot-q"><Qty value={qty} max={guests} onChange={(n) => setExtras((xs) => xs.map((y) => y.key === x.key ? { ...y, qty: n } : y))} label="People" /><small>{qty > 1 ? "people" : "person"}</small></div> : null}
                              </div>
                              <b className="bk-slot-p">{money(qty * e.priceUsd)}</b>
                              <button type="button" className="bk-x" onClick={() => setExtras((xs) => xs.filter((y) => y.key !== x.key))} aria-label={`Remove ${e.title}`}>×</button>
                            </div>
                          );
                        })}
                        <div className="bk-day-add">
                          {idea ? <button type="button" className="bk-idea" onClick={() => addExtra(idea, d)}><img src={idea.image} alt="" /><span><small>Idea</small>{idea.title}</span><em>+ {money(idea.priceUsd)}</em></button> : null}
                          <button type="button" className="bk-more" onClick={() => { setPickCat("all"); setPicker(d); }}>{mine.length || idea ? "+ More" : "+ Add something"}</button>
                        </div>
                      </div>
                    </li>
                  );
                })}
              </ol>
            </section>
          )}

          {step === 3 && (
            <form id="bk-form" onSubmit={submit} noValidate>
              <h1 className="bk-h">Almost there</h1>
              <p className="bk-sub">We'll send your private trip page and talk to you on WhatsApp.</p>
              <div className="bk-panel">
                <h3 className="bk-ph">Your details</h3>
                <div className="bk-fields">
                  <label className={`bk-f wide ${bad.name ? "bad" : ""}`}><input placeholder=" " value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} autoComplete="name" maxLength={80} /><span>Full name</span></label>
                  <div className={`bk-f bk-phone wide ${bad.phone ? "bad" : ""}`}>
                    <select value={f.code} onChange={(e) => setF({ ...f, code: e.target.value })} aria-label="Country code">{CODES.map(([c, l]) => <option key={l} value={c}>{l} {c !== "+" ? c : ""}</option>)}</select>
                    <label><input placeholder=" " value={f.phone} onChange={(e) => setF({ ...f, phone: e.target.value })} autoComplete="tel-national" inputMode="tel" maxLength={24} /><span>WhatsApp number</span></label>
                  </div>
                  <label className={`bk-f ${bad.email ? "bad" : ""}`}><input type="email" placeholder=" " value={f.email} onChange={(e) => setF({ ...f, email: e.target.value })} autoComplete="email" maxLength={120} /><span>Email (optional)</span></label>
                  <label className="bk-f"><input placeholder=" " value={f.country} onChange={(e) => setF({ ...f, country: e.target.value })} autoComplete="country-name" maxLength={60} /><span>Country</span></label>
                  <label className="hp" aria-hidden="true">Website<input tabIndex={-1} autoComplete="off" value={f.website} onChange={(e) => setF({ ...f, website: e.target.value })} /></label>
                </div>
              </div>
              <div className="bk-panel">
                <h3 className="bk-ph">How are you arriving?</h3>
                <div className="bk-seg" role="radiogroup" aria-label="Arriving by">{ARRIVE.map(([k, ic, l]) => <button key={k} type="button" role="radio" aria-checked={f.arriveBy === k} className={f.arriveBy === k ? "on" : ""} onClick={() => setF({ ...f, arriveBy: k })}><span>{ic}</span>{l}</button>)}</div>
                {f.arriveBy !== "unsure" ? <div className="bk-fields mt16">
                  <label className="bk-f"><input placeholder=" " value={f.arriveInfo} onChange={(e) => setF({ ...f, arriveInfo: e.target.value })} maxLength={60} /><span>{f.arriveBy === "plane" ? "Flight number" : f.arriveBy === "train" ? "Train (e.g. from Luxor)" : f.arriveBy === "cruise" ? "Boat name" : "Coming from"}</span></label>
                  <label className="bk-f"><input type="time" placeholder=" " value={f.arriveTime} onChange={(e) => setF({ ...f, arriveTime: e.target.value })} /><span>Arrival time</span></label>
                </div> : null}
                <label className="bk-f wide mt16"><textarea placeholder=" " value={f.notes} onChange={(e) => setF({ ...f, notes: e.target.value })} maxLength={1000} rows={3} /><span>Anything we should know? (celebrations, children's ages…)</span></label>
              </div>
              <div className="bk-panel">
                <h3 className="bk-ph">How would you like to confirm?</h3>
                <div className="bk-pay">
                  <label className={pay === "TRANSFER" ? "on" : ""}><input type="radio" name="pay" checked={pay === "TRANSFER"} onChange={() => setPay("TRANSFER")} />
                    <span className="bk-pay-ic">💳</span><span><b>Pay the {money(q?.depositUsd ?? 0)} deposit</b><small>InstaPay or bank transfer. Upload the receipt and you're confirmed. The rest on arrival.</small></span><em>Fastest</em></label>
                  <label className={pay === "WHATSAPP" ? "on" : ""}><input type="radio" name="pay" checked={pay === "WHATSAPP"} onChange={() => setPay("WHATSAPP")} />
                    <span className="bk-pay-ic">💬</span><span><b>Talk to us on WhatsApp first</b><small>We hold your dates for {p.holdHours} hours while we chat.</small></span></label>
                </div>
                <p className="small muted mt16">By booking you agree to our <a className="link" href="/terms" target="_blank">booking terms & house rules</a>.</p>
              </div>
              <button type="submit" hidden />
            </form>
          )}
          {err ? <div className="err mt16 bk-err" role="alert">{err}</div> : null}
          <div className="bk-backrow">{step > 1 ? <button type="button" className="btn btn-light btn-sm" onClick={() => setStep(step - 1)}>‹ Back</button> : <span />}{step === 2 ? <button type="button" className="link small" onClick={() => { setExtras([]); setStep(3); }}>Skip — just the apartment</button> : null}</div>
        </div>

        <aside className="bk-side">{tripCard}</aside>
      </div>

      {/* phone bar + expandable trip sheet */}
      <div className="bk-bar"><div className="wrap">
        <button type="button" className="bk-bar-sum" onClick={() => setSheet(true)} disabled={!q}>
          {q ? <><small>{fmtRange(checkIn, checkOut)} · {guests} {guests > 1 ? "guests" : "guest"}</small><b>{money(Math.round(total))} <span>Details ⌃</span></b></> : <><small>{checkIn ? `Check-in ${fmtDay(checkIn)}` : "Your Aswan trip"}</small><b className="muted" style={{ fontSize: 15 }}>{checkIn ? "Pick check-out" : "Choose dates"}</b></>}
        </button>
        <button type="button" className="btn btn-navy" onClick={primary.on} disabled={primary.off}>{step === 3 ? (busy ? "Booking…" : pay === "WHATSAPP" ? "Hold dates" : "Book") : "Continue"}</button>
      </div></div>
      {sheet ? <div className="bk-sheet-bg" onClick={() => setSheet(false)}><div className="bk-sheet" onClick={(e) => e.stopPropagation()} role="dialog" aria-modal="true" aria-label="Trip details"><button type="button" className="bk-x bk-sheet-x" onClick={() => setSheet(false)} aria-label="Close">×</button>{tripCard}</div></div> : null}

      {picker ? (
        <div className="bk-sheet-bg" onClick={() => setPicker(null)}>
          <div className="bk-picker" onClick={(e) => e.stopPropagation()} role="dialog" aria-modal="true" aria-label="Add an experience">
            <div className="bk-picker-h"><div><small>{fmtDay(picker)}</small><h3>Add to your day</h3></div><button type="button" className="bk-x" onClick={() => setPicker(null)} aria-label="Close">×</button></div>
            <div className="bk-tabs">{["all", ...cats].map((c) => <button key={c} type="button" className={pickCat === c ? "on" : ""} onClick={() => setPickCat(c)}>{c === "all" ? "All" : CATEGORY_LABEL[c] ?? c}</button>)}</div>
            <div className="bk-pgrid">
              {p.experiences.filter((e) => pickCat === "all" || e.category === pickCat).map((e) => {
                const added = extras.some((x) => x.date === picker && x.experienceId === e.id);
                return (
                  <button key={e.id} type="button" className={`bk-pc ${added ? "added" : ""}`} disabled={added} onClick={() => { addExtra(e, picker); setPicker(null); }}>
                    <img src={e.image} alt="" />
                    <span className="bk-pc-b"><b>{e.title}</b><small>{e.summary}</small><span className="bk-pc-f"><span>{e.duration}{e.timeHint ? ` · ${e.timeHint}` : ""}</span><strong>{money(e.priceUsd)}<i>{e.unit === "GROUP" ? " /car" : " /person"}</i></strong></span></span>
                    <span className="bk-pc-add">{added ? "✓ Added" : "+ Add"}</span>
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}

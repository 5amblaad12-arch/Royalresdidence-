"use client";
// The booking card in the hero: pick dates, see if they're free and what it costs, straight away. One tap on a
// "next free dates" chip fills everything in.
import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { addDays, eachNight, fmtDay, nightsBetween } from "@/lib/dates";
import { fmtMoney, type Currency, type Rates } from "@/lib/money";

type Props = { today: string; taken: string[]; windows: { checkIn: string; checkOut: string }[]; nightlyUsd: number; cleaningUsd: number; minNights: number; maxGuests: number; currency: Currency; rates: Rates };

export default function HeroBooking(p: Props) {
  const router = useRouter();
  const taken = useMemo(() => new Set(p.taken), [p.taken]);
  const first = p.windows[0];
  const [checkIn, setIn] = useState(first?.checkIn ?? addDays(p.today, 14));
  const [checkOut, setOut] = useState(first?.checkOut ?? addDays(p.today, 17));
  const [guests, setGuests] = useState(2);
  const money = (u: number) => fmtMoney(u, p.currency, p.rates);
  const nights = checkIn && checkOut ? nightsBetween(checkIn, checkOut) : 0;
  const valid = nights >= 1 && checkIn >= p.today;
  const free = valid && eachNight(checkIn, checkOut).every((d) => !taken.has(d));
  const short = valid && nights < p.minNights;
  const total = nights * p.nightlyUsd + (nights > 0 ? p.cleaningUsd : 0);
  const go = () => router.push(`/book?in=${checkIn}&out=${checkOut}&guests=${guests}`);

  return (
    <div className="hb" role="form" aria-label="Check availability">
      <div className="hb-top"><span className="hb-price"><b>{money(p.nightlyUsd)}</b> / night</span><span className="hb-sub">whole apartment · up to {p.maxGuests} guests</span></div>
      <div className="hb-grid">
        <label><span>Check-in</span><input type="date" value={checkIn} min={p.today} onChange={(e) => { const v = e.target.value; setIn(v); if (v && (!checkOut || checkOut <= v)) setOut(addDays(v, Math.max(p.minNights, 3))); }} /></label>
        <label><span>Check-out</span><input type="date" value={checkOut} min={checkIn ? addDays(checkIn, 1) : p.today} onChange={(e) => setOut(e.target.value)} /></label>
        <div className="hb-guests"><span>Guests</span>
          <div className="stepper"><button type="button" onClick={() => setGuests(Math.max(1, guests - 1))} disabled={guests <= 1} aria-label="Fewer guests">−</button><b>{guests}</b><button type="button" onClick={() => setGuests(Math.min(p.maxGuests, guests + 1))} disabled={guests >= p.maxGuests} aria-label="More guests">+</button></div>
        </div>
      </div>
      <div className={`hb-status ${!valid ? "" : free && !short ? "is-ok" : "is-no"}`} aria-live="polite">
        {!valid ? "Choose your dates" : !free ? "Some of these nights are booked — try a date below" : short ? `Minimum stay is ${p.minNights} nights` : <>✓ Free · {nights} {nights > 1 ? "nights" : "night"} · <b>{money(total)}</b> total</>}
      </div>
      <button className="btn btn-gold btn-block hb-go" type="button" onClick={go} disabled={!valid}>{free && !short ? "Book these dates" : "See all dates"} <span aria-hidden="true">→</span></button>
      {p.windows.length ? (
        <div className="hb-next">
          <span>Next free dates</span>
          <div>{p.windows.map((w) => <button key={w.checkIn} type="button" className={w.checkIn === checkIn && w.checkOut === checkOut ? "on" : ""} onClick={() => { setIn(w.checkIn); setOut(w.checkOut); }}>{fmtDay(w.checkIn)} → {fmtDay(w.checkOut)}</button>)}</div>
        </div>
      ) : null}
      <p className="hb-fine">Pay a small deposit to confirm · the rest on arrival</p>
    </div>
  );
}

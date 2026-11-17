// Booking page box: what this booking has asked Egypt Knight Tours for (with live status), and a form to ask for more.
import { ekCatalog, ekReady, ekRequests, type EkRequest } from "@/lib/egyptknight";
import { listSentRequests } from "@/lib/data";
import type { Booking } from "@/lib/data";
import { eachDay, fmtDay } from "@/lib/dates";
import { sendToEgyptKnight } from "@/app/admin/(panel)/actions";

const PILL: Record<string, string> = { NEW: "pill-amber", PENDING: "pill-amber", CONFIRMED: "pill-green", IN_PROGRESS: "pill-blue", COMPLETED: "pill-grey", DONE: "pill-grey", CANCELLED: "pill-red" };
const money = (n: number, cur: string) => `${cur} ${n.toLocaleString("en-US", { maximumFractionDigits: 2 })}`;

export default async function EgyptKnightBox({ b }: { b: Booking }) {
  if (!ekReady()) {
    return <div className="card pad"><b>Egypt Knight Tours</b><p className="small muted mt8">Not connected yet. Add <code>LINK_SECRET</code> and <code>EGYPT_KNIGHT_URL</code> in the hosting settings to book Egypt Knight tours from here.</p></div>;
  }
  const sent = await listSentRequests(b.id);
  const [cat, live] = await Promise.all([ekCatalog(), ekRequests(sent.map((x) => x.ref))]);
  const byRef = new Map<string, EkRequest>((live.ok ? live.data.requests : []).map((r) => [r.ref, r]));
  return (
    <div className="card pad">
      <div className="row"><b>Egypt Knight Tours</b><span className="spacer" /><span className="small muted">Tours & services for this guest, handled in Egypt Knight's own admin</span></div>
      {sent.map((x) => {
        const r = byRef.get(x.ref);
        return (
          <div key={x.id} className="mt8" style={{ padding: "10px 0", borderTop: "1px solid #EEE9E0" }}>
            <div className="row"><b className="small">{x.summary}</b><span className="spacer" />{r ? <span className={`pill ${PILL[r.status] ?? "pill-grey"}`}>{r.statusLabel}</span> : <span className="pill pill-grey">{live.ok ? "Not found" : "Status unavailable"}</span>}</div>
            <div className="small muted">{x.ref} · sent by {x.createdBy}{r && r.priceTotal > 0 ? ` · Egypt Knight price ${money(r.priceTotal, r.currency)}` : r ? " · price not set yet" : ""}</div>
            {r?.services.map((sv, i) => <div key={i} className="small" style={{ marginTop: 4 }}>• {sv.label}{sv.date ? ` · ${fmtDay(sv.date)}` : ""}{sv.time ? ` ${sv.time}` : ""} — <span className="muted">{sv.statusLabel}</span></div>)}
          </div>
        );
      })}
      {!live.ok && sent.length ? <p className="small mt8" style={{ color: "var(--amber)" }}>{live.error}</p> : null}
      {cat.ok ? (
        <form action={sendToEgyptKnight} className="f-inline mt16" style={{ paddingTop: 14, borderTop: "1px solid #EEE9E0" }}>
          <input type="hidden" name="id" value={b.id} />
          <label className="field" style={{ minWidth: 240 }}><span>Book with Egypt Knight</span>
            <select name="what" required defaultValue="">
              <option value="" disabled>Choose a tour or service…</option>
              <optgroup label="Their tours">{cat.data.tours.map((t) => <option key={t.id} value={`tour:${t.id}`}>{t.title}{t.destination ? ` (${t.destination})` : ""} — ${t.price}{t.perPerson ? "/person" : ""}</option>)}</optgroup>
              <optgroup label="Other services">{cat.data.serviceTypes.map(([k, l]) => <option key={k} value={`type:${k}`}>{l}</option>)}</optgroup>
            </select></label>
          <label className="field"><span>Day</span><select name="date">{eachDay(b.checkIn, b.checkOut).map((d) => <option key={d} value={d}>{fmtDay(d)}</option>)}</select></label>
          <label className="field"><span>Time</span><input name="time" placeholder="09:00" style={{ width: 80 }} /></label>
          <label className="field"><span>People</span><input name="people" type="number" min={1} max={50} defaultValue={b.guests} style={{ width: 70 }} /></label>
          <label className="field" style={{ flex: 1, minWidth: 180 }}><span>Details (for "other services")</span><input name="label" placeholder="e.g. Luxor day trip, private car" /></label>
          <label className="field" style={{ flex: 1, minWidth: 180 }}><span>Note for Egypt Knight</span><input name="notes" placeholder="Pickup from the residence" /></label>
          <button className="btn btn-navy btn-sm" type="submit">Send to Egypt Knight</button>
        </form>
      ) : <p className="small mt16" style={{ color: "var(--amber)" }}>Couldn't load Egypt Knight's tours: {cat.error}</p>}
    </div>
  );
}

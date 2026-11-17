import { requireStaff } from "@/lib/auth";
import { getSettings } from "@/lib/settings";
import { fmtMoney } from "@/lib/money";
import { saveSettingsForm } from "../actions";

export const dynamic = "force-dynamic";

export default async function SettingsPage({ searchParams }: { searchParams: Promise<{ m?: string }> }) {
  await requireStaff(true);
  const { m } = await searchParams;
  const st = await getSettings();
  const F = ({ k, label, type = "text", v, step, wide, hint }: { k: string; label: string; type?: string; v: string | number; step?: string; wide?: boolean; hint?: string }) => (
    <label className="field" style={wide ? { gridColumn: "1 / -1" } : undefined}><span>{label}</span>{type === "area" ? <textarea name={k} defaultValue={String(v)} rows={4} /> : <input name={k} type={type} step={step} defaultValue={v} />}{hint ? <small className="muted">{hint}</small> : null}</label>
  );
  return (
    <div style={{ maxWidth: 860 }}>
      {m ? <div className="msg">{m}</div> : null}
      <div className="adm-h"><h1>Settings & prices</h1></div>
      <form action={saveSettingsForm} className="stack">
        <div className="card pad"><b>Prices & rules</b>
          <div className="grid2 mt16" style={{ gap: 14 }}>
            <F k="nightlyUsd" label="Price per night (USD, whole apartment)" type="number" step="0.01" v={st.nightlyUsd} />
            <F k="cleaningUsd" label="Cleaning fee per stay (USD, 0 = none)" type="number" step="0.01" v={st.cleaningUsd} />
            <F k="depositPct" label="Deposit to confirm (%)" type="number" v={st.depositPct} />
            <F k="holdHours" label="Hold unpaid bookings for (hours)" type="number" v={st.holdHours} />
            <F k="minNights" label="Minimum nights" type="number" v={st.minNights} />
            <F k="maxNights" label="Maximum nights online" type="number" v={st.maxNights} />
            <F k="maxGuests" label="Maximum guests" type="number" v={st.maxGuests} />
            <F k="agencyNightlyUsd" label="Price per night when Egypt Knight books (USD, 0 = same)" type="number" step="0.01" v={st.agencyNightlyUsd} />
          </div>
        </div>
        <div className="card pad"><b>Currency rates</b><div className="small muted">Used to show prices in EUR and EGP. Update them when the rate moves. Example: {fmtMoney(100)} = {fmtMoney(100, "EGP", st.rates)} = {fmtMoney(100, "EUR", st.rates)}</div>
          <div className="grid2 mt16" style={{ gap: 14 }}>
            <F k="rateEGP" label="1 USD = … EGP" type="number" step="0.01" v={st.rates.EGP} />
            <F k="rateEUR" label="1 USD = … EUR" type="number" step="0.0001" v={st.rates.EUR} />
          </div>
        </div>
        <div className="card pad"><b>How guests pay the deposit</b><div className="small muted">Shown on the guest's booking page.</div>
          <div className="grid2 mt16" style={{ gap: 14 }}>
            <F k="instapay" label="InstaPay address or number" v={st.instapay} />
            <F k="paymentNote" label="Note under payment details" v={st.paymentNote} />
            <F k="bankDetails" label="Bank transfer details (bank, account name, IBAN…)" type="area" v={st.bankDetails} wide />
          </div>
        </div>
        <div className="card pad"><b>Contact & location</b>
          <div className="grid2 mt16" style={{ gap: 14 }}>
            <F k="whatsapp" label="WhatsApp number (with country code)" v={st.whatsapp} />
            <F k="email" label="Email for booking alerts" type="email" v={st.email} />
            <F k="address" label="Address line" v={st.address} wide />
            <F k="mapsUrl" label="Google Maps link" v={st.mapsUrl} wide />
            <F k="reviewUrl" label="Google review link (sent after check-out)" v={st.reviewUrl} wide />
          </div>
        </div>
        <div className="card pad"><b>Stay information</b>
          <div className="grid2 mt16" style={{ gap: 14 }}>
            <F k="checkInTime" label="Check-in from" v={st.checkInTime} />
            <F k="checkOutTime" label="Check-out by" v={st.checkOutTime} />
            <F k="arrivalInfo" label="Arrival details (only shown to confirmed guests: building, floor, key, Wi-Fi…)" type="area" v={st.arrivalInfo} wide />
            <F k="houseRules" label="House rules" type="area" v={st.houseRules} wide />
            <F k="cancellationPolicy" label="Changes & cancellation policy" type="area" v={st.cancellationPolicy} wide />
          </div>
        </div>
        <button className="btn btn-navy" type="submit" style={{ position: "sticky", bottom: 16 }}>Save settings</button>
      </form>
    </div>
  );
}

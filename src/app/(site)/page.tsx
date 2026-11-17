import Link from "next/link";
import { getSettings } from "@/lib/settings";
import { listExperiences } from "@/lib/data";
import { getCurrency, pricer } from "@/lib/view";
import { todayInEgypt, addDays } from "@/lib/dates";
import { Icon, ExpCard, WaIcon } from "@/components/ui";
import { ROOMS, FAQ } from "@/lib/content";
import { waLink } from "@/lib/wa";

export const dynamic = "force-dynamic";

export default async function Home() {
  const [st, exps, cur] = await Promise.all([getSettings(), listExperiences(), getCurrency()]);
  const p = pricer(cur, st.rates);
  const today = todayInEgypt();
  const site = (process.env.NEXT_PUBLIC_SITE_URL ?? "").replace(/\/$/, "");
  const ld = {
    "@context": "https://schema.org", "@type": "VacationRental", name: "The Royal Nile Residence", description: "Private 3-bedroom Nile-view apartment in Aswan for up to 6 guests.",
    image: site ? [`${site}/photos/panorama.webp`, `${site}/photos/twin_wide.webp`] : undefined, address: { "@type": "PostalAddress", addressLocality: "Aswan", addressCountry: "EG", streetAddress: st.address },
    containsPlace: { "@type": "Accommodation", numberOfBedrooms: 3, numberOfBathroomsTotal: 1, occupancy: { "@type": "QuantitativeValue", maxValue: st.maxGuests }, floorSize: { "@type": "QuantitativeValue", value: 120, unitCode: "MTK" } },
    telephone: `+${st.whatsapp}`,
  };
  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(ld) }} />
      <section className="hero">
        <img className="hero-img" src="/photos/panorama.webp" alt="The Nile at Aswan with feluccas, Elephantine Island and the west bank hills" style={{ objectPosition: "60% 28%" }} fetchPriority="high" />
        <div className="hero-card glass">
          <div className="cap" style={{ color: "var(--cream)", fontSize: 11 }}>Tonight in Aswan</div>
          <div className="serif" style={{ fontSize: 23, marginTop: 8, lineHeight: 1.2 }}>Sunset straight from your balcony.</div>
          <div className="row mt16" style={{ flexWrap: "nowrap" }}>
            <img src="/photos/feluccas.webp" alt="" style={{ width: 54, height: 54, borderRadius: 12, objectFit: "cover" }} />
            <div style={{ fontSize: 13.5, lineHeight: 1.4 }}>Or on the water: <b>sunset felucca</b><br /><span style={{ opacity: .85 }}>local price, booked with your stay</span></div>
          </div>
        </div>
        <div className="wrap hero-in">
          <div className="cap" style={{ color: "var(--gold2)" }}>Your private home overlooking the Nile</div>
          <h1 className="mt16">Not just a place to stay.<br /><i>Your whole Aswan.</i></h1>
          <p>A 3-bedroom Nile-view residence — plus the boats, temples, drivers and dinners you'll want while you're here, booked for you at local prices.</p>
          <form className="search" action="/book">
            <label><span>CHECK-IN</span><input type="date" name="in" min={today} defaultValue={addDays(today, 14)} required /></label>
            <label><span>CHECK-OUT</span><input type="date" name="out" min={addDays(today, 1)} defaultValue={addDays(today, 18)} required /></label>
            <label><span>GUESTS</span><select name="guests" defaultValue="2">{Array.from({ length: st.maxGuests }, (_, i) => <option key={i} value={i + 1}>{i + 1} {i ? "guests" : "guest"}</option>)}</select></label>
            <button className="btn btn-gold" type="submit">Check availability</button>
          </form>
        </div>
      </section>

      <div className="facts"><div className="wrap">
        {[["area", "120 m² private apartment"], ["bed", "3 bedrooms"], ["users", `Up to ${st.maxGuests} guests`], ["sun", "Nile-view balcony"], ["pin", "2 min to Tulip Aswan"]].map(([i, t]) => <span key={t}><Icon n={i} color="#E9C792" /> {t}</span>)}
      </div></div>

      <section className="section"><div className="wrap grid3">
        {[["01", "Stay like a local", "Your own home on the Nile — three bedrooms, a kitchen, Wi-Fi and a balcony made for Aswan's sunsets."],
          ["02", "Do Aswan properly", "Pick your trips while you book: feluccas, Philae, Abu Simbel, Nubian villages. We suggest a plan for your days."],
          ["03", "We handle the rest", "Airport pickup, drivers, tickets and tips — one WhatsApp chat, at local prices."]].map(([n, t, d]) => (
          <div key={n}><div className="num">{n}</div><h3 className="mt8" style={{ fontSize: 26 }}>{t}</h3><p className="muted mt8">{d}</p></div>
        ))}
      </div></section>

      <section className="section-sm"><div className="wrap">
        <div className="row" style={{ alignItems: "flex-end" }}>
          <div><div className="cap">Add to your stay</div><h2 className="mt8">Aswan experiences, <i>at local prices</i></h2></div>
          <span className="spacer" /><Link className="btn btn-ghost" href="/experiences">See all {exps.length} experiences →</Link>
        </div>
        <div className="grid4 mt32">{exps.slice(0, 4).map((e) => <ExpCard key={e.id} title={e.title} image={e.image} price={p(e.priceUsd)} unit={e.unit} duration={e.duration} href="/experiences" />)}</div>
      </div></section>

      <section className="section"><div className="wrap grid2" style={{ alignItems: "center", gap: 48 }}>
        <img className="photo" src="/photos/twin_wide.webp" alt="Bedroom with the balcony door open to the Nile" style={{ aspectRatio: "4/5", maxHeight: 620 }} loading="lazy" />
        <div>
          <div className="cap">The residence</div>
          <h2 className="mt8">A real home, <i>with the Nile outside the window.</i></h2>
          <p className="lead mt16">120 m² of space for families and friends — more room and privacy than a hotel, in a modern building with an elevator, right on Aswan's Corniche.</p>
          <ul className="clean mt24 stack">
            {ROOMS.map((r) => <li key={r.name} className="row" style={{ flexWrap: "nowrap" }}><img src={r.photo} alt="" style={{ width: 72, height: 56, borderRadius: 10, objectFit: "cover" }} loading="lazy" /><div><b>{r.name} · {r.beds}</b><div className="small muted">{r.note}</div></div></li>)}
          </ul>
          <div className="row mt32"><Link className="btn btn-navy" href="/stay">See the residence</Link><span className="muted">from <b style={{ color: "var(--ink)" }}>{p(st.nightlyUsd)}</b> / night</span></div>
        </div>
      </div></section>

      <section className="section-sm"><div className="wrap">
        <div className="band">
          <div className="grid2" style={{ alignItems: "center" }}>
            <div>
              <div className="cap" style={{ color: "var(--gold2)" }}>Joining a Nile cruise?</div>
              <h2 className="mt8">Stay the night before <i>— or after.</i></h2>
              <p className="mt16">Several cruise docks are minutes away. Arrive a day early, see Aswan at your own pace, and we'll drop you at your boat.</p>
              <div className="row mt24"><Link className="btn btn-gold" href="/book">Plan my stay</Link><a className="btn btn-wa" href={waLink(st.whatsapp, "Hi! I'm joining a Nile cruise and would like to stay before/after.")} target="_blank" rel="noopener"><WaIcon /> Ask us</a></div>
            </div>
            <img className="photo" src="/photos/cruise.webp" alt="Nile cruise boats near the residence" style={{ aspectRatio: "4/3" }} loading="lazy" />
          </div>
        </div>
      </div></section>

      <section className="section" id="faq"><div className="wrap grid2" style={{ gap: 48 }}>
        <div><div className="cap">Good to know</div><h2 className="mt8">Questions guests <i>ask us</i></h2><p className="lead mt16">Anything else? Message us on WhatsApp — a real person answers.</p></div>
        <div className="faq">{FAQ.map(([q, a]) => <details key={q}><summary>{q}</summary><p>{a}</p></details>)}</div>
      </div></section>
    </>
  );
}

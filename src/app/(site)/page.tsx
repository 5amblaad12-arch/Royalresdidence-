import Link from "next/link";
import { getSettings } from "@/lib/settings";
import { listExperiences, loadTaken } from "@/lib/data";
import { getCurrency, pricer } from "@/lib/view";
import { todayInEgypt, fmtLong } from "@/lib/dates";
import { freeWindows } from "@/lib/availability";
import { Icon, WaIcon } from "@/components/ui";
import { FAQ } from "@/lib/content";
import { waLink } from "@/lib/wa";
import HeroBooking from "@/components/HeroBooking";
import ArrivalMap from "@/components/ArrivalMap";
import StickyBook from "@/components/StickyBook";

export const dynamic = "force-dynamic";

const SPACES = [
  { src: "/photos/twin_wide.webp", t: "Bedroom 2", d: "Two twin beds · Nile balcony" },
  { src: "/photos/king.webp", t: "Bedroom 1", d: "King-size bed · big wardrobe" },
  { src: "/photos/balcony.webp", t: "The balcony", d: "Sunset over the west bank" },
  { src: "/photos/twin_door.webp", t: "Bedroom 3", d: "Two twin beds · French balcony" },
  { src: "/photos/feluccas.webp", t: "The view", d: "Feluccas on the Nile, all day" },
  { src: "/photos/desk_mirror.webp", t: "Details", d: "A/C, TV and a desk in every room" },
];

export default async function Home() {
  const [st, exps, cur, taken] = await Promise.all([getSettings(), listExperiences(), getCurrency(), loadTaken()]);
  const p = pricer(cur, st.rates);
  const today = todayInEgypt();
  const windows = freeWindows(taken, today, Math.max(3, st.minNights), 3);
  const site = (process.env.NEXT_PUBLIC_SITE_URL ?? "").replace(/\/$/, "");
  const ld = {
    "@context": "https://schema.org", "@type": "VacationRental", name: "The Royal Nile Residence", description: "Private 3-bedroom Nile-view apartment in Aswan for up to 6 guests.",
    image: site ? [`${site}/photos/panorama.webp`, `${site}/photos/twin_wide.webp`] : undefined, address: { "@type": "PostalAddress", addressLocality: "Aswan", addressCountry: "EG", streetAddress: st.address },
    geo: { "@type": "GeoCoordinates", latitude: st.mapLat, longitude: st.mapLng },
    containsPlace: { "@type": "Accommodation", numberOfBedrooms: 3, numberOfBathroomsTotal: 1, occupancy: { "@type": "QuantitativeValue", maxValue: st.maxGuests }, floorSize: { "@type": "QuantitativeValue", value: 120, unitCode: "MTK" } },
    telephone: `+${st.whatsapp}`,
  };
  const facts: [string, string][] = [["area", "120 m² private apartment"], ["bed", "3 bedrooms"], ["users", `Up to ${st.maxGuests} guests`], ["sun", "Nile-view balcony"], ["wifi", "Fast Wi-Fi"], ["ac", "A/C in every room"], ["ship", "Minutes from the cruise docks"], ["pin", "2 min to Tolip Aswan"]];

  return (
    <div className="home">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(ld) }} />

      {/* ---------- HERO: the booking card is the first thing you can use ---------- */}
      <section className="h-hero">
        <div className="h-hero-media"><img src="/photos/panorama.webp" alt="The Nile at Aswan with feluccas, Elephantine Island and the west bank hills" fetchPriority="high" /></div>
        <div className="wrap h-hero-in">
          <div className="h-copy">
            <span className="h-badge"><span className="h-live" /> Private Nile-view apartment · Aswan</span>
            <h1><span className="ln" style={{ ["--d" as string]: "0ms" }}>Your private home</span> <span className="ln" style={{ ["--d" as string]: "120ms" }}>on the Nile.</span> <span className="ln" style={{ ["--d" as string]: "240ms" }}><i>And all of Aswan.</i></span></h1>
            <p className="h-lead">Three bedrooms, a balcony over the river, and the trips you came for — feluccas, Philae, Abu Simbel — booked at local prices.</p>
            <div className="h-trust">
              <span><Icon n="check" size={18} color="#D4B57C" /> Book direct, best price</span>
              <span><Icon n="check" size={18} color="#D4B57C" /> Small deposit to confirm</span>
              <span><Icon n="check" size={18} color="#D4B57C" /> A real person on WhatsApp</span>
            </div>
          </div>
          <HeroBooking today={today} taken={[...taken].sort()} windows={windows} nightlyUsd={st.nightlyUsd} cleaningUsd={st.cleaningUsd} minNights={st.minNights} maxGuests={st.maxGuests} currency={cur} rates={st.rates} />
        </div>
        <a className="h-scroll" href="#stay" aria-label="Scroll down"><span /></a>
      </section>
      <div id="hero-end" />

      <div className="marquee" aria-label="Highlights"><div className="marquee-track">
        {[...facts, ...facts].map(([i, t], k) => <span key={k} aria-hidden={k >= facts.length}><Icon n={i} color="#D4B57C" size={18} /> {t}</span>)}
      </div></div>

      {/* ---------- THE STAY ---------- */}
      <section className="section" id="stay"><div className="wrap">
        <div className="h-head rv">
          <div><div className="cap">The residence</div><h2 className="mt8">A real home, <i>with the Nile outside the window.</i></h2></div>
          <p className="lead">120 m² for families and friends — more space and privacy than a hotel room, in a modern building with an elevator, right on the Corniche.</p>
        </div>
        <div className="snap mt32" tabIndex={0} aria-label="Photos of the residence">
          {SPACES.map((s, i) => (
            <figure key={s.src} className="snap-card rv" style={{ ["--i" as string]: i }}>
              <img src={s.src} alt={`${s.t}: ${s.d}`} loading="lazy" />
              <figcaption><b>{s.t}</b><span>{s.d}</span></figcaption>
            </figure>
          ))}
        </div>
        <div className="row mt24"><Link className="btn btn-navy" href="/stay">See every room & photo</Link><span className="muted small">Wi-Fi · washing machine · kitchen · TVs in all bedrooms</span></div>
      </div></section>

      {/* ---------- WHY BOOK DIRECT ---------- */}
      <section className="section-sm"><div className="wrap">
        <div className="why">
          {[["01", "Best price, booked direct", "No booking-site fees. You deal with us, and we answer on WhatsApp."],
            ["02", "Your trips, at local prices", "Feluccas, Philae, Abu Simbel and transfers with people we know — not the tourist price on the street."],
            ["03", "Looked after from arrival", "A driver with your name at the airport, a trip page with every time and address, help whenever you need it."]].map(([n, t, d], i) => (
            <div key={n} className="why-c rv" style={{ ["--i" as string]: i }}><span className="num">{n}</span><h3>{t}</h3><p>{d}</p></div>
          ))}
        </div>
      </div></section>

      {/* ---------- EXPERIENCES ---------- */}
      <section className="section"><div className="wrap">
        <div className="h-head rv">
          <div><div className="cap">Add to your stay</div><h2 className="mt8">Aswan, <i>at the price locals pay.</i></h2></div>
          <Link className="btn btn-ghost" href="/experiences">All {exps.length} experiences →</Link>
        </div>
        <div className="snap snap-exp mt32" tabIndex={0} aria-label="Aswan experiences">
          {exps.map((e, i) => (
            <Link key={e.id} href="/book" className="xcard rv" style={{ ["--i" as string]: i % 4 }}>
              <img src={e.image} alt="" loading="lazy" />
              <div className="xcard-b"><span className="chip">LOCAL PRICE</span><b>{e.title}</b><span className="muted small">{e.duration}</span>
                <span className="xcard-p">from <b>{p(e.priceUsd)}</b> {e.unit === "GROUP" ? "per car" : "/ person"}</span></div>
            </Link>
          ))}
        </div>
      </div></section>

      {/* ---------- HOW TO GET HERE ---------- */}
      <section className="section h-arrive" id="getting-here"><div className="wrap">
        <div className="h-head rv">
          <div><div className="cap">How to get here</div><h2 className="mt8">Easy to reach, <i>right on the Corniche.</i></h2></div>
          <p className="lead">Pick where you're coming from to see the route. Add a pickup when you book and you won't need to find us at all.</p>
        </div>
        <div className="mt32 rv"><ArrivalMap lat={st.mapLat} lng={st.mapLng} mapsUrl={st.mapsUrl} /></div>
      </div></section>

      {/* ---------- FINAL CALL TO BOOK ---------- */}
      <section className="section-sm"><div className="wrap">
        <div className="h-cta rv">
          <img src="/photos/feluccas.webp" alt="" loading="lazy" />
          <div className="h-cta-in">
            <div className="cap" style={{ color: "var(--gold2)" }}>Your dates are waiting</div>
            <h2 className="mt8">Wake up to the Nile. <i>We'll handle the rest.</i></h2>
            <p className="mt16">From <b>{p(st.nightlyUsd)}</b> a night for the whole apartment.{windows[0] ? ` Next free from ${fmtLong(windows[0].checkIn)}.` : ""}</p>
            <div className="row mt24"><Link className="btn btn-gold" href="/book">Check dates & book</Link><a className="btn btn-wa" href={waLink(st.whatsapp, "Hi! I'd like to book The Royal Nile Residence.")} target="_blank" rel="noopener"><WaIcon /> Ask on WhatsApp</a></div>
          </div>
        </div>
      </div></section>

      <section className="section" id="faq"><div className="wrap grid2" style={{ gap: 48 }}>
        <div className="rv"><div className="cap">Good to know</div><h2 className="mt8">Questions guests <i>ask us</i></h2><p className="lead mt16">Anything else? Message us on WhatsApp — a real person answers.</p></div>
        <div className="faq rv">{FAQ.map(([q, a]) => <details key={q}><summary>{q}</summary><p>{a}</p></details>)}</div>
      </div></section>

      <StickyBook price={p(st.nightlyUsd)} />
    </div>
  );
}

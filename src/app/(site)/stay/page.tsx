import Link from "next/link";
import type { Metadata } from "next";
import { getSettings } from "@/lib/settings";
import { getCurrency, pricer } from "@/lib/view";
import { Icon, WaIcon } from "@/components/ui";
import { ROOMS, AMENITIES, GALLERY } from "@/lib/content";
import { waLink } from "@/lib/wa";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "The stay — 3-bedroom Nile-view apartment", description: "A private 120 m² apartment in Aswan with direct Nile views: king room, two twin rooms with balconies, kitchen, Wi-Fi and A/C. Up to 6 guests." };

export default async function Stay() {
  const [st, cur] = await Promise.all([getSettings(), getCurrency()]);
  const p = pricer(cur, st.rates);
  return (
    <div className="wrap section-sm">
      <div className="small muted"><Link href="/">Home</Link> / The stay</div>
      <div className="row mt8" style={{ alignItems: "flex-end" }}>
        <h1 style={{ fontSize: "clamp(32px,5vw,50px)" }}>The Royal Nile Residence</h1><span className="spacer" />
        <span className="muted">Entire apartment · Corniche, Aswan</span>
      </div>
      <div className="gallery mt24">{GALLERY.slice(0, 5).map((g, i) => <img key={g.src} src={g.src} alt={g.alt} loading={i ? "lazy" : "eager"} />)}</div>

      <div className="split mt48">
        <div>
          <div className="row" style={{ gap: 26, paddingBottom: 24, borderBottom: "1px solid var(--rule)", color: "var(--ink2)" }}>
            {[["area", "120 m²"], ["bed", "3 bedrooms"], ["users", `${st.maxGuests} guests`], ["sun", "2 Nile-view rooms"], ["bath", "1 bathroom"]].map(([i, t]) => <span key={t} className="row" style={{ gap: 8 }}><Icon n={i} color="var(--gold)" /> {t}</span>)}
          </div>
          <p className="lead mt24">A beautifully furnished private apartment with direct Nile views. Ideal for families, friends and anyone who wants extra space — with the comfort and independence of a real home, and a balcony made for Aswan's sunsets.</p>
          <h2 className="mt48" style={{ fontSize: 30 }}>Where you'll sleep</h2>
          <div className="grid3 mt24">{ROOMS.map((r) => <div key={r.name}><img className="photo" src={r.photo} alt={`${r.name}: ${r.beds}`} style={{ aspectRatio: "4/3" }} loading="lazy" /><b className="mt8" style={{ display: "block" }}>{r.name}</b><div className="small muted">{r.beds} · {r.note}</div></div>)}</div>
          <h2 className="mt48" style={{ fontSize: 30 }}>What's here</h2>
          <ul className="clean amen mt24">{AMENITIES.map(([i, t]) => <li key={t}><Icon n={i} color="var(--gold)" /> {t}</li>)}</ul>
          <h2 className="mt48" style={{ fontSize: 30 }}>More photos</h2>
          <div className="grid3 mt24">{GALLERY.slice(5).map((g) => <img key={g.src} className="photo" src={g.src} alt={g.alt} style={{ aspectRatio: "1/1" }} loading="lazy" />)}</div>
          <h2 className="mt48" style={{ fontSize: 30 }}>Good to know</h2>
          <dl className="kv mt16"><dt>Check-in</dt><dd>from {st.checkInTime}</dd><dt>Check-out</dt><dd>by {st.checkOutTime}</dd><dt>Minimum stay</dt><dd>{st.minNights} nights</dd><dt>House rules</dt><dd style={{ fontWeight: 400 }}>{st.houseRules}</dd></dl>
        </div>
        <aside style={{ position: "sticky", top: 96 }}>
          <div className="card pad" style={{ boxShadow: "var(--shadow)" }}>
            <div><b style={{ fontSize: 26 }}>{p(st.nightlyUsd)}</b> <span className="muted">/ night · whole apartment</span></div>
            <ul className="clean stack mt16 small" style={{ color: "var(--ink2)" }}>
              <li className="row" style={{ gap: 8 }}><Icon n="check" color="var(--green)" size={18} /> Pay a {st.depositPct}% deposit, the rest on arrival</li>
              <li className="row" style={{ gap: 8 }}><Icon n="check" color="var(--green)" size={18} /> Add trips & transfers at local prices</li>
              <li className="row" style={{ gap: 8 }}><Icon n="check" color="var(--green)" size={18} /> A real person on WhatsApp</li>
            </ul>
            <Link className="btn btn-navy btn-block mt24" href="/book">Check dates & plan my stay</Link>
            <a className="btn btn-wa btn-block mt8" href={waLink(st.whatsapp, "Hi! I'd like to ask about The Royal Nile Residence.")} target="_blank" rel="noopener"><WaIcon /> Ask us on WhatsApp</a>
          </div>
        </aside>
      </div>
    </div>
  );
}

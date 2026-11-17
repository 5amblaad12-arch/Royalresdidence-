import Link from "next/link";
import type { Metadata } from "next";
import { getSettings } from "@/lib/settings";
import { listExperiences } from "@/lib/data";
import { getCurrency, pricer } from "@/lib/view";
import { CATEGORY_LABEL } from "@/lib/content";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Aswan experiences at local prices", description: "Sunset felucca, Philae Temple, Abu Simbel, Nubian village, airport pickup and more — booked with your stay at the price locals pay." };

export default async function Experiences() {
  const [st, exps, cur] = await Promise.all([getSettings(), listExperiences(), getCurrency()]);
  const p = pricer(cur, st.rates);
  const cats = [...new Set(exps.map((e) => e.category))];
  return (
    <div className="wrap section-sm">
      <div className="grid2" style={{ alignItems: "end" }}>
        <div><div className="cap">Aswan experiences</div><h1 className="mt8" style={{ fontSize: "clamp(34px,5vw,54px)" }}>Everything you came to Aswan for. <i style={{ color: "var(--navy)" }}>At the price locals pay.</i></h1></div>
        <p className="lead">We work with boat owners, drivers and guides we know personally. You add trips while you book, we arrange them, you pay the local rate.</p>
      </div>
      {cats.map((c) => (
        <section key={c} className="mt48">
          <h2 style={{ fontSize: 28 }}>{CATEGORY_LABEL[c] ?? c}</h2>
          <div className="grid2 mt24">
            {exps.filter((e) => e.category === c).map((e) => (
              <article key={e.id} id={e.slug} className="card" style={{ display: "grid", gridTemplateColumns: "minmax(120px, 42%) 1fr", overflow: "hidden" }}>
                <img src={e.image} alt={e.title} style={{ width: "100%", height: "100%", minHeight: 200, objectFit: "cover" }} loading="lazy" />
                <div className="pad">
                  <span className="chip">LOCAL PRICE</span>
                  <h3 className="mt8" style={{ fontSize: 22 }}>{e.title}</h3>
                  <p className="small muted mt8">{e.description || e.summary}</p>
                  <div className="small mt16" style={{ color: "var(--ink2)" }}>{e.duration}{e.timeHint ? ` · usually ${e.timeHint}` : ""}</div>
                  <div className="row mt16"><span>from <b style={{ fontSize: 19 }}>{p(e.priceUsd)}</b> <span className="muted small">{e.unit === "GROUP" ? "per car" : "per person"}</span></span><span className="spacer" /><Link className="btn btn-ghost btn-sm" href="/book">Add to my stay</Link></div>
                </div>
              </article>
            ))}
          </div>
        </section>
      ))}
      <div className="band mt48"><div className="row"><div><h2 style={{ fontSize: 30 }}>Planning something else? <i>Just ask.</i></h2><p className="mt8">Kom Ombo and Edfu, a day in Luxor, a camel ride — tell us what you'd like and we'll arrange it.</p></div><span className="spacer" /><Link className="btn btn-gold" href="/book">Plan my stay</Link></div></div>
    </div>
  );
}

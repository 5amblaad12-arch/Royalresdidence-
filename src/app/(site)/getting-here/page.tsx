import Link from "next/link";
import type { Metadata } from "next";
import { getSettings } from "@/lib/settings";
import { Icon, WaIcon } from "@/components/ui";
import { waLink } from "@/lib/wa";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Getting here", description: "How to reach The Royal Nile Residence in Aswan from the airport, the train station and the Nile cruise docks." };

export default async function GettingHere() {
  const st = await getSettings();
  const ways = [
    ["plane", "From Aswan Airport", "About 25 minutes by car. Add an airport pickup when you book and your driver will wait at arrivals with your name."],
    ["train", "From Aswan train station", "About 10 minutes by car. Tell us your train and we'll meet you on the platform exit."],
    ["ship", "From or to a Nile cruise", "Several cruise docks are a few minutes away along the Corniche. We can take you and your bags to your boat."],
    ["pin", "Around the neighbourhood", "Al Raya supermarket is next to the building. Cafés, restaurants, a pharmacy and an ATM are a short walk away. Tulip Aswan Hotel is about 2 minutes away."],
  ];
  return (
    <div className="wrap section-sm">
      <div className="cap">Getting here</div>
      <h1 className="mt8" style={{ fontSize: "clamp(34px,5vw,54px)" }}>Easy to reach, <i style={{ color: "var(--navy)" }}>right on the Nile.</i></h1>
      <p className="lead mt16" style={{ maxWidth: 640 }}>{st.address}</p>
      <div className="grid2 mt48">
        {ways.map(([i, t, d]) => <div key={t} className="card pad row" style={{ alignItems: "flex-start", flexWrap: "nowrap", gap: 16 }}><span style={{ width: 46, height: 46, borderRadius: 12, background: "var(--paper2)", display: "flex", alignItems: "center", justifyContent: "center", flex: "none" }}><Icon n={i} color="var(--gold)" size={24} /></span><div><h3 style={{ fontSize: 21 }}>{t}</h3><p className="muted mt8">{d}</p></div></div>)}
      </div>
      {st.mapsUrl ? <p className="mt32"><a className="btn btn-ghost" href={st.mapsUrl} target="_blank" rel="noopener">Open in Google Maps</a></p> : null}
      <div className="row mt32"><Link className="btn btn-navy" href="/book">Plan my stay</Link><a className="btn btn-wa" href={waLink(st.whatsapp, "Hi! Could you send me the location of the residence?")} target="_blank" rel="noopener"><WaIcon /> Ask for the location</a></div>
    </div>
  );
}

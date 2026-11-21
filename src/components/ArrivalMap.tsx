"use client";
// "How to get here": pick where you're coming from and the map shows the drive; one tap opens turn-by-turn directions.
import { useState } from "react";

type Route = { key: string; label: string; from: string; time: string; tip: string; icon: string };
const ROUTES: Route[] = [
  { key: "airport", label: "From the airport", from: "Aswan International Airport, Aswan, Egypt", time: "about 30–40 min by car", tip: "Add an airport pickup when you book — your driver waits at arrivals with your name.", icon: "✈" },
  { key: "train", label: "From the train station", from: "Aswan Railway Station, Aswan, Egypt", time: "about 10 min by car", tip: "Tell us your train and we'll meet you at the station exit.", icon: "🚆" },
  { key: "cruise", label: "From a Nile cruise", from: "Corniche El Nile, Aswan, Egypt", time: "a few minutes", tip: "Many cruise boats moor along the Corniche, just minutes away. We can drop you at your boat on the last day.", icon: "⛴" },
  { key: "here", label: "The neighbourhood", from: "", time: "on your doorstep", tip: "Al Raya supermarket next to the building; cafés, a pharmacy and an ATM a short walk away; about 2 minutes from Tolip Aswan Hotel.", icon: "📍" },
];

export default function ArrivalMap({ lat, lng, mapsUrl }: { lat: number; lng: number; mapsUrl: string }) {
  const [k, setK] = useState("airport");
  const r = ROUTES.find((x) => x.key === k) ?? ROUTES[0];
  const dest = `${lat},${lng}`;
  const src = r.from
    ? `https://maps.google.com/maps?saddr=${encodeURIComponent(r.from)}&daddr=${dest}&output=embed`
    : `https://maps.google.com/maps?q=${dest}&z=16&output=embed`;
  const open = r.from
    ? `https://www.google.com/maps/dir/?api=1&origin=${encodeURIComponent(r.from)}&destination=${dest}&travelmode=driving`
    : mapsUrl || `https://www.google.com/maps/search/?api=1&query=${dest}`;
  return (
    <div className="amap">
      <div className="amap-side">
        <div className="amap-tabs" role="tablist" aria-label="Where are you coming from?">
          {ROUTES.map((x) => (
            <button key={x.key} role="tab" aria-selected={x.key === k} className={x.key === k ? "on" : ""} onClick={() => setK(x.key)} type="button">
              <span className="amap-ic" aria-hidden="true">{x.icon}</span><span><b>{x.label}</b><small>{x.time}</small></span>
            </button>
          ))}
        </div>
        <div className="amap-tip" key={r.key}><p>{r.tip}</p>
          <a className="btn btn-navy btn-sm" href={open} target="_blank" rel="noopener">{r.from ? "Directions in Google Maps" : "Open in Google Maps"} ↗</a></div>
      </div>
      <div className="amap-map">
        <iframe key={src} title={`Map: ${r.label} to The Royal Nile Residence`} src={src} loading="lazy" referrerPolicy="no-referrer-when-downgrade" allowFullScreen />
        <div className="amap-pin"><span className="amap-dot" /> The Royal Nile Residence</div>
      </div>
    </div>
  );
}

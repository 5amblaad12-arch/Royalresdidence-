// Small shared pieces: icons, logo, experience card. Server-safe (no hooks).
import Link from "next/link";
import type { ReactNode } from "react";

const P: Record<string, ReactNode> = {
  area: <path d="M4 4h16v16H4z M4 9h16M9 9v11" />,
  bed: <><path d="M3 18V8m0 6h18v4M21 18v-6a3 3 0 0 0-3-3h-7v5" /><circle cx="7" cy="11" r="2" /></>,
  users: <><circle cx="9" cy="8" r="3.2" /><path d="M3 20c0-3.5 2.7-6 6-6s6 2.5 6 6M16 4.5a3 3 0 0 1 0 6M18 14c2 .8 3 2.8 3 6" /></>,
  sun: <><circle cx="12" cy="12" r="4" /><path d="M12 2v2M12 20v2M2 12h2M20 12h2M5 5l1.4 1.4M17.6 17.6 19 19M5 19l1.4-1.4M17.6 6.4 19 5" /></>,
  pin: <><path d="M12 21s-7-6.2-7-11.5A7 7 0 0 1 19 9.5C19 14.8 12 21 12 21z" /><circle cx="12" cy="9.5" r="2.5" /></>,
  wifi: <><path d="M2 9a15 15 0 0 1 20 0M5.5 12.5a10 10 0 0 1 13 0M9 16a5 5 0 0 1 6 0" /><circle cx="12" cy="19.5" r="1" /></>,
  ac: <><rect x="3" y="5" width="18" height="8" rx="2" /><path d="M7 17v3M12 17v3M17 17v3M6 10h12" /></>,
  wash: <><rect x="4" y="3" width="16" height="18" rx="2" /><circle cx="12" cy="13" r="4.5" /><path d="M7 6.5h2" /></>,
  tv: <><rect x="3" y="5" width="18" height="12" rx="1.5" /><path d="M8 21h8" /></>,
  lift: <><rect x="5" y="3" width="14" height="18" rx="1.5" /><path d="M9 9l3-3 3 3M9 15l3 3 3-3" /></>,
  cart: <><path d="M3 4h2l2.4 11h11l2-8H6.3" /><circle cx="9" cy="19.5" r="1.5" /><circle cx="17" cy="19.5" r="1.5" /></>,
  ship: <path d="M3 16l2 4h14l2-4H3zM6 16V9h12v7M9 9V5h6v4" />,
  kitchen: <><rect x="4" y="3" width="16" height="18" rx="2" /><path d="M4 10h16M8 6.5h.01M8 14v3" /></>,
  bath: <><path d="M4 12h16v3a4 4 0 0 1-4 4H8a4 4 0 0 1-4-4v-3zM6 12V6a2 2 0 0 1 4 0" /><path d="M7 19l-1 2M17 19l1 2" /></>,
  plane: <path d="M10 14 3 11l1-2 8 1 4-5c1-1 3-1 3 0s0 2-1 3l-5 4 1 8-2 1-3-7z" />,
  train: <><rect x="6" y="3" width="12" height="14" rx="3" /><path d="M6 11h12M9 21l1.5-4M15 21l-1.5-4" /><circle cx="9" cy="14" r=".8" /><circle cx="15" cy="14" r=".8" /></>,
  check: <path d="M5 12.5l4.5 4.5L19 7.5" />,
  clock: <><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" /></>,
  shield: <path d="M12 3l8 3v6c0 5-3.5 8-8 9-4.5-1-8-4-8-9V6z" />,
};
export function Icon({ n, size = 20, color = "currentColor", w = 1.7 }: { n: string; size?: number; color?: string; w?: number }) {
  return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={w} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{P[n]}</svg>;
}

export function WaIcon({ size = 18 }: { size?: number }) {
  return <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M12 2a10 10 0 0 0-8.6 15.1L2 22l5-1.3A10 10 0 1 0 12 2zm5.3 14.1c-.2.6-1.3 1.2-1.8 1.2-.5.1-1 .2-3.3-.7-2.8-1.1-4.6-4-4.7-4.2-.1-.2-1.1-1.5-1.1-2.9s.7-2 1-2.3c.2-.3.5-.3.7-.3h.5c.2 0 .4 0 .6.5l.8 2c.1.2.1.4 0 .5l-.4.6-.4.4c-.1.1-.3.3-.1.6.2.3.8 1.3 1.7 2.1 1.2 1 2.1 1.3 2.4 1.5.3.1.5.1.6-.1l.9-1.1c.2-.3.4-.2.7-.1l1.9.9c.3.1.5.2.5.3.1.2.1.7-.1 1.3z" /></svg>;
}

export function Mark({ size = 34, color = "#B9894D" }: { size?: number; color?: string }) {
  return <svg width={size} height={size} viewBox="0 0 34 34" aria-hidden="true"><circle cx="17" cy="12" r="6" fill="none" stroke={color} strokeWidth="1.8" /><path d="M3 22c3.5-3 7-3 10.5 0s7 3 10.5 0 5-2.4 7-1.2M3 28c3.5-3 7-3 10.5 0s7 3 10.5 0 5-2.4 7-1.2" fill="none" stroke={color} strokeWidth="1.8" strokeLinecap="round" /></svg>;
}

export function Logo({ light = false }: { light?: boolean }) {
  return (
    <Link href="/" className="logo" aria-label="The Royal Nile Residence — home">
      <Mark color={light ? "#E9C792" : "#B9894D"} />
      <span><span className="logo-t" style={{ color: light ? "#fff" : undefined, display: "block" }}>The Royal Nile</span><span className="logo-s" style={{ display: "block" }}>RESIDENCE · ASWAN</span></span>
    </Link>
  );
}

export function ExpCard({ title, summary, image, price, unit, duration, href = "/book" }: { title: string; summary?: string; image: string; price: string; unit: "PERSON" | "GROUP"; duration?: string; href?: string }) {
  return (
    <Link href={href} className="card exp">
      <img className="exp-img" src={image || "/photos/feluccas.webp"} alt={title} loading="lazy" />
      <div className="exp-b">
        <span><span className="chip">LOCAL PRICE</span></span>
        <div className="exp-t">{title}</div>
        {summary ? <div className="small muted mt8">{summary}</div> : null}
        <div className="exp-p">{duration ? <>{duration} · </> : null}from <b>{price}</b> {unit === "GROUP" ? "per car" : "/ person"}</div>
      </div>
    </Link>
  );
}

export const STATUS_PILL: Record<string, string> = {
  REQUEST: "pill-amber", AWAITING_DEPOSIT: "pill-amber", RECEIPT_SENT: "pill-blue", CONFIRMED: "pill-green", CHECKED_IN: "pill-green", COMPLETED: "pill-grey", CANCELLED: "pill-red",
};

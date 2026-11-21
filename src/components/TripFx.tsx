"use client";
// Small moving parts of the guest's trip page: confetti, the live countdown and the share button.
import { useEffect, useRef, useState } from "react";

/** A short burst of gold, navy and cream confetti. Runs once per booking (and once more when it gets confirmed). */
export function Confetti({ id, fire }: { id: string; fire: boolean }) {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    if (!fire) return;
    try { if (localStorage.getItem(`rnr-cheer-${id}`)) return; localStorage.setItem(`rnr-cheer-${id}`, "1"); } catch { /* private mode: still celebrate */ }
    if (window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) return;
    const c = ref.current; const ctx = c?.getContext("2d"); if (!c || !ctx) return;
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    const resize = () => { c.width = innerWidth * dpr; c.height = innerHeight * dpr; };
    resize();
    const colors = ["#B9894D", "#E9C792", "#173A4D", "#F1D7AE", "#3E7EA6", "#ffffff"];
    const parts = Array.from({ length: 160 }, (_, i) => {
      const left = i % 2 === 0;
      return { x: (left ? 0.08 : 0.92) * c.width, y: c.height * 0.62, vx: (left ? 1 : -1) * (4 + Math.random() * 9) * dpr, vy: -(10 + Math.random() * 12) * dpr,
        w: (5 + Math.random() * 6) * dpr, h: (8 + Math.random() * 8) * dpr, r: Math.random() * Math.PI, vr: (Math.random() - .5) * .3, color: colors[i % colors.length], life: 0 };
    });
    let raf = 0; const start = performance.now();
    const tick = (t: number) => {
      ctx.clearRect(0, 0, c.width, c.height);
      for (const p of parts) {
        p.vy += 0.32 * dpr; p.vx *= 0.99; p.x += p.vx; p.y += p.vy; p.r += p.vr; p.life++;
        ctx.save(); ctx.translate(p.x, p.y); ctx.rotate(p.r); ctx.globalAlpha = Math.max(0, 1 - (t - start) / 3800);
        ctx.fillStyle = p.color; ctx.fillRect(-p.w / 2, -p.h / 2, p.w, p.h * Math.abs(Math.cos(p.life / 8))); ctx.restore();
      }
      if (t - start < 3800) raf = requestAnimationFrame(tick); else ctx.clearRect(0, 0, c.width, c.height);
    };
    raf = requestAnimationFrame(tick);
    window.addEventListener("resize", resize);
    return () => { cancelAnimationFrame(raf); window.removeEventListener("resize", resize); };
  }, [id, fire]);
  return <canvas ref={ref} className="tp-confetti" aria-hidden="true" />;
}

/** Live countdown to check-in (Aswan time). */
export function Countdown({ checkIn, time }: { checkIn: string; time: string }) {
  const target = Date.parse(`${checkIn}T${/^\d{1,2}:\d{2}$/.test(time) ? time.padStart(5, "0") : "14:00"}:00+02:00`);
  const [now, setNow] = useState<number | null>(null);
  useEffect(() => { setNow(Date.now()); const t = setInterval(() => setNow(Date.now()), 1000); return () => clearInterval(t); }, []);
  const left = Math.max(0, target - (now ?? target - 1));
  const d = Math.floor(left / 86400000), h = Math.floor(left / 3600000) % 24, m = Math.floor(left / 60000) % 60, s = Math.floor(left / 1000) % 60;
  if (now != null && left <= 0) return <div className="tp-count tp-here">You're in Aswan 🌅</div>;
  const cell = (v: number, l: string) => <div><b suppressHydrationWarning>{now == null ? "–" : String(v).padStart(2, "0")}</b><span>{l}</span></div>;
  return <div className="tp-count" aria-label="Time until check-in">{cell(d, d === 1 ? "day" : "days")}{cell(h, "hours")}{cell(m, "min")}{cell(s, "sec")}</div>;
}

// Shares a friendly message and the residence's website, never the private trip link.
export function ShareTrip({ title, text, url }: { title: string; text: string; url: string }) {
  const [msg, setMsg] = useState("");
  async function share() {
    try {
      if (navigator.share) { await navigator.share({ title, text, url }); return; }
      await navigator.clipboard.writeText(`${text}\n${url}`); setMsg("Link copied ✓"); setTimeout(() => setMsg(""), 2000);
    } catch { /* closed the share sheet */ }
  }
  return <button type="button" className="tp-btn" onClick={share}>{msg || <>👨‍👩‍👧 Share with family</>}</button>;
}

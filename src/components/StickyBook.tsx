"use client";
// Phone-only booking bar that slides up once the hero's booking card has scrolled away.
import { useEffect, useState } from "react";
import Link from "next/link";

export default function StickyBook({ price }: { price: string }) {
  const [show, setShow] = useState(false);
  useEffect(() => {
    const el = document.getElementById("hero-end");
    if (!el || !("IntersectionObserver" in window)) return;
    const io = new IntersectionObserver(([e]) => setShow(!e.isIntersecting && e.boundingClientRect.top < 0));
    io.observe(el);
    return () => io.disconnect();
  }, []);
  return (
    <div className={`sbook ${show ? "on" : ""}`} aria-hidden={!show}>
      <div><b>{price}</b> <span>/ night</span><small>Whole apartment · Nile view</small></div>
      <Link className="btn btn-gold" href="/book" tabIndex={show ? 0 : -1}>Check dates</Link>
    </div>
  );
}

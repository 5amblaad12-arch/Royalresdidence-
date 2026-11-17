"use client";
import { useState } from "react";

export default function CopyText({ text }: { text: string }) {
  const [ok, setOk] = useState(false);
  return (
    <span className="row" style={{ gap: 8 }}>
      <span>{text}</span>
      <button type="button" className="link small" onClick={() => { navigator.clipboard?.writeText(text).then(() => { setOk(true); setTimeout(() => setOk(false), 1500); }); }}>{ok ? "Copied ✓" : "Copy"}</button>
    </span>
  );
}

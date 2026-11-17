"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";

// Photos are shrunk in the browser before upload (phones take 5–10 MB pictures).
async function shrink(file: File): Promise<Blob> {
  if (!file.type.startsWith("image/") || file.size < 900_000) return file;
  try {
    const bmp = await createImageBitmap(file);
    const scale = Math.min(1, 1800 / Math.max(bmp.width, bmp.height));
    const c = document.createElement("canvas");
    c.width = Math.round(bmp.width * scale); c.height = Math.round(bmp.height * scale);
    c.getContext("2d")?.drawImage(bmp, 0, 0, c.width, c.height);
    return await new Promise<Blob>((res) => c.toBlob((b) => res(b ?? file), "image/jpeg", 0.82));
  } catch { return file; }
}

export default function ReceiptUpload({ token }: { token: string }) {
  const router = useRouter();
  const [file, setFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const [done, setDone] = useState(false);

  async function send() {
    if (!file) return setErr("Please choose your receipt first.");
    setBusy(true); setErr("");
    try {
      const blob = await shrink(file);
      const fd = new FormData();
      fd.append("file", blob, blob === file ? file.name : "receipt.jpg");
      const r = await fetch(`/api/trip/${token}/receipt`, { method: "POST", body: fd });
      const j = await r.json().catch(() => ({}));
      if (!r.ok) { setErr(j.error || "Upload failed. Please try again or send it on WhatsApp."); setBusy(false); return; }
      setDone(true); router.refresh();
    } catch { setErr("No connection. Please try again."); }
    setBusy(false);
  }

  if (done) return <div className="ok">Thank you! We've got your receipt and will confirm shortly.</div>;
  return (
    <div>
      <label className="drop">
        <input type="file" accept="image/jpeg,image/png,image/webp,application/pdf" style={{ display: "none" }} onChange={(e) => { setFile(e.target.files?.[0] ?? null); setErr(""); }} />
        {file ? <><b>{file.name}</b><div className="small muted mt8">Tap to choose a different file</div></> : <><b>📎 Choose a screenshot or photo of your receipt</b><div className="small muted mt8">JPG, PNG or PDF</div></>}
      </label>
      {err ? <div className="err mt8" role="alert">{err}</div> : null}
      <button className="btn btn-navy btn-block mt16" type="button" onClick={send} disabled={busy || !file}>{busy ? "Uploading…" : "Send receipt"}</button>
    </div>
  );
}

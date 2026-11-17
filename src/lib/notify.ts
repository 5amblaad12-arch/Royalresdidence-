// Email alerts through Resend, when RESEND_API_KEY and EMAIL_FROM are set. Without them, nothing is sent
// and the booking still works — the owner sees it in the admin (and the guest usually sends it on WhatsApp too).
import { all, run } from "./db";

export async function sendEmail(o: { to: string; subject: string; text: string; html?: string }): Promise<boolean> {
  const key = (process.env.RESEND_API_KEY ?? "").trim(), from = (process.env.EMAIL_FROM ?? "").trim();
  if (!key || !from || !o.to) return false;
  try {
    const r = await fetch("https://api.resend.com/emails", { method: "POST", headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
      body: JSON.stringify({ from, to: [o.to], subject: o.subject, text: o.text, html: o.html }) });
    return r.ok;
  } catch { return false; }
}

export function alertTo(settingsEmail: string): string {
  return (process.env.ALERT_EMAIL ?? "").trim() || settingsEmail || (process.env.ADMIN_EMAIL ?? "").trim();
}

/** Simple limit: at most `max` actions per key in `windowMs`. Returns false when the limit is reached. */
export async function allow(key: string, max: number, windowMs: number): Promise<boolean> {
  const since = Date.now() - windowMs;
  const r = await all<{ c: number }>("SELECT COUNT(*) AS c FROM hits WHERE key = ? AND at > ?", [key, since]);
  if (Number(r[0]?.c ?? 0) >= max) return false;
  await run("INSERT INTO hits (key, at) VALUES (?, ?)", [key, Date.now()]);
  if (Math.random() < 0.05) await run("DELETE FROM hits WHERE at < ?", [Date.now() - 86400_000]);
  return true;
}

export function clientIp(h: Headers): string {
  return (h.get("x-forwarded-for") ?? "").split(",")[0].trim() || h.get("x-real-ip") || "unknown";
}

export const siteUrl = () => (process.env.NEXT_PUBLIC_SITE_URL ?? "").replace(/\/$/, "") || "http://localhost:3000";

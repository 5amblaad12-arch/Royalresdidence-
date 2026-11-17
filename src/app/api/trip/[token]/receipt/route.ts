import { getBookingByToken, logEvent } from "@/lib/data";
import { run } from "@/lib/db";
import { getSettings } from "@/lib/settings";
import { allow, alertTo, clientIp, sendEmail, siteUrl } from "@/lib/notify";
import { usd } from "@/lib/money";

export const dynamic = "force-dynamic";
const TYPES = ["image/jpeg", "image/png", "image/webp", "application/pdf"];
const MAX = 3.5 * 1024 * 1024;

export async function POST(req: Request, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const b = await getBookingByToken(token);
  if (!b) return Response.json({ error: "Booking not found." }, { status: 404 });
  if (b.status === "CANCELLED") return Response.json({ error: "This booking was cancelled. Please message us on WhatsApp." }, { status: 400 });
  if (!(await allow(`receipt:${clientIp(req.headers)}`, 12, 3600_000))) return Response.json({ error: "Too many uploads. Please send the receipt on WhatsApp." }, { status: 429 });

  let form: FormData;
  try { form = await req.formData(); } catch { return Response.json({ error: "The upload didn't arrive. Please try again." }, { status: 400 }); }
  const file = form.get("file");
  if (!file || typeof file === "string") return Response.json({ error: "Please choose a photo or PDF of your receipt." }, { status: 400 });
  if (!TYPES.includes(file.type)) return Response.json({ error: "Please upload a photo (JPG, PNG) or a PDF." }, { status: 400 });
  if (file.size > MAX) return Response.json({ error: "That file is too big (max 3.5 MB). Please send a screenshot instead." }, { status: 400 });
  const buf = Buffer.from(await file.arrayBuffer());
  // Check the file really is what it says (first bytes), so nobody can upload something else.
  const sig = buf.subarray(0, 12);
  const real = (sig[0] === 0xff && sig[1] === 0xd8) || sig.subarray(0, 4).toString("hex") === "89504e47" || (sig.subarray(0, 4).toString() === "RIFF" && sig.subarray(8, 12).toString() === "WEBP") || sig.subarray(0, 4).toString() === "%PDF";
  if (!real) return Response.json({ error: "That file couldn't be read. Please upload a photo or PDF." }, { status: 400 });

  const now = Date.now();
  const rec = await run("INSERT INTO receipts (booking_id, mime, data, size, created_at) VALUES (?, ?, ?, ?, ?)", [b.id, file.type, buf.toString("base64"), buf.length, now]);
  const note = String(form.get("note") ?? "").slice(0, 200);
  await run("INSERT INTO payments (booking_id, amount_usd, method, status, receipt_id, note, created_at) VALUES (?, ?, 'TRANSFER', 'PENDING', ?, ?, ?)", [b.id, b.depositUsd, rec.id, note, now]);
  if (["REQUEST", "AWAITING_DEPOSIT"].includes(b.status)) await run("UPDATE bookings SET status = 'RECEIPT_SENT', hold_until = NULL, seen = 0, updated_at = ? WHERE id = ?", [now, b.id]);
  await logEvent(b.id, "Guest uploaded a payment receipt");

  try {
    const st = await getSettings();
    await sendEmail({ to: alertTo(st.email), subject: `Receipt uploaded · ${b.ref} · ${b.name}`, text: `${b.name} uploaded a payment receipt for ${b.ref} (deposit ${usd(b.depositUsd)}).\nCheck it and confirm: ${siteUrl()}/admin/bookings/${b.id}` });
  } catch { /* optional */ }
  return Response.json({ ok: true });
}

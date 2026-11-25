// Branded PDFs for a booking: booking confirmation, invoice and payment receipt.
// Pure functions: they take the booking data and return PDF bytes, so they can be tested without a database.
import { PDFDocument, StandardFonts, rgb, type PDFFont, type PDFPage, type PDFImage } from "pdf-lib";
import { LOGO_PNG_BASE64 } from "./brand-logo.ts";
import { fmtMoney, type Rates } from "./money.ts";
import { fmtLong, fmtDay } from "./dates.ts";

export type PdfKind = "booking" | "invoice" | "receipt";
export type PdfBooking = {
  ref: string; status: string; checkIn: string; checkOut: string; guests: number; nights: number; nightlyUsd: number; stayUsd: number; cleaningUsd: number;
  totalUsd: number; depositUsd: number; currency: string; holdUntil: number | null; name: string; email: string; phone: string; country: string; createdAt: number;
};
export type PdfItem = { title: string; date: string; time: string; qty: number; unit: string; priceUsd: number; lineUsd: number; status: string };
export type PdfPayment = { id: number; amountUsd: number; method: string; status: string; createdAt: number; note: string };
export type PdfSettings = {
  rates: Rates; whatsapp: string; email: string; instapay: string; bankDetails: string; paymentNote: string; checkInTime: string; checkOutTime: string;
  address: string; arrivalInfo: string; houseRules: string; cancellationPolicy: string; siteUrl: string;
};
export type PdfInput = { kind: PdfKind; booking: PdfBooking; items: PdfItem[]; payments: PdfPayment[]; settings: PdfSettings; paymentId?: number; now?: number };

const C = {
  maroon: rgb(60 / 255, 22 / 255, 26 / 255), bronze: rgb(139 / 255, 109 / 255, 56 / 255), cream: rgb(243 / 255, 235 / 255, 222 / 255), paper: rgb(250 / 255, 246 / 255, 240 / 255),
  ink: rgb(36 / 255, 22 / 255, 26 / 255), muted: rgb(122 / 255, 106 / 255, 98 / 255), rule: rgb(226 / 255, 214 / 255, 197 / 255), white: rgb(1, 1, 1),
  green: rgb(23 / 255, 120 / 255, 74 / 255), greenBg: rgb(231 / 255, 243 / 255, 236 / 255), amber: rgb(160 / 255, 102 / 255, 29 / 255), amberBg: rgb(251 / 255, 240 / 255, 223 / 255),
  red: rgb(180 / 255, 55 / 255, 43 / 255), redBg: rgb(251 / 255, 233 / 255, 231 / 255),
};
const W = 595.28, H = 841.89, M = 48; // A4, margin

const METHOD: Record<string, string> = { CASH: "Cash", INSTAPAY: "InstaPay", TRANSFER: "Bank transfer", CARD: "Card", AGENCY: "Agency / platform", REFUND: "Refund" };
export const methodLabel = (m: string) => METHOD[m] ?? m.charAt(0) + m.slice(1).toLowerCase();
const CONFIRMED = ["CONFIRMED", "CHECKED_IN", "COMPLETED"];

/** Standard PDF fonts only cover Western European characters. Swap the common extras, drop the rest. */
const SWAP: Record<string, string> = { "→": "-", "←": "-", "≈": "~", "✓": "", " ": " ", " ": " ", " ": " ", "−": "-" };
export function pdfSafe(s: string, font: PDFFont): string {
  const ok = new Set(font.getCharacterSet());
  let out = "";
  for (const ch of String(s ?? "").normalize("NFC")) {
    if (ch in SWAP) { out += SWAP[ch]; continue; }
    if (ch === "\n") { out += ch; continue; }
    const cp = ch.codePointAt(0)!;
    if (ok.has(cp)) { out += ch; continue; }
    const base = ch.normalize("NFD").replace(/[̀-ͯ]/g, ""); // é → e if é is missing
    out += [...base].every((c) => ok.has(c.codePointAt(0)!)) ? base : "";
  }
  return out.replace(/[ \t]{2,}/g, " ").trim();
}

const cairo = (ms: number, withTime = false) => new Date(ms).toLocaleString("en-GB", { timeZone: "Africa/Cairo", day: "numeric", month: "short", year: "numeric", ...(withTime ? { hour: "2-digit", minute: "2-digit" } : {}) });

export function docNumber(kind: PdfKind, ref: string, payments: PdfPayment[], paymentId?: number): string {
  if (kind === "invoice") return `INV-${ref}`;
  if (kind === "receipt") {
    const list = receiptable(payments);
    const i = list.findIndex((p) => p.id === paymentId);
    return `RC-${ref}-${i >= 0 ? i + 1 : 0}`;
  }
  return ref;
}
/** Payments that get a receipt: confirmed money in, oldest first. */
export const receiptable = (payments: PdfPayment[]) => payments.filter((p) => p.status === "CONFIRMED" && p.amountUsd > 0).sort((a, b) => a.createdAt - b.createdAt || a.id - b.id);

export function fileName(kind: PdfKind, ref: string, payments: PdfPayment[], paymentId?: number): string {
  const label = kind === "invoice" ? "Invoice" : kind === "receipt" ? "Receipt" : "Booking";
  return `Royal-Nile-${label}-${docNumber(kind, ref, payments, paymentId)}.pdf`.replace(/[^A-Za-z0-9._-]/g, "-");
}

class Writer {
  doc!: PDFDocument; page!: PDFPage; y = 0; serif!: PDFFont; serifI!: PDFFont; sans!: PDFFont; bold!: PDFFont; logo!: PDFImage; pages = 0;
  footerText = "";
  static async make(title: string) {
    const w = new Writer();
    w.doc = await PDFDocument.create();
    w.doc.setTitle(title); w.doc.setAuthor("The Royal Nile Residence"); w.doc.setCreator("The Royal Nile Residence"); w.doc.setProducer("The Royal Nile Residence");
    w.serif = await w.doc.embedFont(StandardFonts.TimesRoman); w.serifI = await w.doc.embedFont(StandardFonts.TimesRomanItalic);
    w.sans = await w.doc.embedFont(StandardFonts.Helvetica); w.bold = await w.doc.embedFont(StandardFonts.HelveticaBold);
    w.logo = await w.doc.embedPng(Buffer.from(LOGO_PNG_BASE64, "base64"));
    return w;
  }
  newPage() { this.page = this.doc.addPage([W, H]); this.pages++; this.y = H - M; }
  ensure(h: number) { if (this.y - h < 86) { this.newPage(); this.y = H - 56; } }
  t(s: string, x: number, y: number, o: { f?: PDFFont; size?: number; color?: ReturnType<typeof rgb>; spacing?: number } = {}) {
    const f = o.f ?? this.sans, size = o.size ?? 10;
    const txt = pdfSafe(s, f);
    if (!txt) return 0;
    if (o.spacing) { let cx = x; for (const ch of txt) { this.page.drawText(ch, { x: cx, y, size, font: f, color: o.color ?? C.ink }); cx += f.widthOfTextAtSize(ch, size) + o.spacing; } return cx - x; }
    this.page.drawText(txt, { x, y, size, font: f, color: o.color ?? C.ink });
    return f.widthOfTextAtSize(txt, size);
  }
  width(s: string, f: PDFFont, size: number, spacing = 0) { const t = pdfSafe(s, f); return f.widthOfTextAtSize(t, size) + spacing * Math.max(0, t.length - 1); }
  right(s: string, xr: number, y: number, o: { f?: PDFFont; size?: number; color?: ReturnType<typeof rgb> } = {}) { const f = o.f ?? this.sans, size = o.size ?? 10; this.t(s, xr - this.width(s, f, size), y, o); }
  wrap(s: string, f: PDFFont, size: number, max: number): string[] {
    const lines: string[] = [];
    for (const para of pdfSafe(s, f).split("\n")) {
      let cur = "";
      for (const word of para.split(/\s+/).filter(Boolean)) {
        const next = cur ? `${cur} ${word}` : word;
        if (f.widthOfTextAtSize(next, size) <= max) cur = next;
        else { if (cur) lines.push(cur); cur = word; while (f.widthOfTextAtSize(cur, size) > max && cur.length > 1) { let k = cur.length - 1; while (k > 1 && f.widthOfTextAtSize(cur.slice(0, k), size) > max) k--; lines.push(cur.slice(0, k)); cur = cur.slice(k); } }
      }
      lines.push(cur);
    }
    return lines;
  }
  para(s: string, x: number, max: number, o: { f?: PDFFont; size?: number; color?: ReturnType<typeof rgb>; lh?: number } = {}) {
    const f = o.f ?? this.sans, size = o.size ?? 9.5, lh = o.lh ?? size * 1.45;
    for (const line of this.wrap(s, f, size, max)) { this.ensure(lh); this.t(line, x, this.y, { f, size, color: o.color ?? C.ink }); this.y -= lh; }
  }
  rect(x: number, y: number, w: number, h: number, color: ReturnType<typeof rgb>, border?: ReturnType<typeof rgb>) { this.page.drawRectangle({ x, y, width: w, height: h, color, ...(border ? { borderColor: border, borderWidth: 0.8 } : {}) }); }
  line(x1: number, y: number, x2: number, color = C.rule, th = 0.8) { this.page.drawLine({ start: { x: x1, y }, end: { x: x2, y }, thickness: th, color }); }
  pill(s: string, xr: number, y: number, fg: ReturnType<typeof rgb>, bg: ReturnType<typeof rgb>) {
    const size = 8, sp = 1.1, tw = this.width(s, this.bold, size, sp), w = tw + 18;
    this.page.drawRectangle({ x: xr - w, y: y - 5, width: w, height: 17, color: bg, borderColor: fg, borderWidth: 0.6, opacity: 1, borderOpacity: 0.5 });
    this.t(s, xr - w + 9, y, { f: this.bold, size, color: fg, spacing: sp });
  }
  label(s: string, x: number, y: number) { this.t(s.toUpperCase(), x, y, { f: this.bold, size: 7.5, color: C.bronze, spacing: 1.3 }); }
  heading(s: string) { this.ensure(40); this.y -= 6; this.t(s, M, this.y, { f: this.serif, size: 15, color: C.maroon }); this.y -= 8; this.line(M, this.y, W - M, C.bronze, 0.6); this.y -= 16; }
  /** Cream band with the logo on the left and the document title block on the right. */
  header(title: string, rows: [string, string][], pill?: [string, ReturnType<typeof rgb>, ReturnType<typeof rgb>]) {
    this.newPage();
    const bandH = 150;
    this.rect(0, H - bandH, W, bandH, C.cream);
    this.rect(0, H - bandH - 3, W, 3, C.bronze);
    const lw = 132, lh = lw * (this.logo.height / this.logo.width);
    this.page.drawImage(this.logo, { x: M - 6, y: H - bandH / 2 - lh / 2, width: lw, height: lh });
    const xr = W - M;
    let y = H - 52;
    const tw = this.width(title.toUpperCase(), this.serif, 22, 3.2);
    this.t(title.toUpperCase(), xr - tw, y, { f: this.serif, size: 22, color: C.maroon, spacing: 3.2 });
    y -= 24;
    for (const [k, v] of rows) { this.right(v, xr, y, { f: this.bold, size: 9.5 }); this.right(k, xr - this.width(v, this.bold, 9.5) - 8, y, { size: 9, color: C.muted }); y -= 14; }
    if (pill) this.pill(pill[0], xr, y - 6, pill[1], pill[2]);
    this.y = H - bandH - 34;
  }
  footer() {
    const total = this.doc.getPageCount();
    this.doc.getPages().forEach((p, i) => {
      p.drawLine({ start: { x: M, y: 58 }, end: { x: W - M, y: 58 }, thickness: 0.6, color: C.bronze });
      const draw = (s: string, x: number, y: number, f: PDFFont, size: number, color: ReturnType<typeof rgb>) => { const t = pdfSafe(s, f); if (t) p.drawText(t, { x, y, size, font: f, color }); };
      draw("The Royal Nile Residence", M, 42, this.serif, 10.5, C.maroon);
      draw(this.footerText, M, 29, this.sans, 7.5, C.muted);
      const pg = `Page ${i + 1} of ${total}`;
      draw(pg, W - M - this.sans.widthOfTextAtSize(pg, 7.5), 42, this.sans, 7.5, C.muted);
    });
  }
}

type Line = { desc: string; sub: string; qty: string; price: string; amount: string };

function lines(b: PdfBooking, items: PdfItem[], money: (n: number) => string): Line[] {
  const out: Line[] = [{ desc: `Nile-view apartment, ${b.nights} night${b.nights === 1 ? "" : "s"}`, sub: `${fmtDay(b.checkIn)} to ${fmtDay(b.checkOut)} · ${b.guests} guest${b.guests === 1 ? "" : "s"}`, qty: String(b.nights), price: money(b.nightlyUsd), amount: money(b.stayUsd) }];
  if (b.cleaningUsd > 0) out.push({ desc: "Cleaning", sub: "", qty: "1", price: money(b.cleaningUsd), amount: money(b.cleaningUsd) });
  for (const i of items.filter((x) => x.status !== "CANCELLED")) {
    out.push({ desc: i.title, sub: `${fmtDay(i.date)}${i.time ? ` · ${i.time}` : ""}${i.unit === "PERSON" ? " · per person" : " · per group"}`, qty: String(i.qty), price: money(i.priceUsd), amount: money(i.lineUsd) });
  }
  return out;
}

function table(w: Writer, rows: Line[]) {
  const cols = { desc: M + 10, qty: W - M - 190, price: W - M - 92, amount: W - M - 10 };
  w.ensure(30);
  w.rect(M, w.y - 8, W - 2 * M, 22, C.maroon);
  const hy = w.y - 1;
  w.t("DESCRIPTION", cols.desc, hy, { f: w.bold, size: 7.5, color: C.white, spacing: 1.1 });
  w.t("QTY", cols.qty - 8, hy, { f: w.bold, size: 7.5, color: C.white, spacing: 1.1 });
  w.right("PRICE", cols.price + 4, hy, { f: w.bold, size: 7.5, color: C.white });
  w.right("AMOUNT", cols.amount, hy, { f: w.bold, size: 7.5, color: C.white });
  w.y -= 30;
  rows.forEach((r, i) => {
    const descLines = w.wrap(r.desc, w.bold, 9.5, cols.qty - cols.desc - 20);
    const h = 14 * descLines.length + (r.sub ? 12 : 0) + 12;
    w.ensure(h);
    if (i % 2 === 1) w.rect(M, w.y - h + 12, W - 2 * M, h, C.paper);
    const top = w.y;
    descLines.forEach((l, k) => w.t(l, cols.desc, top - k * 14, { f: w.bold, size: 9.5 }));
    if (r.sub) w.t(r.sub, cols.desc, top - descLines.length * 14 + 1, { size: 8, color: C.muted });
    w.t(r.qty, cols.qty, top, { size: 9.5 });
    w.right(r.price, cols.price + 4, top, { size: 9.5 });
    w.right(r.amount, cols.amount, top, { f: w.bold, size: 9.5 });
    w.y -= h;
  });
  w.line(M, w.y + 6, W - M, C.rule);
}

function totals(w: Writer, rows: [string, string, "big" | "bold" | "muted" | "green" | "amber" | ""][]) {
  const xl = W - M - 230, xr = W - M - 10;
  w.ensure(rows.length * 18 + 10);
  w.y -= 6;
  rows.forEach(([k, v, kind], idx) => {
    if (kind === "big") {
      if (idx > 0) w.y -= 10;
      w.rect(xl - 10, w.y - 10, xr - xl + 20, 30, C.cream);
      w.t(k, xl, w.y, { f: w.bold, size: 10.5, color: C.maroon });
      w.right(v, xr, w.y - 1, { f: w.serif, size: 17, color: C.maroon });
      w.y -= 30; return;
    }
    const color = kind === "muted" ? C.muted : kind === "green" ? C.green : kind === "amber" ? C.amber : C.ink;
    const f = kind === "bold" || kind === "green" || kind === "amber" ? w.bold : w.sans;
    w.t(k, xl, w.y, { f, size: 9.5, color });
    w.right(v, xr, w.y, { f, size: 9.5, color });
    w.y -= 17;
  });
}

function twoCols(w: Writer, left: [string, string[]], right: [string, string[]]) {
  const xL = M, xR = M + (W - 2 * M) / 2 + 10, max = (W - 2 * M) / 2 - 20;
  const top = w.y;
  w.label(left[0], xL, top); w.label(right[0], xR, top);
  let yl = top - 16, yr = top - 16;
  left[1].filter(Boolean).forEach((s, i) => { for (const l of w.wrap(s, i === 0 ? w.bold : w.sans, i === 0 ? 11 : 9.5, max)) { w.t(l, xL, yl, { f: i === 0 ? w.bold : w.sans, size: i === 0 ? 11 : 9.5, color: i === 0 ? C.ink : C.muted }); yl -= i === 0 ? 15 : 13; } });
  right[1].filter(Boolean).forEach((s, i) => { for (const l of w.wrap(s, i === 0 ? w.bold : w.sans, i === 0 ? 11 : 9.5, max)) { w.t(l, xR, yr, { f: i === 0 ? w.bold : w.sans, size: i === 0 ? 11 : 9.5, color: i === 0 ? C.ink : C.muted }); yr -= i === 0 ? 15 : 13; } });
  w.y = Math.min(yl, yr) - 14;
}

function payBox(w: Writer, s: PdfSettings, amountText: string, ref: string, deadline: string) {
  const rows: [string, string][] = [];
  if (s.instapay) rows.push(["InstaPay", s.instapay]);
  if (s.bankDetails) rows.push(["Bank transfer", s.bankDetails]);
  rows.push(["Reference", ref]);
  const max = W - 2 * M - 150;
  const heights = rows.map(([, v]) => w.wrap(v, w.bold, 9.5, max).length * 13 + 4);
  const h = 48 + heights.reduce((a, b) => a + b, 0) + (s.paymentNote ? 16 : 0);
  w.ensure(h + 10);
  w.rect(M, w.y - h + 14, W - 2 * M, h, C.paper, C.bronze);
  w.label("How to pay", M + 16, w.y - 2);
  w.y -= 20;
  w.t(amountText, M + 16, w.y, { f: w.bold, size: 11, color: C.maroon });
  if (deadline) w.right(deadline, W - M - 16, w.y, { size: 8.5, color: C.amber });
  w.y -= 18;
  rows.forEach(([k, v]) => {
    w.t(k, M + 16, w.y, { size: 9, color: C.muted });
    w.wrap(v, w.bold, 9.5, max).forEach((l, i) => w.t(l, M + 130, w.y - i * 13, { f: w.bold, size: 9.5 }));
    w.y -= w.wrap(v, w.bold, 9.5, max).length * 13 + 4;
  });
  if (s.paymentNote) { w.t(s.paymentNote, M + 16, w.y, { size: 8.5, color: C.muted }); w.y -= 16; }
  w.y -= 18;
}

export async function renderPdf(input: PdfInput): Promise<Uint8Array> {
  const { kind, booking: b, settings: s } = input;
  const items = input.items.filter((i) => i.status !== "CANCELLED");
  const usd = (n: number) => fmtMoney(n, "USD");
  const egp = (n: number) => fmtMoney(n, "EGP", s.rates);
  const guestCur = b.currency === "EUR" || b.currency === "EGP" ? b.currency : "EGP";
  const approx = (n: number) => fmtMoney(n, guestCur as "EUR" | "EGP", s.rates);
  const paid = input.payments.filter((p) => p.status === "CONFIRMED").reduce((a, p) => a + p.amountUsd, 0);
  const balance = Math.round((b.totalUsd - paid) * 100) / 100;
  const cancelled = b.status === "CANCELLED";
  const confirmed = CONFIRMED.includes(b.status);
  const number = docNumber(kind, b.ref, input.payments, input.paymentId);

  const title = kind === "invoice" ? "Invoice" : kind === "receipt" ? "Receipt" : confirmed ? "Booking confirmation" : cancelled ? "Booking" : "Booking summary";
  const w = await Writer.make(`${title} ${number} · The Royal Nile Residence`);
  const first = pdfSafe(b.name || "", w.serifI).split(/\s+/).filter(Boolean)[0] ?? "";
  const hi = (pre: string) => first ? `${pre}, ${first}.` : `${pre}.`;
  w.footerText = [s.address, s.whatsapp ? `WhatsApp +${s.whatsapp.replace(/\D/g, "")}` : "", s.email, s.siteUrl.replace(/^https?:\/\//, "")].filter(Boolean).join("  ·  ");
  const today = cairo(input.now ?? Date.now());

  if (kind === "receipt") {
    const list = receiptable(input.payments);
    const p = list.find((x) => x.id === input.paymentId);
    if (!p) throw new Error("No confirmed payment with that id");
    const paidToDate = list.filter((x) => x.createdAt < p.createdAt || (x.createdAt === p.createdAt && x.id <= p.id)).reduce((a, x) => a + x.amountUsd, 0)
      + input.payments.filter((x) => x.status === "CONFIRMED" && x.amountUsd < 0 && x.createdAt <= p.createdAt).reduce((a, x) => a + x.amountUsd, 0);
    const left = Math.max(0, Math.round((b.totalUsd - paidToDate) * 100) / 100);
    w.header("Receipt", [["Receipt no.", number], ["Date", cairo(p.createdAt)], ["Booking", b.ref]], ["PAID", C.green, C.greenBg]);
    w.t(hi("Thank you"), M, w.y, { f: w.serifI, size: 20, color: C.maroon }); w.y -= 20;
    w.para("This confirms we have received the payment below for your stay at The Royal Nile Residence, Aswan.", M, W - 2 * M, { color: C.muted, size: 10 });
    w.y -= 14;
    // amount card
    w.rect(M, w.y - 74, W - 2 * M, 92, C.cream);
    w.label("Amount received", M + 20, w.y - 4);
    w.t(usd(p.amountUsd), M + 20, w.y - 40, { f: w.serif, size: 34, color: C.maroon });
    w.t(`~ ${egp(p.amountUsd)}`, M + 20, w.y - 60, { size: 9, color: C.muted });
    const rx = W - M - 20;
    const info: [string, string][] = [["Received from", b.name], ["Payment method", methodLabel(p.method)], ["Received on", cairo(p.createdAt, true)]];
    info.forEach(([k, v], i) => { w.right(k.toUpperCase(), rx, w.y - 4 - i * 26, { f: w.bold, size: 7, color: C.bronze }); w.right(v, rx, w.y - 16 - i * 26, { f: w.bold, size: 10 }); });
    w.y -= 110;
    if (p.note) { w.label("Note", M, w.y); w.y -= 14; w.para(p.note, M, W - 2 * M, { size: 9.5 }); w.y -= 6; }
    w.heading("For your booking");
    twoCols(w, ["Stay", [`${fmtLong(b.checkIn)} to ${fmtLong(b.checkOut)}`, `${b.nights} night${b.nights === 1 ? "" : "s"} · ${b.guests} guest${b.guests === 1 ? "" : "s"}`, `Check-in from ${s.checkInTime} · check-out by ${s.checkOutTime}`]],
      ["Booking reference", [b.ref, b.phone ? `WhatsApp ${b.phone}` : "", b.email]]);
    totals(w, [["Booking total", usd(b.totalUsd), ""], ["Paid to date", usd(paidToDate), "green"], [left > 0 ? "Balance remaining" : "Balance", left > 0 ? usd(left) : "Fully paid", left > 0 ? "big" : "big"]]);
    if (left > 0) { w.right(`~ ${egp(left)} · payable on arrival or before`, W - M - 10, w.y + 6, { size: 8, color: C.muted }); w.y -= 10; }
    w.y -= 24;
    w.para("Keep this receipt for your records. If anything looks wrong, message us on WhatsApp with your booking reference.", M, W - 2 * M, { size: 8.5, color: C.muted });
  } else if (kind === "invoice") {
    const state: [string, ReturnType<typeof rgb>, ReturnType<typeof rgb>] = cancelled ? ["CANCELLED", C.red, C.redBg] : balance <= 0.005 ? ["PAID", C.green, C.greenBg] : paid > 0 ? ["PART PAID", C.amber, C.amberBg] : ["UNPAID", C.amber, C.amberBg];
    w.header("Invoice", [["Invoice no.", number], ["Issued", today], ["Booking", b.ref]], state);
    twoCols(w, ["Billed to", [b.name, b.phone, b.email, b.country]], ["Stay", [`${fmtLong(b.checkIn)} to ${fmtLong(b.checkOut)}`, `${b.nights} night${b.nights === 1 ? "" : "s"} · ${b.guests} guest${b.guests === 1 ? "" : "s"}`, `Booked ${cairo(b.createdAt)}`]]);
    table(w, lines(b, items, usd));
    const rows: [string, string, "big" | "bold" | "muted" | "green" | "amber" | ""][] = [["Total", usd(b.totalUsd), "big"]];
    for (const p of input.payments.filter((x) => x.status === "CONFIRMED").sort((a, c) => a.createdAt - c.createdAt)) rows.push([`${p.amountUsd < 0 ? "Refund" : "Paid"} · ${methodLabel(p.method)} · ${cairo(p.createdAt)}`, p.amountUsd < 0 ? `+${usd(-p.amountUsd)}` : `-${usd(p.amountUsd)}`, "muted"]);
    rows.push([balance > 0 ? "Balance due" : balance < 0 ? "Credit" : "Balance due", balance > 0 ? usd(balance) : balance < 0 ? usd(-balance) : usd(0), balance > 0 ? "amber" : "green"]);
    totals(w, rows);
    w.right(`Total ~ ${approx(b.totalUsd)}${balance > 0 ? ` · balance ~ ${approx(balance)}` : ""}`, W - M - 10, w.y + 4, { size: 8, color: C.muted });
    w.y -= 22;
    if (!cancelled && balance > 0) {
      const depositLeft = !confirmed ? Math.max(0, b.depositUsd - paid) : 0;
      if (depositLeft > 0) payBox(w, s, `Deposit to confirm: ${usd(depositLeft)} (~ ${egp(depositLeft)})`, b.ref, b.holdUntil ? `Dates held until ${cairo(b.holdUntil, true)}` : "");
      else payBox(w, s, `Balance: ${usd(balance)} (~ ${egp(balance)}), payable on arrival or before`, b.ref, "");
    }
    w.para(`Prices are in US dollars. Amounts in ${guestCur === "EUR" ? "euros" : "Egyptian pounds"} are approximate (1 USD = ${guestCur === "EUR" ? s.rates.EUR : s.rates.EGP} ${guestCur}). Experiences are arranged with trusted local partners and charged at local prices.`, M, W - 2 * M, { size: 8, color: C.muted });
  } else {
    const state: [string, ReturnType<typeof rgb>, ReturnType<typeof rgb>] | undefined = cancelled ? ["CANCELLED", C.red, C.redBg] : confirmed ? ["CONFIRMED", C.green, C.greenBg] : b.status === "RECEIPT_SENT" ? ["CHECKING PAYMENT", C.amber, C.amberBg] : ["AWAITING DEPOSIT", C.amber, C.amberBg];
    w.header(confirmed ? "Confirmation" : "Booking", [["Booking", b.ref], ["Date", today]], state);
    const hello = confirmed ? hi("Aswan is waiting for you") : cancelled ? `Booking ${b.ref}` : hi("Almost there");
    w.t(hello, M, w.y, { f: w.serifI, size: 20, color: C.maroon }); w.y -= 20;
    w.para(confirmed ? "Your stay is confirmed. Everything you need is on this page: your dates, your plans in Aswan and how to find us."
      : cancelled ? "This booking has been cancelled. Message us on WhatsApp if you have any questions."
      : "Your dates are held for you. Pay the deposit below to confirm your stay — we will send your confirmation as soon as it arrives.", M, W - 2 * M, { color: C.muted, size: 10 });
    w.y -= 12;
    // stay strip
    w.ensure(70);
    const cw = (W - 2 * M) / 4;
    w.rect(M, w.y - 46, W - 2 * M, 60, C.cream);
    ([["Check-in", fmtDay(b.checkIn), `from ${s.checkInTime}`], ["Check-out", fmtDay(b.checkOut), `by ${s.checkOutTime}`], ["Nights", String(b.nights), "Nile-view apartment"], ["Guests", String(b.guests), "3 bedrooms"]] as const)
      .forEach(([k, v, sub], i) => { const x = M + 16 + i * cw; w.label(k, x, w.y - 2); w.t(v, x, w.y - 22, { f: w.serif, size: 16, color: C.maroon }); w.t(sub, x, w.y - 36, { size: 8, color: C.muted }); });
    w.y -= 78;
    twoCols(w, ["Guest", [b.name, b.phone, b.email, b.country]], ["Where", ["The Royal Nile Residence", s.address]]);

    w.heading("Your days in Aswan");
    const days: [string, string[]][] = [];
    const byDate = new Map<string, PdfItem[]>();
    for (const i of items) byDate.set(i.date, [...(byDate.get(i.date) ?? []), i]);
    days.push([b.checkIn, [`Arrival · check-in from ${s.checkInTime}`]]);
    for (const [d, list] of [...byDate.entries()].sort()) {
      const lbl = list.map((i) => `${i.title}${i.qty > 1 ? ` × ${i.qty}` : ""}${i.time ? ` · ${i.time}` : " · time to be confirmed"}`);
      const ex = days.find(([dd]) => dd === d); if (ex) ex[1].push(...lbl); else days.push([d, lbl]);
    }
    const out = days.find(([d]) => d === b.checkOut); const co = `Check-out by ${s.checkOutTime}`;
    if (out) out[1].push(co); else days.push([b.checkOut, [co]]);
    days.sort((a, c) => a[0].localeCompare(c[0]));
    for (const [d, list] of days) {
      w.ensure(16 * list.length + 6);
      w.t(fmtDay(d), M, w.y, { f: w.bold, size: 9, color: C.bronze });
      list.forEach((l, k) => w.t(l, M + 110, w.y - k * 15, { size: 9.5 }));
      w.y -= 15 * list.length + 6;
    }
    if (!items.length) { w.para("No experiences added yet. Feluccas, Philae, Abu Simbel, Nubian village — message us and we'll arrange them at local prices.", M, W - 2 * M, { size: 9, color: C.muted }); }
    w.y -= 4;

    w.heading("Price");
    table(w, lines(b, items, usd));
    const rows: [string, string, "big" | "bold" | "muted" | "green" | "amber" | ""][] = [["Total", usd(b.totalUsd), "big"]];
    if (paid > 0) rows.push(["Paid", usd(paid), "green"]);
    rows.push([confirmed ? "Due on arrival" : "Deposit to confirm", confirmed ? usd(Math.max(0, balance)) : usd(Math.max(0, b.depositUsd - paid)), "amber"]);
    totals(w, rows);
    w.right(`Total ~ ${approx(b.totalUsd)}`, W - M - 10, w.y + 4, { size: 8, color: C.muted });
    w.y -= 22;
    if (!confirmed && !cancelled && b.depositUsd - paid > 0) payBox(w, s, `Deposit: ${usd(b.depositUsd - paid)} (~ ${egp(b.depositUsd - paid)})`, b.ref, b.holdUntil ? `Held until ${cairo(b.holdUntil, true)}` : "");
    if (confirmed && s.arrivalInfo) { w.heading("Arrival details"); w.para(s.arrivalInfo, M, W - 2 * M); w.y -= 4; }
    if (s.houseRules) { w.heading("House rules"); w.para(s.houseRules, M, W - 2 * M, { size: 9 }); w.y -= 4; }
    if (s.cancellationPolicy) { w.heading("Changes & cancellation"); w.para(s.cancellationPolicy, M, W - 2 * M, { size: 9 }); }
  }
  w.footer();
  return w.doc.save();
}

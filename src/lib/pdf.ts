// Branded PDFs for a booking: booking confirmation, invoice and payment receipt.
// Same look as the website: cream page, white rounded cards, photo header with a maroon overlay, round pills.
// Pure functions: they take the booking data and return PDF bytes, so they can be tested without a database.
import {
  PDFDocument, StandardFonts, rgb, pushGraphicsState, popGraphicsState, moveTo, lineTo, appendBezierCurve, closePath, clip, endPath,
  type PDFFont, type PDFPage, type PDFImage, type RGB,
} from "pdf-lib";
import { MARK_PNG_BASE64, HERO_JPG_BASE64 } from "./brand-logo.ts";
import { fmtMoney, type Rates } from "./money.ts";
import { fmtLong, fmtDay, weekday } from "./dates.ts";

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

const hex = (h: string) => rgb(parseInt(h.slice(1, 3), 16) / 255, parseInt(h.slice(3, 5), 16) / 255, parseInt(h.slice(5, 7), 16) / 255);
// Website colours (globals.css)
const C = {
  paper: hex("#F7F0E5"), card: hex("#FFFFFF"), ink: hex("#24161A"), ink2: hex("#4A3B3A"), muted: hex("#7A6A62"), faint: hex("#A59A8C"),
  rule: hex("#E9DFD0"), rule2: hex("#D9CCBA"), navy: hex("#3C161A"), gold: hex("#8B6D38"), gold2: hex("#D4B57C"), cream: hex("#EBDCC0"),
  sand: hex("#F3EBDE"), green: hex("#17784A"), greenBg: hex("#E7F3EC"), amber: hex("#A0661D"), amberBg: hex("#FBF0DF"), red: hex("#B4372B"), redBg: hex("#FBE9E7"),
  white: rgb(1, 1, 1), heroSub: hex("#E6D6D2"), noteBg: hex("#FFF8EA"), noteBorder: hex("#F0DDB8"), noteInk: hex("#7A5A26"), check: hex("#54D68C"), dark: hex("#2C0F13"),
};
const W = 595.28, H = 841.89, M = 34, CW = W - 2 * M, FOOT = 62;

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
    if (ok.has(ch.codePointAt(0)!)) { out += ch; continue; }
    const base = ch.normalize("NFD").replace(/[̀-ͯ]/g, ""); // é → e if é is missing
    out += [...base].every((c) => ok.has(c.codePointAt(0)!)) ? base : "";
  }
  return out.replace(/[ \t]{2,}/g, " ").trim();
}

const cairo = (ms: number, withTime = false) => new Date(ms).toLocaleString("en-GB", { timeZone: "Africa/Cairo", day: "numeric", month: "short", year: "numeric", ...(withTime ? { hour: "2-digit", minute: "2-digit" } : {}) });

/** Payments that get a receipt: confirmed money in, oldest first. */
export const receiptable = (payments: PdfPayment[]) => payments.filter((p) => p.status === "CONFIRMED" && p.amountUsd > 0).sort((a, b) => a.createdAt - b.createdAt || a.id - b.id);

export function docNumber(kind: PdfKind, ref: string, payments: PdfPayment[], paymentId?: number): string {
  if (kind === "invoice") return `INV-${ref}`;
  if (kind === "receipt") { const i = receiptable(payments).findIndex((p) => p.id === paymentId); return `RC-${ref}-${i >= 0 ? i + 1 : 0}`; }
  return ref;
}

export function fileName(kind: PdfKind, ref: string, payments: PdfPayment[], paymentId?: number): string {
  const label = kind === "invoice" ? "Invoice" : kind === "receipt" ? "Receipt" : "Booking";
  return `Royal-Nile-${label}-${docNumber(kind, ref, payments, paymentId)}.pdf`.replace(/[^A-Za-z0-9._-]/g, "-");
}

type Font = PDFFont;
type TextOpt = { f?: Font; size?: number; color?: RGB; spacing?: number; opacity?: number };
const K = 0.5523; // bezier circle constant

class Doc {
  doc!: PDFDocument; page!: PDFPage; y = 0;
  serif!: Font; serifI!: Font; sans!: Font; bold!: Font; mark!: PDFImage; hero!: PDFImage;
  number = ""; ref = ""; footer = "";
  static async make(title: string) {
    const d = new Doc();
    d.doc = await PDFDocument.create();
    d.doc.setTitle(title); d.doc.setAuthor("The Royal Nile Residence"); d.doc.setCreator("The Royal Nile Residence"); d.doc.setProducer("The Royal Nile Residence");
    d.serif = await d.doc.embedFont(StandardFonts.TimesRoman); d.serifI = await d.doc.embedFont(StandardFonts.TimesRomanItalic);
    d.sans = await d.doc.embedFont(StandardFonts.Helvetica); d.bold = await d.doc.embedFont(StandardFonts.HelveticaBold);
    d.mark = await d.doc.embedPng(Buffer.from(MARK_PNG_BASE64, "base64"));
    d.hero = await d.doc.embedJpg(Buffer.from(HERO_JPG_BASE64, "base64"));
    return d;
  }

  // ---------- page ----------
  newPage(first = false) {
    this.page = this.doc.addPage([W, H]);
    this.page.drawRectangle({ x: 0, y: 0, width: W, height: H, color: C.paper });
    // site header: monogram + wordmark
    const mh = 26, mw = mh * (this.mark.width / this.mark.height);
    this.page.drawImage(this.mark, { x: M, y: H - 20 - mh, width: mw, height: mh });
    this.text("THE ROYAL NILE", M + mw + 9, H - 32, { f: this.serif, size: 11, color: C.navy, spacing: 2.2 });
    this.text("RESIDENCE · ASWAN", M + mw + 9, H - 43, { f: this.bold, size: 5.8, color: C.gold, spacing: 1.9 });
    if (!first) this.pill(this.number, W - M, H - 38, { fg: C.navy, bg: C.card, border: C.rule });
    this.y = H - 60;
  }
  need(h: number) { if (this.y - h < FOOT) this.newPage(); }
  gap(n = 12) { this.y -= n; }

  // ---------- drawing ----------
  text(s: string, x: number, y: number, o: TextOpt = {}) {
    const f = o.f ?? this.sans, size = o.size ?? 10, t = pdfSafe(s, f);
    if (!t) return 0;
    const base = { size, font: f, color: o.color ?? C.ink, opacity: o.opacity ?? 1 };
    if (!o.spacing) { this.page.drawText(t, { x, y, ...base }); return f.widthOfTextAtSize(t, size); }
    let cx = x; for (const ch of t) { this.page.drawText(ch, { x: cx, y, ...base }); cx += f.widthOfTextAtSize(ch, size) + o.spacing; }
    return cx - x - o.spacing;
  }
  tw(s: string, f: Font, size: number, spacing = 0) { const t = pdfSafe(s, f); return f.widthOfTextAtSize(t, size) + spacing * Math.max(0, [...t].length - 1); }
  right(s: string, xr: number, y: number, o: TextOpt = {}) { const f = o.f ?? this.sans, size = o.size ?? 10; this.text(s, xr - this.tw(s, f, size, o.spacing ?? 0), y, o); }
  center(s: string, xc: number, y: number, o: TextOpt = {}) { const f = o.f ?? this.sans, size = o.size ?? 10; this.text(s, xc - this.tw(s, f, size, o.spacing ?? 0) / 2, y, o); }
  wrap(s: string, f: Font, size: number, max: number): string[] {
    const lines: string[] = [];
    for (const para of pdfSafe(s, f).split("\n")) {
      let cur = "";
      for (const word of para.split(/\s+/).filter(Boolean)) {
        const next = cur ? `${cur} ${word}` : word;
        if (f.widthOfTextAtSize(next, size) <= max) { cur = next; continue; }
        if (cur) lines.push(cur);
        cur = word;
        while (f.widthOfTextAtSize(cur, size) > max && cur.length > 1) { let k = cur.length - 1; while (k > 1 && f.widthOfTextAtSize(cur.slice(0, k), size) > max) k--; lines.push(cur.slice(0, k)); cur = cur.slice(k); }
      }
      if (cur) lines.push(cur);
    }
    return lines;
  }
  /** Rounded rectangle. (x, top) is the top-left corner. */
  rr(x: number, top: number, w: number, h: number, r: number, o: { fill?: RGB; border?: RGB; bw?: number; opacity?: number; bo?: number }) {
    r = Math.min(r, w / 2, h / 2); const k = r * K;
    const p = `M ${r} 0 H ${w - r} C ${w - r + k} 0 ${w} ${r - k} ${w} ${r} V ${h - r} C ${w} ${h - r + k} ${w - r + k} ${h} ${w - r} ${h} H ${r} C ${r - k} ${h} 0 ${h - r + k} 0 ${h - r} V ${r} C 0 ${r - k} ${r - k} 0 ${r} 0 Z`;
    this.page.drawSvgPath(p, { x, y: top, color: o.fill, opacity: o.opacity ?? 1, borderColor: o.border, borderWidth: o.border ? o.bw ?? 0.8 : 0, borderOpacity: o.bo ?? 1 });
  }
  /** White website card with a soft shadow. */
  card(x: number, top: number, w: number, h: number, o: { fill?: RGB; border?: RGB; bw?: number; r?: number } = {}) {
    const r = o.r ?? 16;
    this.rr(x, top - 3, w, h, r, { fill: C.navy, opacity: 0.045 });
    this.rr(x, top, w, h, r, { fill: o.fill ?? C.card, border: o.border ?? C.rule, bw: o.bw });
  }
  pill(s: string, xr: number, base: number, o: { fg: RGB; bg: RGB; border?: RGB; size?: number; bold?: boolean; glass?: boolean }) {
    const size = o.size ?? 8.5, f = o.bold === false ? this.sans : this.bold, sp = o.bold === false ? 0 : 0.6;
    const w = this.tw(s, f, size, sp) + 20, h = size + 11;
    if (o.glass) {
      this.rr(xr - w, base + size + 3.5, w, h, h / 2, { fill: C.white, opacity: 0.14, border: C.white, bw: 0.5, bo: 0.35 });
    } else this.rr(xr - w, base + size + 3.5, w, h, h / 2, { fill: o.bg, border: o.border });
    this.text(s, xr - w + 10, base, { f, size, color: o.fg, spacing: sp });
    return w;
  }
  label(s: string, x: number, base: number, color = C.gold) { this.text(s.toUpperCase(), x, base, { f: this.bold, size: 7.2, color, spacing: 1.25 }); }
  circle(cx: number, cy: number, r: number, o: { fill?: RGB; border?: RGB; bw?: number }) {
    this.page.drawCircle({ x: cx, y: cy, size: r, color: o.fill, borderColor: o.border, borderWidth: o.border ? o.bw ?? 1 : 0 });
  }
  tick(cx: number, cy: number, s: number, color: RGB, th = 1.6) {
    this.page.drawSvgPath(`M ${-s * 0.55} 0 L ${-s * 0.15} ${s * 0.4} L ${s * 0.6} ${-s * 0.42}`, { x: cx, y: cy, borderColor: color, borderWidth: th, borderLineCap: 1 });
  }
  /** Image clipped to a rounded rectangle, covering it like CSS object-fit: cover. */
  roundImage(img: PDFImage, x: number, top: number, w: number, h: number, r: number) {
    const k = r * K, b = top - h;
    this.page.pushOperators(pushGraphicsState(),
      moveTo(x + r, top), lineTo(x + w - r, top), appendBezierCurve(x + w - r + k, top, x + w, top - r + k, x + w, top - r),
      lineTo(x + w, b + r), appendBezierCurve(x + w, b + r - k, x + w - r + k, b, x + w - r, b),
      lineTo(x + r, b), appendBezierCurve(x + r - k, b, x, b + r - k, x, b + r),
      lineTo(x, top - r), appendBezierCurve(x, top - r + k, x + r - k, top, x + r, top), closePath(), clip(), endPath());
    const s = Math.max(w / img.width, h / img.height), iw = img.width * s, ih = img.height * s;
    this.page.drawImage(img, { x: x + (w - iw) / 2, y: b + (h - ih) / 2, width: iw, height: ih });
    this.page.pushOperators(popGraphicsState());
  }

  // ---------- blocks ----------
  /** Photo header like the website's trip page: photo, maroon overlay, kicker, big serif title, glass tiles. */
  heroBlock(o: { kicker: string; tick: boolean; status?: [string, RGB, RGB]; title: string; name: string; titleEnd?: string; sub: string; tiles: [string, string][] }) {
    const h = 216, top = this.y, x = M;
    this.roundImage(this.hero, x, top, CW, h, 22);
    this.rr(x, top, CW, h, 22, { fill: C.dark, opacity: 0.74 });
    this.rr(x, top - h * 0.5, CW, h * 0.5, 22, { fill: C.dark, opacity: 0.3 });
    const px = x + 26;
    let base = top - 36;
    if (o.tick) { this.circle(px + 8, base + 3, 8, { border: C.check, bw: 1.6 }); this.tick(px + 8, base + 3, 4.5, C.check, 1.5); }
    this.text(o.kicker.toUpperCase(), px + (o.tick ? 24 : 0), base, { f: this.bold, size: 8.2, color: C.gold2, spacing: 1.6 });
    const bw = this.pill(`Booking ${this.ref}`, x + CW - 22, base - 1, { fg: C.white, bg: C.white, glass: true, size: 8, bold: false });
    if (o.status) this.pill(o.status[0], x + CW - 22 - bw - 6, base - 1, { fg: o.status[1], bg: o.status[2], size: 8 });
    base -= 44;
    const start = o.title, nm = o.name, end = o.titleEnd ?? "";
    let size = 34;
    const width = (sz: number) => this.tw(start, this.serif, sz) + (nm ? this.tw(nm, this.serifI, sz) + sz * 0.25 : 0) + this.tw(end, this.serif, sz);
    while (width(size) > CW - 60 && size > 24) size -= 1;
    const sp = size * 0.25; // the trailing space of the title is trimmed by the safe-text helper
    if (width(size) > CW - 60) {
      this.text(start, px, base, { f: this.serif, size, color: C.white });
      base -= size * 1.05;
      const w2 = this.text(nm, px, base, { f: this.serifI, size, color: C.cream }); this.text(end, px + w2, base, { f: this.serif, size, color: C.white });
    } else {
      const w1 = this.text(start, px, base, { f: this.serif, size, color: C.white });
      const w2 = nm ? this.text(nm, px + w1 + sp, base, { f: this.serifI, size, color: C.cream }) + sp : 0;
      this.text(end, px + w1 + w2, base, { f: this.serif, size, color: C.white });
    }
    base -= 22;
    for (const l of this.wrap(o.sub, this.sans, 10, CW - 150).slice(0, 2)) { this.text(l, px, base, { size: 10, color: C.heroSub }); base -= 14; }
    const n = o.tiles.length, gap = 8, tw = Math.min(112, (CW - 52 - gap * (n - 1)) / n), th = 52, tt = top - h + 22 + th;
    o.tiles.forEach(([k, v], i) => {
      const tx = px + i * (tw + gap);
      this.rr(tx, tt, tw, th, 14, { fill: C.white, opacity: 0.12, border: C.white, bw: 0.5, bo: 0.2 });
      let vs = 16; while (this.tw(v, this.serif, vs) > tw - 20 && vs > 9) vs -= 0.5;
      this.text(v, tx + 11, tt - 25, { f: this.serif, size: vs, color: C.white });
      this.text(k.toUpperCase(), tx + 11, tt - 41, { f: this.bold, size: 6.3, color: C.white, spacing: 1, opacity: 0.72 });
    });
    this.y = top - h;
  }

  /** The website's 4-step tracker card, overlapping the header like on the trip page. */
  tracker(steps: { label: string; sub: string; state: "done" | "now" | "todo" }[]) {
    const h = 76, top = this.y + 20;
    this.card(M + 16, top, CW - 32, h, { r: 18 });
    const n = steps.length, colW = (CW - 32) / n, cy = top - 26, x0 = M + 16 + colW / 2, x1 = M + 16 + colW * (n - 0.5);
    const reached = steps.reduce((a, s, i) => (s.state !== "todo" ? i : a), 0);
    this.page.drawLine({ start: { x: x0, y: cy }, end: { x: x1, y: cy }, thickness: 3, color: C.rule, lineCap: 1 });
    if (reached > 0) this.page.drawLine({ start: { x: x0, y: cy }, end: { x: x0 + (x1 - x0) * (reached / (n - 1)), y: cy }, thickness: 3, color: C.gold, lineCap: 1 });
    steps.forEach((s, i) => {
      const cx = x0 + i * colW;
      if (s.state === "done") { this.circle(cx, cy, 11, { fill: C.gold }); this.tick(cx, cy, 5, C.white, 1.6); }
      else { this.circle(cx, cy, 11, { fill: C.white, border: s.state === "now" ? C.gold : C.rule2, bw: 1.5 }); this.center(String(i + 1), cx, cy - 3.5, { f: this.bold, size: 9.5, color: s.state === "now" ? C.gold : C.faint }); }
      this.center(s.label, cx, cy - 27, { f: this.bold, size: 9, color: s.state === "todo" ? C.faint : C.ink });
      this.center(s.sub, cx, cy - 38, { size: 7.5, color: C.muted });
    });
    this.y = top - h;
  }

  infoCard(x: number, top: number, w: number, h: number, label: string, lines: string[]) {
    this.card(x, top, w, h);
    this.label(label, x + 16, top - 22);
    let b = top - 40;
    lines.filter(Boolean).forEach((s, i) => {
      for (const l of this.wrap(s, i === 0 ? this.bold : this.sans, i === 0 ? 11 : 9.2, w - 32)) {
        this.text(l, x + 16, b, { f: i === 0 ? this.bold : this.sans, size: i === 0 ? 11 : 9.2, color: i === 0 ? C.ink : C.muted }); b -= i === 0 ? 15 : 13;
      }
    });
  }
  infoHeight(w: number, lines: string[]) {
    return 50 + lines.filter(Boolean).reduce((a, s, i) => a + this.wrap(s, i === 0 ? this.bold : this.sans, i === 0 ? 11 : 9.2, w - 32).length * (i === 0 ? 15 : 13), 0);
  }
  twoCards(a: [string, string[]], b: [string, string[]]) {
    const w = (CW - 12) / 2, h = Math.max(this.infoHeight(w, a[1]), this.infoHeight(w, b[1]));
    this.need(h + 4);
    this.infoCard(M, this.y, w, h, a[0], a[1]); this.infoCard(M + w + 12, this.y, w, h, b[0], b[1]);
    this.y -= h;
  }
  tile(x: number, top: number, w: number, h: number, k: string, v: string, sub: string) {
    this.rr(x, top, w, h, 12, { fill: C.card, border: C.rule2 });
    this.label(k, x + 11, top - 15, C.faint);
    this.text(v, x + 11, top - 30, { f: this.bold, size: 10.5 });
    if (sub) this.text(sub, x + 11, top - 42, { size: 7.8, color: C.muted });
  }
  sectionStart(title: string, aside: string, h: number) {
    this.need(h + 4);
    const top = this.y;
    this.card(M, top, CW, h);
    this.text(title, M + 18, top - 31, { f: this.serif, size: 19, color: C.ink });
    if (aside) this.right(aside, M + CW - 18, top - 29, { size: 8.5, color: C.muted });
    return top;
  }
}

type Row = { title: string; sub: string; qty: string; amount: string };
function priceRows(b: PdfBooking, items: PdfItem[], money: (n: number) => string): Row[] {
  const rows: Row[] = [{ title: `${b.nights} night${b.nights === 1 ? "" : "s"} · Nile-view apartment`, sub: `${fmtDay(b.checkIn)} to ${fmtDay(b.checkOut)} · ${b.guests} guest${b.guests === 1 ? "" : "s"}`, qty: `${b.nights} × ${money(b.nightlyUsd)}`, amount: money(b.stayUsd) }];
  if (b.cleaningUsd > 0) rows.push({ title: "Cleaning", sub: "", qty: "", amount: money(b.cleaningUsd) });
  for (const i of items) rows.push({ title: i.title, sub: `${fmtDay(i.date)}${i.time ? ` · ${i.time}` : ""}`, qty: `${i.qty} × ${money(i.priceUsd)}${i.unit === "PERSON" ? " / person" : ""}`, amount: money(i.lineUsd) });
  return rows;
}

/** Price card: rows, big serif total, cream boxes for paid / to pay. */
function priceCard(d: Doc, title: string, rows: Row[], total: string, boxes: [string, string, RGB][], extra: string[], note: string) {
  const rowH = 36, h = 52 + rows.length * rowH + 44 + extra.length * 14 + (boxes.length ? 58 : 0) + (note ? 16 : 0) + 8;
  const top = d.sectionStart(title, "", h);
  let y = top - 48;
  for (const r of rows) {
    d.page.drawLine({ start: { x: M + 18, y }, end: { x: M + CW - 18, y }, thickness: 0.6, color: C.rule });
    d.text(r.title, M + 18, y - 15, { f: d.bold, size: 10 });
    if (r.sub) d.text(r.sub, M + 18, y - 28, { size: 8, color: C.muted });
    if (r.qty) d.right(r.qty, M + CW - 120, y - 15, { size: 8.8, color: C.muted });
    d.right(r.amount, M + CW - 18, y - 15, { f: d.bold, size: 10 });
    y -= rowH;
  }
  d.page.drawLine({ start: { x: M + 18, y }, end: { x: M + CW - 18, y }, thickness: 0.6, color: C.rule });
  y -= 30;
  d.text("Total", M + 18, y, { f: d.bold, size: 12 });
  d.right(total, M + CW - 18, y - 2, { f: d.serif, size: 26, color: C.navy });
  y -= 16;
  for (const e of extra) { d.right(e, M + CW - 18, y, { size: 8.3, color: C.muted }); y -= 14; }
  if (boxes.length) {
    y -= 4;
    const gap = 8, bw = (CW - 36 - gap * (boxes.length - 1)) / boxes.length;
    boxes.forEach(([k, v, col], i) => {
      const bx = M + 18 + i * (bw + gap);
      d.rr(bx, y, bw, 44, 12, { fill: C.paper });
      d.text(k, bx + 12, y - 16, { size: 8.2, color: C.muted });
      d.text(v, bx + 12, y - 33, { f: d.bold, size: 12.5, color: col });
    });
    y -= 54;
  }
  if (note) d.text(note, M + 18, y - 4, { size: 7.8, color: C.muted });
  d.y = top - h;
}

/** "Pay the deposit" card like the website: bronze border, numbered steps. */
function payCard(d: Doc, s: PdfSettings, ref: string, amount: string, deadline: string) {
  const rows: [string, string][] = [];
  if (s.instapay) rows.push(["InstaPay", s.instapay]);
  if (s.bankDetails) rows.push(["Bank transfer", s.bankDetails]);
  rows.push(["Reference", ref]);
  const vw = CW - 36 - 134;
  const rowsH = rows.reduce((a, [, v]) => a + d.wrap(v, d.bold, 9.5, vw).length * 13 + 6, 0);
  const h = 96 + rowsH + (s.paymentNote ? 16 : 0) + 12 + 36 + 34 + 8;
  d.need(h + 4);
  const top = d.y;
  d.card(M, top, CW, h, { border: C.gold, bw: 1.6 });
  d.label("Pay the deposit", M + 18, top - 24);
  d.text(amount, M + 18, top - 52, { f: d.serif, size: 24, color: C.ink });
  if (deadline) {
    const w = d.tw(deadline, d.bold, 8.5) + 24;
    d.rr(M + CW - 18 - w, top - 16, w, 30, 12, { fill: C.amberBg });
    d.text(deadline, M + CW - 18 - w + 12, top - 34.5, { f: d.bold, size: 8.5, color: C.amber });
  }
  let y = top - 82;
  const cx = M + 30;
  const step = (n: number, title: string) => { d.circle(cx, y - 3, 11, { fill: C.navy }); d.center(String(n), cx, y - 6.5, { f: d.bold, size: 9.5, color: C.white }); d.text(title, M + 52, y - 7, { f: d.bold, size: 10.5 }); };
  const y0 = y;
  step(1, "Send the deposit");
  y -= 28;
  for (const [k, v] of rows) {
    d.text(k, M + 52, y, { size: 9, color: C.muted });
    const ls = d.wrap(v, d.bold, 9.5, vw); ls.forEach((l, i) => d.text(l, M + 152, y - i * 13, { f: d.bold, size: 9.5 }));
    y -= ls.length * 13 + 6;
  }
  if (s.paymentNote) { d.text(s.paymentNote, M + 52, y, { size: 8.2, color: C.muted }); y -= 16; }
  y -= 12;
  const y2 = y;
  step(2, "Upload your receipt"); d.text("On your trip page, or send it to us on WhatsApp.", M + 52, y - 20, { size: 8.5, color: C.muted });
  y -= 36;
  step(3, "We confirm"); d.text("Usually within a few hours. You'll get your booking confirmation.", M + 52, y - 20, { size: 8.5, color: C.muted });
  d.page.drawLine({ start: { x: cx, y: y0 - 15 }, end: { x: cx, y: y2 + 9 }, thickness: 1.4, color: C.rule });
  d.page.drawLine({ start: { x: cx, y: y2 - 15 }, end: { x: cx, y: y + 9 }, thickness: 1.4, color: C.rule });
  d.y = top - h;
}

function textCard(d: Doc, label: string, body: string, o: { fill?: RGB; border?: RGB; ink?: RGB } = {}) {
  const ls = d.wrap(body, d.sans, 9.3, CW - 36);
  const h = 44 + ls.length * 13.5 + 6;
  d.need(h + 4);
  const top = d.y;
  d.card(M, top, CW, h, { fill: o.fill, border: o.border });
  d.label(label, M + 18, top - 22);
  ls.forEach((l, i) => d.text(l, M + 18, top - 40 - i * 13.5, { size: 9.3, color: o.ink ?? C.ink2 }));
  d.y = top - h;
}

type Day = { date: string; title: string; items: { title: string; sub: string; chip?: [string, boolean] }[] };
/** "Your days in Aswan" timeline like the website: day badges, connecting line, item rows with status chips.
 * Splits across pages when needed (the heading stays on the first part). */
function daysCard(d: Doc, days: Day[], aside: string) {
  const dayH = (n: number) => Math.max(48, 24 + n * 34) + 8;
  let i = 0, firstPart = true;
  while (i < days.length) {
    const head = firstPart ? 48 : 18;
    let room = d.y - FOOT - head - 4;
    if (room < dayH(days[i].items.length)) { d.newPage(); room = d.y - FOOT - head - 4; }
    const part: Day[] = [];
    while (i < days.length && (part.length === 0 || dayH(days[i].items.length) <= room)) { room -= dayH(days[i].items.length); part.push(days[i]); i++; }
    const h = head + part.reduce((a, x) => a + dayH(x.items.length), 0);
    const top = d.y;
    if (firstPart) d.sectionStart("Your days in Aswan", aside, h); else d.card(M, top, CW, h);
    let y = top - head;
    const bx = M + 18, lineX = bx + 21;
    const last = y - part.slice(0, -1).reduce((a, x) => a + dayH(x.items.length), 0);
    if (part.length > 1 || i < days.length) d.page.drawLine({ start: { x: lineX, y: y - 30 }, end: { x: lineX, y: i < days.length ? top - h + 6 : last - 20 }, thickness: 1.4, color: C.rule2 });
    part.forEach((day, k) => {
      const first = firstPart && k === 0;
      d.rr(bx, y, 42, 46, 13, { fill: first ? C.navy : C.card, border: first ? C.navy : C.rule2 });
      d.center(weekday(day.date).slice(0, 3).toUpperCase(), lineX, y - 15, { f: d.bold, size: 6.5, color: first ? C.cream : C.muted, spacing: 0.6 });
      d.center(String(Number(day.date.slice(8, 10))), lineX, y - 34, { f: d.bold, size: 15, color: first ? C.white : C.ink });
      const tx = bx + 56, tw = CW - 36 - 56;
      d.text(day.title, tx, y - 15, { f: d.bold, size: 10.5 });
      let iy = y - 24;
      for (const it of day.items) {
        d.rr(tx, iy, tw, 28, 10, { fill: C.paper, border: C.rule });
        d.text(it.title, tx + 11, iy - 12, { f: d.bold, size: 9 });
        if (it.sub) d.text(it.sub, tx + 11, iy - 22.5, { size: 7.4, color: C.muted });
        if (it.chip) d.pill(it.chip[0], tx + tw - 8, iy - 17.5, { fg: it.chip[1] ? C.green : C.amber, bg: it.chip[1] ? C.greenBg : C.amberBg, size: 7 });
        iy -= 34;
      }
      y -= dayH(day.items.length);
    });
    d.y = top - h;
    if (i < days.length) d.newPage();
    firstPart = false;
  }
}

/** Two text cards side by side (house rules + cancellation). */
function twoTextCards(d: Doc, a: [string, string], b: [string, string]) {
  const w = (CW - 12) / 2;
  const la = d.wrap(a[1], d.sans, 8.8, w - 32), lb = d.wrap(b[1], d.sans, 8.8, w - 32);
  const h = 44 + Math.max(la.length, lb.length) * 12.5 + 6;
  d.need(h + 4);
  const top = d.y;
  ([[a[0], la, M], [b[0], lb, M + w + 12]] as const).forEach(([label, ls, x]) => {
    d.card(x, top, w, h);
    d.label(label, x + 16, top - 22);
    ls.forEach((l, i) => d.text(l, x + 16, top - 40 - i * 12.5, { size: 8.8, color: C.ink2 }));
  });
  d.y = top - h;
}

function footers(d: Doc) {
  const pages = d.doc.getPages(), n = pages.length;
  pages.forEach((p, i) => {
    p.drawRectangle({ x: 0, y: 0, width: W, height: 48, color: C.dark });
    const t = (s: string, x: number, y: number, f: Font, size: number, color: RGB, spacing = 0) => {
      const txt = pdfSafe(s, f); if (!txt) return;
      if (!spacing) { p.drawText(txt, { x, y, size, font: f, color }); return; }
      let cx = x; for (const ch of txt) { p.drawText(ch, { x: cx, y, size, font: f, color }); cx += f.widthOfTextAtSize(ch, size) + spacing; }
    };
    t("THE ROYAL NILE RESIDENCE", M, 28, d.serif, 9.5, C.sand, 1.8);
    t(d.footer, M, 15, d.sans, 7, hex("#CDB3B0"));
    const pg = `${d.number}  ·  Page ${i + 1} of ${n}`;
    t(pg, W - M - d.sans.widthOfTextAtSize(pdfSafe(pg, d.sans), 7.5), 28, d.sans, 7.5, C.gold2);
  });
}

export async function renderPdf(input: PdfInput): Promise<Uint8Array> {
  const { kind, booking: b, settings: s } = input;
  const items = input.items.filter((i) => i.status !== "CANCELLED");
  const usd = (n: number) => fmtMoney(n, "USD");
  const egp = (n: number) => fmtMoney(n, "EGP", s.rates);
  const guestCur = b.currency === "EUR" ? "EUR" : "EGP";
  const approx = (n: number) => fmtMoney(n, guestCur, s.rates);
  const paid = input.payments.filter((p) => p.status === "CONFIRMED").reduce((a, p) => a + p.amountUsd, 0);
  const balance = Math.round((b.totalUsd - paid) * 100) / 100;
  const cancelled = b.status === "CANCELLED";
  const confirmed = CONFIRMED.includes(b.status);
  const number = docNumber(kind, b.ref, input.payments, input.paymentId);
  const stayLine = `${b.nights} night${b.nights === 1 ? "" : "s"} · ${b.guests} guest${b.guests === 1 ? "" : "s"}`;

  const title = kind === "invoice" ? "Invoice" : kind === "receipt" ? "Receipt" : confirmed ? "Booking confirmation" : "Booking";
  const d = await Doc.make(`${title} ${number} · The Royal Nile Residence`);
  d.number = number; d.ref = b.ref;
  d.footer = [s.address, s.whatsapp ? `WhatsApp +${s.whatsapp.replace(/\D/g, "")}` : "", s.email, s.siteUrl.replace(/^https?:\/\//, "")].filter(Boolean).join("  ·  ");
  const first = pdfSafe(b.name || "", d.serifI).split(/\s+/).filter(Boolean)[0] ?? "";
  const named = (pre: string) => (first ? { title: `${pre},`, name: first, titleEnd: "." } : { title: `${pre}.`, name: "", titleEnd: "" });
  d.newPage(true);

  if (kind === "receipt") {
    const p = receiptable(input.payments).find((x) => x.id === input.paymentId);
    if (!p) throw new Error("No confirmed payment with that id");
    const paidToDate = input.payments.filter((x) => x.status === "CONFIRMED" && (x.createdAt < p.createdAt || (x.createdAt === p.createdAt && x.id <= p.id))).reduce((a, x) => a + x.amountUsd, 0);
    const left = Math.max(0, Math.round((b.totalUsd - paidToDate) * 100) / 100);
    d.heroBlock({ kicker: "Payment received", tick: true, ...named("Thank you"), sub: "This receipt confirms the payment below for your stay at The Royal Nile Residence, Aswan.",
      tiles: [["Amount received", usd(p.amountUsd)], ["About", egp(p.amountUsd)], ["Paid by", methodLabel(p.method)], ["Received on", cairo(p.createdAt)]], status: ["PAID", C.green, C.greenBg] });
    d.gap(14);
    d.twoCards(["Received from", [b.name, b.phone, b.email, b.country]], ["Receipt", [number, `Received ${cairo(p.createdAt, true)}`, `For booking ${b.ref}`, p.note]]);
    d.gap(12);
    const h = 170;
    const top = d.sectionStart("Your booking", stayLine, h);
    const tw = (CW - 36 - 8) / 2;
    d.tile(M + 18, top - 46, tw, 50, "Check-in", fmtLong(b.checkIn), `from ${s.checkInTime}`);
    d.tile(M + 18 + tw + 8, top - 46, tw, 50, "Check-out", fmtLong(b.checkOut), `by ${s.checkOutTime}`);
    const bw = (CW - 36 - 16) / 3, by = top - 108;
    ([["Booking total", usd(b.totalUsd), C.ink], ["Paid to date", usd(paidToDate), C.green], [left > 0 ? "Left to pay" : "Balance", left > 0 ? usd(left) : "Fully paid", left > 0 ? C.amber : C.green]] as const).forEach(([k, v, col], i) => {
      const bx = M + 18 + i * (bw + 8);
      d.rr(bx, by, bw, 46, 12, { fill: C.paper });
      d.text(k, bx + 12, by - 16, { size: 8.2, color: C.muted });
      d.text(v, bx + 12, by - 34, { f: d.bold, size: 12.5, color: col });
    });
    d.y = top - h;
    d.gap(12);
    textCard(d, "Good to know", `Keep this receipt for your records.${left > 0 ? ` The remaining ${usd(left)} (about ${egp(left)}) is payable on arrival or before.` : ""} If anything looks wrong, message us on WhatsApp with your booking reference ${b.ref}.`, { fill: C.noteBg, border: C.noteBorder, ink: C.noteInk });
  } else if (kind === "invoice") {
    const state: [string, RGB, RGB] = cancelled ? ["CANCELLED", C.red, C.redBg] : balance <= 0.005 ? ["PAID", C.green, C.greenBg] : paid > 0 ? ["PART PAID", C.amber, C.amberBg] : ["UNPAID", C.amber, C.amberBg];
    const who = pdfSafe(b.name, d.sans);
    d.heroBlock({ kicker: "Invoice", tick: false, title: "Invoice", name: "", sub: `${who ? `For ${who} · ` : ""}${fmtLong(b.checkIn)} to ${fmtLong(b.checkOut)} at The Royal Nile Residence, Aswan.`,
      tiles: [["Invoice no.", number], ["Issued", cairo(input.now ?? Date.now())], ["Total", usd(b.totalUsd)], [balance > 0 ? "Balance due" : "Balance", usd(Math.max(0, balance))]], status: state });
    d.gap(14);
    d.twoCards(["Billed to", [b.name, b.phone, b.email, b.country]], ["Stay", [`${fmtLong(b.checkIn)} to ${fmtLong(b.checkOut)}`, stayLine, `Check-in from ${s.checkInTime} · check-out by ${s.checkOutTime}`, `Booking ${b.ref} · booked ${cairo(b.createdAt)}`]]);
    d.gap(12);
    const extra = [`About ${approx(b.totalUsd)}`, ...input.payments.filter((x) => x.status === "CONFIRMED").sort((a, c) => a.createdAt - c.createdAt)
      .map((x) => `${x.amountUsd < 0 ? "Refunded" : "Paid"} ${cairo(x.createdAt)} by ${methodLabel(x.method)}: ${usd(Math.abs(x.amountUsd))}`)];
    const depositLeft = !cancelled && !confirmed ? Math.max(0, b.depositUsd - paid) : 0;
    const rate = `${guestCur === "EUR" ? "euro" : "pound"} amounts approximate (1 USD = ${guestCur === "EUR" ? s.rates.EUR : s.rates.EGP} ${guestCur})`;
    priceCard(d, "Charges", priceRows(b, items, usd), usd(b.totalUsd), [["Paid", usd(paid), C.green], [balance > 0 ? "Balance due" : "Balance", usd(Math.max(0, balance)), balance > 0 ? C.amber : C.green]], extra,
      !cancelled && balance > 0 && depositLeft === 0 ? `Balance payable on arrival (cash or InstaPay). Prices in US dollars; ${rate}.` : `Prices in US dollars; ${rate}.`);
    if (depositLeft > 0) { d.gap(12); payCard(d, s, b.ref, `${usd(depositLeft)}  (~ ${egp(depositLeft)})`, b.holdUntil ? `Held until ${cairo(b.holdUntil, true)}` : ""); }
  } else {
    const state: [string, RGB, RGB] | undefined = cancelled ? ["CANCELLED", C.red, C.redBg] : undefined;
    const hello = confirmed ? named("Aswan is waiting for you") : cancelled ? { title: "Booking cancelled", name: "", titleEnd: "" } : named("Almost there");
    d.heroBlock({ kicker: confirmed ? "Booking confirmed" : cancelled ? "Cancelled" : b.status === "RECEIPT_SENT" ? "Receipt received" : "Booking received", tick: !cancelled, ...hello,
      sub: confirmed ? "Everything is set. This document has your days, your times and how to find us. Keep it handy."
        : cancelled ? "This booking has been cancelled. Message us on WhatsApp if you have any questions."
        : b.status === "RECEIPT_SENT" ? "We have your receipt and are checking it now. You will get your confirmation shortly."
        : `Your dates are held${b.holdUntil ? ` until ${cairo(b.holdUntil, true)} (Aswan time)` : ""}. Pay the deposit below and Aswan is yours.`,
      tiles: [["Check-in", fmtDay(b.checkIn)], ["Nights", String(b.nights)], ["Guests", String(b.guests)], ["Total", usd(b.totalUsd)]], status: state });
    if (!cancelled) {
      const done = ["CHECKED_IN", "COMPLETED"].includes(b.status) ? 4 : confirmed ? 3 : 1;
      const st = (i: number): "done" | "now" | "todo" => (i < done ? "done" : i === done ? "now" : "todo");
      d.tracker([{ label: "Booked", sub: cairo(b.createdAt).replace(/ \d{4}$/, ""), state: st(0) }, { label: "Deposit", sub: confirmed ? "Received" : b.status === "RECEIPT_SENT" ? "Checking" : "Next step", state: st(1) },
        { label: "Confirmed", sub: confirmed ? "All set" : "After deposit", state: st(2) }, { label: "Aswan!", sub: fmtDay(b.checkIn), state: st(3) }]);
    }
    d.gap(14);
    d.twoCards(["Guest", [b.name, b.phone, b.email, b.country]], ["Where", ["The Royal Nile Residence", s.address, `Check-in from ${s.checkInTime} · check-out by ${s.checkOutTime}`]]);
    d.gap(12);
    if (!confirmed && !cancelled && b.depositUsd - paid > 0) { payCard(d, s, b.ref, `${usd(b.depositUsd - paid)}  (~ ${egp(b.depositUsd - paid)})`, b.holdUntil ? `Held until ${cairo(b.holdUntil, true)}` : ""); d.gap(12); }
    if (confirmed && s.arrivalInfo) { textCard(d, "Arrival details", s.arrivalInfo, { fill: hex("#FFFBF3"), border: C.noteBorder }); d.gap(12); }
    const byDate = new Map<string, PdfItem[]>();
    for (const i of items) byDate.set(i.date, [...(byDate.get(i.date) ?? []), i]);
    const dates = [...new Set([b.checkIn, ...byDate.keys(), b.checkOut])].sort();
    const dayNo = (iso: string) => Math.round((Date.parse(iso) - Date.parse(b.checkIn)) / 86400000) + 1;
    const arranged = (i: PdfItem) => i.status === "ARRANGED" || i.status === "DONE";
    const days: Day[] = dates.map((dt) => ({
      date: dt,
      title: dt === b.checkIn ? `Arrival · check-in from ${s.checkInTime}` : dt === b.checkOut ? `Check-out by ${s.checkOutTime}` : `Day ${dayNo(dt)}`,
      items: (byDate.get(dt) ?? []).map((i) => ({ title: `${i.title}${i.qty > 1 ? ` × ${i.qty}` : ""}`, sub: i.time || "Time to be confirmed", chip: [arranged(i) ? "Arranged" : "Being arranged", arranged(i)] as [string, boolean] })),
    }));
    daysCard(d, days, `${b.nights} night${b.nights === 1 ? "" : "s"} · ${items.length} experience${items.length === 1 ? "" : "s"}`);
    d.gap(12);
    priceCard(d, "Price", priceRows(b, items, usd), usd(b.totalUsd),
      confirmed ? [["Paid", usd(paid), C.green], ["On arrival", usd(Math.max(0, balance)), C.ink]] : [["Deposit to confirm", usd(Math.max(0, b.depositUsd - paid)), C.amber], ["Rest on arrival", usd(Math.max(0, b.totalUsd - Math.max(b.depositUsd, paid))), C.ink]],
      [`About ${approx(b.totalUsd)}`], "");
    d.gap(12);
    if (s.houseRules && s.cancellationPolicy) twoTextCards(d, ["House rules", s.houseRules], ["Changes & cancellation", s.cancellationPolicy]);
    else if (s.houseRules || s.cancellationPolicy) textCard(d, s.houseRules ? "House rules" : "Changes & cancellation", s.houseRules || s.cancellationPolicy);
  }
  footers(d);
  return d.doc.save();
}

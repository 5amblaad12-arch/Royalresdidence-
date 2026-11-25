import { test } from "node:test";
import assert from "node:assert/strict";
import { isISODate, addDays, nightsBetween, eachNight, eachDay, fmtDay, fmtRange, todayInEgypt } from "./dates.ts";
import { quote, stayProblems, unitQty, type PriceRules, type ExperiencePrice } from "./pricing.ts";
import { fmtMoney, convert } from "./money.ts";
import { takenNights, isFree, isHolding, freeWindows } from "./availability.ts";

const rules: PriceRules = { nightlyUsd: 85, cleaningUsd: 0, depositPct: 25, minNights: 2, maxGuests: 6, maxNights: 30 };
const cat: ExperiencePrice[] = [
  { id: 1, title: "Felucca", priceUsd: 15, costUsd: 9, unit: "PERSON", partnerId: 3, timeHint: "16:30" },
  { id: 2, title: "Pickup", priceUsd: 10, costUsd: 6, unit: "GROUP", partnerId: null, timeHint: "" },
  { id: 3, title: "Philae", priceUsd: 30, costUsd: 20, unit: "PERSON", partnerId: null, timeHint: "09:00" },
];

test("dates", () => {
  assert.equal(isISODate("2027-02-12"), true);
  assert.equal(isISODate("2027-02-30"), false);
  assert.equal(isISODate("12/02/2027"), false);
  assert.equal(addDays("2027-02-28", 1), "2027-03-01");
  assert.equal(nightsBetween("2027-02-12", "2027-02-16"), 4);
  assert.deepEqual(eachNight("2027-02-12", "2027-02-14"), ["2027-02-12", "2027-02-13"]);
  assert.deepEqual(eachDay("2027-02-12", "2027-02-14"), ["2027-02-12", "2027-02-13", "2027-02-14"]);
  assert.equal(fmtDay("2027-02-12"), "Fri 12 Feb");
  assert.equal(fmtRange("2027-02-12", "2027-02-16"), "12 – 16 Feb");
  assert.equal(fmtRange("2027-02-27", "2027-03-02"), "27 Feb – 2 Mar");
  assert.equal(todayInEgypt(new Date("2026-11-16T23:30:00Z")), "2026-11-17"); // Cairo is ahead of UTC
});

test("quote matches the proposal example ($530, $133 deposit rounded up)", () => {
  const q = quote({ checkIn: "2027-02-12", checkOut: "2027-02-16", guests: 4, rules, catalog: cat,
    extras: [{ experienceId: 2, date: "2027-02-12" }, { experienceId: 1, date: "2027-02-13" }, { experienceId: 3, date: "2027-02-14" }, { experienceId: 99, date: "2027-02-14" }] });
  assert.equal(q.nights, 4); assert.equal(q.stayUsd, 340); assert.equal(q.extrasUsd, 190); assert.equal(q.totalUsd, 530);
  assert.equal(q.depositUsd, 133); // 25% of 530 = 132.5 → rounded up
  assert.equal(q.lines.length, 3); // unknown experience ignored
  assert.equal(q.lines[0].title, "Pickup"); // sorted by date
  assert.equal(q.lines[1].costUsd, 36);
});

test("unit quantities", () => {
  assert.equal(unitQty("GROUP", 5, 3), 1);
  assert.equal(unitQty("PERSON", 4), 4);
  assert.equal(unitQty("PERSON", 4, 2), 2);
  assert.equal(unitQty("PERSON", 4, 9), 4);
  assert.equal(unitQty("PERSON", 4, 0), 4);
});

test("stay problems", () => {
  assert.deepEqual(stayProblems({ checkIn: "2027-02-12", checkOut: "2027-02-16", guests: 4, today: "2026-11-17", rules }), []);
  assert.match(stayProblems({ checkIn: "2027-02-12", checkOut: "2027-02-13", guests: 4, today: "2026-11-17", rules })[0], /minimum stay is 2/);
  assert.match(stayProblems({ checkIn: "2026-11-01", checkOut: "2026-11-05", guests: 2, today: "2026-11-17", rules })[0], /past/);
  assert.match(stayProblems({ checkIn: "2027-02-12", checkOut: "2027-02-16", guests: 7, today: "2026-11-17", rules })[0], /up to 6/);
});

test("money", () => {
  assert.equal(fmtMoney(530), "$530");
  assert.equal(fmtMoney(12.5), "$12.50");
  assert.equal(fmtMoney(530, "EGP", { EUR: 0.92, EGP: 50.13 }), "EGP 26,570");
  assert.equal(fmtMoney(100, "EUR", { EUR: 0.92, EGP: 50 }), "€92");
  assert.equal(convert(10, "EGP", { EUR: 1, EGP: 0 }), 10); // bad rate falls back safely
});

test("availability: holds expire, cancelled frees, blocks count", () => {
  const now = Date.parse("2027-01-10T10:00:00Z");
  const stays = [
    { id: 1, checkIn: "2027-02-02", checkOut: "2027-02-05", status: "CONFIRMED", holdUntil: null },
    { id: 2, checkIn: "2027-02-12", checkOut: "2027-02-16", status: "AWAITING_DEPOSIT", holdUntil: now - 1 }, // expired hold
    { id: 3, checkIn: "2027-02-20", checkOut: "2027-02-22", status: "CANCELLED", holdUntil: null },
    { id: 4, checkIn: "2027-03-01", checkOut: "2027-03-03", status: "REQUEST", holdUntil: now + 3600_000 },
  ];
  const t = takenNights(stays, [{ from: "2027-02-24", to: "2027-02-26" }], now);
  assert.equal(isFree(t, "2027-02-05", "2027-02-08"), true); // check-in on someone's check-out day is fine
  assert.equal(isFree(t, "2027-02-04", "2027-02-06"), false);
  assert.equal(isFree(t, "2027-02-12", "2027-02-16"), true);
  assert.equal(isFree(t, "2027-02-20", "2027-02-22"), true);
  assert.equal(isFree(t, "2027-02-25", "2027-02-27"), false);
  assert.equal(isFree(t, "2027-03-02", "2027-03-04"), false);
  assert.equal(isHolding(stays[3], now + 7200_000), false);
  assert.equal(isFree(takenNights(stays, [], now, 1), "2027-02-02", "2027-02-05"), true); // editing booking 1 ignores itself
});

test("next free windows skip booked nights and don't overlap", () => {
  const taken = new Set(["2027-02-03", "2027-02-04", "2027-02-09"]);
  assert.deepEqual(freeWindows(taken, "2027-02-01", 3, 3), [
    { checkIn: "2027-02-05", checkOut: "2027-02-08" }, { checkIn: "2027-02-10", checkOut: "2027-02-13" }, { checkIn: "2027-02-13", checkOut: "2027-02-16" }]);
  assert.deepEqual(freeWindows(new Set(), "2027-02-01", 2, 2), [{ checkIn: "2027-02-01", checkOut: "2027-02-03" }, { checkIn: "2027-02-03", checkOut: "2027-02-05" }]);
});

test("pdf: numbering, safe text and a real PDF", async () => {
  const { renderPdf, docNumber, receiptable, fileName } = await import("./pdf.ts");
  const pays = [{ id: 9, amountUsd: 50, method: "CASH", status: "CONFIRMED", createdAt: 3, note: "" }, { id: 4, amountUsd: 100, method: "INSTAPAY", status: "CONFIRMED", createdAt: 1, note: "" },
    { id: 5, amountUsd: 80, method: "TRANSFER", status: "PENDING", createdAt: 2, note: "" }, { id: 6, amountUsd: -20, method: "REFUND", status: "CONFIRMED", createdAt: 4, note: "" }];
  assert.deepEqual(receiptable(pays).map((p) => p.id), [4, 9]);
  assert.equal(docNumber("receipt", "RN-1", pays, 9), "RC-RN-1-2");
  assert.equal(docNumber("invoice", "RN-1", pays), "INV-RN-1");
  assert.equal(fileName("booking", "RN-1", pays), "Royal-Nile-Booking-RN-1.pdf");
  const settings = { rates: { EUR: 0.9, EGP: 50 }, whatsapp: "20100", email: "", instapay: "x@instapay", bankDetails: "", paymentNote: "", checkInTime: "14:00", checkOutTime: "12:00", address: "Aswan", arrivalInfo: "", houseRules: "", cancellationPolicy: "", siteUrl: "" };
  const booking = { ref: "RN-1", status: "CONFIRMED", checkIn: "2027-01-01", checkOut: "2027-01-03", guests: 2, nights: 2, nightlyUsd: 85, stayUsd: 170, cleaningUsd: 0, totalUsd: 170, depositUsd: 43, currency: "USD", holdUntil: null, name: "محمد Müller → ✓", email: "", phone: "", country: "", createdAt: 0 };
  for (const kind of ["booking", "invoice", "receipt"] as const) {
    const bytes = await renderPdf({ kind, booking, items: [], payments: pays, settings, paymentId: 4 });
    assert.equal(new TextDecoder().decode(bytes.slice(0, 5)), "%PDF-");
  }
  await assert.rejects(renderPdf({ kind: "receipt", booking, items: [], payments: pays, settings, paymentId: 5 }));
});

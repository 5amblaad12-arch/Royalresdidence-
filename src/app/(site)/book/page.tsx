import type { Metadata } from "next";
import { getSettings } from "@/lib/settings";
import { listExperiences, loadTaken } from "@/lib/data";
import { getCurrency } from "@/lib/view";
import { todayInEgypt, isISODate } from "@/lib/dates";
import BookingPlanner from "@/components/BookingPlanner";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Book your stay", description: "Choose your dates, plan your days in Aswan and book The Royal Nile Residence." };

export default async function Book({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const sp = await searchParams;
  const one = (k: string) => (typeof sp[k] === "string" ? (sp[k] as string) : "");
  const [st, exps, cur, taken] = await Promise.all([getSettings(), listExperiences(), getCurrency(), loadTaken()]);
  const today = todayInEgypt();
  const inD = isISODate(one("in")) && one("in") >= today ? one("in") : "";
  const outD = inD && isISODate(one("out")) && one("out") > inD ? one("out") : "";
  const g = Math.min(st.maxGuests, Math.max(1, Math.floor(Number(one("guests")) || 2)));
  return (
    <BookingPlanner
      today={today}
      taken={[...taken].sort()}
      initial={{ checkIn: inD, checkOut: outD, guests: g }}
      currency={cur}
      rates={st.rates}
      rules={{ nightlyUsd: st.nightlyUsd, cleaningUsd: st.cleaningUsd, depositPct: st.depositPct, minNights: st.minNights, maxGuests: st.maxGuests, maxNights: st.maxNights }}
      holdHours={st.holdHours}
      whatsapp={st.whatsapp}
      experiences={exps.map((e) => ({ id: e.id, slug: e.slug, title: e.title, summary: e.summary, duration: e.duration, timeHint: e.timeHint, image: e.image, priceUsd: e.priceUsd, costUsd: 0, unit: e.unit, partnerId: null }))}
    />
  );
}

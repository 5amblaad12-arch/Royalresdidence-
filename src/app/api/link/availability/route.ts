// For Egypt Knight Tours (signed requests only): which nights are taken, and the partner price.
import { readLinked } from "@/lib/link";
import { loadTaken } from "@/lib/data";
import { getSettings } from "@/lib/settings";
import { todayInEgypt } from "@/lib/dates";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const r = await readLinked(req); if (!r.ok) return r.res;
  const [taken, st] = await Promise.all([loadTaken(), getSettings()]);
  return Response.json({
    today: todayInEgypt(), taken: [...taken].sort(),
    nightlyUsd: st.agencyNightlyUsd > 0 ? st.agencyNightlyUsd : st.nightlyUsd, cleaningUsd: st.cleaningUsd,
    maxGuests: st.maxGuests, checkInTime: st.checkInTime, checkOutTime: st.checkOutTime, address: st.address, whatsapp: st.whatsapp,
  });
}

import type { Metadata } from "next";
import { getSettings } from "@/lib/settings";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Booking terms & house rules" };

export default async function Terms() {
  const st = await getSettings();
  return (
    <div className="wrap section-sm legal" style={{ maxWidth: 760 }}>
      <h1 style={{ fontSize: 44 }}>Booking terms & house rules</h1>
      <h2>Booking and deposit</h2>
      <p>When you book on this website your dates are held for {st.holdHours} hours. To confirm, pay a {st.depositPct}% deposit by InstaPay or bank transfer and upload the receipt on your booking page. Once we check the payment, your booking is confirmed. The rest is paid on arrival.</p>
      <h2>Experiences and transfers</h2>
      <p>Trips, guides and transfers you add are arranged by us with local partners we trust. Times can move a little with the weather, the river or temple opening hours — we'll always tell you on WhatsApp.</p>
      <h2>Changes and cancellations</h2>
      <p>{st.cancellationPolicy}</p>
      <h2>Check-in and check-out</h2>
      <p>Check-in from {st.checkInTime}. Check-out by {st.checkOutTime}. Ask us if you need an early arrival or late departure.</p>
      <h2>House rules</h2>
      <p>{st.houseRules}</p>
    </div>
  );
}

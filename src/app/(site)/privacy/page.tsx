import type { Metadata } from "next";

export const metadata: Metadata = { title: "Privacy" };

export default function Privacy() {
  return (
    <div className="wrap section-sm legal" style={{ maxWidth: 760 }}>
      <h1 style={{ fontSize: 44 }}>Privacy</h1>
      <p>We only ask for what we need to look after your stay: your name, WhatsApp number, email (optional), travel details and any payment receipt you upload.</p>
      <h2>How we use it</h2>
      <p>To confirm your booking, arrange your trips and transfers with our local partners (for example, your name and arrival time for the driver), and to contact you about your stay.</p>
      <h2>Who sees it</h2>
      <p>Only the residence team. We share the minimum needed with the driver, guide or boat captain arranging your trip. We never sell your details.</p>
      <h2>Your booking page</h2>
      <p>Your booking page is private: only people with its link can open it. Please don't share the link publicly.</p>
      <h2>Questions or deletion</h2>
      <p>Message us on WhatsApp and we'll answer, or delete your details after your stay if you ask.</p>
    </div>
  );
}

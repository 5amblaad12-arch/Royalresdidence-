import type { ReactNode } from "react";
import { Header, Footer, WhatsAppFloat } from "@/components/Chrome";
import { getSettings } from "@/lib/settings";
import { getCurrency } from "@/lib/view";

export const dynamic = "force-dynamic";

export default async function SiteLayout({ children }: { children: ReactNode }) {
  const [st, cur] = await Promise.all([getSettings(), getCurrency()]);
  return (
    <>
      <a className="skip" href="#main">Skip to content</a>
      <Header currency={cur} whatsapp={st.whatsapp} />
      <main id="main">{children}</main>
      <Footer whatsapp={st.whatsapp} address={st.address} />
      <WhatsAppFloat whatsapp={st.whatsapp} />
    </>
  );
}

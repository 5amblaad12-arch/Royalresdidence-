// Header, footer and the floating WhatsApp button for public pages.
import Link from "next/link";
import { Logo, WaIcon, Mark } from "./ui";
import CurrencySwitch from "./CurrencySwitch";
import { waLink } from "@/lib/wa";

const NAV = [["/stay", "The stay"], ["/experiences", "Aswan experiences"], ["/getting-here", "Getting here"], ["/#faq", "FAQ"]] as const;

export function Header({ currency, whatsapp }: { currency: string; whatsapp: string }) {
  return (
    <header className="hdr">
      <div className="wrap hdr-in" style={{ position: "relative" }}>
        <Logo />
        <nav className="nav" aria-label="Main">{NAV.map(([h, t]) => <Link key={h} href={h}>{t}</Link>)}</nav>
        <div className="hdr-r">
          <CurrencySwitch current={currency} />
          <a className="btn btn-wa btn-sm hide-m" href={waLink(whatsapp, "Hi! I'm interested in The Royal Nile Residence.")} target="_blank" rel="noopener"><WaIcon size={16} /> WhatsApp</a>
          <Link className="btn btn-navy btn-sm hide-m" href="/book">Book your stay</Link>
          <details className="menu">
            <summary aria-label="Menu"><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M4 7h16M4 12h16M4 17h16" /></svg></summary>
            <div className="menu-p">
              {NAV.map(([h, t]) => <Link key={h} href={h}>{t}</Link>)}
              <Link className="btn btn-navy mt16" href="/book" style={{ fontFamily: "var(--sans)", fontSize: 16, borderBottom: 0 }}>Book your stay</Link>
              <a className="btn btn-wa mt8" href={waLink(whatsapp, "Hi! I'm interested in The Royal Nile Residence.")} target="_blank" rel="noopener" style={{ fontFamily: "var(--sans)", fontSize: 16, borderBottom: 0 }}><WaIcon /> Message us on WhatsApp</a>
            </div>
          </details>
        </div>
      </div>
    </header>
  );
}

export function Footer({ whatsapp, address }: { whatsapp: string; address: string }) {
  const y = new Date().getFullYear();
  return (
    <footer className="ftr">
      <div className="wrap">
        <div className="ftr-g">
          <div>
            <div className="row"><Mark color="#E9C792" /><span className="serif" style={{ fontSize: 22, color: "#fff" }}>The Royal Nile Residence</span></div>
            <p className="mt16" style={{ maxWidth: 380 }}>Your private home overlooking the Nile — and everything you want to do in Aswan, at local prices.</p>
            <p className="mt16">{address}</p>
          </div>
          <div>
            <h4>Explore</h4>
            <ul className="clean stack" style={{ fontSize: 14.5 }}>
              <li><Link href="/stay">The stay</Link></li><li><Link href="/experiences">Aswan experiences</Link></li><li><Link href="/getting-here">Getting here</Link></li><li><Link href="/book">Book your stay</Link></li>
            </ul>
          </div>
          <div>
            <h4>Talk to us</h4>
            <ul className="clean stack" style={{ fontSize: 14.5 }}>
              <li><a href={waLink(whatsapp, "Hi! I have a question about The Royal Nile Residence.")} target="_blank" rel="noopener">WhatsApp +{whatsapp}</a></li>
              <li><Link href="/terms">Booking terms & house rules</Link></li><li><Link href="/privacy">Privacy</Link></li>
            </ul>
          </div>
        </div>
        <div className="ftr-b"><span>© {y} The Royal Nile Residence, Aswan</span><span>Website by Nino Techy</span></div>
      </div>
    </footer>
  );
}

export function WhatsAppFloat({ whatsapp }: { whatsapp: string }) {
  return <a className="wa-float" href={waLink(whatsapp, "Hi! I'm interested in The Royal Nile Residence.")} target="_blank" rel="noopener" aria-label="Message us on WhatsApp"><WaIcon size={28} /></a>;
}

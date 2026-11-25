import type { Metadata, Viewport } from "next";
import type { ReactNode } from "react";
import { Fraunces, Inter } from "next/font/google";
import "./globals.css";

const serif = Fraunces({ subsets: ["latin"], style: ["normal", "italic"], variable: "--font-serif", display: "swap" });
const sans = Inter({ subsets: ["latin"], variable: "--font-sans", display: "swap" });

const site = (process.env.NEXT_PUBLIC_SITE_URL ?? "").replace(/\/$/, "") || "http://localhost:3000";

export const metadata: Metadata = {
  metadataBase: new URL(site),
  title: { default: "The Royal Nile Residence, Aswan — Nile-view apartment & local experiences", template: "%s · The Royal Nile Residence, Aswan" },
  description: "A private 3-bedroom, 120 m² apartment with direct Nile views in Aswan, for up to 6 guests — plus feluccas, Philae, Abu Simbel and transfers at local prices.",
  openGraph: { type: "website", siteName: "The Royal Nile Residence", images: [{ url: "/photos/panorama.webp", width: 1200, height: 1600 }] },
};
export const viewport: Viewport = { themeColor: "#3C161A", width: "device-width", initialScale: 1 };

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en" className={`${serif.variable} ${sans.variable}`}>
      <body>{children}</body>
    </html>
  );
}

import type { ReactNode } from "react";
import type { Metadata } from "next";
import Link from "next/link";
import { requireStaff } from "@/lib/auth";
import { one } from "@/lib/db";
import { Mark } from "@/components/ui";
import AdminNav from "@/components/AdminNav";
import { logout } from "./actions";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Admin", robots: { index: false, follow: false } };

export default async function PanelLayout({ children }: { children: ReactNode }) {
  const s = await requireStaff();
  const n = await one<{ c: number }>("SELECT COUNT(*) AS c FROM bookings WHERE seen = 0 OR status = 'RECEIPT_SENT'");
  return (
    <div className="adm">
      <aside className="adm-side">
        <Link href="/admin" className="row adm-logo" style={{ textDecoration: "none", padding: "0 8px 22px", flexWrap: "nowrap" }}><Mark color="light" size={30} /><span><span className="serif" style={{ fontSize: 17, display: "block" }}>The Royal Nile</span><span style={{ fontSize: 10, letterSpacing: ".2em", color: "#D4B57C", fontWeight: 700 }}>ADMIN</span></span></Link>
        <AdminNav attention={Number(n?.c ?? 0)} owner={s.role === "OWNER"} />
        <div className="adm-foot" style={{ marginTop: "auto", padding: "0 8px", fontSize: 12.5, color: "#CDB3B0" }}>
          <div>{s.email}</div>
          <div className="row mt8"><Link href="/" target="_blank" style={{ color: "#D4B57C" }}>View website ↗</Link><form action={logout}><button className="link" style={{ color: "#CDB3B0", fontSize: 12.5 }} type="submit">Sign out</button></form></div>
        </div>
      </aside>
      <main className="adm-main">{children}</main>
    </div>
  );
}

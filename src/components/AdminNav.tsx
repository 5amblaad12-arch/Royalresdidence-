"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";

export default function AdminNav({ attention, owner }: { attention: number; owner: boolean }) {
  const path = usePathname();
  const items: [string, string, number?][] = [["/admin", "Today"], ["/admin/bookings", "Bookings", attention], ["/admin/calendar", "Calendar"], ["/admin/experiences", "Experiences"], ["/admin/partners", "Local partners"]];
  if (owner) items.push(["/admin/settings", "Settings & prices"]);
  return (
    <>
      {items.map(([h, t, n]) => {
        const on = h === "/admin" ? path === "/admin" : path.startsWith(h);
        return <Link key={h} href={h} className={`nav-i ${on ? "on" : ""}`}>{t}{n ? <span className="badge">{n}</span> : null}</Link>;
      })}
      <Link href="/admin/bookings/new" className="nav-i" style={{ marginTop: 10, color: "#E9C792" }}>+ New booking</Link>
    </>
  );
}

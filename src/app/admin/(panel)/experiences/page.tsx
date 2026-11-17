import Link from "next/link";
import { requireStaff } from "@/lib/auth";
import { listExperiences, listPartners } from "@/lib/data";
import { usd } from "@/lib/money";
import { CATEGORY_LABEL } from "@/lib/content";

export const dynamic = "force-dynamic";

export default async function ExperiencesAdmin({ searchParams }: { searchParams: Promise<{ m?: string }> }) {
  const s = await requireStaff();
  const { m } = await searchParams;
  const [exps, partners] = await Promise.all([listExperiences(false), listPartners()]);
  const owner = s.role === "OWNER";
  return (
    <div>
      {m ? <div className="msg">{m}</div> : null}
      <div className="adm-h"><h1>Experiences</h1><span className="spacer" /><Link className="btn btn-navy btn-sm" href="/admin/experiences/new">+ Add experience</Link></div>
      <p className="muted" style={{ marginBottom: 16 }}>What guests can add to their stay. Prices are per person, or per car for transfers. Changes show on the website straight away.</p>
      <div className="card tbl-wrap">
        <table className="tbl">
          <thead><tr><th></th><th>Experience</th><th>Category</th><th>Guest price</th>{owner ? <th>You pay</th> : null}<th>Partner</th><th>On website</th></tr></thead>
          <tbody>{exps.map((e) => (
            <tr key={e.id}>
              <td><img src={e.image} alt="" style={{ width: 56, height: 42, objectFit: "cover", borderRadius: 8 }} /></td>
              <td><Link href={`/admin/experiences/${e.id}`}><b>{e.title}</b><div className="small muted">{e.duration}{e.timeHint ? ` · ${e.timeHint}` : ""}</div></Link></td>
              <td className="small">{CATEGORY_LABEL[e.category] ?? e.category}</td>
              <td className="small">{usd(e.priceUsd)} {e.unit === "GROUP" ? "/ car" : "/ person"}</td>
              {owner ? <td className="small">{usd(e.costUsd)} <span className="muted">(+{usd(e.priceUsd - e.costUsd)})</span></td> : null}
              <td className="small">{partners.find((p) => p.id === e.partnerId)?.name ?? "—"}</td>
              <td>{e.active ? <span className="pill pill-green">Shown</span> : <span className="pill pill-grey">Hidden</span>}</td>
            </tr>))}</tbody>
        </table>
      </div>
    </div>
  );
}

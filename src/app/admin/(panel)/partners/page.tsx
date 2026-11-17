import { requireStaff } from "@/lib/auth";
import { listPartners } from "@/lib/data";
import { waLink } from "@/lib/wa";
import { savePartner } from "../actions";

export const dynamic = "force-dynamic";

export default async function Partners({ searchParams }: { searchParams: Promise<{ m?: string; e?: string }> }) {
  await requireStaff();
  const sp = await searchParams;
  const partners = await listPartners();
  return (
    <div style={{ maxWidth: 980 }}>
      {sp.m ? <div className="msg">{sp.m}</div> : null}{sp.e ? <div className="msg bad">Please enter a name.</div> : null}
      <div className="adm-h"><h1>Local partners</h1></div>
      <p className="muted" style={{ marginBottom: 16 }}>The captains, drivers and guides you work with. Link them to experiences, then message them from any booking in one tap.</p>
      <div className="stack">
        {partners.map((p) => (
          <form key={p.id} action={savePartner} className="card pad f-inline" style={{ opacity: p.active ? 1 : .6 }}>
            <input type="hidden" name="id" value={p.id} />
            <label className="field"><span>Name</span><input name="name" defaultValue={p.name} required /></label>
            <label className="field"><span>Does</span><input name="role" defaultValue={p.role} style={{ width: 120 }} /></label>
            <label className="field"><span>WhatsApp</span><input name="phone" defaultValue={p.phone} placeholder="2010…" style={{ width: 150 }} /></label>
            <label className="field" style={{ flex: 1 }}><span>Notes</span><input name="notes" defaultValue={p.notes} /></label>
            <label className="field"><span>Active</span><select name="active" defaultValue={p.active ? "on" : "off"}><option value="on">Yes</option><option value="off">No</option></select></label>
            <button className="btn btn-light btn-sm" type="submit">Save</button>
            {p.phone ? <a className="btn btn-wa btn-sm" href={waLink(p.phone, `Hi ${p.name}! `)} target="_blank" rel="noopener">WhatsApp</a> : null}
          </form>
        ))}
        <form action={savePartner} className="card pad f-inline" style={{ borderStyle: "dashed" }}>
          <input type="hidden" name="id" value={0} />
          <label className="field"><span>New partner name</span><input name="name" required /></label>
          <label className="field"><span>Does</span><input name="role" placeholder="Boat / Driver / Guide" style={{ width: 150 }} /></label>
          <label className="field"><span>WhatsApp</span><input name="phone" style={{ width: 150 }} /></label>
          <label className="field" style={{ flex: 1 }}><span>Notes</span><input name="notes" /></label>
          <button className="btn btn-navy btn-sm" type="submit">Add</button>
        </form>
      </div>
    </div>
  );
}

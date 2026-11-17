import Link from "next/link";
import { notFound } from "next/navigation";
import { requireStaff } from "@/lib/auth";
import { getExperience, listPartners, type Experience } from "@/lib/data";
import { CATEGORY_LABEL, GALLERY } from "@/lib/content";
import { saveExperience } from "../../actions";

export const dynamic = "force-dynamic";
const IMAGES = [...GALLERY.map((g) => g.src), "/art/temple.svg", "/art/colossi.svg", "/art/car.svg", "/art/dinner.svg"];

export default async function EditExperience({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ e?: string }> }) {
  const s = await requireStaff();
  const { id } = await params; const { e: err } = await searchParams;
  const isNew = id === "new";
  const found = isNew ? null : await getExperience(Number(id));
  if (!isNew && !found) notFound();
  const e: Experience = found ?? { id: 0, slug: "", title: "", category: "nile", summary: "", description: "", duration: "", timeHint: "", priceUsd: 0, costUsd: 0, unit: "PERSON", partnerId: null, image: "/photos/feluccas.webp", sort: 50, active: true };
  const partners = await listPartners();
  return (
    <div style={{ maxWidth: 820 }}>
      <div className="adm-h"><div><Link className="small link" href="/admin/experiences">‹ Experiences</Link><h1>{isNew ? "New experience" : e.title}</h1></div></div>
      {err ? <div className="msg bad">Please give it a name.</div> : null}
      <form action={saveExperience} className="card pad stack">
        <input type="hidden" name="id" value={e.id} />
        <div className="grid2" style={{ gap: 14 }}>
          <label className="field" style={{ gridColumn: "1 / -1" }}><span>Name</span><input name="title" defaultValue={e.title} required /></label>
          <label className="field"><span>Category</span><select name="category" defaultValue={e.category}>{Object.entries(CATEGORY_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select></label>
          <label className="field"><span>Charged</span><select name="unit" defaultValue={e.unit}><option value="PERSON">Per person</option><option value="GROUP">Per car / group</option></select></label>
          <label className="field"><span>Guest price (USD)</span><input name="price" type="number" step="0.01" min={0} defaultValue={e.priceUsd} required /></label>
          {s.role === "OWNER" ? <label className="field"><span>You pay the partner (USD, private)</span><input name="cost" type="number" step="0.01" min={0} defaultValue={e.costUsd} /></label> : <div />}
          <label className="field"><span>How long</span><input name="duration" defaultValue={e.duration} placeholder="e.g. Half day" /></label>
          <label className="field"><span>Usual start time</span><input name="timeHint" defaultValue={e.timeHint} placeholder="e.g. 16:30" /></label>
          <label className="field"><span>Partner</span><select name="partner" defaultValue={e.partnerId ?? ""}><option value="">—</option>{partners.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}</select></label>
          <label className="field"><span>Order on website (lower = first)</span><input name="sort" type="number" defaultValue={e.sort} /></label>
          <label className="field" style={{ gridColumn: "1 / -1" }}><span>Short line (cards)</span><input name="summary" defaultValue={e.summary} maxLength={200} /></label>
          <label className="field" style={{ gridColumn: "1 / -1" }}><span>Description</span><textarea name="description" defaultValue={e.description} rows={4} /></label>
        </div>
        <div>
          <div className="small" style={{ fontWeight: 700, color: "var(--muted)", marginBottom: 8 }}>Picture</div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(110px, 1fr))", gap: 8 }}>
            {IMAGES.map((src) => <label key={src} style={{ cursor: "pointer" }}><input type="radio" name="image" value={src} defaultChecked={e.image === src} style={{ marginRight: 4 }} /><img src={src} alt="" style={{ width: "100%", height: 70, objectFit: "cover", borderRadius: 8, marginTop: 4 }} /></label>)}
          </div>
          <label className="field mt16"><span>…or paste a picture link (https)</span><input name="imageUrl" defaultValue={IMAGES.includes(e.image) ? "" : e.image} placeholder="https://…" /></label>
        </div>
        <label className="row"><input type="checkbox" name="active" defaultChecked={e.active} /> Show on the website</label>
        <button className="btn btn-navy" type="submit">Save</button>
      </form>
    </div>
  );
}

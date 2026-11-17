import { getSession } from "@/lib/auth";
import { one } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!(await getSession())) return new Response("Not signed in", { status: 401 });
  const { id } = await params;
  const r = await one<{ mime: string; data: string }>("SELECT mime, data FROM receipts WHERE id = ?", [Number(id) || 0]);
  if (!r) return new Response("Not found", { status: 404 });
  return new Response(new Uint8Array(Buffer.from(r.data, "base64")), { headers: { "Content-Type": r.mime, "Cache-Control": "private, no-store", "Content-Disposition": "inline", "X-Content-Type-Options": "nosniff" } });
}

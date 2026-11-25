// The guest's documents as PDFs. Only reachable with the private trip link (same as the trip page).
import { getBookingByToken } from "@/lib/data";
import { bookingPdf, parseDoc } from "@/lib/documents";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(req: Request, { params }: { params: Promise<{ token: string; doc: string }> }) {
  const { token, doc } = await params;
  const want = parseDoc(doc);
  if (!want) return new Response("Not found", { status: 404 });
  const b = await getBookingByToken(token);
  if (!b) return new Response("Not found", { status: 404 });
  const out = await bookingPdf(b, want.kind, want.paymentId);
  if (!out) return new Response("Not found", { status: 404 });
  const download = new URL(req.url).searchParams.has("download");
  return new Response(Buffer.from(out.bytes), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `${download ? "attachment" : "inline"}; filename="${out.name}"`,
      "Cache-Control": "private, no-store",
      "X-Robots-Tag": "noindex, nofollow",
    },
  });
}

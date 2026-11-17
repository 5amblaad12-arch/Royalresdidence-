// Safe setup check: says which settings are present (never their values) and whether the database answers.
import { ready, all } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function GET() {
  const url = (process.env.DATABASE_URL ?? "").trim();
  const out: Record<string, unknown> = {
    databaseUrlSet: !!url, databaseUrlStartsWith: url ? url.split(":")[0] + ":" : null, databaseTokenSet: !!(process.env.DATABASE_AUTH_TOKEN ?? "").trim(),
    authSecretOk: (process.env.AUTH_SECRET ?? "").trim().length >= 16, adminEmailSet: !!(process.env.ADMIN_EMAIL ?? "").trim(), adminPasswordOk: (process.env.ADMIN_PASSWORD ?? "").length >= 10,
    siteUrl: (process.env.NEXT_PUBLIC_SITE_URL ?? "") || null, linkSecretOk: (process.env.LINK_SECRET ?? "").trim().length >= 32, egyptKnightUrlSet: !!(process.env.EGYPT_KNIGHT_URL ?? "").trim(),
  };
  try {
    await ready();
    const r = await all<{ n: number }>("SELECT COUNT(*) AS n FROM experiences");
    out.databaseOk = true; out.experiences = Number(r[0]?.n ?? 0);
  } catch (e) {
    out.databaseOk = false;
    out.databaseError = String(e instanceof Error ? e.message : e).replace(/(token|authToken)=[^&\s]+/gi, "$1=***").slice(0, 300);
    if (!url) out.fix = "DATABASE_URL is missing. Add your Turso database URL (libsql://…) and DATABASE_AUTH_TOKEN in Vercel, then redeploy.";
    else if (url.startsWith("file:")) out.fix = "DATABASE_URL points to a local file, which doesn't work on Vercel. Use your Turso libsql://… URL.";
  }
  return Response.json(out, { status: out.databaseOk ? 200 : 500, headers: { "Cache-Control": "no-store" } });
}

import type { Metadata } from "next";
import { redirect } from "next/navigation";
import bcrypt from "bcryptjs";
import { headers } from "next/headers";
import { one } from "@/lib/db";
import { createSession, getSession } from "@/lib/auth";
import { allow, clientIp } from "@/lib/notify";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Sign in", robots: { index: false, follow: false } };

async function login(fd: FormData) {
  "use server";
  const email = String(fd.get("email") ?? "").trim().toLowerCase();
  const pass = String(fd.get("password") ?? "");
  const ip = clientIp(await headers());
  if (!(await allow(`login:${ip}`, 10, 15 * 60_000))) redirect("/admin/login?e=many");
  const u = await one<{ id: number; email: string; name: string; hash: string; role: string }>("SELECT id, email, name, hash, role FROM users WHERE email = ?", [email]);
  if (!u || !(await bcrypt.compare(pass, String(u.hash)))) redirect("/admin/login?e=1");
  await createSession({ uid: Number(u.id), email: String(u.email), name: String(u.name), role: String(u.role) });
  redirect("/admin");
}

export default async function Login({ searchParams }: { searchParams: Promise<{ e?: string }> }) {
  if (await getSession()) redirect("/admin");
  const { e } = await searchParams;
  return (
    <main style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: "linear-gradient(160deg, #3C161A, #5E2A2F)", padding: 20 }}>
      <form action={login} className="card pad" style={{ width: "min(400px, 100%)", padding: 32 }}>
        <div style={{ textAlign: "center" }}><img src="/brand/logo.png" alt="The Royal Nile Residence" width={200} height={150} style={{ width: 200, height: "auto", margin: "0 auto" }} /><div className="small muted mt8">Admin</div></div>
        <h1 className="mt24" style={{ fontSize: 28 }}>Sign in</h1>
        {e ? <div className="err mt16">{e === "many" ? "Too many attempts. Please wait 15 minutes." : "Wrong email or password."}</div> : null}
        <label className="field mt16"><span>Email</span><input name="email" type="email" autoComplete="username" required /></label>
        <label className="field mt16"><span>Password</span><input name="password" type="password" autoComplete="current-password" required /></label>
        <button className="btn btn-navy btn-block mt24" type="submit">Sign in</button>
      </form>
    </main>
  );
}

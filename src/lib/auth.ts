import { SignJWT, jwtVerify } from "jose";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";

const COOKIE = "rnr_session";
const secret = () => {
  const s = process.env.AUTH_SECRET;
  if (!s || s.length < 16) throw new Error("AUTH_SECRET must be set (16+ characters)");
  return new TextEncoder().encode(s);
};
export type Session = { uid: number; email: string; name: string; role: string };

export async function createSession(s: Session) {
  const token = await new SignJWT({ ...s }).setProtectedHeader({ alg: "HS256" }).setExpirationTime("14d").sign(secret());
  (await cookies()).set(COOKIE, token, { httpOnly: true, sameSite: "lax", secure: process.env.NODE_ENV === "production", path: "/", maxAge: 60 * 60 * 24 * 14 });
}
export async function destroySession() { (await cookies()).delete(COOKIE); }
export async function getSession(): Promise<Session | null> {
  const t = (await cookies()).get(COOKIE)?.value;
  if (!t) return null;
  try { const { payload } = await jwtVerify(t, secret()); return payload as unknown as Session; } catch { return null; }
}
/** Pages and actions in the admin call this first. Staff can run bookings; only the owner sees costs and settings. */
export async function requireStaff(ownerOnly = false): Promise<Session> {
  const s = await getSession();
  if (!s) redirect("/admin/login");
  if (ownerOnly && s.role !== "OWNER") redirect("/admin?denied=1");
  return s;
}

import bcrypt from "bcryptjs";
import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import type { Role, User } from "@prisma/client";
import { prisma } from "./db";
import { randomToken, sha256 } from "./util";
import { env } from "./settings";
import { sendAccountEmail } from "./email";

export const SESSION_COOKIE = "qa_session";
const SESSION_DAYS = 14;

export async function hashPassword(pw: string) { return bcrypt.hash(pw, 12); }
export async function verifyPassword(pw: string, hash: string) { return bcrypt.compare(pw, hash); }

export function passwordProblem(pw: string): string | null {
  if (pw.length < 10) return "Password must be at least 10 characters.";
  if (!/[A-Za-z]/.test(pw) || !/\d/.test(pw)) return "Password must contain letters and numbers.";
  return null;
}

export async function clientIp(): Promise<string> {
  const h = await headers();
  return (h.get("x-forwarded-for")?.split(",")[0] || h.get("x-real-ip") || "local").trim();
}

export async function createSession(userId: string) {
  const token = randomToken(32);
  const h = await headers();
  await prisma.session.create({
    data: { id: sha256(token), userId, expiresAt: new Date(Date.now() + SESSION_DAYS * 86400_000), ip: await clientIp(), userAgent: h.get("user-agent")?.slice(0, 300) },
  });
  (await cookies()).set(SESSION_COOKIE, token, {
    httpOnly: true, sameSite: "lax", secure: process.env.NODE_ENV === "production", path: "/", maxAge: SESSION_DAYS * 86400,
  });
}

export async function destroySession() {
  const jar = await cookies();
  const token = jar.get(SESSION_COOKIE)?.value;
  if (token) await prisma.session.deleteMany({ where: { id: sha256(token) } });
  jar.delete(SESSION_COOKIE);
}

export async function getCurrentUser(): Promise<User | null> {
  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  if (!token) return null;
  const s = await prisma.session.findUnique({ where: { id: sha256(token) }, include: { user: true } });
  if (!s || s.expiresAt < new Date() || !s.user.active) return null;
  return s.user;
}

export const isStaff = (u: User | null) => !!u && (u.role === "ADMIN" || u.role === "STAFF");

/** For pages: redirects to login when not signed in / not allowed. */
export async function requireUser(roles?: Role[], loginPath = "/account/login"): Promise<User> {
  const u = await getCurrentUser();
  if (!u) redirect(loginPath);
  if (roles && !roles.includes(u.role)) redirect(isStaff(u) ? "/admin" : "/account");
  return u;
}

export async function requireStaffPage(adminOnly = false) {
  return requireUser(adminOnly ? ["ADMIN"] : ["ADMIN", "STAFF"], "/admin/login");
}

/** For API routes: returns the user or null (caller responds 401/403). */
export async function apiUser(roles?: Role[]): Promise<User | null> {
  const u = await getCurrentUser();
  if (!u) return null;
  if (roles && !roles.includes(u.role)) return null;
  return u;
}

export async function issueToken(userId: string, type: "EMAIL_VERIFY" | "PASSWORD_RESET"): Promise<string> {
  const token = randomToken(32);
  await prisma.authToken.create({
    data: { userId, type, tokenHash: sha256(token), expiresAt: new Date(Date.now() + (type === "EMAIL_VERIFY" ? 24 : 1) * 3600_000) },
  });
  return token;
}

export async function consumeToken(token: string, type: "EMAIL_VERIFY" | "PASSWORD_RESET") {
  const t = await prisma.authToken.findUnique({ where: { tokenHash: sha256(token) } });
  if (!t || t.type !== type || t.usedAt || t.expiresAt < new Date()) return null;
  await prisma.authToken.update({ where: { id: t.id }, data: { usedAt: new Date() } });
  return t;
}

export async function sendVerification(user: { id: string; email: string; name: string }) {
  const token = await issueToken(user.id, "EMAIL_VERIFY");
  await sendAccountEmail("verify_email", user.email, user.name, `${env.appUrl()}/account/verify?token=${token}`);
}

export async function sendPasswordReset(user: { id: string; email: string; name: string }) {
  const token = await issueToken(user.id, "PASSWORD_RESET");
  await sendAccountEmail("password_reset", user.email, user.name, `${env.appUrl()}/account/reset?token=${token}`);
}

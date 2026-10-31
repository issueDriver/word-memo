import "server-only";

import { randomBytes, createHash } from "node:crypto";
import { and, eq, gt, lt } from "drizzle-orm";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { connection } from "next/server";
import { cache } from "react";
import { db } from "@/db";
import { adminSessions, adminUsers } from "@/db/schema";
import {
  adminColumns,
  hasAdministrators,
  serializeAdmin,
} from "@/lib/admin-store";

export const SESSION_COOKIE = "word-memo-session";
export const SESSION_LIFETIME_SECONDS = 60 * 60 * 24 * 7;

function tokenHash(token: string) {
  return createHash("sha256").update(token).digest("hex");
}

function validToken(token: string | undefined): token is string {
  return !!token && /^[a-f0-9]{64}$/.test(token);
}

export const hasAdminUsers = cache(async () => {
  await connection();
  return hasAdministrators();
});

export async function createSession(userId: string) {
  const cookieStore = await cookies();
  const oldToken = cookieStore.get(SESSION_COOKIE)?.value;
  const token = randomBytes(32).toString("hex");
  const expiresAt = new Date(Date.now() + SESSION_LIFETIME_SECONDS * 1000);

  await db.transaction(async (tx) => {
    const [user] = await tx
      .select({ status: adminUsers.status })
      .from(adminUsers)
      .where(eq(adminUsers.id, userId))
      .for("share");
    if (!user || user.status !== "active")
      throw new Error("Cannot create a session for an inactive administrator.");
    if (validToken(oldToken))
      await tx
        .delete(adminSessions)
        .where(eq(adminSessions.id, tokenHash(oldToken)));
    await tx
      .delete(adminSessions)
      .where(lt(adminSessions.expiresAt, new Date()));
    await tx
      .insert(adminSessions)
      .values({ id: tokenHash(token), userId, expiresAt });
  });

  cookieStore.set(SESSION_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: SESSION_LIFETIME_SECONDS,
    expires: expiresAt,
  });
}

export async function destroySession() {
  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE)?.value;
  if (validToken(token))
    await db
      .delete(adminSessions)
      .where(eq(adminSessions.id, tokenHash(token)));
  cookieStore.delete(SESSION_COOKIE);
}

export const getCurrentUser = cache(async () => {
  await connection();
  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  if (!validToken(token)) return null;
  const [user] = await db
    .select(adminColumns)
    .from(adminSessions)
    .innerJoin(adminUsers, eq(adminSessions.userId, adminUsers.id))
    .where(
      and(
        eq(adminSessions.id, tokenHash(token)),
        gt(adminSessions.expiresAt, new Date()),
        eq(adminUsers.status, "active"),
      ),
    )
    .limit(1);
  return user ? serializeAdmin(user) : null;
});

export async function requireUser() {
  const user = await getCurrentUser();
  if (!user) redirect((await hasAdminUsers()) ? "/signin" : "/signup");
  return user;
}

export async function requireSystemAdmin() {
  const user = await requireUser();
  if (user.role !== "system_admin") redirect("/books");
  return user;
}

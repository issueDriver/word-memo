import "server-only";

import { randomBytes, createHash, scrypt, timingSafeEqual } from "node:crypto";
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import path from "node:path";
import { promisify } from "node:util";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { connection } from "next/server";
import { getIronSession } from "iron-session";
import { cache } from "react";
import { findUser, getDb } from "@/lib/db";

const deriveKey = promisify(scrypt);
const sessionLifetime = 60 * 60 * 24 * 7;

function sessionPassword() {
  if (process.env.SESSION_PASSWORD) return process.env.SESSION_PASSWORD;
  const directory = path.join(process.cwd(), ".data");
  const filename = path.join(directory, "session-secret");
  mkdirSync(directory, { recursive: true, mode: 0o700 });
  try {
    writeFileSync(filename, randomBytes(48).toString("hex"), {
      flag: "wx",
      mode: 0o600,
    });
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== "EEXIST") throw error;
  }
  return readFileSync(filename, "utf8");
}

async function session() {
  await connection();
  return getIronSession<{ token?: string }>(await cookies(), {
    password: sessionPassword(),
    cookieName: "word-memo-session",
    ttl: sessionLifetime,
    cookieOptions: {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
    },
  });
}

function tokenHash(token: string) {
  return createHash("sha256").update(token).digest("hex");
}

export async function hashPassword(password: string) {
  const salt = randomBytes(16).toString("hex");
  const hash = (await deriveKey(password, salt, 64)) as Buffer;
  return `${salt}:${hash.toString("hex")}`;
}

export async function verifyPassword(password: string, stored: string) {
  const [salt, hash] = stored.split(":");
  const actual = (await deriveKey(password, salt, 64)) as Buffer;
  const expected = Buffer.from(hash, "hex");
  return actual.length === expected.length && timingSafeEqual(actual, expected);
}

export async function createSession(userId: string) {
  const current = await session();
  const db = getDb();
  if (current.token)
    db.prepare("DELETE FROM sessions WHERE id = ?").run(
      tokenHash(current.token),
    );
  db.prepare("DELETE FROM sessions WHERE expiresAt < ?").run(Date.now());
  current.token = randomBytes(32).toString("hex");
  db.prepare("INSERT INTO sessions VALUES (?, ?, ?)").run(
    tokenHash(current.token),
    userId,
    Date.now() + sessionLifetime * 1000,
  );
  await current.save();
}

export async function destroySession() {
  const current = await session();
  if (current.token)
    getDb()
      .prepare("DELETE FROM sessions WHERE id = ?")
      .run(tokenHash(current.token));
  current.destroy();
}

export const getCurrentUser = cache(async () => {
  const current = await session();
  if (!current.token) return null;
  const record = getDb()
    .prepare("SELECT userId FROM sessions WHERE id = ? AND expiresAt > ?")
    .get(tokenHash(current.token), Date.now()) as
    { userId: string } | undefined;
  const user = record ? findUser(record.userId) : undefined;
  return user?.status === "active" ? user : null;
});

export async function requireUser() {
  const user = await getCurrentUser();
  if (!user) redirect("/signin");
  return user;
}

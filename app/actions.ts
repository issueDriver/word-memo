"use server";

import { randomUUID } from "node:crypto";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import {
  createSession,
  destroySession,
  hashPassword,
  requireUser,
  verifyPassword,
} from "@/lib/auth";
import { findUser, getDb } from "@/lib/db";
import {
  bookSchema,
  profileSchema,
  signinSchema,
  signupSchema,
} from "@/lib/validation";
import type { ActionResult } from "@/lib/types";

function duplicateEmail(error: unknown) {
  return (
    error instanceof Error &&
    error.message.includes("UNIQUE constraint failed: users.email")
  );
}

export async function signup(
  _previous: ActionResult,
  formData: FormData,
): Promise<ActionResult> {
  const result = signupSchema.safeParse(Object.fromEntries(formData));
  if (!result.success) return { error: result.error.issues[0].message };
  const { name, email, password } = result.data;
  const id = randomUUID();
  const hashed = await hashPassword(password);
  try {
    getDb()
      .prepare(
        "INSERT INTO users (id, name, email, password, createdAt, lastLogin) VALUES (?, ?, ?, ?, ?, ?)",
      )
      .run(
        id,
        name,
        email,
        hashed,
        new Date().toISOString(),
        new Date().toISOString(),
      );
  } catch (error) {
    if (duplicateEmail(error)) return { error: "该邮箱已注册，请直接登录" };
    throw error;
  }
  await createSession(id);
  redirect("/books");
}

export async function signin(
  _previous: ActionResult,
  formData: FormData,
): Promise<ActionResult> {
  const result = signinSchema.safeParse(Object.fromEntries(formData));
  if (!result.success) return { error: result.error.issues[0].message };
  const { email, password } = result.data;
  const db = getDb();
  const attempt = db
    .prepare("SELECT attempts, expiresAt FROM login_attempts WHERE email = ?")
    .get(email) as { attempts: number; expiresAt: number } | undefined;
  if (attempt && attempt.attempts >= 5 && attempt.expiresAt > Date.now()) {
    return { error: "登录尝试次数过多，请 10 分钟后重试" };
  }
  const user = db
    .prepare("SELECT id, password, status FROM users WHERE email = ?")
    .get(email) as { id: string; password: string; status: string } | undefined;
  const valid = await verifyPassword(
    password,
    user?.password ?? `${"0".repeat(32)}:${"0".repeat(128)}`,
  );
  if (!user || !valid || user.status !== "active") {
    const now = Date.now();
    db.prepare(
      `INSERT INTO login_attempts VALUES (?, 1, ?)
      ON CONFLICT(email) DO UPDATE SET
      attempts = CASE WHEN login_attempts.expiresAt < ? THEN 1 ELSE login_attempts.attempts + 1 END,
      expiresAt = CASE WHEN login_attempts.expiresAt < ? THEN excluded.expiresAt ELSE login_attempts.expiresAt END`,
    ).run(email, now + 10 * 60 * 1000, now, now);
    return { error: "邮箱或密码错误，或账号已被停用" };
  }
  db.prepare("DELETE FROM login_attempts WHERE email = ?").run(email);
  db.prepare("UPDATE users SET lastLogin = ? WHERE id = ?").run(
    new Date().toISOString(),
    user.id,
  );
  await createSession(user.id);
  redirect("/books");
}

export async function signout() {
  await destroySession();
  redirect("/signin");
}

export async function saveBook(
  id: string | null,
  _previous: ActionResult,
  formData: FormData,
): Promise<ActionResult> {
  await requireUser();
  const result = bookSchema.safeParse(Object.fromEntries(formData));
  if (!result.success) return { error: result.error.issues[0].message };
  const { name, subtitle, category, wordCount, status, color } = result.data;
  const db = getDb();
  const now = new Date().toISOString();
  if (id) {
    const updated = db
      .prepare(
        "UPDATE books SET name = ?, subtitle = ?, category = ?, wordCount = ?, status = ?, color = ?, updatedAt = ? WHERE id = ?",
      )
      .run(name, subtitle, category, wordCount, status, color, now, id);
    if (!updated.changes) return { error: "单词书不存在，请刷新页面" };
  } else {
    db.prepare("INSERT INTO books VALUES (?, ?, ?, ?, ?, ?, ?, ?)").run(
      randomUUID(),
      name,
      subtitle,
      category,
      wordCount,
      status,
      color,
      now,
    );
  }
  revalidatePath("/books");
  return { success: true };
}

export async function toggleBookStatus(id: string): Promise<ActionResult> {
  await requireUser();
  const result = getDb()
    .prepare(
      "UPDATE books SET status = CASE WHEN status = 'published' THEN 'draft' ELSE 'published' END, updatedAt = ? WHERE id = ?",
    )
    .run(new Date().toISOString(), id);
  if (!result.changes) return { error: "单词书不存在，请刷新页面" };
  revalidatePath("/books");
  return { success: true };
}

export async function deleteBook(id: string): Promise<ActionResult> {
  await requireUser();
  const result = getDb().prepare("DELETE FROM books WHERE id = ?").run(id);
  if (!result.changes) return { error: "单词书不存在，请刷新页面" };
  revalidatePath("/books");
  return { success: true };
}

export async function saveAdmin(
  id: string | null,
  _previous: ActionResult,
  formData: FormData,
): Promise<ActionResult> {
  await requireUser();
  const result = (id ? profileSchema : signupSchema).safeParse(
    Object.fromEntries(formData),
  );
  if (!result.success) return { error: result.error.issues[0].message };
  const { name, email } = result.data;
  const db = getDb();
  const hashed =
    !id && "password" in result.data
      ? await hashPassword(result.data.password as string)
      : null;
  try {
    if (id) {
      const updated = db
        .prepare("UPDATE users SET name = ?, email = ? WHERE id = ?")
        .run(name, email, id);
      if (!updated.changes) return { error: "管理员不存在，请刷新页面" };
    } else {
      db.prepare(
        "INSERT INTO users (id, name, email, password, createdAt) VALUES (?, ?, ?, ?, ?)",
      ).run(randomUUID(), name, email, hashed, new Date().toISOString());
    }
  } catch (error) {
    if (duplicateEmail(error)) return { error: "该邮箱已被使用" };
    throw error;
  }
  revalidatePath("/", "layout");
  return { success: true };
}

export async function toggleAdminStatus(id: string): Promise<ActionResult> {
  const current = await requireUser();
  if (id === current.id) return { error: "不能停用当前登录的账号" };
  const target = findUser(id);
  if (!target) return { error: "管理员不存在，请刷新页面" };
  const db = getDb();
  db.exec("BEGIN IMMEDIATE");
  try {
    db.prepare("UPDATE users SET status = ? WHERE id = ?").run(
      target.status === "active" ? "disabled" : "active",
      id,
    );
    db.prepare("DELETE FROM sessions WHERE userId = ?").run(id);
    db.exec("COMMIT");
  } catch (error) {
    db.exec("ROLLBACK");
    throw error;
  }
  revalidatePath("/admin-users");
  return { success: true };
}

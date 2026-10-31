"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import {
  createSession,
  destroySession,
  getCurrentUser,
  hasAdminUsers,
  requireUser,
} from "@/lib/auth";
import {
  bookDatabaseError,
  deleteBookRecord,
  saveBookRecord,
  toggleBookRecord,
} from "@/lib/book-store";
import { hashPassword } from "@/lib/password";
import {
  AdminStoreError,
  authenticateAdministrator,
  createInitialAdministrator,
  isDuplicateEmail,
  saveAdministrator,
  toggleAdministrator,
} from "@/lib/admin-store";
import {
  bookSchema,
  adminCreateSchema,
  adminProfileSchema,
  signinSchema,
  signupSchema,
} from "@/lib/validation";
import type { ActionResult } from "@/lib/types";

export async function signup(
  _previous: ActionResult,
  formData: FormData,
): Promise<ActionResult> {
  if (await hasAdminUsers()) redirect("/signin");
  const result = signupSchema.safeParse(Object.fromEntries(formData));
  if (!result.success) return { error: result.error.issues[0].message };
  const { name, email, password } = result.data;
  const hashed = await hashPassword(password);
  const user = await createInitialAdministrator({ name, email }, hashed);
  if (!user) redirect("/signin");
  await createSession(user.id);
  redirect("/books");
}

export async function signin(
  _previous: ActionResult,
  formData: FormData,
): Promise<ActionResult> {
  if (!(await hasAdminUsers())) redirect("/signup");
  const result = signinSchema.safeParse(Object.fromEntries(formData));
  if (!result.success) return { error: result.error.issues[0].message };
  const user = await authenticateAdministrator(
    result.data.email,
    result.data.password,
  );
  if ("error" in user) return { error: user.error };
  await createSession(user.id);
  redirect("/books");
}

export async function signout() {
  await destroySession();
  redirect((await hasAdminUsers()) ? "/signin" : "/signup");
}

export async function saveBook(
  id: string | null,
  _previous: ActionResult,
  formData: FormData,
): Promise<ActionResult> {
  await requireUser();
  if (id !== null && !z.uuid().safeParse(id).success)
    return { error: "单词书编号无效" };
  const result = bookSchema.safeParse(Object.fromEntries(formData));
  if (!result.success) return { error: result.error.issues[0].message };
  try {
    await saveBookRecord(id, result.data);
  } catch (error) {
    const message = bookDatabaseError(error);
    if (message) return { error: message };
    throw error;
  }
  revalidatePath("/books");
  return { success: true };
}

export async function toggleBookStatus(id: string): Promise<ActionResult> {
  await requireUser();
  if (!z.uuid().safeParse(id).success) return { error: "单词书编号无效" };
  try {
    await toggleBookRecord(id);
  } catch (error) {
    const message = bookDatabaseError(error);
    if (message) return { error: message };
    throw error;
  }
  revalidatePath("/books");
  return { success: true };
}

export async function deleteBook(id: string): Promise<ActionResult> {
  await requireUser();
  if (!z.uuid().safeParse(id).success) return { error: "单词书编号无效" };
  try {
    await deleteBookRecord(id);
  } catch (error) {
    const message = bookDatabaseError(error);
    if (message) return { error: message };
    throw error;
  }
  revalidatePath("/books");
  return { success: true };
}

export async function saveAdmin(
  id: string | null,
  _previous: ActionResult,
  formData: FormData,
): Promise<ActionResult> {
  const current = await getCurrentUser();
  if (!current || current.role !== "system_admin")
    return { error: "没有管理员管理权限" };
  if (id !== null && !z.uuid().safeParse(id).success)
    return { error: "管理员编号无效" };
  const result = (id ? adminProfileSchema : adminCreateSchema).safeParse(
    Object.fromEntries(formData),
  );
  if (!result.success) return { error: result.error.issues[0].message };
  const { name, email, role } = result.data;
  const hashed =
    !id && "password" in result.data
      ? await hashPassword(result.data.password as string)
      : undefined;
  try {
    await saveAdministrator(current.id, id, { name, email, role }, hashed);
  } catch (error) {
    if (isDuplicateEmail(error)) return { error: "该邮箱已被使用" };
    if (error instanceof AdminStoreError) return { error: error.message };
    throw error;
  }
  revalidatePath("/", "layout");
  return { success: true };
}

export async function toggleAdminStatus(id: string): Promise<ActionResult> {
  const current = await getCurrentUser();
  if (!current || current.role !== "system_admin")
    return { error: "没有管理员管理权限" };
  if (!z.uuid().safeParse(id).success) return { error: "管理员编号无效" };
  try {
    await toggleAdministrator(current.id, id);
  } catch (error) {
    if (error instanceof AdminStoreError) return { error: error.message };
    throw error;
  }
  revalidatePath("/admin-users");
  return { success: true };
}

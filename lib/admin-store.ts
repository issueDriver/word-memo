import "server-only";

import { and, eq, sql } from "drizzle-orm";
import { db } from "@/db";
import { adminSessions, adminUsers } from "@/db/schema";
import { dummyPasswordHash, verifyPassword } from "@/lib/password";
import type { AdminRole, AdminUser } from "@/lib/types";

export const adminColumns = {
  id: adminUsers.id,
  name: adminUsers.name,
  email: adminUsers.email,
  role: adminUsers.role,
  status: adminUsers.status,
  createdAt: adminUsers.createdAt,
  lastLogin: adminUsers.lastLogin,
};

type PublicAdmin = Pick<
  typeof adminUsers.$inferSelect,
  keyof typeof adminColumns
>;
type Transaction = Parameters<Parameters<typeof db.transaction>[0]>[0];
type Profile = { name: string; email: string; role: AdminRole };

export function serializeAdmin(user: PublicAdmin): AdminUser {
  return {
    ...user,
    createdAt: user.createdAt.toISOString(),
    lastLogin: user.lastLogin?.toISOString() ?? null,
  };
}

export class AdminStoreError extends Error {}

export function isDuplicateEmail(error: unknown): boolean {
  let current = error;
  while (current instanceof Error) {
    if ((current as Error & { code?: string }).code === "23505") return true;
    current = current.cause;
  }
  return false;
}

async function lockAdministrators(tx: Transaction) {
  // Serializes bootstrap and role/status changes across app instances.
  await tx.execute(sql`lock table ${adminUsers} in share row exclusive mode`);
}

async function checkSystemAdmin(tx: Transaction, actorId: string) {
  const [actor] = await tx
    .select({ role: adminUsers.role, status: adminUsers.status })
    .from(adminUsers)
    .where(eq(adminUsers.id, actorId));
  if (!actor || actor.status !== "active" || actor.role !== "system_admin") {
    throw new AdminStoreError("没有管理员管理权限");
  }
}

async function protectLastSystemAdmin(tx: Transaction, target: PublicAdmin) {
  if (target.role !== "system_admin" || target.status !== "active") return;
  const others = await tx
    .select({ id: adminUsers.id })
    .from(adminUsers)
    .where(
      and(eq(adminUsers.role, "system_admin"), eq(adminUsers.status, "active")),
    );
  if (others.length <= 1)
    throw new AdminStoreError("必须保留至少一位正常的系统管理员");
}

export async function hasAdministrators() {
  const rows = await db.select({ id: adminUsers.id }).from(adminUsers).limit(1);
  return rows.length > 0;
}

export async function createInitialAdministrator(
  profile: { name: string; email: string },
  passwordHash: string,
) {
  return db.transaction(async (tx) => {
    await lockAdministrators(tx);
    if (
      (await tx.select({ id: adminUsers.id }).from(adminUsers).limit(1)).length
    )
      return null;
    const [user] = await tx
      .insert(adminUsers)
      .values({
        ...profile,
        passwordHash,
        role: "system_admin",
        lastLogin: new Date(),
      })
      .returning({ id: adminUsers.id });
    return user;
  });
}

export async function authenticateAdministrator(
  email: string,
  password: string,
) {
  return db.transaction(async (tx) => {
    const [user] = await tx
      .select()
      .from(adminUsers)
      .where(eq(sql`lower(${adminUsers.email})`, email))
      .for("update");
    const now = new Date();
    if (user?.lockedUntil && user.lockedUntil > now)
      return { error: "登录尝试次数过多，请 10 分钟后重试" };
    const valid = await verifyPassword(
      password,
      user?.passwordHash ?? dummyPasswordHash,
    );
    if (!user || !valid || user.status !== "active") {
      if (user) {
        const attempts = (user.lockedUntil ? 0 : user.loginAttempts) + 1;
        await tx
          .update(adminUsers)
          .set({
            loginAttempts: attempts,
            lockedUntil:
              attempts >= 5 ? new Date(now.getTime() + 10 * 60 * 1000) : null,
          })
          .where(eq(adminUsers.id, user.id));
      }
      return { error: "邮箱或密码错误，或账号已被停用" };
    }
    await tx
      .update(adminUsers)
      .set({ loginAttempts: 0, lockedUntil: null, lastLogin: now })
      .where(eq(adminUsers.id, user.id));
    return { id: user.id };
  });
}

export async function listAdministrators(actorId: string) {
  return db.transaction(async (tx) => {
    await checkSystemAdmin(tx, actorId);
    const users = await tx
      .select(adminColumns)
      .from(adminUsers)
      .orderBy(sql`${adminUsers.createdAt} desc`, adminUsers.id);
    return users.map(serializeAdmin);
  });
}

export async function saveAdministrator(
  actorId: string,
  id: string | null,
  profile: Profile,
  passwordHash?: string,
) {
  await db.transaction(async (tx) => {
    await lockAdministrators(tx);
    await checkSystemAdmin(tx, actorId);
    if (!id) {
      if (!passwordHash) throw new AdminStoreError("请输入密码");
      await tx.insert(adminUsers).values({ ...profile, passwordHash });
      return;
    }
    const [target] = await tx
      .select(adminColumns)
      .from(adminUsers)
      .where(eq(adminUsers.id, id));
    if (!target) throw new AdminStoreError("管理员不存在，请刷新页面");
    if (target.role === "system_admin" && profile.role !== "system_admin")
      await protectLastSystemAdmin(tx, target);
    await tx
      .update(adminUsers)
      .set({ ...profile, updatedAt: new Date() })
      .where(eq(adminUsers.id, id));
    if (target.role !== profile.role)
      await tx.delete(adminSessions).where(eq(adminSessions.userId, id));
  });
}

export async function toggleAdministrator(actorId: string, id: string) {
  await db.transaction(async (tx) => {
    await lockAdministrators(tx);
    await checkSystemAdmin(tx, actorId);
    if (id === actorId) throw new AdminStoreError("不能停用当前登录的账号");
    const [target] = await tx
      .select(adminColumns)
      .from(adminUsers)
      .where(eq(adminUsers.id, id));
    if (!target) throw new AdminStoreError("管理员不存在，请刷新页面");
    if (target.status === "active") await protectLastSystemAdmin(tx, target);
    await tx
      .update(adminUsers)
      .set({
        status: target.status === "active" ? "disabled" : "active",
        updatedAt: new Date(),
        loginAttempts: 0,
        lockedUntil: null,
      })
      .where(eq(adminUsers.id, id));
    await tx.delete(adminSessions).where(eq(adminSessions.userId, id));
  });
}

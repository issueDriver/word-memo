import type { Metadata } from "next";
import { requireUser } from "@/lib/auth";
import { listUsers } from "@/lib/db";
import { AdminUsersManager } from "@/components/admin-users-manager";
import { Suspense } from "react";
import { LoadingScreen } from "@/components/loading-screen";

export const metadata: Metadata = { title: "管理员管理" };
async function AdminUsersContent() {
  const user = await requireUser();
  return <AdminUsersManager users={listUsers()} currentUserId={user.id} />;
}

export default function AdminUsersPage() {
  return (
    <Suspense fallback={<LoadingScreen />}>
      <AdminUsersContent />
    </Suspense>
  );
}

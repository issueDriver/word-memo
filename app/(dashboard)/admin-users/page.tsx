import type { Metadata } from "next";
import { requireSystemAdmin } from "@/lib/auth";
import { listAdministrators } from "@/lib/admin-store";
import { AdminUsersManager } from "@/components/admin-users-manager";
import { Suspense } from "react";
import { LoadingScreen } from "@/components/loading-screen";

export const metadata: Metadata = { title: "管理员管理" };
async function AdminUsersContent() {
  const user = await requireSystemAdmin();
  return (
    <AdminUsersManager
      users={await listAdministrators(user.id)}
      currentUserId={user.id}
    />
  );
}

export default function AdminUsersPage() {
  return (
    <Suspense fallback={<LoadingScreen />}>
      <AdminUsersContent />
    </Suspense>
  );
}

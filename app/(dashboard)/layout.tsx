import { AdminShell } from "@/components/admin-shell";
import { getCurrentUser } from "@/lib/auth";
import { Suspense } from "react";
import { LoadingScreen } from "@/components/loading-screen";

async function AuthenticatedShell({ children }: { children: React.ReactNode }) {
  const user = await getCurrentUser();
  // Each page checks access before reading data and handles its own redirect.
  return user ? <AdminShell user={user}>{children}</AdminShell> : children;
}

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <Suspense fallback={<LoadingScreen fullScreen />}>
      <AuthenticatedShell>{children}</AuthenticatedShell>
    </Suspense>
  );
}

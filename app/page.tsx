import { redirect } from "next/navigation";
import { getCurrentUser, hasAdminUsers } from "@/lib/auth";
import { Suspense } from "react";
import { LoadingScreen } from "@/components/loading-screen";

async function HomeRedirect() {
  return redirect(
    (await getCurrentUser())
      ? "/books"
      : (await hasAdminUsers())
        ? "/signin"
        : "/signup",
  );
}

export default function Home() {
  return (
    <Suspense fallback={<LoadingScreen fullScreen />}>
      <HomeRedirect />
    </Suspense>
  );
}

import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { Suspense } from "react";
import { LoadingScreen } from "@/components/loading-screen";

async function HomeRedirect() {
  return redirect((await getCurrentUser()) ? "/books" : "/signin");
}

export default function Home() {
  return (
    <Suspense fallback={<LoadingScreen fullScreen />}>
      <HomeRedirect />
    </Suspense>
  );
}

import type { Metadata } from "next";
import { AuthLayout } from "@/components/auth-layout";
import { Suspense } from "react";
import { LoadingScreen } from "@/components/loading-screen";

export const metadata: Metadata = { title: "登录" };
export default function SigninPage() {
  return (
    <Suspense fallback={<LoadingScreen fullScreen />}>
      <AuthLayout mode="signin" />
    </Suspense>
  );
}

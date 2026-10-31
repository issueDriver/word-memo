import type { Metadata } from "next";
import { AuthLayout } from "@/components/auth-layout";
import { Suspense } from "react";
import { LoadingScreen } from "@/components/loading-screen";

export const metadata: Metadata = { title: "注册管理员" };
export default function SignupPage() {
  return (
    <Suspense fallback={<LoadingScreen fullScreen />}>
      <AuthLayout mode="signup" />
    </Suspense>
  );
}

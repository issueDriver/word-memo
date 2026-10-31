import Image from "next/image";
import { redirect } from "next/navigation";
import { Brand } from "@/components/brand";
import { AuthForm } from "@/components/auth-form";
import { getCurrentUser } from "@/lib/auth";

export async function AuthLayout({ mode }: { mode: "signin" | "signup" }) {
  if (await getCurrentUser()) redirect("/books");
  return (
    <main className="grid min-h-dvh lg:grid-cols-[1fr_44%]">
      <div className="flex min-h-dvh flex-col px-6 py-7 sm:px-12">
        <Brand />
        <div className="flex flex-1 items-center justify-center py-12">
          <AuthForm mode={mode} />
        </div>
        <p className="text-xs text-muted-foreground">© 2026 Word Memo</p>
      </div>
      <div className="relative hidden min-h-full overflow-hidden bg-[#dbe0d7] lg:block">
        <Image
          src="/library.jpg"
          alt="图书馆内整齐排列的书架与藏书"
          fill
          priority
          sizes="44vw"
          className="object-cover"
        />
        <div className="absolute inset-x-0 bottom-0 bg-black/50 px-10 py-8 text-white backdrop-blur-sm">
          <p className="font-serif text-[30px] leading-tight">
            One word at a time.
          </p>
          <p className="mt-3 text-xs text-white/75">
            WORD MEMO · 每一个单词，都有新的可能
          </p>
        </div>
      </div>
    </main>
  );
}

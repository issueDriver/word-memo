"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { useFormStatus } from "react-dom";
import {
  BookOpen,
  ChevronRight,
  LayoutGrid,
  LoaderCircle,
  LogOut,
  Menu,
  ShieldCheck,
  Users,
} from "lucide-react";
import { signout } from "@/app/actions";
import { Brand } from "@/components/brand";
import { IconButton } from "@/components/icon-button";
import { Sheet, SheetContent, SheetTitle } from "@/components/ui/sheet";
import { cn } from "@/lib/utils";
import type { AdminUser } from "@/lib/types";

function LogoutButton() {
  const { pending } = useFormStatus();
  return (
    <IconButton
      type="submit"
      label="退出登录"
      disabled={pending}
      className="shrink-0 text-muted-foreground hover:text-destructive"
    >
      {pending ? (
        <LoaderCircle className="animate-spin" />
      ) : (
        <LogOut className="size-4" />
      )}
    </IconButton>
  );
}

export function AdminShell({
  user,
  children,
}: {
  user: AdminUser;
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const [mobileOpen, setMobileOpen] = useState(false);
  const booksActive = pathname === "/books";
  const title = booksActive ? "单词书管理" : "管理员管理";
  const sidebar = (
    <div className="flex h-full min-h-0 flex-col">
      <div className="px-5 pt-7 pb-6">
        <Link
          href="/books"
          aria-label="Word Memo 首页"
          onClick={() => setMobileOpen(false)}
        >
          <Brand />
        </Link>
      </div>
      <div className="mx-4 mb-7 flex items-center gap-3 rounded-md border bg-white px-3 py-3">
        <div className="flex size-8 items-center justify-center rounded-md bg-muted">
          <LayoutGrid className="size-4 text-muted-foreground" />
        </div>
        <div>
          <p className="text-[13px] font-medium">管理工作台</p>
          <p className="mt-0.5 text-[11px] text-muted-foreground">
            Word Memo Workspace
          </p>
        </div>
      </div>
      <nav aria-label="主导航" className="space-y-6 px-3">
        {[
          { label: "内容", name: "单词书管理", href: "/books", icon: BookOpen },
          {
            label: "系统",
            name: "管理员管理",
            href: "/admin-users",
            icon: Users,
          },
        ].map((item) => (
          <div key={item.href}>
            <p className="mb-2 px-3 text-[11px] font-medium text-muted-foreground">
              {item.label}
            </p>
            <Link
              href={item.href}
              onClick={() => setMobileOpen(false)}
              aria-current={pathname === item.href ? "page" : undefined}
              className={cn(
                "flex h-10 items-center gap-3 rounded-md px-3 text-[13px] font-medium transition-colors",
                pathname === item.href
                  ? "bg-primary/9 text-primary"
                  : "text-muted-foreground hover:bg-muted hover:text-foreground",
              )}
            >
              <item.icon className="size-[18px]" strokeWidth={1.8} />
              {item.name}
              {pathname === item.href && (
                <span className="ml-auto size-1.5 rounded-full bg-primary" />
              )}
            </Link>
          </div>
        ))}
      </nav>
      <div className="mt-auto px-4 pt-8 pb-4">
        <div className="mb-4 flex items-center gap-2 px-2 text-[11px] text-muted-foreground">
          <ShieldCheck className="size-3.5" />
          管理员工作空间
        </div>
        <div className="flex items-center gap-2.5 border-t pt-4">
          <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-[#e7ede5] text-xs font-semibold text-[#50644d]">
            {user.name.slice(0, 2).toUpperCase()}
          </span>
          <div className="min-w-0 flex-1">
            <p className="truncate text-xs font-medium">{user.name}</p>
            <p
              className="mt-1 truncate text-[11px] text-muted-foreground"
              title={user.email}
            >
              {user.email}
            </p>
          </div>
          <form action={signout}>
            <LogoutButton />
          </form>
        </div>
      </div>
    </div>
  );
  return (
    <div className="min-h-dvh">
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-[232px] border-r bg-sidebar md:block">
        {sidebar}
      </aside>
      <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
        <SheetContent
          side="left"
          className="w-[280px]! gap-0 bg-sidebar"
          aria-describedby={undefined}
        >
          <SheetTitle className="sr-only">导航菜单</SheetTitle>
          {sidebar}
        </SheetContent>
      </Sheet>
      <div className="min-w-0 md:ml-[232px]">
        <header className="flex h-[68px] items-center justify-between border-b bg-white px-5 sm:px-8 lg:px-10">
          <div className="flex items-center gap-3">
            <IconButton
              label="打开导航菜单"
              className="md:hidden"
              onClick={() => setMobileOpen(true)}
            >
              <Menu />
            </IconButton>
            <span className="hidden text-xs text-muted-foreground sm:inline">
              工作台
            </span>
            <ChevronRight className="hidden size-3.5 text-muted-foreground/60 sm:block" />
            <span className="text-xs font-medium">{title}</span>
          </div>
          <div className="flex items-center gap-3">
            <span className="hidden items-center gap-1.5 text-[11px] text-muted-foreground sm:flex">
              <span className="size-1.5 rounded-full bg-emerald-500" />
              工作空间
            </span>
            <span
              className="flex size-8 items-center justify-center rounded-full bg-[#eeeaf5] text-[11px] font-medium text-[#746184]"
              aria-label={user.name}
            >
              {user.name.slice(0, 2).toUpperCase()}
            </span>
          </div>
        </header>
        <main
          id="main-content"
          className="mx-auto w-full max-w-[1440px] px-5 py-8 sm:px-8 lg:px-10 lg:py-10"
        >
          {children}
        </main>
      </div>
    </div>
  );
}

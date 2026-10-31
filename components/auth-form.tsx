"use client";

import Link from "next/link";
import { useActionState, useState } from "react";
import {
  ArrowRight,
  Eye,
  EyeOff,
  LoaderCircle,
  LockKeyhole,
  Mail,
  UserRound,
  CircleAlert,
} from "lucide-react";
import { signin, signup } from "@/app/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { IconButton } from "@/components/icon-button";

export function PasswordField({
  id = "password",
  label = "密码",
  autoComplete = "new-password",
  minLength = 8,
}: {
  id?: string;
  label?: string;
  autoComplete?: string;
  minLength?: number;
}) {
  const [visible, setVisible] = useState(false);
  const [value, setValue] = useState("");
  return (
    <div className="grid gap-2">
      <Label htmlFor={id}>{label}</Label>
      <div className="relative">
        <LockKeyhole className="pointer-events-none absolute top-3 left-3 size-4 text-muted-foreground" />
        <Input
          id={id}
          name={id}
          value={value}
          onChange={(event) => setValue(event.target.value)}
          type={visible ? "text" : "password"}
          placeholder={
            id === "confirmPassword"
              ? "再次输入密码"
              : minLength > 1
                ? "至少 8 个字符"
                : "请输入密码"
          }
          autoComplete={autoComplete}
          minLength={minLength}
          maxLength={128}
          required
          className="h-10 pr-11 pl-10"
        />
        <IconButton
          label={visible ? `隐藏${label}` : `显示${label}`}
          type="button"
          className="absolute top-1 right-1 text-muted-foreground"
          onClick={() => setVisible(!visible)}
        >
          {visible ? <EyeOff /> : <Eye />}
        </IconButton>
      </div>
    </div>
  );
}

export function FormError({ error }: { error?: string }) {
  return error ? (
    <div
      role="alert"
      className="flex items-start gap-2 rounded-md border border-destructive/20 bg-destructive/5 p-3 text-sm text-destructive"
    >
      <CircleAlert className="mt-0.5 size-4 shrink-0" />
      {error}
    </div>
  ) : null;
}

export function AuthForm({ mode }: { mode: "signin" | "signup" }) {
  const registering = mode === "signup";
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [state, action, pending] = useActionState(
    registering ? signup : signin,
    {},
  );
  return (
    <div className="w-full max-w-[360px]">
      <div className="mb-8">
        <div className="mb-5 flex size-11 items-center justify-center rounded-lg border bg-muted/50">
          <LockKeyhole className="size-5 text-primary" strokeWidth={1.7} />
        </div>
        <h1 className="text-[28px] leading-tight font-semibold">
          {registering ? "创建管理员账号" : "欢迎回来"}
        </h1>
        <p className="mt-3 text-sm text-muted-foreground">
          {registering
            ? "注册 Word Memo，开启管理工作。"
            : "登录 Word Memo 管理后台"}
        </p>
      </div>
      <form action={action} className="grid gap-5" aria-busy={pending}>
        <fieldset
          disabled={pending}
          className="grid min-w-0 gap-5 disabled:opacity-70"
        >
          {registering && (
            <div className="grid gap-2">
              <Label htmlFor="name">姓名</Label>
              <div className="relative">
                <UserRound className="pointer-events-none absolute top-3 left-3 size-4 text-muted-foreground" />
                <Input
                  id="name"
                  name="name"
                  value={name}
                  onChange={(event) => setName(event.target.value)}
                  placeholder="请输入您的姓名"
                  autoComplete="name"
                  maxLength={40}
                  required
                  className="h-10 pl-10"
                />
              </div>
            </div>
          )}
          <div className="grid gap-2">
            <Label htmlFor="email">邮箱</Label>
            <div className="relative">
              <Mail className="pointer-events-none absolute top-3 left-3 size-4 text-muted-foreground" />
              <Input
                id="email"
                name="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                type="email"
                placeholder="name@example.com"
                autoComplete="email"
                maxLength={254}
                required
                className="h-10 pl-10"
              />
            </div>
          </div>
          <PasswordField
            autoComplete={registering ? "new-password" : "current-password"}
            minLength={registering ? 8 : 1}
          />
          {registering && (
            <PasswordField id="confirmPassword" label="确认密码" />
          )}
        </fieldset>
        <FormError error={state.error} />
        <Button
          type="submit"
          disabled={pending}
          className="mt-1 h-11 w-full justify-between px-4"
        >
          {pending
            ? registering
              ? "正在创建账号…"
              : "正在登录…"
            : registering
              ? "创建账号"
              : "登录"}
          {pending ? <LoaderCircle className="animate-spin" /> : <ArrowRight />}
        </Button>
      </form>
      <p className="mt-7 text-center text-sm text-muted-foreground">
        {registering ? "已有账号？" : "还没有账号？"}
        <Link
          href={registering ? "/signin" : "/signup"}
          className="ml-1 font-medium text-primary underline-offset-4 hover:underline"
        >
          {registering ? "立即登录" : "注册管理员"}
        </Link>
      </p>
    </div>
  );
}

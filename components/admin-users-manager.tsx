"use client";

import { useActionState, useState, useTransition } from "react";
import {
  CircleUserRound,
  LoaderCircle,
  LogIn,
  MoreHorizontal,
  Pencil,
  Plus,
  Save,
  Search,
  ShieldCheck,
  UserCheck,
  UserRoundX,
  Users,
  X,
} from "lucide-react";
import { toast } from "sonner";
import { saveAdmin, toggleAdminStatus } from "@/app/actions";
import { FormError, PasswordField } from "@/components/auth-form";
import {
  EmptyState,
  FilterSelect,
  formatDate,
  Pagination,
  StatBand,
  StatusBadge,
} from "@/components/management";
import { IconButton } from "@/components/icon-button";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import type { ActionResult, AdminUser } from "@/lib/types";
import { adminRoleLabels, adminRoles } from "@/lib/types";
import { cn } from "@/lib/utils";

function AdminForm({
  user,
  onClose,
}: {
  user: AdminUser | null;
  onClose: () => void;
}) {
  const [name, setName] = useState(user?.name ?? "");
  const [email, setEmail] = useState(user?.email ?? "");
  const [role, setRole] = useState<string>(user?.role ?? "admin");
  const [state, action, pending] = useActionState(
    async (previous: ActionResult, data: FormData) => {
      try {
        const result = await saveAdmin(user?.id ?? null, previous, data);
        if (result.success) {
          toast.success(user ? "管理员信息已更新" : "管理员已创建");
          onClose();
        }
        return result;
      } catch {
        return { error: "保存失败，请稍后重试" };
      }
    },
    {},
  );
  return (
    <form action={action} className="space-y-5" aria-busy={pending}>
      <fieldset disabled={pending} className="grid min-w-0 gap-5">
        <div className="grid gap-2">
          <Label htmlFor="admin-name">姓名</Label>
          <Input
            id="admin-name"
            name="name"
            value={name}
            onChange={(event) => setName(event.target.value)}
            placeholder="请输入姓名"
            autoComplete="name"
            maxLength={40}
            required
            className="h-10"
          />
        </div>
        <div className="grid gap-2">
          <Label htmlFor="admin-email">邮箱</Label>
          <Input
            id="admin-email"
            name="email"
            type="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            placeholder="name@example.com"
            autoComplete="email"
            maxLength={254}
            required
            className="h-10"
          />
        </div>
        <div className="grid gap-2">
          <Label htmlFor="admin-role">角色</Label>
          <FilterSelect
            id="admin-role"
            name="role"
            label="角色"
            value={role}
            onChange={setRole}
            options={adminRoles.map((value) => ({
              value,
              label: adminRoleLabels[value],
            }))}
          />
        </div>
        {!user && (
          <>
            <PasswordField id="admin-password" name="password" />
            <PasswordField
              id="admin-confirm-password"
              name="confirmPassword"
              label="确认密码"
            />
          </>
        )}
      </fieldset>
      <FormError error={state.error} />
      <div className="flex justify-end gap-2 border-t pt-5">
        <Button
          type="button"
          variant="outline"
          onClick={onClose}
          disabled={pending}
          className="h-9 px-4"
        >
          取消
        </Button>
        <Button type="submit" disabled={pending} className="h-9 px-4">
          {pending ? <LoaderCircle className="animate-spin" /> : <Save />}
          {pending ? "保存中…" : "保存管理员"}
        </Button>
      </div>
    </form>
  );
}

export function AdminUsersManager({
  users,
  currentUserId,
}: {
  users: AdminUser[];
  currentUserId: string;
}) {
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("all");
  const [page, setPage] = useState(1);
  const [editing, setEditing] = useState<AdminUser | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [disabling, setDisabling] = useState<AdminUser | null>(null);
  const [pending, startTransition] = useTransition();
  const active = users.filter((user) => user.status === "active").length;
  const filtered = users.filter(
    (user) =>
      (status === "all" || user.status === status) &&
      `${user.name} ${user.email}`
        .toLowerCase()
        .includes(search.trim().toLowerCase()),
  );
  const pageSize = 10;
  const currentPage = Math.min(
    page,
    Math.max(1, Math.ceil(filtered.length / pageSize)),
  );
  const visible = filtered.slice(
    (currentPage - 1) * pageSize,
    currentPage * pageSize,
  );
  function reset() {
    setSearch("");
    setStatus("all");
    setPage(1);
  }
  function edit(user: AdminUser | null) {
    setEditing(user);
    setDialogOpen(true);
  }
  function toggle(user: AdminUser) {
    startTransition(async () => {
      try {
        const result = await toggleAdminStatus(user.id);
        if (result.error) toast.error(result.error);
        else {
          toast.success(
            user.status === "active" ? "管理员已停用" : "管理员已启用",
          );
          setDisabling(null);
        }
      } catch {
        toast.error("操作失败，请稍后重试");
      }
    });
  }
  return (
    <>
      <div className="mb-7 flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-semibold">管理员管理</h1>
            <span className="rounded-md border bg-muted/40 px-2 py-0.5 text-xs text-muted-foreground">
              {users.length}
            </span>
          </div>
          <p className="mt-2 text-xs text-muted-foreground">工作空间成员</p>
        </div>
        <Button onClick={() => edit(null)} className="h-9 gap-2 px-4">
          <Plus className="size-4" />
          新增管理员
        </Button>
      </div>
      <StatBand
        items={[
          {
            label: "全部管理员",
            value: users.length,
            icon: Users,
            color: "bg-violet-50 text-violet-600",
          },
          {
            label: "正常账号",
            value: active,
            icon: UserCheck,
            color: "bg-emerald-50 text-emerald-700",
          },
          {
            label: "已停用",
            value: users.length - active,
            icon: UserRoundX,
            color: "bg-amber-50 text-amber-600",
          },
          {
            label: "已登录账号",
            value: users.filter((user) => !!user.lastLogin).length,
            icon: LogIn,
            color: "bg-blue-50 text-blue-600",
          },
        ]}
      />
      <div className="mb-5 flex h-11 items-start gap-2 border-b">
        <h2 className="flex h-11 items-start border-b-2 border-primary pt-1 text-xs font-medium text-primary">
          全部成员
          <span className="ml-2 rounded bg-primary/8 px-1.5 py-0.5 text-[10px]">
            {users.length}
          </span>
        </h2>
      </div>
      <div className="mb-5 flex flex-wrap items-center gap-3">
        <div className="relative w-full sm:w-[280px]">
          <Search className="pointer-events-none absolute top-2.5 left-3 size-4 text-muted-foreground" />
          <Input
            aria-label="搜索管理员"
            placeholder="搜索姓名或邮箱…"
            value={search}
            onChange={(event) => {
              setSearch(event.target.value);
              setPage(1);
            }}
            className="h-9 bg-white pl-9 text-xs!"
          />
        </div>
        <FilterSelect
          label="筛选账号状态"
          value={status}
          onChange={(value) => {
            setStatus(value);
            setPage(1);
          }}
          options={[
            { value: "all", label: "全部状态" },
            { value: "active", label: "正常" },
            { value: "disabled", label: "已停用" },
          ]}
        />
        {(!!search || status !== "all") && (
          <IconButton label="清除筛选" onClick={reset}>
            <X />
          </IconButton>
        )}
        <span className="ml-auto hidden items-center gap-1.5 text-[11px] text-muted-foreground sm:flex">
          <ShieldCheck className="size-3.5" />
          管理员
        </span>
      </div>
      {visible.length === 0 ? (
        <EmptyState
          noun="管理员"
          filtered={!!search || status !== "all"}
          onReset={reset}
        />
      ) : (
        <div className="mb-5">
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/40 hover:bg-muted/40">
                <TableHead className="h-10 pl-4 text-xs">管理员</TableHead>
                <TableHead className="text-xs">角色</TableHead>
                <TableHead className="text-xs">账号状态</TableHead>
                <TableHead className="text-xs">注册时间</TableHead>
                <TableHead className="text-xs">最近登录</TableHead>
                <TableHead className="pr-4 text-right text-xs">操作</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {visible.map((user, index) => (
                <TableRow key={user.id}>
                  <TableCell className="py-4 pl-4">
                    <div className="flex items-center gap-3">
                      <span
                        className={cn(
                          "flex size-10 shrink-0 items-center justify-center rounded-full text-xs font-medium",
                          [
                            "bg-[#e7ede5] text-[#50644d]",
                            "bg-[#eeeaf5] text-[#746184]",
                            "bg-[#e6edf5] text-[#526b88]",
                          ][index % 3],
                        )}
                      >
                        {user.name.slice(0, 2).toUpperCase()}
                      </span>
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <button
                            className="max-w-[200px] truncate text-xs font-medium hover:text-primary"
                            onClick={() => edit(user)}
                          >
                            {user.name}
                          </button>
                          {user.id === currentUserId && (
                            <span className="rounded bg-muted px-1.5 py-0.5 text-[10px] text-muted-foreground">
                              你
                            </span>
                          )}
                        </div>
                        <p
                          className="mt-1.5 max-w-[260px] truncate text-[11px] text-muted-foreground"
                          title={user.email}
                        >
                          {user.email}
                        </p>
                      </div>
                    </div>
                  </TableCell>
                  <TableCell>
                    <span className="inline-flex items-center gap-1.5 text-[11px]">
                      <ShieldCheck className="size-3.5 text-muted-foreground" />
                      {adminRoleLabels[user.role]}
                    </span>
                  </TableCell>
                  <TableCell>
                    <StatusBadge
                      active={user.status === "active"}
                      activeLabel="正常"
                      inactiveLabel="已停用"
                    />
                  </TableCell>
                  <TableCell className="text-[11px] text-muted-foreground tabular-nums">
                    {formatDate(user.createdAt)}
                  </TableCell>
                  <TableCell className="text-[11px] text-muted-foreground tabular-nums">
                    {formatDate(user.lastLogin)}
                  </TableCell>
                  <TableCell className="pr-3 text-right">
                    <DropdownMenu>
                      <DropdownMenuTrigger
                        render={
                          <Button
                            variant="ghost"
                            size="icon"
                            disabled={pending}
                            aria-label={`${user.name}的操作`}
                          />
                        }
                      >
                        <MoreHorizontal />
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onClick={() => edit(user)}>
                          <Pencil />
                          编辑信息
                        </DropdownMenuItem>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem
                          disabled={user.id === currentUserId}
                          variant={
                            user.status === "active" ? "destructive" : "default"
                          }
                          onClick={() =>
                            user.status === "active"
                              ? setDisabling(user)
                              : toggle(user)
                          }
                        >
                          {user.status === "active" ? (
                            <UserRoundX />
                          ) : (
                            <UserCheck />
                          )}
                          {user.status === "active" ? "停用账号" : "启用账号"}
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
      <Pagination
        page={currentPage}
        total={filtered.length}
        pageSize={pageSize}
        onChange={setPage}
      />
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-h-[90dvh] overflow-y-auto rounded-lg p-6 sm:max-w-[440px]">
          <DialogHeader className="mb-2">
            <DialogTitle className="flex items-center gap-2 text-lg font-semibold">
              <CircleUserRound className="size-5 text-primary" />
              {editing ? "编辑管理员" : "新增管理员"}
            </DialogTitle>
            <DialogDescription>
              {editing ? editing.email : "管理员账号信息"}
            </DialogDescription>
          </DialogHeader>
          {dialogOpen && (
            <AdminForm
              key={editing?.id ?? "new"}
              user={editing}
              onClose={() => setDialogOpen(false)}
            />
          )}
        </DialogContent>
      </Dialog>
      <AlertDialog
        open={!!disabling}
        onOpenChange={(open) => {
          if (!open && !pending) setDisabling(null);
        }}
      >
        <AlertDialogContent className="max-w-[calc(100%-2rem)] rounded-lg p-6 sm:max-w-[400px]">
          <AlertDialogHeader>
            <AlertDialogTitle>停用管理员？</AlertDialogTitle>
            <AlertDialogDescription className="break-all">
              停用「{disabling?.name}
              」后，该账号将无法登录，现有会话会立即失效。
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="m-0 rounded-none border-0 bg-transparent p-0 pt-2">
            <AlertDialogCancel disabled={pending}>取消</AlertDialogCancel>
            <AlertDialogAction
              variant="destructive"
              disabled={pending}
              onClick={() => {
                if (disabling) toggle(disabling);
              }}
            >
              {pending ? "处理中…" : "确认停用"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

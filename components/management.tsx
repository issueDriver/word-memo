"use client";

import {
  ChevronLeft,
  ChevronRight,
  SearchX,
  type LucideIcon,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { IconButton } from "@/components/icon-button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

export function FilterSelect({
  value,
  onChange,
  options,
  label,
  className,
  name,
  id,
}: {
  value?: string;
  onChange?: (value: string) => void;
  options: { value: string; label: string }[];
  label: string;
  className?: string;
  name?: string;
  id?: string;
}) {
  return (
    <Select
      value={value}
      onValueChange={(next) => {
        if (next !== null) onChange?.(next);
      }}
      items={options}
      name={name}
    >
      <SelectTrigger
        id={id}
        aria-label={label}
        className={cn("h-9! min-w-[130px] bg-white text-xs", className)}
      >
        <SelectValue />
      </SelectTrigger>
      <SelectContent alignItemWithTrigger={false}>
        {options.map((option) => (
          <SelectItem key={option.value} value={option.value}>
            {option.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

export function StatusBadge({
  active,
  activeLabel,
  inactiveLabel,
}: {
  active: boolean;
  activeLabel: string;
  inactiveLabel: string;
}) {
  return (
    <Badge
      variant="outline"
      className={cn(
        "gap-1.5 rounded-md border-transparent px-2 py-1 text-[11px] font-normal",
        active
          ? "bg-emerald-50 text-emerald-700"
          : "bg-amber-50 text-amber-700",
      )}
    >
      <span
        className={cn(
          "size-1.5 rounded-full",
          active ? "bg-emerald-500" : "bg-amber-400",
        )}
      />
      {active ? activeLabel : inactiveLabel}
    </Badge>
  );
}

export function StatBand({
  items,
}: {
  items: {
    label: string;
    value: string | number;
    icon: LucideIcon;
    color: string;
  }[];
}) {
  return (
    <dl className="mb-8 grid grid-cols-2 gap-y-6 border-y py-6 lg:grid-cols-4">
      {items.map((item, index) => (
        <div
          key={item.label}
          className={cn(
            "flex items-center gap-3.5 px-4 sm:px-6",
            index > 0 && "lg:border-l",
            index % 2 === 1 && "border-l",
            index === 0 && "pl-0",
          )}
        >
          <span
            className={cn(
              "flex size-10 shrink-0 items-center justify-center rounded-lg",
              item.color,
            )}
          >
            <item.icon className="size-[19px]" strokeWidth={1.7} />
          </span>
          <div className="min-w-0">
            <dt className="mb-1 text-[11px] text-muted-foreground">
              {item.label}
            </dt>
            <dd className="text-[23px] leading-tight font-semibold tabular-nums">
              {item.value}
            </dd>
          </div>
        </div>
      ))}
    </dl>
  );
}

export function EmptyState({
  filtered,
  onReset,
  noun,
}: {
  filtered: boolean;
  onReset: () => void;
  noun: string;
}) {
  return (
    <div className="flex min-h-[280px] flex-col items-center justify-center py-12 text-center">
      <div className="mb-4 flex size-12 items-center justify-center rounded-full bg-muted">
        <SearchX className="size-5 text-muted-foreground" />
      </div>
      <p className="text-sm font-medium">
        {filtered ? `没有找到匹配的${noun}` : `暂无${noun}`}
      </p>
      {filtered && (
        <Button variant="link" className="mt-2 text-xs" onClick={onReset}>
          清除筛选
        </Button>
      )}
    </div>
  );
}

export function Pagination({
  page,
  total,
  pageSize,
  onChange,
}: {
  page: number;
  total: number;
  pageSize: number;
  onChange: (page: number) => void;
}) {
  const pages = Math.max(1, Math.ceil(total / pageSize));
  return (
    <div className="flex flex-wrap items-center justify-between gap-3 border-t pt-5 text-xs text-muted-foreground">
      <p>
        共 {total} 条
        {total > 0 && (
          <span className="ml-2 hidden sm:inline">
            显示 {(page - 1) * pageSize + 1}–{Math.min(page * pageSize, total)}{" "}
            条
          </span>
        )}
      </p>
      <div className="flex items-center gap-2">
        <IconButton
          label="上一页"
          variant="outline"
          className="size-7"
          disabled={page <= 1}
          onClick={() => onChange(page - 1)}
        >
          <ChevronLeft className="size-3.5" />
        </IconButton>
        <span className="min-w-16 text-center tabular-nums">
          {page} / {pages}
        </span>
        <IconButton
          label="下一页"
          variant="outline"
          className="size-7"
          disabled={page >= pages}
          onClick={() => onChange(page + 1)}
        >
          <ChevronRight className="size-3.5" />
        </IconButton>
      </div>
    </div>
  );
}

export function formatDate(value: string | null) {
  if (!value) return "尚未登录";
  return new Intl.DateTimeFormat("zh-CN", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    timeZone: "Asia/Shanghai",
  })
    .format(new Date(value))
    .replaceAll("/", ".");
}

"use client";

import { useState, useTransition } from "react";
import {
  Archive,
  BookCopy,
  BookOpen,
  CheckCircle2,
  FilePenLine,
  LoaderCircle,
  MoreHorizontal,
  Pencil,
  Plus,
  Search,
  Trash2,
  Upload,
  X,
} from "lucide-react";
import { toast } from "sonner";
import { deleteBook, toggleBookStatus } from "@/app/actions";
import { BookCover } from "@/components/book-cover";
import { BookDialog } from "@/components/book-form";
import { IconButton } from "@/components/icon-button";
import {
  EmptyState,
  FilterSelect,
  formatDate,
  Pagination,
  StatBand,
  StatusBadge,
} from "@/components/management";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { FormError } from "@/components/auth-form";
import type { Book } from "@/lib/types";
import { cn } from "@/lib/utils";

export function BooksManager({ books }: { books: Book[] }) {
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("all");
  const [tag, setTag] = useState("all");
  const [sort, setSort] = useState("updated");
  const [page, setPage] = useState(1);
  const [editing, setEditing] = useState<Book | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [deleting, setDeleting] = useState<Book | null>(null);
  const [deleteError, setDeleteError] = useState<string>();
  const [pending, startTransition] = useTransition();
  const published = books.filter((book) => book.status === "published").length;
  const wordCount = books.reduce((sum, book) => sum + book.wordCount, 0);
  const tags = [...new Set(books.flatMap((book) => book.tags))].sort((a, b) =>
    a.localeCompare(b, "zh-CN"),
  );
  const filtered = books
    .filter(
      (book) =>
        (status === "all" || book.status === status) &&
        (tag === "all" || book.tags.some((value) => `tag:${value}` === tag)) &&
        `${book.title} ${book.bookId} ${book.tags.join(" ")}`
          .toLowerCase()
          .includes(search.trim().toLowerCase()),
    )
    .sort((a, b) =>
      sort === "title"
        ? a.title.localeCompare(b.title, "zh-CN")
        : sort === "words"
          ? b.wordCount - a.wordCount
          : b.updatedAt.localeCompare(a.updatedAt) || a.id.localeCompare(b.id),
    );
  const pageSize = 8;
  const currentPage = Math.min(
    page,
    Math.max(1, Math.ceil(filtered.length / pageSize)),
  );
  const visible = filtered.slice(
    (currentPage - 1) * pageSize,
    currentPage * pageSize,
  );
  const hasFilters = !!search || tag !== "all" || status !== "all";
  function reset() {
    setSearch("");
    setTag("all");
    setStatus("all");
    setPage(1);
  }
  function edit(book: Book | null) {
    setEditing(book);
    setDialogOpen(true);
  }
  function toggle(book: Book) {
    startTransition(async () => {
      try {
        const result = await toggleBookStatus(book.id);
        if (result.error) toast.error(result.error);
        else
          toast.success(
            book.status === "published" ? "单词书已转为草稿" : "单词书已发布",
          );
      } catch {
        toast.error("操作失败，请稍后重试");
      }
    });
  }
  function confirmDelete() {
    if (!deleting) return;
    const target = deleting;
    startTransition(async () => {
      try {
        const result = await deleteBook(target.id);
        if (result.error) setDeleteError(result.error);
        else {
          toast.success("单词书已删除");
          setDeleting(null);
        }
      } catch {
        setDeleteError("删除失败，请稍后重试");
      }
    });
  }
  return (
    <>
      <div className="mb-7 flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-semibold">单词书管理</h1>
            <span className="rounded-md border bg-muted/40 px-2 py-0.5 text-xs text-muted-foreground">
              {books.length}
            </span>
          </div>
          <p className="mt-2 text-xs text-muted-foreground">词汇书库</p>
        </div>
        <Button onClick={() => edit(null)} className="h-9 gap-2 px-4">
          <Plus className="size-4" />
          新建单词书
        </Button>
      </div>
      <StatBand
        items={[
          {
            label: "全部单词书",
            value: books.length,
            icon: BookCopy,
            color: "bg-emerald-50 text-emerald-700",
          },
          {
            label: "已发布",
            value: published,
            icon: CheckCircle2,
            color: "bg-blue-50 text-blue-600",
          },
          {
            label: "草稿",
            value: books.length - published,
            icon: FilePenLine,
            color: "bg-amber-50 text-amber-600",
          },
          {
            label: "收录单词",
            value: wordCount.toLocaleString("en-US"),
            icon: BookOpen,
            color: "bg-violet-50 text-violet-600",
          },
        ]}
      />
      <div
        className="mb-5 flex gap-6 border-b"
        role="group"
        aria-label="单词书状态"
      >
        {[
          { value: "all", label: "全部单词书", count: books.length },
          { value: "published", label: "已发布", count: published },
          { value: "draft", label: "草稿", count: books.length - published },
        ].map((item) => (
          <button
            key={item.value}
            aria-pressed={status === item.value}
            onClick={() => {
              setStatus(item.value);
              setPage(1);
            }}
            className={cn(
              "flex h-11 items-center gap-2 border-b-2 text-xs transition-colors",
              status === item.value
                ? "border-primary font-medium text-primary"
                : "border-transparent text-muted-foreground hover:text-foreground",
            )}
          >
            {item.label}
            <span
              className={cn(
                "rounded px-1.5 py-0.5 text-[10px] tabular-nums",
                status === item.value ? "bg-primary/8" : "bg-muted",
              )}
            >
              {item.count}
            </span>
          </button>
        ))}
      </div>
      <div className="mb-5 flex flex-wrap items-center gap-3">
        <div className="relative w-full sm:w-[280px]">
          <Search className="pointer-events-none absolute top-2.5 left-3 size-4 text-muted-foreground" />
          <Input
            aria-label="搜索单词书"
            placeholder="搜索标题、bookId 或标签…"
            value={search}
            onChange={(event) => {
              setSearch(event.target.value);
              setPage(1);
            }}
            className="h-9 bg-white pl-9 text-xs!"
          />
        </div>
        <FilterSelect
          label="筛选标签"
          className="w-[160px] max-w-full [&_[data-slot=select-value]]:block [&_[data-slot=select-value]]:truncate"
          value={tag}
          onChange={(value) => {
            setTag(value);
            setPage(1);
          }}
          options={[
            { value: "all", label: "全部标签" },
            ...tags.map((value) => ({ value: `tag:${value}`, label: value })),
          ]}
        />
        {hasFilters && (
          <IconButton label="清除筛选" onClick={reset}>
            <X />
          </IconButton>
        )}
        <div className="ml-auto">
          <FilterSelect
            label="排序方式"
            value={sort}
            onChange={(value) => {
              setSort(value);
              setPage(1);
            }}
            options={[
              { value: "updated", label: "最近更新" },
              { value: "title", label: "标题排序" },
              { value: "words", label: "单词数量" },
            ]}
          />
        </div>
      </div>
      {visible.length === 0 ? (
        <EmptyState noun="单词书" filtered={hasFilters} onReset={reset} />
      ) : (
        <div className="mb-6 grid grid-cols-1 gap-5 min-[560px]:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
          {visible.map((book, index) => (
            <article
              key={book.id}
              className="min-w-0 overflow-hidden rounded-lg border bg-white transition-shadow hover:shadow-sm"
              aria-label={book.title}
            >
              <button
                onClick={() => edit(book)}
                className="relative block h-[220px] w-full border-b bg-muted/35 p-4"
                aria-label={`编辑${book.title}封面`}
              >
                <span className="relative block h-full w-full">
                  <BookCover
                    src={book.coverUrl}
                    title={book.title}
                    loading={index < 3 ? "eager" : "lazy"}
                  />
                </span>
              </button>
              <div className="p-4">
                <div className="mb-2 flex items-start justify-between gap-2">
                  <h2 className="min-w-0 break-words text-sm leading-6 font-medium [overflow-wrap:anywhere]">
                    {book.title}
                  </h2>
                  <DropdownMenu>
                    <DropdownMenuTrigger
                      render={
                        <Button
                          variant="ghost"
                          size="icon"
                          className="size-7 shrink-0"
                          aria-label={`${book.title}的操作`}
                          disabled={pending}
                        />
                      }
                    >
                      <MoreHorizontal />
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem onClick={() => edit(book)}>
                        <Pencil />
                        编辑
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => toggle(book)}>
                        {book.status === "published" ? <Archive /> : <Upload />}
                        {book.status === "published" ? "转为草稿" : "发布"}
                      </DropdownMenuItem>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem
                        variant="destructive"
                        onClick={() => {
                          setDeleteError(undefined);
                          setDeleting(book);
                        }}
                      >
                        <Trash2 />
                        删除
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
                <div className="flex items-center gap-1.5 text-xs tabular-nums">
                  <BookOpen className="size-3.5 text-muted-foreground" />
                  {book.wordCount.toLocaleString("en-US")}
                  <span className="text-muted-foreground">词</span>
                </div>
                <p className="mt-2 break-all font-mono text-[11px] text-muted-foreground">
                  bookId: {book.bookId}
                </p>
                <div className="mt-3 flex min-h-6 flex-wrap gap-1.5">
                  {book.tags.map((item) => (
                    <span
                      key={item}
                      className="max-w-full break-words rounded border bg-muted/30 px-1.5 py-0.5 text-[10px] text-muted-foreground [overflow-wrap:anywhere]"
                    >
                      {item}
                    </span>
                  ))}
                </div>
                <div className="mt-3 flex items-center justify-between gap-2 border-t pt-3">
                  <StatusBadge
                    active={book.status === "published"}
                    activeLabel="已发布"
                    inactiveLabel="草稿"
                  />
                  <span className="text-[10px] text-muted-foreground">
                    {formatDate(book.updatedAt)}
                  </span>
                  <IconButton
                    label={`编辑${book.title}`}
                    className="size-7"
                    onClick={() => edit(book)}
                  >
                    <Pencil className="size-3.5" />
                  </IconButton>
                </div>
              </div>
            </article>
          ))}
        </div>
      )}
      <Pagination
        page={currentPage}
        total={filtered.length}
        pageSize={pageSize}
        onChange={setPage}
      />
      <BookDialog
        open={dialogOpen}
        book={editing}
        onClose={() => setDialogOpen(false)}
      />
      <AlertDialog
        open={!!deleting}
        onOpenChange={(open) => {
          if (!open && !pending) setDeleting(null);
        }}
      >
        <AlertDialogContent className="max-w-[calc(100%-2rem)] rounded-lg p-6 sm:max-w-[400px]">
          <AlertDialogHeader>
            <AlertDialogTitle>删除单词书？</AlertDialogTitle>
            <AlertDialogDescription className="break-all">
              确定删除「{deleting?.title}」吗？删除后无法恢复。
            </AlertDialogDescription>
          </AlertDialogHeader>
          <FormError error={deleteError} />
          <AlertDialogFooter className="m-0 rounded-none border-0 bg-transparent p-0 pt-2">
            <Button
              variant="outline"
              disabled={pending}
              onClick={() => setDeleting(null)}
            >
              取消
            </Button>
            <Button
              variant="destructive"
              disabled={pending}
              onClick={confirmDelete}
            >
              {pending && <LoaderCircle className="animate-spin" />}
              {pending ? "删除中…" : "确认删除"}
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

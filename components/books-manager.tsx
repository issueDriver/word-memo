"use client";

import { useState, useTransition } from "react";
import {
  BookCopy,
  BookOpen,
  CheckCircle2,
  FilePenLine,
  LayoutGrid,
  List,
  MoreHorizontal,
  Pencil,
  Plus,
  Search,
  Trash2,
  Upload,
  Archive,
  ArrowDownWideNarrow,
  X,
} from "lucide-react";
import { toast } from "sonner";
import { deleteBook, toggleBookStatus } from "@/app/actions";
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
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogAction,
} from "@/components/ui/alert-dialog";
import { categories, type Book } from "@/lib/types";
import { cn } from "@/lib/utils";

function BookCover({ book, small = false }: { book: Book; small?: boolean }) {
  return (
    <div
      aria-hidden="true"
      className={cn(
        "book-cover",
        `cover-${book.color}`,
        small ? "book-cover-small" : "book-cover-large",
      )}
    >
      <span className="book-cover-label">WORD MEMO</span>
      <span
        className="book-cover-title"
        style={{
          fontSize: small
            ? undefined
            : book.subtitle.length > 14
              ? 7
              : book.subtitle.length > 10
                ? 10
                : book.subtitle.length > 7
                  ? 13
                  : undefined,
        }}
      >
        {book.subtitle}
      </span>
      <BookOpen className="book-cover-icon" strokeWidth={1.2} />
      <span className="book-cover-footer">VOCABULARY</span>
    </div>
  );
}

export function BooksManager({ books }: { books: Book[] }) {
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("all");
  const [category, setCategory] = useState("all");
  const [sort, setSort] = useState("updated");
  const [view, setView] = useState<"list" | "grid">("list");
  const [page, setPage] = useState(1);
  const [editing, setEditing] = useState<Book | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [deleting, setDeleting] = useState<Book | null>(null);
  const [pending, startTransition] = useTransition();
  const published = books.filter((book) => book.status === "published").length;
  const wordCount = books.reduce((sum, book) => sum + book.wordCount, 0);
  const filtered = books
    .filter(
      (book) =>
        (status === "all" || book.status === status) &&
        (category === "all" || book.category === category) &&
        `${book.name} ${book.subtitle}`
          .toLowerCase()
          .includes(search.trim().toLowerCase()),
    )
    .sort((a, b) =>
      sort === "name"
        ? a.name.localeCompare(b.name, "zh-CN")
        : sort === "words"
          ? b.wordCount - a.wordCount
          : b.updatedAt.localeCompare(a.updatedAt),
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
  const hasFilters = !!search || category !== "all" || status !== "all";
  function reset() {
    setSearch("");
    setCategory("all");
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
  function actions(book: Book) {
    return (
      <DropdownMenu>
        <DropdownMenuTrigger
          render={
            <Button
              variant="ghost"
              size="icon"
              aria-label={`${book.name}的操作`}
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
            onClick={() => setDeleting(book)}
          >
            <Trash2 />
            删除
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    );
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
        role="tablist"
        aria-label="单词书状态"
      >
        {[
          { value: "all", label: "全部单词书", count: books.length },
          { value: "published", label: "已发布", count: published },
          { value: "draft", label: "草稿", count: books.length - published },
        ].map((tab) => (
          <button
            key={tab.value}
            role="tab"
            aria-selected={status === tab.value}
            onClick={() => {
              setStatus(tab.value);
              setPage(1);
            }}
            className={cn(
              "flex h-11 items-center gap-2 border-b-2 text-xs transition-colors",
              status === tab.value
                ? "border-primary font-medium text-primary"
                : "border-transparent text-muted-foreground hover:text-foreground",
            )}
            tabIndex={0}
          >
            {tab.label}
            <span
              className={cn(
                "rounded px-1.5 py-0.5 text-[10px] tabular-nums",
                status === tab.value ? "bg-primary/8" : "bg-muted",
              )}
            >
              {tab.count}
            </span>
          </button>
        ))}
      </div>
      <div className="mb-5 flex flex-wrap items-center gap-3">
        <div className="relative w-full sm:w-[260px]">
          <Search className="pointer-events-none absolute top-2.5 left-3 size-4 text-muted-foreground" />
          <Input
            aria-label="搜索单词书"
            placeholder="搜索名称或英文标题…"
            value={search}
            onChange={(event) => {
              setSearch(event.target.value);
              setPage(1);
            }}
            className="h-9 bg-white pl-9 text-xs!"
          />
        </div>
        <FilterSelect
          label="筛选分类"
          value={category}
          onChange={(value) => {
            setCategory(value);
            setPage(1);
          }}
          options={[
            { value: "all", label: "全部分类" },
            ...categories.map((value) => ({ value, label: value })),
          ]}
        />
        {hasFilters && (
          <IconButton label="清除筛选" onClick={reset}>
            <X />
          </IconButton>
        )}
        <div className="ml-auto flex items-center gap-3">
          <ArrowDownWideNarrow className="hidden size-4 text-muted-foreground xl:block" />
          <FilterSelect
            label="排序方式"
            value={sort}
            onChange={(value) => {
              setSort(value);
              setPage(1);
            }}
            options={[
              { value: "updated", label: "最近更新" },
              { value: "name", label: "名称排序" },
              { value: "words", label: "单词数量" },
            ]}
            className="min-w-[115px]"
          />
          <div
            className="flex gap-0.5 rounded-md border bg-muted/40 p-0.5"
            role="group"
            aria-label="显示方式"
          >
            <IconButton
              label="列表视图"
              className={cn(
                "size-7 rounded-sm",
                view === "list" && "bg-white shadow-xs",
              )}
              aria-pressed={view === "list"}
              onClick={() => setView("list")}
            >
              <List className="size-3.5" />
            </IconButton>
            <IconButton
              label="网格视图"
              className={cn(
                "size-7 rounded-sm",
                view === "grid" && "bg-white shadow-xs",
              )}
              aria-pressed={view === "grid"}
              onClick={() => setView("grid")}
            >
              <LayoutGrid className="size-3.5" />
            </IconButton>
          </div>
        </div>
      </div>
      {visible.length === 0 ? (
        <EmptyState noun="单词书" filtered={hasFilters} onReset={reset} />
      ) : view === "list" ? (
        <div className="mb-5">
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/40 hover:bg-muted/40">
                <TableHead className="h-10 w-[36%] pl-4 text-xs">
                  单词书
                </TableHead>
                <TableHead className="text-xs">分类</TableHead>
                <TableHead className="text-xs">单词数量</TableHead>
                <TableHead className="text-xs">状态</TableHead>
                <TableHead className="text-xs">更新时间</TableHead>
                <TableHead className="pr-4 text-right text-xs">操作</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {visible.map((book) => (
                <TableRow key={book.id} className="group">
                  <TableCell className="py-3.5 pl-4">
                    <div className="flex items-center gap-3.5">
                      <BookCover book={book} small />
                      <button
                        onClick={() => edit(book)}
                        aria-label={`编辑${book.name}`}
                        className="min-w-0 text-left"
                      >
                        <span className="block max-w-[260px] truncate text-xs font-medium group-hover:text-primary">
                          {book.name}
                        </span>
                        <span className="mt-1.5 block text-[10px] text-muted-foreground">
                          {book.subtitle}
                        </span>
                      </button>
                    </div>
                  </TableCell>
                  <TableCell>
                    <span className="rounded border px-2 py-1 text-[11px] text-muted-foreground">
                      {book.category}
                    </span>
                  </TableCell>
                  <TableCell className="text-xs tabular-nums">
                    {book.wordCount.toLocaleString("en-US")}
                    <span className="ml-1 text-[10px] text-muted-foreground">
                      词
                    </span>
                  </TableCell>
                  <TableCell>
                    <StatusBadge
                      active={book.status === "published"}
                      activeLabel="已发布"
                      inactiveLabel="草稿"
                    />
                  </TableCell>
                  <TableCell className="text-[11px] text-muted-foreground tabular-nums">
                    {formatDate(book.updatedAt)}
                  </TableCell>
                  <TableCell className="pr-3 text-right">
                    {actions(book)}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      ) : (
        <div className="mb-6 grid grid-cols-1 gap-4 min-[460px]:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
          {visible.map((book) => (
            <article
              key={book.id}
              className="overflow-hidden rounded-lg border transition-shadow hover:shadow-sm"
            >
              <button
                onClick={() => edit(book)}
                className={cn(
                  "flex h-[200px] w-full items-center justify-center",
                  `cover-stage-${book.color}`,
                )}
                aria-label={`编辑${book.name}`}
              >
                <BookCover book={book} />
              </button>
              <div className="px-4 pt-4 pb-3">
                <div className="mb-2 flex items-start justify-between gap-2">
                  <h2 className="min-w-0 pt-1 text-xs leading-5 font-medium">
                    {book.name}
                  </h2>
                  {actions(book)}
                </div>
                <div className="mb-4 flex gap-2 text-[11px] text-muted-foreground">
                  <span>{book.category}</span>
                  <span>·</span>
                  <span>{book.wordCount.toLocaleString("en-US")} 词</span>
                </div>
                <div className="flex items-center justify-between border-t pt-3">
                  <StatusBadge
                    active={book.status === "published"}
                    activeLabel="已发布"
                    inactiveLabel="草稿"
                  />
                  <span className="text-[10px] text-muted-foreground">
                    {formatDate(book.updatedAt)}
                  </span>
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
              确定删除「{deleting?.name}」吗？删除后无法恢复。
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="m-0 rounded-none border-0 bg-transparent p-0 pt-2">
            <AlertDialogCancel disabled={pending}>取消</AlertDialogCancel>
            <AlertDialogAction
              variant="destructive"
              disabled={pending}
              onClick={() => {
                if (!deleting) return;
                const target = deleting;
                startTransition(async () => {
                  try {
                    const result = await deleteBook(target.id);
                    if (result.error) toast.error(result.error);
                    else {
                      toast.success("单词书已删除");
                      setDeleting(null);
                    }
                  } catch {
                    toast.error("删除失败，请稍后重试");
                  }
                });
              }}
            >
              {pending ? "删除中…" : "确认删除"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

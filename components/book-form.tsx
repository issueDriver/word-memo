"use client";

import { useActionState, useState } from "react";
import { Check, LoaderCircle, Save } from "lucide-react";
import { toast } from "sonner";
import { saveBook } from "@/app/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { FormError } from "@/components/auth-form";
import { FilterSelect } from "@/components/management";
import {
  categories,
  coverColors,
  type ActionResult,
  type Book,
} from "@/lib/types";
import { cn } from "@/lib/utils";

const colorNames = {
  green: "绿色",
  blue: "蓝色",
  rose: "玫红",
  violet: "紫色",
  amber: "黄色",
  teal: "青色",
};

function BookForm({
  book,
  onClose,
}: {
  book: Book | null;
  onClose: () => void;
}) {
  const [category, setCategory] = useState<string>(
    book?.category ?? categories[0],
  );
  const [status, setStatus] = useState<string>(book?.status ?? "draft");
  const [color, setColor] = useState<Book["color"]>(book?.color ?? "green");
  const [name, setName] = useState(book?.name ?? "");
  const [subtitle, setSubtitle] = useState(book?.subtitle ?? "");
  const [wordCount, setWordCount] = useState(String(book?.wordCount ?? 0));
  const [state, action, pending] = useActionState(
    async (previous: ActionResult, data: FormData) => {
      try {
        const result = await saveBook(book?.id ?? null, previous, data);
        if (result.success) {
          toast.success(book ? "单词书已更新" : "单词书已创建");
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
          <Label htmlFor="book-name">单词书名称</Label>
          <Input
            id="book-name"
            name="name"
            value={name}
            onChange={(event) => setName(event.target.value)}
            placeholder="例如：大学英语四级核心词汇"
            maxLength={60}
            required
            className="h-10"
          />
        </div>
        <div className="grid gap-2">
          <Label htmlFor="book-subtitle">封面英文标题</Label>
          <Input
            id="book-subtitle"
            name="subtitle"
            value={subtitle}
            onChange={(event) => setSubtitle(event.target.value)}
            placeholder="例如：CET-4"
            maxLength={24}
            required
            className="h-10"
          />
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div className="grid gap-2">
            <Label htmlFor="book-category">分类</Label>
            <FilterSelect
              id="book-category"
              name="category"
              label="单词书分类"
              value={category}
              onChange={setCategory}
              options={categories.map((value) => ({ value, label: value }))}
              className="h-10! w-full min-w-0"
            />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="book-word-count">单词数量</Label>
            <Input
              id="book-word-count"
              name="wordCount"
              type="number"
              min={0}
              max={100000}
              step={1}
              value={wordCount}
              onChange={(event) => setWordCount(event.target.value)}
              required
              className="h-10"
            />
          </div>
        </div>
        <div className="grid gap-2">
          <Label htmlFor="book-status">发布状态</Label>
          <FilterSelect
            id="book-status"
            name="status"
            label="发布状态"
            value={status}
            onChange={setStatus}
            options={[
              { value: "draft", label: "草稿" },
              { value: "published", label: "已发布" },
            ]}
            className="h-10! w-full"
          />
        </div>
        <div className="grid gap-2">
          <span className="text-sm font-medium" id="color-label">
            封面颜色
          </span>
          <div
            className="flex gap-3"
            role="radiogroup"
            aria-labelledby="color-label"
          >
            {coverColors.map((value) => (
              <label
                key={value}
                className={cn(
                  "cover-swatch relative flex size-8 cursor-pointer items-center justify-center rounded-full outline-offset-3 has-focus-visible:outline-2 has-focus-visible:outline-primary",
                  `cover-${value}`,
                  color === value && "ring-2 ring-primary ring-offset-2",
                )}
              >
                <input
                  type="radio"
                  name="color"
                  value={value}
                  checked={color === value}
                  onChange={() => setColor(value)}
                  aria-label={colorNames[value]}
                  className="absolute inset-0 size-full cursor-pointer opacity-0"
                />
                {color === value && (
                  <Check className="pointer-events-none size-4" />
                )}
              </label>
            ))}
          </div>
        </div>
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
          {pending ? "保存中…" : "保存单词书"}
        </Button>
      </div>
    </form>
  );
}

export function BookDialog({
  open,
  book,
  onClose,
}: {
  open: boolean;
  book: Book | null;
  onClose: () => void;
}) {
  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!next) onClose();
      }}
    >
      <DialogContent className="max-h-[90dvh] overflow-y-auto rounded-lg p-6 sm:max-w-[460px]">
        <DialogHeader className="mb-2">
          <DialogTitle className="text-lg font-semibold">
            {book ? "编辑单词书" : "新建单词书"}
          </DialogTitle>
          <DialogDescription>
            {book ? book.name : "单词书信息"}
          </DialogDescription>
        </DialogHeader>
        {open && (
          <BookForm key={book?.id ?? "new"} book={book} onClose={onClose} />
        )}
      </DialogContent>
    </Dialog>
  );
}

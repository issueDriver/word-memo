"use client";

import { useActionState, useState } from "react";
import { LoaderCircle, Save } from "lucide-react";
import { toast } from "sonner";
import { saveBook } from "@/app/actions";
import { BookCover } from "@/components/book-cover";
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
import type { ActionResult, Book } from "@/lib/types";

function BookForm({
  book,
  onClose,
}: {
  book: Book | null;
  onClose: () => void;
}) {
  const [title, setTitle] = useState(book?.title ?? "");
  const [wordCount, setWordCount] = useState(String(book?.wordCount ?? 0));
  const [coverUrl, setCoverUrl] = useState(book?.coverUrl ?? "");
  const [previewUrl, setPreviewUrl] = useState(book?.coverUrl ?? "");
  const [bookId, setBookId] = useState(book?.bookId ?? "");
  const [tags, setTags] = useState(book?.tags.join(", ") ?? "");
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
          <Label htmlFor="book-title">标题</Label>
          <Input
            id="book-title"
            name="title"
            value={title}
            onChange={(event) => setTitle(event.target.value)}
            placeholder="例如：大学英语四级核心词汇"
            maxLength={120}
            required
            className="h-10"
          />
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div className="grid min-w-0 gap-2">
            <Label htmlFor="book-word-count">单词数量</Label>
            <Input
              id="book-word-count"
              name="wordCount"
              type="number"
              min={0}
              max={2147483647}
              step={1}
              value={wordCount}
              onChange={(event) => setWordCount(event.target.value)}
              required
              className="h-10"
            />
          </div>
          <div className="grid min-w-0 gap-2">
            <Label htmlFor="book-id">bookId</Label>
            <Input
              id="book-id"
              name="bookId"
              value={bookId}
              onChange={(event) => setBookId(event.target.value)}
              placeholder="例如：CET4_1"
              maxLength={120}
              required
              className="h-10"
              autoCapitalize="none"
              spellCheck={false}
            />
          </div>
        </div>
        <div className="grid gap-2">
          <Label htmlFor="book-cover-url">封面 URL</Label>
          <div className="flex items-start gap-3">
            <Input
              id="book-cover-url"
              name="coverUrl"
              type="url"
              value={coverUrl}
              onChange={(event) => setCoverUrl(event.target.value)}
              onBlur={() => setPreviewUrl(coverUrl.trim())}
              placeholder="https://example.com/cover.jpg"
              maxLength={2048}
              required
              className="h-10 min-w-0 flex-1"
              autoCapitalize="none"
              spellCheck={false}
            />
            <div className="relative h-[90px] w-[64px] shrink-0 overflow-hidden rounded border bg-muted/40">
              <BookCover
                src={previewUrl}
                title={title || "封面预览"}
                loading="eager"
              />
            </div>
          </div>
        </div>
        <div className="grid gap-2">
          <Label htmlFor="book-tags">标签（逗号分隔）</Label>
          <Input
            id="book-tags"
            name="tags"
            value={tags}
            onChange={(event) => setTags(event.target.value)}
            placeholder="大学英语, 四级, 核心词汇"
            maxLength={2000}
            className="h-10"
          />
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
      <DialogContent className="max-h-[90dvh] overflow-y-auto rounded-lg p-6 sm:max-w-[480px]">
        <DialogHeader className="mb-2">
          <DialogTitle className="text-lg font-semibold">
            {book ? "编辑单词书" : "新建单词书"}
          </DialogTitle>
          <DialogDescription className="break-words">
            {book ? book.title : "单词书信息"}
          </DialogDescription>
        </DialogHeader>
        {open && (
          <BookForm key={book?.id ?? "new"} book={book} onClose={onClose} />
        )}
      </DialogContent>
    </Dialog>
  );
}

import "server-only";

import { desc, eq, sql } from "drizzle-orm";
import { db } from "@/db";
import { books } from "@/db/schema";
import type { Book } from "@/lib/types";
import type { z } from "zod";
import type { bookSchema } from "@/lib/validation";

export class BookStoreError extends Error {}

export function bookDatabaseError(error: unknown): string | undefined {
  let current = error;
  while (current instanceof Error) {
    const code = (current as Error & { code?: string }).code;
    if (code === "23505") return "该 bookId 已存在，请使用其他标识";
    if (code === "23503" || code === "23001")
      return "该单词书已关联单词，无法删除";
    current = current.cause;
  }
  if (error instanceof BookStoreError) return error.message;
}

export async function listBooks(): Promise<Book[]> {
  const rows = await db
    .select({
      id: books.id,
      title: books.title,
      wordCount: books.wordCount,
      coverUrl: books.coverUrl,
      bookId: books.bookId,
      tags: books.tags,
      status: books.status,
      updatedAt: books.updatedAt,
    })
    .from(books)
    .orderBy(desc(books.updatedAt), books.id);
  return rows.map(({ updatedAt, ...book }) => ({
    ...book,
    updatedAt: updatedAt.toISOString(),
  }));
}

export async function saveBookRecord(
  id: string | null,
  data: z.infer<typeof bookSchema>,
) {
  if (!id) {
    await db.insert(books).values(data);
    return;
  }
  const updated = await db
    .update(books)
    .set({ ...data, updatedAt: new Date() })
    .where(eq(books.id, id))
    .returning({ id: books.id });
  if (!updated.length) throw new BookStoreError("单词书不存在，请刷新页面");
}

export async function toggleBookRecord(id: string) {
  const updated = await db
    .update(books)
    .set({
      status: sql`case when ${books.status} = 'published' then 'draft' else 'published' end`,
      updatedAt: new Date(),
    })
    .where(eq(books.id, id))
    .returning({ id: books.id });
  if (!updated.length) throw new BookStoreError("单词书不存在，请刷新页面");
}

export async function deleteBookRecord(id: string) {
  const deleted = await db
    .delete(books)
    .where(eq(books.id, id))
    .returning({ id: books.id });
  if (!deleted.length) throw new BookStoreError("单词书不存在，请刷新页面");
}

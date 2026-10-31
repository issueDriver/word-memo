import { and, eq, inArray, sql } from "drizzle-orm";
import { createHash } from "node:crypto";
import type { PostgresJsDatabase } from "drizzle-orm/postgres-js";
import { isDeepStrictEqual } from "node:util";
import * as schema from "../../db/schema";
import { checksumWords, type DictBook, type DictWord } from "./dict-data";

type Database = PostgresJsDatabase<typeof schema>;

export class ImportConflictError extends Error {}

const wordColumns = {
  bookId: schema.words.bookId,
  wordRank: schema.words.wordRank,
  headWord: schema.words.headWord,
  content: schema.words.content,
};

function contentHash(content: unknown) {
  return createHash("sha256").update(JSON.stringify(content)).digest("hex");
}

function bookFingerprint(rows: DictWord[]) {
  const hash = createHash("sha256");
  for (const row of [...rows].sort((a, b) => a.wordRank - b.wordRank)) {
    hash.update(
      `${row.wordRank}:${Buffer.from(row.headWord).toString("hex")}:${contentHash(row.content)}\n`,
    );
  }
  return hash.digest("hex");
}

// Compare compact hashes first so verification does not download every JSON payload.
async function existingWords(
  db: Pick<Database, "select">,
  book: DictBook,
  rows: DictWord[],
  lock = false,
) {
  const query = db
    .select({
      bookId: schema.words.bookId,
      wordRank: schema.words.wordRank,
      headWord: schema.words.headWord,
      contentHash: sql<string>`encode(sha256(convert_to(coalesce(${schema.words.content}::text, 'null'), 'UTF8')), 'hex')`,
    })
    .from(schema.words)
    .where(eq(schema.words.bookId, book.bookId));
  const stored = await (lock ? query.for("update") : query);
  const source = new Map(rows.map((row) => [row.wordRank, row]));
  const different = stored.filter((row) => {
    const expected = source.get(row.wordRank ?? -1);
    return (
      expected &&
      contentHash(expected.content) !== row.contentHash
    );
  });
  const fallback = new Map<number | null, unknown>();
  // Existing JSON may use different whitespace/key order while representing the same value.
  for (let offset = 0; offset < different.length; offset += 100) {
    const ranks = different
      .slice(offset, offset + 100)
      .map((row) => row.wordRank)
      .filter((rank): rank is number => rank !== null);
    const values = await db
      .select(wordColumns)
      .from(schema.words)
      .where(
        and(
          eq(schema.words.bookId, book.bookId),
          inArray(schema.words.wordRank, ranks),
        ),
      );
    for (const value of values) fallback.set(value.wordRank, value.content);
  }
  return stored.map((row) => {
    const expected = source.get(row.wordRank ?? -1);
    return {
      bookId: row.bookId,
      wordRank: row.wordRank,
      headWord: row.headWord,
      content: fallback.has(row.wordRank)
        ? fallback.get(row.wordRank)
        : expected?.content,
    };
  });
}

async function matchingBook(
  db: Pick<Database, "select">,
  book: DictBook,
  rows: DictWord[],
) {
  const [summary] = await db
    .select({
      storedCount: sql<number>`count(*)::int`,
      fingerprint: sql<string | null>`encode(sha256(convert_to(string_agg(
        ${schema.words.wordRank}::text || ':' ||
        encode(convert_to(coalesce(${schema.words.headWord}, ''), 'UTF8'), 'hex') || ':' ||
        encode(sha256(convert_to(coalesce(${schema.words.content}::text, 'null'), 'UTF8')), 'hex') || chr(10),
        '' order by ${schema.words.wordRank}
      ), 'UTF8')), 'hex')`,
    })
    .from(schema.words)
    .where(eq(schema.words.bookId, book.bookId));
  if (
    summary.storedCount === rows.length &&
    summary.fingerprint === bookFingerprint(rows)
  ) {
    return {
      checksum: checksumWords(rows),
      storedCount: summary.storedCount,
      sourceCount: rows.length,
    };
  }
}

export async function verifyBook(
  db: Pick<Database, "select">,
  book: DictBook,
  rows: DictWord[],
) {
  const match = await matchingBook(db, book, rows);
  if (match) return match;
  const stored = await existingWords(db, book, rows);
  const byRank = new Map(stored.map((row) => [row.wordRank, row]));
  const matched = rows.map((row) => {
    const found = byRank.get(row.wordRank);
    if (!isDeepStrictEqual(found, row))
      throw new ImportConflictError(
        `${book.bookId}: content mismatch at wordRank ${row.wordRank}`,
      );
    return found as DictWord;
  });
  return {
    checksum: checksumWords(matched),
    storedCount: stored.length,
    sourceCount: matched.length,
  };
}

export async function importBook(
  db: Database,
  book: DictBook,
  rows: DictWord[],
  batchSize = 500,
) {
  if (!Number.isInteger(batchSize) || batchSize < 1 || batchSize > 2000)
    throw new Error("Invalid batch size");
  if (rows.some((row) => row.bookId !== book.bookId))
    throw new ImportConflictError(`${book.bookId}: mismatched input bookId`);
  return db.transaction(async (tx) => {
    await tx
      .insert(schema.books)
      .values({
        bookId: book.bookId,
        title: book.title,
        coverUrl: book.coverUrl,
        tags: book.tags,
        wordCount: rows.length,
      })
      .onConflictDoNothing({ target: schema.books.bookId });
    // The parent row serializes repeat imports for this book without deleting data.
    await tx
      .select({ id: schema.books.id })
      .from(schema.books)
      .where(eq(schema.books.bookId, book.bookId))
      .for("update");
    const complete = await matchingBook(tx, book, rows);
    if (complete) {
      await tx
        .update(schema.books)
        .set({ wordCount: complete.storedCount, updatedAt: new Date() })
        .where(eq(schema.books.bookId, book.bookId));
      return { inserted: 0, skipped: rows.length, ...complete };
    }
    const existing = await existingWords(tx, book, rows, true);
    const byRank = new Map(existing.map((row) => [row.wordRank, row]));
    const missing = [];
    for (const row of rows) {
      const found = byRank.get(row.wordRank);
      if (!found) missing.push(row);
      else if (!isDeepStrictEqual(found, row))
        throw new ImportConflictError(
          `${book.bookId}: existing wordRank ${row.wordRank} has different content`,
        );
    }
    for (let offset = 0; offset < missing.length; offset += batchSize) {
      await tx
        .insert(schema.words)
        .values(missing.slice(offset, offset + batchSize));
    }
    const verification = await verifyBook(tx, book, rows);
    await tx
      .update(schema.books)
      .set({ wordCount: verification.storedCount, updatedAt: new Date() })
      .where(eq(schema.books.bookId, book.bookId));
    return {
      inserted: missing.length,
      skipped: rows.length - missing.length,
      ...verification,
    };
  });
}

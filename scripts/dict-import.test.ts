import assert from "node:assert/strict";
import { test } from "node:test";
import { PGlite } from "@electric-sql/pglite";
import { PGLiteSocketServer } from "@electric-sql/pglite-socket";
import { drizzle as pgliteDrizzle } from "drizzle-orm/pglite";
import { migrate } from "drizzle-orm/pglite/migrator";
import { drizzle } from "drizzle-orm/postgres-js";
import { eq, sql } from "drizzle-orm";
import postgres from "postgres";
import { strToU8, zipSync } from "fflate";
import * as schema from "../db/schema";
import {
  checksumWords,
  parseArchive,
  parseCatalog,
  type DictBook,
  type DictWord,
} from "./lib/dict-data";
import { ImportConflictError, importBook, verifyBook } from "./lib/dict-import";

const book: DictBook = {
  bookId: "TEST_1",
  title: "Test dictionary",
  coverUrl: "https://example.com/cover.jpg",
  tags: ["test"],
  declaredCount: 2,
  archive: "test.zip",
};
const rows: DictWord[] = [
  {
    bookId: "TEST_1",
    wordRank: 1,
    headWord: "café",
    content: { word: { sentence: ["例句", "a\\b"], audio: "word&type=1" } },
  },
  {
    bookId: "TEST_1",
    wordRank: 2,
    headWord: "cancel",
    content: { word: { translation: "取消", extra: [1, null, true] } },
  },
];

function archive(data: unknown[]) {
  return zipSync({
    "TEST_1.json": strToU8(
      "\uFEFF" +
        data.map((entry) => JSON.stringify(entry)).join("\r\n") +
        "\r\n\r\n",
    ),
  });
}

test("ZIP JSONL preserves Unicode and complete content, rejects corrupt records", () => {
  assert.deepEqual(parseArchive(archive(rows), "TEST_1").rows, rows);
  assert.throws(
    () => parseArchive(archive([rows[0], rows[0]]), "TEST_1"),
    /duplicate wordRank/,
  );
  assert.throws(
    () => parseArchive(archive([{ ...rows[0], bookId: "OTHER" }]), "TEST_1"),
    /mismatched bookId/,
  );
  assert.throws(
    () => parseArchive(archive([{ ...rows[0], wordRank: "1" }]), "TEST_1"),
    /invalid JSON/,
  );
  assert.throws(
    () =>
      parseArchive(
        archive([{ headWord: "missing", wordRank: 1, bookId: "TEST_1" }]),
        "TEST_1",
      ),
    /invalid JSON/,
  );
  assert.throws(() => parseArchive(strToU8("corrupt"), "TEST_1"));
  assert.equal(checksumWords(rows), checksumWords([...rows].reverse()));
  assert.notEqual(
    checksumWords(rows),
    checksumWords([{ ...rows[0], content: null }, rows[1]]),
  );
});

test("Structured catalog maps metadata and rejects duplicate books", () => {
  const entry = {
    id: "TEST_1",
    title: "Test",
    cover: book.coverUrl,
    wordNum: 2,
    offlinedata: "https://example.com/test.zip",
    tags: [{ tagName: "test" }],
  };
  assert.equal(
    parseCatalog({ code: 200, data: { normalBooksInfo: [entry] } })[0].archive,
    "test.zip",
  );
  assert.throws(
    () =>
      parseCatalog({ code: 200, data: { normalBooksInfo: [entry, entry] } }),
    /Duplicate catalog/,
  );
});

test("Imports are atomic and repeatable; conflicts preserve existing records", async () => {
  const engine = await PGlite.create();
  const server = new PGLiteSocketServer({
    db: engine,
    port: 0,
    maxConnections: 10,
  });
  let client: ReturnType<typeof postgres> | undefined;
  try {
    await migrate(pgliteDrizzle(engine), { migrationsFolder: "drizzle" });
    await server.start();
    client = postgres(
      `postgresql://postgres:postgres@${server.getServerConn()}/postgres`,
      { prepare: false, max: 2 },
    );
    const db = drizzle(client, { schema });
    const first = await importBook(db, book, rows, 1);
    assert.equal(first.inserted, 2);
    const before = await db.select({ id: schema.words.id }).from(schema.words);
    assert.equal((await importBook(db, book, rows)).skipped, 2);
    assert.deepEqual(
      await db.select({ id: schema.words.id }).from(schema.words),
      before,
    );
    assert.equal(
      (await verifyBook(db, book, rows)).checksum,
      checksumWords(rows),
    );
    await db
      .update(schema.words)
      .set({ content: sql`${JSON.stringify(rows[0].content, null, 2)}::json` })
      .where(eq(schema.words.wordRank, 1));
    assert.equal((await importBook(db, book, rows)).skipped, 2);
    await db
      .update(schema.books)
      .set({ title: "User title", status: "published" })
      .where(eq(schema.books.bookId, book.bookId));
    await importBook(db, book, rows);
    const [storedBook] = await db
      .select()
      .from(schema.books)
      .where(eq(schema.books.bookId, book.bookId));
    assert.equal(storedBook.title, "User title");
    assert.equal(storedBook.status, "published");

    await assert.rejects(
      importBook(db, book, [
        { ...rows[0], content: { changed: true } },
        rows[1],
      ]),
      ImportConflictError,
    );
    assert.equal(
      (await verifyBook(db, book, rows)).checksum,
      checksumWords(rows),
    );
    const secondBook = { ...book, bookId: "TEST_2" };
    await assert.rejects(
      importBook(
        db,
        secondBook,
        [
          { ...rows[0], bookId: "TEST_2" },
          { ...rows[1], bookId: "TEST_2", wordRank: 1 },
        ],
        1,
      ),
    );
    assert.equal(
      (
        await db
          .select()
          .from(schema.books)
          .where(eq(schema.books.bookId, "TEST_2"))
      ).length,
      0,
    );
    assert.equal(
      (
        await db
          .select()
          .from(schema.words)
          .where(eq(schema.words.bookId, "TEST_2"))
      ).length,
      0,
    );
    await importBook(
      db,
      secondBook,
      rows.map((row) => ({ ...row, bookId: "TEST_2" })),
    );
    assert.equal((await db.select().from(schema.words)).length, 4);
    assert.equal((await importBook(db, book, rows)).inserted, 0);
  } finally {
    await client?.end({ timeout: 1 });
    await server.stop();
    await engine.close();
  }
});

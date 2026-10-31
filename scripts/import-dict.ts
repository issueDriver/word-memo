import { loadEnvConfig } from "@next/env";
import { drizzle } from "drizzle-orm/postgres-js";
import { eq, sql } from "drizzle-orm";
import postgres from "postgres";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { parseArgs } from "node:util";
import * as schema from "../db/schema";
import {
  DictSourceError,
  inspectSource,
  readCatalog,
  readSourceBook,
  verifySnapshot,
} from "./lib/dict-data";
import { ImportConflictError, importBook, verifyBook } from "./lib/dict-import";

async function main() {
  const { values } = parseArgs({
    options: {
      source: { type: "string", default: ".data/dict-source" },
      "dry-run": { type: "boolean", default: false },
      verify: { type: "boolean", default: false },
      "batch-size": { type: "string", default: "500" },
      concurrency: { type: "string", default: "4" },
    },
  });
  const directory = path.resolve(values.source);
  const revision = await verifySnapshot(directory);
  const catalog = await readCatalog(directory);
  const manifest = await inspectSource(directory, catalog);
  await mkdir(".data/dict-import", { recursive: true });
  await writeFile(
    ".data/dict-import/manifest.json",
    JSON.stringify(manifest, null, 2) + "\n",
  );
  console.log(
    JSON.stringify({
      phase: "preflight",
      books: manifest.books,
      words: manifest.words,
      jsonBytes: manifest.jsonBytes,
      countDifferences: manifest.countDifferences,
    }),
  );
  if (values["dry-run"]) return;

  const batchSize = Number(values["batch-size"]);
  if (!Number.isInteger(batchSize) || batchSize < 1 || batchSize > 2000)
    throw new Error("batch-size must be between 1 and 2000");
  const concurrency = Number(values.concurrency);
  if (!Number.isInteger(concurrency) || concurrency < 1 || concurrency > 8)
    throw new Error("concurrency must be between 1 and 8");
  loadEnvConfig(process.cwd());
  if (!process.env.DATABASE_URL) throw new Error("DATABASE_URL is required");
  const client = postgres(process.env.DATABASE_URL, {
    prepare: false,
    max: concurrency,
    connect_timeout: 15,
    onnotice: () => {},
  });
  const db = drizzle(client, { schema });
  const results = [];
  try {
    async function processBook(index: number) {
      const book = catalog[index];
      const source = await readSourceBook(directory, book);
      if (source.checksum !== manifest.entries[index].checksum)
        throw new Error(`${book.bookId}: source changed after preflight`);
      let result;
      for (let attempt = 1; ; attempt++) {
        try {
          result = values.verify
            ? await verifyBook(db, book, source.rows)
            : await importBook(db, book, source.rows, batchSize);
          break;
        } catch (error) {
          const failure = error as { code?: string; cause?: { code?: string } };
          const code = failure.cause?.code ?? failure.code;
          if (
            attempt >= 5 ||
            !code ||
            ![
              "CONNECTION_CLOSED",
              "CONNECTION_ENDED",
              "CONNECT_TIMEOUT",
              "ECONNRESET",
              "ETIMEDOUT",
              "57P01",
              "40001",
              "40P01",
            ].includes(code)
          )
            throw error;
          console.log(
            JSON.stringify({ phase: "retry", bookId: book.bookId, attempt, code }),
          );
          await new Promise((resolve) => setTimeout(resolve, attempt * 1000));
        }
      }
      if (result.checksum !== source.checksum)
        throw new Error(`${book.bookId}: checksum verification failed`);
      const [storedBook] = await db
        .select({ wordCount: schema.books.wordCount })
        .from(schema.books)
        .where(eq(schema.books.bookId, book.bookId));
      if (!storedBook || storedBook.wordCount !== result.storedCount)
        throw new Error(`${book.bookId}: book word count mismatch`);
      return { bookId: book.bookId, ...result };
    }
    // Bounded groups keep each book atomic and progress-file writes sequential.
    for (let offset = 0; offset < catalog.length; offset += concurrency) {
      const group = await Promise.allSettled(
        catalog
          .slice(offset, offset + concurrency)
          .map((_, index) => processBook(offset + index)),
      );
      for (const entry of group) {
        if (entry.status !== "fulfilled") continue;
        results.push(entry.value);
        console.log(
          JSON.stringify({
            phase: values.verify ? "verify" : "import",
            progress: `${results.length}/${catalog.length}`,
            ...results.at(-1),
          }),
        );
      }
      await writeFile(
        ".data/dict-import/progress.json",
        JSON.stringify(results, null, 2) + "\n",
      );
      const failure = group.find((entry) => entry.status === "rejected");
      if (failure?.status === "rejected") throw failure.reason;
    }
    const [totals] = await db.execute<{
      books: number;
      words: number;
      orphanWords: number;
    }>(sql`
      select (select count(*)::int from books) as books, (select count(*)::int from words) as words,
        (select count(*)::int from words w left join books b on w."bookId" = b."bookId"
          where w."bookId" is not null and b.id is null) as "orphanWords"
    `);
    const report = {
      completedAt: new Date().toISOString(),
      source: "https://github.com/kajweb/dict",
      revision,
      sourceBooks: manifest.books,
      sourceWords: manifest.words,
      totals,
      results,
    };
    await writeFile(
      ".data/dict-import/report.json",
      JSON.stringify(report, null, 2) + "\n",
    );
    console.log(
      JSON.stringify({
        phase: "complete",
        sourceBooks: manifest.books,
        sourceWords: manifest.words,
        totals,
      }),
    );
  } finally {
    await client.end({ timeout: 5 });
  }
}

main().catch((error: unknown) => {
  if (error instanceof ImportConflictError || error instanceof DictSourceError)
    console.error(error.message);
  else if (error instanceof Error) {
    const cause = error.cause as { code?: string } | undefined;
    console.error(
      JSON.stringify({
        error: "Dictionary import failed",
        code: cause?.code ?? (error as NodeJS.ErrnoException).code,
        reason: error.name,
      }),
    );
  } else console.error("Dictionary import failed");
  process.exitCode = 1;
});

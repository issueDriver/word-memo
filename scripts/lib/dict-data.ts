import { createHash } from "node:crypto";
import { readFile, readdir } from "node:fs/promises";
import path from "node:path";
import { unzipSync } from "fflate";
import { z } from "zod";

export class DictSourceError extends Error {}

export async function verifySnapshot(directory: string) {
  const metadata = z
    .object({
      repository: z.literal("https://github.com/kajweb/dict"),
      revision: z.string().regex(/^[a-f0-9]{40}$/),
      files: z
        .array(
          z.object({
            path: z.string().regex(/^(bookLists\.txt|book\/[^/]+\.zip)$/),
            sha: z.string().regex(/^[a-f0-9]{40}$/),
            size: z.number().int().nonnegative(),
          }),
        )
        .min(2),
    })
    .parse(
      JSON.parse(await readFile(path.join(directory, "source.json"), "utf8")),
    );
  const verified = new Set<string>();
  for (const file of metadata.files) {
    if (verified.has(file.path))
      throw new DictSourceError(`Repeated source file: ${file.path}`);
    const bytes = await readFile(path.join(directory, file.path));
    const actual = createHash("sha1")
      .update(`blob ${bytes.length}\0`)
      .update(bytes)
      .digest("hex");
    if (actual !== file.sha || bytes.length !== file.size)
      throw new DictSourceError(`Source checksum mismatch: ${file.path}`);
    verified.add(file.path);
  }
  const actualFiles = (await readdir(path.join(directory, "book"))).filter(
    (name) => name.endsWith(".zip"),
  );
  if (
    !verified.has("bookLists.txt") ||
    verified.size !== actualFiles.length + 1 ||
    actualFiles.some((name) => !verified.has(`book/${name}`))
  ) {
    throw new DictSourceError("The downloaded source manifest is incomplete");
  }
  return metadata.revision;
}

const catalogSchema = z.object({
  code: z.literal(200),
  data: z.object({
    normalBooksInfo: z
      .array(
        z.object({
          id: z.string().min(1),
          title: z.string().min(1),
          cover: z.url({ protocol: /^https?$/ }),
          wordNum: z.number().int().nonnegative(),
          offlinedata: z.url(),
          tags: z.array(z.object({ tagName: z.string() })),
        }),
      )
      .min(1),
  }),
});

const wordSchema = z.strictObject({
  wordRank: z.number().int().min(0).max(2147483647),
  headWord: z.string().min(1),
  content: z.unknown(),
  bookId: z.string().min(1),
});

export type DictWord = z.infer<typeof wordSchema>;
export type DictBook = {
  bookId: string;
  title: string;
  coverUrl: string;
  tags: string[];
  declaredCount: number;
  archive: string;
};

export function parseCatalog(value: unknown): DictBook[] {
  const entries = catalogSchema.parse(value).data.normalBooksInfo;
  const identifiers = new Set<string>();
  return entries.map((entry) => {
    if (identifiers.has(entry.id))
      throw new DictSourceError(`Duplicate catalog bookId: ${entry.id}`);
    identifiers.add(entry.id);
    return {
      bookId: entry.id,
      title: entry.title,
      coverUrl: entry.cover,
      tags: [
        ...new Set(entry.tags.map((tag) => tag.tagName.trim()).filter(Boolean)),
      ],
      declaredCount: entry.wordNum,
      archive: path.basename(new URL(entry.offlinedata).pathname),
    };
  });
}

export function checksumWords(rows: DictWord[]) {
  const hash = createHash("sha256");
  for (const row of [...rows].sort((a, b) => a.wordRank - b.wordRank)) {
    hash.update(
      JSON.stringify(row, (_key, value: unknown) => {
        if (
          value !== null &&
          typeof value === "object" &&
          !Array.isArray(value)
        ) {
          const object = value as Record<string, unknown>;
          return Object.fromEntries(
            Object.keys(object)
              .sort()
              .map((key) => [key, object[key]]),
          );
        }
        return value;
      }) + "\n",
    );
  }
  return hash.digest("hex");
}

export function parseArchive(bytes: Uint8Array, bookId: string) {
  const files = Object.entries(unzipSync(bytes)).filter(([name]) =>
    name.endsWith(".json"),
  );
  if (files.length !== 1 || path.basename(files[0][0]) !== `${bookId}.json`) {
    throw new DictSourceError(
      `${bookId}: expected exactly one matching JSON file`,
    );
  }
  const data = files[0][1];
  const lines = new TextDecoder("utf-8", { fatal: true })
    .decode(data)
    .replace(/^\uFEFF/, "")
    .split(/\r?\n/);
  const ranks = new Set<number>();
  const rows: DictWord[] = [];
  for (const [index, line] of lines.entries()) {
    if (!line.trim()) continue;
    let row: DictWord;
    try {
      row = wordSchema.parse(JSON.parse(line));
      if (!Object.hasOwn(row, "content")) throw new Error("Missing content");
    } catch {
      throw new DictSourceError(
        `${bookId}: invalid JSON record on line ${index + 1}`,
      );
    }
    if (row.bookId !== bookId)
      throw new DictSourceError(
        `${bookId}: mismatched bookId on line ${index + 1}`,
      );
    if (ranks.has(row.wordRank))
      throw new DictSourceError(
        `${bookId}: duplicate wordRank ${row.wordRank}`,
      );
    ranks.add(row.wordRank);
    rows.push(row);
  }
  if (!rows.length) throw new DictSourceError(`${bookId}: empty dictionary`);
  return { rows, jsonBytes: data.length, checksum: checksumWords(rows) };
}

export async function readCatalog(directory: string) {
  const catalog = parseCatalog(
    JSON.parse(await readFile(path.join(directory, "bookLists.txt"), "utf8")),
  );
  const archives = (await readdir(path.join(directory, "book")))
    .filter((name) => name.endsWith(".zip"))
    .sort();
  const expected = catalog.map((book) => book.archive).sort();
  if (
    new Set(expected).size !== expected.length ||
    JSON.stringify(archives) !== JSON.stringify(expected)
  ) {
    throw new DictSourceError(
      "The source archives do not match the complete catalog",
    );
  }
  return catalog;
}

export async function readSourceBook(directory: string, book: DictBook) {
  return parseArchive(
    await readFile(path.join(directory, "book", book.archive)),
    book.bookId,
  );
}

export async function inspectSource(directory: string, catalog: DictBook[]) {
  const entries = [];
  for (const book of catalog) {
    const data = await readSourceBook(directory, book);
    entries.push({
      bookId: book.bookId,
      title: book.title,
      archive: book.archive,
      declaredCount: book.declaredCount,
      count: data.rows.length,
      jsonBytes: data.jsonBytes,
      checksum: data.checksum,
    });
  }
  return {
    books: entries.length,
    words: entries.reduce((total, entry) => total + entry.count, 0),
    jsonBytes: entries.reduce((total, entry) => total + entry.jsonBytes, 0),
    countDifferences: entries.filter(
      (entry) => entry.count !== entry.declaredCount,
    ),
    entries,
  };
}

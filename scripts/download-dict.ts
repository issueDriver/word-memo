import { createHash } from "node:crypto";
import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import path from "node:path";
import { parseArgs } from "node:util";
import { z } from "zod";

const revision = "3992bcb94c800a2fd38a9fd6ff95b2353e755363";
const treeSchema = z.object({
  truncated: z.literal(false),
  tree: z.array(
    z.object({
      path: z.string(),
      type: z.string(),
      sha: z.string(),
      size: z.number().optional(),
    }),
  ),
});

function blobHash(bytes: Uint8Array) {
  return createHash("sha1")
    .update(`blob ${bytes.length}\0`)
    .update(bytes)
    .digest("hex");
}

async function main() {
  const { values } = parseArgs({
    options: { source: { type: "string", default: ".data/dict-source" } },
  });
  const directory = path.resolve(values.source);
  const response = await fetch(
    `https://api.github.com/repos/kajweb/dict/git/trees/${revision}?recursive=1`,
    { signal: AbortSignal.timeout(30_000) },
  );
  if (!response.ok) throw new Error(`GitHub tree HTTP ${response.status}`);
  const tree = treeSchema.parse(await response.json());
  const files = tree.tree.filter(
    (entry) =>
      entry.type === "blob" &&
      (entry.path === "bookLists.txt" || /^book\/[^/]+\.zip$/.test(entry.path)),
  );
  if (!files.some((file) => file.path === "bookLists.txt") || files.length < 2)
    throw new Error("Missing source catalog or archives");
  await mkdir(path.join(directory, "book"), { recursive: true });
  let cursor = 0;
  let completed = 0;
  await Promise.all(
    Array.from({ length: 4 }, async () => {
      while (cursor < files.length) {
        const file = files[cursor++];
        const destination = path.join(directory, file.path);
        try {
          if (blobHash(await readFile(destination)) === file.sha) {
            console.log(
              `[download ${++completed}/${files.length}] cached ${file.path}`,
            );
            continue;
          }
        } catch (error) {
          if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
        }
        let downloaded = false;
        for (let attempt = 1; attempt <= 3; attempt++) {
          try {
            const result = await fetch(
              `https://cdn.jsdelivr.net/gh/kajweb/dict@${revision}/${file.path}`,
              { signal: AbortSignal.timeout(120_000) },
            );
            if (!result.ok) throw new Error(`HTTP ${result.status}`);
            const bytes = new Uint8Array(await result.arrayBuffer());
            if (blobHash(bytes) !== file.sha || bytes.length !== file.size)
              throw new Error("Source file checksum mismatch");
            const temporary = `${destination}.${process.pid}.tmp`;
            await writeFile(temporary, bytes);
            await rename(temporary, destination);
            console.log(
              `[download ${++completed}/${files.length}] ${file.path}`,
            );
            downloaded = true;
            break;
          } catch {
            console.warn(`[download] retry ${attempt}/3: ${file.path}`);
          }
        }
        if (!downloaded) {
          const fallback = await fetch(
            `https://api.github.com/repos/kajweb/dict/git/blobs/${file.sha}`,
            { signal: AbortSignal.timeout(60_000) },
          );
          if (fallback.ok) {
            const blob = z
              .object({ content: z.string(), encoding: z.literal("base64") })
              .parse(await fallback.json());
            const bytes = Buffer.from(blob.content, "base64");
            if (blobHash(bytes) !== file.sha || bytes.length !== file.size)
              throw new Error(`GitHub blob checksum mismatch: ${file.path}`);
            const temporary = `${destination}.${process.pid}.tmp`;
            await writeFile(temporary, bytes);
            await rename(temporary, destination);
            console.log(
              `[download ${++completed}/${files.length}] GitHub API ${file.path}`,
            );
            downloaded = true;
          }
        }
        if (!downloaded)
          throw new Error(`Unable to download verified archive: ${file.path}`);
      }
    }),
  );
  await writeFile(
    path.join(directory, "source.json"),
    JSON.stringify(
      { repository: "https://github.com/kajweb/dict", revision, files },
      null,
      2,
    ) + "\n",
  );
  console.log(
    JSON.stringify({ downloaded: files.length, revision, directory }),
  );
}

main().catch((error: unknown) => {
  console.error(
    error instanceof Error ? error.message : "Dictionary download failed",
  );
  process.exitCode = 1;
});

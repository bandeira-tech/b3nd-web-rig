/**
 * build-learn-books.ts
 *
 * Fetches the learn catalog and chapter content from a B3nd node and writes
 * them to the local `public/learn/` folder (gitignored). The webrig consumes
 * those static files at runtime.
 *
 * Source-of-truth markdown lives in the SDK repo, which uploads it to B3nd.
 * The webrig only reads via B3nd data — never via the filesystem.
 *
 * Usage:
 *   deno run -A scripts/build-learn-books.ts
 *
 * Environment variables:
 *   B3ND_NODE_URL          — B3nd HTTP API base (default: http://localhost:9942)
 *   LEARN_OUTPUT_DIR       — Static output directory (default: public/learn)
 *   LEARN_CATALOG_URI      — Catalog URI on the node (default: mutable://open/rig/learn/catalog)
 */

interface ChapterMeta {
  key: string;
  number: number;
  title: string;
  part: string;
  sections: unknown[];
  uri: string;
}

interface LearnBook {
  key: string;
  title: string;
  label: string;
  description: string;
  tier: string;
  chapters: ChapterMeta[];
  updatedAt: number;
}

interface LearnCatalog {
  books: LearnBook[];
  generatedAt: number;
}

async function ensureDir(dir: string): Promise<void> {
  try {
    await Deno.mkdir(dir, { recursive: true });
  } catch { /* exists */ }
}

async function readUri(nodeUrl: string, uri: string): Promise<unknown> {
  const res = await fetch(
    `${nodeUrl}/api/v1/read?uri=${encodeURIComponent(uri)}`,
  );
  if (!res.ok) {
    throw new Error(`Read ${uri} failed: ${res.status} ${res.statusText}`);
  }
  return await res.json();
}

async function main() {
  console.log("=== B3nd Learn Book Fetcher ===\n");

  const nodeUrl = Deno.env.get("B3ND_NODE_URL") ?? "http://localhost:9942";
  const outDir = Deno.env.get("LEARN_OUTPUT_DIR") ?? "public/learn";
  const catalogUri = Deno.env.get("LEARN_CATALOG_URI") ??
    "mutable://open/rig/learn/catalog";

  console.log(`Node:    ${nodeUrl}`);
  console.log(`Catalog: ${catalogUri}`);
  console.log(`Output:  ${outDir}`);
  console.log("");

  const catalog = await readUri(nodeUrl, catalogUri) as LearnCatalog;
  console.log(
    `Catalog has ${catalog.books.length} books, ${
      catalog.books.reduce((n, b) => n + b.chapters.length, 0)
    } chapters total.`,
  );

  await ensureDir(outDir);
  await Deno.writeTextFile(
    `${outDir}/catalog.json`,
    JSON.stringify(catalog, null, 2),
  );
  console.log(`Wrote ${outDir}/catalog.json`);

  const chaptersDir = `${outDir}/chapters`;
  await ensureDir(chaptersDir);

  let written = 0;
  let failed = 0;
  for (const book of catalog.books) {
    for (const chapter of book.chapters) {
      try {
        const content = await readUri(nodeUrl, chapter.uri);
        await Deno.writeTextFile(
          `${chaptersDir}/${chapter.key}.json`,
          JSON.stringify(content, null, 2),
        );
        written++;
      } catch (e) {
        console.warn(`  Failed ${chapter.key}: ${e}`);
        failed++;
      }
    }
  }
  console.log(`\nWrote ${written} chapter files to ${chaptersDir}/`);
  if (failed > 0) console.warn(`  ${failed} chapters failed.`);

  console.log("\nDone.");
}

main();

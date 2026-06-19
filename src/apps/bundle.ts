import type { AppDescriptor } from "./types";
import { createRigSlot, type SlotBackend } from "./runtime";
import { defaultAppCatalog } from "./registry";

/**
 * Portable catalog bundle. Designed to be pasted into a chat / dropped
 * onto another rig — opaque, JSON-serialisable, self-describing.
 *
 * Version 1 inlines HTML bodies for `display.kind = "html"` descriptors
 * whose `uri` lives under the source catalog basepath. Other URIs are
 * kept verbatim so cross-backend references still work.
 */
export interface CatalogBundle {
  version: 1;
  exportedFrom: string;
  exportedAt: number;
  apps: Array<{
    descriptor: AppDescriptor;
    /** Present when the descriptor's HTML payload was inlined. */
    html?: string;
  }>;
}

const defaultSlugs = new Set(defaultAppCatalog.map((d) => d.slug));

function bytesToString(value: unknown): string | undefined {
  if (typeof value === "string") return value;
  if (value instanceof Uint8Array) {
    try {
      return new TextDecoder("utf-8", { fatal: false }).decode(value);
    } catch {
      return undefined;
    }
  }
  return undefined;
}

function isDescriptor(value: unknown): value is AppDescriptor {
  if (!value || typeof value !== "object") return false;
  const v = value as Record<string, unknown>;
  if (typeof v.slug !== "string" || !v.slug) return false;
  if (typeof v.name !== "string" || !v.name) return false;
  if (typeof v.defaultBasePath !== "string") return false;
  if (!v.display || typeof v.display !== "object") return false;
  const d = v.display as Record<string, unknown>;
  return d.kind === "builtin" || d.kind === "html";
}

/**
 * Build a {@link CatalogBundle} from records stored under `basePath`.
 * Built-in slugs are skipped — they ship with every rig.
 *
 * `includeDefaults` flips that for cases where the user wants a full
 * snapshot of what they see (e.g. seeding a fresh rig).
 */
export async function exportCatalog(
  backend: SlotBackend,
  basePath: string,
  options: { includeDefaults?: boolean } = {},
): Promise<CatalogBundle> {
  const slot = createRigSlot(backend, basePath);
  const items = await slot.list();
  const apps: CatalogBundle["apps"] = [];

  for (const item of items) {
    const [{ data }] = await slot.read(item.key);
    if (!isDescriptor(data)) continue;
    if (!options.includeDefaults && defaultSlugs.has(data.slug)) continue;

    const entry: CatalogBundle["apps"][number] = { descriptor: data };
    if (data.display.kind === "html") {
      // Only inline HTML that's actually accessible to us. URIs outside
      // this rig's reach are kept as references.
      try {
        const results = await backend.read<unknown>([data.display.uri]);
        const payload = results[0]?.[1];
        const text = bytesToString(payload);
        if (text) entry.html = text;
      } catch {
        // Reference-only — recipient must reach the URI on their end.
      }
    }
    apps.push(entry);
  }

  return {
    version: 1,
    exportedFrom: basePath,
    exportedAt: Date.now(),
    apps,
  };
}

/** Loose validation — catches a hand-written JSON that's clearly wrong. */
export function isBundle(value: unknown): value is CatalogBundle {
  if (!value || typeof value !== "object") return false;
  const v = value as Record<string, unknown>;
  if (v.version !== 1) return false;
  if (!Array.isArray(v.apps)) return false;
  return true;
}

export interface ImportResult {
  imported: string[];
  skipped: Array<{ slug?: string; reason: string }>;
}

/**
 * Write every app in the bundle into the rig under `basePath`. HTML
 * bodies are restored to the descriptor's original `display.uri` when
 * present. Slugs already in the bundle override existing records.
 */
export async function importCatalog(
  backend: SlotBackend,
  basePath: string,
  bundle: CatalogBundle,
): Promise<ImportResult> {
  const result: ImportResult = { imported: [], skipped: [] };
  const catalogSlot = createRigSlot(backend, basePath);

  for (const entry of bundle.apps) {
    if (!isDescriptor(entry.descriptor)) {
      result.skipped.push({ reason: "invalid descriptor" });
      continue;
    }
    if (entry.descriptor.display.kind === "html" && entry.html) {
      // Write the HTML body back at its declared URI. We resolve relative
      // to its scheme so receiving rigs can host the bytes on whatever
      // store backs that scheme.
      const url = new URL(entry.descriptor.display.uri);
      const containerBase = `${url.protocol}//${url.host}`;
      const key = url.pathname.replace(/^\/+/, "");
      const slot = createRigSlot(backend, containerBase);
      await slot.write(key, entry.html);
    }
    await catalogSlot.write(`${entry.descriptor.slug}.json`, entry.descriptor);
    result.imported.push(entry.descriptor.slug);
  }

  return result;
}

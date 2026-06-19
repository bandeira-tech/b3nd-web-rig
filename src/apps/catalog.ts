import type { AppDescriptor } from "./types";
import { defaultAppCatalog } from "./registry";
import { createRigSlot, type SlotBackend } from "./runtime";

const STORAGE_KEY = "b3nd-rig.apps-catalog-basepath";
const DEFAULT_CATALOG_BASE_PATH = "memory://apps-catalog";

export function getCatalogBasePath(): string {
  if (typeof window === "undefined") return DEFAULT_CATALOG_BASE_PATH;
  try {
    return window.localStorage.getItem(STORAGE_KEY) ?? DEFAULT_CATALOG_BASE_PATH;
  } catch {
    return DEFAULT_CATALOG_BASE_PATH;
  }
}

export function setCatalogBasePath(basePath: string): void {
  if (typeof window === "undefined") return;
  try {
    if (basePath === DEFAULT_CATALOG_BASE_PATH) {
      window.localStorage.removeItem(STORAGE_KEY);
    } else {
      window.localStorage.setItem(STORAGE_KEY, basePath);
    }
  } catch {
    // best effort
  }
}

export function getDefaultCatalogBasePath(): string {
  return DEFAULT_CATALOG_BASE_PATH;
}

function isDescriptor(value: unknown): value is AppDescriptor {
  if (!value || typeof value !== "object") return false;
  const v = value as Record<string, unknown>;
  if (typeof v.slug !== "string" || !v.slug) return false;
  if (typeof v.name !== "string" || !v.name) return false;
  if (typeof v.defaultBasePath !== "string") return false;
  if (!v.display || typeof v.display !== "object") return false;
  const d = v.display as Record<string, unknown>;
  if (d.kind !== "builtin" && d.kind !== "html") return false;
  return true;
}

/**
 * Load the live catalog: built-in defaults plus any user-published
 * descriptors stored under the catalog basepath. User entries with the
 * same slug as a default override the default — so a user can ship a
 * customized "notes" pointing at a different default basepath without
 * losing the icon/description.
 */
export async function loadCatalog(
  backend: SlotBackend,
  basePath: string = getCatalogBasePath(),
): Promise<AppDescriptor[]> {
  const merged = new Map<string, AppDescriptor>();
  for (const d of defaultAppCatalog) merged.set(d.slug, d);

  try {
    const slot = createRigSlot(backend, basePath);
    const items = await slot.list();
    if (items.length > 0) {
      const records = await slot.read(items.map((it) => it.key));
      for (const r of records) {
        if (isDescriptor(r.data)) merged.set(r.data.slug, r.data);
      }
    }
  } catch {
    // A missing/unreachable catalog is non-fatal — defaults still ship.
  }

  return [...merged.values()];
}

/** Publish a single AppDescriptor under the catalog basepath. */
export async function publishDescriptor(
  backend: SlotBackend,
  descriptor: AppDescriptor,
  basePath: string = getCatalogBasePath(),
): Promise<void> {
  const slot = createRigSlot(backend, basePath);
  await slot.write(`${descriptor.slug}.json`, descriptor);
}

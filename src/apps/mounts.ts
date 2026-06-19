/**
 * Per-app basepath persistence.
 *
 * Where an app gets mounted is a user choice — and the rig should
 * remember it across reloads. Today the choice is stored in
 * localStorage; a later iter can publish mount records as B3nd data
 * (so the user's mounts travel with their identity, not their browser).
 *
 * The on-disk shape is intentionally tiny and stable:
 *   { [slug]: { basePath: string, updatedAt: number } }
 */

const STORAGE_KEY = "b3nd-rig.app-mounts";

interface MountEntry {
  basePath: string;
  updatedAt: number;
}

type MountMap = Record<string, MountEntry>;

function readAll(): MountMap {
  if (typeof window === "undefined") return {};
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    if (parsed && typeof parsed === "object") return parsed as MountMap;
    return {};
  } catch {
    return {};
  }
}

function writeAll(map: MountMap): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(map));
  } catch {
    // Persistence is best-effort. A quota error means the user falls
    // back to descriptor defaults — annoying but not broken.
  }
}

export function getMountBasePath(slug: string): string | undefined {
  const entry = readAll()[slug];
  return entry?.basePath;
}

export function setMountBasePath(slug: string, basePath: string): void {
  const map = readAll();
  map[slug] = { basePath, updatedAt: Date.now() };
  writeAll(map);
}

export function clearMountBasePath(slug: string): void {
  const map = readAll();
  if (!(slug in map)) return;
  delete map[slug];
  writeAll(map);
}

export function listMounts(): Array<{ slug: string } & MountEntry> {
  const map = readAll();
  return Object.entries(map).map(([slug, entry]) => ({ slug, ...entry }));
}

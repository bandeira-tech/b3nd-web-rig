import type { RigSlot } from "./types";

/**
 * The narrowest contract the slot needs from the rig. Mirrors the editor's
 * BackendClient shape so the slot can be unit-tested without spinning a
 * real Rig. Anything implementing `receive`/`read` works.
 */
export interface SlotBackend {
  receive(
    msgs: Array<[string, Uint8Array]>,
  ): PromiseLike<Array<unknown>>;
  read<T = unknown>(locators: string[]): Promise<Array<[string, T | null]>>;
}

/**
 * Normalise a basepath into `proto://host[/path]` shape, no trailing slash.
 * Throws on inputs that can't be parsed as a URI — apps must declare an
 * explicit URI prefix.
 */
export function normalizeBasePath(basePath: string): string {
  const url = new URL(basePath);
  const path = url.pathname.replace(/\/+$/, "");
  return `${url.protocol}//${url.host}${path}`;
}

function joinKey(basePath: string, key: string): string {
  const trimmed = key.replace(/^\/+/, "").replace(/\/+$/, "");
  if (!trimmed) return basePath;
  return `${basePath}/${trimmed}`;
}

function stripPrefix(uri: string, basePath: string): string {
  if (uri.startsWith(`${basePath}/`)) return uri.slice(basePath.length + 1);
  if (uri === basePath) return "";
  return uri;
}

function encodePayload(value: unknown): Uint8Array {
  if (value instanceof Uint8Array) return value;
  if (typeof value === "string") return new TextEncoder().encode(value);
  return new TextEncoder().encode(JSON.stringify(value));
}

function decodePayload(raw: unknown): unknown {
  if (!(raw instanceof Uint8Array)) return raw;
  try {
    const text = new TextDecoder("utf-8", { fatal: true }).decode(raw);
    try {
      return JSON.parse(text);
    } catch {
      return text;
    }
  } catch {
    return raw;
  }
}

/**
 * Construct a {@link RigSlot} bound to a basepath. The slot is the only
 * surface an app gets — it scopes URIs into a single prefix and can't
 * read or write outside.
 */
export function createRigSlot(
  backend: SlotBackend,
  basePath: string,
): RigSlot {
  const normalized = normalizeBasePath(basePath);

  return {
    basePath: normalized,
    resolve(relative: string) {
      return joinKey(normalized, relative);
    },
    async read(relative: string | string[]) {
      const keys = Array.isArray(relative) ? relative : [relative];
      const uris = keys.map((k) => joinKey(normalized, k));
      const results = await backend.read<unknown>(uris);
      return results.map(([uri, payload], idx) => ({
        key: keys[idx] ?? stripPrefix(uri, normalized),
        uri,
        data: decodePayload(payload),
      }));
    },
    async list(relative = "") {
      // Convention: trailing slash on the URI asks the store for a listing
      // rather than a single record.
      const prefix = joinKey(normalized, relative);
      const listUri = prefix.endsWith("/") ? prefix : `${prefix}/`;
      const results = await backend.read<unknown>([listUri]);
      const tuple = results[0];
      if (!tuple) return [];
      const payload = tuple[1];
      const items: Array<{ key: string; uri: string }> = [];
      const seen = new Set<string>();
      const visit = (entry: unknown) => {
        let uri: string | undefined;
        if (Array.isArray(entry) && typeof entry[0] === "string") {
          uri = entry[0];
        } else if (typeof entry === "string") {
          uri = entry;
        } else if (entry && typeof entry === "object" && "uri" in entry) {
          uri = (entry as { uri?: string }).uri;
        }
        if (!uri) return;
        const stripped = stripPrefix(uri.replace(/\/+$/, ""), normalized);
        if (!stripped || seen.has(stripped)) return;
        seen.add(stripped);
        items.push({ key: stripped, uri });
      };
      if (Array.isArray(payload)) {
        for (const entry of payload) visit(entry);
      }
      return items;
    },
    async write(relative: string, data: unknown) {
      const uri = joinKey(normalized, relative);
      await backend.receive([[uri, encodePayload(data)]]);
      return { ok: true };
    },
  };
}

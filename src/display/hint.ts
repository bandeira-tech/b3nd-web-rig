import type { DisplayHint, DisplayInput, DisplayKind } from "./types";

const EXTENSION_KIND: Record<string, { kind: DisplayKind; contentType: string }> = {
  json: { kind: "json", contentType: "application/json" },
  txt: { kind: "text", contentType: "text/plain" },
  log: { kind: "text", contentType: "text/plain" },
  md: { kind: "markdown", contentType: "text/markdown" },
  markdown: { kind: "markdown", contentType: "text/markdown" },
  html: { kind: "html", contentType: "text/html" },
  htm: { kind: "html", contentType: "text/html" },
  png: { kind: "image", contentType: "image/png" },
  jpg: { kind: "image", contentType: "image/jpeg" },
  jpeg: { kind: "image", contentType: "image/jpeg" },
  gif: { kind: "image", contentType: "image/gif" },
  webp: { kind: "image", contentType: "image/webp" },
  svg: { kind: "image", contentType: "image/svg+xml" },
};

function extensionFromUri(uri?: string): string | undefined {
  if (!uri) return undefined;
  // Strip any trailing slash, query, fragment; pull the last segment's tail.
  const cleaned = uri.split(/[?#]/, 1)[0].replace(/\/+$/, "");
  const segments = cleaned.split("/");
  const last = segments[segments.length - 1];
  if (!last || !last.includes(".")) return undefined;
  const ext = last.split(".").pop()?.toLowerCase();
  return ext || undefined;
}

function bytesToString(bytes: Uint8Array): string | null {
  try {
    return new TextDecoder("utf-8", { fatal: true }).decode(bytes);
  } catch {
    return null;
  }
}

function tryParseJson(value: string): unknown | undefined {
  // Cheap sniff before paying for the parse.
  const trimmed = value.trimStart();
  const first = trimmed.charAt(0);
  if (first !== "{" && first !== "[" && first !== '"' &&
      !/^-?\d/.test(trimmed) && trimmed !== "true" && trimmed !== "false" &&
      trimmed !== "null") {
    return undefined;
  }
  try {
    return JSON.parse(trimmed);
  } catch {
    return undefined;
  }
}

function looksLikeMarkdown(value: string): boolean {
  // Heuristic: heading at line start, list bullets, or fenced code.
  return /^#{1,6}\s|\n#{1,6}\s|\n[-*]\s|^[-*]\s|```/.test(value);
}

function bytesToImageUrl(bytes: Uint8Array, contentType: string): string {
  // Use a data URL; small enough for the kind of icons/screenshots users
  // tend to stash. `blob:` would also work but data: keeps it deterministic
  // for tests and avoids URL.revokeObjectURL bookkeeping.
  let binary = "";
  // Avoid spread on huge arrays — chunk to stay within stack limits.
  const CHUNK = 0x8000;
  for (let i = 0; i < bytes.length; i += CHUNK) {
    binary += String.fromCharCode(...bytes.subarray(i, i + CHUNK));
  }
  return `data:${contentType};base64,${btoa(binary)}`;
}

/**
 * Derive a {@link DisplayHint} from a URI + raw payload pair.
 *
 * Order of precedence:
 *   1. Explicit `_meta.contentType` envelope on the data.
 *   2. URI extension match.
 *   3. Data shape sniff (object → json, Uint8Array → text/binary, …).
 *
 * Strategies should rely on this rather than re-sniff inside the component.
 */
export function deriveHint(input: DisplayInput): DisplayHint {
  const { uri, data } = input;
  const extension = extensionFromUri(uri);
  const extHit = extension ? EXTENSION_KIND[extension] : undefined;

  // Envelope: `{ data, _meta: { contentType } }`.
  const envelope =
    data && typeof data === "object" && !Array.isArray(data) &&
      "_meta" in (data as Record<string, unknown>)
      ? (data as { _meta?: { contentType?: string } })._meta
      : undefined;
  const envelopeType = envelope?.contentType;

  // Bytes path — try utf-8 decode; pick image if extension says so.
  if (data instanceof Uint8Array) {
    if (extHit && extHit.kind === "image") {
      return {
        kind: "image",
        contentType: extHit.contentType,
        extension,
        payload: bytesToImageUrl(data, extHit.contentType),
      };
    }
    const decoded = bytesToString(data);
    if (decoded === null) {
      return { kind: "binary", extension, payload: data };
    }
    return deriveHint({ uri, data: decoded });
  }

  if (typeof data === "string") {
    // Data URL string is always an image hint.
    if (/^data:image\//.test(data)) {
      const contentType = data.slice(5, data.indexOf(";"));
      return { kind: "image", contentType, extension, payload: data };
    }
    if (extHit?.kind === "image") {
      return {
        kind: "image",
        contentType: extHit.contentType,
        extension,
        payload: data,
      };
    }
    // Try JSON before any extension-based decision so that a bare string
    // payload doesn't get treated as plaintext just because the URI lacks
    // an extension.
    const parsed = tryParseJson(data);
    if (parsed !== undefined && (extHit?.kind === "json" || !extHit)) {
      return {
        kind: "json",
        contentType: extHit?.contentType ?? envelopeType ?? "application/json",
        extension,
        payload: parsed,
      };
    }
    if (extHit?.kind === "html") {
      return { kind: "html", contentType: extHit.contentType, extension, payload: data };
    }
    if (extHit?.kind === "markdown" || looksLikeMarkdown(data)) {
      return {
        kind: "markdown",
        contentType: extHit?.contentType ?? "text/markdown",
        extension,
        payload: data,
      };
    }
    if (extHit?.kind === "text" || extHit?.kind === "json") {
      return {
        kind: extHit.kind,
        contentType: extHit.contentType,
        extension,
        payload: extHit.kind === "json" ? (parsed ?? data) : data,
      };
    }
    return {
      kind: "text",
      contentType: envelopeType ?? "text/plain",
      extension,
      payload: data,
    };
  }

  if (data && typeof data === "object") {
    return {
      kind: "json",
      contentType: envelopeType ?? "application/json",
      extension,
      payload: data,
    };
  }

  // Primitives → render as JSON; the JSON strategy handles scalars cleanly.
  return {
    kind: data == null ? "unknown" : "json",
    contentType: envelopeType,
    extension,
    payload: data,
  };
}

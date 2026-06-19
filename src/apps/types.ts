import type { ReactNode } from "react";

/**
 * Constrained data handle that an app uses to talk to the rig. Scoped
 * to a user-chosen prefix — the app never sees outside it. Mirrors the
 * `receive` / `read` / `list` shape of the rig itself so a hand-rolled
 * app and a built-in one share the same surface.
 */
export interface RigSlot {
  /** Absolute URI of the base prefix this slot is scoped to. */
  readonly basePath: string;
  /** Resolve a relative key to the absolute URI it maps to. */
  resolve(relative: string): string;
  /** Read one or more records by relative key. Returns parsed JSON / text. */
  read(relative: string | string[]): Promise<Array<{
    key: string;
    uri: string;
    data: unknown;
  }>>;
  /**
   * List child keys under a relative prefix. Returns key names (already
   * stripped of the slot's basePath).
   */
  list(relative?: string): Promise<Array<{ key: string; uri: string }>>;
  /** Write to a relative key. `data` is JSON-encoded unless already bytes. */
  write(relative: string, data: unknown): Promise<{ ok: boolean }>;
}

/**
 * App descriptor — what a user (or another app) stores in the apps
 * catalog so the rig knows how to mount it. Display kinds:
 *   - `builtin`: rig ships the React component, id keys into the
 *     built-in apps registry.
 *   - `html`: payload at `uri` is HTML loaded into a sandboxed iframe
 *     (deferred — needs a postMessage bridge).
 */
export interface AppDescriptor {
  /** Stable identifier inside the rig (URL slug). */
  slug: string;
  /** Human label shown in the apps browser. */
  name: string;
  /** Short tagline / what the app does. */
  description?: string;
  /** Emoji or single character used for the catalog tile. */
  icon?: string;
  /**
   * Default basepath the rig will scope a RigSlot to when the app is
   * mounted without an override (user can change at mount time).
   */
  defaultBasePath: string;
  display:
    | { kind: "builtin"; id: string }
    | { kind: "html"; uri: string };
}

/**
 * Props passed to a built-in app component when the rig mounts it.
 */
export interface BuiltinAppProps {
  descriptor: AppDescriptor;
  slot: RigSlot;
}

/** A built-in app — the React component the rig will mount. */
export interface BuiltinApp {
  id: string;
  label: string;
  component: (props: BuiltinAppProps) => ReactNode;
}

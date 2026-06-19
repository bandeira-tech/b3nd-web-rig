import type { ComponentType, ReactNode } from "react";

/**
 * Coarse content kinds the rig knows how to render natively. Strategies
 * own the visual treatment; the hint exists so we can pick one without
 * each strategy duplicating sniff logic.
 */
export type DisplayKind =
  | "json"
  | "text"
  | "markdown"
  | "image"
  | "html"
  | "binary"
  | "unknown";

export interface DisplayHint {
  kind: DisplayKind;
  /** MIME content type when derivable, e.g. "application/json". */
  contentType?: string;
  /** Filename extension (no dot) derived from the URI when present. */
  extension?: string;
  /**
   * The payload normalized for the chosen strategy. For text-like kinds
   * this is a string; for `image` it is a usable URL (`data:` or `blob:`);
   * for `binary` it is the raw bytes; for `json` it is the parsed value.
   */
  payload: unknown;
}

export interface DisplayInput {
  uri?: string;
  data: unknown;
}

export interface DisplayContext {
  uri?: string;
  /** When the active backend exposes an HTTP read URL, strategies can link out. */
  readUrl?: string;
  /** Copy current payload as text. */
  onCopyText?: () => Promise<void>;
}

export interface DisplayStrategyProps {
  hint: DisplayHint;
  context: DisplayContext;
}

export interface DisplayStrategy {
  /** Stable identifier — used for replacement and tests. */
  id: string;
  /** Kinds this strategy handles. The first registered strategy wins. */
  kinds: DisplayKind[];
  /** Optional human label for diagnostics / picker UI later. */
  label?: string;
  component: ComponentType<DisplayStrategyProps>;
}

export type DisplayChildren = ReactNode;

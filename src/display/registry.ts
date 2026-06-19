import type {
  DisplayHint,
  DisplayKind,
  DisplayStrategy,
} from "./types";
import { jsonStrategy } from "./strategies/JsonStrategy";
import { textStrategy } from "./strategies/TextStrategy";
import { markdownStrategy } from "./strategies/MarkdownStrategy";
import { imageStrategy } from "./strategies/ImageStrategy";
import { htmlStrategy } from "./strategies/HtmlStrategy";
import { binaryStrategy } from "./strategies/BinaryStrategy";
import { unknownStrategy } from "./strategies/UnknownStrategy";

/**
 * Strategy registry. We keep this in module scope on purpose — there is
 * exactly one rig per page, and a global registry lets feature work
 * (apps under /apps) extend the renderer without prop-drilling.
 */
class DisplayRegistry {
  private byKind = new Map<DisplayKind, DisplayStrategy>();
  private all: DisplayStrategy[] = [];

  register(strategy: DisplayStrategy): void {
    // Replace by id when re-registered (hot reload).
    this.all = this.all.filter((s) => s.id !== strategy.id);
    this.all.push(strategy);
    for (const kind of strategy.kinds) {
      // First registration wins per kind unless this strategy id is
      // already mapped — supports hot replacement without leaking old
      // entries.
      const existing = this.byKind.get(kind);
      if (!existing || existing.id === strategy.id) {
        this.byKind.set(kind, strategy);
      }
    }
  }

  /** Force a specific strategy id to handle a kind. */
  setForKind(kind: DisplayKind, id: string): void {
    const target = this.all.find((s) => s.id === id);
    if (!target) {
      throw new Error(`Unknown display strategy: ${id}`);
    }
    this.byKind.set(kind, target);
  }

  resolve(hint: DisplayHint): DisplayStrategy {
    return this.byKind.get(hint.kind) ??
      this.byKind.get("unknown") ??
      unknownStrategy;
  }

  list(): DisplayStrategy[] {
    return [...this.all];
  }
}

export const displayRegistry = new DisplayRegistry();

// Register defaults.
for (const s of [
  jsonStrategy,
  textStrategy,
  markdownStrategy,
  imageStrategy,
  htmlStrategy,
  binaryStrategy,
  unknownStrategy,
]) {
  displayRegistry.register(s);
}

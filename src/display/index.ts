export * from "./types";
export { deriveHint } from "./hint";
export { displayRegistry } from "./registry";
import { deriveHint } from "./hint";
import { displayRegistry } from "./registry";
import type { DisplayContext, DisplayInput } from "./types";
import { createElement, type ReactElement } from "react";

/**
 * One-shot render: derive a hint from a URI/data pair, resolve a strategy,
 * and produce the React element. Useful for ContentViewer and tests.
 */
export function renderDisplay(
  input: DisplayInput,
  context: DisplayContext = {},
): ReactElement {
  const hint = deriveHint(input);
  const strategy = displayRegistry.resolve(hint);
  return createElement(strategy.component, { hint, context });
}

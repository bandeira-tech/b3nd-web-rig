/* eslint-disable react-refresh/only-export-components */
import type { DisplayStrategy, DisplayStrategyProps } from "../types";

function TextView({ hint }: DisplayStrategyProps) {
  const text = typeof hint.payload === "string"
    ? hint.payload
    : String(hint.payload ?? "");
  return (
    <pre
      data-testid="display-text"
      className="font-mono text-sm whitespace-pre-wrap break-words bg-muted/40 rounded-md p-3"
    >
      {text}
    </pre>
  );
}

export const textStrategy: DisplayStrategy = {
  id: "core.text",
  kinds: ["text"],
  label: "Text",
  component: TextView,
};

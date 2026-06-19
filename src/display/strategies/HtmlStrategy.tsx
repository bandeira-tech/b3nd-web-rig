/* eslint-disable react-refresh/only-export-components */
import type { DisplayStrategy, DisplayStrategyProps } from "../types";

function HtmlView({ hint }: DisplayStrategyProps) {
  const source = typeof hint.payload === "string"
    ? hint.payload
    : String(hint.payload ?? "");
  // Sandboxed iframe — never execute scripts or allow same-origin. Stored
  // HTML may have been written by a third-party app; treat it as untrusted.
  return (
    <iframe
      data-testid="display-html"
      sandbox=""
      srcDoc={source}
      title="HTML content"
      className="w-full min-h-[40vh] bg-background border border-border rounded-md"
    />
  );
}

export const htmlStrategy: DisplayStrategy = {
  id: "core.html",
  kinds: ["html"],
  label: "HTML",
  component: HtmlView,
};

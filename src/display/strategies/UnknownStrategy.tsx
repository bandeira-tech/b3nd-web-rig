/* eslint-disable react-refresh/only-export-components */
import type { DisplayStrategy, DisplayStrategyProps } from "../types";

function UnknownView({ hint }: DisplayStrategyProps) {
  return (
    <div
      data-testid="display-unknown"
      className="p-3 text-sm text-muted-foreground bg-muted/30 rounded-md"
    >
      No display strategy registered for {hint.kind}
      {hint.extension ? ` (.${hint.extension})` : ""}.
    </div>
  );
}

export const unknownStrategy: DisplayStrategy = {
  id: "core.unknown",
  kinds: ["unknown"],
  label: "Unknown",
  component: UnknownView,
};

/* eslint-disable react-refresh/only-export-components */
import type { DisplayStrategy, DisplayStrategyProps } from "../types";

function ImageView({ hint }: DisplayStrategyProps) {
  const src = typeof hint.payload === "string" ? hint.payload : "";
  if (!src) {
    return (
      <div className="p-3 text-sm text-destructive">
        Image payload could not be resolved.
      </div>
    );
  }
  return (
    <div
      data-testid="display-image"
      className="p-3 flex items-center justify-center bg-muted/30 rounded-md"
    >
      <img
        src={src}
        alt={hint.extension ? `${hint.extension} payload` : "payload"}
        className="max-w-full max-h-[60vh] object-contain"
      />
    </div>
  );
}

export const imageStrategy: DisplayStrategy = {
  id: "core.image",
  kinds: ["image"],
  label: "Image",
  component: ImageView,
};

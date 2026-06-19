/* eslint-disable react-refresh/only-export-components */
import type { DisplayStrategy, DisplayStrategyProps } from "../types";

function bytesPreview(bytes: Uint8Array, max = 256): string {
  const slice = bytes.subarray(0, max);
  let hex = "";
  for (let i = 0; i < slice.length; i++) {
    hex += slice[i].toString(16).padStart(2, "0");
    if ((i + 1) % 16 === 0) hex += "\n";
    else if ((i + 1) % 2 === 0) hex += " ";
  }
  if (bytes.length > max) {
    hex += `\n… (${bytes.length - max} more bytes)`;
  }
  return hex;
}

function BinaryView({ hint }: DisplayStrategyProps) {
  const bytes = hint.payload instanceof Uint8Array
    ? hint.payload
    : new Uint8Array(0);
  return (
    <div data-testid="display-binary" className="space-y-2">
      <div className="text-xs text-muted-foreground">
        {bytes.length} bytes
        {hint.contentType ? ` · ${hint.contentType}` : ""}
      </div>
      <pre className="font-mono text-xs bg-muted/40 rounded-md p-3 overflow-x-auto">
        {bytesPreview(bytes)}
      </pre>
    </div>
  );
}

export const binaryStrategy: DisplayStrategy = {
  id: "core.binary",
  kinds: ["binary"],
  label: "Binary",
  component: BinaryView,
};

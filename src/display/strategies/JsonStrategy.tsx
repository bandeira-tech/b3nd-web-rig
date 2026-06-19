/* eslint-disable react-refresh/only-export-components -- strategies pair a
   component with its registry metadata; the metadata export is intentional. */
import { type ReactNode } from "react";
import type { DisplayStrategy, DisplayStrategyProps } from "../types";

function renderValue(data: unknown, level = 0): ReactNode {
  if (data === null || data === undefined) {
    return <span className="json-null">null</span>;
  }
  if (typeof data === "string") {
    return <span className="json-string">"{data}"</span>;
  }
  if (typeof data === "number") {
    return <span className="json-number">{data}</span>;
  }
  if (typeof data === "boolean") {
    return <span className="json-boolean">{String(data)}</span>;
  }
  if (Array.isArray(data)) {
    return (
      <div className="ml-4">
        [<br />
        {data.map((item, i) => (
          <div
            key={`arr-${level}-${i}`}
            style={{ paddingLeft: `${level * 2 + 1}rem` }}
          >
            {renderValue(item, level + 1)}
            {i < data.length - 1 && ","}
          </div>
        ))}
        <br />]
      </div>
    );
  }
  if (typeof data === "object") {
    return (
      <div className="ml-4">
        {Object.entries(data as Record<string, unknown>).map(([k, v]) => (
          <div
            key={`obj-${level}-${k}`}
            style={{ paddingLeft: `${level * 2 + 1}rem` }}
          >
            <span className="json-key">"{k}"</span>: {renderValue(v, level + 1)}
          </div>
        ))}
      </div>
    );
  }
  return <span>{String(data)}</span>;
}

function JsonView({ hint }: DisplayStrategyProps) {
  return (
    <div
      data-testid="display-json"
      className="font-mono text-sm whitespace-pre-wrap"
    >
      {renderValue(hint.payload)}
    </div>
  );
}

export const jsonStrategy: DisplayStrategy = {
  id: "core.json",
  kinds: ["json"],
  label: "JSON",
  component: JsonView,
};

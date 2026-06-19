import { Component, type ReactNode, StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "./index.css";
import App from "./App.tsx";
import { deriveHint, displayRegistry } from "./display";
import { createRigSlot, normalizeBasePath } from "./apps/runtime";
import { defaultAppCatalog, listBuiltinApps } from "./apps/registry";

// E2E test hooks: expose enough of the display + apps subsystems so
// Playwright can drive them directly without mounting the entire UI.
if (typeof window !== "undefined") {
  (window as unknown as {
    __b3ndDisplay: { deriveHint: typeof deriveHint; registry: typeof displayRegistry };
  }).__b3ndDisplay = { deriveHint, registry: displayRegistry };
  (window as unknown as {
    __b3ndApps: {
      createRigSlot: typeof createRigSlot;
      normalizeBasePath: typeof normalizeBasePath;
      catalog: typeof defaultAppCatalog;
      builtins: typeof listBuiltinApps;
    };
  }).__b3ndApps = {
    createRigSlot,
    normalizeBasePath,
    catalog: defaultAppCatalog,
    builtins: listBuiltinApps,
  };
}

class ErrorBoundary
  extends Component<{ children: ReactNode }, { error: Error | null }> {
  state = { error: null as Error | null };
  static getDerivedStateFromError(error: Error) {
    return { error };
  }
  render() {
    if (this.state.error) {
      return (
        <div
          style={{
            padding: 32,
            fontFamily: "monospace",
            color: "#f87171",
            background: "#0f172a",
            minHeight: "100vh",
          }}
        >
          <h1 style={{ fontSize: 18 }}>React crashed</h1>
          <pre
            style={{
              whiteSpace: "pre-wrap",
              marginTop: 16,
              fontSize: 13,
              color: "#94a3b8",
            }}
          >
            {this.state.error.message}{'\n'}{this.state.error.stack}
          </pre>
        </div>
      );
    }
    return this.props.children;
  }
}

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  </StrictMode>,
);

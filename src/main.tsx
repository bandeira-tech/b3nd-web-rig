import { Component, type ReactNode, StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "./index.css";
import App from "./App.tsx";
import { deriveHint, displayRegistry } from "./display";

// E2E test hook: expose the display registry so Playwright can assert
// hint derivation without mounting the explorer for every URI shape.
if (typeof window !== "undefined") {
  (window as unknown as {
    __b3ndDisplay: { deriveHint: typeof deriveHint; registry: typeof displayRegistry };
  }).__b3ndDisplay = { deriveHint, registry: displayRegistry };
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

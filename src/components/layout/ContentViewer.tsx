import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAppStore } from "../../stores/appStore";
import { routeForExplorerPath } from "../../utils";
import { useActiveBackend } from "../../stores/appStore";
import type { NavigationNode, PaginatedResponse } from "../../types";
import {
  Copy,
  Download,
  FileText,
  Folder,
  Link as LinkIcon,
} from "lucide-react";
import { HttpAdapter } from "../../adapters/HttpAdapter";
import { deriveHint, displayRegistry } from "../../display";
// no extra utils used here

interface ContentViewerProps {
  path: string;
  buildRoute?: (path: string) => string;
}

export function ContentViewer({ path, buildRoute }: ContentViewerProps) {
  const [record, setRecord] = useState<{ data: unknown } | null>(null);
  const [directoryContents, setDirectoryContents] = useState<NavigationNode[]>(
    [],
  );
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const activeBackend = useActiveBackend();
  const { mode, rootNodes } = useAppStore();
  const resolveRoute = buildRoute || routeForExplorerPath;

  const loadContent = useCallback(async () => {
    if (!activeBackend?.adapter || mode !== "filesystem") {
      setLoading(false);
      setError("No backend available");
      setRecord(null);
      setDirectoryContents([]);
      return;
    }

    try {
      setLoading(true);
      setError(null);
      setRecord(null);
      setDirectoryContents([]);

      // Root path uses schema-driven nav nodes rather than the adapter
      // (the adapter has no URI for "/").
      if (path === "/" || path === "") {
        setDirectoryContents(rootNodes);
        setLoading(false);
        return;
      }

      const listResponse: PaginatedResponse<NavigationNode> =
        await activeBackend.adapter.listPath(path, { page: 1, limit: 50 });

      // Empty list == leaf; fall through to readRecord. Otherwise render
      // as a directory.
      if (listResponse.data.length === 0) {
        const fileRecord = await activeBackend.adapter.readRecord(path);
        setRecord(fileRecord);
      } else {
        setDirectoryContents(listResponse.data);
      }
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : "Unknown error";
      setError(`Failed to load content: ${errorMsg}`);
    } finally {
      setLoading(false);
    }
  }, [path, activeBackend, mode, rootNodes]);

  useEffect(() => {
    loadContent();
  }, [loadContent, path]);

  const copyToClipboard = async () => {
    if (!record) {
      throw new Error("No record loaded to copy");
    }

    if (!navigator.clipboard || !navigator.clipboard.writeText) {
      throw new Error("Clipboard API is not available in this browser");
    }

    // Copy in the format the user is looking at: text-like hints copy as
    // text; everything else copies pretty-printed JSON.
    const uri = pathToUri(path);
    const hint = deriveHint({ uri, data: record.data });
    const text = hint.kind === "text" || hint.kind === "markdown" ||
        hint.kind === "html"
      ? (typeof hint.payload === "string"
        ? hint.payload
        : String(hint.payload ?? ""))
      : JSON.stringify(
        hint.kind === "json" ? hint.payload : record.data,
        null,
        2,
      );
    await navigator.clipboard.writeText(text);
  };

  if (loading) {
    return (
      <div className="p-4 text-center text-muted-foreground">
        Loading content...
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-4 text-center text-destructive">Error: {error}</div>
    );
  }

  // Stale-state guard: a navigation back to '/' can render once with the
  // previous record still set before the effect clears it. Don't ask the
  // adapter to build a URL for the root — it has no URI.
  if (record && path !== "/" && path !== "") {
    const readUrl = activeBackend?.adapter instanceof HttpAdapter
      ? activeBackend.adapter.getReadUrl(path)
      : undefined;
    return (
      <FileViewer
        path={path}
        record={record}
        onCopy={copyToClipboard}
        readUrl={readUrl}
      />
    );
  }

  if (directoryContents.length > 0) {
    return (
      <DirectoryViewer contents={directoryContents} buildRoute={resolveRoute} />
    );
  }

  return (
    <div className="p-4 text-center text-muted-foreground">
      No content at this path
    </div>
  );
}

function pathToUri(path: string): string | undefined {
  const parts = path.split("/").filter(Boolean);
  if (parts.length < 1) return undefined;
  if (parts.length === 1) return `${parts[0]}://`;
  const [protocol, domain, ...rest] = parts;
  const subpath = rest.length ? "/" + rest.join("/") : "";
  return `${protocol}://${domain}${subpath}`;
}

function FileViewer({
  path,
  record,
  onCopy,
  readUrl,
}: {
  path: string;
  record: { data: unknown };
  onCopy: () => Promise<void>;
  readUrl?: string;
}) {
  const [copyState, setCopyState] = useState<"idle" | "success" | "error">(
    "idle",
  );
  const [copyError, setCopyError] = useState<string | null>(null);

  const uri = useMemo(() => pathToUri(path), [path]);
  const hint = useMemo(
    () => deriveHint({ uri, data: record.data }),
    [uri, record.data],
  );
  const strategy = useMemo(() => displayRegistry.resolve(hint), [hint]);
  const StrategyView = strategy.component;

  const handleCopyClick = async () => {
    try {
      setCopyError(null);
      await onCopy();
      setCopyState("success");
      setTimeout(() => setCopyState("idle"), 2000);
    } catch (error) {
      const message = error instanceof Error
        ? error.message
        : "Failed to copy";
      setCopyError(message);
      setCopyState("error");
      setTimeout(() => {
        setCopyState("idle");
        setCopyError(null);
      }, 4000);
    }
  };

  const handleDownloadClick = () => {
    try {
      const { blob, filename } = buildDownload(hint, record.data);
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    } catch (error) {
      const message = error instanceof Error
        ? error.message
        : "Failed to download";
      setCopyError(message);
      setCopyState("error");
      setTimeout(() => {
        setCopyState("idle");
        setCopyError(null);
      }, 4000);
    }
  };

  return (
    <div className="p-4 space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold flex items-center space-x-2">
          <FileText className="h-5 w-5" />
          <span>Record Data</span>
          <span
            data-testid="display-kind"
            className="text-xs font-normal px-2 py-0.5 rounded-full bg-muted text-muted-foreground"
          >
            {strategy.label ?? hint.kind}
          </span>
        </h3>
        <div className="flex items-center space-x-2">
          <button
            onClick={handleCopyClick}
            className="p-2 rounded hover:bg-accent transition-colors focus:outline-none focus:ring-2 focus:ring-ring"
            title="Copy"
          >
            <Copy className="h-4 w-4" />
          </button>
          <button
            onClick={handleDownloadClick}
            className="p-2 rounded hover:bg-accent transition-colors focus:outline-none focus:ring-2 focus:ring-ring"
            title="Download"
          >
            <Download className="h-4 w-4" />
          </button>
          {readUrl && (
            <a
              href={readUrl}
              target="_blank"
              rel="noreferrer"
              className="p-2 rounded hover:bg-accent transition-colors focus:outline-none focus:ring-2 focus:ring-ring"
              title="Open API URL"
            >
              <LinkIcon className="h-4 w-4" />
            </a>
          )}
          {copyState === "success" && (
            <span className="text-xs text-emerald-600">Copied</span>
          )}
          {copyState === "error" && copyError && (
            <span className="text-xs text-destructive">
              {copyError}
            </span>
          )}
        </div>
      </div>
      <div className="bg-card rounded-md border border-border p-3">
        <StrategyView hint={hint} context={{ uri, readUrl }} />
      </div>
    </div>
  );
}

function buildDownload(
  hint: ReturnType<typeof deriveHint>,
  raw: unknown,
): { blob: Blob; filename: string } {
  if (hint.kind === "json") {
    const json = JSON.stringify(hint.payload, null, 2);
    return {
      blob: new Blob([json], { type: "application/json" }),
      filename: "record.json",
    };
  }
  if (hint.kind === "binary" && raw instanceof Uint8Array) {
    return {
      blob: new Blob([raw], { type: hint.contentType ?? "application/octet-stream" }),
      filename: `record.${hint.extension ?? "bin"}`,
    };
  }
  if (hint.kind === "image" && typeof hint.payload === "string" &&
      hint.payload.startsWith("data:")) {
    // Re-encode to bytes for a real file download.
    const comma = hint.payload.indexOf(",");
    const base64 = hint.payload.slice(comma + 1);
    const binary = atob(base64);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
    return {
      blob: new Blob([bytes], { type: hint.contentType ?? "application/octet-stream" }),
      filename: `record.${hint.extension ?? "img"}`,
    };
  }
  const text = typeof hint.payload === "string"
    ? hint.payload
    : String(hint.payload ?? "");
  return {
    blob: new Blob([text], { type: hint.contentType ?? "text/plain" }),
    filename: `record.${hint.extension ?? "txt"}`,
  };
}

function DirectoryViewer(
  { contents, buildRoute }: {
    contents: NavigationNode[];
    buildRoute: (path: string) => string;
  },
) {
  const navigate = useNavigate();

  return (
    <div className="p-4 space-y-4">
      <h3 className="text-lg font-semibold flex items-center space-x-2">
        <Folder className="h-5 w-5" />
        <span>Directory Contents ({contents.length} items)</span>
      </h3>
      <div className="space-y-2">
        {contents.map((item) => (
          <div
            key={item.path}
            className="flex items-center space-x-3 p-3 rounded-lg hover:bg-accent cursor-pointer transition-colors focus:outline-none focus:ring-2 focus:ring-ring"
            onClick={() => navigate(buildRoute(item.path))}
            tabIndex={0}
            onKeyDown={(e) => {
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                navigate(buildRoute(item.path));
              }
            }}
          >
            <div className="flex-shrink-0">
              {item.type === "directory"
                ? <Folder className="h-5 w-5 text-blue-500" />
                : <FileText className="h-5 w-5 text-muted-foreground" />}
            </div>
            <div className="flex-1 min-w-0">
              <div className="font-medium truncate">{item.name}</div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

/* eslint-disable react-refresh/only-export-components */
import { useCallback, useEffect, useState } from "react";
import { Download, Plus, RefreshCw, Trash2, Upload } from "lucide-react";
import type { BuiltinApp, BuiltinAppProps } from "../types";
import { displayRegistry, deriveHint } from "../../display";

interface FileEntry {
  key: string;
  size: number;
  data: unknown;
}

function safeKey(name: string): string {
  // Strip directory chars to keep records flat under the basepath.
  return name
    .replace(/^.*[/\\]/, "")
    .replace(/[^a-zA-Z0-9._-]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 96) || "file";
}

function payloadByteLength(data: unknown): number {
  if (data instanceof Uint8Array) return data.byteLength;
  if (typeof data === "string") return new TextEncoder().encode(data).byteLength;
  if (data && typeof data === "object") {
    try {
      return new TextEncoder().encode(JSON.stringify(data)).byteLength;
    } catch {
      return 0;
    }
  }
  return 0;
}

function formatBytes(n: number): string {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} kB`;
  return `${(n / (1024 * 1024)).toFixed(2)} MB`;
}

export function FilesApp({ descriptor, slot }: BuiltinAppProps) {
  const [files, setFiles] = useState<FileEntry[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [activeKey, setActiveKey] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setError(null);
    setLoading(true);
    try {
      const items = await slot.list();
      if (items.length === 0) {
        setFiles([]);
        return;
      }
      const records = await slot.read(items.map((it) => it.key));
      const out: FileEntry[] = records.map((r) => ({
        key: r.key,
        size: payloadByteLength(r.data),
        data: r.data,
      }));
      out.sort((a, b) => a.key.localeCompare(b.key));
      setFiles(out);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  }, [slot]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const handleUpload = async (input: HTMLInputElement) => {
    const list = input.files;
    if (!list || list.length === 0) return;
    try {
      for (const file of Array.from(list)) {
        const buf = new Uint8Array(await file.arrayBuffer());
        await slot.write(safeKey(file.name), buf);
      }
      input.value = "";
      await refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    }
  };

  const handleQuickText = async () => {
    const name = window.prompt("File name (e.g. note.txt)?");
    if (!name) return;
    const body = window.prompt("Contents?") ?? "";
    try {
      await slot.write(safeKey(name), body);
      await refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    }
  };

  const handleDownload = (entry: FileEntry) => {
    let blob: Blob;
    if (entry.data instanceof Uint8Array) {
      blob = new Blob([entry.data]);
    } else if (typeof entry.data === "string") {
      blob = new Blob([entry.data], { type: "text/plain" });
    } else {
      blob = new Blob([JSON.stringify(entry.data ?? null, null, 2)], {
        type: "application/json",
      });
    }
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = entry.key;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const handleDelete = async (key: string) => {
    try {
      await slot.write(key, null);
      if (activeKey === key) setActiveKey(null);
      await refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    }
  };

  const active = files.find((f) => f.key === activeKey);
  const preview = (() => {
    if (!active) return null;
    const hint = deriveHint({ uri: slot.resolve(active.key), data: active.data });
    const strategy = displayRegistry.resolve(hint);
    const Comp = strategy.component;
    return <Comp hint={hint} context={{ uri: slot.resolve(active.key) }} />;
  })();

  return (
    <div
      data-testid="builtin-files-app"
      className="grid grid-cols-1 md:grid-cols-[20rem_1fr] gap-3 h-full min-h-[60vh]"
    >
      <aside className="border border-border rounded-md p-3 space-y-3 overflow-y-auto">
        <div className="space-y-1">
          <h3 className="text-sm font-semibold flex items-center gap-2">
            <span aria-hidden>{descriptor.icon ?? "📁"}</span>
            <span>{descriptor.name}</span>
          </h3>
          <div className="text-xs text-muted-foreground font-mono break-all">
            {slot.basePath}
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-1">
          <label
            className="cursor-pointer flex items-center gap-1 px-2 py-1 text-xs rounded border border-border hover:bg-accent"
            data-testid="files-upload-label"
          >
            <Upload className="h-3 w-3" /> Upload
            <input
              type="file"
              multiple
              className="hidden"
              onChange={(e) => void handleUpload(e.currentTarget)}
              data-testid="files-upload-input"
            />
          </label>
          <button
            onClick={handleQuickText}
            className="flex items-center gap-1 px-2 py-1 text-xs rounded border border-border hover:bg-accent"
            data-testid="files-quicktext-button"
          >
            <Plus className="h-3 w-3" /> Quick text
          </button>
          <button
            onClick={refresh}
            className="p-1.5 rounded hover:bg-accent ml-auto"
            title="Refresh"
          >
            <RefreshCw className="h-3.5 w-3.5" />
          </button>
        </div>
        {error && (
          <div className="text-xs text-destructive">{error}</div>
        )}
        {loading
          ? <div className="text-xs text-muted-foreground">Loading…</div>
          : files.length === 0
          ? (
            <div
              className="text-xs text-muted-foreground p-3 border border-dashed border-border rounded-md"
              data-testid="files-empty"
            >
              No files yet. Drop one in via Upload, or stash a quick text snippet.
            </div>
          )
          : (
            <ul className="space-y-1" data-testid="files-list">
              {files.map((f) => (
                <li
                  key={f.key}
                  className={`group flex items-center justify-between rounded px-2 py-1 text-sm hover:bg-accent ${
                    activeKey === f.key ? "bg-accent" : ""
                  }`}
                >
                  <button
                    onClick={() => setActiveKey(f.key)}
                    className="flex-1 text-left truncate"
                  >
                    <div className="truncate">{f.key}</div>
                    <div className="text-xs text-muted-foreground">
                      {formatBytes(f.size)}
                    </div>
                  </button>
                  <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition">
                    <button
                      onClick={() => handleDownload(f)}
                      title="Download"
                      className="p-1 rounded hover:bg-background"
                    >
                      <Download className="h-3 w-3" />
                    </button>
                    <button
                      onClick={() => handleDelete(f.key)}
                      title="Delete"
                      className="p-1 rounded hover:bg-background text-muted-foreground hover:text-destructive"
                      data-testid={`files-delete-${f.key}`}
                    >
                      <Trash2 className="h-3 w-3" />
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          )}
      </aside>
      <section className="border border-border rounded-md p-3 overflow-y-auto">
        {!active
          ? (
            <div
              className="h-full flex items-center justify-center text-sm text-muted-foreground"
              data-testid="files-preview-empty"
            >
              Pick a file to preview it here.
            </div>
          )
          : (
            <div className="space-y-2">
              <div className="text-sm font-mono">{active.key}</div>
              {preview}
            </div>
          )}
      </section>
    </div>
  );
}

export const filesApp: BuiltinApp = {
  id: "builtin:files",
  label: "Files",
  component: FilesApp,
};

/* eslint-disable react-refresh/only-export-components */
import { useCallback, useEffect, useState } from "react";
import { ExternalLink, Plus, RefreshCw, Trash2 } from "lucide-react";
import type { BuiltinApp, BuiltinAppProps } from "../types";

interface Bookmark {
  title: string;
  url: string;
  note?: string;
  tags?: string[];
  createdAt?: number;
}

interface LoadedBookmark extends Bookmark {
  key: string;
}

function slugify(input: string): string {
  // Bookmark slugs become a single key under the slot's basePath, so we
  // strip `/` here — leaving it would push the record into a sub-prefix
  // the list() call doesn't enumerate.
  return input
    .trim()
    .toLowerCase()
    .replace(/^https?:\/\//, "")
    .replace(/[^a-z0-9-_.]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 64) || "bookmark";
}

function parseBookmark(data: unknown): Bookmark | null {
  if (!data || typeof data !== "object") return null;
  const obj = data as Record<string, unknown>;
  if (typeof obj.url !== "string") return null;
  return {
    title: typeof obj.title === "string" ? obj.title : obj.url,
    url: obj.url,
    note: typeof obj.note === "string" ? obj.note : undefined,
    tags: Array.isArray(obj.tags) ? obj.tags.map(String) : undefined,
    createdAt: typeof obj.createdAt === "number" ? obj.createdAt : undefined,
  };
}

export function BookmarksApp({ descriptor, slot }: BuiltinAppProps) {
  const [bookmarks, setBookmarks] = useState<LoadedBookmark[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [draftUrl, setDraftUrl] = useState("");
  const [draftTitle, setDraftTitle] = useState("");

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const items = await slot.list();
      if (items.length === 0) {
        setBookmarks([]);
        return;
      }
      const records = await slot.read(items.map((it) => it.key));
      const loaded: LoadedBookmark[] = [];
      for (const r of records) {
        const parsed = parseBookmark(r.data);
        if (parsed) loaded.push({ key: r.key, ...parsed });
      }
      loaded.sort((a, b) => (b.createdAt ?? 0) - (a.createdAt ?? 0));
      setBookmarks(loaded);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  }, [slot]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const handleAdd = async () => {
    const url = draftUrl.trim();
    if (!url) return;
    const title = draftTitle.trim() || url;
    const key = `${slugify(title)}.json`;
    const record: Bookmark = { title, url, createdAt: Date.now() };
    try {
      await slot.write(key, record);
      setDraftUrl("");
      setDraftTitle("");
      await refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    }
  };

  const handleDelete = async (key: string) => {
    // Soft-delete by writing a tombstone. The store layer doesn't expose
    // a delete on the rig surface; an explicit null payload is the
    // documented convention.
    try {
      await slot.write(key, null);
      await refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    }
  };

  return (
    <div
      data-testid="builtin-bookmarks-app"
      className="space-y-4 max-w-3xl"
    >
      <header className="space-y-1">
        <h3 className="text-sm font-semibold flex items-center gap-2">
          <span aria-hidden>{descriptor.icon ?? "🔖"}</span>
          <span>{descriptor.name}</span>
        </h3>
        <p className="text-xs text-muted-foreground">
          One row per URL. Stored as JSON under{" "}
          <code className="font-mono">{slot.basePath}</code>.
        </p>
      </header>

      <form
        onSubmit={(e) => {
          e.preventDefault();
          void handleAdd();
        }}
        className="flex flex-col sm:flex-row gap-2 items-stretch"
        data-testid="bookmarks-form"
      >
        <input
          type="url"
          required
          value={draftUrl}
          onChange={(e) => setDraftUrl(e.target.value)}
          placeholder="https://…"
          className="flex-1 bg-muted/40 border border-border rounded-md px-2 py-1 text-sm"
          data-testid="bookmarks-url-input"
        />
        <input
          type="text"
          value={draftTitle}
          onChange={(e) => setDraftTitle(e.target.value)}
          placeholder="Title (optional)"
          className="flex-1 bg-muted/40 border border-border rounded-md px-2 py-1 text-sm"
          data-testid="bookmarks-title-input"
        />
        <button
          type="submit"
          className="flex items-center justify-center gap-1 px-3 py-1 rounded-md bg-primary text-primary-foreground text-sm hover:opacity-90"
          data-testid="bookmarks-add-button"
        >
          <Plus className="h-3.5 w-3.5" /> Add
        </button>
        <button
          type="button"
          onClick={refresh}
          className="px-2 py-1 rounded-md border border-border text-sm hover:bg-accent"
          title="Refresh"
        >
          <RefreshCw className="h-3.5 w-3.5" />
        </button>
      </form>

      {error && (
        <div className="text-xs text-destructive">{error}</div>
      )}

      {loading
        ? <div className="text-xs text-muted-foreground">Loading…</div>
        : bookmarks.length === 0
        ? (
          <div className="text-sm text-muted-foreground p-4 border border-dashed border-border rounded-md">
            No bookmarks yet. Add a URL above.
          </div>
        )
        : (
          <ul className="space-y-2" data-testid="bookmarks-list">
            {bookmarks.map((b) => (
              <li
                key={b.key}
                className="border border-border rounded-md p-3 flex items-center justify-between gap-3"
              >
                <div className="min-w-0 flex-1">
                  <a
                    href={b.url}
                    target="_blank"
                    rel="noreferrer noopener"
                    className="flex items-center gap-1 font-medium hover:underline"
                  >
                    <span className="truncate">{b.title}</span>
                    <ExternalLink className="h-3 w-3 flex-shrink-0" />
                  </a>
                  <div className="text-xs text-muted-foreground truncate">
                    {b.url}
                  </div>
                </div>
                <button
                  onClick={() => handleDelete(b.key)}
                  title="Delete bookmark"
                  className="p-1.5 rounded hover:bg-accent text-muted-foreground hover:text-destructive"
                  data-testid={`bookmarks-delete-${b.key}`}
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </li>
            ))}
          </ul>
        )}
    </div>
  );
}

export const bookmarksApp: BuiltinApp = {
  id: "builtin:bookmarks",
  label: "Bookmarks",
  component: BookmarksApp,
};

/* eslint-disable react-refresh/only-export-components */
import { useCallback, useEffect, useState } from "react";
import { Send, RefreshCw, Trash2 } from "lucide-react";
import type { BuiltinApp, BuiltinAppProps } from "../types";

interface InboxEntry {
  key: string;
  text: string;
  source?: string;
  createdAt: number;
}

function parseEntry(key: string, data: unknown): InboxEntry | null {
  if (!data || typeof data !== "object") return null;
  const obj = data as Record<string, unknown>;
  if (typeof obj.text !== "string") return null;
  return {
    key,
    text: obj.text,
    source: typeof obj.source === "string" ? obj.source : undefined,
    createdAt: typeof obj.createdAt === "number" ? obj.createdAt : 0,
  };
}

function formatTime(ts: number): string {
  if (!ts) return "";
  try {
    const d = new Date(ts);
    return d.toLocaleString(undefined, {
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return "";
  }
}

export function InboxApp({ descriptor, slot }: BuiltinAppProps) {
  const [entries, setEntries] = useState<InboxEntry[]>([]);
  const [draft, setDraft] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setError(null);
    setLoading(true);
    try {
      const items = await slot.list();
      if (items.length === 0) {
        setEntries([]);
        return;
      }
      const records = await slot.read(items.map((it) => it.key));
      const out: InboxEntry[] = [];
      for (const r of records) {
        const parsed = parseEntry(r.key, r.data);
        if (parsed) out.push(parsed);
      }
      out.sort((a, b) => b.createdAt - a.createdAt);
      setEntries(out);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  }, [slot]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const text = draft.trim();
    if (!text) return;
    const ts = Date.now();
    // Lexicographic-by-time key — keeps the on-disk order useful even for
    // viewers that only know how to list().
    const key = `${String(1e15 - ts).padStart(16, "0")}-${Math.random()
      .toString(36)
      .slice(2, 8)}.json`;
    try {
      await slot.write(key, { text, createdAt: ts, source: "inbox-ui" });
      setDraft("");
      await refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    }
  };

  const handleDelete = async (key: string) => {
    try {
      await slot.write(key, null);
      await refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    }
  };

  return (
    <div
      data-testid="builtin-inbox-app"
      className="space-y-4 max-w-3xl"
    >
      <header className="space-y-1">
        <h3 className="text-sm font-semibold flex items-center gap-2">
          <span aria-hidden>{descriptor.icon ?? "📥"}</span>
          <span>{descriptor.name}</span>
        </h3>
        <p className="text-xs text-muted-foreground">
          A timestamped log under{" "}
          <code className="font-mono">{slot.basePath}</code>. Anything that can
          write a record can drop into your inbox.
        </p>
      </header>

      <form
        onSubmit={handleSubmit}
        className="flex flex-col sm:flex-row gap-2"
        data-testid="inbox-form"
      >
        <input
          required
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          placeholder="Drop a thought, link, or memo…"
          className="flex-1 bg-muted/40 border border-border rounded-md px-2 py-1 text-sm"
          data-testid="inbox-draft"
        />
        <button
          type="submit"
          className="flex items-center justify-center gap-1 px-3 py-1 rounded-md bg-primary text-primary-foreground text-sm hover:opacity-90"
          data-testid="inbox-send"
        >
          <Send className="h-3.5 w-3.5" /> Send
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

      {error && <div className="text-xs text-destructive">{error}</div>}

      {loading
        ? <div className="text-xs text-muted-foreground">Loading…</div>
        : entries.length === 0
        ? (
          <div
            className="text-sm text-muted-foreground p-4 border border-dashed border-border rounded-md"
            data-testid="inbox-empty"
          >
            Your inbox is empty — send the first one above.
          </div>
        )
        : (
          <ul className="space-y-2" data-testid="inbox-list">
            {entries.map((e) => (
              <li
                key={e.key}
                className="border border-border rounded-md p-3 flex items-start justify-between gap-3"
              >
                <div className="min-w-0 flex-1 space-y-1">
                  <div className="text-sm whitespace-pre-wrap break-words">
                    {e.text}
                  </div>
                  <div className="text-xs text-muted-foreground flex items-center gap-2">
                    <span>{formatTime(e.createdAt)}</span>
                    {e.source && (
                      <span className="px-1.5 py-0.5 bg-muted rounded">
                        {e.source}
                      </span>
                    )}
                  </div>
                </div>
                <button
                  onClick={() => handleDelete(e.key)}
                  title="Delete"
                  className="p-1.5 rounded hover:bg-accent text-muted-foreground hover:text-destructive"
                  data-testid={`inbox-delete-${e.key}`}
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

export const inboxApp: BuiltinApp = {
  id: "builtin:inbox",
  label: "Inbox",
  component: InboxApp,
};

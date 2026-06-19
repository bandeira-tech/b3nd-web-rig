/* eslint-disable react-refresh/only-export-components */
import { useCallback, useEffect, useMemo, useState } from "react";
import { Plus, RefreshCw, Save } from "lucide-react";
import type { BuiltinApp, BuiltinAppProps } from "../types";
import { displayRegistry, deriveHint } from "../../display";

interface NoteListEntry {
  key: string;
  uri: string;
}

function slugify(input: string): string {
  return input
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9-_/.]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 64) || "untitled";
}

export function NotesApp({ descriptor, slot }: BuiltinAppProps) {
  const [notes, setNotes] = useState<NoteListEntry[]>([]);
  const [activeKey, setActiveKey] = useState<string | null>(null);
  const [activeBody, setActiveBody] = useState<string>("");
  const [editing, setEditing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const refresh = useCallback(async () => {
    setError(null);
    setLoading(true);
    try {
      const items = await slot.list();
      setNotes(items);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  }, [slot]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  useEffect(() => {
    if (!activeKey) {
      setActiveBody("");
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        const [entry] = await slot.read(activeKey);
        if (cancelled) return;
        const data = entry?.data;
        setActiveBody(
          typeof data === "string" ? data : JSON.stringify(data ?? "", null, 2),
        );
        setEditing(false);
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : String(err));
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [activeKey, slot]);

  const handleNew = async () => {
    const title = window.prompt("Note title?");
    if (!title) return;
    const key = `${slugify(title)}.md`;
    try {
      await slot.write(key, `# ${title}\n\n`);
      await refresh();
      setActiveKey(key);
      setEditing(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    }
  };

  const handleSave = async () => {
    if (!activeKey) return;
    try {
      await slot.write(activeKey, activeBody);
      setEditing(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    }
  };

  const renderedNote = useMemo(() => {
    if (editing || !activeKey) return null;
    const hint = deriveHint({ uri: slot.resolve(activeKey), data: activeBody });
    const strategy = displayRegistry.resolve(hint);
    const Comp = strategy.component;
    return <Comp hint={hint} context={{ uri: slot.resolve(activeKey) }} />;
  }, [editing, activeKey, activeBody, slot]);

  return (
    <div
      data-testid="builtin-notes-app"
      className="grid grid-cols-1 md:grid-cols-[18rem_1fr] gap-3 h-full min-h-[60vh]"
    >
      <aside className="border border-border rounded-md p-3 space-y-2 overflow-y-auto">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold flex items-center gap-2">
            <span aria-hidden>{descriptor.icon ?? "📝"}</span>
            <span>{descriptor.name}</span>
          </h3>
          <div className="flex gap-1">
            <button
              onClick={refresh}
              title="Refresh"
              className="p-1.5 rounded hover:bg-accent"
            >
              <RefreshCw className="h-3.5 w-3.5" />
            </button>
            <button
              onClick={handleNew}
              title="New note"
              className="p-1.5 rounded hover:bg-accent"
              data-testid="notes-new-button"
            >
              <Plus className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>
        <div className="text-xs text-muted-foreground">
          {slot.basePath}
        </div>
        {loading
          ? <div className="text-xs text-muted-foreground">Loading…</div>
          : notes.length === 0
          ? (
            <div className="text-xs text-muted-foreground p-3 border border-dashed border-border rounded-md">
              No notes yet. Hit + to create one.
            </div>
          )
          : (
            <ul className="space-y-1" data-testid="notes-list">
              {notes.map((n) => (
                <li key={n.key}>
                  <button
                    onClick={() => setActiveKey(n.key)}
                    className={`w-full text-left px-2 py-1 rounded text-sm hover:bg-accent ${
                      activeKey === n.key ? "bg-accent" : ""
                    }`}
                  >
                    {n.key}
                  </button>
                </li>
              ))}
            </ul>
          )}
        {error && (
          <div className="text-xs text-destructive">{error}</div>
        )}
      </aside>
      <section className="border border-border rounded-md p-3 overflow-y-auto">
        {!activeKey
          ? (
            <div className="h-full flex items-center justify-center text-sm text-muted-foreground">
              Pick or create a note to start.
            </div>
          )
          : (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <h4 className="text-sm font-mono">{activeKey}</h4>
                <div className="flex gap-2">
                  {editing
                    ? (
                      <button
                        onClick={handleSave}
                        className="flex items-center gap-1 px-2 py-1 text-xs rounded bg-primary text-primary-foreground hover:opacity-90"
                        data-testid="notes-save-button"
                      >
                        <Save className="h-3 w-3" /> Save
                      </button>
                    )
                    : (
                      <button
                        onClick={() => setEditing(true)}
                        className="px-2 py-1 text-xs rounded border border-border hover:bg-accent"
                      >
                        Edit
                      </button>
                    )}
                </div>
              </div>
              {editing
                ? (
                  <textarea
                    value={activeBody}
                    onChange={(e) => setActiveBody(e.target.value)}
                    className="w-full min-h-[40vh] font-mono text-sm bg-muted/30 rounded-md p-3 border border-border"
                    data-testid="notes-editor"
                  />
                )
                : renderedNote}
            </div>
          )}
      </section>
    </div>
  );
}

export const notesApp: BuiltinApp = {
  id: "builtin:notes",
  label: "Notes",
  component: NotesApp,
};

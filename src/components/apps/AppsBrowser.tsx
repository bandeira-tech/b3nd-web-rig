import { useCallback, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Plus, RefreshCw } from "lucide-react";
import type { AppDescriptor } from "../../apps/types";
import { defaultAppCatalog, listBuiltinApps } from "../../apps/registry";
import {
  getCatalogBasePath,
  getDefaultCatalogBasePath,
  loadCatalog,
  publishDescriptor,
  setCatalogBasePath,
} from "../../apps/catalog";
import { useAppStore } from "../../stores/appStore";
import type { SlotBackend } from "../../apps/runtime";
import { UserCog } from "lucide-react";

export function AppsBrowser() {
  const navigate = useNavigate();
  const rig = useAppStore((s) => s.rig) as SlotBackend | null;
  const activeAccount = useAppStore((s) => {
    const id = s.activeAccountId;
    if (!id) return null;
    const a = s.accounts.find((x) => x.id === id);
    if (!a) return null;
    return { name: a.name, emoji: a.emoji };
  });

  const [catalog, setCatalog] = useState<AppDescriptor[]>(defaultAppCatalog);
  const [basePath, setBasePathState] = useState<string>(getCatalogBasePath());
  const [publishing, setPublishing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async (path: string) => {
    setError(null);
    if (!rig) return;
    try {
      const next = await loadCatalog(rig, path);
      setCatalog(next);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    }
  }, [rig]);

  useEffect(() => {
    void refresh(basePath);
  }, [refresh, basePath]);

  const handleBasePathChange = (next: string) => {
    setBasePathState(next);
    setCatalogBasePath(next);
  };

  return (
    <div className="p-6 space-y-6" data-testid="apps-browser">
      <header className="space-y-2">
        <h2 className="text-xl font-semibold">Apps</h2>
        <p className="text-sm text-muted-foreground max-w-2xl">
          Tiny UIs that read and write your data through a basepath you
          control. The app's behaviour is the same wherever the data lives —
          memory, your own server, a friend's node.
        </p>
        <div
          className="inline-flex items-center gap-2 text-xs px-2 py-1 rounded-md border border-border bg-muted/30"
          data-testid="apps-browser-account"
        >
          {activeAccount
            ? (
              <>
                <span aria-hidden>{activeAccount.emoji || "👤"}</span>
                <span>
                  Mounts follow{" "}
                  <strong className="font-medium">{activeAccount.name}</strong>
                  's data scope.
                </span>
              </>
            )
            : (
              <>
                <UserCog className="h-3.5 w-3.5 text-muted-foreground" />
                <span>
                  No account active — apps will mount under the{" "}
                  <code className="font-mono">shared</code>{" "}
                  scope. Add an account to keep your data private.
                </span>
              </>
            )}
        </div>
        <div className="text-xs text-muted-foreground">
          Pick a tile to mount it. You can change the basepath any time
          (the app keeps working — its data simply lives somewhere else).
        </div>
      </header>

      <div className="flex flex-wrap items-center gap-2 text-xs">
        <span className="text-muted-foreground">Catalog at</span>
        <input
          value={basePath}
          onChange={(e) => handleBasePathChange(e.target.value)}
          className="bg-muted/40 border border-border rounded px-2 py-1 font-mono w-[24rem] max-w-[60vw]"
          aria-label="Catalog basepath"
          data-testid="apps-catalog-basepath"
        />
        {basePath !== getDefaultCatalogBasePath() && (
          <button
            onClick={() => handleBasePathChange(getDefaultCatalogBasePath())}
            className="text-muted-foreground hover:text-foreground underline decoration-dotted"
            data-testid="apps-catalog-reset"
          >
            reset
          </button>
        )}
        <button
          onClick={() => void refresh(basePath)}
          className="ml-auto p-1 rounded hover:bg-accent"
          title="Refresh catalog"
          data-testid="apps-catalog-refresh"
        >
          <RefreshCw className="h-3.5 w-3.5" />
        </button>
        <button
          onClick={() => setPublishing((p) => !p)}
          className="p-1 rounded hover:bg-accent flex items-center gap-1"
          data-testid="apps-publish-toggle"
        >
          <Plus className="h-3.5 w-3.5" /> Publish
        </button>
      </div>

      {publishing && (
        <PublishForm
          basePath={basePath}
          rig={rig}
          onPublished={() => {
            setPublishing(false);
            void refresh(basePath);
          }}
          onError={setError}
        />
      )}

      {error && (
        <div className="text-xs text-destructive" data-testid="apps-error">
          {error}
        </div>
      )}

      <div
        className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4"
        data-testid="apps-grid"
      >
        {catalog.map((app) => (
          <button
            key={app.slug}
            onClick={() => navigate(`/apps/${app.slug}`)}
            className="text-left rounded-lg border border-border p-4 hover:border-primary hover:bg-accent transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            data-testid={`apps-tile-${app.slug}`}
          >
            <div className="flex items-center gap-3 mb-2">
              <span className="text-2xl" aria-hidden>{app.icon ?? "✨"}</span>
              <h3 className="font-semibold">{app.name}</h3>
            </div>
            {app.description && (
              <p className="text-sm text-muted-foreground">{app.description}</p>
            )}
            <div className="mt-3 text-xs font-mono text-muted-foreground truncate">
              {app.defaultBasePath}
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}

interface PublishFormProps {
  basePath: string;
  rig: SlotBackend | null;
  onPublished: () => void;
  onError: (message: string) => void;
}

function PublishForm({ basePath, rig, onPublished, onError }: PublishFormProps) {
  const builtins = listBuiltinApps();
  const [kind, setKind] = useState<"builtin" | "html">("builtin");
  const [slug, setSlug] = useState("");
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [icon, setIcon] = useState("");
  const [defaultBasePath, setDefaultBasePath] = useState("memory://my-data/");
  const [builtinId, setBuiltinId] = useState(builtins[0]?.id ?? "");
  const [htmlBody, setHtmlBody] = useState(DEFAULT_HTML_TEMPLATE);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!rig) {
      onError("No backend connected.");
      return;
    }
    if (!slug || !name || !defaultBasePath) {
      onError("slug, name, and basepath are required.");
      return;
    }
    try {
      let display: AppDescriptor["display"];
      if (kind === "builtin") {
        if (!builtinId) {
          onError("Pick a built-in renderer.");
          return;
        }
        display = { kind: "builtin", id: builtinId };
      } else {
        if (!htmlBody.trim()) {
          onError("HTML body is required.");
          return;
        }
        // Store HTML alongside the descriptor under the same catalog
        // basepath so a single publish is one user gesture.
        const htmlUri = `${basePath.replace(/\/+$/, "")}/${slug}.html`;
        const { createRigSlot } = await import("../../apps/runtime");
        const slot = createRigSlot(rig, basePath.replace(/\/+$/, ""));
        await slot.write(`${slug}.html`, htmlBody);
        display = { kind: "html", uri: htmlUri };
      }
      await publishDescriptor(rig, {
        slug,
        name,
        description: description || undefined,
        icon: icon || undefined,
        defaultBasePath,
        display,
      }, basePath);
      setSlug("");
      setName("");
      setDescription("");
      setIcon("");
      onPublished();
    } catch (err) {
      onError(err instanceof Error ? err.message : String(err));
    }
  };

  return (
    <form
      onSubmit={handleSubmit}
      className="grid grid-cols-1 md:grid-cols-2 gap-2 border border-border rounded-md p-3 text-sm"
      data-testid="apps-publish-form"
    >
      <label className="flex flex-col gap-1 md:col-span-2">
        <span className="text-xs text-muted-foreground">kind</span>
        <div className="flex gap-1" role="radiogroup" aria-label="App kind">
          {(["builtin", "html"] as const).map((k) => (
            <button
              key={k}
              type="button"
              onClick={() => setKind(k)}
              className={`px-2 py-1 text-xs rounded border ${
                kind === k
                  ? "bg-primary text-primary-foreground border-primary"
                  : "border-border hover:bg-accent"
              }`}
              data-testid={`apps-publish-kind-${k}`}
            >
              {k === "builtin" ? "Built-in" : "HTML"}
            </button>
          ))}
        </div>
      </label>
      <label className="flex flex-col gap-1">
        <span className="text-xs text-muted-foreground">slug</span>
        <input
          required
          value={slug}
          onChange={(e) => setSlug(e.target.value)}
          placeholder="my-notes"
          className="bg-muted/40 border border-border rounded px-2 py-1 font-mono text-xs"
          data-testid="apps-publish-slug"
        />
      </label>
      <label className="flex flex-col gap-1">
        <span className="text-xs text-muted-foreground">name</span>
        <input
          required
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="My Notes"
          className="bg-muted/40 border border-border rounded px-2 py-1 text-xs"
          data-testid="apps-publish-name"
        />
      </label>
      <label className="flex flex-col gap-1 md:col-span-2">
        <span className="text-xs text-muted-foreground">description</span>
        <input
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="(optional)"
          className="bg-muted/40 border border-border rounded px-2 py-1 text-xs"
          data-testid="apps-publish-description"
        />
      </label>
      <label className="flex flex-col gap-1">
        <span className="text-xs text-muted-foreground">icon (emoji)</span>
        <input
          value={icon}
          onChange={(e) => setIcon(e.target.value)}
          placeholder="📝"
          className="bg-muted/40 border border-border rounded px-2 py-1 text-xs"
          data-testid="apps-publish-icon"
        />
      </label>
      <label className="flex flex-col gap-1">
        <span className="text-xs text-muted-foreground">default basepath</span>
        <input
          required
          value={defaultBasePath}
          onChange={(e) => setDefaultBasePath(e.target.value)}
          placeholder="memory://my-data/"
          className="bg-muted/40 border border-border rounded px-2 py-1 font-mono text-xs"
          data-testid="apps-publish-basepath"
        />
      </label>
      {kind === "builtin"
        ? (
          <label className="flex flex-col gap-1 md:col-span-2">
            <span className="text-xs text-muted-foreground">render with</span>
            <select
              value={builtinId}
              onChange={(e) => setBuiltinId(e.target.value)}
              className="bg-muted/40 border border-border rounded px-2 py-1 text-xs"
              data-testid="apps-publish-builtin"
            >
              {builtins.map((b) => (
                <option key={b.id} value={b.id}>{b.label} ({b.id})</option>
              ))}
            </select>
          </label>
        )
        : (
          <label className="flex flex-col gap-1 md:col-span-2">
            <span className="text-xs text-muted-foreground">
              HTML body — `window.b3ndSlot.{`{`}basePath,resolve,list,read,write{`}`}` is
              available
            </span>
            <textarea
              required
              value={htmlBody}
              onChange={(e) => setHtmlBody(e.target.value)}
              rows={10}
              className="bg-muted/40 border border-border rounded px-2 py-1 font-mono text-xs"
              data-testid="apps-publish-html"
            />
          </label>
        )}
      <div className="md:col-span-2 flex justify-end">
        <button
          type="submit"
          className="px-3 py-1 text-xs rounded-md bg-primary text-primary-foreground hover:opacity-90"
          data-testid="apps-publish-submit"
        >
          Publish
        </button>
      </div>
    </form>
  );
}

const DEFAULT_HTML_TEMPLATE = `<!doctype html>
<html>
<head><title>my app</title></head>
<body>
  <h1>Hello from b3nd</h1>
  <pre id="basepath"></pre>
  <script>
    (async () => {
      const bp = await window.b3ndSlot.basePath();
      document.getElementById('basepath').textContent = bp;
    })();
  </script>
</body>
</html>`;

import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { ArrowLeft, RotateCcw } from "lucide-react";
import { useAppStore } from "../../stores/appStore";
import { getBuiltinApp } from "../../apps/registry";
import { createRigSlot, type SlotBackend } from "../../apps/runtime";
import {
  clearMountBasePath,
  getMountBasePath,
  setMountBasePath,
} from "../../apps/mounts";
import { loadCatalog } from "../../apps/catalog";
import type { AppDescriptor } from "../../apps/types";

export function AppHost() {
  const { slug } = useParams<{ slug: string }>();
  const navigate = useNavigate();
  const rig = useAppStore((s) => s.rig) as SlotBackend | null;

  const [descriptor, setDescriptor] = useState<AppDescriptor | undefined>(
    undefined,
  );
  const [resolving, setResolving] = useState(true);
  useEffect(() => {
    if (!slug) {
      setDescriptor(undefined);
      setResolving(false);
      return;
    }
    setResolving(true);
    if (!rig) return;
    let cancelled = false;
    void loadCatalog(rig).then((cat) => {
      if (cancelled) return;
      setDescriptor(cat.find((d) => d.slug === slug));
      setResolving(false);
    }).catch(() => {
      if (cancelled) return;
      setDescriptor(undefined);
      setResolving(false);
    });
    return () => {
      cancelled = true;
    };
  }, [slug, rig]);

  // Per-app basepath: stored override first, descriptor default second.
  // Edits write back to localStorage so reloads pick up where the user
  // left off — own-your-data persistence moves to b3nd in a later iter.
  const [basePath, setBasePathState] = useState<string>(
    descriptor?.defaultBasePath ?? "",
  );
  useEffect(() => {
    if (!descriptor) return;
    setBasePathState(
      getMountBasePath(descriptor.slug) ?? descriptor.defaultBasePath,
    );
  }, [descriptor]);

  const setBasePath = (next: string) => {
    setBasePathState(next);
    if (!descriptor) return;
    if (next === descriptor.defaultBasePath) {
      clearMountBasePath(descriptor.slug);
    } else {
      setMountBasePath(descriptor.slug, next);
    }
  };

  const isDefault = descriptor
    ? basePath === descriptor.defaultBasePath
    : true;

  if (resolving) {
    return (
      <div className="p-6 text-sm text-muted-foreground" data-testid="app-host-resolving">
        Loading app…
      </div>
    );
  }

  if (!descriptor) {
    return (
      <div className="p-6 space-y-3" data-testid="app-host-missing">
        <button
          onClick={() => navigate("/apps")}
          className="text-sm text-muted-foreground flex items-center gap-1 hover:text-foreground"
        >
          <ArrowLeft className="h-4 w-4" /> Back to apps
        </button>
        <p className="text-sm">No app registered with slug "{slug}".</p>
      </div>
    );
  }

  if (descriptor.display.kind !== "builtin") {
    return (
      <div className="p-6" data-testid="app-host-unsupported">
        HTML-mounted apps are coming in a later iteration.
      </div>
    );
  }

  const builtin = getBuiltinApp(descriptor.display.id);
  if (!builtin) {
    return (
      <div className="p-6 text-destructive" data-testid="app-host-no-builtin">
        Built-in "{descriptor.display.id}" not found.
      </div>
    );
  }
  if (!rig) {
    return (
      <div className="p-6 text-sm text-muted-foreground">
        Connecting to the rig…
      </div>
    );
  }

  let slot;
  try {
    slot = createRigSlot(rig, basePath);
  } catch (err) {
    return (
      <div className="p-6 text-sm text-destructive">
        Invalid basepath {basePath}:{" "}
        {err instanceof Error ? err.message : String(err)}
      </div>
    );
  }

  const Mount = builtin.component;
  return (
    <div className="h-full flex flex-col" data-testid={`app-host-${slug}`}>
      <header className="px-4 py-2 border-b border-border flex items-center gap-3 bg-card">
        <button
          onClick={() => navigate("/apps")}
          className="p-1 rounded hover:bg-accent"
          title="Back to apps"
        >
          <ArrowLeft className="h-4 w-4" />
        </button>
        <div className="flex-1 min-w-0">
          <div className="text-sm font-semibold truncate">{descriptor.name}</div>
          <div className="text-xs text-muted-foreground truncate flex items-center gap-2">
            <span>mounted at</span>
            <input
              value={basePath}
              onChange={(e) => setBasePath(e.target.value)}
              className="bg-transparent font-mono text-xs underline decoration-dotted focus:outline-none w-[28rem] max-w-[60vw]"
              data-testid="app-host-basepath"
              aria-label="Basepath"
            />
            {!isDefault && (
              <button
                onClick={() => setBasePath(descriptor.defaultBasePath)}
                title="Reset to default basepath"
                className="p-0.5 rounded hover:bg-accent text-muted-foreground hover:text-foreground"
                data-testid="app-host-reset-basepath"
              >
                <RotateCcw className="h-3 w-3" />
              </button>
            )}
          </div>
        </div>
      </header>
      <main className="flex-1 p-3 overflow-auto">
        <Mount descriptor={descriptor} slot={slot} />
      </main>
    </div>
  );
}

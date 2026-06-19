import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { ArrowLeft } from "lucide-react";
import { useAppStore } from "../../stores/appStore";
import { defaultAppCatalog, getBuiltinApp } from "../../apps/registry";
import { createRigSlot, type SlotBackend } from "../../apps/runtime";

export function AppHost() {
  const { slug } = useParams<{ slug: string }>();
  const navigate = useNavigate();
  const rig = useAppStore((s) => s.rig) as SlotBackend | null;

  const descriptor = useMemo(
    () => defaultAppCatalog.find((d) => d.slug === slug),
    [slug],
  );

  // Allow the user to override the basepath at mount time. Persisting per
  // (descriptor, account) lives in iter 3; for now the override is session
  // local — good enough to make the mount affordance visible and testable.
  const [basePath, setBasePath] = useState<string>(
    descriptor?.defaultBasePath ?? "",
  );
  useEffect(() => {
    if (descriptor) setBasePath(descriptor.defaultBasePath);
  }, [descriptor]);

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
          <div className="text-xs text-muted-foreground truncate">
            mounted at{" "}
            <input
              value={basePath}
              onChange={(e) => setBasePath(e.target.value)}
              className="bg-transparent font-mono text-xs underline decoration-dotted focus:outline-none w-[28rem] max-w-[60vw]"
              data-testid="app-host-basepath"
              aria-label="Basepath"
            />
          </div>
        </div>
      </header>
      <main className="flex-1 p-3 overflow-auto">
        <Mount descriptor={descriptor} slot={slot} />
      </main>
    </div>
  );
}

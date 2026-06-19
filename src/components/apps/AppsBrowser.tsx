import { useNavigate } from "react-router-dom";
import type { AppDescriptor } from "../../apps/types";
import { defaultAppCatalog } from "../../apps/registry";

interface AppsBrowserProps {
  catalog?: AppDescriptor[];
}

export function AppsBrowser({ catalog = defaultAppCatalog }: AppsBrowserProps) {
  const navigate = useNavigate();
  return (
    <div className="p-6 space-y-6" data-testid="apps-browser">
      <header className="space-y-1">
        <h2 className="text-xl font-semibold">Apps</h2>
        <p className="text-sm text-muted-foreground max-w-2xl">
          Tiny UIs that read and write your data through a basepath you
          control. The app's behaviour is the same wherever the data lives.
        </p>
      </header>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
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

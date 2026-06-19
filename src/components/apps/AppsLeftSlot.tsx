import { useCallback, useEffect, useMemo, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { LayoutGrid, RotateCcw, UserCog } from "lucide-react";
import type { AppDescriptor } from "../../apps/types";
import { defaultAppCatalog } from "../../apps/registry";
import { loadCatalog } from "../../apps/catalog";
import { getMountBasePath } from "../../apps/mounts";
import { useAppStore } from "../../stores/appStore";
import type { SlotBackend } from "../../apps/runtime";
import { cn, RIG_ACCOUNTS_PATH } from "../../utils";

export function AppsLeftSlot() {
  const navigate = useNavigate();
  const location = useLocation();
  // The outer router matched `/apps/*`, so useParams here only gives the
  // wildcard. Pluck the slug directly.
  const slug = useMemo(() => {
    const m = /^\/apps\/([^/]+)/.exec(location.pathname);
    return m ? m[1] : undefined;
  }, [location.pathname]);
  const rig = useAppStore((s) => s.rig) as SlotBackend | null;
  const activeAccount = useAppStore((s) => {
    const id = s.activeAccountId;
    if (!id) return null;
    const a = s.accounts.find((x) => x.id === id);
    if (!a) return null;
    return { id: a.id, name: a.name, emoji: a.emoji };
  });
  const [catalog, setCatalog] = useState<AppDescriptor[]>(defaultAppCatalog);

  const refresh = useCallback(async () => {
    if (!rig) return;
    try {
      const next = await loadCatalog(rig);
      setCatalog(next);
    } catch {
      // Fall back to defaults silently — the browser will surface the error.
    }
  }, [rig]);

  useEffect(() => {
    void refresh();
    // Re-pull when the location changes — covers publish-and-navigate.
  }, [refresh, slug]);

  return (
    <div className="h-full flex flex-col">
      <div className="p-4 border-b border-gray-200 dark:border-gray-800 space-y-3">
        <div className="flex items-center justify-between">
          <button
            onClick={() => navigate("/apps")}
            className={cn(
              "flex items-center gap-2 text-sm font-semibold uppercase tracking-wide text-muted-foreground hover:text-foreground",
              !slug && "text-foreground",
            )}
            data-testid="apps-left-home"
          >
            <LayoutGrid className="h-4 w-4" />
            <span>Apps</span>
          </button>
          <button
            onClick={refresh}
            title="Refresh catalog"
            className="p-1 rounded hover:bg-accent text-muted-foreground"
            data-testid="apps-left-refresh"
          >
            <RotateCcw className="h-3 w-3" />
          </button>
        </div>
        <button
          onClick={() => navigate(RIG_ACCOUNTS_PATH)}
          className="w-full flex items-center gap-2 text-left px-2 py-1.5 rounded-md border border-border hover:bg-accent"
          data-testid="apps-left-account"
          title="Manage accounts — your apps follow whichever is active"
        >
          {activeAccount
            ? (
              <>
                <span className="text-base leading-none" aria-hidden>
                  {activeAccount.emoji || "👤"}
                </span>
                <div className="flex flex-col min-w-0 flex-1">
                  <span className="text-xs text-muted-foreground">
                    Active account
                  </span>
                  <span className="text-sm font-medium truncate">
                    {activeAccount.name}
                  </span>
                </div>
              </>
            )
            : (
              <>
                <UserCog className="h-4 w-4 text-muted-foreground" />
                <div className="flex flex-col min-w-0 flex-1">
                  <span className="text-xs text-muted-foreground">
                    No account
                  </span>
                  <span className="text-xs">Using "shared" scope</span>
                </div>
              </>
            )}
        </button>
      </div>
      <div className="flex-1 overflow-auto custom-scrollbar p-2 space-y-1">
        {catalog.length === 0
          ? (
            <div className="text-xs text-muted-foreground p-3 border border-dashed border-border rounded-md">
              No apps in your catalog yet.
            </div>
          )
          : (
            <ul data-testid="apps-left-list">
              {catalog.map((app) => {
                const override = getMountBasePath(app.slug);
                const basepath = override ?? app.defaultBasePath;
                const active = slug === app.slug;
                return (
                  <li key={app.slug}>
                    <button
                      onClick={() => navigate(`/apps/${app.slug}`)}
                      className={cn(
                        "w-full text-left rounded-md px-2 py-2 hover:bg-accent transition-colors",
                        active && "bg-accent",
                      )}
                      data-testid={`apps-left-item-${app.slug}`}
                    >
                      <div className="flex items-center gap-2">
                        <span className="text-base leading-none" aria-hidden>
                          {app.icon ?? "✨"}
                        </span>
                        <span className="text-sm font-medium truncate">
                          {app.name}
                        </span>
                        {override && (
                          <span
                            title="Custom basepath"
                            className="ml-auto text-[10px] uppercase tracking-wider text-primary"
                          >
                            mounted
                          </span>
                        )}
                      </div>
                      <div className="text-[11px] font-mono text-muted-foreground truncate mt-0.5">
                        {basepath}
                      </div>
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
      </div>
    </div>
  );
}

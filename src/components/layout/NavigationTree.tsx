import { useCallback, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAppStore } from "../../stores/appStore";
import { routeForExplorerPath } from "../../utils";
import type { NavigationNode } from "../../types";
import { Folder } from "lucide-react";
import { TreeNode } from "./TreeNode";

export function NavigationTree() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Get root nodes from store (schema-driven)
  const rootNodes = useAppStore((state) => state.rootNodes);
  const schemas = useAppStore((state) => state.schemas);
  const activeBackend = useAppStore((state) =>
    state.backends.find((b) => b.id === state.activeBackendId)
  );
  const rig = useAppStore((state) => state.rig);
  const { expandedPaths, togglePathExpansion, loadSchemas } = useAppStore();
  const navigate = useNavigate();

  useEffect(() => {
    if (!activeBackend?.adapter) {
      setError("No active backend");
      setLoading(false);
      return;
    }

    // Wait for the rig to be wired before asking it for schemas.
    // Rehydrate sets backends → rig → backendsReady; this effect can fire
    // during the gap between backends and rig if we don't gate on rig.
    if (!rig) return;

    const loadRoot = async () => {
      try {
        setLoading(true);
        setError(null);

        if (Object.keys(schemas).length === 0) {
          await loadSchemas();
        } else {
          setLoading(false);
        }
      } catch (err) {
        const errMsg = err instanceof Error ? err.message : "Unknown error";
        setError(`Failed to load navigation: ${errMsg}`);
      } finally {
        setLoading(false);
      }
    };

    loadRoot();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeBackend?.id, rig]);

  const handleToggle = useCallback(
    (path: string) => {
      togglePathExpansion(path);
    },
    [togglePathExpansion],
  );

  const handleNodeClick = useCallback(
    (node: NavigationNode) => {
      if (node.type === "directory") {
        handleToggle(node.path);
        navigate(routeForExplorerPath(node.path));
      } else {
        navigate(routeForExplorerPath(node.path));
      }
    },
    [navigate, handleToggle],
  );

  if (loading) {
    return (
      <div className="p-4 text-center text-muted-foreground">
        Loading navigation...
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-4 text-center text-destructive">Error: {error}</div>
    );
  }

  return (
    <div className="p-4 space-y-2">
      <div className="flex items-center space-x-2 text-sm font-medium mb-4">
        <Folder className="h-4 w-4" />
        <span>Root Directory</span>
      </div>
      <div className="space-y-1">
        {rootNodes.map((node) => (
          <TreeNode
            key={node.path}
            node={node}
            level={0}
            isExpanded={expandedPaths.has(node.path)}
            onToggle={() => handleToggle(node.path)}
            onClick={() => handleNodeClick(node)}
          />
        ))}
      </div>
      {rootNodes.length === 0 && (
        <div className="p-4 text-center text-muted-foreground">
          No paths found
        </div>
      )}
    </div>
  );
}

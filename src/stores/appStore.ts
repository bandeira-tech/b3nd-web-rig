import { create } from "zustand";
import { persist } from "zustand/middleware";
import { connection, Rig } from "@jsr/bandeira-tech__b3nd-core/rig";
import { Identity } from "@jsr/bandeira-tech__b3nd-core/identity";
import { WebSocketClient } from "@jsr/bandeira-tech__b3nd-move/ws/client";
import { clientForBaseUrl } from "../services/client";

// Derive `wss://host/api/v1/ws` from an `http(s)://host` base URL.
// Same hostname as the HTTP API — the WS endpoint is served by the
// same Worker, which proxies the upgrade to the DO.
function httpToWsUrl(baseUrl: string): string {
  const u = new URL(baseUrl);
  u.protocol = u.protocol === "https:" ? "wss:" : "ws:";
  u.pathname = (u.pathname.replace(/\/$/, "")) + "/api/v1/ws";
  return u.toString();
}
import {
  migrateKeyBundle,
  restoreIdentity,
} from "../services/editor/editorService";
import type {
  AppActions,
  AppExperience,
  AppMainView,
  AppMode,
  AppState,
  BackendConfig,
  EditorOutput,
  EditorSection,
  ExplorerSection,
  ManagedAccount,
  PanelState,
  ThemeMode,
} from "../types";
import { HttpAdapter } from "../adapters/HttpAdapter";
import { generateId, joinPath, sanitizePath } from "../utils";

// Serializable backend config for persistence
interface SerializableBackendConfig {
  id: string;
  name: string;
  type: "http";
  baseUrl: string;
  isActive: boolean;
}

interface InstancesConfig {
  defaults?: {
    backend?: string;
  };
  backends?: Record<string, { name?: string; baseUrl?: string }>;
}

// Load instance configuration
async function loadInstanceConfig(): Promise<InstancesConfig> {
  try {
    const response = await fetch("/instances.json");
    if (!response.ok) {
      throw new Error("Failed to load instances config");
    }
    return await response.json() as InstancesConfig;
  } catch (error) {
    console.error("Failed to load instances config:", error);
    return {
      defaults: { backend: "local-api" },
      backends: {
        "local-api": {
          name: "Local HTTP API",
          baseUrl: "http://localhost:9942",
        },
      },
    };
  }
}

async function loadAllEndpoints(): Promise<{
  backends: Array<
    { id: string; name: string; baseUrl: string; isActive: boolean }
  >;
  defaults: { backend?: string };
}> {
  const config = await loadInstanceConfig();

  const backends: Array<
    { id: string; name: string; baseUrl: string; isActive: boolean }
  > = [];
  if (config.backends) {
    const defaultBackendId = config.defaults?.backend;
    for (const id of Object.keys(config.backends)) {
      const entry = config.backends[id];
      if (!entry?.baseUrl) continue;
      backends.push({
        id,
        name: entry.name || id,
        baseUrl: entry.baseUrl,
        isActive: id === defaultBackendId,
      });
    }
  }

  return { backends, defaults: config.defaults || {} };
}

/**
 * Extract the schema-comparable prefix of a URI — protocol://hostname,
 * matching the shape that Rig.status().schema reports.
 */
function extractSchemaPrefix(uri: string): string {
  try {
    const url = new URL(uri);
    return `${url.protocol}//${url.hostname}`;
  } catch {
    return uri;
  }
}

/** Create a BackendConfig backed by a Rig instance. */
async function createBackendFromUrl(
  id: string,
  name: string,
  baseUrl: string,
  isActive: boolean,
): Promise<{ backend: BackendConfig; rig: Rig }> {
  const client = await clientForBaseUrl(baseUrl);
  const isHttp = baseUrl.startsWith("http://") || baseUrl.startsWith("https://");
  // Observe goes over the persistent WS so updates are live-pushed
  // by the DO instead of polled. Only wire it when the backend is an
  // HTTP node; `memory://` runs in-process and has no socket.
  const ws = isHttp
    ? new WebSocketClient({
      url: httpToWsUrl(baseUrl),
      reconnect: { enabled: true },
    })
    : null;
  const rig = new Rig({
    routes: {
      receive: [connection(client, ["**"])],
      read: [connection(client, ["**"])],
      ...(ws ? { observe: [connection(ws, ["**"])] } : {}),
    },
  });

  // Wire rig events → bottom-panel log
  rig.on("receive:success", (e) => {
    useAppStore.getState().addLogEntry({
      source: "rig",
      message: `receive ok: ${e.uri}`,
      level: "success",
    });
  });
  rig.on("receive:error", (e) => {
    useAppStore.getState().addLogEntry({
      source: "rig",
      message: `receive failed: ${e.uri ?? "unknown"} — ${e.error}`,
      level: "error",
    });
  });
  rig.on("read:error", (e) => {
    useAppStore.getState().addLogEntry({
      source: "rig",
      message: `read failed: ${e.uri ?? "unknown"} — ${e.error}`,
      level: "error",
    });
  });

  const adapter = new HttpAdapter(rig, baseUrl);
  return {
    backend: { id, name, adapter, isActive },
    rig,
  };
}

const initialState: Omit<AppState, "backendsReady"> = {
  backends: [],
  activeBackendId: null,
  schemas: {},
  rootNodes: [],
  currentPath: "/",
  explorerSection: "index" as ExplorerSection,
  explorerIndexPath: "/",
  explorerAccountKey: null,
  explorerAccountPath: "/",
  navigationHistory: ["/"],
  expandedPaths: new Set<string>(),
  panels: {
    left: true,
    right: true,
    bottom: false,
  },
  bottomMaximized: false,
  theme: "system" as ThemeMode,
  mode: "filesystem" as AppMode,
  activeApp: "explorer" as AppExperience,
  mainView: "content" as AppMainView,
  editorSection: "text" as EditorSection,
  editorLastResolvedUri: null,
  editorOutputs: [],
  accounts: [],
  activeAccountId: null,
  identity: null,
  formState: {},
  searchQuery: "",
  searchHistory: [],
  searchResults: [],
  watchedPaths: [],
  logs: [],
};

export interface AppStore extends AppState, AppActions {
  backendsReady: boolean;
  /** The active Rig instance — null until backends are loaded. Not persisted. */
  rig: Rig | null;
  panelPreferences: {
    right: Record<string, boolean>;
  };
}

export function rightPanelContextKey(state: AppState): string {
  if (state.mainView === "settings") return "settings";
  if (state.mainView === "accounts") return "accounts";
  if (state.activeApp === "editor") {
    return `editor:${state.editorSection}`;
  }
  if (state.activeApp === "explorer") {
    return `explorer:${state.mode}:${state.explorerSection}`;
  }
  return "global";
}

export const useAppStore = create<AppStore>()(
  persist(
    (set, get) => {
      return {
        ...initialState,
        backendsReady: false,
        rig: null,
        panelPreferences: { right: {} },

        addBackend: async (config) => {
          const baseUrl = config.adapter?.baseUrl || "";
          if (!baseUrl) {
            console.error("[addBackend] No baseUrl provided");
            return;
          }
          try {
            const id = generateId();
            const { backend } = await createBackendFromUrl(
              id,
              config.name,
              baseUrl,
              config.isActive,
            );
            (backend.adapter as HttpAdapter).isUserAdded = true;
            set((state) => ({
              backends: [...state.backends, backend],
            }));
          } catch (err) {
            console.error("[addBackend] Failed:", err);
          }
        },

        closeSettings: () => {
          set((state) => ({
            panels: { ...state.panels, right: false },
          }));
        },

        removeBackend: (id) => {
          set((state) => {
            const newBackends = state.backends.filter((b) => b.id !== id);
            return {
              backends: newBackends,
              activeBackendId:
                state.activeBackendId === id && newBackends.length > 0
                  ? newBackends[0].id
                  : state.activeBackendId,
            };
          });
        },

        setActiveBackend: async (id) => {
          const state = get();
          const backend = state.backends.find((b) => b.id === id);
          if (!backend) return;

          // Create new rig for this backend
          const baseUrl = backend.adapter.baseUrl || "";
          let rig: Rig | null = null;
          try {
            const client = await clientForBaseUrl(baseUrl);
            const isHttp = baseUrl.startsWith("http://") || baseUrl.startsWith("https://");
            const ws = isHttp
              ? new WebSocketClient({
                url: httpToWsUrl(baseUrl),
                reconnect: { enabled: true },
              })
              : null;
            rig = new Rig({
              routes: {
                receive: [connection(client, ["**"])],
                read: [connection(client, ["**"])],
                ...(ws ? { observe: [connection(ws, ["**"])] } : {}),
              },
            });
            (backend.adapter as HttpAdapter).setClient(rig);
          } catch (err) {
            console.error("[setActiveBackend] Failed to create rig:", err);
          }

          set(() => {
            const updatedBackends = state.backends.map((b) => ({
              ...b,
              isActive: b.id === id,
            }));
            return {
              backends: updatedBackends,
              activeBackendId: id,
              rig,
              currentPath: "/",
              explorerSection: "index" as ExplorerSection,
              explorerIndexPath: "/",
              explorerAccountPath: "/",
              navigationHistory: ["/"],
              expandedPaths: new Set(),
              schemas: {},
              rootNodes: [],
            };
          });

          get().loadSchemas();
        },

        loadSchemas: async () => {
          const state = get();
          const rig = state.rig;
          if (!rig) {
            console.warn("[loadSchemas] No active rig");
            return;
          }

          try {
            const timeoutPromise = new Promise<never>((_, reject) => {
              setTimeout(
                () => reject(new Error("Schema fetch timeout after 10s")),
                10000,
              );
            });

            const status = await Promise.race([
              rig.status(),
              timeoutPromise,
            ]);

            const schemaUris = Array.isArray(status.schema)
              ? status.schema
              : [];
            const schemasByInstance: Record<string, string[]> = {
              default: schemaUris,
            };

            const allSchemaUris = new Set<string>(schemaUris);
            const nodes: import("../types").NavigationNode[] = [];
            for (const uri of allSchemaUris) {
              try {
                const url = new URL(uri);
                const protocol = url.protocol.replace(":", "");
                const domain = url.hostname;
                const path = `/${protocol}/${domain}`;
                nodes.push({
                  path,
                  name: `${protocol}://${domain}`,
                  type: "directory",
                });
              } catch (error) {
                console.error(
                  `[loadSchemas] Failed to parse schema URI: ${uri}`,
                  error,
                );
              }
            }

            set({ schemas: schemasByInstance, rootNodes: nodes });
          } catch (error) {
            console.error("[loadSchemas] Failed to load schemas:", error);
            set({ schemas: {}, rootNodes: [] });
          }
        },

        navigateToPath: (path, options) => {
          set((state) => {
            const section: ExplorerSection = options?.section ||
              state.explorerSection || "index";
            const nextHistory = [...state.navigationHistory];
            const normalized = sanitizePath(path);

            if (section === "account") {
              const accountKey = options?.accountKey ||
                state.explorerAccountKey;
              if (!accountKey) {
                throw new Error(
                  "Account key is required when navigating account explorer paths",
                );
              }
              const segments = normalized.split("/").filter(Boolean);
              if (segments.length === 0) {
                if (nextHistory[nextHistory.length - 1] !== "/") {
                  nextHistory.push("/");
                }
                if (nextHistory.length > 50) nextHistory.shift();
                return {
                  explorerSection: "account" as ExplorerSection,
                  explorerAccountKey: accountKey,
                  explorerAccountPath: "/",
                  currentPath: "/",
                  navigationHistory: nextHistory,
                  mainView: "content",
                };
              }

              const hasProtocol = segments[0] === "mutable" ||
                segments[0] === "immutable";
              const protocol = hasProtocol ? segments[0] : "mutable";
              const remainder = hasProtocol ? segments.slice(1) : segments;
              const resolved = joinPath(
                protocol,
                "accounts",
                accountKey,
                ...remainder,
              );
              const storedPath = "/" +
                [protocol, ...remainder].filter(Boolean).join("/");
              if (nextHistory[nextHistory.length - 1] !== resolved) {
                nextHistory.push(resolved);
              }
              if (nextHistory.length > 50) nextHistory.shift();
              return {
                explorerSection: "account" as ExplorerSection,
                explorerAccountKey: accountKey,
                explorerAccountPath: storedPath,
                currentPath: resolved,
                navigationHistory: nextHistory,
                mainView: "content",
              };
            }

            if (nextHistory[nextHistory.length - 1] !== normalized) {
              nextHistory.push(normalized);
            }
            if (nextHistory.length > 50) nextHistory.shift();

            return {
              explorerSection: "index" as ExplorerSection,
              explorerIndexPath: normalized,
              currentPath: normalized,
              navigationHistory: nextHistory,
              mainView: "content",
            };
          });
        },

        setExplorerSection: (section: ExplorerSection) => {
          set((state) => {
            if (section === "account") {
              if (!state.explorerAccountKey) {
                return { explorerSection: section, currentPath: "/" };
              }
              const normalized = sanitizePath(state.explorerAccountPath || "/");
              const resolved = joinPath(
                "mutable",
                "accounts",
                state.explorerAccountKey,
                normalized === "/" ? "" : normalized,
              );
              return { explorerSection: section, currentPath: resolved };
            }
            const nextPath = sanitizePath(state.explorerIndexPath || "/");
            return { explorerSection: section, currentPath: nextPath };
          });
        },

        setExplorerIndexPath: (path: string) => {
          set((state) => {
            const normalized = sanitizePath(path);
            const history = [...state.navigationHistory];
            if (history[history.length - 1] !== normalized) {
              history.push(normalized);
            }
            if (history.length > 50) history.shift();
            return {
              explorerIndexPath: normalized,
              currentPath: state.explorerSection === "index"
                ? normalized
                : state.currentPath,
              navigationHistory: history,
            };
          });
        },

        setExplorerAccountKey: (accountKey: string | null) => {
          set((state) => {
            if (!accountKey) {
              return {
                explorerAccountKey: null,
                currentPath: state.explorerSection === "account"
                  ? "/"
                  : state.currentPath,
              };
            }
            const normalizedPath = sanitizePath(
              state.explorerAccountPath || "/",
            );
            const resolved = joinPath(
              "mutable",
              "accounts",
              accountKey,
              normalizedPath === "/" ? "" : normalizedPath,
            );
            return {
              explorerAccountKey: accountKey,
              currentPath: state.explorerSection === "account"
                ? resolved
                : state.currentPath,
            };
          });
        },

        setExplorerAccountPath: (path: string) => {
          set((state) => {
            const normalized = sanitizePath(path);
            const history = [...state.navigationHistory];
            const accountKey = state.explorerAccountKey;
            if (!accountKey) {
              throw new Error(
                "Account key is required when setting the account explorer path",
              );
            }
            const segments = normalized.split("/").filter(Boolean);
            if (segments.length === 0) {
              if (history[history.length - 1] !== "/") {
                history.push("/");
              }
              if (history.length > 50) history.shift();
              return {
                explorerAccountPath: "/",
                currentPath: state.explorerSection === "account"
                  ? "/"
                  : state.currentPath,
                navigationHistory: history,
              };
            }
            const hasProtocol = segments[0] === "mutable" ||
              segments[0] === "immutable";
            const protocol = hasProtocol ? segments[0] : "mutable";
            const remainder = hasProtocol ? segments.slice(1) : segments;
            const resolved = joinPath(
              protocol,
              "accounts",
              accountKey,
              ...remainder,
            );
            const storedPath = "/" +
              [protocol, ...remainder].filter(Boolean).join("/");
            if (history[history.length - 1] !== resolved) {
              history.push(resolved);
            }
            if (history.length > 50) history.shift();

            return {
              explorerAccountPath: storedPath,
              currentPath: state.explorerSection === "account"
                ? resolved
                : state.currentPath,
              navigationHistory: history,
            };
          });
        },

        togglePathExpansion: (path) => {
          set((state) => {
            const expanded = new Set(state.expandedPaths);
            if (expanded.has(path)) expanded.delete(path);
            else expanded.add(path);
            return { expandedPaths: expanded };
          });
        },

        goBack: () => {
          set((state) => {
            const history = [...state.navigationHistory];
            const currentIndex = history.lastIndexOf(state.currentPath);
            if (currentIndex > 0) {
              return { currentPath: history[currentIndex - 1] };
            }
            return state;
          });
        },

        goForward: () => {
          set((state) => {
            const history = [...state.navigationHistory];
            const currentIndex = history.lastIndexOf(state.currentPath);
            if (currentIndex < history.length - 1) {
              return { currentPath: history[currentIndex + 1] };
            }
            return state;
          });
        },

        togglePanel: (panel: keyof PanelState) => {
          set((state) => {
            if (panel === "right") {
              const key = rightPanelContextKey(state);
              const next = !state.panels.right;
              return {
                panels: { ...state.panels, right: next },
                panelPreferences: {
                  ...state.panelPreferences,
                  right: { ...state.panelPreferences.right, [key]: next },
                },
              };
            }
            return {
              panels: { ...state.panels, [panel]: !state.panels[panel] },
            };
          });
        },

        setPanelOpen: (panel: keyof PanelState, open: boolean) => {
          set((state) => {
            if (panel === "right") {
              const key = rightPanelContextKey(state);
              return {
                panels: { ...state.panels, right: open },
                panelPreferences: {
                  ...state.panelPreferences,
                  right: { ...state.panelPreferences.right, [key]: open },
                },
              };
            }
            return { panels: { ...state.panels, [panel]: open } };
          });
        },

        toggleBottomPanelMaximized: () => {
          set((state) => ({
            panels: { ...state.panels, bottom: true },
            bottomMaximized: !state.bottomMaximized,
          }));
        },

        ensureRightPanelOpen: () => {
          set((state) => {
            const key = rightPanelContextKey(state);
            if (state.panels.right) return state;
            return {
              panels: { ...state.panels, right: true },
              panelPreferences: {
                ...state.panelPreferences,
                right: { ...state.panelPreferences.right, [key]: true },
              },
            };
          });
        },

        applyRightPanelPreference: (keyOverride?: string) => {
          const currentState = get();
          const key = keyOverride || rightPanelContextKey(currentState);
          const preferred = currentState.panelPreferences.right[key];
          const next = preferred === undefined ? true : preferred;
          if (currentState.panels.right === next) return;
          set((state) => {
            if (state.panels.right === next) return state;
            return { panels: { ...state.panels, right: next } };
          });
        },

        setTheme: (theme: ThemeMode) => {
          set({ theme });
          const root = document.documentElement;
          if (theme === "dark") root.classList.add("dark");
          else if (theme === "light") root.classList.remove("dark");
          else {
            const isDark =
              window.matchMedia("(prefers-color-scheme: dark)").matches;
            root.classList.toggle("dark", isDark);
          }
        },

        setMode: (mode: AppMode) => {
          set({ mode });
          if (mode !== "search") set({ searchResults: [], searchQuery: "" });
        },

        setActiveApp: (activeApp: AppExperience) => {
          set(() => ({ activeApp }));
        },

        setMainView: (view: AppMainView) => {
          set({ mainView: view });
        },

        setEditorSection: (section: EditorSection) => {
          set(() => ({ editorSection: section, mainView: "content" }));
        },

        setEditorLastResolvedUri: (uri: string | null) => {
          set({ editorLastResolvedUri: uri });
        },

        addEditorOutput: (output: Omit<EditorOutput, "id" | "timestamp">) => {
          set((state) => ({
            editorOutputs: [
              { id: generateId(), timestamp: Date.now(), ...output },
              ...state.editorOutputs,
            ].slice(0, 200),
          }));
          // Refresh schemas when a write touches a prefix the rig hasn't
          // reported yet — MemoryStore (and other lazy backends) only list a
          // prefix in status().schema after it's been written to. Without
          // this the Explorer index stays empty until the next manual reload.
          if (output.accepted) {
            const state = get();
            const prefix = extractSchemaPrefix(output.uri);
            const known = Object.values(state.schemas)
              .flat()
              .some((u) => u === prefix || u.startsWith(prefix));
            if (!known) {
              void state.loadSchemas();
            }
          }
        },

        loadEndpoints: async () => {
          const { backends: rawBackends, defaults } = await loadAllEndpoints();

          const results = await Promise.allSettled(
            rawBackends.map((b) =>
              createBackendFromUrl(b.id, b.name, b.baseUrl, b.isActive)
            ),
          );
          const backends: BackendConfig[] = [];
          let activeRig: Rig | null = null;
          for (const r of results) {
            if (r.status === "fulfilled") backends.push(r.value.backend);
          }

          set((state) => {
            const nextBackends = state.backends.length
              ? state.backends
              : backends;

            const activeBackendId = (() => {
              const existing = nextBackends.find((b) =>
                b.id === state.activeBackendId
              )?.id;
              if (existing) return existing;
              const defaultBackend = nextBackends.find((b) => b.isActive) ||
                nextBackends.find((b) => b.id === defaults.backend);
              return defaultBackend?.id || nextBackends[0]?.id || null;
            })();

            for (const r of results) {
              if (
                r.status === "fulfilled" &&
                r.value.backend.id === activeBackendId
              ) {
                activeRig = r.value.rig;
                break;
              }
            }

            return {
              backends: nextBackends,
              rig: state.rig || activeRig,
              activeBackendId,
              backendsReady: true,
            };
          });
        },

        addAccount: (account: ManagedAccount) => {
          set((state) => ({
            accounts: [account, ...state.accounts],
            activeAccountId: account.id,
          }));
          if (account.exportedIdentity) {
            restoreIdentity(account.exportedIdentity).then((identity) => {
              set({ identity });
            }).catch((err) => {
              console.error("[addAccount] Failed to restore identity:", err);
            });
          }
        },

        removeAccount: (id: string) => {
          set((state) => {
            const nextAccounts = state.accounts.filter((a) => a.id !== id);
            const wasActive = state.activeAccountId === id;
            const nextActive = wasActive
              ? nextAccounts[0]?.id || null
              : state.activeAccountId;
            return {
              accounts: nextAccounts,
              activeAccountId: nextActive,
              identity: wasActive ? null : state.identity,
            };
          });
        },

        setActiveAccount: (id: string | null) => {
          set({ activeAccountId: id });
          if (!id) {
            set({ identity: null });
            return;
          }
          const state = get();
          const account = state.accounts.find((a) => a.id === id);
          if (account?.exportedIdentity) {
            restoreIdentity(account.exportedIdentity).then((identity) => {
              set({ identity });
            }).catch((err) => {
              console.error(
                "[setActiveAccount] Failed to restore identity:",
                err,
              );
            });
          }
        },

        setFormValue: (formId, field, value) => {
          set((state) => ({
            formState: {
              ...state.formState,
              [formId]: { ...(state.formState[formId] || {}), [field]: value },
            },
          }));
        },

        getFormValue: (formId, field, defaultValue = "") => {
          const form = get().formState[formId];
          return form && field in form ? form[field] : defaultValue;
        },

        resetForm: (formId) => {
          set((state) => {
            const next = { ...state.formState };
            delete next[formId];
            return { formState: next };
          });
        },

        setSearchQuery: (query: string) => {
          set({ searchQuery: query });
        },

        addToSearchHistory: (query: string) => {
          if (!query.trim()) return;
          set((state) => {
            const history = [...state.searchHistory];
            const existingIndex = history.indexOf(query);
            if (existingIndex >= 0) history.splice(existingIndex, 1);
            history.unshift(query);
            if (history.length > 20) history.pop();
            return { searchHistory: history };
          });
        },

        clearSearchResults: () => {
          set({ searchResults: [] });
        },

        addWatchedPath: (path: string) => {
          set((state) => {
            if (!state.watchedPaths.includes(path)) {
              return { watchedPaths: [...state.watchedPaths, path] };
            }
            return state;
          });
        },

        removeWatchedPath: (path: string) => {
          set((state) => ({
            watchedPaths: state.watchedPaths.filter((p) => p !== path),
          }));
        },

        addLogEntry: (entry) => {
          set((state) => {
            const timestamp = entry.timestamp ?? Date.now();
            const logEntry = { ...entry, timestamp };
            return { logs: [...state.logs, logEntry].slice(-300) };
          });
        },

        clearLogs: () => {
          set({ logs: [] });
        },
      } satisfies AppStore as AppStore;
    },
    {
      name: "b3nd-rig-state",
      partialize: (state) => {
        const userBackends: SerializableBackendConfig[] = state.backends
          .filter((b) =>
            b.adapter && b.adapter.type === "http" &&
            (b.adapter as HttpAdapter).isUserAdded
          )
          .map((b) => ({
            id: b.id,
            name: b.name,
            type: "http" as const,
            baseUrl: b.adapter.baseUrl || "",
            isActive: b.isActive,
          }));

        return {
          activeBackendId: state.activeBackendId,
          activeApp: state.activeApp,
          editorSection: state.editorSection,
          mainView: state.mainView,
          explorerSection: state.explorerSection,
          explorerIndexPath: state.explorerIndexPath,
          explorerAccountKey: state.explorerAccountKey,
          explorerAccountPath: state.explorerAccountPath,
          formState: state.formState,
          panels: state.panels,
          bottomMaximized: state.bottomMaximized,
          panelPreferences: state.panelPreferences,
          editorOutputs: state.editorOutputs,
          accounts: state.accounts,
          activeAccountId: state.activeAccountId,
          theme: state.theme,
          searchHistory: state.searchHistory,
          watchedPaths: state.watchedPaths,
          userBackends,
        };
      },
      onRehydrateStorage: () => async (state) => {
        const { backends: rawBackends, defaults } = await loadAllEndpoints();

        if (state) {
          const userBackends: SerializableBackendConfig[] =
            (state as unknown as { userBackends?: SerializableBackendConfig[] })
              .userBackends || [];

          const allRaw = [
            ...rawBackends.map((b) => ({ ...b, isUserAdded: false })),
            ...userBackends.map((b) => ({ ...b, isUserAdded: true })),
          ];

          const results = await Promise.allSettled(
            allRaw.map(async (b) => {
              const { backend, rig } = await createBackendFromUrl(
                b.id,
                b.name,
                b.baseUrl,
                b.isActive,
              );
              if (b.isUserAdded) {
                (backend.adapter as HttpAdapter).isUserAdded = true;
              }
              return { backend, rig };
            }),
          );

          const backends: BackendConfig[] = [];
          let activeRig: Rig | null = null;

          for (const r of results) {
            if (r.status === "fulfilled") {
              backends.push(r.value.backend);
            } else {
              console.error(
                "[onRehydrate] Failed to create backend:",
                r.reason,
              );
            }
          }

          state.backends = backends;
          const validBackendId = backends.find((b) =>
            b.id === state.activeBackendId
          )?.id;
          const defaultBackend = backends.find((b) => b.isActive) ||
            backends.find((b) => b.id === defaults.backend);
          state.activeBackendId = validBackendId || defaultBackend?.id ||
            backends[0]?.id || null;

          for (const r of results) {
            if (
              r.status === "fulfilled" &&
              r.value.backend.id === state.activeBackendId
            ) {
              activeRig = r.value.rig;
              break;
            }
          }
          state.rig = activeRig;

          const theme = state.theme || "system";
          const root = document.documentElement;
          if (theme === "dark") root.classList.add("dark");
          else if (theme === "light") root.classList.remove("dark");
          else {
            const isDark =
              window.matchMedia("(prefers-color-scheme: dark)").matches;
            root.classList.toggle("dark", isDark);
          }

          state.currentPath = "/";
          state.explorerSection = state.explorerSection || "index";
          state.explorerIndexPath = state.explorerIndexPath || "/";
          state.explorerAccountKey = state.explorerAccountKey || null;
          state.explorerAccountPath = state.explorerAccountPath || "/";
          state.navigationHistory = ["/"];
          state.expandedPaths = new Set();
          state.formState = state.formState || {};
          state.searchQuery = "";
          state.searchResults = [];
          state.mode = "filesystem";
          state.activeApp = state.activeApp || "explorer";
          state.editorSection = state.editorSection || "text";
          state.bottomMaximized = state.bottomMaximized || false;
          state.editorLastResolvedUri = state.editorLastResolvedUri || null;
          state.editorOutputs = state.editorOutputs || [];
          state.accounts = state.accounts || [];
          state.activeAccountId = state.activeAccountId || null;
          state.identity = null;
          state.panels = state.panels ||
            { left: true, right: true, bottom: false };
          state.panelPreferences = state.panelPreferences || { right: {} };
          state.mainView = state.mainView || "content";
          state.logs = [];
          state.schemas = {};
          state.rootNodes = [];

          // Migrate legacy accounts: keyBundle → exportedIdentity
          if (state.accounts) {
            state.accounts = state.accounts.map((acct) => {
              const legacyKb = (acct as ManagedAccount & { keyBundle?: import("../types").KeyBundle }).keyBundle;
              if (!acct.exportedIdentity && legacyKb) {
                const exported = migrateKeyBundle(legacyKb);
                return {
                  ...acct,
                  pubkey: exported.signingPublicKeyHex,
                  encryptionPubkey: exported.encryptionPublicKeyHex,
                  exportedIdentity: exported,
                };
              }
              return acct;
            });
          }

          state.backendsReady = true;

          setTimeout(async () => {
            const store = useAppStore.getState();
            store.loadSchemas();
            // Restore identity from active account
            if (store.activeAccountId) {
              const account = store.accounts.find((a) =>
                a.id === store.activeAccountId
              );
              if (account?.exportedIdentity) {
                try {
                  const identity = await Identity.fromExport(
                    account.exportedIdentity,
                  );
                  useAppStore.setState({ identity });
                } catch (err) {
                  console.error("[rehydrate] Failed to set identity:", err);
                }
              }
            }
          }, 0);
        } else {
          // Fresh state — create rig-backed backends
          const freshResults = await Promise.allSettled(
            rawBackends.map((b) =>
              createBackendFromUrl(b.id, b.name, b.baseUrl, b.isActive)
            ),
          );
          const freshBackends: BackendConfig[] = [];
          let freshRig: Rig | null = null;
          for (const r of freshResults) {
            if (r.status === "fulfilled") {
              freshBackends.push(r.value.backend);
            }
          }
          const freshActiveId = freshBackends.find((b) => b.isActive)?.id ||
            freshBackends.find((b) => b.id === defaults.backend)?.id ||
            freshBackends[0]?.id ||
            null;
          for (const r of freshResults) {
            if (
              r.status === "fulfilled" && r.value.backend.id === freshActiveId
            ) {
              freshRig = r.value.rig;
              break;
            }
          }

          useAppStore.setState({
            backends: freshBackends,
            activeBackendId: freshActiveId,
            rig: freshRig,
            explorerSection: "index",
            explorerIndexPath: "/",
            explorerAccountKey: null,
            explorerAccountPath: "/",
            backendsReady: true,
          });
        }
      },
    },
  ),
);

export const useActiveBackend = () => {
  const { backends, activeBackendId } = useAppStore();
  return backends.find((b) => b.id === activeBackendId) || null;
};

// E2E test hook: lets Playwright drive the same Rig instance the UI uses,
// for seeding data and asserting state without round-tripping through the DOM.
if (typeof window !== "undefined") {
  (window as unknown as { __b3ndStore: typeof useAppStore }).__b3ndStore =
    useAppStore;
}

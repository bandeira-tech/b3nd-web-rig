import type { Identity } from "@jsr/bandeira-tech__b3nd-core/identity";

// Navigation and UI types
export interface NavigationNode {
  path: string; // Primary identifier (e.g., "/users/alice/profile")
  name: string; // Display name (last segment of path)
  type: "directory" | "file";
  children?: NavigationNode[]; // Lazy-loaded via listPath
}

export interface SearchResult {
  path: string;
  name: string;
  record: { data: unknown };
  snippet?: string;
}

export type ExplorerSection = "index" | "account";

export interface SearchFilters {
  protocol?: string;
  domain?: string;
  pathPattern?: string;
  dataType?: string;
  dateRange?: {
    start: Date;
    end: Date;
  };
}

// Pagination
export interface PaginatedResponse<T> {
  data: T[];
  pagination: {
    page: number;
    limit: number;
  };
}

// Backend adapter interface
export interface BackendAdapter {
  name: string;
  type: "http";
  baseUrl?: string;

  // Core operations
  listPath(
    path: string,
    options?: { page?: number; limit?: number },
  ): Promise<PaginatedResponse<NavigationNode>>;
  readRecord(path: string): Promise<{ data: unknown }>;
  searchPaths(
    query: string,
    filters?: SearchFilters,
    options?: { page?: number; limit?: number },
  ): Promise<PaginatedResponse<SearchResult>>;

  // Metadata
  getStatus(): Promise<{
    status: "healthy" | "degraded" | "unhealthy";
    schema?: string[];
    message?: string;
  }>;
  healthCheck(): Promise<boolean>;
}

export interface BackendConfig {
  id: string;
  name: string;
  adapter: BackendAdapter;
  isActive: boolean;
}

// Application state types
export type AppMode = "filesystem" | "search" | "watched";
export type AppExperience =
  | "explorer"
  | "editor"
  | "nodes";

/**
 * Editor sections — the rig-level write surface.
 *  - text: URI template + plaintext payload
 *  - file: URI template + file bytes payload
 * Protocol-specific sections (auth, schema, etc.) belong in plugins.
 */
export type EditorSection = "text" | "file";

export type AppMainView = "content" | "settings" | "accounts";

export type ThemeMode = "light" | "dark" | "system";

export interface PanelState {
  left: boolean;
  right: boolean;
  bottom: boolean;
}

export interface AppLogEntry {
  timestamp: number;
  source: string;
  message: string;
  level?: "info" | "success" | "warning" | "error";
}

/**
 * @deprecated Use ExportedIdentity from the rig instead.
 * Kept only for migration of old persisted data.
 */
export interface KeyBundle {
  appKey: string;
  accountPrivateKeyPem: string;
  encryptionPublicKeyHex: string;
  encryptionPrivateKeyPem: string;
}

export interface ManagedAccount {
  id: string;
  name: string;
  createdAt: number;
  emoji: string;
  /** Signing public key hex — the account's address on the network. */
  pubkey: string;
  /** Encryption public key hex. */
  encryptionPubkey: string;
  /** Serialized identity for persistence (private keys included). */
  exportedIdentity: import("@jsr/bandeira-tech__b3nd-core/identity").ExportedIdentity;
  /**
   * @deprecated Legacy field. Use exportedIdentity + pubkey instead.
   * Present on accounts created before the migration.
   */
  keyBundle?: KeyBundle;
}

export interface EditorOutput {
  id: string;
  uri: string;
  data: unknown;
  timestamp: number;
  accepted: boolean;
  error?: string;
}

export interface AppState {
  // Backend management
  backends: BackendConfig[];
  activeBackendId: string | null;

  // Schema and root navigation
  schemas: Record<string, string[]>; // Schemas by instance: { instanceId: [uris] }
  rootNodes: NavigationNode[]; // Virtual root nodes built from schemas

  // Navigation
  currentPath: string;
  explorerSection: ExplorerSection;
  explorerIndexPath: string;
  explorerAccountKey: string | null;
  explorerAccountPath: string;
  navigationHistory: string[];
  expandedPaths: Set<string>;

  // UI state
  panels: PanelState;
  bottomMaximized: boolean;
  theme: ThemeMode;
  mode: AppMode;
  activeApp: AppExperience;
  mainView: AppMainView;
  editorSection: EditorSection;
  editorLastResolvedUri: string | null;
  editorOutputs: EditorOutput[];

  // Identity / accounts (rig is identity-free; the host owns it)
  accounts: ManagedAccount[];
  activeAccountId: string | null;
  identity: Identity | null;

  formState: Record<string, Record<string, string>>;

  // Search
  searchQuery: string;
  searchHistory: string[];
  searchResults: SearchResult[];

  // Watched paths
  watchedPaths: string[];

  // Logs
  logs: AppLogEntry[];
}

// Action types for state management
export interface AppActions {
  // Backend actions
  addBackend: (config: Omit<BackendConfig, "id">) => void | Promise<void>;
  removeBackend: (id: string) => void;
  setActiveBackend: (id: string) => void | Promise<void>;
  loadEndpoints: () => Promise<void>;
  closeSettings: () => void;

  // Schema actions
  loadSchemas: () => Promise<void>;

  // Navigation actions
  navigateToPath: (
    path: string,
    options?: { section?: ExplorerSection; accountKey?: string | null },
  ) => void;
  setExplorerSection: (section: ExplorerSection) => void;
  setExplorerIndexPath: (path: string) => void;
  setExplorerAccountKey: (accountKey: string | null) => void;
  setExplorerAccountPath: (path: string) => void;
  togglePathExpansion: (path: string) => void;
  goBack: () => void;
  goForward: () => void;

  // UI actions
  togglePanel: (panel: keyof PanelState) => void;
  setPanelOpen: (panel: keyof PanelState, open: boolean) => void;
  toggleBottomPanelMaximized: () => void;
  ensureRightPanelOpen: () => void;
  applyRightPanelPreference: () => void;
  setTheme: (theme: ThemeMode) => void;
  setMode: (mode: AppMode) => void;
  setActiveApp: (app: AppExperience) => void;
  setMainView: (view: AppMainView) => void;
  setEditorSection: (section: EditorSection) => void;
  setEditorLastResolvedUri: (uri: string | null) => void;
  addEditorOutput: (output: Omit<EditorOutput, "id" | "timestamp">) => void;
  addAccount: (account: ManagedAccount) => void;
  removeAccount: (id: string) => void;
  setActiveAccount: (id: string | null) => void;

  setFormValue: (formId: string, field: string, value: string) => void;
  getFormValue: (
    formId: string,
    field: string,
    defaultValue?: string,
  ) => string;
  resetForm: (formId: string) => void;

  // Search actions
  setSearchQuery: (query: string) => void;
  addToSearchHistory: (query: string) => void;
  clearSearchResults: () => void;

  // Watched paths actions
  addWatchedPath: (path: string) => void;
  removeWatchedPath: (path: string) => void;

  // Logs
  addLogEntry: (
    entry: Omit<AppLogEntry, "timestamp"> & { timestamp?: number },
  ) => void;
  clearLogs: () => void;
}

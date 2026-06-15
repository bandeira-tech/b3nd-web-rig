import type {
  BackendAdapter,
  NavigationNode,
  PaginatedResponse,
  SearchFilters,
  SearchResult,
} from "../types";
import type {
  Output,
  StatusResult,
} from "@jsr/bandeira-tech__b3nd-core/types";

/**
 * Media-level adapter that translates between Explorer UI paths
 * and b3nd URIs. Delegates all network operations to the provided client.
 *
 * The injected client satisfies `ProtocolInterfaceNode` — `read` returns
 * one `Output<T>` (= `[uri, payload]`) per input locator. A miss is
 * encoded as `payload == null` (the bytes-entity convention).
 */

interface ClientLike {
  read<T = unknown>(locators: string[]): Promise<Output<T>[]>;
  status(): Promise<StatusResult>;
}

export class HttpAdapter implements BackendAdapter {
  name = "HTTP Backend";
  type = "http" as const;
  baseUrl: string;
  /** Set when the backend was added by the user (vs. loaded from instances.json). */
  isUserAdded = false;
  private client: ClientLike;

  constructor(client: ClientLike, baseUrl: string) {
    this.baseUrl = baseUrl;
    this.client = client;
  }

  /** Swap the underlying client (e.g. on backend switch). */
  setClient(client: ClientLike) {
    this.client = client;
  }

  async listPath(
    path: string,
    options?: { page?: number; limit?: number },
  ): Promise<PaginatedResponse<NavigationNode>> {
    if (path === "/" || path === "") {
      throw new Error(
        "Root path should be handled by schema-driven navigation, not listPath",
      );
    }

    const uri = this.pathToUri(path);
    let listUri = uri;
    if (!listUri.endsWith("://") && !listUri.endsWith("/")) {
      listUri = listUri + "/";
    }
    const results = await this.client.read<unknown>([listUri]);
    const tuple = results[0];
    if (!tuple) throw new Error(`Failed to list ${path}: no result`);
    const payload = tuple[1];
    // `ls` payload is `Output[]` = `[childUri, childPayload][]`
    // (or `string[]` when format=uris). Map either into nav nodes.
    const rawItems: Array<unknown> = Array.isArray(payload) ? payload : [];
    const items = rawItems.map((entry): { uri: string; type: "file" | "directory" } => {
      if (Array.isArray(entry) && typeof entry[0] === "string") {
        return { uri: entry[0], type: entry[0].endsWith("/") ? "directory" : "file" };
      }
      if (typeof entry === "string") {
        return { uri: entry, type: entry.endsWith("/") ? "directory" : "file" };
      }
      const obj = entry as { uri?: string; type?: "file" | "directory" };
      return { uri: obj.uri ?? "", type: obj.type ?? "file" };
    }).filter((it) => it.uri);
    return {
      data: items.map((item) => ({
        path: this.uriToPath(item.uri),
        name: this.extractNameFromUri(item.uri),
        type: item.type,
        children: undefined,
      })),
      pagination: {
        page: options?.page || 1,
        limit: options?.limit || items.length,
      },
    };
  }

  async readRecord(path: string): Promise<{ data: unknown }> {
    const uri = this.pathToUri(path);
    const results = await this.client.read<unknown>([uri]);
    const tuple = results[0];
    if (!tuple || tuple[1] == null) {
      throw new Error(`Record not found: ${path}`);
    }
    return { data: tuple[1] };
  }

  searchPaths(
    _query: string,
    _filters?: SearchFilters,
    options?: { page?: number; limit?: number },
  ): Promise<PaginatedResponse<SearchResult>> {
    return Promise.resolve({
      data: [],
      pagination: {
        page: options?.page || 1,
        limit: options?.limit || 20,
      },
    });
  }

  async getStatus(): Promise<StatusResult> {
    return await this.client.status();
  }

  async healthCheck(): Promise<boolean> {
    const result = await this.client.status();
    return result.status === "healthy";
  }

  /** Build a direct HTTP API read URL for a given explorer path. */
  getReadUrl(path: string): string {
    // Root has no URI — render the schema-index page instead of throwing.
    if (path === "/" || path === "") return this.baseUrl;
    const uri = this.pathToUri(path);
    const url = new URL(uri);
    const protocol = url.protocol.replace(":", "");
    const domain = url.hostname;
    const recordPath = url.pathname;
    return `${this.baseUrl}/api/v1/read/${protocol}/${domain}${recordPath}`;
  }

  // Helper: Convert "/users/alice/profile" -> "users://alice/profile"
  private pathToUri(path: string): string {
    const parts = path.split("/").filter(Boolean);
    if (parts.length === 0) {
      throw new Error(
        "Cannot convert root path '/' to URI - use schema-driven navigation",
      );
    }
    if (parts.length === 1) {
      return `${parts[0]}://`;
    }
    const protocol = parts[0];
    const domain = parts[1];
    const subpath = "/" + parts.slice(2).join("/");
    return `${protocol}://${domain}${subpath}`;
  }

  private uriToPath(uri: string): string {
    const url = new URL(uri);
    return `/${url.protocol.replace(":", "")}/${url.hostname}${url.pathname}`;
  }

  private extractNameFromUri(uri: string): string {
    const url = new URL(uri);
    const pathname = url.pathname;
    if (pathname && pathname !== "/") {
      const segments = pathname.split("/").filter(Boolean);
      return segments[segments.length - 1];
    }
    return url.hostname || "unnamed";
  }
}

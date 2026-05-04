import type {
  BackendAdapter,
  NavigationNode,
  PaginatedResponse,
  SearchFilters,
  SearchResult,
} from "../types";
import type { StatusResult } from "@bandeira-tech/b3nd-core/types";

/**
 * Media-level adapter that translates between Explorer UI paths
 * and b3nd URIs. Delegates all network operations to the provided client.
 */

interface ClientLike {
  read<T = unknown>(
    uris: string | string[],
  ): Promise<
    Array<{ success: boolean; record?: { data: T }; error?: string }>
  >;
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
    const results = await this.client.read(listUri);
    const result = results[0];

    if (!result?.success) {
      throw new Error(
        `Failed to list ${path}: ${result?.error ?? "no result"}`,
      );
    }

    const data = result.record?.data;
    const items: Array<{ uri: string; type: "file" | "directory" }> =
      Array.isArray(data) ? data : [];
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
    const results = await this.client.read(uri);
    const result = results[0];

    if (!result?.success || !result.record) {
      throw new Error(`Record not found: ${path}`);
    }
    return result.record;
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

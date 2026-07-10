import { HttpClient } from "@jsr/bandeira-tech__b3nd-move/http/client";
import { httpOutputsFrame } from "@jsr/bandeira-tech__b3nd-move/codecs/http";
import { BYTES_ENTITY } from "@jsr/bandeira-tech__b3nd-save";
import { mapToBytes, SaveClient } from "@jsr/bandeira-tech__b3nd-save/clients";
import { MemoryStore } from "@jsr/bandeira-tech__b3nd-save/memory";
import type { ProtocolInterfaceNode } from "@jsr/bandeira-tech__b3nd-core/types";

/**
 * Build a `ProtocolInterfaceNode` from a baseUrl, dispatching by scheme.
 *
 * - `http://` / `https://` → `HttpClient` from b3nd-move
 * - `memory://`            → in-process `SaveClient` over `MemoryStore`
 *                            (BYTES_ENTITY, opaque-bytes mode)
 *
 * Replaces the legacy `createClientFromUrl` from b3nd-core 0.14 — in
 * 0.22, storage clients moved to b3nd-save and transport clients to
 * b3nd-move, so the host owns the dispatch.
 */
export async function clientForBaseUrl(
  baseUrl: string,
): Promise<ProtocolInterfaceNode> {
  if (baseUrl.startsWith("http://") || baseUrl.startsWith("https://")) {
    return new HttpClient({ url: baseUrl, codec: httpOutputsFrame() });
  }
  if (baseUrl.startsWith("memory://")) {
    const store = new MemoryStore();
    await store.provisionEntity(store.entitySupport(BYTES_ENTITY));
    return new SaveClient(mapToBytes, BYTES_ENTITY, store);
  }
  throw new Error(`Unsupported backend scheme: ${baseUrl}`);
}

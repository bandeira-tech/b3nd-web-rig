import type { RigSlot } from "./types";

/**
 * The wire protocol between an HTML-mounted app (inside a sandboxed
 * iframe) and the parent rig.
 *
 * Inbound (iframe → parent):
 *   { kind: "b3nd-slot", id: number, op: "basePath", args?: undefined }
 *   { kind: "b3nd-slot", id: number, op: "resolve", args: { key: string } }
 *   { kind: "b3nd-slot", id: number, op: "list", args: { key?: string } }
 *   { kind: "b3nd-slot", id: number, op: "read", args: { key: string | string[] } }
 *   { kind: "b3nd-slot", id: number, op: "write", args: { key: string, data: unknown } }
 *
 * Outbound (parent → iframe):
 *   { kind: "b3nd-slot-reply", id: number, ok: true, result: unknown }
 *   { kind: "b3nd-slot-reply", id: number, ok: false, error: string }
 *
 * A `kind: "b3nd-slot-init"` message is sent once when the iframe loads,
 * carrying `{ basePath }` so the app can render before issuing any ops.
 */

export const SLOT_MESSAGE_KIND = "b3nd-slot" as const;
export const SLOT_REPLY_KIND = "b3nd-slot-reply" as const;
export const SLOT_INIT_KIND = "b3nd-slot-init" as const;

export type SlotOp = "basePath" | "resolve" | "list" | "read" | "write";

export interface SlotRequest {
  kind: typeof SLOT_MESSAGE_KIND;
  id: number;
  op: SlotOp;
  args?: { key?: string | string[]; data?: unknown };
}

export type SlotReply =
  | { kind: typeof SLOT_REPLY_KIND; id: number; ok: true; result: unknown }
  | { kind: typeof SLOT_REPLY_KIND; id: number; ok: false; error: string };

export interface SlotInit {
  kind: typeof SLOT_INIT_KIND;
  basePath: string;
}

/**
 * Dispatch a parsed request against a {@link RigSlot}. Centralised so
 * AppHost stays small and so a non-browser test can exercise the same
 * routing without a real iframe.
 */
export async function handleSlotRequest(
  slot: RigSlot,
  request: SlotRequest,
): Promise<SlotReply> {
  try {
    switch (request.op) {
      case "basePath":
        return { kind: SLOT_REPLY_KIND, id: request.id, ok: true, result: slot.basePath };
      case "resolve": {
        const key = request.args?.key;
        if (typeof key !== "string") throw new Error("resolve: key must be a string");
        return { kind: SLOT_REPLY_KIND, id: request.id, ok: true, result: slot.resolve(key) };
      }
      case "list": {
        const key = request.args?.key;
        if (key !== undefined && typeof key !== "string") {
          throw new Error("list: key must be a string when provided");
        }
        const items = await slot.list(key ?? "");
        return { kind: SLOT_REPLY_KIND, id: request.id, ok: true, result: items };
      }
      case "read": {
        const key = request.args?.key;
        if (key === undefined) throw new Error("read: key is required");
        if (typeof key !== "string" && !Array.isArray(key)) {
          throw new Error("read: key must be a string or string[]");
        }
        const records = await slot.read(key);
        return { kind: SLOT_REPLY_KIND, id: request.id, ok: true, result: records };
      }
      case "write": {
        const key = request.args?.key;
        if (typeof key !== "string") throw new Error("write: key must be a string");
        const result = await slot.write(key, request.args?.data);
        return { kind: SLOT_REPLY_KIND, id: request.id, ok: true, result };
      }
      default:
        throw new Error(`Unsupported op: ${(request as { op?: string }).op}`);
    }
  } catch (err) {
    return {
      kind: SLOT_REPLY_KIND,
      id: request.id,
      ok: false,
      error: err instanceof Error ? err.message : String(err),
    };
  }
}

/**
 * Loose validation: an inbound message is a SlotRequest if it has the
 * right kind, a numeric id, and a known op. We do NOT trust args here —
 * handleSlotRequest validates them per-op.
 */
export function isSlotRequest(value: unknown): value is SlotRequest {
  if (!value || typeof value !== "object") return false;
  const v = value as Record<string, unknown>;
  if (v.kind !== SLOT_MESSAGE_KIND) return false;
  if (typeof v.id !== "number") return false;
  if (typeof v.op !== "string") return false;
  return ["basePath", "resolve", "list", "read", "write"].includes(v.op);
}

/**
 * The bootstrap script injected at the top of every HTML-mounted app.
 * Exposes `window.b3ndSlot` so apps don't need to ship a bridge.
 * Returned as a plain string so it can be inlined into srcDoc.
 */
export const BOOTSTRAP_SCRIPT = `
(function () {
  var pending = new Map();
  var nextId = 0;
  var basePathPromise = new Promise(function (resolve) {
    window.addEventListener("message", function once(e) {
      var d = e.data;
      if (d && d.kind === "${SLOT_INIT_KIND}") {
        window.removeEventListener("message", once);
        resolve(d.basePath);
      }
    });
  });
  window.addEventListener("message", function (e) {
    var d = e.data;
    if (!d || d.kind !== "${SLOT_REPLY_KIND}") return;
    var p = pending.get(d.id);
    if (!p) return;
    pending.delete(d.id);
    if (d.ok) p.resolve(d.result);
    else p.reject(new Error(d.error || "slot error"));
  });
  function call(op, args) {
    return new Promise(function (resolve, reject) {
      var id = ++nextId;
      pending.set(id, { resolve: resolve, reject: reject });
      window.parent.postMessage({
        kind: "${SLOT_MESSAGE_KIND}",
        id: id,
        op: op,
        args: args
      }, "*");
    });
  }
  window.b3ndSlot = {
    basePath: function () { return basePathPromise; },
    resolve: function (key) { return call("resolve", { key: key }); },
    list: function (key) { return call("list", { key: key }); },
    read: function (key) { return call("read", { key: key }); },
    write: function (key, data) { return call("write", { key: key, data: data }); }
  };
  window.dispatchEvent(new Event("b3nd-slot-ready"));
})();
`;

/**
 * Wrap user-authored HTML with the bootstrap script. Cheap textual splice:
 * insert right after <head> if present, otherwise prepend to the body.
 */
export function injectBootstrap(html: string): string {
  const script = `<script>${BOOTSTRAP_SCRIPT}</script>`;
  if (/<head[^>]*>/i.test(html)) {
    return html.replace(/<head[^>]*>/i, (m) => `${m}\n${script}`);
  }
  if (/<body[^>]*>/i.test(html)) {
    return html.replace(/<body[^>]*>/i, (m) => `${m}\n${script}`);
  }
  return `${script}\n${html}`;
}

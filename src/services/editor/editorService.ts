import { Identity } from "@bandeira-tech/b3nd-core/identity";
import type { ExportedIdentity } from "@bandeira-tech/b3nd-core/identity";
import * as encrypt from "@bandeira-tech/b3nd-core/encrypt";
import type { Output, ReceiveResult } from "@bandeira-tech/b3nd-core/types";
import type { KeyBundle } from "../../types";
import { resolveUriTemplate } from "./uriTemplate";

/**
 * Minimal node interface needed by the editor — satisfied by the Rig
 * (which returns an `OperationHandle`, a `PromiseLike<ReceiveResult[]>`)
 * and any other `ProtocolInterfaceNode` implementation.
 *
 * Payloads on receive must be `Uint8Array` (the move layer is opaque
 * past the URI — the producing app encodes).
 */
export interface BackendClient {
  receive(msgs: Output[]): PromiseLike<ReceiveResult[]>;
  read<T = unknown>(locators: string[]): Promise<Output<T>[]>;
}

function encodePayload(value: unknown): Uint8Array {
  if (value instanceof Uint8Array) return value;
  return new TextEncoder().encode(JSON.stringify(value));
}

// ── Identity helpers ──

export const generateAccountIdentity = async (): Promise<{
  identity: Identity;
  exported: ExportedIdentity;
  pubkey: string;
  encryptionPubkey: string;
}> => {
  const identity = await Identity.generate();
  const exported = await identity.export();
  return {
    identity,
    exported,
    pubkey: identity.pubkey,
    encryptionPubkey: identity.encryptionPubkey,
  };
};

function pemToHex(pem: string): string {
  const b64 = pem.replace(/-----[^-]+-----/g, "").replace(/\s+/g, "");
  const bytes = Uint8Array.from(atob(b64), (ch) => ch.charCodeAt(0));
  return Array.from(bytes).map((b) => b.toString(16).padStart(2, "0")).join("");
}

/** @deprecated Migrate a legacy KeyBundle to ExportedIdentity. */
export function migrateKeyBundle(kb: KeyBundle): ExportedIdentity {
  return {
    signingPublicKeyHex: kb.appKey,
    signingPrivateKeyHex: pemToHex(kb.accountPrivateKeyPem),
    encryptionPublicKeyHex: kb.encryptionPublicKeyHex,
    encryptionPrivateKeyHex: kb.encryptionPrivateKeyPem
      ? pemToHex(kb.encryptionPrivateKeyPem)
      : undefined,
  };
}

/** Reconstruct an Identity from an ExportedIdentity or legacy KeyBundle. */
export const restoreIdentity = async (
  source: ExportedIdentity | KeyBundle,
): Promise<Identity> => {
  if ("appKey" in source) {
    return Identity.fromExport(migrateKeyBundle(source as KeyBundle));
  }
  return Identity.fromExport(source as ExportedIdentity);
};

// ── Plain write ──

export interface PlainWriteParams {
  client: BackendClient;
  identity: Identity | null;
  /** URI template — may contain `:account`, `:hash`, `:signature`. */
  uriTemplate: string;
  /** Payload as a JS value. Strings, numbers, objects, arrays — all OK. */
  payload: unknown;
  /** When set, encrypt the payload to this recipient pubkey before sending. */
  encryptToPublicKey?: string;
}

export interface WriteResult {
  resolvedUri: string;
  content: unknown;
  encrypted: boolean;
  accepted: boolean;
  error?: string;
}

/**
 * Resolve URI template, optionally encrypt, send via rig.receive.
 * No signed-envelope wrapping — protocols add that via plugins.
 */
export async function writePlain(params: PlainWriteParams): Promise<WriteResult> {
  const { client, identity, uriTemplate, payload, encryptToPublicKey } = params;

  let content: unknown = payload;
  let encrypted = false;
  if (encryptToPublicKey) {
    const bytes = new TextEncoder().encode(JSON.stringify(payload));
    content = await encrypt.encrypt(bytes, encryptToPublicKey);
    encrypted = true;
  }

  const resolvedUri = await resolveUriTemplate(uriTemplate, {
    identity,
    content,
  });

  const [response] = await client.receive([[resolvedUri, encodePayload(content)]]);
  return {
    resolvedUri,
    content,
    encrypted,
    accepted: response.accepted,
    error: response.error,
  };
}

// ── File helpers ──

export async function readFileAsBytes(file: File): Promise<Uint8Array> {
  const arrayBuffer = await file.arrayBuffer();
  return new Uint8Array(arrayBuffer);
}

export async function readFileAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });
}

// ── File write ──

export interface FileWriteParams {
  client: BackendClient;
  identity: Identity | null;
  uriTemplate: string;
  file: File;
  encryptToPublicKey?: string;
}

export interface FileWriteResult extends WriteResult {
  fileName: string;
  fileSize: number;
  contentType: string;
}

/**
 * Upload a file as the payload at a user-supplied URI template.
 *
 * The wrapper packs `{ type, name, size, data }` (data as a data-URL)
 * so the file survives JSON transport. When `encryptToPublicKey` is
 * set, the wrapper itself is encrypted.
 */
export async function writeFile(params: FileWriteParams): Promise<FileWriteResult> {
  const { client, identity, uriTemplate, file, encryptToPublicKey } = params;

  const dataUrl = await readFileAsDataUrl(file);
  const wrapper = {
    type: file.type,
    name: file.name,
    size: file.size,
    data: dataUrl,
  };

  let content: unknown = wrapper;
  let encrypted = false;
  if (encryptToPublicKey) {
    const bytes = new TextEncoder().encode(JSON.stringify(wrapper));
    content = await encrypt.encrypt(bytes, encryptToPublicKey);
    encrypted = true;
  }

  const resolvedUri = await resolveUriTemplate(uriTemplate, {
    identity,
    content,
  });

  const [response] = await client.receive([[resolvedUri, encodePayload(content)]]);
  return {
    resolvedUri,
    content,
    encrypted,
    accepted: response.accepted,
    error: response.error,
    fileName: file.name,
    fileSize: file.size,
    contentType: file.type,
  };
}

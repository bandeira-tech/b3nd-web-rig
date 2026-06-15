import type { Identity } from "@jsr/bandeira-tech__b3nd-core/identity";
import { computeSha256 } from "@jsr/bandeira-tech__b3nd-core/hash";

/**
 * Tokens that can appear in a URI template.
 *
 * The default rig editor supports the lowest-common-denominator set;
 * protocol plugins can register additional tokens via {@link extendUriTemplate}.
 *
 *  - `:account`   — current identity's public key (hex)
 *  - `:hash`      — sha256 of the resolved content (post-encryption), hex
 *  - `:signature` — ed25519 signature over `:hash`, hex
 */
export type UriTemplateToken = "account" | "hash" | "signature";

export interface UriTemplateContext {
  identity: Identity | null;
  /**
   * The content as it will be sent on the wire — already encrypted if
   * the caller chose to encrypt. Used to derive `:hash` and (via hash)
   * `:signature`.
   */
  content: unknown;
}

export interface UriTemplateResolver {
  (ctx: UriTemplateContext): Promise<string> | string;
}

const builtins: Record<UriTemplateToken, UriTemplateResolver> = {
  account: ({ identity }) => {
    if (!identity) {
      throw new Error(":account requires an active identity");
    }
    return identity.pubkey;
  },
  hash: async ({ content }) => await computeSha256(content),
  signature: async ({ identity, content }) => {
    if (!identity) {
      throw new Error(":signature requires an active identity");
    }
    const hash = await computeSha256(content);
    const result = await identity.sign(hash);
    return result.signature;
  },
};

const extras: Record<string, UriTemplateResolver> = {};

/** Register a custom token (e.g. for a protocol plugin). */
export function extendUriTemplate(
  token: string,
  resolver: UriTemplateResolver,
): void {
  if (token in builtins) {
    throw new Error(`Cannot override built-in token :${token}`);
  }
  extras[token] = resolver;
}

/** List the tokens present in a template, in order of appearance. */
export function findTokens(template: string): string[] {
  const matches = template.matchAll(/:([a-zA-Z][a-zA-Z0-9_]*)/g);
  const tokens: string[] = [];
  for (const m of matches) tokens.push(m[1]);
  return tokens;
}

/** All tokens known to the resolver (built-ins + registered extras). */
export function knownTokens(): string[] {
  return [...Object.keys(builtins), ...Object.keys(extras)];
}

/**
 * Resolve `:account`, `:hash`, `:signature`, and any registered extras
 * in a URI template, returning the fully-substituted URI.
 *
 * Tokens are resolved lazily — only those present in the template have
 * their resolvers invoked. Unknown `:foo` segments are left untouched
 * (they may be legitimate protocol-defined path segments).
 */
export async function resolveUriTemplate(
  template: string,
  ctx: UriTemplateContext,
): Promise<string> {
  const tokens = findTokens(template);
  if (tokens.length === 0) return template;

  const cache = new Map<string, string>();
  for (const token of tokens) {
    if (cache.has(token)) continue;
    const resolver = builtins[token as UriTemplateToken] ?? extras[token];
    if (!resolver) continue;
    cache.set(token, await resolver(ctx));
  }

  return template.replace(
    /:([a-zA-Z][a-zA-Z0-9_]*)/g,
    (match, name) => cache.get(name) ?? match,
  );
}

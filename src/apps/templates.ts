/**
 * Basepath template interpolation.
 *
 * AppDescriptors may parameterise their `defaultBasePath` with
 * placeholders so the same descriptor can scope per-identity without
 * the user editing it manually:
 *
 *   mutable://{account}/notes
 *
 * Behavior-named schemes (the part before `://`) describe what the
 * program enforces, not which backend serves the data: `mutable://`,
 * `immutable://`, `signed://<pubkey>/`, `hash://sha256/`, `encrypted://`.
 * App authors compose them; the rig wires schemes to backends. See
 * b3nd-skill notes/uri-scheme-shape.md for the rationale.
 *
 * Supported placeholders:
 *   {account}      → active account pubkey (hex), or the literal fallback
 *                    when no active account
 *   {accountId}    → active account id (zustand-managed, not signing key)
 *   {accountName}  → slugified account name
 *
 * Each placeholder accepts a fallback after `?`:
 *
 *   mutable://{account?anonymous}/notes
 */

export interface AccountContext {
  id?: string;
  pubkey?: string;
  name?: string;
}

function slugifyName(name: string): string {
  return name
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9-_]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 48) || "account";
}

function resolveOne(token: string, account: AccountContext | null): string {
  const eq = token.indexOf("?");
  const name = eq === -1 ? token : token.slice(0, eq);
  const fallback = eq === -1 ? "" : token.slice(eq + 1);
  switch (name) {
    case "account":
      return account?.pubkey || fallback;
    case "accountId":
      return account?.id || fallback;
    case "accountName":
      return account?.name ? slugifyName(account.name) : fallback;
    default:
      return fallback;
  }
}

const PLACEHOLDER = /\{([^}]+)\}/g;

export function interpolateBasePath(
  template: string,
  account: AccountContext | null,
): string {
  return template.replace(PLACEHOLDER, (_match, body: string) =>
    resolveOne(body.trim(), account));
}

/** Returns true when the template contains at least one placeholder. */
export function hasPlaceholders(template: string): boolean {
  PLACEHOLDER.lastIndex = 0;
  return PLACEHOLDER.test(template);
}

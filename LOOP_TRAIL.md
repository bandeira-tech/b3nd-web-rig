# LOOP_TRAIL — web rig polish

Lean coordination doc between /loop iterations.
Vision: web rig as **the one-stop shop for B3nd** — a delightful garden for
solo entrepreneurs and small teams to own and play with their data through
mountable UI applications, all stored on B3nd.

## North star

- **Sandbox for B3nd content.** Defaults read URI payloads sanely; hinted /
  managed display per content type.
- **Mountable UI apps.** Apps are themselves stored on B3nd. They have a
  *display slot* (UI) and a *rig slot* (constrained data handle). Users
  pick a basepath; the app's behavior is independent of source.
- **Configurable basepaths.** The user decides where things mount/store.
- **Non-tech-friendly.** Delightful, organized, candybar-clean.

## Iteration log

- **Iter 1** — Hinted display registry. JSON / text / markdown / image /
  raw strategies. Wire `ContentViewer` to dispatch through it. Tests via
  seeded MemoryStore. ✓ shipped.
- **Iter 2** — Apps system. `AppDescriptor`, built-in registry, `RigSlot`
  scoped to a basepath, `/apps` browser, `/apps/:slug` AppHost with
  inline basepath editor. First built-in: Notes (markdown notepad).
  ✓ shipped.
- **Iter 3** — Per-app basepath persistence (`src/apps/mounts.ts`,
  localStorage) + reset-to-default button. Second built-in app:
  Bookmarks (one JSON record per URL). Fixed a slugify bug that pushed
  records into a sub-prefix `list()` couldn't enumerate — caught by a
  failing test. ✓ shipped.
- **Iter 4** — Rig-stored catalog. `src/apps/catalog.ts` reads
  `AppDescriptor` records from a configurable catalog basepath and
  merges them with built-in defaults (user slugs override defaults).
  `AppsBrowser` shows the catalog basepath + a publish form; AppHost
  resolves the descriptor via the catalog (not just hard-coded
  defaults), so user-published slugs can be navigated to. The catalog
  basepath persists like mount overrides. ✓ shipped.
- **Iter 5** — Two more built-in apps: Files (drop any bytes under a
  basepath, with the hinted-display registry powering previews) and
  Inbox (timestamped JSON log, newest-first). Empty states made
  testable + friendlier. Four built-ins now ship by default. ✓ shipped.
- **Iter 6** — HTML-mount apps. `display.kind = "html"` points at an
  HTML record in the rig; AppHost loads it into a sandboxed iframe
  (`sandbox="allow-scripts"`, opaque origin), injects a bootstrap that
  exposes `window.b3ndSlot.{basePath, resolve, list, read, write}` and
  routes ops via postMessage. End-to-end round-trip test mounts a
  seeded HTML app and verifies the iframe wrote through the bridge.
  ✓ shipped.
- **Iter 7** — UX polish: AppsLeftSlot replaces the placeholder, lists
  every default + published app with its current mount basepath and a
  "mounted" badge when overridden. AppsBrowser welcome copy targets
  non-tech users. PublishForm gains an HTML kind toggle + textarea —
  publishing an HTML app writes the body alongside the descriptor and
  the new tile mounts an iframe immediately. ✓ shipped.
- **Iter 8** — Identity-aware basepath templates. `{account}`,
  `{accountId}`, `{accountName}` placeholders with `?fallback` syntax.
  Default catalog now uses `{account?shared}` so apps follow identity
  out of the box. AppHost shows the resolved value next to the
  template. Stripped the chatty `console.log` calls from ContentViewer
  so the explorer feels less alpha-dev. ✓ shipped.
- **Iter 9** — All four `.fixme` tests are live. Closed: editor→
  explorer round-trip, three explorer-seeded tests. Root cause behind
  the schema-driven nav failure: `status().schema` reports
  `entity:bytes` (the entity name) instead of URI prefixes. Workaround
  in the rig: hook `receive:success`, harvest `protocol://host` from
  every written URI, splice into `rootNodes` so the explorer reflects
  reality without changing b3nd-save. The HttpAdapter bug from the
  comment was already fixed in earlier iters — the remaining issue was
  that the tests used `app.goto()` post-seed, which reloads the page
  and wipes the in-memory rig; switched them to SPA navigation. The
  full suite now runs with 53 passed, 0 skipped. ✓ shipped.
- **Iter 10** — Identity context made visible. AppsLeftSlot header
  shows the active account (emoji + name) or a "no account, using
  shared" fallback that doubles as a CTA to /accounts. AppsBrowser
  welcome callout mirrors the same info next to the intro copy. Apps
  follow whichever account is active — now the user can *see* that
  before mounting. ✓ shipped.
- **Iter 11** — Catalog bundle (`src/apps/bundle.ts`).
  `exportCatalog` produces a v1 JSON bundle of user-published apps
  (built-in slugs skipped by default) with HTML bodies inlined when
  reachable. `importCatalog` writes the descriptors back, and restores
  HTML at its declared URI on receiving rigs. Wired to Export /
  Import buttons in AppsBrowser. Round-trip test passes; HTML inline
  verified. ✓ shipped.
- **Iter 12** — CI + first-boot seed. GitHub Actions workflow runs
  `npm ci → build → playwright install → playwright test` on push to
  main and on every PR. First-boot seed (`src/apps/firstBoot.ts`)
  drops a welcome markdown and a sample Hello B3nd HTML app on first
  load and publishes its descriptor to the default catalog, so a
  fresh visitor sees something tangible from second one. Idempotent
  via localStorage marker. ✓ shipped.
- **Iter 13** — Behavior-named schemes in the apps catalog. Applies
  the learning from `../b3nd-skill/notes/uri-scheme-shape.md`: scheme
  names a behavior (`mutable://`, `immutable://`, `signed://<pubkey>/`,
  `hash://sha256/`, `encrypted://`), not a backend. Switched the four
  built-in defaults from `memory://accounts/{account?shared}/<app>` to
  `mutable://{account?shared}/<app>` — the rule lives in the scheme,
  the identity scope lives in the path's first segment (matching the
  `mutable://<pubkey>/<path>` convention from the skill). First-boot
  seed now writes welcome.md and the Hello B3nd HTML body under
  `immutable://rig/` (write-once snapshot — correct for boot content
  the user can't author). PublishForm placeholder switched to
  `mutable://my-data/` and gained inline guidance on the four
  behavior-named schemes. `templates.ts` docs and three tests updated.
  Rig wiring is unchanged: `connection(client, ["**"])` already routes
  any scheme to the configured store, so no backend work needed. The
  defaults now teach the right pattern to anyone who copies them.
  ✓ shipped.

## Nudges (carry across runs)

- Cores stay puritan — sugar in this repo, not in b3nd-core.
- Test surface today is Playwright e2e only. Don't add Vitest yet.
- When deps need updating, branch in `~/ws/b3nd-*` and link locally.
- Commit + push at end of each iteration. CI is org-level (check before push).
- Slot keys are flat under the basepath — `/` inside a generated key
  silently nests one level deeper than `slot.list()` enumerates.
  Strip `/` in any slugify before composing a key.
- Controlled-input + sync click can race React batching. When tests
  flake on "form submit didn't see latest state", check the assertion
  *before* assuming a logic bug.
- `page.goto()` reloads the SPA and wipes the in-memory rig. When a
  test needs to seed data and then navigate, use SPA navigation
  (`history.pushState` + `popstate` dispatch) instead.
- Default basepath templates *teach by example* — users copy them
  when publishing their own apps. Keep them behavior-named
  (`mutable://...`, `immutable://...`) and identity-scoped
  (`{account?shared}`), not backend-named (`memory://...`).

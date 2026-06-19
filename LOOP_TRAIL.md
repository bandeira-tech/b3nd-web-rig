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

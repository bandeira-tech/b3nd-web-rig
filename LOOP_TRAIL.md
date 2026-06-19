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
  seeded MemoryStore.

## Nudges (carry across runs)

- Cores stay puritan — sugar in this repo, not in b3nd-core.
- Test surface today is Playwright e2e only. Don't add Vitest yet.
- When deps need updating, branch in `~/ws/b3nd-*` and link locally.
- Commit + push at end of each iteration. CI is org-level (check before push).

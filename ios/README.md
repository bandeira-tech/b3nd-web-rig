# B3nd Rig — native iOS

A performant, native SwiftUI client for B3nd nodes. It mirrors the
[`b3nd-web-rig`](../README.md) feature set — explore data, write records,
inspect node health, manage identities, mount apps — but runs as a first-class
iOS app instead of a web view.

This is the **foundation**: the wire protocol, the networking/domain core, and
a working vertical slice (Explore + Write + Nodes + Settings) wired to real
B3nd nodes, with Accounts and Apps scaffolded.

## Layout

```
ios/
├── project.yml                  # XcodeGen spec → B3ndRig.xcodeproj
├── Packages/B3ndKit/            # portable core (no UIKit) — builds on Linux CI
│   └── Sources/B3ndKit/
│       ├── Codecs/              # url-list + bytes-list framing (b3nd-move wire)
│       ├── Networking/          # B3ndClient (status/read/receive) + RigService
│       ├── Models/              # JSONValue, NavNode, BackendConfig, path↔URI
│       └── Display/             # DisplayHinter (content-type sniffing)
└── B3ndRig/                     # SwiftUI app
    ├── App/                     # entry point, TabView, theme, shared views
    ├── Stores/                  # AppStore, persistence, accounts, instances
    └── Features/                # Explorer, Editor, Nodes, Apps, Accounts, Settings
```

## The B3nd HTTP wire protocol

`B3ndKit` speaks the `b3nd-move` HTTP transport directly (there is no Swift SDK
for B3nd yet). All three routes are implemented and verified against the live
demo nodes:

| Method | Path                      | `?u=`            | Body                  | Maps to        |
| ------ | ------------------------- | ---------------- | --------------------- | -------------- |
| `GET`  | `/api/v1/status`          | —                | —                     | `rig.status()` |
| `POST` | `/api/v1/read?u=<b64>`    | URL list         | —                     | `rig.read()`   |
| `POST` | `/api/v1/receive?u=<b64>` | URI list         | framed payload bytes  | `rig.receive()`|

`?u=` is a url-safe-base64 wrapper over a length-prefixed `bytes-list`
(`lenSize: 2`); the `receive` body is the same framing at `lenSize: 4`. See
`Codecs/` — these are faithful ports of `b3nd-move/src/codecs/*`.

### Realtime (`observe` over WebSocket)

`B3ndSocket` speaks the `b3nd-move` WebSocket protocol at `wss://…/api/v1/ws`:
one persistent socket, JSON frames keyed by `id`
(`{ id, type, payload }` → `{ id, success, data?, error? }`). `observe` yields
repeated `string[]` batches (URIs that changed), terminated by a `data: null`
frame. `WsFrame` (pure, unit-tested) handles the framing; `B3ndSocket` (an
`actor`) owns the connection, request/response multiplexing, and observe
subscriptions as `AsyncStream<[String]>`.

> **Note:** `observe` only lights up against a node that runs the `ws` service.
> The public demo nodes expose the HTTP API only (`/api/v1/ws` is 404), so the
> app shows **Offline** and falls back to pull-to-refresh — the same graceful
> degradation the web rig does. Point at a local dev node (`deno task serve
> -- --ws`) to see Explorer update live.

## Build & run

Requires Xcode 15+ and [XcodeGen](https://github.com/yonsei/XcodeGen)
(`brew install xcodegen`).

```sh
cd ios
xcodegen generate          # writes B3ndRig.xcodeproj
open B3ndRig.xcodeproj      # ⌘R to run on a simulator or device
```

The project references the local `B3ndKit` package, so it resolves with no
network access.

## Test the core

`B3ndKit` is plain Swift and unit-tested independently of the app — no
simulator needed:

```sh
cd ios/Packages/B3ndKit
swift test
```

The tests pin the wire codecs (including the exact `Truncated slot body` case
the live backend returns for an un-framed payload) and the path/display logic.

## Foundation scope & next steps

Wired to real nodes today: **Explore** (schema-driven browse, lazy listing,
content-typed record rendering, **live updates** via `observe`), **Write**
(`receive` with `{account}` templating), **Nodes** (live status/health +
realtime Live/Offline indicator), **Settings** (backend switching + custom
backends + theme).

Scaffolded: **Accounts** generate real Ed25519 keypairs (CryptoKit) but writes
are not yet signed-enveloped; **Apps** frames the mountable-app model.

Planned next:
- Signed-envelope writes (`signed://<pubkey>/…`) + encryption, matching the web
  rig's `editorService`.
- Move account private keys to the Keychain.
- Mount the built-in apps (Notes, Bookmarks, Files, Inbox) on the rig slot.
- iOS CI (macOS runner): `swift test` + `xcodebuild` so the app target is
  verified on every change.

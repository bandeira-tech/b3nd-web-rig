# b3nd-web-rig

B3nd web rig — React/Vite data explorer + dashboard for B3nd nodes.

This is the **full explorer shell**: a forkable, ready-to-run browser app
that connects to any B3nd rig and lets you browse, edit, and manage data
through a growing set of mountable UI applications. Fork it, point it at
your rig, extend it with your own apps.

## Quickstart

```sh
npm i
npm run dev
# opens at http://localhost:5555
```

## Pointing at a rig

Edit `public/instances.json` to list the rigs you want to connect to:

```json
{
  "defaults": { "backend": "my-rig" },
  "backends": {
    "my-rig": {
      "name": "My B3nd node",
      "baseUrl": "http://localhost:9942"
    }
  }
}
```

The rig selector in the UI will reflect whatever you add here.

## Mountable apps and basepaths

The web rig ships a built-in catalog of apps (Notes, Bookmarks, Files,
Inbox, and more). Each app occupies a **rig slot** — a scoped data handle
pointed at a configurable **basepath**. Users pick where each app stores
its data; the app's behavior is independent of the storage location. Apps
are themselves stored on the rig as `AppDescriptor` records, so the
catalog is extensible and portable: you can publish HTML apps inline, then
export/import the whole catalog as a single bundle.

Basepath templates use identity placeholders (`{account?shared}`) so apps
automatically follow whichever account is active, with a sane fallback
when no account is set.

## Tests

Playwright end-to-end suite (headless Chromium):

```sh
npm run test:e2e:install   # first time only
npm run test:e2e
```

## Deploy

Build the static bundle, then serve it with anything that can host static
files. The included `Dockerfile` uses nginx:

```sh
npm run build
docker build -t b3nd-web-rig .
docker run -p 8080:8080 b3nd-web-rig
```

## Starting a new B3nd web app

**This repo is the full explorer shell** — it ships its own built-in apps
catalog, identity management, and data browser. If you want a minimal
scaffold to start a new B3nd-backed web app from scratch, the sibling
`b3ndwebappshell` repo provides `create-b3nd-app` (`@b3nd/create-app`),
a generator that creates a lightweight app shell. Both paths are valid
entry points; which one supersedes the other is an open decision.

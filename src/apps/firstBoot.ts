import type { SlotBackend } from "./runtime";
import { createRigSlot } from "./runtime";
import { publishDescriptor } from "./catalog";

const SEED_MARK = "b3nd-rig.first-boot-seeded";

const WELCOME_MARKDOWN = `# Welcome to your rig

This rig is your personal sandbox for B3nd. Everything you see and do here
flows through **your data**, in **your scope** — not someone else's database.

A quick tour:

- **Apps** — tiny UIs that live on B3nd. Pick one from the *Apps* tab and
  it mounts at a basepath you control. The same app works wherever its
  data is stored.
- **Notes / Bookmarks / Files / Inbox** — built-ins to play with right
  away. Add an account and watch the mount path follow your identity.
- **Hello B3nd** — a sample HTML app shipped at boot. Open it to see how
  any HTML page can talk to your rig.
- **Explorer** — browse what's actually in your data, URI by URI.

Nothing here is shared — every write you make is yours.
`;

const HELLO_HTML = `<!doctype html>
<html>
<head>
  <title>Hello B3nd</title>
  <style>
    body { font: 14px/1.4 system-ui, sans-serif; padding: 24px; max-width: 640px; }
    h1 { font-size: 18px; margin: 0 0 8px; }
    code, pre { background: #f1f1f1; padding: 2px 6px; border-radius: 4px; }
    pre { padding: 12px; overflow-x: auto; }
    button { padding: 6px 12px; border-radius: 6px; border: 1px solid #ccc; background: #fafafa; cursor: pointer; }
    button:hover { background: #f0f0f0; }
    #note { color: #666; }
  </style>
</head>
<body>
  <h1>Hello, B3nd</h1>
  <p>This page is a sandboxed HTML app stored at
    <code id="self">…</code>. It writes data into <code id="bp">…</code>.
  </p>
  <p>
    <button id="add">Save a note</button>
    <button id="refresh">Refresh list</button>
  </p>
  <ul id="list"></ul>
  <p id="note">When you publish your own HTML app, this is the surface
    you have: <code>window.b3ndSlot</code>.</p>
  <script>
    (async () => {
      const bpEl = document.getElementById('bp');
      const listEl = document.getElementById('list');
      const bp = await window.b3ndSlot.basePath();
      bpEl.textContent = bp;
      document.getElementById('self').textContent = 'immutable://rig/hello-b3nd.html';

      async function refresh() {
        const items = await window.b3ndSlot.list();
        const records = items.length
          ? await window.b3ndSlot.read(items.map(i => i.key))
          : [];
        listEl.innerHTML = '';
        for (const r of records) {
          const li = document.createElement('li');
          li.textContent = (r.data && r.data.text) || JSON.stringify(r.data);
          listEl.appendChild(li);
        }
      }

      document.getElementById('add').onclick = async () => {
        const text = prompt('What would you like to remember?');
        if (!text) return;
        const key = Date.now() + '.json';
        await window.b3ndSlot.write(key, { text, createdAt: Date.now() });
        await refresh();
      };
      document.getElementById('refresh').onclick = refresh;
      await refresh();
    })();
  </script>
</body>
</html>`;

const HELLO_DESCRIPTOR = {
  slug: "hello-b3nd",
  name: "Hello B3nd",
  description: "A sample HTML app. Open it to see how UIs talk to your rig.",
  icon: "👋",
  defaultBasePath: "mutable://{account?shared}/hello-b3nd",
  display: { kind: "html", uri: "immutable://rig/hello-b3nd.html" },
} as const;

/**
 * Seed a fresh rig with a welcome note + a sample HTML app.
 *
 * Runs at most once per browser. Failures are swallowed — the seed is
 * a delight feature, not a correctness one.
 */
export async function seedFirstBoot(backend: SlotBackend): Promise<void> {
  if (typeof window === "undefined") return;
  try {
    if (window.localStorage.getItem(SEED_MARK)) return;
    window.localStorage.setItem(SEED_MARK, String(Date.now()));
  } catch {
    return;
  }
  try {
    // Welcome doc is a one-shot snapshot — write-once via `immutable://`.
    // The sample HTML app's body lives in the same surface so the
    // descriptor URI (`immutable://rig/hello-b3nd.html`) matches what
    // gets stored. Behavior-named schemes — see uri-scheme-shape.md.
    const rigSlot = createRigSlot(backend, "immutable://rig");
    await rigSlot.write("welcome.md", WELCOME_MARKDOWN);
    await rigSlot.write("hello-b3nd.html", HELLO_HTML);
    await publishDescriptor(backend, HELLO_DESCRIPTOR);
  } catch {
    // Reset the mark so a later boot can retry.
    try {
      window.localStorage.removeItem(SEED_MARK);
    } catch {
      // best effort
    }
  }
}

/** Test-only: clear the seed marker so the next boot reseeds. */
export function clearFirstBootMark(): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.removeItem(SEED_MARK);
  } catch {
    // best effort
  }
}

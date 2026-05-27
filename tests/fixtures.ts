import { test as base, expect, type Page } from "@playwright/test";

// Mirror of the fields we touch on the app store. Kept structural so the
// test suite doesn't import app source (which would pull all of Vite's
// graph into Playwright's TS loader).
type StoreSnapshot = {
  rig: {
    receive(msgs: [string, Uint8Array][]): PromiseLike<unknown[]>;
  } | null;
  backendsReady: boolean;
  loadSchemas: () => Promise<void>;
};

type StoreApi = {
  getState(): StoreSnapshot;
};

declare global {
  interface Window {
    __b3ndStore?: StoreApi;
  }
}

export type SeedEntry = [uri: string, data: unknown];

export interface RigHandle {
  /** Seed records via the live rig — same path as a real editor write. */
  seed(entries: SeedEntry[]): Promise<void>;
  /** Force a schema refresh (auto-runs after seed). Rarely needed manually. */
  reloadSchemas(): Promise<void>;
}

interface Fixtures {
  /** A page wired to a `memory://` backend with the rig ready. */
  app: Page;
  /** Drive the rig directly — seed data without going through the UI. */
  rig: RigHandle;
}

/**
 * `instances.json` payload swapped in for every test. Same shape as
 * `public/instances.json` but pointing at the in-process MemoryStore.
 */
const MEMORY_INSTANCES = {
  defaults: { backend: "memory" },
  backends: {
    memory: { name: "In-Memory", baseUrl: "memory://" },
  },
};

export const test = base.extend<Fixtures>({
  app: async ({ page }, use) => {
    await page.route("**/instances.json", (route) =>
      route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify(MEMORY_INSTANCES),
      })
    );

    await page.goto("/");

    // Wait until the app store is exposed and the Rig has been constructed.
    // `backendsReady` flips after `onRehydrateStorage` finishes wiring backends.
    await page.waitForFunction(() => {
      const store = window.__b3ndStore;
      if (!store) return false;
      const s = store.getState();
      return s.backendsReady && s.rig !== null;
    });

    await use(page);
  },

  rig: async ({ app }, use) => {
    const handle: RigHandle = {
      async seed(entries) {
        await app.evaluate(async (entries) => {
          const store = window.__b3ndStore;
          if (!store) throw new Error("__b3ndStore not exposed");
          const { rig, loadSchemas } = store.getState();
          if (!rig) throw new Error("rig is null");
          // b3nd-move/b3nd-save receive requires Uint8Array payloads —
          // the move layer is opaque past the URI, so the producing
          // app encodes. Mirror the editor's JSON convention.
          const encoder = new TextEncoder();
          const encoded: [string, Uint8Array][] = entries.map(
            ([uri, data]) => [uri, encoder.encode(JSON.stringify(data))],
          );
          await rig.receive(encoded);
          // MemoryStore only reports a prefix in status().schema after
          // something has been written under it — refresh so the explorer
          // root nav picks up the seeded prefixes.
          await loadSchemas();
        }, entries);
      },
      async reloadSchemas() {
        await app.evaluate(async () => {
          await window.__b3ndStore!.getState().loadSchemas();
        });
      },
    };
    await use(handle);
  },
});

export { expect };

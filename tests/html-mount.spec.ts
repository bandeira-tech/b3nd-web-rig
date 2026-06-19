import { expect, test } from "./fixtures";

declare global {
  interface Window {
    __b3ndApps?: {
      createRigSlot(backend: unknown, basePath: string): {
        write(key: string, data: unknown): Promise<unknown>;
        read(key: string | string[]): Promise<Array<{ key: string; data: unknown }>>;
        list(key?: string): Promise<Array<{ key: string; uri: string }>>;
      };
      catalog: {
        publish(backend: unknown, descriptor: unknown, basePath?: string): Promise<void>;
        setBasePath(basePath: string): void;
        getDefaultBasePath(): string;
      };
      mounts: { set(slug: string, basePath: string): void };
    };
    __b3ndStore?: { getState(): { rig: unknown } };
  }
}

/**
 * HTML body used in tests. On load it writes a record through the
 * postMessage bridge and updates a status element so we can observe it.
 */
const TEST_APP_HTML = `<!doctype html>
<html><head><title>round-trip</title></head>
<body>
  <h1 id="title">round-trip app</h1>
  <p id="status">pending</p>
  <p id="basepath"></p>
  <p id="readback"></p>
  <script>
    (async () => {
      try {
        const status = document.getElementById('status');
        const basePathEl = document.getElementById('basepath');
        const readEl = document.getElementById('readback');
        const bp = await window.b3ndSlot.basePath();
        basePathEl.textContent = bp;
        await window.b3ndSlot.write('hello.txt', 'world from iframe');
        const records = await window.b3ndSlot.read('hello.txt');
        readEl.textContent = String(records[0] && records[0].data);
        status.textContent = 'done';
      } catch (err) {
        document.getElementById('status').textContent = 'err: ' + (err && err.message || err);
      }
    })();
  </script>
</body></html>`;

/**
 * Navigate within the SPA without reloading the page — a Playwright goto
 * would wipe the in-memory rig (and all the seed data we just wrote).
 */
async function spaNavigate(page: import("@playwright/test").Page, url: string) {
  await page.evaluate((url) => {
    window.history.pushState({}, "", url);
    window.dispatchEvent(new PopStateEvent("popstate"));
  }, url);
}

test.describe("HTML-mounted apps", () => {
  test("descriptor with display.kind=html mounts a sandboxed iframe that round-trips via the bridge", async ({ app }) => {
    const dataBase = `memory://html-roundtrip-data/${Date.now()}`;

    // Seed: write the HTML payload and publish a descriptor pointing at it.
    await app.evaluate(
      async ({ html, dataBase, htmlUri }) => {
        const apps = window.__b3ndApps!;
        const rig = window.__b3ndStore!.getState().rig;
        const htmlSlot = apps.createRigSlot(rig, "memory://html-roundtrip-app");
        await htmlSlot.write("index.html", html);

        const catalogBase = `memory://html-roundtrip-catalog/${Date.now()}`;
        apps.catalog.setBasePath(catalogBase);
        await apps.catalog.publish(rig, {
          slug: "html-roundtrip",
          name: "Round-trip HTML",
          description: "test fixture",
          icon: "🧪",
          defaultBasePath: dataBase,
          display: { kind: "html", uri: htmlUri },
        });
        apps.mounts.set("html-roundtrip", dataBase);
      },
      {
        html: TEST_APP_HTML,
        dataBase,
        htmlUri: "memory://html-roundtrip-app/index.html",
      },
    );

    await spaNavigate(app, "/apps/html-roundtrip");
    const iframe = app.getByTestId("html-mount-iframe");
    await expect(iframe).toBeVisible();

    const frame = app.frameLocator('[data-testid="html-mount-iframe"]');
    await expect(frame.locator("#status")).toHaveText("done", { timeout: 10_000 });
    await expect(frame.locator("#basepath")).toHaveText(dataBase);
    await expect(frame.locator("#readback")).toHaveText("world from iframe");

    // And the parent's view of the slot confirms the write landed.
    const parentItems = await app.evaluate(async ({ dataBase }) => {
      const apps = window.__b3ndApps!;
      const rig = window.__b3ndStore!.getState().rig;
      const slot = apps.createRigSlot(rig, dataBase);
      const list = await slot.list();
      return list.map((it) => it.key);
    }, { dataBase });
    expect(parentItems).toContain("hello.txt");
  });

  test("missing HTML at the configured URI surfaces an error", async ({ app }) => {
    await app.evaluate(async () => {
      const apps = window.__b3ndApps!;
      const rig = window.__b3ndStore!.getState().rig;
      const catalogBase = `memory://html-missing-catalog/${Date.now()}`;
      apps.catalog.setBasePath(catalogBase);
      await apps.catalog.publish(rig, {
        slug: "html-missing",
        name: "Missing HTML",
        defaultBasePath: "memory://missing-data",
        display: { kind: "html", uri: "memory://nope/index.html" },
      });
    });
    await spaNavigate(app, "/apps/html-missing");
    await expect(app.getByTestId("html-mount-error")).toBeVisible();
  });
});

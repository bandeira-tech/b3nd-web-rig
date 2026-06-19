import { expect, test } from "./fixtures";

declare global {
  interface Window {
    __b3ndApps?: {
      catalog: {
        load(backend: unknown, basePath?: string): Promise<Array<{ slug: string }>>;
        setBasePath(basePath: string): void;
        getDefaultBasePath(): string;
      };
      createRigSlot(backend: unknown, basePath: string): {
        read(key: string | string[]): Promise<Array<{ key: string; data: unknown }>>;
      };
    };
  }
}

test.describe("first-boot seed", () => {
  test.beforeEach(async ({ app }) => {
    await app.evaluate(() => {
      window.__b3ndApps!.catalog.setBasePath(
        window.__b3ndApps!.catalog.getDefaultBasePath(),
      );
    });
  });

  test("seeds welcome.md + Hello B3nd HTML + a published descriptor", async ({ app }) => {
    // The seed runs after backendsReady — poll briefly until it lands.
    await expect.poll(async () => {
      return await app.evaluate(async () => {
        const apps = window.__b3ndApps!;
        const rig = window.__b3ndStore!.getState().rig;
        const cat = await apps.catalog.load(rig);
        const slugs = cat.map((d) => d.slug);
        const rigSlot = apps.createRigSlot(rig, "immutable://rig");
        const records = await rigSlot.read(["welcome.md", "hello-b3nd.html"]);
        return {
          hasHelloTile: slugs.includes("hello-b3nd"),
          welcomeBytes: records[0]?.data ? true : false,
          helloHtmlBytes: records[1]?.data ? true : false,
        };
      });
    }, { timeout: 5_000 }).toMatchObject({
      hasHelloTile: true,
      welcomeBytes: true,
      helloHtmlBytes: true,
    });
  });

  test("the Hello B3nd tile is reachable from the apps browser", async ({ app }) => {
    // Catalog reload depends on the seed completing — poll the catalog first.
    await expect.poll(async () => {
      return await app.evaluate(async () => {
        const apps = window.__b3ndApps!;
        const rig = window.__b3ndStore!.getState().rig;
        const cat = await apps.catalog.load(rig);
        return cat.map((d) => d.slug).includes("hello-b3nd");
      });
    }, { timeout: 5_000 }).toBe(true);

    // SPA-navigate so we don't reload the page and wipe the in-memory rig.
    await app.evaluate(() => {
      window.history.pushState({}, "", "/apps");
      window.dispatchEvent(new PopStateEvent("popstate"));
    });
    await expect(app.getByTestId("apps-tile-hello-b3nd")).toBeVisible();
  });
});

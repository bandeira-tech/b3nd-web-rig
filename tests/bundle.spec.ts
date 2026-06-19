import { expect, test } from "./fixtures";

declare global {
  interface Window {
    __b3ndApps?: {
      createRigSlot(backend: unknown, basePath: string): {
        write(key: string, data: unknown): Promise<unknown>;
      };
      catalog: {
        setBasePath(basePath: string): void;
        getDefaultBasePath(): string;
        publish(backend: unknown, descriptor: unknown, basePath?: string): Promise<void>;
        load(backend: unknown, basePath?: string): Promise<Array<{ slug: string }>>;
      };
      bundle: {
        export(backend: unknown, basePath: string, opts?: unknown): Promise<unknown>;
        import(backend: unknown, basePath: string, bundle: unknown): Promise<{
          imported: string[];
          skipped: Array<{ slug?: string; reason: string }>;
        }>;
        isBundle(value: unknown): boolean;
      };
    };
  }
}

test.describe("catalog bundle", () => {
  test("export → import round-trip restores user-published apps", async ({ app }) => {
    const result = await app.evaluate(async () => {
      const apps = window.__b3ndApps!;
      const rig = window.__b3ndStore!.getState().rig;
      const sourceBase = `memory://bundle-source/${Date.now()}`;
      const sinkBase = `memory://bundle-sink/${Date.now()}-${
        Math.random().toString(36).slice(2, 6)
      }`;
      // Publish two user apps to source.
      await apps.catalog.publish(rig, {
        slug: "userland-a",
        name: "Userland A",
        defaultBasePath: "memory://a/data",
        display: { kind: "builtin", id: "builtin:notes" },
      }, sourceBase);
      await apps.catalog.publish(rig, {
        slug: "userland-b",
        name: "Userland B",
        defaultBasePath: "memory://b/data",
        display: { kind: "builtin", id: "builtin:bookmarks" },
      }, sourceBase);
      // Export.
      const bundle = await apps.bundle.export(rig, sourceBase) as {
        version: number;
        apps: Array<{ descriptor: { slug: string } }>;
      };
      // Import into a fresh sink.
      const imp = await apps.bundle.import(rig, sinkBase, bundle);
      // Verify the sink now lists both.
      const after = await apps.catalog.load(rig, sinkBase);
      return {
        bundleVersion: bundle.version,
        bundleSlugs: bundle.apps.map((a) => a.descriptor.slug),
        imported: imp.imported,
        afterSlugs: after.map((d) => d.slug),
      };
    });
    expect(result.bundleVersion).toBe(1);
    expect(result.bundleSlugs).toEqual(
      expect.arrayContaining(["userland-a", "userland-b"]),
    );
    expect(result.imported).toEqual(
      expect.arrayContaining(["userland-a", "userland-b"]),
    );
    expect(result.afterSlugs).toEqual(
      expect.arrayContaining(["userland-a", "userland-b"]),
    );
  });

  test("export skips built-in defaults but inlines HTML for user HTML apps", async ({ app }) => {
    const probe = await app.evaluate(async () => {
      const apps = window.__b3ndApps!;
      const rig = window.__b3ndStore!.getState().rig;
      const sourceBase = `memory://bundle-html-src/${Date.now()}`;
      const htmlBase = `memory://bundle-html-app/${Date.now()}`;
      const htmlUri = `${htmlBase}/index.html`;
      const htmlSlot = apps.createRigSlot(rig, htmlBase);
      await htmlSlot.write("index.html", "<h1>hi</h1>");
      await apps.catalog.publish(rig, {
        slug: "user-html",
        name: "User HTML",
        defaultBasePath: "memory://user-html/data",
        display: { kind: "html", uri: htmlUri },
      }, sourceBase);
      const bundle = await apps.bundle.export(rig, sourceBase) as {
        apps: Array<{ descriptor: { slug: string }; html?: string }>;
      };
      return bundle.apps;
    });
    expect(probe).toHaveLength(1);
    expect(probe[0].descriptor.slug).toBe("user-html");
    expect(probe[0].html).toContain("<h1>hi</h1>");
  });

  test("isBundle rejects garbage and v0 bundles", async ({ app }) => {
    const verdicts = await app.evaluate(() => {
      const apps = window.__b3ndApps!;
      return {
        empty: apps.bundle.isBundle({}),
        v0: apps.bundle.isBundle({ version: 0, apps: [] }),
        v1Empty: apps.bundle.isBundle({ version: 1, apps: [] }),
        nullVal: apps.bundle.isBundle(null),
      };
    });
    expect(verdicts.empty).toBe(false);
    expect(verdicts.v0).toBe(false);
    expect(verdicts.v1Empty).toBe(true);
    expect(verdicts.nullVal).toBe(false);
  });

  test("AppsBrowser import flow accepts a pasted bundle and shows the tile", async ({ app }) => {
    await app.evaluate(() => {
      const apps = window.__b3ndApps!;
      apps.catalog.setBasePath(`memory://browser-import/${Date.now()}`);
    });
    await app.goto("/apps");
    const bundle = JSON.stringify({
      version: 1,
      exportedFrom: "memory://elsewhere",
      exportedAt: Date.now(),
      apps: [
        {
          descriptor: {
            slug: "from-bundle",
            name: "From Bundle",
            description: "imported",
            icon: "📦",
            defaultBasePath: "memory://from-bundle/data",
            display: { kind: "builtin", id: "builtin:notes" },
          },
        },
      ],
    });
    await app.getByTestId("apps-import-toggle").click();
    await app.getByTestId("apps-import-text").fill(bundle);
    await app.getByTestId("apps-import-submit").click();
    await expect(app.getByTestId("apps-import-status")).toContainText(
      /Imported 1/,
    );
    await expect(app.getByTestId("apps-tile-from-bundle")).toBeVisible();
  });
});

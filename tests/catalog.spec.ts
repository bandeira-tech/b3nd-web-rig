import { expect, test } from "./fixtures";

declare global {
  interface Window {
    __b3ndApps?: {
      catalog: {
        load(backend: unknown, basePath?: string): Promise<Array<{
          slug: string;
          name: string;
          defaultBasePath: string;
          display: { kind: string; id?: string };
        }>>;
        publish(
          backend: unknown,
          descriptor: unknown,
          basePath?: string,
        ): Promise<void>;
        getBasePath(): string;
        setBasePath(basePath: string): void;
        getDefaultBasePath(): string;
      };
    };
  }
}

test.describe("rig-stored catalog", () => {
  test.beforeEach(async ({ app }) => {
    await app.evaluate(() => {
      const apps = window.__b3ndApps!;
      apps.catalog.setBasePath(apps.catalog.getDefaultBasePath());
    });
  });

  test("load returns built-in defaults when the catalog is empty", async ({ app }) => {
    const slugs = await app.evaluate(async () => {
      const apps = window.__b3ndApps!;
      const rig = window.__b3ndStore!.getState().rig;
      const cat = await apps.catalog.load(rig);
      return cat.map((d) => d.slug);
    });
    expect(slugs).toEqual(expect.arrayContaining(["notes", "bookmarks"]));
  });

  test("publishing a new descriptor surfaces in the catalog", async ({ app }) => {
    const result = await app.evaluate(async () => {
      const apps = window.__b3ndApps!;
      const rig = window.__b3ndStore!.getState().rig;
      const basePath = `memory://catalog-test/${Date.now()}`;
      apps.catalog.setBasePath(basePath);
      await apps.catalog.publish(rig, {
        slug: "my-app",
        name: "My App",
        description: "user-published",
        icon: "🚀",
        defaultBasePath: "memory://my-app/data",
        display: { kind: "builtin", id: "builtin:notes" },
      });
      const cat = await apps.catalog.load(rig);
      return cat.map((d) => ({ slug: d.slug, name: d.name }));
    });
    expect(result).toEqual(
      expect.arrayContaining([{ slug: "my-app", name: "My App" }]),
    );
  });

  test("a published descriptor with the same slug overrides the default", async ({ app }) => {
    const overridden = await app.evaluate(async () => {
      const apps = window.__b3ndApps!;
      const rig = window.__b3ndStore!.getState().rig;
      const basePath = `memory://catalog-override/${Date.now()}`;
      apps.catalog.setBasePath(basePath);
      await apps.catalog.publish(rig, {
        slug: "notes",
        name: "Notes (custom)",
        defaultBasePath: "memory://notes/custom",
        display: { kind: "builtin", id: "builtin:notes" },
      });
      const cat = await apps.catalog.load(rig);
      return cat.find((d) => d.slug === "notes");
    });
    expect(overridden?.name).toBe("Notes (custom)");
    expect(overridden?.defaultBasePath).toBe("memory://notes/custom");
  });

  test("setBasePath persists and reset removes the override", async ({ app }) => {
    const { stored, afterReset } = await app.evaluate(() => {
      const apps = window.__b3ndApps!;
      apps.catalog.setBasePath("memory://my-catalog");
      const stored = apps.catalog.getBasePath();
      apps.catalog.setBasePath(apps.catalog.getDefaultBasePath());
      return { stored, afterReset: apps.catalog.getBasePath() };
    });
    expect(stored).toBe("memory://my-catalog");
    expect(afterReset).toBe("memory://apps-catalog");
  });
});

test.describe("apps browser publish flow", () => {
  test("can open the publish form, submit, and see the new tile", async ({ app }) => {
    await app.evaluate(() => {
      const apps = window.__b3ndApps!;
      const basePath = `memory://browser-publish/${Date.now()}`;
      apps.catalog.setBasePath(basePath);
    });
    await app.goto("/apps");
    await app.getByTestId("apps-publish-toggle").click();
    await app.getByTestId("apps-publish-slug").fill("scratch");
    await app.getByTestId("apps-publish-name").fill("Scratchpad");
    await app.getByTestId("apps-publish-description").fill("temp");
    await app.getByTestId("apps-publish-icon").fill("✏️");
    await app.getByTestId("apps-publish-basepath").fill("memory://scratch/data");
    await app.getByTestId("apps-publish-submit").click();
    await expect(app.getByTestId("apps-tile-scratch")).toBeVisible();
  });
});

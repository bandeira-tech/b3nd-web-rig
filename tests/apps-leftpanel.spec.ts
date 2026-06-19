import { expect, test } from "./fixtures";

declare global {
  interface Window {
    __b3ndApps?: {
      mounts: { set(slug: string, basePath: string): void; clear(slug: string): void };
      catalog: { setBasePath(basePath: string): void; getDefaultBasePath(): string };
    };
  }
}

test.describe("AppsLeftSlot", () => {
  test.beforeEach(async ({ app }) => {
    // Reset catalog basepath so the panel only sees defaults.
    await app.evaluate(() => {
      const apps = window.__b3ndApps!;
      apps.catalog.setBasePath(apps.catalog.getDefaultBasePath());
    });
    await app.goto("/apps");
  });

  test("lists every default app with its mount basepath", async ({ app }) => {
    const list = app.getByTestId("apps-left-list");
    await expect(list).toBeVisible();
    for (const slug of ["notes", "bookmarks", "files", "inbox"]) {
      await expect(app.getByTestId(`apps-left-item-${slug}`)).toBeVisible();
    }
  });

  test("a custom mount basepath shows a 'mounted' badge in the panel", async ({ app }) => {
    await app.evaluate(() => {
      window.__b3ndApps!.mounts.set("notes", "memory://my-private-notes");
    });
    // Force a re-pull (the list memoises by route changes).
    await app.getByTestId("apps-left-refresh").click();
    const item = app.getByTestId("apps-left-item-notes");
    await expect(item).toContainText("mounted");
    await expect(item).toContainText("memory://my-private-notes");
    await app.evaluate(() => window.__b3ndApps!.mounts.clear("notes"));
  });

  test("clicking an item routes into its AppHost", async ({ app }) => {
    await app.getByTestId("apps-left-item-bookmarks").click();
    await expect(app).toHaveURL(/\/apps\/bookmarks/);
    await expect(app.getByTestId("builtin-bookmarks-app")).toBeVisible();
  });
});

test.describe("AppsBrowser HTML publish", () => {
  test("publishing an HTML app stores HTML + descriptor and mounts via iframe", async ({ app }) => {
    await app.evaluate(() => {
      const apps = window.__b3ndApps!;
      apps.catalog.setBasePath(`memory://html-publish-catalog/${Date.now()}`);
    });
    await app.goto("/apps");
    await app.getByTestId("apps-publish-toggle").click();
    await app.getByTestId("apps-publish-kind-html").click();
    await app.getByTestId("apps-publish-slug").fill("hello-html");
    await app.getByTestId("apps-publish-name").fill("Hello HTML");
    await app.getByTestId("apps-publish-icon").fill("👋");
    await app.getByTestId("apps-publish-basepath").fill("memory://hello-html/data");
    // Default HTML template is fine — it just echoes basepath.
    await app.getByTestId("apps-publish-submit").click();
    // Tile renders.
    await expect(app.getByTestId("apps-tile-hello-html")).toBeVisible();
    // And clicking it mounts the iframe.
    await app.getByTestId("apps-tile-hello-html").click();
    await expect(app.getByTestId("html-mount-iframe")).toBeVisible();
    const frame = app.frameLocator('[data-testid="html-mount-iframe"]');
    await expect(frame.locator("#basepath")).toHaveText(
      "memory://hello-html/data",
      { timeout: 5_000 },
    );
  });
});

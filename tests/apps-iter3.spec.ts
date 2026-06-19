import { expect, test } from "./fixtures";

declare global {
  interface Window {
    __b3ndApps?: {
      catalog: Array<{ slug: string; name: string; defaultBasePath: string }>;
      mounts: {
        get(slug: string): string | undefined;
        set(slug: string, basePath: string): void;
        clear(slug: string): void;
        list(): Array<{ slug: string; basePath: string; updatedAt: number }>;
      };
    };
  }
}

test.describe("default catalog (iter 3)", () => {
  test("ships both Notes and Bookmarks", async ({ app }) => {
    const slugs = await app.evaluate(() =>
      window.__b3ndApps!.catalog.map((d) => d.slug)
    );
    expect(slugs).toEqual(expect.arrayContaining(["notes", "bookmarks"]));
  });

  test("Bookmarks tile is visible and mounts the bookmarks app", async ({ app }) => {
    await app.goto("/apps");
    await expect(app.getByTestId("apps-tile-bookmarks")).toBeVisible();
    await app.getByTestId("apps-tile-bookmarks").click();
    await expect(app).toHaveURL(/\/apps\/bookmarks/);
    await expect(app.getByTestId("builtin-bookmarks-app")).toBeVisible();
  });
});

test.describe("bookmarks app", () => {
  test.beforeEach(async ({ app }) => {
    // Mount each test on a unique basepath so write-state doesn't bleed.
    const slug = `t${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    await app.goto(`/apps/bookmarks`);
    await app.getByTestId("app-host-basepath").fill(`memory://test-bookmarks/${slug}`);
  });

  test("Add stores a bookmark and it appears in the list", async ({ app }) => {
    await app.getByTestId("bookmarks-url-input").fill("https://example.com");
    await app.getByTestId("bookmarks-title-input").fill("Example");
    await app.getByTestId("bookmarks-add-button").click();
    const list = app.getByTestId("bookmarks-list");
    await expect(list).toBeVisible();
    await expect(list.getByText("Example", { exact: true })).toBeVisible();
    await expect(list.getByText("https://example.com")).toBeVisible();
  });

  test("URL without title falls back to URL as title", async ({ app }) => {
    const urlInput = app.getByTestId("bookmarks-url-input");
    await urlInput.fill("https://example.org/page");
    await app.getByTestId("bookmarks-add-button").click();
    const list = app.getByTestId("bookmarks-list");
    await expect(list).toBeVisible();
    await expect(list.getByText("https://example.org/page").first()).toBeVisible();
  });
});

test.describe("basepath persistence", () => {
  test.beforeEach(async ({ app }) => {
    await app.evaluate(() => {
      window.__b3ndApps!.mounts.clear("notes");
    });
  });

  test("editing the basepath persists across reloads and shows reset", async ({ app }) => {
    await app.goto("/apps/notes");
    const custom = "memory://custom-notes/space";
    await app.getByTestId("app-host-basepath").fill(custom);
    await expect(app.getByTestId("app-host-reset-basepath")).toBeVisible();

    // Persisted in localStorage right away.
    const stored = await app.evaluate(() =>
      window.__b3ndApps!.mounts.get("notes")
    );
    expect(stored).toBe(custom);

    // After reload the value is still there.
    await app.reload();
    await expect(app.getByTestId("builtin-notes-app")).toBeVisible();
    await expect(app.getByTestId("app-host-basepath")).toHaveValue(custom);
  });

  test("reset clears the override and removes the reset button", async ({ app }) => {
    await app.goto("/apps/notes");
    await app.getByTestId("app-host-basepath").fill("memory://x/y");
    await expect(app.getByTestId("app-host-reset-basepath")).toBeVisible();
    await app.getByTestId("app-host-reset-basepath").click();
    await expect(app.getByTestId("app-host-reset-basepath")).toHaveCount(0);
    const stored = await app.evaluate(() =>
      window.__b3ndApps!.mounts.get("notes")
    );
    expect(stored).toBeUndefined();
  });
});

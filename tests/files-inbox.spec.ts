import { expect, test } from "./fixtures";

declare global {
  interface Window {
    __b3ndApps?: {
      mounts: {
        clear(slug: string): void;
        set(slug: string, basePath: string): void;
      };
    };
  }
}

test.describe("Files app", () => {
  test.beforeEach(async ({ app }) => {
    const slug = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    await app.evaluate(({ slug }) => {
      window.__b3ndApps!.mounts.set("files", `memory://files-test/${slug}`);
    }, { slug });
    await app.goto("/apps/files");
  });

  test.afterEach(async ({ app }) => {
    await app.evaluate(() => window.__b3ndApps!.mounts.clear("files"));
  });

  test("renders and shows the empty state", async ({ app }) => {
    await expect(app.getByTestId("builtin-files-app")).toBeVisible();
    await expect(app.getByTestId("files-empty")).toBeVisible();
    await expect(app.getByTestId("files-preview-empty")).toBeVisible();
  });

  test("uploading a text file lists and previews it", async ({ app }) => {
    await app.getByTestId("files-upload-input").setInputFiles([
      {
        name: "hello.txt",
        mimeType: "text/plain",
        buffer: Buffer.from("hello from the test"),
      },
    ]);
    await expect(app.getByTestId("files-list")).toBeVisible();
    await app.getByTestId("files-list").getByText("hello.txt").click();
    // Hinted display picks the text strategy for `.txt`.
    await expect(app.getByTestId("display-text")).toContainText(
      "hello from the test",
    );
  });
});

test.describe("Inbox app", () => {
  test.beforeEach(async ({ app }) => {
    const slug = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    await app.evaluate(({ slug }) => {
      window.__b3ndApps!.mounts.set("inbox", `memory://inbox-test/${slug}`);
    }, { slug });
    await app.goto("/apps/inbox");
  });

  test.afterEach(async ({ app }) => {
    await app.evaluate(() => window.__b3ndApps!.mounts.clear("inbox"));
  });

  test("empty state then send pushes an entry", async ({ app }) => {
    await expect(app.getByTestId("inbox-empty")).toBeVisible();
    await app.getByTestId("inbox-draft").fill("first thought");
    await app.getByTestId("inbox-send").click();
    await expect(app.getByTestId("inbox-list")).toBeVisible();
    await expect(app.getByTestId("inbox-list")).toContainText("first thought");
  });

  test("entries land newest-first", async ({ app }) => {
    for (const t of ["one", "two", "three"]) {
      await app.getByTestId("inbox-draft").fill(t);
      await app.getByTestId("inbox-send").click();
      await expect(app.getByTestId("inbox-list")).toContainText(t);
    }
    const items = await app
      .getByTestId("inbox-list")
      .locator("li")
      .allTextContents();
    // 'three' was the latest write; it should appear in the first item.
    expect(items[0]).toContain("three");
  });
});

test.describe("catalog has the new tiles", () => {
  test("files and inbox tiles are visible on /apps", async ({ app }) => {
    await app.goto("/apps");
    await expect(app.getByTestId("apps-tile-files")).toBeVisible();
    await expect(app.getByTestId("apps-tile-inbox")).toBeVisible();
  });
});

import { expect, test } from "./fixtures";
import type { Page } from "@playwright/test";

async function spaNavigate(page: Page, url: string) {
  await page.evaluate((url) => {
    window.history.pushState({}, "", url);
    window.dispatchEvent(new PopStateEvent("popstate"));
  }, url);
}

test.describe("explorer (seeded)", () => {
  test("shows a seeded record under its protocol root", async ({ app, rig }) => {
    await rig.seed([
      ["mutable://demo/note", { title: "hello", body: "world" }],
    ]);

    await app.getByRole("button", { name: /Explorer/ }).click();
    await expect(app).toHaveURL(/\/explorer/);

    // The MemoryStore reports `entity:bytes` in schema, not URI prefixes,
    // so the rig harvests `protocol://host` from successful writes and
    // splices them into rootNodes. The "mutable://demo" prefix should
    // therefore surface in the nav after a seed.
    await expect(app.getByText("mutable://demo").first()).toBeVisible();
  });

  test("multiple records under the same prefix list together", async ({ app, rig }) => {
    await rig.seed([
      ["mutable://demo/a", { v: 1 }],
      ["mutable://demo/b", { v: 2 }],
      ["mutable://demo/c", { v: 3 }],
    ]);

    await spaNavigate(app, "/explorer/mutable/demo");

    await expect(app.getByText("a", { exact: true })).toBeVisible();
    await expect(app.getByText("b", { exact: true })).toBeVisible();
    await expect(app.getByText("c", { exact: true })).toBeVisible();
  });

  test("opening a seeded record renders its JSON data", async ({ app, rig }) => {
    await rig.seed([
      ["mutable://demo/note", { title: "hello", body: "world" }],
    ]);

    await spaNavigate(app, "/explorer/mutable/demo/note");

    await expect(app.getByText("Record Data")).toBeVisible();
    await expect(app.getByText(/hello/)).toBeVisible();
    await expect(app.getByText(/world/)).toBeVisible();
  });
});

import { expect, test } from "./fixtures";

test.describe("Apps surface the active account", () => {
  test.beforeEach(async ({ app }) => {
    await app.goto("/apps");
  });

  test("AppsLeftSlot shows the 'no account' fallback when none is active", async ({ app }) => {
    const tile = app.getByTestId("apps-left-account");
    await expect(tile).toBeVisible();
    await expect(tile).toContainText(/no account/i);
  });

  test("AppsBrowser welcome callout flags the shared scope when no account is set", async ({ app }) => {
    const callout = app.getByTestId("apps-browser-account");
    await expect(callout).toBeVisible();
    await expect(callout).toContainText(/shared/);
  });

  test("clicking the AppsLeftSlot account tile routes to /accounts", async ({ app }) => {
    await app.getByTestId("apps-left-account").click();
    await expect(app).toHaveURL(/\/accounts/);
  });
});

import { expect, test } from "./fixtures";

test.describe("editor → explorer integration", () => {
  // BLOCKED on the same HttpAdapter.listPath bug as in explorer-seeded.spec.ts:
  // the editor's write succeeds (visible in the breadcrumb), but the explorer
  // can't render the resulting record because listPath throws on the leaf URI.
  test.fixme("write in editor, read in explorer", async ({ app }) => {
    // 1. Go to the editor.
    await app.getByRole("button", { name: /Editor/ }).click();
    await expect(app).toHaveURL(/\/editor/);

    // 2. Fill URI template (no `:account` token → no identity required).
    const uriInput = app.getByPlaceholder(/mutable:\/\/accounts/);
    await uriInput.fill("mutable://app/greeting");

    // 3. Fill payload.
    const payload = app.getByPlaceholder('{"hello": "world"}');
    await payload.fill('{"text": "hi from editor"}');

    // 4. Submit.
    await app.getByRole("button", { name: /^Send$/ }).click();
    await expect(
      app.getByText("mutable://app/greeting", { exact: false }).first(),
    ).toBeVisible();

    // 5. Switch to explorer and navigate to the URI's path.
    await app.getByRole("button", { name: /Explorer/ }).click();
    await app.goto("/explorer/mutable/app/greeting");

    // 6. The record we just wrote is rendered.
    await expect(app.getByText("Record Data")).toBeVisible();
    await expect(app.getByText("hi from editor")).toBeVisible();
  });

  test("bottom-panel log shows receive:success after write", async ({ app }) => {
    await app.getByRole("button", { name: /Editor/ }).click();
    await app
      .getByPlaceholder(/mutable:\/\/accounts/)
      .fill("mutable://app/log-test");
    await app.getByPlaceholder('{"hello": "world"}').fill('{"ok": true}');
    await app.getByRole("button", { name: /^Send$/ }).click();

    // The rig wires `receive:success` → bottom-panel log entry.
    // Assert via store rather than scraping the panel UI: more robust
    // and doesn't require the panel to be expanded.
    await expect
      .poll(() =>
        app.evaluate(() => {
          const logs = (
            window.__b3ndStore!.getState() as unknown as {
              logs: { source: string; message: string; level: string }[];
            }
          ).logs;
          return logs.some(
            (l) =>
              l.source === "rig" &&
              l.level === "success" &&
              l.message.includes("mutable://app/log-test"),
          );
        }),
      )
      .toBe(true);
  });
});

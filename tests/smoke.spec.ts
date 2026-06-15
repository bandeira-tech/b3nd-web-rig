import { expect, test } from "./fixtures";

test.describe("smoke", () => {
  test("boots, header is visible, default backend is in-memory", async ({ app }) => {
    await expect(app.getByRole("button", { name: /Explorer/ })).toBeVisible();
    await expect(app.getByRole("button", { name: /Editor/ })).toBeVisible();

    const backendName = await app.evaluate(() => {
      const s = window.__b3ndStore!.getState() as unknown as {
        backends: { id: string; name: string; isActive: boolean }[];
        activeBackendId: string | null;
      };
      const active = s.backends.find((b) => b.id === s.activeBackendId);
      return active?.name ?? null;
    });
    expect(backendName).toBe("In-Memory");
  });

  test("explorer route renders without backend errors", async ({ app }) => {
    await app.getByRole("button", { name: /Explorer/ }).click();
    await expect(app).toHaveURL(/\/explorer/);
    // No "Failed to load" toast/banner on a fresh memory store
    await expect(app.getByText(/Failed to load/i)).toHaveCount(0);
  });
});

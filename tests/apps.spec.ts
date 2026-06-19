import { expect, test } from "./fixtures";

declare global {
  interface Window {
    __b3ndApps?: {
      defaults: Array<{ slug: string; name: string; defaultBasePath: string }>;
      builtins: () => Array<{ id: string; label: string }>;
      normalizeBasePath(input: string): string;
    };
  }
}

test.describe("apps catalog & browser", () => {
  test("default catalog ships at least Notes", async ({ app }) => {
    const slugs = await app.evaluate(() =>
      window.__b3ndApps!.defaults.map((d) => d.slug)
    );
    expect(slugs).toContain("notes");
  });

  test("Apps tab is visible in the header and routes to the browser", async ({ app }) => {
    await app.getByRole("button", { name: /Apps/ }).first().click();
    await expect(app).toHaveURL(/\/apps/);
    await expect(app.getByTestId("apps-browser")).toBeVisible();
    await expect(app.getByTestId("apps-tile-notes")).toBeVisible();
  });

  test("clicking the Notes tile mounts the AppHost with default basepath", async ({ app }) => {
    await app.goto("/apps");
    await app.getByTestId("apps-tile-notes").click();
    await expect(app).toHaveURL(/\/apps\/notes/);
    await expect(app.getByTestId("app-host-notes")).toBeVisible();
    await expect(app.getByTestId("builtin-notes-app")).toBeVisible();
    const value = await app.getByTestId("app-host-basepath").inputValue();
    expect(value).toMatch(/^memory:\/\//);
  });

  test("an unknown slug renders the missing-app fallback", async ({ app }) => {
    await app.goto("/apps/does-not-exist");
    await expect(app.getByTestId("app-host-missing")).toBeVisible();
  });
});

test.describe("RigSlot runtime", () => {
  test("normalizeBasePath strips trailing slashes and accepts memory://", async ({ app }) => {
    const normalized = await app.evaluate(() =>
      window.__b3ndApps!.normalizeBasePath("memory://my-app/data/")
    );
    expect(normalized).toBe("memory://my-app/data");
  });

  test("write + list + read round-trip on the live rig", async ({ app }) => {
    const result = await app.evaluate(async () => {
      const apps = window.__b3ndApps!;
      const store = window.__b3ndStore!;
      const rig = store.getState().rig;
      if (!rig) throw new Error("rig is null");
      const slot = apps.createRigSlot(rig as never, "memory://apps-test/round-trip");
      await slot.write("hello.md", "# Hi\n\nWorld");
      await slot.write("nested/two.md", "# Two");
      const items = await slot.list();
      const keys = items.map((i) => i.key).sort();
      const [entry] = await slot.read("hello.md");
      return { keys, body: entry?.data };
    });
    expect(result.keys).toEqual(expect.arrayContaining(["hello.md"]));
    expect(typeof result.body).toBe("string");
    expect(String(result.body)).toContain("# Hi");
  });

  test("slot resolves relative keys against its basepath", async ({ app }) => {
    const resolved = await app.evaluate(() => {
      const apps = window.__b3ndApps!;
      const store = window.__b3ndStore!;
      const rig = store.getState().rig;
      if (!rig) throw new Error("rig is null");
      const slot = apps.createRigSlot(rig as never, "memory://my/space");
      return {
        a: slot.resolve("foo.md"),
        b: slot.resolve("/foo.md"),
        c: slot.resolve("nested/bar.json"),
      };
    });
    expect(resolved.a).toBe("memory://my/space/foo.md");
    expect(resolved.b).toBe("memory://my/space/foo.md");
    expect(resolved.c).toBe("memory://my/space/nested/bar.json");
  });
});

import { expect, test } from "./fixtures";

declare global {
  interface Window {
    __b3ndApps?: {
      templates: {
        interpolate(
          template: string,
          account: { id?: string; pubkey?: string; name?: string } | null,
        ): string;
        hasPlaceholders(template: string): boolean;
      };
      mounts: { clear(slug: string): void };
    };
  }
}

test.describe("interpolateBasePath", () => {
  test("substitutes {account} with the active pubkey", async ({ app }) => {
    const result = await app.evaluate(() =>
      window.__b3ndApps!.templates.interpolate(
        "memory://accounts/{account}/notes",
        { pubkey: "deadbeef" },
      )
    );
    expect(result).toBe("memory://accounts/deadbeef/notes");
  });

  test("uses fallback after `?` when no account is active", async ({ app }) => {
    const result = await app.evaluate(() =>
      window.__b3ndApps!.templates.interpolate(
        "memory://accounts/{account?shared}/notes",
        null,
      )
    );
    expect(result).toBe("memory://accounts/shared/notes");
  });

  test("supports {accountName} with slugification", async ({ app }) => {
    const result = await app.evaluate(() =>
      window.__b3ndApps!.templates.interpolate(
        "memory://team/{accountName}/files",
        { name: "Bob Loblaw" },
      )
    );
    expect(result).toBe("memory://team/bob-loblaw/files");
  });

  test("unknown placeholders fall through to empty (or fallback)", async ({ app }) => {
    const result = await app.evaluate(() =>
      window.__b3ndApps!.templates.interpolate(
        "memory://x/{nope?else}/y",
        { pubkey: "deadbeef" },
      )
    );
    expect(result).toBe("memory://x/else/y");
  });

  test("templates without placeholders pass through unchanged", async ({ app }) => {
    const result = await app.evaluate(() =>
      window.__b3ndApps!.templates.interpolate(
        "memory://no-template/data",
        { pubkey: "x" },
      )
    );
    expect(result).toBe("memory://no-template/data");
  });
});

test.describe("AppHost shows resolved basepath next to a template", () => {
  test.beforeEach(async ({ app }) => {
    await app.evaluate(() => window.__b3ndApps!.mounts.clear("notes"));
    await app.goto("/apps/notes");
  });

  test("the resolved badge shows the substituted path with the fallback when no account", async ({ app }) => {
    const input = app.getByTestId("app-host-basepath");
    await expect(input).toHaveValue(/^mutable:\/\/\{account\?shared\}\/notes$/);
    await expect(app.getByTestId("app-host-resolved")).toContainText(
      "mutable://shared/notes",
    );
  });
});
